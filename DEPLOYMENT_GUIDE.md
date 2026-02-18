# User Account System Deployment Guide

## Overview
This implementation adds a username-based user account system to flapsandseals.com, allowing players to:
- Register accounts with username (required), callsign (optional), and email (optional)
- Log in/out using just their username
- Persist game data, inventory, and highscores across sessions
- Track accountability status in the header

This repo targets **Cloudflare Workers + D1** (see `wrangler.jsonc`).

---

## Deployment Steps

### 1) Deploy Database Migration (D1)

Run the migration to create the new user account tables:

```bash
# For local development
npx wrangler d1 execute database_id --local --file=migrations/0002_user_accounts.sql

# For production (remote)
npx wrangler d1 execute database_id --remote --file=migrations/0002_user_accounts.sql
```

This migration creates:
- `user_accounts` - User profiles
- `webauthn_credentials` - For future passkey support
- `user_sessions` - Session tokens
- `user_inventory` - Player inventory items
- `user_highscores` - Game scores
- `email_tokens` - For email verification/recovery

**Verify tables (local):**

```bash
npx wrangler d1 execute database_id --local --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

---

### 2) Install deps + build UI

```bash
npm ci
npm run build:ui
```

---

### 3) Run locally (Miniflare)

```bash
npx wrangler dev --local --port 8787
```

Open:
- http://127.0.0.1:8787

---

## Smoke Tests (LOCAL) — copy/paste commands

> IMPORTANT (Windows): in PowerShell, `curl` is an alias for `Invoke-WebRequest`.
> If you want real curl, use `curl.exe`.

### A) Register a user (PowerShell-safe)

```powershell
$body = @{ username = 'test_user_1'; callsign = 'TestOne' } | ConvertTo-Json
$r = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8787/api/user/register' -ContentType 'application/json' -Body $body
$r
```

Expected: returns `{ session_token, user }`.

### B) Call /me (authorized)

```powershell
$token = $r.session_token
Invoke-RestMethod -Method Get -Uri 'http://127.0.0.1:8787/api/user/me' -Headers @{ 'X-Session-Token' = $token }
```

Expected: returns `{ user: {...} }`.

### C) Logout

```powershell
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8787/api/user/logout' -Headers @{ 'X-Session-Token' = $token }
```

Expected: `{ success: true }`.

### D) Login (username-only)

```powershell
$body = @{ username = 'test_user_1' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8787/api/user/login' -ContentType 'application/json' -Body $body
```

Expected: returns a new `{ session_token, user }`.

---

## Common Gotchas (LOCAL)

### 1) PowerShell `curl` alias
If you run something like:

```powershell
curl -H "X-Session-Token: nope" http://127.0.0.1:8787/api/user/me
```

…it will fail because PowerShell is not using real curl.

Use either:
- `curl.exe ...` (real curl)
- or `Invoke-RestMethod` with `-Headers @{ ... }`.

### 2) “Internal Server Error” during JSON parsing
If you see:
- `SyntaxError: Expected property name or '}' in JSON...`

…it usually means the request body was not valid JSON (common when quoting JSON in PowerShell). Use the PowerShell-safe snippets above.

### 3) Wrangler compatibility date warning
If Wrangler logs that it is falling back to an older compatibility date, local dev still works, but you may be missing features tied to the requested date.

---

## Seed accounts for testing (align with LoginShell dummy accounts)

The UI includes a nested `LoginShell` with two dummy accounts (`user/password`, `admin/admin`) for a fake filesystem.

To make those usernames also exist in the **real** account system (so they can be used for agent hookup + highscores), register them once in local dev:

```powershell
# Seed: user
$body = @{ username = 'user'; callsign = 'user' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8787/api/user/register' -ContentType 'application/json' -Body $body

# Seed: admin
$body = @{ username = 'admin'; callsign = 'admin' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8787/api/user/register' -ContentType 'application/json' -Body $body
```

Notes:
- The real auth system is **username-only** in v1 (no password). The `LoginShell` passwords are strictly for the fake nested terminal.
- If a username already exists, registration will fail; use `/api/user/login` instead.

---

## API Endpoints

- `POST /api/user/register` - Create new account
  ```json
  {
    "username": "string (required)",
    "callsign": "string (optional)",
    "email": "string (optional)"
  }
  ```

- `POST /api/user/login` - Login with username
  ```json
  {
    "username": "string"
  }
  ```

- `POST /api/user/logout` - Logout (requires `X-Session-Token` header)
- `GET /api/user/me` - Get current user info (requires `X-Session-Token` header)
- `GET /api/user/inventory` - Get user inventory (requires `X-Session-Token` header)
- `GET /api/user/highscores?game_id=<game>` - Get user highscores

---

## Terminal Commands

- `login` - Show login prompt
- `register` - Show registration prompt
- `logout` - Log out of current account

---

## Implementation Notes

### Security
- Passwords are NOT required in this v1 implementation (per requirements)
- Session tokens are 64-byte random strings with 7-day expiry
- Usernames are case-insensitive and unique
- Email validation is minimal (optional field)

### Future Enhancements
Designed to support:
- WebAuthn/Passkey authentication (tables already created)
- Password-based auth (can be added later)
- Email verification tokens
- Account recovery via email

### Integration Points
- Header updates automatically on login/logout
- `GAMESTATE.loadUserData(...)` is called on login (if GAMESTATE exists)
- Highscore system is ready for Gone Rogue + Street Chronicles
- **Kernel button** can be enabled for logged-in users (agent integration portal)

---

## Troubleshooting

### Migration fails
- Check D1 binding in `wrangler.jsonc`
- Verify database exists: `npx wrangler d1 list`
- Check migration file syntax

### Login/register failing
- Check worker logs (`wrangler dev` output)
- Verify you’re sending valid JSON (see smoke tests)

### Session not persisting
- Check localStorage: key `eyesonly_user_session`
- Verify `X-Session-Token` header is being sent
- Check session expiry (default 7 days)

---

## Architecture

```
Frontend (Vanilla JS)
├── public/js/user-account.js - API client
├── public/js/login-ui.js - Registration/login UI
├── public/js/parser.js - Command parsing
├── public/js/state-machine.js - Command routing
└── public/js/main.js - Integration layer

Backend (Cloudflare Workers/Hono)
├── src/worker/routes/user-auth.ts - API endpoints
├── src/worker/db/user-queries.ts - Database queries
├── src/worker/middleware/auth.ts - Token validation
└── migrations/0002_user_accounts.sql - Schema
```

---

Contact: admin@stellaraqua.com
