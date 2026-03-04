# Explosive Breakables & Dynamic Destruction Roadmap

**Project**: EyesOnly — Gone Rogue
**Date**: 2026-03-02
**Scope**: Explosive barrels, blast physics, screen shake, breakable light polish, explosive cards in STR combat
**Status**: Phases 1-2 COMPLETE (2026-03-04) + bugfixes (2026-03-04). CHH Steps 1-4 complete.

---

## Design Intent

Classic red-barrel explosions as a first-class mechanic layered onto the existing breakable, lighting, ground effects, and projectile systems. Explosions create tactical area denial, chain reactions with lights, and introduce a pickpocket-to-detonate combat loop.

Grey barrels are inert cover. Red barrels detonate on destruction — AoE damage, ground fire, screen shake, and physics push on nearby emoji objects. Breakable lights near the blast radius get chain-destroyed, creating instant darkness zones. Explosive cards inserted in enemy inventory via pickpocket can be detonated mid-STR-combat.

---

## Phase 1 — Explosive Barrel Breakable Type ✔ COMPLETE (2026-03-04)

### 1.1 New Breakable Definitions

**File**: `breakable-system.js` + new config in `item-spawner.js`
(remove existing barrel or wastebasket emoji uses in breakables)
Add two barrel variants to the breakable type registry :

| Type | Emoji | HP | Kickable | Noise | Explosive | Blast Radius | Blast Damage | Drop |
|------|-------|----|----------|-------|-----------|-------------|-------------|------|
| `BARREL_GREY` | 🗑️ | 2 | ✅ | 1 | ❌ | — | — | Standard loot table |
| `BARREL_RED` | 🛢️ | 1 | ✅ | 4 (boom) | ✅ | 2.75 tiles | 9-25 HP | No loot (consumed) |

Grey barrels behave identically to existing breakables — they use the current `_spawnBreakableLoot` path in `breakable-system.js`. Red barrels override the destruction handler.

### 1.2 Destruction Override in BreakableSystem

When `breakable.explosive === true` and `breakable.hp` reaches 0, instead of the normal destroy path:

```
damageBreakable(breakable, amount, ctx)
  └─ if breakable.explosive
       └─ _triggerExplosion(breakable, ctx)   ← NEW
     else
       └─ existing destroy + loot path
```

**`_triggerExplosion(breakable, ctx)`** does the following in order:

1. Replace breakable tile with `TILES.DEBRIS` (scorched variant `'▓'`)
2. Call `ExplosionSystem.detonate(x, y, blastRadius, blastDamage, ctx)` — new module (Phase 2)
3. Skip `_spawnBreakableLoot` entirely — the barrel is consumed
4. Log `[Explosion] Red barrel detonated at x,y`

### 1.3 Chain Detonation

If the blast radius of one red barrel overlaps another red barrel, the second barrel takes blast damage. Since red barrels have 1 HP, any blast damage destroys them, triggering their own `_triggerExplosion`. This creates natural chain reactions.

Guard against infinite loops with a per-tick detonation set:

```javascript
var _detonatedThisTick = new Set();
// In _triggerExplosion:
var key = breakable.x + ',' + breakable.y;
if (_detonatedThisTick.has(key)) return;
_detonatedThisTick.add(key);
// Clear set at end of game tick
```

### 1.4 Spawning Rules

- Place 3 barrels for testing on floor 0 tavern
- Red barrels spawn in `plant`, `cave`, and `mall` biomes
- Never spawn adjacent to exits or the player start position
- Maximum 3 red barrels per floor (tunable in config)
- Grey barrels 🗑️ spawn in all biomes, higher weight than red
- Red barrels have a subtle idle animation: the 🛢️ emoji gets a pulsing red CSS glow via a class `explosive-idle` (2s infinite pulse, `box-shadow: 0 0 6px #ff3300`)

---

## Phase 2 — ExplosionSystem Module ✔ COMPLETE (2026-03-04)

### 2.1 New File: `public/js/explosion-system.js`

Stateless IIFE following the project's delegate pattern. Receives all mutable state via `ctx`.
Chain detonation loop guard (`_detonatedThisCascade`, `_cascadeDepth`, `MAX_CASCADE_DEPTH=5`) extracted from breakable-system.js.
`breakable-system.js` `_triggerExplosion()` refactored to delegate to `ExplosionSystem.detonate()` with minimal fallback.

**Public API**:

```javascript
ExplosionSystem.detonate(x, y, radius, damage, ctx)
ExplosionSystem.applyBlastToTile(tx, ty, distance, baseDamage, radius, ctx)
ExplosionSystem.pushEntity(entity, epicenterX, epicenterY, force, ctx)
```

### 2.2 `detonate(x, y, radius, damage, ctx)`

Iterates all tiles within `radius` using a circular BFS (same pattern as `GroundEffectsSystem.electrifyWater`). For each tile at distance `d`:

**Damage falloff**: `tileDamage = Math.floor(damage * (1 - d / (radius + 1)))`

**Per-tile effects** (via `applyBlastToTile`):

| Target | Effect | System Hook |
|--------|--------|-------------|
| Enemy | Take `tileDamage`, awareness → ENGAGED | `ctx.enemies`, `EnemyAISystem.increaseEnemyAwareness` |
| Player | Take `tileDamage * 0.5` (friendly fire reduction) | `ctx.player.hp` |
| Breakable (non-explosive) | Take `tileDamage` | `BreakableSystem.damageBreakable` |
| Breakable (explosive) | Take `tileDamage` → chain detonation | `BreakableSystem.damageBreakable` → recurse |
| Breakable light | Destroy + darkness creation | `_handleLightSourceDestruction` (existing) |
| Ground: empty floor | Set `GroundEffects.FIRE` (50% chance) or `SMOKE` (30%) | `GroundEffects.setGroundEffect` |
| Ground: OIL | Ignite → `OIL_IGNITED` | `GroundEffects.igniteOil` (existing) |
| Ground: WATER | Evaporate → `STEAM` | `GroundEffects.setGroundEffect('STEAM')` |
| Food item | Destroy (burnt) | `InteractiveItems.removeItem` |
| Interactive item | Damage if breakable | existing interactive breakable path |

**Noise**: Call `ctx.raiseNoise(x, y, 8)` — explosions are the loudest event in the game. All enemies on the floor go to at least SUSPICIOUS.

### 2.3 Entity Push (Knockback)

Any entity (enemy, interactive item with `movable: true`, food item) within the blast radius gets pushed away from the epicenter:

```javascript
function pushEntity(entity, epicenterX, epicenterY, force, ctx) {
  var dx = entity.x - epicenterX;
  var dy = entity.y - epicenterY;
  var dist = Math.sqrt(dx * dx + dy * dy) || 1;

  // Normalize and scale by force (tiles to push)
  var pushX = Math.round((dx / dist) * force);
  var pushY = Math.round((dy / dist) * force);

  var targetX = entity.x + pushX;
  var targetY = entity.y + pushY;

  // Validate target (wall collision stops push, entity takes 2 bonus damage)
  // Step tile-by-tile toward target, stop at first wall
  // ... Bresenham walk using existing checkLineOfSight pattern from EnemyAISystem
}
```

**Push force by distance**:
- Distance 1 (adjacent): push 2 tiles
- Distance 2: push 1 tile
- Distance 3: push 0 tiles (damage only)

If an entity is pushed into a wall, it stops at the tile before the wall and takes `2` bonus impact damage. If pushed into another entity, both take `1` impact damage and neither moves further.

### 2.4 Visual Effects (see Phase 3)

`detonate` also triggers all visual effects — screen shake, flash, particle ring — by calling into `ExplosionVFX` (Phase 3).

---

## Phase 3 — Visual Effects & Screen Shake

### 3.1 Screen Shake

**File**: `public/css/crt.css` + trigger from `explosion-system.js`

CSS keyframe approach matching the existing `water-wave-roll` pattern:

```css
@keyframes explosion-shake {
  0%   { transform: translate(0, 0); }
  10%  { transform: translate(-4px, 3px); }
  20%  { transform: translate(5px, -2px); }
  30%  { transform: translate(-3px, -4px); }
  40%  { transform: translate(4px, 2px); }
  50%  { transform: translate(-2px, 3px); }
  60%  { transform: translate(3px, -1px); }
  70%  { transform: translate(-1px, 2px); }
  80%  { transform: translate(2px, -1px); }
  100% { transform: translate(0, 0); }
}

.explosion-shake {
  animation: explosion-shake 0.4s ease-out;
}
```

Applied to the same `#game-frame` / `.game-window` element used by water effects. The 0.4s duration is intentionally shorter than water's 1s — explosions feel snappy.

**Frame flash**: Orange-red border flash, same pattern as water's blue:

```css
@keyframes explosion-flash {
  0%   { box-shadow: inset 0 0 60px rgba(255, 80, 0, 0.8); }
  50%  { box-shadow: inset 0 0 30px rgba(255, 120, 0, 0.4); }
  100% { box-shadow: inset 0 0 0 rgba(255, 80, 0, 0); }
}

.explosion-flash {
  animation: explosion-flash 0.6s ease-out;
  border-color: rgba(255, 80, 0, 0.8) !important;
}
```

Both classes applied simultaneously, removed after their durations via `setTimeout`.

### 3.2 Overhead Explosion Emoji

Use the existing `OverheadAnimator.showGenericExpression` at the epicenter:

```javascript
OverheadAnimator.showGenericExpression(x, y, '💥', 800, '#FF5000');
```

For each tile in the blast radius, spawn a brief '🔥' overhead at staggered delays (30ms per distance ring) to create a ripple-out effect:

```javascript
for (var d = 1; d <= radius; d++) {
  tilesAtDistance(d).forEach(function(tile, i) {
    setTimeout(function() {
      OverheadAnimator.showGenericExpression(tile.x, tile.y, '🔥', 400, '#FF8800');
    }, d * 80 + i * 15);
  });
}
```

### 3.3 Breakable Light Explosion Polish

When a breakable light is destroyed by an explosion (not by direct player shot), add enhanced effects:

- **Glass shatter**: If the light type is `LIGHT_BULB` or `MONITOR`, spawn a `GLASS` ground effect at the tile via `GroundEffects.setGroundEffect(x, y, 'GLASS')`
- **Spark shower**: Show `'✨'` overhead at the light's position for 600ms
- **Darkness ripple**: The lighting system already recalculates on `removeLightSource`. No additional work needed, but log it: `[Explosion] Light destroyed at x,y — darkness zone created`

This reuses the existing `_handleLightSourceDestruction` in `breakable-system.js` which already handles smoke spawn and noise. The explosion just provides a more dramatic visual wrapper.

### 3.4 MOK + Debrief + Tooltip

Following the unified pickup/event pipeline:

- **MOK interjection**: `'💥 Explosion! Red barrel detonated'`
- **Debrief feed**: `DebriefFeedController.reportEvent('EXPLOSION', { x, y, damage, entitiesHit })`
- **Tooltip**: `TooltipSystem.showGeneric('💥 BOOM! ' + entitiesHit + ' targets hit', 2000)`

---

## Phase 4 — Breakable Lights: More Interactive & Dynamic

### 4.1 Explosion Chain with Lights

Lights that have `hp > 0` in the LIGHT_SOURCE_BREAKABLE_PROPS table are treated as breakables during explosion BFS. This means:

- `MONITOR` (2 HP) might survive a radius-3 blast at distance 3 (falloff damage < 2)
- `LIGHT_BULB` (1 HP) always destroyed within blast radius
- `TORCH` (1 HP) destroyed + fire ground effect remains (torch was already fire)

### 4.2 New Light Interaction: Throw Into

Allow the player to KICK a barrel (grey or red) into a breakable light:

```
KICK EAST → barrel moves 1 tile east
  └─ if barrel lands on breakable light tile
       └─ light takes 1 damage
       └─ if red barrel → immediate detonation at new position
```

This reuses the existing kick direction parsing and adds a post-kick position check.

### 4.3 Flickering Intensification Before Explosion

When a red barrel takes damage but doesn't die (e.g., if HP were increased to 2 in a future balance pass), breakable lights within radius 2 begin flickering rapidly — a visual warning:

```javascript
// In damageBreakable, if explosive and hp > 0:
LightingSystem.setFlickerOverride(nearbyLights, { rate: 4.0, duration: 2000 });
```

This is a polish feature and can be deferred. The lighting config already has flicker controls.

---

## Phase 5 — Explosive Cards & STR Combat Integration

### 5.1 New Card Type: Explosive Cards

Three explosive cards added to the card pool:

| Card | Cost | Damage | Range | Special |
|------|------|--------|-------|---------|
| `FRAG_GRENADE` | 3 energy | 12 | AoE 2 | Knockback 1, ground FIRE 30% |
| `PIPE_BOMB` | 2 energy | 8 | AoE 1 | Stun 1 turn, high noise |
| `C4_CHARGE` | 4 energy | 20 | AoE 3 | Delayed 1 turn, massive radius |

These cards exist in the `CardSystem` pool and can appear in:
1. Breakable loot drops (via existing `_spawnFallbackLoot` / `LootTableManager`)
2. Enemy inventories (new)
3. Vendor shops at bonfires

### 5.2 Enemy Explosive Inventories

Enemies can now carry explosive cards in their inventory:

```javascript
// In enemy generation (floor-builder or enemy spawner):
enemy.inventory = enemy.inventory || [];

// Common tier: 20% chance to carry PIPE_BOMB
// Uncommon tier: 35% chance to carry FRAG_GRENADE
// ELITE tier: 15% chance to carry C4_CHARGE
if (rng() < explosiveChance[enemy.tier]) {
  enemy.inventory.push({
    type: 'card',
    card: CardSystem.createCard(explosiveCardForTier[enemy.tier])
  });
}
```

Enemies with explosive cards inserted in their inventory gain a subtle indicator: a small `'💣'` shown via overhead animator when the player is within sight range and has the `Pickpocket Gloves` equipped. This is a "telegraph".

### 5.3 Pre-Combat Pickpocket Flow player with pickpocket gloves equipped and toggled on taps on nearby enemy (1 tile away) that is not engaged.

The existing `STEAL` command (requires Pickpocket Gloves equipped) is extended:

**Current flow**: `STEAL → adjacent enemy → roll success → get random item`

**Extended flow**:
```
STEAL → adjacent enemy / stealth check → roll success
  └─ enemy's combat card hand is displayed as a joker.emoji stack similar to the NCH capsule but each card is a selectable node.
       └─ 40% chance: player drags a card from their NCH popup into the enemies' NCH capsule with an empty selectable node (hopefully the player was planting an explosive card).
       └─ 60% chance: steal other item (existing behavior to be reworked with interactive nodes)
  └─ else
       └─ existing behavior
```

On successful explosive plant, MOK interjection: `'💣 Planted a [card name]!'`

### 5.4 STR Combat: Playing Explosive Cards

During the CARDPLAY phase of STR combat, explosive cards that are planted are fired by toggling the pickpocket gloves from the equipped item tab (depending on the card: c4 charge ) or by using any other synergy that chains with an explosive:

**`FRAG_GRENADE`**:
- Deals 12 damage to the combat enemy
- If enemy is on a ground effect tile, applies blast interaction (fire + oil = ignite, water = steam)
- 30% chance to apply `BURNING` status to enemy
- Knockback: enemy pushed 1 tile away (if not against wall)
- Screen shake (reduced intensity, 0.2s)

**`PIPE_BOMB`**:
- Deals 8 damage
- Stuns enemy for 1 turn (enemy skips next card play)
- Raises noise to 6 (alerts other enemies outside combat)
- No ground effect

**`C4_CHARGE`**:
- Costs 4 energy but deals 20 damage
- Triggered during STR-combat for an automatic round advancement by toggling the pickpocket gloves item while equipped
- If the enemy moves (some enemies reposition in STR), the C4 stays at the original tile — enemy might dodge it
- Massive radius means if there are environmental breakables near the combat area, they get destroyed too

### 5.5 Enemy Explosive Usage (AI)

If an enemy still has explosive cards in their inventory when combat starts (player didn't steal them), the enemy can play them:

- Enemy AI plays explosive cards when player HP > 50% (save for when it matters)
- Enemy explosive cards deal 60% of listed damage to player (balance: enemies shouldn't one-shot)
- Player sees a `'Joker.emoji'` telegraph overhead when sneaking on an unsuspecting enemy with a full inventory
- Player sees a greyed out joker.emoji telegraph overhead when sneaking on an unsuspecting enemy with available inventory slots for planting 
- This creates the strategic loop: pickpocket to disarm or plant.

## Phase 6 — Polish & Integration

### 6.1 Script Load Order

Add to `public/index.html`:

```html
<script src="js/explosion-system.js"></script>  <!-- After breakable-system.js -->
```

### 6.2 Initialization

In `gone-rogue.js` → `start()`:

```javascript
if (typeof ExplosionSystem !== 'undefined') {
  console.log('[GoneRogue] Explosion system loaded');
}
```

### 6.3 Sound Design Hooks

Although sound isn't implemented yet, add event hooks for future audio:

```javascript
// In ExplosionSystem.detonate:
if (typeof AudioSystem !== 'undefined') {
  AudioSystem.play('explosion_large', { x: x, y: y, volume: 1.0 });
}
```

### 6.4 Config Integration

Add explosion tuning to `lighting-config.json` (or a new `explosions-config.json`):

```json
{
  "explosions": {
    "redBarrel": {
      "hp": 1,
      "blastRadius": 3,
      "blastDamage": { "min": 15, "max": 25 },
      "fireChance": 0.5,
      "smokeChance": 0.3,
      "shakeDuration": 400,
      "flashDuration": 600,
      "maxPerFloor": 3,
      "pushForce": { "d1": 2, "d2": 1, "d3": 0 },
      "friendlyFireMultiplier": 0.5
    },
    "chainDetonationDelay": 100,
    "maxChainDepth": 5
  }
}
```

---

## Implementation Order & Dependencies

**Prerequisite: CHH Steps 1-2 (registerCardInstance, hydrateCard) - COMPLETE**

```
Phase 1 (Barrel types)
  ├─ No new files, extends breakable-system.js + item-spawner.js
  └─ Prerequisite: CHH Steps 1-2 ✓ (READY TO START)

Phase 2 (ExplosionSystem)
  ├─ New file: explosion-system.js
  ├─ Depends on: Phase 1, GroundEffects, BreakableSystem, EnemyAISystem
  └─ Hooks into: breakable-system.js damageBreakable

Phase 3 (VFX)
  ├─ Extends: crt.css, explosion-system.js
  ├─ Depends on: Phase 2, OverheadAnimator
  └─ Uses: existing game-frame CSS animation pattern

Phase 4 (Light interactions)
  ├─ Extends: breakable-system.js, lighting config
  ├─ Depends on: Phase 2, Phase 3, LightingSystem
  └─ Optional polish, can ship without

Phase 5 (Explosive cards + STR combat)
  ├─ Extends: CardSystem, enemy generation, STR combat
  ├─ Depends on: CHH Step 1 (registerCardInstance) ✓, Phase 2 (for ground effect interactions)
  └─ Independent of Phase 3/4 (VFX not required for combat cards)

Phase 6 (Polish)
  ├─ Config, load order, sound hooks
  └─ Depends on: all phases complete
```

**Estimated scope**: Phases 1-3 are the core deliverable (~400 lines new code, ~80 lines modified). Phase 4 is ~60 lines. Phase 5 is ~200 lines touching the card/combat systems. Phase 6 is integration glue.

---

## Testing Checklist

### Explosive Barrels
- [ ] Red barrel spawns in correct biomes with 🛢️ emoji
- [ ] Red barrel detonates on 0 HP (projectile, kick, or chain)
- [ ] Grey barrel does NOT detonate, drops normal loot
- [ ] Chain detonation works (2+ red barrels in range)
- [ ] Chain detonation capped at `maxChainDepth`
- [ ] No infinite loop on chain detonation

### Blast Effects
- [ ] Enemies in radius take falloff damage
- [ ] Player takes reduced friendly fire damage
- [ ] Breakables in radius take damage
- [ ] Ground effects applied (fire on empty, ignite oil, evaporate water)
- [ ] Food items in radius destroyed
- [ ] Breakable lights in radius destroyed → darkness zone
- [ ] Noise raised to 8 at epicenter

### Knockback / Push
- [ ] Enemies pushed away from epicenter
- [ ] Push stops at walls (bonus impact damage)
- [ ] Push stops at other entities (both take impact damage)
- [ ] Push force scales with distance correctly

### Visual Effects
- [ ] Screen shake plays on detonation (0.4s)
- [ ] Orange-red frame flash plays (0.6s)
- [ ] Epicenter shows 💥 overhead
- [ ] Blast radius shows staggered 🔥 overheads
- [ ] MOK interjection displays
- [ ] Tooltip shows hit count
- [ ] Red barrel idle glow pulses

### Explosive Cards in Combat
- [ ] FRAG_GRENADE deals AoE damage + knockback
- [ ] PIPE_BOMB stuns + noise
- [ ] C4_CHARGE delayed detonation resolves correctly
- [ ] Pickpocket can steal explosive cards from enemies
- [ ] Enemy AI plays explosive cards with telegraph warning
- [ ] Enemy explosive damage reduced to 60% against player
- [ ] 💣 indicator shows on enemies carrying explosives (when player has gloves)

### Integration
- [ ] Scripts load in correct order
- [ ] No console errors on floor generation
- [ ] Explosion doesn't break during STR combat active
- [ ] Debrief feed reports explosion events
- [ ] Config values properly loaded and applied

---

## Canon Compliance Notes

- **RESOURCE_COLOR**: Explosion damage to player reports via debrief with HP pink `#FF6B9D`
- **ASCII floors / emoji interactives**: Red barrel is emoji `🛢️`, blast leaves ASCII debris `▓` on floor — compliant
- **No ghost collision emojis**: Barrels are solid breakables, not ghost collision — compliant
- **Overhead animations**: Use `showGenericExpression` with explicit colors, NOT `showExpression('LOOT')` — compliant with `COLLECTIBLES_CANON.md`
- **Debrief HOT**: Explosion HP damage reports instantly (not HOT) since it's combat damage, not food consumption
