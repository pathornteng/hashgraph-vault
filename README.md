# Hashgraph Vault

A web-based admin dashboard for managing Hedera accounts and signing transactions using **HashiCorp Vault** as the key management backend. Private keys are never exposed to the application — all signing is delegated to Vault.

## Features

- Create and manage cryptographic keys in HashiCorp Vault Transit (ED25519) and KV (secp256k1)
- Create Hedera accounts linked to Vault-managed keys
- Transfer HBAR between accounts, signed via Vault
- View live account balances
- Supports both ED25519 and ECDSA (secp256k1) key types

## Architecture

```
Browser → React UI → Express Backend → HashiCorp Vault
                                     → Hedera Testnet/Mainnet
```

| Layer       | Technology                             |
|-------------|----------------------------------------|
| Frontend    | React 18 + Vite + TailwindCSS          |
| Backend     | Node.js 18 + Express                   |
| Key Storage | HashiCorp Vault (Transit + KV)         |
| Blockchain  | Hedera Testnet / Mainnet               |
| SDK         | @hashgraph/sdk                         |

### Key Type Storage Strategy

| Key Type    | Vault Backend         | Signing        |
|-------------|-----------------------|----------------|
| ED25519     | Transit Engine        | Vault Transit (key never leaves Vault) |
| secp256k1   | KV Engine (`secret/`) | Local via `ethereum-cryptography`, Keccak256 hash |

> Vault Transit OSS does not support the secp256k1 curve. ECDSA keys are stored encrypted at rest in Vault KV and retrieved only for signing.

## Prerequisites

- [Node.js 18+](https://nodejs.org/)
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- A [Hedera Testnet account](https://portal.hedera.com/) (for the fee-paying operator)
- HashiCorp Vault **1.10+** (secp256k1 KV support; included in Docker setup)

## Quick Start

### 1. Start Vault

```bash
docker compose up -d vault
```

### 2. Enable Vault secrets engines (run once)

```bash
# Set Vault address
export VAULT_ADDR=http://localhost:8200
export VAULT_TOKEN=root

# Enable Transit (for ED25519 keys)
vault secrets enable transit

# KV v2 is enabled by default in dev mode at secret/
# If not in dev mode:
# vault secrets enable -version=2 kv
```

### 3. Configure the backend

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```dotenv
VAULT_ADDR=http://localhost:8200
VAULT_TOKEN=root

HEDERA_NETWORK=testnet
OPERATOR_ID=0.0.YOUR_ACCOUNT_ID

# Use your Hedera account's private key (hex, with or without 0x prefix)
OPERATOR_PRIVATE_KEY=your-ed25519-or-ecdsa-private-key-hex

PORT=4000
ADMIN_TOKEN=changeme
```

### 4. Install and run the backend

```bash
cd backend
npm install
npm run dev
```

### 5. Configure and run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Running with Docker Compose (full stack)

Uncomment the `backend` and `frontend` services in `docker-compose.yml`, then create a root `.env`:

```dotenv
OPERATOR_ID=0.0.YOUR_ACCOUNT_ID
OPERATOR_PRIVATE_KEY=your-private-key-hex
ADMIN_TOKEN=changeme
```

```bash
docker compose up -d
```

---

## Configuration

### Backend environment variables

| Variable              | Required | Description |
|-----------------------|----------|-------------|
| `VAULT_ADDR`          | Yes      | Vault server URL |
| `VAULT_TOKEN`         | Yes      | Vault authentication token |
| `HEDERA_NETWORK`      | Yes      | `testnet` or `mainnet` |
| `OPERATOR_ID`         | Yes      | Hedera account ID that pays transaction fees |
| `OPERATOR_PRIVATE_KEY`| Yes*     | Raw hex private key for the operator account |
| `OPERATOR_VAULT_KEY`  | Yes*     | Vault Transit key name for the operator (alternative to above) |
| `PORT`                | No       | Backend port (default: `4000`) |
| `ADMIN_TOKEN`         | No       | API authentication token sent as `x-admin-token` header |

*Set either `OPERATOR_PRIVATE_KEY` or `OPERATOR_VAULT_KEY`, not both.

### Frontend environment variables

| Variable          | Default                  | Description |
|-------------------|--------------------------|-------------|
| `VITE_API_URL`    | `` (proxy via Vite)      | Backend URL |
| `VITE_ADMIN_TOKEN`| `""`                     | Sent as `x-admin-token` on every request |

---

## API Reference

### Keys — `/api/keys`

| Method | Path               | Body                        | Description                        |
|--------|--------------------|-----------------------------|------------------------------------|
| GET    | `/api/keys`        | —                           | List all keys                      |
| POST   | `/api/keys`        | `{ name, type? }`           | Create key (`ed25519` or `ecdsa`)  |
| GET    | `/api/keys/:name`  | —                           | Get key info + public key          |
| DELETE | `/api/keys/:name`  | —                           | Delete a key                       |

### Accounts — `/api/accounts`

| Method | Path                        | Body                              | Description                        |
|--------|-----------------------------|-----------------------------------|------------------------------------|
| GET    | `/api/accounts/operator`    | —                                 | Operator account info + balance    |
| GET    | `/api/accounts`             | —                                 | List all managed accounts          |
| POST   | `/api/accounts`             | `{ vaultKeyName, initialBalance?}`| Create Hedera account              |
| GET    | `/api/accounts/:id`         | —                                 | Get account details                |
| GET    | `/api/accounts/:id/balance` | —                                 | Fetch live balance from Hedera     |

### Transactions — `/api/transactions`

| Method | Path                           | Body                                                        | Description              |
|--------|--------------------------------|-------------------------------------------------------------|--------------------------|
| POST   | `/api/transactions/transfer`   | `{ fromAccountId, toAccountId, amount, vaultKeyName }`     | Transfer HBAR via Vault  |
| GET    | `/api/transactions`            | —                                                           | List past transactions   |

---

## Security Notes

- **Never commit `.env` files.** Use `.env.example` as a template.
- The `VAULT_TOKEN=root` in `docker-compose.yml` is for **development only**. Use scoped policy tokens in production.
- In production, disable Vault dev mode and use a persistent storage backend (Raft or Consul).
- ED25519 private keys never leave Vault. secp256k1 private keys leave Vault only during signing (retrieved from KV, used in memory, then discarded).
- The `ADMIN_TOKEN` guards all API routes. Use a strong random value in production.

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── keys.js           # Vault key management endpoints
│   │   │   ├── accounts.js       # Hedera account endpoints
│   │   │   └── transactions.js   # HBAR transfer endpoints
│   │   ├── services/
│   │   │   ├── vaultService.js   # Vault Transit + KV interactions
│   │   │   └── hederaService.js  # Hedera SDK interactions
│   │   ├── middleware/auth.js
│   │   ├── store.js              # JSON file persistence (accounts + tx history)
│   │   └── index.js
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Keys.jsx
│   │   │   ├── Accounts.jsx
│   │   │   └── Transfer.jsx
│   │   ├── components/
│   │   │   ├── Modal.jsx
│   │   │   ├── KeyCard.jsx
│   │   │   ├── AccountCard.jsx
│   │   │   └── TransferForm.jsx
│   │   ├── services/api.js
│   │   └── App.jsx
│   └── package.json
├── docker-compose.yml
└── README.md
```

## License

MIT
