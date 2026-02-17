# Agent UI Integration - Complete Guide

## Overview

The Agent UI Integration system allows MOK (the AI assistant) to take control of Gone Rogue gameplay automatically. This provides two key benefits:

1. **For Players**: Get assistance from MOK when stuck or want to see optimal play
2. **For Developers**: Automated testing and MVP validation with real game data

## How to Use

### Starting the Agent

1. **Enter Gone Rogue mode**:
   ```
   > MAP          # Enter Street Chronicles
   > ROGUE        # Enter Gone Rogue
   ```

2. **Click the `/help` button** in the left sidebar

3. **Choose agent mode**:
   ```
   > AGENT NATURAL      # For human-like play
   # OR
   > AGENT DEVELOPER    # For fast testing
   ```

4. **Watch the agent play**:
   - Real-time updates appear in MOK interjection field
   - Agent makes decisions and executes actions automatically
   - You retain ability to issue commands

5. **Stop the agent**:
   ```
   > AGENT STOP
   ```
   
   A full MVP report will be generated in the terminal.

### Agent Modes

#### Natural Mode (MOK Agent)

**Purpose**: Simulate realistic human gameplay for comprehensive testing.

**Characteristics**:
- **Timing**: 200-500ms between actions (human-like)
- **Exploration**: Explores 70% of map before exiting
- **Decision Making**: 
  - Picks up all items and currency
  - Uses cards strategically in combat
  - Occasionally uses active items
  - Makes "realistic" choices (not always optimal)
- **Output**: 
  - Real-time commentary via MOK interjection
  - "🥾 Moving north"
  - "💰 Collecting 5 credits"
  - "🃏 Using card 1"
- **Report**: Comprehensive MVP metrics

**Use Cases**:
- Testing game balance from player perspective
- Validating UX flow
- Generating realistic playthroughs
- Demonstrating gameplay to observers

#### Developer Mode

**Purpose**: Fast automated testing for quick validation.

**Characteristics**:
- **Timing**: 50-100ms between actions (very fast)
- **Exploration**: Skip exploration, go straight to exit
- **Decision Making**:
  - Optimal pathfinding (north/east priority)
  - Pick up currency only
  - Minimal combat engagement
  - Fastest route to completion
- **Output**: Minimal (no commentary)
- **Report**: Basic metrics only

**Use Cases**:
- Quick regression testing
- Performance validation
- Batch testing multiple scenarios
- CI/CD integration

### Agent Commands

While agent is active, you can issue these commands:

```bash
AGENT STOP      # Stop agent and return control
AGENT PAUSE     # Pause/resume agent
AGENT REPORT    # View current metrics (without stopping)
AGENT MODE      # Display current mode
```

## Technical Architecture

### Component Flow

```
┌─────────────────────────────────────────────┐
│  UI Layer                                   │
│  - /help button                             │
│  - MOK interjection field                   │
│  - Terminal output                          │
└─────────────┬───────────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────────┐
│  Agent Integration (agent-integration.js)   │
│  - Mode selection (natural/developer)       │
│  - Action decision loop                     │
│  - Report generation                        │
└─────────────┬───────────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────────┐
│  Headless Adapter                           │
│  - Human-like IO constraints                │
│  - Action validation                        │
│  - State management                         │
└─────────────┬───────────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────────┐
│  GoneRogue.headless API                     │
│  - getState()                               │
│  - getLegalActions()                        │
│  - applyAction()                            │
└─────────────┬───────────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────────┐
│  Actual Game Engine                         │
│  - Real maps, combat, pathfinding           │
│  - All game mechanics                       │
└─────────────────────────────────────────────┘
```

### Key Files

1. **`public/js/agent-integration.js`**
   - Main agent controller
   - Action decision logic
   - Report generation
   
2. **`public/tests/agent-headless-adapter.js`**
   - Wraps headless API
   - Enforces human-like constraints
   - Tracks action history

3. **`public/js/gone-rogue.js`**
   - Headless API implementation
   - Agent command processor (`_handleAgentCommand`)
   
4. **`public/js/ui-controls.js`**
   - Enhanced /help button handler
   - Agent mode selection UI

## Agent Decision Logic

### Natural Mode Decision Tree

```
Is in STR combat?
├─ Yes → Use card or flee if low HP
└─ No
   ├─ Item/currency on current tile?
   │  └─ Yes → Pick up
   ├─ Explored < 70% of map?
   │  ├─ Yes → Move to unvisited tile
   │  └─ No → Move to exit
   ├─ Occasionally use active item (10% chance)
   └─ Wait as fallback
```

### Developer Mode Decision Tree

```
Exit available?
├─ Yes → Take exit immediately
└─ No
   ├─ Currency available?
   │  └─ Yes → Pick up
   ├─ Can move north or east?
   │  └─ Yes → Move (prefer unexplored direction)
   └─ Wait as fallback
```

## MVP Report Format

When agent completes or is stopped, a report is generated:

```
═══════════════════════════════════════════
       MVP AUDIT REPORT - NATURAL PLAY
═══════════════════════════════════════════

OUTCOME: COMPLETED
DURATION: 45.3s
FLOORS COMPLETED: 5
ACTIONS EXECUTED: 127
FAILED ACTIONS: 2

ACTION BREAKDOWN:
  move: 89
  pickup: 12
  pickupCurrency: 15
  useCard: 8
  exit: 5
  wait: 3

EXPLORATION:
  Tiles Visited: 156
  Move Actions: 89
  Combat Actions: 8
  Stuck Situations: 0

MVP METRICS:
  Lighting Utility: 35.2%
  Ground Effects Utility: 12.8%
  Combat Balance: 67.5%
  Pathfinding Quality: 98.3%

═══════════════════════════════════════════
```

## Integration with Existing Systems

### Tooltip System

Agent uses `TooltipSystem` for real-time feedback:

```javascript
TooltipSystem.show("🥾 Moving north", 2000);
TooltipSystem.showPersistent("🤖 MOK AGENT ACTIVATED");
```

### Headless Game API

Agent uses the headless API added to GoneRogue:

```javascript
var state = GoneRogue.headless.getState();
var actions = GoneRogue.headless.getLegalActions();
var result = await GoneRogue.headless.applyAction(action);
```

### Action History

All actions are tracked in `adapter.exportTrace()`:

```javascript
{
  "actionHistory": [
    {
      "tick": 0,
      "action": {"type": "move", "direction": "north"},
      "stateBefore": {...},
      "stateAfter": {...},
      "success": true
    }
  ]
}
```

## Extending the System

### Adding New Agent Behaviors

To add a new decision type, modify `chooseNaturalAction()` or `chooseDeveloperAction()` in `agent-integration.js`:

```javascript
// Example: Prefer picking up mythic items
var mythicPickup = actions.find(a => 
  a.type === 'pickup' && a.item && a.item.rarity === 'mythic'
);
if (mythicPickup) {
  return mythicPickup;
}
```

### Adding New Agent Modes

1. Add mode config to `CONFIG` object:
```javascript
CONFIG.custom = {
  minActionDelay: 150,
  maxActionDelay: 300,
  enableJitter: true,
  showTooltips: true,
  exploreThresholdPercent: 50
};
```

2. Add choice logic:
```javascript
else if (agentMode === 'custom') {
  return chooseCustomAction(actions, state);
}
```

3. Add command handler in `gone-rogue.js`:
```javascript
else if (subCommand === 'custom') {
  AgentIntegration.startAgentTakeover('custom');
}
```

### Custom Metrics Tracking

Add tracking to `trackActionMetrics()`:

```javascript
// Track specific action patterns
if (action.type === 'move' && state.player.hp < 30) {
  currentReport.lowHpMoves++;
}
```

## Performance Considerations

### Action Timing

- **Natural Mode**: 200-500ms (configurable)
  - Average: ~350ms per action
  - ~170 actions per minute
  - ~3 actions per second

- **Developer Mode**: 50-100ms (configurable)
  - Average: ~75ms per action
  - ~800 actions per minute
  - ~13 actions per second

### Memory Usage

- State snapshots: ~5KB each
- Action history: ~1KB per action
- Report data: ~10KB
- **Total for 500 actions**: ~2.5MB

### Browser Compatibility

- Requires modern JavaScript (ES6+)
- Uses `async/await` (IE11 not supported)
- setTimeout for action scheduling
- Works on all modern browsers (Chrome, Firefox, Safari, Edge)

## Troubleshooting

### Agent Won't Start

**Symptoms**: "Agent system not available" error

**Causes**:
1. Script tags not loaded
2. HeadlessAdapter module missing
3. Not in Gone Rogue mode

**Solution**:
```javascript
// Check console for errors
console.log(typeof AgentIntegration);  // Should be 'object'
console.log(typeof HeadlessAdapter);   // Should be 'object'
console.log(GoneRogue.isActive());     // Should be true
```

### Agent Gets Stuck

**Symptoms**: No actions for several seconds

**Causes**:
1. No legal actions available
2. Pathfinding blocked
3. Combat state deadlock

**Solution**:
- Agent auto-stops after detecting stuck situation
- Check `currentReport.stuckSituations` counter
- Use `AGENT STOP` to manually stop

### Actions Fail

**Symptoms**: High `failedActions` count in report

**Causes**:
1. Action not legal (validation failed)
2. Game state changed between decision and execution
3. Timing issue with action execution

**Solution**:
- Agent continues despite failures
- Failed actions logged in report
- Use `AGENT REPORT` to see real-time failure count

## Future Enhancements

### Planned Features

1. **A/B Testing Mode**:
   - Run same scenario with feature toggles
   - Compare outcomes (lighting on vs off, etc.)
   - Generate differential report

2. **Replay System**:
   - Save action traces
   - Replay failed runs
   - Debug specific scenarios

3. **Multi-Agent Mode**:
   - Run multiple agents simultaneously
   - Compare different strategies
   - Statistical analysis across runs

4. **Learning Mode**:
   - Track success patterns
   - Optimize decision making
   - Adaptive strategy selection

### Integration with MVP Audit System

Next step: Update `agent-mvp-audit.js` to use this integration:

```javascript
// Instead of simulated game
var adapter = new HeadlessAdapter.HeadlessGameAdapter({...});
adapter.init(GoneRogue);
adapter.startGame();

// Run audit with real game
for (var i = 0; i < 100; i++) {
  var report = await runWithRealGame(adapter, persona);
  auditResults.push(report);
}
```

## Summary

The Agent UI Integration provides:

✅ **Two agent modes** (natural/developer)
✅ **Real game integration** (no simulation)
✅ **Human-like IO constraints**
✅ **Real-time feedback** (MOK interjection)
✅ **Comprehensive reporting** (MVP metrics)
✅ **Easy activation** (/help button)
✅ **Full control** (pause/stop/report commands)
✅ **Extensible architecture** (add new modes/behaviors)

This system bridges the gap between automated testing and actual gameplay, providing valuable data for MVP validation while remaining accessible to players who want assistance.
