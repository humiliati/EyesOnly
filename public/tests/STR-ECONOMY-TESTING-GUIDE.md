# STR Economy Testing Guide

## Overview

This guide explains how to run comprehensive STR (Simultaneous Turn Resolution) combat and economy testing using both human UI-required tests and mathematical headless simulations.

## Quick Start

### Option 1: Using the Test Runner (Recommended)

1. Open `public/tests/test-str-economy-runner.html` in your browser
2. Follow the on-screen instructions for each test type
3. View results in real-time

### Option 2: Manual Test Execution

See detailed instructions below for each test type.

## Test Types

### Test 1: Human UI Required (Agent Integration)

**Purpose**: Tests the game through actual UI interactions, simulating a human player engaging heavily in STR combat.

**Files Used**:
- `public/js/agent-integration.js` - Main agent controller
- `public/tests/agent-headless-adapter.js` - Human-like IO constraints
- `public/js/gone-rogue.js` - Game engine with headless API

**How to Run**:

1. **Start the game**:
   ```
   Open public/index.html in your browser
   ```

2. **Enter Gone Rogue mode**:
   ```
   In game terminal, type: rogue
   ```

3. **Start the agent** (one of two methods):

   **Method A - Using Test Runner**:
   - Open `test-str-economy-runner.html` in same browser
   - Click "Run UI Test"

   **Method B - Using Game Commands**:
   ```
   In game, type: AGENT NATURAL
   # or
   In game, type: AGENT DEVELOPER
   ```

4. **Monitor Progress**:
   - Agent actions appear in MOK interjection field
   - Real-time commentary shows decision making
   - Combat outcomes logged to terminal

5. **Stop Agent**:
   ```
   In game, type: AGENT STOP
   ```

6. **View Report**:
   - Comprehensive MVP report appears in terminal
   - Includes STR combat stats, economy metrics, pathfinding quality

**Agent Modes**:

- **NATURAL**: Human-like play (200-500ms between actions)
  - Explores map thoroughly (70%)
  - Makes realistic decisions
  - Uses cards strategically
  - Shows commentary
  - Best for UX validation

- **DEVELOPER**: Fast testing (50-100ms between actions)
  - Rushes to exit
  - Minimal exploration
  - Optimal pathfinding only
  - Best for quick regression tests

**Expected Duration**:
- Natural mode: 2-5 minutes per run
- Developer mode: 1-2 minutes per run

### Test 2: Headless Math Economy Tests

**Purpose**: Runs pure mathematical simulations with focus on STR combat economy balance. Tests multiple combat-heavy scenarios at high speed.

**Files Used**:
- `public/tests/agent-mvp-audit.js` - MVP audit engine with UX tracking
- `public/tests/agent-engine.js` - Base simulation engine
- `public/tests/test-str-economy-runner.html` - Test runner UI

**How to Run**:

1. **Open Test Runner**:
   ```
   Open public/tests/test-str-economy-runner.html
   ```

2. **Configure Test**:
   - Number of Runs: 100+ recommended (higher = more statistical confidence)
   - Test Focus: Choose STR combat emphasis level
   - Max Floor: Default 30 (can go up to 50)

3. **Run Test**:
   - Click "Run Math Tests"
   - Progress bar shows completion
   - Results stream to console

4. **View Results**:
   - Comprehensive report shows:
     - STR combat win rates
     - Economy balance metrics
     - Per-persona breakdown
     - Critical issues

**Test Focus Options**:

- **STR Combat Heavy**: Maximum combat engagement
  - Personas: GREEDY_LOOTER, RISKY_GAMBLER, MINMAXER
  - Most fights per run
  - Tests extreme combat scenarios

- **STR Balanced**: Mixed playstyle
  - Personas: MINMAXER, GREEDY_LOOTER, SPEEDRUNNER
  - Moderate combat engagement
  - Tests realistic player behavior

- **STR Economy Focus**: Resource management emphasis
  - Personas: SAVER_HOARDER, MINMAXER, RISKY_GAMBLER
  - Tests economy during combat
  - Validates spending incentives

- **All Personas**: Comprehensive testing
  - All 6+ personas in rotation
  - Full spectrum of playstyles
  - Complete validation

**Expected Duration**:
- 100 runs: 5-10 minutes
- 500 runs: 20-30 minutes
- 1000 runs: 40-60 minutes

## Understanding Results

### STR Combat Metrics

**Win Rate**:
- `< 30%`: ⚠️ Combat too difficult (buff player or nerf enemies)
- `30-40%`: ⚠️ Challenging but may be frustrating
- `40-80%`: ✓ Good balance (ideal range)
- `80-90%`: ⚠️ Too easy (buff enemies)
- `> 90%`: ⚠️ Trivial combat (major rebalance needed)

**Average Combats per Run**:
- `< 3`: Low engagement (may need more enemies)
- `3-8`: Good engagement
- `> 8`: Heavy combat (ensure economy supports this)

**Damage Metrics**:
- Damage Dealt vs Taken ratio should be 1.2-2.0
- If ratio > 3.0: Player too strong
- If ratio < 0.8: Player too weak

### Economy Metrics

**Average Final Credits**:
- `< 100`: ⚠️ Currency starvation (increase drops)
- `100-500`: ✓ Tight but manageable
- `500-2000`: ✓ Healthy economy
- `2000-5000`: ⚠️ Generous (may reduce challenge)
- `> 5000`: ⚠️ Excess currency (reduce drops)

**Mythic Find Rate**:
- `< 5%`: Very rare (consider if intentional)
- `5-15%`: Good rarity
- `> 20%`: Too common (reduce drop rate)

### Validation Criteria

**STR Economy is Balanced When**:
1. ✓ Win rate between 40-80%
2. ✓ Average credits 500-2000
3. ✓ Saver persona survival < 30% (spending incentivized)
4. ✓ Zero stuck situations
5. ✓ Boss defeat rate 30-70%

**Red Flags**:
- ❌ Any impossible bosses detected
- ❌ Stuck situations > 0
- ❌ Win rate < 30% or > 90%
- ❌ Currency starvation events
- ❌ SAVER_HOARDER performing better than spenders

## Personas Explained

### Combat-Heavy Personas

**GREEDY_LOOTER**:
- Opens every chest, fights every enemy
- Most STR combat of any persona
- Best for testing maximum combat scenarios
- Expected survival: 30-50%

**RISKY_GAMBLER**:
- Burns currency on gambling
- Engages in combat frequently
- Tests economy under high-risk play
- Expected survival: 20-40%

**MINMAXER**:
- Optimal play, calculates everything
- Strategic combat engagement
- Best survival rate benchmark
- Expected survival: 40-60%

### Economy-Focused Personas

**SAVER_HOARDER**:
- Never spends currency
- Tests minimum viable economy
- Should perform worse than spenders
- Expected survival: 10-30%

### Control Personas

**SPEEDRUNNER**:
- Avoids combat, rushes exit
- Control for non-combat economy
- Expected survival: 30-50%

**DUMB_RANDOM**:
- Random decisions
- Baseline for comparison
- Expected survival: 10-30%

## Interpreting Agent Commentary (Natural Mode)

During UI tests, the agent provides real-time commentary:

```
🥾 Moving north        - Navigation action
💰 Collecting 15 ¢    - Currency pickup
🃏 Using card 2        - Card usage
⚔️  Engaging enemy     - Combat initiated
🛡️  Defending          - Defensive action
💊 Healing (50 ¢)     - Vendor interaction
🎲 Gambling (100 ¢)   - Gambling action
🚪 Taking exit         - Floor completion
```

## Common Issues

### UI Test Won't Start

**Error**: "GoneRogue not loaded"
- **Solution**: Make sure game is running and you're in Gone Rogue mode

**Error**: "AgentIntegration not loaded"
- **Solution**: Ensure agent-integration.js is included in main game page

**Error**: "HeadlessAdapter not loaded"
- **Solution**: Check that agent-headless-adapter.js is loaded

### Math Test Issues

**Test runs too slow**:
- Reduce number of runs
- Use faster browser (Chrome recommended)
- Close other tabs

**Browser freezes**:
- Test automatically adds delays every 20 runs
- If still freezing, reduce number of runs

**Results seem wrong**:
- Run more iterations for statistical significance
- Check console for errors
- Verify all dependencies loaded

## Advanced Usage

### Custom Test Scenarios

You can modify the test runner to create custom scenarios:

```javascript
// Focus on specific floor range
const engine = new MVPAuditEngine({
  maxFloor: 20,  // Stop at floor 20
  enableElites: true,
  trackUX: true
});

// Run with specific persona
const persona = MVPAuditEngine.PERSONAS.GREEDY_LOOTER;
const result = await engine.executeAuditRun(persona, 1);
```

### Export Results

Both test types support exporting results:

**UI Test**: Results appear in game terminal, copy manually

**Math Test**: Add export buttons by modifying test runner:
```javascript
// Add to test runner
function exportResults(results, format) {
  if (format === 'csv') {
    // Generate CSV
  } else if (format === 'json') {
    // Generate JSON
  }
}
```

### Batch Testing

For overnight batch testing:

```javascript
// Run multiple test configurations
const configs = [
  {runs: 100, focus: 'str-heavy', maxFloor: 30},
  {runs: 100, focus: 'str-balanced', maxFloor: 30},
  {runs: 100, focus: 'str-economy', maxFloor: 30}
];

for (const config of configs) {
  await runMathTestWithConfig(config);
}
```

## Test Coverage

### What Gets Tested

**STR Combat**:
- ✓ Combat initiation and resolution
- ✓ Win/loss ratios
- ✓ Damage dealt vs taken
- ✓ Card usage patterns
- ✓ Combat duration
- ✓ Enemy AI behavior

**Economy**:
- ✓ Credit drops per floor
- ✓ Vendor pricing balance
- ✓ Gambling ROI
- ✓ Healing cost effectiveness
- ✓ Currency starvation/excess
- ✓ Spending incentives

**Balance**:
- ✓ Boss difficulty (mathematical proof)
- ✓ Elite enemy scaling
- ✓ Floor progression curve
- ✓ Deck power requirements
- ✓ Survival rates by persona

### What Doesn't Get Tested

- ✗ Visual effects and animations
- ✗ Sound and music
- ✗ Network/multiplayer features
- ✗ Save/load persistence
- ✗ Mobile touch gestures (partially tested)
- ✗ Edge case bugs (use manual testing)

## Best Practices

### For STR Economy Validation

1. **Always run 100+ iterations** for math tests
   - Higher confidence in results
   - Better statistical significance
   - Catches rare edge cases

2. **Test multiple focus areas**
   - Combat heavy (validates max stress)
   - Balanced (validates normal play)
   - Economy focused (validates incentives)

3. **Compare against baseline**
   - Run same config before/after changes
   - Track deltas in key metrics
   - Identify regressions early

4. **Use UI test for qualitative feedback**
   - Watch agent decision making
   - Identify UX issues
   - Verify metrics match feel

5. **Document results**
   - Save reports with timestamps
   - Track trends over time
   - Share findings with team

### For Continuous Testing

1. **Run tests before major changes**
   - Establish baseline metrics
   - Identify affected systems

2. **Run tests after major changes**
   - Validate improvements
   - Catch regressions
   - Measure impact

3. **Run nightly batch tests** (if possible)
   - Automated validation
   - Early problem detection
   - Historical tracking

## Performance Notes

**Memory Usage**:
- UI Test: ~50MB (single run)
- Math Test: ~100-500MB (depends on iterations)
- Browser tab: ~200-400MB total

**CPU Usage**:
- UI Test: Moderate (depends on game rendering)
- Math Test: High during execution, idle between runs

**Recommendations**:
- Use Chrome or Firefox for best performance
- Close unnecessary tabs during testing
- Allow browser to complete garbage collection between tests

## Troubleshooting Guide

### Problem: Agent gets stuck in combat

**Symptoms**: No progress for several rounds

**Causes**:
1. No legal actions available
2. Combat logic deadlock
3. Card deck exhausted

**Solutions**:
- Check combat logic in gone-rogue.js
- Verify card availability
- Review action selection in agent

### Problem: Math test results vary widely

**Symptoms**: Different results on each run

**Causes**:
1. Too few iterations
2. RNG not properly seeded
3. Race conditions

**Solutions**:
- Increase number of runs (500+)
- Add deterministic seeding
- Check for async issues

### Problem: Economy metrics seem off

**Symptoms**: Credits too high/low

**Causes**:
1. Drop rates misconfigured
2. Vendor prices wrong
3. Persona spending behavior

**Solutions**:
- Verify drop rate constants
- Check vendor interaction logic
- Review persona config

## Next Steps

After running tests:

1. **Review Results**
   - Check all key metrics
   - Identify issues
   - Prioritize fixes

2. **Make Adjustments**
   - Tune parameters
   - Fix critical bugs
   - Rebalance as needed

3. **Retest**
   - Verify improvements
   - Ensure no regressions
   - Iterate until balanced

4. **Document Findings**
   - Update balance docs
   - Share with team
   - Track changes

## References

- See `AGENT-UI-INTEGRATION-GUIDE.md` for UI testing details
- See `HEADLESS-INTEGRATION-COMPLETE.md` for headless API docs
- See `MVP-AUDIT-GAP-ANALYSIS.md` for validation criteria
- See `README-AGENT-ENGINE.md` for agent system overview

## Support

For issues or questions:
1. Check console for error messages
2. Review documentation files
3. Verify all dependencies loaded
4. Test in different browser if issues persist
