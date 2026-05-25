const express = require('express');
const conversationService = require('../services/conversation.service');
const store = require('../db/memory-store');

const router = express.Router();

router.get('/persons/:personId/conversations', (req, res) => {
  res.json({
    conversations: store.listConversations(req.params.personId)
  });
});

router.post('/persons/:personId/conversations', async (req, res, next) => {
  try {
    const result = await conversationService.startConversation(req.params.personId, req.body.mode);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/conversations/:conversationId/messages', (req, res) => {
  const conversation = store.getConversation(req.params.conversationId);
  if (!conversation) {
    res.status(404).json({ message: 'Conversation not found' });
    return;
  }

  res.json({
    conversation,
    messages: store.listConversationMessages(req.params.conversationId)
  });
});

router.post('/conversations/:conversationId/turns', async (req, res, next) => {
  try {
    const result = await conversationService.addTurn(req.params.conversationId, req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

