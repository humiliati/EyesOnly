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

### 6. Items
- **Pickup**: `GAMESTATE.addToLoose(item)` — card vault / items inventory (account-wide shared bag)
- **If full**: Item stays on map with tooltip "Make room in your inventory"
- **Overhead**: PancakeStack with item emoji
- **No RESOURCE_COLOR** — items are inventory objects

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

## Anti-Patterns (DO NOT)

- DO NOT add collectible types outside the 9 canonical categories
- DO NOT skip the debrief feed reportResourceChange call for resource pickups
- DO NOT use hardcoded colors — always reference RESOURCE_COLORS
