const env = require('../config/env');

async function transcribeRecording(recording) {
  if (env.asrProvider === 'tencent') {
    return transcribeWithTencent(recording);
  }

  if (env.asrProvider === 'aliyun') {
    return transcribeWithAliyun(recording);
  }

  return transcribeWithMock(recording);
}

async function transcribeWithMock(recording) {
  return {
    rawText: recording.mockText || '我小时候住在一个很热闹的院子里。那时候日子不富裕，但是邻居之间都很亲近。',
    confidence: 0.92,
    provider: 'mock'
  };
}

async function transcribeWithTencent() {
  assertEnv(['TENCENT_ASR_SECRET_ID', 'TENCENT_ASR_SECRET_KEY', 'TENCENT_ASR_APP_ID']);
  const error = new Error('Tencent ASR adapter is configured but not implemented yet. Add Tencent SDK call in server/src/services/asr.service.js.');
  error.statusCode = 501;
  throw error;
}

async function transcribeWithAliyun() {
  assertEnv(['ALIYUN_ASR_ACCESS_KEY_ID', 'ALIYUN_ASR_ACCESS_KEY_SECRET', 'ALIYUN_ASR_APP_KEY']);
  const error = new Error('Aliyun ASR adapter is configured but not implemented yet. Add Aliyun SDK call in server/src/services/asr.service.js.');
  error.statusCode = 501;
  throw error;
}

function assertEnv(names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) {
    const error = new Error(`Missing ASR environment variables: ${missing.join(', ')}`);
    error.statusCode = 500;
    throw error;
  }
}

module.exports = {
  transcribeRecording
};
