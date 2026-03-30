const router = require('express').Router();
const auth = require('../middleware/auth');
const hederaService = require('../services/hederaService');
const store = require('../store');

router.use(auth);

// POST /api/transactions/transfer — transfer HBAR via Vault signing
router.post('/transfer', async (req, res, next) => {
  try {
    const { fromAccountId, toAccountId, amount, vaultKeyName } = req.body;
    if (!fromAccountId || !toAccountId || !amount || !vaultKeyName) {
      return res.status(400).json({ error: 'fromAccountId, toAccountId, amount, and vaultKeyName are required' });
    }
    if (amount <= 0) return res.status(400).json({ error: 'amount must be positive' });

    const result = await hederaService.transferHbar(fromAccountId, toAccountId, amount, vaultKeyName);

    const tx = {
      transactionId: result.transactionId,
      status: result.status,
      fromAccountId,
      toAccountId,
      amount,
      vaultKeyName,
      timestamp: new Date().toISOString(),
    };
    store.addTransaction(tx);

    res.json(tx);
  } catch (err) {
    next(err);
  }
});

// GET /api/transactions — list past transactions
router.get('/', (_req, res) => {
  res.json({ transactions: store.getTransactions() });
});

module.exports = router;
