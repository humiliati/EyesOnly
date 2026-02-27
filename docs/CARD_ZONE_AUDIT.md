# Card Zone Boundaries & Equipment Capacity System - Implementation Audit

## Executive Summary

This document provides a comprehensive audit of the card zone boundaries and equipment capacity system implementation for the EYES ONLY game. The system enforces proper movement rules between card zones and implements dynamic action button capacity based on equipped items.

## 1. System Architecture

### 1.1 Zone Definitions

The system defines the following card zones:

- **HAND (Loose Inventory)**: ~~8 slots maximum~~ **CANON: 5 slots** (`maxHandSize: 5` in gamestate.js), lost on death
- **ACTION_BUTTONS**: ~~Variable capacity (base 4 + equipment bonuses)~~ **CANON: Left Column / RogueSidebar has 6 fixed slots** (`rogue-sidebar.js`). BAC retired.
- **INVENTORY (Persistent / Card Vault)**: 9-12 slots, safe across death, accessible only at bonfire/shop
- **ACTIVE_ITEM**: Equipment slot for items like trench coat
- **DISCARD**: Consumed cards (not yet fully implemented)
- **EXHAUST**: Exhausted cards (not yet fully implemented)
- **DECK**: Draw pile (not yet fully implemented)

### 1.2 Game Context States

The zone manager tracks different game states to enforce context-sensitive rules:

- **COMBAT_ACTIVE**: Active combat phase
- **COMBAT_PLANNING**: Combat planning phase
- **COMBAT_RESOLUTION**: Combat resolution phase
- **BONFIRE**: Safe hub with vendor access
- **SHOP**: Vendor interaction state
- **EXPLORATION**: Exploring floors
- **DEATH**: Death state

## 2. Zone Boundary Rules Matrix

| From → To | Rule | Context Restrictions |
|-----------|------|---------------------|
| Hand → Action Buttons | ✓ Allowed | Space available |
| Action Buttons → Hand | ✓ Allowed | 1 per turn during combat, space available |
| Action Buttons → Inventory | ✓ Allowed | Bonfire or shop only |
| Inventory → Action Buttons | ✓ Allowed | Bonfire or shop only, space available |
| Hand → Inventory | ✓ Allowed | Bonfire or shop only |
| Inventory → Hand | ✓ Allowed | Bonfire or shop only |
| Inventory ↔ Active Item | ✓ Allowed | Equip/unequip anytime |
| Hand → Active Item | ✗ Not allowed | Must go through inventory |
| Action Buttons → Active Item | ✗ Not allowed | Invalid movement |

## 3. Equipment Capacity System

### 3.1 Base Capacity

- **Default Action Button Slots**: ~~4 slots~~ **CANON: 6 slots (RogueSidebar)**
- **Loose Inventory (Hand)**: ~~8 slots (fixed)~~ **CANON: 5 slots** (`maxHandSize: 5`)
- **Persistent Inventory (Card Vault)**: 9-12 slots (expandable via cryptos)

### 3.2 Equipment Modifiers

Equipment items can modify action button capacity through the `actionButtonSlots` stat:

```javascript
// Example: Trench Coat
{
  name: 'Trench Coat',
  category: 'equipment',
  stats: {
    actionButtonSlots: 2,  // Provides +2 slots
    defense: 1,
    stealth: 1
  }
}
```

### 3.3 Capacity Calculation

```
Total Action Button Capacity = Base Capacity (4) + Equipment Bonus
```

Example:
- No equipment: 4 slots
- With trench coat: 6 slots (4 + 2)

## 4. Trench Coat Implementation

### 4.1 Item Properties

- **Category**: Equipment
- **Emoji**: 🧥
- **Base Stats**:
  - actionButtonSlots: 2
  - defense: 1
  - stealth: 1

### 4.2 Quality Distribution

- 60% WORN quality
- 30% STANDARD quality
- 10% FINE quality

### 4.3 Drop Mechanics

**Location**: Grey Cave biome (floors 1-4)

**Guarantee**: First item spawned on grey cave floors if player doesn't already have trench coat

**Detection Logic**:
```javascript
// Checks all inventories for existing trench coat
- Loose inventory (hand)
- Persistent inventory
- Active item slot
```

## 5. Implementation Files

### 5.1 Core Modules

1. **zone-manager.js** (373 lines)
   - Zone boundary validation
   - Movement context management
   - Capacity calculation
   - Turn counter for one-per-turn rule

2. **card-system.js** (Modified)
   - Added TRENCH_COAT equipment definition
   - Added rollTrenchCoat() function
   - Equipment category support

3. **gamestate.js** (Modified)
   - Integrated CardZoneManager for capacity
   - Updated addToActionButtons() to use dynamic capacity
   - Added getActionButtonCapacity() public method

4. **gone-rogue.js** (Modified)
   - Updated _placeItems() for guaranteed trench coat spawn
   - Added trench coat detection logic
   - Integrated with grey biome floors (1-4)

5. **reserve-slots.js** (Modified)
   - Updated to use dynamic capacity via _getMaxSlots()
   - Dynamically renders button slots based on equipment
   - Updated slot management to support 4-6+ slots

### 5.2 Test Suite

**test-zone-boundaries.js** (350+ lines)
- 10 test categories
- Module availability checks
- Trench coat item validation
- Zone boundary rule enforcement
- Equipment capacity modification
- Context management validation

## 6. Audit Results

### 6.1 Zone Boundary Enforcement

✅ **IMPLEMENTED**: Comprehensive zone boundary rules
- Movement validation via canMoveCard()
- Context-sensitive restrictions
- Bonfire/shop-only inventory access
- One-card-per-turn rule in combat

✅ **IMPLEMENTED**: State machine for game contexts
- setContext() / getContext() methods
- Turn counter management
- resetTurnCounter() for combat phases

### 6.2 Equipment Capacity System

✅ **IMPLEMENTED**: Dynamic action button capacity
- Base capacity: 4 slots
- Equipment modifier support via actionButtonSlots stat
- Automatic capacity updates when equipping/unequipping
- UI automatically adjusts to show correct number of slots

✅ **IMPLEMENTED**: Trench coat as inaugural equipable
- Provides +2 action button slots
- Equipment category with proper stats
- Quality-based stat scaling

### 6.3 Trench Coat Drop System

✅ **IMPLEMENTED**: Guaranteed grey biome drop
- Spawns on floors 1-4 (grey cave biome)
- Only spawns if player doesn't have one
- First item in spawn list (guaranteed to attempt placement)
- Checks all player inventories before spawning

### 6.4 Test Coverage

✅ **IMPLEMENTED**: Comprehensive test suite
- Module availability tests
- Item generation tests
- Zone boundary rule tests
- Equipment capacity tests
- Context management tests
- Integration tests

## 7. Known Limitations

### 7.1 Partial Implementation

⚠️ **DISCARD/EXHAUST/DECK zones**: Defined but not fully implemented
- Zone definitions exist
- Movement rules not implemented
- Card lifecycle integration pending

✅ **moveCard() full implementation**: COMPLETED (as of 2026-02-20)
- All primary zone movements implemented:
  - Hand ↔ Action Buttons
  - Inventory ↔ Action Buttons
  - Hand ↔ Inventory
  - Inventory ↔ Active Item (equip/unequip)
- All implementations include proper rollback on failure
- Validation via canMoveCard() works for all zones

### 7.2 Combat Integration

⚠️ **Turn counter management**: Requires integration with combat system
- resetTurnCounter() must be called at turn start
- Currently manual invocation
- Needs combat phase integration

⚠️ **Context setting**: Manual context updates required
- Game must call CardZoneManager.setContext() when changing states
- Not automatically synchronized with game state
- Requires integration points in gone-rogue.js

## 8. Integration Points

### 8.1 Required Integration

For full functionality, the following integration points are needed:

1. **Combat System** (gone-rogue.js):
   ```javascript
   // At combat start
   CardZoneManager.setContext(CardZoneManager.CONTEXTS.COMBAT_PLANNING);

   // At turn start
   CardZoneManager.resetTurnCounter();

   // At bonfire
   CardZoneManager.setContext(CardZoneManager.CONTEXTS.BONFIRE);
   ```

2. **Card Movement** (UI handlers):
   ```javascript
   // Use CardZoneManager.canMoveCard() before allowing UI actions
   // Use CardZoneManager.moveCard() for validated movements
   ```

3. **Equipment Changes** (inventory system):
   ```javascript
   // Capacity automatically updates when using:
   GAMESTATE.setActiveItem(trenchCoat);
   GAMESTATE.clearActiveItem();

   // UI should re-render to show new capacity
   ```

### 8.2 Drop Zone Detector Integration

✅ **UPDATED (as of 2026-02-20)**: drop-zone-detector.js now uses CardZoneManager
- Hand capacity check uses `CardZoneManager.getZoneLimits()` for accurate 8-slot limit
- Action button capacity check uses `CardZoneManager.getZoneLimits()` for equipment-aware capacity
- Falls back gracefully to GAMESTATE if CardZoneManager unavailable
- Provides correct visual feedback during drag-and-drop operations

### 8.3 Backward Compatibility

The system maintains backward compatibility:
- If CardZoneManager unavailable, falls back to default capacity
- Existing code continues to work without zone manager
- Gradual integration possible

## 9. Testing Recommendations

### 9.1 Manual Testing Steps

✅ **Test Harness Available**: `public/tests/test-zone-boundaries.html` (Added 2026-02-20)

1. **Load Test Page**: Open `public/tests/test-zone-boundaries.html` in a browser
2. **Run Tests**: Click "Run Tests" button
3. **Check Results**: Verify all tests pass (green checkmarks)
4. **In-Game Testing**:
   - Start new Gone Rogue run
   - Navigate to grey cave floors (1-4)
   - Find and pick up trench coat
   - Equip trench coat via EQUIP command
   - Verify action buttons show 6 slots (4 + 2)
   - Try moving cards between zones
   - Verify boundary rules enforced

### 9.2 Automated Testing

✅ **Test HTML Harness Created**: Interactive web-based test runner now available

Run the test suite:
```bash
# Open in browser
open public/tests/test-zone-boundaries.html

# Click "Run Tests" button
# Check console and UI for results
# Expected: All tests pass with visual feedback
```

The test harness provides:
- Real-time pass/fail counters
- Color-coded test results
- Section-by-section test organization
- Interactive UI for easy debugging

## 10. Future Enhancements

### 10.1 Complete Zone Implementation

- Implement DISCARD, EXHAUST, and DECK zones
- Add card draw mechanics
- Implement exhaust card return after combat
- Add discard pile visibility

### 10.2 Additional Equipment

- Add more equipment items with actionButtonSlots bonuses
- Implement equipment sets with synergies
- Add equipment durability/battery mechanics
- Create legendary equipment with unique effects

### 10.3 Advanced Movement Rules

~~- Implement card swapping between zones~~
~~- Add bulk card movement~~
- Create card sorting/filtering
- Add auto-organize features

**Note**: Basic card movement between all primary zones is now complete (2026-02-20)

### 10.4 UI Enhancements

~~- Drag-and-drop card movement~~ (drop-zone-detector now integrated with CardZoneManager)
- Visual indicators for zone limits
- Zone preview tooltips
- Capacity indicator in UI

## 11. Conclusion

The card zone boundaries and equipment capacity system has been successfully implemented with the following achievements:

✅ Comprehensive zone boundary enforcement
✅ Dynamic equipment-based capacity modification
✅ Trench coat as inaugural equipable item
✅ Guaranteed grey biome drop system
✅ Full test coverage with interactive test harness
✅ Complete moveCard() implementation for all primary zones
✅ Drop-zone-detector integration with CardZoneManager
✅ Backward compatible integration

### Recent Updates (2026-02-20)

The following improvements were completed to address the known limitations identified in the initial audit:

1. **Complete moveCard() Implementation**
   - Implemented all primary zone movement handlers
   - Hand ↔ Action Buttons, Inventory ↔ Action Buttons
   - Hand ↔ Inventory, Inventory ↔ Active Item
   - All movements include proper error handling and rollback

2. **Interactive Test Harness**
   - Created `test-zone-boundaries.html` with full UI
   - Real-time test results and status counters
   - Visual feedback for pass/fail tests
   - Matches styling of other test pages

3. **Drop Zone Detector Enhancement**
   - Updated to use `CardZoneManager.getZoneLimits()`
   - Now respects equipment-modified action button capacity
   - Provides accurate visual feedback during drag operations
   - Maintains backward compatibility

The system is production-ready for all implemented features. The file has grown from 352 lines to 540 lines in zone-manager.js, implementing comprehensive card movement logic across all primary zones.

## Appendix A: API Reference

### CardZoneManager

```javascript
// Zone definitions
CardZoneManager.ZONES
CardZoneManager.CONTEXTS

// Context management
CardZoneManager.setContext(context)
CardZoneManager.getContext()
CardZoneManager.resetTurnCounter()

// Movement validation
CardZoneManager.canMoveCard(fromZone, toZone, options)
CardZoneManager.moveCard(card, fromZone, toZone, options)

// Capacity queries
CardZoneManager.getActionButtonCapacity()
CardZoneManager.getZoneLimits(zone)
```

### GAMESTATE

```javascript
// Action button management
GAMESTATE.addToActionButtons(card)
GAMESTATE.removeFromActionButtons(index)
GAMESTATE.getActionButtonCards()
GAMESTATE.getActionButtonCapacity()

// Equipment management
GAMESTATE.setActiveItem(item)
GAMESTATE.getActiveItem()
GAMESTATE.clearActiveItem()
```

### CardSystem

```javascript
// Trench coat generation
CardSystem.rollTrenchCoat()

// Base card definition
CardSystem.BASE_CARDS.TRENCH_COAT
```
