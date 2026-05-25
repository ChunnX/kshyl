require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT || 3000),
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  dataFile: process.env.DATA_FILE || 'data/dev-store.json',
  llmProvider: process.env.LLM_PROVIDER || 'mock',
  asrProvider: process.env.ASR_PROVIDER || 'mock',
  streamingAsrProvider: process.env.STREAMING_ASR_PROVIDER || process.env.ASR_PROVIDER || 'mock',
  voiceProvider: process.env.VOICE_PROVIDER || 'mock',
  streamingTtsProvider: process.env.STREAMING_TTS_PROVIDER || process.env.VOICE_PROVIDER || 'mock',
  realtimeWsPath: process.env.REALTIME_WS_PATH || '/realtime/conversations'
};
