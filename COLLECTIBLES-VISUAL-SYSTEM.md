# Collectibles Visual System Documentation

## Overview

This document defines the visual representation rules for all collectible items in the game, ensuring consistency and clarity for players.

## Visual Representation Rules

### Emoji Collectibles (Use Emoji Characters)

These collectible types use emoji for clear, recognizable visual representation:

1. **Food Items** (🍎 🍞 🍖 🍕 🍰 etc.)
   - All food items use their corresponding emoji
   - Examples: Apple 🍎, Bread 🍞, Meat 🍖
   - Database: `expression-database.js` FOOD_ITEMS
   - Rendered via: InteractiveItems system

2. **Keys** (🔑 🗝️)
   - Standard keys: 🔑
   - Special/rare keys: 🗝️
   - Used for unlocking doors and chests
   - Color: #FFD700 (gold)

3. **Key Ammo** (⚡ 🔋 specific ammo types)
   - Special ammunition types may use emoji if thematically appropriate
   - Example: energy ammo might use ⚡
   - **Note**: This refers to special ammo types, NOT battery recharge items

4. **Items/Equipment** (💎 specific items)
   - Special items and equipment may use emoji
   - **Note**: Battery cells (◈) are NOT emoji - they are cyan ASCII glyphs
   - Example: Other gems/crystals may use 💎 for decorative purposes

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
  'Energy': '#00D4FF',      // Electric Blue (Cyan)
  'Focus': '#FFF9B0',       // Bright Yellow-White
  'Battery': '#00FFA6',     // Sickly Green-Cyan
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
- **Collectible**: Battery Cell glyph `◈` with cyan color `#00FFA6`
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
- **Rendering**: Lines 594-602
- **Glyph**: `؋`
- **Color**: `#DA70D6`
- **Background**: `#2a0a2a`

### Battery Recharge / Battery Cells (ASCII Monochrome)
- **File**: `public/js/gone-rogue.js`
- **Spawn**: Lines 9269-9280, 9345-9356 (from breakables, 15% chance)
- **Pickup**: Lines 6018-6062 (calls `GAMESTATE.rechargeBattery()`)
- **Glyph**: `◈`
- **Type**: `'gem'`
- **Color**: `#00FFA6` (cyan from RESOURCE_COLORS)
- **Rendering**: `gone-rogue-mobile.js` lines 743-770 (cyan ASCII glyph)
- **UI Feedback**: Shows "◈ Battery +X" message
- **Debrief Integration**: Triggers `DebriefFeedController.triggerBatteryRecharge()`
- **Animation**: Battery signal pulse ((( ))) in debrief feed

### Food (Emoji)
- **File**: `public/js/expression-database.js`
- **Database**: FOOD_ITEMS (lines 14-80)
- **System**: InteractiveItems module
- **Examples**:
  - Apple: 🍎
  - Pineapple: 🍍
  - Bread: 🍞
  - Meat: 🍖

### Keys (Emoji)
- **Spawned by**: `_spawnKey()` in gone-rogue.js (line 4855)
- **Standard key**: 🔑
- **Rare key**: 🗝️
- **Color**: `#FFD700` (gold)

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

#### Keys (Emoji)
```javascript
// gone-rogue.js:6216-6219
if (typeof PlayerStackManager !== 'undefined' && PlayerStackManager.addPancake) {
  PlayerStackManager.addPancake(item.emoji || '🔑');
}
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
| **Stacking** | Vertical tower | Tight -12px spacing |
| **Display** | Character/glyph only | Text + glyph (e.g., "+3¢") |
| **Lifecycle** | Automatic decay | One-shot animation |

**Both systems work together**: Overhead Animator shows pickup event, Pancake Stacker provides ongoing awareness.

## Testing

### Visual Test
Run: `public/tests/test-collectibles-dual-render-bug.html`

### Verification Script
Run: `node public/tests/verify-collectibles-fix.js`

### Manual Testing Checklist
- [ ] Currency shows yellow ¢ (not green, not emoji)
- [ ] Currency pickup shows "+X¢" overhead animation
- [ ] No lingering currency glyphs after pickup
- [ ] Ammo shows magenta ؋
- [ ] Food items show correct emoji
- [ ] Keys show 🔑 or 🗝️
- [ ] Multiple pickups stack tightly above player
- [ ] No alpha/twinkle effects on ground items

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

See `COLLECTIBLES-BUG-FIX.md` for roadmap:
- Phase 1: Unified WorldItems manager
- Phase 2: Consolidated animation system
- Phase 3: Complete emoji restriction enforcement
- Phase 4: Automated regression tests
