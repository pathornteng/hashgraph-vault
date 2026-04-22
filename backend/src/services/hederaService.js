const {
  Client,
  AccountCreateTransaction,
  TransferTransaction,
  AccountBalanceQuery,
  TokenCreateTransaction,
  TokenAssociateTransaction,
  TokenType,
  TokenId,
  AccountId,
  Hbar,
  PrivateKey,
} = require('@hashgraph/sdk');
const vaultService = require('./vaultService');

function getBaseClient() {
  return process.env.HEDERA_NETWORK === 'mainnet'
    ? Client.forMainnet()
    : Client.forTestnet();
}

// Build a client whose operator signs via Vault Transit
async function buildClient(accountId, vaultKeyName) {
  const publicKey = await vaultService.getPublicKey(vaultKeyName);
  const client = getBaseClient();
  client.setOperatorWith(
    AccountId.fromString(accountId),
    publicKey,
    (bodyBytes) => vaultService.sign(vaultKeyName, bodyBytes),
  );
  return client;
}

// Auto-detect ED25519 or ECDSA from a raw hex private key
function parsePrivateKey(hex) {
  try { return PrivateKey.fromStringECDSA(hex); } catch { }
  try { return PrivateKey.fromStringED25519(hex); } catch { }
  try { return PrivateKey.fromString(hex); } catch { } // DER auto-detect
  throw new Error('Cannot parse private key: not a valid ED25519 or ECDSA hex key');
}

// Build a client for the fee-paying operator.
// Prefers OPERATOR_PRIVATE_KEY (existing Hedera account) over OPERATOR_VAULT_KEY (Vault-managed key).
async function buildOperatorClient() {
  const operatorId = process.env.OPERATOR_ID;
  if (!operatorId) throw new Error('OPERATOR_ID must be set');

  const client = getBaseClient();
  const privateKey = process.env.OPERATOR_PRIVATE_KEY;
  const vaultKeyName = process.env.OPERATOR_VAULT_KEY;

  if (privateKey) {
    const hex = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
    const pk = parsePrivateKey(hex);
    console.log(`Operator public key (${pk.type}): ${pk.publicKey.toStringRaw()} — verify at https://hashscan.io/testnet/account/${operatorId}`);
    client.setOperator(AccountId.fromString(operatorId), pk);
  } else if (vaultKeyName) {
    const hex = vaultKeyName.startsWith('0x') ? vaultKeyName.slice(2) : vaultKeyName;
    if (/^[0-9a-fA-F]{64}$/.test(hex)) {
      // Looks like a raw private key — use it directly
      console.warn('OPERATOR_VAULT_KEY looks like a raw private key. Set OPERATOR_PRIVATE_KEY instead.');
      const pk = parsePrivateKey(hex);
      console.log(`Operator public key (${pk.type}): ${pk.publicKey.toStringRaw()} — verify at https://hashscan.io/testnet/account/${operatorId}`);
      client.setOperator(AccountId.fromString(operatorId), pk);
    } else {
      // Vault-managed operator key
      const publicKey = await vaultService.getPublicKey(vaultKeyName);
      client.setOperatorWith(
        AccountId.fromString(operatorId),
        publicKey,
        (bodyBytes) => vaultService.sign(vaultKeyName, bodyBytes),
      );
    }
  } else {
    throw new Error('Either OPERATOR_PRIVATE_KEY or OPERATOR_VAULT_KEY must be set');
  }

  return client;
}

async function createAccount(vaultKeyName, initialBalance = 1) {
  const client = await buildOperatorClient();
  const newPublicKey = await vaultService.getPublicKey(vaultKeyName);
  console.log('Creating account with public key:', newPublicKey.toStringRaw());

  const tx = await new AccountCreateTransaction()
    .setKey(newPublicKey)
    .setInitialBalance(new Hbar(initialBalance))
    .setNodeAccountIds([new AccountId(3)])
    .freezeWith(client);

  // New account's key must co-sign to prove key ownership
  await tx.signWith(newPublicKey, (bytes) => vaultService.sign(vaultKeyName, bytes));

  // Operator signs automatically via setOperator/setOperatorWith on execute
  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);
  client.close();

  return receipt.accountId.toString();
}

async function transferHbar(fromAccountId, toAccountId, amount, vaultKeyName) {
  const client = await buildClient(fromAccountId, vaultKeyName);

  const tx = await new TransferTransaction()
    .addHbarTransfer(AccountId.fromString(fromAccountId), new Hbar(-amount))
    .addHbarTransfer(AccountId.fromString(toAccountId), new Hbar(amount))
    .setNodeAccountIds([new AccountId(3)])
    .freezeWith(client);

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);
  client.close();

  return {
    transactionId: response.transactionId.toString(),
    status: receipt.status.toString(),
  };
}

async function getBalance(accountId) {
  const client = await buildOperatorClient();

  const balance = await new AccountBalanceQuery()
    .setAccountId(AccountId.fromString(accountId))
    .execute(client);

  client.close();
  return balance.hbars.toString();
}

async function createToken(accountId, vaultKeyName, { name, symbol, decimals = 0, initialSupply = 0, tokenType = 'fungible' }) {
  const client = await buildClient(accountId, vaultKeyName);
  const publicKey = await vaultService.getPublicKey(vaultKeyName);

  const tx = await new TokenCreateTransaction()
    .setTokenName(name)
    .setTokenSymbol(symbol)
    .setDecimals(decimals)
    .setInitialSupply(initialSupply)
    .setTreasuryAccountId(AccountId.fromString(accountId))
    .setAdminKey(publicKey)
    .setSupplyKey(publicKey)
    .setTokenType(tokenType === 'nft' ? TokenType.NonFungibleUnique : TokenType.FungibleCommon)
    .setNodeAccountIds([new AccountId(3)])
    .freezeWith(client);

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);
  client.close();

  return receipt.tokenId.toString();
}

async function associateToken(accountId, vaultKeyName, tokenId) {
  const client = await buildClient(accountId, vaultKeyName);

  const tx = await new TokenAssociateTransaction()
    .setAccountId(AccountId.fromString(accountId))
    .setTokenIds([TokenId.fromString(tokenId)])
    .setNodeAccountIds([new AccountId(3)])
    .freezeWith(client);

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);
  client.close();

  return receipt.status.toString();
}

async function getAccountTokens(accountId) {
  const client = await buildOperatorClient();

  const balance = await new AccountBalanceQuery()
    .setAccountId(AccountId.fromString(accountId))
    .execute(client);

  client.close();

  const tokens = [];
  // TokenBalanceMap / TokenDecimalMap are not standard Maps — iterate via _map
  if (balance.tokens?._map) {
    for (const [tokenId, amount] of balance.tokens._map) {
      const decimals = balance.tokenDecimals?._map?.get(tokenId);
      tokens.push({
        tokenId,
        balance: amount.toString(),
        decimals: decimals != null ? Number(decimals) : 0,
      });
    }
  }
  return tokens;
}

module.exports = { buildClient, createAccount, transferHbar, getBalance, createToken, associateToken, getAccountTokens };
