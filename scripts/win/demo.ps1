# One-command demo setup + launch for ShieldGate (Windows / PowerShell).
#
# Installs/verifies prerequisites, (re)installs project deps, starts the local
# Supabase stack, wires up the two .env files automatically, resets the DB to
# fresh demo data, starts backend + mock-ai + dashboard in the background,
# builds the extension, launches it in a dedicated Chromium profile, and
# prints a cheat sheet of everything you need for a live demo.
#
# Re-run any time: it's idempotent and re-seeds fresh demo data every run.
# Stop everything with: scripts\win\stop-demo.ps1
#
# Run from an elevated-not-required PowerShell window: powershell -ExecutionPolicy Bypass -File scripts\win\demo.ps1

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $RepoRoot

$RunDir = Join-Path $RepoRoot ".demo"
$LogDir = Join-Path $RunDir "logs"
$PidFile = Join-Path $RunDir "pids"
$BrowserProfile = Join-Path $RunDir "browser-profile"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "  ok  $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "  !   $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "  x   $msg" -ForegroundColor Red; exit 1 }

# ── Kill anything left running from a previous, uncleanly-stopped run ──────
# taskkill /T kills the whole process tree — needed because the pnpm/cmd
# wrapper below is a parent of the real node/python process.
if (Test-Path $PidFile) {
  Get-Content $PidFile | ForEach-Object {
    if ($_) { taskkill /PID $_ /T /F *> $null }
  }
}
foreach ($port in 8000, 5175, 3000) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { taskkill /PID $_.OwningProcess /T /F *> $null }
}
Set-Content -Path $PidFile -Value ""

# ── Preflight: tools ─────────────────────────────────────────────────────
Step "Checking prerequisites"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Fail "git not found. Install it from https://git-scm.com/download/win"
}
Ok "$(git --version)"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Fail "Node.js not found. Install a 24.x release from https://nodejs.org/en/download"
}
Ok "node $(node -v)"

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  Warn "pnpm not found, enabling via corepack"
  corepack enable
  corepack prepare pnpm@9.10.0 --activate
}
Ok "pnpm $(pnpm -v)"

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
  Warn "uv not found, installing"
  irm https://astral.sh/uv/install.ps1 | iex
}
Ok "$(uv --version)"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Fail "Docker not found. Install Docker Desktop: https://www.docker.com/products/docker-desktop/"
}
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Warn "Docker daemon not running, launching Docker Desktop"
  Start-Process "$Env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
  Write-Host "  waiting for Docker to come up" -NoNewline
  $ready = $false
  for ($i = 0; $i -lt 60; $i++) {
    docker info *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Write-Host "." -NoNewline
    Start-Sleep -Seconds 2
  }
  Write-Host ""
  if (-not $ready) { Fail "Docker still isn't running. Open Docker Desktop manually and re-run this script." }
}
Ok "docker running"

$BrowserExe = $null
$BrowserCandidates = @(
  "${Env:LOCALAPPDATA}\Programs\Opera GX\opera.exe",
  "${Env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
  "${Env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "${Env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "${Env:LOCALAPPDATA}\BraveSoftware\Brave-Browser\Application\brave.exe"
)
foreach ($candidate in $BrowserCandidates) {
  if (Test-Path $candidate) { $BrowserExe = $candidate; break }
}
if (-not $BrowserExe) {
  Warn "No Chromium-based browser found — the extension needs one (Chrome, Opera GX, Brave, Edge)"
} else {
  Ok "browser: $BrowserExe"
}

# ── Install project deps ────────────────────────────────────────────────
Step "Installing project dependencies"
pnpm install
uv --directory apps/backend sync
pnpm gen:policy
Ok "dependencies ready"

# ── Supabase (Postgres + auth) ──────────────────────────────────────────
Step "Starting local Supabase stack"
pnpm exec supabase status *> $null
if ($LASTEXITCODE -eq 0) {
  Ok "already running"
} else {
  pnpm exec supabase start
}

$StatusEnv = pnpm exec supabase status -o env 2>$null
$AnonLine = $StatusEnv | Where-Object { $_ -match '^ANON_KEY=' }
if (-not $AnonLine) { Fail "Couldn't read the Supabase anon key from 'supabase status'." }
$AnonKey = ($AnonLine -replace '^ANON_KEY="?', '') -replace '"?$', ''
Ok "anon key retrieved"

# ── Env files ────────────────────────────────────────────────────────────
Step "Writing .env files"
if (-not (Test-Path "apps\backend\.env")) { Copy-Item "apps\backend\.env.example" "apps\backend\.env" }
if (-not (Test-Path "apps\dashboard\.env.local")) { Copy-Item "apps\dashboard\.env.example" "apps\dashboard\.env.local" }

# Rewrite the anon key every run in case the local project was reset.
(Get-Content "apps\dashboard\.env.local") -replace '^NEXT_PUBLIC_SUPABASE_ANON_KEY=.*', "NEXT_PUBLIC_SUPABASE_ANON_KEY=$AnonKey" |
  Set-Content "apps\dashboard\.env.local"
Ok "apps\backend\.env and apps\dashboard\.env.local ready"

# ── Fresh demo data ──────────────────────────────────────────────────────
Step "Resetting database with fresh demo data"
pnpm exec supabase db reset
uv --directory apps/backend run python -m shieldgate.demo_seed
Ok "seed data loaded"

# ── Start the three app servers in the background ──────────────────────
Step "Starting backend, mock-ai and dashboard"

# Routed through cmd.exe /c: pnpm resolves to a .cmd shim (via corepack),
# which Process.Start can't launch directly without ShellExecute. The PID
# saved is cmd.exe's — stop-demo.ps1 uses `taskkill /T` to reach its children.
function Start-Bg($name, $command) {
  $p = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $command -WorkingDirectory $RepoRoot `
    -RedirectStandardOutput "$LogDir\$name.log" -RedirectStandardError "$LogDir\$name.err.log" `
    -WindowStyle Hidden -PassThru
  Add-Content -Path $PidFile -Value $p.Id
}

Start-Bg "backend" "uv --directory apps/backend run uvicorn shieldgate.main:app --port 8000"
Start-Bg "mock-ai" "pnpm --filter mock-ai dev"
Start-Bg "dashboard" "pnpm --filter dashboard dev"

function Wait-For($url, $label) {
  Write-Host "  waiting for $label" -NoNewline
  for ($i = 0; $i -lt 60; $i++) {
    try {
      Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null
      Write-Host " ok"
      return
    } catch {
      Write-Host "." -NoNewline
      Start-Sleep -Seconds 1
    }
  }
  Write-Host ""
  Warn "$label didn't respond in time — check $LogDir\*.log"
}

Wait-For "http://127.0.0.1:8000/api/v1/health" "backend"
Wait-For "http://localhost:5175"               "mock-ai"
Wait-For "http://localhost:3000/login"         "dashboard"

# ── Build the extension ─────────────────────────────────────────────────
Step "Building the browser extension"
pnpm --filter extension build
$ExtDir = Join-Path $RepoRoot "apps\extension\.output\chrome-mv3"
if (-not (Test-Path $ExtDir)) { Fail "Extension build didn't produce $ExtDir" }
Ok "built at $ExtDir"

# ── Register a demo decision for the /lookup walkthrough ───────────────
Step "Registering a demo AI decision"
$DecisionKey = (Get-Content "apps\backend\.env" | Where-Object { $_ -match '^DECISION_API_KEY=' }) -replace '^DECISION_API_KEY=', ''
if (-not $DecisionKey) { $DecisionKey = "test-internal-key" }
$DrCode = $null
try {
  $resp = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/api/v1/decisions" `
    -Headers @{ "X-Internal-Key" = $DecisionKey } -ContentType "application/json" `
    -Body '{"subject_ref":"SUBJ-DEMO","system_name":"AI Ticket Triage","model_used":"llama-3.3-70b","explanation_text":"Ticket ranked lower urgency because its description matched known self-serve resolutions."}'
  $DrCode = $resp.public_ref
} catch {}
if ($DrCode) { Ok "reference: $DrCode" } else { Warn "couldn't register a demo decision — try bash scripts/register-demo-decision.sh (Git Bash) manually" }

# ── Launch the browser with the extension pre-loaded ────────────────────
Step "Launching the extension"
$Launched = $false
if ($BrowserExe) {
  $args = @(
    "--user-data-dir=$BrowserProfile",
    "--load-extension=$ExtDir",
    "--disable-extensions-except=$ExtDir",
    "--no-first-run", "--no-default-browser-check",
    "http://localhost:5175"
  )
  try {
    Start-Process -FilePath $BrowserExe -ArgumentList $args
    $Launched = $true
  } catch {}
}
if ($Launched) {
  Ok "opened $BrowserExe with the extension pre-loaded (separate demo profile)"
} else {
  Warn "couldn't auto-launch a browser — open one manually and load $ExtDir unpacked"
}

# ── Cheat sheet ──────────────────────────────────────────────────────────
Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "  ShieldGate demo is up" -ForegroundColor Green
Write-Host "========================================================`n" -ForegroundColor Green

Write-Host "URLs"
Write-Host "  Mock AI Chat (extension target) " -NoNewline; Write-Host "http://localhost:5175" -ForegroundColor Cyan
Write-Host "  Dashboard login                 " -NoNewline; Write-Host "http://localhost:3000/login" -ForegroundColor Cyan
Write-Host "  Public decision lookup          " -NoNewline; Write-Host "http://localhost:3000/lookup  (no login)" -ForegroundColor Cyan
Write-Host "  Backend health                  " -NoNewline; Write-Host "http://127.0.0.1:8000/api/v1/health" -ForegroundColor Cyan
Write-Host "  Supabase Studio (raw DB)        " -NoNewline; Write-Host "http://127.0.0.1:54323" -ForegroundColor Cyan

Write-Host "`nDashboard demo accounts  (password for all: shieldgate-demo)"
Write-Host "  Admin     admin@shieldgate.demo"
Write-Host "  Manager   manager@shieldgate.demo"
Write-Host "  Employee  employee@shieldgate.demo"
Write-Host "  (dashboard login page also has one-click quick-switch buttons for these)"

Write-Host "`nThings to paste into the mock chat (localhost:5175)"
Write-Host "  Blocked card number   " -NoNewline; Write-Host "please charge 4532-0151-1283-0366 today" -ForegroundColor Yellow
Write-Host "  Output-risk demo      " -NoNewline; Write-Host "show me the exploit" -ForegroundColor Yellow
Write-Host "  -> after a block, try `"Send redacted version`" and `"Request access`" too"

if ($DrCode) {
  Write-Host "`nDecision Registry / redress demo"
  Write-Host "  Open http://localhost:3000/lookup and enter reference: " -NoNewline
  Write-Host $DrCode -ForegroundColor Yellow
}

Write-Host "`nExtension"
Write-Host "  Loaded from: $ExtDir"
if (-not $Launched) {
  Write-Host "  Manual load: open your browser's extensions page, enable Developer mode,"
  Write-Host "  click `"Load unpacked`", and select the folder above."
}

Write-Host "`nLogs           $LogDir\*.log"
Write-Host "Stop everything scripts\win\stop-demo.ps1`n"
