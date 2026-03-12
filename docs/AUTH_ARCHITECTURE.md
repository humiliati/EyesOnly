# Auth Architecture — EyesOnly / Flaps & Seals

**Last updated**: 2026-03-10
**Status**: Canonical reference for all auth-related work

---

## READ THIS FIRST

This system has **two separate authentication layers** that serve different purposes. They are **not duplicates**, they are **not unfinished**, and merging them would break the architecture. If you are a contractor or contributor touching auth code, read this document before making changes.

**Known contractor pitfalls** (things that look broken but aren't):

1. **"Login has no password"** — Intentional. The user account system is username-only right now. Password auth is a future/optional feature, not a bug. Do not add password fields to the registration or login endpoints unless explicitly tasked.

2. **"There are two token systems"** — Correct. `user_sessions` (account tokens) and `auth_tokens` (scenario actor tokens) are distinct by design. One is your persistent identity, the other is your role in a live scenario. Do not merge them.

3. **"The seed script creates accounts named 'user' and 'admin'"** — These are local dev test fixtures in `scripts/seed-local-test-accounts.ps1`. They are not production accounts, not placeholder TODOs, and not security vulnerabilities.

4. **"The filesystem has TODOs about hiding credentials"** — That is **in-game ARG fiction**. The file `/home/user/todo.txt` with `[TODO][IT] hide hardcoded credentials before launch` is flavor text for the immersive terminal. It is not a real TODO. Do not "fix" it.

5. **"There's an /home/admin directory with ACCESS DENIED"** — Also ARG fiction. The default user filesystem in `user-queries.ts` is a fake filesystem rendered in the game's terminal UI. It has nothing to do with real server access controls.

---

## Layer 1: User Accounts (Persistent Identity)

**Purpose**: Long-lived player identity that persists across scenarios, devices, and game modes.

### Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/user/register` | None | Create account (username + optional callsign/email) |
| POST | `/api/user/login` | None | Login by username, get session token |
| POST | `/api/user/logout` | X-Session-Token | Invalidate session |
| GET | `/api/user/me` | X-Session-Token | Current user profile |
| GET | `/api/user/inventory` | X-Session-Token | Account-wide inventory |
| GET | `/api/user/inventory/instances` | X-Session-Token | Expanded instance view |
| POST | `/api/user/inventory/consume` | X-Session-Token | Consume items (oldest-first) |
| POST | `/api/user/merge-local-data` | X-Session-Token | Import localStorage state |
| GET | `/api/user/highscores` | X-Session-Token | Player highscores |
| GET | `/api/user/filesystem` | X-Session-Token | ARG immersive filesystem |
| PUT | `/api/user/filesystem` | X-Session-Token | Update ARG filesystem |

### Token mechanics

- **Header**: `X-Session-Token: <token>`
- **Token format**: 64-character hex string (32 random bytes)
- **Storage**: `user_sessions` table, plaintext token (not hashed)
- **Expiry**: 7 days from creation
- **Session refresh**: `last_activity` updated on every validated request; expired sessions are deleted on access

### Registration rules

- Username: 3–20 characters, alphanumeric + underscore, case-insensitive unique
- Callsign: derived from username or explicit param, uppercased, unique with `-2`/`-3` suffix fallback
- **Callsign is immutable** — it is the canonical identity across all systems
- No password required (username-only auth for current phase)
- No email required (optional, for future recovery)

### Key files

- `src/worker/routes/user-auth.ts` — All user account endpoints
- `src/worker/db/user-queries.ts` — Database operations (CRUD, sessions, inventory, highscores, filesystem)
- `migrations/0002_user_accounts.sql` — Schema: `user_accounts`, `user_sessions`, `webauthn_credentials`, `user_inventory`, `user_highscores`, `email_tokens`

### What the account owns

- **Cryptos** (in-game currency) — account-level, shared across game modes
- **Inventory** (`user_inventory`) — persistent and loose items, account-wide
- **Highscores** (`user_highscores`) — per-game, per-mode (human/agent)
- **Preferences** (JSON blob) — theme, SFX, cloud sync, filesystem
- **Immersive filesystem** — stored inside preferences, used by the ARG terminal UI

---

## Layer 2: Scenario Actors (Ephemeral Role)

**Purpose**: Role-scoped identity within a specific live scenario (CTF exercise). An actor is what you *are* during a particular operation.

### Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/join` | Bearer (user session) | Join scenario via join code, creates actor |
| POST | `/api/auth/login` | None | Blue Team/Director login with callsign + password |
| * | `/api/ops/*` | Bearer (actor token) | Field operative endpoints |
| * | `/api/m/*` | Bearer (actor token) + Director role | Mission director endpoints |

### Token mechanics

- **Header**: `Authorization: Bearer <token>`
- **Token format**: 64-character hex string, stored as SHA-256 hash in `auth_tokens`
- **Expiry**: 7 days default
- **Validation**: `requireAuth` middleware in `src/worker/middleware/auth.ts`

### The join flow

1. Player must have a **user account session** first (Layer 1)
2. Player calls `POST /api/join` with a join code + their user session token
3. Server creates (or reuses) an **actor** linked to their account (`actors.user_id`)
4. Server returns an **actor token** scoped to that scenario + team
5. All subsequent scenario operations use the actor token

### Actor properties

- `actor_id` — unique within the scenario
- `callsign` — inherited from the user account (canonical)
- `team` — `red`, `blue`, or `director`
- `scenario_id` — which operation this actor belongs to
- `user_id` — nullable link back to persistent account
- `actor_kind` — `player`, `staff`, `npc`, or `business`

### Director/Blue Team login

Directors and Blue Team members can also log in via `POST /api/auth/login` with callsign + password (SHA-256 hashed, stored on the actor record). This is a **separate path** from user account login — it authenticates a pre-created scenario actor, not a persistent user account.

### Role enforcement

- `requireAuth` — validates actor token, attaches `AuthContext` to request
- `requireDirector` — checks `role === 'director'` after `requireAuth`
- **Ops moderator role**: `scenario_user_roles` table grants per-scenario moderator access, checked by `hasScenarioUserRole`

### Key files

- `src/worker/routes/public.ts` — Join and director login
- `src/worker/routes/ops.ts` — Field operative routes
- `src/worker/routes/m-mode.ts` — Director/M console routes
- `src/worker/middleware/auth.ts` — `requireAuth`, `requireDirector`
- `src/worker/db/queries.ts` — `validateToken`, `createAuthToken`, `createActor`, `getActor`
- `migrations/0001_init.sql` — Schema: `actors`, `auth_tokens`, `join_codes`
- `migrations/0009_actor_user_link_and_roles.sql` — `actors.user_id` link, `scenario_user_roles`
- `migrations/0010_actor_kind.sql` — `actors.actor_kind` classification

---

## How the Two Layers Connect

```
┌─────────────────────────────────────────────────────┐
│  USER ACCOUNT (Layer 1)                             │
│  ─────────────────────                              │
│  Persistent identity: username, callsign, cryptos,  │
│  inventory, highscores, preferences                 │
│  Auth: X-Session-Token                              │
│                                                     │
│  ┌─────────────────┐  ┌─────────────────┐           │
│  │ Scenario Actor A │  │ Scenario Actor B │  ...     │
│  │ (Layer 2)        │  │ (Layer 2)        │          │
│  │                  │  │                  │          │
│  │ Op: SANDPOINT    │  │ Op: BLACKSITE    │          │
│  │ Team: red        │  │ Team: blue       │          │
│  │ Auth: Bearer tok │  │ Auth: Bearer tok │          │
│  └─────────────────┘  └─────────────────┘           │
└─────────────────────────────────────────────────────┘
```

- A user account can have **many actors** across different scenarios
- An actor is always linked to **one scenario** and **one team**
- The `user_id` field on `actors` and `auth_tokens` threads the account link through
- Inventory grants from scenario ops flow into the **account-level** `user_inventory`
- The account callsign is used as the actor callsign (it's canonical and immutable)

---

## Route Mounting (index.ts)

```
/api          → publicRoutes    (join, director login, health)
/api/user     → userAuthRoutes  (account registration, login, inventory, etc.)
/api/ops      → opsRoutes       (field operative — requires actor token)
/api/m        → mModeRoutes     (director console — requires actor token + director role)
/api/kernel   → kernelRoutes    (external agent/Decision API integration)
/audio        → audioRoutes     (R2-served audio assets)
/api/audio    → audioUploadRoutes (media designer portal)
```

CORS on `/api/*` allows both `Authorization` and `X-Session-Token` headers.

---

## ARG Fiction vs Real Code

The EyesOnly terminal has an immersive fake filesystem that new accounts get by default. This is **game content**, not server infrastructure.

### Intentional ARG content (DO NOT "fix"):

| Location | Content | Why it exists |
|----------|---------|---------------|
| `user-queries.ts` line 56 | `[TODO][IT] hide hardcoded credentials before launch` | In-game IT guy's TODO list, rendered in the ARG terminal |
| `user-queries.ts` line 57 | `IT GUY NOTE: if this file is visible, permissions are "working as intended"` | ARG flavor text |
| `user-queries.ts` line 58 | `ENTRY: SANDPOINT COVER HOLDS. TERMINAL TRAFFIC INCREASING.` | In-game field journal |
| `user-queries.ts` line 60 | `ACCESS DENIED FOR NON-ADMIN SESSIONS` | Fake admin audit log in the ARG filesystem |
| `user-queries.ts` line 62 | `ALL OPERATIONS ARE FICTIONAL. ALL LOCATIONS ARE REAL.` | ARG disclaimer / fourth-wall break |

These are stored in the `preferences.filesystem` JSON blob per user account. They are rendered client-side by the login shell terminal UI. They have zero relationship to actual server permissions, credentials, or admin access.

### Real TODOs (things that actually need work):

See `docs/CRITICAL_TODOS_AND_BLOCKERS.md` and the inline TODO table in that document.

---

## Test Accounts

### Local dev seed script

`scripts/seed-local-test-accounts.ps1` creates two accounts against `localhost:8787`:

| Username | Callsign | Purpose |
|----------|----------|---------|
| `user` | `USER` | Generic test player account |
| `admin` | `ADMIN` | Generic test director/admin account |

These are **local development fixtures only**. The script uses `POST /api/user/register` and falls back to `POST /api/user/login` if they already exist. They have no special privileges — "admin" is just a username, not a role. Roles are granted per-scenario via `scenario_user_roles` or by creating an actor with `team: 'director'`.

There are no hardcoded backdoor accounts, no default passwords, no production admin seeds.

---

## Current Auth Limitations (Intentional for This Phase)

These are **known and accepted** for the current development phase. Do not treat them as bugs.

1. **No password on user accounts** — Registration and login are username-only. Password auth, WebAuthn, and email verification are schema-ready (`webauthn_credentials`, `email_tokens` tables exist) but not wired to endpoints yet.

2. **Session tokens stored plaintext** — `user_sessions.session_token` is not hashed. `auth_tokens.token_hash` IS hashed (SHA-256). This inconsistency is known; the user session table should eventually hash tokens too.

3. **No rate limiting** — Registration and login have no rate limiting beyond what Cloudflare provides at the edge.

4. **No CSRF protection** — API is token-based (no cookies for auth), so CSRF is not currently a vector, but worth noting.

5. **X-Session-Token vs Authorization Bearer** — User account routes use `X-Session-Token` header. Scenario routes use `Authorization: Bearer`. The `/api/join` endpoint reads a Bearer token but treats it as a user session token. This is the main source of confusion and is documented here so you don't have to reverse-engineer it.

---

## Future Auth Work (Deferred)

These items are captured in `USER_ACCOUNT_CREATION_TODO.md` and `CRITICAL_TODOS_AND_BLOCKERS.md` as future/optional:

- Password-based authentication
- M Console auth code generator (6-digit codes for registration)
- WebAuthn/passkey enrollment and login
- Email verification and account recovery
- OAuth/SSO (Google, GitHub, Discord)
- Agent API key management (encrypted at rest)
- Session token hashing for user_sessions
- Rate limiting on auth endpoints

Do not start any of these without explicit tasking and a design review.
