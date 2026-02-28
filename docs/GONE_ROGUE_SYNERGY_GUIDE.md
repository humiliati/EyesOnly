# Gone Rogue Synergy System - Implementation Guide

## Overview

This document provides a comprehensive guide to the Gone Rogue Synergy System, including environmental item synergies (key+gate interactions), combat card synergies, and non-combat card selection mechanics.

---

## Table of Contents

1. [Environmental Synergy System](#environmental-synergy-system)
2. [Combat Card Synergy](#combat-card-synergy)
3. [Non-Combat Card Selection](#non-combat-card-selection)
4. [Integration Guide](#integration-guide)
5. [Testing Checklist](#testing-checklist)

---

## Environmental Synergy System

### Key + Gate Interactions

The environmental synergy system enables players to collect key items from breakable objects and use them to unlock gates throughout the game world.

### Key Types

Four key types with varying rarity and compatibility:

#### RUSTY_KEY (Common)
- **Emoji**: 🔑
- **Drop Rate**: 50% of key drops
- **Compatible Gates**: Wooden Gate, Old Door
- **Consumable**: Yes (destroyed on use)
- **Description**: "An old, rusted key. Might open something..."

#### BRONZE_KEY (Uncommon)
- **Emoji**: 🗝️
- **Drop Rate**: 30% of key drops
- **Compatible Gates**: Bronze Gate, Museum Door
- **Consumable**: Yes
- **Description**: "A tarnished bronze key with ornate markings."

#### KEYCARD (Rare)
- **Emoji**: 💳
- **Drop Rate**: 15% of key drops
- **Compatible Gates**: Security Door, Lab Entrance
- **Consumable**: No (reusable)
- **Description**: "Electronic access card. Still has charge."

#### MASTER_KEY (Very Rare)
- **Emoji**: 🔐
- **Drop Rate**: 5% of key drops
- **Compatible Gates**: All gates
- **Consumable**: No (reusable)
- **Description**: "Opens all standard locks."

### Gate Types

Six gate types placed throughout levels:

| Gate Type | Emoji | Compatible Keys | Unlock Emoji | Unlock Message |
|-----------|-------|----------------|--------------|----------------|
| Wooden Gate | 🚧 | Rusty Key, Master Key | ✓ | "The gate creaks open..." |
| Old Door | 🚪 | Rusty Key, Master Key | ✓ | "The door unlocks with a click." |
| Bronze Gate | 🚪 | Bronze Key, Master Key | ✨ | "Ancient mechanisms grind open..." |
| Security Door | 🚪 | Keycard, Master Key | ⚡ | "Security door unlocks with a beep." |
| Museum Door | 🚪 | Bronze Key, Master Key | 🏛️ | "The museum door opens silently." |
| Lab Entrance | 🚪 | Keycard, Master Key | 🔬 | "Airlock hisses open." |

### Drag-and-Drop Mechanics

#### Key to Gate
1. Player picks up key item from breakable object
2. Key appears in inventory header
3. Player drags key from header
4. Hovers over game map → gate highlights if nearby and compatible
5. Drops on gate → synergy animation triggers
6. **Success**: Double emoji stack (key + gate) with unlock emoji burst
7. **Failure**: Shake animation with "This key doesn't fit..." message

#### Item Destruction
1. Player drags any item from equipped slot
2. Hovers over debrief feed → destruction zone activates
3. Red border with "🗑️ DROP TO DESTROY" warning
4. Drops on debrief feed → confirmation dialog
5. **Confirm**: Incinerator animation (🔥) with fade to gray
6. **Cancel**: Item returns to inventory

### Visual Feedback

#### Gate Highlight
```css
.gate-highlight {
  animation: gate-pulse 1s ease-in-out infinite;
  /* Gold pulsing glow */
}
```

#### Synergy Overlay (Double Emoji Stack)
```css
.synergy-overlay {
  /* Key emoji bounces in from top */
  /* Gate emoji bounces in 0.1s later */
  /* Unlock emoji pulses in center */
  /* Total duration: 1.5s */
}
```

#### Incinerator Animation
```css
.incinerator-active {
  /* Background flashes orange */
  /* Fire emoji (🔥) bursts in center */
  /* Fades to gray ash */
  /* Duration: 0.8s */
}
```

### Drop Rates

Keys drop from breakable objects with the following rates:

- **Overall key drop chance**: 15% (per breakable)
- **Weighted distribution**:
  - Rusty Key: 50% (most common)
  - Bronze Key: 30%
  - Keycard: 15%
  - Master Key: 5% (rarest)

Special biome-specific rates:
- **Bushes in Cozy Forest**: 25% key chance (tutorial area)
- Keys can drop: Rusty Key, Bronze Key

### API Reference

#### EnvironmentalSynergy Module

```javascript
// Initialize system
EnvironmentalSynergy.init();

// Register a gate in the current floor
EnvironmentalSynergy.registerGate({
  x: 15,
  y: 10,
  type: 'WOODEN_GATE'
});

// Check if key can unlock gate
var canUnlock = EnvironmentalSynergy.canUnlock('RUSTY_KEY', 'WOODEN_GATE');
// Returns: true/false

// Attempt to unlock a gate
var result = EnvironmentalSynergy.attemptUnlock('RUSTY_KEY', gateObject);
// Returns: { success, message, consumeKey, animation }

// Check if gate is unlocked
var isUnlocked = EnvironmentalSynergy.isGateUnlocked(15, 10);

// Clear gates on floor change
EnvironmentalSynergy.clearGates();
```

#### EnvironmentalDragDrop Module

```javascript
// Initialize drag-drop system
EnvironmentalDragDrop.init();

// Handle drag start from inventory
EnvironmentalDragDrop.handleDragStart({
  sourceZone: 'equipped_slot',
  itemId: 'RUSTY_KEY',
  itemData: keyObject
});

// Handle drag end
EnvironmentalDragDrop.handleDragEnd();

// Get current context
var context = EnvironmentalDragDrop.getCurrentContext();
// Returns: 'key_to_gate', 'item_destruction', or 'idle'
```

---

## Combat Card Synergy

### Synergy Tags

Cards now have synergy tags that enable the existing synergy-engine.js to detect and apply combo bonuses.

### Tag Categories

#### Damage Types
- `fire` - Fire damage/DoT
- `explosive` - AOE explosives
- `tech` - Technology-based attacks
- `melee` - Close-range physical
- `ranged` - Distance attacks
- `precision` - Accuracy-based

#### Resource Generation
- `energy_gen` - Generates energy
- `battery_gen` - Generates battery
- `ammo_gen` - Restores ammo
- `fatigue_reduce` - Reduces fatigue

#### Combat Patterns
- `combo_starter` - Initiates combos
- `combo_finisher` - Completes combos
- `chain` - Chain actions
- `burst` - High damage burst
- `sustained` - Continuous effect

#### Tactical
- `stealth` - Stealth actions
- `aggressive` - Offensive tactics
- `defensive` - Protective tactics
- `mobile` - Movement-based
- `control` - Enemy manipulation

#### Environment Synergy (Phase 6)
- `bind` - Applies `bound` status; enables ranged follow-up chains
- `ranged_chain` - Ranged card that benefits from a preceding bind/setup effect
- `structural` - Interacts with level structures (levers, doors, gates)
- `environmental_trigger` - Activates a hidden mechanism or tile-based event (secret passage, trap release)

### Cards with Synergy Tags

#### Attack Cards
- **Single Shot**: ranged, precision
- **Burst Shot**: ranged, burst, aggressive
- **Silent Shot**: ranged, stealth, precision
- **Explosive Shot**: explosive, burst, aoe, aggressive
- **Suppressive Fire**: sustained, control, ranged
- **Grenade**: explosive, aoe, burst
- **Melee Strike**: melee, aggressive
- **High Ground**: ranged, precision

#### Defense Cards
- **Block**: defensive
- **Dodge**: defensive, mobile
- **Prone**: defensive, stealth
- **Kneel**: defensive, precision

#### Movement Cards
- **Close Distance**: aggressive, mobile
- **Retreat**: defensive, mobile
- **Strafe**: defensive, mobile
- **Roll**: defensive, mobile, chain

#### Setup Cards
- **Aim**: precision, combo_starter
- **Cigarettes**: fatigue_reduce, combo_starter
- **Katchup**: chain
- **Rations**: fatigue_reduce, energy_gen

#### Tech Cards
- **Jammer**: tech, control
- **Virus**: tech, fire, sustained

### Synergy Examples

#### Energy Dump Synergy
```javascript
// Tags required: energy_gen → burst/aoe
// Bonus: +50% damage, refund 1 energy
Rations (energy_gen) → Burst Shot (burst) = Enhanced damage
```

#### Precision Execution
```javascript
// Tags required: precision → ranged
// Bonus: Guaranteed crit, +80% damage
Aim (precision, combo_starter) → Single Shot (ranged, precision) = Critical hit
```

#### Aggressive Momentum
```javascript
// Tags required: chain aggressive actions
// Bonus: +2 damage per stack, max +10
Close Distance (aggressive) → Melee Strike (aggressive) = Momentum bonus
```

#### Bind & Blast (Environment Synergy — Phase 6)
```javascript
// Tags required: bind → ranged_chain (target must have 'bound' status)
// Bonus: +20 accuracy for next ranged attack; target gains Exposed (1 turn)
// Enemy card chain: Rope (bind, ranged_chain) → Pistol Shot / Basic Shot (ranged)
Rope (bind) → Pistol Shot (ranged_chain) = Bind & Blast combo
```

#### Ghost Passage (Covert Environment — Phase 6)
```javascript
// Tags required: environmental_trigger + covert
// Condition: undetected OR on statue_tiles ground
// Bonus: stealth preserved (1 turn); silent reposition; noise −5
// Enemy card: Secret Button (covert, environmental_trigger)
// Player use: stolen Secret Button lets player reposition via same passage network
Secret Button (environmental_trigger, covert) [while undetected] = Ghost Passage combo
```

---

## Non-Combat Card Selection

### Contextual Mode

The hand fan component now supports "contextual mode" for non-combat card usage, where cards can be selected outside of STR combat and used contextually.

### Features

#### Persistent Selection
- Only one card can be selected at a time
- Selection persists until card is used
- Gold border with bouncing arrow indicator (▶)
- Different visual style from combat selection

#### Auto-Minimize
- Hand fan minimizes after card use
- Provides visual feedback that action was processed
- Hand can be restored for next selection

#### Visual Indicators
```css
/* Gold highlight for selected card */
.hand-fan-contextual-mode .hand-card.hand-card-selected {
  border-color: #ffd700;
  box-shadow: 0 0 25px rgba(255, 215, 0, 0.9);
  transform: translateY(-10px) scale(1.05);
}

/* Bouncing arrow above selected card */
.hand-card-selected::before {
  content: '▶';
  animation: selected-bounce 0.6s infinite;
}
```

### API Reference

#### HandFanComponent - Contextual Methods

```javascript
// Select a card in contextual mode
HandFanComponent.selectContextualCard(2); // Select card at index 2

// Get the currently selected contextual card
var selectedCard = HandFanComponent.getContextualCard();
// Returns: card object or null

// Clear selection and minimize hand (after card use)
HandFanComponent.clearContextualSelection();

// Check if in contextual mode
var isContextual = HandFanComponent.isContextualMode();
// Returns: true/false

// Set mode to contextual
HandFanComponent.setMode('contextual', 'bottom');
// Mode: 'combat' or 'contextual'
// Position: 'centered' or 'bottom'
```

### Usage Flow

1. **Open Hand**: Player taps to view available cards
2. **Select Card**: Player taps card → gold highlight appears with arrow
3. **Use Card**: Player taps map/NPC → card effect triggers
4. **Minimize**: Hand minimizes automatically
5. **Restore**: Hand reopens for next selection

### Integration with Game Systems

#### Grid Tap Usage
```javascript
// When player taps grid cell
var selectedCard = HandFanComponent.getContextualCard();
if (selectedCard) {
  // Apply card effect to grid position
  applyCardEffect(selectedCard, gridX, gridY);

  // Clear selection and minimize
  HandFanComponent.clearContextualSelection();

  // Show feedback in debrief feed
  DebriefFeedRenderer.addMessage('Used ' + selectedCard.name);
}
```

#### NPC Encounter Usage
```javascript
// When entering STR combat
var selectedCard = HandFanComponent.getContextualCard();
if (selectedCard && selectedCard.synergyTags.includes('aggressive')) {
  // Apply STR combat entrance bonus
  combatAdvantage = 'ambush';
  initialDamageBonus += 2;

  // Clear selection
  HandFanComponent.clearContextualSelection();
}
```

---

## Integration Guide

### Required Integration Points

The following integrations are needed in `gone-rogue.js` to fully wire the synergy systems:

#### 1. Environmental Synergy Initialization

```javascript
// In start() function, after floor generation
if (typeof EnvironmentalSynergy !== 'undefined') {
  EnvironmentalSynergy.init();
  console.log('[GoneRogue] Environmental synergy initialized');
}

if (typeof EnvironmentalDragDrop !== 'undefined') {
  EnvironmentalDragDrop.init();
  console.log('[GoneRogue] Environmental drag-drop initialized');
}
```

#### 2. Key Item Pickup

```javascript
// When player collects item from breakable
function _collectItem(x, y) {
  var item = _grid[y][x].item;

  // Check if item is a key
  if (EnvironmentalSynergy.isKeyItem(item.id)) {
    // Add to inventory
    GAMESTATE.addToInventory(item);

    // Show tooltip
    if (typeof TooltipSystem !== 'undefined') {
      var keyInfo = EnvironmentalSynergy.getKeyInfo(item.id);
      TooltipSystem.show(keyInfo.emoji + ' ' + keyInfo.name, 2000);
    }

    // Overhead animation
    if (typeof OverheadAnimator !== 'undefined') {
      OverheadAnimator.showExpression(x, y, 'INSPECTING', 1000);
    }
  }

  // Remove from grid
  delete _grid[y][x].item;
}
```

#### 3. Gate Registration During Floor Generation

```javascript
// In _generateFloor() function
function _generateFloor() {
  // ... existing generation code ...

  // Place gates strategically
  if (typeof EnvironmentalSynergy !== 'undefined') {
    EnvironmentalSynergy.clearGates();

    // Add gates to rooms
    rooms.forEach(function(room) {
      // Place gate at room entrance (example)
      if (Math.random() < 0.3) { // 30% chance per room
        var gateX = room.x + Math.floor(room.width / 2);
        var gateY = room.y;

        // Register gate
        EnvironmentalSynergy.registerGate({
          x: gateX,
          y: gateY,
          type: 'WOODEN_GATE'
        });

        // Add to breakables array for rendering
        _breakables.push({
          x: gateX,
          y: gateY,
          emoji: '🚧',
          name: 'Wooden Gate',
          hp: 3,
          blocksPath: true
        });
      }
    });
  }
}
```

#### 4. Contextual Card Usage on Grid Tap

```javascript
// In _processGridInput() (mobile) or click handler (desktop)
function _handleGridTap(gridX, gridY) {
  // Check for contextual card selection
  if (typeof HandFanComponent !== 'undefined' && HandFanComponent.isContextualMode()) {
    var selectedCard = HandFanComponent.getContextualCard();

    if (selectedCard) {
      // Apply card effect based on card type
      var result = _applyContextualCard(selectedCard, gridX, gridY);

      if (result.success) {
        // Clear selection and minimize hand
        HandFanComponent.clearContextualSelection();

        // Show feedback
        if (typeof DebriefFeedRenderer !== 'undefined') {
          DebriefFeedRenderer.addMessage(result.message, 'card_use');
        }

        // Remove card from hand if consumable
        if (selectedCard.lifecycleType === 'disposable') {
          _removeCardFromHand(selectedCard);
        }
      }

      return; // Don't process normal grid tap
    }
  }

  // Normal grid tap logic
  // ...
}
```

#### 5. Save/Load Integration

```javascript
// In _saveState()
function _saveState() {
  var state = {
    // ... existing state ...
    environmentalSynergy: EnvironmentalSynergy.serialize()
  };

  localStorage.setItem('gone_rogue_state', JSON.stringify(state));
}

// In _loadState()
function _loadState() {
  var state = JSON.parse(localStorage.getItem('gone_rogue_state'));

  // ... existing state restoration ...

  if (state.environmentalSynergy && typeof EnvironmentalSynergy !== 'undefined') {
    EnvironmentalSynergy.deserialize(state.environmentalSynergy);
  }
}
```

---

## Testing Checklist

### Environmental Synergy Tests

- [ ] Key item drops from breakable (15% chance observed)
- [ ] Key appears in inventory with tooltip
- [ ] Drag key from inventory to game map
- [ ] Gate highlights when key is nearby and compatible
- [ ] Gate doesn't highlight for incompatible key
- [ ] Double emoji stack animation plays on successful unlock
- [ ] Gate is removed from map after unlock
- [ ] Consumable keys are removed after use
- [ ] Reusable keys (Keycard, Master Key) remain in inventory
- [ ] Item destruction shows confirmation dialog
- [ ] Incinerator animation plays on destruction
- [ ] Unlocked gates persist in save/load

### Combat Synergy Tests

- [ ] Synergy tags correctly assigned to all cards
- [ ] Energy dump synergy (+50% damage) triggers
- [ ] Precision execution (guaranteed crit) triggers
- [ ] Aggressive momentum stacks correctly
- [ ] Combo starter → finisher chains work
- [ ] Synergy UI shows active combos
- [ ] Synergy bonuses apply in STR combat

### Contextual Card Selection Tests

- [ ] Single card selection works (tap to select)
- [ ] Gold highlight with bouncing arrow appears
- [ ] Only one card selected at a time
- [ ] Selection persists across hand minimizes
- [ ] Card effect applies on grid tap
- [ ] Hand minimizes after card use
- [ ] Selection clears after card use
- [ ] Debrief feed shows card usage message
- [ ] Consumable cards removed from hand
- [ ] Persistent cards remain in hand

### Mobile Portrait Tests

- [ ] Synergy animations scale correctly on mobile
- [ ] Touch drag-and-drop works for keys
- [ ] Gate highlights visible on small screens
- [ ] Contextual card selection works with touch
- [ ] Animations run at 60fps on mobile
- [ ] No layout breaking on portrait orientation

---

## File Reference

### New Files
- `public/js/environmental-synergy.js` - Core synergy system
- `public/js/environmental-drag-drop.js` - Drag-drop interactions
- `public/css/environmental-synergy.css` - Synergy animations

### Modified Files
- `public/js/card-system.js` - Added synergy tags
- `public/js/hand-fan-component.js` - Added contextual mode
- `public/css/hand-fan-component.css` - Contextual styling
- `public/data/loot-tables.json` - Key item drops
- `public/index.html` - Script integration

### Dependencies
- `synergy-engine.js` - Existing synergy detection
- `tooltip-system.js` - Tooltip display
- `overhead-animator.js` - Expression animations
- `debrief-feed-renderer.js` - Message display
- `gamestate.js` - State management
- `resource-manager.js` - Resource tracking

---

## Future Enhancements

### Phase 2 Features
- Environmental combos (water + electricity, oil + fire)
- Multi-key gates (require 2+ keys)
- Gate puzzle sequences
- Timed gate unlocks
- Key crafting system

### Phase 3 Features
- Card fusion synergies
- Equipment synergy bonuses
- Boss-specific synergies
- Synergy achievement tracking
- Leaderboard for synergy mastery

---

**Last Updated**: 2026-02-20
**Version**: 1.0
**Status**: Core systems implemented, integration pending
