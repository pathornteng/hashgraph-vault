#!/usr/bin/env bash
# One-time Vault setup: enables engines, creates admin user, writes JWT secret.
# Run after `docker compose up vault -d` or `./vault-only.sh -d`.

set -e

VAULT_ADDR="${VAULT_ADDR:-http://localhost:8200}"
VAULT_TOKEN="${VAULT_TOKEN:-root}"
BACKEND_ENV="$(dirname "$0")/backend/.env"

export VAULT_ADDR VAULT_TOKEN

# ── Helpers ──────────────────────────────────────────────────────────────────

vault_cmd() { VAULT_ADDR="$VAULT_ADDR" VAULT_TOKEN="$VAULT_TOKEN" vault "$@"; }

wait_for_vault() {
  echo "Waiting for Vault at $VAULT_ADDR ..."
  for i in $(seq 1 30); do
    if vault_cmd status >/dev/null 2>&1; then
      echo "Vault is ready."
      return
    fi
    sleep 1
  done
  echo "ERROR: Vault did not become ready in time." >&2
  exit 1
}

enable_if_missing() {
  local type="$1" path="$2"
  if vault_cmd secrets list | grep -q "^${path}/"; then
    echo "  [skip] ${type} already enabled at ${path}/"
  else
    vault_cmd secrets enable -path="$path" "$type"
    echo "  [ok]   ${type} enabled at ${path}/"
  fi
}

update_env() {
  local key="$1" value="$2"
  if grep -q "^${key}=" "$BACKEND_ENV" 2>/dev/null; then
    # Replace existing line (portable sed)
    sed -i.bak "s|^${key}=.*|${key}=${value}|" "$BACKEND_ENV" && rm -f "${BACKEND_ENV}.bak"
  else
    echo "${key}=${value}" >> "$BACKEND_ENV"
  fi
}

# ── 1. Wait for Vault ─────────────────────────────────────────────────────────

wait_for_vault

# ── 2. Enable secrets engines ─────────────────────────────────────────────────

echo ""
echo "==> Enabling secrets engines"
enable_if_missing transit transit
enable_if_missing kv      secret
# Upgrade to KV v2 if needed
vault_cmd kv enable-versioning secret 2>/dev/null || true

# ── 3. Create admin user ──────────────────────────────────────────────────────

echo ""
echo "==> Create admin user"
read -p "  Admin username [admin]: " ADMIN_USER
ADMIN_USER="${ADMIN_USER:-admin}"

while true; do
  read -s -p "  Password: " ADMIN_PASS; echo
  read -s -p "  Confirm:  " ADMIN_PASS2; echo
  [ "$ADMIN_PASS" = "$ADMIN_PASS2" ] && break
  echo "  Passwords do not match, try again."
done

(
  cd "$(dirname "$0")/backend"
  node scripts/create-admin.js "$ADMIN_USER" "$ADMIN_PASS"
)

# ── 4. Generate JWT secret ────────────────────────────────────────────────────

echo ""
echo "==> Generating JWT secret"
if command -v openssl >/dev/null 2>&1; then
  JWT_SECRET=$(openssl rand -hex 32)
else
  # Fallback: /dev/urandom
  JWT_SECRET=$(LC_ALL=C tr -dc 'a-f0-9' < /dev/urandom | head -c 64)
fi

update_env "JWT_SECRET" "$JWT_SECRET"
update_env "JWT_EXPIRY"  "8h"
echo "  [ok]   JWT_SECRET written to backend/.env"

# ── 5. Done ───────────────────────────────────────────────────────────────────

echo ""
echo "Setup complete."
echo ""
echo "  Vault:    $VAULT_ADDR"
echo "  Admin:    $ADMIN_USER"
echo "  JWT:      8h expiry"
echo ""
echo "Start the full stack:  docker compose up -d"
echo "Start frontend only:   ./frontend.sh"
