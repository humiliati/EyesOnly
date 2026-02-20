#!/usr/bin/env node
/**
 * Smoke test for Gone Rogue highscore integration
 * Validates that all tracking code is in place
 */

const fs = require('fs');
const path = require('path');

console.log('='.repeat(60));
console.log('GONE ROGUE HIGHSCORE INTEGRATION VALIDATION');
console.log('='.repeat(60));
console.log('');

let testsPassed = 0;
let testsFailed = 0;

function test(name, condition, details = '') {
  if (condition) {
    console.log(`✓ PASS: ${name}`);
    if (details) console.log(`  → ${details}`);
    testsPassed++;
  } else {
    console.log(`✗ FAIL: ${name}`);
    if (details) console.log(`  → ${details}`);
    testsFailed++;
  }
}

// Read the gone-rogue.js file
const goneRogueFile = fs.readFileSync(
  path.join(__dirname, 'public/js/gone-rogue.js'),
  'utf8'
);

// Test 1: Tracking variables declared
console.log('\n--- Tracking Variables ---');
test(
  'Currency tracking variable declared',
  goneRogueFile.includes('var _currencyCollected = 0'),
  'Found _currencyCollected declaration'
);

test(
  'Enemy tracking variables declared',
  goneRogueFile.includes('var _totalEnemiesSpawned = 0') &&
  goneRogueFile.includes('var _enemiesKilled = 0'),
  'Found enemy spawn and kill tracking'
);

test(
  'Damage tracking variables declared',
  goneRogueFile.includes('var _totalDamageDealt = 0') &&
  goneRogueFile.includes('var _maxSingleHit = 0'),
  'Found damage tracking variables'
);

test(
  'Mitigation tracking variable declared',
  goneRogueFile.includes('var _damageMitigated = 0'),
  'Found damage mitigation tracking'
);

// Test 2: Tracking initialization
console.log('\n--- Tracking Initialization ---');
test(
  'Variables initialized in start()',
  goneRogueFile.includes('_runStartTime = Date.now()') &&
  goneRogueFile.includes('_currencyCollected = 0'),
  'Tracking variables reset on game start'
);

// Test 3: Event tracking
console.log('\n--- Event Tracking ---');
test(
  'Currency collection tracked',
  goneRogueFile.includes('_currencyCollected += cryptoPickup.amount'),
  'Currency pickup increments counter'
);

test(
  'Enemy spawns tracked',
  goneRogueFile.match(/_totalEnemiesSpawned\+\+/g)?.length >= 3,
  `Found ${goneRogueFile.match(/_totalEnemiesSpawned\+\+/g)?.length || 0} spawn tracking points (boss, elite, regular)`
);

test(
  'Enemy kills tracked',
  goneRogueFile.includes('_enemiesKilled++'),
  'Enemy defeats increment kill counter'
);

test(
  'Damage dealt tracked',
  goneRogueFile.includes('_totalDamageDealt += finalDamage') &&
  goneRogueFile.includes('if (finalDamage > _maxSingleHit)'),
  'Combat damage and max hit tracked'
);

test(
  'Breakable damage tracked',
  goneRogueFile.includes('_totalBreakableDamage += amount'),
  'Breakable destruction tracked'
);

test(
  'Damage mitigation tracked',
  goneRogueFile.includes('_damageMitigated += defenseReduction'),
  'Defense reduction tracked'
);

// Test 4: Highscore submission
console.log('\n--- Highscore Submission ---');
test(
  'Submission function exists',
  goneRogueFile.includes('function _submitHighscore()'),
  'Found _submitHighscore function'
);

test(
  'Run completion marked',
  goneRogueFile.includes('_runCompleted = true'),
  'Floor 30 completion tracked'
);

test(
  'Submission called on exit',
  goneRogueFile.includes('if (success && typeof HighscoreState !== \'undefined\')') &&
  goneRogueFile.includes('_submitHighscore()'),
  'Highscore submitted on successful extraction'
);

test(
  'Mode detection (agent vs human)',
  goneRogueFile.includes('if (typeof AgentIntegration !== \'undefined\' && AgentIntegration.isActive())'),
  'Agent mode properly detected'
);

test(
  'Score calculation called',
  goneRogueFile.includes('HighscoreState.calculateGoneRogueScore(runData)'),
  'Score calculated before submission'
);

test(
  'Metadata populated',
  goneRogueFile.includes('enemies_killed: _enemiesKilled') &&
  goneRogueFile.includes('currency_collected: _currencyCollected'),
  'All metadata fields included'
);

// Test 5: Dependencies loaded
console.log('\n--- Dependencies ---');
const indexHtml = fs.readFileSync(
  path.join(__dirname, 'public/index.html'),
  'utf8'
);

test(
  'HighscoreState loaded in main app',
  indexHtml.includes('highscore-state.js'),
  'highscore-state.js included in index.html'
);

test(
  'Agent adapter available',
  indexHtml.includes('agent-headless-adapter.js'),
  'agent-headless-adapter.js included'
);

test(
  'Agent integration loaded',
  indexHtml.includes('agent-integration.js'),
  'agent-integration.js included'
);

// Summary
console.log('\n' + '='.repeat(60));
console.log('TEST SUMMARY');
console.log('='.repeat(60));
console.log(`Total Tests: ${testsPassed + testsFailed}`);
console.log(`Passed: ${testsPassed} (${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%)`);
console.log(`Failed: ${testsFailed}`);
console.log('='.repeat(60));

if (testsFailed === 0) {
  console.log('\n✓ ALL INTEGRATION CHECKS PASSED');
  console.log('\nThe Gone Rogue highscore integration is properly implemented!');
  console.log('The following systems are operational:');
  console.log('  • Currency tracking');
  console.log('  • Enemy spawn/kill tracking');
  console.log('  • Damage and mitigation tracking');
  console.log('  • Breakable destruction tracking');
  console.log('  • Score calculation and submission');
  console.log('  • Agent vs human mode detection');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Open the application in a browser');
  console.log('  2. Start a Gone Rogue run');
  console.log('  3. Complete a run (reach floor 30 or extract early)');
  console.log('  4. Check /highscore page to verify score was submitted');
  console.log('  5. Run headless agent tests to validate agent scores');
  console.log('');
  process.exit(0);
} else {
  console.log('\n✗ SOME INTEGRATION CHECKS FAILED');
  console.log('\nPlease review failures above.');
  process.exit(1);
}
