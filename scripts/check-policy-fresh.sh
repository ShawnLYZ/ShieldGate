#!/usr/bin/env bash
set -euo pipefail
pnpm gen:policy >/dev/null
if ! git diff --exit-code -- packages/policy/schema apps/backend/src/shieldgate/generated; then
  echo "::error::policy artifacts are stale — run 'pnpm gen:policy' and commit"
  exit 1
fi
echo "policy artifacts fresh"
