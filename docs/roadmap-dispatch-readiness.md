# EYES ONLY — Dispatch & Readiness System

Bridges the gap between M's scenario assembly and live deployment.
Flags shortages, tracks dispatch state, and audits the full lifecycle.

**STATUS: ALL ITEMS IMPLEMENTED.** Roadmap complete.

---

## Problem

M builds a scenario: places nodes, dead drops, calibrates the grid, publishes.
But nothing currently validates that the scenario is *staffable*. If a scenario
has 6 objective nodes and 4 dead drops with items, M needs to know:

- Do we have enough actors (by team) to staff the lanes/nodes?
- Are all dead drops loaded with the required items?
- Are join codes generated for both teams?
- Has the map been published so Ops can see it?

When M clicks "DEPLOY," there should be a pre-flight check — like a launch
sequence — that flags shortages and blocks deployment until resolved (or M
explicitly overrides). After deploy, every state change gets logged to a
dispatch audit trail for post-game analysis.

---

## 1. Scenario Requirements (config.requirements) ✅ IMPLEMENTED

`scenario.config` now includes a requirements block:

```json
{
  "grid": { ... },
  "nodes": [ ... ],
  "requirements": {
    "min_red": 4,
    "min_blue": 2,
    "min_staff": 1,
    "drops_must_have_items": true,
    "require_published": true,
    "custom_checks": [
      { "label": "Briefing doc uploaded", "key": "briefing_ready" },
      { "label": "Comms channel tested", "key": "comms_tested" }
    ]
  }
}
```

These are editable by M in a REQUIREMENTS section of the controls panel.
Defaults are sensible (min_red: 1, min_blue: 0, etc.) so M doesn't have
to configure anything for simple scenarios.

---

## 2. Readiness Checker ✅ IMPLEMENTED

### Endpoint: `GET /api/m/scenario/:id/readiness` (LIVE)

Server-side `computeReadiness()` cross-references requirements against live state:

```json
{
  "ready": false,
  "checks": [
    { "key": "red_actors",    "label": "Red team actors",   "required": 4, "actual": 2, "pass": false },
    { "key": "blue_actors",   "label": "Blue team actors",  "required": 2, "actual": 3, "pass": true },
    { "key": "staff_actors",  "label": "Staff actors",      "required": 1, "actual": 1, "pass": true },
    { "key": "join_codes",    "label": "Join codes exist",  "required": true, "actual": true, "pass": true },
    { "key": "grid_calibrated","label": "Grid calibrated",  "required": true, "actual": true, "pass": true },
    { "key": "map_published", "label": "Map published",     "required": true, "actual": false, "pass": false },
    { "key": "drops_loaded",  "label": "Dead drops loaded", "required": 3, "actual": 2, "pass": false,
      "detail": "Drop 'ALPHA-PKG' has 0 items" },
    { "key": "briefing_ready","label": "Briefing doc uploaded", "required": true, "actual": false, "pass": false }
  ],
  "shortages": {
    "red_actors": 2,
    "drops_empty": ["ALPHA-PKG"]
  }
}
```

Logic is server-side — counts actors by team/kind, checks dead drops for
items_json != '[]', verifies published_config exists, checks join_codes table.
Checks grid calibration, node presence, and custom requirement keys.

---

## 3. Dispatch Lifecycle ✅ IMPLEMENTED

Scenario status flow:

```
draft → staged → deployed → active → paused → completed → archived
          ↑                                        ↓
          └────────── (re-deploy) ─────────────────┘
```

New states:
- **staged** — M has run readiness checks, is in pre-flight
- **deployed** — M has dispatched; Ops can join and see the map

### Dispatch action: `POST /api/m/scenario/dispatch` (LIVE)

1. Run readiness checks server-side
2. If not ready: return `{ ok: false, checks, shortages }`
   - M can override with `{ force: true }` to deploy anyway
3. If ready (or forced):
   - Set scenario status = 'deployed'
   - Auto-publish if not already published
   - Create dispatch_audit record
   - Broadcast `scenario_dispatched` to all WS clients
   - Return `{ ok: true, dispatch_id, timestamp }`

---

## 4. Dispatch Audit Trail ✅ IMPLEMENTED

### Schema (DEPLOYED)

```sql
CREATE TABLE dispatch_audit (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id   INTEGER NOT NULL REFERENCES scenarios(id),
  action        TEXT NOT NULL,
  actor_id      INTEGER REFERENCES actors(id),
  detail        TEXT NOT NULL DEFAULT '{}',
  created_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX idx_dispatch_audit_scenario ON dispatch_audit(scenario_id, created_at);
```

Actions logged:
- `dispatch` — M clicked deploy (with readiness snapshot)
- `dispatch_override` — M forced deploy despite shortages
- `publish` — map published (links to publish timestamp)
- `actor_joined` — player joined via join code
- `actor_departed` — player disconnected / removed
- `status_change` — scenario status changed
- `requirement_updated` — M changed requirements
- `node_moved` — node moved mid-game
- `freeze` / `unfreeze`

Each record stores a JSON `detail` blob with the relevant context
(who, what changed, readiness state at time of action).

---

## 5. M Console: READINESS & DISPATCH Panel ✅ IMPLEMENTED

Located in the Controls panel as a `ctrl-box` section.

### Readiness Dashboard
- Shows all checks as `.readiness-row` items with ✓/✗ icons
- Pass items show green icon; fail items show red icon with amber detail
- **RECHECK** button fetches latest readiness from server
- Readiness rows use semantic CSS classes instead of inline styles

### DISPATCH Button
- Located below readiness checks
- DISPATCH and FORCE DISPATCH options
- On dispatch: broadcasts `scenario_dispatched` to all WS clients
- Status badge updates to DEPLOYED

### REQUIREMENTS Section
- Editable `min_red`, `min_blue` fields with flex-layout inputs
- Styled with `ctrl-box` class matching other control sections
- Save button persists requirements to `config.requirements`

---

## 6. EyesOnlyLive Integration Points

The watch app (EyesOnlyLive) needs to know:
- Scenario is deployed (not just draft)
- Which nodes/drops are active for the player's team
- When M re-dispatches mid-game

This is already handled by `published_config` — Ops reads the published
snapshot. The dispatch system adds a status gate: Ops can only load the
map when `scenario.status` is 'deployed' or 'active'. The watch app's
`gameStateSync` should check for the `scenario_dispatched` WS event
to trigger a full refresh.

---

## Priority

1. ~~**Readiness endpoint**~~ ✅ DONE — `GET /api/m/scenario/:id/readiness` with `computeReadiness()`
2. ~~**Dispatch endpoint + audit table**~~ ✅ DONE — `POST /api/m/scenario/dispatch` + `dispatch_audit` table
3. ~~**M console readiness panel**~~ ✅ DONE — `.readiness-row` items with RECHECK button
4. ~~**Dispatch button**~~ ✅ DONE — with pre-flight gate and force override
5. ~~**Audit trail viewer**~~ ✅ DONE — `GET /api/m/scenario/:id/audit-trail` with M console viewer panel
