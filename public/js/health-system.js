/* ============================================================
   EYES ONLY - Health System
   Centralized health state management for player and enemies
   ============================================================ */

const HealthSystem = (function () {
  'use strict';

  // Health thresholds
  var MIN_SURVIVAL_HP = 0.01;  // Below this = death
  var DEATH_HP_THRESHOLD = 0.00;  // Explicit death value

  /**
   * Create a health state object
   * @param {number} maxHP - Maximum hit points
   * @returns {Object} Health state
   */
  function createHealthState(maxHP) {
    return {
      currentHP: maxHP,
      maxHP: maxHP,
      tempHP: 0,  // Temporary HP from shields, buffs
      damageReduction: 0,  // Flat damage reduction
      percentageReduction: 0,  // Percentage-based reduction (0-100)
      isDead: false,
      deathReason: null,
      deathTimestamp: null
    };
  }

  /**
   * Apply damage to a health state
   * @param {Object} healthState - Health state object
   * @param {number} rawDamage - Raw damage amount
   * @param {Object} options - Damage options {source, ignoreReduction, isCrit}
   * @returns {Object} Damage result {actualDamage, tempHPLost, realHPLost, killed, overkill}
   */
  function applyDamage(healthState, rawDamage, options) {
    options = options || {};

    if (healthState.isDead) {
      return {
        actualDamage: 0,
        tempHPLost: 0,
        realHPLost: 0,
        killed: false,
        overkill: 0
      };
    }

    // Calculate damage reduction
    var damage = rawDamage;

    if (!options.ignoreReduction) {
      // Apply percentage reduction first
      if (healthState.percentageReduction > 0) {
        damage = damage * (1 - (healthState.percentageReduction / 100));
      }

      // Then flat reduction
      if (healthState.damageReduction > 0) {
        damage = Math.max(1, damage - healthState.damageReduction); // Always at least 1 damage
      }
    }

    damage = Math.max(0, Math.floor(damage));
    var actualDamage = damage;
    var tempHPLost = 0;
    var realHPLost = 0;

    // Apply to temp HP first
    if (healthState.tempHP > 0) {
      if (damage <= healthState.tempHP) {
        tempHPLost = damage;
        healthState.tempHP -= damage;
        damage = 0;
      } else {
        tempHPLost = healthState.tempHP;
        damage -= healthState.tempHP;
        healthState.tempHP = 0;
      }
    }

    // Apply remaining damage to real HP
    if (damage > 0) {
      realHPLost = Math.min(damage, healthState.currentHP);
      healthState.currentHP -= realHPLost;
      healthState.currentHP = Math.max(0, healthState.currentHP);
    }

    // Check for death
    var killed = false;
    var overkill = 0;

    if (healthState.currentHP <= DEATH_HP_THRESHOLD) {
      killed = true;
      healthState.isDead = true;
      healthState.deathTimestamp = Date.now();
      overkill = Math.abs(healthState.currentHP);
      healthState.currentHP = 0;
    }

    return {
      actualDamage: actualDamage,
      tempHPLost: tempHPLost,
      realHPLost: realHPLost,
      killed: killed,
      overkill: overkill
    };
  }

  /**
   * Heal a health state
   * @param {Object} healthState - Health state object
   * @param {number} amount - Heal amount
   * @param {Object} options - Heal options {canOverheal}
   * @returns {Object} Heal result {actualHeal, overheal}
   */
  function heal(healthState, amount, options) {
    options = options || {};

    if (healthState.isDead) {
      return {
        actualHeal: 0,
        overheal: 0
      };
    }

    var oldHP = healthState.currentHP;
    var maxAllowed = options.canOverheal ? healthState.maxHP * 2 : healthState.maxHP;

    healthState.currentHP = Math.min(maxAllowed, healthState.currentHP + amount);

    var actualHeal = healthState.currentHP - oldHP;
    var overheal = amount - actualHeal;

    return {
      actualHeal: actualHeal,
      overheal: overheal
    };
  }

  /**
   * Add temporary HP
   * @param {Object} healthState - Health state object
   * @param {number} amount - Temp HP amount
   */
  function addTempHP(healthState, amount) {
    if (healthState.isDead) return;

    // Temp HP doesn't stack, take the higher value
    healthState.tempHP = Math.max(healthState.tempHP, amount);
  }

  /**
   * Set damage reduction
   * @param {Object} healthState - Health state object
   * @param {number} flatReduction - Flat damage reduction
   * @param {number} percentReduction - Percentage reduction (0-100)
   */
  function setDamageReduction(healthState, flatReduction, percentReduction) {
    healthState.damageReduction = Math.max(0, flatReduction || 0);
    healthState.percentageReduction = Math.max(0, Math.min(100, percentReduction || 0));
  }

  /**
   * Check if entity is dead
   * @param {Object} healthState - Health state object
   * @returns {boolean} True if dead
   */
  function isDead(healthState) {
    return healthState.isDead || healthState.currentHP <= DEATH_HP_THRESHOLD;
  }

  /**
   * Mark as dead with reason
   * @param {Object} healthState - Health state object
   * @param {string} reason - Death reason
   */
  function markDead(healthState, reason) {
    healthState.isDead = true;
    healthState.currentHP = 0;
    healthState.deathReason = reason;
    healthState.deathTimestamp = Date.now();
  }

  /**
   * Revive (for special cases)
   * @param {Object} healthState - Health state object
   * @param {number} hp - HP to revive with (defaults to 1)
   */
  function revive(healthState, hp) {
    healthState.isDead = false;
    healthState.currentHP = hp || 1;
    healthState.deathReason = null;
    healthState.deathTimestamp = null;
  }

  /**
   * Get HP percentage
   * @param {Object} healthState - Health state object
   * @returns {number} HP percentage (0-100)
   */
  function getHPPercentage(healthState) {
    if (healthState.maxHP <= 0) return 0;
    return (healthState.currentHP / healthState.maxHP) * 100;
  }

  /**
   * Get total effective HP (current + temp)
   * @param {Object} healthState - Health state object
   * @returns {number} Total effective HP
   */
  function getEffectiveHP(healthState) {
    return healthState.currentHP + healthState.tempHP;
  }

  // Public API
  return {
    MIN_SURVIVAL_HP: MIN_SURVIVAL_HP,
    DEATH_HP_THRESHOLD: DEATH_HP_THRESHOLD,
    createHealthState: createHealthState,
    applyDamage: applyDamage,
    heal: heal,
    addTempHP: addTempHP,
    setDamageReduction: setDamageReduction,
    isDead: isDead,
    markDead: markDead,
    revive: revive,
    getHPPercentage: getHPPercentage,
    getEffectiveHP: getEffectiveHP
  };
})();
