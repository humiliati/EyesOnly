/* ============================================================
   EYES ONLY - Death Handler
   Unified death processing for player and enemy deaths
   ============================================================ */

const DeathHandler = (function () {
  'use strict';

  // Death categories
  var DEATH_CATEGORIES = {
    COMBAT_KILL_ENEMY: 'combat_kill_enemy',           // Enemy killed in combat by player
    COMBAT_DEATH_PLAYER: 'combat_death_player',       // Player killed in combat
    ENVIRONMENTAL_DEATH_SELF: 'environmental_death_self',  // Player died from environment
    ENVIRONMENTAL_KILL_PLAYER_CAUSED: 'environmental_kill_player_caused',  // Enemy killed by player-triggered environment
    ENVIRONMENTAL_KILL_PASSIVE: 'environmental_kill_passive',  // Enemy killed by natural hazards
    VOLUNTARY_EXIT: 'voluntary_exit'                  // Player chose to end run
  };

  // Death reasons
  var DEATH_REASONS = {
    COMBAT_DAMAGE: 'combat_damage',
    ENVIRONMENTAL_HAZARD: 'environmental_hazard',
    BURNING: 'burning',
    TOXIN: 'toxin',
    FALL_DAMAGE: 'fall_damage',
    TRAP: 'trap',
    VOLUNTARY: 'voluntary'
  };

  // Statistics tracking
  var _stats = {
    playerDeaths: 0,
    enemiesKilledCombat: 0,
    enemiesKilledEnvironmental: 0,
    totalDamageDealt: 0,
    totalDamageTaken: 0
  };

  /**
   * Initialize death handler
   */
  function init() {
    _resetStats();
  }

  /**
   * Reset statistics (call at start of new run)
   */
  function _resetStats() {
    _stats = {
      playerDeaths: 0,
      enemiesKilledCombat: 0,
      enemiesKilledEnvironmental: 0,
      totalDamageDealt: 0,
      totalDamageTaken: 0
    };
  }

  /**
   * Handle player death
   * @param {Object} player - Player object
   * @param {string} reason - Death reason from DEATH_REASONS
   * @param {Object} context - Additional context {enemy, location, damage}
   * @returns {Object} Death result with feedback and stats
   */
  function handlePlayerDeath(player, reason, context) {
    context = context || {};

    _stats.playerDeaths++;

    // Determine death category
    var category = DEATH_CATEGORIES.COMBAT_DEATH_PLAYER;
    if (reason === DEATH_REASONS.ENVIRONMENTAL_HAZARD ||
        reason === DEATH_REASONS.BURNING ||
        reason === DEATH_REASONS.TOXIN ||
        reason === DEATH_REASONS.TRAP) {
      category = DEATH_CATEGORIES.ENVIRONMENTAL_DEATH_SELF;
    } else if (reason === DEATH_REASONS.VOLUNTARY) {
      category = DEATH_CATEGORIES.VOLUNTARY_EXIT;
    }

    // Generate death message
    var messages = [];
    messages.push('');
    messages.push('═══════════════════════════════════');
    messages.push('        💀 SIGNAL LOST 💀');
    messages.push('═══════════════════════════════════');
    messages.push('');

    if (category === DEATH_CATEGORIES.COMBAT_DEATH_PLAYER) {
      messages.push('You were defeated in combat.');
      if (context.enemy) {
        messages.push('Killed by: ' + (context.enemy.name || 'Enemy'));
      }
    } else if (category === DEATH_CATEGORIES.ENVIRONMENTAL_DEATH_SELF) {
      messages.push('You succumbed to environmental hazards.');
      if (reason === DEATH_REASONS.BURNING) {
        messages.push('Cause: Burning');
      } else if (reason === DEATH_REASONS.TOXIN) {
        messages.push('Cause: Toxic damage');
      } else {
        messages.push('Cause: Environmental hazard');
      }
    } else if (category === DEATH_CATEGORIES.VOLUNTARY_EXIT) {
      messages.push('Run terminated voluntarily.');
    }

    messages.push('');
    if (context.floor) {
      messages.push('Floor reached: ' + context.floor);
    }
    messages.push('');

    // Return death result
    return {
      category: category,
      reason: reason,
      messages: messages,
      stats: {
        playerDeaths: _stats.playerDeaths,
        finalHP: 0,
        timestamp: Date.now()
      },
      triggerRespawn: category !== DEATH_CATEGORIES.VOLUNTARY_EXIT
    };
  }

  /**
   * Handle enemy death
   * @param {Object} enemy - Enemy object
   * @param {string} source - Death source ('player', 'environment', 'player_environment')
   * @param {Object} context - Additional context {player, damage, location, hazardType}
   * @returns {Object} Death result with loot, XP, and stats
   */
  function handleEnemyDeath(enemy, source, context) {
    context = context || {};

    // Determine death category
    var category;
    var playerCredit = false;

    if (source === 'player') {
      category = DEATH_CATEGORIES.COMBAT_KILL_ENEMY;
      _stats.enemiesKilledCombat++;
      playerCredit = true;
    } else if (source === 'player_environment') {
      category = DEATH_CATEGORIES.ENVIRONMENTAL_KILL_PLAYER_CAUSED;
      _stats.enemiesKilledEnvironmental++;
      playerCredit = true;
    } else {
      category = DEATH_CATEGORIES.ENVIRONMENTAL_KILL_PASSIVE;
      playerCredit = false;
    }

    // Calculate loot and XP using LootTableManager
    var loot = {
      cards: [],
      charms: [],
      resourceDrops: [],
      currency: 0,
      xp: 0
    };

    if (playerCredit) {
      // Determine enemy tier for loot table
      var enemyTier = 'standard';
      if (enemy.tier === 'ELITE') {
        enemyTier = 'elite';
      } else if (enemy.tier === 'BOSS') {
        enemyTier = 'boss';
      } else if (enemy.tier === 'SCOUT') {
        enemyTier = 'scout';
      }

      // Roll loot from loot table manager
      if (typeof LootTableManager !== 'undefined' && LootTableManager.rollEnemyLoot) {
        var rollContext = {
          source: source,
          mythicKill: context.mythicKill || false
        };

        var rolledLoot = LootTableManager.rollEnemyLoot(enemyTier, rollContext);

        if (rolledLoot) {
          loot.currency = rolledLoot.currency || 0;
          loot.xp = rolledLoot.xp || 0;

          // Convert rolled cards to legacy format
          if (rolledLoot.cards && rolledLoot.cards.length > 0) {
            rolledLoot.cards.forEach(function(card) {
              loot.cards.push({
                shouldDrop: true,
                tier: enemy.tier || 'STANDARD',
                card: card,
                mythic: card.mythic || false
              });
            });
          }

          // Convert rolled items (charms) to legacy format
          if (rolledLoot.items && rolledLoot.items.length > 0) {
            rolledLoot.items.forEach(function(item) {
              if (item.type === 'charm') {
                loot.charms.push({
                  shouldDrop: true,
                  type: item.rarity || 'common',
                  item: item
                });
              }
            });
          }
        }
      }

      // Roll canonical resource drops (COLLECTIBLES_CANON) based on enemy lootProfile
      if (typeof LootTableManager !== 'undefined' && LootTableManager.rollEnemyResourceDrops) {
        var lootProfile = enemy.lootProfile || enemy.resourceProfile || 'default';
        loot.resourceDrops = LootTableManager.rollEnemyResourceDrops(enemyTier, lootProfile);
      }

      // Boss special loot
      if (enemy.tier === 'BOSS' && context.bossLoot) {
        loot.bossSpecial = context.bossLoot;
      }
    }

    // Generate death message
    var messages = [];
    if (playerCredit) {
      if (category === DEATH_CATEGORIES.COMBAT_KILL_ENEMY) {
        messages.push('✓ Enemy defeated!');
      } else {
        messages.push('✓ Enemy eliminated by environmental hazard!');
      }

      if (loot.xp > 0) {
        messages.push('  +' + loot.xp + ' XP');
      }
      if (loot.currency > 0) {
        messages.push('  +¢' + loot.currency);
      }
    }

    return {
      category: category,
      playerCredit: playerCredit,
      loot: loot,
      messages: messages,
      stats: {
        enemiesKilled: playerCredit ? 1 : 0,
        xpGained: loot.xp,
        currencyGained: loot.currency
      }
    };
  }

  /**
   * Get current statistics
   * @returns {Object} Current stats
   */
  function getStats() {
    return Object.assign({}, _stats);
  }

  /**
   * Reset statistics for new run
   */
  function resetStats() {
    _resetStats();
  }

  /**
   * Record damage dealt
   * @param {number} amount - Damage amount
   */
  function recordDamageDealt(amount) {
    _stats.totalDamageDealt += amount;
  }

  /**
   * Record damage taken
   * @param {number} amount - Damage amount
   */
  function recordDamageTaken(amount) {
    _stats.totalDamageTaken += amount;
  }

  // Public API
  return {
    DEATH_CATEGORIES: DEATH_CATEGORIES,
    DEATH_REASONS: DEATH_REASONS,
    init: init,
    handlePlayerDeath: handlePlayerDeath,
    handleEnemyDeath: handleEnemyDeath,
    getStats: getStats,
    resetStats: resetStats,
    recordDamageDealt: recordDamageDealt,
    recordDamageTaken: recordDamageTaken
  };
})();

// Initialize on load
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      DeathHandler.init();
    });
  } else {
    DeathHandler.init();
  }
}
