const express = require('express');
const multer = require('multer');
const env = require('../config/env');
const store = require('../db/memory-store');

const router = express.Router();
const upload = multer({ dest: env.uploadDir });

router.post('/upload', upload.single('photo'), async (req, res, next) => {
  if (!req.file) {
    res.status(400).json({ message: 'photo file is required' });
    return;
  }

  try {
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
    next(error);
  }
});

router.get('/persons/:personId/photos', async (req, res, next) => {
  try {
    res.json({
      photos: await store.listPhotos({ personId: req.params.personId })
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
