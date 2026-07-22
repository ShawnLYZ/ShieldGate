#!/usr/bin/env bash
# One-command local dev: starts Supabase, then backend + mock-ai + dashboard, each backgrounded
# in this shell. Run from the repo root. Extension load/build is a separate manual step (see
# README.md) since "unpacked" installs can't be scripted into Chrome.
set -euo pipefail

supabase start
(uv --directory apps/backend run uvicorn shieldgate.main:app --port 8000) &
(pnpm --filter mock-ai dev) &
(pnpm --filter dashboard dev) &
echo "Started. Build + load the extension from apps/extension/.output/chrome-mv3."
