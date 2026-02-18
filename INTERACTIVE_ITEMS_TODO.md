# Interactive Items & Overhead Animator - Engineering Integration Guide

## Overview
This document outlines the integration points for the new Overhead Animator and Interactive Items systems. These systems provide visual feedback for player interactions and enable designer-friendly item placement without code changes.

---

## 1. System Architecture

### 1.1 Core Modules
- **`overhead-animator.js`** - Animation system for icons/expressions above entities
- **`interactive-items.js`** - Interactive world item management
- **`item-spawner.js`** - Designer-friendly item placement engine

### 1.2 CSS Styling
- **`gone-rogue-mobile.css`** - Animation styles (lines 1186-1357)

---

## 2. Integration Checklist

### 2.1 HTML Integration
**File:** `/home/runner/work/EyesOnly/EyesOnly/public/index.html`

```html
<!-- Add before closing </body> tag -->
<script src="js/overhead-animator.js"></script>
<script src="js/interactive-items.js"></script>
<script src="js/item-spawner.js"></script>
```

**Priority:** HIGH
**Estimated Time:** 5 minutes

---

### 2.2 Game Engine Initialization
**File:** `/home/runner/work/EyesOnly/EyesOnly/public/js/gone-rogue.js`

#### Location: `start()` function (around line 303)

```javascript
// Initialize overhead animator
if (typeof OverheadAnimator !== 'undefined') {
  OverheadAnimator.init();
  console.log('[GoneRogue] Overhead animator initialized');
}

// Initialize interactive items
if (typeof InteractiveItems !== 'undefined') {
  InteractiveItems.init();
  console.log('[GoneRogue] Interactive items initialized');
}

// Initialize item spawner
if (typeof ItemSpawner !== 'undefined') {
  ItemSpawner.init();
  console.log('[GoneRogue] Item spawner initialized');
}
```

**Priority:** HIGH
**Estimated Time:** 10 minutes

---

### 2.3 Floor Generation Integration
**File:** `/home/runner/work/EyesOnly/EyesOnly/public/js/gone-rogue.js`

#### Location: `_generateFloor()` function (around line 750)

Add after enemy placement:

```javascript
// Step 13: Spawn interactive items
if (typeof ItemSpawner !== 'undefined' && typeof InteractiveItems !== 'undefined') {
  var spawnedItems = ItemSpawner.spawnItemsForFloor(_floor, rooms, _grid);
  spawnedItems.forEach(function(item) {
    InteractiveItems.addItem(item);
  });
  console.log('[GoneRogue] Spawned', spawnedItems.length, 'interactive items');
}
```

**Priority:** HIGH
**Estimated Time:** 15 minutes
**Note:** Requires access to `rooms` array from generation

---

### 2.4 Currency Pickup Animation
**File:** `/home/runner/work/EyesOnly/EyesOnly/public/js/gone-rogue.js`

#### Location: Currency collection logic (around line 1700-1750)

Find the code that handles currency pickup (look for `_currencies` collection):

```javascript
// When player picks up currency
if (typeof OverheadAnimator !== 'undefined') {
  OverheadAnimator.showCurrencyPickup(_player.x, _player.y, currencyAmount);
}
```

**Priority:** MEDIUM
**Estimated Time:** 10 minutes
**Search Pattern:** Look for `_currencies` array and pickup logic

---

### 2.5 Enemy Alert Expression
**File:** `/home/runner/work/EyesOnly/EyesOnly/public/js/gone-rogue.js`

#### Location: Enemy awareness system (around line 2832-2864)

In `_updateEnemyAwareness()` function:

```javascript
// When enemy becomes alerted (awareness crosses threshold)
if (enemy.awareness >= 71 && previousAwareness < 71) {
  if (typeof OverheadAnimator !== 'undefined') {
    OverheadAnimator.showExpression(enemy.x, enemy.y, 'ALERT', 1000);
  }
}
```

**Priority:** HIGH
**Estimated Time:** 15 minutes
**Note:** Need to track previous awareness state

---

### 2.6 Interactive Item Rendering
**File:** `/home/runner/work/EyesOnly/EyesOnly/public/js/gone-rogue-mobile.js`

#### Location: `renderGrid()` function (around line 190)

Add after breakable/item rendering:

```javascript
// Render interactive items
if (typeof InteractiveItems !== 'undefined') {
  var interactiveItems = InteractiveItems.getAllItems();
  interactiveItems.forEach(function(item) {
    if (item.x === x && item.y === y) {
      cell.textContent = item.emoji;
      cell.classList.add('cell-interactive-item');

      // Add interaction indicator if player is in range
      if (player && typeof InteractiveItems.canInteractWith === 'function') {
        if (InteractiveItems.canInteractWith(player.x, player.y, item)) {
          cell.classList.add('interactive-in-range');
        }
      }
    }
  });
}
```

**Priority:** HIGH
**Estimated Time:** 20 minutes

---

### 2.7 Overhead Animation Rendering
**File:** `/home/runner/work/EyesOnly/EyesOnly/public/js/gone-rogue-mobile.js`

#### Location: `renderGrid()` function - AFTER grid cells are created

```javascript
// Render overhead animations
if (typeof OverheadAnimator !== 'undefined') {
  var currentTime = Date.now();
  OverheadAnimator.update(currentTime);

  var animations = OverheadAnimator.getAllAnimations();
  for (var key in animations) {
    var parts = key.split(',');
    var animX = parseInt(parts[0]);
    var animY = parseInt(parts[1]);
    var anim = animations[key];

    // Find corresponding cell
    var cellIndex = animY * grid[0].length + animX;
    var cell = _gridContainer.children[cellIndex];

    if (cell) {
      var transform = OverheadAnimator.calculateAnimationTransform(anim, currentTime);

      // Create animation element
      var animEl = document.createElement('div');
      animEl.className = 'overhead-animation ' + anim.type.toLowerCase().replace(/_/g, '-');
      animEl.textContent = anim.text || anim.emoji;
      animEl.style.color = anim.color;
      animEl.style.opacity = transform.opacity;
      animEl.style.transform = 'translate(' + transform.x + 'px, ' + transform.y + 'px) scale(' + transform.scale + ')';

      cell.appendChild(animEl);
    }
  }
}
```

**Priority:** HIGH
**Estimated Time:** 30 minutes
**Note:** Performance-sensitive - may need optimization

---

### 2.8 Interactive Item Command Handler
**File:** `/home/runner/work/EyesOnly/EyesOnly/public/js/gone-rogue.js`

#### Location: `process()` function command handling (around line 400-500)

Add new command:

```javascript
if (cmd === 'interact' || cmd === 'examine' || cmd === 'read') {
  return _handleInteraction();
}
```

Then add new function:

```javascript
function _handleInteraction() {
  if (typeof InteractiveItems === 'undefined') {
    return { lines: ['Nothing to interact with'], prompt: getPrompt(), stayActive: true };
  }

  // Find nearest interactive item
  var nearestItem = InteractiveItems.getNearestItem(_player.x, _player.y);

  if (!nearestItem) {
    return { lines: ['Nothing nearby to interact with'], prompt: getPrompt(), stayActive: true };
  }

  if (!InteractiveItems.canInteractWith(_player.x, _player.y, nearestItem)) {
    return { lines: ['Too far away to interact'], prompt: getPrompt(), stayActive: true };
  }

  // Perform interaction
  var result = InteractiveItems.interact(nearestItem, _player);

  if (result.success) {
    // Show overhead animation
    if (result.animation && typeof OverheadAnimator !== 'undefined') {
      OverheadAnimator.showExpression(
        _player.x,
        _player.y,
        result.animation.expressionKey,
        result.animation.duration
      );
    }

    // Show tooltip
    if (result.tooltip && typeof TooltipSystem !== 'undefined') {
      TooltipSystem.show(result.tooltip.message, result.tooltip.duration);
    }

    return {
      lines: ['Interacted with ' + nearestItem.name, '', nearestItem.text],
      prompt: getPrompt(),
      stayActive: true
    };
  }

  return { lines: ['Cannot interact with that'], prompt: getPrompt(), stayActive: true };
}
```

**Priority:** HIGH
**Estimated Time:** 25 minutes

---

### 2.9 Tap-to-Interact (Mobile)
**File:** `/home/runner/work/EyesOnly/EyesOnly/public/js/gone-rogue-mobile.js`

#### Location: `_processGridInput()` function (around line 531)

Before tap-to-move logic:

```javascript
// Check if tapping interactive item
if (typeof InteractiveItems !== 'undefined') {
  var item = InteractiveItems.getItemAt(x, y);
  if (item && InteractiveItems.canInteractWith(player.x, player.y, item)) {
    // Trigger interaction
    GoneRogue.process('interact');
    return;
  }
}
```

**Priority:** MEDIUM
**Estimated Time:** 15 minutes

---

### 2.10 Save/Load Integration
**File:** `/home/runner/work/EyesOnly/EyesOnly/public/js/gone-rogue.js`

#### Location: `_saveState()` function

```javascript
// Save interactive items
if (typeof InteractiveItems !== 'undefined') {
  state.interactiveItems = InteractiveItems.serialize();
}
```

#### Location: `_loadState()` function

```javascript
// Restore interactive items
if (state.interactiveItems && typeof InteractiveItems !== 'undefined') {
  InteractiveItems.deserialize(state.interactiveItems);
}
```

**Priority:** MEDIUM
**Estimated Time:** 10 minutes

---

## 3. CSS Classes for Interactive Items

### 3.1 Required CSS (add to gone-rogue-mobile.css)

```css
/* Interactive item indicator */
.cell-interactive-item {
  cursor: pointer;
}

.interactive-in-range {
  position: relative;
}

.interactive-in-range::after {
  content: '⭐';
  position: absolute;
  top: -5px;
  right: -5px;
  font-size: 10px;
  animation: interactive-pulse 1.5s ease-in-out infinite;
}
```

**Priority:** LOW
**Estimated Time:** 5 minutes
**Note:** Already included in overhead-animator CSS section

---

## 4. Designer Workflow

### 4.1 Adding New Items
Designers can add items by editing `item-spawner.js` ITEM_DEFINITIONS:

```javascript
'CUSTOM_001': {
  itemId: 'CUSTOM_001',
  itemName: 'My Custom Item',
  category: 'Readable',
  baseEmoji: '📋',
  defaultExpression: 'THINKING',
  interactionType: 'text_display',
  breakable: false,
  biomes: ['office'],
  spawnWeight: 25,
  spawnConditions: 'floor_clear',
  lightingAffected: false
}
```

Add corresponding text in TEXT_LIBRARY:

```javascript
'CUSTOM_001': [
  'First possible text...',
  'Second possible text...',
  'Third possible text...'
]
```

**No code compilation required!**

---

### 4.2 Adjusting Spawn Rates
Edit SPAWN_RATES in `item-spawner.js`:

```javascript
var SPAWN_RATES = {
  early: { minItems: 2, maxItems: 4, interactiveChance: 0.3 },
  mid: { minItems: 3, maxItems: 6, interactiveChance: 0.5 },
  late: { minItems: 4, maxItems: 8, interactiveChance: 0.7 }
};
```

---

### 4.3 External JSON Loading (Future Enhancement)
To load from external JSON:

```javascript
// In game initialization
fetch('data/item-definitions.json')
  .then(response => response.json())
  .then(data => ItemSpawner.loadDefinitions(data));
```

---

## 5. Expression Vocabulary Reference

### 5.1 Alert/Awareness
- `ALERT` - ! (red) - Enemy spotted player
- `QUESTION` - ? (yellow) - Suspicious/investigating
- `SLEEPING` - 💤 (cyan) - Unaware/idle
- `WATCHING` - 👁️ (white) - Observing
- `SEARCH` - 🔍 (orange) - Searching for player

### 5.2 Interactions
- `THINKING` - 💭 (blue) - Reading/pondering
- `TALKING` - 💬 (white) - Speaking
- `READING` - 📖 (tan) - Reading text
- `INSPECTING` - 🔍 (yellow) - Examining object
- `LISTENING` - 👂 (blue) - Listening

### 5.3 Combat (Text-based)
- `CONFIDENT` - ^_^ (green) - Happy/confident
- `CRYING` - T_T (blue) - Hurt/crying
- `ANGRY` - >__< (red) - Angry/frustrated
- `DETERMINED` - \`_\´ (orange) - Serious
- `SURPRISED` - o_o (yellow) - Shocked
- `DEAD` - x_x (gray) - Defeated
- `SMIRK` - ¬_¬ (pink) - Confident

### 5.4 Status Effects
- `BURNING` - 🔥 (orange) - On fire
- `FROZEN` - ❄️ (cyan) - Frozen/slowed
- `SHOCKED` - ⚡ (yellow) - Electrocuted
- `POISONED` - ☠️ (green) - Poisoned
- `STUNNED` - 💫 (pink) - Dizzy
- `HEALING` - 💚 (green) - Regenerating

---

## 6. Testing Checklist

### 6.1 Functional Tests
- [ ] Overhead animator initializes without errors
- [ ] Currency pickup shows bouncing animation
- [ ] Enemy alert shows ! expression
- [ ] Interactive items spawn on floor generation
- [ ] Items render with correct emoji
- [ ] Player can interact with items in range
- [ ] Interaction shows thinking/reading expression
- [ ] Tooltip displays item text
- [ ] Multiple animations don't overlap incorrectly
- [ ] Animations expire after duration
- [ ] Save/load preserves interactive items

### 6.2 Performance Tests
- [ ] Animation rendering doesn't drop FPS
- [ ] Multiple simultaneous animations perform well
- [ ] Item spawning doesn't cause generation lag
- [ ] Large numbers of items (20+) render smoothly

### 6.3 Visual Tests
- [ ] Animations appear above entities
- [ ] Text is readable with shadow
- [ ] Colors match spec
- [ ] Currency bounce feels satisfying
- [ ] Expressions are clear and visible

---

## 7. Known Issues & Limitations

### 7.1 Current Limitations
- Maximum ~50 interactive items per floor (performance)
- Animations limited to 2D plane (no Z-axis)
- Text content stored in JS (not database)
- No animation queueing for same position

### 7.2 Future Enhancements
- [ ] Load item definitions from external JSON
- [ ] Support for animated emoji sequences
- [ ] 3D depth sorting for overlapping animations
- [ ] Speech bubble positioning relative to entity
- [ ] Animation prefab system for designers
- [ ] Visual item placement editor tool

---

## 8. Debug Commands

Add these temporary commands for testing:

```javascript
// Show all expressions at player position
if (cmd === 'testexpr') {
  Object.keys(OverheadAnimator.EXPRESSIONS).forEach(function(key, i) {
    setTimeout(function() {
      OverheadAnimator.showExpression(_player.x, _player.y, key, 2000);
    }, i * 2500);
  });
}

// Spawn test interactive item
if (cmd === 'testitem') {
  var item = InteractiveItems.createItem('BOOK', _player.x + 1, _player.y, {
    text: 'Debug test item'
  });
  InteractiveItems.addItem(item);
}
```

---

## 9. Contact & Support

For questions about integration:
- Check console logs for `[OverheadAnimator]`, `[InteractiveItems]`, `[ItemSpawner]` messages
- Review existing animation implementations in `gone-rogue-mobile.css`
- Test with browser dev tools Performance tab for optimization

---

## 10. Completion Criteria

System is ready for production when:
- ✅ All HIGH priority integrations complete
- ✅ Currency pickup animation visible in game
- ✅ Enemy alert expressions working
- ✅ Interactive items spawn and render
- ✅ Player can interact with items
- ✅ Save/load preserves state
- ✅ No console errors
- ✅ Performance stable (60 FPS)
- ✅ Visual QA pass

**Estimated Total Integration Time:** 3-4 hours
