# Quick Start: Tutorial Floors Testing

## 5-Minute Validation

### Step 1: Open Test Page
Open in your browser:
```
/public/tests/test-tutorial-floors-bot.html
```

### Step 2: Generate Seed
Click one of:
- **"Generate New Seed"** - Random seed for new test
- **"Use Daily Seed"** - Today's consistent seed
- **"Enter Custom Seed"** - Reproduce specific run

You'll see something like: **ALPHA-BRAVO-CHARLIE (1234567890)**

### Step 3: Run Tests
Click **"▶ Run All Tests"**

✅ Expected: All 10 tests pass (green)

### Step 4: Export Results
Click **"💾 Export Results"**

Saves: `tutorial-floors-test-{seed}.json`

## What Gets Tested?

1. ✅ Seed system works
2. ✅ Tutorial floors load correctly
3. ✅ Picnic baskets spawn on Floor 1
4. ✅ Locked gate blocks Floor 2
5. ✅ Key unlocks gate
6. ✅ Enemies spawn on Floor 3
7. ✅ Zone boundaries enforce key/gate rules
8. ✅ Maps fit in 40x20 portrait bounds
9. ✅ No bot farming exploits
10. ✅ Deterministic generation works

## In-Game Seed Display

### See Current Seed
1. Open game: `/public/index.html`
2. Type: `rogue`
3. Hover mouse over **AWOL button** (● icon in top-right header)
4. Tooltip shows: "Seed: ALPHA-BRAVO-CHARLIE"

### Use Specific Seed
```javascript
// In browser console before starting game
GoneRogue.setSeed(1234567890);
```

Then type `rogue` to start with that seed.

## Bot Simulation

### Watch Bot Play
Click **"🤖 Run Bot Simulation"**

Shows step-by-step bot actions:
- Floor 1: Navigate → Break picnic → Collect drops → Exit
- Floor 2: Navigate → Break flower → Get key → Unlock gate → Exit
- Floor 3: Avoid enemies → Break baskets → Exit

### Why This Matters
Simulates recorded macro replay (like tiny.macro). Validates:
- No infinite loops
- No farming exploits
- Limited resources per floor
- Probabilistic drops (not guaranteed)

## Screenshot Capture

### Quick Screenshot
1. Open game in browser
2. Type `rogue` to start
3. Hover AWOL button to note seed phrase
4. Press **F12** (DevTools)
5. Press **Ctrl+Shift+P** (Mac: Cmd+Shift+P)
6. Type "screenshot"
7. Select "Capture screenshot"
8. Save to `docs/testing-screenshots/`

### Naming
Use format: `{type}_{feature}_{date}.png`

Example: `bot-run_floor-2-key-gate_20260220.png`

## Reproduce Bug

### If You Find a Bug
1. Note the seed phrase from AWOL button
2. Take screenshot
3. Export test results
4. Report with:
   - Seed phrase
   - Screenshot
   - Test JSON
   - What went wrong

### Reproduce Bug Later
```javascript
// Use the exact seed from bug report
GoneRogue.setSeed(1234567890);
```

Same seed = Same floor layout = Reproducible bug

## Common Issues

### Tests Fail?
- Check browser console for errors
- Verify all scripts load (check Network tab)
- Try "Generate New Seed" and rerun

### Seed Not Showing in AWOL Tooltip?
- Verify `seeded-random.js` loaded
- Check browser console for errors
- Refresh page and restart game

### Can't Open Test Page?
- Make sure you're running from web server
- File URLs may not work (use `http://localhost`)
- Check file paths are correct

## Advanced: Headless Testing

### For Developers
Use headless adapter for automated testing:

```javascript
const HeadlessAdapter = require('./tests/agent-headless-adapter.js');
const adapter = new HeadlessAdapter.HeadlessGameAdapter({
  minActionDelay: 50,
  strictPathBinding: true,
  verbose: true
});

adapter.init(GoneRogue);
adapter.startGame({ seed: 1234567890 });

// Run bot actions
const state = adapter.getState();
const actions = adapter.getLegalActions();
await adapter.applyAction(actions[0]);

// Export trace
const trace = adapter.exportTrace();
```

See `/public/tests/agent-headless-adapter.js` for full API.

## Files You Care About

### Test Pages
- `/public/tests/test-tutorial-floors-bot.html` - Main test UI
- `/public/tests/test-zone-boundaries.html` - Zone boundary tests
- `/public/tests/test-agent-mvp-audit.html` - Agent playtest UI

### Documentation
- `/public/tests/README-PLAYTEST-AUTHORITATIVE.md` - Official protocol
- `/docs/testing-screenshots/README.md` - Screenshot guide
- `/docs/testing-screenshots/IMPLEMENTATION_SUMMARY.md` - Full docs

### Code
- `/public/js/seeded-random.js` - RNG module
- `/public/js/gone-rogue.js` - Game engine (has seed API)
- `/public/js/tutorial-floors.js` - Floor layouts
- `/public/tests/test-tutorial-floors-bot.js` - Test suite

## That's It!

**tl;dr**: Open test page → Generate seed → Run tests → All pass → Done ✅

Questions? Check IMPLEMENTATION_SUMMARY.md for details.
