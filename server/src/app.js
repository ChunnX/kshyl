const path = require('path');
const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const authRoutes = require('./routes/auth.routes');
const personRoutes = require('./routes/persons.routes');
const recordingRoutes = require('./routes/recordings.routes');
const storyRoutes = require('./routes/stories.routes');
const conversationRoutes = require('./routes/conversations.routes');
const photoRoutes = require('./routes/photos.routes');
const themeRoutes = require('./routes/themes.routes');
const invitationRoutes = require('./routes/invitations.routes');
const { requireAuth } = require('./middleware/auth');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve generated/downloadable artifacts (book exports, synthesized speech) for the
// local storage provider. Object storage (COS) serves its own URLs instead.
app.use(env.storagePublicPath, express.static(path.resolve(process.cwd(), env.storageDir)));

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'memory-miniapp-server'
  });
});

// Public routes: login, and invitation share links (used by people who aren't logged in).
app.use('/api/auth', authRoutes);
app.use('/api/invitations', invitationRoutes);

// Everything below requires a valid session (req.userId).
app.use('/api', requireAuth);
app.use('/api/persons', personRoutes);
app.use('/api/recordings', recordingRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api', conversationRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/themes', themeRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: 'Not found'
  });
});

app.use((error, req, res, next) => {
  // Multer raises MulterError (e.g. LIMIT_FILE_SIZE) without a statusCode; treat as client errors.
  if (error && error.name === 'MulterError') {
    const message = error.code === 'LIMIT_FILE_SIZE' ? '文件太大' : '文件上传失败';
    res.status(400).json({ message });
    return;
  }
  res.status(error.statusCode || 500).json({
    message: error.message || 'Internal server error'
  });
});

module.exports = app;
