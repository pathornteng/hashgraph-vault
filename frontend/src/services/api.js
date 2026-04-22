import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: { 'Content-Type': 'application/json' },
});

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

// Redirect to /login on 401
api.interceptors.response.use(null, (err) => {
  if (err.response?.status === 401) {
    window.location.href = '/login';
  }
  return Promise.reject(err);
});

// Auth
export const login = (username, password) =>
  api.post('/api/auth/login', { username, password }).then((r) => r.data);

// Keys
export const listKeys = () => api.get('/api/keys').then((r) => r.data.keys);
export const createKey = (name, type = 'ed25519', exportable = false) => api.post('/api/keys', { name, type, exportable }).then((r) => r.data);
export const getKeyDetail = (name) => api.get(`/api/keys/${name}`).then((r) => r.data);
export const exportKey = (name) => api.get(`/api/keys/${name}/export`).then((r) => r.data);
export const importKey = (name, type, privateKey, exportable) =>
  api.post(`/api/keys/${name}/import`, { type, privateKey, exportable }).then((r) => r.data);
export const deleteKey = (name) => api.delete(`/api/keys/${name}`);

// Accounts
export const listAccounts = () => api.get('/api/accounts').then((r) => r.data.accounts);
export const getOperatorInfo = () => api.get('/api/accounts/operator').then((r) => r.data);
export const createAccount = (vaultKeyName, initialBalance = 1) =>
  api.post('/api/accounts', { vaultKeyName, initialBalance }).then((r) => r.data);
export const getAccountBalance = (id) =>
  api.get(`/api/accounts/${id}/balance`).then((r) => r.data);
export const deleteAccount = (id) => api.delete(`/api/accounts/${id}`);

// Transactions
export const listTransactions = () =>
  api.get('/api/transactions').then((r) => r.data.transactions);
export const transfer = (payload) =>
  api.post('/api/transactions/transfer', payload).then((r) => r.data);

// Tokens (Hedera Token Service)
export const getAccountTokens = (accountId) =>
  api.get(`/api/tokens/${accountId}`).then((r) => r.data);
export const createToken = (payload) =>
  api.post('/api/tokens/create', payload).then((r) => r.data);
export const associateToken = (payload) =>
  api.post('/api/tokens/associate', payload).then((r) => r.data);
