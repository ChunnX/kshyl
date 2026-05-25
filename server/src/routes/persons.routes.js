const express = require('express');
const store = require('../db/memory-store');
const bookExport = require('../services/book-export.service');
const llm = require('../services/llm.service');

const router = express.Router();

router.get('/:personId', (req, res) => {
  const person = store.getPerson(req.params.personId);
  if (!person) {
    res.status(404).json({ message: 'Person not found' });
    return;
  }
  res.json({ person });
});

router.put('/:personId/consent', (req, res) => {
  const allowedStatuses = ['pending', 'granted', 'revoked'];
  if (!allowedStatuses.includes(req.body.consentStatus)) {
    res.status(400).json({
      message: 'consentStatus must be pending, granted, or revoked'
    });
    return;
  }

  const person = store.updatePerson(req.params.personId, {
    consentStatus: req.body.consentStatus
  });

  if (!person) {
    res.status(404).json({ message: 'Person not found' });
    return;
  }

  res.json({ person });
});

router.get('/:personId/stories', (req, res) => {
  res.json({
    stories: store.listStories(req.params.personId)
  });
});

router.post('/:personId/book/export', async (req, res, next) => {
  try {
    const book = await bookExport.exportBook(req.params.personId);
    res.json({ book });
  } catch (error) {
    next(error);
  }
});

router.get('/:personId/books', (req, res) => {
  res.json({
    books: store.listBooks(req.params.personId)
  });
});

router.post('/:personId/chat', async (req, res, next) => {
  try {
    const person = store.getPerson(req.params.personId);
    if (!person) {
      res.status(404).json({ message: 'Person not found' });
      return;
    }

    if (person.consentStatus !== 'granted') {
      res.status(403).json({
        message: '纪念对话需要本人授权后才能使用'
      });
      return;
    }

    const stories = store.listStories(req.params.personId).filter((story) => story.status === 'approved');
    const reply = await llm.chatWithMemory(req.body.message || '', stories);
    res.json({ reply });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
