# How to Create a Vault Key and a Hedera Account

This guide explains what the example script does, step by step.

---

## What the script does

1. Creates a cryptographic key in HashiCorp Vault
2. Reads the public key back from Vault
3. Creates a Hedera account whose owner is that public key
4. Signs the creation transaction using the Vault key (the private key never leaves Vault)

It does this twice — once with an **ED25519** key and once with an **ECDSA (secp256k1)** key.

---

## Prerequisites

| What | Where |
|------|-------|
| HashiCorp Vault running in dev mode | `docker compose up vault` |
| Vault Transit secrets engine enabled | `vault secrets enable transit` |
| Vault KV v2 engine enabled (for ECDSA) | enabled by default in dev mode at `secret/` |
| A funded Hedera Testnet operator account | [portal.hedera.com](https://portal.hedera.com) |

---

## How to run

```bash
# 1. Install dependencies
cd examples
npm install

# 2. Set up your environment
cp .env.example .env
# Edit .env and fill in OPERATOR_ID and OPERATOR_PRIVATE_KEY

# 3. Make sure Vault is running
docker compose up -d vault

# 4. Run the script
node create-account.js
```

Expected output:

```
=== ED25519 (Vault Transit) ===
[Vault] Created ED25519 Transit key: "demo-ed25519"
[Hedera] New ED25519 account: 0.0.XXXXXX

=== ECDSA / secp256k1 (Vault KV) ===
[Vault] Created ECDSA KV key: "demo-ecdsa"
[Hedera] New ECDSA account: 0.0.XXXXXX
```

---

## Step-by-step explanation

### Step 1 — Create a key in Vault

**ED25519**

```
POST /v1/transit/keys/demo-ed25519
{ "type": "ed25519" }
```

Vault generates the key internally. The private key is encrypted and stored inside Vault — it is never exposed. This is the Transit secrets engine.

**ECDSA**

```
POST /v1/secret/data/hedera-ecdsa/demo-ecdsa
{ "data": { "privateKey": "...", "publicKey": "..." } }
```

The secp256k1 key is generated locally in the script, then stored in Vault's KV (key-value) store. The private key bytes are encrypted at rest by Vault.

---

### Step 2 — Read the public key from Vault

**ED25519**

```
GET /v1/transit/keys/demo-ed25519
```

Vault returns the public key as a base64-encoded DER blob. DER is a binary envelope format. The actual 32-byte ED25519 key is always the **last 32 bytes** of that blob:

```js
const derBytes = Buffer.from(keyEntry.public_key, 'base64');
const rawKey   = derBytes.slice(-32); // last 32 bytes
PublicKey.fromBytesED25519(rawKey);
```

**ECDSA**

```
GET /v1/secret/data/hedera-ecdsa/demo-ecdsa
```

We saved the compressed public key hex when creating the key, so we just read it back:

```js
const compressed = Buffer.from(res.data.data.data.publicKey, 'hex');
PublicKey.fromBytesECDSA(compressed);
```

---

### Step 3 — Sign with Vault

When Hedera asks for a signature, we hand Vault the raw transaction bytes and get back a signature.

**ED25519** — Vault signs inside the Transit engine:

```
POST /v1/transit/sign/demo-ed25519
{ "input": "<base64 of bytes>", "prehashed": false }
```

Vault returns `"vault:v1:<base64-signature>"`. We strip the `vault:v1:` prefix and decode the base64 to get the raw 64-byte signature.

```js
const raw = sig.split(':')[2];          // the base64 part
Buffer.from(raw, 'base64');             // 64-byte signature
```

**ECDSA** — We retrieve the private key from Vault KV and sign locally:

```js
const hash = keccak256(bytes);          // Hedera ECDSA requires keccak256
secp256k1.sign(hash, privateKey);       // returns a 64-byte (r ‖ s) signature
```

> Why local signing for ECDSA? Vault Transit does not support secp256k1 natively.  
> The key is still protected at rest inside Vault.

---

### Step 4 — Create the Hedera account

```js
const tx = await new AccountCreateTransaction()
  .setKey(publicKey)           // new account's key (from Vault)
  .setInitialBalance(new Hbar(1))
  .setNodeAccountIds([new AccountId(3)])
  .freezeWith(client);

await tx.signWith(publicKey, signFn); // new account co-signs (proves key ownership)
await tx.execute(client);             // operator pays the fee and also signs
```

Two signatures are required:
- **Operator** — your existing Hedera account that pays the transaction fee. Signs automatically via `client.setOperator(...)`.
- **New account** — the key we just created in Vault must co-sign to prove we own it. This calls our `signED25519` / `signECDSA` function which reaches out to Vault.

After `execute`, the receipt contains the new `accountId`.

---

## Key differences: ED25519 vs ECDSA

| | ED25519 (Transit) | ECDSA secp256k1 (KV) |
|---|---|---|
| Where is the private key? | Inside Vault Transit, never exported | Vault KV (encrypted at rest) |
| Who does the signing? | Vault (server-side) | Your process (local) |
| Vault engine | Transit | KV v2 |
| Hash before signing? | No | keccak256 |
| Signature size | 64 bytes | 64 bytes (r ‖ s compact) |
| Hedera SDK method | `PublicKey.fromBytesED25519` | `PublicKey.fromBytesECDSA` |
