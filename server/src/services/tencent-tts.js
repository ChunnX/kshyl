/**
 * Shared Tencent Cloud TTS (TextToVoice) helper.
 * Synthesizes a whole utterance to an mp3, persists it via the storage layer, and
 * returns a client-resolvable URL. Used by both speech.service (REST turns / opening)
 * and streaming-tts.service (realtime replies).
 *
 * Credentials reuse the ASR keys by default so a single Tencent secret pair works for
 * the whole voice stack; override with TENCENT_TTS_* if you split them.
 */
const { randomUUID } = require('crypto');
const tencentApi = require('../utils/tencent-api');
const storage = require('./storage.service');

function getCreds() {
  const secretId = process.env.TENCENT_TTS_SECRET_ID || process.env.TENCENT_ASR_SECRET_ID;
  const secretKey = process.env.TENCENT_TTS_SECRET_KEY || process.env.TENCENT_ASR_SECRET_KEY;
  if (!secretId || !secretKey) {
    const error = new Error('Missing Tencent TTS credentials (set TENCENT_TTS_SECRET_ID/KEY or TENCENT_ASR_SECRET_ID/KEY)');
    error.statusCode = 500;
    throw error;
  }
  return { secretId, secretKey };
}

async function synthesizeToFile(text) {
  const clean = String(text || '').trim();
  if (!clean) {
    return { audioUrl: null, provider: 'tencent' };
  }

  const { secretId, secretKey } = getCreds();
  const region = process.env.TENCENT_TTS_REGION || 'ap-guangzhou';

  const payload = {
    Text: clean.slice(0, 1000), // TextToVoice single-call text length cap
    SessionId: randomUUID(),
    ProjectId: 0,
    ModelType: 1,
    VoiceType: Number(process.env.TENCENT_TTS_VOICE_TYPE || 101016), // a warm Mandarin voice
    Volume: 5,
    Speed: 0,
    SampleRate: 16000,
    Codec: 'mp3',
    PrimaryLanguage: 1
  };

  const response = await tencentApi.request({
    secretId,
    secretKey,
    service: 'tts',
    action: 'TextToVoice',
    version: '2019-08-23',
    region,
    payload
  });

  if (response.Response && response.Response.Error) {
    throw new Error(`Tencent TTS Error: ${response.Response.Error.Message}`);
  }

  const audioBase64 = response.Response && response.Response.Audio;
  if (!audioBase64) {
    throw new Error('Tencent TTS returned empty audio');
  }

  const buffer = Buffer.from(audioBase64, 'base64');
  const saved = await storage.save({
    buffer,
    key: `speech/tts_${randomUUID()}.mp3`
  });

  return { audioUrl: saved.url, provider: 'tencent' };
}

module.exports = {
  synthesizeToFile
};
