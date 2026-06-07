const express = require('express');
const https = require('https');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const store = require('../db/memory-store');

const router = express.Router();

function signToken(user) {
  return jwt.sign({ userId: user.id, openid: user.openid }, env.jwtSecret, { expiresIn: '30d' });
}

function code2Session(code) {
  const url =
    `https://api.weixin.qq.com/sns/jscode2session?appid=${env.wechatAppId}` +
    `&secret=${env.wechatSecret}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
  return new Promise((resolve, reject) => {
    https
      .get(url, (resp) => {
        let data = '';
        resp.on('data', (chunk) => {
          data += chunk;
        });
        resp.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on('error', reject);
  });
}

router.post('/wechat-login', async (req, res, next) => {
  try {
    let openid;

    if (env.wechatAppId && env.wechatSecret && req.body.code) {
      const session = await code2Session(req.body.code);
      if (session.errcode) {
        res.status(400).json({ message: `微信登录失败：${session.errmsg}` });
        return;
      }
      openid = session.openid;
    } else {
      // Dev/offline: deterministic demo identity (owns the seeded demo person).
      openid = 'openid_demo';
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
