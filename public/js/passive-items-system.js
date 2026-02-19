/* ============================================================
   EYES ONLY - Passive Items System
   MGS-style equipment that spawns cards during disposal or purchase
   ============================================================ */

const PassiveItemsSystem = (function() {
  'use strict';

  // Trigger events enum
  var TRIGGER_EVENTS = {
    ON_DISPOSE: 'on_dispose',
    ON_SELL: 'on_sell',
    ON_PURCHASE: 'on_purchase',
    ON_GAMBLE_WIN: 'on_gamble_win',
    ON_EXHAUST: 'on_exhaust',
    ON_EQUIP: 'on_equip',      // Continuous effect while equipped
    ON_COMBAT: 'on_combat',     // Breaks on combat entry
    ON_RUN: 'on_run'            // Breaks on running
  };

  // Passive items database
  var PASSIVE_ITEMS_DB = {
    SCRAPPER_CORE: {
      id: 'scrapper_core',
      name: 'Scrapper Core',
      emoji: '🛠',
      description: 'Nothing leaves without leaving something behind.',
      trigger_event: TRIGGER_EVENTS.ON_DISPOSE,
      proc_base: 0.22,  // 22% base chance
      rarity_scaling: {
        common: 0.00,
        uncommon: 0.06,
        rare: 0.12,
        power: 0.18
      },
      spawn_table_id: 'scrap_fabrication',
      upgrade_path: 'scrapper_core_plus',
      stackable: false,
      slot: 'passive_equipment'
    },
    SCRAPPER_CORE_PLUS: {
      id: 'scrapper_core_plus',
      name: 'Scrapper Core+',
      emoji: '🛠',
      description: 'Nothing leaves without leaving something behind. [UPGRADED]',
      trigger_event: TRIGGER_EVENTS.ON_DISPOSE,
      proc_base: 0.30,  // 30% base chance
      rarity_scaling: {
        common: 0.00,
        uncommon: 0.08,
        rare: 0.16,
        power: 0.24
      },
      spawn_table_id: 'scrap_fabrication_plus',
      upgrade_path: null,
      stackable: false,
      slot: 'passive_equipment',
      can_proc_on_exhaust: true,
      exhaust_proc_chance: 0.05
    },
    THRIFT_GHOST: {
      id: 'thrift_ghost',
      name: 'Thrift Ghost',
      emoji: '🛍',
      description: 'Every purchase echoes.',
      trigger_event: TRIGGER_EVENTS.ON_PURCHASE,
      proc_base: 0.18,  // 18% base chance
      rarity_scaling: {
        common: 0.10,
        uncommon: 0.06,
        rare: 0.02,
        gamble_result: 0.12
      },
      spawn_table_id: 'purchase_duplicate',
      upgrade_path: 'thrift_ghost_plus',
      stackable: false,
      slot: 'passive_equipment',
      perfect_echo_chance: 0.03  // 3% chance for upgraded duplicate
    },
    THRIFT_GHOST_PLUS: {
      id: 'thrift_ghost_plus',
      name: 'Thrift Ghost+',
      emoji: '🛍',
      description: 'Every purchase echoes. [UPGRADED]',
      trigger_event: TRIGGER_EVENTS.ON_PURCHASE,
      proc_base: 0.25,  // 25% base chance
      rarity_scaling: {
        common: 0.12,
        uncommon: 0.08,
        rare: 0.04,
        gamble_result: 0.15
      },
      spawn_table_id: 'purchase_duplicate',
      upgrade_path: null,
      stackable: false,
      slot: 'passive_equipment',
      perfect_echo_chance: 0.07,  // 7% chance for upgraded duplicate
      triple_chance: 0.10  // 10% chance for triple instead of double
    },
    CARDBOARD_BOX: {
      id: 'cardboard_box',
      name: 'Cardboard Box',
      emoji: '📦',
      description: 'Perfect camouflage when still. Breaks when running or fighting.',
      trigger_event: TRIGGER_EVENTS.ON_EQUIP,
      // Stealth properties
      stealth_bonus: 75,  // High stealth bonus (perfect sight line)
      stealth_bonus_min_quality: 45,  // Still high at mid quality
      // Avatar transformation
      player_avatar_override: '📦',
      // Breaking conditions
      breaks_on_run: true,
      breaks_on_combat: true,
      // Equipment properties
      upgrade_path: 'cardboard_box_plus',
      stackable: false,
      slot: 'passive_equipment',
      is_active_effect: true  // Continuous effect while equipped
    },
    CARDBOARD_BOX_PLUS: {
      id: 'cardboard_box_plus',
      name: 'Cardboard Box+',
      emoji: '📦',
      description: 'Enhanced camouflage. Doesn\'t break on running. [UPGRADED]',
      trigger_event: TRIGGER_EVENTS.ON_EQUIP,
      // Stealth properties
      stealth_bonus: 90,  // Even higher stealth bonus
      stealth_bonus_min_quality: 60,  // Higher floor at mid quality
      // Avatar transformation
      player_avatar_override: '📦',
      // Breaking conditions
      breaks_on_run: false,  // Upgrade: doesn't break when running
      breaks_on_combat: true,  // Still breaks on combat
      // Equipment properties
      upgrade_path: null,
      stackable: false,
      slot: 'passive_equipment',
      is_active_effect: true
    }
  };

  // Spawn tables
  var SPAWN_TABLES = {
    scrap_fabrication: {
      id: 'scrap_fabrication',
      rarity_weight_common: 50,
      rarity_weight_uncommon: 30,
      rarity_weight_rare: 14,
      utility_weight: 6,
      power_weight: 0,
      double_spawn_chance: 0.05,
      currency_fail_value: { min: 15, max: 60 }
    },
    scrap_fabrication_plus: {
      id: 'scrap_fabrication_plus',
      rarity_weight_common: 40,
      rarity_weight_uncommon: 35,
      rarity_weight_rare: 20,
      utility_weight: 4,
      power_weight: 1,
      double_spawn_chance: 0.08,
      currency_fail_value: { min: 20, max: 80 }
    },
    purchase_duplicate: {
      id: 'purchase_duplicate',
      // Duplicates the exact card
      duplicate_exact: true,
      currency_fail_value: { min: 10, max: 40 }  // Partial refund if no space
    }
  };

  // State
  var _equippedPassives = [];  // Array of equipped passive item IDs
  var _passiveSlots = 1;  // Start with 1 slot, can be upgraded
  var _maxPassiveSlots = 2;  // Can equip both items late game

  /**
   * Initialize passive items system
   */
  function init() {
    console.log('[PassiveItemsSystem] Initialized');
  }

  /**
   * Equip a passive item
   * @param {string} itemId - Passive item ID
   * @returns {boolean} Success
   */
  function equipPassive(itemId) {
    var item = PASSIVE_ITEMS_DB[itemId.toUpperCase()];
    if (!item) {
      console.warn('[PassiveItemsSystem] Unknown item:', itemId);
      return false;
    }

    // Check if already equipped
    if (_equippedPassives.indexOf(itemId) !== -1) {
      console.warn('[PassiveItemsSystem] Item already equipped:', itemId);
      return false;
    }

    // Check slot limits
    if (_equippedPassives.length >= _passiveSlots) {
      console.warn('[PassiveItemsSystem] No passive slots available');
      return false;
    }

    _equippedPassives.push(itemId);
    console.log('[PassiveItemsSystem] Equipped:', item.name);
    return true;
  }

  /**
   * Unequip a passive item
   * @param {string} itemId - Passive item ID
   * @returns {boolean} Success
   */
  function unequipPassive(itemId) {
    var index = _equippedPassives.indexOf(itemId);
    if (index === -1) {
      console.warn('[PassiveItemsSystem] Item not equipped:', itemId);
      return false;
    }

    _equippedPassives.splice(index, 1);
    console.log('[PassiveItemsSystem] Unequipped:', itemId);
    return true;
  }

  /**
   * Get equipped passive items
   * @returns {Array} Array of equipped item IDs
   */
  function getEquippedPassives() {
    return _equippedPassives.slice();
  }

  /**
   * Check if both Scrapper and Thrift are equipped (synergy)
   * @returns {boolean}
   */
  function hasSynergy() {
    var hasScrapper = _equippedPassives.some(function(id) {
      return id.indexOf('scrapper_core') !== -1;
    });
    var hasThrift = _equippedPassives.some(function(id) {
      return id.indexOf('thrift_ghost') !== -1;
    });
    return hasScrapper && hasThrift;
  }

  /**
   * Handle disposal trigger
   * @param {Object} card - Disposed card
   * @param {string} reason - Disposal reason
   * @returns {Object} Result {success, spawned, currency}
   */
  function handleDisposal(card, reason) {
    var results = [];

    _equippedPassives.forEach(function(itemId) {
      var item = PASSIVE_ITEMS_DB[itemId.toUpperCase()];
      if (!item || item.trigger_event !== TRIGGER_EVENTS.ON_DISPOSE) {
        return;
      }

      // Calculate proc chance
      var procChance = item.proc_base;
      var cardRarity = (card.rarity || 'common').toLowerCase();
      if (item.rarity_scaling[cardRarity]) {
        procChance += item.rarity_scaling[cardRarity];
      }

      console.log('[PassiveItemsSystem] Scrapper proc chance:', procChance, 'for', cardRarity);

      // Roll for proc
      if (Math.random() < procChance) {
        var spawnResult = _spawnFromTable(item.spawn_table_id, card);
        results.push({
          item: item.name,
          spawned: spawnResult
        });

        // Trigger visual feedback
        _triggerScrapperVisual();
      }
    });

    return {
      success: results.length > 0,
      results: results
    };
  }

  /**
   * Handle purchase trigger
   * @param {Object} card - Purchased card
   * @param {boolean} isGamble - Is from gambling
   * @returns {Object} Result {success, spawned, currency}
   */
  function handlePurchase(card, isGamble) {
    var results = [];

    _equippedPassives.forEach(function(itemId) {
      var item = PASSIVE_ITEMS_DB[itemId.toUpperCase()];
      if (!item || item.trigger_event !== TRIGGER_EVENTS.ON_PURCHASE) {
        return;
      }

      // Calculate proc chance
      var procChance = item.proc_base;
      var cardRarity = (card.rarity || 'common').toLowerCase();
      var rarityKey = isGamble ? 'gamble_result' : cardRarity;
      if (item.rarity_scaling[rarityKey]) {
        procChance += item.rarity_scaling[rarityKey];
      }

      console.log('[PassiveItemsSystem] Thrift proc chance:', procChance, 'for', rarityKey);

      // Roll for proc
      if (Math.random() < procChance) {
        var spawnResult = _duplicateCard(card, item);
        results.push({
          item: item.name,
          spawned: spawnResult
        });

        // Trigger visual feedback
        _triggerThriftVisual();
      }
    });

    return {
      success: results.length > 0,
      results: results
    };
  }

  /**
   * Spawn card from fabrication table
   * @param {string} tableId - Spawn table ID
   * @param {Object} sourceCard - Card that triggered spawn
   * @returns {Object} Spawn result
   */
  function _spawnFromTable(tableId, sourceCard) {
    var table = SPAWN_TABLES[tableId];
    if (!table) {
      return { success: false, reason: 'TABLE_NOT_FOUND' };
    }

    // Check for double spawn
    var spawnCount = 1;
    if (Math.random() < table.double_spawn_chance) {
      spawnCount = 2;
      console.log('[PassiveItemsSystem] Double spawn triggered!');
    }

    var spawnedCards = [];

    for (var i = 0; i < spawnCount; i++) {
      // Roll for rarity
      var totalWeight = table.rarity_weight_common + table.rarity_weight_uncommon +
                       table.rarity_weight_rare + table.utility_weight + table.power_weight;
      var roll = Math.random() * totalWeight;
      var rarity = 'common';

      if (roll < table.rarity_weight_common) {
        rarity = 'common';
      } else if (roll < table.rarity_weight_common + table.rarity_weight_uncommon) {
        rarity = 'uncommon';
      } else if (roll < table.rarity_weight_common + table.rarity_weight_uncommon + table.rarity_weight_rare) {
        rarity = 'rare';
      } else if (roll < table.rarity_weight_common + table.rarity_weight_uncommon + table.rarity_weight_rare + table.utility_weight) {
        rarity = 'utility';
      } else {
        rarity = 'power';
      }

      // Generate card
      var newCard = null;
      if (typeof CardSystem !== 'undefined' && CardSystem.generateCard) {
        newCard = CardSystem.generateCard({ rarity: rarity });
      } else {
        // Fallback mock card
        newCard = {
          id: 'fabricated_' + Date.now() + '_' + i,
          name: 'Fabricated ' + rarity.charAt(0).toUpperCase() + rarity.slice(1),
          emoji: '⚙️',
          rarity: rarity,
          lifecycleType: 'disposable'
        };
      }

      if (newCard) {
        var depositResult = _depositCard(newCard);
        spawnedCards.push({
          card: newCard,
          deposited: depositResult.success,
          location: depositResult.location,
          currency: depositResult.currency
        });
      }
    }

    return {
      success: true,
      cards: spawnedCards,
      count: spawnCount
    };
  }

  /**
   * Duplicate a purchased card
   * @param {Object} card - Card to duplicate
   * @param {Object} item - Thrift Ghost item
   * @returns {Object} Duplicate result
   */
  function _duplicateCard(card, item) {
    // Check for triple proc (upgraded only)
    var duplicateCount = 1;
    if (item.triple_chance && Math.random() < item.triple_chance) {
      duplicateCount = 2;  // Creates 2 duplicates (total 3 with original)
      console.log('[PassiveItemsSystem] Triple triggered!');
    }

    // Check for perfect echo
    var isPerfectEcho = false;
    if (item.perfect_echo_chance && Math.random() < item.perfect_echo_chance) {
      isPerfectEcho = true;
      console.log('[PassiveItemsSystem] Perfect Echo triggered!');
    }

    var duplicates = [];

    for (var i = 0; i < duplicateCount; i++) {
      var duplicate = JSON.parse(JSON.stringify(card));  // Deep clone
      duplicate.id = card.id + '_duplicate_' + Date.now() + '_' + i;

      // Apply perfect echo upgrades
      if (isPerfectEcho) {
        duplicate.name += ' [Perfect Echo]';
        // Upgrade: reduce cost if it exists
        if (duplicate.cost && duplicate.cost > 0) {
          duplicate.cost = Math.max(0, duplicate.cost - 1);
        }
        // Or add effect bonus
        if (duplicate.damage) {
          duplicate.damage = Math.floor(duplicate.damage * 1.2);
        }
      }

      var depositResult = _depositCard(duplicate);
      duplicates.push({
        card: duplicate,
        deposited: depositResult.success,
        location: depositResult.location,
        currency: depositResult.currency,
        isPerfectEcho: isPerfectEcho
      });
    }

    return {
      success: true,
      duplicates: duplicates,
      count: duplicateCount
    };
  }

  /**
   * Deposit card with priority: hand → action bar → inventory → currency
   * @param {Object} card - Card to deposit
   * @returns {Object} Deposit result
   */
  function _depositCard(card) {
    if (typeof GAMESTATE === 'undefined') {
      return { success: false, reason: 'GAMESTATE_NOT_FOUND' };
    }

    var state = GAMESTATE.getState();

    // Priority 1: Hand (if < 5)
    if (state.cardHand && state.cardHand.length < 5) {
      state.cardHand.push(card);

      // Update hand display
      if (typeof HandFanComponent !== 'undefined' && HandFanComponent.updateCards) {
        HandFanComponent.updateCards(state.cardHand);
      }

      return { success: true, location: 'hand' };
    }

    // Priority 2: Action bar (if < 4)
    if (state.actionButtonCards && state.actionButtonCards.length < 4) {
      state.actionButtonCards.push(card);
      return { success: true, location: 'action_bar' };
    }

    // Priority 3: Inventory (if < 12)
    var inventory = GAMESTATE.getLooseInventory ? GAMESTATE.getLooseInventory() : [];
    if (inventory.length < 12) {
      inventory.push(card);
      return { success: true, location: 'inventory' };
    }

    // Priority 4: Convert to currency shard
    var currencyShard = _calculateCurrencyShard(card);
    state.cryptos += currencyShard;

    // Update currency display
    if (typeof UIControls !== 'undefined' && UIControls.updateCurrency) {
      UIControls.updateCurrency(state.cryptos);
    }

    console.log('[PassiveItemsSystem] Inventory full, converted to currency:', currencyShard);
    return { success: true, location: 'currency', currency: currencyShard };
  }

  /**
   * Calculate currency shard value based on rarity
   * @param {Object} card - Card
   * @returns {number} Currency value
   */
  function _calculateCurrencyShard(card) {
    var rarityValues = {
      common: { min: 15, max: 30 },
      uncommon: { min: 25, max: 45 },
      rare: { min: 40, max: 60 },
      power: { min: 50, max: 80 }
    };

    var rarity = (card.rarity || 'common').toLowerCase();
    var range = rarityValues[rarity] || rarityValues.common;

    return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
  }

  /**
   * Trigger scrapper visual feedback
   */
  function _triggerScrapperVisual() {
    var debriefScreen = document.getElementById('debrief-screen');
    if (!debriefScreen) return;

    // Add spark animation class
    debriefScreen.classList.add('scrapper-proc-active');

    setTimeout(function() {
      debriefScreen.classList.remove('scrapper-proc-active');
    }, 800);

    // MOK feedback
    if (typeof MokUX !== 'undefined') {
      MokUX.speak('♻️ Fabricated new card!', 'POSITIVE');
    }
  }

  /**
   * Trigger thrift ghost visual feedback
   */
  function _triggerThriftVisual() {
    var debriefScreen = document.getElementById('debrief-screen');
    if (!debriefScreen) return;

    // Add ghost animation class
    debriefScreen.classList.add('thrift-proc-active');

    setTimeout(function() {
      debriefScreen.classList.remove('thrift-proc-active');
    }, 800);

    // MOK feedback
    if (typeof MokUX !== 'undefined') {
      MokUX.speak('👻 Purchase echoed!', 'POSITIVE');
    }
  }

  /**
   * Increase passive slots (for upgrades/unlocks)
   * @param {number} count - Number of slots to add
   */
  function increasePassiveSlots(count) {
    _passiveSlots = Math.min(_maxPassiveSlots, _passiveSlots + count);
    console.log('[PassiveItemsSystem] Passive slots:', _passiveSlots);
  }

  /**
   * Get passive item by ID
   * @param {string} itemId - Item ID
   * @returns {Object} Item data
   */
  function getPassiveItem(itemId) {
    return PASSIVE_ITEMS_DB[itemId.toUpperCase()];
  }

  /**
   * Get all passive items
   * @returns {Object} All passive items
   */
  function getAllPassiveItems() {
    return PASSIVE_ITEMS_DB;
  }

  /**
   * Get total stealth bonus from equipped passive items
   * @param {number} currentQuality - Current item quality (0-100)
   * @returns {number} Total stealth bonus
   */
  function getEquippedStealthBonus(currentQuality) {
    var totalBonus = 0;

    for (var i = 0; i < _equippedPassives.length; i++) {
      var itemId = _equippedPassives[i];
      var item = PASSIVE_ITEMS_DB[itemId];

      if (item && item.stealth_bonus) {
        // Check if quality meets minimum requirement
        var minQuality = item.stealth_bonus_min_quality || 0;
        if (currentQuality >= minQuality) {
          totalBonus += item.stealth_bonus;
        }
      }
    }

    return totalBonus;
  }

  /**
   * Get player avatar override from equipped items
   * @returns {string|null} Avatar emoji or null if no override
   */
  function getPlayerAvatarOverride() {
    for (var i = 0; i < _equippedPassives.length; i++) {
      var itemId = _equippedPassives[i];
      var item = PASSIVE_ITEMS_DB[itemId];

      if (item && item.player_avatar_override && item.is_active_effect) {
        return item.player_avatar_override;
      }
    }

    return null;
  }

  /**
   * Check and break items based on trigger reason
   * @param {string} reason - Break reason ('combat' or 'run')
   * @returns {Array} Array of broken item IDs
   */
  function checkAndBreakItems(reason) {
    var brokenItems = [];

    for (var i = _equippedPassives.length - 1; i >= 0; i--) {
      var itemId = _equippedPassives[i];
      var item = PASSIVE_ITEMS_DB[itemId];

      if (!item) continue;

      var shouldBreak = false;

      if (reason === 'combat' && item.breaks_on_combat) {
        shouldBreak = true;
      } else if (reason === 'run' && item.breaks_on_run) {
        shouldBreak = true;
      }

      if (shouldBreak) {
        // Remove from equipped
        _equippedPassives.splice(i, 1);
        brokenItems.push(itemId);

        console.log('[PassiveItemsSystem] Item broken:', item.name, 'Reason:', reason);

        // Visual feedback
        if (typeof MokUX !== 'undefined') {
          MokUX.speak('💥 ' + item.name + ' broke!', 'WARNING');
        }
      }
    }

    return brokenItems;
  }

  // Public API
  return {
    init: init,
    equipPassive: equipPassive,
    unequipPassive: unequipPassive,
    getEquippedPassives: getEquippedPassives,
    hasSynergy: hasSynergy,
    handleDisposal: handleDisposal,
    handlePurchase: handlePurchase,
    increasePassiveSlots: increasePassiveSlots,
    getPassiveItem: getPassiveItem,
    getAllPassiveItems: getAllPassiveItems,
    getEquippedStealthBonus: getEquippedStealthBonus,
    getPlayerAvatarOverride: getPlayerAvatarOverride,
    checkAndBreakItems: checkAndBreakItems,
    TRIGGER_EVENTS: TRIGGER_EVENTS,
    PASSIVE_ITEMS_DB: PASSIVE_ITEMS_DB
  };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    PassiveItemsSystem.init();
  });
} else {
  PassiveItemsSystem.init();
}
