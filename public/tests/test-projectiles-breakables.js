/* ============================================================
   EYES ONLY - Test Harness for Projectiles & Breakables
   Validates ASCII/emoji projectile pathing and destructible props
   ============================================================ */

(function () {
  'use strict';

  console.log('========================================');
  console.log('TEST: Projectiles & Breakables');
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
    assert(typeof GoneRogue !== 'undefined', 'GoneRogue module is available');

    if (typeof GoneRogue.init === 'function') {
      GoneRogue.init();
    }

    var start = typeof GoneRogue.start === 'function' ? GoneRogue.start({}) : null;
    assert(start && start.prompt === 'ROGUE> ', 'GoneRogue.start() returns prompt');

    assert(typeof GoneRogue.fireProjectile === 'function', 'fireProjectile() API exists');
    assert(typeof GoneRogue.getBreakables === 'function', 'getBreakables() API exists');
    assert(typeof GoneRogue.getProjectiles === 'function', 'getProjectiles() API exists');
    assert(typeof GoneRogue.stepProjectiles === 'function', 'stepProjectiles() helper exists');

    var breakables = GoneRogue.getBreakables();
    assert(Array.isArray(breakables) && breakables.length > 0, 'Breakables are spawned');

    var closeCrate = breakables.find(function(b) { return b.tag === 'close_crate'; });
    assert(!!closeCrate, 'Close crate placed near player start');

    var initialHp = closeCrate ? closeCrate.hp : 0;

    var fireResult = GoneRogue.fireProjectile('shoot east');
    assert(fireResult && fireResult.stayActive === true, 'fireProjectile() returns stayActive true');

    GoneRogue.stepProjectiles(2);
    breakables = GoneRogue.getBreakables();
    var damagedCrate = breakables.find(function(b) { return b.tag === 'close_crate'; });

    assert(
      damagedCrate && damagedCrate.hp < initialHp,
      'Projectile damaged close breakable 📦'
    );

    var kickResult = GoneRogue.process ? GoneRogue.process('kick east') : null;
    assert(
      kickResult && kickResult.stayActive === true,
      'KICK command processes via GoneRogue.process()'
    );

    // Boot again if needed to finish the crate
    damagedCrate = GoneRogue.getBreakables().find(function(b) { return b.tag === 'close_crate'; });
    if (damagedCrate && damagedCrate.hp > 0 && typeof GoneRogue.process === 'function') {
      GoneRogue.process('kick east');
    }

    var destroyedCrate = GoneRogue.getBreakables().find(function(b) { return b.tag === 'close_crate'; });
    assert(
      destroyedCrate && destroyedCrate.hp === 0,
      'Breakable destroyed via projectile + kicks'
    );

    var projectiles = GoneRogue.getProjectiles();
    assert(Array.isArray(projectiles), 'Projectiles list available for inspection');

    console.log('\n--- Test 2: Projectile triggers STR combat on enemy ---');

    // Clear breakables so path is open
    GoneRogue.getBreakables().forEach(function(b) { b.hp = 0; });

    var player = GoneRogue.getPlayer();
    var enemies = GoneRogue.getEnemies();
    var testEnemy = {
      x: player.x + 4,
      y: player.y,
      hp: 5,
      awareness: 0,
      orientation: 'west',
      sightRange: 3,
      path: { type: 'stationary' }
    };
    enemies.push(testEnemy);

    GoneRogue.fireProjectile('shoot east');
    GoneRogue.stepProjectiles(4);

    assert(GoneRogue.isStrCombatActive(), 'Projectile impact enters STR combat');

    console.log('\n--- Test 3: Hostile projectile triggers STR combat on player ---');

    // Reset combat state for next check
    if (GoneRogue.isStrCombatActive() && typeof GoneRogue.getStrCombatState === 'function') {
      var enemyInCombat = GoneRogue.getStrCombatState().enemy;
      if (enemyInCombat) { enemyInCombat.hp = 0; }
      GoneRogue.process('flee');
    }

    var hostile = {
      x: player.x + 2,
      y: player.y,
      dx: -1,
      dy: 0,
      glyph: '←',
      owner: 'enemy',
      sourceEnemy: testEnemy,
      range: 2,
      power: 1
    };
    GoneRogue.getProjectiles().push(hostile);
    GoneRogue.stepProjectiles(2);

    assert(GoneRogue.isStrCombatActive(), 'Hostile projectile entering player tile starts STR combat');

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
      console.log('%c✓ ALL PROJECTILE/BREAKABLE TESTS PASSED', 'color: green; font-weight: bold; font-size: 16px');
    } else {
      console.log('%c✗ SOME TESTS FAILED', 'color: red; font-weight: bold; font-size: 16px');
    }
  }

  if (typeof GoneRogue !== 'undefined') {
    runTests();
  } else {
    console.error('GoneRogue not loaded. Include gone-rogue.js before running this test.');
  }
})();
