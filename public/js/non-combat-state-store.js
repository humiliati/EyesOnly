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
    selectedBackupIndex: -1,
    maxBackupSlots: 25
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

    // Insert qty individual slots — no stacking
    var lastIdx = -1;
    for (var n = 0; n < qty; n++) {
      cards.push({ id: cardId, qty: 1, meta: null });
      lastIdx = cards.length - 1;
    }

    // Auto-select the last card we just added (sticky selection for quick backup move)
    selectedIdx = lastIdx;

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
    var maxSlots = Number(opts.maxSlots || _state.maxBackupSlots || 25);

    var hand = Array.isArray(_state.cardsInHand) ? _state.cardsInHand.slice() : [];
    var backup = Array.isArray(_state.backupCards) ? _state.backupCards.slice() : [];

    var hIdx = Number(_state.selectedHandIndex || -1);
    if (hIdx < 0 || hIdx >= hand.length || !hand[hIdx]) {
      // Fallback: if exactly one card in hand, assume it.
      if (hand.length === 1 && hand[0]) {
        hIdx = 0;
      } else {
        return false;
      }
    }

    // Insert at top of backup (newest)
    var bIdx = 0;

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
    backup.unshift({ id: ref.id, qty: 1, meta: ref.meta || null });
    var maxB = _state.maxBackupSlots || 25;
    while (backup.length > maxB) backup.pop();
    bIdx = 0;

    return modifyState({
      cardsInHand: hand,
      backupCards: backup,
      selectedHandIndex: hIdx,
      selectedBackupIndex: bIdx
    }, 'hand:move_to_backup', { cardId: ref.id, from: hIdx, to: bIdx });
  }

  function moveSelectedBackupToHand(opts) {
    opts = opts || {};
    var maxSlots = Number(opts.maxSlots || _state.maxBackupSlots || 25);

    var hand = Array.isArray(_state.cardsInHand) ? _state.cardsInHand.slice() : [];
    var backup = Array.isArray(_state.backupCards) ? _state.backupCards.slice() : [];

    var bIdx = Number(_state.selectedBackupIndex || -1);
    if (bIdx < 0 || bIdx >= backup.length || !backup[bIdx]) return false;

    var ref = backup[bIdx];

    // Remove from backup slot
    backup.splice(bIdx, 1);

    // Add to hand as individual slot — no stacking
    hand.push({ id: ref.id, qty: 1, meta: ref.meta || null });

    return modifyState({
      cardsInHand: hand,
      backupCards: backup,
      selectedBackupIndex: -1
    }, 'backup:move_to_hand', { cardId: ref.id, from: bIdx });
  }

  function consumeHandIndex(handIndex, qty) {
    qty = (typeof qty === 'number' ? qty : 1);
    qty = Math.max(1, qty);

    var hand = Array.isArray(_state.cardsInHand) ? _state.cardsInHand.slice() : [];
    var idx = Number(handIndex);
    if (!isFinite(idx) || idx < 0 || idx >= hand.length || !hand[idx]) return null;

    var id = hand[idx].id;
    var remaining = (hand[idx].qty || 1) - qty;
    if (remaining <= 0) {
      hand.splice(idx, 1);
      // adjust selection
      var sel = Number(_state.selectedHandIndex || -1);
      if (sel === idx) sel = -1;
      else if (sel > idx) sel = sel - 1;
      return modifyState({ cardsInHand: hand, selectedHandIndex: sel }, 'hand:consume', { id: id, qty: qty }) ? id : null;
    }

    hand[idx] = Object.assign({}, hand[idx], { qty: remaining });
    return modifyState({ cardsInHand: hand }, 'hand:consume', { id: id, qty: qty }) ? id : null;
  }

  function consumeBackupIndex(backupIndex) {
    var backup = Array.isArray(_state.backupCards) ? _state.backupCards.slice() : [];
    var idx = Number(backupIndex);
    if (!isFinite(idx) || idx < 0 || idx >= backup.length || !backup[idx]) return null;

    var id = backup[idx].id;
    backup[idx] = null;

    var sel = Number(_state.selectedBackupIndex || -1);
    if (sel === idx) sel = -1;

    return modifyState({ backupCards: backup, selectedBackupIndex: sel }, 'backup:consume', { id: id, idx: idx }) ? id : null;
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
    consumeHandIndex: consumeHandIndex,
    consumeBackupIndex: consumeBackupIndex,
    setSelectedHandIndex: setSelectedHandIndex,
    setSelectedBackupIndex: setSelectedBackupIndex,
    moveSelectedHandToBackup: moveSelectedHandToBackup,
    moveSelectedBackupToHand: moveSelectedBackupToHand,
    getHistory: getHistory,
    clearHistory: clearHistory
  };
})();
