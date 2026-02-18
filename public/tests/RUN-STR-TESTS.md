# Quick Start: Run STR Economy Tests

## Option 1: Run Both Tests (Recommended)

Open this file in your browser:
```
public/tests/test-str-economy-runner.html
```

Follow the on-screen instructions.

---

## Option 2: Run UI Test Only

**Step 1**: Start the game
- Open `public/index.html` in browser
- Type in terminal: `rogue`

**Step 2A**: Via test runner
- Open `test-str-economy-runner.html` in same browser
- Click "Run UI Test"

**Step 2B**: Via game command
- In game terminal, type: `AGENT NATURAL`

**Watch**: Agent plays game with real-time commentary

**Stop**: Type `AGENT STOP` in game terminal

---

## Option 3: Run Math Tests Only

**Step 1**: Open test runner
```
public/tests/test-str-economy-runner.html
```

**Step 2**: Configure
- Runs: `100` (or more for better stats)
- Focus: `STR Combat Heavy`
- Max Floor: `30`

**Step 3**: Run
- Click "Run Math Tests"
- Wait for completion (5-10 min)

**Step 4**: Review results
- Check console output for detailed report

---

## Expected Results

### Healthy STR Economy
- ✓ Win rate: 40-80%
- ✓ Average credits: 500-2000
- ✓ No stuck situations
- ✓ Boss defeat rate: 30-70%

### Problem Indicators
- ⚠️ Win rate < 40% → Combat too hard
- ⚠️ Win rate > 80% → Combat too easy
- ⚠️ Avg credits < 100 → Currency starvation
- ⚠️ Avg credits > 5000 → Too much money

---

## Quick Test Matrix

For comprehensive validation, run these:

1. **STR Heavy** (100 runs) → Tests max combat
2. **STR Balanced** (100 runs) → Tests normal play
3. **STR Economy** (100 runs) → Tests resource management
4. **UI Natural** (1 run) → Watch agent play
5. **UI Developer** (1 run) → Fast validation

Total time: ~40 minutes

---

## Troubleshooting

**"GoneRogue not loaded"**
→ Make sure game is running and in Gone Rogue mode

**"MVPAuditEngine not loaded"**
→ Check that agent-mvp-audit.js is in tests folder

**Browser freezes**
→ Reduce number of runs or use Chrome

**Results vary wildly**
→ Increase runs to 500+ for better statistics

---

## More Information

See `STR-ECONOMY-TESTING-GUIDE.md` for:
- Detailed instructions
- Result interpretation
- Persona explanations
- Best practices
- Advanced usage

---

## Quick Command Reference

### In-Game Commands (UI Test)
```
AGENT NATURAL      # Start human-like agent
AGENT DEVELOPER    # Start fast test agent
AGENT STOP         # Stop agent and get report
AGENT PAUSE        # Pause/resume agent
AGENT REPORT       # View current stats
AGENT MODE         # Show current mode
```

### Test Focus Options (Math Test)
- `str-heavy` → Maximum combat (GREEDY_LOOTER, RISKY_GAMBLER, MINMAXER)
- `str-balanced` → Mixed play (MINMAXER, GREEDY_LOOTER, SPEEDRUNNER)
- `str-economy` → Resource mgmt (SAVER_HOARDER, MINMAXER, RISKY_GAMBLER)
- `all` → All personas

---

**Ready to test?** Open `test-str-economy-runner.html` and click a button!
