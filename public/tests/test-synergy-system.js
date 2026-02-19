/* ============================================================
   EYES ONLY - Synergy System Test Harness
   Validates synergy detection, card combos, and bonus application
   ============================================================ */

(function () {
  'use strict';

  console.log('========================================');
  console.log('TEST: Card Synergy System');
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

  function runTests() {
    console.log('\n--- Test 1: Module Loading ---');

    assert(
      typeof SynergyEngine !== 'undefined',
      'SynergyEngine module is loaded'
    );

    assert(
      typeof SynergyIntegration !== 'undefined',
      'SynergyIntegration module is loaded'
    );

    assert(
      typeof CardSystem !== 'undefined',
      'CardSystem module is loaded'
    );

    console.log('\n--- Test 2: Synergy Engine Initialization ---');

    SynergyEngine.init();

    var state = SynergyEngine.getState();
    assert(
      state && typeof state === 'object',
      'Synergy engine returns state object'
    );

    assert(
      Array.isArray(state.cardsPlayedThisTurn),
      'State tracks cards played this turn'
    );

    console.log('\n--- Test 3: Synergy Tag System ---');

    assert(
      typeof SynergyEngine.SYNERGY_TAGS === 'object',
      'Synergy tags are defined'
    );

    var tagCount = Object.keys(SynergyEngine.SYNERGY_TAGS).length;
    assert(
      tagCount > 0,
      'Synergy tags contain entries (' + tagCount + ' tags)'
    );

    console.log('\n--- Test 4: Synergy Definitions ---');

    assert(
      typeof SynergyEngine.SYNERGY_DEFINITIONS === 'object',
      'Synergy definitions are defined'
    );

    var synergyCount = Object.keys(SynergyEngine.SYNERGY_DEFINITIONS).length;
    assert(
      synergyCount > 0,
      'Synergy definitions contain entries (' + synergyCount + ' synergies)'
    );

    // Check specific synergies
    assert(
      SynergyEngine.SYNERGY_DEFINITIONS.ENERGY_DUMP !== undefined,
      'Energy Dump synergy is defined'
    );

    assert(
      SynergyEngine.SYNERGY_DEFINITIONS.BATTERY_OVERLOAD !== undefined,
      'Battery Overload synergy is defined'
    );

    assert(
      SynergyEngine.SYNERGY_DEFINITIONS.COMBO_DEVASTATION !== undefined,
      'Combo Devastation synergy is defined'
    );

    console.log('\n--- Test 5: Card System Integration ---');

    // Check that new synergy cards exist
    assert(
      CardSystem.BASE_CARDS['Overcharge'] !== undefined,
      'Overcharge enabler card exists'
    );

    assert(
      CardSystem.BASE_CARDS['Thunder Strike'] !== undefined,
      'Thunder Strike payoff card exists'
    );

    assert(
      CardSystem.BASE_CARDS['EMP Blast'] !== undefined,
      'EMP Blast tech card exists'
    );

    // Check synergy tags on new cards
    var overcharge = CardSystem.BASE_CARDS['Overcharge'];
    assert(
      overcharge.synergyTags && overcharge.synergyTags.length > 0,
      'Overcharge has synergy tags'
    );

    assert(
      overcharge.synergyTags.indexOf('energy_gen') !== -1,
      'Overcharge has energy_gen tag'
    );

    var thunderStrike = CardSystem.BASE_CARDS['Thunder Strike'];
    assert(
      thunderStrike.synergyTags && thunderStrike.synergyTags.indexOf('burst') !== -1,
      'Thunder Strike has burst tag'
    );

    console.log('\n--- Test 6: Energy Dump Synergy ---');

    SynergyEngine.init();

    // Create mock cards with synergy tags
    var enablerCard = {
      name: 'Overcharge',
      synergyTags: ['energy_gen', 'combo_starter'],
      stats: { energyGeneration: 3 }
    };

    var payoffCard = {
      name: 'Thunder Strike',
      synergyTags: ['burst', 'aoe', 'combo_finisher'],
      stats: { damage: 12, aoe: 3 }
    };

    // Play enabler
    var enablerResult = SynergyEngine.registerCardPlay(enablerCard);
    assert(
      enablerResult && typeof enablerResult === 'object',
      'Enabler card registered'
    );

    // Play payoff
    var payoffResult = SynergyEngine.registerCardPlay(payoffCard);
    assert(
      payoffResult && payoffResult.synergies && payoffResult.synergies.length > 0,
      'Synergy detected on payoff card'
    );

    assert(
      payoffResult.bonuses && payoffResult.bonuses.damageMultiplier > 1.0,
      'Damage multiplier bonus applied'
    );

    console.log('\n--- Test 7: Battery Overload Synergy ---');

    SynergyEngine.init();

    var batteryGen = {
      name: 'Power Cell',
      synergyTags: ['battery_gen'],
      stats: { batteryCharge: 2 }
    };

    var techAttack = {
      name: 'EMP Blast',
      synergyTags: ['tech', 'aoe', 'burst'],
      stats: { damage: 10, aoe: 4 }
    };

    SynergyEngine.registerCardPlay(batteryGen);
    var techResult = SynergyEngine.registerCardPlay(techAttack);

    assert(
      techResult.synergies && techResult.synergies.length > 0,
      'Battery tech synergy detected'
    );

    assert(
      techResult.bonuses && techResult.bonuses.damageMultiplier >= 2.0,
      'Tech attack damage doubled from battery synergy'
    );

    console.log('\n--- Test 8: Combo Chain Detection ---');

    SynergyEngine.init();

    var comboStarter = {
      name: 'Chain Lightning',
      synergyTags: ['combo_starter', 'tech', 'chain'],
      stats: { damage: 6 }
    };

    var comboFinisher = {
      name: 'Annihilation',
      synergyTags: ['combo_finisher', 'burst', 'ranged'],
      stats: { damage: 20 }
    };

    SynergyEngine.registerCardPlay(comboStarter);
    var finisherResult = SynergyEngine.registerCardPlay(comboFinisher);

    assert(
      finisherResult.synergies && finisherResult.synergies.length > 0,
      'Combo chain synergy detected'
    );

    assert(
      finisherResult.bonuses && finisherResult.bonuses.damageMultiplier >= 2.0,
      'Combo finisher damage multiplied'
    );

    assert(
      finisherResult.bonuses && finisherResult.bonuses.energyRefund >= 1,
      'Combo finisher refunds energy'
    );

    console.log('\n--- Test 9: Synergy Integration API ---');

    SynergyIntegration.init();

    assert(
      typeof SynergyIntegration.startCombat === 'function',
      'startCombat function exists'
    );

    assert(
      typeof SynergyIntegration.endCombat === 'function',
      'endCombat function exists'
    );

    assert(
      typeof SynergyIntegration.processCardPlay === 'function',
      'processCardPlay function exists'
    );

    SynergyIntegration.startCombat();

    var mockCard = CardSystem.rollCard('Thunder Strike');
    if (mockCard) {
      // Add synergy tags to rolled card
      mockCard.synergyTags = ['burst', 'aoe', 'tech', 'combo_finisher'];

      var processResult = SynergyIntegration.processCardPlay(mockCard, {});

      assert(
        processResult && processResult.cardEffect,
        'processCardPlay returns card effect'
      );

      assert(
        processResult.cardEffect.damage >= 0,
        'Card effect has damage value'
      );
    }

    SynergyIntegration.endCombat();

    console.log('\n--- Test 10: Aggressive Momentum Stacking ---');

    SynergyEngine.init();

    var aggCard1 = {
      name: 'Burst Shot',
      synergyTags: ['aggressive', 'ranged'],
      stats: { damage: 5 }
    };

    var aggCard2 = {
      name: 'Execute',
      synergyTags: ['aggressive', 'ranged'],
      stats: { damage: 10 }
    };

    // First aggressive card
    var agg1Result = SynergyEngine.registerCardPlay(aggCard1);

    // Second aggressive card should have stacking bonus
    var agg2Result = SynergyEngine.registerCardPlay(aggCard2);

    assert(
      agg2Result.synergies && agg2Result.synergies.length > 0,
      'Aggressive momentum synergy detected'
    );

    var state2 = SynergyEngine.getState();
    assert(
      state2.aggressiveStacks > 0,
      'Aggressive stacks accumulate (stacks: ' + state2.aggressiveStacks + ')'
    );

    console.log('\n--- Test 11: Synergy Tag Display ---');

    var card = {
      synergyTags: ['fire', 'explosive', 'aoe']
    };

    var display = SynergyIntegration.getSynergyTagsDisplay(card);
    assert(
      display && display.length > 0,
      'Synergy tags display string is generated'
    );

    assert(
      display.indexOf('fire') !== -1,
      'Display includes fire tag'
    );

    console.log('\n--- Test 12: Resource Effect Application ---');

    var resourceCard = {
      name: 'Tactical Refresh',
      synergyTags: ['fatigue_reduce', 'energy_gen'],
      stats: {
        energyGeneration: 2,
        fatigueReduction: 30
      }
    };

    var mockGameState = {
      playerEnergy: 2,
      maxEnergy: 5,
      playerFatigue: 50,
      maxFatigue: 100
    };

    var processResult = SynergyIntegration.processCardPlay(resourceCard, {});
    var appliedResources = SynergyIntegration.applyResourceEffects(resourceCard, processResult, mockGameState);

    assert(
      appliedResources && typeof appliedResources === 'object',
      'Resource effects are applied'
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
