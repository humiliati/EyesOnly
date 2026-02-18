# Seed local D1 + local worker with test accounts.
# Usage:
#   1) Start local worker: npx wrangler dev --local --port 8787
#   2) Run: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/seed-local-test-accounts.ps1

$ErrorActionPreference = 'Stop'

$base = 'http://127.0.0.1:8787'

function Register-User($username, $callsign) {
  $body = @{ username = $username; callsign = $callsign } | ConvertTo-Json
  try {
    $r = Invoke-RestMethod -Method Post -Uri "$base/api/user/register" -ContentType 'application/json' -Body $body
    Write-Host "[OK] registered $username" -ForegroundColor Green
    return $r
  } catch {
    # If already exists, fall back to login
    $body2 = @{ username = $username } | ConvertTo-Json
    try {
      $r2 = Invoke-RestMethod -Method Post -Uri "$base/api/user/login" -ContentType 'application/json' -Body $body2
      Write-Host "[OK] logged in existing $username" -ForegroundColor Yellow
      return $r2
    } catch {
      Write-Host ("[FAIL] ${username}: " + ($_.Exception.Message)) -ForegroundColor Red
      throw
    }
  }
}

Register-User 'user'  'user'  | Out-Null
Register-User 'admin' 'admin' | Out-Null

Write-Host "Done." -ForegroundColor Cyan
