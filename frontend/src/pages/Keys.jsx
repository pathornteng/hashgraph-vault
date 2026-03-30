import { useEffect, useState } from 'react';
import { listKeys, createKey, getKeyDetail, deleteKey, exportKey } from '../services/api';
import Modal from '../components/Modal';

const TYPE_BADGE = {
  ed25519:   'bg-indigo-900 text-indigo-300',
  secp256k1: 'bg-amber-900 text-amber-300',
};

export default function Keys() {
  const [keys, setKeys] = useState([]); // [{ name, type, latestVersion, createdAt, publicKey }]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyType, setNewKeyType] = useState('ed25519');
  const [newKeyExportable, setNewKeyExportable] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [pubKeyModal, setPubKeyModal] = useState(null);
  const [exportModal, setExportModal] = useState(null); // { name, type, privateKey } | null
  const [exporting, setExporting] = useState(null); // key name being exported

  async function load() {
    setLoading(true);
    setError('');
    try {
      const names = await listKeys();
      // Fetch details for all keys in parallel to get type + public key
      const details = await Promise.allSettled(names.map((n) => getKeyDetail(n)));
      setKeys(
        details.map((r, i) =>
          r.status === 'fulfilled'
            ? r.value
            : { name: names[i], type: '—', latestVersion: '—', createdAt: null, publicKey: null }
        )
      );
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      await createKey(newKeyName.trim(), newKeyType, newKeyExportable);
      setNewKeyName('');
      setNewKeyExportable(false);
      setShowCreate(false);
      await load();
    } catch (e) {
      setCreateError(e.response?.data?.error || e.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleExport(key) {
    setExporting(key.name);
    try {
      const data = await exportKey(key.name);
      setExportModal(data);
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    } finally {
      setExporting(null);
    }
  }

  async function handleDelete(name) {
    if (!confirm(`Delete key "${name}"? This is irreversible.`)) return;
    try {
      await deleteKey(name);
      await load();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Vault Keys</h1>
        <button
          onClick={() => { setShowCreate(true); setCreateError(''); setNewKeyName(''); }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium"
        >
          + Create Key
        </button>
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {!loading && !error && keys.length === 0 && (
        <p className="text-gray-500 text-sm">No keys found. Create one to get started.</p>
      )}

      <div className="space-y-2">
        {keys.map((k) => (
          <div key={k.name} className="flex items-center justify-between px-4 py-3 bg-gray-800 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-gray-200">{k.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_BADGE[k.type] ?? 'bg-gray-700 text-gray-300'}`}>
                {k.type}
              </span>
              {k.createdAt && (
                <span className="text-xs text-gray-500">{new Date(k.createdAt).toLocaleDateString()}</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPubKeyModal(k)}
                className="text-xs px-3 py-1 rounded bg-indigo-700 hover:bg-indigo-600 text-white"
              >
                View Public Key
              </button>
              {k.exportable && (
                <button
                  onClick={() => handleExport(k)}
                  disabled={exporting === k.name}
                  className="text-xs px-3 py-1 rounded bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white"
                >
                  {exporting === k.name ? '…' : 'Export'}
                </button>
              )}
              <button
                onClick={() => handleDelete(k.name)}
                className="text-xs px-3 py-1 rounded bg-red-800 hover:bg-red-700 text-white"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <Modal title="Create Key" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Key Name</label>
              <input
                type="text"
                placeholder="my-key"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                required
                autoFocus
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Key Type</label>
              <select
                value={newKeyType}
                onChange={(e) => setNewKeyType(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="ed25519">ED25519</option>
                <option value="ecdsa">ECDSA (secp256k1)</option>
              </select>
            </div>
            {newKeyType === 'ed25519' && (
              <div className="flex items-start gap-3">
                <input
                  id="exportable"
                  type="checkbox"
                  checked={newKeyExportable}
                  onChange={(e) => setNewKeyExportable(e.target.checked)}
                  className="mt-0.5 accent-indigo-500"
                />
                <label htmlFor="exportable" className="text-sm text-gray-300 cursor-pointer">
                  Allow private key export
                  <p className="text-xs text-amber-400 mt-0.5">Cannot be changed after creation. Only enable if you need to back up or migrate this key.</p>
                </label>
              </div>
            )}
            {createError && <p className="text-red-400 text-sm">{createError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
              <button type="submit" disabled={creating} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded text-sm font-medium">
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {exportModal && (
        <Modal title={`Export Private Key — ${exportModal.name}`} onClose={() => setExportModal(null)}>
          <div className="space-y-4">
            <div className="flex items-start gap-2 bg-amber-950 border border-amber-700 rounded p-3">
              <span className="text-amber-400 text-lg leading-none">⚠</span>
              <p className="text-xs text-amber-300">
                This is the raw private key. Anyone with this value can sign transactions on behalf of the associated Hedera account. Store it securely and never share it.
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Private Key (hex) — {exportModal.type}</p>
              <p className="font-mono text-xs break-all bg-gray-900 p-3 rounded text-amber-300 select-all">{exportModal.privateKey}</p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => { navigator.clipboard.writeText(exportModal.privateKey); }}
                className="text-xs px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-white"
              >
                Copy to clipboard
              </button>
            </div>
          </div>
        </Modal>
      )}

      {pubKeyModal && (
        <Modal title={`Public Key — ${pubKeyModal.name}`} onClose={() => setPubKeyModal(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-gray-400">Type</span>
              <span className={`inline-flex w-fit text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_BADGE[pubKeyModal.type] ?? 'bg-gray-700 text-gray-300'}`}>
                {pubKeyModal.type}
              </span>
              <span className="text-gray-400">Version</span><span>{pubKeyModal.latestVersion}</span>
              {pubKeyModal.createdAt && (
                <><span className="text-gray-400">Created</span><span>{new Date(pubKeyModal.createdAt).toLocaleString()}</span></>
              )}
            </div>
            {pubKeyModal.publicKey ? (
              <div>
                <p className="text-xs text-gray-400 mb-1">Public Key (hex)</p>
                <p className="font-mono text-xs break-all bg-gray-900 p-3 rounded text-green-400">{pubKeyModal.publicKey}</p>
              </div>
            ) : (
              <p className="text-xs text-red-400">Could not load public key.</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
