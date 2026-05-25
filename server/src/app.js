const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const personRoutes = require('./routes/persons.routes');
const recordingRoutes = require('./routes/recordings.routes');
const storyRoutes = require('./routes/stories.routes');
const conversationRoutes = require('./routes/conversations.routes');
const photoRoutes = require('./routes/photos.routes');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'memory-miniapp-server'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/persons', personRoutes);
app.use('/api/recordings', recordingRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api', conversationRoutes);
app.use('/api/photos', photoRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: 'Not found'
  });
});

app.use((error, req, res, next) => {
  res.status(error.statusCode || 500).json({
    message: error.message || 'Internal server error'
  });
});

module.exports = app;
