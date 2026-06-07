const express = require('express');
const store = require('../db/memory-store');
const bookExport = require('../services/book-export.service');
const llm = require('../services/llm.service');
const { loadOwnedPerson } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rate-limit');

const router = express.Router();

const MEMORIAL_DISCLAIMER = '以上内容由 AI 根据已授权、已校对的故事生成，并非本人真实回复。';
const chatLimiter = rateLimit({
  windowMs: 60000,
  max: 20,
  key: (req) => `chat:${req.userId}:${req.params.personId}`
});

router.get('/', async (req, res, next) => {
  try {
    res.json({
      people: await store.listPeople(req.userId)
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
      ownerUserId: req.userId
    });

    res.status(201).json({ person });
  } catch (error) {
    next(error);
  }
});

router.get('/:personId', async (req, res, next) => {
  try {
    const person = await loadOwnedPerson(store, req.params.personId, req.userId);
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
    await loadOwnedPerson(store, req.params.personId, req.userId);
    const person = await store.updatePerson(req.params.personId, {
      consentStatus: req.body.consentStatus
    });
    res.json({ person });
  } catch (error) {
    next(error);
  }
});

router.get('/:personId/stories', async (req, res, next) => {
  try {
    await loadOwnedPerson(store, req.params.personId, req.userId);
    res.json({
      stories: await store.listStories(req.params.personId)
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:personId/themes', async (req, res, next) => {
  try {
    await loadOwnedPerson(store, req.params.personId, req.userId);
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
    await loadOwnedPerson(store, req.params.personId, req.userId);
    const theme = await store.createTheme({
      personId: req.params.personId,
      title: req.body.title,
      description: req.body.description,
      mode: req.body.mode || 'solo',
      ownerUserId: req.userId
    });

    res.status(201).json({ theme });
  } catch (error) {
    next(error);
  }
});

router.post('/:personId/book/export', async (req, res, next) => {
  try {
    await loadOwnedPerson(store, req.params.personId, req.userId);
    const book = await bookExport.exportBook(req.params.personId);
    res.json({ book });
  } catch (error) {
    next(error);
  }
});

router.get('/:personId/books', async (req, res, next) => {
  try {
    await loadOwnedPerson(store, req.params.personId, req.userId);
    res.json({
      books: await store.listBooks(req.params.personId)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:personId/chat', chatLimiter, async (req, res, next) => {
  try {
    const person = await loadOwnedPerson(store, req.params.personId, req.userId);

    if (person.consentStatus !== 'granted') {
      res.status(403).json({
        message: '纪念对话需要本人授权后才能使用'
      });
      return;
    }

    const stories = (await store.listStories(req.params.personId)).filter((story) => story.status === 'approved');
    const reply = await llm.chatWithMemory(req.body.message || '', stories);
    res.json({ reply, disclaimer: MEMORIAL_DISCLAIMER });
  } catch (error) {
    next(error);
  }
});

router.delete('/:personId/books/:bookId', async (req, res, next) => {
  try {
    await loadOwnedPerson(store, req.params.personId, req.userId);
    const book = await store.getBook(req.params.bookId);
    if (!book || book.personId !== req.params.personId) {
      res.status(404).json({ message: 'Book not found' });
      return;
    }
    await store.deleteBook(req.params.bookId);
    res.json({ deleted: true, id: req.params.bookId });
  } catch (error) {
    next(error);
  }
});

// Deletes a person and ALL their data (recordings, stories, books, conversations,
// photos, themes, voice profiles). The user's "delete everything" privacy control.
router.delete('/:personId', async (req, res, next) => {
  try {
    await loadOwnedPerson(store, req.params.personId, req.userId);
    await store.deletePerson(req.params.personId);
    res.json({ deleted: true, id: req.params.personId });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
