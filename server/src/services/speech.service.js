const env = require('../config/env');
const tencentTts = require('./tencent-tts');

/**
 * Non-realtime TTS for conversation openings and REST turn replies.
 * Returns { audioUrl, provider, text }. Mock keeps audioUrl null (silent) so the
 * whole stack runs offline; tencent synthesizes a downloadable mp3.
 */
async function synthesizeSpeech(text) {
  if (env.voiceProvider === 'tencent') {
    const result = await tencentTts.synthesizeToFile(text);
    return { audioUrl: result.audioUrl, provider: 'tencent', text };
  }

  return {
    audioUrl: null,
    provider: 'mock',
    text
  };
}

module.exports = {
  synthesizeSpeech
};
