# Collectibles Bug Fix Log

> **Scope**: This document tracks **bug fixes** only. For visual system details, see `COLLECTIBLES-VISUAL-SYSTEM.md`. For the unified animation roadmap, see `OVERHEAD-ANIMATION-UNIFIED-ROADMAP.md`.

## Summary

Fixed seven bugs in the collectibles system across three phases:

1. **Bug #1: Dual Currency Animation** - Yellow "+3¢" animation shown alongside lingering green "¢" glyph
2. **Bug #2: Food/Interactive Items Not Removed** - Items remain visible on map after collection animation
3. **Bug #3: Food Tap-Handler Persistence** - Tapping a food item triggered `interact` instead of movement; item never removed from map
4. **Bug #4: Ammo Drops Rendered Cyan** - Ammo floor drops displayed with `#00FFFF` (cyan) instead of `#DA70D6` (magenta per `RESOURCE_COLOR_SYSTEM.md`)
5. **Bug #5: Floor Items Not Auto-Collected** - Ammo, gems/batteries, cards, and keys required manual `pickup` command; incompatible with keyboard-hidden mobile UI
6. **Bug #6: Key Tier Routing** - All key tiers treated identically; Tier 1 keys incorrectly stored in inventory
7. **Bug #7: Food Overhead Color Wrong + Debrief Only Reports HP** - `_movePlayer` path still used LOOT cyan; energy foods showed HP pink; only HP reported to debrief (not Fatigue/Ammo/Currency)

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

> **See also**: The twinkle alpha oscillation removal in `gone-rogue-canvas.js` was a second contributor to this lingering-glyph symptom. Details in `COLLECTIBLES-VISUAL-SYSTEM.md`.

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

### Bug #6: Key Tier Routing — key_ammo to Debrief Feed, key_items to Inventory

**Problem**: All key tiers (Tier 1 consumable chest keys and Tier 2 persistent door keys) were treated identically in `_pickupItem()`. Tier 1 keys were sent to loose inventory instead of being tracked as a resource counter in the debrief feed. Tooltips and MOK interjection showed the generic `'📦 PICKED UP {name}'` message with no indication of key type. Players had no way to distinguish "key ammo I'll consume opening chests" from "key item I need to equip to unlock a door."

**Location**: `/public/js/gone-rogue.js` — `_pickupItem()` inventory routing; `tooltip-system.js` — `showAction()`

**Before**:
```javascript
// ALL non-card, non-tier-2-key items went to loose inventory:
} else {
  result = GAMESTATE.addToLoose(nonCardPayload);  // Tier 1 keys incorrectly stored here
}

// Single generic tooltip for all non-card pickups:
TooltipSystem.showAction('item-pickup', { name: nm });  // → '📦 PICKED UP Rusty Key'

// Generic MOK interjection:
UIControls.updateMokInterjection('Item: ' + pickupDisplayName);

// Generic quality label (empty for keys):
var pickupQuality = ''; // no label at all
```

**After** (Fixed):
```javascript
// Tier 1 keys (key_ammo) → resource counter + debrief feed report:
} else if (item.type === 'key') {
  result = { success: true, message: 'Key ammo counted' };
  // addKeyCount + reportResourceChange happen in KEY COUNTER block below
}

// In KEY COUNTER block — Tier 1 additionally reports to debrief feed:
var oldKeyAmmoTotal = GAMESTATE.getTotalKeyAmmo();
GAMESTATE.addKeyCount(countKeyType, 1);
var newKeyAmmoTotal = GAMESTATE.getTotalKeyAmmo();
DebriefFeedController.reportResourceChange('key_ammo', oldKeyAmmoTotal, newKeyAmmoTotal, keyName);

// Specific tooltips:
TooltipSystem.showAction('key-ammo-pickup', { name: nm });  // → '🔑 KEY AMMO: Rusty Key'
TooltipSystem.showAction('key-item-pickup', { name: nm });  // → '🔑 KEY ITEM: Security Keycard → INVENTORY'

// Specific MOK interjections:
UIControls.updateMokInterjection('Key Ammo: ' + pickupDisplayName);
UIControls.updateMokInterjection('Key Item: ' + pickupDisplayName);

// Specific quality labels:
var pickupQuality = item.type === 'key' && keyTier <= 1 ? ' [KEY AMMO]' : ' [KEY ITEM]';
```

**Result**:
- ✅ Tier 1 keys (key_ammo) tracked as resource counter, NOT in loose inventory
- ✅ Debrief feed ammo row shows `🔑x{N}` in summary and per-key-type counts in expanded panel
- ✅ `reportResourceChange('key_ammo', ...)` fires on every Tier 1 key pickup → MOK feed update
- ✅ Tier 1 tooltip: `🔑 KEY AMMO: Rusty Key`
- ✅ Tier 2 tooltip: `🔑 KEY ITEM: Security Keycard → INVENTORY`
- ✅ `pickupQuality` shows `[KEY AMMO]` or `[KEY ITEM]` in pickup log line
- ✅ MOK interjection shows `Key Ammo:` or `Key Item:` prefix

### Bug #7: Food Overhead Color Wrong + Debrief Only Reports HP (2026-03-01)

**Problem**: Three issues from the initial RESOURCE_COLOR pipeline fix:

1. **`_movePlayer` food path completely unfixed**: The food pickup code in `_movePlayer` (command movement) still used `OverheadAnimator.showExpression(newX, newY, 'LOOT', 1000, result.emoji)` — cyan `#00FFFF` color. Only `_checkPlayerInteractions` (smooth movement) was updated.

2. **Food debrief only reported HP**: The debrief feed `reportResourceChange()` was only called for HP changes, but food can modify **four resources**: HP, Fatigue, Ammo (Field Ration), and Currency (Candy). Energy drinks reducing fatigue by 30 showed no debrief update at all.

3. **All food used HP pink overhead**: Energy-category foods (Coffee ☕, Energy Drink 🥤, Tea 🍵) — whose primary purpose is fatigue reduction — showed HP pink `#FF6B9D` overhead animation instead of Fatigue brown `#A0522D`.

**Location**: `/public/js/gone-rogue.js` — both `_checkPlayerInteractions` and `_movePlayer` food pickup blocks

**Before** (`_movePlayer` — completely unfixed):
```javascript
OverheadAnimator.showExpression(newX, newY, 'LOOT', 1000, result.emoji);
// No debrief reporting at all
```

**Before** (`_checkPlayerInteractions` — only HP reported):
```javascript
OverheadAnimator.showGenericExpression(x, y, result.emoji, 1000, '#FF6B9D'); // Always HP pink
// Only HP reported:
if (hpAfter !== hpBefore) {
  DebriefFeedController.reportResourceChange('HP', hpBefore, hpAfter, result.foodName);
}
```

**After** (both paths now identical):
```javascript
// Determine primary color from food category
var foodDef = FoodDatabase.getFoodItem(foodItem.customData.foodId);
var primaryColor = '#FF6B9D'; // HP pink default
if (foodDef && foodDef.category === 'energy') {
  primaryColor = '#A0522D'; // Fatigue brown for energy foods
}
OverheadAnimator.showGenericExpression(x, y, result.emoji, 1000, primaryColor);

// Capture before-values for ALL resources, report EACH that changed:
// HP → reportResourceChange('HP', ...) — #FF6B9D
// Fatigue → reportResourceChange('Fatigue', ...) — #A0522D
// Ammo → reportResourceChange('Ammo', ...) — #DA70D6
// Currency → reportResourceChange('Currency', ...) — #FFFF00
```

**Result**:
- ✅ Both `_checkPlayerInteractions` and `_movePlayer` food paths use identical unified logic
- ✅ Energy foods (Coffee, Energy Drink, Tea) show Fatigue brown `#A0522D` overhead animation
- ✅ Health/status/special foods show HP pink `#FF6B9D` overhead animation
- ✅ ALL resource changes from food are reported to debrief feed with correct RESOURCE_COLOR
- ✅ Field Ration (+35 HP, -20 Fatigue, +3 Ammo) fires three debrief reports
- ✅ Candy (+5 HP, -5 Fatigue, +10¢) fires three debrief reports
- ✅ `showExpression('LOOT')` fully eliminated from all collectible pickup paths

---

## Changes Made

### File: `/public/js/gone-rogue.js`

- `WorldItems.getAllForRendering()` loop: added `type === 'ammo'` branch with `color = '#DA70D6'`
- Fallback rendering path: corrected ammo color from `#00FFFF` to `#DA70D6`
- `_checkPlayerInteractions`: replaced ammo-specific 25-line block with `_pickupItem()` call
- `_movePlayer`: same replacement
- `_pickupItem` inventory routing: Tier 1 keys (key_ammo) → resource-only path (no `addToLoose`)
- `_pickupItem` KEY COUNTER block: `getTotalKeyAmmo()` before/after `addKeyCount()`; calls `reportResourceChange('key_ammo', ...)` for Tier 1
- `_pickupItem` tooltip: uses `key-ammo-pickup` (Tier 1), `key-item-pickup` (Tier 2+), `item-pickup` (non-key)
- `_pickupItem` MOK interjection: `Key Ammo: {name}` / `Key Item: {name}` instead of generic `Item:`
- `_pickupItem` `pickupQuality`: shows `[KEY AMMO]` (Tier 1) or `[KEY ITEM]` (Tier 2)
- `_pickupItem`: guarded `item.card.*` accesses with safe locals; key emoji fallback `'🔑'`; tier-1 key overhead animation added

### File: `/public/js/gone-rogue-mobile.js`

- Tap handler: `autoPickup` items bypass `process('interact')`, allowing movement to proceed
- `WorldItems.getAllForRendering()` loop: added `type === 'ammo'` branch with `color = '#DA70D6'`
- Fallback rendering path: corrected ammo color from `#00FFFF` to `#DA70D6`

### File: `/public/js/tooltip-system.js`

- Added `key-ammo-pickup` action: `'🔑 KEY AMMO: {name}'`
- Added `key-item-pickup` action: `'🔑 KEY ITEM: {name} → INVENTORY'`

### File: `/public/js/gamestate.js`

- Added `getTotalKeyAmmo()` — sums all Tier 1 key counts; used for before/after values in `reportResourceChange`

### File: `/public/js/debrief-feed-controller.js`

- Ammo row summary: appends `🔑x{N}` when any Tier 1 key_ammo is held
- Expanded ammo panel: human-readable labels (`🔑 KEY AMMO Rusty:N`, `🗝️ KEY AMMO Bronze:N`, `💳 KEY ITEM Keycard:N`, `🏷️ KEY ITEM Mall:N`) instead of cryptic `ChstKyLq`/`TagKy1`

---

## Testing

### Automated Tests

Run: `node public/tests/verify-collectibles-fix.js`
Run: `node public/tests/verify-collectibles-improvements.js`

Results: **19/19 tests passing** ✅

> **Note**: Key tier routing (Bug #6) is verified via manual checklist only — automated tests for `getTotalKeyAmmo()`, debrief feed `🔑x{N}`, and key-ammo vs key-item tooltip routing are not yet implemented.

### Manual Testing Checklist
- [ ] Walk over health food (Apple 🍎) → item disappears, HP pink animation, debrief shows HP + Fatigue changes
- [ ] Walk over energy food (Coffee ☕) → item disappears, Fatigue brown animation, debrief shows HP + Fatigue changes
- [ ] Walk over special food (Field Ration 🥫) → HP pink animation, debrief shows HP + Fatigue + Ammo changes
- [ ] Walk over special food (Candy 🍬) → HP pink animation, debrief shows HP + Fatigue + Currency changes
- [ ] Tap food item tile → player moves to tile, food auto-collects (does not `interact`)
- [ ] Walk over ammo drop → item disappears, `؋` animation plays with magenta color
- [ ] Walk over battery cell → item disappears, `◈` animation plays with cyan color
- [ ] Walk over card drop → item disappears, card added to hand
- [ ] Walk over Rusty Key (Tier 1) → tooltip shows `🔑 KEY AMMO: Rusty Key`, quality label `[KEY AMMO]`, debrief `🔑x1`
- [ ] Walk over Bronze Key (Tier 1) → tooltip shows `🔑 KEY AMMO: Bronze Key`, debrief count increments
- [ ] Tier 1 key does NOT appear in loose or persistent inventory
- [ ] Walk over Security Keycard (Tier 2) → tooltip shows `🔑 KEY ITEM: Security Keycard → INVENTORY`, key auto-equips
- [ ] Tier 2 key appears in persistent inventory (survives death)
- [ ] Walk over quest key (Tier 3) → shows `❗ QUEST ITEM` tooltip with NPC target
- [ ] Breakable destroyed → ammo drop appears in magenta (not cyan)

---

## Architecture Note: WorldItems Phase 1 ✅ Done

The `WorldItems` singleton is the single source of truth for all floor collectibles.  Items removed via `WorldItems.filterFloorItems()` immediately disappear from both the `_items` array and the `getAllForRendering()` output — no deduplication hacks needed.

---

## References

- Original Issue: Collectibles System Refactor — Detailed Analysis and Roadmap
- Commit afcf229: Fix food persistence and ammo cyan color/non-interactive collectible bugs
- Commit 611ccc4: Unify all floor collectibles to auto-pickup on walkover; fix `_pickupItem` crash for keys
- Commit d41e807: Implement key_ammo/key_item tier distinction — tooltip, debrief feed routing, inventory separation
- Commit (Bug #7): RESOURCE_COLOR pipeline unification — per-effect food debrief, energy category overhead brown, fix _movePlayer LOOT cyan
- Canon Reference: `docs/COLLECTIBLES_CANON.md` — authoritative collectible category definitions
- Test File: `/public/tests/test-collectibles-dual-render-bug.html`
