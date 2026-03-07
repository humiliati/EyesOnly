/* ============================================================
   AwarenessConfig — Single source of truth for enemy awareness
   state thresholds, color codes, and detection ranges.

   IIFE module — loads before gone-rogue.js.
   Consumed by: EnemyAISystem, STR Combat Engine, BreakableSystem,
   ExplosionSystem, and the monolith's _raiseNoise().
   ============================================================ */
var AwarenessConfig = (function () {
  'use strict';

  // ── Awareness state definitions ────────────────────────────
  // min/max define the awareness value ranges.
  // color is the HUD indicator color.
  var _states = {
    UNAWARE:    { min: 0,   max: 30,  color: '#00ff00', name: 'UNAWARE' },
    SUSPICIOUS: { min: 31,  max: 70,  color: '#ffaa00', name: 'SUSPICIOUS' },
    ALERTED:    { min: 71,  max: 100, color: '#ff0000', name: 'ALERTED' },
    ENGAGED:    { min: 100, max: 999, color: '#ff00ff', name: 'ENGAGED' }
  };

  // ── Public API ─────────────────────────────────────────────

  /** Get the full states object (drop-in for old AWARENESS_STATES) */
  function getStates() {
    return _states;
  }

  /** Get a specific state by name (or null) */
  function getState(name) {
    return _states[name] || null;
  }

  /**
   * Resolve which awareness state an enemy is in given their awareness value.
   * @param {number} awareness - Current awareness value (0–999)
   * @returns {object} The matching state object
   */
  function resolve(awareness) {
    if (awareness >= _states.ENGAGED.min)    return _states.ENGAGED;
    if (awareness >= _states.ALERTED.min)    return _states.ALERTED;
    if (awareness >= _states.SUSPICIOUS.min) return _states.SUSPICIOUS;
    return _states.UNAWARE;
  }

  /**
   * Check if awareness value meets or exceeds a named threshold.
   * @param {number} awareness - Current awareness value
   * @param {string} stateName - 'UNAWARE'|'SUSPICIOUS'|'ALERTED'|'ENGAGED'
   * @returns {boolean}
   */
  function meetsThreshold(awareness, stateName) {
    var state = _states[stateName];
    if (!state) return false;
    return awareness >= state.min;
  }

  /** All state names in escalation order */
  function getEscalationOrder() {
    return ['UNAWARE', 'SUSPICIOUS', 'ALERTED', 'ENGAGED'];
  }

  return {
    getStates:          getStates,
    getState:           getState,
    resolve:            resolve,
    meetsThreshold:     meetsThreshold,
    getEscalationOrder: getEscalationOrder
  };
})();
