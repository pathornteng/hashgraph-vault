const router = require('express').Router();
const auth = require('../middleware/auth');
const hederaService = require('../services/hederaService');
const store = require('../store');

router.use(auth);

// GET /api/accounts/operator — operator account info + live balance
router.get('/operator', async (_req, res, next) => {
  try {
    const accountId = process.env.OPERATOR_ID;
    if (!accountId) return res.status(500).json({ error: 'OPERATOR_ID not configured' });
    const balance = await hederaService.getBalance(accountId);
    const keySource = process.env.OPERATOR_PRIVATE_KEY ? 'private_key' : 'vault';
    const vaultKeyName = process.env.OPERATOR_VAULT_KEY || null;
    res.json({ accountId, balance, keySource, vaultKeyName });
  } catch (err) {
    next(err);
  }
});

// GET /api/accounts — list all accounts
router.get('/', (_req, res) => {
  res.json({ accounts: store.getAccounts() });
});

// POST /api/accounts — create a Hedera account linked to a Vault key
router.post('/', async (req, res, next) => {
  try {
    const { vaultKeyName, initialBalance = 1 } = req.body;
    if (!vaultKeyName) return res.status(400).json({ error: 'vaultKeyName is required' });
    if (initialBalance < 0) return res.status(400).json({ error: 'initialBalance must be >= 0' });

    const accountId = await hederaService.createAccount(vaultKeyName, initialBalance);
    const account = {
      accountId,
      vaultKeyName,
      initialBalance,
      createdAt: new Date().toISOString(),
    };
    store.addAccount(account);
    res.status(201).json(account);
  } catch (err) {
    next(err);
  }
});

// GET /api/accounts/:id — get account details
router.get('/:id', (req, res) => {
  const account = store.getAccount(req.params.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  res.json(account);
});

// GET /api/accounts/:id/balance — fetch live balance from Hedera
router.get('/:id/balance', async (req, res, next) => {
  try {
    const balance = await hederaService.getBalance(req.params.id);
    res.json({ accountId: req.params.id, balance });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
