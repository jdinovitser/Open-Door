#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "Installing dependencies from the committed lockfile..."
npm ci --no-audit --no-fund

echo "Checking server and application logic..."
npm test

echo "Building the merged application..."
npm run build

# Database changes must have an explicit reviewed migration. Do not run schema
# replacement or production DDL automatically as a side effect of every merge.
echo "Post-merge setup complete."
