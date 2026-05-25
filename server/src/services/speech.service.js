const env = require('../config/env');

async function synthesizeSpeech(text) {
  if (env.voiceProvider === 'mock') {
    return {
      audioUrl: null,
      provider: 'mock',
      text
    };
  }

  const error = new Error('TTS adapter is configured but not implemented yet. Add TTS provider call in server/src/services/speech.service.js.');
  error.statusCode = 501;
  throw error;
}

module.exports = {
  synthesizeSpeech
};

