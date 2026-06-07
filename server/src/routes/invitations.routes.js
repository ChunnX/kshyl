const express = require('express');
const store = require('../db/memory-store');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Resolves the owning user of an invitation via its theme or story → person.
async function invitationOwnerId(invitation) {
  if (invitation.themeId) {
    const theme = await store.getTheme(invitation.themeId);
    return theme ? theme.ownerUserId : null;
  }
  if (invitation.storyId) {
    const story = await store.getStory(invitation.storyId);
    if (!story) {
      return null;
    }
    const person = await store.getPerson(story.personId);
    return person ? person.ownerUserId : null;
  }
  return null;
}

router.get('/:inviteCode', async (req, res) => {
  try {
    const invitation = await store.getInvitationByCode(req.params.inviteCode);
    if (!invitation) {
      res.status(404).json({ message: 'Invitation not found' });
      return;
    }

    if (invitation.status === 'revoked') {
      res.status(410).json({ message: '该邀请链接已被撤销' });
      return;
    }

    let theme = null;
    let stories = [];

    if (invitation.themeId) {
      theme = await store.getTheme(invitation.themeId);
      if (theme && theme.personId) {
        // Fetch all stories for this person, and filter for this specific theme
        const allStories = await store.listStories(theme.personId);
        stories = allStories.filter((s) => s.themeId === theme.id);
      }
    }

    res.json({
      invitation,
      theme,
      stories
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:inviteCode/contributions', async (req, res) => {
  try {
    const invitation = await store.getInvitationByCode(req.params.inviteCode);
    if (!invitation) {
      res.status(404).json({ message: 'Invitation not found' });
      return;
    }

    if (invitation.status === 'revoked') {
      res.status(410).json({ message: '该邀请链接已被撤销' });
      return;
    }

    if (!req.body.text) {
      res.status(400).json({ message: 'text is required' });
      return;
    }

    const targetStoryId = req.body.storyId || invitation.storyId || null;

    // Create the contribution record
    const contribution = await store.createContribution({
      invitationId: invitation.id,
      themeId: invitation.themeId,
      storyId: targetStoryId,
      contributorName: req.body.contributorName || invitation.targetName,
      text: req.body.text
    });

    // Automatically enroll this person as a ThemeCollaborator (co-creator) under this theme!
    if (invitation.themeId) {
      await store.addThemeCollaborator({
        themeId: invitation.themeId,
        name: req.body.contributorName || invitation.targetName,
        relation: invitation.relation || '共创人',
        role: 'contributor',
        status: 'accepted'
      });
    }

    res.status(201).json({ contribution });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Revoke a share link. Authed + owner-only (per-route guard since this router is public).
router.post('/:inviteCode/revoke', requireAuth, async (req, res, next) => {
  try {
    const invitation = await store.getInvitationByCode(req.params.inviteCode);
    if (!invitation) {
      res.status(404).json({ message: 'Invitation not found' });
      return;
    }

    const ownerId = await invitationOwnerId(invitation);
    if (ownerId && ownerId !== req.userId) {
      res.status(404).json({ message: 'Invitation not found' });
      return;
    }

    const updated = await store.revokeInvitation(req.params.inviteCode);
    res.json({ invitation: updated });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
