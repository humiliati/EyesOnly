# Vertical Slice Gap Analysis: Video Push Demo

**Date**: 2026-03-10
**Target**: Stakeholder presentation (tomorrow)
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
        ├──── WebSocket broadcast ──► Connected clients (web + OPS Watch)
        │                              → video takes over screen
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
| Upload UI with drag-and-drop | ✅ WORKS | Sound Designer portal at `/portal/sound-designer.html` |
| Max 50MB per file | ✅ WORKS | Server and client enforce limit |
| List uploaded videos | ✅ WORKS | `GET /api/audio/list?prefix=video/` |

**Gap: Upload lives in the wrong portal.** The Sound Designer portal handles video uploads, but M console has no awareness of uploaded videos. The director would need to open a separate portal to upload, then somehow reference that video from M.

---

### 3. Serve Video from R2

| Need | Status | Notes |
|------|--------|-------|
| `/video/<filename>` serving route | ❌ MISSING | `audio.ts` only mounts `/audio/sfx/*` and `/audio/music/*` — no `/video/*` route |
| Range request support (seeking) | ✅ EXISTS (audio) | `audio.ts` supports Range headers — same logic would work for video |
| MIME type for .mp4 | ❌ MISSING | `audio.ts` MIME map has no `video/mp4` entry |

**Gap: No video serving route.** Videos can be uploaded to R2 (`video/` prefix) but there's no route to serve them back. Need a `GET /video/:filename` route, similar to audio but with video MIME types.

---

### 4. "Push Video" from M Console

| Need | Status | Notes |
|------|--------|-------|
| M console button: "Push Video to Ops" | ❌ MISSING | M console UI has no video management or push UI |
| API endpoint: push video reference to connected clients | ❌ MISSING | No `POST /api/m/video-push` or similar endpoint |
| Video picker / browser in M console | ❌ MISSING | M cannot list or select from uploaded videos |
| WebSocket broadcast with video URL | ❌ MISSING | No `type: 'video_push'` message type defined |
| Web Push fallback for offline devices | ✅ PARTIAL | `POST /api/m/push-broadcast` exists and works — just needs video URL in payload |

**This is the biggest gap.** The entire M-side video push workflow doesn't exist yet:
- No UI in M console to select/upload video
- No API endpoint to trigger video push
- No WebSocket message type for video push broadcast

---

### 5. Client: Web (flapsandseals.com) Video Takeover

| Need | Status | Notes |
|------|--------|-------|
| Debrief feed switches to video display | ✅ SCAFFOLDED | `setVideoPlaying(true)` auto-maximizes debrief, switches to video mode |
| Actual `<video>` element plays the pushed video | ❌ STUB | `_renderVideo()` is a placeholder: "Video player would display here" |
| Video URL received via WebSocket triggers playback | ❌ MISSING | No WS message handler for `type: 'video_push'` |
| Video ends → restore normal display | ✅ SCAFFOLDED | `setVideoPlaying(false)` restores normal state; 60s safety timeout exists |
| `videoOverride` mode flags | ✅ WORKS | `eyesOnlyARG` and `streetChronicles` modes have `videoOverride: true` |

**Gap: The plumbing is there, the player isn't.** The debrief feed knows *how* to switch into video mode and maximize. It just doesn't have an actual video player or a WebSocket listener to trigger it.

---

### 6. Client: OPS Watch App Video Takeover

| Need | Status | Notes |
|------|--------|-------|
| OPS Watch receives video push WS message | ❌ MISSING | Watch app WS handler doesn't know about video messages |
| Video takes over watch screen | ❌ MISSING | Watch app has no video player element or fullscreen video mode |
| Small screen: maybe just show notification + link? | ✅ POSSIBLE | Web Push notification could include a link to open video in browser |

**Gap: The watch app is a telemetry/ping tool, not a media player.** For the watch form factor, a push notification linking to a browser-based video player might be more practical than inline playback.

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

## Gap Summary

```
                    DEMO FLOW                    STATUS
                    ─────────                    ──────
  M logs in ─────────────────────────────────── ✅ Works
  M uploads video ───────────────────────────── ✅ Works (wrong portal)
  M selects video from uploaded list ─────────── ❌ No video browser in M
  M pushes "send to ops" button ──────────────── ❌ No push-video endpoint
  ──── WebSocket sends video URL ─────────────── ❌ No video_push msg type
  ──── Web receives, plays in debrief ────────── ❌ Video player is a stub
  ──── Watch receives, shows notification ────── ❌ No video WS handling
  ──── Web Push sent to offline devices ──────── ✅ Partial (push infra works)
  Ops telemetry flows back to M ──────────────── ✅ Works
```

**5 gaps to close, 4 things already working.**

---

## What Needs to Be Built

### Gap 1: Video Serving Route
**Effort**: 30 minutes
**Files**: `src/worker/routes/audio.ts` or new `src/worker/routes/video.ts`, `src/worker/index.ts`

Add `GET /video/:filename` route that serves from R2 key `video/<filename>` with `video/mp4` MIME type, Range request support, and CORS headers. Can either extend `audio.ts` or create a parallel `video.ts` — same pattern, different MIME map and prefix.

### Gap 2: M Console Video Push Endpoint
**Effort**: 1-2 hours
**Files**: `src/worker/routes/m-mode.ts`

New endpoint: `POST /api/m/video-push`
```
Body: { scenario_id, video_key, title?, target_actor_id? }
```
Actions:
1. Validate video exists in R2 (`HEAD` on key)
2. Broadcast via ScenarioRoom: `{ type: 'video_push', data: { url, title }, audience: 'all'|'target' }`
3. Send Web Push to subscribed devices: `{ title: 'INCOMING INTEL', body: title, data: { video_url } }`
4. Log event: `type: 'video_push'`

### Gap 3: M Console Video UI
**Effort**: 2-3 hours
**Files**: `public/m/index.html` or `public/m/app.js`

Add a "Video Intel" panel to M console:
- List uploaded videos from R2 (call `GET /api/audio/list?prefix=video/`)
- Select a video
- "Push to Ops" button (calls `POST /api/m/video-push`)
- Optional: inline upload dropzone (reuse sound-designer upload logic)
- Optional: target specific actor vs broadcast to all

### Gap 4: Web Client Video Player
**Effort**: 2-3 hours
**Files**: `public/js/debrief-feed-controller.js`, possibly `public/js/login-shell.js`

Replace `_renderVideo()` stub with actual `<video>` element:
- Listen for `type: 'video_push'` on the WebSocket connection
- Call `DebriefFeedController.setVideoPlaying(true)` (already auto-maximizes)
- Inject `<video src="..." autoplay>` into the video container
- On `ended` event: call `setVideoPlaying(false)` (restores normal display)
- Style: fullscreen within debrief area, dark background, centered

### Gap 5: OPS Watch Video Handling
**Effort**: 1 hour
**Files**: `public/ops/watch/index.html`

In the WS message handler, add a case for `type: 'video_push'`:
- Option A (simple): Show a prominent banner with "INCOMING INTEL — TAP TO VIEW" that opens the video URL in a new browser tab
- Option B (richer): Inline `<video>` element that takes over the watch screen temporarily

For the watch form factor, Option A is probably the right call for tomorrow.

---

## Recommended Build Order (Demo-Ready)

| # | Task | Effort | Dependency |
|---|------|--------|------------|
| 1 | Video serving route (`GET /video/*`) | 30 min | None |
| 2 | M video push endpoint (`POST /api/m/video-push`) | 1-2 hr | #1 |
| 3 | Web client video player (replace debrief stub) | 2-3 hr | #1 |
| 4 | M console video UI (list + push button) | 2-3 hr | #2 |
| 5 | OPS Watch video banner | 1 hr | #2 |

**Total estimate: 7-10 hours of focused work.**

Tasks 1-3 form the minimum viable demo: M can trigger a video push via API (curl/Postman), and web clients play it. Task 4 adds the UI so M can do it from the console. Task 5 handles the watch.

**For a tomorrow demo with limited time**: Build #1 + #2 + #3, and demo the M-side push via a curl command or a single button wired into the existing M console UI. Skip the full video browser UI — just add one "Push Video" button that sends a hardcoded or last-uploaded video.

---

## Pre-Existing Assets That Help

These are already built and just need wiring:

- **R2 storage + upload pipeline** — videos can already be uploaded and stored
- **ScenarioRoom broadcast** — audience-filtered WebSocket delivery works
- **Web Push infrastructure** — VAPID, encryption, subscription management all working
- **Debrief video scaffolding** — `setVideoPlaying()`, auto-maximize, 60s safety timeout, `videoOverride` mode flags
- **Sound Designer upload UI** — drag-and-drop + progress tracking + R2 destination selector

The bones are solid. This is a wiring job, not a greenfield build.
