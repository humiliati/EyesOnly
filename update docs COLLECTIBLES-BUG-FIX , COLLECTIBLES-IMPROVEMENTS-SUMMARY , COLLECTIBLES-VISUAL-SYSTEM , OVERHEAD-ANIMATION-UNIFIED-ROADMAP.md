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
**Rendering**: Integrated in **mobile renderer only** (lines 828-868 in gone-rogue-mobile.js)

#### 2. **PancakeStack/PlayerStackManager** (`public/js/pancake-stack.js` + `player-stack-manager.js`)
**Purpose**: Persistent inventory tracking above player head
**Duration**: 4000ms (persistent feedback)
**Display**: Glyph only (e.g., "¢", "؋", "◈")
**Use Cases**: Recently collected items (currency, ammo, battery, food, keys, cards)
**Rendering**: Integrated in **canvas renderer** (lines 534-546 in gone-rogue-canvas.js)

### Critical Issues

1. **Rendering Parity Gap**: OverheadAnimator is **NOT integrated in canvas renderer**
   - Mobile players see "+3¢" text overhead
   - Canvas players see only PancakeStack glyph
   - Inconsistent player experience across platforms

2. **Naming Confusion**: `OverheadAnimator.showPancakeStacks()` is **NOT** related to PancakeStack system
   - Misleading method name causes developer confusion
   - Should be renamed to `showStackedText()` or `showMultilineText()`

3. **Visual Overlap**: Both systems render at similar Y positions (-20px to -50px range)
   - Items can overlap during animations
   - No coordination between systems

4. **Dual System Overhead**: Every collectible triggers **both** systems
   - `OverheadAnimator.showCurrencyPickup()` → "+3¢" text bounce
   - `PancakeStack.addPancake('¢')` → Glyph stack
   - Redundant visual feedback

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
| **Collectible pickups** | **PancakeStack** (primary) | Persistent tracking, inventory awareness |
| **Currency text feedback** | **OverheadAnimator** (optional) | Quick "+3¢" confirmation text |
| **NPC expressions** | **OverheadAnimator** | Emotional states, reactions |
| **Status effects** | **OverheadAnimator** | Burning 🔥, frozen ❄️, stunned 💫 |
| **Environment interactions** | **OverheadAnimator** | Lever pulled, door opened, rope climbed |
| **Tool usage** | **OverheadAnimator** | Lockpicking progress, hacking attempts |
| **Combat feedback** | **OverheadAnimator** | Critical hits, misses, dodges |
| **Achievements** | **OverheadAnimator** | Level up ⬆️, achievement 🏆 |

### Core Principles

1. **One System for Persistent Feedback** (PancakeStack)
   - Use for items that should remain visible for player inventory awareness
   - 4-second lifetime allows players to track recent pickups during combat
   - Automatic decay prevents clutter

2. **One System for Event Notifications** (OverheadAnimator)
   - Use for transient events that need immediate feedback but not persistence
   - Text + emoji for clarity
   - Short durations (200ms - 2s) keep display clean

3. **Systems Work Together**
   - Collectibles trigger **both** systems (by design)
   - OverheadAnimator shows "what happened" ("+3¢")
   - PancakeStack shows "what you have" ("¢" in stack)

4. **No Third System**
   - All future overhead animations use OverheadAnimator
   - Environment interactions, tools, achievements → OverheadAnimator
   - Only exception: inventory-style persistent tracking → PancakeStack

---

## Unified Roadmap

### Phase 1: Fix Rendering Parity (Immediate - High Priority)

**Goal**: Ensure consistent experience across mobile and canvas renderers

**Tasks**:
- [ ] **Add OverheadAnimator integration to canvas renderer**
  - Location: `public/js/gone-rogue-canvas.js` around line 111
  - Copy integration pattern from mobile renderer (lines 828-868)
  - Call `OverheadAnimator.update(currentTime)` in render loop
  - Call `OverheadAnimator.getAllAnimations()` and convert to effects
  - Render effects via `_renderEffects()` pipeline

- [ ] **Test parity**
  - Verify "+3¢" text appears in both mobile and canvas
  - Verify overhead expressions work in canvas (NPC reactions, status)
  - Verify both PancakeStack and OverheadAnimator render correctly

**Files Modified**:
- `public/js/gone-rogue-canvas.js`

**Expected Outcome**:
- Canvas players see same overhead animations as mobile players
- Both PancakeStack glyphs and OverheadAnimator text visible

---

### Phase 2: Fix Naming Confusion (Immediate - Low Risk)

**Goal**: Rename misleading method to prevent developer confusion

**Tasks**:
- [ ] **Rename `OverheadAnimator.showPancakeStacks()`**
  - New name: `showStackedText()` or `showMultilineText()`
  - Update method name in `overhead-animator.js` (line 207)
  - Update call sites in `gone-rogue.js` (lines 7711-7717)
  - Update any documentation references

**Files Modified**:
- `public/js/overhead-animator.js`
- `public/js/gone-rogue.js`

**Expected Outcome**:
- Clear distinction between OverheadAnimator methods and PancakeStack system
- Reduced developer confusion

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

### Immediate (Week 1)
1. ✅ **Phase 1**: Fix canvas renderer parity (HIGH PRIORITY)
2. ✅ **Phase 2**: Rename confusing method (LOW RISK)

### Short-term (Week 2-3)
3. **Phase 3**: Document designer guidelines
4. **Phase 4**: Standardize environment interactions

### Long-term (Month 2+)
5. **Phase 5**: Optimize visual coordination (OPTIONAL)

---

## Designer Quick Reference

### Decision Tree

```
Need overhead animation?
│
├─ Is it a collectible item that goes in inventory?
│  └─ YES → Use PancakeStack.addPancake(glyph)
│           Example: PancakeStack.addPancake('¢')
│
├─ Is it short-lived event feedback (<2s)?
│  └─ YES → Use OverheadAnimator.showExpression() or showGenericExpression()
│           Example: OverheadAnimator.showExpression(x, y, 'ALERT', 1000)
│
├─ Is it currency with text ("+3¢")?
│  └─ YES → Use OverheadAnimator.showCurrencyPickup()
│           Example: OverheadAnimator.showCurrencyPickup(x, y, 3)
│
├─ Is it environment interaction (lever, rope, door)?
│  └─ YES → Use OverheadAnimator.showGenericExpression()
│           Example: OverheadAnimator.showGenericExpression(x, y, '⚙️', 800, '#FFAA00')
│
└─ Creating new type of persistent overhead display?
   └─ STOP! Use existing systems or discuss with team first
```

### Code Examples

#### Collectible Pickup (Currency, Ammo, Battery)
```javascript
// Always trigger BOTH systems for collectibles
OverheadAnimator.showCurrencyPickup(_player.x, _player.y, amount);
PancakeStack.addPancake('¢');
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

---

## Testing Checklist

### Phase 1 Verification
- [ ] Currency pickup shows "+3¢" text in canvas renderer
- [ ] Currency pickup shows "¢" glyph in PancakeStack
- [ ] NPC expressions visible in canvas (!, ?, 💤)
- [ ] Status effects visible in canvas (🔥, ❄️, ⚡)
- [ ] Food pickups show emoji in both mobile and canvas
- [ ] No console errors during animations
- [ ] Performance impact minimal (<5ms per frame)

### Phase 2 Verification
- [ ] Method renamed successfully (no references to old name)
- [ ] Enemy loot summary still works (multi-line text display)
- [ ] No breaking changes to existing functionality

### Visual Regression
- [ ] PancakeStack still renders correctly
- [ ] Bobbing animation still works
- [ ] 4-second decay still works
- [ ] Ground shadow still renders
- [ ] Newest item glow still works

---

## File Reference

| File | Purpose | Priority |
|------|---------|----------|
| `public/js/overhead-animator.js` | OverheadAnimator core | Phase 1, 2, 4 |
| `public/js/gone-rogue-canvas.js` | Canvas renderer integration | Phase 1 |
| `public/js/gone-rogue-mobile.js` | Mobile renderer (reference) | Phase 1 |
| `public/js/pancake-stack.js` | PancakeStack wrapper | Phase 5 |
| `public/js/player-stack-manager.js` | PancakeStack core | Phase 5 |
| `public/js/gone-rogue.js` | Collectible pickup calls | Phase 2 |
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
| **Storage** | Position-based dict | Array with metadata |
| **Purpose** | Event notification | Inventory tracking |
| **Update** | On-demand | Every frame |
| **Glow** | None | Newest item only |
| **Shadow** | None | Single ellipse |
| **Canvas** | **MISSING** | ✅ Integrated |
| **Mobile** | ✅ Integrated | Via effects array |

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

## Contact & Feedback

If you're implementing a new game mechanic and unsure which system to use:
1. Check the decision tree (page 7)
2. Review code examples (page 8)
3. If still unclear, flag for team discussion before implementing

**Remember**: When in doubt, use OverheadAnimator. Only use PancakeStack for persistent item tracking.

---

**Document Version**: 1.0
**Last Updated**: 2026-02-28
**Status**: Draft → Review → Implementation
