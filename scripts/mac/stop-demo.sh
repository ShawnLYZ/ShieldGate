#!/usr/bin/env bash
# Stops the backend/mock-ai/dashboard processes started by scripts/mac/demo.sh.
# Supabase's Docker containers are left running (fast to resume next time) —
# pass --supabase to stop those too.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

PID_FILE="$REPO_ROOT/.demo/pids"

if [ -f "$PID_FILE" ]; then
  while read -r pid; do
    [ -n "$pid" ] && kill "$pid" 2>/dev/null && echo "stopped pid $pid"
  done < "$PID_FILE"
  : > "$PID_FILE"
else
  echo "no pid file found — nothing started by scripts/mac/demo.sh is tracked"
fi

if [ "${1:-}" = "--supabase" ]; then
  pnpm exec supabase stop
  echo "supabase stopped"
fi
