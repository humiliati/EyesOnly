# EyesOnly (flapsandseals.com)

**EyesOnly** is the deployed Live ARG / Joint Tactical Training Exercise platform behind **flapsandseals.com**.
It includes:

- **M Console** (`/m`): director console (scenario control, lane grid, event feed, dead drops, ops moderation)
- **Ops UI** (`/ops`): field/ops interface (telemetry, pings, map-first ops dashboard)
- **Gone Rogue**: embedded ASCII stealth roguelike + STR combat
- **Street-Chronicles**: interactive fiction mode (kept separate from Live ARG portal)

## Stack

- Cloudflare Workers + D1 + Durable Objects (ScenarioRoom) + R2
- UI bundles built via **esbuild** (no Vite inside EyesOnly)

## Key architecture decisions (current)

### Account-first identity

- **Account callsign is canonical and immutable**.
- Scenario **actors are account-linked** via `actors.user_id` and should share the account callsign.

### Ops is a scenario-scoped moderator role

- Ops is not a separate identity.
- M grants/revokes ops capability per scenario via `scenario_user_roles`.

### Unified account inventory

- Single account-wide inventory: `user_inventory`.
- Both ARG and Gone Rogue read from the same pool.
- UI should **render instances**, not stacks; internal `quantity>1` is allowed for storage efficiency.

## Dev commands

```sh
npm run typecheck
npm run build:ui       # builds /ops + /m bundles
```

## Useful endpoints (selected)

### Accounts
- `POST /api/user/register`
- `POST /api/user/login`
- `GET /api/user/me`
- `GET /api/user/inventory`
- `GET /api/user/inventory/instances` (instance view; quantity expanded)
- `POST /api/user/inventory/consume` (oldest-first selector supported)
- `POST /api/user/merge-local-data` (import legacy localStorage once per device)

### M (director)
- `POST /api/m/login`
- `GET /api/m/events/:scenarioId`
- `POST /api/m/event`
- `POST /api/m/dead-drop`
- `DELETE /api/m/dead-drop/:id`
- `POST /api/m/inventory/grant` (GRANT dead drop items into account inventory; idempotent)
- `POST /api/m/scenario/user-role` (grant/revoke ops)
- `GET /api/m/scenario/user-roles/:scenarioId?role=ops`

### Ops
- `GET /api/ops/status`
- `GET /api/ops/pings`
- `POST /api/ops/ack`
- `POST /api/ops/telemetry`
- `POST /api/ops/telemetry/visibility` (hide GPS from other ops, not from M)
- `GET /api/ops/actors/positions?team=red` (requires ops moderator role)
- `POST /api/ops/dead-drop` (retrieve emits event with items; M can GRANT)

## Notes

- `README.txt` contains the longer-form lore/feature overview.
