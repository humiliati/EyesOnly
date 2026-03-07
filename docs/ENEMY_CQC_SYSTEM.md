# Enemy CQC (Close-Quarters Combat) System

### v1.0 — March 2026

---

## Vision

When a player is adjacent to an enemy, tapping that enemy should always do something meaningful. Currently, adjacent enemy taps are consumed by a steal attempt that fails silently when no theft tool is equipped — the player sees nothing happen. This document defines the full adjacent-enemy interaction pipeline: default kick (always works), item-buffed melee strikes (spend resources for damage multipliers), theft mechanics (key_ammo long-hold), and the context dispatch that decides between them.

The guiding principle: **adjacent enemy tap = kick by default, item-enhanced if equipped, theft if long-held.** The same input gesture has different weight depending on press duration and equipped items — identical to how breakable chests work with key_ammo (see TREASURE_CHEST_SYSTEM.md).

---

## The Bug: Adjacent Enemy Tap Does Nothing

### Root Cause

```
gone-rogue-mobile.js:1880-1884 — _processGridInput():

  if (eDist <= 1 && GoneRogue.process) {
    GoneRogue.process('steal');     ← always calls steal
    _lastMovementTime = Date.now();
    return;                         ← CONSUMES THE TAP unconditionally
  }
```

The adjacent enemy tap **always** routes to `process('steal')` and returns. When `EnemyStealSystem.attempt()` finds no theft tool, it returns `{ ok: true, success: false }` — the `ok: true` masks the failure, and the response is discarded by `_processGridInput` (which doesn't use the return value). The player sees nothing.

### Why TapMoveSystem Doesn't Help

`TapMoveSystem.handleTapMove()` (line 59) only checks for breakables at the target tile — it never checks for enemies. Even if the steal path fell through to `handleTapMove`, enemies aren't in the breakable array, so the tap would just try to pathfind into the enemy's tile (blocked by collision).

### Fix Location

The fix requires changes in `_processGridInput()` to implement the short-press/long-press fork described below. The `return` on line 1884 must become conditional — only consuming the tap if the action succeeded or if a CQC melee strike is dispatched instead.

---

## Input Fork: Short Press vs Long Press (Adjacent Enemy)

This mirrors the THEFT_MECHANICS §1 input fork and the TREASURE_CHEST_SYSTEM long-hold pattern. One gesture, two outcomes.

```
Player taps adjacent enemy tile:

pointerdown / touchstart:
  → record _pressStartTime
  → record _pressTarget = { type: 'enemy', enemy, dx, dy }
  → show hold indicator ring (fills over LONG_PRESS_THRESHOLD)

pointerup / touchend:
  → elapsed = Date.now() - _pressStartTime

  IF elapsed < LONG_PRESS_THRESHOLD (400ms):
    → SHORT PRESS → CQC melee strike (kick or item-buffed attack)
    → Enter STR combat if enemy was UNAWARE/SLEEPING (surprise round)
    → Apply pre-combat damage multiplier from equipped CQC item

  ELSE IF elapsed >= LONG_PRESS_THRESHOLD:
    → LONG PRESS → open enemy card hand (NCH capsule minimized)
    → Key_ammo deployment for theft actions (PICKPOCKET, STEAL, SWAP)
    → Same pattern as TREASURE_CHEST_SYSTEM key deploy
```

### Controller Mappings

| Input | Touch | Keyboard | Xbox | QuadStick |
|---|---|---|---|---|
| CQC strike (short) | Tap adjacent enemy (<400ms) | E (toward enemy) | A (tap) | Light sip |
| Open card hand (long) | Hold adjacent enemy (≥400ms) | E (hold toward enemy) | A (hold) | Sustained sip |
| Cancel (during hold) | Drag away / tap self | Escape | B | Light puff |

---

## CQC Melee Strike: Short Press

### Default: Kick (No Item Required)

Every player can kick an adjacent enemy. This is the floor — always available, never silently consumed.

```
DEFAULT KICK (no CQC item equipped):
  · Damage: 0.5 base (pre-combat chip damage)
  · Effect: Enemy enters ENGAGED state, STR combat begins
  · Overhead: 🥾 in #aa8844, 400ms
  · Tooltip: "Kicked [enemy name]!"
  · Surprise bonus: If enemy was UNAWARE/SLEEPING → +1.0 damage (total 1.5)
  · Resource cost: NONE
```

### Item-Buffed Melee

Equipped CQC items multiply the kick into a meaningful pre-combat strike. These consume resources (fatigue, energy, or ammo) and modify the opening conditions of STR combat.

| Item | Damage | Resource Cost | Surprise Multiplier | Effect on STR Combat Entry |
|---|---|---|---|---|
| **(none — bare kick)** | 0.5 | None | 2x if unaware | Normal entry |
| **Brass Knuckles** (ITM-110) | 1.5 | 5 Energy | 2x if unaware | Enemy starts STUNNED (1 round) |
| **Combat Knife** (ITM-111) | 2.5 | 8 Fatigue | 3x if unaware | Enemy starts BLEEDING (2 rounds) |
| **Door Buster Shotgun** (ITM-112) | 4.0 | 1 Ammo | 1.5x if unaware | Enemy pushed back 1 tile, NOISE 6. All nearby enemies ALERTED |
| **Stun Baton** (ITM-113) | 1.0 | 3 Energy | 2x if unaware | Enemy starts STUNNED (2 rounds), no noise |
| **Poison Shiv** (ITM-114) | 1.0 | 5 Fatigue | 2x if unaware | Enemy starts POISONED (3 rounds, 0.5/round) |

### CQC Item Selection Logic

```javascript
function _getCQCItem(ctx) {
  // Check equipped active item first
  var active = GAMESTATE.getActiveItem();
  if (active && active.cqcDamage) return active;

  // Check passive inventory for CQC-tagged items
  var persistent = GAMESTATE.getPersistentItems();
  for (var i = 0; i < persistent.length; i++) {
    if (persistent[i] && persistent[i].meta && persistent[i].meta.cqcPassive) {
      return persistent[i];
    }
  }

  return null;  // default kick
}
```

### Resource Check

If the player has a CQC item but insufficient resources, the strike **downgrades to default kick** with a tooltip: "Not enough [energy/fatigue/ammo] for [item name] — basic kick instead."

```javascript
function _canAffordCQC(item, ctx) {
  if (!item || !item.cqcCost) return true;  // bare kick is free
  var cost = item.cqcCost;
  if (cost.energy && GAMESTATE.getEnergy() < cost.energy) return false;
  if (cost.fatigue && GAMESTATE.getFatigue() + cost.fatigue > GAMESTATE.getMaxFatigue()) return false;
  if (cost.ammo && GAMESTATE.getAmmo() < cost.ammo) return false;
  return true;
}
```

### Enemy Awareness States and Surprise

| Enemy State | CQC Outcome | Multiplier |
|---|---|---|
| UNAWARE / SLEEPING | **Surprise strike** — full CQC damage × surprise multiplier, then enter STR combat with player advantage | Item-specific (1.5x–3x) |
| SUSPICIOUS / INVESTIGATING | **Contested strike** — CQC damage at base rate, STR combat starts neutral | 1.0x |
| ENGAGED / ALERTED | **Combat strike** — CQC damage at base rate, STR combat starts with enemy ready | 1.0x, enemy gets first action |

### STR Combat Entry with CQC Pre-Damage

```
CQC melee → STR combat transition:

T+0ms:   CQC strike lands — damage applied, overhead animation
T+100ms: Enemy awareness transitions to ENGAGED
T+200ms: Screen zoom / transition effect (existing STR combat entry)
T+300ms: STR combat window opens
T+0:     Enemy HP = maxHP - cqcDamage (pre-damaged)
         Enemy status = [STUNNED/BLEEDING/POISONED] if CQC item applied
         Player gets first action if surprise, else coin flip
```

---

## CQC Long Press: Theft / Key Deploy

Long press on an adjacent enemy opens the same key_ammo deployment system used for treasure chests (TREASURE_CHEST_SYSTEM.md). The target is the enemy's NCH capsule instead of a chest.

### Key Deploy Against Enemies

Per THEFT_MECHANICS §6, theft actions cost key_ammo:

| Action | Key Cost | Requires |
|---|---|---|
| PICKPOCKET (face-down card) | 1 key_ammo | Theft tool with stealTags |
| STEAL (revealed card) | 1 key_ammo | Theft tool with stealTags |
| SWAP (exchange cards) | 2 key_ammo | Theft tool with stealTags |
| PLANT (insert card) | 0 keys (costs the card) | plantTags match |
| REVEAL | 0 keys (costs interaction charge) | revealTags match |

### Long-Hold Sequence

```
Long press (≥400ms) on adjacent enemy:

1. Game tick pauses (exploration freeze)
2. Enemy NCH capsule opens as minimized view (per THEFT_MECHANICS §4)
3. Player selects a node (card slot) to interact with
4. If action requires key_ammo:
   → KeyDeploySystem.beginDeploy(enemy.x, enemy.y, 'enemy', ctx)
   → Keys animate from player → enemy (same visual as chest deploy)
   → Debrief feed key_ammo counter updates
5. Action resolves (steal/plant/reveal/swap)
6. Capsule closes, game tick resumes
7. Enemy awareness check: 20% SUSPICIOUS (per ENI Roadmap §2.5)
```

### Shared Key Deploy System

Both chests and enemy theft use `KeyDeploySystem` (defined in TREASURE_CHEST_SYSTEM.md). The only difference is the success condition:

| Target | Key Deploy Pattern | Success Condition |
|---|---|---|
| 🧰 Chest | Continuous hold → ticker | Hidden threshold met |
| 🃏 Enemy PICKPOCKET | Single burst (1 key) | Tag match + card available |
| 🃏 Enemy SWAP | Single burst (2 keys) | Tag match + card in hand |

For enemy theft, key deployment is a single deduction (not a continuous ticker), but the visual pattern is the same: keys fly from player to target.

---

## Data Model: CQC Item Schema

New fields in `items.json` for CQC-capable items:

```json
{
  "id": "ITM-111",
  "name": "Combat Knife",
  "emoji": "🔪",
  "type": "equipment",
  "equipSlot": "active",
  "rarity": "uncommon",
  "cqcDamage": 2.5,
  "cqcCost": { "fatigue": 8 },
  "cqcSurpriseMultiplier": 3.0,
  "cqcStatusEffect": { "type": "BLEEDING", "rounds": 2, "damagePerRound": 0.3 },
  "cqcNoise": 2,
  "cqcOverhead": { "emoji": "🔪", "color": "#FF4444", "duration": 600 },
  "description": "Silent strike. Devastating from stealth."
}
```

### Field Reference

| Field | Type | Description |
|---|---|---|
| `cqcDamage` | number | Base damage on CQC strike (replaces 0.5 kick) |
| `cqcCost` | object | Resource cost `{ energy?, fatigue?, ammo? }` |
| `cqcSurpriseMultiplier` | number | Damage multiplier when enemy is UNAWARE/SLEEPING |
| `cqcStatusEffect` | object | Status applied to enemy on hit `{ type, rounds, damagePerRound? }` |
| `cqcNoise` | number | Noise generated (0 = silent, 6+ = alerts nearby enemies) |
| `cqcOverhead` | object | Override for overhead animation `{ emoji, color, duration }` |
| `cqcPassive` | boolean | If true, CQC buff applies from passive inventory (not just active slot) |

---

## Roadmap

### Phase 0 — Fix the Adjacent Enemy Tap Bug (Immediate)

**Goal:** Adjacent enemy tap does something visible. Default to kick. No new items, no long press — just fix the silent failure.

**Changes:**

In `gone-rogue-mobile.js:1880-1884`, replace the unconditional steal+return with a conditional dispatch:

```javascript
// BEFORE (broken):
if (eDist <= 1 && GoneRogue.process) {
  GoneRogue.process('steal');
  _lastMovementTime = Date.now();
  return;
}

// AFTER (Phase 0 fix):
if (eDist <= 1) {
  // Check if player has a theft tool equipped
  var hasTheftTool = false;
  if (typeof GAMESTATE !== 'undefined' && GAMESTATE.getActiveItem) {
    var activeItem = GAMESTATE.getActiveItem();
    hasTheftTool = activeItem && Array.isArray(activeItem.stealTags) && activeItem.stealTags.length > 0;
  }

  if (hasTheftTool && GoneRogue.process) {
    // Theft tool equipped → attempt steal (existing path)
    GoneRogue.process('steal');
    _lastMovementTime = Date.now();
    return;
  }

  // No theft tool → CQC kick (default melee)
  if (typeof GoneRogue !== 'undefined' && GoneRogue.process) {
    // Set interact direction for weapon arrow
    if (typeof PlayerWeaponArrow !== 'undefined') {
      PlayerWeaponArrow.setInteractDirection(edx, edy);
    }
    GoneRogue.process('cqc_kick', { targetEnemy: en, dx: edx, dy: edy });
    _lastMovementTime = Date.now();
    return;
  }
}
```

Add `cqc_kick` handler in `command-process-system.js`:

```javascript
if (cmd === 'cqc_kick') {
  return ctx.cqcKickEnemy(data.targetEnemy, data.dx, data.dy);
}
```

Add `cqcKickEnemy` in `player-action-system.js`:

```javascript
function cqcKickEnemy(enemy, dx, dy, ctx) {
  var damage = 0.5;  // base kick
  enemy.hp -= damage;

  // Overhead animation
  if (typeof OverheadAnimator !== 'undefined') {
    OverheadAnimator.showGenericExpression(enemy.x, enemy.y, '🥾', 400, '#aa8844');
  }

  // Tooltip
  if (typeof TooltipSystem !== 'undefined') {
    TooltipSystem.show('🥾 Kicked ' + (enemy.name || 'enemy') + '!', 1500);
  }

  // Enter STR combat
  if (typeof STRCombatWindow !== 'undefined') {
    STRCombatWindow.initiate(enemy, ctx);
  }

  return { lines: ['🥾 Kicked ' + enemy.name], prompt: ctx.getPrompt() };
}
```

**Files:**
- Modified: `public/js/gone-rogue-mobile.js` (~10 lines changed)
- Modified: `public/js/command-process-system.js` (~3 lines)
- Modified: `public/js/player-action-system.js` (~20 lines)

### Phase 1 — Item-Buffed CQC Melee

**Goal:** Equipped CQC items (knuckles, knives, shotgun) modify the kick into a real melee attack with damage, resource cost, status effects, and noise.

**Changes:**

Extend `cqcKickEnemy` to check for equipped CQC items:

```javascript
function cqcKickEnemy(enemy, dx, dy, ctx) {
  var cqcItem = _getCQCItem(ctx);
  var canAfford = _canAffordCQC(cqcItem, ctx);

  if (cqcItem && canAfford) {
    // Item-buffed strike
    var damage = cqcItem.cqcDamage || 0.5;
    var surprise = _isEnemySurprised(enemy) ? (cqcItem.cqcSurpriseMultiplier || 1.0) : 1.0;
    damage *= surprise;
    _applyCQCCost(cqcItem, ctx);
    _applyCQCStatus(cqcItem, enemy);
    _raiseNoise(cqcItem.cqcNoise || 0, enemy.x, enemy.y, ctx);
    // ... animate, enter combat with pre-damage ...
  } else {
    // Default kick (always available)
    var damage = 0.5;
    // ... basic kick ...
  }
}
```

**Files:**
- Modified: `public/js/player-action-system.js` (~40 lines)
- Modified: `public/data/gone-rogue/items.json` — add ITM-110 through ITM-114
- Modified: `public/js/str-combat-window.js` — accept `preDamage` and `statusEffects` on initiate

**Estimated:** ~80 lines across files

### Phase 2 — Long-Press Enemy Card Hand

**Goal:** Long press (≥400ms) on adjacent enemy opens the NCH capsule minimized view for theft interactions. This is the THEFT_MECHANICS §4 implementation.

**Depends on:** ENEMY_NCH_INTERACTION_ROADMAP Phase 1 (enemy capsule renderer)

**Changes:**

Add long-press detection to `_processGridInput` for enemy targets:

```javascript
// In pointerdown handler:
if (adjacentEnemy) {
  _pressTarget = { type: 'enemy', enemy: en, dx: edx, dy: edy };
  _pressStartTime = Date.now();
  _startHoldRing(en.x, en.y);
}

// In pointerup handler:
if (_pressTarget && _pressTarget.type === 'enemy') {
  var elapsed = Date.now() - _pressStartTime;
  if (elapsed < LONG_PRESS_THRESHOLD) {
    _dispatchCQCKick(_pressTarget);  // short press → kick
  } else {
    _openEnemyCardHand(_pressTarget);  // long press → theft UI
  }
}
```

**Files:**
- Modified: `public/js/gone-rogue-mobile.js` — long-press detection
- New or modified: enemy capsule UI (per ENI Roadmap Phase 1)
- Modified: `public/js/key-deploy-system.js` — enemy target support

**Estimated:** ~60 lines in input handler, depends on ENI Phase 1 for capsule UI

### Phase 3 — Unified Key Deploy (Chest + Enemy)

**Goal:** Wire KeyDeploySystem (from TREASURE_CHEST_SYSTEM) to enemy theft actions. Keys animate from player to enemy during PICKPOCKET/STEAL/SWAP actions in the card hand UI.

**Depends on:** TREASURE_CHEST_SYSTEM Phase 1, Phase 2 of this doc

**Files:**
- Modified: `public/js/key-deploy-system.js` — enemy target type
- Modified: `public/js/enemy-steal-system.js` — consume key via KeyDeploySystem
- Modified: `public/js/enemy-card-interaction-handler.js` — key cost animation

### Phase 4+ — Polish

- CQC execution animations (slash visual for knife, muzzle flash for shotgun, fist impact for knuckles)
- Enemy stagger animation on CQC hit (stumble backward + blink)
- MOK interjections: "SURPRISE!", "That got their attention...", "Quiet, clean, efficient."
- Sound hooks: `cqc_kick`, `cqc_knife`, `cqc_shotgun`, `cqc_stun`
- CQC kill threshold: if CQC damage exceeds enemy HP, skip STR combat entirely (silent takedown)
- Tutorial tooltip on first adjacent enemy encounter: "Tap to kick. Hold to interact with their cards."

---

## Integration Matrix

This document intersects with several other systems. Here's where CQC fits:

| System | Document | CQC Touchpoint |
|---|---|---|
| **Input pipeline** | INPUT_PLAYER_CONTROLLER.md §4, §8 | Short press/long press fork in `_processGridInput` |
| **Theft mechanics** | THEFT_MECHANICS.md §1, §3, §6 | Long press opens card hand, key_ammo spending |
| **Enemy NCH interaction** | ENEMY_NCH_INTERACTION_ROADMAP.md Phase 1-2 | Card hand UI, capsule renderer |
| **Treasure chests** | TREASURE_CHEST_SYSTEM.md Phase 1 | Shared KeyDeploySystem for key animation |
| **STR combat** | str-combat-window.js | CQC pre-damage applied before combat HP bars render |
| **Enemy AI** | ENEMY_AI.md §4 | Surprise state determines CQC multiplier |
| **Breakable kicks** | breakable-system.js | CQC kick for enemies mirrors existing breakable kick |
| **Items** | items.json | New CQC item schema fields (cqcDamage, cqcCost, etc.) |

---

## Dependency Graph

```
Phase 0 (Bug Fix)            Phase 1 (Item Melee)         Phase 2 (Long Press)

Fix _processGridInput ──────→ CQC item check              Long-press detection
  · Remove unconditional        · cqcDamage/cqcCost          · Hold ring indicator
    steal+return                · Resource validation         · Timer threshold
  · Add cqc_kick fallback       · Surprise multiplier         · Opens card hand UI
                                · Status effects                   │
command-process-system.js      items.json                         ▼
  · Route 'cqc_kick'            · ITM-110 to ITM-114      ENI Phase 1 (dependency)
                                                            · Enemy capsule renderer
player-action-system.js       str-combat-window.js               │
  · cqcKickEnemy()              · Pre-damage entry               ▼
  · Basic kick logic            · Status effects           Phase 3 (Key Deploy)
                                                            · KeyDeploySystem wired
                                                            · Key flight animation
                                                            · Shared with chests

Phase 4+ (Polish)
  · CQC kill threshold (skip STR combat)
  · Execution animations
  · Sound hooks, MOK interjections
```

**Critical path:** Phase 0 → Phase 1 (fix must land before item buffs make sense)
**Parallel:** Phase 2 can start alongside Phase 1 (long-press detection is independent of CQC items)
**External dependency:** Phase 2 requires ENI Roadmap Phase 1 (enemy capsule renderer)

---

## New Items Summary

| Item | ID | Damage | Cost | Surprise | Status | Noise |
|---|---|---|---|---|---|---|
| Brass Knuckles | ITM-110 | 1.5 | 5 Energy | 2x | STUNNED 1 round | 1 |
| Combat Knife | ITM-111 | 2.5 | 8 Fatigue | 3x | BLEEDING 2 rounds | 2 |
| Door Buster Shotgun | ITM-112 | 4.0 | 1 Ammo | 1.5x | Push + NOISE | 6 |
| Stun Baton | ITM-113 | 1.0 | 3 Energy | 2x | STUNNED 2 rounds | 0 |
| Poison Shiv | ITM-114 | 1.0 | 5 Fatigue | 2x | POISONED 3 rounds | 0 |

Design intent: Knife and Shiv are for stealth builds (high surprise, low noise). Shotgun is for aggressive builds (high damage, high noise, alerts everyone). Knuckles and Baton are middle-ground utility.

---

## Testing Checklist

### After Phase 0:
- [ ] Tap adjacent enemy without theft tool → kick lands, overhead 🥾, enter STR combat
- [ ] Tap adjacent enemy with theft tool → steal attempt (existing behavior preserved)
- [ ] Tap distant enemy → projectile fires (existing behavior preserved)
- [ ] No silent tap consumption — every tap produces visible feedback
- [ ] Kick applies 0.5 base damage to enemy HP before STR combat

### After Phase 1:
- [ ] Equip Combat Knife → tap adjacent UNAWARE enemy → 2.5 × 3.0 = 7.5 damage, BLEEDING
- [ ] Equip Door Buster → tap adjacent enemy → 4.0 damage, noise 6, nearby enemies ALERTED
- [ ] CQC item with insufficient resources → falls back to basic kick with tooltip
- [ ] Pre-damage reflected in STR combat HP bar on entry
- [ ] Status effects active on STR combat round 1
- [ ] Resource cost deducted from debrief feed

### After Phase 2:
- [ ] Hold (≥400ms) adjacent enemy → card hand opens
- [ ] Release (<400ms) → CQC kick (not card hand)
- [ ] Card hand shows interactive nodes per THEFT_MECHANICS §4
- [ ] Game tick paused during card hand
- [ ] Cancel → card hand closes, game resumes

### After Phase 3:
- [ ] PICKPOCKET in card hand → 1 key_ammo consumed, key flies from player → enemy
- [ ] SWAP → 2 keys consumed
- [ ] Debrief feed updates on key consumption
- [ ] Same visual as treasure chest key deployment

---

## Cross-References

- [INPUT_PLAYER_CONTROLLER.md](./INPUT_PLAYER_CONTROLLER.md) — §4 (kick), §8 (thief input mapping)
- [THEFT_MECHANICS.md](./THEFT_MECHANICS.md) — §1 (input fork), §3 (pre-combat steal), §6 (key spending)
- [ENEMY_NCH_INTERACTION_ROADMAP.md](./ENEMY_NCH_INTERACTION_ROADMAP.md) — Phase 1-2 (capsule UI, interchange)
- [TREASURE_CHEST_SYSTEM.md](./TREASURE_CHEST_SYSTEM.md) — Shared KeyDeploySystem
- [ENEMY_AI.md](./ENEMY_AI.md) — §4 (awareness states, surprise)
- [COLLECTIBLES_CANON.md](./COLLECTIBLES_CANON.md) — Overhead animation priority stack
- [OVERHEAD-ANIMATION-UNIFIED-ROADMAP.md](./OVERHEAD-ANIMATION-UNIFIED-ROADMAP.md) — v1.5, OverheadAnimator doctrine

---

*Document Version: 1.0*
*Created: 2026-03-06*
*Status: Roadmap — Phase 0 is the immediate fix, Phases 1-3 are sprint-aligned*
*Philosophy: Adjacent enemy tap should never silently fail. Kick is the floor. Items raise the ceiling. Long-hold opens the card surface. One gesture, three depths.*
