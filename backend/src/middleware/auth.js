const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return next(); // JWT not configured — open access (dev fallback)

  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, secret);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = auth;
