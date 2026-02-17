/* ============================================================
   EYES ONLY - MVP Audit Engine Validation Script
   Runs automated tests on the MVP audit system
   ============================================================ */

// Load MVP audit engine (browser or Node.js)
var MVPAuditEngine = typeof window !== 'undefined' ? 
  window.MVPAuditEngine : 
  require('./agent-mvp-audit.js');

console.log('========================================');
console.log('MVP AUDIT ENGINE VALIDATION');
console.log('========================================\n');

var tests = {
  total: 0,
  passed: 0,
  failed: 0
};

function assert(condition, message) {
  tests.total++;
  if (condition) {
    tests.passed++;
    console.log('✓ PASS: ' + message);
    return true;
  } else {
    tests.failed++;
    console.error('✗ FAIL: ' + message);
    return false;
  }
}

async function runValidation() {
  console.log('--- Test 1: MVPAuditEngine instantiation ---');
  try {
    var engine = new MVPAuditEngine.MVPAuditEngine({
      verbose: false,
      maxFloor: 10,
      enableElites: true,
      trackUX: true
    });
    assert(engine !== null, 'MVPAuditEngine can be instantiated');
    assert(engine.maxFloor === 10, 'Config maxFloor is set correctly');
    assert(engine.trackUX === true, 'UX tracking is enabled');
    assert(engine.results.length === 0, 'Results array starts empty');
  } catch (e) {
    assert(false, 'MVPAuditEngine instantiation failed: ' + e.message);
  }

  console.log('\n--- Test 2: Extended persona definitions ---');
  try {
    var personas = MVPAuditEngine.PERSONAS;
    assert(personas !== undefined, 'PERSONAS object exists');
    assert(personas.STEALTH_SPECIALIST !== undefined, 'STEALTH_SPECIALIST persona exists');
    assert(personas.GROUND_EFFECTS_TESTER !== undefined, 'GROUND_EFFECTS_TESTER persona exists');
    assert(personas.STEALTH_SPECIALIST.prefersDarkness === true, 
           'STEALTH_SPECIALIST has prefersDarkness trait');
    assert(personas.GROUND_EFFECTS_TESTER.seeksGroundEffects === true,
           'GROUND_EFFECTS_TESTER has seeksGroundEffects trait');
  } catch (e) {
    assert(false, 'Persona definitions failed: ' + e.message);
  }

  console.log('\n--- Test 3: Game state initialization with UX tracking ---');
  try {
    var engine = new MVPAuditEngine.MVPAuditEngine({ verbose: false });
    var gameState = engine.initializeGameState();
    
    assert(gameState !== null, 'Game state initializes');
    assert(gameState.isAlive === true, 'Player starts alive');
    assert(gameState.hp === 100, 'Player starts with 100 HP');
    assert(gameState.credits === 50, 'Player starts with 50 credits');
    assert(Array.isArray(gameState.deck), 'Deck is an array');
    assert(gameState.deck.length === 5, 'Starter deck has 5 cards');
    assert(gameState.position !== undefined, 'Position tracking exists');
    assert(gameState.facing !== undefined, 'Facing direction tracked');
    assert(gameState.stealthBonus !== undefined, 'Stealth bonus tracked');
  } catch (e) {
    assert(false, 'Game state initialization failed: ' + e.message);
  }

  console.log('\n--- Test 4: UX metrics initialization ---');
  try {
    var engine = new MVPAuditEngine.MVPAuditEngine({ verbose: false, trackUX: true });
    
    assert(engine.uxMetrics !== undefined, 'UX metrics object exists');
    assert(engine.uxMetrics.lighting !== undefined, 'Lighting metrics exist');
    assert(engine.uxMetrics.groundEffects !== undefined, 'Ground effects metrics exist');
    assert(engine.uxMetrics.combat !== undefined, 'Combat metrics exist');
    assert(engine.uxMetrics.pathfinding !== undefined, 'Pathfinding metrics exist');
    assert(engine.uxMetrics.economy !== undefined, 'Economy metrics exist');
  } catch (e) {
    assert(false, 'UX metrics initialization failed: ' + e.message);
  }

  console.log('\n--- Test 5: STR Combat (Lite) simulation ---');
  try {
    var engine = new MVPAuditEngine.MVPAuditEngine({ verbose: false });
    var gameState = engine.initializeGameState();
    var persona = MVPAuditEngine.PERSONAS.MINMAXER;
    var report = {
      uxMetrics: {
        combatMetrics: {
          strCombatWins: 0,
          strCombatLosses: 0,
          damageDealtPerCombat: [],
          damageTakenPerCombat: []
        }
      }
    };

    var combatResult = engine.simulateSTRCombatLite(gameState, 5, persona, report);
    
    assert(combatResult !== null, 'Combat simulation returns result');
    assert(typeof combatResult.playerWon === 'boolean', 'Combat has win/loss outcome');
    assert(combatResult.roundsPlayed > 0, 'Combat has round count');
    assert(combatResult.damageDealt >= 0, 'Damage dealt is tracked');
    assert(combatResult.damageTaken >= 0, 'Damage taken is tracked');
    assert(Array.isArray(combatResult.cardsUsed), 'Cards used is tracked');
  } catch (e) {
    assert(false, 'STR Combat simulation failed: ' + e.message);
  }

  console.log('\n--- Test 6: Boss resolution with tracking ---');
  try {
    var engine = new MVPAuditEngine.MVPAuditEngine({ verbose: false });
    var gameState = engine.initializeGameState();
    var persona = MVPAuditEngine.PERSONAS.MINMAXER;
    var report = {
      uxMetrics: {
        combatMetrics: {
          bossEncounters: 0
        }
      }
    };

    var bossResult = await engine.resolveBossWithTracking(gameState, 10, persona, report);
    
    assert(bossResult !== null, 'Boss resolution returns result');
    assert(typeof bossResult.survived === 'boolean', 'Boss has survival outcome');
    assert(bossResult.bossHP !== undefined, 'Boss HP is calculated');
    assert(bossResult.playerDeckPower !== undefined, 'Player deck power is calculated');
    assert(report.uxMetrics.combatMetrics.bossEncounters > 0, 'Boss encounter is tracked');
  } catch (e) {
    assert(false, 'Boss resolution failed: ' + e.message);
  }

  console.log('\n--- Test 7: Single audit run ---');
  try {
    var engine = new MVPAuditEngine.MVPAuditEngine({
      verbose: false,
      maxFloor: 5,
      enableElites: false,
      trackUX: true
    });

    var persona = MVPAuditEngine.PERSONAS.MINMAXER;
    var result = await engine.executeAuditRun(persona, 1);

    assert(result !== null, 'Audit run returns result');
    assert(result.runId === 1, 'Run ID is correct');
    assert(result.persona === 'MINMAXER', 'Persona is tracked');
    assert(typeof result.survived === 'boolean', 'Survival status exists');
    assert(result.endFloor >= 0, 'End floor is recorded');
    assert(result.uxMetrics !== undefined, 'UX metrics are included');
    assert(result.uxMetrics.lightingUsage !== undefined, 'Lighting usage tracked');
    assert(result.uxMetrics.groundEffectsUsage !== undefined, 'Ground effects tracked');
    assert(result.uxMetrics.combatMetrics !== undefined, 'Combat metrics tracked');
    assert(result.uxMetrics.pathfindingMetrics !== undefined, 'Pathfinding tracked');
    assert(result.uxMetrics.economyMetrics !== undefined, 'Economy tracked');
  } catch (e) {
    assert(false, 'Single audit run failed: ' + e.message);
    console.error('Error details:', e.stack);
  }

  console.log('\n--- Test 8: Multiple audit runs ---');
  try {
    var engine = new MVPAuditEngine.MVPAuditEngine({
      verbose: false,
      maxFloor: 5,
      enableElites: false,
      trackUX: true
    });

    var report = await engine.runAudit(3);

    assert(report !== null, 'Audit report is generated');
    assert(report.summary.totalRuns === 3, 'Total runs is 3');
    assert(report.summary.survived + report.summary.died === 3,
           'Survived + died equals total runs');
    assert(report.mvpReadiness !== undefined, 'MVP readiness section exists');
    assert(report.uxAudit !== undefined, 'UX audit section exists');
    assert(typeof report.mvpReadiness.overallScore === 'string', 'Overall score is calculated');
    assert(typeof report.mvpReadiness.passed === 'boolean', 'Pass/fail is determined');

    console.log('  → Total runs: ' + report.summary.totalRuns);
    console.log('  → Survived: ' + report.summary.survived);
    console.log('  → Overall Score: ' + report.mvpReadiness.overallScore + '/100');
    console.log('  → MVP Ready: ' + (report.mvpReadiness.passed ? 'YES' : 'NO'));
  } catch (e) {
    assert(false, 'Multiple audit runs failed: ' + e.message);
    console.error('Error details:', e.stack);
  }

  console.log('\n--- Test 9: UX scoring systems ---');
  try {
    var engine = new MVPAuditEngine.MVPAuditEngine({ verbose: false });
    
    // Set up mock metrics
    engine.uxMetrics.lighting.totalOpportunities = 100;
    engine.uxMetrics.lighting.timesUsed = 45;
    engine.uxMetrics.groundEffects.damageFromEffects = 50;
    engine.uxMetrics.combat.strCombatInitiated = 50;
    engine.uxMetrics.combat.strCombatWins = 30;
    engine.uxMetrics.pathfinding.stuckSituations = 0;
    engine.uxMetrics.economy.creditsPerFloor = [100, 150, 200];
    engine.results = [{}, {}, {}]; // 3 mock results

    var lightingScore = engine.calculateLightingScore();
    var groundScore = engine.calculateGroundEffectsScore();
    var combatScore = engine.calculateCombatScore();
    var pathScore = engine.calculatePathfindingScore();
    var economyScore = engine.calculateEconomyScore();

    assert(lightingScore !== null, 'Lighting score calculated');
    assert(typeof lightingScore.score === 'number', 'Lighting has numeric score');
    assert(typeof lightingScore.passed === 'boolean', 'Lighting has pass/fail');
    
    assert(groundScore !== null, 'Ground effects score calculated');
    assert(typeof groundScore.score === 'number', 'Ground effects has numeric score');
    
    assert(combatScore !== null, 'Combat score calculated');
    assert(typeof combatScore.winRate === 'string', 'Combat win rate calculated');
    
    assert(pathScore !== null, 'Pathfinding score calculated');
    assert(pathScore.passed === true, 'Pathfinding passes with 0 stuck');
    
    assert(economyScore !== null, 'Economy score calculated');
    assert(typeof economyScore.avgCreditsPerFloor === 'string', 'Avg credits calculated');

    console.log('  → Lighting Score: ' + lightingScore.score + '/100');
    console.log('  → Ground Effects Score: ' + groundScore.score + '/100');
    console.log('  → Combat Score: ' + combatScore.score + '/100');
    console.log('  → Pathfinding Score: ' + pathScore.score + '/100');
    console.log('  → Economy Score: ' + economyScore.score + '/100');
  } catch (e) {
    assert(false, 'UX scoring failed: ' + e.message);
  }

  console.log('\n--- Test 10: CSV export with UX metrics ---');
  try {
    var engine = new MVPAuditEngine.MVPAuditEngine({ verbose: false, maxFloor: 3 });
    await engine.runAudit(2);

    var csv = engine.exportToCSV();
    assert(typeof csv === 'string', 'CSV export returns string');
    assert(csv.indexOf('Run ID') !== -1, 'CSV has header row');
    assert(csv.indexOf('Lighting Util') !== -1, 'CSV includes UX metrics');
    assert(csv.indexOf('STR Combat Wins') !== -1, 'CSV includes combat metrics');
    assert(csv.split('\n').length >= 3, 'CSV has header + data rows');

    console.log('  → CSV length: ' + csv.length + ' characters');
  } catch (e) {
    assert(false, 'CSV export failed: ' + e.message);
  }

  console.log('\n--- Test 11: JSON export with full report ---');
  try {
    var engine = new MVPAuditEngine.MVPAuditEngine({ verbose: false, maxFloor: 3 });
    await engine.runAudit(2);

    var json = engine.exportToJSON();
    assert(typeof json === 'string', 'JSON export returns string');

    var parsed = JSON.parse(json);
    assert(parsed.metadata !== undefined, 'JSON has metadata');
    assert(parsed.summary !== undefined, 'JSON has summary');
    assert(parsed.mvpReadiness !== undefined, 'JSON has MVP readiness section');
    assert(parsed.uxAudit !== undefined, 'JSON has UX audit section');
    assert(parsed.uxAudit.lighting !== undefined, 'JSON has lighting audit');
    assert(parsed.uxAudit.groundEffects !== undefined, 'JSON has ground effects audit');
    assert(parsed.uxAudit.combat !== undefined, 'JSON has combat audit');
    assert(parsed.uxAudit.pathfinding !== undefined, 'JSON has pathfinding audit');
    assert(parsed.uxAudit.economy !== undefined, 'JSON has economy audit');

    console.log('  → JSON parsed successfully');
    console.log('  → Overall Score: ' + parsed.mvpReadiness.overallScore);
  } catch (e) {
    assert(false, 'JSON export failed: ' + e.message);
  }

  console.log('\n--- Test 12: MVP readiness assessment ---');
  try {
    var engine = new MVPAuditEngine.MVPAuditEngine({ verbose: false });
    
    // Create mock report
    var mockReport = {
      summary: { totalRuns: 10, survived: 5, died: 5 },
      personas: {
        MINMAXER: { runs: 5, survived: 3, survivalRate: '60.0' }
      },
      uxAudit: {
        lighting: { score: 85, passed: true, utilizationRate: '45' },
        groundEffects: { score: 80, passed: true, damageDealt: 50 },
        combat: { score: 90, passed: true, winRate: '60' },
        pathfinding: { score: 100, passed: true, stuckCount: 0 },
        economy: { score: 85, passed: true, avgCreditsPerFloor: '150' }
      }
    };

    var readiness = engine.assessMVPReadiness(mockReport);
    
    assert(readiness !== null, 'MVP readiness is assessed');
    assert(typeof readiness.overallScore === 'string', 'Overall score calculated');
    assert(typeof readiness.passed === 'boolean', 'Pass/fail determined');
    assert(Array.isArray(readiness.criticalIssues), 'Critical issues list exists');
    assert(Array.isArray(readiness.warnings), 'Warnings list exists');
    assert(Array.isArray(readiness.recommendations), 'Recommendations list exists');
    assert(parseInt(readiness.overallScore) > 70, 'Good scores should pass >70%');
    assert(readiness.passed === true, 'Mock report should pass MVP');

    console.log('  → Overall Score: ' + readiness.overallScore + '/100');
    console.log('  → MVP Ready: ' + (readiness.passed ? 'YES' : 'NO'));
    console.log('  → Critical Issues: ' + readiness.criticalIssues.length);
    console.log('  → Warnings: ' + readiness.warnings.length);
  } catch (e) {
    assert(false, 'MVP readiness assessment failed: ' + e.message);
  }

  // Print summary
  console.log('\n========================================');
  console.log('VALIDATION SUMMARY');
  console.log('========================================');
  console.log('Total Tests:  ' + tests.total);
  console.log('Passed:       ' + tests.passed + ' (' + (tests.passed / tests.total * 100).toFixed(1) + '%)');
  console.log('Failed:       ' + tests.failed);
  console.log('========================================');

  if (tests.failed === 0) {
    console.log('\n✓ ALL VALIDATION TESTS PASSED');
    console.log('\nMVP Audit Engine is ready for production use!');
    console.log('\nTo run MVP audits:');
    console.log('1. Open /public/tests/test-agent-mvp-audit.html in a browser');
    console.log('2. Configure parameters (100+ runs recommended)');
    console.log('3. Click "Run MVP Audit"');
    console.log('4. Review comprehensive MVP readiness report');
    console.log('5. Export results as CSV or JSON for analysis');
  } else {
    console.log('\n✗ SOME VALIDATION TESTS FAILED');
    console.log('\nPlease review the failed tests above.');
    if (typeof process !== 'undefined') {
      process.exit(1);
    }
  }
}

// Run validation
runValidation().catch(function(err) {
  console.error('\n✗ CRITICAL ERROR during validation:');
  console.error(err.stack);
  if (typeof process !== 'undefined') {
    process.exit(1);
  }
});
