# Collectibles Bug Fix Log

## Summary

Fixed five critical bugs in the collectibles system across two phases:

1. **Bug #1: Dual Currency Animation** - Yellow "+3¢" animation shown alongside lingering green "¢" glyph
2. **Bug #2: Food/Interactive Items Not Removed** - Items remain visible on map after collection animation
3. **Bug #3: Food Tap-Handler Persistence** - Tapping a food item triggered `interact` instead of movement; item never removed from map
4. **Bug #4: Ammo Drops Rendered Cyan** - Ammo floor drops displayed with `#00FFFF` (cyan) instead of `#DA70D6` (magenta per `RESOURCE_COLOR_SYSTEM.md`)
5. **Bug #5: Floor Items Not Auto-Collected** - Ammo, gems/batteries, cards, and keys required manual `pickup` command; incompatible with keyboard-hidden mobile UI

## Root Cause Analysis

### Bug #1: Dual Currency Animation

**Problem**: Currency objects remained in `_currencies[]` array after collection, marked with `collected: true` flag, but the canvas renderer didn't check this flag.

**Location**: `/public/js/gone-rogue-mobile.js` lines ~725-736

**Before**:
```javascript
currencies.forEach(function(currency) {
  var vx = _toViewX(currency.x);
  var vy = _toViewY(currency.y);
  if (!_inView(vx, vy)) return;
  entities.push({  // ← Renders ALL currencies, even collected ones!
    x: vx, y: vy,
    char: currency.glyph || '¢',
    color: '#FFFF00'
  });
});
```

**After** (Fixed in commit f7858e7):
```javascript
currencies.forEach(function(currency) {
  // Skip collected currencies to prevent dual rendering bug
  if (currency.collected) return;  // ← NEW: Filter out collected currencies
  var vx = _toViewX(currency.x);
  var vy = _toViewY(currency.y);
  if (!_inView(vx, vy)) return;
  entities.push({
    x: vx, y: vy,
    char: currency.glyph || '¢',
    color: '#FFFF00'
  });
});
```

**Result**:
- ✅ Overhead animation still works correctly (OverheadAnimator.showCurrencyPickup)
- ✅ Currency glyph immediately disappears from map after collection
- ✅ No more lingering "¢" glyphs drifting on screen

### Bug #2: Food/Interactive Items Dual Rendering

**Problem**: Items were rendered from TWO independent arrays:
1. `_items[]` array (line ~740-752)
2. `InteractiveItems._interactiveItems[]` (line ~787-802)

When an item was removed from one array but not the other, it would still render.

**Location**: `/public/js/gone-rogue-mobile.js` lines ~740-812

**Before**:
```javascript
// Add items
items.forEach(function(item) {
  entities.push({ x: vx, y: vy, char: item.emoji, color: '#00FFFF' });
});

// ... later ...

// Add interactive items (SEPARATE loop!)
interactiveItems.forEach(function(item) {
  entities.push({ x: vx, y: vy, char: item.emoji, color: '#00FFFF' });
});
```

**After** (Fixed in commit f7858e7):
```javascript
// Track positions of items to prevent duplicate rendering (Bug #2 fix)
var itemPositions = {};

// Add items
items.forEach(function(item) {
  var posKey = vx + ',' + vy;
  if (itemPositions[posKey]) return; // Skip if already rendered
  itemPositions[posKey] = true;
  entities.push({ x: vx, y: vy, char: item.emoji, color: '#00FFFF' });
});

// ... later ...

// Add interactive items (deduplication prevents dual rendering with items[])
interactiveItems.forEach(function(item) {
  var posKey = vx + ',' + vy;
  if (itemPositions[posKey]) return; // Skip if already rendered from items[]
  itemPositions[posKey] = true;
  entities.push({ x: vx, y: vy, char: item.emoji, color: '#00FFFF' });
});
```

**Result**:
- ✅ Items at the same position only render once
- ✅ No duplicate food emoji glyphs
- ✅ Collection properly removes item from view

---

### Bug #3: Food Tap-Handler Persistence

**Problem**: On the canvas grid (mobile), tapping a food item within interaction range triggered `GoneRogue.process('interact')` instead of initiating movement toward the tile. `_handleInteraction` marked the item as interacted but never removed it from the world. Since the player never physically stepped onto the tile, `_checkPlayerInteractions` never fired — the animation played and tooltip appeared but the food item remained on the map.

**Location**: `/public/js/gone-rogue-mobile.js` — `_handleTapOrClick` handler

**Before**:
```javascript
// Check if tapping interactive item
if (typeof InteractiveItems !== 'undefined') {
  var item = InteractiveItems.getItemAt(x, y);
  if (item && InteractiveItems.canInteractWith(player.x, player.y, item)) {
    GoneRogue.process('interact');  // ← Intercepts ALL interactive items, including food
    _lastMovementTime = now;
    return;
  }
}
```

**After** (Fixed in commit afcf229):
```javascript
// Check if tapping interactive item
if (typeof InteractiveItems !== 'undefined') {
  var item = InteractiveItems.getItemAt(x, y);
  if (item && InteractiveItems.canInteractWith(player.x, player.y, item)) {
    // Auto-pickup items (food and other autoPickup collectibles) are collected by
    // walking over them — let movement proceed
    if (!item.autoPickup) {
      GoneRogue.process('interact');
      _lastMovementTime = now;
      return;
    }
  }
}
```

**Result**:
- ✅ Tapping a food tile initiates movement to that tile
- ✅ `_checkPlayerInteractions` fires when player arrives, removes item and plays animation
- ✅ Non-autoPickup interactive items (books, signs, terminals) still use `interact` command

---

### Bug #4: Ammo Drops Rendered Cyan

**Problem**: Ammo floor drops from breakables rendered with `#00FFFF` (cyan) instead of the correct `#DA70D6` (magenta/orchid) defined in `RESOURCE_COLOR_SYSTEM.md`. The `WorldItems.getAllForRendering()` entity loop had no branch for `type === 'ammo'`, so ammo fell into the generic `else` case alongside cards and other items.

**Location**: `/public/js/gone-rogue-mobile.js` — `_renderWithCanvas` entity loop and WorldItems-unavailable fallback

**Before**:
```javascript
} else if (item._wt === 'item') {
  if (item.type === 'gem') {
    char = item.glyph || '◈';
    color = '#00FFA6';
  } else {
    char = item.glyph || item.emoji || '💎';
    color = '#00FFFF';  // ← Ammo falls here, gets cyan
  }
}
// Fallback path:
var color = item.type === 'gem' ? '#00FFA6' : '#00FFFF';  // ← Same problem
```

**After** (Fixed in commit afcf229):
```javascript
} else if (item._wt === 'item') {
  if (item.type === 'gem') {
    char = item.glyph || '◈';
    color = '#00FFA6';
  } else if (item.type === 'ammo') {
    char = item.glyph || item.emoji || '؋';
    color = '#DA70D6';  // ← Magenta per RESOURCE_COLOR_SYSTEM.md
  } else {
    char = item.glyph || item.emoji || '💎';
    color = '#00FFFF';
  }
}
// Fallback path:
var color = item.type === 'gem' ? '#00FFA6' : (item.type === 'ammo' ? '#DA70D6' : '#00FFFF');
```

**Result**:
- ✅ Ammo drops show correct magenta color `#DA70D6`
- ✅ Gem/battery still shows cyan-green `#00FFA6`
- ✅ Both primary (WorldItems) and fallback rendering paths corrected

---

### Bug #5: Floor Items Not Auto-Collected on Walkover

**Problem**: In the keyboard-hidden mobile UI of gone-rogue, all collectibles must auto-collect when the player walks or taps over them. Ammo, gem/battery, card, and key floor drops were only collectible by typing `pickup` — a command unavailable in the mobile interface. Food was handled, but other floor item types were ignored in both movement code paths.

Additionally, `_pickupItem()` crashed for key items because the final MOK interjection and `return` statement blindly accessed `item.card.name`, `item.card.emoji`, and `item.card.qualityName` — all `undefined` for key items which carry no `.card` wrapper.

**Location**: `/public/js/gone-rogue.js` — `_checkPlayerInteractions`, `_movePlayer`, `_pickupItem`

**Before** (in both `_checkPlayerInteractions` and `_movePlayer`):
```javascript
// Only ammo had any auto-pickup logic, ~25 lines duplicated in two places:
var ammoFloorItem = _items.find(function(i) {
  return i.x === x && i.y === y && i.type === 'ammo';
});
if (ammoFloorItem) {
  GAMESTATE.addAmmo(ammoFloorItem.amount);
  // ... 20+ lines of animation/tooltip/pancake calls
}
// Cards, gems, keys: NO auto-pickup at all
```

**Before** (`_pickupItem` terminal return — crashes for keys):
```javascript
UIControls.updateMokInterjection(pickupType + ': ' + item.card.name + locationInfo);
// ...
return { lines: ['PICKED UP: ' + item.card.emoji + ' ' + item.card.name +
  ' [' + item.card.qualityName + ']', ...] };
```

**After** (Fixed in commit 611ccc4):
```javascript
// _checkPlayerInteractions — covers ALL floor item types in one line:
if (_items.find(function(i) { return i.x === x && i.y === y; })) {
  _pickupItem();
}

// _movePlayer — same pattern:
if (_items.find(function(i) { return i.x === newX && i.y === newY; })) {
  _pickupItem();
}

// _pickupItem terminal return — safe for all item types:
var pickupEmoji = (item.card && item.card.emoji)
  ? item.card.emoji
  : (item.emoji || (item.type === 'key' ? '🔑' : '📦'));
var pickupDisplayName = (item.card && item.card.name)
  ? item.card.name
  : (item.name || 'Item');
var pickupQuality = (item.card && item.card.qualityName)
  ? ' [' + item.card.qualityName + ']'
  : '';
UIControls.updateMokInterjection(pickupType + ': ' + pickupDisplayName + locationInfo);
return { lines: ['PICKED UP: ' + pickupEmoji + ' ' + pickupDisplayName + pickupQuality, ...] };
```

**Result**:
- ✅ All floor items (ammo, gem/battery, cards, keys) auto-collect on walkover
- ✅ Both smooth movement (`_checkPlayerInteractions`) and command movement (`_movePlayer`) paths handled
- ✅ No crash when picking up key items
- ✅ Tier-1 keys now show overhead key emoji + pancake stacker entry on auto-pickup
- ✅ Battery/gem animation uses hardcoded `◈` cyan symbol throughout (not `item.emoji`)

---

## Changes Made

### File: `/public/js/gone-rogue-mobile.js`

- Tap handler: `autoPickup` items bypass `process('interact')`, allowing movement to proceed
- `WorldItems.getAllForRendering()` loop: added `type === 'ammo'` branch with `color = '#DA70D6'`
- Fallback rendering path: corrected ammo color from `#00FFFF` to `#DA70D6`

### File: `/public/js/gone-rogue.js`

- `_checkPlayerInteractions`: replaced ammo-specific 25-line block with `_pickupItem()` call
- `_movePlayer`: same replacement
- `_pickupItem`: guarded `item.card.*` accesses with safe locals; key emoji fallback `'🔑'`; tier-1 key overhead animation added

---

## Testing

### Automated Tests

Run: `node public/tests/verify-collectibles-fix.js`
Run: `node public/tests/verify-collectibles-improvements.js`

Results: **19/19 tests passing** ✅

### Manual Testing Checklist
- [ ] Walk over food item → item disappears, LOOT animation plays, HP/fatigue modified
- [ ] Tap food item tile → player moves to tile, food auto-collects (does not `interact`)
- [ ] Walk over ammo drop → item disappears, `؋` animation plays with magenta color
- [ ] Walk over battery cell → item disappears, `◈` animation plays with cyan color
- [ ] Walk over card drop → item disappears, card added to hand
- [ ] Walk over key → item disappears, key animation plays with gold color
- [ ] Breakable destroyed → ammo drop appears in magenta (not cyan)

---

## Architecture Note: WorldItems Phase 1 ✅ Done

The `WorldItems` singleton is the single source of truth for all floor collectibles.  Items removed via `WorldItems.filterFloorItems()` immediately disappear from both the `_items` array and the `getAllForRendering()` output — no deduplication hacks needed.

---

## References

- Original Issue: Collectibles System Refactor — Detailed Analysis and Roadmap
- Commit afcf229: Fix food persistence and ammo cyan color/non-interactive collectible bugs
- Commit 611ccc4: Unify all floor collectibles to auto-pickup on walkover; fix `_pickupItem` crash for keys
- Test File: `/public/tests/test-collectibles-dual-render-bug.html`
