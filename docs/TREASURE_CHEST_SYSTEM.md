# Treasure Chest System — 🧰 Toolbox Key-Ammo Gates

### v1.0 — March 2026

---

## Vision

Toolbox chests (🧰) are **interactable breakables** that gate loot behind a hidden key_ammo cost. The player deploys key_ammo via a **long-hold ticker** — the same input pattern used for THEFT_MECHANICS NCH interactions against enemies. If the player releases before meeting the hidden cost, the chest stays locked and the spent keys are lost. If they meet or exceed the cost, the chest pops open and yields its contents.

This creates a **guess-and-check resource pressure loop**: players spend key_ammo speculatively, encouraging both hoarding and risk-taking. Items that reduce or reveal key_ammo costs soften the gate, while items that increase "attack power" (key throughput per tick) let players deploy keys faster.

**Why 🧰 Toolbox**: The treasure chest emoji (🧱/🗃️) renders as tofu on Windows. The toolbox emoji 🧰 renders universally and reads as "container with useful things inside."

---

## Core Mechanic: Long-Hold Key Deployment

### Input Pattern

The long-hold key deployment is the **same input** used for THEFT_MECHANICS §1 enemy interactions. Adjacent-to-target, long press begins deploying key_ammo. This unifies the "spend keys to interact" pattern across both enemies and chests.

```
Player adjacent to 🧰 chest:

pointerdown / touchstart on chest tile:
  → start timer (_pressStartTime = Date.now())
  → show "hold" ring (same ring as enemy long-press, fills over time)
  → begin key_ammo deployment ticker (1 key per TICK_INTERVAL)

TICK_INTERVAL = 350ms (tunable per tier)

Every TICK_INTERVAL while held:
  → IF GAMESTATE.keys.ammo > 0:
      → consume 1 key_ammo from GAMESTATE.keys.ammo
      → animate 🗝 flying from player tile → chest tile (2-tile gap)
      → debrief feed: key_ammo counter decrements
      → increment chest._keysReceived
      → show chest progress indicator (subtle, NO exact count)
  → ELSE:
      → release forced — player has no more keys
      → treat as voluntary release (check success below)

pointerup / touchend:
  → stop ticker
  → evaluate: chest._keysReceived >= chest._unlockCost ?
    → YES: SUCCESS — chest breaks open, loot spawns
    → NO:  FAILURE — keys lost, chest remains locked, debrief frame flashes RED
```

### Controller Mappings

| Input | Touch | Keyboard | Xbox | QuadStick |
|---|---|---|---|---|
| Begin deploy | Hold tap on chest (≥400ms) | E (hold toward chest) | A (hold) | Sustained sip |
| Release / stop | Lift finger | Release E | Release A | Release sip |
| Cancel (before first tick) | Drag away | Escape | B | Light puff |

> Per THEFT_MECHANICS §1, this is the same input fork. The context dispatch routes to chest unlock instead of enemy NCH based on the target type being `breakableChest` rather than `enemy`.

---

## Hidden Cost Model

### Cost by Floor Tier

The chest's unlock cost is hidden from the player. They must guess based on floor depth and experience.

| Floor Range | Tier | Cost Range | Expected Cost | Player Key Budget |
|---|---|---|---|---|
| 0–10 | Tier 1 | 2–5 keys | ~3 keys | Low (Flipper Zero grants 1–5/floor) |
| 11–25 | Tier 2 | 4–8 keys | ~6 keys | Medium |
| 26–40 | Tier 3 | 6–12 keys | ~9 keys | High (multiple key sources) |
| 41+ | Tier 4 | 8–15 keys | ~12 keys | Must have key mitigation items |
| Boss floors | Boss | 5–10 keys | ~7 keys | Higher loot quality compensates |
| Vents | Vent | 1–3 keys | ~2 keys | Low-risk, guaranteed encounter |

### Cost Calculation

```javascript
function _calculateUnlockCost(floor, biome, rng) {
  var tier = Math.floor(floor / 10);  // 0=T1, 1=T2, 2=T3, 3+=T4
  var baseCost = [3, 6, 9, 12][Math.min(tier, 3)];
  var variance = [1.5, 2, 3, 3][Math.min(tier, 3)];

  // Deterministic per-chest via seedrandom
  var cost = Math.round(baseCost + (rng() - 0.5) * 2 * variance);
  cost = Math.max(tier + 2, cost);  // minimum: tier+2

  // Biome modifiers
  if (biome === 'VENT') cost = Math.max(1, Math.round(cost * 0.3));
  if (biome === 'VAULT') cost = Math.round(cost * 1.4);

  return cost;
}
```

### Overspend Behavior

The player can spend MORE keys than the chest costs. The chest opens the moment `_keysReceived >= _unlockCost`, but if the player is still holding, extra keys continue to deploy until they release. Overspent keys are **lost** — this is intentional pressure. The chest pops immediately on threshold, giving a visual signal to release.

---

## Visual Presentation

### Map Rendering — Pulse (NOT Bob)

Per COLLECTIBLES_CANON.md §Map Rendering Specification, the toolbox chest is an **interactable**, not a collectible. It uses the **pulse** animation family:

| Property | Value | Rationale |
|---|---|---|
| Emoji | 🧰 | Universal render, reads as "container" |
| Animation | Pulse (±10% scale, ~2s) | Interactable doctrine — "interact with me" |
| Bob | NONE | Not a collectible — not picked up directly |
| Shadow | Standard ellipse, constant size | Pulse objects don't scale shadow |
| Color glow | Gold `#FFD700` | Key-related, matches T2 key items |
| `_wt` tag | `interactive` | Routes through interactive render path |

### Key Deployment Animation

While the player holds and keys are deploying:

```
T+0ms:     Hold ring begins filling (gold ring, same as enemy long-press)
T+350ms:   First 🗝 emoji flies from player tile → chest tile
             · Key follows arc path (parabolic, peaks at 0.3 cells above midpoint)
             · Tinted #FF8A3D (key_ammo orange)
             · Duration: 250ms flight
           Debrief feed: key_ammo row decrements, frame flashes #FF8A3D
           Chest: subtle gold pulse intensifies slightly
T+700ms:   Second 🗝 flies
T+1050ms:  Third 🗝 flies
...continues until release or keys exhausted...
```

### Success Animation

```
T+0ms:    Chest _keysReceived meets _unlockCost
T+0ms:    Chest emoji scales to 1.3x, gold burst (OverheadAnimator)
T+100ms:  Screen micro-shake (2px, 100ms — same as breakable destroy)
T+200ms:  Chest "breaks" — destroyedGlyph replaces tile (debris or open box glyph)
T+200ms:  Debrief feed frame flashes GREEN (#00FF00)
T+300ms:  Loot spawns at chest position (bobs — now collectible, not interactable)
T+400ms:  OverheadAnimator: loot summary via showStackedText()
T+500ms:  Tooltip: "🧰 UNLOCKED — [loot summary]"
```

### Failure Animation

```
T+0ms:    Player releases before _unlockCost met
T+0ms:    Hold ring snaps to empty (failed)
T+100ms:  Chest wobbles (scale 1.05x → 0.95x → 1.0x, 300ms)
T+100ms:  OverheadAnimator: "🔒" red (#FF4444), 800ms
T+200ms:  Debrief feed frame flashes RED (#FF4444)
T+300ms:  Tooltip: "🔒 LOCKED — not enough keys (spent N)"
T+400ms:  Keys are gone. Chest remains. Player can try again with more keys.
```

---

## Loot Table

Chest contents are "loot table plus" — the same breakable loot table PLUS a guaranteed item drop. The guaranteed item is the reason to open chests.

### Loot Composition

```
Chest loot = Standard breakable loot (LootTableManager or fallback)
           + Guaranteed item drop (1x equipment or consumable from items.json)
           + Bonus key_ammo refund (10-30% of cost, rounded down)
```

### Guaranteed Item Pool by Tier

| Tier | Item Pool | Rarity Distribution |
|---|---|---|
| T1 (floors 0-10) | ITM-098 Skeleton Keyring, ITM-099 Wax Kit, ITM-103 Flipper Zero, consumables | 70% common, 25% uncommon, 5% rare |
| T2 (floors 11-25) | Passive equipment, active tools, combat consumables | 50% uncommon, 35% rare, 15% epic |
| T3 (floors 26-40) | Rare equipment, synergy items, powerful consumables | 30% rare, 50% epic, 20% legendary |
| T4 (floors 41+) | Best-in-slot equipment, unique items | 20% epic, 60% legendary, 20% unique |
| Boss | Boss-specific loot table + guaranteed rare+ | Guaranteed rare or better |
| Vent | Key mitigation items, small consumables | 80% common, 20% uncommon |

### Key Refund

On successful unlock, the chest refunds a portion of the cost as key_ammo:

```javascript
var refund = Math.floor(chest._unlockCost * (0.1 + rng() * 0.2));  // 10-30%
if (refund > 0) {
  GAMESTATE.addKeyAmmo(refund);
  // Overhead: "+N🗝" in orange #FF8A3D
}
```

This softens the overspend penalty — even if you spent 5 keys on a 3-key chest, you might get 1 back.

---

## Spawn Rules

### Floor Distribution

```
Base spawn chance per floor:

Floor 0 (tutorial):  0%  — tutorial has Flipper Zero in a breakable, no chests
Floors 1-10 (T1):    33% chance per floor (~1 chest every 3 floors)
Floors 11-25 (T2):   50% chance per floor (~1 chest every 2 floors)
Floors 26-40 (T3):   75% chance per floor
Floors 41+ (T4):     90% chance per floor (almost guaranteed)
Boss floors:          100% — always 1 chest
Vent floors:          100% — always 1 chest (low cost, low reward)
```

### Biome Modifiers

| Biome | Modifier | Reasoning |
|---|---|---|
| COZY_FOREST | 1.0x (baseline) | Standard |
| OFFICE | 1.2x spawn chance | More containers in office environments |
| VAULT | 1.5x spawn chance, 1.4x cost | Vault theme = more chests but more expensive |
| SEWER | 0.7x spawn chance | Less loot in sewers |
| VENT | Always spawns, 0.3x cost | Guaranteed cheap chests in vents |

### Placement

Chests spawn during floor generation, placed by the same system that places breakables:

```
1. Floor generator creates room layouts
2. For each room with breakable spawn points:
   a. Roll chest spawn chance (per floor/biome rules above)
   b. If chest spawns, pick a breakable slot and replace it with a chest
   c. Chest gets: { type: 'breakableChest', emoji: '🧰', _unlockCost, drops, ... }
3. Chest is added to ctx.breakables[] with special type flag
```

A chest takes the place of one breakable per room — it doesn't add extra objects. This keeps floor density consistent.

---

## Item Interactions

### Items That Affect Chest Costs

| Item | Effect | Mechanic |
|---|---|---|
| ITM-098 Skeleton Keyring | -1 key cost per chest (passive) | `theft_key_ammo_discount` reduces `_unlockCost` at spawn time |
| ITM-103 Flipper Zero | +1-5 key_ammo per floor (passive) | Increases key budget, doesn't reduce cost |
| ITM-099 Wax Impression Kit | +2 key_ammo on use (consumable) | Emergency key supply before a chest attempt |
| **NEW: ITM-104 Locksmith's Lens** | Reveals exact chest cost (passive) | Shows `_unlockCost` as tooltip on adjacent chest — removes guessing |
| **NEW: ITM-105 Masterwork Pick** | +1 key throughput per tick (active, equipped) | `TICK_INTERVAL` reduced from 350ms to 250ms — deploy keys faster |
| **NEW: ITM-106 Greed Charm** | +50% chest loot quality, +30% chest cost (passive) | Higher rarity rolls but more expensive chests |

### Items That Affect Enemy Key Deployment (Shared)

The long-hold key deployment is the same system for both chests and THEFT_MECHANICS enemy interactions. Items that buff one buff both:

- **Key throughput** items (ITM-105 Masterwork Pick): faster ticks = faster deployment on both chests and enemies
- **Key discount** items (ITM-098 Skeleton Keyring): reduce cost on chests AND theft actions
- **Key budget** items (ITM-103 Flipper Zero, ITM-099 Wax Kit): more keys in pool for both uses

This creates meaningful equipment choices: do you optimize for chest-opening (Locksmith's Lens reveals costs) or enemy theft (Pickpocket Gloves enable steal/plant)?

---

## Data Model

### Breakable Chest Object

```javascript
{
  // Standard breakable fields
  x: 15, y: 8,
  type: 'breakableChest',
  name: 'Toolbox',
  emoji: '🧰',
  hp: Infinity,            // Cannot be damaged by kicks — only unlocked by keys
  maxHp: Infinity,
  kickable: false,         // Cannot be kicked/pushed
  destroying: false,
  destroyedGlyph: '░',     // Open/empty container glyph

  // Chest-specific fields
  _unlockCost: 5,          // Hidden from player (seedrandom per floor)
  _keysReceived: 0,        // Tracks keys deployed so far (persists between attempts)
  _unlocked: false,        // True once cost met
  _tier: 1,                // Floor tier for loot table
  _biome: 'COZY_FOREST',   // Biome for loot modifiers

  // Loot definition
  drops: {
    itemId: 'ITM-098',     // Guaranteed item drop (resolved from items.json)
    lootTable: true         // Also rolls standard breakable loot table
  },

  // Interactive properties
  isInteractive: true,      // Routes through interactive render path
  interactType: 'CHEST',    // Distinguishes from ROPE, BUTTON, LEVER, etc.
  interactRange: 1,         // Must be adjacent (Manhattan distance 1)

  // Visual
  noise: 3,                 // Opening a chest makes noise
  isLightSource: false
}
```

### GAMESTATE Extensions

```javascript
// New methods needed:
GAMESTATE.getKeyAmmo()          // Already exists: getTotalKeyAmmo()
GAMESTATE.consumeKeyAmmo(n)     // Decrement keys.ammo by n, return success bool
GAMESTATE.addKeyAmmo(n)         // Increment keys.ammo by n (for refunds)
```

---

## Unified Key Deployment System

The long-hold key deployment is a **shared system** used by both treasure chests and THEFT_MECHANICS enemy interactions. This section defines the shared module.

### Module: `key-deploy-system.js`

```
KeyDeploySystem — IIFE singleton

Public API:
  .beginDeploy(targetX, targetY, targetType, ctx)
    → starts ticker, shows hold ring, begins key flight animation
    → targetType: 'chest' | 'enemy'

  .stopDeploy()
    → stops ticker, evaluates success/failure
    → returns { keysSpent, success, target }

  .isDeploying()
    → returns bool

  .getKeysSpent()
    → returns current _keysDeployed count

Internal:
  _tickInterval: 350ms (base, modified by items)
  _keysDeployed: 0
  _target: null
  _tickTimer: null

On each tick:
  1. Check GAMESTATE.keys.ammo > 0
  2. GAMESTATE.consumeKeyAmmo(1)
  3. Animate key flight (OverheadAnimator or custom 2-tile arc)
  4. DebriefFeedController.reportResourceChange('key_ammo', old, new)
  5. Increment _keysDeployed
  6. If targetType === 'chest': check chest._keysReceived >= chest._unlockCost
     If met: auto-trigger success (chest pops immediately)
  7. If targetType === 'enemy': key is spent toward NCH node action
```

### Integration with THEFT_MECHANICS

Per THEFT_MECHANICS §6, theft actions cost key_ammo. The key deployment system unifies this:

| Target | Deploy Pattern | Success Condition |
|---|---|---|
| 🧰 Chest | Hold → keys fly → hidden threshold | `_keysReceived >= _unlockCost` |
| 🃏 Enemy NCH node (PICKPOCKET) | Hold → keys fly → 1 key per action | 1 key consumed per steal attempt |
| 🃏 Enemy NCH node (SWAP) | Hold → keys fly → 2 keys per action | 2 keys consumed per swap |

The visual and input pattern is identical — the player learns one gesture that works on both targets.

---

## Roadmap

### Phase 1 — Shared Key Deploy System

**Goal:** Create `key-deploy-system.js` with the long-hold ticker, key flight animation, and debrief feed integration. Testable without chests — can deploy keys at any adjacent tile.

**Files:**
- New: `public/js/key-deploy-system.js`
- Modified: `public/js/gamestate.js` — add `consumeKeyAmmo(n)` and `addKeyAmmo(n)` if missing
- Modified: `public/index.html` — script tag

**Estimated:** ~80 lines

### Phase 2 — Breakable Chest Data & Spawn

**Goal:** Add chest objects to floor generation. Chests appear on the map as 🧰 with pulse animation. No interaction yet — just visual presence.

**Files:**
- Modified: `public/js/floor-generator.js` — chest spawn logic in room generation
- Modified: `public/js/breakable-system.js` — recognize `type: 'breakableChest'`, skip kick damage, route to key deploy
- Modified: `public/js/gone-rogue-mobile.js` — render chest as interactive (pulse, gold glow)
- Modified: `public/js/gone-rogue-canvas.js` — same render treatment

**Estimated:** ~60 lines across files

### Phase 3 — Chest Unlock Interaction

**Goal:** Wire the key deploy system to chests. Adjacent long-hold deploys keys, success/failure evaluation, chest break animation, loot spawn.

**Files:**
- Modified: `public/js/key-deploy-system.js` — chest-specific success evaluation
- Modified: `public/js/breakable-system.js` — `_unlockChest(chest, ctx)` function, loot spawn on success
- Modified: `public/js/tap-move-system.js` or `input-dispatcher.js` — route chest long-press to KeyDeploySystem

**Estimated:** ~100 lines

### Phase 4 — Loot Table Integration

**Goal:** Chest loot = standard breakable loot + guaranteed item + key refund. Wire to LootTableManager with chest-specific tier multipliers.

**Files:**
- Modified: `public/js/breakable-system.js` — `_spawnChestLoot(chest, ctx)` with guaranteed item + loot table + refund
- Modified: `public/data/gone-rogue/items.json` — add ITM-104 Locksmith's Lens, ITM-105 Masterwork Pick, ITM-106 Greed Charm

**Estimated:** ~70 lines

### Phase 5 — Item Buff Integration

**Goal:** Equipped items modify chest costs, deploy speed, and loot quality. ITM-104 reveals exact cost. ITM-105 speeds up ticks. ITM-106 increases quality and cost.

**Files:**
- Modified: `public/js/key-deploy-system.js` — check equipped items for tick rate modifier
- Modified: `public/js/floor-generator.js` — check equipped items for cost modifier at spawn
- Modified: `public/js/tooltip-system.js` — show cost tooltip when ITM-104 equipped + adjacent to chest

**Estimated:** ~50 lines

### Phase 6+ — Polish

- Fly-to arc animation for keys (parabolic path instead of linear)
- Chest "rumble" animation while keys are deploying (subtle shake increasing with keys spent)
- Sound hooks: `key_deploy_tick`, `chest_unlock_success`, `chest_unlock_fail`, `chest_rumble`
- MOK interjections: "That's a heavy lock...", "Try more keys!", "JACKPOT!"
- Tutorial tooltip on first chest encounter: "Hold to deploy keys. Release when you think it's enough."
- Persistent `_keysReceived` across attempts (partial progress saved — next attempt starts from where you left off)
- Visual "fullness" indicator: chest glows brighter as `_keysReceived / _unlockCost` approaches 1.0 (but never reveals exact number)

---

## Dependency Graph

```
Phase 1 (Key Deploy)         Phase 2 (Chest Spawn)        Phase 3 (Interaction)

key-deploy-system.js ──────→ floor-generator.js ─────────→ Wire long-press to
  · ticker                     · chest spawn rules           KeyDeploySystem
  · key flight anim            · breakable type flag       · success/fail eval
  · debrief integration      breakable-system.js            · chest break anim
                               · skip kick for chests       · loot trigger
gamestate.js                 Renderers
  · consumeKeyAmmo()           · pulse + gold glow
  · addKeyAmmo()

Phase 4 (Loot)               Phase 5 (Items)              Phase 6+ (Polish)

breakable-system.js          key-deploy-system.js          Animations
  · _spawnChestLoot()          · tick rate from items        Sound hooks
  · guaranteed item            · cost modifier               MOK interjections
  · key refund               floor-generator.js              Tutorial hints
items.json                     · cost modifier
  · ITM-104/105/106          tooltip-system.js
                               · cost reveal (ITM-104)
```

**Critical path:** Phase 1 → Phase 3 (deploy system must exist before chest interaction)
**Parallel:** Phase 2 can start alongside Phase 1 (chest spawn is independent of deploy system)
**Parallel:** Phase 4 can start after Phase 2 (loot tables don't require interaction wiring)

---

## Cross-References

- [THEFT_MECHANICS.md](./THEFT_MECHANICS.md) — §1 (input fork), §6 (key_ammo spending) — same long-hold pattern
- [ENEMY_NCH_INTERACTION_ROADMAP.md](./ENEMY_NCH_INTERACTION_ROADMAP.md) — Phase 1–2 (enemy capsule uses same key deploy)
- [COLLECTIBLES_CANON.md](./COLLECTIBLES_CANON.md) — §Map Rendering (pulse vs bob doctrine), §Overhead Priority
- [OVERHEAD-ANIMATION-UNIFIED-ROADMAP.md](./OVERHEAD-ANIMATION-UNIFIED-ROADMAP.md) — Breakable chest = interactable (pulse)
- [ITEM_DROP_PIPELINE_ROADMAP.md](./ITEM_DROP_PIPELINE_ROADMAP.md) — Phase 2 `_spawnItemDrop` used for guaranteed chest item
- [RESOURCE_ECONOMY_IMPLEMENTATION.md](./RESOURCE_ECONOMY_IMPLEMENTATION.md) — §6 Key Ammo Economy, mitigation items
- [ENEMY_CQC_SYSTEM.md](./ENEMY_CQC_SYSTEM.md) — Shared KeyDeploySystem, short/long press fork on adjacent targets
- [INPUT_PLAYER_CONTROLLER.md](./INPUT_PLAYER_CONTROLLER.md) — §8 (input fork), QuadStick mappings

---

## New Items Summary

| Item | Type | Effect | Phase |
|---|---|---|---|
| ITM-104 Locksmith's Lens | Passive equipment | Reveals exact chest unlock cost when adjacent | Phase 5 |
| ITM-105 Masterwork Pick | Active equipment | Reduces key deploy tick interval (350ms → 250ms) | Phase 5 |
| ITM-106 Greed Charm | Passive equipment | +50% chest loot rarity, +30% chest cost | Phase 5 |

---

## Testing Checklist

### After Phase 1:
- [ ] `KeyDeploySystem.beginDeploy()` starts ticker on adjacent tile
- [ ] Keys consumed from `GAMESTATE.keys.ammo` each tick
- [ ] Debrief feed updates on each key consumed
- [ ] Deploy stops when keys exhausted
- [ ] Deploy stops on `stopDeploy()` call
- [ ] Key flight animation visible (🗝 arc from player to target)

### After Phase 2:
- [ ] Chests spawn on floors per distribution rules
- [ ] Chests render as 🧰 with gold pulse animation
- [ ] Chests cannot be kicked or damaged
- [ ] Chests appear as `_wt: 'interactive'` in WorldItems
- [ ] Chest density: ~1 per 3 floors in T1, increasing with tier

### After Phase 3:
- [ ] Long-press on adjacent chest begins key deployment
- [ ] Keys animate flying from player to chest
- [ ] Chest pops immediately when threshold met (SUCCESS)
- [ ] Debrief frame flashes green on success, red on failure
- [ ] Failed attempt: keys lost, chest remains, can retry
- [ ] No key_ammo: tooltip "🔒 NO KEYS" prevents deploy

### After Phase 4:
- [ ] Chest drops standard loot + guaranteed item
- [ ] Guaranteed item rarity matches tier distribution
- [ ] Key refund (10-30%) granted on success
- [ ] Refund shows as overhead "+N🗝" animation

### After Phase 5:
- [ ] ITM-104: shows exact cost tooltip when adjacent
- [ ] ITM-105: tick interval visibly faster
- [ ] ITM-106: better loot but higher costs
- [ ] ITM-098 Skeleton Keyring: reduces chest cost by 1

---

*Document Version: 1.0*
*Created: 2026-03-06*
*Status: Roadmap — no implementation yet*
*Philosophy: Unify key_ammo deployment across chests and enemies. Same input, same animations, same resource pressure. The player learns one gesture and it works everywhere keys are spent.*
