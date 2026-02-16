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
- **MOK HUD** -- the green triangle SVG indicator. States: idle (dim), monitoring (gentle pulse), advisory (flash), urgent (rapid flash), engaged (solid glow)
- **Squelch Controls** (F/Q/T/S buttons): Full, Quiet (critical only), Tactical (actionable only), Silent (triangle flashes, no text)
- **Scenario name**, your callsign, WebSocket status dot (green=live, red=offline)
- **FREEZE GAME** button (red border)
- **LOGOUT** button

### Operation Bar
Persistent metrics below the header:
- **ELAPSED** -- HH:MM:SS timer since console load
- **THREAT** -- LOW (green) / OPTIMAL (amber) / HIGH (red) / CRITICAL (red glow) -- derived from average grid cell tension
- **ACTORS** -- online/total count
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
- **Tension bar** at bottom of cell (green < 40%, amber < 70%, red >= 70%)
- **Lane tag** (top-right, e.g. "ALPHA")

### Grid Calibration
In the Controls panel (overview mode):
1. Set **COLS** and **ROWS**
2. Click **CALIBRATE** -- this creates all grid cells with UGRS coordinates
3. Drag-drop a map image onto the map area for overlay

---

## 4. MOK -- YOUR AI DIRECTOR ASSISTANT

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

## 5. ACTOR NETWORK

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
Below the ping buttons, **PING HISTORY** shows recent pings to this actor with ACK status:
- `HOLD  10:42:15 AM  ACK 8s` -- acknowledged in 8 seconds
- `ENGAGE 10:44:02 AM  PENDING` -- not yet acknowledged

### Direct Commands
- **MOVE TO CELL** -- Enter move mode, click a cell on the map to dispatch
- **GO DARK** -- Actor goes dark (status: dark, disappears from active roster)

---

## 6. CELL ACTIONS

Click any cell on the UGRS grid to open the Cell Panel:

- **Status badge** and **lane assignment**
- **Tension meter** with percentage
- **Actors in cell** (click to drill into actor panel)
- **Dead drops** in cell
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

## 7. FREEZE GAME

The **FREEZE GAME** button in the header:
1. Toggles scenario frozen state
2. Broadcasts freeze/unfreeze to ALL connected clients via WebSocket
3. M Mode shows a red "GAME FROZEN" overlay on the map
4. Ops devices show a full-screen "GAME FROZEN -- STAND BY FOR COMMAND" overlay
5. MOK logs the freeze/unfreeze as a critical event

---

## 8. EVENT FEED

The center column shows a chronological event feed. Events include:
- `checkin` -- Actor check-ins (green border)
- `dead_drop_placed` / `dead_drop_retrieved` (amber border)
- `escalation` (red border)
- `actor_move`, `actor_command`, `cell_update`
- `mping`, `mping_ack`
- `intel_drop`, `game_freeze`, `game_unfreeze`

---

## 9. SCENARIO SETUP WORKFLOW

1. **Login** as M
2. **Upload map image** (drag-drop or button)
3. **Calibrate grid** (set cols/rows, click CALIBRATE)
4. **Create lanes** (e.g. ALPHA, BRAVO, CHARLIE)
5. **Assign cells to lanes** (select lane, click START ASSIGNING, click cells)
6. **Add actors** (callsign, team, password)
7. **Generate join codes** for actor teams
8. **Deploy actors** to cells
9. **Inject events** to start the scenario
10. **Monitor and direct** using pings, tension, escalation

---

## 10. KEYBOARD SHORTCUTS

| Key | Action |
|-----|--------|
| ESC | Navigate back in panel (actor -> cell -> overview) |

---

## 11. WEBSOCKET REAL-TIME

All state changes broadcast via Durable Object WebSocket:
- Grid updates, actor movements, event injections
- Ping delivery and ACK responses
- Freeze/unfreeze state
- MOK reacts to incoming events automatically

The green dot in the header confirms live WebSocket connection.
