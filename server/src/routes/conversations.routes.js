const express = require('express');
const conversationService = require('../services/conversation.service');
const store = require('../db/memory-store');

const router = express.Router();

router.get('/persons/:personId/conversations', async (req, res, next) => {
  try {
    res.json({
      conversations: await store.listConversations(req.params.personId)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/persons/:personId/conversations', async (req, res, next) => {
  try {
    const result = await conversationService.startConversation(req.params.personId, req.body.mode);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/conversations/:conversationId/messages', async (req, res, next) => {
  try {
    const conversation = await store.getConversation(req.params.conversationId);
    if (!conversation) {
      res.status(404).json({ message: 'Conversation not found' });
      return;
    }

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
    const result = await conversationService.addTurn(req.params.conversationId, req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
