# EYES ONLY -- BLUE TEAM ACTOR FIELD MANUAL (ALPHA)

## OPS Portal Quick Reference

This document maps the Ops Tutorial design against the live Ops portal at `flapsandseals.com/ops/`. It covers what actors see, how to respond to M directives, and the full check-in and acknowledgment workflow.

---

## 1. JOINING AN OPERATION

**URL:** `https://flapsandseals.com/ops/`

### Step 1: User Login
1. Enter your **USERNAME** in the login field
2. The system auto-registers new accounts -- if you haven't logged in before, your account is created automatically
3. Once logged in, you'll see **LOGGED IN AS [your name]** at the top

### Step 2: Join Operation
1. Enter your **JOIN CODE** (6-character code provided by M)
2. Press **JOIN OPERATION**

On success the Ops dashboard loads. Your session is saved locally -- refresh the page to resume. The user session is shared with the main site at `flapsandseals.com`.

---

## 2. DASHBOARD LAYOUT

After joining, the Ops screen shows:

### Header
- **EYES ONLY // OPS** title
- **Callsign [TEAM]** badge with connection border (green=connected, red=offline)

### Context Bar
A persistent status strip at the top of the dashboard:
| Field | Content |
|-------|---------|
| **STATUS** | Your operative status (ACTIVE, DARK, etc.) -- color-coded |
| **CELL** | Your current cell assignment on the UGRS grid |
| **LANE** | Your current lane assignment |
| **TENSION** | Cell tension % (green < 40%, amber < 70%, red >= 70%) |
| **PINGS** | Count of pending M directives (red if > 0) |
| **SCENARIO** | Active scenario name |

A **tension bar** fills beneath the context fields to show tension visually. Below that, your most recent directive and ACK status are displayed.

### Cards (top to bottom)
| Card | Content |
|------|---------|
| **STATUS / TEAM** | Current status (ACTIVE) and team assignment |
| **M DIRECTIVES** | Pending and acknowledged pings from M (last 10) |
| **RECENT EVENTS** | Last 20 scenario events |
| **CHECK-IN** | Lane ID + message fields for check-in |
| **TACTICAL MAP** | Read-only UGRS grid with scenario nodes |
| **DISCONNECT** | Leave the operation |

---

## 3. M DIRECTIVES -- RECEIVING PINGS

When M sends you a directive, two things happen:

### Full-Screen Flash Notification
A red-tinted overlay fills the screen:
- **M DIRECTIVE** label (red, uppercase)
- **Command** in large green text (e.g. `HOLD`, `ENGAGE -> C2`)
- **Detail** message from M
- **30-second countdown timer** (red, counts down to 0)
- **ACKNOWLEDGE** button (large, green border)

**You MUST press ACKNOWLEDGE within 30 seconds.** If the timer expires, the flash dismisses but the ping remains unacknowledged in your directives list. M can see your ACK time.

### M Directives Card
Below the status cards, the **M DIRECTIVES** section shows all pings:

**Unacknowledged pings** have:
- Red border
- Command in red text
- Timestamp, sender, and message
- **ACK** button

**Acknowledged pings** have:
- Green border (dimmed)
- Green checkmark: "ACKNOWLEDGED"

---

## 4. THE 8 PING COMMANDS

| Command | What M expects you to do |
|---------|-------------------------|
| **MOVE** | Relocate to the specified cell/area |
| **HOLD** | Stay in current position, maintain cover |
| **ENGAGE** | Make contact with players at specified engagement level |
| **SHADOW** | Follow/observe players without making contact |
| **DROP** | Place intel/dead drop at your location |
| **ESCALATE** | Increase your visible presence/pressure |
| **EXTRACT** | Leave the area naturally -- operation may be ending |
| **FREEZE** | Cease ALL activity immediately -- become a normal pedestrian |

### Responding to Pings
1. Read the directive carefully
2. Press **ACKNOWLEDGE** (on flash overlay or ACK button in card)
3. Execute the directive
4. Check in via the CHECK-IN card to confirm completion

---

## 5. CHECK-IN PROTOCOL

The tutorial specifies check-ins every 15 minutes. Use the CHECK-IN card:

1. Enter your **LANE** (e.g. `ALPHA`, `BRAVO`)
2. Enter a **MESSAGE** (status update, e.g. `Position held, no contact`)
3. Press **CHECK IN**

This creates a `checkin` event visible to M in the event feed. M can track your last check-in time. If your device supports GPS, your location is automatically attached to the check-in.

### Status Codes (use in message field)
| Code | Meaning |
|------|---------|
| GREEN | All clear, operating normally |
| YELLOW | Situation developing, need guidance |
| RED | Problem, requesting immediate direction |

---

## 6. TACTICAL MAP

The dashboard includes a **TACTICAL MAP** card showing the UGRS grid in read-only mode. This is the same grid M sees, shared in real time.

### What You See
- Grid cells with column labels (A, B, C...) and row labels (1, 2, 3...)
- **Cell status colors** -- green (working), amber (degraded), red (compromised), grey (offline), dark (unknown)
- **Scenario node markers** placed by M:
  - ★ Waypoint, ⚑ Objective, ⚡ Trigger, ● Spawn, ⚠ Hazard, ♦ Intel Drop
  - Color indicates status: grey=pending, green=active, blue=completed, red=failed
- **Tension bars** at bottom of cells
- **Map image** background (if M uploaded one) at 20% opacity
- Cells with scenario nodes have **dashed borders**

### Auto-Refresh
The map refreshes every 15 seconds to reflect M's changes to the grid, cell statuses, and scenario node activations.

### Purpose
Use the tactical map to orient yourself within the UGRS grid. When M sends you a `MOVE -> C4` directive, you can see where C4 is on the grid and what nodes or status it carries.

---

## 7. VIDEO PUSH (INTEL FEED)

M can push video intel to your device at any time.

### What Happens
1. A fullscreen overlay appears with a blinking red signal indicator: **▶ INCOMING INTEL**
2. The video title is shown at the top
3. Video autoplays in the center of the screen
4. Standard playback controls are available

### Dismissing
- Video auto-closes 2 seconds after it finishes playing
- Press the **X** button to close manually at any time
- If the video fails to load, a "VIDEO FEED LOST" message appears

---

## 8. M BROADCAST NOTIFICATIONS

When M sends a broadcast, a banner appears at the top of your screen:
- **M BROADCAST** label
- Message content from M
- Auto-dismisses after 8 seconds
- Tap to dismiss early

Broadcasts are also triggered by surveillance sweep and contact injection events.

---

## 9. WEBSOCKET REAL-TIME CONNECTION

The Ops portal connects to M's scenario room via WebSocket:
- **Green border** on your callsign badge = connected
- **Red border** = disconnected

### Reconnection
The portal uses exponential backoff: 2s → 4s → 8s → 16s → 32s, up to 5 retries. If all retries fail, refresh the page to reconnect.

### Real-time Events You'll Receive
- **M pings** -- immediate full-screen flash notification
- **Freeze/unfreeze** -- full-screen "GAME FROZEN" overlay
- **Video push** -- fullscreen video player overlay
- **Broadcasts** -- banner notification
- **Scenario events** -- event feed updates
- **Escalation events** -- scenario state refresh

---

## 10. FREEZE COMMAND

When M freezes the game:
- A full-screen overlay appears: **GAME FROZEN -- STAND BY FOR COMMAND**
- All interactions are blocked
- You must immediately disengage and become a normal pedestrian
- Wait for M to unfreeze the game

When unfrozen, the overlay dismisses and you resume operations.

---

## 11. ENGAGEMENT LEVELS

Reference from the field manual -- these are behavioral guidelines, not UI buttons:

| Level | Name | Behavior |
|-------|------|----------|
| 0 | Invisible | Background presence only. No eye contact. |
| 1 | Ambient | Walk near players. Brief glance. Exist in their space. |
| 2 | Indirect Contact | Bump, leave a note, make a cryptic comment |
| 3 | Direct Contact | Full interaction: give clue, block path, deliver message |

M specifies engagement level in the ping message. Default is Level 1 unless told otherwise.

---

## 12. DEAD DROP PROTOCOL

When M sends a **DROP** ping:
1. Acknowledge the ping
2. Place the intel item naturally at your location
3. Check in with lane and message: `DROP PLACED AT [location]`
4. Leave the area

---

## 13. MOVEMENT DOCTRINE

When M sends a **MOVE** ping:
1. Acknowledge the ping
2. Note the target cell in the directive (e.g. `MOVE -> C2`)
3. Check the **tactical map** to locate the target cell
4. Move naturally to the area -- never rush, never look purposeful
5. Check in on arrival with new lane/position

### Shadow Protocol (SHADOW ping)
- Maintain 30-50 meter distance
- Never look directly at target for more than 2 seconds
- Use reflections, cross-street positioning
- If spotted, become a normal pedestrian and wait for new directive

---

## 14. EXTRACTION

When M sends **EXTRACT**:
1. Acknowledge immediately
2. Complete any current interaction naturally
3. Leave the operational area by the most natural route
4. Do NOT break character until fully clear
5. Check in: `EXTRACTED, CLEAR`

---

## 15. POLLING INTERVALS

The dashboard auto-refreshes data at these intervals:
| Data | Interval |
|------|----------|
| Events | 10 seconds |
| M Directives | 8 seconds |
| Status Context | 12 seconds |
| Tactical Map | 15 seconds |

---

## 16. COMMON MISTAKES

- Acknowledging pings but not executing them
- Not checking in every 15 minutes
- Staying in one visible spot too long (45-60 min max in same role)
- Helping players too directly
- Breaking character during a freeze
- Forgetting to check in after completing a directive
- Ignoring the tactical map -- it tells you where M needs you

---

## 17. DISCONNECTING

Press the red **DISCONNECT** button at the bottom of the dashboard. This clears your local session. You'll need to re-join with your join code to reconnect.

---

## 18. GOLDEN RULE

> If the players think you "might actually have been real," you succeeded.

---

## 19. EXTRACTION SCENARIO FIELD NOTES -- DOWNED PILOT (1.2026)

This section covers actor-specific field guidance for the **Downed Pilot extraction** scenario type. It is the template for all EyesOnly extraction operations.

### Scenario Summary

Players infiltrate a scenario, link up with a foreign agent (spy), solve a dead drop, and assist in rescuing a downed pilot. Three beats, three lanes.

| Beat | Type | Location | Your Role |
|------|------|----------|-----------|
| PM1 | Personal Meet | The District -- 313 N First Ave., Sandpoint | IC (Spy / Liaison) |
| DD | Dead Drop | Long Bridge (Bonner County) -- park bench | Pre-stage only |
| EXFIL | Rendezvous | Schweitzer Pub, Schweitzer Ski Resort | IC (Downed Pilot) or Hostess |

### Beat 1: Personal Meet (PM1) -- IC (Spy) Guidance

**Your objective:** Confirm client bonafides, deliver verbal briefing, exit "spooked."

**Bonafides exchange:**
- Client says: *"I've always favored an Old Fashioned in Paris."*
- You reply: *"I usually prefer champagne in the city of lights."*

**After confirmation:**
1. Deliver verbal briefing (scenario background + dead drop location instructions).
2. Keep your voice low. Lean in. Use period-appropriate mannerisms.
3. After 5-8 minutes: check your watch, become visibly nervous.
4. Exit line: *"I've said too much. I must go."* Leave naturally.

**If client misses the bonafide:** Pass a folded note instead of verbal exchange. M will confirm via ping if this is needed.

**Check in:** After client departs, check in via Ops portal:
- Lane: `ALPHA`
- Message: `PM1 COMPLETE. CLIENT CONFIRMED. DEPARTED ALPHA.`

### Beat 2: Dead Drop (DD) -- Pre-Staging

**Your objective:** Pre-stage the waterproof canister before the scenario begins.

1. Place the canister under the designated park bench on the Long Bridge walking path.
2. Confirm placement by checking in:
   - Lane: `BRAVO`
   - Message: `DD STAGED. BENCH [DESCRIPTION]. CANISTER SECURE.`
3. You are **not present** at the dead drop during player recovery. Stay away from BRAVO lane.
4. If canister is missing when M alerts: text M `BRAVO COMPROMISED` and wait for alternate drop instruction.

### Beat 3: Rendezvous & EXFIL -- IC (Downed Pilot) Guidance

**Your objective:** Receive the key/info from clients, acknowledge, depart naturally.

**Hostess IC (secondary actor):**
1. When clients arrive, approach naturally as wait staff.
2. Clients will issue their bonafide (provided by M before the event).
3. Confirm with your response, then provide final link-up instructions (directed to the downed pilot table).

**Downed Pilot IC:**
1. Sit at the designated table. Appear distressed but composed -- you've been in the cold.
2. When clients approach, let them speak first.
3. Accept the key/info with relief: *"You have no idea what this means."*
4. Do NOT perform a dramatic exit. Leave naturally within 3-5 minutes.
5. Check in: Lane `CHARLIE`, Message: `EXFIL COMPLETE. PILOT CLEAR.`

**ENDEX:** M will broadcast ENDEX via your Ops device. When you receive it:
1. Acknowledge the ping.
2. Break character only when fully clear of the venue and other guests.

### Actor Communication Protocol

- **Green status:** Operating normally. No issues.
- **Yellow status:** Client confused or stalled. Send via check-in for M guidance.
- **Red status:** Something is wrong. M will ping with directive immediately.

### Contingency: Players Stalled

| Situation | Your Action |
|-----------|-------------|
| Players haven't found DD after 30 min | Wait for M PING with hint directive |
| Players missed bonafide at PM1 | Pass note (pre-written, given by M before scenario) |
| Canister missing at Long Bridge | Text M immediately: `BRAVO COMPROMISED` |
| Players arrive at Schweitzer early | Stay in character as regular patron until M sends ENGAGE ping |

---
