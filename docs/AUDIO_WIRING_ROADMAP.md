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

## Phase 3 — Environment & Ambience (Priority: MEDIUM)

### 3.1 Biome Music — `floor-gen-core.js` / `floor-generator.js`

Start biome-appropriate music when a new floor loads. The manifest has 16 music tracks mapped to biomes:

| Biome / Context | Music Key |
|---|---|
| Exterior (day) | `music-exterior` |
| Exterior (night) | `music-exterior-night` |
| Interior (default) | `music-default-interior` |
| Cave | `music-cave` |
| Church / Catacombs | `music-church-catacombs` |
| Military zone | `music-82nd-all-the-way` |
| Neon / Club | `music-clubbed-to-death` |
| Tavern / Pub | `music-pub` or `music-tavern` |
| Death / Game Over | `music-death-exit` |
| Safe room | `music-safe-room` |
| Stealth | `music-stealth` |
| Shop / Vendor | `music-shop` |

Wire in `AudioSystem.playMusic(key)` at floor generation complete, and `AudioSystem.stopMusic()` on transitions.

### 3.2 Ground Effects — `ground-effects-system.js`

| Effect | Suggested Sound |
|---|---|
| Fire tile step | `fire-sfx` |
| Water tile step | `water-{1..3}` random |
| Ice slide | `ice-{1..2}` |

### 3.3 Light Source Destruction — `breakable-system.js` `_handleLightSourceDestruction`

| Source Type | Suggested Sound |
|---|---|
| Campfire | `fire-sfx` at low volume |
| Torch | `whoosh-1` quiet |
| Lamp post | `metal-hit-{1..2}` |
| Electronic | `electric-{1..2}` |
| Light bulb | `impact-1` |

**Estimated effort:** ~50 lines across 3-4 files.

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
