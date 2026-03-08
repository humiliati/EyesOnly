# Audio Wiring Roadmap

> **Date:** 2026-03-08
> **Status:** Phase 0 complete (infrastructure + first wiring pass)

---

## Runtime Weight: Transcode Before Production

The commissioned assets are 16-bit / 24-bit WAV, totaling ~46 MB across 166 files. WAV is lossless but massively oversized for web delivery (a 1.7 MB WAV becomes ~60 KB Opus/WebM).

**Action required — run before any real user traffic:**

```bash
./scripts/transcode-audio.sh          # preview first with --dry-run
./scripts/upload-audio-to-r2.sh       # push transcoded files to R2
```

Then update `audio-manifest.json` paths from `.wav` → `.webm`. The manifest is the single source of truth — `AudioSystem._resolveURL()` reads it directly.

**Expected savings:** ~46 MB WAV → ~2–3 MB Opus/WebM (≈95% reduction). Music tracks compress even better.

**Safari note:** Safari 15.4+ supports Opus. For older Safari, the transcode script also generates MP3 fallbacks. A future `AudioSystem` enhancement could try `.webm` first then fall back to `.mp3` for full coverage.

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

## Phase 1 — Combat & Cards (Priority: HIGH)

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

## Phase 2 — UI Feedback (Priority: HIGH)

### 2.1 `data-sound` Attribute Rollout

The global delegate is live — just add `data-sound="<name>"` to any HTML element. Priority targets in `index.html`:

| Button | Suggested `data-sound` |
|---|---|
| Back button | `ui-01` |
| Inventory | `ui-02` |
| Kernel / Login | `ui-03` |
| Score / Help | `ui-04` |
| Card draw button | `ui-05` |
| Shop purchase | `coin-1` |
| Shop deny (can't afford) | `cant-go-past-2` |

### 2.2 Hand Fan & Card Selection — `hand-fan-component.js`

| Event | Suggested Sound |
|---|---|
| Fan expand | `whoosh-1` |
| Fan collapse | `whoosh-2` |
| Card hover/focus | `ui-06` at volume 0.3 |
| Card select | `ui-01` |

### 2.3 Shop System — `shop-system.js`

| Event | Suggested Sound |
|---|---|
| Shop open | `ui-07` |
| Shop close | `ui-04` |
| Purchase success | `coin-{1..2}` + `success-1` |
| Purchase fail | `cant-go-past-1` |

**Estimated effort:** ~20 lines of JS + data-sound attributes in HTML.

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
| `public/audio/audio-manifest.json` | 166-entry sound registry (source of truth) |
| `src/worker/routes/audio.ts` | R2 serving route (GET /audio/sfx/*, /audio/music/*) |
| `src/worker/routes/audio-upload.ts` | Upload route (POST /api/audio/upload) |
| `scripts/transcode-audio.sh` | WAV → Opus/WebM + MP3 converter |
| `scripts/upload-audio-to-r2.sh` | Batch R2 uploader |
| `public/portal/sound-designer.html` | Designer portal for assignment + upload |
