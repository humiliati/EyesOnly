/* ============================================================
   EYES ONLY - Elite Enemy System
   Mini-boss encounters based on nerfed boss mechanics
   ============================================================ */

const EliteEnemies = (function () {
  'use strict';

  /**
   * Elite Enemy Types (based on boss templates but scaled down)
   */
  var ELITE_TYPES = {
    TRANSIT_ENFORCER: {
      name: 'Transit Enforcer',
      emoji: '🚧',
      hp: 10,
      minFloor: 5,
      traits: ['Explosive Resistance'],
      behavior: 'LANE_CHARGER',
      sightRange: 6,
      moveSpeed: 2,
      description: 'Moves in horizontal lanes at high speed',
      drop: {
        card: 'DASH',
        currency: '5-8'
      }
    },
    SPOTTER_DRONE: {
      name: 'Spotter Drone',
      emoji: '📡',
      hp: 5,
      minFloor: 3,
      traits: ['Paint Target'],
      behavior: 'PAINTER',
      sightRange: 8,
      moveSpeed: 1,
      description: 'Paints targets for reinforcements',
      drop: {
        card: 'JAMMER',
        currency: '3-5'
      }
    },
    PYROMANIAC: {
      name: 'Pyromaniac',
      emoji: '🔥',
      hp: 8,
      minFloor: 12,
      traits: ['Fire Trail'],
      behavior: 'FIRE_TRAIL',
      sightRange: 5,
      moveSpeed: 1,
      description: 'Leaves fire tiles behind',
      drop: {
        card: 'EXPLOSIVE_SHOT',
        currency: '6-10'
      }
    },
    HEAVY_DRIFTER: {
      name: 'Heavy Drifter',
      emoji: '🛡️',
      hp: 15,
      minFloor: 8,
      traits: ['Armored', 'Slow'],
      behavior: 'TANK',
      sightRange: 4,
      moveSpeed: 0.5,
      description: 'High HP, slow movement, takes less damage',
      drop: {
        card: 'DEFENSIVE_STANCE',
        currency: '8-12'
      }
    },
    GHOST_OPERATIVE: {
      name: 'Ghost Operative',
      emoji: '👤',
      hp: 6,
      minFloor: 10,
      traits: ['Stealth', 'High Detection'],
      behavior: 'STEALTH_HUNTER',
      sightRange: 10,
      moveSpeed: 1,
      description: 'Detects player even in shadows',
      drop: {
        card: 'SMOKE_GRENADE',
        currency: '7-11'
      }
    }
  };

  /**
   * Intent icons for enemy actions (MGS-style telegraphing)
   */
  var INTENT_ICONS = {
    SCANNING: '👁️',      // Enemy is searching/scanning
    ALERTED: '❗',      // Enemy detected something
    REINFORCING: '🛡️',  // Enemy calling for backup
    TARGETING: '🎯',     // Enemy about to attack
    SUSPICIOUS: '❓',    // Enemy investigating
    PATROLLING: '➡️'    // Enemy on patrol
  };

  /**
   * Create an Elite enemy instance
   */
  function createElite(type, x, y, floorNum) {
    var template = ELITE_TYPES[type];
    if (!template) {
      console.error('Unknown elite type:', type);
      return null;
    }

    // Check if floor is high enough for this elite
    if (floorNum < template.minFloor) {
      return null;
    }

    var elite = {
      x: x,
      y: y,
      hp: template.hp,
      maxHp: template.hp,
      isElite: true,
      eliteType: type,
      name: template.name,
      emoji: template.emoji,
      traits: template.traits,
      behavior: template.behavior,
      sightRange: template.sightRange,
      moveSpeed: template.moveSpeed,
      description: template.description,
      drop: template.drop,

      // Behavior state
      intent: 'PATROLLING',
      intentIcon: INTENT_ICONS.PATROLLING,
      lastIntent: null,
      awareness: 0,
      paintedTurns: 0, // For SPOTTER_DRONE
      fireTrail: [],   // For PYROMANIAC
      orientation: 'east',

      // Visual state for pulsing effect
      glowPhase: 0,
      glowColor: '#ff00ff',

      // Enemy deck key (Phase 1)
      deckType: type
    };

    // Phase 1: attach enemy card deck + exposedTags
    try {
      if (typeof EnemyDeckHydrator !== 'undefined' && EnemyDeckHydrator.hydrate) {
        EnemyDeckHydrator.hydrate(elite, floorNum);
      }
    } catch (e0) {}

    return elite;
  }

  /**
   * Update elite enemy behavior
   */
  function updateElite(elite, player, grid, deltaMs) {
    if (!elite || !elite.isElite) return;

    // Update glow animation phase
    elite.glowPhase = (elite.glowPhase + deltaMs / 100) % 360;

    // Update intent based on awareness
    if (elite.awareness >= 100) {
      elite.intent = 'TARGETING';
      elite.intentIcon = INTENT_ICONS.TARGETING;
    } else if (elite.awareness >= 70) {
      elite.intent = 'ALERTED';
      elite.intentIcon = INTENT_ICONS.ALERTED;
    } else if (elite.awareness >= 30) {
      elite.intent = 'SUSPICIOUS';
      elite.intentIcon = INTENT_ICONS.SUSPICIOUS;
    } else if (elite.awareness >= 10) {
      elite.intent = 'SCANNING';
      elite.intentIcon = INTENT_ICONS.SCANNING;
    } else {
      elite.intent = 'PATROLLING';
      elite.intentIcon = INTENT_ICONS.PATROLLING;
    }

    // Execute behavior-specific logic
    switch (elite.behavior) {
      case 'LANE_CHARGER':
        _updateLaneCharger(elite, player, grid);
        break;
      case 'PAINTER':
        _updatePainter(elite, player);
        break;
      case 'FIRE_TRAIL':
        _updateFireTrail(elite, grid);
        break;
      case 'TANK':
        _updateTank(elite, player);
        break;
      case 'STEALTH_HUNTER':
        _updateStealthHunter(elite, player, grid);
        break;
    }
  }

  /**
   * Lane Charger behavior - charges horizontally when player is in lane
   */
  function _updateLaneCharger(elite, player, grid) {
    // Check if player is in the same horizontal lane
    if (Math.abs(elite.y - player.y) <= 1) {
      elite.intent = 'TARGETING';
      elite.intentIcon = INTENT_ICONS.TARGETING;

      // Charge towards player
      var dx = player.x > elite.x ? 1 : -1;
      var newX = elite.x + (dx * elite.moveSpeed);

      // Update position (caller will handle collision)
      elite.targetX = Math.floor(newX);
    }
  }

  /**
   * Painter behavior - paints targets for reinforcements
   */
  function _updatePainter(elite, player) {
    // Check distance to player
    var dist = Math.abs(elite.x - player.x) + Math.abs(elite.y - player.y);

    if (dist <= elite.sightRange && elite.awareness >= 50) {
      elite.intent = 'REINFORCING';
      elite.intentIcon = INTENT_ICONS.REINFORCING;
      elite.paintedTurns++;

      // After 3 turns of painting, spawn reinforcements (handled by caller)
      if (elite.paintedTurns >= 3) {
        elite.shouldSpawnReinforcement = true;
        elite.paintedTurns = 0;
      }
    } else {
      elite.paintedTurns = Math.max(0, elite.paintedTurns - 1);
    }
  }

  /**
   * Fire Trail behavior - leaves fire tiles behind
   */
  function _updateFireTrail(elite, grid) {
    // Add current position to fire trail
    if (!elite.fireTrail) elite.fireTrail = [];

    elite.fireTrail.push({ x: elite.x, y: elite.y, age: 0 });

    // Update trail ages and remove old tiles
    elite.fireTrail = elite.fireTrail.filter(function(tile) {
      tile.age++;
      return tile.age < 3; // Fire lasts 3 turns
    });
  }

  /**
   * Tank behavior - slow but high HP, takes reduced damage
   */
  function _updateTank(elite, player) {
    // Tank behavior is mostly passive - damage reduction handled elsewhere
    if (elite.awareness >= 70) {
      elite.intent = 'REINFORCING';
      elite.intentIcon = INTENT_ICONS.REINFORCING;
    }
  }

  /**
   * Stealth Hunter behavior - detects player even in stealth
   */
  function _updateStealthHunter(elite, player, grid) {
    // Enhanced detection - ignores stealth bonuses
    var dist = Math.abs(elite.x - player.x) + Math.abs(elite.y - player.y);

    if (dist <= elite.sightRange) {
      elite.intent = 'SCANNING';
      elite.intentIcon = INTENT_ICONS.SCANNING;

      if (dist <= 5) {
        elite.intent = 'TARGETING';
        elite.intentIcon = INTENT_ICONS.TARGETING;
      }
    }
  }

  /**
   * Get elite types available for a given floor
   */
  function getAvailableElites(floorNum) {
    var available = [];
    for (var type in ELITE_TYPES) {
      if (ELITE_TYPES[type].minFloor <= floorNum) {
        available.push(type);
      }
    }
    return available;
  }

  /**
   * Get random elite type for floor
   */
  function getRandomEliteForFloor(floorNum) {
    var available = getAvailableElites(floorNum);
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
  }

  /**
   * Check if elite should spawn on this floor
   * Base rate: 10% chance, increases with floor depth
   */
  function shouldSpawnElite(floorNum) {
    if (floorNum < 3) return false; // No elites before floor 3

    var baseChance = 0.10;
    var floorBonus = Math.min(0.30, floorNum * 0.02); // Cap at 40% total
    var chance = baseChance + floorBonus;

    return Math.random() < chance;
  }

  /**
   * Apply damage to elite (with trait modifiers)
   */
  function damageElite(elite, amount, damageType) {
    if (!elite || !elite.isElite) return amount;

    var actualDamage = amount;

    // Apply trait modifiers
    if (elite.traits) {
      if (elite.traits.indexOf('Explosive Resistance') !== -1 && damageType === 'explosive') {
        actualDamage = Math.floor(amount * 0.5); // 50% reduction
      }
      if (elite.traits.indexOf('Armored') !== -1) {
        actualDamage = Math.floor(amount * 0.7); // 30% reduction
      }
    }

    elite.hp = Math.max(0, elite.hp - actualDamage);
    return actualDamage;
  }

  // Public API
  return {
    ELITE_TYPES: ELITE_TYPES,
    INTENT_ICONS: INTENT_ICONS,
    createElite: createElite,
    updateElite: updateElite,
    getAvailableElites: getAvailableElites,
    getRandomEliteForFloor: getRandomEliteForFloor,
    shouldSpawnElite: shouldSpawnElite,
    damageElite: damageElite
  };
})();

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EliteEnemies;
}
