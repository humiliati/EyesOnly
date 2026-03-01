# Collectibles Canon — Authoritative Reference

**Effective**: 2026-03-01
**Supersedes**: All prior ad-hoc collectible handling

---

## Canonical Categories

Only these 9 categories exist. Any collectible not in one of these categories is to be removed from the game.

| # | Category | Symbol | RESOURCE_COLOR | Hex | Pickup Behavior |
|---|----------|--------|---------------|-----|-----------------|
| 1 | **Currency** | ¢ | Yellow | `#FFFF00` | Instant resource pickup |
| 2 | **Ammo** | ؋ | Magenta | `#DA70D6` | Instant resource pickup |
| 3 | **Battery** | ◈ | Cyan-Green | `#00FFA6` | Instant resource pickup |
| 4 | **Food** | emoji | Per-category | HP`#FF6B9D` / Fatigue`#A0522D` | Instant; debrief per-effect |
| 5 | **Cards** | emoji | — | — | Hand / backup deck / incinerate |
| 6 | **Items** | emoji | — | — | Card vault inventory |
| 7 | **Key Items** (T2) | emoji | Gold | `#FFD700` | Equipped slot / inventory |
| 8 | **Key Ammo** (T1) | emoji | Gold | `#FFD700` | Resource counter (debrief) |
| 9 | **Quest Keys** (T3) | emoji | Red | `#FF4444` | Inventory |

---

## Unified Pickup Pipeline

All collectibles follow this 6-step pipeline. Currency is the gold standard implementation.

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

### 2. Ammo (؋)
- **GAMESTATE method**: `addAmmo(amount)`
- **Removal**: `WorldItems.filterFloorItems()`
- **Overhead**: `OverheadAnimator.showGenericExpression(x, y, '؋', 800, '#DA70D6')`
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
- **Effects**: HP restoration, fatigue reduction, ammo bonus, currency bonus, status removal
- **Removal**: `InteractiveItems.removeItem(foodItem.id)`
- **Overhead**: `OverheadAnimator.showGenericExpression(x, y, emoji, 1000, primaryColor)` — color depends on food category:
  - `category: 'health'` / `'status'` / `'special'` → HP Pink `#FF6B9D`
  - `category: 'energy'` → Fatigue Brown `#A0522D`
- **Debrief**: Reports **each changed resource individually** with its own RESOURCE_COLOR:
  - HP changed → `reportResourceChange('HP', before, after, foodName)` — `#FF6B9D` frame flash
  - Fatigue changed → `reportResourceChange('Fatigue', before, after, foodName)` — `#A0522D` frame flash
  - Ammo changed (Field Ration) → `reportResourceChange('Ammo', before, after, foodName)` — `#DA70D6` frame flash
  - Currency changed (Candy) → `reportResourceChange('Currency', before, after, foodName)` — `#FFFF00` frame flash
- **Tooltip**: `TooltipSystem.showGeneric(tooltipText, 2000)` — shows all effects ("+20 HP, -15 Fatigue")
- **Note**: Food items are InteractiveItems with `autoPickup: true`

### 5. Cards
- **Pickup**: `GAMESTATE.addCard(card)` — tries hand first
- **Overflow**: If hand full, last card goes to backup deck
- **Deck overflow**: Last card in deck ejected and incinerated (debrief flash animation)
- **Overhead**: PancakeStack with card emoji
- **No RESOURCE_COLOR** — cards are not resources

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
- **Pickup**: Counted as resource, NOT placed in inventory
- **GAMESTATE method**: `addKeyCount(keyType, tier)`
- **Debrief**: `reportResourceChange('key_ammo', oldTotal, newTotal, keyName)`
- **Purpose**: Thief mechanics in STR combat (todo), auto-unlock chests on map walkover if player has key (todo)
- **Overhead**: Gold `#FFD700` expression, 800ms
- **Color**: `#FFD700` gold

### 9. Quest Keys (Tier 3)
- **Pickup**: `GAMESTATE.addToPersistent(item)` — NO auto-equip
- **If full**: Item stays on map with tooltip
- **Purpose**: Return to specific NPC for quest completion
- **Overhead**: Red `❗` expression, 1500ms, `#FF4444`
- **Color**: `#FF4444` red

---

## RESOURCE_COLORS — Single Source of Truth

Defined in `debrief-feed-renderer.js` `_getResourceColor()`:

```
HP:       #FF6B9D  (vibrant pink)
Energy:   #00D4FF  (electric blue)
Focus:    #FFF9B0  (bright yellow-white)
Battery:  #00FFA6  (sickly cyan-green)
Fatigue:  #A0522D  (earthy brown)
Ammo:     #DA70D6  (magenta-purple)
Currency: #FFFF00  (yellow)
```

These colors are permanent per resource. No percentage-based color changes. Frame animations provide gain/loss feedback using the resource's own color.

---

## Anti-Patterns (DO NOT)

- DO NOT use `showExpression('LOOT')` for collectible pickups — LOOT uses #00ffff cyan which is wrong for most resources
- DO NOT use generic green (#00ff00) or cyan (#00ffff) for pickup animations
- DO NOT add collectible types outside the 9 canonical categories
- DO NOT skip the debrief feed reportResourceChange call for resource pickups
- DO NOT use hardcoded colors — always reference RESOURCE_COLORS
