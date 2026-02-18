# Kernel Server-Side Persistence TODO (Tutorial Alpha)

Goal: persist Kernel external-agent connection state server-side so that:
- user stays connected across refresh/device
- leaderboards can attribute runs to connected agents
- users can manage/revoke connected agents

This is for the **Decision API** architecture (browser executes actions, agent returns decisions).

---

## 1) Data model (D1-friendly)

### Table: `kernel_agents`
Stores the user’s saved agent endpoints.

Suggested schema:

```sql
CREATE TABLE IF NOT EXISTS kernel_agents (
  id TEXT PRIMARY KEY,                -- uuid
  user_id INTEGER NOT NULL,           -- user_accounts.id (current schema appears integer)
  agent_name TEXT,                    -- last known agent name (from /health)
  agent_url TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_connected_at INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_kernel_agents_user ON kernel_agents(user_id);
```

### Table: `kernel_sessions`
Stores the current/last session state.

```sql
CREATE TABLE IF NOT EXISTS kernel_sessions (
  id TEXT PRIMARY KEY,                -- uuid
  user_id INTEGER NOT NULL,
  kernel_agent_id TEXT,               -- FK to kernel_agents.id
  status TEXT NOT NULL,               -- DISCONNECTED|CONNECTING|CONNECTED|ACTIVE_RUN|DISMISSING|ERROR
  last_error TEXT,
  connected_at INTEGER,
  disconnected_at INTEGER,
  last_seen_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kernel_sessions_user ON kernel_sessions(user_id);
```

Notes:
- Use INTEGER millis timestamps (matches existing tables in local D1).
- Keep it simple; no OAuth.

---

## 2) Server endpoints

All endpoints require normal user auth (`X-Session-Token`) and operate on the currently logged-in user.

- `GET /api/kernel/me`
  - returns persisted kernel state (agent_url, agent_name, status)

- `POST /api/kernel/connect`
  - body: `{ agent_url: string }`
  - server stores/updates `kernel_agents` and `kernel_sessions`
  - optional: server performs health-check fetch (or leave to client)

- `POST /api/kernel/disconnect`
  - marks session disconnected

- `GET /api/kernel/agents`
  - list saved agents for user

- `DELETE /api/kernel/agents/:id`
  - soft delete

---

## 3) Client integration

- On login success (`login-ui.js`):
  - call `GET /api/kernel/me`
  - if status CONNECTED/ACTIVE_RUN, restore KernelManager state and update button label

- On logout:
  - clear local KernelManager state

---

## 4) Security / abuse controls

Even for Decision API, we should add:
- rate limit connect/disconnect attempts
- validate agent_url scheme (https in production; allow http://127.0.0.1 for local)
- store only sanitized URL

---

## 5) Future: attach to highscores

When highscore submission happens:
- include `kernel_agent_id` (nullable)
- include `agent_name` snapshot

This enables mixed human/agent leaderboards with attribution.
