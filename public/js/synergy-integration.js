/* ============================================================
   EYES ONLY - Synergy System Integration
   Integrates synergy engine with STR combat and card system
   ============================================================ */

const SynergyIntegration = (function () {
  'use strict';

  var _initialized = false;
  var _combatActive = false;

  /**
   * Initialize synergy integration
   */
  function init() {
    if (_initialized) return;

    console.log('[SynergyIntegration] Initializing synergy system integration');

    // Check dependencies
    if (typeof SynergyEngine === 'undefined') {
      console.error('[SynergyIntegration] SynergyEngine not loaded');
      return false;
    }

    if (typeof CardSystem === 'undefined') {
      console.error('[SynergyIntegration] CardSystem not loaded');
      return false;
    }

    _initialized = true;
    return true;
  }

  /**
   * Start combat synergy tracking
   */
  function startCombat() {
    if (!_initialized) {
      init();
    }

    if (typeof SynergyEngine !== 'undefined' && SynergyEngine.init) {
      SynergyEngine.init();
      _combatActive = true;
      console.log('[SynergyIntegration] Combat synergy tracking started');
    }

    // Reset cascade resolver for new combat
    if (typeof CascadeResolver !== 'undefined' && CascadeResolver.reset) {
      CascadeResolver.reset();
    }

    // Clear burn pile for new combat
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.clearBurnPile === 'function') {
      GAMESTATE.clearBurnPile();
    }
  }

  /**
   * End combat synergy tracking
   */
  function endCombat() {
    if (typeof SynergyEngine !== 'undefined' && SynergyEngine.reset) {
      SynergyEngine.reset();
      _combatActive = false;
      console.log('[SynergyIntegration] Combat synergy tracking ended');
    }
  }

  /**
   * Reset turn synergy tracking
   */
  function resetTurn() {
    if (_combatActive && typeof SynergyEngine !== 'undefined' && SynergyEngine.resetTurn) {
      SynergyEngine.resetTurn();
    }
    // Reset cascade depth counter each turn
    if (typeof CascadeResolver !== 'undefined' && CascadeResolver.resetTurn) {
      CascadeResolver.resetTurn();
    }
  }

  /**
   * Process card play with synergy detection
   * @param {Object} card - The card being played
   * @param {Object} context - Combat context {player, enemy, gameState}
   * @returns {Object} - Enhanced card effects with synergy bonuses
   */
  function processCardPlay(card, context) {
    context = context || {};

    // Basic card effect (from card stats)
    var cardEffect = {
      damage: card.stats?.damage || 0,
      accuracy: card.stats?.accuracy || 100,
      defense: card.stats?.defense || 0,
      evasion: card.stats?.evasion || 0,
      energy: card.stats?.energy || 0,
      ammo: card.stats?.ammo || 0,
      fatigue: card.stats?.fatigue || 0,
      aoe: card.stats?.aoe || 0,
      dot: card.stats?.dot || 0,
      duration: card.stats?.duration || 0,
      hp: card.stats?.hp || 0,
      special: {}
    };

    // Check for synergies
    var synergyResult = { synergies: [], bonuses: {}, description: '' };
    if (_combatActive && typeof SynergyEngine !== 'undefined' && SynergyEngine.registerCardPlay) {
      synergyResult = SynergyEngine.registerCardPlay(card);
    }

    // Apply synergy bonuses
    if (synergyResult.bonuses) {
      var bonuses = synergyResult.bonuses;

      // Damage bonuses
      if (bonuses.damageMultiplier && bonuses.damageMultiplier !== 1.0) {
        cardEffect.damage = Math.floor(cardEffect.damage * bonuses.damageMultiplier);
      }
      if (bonuses.damageBonus) {
        cardEffect.damage += bonuses.damageBonus;
      }

      // Energy refund
      if (bonuses.energyRefund) {
        cardEffect.energyRefund = bonuses.energyRefund;
      }

      // Cost reduction
      if (bonuses.costReduction) {
        cardEffect.costReduction = bonuses.costReduction;
      }

      // Ammo refund
      if (bonuses.ammoRefund) {
        cardEffect.ammoRefundChance = bonuses.ammoRefund;
      }

      // AOE expansion
      if (bonuses.aoeExpansion) {
        cardEffect.aoe += bonuses.aoeExpansion;
      }

      // Special flags
      if (bonuses.guaranteedCrit) {
        cardEffect.special.guaranteedCrit = true;
        cardEffect.accuracy = 100;
      }
      if (bonuses.applyDisrupt) {
        cardEffect.special.applyDisrupt = true;
      }
      if (bonuses.drawCard) {
        cardEffect.special.drawCard = true;
      }
      if (bonuses.fatigueImmune) {
        cardEffect.special.fatigueImmune = true;
      }
      if (bonuses.speedBonus) {
        cardEffect.speedBonus = bonuses.speedBonus;
      }
    }

    return {
      cardEffect: cardEffect,
      synergies: synergyResult.synergies,
      synergyDescription: synergyResult.description,
      activeBonuses: synergyResult.bonuses
    };
  }

  /**
   * Get potential synergies for a card (for UI highlighting)
   * @param {Object} card - Card to check
   * @param {Array} otherCards - Other cards in hand/play
   * @returns {Array} - Potential synergies
   */
  function getPotentialSynergies(card, otherCards) {
    if (!_initialized || typeof SynergyEngine === 'undefined') {
      return [];
    }

    if (typeof SynergyEngine.checkPotentialSynergies === 'function') {
      return SynergyEngine.checkPotentialSynergies(card, otherCards || []);
    }

    return [];
  }

  /**
   * Get current synergy state
   * @returns {Object} - Synergy state
   */
  function getSynergyState() {
    if (_combatActive && typeof SynergyEngine !== 'undefined' && SynergyEngine.getState) {
      return SynergyEngine.getState();
    }
    return null;
  }

  /**
   * Format synergy log message for combat feed
   * @param {Array} synergies - Active synergies
   * @returns {String} - Formatted message
   */
  function formatSynergyLog(synergies) {
    if (!synergies || synergies.length === 0) {
      return '';
    }

    var messages = [];
    for (var i = 0; i < synergies.length; i++) {
      var syn = synergies[i];
      messages.push('⚡ SYNERGY: ' + syn.definition.name);
    }

    return messages.join('\n');
  }

  /**
   * Check if card has synergy tags
   * @param {Object} card - Card to check
   * @returns {Boolean}
   */
  function cardHasSynergyTags(card) {
    return card && card.synergyTags && card.synergyTags.length > 0;
  }

  /**
   * Get synergy tags for display
   * @param {Object} card - Card object
   * @returns {String} - Formatted tag string
   */
  function getSynergyTagsDisplay(card) {
    if (!cardHasSynergyTags(card)) {
      return '';
    }

    return '🔗 ' + card.synergyTags.join(', ');
  }

  /**
   * Apply energy generation from card
   * @param {Number} amount - Energy to generate
   * @param {Object} gameState - Current game state
   * @returns {Number} - Actual energy generated
   */
  function applyEnergyGeneration(amount, gameState) {
    if (!gameState || !amount) return 0;

    var currentEnergy = gameState.playerEnergy || 0;
    var maxEnergy = gameState.maxEnergy || 5;
    var generated = Math.min(amount, maxEnergy - currentEnergy);

    if (generated > 0) {
      if (typeof GAMESTATE !== 'undefined' && GAMESTATE.setState) {
        GAMESTATE.setState({ playerEnergy: currentEnergy + generated });
      }
    }

    return generated;
  }

  /**
   * Apply battery generation from card
   * @param {Number} amount - Battery to generate
   * @param {Object} gameState - Current game state
   * @returns {Number} - Actual battery generated
   */
  function applyBatteryGeneration(amount, gameState) {
    if (!gameState || !amount) return 0;

    var currentBattery = gameState.playerBattery || 0;
    var maxBattery = gameState.maxBattery || 5;
    var generated = Math.min(amount, maxBattery - currentBattery);

    if (generated > 0) {
      if (typeof GAMESTATE !== 'undefined' && GAMESTATE.setState) {
        GAMESTATE.setState({ playerBattery: currentBattery + generated });
      }
    }

    return generated;
  }

  /**
   * Apply ammo restoration from card
   * @param {Number} amount - Ammo to restore
   * @param {Object} gameState - Current game state
   * @returns {Number} - Actual ammo restored
   */
  function applyAmmoRestoration(amount, gameState) {
    if (!gameState || !amount) return 0;

    var currentAmmo = gameState.playerAmmo || 0;
    var maxAmmo = gameState.maxAmmo || 50;
    var restored = Math.min(amount, maxAmmo - currentAmmo);

    if (restored > 0) {
      if (typeof GAMESTATE !== 'undefined' && GAMESTATE.setState) {
        GAMESTATE.setState({ playerAmmo: currentAmmo + restored });
      }
    }

    return restored;
  }

  /**
   * Apply fatigue reduction from card
   * @param {Number} amount - Fatigue to reduce
   * @param {Object} gameState - Current game state
   * @returns {Number} - Actual fatigue reduced
   */
  function applyFatigueReduction(amount, gameState) {
    if (!gameState || !amount) return 0;

    var currentFatigue = gameState.playerFatigue || 0;
    var reduced = Math.min(amount, currentFatigue);

    if (reduced > 0) {
      if (typeof GAMESTATE !== 'undefined' && GAMESTATE.setState) {
        GAMESTATE.setState({ playerFatigue: currentFatigue - reduced });
      }
    }

    return reduced;
  }

  /**
   * Process card resource effects (energy, battery, ammo, fatigue)
   * @param {Object} card - Card being played
   * @param {Object} result - Process result from processCardPlay
   * @param {Object} gameState - Current game state
   * @returns {Object} - Applied resource changes
   */
  function applyResourceEffects(card, result, gameState) {
    var applied = {
      energyGenerated: 0,
      batteryGenerated: 0,
      ammoRestored: 0,
      fatigueReduced: 0
    };

    if (!card || !card.stats) return applied;

    // Apply energy generation
    if (card.stats.energyGeneration) {
      applied.energyGenerated = applyEnergyGeneration(card.stats.energyGeneration, gameState);
    }

    // Apply battery charge
    if (card.stats.batteryCharge) {
      applied.batteryGenerated = applyBatteryGeneration(card.stats.batteryCharge, gameState);
    }

    // Apply ammo restoration
    if (card.stats.ammoRestore) {
      applied.ammoRestored = applyAmmoRestoration(card.stats.ammoRestore, gameState);
    }

    // Apply fatigue reduction
    if (card.stats.fatigueReduction) {
      applied.fatigueReduced = applyFatigueReduction(card.stats.fatigueReduction, gameState);
    }

    // Apply synergy-based energy refund
    if (result && result.cardEffect && result.cardEffect.energyRefund) {
      applied.energyGenerated += applyEnergyGeneration(result.cardEffect.energyRefund, gameState);
    }

    return applied;
  }

  // Public API
  return {
    init: init,
    startCombat: startCombat,
    endCombat: endCombat,
    resetTurn: resetTurn,
    processCardPlay: processCardPlay,
    getPotentialSynergies: getPotentialSynergies,
    getSynergyState: getSynergyState,
    formatSynergyLog: formatSynergyLog,
    cardHasSynergyTags: cardHasSynergyTags,
    getSynergyTagsDisplay: getSynergyTagsDisplay,
    applyResourceEffects: applyResourceEffects,
    applyEnergyGeneration: applyEnergyGeneration,
    applyBatteryGeneration: applyBatteryGeneration,
    applyAmmoRestoration: applyAmmoRestoration,
    applyFatigueReduction: applyFatigueReduction
  };
})();

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    SynergyIntegration.init();
  });
} else {
  SynergyIntegration.init();
}

// Make available globally
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SynergyIntegration;
}
