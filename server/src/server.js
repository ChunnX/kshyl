const fs = require('fs');
const http = require('http');
const path = require('path');
const app = require('./app');
const env = require('./config/env');
const { attachConversationRealtime } = require('./realtime/conversation-realtime');

const uploadPath = path.resolve(process.cwd(), env.uploadDir);
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const server = http.createServer(app);
attachConversationRealtime(server);

server.listen(env.port, () => {
  console.log(`Memory miniapp server listening on http://localhost:${env.port}`);
  console.log(`Realtime conversation WebSocket path: ${env.realtimeWsPath}`);
});
