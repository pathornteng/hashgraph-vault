import { useEffect, useState } from 'react';
import { listAccounts, listTransactions } from '../services/api';
import TransferForm from '../components/TransferForm';

export default function Transfer() {
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastResult, setLastResult] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [accs, txs] = await Promise.all([listAccounts(), listTransactions()]);
      setAccounts(accs);
      setTransactions(txs);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSuccess(result) {
    setLastResult(result);
    const txs = await listTransactions().catch(() => transactions);
    setTransactions(txs);
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Transfer HBAR</h1>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Send</h2>
            <TransferForm accounts={accounts} onSuccess={handleSuccess} />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Recent Transactions</h2>

            {lastResult && (
              <div className="mb-4 p-3 bg-green-900/40 border border-green-700 rounded text-sm">
                <p className="text-green-400 font-medium">Transfer submitted</p>
                <p className="text-gray-300 font-mono text-xs mt-1 break-all">{lastResult.transactionId}</p>
                <p className="text-gray-400 text-xs mt-1">Status: {lastResult.status}</p>
              </div>
            )}

            {transactions.length === 0 && (
              <p className="text-gray-500 text-sm">No transactions yet.</p>
            )}

            <div className="space-y-2">
              {transactions.map((tx) => (
                <div key={tx.transactionId} className="bg-gray-800 rounded-lg p-3 text-sm">
                  <p className="font-mono text-xs text-gray-300 break-all">{tx.transactionId}</p>
                  <div className="flex justify-between mt-1 text-xs text-gray-400">
                    <span>{tx.fromAccountId} → {tx.toAccountId}</span>
                    <span>{tx.amount} ℏ</span>
                  </div>
                  <div className="flex justify-between mt-0.5 text-xs">
                    <span className="text-gray-500">{new Date(tx.timestamp).toLocaleString()}</span>
                    <span className={tx.status === 'SUCCESS' ? 'text-green-400' : 'text-yellow-400'}>{tx.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
