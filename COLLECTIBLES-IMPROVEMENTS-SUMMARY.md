# Collectibles System Improvements - Summary

## Overview

This document summarizes the improvements made to the collectibles system to fix rendering bugs, correct resource colors, and unify auto-pickup behavior across all floor collectible types.

## Issues Addressed

### 1. Lingering Green "c" Bug ✅ FIXED
**Problem**: After collecting currency, a green "c" glyph would linger on the map even after the yellow "+3¢" animation played.

**Root Cause**: The twinkle alpha oscillation effect in `gone-rogue-canvas.js` was modifying `globalAlpha` for non-enemy entities (including currencies). This caused collected currency glyphs to render with varying transparency, creating a ghosting effect.

**Fix**:
- Removed twinkle alpha oscillation code (lines 515-522)
- Removed `_twinklePhases` tracking object
- Removed `_advanceTwinklePhases()` function call

**Files Changed**: `public/js/gone-rogue-canvas.js`

> **See also**: BUG-FIX #1 — the `collected` flag filter in `gone-rogue-mobile.js` was the primary fix for the dual-render variant of this lingering-glyph bug.

### 2. Overhead Animation Stacking ✅ IMPROVED
**Problem**: Multiple pickup animations would spread horizontally and weren't positioned consistently tight above the player's head.

**Requirements**:
- Multiple items should stack vertically in a tight, overlapping formation
- All animations should start tight to the top of the player head
- Single items should also render tight to player head (not floating far above)

**Fix**:
- Changed base position to start at -20px above player (tight to head)
- Removed horizontal spreading (`transform.x` modification)
- Implemented tight 12px vertical spacing between stacked items
- Updated CURRENCY_PICKUP animation to start at -20px
- Updated EXPRESSION animation to start at -20px

**Files Changed**: `public/js/overhead-animator.js`

### 3. Emoji vs Monochrome Collectibles ✅ DOCUMENTED
**Problem**: Unclear which collectibles should use emoji vs ASCII monochrome glyphs.

**Solution**: Created comprehensive documentation defining visual representation rules:

**Emoji Collectibles** (use emoji characters):
- Food Items (🍎 🍞 🍖 🍕 🍰)
- Keys (🔑 🗝️)
- Card Drops (🃏 🎴)

**Monochrome ASCII Collectibles** (use ASCII + resource colors):
- Currency: `¢` with `#FFFF00` (yellow)
- Ammo: `؋` with `#DA70D6` (magenta)
- Battery: `◈` with `#00FFA6` (cyan-green)
- HP: `♥` with `#FF6B9D` (pink)
- Focus: `◉` with `#FFF9B0` (yellow-white)

**Files Created**: `COLLECTIBLES-VISUAL-SYSTEM.md`

### 4. Food Tap-Handler Persistence ✅ FIXED
**Problem**: On the canvas grid (mobile), tapping a food item triggered `GoneRogue.process('interact')` instead of movement. The item was marked interacted but never removed from the world. The player never physically stepped onto the tile, so `_checkPlayerInteractions` never fired — the animation and tooltip played but the food remained on the map.

**Fix**: Tap handler now skips `process('interact')` for any item with `autoPickup: true`, letting `handleTapMove` proceed. When the player arrives at the tile, `_checkPlayerInteractions` fires and the existing food auto-pickup code removes the item.

**Files Changed**: `public/js/gone-rogue-mobile.js`

### 5. Ammo Drops Rendered Cyan ✅ FIXED
**Problem**: Ammo floor drops from breakables rendered with `#00FFFF` (cyan) instead of the correct `#DA70D6` (magenta/orchid) per `RESOURCE_COLOR_SYSTEM.md`. The `WorldItems.getAllForRendering()` entity loop had no `ammo` branch, so ammo fell into the generic `else` case.

**Fix**: Added `type === 'ammo'` branch with `color = '#DA70D6'` in both the primary `WorldItems.getAllForRendering()` path and the WorldItems-unavailable fallback path.

**Files Changed**: `public/js/gone-rogue-mobile.js`

### 6. All Floor Collectibles Unified to Auto-Pickup ✅ FIXED
**Problem**: In gone-rogue's keyboard-hidden mobile UI, all collectibles must auto-collect on walkover — no typing required. Ammo, gem/battery, cards, and keys only had the manual `pickup` command path. Additionally, `_pickupItem()` crashed for key items because it blindly accessed `item.card.name/emoji/qualityName` (undefined for keys).

**Fix**:
- Both `_checkPlayerInteractions` (smooth movement) and `_movePlayer` (command movement) now call `_pickupItem()` whenever any floor item is present at the player's tile
- `_pickupItem()` terminal MOK interjection and return statement now use guarded locals (`pickupEmoji`, `pickupDisplayName`, `pickupQuality`) that fall back gracefully for non-card items
- Tier-1 keys now show overhead key emoji + pancake stacker entry on auto-pickup (previously silent)
- Battery/gem animation uses hardcoded `◈` cyan symbol throughout — never `item.emoji`

**Files Changed**: `public/js/gone-rogue.js`

### 7. Key Tier Routing — key_ammo to Debrief Feed, key_items to Inventory ✅ FIXED

**Problem**: `_pickupItem()` treated all keys identically regardless of tier. Tier 1 consumable chest keys (key_ammo) went to loose inventory just like Tier 2 door keys. All keys showed the generic `📦 PICKED UP {name}` tooltip with no type indication. Players could not distinguish "ammo I'll consume at a chest" from "door key I need to equip."

**Fix**:
- **Tooltip system** (`tooltip-system.js`): Added two dedicated action types:
  - `key-ammo-pickup` → `🔑 KEY AMMO: {name}` (Tier 1)
  - `key-item-pickup` → `🔑 KEY ITEM: {name} → INVENTORY` (Tier 2+)
- **GAMESTATE** (`gamestate.js`): Added `getTotalKeyAmmo()` — sums all Tier 1 key counts for resource-change delta
- **Inventory routing** (`gone-rogue.js`): Tier 1 keys no longer call `addToLoose()`; result is a synthetic `{ success: true }` — key tracked only as resource counter via `addKeyCount()`
- **Debrief feed report** (`gone-rogue.js`): KEY COUNTER block calls `DebriefFeedController.reportResourceChange('key_ammo', old, new, keyName)` for Tier 1 keys
- **Debrief feed display** (`debrief-feed-controller.js`): Ammo row summary appends `🔑x{N}`; expanded panel uses human-readable labels (`🔑 KEY AMMO Rusty:N`, `💳 KEY ITEM Keycard:N`)
- **MOK interjection**: Shows `Key Ammo: {name}` or `Key Item: {name}` instead of generic `Item:`
- **Quality label**: `pickupQuality` shows `[KEY AMMO]` or `[KEY ITEM]` in pickup log line

**Files Changed**: `public/js/gone-rogue.js`, `public/js/tooltip-system.js`, `public/js/gamestate.js`, `public/js/debrief-feed-controller.js`

---

### Automated Tests
Run: `node public/tests/verify-collectibles-improvements.js`
Run: `node public/tests/verify-collectibles-fix.js`

Results: **19/19 tests passing** ✅

> **Note**: Key tier routing (Issue #7) is verified via manual checklist only — automated tests for `getTotalKeyAmmo()`, debrief feed `🔑x{N}`, and key-ammo vs key-item tooltip routing are not yet implemented.

Tests verify:
1. Twinkle alpha oscillation removed
2. Twinkle phase tracking removed
3. Twinkle phase advance call removed
4. Currency uses correct glyph (¢)
5. Overhead animations start at -20px
6. Expression animations start at -20px
7. Stack spacing is 12px
8. No horizontal spreading of stacks
9. Visual system documentation exists
10. Documentation covers emoji rules
11. Bug fix documentation exists
12–19. WorldItems Phase 1 correctness (single source of truth)

### Manual Testing Checklist
- [x] Currency shows yellow ¢ (not green, not emoji)
- [x] Currency pickup shows "+X¢" overhead animation starting tight above player
- [x] No lingering currency glyphs after pickup
- [x] Multiple pickups stack vertically with 12px spacing
- [x] Single pickups render tight to player head (-20px)
- [x] No alpha/twinkle effects on ground items
- [x] Food items show correct emoji and disappear immediately on walkover
- [x] Tapping a food tile moves player to tile (does not `interact`)
- [x] Ammo drops show magenta ؋ (not cyan)
- [x] Ammo drops auto-collect on walkover
- [x] Battery cells auto-collect with ◈ cyan animation on walkover
- [x] Card drops auto-collect on walkover
- [x] Key Ammo (Tier 1): tooltip `🔑 KEY AMMO: {name}`, quality `[KEY AMMO]`, NOT in inventory
- [x] Key Ammo (Tier 1): debrief ammo row shows `🔑x{N}` in summary
- [x] Key Item (Tier 2): tooltip `🔑 KEY ITEM: {name} → INVENTORY`, auto-equips, in persistent inventory
- [x] Quest Key (Tier 3): `❗ QUEST ITEM` tooltip with NPC target
- [x] All animations consistent and readable

---

## Technical Details

### Canvas Rendering Changes

**Before** (gone-rogue-canvas.js:515-522):
```javascript
var savedAlpha = this.ctx.globalAlpha;
if (!entity.isEnemy) {
  var phase = _twinklePhases[key] || 0;
  this.ctx.globalAlpha = 0.78 + 0.22 * (0.5 + 0.5 * Math.sin(phase));
}
this.ctx.globalAlpha = savedAlpha;
```

**After**:
```javascript
// Render entity character/emoji — no alpha modification
this.ctx.fillStyle = entity.color || '#FF0000';
```

### Animation Transform Changes

**Before** (overhead-animator.js):
```javascript
case 'CURRENCY_PICKUP':
  transform.y = -bounceHeight * bounceProgress; // Start at 0
case 'EXPRESSION':
  transform.y = -floatHeight * progress; // Start at 0
```

**After**:
```javascript
case 'CURRENCY_PICKUP':
  transform.y = -20 - (bounceHeight * bounceProgress); // Start at -20px
case 'EXPRESSION':
  transform.y = -20 - (floatHeight * progress); // Start at -20px
```

### Unified Auto-Pickup (gone-rogue.js)

**Before** — ammo only, ~25 lines duplicated in two movement handlers:
```javascript
var ammoFloorItem = _items.find(function(i) {
  return i.x === x && i.y === y && i.type === 'ammo';
});
if (ammoFloorItem) { /* 20+ lines */ }
// Cards, gems, keys: no auto-pickup at all
```

**After** — all floor collectible types, one line per movement handler:
```javascript
if (_items.find(function(i) { return i.x === x && i.y === y; })) {
  _pickupItem();
}
```

---

## Performance Impact

- **Removed**: Twinkle phase calculation (per-frame sine calculations eliminated)
- **Added**: None — only modified existing transform calculations and replaced verbose ammo blocks with a single function call
- **Net Impact**: Slight improvement (removed unnecessary per-frame calculations)

---

## Related Documents

- `COLLECTIBLES-BUG-FIX.md` — Full bug log with before/after code
- `COLLECTIBLES-VISUAL-SYSTEM.md` — Emoji vs ASCII usage rules and auto-pickup doctrine
- `docs/RESOURCE_COLOR_SYSTEM.md` — Resource color palette
- `OVERHEAD-ANIMATION-UNIFIED-ROADMAP.md` — Overhead animation system doctrine

---

## Commit History

1. `f7858e7` — Fix collectibles dual-render bugs: filter collected currencies and deduplicate items
2. `9ce5c5a` — Add visual test, documentation, and automated verification for collectibles fix
3. `b825806` — Add visual test HTML for collectibles dual-render bug demonstration
4. `79dc8eb` — Remove twinkle alpha effect causing lingering currency bug and document collectibles system
5. `6782801` — Improve overhead animation stacking — tight rendering above player head
6. `4db3a65` — Add comprehensive verification test for collectibles improvements
7. `afcf229` — Fix food persistence and ammo cyan color/non-interactive collectible bugs
8. `611ccc4` — Unify all floor collectibles to auto-pickup on walkover; fix `_pickupItem` crash for keys
9. `d41e807` — Implement key_ammo/key_item tier distinction — tooltip, debrief feed routing, inventory separation
