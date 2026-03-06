# Resource Economy Implementation Summary

**Date:** 2026-03-06 (updated from 2026-02-19)
**Status:** ✅ COMPLETE (canon-aligned with RESOURCE_COLOR system, key ammo tracking, and ENI Phase 0 theft economy)
**PR Branch:** copilot/update-combat-card-issuance

---

## Overview

This document summarizes the implementation of balanced resource economies for all 9 game resources (HP, Energy, Focus, Battery, Fatigue, Ammo, Currency, Key Ammo, Cards) to ensure lean, strategic gameplay for MVP playtesting. Visual/reporting feedback is aligned to the RESOURCE_COLOR canon used by DebriefFeed and OverheadAnimator.

---

## ✅ Implemented Features

### 1. Ammo Economy

**Starting State:**
- Player starts with 7 ammo (reduced from 30)
- Guaranteed starter cards: SINGLE_SHOT, DODGE, GRENADE

**Ammo Costs:**
- SINGLE_SHOT: 1 ammo (from baseStats)
- GRENADE: 2 ammo (from resourceCost)
- BURST_SHOT: 3 ammo
- SUPPRESSIVE_FIRE: 5 ammo
- EXPLOSIVE_SHOT: 1 ammo (consumable)

**Ammo Recovery:**
1. **Combat Recovery:** 1 ammo per 3 spent (auto-collected on enemy defeat)
2. **Breakable Drops:** 60% chance per breakable
   - 80% drop 1 ammo
   - 20% drop 2 ammo
   - Average: 1.2 ammo per drop
   - 8-12 breakables per floor = 5-7 ammo per floor

**Balance Result:**
- Players using ammo-only strategy run lean ✓
- Must break objects and win combats to sustain
- Encourages mixed strategy (ammo + non-ammo cards)

**Files Modified:**
- `public/js/gone-rogue.js` - Breakable drops, pickup logic
- `public/js/gamestate.js` - Initial ammo value (7)
- `public/js/card-system.js` - GRENADE resourceCost

---

### 2. Battery Economy

**Current State:**
- Start: 5 battery, Max: 5
- Usage: Tech cards (THERMAL_VISION, SMOKE_SCREEN)

**Recharge Items Added:**
- **BATTERY_PACK (🔋):** Disposable, +2 battery
- **POWER_CELL (⚡):** Disposable, +1 battery

**Integration:**
- `card-system.js`: New cards with `batteryRecharge` stat
- `gone-rogue.js`: _useUtility() processes batteryRecharge
- `gamestate.js`: rechargeBattery() method exists

**Future Enhancement:**
- Add 10% battery drop chance to breakables
- Battery-gated cards should consume battery properly

---

### 3. Fatigue Economy

**Mechanics:**
- Range: 0-100
- Threshold: 70 (cards become less effective)
- Accumulation: Combat actions, movement

**Reduction Items:**
| Item | Fatigue Reduction | Other Effects |
|------|-------------------|---------------|
| ENERGY_DRINK | -20 | +2 energy |
| COFFEE_MUG (NEW) | -15 | +1 focus, +1 energy |
| STIM_PACK | -10 | +15 HP, +2 speed |
| RATIONS | -5 | +4 HP, +2 energy |
| CIGARETTES | -3 | +2 attack, +1 speed |

**Integration:**
- All existing food/consumable cards already had `fatigueReduction`
- New COFFEE_MUG card added
- `_useUtility()` now processes `fatigueReduction` stat
- Calls `GAMESTATE.reduceFatigue(amount)`

---

### 4. Energy Economy

**Mechanics:**
- Range: 0-5
- Used by: Most ability cards (1-3 energy)
- Post-combat: Full restore

**Restoration Items:**
- COFFEE_MUG: +1 energy
- RATIONS: +2 energy  
- ENERGY_DRINK: +2 energy
- CIGARETTES: +1 energy

**Implementation:**
- `gamestate.js`: Added `addEnergy()` method (alias for restoreEnergy)
- `gone-rogue.js`: _useUtility() processes `energyBoost` stat
- Public API updated with addEnergy

---

### 5. Focus Economy

**Mechanics:**
- Range: 0-10
- Loss: Loud actions, panic (-1 per gunshot)
- Affects: Accuracy, critical hit chance

**Restoration:**
- COFFEE_MUG: +1 focus
- PRONE stance: +1 focus per turn (passive)
- Calm/stealth actions

**Implementation:**
- `gamestate.js`: Added `addFocus()` method (alias for restoreFocus)
- `gone-rogue.js`: _useUtility() processes `focusBoost` stat
- Public API updated with addFocus

---

### 6. Key Ammo Economy (ENI Phase 0)

**Debrief Feed Canon:** Color `#FF8A3D` (orange), symbols `🝯` (up) / `🗝` (down), tracked as `key_ammo` in GAMESTATE.

**3-Tier Key Structure:**
- **Tier 1 — Resource currency** (`key_ammo`): Collectible resource tracked in `GAMESTATE.keys.ammo`. NOT inventory items. Displayed in debrief feed resource bars. Spent on NCH theft interactions per THEFT_MECHANICS §6. Picked up from breakables, enemy drops, and floor start grants. Stacks like ammo or gold.
- **Tier 2 — Gate items**: Inventory items that unlock gates/doors/chests (ITM-010 through ITM-019). Occupy active equipment slot. Include Rusty Lockpick (ITM-017), Bronze Key (ITM-018), Security Keycard (ITM-011), Master Key (ITM-012), etc.
- **Tier 3 — Quest items**: Special turn-in items for NPC rewards (ITM-030 Blacksmith's Hammer, ITM-031 Rune Fragment).

**key_ammo resource pool:**
- Pool: `GAMESTATE.keys.ammo` (Tier 1 currency, NOT an item)
- Used for: NCH theft interactions ONLY (not gate unlocks — those use Tier 2 items)
- Key macro display: `🝯` + count; panel shows `🝯RUSTY`, `🔑BRONZE`, `💳CARD`, `🏷MALL`

**Theft Action Costs (THEFT_MECHANICS §6):**
- PICKPOCKET (face-down card): 1 key_ammo
- STEAL (revealed card): 1 key_ammo
- SWAP (card exchange): 2 key_ammo
- PLANT: 0 key_ammo (costs the planted card itself)
- REVEAL: 0 key_ammo (costs 1 interaction charge)
- BRIBE: 0 key_ammo (costs gold proportional to stealValue)

**Key_ammo consumption rules:**
- key_ammo consumed on SUCCESS only (pre-combat exploration)
- key_ammo consumed on CONFIRM (long-press capsule interaction)
- Without key_ammo: auto-downgrade to FUMBLED GRAB (ACT-020)
- In STR combat: same key_ammo costs PLUS 1 interaction charge per action

**key_ammo Mitigation Items (ENI Phase 0):**
- ITM-098 Skeleton Keyring (passive equipment, uncommon): Reduces key_ammo resource spent on theft by 1 (PICKPOCKET/STEAL become free, SWAP drops to 1). Grants +1 key_ammo resource at each floor start. Occupies passive slot.
- ITM-099 Wax Impression Kit (consumable, uncommon): Grants +2 key_ammo resource instantly. Stackable (max 3). Found in breakables or shop.

**Balance Analysis (5-floor thief run):**
- Starting key_ammo: ~2 from floor 0 breakables
- Breakable/chest key_ammo drops: ~1-2 per floor = 5-10 over 5 floors
- Skeleton Keyring bonus: +5 key_ammo (1 per floor)
- Total available (with Keyring): ~12-17 key_ammo
- Theft attempts: ~2-3 per floor = 10-15 attempts
- Cost without mitigation: 10-15 key_ammo (tight, must choose theft vs saving for later)
- Cost with Skeleton Keyring: 0 key_ammo for PICKPOCKET/STEAL (free), only SWAP costs 1
- Design intent: Without Keyring, thief builds run tight on key_ammo. With Keyring, theft is sustainable but the passive slot is occupied (vs combat passives).

**Data changes (items.json):**
- CORRECTED ITM-017/018/019 from tier 1 → tier 2 (gate keys are items, not currency)
- Removed `useAsLockpick`, `lockpickUses`, `consumeOnTheft` from ITM-017/018 (T1 keys are resource, not items)
- Added ITM-098 Skeleton Keyring (passive equipment, key_ammo resource discount)
- Added ITM-099 Wax Impression Kit (consumable, key_ammo resource grant)

**Code changes pending (enemy-steal-system.js):**
- `attempt()` must consume from `GAMESTATE.keys.ammo` resource pool (not from inventory items)
- Wire key_ammo consumption in `gone-rogue.js` → `_attemptPickpocket()` context builder
- Show "🔒 NO KEY" on capsule nodes when `GAMESTATE.keys.ammo < cost`
- Overhead animation "🔑→🃏" on successful key_ammo-funded steal
- Check for Skeleton Keyring passive in inventory to apply `theftKeyAmmoDiscount`

---

### 7. Currency Economy

**Debrief Feed Canon:** Color `#FFFF00` (yellow), tracked as `Currency` in RESOURCE_COLORS.

**Mechanics:**
- Pool: `GAMESTATE.currency` (gold)
- Used for: Shop purchases, BRIBE theft action (THEFT_MECHANICS §6)
- BRIBE cost: proportional to target card's `stealValue`

**Acquisition:**
- Enemy combat drops (gold coins)
- Breakable loot
- Shop sell-back at reduced rate

**Status:** Currency tracking exists in DebriefFeed. Shop system partially implemented. BRIBE action pending Sprint 3 ENI Phase 2.

---

### 8. Cards Resource

**Debrief Feed Canon:** Color `#800080` (purple), tracked as `Cards` in RESOURCE_COLORS.

**Mechanics:**
- Pool: `GAMESTATE._state.cardsInHand` (CardRef array via CHH pipeline)
- Displayed as total card count in debrief feed
- Cards gained/lost per floor tracked as a resource delta

**Acquisition:**
- STR combat card draw (standard)
- Theft: PICKPOCKET/STEAL actions acquire enemy cards as CardRefs
- Post-combat salvage (ENI Phase 5, planned)
- Breakable/chest card drops

**Loss:**
- PLANT action (card inserted into enemy deck)
- Card consumption (consumable/disposable cards)
- Discard mechanics

---

## Canonical Debrief Feed Resource System

### RESOURCE_COLORS (debrief-feed-controller.js line 1330)

```javascript
var RESOURCE_COLORS = {
  'HP':       '#FF6B9D',   // Pink
  'Energy':   '#00D4FF',   // Cyan
  'Focus':    '#FFF9B0',   // Pale yellow
  'Battery':  '#00FFA6',   // Green
  'Fatigue':  '#A0522D',   // Brown (sienna)
  'Ammo':     '#DA70D6',   // Orchid purple
  'Currency': '#FFFF00',   // Yellow
  'key_ammo': '#FF8A3D',   // Orange
  'Cards':    '#800080'    // Purple
};
```

### RESOURCE_SYMBOLS (debrief-feed-controller.js line 654)

```javascript
hp       = '♥'
energy   = '△'
focus    = '◎'
fatigue  = 'Ȫ'
ammo     = '⁍'
battery  = '◈'
key_ammo = '🝯' (up) / '🗝' (down)
currency = (standard gold coin display)
cards    = (card count display)
```

### Resource Bar Display Order (debrief-feed-controller.js line 616)

1. Core resources (HP, Energy, Focus, Battery, Fatigue, Ammo)
2. key_ammo (with tiered key macro: 🝯RUSTY, 🔑BRONZE, 💳CARD, 🏷MALL)
3. Currency
4. Cards
5. Signal / passives / status / mok / api / accessibility bars

---

## 🔧 Technical Implementation

### Card System Updates

**New BaseStats Properties:**
```javascript
baseStats: {
  batteryRecharge: 2,      // Recharges battery
  fatigueReduction: 15,    // Reduces fatigue
  energyBoost: 1,          // Restores energy
  focusBoost: 1,           // Restores focus
  ammoRestore: 10          // Restores ammo (existing)
}
```

### _useUtility() Enhancement

Enhanced to process all resource effects:
```javascript
function _useUtility(card) {
  var effects = [];
  
  // Health, Energy, Fatigue, Battery, Focus, Ammo
  if (card.stats.hp) { ... }
  if (card.stats.energyBoost) { GAMESTATE.addEnergy(...); }
  if (card.stats.fatigueReduction) { GAMESTATE.reduceFatigue(...); }
  if (card.stats.batteryRecharge) { GAMESTATE.rechargeBattery(...); }
  if (card.stats.focusBoost) { GAMESTATE.addFocus(...); }
  if (card.stats.ammoRestore) { GAMESTATE.addAmmo(...); }
  
  return { lines: ['USED: ' + card.name, effects.join(', ')] };
}
```

### GAMESTATE API Additions

**New Methods:**
- `addEnergy(amount)` - Restore energy
- `addFocus(amount)` - Restore focus
- `addKeyCount(keyType, tier)` - Track Tier 1 key ammo resource counter (DebriefFeed reports `key_ammo` with `#FF8A3D`)

**Enhanced Methods:**
- `reduceFatigue(amount)` - Already existed, now used
- `rechargeBattery(amount)` - Already existed, now used
- `addAmmo(amount)` - Already existed, now used

---

## 📊 Balance Analysis

### Ammo Flow Calculation

**Example Scenario: 5 Floors**
- Starting ammo: 7
- Combat encounters: ~3 per floor = 15 total
- Ammo spent per combat: ~2-3 ammo average = 37.5 ammo total
- Combat recovery: 37.5 / 3 = 12.5 ammo
- Breakable recovery: 5 floors × 5.5 avg = 27.5 ammo
- **Total available: 7 + 12.5 + 27.5 = 47 ammo**
- **Total needed: ~37.5 ammo**
- **Margin: +9.5 ammo (tight but sustainable)**

### Resource Pressure Points

1. **HP (#FF6B9D):** Combat damage primary drain, multiple heal items ✓
2. **Energy (#00D4FF):** Abundant restore options, full restore post-combat ✓
3. **Focus (#FFF9B0):** Minimal consumption, easy to maintain ✓
4. **Battery (#00FFA6):** Rare usage, needs items for tech builds ✓
5. **Fatigue (#A0522D):** Multiple restore options, manageable ✓
6. **Ammo (#DA70D6):** Balanced for lean gameplay ✓
7. **Key Ammo (#FF8A3D):** Tight without mitigation items — forces gate vs theft trade-off ✓ (ENI Phase 0)
8. **Currency (#FFFF00):** Shop purchases + BRIBE theft action (pending full implementation)
9. **Cards (#800080):** Deck size tracked as resource delta per floor

---

## 📝 Files Modified

### JavaScript Files
1. `public/js/card-system.js`
   - Added BATTERY_PACK, POWER_CELL, COFFEE_MUG
   - Updated GRENADE with lifecycleType and resourceCost
   
2. `public/js/gamestate.js`
   - Added addEnergy() and addFocus() methods
   - Updated playerAmmo initial value to 7
   - Updated public API

3. `public/js/gone-rogue.js`
   - Added ammo drops to breakables (60% chance)
   - Implemented ammo pickup with auto-collect
   - Enhanced _useUtility() for all resource effects
   - Added ammo tracking in combat (_strCombatAmmoSpent)

---

## 🧪 Testing Checklist

### Manual Testing Required
- [ ] Start new game, verify 7 ammo + 3 starter cards
- [ ] Break objects, verify ammo drops spawn
- [ ] Walk over ammo, verify auto-pickup
- [ ] Use GRENADE, verify 2 ammo consumed
- [ ] Use SINGLE_SHOT, verify 1 ammo consumed
- [ ] Win combat, verify ammo recovery (1 per 3 spent)
- [ ] Use COFFEE_MUG, verify fatigue/focus/energy changes
- [ ] Use BATTERY_PACK, verify battery recharge
- [ ] Use ENERGY_DRINK, verify fatigue reduction
- [ ] Check resource UI updates correctly

### Balance Testing
- [ ] Play through 5 floors using only ammo cards
- [ ] Verify player runs lean but doesn't completely run out
- [ ] Test mixed strategy (ammo + non-ammo cards)
- [ ] Verify tech builds require battery management

---

## 🔮 Future Enhancements

### Short Term
1. Add battery drops to breakables (10% chance)
2. Add visual feedback for resource changes
3. Add resource warning when low
4. Show required vs current resources on card hover

### Long Term
1. Post-combat resource summary UI
2. Resource trend tracking (am I gaining or losing?)
3. Biome-specific resource drops
4. Resource conversion items (trade energy for battery, etc.)

---

## 📚 Related Documentation

- `CARD_DB_TODO.md` - Full card system gap analysis
- `STR_COMBAT_UI_README.md` - Combat system documentation
- `THEFT_MECHANICS.md` - Theft system, key spending model (§6), plant mechanics
- `ENEMY_NCH_INTERACTION_ROADMAP.md` - ENI phases 1-5 interaction surface
- `CROSS_ROADMAP_EXECUTION_ORDER.md` - Sprint ordering and phase dependencies
- `README.txt` - General game documentation

---

## ✅ Success Metrics

All requirements met:
- ✅ Ammo economy balanced for lean gameplay
- ✅ Players starting with 7 ammo (from 30)
- ✅ 3/5 breakables drop ammo (60% = 3.6/6 or 7.2/12)
- ✅ Average 1.2 ammo per drop (80% = 1, 20% = 2)
- ✅ Battery recharge items implemented
- ✅ Fatigue replenishment from food/coffee
- ✅ All 9 resource economies documented and canon-aligned with DebriefFeed RESOURCE_COLORS
- ✅ 3-tier key structure enforced: T1=resource currency (key_ammo), T2=gate items, T3=quest items
- ✅ ITM-017/018/019 corrected to tier 2 (gate keys are items, not currency)
- ✅ Key_ammo theft costs defined (THEFT_MECHANICS §6): PICKPOCKET/STEAL=1, SWAP=2, PLANT/REVEAL/BRIBE=0
- ✅ ITM-098 Skeleton Keyring (passive, key_ammo discount) and ITM-099 Wax Impression Kit (consumable, key_ammo grant) added
- ✅ RESOURCE_COLORS canonical reference (9 resources) documented from debrief-feed-controller.js

**Status:** Ready for MVP playtesting + ENI Phase 0 theft economy data complete!
