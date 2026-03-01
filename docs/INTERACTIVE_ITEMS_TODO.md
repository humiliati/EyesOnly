# Interactive Items & Overhead Animator - Engineering Integration Guide

## Overview
This checklist is now largely **implemented in code**. OverheadAnimator is integrated in both renderers, and InteractiveItems/ItemSpawner are initialized and serialized in `gone-rogue.js` with tap/command interactions wired. The remaining items below are kept as a quick status reference.

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

### 2.2 Game Engine Initialization — ✅ Implemented
Initialized in `gone-rogue.js` `start()` and floor bootstrap paths (`WorldItems.init()`, `InteractiveItems.init()`, `ItemSpawner.init()`). No action needed.

---

### 2.3 Floor Generation Integration — ✅ Implemented
`_generateFloor()` already calls `ItemSpawner.spawnItemsForFloor()` and pushes into `InteractiveItems`. Logged spawn counts remain available for debugging.

---

### 2.4 Currency Pickup Animation — ✅ Implemented
Currency pickup path uses `OverheadAnimator.showCurrencyPickup()` and PancakeStack; verified by `verify-collectibles-improvements.js` (stack spacing + starting offset).

---

### 2.5 Enemy Alert Expression — ✅ Implemented
Alert/panic expressions are already wired through `OverheadAnimator.showExpression()` in the enemy awareness pipeline; no additional code work pending.

---

### 2.6 Interactive Item Rendering — ✅ Implemented
Mobile renderer draws interactive items and range indicators via `InteractiveItems.getAllItems()`; tap-to-interact hooks live in `_processGridInput()`.

---

### 2.7 Overhead Animation Rendering — ✅ Implemented
Mobile grid renders OverheadAnimator animations; canvas parity also complete (see roadmap Phase 1). No further action.

---

### 2.8 Interactive Item Command Handler — ✅ Implemented
`process()` supports `interact/read/examine` with `_handleInteraction()` (tooltip + OverheadAnimator expression). Nearest-item detection and range gating are already present.

---

### 2.9 Tap-to-Interact (Mobile) — ✅ Implemented
`_processGridInput()` checks `InteractiveItems.getItemAt()` and dispatches `process('interact')` when in range.

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
