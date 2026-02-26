/**
 * CardStateAuthority — Single source of truth for all card state.
 *
 * Wraps GAMESTATE card arrays and emits change events so that
 * NCH, HandFanComponent, BackupActionContainer, and STRCombatIntegration
 * all read from one place and stay in sync.
 *
 * NO component should hold mutable card state locally.
 * All mutations go through CardStateAuthority → GAMESTATE → event → re-render.
 *
 * Roadmap ref: Phase 1.1
 */
var CardStateAuthority = (function() {
  'use strict';

  // ── Listeners ──────────────────────────────────────────────
  var _listeners = {};  // eventType → [fn]

  function on(type, fn) {
    if (!type || typeof fn !== 'function') return;
    if (!_listeners[type]) _listeners[type] = [];
    _listeners[type].push(fn);
  }

  function off(type, fn) {
    if (!_listeners[type]) return;
    _listeners[type] = _listeners[type].filter(function(f) { return f !== fn; });
  }

  function _emit(type, payload) {
    var list = _listeners[type] || [];
    for (var i = 0; i < list.length; i++) {
      try { list[i](payload); } catch (e) {
        console.warn('[CardStateAuthority] listener error on ' + type, e);
      }
    }
    // Also emit on wildcard
    var any = _listeners['*'] || [];
    for (var j = 0; j < any.length; j++) {
      try { any[j]({ type: type, payload: payload }); } catch (e2) {}
    }
    // Mirror to NonCombatEventBus for backward compat
    if (typeof NonCombatEventBus !== 'undefined') {
      try { NonCombatEventBus.emit('csa:' + type, payload); } catch (e3) {}
    }
  }

  // ── Mode ───────────────────────────────────────────────────

  function getMode() {
    if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.isStrCombatActive === 'function') {
      return GoneRogue.isStrCombatActive() ? 'combat' : 'gr';
    }
    return 'gr';
  }

  function isCombat() {
    return getMode() === 'combat';
  }

  // ── Hand Reads ─────────────────────────────────────────────

  /**
   * Returns the canonical hand array (card refs with id, qty, meta).
   * Always reads from GAMESTATE. Returns a shallow copy.
   */
  function getHand() {
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getCardsInHand === 'function') {
      var h = GAMESTATE.getCardsInHand();
      return Array.isArray(h) ? h.slice() : [];
    }
    // Fallback: NonCombatStateStore (should not happen after migration)
    if (typeof NonCombatStateStore !== 'undefined') {
      var s = NonCombatStateStore.getState();
      return Array.isArray(s.cardsInHand) ? s.cardsInHand.slice() : [];
    }
    return [];
  }

  function getMaxHandSize() {
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getMaxHandSize === 'function') {
      return GAMESTATE.getMaxHandSize();
    }
    return 5;
  }

  // ── Backup Reads ───────────────────────────────────────────

  /**
   * Returns the full backup deck array (up to 25 cards).
   * Always reads from GAMESTATE. Returns a shallow copy.
   */
  function getBackup() {
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getBackupCards === 'function') {
      var b = GAMESTATE.getBackupCards();
      return Array.isArray(b) ? b.slice() : [];
    }
    if (typeof NonCombatStateStore !== 'undefined') {
      var s = NonCombatStateStore.getState();
      return Array.isArray(s.backupCards) ? s.backupCards.slice() : [];
    }
    return [];
  }

  /**
   * Returns the top N cards from backup deck (for left column display).
   */
  function getBackupTop(n) {
    return getBackup().slice(0, n || 5);
  }

  function getMaxBackupSlots() {
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getMaxBackupSlots === 'function') {
      return GAMESTATE.getMaxBackupSlots();
    }
    return 25;
  }

  // ── Vault / Persistent Reads ───────────────────────────────

  function getVault() {
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getPersistentCards === 'function') {
      var v = GAMESTATE.getPersistentCards();
      return Array.isArray(v) ? v.slice() : [];
    }
    return [];
  }

  // ── Equipped Item Reads ────────────────────────────────────

  function getEquippedItemId() {
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getActiveItemSlot === 'function') {
      return GAMESTATE.getActiveItemSlot();
    }
    return null;
  }

  /**
   * Returns the draw modifier based on equipped item.
   * 'default' | 'true-joker' | 'magnifying-glass'
   */
  function getEquippedDrawModifier() {
    var itemId = getEquippedItemId();
    if (!itemId) return 'default';
    // Normalize item ID to determine draw modifier
    var lower = (itemId + '').toLowerCase();
    if (lower.indexOf('true-joker') !== -1 || lower.indexOf('truejoker') !== -1 || lower === 'itm-joker') {
      return 'true-joker';
    }
    if (lower.indexOf('magnif') !== -1 || lower.indexOf('mag-glass') !== -1 || lower === 'itm-mag') {
      return 'magnifying-glass';
    }
    return 'default';
  }

  // ── Draw Tracking (Combat) ─────────────────────────────────

  var _turnDrawsRemaining = 1;
  var _turnDrawsMax = 1;
  var _lastKnownRound = -1;

  function resetTurnDraws(round) {
    // Determine max draws from items
    _turnDrawsMax = 1;
    var mod = getEquippedDrawModifier();
    // Items can expand draw count (extensible here)
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getCardDrawPerTurn === 'function') {
      _turnDrawsMax = GAMESTATE.getCardDrawPerTurn() || 1;
    }
    _turnDrawsRemaining = _turnDrawsMax;
    _lastKnownRound = round;
    // Also reset GAMESTATE flag for backward compat
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.resetTurnBackupDrawFlag === 'function') {
      GAMESTATE.resetTurnBackupDrawFlag();
    }
    _emit('draw:reset', { round: round, drawsRemaining: _turnDrawsRemaining });
  }

  function getTurnDrawsRemaining() {
    return _turnDrawsRemaining;
  }

  function getLastKnownRound() {
    return _lastKnownRound;
  }

  /**
   * Check round change and auto-reset draws if needed.
   * Called from integration layer's 100ms poll.
   */
  function checkRoundChange(currentRound) {
    if (currentRound !== _lastKnownRound && currentRound > 0) {
      resetTurnDraws(currentRound);
    }
  }

  // ── Hand Mutations ─────────────────────────────────────────

  function addCardToHand(cardId, qty) {
    qty = qty || 1;
    var success = false;
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.addCardToHand === 'function') {
      success = GAMESTATE.addCardToHand(cardId, qty);
    } else if (typeof NonCombatStateStore !== 'undefined') {
      success = NonCombatStateStore.addCardToHand(cardId, qty);
    }
    if (success !== false) {
      _syncNonCombatStore();
      _emit('hand:changed', { action: 'add', cardId: cardId, qty: qty, hand: getHand() });
    }
    return success;
  }

  function consumeFromHand(handIndex, qty) {
    qty = qty || 1;
    var success = false;
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.consumeCardFromHand === 'function') {
      success = GAMESTATE.consumeCardFromHand(handIndex, qty);
    } else if (typeof NonCombatStateStore !== 'undefined') {
      success = NonCombatStateStore.consumeHandIndex(handIndex, qty);
    }
    if (success !== false) {
      _syncNonCombatStore();
      _emit('hand:changed', { action: 'consume', index: handIndex, qty: qty, hand: getHand() });
    }
    return success;
  }

  // ── Backup Mutations ───────────────────────────────────────

  function removeBackupCard(backupIndex) {
    var success = false;
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.removeBackupCard === 'function') {
      success = GAMESTATE.removeBackupCard(backupIndex);
    } else if (typeof NonCombatStateStore !== 'undefined') {
      success = NonCombatStateStore.consumeBackupIndex(backupIndex);
    }
    if (success !== false) {
      _syncNonCombatStore();
      _emit('backup:changed', { action: 'remove', index: backupIndex, backup: getBackup() });
    }
    return success;
  }

  // ── Cross-Container Transfers ──────────────────────────────

  /**
   * Move a card from backup deck to hand.
   * @param {number} backupIndex - index in backup array
   * @returns {boolean} success
   */
  function moveBackupToHand(backupIndex) {
    var hand = getHand();
    if (hand.length >= getMaxHandSize()) {
      _emit('transfer:rejected', { reason: 'hand_full', from: 'backup', index: backupIndex });
      return false;
    }
    var success = false;
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.moveBackupIndexToHand === 'function') {
      success = GAMESTATE.moveBackupIndexToHand(backupIndex);
    }
    if (success !== false) {
      _syncNonCombatStore();
      _emit('hand:changed', { action: 'from_backup', index: backupIndex, hand: getHand() });
      _emit('backup:changed', { action: 'to_hand', index: backupIndex, backup: getBackup() });
    }
    return success;
  }

  /**
   * Move a card from hand to backup deck.
   * @param {number} handIndex - index in hand array
   * @returns {boolean} success
   */
  function moveHandToBackup(handIndex) {
    var success = false;
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.moveHandIndexToBackup === 'function') {
      success = GAMESTATE.moveHandIndexToBackup(handIndex);
    }
    if (success !== false) {
      _syncNonCombatStore();
      _emit('hand:changed', { action: 'to_backup', index: handIndex, hand: getHand() });
      _emit('backup:changed', { action: 'from_hand', index: handIndex, backup: getBackup() });
    }
    return success;
  }

  /**
   * Push oldest hand card back to backup (end-of-turn in combat).
   * @returns {object|null} { success, returnedCard }
   */
  function pushOldestHandToBackup() {
    var result = null;
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.pushOldestHandCardToBackup === 'function') {
      result = GAMESTATE.pushOldestHandCardToBackup();
    }
    if (result && result.success) {
      _syncNonCombatStore();
      _emit('hand:changed', { action: 'push_oldest', returnedCard: result.returnedCard, hand: getHand() });
      _emit('backup:changed', { action: 'received_oldest', backup: getBackup() });
    }
    return result;
  }

  // ── Combat Draw (Item-Aware) ───────────────────────────────

  /**
   * Draw a card from backup during combat.
   *
   * @param {number} selectedIndex - index of the card in backup to draw
   *   For 'default': any of top 5
   *   For 'true-joker': any index in full deck
   *   For 'magnifying-glass': exact pick from top 5 (or joker via draw button)
   * @param {string} mode - 'pick' (select specific card) or 'button' (draw button action)
   * @returns {boolean} success
   */
  function drawFromBackup(selectedIndex, mode) {
    mode = mode || 'pick';

    if (_turnDrawsRemaining <= 0) {
      _emit('draw:rejected', { reason: 'no_draws_remaining' });
      return false;
    }

    var modifier = getEquippedDrawModifier();
    var backup = getBackup();

    // Validate index based on modifier
    if (modifier === 'default') {
      // Can only pick from top 5
      if (selectedIndex < 0 || selectedIndex >= Math.min(5, backup.length)) {
        _emit('draw:rejected', { reason: 'index_out_of_range', modifier: modifier, index: selectedIndex });
        return false;
      }
    } else if (modifier === 'magnifying-glass') {
      if (mode === 'button') {
        // Draw button with magnifying glass: find first true joker in full deck
        selectedIndex = _findTrueJokerIndex(backup);
        if (selectedIndex < 0) {
          _emit('draw:rejected', { reason: 'no_true_joker_in_deck', modifier: modifier });
          return false;
        }
      } else {
        // Exact pick from top 5 only
        if (selectedIndex < 0 || selectedIndex >= Math.min(5, backup.length)) {
          _emit('draw:rejected', { reason: 'index_out_of_range', modifier: modifier, index: selectedIndex });
          return false;
        }
      }
    } else if (modifier === 'true-joker') {
      // Can pick from anywhere in full deck
      if (selectedIndex < 0 || selectedIndex >= backup.length) {
        _emit('draw:rejected', { reason: 'index_out_of_range', modifier: modifier, index: selectedIndex });
        return false;
      }
    }

    // Execute the draw
    var success = moveBackupToHand(selectedIndex);
    if (success) {
      _turnDrawsRemaining--;
      _emit('draw:executed', {
        index: selectedIndex,
        modifier: modifier,
        mode: mode,
        drawsRemaining: _turnDrawsRemaining,
        hand: getHand(),
        backup: getBackup()
      });
    }
    return success;
  }

  function _findTrueJokerIndex(backup) {
    for (var i = 0; i < backup.length; i++) {
      var id = (backup[i].id || '').toLowerCase();
      if (id.indexOf('true-joker') !== -1 || id.indexOf('truejoker') !== -1 || id === 'act-joker') {
        return i;
      }
    }
    return -1;
  }

  // ── Backup Reorder ─────────────────────────────────────────

  /**
   * Reorder backup deck: move card from one index to another.
   * @param {number} fromIndex
   * @param {number} toIndex
   */
  function reorderBackup(fromIndex, toIndex) {
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.reorderBackupCard === 'function') {
      GAMESTATE.reorderBackupCard(fromIndex, toIndex);
    } else {
      // Manual reorder via remove + insert if GAMESTATE doesn't have the method
      var backup = getBackup();
      if (fromIndex < 0 || fromIndex >= backup.length || toIndex < 0 || toIndex >= backup.length) return;
      var card = backup.splice(fromIndex, 1)[0];
      backup.splice(toIndex, 0, card);
      // Write back — need GAMESTATE.setBackupCards or equivalent
      if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.setBackupCards === 'function') {
        GAMESTATE.setBackupCards(backup);
      }
    }
    _syncNonCombatStore();
    _emit('backup:changed', { action: 'reorder', from: fromIndex, to: toIndex, backup: getBackup() });
  }

  /**
   * Shuffle the backup deck.
   */
  function shuffleBackup() {
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.shuffleBackupDeck === 'function') {
      GAMESTATE.shuffleBackupDeck();
    }
    _syncNonCombatStore();
    _emit('backup:changed', { action: 'shuffle', backup: getBackup() });
  }

  /**
   * Sort the backup deck.
   * @param {string} sortKey - e.g. 'quality'
   */
  function sortBackup(sortKey) {
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.sortBackupDeck === 'function') {
      GAMESTATE.sortBackupDeck(sortKey || 'quality');
    }
    _syncNonCombatStore();
    _emit('backup:changed', { action: 'sort', sortKey: sortKey, backup: getBackup() });
  }

  // ── Vault Reads ──────────────────────────────────────────

  function getMaxVaultSlots() {
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getMaxVaultSlots === 'function') {
      return GAMESTATE.getMaxVaultSlots();
    }
    return 20; // default vault capacity
  }

  function isVaultFull() {
    return getVault().length >= getMaxVaultSlots();
  }

  // ── Vault Transfers ────────────────────────────────────────

  /**
   * Remove a card from the vault/persistent inventory.
   * @param {string} cardId
   * @param {number} qty
   * @returns {boolean}
   */
  function _removeFromVault(cardId, qty) {
    qty = qty || 1;
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.removePersistentCard === 'function') {
      return GAMESTATE.removePersistentCard(cardId, qty) !== false;
    }
    // Fallback: try consumePersistentCard
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.consumePersistentCard === 'function') {
      return GAMESTATE.consumePersistentCard(cardId, qty) !== false;
    }
    // Last resort: try to manipulate the array directly
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getPersistentCards === 'function' &&
        typeof GAMESTATE.setPersistentCards === 'function') {
      var cards = GAMESTATE.getPersistentCards();
      if (!Array.isArray(cards)) return false;
      for (var i = 0; i < cards.length; i++) {
        if (cards[i] && cards[i].id === cardId) {
          var cur = cards[i].qty || 1;
          if (cur <= qty) {
            cards.splice(i, 1);
          } else {
            cards[i].qty = cur - qty;
          }
          GAMESTATE.setPersistentCards(cards);
          return true;
        }
      }
    }
    return false;
  }

  function moveHandToVault(handIndex, qty) {
    qty = qty || 1;
    var hand = getHand();
    if (handIndex < 0 || handIndex >= hand.length) return false;
    var card = hand[handIndex];
    if (!card) return false;

    // Check vault capacity
    if (isVaultFull()) {
      _emit('transfer:rejected', { reason: 'vault_full', from: 'hand', cardId: card.id });
      return false;
    }

    var success = false;
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.addPersistentCard === 'function') {
      success = GAMESTATE.addPersistentCard(card.id, qty);
      if (success !== false) {
        consumeFromHand(handIndex, qty);
      }
    }
    if (success !== false) {
      _emit('vault:changed', { action: 'from_hand', cardId: card.id, vault: getVault() });
    }
    return success;
  }

  function moveBackupToVault(backupIndex) {
    var backup = getBackup();
    if (backupIndex < 0 || backupIndex >= backup.length) return false;
    var card = backup[backupIndex];
    if (!card) return false;

    // Check vault capacity
    if (isVaultFull()) {
      _emit('transfer:rejected', { reason: 'vault_full', from: 'backup', cardId: card.id });
      return false;
    }

    var success = false;
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.addPersistentCard === 'function') {
      success = GAMESTATE.addPersistentCard(card.id, card.qty || 1);
      if (success !== false) {
        removeBackupCard(backupIndex);
      }
    }
    if (success !== false) {
      _emit('vault:changed', { action: 'from_backup', cardId: card.id, vault: getVault() });
    }
    return success;
  }

  /**
   * Move card from vault to hand. MOVE semantics — removes from vault.
   * @param {string} cardId
   * @param {number} qty
   * @returns {boolean}
   */
  function moveVaultToHand(cardId, qty) {
    qty = qty || 1;
    var hand = getHand();
    if (hand.length >= getMaxHandSize()) {
      _emit('transfer:rejected', { reason: 'hand_full', from: 'vault', cardId: cardId });
      return false;
    }

    if (typeof GAMESTATE === 'undefined') return false;
    if (typeof GAMESTATE.addCardToHand !== 'function') return false;

    // First remove from vault, then add to hand (atomic move)
    var removed = _removeFromVault(cardId, qty);
    if (!removed) {
      console.warn('[CardStateAuthority] moveVaultToHand: failed to remove from vault', cardId);
      return false;
    }

    GAMESTATE.addCardToHand(cardId, qty);
    _syncNonCombatStore();
    _emit('hand:changed', { action: 'from_vault', cardId: cardId, hand: getHand() });
    _emit('vault:changed', { action: 'to_hand', cardId: cardId, vault: getVault() });
    return true;
  }

  /**
   * Move card from vault to backup deck. MOVE semantics — removes from vault.
   * @param {string} cardId
   * @returns {boolean}
   */
  function moveVaultToBackup(cardId) {
    // Check backup capacity
    var backup = getBackup();
    if (backup.length >= getMaxBackupSlots()) {
      _emit('transfer:rejected', { reason: 'backup_full', from: 'vault', cardId: cardId });
      return false;
    }

    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.moveStashCardToBackup === 'function') {
      // This GAMESTATE method may handle removal internally
      GAMESTATE.moveStashCardToBackup(cardId);
      _syncNonCombatStore();
      _emit('backup:changed', { action: 'from_vault', cardId: cardId, backup: getBackup() });
      _emit('vault:changed', { action: 'to_backup', cardId: cardId, vault: getVault() });
      return true;
    }

    // Manual fallback: remove from vault, add to backup
    var removed = _removeFromVault(cardId, 1);
    if (!removed) return false;

    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.addBackupCard === 'function') {
      GAMESTATE.addBackupCard(cardId);
    }
    _syncNonCombatStore();
    _emit('backup:changed', { action: 'from_vault', cardId: cardId, backup: getBackup() });
    _emit('vault:changed', { action: 'to_backup', cardId: cardId, vault: getVault() });
    return true;
  }

  // ── Equip Item Slot ────────────────────────────────────────

  /**
   * Equip an item from vault to the active item slot in website header.
   * Old equipped item returns to vault.
   * @param {string} cardId - item to equip from vault
   * @returns {boolean}
   */
  function equipItemFromVault(cardId) {
    if (typeof GAMESTATE === 'undefined') return false;

    var currentEquipped = getEquippedItemId();

    // Remove new item from vault
    var removed = _removeFromVault(cardId, 1);
    if (!removed) return false;

    // If something is already equipped, return it to vault
    if (currentEquipped) {
      if (typeof GAMESTATE.addPersistentCard === 'function') {
        GAMESTATE.addPersistentCard(currentEquipped, 1);
      }
    }

    // Set the new equipped item
    if (typeof GAMESTATE.setActiveItemSlot === 'function') {
      GAMESTATE.setActiveItemSlot(cardId);
    }

    _syncNonCombatStore();
    _emit('vault:changed', { action: 'equip', cardId: cardId, vault: getVault() });
    _emit('equipped:changed', { cardId: cardId, previousId: currentEquipped });
    return true;
  }

  /**
   * Unequip the current item back to vault.
   * @returns {boolean}
   */
  function unequipItem() {
    if (typeof GAMESTATE === 'undefined') return false;
    var currentEquipped = getEquippedItemId();
    if (!currentEquipped) return false;

    // Check vault capacity
    if (isVaultFull()) {
      _emit('transfer:rejected', { reason: 'vault_full', from: 'equipped', cardId: currentEquipped });
      return false;
    }

    // Return to vault
    if (typeof GAMESTATE.addPersistentCard === 'function') {
      GAMESTATE.addPersistentCard(currentEquipped, 1);
    }

    // Clear slot
    if (typeof GAMESTATE.setActiveItemSlot === 'function') {
      GAMESTATE.setActiveItemSlot(null);
    }

    _syncNonCombatStore();
    _emit('vault:changed', { action: 'unequip', cardId: currentEquipped, vault: getVault() });
    _emit('equipped:changed', { cardId: null, previousId: currentEquipped });
    return true;
  }

  // ── Map Pickup Routing ────────────────────────────────────

  /**
   * Route a card picked up from the map to the correct container.
   * Items → vault (account inventory). Cards → backup deck top.
   *
   * Overflow rules:
   * - Backup at capacity: auto-incinerate the FURTHEST (bottom) card
   * - Vault at capacity: reject pickup, emit event for manual disposal UI
   *
   * @param {string} cardId
   * @param {string} cardType - 'item' | 'card' | auto-detect from def
   * @returns {{ success: boolean, destination: string, incinerated: string|null }}
   */
  function pickupFromMap(cardId, cardType) {
    var result = { success: false, destination: null, incinerated: null };

    // Auto-detect type from card definition
    if (!cardType) {
      var def = getCardDef(cardId);
      if (def && def.type) {
        var t = ('' + def.type).toLowerCase();
        cardType = (t.indexOf('item') !== -1 || t.indexOf('equip') !== -1) ? 'item' : 'card';
      } else {
        cardType = 'card'; // default to card
      }
    }

    if (cardType === 'item') {
      // Items → vault
      if (isVaultFull()) {
        _emit('pickup:rejected', { reason: 'vault_full', cardId: cardId, cardType: 'item' });
        result.success = false;
        return result;
      }

      if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.addPersistentCard === 'function') {
        var ok = GAMESTATE.addPersistentCard(cardId, 1);
        if (ok !== false) {
          _syncNonCombatStore();
          result.success = true;
          result.destination = 'vault';
          _emit('vault:changed', { action: 'pickup', cardId: cardId, vault: getVault() });
          _emit('pickup:routed', { cardId: cardId, destination: 'vault' });
        }
      }
    } else {
      // Cards → backup deck top
      var backup = getBackup();

      if (backup.length >= getMaxBackupSlots()) {
        // Auto-incinerate the FURTHEST (bottom/last) card
        var incineratedCard = backup[backup.length - 1];
        removeBackupCard(backup.length - 1);
        result.incinerated = incineratedCard ? incineratedCard.id : null;
        _emit('backup:incinerated', {
          cardId: result.incinerated,
          reason: 'overflow',
          backup: getBackup()
        });
      }

      // Add new card to top of backup (index 0)
      if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.addBackupCardToTop === 'function') {
        GAMESTATE.addBackupCardToTop(cardId);
      } else if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.addBackupCard === 'function') {
        GAMESTATE.addBackupCard(cardId);
        // If addBackupCard appends to bottom, reorder to top
        var newBackup = getBackup();
        if (newBackup.length > 1 && newBackup[newBackup.length - 1].id === cardId) {
          reorderBackup(newBackup.length - 1, 0);
        }
      }

      _syncNonCombatStore();
      result.success = true;
      result.destination = 'backup';
      _emit('backup:changed', { action: 'pickup', cardId: cardId, backup: getBackup() });
      _emit('pickup:routed', { cardId: cardId, destination: 'backup', incinerated: result.incinerated });
    }

    return result;
  }

  // ── Hand Overflow (Dupe Trickle) ──────────────────────────

  /**
   * Add a card to hand with overflow handling.
   * If hand is full, trickle to backup deck top.
   * If backup is also full, auto-incinerate backup bottom.
   *
   * Used by 3D printer during combat and dupe mechanics.
   *
   * @param {string} cardId
   * @param {number} qty
   * @returns {{ placed: string, incinerated: string|null }}
   */
  function addCardWithOverflow(cardId, qty) {
    qty = qty || 1;
    var results = [];

    for (var q = 0; q < qty; q++) {
      var result = { placed: null, incinerated: null };
      var hand = getHand();

      if (hand.length < getMaxHandSize()) {
        // Fits in hand
        addCardToHand(cardId, 1);
        result.placed = 'hand';
      } else {
        // Trickle to backup
        var backup = getBackup();
        if (backup.length >= getMaxBackupSlots()) {
          // Auto-incinerate bottom
          var incCard = backup[backup.length - 1];
          removeBackupCard(backup.length - 1);
          result.incinerated = incCard ? incCard.id : null;
          _emit('backup:incinerated', { cardId: result.incinerated, reason: 'overflow_trickle' });
        }

        // Add to backup top
        if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.addBackupCardToTop === 'function') {
          GAMESTATE.addBackupCardToTop(cardId);
        } else if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.addBackupCard === 'function') {
          GAMESTATE.addBackupCard(cardId);
        }
        _syncNonCombatStore();
        _emit('backup:changed', { action: 'trickle', cardId: cardId, backup: getBackup() });
        result.placed = 'backup';
      }
      results.push(result);
    }

    return results.length === 1 ? results[0] : results;
  }

  // ── Vault Disposal ─────────────────────────────────────────

  /**
   * Dispose an item from vault to debrief feed (permanent removal).
   * Used when vault is full and player manually discards.
   * @param {string} cardId
   * @returns {boolean}
   */
  function disposeFromVault(cardId) {
    var removed = _removeFromVault(cardId, 1);
    if (removed) {
      _emit('vault:changed', { action: 'disposed', cardId: cardId, vault: getVault() });
      _emit('card:disposed', { cardId: cardId, source: 'vault' });
      // Notify debrief feed if available
      if (typeof NonCombatEventBus !== 'undefined') {
        NonCombatEventBus.emit('debrief:card-disposed', { cardId: cardId, source: 'vault' });
      }
    }
    return removed;
  }

  // ── Sync NonCombatStateStore (backward compat) ─────────────

  /**
   * Push current GAMESTATE card arrays into NonCombatStateStore
   * so legacy subscribers still get updates.
   */
  function _syncNonCombatStore() {
    if (typeof NonCombatStateStore === 'undefined') return;
    if (typeof NonCombatStateStore.modifyState !== 'function') return;
    try {
      NonCombatStateStore.modifyState({
        cardsInHand: getHand(),
        backupCards: getBackup()
      }, 'csa:sync', 'CardStateAuthority');
    } catch (e) {
      console.warn('[CardStateAuthority] NonCombatStateStore sync failed', e);
    }
  }

  // ── Snapshot (for signature-based change detection) ────────

  /**
   * Returns a string signature of the current card state.
   * Components can compare this to their last-known signature
   * to decide whether to re-render.
   */
  function getSignature() {
    var hand = getHand();
    var backup = getBackup();
    var vault = getVault();
    var parts = [];
    for (var i = 0; i < hand.length; i++) {
      parts.push('h:' + hand[i].id + ':' + (hand[i].qty || 1));
    }
    for (var j = 0; j < backup.length; j++) {
      parts.push('b:' + backup[j].id + ':' + (backup[j].qty || 1));
    }
    for (var k = 0; k < vault.length; k++) {
      parts.push('v:' + vault[k].id + ':' + (vault[k].qty || 1));
    }
    parts.push('m:' + getMode());
    parts.push('d:' + _turnDrawsRemaining);
    parts.push('e:' + (getEquippedItemId() || 'none'));
    return parts.join('|');
  }

  // ── Resource Reads (for affordability) ─────────────────────

  function getResources() {
    var res = { ammo: 0, battery: 0, energy: 0, focus: 0 };
    if (typeof GAMESTATE === 'undefined') return res;
    if (typeof GAMESTATE.getAmmo === 'function') res.ammo = GAMESTATE.getAmmo() || 0;
    if (typeof GAMESTATE.getBattery === 'function') res.battery = GAMESTATE.getBattery() || 0;
    if (typeof GAMESTATE.getEnergy === 'function') res.energy = GAMESTATE.getEnergy() || 0;
    if (typeof GAMESTATE.getFocus === 'function') res.focus = GAMESTATE.getFocus() || 0;
    return res;
  }

  function canAffordCard(card) {
    if (!card || !card.costs || !Array.isArray(card.costs)) return true;
    var res = getResources();
    for (var i = 0; i < card.costs.length; i++) {
      var c = card.costs[i];
      if (c.kind && c.amount) {
        var have = res[c.kind] || 0;
        if (have < c.amount) return false;
      }
    }
    return true;
  }

  // ── Card Definition Lookup ─────────────────────────────────

  function getCardDef(cardId) {
    if (typeof GoneRogueDataRegistry !== 'undefined' && typeof GoneRogueDataRegistry.getCard === 'function') {
      return GoneRogueDataRegistry.getCard(cardId);
    }
    return null;
  }

  /**
   * Expand card refs (with qty) into individual card objects for UI rendering.
   * E.g. {id: 'ATK-001', qty: 3} → [cardDef, cardDef, cardDef]
   */
  function expandHandForDisplay() {
    var hand = getHand();
    var expanded = [];
    for (var i = 0; i < hand.length; i++) {
      var ref = hand[i];
      var def = getCardDef(ref.id);
      var qty = ref.qty || 1;
      for (var q = 0; q < qty; q++) {
        expanded.push(Object.assign({}, def || {}, {
          id: ref.id,
          _refIndex: i,
          _refQty: qty,
          _qtyOffset: q
        }));
      }
    }
    return expanded;
  }

  // ── Public API ─────────────────────────────────────────────

  return {
    // Event system
    on: on,
    off: off,

    // Mode
    getMode: getMode,
    isCombat: isCombat,

    // Reads
    getHand: getHand,
    getMaxHandSize: getMaxHandSize,
    getBackup: getBackup,
    getBackupTop: getBackupTop,
    getMaxBackupSlots: getMaxBackupSlots,
    getVault: getVault,
    getMaxVaultSlots: getMaxVaultSlots,
    isVaultFull: isVaultFull,
    getEquippedItemId: getEquippedItemId,
    getEquippedDrawModifier: getEquippedDrawModifier,
    getResources: getResources,
    canAffordCard: canAffordCard,
    getCardDef: getCardDef,
    expandHandForDisplay: expandHandForDisplay,
    getSignature: getSignature,

    // Hand mutations
    addCardToHand: addCardToHand,
    consumeFromHand: consumeFromHand,

    // Backup mutations
    removeBackupCard: removeBackupCard,
    reorderBackup: reorderBackup,
    shuffleBackup: shuffleBackup,
    sortBackup: sortBackup,

    // Cross-container transfers
    moveBackupToHand: moveBackupToHand,
    moveHandToBackup: moveHandToBackup,
    pushOldestHandToBackup: pushOldestHandToBackup,
    moveHandToVault: moveHandToVault,
    moveBackupToVault: moveBackupToVault,
    moveVaultToHand: moveVaultToHand,
    moveVaultToBackup: moveVaultToBackup,

    // Equip slot
    equipItemFromVault: equipItemFromVault,
    unequipItem: unequipItem,

    // Map pickup routing
    pickupFromMap: pickupFromMap,

    // Overflow handling
    addCardWithOverflow: addCardWithOverflow,

    // Vault disposal
    disposeFromVault: disposeFromVault,

    // Combat draw (item-aware)
    drawFromBackup: drawFromBackup,
    getTurnDrawsRemaining: getTurnDrawsRemaining,
    resetTurnDraws: resetTurnDraws,
    checkRoundChange: checkRoundChange,
    getLastKnownRound: getLastKnownRound
  };

})();
