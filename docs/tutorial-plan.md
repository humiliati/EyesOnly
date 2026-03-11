# EyesOnly — Tutorial Plan (End-to-End Feature Walkthrough)

**Date**: 2026-03-11
**Purpose**: Quick reference showing how a few key features work end to end, from M console action through to Ops field device response.

---

## Tutorial 1: Publish a Map and See It on Ops

**Features exercised**: UGRS grid, draft/published divergence, ghost markers, Ops tactical map

### M Director steps:
1. Log in to M console (`/m/`) with director credentials + scenario ID
2. Open the UGRS grid — you see the working draft with placed nodes
3. Drag-move a node to a different cell (click node → click destination)
4. Notice the **ghost marker** at the old position (dotted, 40% opacity)
5. Click **PUBLISH TO OPS** in the Controls panel
6. Ghost markers disappear (working = published)
7. Timestamp shows below the button confirming publish time

### Ops Actor steps:
1. Open Ops portal (`/ops/`) on a phone or second browser tab
2. Log in with username, enter join code
3. Scroll to **TACTICAL MAP** card
4. See the published grid with node markers (same positions M just published)
5. Wait 15 seconds — map auto-refreshes on the polling cycle

### What to verify:
- Ops never sees M's unpublished node moves
- After publish, Ops grid matches M's layout
- Ghost markers only appear on M's view, never on Ops

---

## Tutorial 2: Push Video Intel from M to Ops

**Features exercised**: Video push endpoint, WebSocket broadcast, fullscreen overlay, INTEL FEED card

### M Director steps:
1. Pre-upload a short demo video via Sound Designer portal (`/portal/sound-designer.html`) with destination set to "video"
2. In M console, find the **VIDEO INTEL** section
3. Type the video filename (e.g. `demo-briefing.mp4`)
4. Click **PUSH TO OPS**
5. See confirmation: "Video pushed to N clients"

### Ops Actor steps:
1. While connected to the Ops dashboard, watch for the push
2. A **fullscreen overlay** appears: blinking red "INCOMING INTEL" indicator, video title, auto-playing video
3. Video plays to completion, overlay auto-closes after 2 seconds
4. The **INTEL FEED** card (top of dashboard) now shows the video with:
   - "RECEIVED" status and timestamp
   - **REPLAY INTEL** button for inline playback
   - **FULLSCREEN** button to re-launch the overlay
5. Red glow on the card fades after 5 seconds

### What to verify:
- Video plays immediately on Ops without any user action
- INTEL FEED card persists the video for replay
- M console logs a `video_push` audit event

---

## Tutorial 3: Send a Directive and Get an Acknowledgment

**Features exercised**: M pings (8 commands), flash notification, ACK workflow, check-in protocol

### M Director steps:
1. In M console, find the ping/directive controls
2. Select an Ops actor and send a **MOVE → C2** directive
3. Watch the MOK feed for the ping event
4. Monitor the actor's ACK time

### Ops Actor steps:
1. A **full-screen flash notification** appears:
   - Red "M DIRECTIVE" label
   - "MOVE → C2" in large green text
   - Detail message from M
   - **30-second countdown timer**
   - **ACKNOWLEDGE** button
2. Press **ACKNOWLEDGE** within 30 seconds
3. The flash dismisses; the ping appears as acknowledged (green border) in the **M DIRECTIVES** card
4. Check the **TACTICAL MAP** to find cell C2
5. After "arriving" at C2, use the **CHECK-IN** card:
   - Lane: `ALPHA`
   - Message: `ARRIVED C2. POSITION HELD.`
   - Press **CHECK IN**

### What to verify:
- Flash overlay blocks all other interactions until ACK'd or timer expires
- M sees the ACK time in the directives feed
- Check-in event appears in M's event feed with GPS (if available)

---

## Tutorial 4: Dispatch a Scenario (Readiness → Deploy)

**Features exercised**: Requirements config, readiness checks, dispatch lifecycle, audit trail

### M Director steps:
1. In M console Controls panel, find the **REQUIREMENTS** section
2. Set minimum actors: `min_red: 2`, `min_blue: 1`
3. Enable `require_published: true` and `drops_must_have_items: true`
4. Save requirements
5. Click **RECHECK** in the **READINESS & DISPATCH** section
6. See the readiness dashboard:
   - Green ✓ for passing checks (join codes, grid calibrated, etc.)
   - Red ✗ for failing checks (not enough red actors, map not published, etc.)
7. Fix shortages: add actors, publish the map, load dead drops
8. Click **RECHECK** — all checks pass
9. Click **DISPATCH** — scenario status changes to "deployed"
10. Broadcast goes to all connected clients: `scenario_dispatched`

### Ops Actor steps:
1. On receiving the dispatch broadcast, the Ops dashboard refreshes
2. The published map loads with all active nodes
3. Ops is now live and waiting for M directives

### What to verify:
- Dispatch is blocked when checks fail (unless M uses FORCE DISPATCH)
- After dispatch, scenario status = "deployed"
- Open the **AUDIT TRAIL** viewer to see the dispatch record with readiness snapshot

---

## Tutorial 5: Alarm Escalation and Auto-Freeze

**Features exercised**: ALARM AD[M]IN button, alarm broadcast, auto-freeze safety net

### Setup:
- 3 Ops actors connected to the same scenario

### Ops Actor 1 steps:
1. Press the **ALARM AD[M]IN** button in the header
2. Button shows "SENDING..." then "ALARM SENT" with count badge
3. 10-second cooldown prevents spam

### Ops Actor 2 and 3 steps:
1. Each presses **ALARM AD[M]IN** as well
2. All connected Ops actors see broadcast notifications for each alarm

### Auto-freeze (3+ alarms without M acknowledgment):
1. After the 3rd alarm, the game **auto-freezes**
2. All Ops screens show: **GAME FROZEN — STAND BY FOR COMMAND**
3. All interactions are blocked

### M Director steps:
1. M's **FREEZE GAME** button shows a red badge with the alarm count
2. M clicks the freeze button to acknowledge and clear all alarms
3. Broadcast: "M has acknowledged alarms — cleared"
4. Game unfreezes, Ops overlays dismiss, operations resume

### What to verify:
- Alarm count accumulates correctly
- Auto-freeze triggers at exactly 3 unacknowledged alarms
- M acknowledgment clears all alarms and unfreezes the game

---

## Tutorial 6: Publish History and Rollback

**Features exercised**: R2 versioned snapshots, publish history panel, rollback and restore

### M Director steps:
1. Publish the map 3 times with different node arrangements
   - Publish #1: nodes at A1, B2, C3
   - Move a node, Publish #2: nodes at A1, B2, D4
   - Move another node, Publish #3: nodes at A1, E5, D4
2. Click **PUBLISH HISTORY** toggle to expand the history panel
3. See 3 snapshots listed (newest first) with date, author, diff summary, size
4. Click **ROLLBACK** on Publish #1:
   - Ops reverts to the A1/B2/C3 layout
   - M's working draft stays at current positions (A1/E5/D4)
5. Click **RESTORE** on Publish #2:
   - Both Ops AND M's working draft revert to A1/B2/D4
   - Ghost markers clear (working = published)

### What to verify:
- ROLLBACK only affects published_config (what Ops sees)
- RESTORE affects both published_config AND working config
- Audit trail logs the rollback action
- Ops tactical map updates on next 15-second refresh cycle

---

## Quick Reference: Feature Coverage

| Tutorial | M Console Features | Ops Portal Features | Backend Features |
|----------|-------------------|--------------------|--------------------|
| 1. Publish Map | Grid, drag-move, ghost markers, publish button | Tactical map, auto-refresh | Draft/published divergence, WS broadcast |
| 2. Video Intel | Video push UI, filename input | Fullscreen overlay, INTEL FEED card, replay | R2 video serving, WS `video_push`, audit log |
| 3. Directives | Ping controls, MOK feed | Flash notification, ACK, check-in | WS ping delivery, event feed |
| 4. Dispatch | Requirements, readiness, dispatch button | Dashboard refresh on dispatch | `computeReadiness()`, lifecycle, audit trail |
| 5. Alarm/Freeze | Freeze button, alarm badge | ALARM AD[M]IN button, frozen overlay | Alarm broadcast, auto-freeze at 3+ |
| 6. Pub History | History panel, rollback, restore | Map updates on refresh | R2 snapshots, rollback endpoint |
