/* ============================================================
   EYES ONLY - Boss Encounter System Tests
   Validates boss mechanics, loot, and mythic conditions
   ============================================================ */

// Load required modules
if (typeof require !== 'undefined') {
  var BossEncounters = require('../js/boss-encounters.js');
}

var BossTests = (function() {
  'use strict';

  var testResults = [];

  function runTests() {
    console.log('=== BOSS ENCOUNTER SYSTEM TESTS ===\n');
    testResults = [];

    // Test 1: Boss class instantiation
    testBossInstantiation();

    // Test 2: Boss types available
    testBossTypes();

    // Test 3: Mythic condition tracking
    testMythicTracking();

    // Test 4: Boss loot generation
    testBossLoot();

    // Test 5: Boss exploit mechanics
    testBossExploits();

    // Test 6: Boss defeat conditions
    testBossDefeat();

    // Print results
    printResults();
  }

  function testBossInstantiation() {
    var testName = 'Boss Instantiation';
    try {
      var boss = BossEncounters.createBossForFloor(10);

      assert(boss !== null, 'Boss should be created');
      assert(boss.type !== undefined, 'Boss should have a type');
      assert(boss.hp > 0, 'Boss should have HP');
      assert(boss.maxHp > 0, 'Boss should have max HP');
      assert(boss.phase === 'IDLE', 'Boss should start in IDLE phase');
      assert(boss.mythicConditionMet === false, 'Mythic condition should start false');

      pass(testName);
    } catch (e) {
      fail(testName, e.message);
    }
  }

  function testBossTypes() {
    var testName = 'Boss Types Available';
    try {
      var types = BossEncounters.getBossTypes();

      assert(types.length === 5, 'Should have 5 boss types, got ' + types.length);
      assert(types.indexOf('DEPOT_CROSSING') !== -1, 'Should have DEPOT_CROSSING');
      assert(types.indexOf('SENTRY_NEST') !== -1, 'Should have SENTRY_NEST');
      assert(types.indexOf('BUNKER_COMMANDANT') !== -1, 'Should have BUNKER_COMMANDANT');
      assert(types.indexOf('MAINFRAME_CORE') !== -1, 'Should have MAINFRAME_CORE');
      assert(types.indexOf('ORBITAL_CARRIER') !== -1, 'Should have ORBITAL_CARRIER');

      pass(testName);
    } catch (e) {
      fail(testName, e.message);
    }
  }

  function testMythicTracking() {
    var testName = 'Mythic Condition Tracking';
    try {
      var boss = new BossEncounters.DepotCrossingBoss(10);

      // Initially false
      assert(boss.mythicConditionMet === false, 'Mythic starts false');

      // Track wrong event - should stay false
      var result1 = boss.trackMythicCondition('WRONG_EVENT');
      assert(result1.mythic === false, 'Wrong event should not trigger mythic');
      assert(boss.mythicConditionMet === false, 'Mythic should stay false');

      // Track correct event - should become true
      var result2 = boss.trackMythicCondition('TRAIN_IMPACT_KILL');
      assert(result2.mythic === true, 'Correct event should trigger mythic');
      assert(boss.mythicConditionMet === true, 'Mythic should be true');
      assert(result2.message.indexOf('strange energy') !== -1, 'Should show mythic message');

      pass(testName);
    } catch (e) {
      fail(testName, e.message);
    }
  }

  function testBossLoot() {
    var testName = 'Boss Loot Generation';
    try {
      var boss = new BossEncounters.DepotCrossingBoss(10);

      // Test without mythic condition
      var loot1 = boss.generateLoot();
      assert(loot1.length > 0, 'Boss should drop loot');

      var hasGuaranteedCard = loot1.some(function(item) {
        return item.type === 'card' && item.guaranteed;
      });
      assert(hasGuaranteedCard, 'Boss should guarantee card drop');

      // Test with mythic condition
      boss.mythicConditionMet = true;
      var loot2 = boss.generateLoot();

      var hasMythicDrop = loot2.some(function(item) {
        return item.type === 'mythic' && item.guaranteed;
      });
      assert(hasMythicDrop, 'Boss should drop mythic when condition met');

      pass(testName);
    } catch (e) {
      fail(testName, e.message);
    }
  }

  function testBossExploits() {
    var testName = 'Boss Exploit Mechanics';
    try {
      // Test Depot Boss exploit (will fail without collision, but should return result)
      var depotBoss = new BossEncounters.DepotCrossingBoss(10);
      depotBoss.bossPosition = { x: 10, y: 10 };

      var playerAction = {
        type: 'LURE',
        target: 'TRAIN_PATH'
      };

      var gameState = {};
      var result = depotBoss.checkExploit(playerAction, gameState);
      assert(result.exploited !== undefined, 'Exploit check should return result');

      // Test Sentry Boss exploit with proper initialization
      var sentryBoss = new BossEncounters.SentryNestBoss(22);
      var grid = [];
      var player = { x: 5, y: 5, combatEntries: 0 };
      sentryBoss.initialize(grid, player);

      // Target exact pod location (distance 0)
      var podX = sentryBoss.spawnPods[0].x;
      var podY = sentryBoss.spawnPods[0].y;
      var initialHp = sentryBoss.spawnPods[0].hp;

      var grenadeAction = {
        type: 'GRENADE',
        targetX: podX,
        targetY: podY
      };

      var result2 = sentryBoss.checkExploit(grenadeAction, gameState);

      // The exploit should work (distance = 0, which is <= 2)
      assert(result2 !== undefined, 'Should return exploit result');
      // HP should be reduced
      assert(sentryBoss.spawnPods[0].hp < initialHp, 'Pod should take damage');

      pass(testName);
    } catch (e) {
      fail(testName, e.message);
    }
  }

  function testBossDefeat() {
    var testName = 'Boss Defeat and Loot';
    try {
      var boss = new BossEncounters.BunkerCommandantBoss(15);
      boss.hp = 70;

      // Deal damage
      var damageResult = boss.takeDamage(30, 'player');
      assert(damageResult.defeated === false, 'Boss should survive 30 damage');
      assert(boss.hp === 40, 'Boss HP should be 40');

      // Deal killing blow without mythic
      var defeatResult = boss.takeDamage(40, { lastCardType: 'SINGLE_SHOT' });
      assert(defeatResult.defeated === true, 'Boss should be defeated');
      assert(boss.hp === 0, 'Boss HP should be 0');
      assert(defeatResult.loot.length > 0, 'Boss should drop loot');
      assert(defeatResult.mythic === false, 'Mythic should not be met');

      // Test with mythic condition
      var boss2 = new BossEncounters.BunkerCommandantBoss(15);
      boss2.hp = 10;
      boss2.bunkers.forEach(function(b) { b.destroyed = true; }); // Destroy all bunkers

      var mythicDefeat = boss2.takeDamage(10, { lastCardType: 'MELEE' });
      assert(mythicDefeat.mythic === true, 'Mythic should be met with correct conditions');

      pass(testName);
    } catch (e) {
      fail(testName, e.message);
    }
  }

  // Helper functions
  function assert(condition, message) {
    if (!condition) {
      throw new Error('Assertion failed: ' + message);
    }
  }

  function pass(testName) {
    testResults.push({ name: testName, passed: true });
    console.log('✓ PASS: ' + testName);
  }

  function fail(testName, error) {
    testResults.push({ name: testName, passed: false, error: error });
    console.log('✗ FAIL: ' + testName);
    console.log('  Error: ' + error);
  }

  function printResults() {
    console.log('\n=== TEST SUMMARY ===');
    var passed = testResults.filter(function(r) { return r.passed; }).length;
    var total = testResults.length;
    console.log('Passed: ' + passed + '/' + total);

    if (passed === total) {
      console.log('✓ ALL TESTS PASSED');
    } else {
      console.log('✗ SOME TESTS FAILED');
    }
  }

  return {
    runTests: runTests
  };
})();

// Auto-run tests if in Node environment
if (typeof module !== 'undefined' && module.exports) {
  BossTests.runTests();
}
