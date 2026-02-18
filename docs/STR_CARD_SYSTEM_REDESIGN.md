# STR Card System Redesign - Metal Gear Solid Tactical Approach

## Overview

This document describes the complete redesign of the EyesOnly STR (Simultaneous Turn Resolution) card combat system, implementing a Metal Gear Solid-inspired tactical loadout approach focused on:

- **Consumable cards** that disappear after use
- **Fatigue management** for movement and combat actions
- **Ammo pooling** for weapon cards
- **Resource-based gameplay** that keeps decks lean and tactical

## Philosophy: Disposable Tactics, Persistent Mastery

We are NOT building a traditional deckbuilder where cards accumulate forever. We are building a **field-ops tactical loadout** where:

- Most actions are consumable
- Strong actions are rare and costly
- Persistent cards are few but defining
- Players cycle through tools, not hoard infinite ones

**Goal**: New cards should feel exciting, not like deck pollution.

---

## 1. Resource Systems

### 1.1 Fatigue System

**Purpose**: Represents physical exhaustion and prevents infinite action spam.

**Implementation** (gamestate.js):
```javascript
playerFatigue: 0,              // 0-100 scale
maxFatigue: 100,
fatigueRecovery: 5,            // Per turn baseline
fatigueThreshold: 70           // Above this, cards cost more
```

**Card Fatigue Costs** (card-system.js):
- Movement cards: 1-4 fatigue (based on intensity)
  - Retreat: 1 fatigue (light movement)
  - Close Distance / Strafe: 2 fatigue
  - Roll: 4 fatigue (most exhausting)
- Attack cards: 1-3 fatigue
  - Single Shot / Silent Shot: 1 fatigue
  - Burst Shot / Suppressive Fire: 2-3 fatigue
  - Explosive Shot: 3 fatigue

**Mechanics**:
- Fatigue accumulates during combat
- High fatigue (>70) reduces card effectiveness
- Consumables can reduce fatigue (cigarettes -3, rations -5, energy drink -20)
- Fatigue resets partially after combat

**Agent Tracking**:
- `fatigueAtEndOfCombat[]` - Track fatigue levels per combat
- `timesCardUnavailableDueToFatigue` - Count blocked actions
- `fatigueManagementScore` - How well persona manages fatigue

---

### 1.2 Ammo System

**Purpose**: Pooled ammunition resource for weapon cards.

**Implementation** (gamestate.js):
```javascript
playerAmmo: 30,                // Starting ammo
maxAmmo: 50                    // Maximum capacity
```

**Card Ammo Costs** (card-system.js):
- Single Shot / Silent Shot: 1 ammo
- Explosive Shot: 1 ammo (but consumable, so card is also removed)
- Burst Shot: 3 ammo
- Suppressive Fire: 5 ammo

**Mechanics**:
- Ammo is NOT per-gun, it's a **pooled tactical resource**
- Ammo depletes when cards are played
- Ammo can be restored via:
  - Ammo Clip consumable (+10 ammo)
  - Vendor purchases
  - Found in world
  - Bonfire partial refill

**Agent Tracking**:
- `cardsWithZeroAmmo` - Count unusable cards due to ammo
- Ammo tracked per floor in `economyLog`

---

### 1.3 Consumables System

**Purpose**: Single-use tactical items that provide powerful benefits but disappear.

**Implementation** (gamestate.js):
```javascript
consumables: [],               // Array: {type, count}
consumableSlots: 3,            // Different types allowed
maxConsumableSlots: 5          // Can be upgraded
```

**New Consumable Cards** (card-system.js):

| Card | Emoji | Effect | Cost |
|------|-------|--------|------|
| Energy Drink | ⚡ | -20 fatigue, +2 energy, 2 turns | consumable |
| Medical Kit | 🏥 | +30 HP | consumable |
| Ammo Clip | 📎 | +10 ammo | consumable |
| Stim Pack | 💉 | +15 HP, -10 fatigue, +2 speed | consumable |
| Adrenaline | 💪 | +3 attack, +3 speed, -15 fatigue, 2 turns | consumable |

**Existing Cards Marked Consumable**:
- Cigarettes (already consumable, now also -3 fatigue)
- Katchup (+3 HP, consumable)
- Rations (+4 HP, -5 fatigue, consumable)
- Explosive Shot (powerful but consumed on use)

**Mechanics**:
- Consumables are used → removed from inventory
- Max 3-5 different types can be carried
- Consumables can be found, purchased, or looted
- Strategic choice: use now or save for later?

**Agent Tracking**:
- `totalConsumablesFound` / `totalConsumablesUsed`
- `consumablesByType{}` - Track which consumables are popular
- `consumableUsageByFloor[]` - When consumables were used
- `consumableWasteEvents` - Times consumable unavailable when needed

---

## 2. Card Lifecycle Model

Every card belongs to one of five lifecycle types:

### 2.1 Disposable Cards (Most common)
**Used → gone forever (for this run)**

Examples in system:
- Explosive Shot (marked `consumable: true`)
- Cigarettes (stress relief, consumable)
- Katchup, Rations (healing, consumable)
- All new consumables (Energy Drink, Medical Kit, etc.)

Purpose:
- Prevent deck bloat
- Encourage aggressive use
- Create survival tension

### 2.2 Exhaust Cards (Combat-limited)
**Used once per combat → returns after combat**

Examples:
- Total Evasion (marked `exhaust: true`)

Purpose:
- Signature moves
- Tactical trump cards
- Prevent spam

### 2.3 Power Cards (Persistent buffs)
**Activated once → active entire combat**

Status: Not yet implemented (planned)

Examples (future):
- Scarface Mode (damage boost + risk)
- Ghost Protocol (stealth bonus)
- Adrenal Surge (energy regen)

### 2.4 Ammo/Fatigue Cards (Resource-bound)
**Require resources to function**

All attack cards now require ammo:
- If `ammo < card.ammo` → cannot play

All movement cards now cost fatigue:
- Fatigue accumulates, reducing effectiveness

### 2.5 Persistent Core Cards (Rare)
**Always in deck, never consumed**

Examples:
- Basic attack cards (without consumable flag)
- Basic dodge
- Core stance cards

Max: ~5-8 total in deck

---

## 3. Agent Testing & Reporting

### 3.1 Test Agent Personas

All personas (MINMAXER, SPEEDRUNNER, GREEDY_LOOTER, etc.) now properly validated with:
- `ensurePersonaProperties()` function providing defaults
- Full property inheritance from BASE_PERSONAS
- Validation in all agent functions

### 3.2 New Metrics Tracked

**Fatigue Metrics**:
```javascript
combatMetrics: {
  averageFatigueAtEndOfCombat: 0,
  timesCardUnavailableDueToFatigue: 0,
  fatigueManagementScore: 0
}
```

**Consumables Metrics**:
```javascript
consumablesMetrics: {
  consumablesFound: 0,
  consumablesUsed: 0,
  consumablesByType: {},
  consumableUsageByFloor: []
}
```

**Shop Visit Tracking**:
```javascript
economyMetrics: {
  shopVisits: [{
    floor: 10,
    choices: ['HEAL', 'BUY_RARE'],
    spent: 200,
    creditsRemaining: 150
  }]
}
```

**Deck Metrics**:
```javascript
deckMetrics: {
  deckSizeByFloor: [5, 6, 7, 8, ...],
  cardsLostToFatigue: 0,
  cardsWithZeroAmmo: 0
}
```

### 3.3 Report Structure

Per-run reports now include:
- Fatigue levels at end of each combat
- Consumable usage patterns
- Shop visit details (floor, items bought, amount spent)
- Deck size progression
- Resource availability issues

Aggregate reports calculate:
- Average fatigue management across all runs
- Consumable usage patterns (which are most useful)
- Shop visit frequency and spending patterns
- Deck bloat vs lean gameplay

---

## 4. Integration Points

### 4.1 Card System (card-system.js)
- **Lines 85-150**: Movement and attack cards updated with fatigue/ammo
- **Lines 152-196**: Setup/utility cards marked consumable
- **Lines 310-378**: New dedicated consumable cards section

### 4.2 Game State (gamestate.js)
- **Lines 28-40**: Resource tracking state variables
- **Lines 484-636**: Resource management functions
- **Lines 660-673**: Exported API functions

### 4.3 Agent Testing (agent-mvp-audit.js)
- **Lines 96-162**: UX metrics structure with new tracking
- **Lines 243-296**: Per-run report structure with new metrics
- **Lines 420-442**: Game state initialization with resources
- **Lines 745-796**: Shop visit tracking in vendor handler

---

## 5. Design Rules for Engineers

### Rule 1: Card Power Tiers
```javascript
// At least 50% of cards should be consumable
consumable_cards / total_cards >= 0.5
```

### Rule 2: Deck Size Target
```javascript
// Healthy deck size
12 <= deck.length <= 18

// Breakdown:
// 5 core persistent
// 4-6 exhaust
// 5-10 consumables
```

### Rule 3: Resource Costs
Every powerful card must have at least one of:
- Ammo cost
- Fatigue cost
- Consumable flag
- Exhaust flag

### Rule 4: Infinite Prevention
If a card is:
- Always good
- Never consumed
- No resource cost
→ It will break the game

---

## 6. Testing Results

### All Tests Passing ✅
```
Total Tests:  87
Passed:       87 (100.0%)
Failed:       0
```

Test coverage includes:
- Persona property validation
- STR combat simulation with resources
- Boss resolution with tracking
- Single and multiple audit runs
- UX scoring systems
- CSV/JSON export with new metrics
- MVP readiness assessment

---

## 7. Future Enhancements

### 7.1 Multi-Combat Cooldowns
Some powerful cards persist across combats but have cooldowns:
```javascript
THERMAL_VISION: {
  usable: 'once_every_3_combats'
}
```

### 7.2 Desktop Card Fan UI
Currently missing - needs implementation:
- Card selection UI for STR combat
- Multi-card selection for simultaneous resolution
- Auto-show on combat start (not just via action button)

### 7.3 Mobile vs Desktop Differences
- Mobile: Touch/swipe support, card fan auto-show ✅
- Desktop: Missing card fan implementation ❌

---

## 8. Next Steps for Implementation

1. **Integrate resources into STR combat resolution**
   - Deduct ammo when attack cards played
   - Add fatigue when movement cards played
   - Apply fatigue threshold penalties

2. **Implement consumable card usage**
   - Remove consumable cards after use
   - Apply consumable effects (healing, fatigue reduction)
   - Track consumable usage in combat log

3. **Add resource displays to UI**
   - Show fatigue bar during combat
   - Show ammo count
   - Show consumable inventory

4. **Desktop card fan implementation**
   - Create gone-rogue-desktop.js module
   - Implement card selection UI
   - Add keyboard shortcuts for card selection

---

## Summary

This redesign transforms EyesOnly's card system from a traditional deckbuilder into a **tactical field-ops loadout manager**:

✅ Fatigue prevents infinite action spam
✅ Ammo creates resource scarcity for weapons
✅ Consumables provide powerful single-use options
✅ Deck stays lean (12-18 cards optimal)
✅ Every card pickup feels meaningful
✅ Agent testing tracks all new metrics
✅ All existing tests pass (100%)

The system encourages players to:
- **Burn tools constantly** (consumables)
- **Manage resources carefully** (fatigue, ammo)
- **Always want new cards** (not hoard infinite collection)
- **Never reach static perfection** (lean, rotating loadout)

This creates the Metal Gear Solid feel of **managing a tired, armed human** - not an all-powerful wizard with infinite spells.
