const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const vaultService = require('../services/vaultService');
const auth = require('../middleware/auth');

// POST /api/auth/login — public
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    const creds = await vaultService.getAdminCredentials(username);
    if (!creds) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, creds.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: 'JWT_SECRET not configured' });

    const token = jwt.sign({ username }, secret, {
      expiresIn: process.env.JWT_EXPIRY || '8h',
    });

    res.json({ token, username });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me — protected
router.get('/me', auth, (req, res) => {
  res.json({ username: req.user.username });
});

module.exports = router;
