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

    // Test 7: Asteroids boss — move lock + updateRealTime + Fragment Shower exploit
    testAsteroidsBoss();

    // Test 8: Tower Offense boss — suppression exploit + volley scaling
    testTowerOffenseBoss();

    // Test 9: Sniper boss — Camera exploit + max penalty mythic
    testSniperBoss();

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

      assert(types.length === 10, 'Should have 10 boss types, got ' + types.length);
      assert(types.indexOf('DEPOT_CROSSING') !== -1, 'Should have DEPOT_CROSSING');
      assert(types.indexOf('SENTRY_NEST') !== -1, 'Should have SENTRY_NEST');
      assert(types.indexOf('BUNKER_COMMANDANT') !== -1, 'Should have BUNKER_COMMANDANT');
      assert(types.indexOf('MAINFRAME_CORE') !== -1, 'Should have MAINFRAME_CORE');
      assert(types.indexOf('ORBITAL_CARRIER') !== -1, 'Should have ORBITAL_CARRIER');
      assert(types.indexOf('TREASURE_GOBLIN_KING') !== -1, 'Should have TREASURE_GOBLIN_KING');
      assert(types.indexOf('UBER_MEGA') !== -1, 'Should have UBER_MEGA');
      assert(types.indexOf('ASTEROIDS') !== -1, 'Should have ASTEROIDS');
      assert(types.indexOf('TOWER_OFFENSE') !== -1, 'Should have TOWER_OFFENSE');
      assert(types.indexOf('SNIPER') !== -1, 'Should have SNIPER');

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

  function testAsteroidsBoss() {
    var testName = 'Asteroids Boss — move lock, wave spawn, Fragment Shower';
    try {
      var boss = new BossEncounters.AsteroidsBoss(10);
      var grid = [], player = { x: 20, y: 10 };

      var init = boss.initialize(grid, player);
      assert(init.success === true, 'Asteroids init should succeed');
      assert(init.playerMoveLocked === true, 'Init should report move lock');
      assert(boss.playerMoveLocked === true, 'Boss should lock movement');
      assert(boss.waveAsteroids.length > 0, 'Should spawn initial wave');

      // updateRealTime returns projectiles to inject after waveInterval turns
      var rt = boss.updateRealTime(100, {});
      assert(rt.bossProjectiles !== undefined, 'updateRealTime should return bossProjectiles');

      // Fragment Shower clears asteroids near target
      boss.waveAsteroids = [
        { id: 0, x: 20, y: 10, dx: 1, dy: 1, range: 20, power: 2, glyph: '🌑', owner: 'boss', source: 'asteroid' },
        { id: 1, x: 30, y: 15, dx: -1, dy: 1, range: 20, power: 2, glyph: '🌑', owner: 'boss', source: 'asteroid' }
      ];
      var exploit = boss.checkExploit({ type: 'FRAGMENT_SHOWER', targetX: 20, targetY: 10 }, {});
      assert(exploit.exploited === true, 'Fragment Shower should exploit near asteroids');
      assert(exploit.cleared >= 1, 'Should clear at least one asteroid');
      assert(boss.waveAsteroids.length < 2, 'Close asteroid should be removed');

      // Defeat unlocks movement
      var defeat = boss.onDefeat({});
      assert(defeat.playerMoveLocked === false, 'Defeat should unlock movement');

      pass(testName);
    } catch (e) {
      fail(testName, e.message);
    }
  }

  function testTowerOffenseBoss() {
    var testName = 'Tower Offense Boss — suppression + volley scaling';
    try {
      var boss = new BossEncounters.TowerOffenseBoss(16);
      var grid = [], player = { x: 20, y: 18 };

      var init = boss.initialize(grid, player);
      assert(init.success === true, 'Tower init should succeed');

      // Volley size increases as HP drops
      boss.hp = boss.maxHp;
      assert(boss._getVolleySize() === 2, 'Phase 1: volley should be 2');
      boss.hp = Math.floor(boss.maxHp * 0.5);
      assert(boss._getVolleySize() === 4, 'Phase 2: volley should be 4');
      boss.hp = Math.floor(boss.maxHp * 0.2);
      assert(boss._getVolleySize() === 6, 'Phase 3: volley should be 6');

      // Suppression Fire exploit
      boss.hp = boss.maxHp; // reset
      var exploit = boss.checkExploit({ type: 'SUPPRESSION_FIRE' }, {});
      assert(exploit.exploited === true, 'Suppression Fire should exploit');
      assert(boss.suppressedTurns === 2, 'Should suppress 2 turns');

      // Suppressed turn: update returns suppressed message
      var upd = boss.update({});
      assert(upd.message !== undefined, 'Should return suppression message');
      assert(boss.suppressedTurns === 1, 'Suppress count should tick down');

      // Mythic: kill before phase 3
      var boss2 = new BossEncounters.TowerOffenseBoss(16);
      boss2.hp = 5;
      boss2.phase3Reached = false;
      var defeat = boss2.onDefeat({});
      assert(defeat.mythic === true, 'Killing before phase 3 should trigger mythic');

      pass(testName);
    } catch (e) {
      fail(testName, e.message);
    }
  }

  function testSniperBoss() {
    var testName = 'Sniper Boss — Camera penalty + max penalty mythic';
    try {
      var boss = new BossEncounters.SniperBoss(22);
      var grid = [], player = { x: 5, y: 18 };

      var init = boss.initialize(grid, player);
      assert(init.success === true, 'Sniper init should succeed');
      assert(init.concealedBoss === true, 'Boss should start concealed');

      // Initial evasion
      assert(boss.getCurrentEvasion() === 80, 'Starts at 80% evasion');

      // Camera reduces evasion by 5 per use
      var r1 = boss.checkExploit({ type: 'CAMERA' }, {});
      assert(r1.exploited === true, 'Camera should exploit');
      assert(r1.photos === 1, 'Should track 1 photograph');
      assert(boss.getCurrentEvasion() === 75, 'Evasion should drop to 75%');

      // Use camera 9 more times (10 total = max)
      for (var i = 0; i < 9; i++) {
        boss.checkExploit({ type: 'CAMERA' }, {});
      }
      assert(boss.photographs === 10, 'Should have 10 photographs');
      assert(boss.getCurrentEvasion() === 30, 'Evasion should be 30% at max penalty');

      // One more camera at max should still return exploited but clamp
      var rMax = boss.checkExploit({ type: 'CAMERA' }, {});
      assert(rMax.atMaxPenalty === true, 'Should flag max penalty');
      assert(boss.photographs === 10, 'Photos should not exceed max');

      // Mythic: defeat with max penalty
      boss.hp = 1;
      var defeat = boss.takeDamage(1, {});
      assert(defeat.defeated === true, 'Boss should be defeated');
      assert(defeat.mythic === true, 'Max penalty kill should trigger mythic');

      // Camera has no effect on wrong boss type
      var depot = new BossEncounters.DepotCrossingBoss(10);
      var noEffect = depot.checkExploit({ type: 'CAMERA' }, {});
      assert(noEffect.exploited === false, 'Camera should not affect Depot boss');

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
