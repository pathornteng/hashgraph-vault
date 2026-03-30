const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/store.json');

function loadStore() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load store, starting fresh:', e.message);
  }
  return { accounts: [], transactions: [] };
}

function saveStore(store) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

const store = loadStore();

module.exports = {
  getAccounts: () => store.accounts,
  getAccount: (id) => store.accounts.find((a) => a.accountId === id),
  addAccount: (account) => {
    store.accounts.push(account);
    saveStore(store);
  },
  getTransactions: () => store.transactions,
  addTransaction: (tx) => {
    store.transactions.unshift(tx);
    saveStore(store);
  },
};
