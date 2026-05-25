const env = require('../config/env');

function createStreamingAsrSession(options) {
  if (env.streamingAsrProvider === 'tencent') {
    return createTencentPlaceholderSession(options);
  }

  if (env.streamingAsrProvider === 'aliyun') {
    return createAliyunPlaceholderSession(options);
  }

  return createMockSession(options);
}

function createMockSession({ onPartial, onFinal, dialect }) {
  let frameCount = 0;
  let closed = false;

  return {
    sendAudioFrame() {
      if (closed) {
        return;
      }
      frameCount += 1;
      if (frameCount % 4 === 0) {
        onPartial({
          text: dialect === 'auto' ? '我正在听您说...' : `我正在听${dialect}内容...`,
          stable: false
        });
      }
    },
    async finish() {
      if (closed) {
        return null;
      }
      closed = true;
      const text = '我年轻时有一段很难忘的经历，那时候身边的人都很照顾我。';
      onFinal({
        text,
        confidence: 0.9,
        dialect: dialect || 'auto'
      });
      return text;
    },
    close() {
      closed = true;
    }
  };
}

function createTencentPlaceholderSession() {
  assertEnv(['TENCENT_ASR_SECRET_ID', 'TENCENT_ASR_SECRET_KEY', 'TENCENT_ASR_APP_ID']);
  const error = new Error('Tencent streaming ASR adapter is not implemented yet. Add WebSocket proxy logic in server/src/services/streaming-asr.service.js.');
  error.statusCode = 501;
  throw error;
}

function createAliyunPlaceholderSession() {
  assertEnv(['ALIYUN_ASR_ACCESS_KEY_ID', 'ALIYUN_ASR_ACCESS_KEY_SECRET', 'ALIYUN_ASR_APP_KEY']);
  const error = new Error('Aliyun streaming ASR adapter is not implemented yet. Add WebSocket proxy logic in server/src/services/streaming-asr.service.js.');
  error.statusCode = 501;
  throw error;
}

function assertEnv(names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) {
    const error = new Error(`Missing streaming ASR environment variables: ${missing.join(', ')}`);
    error.statusCode = 500;
    throw error;
  }
}

module.exports = {
  createStreamingAsrSession
};

