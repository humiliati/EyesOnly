# MVP Audit System - Gap Analysis & Enhancement Plan

## Executive Summary

Based on team feedback (Basil, 2/17/2026), the current MVP audit system needs significant enhancements to provide trustworthy, actionable UX validation. This document outlines gaps and implementation plan.

## Current Implementation (v1.0)

### ✅ What We Have
- Basic agent simulation with 6+ personas
- UX metrics tracking (lighting, ground effects, combat, pathfinding, economy)
- MVP readiness scoring (0-100)
- CSV/JSON export
- 60+ automated validation tests
- Interactive HTML test runner

### ⚠️ Critical Gaps Identified

#### 1. **Lack of Human-like IO Constraints**
**Problem**: Audit agents can take actions that *don’t correspond to real player input*.
- No action timing/delays (unbounded APM)
- No distinction between **tap vs press/drag vs release** (the “fishing” control)
- Agents may bypass the movement stack (e.g., set destination/cell directly) rather than exercising **the same pathing + collision + move-locks** as players
- Uses internal APIs instead of public UI hooks

**Impact**: Results don't reflect actual player experience. **HIGH SEVERITY**

**2026-02-19 update**: player motion is now *animated/free-feel* while grid math remains authoritative. This improves UX, but it raises the bar for audit validity: the audit runner must operate at the **gesture layer** (pointer events) with realistic throttles, not at the cell/state layer.

#### 2. **No Deterministic Replay System**
**Problem**: Bugs cannot be reproduced reliably end-to-end.
- Seed initialization is not yet standardized (conflicting `SeededRNG` vs `SeededRandom` patterns) and not yet guaranteed to cover *all* proc-gen call sites
- No **gesture-layer** input trace logging (tap / fishing drag / release with timestamps)
- Can't replay a specific failed run from a single artifact/id
- No consistent state diff tracking

**Impact**: Cannot debug or verify specific failures. **HIGH SEVERITY**

#### 3. **Simulated vs Real Maps**
**Problem**: Agent doesn't use actual game maps.
- Simulates threats/rewards instead of parsing real maps
- Doesn't validate actual pathfinding logic
- Doesn't test real collision detection
- Doesn't validate actual exit placement

**Impact**: "Separate sim drift" - findings don't apply to real game. **CRITICAL**

#### 4. **Non-Mathematical Boss Checks**
**Problem**: Boss difficulty uses probability, not mathematical proof.
- No closed-form expected value calculations
- No TTK (time to kill) analysis
- No survival margin distributions
- Can't prove boss is beatable vs impossible

**Impact**: May ship impossible bosses. **MVP BLOCKER**

#### 5. **No A/B Testing Framework**
**Problem**: Cannot measure feature utility.
- Can't run same seed with lighting on/off
- Can't measure delta survival rate
- Can't prove lighting/ground effects are useful
- No counterfactual comparisons

**Impact**: Cannot answer "is lighting actually useful?" **CRITICAL FOR UX**

## Enhancement Plan

> NOTE (2026-02-19): Movement+lighting UX upgrades are now tracked in a unified plan.
> See: `docs/UNIFIED_MOVEMENT_LIGHTING_VISION.md` (low-impact free-move animation + drag-to-continue + lighting occlusion).

### Phase 1: MVP Blockers (Must Have Before Launch)

#### 1.1 Mathematical Boss Viability Checker
**Priority**: 🚨 CRITICAL - MVP BLOCKER

**Implementation**:
```javascript
function checkBossViability(boss, playerBuild) {
  // Closed-form expected value
  var playerMaxDPS = calculateMaxDPS(playerBuild);
  var bossEffectiveDPS = boss.damage - playerBuild.defense;
  
  // TTK calculations
  var playerTTK = boss.hp / playerMaxDPS;
  var bossTTK = playerBuild.hp / bossEffectiveDPS;
  
  // Mathematical impossibility check
  if (bossTTK <= playerTTK * 0.8) {
    return {
      viable: false,
      reason: 'MATHEMATICALLY_IMPOSSIBLE',
      playerTTK: playerTTK,
      bossTTK: bossTTK,
      survivalMargin: (bossTTK / playerTTK) - 1
    };
  }
  
  // Survival margin distribution
  var survivalProbability = calculateSurvivalProbability(
    playerBuild,
    boss,
    simulateRounds: 1000
  );
  
  return {
    viable: survivalProbability > 0.1,
    expectedValue: survivalProbability,
    minRequiredDeck: calculateMinDeck(boss)
  };
}
```

**Acceptance Criteria**:
- ✅ Proves boss is beatable with optimal play
- ✅ Calculates exact TTK for player and boss
- ✅ Flags mathematically impossible bosses
- ✅ Reports minimum required deck power

#### 1.2 Deterministic Seed + Replay System (Gesture-Aware)
**Priority**: 🚨 CRITICAL - DEBUGGING REQUIRED

**Why this changed**: with “free-feel” movement on top of grid math, determinism must cover:
- proc-gen RNG
- **gesture input traces** (tap/drag/release) with timestamps
- feature toggles (lighting occlusion on/off, ground effects, etc.)

**Implementation (canonical seed model)**:
```javascript
// Canonical in-game seed variables (preferred)
//   _currentSeed, _currentSeedPhrase, _seedRNG
// Legacy alias:
//   _runSeed

class DeterministicRunRecorder {
  constructor(seed, seedPhrase) {
    this.seed = seed;
    this.seedPhrase = seedPhrase || null;
    this.gestureTrace = []; // pointer primitives, not internal state
    this.stateDiffs = [];
    this.featureFlags = {};
  }

  recordGesture(evt) {
    // evt: { tMs, kind:'down'|'move'|'up'|'tap', x, y, gridX, gridY, pointerId }
    this.gestureTrace.push(evt);
  }

  recordStateDiff(diff) {
    this.stateDiffs.push(diff);
  }

  exportReplay() {
    return {
      version: 1,
      seed: this.seed,
      seedPhrase: this.seedPhrase,
      featureFlags: this.featureFlags,
      gestureTrace: this.gestureTrace,
      stateDiffs: this.stateDiffs
    };
  }
}

// Seed initialization should prefer SeededRandom if present:
//   _currentSeed = SeededRandom.generateRandomSeed();
//   _currentSeedPhrase = SeededRandom.generateSeedPhrase(_currentSeed);
//   _seedRNG = new SeededRandom.SeededRNG(_currentSeed);
//   _runSeed = _currentSeed; // legacy alias
```

**Acceptance Criteria**:
- ✅ Same seed + same **gesture trace** + same feature flags = same outcome
- ✅ Can export and replay any run (including “fishing” drag-follow)
- ✅ Can reproduce any failure from a single JSON artifact
- ✅ State diffs logged for debugging
- ✅ (Optional but recommended) Replay artifacts can be persisted and reloaded by id (D1/DB-backed), not just held in-memory
- ✅ Seed system aligns with codebase reality (`SeededRandom` preferred; `_runSeed` treated as alias)

#### 1.3 Human-like IO Constraints (Fishing-Drag + Timing)
**Priority**: ⚠️ HIGH - VALIDITY REQUIRED

**Implementation**:
```javascript
class HumanLikeAgent {
  constructor() {
    this.lastInputTime = 0;
    this.minInputDelayMs = 120; // throttle "impossible" APM
    this.maxDragUpdateHz = 15;  // matches intended drag-follow repath throttles
  }

  // Allowed primitives (gesture layer)
  pointerDown(x, y) { /* begins fishing */ }
  pointerMove(x, y) { /* updates fishing target (throttled) */ }
  pointerUp(x, y) { /* ends fishing */ }
  tap(x, y) { /* quick down/up */ }
  wait(ms) { /* no input */ }

  // Forbidden:
  // - direct state mutation (player.x/y, destination cell setters)
  // - calling internal movement/path APIs that bypass UI

  canSendInput() {
    var now = Date.now();
    return (now - this.lastInputTime) >= this.minInputDelayMs;
  }
}
```

**Acceptance Criteria**:
- ✅ Only uses actions humans can perform (pointer/touch gestures)
- ✅ Respects timing constraints (min delay + drag update throttles)
- ✅ Cannot call hidden APIs or mutate internal state
- ✅ Exercises the real movement stack (pathing + collision + move-locks)
- ✅ Works on both desktop + mobile interactive grid

### Phase 2: UX Validation (Required for Confidence)

#### 2.1 A/B Testing Framework
**Priority**: ⚠️ HIGH - UX PROOF REQUIRED

**Implementation**:
```javascript
class ABTestRunner {
  runABTest(seed, scenarios) {
    var results = {};
    
    // Run with lighting enabled
    var withLighting = this.runSeed(seed, {
      lightingEnabled: true,
      groundEffectsEnabled: true
    });
    
    // Run with lighting disabled (same seed!)
    var withoutLighting = this.runSeed(seed, {
      lightingEnabled: false,
      groundEffectsEnabled: true
    });
    
    // Calculate deltas
    return {
      deltaSurvival: withLighting.survived - withoutLighting.survived,
      deltaDamage: withLighting.damageTaken - withoutLighting.damageTaken,
      deltaDuration: withLighting.turns - withoutLighting.turns,
      deltaRegretMoves: withLighting.regretMoves - withoutLighting.regretMoves,
      
      // Feature utility score
      lightingUtility: this.calculateUtility(withLighting, withoutLighting)
    };
  }
  
  calculateUtility(withFeature, withoutFeature) {
    // Positive utility = feature helps
    // Negative utility = feature hurts
    // Zero utility = feature is useless
    
    var survivalDelta = (withFeature.survived - withoutFeature.survived) * 100;
    var damageDelta = (withoutFeature.damage - withFeature.damage) * 10;
    
    return survivalDelta + damageDelta;
  }
}
```

**Acceptance Criteria**:
- ✅ Can run same seed with different feature toggles
- ✅ Calculates utility deltas
- ✅ Proves if lighting/ground effects are useful
- ✅ Reports which features have no impact

#### 2.2 Enhanced UX Personas
**Priority**: 📊 MEDIUM - BETTER COVERAGE

**New Personas**:
```javascript
LIGHTING_MAXXER: {
  name: 'LIGHTING_MAXXER',
  description: 'Always maximizes light bonuses to test perception impact',
  alwaysSeeksLighting: true,
  prefersLitAreas: true,
  buysLightItems: true,
  avoidsUnlitAreas: true
}

GROUND_EFFECT_ABUSER: {
  name: 'GROUND_EFFECT_ABUSER',
  description: 'Routes through ground effects to test ROI',
  seeksGroundEffects: true,
  testsOilIgnition: true,
  usesSmokeForCover: true,
  measuresDamageTradeoffs: true
}

CAUTIOUS_TACTICIAN: {
  name: 'CAUTIOUS_TACTICIAN',
  description: 'Minimizes risk to evaluate if bonuses matter at low risk',
  riskTolerance: 0.1,
  onlyTakesCertainWins: true,
  evaluatesBonusValue: true
}

SWIPE_OPTIMIZER: {
  name: 'SWIPE_OPTIMIZER',
  description: 'Uses minimal swipe sets to test fat-finger resistance',
  minimizeSwipes: true,
  testsFatFingerTolerance: true,
  usesCardHotkeys: true
}
```

### Phase 3: Integration (Essential for Trust)

#### 3.1 Real Game Integration (No Sim Drift, No Hidden Hooks)
**Priority**: 🎯 HIGHEST - AVOID SIM DRIFT

**2026-02-19 update**: with the movement animation overhaul complete, "real integration" also means the audit runner must drive the game via the same **interactive grid / pointer gesture layer** the player uses, not by calling internal movement functions.


**Two Approaches**:

**Option A: Headless Mode** (Preferred)
```javascript
// In actual game code (gone-rogue.js)
var GoneRogue = {
  // ... existing code ...
  
  // Add headless mode interface
  headless: {
    getState() {
      return {
        player: _player,
        enemies: _enemies,
        map: _grid,
        items: _items,
        tick: _turn
      };
    },
    
    getLegalActions() {
      var actions = [];
      // North, south, east, west
      if (canMove('north')) actions.push({type: 'move', dir: 'north'});
      // ... etc
      // Cards
      _player.deck.forEach(card => {
        actions.push({type: 'useCard', card: card});
      });
      return actions;
    },
    
    applyAction(action) {
      if (action.type === 'move') {
        return _movePlayer(action.dir);
      } else if (action.type === 'useCard') {
        return _playCard(action.card);
      }
    }
  }
};
```

**Option B: Pure JS Rules Model** (Fallback)
```javascript
// Extracted from game
var GameRules = {
  movePlayer(state, direction) { /* ... */ },
  resolveComba(state, card) { /* ... */ },
  checkVictory(state) { /* ... */ },
  // etc.
};
```

**Acceptance Criteria**:
- ✅ Agent uses exact game rules
- ✅ No drift between simulation and reality
- ✅ Can validate against actual game behavior
- ✅ Deterministic and reproducible

#### 3.2 Replay Functionality
**Priority**: 📹 MEDIUM - DEBUGGING AID

**HTML UI Addition**:
```html
<div class="replay-controls">
  <h3>Replay Failed Run</h3>
  <input type="text" id="replayId" placeholder="Run ID or Seed">
  <button onclick="replayRun()">▶️ Replay</button>
  <button onclick="stepThrough()">⏭️ Step Through</button>
  <button onclick="exportReplayJSON()">📥 Export Replay</button>
</div>
```

### Phase 4: Enhanced Validation

#### 4.1 New Validation Tests
```javascript
// Action legality
test('agents only take legal actions', () => {
  var illegalActions = [];
  runs.forEach(run => {
    run.actions.forEach(action => {
      if (!isLegal(action, run.state)) {
        illegalActions.push(action);
      }
    });
  });
  assert(illegalActions.length === 0);
});

// Determinism
test('same seed produces same outcome', () => {
  var run1 = executeWithSeed(12345);
  var run2 = executeWithSeed(12345);
  assert(deepEqual(run1.finalState, run2.finalState));
});

// Boss math sanity
test('known impossible boss is detected', () => {
  var impossibleBoss = {hp: 1000, damage: 50, defense: 100};
  var weakBuild = {hp: 100, damage: 5, defense: 0};
  var check = checkBossViability(impossibleBoss, weakBuild);
  assert(check.viable === false);
  assert(check.reason === 'MATHEMATICALLY_IMPOSSIBLE');
});

// Feature utility
test('disabling lighting shows measurable delta', () => {
  var withLighting = runWithFeature('lighting', true);
  var withoutLighting = runWithFeature('lighting', false);
  var delta = withLighting.survived - withoutLighting.survived;
  assert(Math.abs(delta) > 0); // Feature must have impact
});
```

## Implementation Timeline

### Week 1: MVP Blockers
- [ ] Mathematical boss viability checker
- [ ] Deterministic seed system
- [ ] Human-like IO constraints

### Week 2: UX Validation
- [ ] A/B testing framework
- [ ] Counterfactual metrics
- [ ] Enhanced personas

### Week 3: Integration
- [ ] Real game headless mode
- [ ] Replay functionality
- [ ] Enhanced validation suite

### Week 4: Polish & Documentation
- [ ] Comprehensive testing
- [ ] Documentation updates
- [ ] Example replay exports
- [ ] Boss viability report samples

## Success Criteria

### Before MVP Launch, We Must:
1. ✅ Prove all bosses are mathematically beatable
2. ✅ Demonstrate lighting has >20% utility delta
3. ✅ Show ground effects have measurable impact
4. ✅ Confirm zero impossible scenarios
5. ✅ Achieve 100% reproducibility (seed + actions = state)
6. ✅ Pass all action legality tests
7. ✅ Generate boss viability report for all bosses

### Nice to Have:
- Replay exports for top failures
- Heatmap of death locations
- Statistical confidence intervals
- A/B comparison visualizations

## Risk Assessment

### High Risk Areas:
1. **Integration Drift**: If agent uses separate sim, findings may not apply
   - Mitigation: Headless mode using actual game code
   
2. **Boss Impossibility**: May ship unbeatable bosses
   - Mitigation: Mathematical viability checker before launch
   
3. **Feature Uselessness**: Lighting/ground effects may have no impact
   - Mitigation: A/B testing proves utility or identifies need for buffs

### Medium Risk Areas:
1. **Action Illegality**: Agent may use impossible actions
   - Mitigation: Legal action constraints
   
2. **Non-reproducibility**: Can't debug failures
   - Mitigation: Deterministic seed system

## Conclusion

Current MVP audit (v1.0) provides a good foundation but has critical gaps that must be addressed before trusting its findings for launch decisions. Priority should be:

1. **Mathematical boss checks** (avoid shipping impossible content)
2. **A/B testing** (prove features are useful)
3. **Real game integration** (avoid sim drift)

With these enhancements, the MVP audit system will provide trustworthy, actionable insights for launch readiness.
