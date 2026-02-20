/* ============================================================
   EYES ONLY - Pet Follower System
   Ultra-lightweight companion system using position history echo
   ============================================================ */

const PetFollower = (function () {
  'use strict';

  // Pet tier types
  var PET_TIERS = {
    RUMBA: 'rumba',           // Cosmetic follower with tiny passive buff
    HUMANOID: 'humanoid',     // Breaks nearby breakables
    MEGA: 'mega'              // Engages STR combat with bonuses
  };

  // Pet quality levels
  var PET_QUALITIES = {
    COMMON: { name: 'Common', breakChance: 0.20, breakRadius: 1, statMultiplier: 1.0 },
    UNCOMMON: { name: 'Uncommon', breakChance: 0.35, breakRadius: 1, statMultiplier: 1.2 },
    RARE: { name: 'Rare', breakChance: 0.50, breakRadius: 2, statMultiplier: 1.5 },
    MEGA: { name: 'Mega', breakChance: 0.75, breakRadius: 2, statMultiplier: 2.0 }
  };

  // Active pets (max 1 mega, multiple rumba/humanoid)
  var _activePets = [];

  // Position history buffer size
  var HISTORY_SIZE = 16;

  /**
   * Pet object structure
   */
  function createPet(type, quality, emoji, name, passiveEffect) {
    var delayIndex = 4; // Default delay

    // Set delay based on tier
    if (type === PET_TIERS.RUMBA) {
      delayIndex = 4;
    } else if (type === PET_TIERS.HUMANOID) {
      delayIndex = 3;
    } else if (type === PET_TIERS.MEGA) {
      delayIndex = 2;
    }

    return {
      type: type,
      quality: quality || 'COMMON',
      emoji: emoji,
      name: name,
      x: 0,
      y: 0,
      facing: 'south',
      delayIndex: delayIndex,
      orbitRadius: 0.5,
      orbitAngle: 0,
      opacity: 0.8,
      passiveEffect: passiveEffect || null,
      idleTimer: 0,
      alive: true,
      deathTimer: null,
      acquisitionTime: Date.now()
    };
  }

  /**
   * Add a pet to active pets list
   * Enforces jealousy rules (only 1 mega allowed)
   */
  function addPet(pet) {
    // Check jealousy system - only 1 mega allowed
    if (pet.type === PET_TIERS.MEGA) {
      var existingMega = _activePets.find(function(p) { return p.type === PET_TIERS.MEGA; });
      if (existingMega) {
        console.warn('[PetFollower] Jealousy system: Cannot add mega pet, one already exists');
        return false;
      }
    }

    _activePets.push(pet);
    console.log('[PetFollower] Added pet:', pet.name, 'Tier:', pet.type);

    // Initialize death timer based on quality
    _initDeathTimer(pet);

    return true;
  }

  /**
   * Remove a pet from active pets
   */
  function removePet(petIndex) {
    if (petIndex >= 0 && petIndex < _activePets.length) {
      var pet = _activePets.splice(petIndex, 1)[0];
      console.log('[PetFollower] Removed pet:', pet.name);
      return pet;
    }
    return null;
  }

  /**
   * Initialize death timer for pet based on quality
   */
  function _initDeathTimer(pet) {
    var qualityData = PET_QUALITIES[pet.quality];
    if (!qualityData) return;

    // Death time: 5-15 minutes based on quality
    var baseTime = 300000; // 5 minutes in ms
    var qualityBonus = qualityData.statMultiplier * 600000; // Up to 10 more minutes
    var randomFactor = _rng() * 0.5 + 0.75; // 75-125% of time

    var deathTime = (baseTime + qualityBonus) * randomFactor;
    pet.deathTimer = Date.now() + deathTime;

    console.log('[PetFollower] Pet death timer set:', Math.floor(deathTime / 60000), 'minutes');
  }

  /**
   * Update all pets positions based on player position history
   */
  function updatePets(playerPositionHistory, currentTime) {
    if (!playerPositionHistory || playerPositionHistory.length === 0) return;

    for (var i = 0; i < _activePets.length; i++) {
      var pet = _activePets[i];

      // Check death timer
      if (pet.deathTimer && currentTime >= pet.deathTimer) {
        pet.alive = false;
        console.log('[PetFollower] Pet died:', pet.name);
        removePet(i);
        i--; // Adjust index after removal
        continue;
      }

      // Get delayed position from history
      var historyIndex = Math.min(pet.delayIndex, playerPositionHistory.length - 1);
      var targetPos = playerPositionHistory[historyIndex];

      if (!targetPos) continue;

      // Apply orbit offset for subtle circling effect
      var angle = (currentTime * 0.001) + (i * 1.0); // Stagger pets
      var orbitOffsetX = Math.cos(angle) * pet.orbitRadius;
      var orbitOffsetY = Math.sin(angle) * pet.orbitRadius;

      // Update pet position with lerp for smoothness
      pet.x = targetPos.x + orbitOffsetX;
      pet.y = targetPos.y + orbitOffsetY;
      pet.facing = targetPos.facing || 'south';

      // Grid-bound pets snap to grid (non-humanoid only)
      if (pet.type !== PET_TIERS.HUMANOID) {
        pet.x = Math.round(pet.x);
        pet.y = Math.round(pet.y);
      }
    }
  }

  /**
   * Check and break nearby breakables for humanoid pets
   */
  function checkBreakables(breakables, onBreak) {
    for (var i = 0; i < _activePets.length; i++) {
      var pet = _activePets[i];

      if (pet.type !== PET_TIERS.HUMANOID) continue;

      var qualityData = PET_QUALITIES[pet.quality];
      if (!qualityData) continue;

      var petX = Math.round(pet.x);
      var petY = Math.round(pet.y);

      // Check adjacency based on quality radius
      for (var j = breakables.length - 1; j >= 0; j--) {
        var breakable = breakables[j];
        var dx = Math.abs(breakable.x - petX);
        var dy = Math.abs(breakable.y - petY);

        if (dx <= qualityData.breakRadius && dy <= qualityData.breakRadius) {
          // Roll for break chance
          if (_rng() < qualityData.breakChance) {
            if (onBreak) {
              onBreak(breakable, j);
            }
          }
        }
      }
    }
  }

  /**
   * Apply STR combat modifiers for mega pets
   */
  function applyCombatModifiers(combat) {
    var megaPet = _activePets.find(function(p) { return p.type === PET_TIERS.MEGA; });
    if (!megaPet) return;

    var qualityData = PET_QUALITIES[megaPet.quality];
    if (!qualityData) return;

    // Accuracy bonus
    var accuracyBonus = qualityData.statMultiplier * 5; // 5-10% based on quality
    if (combat.playerAccuracy !== undefined) {
      combat.playerAccuracy += accuracyBonus;
    }

    // Crit multiplier based on enemy status
    var critBonus = 0;
    if (combat.enemyStatus && combat.enemyStatus.stunned) {
      critBonus = qualityData.statMultiplier * 0.4; // Doubled if stunned
    } else if (combat.enemyStatus && combat.enemyStatus.intensity) {
      critBonus = combat.enemyStatus.intensity * 0.2;
    }

    if (combat.playerCritMultiplier !== undefined) {
      combat.playerCritMultiplier += critBonus;
    }

    // 5% chance for Tanya auto-strike
    if (_rng() < 0.05) {
      combat.petAutoStrike = true;
      combat.petStrikeDamage = Math.floor(3 * qualityData.statMultiplier);
    }

    console.log('[PetFollower] Mega pet combat modifiers applied');
  }

  /**
   * Apply passive effects from pets
   */
  function applyPassiveEffects(player, gameState) {
    for (var i = 0; i < _activePets.length; i++) {
      var pet = _activePets[i];

      if (pet.type !== PET_TIERS.RUMBA || !pet.passiveEffect) continue;

      // Apply passive effect
      if (pet.passiveEffect.scrapProc) {
        // Handled externally
      }
      if (pet.passiveEffect.stealthGrace) {
        player.stealthGrace = (player.stealthGrace || 0) + pet.passiveEffect.stealthGrace;
      }
      if (pet.passiveEffect.dropChance) {
        // Handled externally in loot calculation
      }
    }
  }

  /**
   * Get all active pets
   */
  function getActivePets() {
    return _activePets;
  }

  /**
   * Check if player has a mega pet
   */
  function hasMegaPet() {
    return _activePets.some(function(p) { return p.type === PET_TIERS.MEGA; });
  }

  /**
   * Get total passive bonus for specific effect
   */
  function getPassiveBonus(effectType) {
    var total = 0;
    for (var i = 0; i < _activePets.length; i++) {
      var pet = _activePets[i];
      if (pet.passiveEffect && pet.passiveEffect[effectType]) {
        total += pet.passiveEffect[effectType];
      }
    }
    return total;
  }

  /**
   * Clear all pets
   */
  function clearPets() {
    _activePets = [];
  }

  /**
   * RNG helper - uses SeededRNG if available
   */
  function _rng() {
    if (typeof SeededRNG !== 'undefined' && SeededRNG.random) {
      return SeededRNG.random();
    }
    return Math.random();
  }

  // Public API
  return {
    PET_TIERS: PET_TIERS,
    PET_QUALITIES: PET_QUALITIES,
    createPet: createPet,
    addPet: addPet,
    removePet: removePet,
    updatePets: updatePets,
    checkBreakables: checkBreakables,
    applyCombatModifiers: applyCombatModifiers,
    applyPassiveEffects: applyPassiveEffects,
    getActivePets: getActivePets,
    hasMegaPet: hasMegaPet,
    getPassiveBonus: getPassiveBonus,
    clearPets: clearPets
  };
})();
