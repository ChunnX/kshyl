const express = require('express');
const store = require('../db/memory-store');
const bookExport = require('../services/book-export.service');
const llm = require('../services/llm.service');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json({
      people: await store.listPeople('user_demo_001')
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  if (!req.body.name) {
    res.status(400).json({ message: 'name is required' });
    return;
  }

  try {
    const person = await store.createPerson({
      name: req.body.name,
      relation: req.body.relation,
      kind: req.body.kind,
      ownerUserId: 'user_demo_001'
    });

    res.status(201).json({ person });
  } catch (error) {
    next(error);
  }
});

router.get('/:personId', async (req, res, next) => {
  try {
    const person = await store.getPerson(req.params.personId);
    if (!person) {
      res.status(404).json({ message: 'Person not found' });
      return;
    }
    res.json({ person });
  } catch (error) {
    next(error);
  }
});

router.put('/:personId/consent', async (req, res, next) => {
  const allowedStatuses = ['pending', 'granted', 'revoked'];
  if (!allowedStatuses.includes(req.body.consentStatus)) {
    res.status(400).json({
      message: 'consentStatus must be pending, granted, or revoked'
    });
    return;
  }

  try {
    const person = await store.updatePerson(req.params.personId, {
      consentStatus: req.body.consentStatus
    });

    if (!person) {
      res.status(404).json({ message: 'Person not found' });
      return;
    }

    res.json({ person });
  } catch (error) {
    next(error);
  }
});

router.get('/:personId/stories', async (req, res, next) => {
  try {
    res.json({
      stories: await store.listStories(req.params.personId)
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:personId/themes', async (req, res, next) => {
  try {
    res.json({
      themes: await store.listThemes({ personId: req.params.personId })
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:personId/themes', async (req, res, next) => {
  if (!req.body.title) {
    res.status(400).json({ message: 'title is required' });
    return;
  }

  try {
    const theme = await store.createTheme({
      personId: req.params.personId,
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

router.post('/:personId/book/export', async (req, res, next) => {
  try {
    const book = await bookExport.exportBook(req.params.personId);
    res.json({ book });
  } catch (error) {
    next(error);
  }
});

router.get('/:personId/books', async (req, res, next) => {
  try {
    res.json({
      books: await store.listBooks(req.params.personId)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:personId/chat', async (req, res, next) => {
  try {
    const person = await store.getPerson(req.params.personId);
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

    const stories = (await store.listStories(req.params.personId)).filter((story) => story.status === 'approved');
    const reply = await llm.chatWithMemory(req.body.message || '', stories);
    res.json({ reply });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
