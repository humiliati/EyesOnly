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

4. **Items/Equipment** (💎 specific items)
   - Special items and equipment may use emoji
   - Example: gems/crystals use 💎

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
   - Represents ammunition pickups
   - Background: `#2a0a2a` (dark magenta)

3. **Battery/Energy** (⚡ or custom glyph)
   - Glyph: Custom battery symbol or ⚡
   - Color: `#00FFA6` (cyan-green) per RESOURCE_COLORS
   - Used for battery recharge pickups
   - Background: `#1a0a2a` (dark purple)

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
