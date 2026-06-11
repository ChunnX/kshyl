const fs = require('fs');
const http = require('http');
const path = require('path');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');

process.env.NODE_ENV = 'production';
process.env.DEV_AUTH_BYPASS = 'false';
process.env.JWT_SECRET = 'security-test-secret-with-enough-entropy';
process.env.WECHAT_APPID = '';
process.env.WECHAT_SECRET = '';
process.env.DATA_FILE = 'data/security-test-store.json';
process.env.STREAMING_ASR_PROVIDER = 'mock';
process.env.STREAMING_TTS_PROVIDER = 'mock';
process.env.VOICE_PROVIDER = 'mock';

const app = require('../src/app');
const { attachConversationRealtime } = require('../src/realtime/conversation-realtime');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function listen() {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    attachConversationRealtime(server);
    server.listen(0, () => {
      resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

async function request(baseUrl, pathName, token, options = {}) {
  const response = await fetch(`${baseUrl}${pathName}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  return {
    response,
    data: await response.json()
  };
}

function expectRejectedUpgrade(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timeout = setTimeout(() => reject(new Error('anonymous WebSocket was not rejected')), 3000);
    ws.on('unexpected-response', (request, response) => {
      clearTimeout(timeout);
      try {
        assert(response.statusCode === 401, 'anonymous WebSocket should return 401');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
    ws.on('open', () => reject(new Error('anonymous WebSocket unexpectedly opened')));
    ws.on('error', () => {});
  });
}

function expectOwnedWebSocket(url, token, shouldStart) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('authenticated WebSocket test timed out'));
    }, 5000);

    ws.on('message', (data) => {
      const event = JSON.parse(data.toString());
      if (shouldStart && event.type === 'conversation_started') {
        clearTimeout(timeout);
        ws.close();
        resolve();
      }
      if (!shouldStart && event.type === 'error') {
        clearTimeout(timeout);
        ws.close();
        resolve();
      }
    });
    ws.on('error', reject);
  });
}

async function main() {
  const dataPath = path.resolve(process.cwd(), process.env.DATA_FILE);
  fs.rmSync(dataPath, { force: true });

  const { server, baseUrl } = await listen();
  const demoToken = jwt.sign(
    { userId: 'user_demo_001', openid: 'openid_demo' },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  );
  const otherToken = jwt.sign(
    { userId: 'user_other_001', openid: 'openid_other' },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  );

  try {
    const anonymous = await request(baseUrl, '/api/persons/person_demo_001');
    assert(anonymous.response.status === 401, 'anonymous HTTP request should be 401');

    const unconfiguredLogin = await request(baseUrl, '/api/auth/wechat-login', null, {
      method: 'POST',
      body: JSON.stringify({ code: 'test-code' })
    });
    assert(unconfiguredLogin.response.status === 503, 'production login must not fall back to demo user');

    const owned = await request(baseUrl, '/api/persons/person_demo_001', demoToken);
    assert(owned.response.status === 200, 'owner should access person');

    const foreign = await request(baseUrl, '/api/persons/person_demo_001', otherToken);
    assert(foreign.response.status === 404, 'foreign user should not access person');

    const wsUrl =
      `${baseUrl.replace('http://', 'ws://')}/realtime/conversations` +
      '?personId=person_demo_001&mode=dialogue&dialect=auto';
    await expectRejectedUpgrade(wsUrl);
    await expectOwnedWebSocket(wsUrl, otherToken, false);
    await expectOwnedWebSocket(wsUrl, demoToken, true);

    console.log('Security test passed');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dataPath, { force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
