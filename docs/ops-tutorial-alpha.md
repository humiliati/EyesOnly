# EYES ONLY -- BLUE TEAM ACTOR FIELD MANUAL (ALPHA)

## OPS Portal Quick Reference

This document maps the Ops Tutorial design against the live Ops portal at `flapsandseals.com/ops/`. It covers what actors see, how to respond to M directives, and the full check-in and acknowledgment workflow.

---

## 1. JOINING AN OPERATION

**URL:** `https://flapsandseals.com/ops/`

1. Enter your **JOIN CODE** (6-character code provided by M)
2. Enter your **CALLSIGN** (your actor name, e.g. `Snowman`)
3. Press **JOIN OPERATION**

On success the Ops dashboard loads. Your session is saved locally -- refresh the page to resume.

---

## 2. DASHBOARD LAYOUT

After joining, the Ops screen shows:

### Header
- **EYES ONLY // OPS** title
- **Callsign [TEAM]** badge with connection status border (green=connected, red=offline)

### Cards (top to bottom)
| Card | Content |
|------|---------|
| **STATUS / TEAM** | Current status (ACTIVE) and team assignment |
| **M DIRECTIVES** | Pending and acknowledged pings from M |
| **RECENT EVENTS** | Last 20 scenario events |
| **CHECK-IN** | Lane ID + message fields for check-in |
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

This creates a `checkin` event visible to M in the event feed. M can track your last check-in time.

### Status Codes (use in message field)
| Code | Meaning |
|------|---------|
| GREEN | All clear, operating normally |
| YELLOW | Situation developing, need guidance |
| RED | Problem, requesting immediate direction |

---

## 6. WEBSOCKET REAL-TIME CONNECTION

The Ops portal connects to M's scenario room via WebSocket:
- **Green border** on your callsign badge = connected
- **Red border** = disconnected (auto-reconnects every 3 seconds)

Real-time events you'll receive:
- **M pings** -- immediate full-screen flash notification
- **Freeze/unfreeze** -- full-screen "GAME FROZEN" overlay
- **Scenario events** -- event feed updates

---

## 7. FREEZE COMMAND

When M freezes the game:
- A full-screen overlay appears: **GAME FROZEN -- STAND BY FOR COMMAND**
- All interactions are blocked
- You must immediately disengage and become a normal pedestrian
- Wait for M to unfreeze the game

When unfrozen, the overlay dismisses and you resume operations.

---

## 8. ENGAGEMENT LEVELS

Reference from the field manual -- these are behavioral guidelines, not UI buttons:

| Level | Name | Behavior |
|-------|------|----------|
| 0 | Invisible | Background presence only. No eye contact. |
| 1 | Ambient | Walk near players. Brief glance. Exist in their space. |
| 2 | Indirect Contact | Bump, leave a note, make a cryptic comment |
| 3 | Direct Contact | Full interaction: give clue, block path, deliver message |

M specifies engagement level in the ping message. Default is Level 1 unless told otherwise.

---

## 9. DEAD DROP PROTOCOL

When M sends a **DROP** ping:
1. Acknowledge the ping
2. Place the intel item naturally at your location
3. Check in with lane and message: `DROP PLACED AT [location]`
4. Leave the area

---

## 10. MOVEMENT DOCTRINE

When M sends a **MOVE** ping:
1. Acknowledge the ping
2. Note the target cell in the directive (e.g. `MOVE -> C2`)
3. Move naturally to the area -- never rush, never look purposeful
4. Check in on arrival with new lane/position

### Shadow Protocol (SHADOW ping)
- Maintain 30-50 meter distance
- Never look directly at target for more than 2 seconds
- Use reflections, cross-street positioning
- If spotted, become a normal pedestrian and wait for new directive

---

## 11. EXTRACTION

When M sends **EXTRACT**:
1. Acknowledge immediately
2. Complete any current interaction naturally
3. Leave the operational area by the most natural route
4. Do NOT break character until fully clear
5. Check in: `EXTRACTED, CLEAR`

---

## 12. COMMON MISTAKES

- Acknowledging pings but not executing them
- Not checking in every 15 minutes
- Staying in one visible spot too long (45-60 min max in same role)
- Helping players too directly
- Breaking character during a freeze
- Forgetting to check in after completing a directive

---

## 13. DISCONNECTING

Press the red **DISCONNECT** button at the bottom of the dashboard. This clears your local session. You'll need to re-join with your join code to reconnect.

---

## 14. GOLDEN RULE

> If the players think you "might actually have been real," you succeeded.
