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
    // Window-level fallback event — guarantees BAC / NCH can re-render even if
    // .on() subscriptions didn't connect (e.g., load-order race).
    try {
      window.dispatchEvent(new CustomEvent('csa-event', { detail: { type: type, payload: payload } }));
    } catch (e4) {}
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
    if (currentRound !== _lastKnownRound && currentRound >= 0) {
      resetTurnDraws(currentRound);
    }
  }

  /**
   * Reset draw tracking for a new combat encounter.
   * Must be called at combat entry so _lastKnownRound doesn't carry over
   * from a previous combat (which would skip draw resets on matching rounds).
   */
  function resetCombatDrawState() {
    _lastKnownRound = -1;
    _turnDrawsRemaining = _turnDrawsMax;
    // Also reset GAMESTATE backup draw flag
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.resetTurnBackupDrawFlag === 'function') {
      GAMESTATE.resetTurnBackupDrawFlag();
    }
    _emit('draw:reset', { round: 0, drawsRemaining: _turnDrawsRemaining });
  }

  // ── Hand Mutations ─────────────────────────────────────────

  function addCardToHand(cardId, qty) {
    qty = qty || 1;
    var ok = false;
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.addCardToHand === 'function') {
      var result = GAMESTATE.addCardToHand(cardId, qty);
      ok = !!(result && result.success) || (result === true);
    } else if (typeof NonCombatStateStore !== 'undefined') {
      ok = !!NonCombatStateStore.addCardToHand(cardId, qty);
    }
    if (ok) {
      _syncNonCombatStore();
      _emit('hand:changed', { action: 'add', cardId: cardId, qty: qty, hand: getHand() });
    }
    return ok;
  }

  function consumeFromHand(handIndex, qty) {
    qty = qty || 1;
    // Resolve card ID from index — GAMESTATE.consumeCardFromHand expects cardId, not index
    var hand = getHand();
    if (handIndex < 0 || handIndex >= hand.length) return false;
    var card = hand[handIndex];
    if (!card || !card.id) return false;

    var success = false;
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.consumeCardFromHand === 'function') {
      success = GAMESTATE.consumeCardFromHand(card.id, qty);
    } else if (typeof NonCombatStateStore !== 'undefined') {
      success = NonCombatStateStore.consumeHandIndex(handIndex, qty);
    }
    // GAMESTATE returns { success: true/false } objects — check .success property
    var ok = (success && success.success) || (success === true);
    if (ok) {
      _syncNonCombatStore();
      _emit('hand:changed', { action: 'consume', index: handIndex, qty: qty, hand: getHand() });
    }
    return ok;
  }

  // ── Backup Mutations ───────────────────────────────────────

  function removeBackupCard(backupIndex) {
    var success = false;
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.removeBackupCard === 'function') {
      var result = GAMESTATE.removeBackupCard(backupIndex);
      success = !!(result && result.success);
    } else if (typeof NonCombatStateStore !== 'undefined') {
      success = NonCombatStateStore.consumeBackupIndex(backupIndex);
    }
    if (success) {
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
    var ok = false;
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.moveBackupIndexToHand === 'function') {
      var result = GAMESTATE.moveBackupIndexToHand(backupIndex);
      ok = !!(result && result.success) || (result === true);
    }
    if (ok) {
      _syncNonCombatStore();
      _emit('hand:changed', { action: 'from_backup', index: backupIndex, hand: getHand() });
      _emit('backup:changed', { action: 'to_hand', index: backupIndex, backup: getBackup() });
    }
    return ok;
  }

  /**
   * Cascade a backup card to the TOP of hand (index 0).
   * If hand is full, the last hand card moves to backup top first.
   * GAMESTATE.moveHandIndexToBackup auto-incinerates if backup overflows (25 cap).
   * @param {number} backupIndex - index in backup array
   * @returns {boolean} success
   */
  function cascadeBackupToHandTop(backupIndex) {
    var backup = getBackup();
    if (!backup || backupIndex < 0 || backupIndex >= backup.length) return false;

    var cardRef = backup[backupIndex];
    if (!cardRef || !cardRef.id) return false;

    var hand = getHand();
    var cardId = cardRef.id;
    var qty = cardRef.qty || 1;

    // ── 3D Printer dupe intercept ──────────────────────────────
    // If the printer is armed AND the dragged card is eligible (ammo/battery costs),
    // remove the card from backup, then executeDupe() inserts N individual copies
    // into hand (with overflow cascade). The original card is consumed by the dupe
    // (it becomes one of the N copies).
    if (typeof CostPrinterSystem !== 'undefined' && CostPrinterSystem.isPrinterArmed && CostPrinterSystem.isPrinterArmed()) {
      var cardDef = null;
      if (typeof CardStateAuthority !== 'undefined' && CardStateAuthority.hydrateCard) {
        cardDef = CardStateAuthority.hydrateCard(cardRef);
      } else if (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getCard) {
        cardDef = GoneRogueDataRegistry.getCard(cardId);
      }
      if (cardDef && CostPrinterSystem.executeDupe) {
        var dupeResult = CostPrinterSystem.executeDupe(cardId, cardDef);
        if (dupeResult && dupeResult.consumed) {
          // Remove the original card from backup (dupe already inserted copies)
          removeBackupCard(backupIndex);
          _syncNonCombatStore();
          _emit('hand:changed', { action: 'printer_dupe', cardId: cardId, dupeCount: dupeResult.dupeCount, hand: getHand() });
          _emit('backup:changed', { action: 'printer_dupe', cardId: cardId, backup: getBackup() });
          return true;
        }
      }
      // If dupe didn't fire (card not eligible), fall through to normal cascade
    }

    // ── Normal cascade (non-printer) ───────────────────────────
    // If hand full: cascade last hand card → backup top (with auto-incinerate)
    if (hand.length >= getMaxHandSize()) {
      var lastHandIdx = hand.length - 1;
      // moveHandToBackup uses GAMESTATE.moveHandIndexToBackup which:
      //   - unshifts to backup top
      //   - auto-pops backup bottom if over 25 cap
      //   - fires rogue-card-incinerated event if overflow
      var cascadeOk = moveHandToBackup(lastHandIdx);
      if (!cascadeOk) {
        _emit('transfer:rejected', { reason: 'cascade_failed', from: 'backup', cardId: cardId });
        return false;
      }
      // Re-read backup after cascade — index may have shifted
      backup = getBackup();
      // Find the card in updated backup (index shifted if card was before backupIndex)
      var newIdx = -1;
      for (var i = 0; i < backup.length; i++) {
        if (backup[i] && backup[i].id === cardId) { newIdx = i; break; }
      }
      if (newIdx < 0) {
        // Card no longer found — may have been the one incinerated in cascade
        _emit('transfer:rejected', { reason: 'card_lost_in_cascade', from: 'backup', cardId: cardId });
        return false;
      }
      backupIndex = newIdx;
    }

    // Remove from backup first
    var removed = removeBackupCard(backupIndex);
    if (!removed) {
      _emit('transfer:rejected', { reason: 'backup_remove_failed', from: 'backup', cardId: cardId });
      return false;
    }

    // Insert at hand[0] via GAMESTATE
    var inserted = false;
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.insertCardToHandTop === 'function') {
      var insResult = GAMESTATE.insertCardToHandTop(cardId, qty);
      inserted = !!(insResult && insResult.success);
    }
    if (!inserted) {
      // Fallback: regular add (won't be at top, but card isn't lost)
      inserted = addCardToHand(cardId, qty);
    }

    _syncNonCombatStore();
    _emit('hand:changed', { action: 'cascade_from_backup', cardId: cardId, hand: getHand() });
    _emit('backup:changed', { action: 'cascade_to_hand', cardId: cardId, backup: getBackup() });
    return true;
  }

  /**
   * Move a card from hand to backup deck.
   * @param {number} handIndex - index in hand array
   * @returns {boolean} success
   */
  function moveHandToBackup(handIndex) {
    var ok = false;
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.moveHandIndexToBackup === 'function') {
      var result = GAMESTATE.moveHandIndexToBackup(handIndex);
      ok = !!(result && result.success) || (result === true);
    }
    if (ok) {
      _syncNonCombatStore();
      _emit('hand:changed', { action: 'to_backup', index: handIndex, hand: getHand() });
      _emit('backup:changed', { action: 'from_hand', index: handIndex, backup: getBackup() });
    }
    return ok;
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

    // ── 3D Printer dupe intercept (combat draw) ──────────────
    // If printer is armed and card is eligible, dupe fires on combat draw too.
    // The original draw costs 1 _turnDrawsRemaining. The N-1 extra dupe copies
    // are "drawing more than allotted" — they don't consume additional draws
    // but trigger a 'draw:over_allotted' event for the combat engine.
    if (typeof CostPrinterSystem !== 'undefined' && CostPrinterSystem.isPrinterArmed && CostPrinterSystem.isPrinterArmed()) {
      var _backup = getBackup();
      var _cardRef = _backup[selectedIndex];
      if (_cardRef && _cardRef.id) {
        var _cDef = null;
        if (typeof CardStateAuthority !== 'undefined' && CardStateAuthority.hydrateCard) {
          _cDef = CardStateAuthority.hydrateCard(_cardRef);
        }
        if (_cDef && CostPrinterSystem.executeDupe) {
          var _dupeRes = CostPrinterSystem.executeDupe(_cardRef.id, _cDef);
          if (_dupeRes && _dupeRes.consumed) {
            // Remove the original from backup (dupe inserted copies)
            removeBackupCard(selectedIndex);
            _turnDrawsRemaining--;
            _syncNonCombatStore();
            _emit('draw:executed', {
              index: selectedIndex,
              modifier: modifier,
              mode: mode,
              drawsRemaining: _turnDrawsRemaining,
              hand: getHand(),
              backup: getBackup(),
              printerDupe: true,
              dupeCount: _dupeRes.dupeCount
            });
            // Signal that extra cards were drawn beyond allotment
            if (_dupeRes.dupeCount > 1) {
              _emit('draw:over_allotted', {
                extraCards: _dupeRes.dupeCount - 1,
                cardId: _cardRef.id,
                hand: getHand()
              });
            }
            return true;
          }
        }
      }
      // If dupe didn't fire, fall through to normal draw
    }

    // Execute the draw (normal, non-printer)
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
      if (!backup[i]) continue;
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
      var r1 = GAMESTATE.removePersistentCard(cardId, qty);
      return !!(r1 && r1.success);
    }
    // Fallback: try consumePersistentCard
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.consumePersistentCard === 'function') {
      var r2 = GAMESTATE.consumePersistentCard(cardId, qty);
      return !!(r2 && r2.success);
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

    // GAMESTATE.addPersistentCard returns { success: true/false } — check .success property
    var added = false;
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.addPersistentCard === 'function') {
      var result = GAMESTATE.addPersistentCard(card.id, qty);
      added = !!(result && result.success);
      if (added) {
        // Use clean removal (no burn pile) — card is being transferred, not consumed
        var removed = false;
        if (typeof GAMESTATE.removeCardFromHandByIndex === 'function') {
          var rmResult = GAMESTATE.removeCardFromHandByIndex(handIndex);
          removed = !!(rmResult && rmResult.success);
        } else {
          // Fallback: consumeFromHand (adds to burn pile — not ideal but functional)
          removed = consumeFromHand(handIndex, qty);
        }
        if (!removed) {
          // Card was added to vault but couldn't be removed from hand — revert vault add
          try { GAMESTATE.removePersistentCard(card.id, qty); } catch (rv) {}
          added = false;
        }
      }
    }
    if (added) {
      _syncNonCombatStore();
      try { console.log('[CSA] moveHandToVault OK | cardId:', card.id,
        '| vaultLen:', getVault().length, '| handLen:', getHand().length,
        '| emitting vault:changed + hand:changed'); } catch (lg) {}
      _emit('hand:changed', { action: 'transfer_to_vault', index: handIndex, cardId: card.id, hand: getHand() });
      _emit('vault:changed', { action: 'from_hand', cardId: card.id, vault: getVault() });
    } else {
      try { console.log('[CSA] moveHandToVault FAILED | cardId:', card.id,
        '| isVaultFull:', isVaultFull()); } catch (lg2) {}
    }
    return added;
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

    // GAMESTATE.addPersistentCard returns { success: true/false } — check .success property
    var added = false;
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.addPersistentCard === 'function') {
      var result = GAMESTATE.addPersistentCard(card.id, card.qty || 1);
      added = !!(result && result.success);
      if (added) {
        removeBackupCard(backupIndex);
      }
    }
    if (added) {
      _syncNonCombatStore();
      try { console.log('[CSA] moveBackupToVault OK | cardId:', card.id,
        '| vaultLen:', getVault().length, '| emitting vault:changed'); } catch (lg) {}
      _emit('vault:changed', { action: 'from_backup', cardId: card.id, vault: getVault() });
    } else {
      try { console.log('[CSA] moveBackupToVault FAILED | cardId:', card.id,
        '| isVaultFull:', isVaultFull()); } catch (lg2) {}
    }
    return added;
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

    // Use insertCardToHandTop which does NOT internally consume from vault
    // (addCardToHand internally calls removePersistentCard which double-removes)
    var addedOk = false;
    if (typeof GAMESTATE.insertCardToHandTop === 'function') {
      var addResult = GAMESTATE.insertCardToHandTop(cardId, qty);
      addedOk = !!(addResult && addResult.success);
    } else if (typeof GAMESTATE.addCardToHand === 'function') {
      var addResult2 = GAMESTATE.addCardToHand(cardId, qty);
      addedOk = (addResult2 === undefined) || !!(addResult2 && addResult2.success !== false);
    }

    if (!addedOk) {
      console.warn('[CSA] moveVaultToHand: addCardToHand failed', cardId);
      return false;
    }

    // Now remove from vault — if this fails, rollback hand addition
    var removed = _removeFromVault(cardId, qty);
    if (!removed) {
      console.warn('[CSA] moveVaultToHand: vault removal failed, rolling back hand add', cardId);
      // Rollback: remove the card we just added to hand
      try {
        var rollbackHand = getHand();
        for (var ri = rollbackHand.length - 1; ri >= 0; ri--) {
          if (rollbackHand[ri] && rollbackHand[ri].id === cardId) {
            if (typeof GAMESTATE.removeCardFromHandByIndex === 'function') {
              GAMESTATE.removeCardFromHandByIndex(ri);
            }
            break;
          }
        }
      } catch (rbErr) {}
      return false;
    }

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
        var addResult = GAMESTATE.addPersistentCard(cardId, 1);
        if (!!(addResult && addResult.success)) {
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
      if (!hand[i] || !hand[i].id) continue;
      parts.push('h:' + hand[i].id + ':' + (hand[i].qty || 1));
    }
    for (var j = 0; j < backup.length; j++) {
      if (!backup[j] || !backup[j].id) continue;
      parts.push('b:' + backup[j].id + ':' + (backup[j].qty || 1));
    }
    for (var k = 0; k < vault.length; k++) {
      if (!vault[k] || !vault[k].id) continue;
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

  // ── CHH Step 2: Universal Hydration ─────────────────────
  /**
   * hydrateCard(ref) — Canonical card resolver.
   * Resolution chain:
   *   1. CI-* → GAMESTATE.getCardInstance()  (dynamic rolled cards)
   *   2. Registry ID → GoneRogueDataRegistry.getCard()  (ACT-*, EATK-*, ITM-*)
   *   3. Fallback → ref.meta  (embedded snapshot for backward compat)
   *
   * Every renderer, tooltip, combat system, and UI component should call
   * hydrateCard(ref) instead of ad-hoc lookups.
   *
   * @param {Object|string} ref - CardRef { id, qty?, meta? } or bare string ID
   * @returns {Object|null} Full card data or null
   */
  function hydrateCard(ref) {
    if (!ref) return null;

    // Accept bare string ID as shorthand
    var id = (typeof ref === 'string') ? ref : ref.id;
    if (!id) return null;

    // 1. Dynamic instance (CI-*)
    if (id.indexOf('CI-') === 0) {
      if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getCardInstance === 'function') {
        var inst = GAMESTATE.getCardInstance(id);
        if (inst) return inst;
      }
    }

    // 2. Registry card (ACT-*, EATK-*, ITM-*, etc.)
    if (typeof GoneRogueDataRegistry !== 'undefined' && typeof GoneRogueDataRegistry.getCard === 'function') {
      var reg = GoneRogueDataRegistry.getCard(id);
      if (reg) return reg;
    }

    // 3. Fallback: embedded meta (for backward compat with old save data)
    if (ref.meta && ref.meta.name) return ref.meta;

    return null;
  }

  function getCardDef(cardId) {
    // Delegate to hydrateCard for unified resolution
    return hydrateCard(cardId);
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
      if (!ref || !ref.id) continue;
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

  // ── Cascade Vault→Hand (with overflow) ─────────────────────

  /**
   * Move a vault card into hand, cascading the last hand card to backup
   * if hand is already full. If backup is over cap, its last card is
   * incinerated.
   */
  function cascadeVaultToHandTop(cardId) {
    if (!cardId) return false;
    var hand = getHand();
    if (hand.length >= getMaxHandSize()) {
      var lastHandIdx = hand.length - 1;
      var cascadeOk = moveHandToBackup(lastHandIdx);
      if (!cascadeOk) {
        _emit('transfer:rejected', { reason: 'cascade_failed', from: 'vault', cardId: cardId });
        return false;
      }
    }
    return moveVaultToHand(cardId, 1);
  }

  // ── BLVCK Struggle Card Lifecycle ─────────────────────────
  //
  // ACT-000 "BLVCK" is a zero-cost 1-damage fallback card that appears when
  // the player has no playable cards (empty hand or all cards unaffordable).
  // It ejects the last hand card to backup on insertion (if hand is full)
  // and auto-removes when the player regains resources to play any card.

  var BLVCK_ID = 'ACT-000';

  function _handHasBlvck() {
    var hand = getHand();
    for (var i = 0; i < hand.length; i++) {
      if (hand[i] && hand[i].id === BLVCK_ID) return true;
    }
    return false;
  }

  /**
   * Check if the hand is "stranded" — no affordable/playable cards.
   * Returns true when stranded (empty hand or all cards unaffordable).
   * A hand with only BLVCK doesn't count as having playable cards.
   */
  function _isStranded() {
    var hand = getHand();
    var nonBlvck = [];
    for (var i = 0; i < hand.length; i++) {
      if (hand[i] && hand[i].id !== BLVCK_ID) nonBlvck.push(hand[i]);
    }
    if (nonBlvck.length === 0) return true; // empty or only BLVCK → stranded

    for (var j = 0; j < nonBlvck.length; j++) {
      var def = getCardDef(nonBlvck[j].id);
      if (canAffordCard(def)) return false; // at least one playable → NOT stranded
    }
    return true; // none affordable → stranded
  }

  /**
   * Inject BLVCK into hand. If hand is full, ejects last card to backup
   * (backup ejects its last card to incinerator if over cap).
   */
  function _injectBlvck() {
    if (_handHasBlvck()) return; // already present

    var hand = getHand();
    var maxHand = getMaxHandSize();

    // If hand is full, eject last non-BLVCK card to backup
    if (hand.length >= maxHand) {
      var lastIdx = hand.length - 1;
      moveHandToBackup(lastIdx); // backup overflow auto-incinerates
    }

    // Insert BLVCK at position 0 (hand top)
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.insertCardToHandTop === 'function') {
      GAMESTATE.insertCardToHandTop(BLVCK_ID, 1);
    } else {
      addCardToHand(BLVCK_ID, 1);
    }

    _syncNonCombatStore();
    _emit('hand:changed', { action: 'blvck_inject', cardId: BLVCK_ID, hand: getHand() });

    try {
      if (typeof TooltipSystem !== 'undefined') {
        TooltipSystem.showPersistent('■ STRUGGLE — no playable cards', 1100);
      }
    } catch (e) {}
  }

  /**
   * Remove BLVCK from hand (player regained resources or drew a playable card).
   */
  function _removeBlvck() {
    if (!_handHasBlvck()) return;

    var hand = getHand();
    for (var i = 0; i < hand.length; i++) {
      if (hand[i] && hand[i].id === BLVCK_ID) {
        if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.removeCardFromHandByIndex === 'function') {
          GAMESTATE.removeCardFromHandByIndex(i);
        }
        break;
      }
    }

    _syncNonCombatStore();
    _emit('hand:changed', { action: 'blvck_remove', cardId: BLVCK_ID, hand: getHand() });
  }

  /**
   * Check and update BLVCK state. Call on resource changes, hand changes, etc.
   * - Stranded + no BLVCK → inject
   * - Not stranded + has BLVCK → remove
   * Skips during STR combat (combat has its own BLVCK injection in str-combat-integration).
   */
  function checkBlvckState() {
    var stranded = _isStranded();
    var hasBlvck = _handHasBlvck();

    if (isCombat()) {
      // During STR combat: only REMOVE BLVCK if player is no longer stranded
      // (e.g., drew a playable card). Combat's own display-only fallback handles injection.
      if (!stranded && hasBlvck) {
        _removeBlvck();
      }
      return;
    }

    // Non-combat: full inject/remove lifecycle
    if (stranded && !hasBlvck) {
      _injectBlvck();
    } else if (!stranded && hasBlvck) {
      _removeBlvck();
    }
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
    hydrateCard: hydrateCard,
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
    cascadeBackupToHandTop: cascadeBackupToHandTop,
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

    // Cascade vault→hand (with overflow)
    cascadeVaultToHandTop: cascadeVaultToHandTop,

    // Combat draw (item-aware)
    drawFromBackup: drawFromBackup,
    getTurnDrawsRemaining: getTurnDrawsRemaining,
    resetTurnDraws: resetTurnDraws,
    checkRoundChange: checkRoundChange,
    getLastKnownRound: getLastKnownRound,
    resetCombatDrawState: resetCombatDrawState,

    // BLVCK struggle card lifecycle
    checkBlvckState: checkBlvckState,
    isHandStranded: _isStranded,
    hasBlvck: _handHasBlvck,
    BLVCK_ID: BLVCK_ID
  };

})();
