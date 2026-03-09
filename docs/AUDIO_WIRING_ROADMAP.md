# Audio Wiring Roadmap

> **Date:** 2026-03-09 (last updated)
> **Status:** Phase 0 + Phase 2 + Phase 3 + Phase 4.1 complete, Phase 1 deferred (pending card hand harmonization), transcoding shipped, Sound Designer portal live with 314 sound entries + 103 card sounds
> **Manifest entries:** 314 (167 original SFX + 8 footsteps + 103 card sounds + 20 Songs + 18 Cyberleaf + 14 Aila Scott — some with `_status: "staged"`)

---

## Runtime Weight: ✅ Transcoded & Deployed

All 314 assets have been transcoded from WAV to Opus/WebM (+ MP3 fallback) and uploaded to the `eyesonly-assets` R2 bucket. Source WAVs have been removed from `public/audio/` to stay within Cloudflare's 25 MiB static asset limit. Audio is served exclusively via R2 routes.

**Manifest note:** `audio-manifest.json` `src` fields now reference `.webm` paths for new assets (footsteps, card sounds, Cyberleaf, Aila Scott). Original 167 SFX entries still reference `.wav` paths which resolve from R2. The R2 bucket serves both formats.

**Safari note:** Safari 15.4+ supports Opus natively. The MP3 fallbacks on R2 cover older Safari. `AudioSystem` tries `.webm` first, falling back to `.mp3`.

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
| Footstep system | audio-system.js / move-player-system.js | `footstep-{left,right}-{dirt,grass,sand,stone}` | ✅ New |

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
| Enemy killed | `onEnemyKilled` callback | `enemy-die-1` or `enemy-die-2` |

### 1.2 Card Play — `card-play-system.js` (103 dedicated card sounds available)

| Event | Where | Suggested Sound |
|---|---|---|
| Card played (attack) | `resolveAction()` type='attack' | `card-place_card-{1..11}` random |
| Card played (magic) | `resolveAction()` type='magic' | `card-flip_card-{1..16}` random |
| Card played (support) | `resolveAction()` type='support' | `card-slide_card-{1..10}` random |
| Card drawn | Draw from deck | `card-pick_up_card-{1..12}` random |
| Card dealt | Deal animation | `card-deal_card-{1..17}` random |
| Rapid deal sequence | Multi-deal | `card-deal_card_loop-{1..6}` random |
| Hand fan expand | `show()` | `card-fold_hand-{1..15}` random (or keep `whoosh-1`) |
| Hand fan collapse | `hide()` | `card-fold_hand-{1..15}` random (or keep `whoosh-2`) |
| Deck shuffle | Shuffle animation | `card-shuffle-{1..8}` or `card-hand_shuffle-{1..8}` random |
| Card discard | Discard action | `card-slide_card-{1..10}` random |
| Insufficient resources | Cost check fail | `cant-go-past-1` |

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

## Phase 1.5 — Card Sound Families (103 assets, NEW)

> **Status:** Assets encoded + on R2 + in portal. Game wiring pending Phase 1 card system hooks.

103 dedicated card SFX in 9 families, all WebM/Opus from R2:

| Family | Manifest Keys | Count | Suggested Use |
|---|---|---|---|
| Deal Card | `card-deal_card_{1..17}` | 17 | Card dealt from deck to hand |
| Deal Card Loop | `card-deal_card_loop_{1..6}` | 6 | Rapid multi-deal sequence |
| Flip Card | `card-flip_card_{1..16}` | 16 | Card reveal, flip over, inspect |
| Fold Hand | `card-fold_hand_{1..15}` | 15 | Hand fan collapse, fold action |
| Hand Shuffle | `card-hand_shuffle_{1..8}` | 8 | In-hand card reordering |
| Pick Up Card | `card-pick_up_card_{1..12}` | 12 | Draw from deck, card pickup |
| Place Card | `card-place_card_{1..11}` | 11 | Deploy card to battlefield |
| Shuffle | `card-shuffle_{1..8}` | 8 | Full deck shuffle |
| Slide Card | `card-slide_card_{1..10}` | 10 | Slide/discard from hand |

**Integration approach:** Use `AudioSystem.playRandom('card-deal_card', 17)` pattern for natural variation. Each family has enough variants to avoid repetition in rapid sequences.

**Portal status:** All 103 entries are visible in the Sound Designer Portal under 🃏 CARD SOUNDS category. WebM paths point to R2.

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

Biome-appropriate music starts on every floor transition via `_playBiomeMusic(ctx)` helper. `AudioSystem.stopMusic()` fires during `_fadeOut()`, then `_playBiomeMusic()` fires after `generateFloor()` completes.

**Cyberleaf tracks** (18 looping chiptune tracks) now provide the biome music layer:

| Biome / Context | Music Key | Artist | Status |
|---|---|---|---|
| FOREST (day) | `music-cl-far-away` | Cyberleaf | ✅ |
| FOREST (night) | `music-cl-haunted-mansion` | Cyberleaf | ✅ |
| GREY_CAVE | `music-cl-deep-caves` | Cyberleaf | ✅ |
| MALL | `music-cl-arcade-jam` | Cyberleaf | ✅ |
| INDUSTRIAL | `music-cl-fight-for-lives` | Cyberleaf | ✅ |
| OFFICE | `music-cl-going-up` | Cyberleaf | ✅ |
| AEROSPACE | `music-82nd-all-the-way` | Sabaton | ✅ |
| LAKE (day) | `music-cl-yet-another-journey` | Cyberleaf | ✅ |
| LAKE (night) | `music-cl-space-full-stars` | Cyberleaf | ✅ |
| SKI_MOUNTAIN | `music-cl-dont-fall-clouds` | Cyberleaf | ✅ |
| JUNKYARD | `music-cl-radio-kid` | Cyberleaf | ✅ |
| Interior (default) | `music-cl-gods-philosophers` | Cyberleaf | ✅ |
| Fallback (day) | `music-exterior` | — | ✅ |
| Fallback (night) | `music-exterior-night` | — | ✅ |

Day/night alternation: even floors = night.

**Aila Scott tracks** (14 tracks, staged for future use — boss battles, special areas, etc.)

### 3.2 Ground Effects — `ground-effects-system.js` ✅

| Effect | Sound | Where | Status |
|---|---|---|---|
| Fire/hazard tile step | `rumble-1` vol 0.4 | `applyTileEffects()` hazard branch | ✅ |
| Water tile step | `water-{1..3}` random vol 0.3 | `applyTileEffects()` water branch | ✅ |
| Ice combat modifier | `ice-1` vol 0.3 | `applyPlayerGroundModifier()` ICE branch | ✅ |

### 3.3 Light Source Destruction — `breakable-system.js` ✅

| Source Type | Sound | Where | Status |
|---|---|---|---|
| Campfire | `rumble-1` vol 0.35 | `_destroyCampfire()` | ✅ |
| Torch | `whoosh-1` vol 0.25 | `_destroyTorch()` | ✅ |
| Lamp post | `metal-hit-{1..2}` random vol 0.5 | `_destroyLampPost()` | ✅ |
| Electronic (Monitor/Terminal) | `particles-dark` vol 0.45 | `_destroyElectronic()` | ✅ |
| Light bulb | `impact-1` vol 0.4 | `_destroyLightBulb()` | ✅ |

### 3.4 Footstep System — `audio-system.js` + `move-player-system.js` ✅

8 stereo footstep samples (L/R × 4 terrains) with biome→terrain auto-mapping. See `docs/FOOTSTEP_AUDIO_SYSTEM.md` for full spec.

| Feature | Status |
|---|---|
| `AudioSystem.playFootstep(biome, isInterior, running)` | ✅ |
| Biome→terrain mapping (Forest→grass, Cave→stone, etc.) | ✅ |
| Interior default to stone | ✅ |
| Running mode (higher volume + pitch) | ✅ |
| L/R alternation | ✅ |
| Designer portal terrain override (Map + Interior) | ✅ |

---

## Phase 4 — Enemy & Stealth (Priority: MEDIUM) 🔶 PARTIAL

### 4.1 Enemy AI — `enemy-ai-system.js` ✅ COMPLETE

| Event | Sound | Animation | Status |
|---|---|---|---|
| Enemy enters alert (ALERTED threshold) | `enemy-1` vol 0.6 | `OverheadAnimator.showExpression('ALERT')` — red "!" | ✅ |
| Enemy becomes suspicious (SUSPICIOUS threshold) | — | `OverheadAnimator.showExpression('QUESTION')` — yellow "?" | ✅ |
| Tooltip flash on alert | — | `TooltipSystem.show('! Enemy alerted!')` 1.5s | ✅ |

### 4.2 Enemy Death — Various combat files

| Event | Suggested Sound |
|---|---|
| Regular enemy kill | `enemy-die-1` |
| Elite enemy kill | `enemy-die-2` |
| Enemy defeated jingle | `enemy-defeated` |
| Boss encounter start | Boss music track (Aila Scott) |

### 4.3 Stealth System — `stealth-system.js`

| Event | Suggested Sound |
|---|---|
| Enter stealth | `whoosh-1` quiet |
| Stealth break (detected) | `enemy-1` or `phone-ring` |
| Sprint footsteps | Footstep system handles via `running` flag |

---

## Phase 5 — Death, Victory, Run Events (Priority: LOW)

### 5.1 Death Sequence — `death-exit-system.js`

| Event | Suggested Sound |
|---|---|
| Player death | `enemy-4` or death jingle |
| Death music | `music-death` via `playMusic()` |
| Game over screen | fade to silence |

### 5.2 Victory / Run Complete — `str-victory-sequence.js`

| Event | Suggested Sound |
|---|---|
| Combat victory | `success-{1..3}` |
| Floor cleared | `music-cl-victory` (Cyberleaf — Victory At Last) |
| Run complete | Victory music track |

### 5.3 Run Start — `run-start-system.js`

| Event | Suggested Sound |
|---|---|
| New run begins | `ui-07` + biome music via floor transition |
| Tutorial start | `phone-ring` |

---

## Phase 6 — Polish & Advanced (Priority: LOW)

### 6.1 Positional Audio

`AudioSystem.play()` already accepts `{ x, y }` options (currently unused). Future: attenuate SFX volume by distance from player using `(1 - dist/maxDist)` factor.

### 6.2 Footstep Surface Variants ✅ SUPERSEDED

Implemented via the biome-based footstep system (Phase 3.4). Biome determines terrain (grass/stone/sand/dirt), interiors default to stone. Per-floor override available in both Map Designer and Interior Designer portals.

**Future extension:** Per-tile terrain overrides (water tiles → splash, metal grates → metal-hit).

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

In-browser tool within the Sound Designer portal that lets designers slice segments from full-length music tracks and export them as new SFX entries. This eliminates the need for external audio editors when creating stingers, loops, transitions, and ambient snippets from the 52 music tracks (20 Songs + 18 Cyberleaf + 14 Aila Scott).

### 7.1 UI — Waveform Region Selection

Add a dedicated "Slicer" tab to the Sound Designer center panel (alongside Preview, Assign, Upload):

- **Waveform display**: full-track waveform rendered from `AnalyserNode` or decoded buffer
- **Selection handles**: draggable start/end markers on the waveform canvas
- **Zoom controls**: horizontal zoom in/out for precision selection on long tracks
- **Playhead**: thin vertical line showing current playback position

### 7.2 Preview & Refinement

- **Play selection**: plays only the selected region
- **Play full**: plays the entire track with the selection region highlighted
- **Loop toggle**: loops the selection for previewing loop points
- **Fade in/out**: optional fade envelope (linear or exponential, 0–500ms)
- **Trim silence**: auto-detect and trim leading/trailing silence

### 7.3 Export Pipeline

1. Client-side extraction via `OfflineAudioContext`
2. Encode with `MediaRecorder` (`audio/webm;codecs=opus`)
3. Metadata form (Sound ID, display name, category, loop, tags)
4. Upload to R2 via `POST /api/audio/upload`
5. Register in manifest
6. Update static library

### 7.4 Batch Slicing

Multiple named markers/regions, batch export, preview queue.

### 7.5 Estimated Effort

~650 lines in a new `slicer-panel.js` module.

---

## Manifest Gaps

| Referenced Key | Closest Manifest Match | Action |
|---|---|---|
| `explosion_large` | No exact match | Add alias or commission dedicated explosion SFX |

---

## File Summary

| File | Role |
|---|---|
| `public/js/audio-system.js` | Core singleton — play, playMusic, playRandom, playFootstep, data-sound delegate |
| `public/js/audio-controls-widget.js` | Debrief feed UI widget |
| `public/css/audio-controls.css` | Widget styling |
| `public/audio/audio-manifest.json` | 314-entry sound registry (source of truth) |
| `src/worker/routes/audio.ts` | R2 serving route with CORS |
| `src/worker/routes/audio-upload.ts` | Upload route (POST /api/audio/upload) |
| `src/worker/index.ts` | CORS middleware on /audio/* |
| `scripts/r2-audio-sync.sh` | Batch R2 uploader (encoded_for_r2/ → R2) |
| `public/portal/sound-designer.html` | Designer portal — 314 static sound entries |
| `public/portal/js/sound-designer.js` | Portal logic — streaming preview, static library |
| `public/portal/css/sound-designer.css` | Portal styling |
| `docs/FOOTSTEP_AUDIO_SYSTEM.md` | Footstep system documentation |

---

## Portal-to-Deployment Pipeline

```
Musician/Designer                Sound Designer Portal
      |                                |
  WAV masters                    Browse / Preview / Upload
      |                                |
  encode → encoded_for_r2/      POST /api/audio/upload
      |                                |
  WebM (Opus) + MP3              R2: eyesonly-assets/audio/{sfx,music}/
      |                                |
  r2-audio-sync.sh              audio-manifest.json (register ID)
      |                                |
      +----------+---------------------+
                 |
          npx wrangler deploy
                 |
    +------------+-------------+----------+
    |                          |          |
  SFX path                 Music path  Footstep path
  fetch → decode →         <audio> →   biome → terrain →
  BufferSourceNode →       MediaSrc →  L/R alternate →
  _sfxGain →               _musicGain → _sfxGain →
  _masterGain →            _masterGain → _masterGain →
  destination              destination  destination
```
