# Vertical Slice Gap Analysis: Video Push Demo

**Date**: 2026-03-10 | **Updated**: 2026-03-11
**Target**: Stakeholder presentation
**Objective**: M uploads video → pushes to ops/players → takes over their screen

---

## The Demo Flow

```
M Director logs into M Console
        │
        ▼
M uploads a video (or selects an already-uploaded one)
        │
        ▼
M pushes a button → "Send video to ops"
        │
        ├──── WebSocket broadcast ──► Connected clients (web + OPS Portal)
        │                              → fullscreen video takeover
        │                              → persistent INTEL FEED card
        │
        └──── Web Push notification ──► Offline/backgrounded devices
                                        → tap opens video
```

---

## Component Status

### 1. M Console Login

| Need | Status | Notes |
|------|--------|-------|
| Director authenticates to M console | ✅ WORKS | `POST /api/auth/login` with callsign + password + scenario_id |
| M console UI loads with scenario control | ✅ WORKS | `public/m/index.html`, WebSocket connected to ScenarioRoom |

**No gaps.** Director login is fully functional.

---

### 2. Video Upload to R2

| Need | Status | Notes |
|------|--------|-------|
| Upload .mp4 to storage | ✅ WORKS | `POST /api/audio/upload` with `destination=video` → R2 key `video/<filename>` |
| Upload UI with drag-and-drop | ✅ WORKS | Media Designer portal at `/portal/sound-designer.html` |
| Max 50MB per file | ✅ WORKS | Server and client enforce limit |
| List uploaded videos | ✅ WORKS | `GET /api/audio/list?prefix=video/` |

**Gap partially closed.** Upload still lives in Media Designer portal, but M console now has a filename input for quick push. Phase 1 (M Console Video Library + Inline Upload) will fully close this gap.

---

### 3. Serve Video from R2

| Need | Status | Notes |
|------|--------|-------|
| `/video/<filename>` serving route | ✅ WORKS | `GET /video/:filename` route mounted in `index.ts` with video MIME map |
| Range request support (seeking) | ✅ WORKS | Same Range header logic as audio routes |
| MIME type for .mp4 | ✅ WORKS | Video MIME map includes `video/mp4`, `video/webm`, etc. |

**No gaps.** Video serving is fully operational.

---

### 4. "Push Video" from M Console

| Need | Status | Notes |
|------|--------|-------|
| M console button: "Push Video to Ops" | ✅ WORKS | Video Intel section with PUSH TO OPS button in M console |
| API endpoint: push video reference to connected clients | ✅ WORKS | `POST /api/m/scenario/video-push` validates R2 key, broadcasts, logs audit |
| Video picker / browser in M console | ✅ PARTIAL | Filename input field (dropdown from R2 list planned for Phase 1) |
| WebSocket broadcast with video URL | ✅ WORKS | `type: 'video_push'` message broadcast via ScenarioRoom |
| Web Push fallback for offline devices | ✅ WORKS | Web Push fired alongside WS broadcast with video URL in payload |

**Gap closed for demo.** Full video library/browser UI is Phase 1 work.

---

### 5. Client: Ops Portal Video Takeover

| Need | Status | Notes |
|------|--------|-------|
| Fullscreen video overlay on push | ✅ WORKS | Red signal indicator, title bar, auto-close on ended, error fallback |
| Persistent INTEL FEED card | ✅ WORKS | First card on Ops dashboard with inline replay, fullscreen button, red glow on new intel |
| Video URL received via WebSocket triggers playback | ✅ WORKS | WS handler for `type: 'video_push'` triggers fullscreen + card update |
| Video ends → restore normal display | ✅ WORKS | Auto-close 2s after ended event |
| Touch-friendly Ops login | ✅ WORKS | `inputmode="text"`, `min-height:48px` buttons, `@media (pointer: coarse)` |

**No gaps.** Ops Portal video takeover is fully operational with persistent INTEL FEED card.

---

### 6. Client: OPS Watch App Video Takeover

| Need | Status | Notes |
|------|--------|-------|
| OPS Watch receives video push WS message | ✅ WORKS | WS handler for `video_push` → fullscreen video takeover |
| Video takes over watch screen | ✅ WORKS | Inline `<video>` fills viewport, TAP TO PLAY fallback if autoplay blocked |
| Dismiss button during playback | ✅ WORKS | ✕ DISMISS button always visible, replay bar after video ends |
| Vibration alert on receive | ✅ WORKS | `[200, 100, 200, 100, 400]` pattern via Vibration API |
| Web Push notification with video link | ✅ WORKS | SW `video_push` tag with ▶ VIEW action, opens app and triggers takeover |

**No gaps.** Watch video takeover is fully operational with autoplay fallback, replay, and push notification support.

---

### 7. Telemetry Flowing Back to M

| Need | Status | Notes |
|------|--------|-------|
| OPS Watch sends GPS telemetry | ✅ WORKS | `POST /api/ops/telemetry` every 30s with lat/lng/accel/motion |
| M console receives telemetry in real time | ✅ WORKS | ScenarioRoom broadcasts `actor_telemetry` to directors |
| M sees actor positions on grid | ✅ WORKS | UGRS grid with actor badges, color-coded by team |
| Deadman alerts for lost contact | ✅ WORKS | Cloudflare cron runs every 5min, triggers Web Push |

**No gaps.** Telemetry is fully operational.

---

### 8. Scenario Management (NEW — implemented since original analysis)

| Need | Status | Notes |
|------|--------|-------|
| UGRS grid with tile stitcher | ✅ WORKS | Configurable grid with map image overlay, zoom+pan, cell status colors |
| Draft vs published config | ✅ WORKS | M edits working draft; Ops sees frozen published snapshot |
| Publish with ghost markers | ✅ WORKS | Dotted 40% opacity ghosts show where published nodes were |
| Drag-move nodes mid-game | ✅ WORKS | Click node → click destination cell, instant re-render |
| Publish history + rollback | ✅ WORKS | R2-backed versioned snapshots, ROLLBACK and RESTORE per snapshot |
| Readiness checks | ✅ WORKS | Server-side `computeReadiness()` validates actors, drops, join codes, grid |
| Dispatch lifecycle | ✅ WORKS | draft → staged → deployed → active → paused → completed → archived |
| Dispatch audit trail | ✅ WORKS | `dispatch_audit` table with full M console viewer panel |
| M directives (pings) | ✅ WORKS | 8 commands (MOVE, HOLD, ENGAGE, SHADOW, DROP, ESCALATE, EXTRACT, FREEZE) |
| Ops check-in protocol | ✅ WORKS | Lane + message fields, GPS auto-attach, event feed |
| ALARM AD[M]IN system | ✅ WORKS | Ops raises alarm → M sees badge → auto-freeze at 3+ alarms |
| Freeze/unfreeze | ✅ WORKS | Full-screen overlay blocks all Ops interactions |

**No gaps.** Full scenario management pipeline is operational.

---

## Gap Summary (Updated)

```
                    DEMO FLOW                    STATUS
                    ─────────                    ──────
  M logs in ─────────────────────────────────── ✅ Works
  M uploads video ───────────────────────────── ✅ Works (Media Designer portal)
  M selects video from uploaded list ─────────── ✅ Works (filename input, full browser Phase 1)
  M pushes "send to ops" button ──────────────── ✅ Works
  ──── WebSocket sends video URL ─────────────── ✅ Works
  ──── Ops receives, plays fullscreen ───────── ✅ Works (+ persistent INTEL FEED card)
  ──── Watch receives, plays fullscreen ──────── ✅ Works (+ TAP TO PLAY + replay)
  ──── Web Push sent to offline devices ──────── ✅ Works
  Ops telemetry flows back to M ─────────────── ✅ Works
  Scenario management (publish/dispatch) ────── ✅ Works
  M directives + Ops check-in ───────────────── ✅ Works
  Alarm + freeze safety system ──────────────── ✅ Works
```

**0 gaps remaining. All 12 features operational.**

---

## What Still Needs to Be Built

All vertical slice gaps are closed. Remaining work is enhancement:

### Phase 1: Full M Console Video Integration (Planned)
See VIDEO_PUSH_ROADMAP.md for full details:
- 1.1 Video library panel with thumbnails, sort, delete
- 1.2 Inline video upload dropzone in M console
- 1.3 Targeted push (specific actor or team)
- 1.4 Push history with delivery status

### Phase 2-4: Polish, Docs, Production Hardening (Planned)
See VIDEO_PUSH_ROADMAP.md for full details.

---

## Pre-Existing Assets That Help

These are already built and operational:

- **R2 storage + upload pipeline** — videos upload and store reliably
- **Video serving route** — `GET /video/:filename` with Range support and video MIME types
- **ScenarioRoom broadcast** — audience-filtered WebSocket delivery
- **Web Push infrastructure** — VAPID, encryption, subscription management
- **M Console video push** — endpoint + UI button + audit logging
- **Ops fullscreen video player** — WS listener, fullscreen overlay, auto-close, error fallback
- **Ops INTEL FEED card** — persistent card with inline replay and fullscreen buttons
- **Publish + dispatch pipeline** — draft/published divergence, readiness checks, dispatch lifecycle
- **Audit trail** — full dispatch_audit table with M console viewer

The vertical slice is demo-ready. The remaining work is polish and watch support.
