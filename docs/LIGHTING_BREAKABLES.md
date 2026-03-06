# Lighting Engine Breakables & Configuration System

## Overview

The lighting engine now supports configurable emoji visibility, layered rendering, and interactive/breakable light sources. This addresses the visual clutter and occlusion issues while adding tactical stealth gameplay through destructible lights.

## Features Implemented

### 1. Configuration System

**Files:**
- `/public/data/gone-rogue/lighting-config.json` - Main configuration file
- `/public/data/gone-rogue/lighting-config.schema.json` - JSON schema for validation

**Key Configuration Sections:**
- `global` - Master lighting settings (gamma, falloff, tile alpha ranges)
- `emission` - Light intensity scaling, color bleed, flicker controls
- `envLights` - Environmental light emoji rendering rules
- `interactiveLights` - Breakable light source settings
- `progression` - Floor-based scaling for visible lights and interactive ratio
- `validation` - Performance limits and debug options

### 2. Emoji Visibility Distribution

**Default Behavior:**
- ~30% of environmental lights show emojis (configurable via `visibleChanceBase`)
- ~70% contribute light but have hidden emojis (reduces clutter)
- Interactive/breakable lights have increased visibility chance (1.8x multiplier)

**Progression Scaling:**
- Early floors (1-10): ~20% visible lights (quiet, readability-first)
- Mid floors (10-20): ~30% visible lights
- Late floors (20-30): ~45% visible lights (more stealth tools)

### 3. Occlusion Rules

**Hard Occlusion (Always Applied):**
Light emojis are hidden if they share a tile with:
- Doors and exits
- Key items and interactive items
- Breakables
- NPCs, enemies, or the player

**Configuration:**
```json
"hideIfTileOccupied": true,
"hideIfContains": ["door", "exit", "keyItem", "interactiveItem", "breakable", "npc", "enemy", "player"]
```

### 4. Layered Rendering

**Render Layers (bottom to top):**
1. `below_all` - Underneath everything
2. `below_doors` - Below doors but above tiles
3. `below_items` - Below items but above doors (default for most lights)
4. `above_all` - Top layer (used for bulbs)

**Special Case: Bulbs (💡)**
- Rendered upside-down (180° rotation)
- Top layer (`above_all`)
- Still respect occupancy hiding rules

### 5. Interactive/Breakable Lights

**Light Source Properties (from code `LIGHT_SOURCE_BREAKABLE_PROPS`):**

| Type | HP | Kickable | Smotherable | Noise | Drop Chance | Special |
|------|-------|----------|-------------|-------|-------------|---------|
| 💡 LIGHT_BULB | 0.01 | ✅ | ❌ | 2 (glass) | 0% | Fragile — any kick/projectile/AoE shatters |
| 💻 MONITOR | 2 | ✅ | ❌ | 3 (sparks) | 5% | Drops thumb drive |
| 💻 TERMINAL | 3 | ❌ | ❌ | 3 | 3% | Drops keycard (if gate exists) |
| 🕯️ TORCH | 1 | ✅ | ✅ | 0 (silent) | 0% | Can be smothered (adjacent tap) |
| 🏮 LAMP_POST | 2 | ✅ | ❌ | 1 (topple) | 0% | Passive waft + active drag |
| 🪔 LAVA_LAMP | 1 | ✅ | ❌ | 1 | 0% | - |
| 🔥 FIRE | 0 | ❌ | ❌ | - | - | Extinguish with Water Bottle |
| 🏕️ CAMPFIRE | 0 | ❌ | ❌ | - | - | Extinguish with Water Bottle |
| 🌋 LAVA_FLOOR | 0 | ❌ | ❌ | - | - | Indestructible terrain |

**Destruction Effects:**
- Light source removed from lighting system
- Light map immediately updated (smooth fade via interpolation)
- Noise raised (alerts nearby enemies)
- Smoke spawned (optional, config-controlled)
- Loot drops (keycards, thumb drives based on chance)
- Player gains stealth bonus from new darkness

### 6. Lantern Drag System (`lantern-drag-system.js`)

The LAMP_POST type has two drag modes:

**Passive Waft (walk-through):**
- Player walks over a lantern tile; the lantern attaches automatically
- `WAFT_DISTANCE = 3` tiles — lantern drifts along briefly then drops
- No speed penalty distinction (10% penalty applies to both modes)
- Triggered by `game-tick-system.js` tile traversal → `LanternDragSystem.tryAttach(b, ctx, true)`
- Design intent: player must "run laps" over a lantern to push it further

**Active Grab (tap on adjacent):**
- Player taps an adjacent LAMP_POST → lantern snaps to player tile
- `DROP_DISTANCE = 8` tiles — full drag distance for deliberate repositioning
- Triggered by `tap-move-system.js` adjacency handler → `LanternDragSystem.tryAttach(b, ctx)`
- Intended for rope mechanics and deliberate illumination placement

**Auto-detach conditions:** Combat starts, player exceeds distance limit, player taps self, player kicks another breakable, floor changes.

### 7. Movement & Light Source Interaction

Light-source breakables are registered in `ctx.breakables` but their grid tile stays `TILES.EMPTY` (not `TILES.BREAKABLE`). `move-player-system.js` skips the "BREAKABLE BLOCKS PATH" check for any breakable with `isLightSource = true`, allowing players to walk through light sources. This enables passive lantern wafting and makes lightbulbs, torches, etc. not block corridors.

### 8. Damage Avenues by Type

| Type | Kick (adjacent tap) | Projectile (Single Shot, etc.) | AoE (Grenade, explosion) | Smother (adjacent tap) | Special |
|------|-----|-----------|-----|---------|---------|
| 💡 LIGHT_BULB | ✅ 0.2 dmg (instant kill at 0.01 HP) | ✅ | ✅ | ❌ | — |
| 💻 MONITOR | ✅ 0.2 dmg | ✅ | ✅ | ❌ | — |
| 💻 TERMINAL | ❌ (kickable=false) | ✅ | ✅ | ❌ | — |
| 🕯️ TORCH | ✅ 0.2 dmg | ✅ | ✅ | ✅ silent | — |
| 🏮 LAMP_POST | ✅ 0.2 dmg | ✅ | ✅ | ❌ | Drag instead of kick if not already dragging |
| 🪔 LAVA_LAMP | ✅ 0.2 dmg | ✅ | ✅ | ❌ | — |
| 🔥 FIRE | ❌ (hp=0) | ❌ | ❌ | ❌ | Water Bottle card (not implemented) |
| 🏕️ CAMPFIRE | ❌ (hp=0) | ❌ | ❌ | ❌ | Water Bottle card (not implemented) |
| 🌋 LAVA_FLOOR | ❌ (hp=0) | ❌ | ❌ | ❌ | Indestructible |

## API Reference

### LightingSystem

**New Methods:**
```javascript
LightingSystem.setConfig(config)           // Apply lighting configuration
LightingSystem.getConfig()                 // Get current configuration
LightingSystem.setFloor(floorNum)          // Set floor for progression scaling
LightingSystem.getBreakableProps(type)     // Get breakable properties for light type
LightingSystem.isBreakable(type)           // Check if light type is breakable
```

**Updated Methods:**
```javascript
LightingSystem.generateBiomeLights(w, h, rooms, walls, grid)  // Now accepts grid for occupancy
LightingSystem.getLightSourcePositions(grid)  // Returns visibility metadata
```

**New Constants:**
```javascript
LightingSystem.LIGHT_SOURCE_BREAKABLE_PROPS  // Breakable properties by type
```

### GoneRogueDataRegistry

**New Methods:**
```javascript
GoneRogueDataRegistry.getLightingConfig()  // Get loaded lighting configuration
```

## Gameplay Integration

### Stealth Mechanics

1. **Tactical Darkness Creation:**
   - Player destroys lights to create stealth paths
   - Darkness increases stealth bonus (0-50 based on light intensity)
   - Enemy awareness affected by destruction noise

2. **Risk/Reward:**
   - Loud lights (monitors, terminals) alert enemies but may drop valuables
   - Silent lights (torches) can be smothered for zero noise
   - Strategic choice between speed and stealth

3. **Progression:**
   - Early floors have few interactive lights (focus on learning)
   - Late floors have many interactive lights (stealth becomes tactical requirement)

### Card Interactions

**Existing Cards That Work With Lights:**
- `Single Shot` - Standard projectile damage to breakable lights
- `Grenade` - AoE destroys all lights in radius (massive darkness, high noise)
- `Water Bottle` - Extinguishes FIRE and CAMPFIRE lights
- `Smoke Bomb` - Smoke tiles reduce light effectiveness (0.5 opacity)

## Configuration Tuning Guide

### Reducing Visual Clutter

Lower `visibleChanceBase` in `envLights.renderEmoji`:
```json
"visibleChanceBase": 0.20  // Show only 20% of lights
```

### Increasing Interactive Lights

Adjust progression curves:
```json
"interactiveShareByFloor": {
  "start": 0.40,  // 40% interactive on floor 1
  "end": 0.80     // 80% interactive by floor 30
}
```

### Performance Optimization

Set validation limits:
```json
"validation": {
  "maxLightsPerFloor": 100,
  "maxVisibleEmojiLightsPerScreen": 20
}
```

### Debug Mode

Enable debug overlay:
```json
"validation": {
  "debugOverlay": true
}
```

## Testing Checklist

- [x] Config loads successfully from JSON
- [x] Emoji visibility distribution respects configured chance
- [x] Doors and items never occluded by light emojis
- [x] Bulbs render upside-down on top layer
- [x] Floor progression scaling works correctly
- [x] Interactive lights register as breakables
- [x] Light destruction removes light from system
- [x] Light map updates immediately on destruction
- [x] Noise raises based on breakable properties
- [x] Smoke spawns when configured
- [x] Drops work based on configured chances

## Known Issues & Bugs

1. **Water Bottle extinguish not implemented** — FIRE and CAMPFIRE (hp=0) are documented as extinguishable with Water Bottle card, but no code path exists in `breakable-system.js` or `card-play-system.js` to handle this. These remain indestructible.

2. **Lantern grid tile inconsistency** — When `LanternDragSystem.update()` moves a lantern, it sets `ctx.grid[py][px] = TILES.BREAKABLE` at the new position. Since light sources don't normally have BREAKABLE tiles, this creates a mismatch after a lantern is dropped (grid tile says BREAKABLE but the lantern's `isLightSource` flag means it won't block movement). The tile should be reset to EMPTY on drop, but `drop()` doesn't currently clean up the grid tile.

3. **Tap-move adjacency only** — All kick/smother interactions require the player to be adjacent (1 tile away). There's no ranged kick or long-range smother. This is by design but can feel unresponsive when the player taps a light 2+ tiles away.

4. **No TERMINAL kick fallback** — TERMINAL has `kickable: false` but if a player taps an adjacent terminal, the kick code runs and deals 0 damage (blocked by the kickable check in `BreakableSystem.kickBreakable`). There's no feedback message telling the player to use a projectile instead.

## Future Enhancements

- [ ] Water Bottle card → extinguish FIRE/CAMPFIRE (requires card-play-system integration)
- [ ] EMP card (destroys all electronic lights in radius)
- [ ] Light repair mechanic (reverse operation for security guards)
- [ ] Dynamic light color based on floor danger level
- [ ] Flickering intensity based on power grid state
- [ ] Fix lantern drop grid tile cleanup (clear BREAKABLE tile on drop)
- [ ] TERMINAL feedback message ("Mounted — use projectile")

## References

- **Issue:** Lighting Engine Breakables (GitHub Issue)
- **Config Design:** See issue comments for detailed knob specifications
- **Lighting System:** `/docs/LIGHTING_SYSTEM.md`
- **Terraria TODO:** `/docs/TERRARIA_LIGHTING_TODO.md`
