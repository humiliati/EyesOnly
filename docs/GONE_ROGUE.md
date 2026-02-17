# Gone Rogue Mode - Implementation Documentation

## Overview

Gone Rogue is an ASCII-based stealth roguelike game mode integrated into the EYES ONLY terminal system. It features a Diablo II-style loot system with card-based tactical gameplay, dual inventory management, and permadeath mechanics.

## System Architecture

### Core Components

1. **gamestate.js** - Global game state controller
   - Manages mode switching between Street Chronicles and Gone Rogue
   - Handles dual inventory system (persistent + loose carry)
   - Manages progression and slot unlocks

2. **card-system.js** - Diablo-style loot generation
   - Quality tiers (Cracked → Perfect)
   - Stat rolling based on quality
   - Affix system for unique modifiers
   - Special inventory charm cards

3. **gone-rogue.js** - Core roguelike engine
   - 40x20 ASCII grid rendering
   - Turn-based movement and combat
   - Item pickups and enemy encounters
   - Extraction mechanics

4. **street-chronicles.js** - Enhanced with inventory limits
   - Maximum 9 items per default
   - Capacity display in UI
   - Full/empty state handling

## Inventory System

### Persistent Inventory (Safe Across Death)
- **Starting slots**: 9
- **Maximum slots**: 12
- **Expansion**: +1 slot per successful rogue run completion
- **Purpose**: Store near-perfect cards, favorite builds, rare rolls

### Loose Carry (Lost on Death)
- **Slots**: 8 (fixed)
- **Purpose**: Expendable mid-tier cards, consumables, risky experiments
- **Risk/Reward**: Encourages spending mediocre items, protecting perfect ones

## Card System

### Base Card Types (12 total)

**Attack Cards:**
- Single Shot - Standard precision fire
- Burst Shot - Multiple rounds, high noise
- Silent Shot - Suppressed fire
- Explosive Shot - Area damage, very loud

**Stance/Defense Cards:**
- Prone - High defense, reduced mobility
- Kneel - Balanced accuracy bonus
- Dodge - High evasion
- Block - Direct damage reduction

**Utility Cards:**
- Cigarettes - Stress relief, HP drain
- Katchup - Healing
- Rations - HP + energy restore

**Tactical Cards:**
- Retreat - Move backward to safety
- Close Distance - Aggressive positioning
- Total Evasion - Major dodge boost

**Special:**
- Inventory Charm - Rare slot expansion (97% cracked, 3% perfect)

### Quality Tiers

| Quality | Drop Rate | Color | Stat Modifier |
|---------|-----------|-------|---------------|
| Cracked | 18% | Gray | 0.7x |
| Worn | 22% | Light Gray | 0.85x |
| Standard | 25% | White | 1.0x |
| Fine | 15% | Light Blue | 1.15x |
| Superior | 10% | Yellow | 1.3x |
| Elite | 6% | Orange | 1.5x |
| Masterwork | 3% | Gold | 1.7x |
| Near Perfect | 0.9% | Light Green | 1.9x |
| Perfect | 0.1% | Violet | 2.0x |

### Affixes

Affixes provide unique bonuses beyond stat rolls:

**Weapon Affixes:**
- Suppressed - Reduced noise
- Hair Trigger - Lower energy cost
- Armor Piercing - Damage multiplier
- Ghosted - Reduced detection
- Ricochet - Double hit chance

**Stance Affixes:**
- Ghillie Threaded - Stealth bonus
- Combat Roll Ready - Free dodge next turn
- Sniper Trained - Accuracy boost

**Utility Affixes:**
- Unfiltered - Attack boost with HP drain
- Calming - Stealth increase
- Adrenal - Speed boost

## Game Modes

### Street Chronicles Mode
- Text-based adventure navigation
- Location persistence
- Inventory limited to 9 items
- Access via `MAP` or `STREET` command

### Gone Rogue Mode
- ASCII roguelike gameplay
- 40x20 grid (mobile-optimized)
- Turn-based tactical combat
- Access via `ROGUE` or `GONE_ROGUE` command

## Mode Transitions

### Entering Gone Rogue

**Trigger Methods:**
1. Manual: Type `ROGUE` command
2. Story Event: Scripted narrative triggers
3. Out of Bounds: Wandering beyond street boundaries

**Transition Flow:**
```
Street Chronicles → Signal Degradation → Memory Fragmentation → Gone Rogue
```

**What Carries Over:**
- Persistent inventory (safe)
- Optional: Street items → Loose carry

### Exiting Gone Rogue

**Success Conditions:**
- Reach extraction point (▼)
- Execute `EXTRACT` command
- Complete objective

**Failure Conditions:**
- HP reaches 0
- Mission timeout (future)

**Exit Flow:**
```
Gone Rogue → Debrief → Return to Street Chronicles
```

**On Success:**
- Keep persistent + loose inventory
- +1 persistent slot (if < 12)
- Extracted items preserved

**On Death:**
- Keep persistent inventory only
- Lose all loose carry
- Return to last Street position

## Commands

### Gone Rogue Mode Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| N/E/S/W | WASD | Movement |
| TAKE | PICKUP, GET | Pick up item |
| EXTRACT | - | Extract from exit point |
| STATUS | STATS | Show player stats |
| INVENTORY | INV | Show dual inventory |
| HELP | - | Command list |
| EXIT | QUIT | Return to Street |

### Terminal Commands

| Command | Description |
|---------|-------------|
| MAP | Enter Street Chronicles |
| ROGUE | Enter Gone Rogue mode |
| HELP | Show available commands |
| INVENTORY | Toggle inventory UI |

## Progression System

### Persistent Slot Expansion

**Base State:**
- 9 persistent slots
- 8 loose carry slots

**Unlock Conditions:**
Each successful Gone Rogue completion:
- Adds +1 persistent slot
- Maximum 12 slots (3 completions needed)

**Completion Criteria:**
- Reach map end/exit
- Extract successfully
- Kill boss (future)
- Complete objective node (future)

### Inventory Charm System

**Drop Behavior:**
- 97% drop as Cracked (no bonus)
- 3% drop as Perfect (+1 slot beyond cap)

**Perfect Charm Effect:**
- +1 persistent slot (exceeds 12-slot cap)
- Account-level treasure
- Mythic rarity chase item

## Technical Implementation

### State Management

**localStorage Keys:**
- `eyesonly_gamestate` - Global game state
- `eyesonly_rogue_state` - Current rogue run
- `eyesonly_street_state` - Street Chronicles state

**State Structure:**
```javascript
{
  mode: 'street' | 'rogue',
  inventoryPersistent: [],
  inventoryLoose: [],
  persistentSlots: 9,
  maxPersistentSlots: 12,
  looseSlots: 8,
  rogueRun: {...}
}
```

### Rendering

**Grid System:**
- 40 columns × 20 rows
- Mobile-first design
- Monospace text rendering
- DOM-based (no canvas)

**Tile Legend:**
- `@` - Player
- `E` - Enemy
- `*` - Item
- `▼` - Exit
- `█` - Wall
- `▓` - Cover
- `.` - Empty space

## Future Enhancements

### Planned Features

1. **Difficulty Tiers**
   - Tier 1/2/3 with escalating rewards
   - Slot unlocks tied to difficulty

2. **Enhanced Card Mechanics**
   - Combo system for card synergies
   - Energy management
   - Turn-based tactical depth

3. **Rogue Map Generation**
   - Procedural room layouts
   - Multiple floor types
   - Boss encounters

4. **Street → Rogue Triggers**
   - Narrative-driven transitions
   - Out-of-bounds detection
   - Repeated direction spam failsafe

5. **Persistent Progression**
   - Meta-progression across runs
   - Unlock new card types
   - Difficulty modifiers

## Testing

### Manual Test Plan

1. **Inventory Limits**
   - [ ] Try to pick up 10th item in Street Chronicles
   - [ ] Verify "INVENTORY FULL" message displays
   - [ ] Confirm capacity shows "9/9"

2. **Mode Switching**
   - [ ] Type `ROGUE` from terminal
   - [ ] Verify transition messages display
   - [ ] Confirm Gone Rogue grid renders
   - [ ] Type `EXIT` to return to Street
   - [ ] Type `ROGUE` while in Street Chronicles mode
   - [ ] Verify transition occurs without "UNRECOGNIZED FIELD ACTION" error
   - [ ] Confirm Street Chronicles is properly deactivated before Gone Rogue starts

3. **Card Generation**
   - [ ] Pick up items in Gone Rogue
   - [ ] Check quality distribution
   - [ ] Verify affixes on high-quality cards
   - [ ] Test inventory charm drops

4. **Dual Inventory**
   - [ ] Add cards to persistent inventory
   - [ ] Add cards to loose carry
   - [ ] Die in Gone Rogue
   - [ ] Verify persistent kept, loose lost

5. **Slot Expansion**
   - [ ] Complete successful extraction
   - [ ] Check if persistent slots increased
   - [ ] Repeat until 12 slots reached
   - [ ] Confirm cap at 12

## Code Style

The Gone Rogue implementation follows the existing EYES ONLY codebase conventions:

- **Vanilla JavaScript** - No frameworks, no build step
- **IIFE Module Pattern** - Self-contained modules
- **localStorage Persistence** - Client-side state management
- **Terminal Aesthetic** - Cold War era CRT styling
- **Mobile-First** - 40x20 grid fits small screens

## Integration Points

### Street Chronicles
- `street-chronicles.js:_state.maxInventory` - Inventory cap
- `street-chronicles.js:_take()` - Capacity checking
- `street-chronicles.js:getInventory()` - External access

### UI Controls
- `ui-controls.js:populateInventory()` - Display limit
- `ui-controls.js:maxSlots` - Visual grid size

### Main Orchestrator
- `main.js:start()` - Initialize GAMESTATE and GoneRogue
- `main.js:_handleCommand()` - Route to active mode
- `main.js:_executeRogueAction()` - Handle rogue responses

### State Machine
- `state-machine.js:_processAwaitingCmd()` - Add ROGUE command
- `state-machine.js:_processGranted()` - Add ROGUE to granted state
- `state-machine.js:HELP` - Document ROGUE command

## Lore Integration

**Diegetic Explanation:**

When the player enters Gone Rogue mode, they experience "memory fragmentation" - a narrative device that explains:
- The ASCII representation (degraded visual feed)
- Item persistence (archived memory sectors)
- Death loop (memory reconstruction)
- Slot expansion (archive capacity increase)

**In-World Flavor Text:**
- "CONNECTION UNSTABLE"
- "ROUTING TO INTERNAL PROCESS"
- "MEMORY FRAGMENTATION DETECTED"
- "ARCHIVE EXPANSION AUTHORIZED"

This ties Gone Rogue into the larger ARG/espionage narrative without breaking immersion.

## Performance Considerations

- **Grid Size**: 40x20 = 800 cells (lightweight)
- **Rendering**: DOM manipulation (no canvas overhead)
- **State**: localStorage only (no server calls)
- **Items**: Max 50 items on floor (reasonable limit)
- **Enemies**: Max 10 enemies (adjustable)

## Browser Compatibility

Tested/supported:
- Chrome/Edge (Chromium)
- Firefox
- Safari (iOS/macOS)
- Mobile browsers

Requirements:
- JavaScript ES5+
- localStorage API
- CSS Grid support

---

**Implementation Date**: February 2026
**Version**: 1.0.0
**Author**: Claude Sonnet 4.5
**Project**: EYES ONLY - Sandpoint Field Operations
