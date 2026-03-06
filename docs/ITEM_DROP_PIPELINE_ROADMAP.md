# Item Drop Pipeline Roadmap

**Date:** 2026-03-06
**Status:** PLANNED
**Blocks:** Flipper Zero (ITM-103) tutorial drop, all future designer-placed item drops from breakables
**Companion:** UNIFIED_DESIGNER_GUIDE.md §4 (gap analysis)

---

## Problem

Breakables can drop resources (ammo, currency, gems, cards) and keys — but NOT equipment or consumable items from items.json. Three pieces are missing: spawn, pickup routing, and map rendering for ITM-### world drops.

---

## Phase 1 — Pickup Routes to Inventory

**Goal:** When a ground item with `itemId: 'ITM-###'` is walked over, it actually enters the player's inventory.

**File:** `pickup-system.js`

**Changes:**

1. In `_addToInventory()` (line 277), replace the dead-end `else` at line 316:

```javascript
// BEFORE (dead-end):
} else {
  result = { success: true, message: 'Item picked up' };
}

// AFTER:
} else if (item.itemId) {
  // Resolve full definition from data registry
  var itemDef = null;
  if (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getItem) {
    itemDef = GoneRogueDataRegistry.getItem(item.itemId);
  }
  var payload = itemDef || nonCardPayload || item;

  // Route by item type
  if (payload.equipSlot === 'passive' || payload.equipSlot === 'active') {
    result = GAMESTATE.addToPersistent(payload);
  } else {
    result = GAMESTATE.addToLoose(payload);
  }

  // Overhead animation
  if (result && result.success) {
    try {
      if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
        OverheadAnimator.showGenericExpression(
          ctx.player.x, ctx.player.y,
          item.emoji || '📦', 800, '#FFFFFF'
        );
      }
    } catch (e) {}
  }
} else {
  result = { success: true, message: 'Item picked up' };
}
```

2. Add debrief feed report after the overhead animation block (same pattern as card pickup).

**Test:** Call `WorldItems.addItem({ x: 5, y: 5, type: 'item', itemId: 'ITM-098', emoji: '🗝', name: 'Skeleton Keyring', spawnTime: Date.now(), decayTime: 60000 })` from console, walk player to (5,5), confirm item appears in `GAMESTATE._state.inventoryPersistent`.

**Estimated lines:** ~30

---

## Phase 2 — Breakable Spawn Path

**Goal:** Breakables with `drops.itemId` spawn that item on the ground when destroyed.

**File:** `breakable-system.js`

**Changes:**

1. Add `_spawnItemDrop(breakable, ctx)` function after `_spawnKeyDrops` (~line 598):

```javascript
function _spawnItemDrop(breakable, ctx) {
  if (!breakable.drops || !breakable.drops.itemId) return;

  var itemId = breakable.drops.itemId;
  var itemDef = null;
  if (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getItem) {
    itemDef = GoneRogueDataRegistry.getItem(itemId);
  }
  if (!itemDef) {
    console.warn('[BreakableSystem] Unknown item drop:', itemId);
    return;
  }

  var worldItem = {
    x: breakable.x,
    y: breakable.y,
    type: 'item',
    itemId: itemId,
    emoji: itemDef.emoji || '📦',
    name: itemDef.name || itemId,
    description: itemDef.description || '',
    rarity: itemDef.rarity || 'common',
    spawnTime: Date.now(),
    decayTime: 120000
  };

  if (typeof WorldItems !== 'undefined') {
    WorldItems.addItem(worldItem);
  } else {
    ctx.items.push(worldItem);
  }

  console.log('[BreakableSystem] Item dropped:', itemId, 'at', breakable.x, breakable.y);
}
```

2. Call `_spawnItemDrop(breakable, ctx)` from `_spawnBreakableLoot()` (line 350), right after the existing LootTable/Fallback path and `_spawnKeyDrops`:

```javascript
function _spawnBreakableLoot(breakable, ctx) {
  if (typeof LootTableManager !== 'undefined' && LootTableManager.rollBreakableLoot) {
    _spawnLootTableLoot(breakable, ctx);
  } else {
    _spawnFallbackLoot(breakable, ctx);
  }
  _spawnKeyDrops(breakable, ctx);    // existing
  _spawnItemDrop(breakable, ctx);    // NEW — Phase 2
}
```

**Note:** Check whether `_spawnKeyDrops` is already called from `_spawnBreakableLoot` or from the loot sub-functions. Adjust call site accordingly so both fire.

**Test:** Place a breakable in tutorial-floors.js with `drops: { itemId: 'ITM-098' }`, break it, confirm Skeleton Keyring appears on map tile.

**Estimated lines:** ~35

---

## Phase 3 — Map Render + Tutorial Wiring

**Goal:** Dropped items render visibly on the map, and floor 0 tutorial has one breakable that guarantees the Flipper Zero.

**File 1:** `gone-rogue-mobile.js` (item rendering)

The existing renderer (lines ~805-903) handles items by `_wt` tag. Items with `type: 'item'` coming through `WorldItems.getAllForRendering()` should already get `_wt: 'item'`. Add a render branch:

```javascript
// Inside the world-item render loop:
if (wi._wt === 'item') {
  // Render item emoji at tile, pulsing glow based on rarity
  var rarityColor = {
    common: '#CCCCCC', uncommon: '#00CC00',
    rare: '#3399FF', epic: '#AA00FF', legendary: '#FFD700'
  }[wi.rarity] || '#FFFFFF';
  _drawWorldEmoji(wi.x, wi.y, wi.emoji, rarityColor);
}
```

Confirm `_drawWorldEmoji` or equivalent helper exists. If not, use the same pattern as key rendering (direct canvas `fillText` or DOM element placement).

**File 2:** `tutorial-floors.js` — Add Flipper Zero to floor 0 breakable

Find the breakable nearest the ancient snail test enemy on floor 0. Add:

```javascript
{ x: NN, y: MM, emoji: '📦', name: 'Supply Crate', hp: 1,
  drops: { itemId: 'ITM-103' } }
```

**File 3:** `items.json` — Add ITM-103 Flipper Zero definition (see below).

**Estimated lines:** ~40

---

## Phase 4+ — Polish (Future)

These are NOT required for the tutorial Flipper Zero to work. Defer to a dedicated sprint.

1. **Rarity glow pulse animation** — CSS keyframe or canvas glow cycle for rare+ world items (subtle breathe effect).

2. **Fly-to pickup animation** — Item emoji arcs from ground position to inventory HUD slot. Currently all pickups use a static OverheadAnimator popup.

3. **LootTableManager random item rolls** — Add `items: [{ id: 'ITM-###', chance: 0.05, weight: 1 }]` schema to `breakable_loot` config so items can drop randomly alongside ammo/currency, not just via designer-placed `drops.itemId`.

4. **Item decay visual** — Pulsing/fading opacity in the last 5 seconds before `decayTime` expires and the item vanishes.

5. **Inventory full rejection feedback** — If `addToPersistent` returns `success: false` (slots full), show a tooltip: "INVENTORY FULL — drop something first." Item stays on ground instead of vanishing.

6. **Map Designer integration** — Breakable property inspector in unified-designer.html exposes a dropdown for `drops.itemId` populated from items.json registry.

7. **Consumable auto-use on pickup** — Items with `autoUseOnPickup: true` (like Wax Impression Kit) apply effects immediately instead of going to inventory. Needs a flag check in the pickup handler.

---

## ITM-103 Flipper Zero — Item Definition

```json
{
  "id": "ITM-103",
  "name": "Flipper Zero",
  "emoji": "📙",
  "type": "equipment",
  "rarity": "uncommon",
  "stackable": false,
  "maxStack": 1,
  "equipSlot": "passive",
  "effects": [
    {
      "type": "key_ammo_on_floor_start",
      "min": 1,
      "max": 5,
      "seedrandom": true
    }
  ],
  "synergyTags": [
    "covert",
    "theft",
    "tech",
    "economy"
  ],
  "description": "Compact multi-tool radio. Grants 1-5 key_ammo at each floor start (quality varies by signal strength). Your skeleton key to the airwaves.",
  "_designNote": "ENI Phase 0 primary key_ammo mitigation. Guaranteed drop from tutorial floor 0 Supply Crate near ancient snail. The 1-5 range uses seedrandom(floorSeed + 'flipper') so the grant is deterministic per floor but varies run-to-run. Average 3/floor = ~15 key_ammo over 5 floors — generous enough that theft builds don't starve, but SWAP (2 cost) still requires thought. Competes with combat passives for the slot. Replaces ITM-098 Skeleton Keyring as the primary thief economy item since Flipper Zero is guaranteed early and has higher yield."
}
```

**key_ammo grant logic** (to be wired in floor-start callback):

```javascript
// In floor init (gone-rogue.js or tutorial-floor-gen.js):
var flipper = _findPassiveItem('ITM-103');
if (flipper) {
  var rng = new Math.seedrandom(floorSeed + 'flipper');
  var grant = Math.floor(rng() * 5) + 1; // 1-5
  GAMESTATE.addKeyAmmo(grant);
  DebriefFeedController.reportResourceChange(
    'key_ammo', oldKeyAmmo, oldKeyAmmo + grant, '📙 Flipper Zero +' + grant
  );
}
```

---

## Dependency Order

```
Phase 1 (pickup-system.js)
    ↓
Phase 2 (breakable-system.js)  ← requires Phase 1 so picked-up items go somewhere
    ↓
Phase 3 (renderer + tutorial + ITM-103 data)  ← requires Phase 2 so breakable spawns work
    ↓
Phase 4+ (polish)  ← independent, can ship anytime after Phase 3
```

**Total estimated effort:** ~105 lines of new code across 4 files (Phases 1-3).

---

## Files Referenced

| File | Phase | Change Type |
|---|---|---|
| `public/js/pickup-system.js` | 1 | Modify `_addToInventory()` else branch |
| `public/js/breakable-system.js` | 2 | Add `_spawnItemDrop()`, call from `_spawnBreakableLoot()` |
| `public/js/gone-rogue-mobile.js` | 3 | Add `_wt: 'item'` render branch |
| `public/js/tutorial-floors.js` | 3 | Add Supply Crate with `drops.itemId: 'ITM-103'` |
| `public/data/gone-rogue/items.json` | 3 | Add ITM-103 Flipper Zero |
| `public/js/gone-rogue.js` (or floor init) | 3 | Wire seedrandom key_ammo grant on floor start |
