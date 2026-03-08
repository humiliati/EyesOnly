# Card Database Import Gap Analysis & TODO

## Overview

This document provides a comprehensive gap analysis between:
- **Existing Implementation**: Current cards.json with 55 cards
- **Technical Specification**: Metal Gear Solid-inspired card system design

---

## 🔥 Recent Updates (2026-03-07)

### ✅ Resource Economy Pass — COMPLETE

**31 of 55 cards now have resource costs** (up from 9). Resource types used:

| Resource | Cards Gated | Color | Symbol |
|----------|------------|-------|--------|
| **Battery** | 17 cards | Sickly Green `#00FFA6` | ◈ |
| **Ammo** | 9 cards | Magenta `#DA70D6` | ⁍ |
| **Focus** | 5 cards | Yellow-White `#FFF9B0` | ◎ |

**6 cards now restore resources:**
- ACT-001 Field Dressing: +1 focus (calm bandaging)
- ACT-050 Smoke Screen Waltz: +1 focus (hiding is calming)
- ACT-051 Gentleman's Feint: +1 focus (elegant composure)
- ACT-053 Dry Martini: +2 focus (calming drink)
- ACT-054 Field Stitch Kit: +1 focus (calm patching)
- ACT-071 Grounding Wire: +1 battery (scavenges power)

**24 cards remain free (no resource cost):**
- ACT-000 BLVCK (always free — the struggle card)
- ACT-001 Field Dressing (basic heal, always accessible)
- ACT-010 Smoke Bomb Mk0 (starter flee — fatigue is the cost via effects)
- ACT-012 Cyanide Capsule (HP self-damage is the cost)
- ACT-020 Fumbled Grab (consolation card)
- ACT-021 Stolen Technique (theft reward)
- ACT-999 Cardboard Box (stealth entry)
- ACT-041 Water Splash (improvised, no ammo needed)
- ACT-043 Quick Strike (melee, no resource)
- ACT-045 Molotov (improvised bottle)
- ACT-047 Venom Shiv (melee poison)
- ACT-050 Smoke Screen Waltz (covert movement)
- ACT-051 Gentleman's Feint (skill-based)
- ACT-053 Dry Martini (luxury heal — free because it GIVES focus)
- ACT-054 Field Stitch Kit (basic heal)
- ACT-056 Venom Ring (poison ring, no resource)
- ACT-058 Exploding Cufflink (premium disposable — consumed is the cost)
- ACT-059 Violin Wire (melee execute)
- ACT-062 Jab (free melee fallback)
- ACT-063 Haymaker (heavy melee)
- ACT-067 Pipe Bomb (improvised explosive)
- ACT-071 Grounding Wire (gives battery)
- ACT-105 Solar Flare Step (consumes lumens)
- ACT-106 Smoke Bomb (basic smoke)

### ✅ Unaffordable Card UI — COMPLETE

- Cards with costs the player can't afford now render with **BLVCK-frame treatment**: darkened background, greyed emoji, muted name — while preserving their identity (emoji + name stay visible)
- CSS class `.hand-card-unaffordable` in `hand-fan-component.css`
- `shared-card-renderer.js` checks `CardStateAuthority.canAffordCard()` during render

### ✅ BLVCK Stranded Injection — VERIFIED WORKING

- `CardStateAuthority.checkBlvckState()` already handles the full lifecycle:
  - All cards unaffordable → BLVCK injects at slot 0, last card pushed to backup
  - Player regains resources → BLVCK auto-removes
- Now also triggered after:
  - Cost spending in `card-play-system.js` (spending ammo may strand you)
  - Resource restoration effects (gaining focus may un-strand you)

### ✅ Insufficient Resource Feedback — COMPLETE

- `card-play-system.js` now logs "🚫 Card Name — insufficient resources" to combat log
- Shows overhead expression "⚠️ No ammo/battery/focus"
- Dispatches `rogue-card-unaffordable` event for UI systems
- `card-drag-controller.js` no longer consumes card on failed play (card returns to hand)

### ✅ Resource Restoration Effect Handler — COMPLETE

- New effect type `resource_restore` in `card-play-system.js`
- Supports: focus, battery, ammo, energy via GAMESTATE API
- Uses resource symbols from RESOURCE_COLOR_SYSTEM (◎, ◈, ⁍, △)
- Triggers BLVCK re-eval after restoring (may un-strand player)

---

## Executive Summary

### ✅ What Exists and Aligns
- Quality/rarity system (9 tiers vs 4 in spec, but compatible)
- Card priority system (5 priorities for STR combat)
- Basic fatigue and ammo tracking
- Consumable card concept
- Card generation with affixes
- **Resource cost system (ammo, battery, focus gating) — NOW COMPLETE**
- **Resource restoration effects — NOW COMPLETE**
- **BLVCK stranded-state injection — NOW COMPLETE**
- **Unaffordable card visual treatment — NOW COMPLETE**

### ⚠️ What Exists but Needs Extension
- Card lifecycle types (partial implementation)
- Status effects (framework in card-play-system, no tick system yet)

### ❌ What's Missing Entirely
- Stability resource (hidden RNG modifier)
- Power cards (activated once, persist entire combat)
- Multi-combat cooldown system
- Environmental tile system (oil, water, fire)
- 12-slot bonfire inventory system
- 5-slot action bar system
- Status effect tick/display system

---

## 1. Resource System Status

| Resource | Implementation | Cards Using | Status |
|----------|---------------|-------------|--------|
| **Ammo** | ✅ GAMESTATE.getAmmo/addAmmo | 9 cards (costs) | ✅ COMPLETE |
| **Battery** | ✅ GAMESTATE.getBattery/rechargeBattery | 17 cards (costs), 1 restore | ✅ COMPLETE |
| **Focus** | ✅ GAMESTATE.getFocus/addFocus | 5 cards (costs), 5 restore | ✅ COMPLETE |
| **Energy** | ✅ GAMESTATE.getEnergy/addEnergy | 0 cards (costs) | ⚠️ API exists, no cards use it yet |
| **Fatigue** | ✅ 0-100 scale in gamestate.js | Via effects, not costs | ✅ WORKING |
| **Stability** | ❌ Not implemented | None | ❌ MISSING |

---

## Files Modified (2026-03-07 Resource Economy Pass)

1. **`public/data/gone-rogue/cards.json`** — 22 cards gained `costs` arrays, 6 gained `resource_restore` effects
2. **`public/js/card-play-system.js`** — Added `resource_restore` effect handler, added BLVCK re-eval after cost spending, added insufficient-resource UI feedback
3. **`public/js/shared-card-renderer.js`** — Added `.hand-card-unaffordable` class for cards player can't afford
4. **`public/css/hand-fan-component.css`** — Added BLVCK-frame styling for unaffordable cards
5. **`public/js/card-drag-controller.js`** — Fixed: check play result before consuming card
6. **`public/index.html`** — Cache-busted card-play-system, shared-card-renderer, hand-fan-component CSS

---

## Remaining TODO (Priority Order)

### HIGH
- [ ] Energy resource: add costs to appropriate cards (no cards currently use energy costs)
- [ ] Status effect tick system: burn/poison/bleed/stun tick per turn
- [ ] Power card lifecycle type (activated once, persists combat)
- [ ] Biome-specific card drop pools

### MEDIUM
- [ ] Multi-combat cooldown system
- [ ] Card instance tracking (unique IDs per card copy)
- [ ] Resource warning UI when low (< 2 of any resource)
- [ ] Card hover shows cost vs. current resources
- [ ] Environmental tile system (oil/water/fire/electric)

### LOW
- [ ] Stability resource (hidden RNG modifier)
- [ ] Lifecycle distribution validation (45-55% disposable target)
- [ ] Planning phase timer (2-3 second constraint)
- [ ] Biome progression rarity scaling
- [ ] Card economy tracking for balance telemetry
