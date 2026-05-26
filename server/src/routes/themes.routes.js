const express = require('express');
const store = require('../db/memory-store');

const router = express.Router();

router.get('/:themeId', (req, res) => {
  const theme = store.getTheme(req.params.themeId);
  if (!theme) {
    res.status(404).json({ message: 'Theme not found' });
    return;
  }

  res.json({
    theme,
    collaborators: store.listThemeCollaborators(theme.id),
    invitations: store.listInvitations({ themeId: theme.id }),
    contributions: store.listContributions({ themeId: theme.id })
  });
});

router.put('/:themeId', (req, res) => {
  const theme = store.updateTheme(req.params.themeId, {
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
});

router.post('/:themeId/collaborators', (req, res) => {
  const theme = store.getTheme(req.params.themeId);
  if (!theme) {
    res.status(404).json({ message: 'Theme not found' });
    return;
  }

  if (!req.body.name) {
    res.status(400).json({ message: 'name is required' });
    return;
  }

  const collaborator = store.addThemeCollaborator({
    themeId: theme.id,
    name: req.body.name,
    relation: req.body.relation,
    role: req.body.role || 'contributor'
  });

  res.status(201).json({ collaborator });
});

router.post('/:themeId/invitations', (req, res) => {
  const theme = store.getTheme(req.params.themeId);
  if (!theme) {
    res.status(404).json({ message: 'Theme not found' });
    return;
  }

  if (!req.body.targetName) {
    res.status(400).json({ message: 'targetName is required' });
    return;
  }

  const invitation = store.createInvitation({
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
});

module.exports = router;

