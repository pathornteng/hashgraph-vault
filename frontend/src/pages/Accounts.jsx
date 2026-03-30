import { useEffect, useState } from 'react';
import { listAccounts, listKeys, createAccount, deleteAccount, getAccountBalance, getOperatorInfo } from '../services/api';
import Modal from '../components/Modal';

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [operator, setOperator] = useState(null);
  const [operatorLoading, setOperatorLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [selectedKey, setSelectedKey] = useState('');
  const [initialBalance, setInitialBalance] = useState('1');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const network = import.meta.env.VITE_HEDERA_NETWORK || 'testnet';
  const hashscanUrl = (accountId) => `https://hashscan.io/${network}/account/${accountId}`;

  const [balances, setBalances] = useState({});
  const [fetchingBalances, setFetchingBalances] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  async function fetchAllBalances(accs) {
    setFetchingBalances(true);
    const results = await Promise.allSettled(
      accs.map((a) => getAccountBalance(a.accountId).then((d) => ({ id: a.accountId, balance: d.balance })))
    );
    const next = {};
    results.forEach((r) => {
      if (r.status === 'fulfilled') next[r.value.id] = r.value.balance;
    });
    setBalances((prev) => ({ ...prev, ...next }));
    setFetchingBalances(false);
  }

  async function loadOperator() {
    setOperatorLoading(true);
    try {
      const info = await getOperatorInfo();
      setOperator(info);
    } catch (e) {
      setOperator({ error: e.response?.data?.error || e.message });
    } finally {
      setOperatorLoading(false);
    }
  }

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [accs, ks] = await Promise.all([listAccounts(), listKeys()]);
      setAccounts(accs);
      setKeys(ks);
      if (accs.length > 0) fetchAllBalances(accs);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadOperator(); load(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      await createAccount(selectedKey, parseFloat(initialBalance) || 0);
      setSelectedKey('');
      setInitialBalance('1');
      setShowCreate(false);
      await load();
    } catch (e) {
      setCreateError(e.response?.data?.error || e.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(accountId) {
    if (!window.confirm(`Remove account ${accountId} from the local store?`)) return;
    setDeletingId(accountId);
    try {
      await deleteAccount(accountId);
      setAccounts((prev) => prev.filter((a) => a.accountId !== accountId));
      setBalances((prev) => { const next = { ...prev }; delete next[accountId]; return next; });
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRefreshBalance(accountId) {
    setBalances((prev) => ({ ...prev, [accountId]: null }));
    try {
      const data = await getAccountBalance(accountId);
      setBalances((prev) => ({ ...prev, [accountId]: data.balance }));
    } catch (e) {
      setBalances((prev) => ({ ...prev, [accountId]: 'error' }));
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Hedera Accounts</h1>
          {accounts.length > 0 && (
            <button
              onClick={() => fetchAllBalances(accounts)}
              disabled={fetchingBalances}
              className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-40"
            >
              {fetchingBalances ? 'Refreshing…' : '↻ Refresh all'}
            </button>
          )}
        </div>
        <button
          onClick={() => { setShowCreate(true); setCreateError(''); setSelectedKey(''); }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium"
        >
          + Create Account
        </button>
      </div>

      {/* Operator card */}
      <div className="mb-6 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Operator (fee payer)</p>
        {operatorLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : operator?.error ? (
          <p className="text-sm text-red-400">{operator.error}</p>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <a href={hashscanUrl(operator.accountId)} target="_blank" rel="noopener noreferrer" className="font-mono text-sm text-indigo-400 hover:underline">{operator.accountId}</a>
              <p className="text-xs text-gray-500 mt-0.5">
                Key: {operator.keySource === 'vault' ? `Vault — ${operator.vaultKeyName}` : 'Private key'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold text-white">{operator.balance}</p>
                <p className="text-xs text-gray-600">HBAR</p>
              </div>
              <button
                onClick={loadOperator}
                className="text-gray-500 hover:text-indigo-400 text-lg leading-none"
                title="Refresh balance"
              >↻</button>
            </div>
          </div>
        )}
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {!loading && !error && accounts.length === 0 && (
        <p className="text-gray-500 text-sm">No accounts yet. Create one by selecting a Vault key.</p>
      )}

      <div className="space-y-2">
        {accounts.map((account) => {
          const balance = balances[account.accountId];
          return (
            <div key={account.accountId} className="bg-gray-800 rounded-lg px-4 py-3 flex items-center justify-between">
              <div>
                <a href={hashscanUrl(account.accountId)} target="_blank" rel="noopener noreferrer" className="font-mono text-sm text-indigo-400 hover:underline">{account.accountId}</a>
                <p className="text-xs text-gray-500 mt-0.5">Vault key: {account.vaultKeyName}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  {balance === null ? (
                    <p className="text-xs text-gray-500">Loading…</p>
                  ) : balance === 'error' ? (
                    <p className="text-xs text-red-400">Failed</p>
                  ) : balance !== undefined ? (
                    <p className="text-sm font-semibold text-white">{balance}</p>
                  ) : (
                    <p className="text-xs text-gray-600">—</p>
                  )}
                  <p className="text-xs text-gray-600">HBAR</p>
                </div>
                <button
                  onClick={() => handleRefreshBalance(account.accountId)}
                  className="text-gray-500 hover:text-indigo-400 text-lg leading-none"
                  title="Refresh balance"
                >
                  ↻
                </button>
                <button
                  onClick={() => handleDelete(account.accountId)}
                  disabled={deletingId === account.accountId}
                  className="text-gray-600 hover:text-red-400 text-sm disabled:opacity-40"
                  title="Remove account"
                >
                  {deletingId === account.accountId ? '…' : '✕'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showCreate && (
        <Modal title="Create Hedera Account" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Vault Key</label>
              <select
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="">Select a key…</option>
                {keys.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                The account will be created on Hedera with this key as its signing key.
              </p>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Initial Balance (HBAR)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">Funded from the operator account.</p>
            </div>
            {createError && <p className="text-red-400 text-sm">{createError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
              <button type="submit" disabled={creating || !selectedKey} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded text-sm font-medium">
                {creating ? 'Creating on Hedera…' : 'Create Account'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
