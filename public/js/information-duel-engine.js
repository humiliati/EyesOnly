/**
 * InformationDuelEngine — Phase 5 of ENEMY_CARDS.md
 *
 * Transforms enemy card interactions into a psychological "Information Duel"
 * with multi-turn memory, escalation pressure, and adaptive AI.
 *
 * Sub-systems:
 *   1. Interaction Charges   — 1 per turn (item-modified), constrains player actions
 *   2. Intent Mutation        — Rage / Paranoia / Adaptation triggered by interactions
 *   3. Intent Momentum        — Per-slot tag tracking across turns
 *   4. Escalation Clock       — Pressure timer forcing engagement
 *   5. Overload Meter         — Global tension meter toward spike turns
 *   6. Two-Stage Pipeline     — Revealed cards become stealable on later turns
 *   7. Adaptive Pattern AI    — Enemy adjusts behavior based on player patterns
 *
 * Dependencies:
 *   - NonCombatEventBus
 *   - EnemyIntentSystem (FACE_EXPRESSIONS)
 *   - EnemyHandDisplay (getEnemyCards)
 *   - GAMESTATE / PassiveItemsSystem
 *   - GoneRogueDataRegistry (enemy card defs)
 *
 * ES5 IIFE — no frameworks.
 */
var InformationDuelEngine = (function() {
  'use strict';

  // ══════════════════════════════════════════════════════════
  // CONSTANTS
  // ══════════════════════════════════════════════════════════

  var DEFAULT_CHARGES_PER_TURN = 1;
  var ESCALATION_PAYOFF_THRESHOLD = 3;   // +1 payoff damage at this level
  var OVERLOAD_ELIGIBLE_THRESHOLD = 5;   // Next combo turn = overload eligible
  var OVERLOAD_TRIGGER_THRESHOLD = 7;    // 3-combo chain = Overload Turn
  var AI_ADAPT_INTERVAL = 3;             // AI adapts every N turns
  var MOMENTUM_DECAY_AFTER_OVERLOAD = 1; // Momentum reduction after overload

  // Intent Mutation types
  var MUTATION = {
    NONE:       'none',
    RAGE:       'rage',        // Triggered by destroy → +10% damage
    PARANOIA:   'paranoia',    // Triggered by steal → hides extra cards
    ADAPTATION: 'adaptation'   // Triggered by reveal → swaps combos
  };

  // ══════════════════════════════════════════════════════════
  // STATE — per-encounter, reset on combat start
  // ══════════════════════════════════════════════════════════

  var _state = null;
  var _initialized = false;

  function _defaultState() {
    return {
      // ── Interaction Charges ──
      chargesMax: DEFAULT_CHARGES_PER_TURN,
      chargesRemaining: DEFAULT_CHARGES_PER_TURN,
      chargesUsedThisTurn: 0,
      bonusCharges: 0,  // From items

      // ── Intent Mutation ──
      mutation: MUTATION.NONE,
      mutationStacks: 0,     // Cumulative intensity (caps at 3)
      mutationTurnApplied: 0,

      // ── Intent Momentum (per-slot tag tracking) ──
      // Array parallel to enemy cards: [{ tags: {tagName: momentumCount}, turnsSeen: N }]
      slotMomentum: [],

      // ── Escalation Clock ──
      escalationCounter: 0,  // +1 per turn without a destroy
      turnsSinceDestroy: 0,
      escalationBonusDamage: 0,

      // ── Overload Meter ──
      overloadMeter: 0,
      overloadActive: false,
      overloadEligible: false,

      // ── Adaptive Pattern AI ──
      playerPatterns: {
        destroys: 0,
        steals: 0,
        reveals: 0,
        totalInteractions: 0,
        preferredAction: null,  // Most common action
        lastAdaptTurn: 0
      },
      aiAdaptations: [],  // Active adaptations: ['split_fuel', 'insert_decoy', 'rotate_tags']

      // ── Two-Stage Pipeline ──
      revealedCardTurns: {},  // { slotIndex: turnRevealed }

      // ── General ──
      currentTurn: 0,
      combatActive: false
    };
  }

  // ══════════════════════════════════════════════════════════
  // 1. INTERACTION CHARGES
  // ══════════════════════════════════════════════════════════

  /**
   * Calculate max charges from items.
   * Base: 1 per turn.
   * Items can add bonus charges.
   */
  function _computeMaxCharges() {
    var base = DEFAULT_CHARGES_PER_TURN;
    var bonus = 0;

    // Check passive items for charge bonuses
    try {
      if (typeof PassiveItemsSystem !== 'undefined' && PassiveItemsSystem.getEquippedItems) {
        var passives = PassiveItemsSystem.getEquippedItems() || [];
        for (var i = 0; i < passives.length; i++) {
          var effects = passives[i].effects || [];
          for (var j = 0; j < effects.length; j++) {
            if (effects[j].type === 'interaction_charge_bonus') {
              bonus += (effects[j].value || 1);
            }
          }
        }
      }
    } catch (e) {}

    // Check active item
    try {
      if (typeof GAMESTATE !== 'undefined' && GAMESTATE.getActiveItem) {
        var active = GAMESTATE.getActiveItem();
        if (active && Array.isArray(active.effects)) {
          for (var k = 0; k < active.effects.length; k++) {
            if (active.effects[k].type === 'interaction_charge_bonus') {
              bonus += (active.effects[k].value || 1);
            }
          }
        }
      }
    } catch (e) {}

    _state.bonusCharges = bonus;
    _state.chargesMax = base + bonus;
    return _state.chargesMax;
  }

  /**
   * Check if player can spend an interaction charge.
   * @returns {boolean}
   */
  function canInteract() {
    if (!_state || !_state.combatActive) return false;
    return _state.chargesRemaining > 0;
  }

  /**
   * Spend one interaction charge.
   * @returns {boolean} Success
   */
  function spendCharge() {
    if (!canInteract()) return false;
    _state.chargesRemaining--;
    _state.chargesUsedThisTurn++;
    return true;
  }

  /**
   * Refill charges at start of turn.
   */
  function _refillCharges() {
    _computeMaxCharges();
    _state.chargesRemaining = _state.chargesMax;
    _state.chargesUsedThisTurn = 0;
  }

  // ══════════════════════════════════════════════════════════
  // 2. INTENT MUTATION SYSTEM
  // ══════════════════════════════════════════════════════════

  /**
   * Apply mutation based on player action.
   * @param {string} actionType - 'reveal' | 'steal' | 'destroy'
   * @returns {Object} { mutation, stacks, faceExpression }
   */
  function applyMutation(actionType) {
    if (!_state) return null;

    var newMutation = MUTATION.NONE;

    switch (actionType) {
      case 'destroy':
        newMutation = MUTATION.RAGE;
        break;
      case 'steal':
        newMutation = MUTATION.PARANOIA;
        break;
      case 'reveal':
        newMutation = MUTATION.ADAPTATION;
        break;
      default:
        return null;
    }

    // Stack if same mutation, otherwise switch
    if (_state.mutation === newMutation) {
      _state.mutationStacks = Math.min(3, _state.mutationStacks + 1);
    } else {
      _state.mutation = newMutation;
      _state.mutationStacks = 1;
    }
    _state.mutationTurnApplied = _state.currentTurn;

    // Return mutation effects for the caller to apply
    return _getMutationEffects();
  }

  /**
   * Get current mutation effects.
   * @returns {Object} { mutation, stacks, damageBonus, hideExtraCards, swapCombo, faceExpression }
   */
  function _getMutationEffects() {
    var effects = {
      mutation: _state.mutation,
      stacks: _state.mutationStacks,
      damageBonus: 0,
      hideExtraCards: 0,
      swapCombo: false,
      faceExpression: null
    };

    switch (_state.mutation) {
      case MUTATION.RAGE:
        // +10% damage per stack (additive)
        effects.damageBonus = _state.mutationStacks * 0.10;
        // Face: ENRAGED
        if (typeof EnemyIntentSystem !== 'undefined') {
          effects.faceExpression = EnemyIntentSystem.FACE_EXPRESSIONS.ENRAGED;
        }
        break;

      case MUTATION.PARANOIA:
        // Hide 1 extra card per stack (flip revealed cards back)
        effects.hideExtraCards = _state.mutationStacks;
        // Face: ALERT
        if (typeof EnemyIntentSystem !== 'undefined') {
          effects.faceExpression = EnemyIntentSystem.FACE_EXPRESSIONS.ALERT;
        }
        break;

      case MUTATION.ADAPTATION:
        // At 2+ stacks, enemy swaps combo ordering
        effects.swapCombo = (_state.mutationStacks >= 2);
        // Face: DETERMINED
        if (typeof EnemyIntentSystem !== 'undefined') {
          effects.faceExpression = EnemyIntentSystem.FACE_EXPRESSIONS.DETERMINED;
        }
        break;
    }

    return effects;
  }

  /**
   * Get mutation display info for UI.
   * @returns {Object|null} { emoji, label, stacks, color }
   */
  function getMutationDisplay() {
    if (!_state || _state.mutation === MUTATION.NONE) return null;

    switch (_state.mutation) {
      case MUTATION.RAGE:
        return {
          emoji: '🔥',
          label: 'RAGE',
          stacks: _state.mutationStacks,
          color: 'rgba(255, 60, 60, 0.9)',
          description: '+' + (_state.mutationStacks * 10) + '% damage'
        };
      case MUTATION.PARANOIA:
        return {
          emoji: '👁️',
          label: 'PARANOIA',
          stacks: _state.mutationStacks,
          color: 'rgba(180, 0, 255, 0.9)',
          description: 'Hiding ' + _state.mutationStacks + ' card(s)'
        };
      case MUTATION.ADAPTATION:
        return {
          emoji: '🔄',
          label: 'ADAPT',
          stacks: _state.mutationStacks,
          color: 'rgba(0, 200, 200, 0.9)',
          description: _state.mutationStacks >= 2 ? 'Combos shuffled' : 'Watching...'
        };
    }
    return null;
  }

  // ══════════════════════════════════════════════════════════
  // 3. INTENT MOMENTUM (per-slot tag tracking)
  // ══════════════════════════════════════════════════════════

  /**
   * Update momentum for all enemy card slots.
   * Called at end of each turn.
   * @param {Array} enemyCards - From EnemyHandDisplay.getEnemyCards()
   */
  function updateMomentum(enemyCards) {
    if (!_state || !Array.isArray(enemyCards)) return;

    // Expand momentum array if needed
    while (_state.slotMomentum.length < enemyCards.length) {
      _state.slotMomentum.push({ tags: {}, turnsSeen: 0 });
    }

    for (var i = 0; i < enemyCards.length; i++) {
      var card = enemyCards[i];
      var slot = _state.slotMomentum[i];

      if (card.destroyed) continue;

      // Get card definition tags
      var cardDef = null;
      if (card._def && !card._def._missing) {
        cardDef = card._def;
      } else if (card.cardId && typeof GoneRogueDataRegistry !== 'undefined') {
        try {
          cardDef = GoneRogueDataRegistry.getEnemyCard(card.cardId);
        } catch (e) {}
      }

      if (!cardDef) continue;

      var tags = [];
      if (Array.isArray(cardDef.tags)) tags = tags.concat(cardDef.tags);
      if (Array.isArray(cardDef.synergyTags)) tags = tags.concat(cardDef.synergyTags);

      // Increment momentum for each tag still present in this slot
      for (var t = 0; t < tags.length; t++) {
        var tag = tags[t];
        if (!slot.tags[tag]) {
          slot.tags[tag] = 1;
        } else {
          slot.tags[tag]++;
        }
      }

      slot.turnsSeen++;
    }
  }

  /**
   * Get the highest momentum value for a slot.
   * @param {number} slotIndex
   * @returns {number} Max momentum across all tags
   */
  function getSlotMomentum(slotIndex) {
    if (!_state || !_state.slotMomentum[slotIndex]) return 0;
    var tags = _state.slotMomentum[slotIndex].tags;
    var max = 0;
    for (var tag in tags) {
      if (tags.hasOwnProperty(tag) && tags[tag] > max) {
        max = tags[tag];
      }
    }
    return max;
  }

  /**
   * Get momentum display data for all slots.
   * @returns {Array} [{ index, maxMomentum, dominantTag, tags }]
   */
  function getAllMomentum() {
    if (!_state) return [];
    var result = [];
    for (var i = 0; i < _state.slotMomentum.length; i++) {
      var slot = _state.slotMomentum[i];
      var maxM = 0;
      var dominant = null;
      for (var tag in slot.tags) {
        if (slot.tags.hasOwnProperty(tag) && slot.tags[tag] > maxM) {
          maxM = slot.tags[tag];
          dominant = tag;
        }
      }
      result.push({
        index: i,
        maxMomentum: maxM,
        dominantTag: dominant,
        tags: Object.assign({}, slot.tags)
      });
    }
    return result;
  }

  /**
   * Calculate disruption bonus from destroying a high-momentum slot.
   * @param {number} slotIndex
   * @returns {number} Bonus disruption value
   */
  function getDestroyDisruptionBonus(slotIndex) {
    var momentum = getSlotMomentum(slotIndex);
    if (momentum <= 1) return 0;
    // Each momentum point beyond 1 adds +1 disruption
    return momentum - 1;
  }

  /**
   * Clear momentum for a destroyed/stolen slot.
   * @param {number} slotIndex
   */
  function clearSlotMomentum(slotIndex) {
    if (_state && _state.slotMomentum[slotIndex]) {
      _state.slotMomentum[slotIndex] = { tags: {}, turnsSeen: 0 };
    }
  }

  // ══════════════════════════════════════════════════════════
  // 4. ESCALATION CLOCK
  // ══════════════════════════════════════════════════════════

  /**
   * Advance the escalation clock (called each turn).
   * +1 for each turn without a destroy action.
   * @param {boolean} destroyedThisTurn - Whether player destroyed a card this turn
   */
  function advanceEscalation(destroyedThisTurn) {
    if (!_state) return;

    if (destroyedThisTurn) {
      // Reset on destroy
      _state.turnsSinceDestroy = 0;
      _state.escalationCounter = Math.max(0, _state.escalationCounter - 1);
    } else {
      _state.turnsSinceDestroy++;
      _state.escalationCounter++;
    }

    // Calculate bonus damage
    if (_state.escalationCounter >= ESCALATION_PAYOFF_THRESHOLD) {
      _state.escalationBonusDamage = Math.floor(
        (_state.escalationCounter - ESCALATION_PAYOFF_THRESHOLD + 1)
      );
    } else {
      _state.escalationBonusDamage = 0;
    }
  }

  /**
   * Get escalation display data.
   * @returns {Object} { counter, threshold, bonusDamage, urgent }
   */
  function getEscalationDisplay() {
    if (!_state) return { counter: 0, threshold: ESCALATION_PAYOFF_THRESHOLD, bonusDamage: 0, urgent: false };
    return {
      counter: _state.escalationCounter,
      threshold: ESCALATION_PAYOFF_THRESHOLD,
      bonusDamage: _state.escalationBonusDamage,
      urgent: _state.escalationCounter >= (ESCALATION_PAYOFF_THRESHOLD - 1)
    };
  }

  // ══════════════════════════════════════════════════════════
  // 5. OVERLOAD METER
  // ══════════════════════════════════════════════════════════

  /**
   * Feed the overload meter.
   * +1 when: slot reaches Momentum 2, combo resolves, instability trigger
   * @param {string} source - 'momentum' | 'combo' | 'instability'
   * @param {number} [amount] - Override amount (default 1)
   */
  function feedOverload(source, amount) {
    if (!_state) return;
    var add = (typeof amount === 'number') ? amount : 1;
    _state.overloadMeter += add;

    // Check thresholds
    if (_state.overloadMeter >= OVERLOAD_TRIGGER_THRESHOLD) {
      _state.overloadActive = true;
      _state.overloadEligible = true;
    } else if (_state.overloadMeter >= OVERLOAD_ELIGIBLE_THRESHOLD) {
      _state.overloadEligible = true;
    }

    _emitEvent('overload:feed', {
      source: source,
      meter: _state.overloadMeter,
      eligible: _state.overloadEligible,
      active: _state.overloadActive
    });
  }

  /**
   * Resolve an overload turn.
   * All combo effects +1, all instability checks doubled.
   * @returns {Object} { wasActive, comboBonus, instabilityMultiplier }
   */
  function resolveOverload() {
    if (!_state) return { wasActive: false, comboBonus: 0, instabilityMultiplier: 1 };

    var wasActive = _state.overloadActive;

    if (wasActive) {
      // Reset after overload
      _state.overloadMeter = 0;
      _state.overloadActive = false;
      _state.overloadEligible = false;

      // Decay all momentum by 1
      for (var i = 0; i < _state.slotMomentum.length; i++) {
        var slot = _state.slotMomentum[i];
        for (var tag in slot.tags) {
          if (slot.tags.hasOwnProperty(tag)) {
            slot.tags[tag] = Math.max(0, slot.tags[tag] - MOMENTUM_DECAY_AFTER_OVERLOAD);
            if (slot.tags[tag] <= 0) delete slot.tags[tag];
          }
        }
      }

      _emitEvent('overload:resolved', {});
    }

    return {
      wasActive: wasActive,
      comboBonus: wasActive ? 1 : 0,
      instabilityMultiplier: wasActive ? 2 : 1
    };
  }

  /**
   * Get overload display data.
   * @returns {Object} { meter, max, eligible, active, percent }
   */
  function getOverloadDisplay() {
    if (!_state) return { meter: 0, max: OVERLOAD_TRIGGER_THRESHOLD, eligible: false, active: false, percent: 0 };
    return {
      meter: _state.overloadMeter,
      max: OVERLOAD_TRIGGER_THRESHOLD,
      eligible: _state.overloadEligible,
      active: _state.overloadActive,
      percent: Math.min(1, _state.overloadMeter / OVERLOAD_TRIGGER_THRESHOLD)
    };
  }

  // ══════════════════════════════════════════════════════════
  // 6. TWO-STAGE PIPELINE
  // ══════════════════════════════════════════════════════════

  /**
   * Mark a card as revealed this turn (becomes stealable on later turns).
   * @param {number} slotIndex
   */
  function markRevealed(slotIndex) {
    if (!_state) return;
    _state.revealedCardTurns[slotIndex] = _state.currentTurn;
  }

  /**
   * Check if a revealed card is now stealable (revealed on a previous turn).
   * @param {number} slotIndex
   * @returns {boolean}
   */
  function isRevealedStealable(slotIndex) {
    if (!_state) return false;
    var revealedTurn = _state.revealedCardTurns[slotIndex];
    if (revealedTurn === undefined) return false;
    // Stealable if revealed on a previous turn (not this turn)
    return _state.currentTurn > revealedTurn;
  }

  // ══════════════════════════════════════════════════════════
  // 7. ADAPTIVE PATTERN AI
  // ══════════════════════════════════════════════════════════

  /**
   * Track a player interaction for pattern analysis.
   * @param {string} actionType - 'reveal' | 'steal' | 'destroy'
   */
  function trackPlayerAction(actionType) {
    if (!_state) return;
    var p = _state.playerPatterns;

    p.totalInteractions++;
    switch (actionType) {
      case 'destroy': p.destroys++; break;
      case 'steal':   p.steals++; break;
      case 'reveal':  p.reveals++; break;
    }

    // Update preferred action
    if (p.destroys >= p.steals && p.destroys >= p.reveals) {
      p.preferredAction = 'destroy';
    } else if (p.steals >= p.destroys && p.steals >= p.reveals) {
      p.preferredAction = 'steal';
    } else {
      p.preferredAction = 'reveal';
    }
  }

  /**
   * Run AI adaptation check (every AI_ADAPT_INTERVAL turns).
   * @returns {Array} List of new adaptations applied this check
   */
  function checkAIAdaptation() {
    if (!_state) return [];
    var p = _state.playerPatterns;

    // Only adapt every N turns
    if (_state.currentTurn - p.lastAdaptTurn < AI_ADAPT_INTERVAL) return [];
    if (p.totalInteractions < 2) return []; // Need some data

    p.lastAdaptTurn = _state.currentTurn;
    var newAdaptations = [];

    // Clear old adaptations (max 2 active at once)
    _state.aiAdaptations = [];

    // Adapt based on player's preferred action
    if (p.preferredAction === 'destroy' && p.destroys >= 2) {
      // Player destroys Anchors often → split Fuel across slots
      newAdaptations.push('split_fuel');
      _state.aiAdaptations.push('split_fuel');
    }

    if (p.preferredAction === 'steal' && p.steals >= 2) {
      // Player steals often → insert decoy double-tags
      newAdaptations.push('insert_decoy');
      _state.aiAdaptations.push('insert_decoy');
    }

    if (p.preferredAction === 'reveal' && p.reveals >= 2) {
      // Player probes frequently → rotate tag positions
      newAdaptations.push('rotate_tags');
      _state.aiAdaptations.push('rotate_tags');
    }

    if (newAdaptations.length > 0) {
      _emitEvent('ai:adapted', { adaptations: newAdaptations, turn: _state.currentTurn });
    }

    return newAdaptations;
  }

  /**
   * Get active AI adaptations.
   * @returns {Array<string>}
   */
  function getAIAdaptations() {
    return _state ? _state.aiAdaptations.slice() : [];
  }

  // ══════════════════════════════════════════════════════════
  // TURN LIFECYCLE
  // ══════════════════════════════════════════════════════════

  /**
   * Start a new combat encounter. Reset all state.
   */
  function startCombat() {
    _state = _defaultState();
    _state.combatActive = true;
    _computeMaxCharges();
    _state.chargesRemaining = _state.chargesMax;

    _emitEvent('duel:combat-start', {
      charges: _state.chargesMax
    });

    console.log('[InformationDuelEngine] Combat started — ' + _state.chargesMax + ' charge(s)/turn');
  }

  /**
   * Advance to the next turn.
   * Refills charges, updates escalation, checks AI adaptation.
   * @param {boolean} destroyedThisTurn
   * @param {Array} [enemyCards] - For momentum update
   */
  function advanceTurn(destroyedThisTurn, enemyCards) {
    if (!_state) return;

    _state.currentTurn++;

    // Refill interaction charges
    _refillCharges();

    // Advance escalation
    advanceEscalation(destroyedThisTurn);

    // Update momentum
    if (enemyCards) {
      updateMomentum(enemyCards);

      // Feed overload for high-momentum slots
      for (var i = 0; i < _state.slotMomentum.length; i++) {
        if (getSlotMomentum(i) === 2) {
          feedOverload('momentum');
        }
      }
    }

    // Check AI adaptation
    checkAIAdaptation();

    _emitEvent('duel:turn-advance', {
      turn: _state.currentTurn,
      charges: _state.chargesRemaining,
      escalation: _state.escalationCounter,
      overload: _state.overloadMeter,
      mutation: _state.mutation,
      mutationStacks: _state.mutationStacks
    });
  }

  /**
   * End the current combat encounter.
   */
  function endCombat() {
    if (_state) {
      _state.combatActive = false;
    }
    _emitEvent('duel:combat-end', {});
    console.log('[InformationDuelEngine] Combat ended');
  }

  // ══════════════════════════════════════════════════════════
  // EVENT HELPERS
  // ══════════════════════════════════════════════════════════

  function _emitEvent(eventName, data) {
    try {
      if (typeof NonCombatEventBus !== 'undefined' && NonCombatEventBus.emit) {
        NonCombatEventBus.emit(eventName, data);
      }
    } catch (e) {}
  }

  // ══════════════════════════════════════════════════════════
  // INIT + EVENT BINDING
  // ══════════════════════════════════════════════════════════

  function init() {
    if (_initialized) return;
    _initialized = true;

    _state = _defaultState();

    _bindEvents();
    console.log('[InformationDuelEngine] Phase 5 initialized');
  }

  function _bindEvents() {
    if (typeof NonCombatEventBus === 'undefined') {
      setTimeout(_bindEvents, 200);
      return;
    }

    // Reset on combat round start
    NonCombatEventBus.on('combat:round-start', function() {
      if (_state && _state.combatActive) {
        // Turn advance is handled by the caller (str-combat-integration)
        // This just resets per-round tracking in charges
      }
    });

    // Feed overload on combo resolve
    NonCombatEventBus.on('synergy:resolved', function(data) {
      if (_state && _state.combatActive) {
        feedOverload('combo');
      }
    });
  }

  // ══════════════════════════════════════════════════════════
  // FULL STATE SNAPSHOT (for UI rendering)
  // ══════════════════════════════════════════════════════════

  /**
   * Get a complete snapshot of the duel state for UI rendering.
   * @returns {Object}
   */
  function getSnapshot() {
    if (!_state) return null;
    return {
      charges: {
        remaining: _state.chargesRemaining,
        max: _state.chargesMax,
        usedThisTurn: _state.chargesUsedThisTurn
      },
      mutation: getMutationDisplay(),
      escalation: getEscalationDisplay(),
      overload: getOverloadDisplay(),
      momentum: getAllMomentum(),
      turn: _state.currentTurn,
      combatActive: _state.combatActive,
      aiAdaptations: _state.aiAdaptations.slice()
    };
  }

  // ══════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════

  return {
    // Constants
    MUTATION: MUTATION,

    // Init
    init: init,

    // Lifecycle
    startCombat: startCombat,
    advanceTurn: advanceTurn,
    endCombat: endCombat,

    // Interaction Charges
    canInteract: canInteract,
    spendCharge: spendCharge,

    // Intent Mutation
    applyMutation: applyMutation,
    getMutationDisplay: getMutationDisplay,

    // Intent Momentum
    updateMomentum: updateMomentum,
    getSlotMomentum: getSlotMomentum,
    getAllMomentum: getAllMomentum,
    getDestroyDisruptionBonus: getDestroyDisruptionBonus,
    clearSlotMomentum: clearSlotMomentum,

    // Escalation Clock
    advanceEscalation: advanceEscalation,
    getEscalationDisplay: getEscalationDisplay,

    // Overload Meter
    feedOverload: feedOverload,
    resolveOverload: resolveOverload,
    getOverloadDisplay: getOverloadDisplay,

    // Two-Stage Pipeline
    markRevealed: markRevealed,
    isRevealedStealable: isRevealedStealable,

    // Adaptive AI
    trackPlayerAction: trackPlayerAction,
    checkAIAdaptation: checkAIAdaptation,
    getAIAdaptations: getAIAdaptations,

    // Full state
    getSnapshot: getSnapshot
  };

})();

// Auto-init
(function() {
  function _autoInit() {
    if (typeof NonCombatEventBus !== 'undefined') {
      InformationDuelEngine.init();
    } else {
      setTimeout(_autoInit, 200);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _autoInit);
  } else {
    _autoInit();
  }
})();
