# Stops the backend/mock-ai/dashboard processes started by scripts\win\demo.ps1.
# Supabase's Docker containers are left running (fast to resume next time) —
# pass -Supabase to stop those too.
param([switch]$Supabase)

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $RepoRoot

$PidFile = Join-Path $RepoRoot ".demo\pids"

if (Test-Path $PidFile) {
  Get-Content $PidFile | ForEach-Object {
    if ($_) {
      taskkill /PID $_ /T /F *> $null
      if ($LASTEXITCODE -eq 0) { Write-Host "stopped pid $_" }
    }
  }
  Set-Content -Path $PidFile -Value ""
} else {
  Write-Host "no pid file found — nothing started by scripts\win\demo.ps1 is tracked"
}

if ($Supabase) {
  pnpm exec supabase stop
  Write-Host "supabase stopped"
}
