# Food and Interactive Items Implementation Guide

**Implementation Date**: 2026-02-20
**Systems**: Food Database, Picnic Blanket, Auto-Pickup, Visual Feedback

---

## Overview

This guide documents the implementation of the food system with picnic blanket spawning, auto-pickup mechanics, and visual feedback enhancements for the Gone Rogue roguelike game within the EyesOnly project.

### Design Principles

1. **ASCII floors, Emoji interactives**: Floor tiles are ASCII for clear pathing; walls and interactive items are emoji
2. **Auto-pickup for consumables**: Food items auto-pickup on player contact (like currency/ammo)
3. **Clean disappearance**: Items remove cleanly from map after pickup with overhead animations
4. **Visual feedback**: Water slowdown shows blue wave animation on window frame
5. **Designer-friendly**: No code changes needed to add new food items

---

## 1. Food Database System

### File: `public/js/food-database.js`

**Purpose**: Central database of food items that modify player status/resources

### Food Item Structure

```javascript
{
  id: 'FOOD_APPLE',
  name: 'Fresh Apple',
  emoji: '🍎',
  category: 'health',
  autoPickup: true,
  effects: {
    hp: 10,              // HP restoration
    fatigue: -5,         // Fatigue reduction (negative = restore)
    ammo: 0,             // Ammo restoration
    cryptos: 0,          // Currency bonus
    removeStatus: []     // Status effects to remove
  },
  tooltipText: '+10 HP, -5 Fatigue',
  spawnWeight: 40,
  biomes: ['forest', 'all']
}
```

### Food Categories

| Category | Purpose | Examples |
|----------|---------|----------|
| **health** | HP restoration | Apple, Bread, Pizza, Burger, Sushi |
| **energy** | Fatigue reduction | Coffee, Energy Drink, Tea |
| **special** | Multi-effect | Field Ration (HP+Ammo), Candy (HP+Currency) |
| **status** | Status removal | Water (removes burning/poisoned) |

### Implemented Food Items (13 total)

1. **FOOD_APPLE** - +10 HP, -5 Fatigue (forest biome)
2. **FOOD_BREAD** - +15 HP, -10 Fatigue (office/mall)
3. **FOOD_PIZZA** - +20 HP, -15 Fatigue (mall)
4. **FOOD_BURGER** - +25 HP, -20 Fatigue (mall)
5. **FOOD_SUSHI** - +30 HP, -10 Fatigue (mall/museum)
6. **FOOD_COFFEE** - +5 HP, -25 Fatigue (office)
7. **FOOD_ENERGY_DRINK** - +10 HP, -30 Fatigue (mall/plant)
8. **FOOD_TEA** - +8 HP, -15 Fatigue (museum/office)
9. **FOOD_RATION** - +35 HP, -20 Fatigue, +3 Ammo (plant/cave)
10. **FOOD_CANDY** - +5 HP, -5 Fatigue, +10¢ (mall)
11. **FOOD_DONUT** - +15 HP, -12 Fatigue (office/mall)
12. **FOOD_WATER** - +5 HP, -8 Fatigue, removes burning/poisoned (all biomes)
13. **FOOD_JUICE** - +12 HP, -10 Fatigue (mall/office)

### API Functions

```javascript
FoodDatabase.init()                              // Initialize system
FoodDatabase.getFoodItem(id)                     // Get food definition
FoodDatabase.getFoodItemsForBiome(biome)        // Get foods for biome
FoodDatabase.getRandomFoodItems(biome, count)   // Weighted random selection
FoodDatabase.applyFoodEffects(foodId, player)   // Apply effects to player
FoodDatabase.getPicnicBlanket()                 // Get picnic blanket def
```

---

## 2. Picnic Blanket System

### Item Definition

**File**: `public/js/item-spawner.js` → ITEM_DEFINITIONS

```javascript
'PICNIC_BLANKET': {
  itemId: 'PICNIC_BLANKET',
  itemName: 'Cozy Picnic Blanket',
  category: 'MovementPenalty',
  baseEmoji: '🧺',
  interactionType: 'movement_impediment',
  breakable: false,
  biomes: ['forest', 'cave', 'all'],
  spawnWeight: 15,
  movementPenalty: 0.5,        // 50% movement speed reduction
  foodSpawnCount: { min: 2, max: 3 },
  foodSpawnRadius: 2,           // Tiles around blanket
  lightingAffected: false
}
```

### Spawning Behavior

1. **Placement**: Picnic blanket spawns in room centers or clear floor areas
2. **Food Spawning**: When placed, spawns 2-3 food items within radius 2
3. **Food Selection**: Uses weighted random from biome-appropriate foods
4. **Position Validation**: Foods placed on valid floor tiles, not walls/occupied

### Movement Penalty

- **Penalty Value**: 50% (movementPenalty: 0.5)
- **Visual Feedback**: MOK tooltip shows "Cozy picnic area - slows movement"
- **No Overhead Animation**: Movement impediments don't trigger overhead animations (per requirements)
- **Future Integration**: Can hook into movement speed calculations

---

## 3. Auto-Pickup System

### Implementation: `public/js/gone-rogue.js` (lines 3150-3179)

```javascript
// Check for food item pickup (auto-pickup from interactive items)
if (typeof InteractiveItems !== 'undefined') {
  var foodItem = InteractiveItems.getItemAt(newX, newY);
  if (foodItem && foodItem.autoPickup && foodItem.type === 'FOOD') {
    // Capture before-values for ALL resources
    var hpBefore = _player.hp || 0;
    var fatigueBefore = _player.fatigue || 0;
    var ammoBefore = GAMESTATE.getAmmo ? GAMESTATE.getAmmo() : 0;
    var cryptosBefore = GAMESTATE.getCryptos ? GAMESTATE.getCryptos() : 0;

    var result = FoodDatabase.applyFoodEffects(foodItem.customData.foodId, _player);
    if (result.success) {
      // Determine overhead color from food category (per COLLECTIBLES_CANON.md)
      var foodDef = FoodDatabase.getFoodItem(foodItem.customData.foodId);
      var primaryColor = '#FF6B9D'; // HP pink default
      if (foodDef && foodDef.category === 'energy') {
        primaryColor = '#A0522D'; // Fatigue brown for energy foods
      }
      OverheadAnimator.showGenericExpression(x, y, result.emoji, 1000, primaryColor);

      // Report EACH changed resource individually to debrief feed
      if (typeof DebriefFeedController !== 'undefined') {
        var hpAfter = _player.hp || 0;
        var fatigueAfter = _player.fatigue || 0;
        var ammoAfter = GAMESTATE.getAmmo ? GAMESTATE.getAmmo() : 0;
        var cryptosAfter = GAMESTATE.getCryptos ? GAMESTATE.getCryptos() : 0;
        if (hpAfter !== hpBefore)
          DebriefFeedController.reportResourceChange('HP', hpBefore, hpAfter, result.foodName);
        if (fatigueAfter !== fatigueBefore)
          DebriefFeedController.reportResourceChange('Fatigue', fatigueBefore, fatigueAfter, result.foodName);
        if (ammoAfter !== ammoBefore)
          DebriefFeedController.reportResourceChange('Ammo', ammoBefore, ammoAfter, result.foodName);
        if (cryptosAfter !== cryptosBefore)
          DebriefFeedController.reportResourceChange('Currency', cryptosBefore, cryptosAfter, result.foodName);
      }

      // MOK interjection
      UIControls.updateMokInterjection(result.emoji + ' ' + result.foodName + ' consumed');

      // Tooltip
      TooltipSystem.showGeneric(result.tooltipText, 2000);

      // Remove food item from world (clean disappearance)
      InteractiveItems.removeItem(foodItem.id);
    }
  }
}
```

### Auto-Pickup Flow

1. **Detection**: Player walks onto tile with food item
2. **Validation**: Check `autoPickup` flag and `type === 'FOOD'`
3. **Effect Application**: Apply HP/fatigue/ammo/currency changes
4. **Visual Feedback**:
   - Overhead animation shows food emoji with **category-specific RESOURCE_COLOR**:
     - `category: 'health'` / `'status'` / `'special'` → **HP pink `#FF6B9D`**
     - `category: 'energy'` (Coffee, Energy Drink, Tea) → **Fatigue brown `#A0522D`**
   - Debrief feed reports **each changed resource individually** with its own RESOURCE_COLOR:
     - HP → `#FF6B9D` pink, Fatigue → `#A0522D` brown, Ammo → `#DA70D6` magenta, Currency → `#FFFF00` yellow
   - MOK interjection displays "[emoji] [name] consumed"
   - Tooltip shows effect text ("+20 HP, -15 Fatigue")
5. **Removal**: Item removed from InteractiveItems array (clean disappearance)

> **Important**: Food pickups use `showGenericExpression()` with explicit RESOURCE_COLOR, NOT `showExpression('LOOT')`. Energy foods use Fatigue brown, not HP pink. See `COLLECTIBLES_CANON.md` for the unified pickup pipeline.

### Similarities to Currency/Ammo

| Feature | Currency | Ammo | Battery | Food |
|---------|----------|------|---------|------|
| Auto-pickup | ✅ | ✅ | ✅ | ✅ |
| RESOURCE_COLOR overhead | ✅ #FFFF00 | ✅ #DA70D6 | ✅ #00FFA6 | ✅ #FF6B9D |
| Debrief reportResourceChange | ✅ | ✅ | ✅ | ✅ |
| MOK feedback | ✅ | ✅ | — | ✅ |
| Tooltip | ✅ | — | ✅ | ✅ |
| Clean removal | ✅ | ✅ | ✅ | ✅ |

---

## 4. Visual Feedback Systems

### 4.1 Ghost Collision Node → Overhead Animator

**Enhancement**: Custom emoji support in overhead animations

**File**: `public/js/overhead-animator.js`

```javascript
function showExpression(x, y, expressionKey, duration, customEmoji) {
  var expression = EXPRESSIONS[expressionKey];
  var animation = {
    type: 'EXPRESSION',
    emoji: customEmoji || expression.emoji,  // Override with custom emoji
    color: expression.color,
    startTime: Date.now(),
    duration: duration || ANIMATION_TYPES.EXPRESSION.duration
  };
  // ...
}
```

**Usage**:
```javascript
// Standard expression (uses EXPRESSIONS dictionary color — NOT for resource pickups)
OverheadAnimator.showExpression(x, y, 'LOOT', 1000);

// Resource pickup — use showGenericExpression with explicit RESOURCE_COLOR
OverheadAnimator.showGenericExpression(x, y, '🍎', 1000, '#FF6B9D');  // Food: HP pink
OverheadAnimator.showGenericExpression(x, y, '؋', 800, '#DA70D6');    // Ammo: magenta
OverheadAnimator.showGenericExpression(x, y, '◈', 800, '#00FFA6');    // Battery: cyan-green
```

> **DO NOT** use `showExpression('LOOT')` for resource pickups — LOOT uses cyan `#00ffff` which does not match any RESOURCE_COLOR. See `COLLECTIBLES_CANON.md`.

### 4.2 Water Slowdown Visual Feedback

**Requirement**: Blue wave animation on window frame when player enters water

**Implementation**: `public/js/gone-rogue.js` + `public/css/crt.css`

#### Detection Logic

```javascript
function _applyTileEffects(x, y) {
  // Check for ground effects (water, oil, etc.)
  if (typeof GroundEffects !== 'undefined') {
    var groundEffect = GroundEffects.getGroundAt(x, y);
    if (groundEffect && groundEffect.movePenalty) {
      // Apply visual feedback for water slowdown
      if (groundEffect.type === 'WATER' || groundEffect.char === '~') {
        _applyWaterSlowdownEffect();
      }
    }
  }
}
```

#### Visual Effect Function

```javascript
function _applyWaterSlowdownEffect() {
  var gameFrame = document.getElementById('game-frame') ||
                  document.querySelector('.game-window');

  if (gameFrame) {
    // Add water slowdown class for CSS animation
    gameFrame.classList.add('water-slowdown-effect');

    // Remove class after animation completes (1 second)
    setTimeout(function() {
      gameFrame.classList.remove('water-slowdown-effect');
    }, 1000);
  }
}
```

#### CSS Animation

```css
@keyframes water-wave-roll {
  0%   { box-shadow: inset 0 -100% 0 0 rgba(74, 144, 226, 0); }
  25%  { box-shadow: inset 0 -75%  0 0 rgba(74, 144, 226, 0.3); }
  50%  { box-shadow: inset 0 -50%  0 0 rgba(74, 144, 226, 0.5); }
  75%  { box-shadow: inset 0 -25%  0 0 rgba(74, 144, 226, 0.3); }
  100% { box-shadow: inset 0 0     0 0 rgba(74, 144, 226, 0); }
}

.water-slowdown-effect {
  animation: water-wave-roll 1s ease-out;
  border-color: rgba(74, 144, 226, 0.6) !important;
}
```

**Effect**: Blue wave rolls down from top to bottom over 1 second, border highlights blue

---

## 5. Integration Points

### 5.1 HTML Script Loading

**File**: `public/index.html` (line 268)

```html
<script src="js/overhead-animator.js"></script>
<script src="js/interactive-items.js"></script>
<script src="js/food-database.js"></script>  <!-- Added -->
<script src="js/item-spawner.js"></script>
```

### 5.2 Game Initialization

**File**: `public/js/gone-rogue.js` → start() function

```javascript
// Initialize food database
if (typeof FoodDatabase !== 'undefined') {
  FoodDatabase.init();
  console.log('[GoneRogue] Food database initialized');
}
```

### 5.3 Interactive Items System

**File**: `public/js/interactive-items.js`

Added FOOD item type:

```javascript
ITEM_TYPES = {
  // ... existing types
  FOOD: {
    emoji: '🍎',
    name: 'Food',
    interactionEmoji: 'none',
    tooltipPrefix: '',
    canInteract: true,
    breakable: false,
    autoPickup: true
  }
}
```

Added autoPickup property to item objects:

```javascript
var item = {
  // ... other properties
  autoPickup: config.autoPickup !== undefined ?
              config.autoPickup :
              (itemType.autoPickup || false)
};
```

---

## 6. Design Constraints Compliance

### Rule: Floors = ASCII, Walls/Interactives = Emoji

✅ **Compliant**:
- Food items: Emoji (🍎, ☕, 🍕, etc.)
- Picnic blanket: Emoji (🧺)
- Water tile: ASCII (`~`) per GroundEffects system
- Floor pathing: ASCII maintained

### Rule: No Ghost Collision Emojis

✅ **Compliant**:
- Food items spawn on valid floor tiles
- No invisible collision emojis used
- Overhead animations use temporary DOM elements (not grid tiles)

### Rule: Movement Penalties Show Tooltips

✅ **Compliant**:
- Picnic blanket: MOK tooltip (not overhead) for movement impediment
- Water: Visual frame animation (blue wave)
- Non-resource changing penalties don't use overhead animations

---

## 7. Procedural Generation Integration

### Food Spawning Flow

1. **Floor Generation** (gone-rogue.js → _generateFloor)
2. **Item Spawner Called** (line 1763-1769)
3. **Items Spawned** (ItemSpawner.spawnItemsForFloor)
4. **Picnic Blanket Check** (item-spawner.js line 368-374)
5. **Food Spawning** (_spawnFoodNearPicnic function)
6. **Food Items Created** (InteractiveItems.createItem with type 'FOOD')
7. **Items Added** (InteractiveItems.addItem)

### Biome-Aware Spawning

```javascript
// Biome mapping
var BIOME_FLOORS = {
  'cave': { min: 1, max: 4 },
  'office': { min: 5, max: 9 },
  'mall': { min: 11, max: 15 },
  'museum': { min: 17, max: 21 },
  'plant': { min: 23, max: 30 }
};

// Food items filtered by biome
FoodDatabase.getFoodItemsForBiome('mall')  // Returns mall-appropriate foods
```

---

## 8. Testing Checklist

### Food System
- [x] Food database initializes without errors
- [x] Food items spawn near picnic blankets (2-3 items)
- [x] Food auto-pickup on player contact
- [x] Food effects apply correctly (HP, fatigue, ammo, cryptos)
- [x] Food items disappear cleanly after pickup
- [x] Overhead animation shows correct food emoji
- [x] MOK interjection displays food name
- [x] Tooltip shows effect text

### Picnic Blanket
- [x] Picnic blanket spawns in appropriate biomes
- [x] Movement penalty defined (50%)
- [x] Food items spawn within radius 2
- [x] No duplicate food items at same position
- [x] Food placement validates floor tiles

### Visual Feedback
- [x] Water slowdown triggers blue wave animation
- [x] Animation completes in 1 second
- [x] Border highlights blue during effect
- [x] No performance issues with animation
- [x] Custom emoji support in overhead animator

### Integration
- [x] Scripts load in correct order
- [x] Systems initialize without conflicts
- [x] No console errors
- [x] Biome-aware food selection works
- [x] Position validation prevents invalid placement

---

## 9. Future Enhancements

### Planned Features (from problem statement)

1. **Tutorial Gate/Key Mechanics**
   - Item synergy database for key + gate interactions
   - Drag key from inventory to equip slot
   - Drag key from header to gate on map
   - Debrief feed unlock animation (key+gate emojis)

2. **Designer Portals**
   - Match existing designer portal patterns
   - No-code food item addition
   - Visual item placement editor

3. **Status Effect Integration**
   - Food items that remove specific status effects
   - Water removes burning/poisoned (defined but not fully integrated)

4. **Movement Penalty Calculations**
   - Hook picnic blanket movementPenalty into actual speed calculations
   - Combine with water penalty for stacking effects

---

## 10. File Changes Summary

| File | Changes | Lines |
|------|---------|-------|
| `public/js/food-database.js` | **NEW** - Food database system | 315 |
| `public/js/item-spawner.js` | Added picnic blanket, food spawning logic | +115 |
| `public/js/interactive-items.js` | Added FOOD type, autoPickup support | +10 |
| `public/js/gone-rogue.js` | Food pickup, water effect, initialization | +65 |
| `public/js/overhead-animator.js` | Custom emoji parameter support | +2 |
| `public/css/crt.css` | Water wave animation | +33 |
| `public/index.html` | Added food-database.js script | +1 |

**Total**: 541 lines added/modified

---

## 11. Memory Triggers

Store these facts for future sessions:

1. **Food System**: 13 food items with auto-pickup, biome-aware spawning
2. **Picnic Blanket**: Spawns 2-3 food items within radius 2, 50% movement penalty
3. **Auto-Pickup**: Food behaves like currency/ammo/battery — unified pickup pipeline (see `COLLECTIBLES_CANON.md`)
4. **Visual Feedback**: Water slowdown = blue wave animation on frame
5. **RESOURCE_COLOR**: All resource pickups use `showGenericExpression()` with their canonical RESOURCE_COLOR, NOT `showExpression('LOOT')`
6. **Design Rule**: ASCII floors, emoji interactives, no ghost collision emojis

---

**Implementation Complete**: 2026-02-20
**Systems Status**: ✅ Food database, ✅ Picnic blanket, ✅ Auto-pickup, ✅ Visual feedback
**Next Steps**: Item synergy database for tutorial gates, designer portals
