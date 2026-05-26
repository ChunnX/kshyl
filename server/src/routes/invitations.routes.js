const express = require('express');
const store = require('../db/memory-store');

const router = express.Router();

router.get('/:inviteCode', (req, res) => {
  const invitation = store.getInvitationByCode(req.params.inviteCode);
  if (!invitation) {
    res.status(404).json({ message: 'Invitation not found' });
    return;
  }

  res.json({ invitation });
});

router.post('/:inviteCode/contributions', (req, res) => {
  const invitation = store.getInvitationByCode(req.params.inviteCode);
  if (!invitation) {
    res.status(404).json({ message: 'Invitation not found' });
    return;
  }

  if (!req.body.text) {
    res.status(400).json({ message: 'text is required' });
    return;
  }

  const contribution = store.createContribution({
    invitationId: invitation.id,
    themeId: invitation.themeId,
    storyId: invitation.storyId,
    contributorName: req.body.contributorName || invitation.targetName,
    text: req.body.text
  });

  res.status(201).json({ contribution });
});

module.exports = router;

