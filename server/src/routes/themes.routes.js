const express = require('express');
const store = require('../db/memory-store');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json({
      themes: await store.listThemes({})
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  if (!req.body.title) {
    res.status(400).json({ message: 'title is required' });
    return;
  }

  try {
    const theme = await store.createTheme({
      title: req.body.title,
      description: req.body.description,
      mode: req.body.mode || 'solo',
      ownerUserId: 'user_demo_001'
    });

    res.status(201).json({ theme });
  } catch (error) {
    next(error);
  }
});

router.get('/:themeId', async (req, res, next) => {
  try {
    const theme = await store.getTheme(req.params.themeId);
    if (!theme) {
      res.status(404).json({ message: 'Theme not found' });
      return;
    }

    res.json({
      theme,
      collaborators: await store.listThemeCollaborators(theme.id),
      invitations: await store.listInvitations({ themeId: theme.id }),
      contributions: await store.listContributions({ themeId: theme.id })
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:themeId', async (req, res, next) => {
  try {
    const theme = await store.updateTheme(req.params.themeId, {
      title: req.body.title,
      description: req.body.description,
      mode: req.body.mode,
      status: req.body.status
    });

    if (!theme) {
      res.status(404).json({ message: 'Theme not found' });
      return;
    }

    res.json({ theme });
  } catch (error) {
    next(error);
  }
});

router.post('/:themeId/collaborators', async (req, res, next) => {
  try {
    const theme = await store.getTheme(req.params.themeId);
    if (!theme) {
      res.status(404).json({ message: 'Theme not found' });
      return;
    }

    if (!req.body.name) {
      res.status(400).json({ message: 'name is required' });
      return;
    }

    const collaborator = await store.addThemeCollaborator({
      themeId: theme.id,
      name: req.body.name,
      relation: req.body.relation,
      role: req.body.role || 'contributor'
    });

    res.status(201).json({ collaborator });
  } catch (error) {
    next(error);
  }
});

router.post('/:themeId/invitations', async (req, res, next) => {
  try {
    const theme = await store.getTheme(req.params.themeId);
    if (!theme) {
      res.status(404).json({ message: 'Theme not found' });
      return;
    }

    if (!req.body.targetName) {
      res.status(400).json({ message: 'targetName is required' });
      return;
    }

    const invitation = await store.createInvitation({
      type: 'theme',
      themeId: theme.id,
      targetName: req.body.targetName,
      relation: req.body.relation,
      prompt: req.body.prompt
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
