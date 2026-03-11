# Video Intel Push — Build Roadmap

**Created**: 2026-03-10
**Context**: Stakeholder demo 2026-03-11, production rollout TBD
**Companion doc**: `VERTICAL_SLICE_GAP_ANALYSIS.md`

---

## Phase 0: Demo-Ready Minimum (Today)

**Goal**: M can push a video that plays on a connected web client. Enough to demo the concept tomorrow with one device on the table.

**Time budget**: 4-5 hours

### 0.1 — Video Serving Route
**~30 min** · No dependencies

Add `GET /video/:filename` to serve from R2. Clone the pattern from `audio.ts` with a video MIME map (`video/mp4`, `video/webm`, `video/quicktime`). Mount at `/video` in `index.ts` with the same CORS treatment as `/audio`.

Files: `src/worker/routes/video.ts` (new), `src/worker/index.ts`

### 0.2 — M Push Endpoint
**~1 hr** · Depends on 0.1

`POST /api/m/scenario/video-push` behind `requireDirector`:
- Body: `{ video_key: string, title?: string }`
- Validates the key exists in R2 (`HEAD` check)
- Broadcasts via ScenarioRoom: `{ type: 'video_push', data: { url: '/video/<key>', title } }`
- Fires Web Push to all scenario push subscriptions
- Inserts scenario event `type: 'video_push'` for audit trail

Files: `src/worker/routes/m-mode.ts`

### 0.3 — Debrief Video Player (Replace Stub)
**~2 hr** · Depends on 0.1

Replace `_renderVideo()` placeholder with a real `<video>` element. Wire a WebSocket listener for `type: 'video_push'` that calls `setVideoPlaying(true)` and injects the URL. On `ended` / `error` events, call `setVideoPlaying(false)`. The existing auto-maximize and 60s safety timeout do the rest.

Files: `public/js/debrief-feed-controller.js`, WebSocket handler (wherever the client WS `onmessage` lives)

### 0.4 — M Console Quick-Push Button
**~1 hr** · Depends on 0.2

Minimal UI in M console: a collapsible "Video Intel" section with a text input for the video filename (or a dropdown populated from `GET /api/audio/list?prefix=video/`) and a "PUSH TO OPS" button. No drag-and-drop upload needed — use the Sound Designer portal to pre-upload before the demo.

Files: `public/m/index.html` or `public/m/app.js`

### Demo Prep Checklist
- [ ] Pre-upload a short demo video via Sound Designer portal
- [ ] Create a test scenario with at least one ops actor
- [ ] Login as M on one device, ops on another
- [ ] Trigger video push, confirm playback + auto-maximize
- [ ] Verify telemetry still flows during/after video playback

---

## Phase 1: Full M Console Integration (Week of 2026-03-16)

**Goal**: M has a proper video management UI. Upload, browse, preview, push — all from the M console without touching another portal.

**Time budget**: 1 week

### 1.1 — M Console Video Library Panel
**~4 hr**

Full panel in M console showing all uploaded videos with thumbnails (or filename + duration + size). Sortable by upload date. Delete button (with confirm). Preview on click. Reuses the `GET /api/audio/list?prefix=video/` endpoint.

### 1.2 — M Console Inline Video Upload
**~3 hr**

Port the Sound Designer portal's upload dropzone into the M console video panel. Direct-to-R2 upload with progress bar, 50MB limit, filename sanitization. On success, video appears in the library immediately.

### 1.3 — Targeted Push (Actor Selection)
**~2 hr**

Extend the push endpoint and UI to support targeting: push to all ops, push to a specific actor, or push to a team. The ScenarioRoom broadcast already supports `audience: 'target'` routing — just need to thread the target through.

### 1.4 — Push History & Status
**~2 hr**

Show a log of sent video pushes in M console with timestamps, target, and delivery status. Query from the scenario events table (`type: 'video_push'`). Show which actors acknowledged receipt (needs client-side ack — see Phase 2).

---

## Phase 2: Client Polish & Watch Support (Week of 2026-03-23)

**Goal**: Video push feels like a first-class feature on all device types. Reliable, interruptible, and graceful.

**Time budget**: 1 week

### 2.1 — Web Client Video UX Polish
**~4 hr**

- Loading spinner / "INCOMING INTEL..." overlay while video buffers
- Tap-to-dismiss (with "are you sure" if still playing)
- Muted autoplay fallback (browsers block unmuted autoplay without gesture)
- Replay button after video ends (before restoring normal view)
- CRT scanline overlay on the video element to maintain aesthetic
- Portrait and landscape handling

### 2.2 — Video Acknowledge Callback
**~2 hr**

Client sends `{ type: 'video_ack', video_event_id, status: 'playing'|'completed'|'dismissed' }` back through the WebSocket. M console shows real-time delivery receipts. Feeds into the push history panel from 1.4.

### 2.3 — OPS Watch Video Handling
**~3 hr**

- WS handler for `type: 'video_push'` — show a fullscreen banner: **⚠ INCOMING INTEL** with a pulsing "TAP TO VIEW" button
- Tap opens the video URL in the device's default browser (watch screen is too small for inline playback)
- Vibration pattern on receive (if Vibration API available)
- Web Push payload includes video URL so backgrounded watches get a tappable notification

### 2.4 — Autoplay Policy Handling
**~2 hr**

Browsers require a user gesture before unmuted autoplay. Strategy:
- First attempt: autoplay muted, show "TAP FOR AUDIO" overlay
- If user has previously interacted with the page (which they will have — they're playing a game), autoplay with audio should work
- Fallback: show play button overlay styled as an intel briefing prompt

### 2.5 — Edge Cases & Resilience
**~2 hr**

- Video push while another video is already playing (queue or replace?)
- Client reconnects mid-video (ScenarioRoom should re-send active video state on WS connect)
- R2 video deleted after push (graceful error in player)
- Multiple concurrent scenarios (video scoped to correct scenario)

---

## Phase 3: Customer-Facing Documentation (Week of 2026-03-30)

**Goal**: M directors and ops field operatives can set up and use the video push system without developer hand-holding. Documentation lives in-app and as standalone guides.

**Time budget**: 1 week

### 3.1 — M Director Guide: "Pushing Video Intel"
**~4 hr** · Format: In-app help panel + standalone HTML/PDF

Audience: The person sitting at the M console during a live exercise.

Contents:
- What video intel push does (one paragraph, plain language)
- Supported video formats and size limits
- How to upload a video (step-by-step with screenshots)
- How to push to all ops vs a specific actor
- How to verify delivery (reading the push history / ack status)
- Troubleshooting: "video not playing", "actor didn't receive", "push button greyed out"
- Best practices: keep videos short (30s-2min), use descriptive titles, don't push during high-action moments unless it's urgent

### 3.2 — OPS Field Guide: "Receiving Video Intel"
**~3 hr** · Format: In-app tooltip + standalone HTML/PDF

Audience: The person in the field with the watch or phone.

Contents:
- What to expect when M pushes a video (screen takeover, notification)
- How to dismiss a video early
- How to replay a missed video
- What happens if you're offline when a push arrives
- Watch vs phone vs desktop differences
- FAQ: "Can I still send telemetry during video?", "Does it use my data?"

### 3.3 — Scenario Setup Guide: "Configuring Video Intel"
**~3 hr** · Format: Standalone doc (for whoever sets up the exercise)

Audience: The person who creates scenarios and configures the tech before an exercise.

Contents:
- Prerequisites (R2 bucket configured, VAPID keys set, scenario created)
- Pre-uploading videos for the exercise
- Naming conventions for video files
- Testing the push pipeline before the exercise starts
- Bandwidth considerations for field deployments (video size vs cellular)
- Checklist: pre-exercise video system validation

### 3.4 — In-App Contextual Help
**~2 hr**

- Tooltip on the M console "Push Video" button explaining what it does
- First-time-use prompt in M console video panel with a brief walkthrough
- Ops-side: brief "INCOMING INTEL" explainer the first time a video push is received
- Link to full docs from all help touchpoints

### 3.5 — Tutorial Floor / Demo Scenario
**~3 hr**

A pre-built "training" scenario with a pre-uploaded video that walks through the flow:
1. New M director logs in
2. Scenario has one simulated ops actor
3. Guided steps: upload video → push to ops → see delivery confirmation
4. Can be reused for onboarding new M operators before live exercises

---

## Phase 4: Production Hardening (Week of 2026-04-06)

**Goal**: The video push system is reliable under real field conditions.

### 4.1 — Video Transcoding / Optimization
Uploaded videos may be too large for cellular. Options:
- Client-side compression before upload (FFmpeg.wasm)
- Server-side transcoding via Cloudflare Stream or Workers AI
- Multiple quality tiers with adaptive bitrate

### 4.2 — Video Expiry & Storage Management
Videos shouldn't live in R2 forever:
- Auto-delete after scenario ends (or after N days)
- Storage usage dashboard in M console
- Per-scenario storage quotas

### 4.3 — Offline Video Caching
For ops in low-connectivity areas:
- Service worker caches pushed videos
- Playback works even if connection drops after initial download
- Pre-cache critical videos during scenario setup (while still on WiFi)

### 4.4 — Analytics & Observability
- Push delivery latency (M sends → client plays)
- Video completion rates
- Bandwidth usage per scenario
- Error rates by device type

---

## Timeline Summary

```
Week of 3/10  ██████░░░░░░░░░░  Phase 0: Demo minimum (today)
Week of 3/16  ████████████░░░░  Phase 1: Full M console integration
Week of 3/23  ████████████░░░░  Phase 2: Client polish + watch
Week of 3/30  ████████████░░░░  Phase 3: Customer docs + tutorials
Week of 4/06  ████████████░░░░  Phase 4: Production hardening
```

Phases 1 and 2 can overlap if two people are working (one on M console, one on client). Phase 3 can start as soon as the UX is stable enough to screenshot. Phase 4 is ongoing and can be prioritized based on field feedback.

---

## Appendix A: Contractor Brief — Task 1.2 (M Console Inline Video Upload)

**Task**: Port the Sound Designer portal's upload widget into the M Console so directors can upload video directly from their command interface.

**No-dependency**: This task can be started immediately. It does not depend on the video serving route, push endpoint, or video player.

**Estimated effort**: 3 hours

### What exists today

The Sound Designer portal (`public/portal/sound-designer.html` + `public/portal/js/sound-designer.js`) has a fully working upload widget:

- Drag-and-drop dropzone + click-to-browse file picker
- Client-side validation: 50MB max, allowed extensions `.wav .mp3 .ogg .webm .m4a .mp4 .opus`
- Destination selector: `sfx`, `music`, or `video` (maps to R2 key prefixes `audio/sfx/`, `audio/music/`, `video/`)
- Upload queue with per-file status tracking (`queued` → `uploading` → `done` | `error`)
- Progress bar UI (simplified: 0% → 50% on start → 100% on complete)
- Upload history log

The server endpoint is `POST /api/audio/upload` (in `src/worker/routes/audio-upload.ts`). It accepts `FormData` with three fields: `file` (blob), `destination` (string), `filename` (string). It writes to R2 via `c.env.R2.put()` with auto-detected MIME type and timestamp metadata. Response: `{ ok: true, key: "video/filename.mp4", size: 12345, contentType: "video/mp4" }`.

**The server endpoint does not need any changes.** This task is client-side only.

### What to build

Add a "Video Upload" section to the M Console UI (`public/m/index.html` or the relevant M console JS file). The section should contain:

1. **A dropzone** — drag-and-drop area or click-to-browse. Accept `video/*,.mp4,.webm` only (not audio — M console is for video intel, not sound design). Use the same dropzone pattern from `sound-designer.js` lines 779–810.

2. **An upload queue** — list of queued/uploading/done/error files with progress indicators. Same pattern as `sound-designer.js` lines 617–722.

3. **An upload function** — `POST /api/audio/upload` with `FormData`. Set `destination` to `"video"` always (hardcoded — no destination selector needed in M console). Same fetch pattern as `sound-designer.js` lines 649–698.

4. **On success**: refresh the video library list (if task 1.1 is also complete) or just show a success toast with the R2 key.

### API contract (no changes needed)

```
POST /api/audio/upload
Content-Type: multipart/form-data

Fields:
  file        — File blob (required, max 50MB)
  destination — "video" (required, hardcode this)
  filename    — original filename (optional, defaults to file.name)

Response 200:
  { ok: true, key: "video/demo-intel.mp4", size: 8392710, contentType: "video/mp4" }

Response 400: { ok: false, error: "No file provided" }
Response 413: { ok: false, error: "File too large (55.2 MB > 50 MB limit)" }
```

### Acceptance criteria

- [ ] M console has a visible "Upload Video" area (collapsible panel or section)
- [ ] Drag-and-drop works; click-to-browse works
- [ ] Files > 50MB are rejected client-side with a toast message
- [ ] Non-video files are rejected client-side (only `.mp4`, `.webm` accepted)
- [ ] Upload progress is visible per file (queued / uploading / done / error)
- [ ] Upload completes successfully — verify with `GET /api/audio/list?prefix=video/`
- [ ] Multiple files can be queued and uploaded sequentially
- [ ] No auth is required on the upload endpoint (matches current sound designer behavior)
- [ ] Existing M console functionality is not broken (no regressions in scenario control, event feed, etc.)

### Files to reference (read-only)

- `public/portal/js/sound-designer.js` — lines 617–810 for the upload widget pattern
- `public/portal/sound-designer.html` — lines 1078–1095 for the dropzone HTML structure
- `src/worker/routes/audio-upload.ts` — server handler (do not modify)

### Files to modify

- `public/m/index.html` or `public/m/app.js` — add the upload section UI + JS

### Do NOT

- Modify the server upload endpoint
- Add authentication to the upload endpoint
- Add a destination selector (hardcode `"video"`)
- Touch the Sound Designer portal (it stays as-is)
- Implement video preview or playback (that's a different task)
- Implement the "push to ops" button (that's task 0.4)

---

## Appendix B: Contractor Brief — Task 4.2 (Video Expiry & Storage Management)

**Task**: Build a storage management system so videos uploaded to R2 don't accumulate indefinitely. Includes automated cleanup, usage visibility, and optional quotas.

**No-dependency**: This task can be started immediately. It uses existing R2 CRUD endpoints and the scenario lifecycle — it does not depend on any video push plumbing.

**Estimated effort**: 6-8 hours (can be split across sub-tasks)

### What exists today

**R2 CRUD** (`src/worker/routes/audio-upload.ts`) already provides:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/audio/list?prefix=video/&limit=100` | List R2 objects under a prefix. Returns `{ files: [{ key, size, uploaded, contentType }], truncated }` |
| `DELETE /api/audio/delete?key=video/demo.mp4` | Delete a single R2 object |
| `POST /api/audio/delete-batch` | Delete multiple R2 objects. Body: `{ keys: ["video/a.mp4", "video/b.mp4"] }` |

All R2 objects have `customMetadata.uploadedAt` (ISO timestamp) set at upload time.

**Scenario lifecycle** (`src/worker/db/queries.ts`) provides:

- `updateScenarioStatus(db, id, status)` — sets scenario status (e.g., `'active'`, `'ended'`, `'archived'`)
- `listActiveScenarios(db)` — returns all scenarios with `status = 'active'`
- The `scenarios` table has `id`, `name`, `status`, `created_at`, `updated_at`

**Scheduled handler** (`src/worker/index.ts`) already runs a cron job (deadman check). The pattern for adding another scheduled task is established.

### What to build

#### 4.2.1 — Video cleanup endpoint

`POST /api/m/video-cleanup` behind `requireDirector`:

- Body: `{ mode: 'preview' | 'execute', max_age_days?: number }`
- Lists all R2 objects under `video/` prefix
- Identifies videos older than `max_age_days` (default: 30) using `customMetadata.uploadedAt`
- `mode: 'preview'`: returns the list of videos that would be deleted with their sizes
- `mode: 'execute'`: actually deletes them via `R2.delete()`, returns count + total bytes freed
- Response: `{ videos: [{ key, size, uploadedAt, age_days }], total_size, count }`

#### 4.2.2 — Storage usage endpoint

`GET /api/m/video-storage` behind `requireDirector`:

- Lists all R2 objects under `video/` prefix (paginate with `R2.list()` cursor if > 1000 objects)
- Returns: `{ total_files, total_size_bytes, total_size_human, oldest_upload, newest_upload }`
- Optional breakdown by age bucket: last 24h, last 7d, last 30d, older

#### 4.2.3 — Automated cleanup via cron (optional, lower priority)

Extend the existing `scheduled()` export in `src/worker/index.ts`:

- After the deadman check, run a video cleanup pass
- Delete videos older than a configurable threshold (default: 90 days)
- Log deletions to console for observability
- Only runs if `VIDEO_AUTO_CLEANUP_DAYS` env var is set (opt-in)

#### 4.2.4 — M console storage widget (optional, lower priority)

Small panel in M console showing:

- Total video storage used (call `GET /api/m/video-storage`)
- "Clean up old videos" button (calls `POST /api/m/video-cleanup` with preview first, confirm, then execute)
- List of oldest N videos with individual delete buttons

### Key implementation details

**Paginating R2 list**: R2 returns max 1000 objects per `list()` call. For the storage endpoint, paginate:

```typescript
let cursor: string | undefined;
let totalSize = 0;
let totalFiles = 0;
do {
  const listed = await c.env.R2.list({ prefix: 'video/', limit: 1000, cursor });
  for (const obj of listed.objects) {
    totalSize += obj.size;
    totalFiles++;
  }
  cursor = listed.truncated ? listed.cursor : undefined;
} while (cursor);
```

This pattern already exists in `audio-upload.ts` (the `list-all` helper around line 237).

**Age calculation**: Compare `customMetadata.uploadedAt` (ISO string) against `Date.now()`. If `uploadedAt` is missing (old uploads), fall back to `obj.uploaded` (R2's built-in upload timestamp).

**Auth**: All new endpoints go behind `requireDirector` middleware — only M console users can view storage or trigger cleanup.

### Acceptance criteria

- [ ] `GET /api/m/video-storage` returns accurate file count and total size
- [ ] `POST /api/m/video-cleanup` with `mode: 'preview'` lists videos that would be deleted without deleting anything
- [ ] `POST /api/m/video-cleanup` with `mode: 'execute'` actually deletes old videos and returns the count
- [ ] Videos younger than `max_age_days` are never deleted
- [ ] Endpoints require director auth (return 401/403 without valid director token)
- [ ] Works correctly with 0 videos (empty state)
- [ ] Works correctly with > 1000 videos (pagination)

### Files to modify

- `src/worker/routes/m-mode.ts` — add new endpoints
- `src/worker/index.ts` — optional: add cron cleanup to `scheduled()` handler

### Files to reference (read-only)

- `src/worker/routes/audio-upload.ts` — existing R2 CRUD patterns, pagination, delete-batch
- `src/worker/middleware/auth.ts` — `requireDirector` middleware
- `src/worker/db/queries.ts` — `listActiveScenarios`, `updateScenarioStatus` (for future scenario-scoped cleanup)

### Do NOT

- Modify the upload endpoint or its behavior
- Delete audio files (sfx/music) — only operate on the `video/` prefix
- Add R2 lifecycle rules via Wrangler config (we want application-level control, not bucket-level)
- Implement per-scenario video scoping yet (that requires linking videos to scenarios at upload time, which is a separate design decision)
- Touch the video push pipeline or debrief feed
