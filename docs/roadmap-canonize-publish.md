# EYES ONLY — Canonize / Publish Roadmap

Reference doc for the M→Ops map publishing pipeline and draft-vs-live divergence system.

**STATUS: Items 1–4 IMPLEMENTED.** Item 5 (Publish History) remains a stretch goal.

---

## 1. Published vs. Working State ✅ IMPLEMENTED

**Goal**: M assembles and iterates on a scenario map freely. Ops only sees
the last "canonized" snapshot — never M's in-progress edits.

### Schema change (DEPLOYED)
```sql
ALTER TABLE scenarios ADD COLUMN published_config TEXT DEFAULT NULL;
ALTER TABLE scenarios ADD COLUMN published_at INTEGER DEFAULT NULL;
```

- `config` = M's live working draft (current behavior, no change)
- `published_config` = frozen snapshot that Ops reads from
- `published_at` = timestamp of last publish

### Endpoint: `POST /api/m/scenario/publish` (LIVE)
1. Deep-copy `config` → `published_config` (grid, nodes, connections, map_key)
2. Set `published_at = Date.now()`
3. Broadcast `map_published` event via ScenarioRoom WebSocket
4. Return `{ ok: true, published_at, diff_summary }`

### Ops reads published state (LIVE)
`GET /api/ops/map` reads from `published_config` instead of `config`.
If `published_config` is null, falls back to `config` (backwards compat).

---

## 2. PUBLISH MAP Button (M Console) ✅ IMPLEMENTED

Located in the Controls panel under a dedicated PUBLISH MAP `ctrl-box` section.

- **PUBLISH TO OPS** button triggers `POST /api/m/scenario/publish`
- Displays last published timestamp after successful publish
- Styled with `ctrl-box` bordered section matching other control panels
- Broadcasts `map_published` to all connected clients via WebSocket

---

## 3. Draft vs. Live Divergence Display ✅ IMPLEMENTED

### What M sees on the command map

| Layer | Source | Visual |
|-------|--------|--------|
| Map image | Working draft | Normal render |
| Grid cells + status | Live from DB | Solid borders, status colors |
| Scenario nodes | Working draft positions | Solid icons |
| Published node ghosts | `published_config` positions | Dotted outline, 40% opacity |
| Actor telemetry | Real-time GPS → cell mapping | Blue pulsing dots |
| Dead drops | Working draft positions | Amber diamond |
| Published drop ghosts | `published_config` positions | Dotted amber, faded |

Ghost markers compare `cachedPublishedNodes` vs `cachedScenarioNodes` on each grid render. They appear only when M has moved a node since last publish. After publish, all ghosts clear (working = published).

### What Ops sees
- Map image from `published_config.map_key`
- Grid from `published_config.grid`
- Nodes from `published_config.nodes` (read-only, no ghosts)
- Live actor telemetry (real-time, same as M)
- 15-second polling refresh (existing behavior)

---

## 4. M Live Editing During Play ✅ IMPLEMENTED

M can drag-move nodes across cells mid-game:
- Click a node marker on the grid → enters "move mode" (cursor changes)
- Click the destination cell → node relocates in working draft
- Server call `PATCH /api/m/map/scenario/node` updates the node's cell
- Ghost remains at published position until next publish
- Grid re-renders immediately to show the new position

---

## 5. Publish History ✅ IMPLEMENTED

Versioned publish snapshots stored in R2 as JSON. Enables rollback and post-game replay analysis.

### R2 Storage
- Key pattern: `scenarios/{id}/published/{timestamp}.json`
- Each snapshot includes: full config, published_at, published_by, diff_summary
- Custom metadata on R2 object for fast listing without downloading payloads

### Endpoints
- `GET /api/m/scenario/:id/publish-history` — list all snapshots (newest first), returns metadata only
- `POST /api/m/scenario/publish-rollback` — restore a previous snapshot
  - `restore_working: false` (default) — restores published_config only, M's draft stays
  - `restore_working: true` — restores BOTH published_config and working config

### M Console UI
- **PUBLISH HISTORY** toggle button below the publish section
- Collapsible panel showing all snapshots with date, author, diff summary, size
- **ROLLBACK** button per snapshot — restores Ops published map only
- **RESTORE** button per snapshot — restores both Ops published map AND M's working draft
- Both require confirmation dialog before executing
- MOK advisory logged on rollback

---

## Priority

1. ~~**Zoom + detail system**~~ ✅ DONE — pan/zoom transform layer on UGRS grid
2. ~~**Publish endpoint + button**~~ ✅ DONE — `POST /api/m/scenario/publish`
3. ~~**Ghost markers for divergence**~~ ✅ DONE — dotted 40% opacity ghost nodes
4. ~~**Drag-move nodes mid-game**~~ ✅ DONE — click node → click destination cell
5. ~~**Publish history**~~ ✅ DONE — R2-backed versioned snapshots with rollback UI
