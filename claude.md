# HashiCorp Vault + Hedera Key Management Web UI

## Project Overview

A web-based admin dashboard that allows administrators to:
- Create and manage cryptographic keys stored in HashiCorp Vault (Transit Engine)
- Create Hedera accounts linked to Vault-managed keys
- Transfer HBAR between accounts using Vault as the signing backend (private keys never leave Vault)

---

## Tech Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Frontend    | React + TailwindCSS               |
| Backend     | Node.js + Express                 |
| Key Storage | HashiCorp Vault (Transit Engine)  |
| Blockchain  | Hedera Testnet / Mainnet          |
| SDK         | @hashgraph/sdk                    |
| HTTP Client | Axios                             |
| Runtime     | Node.js 18+                       |

---

## Project Structure

```
/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── keys.js          # Vault key management endpoints
│   │   │   ├── accounts.js      # Hedera account creation endpoints
│   │   │   └── transactions.js  # HBAR transfer endpoints
│   │   ├── services/
│   │   │   ├── vaultService.js  # All HashiCorp Vault interactions
│   │   │   └── hederaService.js # All Hedera SDK interactions
│   │   ├── middleware/
│   │   │   └── auth.js          # Admin auth middleware
│   │   └── index.js             # Express app entry point
│   ├── .env
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Keys.jsx         # Key management UI
│   │   │   ├── Accounts.jsx     # Hedera account management UI
│   │   │   └── Transfer.jsx     # HBAR transfer UI
│   │   ├── components/
│   │   │   ├── KeyCard.jsx
│   │   │   ├── AccountCard.jsx
│   │   │   └── TransferForm.jsx
│   │   ├── services/
│   │   │   └── api.js           # Axios calls to backend
│   │   └── App.jsx
│   └── package.json
│
├── docker-compose.yml           # Vault + backend + frontend
└── CLAUDE.md
```

---

## Environment Variables

### Backend `.env`
```dotenv
# HashiCorp Vault
VAULT_ADDR=http://vault:8200
VAULT_TOKEN=your-vault-token

# Hedera
HEDERA_NETWORK=testnet           # testnet | mainnet
OPERATOR_ID=0.0.YOUR_ACCOUNT_ID  # fee-paying operator account
# No OPERATOR_KEY — signing is done via Vault

# Server
PORT=4000
NODE_ENV=development
```

---

## Key Architectural Rules

### Signing
- **Private keys NEVER leave Vault.** All signing is done via the Vault Transit `/v1/transit/sign/{key}` endpoint.
- The Hedera SDK operator is always set using `client.setOperatorWith(accountId, publicKey, signerCallback)` where the callback calls Vault.
- Never use `PrivateKey` from `@hashgraph/sdk` for Vault-managed keys.

### Public Key Extraction
- Vault returns public keys as base64-encoded DER (SubjectPublicKeyInfo format).
- Always extract raw key bytes using `derBytes.slice(derBytes.length - 32)` for ED25519 (last 32 bytes).
- Never hardcode the DER prefix offset — it varies across Vault versions.

### Transactions
- Always call `.setNodeAccountIds([new AccountId(3)])` before `.freezeWith(client)` when signing manually.
- Always use `prehashed: false` when calling the Vault sign endpoint for ED25519 keys.
- Vault signature format is `vault:v1:<base64>` — strip the prefix and decode before passing to Hedera.

---

## API Endpoints

### Keys — `/api/keys`
| Method | Path              | Description                        |
|--------|-------------------|------------------------------------|
| GET    | `/api/keys`       | List all keys in Vault Transit     |
| POST   | `/api/keys`       | Create a new key (`ed25519` only)  |
| GET    | `/api/keys/:name` | Get key details + public key       |
| DELETE | `/api/keys/:name` | Delete a key from Vault            |

### Accounts — `/api/accounts`
| Method | Path                  | Description                                      |
|--------|-----------------------|--------------------------------------------------|
| GET    | `/api/accounts`       | List all Hedera accounts (from local DB/store)   |
| POST   | `/api/accounts`       | Create Hedera account from a Vault key           |
| GET    | `/api/accounts/:id`   | Get account details + linked Vault key           |

### Transactions — `/api/transactions`
| Method | Path                    | Description                          |
|--------|-------------------------|--------------------------------------|
| POST   | `/api/transactions/transfer` | Transfer HBAR, signed via Vault |
| GET    | `/api/transactions`     | List past transactions               |

---

## Core Service Patterns

### vaultService.js
```js
// List all transit keys
async function listKeys() {}

// Create a new ed25519 key
async function createKey(name) {}

// Get the Hedera-compatible PublicKey from a Vault key
async function getPublicKey(keyName) {}

// Sign bytes via Vault Transit — returns raw 64-byte Buffer
async function sign(keyName, bodyBytes) {}
```

### hederaService.js
```js
// Build a Hedera client using Vault as the signer (no local private key)
async function buildClient(accountId, vaultKeyName) {}

// Create a Hedera account from a Vault public key
async function createAccount(vaultKeyName) {}

// Transfer HBAR — signing delegated to Vault
async function transferHbar(fromAccountId, toAccountId, amount, vaultKeyName) {}
```

---

## Web UI Pages

### Keys Page (`/keys`)
- Table of all Vault Transit keys (name, type, creation date, latest version)
- **Create Key** button → modal with key name input (type always `ed25519`)
- Each row has: **View Public Key**, **Delete** actions

### Accounts Page (`/accounts`)
- Table of Hedera accounts (account ID, linked Vault key, balance)
- **Create Account** button → dropdown to select existing Vault key → creates Hedera account
- Each row shows the linked Vault key name and the on-chain account ID

### Transfer Page (`/transfer`)
- Form fields: **From Account** (dropdown), **To Account ID** (text), **Amount (HBAR)**
- Submit triggers backend → Vault signs → Hedera executes
- Shows transaction ID and status on success

---

## Docker Compose Services

```yaml
services:
  vault:
    image: hashicorp/vault:latest
    ports: ["8200:8200"]
    environment:
      VAULT_DEV_ROOT_TOKEN_ID: "root"
      VAULT_DEV_LISTEN_ADDRESS: "0.0.0.0:8200"
    cap_add: [IPC_LOCK]

  backend:
    build: ./backend
    ports: ["4000:4000"]
    environment:
      VAULT_ADDR: http://vault:8200
      VAULT_TOKEN: root
    depends_on: [vault]

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    depends_on: [backend]
```

---

## Security Rules
- Never commit `.env` files — always use `.gitignore`
- Never hardcode Vault tokens — always use environment variables
- Never log private keys, tokens, or raw signatures
- Vault root token is for dev only — use scoped policy tokens in production
- In production, disable Vault dev mode and use proper storage backend (Raft/Consul)

---

## Commands

```bash
# Start all services
docker compose up -d

# Enable Vault Transit engine (run once)
vault secrets enable transit

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd frontend && npm install

# Run backend in dev mode
cd backend && npm run dev

# Run frontend in dev mode
cd frontend && npm run dev
```