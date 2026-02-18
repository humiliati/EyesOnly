/* ============================================================
   EYES ONLY - Test Harness for Death System
   Validates health management, death handling, and highscore integration
   ============================================================ */

(function () {
  'use strict';

  console.log('========================================');
  console.log('TEST: Death System & Health Management');
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

  function assertGreaterThan(actual, expected, message) {
    return assert(actual > expected, message + ' (expected > ' + expected + ', got: ' + actual + ')');
  }

  function runTests() {
    // ========== TEST 1: Module Availability ==========
    console.log('\n--- Test 1: Module Availability ---');

    assert(
      typeof HealthSystem !== 'undefined',
      'HealthSystem module is available'
    );

    assert(
      typeof DeathHandler !== 'undefined',
      'DeathHandler module is available'
    );

    // ========== TEST 2: HealthSystem - Create Health State ==========
    console.log('\n--- Test 2: HealthSystem - Create Health State ---');

    var healthState = HealthSystem.createHealthState(100);
    assertNotNull(healthState, 'createHealthState returns an object');
    assertEqual(healthState.currentHP, 100, 'Initial HP equals maxHP');
    assertEqual(healthState.maxHP, 100, 'maxHP is set correctly');
    assertEqual(healthState.tempHP, 0, 'Initial temp HP is 0');
    assertEqual(healthState.isDead, false, 'Initial isDead is false');

    // ========== TEST 3: HealthSystem - Apply Damage ==========
    console.log('\n--- Test 3: HealthSystem - Apply Damage ---');

    var hs1 = HealthSystem.createHealthState(100);
    var damageResult = HealthSystem.applyDamage(hs1, 30);

    assertEqual(damageResult.actualDamage, 30, 'Damage amount is correct');
    assertEqual(damageResult.realHPLost, 30, 'Real HP lost is correct');
    assertEqual(hs1.currentHP, 70, 'HP reduced correctly');
    assertEqual(damageResult.killed, false, 'Not killed by partial damage');

    // ========== TEST 4: HealthSystem - Lethal Damage ==========
    console.log('\n--- Test 4: HealthSystem - Lethal Damage ---');

    var hs2 = HealthSystem.createHealthState(50);
    var lethalResult = HealthSystem.applyDamage(hs2, 100);

    assertEqual(lethalResult.killed, true, 'Killed by lethal damage');
    assertEqual(hs2.isDead, true, 'isDead flag set');
    assertEqual(hs2.currentHP, 0, 'HP set to 0');
    assertGreaterThan(lethalResult.overkill, 0, 'Overkill calculated');

    // ========== TEST 5: HealthSystem - Temp HP ==========
    console.log('\n--- Test 5: HealthSystem - Temp HP ---');

    var hs3 = HealthSystem.createHealthState(100);
    HealthSystem.addTempHP(hs3, 25);
    assertEqual(hs3.tempHP, 25, 'Temp HP added');

    var damageWithTemp = HealthSystem.applyDamage(hs3, 30);
    assertEqual(damageWithTemp.tempHPLost, 25, 'Temp HP absorbed first');
    assertEqual(damageWithTemp.realHPLost, 5, 'Remaining damage to real HP');
    assertEqual(hs3.currentHP, 95, 'HP reduced by overflow');
    assertEqual(hs3.tempHP, 0, 'Temp HP depleted');

    // ========== TEST 6: HealthSystem - Damage Reduction ==========
    console.log('\n--- Test 6: HealthSystem - Damage Reduction ---');

    var hs4 = HealthSystem.createHealthState(100);
    HealthSystem.setDamageReduction(hs4, 10, 0); // 10 flat reduction

    var reducedDamage = HealthSystem.applyDamage(hs4, 30);
    assertEqual(reducedDamage.actualDamage, 20, 'Flat reduction applied (30 - 10 = 20)');
    assertEqual(hs4.currentHP, 80, 'HP reduced by reduced damage');

    // ========== TEST 7: HealthSystem - Percentage Reduction ==========
    console.log('\n--- Test 7: HealthSystem - Percentage Reduction ---');

    var hs5 = HealthSystem.createHealthState(100);
    HealthSystem.setDamageReduction(hs5, 0, 50); // 50% reduction

    var percentReduced = HealthSystem.applyDamage(hs5, 100);
    assertEqual(percentReduced.actualDamage, 50, 'Percentage reduction applied (100 * 0.5 = 50)');

    // ========== TEST 8: HealthSystem - Healing ==========
    console.log('\n--- Test 8: HealthSystem - Healing ---');

    var hs6 = HealthSystem.createHealthState(100);
    HealthSystem.applyDamage(hs6, 50);
    assertEqual(hs6.currentHP, 50, 'HP at 50 after damage');

    var healResult = HealthSystem.heal(hs6, 30);
    assertEqual(healResult.actualHeal, 30, 'Healed 30 HP');
    assertEqual(hs6.currentHP, 80, 'HP restored to 80');

    // Test overheal prevention
    var overhealResult = HealthSystem.heal(hs6, 50);
    assertEqual(overhealResult.actualHeal, 20, 'Only healed to max HP');
    assertEqual(overhealResult.overheal, 30, 'Overheal amount calculated');
    assertEqual(hs6.currentHP, 100, 'HP capped at maxHP');

    // ========== TEST 9: HealthSystem - Cannot Heal Dead ==========
    console.log('\n--- Test 9: HealthSystem - Cannot Heal Dead ---');

    var hs7 = HealthSystem.createHealthState(50);
    HealthSystem.markDead(hs7, 'test');
    var deadHealResult = HealthSystem.heal(hs7, 50);
    assertEqual(deadHealResult.actualHeal, 0, 'Cannot heal dead entity');
    assertEqual(hs7.currentHP, 0, 'HP remains 0');

    // ========== TEST 10: HealthSystem - Revive ==========
    console.log('\n--- Test 10: HealthSystem - Revive ---');

    var hs8 = HealthSystem.createHealthState(100);
    HealthSystem.markDead(hs8, 'test');
    assertEqual(hs8.isDead, true, 'Marked as dead');

    HealthSystem.revive(hs8, 50);
    assertEqual(hs8.isDead, false, 'Revived');
    assertEqual(hs8.currentHP, 50, 'HP set to revival amount');

    // ========== TEST 11: DeathHandler - Player Death ==========
    console.log('\n--- Test 11: DeathHandler - Player Death ---');

    DeathHandler.resetStats();
    var player = { hp: 0, maxHp: 100, x: 5, y: 5 };
    var playerDeathResult = DeathHandler.handlePlayerDeath(
      player,
      DeathHandler.DEATH_REASONS.COMBAT_DAMAGE,
      { enemy: { name: 'Test Enemy' }, floor: 10 }
    );

    assertNotNull(playerDeathResult, 'Player death result returned');
    assertEqual(playerDeathResult.category, DeathHandler.DEATH_CATEGORIES.COMBAT_DEATH_PLAYER, 'Correct death category');
    assert(playerDeathResult.messages.length > 0, 'Death messages generated');

    var stats = DeathHandler.getStats();
    assertEqual(stats.playerDeaths, 1, 'Player death counted');

    // ========== TEST 12: DeathHandler - Environmental Death ==========
    console.log('\n--- Test 12: DeathHandler - Environmental Death ---');

    DeathHandler.resetStats();
    var envDeathResult = DeathHandler.handlePlayerDeath(
      player,
      DeathHandler.DEATH_REASONS.ENVIRONMENTAL_HAZARD,
      { floor: 5 }
    );

    assertEqual(envDeathResult.category, DeathHandler.DEATH_CATEGORIES.ENVIRONMENTAL_DEATH_SELF, 'Environmental death category');

    // ========== TEST 13: DeathHandler - Enemy Death (Player Kill) ==========
    console.log('\n--- Test 13: DeathHandler - Enemy Death (Player Kill) ---');

    DeathHandler.resetStats();
    var enemy = { hp: 0, maxHp: 50, x: 10, y: 10, tier: 'STANDARD' };
    var enemyDeathResult = DeathHandler.handleEnemyDeath(
      enemy,
      'player',
      {}
    );

    assertNotNull(enemyDeathResult, 'Enemy death result returned');
    assertEqual(enemyDeathResult.playerCredit, true, 'Player gets credit');
    assertNotNull(enemyDeathResult.loot, 'Loot generated');
    assertGreaterThan(enemyDeathResult.loot.xp, 0, 'XP awarded');

    var enemyStats = DeathHandler.getStats();
    assertEqual(enemyStats.enemiesKilledCombat, 1, 'Enemy kill counted');

    // ========== TEST 14: DeathHandler - Enemy Death (Environmental) ==========
    console.log('\n--- Test 14: DeathHandler - Enemy Death (Environmental) ---');

    DeathHandler.resetStats();
    var envEnemyDeathResult = DeathHandler.handleEnemyDeath(
      enemy,
      'environment',
      {}
    );

    assertEqual(envEnemyDeathResult.playerCredit, false, 'No player credit for passive environmental');
    assertEqual(envEnemyDeathResult.loot.xp, 0, 'No XP for passive environmental');

    var envStats = DeathHandler.getStats();
    assertEqual(envStats.enemiesKilledCombat, 0, 'No combat kill counted');

    // ========== TEST 15: DeathHandler - Enemy Death (Player-Caused Environmental) ==========
    console.log('\n--- Test 15: DeathHandler - Enemy Death (Player-Caused Environmental) ---');

    DeathHandler.resetStats();
    var playerEnvDeathResult = DeathHandler.handleEnemyDeath(
      enemy,
      'player_environment',
      { hazardType: 'burning' }
    );

    assertEqual(playerEnvDeathResult.playerCredit, true, 'Player gets credit for triggered environmental');
    assertGreaterThan(playerEnvDeathResult.loot.xp, 0, 'XP awarded for triggered environmental');
    assertEqual(playerEnvDeathResult.category, DeathHandler.DEATH_CATEGORIES.ENVIRONMENTAL_KILL_PLAYER_CAUSED, 'Correct category');

    var playerEnvStats = DeathHandler.getStats();
    assertEqual(playerEnvStats.enemiesKilledEnvironmental, 1, 'Environmental kill counted');

    // ========== TEST 16: DeathHandler - Boss Loot ==========
    console.log('\n--- Test 16: DeathHandler - Boss Loot ---');

    DeathHandler.resetStats();
    var boss = { hp: 0, maxHp: 200, x: 15, y: 15, tier: 'BOSS' };
    var bossDeathResult = DeathHandler.handleEnemyDeath(
      boss,
      'player',
      {}
    );

    assert(bossDeathResult.loot.xp >= 100, 'Boss gives high XP');
    assert(bossDeathResult.loot.currency >= 50, 'Boss gives high currency');

    // ========== TEST 17: DeathHandler - Statistics Tracking ==========
    console.log('\n--- Test 17: DeathHandler - Statistics Tracking ---');

    DeathHandler.resetStats();
    DeathHandler.recordDamageDealt(100);
    DeathHandler.recordDamageDealt(50);
    DeathHandler.recordDamageTaken(75);

    var finalStats = DeathHandler.getStats();
    assertEqual(finalStats.totalDamageDealt, 150, 'Damage dealt tracked');
    assertEqual(finalStats.totalDamageTaken, 75, 'Damage taken tracked');

    // ========== TEST 18: HealthSystem - HP Percentage ==========
    console.log('\n--- Test 18: HealthSystem - HP Percentage ---');

    var hs9 = HealthSystem.createHealthState(100);
    assertEqual(HealthSystem.getHPPercentage(hs9), 100, 'Full HP = 100%');

    HealthSystem.applyDamage(hs9, 50);
    assertEqual(HealthSystem.getHPPercentage(hs9), 50, 'Half HP = 50%');

    HealthSystem.applyDamage(hs9, 25);
    assertEqual(HealthSystem.getHPPercentage(hs9), 25, 'Quarter HP = 25%');

    // ========== TEST 19: HealthSystem - Effective HP ==========
    console.log('\n--- Test 19: HealthSystem - Effective HP ---');

    var hs10 = HealthSystem.createHealthState(100);
    assertEqual(HealthSystem.getEffectiveHP(hs10), 100, 'Effective HP without temp');

    HealthSystem.addTempHP(hs10, 30);
    assertEqual(HealthSystem.getEffectiveHP(hs10), 130, 'Effective HP with temp (100 + 30)');

    // ========== TEST 20: HealthSystem - Minimum Damage ==========
    console.log('\n--- Test 20: HealthSystem - Minimum Damage ---');

    var hs11 = HealthSystem.createHealthState(100);
    HealthSystem.setDamageReduction(hs11, 100, 0); // 100 flat reduction

    var minDamageResult = HealthSystem.applyDamage(hs11, 10);
    assertEqual(minDamageResult.actualDamage, 1, 'Minimum 1 damage dealt');

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
  }

  // Run tests automatically
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runTests);
    } else {
      runTests();
    }
  } else {
    runTests();
  }
})();
