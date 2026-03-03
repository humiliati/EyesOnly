# Unified Overhead Animation System - Roadmap

## Executive Summary

This document provides a **designer-facing roadmap** for unifying the two existing overhead animation systems in Eyes Only to prevent accidental creation of a third system. It establishes clear doctrine, guidelines, and implementation paths for all future overhead animations including collectibles, player interactions with environment objects (ropes, levers), and status effects.

---

## Current State Analysis

### Two Existing Systems

#### 1. **OverheadAnimator** (`public/js/overhead-animator.js`)
**Purpose**: Short-lived event notifications with text and visual feedback
**Duration**: 200ms - 2000ms (event-based)
**Display**: Text + glyph (e.g., "+3¢", "LOOT 🍎")
**Use Cases**: Currency pickups, food pickups, expressions, status effects
**Rendering**: Integrated in **both renderers** (canvas: lines 111-157 in gone-rogue-canvas.js; mobile: lines 828-868 in gone-rogue-mobile.js)

#### 2. **PancakeStack/PlayerStackManager** (`public/js/pancake-stack.js` + `player-stack-manager.js`)
**Purpose**: Persistent inventory tracking above player head
**Duration**: 4000ms (persistent feedback)
**Display**: Glyph only (e.g., "¢", "⁍", "◈")
**Use Cases**: Recently collected items (currency, ammo, battery, food, keys, cards)
**Rendering**: Integrated in **canvas renderer** (lines 534-546 in gone-rogue-canvas.js)

### Critical Issues

1. ~~**Rendering Parity Gap**~~ ✅ FIXED (Phase 1) — OverheadAnimator now integrated in both renderers

2. ~~**Naming Confusion**~~ ✅ FIXED (Phase 2) — `showPancakeStacks()` renamed to `showStackedText()`

3. **Visual Overlap**: Both systems render at similar Y positions (-20px to -50px range)
   - Items can overlap during animations
   - No coordination between systems

4. ~~**Dual System Overhead**: Every collectible triggers **both** systems~~ ✅ FIXED (v1.3 Architecture)
   - **New doctrine**: Single pickup = single OverheadAnimator animation only
   - PancakeStack activates only when multiple animations need simultaneous display (e.g., rope drag + currency + dialogue)
   - All `PancakeStack.addPancake()` calls removed from single-item pickup paths

5. **Risk of Third System**: Without clear doctrine, developers may create new overhead systems for:
   - Environment interaction feedback (lever pulled, rope climbed)
   - Tool usage feedback (lockpicking, hacking)
   - Crafting/combining items
   - Achievement/milestone notifications

---

## Design Philosophy & Doctrine

### When to Use Which System

| Use Case | System to Use | Rationale |
|----------|--------------|-----------|
| **Single collectible pickup** | **OverheadAnimator only** | Single pickup = single animation (v1.3 doctrine) |
| **Multiple simultaneous animations** | **OverheadAnimator + PancakeStack** | Rope drag + currency, speech + item drop |
| **Currency text feedback** | **OverheadAnimator** | Quick "+3¢" confirmation text |
| **NPC expressions** | **OverheadAnimator** | Emotional states, reactions |
| **Status effects** | **OverheadAnimator** | Burning 🔥, frozen ❄️, stunned 💫 |
| **Environment interactions** | **OverheadAnimator** | Lever pulled, door opened, rope climbed |
| **Tool usage** | **OverheadAnimator** | Lockpicking progress, hacking attempts |
| **Combat feedback** | **OverheadAnimator** | Critical hits, misses, dodges |
| **Achievements** | **OverheadAnimator** | Level up ⬆️, achievement 🏆 |

### Core Principles (v1.3 — Unified Architecture)

1. **Single Pickup = Single OverheadAnimator Animation**
   - A collectible pickup triggers ONE overhead animation only, at the exact moment of pickup
   - Uses `OverheadAnimator.showGenericExpression()` with explicit RESOURCE_COLOR
   - PancakeStack is NOT called for individual pickups

2. **PancakeStack = Multi-Animation Stacking Only**
   - PancakeStack activates only when multiple animations need simultaneous display
   - Example scenarios: rope drag + currency pickup, speech bubble + resource drop, NPC dialogue + quest item
   - Priority ordering: Speech > Rope > Currency when multiple animations coexist
   - 4-second lifetime with automatic decay

3. **OverheadAnimator Stacks Concurrent Animations**
   - `showGenericExpression()` now pushes to an array instead of overwriting when there's already an active animation at the same position
   - Rapid sequential pickups (ammo + currency on same tile) stack properly in the OverheadAnimator
   - The `update()` function already handles array-based expiration

4. **No Third System**
   - All future overhead animations use OverheadAnimator
   - Environment interactions, tools, achievements → OverheadAnimator
   - PancakeStack reserved exclusively for multi-source simultaneous display

---

## Unified Roadmap

### Phase 1: Fix Rendering Parity (Immediate - High Priority) ✅ DONE

**Goal**: Ensure consistent experience across mobile and canvas renderers

**Tasks**:
- [x] **Add OverheadAnimator integration to canvas renderer**
  - Location: `public/js/gone-rogue-canvas.js` around line 111
  - Calls `OverheadAnimator.update(currentTime)` in render loop
  - Calls `OverheadAnimator.getAllAnimations()` and converts to effects
  - Renders effects via `_renderEffects()` pipeline

- [x] **Test parity**
  - Currency "+3¢" text appears in both mobile and canvas ✅
  - Overhead expressions work in canvas (NPC reactions, status) ✅
  - Both PancakeStack and OverheadAnimator render correctly ✅

**Files Modified**:
- `public/js/gone-rogue-canvas.js`

**Expected Outcome**: ✅ Achieved — canvas players see same overhead animations as mobile players

---

### Phase 2: Fix Naming Confusion (Immediate - Low Risk) ✅ DONE

**Goal**: Rename misleading method to prevent developer confusion

**Tasks**:
- [x] **Rename `OverheadAnimator.showPancakeStacks()` → `showStackedText()`**
  - Renamed in `overhead-animator.js`
  - Call sites updated in `gone-rogue.js`
  - All documentation references updated

**Files Modified**:
- `public/js/overhead-animator.js`
- `public/js/gone-rogue.js`

**Expected Outcome**: ✅ Achieved — `showStackedText()` clearly distinguishes OverheadAnimator multi-line text from PancakeStack inventory glyphs

---

### Phase 3: Document Designer Guidelines (Short-term)

**Goal**: Create clear documentation preventing accidental third system

**Tasks**:
- [ ] **Create designer decision tree**
  - Flowchart: "Should I use OverheadAnimator or PancakeStack?"
  - Quick reference table for common use cases
  - Code examples for each scenario

- [ ] **Update COLLECTIBLES-VISUAL-SYSTEM.md**
  - Add "Choosing Between Systems" section
  - Add "Environment Interactions" guidelines
  - Add "DON'T create new overhead systems" warning

- [ ] **Create OVERHEAD-ANIMATION-GUIDE.md**
  - Step-by-step guide for adding new animations
  - Common patterns and anti-patterns
  - Integration examples (lever, rope, lockpicking)

**Files Created/Modified**:
- `OVERHEAD-ANIMATION-GUIDE.md` (new)
- `COLLECTIBLES-VISUAL-SYSTEM.md` (updated)

**Expected Outcome**:
- Designers and developers have clear guidance
- Reduced risk of creating duplicate systems

---

### Phase 4: Standardize Environment Interactions (Medium-term)

**Goal**: Establish patterns for non-collectible overhead feedback

**Tasks**:
- [ ] **Define environment interaction vocabulary**
  - Lever pulled: "LEVER" + ⚙️ emoji
  - Rope climbed: "CLIMB" + 🪢 emoji
  - Door opened: "OPEN" + 🚪 emoji
  - Lockpicking: Progress bar or lock emoji
  - Hacking: Terminal emoji or progress text

- [ ] **Create helper methods**
  - `OverheadAnimator.showInteraction(x, y, type)` wrapper
  - Standardized colors and durations per interaction type
  - Consistent visual language

- [ ] **Add to EXPRESSIONS vocabulary**
  - Update `overhead-animator.js` EXPRESSIONS object (lines 16-70)
  - Add LEVER, CLIMB, OPEN, LOCKED, UNLOCKED, etc.

**Files Modified**:
- `public/js/overhead-animator.js`

**Expected Outcome**:
- Consistent visual feedback for environment interactions
- Reusable patterns for all future game mechanics

---

### Phase 5: Optimize Visual Coordination (Long-term - Optional)

**Goal**: Reduce visual overlap between systems

**Tasks**:
- [ ] **Adjust Y positions to prevent overlap**
  - OverheadAnimator: Start at -60px (higher than current -20px)
  - PancakeStack: Keep at -48px (cellSize * 2.4)
  - Ensures text floats above stack glyphs

- [ ] **Add awareness between systems**
  - PancakeStack knows about active OverheadAnimator text
  - Shift stack position down temporarily when text is active
  - OR: Fade PancakeStack opacity during OverheadAnimator events

- [ ] **Consolidate update loops** (advanced)
  - Single `OverheadAnimationController` managing both systems
  - Unified render pipeline
  - Coordinated lifecycle management

**Files Modified**:
- `public/js/overhead-animator.js`
- `public/js/player-stack-manager.js`
- `public/js/gone-rogue-canvas.js`
- `public/js/gone-rogue-mobile.js`

**Expected Outcome**:
- No visual overlap between systems
- Cleaner, more professional appearance
- Potential performance improvements

---

## Implementation Priority

### Immediate (Week 1) — ✅ Complete
1. ✅ **Phase 1**: Canvas renderer parity — OverheadAnimator integrated in canvas renderer
2. ✅ **Phase 2**: `showPancakeStacks` renamed to `showStackedText`

### Short-term (Week 2-3)
3. **Phase 3**: Document designer guidelines
4. **Phase 4**: Standardize environment interactions

### Long-term (Month 2+)
5. **Phase 5**: Optimize visual coordination (OPTIONAL)

---

## Designer Quick Reference

### Decision Tree (v1.3)

```
Need overhead animation?
│
├─ Is it a single collectible pickup?
│  └─ YES → OverheadAnimator ONLY:
│           OverheadAnimator.showGenericExpression(x, y, glyph, duration, RESOURCE_COLOR)
│           ❌ Do NOT call PancakeStack.addPancake()
│
├─ Are multiple animations firing simultaneously? (rope + currency, speech + item drop)
│  └─ YES → OverheadAnimator stacks them automatically at the same position key.
│           PancakeStack may assist for persistent multi-source display.
│           Priority: Speech > Rope > Currency
│
├─ Is it currency with text ("+3¢")?
│  └─ YES → Use OverheadAnimator.showCurrencyPickup()
│           Example: OverheadAnimator.showCurrencyPickup(x, y, 3)
│
├─ Is it short-lived event feedback (<2s)?
│  └─ YES → Use OverheadAnimator.showExpression() or showGenericExpression()
│           Example: OverheadAnimator.showExpression(x, y, 'ALERT', 1000)
│
├─ Is it environment interaction (lever, rope, door)?
│  └─ YES → Use OverheadAnimator.showGenericExpression()
│           Example: OverheadAnimator.showGenericExpression(x, y, '⚙️', 800, '#FFAA00')
│
└─ Creating new type of persistent overhead display?
   └─ STOP! Use existing systems or discuss with team first
```

### Code Examples

#### Collectible Pickup — OverheadAnimator ONLY (v1.3 doctrine)
```javascript
// Currency — specialized method (OverheadAnimator only)
OverheadAnimator.showCurrencyPickup(_player.x, _player.y, amount);
// ❌ No PancakeStack.addPancake() — single pickup = single animation

// Ammo — magenta RESOURCE_COLOR
OverheadAnimator.showGenericExpression(x, y, '⁍', 800, '#DA70D6');
DebriefFeedController.reportResourceChange('Ammo', oldAmmo, newAmmo, 'Ammo +N');

// Battery — cyan-green RESOURCE_COLOR
OverheadAnimator.showGenericExpression(x, y, '◈', 800, '#00FFA6');
DebriefFeedController.reportResourceChange('Battery', oldBat, newBat, '◈ Battery +N');

// Food (health) — HP pink
OverheadAnimator.showGenericExpression(x, y, emoji, 1000, '#FF6B9D');
// Food (energy) — Electric blue
OverheadAnimator.showGenericExpression(x, y, emoji, 1000, '#00D4FF');
// Food (fatigue) — Earthy brown
OverheadAnimator.showGenericExpression(x, y, emoji, 1000, '#A0522D');
// Food (inert) — Light grey placeholder
OverheadAnimator.showGenericExpression(x, y, emoji, 1000, '#CCCCCC');
// Food reports EACH changed resource individually to debrief feed

// Card — Cards purple
OverheadAnimator.showGenericExpression(x, y, '🂠', 800, '#800080');
```

#### Environment Interaction (Lever Pulled)
```javascript
// Use OverheadAnimator for one-shot events
OverheadAnimator.showGenericExpression(lever.x, lever.y, '⚙️', 800, '#FFAA00');
```

#### NPC Reaction
```javascript
// Use OverheadAnimator expressions vocabulary
OverheadAnimator.showExpression(npc.x, npc.y, 'ALERT', 2000);
```

#### Status Effect
```javascript
// Use OverheadAnimator for temporary status
OverheadAnimator.showExpression(entity.x, entity.y, 'BURNING', 3000);
```

#### Tool Usage (Lockpicking)
```javascript
// Use OverheadAnimator with custom emoji/text
OverheadAnimator.showGenericExpression(door.x, door.y, '🔓', 500, '#00FF00');
```

---

## Anti-Patterns (DO NOT DO)

### ❌ Creating New Overhead System
```javascript
// BAD: Creating new system for rope climbing
const RopeAnimator = (function() {
  var _activeRopes = {};
  function showClimb(x, y) { ... }
  // This is a third system! Use OverheadAnimator instead!
})();
```

### ❌ Duplicating Animation Logic
```javascript
// BAD: Copying animation code into game logic
function showLeverPull(x, y) {
  var animation = {
    x: x,
    y: y,
    startTime: Date.now(),
    duration: 800,
    // ... duplicating OverheadAnimator logic
  };
  // Use OverheadAnimator.showGenericExpression() instead!
}
```

### ❌ Using PancakeStack for Events
```javascript
// BAD: Using PancakeStack for non-collectible feedback
PancakeStack.addPancake('⚙️'); // Lever pulled
// Use OverheadAnimator for events!
```

### ❌ Using OverheadAnimator for Inventory
```javascript
// BAD: Using OverheadAnimator for persistent inventory display
OverheadAnimator.showExpression(x, y, 'LOOT', 4000, '¢');
// Use PancakeStack for persistent tracking!
```

### ❌ Using showExpression('LOOT') for Resource Pickups
```javascript
// BAD: Uses LOOT expression which applies cyan #00FFFF
OverheadAnimator.showExpression(x, y, 'LOOT', 1000, item.emoji);
// Use showGenericExpression() with explicit RESOURCE_COLOR instead!
```

---

## Testing Checklist

### Phase 1 Verification ✅
- [x] Currency pickup shows "+3¢" text in canvas renderer
- [x] Currency pickup shows "¢" glyph in PancakeStack
- [x] NPC expressions visible in canvas (!, ?, 💤)
- [x] Status effects visible in canvas (🔥, ❄️, ⚡)
- [x] Food pickups show emoji in both mobile and canvas
- [x] No console errors during animations
- [x] Performance impact minimal (<5ms per frame)

### Phase 2 Verification ✅
- [x] Method renamed successfully — `showStackedText` replaces `showPancakeStacks`
- [x] Enemy loot summary still works (multi-line text display)
- [x] No breaking changes to existing functionality

### Visual Regression ✅
- [x] PancakeStack still renders correctly
- [x] Bobbing animation still works
- [x] 4-second decay still works
- [x] Ground shadow still renders
- [x] Newest item glow still works

---

---

## Collectibles Auto-Pickup Unification ✅ Done

**Context**: Before this work, gone-rogue's keyboard-hidden mobile interface had no way to collect most floor items. Only food and currency were auto-collected on walkover; ammo, gems/batteries, cards, and keys required typing `pickup`.

**Changes made** (see `COLLECTIBLES-BUG-FIX.md` for full detail):

1. **Food tap-handler fix** (`gone-rogue-mobile.js`): Tap handler now skips `process('interact')` for `autoPickup: true` items, letting smooth movement deliver the player to the tile.

2. **Ammo color fix** (`gone-rogue-mobile.js`): Ammo drops now render with correct `#DA70D6` magenta per `RESOURCE_COLOR_SYSTEM.md` — not cyan `#00FFFF`.

3. **Universal auto-pickup** (`gone-rogue.js`): Both `_checkPlayerInteractions` (smooth movement) and `_movePlayer` (command movement) now call `_pickupItem()` whenever any floor item is present at the player's position. This covers ammo, gem/battery (`◈` cyan symbol), cards, and all key tiers.

4. **`_pickupItem` key crash fix** (`gone-rogue.js`): Terminal MOK interjection and `return` statement now use guarded locals (`pickupEmoji`, `pickupDisplayName`, `pickupQuality`) that fall back gracefully for non-card items.

5. **Key tier routing** (`gone-rogue.js`, `tooltip-system.js`, `gamestate.js`, `debrief-feed-controller.js`): All three key tiers now route to distinct destinations — see key tier details below.

---

## RESOURCE_COLOR Unified Pipeline ✅ Done (2026-03-01)

**Context**: Collectible pickups were using `showExpression('LOOT')` which applied cyan `#00FFFF` — wrong for all resources. The debrief feed also lacked per-resource color flashing.

**Changes made** (see `docs/COLLECTIBLES_CANON.md` for authoritative reference):

1. **All overhead animations now use `showGenericExpression()` with explicit RESOURCE_COLOR** — NOT `showExpression('LOOT')`:
   - Currency: `showCurrencyPickup()` → `#FFFF00` (already working)
   - Ammo: `showGenericExpression(x, y, '⁍', 800, '#DA70D6')` — magenta
   - Battery: `showGenericExpression(x, y, '◈', 800, '#00FFA6')` — cyan-green
   - Food (health/status/special): `showGenericExpression(x, y, emoji, 1000, '#FF6B9D')` — HP pink
   - Food (energy category): `showGenericExpression(x, y, emoji, 1000, '#A0522D')` — Fatigue brown

2. **All resource pickups report to `DebriefFeedController.reportResourceChange()`** with RESOURCE_COLOR frame flash:
   - Ammo, Battery, HP, Fatigue, Currency each flash their own canonical color
   - Food reports **every changed resource individually** (HP, Fatigue, Ammo, Currency) — not just HP

3. **Enhanced `reportResourceChange()` in `debrief-feed-controller.js`**:
   - RESOURCE_COLORS lookup table for box-shadow frame flash
   - `.gaining`/`.losing` CSS class applied to `.resource-row[data-resource="X"]` elements

4. **All collectibles have tooltip reports**:
   - Ammo: `TooltipSystem.showAction('item-pickup', { name: 'Ammo +N' })`
   - Battery: `TooltipSystem.showAction('item-pickup', { name: '◈ Battery +N' })`
   - Food: `TooltipSystem.showGeneric(tooltipText, 2000)` — e.g., "+20 HP, -15 Fatigue"
   - Key Ammo: `TooltipSystem.showAction('key-ammo-pickup', { name })`
   - Key Items: `TooltipSystem.showAction('key-item-pickup', { name })`

> **Anti-pattern**: DO NOT use `showExpression('LOOT')` for any resource pickup. See `docs/COLLECTIBLES_CANON.md` Anti-Patterns section.

---

## Key Tier System ✅ Done

The key system has three tiers with distinct storage, tooltip, and overhead animation behavior:

### Tier 1 — key_ammo (Consumable Chest/Lock Keys)
- **Examples**: Rusty Key 🔑, Bronze Key 🗝️
- **Mechanics**: Used for chests and simple locks; consumed on use; thieving support
- **Storage**: Resource counter only — `GAMESTATE.addKeyCount(keyType, 1)`. NOT stored in inventory
- **Debrief feed**: `DebriefFeedController.reportResourceChange('key_ammo', old, new, name)` on every pickup; ammo row summary shows `🔑x{N}`; expanded panel shows `🔑 KEY AMMO Rusty:N`
- **Tooltip**: `TooltipSystem.showAction('key-ammo-pickup', { name })` → `'🔑 KEY AMMO: Rusty Key'`
- **MOK interjection**: `Key Ammo: {name}`
- **Quality label**: `[KEY AMMO]` in pickup log
- **Overhead anim**: Key Ammo orange (`#FF8A3D`) 🗝 expression, 800ms
- **PancakeStack**: None (v1.3 — single pickup = OverheadAnimator only)
- **`getTotalKeyAmmo()`**: Returns sum of all Tier 1 key counts (used for resource-change delta)

### Tier 2 — key_items (Persistent Door/Gate Keys)
- **Examples**: Security Keycard 💳, Master Key 🔐, Mall Tag 🏷️, Industrial Pass 🔧
- **Mechanics**: Unlock physical doors and gates; survive death; equip+toggle workflow
- **Storage**: `GAMESTATE.addToPersistent(nonCardPayload)` — persistent inventory
- **Auto-equip**: `GAMESTATE.setActiveItem()` + `UIControls.setActiveItem()` on pickup
- **Tooltip**: `TooltipSystem.showAction('key-item-pickup', { name })` → `'🔑 KEY ITEM: Security Keycard → INVENTORY'`; `TooltipSystem.show('🔑 KEY EQUIPPED — Tap header icon near the gate!', 2500)`
- **MOK interjection**: `Key Item: {name}`
- **Quality label**: `[KEY ITEM]` in pickup log
- **Overhead anim**: Gold (`#FFD700`) 🔑 expression, 1200ms
- **PancakeStack**: None (v1.3 — single pickup = OverheadAnimator only)

### Tier 3 — Quest Keys (NPC Turn-In Items)
- **Examples**: Blacksmith's Hammer 🔨, Rune Fragment 💎
- **Mechanics**: Persistent quest items for NPC turn-in (reward: card upgrade)
- **Storage**: `GAMESTATE.addToPersistent(nonCardPayload)` — persistent inventory
- **Tooltip**: `TooltipSystem.show('❗ QUEST ITEM — {name} — Return to {NPC}', 3500)`
- **MOK interjection**: `Key Item: {name}` (shares Tier 2 prefix — consider adding `Quest Item:` prefix in future work)
- **Overhead anim**: Red (`#FF4444`) ❗ expression, 1500ms
- **PancakeStack**: None (v1.3 — single pickup = OverheadAnimator only)
- **No debrief resource row**; **no auto-equip**

---

**Overhead animation behavior** (all tiers — v1.3):
- All key tiers trigger `OverheadAnimator.showGenericExpression` on pickup
- PancakeStack is NOT called for single pickups (v1.3 architecture change)
- Battery/gem always uses hardcoded `◈` — never `item.emoji` or `item.glyph`
- Weapon ammo uses hardcoded `⁍` with magenta color `#DA70D6`
- Concurrent animations at the same position now stack in an array (OverheadAnimator v1.3)

---

## PancakeStack Color Bleed Fix ✅ Done (2026-03-03)

**Context**: When both animation systems fired correctly per doctrine, PancakeStack glyphs for text characters (⁍, ◈, 🗝) rendered in green instead of white. This was the "green ammo symbol" bug — the player saw a correct magenta OverheadAnimator animation AND an incorrect green PancakeStack glyph simultaneously.

**Root Cause**: `PlayerStackManager.render()` never set `ctx.fillStyle` before calling `ctx.fillText()`. The canvas render pipeline calls `_renderPlayer()` immediately before `_renderPancakeStack()`. The player renderer sets `ctx.fillStyle = player.color || '#00FF00'` (green) and only resets `shadowBlur`, not `fillStyle`. PancakeStack then inherited the player's green color for all text glyphs. Color emoji (🍎, 🔑) were unaffected because the browser renders them as bitmaps regardless of `fillStyle`, but monochrome text characters (⁍, ◈, ¢) took the inherited green.

**Fix**: Added `ctx.fillStyle = '#FFFFFF'` before each `ctx.fillText()` call in `PlayerStackManager.render()`.

**Doctrine compliance**: Fix remains valid under v1.3 architecture — PancakeStack still renders when multiple animations coexist (multi-source stacking), and the white fillStyle prevents color bleed when it does render.

**Files Modified**:
- `public/js/player-stack-manager.js`

---

## ~~Tier 3 Quest Key PancakeStack Fix~~ ⚠️ Superseded by v1.3 Architecture

**Context**: Under v1.2 doctrine, all key tiers were supposed to add PancakeStack glyphs. Tier 3 was missing. This was fixed briefly but then **reversed** when the v1.3 architecture removed all PancakeStack calls from single-item pickup paths. The PancakeStack call added here was removed as part of Bug #10.

**Status**: No longer applicable — v1.3 doctrine says single pickup = single OverheadAnimator only.

---

## Tier 1 Key Color Correction ✅ Done (2026-03-03)

**Context**: This roadmap previously listed Tier 1 key_ammo overhead animation as Gold (`#FFD700`). This was a documentation error. The authoritative `RESOURCE_COLOR_SYSTEM.md` defines Key Ammo as Bright Orange `#FF8A3D`, the test suite (`test-resource-colors.js`) verifies this, and the code implementation uses `#FF8A3D`. The Tier 1 key_ammo color is orange to visually distinguish it from Tier 2 gate keys which use gold `#FFD700`.

**Fix**: Updated this document's Tier 1 entry from `#FFD700` to `#FF8A3D`.

**No code changes required** — code was already correct.

---

## Pickup System Extraction ✅ Done (2026-03-01)

**Context**: All pickup logic (ammo, gem/battery, card, key) was extracted from the gone-rogue.js monolith into a dedicated `PickupSystem` IIFE module (`public/js/pickup-system.js`). The monolith's `_pickupItem()` now delegates to `PickupSystem.pickupItem(ctx)`.

**Pickup pipeline per collectible type** (authoritative reference — v1.3: no PancakeStack for single pickups):

| Type | OverheadAnimator | DebriefFeed | Tooltip | MOK |
|------|-----------------|-------------|---------|-----|
| **Ammo** | `⁍` magenta `#DA70D6` 800ms | `reportResourceChange('Ammo', ...)` | `'Ammo +N'` | `⁍ Ammo +N` |
| **Battery** | `◈` cyan-green `#00FFA6` 800ms | `reportResourceChange('Battery', ...)` | `'◈ Battery +N'` | `◈ Battery +N` |
| **Food (health)** | emoji HP pink `#FF6B9D` 1000ms | Per-resource reports (HP, Fatigue, Ammo, Currency) | `'+20 HP, -15 Fatigue'` | tooltip text |
| **Food (energy)** | emoji Electric blue `#00D4FF` 1000ms | Per-resource reports | `'+Energy'` | tooltip text |
| **Food (fatigue)** | emoji Earthy brown `#A0522D` 1000ms | Per-resource reports | `'-25 Fatigue'` | tooltip text |
| **Food (inert)** | emoji Light grey `#CCCCCC` 1000ms | Per-resource reports (if any) | `'Cleanse'` / minor | tooltip text |
| **Card** | `🂠` Cards purple `#800080` 800ms | `reportResourceChange('Cards', ...)` | `card.name` | `Card: name` |
| **Key Ammo (T1)** | `🗝` orange `#FF8A3D` 800ms | `reportResourceChange('key_ammo', ...)` | `'🔑 KEY AMMO: name'` | `Key Ammo: name` |
| **Key Item (T2)** | `🔑` gold `#FFD700` 1200ms | — | `'🔑 KEY ITEM: name → INVENTORY'` | `Key Item: name` |
| **Quest Key (T3)** | `❗` red `#FF4444` 1500ms | — | `'❗ QUEST ITEM — name — Return to NPC'` | `Key Item: name` |

---

## RESOURCE_COLOR Canonical Palette

Authoritative source: `RESOURCE_COLOR_SYSTEM.md`

| Resource | Color Name | Hex Code | Used In |
|----------|-----------|----------|---------|
| **HP** | Vibrant Pink | `#FF6B9D` | Food (health) overhead, debrief flash |
| **Energy** | Electric Blue | `#00D4FF` | Food (energy) overhead, debrief flash |
| **Focus** | Bright Yellow-White | `#FFF9B0` | Debrief flash |
| **Battery** | Sickly Green-Cyan | `#00FFA6` | Gem overhead, floor render, debrief flash |
| **Fatigue** | Earthy Brown | `#A0522D` | Food (fatigue) overhead, debrief flash |
| **Inert** | Light Grey | `#CCCCCC` | Food (inert) overhead (placeholder) |
| **Ammo** | Magenta-Purple | `#DA70D6` | Ammo overhead, floor render, debrief flash |
| **Currency** | Yellow Gold | `#FFFF00` | Currency overhead, floor render, debrief flash |
| **Key Ammo** | Bright Orange | `#FF8A3D` | Tier 1 key overhead, debrief flash |
| **Cards** | Purple | `#800080` | Card overhead, floor render, debrief flash |

---

## File Reference

| File | Purpose | Priority |
|------|---------|----------|
| `public/js/overhead-animator.js` | OverheadAnimator core | Phase 1, 2, 4 |
| `public/js/gone-rogue-canvas.js` | Canvas renderer integration | Phase 1 |
| `public/js/gone-rogue-mobile.js` | Mobile renderer (reference) | Phase 1 |
| `public/js/pancake-stack.js` | PancakeStack wrapper | Phase 5 |
| `public/js/player-stack-manager.js` | PancakeStack core + render | Phase 5, Bug #8 |
| `public/js/pickup-system.js` | Unified pickup pipeline | All collectibles |
| `public/js/player-interaction-system.js` | Auto-pickup trigger (smooth movement) | Food pickup |
| `public/js/move-player-system.js` | Auto-pickup trigger (command movement) | Food pickup |
| `public/js/gone-rogue.js` | Monolith — delegates to PickupSystem | Phase 2 |
| `COLLECTIBLES-VISUAL-SYSTEM.md` | System documentation | Phase 3 |
| `OVERHEAD-ANIMATION-GUIDE.md` | Designer guide (new) | Phase 3 |

---

## Success Metrics

1. **Consistency**: Both mobile and canvas render same overhead animations
2. **Clarity**: Developers know exactly which system to use for new features
3. **Prevention**: No third overhead system created in next 6 months
4. **Performance**: No significant frame rate impact from unified system
5. **Designer Satisfaction**: Positive feedback on documentation clarity

---

## Appendix: Technical Comparison

### OverheadAnimator vs PancakeStack

| Aspect | OverheadAnimator | PancakeStack |
|--------|-----------------|--------------|
| **Position** | Starts -20px, floats to -50px | Fixed at -48px (cellSize * 2.4) |
| **Duration** | 200ms - 2000ms | 4000ms |
| **Animation** | Bounce/float up + fade | Bobbing + decay fade |
| **Spacing** | 12px vertical (tight) | 6px vertical (tighter) |
| **Display** | Text + glyph ("+3¢") | Glyph only ("¢") |
| **Color** | Explicit per-animation (RESOURCE_COLOR) | White `#FFFFFF` (fixed) |
| **Storage** | Position-based dict | Array with metadata |
| **Purpose** | Event notification | Inventory tracking |
| **Update** | On-demand | Every frame |
| **Glow** | None | Newest item only |
| **Shadow** | None | Single ellipse |
| **Canvas** | ✅ Integrated (Phase 1) | ✅ Integrated |
| **Mobile** | ✅ Integrated | ✅ Integrated |

### Architecture Differences

**OverheadAnimator**: Position-keyed dictionary
```javascript
_activeAnimations["x,y"] = { type, emoji, text, startTime, duration, color }
```

**PancakeStack**: Array-based stack
```javascript
_stack = [{ emoji, collectedAt, offsetX, offsetY, layer, bobPhase, bobSpeed, ... }]
```

---

## Appendix: Complete Bug Fix History

### Bugs Fixed in Collectibles System (chronological)

1. **Bug #1: Dual Currency Animation** — Green "¢" lingered after yellow "+3¢" animation (commit `f7858e7`)
2. **Bug #2: Food/Interactive Items Not Removed** — Items rendered from two arrays; deduplication added (commit `f7858e7`)
3. **Bug #3: Food Tap-Handler Persistence** — Tapping food triggered `interact` instead of movement (commit `afcf229`)
4. **Bug #4: Ammo Drops Rendered Cyan** — Missing `type === 'ammo'` branch in renderer (commit `afcf229`)
5. **Bug #5: Floor Items Not Auto-Collected** — Ammo/gem/card/key required `pickup` command (commit `611ccc4`)
6. **Bug #6: Key Tier Routing** — All tiers treated identically; Tier 1 keys incorrectly in inventory (commit `d41e807`)
7. **Bug #7: Food Overhead Color Wrong** — `_movePlayer` path used LOOT cyan; energy foods showed HP pink; debrief only reported HP (2026-03-01)
8. **Bug #8: PancakeStack Green Glyph Bleed** — `PlayerStackManager.render()` inherited player's green `#00FF00` fillStyle for text characters (2026-03-03)
9. **Bug #9: Tier 3 Quest Key Missing PancakeStack** — Doctrine requires all key tiers add PancakeStack glyph; Tier 3 handler was missing the call (2026-03-03)

### Documentation Corrections (2026-03-03)
- **Tier 1 key color**: Corrected from `#FFD700` (gold) to `#FF8A3D` (orange) per `RESOURCE_COLOR_SYSTEM.md` canon
- **Appendix table**: Added "Color" row distinguishing OverheadAnimator (per-animation RESOURCE_COLOR) from PancakeStack (fixed white)
- **Decision tree**: Updated to show both systems fire for collectibles
- **Pickup pipeline table**: Added authoritative per-type reference with all five feedback channels

10. **Bug #10: Unified Architecture — PancakeStack Removal from Single Pickups** (2026-03-03)
    - **Old doctrine**: Every collectible triggered both OverheadAnimator AND PancakeStack
    - **New doctrine (v1.3)**: Single pickup = single OverheadAnimator animation only. PancakeStack reserved for multi-source simultaneous display.
    - **Removed `PancakeStack.addPancake()` from**: `pickup-system.js` (ammo, gem, card, all 3 key tiers), `player-interaction-system.js` (food), `move-player-system.js` (food), `currency-spawning.js` (ammo-from-currency)
    - **Enhanced `showGenericExpression()`**: Now pushes to array instead of overwriting when animation already exists at same position key. Supports rapid sequential pickups stacking.
    - **`PlayerStackManager.render()` fillStyle fix preserved**: White `#FFFFFF` fillStyle still applied (Bug #8 fix remains valid)

---

## Contact & Feedback

If you're implementing a new game mechanic and unsure which system to use:
1. Check the decision tree above
2. Review code examples above
3. If still unclear, flag for team discussion before implementing

**Remember**: When in doubt, use OverheadAnimator. Only use PancakeStack for persistent item tracking.

---

---

## Canonical Tooltip Pipeline — Single Tooltip Per Pickup (v1.4)

### Doctrine

**Every collectible pickup fires exactly ONE `TooltipSystem.show()` or `TooltipSystem.showAction()` call.** No exceptions.

The MOK interjection field (`#mok-interject-body`) is updated exclusively through TooltipSystem. Direct `UIControls.updateMokInterjection()` calls from pickup paths are prohibited — they route through `TooltipSystem.showPersistent()` which double-fires the history log.

### Separation of Concerns

| System | Responsibility | Fires MOK tooltip? |
|--------|---------------|-------------------|
| **TooltipSystem.show/showAction** | Updates MOK interjection text + adds to history | YES — this is the ONE canonical fire |
| **OverheadAnimator** | Visual emoji animation above player head | No |
| **DebriefFeedController.reportResourceChange** | Debrief frame flash + row highlight | No (MOK removed in v1.4) |
| **UIControls.updateMokInterjection** | Routes to TooltipSystem.showPersistent | Only for non-pickup contexts (inventory, discovery) |

### Per-Pickup Canonical Tooltip Source

| Pickup Type | File | Canonical Call | Message Format |
|-------------|------|---------------|----------------|
| **Currency** | player-interaction-system.js / move-player-system.js | `TooltipSystem.showAction('currency-pickup', {amount})` | "💰 COLLECTED X CRYPTOS" |
| **Ammo** | pickup-system.js `_pickupAmmo` | `TooltipSystem.showAction('item-pickup', {name})` | "📦 PICKED UP ⁍ Ammo +X" |
| **Battery (Gem)** | pickup-system.js `_pickupGem` | `TooltipSystem.showAction('item-pickup', {name})` | "📦 PICKED UP ◈ Battery +X" |
| **Food** | player-interaction-system.js / move-player-system.js | `TooltipSystem.show(tooltipText, 2500)` | Food's tooltipText or "emoji name consumed" |
| **Card** | pickup-system.js `_showPickupTooltip` | `TooltipSystem.showAction('card-pickup', {name})` | "🃏 PICKED UP cardName" |
| **Key Tier 1** | pickup-system.js `_handleKeyPickupEnhancements` | `TooltipSystem.showAction('key-ammo-pickup', {name})` | "🔑 KEY AMMO: keyName" |
| **Key Tier 2** | pickup-system.js `_handleKeyPickupEnhancements` | `TooltipSystem.show('🔑 KEY EQUIPPED — ...')` | "🔑 KEY EQUIPPED — Tap header..." |
| **Key Tier 3** | pickup-system.js `_handleKeyPickupEnhancements` | `TooltipSystem.show('❗ QUEST ITEM — ...')` | "❗ QUEST ITEM — name — Return to NPC" |
| **Generic Item** | pickup-system.js `_showPickupTooltip` | `TooltipSystem.showAction('item-pickup', {name})` | "📦 PICKED UP itemName" |

### What NOT To Do (Anti-patterns)

```javascript
// ❌ WRONG — fires second tooltip via TooltipSystem.showPersistent internally
UIControls.updateMokInterjection('Ammo +3');
TooltipSystem.showAction('item-pickup', { name: 'Ammo +3' });

// ❌ WRONG — reportResourceChange used to fire MOK internally (fixed in v1.4)
DebriefFeedController.reportResourceChange('Ammo', 5, 8, 'Ammo +3');
UIControls.updateMokInterjection('Ammo +3');

// ✅ CORRECT — one tooltip, debrief handles its own flash silently
TooltipSystem.showAction('item-pickup', { name: '⁍ Ammo +3' });
DebriefFeedController.reportResourceChange('Ammo', 5, 8, 'Ammo +3');
```

### Adding New Collectible Types

When adding a new collectible pickup:
1. Add ONE `TooltipSystem.show()` or `TooltipSystem.showAction()` call
2. Add ONE `OverheadAnimator.showGenericExpression()` call with correct RESOURCE_COLOR
3. Optionally add `DebriefFeedController.reportResourceChange()` for debrief flash (NO MOK)
4. Do NOT call `UIControls.updateMokInterjection()` — the tooltip call handles MOK
5. Add an entry to the Per-Pickup Canonical Tooltip Source table above

---

**Document Version**: 1.4
**Last Updated**: 2026-03-03
**Status**: Draft → Review → Implementation
**Architecture**: v1.4 — Single pickup = single OverheadAnimator animation + single TooltipSystem call; PancakeStack for multi-source stacking only
**Canon Reference**: See `docs/COLLECTIBLES_CANON.md` for authoritative collectible category definitions and unified pickup pipeline
