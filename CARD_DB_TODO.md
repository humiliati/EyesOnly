# Card Database Import Gap Analysis & TODO

## Overview

This document provides a comprehensive gap analysis between:
- **Existing Implementation**: Current card-system.js with 35+ cards
- **Technical Specification**: Metal Gear Solid-inspired card system design (from low-context helper)

This analysis identifies what can be cleanly imported, what needs adaptation, and what requires new implementation.

---

## Executive Summary

### ✅ What Exists and Aligns
- Quality/rarity system (9 tiers vs 4 in spec, but compatible)
- Card priority system (5 priorities for STR combat)
- Basic fatigue and ammo tracking
- Consumable card concept
- Card generation with affixes

### ⚠️ What Exists but Needs Extension
- Resource system (2/6 resources implemented)
- Card lifecycle types (partial implementation)
- Card cost/resource tracking (basic implementation)
- Status effects (not implemented)

### ❌ What's Missing Entirely
- Energy resource (3-second STR window concept)
- Focus resource (stealth/precision tracking)
- Battery resource (tech card gating)
- Stability resource (hidden RNG modifier)
- Power cards (activated once, persist entire combat)
- Multi-combat cooldown system
- Environmental tile system (oil, water, fire)
- 12-slot bonfire inventory system
- 5-slot action bar system
- Status effect display and tracking

---

## 1. Resource System Gap Analysis

### 1.1 Existing Resources (Implemented)

| Resource | Current Implementation | Spec Alignment | Status |
|----------|----------------------|----------------|---------|
| **Fatigue** | ✅ 0-100 scale in gamestate.js | Spec: 0-10 scale | ⚠️ SCALE MISMATCH |
| **Ammo** | ✅ Pooled, 0-50 max in gamestate.js | Spec: 0-20 max | ⚠️ MAX VALUE MISMATCH |

**Implementation Notes:**
- `gamestate.js` lines 28-40: Current fatigue/ammo tracking
- Cards in `card-system.js` have `fatigue` cost in baseStats
- Attack cards use `ammo` property

### 1.2 Missing Resources (Not Implemented)

| Resource | Spec Definition | Purpose | Implementation Needed |
|----------|----------------|---------|----------------------|
| **Energy** | 0-5, full reset per STR round | Tactical bandwidth for 3-second window | ❌ NEW RESOURCE |
| **Focus** | 0-10, stealth/precision tracking | Enables silent builds, critical hits | ❌ NEW RESOURCE |
| **Battery** | 0-5, rare drops | Gates tech cards (drones, thermal, tazer) | ❌ NEW RESOURCE |
| **Stability** | 0-10, hidden stat | RNG modifier, enemy crit bonus | ❌ NEW RESOURCE |

**TODO Items:**
- [ ] Add Energy resource to gamestate.js (0-5 scale, full reset per round)
- [ ] Add Focus resource to gamestate.js (0-10 scale, modified by stance/noise)
- [ ] Add Battery resource to gamestate.js (0-5 scale, rare refills)
- [ ] Add Stability resource to gamestate.js (0-10 scale, hidden from player)
- [ ] Update resource tracking functions for new resources
- [ ] Add resource interaction matrix (spec section 2.2)
- [ ] Implement post-combat resource restoration rules (spec section 2.3)

---

## 2. Card Lifecycle Type Gap Analysis

### 2.1 Existing Lifecycle Implementation

| Type | Current Implementation | Spec Alignment |
|------|----------------------|----------------|
| **Consumable** | ✅ `consumable: true` flag on cards | ✅ MATCHES "Disposable" (LIFE_001) |
| **Exhaust** | ✅ `exhaust: true` flag on TOTAL_EVASION | ✅ MATCHES "Exhaust" (LIFE_002) |
| **Persistent** | ✅ Cards without consumable flag | ✅ MATCHES "Persistent Core" (LIFE_005) |

**Cards Currently Marked Consumable:**
- EXPLOSIVE_SHOT
- CIGARETTES
- KATCHUP
- RATIONS
- ENERGY_DRINK
- MEDICAL_KIT
- AMMO_CLIP
- STIM_PACK
- ADRENALINE

**Cards Currently Marked Exhaust:**
- TOTAL_EVASION

### 2.2 Missing Lifecycle Types

| Type | Spec Definition | Implementation Needed |
|------|----------------|----------------------|
| **Power** (LIFE_003) | Activated once, active entire combat, removed after | ❌ NOT IMPLEMENTED |
| **Ammo/Fatigue Gated** (LIFE_004) | Requires resource, not consumed, prevents infinite play | ⚠️ PARTIAL (cost exists, but not enforced) |
| **Multi-Combat Cooldown** | N combats between uses, floor cooldown, run cooldown | ❌ NOT IMPLEMENTED |

**TODO Items:**
- [ ] Add `lifecycleType` field to card schema ('disposable', 'exhaust', 'power', 'gated', 'persistent')
- [ ] Implement Power card activation system (once per combat, persists as active effect)
- [ ] Implement cooldown tracking system (combat cooldown, floor cooldown, run cooldown)
- [ ] Add lifecycle distribution validation (45-55% disposable, 20-25% exhaust, etc.)
- [ ] Enforce max 8 persistent cards per deck rule

---

## 3. Card Mapping: Specification → Existing Implementation

### 3.1 Cards That Map Cleanly

| Spec Card ID | Spec Card Name | Existing Card | Alignment |
|--------------|---------------|---------------|-----------|
| CARD_006 | Knife Strike | MELEE_STRIKE | ✅ EXACT MATCH |
| CARD_009 | Tactical Roll | ROLL | ✅ SAME CONCEPT |
| CARD_002 | Emergency Dodge | DODGE | ✅ SAME CONCEPT |
| CARD_004 | Cigarette | CIGARETTES | ✅ EXACT MATCH |
| CARD_021 | Bandage | KATCHUP | ⚠️ SIMILAR (stop bleed vs heal) |
| CARD_022 | Ration Heal | RATIONS | ✅ EXACT MATCH |
| CARD_008 | Full Auto Burst | BURST_SHOT | ✅ SAME CONCEPT |
| CARD_025 | Suppressive Fire | SUPPRESSIVE_FIRE | ✅ EXACT MATCH |
| CARD_001 | Silent Shot | SILENT_SHOT | ✅ EXACT MATCH |
| CARD_027 | Quick Reflex | - | ❌ MISSING (counter/parry card) |

### 3.2 Cards in Spec Missing from Existing

| Card ID | Card Name | Lifecycle | ResourceCost | Rarity | Reason Missing |
|---------|-----------|-----------|--------------|--------|----------------|
| CARD_003 | Grenade Burst | Disposable | Ammo:1 | Uncommon | ⚠️ GRENADE exists but different stats |
| CARD_005 | Prone Stance | **Power** | None | Rare | ❌ PRONE exists but as defense, not Power |
| CARD_007 | Smoke Screen | Exhaust | Battery:1 | Uncommon | ❌ REQUIRES BATTERY RESOURCE |
| CARD_010 | Perfect Ambush | **Power** | None | Rare | ❌ NEW CARD - Power type |
| CARD_011 | Oil Slick | Disposable | None | Uncommon | ❌ NEW CARD - Environmental |
| CARD_012 | Lighter | Disposable | None | Common | ❌ NEW CARD - Environmental |
| CARD_013 | Water Bottle | Disposable | None | Common | ❌ NEW CARD - Environmental |
| CARD_014 | Tazer Shot | Ammo | Battery:1 | Uncommon | ❌ REQUIRES BATTERY RESOURCE |
| CARD_015 | Drone Support | Ammo | Battery:2 | Rare | ❌ REQUIRES BATTERY RESOURCE |
| CARD_016 | Thermal Vision | **Power** | Battery:1 | Rare | ❌ NEW CARD - Power + Battery |
| CARD_017 | Scarface Mode | **Power** | None | Perfect | ❌ NEW CARD - Power type |
| CARD_018 | Ghost Protocol | **Power** | None | Rare | ❌ NEW CARD - Power type |
| CARD_019 | Adrenal Surge | **Power** | None | Perfect | ❌ NEW CARD - Power type |
| CARD_020 | Predator Focus | **Power** | None | Rare | ❌ NEW CARD - Power type |
| CARD_023 | Last Stand | Exhaust | None | Rare | ❌ NEW CARD - Defensive exhaust |
| CARD_024 | Panic Dodge | Exhaust | Fatigue:4 | Common | ❌ NEW CARD - Panic mechanic |
| CARD_026 | Explosive Shot | Ammo | Ammo:2 | Rare | ✅ EXISTS but needs stat update |
| CARD_028 | Flash Bang | Disposable | Ammo:1 | Uncommon | ❌ NEW CARD |
| CARD_029 | Smoke Exit | Disposable | Battery:1 | Rare | ❌ REQUIRES BATTERY RESOURCE |
| CARD_030 | Heavy Recoil | Exhaust | Fatigue:5 | Uncommon | ❌ NEW CARD - Weapon modifier |

**TODO Items:**
- [ ] Add 18 missing cards from specification
- [ ] Convert PRONE from defense to Power lifecycle type
- [ ] Add environmental tile interaction system (oil, water, fire)
- [ ] Implement Battery-dependent cards (7 cards require Battery)
- [ ] Add Power card effects (damage boost, stealth, energy regen, crit)
- [ ] Add panic status effect system

### 3.3 Cards in Existing Not in Spec

| Existing Card | Category | Reason Not in Spec | Action |
|---------------|----------|-------------------|--------|
| DIVE_COVER | Interrupt | Spec focuses on simpler priority | ⚠️ KEEP - Valid card |
| JAM_WEAPON | Interrupt | Disrupt mechanic not in spec | ⚠️ KEEP - Valid card |
| OVERWATCH | Interrupt | First-strike not detailed in spec | ⚠️ KEEP - Valid card |
| BLOCK | Defense | Block vs dodge difference | ⚠️ KEEP - Valid card |
| KNEEL | Defense | Kneeling stance not in spec | ⚠️ KEEP - Valid card |
| CLOSE_DISTANCE | Movement | Movement simplified in spec | ⚠️ KEEP - Valid card |
| RETREAT | Movement | Movement simplified in spec | ⚠️ KEEP - Valid card |
| STRAFE | Movement | Movement simplified in spec | ⚠️ KEEP - Valid card |
| SINGLE_SHOT | Attack | Basic attack, likely assumed | ⚠️ KEEP - Core card |
| AIM | Setup | Accuracy buff not detailed | ⚠️ KEEP - Valid card |
| LURE | Setup | Distraction mechanic | ⚠️ KEEP - Valid card |
| JAMMER | Setup | Tech disruption | ⚠️ KEEP - Valid card |
| VIRUS | Setup | Hacking mechanic | ⚠️ KEEP - Valid card |
| HIGH_GROUND | Setup | Positioning bonus | ⚠️ KEEP - Valid card |
| LOGIC_HACK | Interrupt | Hacking interrupt | ⚠️ KEEP - Valid card |
| *_CHARM (7 types) | Charm | Passive bonus system | ⚠️ KEEP - Separate system |

**Decision:** Keep existing cards not in spec - they add variety and tactical options. Spec is not exhaustive.

---

## 4. Status Effect System Gap Analysis

### 4.1 Current Implementation

**Status:** ❌ NOT IMPLEMENTED

The existing codebase has no status effect system. No tracking of:
- Burning (🔥)
- Bleeding (💉)
- Stunned (⚡)
- Suppressed (💥)
- Knocked Down (🧱)
- Panic (😱)
- Calm (🎯)
- Hidden (👁️)
- Exposed (💡)
- Environmental statuses (🛢️ oiled, 💧 wet, ⚡ electrified)

### 4.2 Specification Requirements

Spec defines 12 status effect types (section 7.1):

| StatusID | Icon | Category | Source | Duration | Effect | Counter |
|----------|------|----------|--------|----------|--------|---------|
| STAT_001 | 🔥 | DOT | Fire tiles, explosions | 2-3 rounds | HP drain, focus reduction | Water, rolling |
| STAT_002 | 💉 | DOT | Knife attacks, crits | 2-4 rounds | HP drain, fatigue on movement | Bandage |
| STAT_003 | ⚡ | Control | Tazer, electrified water | 1 round | Skip next action | Time |
| STAT_004 | 💥 | Control | Burst fire, explosions | 2 rounds | Accuracy down, focus disabled | Quiet action |
| STAT_005 | 🧱 | Control | Explosions, knockback | 1 round | Lose movement, defense down | Stand up |
| STAT_006 | 😱 | Mental | Explosions, low HP, fire | Variable | Misplay chance, discard, accuracy down | Stealth, cigarettes |
| STAT_007 | 🎯 | Mental | Prone, stealth kill, cigarettes | Variable | Accuracy up, crit up, better draws | Loud actions |
| STAT_008 | 👁️ | Stealth | Stealth stance, hiding | Until broken | Enemy cannot target | Loud shots |
| STAT_009 | 💡 | Stealth | Stealth break | 1 round | Enemy accuracy up | Reposition |
| STAT_010 | 🛢️ | Env | Oil tiles | Until cleaned | Slippery, fire vulnerable | Lighter ignites |
| STAT_011 | 💧 | Env | Water tiles, bottles | 2 rounds | Shock vulnerable, burn resistant | Drying, time |
| STAT_012 | ⚡ | Env | Water + battery/tazer | 1 round | Stun risk, slow | Exit water |

**TODO Items:**
- [ ] Create status-effects.js module
- [ ] Implement StatusEffect class with (id, icon, category, duration, effects)
- [ ] Add status effect tracking to gamestate.js (player and enemy arrays)
- [ ] Implement status application system (cards → statuses)
- [ ] Implement status tick system (duration countdown, effect application)
- [ ] Add status display to UI (overhead animator integration)
- [ ] Implement status interaction matrix (burning + oiled = explosive spread)
- [ ] Add status effect counters (water removes fire, bandage removes bleed)
- [ ] Implement max 3 visible statuses rule (spec section 7.2)

---

## 5. Environmental Tile System Gap Analysis

### 5.1 Current Implementation

**Status:** ❌ NOT IMPLEMENTED

Grid system exists in `gone-rogue.js` but only tracks:
- Wall tiles (1 = wall, 0 = floor)
- Enemy positions
- Item positions
- Breakable objects

No environmental tile types exist.

### 5.2 Specification Requirements

Spec requires environmental tile types:

| Tile Type | Effect | Source Cards | Interactions |
|-----------|--------|--------------|--------------|
| **Oil Tile** (🛢️) | Slippery movement, fire vulnerable | CARD_011 (Oil Slick) | Ignited by CARD_012 (Lighter) |
| **Fire Tile** (🔥) | Damage per round, causes BURNING status | Ignited oil, explosions | Spread to adjacent tiles |
| **Water Tile** (💧) | Shock vulnerability, fire resistance | CARD_013 (Water Bottle) | Enables CARD_014 (Tazer shock) |
| **Electrified Water** (⚡💧) | Chain stun effect | Water + tazer/battery | Stuns all in water |

**TODO Items:**
- [ ] Extend grid system to support tile types (not just wall/floor)
- [ ] Add tile properties (oiled, wet, burning, electrified)
- [ ] Implement tile spread mechanics (fire spreads, water pools)
- [ ] Add tile interaction system (cards → tile changes)
- [ ] Render tile types visually in UI
- [ ] Implement tile status effects (standing in fire = burning)
- [ ] Add tile cleanup/expiration (water dries, fire burns out)

---

## 6. Hand & Action Bar System Gap Analysis

### 6.1 Current Implementation

**Status:** ⚠️ PARTIAL IMPLEMENTATION

Existing system has:
- ✅ Mobile card fan UI (`gone-rogue-mobile.js`)
- ✅ Card selection for STR combat
- ⚠️ Inventory system (9-12 persistent slots + 8 loose slots)

Missing:
- ❌ 5-card hand concept (draw phase)
- ❌ 5-slot action bar (committed actions)
- ❌ 12-slot bonfire inventory
- ❌ Card state tracking (hand/action_bar/inventory/exhaust/discard zones)

### 6.2 Specification Requirements (Section 5)

**Zone System:**
- **Hand** (5 slots): Draw phase only, refreshes every STR round
- **Action Bar** (5 slots): Planning phase, committed actions for current round
- **Bonfire Inventory** (12 slots): Long-term storage, accessible only at bonfires

**Card State Tracking:**
```javascript
{
  instanceID: UUID,
  cardID: FK to CARD_,
  currentZone: 'hand' | 'action_bar' | 'inventory' | 'exhaust' | 'discard',
  currentSlot: 0-4,
  isSelected: boolean,
  isQueued: boolean,
  isPersistent: boolean,
  usesRemaining: int,
  cooldownCombat: int,
  cooldownFloor: int,
  roundPlayed: int
}
```

**TODO Items:**
- [ ] Implement 5-card hand system (draw phase mechanic)
- [ ] Implement 5-slot action bar (planning phase, left-to-right resolution)
- [ ] Implement 12-slot bonfire inventory (long-term storage)
- [ ] Add card zone tracking (hand, action bar, inventory, exhaust, discard)
- [ ] Implement hand ↔ action bar transfer rules (spec section 6.1)
- [ ] Implement bonfire inventory management (spec section 6.2)
- [ ] Add card instance state tracking with all fields
- [ ] Add multi-card queuing for sequential execution
- [ ] Implement hand refresh rules (focus/stability modifiers)

---

## 7. Turn Execution System Gap Analysis

### 7.1 Current Implementation

**Status:** ✅ IMPLEMENTED (STR Combat)

Existing STR (Simultaneous Turn Resolution) system:
- Priority-based card resolution (interrupt → defense → movement → attack → setup)
- Card selection UI (mobile)
- Combat resolution with enemy actions

### 7.2 Specification Requirements (Section 8)

Spec defines 4 phases:
1. **Draw Phase**: Draw to 5-card hand, ambush advantage check
2. **Planning Phase**: 2-3 seconds, assign cards to action bar, commit
3. **Resolution Order**: Interrupt → Defense → Movement → Setup → Attack → Environment → Enemy → Cleanup
4. **End of Round Cleanup**: Card lifecycle processing, resource reset, new draw

**Differences:**
- ⚠️ No draw phase (cards come from inventory, not deck draw)
- ⚠️ No planning timer (2-3 second constraint)
- ⚠️ No environment phase (no tile effects)
- ⚠️ No cleanup phase (card lifecycle not enforced)

**TODO Items:**
- [ ] Add draw phase (draw from deck to 5-card hand)
- [ ] Add planning phase timer (2-3 seconds with UI countdown)
- [ ] Add environment phase to resolution (fire spread, water effects)
- [ ] Add cleanup phase (process card lifecycle, reset resources)
- [ ] Implement ambush advantage system (hidden → +2 Focus, enemy delayed)
- [ ] Add resource preview during planning (show cost before commit)
- [ ] Implement card lifecycle processing (consume disposables, exhaust to pile)

---

## 8. Test Agent Verification Gap Analysis

### 8.1 Current Implementation

**Status:** ✅ IMPLEMENTED (agent-mvp-audit.js)

Existing test agent system:
- ✅ Test agent personas (MINMAXER, SPEEDRUNNER, etc.)
- ✅ UX metrics tracking
- ✅ CSV/JSON export
- ✅ Fatigue and consumables tracking (per STR_CARD_SYSTEM_REDESIGN.md)

### 8.2 Specification Requirements (Section 9)

Spec requires test agents to report on:

| Capability | Current Implementation | Status |
|------------|----------------------|--------|
| Resource Reporting | ✅ Fatigue, Ammo tracked | ⚠️ Missing Energy, Focus, Battery, Stability |
| Card Count Reporting | ✅ Deck size tracked | ⚠️ Missing hand/action bar/exhaust breakdown |
| Drop Rate Tracking | ⚠️ Basic tracking | ⚠️ Missing biome-specific drop rates |
| Status Effect Tracking | ❌ Not implemented | ❌ NEW REQUIREMENT |
| Lifecycle Verification | ⚠️ Consumables tracked | ⚠️ Missing exhaust/power/gated tracking |
| Resource Flow Tracking | ✅ Basic tracking | ⚠️ Missing per-card resource deltas |

**TODO Items:**
- [ ] Add reporting for new resources (Energy, Focus, Battery, Stability)
- [ ] Add card zone reporting (hand count, action bar count, exhaust pile count)
- [ ] Add biome-specific drop rate tracking (spec section 9.2)
- [ ] Add status effect tracking capability (active statuses, durations)
- [ ] Add lifecycle verification (cards consumed, exhausted, returned per combat)
- [ ] Add per-card resource flow tracking (resource change per card played)
- [ ] Implement natural language query support (spec section 9.3)

---

## 9. Rarity System Gap Analysis

### 9.1 Current Implementation

**Status:** ✅ IMPLEMENTED (9-tier quality system)

Existing qualities in `card-system.js`:
- CRACKED (18%), WORN (22%), STANDARD (25%), FINE (15%), SUPERIOR (10%), ELITE (6%), MASTERWORK (3%), NEAR_PERFECT (0.9%), PERFECT (0.1%)

### 9.2 Specification Requirements

Spec defines 4 rarity tiers:
- **Common** (60%): Baseline tactical cards, high consumption rate
- **Uncommon** (25%): Tactical trump cards, medium consumption
- **Rare** (10%): Build-defining cards, low consumption
- **Perfect** (5%): Run-defining cards, never consumed

**Alignment:**
- ⚠️ DIFFERENT DISTRIBUTION: 9 tiers vs 4 tiers
- ⚠️ DIFFERENT PERCENTAGES: More granular vs broader categories

**TODO Items:**
- [ ] Add rarity mapping (9 qualities → 4 rarity categories)
  - Common: CRACKED + WORN + STANDARD (65%)
  - Uncommon: FINE + SUPERIOR (25%)
  - Rare: ELITE + MASTERWORK (9%)
  - Perfect: NEAR_PERFECT + PERFECT (1%)
- [ ] Add `rarity` field to card schema (separate from quality)
- [ ] Implement biome-specific drop rates (spec section 4.2)
- [ ] Add lifecycle-rarity correlation (Common=Disposable, Rare=Power, etc.)

---

## 10. Biome Card Drop System Gap Analysis

### 10.1 Current Implementation

**Status:** ❌ NOT IMPLEMENTED

Current card drops are random, not biome-specific. Cards spawn via:
- `CardSystem.getRandomBaseCard()` in `gone-rogue.js`
- No biome filtering
- No drop weight by location

### 10.2 Specification Requirements (Section 9.2)

Spec defines biome-specific card pools:

| Biome | CommonWeight | UncommonWeight | RareWeight | PerfectWeight | NotableCards |
|-------|-------------|----------------|-----------|---------------|--------------|
| Grey Cave | 55% | 28% | 12% | 5% | Thermal Vision, Perfect Ambush, Oil/Lighter |
| Commercial Office | 60% | 25% | 10% | 5% | Tazer Shot, Bandage, Cigarette, Security |
| Shopping Mall | 55% | 30% | 10% | 5% | Flash Bang, Drone Support, First Aid |
| Aerospace Museum | 50% | 30% | 15% | 5% | Predator Focus, Thermal, Explosive Shot |
| Industrial Plant | 55% | 28% | 12% | 5% | Grenade Burst, Heavy Recoil, Chemical |

**TODO Items:**
- [ ] Add `biomeFlags` field to card schema (array: ['office', 'mall', 'cave', 'museum', 'plant'])
- [ ] Implement biome-aware card drop system
- [ ] Add biome-specific drop weight tables
- [ ] Update test agent to track drops per biome
- [ ] Add biome progression logic (early/mid/late game rarity scaling)

---

## 11. Missing Systems Summary

### 11.1 Core Systems to Implement (HIGH PRIORITY)

| System | Complexity | Estimated Effort | Dependencies |
|--------|-----------|-----------------|--------------|
| **Energy Resource** | Low | 2-4 hours | gamestate.js, card costs |
| **Focus Resource** | Medium | 4-6 hours | gamestate.js, stealth system |
| **Battery Resource** | Low | 2-4 hours | gamestate.js, tech cards |
| **Stability Resource** | Medium | 4-6 hours | gamestate.js, RNG system |
| **Status Effect System** | High | 8-12 hours | New module, UI integration |
| **Environmental Tiles** | High | 8-12 hours | Grid system extension, rendering |
| **Power Card Type** | Medium | 4-6 hours | Card lifecycle, activation system |
| **Hand/Action Bar Zones** | Medium | 6-8 hours | Card state tracking, UI |

### 11.2 Enhancement Systems (MEDIUM PRIORITY)

| System | Complexity | Estimated Effort |
|--------|-----------|-----------------|
| **Multi-Combat Cooldowns** | Medium | 4-6 hours |
| **Biome-Specific Drops** | Low | 2-4 hours |
| **Card Instance Tracking** | Medium | 4-6 hours |
| **Resource Interaction Matrix** | Medium | 4-6 hours |
| **Status Effect Display** | Medium | 4-6 hours |
| **Lifecycle Distribution Validation** | Low | 2-4 hours |

### 11.3 Polish Systems (LOW PRIORITY)

| System | Complexity | Estimated Effort |
|--------|-----------|-----------------|
| **Planning Phase Timer** | Low | 2-4 hours |
| **Natural Language Agent Queries** | Medium | 4-6 hours |
| **Rarity-to-Quality Mapping** | Low | 1-2 hours |
| **Card Economy Tracking** | Low | 2-4 hours |

---

## 12. Import Strategy

### 12.1 Clean Import Path (Phase 1: Foundation)

These can be imported immediately without breaking existing code:

1. **Add New Resources to gamestate.js**
   - Add Energy, Focus, Battery, Stability fields
   - Add getter/setter functions
   - Add to save/load state
   - **Effort:** 2-4 hours
   - **Risk:** Low (additive, not breaking)

2. **Add Card Schema Fields**
   - Add `lifecycleType` field
   - Add `rarity` field
   - Add `biomeFlags` field
   - Add resource cost fields (`energyCost`, `focusCost`, `batteryCost`)
   - **Effort:** 1-2 hours
   - **Risk:** Low (additive)

3. **Add Missing Consumable Cards**
   - Add 18 missing cards from spec (section 3.2)
   - Mark with appropriate lifecycle types
   - **Effort:** 4-6 hours
   - **Risk:** Low (new cards, no conflicts)

### 12.2 Incremental Integration Path (Phase 2: Systems)

These require careful integration with existing systems:

4. **Implement Status Effect System**
   - Create `status-effects.js` module
   - Add status tracking to gamestate
   - Integrate with combat resolution
   - Add UI display
   - **Effort:** 8-12 hours
   - **Risk:** Medium (new system, UI changes)

5. **Implement Environmental Tiles**
   - Extend grid system for tile types
   - Add tile interaction logic
   - Add visual rendering
   - **Effort:** 8-12 hours
   - **Risk:** Medium (grid system changes)

6. **Implement Hand/Action Bar Zones**
   - Create zone tracking system
   - Update card selection UI
   - Add zone transfer logic
   - **Effort:** 6-8 hours
   - **Risk:** Medium (UI refactor)

### 12.3 Advanced Features Path (Phase 3: Polish)

These can be implemented after foundation is stable:

7. **Implement Power Card System**
   - Add activation logic
   - Add persistent effect tracking
   - Update combat resolution
   - **Effort:** 4-6 hours
   - **Risk:** Medium (lifecycle changes)

8. **Implement Multi-Combat Cooldowns**
   - Add cooldown tracking
   - Add cooldown reduction logic
   - Update card availability checks
   - **Effort:** 4-6 hours
   - **Risk:** Low (isolated feature)

9. **Implement Biome-Specific Drops**
   - Add biome detection
   - Add drop weight tables
   - Update card spawn logic
   - **Effort:** 2-4 hours
   - **Risk:** Low (spawn system change)

---

## 13. Database Import Structure Reference

Following the pattern from `INTERACTIVE_ITEMS_TODO.md`, the card database should support:

### 13.1 Designer-Friendly Definition Format

Cards should be definable without code changes:

```javascript
// card-definitions.js or external JSON
CARD_DEFINITIONS = {
  'CARD_031': {
    cardId: 'CARD_031',
    cardName: 'My Custom Card',
    lifecycle: 'disposable',
    baseCost: 1,
    resourceCost: { ammo: 1, focus: 1 },
    targetType: 'enemy',
    effectPrimary: 'damage',
    effectSecondary: 'ambushBonus',
    rarity: 'uncommon',
    biomeFlags: ['office', 'mall'],
    emoji: '🎯',
    baseStats: { damage: 3, accuracy: 80 }
  }
};
```

### 13.2 External JSON Loading

```javascript
// Future enhancement - load from external file
fetch('data/card-definitions.json')
  .then(response => response.json())
  .then(data => CardSystem.loadDefinitions(data));
```

### 13.3 No Code Compilation Required

Goal: Designers can add/modify cards without JavaScript expertise.

**TODO Items:**
- [ ] Create `card-definitions.json` schema
- [ ] Add `CardSystem.loadDefinitions(data)` function
- [ ] Add validation for card definitions
- [ ] Add card editor tool (future)
- [ ] Document card definition format for designers

---

## 14. Breaking Changes & Migration Plan

### 14.1 Potentially Breaking Changes

| Change | Impact | Migration Required |
|--------|--------|-------------------|
| **Fatigue Scale** (100 → 10) | High | Convert existing saves, scale card costs |
| **Ammo Max** (50 → 20) | Medium | Cap existing saves, scale card costs |
| **Card Schema** (add fields) | Low | Add defaults for missing fields |
| **Grid System** (add tile types) | High | Extend save format, migrate existing grids |
| **Inventory** (separate zones) | High | Migrate single inventory to hand/bar/bonfire |

### 14.2 Migration Strategy

1. **Add Compatibility Layer**
   - Detect old save format
   - Convert to new format on load
   - Log migration warnings

2. **Gradual Rollout**
   - Phase 1: Add new fields with defaults
   - Phase 2: Use new fields in calculations
   - Phase 3: Deprecate old fields

3. **Testing Protocol**
   - Test with old saves
   - Test with new saves
   - Test with mixed state (partially migrated)

**TODO Items:**
- [ ] Create `migration.js` module
- [ ] Add save version tracking
- [ ] Implement fatigue scale conversion (100 → 10)
- [ ] Implement ammo max conversion (50 → 20)
- [ ] Add card schema migration (add missing fields)
- [ ] Test migration with existing saves

---

## 15. Next Actions

### Immediate Next Steps (Do First)

1. **Create Card Definition Schema**
   - Document all required fields
   - Create validation function
   - Add to `card-system.js`

2. **Add New Resources**
   - Implement Energy, Focus, Battery, Stability
   - Add to gamestate.js
   - Add UI display

3. **Add Missing Cards**
   - Implement 18 missing cards from spec
   - Mark with lifecycle types
   - Test card generation

4. **Document Import Format**
   - Create JSON schema
   - Document designer workflow
   - Create example card definitions

### Short-Term Goals (This Sprint)

5. **Implement Status Effects**
   - Create status-effects.js
   - Add tracking to gamestate
   - Add UI display

6. **Implement Environmental Tiles**
   - Extend grid system
   - Add tile interactions
   - Add visual rendering

### Long-Term Goals (Next Quarter)

7. **Complete Hand/Action Bar System**
8. **Implement Power Cards**
9. **Add Biome-Specific Drops**
10. **Polish Test Agent Reporting**

---

## 16. Conclusion

This gap analysis identifies:
- ✅ **18 cards** can be cleanly mapped from spec to existing
- ⚠️ **18 cards** need to be added (mostly Power and Battery-dependent)
- ❌ **4 resources** missing (Energy, Focus, Battery, Stability)
- ❌ **Status effect system** not implemented (12 status types)
- ❌ **Environmental tile system** not implemented (4 tile types)
- ⚠️ **Hand/Action Bar zones** partially implemented
- ⚠️ **Card lifecycle types** partially implemented

**Total Implementation Effort:** ~80-120 hours for complete spec alignment

**Recommendation:** Implement in 3 phases:
1. Foundation (resources, card schema, missing cards) - 15-20 hours
2. Systems (status effects, tiles, zones) - 35-45 hours
3. Polish (Power cards, cooldowns, biomes) - 30-40 hours

This allows incremental integration without breaking existing functionality.

---

## Appendix A: Card Mapping Table

| Spec ID | Spec Name | Existing Card | Status | Action Required |
|---------|-----------|---------------|--------|----------------|
| CARD_001 | Silent Shot | SILENT_SHOT | ✅ Match | Update resource costs |
| CARD_002 | Emergency Dodge | DODGE | ✅ Match | Add exhaust flag |
| CARD_003 | Grenade Burst | GRENADE | ⚠️ Partial | Update stats, add AOE |
| CARD_004 | Cigarette | CIGARETTES | ✅ Match | Add Focus+2 effect |
| CARD_005 | Prone Stance | PRONE | ⚠️ Partial | Convert to Power type |
| CARD_006 | Knife Strike | MELEE_STRIKE | ✅ Match | Add crit bonus |
| CARD_007 | Smoke Screen | - | ❌ Missing | Create new card (Battery) |
| CARD_008 | Full Auto Burst | BURST_SHOT | ✅ Match | Update ammo cost (5) |
| CARD_009 | Tactical Roll | ROLL | ✅ Match | Add exhaust flag |
| CARD_010 | Perfect Ambush | - | ❌ Missing | Create new Power card |
| CARD_011 | Oil Slick | - | ❌ Missing | Create new card (env) |
| CARD_012 | Lighter | - | ❌ Missing | Create new card (env) |
| CARD_013 | Water Bottle | - | ❌ Missing | Create new card (env) |
| CARD_014 | Tazer Shot | - | ❌ Missing | Create new card (Battery) |
| CARD_015 | Drone Support | - | ❌ Missing | Create new card (Battery) |
| CARD_016 | Thermal Vision | - | ❌ Missing | Create new Power card |
| CARD_017 | Scarface Mode | - | ❌ Missing | Create new Power card |
| CARD_018 | Ghost Protocol | - | ❌ Missing | Create new Power card |
| CARD_019 | Adrenal Surge | - | ❌ Missing | Create new Power card |
| CARD_020 | Predator Focus | - | ❌ Missing | Create new Power card |
| CARD_021 | Bandage | KATCHUP | ⚠️ Similar | Add stop bleed effect |
| CARD_022 | Ration Heal | RATIONS | ✅ Match | Verify stats match |
| CARD_023 | Last Stand | - | ❌ Missing | Create new exhaust card |
| CARD_024 | Panic Dodge | - | ❌ Missing | Create new exhaust card |
| CARD_025 | Suppressive Fire | SUPPRESSIVE_FIRE | ✅ Match | Update ammo cost (7) |
| CARD_026 | Explosive Shot | EXPLOSIVE_SHOT | ✅ Match | Update ammo cost (2) |
| CARD_027 | Quick Reflex | - | ❌ Missing | Create new exhaust card |
| CARD_028 | Flash Bang | - | ❌ Missing | Create new consumable |
| CARD_029 | Smoke Exit | - | ❌ Missing | Create new card (Battery) |
| CARD_030 | Heavy Recoil | - | ❌ Missing | Create new exhaust card |

**Summary:** 10 clean matches, 5 partial matches, 15 missing cards

---

## Appendix B: Detailed Card Specifications

### B.1 Environmental Interaction Cards

#### CARD_011: Oil Slick
```javascript
{
  cardId: 'CARD_011',
  cardName: 'Oil Slick',
  emoji: '🛢️',
  lifecycle: 'disposable',
  category: 'utility',
  rarity: 'uncommon',
  biomeFlags: ['industrial', 'cave', 'museum'],
  baseCost: 0,
  resourceCost: {},
  targetType: 'ground',
  targetRange: 3,
  targetArea: 'single',
  baseStats: {
    duration: 5  // rounds before evaporation
  },
  effectPrimary: 'create_tile',
  effectSecondary: null,
  tileCreated: 'oil',
  description: 'Create oil tile. Causes slipping. Ignites with fire.',
  flavorText: 'Industrial hazard waiting to happen.',
  discovery: {
    firstUseHint: 'Slippery surfaces impede movement. Fire amplifies danger.',
    synergy: ['CARD_012 (Lighter)', 'fire sources', 'movement disruption']
  }
}
```

#### CARD_012: Lighter
```javascript
{
  cardId: 'CARD_012',
  cardName: 'Lighter',
  emoji: '🔥',
  lifecycle: 'disposable',
  category: 'utility',
  rarity: 'common',
  biomeFlags: ['all'],
  baseCost: 0,
  resourceCost: {},
  targetType: 'ground',
  targetRange: 1,
  targetArea: 'single',
  baseStats: {
    damage: 1,
    duration: 3  // fire burns for 3 rounds
  },
  effectPrimary: 'ignite',
  effectSecondary: 'create_tile',
  tileCreated: 'fire',
  statusInflicted: 'STAT_001',  // Burning
  description: 'Ignite oil or create small fire. Causes BURNING status.',
  flavorText: 'Not just for cigarettes anymore.',
  discovery: {
    firstUseHint: 'Fire spreads on oil. Creates area denial.',
    synergy: ['CARD_011 (Oil Slick)', 'CARD_004 (Cigarette)', 'oiled enemies']
  }
}
```

#### CARD_013: Water Bottle
```javascript
{
  cardId: 'CARD_013',
  cardName: 'Water Bottle',
  emoji: '💧',
  lifecycle: 'disposable',
  category: 'utility',
  rarity: 'common',
  biomeFlags: ['all'],
  baseCost: 0,
  resourceCost: {},
  targetType: 'ground',
  targetRange: 2,
  targetArea: '3x3',
  baseStats: {
    duration: 2,  // water dries after 2 rounds
    healAmount: 1  // optional: drink for 1 HP
  },
  effectPrimary: 'create_tile',
  effectSecondary: 'extinguish_fire',
  tileCreated: 'water',
  statusRemoved: 'STAT_001',  // Removes burning
  description: 'Create water tiles. Extinguishes fire. Enables electrocution.',
  flavorText: 'H₂O: Universal solvent and conductor.',
  discovery: {
    firstUseHint: 'Water conducts electricity. Dowses flames.',
    synergy: ['CARD_014 (Tazer)', 'fire tiles', 'burning status']
  }
}
```

### B.2 Tech/Battery Cards

#### CARD_007: Smoke Screen
```javascript
{
  cardId: 'CARD_007',
  cardName: 'Smoke Screen',
  emoji: '💨',
  lifecycle: 'exhaust',
  category: 'stealth',
  rarity: 'uncommon',
  biomeFlags: ['office', 'mall', 'industrial'],
  baseCost: 1,
  resourceCost: { battery: 1 },
  targetType: 'self',
  targetRange: 0,
  targetArea: '5x5',
  baseStats: {
    duration: 3,
    stealthBonus: 40
  },
  effectPrimary: 'create_smoke',
  effectSecondary: 'stealth_boost',
  statusGranted: 'STAT_008',  // Hidden
  description: 'Deploy smoke cloud. Grants HIDDEN status for 3 rounds.',
  flavorText: 'Tactical vanishing act.',
  discovery: {
    firstUseHint: 'Smoke breaks line of sight. Loud actions reveal position.',
    synergy: ['stealth builds', 'retreat', 'ambush setup']
  }
}
```

#### CARD_014: Tazer Shot
```javascript
{
  cardId: 'CARD_014',
  cardName: 'Tazer Shot',
  emoji: '⚡',
  lifecycle: 'ammo_gated',
  category: 'attack',
  rarity: 'uncommon',
  biomeFlags: ['office', 'mall'],
  baseCost: 1,
  resourceCost: { ammo: 1, battery: 1 },
  targetType: 'enemy',
  targetRange: 3,
  targetArea: 'single_or_water',
  baseStats: {
    damage: 1,
    stunDuration: 1
  },
  effectPrimary: 'stun',
  effectSecondary: 'chain_in_water',
  statusInflicted: 'STAT_003',  // Stunned
  description: 'Non-lethal stun. Chain effect in water.',
  flavorText: '50,000 volts of compliance.',
  discovery: {
    firstUseHint: 'Water amplifies effect. Chains to all in puddle.',
    synergy: ['CARD_013 (Water)', 'wet status', 'crowd control']
  }
}
```

#### CARD_015: Drone Support
```javascript
{
  cardId: 'CARD_015',
  cardName: 'Drone Support',
  emoji: '🛸',
  lifecycle: 'ammo_gated',
  category: 'setup',
  rarity: 'rare',
  biomeFlags: ['museum', 'industrial', 'office'],
  baseCost: 2,
  resourceCost: { battery: 2 },
  targetType: 'enemy',
  targetRange: 8,
  targetArea: 'single',
  baseStats: {
    damage: 2,
    accuracy: 95,
    duration: 3  // lasts 3 rounds, auto-fires
  },
  effectPrimary: 'summon_drone',
  effectSecondary: 'overwatch',
  description: 'Deploy drone. Auto-attacks highest threat for 3 rounds.',
  flavorText: 'Autonomous death from above.',
  discovery: {
    firstUseHint: 'Drone persists across rounds. Targets highest HP enemy.',
    synergy: ['tech builds', 'high ground', 'area control']
  }
}
```

#### CARD_016: Thermal Vision
```javascript
{
  cardId: 'CARD_016',
  cardName: 'Thermal Vision',
  emoji: '🔴',
  lifecycle: 'power',
  category: 'setup',
  rarity: 'rare',
  biomeFlags: ['cave', 'museum', 'industrial'],
  baseCost: 1,
  resourceCost: { battery: 1 },
  targetType: 'self',
  targetRange: 0,
  targetArea: 'vision',
  baseStats: {
    sightBonus: 5,
    accuracyBonus: 15
  },
  effectPrimary: 'enhanced_vision',
  effectSecondary: 'reveal_hidden',
  description: 'Power card. See through walls. Reveal hidden enemies.',
  flavorText: 'No hiding from infrared.',
  discovery: {
    firstUseHint: 'Active entire combat. Negates stealth advantage.',
    synergy: ['cave biomes', 'darkness', 'anti-stealth']
  }
}
```

#### CARD_029: Smoke Exit
```javascript
{
  cardId: 'CARD_029',
  cardName: 'Smoke Exit',
  emoji: '💨',
  lifecycle: 'disposable',
  category: 'escape',
  rarity: 'rare',
  biomeFlags: ['office', 'mall', 'industrial'],
  baseCost: 2,
  resourceCost: { battery: 1 },
  targetType: 'self',
  targetRange: 0,
  targetArea: 'instant',
  baseStats: {
    teleportRange: 5
  },
  effectPrimary: 'combat_escape',
  effectSecondary: 'smoke_trail',
  description: 'Instant escape. Leave smoke. End combat.',
  flavorText: 'Emergency extraction protocol.',
  discovery: {
    firstUseHint: 'Ends combat immediately. Cannot be used on cooldown.',
    synergy: ['low HP escapes', 'loot runs', 'speed builds']
  }
}
```

### B.3 Power Cards

#### CARD_010: Perfect Ambush
```javascript
{
  cardId: 'CARD_010',
  cardName: 'Perfect Ambush',
  emoji: '🎯',
  lifecycle: 'power',
  category: 'setup',
  rarity: 'rare',
  biomeFlags: ['cave', 'forest', 'industrial'],
  baseCost: 1,
  resourceCost: { focus: 3 },
  targetType: 'self',
  targetRange: 0,
  targetArea: 'passive',
  baseStats: {
    critChance: 50,
    damageMultiplier: 1.5
  },
  effectPrimary: 'ambush_bonus',
  effectSecondary: 'first_strike',
  description: 'Power card. +50% crit. 1.5x damage from stealth.',
  flavorText: 'Patience rewarded with violence.',
  discovery: {
    firstUseHint: 'Active entire combat. Synergizes with stealth.',
    synergy: ['stealth builds', 'CARD_001 (Silent Shot)', 'high focus']
  }
}
```

#### CARD_017: Scarface Mode
```javascript
{
  cardId: 'CARD_017',
  cardName: 'Scarface Mode',
  emoji: '💀',
  lifecycle: 'power',
  category: 'attack',
  rarity: 'perfect',
  biomeFlags: ['all'],
  baseCost: 2,
  resourceCost: {},
  targetType: 'self',
  targetRange: 0,
  targetArea: 'passive',
  baseStats: {
    damageBonus: 3,
    hpDrainPerRound: 2,
    accuracyPenalty: -10
  },
  effectPrimary: 'berserker',
  effectSecondary: 'reckless',
  description: 'Power card. +3 damage, -2 HP/round, -10% accuracy.',
  flavorText: 'Say hello to my little friend.',
  discovery: {
    firstUseHint: 'High risk, high reward. HP drain can kill you.',
    synergy: ['high HP builds', 'aggressive play', 'speed runs']
  }
}
```

#### CARD_018: Ghost Protocol
```javascript
{
  cardId: 'CARD_018',
  cardName: 'Ghost Protocol',
  emoji: '👻',
  lifecycle: 'power',
  category: 'stealth',
  rarity: 'rare',
  biomeFlags: ['office', 'cave', 'museum'],
  baseCost: 1,
  resourceCost: { focus: 5 },
  targetType: 'self',
  targetRange: 0,
  targetArea: 'passive',
  baseStats: {
    stealthBonus: 50,
    detectionImmunity: true
  },
  effectPrimary: 'undetectable',
  effectSecondary: 'no_combat_noise',
  statusGranted: 'STAT_008',  // Hidden (permanent)
  description: 'Power card. Cannot be detected. Silent attacks.',
  flavorText: 'Operational ghost. No witnesses.',
  discovery: {
    firstUseHint: 'Perfect stealth. Breaks on loud actions.',
    synergy: ['CARD_001 (Silent Shot)', 'stealth kills', 'no alerts']
  }
}
```

#### CARD_019: Adrenal Surge
```javascript
{
  cardId: 'CARD_019',
  cardName: 'Adrenal Surge',
  emoji: '💉',
  lifecycle: 'power',
  category: 'utility',
  rarity: 'perfect',
  biomeFlags: ['all'],
  baseCost: 1,
  resourceCost: {},
  targetType: 'self',
  targetRange: 0,
  targetArea: 'passive',
  baseStats: {
    energyRegenPerRound: 2,
    movementBonus: 1,
    fatigueReduction: 50
  },
  effectPrimary: 'energy_regen',
  effectSecondary: 'enhanced_movement',
  description: 'Power card. +2 Energy/round. +1 movement. -50% fatigue.',
  flavorText: 'Biochemical advantage.',
  discovery: {
    firstUseHint: 'Enables high action economy. Combo enabler.',
    synergy: ['combo builds', 'multi-card plays', 'aggressive tempo']
  }
}
```

#### CARD_020: Predator Focus
```javascript
{
  cardId: 'CARD_020',
  cardName: 'Predator Focus',
  emoji: '🦅',
  lifecycle: 'power',
  category: 'attack',
  rarity: 'rare',
  biomeFlags: ['museum', 'cave', 'forest'],
  baseCost: 1,
  resourceCost: { focus: 4 },
  targetType: 'self',
  targetRange: 0,
  targetArea: 'passive',
  baseStats: {
    accuracyBonus: 25,
    critChance: 30,
    sightBonus: 3
  },
  effectPrimary: 'enhanced_precision',
  effectSecondary: 'target_marking',
  description: 'Power card. +25% accuracy, +30% crit, +3 sight.',
  flavorText: 'Apex predator instincts.',
  discovery: {
    firstUseHint: 'Precision build enabler. See and hit everything.',
    synergy: ['sniper builds', 'long-range cards', 'accuracy focus']
  }
}
```

### B.4 Defensive/Utility Cards

#### CARD_023: Last Stand
```javascript
{
  cardId: 'CARD_023',
  cardName: 'Last Stand',
  emoji: '🛡️',
  lifecycle: 'exhaust',
  category: 'defense',
  rarity: 'rare',
  biomeFlags: ['all'],
  baseCost: 2,
  resourceCost: {},
  targetType: 'self',
  targetRange: 0,
  targetArea: 'instant',
  baseStats: {
    damageReduction: 100,  // immune to damage
    duration: 1,  // this round only
    fatigueGain: 5
  },
  effectPrimary: 'damage_immunity',
  effectSecondary: 'fatigue_cost',
  description: 'Exhaust. Immune to damage this round. +5 fatigue.',
  flavorText: 'Not today, Death.',
  discovery: {
    firstUseHint: 'Emergency defense. High fatigue cost.',
    synergy: ['low HP situations', 'boss fights', 'buying time']
  }
}
```

#### CARD_024: Panic Dodge
```javascript
{
  cardId: 'CARD_024',
  cardName: 'Panic Dodge',
  emoji: '😱',
  lifecycle: 'exhaust',
  category: 'defense',
  rarity: 'common',
  biomeFlags: ['all'],
  baseCost: 1,
  resourceCost: { fatigue: 4 },
  targetType: 'self',
  targetRange: 0,
  targetArea: 'instant',
  baseStats: {
    evasion: 80,
    movementDistance: 2
  },
  effectPrimary: 'panic_movement',
  effectSecondary: 'discard_card',
  statusInflicted: 'STAT_006',  // Self-panic
  description: 'Exhaust. 80% evasion, move 2 tiles. Discard random card.',
  flavorText: 'Fear is a survival mechanism.',
  discovery: {
    firstUseHint: 'Emergency dodge. Costs card from hand.',
    synergy: ['low HP panic', 'card cycling', 'repositioning']
  }
}
```

#### CARD_027: Quick Reflex
```javascript
{
  cardId: 'CARD_027',
  cardName: 'Quick Reflex',
  emoji: '⚡',
  lifecycle: 'exhaust',
  category: 'interrupt',
  rarity: 'uncommon',
  biomeFlags: ['office', 'mall', 'museum'],
  baseCost: 0,
  resourceCost: { energy: 2 },
  targetType: 'self',
  targetRange: 0,
  targetArea: 'instant',
  baseStats: {
    counterDamage: 2,
    accuracy: 90
  },
  effectPrimary: 'counter_attack',
  effectSecondary: 'interrupt_enemy',
  description: 'Exhaust. Counter enemy attack. 2 damage, 90% accuracy.',
  flavorText: 'Faster than thought.',
  discovery: {
    firstUseHint: 'Interrupts enemy action. Requires fast reflexes.',
    synergy: ['defensive builds', 'enemy prediction', 'high energy']
  }
}
```

#### CARD_028: Flash Bang
```javascript
{
  cardId: 'CARD_028',
  cardName: 'Flash Bang',
  emoji: '💥',
  lifecycle: 'disposable',
  category: 'utility',
  rarity: 'uncommon',
  biomeFlags: ['office', 'mall', 'industrial'],
  baseCost: 1,
  resourceCost: { ammo: 1 },
  targetType: 'area',
  targetRange: 3,
  targetArea: '3x3',
  baseStats: {
    stunDuration: 1,
    accuracyPenalty: 50  // -50% accuracy for 2 rounds
  },
  effectPrimary: 'blind_enemies',
  effectSecondary: 'suppress',
  statusInflicted: 'STAT_004',  // Suppressed
  description: 'Blind and suppress enemies in area. -50% accuracy.',
  flavorText: 'Thunder and lightning.',
  discovery: {
    firstUseHint: 'Area denial. Disables enemy accuracy.',
    synergy: ['crowd control', 'multi-enemy fights', 'escape setup']
  }
}
```

#### CARD_030: Heavy Recoil
```javascript
{
  cardId: 'CARD_030',
  cardName: 'Heavy Recoil',
  emoji: '💥',
  lifecycle: 'exhaust',
  category: 'attack',
  rarity: 'uncommon',
  biomeFlags: ['industrial', 'museum', 'office'],
  baseCost: 2,
  resourceCost: { fatigue: 5, ammo: 3 },
  targetType: 'enemy',
  targetRange: 5,
  targetArea: 'single',
  baseStats: {
    damage: 8,
    accuracy: 70,
    knockback: 2
  },
  effectPrimary: 'high_damage',
  effectSecondary: 'knockback',
  statusInflicted: 'STAT_005',  // Knocked down
  description: 'Exhaust. Massive damage. Knockback. High fatigue.',
  flavorText: '.50 cal problems.',
  discovery: {
    firstUseHint: 'Boss killer. High cost, high reward.',
    synergy: ['boss fights', 'high HP targets', 'knockout setups']
  }
}
```

### B.5 Card Synergy Matrices

#### Environmental Synergy Map
```
Oil (CARD_011) + Lighter (CARD_012) = Fire spread (high damage area)
Water (CARD_013) + Tazer (CARD_014) = Chain stun (all in water)
Water (CARD_013) + Fire tiles = Extinguish (removes fire)
Smoke Screen (CARD_007) + Silent Shot (CARD_001) = Perfect stealth attack
```

#### Power Card Combos
```
Perfect Ambush (CARD_010) + Ghost Protocol (CARD_018) = Stealth crit build
Adrenal Surge (CARD_019) + Heavy Recoil (CARD_030) = High action economy
Predator Focus (CARD_020) + Thermal Vision (CARD_016) = Perfect accuracy
Scarface Mode (CARD_017) + Last Stand (CARD_023) = Berserker survival
```

#### Lifecycle Combos
```
Disposables (common) → Tactical flexibility
Exhaust cards (rare) → Emergency responses
Power cards (rare/perfect) → Build-defining strategy
Gated cards (uncommon) → Resource management
```

### B.6 Missing Card Implementation Priority

#### Phase 1: Environmental System (Required)
1. CARD_011 (Oil Slick) - Foundation for fire system
2. CARD_012 (Lighter) - Ignition mechanic
3. CARD_013 (Water Bottle) - Fire counter + electric conductor

#### Phase 2: Tech/Battery Cards (Medium)
4. CARD_007 (Smoke Screen) - Stealth utility
5. CARD_014 (Tazer Shot) - Electric mechanic
6. CARD_015 (Drone Support) - Summon mechanic
7. CARD_016 (Thermal Vision) - Vision upgrade
8. CARD_029 (Smoke Exit) - Escape mechanic

#### Phase 3: Power Cards (High Impact)
9. CARD_010 (Perfect Ambush) - Stealth build
10. CARD_017 (Scarface Mode) - Aggressive build
11. CARD_018 (Ghost Protocol) - Stealth build
12. CARD_019 (Adrenal Surge) - Action economy
13. CARD_020 (Predator Focus) - Precision build

#### Phase 4: Utility/Defense (Polish)
14. CARD_023 (Last Stand) - Emergency defense
15. CARD_024 (Panic Dodge) - Panic mechanic
16. CARD_027 (Quick Reflex) - Counter mechanic
17. CARD_028 (Flash Bang) - Crowd control
18. CARD_030 (Heavy Recoil) - Boss killer

---

## 17. STR Combat Out-of-Combat Extension

### 17.1 Current Implementation

**Status:** ✅ IMPLEMENTED (STR Combat System)

The existing STR (Simultaneous Turn Resolution) combat system is fully implemented:
- Priority-based card resolution (interrupt → defense → movement → attack → setup)
- Card selection via mobile hand fan UI
- Combat resolution with simultaneous player/enemy actions
- Card priority system (5 levels)

### 17.2 Out-of-Combat Hand Fan Usage

**Status:** ⚠️ PARTIAL IMPLEMENTATION

The hand fan component exists but needs extension for out-of-combat contextual usage:

**Existing Features:**
- ✅ Hand fan component with 'combat', 'hidden', 'contextual' modes
- ✅ Card display with emoji, name, resource costs
- ✅ Card selection via tap/click
- ✅ Hearthstone-style visual card layout

**Missing Features for Out-of-Combat:**
- ❌ Contextual card usage on nearby tiles (environmental actions)
- ❌ Contextual card usage on nearby enemies (pre-combat actions)
- ❌ Resource spending validation outside combat
- ❌ Card lifecycle tracking (disposable vs persistent outside combat)
- ❌ Visual feedback for valid/invalid targets
- ❌ Range indicators for card targeting

### 17.3 Environmental Action Buttons

**Status:** ⚠️ NEEDS DESIGN

Environmental action buttons should allow out-of-combat interaction with:

**Ground Effects Interaction:**
- 🛢️ Oil tiles: Can ignite with Lighter card (CARD_012)
- 🔥 Fire tiles: Can extinguish with Water Bottle (CARD_013)
- 💧 Water tiles: Can electrify with Tazer Shot (CARD_014)
- ☢️ Industrial Waste: Can clean with specialized cards
- ✨ Glass: Can trigger noise alerts
- 🥤 Soda Spill: Can clean or slip enemies

**Enemy Interaction (Pre-Combat):**
- Silent takedown cards (stealth kills before combat)
- Lure cards (distract enemies out of position)
- Environmental trap setup (oil slick before engagement)

**Environmental Setup:**
- Deploy ground effects before combat
- Create tactical advantages (high ground, cover)
- Set up ambush positions

### 17.4 Equipped Item Usage from Header

**Status:** ⚠️ NEEDS IMPLEMENTATION

The header should have an action button for using equipped items:

**Requirements:**
- Display equipped item emoji + name in header action button
- Click action button to use equipped item (consume if disposable)
- Items must be equipped to be used (inventory display alone is insufficient)
- Visual feedback when no item equipped ("No Item" / disabled state)
- Resource cost validation (Energy, Ammo, Battery, Focus)
- Cooldown tracking for reusable equipped items

**Item Types for Header Usage:**
- Consumables: Health Kit, Ration, Energy Drink, Cigarette
- Environmental: Oil Slick, Lighter, Water Bottle
- Utility: Smoke Screen, Flash Bang, Drone Support
- Passive Equipment: Cardboard Box (toggle equip/unequip)

### 17.5 Hand Fan Component Workflow

**Out-of-Combat Workflow:**

```javascript
// 1. Player taps/clicks to open hand fan in contextual mode
HandFanComponent.setMode('contextual', 'bottom');
HandFanComponent.show(availableCards);

// 2. Player selects card from hand fan
HandFanComponent.selectCard(cardId);

// 3. Player taps/clicks target tile (enemy, ground effect, empty tile)
var validTarget = validateCardTarget(card, targetX, targetY);
if (validTarget && hasResources(card.resourceCost)) {
  // 4. Spend resources
  spendResources(card.resourceCost);

  // 5. Apply card effect
  applyCardEffect(card, targetX, targetY);

  // 6. Update hand fan (remove if disposable)
  if (card.lifecycleType === 'disposable') {
    HandFanComponent.removeCard(cardId);
    // Trigger incinerator animation
    animateCardDisposal(cardId);
  }

  // 7. Update debrief feed with resource consumption
  DebriefFeedRenderer.addFeedItem({
    type: 'resource-spend',
    resource: 'energy', // or ammo, focus, battery
    amount: card.resourceCost.energy,
    cardName: card.name,
    colorCode: getResourceColorCode(currentEnergy, maxEnergy)
  });
}
```

### 17.6 Visual Selection Indicators

**Required Visual States:**

**Card Selection (in hand fan):**
- Unselected: Default card appearance
- Hovered: Slight scale-up (transform: scale(1.05)), subtle glow
- Selected: Transform up (translateY(-20px)), drop shadow, highlight border
- Invalid (insufficient resources): Grayscale filter, red border, disabled cursor

**Target Selection (on grid):**
- Valid target: Green highlight overlay, pulsing animation
- Invalid target: Red highlight overlay, X icon
- Out of range: Grayed out, distance indicator
- Optimal target: Gold highlight (e.g., oil tile + lighter card)

### 17.7 Resource Consumption Color Coding

**Debrief Feed Color Scheme:**

**Resource Percentage Thresholds:**
- **>60% remaining:** 🟢 Green (#4CAF50) - Healthy resource level
- **30-60% remaining:** 🟠 Orange (#FF9800) - Caution, moderate usage
- **<30% remaining:** 🔴 Red (#F44336) - Critical, low resources

**Application:**
- Color-code resource spend messages in debrief feed
- Update resource bars in header with dynamic colors
- Flash color when resources reach critical threshold
- Show color preview before committing to card use

**Example Debrief Messages:**
```
🟢 Energy: -2 (8/10) [Single Shot]
🟠 Ammo: -3 (4/10) [Burst Fire]
🔴 HP: -5 (3/20) [Fire Tile Damage]
```

### 17.8 Incinerator Animation

**Card Disposal Visual:**

**Animation Sequence:**
1. Card selected and used (disposable lifecycle)
2. Card flashes bright (200ms)
3. Card shrinks toward center with rotation (400ms)
4. Flame particle effect (200ms)
5. Card fades to ash (200ms)
6. Remove from DOM (total: 1000ms)

**CSS Implementation:**
```css
.card.incinerator-animation {
  animation: card-incinerate 1000ms ease-out forwards;
}

@keyframes card-incinerate {
  0% { transform: scale(1) rotate(0deg); opacity: 1; }
  20% { transform: scale(1.1) rotate(5deg); opacity: 1; filter: brightness(1.5); }
  50% { transform: scale(0.5) rotate(180deg); opacity: 0.8; }
  70% { transform: scale(0.2) rotate(360deg); opacity: 0.5; filter: blur(2px); }
  100% { transform: scale(0) rotate(720deg); opacity: 0; }
}
```

**Trigger Conditions:**
- Disposable cards used in or out of combat
- Exhaust cards after first use
- Cards discarded/destroyed by effects

### 17.9 TODO Items for Out-of-Combat Extension

**High Priority (Core Functionality):**
- [ ] Implement out-of-combat card targeting system (tile selection)
- [ ] Add resource validation before card use (check Energy, Ammo, Focus, Battery)
- [ ] Implement card usage on ground effect tiles (ignite oil, extinguish fire)
- [ ] Implement card usage on enemies (pre-combat actions, stealth takedowns)
- [ ] Add header action button for equipped item usage
- [ ] Implement "must be equipped to use" validation for inventory items
- [ ] Add card count display in hand fan (show disposable usage tracking)

**Medium Priority (UX/Visual):**
- [ ] Add visual selection indicators (transform, shadow, highlight)
- [ ] Implement valid/invalid target highlighting on grid
- [ ] Add range indicators for card targeting
- [ ] Implement incinerator animation for card disposal
- [ ] Add resource color coding to debrief feed (green/orange/red)
- [ ] Implement resource spend preview before card commit
- [ ] Add card lifecycle icons (disposable, exhaust, persistent, power, gated)

**Low Priority (Polish):**
- [ ] Add sound effects for card selection/usage/disposal
- [ ] Implement contextual help tooltips (card targeting, resource costs)
- [ ] Add undo/cancel for card selection before commit
- [ ] Implement card usage history in debrief feed
- [ ] Add achievement tracking for environmental card combos
- [ ] Create tutorial for out-of-combat card usage

### 17.10 Ground Effects Integration

**Required Ground Effects (from ground-effects.js):**

| Ground Type | Card Interaction | Effect |
|-------------|------------------|--------|
| **Oil (🛢️)** | CARD_012 (Lighter) | Ignite → Fire spread |
| **Fire (🔥)** | CARD_013 (Water Bottle) | Extinguish → Steam |
| **Water (💧)** | CARD_014 (Tazer Shot) | Electrify → Chain stun |
| **Industrial Waste (☢️)** | Specialized cleanup cards | Remove hazard |
| **Glass (✨)** | Movement cards | Trigger noise alert |
| **Soda Spill (🥤)** | Cleanup or lure cards | Remove sticky or distract |
| **Steam (💨)** | Time-based dissipation | Obscures vision |

**Out-of-Combat Ground Effect Setup:**
- Deploy Oil Slick card → Create oil tiles
- Deploy Water Bottle card → Create water puddle
- Deploy Lighter card → Create small fire or ignite existing oil
- Deploy Smoke Screen card → Create steam/smoke tiles

### 17.11 Test Coverage for Out-of-Combat Workflow

**Test File Created:** `/public/tests/test-hand-fan-out-of-combat.html`

**Test Suites Implemented:**
1. **Hand Fan Display Tests** - Component rendering, mode switching, card display
2. **Card Selection Indicator Tests** - Visual states, transform, shadow, highlight
3. **Card Usage & Resource Spending Tests** - Resource validation, deduction, multi-resource
4. **Equipped Item Usage Tests** - Header action button, equip requirement, consumption
5. **Debrief Feed Animation Tests** - Incinerator animation, card removal, timing
6. **Resource Color Coding Tests** - Percentage thresholds, color scheme, dynamic updates

**Test Runner:** `/public/tests/test-hand-fan-out-of-combat.js`

**Manual Testing Areas:**
- Visual test grid (10x10) with player, enemies, ground effects
- Mock resource bars (HP, Energy, Ammo) with dynamic updates
- Mock action button for equipped item testing
- Interactive card selection and targeting

---

**Document Version:** 1.1
**Last Updated:** 2026-02-19
**Status:** Complete gap analysis with STR out-of-combat extension and environmental action buttons
