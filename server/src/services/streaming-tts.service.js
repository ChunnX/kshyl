const env = require('../config/env');

async function synthesizeRealtimeReply(text) {
  if (env.streamingTtsProvider === 'mock') {
    return {
      type: 'tts_text',
      text,
      audioUrl: null,
      provider: 'mock'
    };
  }

  const error = new Error('Streaming TTS adapter is not implemented yet. Add provider call in server/src/services/streaming-tts.service.js.');
  error.statusCode = 501;
  throw error;
}

module.exports = {
  synthesizeRealtimeReply
};

