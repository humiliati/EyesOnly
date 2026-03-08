# Audio Wiring Roadmap

> **Date:** 2026-03-08 (last updated)
> **Status:** Phase 0 + Phase 2 complete, Phase 1 deferred (pending card hand harmonization), transcoding shipped, Sound Designer portal live

---

## Runtime Weight: ✅ Transcoded & Deployed

All 167 assets have been transcoded from WAV to Opus/WebM (+ MP3 fallback) and uploaded to the `eyesonly-assets` R2 bucket. Both original WAV and transcoded WebM/MP3 formats are live on R2.

**Manifest note:** `audio-manifest.json` `src` fields still reference `.wav` paths. The R2 bucket serves both formats. When ready to cut WAV delivery entirely, update manifest paths from `.wav` → `.webm` and optionally purge WAV files from R2.

**Safari note:** Safari 15.4+ supports Opus natively. The MP3 fallbacks on R2 cover older Safari. A future `AudioSystem` enhancement could try `.webm` first then fall back to `.mp3`.

---

## What's Wired Now (Phase 0)

| System | File | Sound | Status |
|---|---|---|---|
| Explosion | explosion-system.js:195 | `explosion_large` → (needs manifest alias) | ✅ Existing |
| Breakable hit | breakable-system.js:31 | `hit-{1..4}` random | ✅ New |
| Breakable destroy | breakable-system.js:33 | `impact-{1..4}` random | ✅ New |
| Kick breakable | breakable-system.js:751 | `low-attack-{1..3}` random | ✅ New |
| Item pickup (ammo) | pickup-system.js:24 | `grab-item-1` | ✅ New |
| Item pickup (gem) | pickup-system.js:25 | `power-up-{1..3}` random | ✅ New |
| Item pickup (key) | pickup-system.js:26 | `success-1` | ✅ New |
| Item pickup (card) | pickup-system.js:27 | `coin-{1..2}` random | ✅ New |
| Item pickup (other) | pickup-system.js:28 | `grab-item-2` | ✅ New |
| Floor transition out | floor-transition-system.js:22 | `descend-{1..3}` random | ✅ New |
| Floor transition in | floor-transition-system.js:29 | `ascend-{1..3}` random | ✅ New |
| `data-sound` buttons | audio-system.js (delegate) | Any — reads attribute | ✅ New |
| `playRandom()` helper | audio-system.js | Variant picker utility | ✅ New |

---

## Phase 1 — Combat & Cards (Priority: HIGH) ⏸ DEFERRED

> Deferred until `CARD_HAND_HARMONIZATION_ROADMAP.md` is further along. Combat card play hooks depend on the harmonized card system API.

These directly affect game feel during the core loop.

### 1.1 STR Combat Engine — `str-combat-engine.js`

| Event | Where | Suggested Sound |
|---|---|---|
| Hit lands | `calculateHit()` success path | `hit-{1..4}` + weapon variant |
| Miss / dodge | `calculateHit()` fail path | `attack-miss` |
| Critical hit | Crit detection | `impact-{1..4}` at volume 1.0 |
| Player takes damage | `onDamageDealt` callback | `hit-{1..4}` at lower volume |
| Enemy killed | `onEnemyKilled` callback | `enemy-die` or `enemy-die-2` |

### 1.2 Card Play — `card-play-system.js`

| Event | Where | Suggested Sound |
|---|---|---|
| Card played (attack) | `resolveAction()` type='attack' | `attack-{1..5}` |
| Card played (magic) | `resolveAction()` type='magic' | `magic-{1..4}` |
| Card played (support) | `resolveAction()` type='support' | `ui-03` |
| Insufficient resources | Cost check fail | `cant-go-past-1` |
| Card discard | `card-drag-controller.js` discard | `misc-{1..7}` |

### 1.3 Information Duel — `information-duel-engine.js`

| Event | Suggested Sound |
|---|---|
| Duel start | `phone-ring` or custom alert |
| Question correct | `success-{1..2}` |
| Question wrong | `misc-4` |
| Duel won | `victory-1` or `success-3` |
| Duel lost | `enemy-4` |

**Estimated effort:** ~40 lines across 3 files.

---

## Phase 2 — UI Feedback (Priority: HIGH) ✅ COMPLETE

### 2.1 `data-sound` Attribute Rollout

The global delegate is live — `data-sound="<name>"` on any HTML element auto-plays on pointerdown.

| Button | `data-sound` | Status |
|---|---|---|
| Back button | `ui-01` | ✅ |
| Inventory | `ui-02` | ✅ |
| Login / Kernel | `ui-03` | ✅ |
| Score / Help | `ui-04` | ✅ |
| Cards toggle (hand fan) | `ui-05` | ✅ |

### 2.2 Hand Fan & Card Selection — `hand-fan-component.js`

| Event | Sound | Status |
|---|---|---|
| Fan expand (`show()`) | `whoosh-1` vol 0.4 | ✅ |
| Fan collapse (`hide()`) | `whoosh-2` vol 0.4 | ✅ |
| Card hover/focus (mouseenter) | `ui-06` vol 0.3 | ✅ |
| Card select (`_toggleCardSelection()`) | `ui-01` vol 0.5 | ✅ |

### 2.3 Shop System — `shop-system.js`

| Event | Sound | Status |
|---|---|---|
| Shop open (`openShop()`) | `ui-07` vol 0.5 | ✅ |
| Shop close (`closeShop()`) | `ui-04` vol 0.4 | ✅ |
| Purchase success (`_executePurchase()`) | `coin-{1..2}` + `success-1` | ✅ |
| Purchase fail (can't afford) | `cant-go-past-1` vol 0.5 | ✅ |
| Gamble win (`_executeGamble()`) | `power-up-{1..3}` vol 0.6 | ✅ |
| Gamble loss | `cant-go-past-2` vol 0.5 | ✅ |

---

## Phase 3 — Environment & Ambience (Priority: MEDIUM) ✅ COMPLETE

### 3.1 Biome Music — `floor-transition-system.js` ✅

Biome-appropriate music starts on every floor transition via `_playBiomeMusic(ctx)` helper in `floor-transition-system.js`. `AudioSystem.stopMusic()` fires during `_fadeOut()`, then `_playBiomeMusic()` fires after `generateFloor()` completes in all three transition paths (advance, retreat, interior exit).

| Biome / Context | Music Key | Status |
|---|---|---|
| FOREST (day) | `music-forest` | ✅ |
| FOREST (night) / SKI_MOUNTAIN | `music-exterior-night` | ✅ |
| GREY_CAVE | `music-cave` | ✅ |
| MALL | `music-mall` | ✅ |
| INDUSTRIAL | `music-industrial` | ✅ |
| OFFICE | `music-office` | ✅ |
| AEROSPACE | `music-82nd-all-the-way` | ✅ |
| LAKE (day) | `music-exterior` | ✅ |
| LAKE (night) | `music-exterior-night` | ✅ |
| Interior (default) | `music-default-interior` | ✅ |
| Fallback (day) | `music-exterior` | ✅ |
| Fallback (night) | `music-exterior-night` | ✅ |

Day/night alternation: even floors = night.

### 3.2 Ground Effects — `ground-effects-system.js` ✅

| Effect | Sound | Where | Status |
|---|---|---|---|
| Fire/hazard tile step | `rumble-1` vol 0.4 | `applyTileEffects()` hazard branch | ✅ |
| Water tile step | `water-{1..3}` random vol 0.3 | `applyTileEffects()` water branch | ✅ |
| Ice combat modifier | `ice-1` vol 0.3 | `applyPlayerGroundModifier()` ICE branch | ✅ |

**Note:** Dedicated fire SFX replaced with `rumble-1` (low rumble conveys heat damage). `ice-1` used for ice slide.

### 3.3 Light Source Destruction — `breakable-system.js` ✅

| Source Type | Sound | Where | Status |
|---|---|---|---|
| Campfire | `rumble-1` vol 0.35 | `_destroyCampfire()` | ✅ |
| Torch | `whoosh-1` vol 0.25 | `_destroyTorch()` | ✅ |
| Lamp post | `metal-hit-{1..2}` random vol 0.5 | `_destroyLampPost()` | ✅ |
| Electronic (Monitor/Terminal) | `particles-dark` vol 0.45 | `_destroyElectronic()` | ✅ |
| Light bulb | `impact-1` vol 0.4 | `_destroyLightBulb()` | ✅ |

**Note:** Campfire destruction uses `rumble-1` (low rumble for fire extinguish). Electronic destruction uses `particles-dark` (digital glitch/spark sound).

---

## Phase 4 — Enemy & Stealth (Priority: MEDIUM)

### 4.1 Enemy AI — `enemy-ai-system.js`

| Event | Suggested Sound |
|---|---|
| Enemy enters alert | `ui-07` at increasing volume |
| Enemy detects player | `phone-ring` or alarm SFX |
| Enemy loses player | `descend-1` quiet |
| Enemy patrol step | (footstep at low volume, only if close to player) |

### 4.2 Enemy Death — Various combat files

| Event | Suggested Sound |
|---|---|
| Regular enemy kill | `enemy-die` |
| Elite enemy kill | `enemy-die-2` |
| Boss encounter start | Boss music track |

### 4.3 Stealth System — `stealth-system.js`

| Event | Suggested Sound |
|---|---|
| Enter stealth | `whoosh-1` quiet |
| Stealth break (detected) | `alert-1` or `phone-ring` |
| Sprint footsteps | `footsteps-{1..4}` rapid |

---

## Phase 5 — Death, Victory, Run Events (Priority: LOW)

### 5.1 Death Sequence — `death-exit-system.js`

| Event | Suggested Sound |
|---|---|
| Player death | `enemy-4` or death jingle |
| Death music | `music-death-exit` via `playMusic()` |
| Game over screen | fade to silence |

### 5.2 Victory / Run Complete — `str-victory-sequence.js`

| Event | Suggested Sound |
|---|---|
| Combat victory | `success-{1..3}` |
| Floor cleared | `victory-1` |
| Run complete | Victory music track |

### 5.3 Run Start — `run-start-system.js`

| Event | Suggested Sound |
|---|---|
| New run begins | `ui-07` + exterior music |
| Tutorial start | `phone-ring` |

---

## Phase 6 — Polish & Advanced (Priority: LOW)

### 6.1 Positional Audio

`AudioSystem.play()` already accepts `{ x, y }` options (currently unused). Future: attenuate SFX volume by distance from player using `(1 - dist/maxDist)` factor.

### 6.2 Footstep Surface Variants

Use biome tile data to select footstep sound: metal grates → `metal-hit-1`, grass → `footsteps-1`, stone → `footsteps-3`, wood → `wood`.

### 6.3 Combat Narration Voice Lines

`combat-narration-system.js` MOK interjections could trigger a subtle notification blip (`ui-01`) to draw attention to the debrief feed.

### 6.4 Dialogue System SFX

`dialogue-system.js` NPC interactions: play `ui-03` on dialogue open, `ui-01` on text advance.

### 6.5 Currency Magnet Collect Chain

When magnet activates and pulls multiple coins, play `coin-1`/`coin-2` in rapid ascending pitch sequence.

---

## Phase 7 — Music Slicer Tool (Priority: MEDIUM)

> **Status:** Roadmap spec — not yet implemented

### Overview

In-browser tool within the Sound Designer portal that lets designers slice segments from full-length music tracks and export them as new SFX entries. This eliminates the need for external audio editors when creating stingers, loops, transitions, and ambient snippets from the 16 music tracks.

### 7.1 UI — Waveform Region Selection

Add a dedicated "Slicer" tab to the Sound Designer center panel (alongside Preview, Assign, Upload):

- **Waveform display**: full-track waveform rendered from `AnalyserNode` or decoded buffer (music tracks are already streamable via `<audio>` element)
- **Selection handles**: draggable start/end markers on the waveform canvas. Click-and-drag to define a region. Handles show timecodes (MM:SS.ms).
- **Zoom controls**: horizontal zoom in/out for precision selection on long tracks
- **Playhead**: thin vertical line showing current playback position, auto-scrolls during play

### 7.2 Preview & Refinement

- **Play selection**: plays only the selected region (set `audio.currentTime` to start, pause at end)
- **Play full**: plays the entire track with the selection region highlighted
- **Loop toggle**: loops the selection for previewing loop points
- **Fade in/out**: optional fade envelope applied to the snippet (linear or exponential, 0–500ms configurable)
- **Trim silence**: auto-detect and trim leading/trailing silence from selection (threshold-based)

### 7.3 Export Pipeline

When the designer clicks "Export Snippet":

1. **Client-side extraction**: use `OfflineAudioContext` to render the selected region to a new `AudioBuffer`
2. **Encode**: use `MediaRecorder` with `audio/webm;codecs=opus` to encode the snippet (or fall back to WAV if MediaRecorder doesn't support Opus)
3. **Metadata form**: prompt for:
   - Sound ID (auto-suggested from parent track + timecode, e.g., `music-clubbed-to-death--0m32s-0m38s`)
   - Display name
   - Category (default: same as parent, but switchable — e.g., `combat` for a battle stinger)
   - Loop flag
   - Tags
4. **Upload to R2**: POST to `/api/audio/upload` with destination `sfx/` (snippets become SFX, not music)
5. **Register in manifest**: auto-append to `audio-manifest.json` (or queue for manual manifest update)
6. **Update static library**: inject a new `<button>` into the sidebar under the target category

### 7.4 Batch Slicing

For efficiency when creating multiple snippets from one track:

- **Marker list**: add multiple named markers/regions before exporting
- **Batch export**: export all marked regions in one pass
- **Preview queue**: cycle through marked regions with next/prev buttons

### 7.5 Technical Considerations

- **`OfflineAudioContext`**: required for rendering a sub-range to a new buffer. Create with `sampleRate` and `length` matching the selected duration. Feed the decoded source buffer through a `BufferSourceNode` with offset/duration params.
- **`MediaRecorder` codec support**: Chromium supports `audio/webm;codecs=opus`. Safari may need WAV export with server-side transcode. Feature-detect and show format badge.
- **Large file handling**: music tracks are 3–5 minutes. Decoded PCM for a 5-min stereo 44.1kHz track ≈ 50MB. Use `decodeAudioData` only when the slicer tab is active, and release the buffer when switching away.
- **Waveform rendering for long tracks**: render overview waveform at low resolution (1 sample per pixel), then re-render at higher resolution when zoomed. Use `getChannelData()` from the decoded buffer.

### 7.6 Dependencies

- No external libraries required — all Web Audio API + Canvas 2D
- R2 upload route already exists (`/api/audio/upload`)
- Static library injection can reuse `_filterLibrary()` and existing button HTML pattern

### 7.7 Estimated Effort

- UI (waveform canvas, handles, controls): ~300 lines
- Audio processing (OfflineAudioContext, MediaRecorder): ~150 lines
- Export/upload integration: ~100 lines
- Batch slicing: ~100 lines
- **Total: ~650 lines**, self-contained in a new `slicer-panel.js` module

---

## Manifest Gaps

Sounds referenced by the explosion system that don't have exact manifest entries yet:

| Referenced Key | Closest Manifest Match | Action |
|---|---|---|
| `explosion_large` | No exact match | Add alias in manifest: `"explosion_large": { "src": "/audio/sfx/enemy_die_02.wav", "category": "combat" }` or commission dedicated explosion SFX |

---

## File Summary

| File | Role |
|---|---|
| `public/js/audio-system.js` | Core singleton — play, playMusic, playRandom, data-sound delegate |
| `public/js/audio-controls-widget.js` | Debrief feed UI widget |
| `public/css/audio-controls.css` | Widget styling |
| `public/audio/audio-manifest.json` | 167-entry sound registry (source of truth) |
| `src/worker/routes/audio.ts` | R2 serving route with CORS (GET /audio/sfx/*, /audio/music/*) |
| `src/worker/routes/audio-upload.ts` | Upload route (POST /api/audio/upload) |
| `src/worker/index.ts` | CORS middleware on /audio/* for static asset fallback |
| `scripts/transcode-audio.sh` | WAV → Opus/WebM + MP3 converter |
| `scripts/upload-audio-to-r2.sh` | Batch R2 uploader |
| `public/portal/sound-designer.html` | Designer portal — 167 static sound entries, preview, assign, upload |
| `public/portal/js/sound-designer.js` | Portal logic — streaming preview, static library, file:// support |
| `public/portal/css/sound-designer.css` | Portal styling |

---

## Portal-to-Deployment Pipeline

This section describes the full lifecycle of an audio asset from upload in the Sound Designer portal to playback in the live game.

### Step 1: Upload via Sound Designer Portal

The Sound Designer portal (`public/portal/sound-designer.html`) provides a browser-based interface for browsing, previewing, and uploading audio assets. The portal works both locally (`file://`) and on the production domain (`flapsandseals.com/portal/sound-designer.html`).

To upload a new asset, use the Upload panel in the portal or POST directly to the API:

```
POST /api/audio/upload
Content-Type: multipart/form-data

Fields:
  file:         binary audio data (max 50 MB)
  destination:  "sfx" | "music" | "video"
  filename:     original filename (used as R2 key suffix)
```

The upload handler (`src/worker/routes/audio-upload.ts`) sanitizes the filename, resolves the R2 key prefix (`audio/sfx/`, `audio/music/`, or `video/`), and stores the file in the `eyesonly-assets` R2 bucket with correct `Content-Type` metadata.

Response: `{ ok: true, key: "audio/sfx/my-sound.webm", size: 14832, contentType: "audio/webm" }`

### Step 2: Bulk Transcoding (for raw WAV sources)

When starting from WAV masters (e.g., from a commissioned musician), use the transcoding scripts before upload:

```bash
# Transcode WAV to Opus/WebM (primary) + MP3 (fallback)
./scripts/transcode-audio.sh

# Batch upload transcoded files to R2
./scripts/upload-audio-to-r2.sh
```

The transcode script converts each WAV to Opus/WebM at 96kbps (music) or 48kbps (SFX), plus an MP3 fallback for older Safari. Output files land in `public/audio/sfx/` or `public/audio/music/` locally.

### Step 3: Register in Manifest

Every sound the game can reference must have an entry in `public/audio/audio-manifest.json` (167 entries as of this writing). Each entry maps a sound ID to its source path, category, and metadata:

```json
{
  "whoosh-1": {
    "src": "/audio/sfx/whoosh_01.webm",
    "category": "ui",
    "title": "Whoosh 1"
  },
  "music-forest": {
    "src": "/audio/music/forest_theme.webm",
    "category": "music",
    "title": "Forest Theme",
    "artist": "EyesOnly Audio",
    "loop": true
  }
}
```

The manifest is loaded by `AudioSystem.init()` on page load. Sound IDs used in code (e.g., `AudioSystem.play('whoosh-1')`) must match manifest keys exactly.

### Step 4: R2 Serving (Production)

The Cloudflare Worker serves audio from R2 via two route handlers:

**Serving routes** (`src/worker/routes/audio.ts`):
- `GET /audio/sfx/:filename` serves from R2 key `audio/sfx/<filename>`
- `GET /audio/music/:filename` serves from R2 key `audio/music/<filename>`

Both support HTTP Range requests for streaming (required by `<audio>` elements and mobile Safari). Responses include `Cache-Control: public, max-age=31536000, immutable` since assets are versioned through the manifest, not by URL.

**CORS** (`src/worker/index.ts`): The `/audio/*` path has CORS configured to allow `Range` in request headers and expose `Content-Range`, `Accept-Ranges`, and `Content-Length` in response headers. This is required for cross-origin `<audio crossOrigin="anonymous">` streaming.

**Listing route** (`src/worker/routes/audio-upload.ts`):
- `GET /api/audio/list?prefix=audio/sfx` returns R2 object metadata (key, size, upload date, etag)

### Step 5: In-Game Playback

The `AudioSystem` singleton (`public/js/audio-system.js`) handles all in-game audio through two playback paths:

**SFX (buffer-based):** Short sound effects are fetched, decoded via `decodeAudioData()`, cached in an in-memory buffer map, and played through `BufferSourceNode` → `_sfxGain` → `_masterGain` → destination. This approach gives low-latency playback for short clips. A per-name 80ms cooldown rate-limiter prevents spam from runaway callers.

**Music (streaming):** Music tracks are played through a reusable `<audio>` element routed via `MediaElementAudioSourceNode` → `_musicGain` → `_masterGain` → destination. This streams on demand without downloading the entire file into memory, which is critical for large music files (3-5 min tracks).

Both buses feed into a shared `_masterGain` node. The Audio Controls widget in the debrief feed provides per-bus volume sliders and a master mute toggle.

**AudioContext autoplay policy:** The `AudioContext` starts in `suspended` state. `play()` returns early (no-op) while suspended. `playMusic()` defers and replays automatically once the context resumes after the first user gesture.

### Step 6: Deployment

Deploy changes to production via Cloudflare Workers:

```bash
# Deploy the worker (serves both the app and R2 audio routes)
npx wrangler deploy

# Upload a single new audio file to R2 directly
npx wrangler r2 object put eyesonly-assets/audio/sfx/my-sound.webm \
  --file=public/audio/sfx/my-sound.webm \
  --content-type=audio/webm
```

For bulk uploads after transcoding, use `scripts/upload-audio-to-r2.sh` which iterates over all files in `public/audio/` and uploads them with correct content types.

The manifest file (`public/audio/audio-manifest.json`) is served as a static asset by the worker and is deployed alongside the rest of the public directory.

### Pipeline Summary

```
Musician/Designer                Sound Designer Portal
      |                                |
  WAV masters                    Browse / Preview / Upload
      |                                |
  transcode-audio.sh             POST /api/audio/upload
      |                                |
  WebM (Opus) + MP3              R2: eyesonly-assets/audio/{sfx,music}/
      |                                |
  upload-audio-to-r2.sh          audio-manifest.json (register ID)
      |                                |
      +----------+---------------------+
                 |
          npx wrangler deploy
                 |
    +------------+-------------+
    |                          |
  SFX path                 Music path
  fetch → decode →         <audio> element →
  BufferSourceNode →       MediaElementSource →
  _sfxGain →               _musicGain →
  _masterGain →            _masterGain →
  destination              destination
```

