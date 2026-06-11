/**
 * Tiny in-memory fixed-window rate limiter. Sufficient for a single-instance demo;
 * for multi-instance production move the counter to a shared store (e.g. Redis).
 */
function rateLimit({ windowMs = 60000, max = 20, key } = {}) {
  const keyFn = key || ((req) => req.userId || req.ip);
  const hits = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const k = keyFn(req);
    const entry = hits.get(k);

    if (!entry || now > entry.reset) {
      hits.set(k, { count: 1, reset: now + windowMs });
      next();
      return;
    }

    entry.count += 1;
    if (entry.count > max) {
      res.status(429).json({ message: '操作太频繁，请稍后再试' });
      return;
    }
    next();
  };
}

module.exports = { rateLimit };
