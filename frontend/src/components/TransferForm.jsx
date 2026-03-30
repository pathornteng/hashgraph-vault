import { useState } from 'react';
import { transfer } from '../services/api';

export default function TransferForm({ accounts, onSuccess }) {
  const [form, setForm] = useState({ fromAccountId: '', toAccountId: '', amount: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedAccount = accounts.find((a) => a.accountId === form.fromAccountId);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!selectedAccount) return setError('Select a from account');
    setLoading(true);
    try {
      const result = await transfer({
        fromAccountId: form.fromAccountId,
        toAccountId: form.toAccountId,
        amount: parseFloat(form.amount),
        vaultKeyName: selectedAccount.vaultKeyName,
      });
      onSuccess(result);
      setForm({ fromAccountId: '', toAccountId: '', amount: '' });
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-gray-400 mb-1">From Account</label>
        <select
          value={form.fromAccountId}
          onChange={(e) => setForm({ ...form, fromAccountId: e.target.value })}
          required
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
        >
          <option value="">Select account…</option>
          {accounts.map((a) => (
            <option key={a.accountId} value={a.accountId}>
              {a.accountId} ({a.vaultKeyName})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">To Account ID</label>
        <input
          type="text"
          placeholder="0.0.XXXXXX"
          value={form.toAccountId}
          onChange={(e) => setForm({ ...form, toAccountId: e.target.value })}
          required
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Amount (HBAR)</label>
        <input
          type="number"
          min="0.00000001"
          step="any"
          placeholder="1.0"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          required
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded text-sm font-medium"
      >
        {loading ? 'Sending…' : 'Send HBAR'}
      </button>
    </form>
  );
}
