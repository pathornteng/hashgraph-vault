const router = require('express').Router();
const auth = require('../middleware/auth');
const hederaService = require('../services/hederaService');

router.use(auth);

// GET /api/tokens/:accountId — list tokens associated with an account
router.get('/:accountId', async (req, res, next) => {
  try {
    const tokens = await hederaService.getAccountTokens(req.params.accountId);
    res.json({ accountId: req.params.accountId, tokens });
  } catch (err) {
    next(err);
  }
});

// POST /api/tokens/create — create a new HTS token (treasury = accountId)
router.post('/create', async (req, res, next) => {
  try {
    const { accountId, vaultKeyName, name, symbol, decimals = 0, initialSupply = 0, tokenType = 'fungible' } = req.body;
    if (!accountId) return res.status(400).json({ error: 'accountId is required' });
    if (!vaultKeyName) return res.status(400).json({ error: 'vaultKeyName is required' });
    if (!name) return res.status(400).json({ error: 'name is required' });
    if (!symbol) return res.status(400).json({ error: 'symbol is required' });

    const tokenId = await hederaService.createToken(accountId, vaultKeyName, { name, symbol, decimals, initialSupply, tokenType });
    res.status(201).json({ tokenId, name, symbol, decimals, initialSupply, tokenType });
  } catch (err) {
    next(err);
  }
});

// POST /api/tokens/associate — associate an existing token with an account
router.post('/associate', async (req, res, next) => {
  try {
    const { accountId, vaultKeyName, tokenId } = req.body;
    if (!accountId) return res.status(400).json({ error: 'accountId is required' });
    if (!vaultKeyName) return res.status(400).json({ error: 'vaultKeyName is required' });
    if (!tokenId) return res.status(400).json({ error: 'tokenId is required' });

    const status = await hederaService.associateToken(accountId, vaultKeyName, tokenId);
    res.json({ status, accountId, tokenId });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
