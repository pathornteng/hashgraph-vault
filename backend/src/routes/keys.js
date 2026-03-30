const router = require('express').Router();
const auth = require('../middleware/auth');
const vaultService = require('../services/vaultService');

router.use(auth);

// GET /api/keys — list all transit keys
router.get('/', async (_req, res, next) => {
  try {
    const keys = await vaultService.listKeys();
    res.json({ keys });
  } catch (err) {
    next(err);
  }
});

// POST /api/keys — create a key (type: 'ed25519' | 'ecdsa', default: 'ed25519')
router.post('/', async (req, res, next) => {
  try {
    const { name, type = 'ed25519' } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    if (!['ed25519', 'ecdsa'].includes(type)) {
      return res.status(400).json({ error: 'type must be ed25519 or ecdsa' });
    }
    await vaultService.createKey(name, type);
    res.status(201).json({ name, type });
  } catch (err) {
    next(err);
  }
});

// GET /api/keys/:name — get key info + public key
router.get('/:name', async (req, res, next) => {
  try {
    const info = await vaultService.getKeyInfo(req.params.name);
    const publicKey = await vaultService.getPublicKey(req.params.name);
    res.json({
      name: req.params.name,
      type: info.type,
      latestVersion: info.latest_version,
      createdAt: info.keys[info.latest_version]?.creation_time,
      publicKey: publicKey.toStringRaw(),
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/keys/:name — delete a key
router.delete('/:name', async (req, res, next) => {
  try {
    await vaultService.deleteKey(req.params.name);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
