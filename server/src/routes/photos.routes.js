const express = require('express');
const multer = require('multer');
const env = require('../config/env');
const store = require('../db/memory-store');

const router = express.Router();
const upload = multer({ dest: env.uploadDir });

router.post('/upload', upload.single('photo'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: 'photo file is required' });
    return;
  }

  const photo = store.createPhoto({
    personId: req.body.personId,
    conversationId: req.body.conversationId || null,
    storyId: req.body.storyId || null,
    imageUrl: req.file.path,
    note: req.body.note || '',
    originalName: req.file.originalname
  });

  res.status(201).json({ photo });
});

router.get('/persons/:personId/photos', (req, res) => {
  res.json({
    photos: store.listPhotos({ personId: req.params.personId })
  });
});

module.exports = router;

