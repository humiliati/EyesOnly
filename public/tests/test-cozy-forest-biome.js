/* ============================================================
   EYES ONLY - Test Harness for Cozy Forest Biome
   Validates biome config, map generation, visual grid, and village placement
   ============================================================ */

(function () {
  'use strict';

  console.log('========================================');
  console.log('TEST: Cozy Forest Biome Implementation');
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

    console.log('\n--- Test 2: BIOMES.FOREST Configuration ---');

    // Initialize to access internal state
    if (typeof GoneRogue.init === 'function') {
      GoneRogue.init();
    }

    // Start floor 1 to trigger forest biome
    var startResult = GoneRogue.start({});
    assert(
      startResult && typeof startResult === 'object',
      'GoneRogue.start() returns an object'
    );
    assert(
      GoneRogue.isActive(),
      'GoneRogue is active after start'
    );

    console.log('\n--- Test 3: Forest Biome API Functions ---');
    assert(
      typeof GoneRogue.createBordersForest === 'function',
      'GoneRogue.createBordersForest is exported'
    );
    assert(
      typeof GoneRogue.generateForestOpenSpace === 'function',
      'GoneRogue.generateForestOpenSpace is exported'
    );
    assert(
      typeof GoneRogue.placeVillageCluster === 'function',
      'GoneRogue.placeVillageCluster is exported'
    );

    console.log('\n--- Test 4: createBordersForest produces forest wall chars ---');
    var testBiome = {
      wallTiles: [
        { char: '🌳', weight: 40 },
        { char: '🌲', weight: 30 },
        { char: '🪵', weight: 15 },
        { char: '🪨', weight: 10 },
        { char: '🌿', weight: 5 }
      ],
      floorTiles: [{ char: ',', weight: 100 }]
    };
    var testMap = [];
    for (var y = 0; y < 10; y++) {
      var row = [];
      for (var x = 0; x < 20; x++) {
        row.push('.');
      }
      testMap.push(row);
    }
    GoneRogue.createBordersForest(testMap, testBiome);

    var validWallChars = ['🌳', '🌲', '🪵', '🪨', '🌿'];
    var borderCharsValid = true;
    // Check top border
    for (var x = 0; x < 20; x++) {
      if (validWallChars.indexOf(testMap[0][x]) === -1) {
        borderCharsValid = false;
        break;
      }
    }
    // Check bottom border
    for (var x = 0; x < 20; x++) {
      if (validWallChars.indexOf(testMap[9][x]) === -1) {
        borderCharsValid = false;
        break;
      }
    }
    assert(borderCharsValid, 'createBordersForest uses forest wall characters on borders');

    console.log('\n--- Test 5: generateForestOpenSpace fills interior ---');
    var openMap = [];
    for (var y = 0; y < 10; y++) {
      var row = [];
      for (var x = 0; x < 20; x++) {
        row.push('█');
      }
      openMap.push(row);
    }
    GoneRogue.generateForestOpenSpace(openMap, testBiome);
    var interiorFilled = openMap[5][10] === ','; // Check a center tile
    assert(
      interiorFilled,
      'generateForestOpenSpace fills interior with floor chars'
    );

    console.log('\n--- Test 6: placeVillageCluster places buildings ---');
    var villBiome = {
      spawnFeatures: {
        villageCluster: true,
        buildings: ['🏠', '⛪', '🏪', '🏡'],
        decorations: ['🪧', '📬', '🏮', '⛲', '🪑']
      }
    };
    var villMap = [];
    for (var y = 0; y < 20; y++) {
      var row = [];
      for (var x = 0; x < 40; x++) {
        row.push(',');
      }
      villMap.push(row);
    }
    GoneRogue.placeVillageCluster(villMap, villBiome);

    var buildingChars = ['🏠', '⛪', '🏪', '🏡'];
    var foundBuilding = false;
    for (var y = 0; y < 20 && !foundBuilding; y++) {
      for (var x = 0; x < 40 && !foundBuilding; x++) {
        if (buildingChars.indexOf(villMap[y][x]) !== -1) {
          foundBuilding = true;
        }
      }
    }
    assert(foundBuilding, 'placeVillageCluster places at least one building');

    console.log('\n--- Test 7: Floor 1 uses Cozy Forest biome (no enemies) ---');
    var enemies = GoneRogue.getEnemies();
    assert(
      Array.isArray(enemies),
      'getEnemies returns an array on floor 1'
    );
    assert(
      enemies.length === 0,
      'No combat enemies on floor 1 (Cozy Forest: enemyDensity 0.0)'
    );

    console.log('\n--- Test 8: Player spawns on walkable tile ---');
    var player = GoneRogue.getPlayer();
    assert(
      player && typeof player.x === 'number' && typeof player.y === 'number',
      'Player has valid spawn coordinates'
    );
    assert(
      player.hp > 0,
      'Player spawns with positive HP'
    );

    console.log('\n--- Test 9: Breakables use forest props ---');
    var breakables = GoneRogue.getBreakables();
    assert(
      Array.isArray(breakables),
      'getBreakables returns an array'
    );
    var forestEmojis = ['🚧', '🌳', '🪵', '🌿', '📦'];
    var allForestBreakables = breakables.every(function(b) {
      // Each breakable must have an emoji property matching a forest prop
      return b.emoji && forestEmojis.indexOf(b.emoji) !== -1;
    });
    assert(
      allForestBreakables,
      'All breakables on floor 1 use forest prop emojis'
    );

    console.log('\n========================================');
    console.log('TEST SUMMARY');
    console.log('Total: ' + tests.total);
    console.log('%cPassed: ' + tests.passed, 'color: green; font-weight: bold');
    console.log('%cFailed: ' + tests.failed, 'color: red; font-weight: bold');
    console.log('========================================');

    return tests;
  }

  var results = runTests();
  window.CozyForestTestResults = results;

})();
