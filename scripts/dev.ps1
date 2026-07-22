# One-command local dev: starts Supabase, then backend + mock-ai + dashboard, each in its own
# PowerShell window. Run from the repo root. Extension load/build is a separate manual step
# (see README.md) since "unpacked" installs can't be scripted into Chrome.
supabase start
Start-Process powershell -ArgumentList 'uv --directory apps/backend run uvicorn shieldgate.main:app --port 8000'
Start-Process powershell -ArgumentList 'pnpm --filter mock-ai dev'
Start-Process powershell -ArgumentList 'pnpm --filter dashboard dev'
Write-Output "Started. Build + load the extension from apps/extension/.output/chrome-mv3."
