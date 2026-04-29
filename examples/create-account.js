/**
 * Example: Create Vault keys and Hedera accounts (ED25519 + ECDSA)
 *
 * Run from the examples directory:
 *   cd examples && npm install && node create-account.js
 *
 * Required env vars:
 *   VAULT_ADDR, VAULT_TOKEN, OPERATOR_ID, OPERATOR_PRIVATE_KEY
 */

require('dotenv').config();
const axios      = require('axios');
const { keccak256 } = require('ethereum-cryptography/keccak');
const { secp256k1 } = require('ethereum-cryptography/secp256k1');
const {
  Client, AccountId, AccountCreateTransaction, Hbar, PrivateKey, PublicKey,
} = require('@hashgraph/sdk');

// ─── Config ───────────────────────────────────────────────────────────────────

const VAULT_ADDR           = process.env.VAULT_ADDR           || 'http://localhost:8200';
const VAULT_TOKEN          = process.env.VAULT_TOKEN          || 'root';
const OPERATOR_ID          = process.env.OPERATOR_ID;           // e.g. "0.0.12345"
const OPERATOR_PRIVATE_KEY = process.env.OPERATOR_PRIVATE_KEY; // hex ED25519 key

if (!OPERATOR_ID || !OPERATOR_PRIVATE_KEY) {
  console.error('Set OPERATOR_ID and OPERATOR_PRIVATE_KEY in your environment.');
  process.exit(1);
}

// Simple Vault HTTP client
const vault = axios.create({
  baseURL: VAULT_ADDR,
  headers: { 'X-Vault-Token': VAULT_TOKEN },
});

// ─── Step 1: Create keys in Vault ────────────────────────────────────────────

// ED25519 — stored inside Vault Transit; the private key never leaves Vault
async function createED25519Key(name) {
  await vault.post(`/v1/transit/keys/${name}`, { type: 'ed25519' });
  console.log(`[Vault] Created ED25519 Transit key: "${name}"`);
}

// ECDSA (secp256k1) — generated locally, then stored encrypted in Vault KV
async function createECDSAKey(name) {
  const privateKey = secp256k1.utils.randomPrivateKey();
  const publicKey  = secp256k1.getPublicKey(privateKey, true); // compressed 33 bytes
  await vault.post(`/v1/secret/data/hedera-ecdsa/${name}`, {
    data: {
      type:       'secp256k1',
      privateKey: Buffer.from(privateKey).toString('hex'),
      publicKey:  Buffer.from(publicKey).toString('hex'),
    },
  });
  console.log(`[Vault] Created ECDSA KV key: "${name}"`);
}

// ─── Step 2: Read public key from Vault ──────────────────────────────────────

// Vault Transit returns the public key as a base64-encoded DER blob.
// The raw 32-byte ED25519 key is always the last 32 bytes of that DER.
async function getED25519PublicKey(name) {
  const res      = await vault.get(`/v1/transit/keys/${name}`);
  const keyEntry = res.data.data.keys[res.data.data.latest_version];
  const derBytes = Buffer.from(keyEntry.public_key, 'base64');
  return PublicKey.fromBytesED25519(derBytes.slice(-32));
}

// Vault KV stores the compressed hex public key we saved during creation.
async function getECDSAPublicKey(name) {
  const res        = await vault.get(`/v1/secret/data/hedera-ecdsa/${name}`);
  const compressed = Buffer.from(res.data.data.data.publicKey, 'hex');
  return PublicKey.fromBytesECDSA(compressed);
}

// ─── Step 3: Sign with Vault ─────────────────────────────────────────────────

// Vault Transit signs the raw bytes and returns a "vault:v1:<base64>" string.
async function signED25519(name, bytes) {
  const res = await vault.post(`/v1/transit/sign/${name}`, {
    input:     Buffer.from(bytes).toString('base64'),
    prehashed: false,
  });
  const sig = res.data.data.signature; // "vault:v1:<base64>"
  return Buffer.from(sig.split(':')[2], 'base64'); // strip prefix → 64 raw bytes
}

// For ECDSA we retrieve the private key from Vault KV and sign locally.
// Hedera ECDSA requires a keccak256 hash of the message bytes.
async function signECDSA(name, bytes) {
  const res        = await vault.get(`/v1/secret/data/hedera-ecdsa/${name}`);
  const privateKey = Buffer.from(res.data.data.data.privateKey, 'hex');
  const hash       = keccak256(Buffer.from(bytes));
  const sig        = secp256k1.sign(hash, privateKey);
  return Buffer.from(sig.toCompactRawBytes()); // 64 bytes (r ‖ s)
}

// ─── Step 4: Create a Hedera account ─────────────────────────────────────────

// fromString auto-detects DER (what the Hedera portal exports).
// Falls back to raw hex for ED25519 or ECDSA.
function parseOperatorKey(str) {
  const s = str.startsWith('0x') ? str.slice(2) : str;
  for (const fn of [PrivateKey.fromString, PrivateKey.fromStringED25519, PrivateKey.fromStringECDSA]) {
    try { return fn(s); } catch {}
  }
  throw new Error('Cannot parse OPERATOR_PRIVATE_KEY — check that it is a valid hex or DER key');
}

// The operator (fee payer) signs via its own private key.
// The new account's key must also co-sign to prove ownership.
async function createHederaAccount(publicKey, signFn) {
  const operator = parseOperatorKey(OPERATOR_PRIVATE_KEY);
  console.log(`[Debug] Operator ${OPERATOR_ID} → key type: ${operator.type}, public key: ${operator.publicKey.toStringRaw()}`);
  console.log(`[Debug] New account public key: ${publicKey.toStringRaw()}`);

  const client = Client.forTestnet();
  client.setOperator(AccountId.fromString(OPERATOR_ID), operator);

  const tx = await new AccountCreateTransaction()
    .setKey(publicKey)
    .setInitialBalance(new Hbar(1))
    .setNodeAccountIds([new AccountId(3)])
    .freezeWith(client);

  // Wrap signFn to log the signature for debugging
  const debugSignFn = async (bytes) => {
    const sig = await signFn(bytes);
    console.log(`[Debug] Signature: ${Buffer.from(sig).toString('hex').substring(0, 32)}... (${sig.length} bytes)`);
    return sig;
  };

  await tx.signWith(publicKey, debugSignFn);

  const response = await tx.execute(client);
  const receipt  = await response.getReceipt(client);
  client.close();
  return receipt.accountId.toString();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== ED25519 (Vault Transit) ===');
  await createED25519Key('demo-ed25519');
  const ed25519PubKey   = await getED25519PublicKey('demo-ed25519');
  const ed25519Account  = await createHederaAccount(
    ed25519PubKey,
    (bytes) => signED25519('demo-ed25519', bytes),
  );
  console.log('[Hedera] New ED25519 account:', ed25519Account);

  console.log('\n=== ECDSA / secp256k1 (Vault KV) ===');
  await createECDSAKey('demo-ecdsa');
  const ecdsaPubKey  = await getECDSAPublicKey('demo-ecdsa');
  const ecdsaAccount = await createHederaAccount(
    ecdsaPubKey,
    (bytes) => signECDSA('demo-ecdsa', bytes),
  );
  console.log('[Hedera] New ECDSA account:', ecdsaAccount);
}

main().catch(console.error);
