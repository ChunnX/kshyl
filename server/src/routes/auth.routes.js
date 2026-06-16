const express = require('express');
const https = require('https');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const store = require('../db/memory-store');

const router = express.Router();
const CURRENT_TERMS_VERSION = '2026-06-16';
const CURRENT_PRIVACY_VERSION = '2026-06-16';

function publicUser(user) {
  return {
    id: user.id,
    openid: user.openid,
    username: user.username || '',
    role: user.role,
    profileCompleted: Boolean(user.username && user.termsAcceptedAt && user.privacyAcceptedAt),
    termsVersion: user.termsVersion || '',
    privacyVersion: user.privacyVersion || ''
  };
}

function validateUsername(username) {
  const normalized = String(username || '').trim();
  if (normalized.length < 2 || normalized.length > 20) {
    const error = new Error('用户名需为 2-20 个字符');
    error.statusCode = 400;
    throw error;
  }
  return normalized;
}

function assertAcceptedVersions(body) {
  if (body.acceptedTermsVersion !== CURRENT_TERMS_VERSION) {
    const error = new Error('请先阅读并同意当前版本用户协议');
    error.statusCode = 400;
    throw error;
  }
  if (body.acceptedPrivacyVersion !== CURRENT_PRIVACY_VERSION) {
    const error = new Error('请先阅读并同意当前版本隐私政策');
    error.statusCode = 400;
    throw error;
  }
}

function signToken(user) {
  if (!env.devAuthBypass && !env.hasSecureJwtSecret) {
    const error = new Error('服务端 JWT_SECRET 未安全配置');
    error.statusCode = 503;
    throw error;
  }
  return jwt.sign({ userId: user.id, openid: user.openid }, env.jwtSecret, { expiresIn: '30d' });
}

function code2Session(code) {
  const url =
    `https://api.weixin.qq.com/sns/jscode2session?appid=${env.wechatAppId}` +
    `&secret=${env.wechatSecret}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
  return new Promise((resolve, reject) => {
    const request = https.get(url, (resp) => {
        let data = '';
        resp.on('data', (chunk) => {
          data += chunk;
        });
        resp.on('end', () => {
          try {
            if (resp.statusCode < 200 || resp.statusCode >= 300) {
              reject(new Error(`微信登录服务返回 HTTP ${resp.statusCode}`));
              return;
            }
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      });
    request.setTimeout(8000, () => {
      request.destroy(new Error('微信登录服务请求超时'));
    });
    request.on('error', reject);
  });
}

async function resolveOpenidFromCode(code) {
  if (env.wechatAppId && env.wechatSecret) {
    if (!code) {
      const error = new Error('微信登录 code 不能为空');
      error.statusCode = 400;
      throw error;
    }
    const session = await code2Session(code);
    if (session.errcode) {
      const error = new Error(`微信登录失败：${session.errmsg}`);
      error.statusCode = 400;
      throw error;
    }
    if (!session.openid) {
      const error = new Error('微信登录响应缺少 openid');
      error.statusCode = 502;
      throw error;
    }
    return session.openid;
  }

  if (env.devAuthBypass) {
    // Dev/offline: deterministic demo identity (owns the seeded demo person).
    return 'openid_demo';
  }

  const error = new Error('服务端未配置 WECHAT_APPID/WECHAT_SECRET');
  error.statusCode = 503;
  throw error;
}

router.post('/register', async (req, res, next) => {
  try {
    const username = validateUsername(req.body.username);
    assertAcceptedVersions(req.body);

    const openid = await resolveOpenidFromCode(req.body.code);
    const now = new Date();
    const user = await store.upsertUserByOpenid({
      openid,
      username,
      role: 'family',
      termsVersion: CURRENT_TERMS_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION,
      termsAcceptedAt: now,
      privacyAcceptedAt: now,
      registeredAt: now
    });

    res.json({
      user: publicUser(user),
      token: signToken(user)
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      res.status(401).json({ message: '未登录' });
      return;
    }

    const payload = jwt.verify(token, env.jwtSecret);
    const user = await store.getUserById(payload.userId);
    if (!user) {
      res.status(401).json({ message: '登录已过期，请重新登录' });
      return;
    }

    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post('/wechat-login', async (req, res, next) => {
  try {
    const openid = await resolveOpenidFromCode(req.body.code);
    let user = await store.getUserByOpenid(openid);
    if (!user) {
      user = await store.upsertUserByOpenid({ openid, role: 'family' });
    }
    if (!user.profileCompleted) {
      res.status(409).json({
        message: '请先完成注册',
        needsRegistration: true
      });
      return;
    }

    res.json({
      user: publicUser(user),
      token: signToken(user)
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
