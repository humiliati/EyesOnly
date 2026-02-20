/* ============================================================
   EYES ONLY - Environmental Synergy System
   Key + Gate interactions, item + object combos
   ============================================================ */

const EnvironmentalSynergy = (function() {
  'use strict';

  // Synergy definitions for environmental combinations
  var SYNERGY_DEFINITIONS = {
    // Key Types and their compatible gates
    KEY_ITEMS: {
      RUSTY_KEY: {
        itemId: 'KEY_001',
        emoji: '🔑',
        name: 'Rusty Key',
        description: 'An old, rusted key. Might open something...',
        compatibleGates: ['WOODEN_GATE', 'OLD_DOOR'],
        consumeOnUse: true
      },
      BRONZE_KEY: {
        itemId: 'KEY_002',
        emoji: '🗝️',
        name: 'Bronze Key',
        description: 'A tarnished bronze key with ornate markings.',
        compatibleGates: ['BRONZE_GATE', 'MUSEUM_DOOR'],
        consumeOnUse: true
      },
      KEYCARD: {
        itemId: 'KEY_003',
        emoji: '💳',
        name: 'Security Keycard',
        description: 'Electronic access card. Still has charge.',
        compatibleGates: ['SECURITY_DOOR', 'LAB_ENTRANCE'],
        consumeOnUse: false // Can be reused
      },
      MASTER_KEY: {
        itemId: 'KEY_004',
        emoji: '🔐',
        name: 'Master Key',
        description: 'Opens all standard locks.',
        compatibleGates: ['WOODEN_GATE', 'OLD_DOOR', 'BRONZE_GATE', 'SECURITY_DOOR', 'TERMINAL_GATE'],
        consumeOnUse: false
      },
      THUMB_DRIVE: {
        itemId: 'KEY_005',
        emoji: '💾',
        name: 'Thumb Drive',
        description: 'Contains encrypted access credentials.',
        compatibleGates: ['TERMINAL_GATE', 'SERVER_RACK'],
        consumeOnUse: false, // Can be reused on multiple terminals
        biome: 'OFFICE'
      },
      ACCESS_CARD: {
        itemId: 'KEY_006',
        emoji: '🎫',
        name: 'Access Card',
        description: 'Aerospace facility access card. Permits elevator use.',
        compatibleGates: ['FLOOR_ELEVATOR', 'AEROSPACE_DOOR'],
        consumeOnUse: false, // Can be reused
        biome: 'AEROSPACE'
      },
      MALL_KEY: {
        itemId: 'KEY_007',
        emoji: '🏷️',
        name: 'Mall Security Tag',
        description: 'Security clearance for restricted mall areas.',
        compatibleGates: ['MALL_GATE', 'STORE_DOOR'],
        consumeOnUse: false,
        biome: 'SHOPPING_MALL'
      },
      INDUSTRIAL_PASS: {
        itemId: 'KEY_008',
        emoji: '🔧',
        name: 'Industrial Pass',
        description: 'Worker authorization for restricted industrial zones.',
        compatibleGates: ['FACTORY_GATE', 'HAZARD_DOOR'],
        consumeOnUse: false,
        biome: 'INDUSTRIAL'
      }
    },

    // Gate Types and their properties
    GATE_OBJECTS: {
      WOODEN_GATE: {
        objectId: 'GATE_001',
        emoji: '🚧',
        name: 'Wooden Gate',
        description: 'A weathered wooden gate blocks the path.',
        requiredKeys: ['RUSTY_KEY', 'MASTER_KEY'],
        blocksPath: true,
        unlockEmoji: '✓',
        unlockMessage: 'The gate creaks open...'
      },
      OLD_DOOR: {
        objectId: 'GATE_002',
        emoji: '🚪',
        name: 'Old Door',
        description: 'A locked wooden door.',
        requiredKeys: ['RUSTY_KEY', 'MASTER_KEY'],
        blocksPath: true,
        unlockEmoji: '✓',
        unlockMessage: 'The door unlocks with a click.'
      },
      BRONZE_GATE: {
        objectId: 'GATE_003',
        emoji: '🚪',
        name: 'Bronze Gate',
        description: 'An ornate bronze gate with ancient locks.',
        requiredKeys: ['BRONZE_KEY', 'MASTER_KEY'],
        blocksPath: true,
        unlockEmoji: '✨',
        unlockMessage: 'Ancient mechanisms grind open...'
      },
      SECURITY_DOOR: {
        objectId: 'GATE_004',
        emoji: '🚪',
        name: 'Security Door',
        description: 'Electronic lock with keycard reader.',
        requiredKeys: ['KEYCARD', 'MASTER_KEY'],
        blocksPath: true,
        unlockEmoji: '⚡',
        unlockMessage: 'Security door unlocks with a beep.'
      },
      MUSEUM_DOOR: {
        objectId: 'GATE_005',
        emoji: '🚪',
        name: 'Museum Door',
        description: 'Heavy museum display door.',
        requiredKeys: ['BRONZE_KEY', 'MASTER_KEY'],
        blocksPath: true,
        unlockEmoji: '🏛️',
        unlockMessage: 'The museum door opens silently.'
      },
      LAB_ENTRANCE: {
        objectId: 'GATE_006',
        emoji: '🚪',
        name: 'Lab Entrance',
        description: 'Sealed laboratory entrance.',
        requiredKeys: ['KEYCARD', 'MASTER_KEY'],
        blocksPath: true,
        unlockEmoji: '🔬',
        unlockMessage: 'Airlock hisses open.'
      },
      TERMINAL_GATE: {
        objectId: 'GATE_007',
        emoji: '💻',
        name: 'Locked Terminal',
        description: 'Terminal requires authentication.',
        requiredKeys: ['THUMB_DRIVE', 'MASTER_KEY'],
        blocksPath: true,
        unlockEmoji: '✓',
        unlockMessage: 'Terminal access granted. System unlocked.',
        biome: 'OFFICE',
        glowColor: '#00ffff', // Cyan glow for lighting system
        lightRadius: 4
      },
      SERVER_RACK: {
        objectId: 'GATE_008',
        emoji: '🖥️',
        name: 'Server Rack',
        description: 'Encrypted server cluster.',
        requiredKeys: ['THUMB_DRIVE', 'MASTER_KEY'],
        blocksPath: true,
        unlockEmoji: '⚡',
        unlockMessage: 'Server encryption bypassed.',
        biome: 'OFFICE',
        glowColor: '#00ffff',
        lightRadius: 3
      },
      FLOOR_ELEVATOR: {
        objectId: 'GATE_009',
        emoji: '🛗',
        name: 'Floor Elevator',
        description: 'Locked elevator to next floor. Requires access card.',
        requiredKeys: ['ACCESS_CARD', 'MASTER_KEY'],
        blocksPath: true,
        unlockEmoji: '⬆️',
        unlockMessage: 'Elevator activated. Access granted.',
        biome: 'AEROSPACE',
        isElevator: true  // Special flag for elevator mechanics
      },
      AEROSPACE_DOOR: {
        objectId: 'GATE_010',
        emoji: '🚪',
        name: 'Aerospace Door',
        description: 'Secure aerospace facility door.',
        requiredKeys: ['ACCESS_CARD', 'MASTER_KEY'],
        blocksPath: true,
        unlockEmoji: '🚀',
        unlockMessage: 'Aerospace door unlocks with authorization.',
        biome: 'AEROSPACE'
      },
      MALL_GATE: {
        objectId: 'GATE_011',
        emoji: '🚧',
        name: 'Mall Security Gate',
        description: 'Locked security gate blocking store access.',
        requiredKeys: ['MALL_KEY', 'MASTER_KEY'],
        blocksPath: true,
        unlockEmoji: '🏬',
        unlockMessage: 'Security gate retracts. Access granted.',
        biome: 'SHOPPING_MALL'
      },
      STORE_DOOR: {
        objectId: 'GATE_012',
        emoji: '🚪',
        name: 'Store Door',
        description: 'Locked store entrance.',
        requiredKeys: ['MALL_KEY', 'MASTER_KEY'],
        blocksPath: true,
        unlockEmoji: '🛍️',
        unlockMessage: 'Store door unlocks.',
        biome: 'SHOPPING_MALL'
      },
      FACTORY_GATE: {
        objectId: 'GATE_013',
        emoji: '⚠️',
        name: 'Factory Gate',
        description: 'Restricted industrial access point.',
        requiredKeys: ['INDUSTRIAL_PASS', 'MASTER_KEY'],
        blocksPath: true,
        unlockEmoji: '🏭',
        unlockMessage: 'Factory gate opens. Authorization verified.',
        biome: 'INDUSTRIAL'
      },
      HAZARD_DOOR: {
        objectId: 'GATE_014',
        emoji: '🚪',
        name: 'Hazard Door',
        description: 'Heavy door marked with hazard warnings.',
        requiredKeys: ['INDUSTRIAL_PASS', 'MASTER_KEY'],
        blocksPath: true,
        unlockEmoji: '☢️',
        unlockMessage: 'Hazard door unseals with a hiss.',
        biome: 'INDUSTRIAL'
      }
    },

    // Other environmental synergies
    ENVIRONMENTAL_COMBOS: {
      WATER_ELECTRICITY: {
        items: ['WATER_BOTTLE', 'BATTERY'],
        effect: 'Creates electrified water puddle',
        damageType: 'shock',
        areaEffect: true
      },
      OIL_FIRE: {
        items: ['OIL_SLICK', 'LIGHTER'],
        effect: 'Ignites oil creating fire zone',
        damageType: 'fire',
        areaEffect: true
      }
    }
  };

  // State management
  var _activeGates = []; // Gates in current floor
  var _unlockedGates = new Set(); // Track which gates have been unlocked
  var _playerInventory = null; // Reference to player inventory

  /**
   * Initialize the environmental synergy system
   */
  function init() {
    console.log('[EnvironmentalSynergy] System initialized');
  }

  /**
   * Register a gate object in the current floor
   * @param {Object} gate - Gate object with x, y, type
   */
  function registerGate(gate) {
    _activeGates.push(gate);
  }

  /**
   * Clear all gates (when changing floors)
   */
  function clearGates() {
    _activeGates = [];
    _unlockedGates.clear();
  }

  /**
   * Check if a key can unlock a gate
   * @param {string} keyId - Key item ID
   * @param {string} gateType - Gate type
   * @returns {boolean} True if compatible
   */
  function canUnlock(keyId, gateType) {
    var keyDef = SYNERGY_DEFINITIONS.KEY_ITEMS[keyId];
    if (!keyDef) return false;

    return keyDef.compatibleGates.indexOf(gateType) !== -1;
  }

  /**
   * Attempt to unlock a gate with a key
   * @param {string} keyId - Key item ID
   * @param {Object} gate - Gate object
   * @returns {Object} Result with success flag and message
   */
  function attemptUnlock(keyId, gate) {
    var keyDef = SYNERGY_DEFINITIONS.KEY_ITEMS[keyId];
    var gateDef = SYNERGY_DEFINITIONS.GATE_OBJECTS[gate.type];

    if (!keyDef || !gateDef) {
      return {
        success: false,
        message: 'Invalid key or gate',
        animation: null
      };
    }

    // Check compatibility
    if (!canUnlock(keyId, gate.type)) {
      return {
        success: false,
        message: 'This key doesn\'t fit...',
        animation: { type: 'shake', emoji: '❌' }
      };
    }

    // Check if already unlocked
    var gateKey = gate.x + ',' + gate.y;
    if (_unlockedGates.has(gateKey)) {
      return {
        success: false,
        message: 'Already unlocked',
        animation: null
      };
    }

    // Success! Unlock the gate
    _unlockedGates.add(gateKey);

    return {
      success: true,
      message: gateDef.unlockMessage,
      consumeKey: keyDef.consumeOnUse,
      animation: {
        type: 'doubleStack',
        emojis: [keyDef.emoji, gateDef.emoji],
        unlockEmoji: gateDef.unlockEmoji,
        duration: 1500
      },
      gate: gate
    };
  }

  /**
   * Get gate at specific position
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {Object|null} Gate object or null
   */
  function getGateAt(x, y) {
    for (var i = 0; i < _activeGates.length; i++) {
      if (_activeGates[i].x === x && _activeGates[i].y === y) {
        return _activeGates[i];
      }
    }
    return null;
  }

  /**
   * Check if position has an unlocked gate
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {boolean} True if unlocked
   */
  function isGateUnlocked(x, y) {
    var gateKey = x + ',' + y;
    return _unlockedGates.has(gateKey);
  }

  /**
   * Get all key definitions
   * @returns {Object} Key definitions
   */
  function getKeyDefinitions() {
    return SYNERGY_DEFINITIONS.KEY_ITEMS;
  }

  /**
   * Get all gate definitions
   * @returns {Object} Gate definitions
   */
  function getGateDefinitions() {
    return SYNERGY_DEFINITIONS.GATE_OBJECTS;
  }

  /**
   * Get biome-specific key types
   * @param {string} biomeName - Biome name (e.g., 'OFFICE', 'FOREST')
   * @returns {Array} Array of key type strings for this biome
   */
  function getKeysForBiome(biomeName) {
    var keys = [];
    for (var keyType in SYNERGY_DEFINITIONS.KEY_ITEMS) {
      var keyDef = SYNERGY_DEFINITIONS.KEY_ITEMS[keyType];
      if (keyDef.biome === biomeName || !keyDef.biome) {
        // Include keys with matching biome or no biome restriction
        keys.push(keyType);
      }
    }
    return keys;
  }

  /**
   * Get biome-specific gate types
   * @param {string} biomeName - Biome name (e.g., 'OFFICE', 'FOREST')
   * @returns {Array} Array of gate type strings for this biome
   */
  function getGatesForBiome(biomeName) {
    var gates = [];
    for (var gateType in SYNERGY_DEFINITIONS.GATE_OBJECTS) {
      var gateDef = SYNERGY_DEFINITIONS.GATE_OBJECTS[gateType];
      if (gateDef.biome === biomeName || !gateDef.biome) {
        // Include gates with matching biome or no biome restriction
        gates.push(gateType);
      }
    }
    return gates;
  }

  /**
   * Check if an item is a key
   * @param {string} itemId - Item ID to check
   * @returns {boolean} True if item is a key
   */
  function isKeyItem(itemId) {
    return SYNERGY_DEFINITIONS.KEY_ITEMS.hasOwnProperty(itemId);
  }

  /**
   * Get key info by ID
   * @param {string} keyId - Key ID
   * @returns {Object|null} Key definition or null
   */
  function getKeyInfo(keyId) {
    return SYNERGY_DEFINITIONS.KEY_ITEMS[keyId] || null;
  }

  /**
   * Serialize state for save/load
   * @returns {Object} Serialized state
   */
  function serialize() {
    return {
      unlockedGates: Array.from(_unlockedGates)
    };
  }

  /**
   * Deserialize state from save
   * @param {Object} data - Saved state
   */
  function deserialize(data) {
    if (data && data.unlockedGates) {
      _unlockedGates = new Set(data.unlockedGates);
    }
  }

  // Public API
  return {
    init: init,
    registerGate: registerGate,
    clearGates: clearGates,
    canUnlock: canUnlock,
    attemptUnlock: attemptUnlock,
    getGateAt: getGateAt,
    isGateUnlocked: isGateUnlocked,
    getKeyDefinitions: getKeyDefinitions,
    getGateDefinitions: getGateDefinitions,
    getKeysForBiome: getKeysForBiome,
    getGatesForBiome: getGatesForBiome,
    isKeyItem: isKeyItem,
    getKeyInfo: getKeyInfo,
    serialize: serialize,
    deserialize: deserialize
  };
})();
