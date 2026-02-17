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

## MVP Audit System

### Overview

The **MVP Audit System** is an enhanced testing framework built on top of the base Agent Engine, specifically designed to validate game readiness for human playtesters. It provides comprehensive UX metrics tracking and automated pass/fail assessment.

### Files

- **agent-mvp-audit.js** - Enhanced engine with UX tracking (~35KB)
- **test-agent-mvp-audit.html** - Interactive MVP audit runner (~21KB)
- **validate-mvp-audit.js** - Automated validation suite (60+ tests)
- **test-muzzle-flash.html** - Visual test for weapon firing effects

### Quick Start - MVP Audit

1. Open `public/tests/test-agent-mvp-audit.html` in a web browser
2. Configure audit parameters:
   - Number of Runs: **100+** recommended for statistical significance
   - Max Floor: 30 (default)
   - Enable Elite Enemies: ✓
   - Track UX Metrics: ✓ (required for MVP assessment)
3. Click "Run MVP Audit"
4. Review comprehensive MVP readiness report
5. Export detailed results as CSV or JSON

### What MVP Audit Tests

#### 1. **Lighting System Utility** 💡
- **Metrics Tracked**:
  - Stealth bonus opportunity count
  - Stealth bonus utilization rate
  - Shadow usage frequency
  - Darkness encounter rate
  - Light source placement value

- **Scoring Criteria**:
  - ✓ PASS: >40% utilization rate
  - ⚠ WARNING: 20-40% utilization rate  
  - ✗ FAIL: <20% utilization rate

- **Pass Requirement**: Players must engage with lighting mechanics >40% of opportunities

#### 2. **Ground Effects Engagement** 🌋
- **Metrics Tracked**:
  - Total ground effects encountered
  - Damage taken from effects
  - Benefits gained from effects
  - Strategic usage (oil ignition, smoke cover)
  - Effect spread patterns

- **Scoring Criteria**:
  - ✓ PASS: 2-20 damage per run average
  - ⚠ WARNING: <2 (too rare) or >20 (too punishing)
  - ✗ FAIL: Effects not encountered or game-breaking damage

- **Pass Requirement**: Ground effects must be balanced (present but not overwhelming)

#### 3. **STR Combat Balance** ⚔️
- **Metrics Tracked**:
  - Combat initiation count
  - Win/loss ratio
  - Average damage dealt per combat
  - Average damage taken per combat
  - Card usage patterns by type
  - Combat round duration

- **Scoring Criteria**:
  - ✓ PASS: 40-80% win rate
  - ⚠ WARNING: 30-40% or 80-90% win rate
  - ✗ FAIL: <30% (too hard) or >90% (too easy)

- **Pass Requirement**: Combat must be challenging but fair (50-70% win rate ideal)

#### 4. **Boss Encounters** 👹
- **Mathematical Defeat Calculation**: Boss HP vs Player Deck Power
- **Metrics Tracked**:
  - Boss encounter count
  - Boss defeat rate
  - Impossible boss detection (mathematically unbeatable)

- **Scoring Criteria**:
  - ✓ PASS: 30-70% boss defeat rate
  - ⚠ WARNING: <30% or >70%
  - ✗ CRITICAL: Any mathematically impossible bosses

- **Pass Requirement**: Bosses must be beatable with proper preparation

#### 5. **Pathfinding Quality** 🗺️
- **Metrics Tracked**:
  - Stuck situations (no valid moves)
  - Backtracking frequency
  - Optimal path following rate
  - Map exploration coverage
  - Exit finding efficiency

- **Scoring Criteria**:
  - ✓ PASS: 0 stuck situations
  - ✗ CRITICAL: Any stuck situations detected

- **Pass Requirement**: **Zero tolerance for stuck/blocked situations** (game-breaking bugs)

#### 6. **Economy Balance** 💰
- **Metrics Tracked**:
  - Average credits per floor
  - Spending patterns
  - Resource starvation events
  - Excess currency events
  - Vendor interaction frequency

- **Scoring Criteria**:
  - ✓ PASS: 50-500 credits per floor
  - ⚠ WARNING: <50 (starvation) or >500 (overabundance)
  - ✗ FAIL: Extreme imbalances

- **Pass Requirement**: Economy must feel tight but not punishing

### Enhanced Personas

In addition to base personas, MVP Audit includes specialized test personas:

#### STEALTH_SPECIALIST
- **Purpose**: Validate lighting system utility
- **Behavior**: Actively seeks shadows and darkness
- **Strategy**: Prioritizes stealth bonuses over direct combat
- **Vendor**: Buys light-related items
- **Expected Outcome**: High lighting utilization rate

#### GROUND_EFFECTS_TESTER
- **Purpose**: Validate ground effects engagement
- **Behavior**: Intentionally interacts with all ground effects
- **Strategy**: Tests oil ignition, smoke cover, fire damage
- **Expected Outcome**: High ground effects encounter rate

### MVP Readiness Report

The audit generates a comprehensive report with:

#### Overall Score (0-100)
- Weighted average of all system scores
- **Pass Threshold: ≥70** with no critical issues

#### Critical Issues (MVP Blockers)
- Game-breaking bugs (stuck situations, impossible bosses)
- Severity: **CRITICAL** - Must fix before MVP
- Example: "Pathfinding: 3 stuck situations detected"

#### Warnings (Balance Concerns)
- Systems that need tuning but aren't blockers
- Severity: **WARNING** - Should address for better UX
- Example: "Lighting: 25% utilization - increase incentives"

#### Recommendations
- Actionable suggestions for improvement
- Based on aggregate data analysis
- Prioritized by impact on player experience

### Example MVP Report

```
📋 MVP READINESS AUDIT REPORT
========================================
✓ MVP READY
Overall Score: 82/100
========================================

UX SYSTEM SCORES:
💡 Lighting System:        85/100  ✓ PASS
🌋 Ground Effects:         80/100  ✓ PASS
⚔️  STR Combat:            90/100  ✓ PASS
🗺️  Pathfinding:          100/100  ✓ PASS
💰 Economy:                85/100  ✓ PASS

CRITICAL ISSUES: 0

WARNINGS: 1
⚠ Lighting: Moderate utilization (35%) - Make benefits more obvious

RECOMMENDATIONS:
→ Run 500+ simulations for statistical confidence
→ Test with human playtesters for UX validation
→ Monitor for edge cases and rare bugs
```

### Interpreting MVP Results

#### MVP Ready ✓
- Overall Score ≥ 70
- Zero critical issues
- All core systems functional
- Balance within acceptable ranges
- **Action**: Proceed to human playtesting

#### Not MVP Ready ✗
- Overall Score < 70 or critical issues present
- Game-breaking bugs detected
- Major balance issues
- **Action**: Address critical issues before playtesting

### Export Formats

#### CSV Export
```csv
Run ID,Persona,End Floor,Survived,Final Credits,Mythics,STR Combat Wins,Stuck Count,Lighting Util %
1,MINMAXER,30,true,542,2,8,0,45.2
2,STEALTH_SPECIALIST,25,true,389,1,6,0,78.5
```

#### JSON Export
```json
{
  "metadata": {
    "timestamp": "2026-02-17T22:00:00Z",
    "totalRuns": 100,
    "maxFloor": 30
  },
  "summary": {
    "survivalRate": "45.0",
    "avgFinalFloor": 18.5
  },
  "mvpReadiness": {
    "overallScore": "82",
    "passed": true,
    "criticalIssues": [],
    "warnings": [...]
  },
  "uxAudit": {
    "lighting": {...},
    "groundEffects": {...},
    "combat": {...},
    "pathfinding": {...},
    "economy": {...}
  }
}
```

### Command-Line Validation

```bash
cd public/tests
node validate-mvp-audit.js
```

Expected output: **60+/60+ tests passing**

### Visual Tests

#### Muzzle Flash Test
- **File**: `test-muzzle-flash.html`
- **Purpose**: Confirm muzzle flash originates from player's directional gun indicator
- **Interactive**: Move player with arrow buttons, fire weapon to see flash
- **Validates**: Visual effect positioning and timing

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
