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
    cardsInHand: [],
    backupCards: [],
    selectedHandIndex: -1,
    selectedBackupIndex: -1
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
    var selectedIdx = Number(_state.selectedHandIndex || -1);

    var foundIdx = -1;
    for (var i = 0; i < cards.length; i++) {
      if (cards[i] && cards[i].id === cardId) {
        foundIdx = i;
        cards[i] = Object.assign({}, cards[i], { qty: (cards[i].qty || 0) + qty });
        break;
      }
    }

    if (foundIdx === -1) {
      cards.push({ id: cardId, qty: qty, meta: null });
      foundIdx = cards.length - 1;
    }

    // Auto-select the card we just added/moved (sticky selection for quick backup move)
    selectedIdx = foundIdx;

    return modifyState({ cardsInHand: cards, selectedHandIndex: selectedIdx }, triggerEvent || 'hand:add_card', context || { id: cardId, qty: qty });
  }

  function setSelectedHandIndex(idx) {
    idx = Number(idx);
    if (!isFinite(idx)) idx = -1;
    return modifyState({ selectedHandIndex: idx }, 'hand:select', { idx: idx });
  }

  function setSelectedBackupIndex(idx) {
    idx = Number(idx);
    if (!isFinite(idx)) idx = -1;
    return modifyState({ selectedBackupIndex: idx }, 'backup:select', { idx: idx });
  }

  function moveSelectedHandToBackup(opts) {
    opts = opts || {};
    var maxSlots = Number(opts.maxSlots || 4);

    var hand = Array.isArray(_state.cardsInHand) ? _state.cardsInHand.slice() : [];
    var backup = Array.isArray(_state.backupCards) ? _state.backupCards.slice() : [];

    // Ensure fixed-length array for stable UI
    if (backup.length < maxSlots) {
      while (backup.length < maxSlots) backup.push(null);
    }
    if (backup.length > maxSlots) backup = backup.slice(0, maxSlots);

    var hIdx = Number(_state.selectedHandIndex || -1);
    if (hIdx < 0 || hIdx >= hand.length || !hand[hIdx]) {
      return false;
    }

    // Find empty backup slot
    var bIdx = -1;
    for (var i = 0; i < backup.length; i++) {
      if (!backup[i]) { bIdx = i; break; }
    }
    if (bIdx === -1) return false;

    var ref = Object.assign({}, hand[hIdx]);

    // Decrement from hand by 1
    var remaining = (hand[hIdx].qty || 1) - 1;
    if (remaining <= 0) {
      hand.splice(hIdx, 1);
      hIdx = Math.min(hIdx, hand.length - 1);
    } else {
      hand[hIdx] = Object.assign({}, hand[hIdx], { qty: remaining });
    }

    // Place into backup as qty 1 (single card unit)
    backup[bIdx] = { id: ref.id, qty: 1, meta: ref.meta || null };

    return modifyState({
      cardsInHand: hand,
      backupCards: backup,
      selectedHandIndex: hIdx,
      selectedBackupIndex: bIdx
    }, 'hand:move_to_backup', { cardId: ref.id, from: hIdx, to: bIdx });
  }

  function moveSelectedBackupToHand(opts) {
    opts = opts || {};
    var maxSlots = Number(opts.maxSlots || 4);

    var hand = Array.isArray(_state.cardsInHand) ? _state.cardsInHand.slice() : [];
    var backup = Array.isArray(_state.backupCards) ? _state.backupCards.slice() : [];

    if (backup.length < maxSlots) {
      while (backup.length < maxSlots) backup.push(null);
    }
    if (backup.length > maxSlots) backup = backup.slice(0, maxSlots);

    var bIdx = Number(_state.selectedBackupIndex || -1);
    if (bIdx < 0 || bIdx >= backup.length || !backup[bIdx]) return false;

    var ref = backup[bIdx];

    // Clear backup slot
    backup[bIdx] = null;

    // Add to hand (stack qty)
    var found = false;
    for (var i = 0; i < hand.length; i++) {
      if (hand[i] && hand[i].id === ref.id) {
        hand[i] = Object.assign({}, hand[i], { qty: (hand[i].qty || 0) + 1 });
        found = true;
        break;
      }
    }
    if (!found) {
      hand.push({ id: ref.id, qty: 1, meta: ref.meta || null });
    }

    return modifyState({
      cardsInHand: hand,
      backupCards: backup,
      selectedBackupIndex: -1
    }, 'backup:move_to_hand', { cardId: ref.id, from: bIdx });
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
    setSelectedHandIndex: setSelectedHandIndex,
    setSelectedBackupIndex: setSelectedBackupIndex,
    moveSelectedHandToBackup: moveSelectedHandToBackup,
    moveSelectedBackupToHand: moveSelectedBackupToHand,
    getHistory: getHistory,
    clearHistory: clearHistory
  };
})();
