/**
 * tag-synergy-engine.js  —  Auto-Resolve Tag Combo System
 * ========================================================
 * After card selection each turn, this engine scans all played
 * card tags, finds matching combo pairs, and resolves synergies.
 *
 * Design: Pokémon energy logic on the surface, deep tag intersection
 * engine underneath. Players discover combos through play, not tutorials.
 *
 * Usage:
 *   TagSynergyEngine.init(comboData)        // load combo definitions
 *   TagSynergyEngine.resolve(playedCards, combatState)  // auto-resolve
 *   TagSynergyEngine.getDiscovered()        // list discovered combos
 *
 * Dependencies: None (pure ES5 IIFE)
 */
;(function (root) {
  'use strict';

  /* ── Internal state ─────────────────────────────────────── */

  var _combos = [];           // loaded combo definitions
  var _comboLookup = {};      // 'tagA|tagB' → combo (order-independent)
  var _discovered = {};       // combo IDs the player has triggered at least once
  var _lastResolution = [];   // results from most recent resolve() call
  var _tagRisks = [];         // tag overcommit risk definitions
  var _tagRiskLookup = {};    // tag → risk definition
  var _lastRisks = [];        // risks triggered in most recent resolve()

  /* ── Tag legend (display only) ──────────────────────────── */

  var TAG_DISPLAY = {
    'ballistic':   { color: '🟥', label: 'Ballistic' },
    'wet':         { color: '🟦', label: 'Wet' },
    'electrical':  { color: '🟨', label: 'Electrical' },
    'covert':      { color: '🟪', label: 'Covert' },
    'improvised':  { color: '🟩', label: 'Improvised' },
    'black_market':{ color: '⬛', label: 'Black Market' },
    'fire':        { color: '🟥', label: 'Fire' },
    'poison':      { color: '🟪', label: 'Poison' },
    'disposable':  { color: '🔸', label: 'Disposable' }
  };

  /* ── Helpers ────────────────────────────────────────────── */

  function _makeKey(a, b) {
    // Order-independent key: always sort alphabetically
    return a < b ? (a + '|' + b) : (b + '|' + a);
  }

  function _getCardTags(card) {
    // Cards can have tags in 'tags' array and/or 'synergyTags' array
    var tags = [];
    if (card.tags && card.tags.length) {
      for (var i = 0; i < card.tags.length; i++) {
        if (tags.indexOf(card.tags[i]) === -1) tags.push(card.tags[i]);
      }
    }
    if (card.synergyTags && card.synergyTags.length) {
      for (var j = 0; j < card.synergyTags.length; j++) {
        if (tags.indexOf(card.synergyTags[j]) === -1) tags.push(card.synergyTags[j]);
      }
    }
    return tags;
  }

  function _checkConditions(combo, context) {
    var cond = combo.conditions;
    if (!cond) return true;

    // Same-turn requirement (for double-tag combos like Overkill)
    if (cond.requireSameTurn && context.turnCardCount < (cond.minCards || 2)) {
      return false;
    }

    // Status requirements on target
    if (cond.requireTargetStatus) {
      if (!context.targetStatuses || context.targetStatuses.indexOf(cond.requireTargetStatus) === -1) {
        return false;
      }
    }

    // Status requirements on self
    if (cond.requireStatus) {
      if (cond.requireStatus === 'stealth') {
        if (!context.playerStealth) return false;
      } else if (cond.requireStatus === 'burn_or_fire_tag') {
        // Target must be burning OR card must have fire tag
        var hasBurn = context.targetStatuses && context.targetStatuses.indexOf('burn') !== -1;
        var hasFireTag = context.currentTags && context.currentTags.indexOf('fire') !== -1;
        if (!hasBurn && !hasFireTag) return false;
      }
    }

    // Specific tag requirement beyond the pair
    if (cond.requireTag) {
      if (!context.currentTags || context.currentTags.indexOf(cond.requireTag) === -1) {
        return false;
      }
    }

    return true;
  }

  /* ── Public API ─────────────────────────────────────────── */

  var TagSynergyEngine = {

    /**
     * Initialize with combo data (from tag-synergy-data.json)
     * @param {Object} data  - parsed JSON with .combos array
     */
    init: function (data) {
      _combos = data && data.combos ? data.combos : [];
      _comboLookup = {};
      _tagRisks = data && data.tagRisks ? data.tagRisks : [];
      _tagRiskLookup = {};

      for (var i = 0; i < _combos.length; i++) {
        var c = _combos[i];
        var key = _makeKey(c.tagA, c.tagB);
        _comboLookup[key] = c;
      }

      for (var r = 0; r < _tagRisks.length; r++) {
        _tagRiskLookup[_tagRisks[r].tag] = _tagRisks[r];
      }
    },

    /**
     * Auto-resolve all tag combos for this turn's played cards.
     *
     * @param {Array} playedCards   - cards played this turn (card objects with tags/synergyTags)
     * @param {Object} combatState  - current combat context:
     *   {
     *     targetStatuses: ['wet','poison',...],  // statuses on target enemy
     *     playerStealth: true/false,
     *     groundEffects: ['CONDUCTIVE',...],
     *     turnNumber: 3
     *   }
     *
     * @returns {Array} triggered combos, sorted by priority:
     *   [{ combo, sourceCards, effects, isNewDiscovery }]
     */
    resolve: function (playedCards, combatState) {
      if (!playedCards || playedCards.length === 0) return [];

      var state = combatState || {};
      var triggered = [];

      // Collect ALL tags from ALL played cards this turn
      var allTags = [];
      var tagCounts = {};
      var allCardTags = [];  // per-card tag sets for source attribution

      for (var c = 0; c < playedCards.length; c++) {
        var cardTags = _getCardTags(playedCards[c]);
        allCardTags.push(cardTags);
        for (var t = 0; t < cardTags.length; t++) {
          var tag = cardTags[t];
          if (allTags.indexOf(tag) === -1) allTags.push(tag);
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      }

      // Build context for condition checks
      var context = {
        turnCardCount: playedCards.length,
        targetStatuses: state.targetStatuses || [],
        playerStealth: !!state.playerStealth,
        groundEffects: state.groundEffects || [],
        currentTags: allTags
      };

      var triggeredIds = {};

      // Check all unique tag pairs (including same-tag pairs)
      for (var i = 0; i < allTags.length; i++) {
        for (var j = i; j < allTags.length; j++) {
          var tagA = allTags[i];
          var tagB = allTags[j];

          // For same-tag combos, need count >= 2 (from different cards or duplicate tags)
          if (tagA === tagB) {
            // Check if this tag appears on at least 2 different played cards
            var cardCount = 0;
            for (var cc = 0; cc < allCardTags.length; cc++) {
              if (allCardTags[cc].indexOf(tagA) !== -1) cardCount++;
            }
            if (cardCount < 2) continue;
          }

          var key = _makeKey(tagA, tagB);
          var combo = _comboLookup[key];
          if (!combo) continue;
          if (triggeredIds[combo.id]) continue;  // already triggered

          // Check conditions
          if (!_checkConditions(combo, context)) continue;

          // Find source cards
          var sources = [];
          for (var sc = 0; sc < playedCards.length; sc++) {
            var st = allCardTags[sc];
            if (st.indexOf(tagA) !== -1 || st.indexOf(tagB) !== -1) {
              sources.push(playedCards[sc]);
            }
          }

          var isNew = !_discovered[combo.id];
          if (isNew) _discovered[combo.id] = true;

          triggered.push({
            combo: combo,
            sourceCards: sources,
            effects: combo.effects,
            isNewDiscovery: isNew
          });

          triggeredIds[combo.id] = true;
        }
      }

      // Sort by priority (lower = resolves first)
      triggered.sort(function (a, b) {
        return (a.combo.priority || 99) - (b.combo.priority || 99);
      });

      // ── Tag Risk Check ───────────────────────────────────
      // After combos resolve, check if any tag was overcommitted
      var risks = [];
      var suppressedTags = state.suppressedTags || {};       // tags suppressed by Tag Jammer etc
      var riskReductions = state.riskReductions || {};        // from passive items (Surge Protector etc)
      var containmentActive = state.containmentActive || false; // Containment Protocol played

      for (var rt = 0; rt < allTags.length; rt++) {
        var rTag = allTags[rt];
        var riskDef = _tagRiskLookup[rTag];
        if (!riskDef) continue;
        if (suppressedTags[rTag]) continue;  // tag suppressed this turn
        if (containmentActive) continue;      // Containment Protocol negates all risk

        // Count how many DIFFERENT played cards carry this tag
        var riskCardCount = 0;
        for (var rc = 0; rc < allCardTags.length; rc++) {
          if (allCardTags[rc].indexOf(rTag) !== -1) riskCardCount++;
        }

        // Check threshold (adjusted by items that raise threshold)
        var threshold = riskDef.threshold || 3;
        if (riskReductions[rTag] && riskReductions[rTag].thresholdBonus) {
          threshold += riskReductions[rTag].thresholdBonus;
        }

        if (riskCardCount < threshold) continue;

        // Check if counter tag is present (mitigates risk)
        var hasCounter = riskDef.counterTag && allTags.indexOf(riskDef.counterTag) !== -1;
        var reduction = 1.0;
        if (hasCounter && riskDef.counterEffect) {
          if (riskDef.counterEffect.type === 'negate_risk') {
            continue;  // fully negated by counter tag
          }
          reduction = riskDef.counterEffect.reduction || 0.5;
        }

        // Apply item-based risk reduction
        if (riskReductions[rTag] && riskReductions[rTag].factor) {
          reduction *= riskReductions[rTag].factor;
        }

        risks.push({
          risk: riskDef,
          tag: rTag,
          cardCount: riskCardCount,
          threshold: threshold,
          reduction: reduction,
          mitigatedByCounter: hasCounter
        });
      }

      _lastRisks = risks;
      _lastResolution = triggered;
      return triggered;
    },

    /**
     * Get risks triggered in the most recent resolve() call.
     * @returns {Array} [{ risk, tag, cardCount, threshold, reduction, mitigatedByCounter }]
     */
    getLastRisks: function () {
      return _lastRisks.slice();
    },

    /**
     * Look up the risk profile for a specific tag.
     * @param {string} tag
     * @returns {Object|null} risk definition or null
     */
    getTagRisk: function (tag) {
      return _tagRiskLookup[tag] || null;
    },

    /**
     * Get all tag risk definitions.
     * @returns {Array}
     */
    getAllTagRisks: function () {
      return _tagRisks.slice();
    },

    /**
     * Get the set of combo IDs the player has triggered at least once.
     * @returns {Object} map of comboId → true
     */
    getDiscovered: function () {
      var result = {};
      for (var k in _discovered) {
        if (_discovered.hasOwnProperty(k)) result[k] = true;
      }
      return result;
    },

    /**
     * Get total number of possible combos.
     * @returns {number}
     */
    getTotalCombos: function () {
      return _combos.length;
    },

    /**
     * Get discovery count.
     * @returns {number}
     */
    getDiscoveredCount: function () {
      var count = 0;
      for (var k in _discovered) {
        if (_discovered.hasOwnProperty(k)) count++;
      }
      return count;
    },

    /**
     * Get the last resolution result (for UI replay).
     * @returns {Array}
     */
    getLastResolution: function () {
      return _lastResolution.slice();
    },

    /**
     * Preview what combos WOULD trigger if these cards were played.
     * Non-mutating — doesn't update discovery state.
     *
     * @param {Array} hypotheticalCards
     * @param {Object} combatState
     * @returns {Array} same format as resolve()
     */
    preview: function (hypotheticalCards, combatState) {
      if (!hypotheticalCards || hypotheticalCards.length === 0) return [];

      var savedDiscovered = {};
      for (var k in _discovered) {
        if (_discovered.hasOwnProperty(k)) savedDiscovered[k] = true;
      }

      var result = this.resolve(hypotheticalCards, combatState);

      // Restore discovery state (preview is non-mutating)
      _discovered = savedDiscovered;
      _lastResolution = [];

      return result;
    },

    /**
     * Get tag display info for UI rendering.
     * @param {string} tag
     * @returns {Object} { color, label } or null
     */
    getTagDisplay: function (tag) {
      return TAG_DISPLAY[tag] || null;
    },

    /**
     * Get all tag display info.
     * @returns {Object}
     */
    getAllTagDisplays: function () {
      return TAG_DISPLAY;
    },

    /**
     * Look up a specific combo by tag pair.
     * @param {string} tagA
     * @param {string} tagB
     * @returns {Object|null} combo definition or null
     */
    lookupCombo: function (tagA, tagB) {
      return _comboLookup[_makeKey(tagA, tagB)] || null;
    },

    /**
     * Reset discovery state (new run).
     */
    resetDiscovery: function () {
      _discovered = {};
    },

    /**
     * Load discovery state from save data.
     * @param {Object} discoveredMap - { comboId: true, ... }
     */
    loadDiscovery: function (discoveredMap) {
      _discovered = {};
      if (discoveredMap) {
        for (var k in discoveredMap) {
          if (discoveredMap.hasOwnProperty(k)) _discovered[k] = true;
        }
      }
    }
  };

  /* ── Export ─────────────────────────────────────────────── */

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TagSynergyEngine;
  } else {
    root.TagSynergyEngine = TagSynergyEngine;
  }

})(typeof window !== 'undefined' ? window : this);
