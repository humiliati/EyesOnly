/* ============================================================
   EYES ONLY - Cascade Resolver
   Recursive cascade chain resolution for synergy-driven card play.
   When a synergy triggers, cascade enabler items and synergy
   cascadeChance fields can trigger follow-on effects (draw, stun,
   focus gain, enemy skip) with a depth cap to prevent infinite loops.
   ============================================================ */

var CascadeResolver = (function() {
  'use strict';

  var MAX_CASCADE_DEPTH = 5;   // Safety cap — no infinite loops
  var _cascadeCount = 0;        // Current depth this resolution
  var _cascadeHistory = [];     // Cards/effects processed this chain
  var _synergyCountThisTurn = 0; // Track multi-resolve for Signal Jammer

  // ─── CASCADE EFFECT TYPES ─────────────────────────────────

  var CASCADE_EFFECTS = {
    // Draw 1 from backup, 30% chance to chain again
    draw_1_chain_30: {
      description: 'Dead Drop Cache: draw 1, 30% chain',
      execute: function(context) {
        return { drawCard: true, chainChance: 0.3, description: 'Dead Drop Cache → +1 card' };
      }
    },
    // Cancel alert + stealth bonus + draw 1 (requires wet→fire tags)
    cancel_alert_draw_1: {
      description: 'Suppressor Oil: cancel alert, draw 1',
      execute: function(context) {
        return { drawCard: true, stealthBonus: 1, cancelAlert: true, description: 'Suppressor Oil → stealth + draw 1' };
      }
    },
    // Gain 1 Focus + draw 1
    focus_1_draw_1: {
      description: 'Tripwire Array: +1 Focus, draw 1',
      execute: function(context) {
        return { drawCard: true, focusGain: 1, description: 'Tripwire Array → +1 Focus + draw 1' };
      }
    },
    // Enemy loses next turn (50% chance)
    enemy_skip_50: {
      description: 'Signal Jammer: 50% enemy skip',
      execute: function(context) {
        var roll = Math.random();
        if (roll < 0.5) {
          return { enemySkip: true, description: 'Signal Jammer → enemy loses next turn' };
        }
        return { description: 'Signal Jammer → failed (50% roll)' };
      }
    }
  };

  // ─── RESOLVE ──────────────────────────────────────────────

  /**
   * Resolve cascade effects after a synergy triggers.
   * @param {Object} triggeringSynergy - The synergy that just fired (from SynergyEngine)
   * @param {Object} card - The card that was played
   * @param {Object} context - { player, enemy, round }
   * @returns {Object} { depth, results: [{type, drawCard, focusGain, enemySkip, description}], capped }
   */
  function resolve(triggeringSynergy, card, context) {
    _cascadeCount++;
    _synergyCountThisTurn++;

    if (_cascadeCount > MAX_CASCADE_DEPTH) {
      console.log('[CascadeResolver] Depth cap reached (' + MAX_CASCADE_DEPTH + ')');
      return { depth: _cascadeCount, results: [], capped: true };
    }

    var results = [];

    // 1. Check equipped cascade enabler items
    var enablers = _getActiveCascadeEnablers();
    for (var i = 0; i < enablers.length; i++) {
      var enabler = enablers[i];
      if (_checkCascadeCondition(enabler, triggeringSynergy, context)) {
        var effectKey = _getEffectKey(enabler);
        if (effectKey && CASCADE_EFFECTS[effectKey]) {
          var result = CASCADE_EFFECTS[effectKey].execute(context);
          if (result) {
            result.source = enabler.name || enabler.id || 'cascade_enabler';
            results.push(result);
            _cascadeHistory.push({ enabler: enabler.id, depth: _cascadeCount, effect: effectKey });

            // If this result has a chainChance, roll for recursive cascade
            if (result.chainChance && result.chainChance > 0) {
              if (Math.random() < result.chainChance) {
                var chainResult = resolve(triggeringSynergy, card, context);
                if (chainResult && chainResult.results) {
                  results = results.concat(chainResult.results);
                }
              }
            }
          }
        }
      }
    }

    // 2. Check synergy's own cascadeChance
    if (triggeringSynergy && triggeringSynergy.definition && triggeringSynergy.definition.cascadeChance > 0) {
      if (Math.random() < triggeringSynergy.definition.cascadeChance) {
        results.push({
          type: 'synergy_chain',
          drawCard: true,
          description: triggeringSynergy.definition.name + ' → chain draw'
        });
      }
    }

    return { depth: _cascadeCount, results: results, capped: false };
  }

  // ─── ENABLER DETECTION ────────────────────────────────────

  /**
   * Get active cascade enabler items from equipped gear.
   * Scans active item slot + persistent inventory for cascade_enabler effects.
   * @returns {Array} Array of item objects with cascade_enabler effects
   */
  function _getActiveCascadeEnablers() {
    var enablers = [];
    try {
      if (typeof GAMESTATE === 'undefined') return enablers;

      // Check active item slot
      if (typeof GAMESTATE.getActiveItemSlot === 'function') {
        var activeItem = GAMESTATE.getActiveItemSlot();
        if (activeItem && activeItem.effects) {
          for (var i = 0; i < activeItem.effects.length; i++) {
            if (activeItem.effects[i].type === 'cascade_enabler') {
              enablers.push(activeItem);
              break;
            }
          }
        }
      }

      // Check persistent inventory for equipped cascade items
      if (typeof GAMESTATE.getPersistentInventory === 'function') {
        var inv = GAMESTATE.getPersistentInventory() || [];
        for (var j = 0; j < inv.length; j++) {
          var item = inv[j];
          if (item && item.effects) {
            for (var k = 0; k < item.effects.length; k++) {
              if (item.effects[k].type === 'cascade_enabler') {
                // Avoid duplicates (if also in active slot)
                var isDupe = false;
                for (var d = 0; d < enablers.length; d++) {
                  if (enablers[d].id === item.id) { isDupe = true; break; }
                }
                if (!isDupe) enablers.push(item);
                break;
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[CascadeResolver] Error getting enablers:', e);
    }
    return enablers;
  }

  /**
   * Check if a cascade enabler's condition is met.
   * @param {Object} enabler - Item with cascade_enabler effect
   * @param {Object} triggeringSynergy - The synergy that fired
   * @param {Object} context - Combat context
   * @returns {boolean}
   */
  function _checkCascadeCondition(enabler, triggeringSynergy, context) {
    if (!enabler || !enabler.effects) return false;

    for (var i = 0; i < enabler.effects.length; i++) {
      var eff = enabler.effects[i];
      if (eff.type !== 'cascade_enabler') continue;

      var condition = eff.condition;

      if (condition === 'on_synergy_resolve') {
        // Check tag filter if present
        if (eff.tags && eff.tags.length > 0 && triggeringSynergy && triggeringSynergy.definition) {
          var matchesTag = false;
          var allTags = (triggeringSynergy.definition.enablerTags || []).concat(triggeringSynergy.definition.payoffTags || []);
          for (var t = 0; t < eff.tags.length; t++) {
            if (allTags.indexOf(eff.tags[t]) !== -1) { matchesTag = true; break; }
          }
          return matchesTag;
        }
        return true; // No tag filter — any synergy triggers
      }

      if (condition === 'on_multi_resolve') {
        return _synergyCountThisTurn >= 2;
      }

      if (condition === 'on_enemy_skip') {
        return context && context.enemy && context.enemy._skipNextTurn;
      }

      if (condition === 'on_burn_threshold') {
        var threshold = eff.threshold || 5;
        try {
          if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getBurnPileCount === 'function') {
            return GAMESTATE.getBurnPileCount() >= threshold;
          }
        } catch (e) {}
        return false;
      }
    }

    return false;
  }

  /**
   * Extract the effect key from a cascade enabler item.
   * @param {Object} enabler - Item with cascade_enabler effect
   * @returns {string|null}
   */
  function _getEffectKey(enabler) {
    if (!enabler || !enabler.effects) return null;
    for (var i = 0; i < enabler.effects.length; i++) {
      if (enabler.effects[i].type === 'cascade_enabler' && enabler.effects[i].effect) {
        return enabler.effects[i].effect;
      }
    }
    return null;
  }

  // ─── LIFECYCLE ────────────────────────────────────────────

  /**
   * Reset cascade state. Call at start of each turn.
   */
  function resetTurn() {
    _cascadeCount = 0;
    _cascadeHistory = [];
    _synergyCountThisTurn = 0;
  }

  /**
   * Reset all state. Call between combats.
   */
  function reset() {
    resetTurn();
  }

  /**
   * Get cascade history for debugging.
   * @returns {Object}
   */
  function getState() {
    return {
      cascadeCount: _cascadeCount,
      synergyCountThisTurn: _synergyCountThisTurn,
      history: _cascadeHistory.slice(),
      maxDepth: MAX_CASCADE_DEPTH
    };
  }

  // ─── PUBLIC API ───────────────────────────────────────────

  return {
    resolve: resolve,
    reset: reset,
    resetTurn: resetTurn,
    getState: getState,
    MAX_CASCADE_DEPTH: MAX_CASCADE_DEPTH
  };
})();

// Make available globally
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CascadeResolver;
}
