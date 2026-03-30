import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: {
    'Content-Type': 'application/json',
    'x-admin-token': import.meta.env.VITE_ADMIN_TOKEN || '',
  },
});

// Keys
export const listKeys = () => api.get('/api/keys').then((r) => r.data.keys);
export const createKey = (name, type = 'ed25519') => api.post('/api/keys', { name, type }).then((r) => r.data);
export const getKeyDetail = (name) => api.get(`/api/keys/${name}`).then((r) => r.data);
export const deleteKey = (name) => api.delete(`/api/keys/${name}`);

// Accounts
export const listAccounts = () => api.get('/api/accounts').then((r) => r.data.accounts);
export const getOperatorInfo = () => api.get('/api/accounts/operator').then((r) => r.data);
export const createAccount = (vaultKeyName, initialBalance = 1) =>
  api.post('/api/accounts', { vaultKeyName, initialBalance }).then((r) => r.data);
export const getAccountBalance = (id) =>
  api.get(`/api/accounts/${id}/balance`).then((r) => r.data);

// Transactions
export const listTransactions = () =>
  api.get('/api/transactions').then((r) => r.data.transactions);
export const transfer = (payload) =>
  api.post('/api/transactions/transfer', payload).then((r) => r.data);
