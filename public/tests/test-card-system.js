/* ============================================================
   EYES ONLY - Test Harness for Card System & Status Effects
   Validates card lifecycle, status effects, resource costs, and combat integration
   ============================================================ */

(function () {
  'use strict';

  console.log('========================================');
  console.log('TEST: Card System & Status Effects');
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
    // ========== TEST 1: Card System Module ==========
    console.log('\n--- Test 1: Card System Module ---');

    assert(
      typeof CardSystem !== 'undefined',
      'CardSystem module is available'
    );

    assert(
      typeof CardSystem.BASE_CARDS !== 'undefined',
      'CardSystem.BASE_CARDS is defined'
    );

    assert(
      typeof CardSystem.LIFECYCLE_TYPES !== 'undefined',
      'CardSystem.LIFECYCLE_TYPES is defined'
    );

    assert(
      Object.keys(CardSystem.BASE_CARDS).length > 30,
      'CardSystem has 30+ base cards'
    );

    // ========== TEST 2: New Cards Exist ==========
    console.log('\n--- Test 2: New Card Definitions ---');

    assert(
      'OIL_SLICK' in CardSystem.BASE_CARDS,
      'OIL_SLICK card exists'
    );

    assert(
      'LIGHTER' in CardSystem.BASE_CARDS,
      'LIGHTER card exists'
    );

    assert(
      'WATER_BOTTLE' in CardSystem.BASE_CARDS,
      'WATER_BOTTLE card exists'
    );

    assert(
      'PREDATOR_FOCUS' in CardSystem.BASE_CARDS,
      'PREDATOR_FOCUS (Power) card exists'
    );

    assert(
      'GHOST_PROTOCOL' in CardSystem.BASE_CARDS,
      'GHOST_PROTOCOL (Power) card exists'
    );

    assert(
      'LAST_STAND' in CardSystem.BASE_CARDS,
      'LAST_STAND (Exhaust) card exists'
    );

    assert(
      'PANIC_DODGE' in CardSystem.BASE_CARDS,
      'PANIC_DODGE (Exhaust) card exists'
    );

    // ========== TEST 3: Lifecycle Types ==========
    console.log('\n--- Test 3: Lifecycle Types ---');

    var oilSlick = CardSystem.BASE_CARDS.OIL_SLICK;
    assertEqual(
      oilSlick.lifecycleType,
      'disposable',
      'OIL_SLICK has disposable lifecycle'
    );

    var predatorFocus = CardSystem.BASE_CARDS.PREDATOR_FOCUS;
    assertEqual(
      predatorFocus.lifecycleType,
      'power',
      'PREDATOR_FOCUS has power lifecycle'
    );

    var lastStand = CardSystem.BASE_CARDS.LAST_STAND;
    assertEqual(
      lastStand.lifecycleType,
      'exhaust',
      'LAST_STAND has exhaust lifecycle'
    );

    // ========== TEST 4: Card Rolling ==========
    console.log('\n--- Test 4: Card Rolling & Quality ---');

    var rolledCard = CardSystem.rollCard('OIL_SLICK');
    assertNotNull(rolledCard, 'rollCard returns a card object');

    assert(
      rolledCard.quality in CardSystem.QUALITIES,
      'Rolled card has valid quality'
    );

    assert(
      rolledCard.base === 'OIL_SLICK',
      'Rolled card has correct base type'
    );

    assert(
      typeof rolledCard.stats === 'object',
      'Rolled card has stats object'
    );

    assert(
      Array.isArray(rolledCard.affixes),
      'Rolled card has affixes array'
    );

    // ========== TEST 5: Status Effects Module ==========
    console.log('\n--- Test 5: Status Effects Module ---');

    assert(
      typeof StatusEffects !== 'undefined',
      'StatusEffects module is available'
    );

    assert(
      typeof StatusEffects.STATUS_TYPES !== 'undefined',
      'STATUS_TYPES is defined'
    );

    assert(
      Object.keys(StatusEffects.STATUS_TYPES).length === 12,
      'StatusEffects has 12 status types'
    );

    // ========== TEST 6: Status Effect Types ==========
    console.log('\n--- Test 6: Status Effect Types ---');

    var statusTypes = StatusEffects.STATUS_TYPES;

    assert(
      'BURNING' in statusTypes,
      'BURNING status exists'
    );

    assert(
      'BLEEDING' in statusTypes,
      'BLEEDING status exists'
    );

    assert(
      'STUNNED' in statusTypes,
      'STUNNED status exists'
    );

    assert(
      'SUPPRESSED' in statusTypes,
      'SUPPRESSED status exists'
    );

    assert(
      'PANIC' in statusTypes,
      'PANIC status exists'
    );

    assert(
      'CALM' in statusTypes,
      'CALM status exists'
    );

    assert(
      'HIDDEN' in statusTypes,
      'HIDDEN status exists'
    );

    assert(
      'OILED' in statusTypes,
      'OILED status exists'
    );

    assert(
      'WET' in statusTypes,
      'WET status exists'
    );

    assert(
      'ELECTRIFIED' in statusTypes,
      'ELECTRIFIED status exists'
    );

    // ========== TEST 7: Create Status Effect ==========
    console.log('\n--- Test 7: Create Status Effect ---');

    var burningStatus = StatusEffects.create('BURNING', 3, 'fire_tile');

    assertNotNull(burningStatus, 'Created burning status');
    assertEqual(burningStatus.type, 'BURNING', 'Status has correct type');
    assertEqual(burningStatus.duration, 3, 'Status has correct duration');
    assertEqual(burningStatus.source, 'fire_tile', 'Status has correct source');
    assert(burningStatus.icon === '🔥', 'Status has correct icon');
    assert(burningStatus.category === 'dot', 'Status has correct category');

    // ========== TEST 8: Status Effect Manager ==========
    console.log('\n--- Test 8: Status Effect Manager ---');

    var manager = StatusEffects.createManager();

    assertNotNull(manager, 'Created status effect manager');
    assertEqual(manager.getAll().length, 0, 'Manager starts with no statuses');

    // Apply burning
    manager.apply('BURNING', 3, 'test');
    assertEqual(manager.getAll().length, 1, 'Manager has 1 status after apply');
    assert(manager.has('BURNING'), 'Manager.has() detects BURNING');

    // Apply another status
    manager.apply('BLEEDING', 2, 'test');
    assertEqual(manager.getAll().length, 2, 'Manager has 2 statuses');

    // Test visibility (max 3)
    manager.apply('STUNNED', 1, 'test');
    manager.apply('OILED', 99, 'test');
    var visible = manager.getVisible();
    assert(visible.length <= 3, 'getVisible() returns max 3 statuses');

    // ========== TEST 9: Status Effect Tick ==========
    console.log('\n--- Test 9: Status Effect Duration & Tick ---');

    var testStatus = StatusEffects.create('STUNNED', 2, 'test');
    assertEqual(testStatus.duration, 2, 'Status starts with duration 2');

    var stillActive = testStatus.tick();
    assert(stillActive, 'Status is still active after first tick');
    assertEqual(testStatus.duration, 1, 'Duration reduced to 1');

    stillActive = testStatus.tick();
    assert(!stillActive, 'Status expired after second tick');
    assertEqual(testStatus.duration, 0, 'Duration is now 0');

    // ========== TEST 10: Status Counters ==========
    console.log('\n--- Test 10: Status Counters ---');

    var counterManager = StatusEffects.createManager();
    counterManager.apply('BURNING', 3, 'test');
    counterManager.apply('BLEEDING', 3, 'test');

    var removed = counterManager.counter('WET');
    assert(removed.length === 1, 'Water counter removed 1 status (Burning)');
    assert(!counterManager.has('BURNING'), 'BURNING removed by water');
    assert(counterManager.has('BLEEDING'), 'BLEEDING not affected by water');

    // ========== TEST 11: Status Interactions ==========
    console.log('\n--- Test 11: Status Interactions ---');

    var interactionManager = StatusEffects.createManager();
    interactionManager.apply('BURNING', 3, 'test');
    interactionManager.apply('OILED', 99, 'test');

    var messages = StatusEffects.processInteractions(interactionManager);
    assert(messages.length > 0, 'Oil + Fire interaction produces messages');

    // ========== TEST 12: Gamestate Resources ==========
    console.log('\n--- Test 12: Gamestate Resources ---');

    assert(
      typeof GAMESTATE !== 'undefined',
      'GAMESTATE module is available'
    );

    assert(
      typeof GAMESTATE.getEnergy === 'function',
      'GAMESTATE.getEnergy() exists'
    );

    assert(
      typeof GAMESTATE.getFocus === 'function',
      'GAMESTATE.getFocus() exists'
    );

    assert(
      typeof GAMESTATE.getBattery === 'function',
      'GAMESTATE.getBattery() exists'
    );

    assert(
      typeof GAMESTATE.getStability === 'function',
      'GAMESTATE.getStability() exists'
    );

    // Test resource values
    var energy = GAMESTATE.getEnergy();
    assert(typeof energy === 'number' && energy >= 0 && energy <= 5, 'Energy is valid (0-5)');

    var focus = GAMESTATE.getFocus();
    assert(typeof focus === 'number' && focus >= 0 && focus <= 10, 'Focus is valid (0-10)');

    var battery = GAMESTATE.getBattery();
    assert(typeof battery === 'number' && battery >= 0 && battery <= 5, 'Battery is valid (0-5)');

    var stability = GAMESTATE.getStability();
    assert(typeof stability === 'number' && stability >= 0 && stability <= 10, 'Stability is valid (0-10)');

    // ========== TEST 13: Resource Usage ==========
    console.log('\n--- Test 13: Resource Usage ---');

    var useEnergyResult = GAMESTATE.useEnergy(1);
    assert(useEnergyResult.success, 'Can use energy');

    var loseFocusResult = GAMESTATE.loseFocus(2);
    assert(typeof loseFocusResult === 'number', 'Can lose focus');

    var useBatteryResult = GAMESTATE.useBattery(1);
    assert(useBatteryResult.success, 'Can use battery');

    var loseStabilityResult = GAMESTATE.loseStability(2);
    assert(typeof loseStabilityResult === 'number', 'Can lose stability');

    // ========== TEST 14: Card Pickup Simulation ==========
    console.log('\n--- Test 14: Card Pickup Simulation ---');

    // Simulate finding a card on the ground
    var foundCard = CardSystem.rollCard('LIGHTER');
    assertNotNull(foundCard, 'Found LIGHTER card on ground');

    // Simulate picking it up
    var addResult = GAMESTATE.addToLoose(foundCard);
    assert(addResult.success, 'Successfully added card to loose inventory');

    var looseInventory = GAMESTATE.getLooseInventory();
    assert(looseInventory.length > 0, 'Loose inventory has items');

    // ========== TEST 15: Combat Resolution Simulation ==========
    console.log('\n--- Test 15: Combat Resolution Simulation ---');

    // Simulate player using LIGHTER card on oiled enemy
    var combatManager = StatusEffects.createManager();

    // Enemy is oiled
    combatManager.apply('OILED', 99, 'oil_slick');
    assert(combatManager.has('OILED'), 'Enemy is oiled');

    // Player uses lighter - apply burning
    combatManager.apply('BURNING', 3, 'lighter_card');
    assert(combatManager.has('BURNING'), 'Enemy is now burning');

    // Check interaction (oil + fire)
    var combatMessages = StatusEffects.processInteractions(combatManager);
    assert(combatMessages.length > 0, 'Oil + Fire interaction triggered');

    // Simulate combat round (tick statuses)
    var mockEnemy = { health: 20, name: 'Test Enemy', justMoved: false };
    var turnMessages = combatManager.tick(mockEnemy);
    assert(turnMessages.length > 0, 'Status effects applied during tick');
    assert(mockEnemy.health < 20, 'Enemy took damage from burning');

    // ========== TEST 16: Accuracy Modifiers ==========
    console.log('\n--- Test 16: Status Accuracy Modifiers ---');

    var modManager = StatusEffects.createManager();
    modManager.apply('CALM', 3, 'test');
    modManager.apply('SUPPRESSED', 2, 'test');

    var accuracyMod = modManager.getAccuracyModifier();
    assert(typeof accuracyMod === 'number', 'getAccuracyModifier() returns number');
    // CALM: +15, SUPPRESSED: -30 = -15 total
    assertEqual(accuracyMod, -15, 'Accuracy modifier correctly combines bonuses and penalties');

    // ========== TEST 17: Movement/Action Disabled ==========
    console.log('\n--- Test 17: Control Status Effects ---');

    var controlManager = StatusEffects.createManager();
    controlManager.apply('KNOCKED_DOWN', 1, 'explosion');

    assert(controlManager.isMovementDisabled(), 'KNOCKED_DOWN disables movement');

    controlManager.clear();
    controlManager.apply('STUNNED', 1, 'tazer');

    assert(controlManager.isActionDisabled(), 'STUNNED disables actions');

    // ========== TEST 18: Stealth Status ==========
    console.log('\n--- Test 18: Stealth Status Effects ---');

    var stealthManager = StatusEffects.createManager();
    stealthManager.apply('HIDDEN', 99, 'stealth_stance');

    assert(stealthManager.isUntargetable(), 'HIDDEN makes entity untargetable');

    // Break stealth
    stealthManager.counter('LOUD_SHOT');
    assert(!stealthManager.has('HIDDEN'), 'Loud shot breaks HIDDEN status');

    // ========== TEST 19: Card System Integration ==========
    console.log('\n--- Test 19: Card → Status Integration ---');

    var waterBottle = CardSystem.BASE_CARDS.WATER_BOTTLE;
    assert(waterBottle.baseStats.applyStatus === 'WET', 'Water Bottle applies WET status');
    assert(waterBottle.baseStats.extinguishesFire === true, 'Water Bottle extinguishes fire');

    var lighter = CardSystem.BASE_CARDS.LIGHTER;
    assert(lighter.baseStats.applyStatus === 'BURNING', 'Lighter applies BURNING status');
    assert(lighter.baseStats.ignitesOil === true, 'Lighter ignites oil');

    // ========== TEST 20: Status Serialization ==========
    console.log('\n--- Test 20: Status Serialization ---');

    var serializeManager = StatusEffects.createManager();
    serializeManager.apply('BURNING', 3, 'test');
    serializeManager.apply('BLEEDING', 2, 'test');

    var serialized = serializeManager.toJSON();
    assert(Array.isArray(serialized), 'toJSON() returns array');
    assertEqual(serialized.length, 2, 'Serialized 2 statuses');

    var newManager = StatusEffects.createManager();
    newManager.fromJSON(serialized);
    assertEqual(newManager.getAll().length, 2, 'Restored 2 statuses from JSON');
    assert(newManager.has('BURNING'), 'Restored BURNING status');
    assert(newManager.has('BLEEDING'), 'Restored BLEEDING status');

    // ========== TEST 21: 3D Printer — addPrintedCards API ==========
    console.log('\n--- Test 21: 3D Printer — addPrintedCards API ---');

    assert(
      typeof GAMESTATE.addPrintedCards === 'function',
      'GAMESTATE.addPrintedCards() exists'
    );

    // Reset to clean state for printer tests
    GAMESTATE.reset();

    // T21.1: Single card goes to hand
    var pr1 = GAMESTATE.addPrintedCards('ACT-002', 1, { preferHand: true });
    assert(pr1.success, 'addPrintedCards returns success');
    assertEqual(pr1.toHand, 1, 'First card goes to hand');
    assertEqual(pr1.toBackup, 0, 'First card does not go to backup');
    var hand21 = GAMESTATE.getCardsInHand();
    assertEqual(hand21.length, 1, 'Hand has 1 entry after printing 1');
    assertEqual(hand21[0].id, 'ACT-002', 'Hand entry has correct card id');
    assertEqual(hand21[0].qty, 1, 'Hand entry starts at qty 1');

    // T21.2: Same card stacks qty in hand
    var pr2 = GAMESTATE.addPrintedCards('ACT-002', 2, { preferHand: true });
    var hand21b = GAMESTATE.getCardsInHand();
    assertEqual(hand21b.length, 1, 'Same card stacks in hand (still 1 entry)');
    assertEqual(hand21b[0].qty, 3, 'Hand qty stacked to 3 after printing 2 more');
    assertEqual(pr2.toHand, 2, 'Both cards went to hand');

    // T21.3: Different card fills next hand slot
    GAMESTATE.reset();
    GAMESTATE.addPrintedCards('ACT-002', 1, { preferHand: true });
    GAMESTATE.addPrintedCards('ACT-001', 1, { preferHand: true });
    var hand21c = GAMESTATE.getCardsInHand();
    assertEqual(hand21c.length, 2, 'Two different cards occupy two hand slots');

    // T21.4: Hand overflow spills into backup
    GAMESTATE.reset();
    // Fill all 5 hand slots with different cards
    GAMESTATE.addPrintedCards('ACT-001', 1);
    GAMESTATE.addPrintedCards('ACT-002', 1);
    GAMESTATE.addPrintedCards('ACT-999', 1);
    GAMESTATE.addPrintedCards('ACT-000', 1);
    GAMESTATE.addPrintedCards('ACT-001', 1); // stacks, not a new slot
    var handFull = GAMESTATE.getCardsInHand();
    assert(handFull.length <= 5, 'Hand does not exceed maxHandSize');


    GAMESTATE.reset();
    for (var fi = 0; fi < 5; fi++) {
      GAMESTATE.addPrintedCards('CARD-' + fi, 1, { preferHand: true });
    }
    var handAfter5 = GAMESTATE.getCardsInHand();
    assert(handAfter5.length <= 5, 'Hand capped at maxHandSize after 5 unique cards');

    // Print a 6th unique card — must overflow to backup
    var pr6 = GAMESTATE.addPrintedCards('CARD-6', 1, { preferHand: true });
    var backup21 = GAMESTATE.getBackupCards();
    var backupFilled = backup21.filter(function(b) { return b && b.id; });
    assert(backupFilled.length >= 1, 'Overflow card lands in backup');
    assertEqual(pr6.toBackup, 1, 'Overflow card counted as toBackup');
    assertEqual(pr6.toHand, 0, 'Overflow card not counted as toHand');

    // T21.5: Backup stacks same card by qty
    GAMESTATE.reset();
    for (var si = 0; si < 5; si++) GAMESTATE.addPrintedCards('CARD-' + si, 1);
    GAMESTATE.addPrintedCards('CARD-5', 1); // slot 0 of backup
    GAMESTATE.addPrintedCards('CARD-5', 1); // should stack qty in backup slot 0
    var backupAfterStack = GAMESTATE.getBackupCards();
    var stacked = backupAfterStack.filter(function(b) { return b && b.id === 'CARD-5'; });
    assert(stacked.length === 1, 'Same card stacks to single backup slot');
    assert(stacked[0].qty >= 2, 'Backup slot qty incremented for same card');

    // T21.6: 25-card total cap — holding exactly 25 prevents further accumulation
    GAMESTATE.reset();
    // Fill up 25 total qty across hand + backup using single card (stacks)
    var prBig = GAMESTATE.addPrintedCards('ACT-002', 30, { preferHand: true });
    assert(prBig.success, 'addPrintedCards succeeds with qty > 25');
    assert(prBig.discarded > 0, '25-card cap triggers discards when printing 30');

    function _countTotal() {
      var t = 0;
      var h = GAMESTATE.getCardsInHand();
      for (var qi = 0; qi < h.length; qi++) if (h[qi]) t += (h[qi].qty || 1);
      var bk = GAMESTATE.getBackupCards();
      for (var bj = 0; bj < bk.length; bj++) if (bk[bj] && bk[bj].id) t += (bk[bj].qty || 1);
      return t;
    }

    var total21 = _countTotal();
    assert(total21 <= 25, '3D printer cap: total cards held <= 25 after printing 30 (got ' + total21 + ')');

    // T21.7: Qty display — printing adds to existing qty in hand/backup
    GAMESTATE.reset();
    GAMESTATE.addPrintedCards('ACT-002', 5, { preferHand: true });
    var handQty = GAMESTATE.getCardsInHand();
    var act002InHand = handQty.find(function(r) { return r && r.id === 'ACT-002'; });
    assert(act002InHand && act002InHand.qty === 5, 'qty field on hand entry reflects print count (5)');

    // T21.8: consumeActiveItem removes the active item
    GAMESTATE.reset();
    GAMESTATE.setActiveItem({ id: 'ITM-PRINTER', qty: 1, meta: { toggled: true } });
    var activeAfterSet = GAMESTATE.getActiveItem();
    assert(activeAfterSet && activeAfterSet.id === 'ITM-PRINTER', 'setActiveItem sets the active item');
    GAMESTATE.consumeActiveItem();
    var activeAfterConsume = GAMESTATE.getActiveItem();
    assert(!activeAfterConsume || !activeAfterConsume.id, 'consumeActiveItem clears the active item');

    // T21.9: toggleActiveItemToggled arms the item (meta.toggled = true)
    GAMESTATE.reset();
    GAMESTATE.addToPersistent({ id: 'ITM-PRINTER', qty: 1 });
    GAMESTATE.setActiveItem({ id: 'ITM-PRINTER', qty: 1, meta: {} });
    GAMESTATE.toggleActiveItemToggled();
    var toggledItem = GAMESTATE.getActiveItem();
    assert(toggledItem && toggledItem.meta && toggledItem.meta.toggled === true, 'toggleActiveItemToggled arms the item (meta.toggled = true)');

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
  window.TestCardSystem = {
    run: runTests
  };

  // Auto-run if standalone
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runTests);
  } else {
    setTimeout(runTests, 100); // Small delay to ensure modules are loaded
  }
})();
