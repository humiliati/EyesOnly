/* ============================================================
   Non-Combat State Store + History (localStorage-backed)
   Single source of truth for non-combat HUD + designer debugging.
   ============================================================ */

var NonCombatStateStore = (function() {
  'use strict';

  var STORAGE_KEY = 'EYESONLY_NONCOMBAT_STATE_V1';
  var HISTORY_KEY = 'EYESONLY_NONCOMBAT_STATE_HISTORY_V1';
  var MAX_HISTORY = 220;

  var NON_COMBAT_STATES = {
    IDLE: 'idle',
    BUTTON_PENDING: 'button_pending',
    CARD_PENDING: 'card_pending',
    ITEM_PENDING: 'item_pending',
    TARGETING: 'targeting',
    SYNERGY_MODE: 'synergy_mode',
    CONFIRMATION: 'confirmation',
    ANIMATING: 'animating',
    COOLDOWN: 'cooldown'
  };

  var _state = {
    uiState: NON_COMBAT_STATES.IDLE,

    playerHealth: 10,
    playerMaxHealth: 10,

    resourceCurrency: 0,
    resourceFocus: 0,

    statusEffects: [],
    activeCooldowns: {},
    unlockedActions: [],

    equippedItemId: null,
    cardsInHand: []
  };

  var _subs = [];

  function _load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          _state = Object.assign({}, _state, parsed);
        }
      }
    } catch (e) {}
  }

  function _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
    } catch (e) {}
  }

  function _appendHistory(entry) {
    try {
      var raw = localStorage.getItem(HISTORY_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) arr = [];
      arr.push(entry);
      if (arr.length > MAX_HISTORY) {
        arr = arr.slice(arr.length - MAX_HISTORY);
      }
      localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
    } catch (e) {}
  }

  function getState() {
    return JSON.parse(JSON.stringify(_state));
  }

  function subscribe(fn) {
    if (typeof fn === 'function') _subs.push(fn);
  }

  function _notify(prev, next) {
    for (var i = 0; i < _subs.length; i++) {
      try { _subs[i](prev, next); } catch (e) {}
    }
  }

  function modifyState(partial, triggerEvent, context) {
    partial = partial || {};
    var prev = getState();
    var next = Object.assign({}, _state, partial);

    // Basic validation: keep health in bounds
    if (typeof next.playerMaxHealth === 'number' && typeof next.playerHealth === 'number') {
      next.playerHealth = Math.max(0, Math.min(next.playerMaxHealth, next.playerHealth));
    }

    _state = next;
    _save();

    _appendHistory({
      component_id: 'non_combat_global',
      previous_state: prev.uiState,
      new_state: next.uiState,
      trigger_event: triggerEvent || 'modifyState',
      timestamp: new Date().toISOString(),
      context: context || null
    });

    if (typeof NonCombatEventBus !== 'undefined') {
      NonCombatEventBus.emit('state:changed', { prev: prev, next: getState() });
    }

    _notify(prev, getState());
    return true;
  }

  function transitionTo(newUiState, triggerEvent, context) {
    if (!newUiState) return false;
    return modifyState({ uiState: newUiState }, triggerEvent || 'transition', context);
  }

  function modifyResource(resourceKey, delta, triggerEvent, context) {
    var partial = {};
    var cur = Number(_state[resourceKey] || 0);
    var next = cur + Number(delta || 0);
    if (!isFinite(next)) next = cur;

    // Simple caps: currency/focus >= 0
    if (resourceKey === 'resourceCurrency' || resourceKey === 'resourceFocus') {
      next = Math.max(0, next);
    }

    partial[resourceKey] = next;
    return modifyState(partial, triggerEvent || 'resource:changed', context);
  }

  function getHistory() {
    try {
      var raw = localStorage.getItem(HISTORY_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function clearHistory() {
    try { localStorage.removeItem(HISTORY_KEY); } catch (e) {}
  }

  // Init
  _load();

  function addCardToHand(cardId, qty, triggerEvent, context) {
    qty = (typeof qty === 'number' ? qty : 1);
    qty = Math.max(1, qty);

    var cards = Array.isArray(_state.cardsInHand) ? _state.cardsInHand.slice() : [];
    var found = false;
    for (var i = 0; i < cards.length; i++) {
      if (cards[i] && cards[i].id === cardId) {
        cards[i] = Object.assign({}, cards[i], { qty: (cards[i].qty || 0) + qty });
        found = true;
        break;
      }
    }
    if (!found) {
      cards.push({ id: cardId, qty: qty, meta: null });
    }

    return modifyState({ cardsInHand: cards }, triggerEvent || 'hand:add_card', context || { id: cardId, qty: qty });
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    HISTORY_KEY: HISTORY_KEY,
    NON_COMBAT_STATES: NON_COMBAT_STATES,
    getState: getState,
    subscribe: subscribe,
    modifyState: modifyState,
    transitionTo: transitionTo,
    modifyResource: modifyResource,
    addCardToHand: addCardToHand,
    getHistory: getHistory,
    clearHistory: clearHistory
  };
})();
