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

router.post('/:storyId/invitations', (req, res) => {
  const story = store.getStory(req.params.storyId);
  if (!story) {
    res.status(404).json({ message: 'Story not found' });
    return;
  }

  if (!req.body.targetName) {
    res.status(400).json({ message: 'targetName is required' });
    return;
  }

  const invitation = store.createInvitation({
    type: 'story',
    storyId: story.id,
    themeId: req.body.themeId || story.themeId || null,
    targetName: req.body.targetName,
    relation: req.body.relation,
    prompt: req.body.prompt || `请帮忙补充《${story.title}》这段记忆。`
  });

  res.status(201).json({
    invitation,
    sharePath: `/pages/invite/invite?code=${invitation.inviteCode}`
  });
});

module.exports = router;
