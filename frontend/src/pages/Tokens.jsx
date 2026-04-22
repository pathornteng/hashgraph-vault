import { useEffect, useState } from 'react';
import { listAccounts, getAccountTokens, createToken, associateToken } from '../services/api';
import Modal from '../components/Modal';

const network = import.meta.env.VITE_HEDERA_NETWORK || 'testnet';
const hashscanTokenUrl = (tokenId) => `https://hashscan.io/${network}/token/${tokenId}`;

function formatBalance(balance, decimals) {
  if (!decimals) return balance;
  const raw = BigInt(balance);
  const divisor = BigInt(10 ** decimals);
  const whole = (raw / divisor).toString();
  const frac = (raw % divisor).toString().padStart(decimals, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole;
}

export default function Tokens() {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);

  const [tokens, setTokens] = useState([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [tokensError, setTokensError] = useState('');

  // Create token modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', symbol: '', decimals: '0', initialSupply: '0', tokenType: 'fungible' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Associate token modal
  const [showAssociate, setShowAssociate] = useState(false);
  const [associateTokenId, setAssociateTokenId] = useState('');
  const [associating, setAssociating] = useState(false);
  const [associateError, setAssociateError] = useState('');

  useEffect(() => {
    listAccounts().then((accs) => {
      setAccounts(accs);
      if (accs.length > 0) setSelectedAccount(accs[0]);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedAccount) return;
    loadTokens(selectedAccount.accountId);
  }, [selectedAccount]);

  async function loadTokens(accountId) {
    setTokensLoading(true);
    setTokensError('');
    setTokens([]);
    try {
      const data = await getAccountTokens(accountId);
      setTokens(data.tokens);
    } catch (e) {
      setTokensError(e.response?.data?.error || e.message);
    } finally {
      setTokensLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      await createToken({
        accountId: selectedAccount.accountId,
        vaultKeyName: selectedAccount.vaultKeyName,
        name: createForm.name.trim(),
        symbol: createForm.symbol.trim(),
        decimals: parseInt(createForm.decimals, 10) || 0,
        initialSupply: parseInt(createForm.initialSupply, 10) || 0,
        tokenType: createForm.tokenType,
      });
      setShowCreate(false);
      setCreateForm({ name: '', symbol: '', decimals: '0', initialSupply: '0', tokenType: 'fungible' });
      await loadTokens(selectedAccount.accountId);
    } catch (e) {
      setCreateError(e.response?.data?.error || e.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleAssociate(e) {
    e.preventDefault();
    setAssociateError('');
    setAssociating(true);
    try {
      await associateToken({
        accountId: selectedAccount.accountId,
        vaultKeyName: selectedAccount.vaultKeyName,
        tokenId: associateTokenId.trim(),
      });
      setShowAssociate(false);
      setAssociateTokenId('');
      await loadTokens(selectedAccount.accountId);
    } catch (e) {
      setAssociateError(e.response?.data?.error || e.message);
    } finally {
      setAssociating(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Hedera Token Service</h1>
        {selectedAccount && (
          <div className="flex gap-2">
            <button
              onClick={() => { setShowAssociate(true); setAssociateError(''); setAssociateTokenId(''); }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium"
            >
              Associate Token
            </button>
            <button
              onClick={() => { setShowCreate(true); setCreateError(''); setCreateForm({ name: '', symbol: '', decimals: '0', initialSupply: '0', tokenType: 'fungible' }); }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium"
            >
              + Create Token
            </button>
          </div>
        )}
      </div>

      {/* Account selector */}
      <div className="mb-6 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3">
        <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">Account</label>
        {accounts.length === 0 ? (
          <p className="text-sm text-gray-500">No accounts found. Create one on the Accounts page first.</p>
        ) : (
          <select
            value={selectedAccount?.accountId || ''}
            onChange={(e) => {
              const acc = accounts.find((a) => a.accountId === e.target.value);
              setSelectedAccount(acc || null);
            }}
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          >
            {accounts.map((a) => (
              <option key={a.accountId} value={a.accountId}>
                {a.accountId} — Vault key: {a.vaultKeyName}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Token list */}
      {selectedAccount && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Associated Tokens</h2>
            <button
              onClick={() => loadTokens(selectedAccount.accountId)}
              disabled={tokensLoading}
              className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-40"
            >
              {tokensLoading ? 'Loading…' : '↻ Refresh'}
            </button>
          </div>

          {tokensError && <p className="text-red-400 text-sm mb-3">{tokensError}</p>}

          {!tokensLoading && !tokensError && tokens.length === 0 && (
            <p className="text-gray-500 text-sm">No tokens associated with this account.</p>
          )}

          <div className="space-y-2">
            {tokens.map((t) => (
              <div key={t.tokenId} className="flex items-center justify-between px-4 py-3 bg-gray-800 rounded-lg">
                <a
                  href={hashscanTokenUrl(t.tokenId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm text-indigo-400 hover:underline"
                >
                  {t.tokenId}
                </a>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">{formatBalance(t.balance, t.decimals)}</p>
                  <p className="text-xs text-gray-500">
                    {t.decimals > 0 ? `raw ${t.balance} · ${t.decimals} decimals` : 'units'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Token modal */}
      {showCreate && (
        <Modal title="Create Token" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Token Name</label>
                <input
                  type="text"
                  placeholder="My Token"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  autoFocus
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Symbol</label>
                <input
                  type="text"
                  placeholder="MTK"
                  value={createForm.symbol}
                  onChange={(e) => setCreateForm((f) => ({ ...f, symbol: e.target.value }))}
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Token Type</label>
              <select
                value={createForm.tokenType}
                onChange={(e) => setCreateForm((f) => ({ ...f, tokenType: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="fungible">Fungible (FT)</option>
                <option value="nft">Non-Fungible (NFT)</option>
              </select>
            </div>

            {createForm.tokenType === 'fungible' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Decimals</label>
                  <input
                    type="number"
                    min="0"
                    max="18"
                    value={createForm.decimals}
                    onChange={(e) => setCreateForm((f) => ({ ...f, decimals: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Initial Supply</label>
                  <input
                    type="number"
                    min="0"
                    value={createForm.initialSupply}
                    onChange={(e) => setCreateForm((f) => ({ ...f, initialSupply: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            <div className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs text-gray-500">
              Treasury: <span className="text-gray-300 font-mono">{selectedAccount.accountId}</span>
              {' · '}Vault key: <span className="text-gray-300">{selectedAccount.vaultKeyName}</span>
            </div>

            {createError && <p className="text-red-400 text-sm">{createError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
              <button type="submit" disabled={creating} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded text-sm font-medium">
                {creating ? 'Creating on Hedera…' : 'Create Token'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Associate Token modal */}
      {showAssociate && (
        <Modal title="Associate Token" onClose={() => setShowAssociate(false)}>
          <form onSubmit={handleAssociate} className="space-y-4">
            <p className="text-xs text-gray-400">
              Associate an existing Hedera token with <span className="text-gray-200 font-mono">{selectedAccount.accountId}</span>.
              The account must sign this transaction (handled via Vault).
            </p>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Token ID</label>
              <input
                type="text"
                placeholder="0.0.1234567"
                value={associateTokenId}
                onChange={(e) => setAssociateTokenId(e.target.value)}
                required
                autoFocus
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
            {associateError && <p className="text-red-400 text-sm">{associateError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAssociate(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
              <button type="submit" disabled={associating} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded text-sm font-medium">
                {associating ? 'Associating…' : 'Associate'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
