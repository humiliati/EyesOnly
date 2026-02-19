/* ============================================================
   EYES ONLY - Loot Table Manager Test Suite
   Validates loot generation, drop rates, and table management
   ============================================================ */

(function () {
  'use strict';

  console.log('========================================');
  console.log('TEST: Loot Table Manager System');
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

  function assertRange(value, min, max, message) {
    tests.total++;
    if (value >= min && value <= max) {
      tests.passed++;
      console.log('%c✓ PASS: ' + message + ' (' + value + ' in range [' + min + ', ' + max + '])', 'color: green; font-weight: bold');
      return true;
    } else {
      tests.failed++;
      console.error('%c✗ FAIL: ' + message + ' (' + value + ' not in range [' + min + ', ' + max + '])', 'color: red; font-weight: bold');
      return false;
    }
  }

  async function runTests() {
    console.log('\n--- Test 1: Module Loading ---');

    assert(
      typeof LootTableManager !== 'undefined',
      'LootTableManager module is loaded'
    );

    console.log('\n--- Test 2: Load Loot Tables ---');

    await LootTableManager.loadLootTables();
    var tables = LootTableManager.getLootTables();

    assert(
      tables !== null && typeof tables === 'object',
      'Loot tables loaded successfully'
    );

    assert(
      tables.version !== undefined,
      'Loot tables have version field'
    );

    assert(
      tables.enemy_loot !== undefined,
      'Enemy loot section exists'
    );

    assert(
      tables.breakable_loot !== undefined,
      'Breakable loot section exists'
    );

    assert(
      tables.item_loot_tables !== undefined,
      'Item loot tables section exists'
    );

    console.log('\n--- Test 3: Validate Enemy Loot Structure ---');

    assert(
      tables.enemy_loot.standard !== undefined,
      'Standard enemy tier exists'
    );

    assert(
      tables.enemy_loot.elite !== undefined,
      'Elite enemy tier exists'
    );

    assert(
      tables.enemy_loot.boss !== undefined,
      'Boss enemy tier exists'
    );

    assert(
      tables.enemy_loot.scout !== undefined,
      'Scout enemy tier exists'
    );

    // Validate standard enemy structure
    var standardEnemy = tables.enemy_loot.standard;
    assert(
      standardEnemy.currency !== undefined,
      'Standard enemy has currency config'
    );

    assert(
      standardEnemy.card !== undefined,
      'Standard enemy has card config'
    );

    assert(
      standardEnemy.xp !== undefined,
      'Standard enemy has XP value'
    );

    console.log('\n--- Test 4: Roll Enemy Loot ---');

    // Roll standard enemy loot
    var standardLoot = LootTableManager.rollEnemyLoot('standard', { source: 'player' });

    assert(
      standardLoot !== null && typeof standardLoot === 'object',
      'Standard enemy loot rolled successfully'
    );

    assert(
      'currency' in standardLoot,
      'Standard loot has currency field'
    );

    assert(
      Array.isArray(standardLoot.cards),
      'Standard loot has cards array'
    );

    assert(
      Array.isArray(standardLoot.items),
      'Standard loot has items array'
    );

    assert(
      typeof standardLoot.xp === 'number',
      'Standard loot has XP value'
    );

    assertEqual(
      standardLoot.xp,
      10,
      'Standard enemy XP is 10'
    );

    // Roll elite enemy loot
    var eliteLoot = LootTableManager.rollEnemyLoot('elite', { source: 'player' });

    assert(
      eliteLoot !== null,
      'Elite enemy loot rolled successfully'
    );

    assertRange(
      eliteLoot.currency,
      0,
      25,
      'Elite currency in valid range'
    );

    assertEqual(
      eliteLoot.xp,
      30,
      'Elite enemy XP is 30'
    );

    // Roll boss loot
    var bossLoot = LootTableManager.rollEnemyLoot('boss', { source: 'player', mythicKill: false });

    assert(
      bossLoot !== null,
      'Boss loot rolled successfully'
    );

    assertRange(
      bossLoot.currency,
      50,
      100,
      'Boss currency in valid range'
    );

    assertEqual(
      bossLoot.xp,
      100,
      'Boss XP is 100'
    );

    assert(
      bossLoot.cards.length >= 1,
      'Boss drops at least one card'
    );

    // Roll boss loot with mythic kill
    var mythicBossLoot = LootTableManager.rollEnemyLoot('boss', { source: 'player', mythicKill: true });

    assert(
      mythicBossLoot.cards.some(card => card.mythic === true),
      'Mythic boss kill drops mythic synergy card'
    );

    console.log('\n--- Test 5: Currency Drop Distribution ---');

    // Test currency distribution over multiple rolls
    var currencyRolls = [];
    for (var i = 0; i < 100; i++) {
      var loot = LootTableManager.rollEnemyLoot('standard', { source: 'player' });
      currencyRolls.push(loot.currency);
    }

    var avgCurrency = currencyRolls.reduce((a, b) => a + b, 0) / currencyRolls.length;
    var minCurrency = Math.min(...currencyRolls);
    var maxCurrency = Math.max(...currencyRolls);

    assert(
      minCurrency >= 0 && maxCurrency <= 8,
      'Standard enemy currency in expected range [0-8] (min: ' + minCurrency + ', max: ' + maxCurrency + ')'
    );

    assert(
      avgCurrency >= 2 && avgCurrency <= 8,
      'Standard enemy average currency reasonable (avg: ' + avgCurrency.toFixed(2) + ')'
    );

    console.log('\n--- Test 6: Card Drop Rates ---');

    // Test card drop rate for standard enemies
    var cardDrops = 0;
    var totalRolls = 1000;

    for (var j = 0; j < totalRolls; j++) {
      var loot = LootTableManager.rollEnemyLoot('standard', { source: 'player' });
      if (loot.cards.length > 0) {
        cardDrops++;
      }
    }

    var cardDropRate = cardDrops / totalRolls;
    console.log('  Standard enemy card drop rate: ' + (cardDropRate * 100).toFixed(1) + '%');

    assert(
      cardDropRate >= 0.40 && cardDropRate <= 0.60,
      'Standard enemy card drop rate ~50% (actual: ' + (cardDropRate * 100).toFixed(1) + '%)'
    );

    console.log('\n--- Test 7: Breakable Loot ---');

    assert(
      tables.breakable_loot.default !== undefined,
      'Default breakable config exists'
    );

    assert(
      tables.breakable_loot.biomes !== undefined,
      'Breakable biomes config exists'
    );

    // Roll breakable loot
    var breakableLoot = LootTableManager.rollBreakableLoot('wooden_gate', 'COZY_FOREST');

    assert(
      breakableLoot !== null && typeof breakableLoot === 'object',
      'Breakable loot rolled successfully'
    );

    assert(
      'currency' in breakableLoot,
      'Breakable loot has currency field'
    );

    assert(
      'ammo' in breakableLoot,
      'Breakable loot has ammo field'
    );

    assert(
      Array.isArray(breakableLoot.items),
      'Breakable loot has items array'
    );

    console.log('\n--- Test 8: Item Loot Tables ---');

    assert(
      tables.item_loot_tables.toy_loot !== undefined,
      'Toy loot table exists'
    );

    assert(
      tables.item_loot_tables.office_loot !== undefined,
      'Office loot table exists'
    );

    // Roll from item table
    var toyItem = LootTableManager.rollFromItemTable('toy_loot');

    assert(
      toyItem !== null && typeof toyItem === 'object',
      'Item rolled from toy loot table'
    );

    assert(
      'name' in toyItem,
      'Rolled item has name'
    );

    assert(
      'emoji' in toyItem,
      'Rolled item has emoji'
    );

    assert(
      'quantity' in toyItem,
      'Rolled item has quantity'
    );

    console.log('\n--- Test 9: Card Drop Modifiers ---');

    var modifier1 = LootTableManager.getCardDropModifier('Silent Shot', 'GREY_CAVE', 5);

    assert(
      typeof modifier1 === 'number',
      'Card drop modifier returns a number'
    );

    assert(
      modifier1 >= 1.0,
      'Silent Shot in Grey Cave has increased drop rate (modifier: ' + modifier1 + ')'
    );

    // Test floor scaling
    var earlyFloorModifier = LootTableManager.getCardDropModifier('Single Shot', 'COZY_FOREST', 3);
    var lateFloorModifier = LootTableManager.getCardDropModifier('Single Shot', 'COZY_FOREST', 20);

    assert(
      earlyFloorModifier >= lateFloorModifier,
      'Basic cards more common on early floors'
    );

    console.log('\n--- Test 10: Decay Times ---');

    var currencyDecay = LootTableManager.getDecayTime('currency');
    var cardDecay = LootTableManager.getDecayTime('card');

    assertEqual(
      currencyDecay,
      20,
      'Currency decay time is 20 seconds'
    );

    assertEqual(
      cardDecay,
      30,
      'Card decay time is 30 seconds'
    );

    console.log('\n--- Test 11: Economy Settings ---');

    var economy = LootTableManager.getEconomySettings();

    assert(
      economy !== null && typeof economy === 'object',
      'Economy settings retrieved'
    );

    assert(
      'shop_spawn_chance' in economy,
      'Economy has shop spawn chance'
    );

    assert(
      'price_markup' in economy,
      'Economy has price markup'
    );

    console.log('\n--- Test 12: Validation ---');

    var validation = LootTableManager.validateLootTables(tables);

    assert(
      validation !== null && typeof validation === 'object',
      'Validation returns result object'
    );

    assert(
      'valid' in validation,
      'Validation has valid field'
    );

    assert(
      Array.isArray(validation.errors),
      'Validation has errors array'
    );

    assert(
      validation.valid === true,
      'Loaded loot tables are valid'
    );

    console.log('\n--- Test 13: Export/Import ---');

    var exportedJSON = LootTableManager.exportLootTables();

    assert(
      typeof exportedJSON === 'string',
      'Export returns JSON string'
    );

    assert(
      exportedJSON.length > 0,
      'Exported JSON is not empty'
    );

    // Test import
    var importResult = LootTableManager.importLootTables(exportedJSON);

    assert(
      importResult.success === true,
      'Import of exported JSON succeeds'
    );

    // Test invalid JSON import
    var invalidImport = LootTableManager.importLootTables('{ invalid json }');

    assert(
      invalidImport.success === false,
      'Import of invalid JSON fails gracefully'
    );

    console.log('\n--- Test 14: Loot Distribution Analysis ---');

    // Analyze loot distribution over 10000 rolls
    var distributionTest = {
      standardCurrency: [],
      eliteCurrency: [],
      bossCurrency: [],
      cardDrops: 0,
      charmDrops: 0
    };

    for (var k = 0; k < 10000; k++) {
      var stdLoot = LootTableManager.rollEnemyLoot('standard', { source: 'player' });
      distributionTest.standardCurrency.push(stdLoot.currency);

      if (stdLoot.cards.length > 0) distributionTest.cardDrops++;
      if (stdLoot.items.some(item => item.type === 'charm')) distributionTest.charmDrops++;
    }

    var avgStdCurrency = distributionTest.standardCurrency.reduce((a, b) => a + b, 0) / 10000;
    var cardDropPercentage = (distributionTest.cardDrops / 10000) * 100;
    var charmDropPercentage = (distributionTest.charmDrops / 10000) * 100;

    console.log('  Average standard currency: ' + avgStdCurrency.toFixed(2) + '¢');
    console.log('  Card drop rate: ' + cardDropPercentage.toFixed(1) + '%');
    console.log('  Charm drop rate: ' + charmDropPercentage.toFixed(1) + '%');

    assert(
      cardDropPercentage >= 45 && cardDropPercentage <= 55,
      'Card drop rate converges to ~50% over large sample'
    );

    assert(
      charmDropPercentage >= 25 && charmDropPercentage <= 35,
      'Charm drop rate converges to ~30% over large sample'
    );

    console.log('\n========================================');
    console.log('TEST SUMMARY');
    console.log('========================================');
    console.log('Total tests: ' + tests.total);
    console.log('Passed: %c' + tests.passed, 'color: green; font-weight: bold');
    console.log('Failed: %c' + tests.failed, 'color: red; font-weight: bold');
    console.log('Success rate: ' + ((tests.passed / tests.total) * 100).toFixed(1) + '%');
    console.log('========================================\n');

    if (tests.failed === 0) {
      console.log('%c🎉 ALL TESTS PASSED! 🎉', 'color: green; font-weight: bold; font-size: 16px;');
    } else {
      console.log('%c⚠️ SOME TESTS FAILED ⚠️', 'color: red; font-weight: bold; font-size: 16px;');
    }
  }

  // Run tests when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runTests);
  } else {
    // DOM already loaded, run tests after a short delay to ensure all modules are loaded
    setTimeout(runTests, 500);
  }

})();
