# Kernel Decision API Spec (Tutorial Alpha)

Goal: let a logged-in user connect an external AI agent **by URL only** (easier than OpenClaw setup) and have that agent provide **decisions** during Gone Rogue runs.

**Key principle:** the external agent does **not** execute game actions directly. The browser/game remains the only executor via:
- `HeadlessAdapter.HeadlessGameAdapter`
- `GoneRogue.headless` (real game engine)

So the agent can only select from **legal actions** supplied by the game.

---

## Kernel UI States (canonical)

- **DISCONNECTED**: button shows `KERNEL`
- **CONNECTING**: `CONNECTING…` (spinner optional)
- **CONNECTED**: `CONNECTED: <agent-name>` (highlight)
- **ACTIVE_RUN**: `<agent-name> •` (pulsing indicator)
- **DISMISSING**: `DISMISSING…`
- **ERROR**: show error, return to DISCONNECTED

---

## User Flow (MVP)

1) User logs in → Kernel button becomes enabled.
2) User clicks Kernel → sees interface/help.
3) User types:

```text
KERNEL CONNECT <agent_url>
```

4) Game performs handshake with the agent.
5) When connected, user can start an agent-driven run:

```text
KERNEL RUN
```

Stop/disconnect:

```text
KERNEL DISCONNECT
```

---

## External Agent HTTP Contract (kernel-decision-v1)

### 1) Health / handshake

**GET** `${agent_url}/health`

Response (200):
```json
{
  "ok": true,
  "agent_name": "MyAgent",
  "agent_version": "0.1.0",
  "protocol": "kernel-decision-v1"
}
```

The platform uses this to display `CONNECTED: <agent_name>`.

### 2) Next action

**POST** `${agent_url}/next_action`

Request:
```json
{
  "protocol_version": "kernel-decision-v1",
  "session": {
    "username": "<logged_in_username>",
    "callsign": "<callsign>",
    "agent_name": "<agent_name>",
    "run_id": "<uuid>",
    "tick": 123
  },
  "observation": {
    "floor": 4,
    "hp": 72,
    "position": {"x": 10, "y": 6},
    "legal_actions": [
      {"type": "move", "direction": "north"},
      {"type": "pickupCurrency"},
      {"type": "wait"}
    ],
    "ux_hints": {
      "lighting": "dim",
      "ground_effect": "none"
    }
  }
}
```

Response:
```json
{
  "action": {"type": "move", "direction": "north"},
  "commentary": "Exploring north.",
  "debug": {"reason": "unvisited tile bias"}
}
```

Rules:
- The agent **must** return an action that is present in `legal_actions`.
- If no decision is possible, return `{ "action": { "type": "wait" } }`.

---

## Security Notes (MVP)

- The game enforces fairness by only accepting actions from `legal_actions`.
- For MVP, connection is by URL only. If/when needed:
  - add a platform-minted opaque bearer token for agent endpoint auth
  - store it per-user in D1

---

## Implementation Notes (as-built)

- Built-in agent takeover is separate (`AGENT NATURAL`, `AGENT DEVELOPER`).
- Kernel is the UX surface for external agent decision APIs.
- Terminal routing must implement: `KERNEL CONNECT|STATUS|RUN|DISCONNECT`.
