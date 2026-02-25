/**
 * Tutorial Floor Test Suite - Headless Bot Validation
 *
 * Tests:
 * 1. Seed-based deterministic floor generation
 * 2. Locked gate / key mechanics with zone boundaries
 * 3. Picnic blanket food/consumable spawns
 * 4. Bot mining prevention validation
 * 5. Contrived map consistency in portrait mobile layout
 */

(function() {
  'use strict';

  console.log('========================================');
  console.log('TEST: Tutorial Floor Bot Validation');
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

  // ========== TEST 1: Seeded Random Module ==========
  console.log('\n--- Test 1: Seeded Random Number Generator ---');

  assert(
    typeof SeededRandom !== 'undefined',
    'SeededRandom module is available'
  );

  assert(
    typeof SeededRandom.SeededRNG === 'function',
    'SeededRNG constructor exists'
  );

  // Test deterministic generation
  var rng1 = new SeededRandom.SeededRNG(12345);
  var rng2 = new SeededRandom.SeededRNG(12345);

  var val1 = rng1.next();
  var val2 = rng2.next();

  assertEqual(val1, val2, 'Same seed produces same random value');

  var int1 = rng1.nextInt(0, 100);
  var int2 = rng2.nextInt(0, 100);

  assertEqual(int1, int2, 'Same seed produces same random integer');

  // Test seed phrase generation
  var seedPhrase = SeededRandom.generateSeedPhrase(12345);
  assertNotNull(seedPhrase, 'Seed phrase generated');
  assert(
    seedPhrase.indexOf('-') !== -1,
    'Seed phrase contains word separators'
  );
  console.log('Generated seed phrase: ' + seedPhrase);

  // Test seed phrase parsing
  var parsedSeed = SeededRandom.parseSeedPhrase(seedPhrase);
  assertNotNull(parsedSeed, 'Seed phrase can be parsed back');

  // ========== TEST 2: Tutorial Floors Module ==========
  console.log('\n--- Test 2: Tutorial Floors Module ---');

  assert(
    typeof TutorialFloors !== 'undefined',
    'TutorialFloors module is available'
  );

  assert(
    TutorialFloors.isContrivedFloor(1),
    'Floor 1 is a contrived floor'
  );

  assert(
    TutorialFloors.isContrivedFloor(2),
    'Floor 2 is a contrived floor'
  );

  assert(
    TutorialFloors.isContrivedFloor(3),
    'Floor 3 is a contrived floor'
  );

  assert(
    !TutorialFloors.isContrivedFloor(4),
    'Floor 4 is not a contrived floor'
  );

  // ========== TEST 3: Floor 1 Layout - Breakables ==========
  console.log('\n--- Test 3: Floor 1 Layout Validation ---');

  var floor1 = TutorialFloors.getFloorLayout(1);
  assertNotNull(floor1, 'Floor 1 layout exists');
  assertEqual(floor1.floorNumber, 1, 'Floor 1 has correct floor number');
  assertNotNull(floor1.player, 'Floor 1 has player spawn');
  assertNotNull(floor1.exit, 'Floor 1 has exit');

  var floor1Breakables = floor1.breakables || [];
  assert(
    floor1Breakables.length > 0,
    'Floor 1 has breakables (' + floor1Breakables.length + ')'
  );

  // Check for picnic basket
  var picnicBasket = floor1Breakables.find(function(b) {
    return b.name && b.name.toLowerCase().indexOf('picnic') !== -1;
  });
  assertNotNull(picnicBasket, 'Floor 1 has picnic basket breakable');

  if (picnicBasket) {
    assertNotNull(picnicBasket.emoji, 'Picnic basket has emoji');
    assertNotNull(picnicBasket.hp, 'Picnic basket has HP');
    assertNotNull(picnicBasket.drops, 'Picnic basket has drop table');
    console.log('Picnic basket emoji: ' + picnicBasket.emoji);
    console.log('Picnic basket position: (' + picnicBasket.x + ', ' + picnicBasket.y + ')');
  }

  // ========== TEST 4: Floor 2 Layout - Locked Gate & Key ==========
  console.log('\n--- Test 4: Floor 2 Locked Gate & Key Mechanics ---');

  var floor2 = TutorialFloors.getFloorLayout(2);
  assertNotNull(floor2, 'Floor 2 layout exists');

  // Check locked gate
  assertNotNull(floor2.lockedGate, 'Floor 2 has locked gate definition');

  if (floor2.lockedGate) {
    assertNotNull(floor2.lockedGate.positions, 'Locked gate has positions');
    assert(
      floor2.lockedGate.positions.length === 3,
      'Locked gate has 3 barrier tiles'
    );
    assertEqual(floor2.lockedGate.emoji, '🔐', 'Locked gate uses lock emoji');
    assertNotNull(floor2.lockedGate.requiresKey, 'Locked gate requires key');
    console.log('Locked gate requires key: ' + floor2.lockedGate.requiresKey);
  }

  // Check key breakable
  assertNotNull(floor2.keyBreakable, 'Floor 2 has key breakable');

  if (floor2.keyBreakable) {
    assertNotNull(floor2.keyBreakable.drops, 'Key breakable has drops');
    assertNotNull(floor2.keyBreakable.drops.item, 'Key breakable drops an item');
    assertEqual(
      floor2.keyBreakable.drops.item,
      'rusty_key',
      'Key breakable drops rusty_key'
    );
    console.log('Key breakable emoji: ' + floor2.keyBreakable.emoji);
    console.log('Key location: (' + floor2.keyBreakable.x + ', ' + floor2.keyBreakable.y + ')');
  }

  // Check for picnic basket in Floor 2
  var floor2Breakables = floor2.breakables || [];
  var floor2Picnic = floor2Breakables.find(function(b) {
    return b.name && b.name.toLowerCase().indexOf('picnic') !== -1;
  });

  if (floor2Picnic) {
    console.log('Floor 2 also has picnic basket at (' + floor2Picnic.x + ', ' + floor2Picnic.y + ')');
  }

  // ========== TEST 5: Floor 3 Layout - Combat Enemies ==========
  console.log('\n--- Test 5: Floor 3 Combat Layout Validation ---');

  var floor3 = TutorialFloors.getFloorLayout(3);
  assertNotNull(floor3, 'Floor 3 layout exists');

  var floor3Enemies = floor3.enemies || [];
  assert(
    floor3Enemies.length === 3,
    'Floor 3 has exactly 3 enemies'
  );

  if (floor3Enemies.length > 0) {
    console.log('Floor 3 enemies:');
    floor3Enemies.forEach(function(enemy) {
      console.log('  - ' + enemy.emoji + ' ' + enemy.name + ' at (' + enemy.x + ', ' + enemy.y + ')');
      console.log('    HP: ' + enemy.hp + ', Sight: ' + enemy.sightRange + ', Patrol: ' + enemy.patrolType);
    });
  }

  // Check for low-threat enemies
  var allEnemiesWeak = floor3Enemies.every(function(enemy) {
    return enemy.hp <= 3 && enemy.attack <= 2 && enemy.sightRange <= 3;
  });
  assert(allEnemiesWeak, 'All Floor 3 enemies are weak (low HP, attack, sight range)');

  // ========== TEST 6: Picnic Blanket Food Spawn System ==========
  console.log('\n--- Test 6: Picnic Blanket Food Spawn Validation ---');

  // This test validates that picnic basket breakables are set up correctly
  // for spawning food/consumable items

  var allPicnicBaskets = [
    { floor: 1, breakable: picnicBasket },
    { floor: 2, breakable: floor2Picnic }
  ].filter(function(item) { return item.breakable; });

  assert(
    allPicnicBaskets.length >= 1,
    'At least one picnic basket exists across tutorial floors'
  );

  allPicnicBaskets.forEach(function(item) {
    console.log('Floor ' + item.floor + ' picnic basket:');
    console.log('  Position: (' + item.breakable.x + ', ' + item.breakable.y + ')');
    console.log('  Emoji: ' + item.breakable.emoji);
    console.log('  HP: ' + item.breakable.hp);

    if (item.breakable.drops) {
      console.log('  Drops: ', item.breakable.drops);
    }
  });

  // Validate drop structure supports consumables
  assert(
    allPicnicBaskets.every(function(item) {
      return item.breakable.drops && (
        item.breakable.drops.currency ||
        item.breakable.drops.cards !== undefined ||
        item.breakable.drops.item
      );
    }),
    'All picnic baskets have valid drop tables'
  );

  // ========== TEST 7: Zone Boundary Rules ==========
  console.log('\n--- Test 7: Zone Boundary Rules for Key/Gate ---');

  // Test that zone boundaries would prevent exploits
  if (typeof CardZoneManager !== 'undefined') {
    assert(
      typeof CardZoneManager.canMoveCard === 'function',
      'CardZoneManager.canMoveCard exists'
    );

    // Test that equipment items (like keys) must respect zone rules
    CardZoneManager.setContext(CardZoneManager.CONTEXTS.BONFIRE);

    var inventoryToActiveResult = CardZoneManager.canMoveCard(
      CardZoneManager.ZONES.INVENTORY,
      CardZoneManager.ZONES.ACTIVE_ITEM
    );

    assert(
      inventoryToActiveResult.allowed,
      'Can equip key from inventory at bonfire (zone rule check)'
    );

    console.log('Zone boundary rules validated for key mechanics');
  } else {
    console.warn('CardZoneManager not available - skipping zone boundary tests');
  }

  // ========== TEST 8: Seed-Based Determinism ==========
  console.log('\n--- Test 8: Seed-Based Deterministic Generation ---');

  // Test that the same seed produces the same layout
  var testSeed = 999;
  var rngA = new SeededRandom.SeededRNG(testSeed);
  var rngB = new SeededRandom.SeededRNG(testSeed);

  var sequenceA = [];
  var sequenceB = [];

  for (var i = 0; i < 10; i++) {
    sequenceA.push(rngA.nextInt(0, 100));
    sequenceB.push(rngB.nextInt(0, 100));
  }

  var sequencesMatch = sequenceA.every(function(val, idx) {
    return val === sequenceB[idx];
  });

  assert(sequencesMatch, 'Same seed produces identical random sequences');

  console.log('Seed ' + testSeed + ' sequences match: ', sequencesMatch);
  console.log('Sequence sample: [' + sequenceA.slice(0, 5).join(', ') + ']');

  // ========== TEST 9: Bot Mining Prevention ==========
  console.log('\n--- Test 9: Bot Mining Prevention Measures ---');

  // Document bot mining prevention measures
  console.log('Bot mining prevention measures:');
  console.log('1. Picnic baskets have limited HP (must be broken, not farmed)');
  console.log('2. Breakables do not respawn within a floor');
  console.log('3. Drop rates are probabilistic (cards: 30-50%)');
  console.log('4. Currency drops are capped per breakable');
  console.log('5. Tutorial floors are single-run (no retry without full game reset)');

  // Validate that breakables cannot be infinitely farmed
  if (floor1Breakables.length > 0) {
    var avgHP = floor1Breakables.reduce(function(sum, b) {
      return sum + (b.hp || 0);
    }, 0) / floor1Breakables.length;

    assert(
      avgHP >= 1 && avgHP <= 3,
      'Breakables have reasonable HP (avg: ' + avgHP.toFixed(1) + ') preventing instant farming'
    );
  }

  // ========== TEST 10: Map Consistency Validation ==========
  console.log('\n--- Test 10: Contrived Map Consistency ---');

  // Validate that contrived maps have consistent dimensions
  [floor1, floor2, floor3].forEach(function(floor) {
    if (!floor) return;

    console.log('Floor ' + floor.floorNumber + ' consistency:');

    // Check player spawn is within bounds
    if (floor.player) {
      assert(
        floor.player.x >= 0 && floor.player.x < 40,
        'Floor ' + floor.floorNumber + ' player X within bounds'
      );
      assert(
        floor.player.y >= 0 && floor.player.y < 20,
        'Floor ' + floor.floorNumber + ' player Y within bounds'
      );
    }

    // Check exit is within bounds
    if (floor.exit) {
      assert(
        floor.exit.x >= 0 && floor.exit.x < 40,
        'Floor ' + floor.floorNumber + ' exit X within bounds'
      );
      assert(
        floor.exit.y >= 0 && floor.exit.y < 20,
        'Floor ' + floor.floorNumber + ' exit Y within bounds'
      );
    }

    // Check all breakables are within bounds
    var breakables = floor.breakables || [];
    var allBreakablesInBounds = breakables.every(function(b) {
      return b.x >= 1 && b.x < 39 && b.y >= 1 && b.y < 19;
    });
    assert(
      allBreakablesInBounds,
      'Floor ' + floor.floorNumber + ' all breakables within safe zone'
    );

    // Check all enemies are within bounds
    var enemies = floor.enemies || [];
    var allEnemiesInBounds = enemies.every(function(e) {
      return e.x >= 1 && e.x < 39 && e.y >= 1 && e.y < 19;
    });
    assert(
      allEnemiesInBounds,
      'Floor ' + floor.floorNumber + ' all enemies within safe zone'
    );
  });

  // ========== TEST: Interior Floors Module ==========
  console.log('\n--- Test: Interior Floors Module ---');

  assert(
    typeof InteriorFloors !== 'undefined',
    'InteriorFloors module is available'
  );

  if (typeof InteriorFloors !== 'undefined') {
    assert(
      InteriorFloors.isInteriorFloor('1.2') === true,
      'isInteriorFloor("1.2") returns true'
    );
    assert(
      InteriorFloors.isInteriorFloor('1') === false,
      'isInteriorFloor("1") returns false'
    );
    assertEqual(
      InteriorFloors.getParentFloorId('1.2.1'), '1.2',
      'getParentFloorId("1.2.1") returns "1.2"'
    );
    assert(
      InteriorFloors.getParentFloorId('1') === null,
      'getParentFloorId("1") returns null'
    );

    var churchLayout = InteriorFloors.getAuthoredLayout('1.2');
    assert(
      churchLayout !== null,
      'Church interior layout (1.2) is registered'
    );
    if (churchLayout) {
      assert(
        churchLayout.name === 'Church Interior',
        'Church layout name is correct'
      );
      assert(
        churchLayout.npcs && churchLayout.npcs.length > 0,
        'Church has NPCs (priest)'
      );
      assert(
        churchLayout.buildingDoors && churchLayout.buildingDoors.length > 0,
        'Church has building doors (catacombs entrance)'
      );
    }

    assert(
      InteriorFloors.hasGenerator('catacombs') === true,
      'Catacombs generator is registered'
    );
  }

  // ========== TEST: Catacombs Generator ==========
  console.log('\n--- Test: Catacombs Generator ---');

  assert(
    typeof CatacombsGenerator !== 'undefined',
    'CatacombsGenerator module is available'
  );

  if (typeof CatacombsGenerator !== 'undefined') {
    var catResult = CatacombsGenerator.generate({ seed: 42 });
    assertNotNull(catResult, 'Catacombs generate() returns result');
    assert(catResult.grid.length === 20, 'Grid has 20 rows');
    assert(catResult.grid[0].length === 40, 'Grid has 40 columns');
    assertNotNull(catResult.spawns.player, 'Has player spawn');
    assertNotNull(catResult.exits.back, 'Has back exit');
    assert(catResult.enemies.length > 0, 'Has enemies');
    assert(catResult.breakables.length > 0, 'Has breakables');
    assert(
      catResult.grid[catResult.spawns.player.y][catResult.spawns.player.x] === '.',
      'Player spawn is on empty tile'
    );

    var catResult2 = CatacombsGenerator.generate({ seed: 42 });
    assert(
      catResult.spawns.player.x === catResult2.spawns.player.x,
      'Same seed produces deterministic output'
    );
  }

  // ========== TEST: Building Doors in Floor 1 ==========
  console.log('\n--- Test: Building Doors ---');

  if (typeof TutorialFloors !== 'undefined') {
    var f1Layout = TutorialFloors.FLOOR_1_LAYOUT;
    assert(
      f1Layout.buildingDoors && f1Layout.buildingDoors.length > 0,
      'Floor 1 has building doors'
    );
    if (f1Layout.buildingDoors) {
      assert(
        f1Layout.buildingDoors[0].buildingId === 'BLD-002',
        'Church door references BLD-002'
      );
    }

    var f1Data = TutorialFloors.generateContrivedFloor(f1Layout);
    assert(
      f1Data.buildingDoors && f1Data.buildingDoors.length > 0,
      'generateContrivedFloor includes buildingDoors'
    );
  }

  // ========== TEST: GoneRogue Interior API ==========
  console.log('\n--- Test: GoneRogue Interior API ---');

  if (typeof GoneRogue !== 'undefined') {
    assert(typeof GoneRogue.getFloorId === 'function', 'getFloorId() exists');
    assert(typeof GoneRogue.getFloorNav === 'function', 'getFloorNav() exists');
    assert(typeof GoneRogue.getTileMetadata === 'function', 'getTileMetadata() exists');
    assert(typeof GoneRogue.isInInterior === 'function', 'isInInterior() exists');
  }

    // ========== TEST SUMMARY ==========
  console.log('\n========================================');
  console.log('TEST SUMMARY');
  console.log('========================================');
  console.log('Total:  ' + tests.total);
  console.log('%cPassed: ' + tests.passed, 'color: green; font-weight: bold');
  console.log('%cFailed: ' + tests.failed, 'color: red; font-weight: bold');
  console.log('========================================\n');

  if (tests.failed === 0) {
    console.log('%c✓ ALL TESTS PASSED', 'color: green; font-weight: bold; font-size: 16px');
  } else {
    console.error('%c✗ SOME TESTS FAILED', 'color: red; font-weight: bold; font-size: 16px');
  }

  // ========== EXPORT TEST RESULTS ==========
  window.TUTORIAL_FLOOR_TEST_RESULTS = {
    timestamp: new Date().toISOString(),
    total: tests.total,
    passed: tests.passed,
    failed: tests.failed,
    success: tests.failed === 0,
    floors: {
      floor1: floor1,
      floor2: floor2,
      floor3: floor3
    }
  };

  console.log('\nTest results exported to: window.TUTORIAL_FLOOR_TEST_RESULTS');
})();
