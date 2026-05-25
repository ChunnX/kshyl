const express = require('express');

const router = express.Router();

router.post('/wechat-login', (req, res) => {
  res.json({
    user: {
      id: 'user_demo_001',
      openid: 'openid_demo',
      role: 'family'
    },
    token: 'dev-token'
  });
});

module.exports = router;

