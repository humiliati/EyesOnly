param(
  [int]$Port = 8787
)

# Simple local hook-up for full site dev + perf logging
# - starts wrangler dev in local mode
# - open: http://127.0.0.1:$Port/?perf=1

$ErrorActionPreference = 'Stop'

Write-Host "[EyesOnly] Starting wrangler dev --local on port $Port" -ForegroundColor Green
Write-Host "[EyesOnly] Perf HUD: add ?perf=1 (or set localStorage.EYESONLY_PERF='1')" -ForegroundColor Green

# NOTE: use --local to avoid external dependencies and keep iteration tight
npx wrangler dev --local --port $Port
