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

function getAuthenticatedUser(header = '') {
  if (env.devAuthBypass) {
    return { userId: DEMO_USER_ID, openid: 'openid_demo' };
  }

  if (!env.hasSecureJwtSecret) {
    const error = new Error('服务端 JWT_SECRET 未安全配置');
    error.statusCode = 503;
    throw error;
  }

  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    const error = new Error('未登录');
    error.statusCode = 401;
    throw error;
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (!payload || typeof payload.userId !== 'string' || !payload.userId) {
      throw new Error('Invalid token payload');
    }
    return { userId: payload.userId, openid: payload.openid };
  } catch (cause) {
    const error = new Error('登录已过期，请重新登录');
    error.statusCode = 401;
    throw error;
  }
}

function requireAuth(req, res, next) {
  try {
    const user = getAuthenticatedUser(req.headers.authorization || '');
    req.userId = user.userId;
    req.openid = user.openid;
    next();
  } catch (error) {
    res.status(error.statusCode || 401).json({ message: error.message });
  }
}

/**
 * Loads a person and asserts the current user owns it. Returns 404 for both
 * missing and not-owned so existence isn't leaked.
 */
async function loadOwnedPerson(store, personId, userId) {
  const person = await store.getPerson(personId);
  if (!person || person.ownerUserId !== userId) {
    const error = new Error('Person not found');
    error.statusCode = 404;
    throw error;
  }
  return person;
}

module.exports = {
  requireAuth,
  getAuthenticatedUser,
  loadOwnedPerson,
  DEMO_USER_ID
};
