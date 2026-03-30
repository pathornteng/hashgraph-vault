const axios = require('axios');
const { PublicKey } = require('@hashgraph/sdk');
const { keccak256 } = require('ethereum-cryptography/keccak');
const { secp256k1 } = require('ethereum-cryptography/secp256k1');

// ED25519  → Vault Transit  (key never leaves Vault)
// secp256k1 → Vault KV      (key stored encrypted at rest; signing is local)
const ECDSA_KV_DATA = 'secret/data/hedera-ecdsa';
const ECDSA_KV_META = 'secret/metadata/hedera-ecdsa';

// Cache key type to avoid repeated Vault lookups on every sign
const keyTypeCache = new Map();

const vaultClient = axios.create({
  baseURL: process.env.VAULT_ADDR || 'http://localhost:8200',
  headers: { 'X-Vault-Token': process.env.VAULT_TOKEN || 'root' },
});

// Unwrap Vault's { errors: [...] } into a readable Error
vaultClient.interceptors.response.use(null, (err) => {
  const vaultErrors = err.response?.data?.errors;
  if (vaultErrors?.length) {
    const wrapped = new Error(`Vault: ${vaultErrors.join('; ')}`);
    wrapped.status = err.response.status;
    return Promise.reject(wrapped);
  }
  return Promise.reject(err);
});

function is404(err) {
  return err.status === 404 || err.response?.status === 404;
}

// ─── Transit (ED25519) ────────────────────────────────────────────────────────

async function listTransitKeys() {
  try {
    const res = await vaultClient.get('/v1/transit/keys', { params: { list: true } });
    return res.data.data.keys || [];
  } catch (err) {
    if (is404(err)) return [];
    throw err;
  }
}

async function getTransitKeyInfo(name) {
  const res = await vaultClient.get(`/v1/transit/keys/${name}`);
  const info = res.data.data;
  keyTypeCache.set(name, info.type);
  return info;
}

// ─── KV (secp256k1) ──────────────────────────────────────────────────────────

async function listEcdsaKvKeys() {
  try {
    const res = await vaultClient.request({ method: 'LIST', url: `/v1/${ECDSA_KV_META}` });
    return res.data.data.keys || [];
  } catch (err) {
    if (is404(err)) return [];
    throw err;
  }
}

async function getEcdsaKvData(name) {
  const res = await vaultClient.get(`/v1/${ECDSA_KV_DATA}/${name}`);
  return res.data.data.data; // KV v2 wraps payload in data.data
}

async function createEcdsaKvKey(name) {
  const privateKey = secp256k1.utils.randomPrivateKey();
  const publicKey = secp256k1.getPublicKey(privateKey, true); // compressed 33 bytes
  await vaultClient.post(`/v1/${ECDSA_KV_DATA}/${name}`, {
    data: {
      type: 'secp256k1',
      privateKey: Buffer.from(privateKey).toString('hex'),
      publicKey: Buffer.from(publicKey).toString('hex'),
      createdAt: new Date().toISOString(),
    },
  });
  keyTypeCache.set(name, 'secp256k1');
}

// ─── Public API ───────────────────────────────────────────────────────────────

async function listKeys() {
  const [transit, ecdsa] = await Promise.all([listTransitKeys(), listEcdsaKvKeys()]);
  return [...transit, ...ecdsa];
}

async function createKey(name, type = 'ed25519', exportable = false) {
  if (type === 'ecdsa') {
    return createEcdsaKvKey(name);
  }
  await vaultClient.post(`/v1/transit/keys/${name}`, { type: 'ed25519', exportable });
  keyTypeCache.set(name, 'ed25519');
}

async function exportKey(name) {
  const keyType = await getKeyType(name);

  if (keyType === 'secp256k1') {
    const kv = await getEcdsaKvData(name);
    return { type: 'secp256k1', privateKey: kv.privateKey }; // already hex
  }

  // ED25519 via Transit export
  const res = await vaultClient.get(`/v1/transit/export/signing-key/${name}`);
  const versions = res.data.data.keys;
  // Return the latest version as hex
  const latestVersion = Object.keys(versions).sort((a, b) => Number(b) - Number(a))[0];
  const rawBytes = Buffer.from(versions[latestVersion], 'base64');
  return { type: 'ed25519', privateKey: rawBytes.toString('hex') };
}

// Returns a synthetic info object compatible with the route layer for both key types
async function getKeyInfo(name) {
  // Try Transit first
  try {
    return await getTransitKeyInfo(name);
  } catch (err) {
    if (!is404(err)) throw err;
  }
  // Fall back to KV (secp256k1)
  const kv = await getEcdsaKvData(name);
  keyTypeCache.set(name, 'secp256k1');
  return {
    type: 'secp256k1',
    latest_version: 1,
    keys: { 1: { creation_time: kv.createdAt } },
  };
}

async function getKeyType(name) {
  if (keyTypeCache.has(name)) return keyTypeCache.get(name);
  const info = await getKeyInfo(name); // populates cache as a side-effect
  return keyTypeCache.get(name);
}

async function getPublicKey(keyName) {
  const keyType = await getKeyType(keyName);

  if (keyType === 'secp256k1') {
    const kv = await getEcdsaKvData(keyName);
    const compressed = Buffer.from(kv.publicKey, 'hex');
    const pubKey = PublicKey.fromBytesECDSA(compressed);
    console.log('ECDSA public key:', pubKey.toStringRaw());
    return pubKey;
  }

  // ED25519 from Transit
  const info = await getTransitKeyInfo(keyName);
  const latestVersion = info.latest_version;
  const keyEntry = info.keys[latestVersion];
  if (!keyEntry) throw new Error(`No key at version ${latestVersion} for "${keyName}"`);

  const b64 = keyEntry.public_key;
  if (!b64) throw new Error(`Key "${keyName}" has no public_key field`);

  const derBytes = Buffer.from(b64, 'base64');
  console.log(`ED25519 DER (${derBytes.length}B):`, derBytes.toString('hex'));
  const rawBytes = derBytes.slice(derBytes.length - 32);
  const pubKey = PublicKey.fromBytesED25519(rawBytes);
  console.log('ED25519 public key:', pubKey.toStringRaw());
  return pubKey;
}

// Convert DER-encoded ECDSA signature → raw 64-byte (r ‖ s) for Hedera
function derToRawEcdsa(der) {
  let offset = 2; // skip 0x30 <totalLen>
  offset++;       // skip 0x02
  const rLen = der[offset++];
  const r = der.slice(offset, offset + rLen);
  offset += rLen;
  offset++;       // skip 0x02
  const sLen = der[offset++];
  const s = der.slice(offset, offset + sLen);

  const rPadded = Buffer.alloc(32);
  const sPadded = Buffer.alloc(32);
  const rTrim = r[0] === 0x00 ? r.slice(1) : r;
  const sTrim = s[0] === 0x00 ? s.slice(1) : s;
  rTrim.copy(rPadded, 32 - rTrim.length);
  sTrim.copy(sPadded, 32 - sTrim.length);
  return Buffer.concat([rPadded, sPadded]);
}

async function sign(keyName, bodyBytes) {
  const keyType = await getKeyType(keyName);

  if (keyType === 'secp256k1') {
    // Sign locally using the key retrieved from Vault KV
    const kv = await getEcdsaKvData(keyName);
    const privateKey = Buffer.from(kv.privateKey, 'hex');
    const hash = keccak256(Buffer.from(bodyBytes));
    const sig = secp256k1.sign(hash, privateKey);
    return Buffer.from(sig.toCompactRawBytes()); // 64 bytes r ‖ s
  }

  // ED25519 via Vault Transit
  const input = Buffer.from(bodyBytes).toString('base64');
  const res = await vaultClient.post(`/v1/transit/sign/${keyName}`, {
    input,
    prehashed: false,
  });
  const sig = res.data.data.signature; // vault:v1:<base64>
  const sigBytes = Buffer.from(sig.split(':')[2], 'base64');
  // ED25519 signatures are raw 64 bytes; DER would start with 0x30
  return sigBytes[0] === 0x30 ? derToRawEcdsa(sigBytes) : sigBytes;
}

async function deleteKey(name) {
  const keyType = await getKeyType(name).catch(() => null);
  keyTypeCache.delete(name);

  if (keyType === 'secp256k1') {
    // Deleting KV metadata removes all versions
    await vaultClient.delete(`/v1/${ECDSA_KV_META}/${name}`);
    return;
  }

  await vaultClient.post(`/v1/transit/keys/${name}/config`, { deletion_allowed: true });
  await vaultClient.delete(`/v1/transit/keys/${name}`);
}

const ADMIN_KV_DATA = 'secret/data/admin-users';

async function getAdminCredentials(username) {
  try {
    const res = await vaultClient.get(`/v1/${ADMIN_KV_DATA}/${username}`);
    return res.data.data.data; // KV v2 wraps payload in data.data
  } catch (err) {
    if (is404(err)) return null;
    throw err;
  }
}

module.exports = { listKeys, createKey, getKeyInfo, getPublicKey, sign, deleteKey, exportKey, getAdminCredentials };
