# Hashgraph Vault

A web-based admin dashboard for managing Hedera accounts and signing transactions using **HashiCorp Vault** as the key management backend. Private keys are never exposed to the application — all signing is delegated to Vault.

## Features

- Admin login with JWT-based authentication (credentials stored in Vault KV)
- Create and manage cryptographic keys in HashiCorp Vault Transit (ED25519) and KV (secp256k1)
- Create and remove Hedera accounts linked to Vault-managed keys
- Transfer HBAR between accounts, signed via Vault
- View live account balances with links to HashScan
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
- HashiCorp Vault **1.10+** (included in Docker setup)

## Quick Start

### 1. Start Vault

```bash
./vault-only.sh -d
```

### 2. Run the one-time setup

Enables Vault secrets engines, creates the first admin user, and generates a JWT secret:

```bash
./vault-setup.sh
```

### 3. Configure the backend

```bash
cp .env.example backend/.env
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

# Written automatically by vault-setup.sh:
JWT_SECRET=your-generated-secret
JWT_EXPIRY=8h
```

### 4. Run the backend

```bash
cd backend && npm install && npm run dev
```

### 5. Run the frontend

```bash
./frontend.sh
```

Open [http://localhost:3000](http://localhost:3000) and sign in with the admin credentials created in step 2.

---

## Running with Docker Compose (full stack)

Create a root `.env` from the example:

```bash
cp .env.example .env
```

Fill in the values, then:

```bash
docker compose up -d
```

---

## Configuration

### Backend environment variables

| Variable               | Required | Description |
|------------------------|----------|-------------|
| `VAULT_ADDR`           | Yes      | Vault server URL |
| `VAULT_TOKEN`          | Yes      | Vault authentication token |
| `HEDERA_NETWORK`       | Yes      | `testnet` or `mainnet` |
| `OPERATOR_ID`          | Yes      | Hedera account ID that pays transaction fees |
| `OPERATOR_PRIVATE_KEY` | Yes*     | Raw hex private key for the operator account |
| `OPERATOR_VAULT_KEY`   | Yes*     | Vault Transit key name for the operator (alternative to above) |
| `JWT_SECRET`           | Yes      | Secret used to sign JWTs — generate with `openssl rand -hex 32` |
| `JWT_EXPIRY`           | No       | Token lifetime (default: `8h`) |
| `PORT`                 | No       | Backend port (default: `4000`) |

*Set either `OPERATOR_PRIVATE_KEY` or `OPERATOR_VAULT_KEY`, not both.

### Frontend environment variables

| Variable               | Default             | Description |
|------------------------|---------------------|-------------|
| `VITE_API_URL`         | `` (Vite proxy)     | Backend base URL |
| `VITE_HEDERA_NETWORK`  | `testnet`           | Used to build HashScan links |
| `BACKEND_URL`          | `http://localhost:4000` | Vite proxy target (build-time only) |

---

## API Reference

### Auth — `/api/auth`

| Method | Path             | Body                        | Description                  |
|--------|------------------|-----------------------------|------------------------------|
| POST   | `/api/auth/login`| `{ username, password }`    | Returns a signed JWT         |
| GET    | `/api/auth/me`   | —                           | Returns current user info    |

All other routes require `Authorization: Bearer <token>`.

### Keys — `/api/keys`

| Method | Path               | Body                        | Description                        |
|--------|--------------------|-----------------------------|------------------------------------|
| GET    | `/api/keys`        | —                           | List all keys                      |
| POST   | `/api/keys`        | `{ name, type? }`           | Create key (`ed25519` or `ecdsa`)  |
| GET    | `/api/keys/:name`  | —                           | Get key info + public key          |
| DELETE | `/api/keys/:name`  | —                           | Delete a key                       |

### Accounts — `/api/accounts`

| Method | Path                        | Body                               | Description                     |
|--------|-----------------------------|------------------------------------|----------------------------------|
| GET    | `/api/accounts/operator`    | —                                  | Operator account info + balance  |
| GET    | `/api/accounts`             | —                                  | List all managed accounts        |
| POST   | `/api/accounts`             | `{ vaultKeyName, initialBalance? }`| Create Hedera account            |
| DELETE | `/api/accounts/:id`         | —                                  | Remove account from local store  |
| GET    | `/api/accounts/:id`         | —                                  | Get account details              |
| GET    | `/api/accounts/:id/balance` | —                                  | Fetch live balance from Hedera   |

### Transactions — `/api/transactions`

| Method | Path                         | Body                                                       | Description             |
|--------|------------------------------|------------------------------------------------------------|-------------------------|
| POST   | `/api/transactions/transfer` | `{ fromAccountId, toAccountId, amount, vaultKeyName }`    | Transfer HBAR via Vault |
| GET    | `/api/transactions`          | —                                                          | List past transactions  |

---

## Security Notes

- **Never commit `.env` files.** Use `.env.example` as a template.
- The `VAULT_TOKEN=root` in `docker-compose.yml` is for **development only**. Use scoped policy tokens in production.
- In production, disable Vault dev mode and use a persistent storage backend (Raft or Consul).
- ED25519 private keys never leave Vault. secp256k1 private keys leave Vault only during signing (retrieved from KV, used in memory, then discarded).
- Admin credentials (bcrypt-hashed passwords) are stored in Vault KV at `secret/admin-users/<username>`.
- JWTs expire after 8 hours by default. Re-login is required after expiry.

## Project Structure

```
├── backend/
│   ├── scripts/
│   │   └── create-admin.js       # Seed an admin user into Vault KV
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js           # Login + /me endpoints
│   │   │   ├── keys.js           # Vault key management endpoints
│   │   │   ├── accounts.js       # Hedera account endpoints
│   │   │   └── transactions.js   # HBAR transfer endpoints
│   │   ├── services/
│   │   │   ├── vaultService.js   # Vault Transit + KV interactions
│   │   │   └── hederaService.js  # Hedera SDK interactions
│   │   ├── middleware/auth.js    # JWT verification
│   │   ├── store.js              # JSON file persistence (accounts + tx history)
│   │   └── index.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── context/
│   │   │   └── AuthContext.jsx   # JWT state + login/logout
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Keys.jsx
│   │   │   ├── Accounts.jsx
│   │   │   └── Transfer.jsx
│   │   ├── components/
│   │   │   ├── Logo.jsx
│   │   │   └── Modal.jsx
│   │   ├── services/api.js
│   │   └── App.jsx
│   └── package.json
├── .env.example
├── docker-compose.yml
├── frontend.sh                   # Start frontend dev server
├── vault-only.sh                 # Start Vault only (Docker)
├── vault-setup.sh                # One-time Vault setup + admin user creation
└── README.md
```

## License

MIT
