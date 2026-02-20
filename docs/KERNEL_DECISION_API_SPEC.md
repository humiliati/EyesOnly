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

### 3) Turn Envelope (kernel-turn-envelope-v1)

To support the Sundog three-phase envelope, agents can opt into a richer contract that batches actions:

**POST** `${agent_url}/turn_envelope`

Request:
```json
{
  "protocol_version": "kernel-turn-envelope-v1",
  "session": { "callsign": "player1", "agent_name": "MyAgent", "tick": 12 },
  "envelope": {
    "envelopeId": "env-123",
    "turnNumber": 12,
    "timestamp": 1700000000000,
    "perception": {
      "spatial": { "visibleRadius": 5, "tileCounts": { "walkable": 90, "obstacles": 6, "enemies": 1, "items": 2 }, "pathAssessment": "contested", "corridorComplexity": 3 },
      "inventory": { "keys": 0, "currency": 12, "cardsInHand": 5, "activeEffects": [], "equipmentState": { "activeItem": "flashbang" } },
      "threats": { "count": 1, "nearest": { "type": "graveling", "distance": 2 } },
      "temporal": { "floor": 4, "turn": 12, "bossFloor": false, "strCombat": false },
      "legalActions": [ { "type": "move", "direction": "north", "dx": 0, "dy": -1 }, { "type": "pickupCurrency" }, { "type": "wait" } ],
      "utilityFrame": { "axis": "survival", "rationale": "Visible threat" }
    },
    "utilityFrame": { "axis": "survival", "rationale": "Visible threat" },
    "execution": { "legalActions": [ { "type": "move", "direction": "north", "dx": 0, "dy": -1 }, { "type": "pickupCurrency" }, { "type": "wait" } ], "suggestedBatchSize": 3 }
  }
}
```

Response:
```json
{
  "utility": { "axis": "survival", "rationale": "Enemy nearby" },
  "commentary": "Stride north until contest.",
  "execution": {
    "actions": [
      { "type": "move", "direction": "north", "dx": 0, "dy": -1 },
      { "type": "move", "direction": "north", "dx": 0, "dy": -1 }
    ],
    "stop": { "onEnemy": true, "onDamage": true, "maxActions": 2 }
  }
}
```

Rules:
- `execution.actions` must be a subset of provided `legalActions`.
- Stop conditions are optional; defaults halt on damage/enemy or when the batch is exhausted.
- Clients fall back to `POST /next_action` if this endpoint is missing or returns no batch.

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
