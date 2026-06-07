const env = require('../config/env');
const tencentTts = require('./tencent-tts');

/**
 * Realtime reply TTS. Mock returns text only (audioUrl null) so offline dev/smoke
 * stays silent and fast; tencent synthesizes the segment to an mp3 URL the client plays.
 */
async function synthesizeRealtimeReply(text) {
  if (env.streamingTtsProvider === 'tencent') {
    const result = await tencentTts.synthesizeToFile(text);
    return {
      type: 'tts_audio',
      text,
      audioUrl: result.audioUrl,
      provider: 'tencent'
    };
  }

  return {
    type: 'tts_text',
    text,
    audioUrl: null,
    provider: 'mock'
  };
}

module.exports = {
  synthesizeRealtimeReply
};
