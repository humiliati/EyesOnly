/* ============================================================
   EYES ONLY - Loot Table Manager
   Centralized loot generation and drop management
   ============================================================ */

const LootTableManager = (function () {
  'use strict';

  var _lootTables = null;
  var _loaded = false;

  /**
   * Load loot tables from JSON file
   * @returns {Promise} - Resolves when tables are loaded
   */
  async function loadLootTables() {
    if (_loaded && _lootTables) {
      return _lootTables;
    }

    try {
      const response = await fetch('/data/loot-tables.json');
      if (!response.ok) {
        throw new Error('Failed to load loot tables: ' + response.status);
      }
      _lootTables = await response.json();
      _loaded = true;
      console.log('[LootTableManager] Loot tables loaded successfully (v' + _lootTables.version + ')');
      return _lootTables;
    } catch (error) {
      console.error('[LootTableManager] Error loading loot tables:', error);
      // Return default empty tables
      _lootTables = _getDefaultTables();
      _loaded = true;
      return _lootTables;
    }
  }

  /**
   * Get default loot tables if loading fails
   * @returns {Object} - Default loot table structure
   */
  function _getDefaultTables() {
    return {
      version: '1.0.0',
      enemy_loot: {},
      breakable_loot: {},
      item_loot_tables: {},
      card_drop_modifiers: {},
      special_drops: {},
      decay_times: { currency: 20, card: 30, item: 30 },
      economy_settings: {}
    };
  }

  /**
   * Ensure loot tables are loaded
   * @returns {Object} - Loot tables
   */
  function _ensureLoaded() {
    if (!_loaded || !_lootTables) {
      console.warn('[LootTableManager] Tables not loaded, using defaults');
      _lootTables = _getDefaultTables();
      _loaded = true;
    }
    return _lootTables;
  }

  /**
   * Roll enemy loot
   * @param {String} enemyTier - Enemy tier (standard, elite, boss, scout)
   * @param {Object} context - Additional context {mythicKill, source, floorNum}
   * @returns {Object} - Generated loot {currency, cards, items, xp}
   */
  function rollEnemyLoot(enemyTier, context) {
    _ensureLoaded();

    context = context || {};
    var loot = {
      currency: 0,
      cards: [],
      items: [],
      xp: 0
    };

    var tierConfig = _lootTables.enemy_loot[enemyTier];
    if (!tierConfig) {
      console.warn('[LootTableManager] Unknown enemy tier:', enemyTier);
      return loot;
    }

    // Roll currency
    if (tierConfig.currency && tierConfig.currency.enabled) {
      if (Math.random() < tierConfig.currency.chance) {
        var min = tierConfig.currency.min;
        var max = tierConfig.currency.max;
        loot.currency = Math.floor(Math.random() * (max - min + 1)) + min;
      }
    }

    // Roll card
    if (tierConfig.card && tierConfig.card.enabled) {
      var cardChance = tierConfig.card.chance;

      // Apply source modifier
      if (context.source && _lootTables.card_drop_modifiers.combat_source) {
        var sourceModifier = _lootTables.card_drop_modifiers.combat_source[context.source] || 1.0;
        cardChance *= sourceModifier;
      }

      if (Math.random() < cardChance) {
        var card = {
          type: 'card'
        };

        // Determine quality
        if (tierConfig.card.quality) {
          card.quality = tierConfig.card.quality;
        } else if (tierConfig.card.quality_weights) {
          card.quality = _rollWeightedQuality(tierConfig.card.quality_weights);
        }

        card.guaranteed = tierConfig.card.guaranteed || false;
        loot.cards.push(card);
      }
    }

    // Roll synergy card (boss only)
    if (enemyTier === 'boss' && tierConfig.synergy_card && tierConfig.synergy_card.enabled) {
      if (Math.random() < tierConfig.synergy_card.chance) {
        loot.cards.push({
          type: 'synergy_card',
          quality: tierConfig.synergy_card.quality,
          guaranteed: true
        });
      }
    }

    // Roll whisper item (boss only)
    if (enemyTier === 'boss' && tierConfig.whisper_item && tierConfig.whisper_item.enabled) {
      if (Math.random() < tierConfig.whisper_item.chance) {
        loot.items.push({
          type: 'whisper',
          source: 'boss'
        });
      }
    }

    // Mythic synergy card (boss only, mythic kill)
    if (enemyTier === 'boss' && context.mythicKill && tierConfig.mythic_synergy_card) {
      loot.cards.push({
        type: 'synergy_card',
        quality: tierConfig.mythic_synergy_card.quality,
        guaranteed: true,
        mythic: true
      });
    }

    // Roll charm
    if (tierConfig.charm && tierConfig.charm.enabled) {
      if (Math.random() < tierConfig.charm.chance) {
        loot.items.push({
          type: 'charm',
          charmType: tierConfig.charm.type
        });
      }
    }

    // Assign XP
    loot.xp = tierConfig.xp || 0;

    return loot;
  }

  /**
   * Roll weighted quality
   * @param {Object} weights - Quality weights {CRACKED: 18, WORN: 22, ...}
   * @returns {String} - Quality name
   */
  function _rollWeightedQuality(weights) {
    var totalWeight = 0;
    for (var quality in weights) {
      totalWeight += weights[quality];
    }

    var roll = Math.random() * totalWeight;
    var cumulative = 0;

    for (var q in weights) {
      cumulative += weights[q];
      if (roll <= cumulative) {
        return q;
      }
    }

    return 'STANDARD'; // Fallback
  }

  /**
   * Roll breakable loot
   * @param {String} breakableType - Type of breakable
   * @param {String} biome - Current biome
   * @returns {Object} - Generated loot {currency, ammo, items}
   */
  function rollBreakableLoot(breakableType, biome) {
    _ensureLoaded();

    var loot = {
      currency: 0,
      ammo: 0,
      items: []
    };

    var defaultConfig = _lootTables.breakable_loot.default;
    var biomeConfig = _lootTables.breakable_loot.biomes[biome];
    var typeConfig = biomeConfig && biomeConfig.types ? biomeConfig.types[breakableType] : null;

    // Roll currency
    var currencyChance = defaultConfig.currency.chance;
    var currencyBonus = typeConfig && typeConfig.currency_bonus ? typeConfig.currency_bonus : 0;

    if (Math.random() < (currencyChance + currencyBonus)) {
      var min = defaultConfig.currency.min;
      var max = defaultConfig.currency.max;
      loot.currency = Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Roll ammo
    if (Math.random() < defaultConfig.ammo.chance) {
      var ammoMin = defaultConfig.ammo.min;
      var ammoMax = defaultConfig.ammo.max;
      loot.ammo = Math.floor(Math.random() * (ammoMax - ammoMin + 1)) + ammoMin;
    }

    // Roll items
    var itemChance = typeConfig && typeConfig.item_chance !== undefined
      ? typeConfig.item_chance
      : defaultConfig.item.chance;

    if (Math.random() < itemChance) {
      // Check for specific loot table
      if (typeConfig && typeConfig.loot_table) {
        var rolledItem = rollFromItemTable(typeConfig.loot_table);
        if (rolledItem) {
          loot.items.push(rolledItem);
        }
      } else if (typeConfig && typeConfig.drops) {
        // Generic drops
        loot.items.push({
          type: 'generic',
          drops: typeConfig.drops
        });
      }
    }

    return loot;
  }

  /**
   * Roll from item loot table
   * @param {String} tableKey - Loot table key
   * @returns {Object|null} - Rolled item or null
   */
  function rollFromItemTable(tableKey) {
    _ensureLoaded();

    var table = _lootTables.item_loot_tables[tableKey];
    if (!table || table.length === 0) {
      return null;
    }

    // Calculate total weight
    var totalWeight = 0;
    for (var i = 0; i < table.length; i++) {
      totalWeight += table[i].weight;
    }

    // Roll weighted random
    var roll = Math.random() * totalWeight;
    var cumulative = 0;

    for (var j = 0; j < table.length; j++) {
      cumulative += table[j].weight;
      if (roll <= cumulative) {
        return {
          emoji: table[j].emoji,
          name: table[j].name,
          quantity: table[j].quantity
        };
      }
    }

    return table[0]; // Fallback to first item
  }

  /**
   * Get card drop modifier for biome and floor
   * @param {String} cardType - Card base type
   * @param {String} biome - Current biome
   * @param {Number} floorNum - Current floor number
   * @returns {Number} - Drop weight modifier
   */
  function getCardDropModifier(cardType, biome, floorNum) {
    _ensureLoaded();

    var modifier = 1.0;

    // Biome weight
    if (_lootTables.card_drop_modifiers.biome_weights[biome]) {
      var biomeWeights = _lootTables.card_drop_modifiers.biome_weights[biome];
      if (biomeWeights[cardType]) {
        modifier *= biomeWeights[cardType];
      }
    }

    // Floor scaling
    var floorScaling = _lootTables.card_drop_modifiers.floor_scaling;
    if (floorScaling) {
      for (var tier in floorScaling) {
        var range = floorScaling[tier].range;
        if (floorNum >= range[0] && floorNum <= range[1]) {
          // Determine if card is basic or advanced (simplified logic)
          var isBasic = ['Single Shot', 'Block', 'Dodge', 'Close Distance'].indexOf(cardType) !== -1;
          if (isBasic && floorScaling[tier].basic_card_weight) {
            modifier *= floorScaling[tier].basic_card_weight;
          } else if (!isBasic && floorScaling[tier].advanced_card_weight) {
            modifier *= floorScaling[tier].advanced_card_weight;
          }
          break;
        }
      }
    }

    return modifier;
  }

  /**
   * Get decay time for item type
   * @param {String} itemType - Item type (currency, card, item, consumable)
   * @returns {Number} - Decay time in seconds
   */
  function getDecayTime(itemType) {
    _ensureLoaded();

    return _lootTables.decay_times[itemType] || 30;
  }

  /**
   * Get economy settings
   * @returns {Object} - Economy settings
   */
  function getEconomySettings() {
    _ensureLoaded();

    return _lootTables.economy_settings || {};
  }

  /**
   * Get loot tables (for editor)
   * @returns {Object} - Full loot tables
   */
  function getLootTables() {
    _ensureLoaded();

    return _lootTables;
  }

  /**
   * Update loot tables (for editor)
   * @param {Object} newTables - New loot table data
   */
  function updateLootTables(newTables) {
    _lootTables = newTables;
    console.log('[LootTableManager] Loot tables updated');
  }

  /**
   * Validate loot table structure
   * @param {Object} tables - Loot tables to validate
   * @returns {Object} - {valid: boolean, errors: []}
   */
  function validateLootTables(tables) {
    var errors = [];

    if (!tables) {
      errors.push('Loot tables object is null or undefined');
      return { valid: false, errors: errors };
    }

    if (!tables.version) {
      errors.push('Missing version field');
    }

    if (!tables.enemy_loot) {
      errors.push('Missing enemy_loot section');
    } else {
      var requiredTiers = ['standard', 'elite', 'boss', 'scout'];
      for (var i = 0; i < requiredTiers.length; i++) {
        if (!tables.enemy_loot[requiredTiers[i]]) {
          errors.push('Missing enemy tier: ' + requiredTiers[i]);
        }
      }
    }

    if (!tables.breakable_loot) {
      errors.push('Missing breakable_loot section');
    }

    if (!tables.item_loot_tables) {
      errors.push('Missing item_loot_tables section');
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Export loot tables as JSON string
   * @returns {String} - JSON string
   */
  function exportLootTables() {
    _ensureLoaded();

    return JSON.stringify(_lootTables, null, 2);
  }

  /**
   * Import loot tables from JSON string
   * @param {String} jsonString - JSON string
   * @returns {Object} - {success: boolean, error: string}
   */
  function importLootTables(jsonString) {
    try {
      var tables = JSON.parse(jsonString);
      var validation = validateLootTables(tables);

      if (!validation.valid) {
        return {
          success: false,
          error: 'Validation failed: ' + validation.errors.join(', ')
        };
      }

      _lootTables = tables;
      _loaded = true;

      return {
        success: true,
        error: null
      };
    } catch (error) {
      return {
        success: false,
        error: 'Parse error: ' + error.message
      };
    }
  }

  // Public API
  return {
    loadLootTables: loadLootTables,
    rollEnemyLoot: rollEnemyLoot,
    rollBreakableLoot: rollBreakableLoot,
    rollFromItemTable: rollFromItemTable,
    getCardDropModifier: getCardDropModifier,
    getDecayTime: getDecayTime,
    getEconomySettings: getEconomySettings,
    getLootTables: getLootTables,
    updateLootTables: updateLootTables,
    validateLootTables: validateLootTables,
    exportLootTables: exportLootTables,
    importLootTables: importLootTables
  };
})();

// Auto-load on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    LootTableManager.loadLootTables();
  });
} else {
  LootTableManager.loadLootTables();
}

// Make available globally
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LootTableManager;
}
