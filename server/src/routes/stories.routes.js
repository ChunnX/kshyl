const express = require('express');
const store = require('../db/memory-store');

const router = express.Router();

router.get('/:storyId', (req, res) => {
  const story = store.getStory(req.params.storyId);
  if (!story) {
    res.status(404).json({ message: 'Story not found' });
    return;
  }
  res.json({ story });
});

router.put('/:storyId', (req, res) => {
  const patch = {};
  ['title', 'polishedText', 'status'].forEach((field) => {
    if (req.body[field] !== undefined) {
      patch[field] = req.body[field];
    }
  });

  const story = store.updateStory(req.params.storyId, patch);

  if (!story) {
    res.status(404).json({ message: 'Story not found' });
    return;
  }

  res.json({ story });
});

module.exports = router;
