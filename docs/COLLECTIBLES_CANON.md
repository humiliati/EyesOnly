# Collectibles Canon — Authoritative Reference

**Effective**: 2026-03-01
**Supersedes**: All prior ad-hoc collectible handling

---

## Canonical Categories

Only these 9 categories exist. Any collectible not in one of these categories is to be removed from the game.

| # | Category | Symbol | RESOURCE_COLOR | Hex | Pickup Behavior |
|---|----------|--------|---------------|-----|-----------------|
| 1 | **Currency** | ¢ | Yellow | `#FFFF00` | Instant resource pickup, currency counter ticks update |
| 2 | **Ammo** | ⁍ | Magenta | `#DA70D6` | Instant resource pickup, debief feed frame flashes corresponding color, ammo row in debreif feed updates |
| 3 | **Battery** | ◈ | Cyan | `#00FFA6` | Instant resource pickup, debreif feed frame flashes corresponding color, battery row in debrief feed updates |
| 4 | **Food** | Per-category emoji | HP`#FF6B9D` glow under the emoji / Fatigue`#A0522D`glow under the emoji / Focus `#FFF9B0` glow under the emoji / Energy `#00D4FF` glow under the emoji| HP, Fatigue, Focus, Energy instant resource pickup, debrief frame flashes resource color per-effect on pickup, debreif row ticks update for focus & energy instantly - HP and Fatigue debreif row ticks update slowly and deliberately over time (HOTs) |
| 5 | **Cards** | 🂠 | Purple | `#800080` | Instant resource pickup to hand which pushes oldest card to backup deck, oldest card in deck pushes to incinerate |
| 6 | **Items** | 🎒 | White glow under emoji |  | Card vault item inventory |
| 7 | **Key Items** (T2) | Per-category emoji | Gold glow under emoji | `#FFD700` | Instant resource pickup to equipped item slot, which pushes existing equipped item card vault item inventory, oldest item in the inventory pushes to incincerator |
| 8 | **Key Ammo** (T1) | 🗝 | Gold | `#FFD700` | debreif feed frame flashes corresponding color, Resource counter in debrief feed updates |
| 9 | **Quest Keys** (T3) | Per-category emoji | Red glow under emoji | `#FF4444` | must be clicked on to be picked up, lack of inventory room prints tooltip notification |

---

## Unified Pickup Pipeline

All collectibles follow at least this 6-step pipeline. Currency is the gold standard implementation.

1. **Detect** item at player position
2. **Apply** resource via GAMESTATE method
3. **Remove** from floor (WorldItems.filterFloorItems/filterCurrencies or InteractiveItems.removeItem)
4. **Animate** overhead with RESOURCE_COLOR via OverheadAnimator.showGenericExpression()
5. **Report** to debrief feed via DebriefFeedController.reportResourceChange() — frame flashes RESOURCE_COLOR
6. **Notify** via TooltipSystem + UIControls.updateMokInterjection

---

## Category Details

### 1. Currency (¢) — KNOWN WORKING GOLD STANDARD
- **GAMESTATE method**: `addCryptos(amount)`
- **Removal**: `WorldItems.filterCurrencies()`
- **Overhead**: `OverheadAnimator.showCurrencyPickup(x, y, amount)` — yellow "+N¢" text
- **Debrief**: Updates crypto counter
- **Color**: `#FFFF00` yellow

### 2. Ammo (⁍)
- **GAMESTATE method**: `addAmmo(amount)`
- **Removal**: `WorldItems.filterFloorItems()`
- **Overhead**: `OverheadAnimator.showGenericExpression(x, y, '⁍', 800, '#DA70D6')`
- **Debrief**: `reportResourceChange('Ammo', old, new, reason)` — magenta frame flash
- **Color**: `#DA70D6` magenta

### 3. Battery (◈)
- **GAMESTATE method**: `rechargeBattery(amount)`
- **Removal**: `WorldItems.filterFloorItems()`
- **Overhead**: `OverheadAnimator.showGenericExpression(x, y, '◈', 800, '#00FFA6')`
- **Debrief**: `reportResourceChange('Battery', old, new, reason)` + `triggerBatteryRecharge()` — cyan-green frame flash
- **Color**: `#00FFA6` cyan-green (NOT cyan #00ffff)

### 4. Food (emoji)
- **Source**: `FoodDatabase.applyFoodEffects(foodId, player)`
- **Effects**: HP, Fatigue, Focus, Energy, Ammo bonus, Currency bonus, status removal
- **Removal**: `InteractiveItems.removeItem(foodItem.id)`
- **Overhead**: `OverheadAnimator.showGenericExpression(x, y, emoji, 1000, primaryColor)` — glow under emoji matches primary effect:
  - HP-primary foods → HP Pink `#FF6B9D` glow
  - Fatigue-primary foods → Fatigue Brown `#A0522D` glow
  - Focus-primary foods → Focus Yellow-White `#FFF9B0` glow
  - Energy-primary foods → Energy Blue `#00D4FF` glow
- **Debrief**: Reports **each changed resource individually** with its own RESOURCE_COLOR:
  - HP changed → `reportResourceChange('HP', ...)` — `#FF6B9D` frame flash — **HOT**: ticks slowly over time
  - Fatigue changed → `reportResourceChange('Fatigue', ...)` — `#A0522D` frame flash — **HOT**: ticks slowly over time
  - Focus changed → `reportResourceChange('Focus', ...)` — `#FFF9B0` frame flash — instant update
  - Energy changed → `reportResourceChange('Energy', ...)` — `#00D4FF` frame flash — instant update
  - Ammo changed → `reportResourceChange('Ammo', ...)` — `#DA70D6` frame flash
  - Currency changed → `reportResourceChange('Currency', ...)` — `#FFFF00` frame flash
- **Tooltip**: `TooltipSystem.showGeneric(tooltipText, 2000)` — shows all effects ("+20 HP, -15 Fatigue")
- **Note**: Food items are InteractiveItems with `autoPickup: true`
- **HP tracking**: HP lives on `_player.hp`/`_player.maxHp` in gone-rogue.js (NOT in gamestate.js). Debrief-feed-controller.js pulls from `GoneRogue.getPlayer()`. See Resource Management section below.

### 5. Cards (🂠)
- **Symbol on map**: Monochrome card symbol `🂠` in Card Purple `#800080` (NOT card emoji — emoji reserved for NCH capsule and enemy hand display)
- **Pickup**: `GAMESTATE.addCard(card)` — tries hand first
- **Overflow**: If hand full, oldest card pushed from hand to backup deck (left column). Oldest card in deck pushed to incinerator
- **NCH Capsule**: Equipped hand shown as 🃏 joker emojis; new card pickup triggers "shift down" animation pushing oldest joker off to deck
- **Overhead**: `OverheadAnimator.showGenericExpression(x, y, '🂠', 800, '#800080')` — purple
- **Debrief**: `reportResourceChange('Cards', old, new, cardName)` — purple frame flash
- **Color**: `#800080` card purple

### 6. Items (Equipment / Consumables)
- **Source**: `GoneRogueDataRegistry.getItem(itemId)` resolves ITM-### from items.json
- **Spawn**: Breakable with `drops: { itemId: 'ITM-###' }` → `BreakableSystem._spawnItemDrop()` → `WorldItems.addItem()` with `type: 'item'`
- **Pickup**: Passive/Active → `GAMESTATE.addToPersistent(item)`, else → `GAMESTATE.addToLoose(item)` — routed by `equipSlot` in `PickupSystem._addToInventory()`
- **If full**: Item stays on map with tooltip "Make room in your inventory"
- **Overhead**: `OverheadAnimator.showGenericExpression(x, y, emoji, 1000, rarityColor)` — rarity-tinted (common=#CCCCCC, uncommon=#00CC00, rare=#3399FF, epic=#AA00FF, legendary=#FFD700)
- **Tooltip**: `TooltipSystem.show(emoji + ' ' + name + slotLabel, 2500)` — slotLabel is `[EQUIPPED]` or `[INVENTORY]`
- **Debrief**: `DebriefFeedController.reportResourceChange('Cards', 0, 0, emoji + ' ' + name)` — logs item to feed
- **Map render**: Emoji at 0.6x scale, bob enabled, white glow `#FFFFFF` under emoji, ellipse shadow
- **Map color**: `#FFFFFF` white glow (NOT cyan `#00FFFF` — see Known Issue below)
- **Fixed (2026-03-06)**: Renderer fallback at `gone-rogue-mobile.js:872` was `#00FFFF` cyan — corrected to `#FFFFFF` white per this canon. Default emoji changed from `💎` to `📦`.

### 7. Key Items (Tier 2+)
- **Pickup**: `GAMESTATE.addToPersistent(item)` — persistent inventory (survives death)
- **Auto-equip**: `GAMESTATE.setActiveItem(item)` + `UIControls.setActiveItem(item)`
- **If full**: Item stays on map with tooltip "Make room in your inventory for this important door key"
- **Purpose**: Interact with gates and locks in the gone-rogue-grid game world map
- **Overhead**: Gold `#FFD700` expression, 1200ms
- **Color**: `#FFD700` gold

### 8. Key Ammo (Tier 1)
- **Symbol**: 🗝
- **Pickup**: Counted as resource, NOT placed in inventory
- **GAMESTATE method**: `addKeyCount(keyType, tier)`
- **Debrief**: `reportResourceChange('key_ammo', oldTotal, newTotal, keyName)` — bright orange frame flash
- **Purpose**: Thief mechanics in STR combat (todo), auto-unlock chests on map walkover if player has key (todo)
- **Overhead**: `OverheadAnimator.showGenericExpression(x, y, emoji, 800, '#FF8A3D')` — bright orange
- **Color**: `#FF8A3D` bright orange

### 9. Quest Keys (Tier 3)
- **Pickup**: `GAMESTATE.addToPersistent(item)` — NO auto-equip
- **If full**: Item stays on map with tooltip
- **Purpose**: Return to specific NPC for quest completion
- **Overhead**: Red `❗` expression, 1500ms, `#FF4444`
- **Color**: `#FF4444` red

---

## RESOURCE_COLORS — Single Source of Truth

Defined in `debrief-feed-renderer.js` `_getResourceColor()` and `debrief-feed-controller.js` RESOURCE_COLORS:

```
HP:       #FF6B9D  (vibrant pink)
Energy:   #00D4FF  (electric blue)
Focus:    #FFF9B0  (bright yellow-white)
Battery:  #00FFA6  (sickly cyan-green)
Fatigue:  #A0522D  (earthy brown)
Ammo:     #DA70D6  (magenta-purple)
Currency: #FFFF00  (twinkly gold)
Key Ammo: #FF8A3D  (bright orange)
Cards:    #800080  (card purple)
```

These colors are permanent per resource. No percentage-based color changes. Frame animations provide gain/loss feedback using the resource's own color.

---

## Resource Management — Where Resources Live

| Resource | Managed By | Getter | Notes |
|----------|-----------|--------|-------|
| **HP** | `_player.hp` / `_player.maxHp` in gone-rogue.js | `GoneRogue.getPlayer().hp` | NOT in gamestate.js. Debrief pulls via `GoneRogue.getPlayer()` |
| **Energy** | `_state.playerEnergy` in gamestate.js | `GAMESTATE.getEnergy()` | Also on `_player.energy` in gone-rogue.js |
| **Focus** | `_state.playerFocus` in gamestate.js | `GAMESTATE.getFocus()` | Also on `_player.focus` in gone-rogue.js |
| **Battery** | `_state.playerBattery` in gamestate.js | `GAMESTATE.getBattery()` | |
| **Fatigue** | `_state.playerFatigue` in gamestate.js | `GAMESTATE.getFatigue()` | |
| **Ammo** | `_state.playerAmmo` in gamestate.js | `GAMESTATE.getAmmo()` | |
| **Currency** | `_state.cryptos` in gamestate.js | `GAMESTATE.getCryptos()` | |
| **Key Ammo** | `_state.keyCounts` in gamestate.js | `GAMESTATE.getTotalKeyAmmo()` | |

**Known issue**: `debrief-feed-renderer.js _getResources()` references `state.playerHP` which does not exist in gamestate.js — falls back to 12. The debrief-feed-controller.js correctly sources HP from `GoneRogue.getPlayer()` and overrides this.

**HP HOT behavior**: HP and Fatigue changes from food should tick slowly in the debrief display (heal-over-time). Focus and Energy food changes update instantly. HOT animation is not yet implemented in code — currently all food effects report instantly.

---

## Map Rendering Specification — Collectibles vs Interactables

All 9 collectible categories share a unified visual language on the map, distinct from interactable objects.

### Collectible Animation: Bob with Ellipse Shadow

Every collectible on the map bobs vertically and casts an ellipse ground shadow that scales inversely with bob height (higher bob = smaller shadow, implying more height).

| Property | Value | Source |
|----------|-------|--------|
| **Animation** | Vertical bob on Y-axis | `gone-rogue-canvas.js` line 559 |
| **Amplitude** | ±2px | `Math.sin(t) * 2` |
| **Period** | ~1.6 seconds | `now * 0.004` |
| **Phase offset** | `(x*7 + y*13) % 100 * 0.1` | Per-position deterministic — prevents sync |
| **Shadow shape** | Flat ellipse via `ctx.ellipse()` | `_drawDropShadow()` |
| **Shadow size** | `radiusX = 0.32 * cellSize`, `radiusY = 0.11 * cellSize` | Same for all collectibles |
| **Shadow opacity** | `0.28 * shadowScale` | Scales inversely with bob offset |
| **Shadow Y** | `(y + 0.78) * cellSize` | Fixed ground plane, does NOT bob |

### Collectible Scale by Category

| Category | Scale | collectibleType | Glyph Source |
|----------|-------|-----------------|-------------|
| Currency (¢) | 1.0x | `resource` | Symbol char |
| Ammo (⁍) | 1.0x | `resource` | Symbol char |
| Battery (◈) | 1.0x | `resource` | Symbol char |
| Key Ammo T1 (🗝) | 1.0x | `resource` | Symbol char |
| Cards (🂠) | 1.1x | `card` | Fixed symbol |
| Food | 0.6x | `emoji` | Per-food emoji |
| **Items** | **0.6x** | **`emoji`** | **Per-item emoji from items.json** |
| Key Items T2 | 0.6x | `emoji` | Per-key emoji |
| Quest Keys T3 | 0.6x | `emoji` | Per-key emoji |

### Interactable Animation: Pulse (NOT Bob)

Interactable objects (ropes, buttons, signs, levers, breakable chests) **pulse** instead of bobbing. This visually distinguishes "things you interact with" from "things you pick up."

| Property | Value | Source |
|----------|-------|--------|
| **Animation** | Scale pulse (grow/shrink) | `gone-rogue-canvas.js` line 567 |
| **Amplitude** | ±10% scale | `Math.sin(t) * 0.1` |
| **Period** | ~2 seconds | `now * 0.003` |
| **Phase offset** | `(x*5 + y*11) % 100 * 0.1` | Per-position deterministic |
| **Shadow** | Standard ellipse (NO inverse scaling — shadow is constant) | Fixed size |
| **Bob** | NONE — interactables do NOT bob vertically | `bobEnabled: false` |

**Doctrine**: Collectibles bob. Interactables pulse. Breakable chests that cost key_ammo are interactables (pulse).

---

## Multi-Drop Scatter — Same-Tile Loot Spread

When a breakable drops multiple collectibles (e.g., ammo + currency + item), they all currently spawn at `breakable.x, breakable.y` with no offset. Post-combat loot uses a different strategy: `CurrencySpawning.scatterPostCombatNodes()` spreads nodes to adjacent integer grid tiles via shuffled 8-directional offsets.

### Current Behavior

| Loot Source | Scatter Strategy | Result |
|-------------|-----------------|--------|
| **Post-combat enemy** | Adjacent tile scatter (integer coords) | 1–3 nodes on neighboring tiles |
| **Breakable destruction** | No scatter — all at `breakable.x, breakable.y` | Multiple items stack on exact same center |
| **Floor generation** | No scatter — room center | Single item per spawn point |

### Required Behavior (Phase 3+ Item Drop Pipeline)

When multiple items spawn on the same tile from a single breakable, they should:

1. **Occupy the same tile** — all items at grid coordinate `(breakable.x, breakable.y)`
2. **Sub-pixel jitter** — each item gets a small random offset within the tile so they're not stacked exactly at center, creating a natural "scattered pile" look
3. **Overlap contained to tile** — jitter should be small enough that items don't visually drift into neighboring tiles (max ±0.25 cell offset)
4. **Gentle collision** — items should appear to collide softly, not overlap identically

**Proposed jitter implementation** (not yet coded — Phase 4+ polish):
```
For each item spawned at (x, y):
  jitterX = (rng() - 0.5) * 0.4   // ±0.2 cells
  jitterY = (rng() - 0.5) * 0.3   // ±0.15 cells
  renderX = x + jitterX
  renderY = y + jitterY
```

This keeps all items visually within the tile but with organic scatter. The jitter values should be stored on the world item object at spawn time so they're deterministic per-item (no per-frame jitter).

---

## Overhead Animation Priority Stack

The OverheadAnimator uses position-keyed slots (`_activeAnimations["x,y"]`). When multiple animations fire at the same position, `showGenericExpression()` stacks them into an array with `stackIndex` for vertical offset. `showCurrencyPickup()` queues behind existing animations.

### Implicit Priority (by duration and visual weight)

| Priority | Animation Type | Duration | Example |
|----------|---------------|----------|---------|
| **1 (highest)** | Quest Key T3 pickup | 1500ms | Red `❗` — longest, most urgent |
| **2** | Dialogue / Speech | 3000ms | `SPEECH` type — persistent, static position |
| **3** | Rope interaction bubbles | 800ms | `showGenericExpression(x, y, '🪢', 800)` |
| **4** | Key Item T2 pickup | 1200ms | Gold `🔑` |
| **5** | **Item pickup** | **1000ms** | **Rarity-tinted emoji** |
| **6** | Food pickup | 1000ms | Per-food emoji |
| **7** | Ammo / Battery / Card pickup | 800ms | Resource symbol or `🂠` |
| **8** | Key Ammo T1 pickup | 800ms | Orange `🗝` |
| **9 (lowest)** | Currency pickup | 200–1200ms | Yellow `+N¢` text |

**Note**: Priority is not enforced by a z-index system — it's implicit from duration, visual weight, and the stacking array order. Concurrent animations at the same position stack vertically with non-linear gap accumulation (5px base, tapering). The `_animationQueue` ensures currency animations don't overwrite existing animations — they wait in line.

**Items overhead priority**: Items use 1000ms duration, which slots them between Key Items T2 (1200ms) and resource pickups (800ms). This is correct — items are more significant than resource pickups but less urgent than key items or quest items.

---

## Items Drop Pipeline — End-to-End

### Spawn Path (Breakable → World)
```
breakable.drops.itemId = 'ITM-###'
  → BreakableSystem._spawnBreakableLoot(breakable, ctx)
    → BreakableSystem._spawnItemDrop(breakable, ctx)     ← Phase 2
      → GoneRogueDataRegistry.getItem(itemId)
      → WorldItems.addItem({ x, y, type:'item', itemId, emoji, name, rarity, ... })
```

### Render Path (World → Screen)
```
WorldItems.getAllForRendering()
  → tags item with _wt: 'item'
  → mobile renderer: generic else branch (line 870)
    → char = item.emoji, color = #FFFFFF, scale = 0.6x, bobEnabled = true
  → canvas renderer: standard bob + ellipse shadow pipeline
```

### Pickup Path (Player → Inventory)
```
Player walks over tile
  → PickupSystem.pickupItem(ctx)
    → _addToInventory()                                  ← Phase 1
      → GoneRogueDataRegistry.getItem(itemId)
      → equipSlot === 'passive'|'active' → GAMESTATE.addToPersistent(item)
      → equipSlot === 'none'             → GAMESTATE.addToLoose(item)
      → OverheadAnimator: emoji in rarityColor, 1000ms
      → TooltipSystem: emoji + name + [EQUIPPED]/[INVENTORY]
      → DebriefFeedController: reportResourceChange log
```

### Pipeline Status

| Phase | Component | Status | File |
|-------|-----------|--------|------|
| **Phase 1** | Pickup routing (dead-end fix) | ✅ Done | `pickup-system.js` |
| **Phase 2** | Breakable spawn path | ✅ Done | `breakable-system.js` |
| **Phase 3** | Map render `_wt:'item'` + tutorial wiring | Pending | `gone-rogue-mobile.js`, `tutorial-floors.js` |
| **Phase 4+** | Sub-pixel jitter, fly-to anim, decay visual | Polish | Multiple files |

---

## Anti-Patterns (DO NOT)

- DO NOT add collectible types outside the 9 canonical categories
- DO NOT skip the debrief feed reportResourceChange call for resource pickups
- DO NOT use hardcoded colors — always reference RESOURCE_COLORS
- DO NOT use `#00FFFF` cyan for items — items use `#FFFFFF` white glow under emoji
- DO NOT give interactables bob animation — interactables pulse, collectibles bob
- DO NOT use `showExpression('LOOT')` for any pickup — use `showGenericExpression()` with explicit RESOURCE_COLOR
- DO NOT spawn multi-drop items without jitter offset when jitter system is implemented (Phase 4+)
