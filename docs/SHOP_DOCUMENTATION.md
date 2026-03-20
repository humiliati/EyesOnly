# Prize Vendor — /games Shop System

## Overview

The Prize Vendor is an ice cream truck–themed shop overlay on the `/games` page. Players exchange **cryptos (¢)** currency for game items and gamble for loot. The vendor reads its stock from `items.json` at runtime, supports 24-hour rotating buyback slots with daytime/nighttime availability windows, and integrates with the platform-wide `AccountInventory` system.

## Architecture

```
items.json ──→ ArcadeVendor._loadItemsRegistry() ──→ FIXED_CATALOG (3 platform items)
                                                  ──→ BUYBACK_POOL  (day/night rotation)
                                                  ──→ GAMBLE_ITEMS  (weighted loot pools)

localStorage('eyesonly_gamestate').cryptos ←──→ _getCryptos() / _spendCryptos()
AccountInventory (localStorage) ←──→ _addItemToInventory() / _refreshGamesInventory()
```

### Key files

| File | Purpose |
|------|---------|
| `public/js/arcade-vendor.js` | Vendor module — catalog loading, purchasing, gamble, touch drag, overlay management |
| `public/css/arcade-vendor.css` | Vendor styling — ice cream header, palette, 3D carousel, overlay transitions |
| `public/data/gone-rogue/items.json` | Canonical item registry — vendor reads stock from here |
| `public/games.html` | Vendor row HTML + overlay modal markup |
| `public/js/account-inventory.js` | Platform inventory persistence (`AccountInventory`) |

## Currency

The vendor uses **cryptos (¢)**, the same currency earned and spent in Gone Rogue. Because `gamestate.js` (which defines `GAMESTATE`) is not loaded on the `/games` page, the vendor reads/writes cryptos directly from `localStorage('eyesonly_gamestate')`:

```javascript
// Read
var saved = JSON.parse(localStorage.getItem('eyesonly_gamestate') || '{}');
var balance = saved.cryptos || 0;

// Spend
saved.cryptos = Math.max(0, saved.cryptos - amount);
localStorage.setItem('eyesonly_gamestate', JSON.stringify(saved));
```

When `GAMESTATE` IS available (terminal context), the vendor prefers it via `GAMESTATE.getState().cryptos` and `GAMESTATE.addCryptos(-amount)`.

## Stock Categories

### 1. Fixed Catalog (always available)

Three platform items that are always in stock. These are identified by `FIXED_IDS` in the vendor module:

| ID | Item | Price | Widget? |
|----|------|-------|---------|
| ITM-200 | 🔍 Magnifying Glass | ¢80 | No — reveals porthole zones |
| ITM-202 | 💍 Decoder Ring | ¢120 | No — activates cipher puzzles |
| ITM-203 | 🧭 Baseplate Compass | ¢200 | **Yes** — compass widget overlay (`_widgetType: "compass"`) |

### 2. Buyback Rotation (24-hour schedule)

One rotating slot that changes daily at midnight. Items are filtered by `_vendorPool: "buyback"` in `items.json`. A date-seeded PRNG (mulberry32, seed = `YYYYMMDD`) ensures every player sees the same buyback item on a given day.

**Day/Night Availability:**
Items can declare `_vendorAvailability` in items.json:

| Value | Window | Hours |
|-------|--------|-------|
| `"day"` | Daytime only | 06:00 – 20:00 |
| `"night"` | Nighttime only | 20:00 – 06:00 |
| `"always"` (default) | 24 hours | — |

**Current buyback pool:**

| ID | Item | Base Price | Markup | Availability |
|----|------|-----------|--------|-------------|
| ITM-204 | ⌚ Smart Watch | ¢150 | +30% = ¢195 | always |
| ITM-205 | 🔴 Signal Flare | ¢90 | +30% = ¢117 | day |
| ITM-206 | 🌙 Night Optic | ¢180 | +30% = ¢234 | night |

Buyback items have a **30% markup** over their base price. The vendor prioritizes items the player does NOT currently own.

### 3. Gamble Carousel (3D rotating cards)

Eight cards in a CSS 3D perspective carousel (`perspective(800px)`, 45° Y-rotation steps). Each card has a type that determines its loot pool:

| Type | Cards | Price Range | Description |
|------|-------|-------------|-------------|
| standard | 4 | ¢60–¢80 | Most common; weighted toward cheap charms |
| cursed | 2 | ¢120–¢150 | Cursed items with mixed blessings |
| binary | 1 | ¢250 | 50/50: legendary key or literal dust |
| empty | 1 | ¢40 | 75% nothing, 25% Lucky Penny |

Gamble loot pools are built dynamically from items tagged `_vendorPool: "gamble"` in items.json. Each item declares `_gambleTier` (string or array) and `_gambleWeight`.

## items.json Vendor Tags

Items in the registry can declare vendor-specific metadata:

```json
{
  "_vendorItem": true,
  "_vendorPool": "buyback | gamble",
  "_vendorAvailability": "always | day | night",
  "_gambleTier": "standard | cursed | binary",
  "_gambleWeight": 70,
  "_widgetItem": true,
  "_widgetType": "compass | debrief_feed",
  "_platformItem": true
}
```

| Field | Type | Description |
|-------|------|-------------|
| `_vendorItem` | boolean | Marks item as vendor-relevant |
| `_vendorPool` | string | Which pool: `"buyback"` (rotating slot) or `"gamble"` (carousel loot) |
| `_vendorAvailability` | string | Time window: `"day"`, `"night"`, or `"always"` |
| `_gambleTier` | string or string[] | Which gamble card type(s) this item appears in |
| `_gambleWeight` | number | Relative drop weight within its tier |
| `_widgetItem` | boolean | True if item unlocks a browser overlay widget |
| `_widgetType` | string | Widget identifier (e.g., `"compass"`, `"debrief_feed"`) |
| `_platformItem` | boolean | True if item is a platform-level persistent item |

## Widget Items

Widget items are special equipment that unlocks persistent browser overlays. They are flagged with `_widgetItem: true` and `_widgetType` in items.json.

| ID | Widget | Overlay |
|----|--------|---------|
| ITM-203 | Compass | Navigation compass overlay on all pages |
| ITM-204 | Smart Watch | MOK debrief feed + audio controls on all pages |

Widget items are sold through the vendor's fixed catalog (Compass) and buyback rotation (Smart Watch). They can also be disposed of (incinerated via debrief feed drag), which removes the widget — players must repurchase from the vendor.

## Purchasing Flow

### Click Purchase (desktop + mobile)
1. Player clicks a prize bar in the palette
2. `_handlePurchase()` checks balance and ownership
3. Cryptos deducted → item added to `AccountInventory`
4. Prize bar animates to "SOLD" state
5. `/games` inventory grid refreshes via `_refreshGamesInventory()`

### Drag Purchase (mobile touch)
1. Player touch-drags a prize bar toward screen edge
2. After 15px threshold, ghost element appears + overlay minimizes
3. Inventory row auto-expands, scrolls into view
4. Player drops ghost onto empty inventory slot
5. `_completeDragPurchase()` deducts currency and populates slot
6. Overlay restores after 300ms

## Overlay Behavior

The vendor overlay uses `z-index: 960` with `isolation: isolate` to punch through CRT scanlines.

- **Open:** Click the 🍦 PRIZE VENDOR row header → overlay fades in
- **Minimize:** During touch drag, overlay shrinks to corner (class `vendor-minimized`)
- **Restore:** After drag drop or cancel, overlay returns to full size
- **Close:** Click dim backdrop or ✕ button

The vendor row header uses `data-target="vendor-body-none"` (intentionally non-existent) so the existing row toggle handler returns early — the vendor opens its overlay instead of toggling a row body.

## Adding New Vendor Items

1. Add the item to `items.json` with the appropriate `_vendor*` tags
2. If it's a fixed catalog item, add its ID to `FIXED_IDS` array in `arcade-vendor.js`
3. If it has a custom price, add to `PRICE_TABLE`
4. If it has a custom palette color, add to `COLOR_TABLE`
5. Buyback and gamble items are auto-discovered from their tags — no code changes needed

## Inventory Slot CSS

The inventory grid uses a flex→grid layout chain that requires `min-width: 0` at each level to prevent items from escaping the viewport on mobile:

```
#log-column       → min-width: 0; overflow-x: hidden
  .inventory-grid → min-width: 0; overflow: hidden
    .inventory-items → min-width: 0; align-content: start
```

Mobile override (`@media max-width: 767px`): 4-column grid, `flex: 0 0 auto` for natural height sizing.
