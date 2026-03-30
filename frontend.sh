#!/usr/bin/env bash
# Start the frontend dev server

set -e

cd "$(dirname "$0")/frontend"

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

npm run dev
