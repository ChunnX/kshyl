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
  realtimeWsPath: process.env.REALTIME_WS_PATH || '/realtime/conversations',
  // File storage. local = container disk served at /files; cos = Tencent COS (see storage.service.js).
  storageProvider: process.env.STORAGE_PROVIDER || 'local',
  storageDir: process.env.STORAGE_DIR || 'storage',
  storagePublicPath: process.env.STORAGE_PUBLIC_PATH || '/files',
  // Auth. WECHAT_* enable real code2Session; JWT_SECRET signs sessions.
  wechatAppId: process.env.WECHAT_APPID || '',
  wechatSecret: process.env.WECHAT_SECRET || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
  // Dev bypass: skip JWT verification and act as the demo user. Defaults on outside
  // production so offline dev + smoke work without tokens; force with DEV_AUTH_BYPASS.
  devAuthBypass:
    process.env.DEV_AUTH_BYPASS !== undefined
      ? process.env.DEV_AUTH_BYPASS === 'true'
      : process.env.NODE_ENV !== 'production'
};
