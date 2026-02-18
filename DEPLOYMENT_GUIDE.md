# User Account System Deployment Guide

## Overview
This implementation adds a username-based user account system to flapsandseals.com, allowing players to:
- Register accounts with username (required), callsign (optional), and email (optional)
- Log in/out using just their username
- Persist game data, inventory, and highscores across sessions
- Track accountability status in the header

## Deployment Steps

### 1. Deploy Database Migration

Run the migration to create the new user account tables:

```bash
# For local development
wrangler d1 execute eyesonly-db --local --file=migrations/0002_user_accounts.sql

# For production
wrangler d1 execute eyesonly-db --file=migrations/0002_user_accounts.sql
```

This creates the following tables:
- `user_accounts` - User profiles
- `webauthn_credentials` - For future passkey support
- `user_sessions` - Session tokens
- `user_inventory` - Player inventory items
- `user_highscores` - Game scores
- `email_tokens` - For email verification/recovery

### 2. Deploy Worker Code

```bash
# Build UI components (optional if not modified)
npm run build:ui

# Deploy to Cloudflare Workers
npm run deploy
```

### 3. Test the System

Visit https://flapsandseals.com and test the following:

1. **Registration Flow**
   - Type `register` in the terminal
   - Enter username (3-20 chars, alphanumeric + underscore)
   - Optional: Enter callsign (defaults to username)
   - Optional: Enter email for recovery
   - Account should be created and you'll be logged in automatically

2. **Login Flow**
   - Type `logout` to log out
   - Type `login` to log back in
   - Enter your username
   - You should be logged in and see your callsign in the header

3. **Header Display**
   - When logged in: Green accountability dot, shows your callsign
   - When logged out: Red accountability dot, shows "[guest]"

4. **Session Persistence**
   - Refresh the page while logged in
   - You should remain logged in (session stored in localStorage)

## API Endpoints

The following new endpoints are available:

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

- `POST /api/user/logout` - Logout (requires X-Session-Token header)

- `GET /api/user/me` - Get current user info (requires X-Session-Token header)

- `GET /api/user/inventory` - Get user inventory (requires X-Session-Token header)

- `GET /api/user/highscores?game_id=<game>` - Get user highscores

## Terminal Commands

New commands added to the terminal:

- `login` - Show login prompt
- `register` - Show registration prompt
- `logout` - Log out of current account

## Implementation Notes

### Security
- Passwords are NOT required in this v1 implementation (per requirements)
- Session tokens are 64-byte random strings with 7-day expiry
- Usernames are case-insensitive and unique
- Email validation is minimal (optional field)

### Future Enhancements
The system is designed to support:
- WebAuthn/Passkey authentication (tables already created)
- Password-based auth (can be added easily)
- Email verification tokens
- Account recovery via email

### Integration Points
- Header updates automatically on login/logout
- GAMESTATE can be integrated to save game data
- Highscore system ready for Gone Rogue and Street Chronicles
- Kernel button can be enabled for logged-in users

## Troubleshooting

### Database Migration Fails
- Check that the D1 database binding is correct in wrangler.jsonc
- Verify database exists: `wrangler d1 list`
- Check migration file syntax

### Login Not Working
- Check browser console for API errors
- Verify worker deployed successfully: `wrangler tail`
- Check that CORS headers are working (should allow all origins)

### Session Not Persisting
- Check localStorage in browser dev tools (key: `eyesonly_user_session`)
- Verify session token is being sent in X-Session-Token header
- Check session expiry (default 7 days)

## Architecture

```
Frontend (Vanilla JS)
├── user-account.js - API client
├── login-ui.js - Registration/login UI
├── parser.js - Command parsing (LOGIN, REGISTER, LOGOUT)
├── state-machine.js - Command routing
└── main.js - Integration layer

Backend (Cloudflare Workers/Hono)
├── routes/user-auth.ts - API endpoints
├── db/user-queries.ts - Database queries
├── middleware/auth.ts - Token validation
└── migrations/0002_user_accounts.sql - Schema
```

## Contact

For issues or questions: admin@stellaraqua.com
