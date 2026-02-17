/* ============================================================
   EYES ONLY - Secret Floor System
   Hidden floors accessed through system exploitation
   ============================================================ */

const SecretFloors = (function () {
  'use strict';

  // Secret floor types
  var SECRET_FLOOR_TYPES = {
    GRAY_CAVE_HIDDEN: 'gray_cave_hidden',     // Safe but uncanny connective tissue
    GOBLIN_VAULT: 'goblin_vault',             // 80% chance - treasure maze
    UBER_MEGA: 'uber_mega'                     // 20% chance - reality breaker
  };

  // Entry triggers
  var TRIGGER_TYPES = {
    WRONG_ITEM_SAFE_ZONE: 'wrong_item_safe_zone',
    COMBAT_NO_COMBAT_ZONE: 'combat_no_combat_zone',
    GOBLIN_TIMEOUT: 'goblin_timeout',
    BOSS_OVERKILL: 'boss_overkill',
    LOW_HP_HIGH_GOLD: 'low_hp_high_gold'
  };

  // State tracking
  var _playerSuspicion = 0;
  var _suspicionThreshold = 3;
  var _secretFloorQueue = [];
  var _triggersUsed = {}; // Track which triggers have been used
  var _currentSecretFloor = null;

  /**
   * Initialize secret floor system
   */
  function init() {
    _playerSuspicion = 0;
    _secretFloorQueue = [];
    _triggersUsed = {};
    _currentSecretFloor = null;
  }

  /**
   * Check if a trigger condition is met
   * @param {string} triggerType - Type of trigger
   * @param {object} data - Contextual data for the trigger
   * @returns {boolean} - Whether trigger succeeded
   */
  function checkTrigger(triggerType, data) {
    data = data || {};

    switch (triggerType) {
      case TRIGGER_TYPES.WRONG_ITEM_SAFE_ZONE:
        // Player used an item marked as "wrong" in a safe zone
        return data.inSafeZone && data.itemHasSecretTag;

      case TRIGGER_TYPES.COMBAT_NO_COMBAT_ZONE:
        // Combat triggered in a no-combat area (70% chance)
        return data.inNoCombatZone && Math.random() < 0.7;

      case TRIGGER_TYPES.GOBLIN_TIMEOUT:
        // Player failed to kill treasure goblin in time
        return data.goblinTimeExpired;

      case TRIGGER_TYPES.BOSS_OVERKILL:
        // Dealt 200%+ damage to a boss
        return data.damageDealt > (data.bossMaxHp * 2);

      case TRIGGER_TYPES.LOW_HP_HIGH_GOLD:
        // Entered elevator with low HP and high gold
        var hpThreshold = data.playerMaxHp * 0.25; // 25% or less
        var goldThreshold = 1000; // G > 1000
        return data.playerHp < hpThreshold && data.playerGold > goldThreshold && Math.random() < 0.15;

      default:
        return false;
    }
  }

  /**
   * Trigger a secret floor entry
   * @param {string} triggerType - Type of trigger that fired
   * @param {object} data - Contextual data
   * @returns {object} - Result with success flag and floor type
   */
  function triggerSecretFloor(triggerType, data) {
    if (!checkTrigger(triggerType, data)) {
      return { success: false, reason: 'Condition not met' };
    }

    // Increment player suspicion
    _playerSuspicion++;

    // Check if suspicion threshold reached
    if (_playerSuspicion < _suspicionThreshold) {
      return {
        success: false,
        reason: 'Suspicion building...',
        suspicion: _playerSuspicion,
        threshold: _suspicionThreshold
      };
    }

    // Determine secret floor type
    var floorType = _determineSecretFloorType(triggerType);

    // Queue the secret floor
    _secretFloorQueue.push({
      type: floorType,
      trigger: triggerType,
      data: data
    });

    // Mark trigger as used
    _triggersUsed[triggerType] = (_triggersUsed[triggerType] || 0) + 1;

    return {
      success: true,
      floorType: floorType,
      suspicion: _playerSuspicion,
      message: _getSecretFloorMessage(floorType)
    };
  }

  /**
   * Determine which secret floor type to spawn
   * @param {string} triggerType - Trigger that fired
   * @returns {string} - Secret floor type
   */
  function _determineSecretFloorType(triggerType) {
    // Goblin vault trigger always spawns goblin floor or uber mega
    if (triggerType === TRIGGER_TYPES.GOBLIN_TIMEOUT) {
      return Math.random() < 0.8 ? SECRET_FLOOR_TYPES.GOBLIN_VAULT : SECRET_FLOOR_TYPES.UBER_MEGA;
    }

    // Boss overkill has high chance of uber mega
    if (triggerType === TRIGGER_TYPES.BOSS_OVERKILL) {
      return Math.random() < 0.5 ? SECRET_FLOOR_TYPES.UBER_MEGA : SECRET_FLOOR_TYPES.GOBLIN_VAULT;
    }

    // Other triggers: 80% goblin vault, 20% uber mega
    return Math.random() < 0.8 ? SECRET_FLOOR_TYPES.GOBLIN_VAULT : SECRET_FLOOR_TYPES.UBER_MEGA;
  }

  /**
   * Get flavor message for secret floor discovery
   */
  function _getSecretFloorMessage(floorType) {
    switch (floorType) {
      case SECRET_FLOOR_TYPES.GOBLIN_VAULT:
        return '⚠️ ANOMALY DETECTED... SPACE WARPING...';
      case SECRET_FLOOR_TYPES.UBER_MEGA:
        return '⚠️⚠️⚠️ REALITY BREACH... YOU SHOULD NOT BE HERE...';
      case SECRET_FLOOR_TYPES.GRAY_CAVE_HIDDEN:
        return '✨ A hidden path reveals itself...';
      default:
        return '??? UNKNOWN FLOOR ???';
    }
  }

  /**
   * Check if there's a queued secret floor
   * @returns {boolean}
   */
  function hasQueuedSecretFloor() {
    return _secretFloorQueue.length > 0;
  }

  /**
   * Pop the next secret floor from queue
   * @returns {object|null}
   */
  function popSecretFloor() {
    if (_secretFloorQueue.length === 0) return null;

    _currentSecretFloor = _secretFloorQueue.shift();
    return _currentSecretFloor;
  }

  /**
   * Get current secret floor
   */
  function getCurrentSecretFloor() {
    return _currentSecretFloor;
  }

  /**
   * Clear current secret floor (when player exits)
   */
  function clearCurrentSecretFloor() {
    _currentSecretFloor = null;
  }

  /**
   * Get player suspicion level
   */
  function getSuspicion() {
    return _playerSuspicion;
  }

  /**
   * Increment suspicion (for non-trigger events that build tension)
   */
  function incrementSuspicion(amount) {
    amount = amount || 1;
    _playerSuspicion += amount;
    return _playerSuspicion;
  }

  /**
   * Reset suspicion (after secret floor is accessed)
   */
  function resetSuspicion() {
    _playerSuspicion = 0;
  }

  /**
   * Get statistics for debugging
   */
  function getStats() {
    return {
      suspicion: _playerSuspicion,
      threshold: _suspicionThreshold,
      queuedFloors: _secretFloorQueue.length,
      triggersUsed: Object.assign({}, _triggersUsed),
      currentFloor: _currentSecretFloor
    };
  }

  // Public API
  return {
    init: init,
    SECRET_FLOOR_TYPES: SECRET_FLOOR_TYPES,
    TRIGGER_TYPES: TRIGGER_TYPES,
    checkTrigger: checkTrigger,
    triggerSecretFloor: triggerSecretFloor,
    hasQueuedSecretFloor: hasQueuedSecretFloor,
    popSecretFloor: popSecretFloor,
    getCurrentSecretFloor: getCurrentSecretFloor,
    clearCurrentSecretFloor: clearCurrentSecretFloor,
    getSuspicion: getSuspicion,
    incrementSuspicion: incrementSuspicion,
    resetSuspicion: resetSuspicion,
    getStats: getStats
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SecretFloors;
}
