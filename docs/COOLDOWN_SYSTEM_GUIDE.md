# Cooldown Tracking System - Usage Guide

## Overview

The cooldown tracking system allows powerful cards to be limited in frequency of use across combats, floors, or entire runs. This prevents overpowered cards from being spammed and adds strategic depth to deck management.

## Cooldown Types

### 1. Combat Cooldown
Card can be used once every N combats.

**Example:** THERMAL_VISION has a 3-combat cooldown - use it in combat 1, it becomes available again in combat 4.

### 2. Floor Cooldown
Card can be used once every N floors.

**Example:** SMOKE_SCREEN has a 1-floor cooldown - use it on floor 1, it becomes available again on floor 2.

### 3. Run Cooldown
Card can be used once per entire run (never refreshes).

**Example:** PERFECT_AMBUSH can only be used once in the entire run.

## Adding Cooldowns to Cards

In `card-system.js`, add cooldown properties to `baseStats`:

```javascript
THERMAL_VISION: {
  category: 'setup',
  type: 'power',
  name: 'Thermal Vision',
  emoji: '🔥',
  lifecycleType: 'power',
  baseStats: {
    visionBonus: 3,
    seeThroughWalls: true,
    battery: 1,
    energy: 2,
    speed: 2,
    cooldownCombat: 3,  // Combat cooldown
    combatPersistent: true
  }
}
```

**Cooldown Properties:**
- `cooldownCombat: N` - Combat cooldown of N combats
- `cooldownFloor: N` - Floor cooldown of N floors
- `oncePerRun: true` - Run cooldown (once per run)

## Using the CooldownManager

### 1. Create a Manager

```javascript
const cooldownManager = CooldownTracker.createManager();
```

### 2. Register Cards

When a card enters the player's deck or inventory:

```javascript
// Parse cooldown from card
const card = CardSystem.rollCard('THERMAL_VISION');
const cooldownConfig = CooldownTracker.parseCooldownFromCard(card);

// Register with unique card ID
if (cooldownConfig) {
  cooldownManager.registerCard(card.id, cooldownConfig);
}
```

### 3. Check Availability

Before allowing a card to be played:

```javascript
const currentCombat = GAMESTATE.getCombatCount();
const currentFloor = GAMESTATE.getFloorCount();

if (cooldownManager.isCardAvailable(card.id, currentCombat, currentFloor)) {
  // Card can be played
  playCard(card);
} else {
  // Card is on cooldown
  const info = cooldownManager.getCooldownInfo(card.id, currentCombat, currentFloor);
  console.log(`Card on cooldown. ${info.remaining} ${info.type}(s) remaining.`);
}
```

### 4. Apply Cooldown After Use

After a card is successfully played:

```javascript
const currentCombat = GAMESTATE.getCombatCount();
const currentFloor = GAMESTATE.getFloorCount();

cooldownManager.useCard(card.id, currentCombat, currentFloor);
```

### 5. Update Combat/Floor Counters

**After Each Combat:**
```javascript
GAMESTATE.incrementCombatCounter();
```

**When Ascending to Next Floor:**
```javascript
GAMESTATE.incrementFloorCounter();
```

## Integration Example

```javascript
// During combat setup
function startCombat() {
  // Create cooldown manager if not exists
  if (!game.cooldownManager) {
    game.cooldownManager = CooldownTracker.createManager();

    // Register all cards in inventory
    inventory.forEach(card => {
      const config = CooldownTracker.parseCooldownFromCard(card);
      if (config) {
        game.cooldownManager.registerCard(card.id, config);
      }
    });
  }
}

// Before playing a card
function canPlayCard(card) {
  const combat = GAMESTATE.getCombatCount();
  const floor = GAMESTATE.getFloorCount();

  // Check cooldown
  if (!game.cooldownManager.isCardAvailable(card.id, combat, floor)) {
    return false;
  }

  // Check other requirements (ammo, fatigue, etc.)
  // ...

  return true;
}

// After successfully playing a card
function onCardPlayed(card) {
  const combat = GAMESTATE.getCombatCount();
  const floor = GAMESTATE.getFloorCount();

  // Apply cooldown
  game.cooldownManager.useCard(card.id, combat, floor);

  // Apply other effects
  // ...
}

// After combat ends
function endCombat() {
  GAMESTATE.incrementCombatCounter();

  // Other end-of-combat logic
  // ...
}

// When ascending floors
function ascendFloor() {
  GAMESTATE.incrementFloorCounter();

  // Other floor progression logic
  // ...
}
```

## Persistence

The cooldown manager supports serialization for save/load:

```javascript
// Save game state
const cooldownData = game.cooldownManager.toJSON();
localStorage.setItem('cooldowns', JSON.stringify(cooldownData));

// Load game state
const savedData = JSON.parse(localStorage.getItem('cooldowns'));
game.cooldownManager.fromJSON(savedData);
```

## UI Display

To show cooldown status to the player:

```javascript
function getCardDisplayInfo(card) {
  const combat = GAMESTATE.getCombatCount();
  const floor = GAMESTATE.getFloorCount();
  const info = game.cooldownManager.getCooldownInfo(card.id, combat, floor);

  if (!info.available) {
    if (info.type === 'combat') {
      return `On cooldown: ${info.remaining} combat(s)`;
    } else if (info.type === 'floor') {
      return `On cooldown: ${info.remaining} floor(s)`;
    } else if (info.type === 'run') {
      return `Used this run`;
    }
  }

  return 'Available';
}
```

## Testing

Run the comprehensive test suite:

```
open public/tests/test-cooldown-system.html
```

Or from the test launcher:
```
open public/tests/index.html
```

The test suite includes 20 tests covering:
- All cooldown types
- Card registration and availability
- Cooldown application and expiration
- Multiple cards with different cooldowns
- Serialization/deserialization
- Integration with GAMESTATE

## Cards with Cooldowns

Current cards with cooldown mechanics:

| Card | Cooldown Type | Duration | Description |
|------|---------------|----------|-------------|
| THERMAL_VISION | Combat | 3 | See through walls, detect hidden enemies |
| ADRENALINE_SURGE | Combat | 2 | Massive attack/speed/accuracy boost |
| SMOKE_SCREEN | Floor | 1 | Create concealment, enemy accuracy penalty |
| PERFECT_AMBUSH | Run | 1 (once) | Guaranteed critical hit with damage multiplier |

## Best Practices

1. **Register cards when added to inventory** - Don't wait until combat
2. **Check availability before showing cards** - Disable/grey out unavailable cards in UI
3. **Update counters consistently** - Always call increment functions at appropriate times
4. **Serialize cooldowns with game state** - Include cooldown data in save files
5. **Show clear feedback** - Display cooldown status and remaining time to player
6. **Handle card removal** - Call `removeCard()` when cards are consumed or discarded

## API Reference

### CooldownTracker

**`createManager()`**
- Returns: `CooldownManager` instance
- Creates a new cooldown manager

**`parseCooldownFromCard(card)`**
- Parameters: `card` - Card object with baseStats
- Returns: `{type, duration}` or `null`
- Extracts cooldown config from card definition

### CooldownManager

**`registerCard(cardId, cooldownConfig)`**
- Parameters: `cardId` - Unique card instance ID, `cooldownConfig` - `{type, duration}`
- Registers a card with cooldown tracking

**`useCard(cardId, currentCombat, currentFloor)`**
- Parameters: `cardId`, `currentCombat`, `currentFloor`
- Returns: `boolean` - True if cooldown was applied
- Marks card as used and applies cooldown

**`isCardAvailable(cardId, currentCombat, currentFloor)`**
- Parameters: `cardId`, `currentCombat`, `currentFloor`
- Returns: `boolean` - True if card can be used
- Checks if card is available (not on cooldown)

**`getCooldownInfo(cardId, currentCombat, currentFloor)`**
- Parameters: `cardId`, `currentCombat`, `currentFloor`
- Returns: `{remaining, type, duration, available, usedAtCombat, usedAtFloor}`
- Gets detailed cooldown status

**`resetCard(cardId)`**
- Parameters: `cardId`
- Resets a card's cooldown (e.g., via special item)

**`removeCard(cardId)`**
- Parameters: `cardId`
- Removes card from tracking (e.g., card consumed)

**`getCardsOnCooldown(currentCombat, currentFloor)`**
- Parameters: `currentCombat`, `currentFloor`
- Returns: `Array` of `{cardId, cooldownInfo}`
- Lists all cards currently on cooldown

**`clear()`**
- Clears all cooldown data (e.g., end of run)

**`toJSON()`**
- Returns: `Object` - Serialized cooldown data
- For save/load

**`fromJSON(data)`**
- Parameters: `data` - Serialized cooldown data
- Loads cooldown state

### GAMESTATE

**`getCombatCount()`**
- Returns: `number` - Current combat count
- Gets the number of completed combats in current run

**`getFloorCount()`**
- Returns: `number` - Current floor number
- Gets the current floor in the run

**`incrementCombatCounter()`**
- Returns: `number` - New combat count
- Increments combat counter (call after each combat)

**`incrementFloorCounter()`**
- Returns: `number` - New floor number
- Increments floor counter (call when ascending)
