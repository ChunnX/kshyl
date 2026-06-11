const express = require('express');
const https = require('https');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const store = require('../db/memory-store');

const router = express.Router();

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

router.post('/wechat-login', async (req, res, next) => {
  try {
    let openid;

    if (env.wechatAppId && env.wechatSecret) {
      if (!req.body.code) {
        res.status(400).json({ message: '微信登录 code 不能为空' });
        return;
      }
      const session = await code2Session(req.body.code);
      if (session.errcode) {
        res.status(400).json({ message: `微信登录失败：${session.errmsg}` });
        return;
      }
      if (!session.openid) {
        res.status(502).json({ message: '微信登录响应缺少 openid' });
        return;
      }
      openid = session.openid;
    } else if (env.devAuthBypass) {
      // Dev/offline: deterministic demo identity (owns the seeded demo person).
      openid = 'openid_demo';
    } else {
      res.status(503).json({ message: '服务端未配置 WECHAT_APPID/WECHAT_SECRET' });
      return;
    }

    const user = await store.upsertUserByOpenid({ openid, role: 'family' });
    res.json({
      user: { id: user.id, openid: user.openid, role: user.role },
      token: signToken(user)
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
