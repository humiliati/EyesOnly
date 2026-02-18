# Highscore System Testing Guide

This document describes how to test the Gone Rogue highscore integration.

## Automated Integration Tests

### Node.js Validation (CI-friendly)
```bash
node test-highscore-integration.js
```

This validates that all tracking code is properly integrated:
- ✓ Tracking variables declared and initialized
- ✓ Currency, enemies, damage, and mitigation tracked
- ✓ Highscore submission on extraction
- ✓ Agent vs human mode detection
- ✓ Dependencies loaded correctly

### Browser-Based Tests

#### 1. Headless API Tests
Open in browser: `public/tests/test-headless-integration.html`

This test suite validates:
- Headless API availability
- Adapter initialization
- Game start/state retrieval
- Legal actions
- Action application
- Map parsing
- Action constraints (no teleportation)
- Action history tracking
- Pathfinding validation

**Expected Result:** All 10 tests should pass

#### 2. Agent Integration Test
Open in browser: `public/tests/test-agent-mvp-audit.html`

Tests the full agent takeover system:
- Agent can control gameplay
- Natural vs developer modes work
- Actions are validated
- Reports are generated

## Manual Testing Workflow

### Testing Human Scores

1. **Start the application:**
   ```bash
   npm run dev
   ```

2. **Open in browser:** `http://localhost:8787`

3. **Start a Gone Rogue run:**
   - Login or play as guest
   - Type `/rogue` to enter Gone Rogue mode
   - Play through at least one floor
   - Stand on exit tile and type `extract` or reach floor 30

4. **Verify score submission:**
   - Open browser console
   - Look for: `[GoneRogue] Highscore submitted: <score> Entry ID: <uuid>`

5. **Check leaderboard:**
   - Navigate to `/highscore` page or type `/highscore` command
   - Verify your score appears in the Gone Rogue tab
   - Check that mode shows "human"
   - Verify metadata (floor reached, enemies killed, etc.)

### Testing Agent Scores

1. **Start the application** (same as above)

2. **Start agent takeover:**
   - Enter Gone Rogue mode (`/rogue`)
   - Open browser console
   - Run: `AgentIntegration.startAgentTakeover('developer')`
   - Agent will play automatically

3. **Monitor agent run:**
   - Watch MOK interjection field for agent status
   - Agent actions will be logged to console
   - Developer mode runs quickly to exit

4. **Verify agent score:**
   - After agent completes or dies, check console for submission log
   - Navigate to `/highscore` page
   - Filter by "agent" mode to see agent scores
   - Verify metadata shows agent-specific behavior

### Testing Score Calculation

The score formula is:
```
score = currency_collected
      + (interactives_found × 10)
      + (enemies_avoided × 5)
      + breakable_damage
      + damage_mitigated
```

**Test cases:**
1. **Stealth run:** Avoid all enemies → High enemy_avoided score
2. **Combat run:** Kill all enemies → High damage_dealt, low enemy_avoided
3. **Exploration run:** Find interactives, break objects → High interactives + breakable_damage
4. **Defensive run:** Use defense cards → High damage_mitigated

Each playstyle should produce different score compositions visible in metadata.

## Expected Behaviors

### Successful Score Submission
- Console log: `[GoneRogue] Highscore submitted: <score> Entry ID: <uuid>`
- Score appears on `/highscore` page within seconds
- Metadata shows accurate game stats

### Score Rejection
If submission fails:
- Console error: `[GoneRogue] Failed to submit highscore: <reason>`
- Common reasons:
  - Invalid display_name
  - Invalid mode (must be 'human' or 'agent')
  - Invalid game_id

### Agent Detection
- While agent is active: `AgentIntegration.isActive()` returns `true`
- Mode field in submission set to `'agent'`
- Agent scores appear with 🤖 indicator in leaderboard UI

## Troubleshooting

### Score not appearing on leaderboard
1. Check browser console for submission errors
2. Verify localStorage: `localStorage.getItem('eyesonly_highscores')`
3. Ensure you extracted successfully (success=true)
4. Check that HighscoreState is loaded: `typeof HighscoreState !== 'undefined'`

### Agent not tracking properly
1. Verify agent is active: `AgentIntegration.isActive()`
2. Check that HeadlessAdapter loaded: `typeof HeadlessAdapter !== 'undefined'`
3. Ensure game is active before starting agent
4. Review console for agent loop errors

### Incorrect metadata
1. Check tracking variables are resetting on game start
2. Verify all tracking increments are in place (run validation script)
3. Test specific gameplay actions that should increment counters

## Development Notes

### Adding New Tracking Metrics

To track a new metric (e.g., items found):

1. **Add variable to gone-rogue.js:**
   ```javascript
   var _itemsFound = 0;
   ```

2. **Initialize in start():**
   ```javascript
   _itemsFound = 0;
   ```

3. **Track the event:**
   ```javascript
   // In item pickup handler
   _itemsFound++;
   ```

4. **Include in submission:**
   ```javascript
   metadata: {
     // ... existing fields
     items_found: _itemsFound
   }
   ```

5. **Update UI to display** in `highscore-ui.js` if needed

### Testing Determinism

For reproducible testing:
1. Use fixed random seed (when implemented)
2. Record action traces with `adapter.exportTrace()`
3. Replay traces to verify score consistency

## Continuous Integration

The automated Node.js validation script (`test-highscore-integration.js`) can be integrated into CI:

```yaml
# .github/workflows/test.yml
- name: Validate Highscore Integration
  run: node test-highscore-integration.js
```

This ensures tracking code remains intact across changes.
