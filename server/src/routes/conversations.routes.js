const express = require('express');
const conversationService = require('../services/conversation.service');
const store = require('../db/memory-store');
const { loadOwnedPerson } = require('../middleware/auth');

const router = express.Router();

// Loads a conversation and asserts the current user owns its person.
async function loadOwnedConversation(conversationId, userId) {
  const conversation = await store.getConversation(conversationId);
  if (!conversation) {
    const error = new Error('Conversation not found');
    error.statusCode = 404;
    throw error;
  }
  await loadOwnedPerson(store, conversation.personId, userId);
  return conversation;
}

router.get('/persons/:personId/conversations', async (req, res, next) => {
  try {
    await loadOwnedPerson(store, req.params.personId, req.userId);
    res.json({
      conversations: await store.listConversations(req.params.personId)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/persons/:personId/conversations', async (req, res, next) => {
  try {
    await loadOwnedPerson(store, req.params.personId, req.userId);
    const result = await conversationService.startConversation(req.params.personId, req.body.mode);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/conversations/:conversationId/messages', async (req, res, next) => {
  try {
    const conversation = await loadOwnedConversation(req.params.conversationId, req.userId);
    res.json({
      conversation,
      messages: await store.listConversationMessages(req.params.conversationId)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/conversations/:conversationId/turns', async (req, res, next) => {
  try {
    await loadOwnedConversation(req.params.conversationId, req.userId);
    const result = await conversationService.addTurn(req.params.conversationId, req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
