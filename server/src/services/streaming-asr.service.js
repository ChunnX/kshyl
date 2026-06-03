const env = require('../config/env');

function createStreamingAsrSession(options) {
  if (env.streamingAsrProvider === 'tencent') {
    return createTencentSession(options);
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

const WebSocket = require('ws');
const crypto = require('crypto');

function createTencentSession({ onPartial, onFinal, onError, onSilenceDetected, dialect }) {
  assertEnv(['TENCENT_ASR_SECRET_ID', 'TENCENT_ASR_SECRET_KEY', 'TENCENT_ASR_APP_ID']);

  const appid = process.env.TENCENT_ASR_APP_ID;
  const secretid = process.env.TENCENT_ASR_SECRET_ID;
  const secretkey = process.env.TENCENT_ASR_SECRET_KEY;
  const voiceId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

  const timestamp = Math.floor(Date.now() / 1000);
  const expired = timestamp + 86400;
  const nonce = Math.floor(Math.random() * 100000);

  // Map dialect to Tencent Cloud ASR engines
  let engineModel = process.env.TENCENT_ASR_ENGINE_MODEL_TYPE || '16k_zh_large';
  if (dialect === 'yue') {
    engineModel = '16k_yue';
  } else if (dialect === 'sichuan') {
    engineModel = '16k_zh_large';
  }

  const queryParams = {
    secretid,
    timestamp: String(timestamp),
    expired: String(expired),
    nonce: String(nonce),
    engine_model_type: engineModel,
    voice_id: voiceId,
    voice_format: '1',
    needvad: '1',
    vad_silence_time: '1000',
    filter_empty_result: '1',
    convert_num_mode: '1',
    word_info: '0'
  };

  const sortedKeys = Object.keys(queryParams).sort();
  const paramString = sortedKeys.map(k => `${k}=${queryParams[k]}`).join('&');
  const signatureBase = `asr.cloud.tencent.com/asr/v2/${appid}?${paramString}`;
  const signature = crypto.createHmac('sha1', secretkey).update(signatureBase).digest('base64');

  const wsUrl = `wss://asr.cloud.tencent.com/asr/v2/${appid}?${paramString}&signature=${encodeURIComponent(signature)}`;
  
  const client = new WebSocket(wsUrl);
  let closed = false;
  let ending = false;
  let latestPartialText = '';
  let finishResolver = null;
  let finishTimer = null;
  const finalSegments = new Map();
  const pendingFrames = [];

  function combinedFinalText() {
    const text = Array.from(finalSegments.keys())
      .sort((a, b) => a - b)
      .map((index) => finalSegments.get(index))
      .join('');
    return text || latestPartialText;
  }

  function reportError(message) {
    if (onError) {
      onError(message);
    }
  }

  function resolveFinish() {
    if (finishTimer) {
      clearTimeout(finishTimer);
      finishTimer = null;
    }
    if (finishResolver) {
      const resolve = finishResolver;
      finishResolver = null;
      resolve(combinedFinalText());
    }
  }

  client.on('open', () => {
    while (pendingFrames.length && client.readyState === WebSocket.OPEN) {
      client.send(pendingFrames.shift());
    }
    if (ending) {
      client.send(JSON.stringify({ type: 'end' }));
    }
  });

  client.on('message', (data) => {
    try {
      const resp = JSON.parse(data.toString());
      if (resp.code !== 0) {
        const message = resp.message || `Tencent ASR error code ${resp.code}`;
        console.error('Tencent Real-time ASR error response:', message);
        reportError(message);
        return;
      }

      if (resp.final === 1) {
        resolveFinish();
        return;
      }

      const result = resp.result;
      if (!result) {
        return;
      }

      const text = result.voice_text_str || '';
      if (!text) {
        return;
      }
      
      if (result.slice_type === 2) {
        finalSegments.set(Number(result.index || 0), text);
        onFinal({
          text: combinedFinalText(),
          confidence: 0.95,
          dialect: dialect || 'auto'
        });
        if (onSilenceDetected) {
          onSilenceDetected();
        }
      } else {
        latestPartialText = text;
        onPartial({
          text,
          stable: result.slice_type === 1
        });
      }
    } catch (err) {
      console.error('Failed to parse Tencent ASR message:', err);
    }
  });

  client.on('error', (err) => {
    console.error('Tencent Streaming ASR WS error:', err.message);
    reportError(err.message);
  });

  client.on('close', () => {
    closed = true;
    resolveFinish();
  });

  return {
    sendAudioFrame(buffer) {
      if (closed) {
        return;
      }
      if (client.readyState === WebSocket.CONNECTING) {
        pendingFrames.push(Buffer.from(buffer));
        return;
      }
      if (client.readyState !== WebSocket.OPEN) {
        return;
      }
      client.send(buffer);
    },
    async finish() {
      if (closed) {
        return combinedFinalText();
      }
      return new Promise((resolve) => {
        finishResolver = resolve;
        ending = true;
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'end' }));
        }
        finishTimer = setTimeout(() => {
          if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
            client.close();
          }
          resolveFinish();
        }, 3000);
      });
    },
    close() {
      client.close();
      closed = true;
    }
  };
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
