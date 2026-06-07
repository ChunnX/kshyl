const express = require('express');
const store = require('../db/memory-store');
const storyEditor = require('../services/story-editor.service');
const { audioUpload } = require('../middleware/upload');
const { loadOwnedPerson } = require('../middleware/auth');

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    await loadOwnedPerson(store, req.body.personId, req.userId);
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

router.post('/upload', audioUpload.single('audio'), async (req, res, next) => {
  try {
    await loadOwnedPerson(store, req.body.personId, req.userId);
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
    const recording = await store.getRecording(req.params.recordingId);
    if (!recording) {
      res.status(404).json({ message: 'Recording not found' });
      return;
    }
    await loadOwnedPerson(store, recording.personId, req.userId);
    const result = await storyEditor.createStoryFromRecording(req.params.recordingId);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.delete('/:recordingId', async (req, res, next) => {
  try {
    const recording = await store.getRecording(req.params.recordingId);
    if (!recording) {
      res.status(404).json({ message: 'Recording not found' });
      return;
    }
    await loadOwnedPerson(store, recording.personId, req.userId);
    await store.deleteRecording(req.params.recordingId);
    res.json({ deleted: true, id: req.params.recordingId });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
