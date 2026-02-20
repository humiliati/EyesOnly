/* ============================================================
   EYES ONLY - Environmental Synergy Test Harness
   Validates key+gate interactions, floor passability, and itemId display
   ============================================================ */

(function () {
  'use strict';

  console.log('========================================');
  console.log('TEST: Environmental Synergy System');
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
    tests.total++;
    if (actual === expected) {
      tests.passed++;
      console.log('%c✓ PASS: ' + message, 'color: green; font-weight: bold');
      return true;
    } else {
      tests.failed++;
      console.error('%c✗ FAIL: ' + message + ' (expected: ' + expected + ', got: ' + actual + ')', 'color: red; font-weight: bold');
      return false;
    }
  }

  function assertIncludes(value, substring, message) {
    tests.total++;
    if (value && value.indexOf(substring) !== -1) {
      tests.passed++;
      console.log('%c✓ PASS: ' + message, 'color: green; font-weight: bold');
      return true;
    } else {
      tests.failed++;
      console.error('%c✗ FAIL: ' + message + ' (expected substring: ' + substring + ', got: ' + value + ')', 'color: red; font-weight: bold');
      return false;
    }
  }

  function assertNotIncludes(value, substring, message) {
    tests.total++;
    if (value && value.indexOf(substring) === -1) {
      tests.passed++;
      console.log('%c✓ PASS: ' + message, 'color: green; font-weight: bold');
      return true;
    } else {
      tests.failed++;
      console.error('%c✗ FAIL: ' + message + ' (should NOT contain: ' + substring + ', got: ' + value + ')', 'color: red; font-weight: bold');
      return false;
    }
  }

  function runTests() {
    console.log('\n--- Test 1: Module Loading ---');

    assert(
      typeof EnvironmentalSynergy !== 'undefined',
      'EnvironmentalSynergy module is loaded'
    );

    assert(
      typeof EnvironmentalDragDrop !== 'undefined',
      'EnvironmentalDragDrop module is loaded'
    );

    assert(
      typeof NameUtils !== 'undefined',
      'NameUtils module is loaded'
    );

    console.log('\n--- Test 2: Key Item Definitions ---');

    EnvironmentalSynergy.init();

    // Test RUSTY_KEY definition
    var keyDefs = EnvironmentalSynergy.getKeyDefinitions();
    var rustyKey = keyDefs.RUSTY_KEY;
    assert(
      rustyKey !== undefined,
      'RUSTY_KEY is defined'
    );

    assertEqual(
      rustyKey.itemId,
      'KEY_001',
      'RUSTY_KEY has correct itemId'
    );

    assertEqual(
      rustyKey.name,
      'Rusty Key',
      'RUSTY_KEY has correct display name (not RUSTY_KEY)'
    );

    assert(
      Array.isArray(rustyKey.compatibleGates),
      'RUSTY_KEY has compatibleGates array'
    );

    assertIncludes(
      rustyKey.compatibleGates.join(','),
      'WOODEN_GATE',
      'RUSTY_KEY compatible with WOODEN_GATE'
    );

    console.log('\n--- Test 3: Gate Definitions ---');

    var gateDefs = EnvironmentalSynergy.getGateDefinitions();
    var woodenGate = gateDefs.WOODEN_GATE;
    assert(
      woodenGate !== undefined,
      'WOODEN_GATE is defined'
    );

    assertEqual(
      woodenGate.name,
      'Wooden Gate',
      'WOODEN_GATE has correct display name'
    );

    assert(
      Array.isArray(woodenGate.requiredKeys),
      'WOODEN_GATE has requiredKeys array'
    );

    assertIncludes(
      woodenGate.requiredKeys.join(','),
      'RUSTY_KEY',
      'WOODEN_GATE requires RUSTY_KEY'
    );

    console.log('\n--- Test 4: Name Abbreviation (Vowel-Drop Convention) ---');

    assertEqual(
      NameUtils.abbreviate('Rusty Key'),
      'RstyKy',
      'Rusty Key → RstyKy'
    );

    assertEqual(
      NameUtils.abbreviate('Sold Out'),
      'SldOt',
      'Sold Out → SldOt'
    );

    assertEqual(
      NameUtils.abbreviate('Energy Drink'),
      'EnrgyDrnk',
      'Energy Drink → EnrgyDrnk'
    );

    assertEqual(
      NameUtils.abbreviate('Out'),
      'Ot',
      'Out → Ot (first letter kept even if vowel)'
    );

    assertEqual(
      NameUtils.abbreviate('Attack', 6),
      'Attck',
      'Attack → Attck (with maxLength)'
    );

    console.log('\n--- Test 5: ItemId to Display Name Conversion ---');

    assertEqual(
      NameUtils.getDisplayName('RUSTY_KEY'),
      'Rusty Key',
      'RUSTY_KEY → Rusty Key'
    );

    assertEqual(
      NameUtils.getDisplayName('BRONZE_KEY'),
      'Bronze Key',
      'BRONZE_KEY → Bronze Key'
    );

    assertEqual(
      NameUtils.getDisplayName('WOODEN_GATE'),
      'Wooden Gate',
      'WOODEN_GATE → Wooden Gate'
    );

    // Test with maxLength
    assertEqual(
      NameUtils.getDisplayName('RUSTY_KEY', { maxLength: 6 }),
      'RstyKy',
      'RUSTY_KEY → RstyKy (abbreviated)'
    );

    console.log('\n--- Test 6: Mobile Formatting ---');

    assertEqual(
      NameUtils.formatForMobile('Rusty Key'),
      'RstyKy',
      'formatForMobile uses 6 char max'
    );

    assertEqual(
      NameUtils.formatForMobile({ name: 'Energy Drink' }),
      'EnrgyD',
      'formatForMobile handles objects'
    );

    assertEqual(
      NameUtils.formatForMobile('BRONZE_KEY'),
      'BrnzKy',
      'formatForMobile converts itemId format'
    );

    console.log('\n--- Test 7: Shop Formatting ---');

    assertEqual(
      NameUtils.formatForShop('Sold Out'),
      'SldOt',
      'formatForShop uses 8 char max (no truncation needed)'
    );

    var longName = 'Extremely Long Card Name';
    var shopName = NameUtils.formatForShop(longName);
    assert(
      shopName.length <= 8,
      'formatForShop limits to 8 chars (got: ' + shopName + ', length: ' + shopName.length + ')'
    );

    console.log('\n--- Test 8: Key-Gate Compatibility ---');

    assert(
      EnvironmentalSynergy.canUnlock('RUSTY_KEY', 'WOODEN_GATE'),
      'RUSTY_KEY can unlock WOODEN_GATE'
    );

    assert(
      EnvironmentalSynergy.canUnlock('MASTER_KEY', 'WOODEN_GATE'),
      'MASTER_KEY can unlock WOODEN_GATE'
    );

    assert(
      !EnvironmentalSynergy.canUnlock('KEYCARD', 'WOODEN_GATE'),
      'KEYCARD cannot unlock WOODEN_GATE'
    );

    console.log('\n--- Test 9: Gate Registration ---');

    EnvironmentalSynergy.clearGates();

    EnvironmentalSynergy.registerGate({
      x: 10,
      y: 5,
      type: 'WOODEN_GATE'
    });

    var gates = EnvironmentalSynergy.getRegisteredGates();
    assertEqual(
      gates.length,
      1,
      'One gate registered'
    );

    assertEqual(
      gates[0].x,
      10,
      'Gate has correct x coordinate'
    );

    assertEqual(
      gates[0].type,
      'WOODEN_GATE',
      'Gate has correct type'
    );

    console.log('\n--- Test 10: ItemId Never Displayed to Players ---');

    // Simulate drag-drop context with only itemId (no name)
    var mockContext = {
      itemId: 'RUSTY_KEY',
      itemData: null
    };

    // This should convert RUSTY_KEY to "Rusty Key", not show "RUSTY_KEY"
    var displayName = NameUtils.getDisplayName(mockContext.itemId);
    assertNotIncludes(
      displayName,
      '_',
      'Display name should not contain underscores (got: ' + displayName + ')'
    );

    assertIncludes(
      displayName,
      'Rusty',
      'Display name should be human-readable'
    );

    console.log('\n--- Test 11: Biome-Specific Keys (OFFICE) ---');

    // Test THUMB_DRIVE key for OFFICE biome
    var thumbDrive = keyDefs.THUMB_DRIVE;
    assert(
      thumbDrive !== undefined,
      'THUMB_DRIVE is defined'
    );

    assertEqual(
      thumbDrive.itemId,
      'KEY_005',
      'THUMB_DRIVE has correct itemId'
    );

    assertEqual(
      thumbDrive.emoji,
      '💾',
      'THUMB_DRIVE has correct emoji'
    );

    assertEqual(
      thumbDrive.biome,
      'OFFICE',
      'THUMB_DRIVE is OFFICE biome specific'
    );

    assertEqual(
      thumbDrive.consumeOnUse,
      false,
      'THUMB_DRIVE is reusable (not consumed)'
    );

    assertIncludes(
      thumbDrive.compatibleGates.join(','),
      'TERMINAL_GATE',
      'THUMB_DRIVE compatible with TERMINAL_GATE'
    );

    console.log('\n--- Test 12: Biome-Specific Gates (OFFICE) ---');

    // Test TERMINAL_GATE for OFFICE biome
    var terminalGate = gateDefs.TERMINAL_GATE;
    assert(
      terminalGate !== undefined,
      'TERMINAL_GATE is defined'
    );

    assertEqual(
      terminalGate.emoji,
      '💻',
      'TERMINAL_GATE has correct emoji'
    );

    assertEqual(
      terminalGate.biome,
      'OFFICE',
      'TERMINAL_GATE is OFFICE biome specific'
    );

    assertEqual(
      terminalGate.glowColor,
      '#00ffff',
      'TERMINAL_GATE has cyan glow color'
    );

    assertEqual(
      terminalGate.lightRadius,
      4,
      'TERMINAL_GATE has light radius of 4'
    );

    assertIncludes(
      terminalGate.requiredKeys.join(','),
      'THUMB_DRIVE',
      'TERMINAL_GATE requires THUMB_DRIVE'
    );

    console.log('\n--- Test 13: Biome Filtering Functions ---');

    // Test getKeysForBiome
    var officeKeys = EnvironmentalSynergy.getKeysForBiome('OFFICE');
    assert(
      Array.isArray(officeKeys),
      'getKeysForBiome returns an array'
    );

    assertIncludes(
      officeKeys.join(','),
      'THUMB_DRIVE',
      'OFFICE biome includes THUMB_DRIVE'
    );

    assertIncludes(
      officeKeys.join(','),
      'RUSTY_KEY',
      'OFFICE biome includes generic keys (RUSTY_KEY has no biome restriction)'
    );

    // Test getGatesForBiome
    var officeGates = EnvironmentalSynergy.getGatesForBiome('OFFICE');
    assert(
      Array.isArray(officeGates),
      'getGatesForBiome returns an array'
    );

    assertIncludes(
      officeGates.join(','),
      'TERMINAL_GATE',
      'OFFICE biome includes TERMINAL_GATE'
    );

    assertIncludes(
      officeGates.join(','),
      'WOODEN_GATE',
      'OFFICE biome includes generic gates (WOODEN_GATE has no biome restriction)'
    );

    console.log('\n--- Test 14: Key-Gate Compatibility (Biome-Specific) ---');

    assert(
      EnvironmentalSynergy.canUnlock('THUMB_DRIVE', 'TERMINAL_GATE'),
      'THUMB_DRIVE can unlock TERMINAL_GATE'
    );

    assert(
      EnvironmentalSynergy.canUnlock('MASTER_KEY', 'TERMINAL_GATE'),
      'MASTER_KEY can unlock TERMINAL_GATE'
    );

    assert(
      !EnvironmentalSynergy.canUnlock('RUSTY_KEY', 'TERMINAL_GATE'),
      'RUSTY_KEY cannot unlock TERMINAL_GATE'
    );

    assert(
      !EnvironmentalSynergy.canUnlock('THUMB_DRIVE', 'WOODEN_GATE'),
      'THUMB_DRIVE cannot unlock WOODEN_GATE'
    );

    console.log('\n--- Test 15: Biome-Specific Keys (AEROSPACE) ---');

    // Test ACCESS_CARD key for AEROSPACE biome
    var accessCard = keyDefs.ACCESS_CARD;
    assert(
      accessCard !== undefined,
      'ACCESS_CARD is defined'
    );

    assertEqual(
      accessCard.itemId,
      'KEY_006',
      'ACCESS_CARD has correct itemId'
    );

    assertEqual(
      accessCard.emoji,
      '🎫',
      'ACCESS_CARD has correct emoji'
    );

    assertEqual(
      accessCard.biome,
      'AEROSPACE',
      'ACCESS_CARD is AEROSPACE biome specific'
    );

    assertEqual(
      accessCard.consumeOnUse,
      false,
      'ACCESS_CARD is reusable (not consumed)'
    );

    assertIncludes(
      accessCard.compatibleGates.join(','),
      'FLOOR_ELEVATOR',
      'ACCESS_CARD compatible with FLOOR_ELEVATOR'
    );

    console.log('\n--- Test 16: Biome-Specific Gates (AEROSPACE) ---');

    // Test FLOOR_ELEVATOR for AEROSPACE biome
    var floorElevator = gateDefs.FLOOR_ELEVATOR;
    assert(
      floorElevator !== undefined,
      'FLOOR_ELEVATOR is defined'
    );

    assertEqual(
      floorElevator.emoji,
      '🛗',
      'FLOOR_ELEVATOR has correct emoji'
    );

    assertEqual(
      floorElevator.biome,
      'AEROSPACE',
      'FLOOR_ELEVATOR is AEROSPACE biome specific'
    );

    assertEqual(
      floorElevator.isElevator,
      true,
      'FLOOR_ELEVATOR has isElevator flag'
    );

    assertIncludes(
      floorElevator.requiredKeys.join(','),
      'ACCESS_CARD',
      'FLOOR_ELEVATOR requires ACCESS_CARD'
    );

    console.log('\n--- Test 17: Key-Gate Compatibility (AEROSPACE) ---');

    assert(
      EnvironmentalSynergy.canUnlock('ACCESS_CARD', 'FLOOR_ELEVATOR'),
      'ACCESS_CARD can unlock FLOOR_ELEVATOR'
    );

    assert(
      EnvironmentalSynergy.canUnlock('MASTER_KEY', 'FLOOR_ELEVATOR'),
      'MASTER_KEY can unlock FLOOR_ELEVATOR'
    );

    assert(
      !EnvironmentalSynergy.canUnlock('KEYCARD', 'FLOOR_ELEVATOR'),
      'KEYCARD cannot unlock FLOOR_ELEVATOR'
    );

    assert(
      !EnvironmentalSynergy.canUnlock('ACCESS_CARD', 'SECURITY_DOOR'),
      'ACCESS_CARD can unlock AEROSPACE_DOOR (should pass if gate exists)'
    );

    console.log('\n========================================');
    console.log('TEST SUMMARY');
    console.log('========================================');
    console.log('Total tests:', tests.total);
    console.log('%cPassed: ' + tests.passed, 'color: green; font-weight: bold');
    console.log('%cFailed: ' + tests.failed, 'color: red; font-weight: bold');

    if (tests.failed === 0) {
      console.log('%c✓ ALL TESTS PASSED', 'color: green; font-size: 16px; font-weight: bold');
    } else {
      console.log('%c✗ SOME TESTS FAILED', 'color: red; font-size: 16px; font-weight: bold');
    }

    return {
      total: tests.total,
      passed: tests.passed,
      failed: tests.failed,
      success: tests.failed === 0
    };
  }

  // Auto-run tests
  if (typeof window !== 'undefined') {
    window.TestEnvironmentalSynergy = runTests;

    // Run on page load if in test mode
    if (document.readyState === 'complete') {
      runTests();
    } else {
      window.addEventListener('load', runTests);
    }
  }

  // Export for Node.js if needed
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runTests: runTests };
  }
})();
