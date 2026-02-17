# Agent Engine Testing System

## Overview

The Agent Engine is a headless simulation system designed to test game balance, economy tuning, and identify game-breaking bugs in the EYES ONLY roguelike game. It runs autonomous AI agents through complete game runs, tracking resource management, survival rates, and critical failure points.

## Files

- **agent-engine.js** - Core simulation engine (~26KB)
- **test-agent-engine.html** - Interactive browser-based test runner (~13KB)
- **validate-agent-engine.js** - Automated validation suite (49 passing tests)

## Quick Start

### Browser Testing (Recommended)

1. Open `public/tests/test-agent-engine.html` in a web browser
2. Configure simulation parameters:
   - Number of Runs (1-1000)
   - Persona Filter (ALL or specific persona)
   - Max Floor (1-50)
   - Enable/Disable Elite Enemies
   - Verbose Output toggle
3. Click "Run Simulation"
4. Review results in real-time
5. Export data as CSV or JSON for analysis

### Command-Line Validation

```bash
cd public/tests
node validate-agent-engine.js
```

Expected output: **49/49 tests passing**

## Personas

The engine simulates 6 distinct AI personas with different playstyles:

### 1. GREEDY_LOOTER
- **Strategy**: Opens every chest, fights every enemy, explores everything
- **Vendor**: Buys upgrades when available
- **Combat**: Thorough (fights all enemies)
- **Risk Tolerance**: 30%
- **Spending**: 50% of currency

### 2. SPEEDRUNNER
- **Strategy**: Rushes to exit, avoids combat
- **Vendor**: Skips all vendors
- **Combat**: Avoidance (runs from fights)
- **Risk Tolerance**: 70%
- **Spending**: 10% minimal

### 3. RISKY_GAMBLER
- **Strategy**: Burns all currency gambling for mythics
- **Vendor**: Gambles everything
- **Combat**: Selective
- **Risk Tolerance**: 50%
- **Spending**: 95% on gambling

### 4. SAVER_HOARDER
- **Strategy**: Never spends, brute forces with starter deck
- **Vendor**: Never purchases
- **Combat**: Conservative
- **Risk Tolerance**: 20%
- **Spending**: 0% (hoards everything)

### 5. MINMAXER
- **Strategy**: Optimal play, always chooses highest quality
- **Vendor**: Optimal (buys upgrades when weak, gambles when strong)
- **Combat**: Calculated
- **Risk Tolerance**: 40%
- **Spending**: 60% strategic

### 6. DUMB_RANDOM
- **Strategy**: Total RNG, random decisions
- **Vendor**: Random actions
- **Combat**: Random
- **Risk Tolerance**: 50%
- **Spending**: 50% random

## Game Mechanics Simulated

### Deck Power Calculation
Cards are scored by quality + power:
- MYTHIC: 20 + card power
- ELITE: 12 + card power
- RARE: 8 + card power
- UNCOMMON: 5 + card power
- COMMON: 2 + card power

### Threat Scaling
- Base threat = floor number × 8
- Persona modifiers:
  - SPEEDRUNNER: +20 threat (riskier shortcuts)
  - GREEDY_LOOTER: -10 threat (more prepared from looting)

### Survival Calculation
```javascript
survivalChance = min(95%, (deckPower / threatLevel) × 100)
survivalChance += persona.riskTolerance × 10
if (hp < 30) survivalChance -= 20
```

Random roll determines if agent survives the floor.

### Drop Rates
- **Mythic**: 0.1% per loot roll
- **Elite**: 1% per loot roll
- **Rare**: 5% per loot roll
- **Uncommon**: 20% per loot roll
- **Common**: 74.9% per loot roll

### Vendor Interactions

#### Healing
- Cost: 50 credits
- Restores: 40 HP
- Decision: Buy if HP < (maxHP × healThreshold)

#### Gambling
- Cost: 100 credits per spin
- Outcomes:
  - 5% Mythic card
  - 10% Elite card
  - 20% Rare card
  - 40% Get money back (100 credits)
  - 25% Lose everything

#### Card Purchases
- **Elite Card**: 250 credits
- **Rare Card**: 150 credits
- Decision based on persona strategy

### Boss Encounters
- Occur every 10 floors (10, 20, 30, etc.)
- Threat Level: floor × 15 (nearly 2× normal threat)
- **Guaranteed Drops**:
  - 1 Elite quality card (guaranteed)
  - 5% chance of Mythic card
  - 2× normal credits

### Stuck Detection
If an agent has no valid actions for 3+ consecutive floors, they're flagged as "stuck" - indicating a game-breaking bug.

## Report Metrics

### Summary Statistics
- Total runs executed
- Survival count and percentage
- Death count and percentage

### Per-Persona Breakdown
- Number of runs
- Survival rate
- Average final floor reached
- Average final credits
- Average deck size
- Mythic items found
- Elite items found
- Times stuck (bug indicator)

### Economy Analysis
- Mythic rate (% of runs that found mythics)
- Average final credits across all runs
- **Warnings**:
  - ⚠ Too much currency (avg > 5000) - economy too generous
  - ⚠ Currency starvation (avg < 100) - economy too harsh
  - ⚠ Saver trap detected (SAVER_HOARDER finishing with 10k+) - spending not incentivized

### Critical Events
- **Stuck Events**: Agents that got cornered/blocked
- **Impossible Bosses**: Bosses that killed agents despite optimal play
- **Death Analysis**: Common death floors and causes

## Export Formats

### CSV Export
```csv
Run ID,Persona,Death Floor,Survived,Cause,Final Credits,Mythics Found,Deck Size
1,MINMAXER,30,true,Reached max floor,542,2,12
2,GREEDY_LOOTER,15,false,Low Survival Chance,89,0,7
```

### JSON Export
```json
{
  "metadata": {
    "totalRuns": 100,
    "timestamp": "2026-02-17T09:15:32.123Z",
    "maxFloor": 30
  },
  "results": [
    {
      "runId": 1,
      "persona": "MINMAXER",
      "endFloor": 30,
      "survived": true,
      "finalCredits": 542,
      "mythicItemsFound": 2,
      "deathCause": null,
      "economyLog": [...],
      "criticalEvents": []
    }
  ]
}
```

## Usage Examples

### Baseline Testing
Run 100 DUMB_RANDOM agents to establish baseline survival rates and economy metrics:

```javascript
// In browser console after opening test-agent-engine.html
document.getElementById('numRuns').value = 100;
document.getElementById('persona').value = 'DUMB_RANDOM';
document.getElementById('runBtn').click();
```

### Stress Testing
Run 100 MINMAXER agents to test upper limits of optimal play:

```javascript
document.getElementById('numRuns').value = 100;
document.getElementById('persona').value = 'MINMAXER';
document.getElementById('runBtn').click();
```

### Economy Tuning
Run all personas (round-robin) to get comprehensive economy data:

```javascript
document.getElementById('numRuns').value = 60; // 10 runs per persona
document.getElementById('persona').value = 'ALL';
document.getElementById('runBtn').click();
```

### Elite Enemy Testing
Test if elite enemies are balanced:

```javascript
document.getElementById('enableElites').checked = true;
document.getElementById('numRuns').value = 50;
document.getElementById('persona').value = 'ALL';
document.getElementById('runBtn').click();
```

## Interpreting Results

### Healthy Economy Indicators
- ✓ 30-60% survival rate for MINMAXER
- ✓ 10-30% survival rate for DUMB_RANDOM
- ✓ Average final credits: 500-2000
- ✓ Mythic rate: 5-15% of runs
- ✓ No stuck events

### Warning Signs
- ✗ MINMAXER survival < 20% → Game too difficult
- ✗ DUMB_RANDOM survival > 40% → Game too easy
- ✗ Average credits > 5000 → Currency too abundant
- ✗ Average credits < 100 → Currency starvation
- ✗ SAVER_HOARDER survival > 30% → Spending not incentivized
- ✗ Any stuck events → Game-breaking bugs present
- ✗ Boss survival < 10% → Bosses mathematically impossible

## Validation Suite

The `validate-agent-engine.js` script runs 49 automated tests covering:

1. AgentEngine instantiation
2. Persona definitions
3. Game state initialization
4. Deck power calculation
5. Card generation
6. Single simulation runs
7. Multiple simulations
8. Report generation
9. CSV export
10. JSON export

All tests must pass before the engine is considered ready for production use.

## Performance

The engine is designed for fast batch simulation:
- **Speed**: Dozens of simulations per minute
- **Async/Await**: Non-blocking execution
- **Memory**: Efficiently handles 1000+ runs
- **Browser Compatibility**: Works in all modern browsers

## Future Enhancements

Potential improvements not yet implemented:
- Integration with actual CardSystem module for real card data
- More sophisticated combat simulation using STR combat logic
- Heatmap visualization of death locations
- Statistical analysis (standard deviation, confidence intervals)
- Batch test runner for automated nightly runs
- A/B testing framework for balance changes

## Troubleshooting

### "AgentEngine is not defined"
Make sure agent-engine.js is loaded before test-agent-engine.html script execution.

### Simulations run too fast to see
Enable "Verbose Output" checkbox for detailed logging.

### All agents dying on floor 1
Check starting deck configuration and initial threat levels in agent-engine.js.

### Export buttons disabled
Run a simulation first. Export buttons only activate after results are available.

## License

Part of the EYES ONLY project. See main repository for license details.
