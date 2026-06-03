const express = require('express');
const multer = require('multer');
const env = require('../config/env');
const store = require('../db/memory-store');
const storyEditor = require('../services/story-editor.service');

const router = express.Router();
const upload = multer({ dest: env.uploadDir });

router.post('/', async (req, res, next) => {
  try {
    const recording = await store.createRecording({
      personId: req.body.personId,
      audioUrl: req.body.audioUrl || null,
      duration: req.body.duration || 0,
      mockText: req.body.mockText
    });
    res.status(201).json({ recording });
  } catch (error) {
    next(error);
  }
});

router.post('/upload', upload.single('audio'), async (req, res, next) => {
  try {
    const recording = await store.createRecording({
      personId: req.body.personId,
      audioUrl: req.file ? req.file.path : null,
      duration: 0
    });
    res.status(201).json({ recording });
  } catch (error) {
    next(error);
  }
});

router.post('/:recordingId/stories', async (req, res, next) => {
  try {
    const result = await storyEditor.createStoryFromRecording(req.params.recordingId);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
