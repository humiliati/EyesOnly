# Footstep Audio System

> **Status:** Implemented (Player) · Expansion planned (Pets, Enemies)
> **Last Updated:** 2026-03-09
> **Files:** `audio-system.js`, `game-tick-system.js`, `gone-rogue.js`, `floor-transition-system.js`

---

## Overview

The footstep system provides time-based, cadence-driven L/R alternating footstep sounds for the player (and in future, pets and enemies). Terrain is derived automatically from the current biome or interior context. The engine supports stereo panning, floor-depth volume scaling, injury limp mode, equipment modifiers, and per-step humanization.

---

## Architecture

```
  game-tick-system.js (every frame)
        │
        ├── movement state (moving? sprinting?)
        ├── biome resolution (ctx.getBiome → BIOMES reverse-lookup)
        ├── interior depth (interiorFloorStack.length)
        └── health percentage (player.hp / player.maxHp)
              │
              ▼
  AudioSystem.tickFootsteps(moving, sprinting, biomeName, interiorDepth, healthPct)
        │
        ├── Step timer:  cadence clock (walk=420ms, run=270ms, limp=asymmetric)
        ├── Foot toggle: strict L-R-L-R alternation (_stepFoot = 1 - _stepFoot)
        ├── Terrain:     biome → terrain mapping (or 'stone' if interior)
        ├── Volume:      floor-depth table × equipment modifier × jitter
        ├── Pitch:       base (1.0 walk / 1.15 run) × jitter × limp modifier
        └── Pan:         StereoPannerNode (L=-0.22, R=+0.22)
              │
              ▼
  AudioSystem.play(name, { volume, playbackRate, pan })
        │
        ├── _sfxGain bus
        ├── StereoPannerNode (if pan ≠ 0)
        └── _masterGain → destination
```

---

## Audio Assets

8 player footstep samples served from R2 (`eyesonly-assets` bucket):

| Key | Terrain | Side | Format |
|-----|---------|------|--------|
| `footstep-left-dirt` | Dirt | Left | WebM/Opus + MP3 fallback |
| `footstep-right-dirt` | Dirt | Right | WebM/Opus + MP3 fallback |
| `footstep-left-grass` | Grass | Left | WebM/Opus + MP3 fallback |
| `footstep-right-grass` | Grass | Right | WebM/Opus + MP3 fallback |
| `footstep-left-sand` | Sand | Left | WebM/Opus + MP3 fallback |
| `footstep-right-sand` | Sand | Right | WebM/Opus + MP3 fallback |
| `footstep-left-stone` | Stone | Left | WebM/Opus + MP3 fallback |
| `footstep-right-stone` | Stone | Right | WebM/Opus + MP3 fallback |

All entries are defined in `public/audio/audio-manifest.json` with `"category": "footstep"`.

### Future Assets Needed

| Key Pattern | Use | Status |
|-------------|-----|--------|
| `pet-footstep-{type}-{side}` | Pet movement sounds | 🔲 Needs design |
| `pet-lullaby-hum` | Roomba initial step | 🔲 Needs design |
| `enemy-footstep-{weight}-{side}-{terrain}` | Enemy patrol sounds | 🔲 Needs design |

---

## Biome → Terrain Mapping

Defined in `audio-system.js` via `_BIOME_TERRAIN`:

| Biome | Terrain |
|-------|---------|
| FOREST | grass |
| LAKE | grass |
| GREY_CAVE | stone |
| OFFICE | stone |
| MALL | stone |
| INDUSTRIAL | stone |
| AEROSPACE | stone |
| SKI_MOUNTAIN | sand |
| JUNKYARD | dirt |
| *(fallback)* | dirt |

All building interiors default to **stone** regardless of biome.

---

## Floor-Depth Volume Table

Volume scales with interior depth to create a natural acoustic contrast between open-air and enclosed spaces.

| Depth | Context | Walk Vol | Run Vol |
|-------|---------|----------|---------|
| 0 | Exterior (floor N) | 0.70 | 0.80 |
| 1 | Shallow interior (floor N.N) | 1.05 | 1.20 |
| 2+ | Deep interior (floor N.N.N) | 1.20 | 1.35 |

Wider spread than the original (exterior quieter, interior louder) to create a more pronounced acoustic contrast between open-air and enclosed spaces. Volumes are further modified by equipment multipliers and ±5% humanization jitter.

---

## Cadence Timing

| State | Cadence (ms) | Notes |
|-------|-------------|-------|
| Walking | 229 | Brisk stride (~45% faster than original 420ms) |
| Sprint (fresh, fatigue=0) | 115 | ~2× walk cadence, maximum urgency |
| Sprint (exhausted, fatigue=100) | 229 | Decelerates to walking cadence |
| Limp (L step) | 229 | Quick weight-bearing step |
| Limp (R step) | 650 | Dragging injured leg |

**Fatigue-based sprint deceleration:** Sprint cadence linearly interpolates between 115ms (fresh) and 229ms (exhausted) based on `GAMESTATE.getFatigue()` (0–100). When fatigue reaches 100, sprinting sounds identical to walking. This prepares for future fatigue spending during sprint movement.

**Player volume reduction:** Player footstep volume is reduced by 60% (`_PLAYER_FOOTSTEP_VOL = 0.40`) to prevent footstep dominance. Enemy/NPC/pet footsteps use `opts.volumeScale` for per-entity volume control.

Limp mode activates when `healthPct < 0.30` (30% HP). The asymmetric L/R cadence produces a distinct hobbled gait.

---

## Depth Pitch Modifier

A subtle pitch adjustment per floor depth softens the timbre transition between exterior terrain samples (grass/dirt/sand) and interior stone samples. This prevents the jarring "brightness jump" when entering buildings.

| Depth | Pitch Modifier | Effect |
|-------|---------------|--------|
| 0 | ×1.00 | Exterior — natural pitch |
| 1 | ×0.97 | Shallow interior — slightly warmer |
| 2+ | ×0.95 | Deep interior — even warmer stone resonance |

Sprint pitch base is 1.08× (reduced from 1.15× to further soften interior transitions).

---

## Stereo Panning

Each foot is panned to its respective speaker via `StereoPannerNode`:

| Foot | Pan Value | Effect |
|------|-----------|--------|
| Left | -0.22 | Shifts toward left speaker |
| Right | +0.22 | Shifts toward right speaker |

Values are subtle enough for headphones without disorientation on speakers.

---

## Humanization

Each step applies random micro-variation to avoid a mechanical feel:

| Parameter | Range | Effect |
|-----------|-------|--------|
| Volume jitter | ×0.95 – ×1.05 | ±5% volume variance |
| Pitch jitter | ×0.98 – ×1.02 | ±2% pitch variance |

During limp mode, the drag foot (right) gets an additional `pitch × 0.85` (heavier sound) and `vol × 1.15` (louder thud).

---

## Equipment Modifiers

Items with a `footstep_volume_multiplier` property on `PassiveItemsSystem.getEquippedItems()` scale the final volume. Examples:

| Item | Multiplier | Effect |
|------|-----------|--------|
| Stiletto Slippers | 0.5 | 50% quieter (stealth bonus) |
| Heavy Boots | 1.3 | 30% louder (enemies hear easier) |

This feeds directly into the stealth system's noise calculation (see Integration Seams).

---

## Runtime API

### Primary: `AudioSystem.tickFootsteps(moving, sprinting, biomeName, interiorDepth, healthPct)`

Called once per game-tick frame from `game-tick-system.js`. The engine manages its own cadence timer internally — callers just provide current movement state each frame.

**Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `moving` | boolean | Is the player moving? |
| `sprinting` | boolean | Is the player sprinting? |
| `biomeName` | string\|null | Biome key (e.g. `'FOREST'`). null = dirt fallback |
| `interiorDepth` | number | 0 = exterior, 1 = N.N, 2+ = N.N.N |
| `healthPct` | number | 0–1 (player HP / maxHP) |

### Legacy: `AudioSystem.playFootstep(biomeName, isInterior, running)`

Backward-compatible wrapper that delegates to `tickFootsteps()`. Preserved for any remaining call sites.

---

## Game Tick Integration

In `game-tick-system.js`, the footstep call lives at the top of `updateGameState()`:

```javascript
if (typeof AudioSystem !== 'undefined' && AudioSystem.tickFootsteps) {
  var _ftMoving = GoneRogueMovement.isMoving();
  var _ftSprinting = _ftMoving && GoneRogueMovement.isSprinting();
  var _ftBiomeName = null;
  var _ftDepth = ctx.interiorFloorStack ? ctx.interiorFloorStack.length : 0;
  var _ftHealth = (ctx.player.hp && ctx.player.maxHp)
    ? (ctx.player.hp / ctx.player.maxHp) : 1.0;
  // ... biome reverse-lookup from ctx.getBiome / ctx.BIOMES ...
  AudioSystem.tickFootsteps(_ftMoving, _ftSprinting, _ftBiomeName, _ftDepth, _ftHealth);
}
```

Context fields provided by `_gameTickCtx()` in `gone-rogue.js`:

| Field | Type | Purpose |
|-------|------|---------|
| `interiorFloorStack` | Array | Stack of interior floor IDs (length = depth) |
| `getFloor()` | Function | Returns current floor object |
| `getBiome(floor)` | Function | Returns biome enum value for a floor |
| `BIOMES` | Object | Biome enum for reverse-lookup of key names |
| `player.hp` | Number | Current health |
| `player.maxHp` | Number | Max health |

---

## Designer Portal Integration

**Sound Designer Portal** (`portal/sound-designer.html`):
- Footsteps category in the Sound Library sidebar (👣 FOOTSTEPS, 8 entries)
- "Footstep Terrain Override" assignment slot in both Map and Interior contexts

**Map Designer Portal** (`portal/map-designer.html`):
- Audio section with Footstep Terrain selector (dirt/grass/sand/stone)
- Per-floor footstep terrain override

**Interior Designer Portal** (`portal/interior-designer.html`):
- Audio section with Footstep Terrain selector
- Per-interior footstep terrain override (default: stone)

---

## Expansion: Pet Footsteps

### Design

Each pet tier has distinct movement audio characteristics with varying humanization levels. Pets share the player's cadence timer concept but use independent step clocks.

| Pet Tier | Step Sound | Humanization | Cadence | Stereo Pan | Notes |
|----------|-----------|--------------|---------|------------|-------|
| RUMBA | `pet-lullaby-hum` | None (mechanical) | N/A — single trigger | None | Fires ONCE on initial movement start, not per step. Represents Roomba's motor hum engaging. |
| HUMANOID | `pet-footstep-humanoid-{left,right}` | High (±8% vol, ±4% pitch) | Walk: 400ms, Run: 260ms | ±0.25 | More human-like than player; faster cadence due to smaller stride |
| MEGA | `pet-footstep-mega-{left,right}` | Low (±2% vol, ±1% pitch) | Walk: 550ms, Run: 380ms | ±0.45 | Heavy, deliberate; wider pan for larger body |

### Implementation Plan

New function `tickPetFootsteps()` in `audio-system.js`:

```
tickPetFootsteps(pets, biomeName, interiorDepth)
  └── for each active pet in PetFollower.getActivePets():
        ├── derive pet position from follower history
        ├── check if pet is "moving" (position changed since last tick)
        ├── select sound set based on pet.type
        │     RUMBA  → one-shot lullaby on movement start
        │     HUMANOID → L/R footsteps with high humanization
        │     MEGA → L/R footsteps with low humanization, heavier pitch
        ├── apply per-pet cadence timer (independent of player timer)
        ├── TODO: distance attenuation from player position
        └── play()
```

### Seam: `pet-follower.js`

`PetFollower` must expose:

| Method / Property | Purpose |
|-------------------|---------|
| `getActivePets()` | Returns array of active pet objects |
| `pet.x, pet.y` | Current position (for distance attenuation) |
| `pet.type` | Tier enum (`RUMBA`, `HUMANOID`, `MEGA`) |
| `pet.delayIndex` | Follow delay (affects when pet "moves") |

Currently `_activePets` is internal. Needs a public getter: `PetFollower.getActivePets = function() { return _activePets; }`

### Portal Update

Sound Designer Portal needs a new category: **🐾 PET SOUNDS** containing:

| Key | Description | Status |
|-----|-------------|--------|
| `pet-lullaby-hum` | Roomba motor engage sound | 🔲 Need asset |
| `pet-footstep-humanoid-left` | Humanoid pet left step | 🔲 Need asset |
| `pet-footstep-humanoid-right` | Humanoid pet right step | 🔲 Need asset |
| `pet-footstep-mega-left` | Mega pet left step (heavy) | 🔲 Need asset |
| `pet-footstep-mega-right` | Mega pet right step (heavy) | 🔲 Need asset |

---

## Expansion: Enemy Footsteps

### Design

Pathing enemies produce footstep sounds that the player can hear. Volume is attenuated by distance from the player, creating spatial awareness for stealth gameplay.

| Enemy Weight Class | Step Sound | Cadence | Volume Base | Distance Falloff |
|-------------------|-----------|---------|-------------|-----------------|
| Light (scout, rat) | `enemy-footstep-light-{side}-{terrain}` | 350ms | 0.4 | Linear, max 8 tiles |
| Medium (guard, soldier) | `enemy-footstep-medium-{side}-{terrain}` | 500ms | 0.6 | Linear, max 10 tiles |
| Heavy (brute, mech) | `enemy-footstep-heavy-{side}-{terrain}` | 700ms | 0.8 | Linear, max 14 tiles |

### Proximal Audio Pipeline

```
enemy-ai-system.js → updateEnemyPath() fires every 500ms
        │
        ├── enemy moved to new tile?
        │     yes → emit event or call AudioSystem.tickEnemyFootstep(enemy, terrain)
        │
        ▼
AudioSystem.tickEnemyFootstep(enemy, terrain)
        │
        ├── distance = manhattan(enemy.x, enemy.y, player.x, player.y)
        ├── if distance > maxRange → skip (inaudible)
        ├── volume = baseVol × (1 - distance / maxRange)
        ├── pan = calculatePan(enemy.x - player.x) → stereo position
        └── play(soundKey, { volume, pan })
```

### Seam: `enemy-ai-system.js`

Current enemy movement functions (`_moveEnemyPatrol`, `_moveEnemyCircular`, `_moveEnemyEllipse`) call `_moveEnemyToPoint()` which updates `enemy.x` / `enemy.y`. The footstep hook goes after the position update:

```javascript
function _moveEnemyToPoint(enemy, point, ctx) {
  // ... existing position update ...

  // ── Audio: enemy footstep (proximal) ──
  if (typeof AudioSystem !== 'undefined' && AudioSystem.tickEnemyFootstep) {
    AudioSystem.tickEnemyFootstep(enemy, ctx);
  }
}
```

Enemy objects need a `weightClass` property (default: `'medium'`) for sound selection.

### Portal Update: Enemy Footstep Assets

Sound Designer Portal needs a new category: **👹 ENEMY SOUNDS** expanding the existing entries with footsteps:

| Key Pattern | Variants | Status |
|-------------|----------|--------|
| `enemy-footstep-light-{left,right}-{dirt,grass,sand,stone}` | 8 files | 🔲 Need assets |
| `enemy-footstep-medium-{left,right}-{dirt,grass,sand,stone}` | 8 files | 🔲 Need assets |
| `enemy-footstep-heavy-{left,right}-{dirt,grass,sand,stone}` | 8 files | 🔲 Need assets |

Until dedicated enemy footstep assets are created, the player footstep files can be reused with pitch/volume adjustments per weight class.

### TODO: Proc Gen Pipeline

Enemy footstep assets will eventually be generated via the portal → proc gen pipeline:

```
Sound Designer Portal → "Generate Enemy Footsteps" button
        │
        ├── Select base footstep sample
        ├── Apply weight-class transforms (pitch, EQ, layering)
        ├── Preview variants
        ├── Batch export to R2
        └── Auto-register in manifest
```

This leverages the existing Upload tab in the portal and the `POST /api/audio/upload` route.

---

## Expansion: Footprint Ground Effects (Next Pass)

### Design

Persistent visual footprints left behind by all moving entities (player, pets, enemies). These ground effects serve as input to the enemy AI suspicion system.

```
Movement Event (player/pet/enemy steps)
        │
        ▼
GroundEffectsSystem.addFootprint(x, y, entity, direction, timestamp)
        │
        ├── Create visual sprite (footprint decal on ground layer)
        ├── Fade over time (fresh → faded → gone)
        ├── Store in spatial grid for AI queries
        │
        ▼
EnemyAISystem awareness check (per patrol tick)
        │
        ├── Query GroundEffectsSystem.getFootprintsNear(enemy.x, enemy.y, radius)
        ├── Freshness score: newer prints = more suspicious
        ├── Density score: more prints = higher alert
        │     │
        │     ▼
        ├── suspicion += (freshness × density × awareness_multiplier)
        │
        ├── SUSPICIOUS threshold → yellow "?" expression
        └── ALERTED threshold → red "!" + sound + pursuit
```

### Seam: `ground-effects-system.js`

Currently handles water/hazard/ice tile effects. Footprints extend this with a new subsystem:

| New Method | Purpose |
|-----------|---------|
| `addFootprint(x, y, entityType, facing, timestamp)` | Place a footprint decal |
| `getFootprintsNear(x, y, radius)` | Query footprints for AI |
| `tickFootprintDecay(deltaMs)` | Fade and remove old prints |
| `getFootprintSuspicion(x, y, radius)` | Pre-computed suspicion score |

Entity types: `'player'`, `'pet-rumba'`, `'pet-humanoid'`, `'pet-mega'`, `'enemy'`

### Seam: `stealth-system.js`

Footprint visibility is modified by stealth bonuses:

| Stealth Bonus Range | Footprint Behavior |
|--------------------|-------------------|
| 0–30% | Normal visible footprints |
| 31–60% | Footprints fade 2× faster |
| 61–90% | Footprints fade 4× faster, reduced opacity |
| 91–100% | No footprints (silent movement) |

The stealth system already calculates `getPlayerStealthBonus(ctx)` from tiles, darkness, charms, and passive items. Footprint generation reads this value to modulate print lifetime.

### Seam: `enemy-ai-system.js`

Enemy awareness checks already track suspicion levels with SUSPICIOUS and ALERTED thresholds. Footprint suspicion feeds into the existing `enemy.suspicion` accumulator alongside the current line-of-sight and noise-based detection.

### Visual Spec

| Property | Value |
|----------|-------|
| Sprite | Semi-transparent shoe print or paw print (pet-type specific) |
| Initial opacity | 0.6 (player), 0.4 (pet), 0.3 (enemy) |
| Decay time | 15 seconds (normal), modified by stealth |
| Max footprints in memory | 200 (oldest culled first) |
| Render layer | Below entities, above ground tiles |

---

## Integration Seam Summary

This table maps every system that touches the footstep engine, what it provides, and what it consumes.

| System | File | Provides → Footstep Engine | Consumes ← Footstep Engine |
|--------|------|---------------------------|---------------------------|
| **Game Tick** | `game-tick-system.js` | Movement state, biome, depth, health | Calls `tickFootsteps()` each frame |
| **Movement** | `gone-rogue-movement.js` | `isMoving()`, `isSprinting()` | — |
| **Gone Rogue** | `gone-rogue.js` | `interiorFloorStack`, `getFloor`, `getBiome`, `BIOMES`, `player.hp/maxHp` | — |
| **Floor Transition** | `floor-transition-system.js` | — | Music dim on interior entry (0.25 multiplier) |
| **Pet Follower** | `pet-follower.js` | `getActivePets()`, pet positions, pet types | **TODO:** `tickPetFootsteps()` |
| **Enemy AI** | `enemy-ai-system.js` | Enemy positions, weight class, patrol state | **TODO:** `tickEnemyFootstep()` |
| **Ground Effects** | `ground-effects-system.js` | Tile effects (water, hazard) | **TODO:** `addFootprint()` on each step |
| **Stealth** | `stealth-system.js` | `getPlayerStealthBonus()` → modulates footprint lifetime | **TODO:** Footstep volume feeds enemy detection |
| **Passive Items** | `passive-items-system.js` | `getEquippedItems()` → `footstep_volume_multiplier` | — |
| **Audio Core** | `audio-system.js` | `play()` with stereo pan support | Owns `tickFootsteps()`, future `tickPetFootsteps()`, `tickEnemyFootstep()` |
| **Sound Designer** | `portal/sound-designer.html` | Sound library, terrain overrides | **TODO:** Pet + enemy footstep categories |
| **Audio Manifest** | `audio-manifest.json` | File paths, metadata, fallbacks | **TODO:** Pet + enemy footstep entries |

---

## File Summary

| File | Role in Footstep System |
|------|------------------------|
| `public/js/audio-system.js` | Footstep engine (`tickFootsteps`), sound playback, stereo panning |
| `public/js/game-tick-system.js` | Per-frame footstep caller, movement/biome/health resolution |
| `public/js/gone-rogue.js` | Context provider (floor stack, biome, player HP) |
| `public/js/gone-rogue-movement.js` | Movement state (`isMoving`, `isSprinting`) |
| `public/js/floor-transition-system.js` | Interior music dim (acoustic contrast companion) |
| `public/js/pet-follower.js` | Pet positions and types (future footstep source) |
| `public/js/enemy-ai-system.js` | Enemy patrol movement (future footstep source) |
| `public/js/ground-effects-system.js` | Tile effects + future footprint decals |
| `public/js/stealth-system.js` | Stealth bonus → footprint lifetime modifier |
| `public/audio/audio-manifest.json` | Sound registry (footstep entries with WebM + MP3) |
| `public/portal/sound-designer.html` | Portal UI for footstep asset management |
