/* ============================================================
   EYES ONLY - Ground Effects System
   Environmental hazards that affect movement and combat
   ============================================================ */

const GroundEffects = (function () {
  'use strict';

  // Ground effect types
  var GROUND_TYPES = {
    NORMAL: 'normal',
    OIL: 'oil',
    OIL_IGNITED: 'oil_ignited',
    FIRE: 'fire',
    WATER: 'water',
    INDUSTRIAL_WASTE: 'industrial_waste',
    GLASS: 'glass',
    SODA_SPILL: 'soda_spill',
    STEAM: 'steam',
    ICE: 'ice',
    DARKENED: 'darkened',
    CONDUCTIVE: 'conductive',
    RADIANT: 'radiant',
    OBSCURED: 'obscured',
    SONIC: 'sonic',
    RESONANCE: 'resonance'
  };

  // Ground effect definitions
  var GROUND_EFFECTS = {
    OIL: {
      emoji: '🛢️',
      char: '≈',
      color: '#4a3f35',
      movePenalty: 0.1,          // Slight movement slow
      dodgeBonus: 0.15,          // +15% dodge distance (slippery)
      fireVulnerability: 2.0,    // 2x fire damage
      canIgnite: true,
      description: 'Slippery oil puddle'
    },
    OIL_IGNITED: {
      emoji: '🔥',
      char: '≋',
      color: '#ff6600',
      damage: 2,                 // 2 HP per turn
      spreads: true,
      spreadChance: 0.3,
      spreadRate: 1,             // Spreads to 1 adjacent tile per turn
      blocksPath: true,
      lightRadius: 4,
      lightColor: '#ff6600',
      description: 'Burning oil - spreading fire!'
    },
    FIRE: {
      emoji: '🔥',
      char: '▒',
      color: '#ff3300',
      damage: 1,                 // 1 HP per turn
      destroysWeakEnemies: true,
      removeStealth: true,       // Fire lights you up
      lightRadius: 3,
      lightColor: '#ff7722',
      burnCardChance: 0.5,       // 50% chance to add burn card in STR
      description: 'Flames'
    },
    WATER: {
      emoji: '💧',
      char: '~',
      color: '#4a90e2',
      movePenalty: 0.2,          // 20% movement slow
      extinguishesFire: true,
      increasesFootstepNoise: true,
      evasionPenalty: 0.1,       // -10% evasion in STR
      shockVulnerability: 1.5,   // Future: 1.5x shock damage
      removesBurnStatus: true,
      description: 'Standing water'
    },
    INDUSTRIAL_WASTE: {
      emoji: '☢️',
      char: '░',
      color: '#7cfc00',
      damage: 1,                 // Poison DOT
      mutationChance: 0.05,      // 5% chance of mutation
      corruptsDrops: true,       // Items dropped here are corrupted
      randomDebuffChance: 0.3,   // 30% chance of debuff when combat starts
      description: 'Toxic industrial waste'
    },
    GLASS: {
      emoji: '✨',
      char: '·',
      color: '#e0e0e0',
      noisyMovement: true,       // Makes noise when stepped on
      damageOnSprint: 1,         // Damage if moving fast
      description: 'Broken glass'
    },
    SODA_SPILL: {
      emoji: '🥤',
      char: '≈',
      color: '#8b4513',
      sticky: true,
      movePenalty: 0.15,         // Sticky, slows movement
      description: 'Sticky soda spill'
    },
    STEAM: {
      emoji: '💨',
      char: '≈',
      color: '#cccccc',
      obscuresVision: true,      // Reduces sight range
      damage: 0.5,               // Minor heat damage
      dissipates: true,          // Fades over time
      lifetime: 5,               // Seconds before dissipating
      description: 'Hot steam'
    },
    ICE: {
      emoji: '🧊',
      char: '·',
      color: '#b3e5ff',
      movePenalty: -0.15,        // Negative penalty = speed boost
      slippery: true,
      // STR combat penalties
      accuracyPenaltyPct: 12,    // -12% hit chance
      evasionPenaltyPts: 2,      // -2 evasion points (each = 5% miss)
      description: 'Frozen surface (fast but slippery)'
    },
    DARKENED: {
      emoji: '🌑',
      char: '▓',
      color: '#1a1a2e',
      lightLevel: 0,             // Floor light level reduced to 0
      stealthBonus: 0.25,        // +25% stealth
      shadowBoost: 1,            // Shadow-type cards gain +1 effect
      disableSolar: true,        // Solar-type cards disabled
      description: 'Darkened ground - stealth boosted, shadow cards enhanced'
    },
    CONDUCTIVE: {
      emoji: '⚡',
      char: '≋',
      color: '#4169e1',
      electricalAmplify: 2.0,    // 2x electrical effects
      metalVulnerability: 1.5,   // Metal-tag enemies take bonus damage
      shockDamage: 1,            // Player also vulnerable
      description: 'Conductive field - electricity effects doubled'
    },
    RADIANT: {
      emoji: '🌞',
      char: '◈',
      color: '#ffeb3b',
      lightLevel: 10,            // Maximum light level
      shadowDamage: 2,           // Damage to shadow-aligned enemies
      removeStealth: true,       // Removes stealth
      accuracyBonus: 10,         // +10% accuracy
      description: 'Radiant ground - bright luminous tiles'
    },
    OBSCURED: {
      emoji: '💨',
      char: '≈',
      color: '#808080',
      accuracyPenalty: -15,      // -15% accuracy for all units
      visibilityReduction: -50,  // -50% visibility
      stealthBonus: 0.15,        // +15% stealth
      dissipates: true,
      lifetime: 8,               // Seconds before dissipating
      description: 'Dense smoke cloud - heavily obscured'
    },
    SONIC: {
      emoji: '🔊',
      char: '~',
      color: '#9c27b0',
      sonicAmplify: 1.5,         // 1.5x sonic effects
      accuracyPenalty: -3,       // -3% accuracy (minor disorient)
      applyRinging: true,        // Applies ringing status
      lifetime: 8,               // Seconds
      description: 'Sonic vibrations - amplifies sound effects'
    },
    RESONANCE: {
      emoji: '🎤',
      char: '◊',
      color: '#e91e63',
      costReduction: 99,         // Next Sonic card costs 0
      sonicTag: true,            // Applies to sonic tag
      lightInteractionBoost: 2.0, // 2x light interactions
      lifetime: 6,               // Seconds
      description: 'Resonance field - free sonic cards'
    }
  };

  // Active ground effects on the map
  var _groundMap = {}; // key: "x,y", value: { type, ... }

  /**
   * Initialize ground effects system
   */
  function init() {
    _groundMap = {};
  }

  /**
   * Set ground effect at position
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {string} type - Ground effect type
   * @param {object} overrides - Override default properties
   */
  function setGroundEffect(x, y, type, overrides) {
    if (!GROUND_EFFECTS[type]) {
      console.warn('[GroundEffects] Unknown ground type:', type);
      return false;
    }

    var key = x + ',' + y;
    var effect = Object.assign({}, GROUND_EFFECTS[type]);

    if (overrides) {
      Object.assign(effect, overrides);
    }

    effect.x = x;
    effect.y = y;
    effect.type = type;
    effect.spawnTime = Date.now();

    _groundMap[key] = effect;
    return true;
  }

  /**
   * Get ground effect at position
   * @param {number} x - X position
   * @param {number} y - Y position
   * @returns {object|null} - Ground effect or null
   */
  function getGroundEffect(x, y) {
    var key = x + ',' + y;
    return _groundMap[key] || null;
  }

  /**
   * Remove ground effect at position
   */
  function removeGroundEffect(x, y) {
    var key = x + ',' + y;
    delete _groundMap[key];
  }

  /**
   * Clear all ground effects
   */
  function clearAll() {
    _groundMap = {};
  }

  /**
   * Update ground effects (spreading, dissipating, etc.)
   * @param {number} deltaMs - Time since last update
   * @param {number} gridWidth - Grid width
   * @param {number} gridHeight - Grid height
   */
  function update(deltaMs, gridWidth, gridHeight) {
    var now = Date.now();
    var effectsToAdd = [];
    var effectsToRemove = [];

    Object.keys(_groundMap).forEach(function(key) {
      var effect = _groundMap[key];

      // Handle dissipating effects
      if (effect.dissipates && effect.lifetime) {
        var age = (now - effect.spawnTime) / 1000; // Age in seconds
        if (age > effect.lifetime) {
          effectsToRemove.push(key);
          return;
        }
      }

      // Handle spreading effects (fire)
      if (effect.spreads && effect.spreadChance) {
        if (Math.random() < effect.spreadChance * (deltaMs / 1000)) {
          // Try to spread to adjacent tile
          var directions = [
            { dx: 1, dy: 0 },
            { dx: -1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: 0, dy: -1 }
          ];

          var dir = directions[Math.floor(Math.random() * directions.length)];
          var newX = effect.x + dir.dx;
          var newY = effect.y + dir.dy;

          // Check bounds
          if (newX >= 0 && newX < gridWidth && newY >= 0 && newY < gridHeight) {
            var targetKey = newX + ',' + newY;
            var targetEffect = _groundMap[targetKey];

            // Can spread to oil (ignite it) or empty tiles
            if (!targetEffect || targetEffect.type === GROUND_TYPES.OIL) {
              effectsToAdd.push({
                x: newX,
                y: newY,
                type: effect.type
              });
            }
          }
        }
      }
    });

    // Apply removals
    effectsToRemove.forEach(function(key) {
      delete _groundMap[key];
    });

    // Apply additions
    effectsToAdd.forEach(function(data) {
      setGroundEffect(data.x, data.y, data.type);
    });
  }

  /**
   * Ignite oil at position
   * @param {number} x - X position
   * @param {number} y - Y position
   * @returns {boolean} - Whether ignition succeeded
   */
  function igniteOil(x, y) {
    var effect = getGroundEffect(x, y);
    if (effect && effect.canIgnite) {
      setGroundEffect(x, y, GROUND_TYPES.OIL_IGNITED);
      return true;
    }
    return false;
  }

  /**
   * Extinguish fire at position (using water)
   * @param {number} x - X position
   * @param {number} y - Y position
   * @returns {boolean} - Whether extinguish succeeded
   */
  function extinguishFire(x, y) {
    var effect = getGroundEffect(x, y);
    if (effect && (effect.type === GROUND_TYPES.FIRE || effect.type === GROUND_TYPES.OIL_IGNITED)) {
      removeGroundEffect(x, y);
      // Replace with steam
      setGroundEffect(x, y, GROUND_TYPES.STEAM);

      // Also remove the light emission if LightingSystem is available
      if (typeof LightingSystem !== 'undefined' && LightingSystem.removeLightSource) {
        LightingSystem.removeLightSource(x, y);
      }

      return true;
    }
    return false;
  }

  /**
   * Calculate movement penalty at position
   * @param {number} x - X position
   * @param {number} y - Y position
   * @returns {number} - Movement penalty (0-1, where 0 = no penalty, 1 = blocked)
   */
  function getMovementPenalty(x, y) {
    var effect = getGroundEffect(x, y);
    if (!effect) return 0;

    if (effect.blocksPath) return 1.0;
    // movePenalty may be negative (ice speed boost)
    return (typeof effect.movePenalty === 'number') ? effect.movePenalty : 0;
  }

  /**
   * Calculate damage taken from standing on ground effect
   * @param {number} x - X position
   * @param {number} y - Y position
   * @returns {number} - Damage per turn
   */
  function getDamage(x, y) {
    var effect = getGroundEffect(x, y);
    return effect ? (effect.damage || 0) : 0;
  }

  /**
   * Get STR combat modifiers from ground effect
   * @param {number} x - X position
   * @param {number} y - Y position
   * @returns {object} - Modifiers object
   */
  function getSTRModifiers(x, y) {
    var effect = getGroundEffect(x, y);
    if (!effect) {
      return {
        initiative: 0,
        evasion: 0,
        damage: 1.0,
        addCard: null,
        debuff: null
      };
    }

    var modifiers = {
      initiative: 0,
      evasion: 0,
      damage: 1.0,
      addCard: null,
      debuff: null
    };

    // Oil gives enemy advantage unless player has fire
    if (effect.type === GROUND_TYPES.OIL) {
      modifiers.initiative = -1; // Enemy gets +1 initiative
    }

    // Fire reduces evasion and may add burn card
    if (effect.type === GROUND_TYPES.FIRE || effect.type === GROUND_TYPES.OIL_IGNITED) {
      modifiers.evasion = -0.2; // -20% evasion
      if (Math.random() < (effect.burnCardChance || 0)) {
        modifiers.addCard = 'BURN';
      }
    }

    // Water reduces evasion
    if (effect.type === GROUND_TYPES.WATER) {
      modifiers.evasion = effect.evasionPenalty || -0.1;
    }

    // Ice: speed up but reduce evasion (accuracy handled at combat layer)
    if (effect.type === GROUND_TYPES.ICE) {
      modifiers.evasion = -0.2;
    }

    // Industrial waste gives random debuff
    if (effect.type === GROUND_TYPES.INDUSTRIAL_WASTE) {
      if (Math.random() < (effect.randomDebuffChance || 0.3)) {
        var debuffs = ['POISON', 'WEAK', 'SLOW', 'BLIND'];
        modifiers.debuff = debuffs[Math.floor(Math.random() * debuffs.length)];
      }
    }

    return modifiers;
  }

  /**
   * Get all ground effects as array
   * @returns {Array} - Array of ground effects
   */
  function getAllEffects() {
    return Object.keys(_groundMap).map(function(key) {
      return _groundMap[key];
    });
  }

  /**
   * Get ground effect definition
   * @param {string} type - Ground type
   * @returns {object|null} - Effect definition
   */
  function getDefinition(type) {
    return GROUND_EFFECTS[type] || null;
  }

  function getGroundAt(x, y) {
    return getGroundEffect(x, y);
  }

  function freezeAt(x, y, opts) {
    opts = opts || {};
    var effect = getGroundEffect(x, y);
    if (effect && (effect.type === GROUND_TYPES.WATER || effect.type === GROUND_TYPES.INDUSTRIAL_WASTE)) {
      setGroundEffect(x, y, GROUND_TYPES.ICE, {
        dissipates: true,
        lifetime: (typeof opts.lifetime === 'number') ? opts.lifetime : 10
      });
      return true;
    }

    // If empty, allow direct ice placement
    if (!effect) {
      setGroundEffect(x, y, GROUND_TYPES.ICE, {
        dissipates: true,
        lifetime: (typeof opts.lifetime === 'number') ? opts.lifetime : 10
      });
      return true;
    }

    return false;
  }

  // Locomotive passability gate: water/waste are not passable unless frozen to ICE.
  function isLocomotivePassable(x, y) {
    var effect = getGroundEffect(x, y);
    if (!effect) return true;
    if (effect.type === GROUND_TYPES.ICE) return true;
    if (effect.type === GROUND_TYPES.WATER || effect.type === GROUND_TYPES.INDUSTRIAL_WASTE) return false;
    return true;
  }

  // Public API
  return {
    init: init,
    GROUND_TYPES: GROUND_TYPES,
    setGroundEffect: setGroundEffect,
    getGroundEffect: getGroundEffect,
    getGroundAt: getGroundAt,
    removeGroundEffect: removeGroundEffect,
    clearAll: clearAll,
    update: update,
    igniteOil: igniteOil,
    extinguishFire: extinguishFire,
    getMovementPenalty: getMovementPenalty,
    getDamage: getDamage,
    getSTRModifiers: getSTRModifiers,
    freezeAt: freezeAt,
    isLocomotivePassable: isLocomotivePassable,
    getAllEffects: getAllEffects,
    getDefinition: getDefinition
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GroundEffects;
}
