# Footstep Audio System

> **Status:** Implemented
> **Last Updated:** 2026-03-08
> **Files:** `audio-system.js`, `move-player-system.js`, `gone-rogue.js`, `floor-transition-system.js`

---

## Overview

The footstep system plays terrain-appropriate L/R alternating footstep sounds when the player moves. Terrain is derived automatically from the current biome or interior context.

## Audio Assets

8 samples served from R2 (`eyesonly-assets` bucket):

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

All building interiors default to **stone** via `_INTERIOR_TERRAIN_DEFAULT`.

## Runtime API

```javascript
AudioSystem.playFootstep(biomeName, isInterior, running)
```

**Parameters:**

- `biomeName` — string key from the `BIOMES` enum (e.g. `'FOREST'`, `'GREY_CAVE'`). May be `null`.
- `isInterior` — boolean. If `true`, forces stone terrain regardless of biome.
- `running` — boolean. If `true`, increases volume (0.35 vs 0.25) and pitch (1.15× vs 1.0×).

**Behavior:**

1. Determines terrain from biome (or defaults to `'dirt'`). Interiors override to `'stone'`.
2. Alternates between left and right foot (`_footLeft` toggle).
3. Constructs manifest key: `'footstep-' + side + '-' + terrain`
4. Plays via `AudioSystem.play()` with computed volume and `playbackRate`.

## Integration Point

Called from `move-player-system.js` after a successful tile move:

```javascript
if (typeof AudioSystem !== 'undefined' && AudioSystem.playFootstep) {
  var biomeName = null;
  var isInterior = !!ctx.currentInteriorFloorId;
  // ... resolve biome name from ctx.getBiome / ctx.BIOMES ...
  AudioSystem.playFootstep(biomeName, isInterior, !!runMode);
}
```

The movement context (`_movePlayerCtx()` in `gone-rogue.js`) provides:

- `getBiome` — function returning biome enum value for a given floor
- `BIOMES` — the biome enum object for reverse-lookup of key names
- `currentInteriorFloorId` — truthy when player is inside a building

## Designer Portal Integration

**Sound Designer Portal** (`portal/sound-designer.html`):
- Footsteps category in the Sound Library sidebar (👣 FOOTSTEPS, 8 entries)
- "Footstep Terrain Override" assignment slot in both Map and Interior contexts

**Map Designer Portal** (`portal/map-designer.html`):
- Audio section in the sidebar with a Footstep Terrain selector (dirt/grass/sand/stone)
- Allows per-floor footstep terrain override

**Interior Designer Portal** (`portal/interior-designer.html`):
- Audio section in the sidebar with a Footstep Terrain selector
- Allows per-interior footstep terrain override (default: stone)

## Future Considerations

- Per-tile terrain overrides (water tiles → splash sound)
- Footstep volume attenuation for stealth mechanics
- Additional terrain types (metal, wood, snow)
- NPC/enemy footstep sounds using the same system
