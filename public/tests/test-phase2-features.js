/* ============================================================
   EYES ONLY - Test Harness for Phase 2 Features
   Validates game loop, enemy pathing, awareness, and sight cones
   ============================================================ */

(function () {
  'use strict';

  console.log('========================================');
  console.log('TEST: Phase 2 - Realtime Game Loop & AI');
  console.log('========================================');

  var tests = {
    total: 0,
    passed: 0,
    failed: 0
  };

  function assert(condition, message) {
    tests.total++;
    if (condition) {
      tests.passed++;
      console.log('%c✓ PASS: ' + message, 'color: green; font-weight: bold');
      return true;
    } else {
      tests.failed++;
      console.error('%c✗ FAIL: ' + message, 'color: red; font-weight: bold');
      return false;
    }
  }

  function runTests() {
    console.log('\n--- Test 1: GoneRogue Module Exists ---');
    
    assert(
      typeof GoneRogue !== 'undefined',
      'GoneRogue module is available'
    );

    console.log('\n--- Test 2: Game Loop API ---');
    
    // Initialize if needed
    if (typeof GoneRogue.init === 'function') {
      GoneRogue.init();
    }

    // Start game
    var startResult = GoneRogue.start({});
    
    assert(
      startResult && typeof startResult === 'object',
      'GoneRogue.start() returns an object'
    );
    
    assert(
      GoneRogue.isActive(),
      'GoneRogue is active after start'
    );

    console.log('\n--- Test 3: Enemy State ---');
    
    var enemies = GoneRogue.getEnemies();
    
    assert(
      Array.isArray(enemies),
      'getEnemies() returns an array'
    );
    
    assert(
      enemies.length >= 3,
      'At least 3 enemies spawned'
    );

    // Check enemy properties
    if (enemies.length > 0) {
      var enemy = enemies[0];
      
      assert(
        typeof enemy.x === 'number' && typeof enemy.y === 'number',
        'Enemy has x,y coordinates'
      );
      
      assert(
        typeof enemy.awareness === 'number',
        'Enemy has awareness value'
      );
      
      assert(
        enemy.path && typeof enemy.path.type === 'string',
        'Enemy has path configuration'
      );
      
      assert(
        typeof enemy.orientation === 'string',
        'Enemy has orientation'
      );
      
      assert(
        typeof enemy.sightRange === 'number',
        'Enemy has sight range'
      );
    }

    console.log('\n--- Test 4: Awareness System ---');
    
    assert(
      typeof GoneRogue.getEnemyAwarenessState === 'function',
      'getEnemyAwarenessState() function exists'
    );

    if (enemies.length > 0) {
      var testEnemy = { awareness: 0 };
      var state = GoneRogue.getEnemyAwarenessState(testEnemy);
      
      assert(
        state && state.name === 'UNAWARE',
        'Enemy with 0 awareness is UNAWARE'
      );

      testEnemy.awareness = 50;
      state = GoneRogue.getEnemyAwarenessState(testEnemy);
      
      assert(
        state && state.name === 'SUSPICIOUS',
        'Enemy with 50 awareness is SUSPICIOUS'
      );

      testEnemy.awareness = 85;
      state = GoneRogue.getEnemyAwarenessState(testEnemy);
      
      assert(
        state && state.name === 'ALERTED',
        'Enemy with 85 awareness is ALERTED'
      );

      testEnemy.awareness = 120;
      state = GoneRogue.getEnemyAwarenessState(testEnemy);
      
      assert(
        state && state.name === 'ENGAGED',
        'Enemy with 120 awareness is ENGAGED'
      );
    }

    console.log('\n--- Test 5: Player State ---');
    
    var player = GoneRogue.getPlayer();
    
    assert(
      player && typeof player === 'object',
      'getPlayer() returns an object'
    );
    
    assert(
      typeof player.x === 'number' && typeof player.y === 'number',
      'Player has x,y coordinates'
    );
    
    assert(
      typeof player.hp === 'number' && typeof player.maxHp === 'number',
      'Player has HP stats'
    );

    console.log('\n--- Test 6: Path Types ---');
    
    var hasPatrol = enemies.some(function(e) { 
      return e.path && e.path.type === 'patrol'; 
    });
    
    var hasCircular = enemies.some(function(e) { 
      return e.path && e.path.type === 'circular'; 
    });
    
    var hasStationary = enemies.some(function(e) { 
      return e.path && e.path.type === 'stationary'; 
    });

    assert(
      hasPatrol,
      'At least one enemy has patrol path'
    );
    
    assert(
      hasCircular,
      'At least one enemy has circular path'
    );
    
    assert(
      hasStationary,
      'At least one enemy has stationary path'
    );

    console.log('\n--- Test 7: Movement Commands ---');
    
    var initialX = player.x;
    var moveResult = GoneRogue.process('d'); // Move east
    
    assert(
      moveResult && moveResult.stayActive === true,
      'Movement command returns valid result'
    );
    
    player = GoneRogue.getPlayer();
    
    assert(
      player.x === initialX + 1,
      'Player moved east (x increased by 1)'
    );

    console.log('\n--- Test 8: Mobile UI Integration ---');
    
    assert(
      typeof GoneRogueMobile !== 'undefined',
      'GoneRogueMobile module is available'
    );
    
    if (typeof GoneRogueMobile !== 'undefined') {
      assert(
        typeof GoneRogueMobile.renderGrid === 'function',
        'GoneRogueMobile.renderGrid() exists'
      );
    }

    console.log('\n--- Test 9: Game Loop Cleanup ---');
    
    var exitResult = GoneRogue.process('exit');
    
    assert(
      !GoneRogue.isActive(),
      'GoneRogue is inactive after exit'
    );

    console.log('\n========================================');
    console.log('TEST SUMMARY');
    console.log('========================================');
    console.log('Total:  ' + tests.total);
    console.log('%cPassed: ' + tests.passed, 'color: green; font-weight: bold');
    if (tests.failed > 0) {
      console.log('%cFailed: ' + tests.failed, 'color: red; font-weight: bold');
    } else {
      console.log('Failed: 0');
    }
    console.log('========================================');

    if (tests.failed === 0) {
      console.log('%c✓ ALL TESTS PASSED', 'color: green; font-weight: bold; font-size: 16px');
    } else {
      console.log('%c✗ SOME TESTS FAILED', 'color: red; font-weight: bold; font-size: 16px');
    }
  }

  // Auto-run if GoneRogue is loaded
  if (typeof GoneRogue !== 'undefined') {
    runTests();
  } else {
    console.error('GoneRogue not loaded. Include gone-rogue.js before running this test.');
  }
})();
