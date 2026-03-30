#!/usr/bin/env node
// Usage: node scripts/create-admin.js <username> <password>
require('dotenv').config();
const bcrypt = require('bcryptjs');
const axios = require('axios');

const [,, username, password] = process.argv;
if (!username || !password) {
  console.error('Usage: node scripts/create-admin.js <username> <password>');
  process.exit(1);
}

(async () => {
  const hash = await bcrypt.hash(password, 12);
  const client = axios.create({
    baseURL: process.env.VAULT_ADDR || 'http://localhost:8200',
    headers: { 'X-Vault-Token': process.env.VAULT_TOKEN || 'root' },
  });

  await client.post(`/v1/secret/data/admin-users/${username}`, {
    data: { username, password_hash: hash },
  });

  console.log(`Admin user "${username}" created in Vault.`);
})();
