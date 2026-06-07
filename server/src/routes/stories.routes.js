const express = require('express');
const store = require('../db/memory-store');
const { loadOwnedPerson } = require('../middleware/auth');

const router = express.Router();

// Loads a story and asserts the current user owns the person it belongs to.
async function loadOwnedStory(storyId, userId) {
  const story = await store.getStory(storyId);
  if (!story) {
    const error = new Error('Story not found');
    error.statusCode = 404;
    throw error;
  }
  // Throws 404 if the person isn't owned by this user.
  await loadOwnedPerson(store, story.personId, userId);
  return story;
}

router.get('/:storyId', async (req, res, next) => {
  try {
    const story = await loadOwnedStory(req.params.storyId, req.userId);
    res.json({ story });
  } catch (error) {
    next(error);
  }
});

router.put('/:storyId', async (req, res, next) => {
  const patch = {};
  ['title', 'polishedText', 'status'].forEach((field) => {
    if (req.body[field] !== undefined) {
      patch[field] = req.body[field];
    }
  });

  try {
    await loadOwnedStory(req.params.storyId, req.userId);
    const story = await store.updateStory(req.params.storyId, patch);
    res.json({ story });
  } catch (error) {
    next(error);
  }
});

router.delete('/:storyId', async (req, res, next) => {
  try {
    await loadOwnedStory(req.params.storyId, req.userId);
    await store.deleteStory(req.params.storyId);
    res.json({ deleted: true, id: req.params.storyId });
  } catch (error) {
    next(error);
  }
});

router.post('/:storyId/invitations', async (req, res, next) => {
  try {
    const story = await loadOwnedStory(req.params.storyId, req.userId);

    if (!req.body.targetName) {
      res.status(400).json({ message: 'targetName is required' });
      return;
    }

    const invitation = await store.createInvitation({
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
  } catch (error) {
    next(error);
  }
});

module.exports = router;
