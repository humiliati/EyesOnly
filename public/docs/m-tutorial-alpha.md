# EYES ONLY -- M MODE DIRECTOR TUTORIAL (ALPHA)

## Interface Quick Reference

This document maps the M Tutorial design against the live M Mode console at `flapsandseals.com/m/`. It covers what M sees, what M can do, and how each tutorial moment maps to a specific UI action.

---

## 1. LOGGING IN

**URL:** `https://flapsandseals.com/m/`

1. Enter your **CALLSIGN** (must be a director-team actor, e.g. `M`)
2. Enter your **PASSWORD**
3. Enter **SCENARIO ID** (default: `1`)
4. Press **AUTHENTICATE**

On success the full director console loads with the UGRS grid, event feed, MOK indicator, operation bar, and controls panel.

---

## 2. CONSOLE LAYOUT

After login, the screen is divided into:

### Header Row
- **M MODE** title (left)
- **MOK HUD** -- the green triangle SVG indicator (110×24px inline SVG). States: idle (dim), monitoring (gentle pulse), advisory (flash), urgent (rapid flash), engaged (solid glow). Includes animated glow band sweep and scanlines.
- **Squelch Controls** (F/Q/T/S buttons): Full, Quiet (critical only), Tactical (actionable only), Silent (triangle flashes, no text)
- **Scenario name**, your callsign, WebSocket status dot (green=live, red=offline)
- **FREEZE GAME** button (red border) -- gains a red alarm badge when Ops raises alarms (see section 26: ALARM AD[M]IN System)
- **SCENARIO DESIGNER** link (opens `/m/scenario-designer.html`)
- **LOGOUT** button

### Operation Bar
Persistent metrics below the header, updated every second:
- **ELAPSED** -- HH:MM:SS timer since console load
- **THREAT** -- LOW (green) / OPTIMAL (amber) / HIGH (red) / CRITICAL (red glow) -- derived from average grid cell tension
- **ACTORS** -- deployed/total count
- **TENSION** -- average tension percentage across all cells
- **CELLS** -- total grid cells

### Three-Column Layout
| Column | Purpose |
|--------|---------|
| **Left: COMMAND MAP** | UGRS grid overlay on map image. Click cells to inspect. Drag-drop map images. |
| **Center: EVENT FEED + MOK FEED** | Chronological event log (top), MOK private advisory feed (bottom) |
| **Right: CONTROLS** | Context-sensitive panel that changes based on what you're doing |

---

## 3. THE UGRS GRID (Urban Grid Reference System)

The map is divided into a coordinate grid (e.g. 6 columns A-F, 4 rows 1-4 = 24 cells: A1, B3, F4, etc.).

### Cell Visual States
| Status | Color | Meaning |
|--------|-------|---------|
| working | Green tint | Normal operations |
| degraded | Amber tint + pulse | Needs attention |
| compromised | Red tint + pulse | Active threat |
| offline | Grey | Not in play |
| unknown | Dark | Not yet assessed |

### Cell Contents
- **Actor badges** (colored by team: blue, red, director)
- **Dead drop markers** (amber diamonds)
- **Scenario node markers** (★ waypoint, ⚑ objective, ⚡ trigger, ● spawn, ⚠ hazard, ♦ intel-drop) -- color-coded by status: grey=pending, green=active, blue=completed, red=failed
- **Tension bar** at bottom of cell (green < 40%, amber < 70%, red >= 70%)
- **Lane tag** (top-right, e.g. "ALPHA")
- Cells with scenario nodes have **dashed borders**

### Grid Calibration
In the Controls panel (overview mode):
1. Set **COLS** and **ROWS**
2. Click **CALIBRATE** -- this creates all grid cells with UGRS coordinates
3. Upload a map image (drag-drop or button) -- images are stored in R2 cloud storage

---

## 4. MAP UPLOAD & R2 STORAGE

Map images are now uploaded to Cloudflare R2 for persistent cloud storage.

### Upload Methods
- **Drag-drop** a map image directly onto the command map area
- **UPLOAD MAP IMAGE** button in Controls → opens file picker

### How It Works
1. Image uploads to `POST /api/m/map/upload` (multipart, authenticated)
2. Stored in R2 bucket at `maps/{scenario_id}/{filename}`
3. URL cached in localStorage for quick re-renders
4. On console load, `GET /api/m/map/{scenarioId}` fetches the map URL from R2
5. If R2 is unavailable, localStorage fallback is used

### Supported Formats
jpg, jpeg, png, webp, svg -- max 10MB

---

## 5. SCENARIO NODES

Scenario nodes are tactical waypoints placed on UGRS cells. They represent the operational graph of a scenario -- objectives, triggers, spawn points, hazards, and intel drops.

### Node Types
| Icon | Type | Purpose |
|------|------|---------|
| ★ | Waypoint | Movement target or reference point |
| ⚑ | Objective | Primary mission objective |
| ⚡ | Trigger | Event trigger point |
| ● | Spawn | Actor/element spawn location |
| ⚠ | Hazard | Danger zone or obstacle |
| ♦ | Intel Drop | Intelligence material location |

### Node Status
| Status | Color | Meaning |
|--------|-------|---------|
| pending | Grey | Not yet activated |
| active | Green | Currently in play |
| completed | Blue | Successfully resolved |
| failed | Red | Failed or compromised |

### Placing Nodes
1. In Controls → **SCENARIO NODES** section
2. Enter **CELL** (e.g. `C4`) -- clicking a cell on the grid auto-fills this field
3. Select **TYPE** from dropdown
4. Enter **LABEL** (e.g. "Rally Point Alpha")
5. Click **PLACE NODE**
6. Click **SAVE SCENARIO GRAPH** to persist to server

### Changing Node Status
1. Click a cell on the grid to open the Cell Panel
2. In the **SCENARIO NODES** section, use the status dropdown next to each node
3. Changes persist immediately via `PATCH /api/m/map/scenario/node`
4. Grid re-renders with updated node colors

### Shared with Ops
Scenario nodes are visible to ops in their read-only tactical map via `GET /api/ops/map`. Ops sees node icons and statuses but cannot modify them.

---

## 6. MOK -- YOUR AI DIRECTOR ASSISTANT

MOK is visible in the header as a green triangular SVG glyph. It functions as M's second brain.

### MOK States
| Triangle State | Meaning |
|----------------|---------|
| Dim/hollow | Idle -- nothing happening |
| Gentle pulse | Monitoring -- watching the scenario |
| Flash (3x) | Advisory notification |
| Rapid flash | Urgent -- intervention recommended |
| Solid glow | Auto-director engaged |

### MOK Feed
Below the event feed, the **MOK FEED** panel shows private messages from MOK:
- **Advisory** (dim green tag): Routine observations
- **Warning** (amber tag): Potential issues
- **Directive** (bright green tag): Actionable suggestions
- **Critical** (red tag, red background): Immediate attention required

### MOK Auto-Triggers
MOK reacts to incoming WebSocket events automatically:
- **Escalation events** → warning message
- **Dead drop compromised** → critical message
- **Actor check-in** → advisory message
- **Actor panic** → critical message + urgent state
- **Player pingback** → advisory message
- **Deadman alert** (heartbeat timeout) → critical message
- **Geofence trigger** → warning with zone details
- **Ping acknowledgment** → advisory message
- **Beat unlock** → warning with beat title
- **Fog update** → advisory with zone state

### MOK Squelch Modes
| Button | Mode | What prints |
|--------|------|------------|
| F | Full | All telemetry |
| Q | Quiet | Critical alerts only |
| T | Tactical | Directives + critical only |
| S | Silent | Nothing prints (triangle still flashes) |

### Console API (for testing / future AI integration)
```javascript
window._MOK.send('advisory', 'Players moving faster than projected.')
window._MOK.send('warning', 'Dead drop likely compromised.')
window._MOK.send('directive', 'Suggest deploying Snowman to C2.')
window._MOK.send('critical', 'Scenario collapse risk: 72%')
window._MOK.setState('engaged')  // solid glow
window._MOK.setSquelch('tactical')
```

---

## 7. ACTOR NETWORK

### Overview Panel
The **ACTOR NETWORK** section in the Controls panel shows all actors:
- Status dot (green=active, amber=holding, blue=engaging, grey=dark/standby)
- Callsign with team badge
- Current cell or "UNASSIGNED"
- Current status

Click any actor to open their dedicated actor panel.

### Actor Panel
When an actor is selected, the right panel shows:
- Callsign, team, status, current cell
- **M PINGS** -- 8 structured directive buttons:

| Ping | Effect |
|------|--------|
| **MOVE** | Direct actor to relocate |
| **HOLD** | Hold current position |
| **ENGAGE** | Make contact with players |
| **SHADOW** | Follow/observe without contact |
| **DROP INTEL** | Place intel at location |
| **ESCALATE** | Increase presence/pressure |
| **EXTRACT** | Leave the area |
| **FREEZE** | Cease all activity immediately |

Each ping is sent as a structured event via WebSocket. The actor's Ops device receives a full-screen flash notification with a 30-second ACK countdown.

### Ping History
Below the ping buttons, **PING HISTORY** shows up to 8 recent pings to this actor with ACK status:
- `HOLD  10:42:15 AM  ACK 8s` -- acknowledged in 8 seconds
- `ENGAGE 10:44:02 AM  PENDING` -- not yet acknowledged

### Direct Commands
- **MOVE TO CELL** -- Enter move mode, click a cell on the map to dispatch
- **GO DARK** -- Actor goes dark (status: dark, disappears from active roster)

---

## 8. CELL ACTIONS

Click any cell on the UGRS grid to open the Cell Panel:

- **Status badge** and **lane assignment**
- **Tension meter** with percentage and visual fill bar
- **Actors in cell** (click to drill into actor panel)
- **Dead drops** in cell (label and status)
- **Scenario nodes** in cell (icon, type, label, status dropdown)
- **Notes** -- freeform operational notes (saved to server)

### Cell Action Buttons
| Action | What it does |
|--------|-------------|
| DISPATCH ACTOR | Pick an actor to send to this cell |
| MARK RESOLVED | Reset cell to working, tension to 0 |
| ESCALATE TENSION (+25) | Increase cell tension by 25% |
| FREEZE LANE | Set all cells in this lane to offline |
| SEND INTEL DROP | Inject an intel_drop event at this cell |

---

## 9. FREEZE GAME

The **FREEZE GAME** button in the header:
1. Toggles scenario frozen state
2. Broadcasts freeze/unfreeze to ALL connected clients via WebSocket
3. M Mode shows a red "GAME FROZEN" overlay on the map
4. Ops devices show a full-screen "GAME FROZEN -- STAND BY FOR COMMAND" overlay
5. MOK logs the freeze/unfreeze as a critical event

---

## 10. EVENT FEED

The center column shows a chronological event feed. Events include:
- `checkin` -- Actor check-ins (green border)
- `dead_drop_placed` / `dead_drop_retrieved` (amber border)
- `escalation` (red border)
- `actor_move`, `actor_command`, `cell_update`
- `mping`, `mping_ack`
- `intel_drop`, `game_freeze`, `game_unfreeze`
- `mok_broadcast`, `surveillance_sweep`, `contact_injection`

---

## 11. LIVE TELEMETRY & GPS MAP

### Actor Telemetry
The **LIVE TELEMETRY** section shows real-time GPS positions from actor watch apps:
- Callsign, latitude/longitude, motion state, last seen time
- **REFRESH POSITIONS** button

### Live Map (Leaflet.js)
Toggle open with **OPEN MAP ▼** button in the overview panel:
- OpenStreetMap base tiles
- **ACTORS ●** button -- toggle colored actor GPS dots (blue=#3399ff, red=#ff3333, director=#33ff33)
- **ZONES ⬤** button -- toggle geofence zone overlays
- Markers show popups with callsign, team, motion state, LIVE/STALE
- Stale markers (>2 min since last update) turn grey
- Auto-zooms to fit all actor positions

---

## 12. GEOFENCE ZONES

Create invisible geographic triggers:
- **Zone fields**: Name, Lat, Lng, Radius (meters), Trigger type (ENTER/EXIT/BOTH), Event type
- **ADD ZONE** creates the zone
- Active zones appear on the live map as overlays
- When an actor crosses a zone boundary, MOK receives a warning with callsign, transition, zone name, and distance

---

## 13. SCENARIO BEATS (Story Nodes)

Story-driven beats that unlock based on GPS proximity:
- Each beat has: Title, Lat/Lng, Radius, Sequence number, Event type
- Beats display locked/unlocked icon and coordinate data
- **UNLOCK** button manually triggers a locked beat
- **DELETE** removes a beat
- **ADD BEAT** creates new beats
- When a beat unlocks (via proximity or manual trigger), MOK receives a warning with beat title and sequence

---

## 14. FOG OF WAR

Control visibility zones for the operational area:
- Zone list with visibility state (☀ = LIT, 🌑 = DARK)
- Toggle buttons per zone to switch between lit and dark
- Input for zone label with LIT/DARK buttons
- When toggled, MOK receives advisory with zone label and new state

---

## 15. MODERATOR CONTROL (OPS ROLES)

Manage who has ops-level access within a scenario:
- List of current ops-tagged moderators
- **Callsign** input and **Role** selector (ops)
- **GRANT** assigns ops role to an actor
- **REVOKE** removes ops role
- **REFRESH ROLES** reloads the current moderator list

---

## 16. MICROCHAT (Actor Watch App)

Encrypted one-to-one messaging channel with actor watch apps:
- Enter **Actor ID** and click **LOAD THREAD** to view conversation
- Scrollable chat thread display
- **Message** input (max 280 characters)
- **SEND** dispatches encrypted message
- AES-256-GCM encryption with scenario-based key derivation
- Delivery confirmations appear in MOK feed

---

## 17. DECOY PING

Inject false commands that are NOT recorded in the event log:
- Enter **Actor ID**
- Select **Command** (SHADOW, HOLD, ENGAGE, MOVE, DROP, EXTRACT)
- Optional message
- **INJECT DECOY** button (danger-styled)
- The actor receives this as a real ping but M's event log stays clean

---

## 18. VIDEO PUSH

Push video intel to ops devices:
- Video push widget in the controls panel
- Select a video from the R2 bucket
- Push triggers a WebSocket message to all connected ops
- Ops devices display a fullscreen video overlay with title, autoplay, and close controls

---

## 19. ESCALATION PRESETS

Quick-action buttons for common scenario-wide actions:
| Preset | Effect |
|--------|--------|
| **SURVEILLANCE SWEEP** | Inject surveillance sweep event into all active lanes |
| **INJECT CONTACT** | Signal approaching contact to all actors |
| **ESCALATE ZONE** | Raise tension +25 on all non-offline cells |
| **STAND DOWN** | Reset all cells to working, tension to 0 |

---

## 20. BROADCAST

Send a message to all connected ops devices:
- Enter **MESSAGE**
- Click **BROADCAST TO OPS**
- All ops devices show a banner notification with the broadcast text
- Auto-dismisses after 8 seconds

---

## 21. PLAYER POSITIONS

View GPS locations from players (red team) who consented to location sharing:
- Callsign, lat/lng, motion state
- **REFRESH** button
- Auto-refreshes on interval

---

## 22. SCENARIO SETUP WORKFLOW

1. **Login** as M
2. **Upload map image** (drag-drop or button -- uploads to R2)
3. **Calibrate grid** (set cols/rows, click CALIBRATE)
4. **Place scenario nodes** (waypoints, objectives, triggers on cells)
5. **Save scenario graph** to persist node layout
6. **Create lanes** (e.g. ALPHA, BRAVO, CHARLIE)
7. **Assign cells to lanes** (select lane, click START ASSIGNING, click cells)
8. **Add actors** (callsign, team, password)
9. **Generate join codes** for actor teams
10. **Set requirements** (min_red, min_blue in REQUIREMENTS section)
11. **Publish map** (PUBLISH TO OPS -- creates frozen Ops snapshot)
12. **Run readiness check** (RECHECK in READINESS & DISPATCH section)
13. **Dispatch** (DISPATCH button -- gates on readiness, or FORCE DISPATCH)
14. **Set up geofence zones** if using GPS triggers
15. **Add scenario beats** if using proximity-unlocked story
16. **Deploy actors** to cells
17. **Inject events** to start the scenario
18. **Monitor and direct** using pings, tension, escalation, and MOK

---

## 23. KEYBOARD SHORTCUTS

| Key | Action |
|-----|--------|
| ESC | Navigate back in panel (actor → cell → overview) |

---

## 24. WEBSOCKET REAL-TIME

All state changes broadcast via Durable Object WebSocket:
- Grid updates, actor movements, event injections
- Ping delivery and ACK responses
- Freeze/unfreeze state
- Actor telemetry (GPS positions)
- Geofence triggers
- Beat unlocks
- Fog of war updates
- Microchat delivery confirmations
- Player location updates
- MOK reacts to incoming events automatically

The green dot in the header confirms live WebSocket connection. Reconnects automatically with 3-second delay on disconnect.

---

## 25. PUBLISH MAP (Draft vs. Live Pipeline)

M assembles and iterates on the scenario map freely. Ops only sees the last "published" snapshot -- never M's in-progress edits.

### How It Works
- `config` = M's live working draft (what M edits in the console)
- `published_config` = frozen snapshot that Ops reads from
- `published_at` = timestamp of last publish

### PUBLISH MAP Section
In the Controls panel, the **PUBLISH MAP** section (styled as a `ctrl-box` bordered panel):
1. Click **PUBLISH TO OPS** to snapshot the current working draft
2. Server deep-copies `config` → `published_config`, sets timestamp
3. Broadcasts `map_published` event to all connected clients via WebSocket
4. Ops tactical map refreshes to show the new published state

### Ghost Markers (Divergence Display)
When M moves a node after publishing, the grid shows both positions:
- **Solid icon** = current working draft position
- **Dotted outline at 40% opacity** = last published position (the "ghost")

Ghosts appear only when working state diverges from published state. After publishing, all ghosts clear because working = published.

### Publish History & Rollback
Click **PUBLISH HISTORY** below the publish button to expand a versioned snapshot list:
- Each snapshot shows date, author, diff summary, and size
- **ROLLBACK** — restores that snapshot as the Ops published map only (M's working draft stays unchanged)
- **RESTORE** — restores that snapshot to BOTH Ops published map AND M's working draft (overwrites current work)
- Snapshots are stored in R2 cloud storage and persist indefinitely

---

## 26. DRAG-MOVE NODES

M can relocate scenario nodes across cells mid-game:

1. Click a **node marker** on the UGRS grid
2. The cursor changes to indicate "move mode"
3. Click the **destination cell**
4. The node relocates in the working draft immediately
5. Server call `PATCH /api/m/map/scenario/node` persists the change
6. A ghost marker remains at the published position until next publish

---

## 27. READINESS & DISPATCH

Before deploying a scenario to Ops, M runs a pre-flight readiness check.

### Requirements Section
In the Controls panel, the **REQUIREMENTS** section lets M set minimum staffing:
- **min_red** -- minimum red team actors needed
- **min_blue** -- minimum blue team actors needed
- Save button persists to `config.requirements`

### Readiness Checks
The **READINESS & DISPATCH** section shows a vertical checklist:
- Each check shows ✓ (green, pass) or ✗ (red, fail) with detail text
- Checks include: red actors, blue actors, staff actors, join codes, grid calibrated, map published, dead drops loaded
- **RECHECK** button fetches latest readiness from `GET /api/m/scenario/:id/readiness`

### Dispatch
- **DISPATCH** button runs readiness checks server-side, then deploys
- If checks fail: returns shortages; M can **FORCE DISPATCH** to override
- On dispatch: scenario status → 'deployed', auto-publishes if needed, broadcasts `scenario_dispatched`
- Creates an audit record in `dispatch_audit` table for post-game review

### Dispatch Lifecycle
```
draft → staged → deployed → active → paused → completed → archived
```

### Audit Trail Viewer
Click **AUDIT TRAIL** below the dispatch button to expand the audit log:
- Shows all dispatch lifecycle events in reverse chronological order
- Filter by action type (dispatch, dispatch_override, requirement_updated, freeze, etc.)
- Each entry shows timestamp, action type (color-coded), actor callsign, and detail summary
- **REFRESH** button reloads the log
- Actions logged: dispatch, dispatch_override, requirement_updated, publish, status_change, freeze/unfreeze, node_moved
- Used for post-game debrief and analysis

---

## 28. ALARM AD[M]IN SYSTEM (Ops → M Escalation)

Ops field actors can raise alarms to M. This creates an escalation path from the field to the director.

### How It Works
1. An Ops actor presses **ALARM AD[M]IN** on their portal header
2. Server increments `config.ops_alarm_count` and broadcasts `ops_alarm` via WebSocket
3. M's **FREEZE GAME** button gains a red badge showing the alarm count
4. MOK logs a critical alert for each alarm received
5. **Auto-freeze at 3+ alarms**: If 3 or more alarms accumulate without M interaction, the game automatically freezes

### M's Response
- When M clicks the **FREEZE GAME** button while alarms are active:
  1. Alarms are acknowledged and cleared (calls `POST /api/m/scenario/alarm-ack`)
  2. Badge disappears, button glow stops
  3. Freeze state toggles as normal
- Alarm count persists in `config.ops_alarm_count` so it survives reconnects

### Visual Indicators
- Red badge with count on the freeze button
- Red border glow animation (`alarm-btn-glow`) when alarms are active
- Badge pulse animation on new alarm arrival

---

## 29. SCENARIO DESIGNER

The Scenario Designer is an in-workspace authoring tool for building operations from narrative text.

**URL:** `https://flapsandseals.com/m/scenario-designer.html`

### Purpose
Takes freeform scenario narrative (the kind you'd write in a design document or briefing) and turns it into **wirable beat blocks** that map directly to the UGRS lane grid. Designed for scenario designers who think in story terms and need a bridge to M's operational systems.

### Getting Started

1. Navigate to **SCENARIO DESIGNER** from the M Mode header, or go directly to `/m/scenario-designer.html`.
2. You do **not** need to be logged in to use the designer -- it runs entirely in the browser.
3. Either:
   - Click **↓ LOAD DOWNED PILOT SAMPLE** to see the Extraction template pre-loaded, or
   - Paste your own narrative text and click **⚡ PARSE NARRATIVE → BEATS**

### Layout

| Panel | Purpose |
|-------|---------|
| **Left: SOURCE NARRATIVE** | Paste narrative text; set title, lanes, scenario type |
| **Center: BEAT BOARD** | Visual swimlane showing parsed beats assigned to lanes |
| **Right: BEAT PROPERTIES** | Edit selected beat (type, location, actor, bonafides, paths) |
| **Timeline strip** | Linear sequence of all beats; click to select |

### Beat Types

| Icon | Code | Meaning |
|------|------|---------|
| 🤝 | PM | Personal Meet -- direct actor/client interaction |
| 📦 | DD | Dead Drop -- physical item retrieval |
| 🎯 | RV | Rendezvous -- link-up, handoff |
| 🚁 | EXFIL | Extraction -- final or convergence event |
| ⚡ | EVT | Generic event -- surveillance, pressure, environmental |

### Parsing Rules

The parser detects:
- **Numbered events** -- `Event 1`, `Event #2`, `Event #3 –` etc.
- **Locations** -- `Location: …` lines
- **Beat type** -- keyword scan: "dead drop", "canister", "rendezvous", "EXFIL", "extraction", "personal meet", etc.
- **Bonafides** -- quoted challenge/response pairs near "Ex." or "To whit, the IC replies"
- **Actor roles** -- IC, spy, hostess, downed pilot, foreign agent, contact
- **Success chain** -- beats are auto-wired sequentially; adjust in Properties panel

### Templates

Use the **TEMPLATE** dropdown to load pre-built beat boards for common scenario types:
- `EXTRACTION` -- Downed Pilot (3 beats: PM → DD → EXFIL)
- `COURIER RUN` -- 3-beat transport chain
- `COUNTERINTELLIGENCE` -- 4-beat identify/observe/retrieve/extract
- `ASSET RECOVERY` -- 5-beat full-length operation

### Editing Beats

Click any beat card to open its properties:
- **Title, type, lane** -- core identity
- **Location, grid cell** -- physical placement (use UGRS cell IDs like `A1`, `B3`)
- **Actor role + engagement level** -- who is at this beat and how active (0-3)
- **Bonafides** -- challenge / response pair for client-IC confirmation
- **Detail** -- IC instructions / narrative notes
- **Success / fail path** -- wire to next beat
- **Tension delta** -- how much tension this beat adds to its lane cells
- **Escalation phase** -- which phase of the emotional curve this beat occupies

### Adding Beats Manually

Click **+ ADD BEAT** in the subbar. A blank beat is added to the first lane. Assign it a type and lane in the Properties panel.

### Export

Click **↗ EXPORT JSON / SEL** in the subbar to open the export modal.

The export contains two formats:
1. **JSON** -- `scenario`, `lanes`, and `beats` arrays suitable for API creation
2. **SEL** (Scenario Engine Language) -- human-readable declarative format for version control

Copy the JSON and use it to create a scenario via `POST /api/m/scenario` (future endpoint) or reference the SEL file in `docs/scenarios/`.

The sample scenario is at `docs/scenarios/downed-pilot.sel.txt`.

### Views

| Mode | Description |
|------|-------------|
| **SWIMLANE** (default) | Beats grouped by lane in horizontal rows -- see lane assignments |
| **CHAIN** | Linear beat sequence -- see the narrative flow |

---
