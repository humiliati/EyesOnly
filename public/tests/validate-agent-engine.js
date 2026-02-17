/* ============================================================
   EYES ONLY - Agent Engine Validation Script
   Runs basic validation tests on the agent engine logic
   ============================================================ */

// Load agent-engine.js code
var AgentEngine = require('./agent-engine.js');

console.log('========================================');
console.log('AGENT ENGINE VALIDATION');
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
  console.log('--- Test 1: AgentEngine instantiation ---');
  try {
    var engine = new AgentEngine.AgentEngine({
      verbose: false,
      maxFloor: 10,
      enableElites: true
    });
    assert(engine !== null, 'AgentEngine can be instantiated');
    assert(engine.maxFloor === 10, 'Config maxFloor is set correctly');
    assert(engine.results.length === 0, 'Results array starts empty');
  } catch (e) {
    assert(false, 'AgentEngine instantiation failed: ' + e.message);
  }

  console.log('\n--- Test 2: Persona definitions ---');
  try {
    var personas = AgentEngine.PERSONAS;
    assert(personas !== undefined, 'PERSONAS object exists');
    assert(personas.GREEDY_LOOTER !== undefined, 'GREEDY_LOOTER persona exists');
    assert(personas.SPEEDRUNNER !== undefined, 'SPEEDRUNNER persona exists');
    assert(personas.RISKY_GAMBLER !== undefined, 'RISKY_GAMBLER persona exists');
    assert(personas.SAVER_HOARDER !== undefined, 'SAVER_HOARDER persona exists');
    assert(personas.MINMAXER !== undefined, 'MINMAXER persona exists');
    assert(personas.DUMB_RANDOM !== undefined, 'DUMB_RANDOM persona exists');

    assert(personas.GREEDY_LOOTER.vendorStrategy === 'BUY_UPGRADES',
           'GREEDY_LOOTER has correct vendor strategy');
    assert(personas.SPEEDRUNNER.vendorStrategy === 'SKIP',
           'SPEEDRUNNER has correct vendor strategy');
  } catch (e) {
    assert(false, 'Persona definition test failed: ' + e.message);
  }

  console.log('\n--- Test 3: Game state initialization ---');
  try {
    var engine = new AgentEngine.AgentEngine({ verbose: false });
    var gameState = engine.initializeGameState();

    assert(gameState.hp === 100, 'Initial HP is 100');
    assert(gameState.maxHp === 100, 'Max HP is 100');
    assert(gameState.credits === 0, 'Starting credits is 0 (no currency yet)');
    assert(Array.isArray(gameState.deck), 'Deck is an array');
    assert(gameState.deck.length === 5, 'Starting deck has 5 cards');
    assert(gameState.isAlive === true, 'Player starts alive');
  } catch (e) {
    assert(false, 'Game state initialization failed: ' + e.message);
  }

  console.log('\n--- Test 4: Deck power calculation ---');
  try {
    var engine = new AgentEngine.AgentEngine({ verbose: false });
    var testDeck = [
      { quality: 'MYTHIC', power: 10 },
      { quality: 'ELITE', power: 8 },
      { quality: 'RARE', power: 5 },
      { quality: 'COMMON', power: 2 }
    ];

    var power = engine.calculateDeckPower(testDeck);
    // Expected: (20 + 10) + (12 + 8) + (8 + 5) + (2 + 2) = 67
    assert(power === 67, 'Deck power calculation is correct (got ' + power + ', expected 67)');

    var emptyDeck = [];
    var emptyPower = engine.calculateDeckPower(emptyDeck);
    assert(emptyPower === 0, 'Empty deck has 0 power');
  } catch (e) {
    assert(false, 'Deck power calculation failed: ' + e.message);
  }

  console.log('\n--- Test 5: Card generation ---');
  try {
    var engine = new AgentEngine.AgentEngine({ verbose: false });
    var mythicCard = engine.generateCard('MYTHIC', 20);

    assert(mythicCard.quality === 'MYTHIC', 'Generated card has correct quality');
    assert(mythicCard.power >= 40 && mythicCard.power <= 50,
           'MYTHIC card power is in expected range for floor 20 (40-50)');

    var commonCard = engine.generateCard('COMMON', 5);
    assert(commonCard.quality === 'COMMON', 'Common card has correct quality');
    assert(commonCard.power >= 2 && commonCard.power <= 4,
           'COMMON card power is in expected range for floor 5 (2-4)');
  } catch (e) {
    assert(false, 'Card generation failed: ' + e.message);
  }

  console.log('\n--- Test 6: Single simulation run ---');
  try {
    var engine = new AgentEngine.AgentEngine({
      verbose: false,
      maxFloor: 5,
      enableElites: false
    });

    var persona = AgentEngine.PERSONAS.MINMAXER;
    var result = await engine.executeSingleRun(persona, 1);

    assert(result !== null, 'Single run returns result');
    assert(result.runId === 1, 'Run ID is correct');
    assert(result.persona === 'MINMAXER', 'Persona is recorded');
    assert(result.endFloor >= 1, 'Ended on at least floor 1');
    assert(typeof result.survived === 'boolean', 'Survived status is boolean');
    assert(result.finalCredits >= 0, 'Final credits is non-negative');

    console.log('  → Agent reached floor ' + result.endFloor);
    console.log('  → Survived: ' + result.survived);
    console.log('  → Final credits: ' + result.finalCredits);
  } catch (e) {
    assert(false, 'Single simulation run failed: ' + e.message);
    console.error('Error details:', e.stack);
  }

  console.log('\n--- Test 7: Multiple simulations ---');
  try {
    var engine = new AgentEngine.AgentEngine({
      verbose: false,
      maxFloor: 5,
      enableElites: false
    });

    var report = await engine.runSimulations(3, 'MINMAXER');

    assert(report !== null, 'Report is generated');
    assert(report.summary.totalRuns === 3, 'Total runs is 3');
    assert(report.summary.survived + report.summary.died === 3,
           'Survived + died equals total runs');
    assert(report.personas.MINMAXER !== undefined, 'MINMAXER persona stats exist');
    assert(report.personas.MINMAXER.runs === 3, 'MINMAXER ran 3 times');

    console.log('  → Total runs: ' + report.summary.totalRuns);
    console.log('  → Survived: ' + report.summary.survived);
    console.log('  → Died: ' + report.summary.died);
    console.log('  → Survival rate: ' + (report.summary.survived / report.summary.totalRuns * 100).toFixed(1) + '%');
  } catch (e) {
    assert(false, 'Multiple simulations failed: ' + e.message);
    console.error('Error details:', e.stack);
  }

  console.log('\n--- Test 8: Report generation ---');
  try {
    var engine = new AgentEngine.AgentEngine({
      verbose: false,
      maxFloor: 5,
      enableElites: false
    });

    await engine.runSimulations(2, null); // Run with round-robin personas

    var report = engine.generateReport();
    assert(report !== null, 'Report generation succeeds');
    assert(report.summary !== undefined, 'Report has summary section');
    assert(report.personas !== undefined, 'Report has personas section');
    assert(report.avgFinalCredits !== undefined, 'Report has avg credits');
    assert(report.mythicRate !== undefined, 'Report has mythic rate');
  } catch (e) {
    assert(false, 'Report generation failed: ' + e.message);
    console.error('Error details:', e.stack);
  }

  console.log('\n--- Test 9: CSV export ---');
  try {
    var engine = new AgentEngine.AgentEngine({ verbose: false, maxFloor: 3 });
    await engine.runSimulations(2, 'DUMB_RANDOM');

    var csv = engine.exportToCSV();
    assert(typeof csv === 'string', 'CSV export returns string');
    assert(csv.indexOf('Run ID') !== -1, 'CSV has header row');
    assert(csv.indexOf('DUMB_RANDOM') !== -1, 'CSV contains persona name');
    assert(csv.split('\n').length >= 3, 'CSV has header + data rows');

    console.log('  → CSV length: ' + csv.length + ' characters');
  } catch (e) {
    assert(false, 'CSV export failed: ' + e.message);
  }

  console.log('\n--- Test 10: JSON export ---');
  try {
    var engine = new AgentEngine.AgentEngine({ verbose: false, maxFloor: 3 });
    await engine.runSimulations(2, 'SPEEDRUNNER');

    var json = engine.exportToJSON();
    assert(typeof json === 'string', 'JSON export returns string');

    var parsed = JSON.parse(json);
    assert(parsed.metadata !== undefined, 'JSON has metadata');
    assert(parsed.results !== undefined, 'JSON has results array');
    assert(Array.isArray(parsed.results), 'Results is an array');
    assert(parsed.results.length === 2, 'Results contains 2 runs');

    console.log('  → JSON parsed successfully');
    console.log('  → Contains ' + parsed.results.length + ' results');
  } catch (e) {
    assert(false, 'JSON export failed: ' + e.message);
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
    console.log('\nAgent Engine is ready for production use!');
    console.log('\nTo run simulations:');
    console.log('1. Open /public/tests/test-agent-engine.html in a browser');
    console.log('2. Configure parameters (# of runs, persona, max floor)');
    console.log('3. Click "Run Simulation"');
    console.log('4. Export results as CSV or JSON for analysis');
  } else {
    console.log('\n✗ SOME VALIDATION TESTS FAILED');
    console.log('\nPlease review the failed tests above.');
    process.exit(1);
  }
}

// Run validation
runValidation().catch(function(err) {
  console.error('\n✗ CRITICAL ERROR during validation:');
  console.error(err.stack);
  process.exit(1);
});
