const express = require('express');
const store = require('../db/memory-store');
const { photoUpload } = require('../middleware/upload');
const { loadOwnedPerson } = require('../middleware/auth');
const storage = require('../services/storage.service');

const router = express.Router();

router.post('/upload', photoUpload.single('photo'), async (req, res, next) => {
  if (!req.file) {
    res.status(400).json({ message: 'photo file is required' });
    return;
  }

  try {
    await loadOwnedPerson(store, req.body.personId, req.userId);
    if (req.body.conversationId) {
      const conversation = await store.getConversation(req.body.conversationId);
      if (!conversation || conversation.personId !== req.body.personId) {
        const error = new Error('Conversation not found');
        error.statusCode = 404;
        throw error;
      }
    }
    if (req.body.storyId) {
      const story = await store.getStory(req.body.storyId);
      if (!story || story.personId !== req.body.personId) {
        const error = new Error('Story not found');
        error.statusCode = 404;
        throw error;
      }
    }
    const photo = await store.createPhoto({
      personId: req.body.personId,
      conversationId: req.body.conversationId || null,
      storyId: req.body.storyId || null,
      imageUrl: req.file.path,
      note: req.body.note || '',
      originalName: req.file.originalname
    });

    res.status(201).json({ photo });
  } catch (error) {
    await storage.remove(req.file && req.file.path);
    next(error);
  }
});

router.get('/persons/:personId/photos', async (req, res, next) => {
  try {
    await loadOwnedPerson(store, req.params.personId, req.userId);
    res.json({
      photos: await store.listPhotos({ personId: req.params.personId })
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:photoId', async (req, res, next) => {
  try {
    const photo = await store.getPhoto(req.params.photoId);
    if (!photo) {
      res.status(404).json({ message: 'Photo not found' });
      return;
    }
    await loadOwnedPerson(store, photo.personId, req.userId);
    await storage.remove(photo.url);
    await store.deletePhoto(req.params.photoId);
    res.json({ deleted: true, id: req.params.photoId });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
