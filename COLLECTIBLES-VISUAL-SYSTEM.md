# Collectibles Visual System Documentation

## Overview

This document defines the visual representation rules for all collectible items in the game, ensuring consistency and clarity for players.

## Visual Representation Rules

### Emoji Collectibles (Use Emoji Characters)

These collectible types use emoji for clear, recognizable visual representation:

1. **Food Items** (🍎 🍞 🍖 🍕 🍰 etc.)
   - All food items use their corresponding emoji
   - Examples: Apple 🍎, Bread 🍞, Meat 🍖
   - Database: `food-database.js` FOOD_ITEMS (also referenced via `expression-database.js`)
   - Rendered via: InteractiveItems system
   - **Auto-pickup**: Food items with `autoPickup: true` are collected automatically when the player walks onto the tile — no `interact` command needed

2. **Key Items — Tier 2: Gate/Door Keys** (💳 🔐 🏷️ 🔧 💾 🎫 🔑 🗝️)
   - Persistent door and gate keys that survive death
   - Examples: Security Keycard 💳, Master Key 🔐, Mall Security Tag 🏷️, Industrial Pass 🔧, Thumb Drive 💾, Access Card 🎫
   - Auto-equip to active slot on pickup
   - **Storage**: Persistent inventory (`GAMESTATE.addToPersistent()`)
   - **Tooltip**: `🔑 KEY ITEM: {name} → INVENTORY`
   - **Quality label**: `[KEY ITEM]`
   - Color: `#FFD700` (gold) — overhead animation tint via `showGenericExpression`

3. **Key Ammo — Tier 1: Consumable Chest/Lock Keys** (🔑 🗝️)
   - Consumable keys for chests and simple locks; used in thieving mechanics
   - Examples: Rusty Key 🔑 (KEY_002), Bronze Key 🗝️ (KEY_004)
   - Color: `#FFD700` (gold) — overhead animation tint via `showGenericExpression`
   - `consumeOnUse: true` — consumed when a chest/lock is opened
   - **Storage**: Resource counter in debrief feed (`GAMESTATE.addKeyCount()` + `getTotalKeyAmmo()`), NOT inventory
   - **Tooltip**: `🔑 KEY AMMO: {name}`
   - **Quality label**: `[KEY AMMO]`
   - **Debrief feed**: Ammo row summary shows `🔑x{N}`; expanded panel shows `🔑 KEY AMMO Rusty:N` / `🗝️ KEY AMMO Bronze:N`
   - Triggers `DebriefFeedController.reportResourceChange('key_ammo', old, new, keyName)`

4. **Quest Keys — Tier 3** (❗ 🔨 💎)
   - Quest items for NPC turn-in (reward: card upgrade)
   - Examples: Blacksmith's Hammer 🔨, Rune Fragment 💎
   - **Storage**: Persistent inventory (`GAMESTATE.addToPersistent()`)
   - **Tooltip**: `❗ QUEST ITEM — {name} — Return to {NPC}` (via `TooltipSystem.show()`, 3500ms)
   - No auto-equip; no debrief resource row

5. **Card Drops** (🃏 🎴)
   - Playing cards and special cards
   - Card backs, card faces
   - Color: varies by card type

### Monochrome ASCII Collectibles (Use ASCII + Resource Colors)

These collectible types use ASCII characters with specific resource colors for efficiency and clarity:

1. **Currency** (¢)
   - Glyph: `¢` (U+00A2, cent sign)
   - Color: `#FFFF00` (yellow) per RESOURCE_COLORS
   - No emoji - ASCII only
   - Spawned by: `_spawnCurrency()` in gone-rogue.js
   - Example: +3¢ pickup animation

2. **Ammo** (؋)
   - Glyph: `؋` (U+060B, Afghani sign)
   - Color: `#DA70D6` (magenta/orchid) per RESOURCE_COLORS
   - No emoji - ASCII only
   - Represents **weapon ammunition** pickups (NOT battery)
   - Background: `#2a0a2a` (dark magenta)
   - Dropped from breakables with 60% chance
   - Type: `'ammo'`, adds to ammo counter via `GAMESTATE.addAmmo()`
   - **Auto-pickup**: Collected automatically when player walks onto tile via `_pickupItem()`

3. **Battery/Energy** (◈ battery cell - cyan ASCII glyph)
   - **Glyph**: `◈` (U+25C8, white diamond containing black small diamond)
   - **Color**: `#00FFA6` (cyan-green) per RESOURCE_COLORS
   - **Type**: `'gem'` (item type that recharges battery)
   - **Purpose**: Recharges battery resource for tech cards
   - **Collection**: Gem pickup calls `GAMESTATE.rechargeBattery(amount)`
   - **Consumption**: `GAMESTATE.useBattery(amount)`
   - **Drop Rate**: 15% from breakables
   - **Visual**: ASCII monochrome (NO emoji) with cyan color
   - **Name**: "Battery Cell" (was "Energy Gem")
   - **Animation**: Triggers debrief feed battery signal recharge pulse ((( )))
   - **Overhead animation**: Always uses hardcoded `◈` cyan symbol — never `item.emoji` or `item.glyph`
   - **Auto-pickup**: Collected automatically when player walks onto tile via `_pickupItem()`
   - **Important**: Battery is a separate resource from Ammo
   - Battery is consumed by tech cards (EMP Blast, System Crash, Chain Lightning)
   - Ammo is consumed by weapon attacks

4. **HP/Health**
   - Glyph: ♥ or +
   - Color: `#FF6B9D` (vibrant pink) per RESOURCE_COLORS
   - Health restoration pickups

5. **Focus**
   - Glyph: ◉ or ⊙
   - Color: `#FFF9B0` (bright yellow-white) per RESOURCE_COLORS
   - Focus point pickups

6. **Other Resources**
   - Use appropriate ASCII glyphs
   - Follow RESOURCE_COLORS system colors
   - No emoji unless specifically designed as such

## Resource Color System

From `docs/RESOURCE_COLOR_SYSTEM.md`:

```javascript
RESOURCE_COLORS = {
  'HP': '#FF6B9D',         // Vibrant Pink
  'Energy': '#00D4FF',      // Electric Blue — UI-only (energy bar); no floor collectible uses this color
  'Focus': '#FFF9B0',       // Bright Yellow-White
  'Battery': '#00FFA6',     // Cyan-Green
  'Fatigue': '#A0522D',     // Earthy Brown
  'Ammo': '#DA70D6'         // Magenta-Purple
}
```

## Important Distinction: Battery vs Ammo

**These are TWO SEPARATE resources with different collectibles:**

### Ammo (Weapon Ammunition)
- **Collectible**: ASCII glyph `؋` with magenta color `#DA70D6`
- **Resource Type**: `'ammo'`
- **Purpose**: Used for weapon attacks
- **Collection**: `GAMESTATE.addAmmo(amount)`
- **Consumption**: `GAMESTATE.useAmmo(amount)`
- **Drop Rate**: 60% from breakables
- **Visual**: Monochrome ASCII (no emoji)

### Battery (Tech Resource)
- **Collectible**: Battery Cell glyph `◈` with cyan-green color `#00FFA6`
- **Resource Type**: `'gem'` (item type that recharges battery)
- **Purpose**: Used for tech cards (EMP Blast, System Crash, Chain Lightning, etc.)
- **Collection**: Battery cell pickup calls `GAMESTATE.rechargeBattery(amount)`
- **Consumption**: `GAMESTATE.useBattery(amount)`
- **Drop Rate**: 15% from breakables
- **Visual**: ASCII monochrome `◈` with cyan color (NO emoji)
- **Debrief Feed**: Triggers battery signal recharge pulse animation ((( )))

**Note**: Battery cells are now consistent with currency (¢) and ammo (؋) as ASCII monochrome collectibles.

## Implementation Files

### Currency (ASCII Monochrome)
- **File**: `public/js/gone-rogue.js`
- **Function**: `_spawnCurrency(x, y, amount)` (line 4967)
- **Glyph**: `¢`
- **Color**: `#FFFF00`
- **Rendering**: `gone-rogue-mobile.js` lines 723-738

### Ammo (ASCII Monochrome)
- **File**: `public/js/gone-rogue-mobile.js`
- **Rendering**: `WorldItems.getAllForRendering()` loop — `type === 'ammo'` branch
- **Glyph**: `؋`
- **Color**: `#DA70D6`
- **Background**: `#2a0a2a`
- **Auto-pickup**: `_checkPlayerInteractions` and `_movePlayer` call `_pickupItem()` on any floor item

### Battery Recharge / Battery Cells (ASCII Monochrome)
- **File**: `public/js/gone-rogue.js`
- **Spawn**: Lines 9269-9280, 9345-9356 (from breakables, 15% chance)
- **Pickup**: Lines 6018-6062 (calls `GAMESTATE.rechargeBattery()`)
- **Glyph**: `◈`
- **Type**: `'gem'`
- **Color**: `#00FFA6` (cyan-green from RESOURCE_COLORS)
- **Rendering**: `gone-rogue-mobile.js` lines 743-770 (cyan ASCII glyph)
- **UI Feedback**: Shows "◈ Battery +X" message
- **Debrief Integration**: Triggers `DebriefFeedController.triggerBatteryRecharge()`
- **Animation**: Battery signal pulse ((( ))) in debrief feed

### Food (Emoji)
- **File**: `public/js/food-database.js`
- **Database**: FOOD_ITEMS
- **System**: InteractiveItems module — items with `autoPickup: true`
- **Auto-pickup**: Player walking onto tile triggers `_checkPlayerInteractions` → food removed + LOOT animation
- **Tap behavior**: Tapping a food tile initiates movement (does NOT call `interact`); item collected on arrival
- **Examples**:
  - Apple: 🍎
  - Pineapple: 🍍
  - Bread: 🍞
  - Meat: 🍖

### Key Ammo — Tier 1 (Consumable Chest Keys)
- **Defined in**: `public/js/environmental-synergy.js` — `KEY_ITEMS.RUSTY_KEY`, `KEY_ITEMS.BRONZE_KEY`
- **Tier**: 1 (`consumeOnUse: true`)
- **Key IDs**: `KEY_002` (Rusty Key 🔑), `KEY_004` (Bronze Key 🗝️)
- **Compatible gates**: `WOODEN_GATE`, `OLD_DOOR`, `BRONZE_GATE`, `MUSEUM_DOOR`
- **Storage**: `GAMESTATE.addKeyCount(keyType, 1)` — resource counter, NOT inventory
- **Debrief feed**: `DebriefFeedController.reportResourceChange('key_ammo', oldTotal, newTotal, keyName)` on every pickup
- **Tooltip action**: `TooltipSystem.showAction('key-ammo-pickup', { name: keyName })`
- **MOK interjection**: `Key Ammo: {name}`
- **Quality label**: `[KEY AMMO]`
- **Overhead animation**: Gold expression `item.emoji || '🔑'` via `OverheadAnimator.showGenericExpression` (800ms)
- **PancakeStack**: Adds `item.emoji || '🔑'`

### Key Items — Tier 2 (Persistent Door/Gate Keys)
- **Defined in**: `public/js/environmental-synergy.js` — `KEY_ITEMS.KEYCARD`, `KEY_ITEMS.MASTER_KEY`, etc.
- **Tier**: 2 (`consumeOnUse: false`)
- **Registry IDs**: `ITM-011` through `ITM-016`
- **Compatible gates**: `SECURITY_DOOR`, `LAB_ENTRANCE`, `FLOOR_ELEVATOR`, `MALL_GATE`, `FACTORY_GATE`, etc.
- **Storage**: `GAMESTATE.addToPersistent(nonCardPayload)` — persistent inventory, survives death
- **Auto-equip**: `GAMESTATE.setActiveItem()` / `UIControls.setActiveItem()` on pickup
- **Tooltip action**: `TooltipSystem.showAction('key-item-pickup', { name: keyName })`
- **Tooltip show**: `TooltipSystem.show('🔑 KEY EQUIPPED — Tap header icon near the gate!', 2500)`
- **MOK interjection**: `Key Item: {name}`
- **Quality label**: `[KEY ITEM]`
- **Overhead animation**: Gold expression `item.emoji || '🔑'` via `OverheadAnimator.showGenericExpression` (1200ms)
- **PancakeStack**: Adds `item.emoji || '🔑'`

### Quest Keys — Tier 3 (NPC Turn-In)
- **Defined in**: `public/js/environmental-synergy.js` — `KEY_ITEMS.BLACKSMITH_HAMMER`, `KEY_ITEMS.RUNE_FRAGMENT`
- **Tier**: 3 (`consumeOnUse: true` for turn-in)
- **Registry IDs**: `ITM-030`, `ITM-031`
- **Storage**: `GAMESTATE.addToPersistent(nonCardPayload)` — persistent inventory
- **Tooltip show**: `TooltipSystem.show('❗ QUEST ITEM — {name} — Return to {NPC}', 3500)`
- **MOK interjection**: `Key Item: {name}` (shares Tier 2 prefix — consider adding `Quest Item:` prefix in future work)
- **Overhead animation**: Red `❗` via `OverheadAnimator.showGenericExpression` (1500ms, `#FF4444`)

## Universal Auto-Pickup Doctrine

**All collectibles in gone-rogue are automatically collected when the player walks, runs, taps, drags, or otherwise moves onto their tile. No typing is ever required.**

| Collectible | Type | Auto-Pickup Path |
|-------------|------|-----------------|
| Currency (¢) | `currency` | `_checkPlayerInteractions` / `_movePlayer` direct logic |
| Ammo (؋) | `item` / `ammo` | `_checkPlayerInteractions` / `_movePlayer` → `_pickupItem()` |
| Battery (◈) | `item` / `gem` | `_checkPlayerInteractions` / `_movePlayer` → `_pickupItem()` |
| Card (🃏) | `item` / card | `_checkPlayerInteractions` / `_movePlayer` → `_pickupItem()` |
| Key Ammo 🔑 (Tier 1) | `item` / `key` / tier 1 | `_checkPlayerInteractions` / `_movePlayer` → `_pickupItem()` → resource counter + debrief feed |
| Key Item 💳 (Tier 2) | `item` / `key` / tier 2 | `_checkPlayerInteractions` / `_movePlayer` → `_pickupItem()` → persistent inventory |
| Quest Key ❗ (Tier 3) | `item` / `key` / tier 3 | `_checkPlayerInteractions` / `_movePlayer` → `_pickupItem()` → persistent inventory |
| Food (🍎) | `interactive` / `FOOD` | `_checkPlayerInteractions` / `_movePlayer` → food auto-pickup block |

The `_pickupItem()` function is the single implementation for all non-currency, non-food floor items. Both movement code paths (`_checkPlayerInteractions` for smooth movement and `_movePlayer` for command movement) call it whenever any floor item is present at the player's position.

## Animation System

### Overhead Pickup Animations
- **File**: `public/js/overhead-animator.js`
- **Currency**: Shows "+X¢" with bounce animation (lines 113-143)
- **Food**: Shows food emoji with float animation
- **Stacking**: Multiple pickups stack vertically above player (lines 207-230)

### Rendering Rules
1. **No twinkle/pulse effects** on ground items (removed to prevent rendering bugs)
2. **Solid rendering** at full opacity for clarity
3. **Enemy glow** only applies to enemies, not collectibles
4. **Drop shadows** on all ground entities for depth

## Pancake Stacker System

The **Pancake Stacker** is a Z-axis visual feedback system that displays collected items stacked vertically above the player's head. It provides immediate, persistent visual confirmation of recent pickups.

### Architecture

The system uses a two-layer architecture:

1. **PancakeStack** (`public/js/pancake-stack.js`) - Thin wrapper singleton
   - Provides public API: `addPancake()`, `update()`, `render()`, `getStackCount()`, `clearStack()`
   - Delegates to PlayerStackManager for all operations
   - Maintains backward compatibility

2. **PlayerStackManager** (`public/js/player-stack-manager.js`) - Core implementation
   - Singleton managing the stack array and lifecycle
   - Handles animations, decay, rendering
   - Contains all business logic

### Visual Behavior

#### Stacking Mechanics
- **Maximum Height**: 12 items
- **Position**: Items render at `screenY - (cellSize * 2.4)` above player head
- **Spacing**: 6px vertical spacing between stacked items (`pancakeHeight = 6`)
- **Overflow**: Oldest items are removed when stack exceeds max height

#### Animations

1. **Pickup Animation** (200ms ease-out-back)
   - Items scale from 0 to 1 with elastic bounce
   - Easing formula: `1 + 2.7 * (progress - 1)^3 + 1.7 * (progress - 1)^2`

2. **Bobbing Animation** (continuous)
   - Sine wave vertical oscillation: `sin((now / 1000) * bobSpeed + bobPhase) * 1.5`
   - Each item has randomized `bobSpeed` (1.5-2.5) and `bobPhase` (0-2π)
   - Creates organic, non-synchronized movement

3. **Decay Animation** (4 seconds total)
   - Items automatically fade and drop off after 4000ms
   - Fade-in: 300ms on new pickup
   - Fade-out: Last 600ms before removal
   - Ground shadow opacity tied to lifecycle

#### Visual Effects

- **Glow Effect**: Newest item (top of stack) has amber glow
  - Shadow color: `rgba(255,180,80,0.6)`
  - Shadow blur: 6px

- **Ground Shadow**: Single ellipse shadow for entire stack
  - Base opacity: 0.35
  - Fades in/out with stack lifecycle
  - Position: `screenY + cellSize * 0.28`
  - Size: `cellSize * 0.38` (width) × `cellSize * 0.13` (height)

- **Wobble**: Slight horizontal offset per item
  - Offset: `sin(layer * 1.2) * 2`
  - Creates natural stacking variation

- **Rotation**: Subtle rotation per item
  - Rotation: `sin(layer * 0.5) * 0.1` radians

### Integration with Collectibles

All collectible types integrate with the pancake stacker through `PancakeStack.addPancake()` calls:

#### Currency (ASCII Monochrome)
```javascript
// gone-rogue.js:5063-5066
if (typeof PancakeStack !== 'undefined' && PancakeStack.addPancake) {
  PancakeStack.addPancake('¢');
}
```

#### Ammo (ASCII Monochrome)
```javascript
// gone-rogue.js:6004-6007
if (typeof PancakeStack !== 'undefined' && PancakeStack.addPancake) {
  PancakeStack.addPancake('؋');
}
```

#### Battery (ASCII Monochrome - Cyan Glyph)
```javascript
// gone-rogue.js:6043-6046
if (typeof PancakeStack !== 'undefined' && PancakeStack.addPancake) {
  PancakeStack.addPancake('◈');
}
```

#### Food Items (Emoji)
```javascript
// gone-rogue.js:5572-5575
if (typeof PancakeStack !== 'undefined' && PancakeStack.addPancake) {
  PancakeStack.addPancake(result.emoji || '🍎');
}
```

#### Keys (Emoji) — Tier 1 & 2
```javascript
// gone-rogue.js — Tier 1 (key_ammo) and Tier 2 (key_item) both add to PancakeStack:
if (typeof PancakeStack !== 'undefined' && PancakeStack.addPancake) {
  PancakeStack.addPancake(item.emoji || '🔑');
}
// Tier 2 additionally auto-equips to active slot; Tier 1 additionally calls reportResourceChange
```

#### Card Drops (Emoji)
```javascript
// gone-rogue.js:6180-6183
if (typeof PancakeStack !== 'undefined' && PancakeStack.addPancake) {
  PancakeStack.addPancake(cardEmoji);
}
```

### Stack Item Structure

Each item in the stack is represented as:

```javascript
{
  emoji: '¢',                    // Glyph or emoji character
  collectedAt: Date.now(),       // Timestamp for decay calculation
  offsetX: 0,                    // Horizontal wobble offset
  offsetY: 0,                    // Vertical bobbing offset
  layer: 0,                      // Z-index (0 = bottom, higher = top)
  bobPhase: 3.14,                // Sine wave phase offset
  bobSpeed: 2.1,                 // Bobbing frequency multiplier
  currentScale: 1.0,             // Current scale (for pickup animation)
  rotation: 0.05                 // Rotation in radians
}
```

### Rendering Pipeline

1. **Canvas Native Renderer** (`gone-rogue-canvas.js`)
   - Calls `PlayerStackManager.render(ctx, screenX, screenY, cellSize, skipShadows)`
   - Renders stack above player sprite

2. **Mobile Renderer** (`gone-rogue-mobile.js`)
   - Also uses `PlayerStackManager.render()` for consistency
   - Same visual behavior across all platforms

3. **Update Loop**
   - Game loop calls `PlayerStackManager.update(now)` each frame
   - Updates bobbing animations
   - Removes expired items (> 4 seconds old)
   - Re-indexes layer values after decay

### Usage Pattern

Standard pattern for adding items to the stack:

```javascript
// Check for PancakeStack wrapper first (preferred)
if (typeof PancakeStack !== 'undefined' && PancakeStack.addPancake) {
  PancakeStack.addPancake(glyphOrEmoji);
}
// Fallback to PlayerStackManager directly
else if (typeof PlayerStackManager !== 'undefined' && PlayerStackManager.addPancake) {
  PlayerStackManager.addPancake(glyphOrEmoji);
}
```

### Configuration

Key constants in `player-stack-manager.js`:

```javascript
var _maxStackHeight = 12;     // Maximum items in stack
var _wobbleIntensity = 2;     // Horizontal wobble magnitude
var _decayMs = 4000;          // Item lifetime (4 seconds)
var pancakeHeight = 6;        // Vertical spacing between items
var baseY = screenY - (cellSize * 2.4);  // Base position above player
```

### Benefits of Pancake Stacker

1. **Immediate Feedback**: Players see what they collected instantly
2. **Persistence**: Items remain visible for 4 seconds (unlike 800ms overhead animations)
3. **Stack Visualization**: Multiple rapid pickups create satisfying visual "tower"
4. **Resource Awareness**: Glyphs match resource colors (¢ yellow, ؋ magenta, ◈ cyan)
5. **Combat Context**: Helps players track ammo/battery pickups during fights
6. **Universal Support**: Works with all collectible types (emoji + ASCII monochrome)

### Pancake Stacker vs Overhead Animator

| Feature | Pancake Stacker | Overhead Animator |
|---------|----------------|-------------------|
| **Duration** | 4 seconds | 800ms |
| **Animation** | Bobbing + decay | Bounce/float up |
| **Purpose** | Persistent tracking | Immediate feedback |
| **Stacking** | Vertical tower | 12px vertical spacing |
| **Display** | Character/glyph only | Text + glyph (e.g., "+3¢") |
| **Lifecycle** | Automatic decay | One-shot animation |
| **Canvas Support** | ✅ Fully integrated | ✅ Fully integrated (as of 2026-02-28) |
| **Mobile Support** | ✅ Via effects array | ✅ Fully integrated |

**Both systems work together**: Overhead Animator shows pickup event, Pancake Stacker provides ongoing awareness.

**Important**: For unified overhead animation guidance and preventing creation of third animation systems, see `OVERHEAD-ANIMATION-UNIFIED-ROADMAP.md`.

### Unified Overhead Animation Doctrine

To prevent accidental creation of duplicate animation systems:

1. **Use PancakeStack for**: Collectible items that need persistent tracking (4s lifetime)
   - Currency, weapon ammo, battery, food, key_ammo, key_items, cards
   - Items that should appear in visual inventory above player head

2. **Use OverheadAnimator for**: All other temporary overhead feedback (<2s lifetime)
   - Event notifications ("+3¢" text)
   - NPC expressions and reactions
   - Status effects (🔥, ❄️, ⚡)
   - Environment interactions (lever pulled, door opened)
   - Combat feedback (critical hits, misses)
   - Tool usage (lockpicking, hacking)

3. **Do NOT create new overhead animation systems**
   - Extend OverheadAnimator for new use cases
   - See `OVERHEAD-ANIMATION-UNIFIED-ROADMAP.md` for implementation guide

**Quick Reference**: When implementing new game mechanics (ropes, levers, tools), always use `OverheadAnimator.showGenericExpression()` for overhead feedback rather than creating a new animation system.

## Testing

### Visual Test
Run: `public/tests/test-collectibles-dual-render-bug.html`

### Verification Script
Run: `node public/tests/verify-collectibles-fix.js`

### Manual Testing Checklist
- [x] Currency shows yellow ¢ (not green, not emoji)
- [x] Currency pickup shows "+X¢" overhead animation
- [x] No lingering currency glyphs after pickup
- [x] Ammo shows magenta ؋ (not cyan)
- [x] Ammo auto-collects when player walks over it
- [x] Battery animates with ◈ cyan symbol (not item emoji)
- [x] Battery auto-collects when player walks over it
- [x] Food items show correct emoji and disappear on walkover
- [x] Tapping a food tile moves player to tile (does not trigger `interact`)
- [x] Card drops auto-collect when player walks over them
- [x] Key Ammo (Tier 1): tooltip shows `🔑 KEY AMMO: {name}`, quality label `[KEY AMMO]`
- [x] Key Ammo (Tier 1): debrief ammo row summary shows `🔑x{N}`
- [x] Key Ammo (Tier 1): `reportResourceChange('key_ammo', ...)` fires on pickup
- [x] Key Ammo (Tier 1): does NOT appear in loose or persistent inventory
- [x] Key Item (Tier 2): tooltip shows `🔑 KEY ITEM: {name} → INVENTORY`, quality label `[KEY ITEM]`
- [x] Key Item (Tier 2): auto-equips to active slot + shows equipped tooltip
- [x] Key Item (Tier 2): appears in persistent inventory (survives death)
- [x] Quest Key (Tier 3): shows `❗ QUEST ITEM — {name} — Return to {NPC}` tooltip (3500ms)
- [x] Multiple pickups stack tightly above player
- [x] No alpha/twinkle effects on ground items

## Migration Guide

### Converting Emoji to ASCII Monochrome

If you need to convert a collectible from emoji to ASCII:

1. Choose appropriate ASCII glyph from Unicode
2. Assign resource color from RESOURCE_COLORS
3. Update spawning function (e.g., `_spawnCurrency`)
4. Update rendering in `gone-rogue-mobile.js`
5. Update tests

Example:
```javascript
// Before (emoji)
{ emoji: '💰', color: '#FFD700' }

// After (ASCII monochrome)
{ glyph: '¢', color: '#FFFF00' }
```

## Common Issues

### Lingering Green "c" Bug
**Cause**: Twinkle alpha oscillation in canvas renderer
**Fix**: Removed twinkle effect from `gone-rogue-canvas.js`
**Commit**: [current]

### Dual Rendering Bug
**Cause**: Items in both `_items[]` and `InteractiveItems` arrays
**Fix**: Position-based deduplication in rendering
**Documentation**: `COLLECTIBLES-BUG-FIX.md`

### Currency Not Using Correct Glyph
**Cause**: Using emoji instead of ASCII ¢
**Fix**: Ensure `glyph: '¢'` in currency object
**File**: `gone-rogue.js:4972`

## Future Enhancements

WorldItems roadmap (distinct from the Animation Unification phases in `OVERHEAD-ANIMATION-UNIFIED-ROADMAP.md`):
- WorldItems Phase 1: Unified WorldItems manager ✅ Done (see `COLLECTIBLES-BUG-FIX.md` Architecture Note)
- WorldItems Phase 2: Consolidated animation system (future)
- WorldItems Phase 3: Complete emoji restriction enforcement (future)
- WorldItems Phase 4: Automated regression tests (future)
