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

const fs = require('fs');
const path = require('path');
const tencentApi = require('../utils/tencent-api');

async function transcribeWithTencent(recording) {
  assertEnv(['TENCENT_ASR_SECRET_ID', 'TENCENT_ASR_SECRET_KEY', 'TENCENT_ASR_APP_ID']);

  const filePath = path.resolve(process.cwd(), recording.audioUrl);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Audio file not found: ${recording.audioUrl}`);
  }

  const fileBuffer = fs.readFileSync(filePath);
  const base64Data = fileBuffer.toString('base64');
  const dataLen = fileBuffer.length;

  const payload = {
    ProjectId: 0,
    SubServiceType: 2,
    EngSerInfoSpec: '16k_zh',
    SourceType: 1,
    VoiceFormat: 'mp3',
    Data: base64Data,
    DataLen: dataLen
  };

  const response = await tencentApi.request({
    secretId: process.env.TENCENT_ASR_SECRET_ID,
    secretKey: process.env.TENCENT_ASR_SECRET_KEY,
    service: 'asr',
    action: 'SentenceRecognition',
    version: '2019-06-14',
    region: process.env.TENCENT_ASR_REGION || 'ap-guangzhou',
    payload
  });

  if (response.Response && response.Response.Error) {
    throw new Error(`Tencent ASR Error: ${response.Response.Error.Message}`);
  }

  const resultText = response.Response ? response.Response.Result : '';

  return {
    rawText: resultText || '（未能识别到语音内容）',
    confidence: 0.95,
    provider: 'tencent'
  };
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
