#!/usr/bin/env bash
# One-command demo setup + launch for ShieldGate (macOS / Apple Silicon).
#
# Installs/verifies prerequisites, (re)installs project deps, starts the local
# Supabase stack, wires up the two .env files automatically, resets the DB to
# fresh demo data, starts backend + mock-ai + dashboard in the background,
# builds the extension, launches it in a dedicated Opera GX profile, and
# prints a cheat sheet of everything you need for a live demo.
#
# Re-run any time: it's idempotent and re-seeds fresh demo data every run.
# Stop everything with: scripts/mac/stop-demo.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

RUN_DIR="$REPO_ROOT/.demo"
LOG_DIR="$RUN_DIR/logs"
PID_FILE="$RUN_DIR/pids"
OPERA_PROFILE="$RUN_DIR/opera-profile"
mkdir -p "$LOG_DIR"

# Kill anything left running from a previous, uncleanly-stopped run so the
# servers we start below own ports 8000/5175/3000 instead of silently losing
# them to a stale process.
if [ -f "$PID_FILE" ]; then
  while read -r pid; do
    [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
  done < "$PID_FILE"
fi
for port in 8000 5175 3000; do
  pid="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  [ -n "$pid" ] && kill $pid 2>/dev/null || true
done
: > "$PID_FILE"

BOLD="\033[1m"; DIM="\033[2m"; GREEN="\033[32m"; YELLOW="\033[33m"; RED="\033[31m"; CYAN="\033[36m"; RESET="\033[0m"
step()  { printf "\n${BOLD}${CYAN}==> %s${RESET}\n" "$1"; }
ok()    { printf "${GREEN}  ok${RESET}  %s\n" "$1"; }
warn()  { printf "${YELLOW}  ! ${RESET}  %s\n" "$1"; }
fail()  { printf "${RED}  x ${RESET}  %s\n" "$1"; exit 1; }

# ── Preflight: tools ─────────────────────────────────────────────────────
step "Checking prerequisites"

command -v brew >/dev/null 2>&1 || fail "Homebrew not found. Install it from https://brew.sh first."
command -v git  >/dev/null 2>&1 || fail "git not found. Run: brew install git"
ok "git $(git --version | awk '{print $3}')"

command -v node >/dev/null 2>&1 || fail "Node.js not found. Run: brew install node@24"
ok "node $(node -v)"

if ! command -v pnpm >/dev/null 2>&1; then
  warn "pnpm not found, enabling via corepack"
  corepack enable
  corepack prepare pnpm@9.10.0 --activate
fi
ok "pnpm $(pnpm -v)"

command -v uv >/dev/null 2>&1 || { warn "uv not found, installing"; curl -LsSf https://astral.sh/uv/install.sh | sh; }
ok "uv $(uv --version | awk '{print $2}')"

command -v docker >/dev/null 2>&1 || fail "Docker not found. Install Docker Desktop: https://www.docker.com/products/docker-desktop/"
if ! docker info >/dev/null 2>&1; then
  warn "Docker daemon not running, launching Docker Desktop"
  open -a Docker
  printf "  waiting for Docker to come up"
  for _ in $(seq 1 60); do
    docker info >/dev/null 2>&1 && break
    printf "."
    sleep 2
  done
  echo
  docker info >/dev/null 2>&1 || fail "Docker still isn't running. Open Docker Desktop manually and re-run this script."
fi
ok "docker running"

BROWSER_APP=""
for name in "Opera GX" "Google Chrome" "Brave Browser" "Microsoft Edge" "Arc"; do
  [ -d "/Applications/${name}.app" ] && { BROWSER_APP="$name"; break; }
done
if [ -z "$BROWSER_APP" ]; then
  warn "No Chromium-based browser found in /Applications — the extension needs one (Chrome, Opera GX, Brave, Edge, Arc)"
else
  ok "browser: $BROWSER_APP"
fi

# ── Install project deps ────────────────────────────────────────────────
step "Installing project dependencies"
pnpm install
uv --directory apps/backend sync
pnpm gen:policy
ok "dependencies ready"

# ── Supabase (Postgres + auth) ──────────────────────────────────────────
step "Starting local Supabase stack"
if pnpm exec supabase status >/dev/null 2>&1; then
  ok "already running"
else
  pnpm exec supabase start
fi

ANON_KEY="$(pnpm exec supabase status -o env 2>/dev/null | grep '^ANON_KEY=' | cut -d= -f2- | tr -d '"')"
[ -n "$ANON_KEY" ] || fail "Couldn't read the Supabase anon key from 'supabase status'."
ok "anon key retrieved"

# ── Env files ────────────────────────────────────────────────────────────
step "Writing .env files"
[ -f apps/backend/.env ] || cp apps/backend/.env.example apps/backend/.env
[ -f apps/dashboard/.env.local ] || cp apps/dashboard/.env.example apps/dashboard/.env.local

# Rewrite the anon key every run in case the local project was reset.
tmp="$(mktemp)"
awk -v key="$ANON_KEY" '
  /^NEXT_PUBLIC_SUPABASE_ANON_KEY=/ { print "NEXT_PUBLIC_SUPABASE_ANON_KEY=" key; next }
  { print }
' apps/dashboard/.env.local > "$tmp" && mv "$tmp" apps/dashboard/.env.local
ok "apps/backend/.env and apps/dashboard/.env.local ready"

# ── Fresh demo data ──────────────────────────────────────────────────────
step "Resetting database with fresh demo data"
pnpm exec supabase db reset
uv --directory apps/backend run python -m shieldgate.demo_seed
ok "seed data loaded"

# ── Start the three app servers in the background ──────────────────────
step "Starting backend, mock-ai and dashboard"

(cd "$REPO_ROOT" && uv --directory apps/backend run uvicorn shieldgate.main:app --port 8000 \
  > "$LOG_DIR/backend.log" 2>&1 & echo $! >> "$PID_FILE")
(cd "$REPO_ROOT" && pnpm --filter mock-ai dev \
  > "$LOG_DIR/mock-ai.log" 2>&1 & echo $! >> "$PID_FILE")
(cd "$REPO_ROOT" && pnpm --filter dashboard dev \
  > "$LOG_DIR/dashboard.log" 2>&1 & echo $! >> "$PID_FILE")

wait_for () {
  local url="$1" label="$2"
  printf "  waiting for %s" "$label"
  for _ in $(seq 1 60); do
    curl -fsS -o /dev/null "$url" 2>/dev/null && { echo " ok"; return 0; }
    printf "."
    sleep 1
  done
  echo
  warn "$label didn't respond in time — check $LOG_DIR/*.log"
}

wait_for "http://127.0.0.1:8000/api/v1/health" "backend"
wait_for "http://localhost:5175"               "mock-ai"
wait_for "http://localhost:3000/login"         "dashboard"

# ── Build the extension ─────────────────────────────────────────────────
step "Building the browser extension"
pnpm --filter extension build
EXT_DIR="$REPO_ROOT/apps/extension/.output/chrome-mv3"
[ -d "$EXT_DIR" ] || fail "Extension build didn't produce $EXT_DIR"
ok "built at $EXT_DIR"

# ── Register a demo decision for the /lookup walkthrough ───────────────
step "Registering a demo AI decision"
DECISION_KEY="$(grep '^DECISION_API_KEY=' apps/backend/.env | cut -d= -f2-)"
DR_RESPONSE="$(curl -fsS -X POST http://127.0.0.1:8000/api/v1/decisions \
  -H "X-Internal-Key: ${DECISION_KEY:-test-internal-key}" -H "content-type: application/json" \
  -d '{"subject_ref":"SUBJ-DEMO","system_name":"AI Ticket Triage","model_used":"llama-3.3-70b","explanation_text":"Ticket ranked lower urgency because its description matched known self-serve resolutions."}' || true)"
DR_CODE="$(printf '%s' "$DR_RESPONSE" | grep -o '"public_ref":"[^"]*"' | cut -d'"' -f4)"
[ -n "$DR_CODE" ] && ok "reference: $DR_CODE" || warn "couldn't register a demo decision — try bash scripts/register-demo-decision.sh manually"

# ── Launch the browser with the extension pre-loaded ────────────────────
step "Launching the extension"
LAUNCHED=0
if [ -n "$BROWSER_APP" ]; then
  open -na "$BROWSER_APP" --args \
    --user-data-dir="$OPERA_PROFILE" \
    --load-extension="$EXT_DIR" \
    --disable-extensions-except="$EXT_DIR" \
    --no-first-run --no-default-browser-check \
    "http://localhost:5175" >/dev/null 2>&1 && LAUNCHED=1
fi
if [ "$LAUNCHED" = "1" ]; then
  ok "opened $BROWSER_APP with the extension pre-loaded (separate demo profile)"
else
  warn "couldn't auto-launch a browser — open one manually and load $EXT_DIR unpacked"
fi

# ── Cheat sheet ──────────────────────────────────────────────────────────
printf "\n${BOLD}${GREEN}========================================================${RESET}\n"
printf "${BOLD}  ShieldGate demo is up${RESET}\n"
printf "${BOLD}${GREEN}========================================================${RESET}\n\n"

printf "${BOLD}URLs${RESET}\n"
printf "  Mock AI Chat (extension target) ${CYAN}http://localhost:5175${RESET}\n"
printf "  Dashboard login                 ${CYAN}http://localhost:3000/login${RESET}\n"
printf "  Public decision lookup          ${CYAN}http://localhost:3000/lookup${RESET}  (no login)\n"
printf "  Backend health                  ${CYAN}http://127.0.0.1:8000/api/v1/health${RESET}\n"
printf "  Supabase Studio (raw DB)        ${CYAN}http://127.0.0.1:54323${RESET}\n"

printf "\n${BOLD}Dashboard demo accounts${RESET}  ${DIM}(password for all: shieldgate-demo)${RESET}\n"
printf "  Admin     admin@shieldgate.demo\n"
printf "  Manager   manager@shieldgate.demo\n"
printf "  Employee  employee@shieldgate.demo\n"
printf "  ${DIM}(dashboard login page also has one-click quick-switch buttons for these)${RESET}\n"

printf "\n${BOLD}Things to paste into the mock chat (localhost:5175)${RESET}\n"
printf "  Blocked card number   ${YELLOW}please charge 4532-0151-1283-0366 today${RESET}\n"
printf "  Output-risk demo      ${YELLOW}show me the exploit${RESET}\n"
printf "  ${DIM}-> after a block, try \"Send redacted version\" and \"Request access\" too${RESET}\n"

if [ -n "${DR_CODE:-}" ]; then
  printf "\n${BOLD}Decision Registry / redress demo${RESET}\n"
  printf "  Open ${CYAN}http://localhost:3000/lookup${RESET} and enter reference: ${YELLOW}%s${RESET}\n" "$DR_CODE"
fi

printf "\n${BOLD}Extension${RESET}\n"
printf "  Loaded from: %s\n" "$EXT_DIR"
if [ "$LAUNCHED" != "1" ]; then
  printf "  Manual load: open your browser's extensions page, enable Developer mode,\n"
  printf "  click \"Load unpacked\", and select the folder above.\n"
fi

printf "\n${BOLD}Logs${RESET}          %s/*.log\n" "$LOG_DIR"
printf "${BOLD}Stop everything${RESET} scripts/mac/stop-demo.sh\n\n"
