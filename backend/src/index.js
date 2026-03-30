require('dotenv').config();
const express = require('express');
const cors = require('cors');

const keysRouter = require('./routes/keys');
const accountsRouter = require('./routes/accounts');
const transactionsRouter = require('./routes/transactions');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/keys', keysRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/transactions', transactionsRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use((err, _req, res, _next) => {
  console.error(err.message);
  const status = Number.isInteger(err.status) ? err.status : 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
