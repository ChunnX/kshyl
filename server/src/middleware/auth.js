/**
 * JWT auth guard + resource-ownership helpers.
 *
 * requireAuth populates req.userId from a Bearer token. With env.devAuthBypass on
 * (default outside production) it short-circuits to the demo user so offline dev and
 * the smoke test work without tokens.
 *
 * loadOwnedPerson is the IDOR guard: person-scoped routes must resolve the person
 * through it so one user cannot read/modify another family's data.
 */
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const DEMO_USER_ID = 'user_demo_001';

function requireAuth(req, res, next) {
  if (env.devAuthBypass) {
    req.userId = req.userId || DEMO_USER_ID;
    next();
    return;
  }

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    res.status(401).json({ message: '未登录' });
    return;
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.userId = payload.userId;
    req.openid = payload.openid;
    next();
  } catch (error) {
    res.status(401).json({ message: '登录已过期，请重新登录' });
  }
}

/**
 * Loads a person and asserts the current user owns it. Returns 404 for both
 * missing and not-owned so existence isn't leaked. Legacy records without an
 * ownerUserId are treated as accessible (back-compat with pre-auth data).
 */
async function loadOwnedPerson(store, personId, userId) {
  const person = await store.getPerson(personId);
  if (!person || (person.ownerUserId && person.ownerUserId !== userId)) {
    const error = new Error('Person not found');
    error.statusCode = 404;
    throw error;
  }
  return person;
}

module.exports = {
  requireAuth,
  loadOwnedPerson,
  DEMO_USER_ID
};
