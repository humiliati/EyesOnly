/* ============================================================
   EYES ONLY - Test Harness for Cooldown Tracking System
   Validates cooldown application, tracking, and card availability
   ============================================================ */

(function () {
  'use strict';

  console.log('========================================');
  console.log('TEST: Cooldown Tracking System');
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

  function assertEqual(actual, expected, message) {
    return assert(actual === expected, message + ' (expected: ' + expected + ', got: ' + actual + ')');
  }

  function assertNotNull(value, message) {
    return assert(value !== null && value !== undefined, message);
  }

  function runTests() {
    // ========== TEST 1: CooldownTracker Module ==========
    console.log('\n--- Test 1: CooldownTracker Module ---');

    assert(
      typeof CooldownTracker !== 'undefined',
      'CooldownTracker module is available'
    );

    assert(
      typeof CooldownTracker.COOLDOWN_TYPES !== 'undefined',
      'COOLDOWN_TYPES is defined'
    );

    assert(
      typeof CooldownTracker.createManager === 'function',
      'createManager() function exists'
    );

    // ========== TEST 2: Cooldown Types ==========
    console.log('\n--- Test 2: Cooldown Types ---');

    var types = CooldownTracker.COOLDOWN_TYPES;

    assertEqual(types.COMBAT, 'combat', 'COMBAT type is correct');
    assertEqual(types.FLOOR, 'floor', 'FLOOR type is correct');
    assertEqual(types.RUN, 'run', 'RUN type is correct');

    // ========== TEST 3: Create Cooldown Manager ==========
    console.log('\n--- Test 3: Create Cooldown Manager ---');

    var manager = CooldownTracker.createManager();
    assertNotNull(manager, 'Created cooldown manager');

    assert(
      typeof manager.registerCard === 'function',
      'Manager has registerCard() method'
    );

    assert(
      typeof manager.useCard === 'function',
      'Manager has useCard() method'
    );

    assert(
      typeof manager.isCardAvailable === 'function',
      'Manager has isCardAvailable() method'
    );

    // ========== TEST 4: Register Card with Combat Cooldown ==========
    console.log('\n--- Test 4: Register Card with Combat Cooldown ---');

    manager.registerCard('card_thermal', { type: 'combat', duration: 3 });

    var info = manager.getCooldownInfo('card_thermal', 0, 1);
    assertNotNull(info, 'Got cooldown info for registered card');
    assertEqual(info.type, 'combat', 'Card has combat cooldown type');
    assertEqual(info.duration, 3, 'Card has duration of 3 combats');

    // ========== TEST 5: Card Availability Before Use ==========
    console.log('\n--- Test 5: Card Availability Before Use ---');

    var available = manager.isCardAvailable('card_thermal', 0, 1);
    assert(available, 'Card is available before first use');

    assertEqual(info.remaining, 0, 'No cooldown remaining before use');
    assert(info.available, 'Card shows as available');

    // ========== TEST 6: Use Card - Apply Cooldown ==========
    console.log('\n--- Test 6: Use Card - Apply Cooldown ---');

    var success = manager.useCard('card_thermal', 1, 1);
    assert(success, 'Successfully used card and applied cooldown');

    info = manager.getCooldownInfo('card_thermal', 1, 1);
    assertEqual(info.usedAtCombat, 1, 'Card marked as used at combat 1');
    assert(!info.available, 'Card is not available immediately after use');
    assertEqual(info.remaining, 3, 'Card has 3 combats cooldown remaining');

    // ========== TEST 7: Card Unavailable During Cooldown ==========
    console.log('\n--- Test 7: Card Unavailable During Cooldown ---');

    available = manager.isCardAvailable('card_thermal', 2, 1);
    assert(!available, 'Card unavailable at combat 2 (1 combat passed)');

    info = manager.getCooldownInfo('card_thermal', 2, 1);
    assertEqual(info.remaining, 2, 'Card has 2 combats cooldown remaining');

    available = manager.isCardAvailable('card_thermal', 3, 1);
    assert(!available, 'Card unavailable at combat 3 (2 combats passed)');

    info = manager.getCooldownInfo('card_thermal', 3, 1);
    assertEqual(info.remaining, 1, 'Card has 1 combat cooldown remaining');

    // ========== TEST 8: Card Available After Cooldown ==========
    console.log('\n--- Test 8: Card Available After Cooldown ---');

    available = manager.isCardAvailable('card_thermal', 4, 1);
    assert(available, 'Card available at combat 4 (cooldown expired)');

    info = manager.getCooldownInfo('card_thermal', 4, 1);
    assertEqual(info.remaining, 0, 'No cooldown remaining');
    assert(info.available, 'Card shows as available');

    // ========== TEST 9: Floor Cooldown ==========
    console.log('\n--- Test 9: Floor Cooldown ---');

    var floorManager = CooldownTracker.createManager();
    floorManager.registerCard('card_smoke', { type: 'floor', duration: 1 });

    available = floorManager.isCardAvailable('card_smoke', 1, 1);
    assert(available, 'Floor cooldown card available initially');

    floorManager.useCard('card_smoke', 1, 1);
    available = floorManager.isCardAvailable('card_smoke', 2, 1);
    assert(!available, 'Floor cooldown card unavailable on same floor');

    available = floorManager.isCardAvailable('card_smoke', 2, 2);
    assert(available, 'Floor cooldown card available on next floor');

    // ========== TEST 10: Run Cooldown (Once Per Run) ==========
    console.log('\n--- Test 10: Run Cooldown (Once Per Run) ---');

    var runManager = CooldownTracker.createManager();
    runManager.registerCard('card_ambush', { type: 'run', duration: 1 });

    available = runManager.isCardAvailable('card_ambush', 1, 1);
    assert(available, 'Run cooldown card available initially');

    runManager.useCard('card_ambush', 1, 1);
    available = runManager.isCardAvailable('card_ambush', 2, 1);
    assert(!available, 'Run cooldown card unavailable after use');

    available = runManager.isCardAvailable('card_ambush', 10, 5);
    assert(!available, 'Run cooldown card never available again this run');

    info = runManager.getCooldownInfo('card_ambush', 10, 5);
    assertEqual(info.remaining, -1, 'Run cooldown shows -1 for permanent unavailability');

    // ========== TEST 11: Multiple Cards with Different Cooldowns ==========
    console.log('\n--- Test 11: Multiple Cards with Different Cooldowns ---');

    var multiManager = CooldownTracker.createManager();
    multiManager.registerCard('card_a', { type: 'combat', duration: 2 });
    multiManager.registerCard('card_b', { type: 'combat', duration: 3 });
    multiManager.registerCard('card_c', { type: 'floor', duration: 1 });

    multiManager.useCard('card_a', 1, 1);
    multiManager.useCard('card_b', 1, 1);
    multiManager.useCard('card_c', 1, 1);

    var onCooldown = multiManager.getCardsOnCooldown(1, 1);
    assertEqual(onCooldown.length, 3, 'All 3 cards on cooldown immediately after use');

    available = multiManager.isCardAvailable('card_a', 3, 1);
    assert(available, 'Card A available after 2 combats');

    available = multiManager.isCardAvailable('card_b', 3, 1);
    assert(!available, 'Card B still on cooldown after 2 combats');

    available = multiManager.isCardAvailable('card_c', 2, 2);
    assert(available, 'Card C available on next floor');

    // ========== TEST 12: Reset Card Cooldown ==========
    console.log('\n--- Test 12: Reset Card Cooldown ---');

    var resetManager = CooldownTracker.createManager();
    resetManager.registerCard('card_reset', { type: 'combat', duration: 5 });
    resetManager.useCard('card_reset', 1, 1);

    available = resetManager.isCardAvailable('card_reset', 2, 1);
    assert(!available, 'Card on cooldown before reset');

    resetManager.resetCard('card_reset');
    available = resetManager.isCardAvailable('card_reset', 2, 1);
    assert(available, 'Card available after reset');

    // ========== TEST 13: Remove Card from Tracking ==========
    console.log('\n--- Test 13: Remove Card from Tracking ---');

    var removeManager = CooldownTracker.createManager();
    removeManager.registerCard('card_remove', { type: 'combat', duration: 2 });
    removeManager.useCard('card_remove', 1, 1);

    available = removeManager.isCardAvailable('card_remove', 1, 1);
    assert(!available, 'Card on cooldown before removal');

    removeManager.removeCard('card_remove');
    available = removeManager.isCardAvailable('card_remove', 1, 1);
    assert(available, 'Card treated as available after removal from tracking');

    // ========== TEST 14: Serialization ==========
    console.log('\n--- Test 14: Serialization ---');

    var serManager = CooldownTracker.createManager();
    serManager.registerCard('card_ser1', { type: 'combat', duration: 3 });
    serManager.registerCard('card_ser2', { type: 'floor', duration: 1 });
    serManager.useCard('card_ser1', 5, 2);
    serManager.useCard('card_ser2', 5, 2);

    var serialized = serManager.toJSON();
    assert(typeof serialized === 'object', 'Serialized to object');
    assert('card_ser1' in serialized, 'Serialized card_ser1');
    assert('card_ser2' in serialized, 'Serialized card_ser2');

    var newManager = CooldownTracker.createManager();
    newManager.fromJSON(serialized);

    available = newManager.isCardAvailable('card_ser1', 6, 2);
    assert(!available, 'Restored card still on cooldown');

    info = newManager.getCooldownInfo('card_ser1', 6, 2);
    assertEqual(info.remaining, 2, 'Restored card has correct remaining cooldown');

    // ========== TEST 15: GAMESTATE Integration ==========
    console.log('\n--- Test 15: GAMESTATE Integration ---');

    assert(
      typeof GAMESTATE !== 'undefined',
      'GAMESTATE module available'
    );

    assert(
      typeof GAMESTATE.getCombatCount === 'function',
      'GAMESTATE.getCombatCount() exists'
    );

    assert(
      typeof GAMESTATE.getFloorCount === 'function',
      'GAMESTATE.getFloorCount() exists'
    );

    assert(
      typeof GAMESTATE.incrementCombatCounter === 'function',
      'GAMESTATE.incrementCombatCounter() exists'
    );

    assert(
      typeof GAMESTATE.incrementFloorCounter === 'function',
      'GAMESTATE.incrementFloorCounter() exists'
    );

    // ========== TEST 16: Parse Cooldown from Card ==========
    console.log('\n--- Test 16: Parse Cooldown from Card ---');

    assert(
      typeof CooldownTracker.parseCooldownFromCard === 'function',
      'parseCooldownFromCard() exists'
    );

    var thermalCard = CardSystem.BASE_CARDS.THERMAL_VISION;
    var config = CooldownTracker.parseCooldownFromCard(thermalCard);

    assertNotNull(config, 'Parsed cooldown config from THERMAL_VISION');
    assertEqual(config.type, 'combat', 'THERMAL_VISION has combat cooldown');
    assertEqual(config.duration, 3, 'THERMAL_VISION has 3 combat cooldown');

    var smokeCard = CardSystem.BASE_CARDS.SMOKE_SCREEN;
    config = CooldownTracker.parseCooldownFromCard(smokeCard);

    assertNotNull(config, 'Parsed cooldown config from SMOKE_SCREEN');
    assertEqual(config.type, 'floor', 'SMOKE_SCREEN has floor cooldown');
    assertEqual(config.duration, 1, 'SMOKE_SCREEN has 1 floor cooldown');

    var ambushCard = CardSystem.BASE_CARDS.PERFECT_AMBUSH;
    config = CooldownTracker.parseCooldownFromCard(ambushCard);

    assertNotNull(config, 'Parsed cooldown config from PERFECT_AMBUSH');
    assertEqual(config.type, 'run', 'PERFECT_AMBUSH has run cooldown');

    // ========== TEST 17: Cards Without Cooldown ==========
    console.log('\n--- Test 17: Cards Without Cooldown ---');

    var noCooldownManager = CooldownTracker.createManager();
    noCooldownManager.registerCard('card_normal', null);

    available = noCooldownManager.isCardAvailable('card_normal', 1, 1);
    assert(available, 'Card without cooldown is always available');

    noCooldownManager.useCard('card_normal', 1, 1);
    available = noCooldownManager.isCardAvailable('card_normal', 1, 1);
    assert(available, 'Card without cooldown remains available after use');

    // ========== TEST 18: New Cooldown Cards Exist ==========
    console.log('\n--- Test 18: New Cooldown Cards Exist ---');

    assert(
      'THERMAL_VISION' in CardSystem.BASE_CARDS,
      'THERMAL_VISION card exists'
    );

    assert(
      'ADRENALINE_SURGE' in CardSystem.BASE_CARDS,
      'ADRENALINE_SURGE card exists'
    );

    assert(
      'SMOKE_SCREEN' in CardSystem.BASE_CARDS,
      'SMOKE_SCREEN card exists'
    );

    assert(
      'PERFECT_AMBUSH' in CardSystem.BASE_CARDS,
      'PERFECT_AMBUSH card exists'
    );

    // ========== TEST 19: Cooldown Card Properties ==========
    console.log('\n--- Test 19: Cooldown Card Properties ---');

    assertEqual(
      thermalCard.baseStats.cooldownCombat,
      3,
      'THERMAL_VISION has cooldownCombat: 3'
    );

    var surgeCard = CardSystem.BASE_CARDS.ADRENALINE_SURGE;
    assertEqual(
      surgeCard.baseStats.cooldownCombat,
      2,
      'ADRENALINE_SURGE has cooldownCombat: 2'
    );

    assertEqual(
      smokeCard.baseStats.cooldownFloor,
      1,
      'SMOKE_SCREEN has cooldownFloor: 1'
    );

    assert(
      ambushCard.baseStats.oncePerRun === true,
      'PERFECT_AMBUSH has oncePerRun: true'
    );

    // ========== TEST 20: Integration Test - Full Workflow ==========
    console.log('\n--- Test 20: Integration Test - Full Workflow ---');

    // Simulate a run with cooldown tracking
    var gameManager = CooldownTracker.createManager();

    // Register cooldown cards
    gameManager.registerCard('thermal_1', { type: 'combat', duration: 3 });
    gameManager.registerCard('smoke_1', { type: 'floor', duration: 1 });
    gameManager.registerCard('ambush_1', { type: 'run', duration: 1 });

    // Combat 1, Floor 1 - Use all cards
    assert(gameManager.isCardAvailable('thermal_1', 1, 1), 'Thermal available combat 1');
    assert(gameManager.isCardAvailable('smoke_1', 1, 1), 'Smoke available combat 1');
    assert(gameManager.isCardAvailable('ambush_1', 1, 1), 'Ambush available combat 1');

    gameManager.useCard('thermal_1', 1, 1);
    gameManager.useCard('smoke_1', 1, 1);
    gameManager.useCard('ambush_1', 1, 1);

    // Combat 2, Floor 1 - Check availability
    assert(!gameManager.isCardAvailable('thermal_1', 2, 1), 'Thermal on cooldown combat 2');
    assert(!gameManager.isCardAvailable('smoke_1', 2, 1), 'Smoke on cooldown same floor');
    assert(!gameManager.isCardAvailable('ambush_1', 2, 1), 'Ambush used (run cooldown)');

    // Combat 4, Floor 2 - After cooldowns
    assert(gameManager.isCardAvailable('thermal_1', 4, 2), 'Thermal available after 3 combats');
    assert(gameManager.isCardAvailable('smoke_1', 4, 2), 'Smoke available on new floor');
    assert(!gameManager.isCardAvailable('ambush_1', 4, 2), 'Ambush never available again');

    // Use thermal again
    gameManager.useCard('thermal_1', 4, 2);
    assert(!gameManager.isCardAvailable('thermal_1', 5, 2), 'Thermal on cooldown again');

    // ========== FINAL REPORT ==========
    console.log('\n========================================');
    console.log('TEST RESULTS:');
    console.log('Total:  ' + tests.total);
    console.log('%cPassed: ' + tests.passed, 'color: green; font-weight: bold');
    if (tests.failed > 0) {
      console.log('%cFailed: ' + tests.failed, 'color: red; font-weight: bold');
    } else {
      console.log('Failed: ' + tests.failed);
    }
    console.log('========================================');

    if (tests.failed === 0) {
      console.log('%c✓ ALL TESTS PASSED', 'color: green; font-weight: bold; font-size: 16px');
    } else {
      console.log('%c✗ SOME TESTS FAILED', 'color: red; font-weight: bold; font-size: 16px');
    }

    return {
      total: tests.total,
      passed: tests.passed,
      failed: tests.failed,
      success: tests.failed === 0
    };
  }

  // Export for external use
  window.TestCooldownSystem = {
    run: runTests
  };

  // Auto-run if standalone
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runTests);
  } else {
    setTimeout(runTests, 100); // Small delay to ensure modules are loaded
  }
})();
