/* ============================================================
   STR Combat UI Integration
   Connects new STR Combat Window and Hand Fan components
   with existing GoneRogue combat system
   ============================================================ */

(function() {
  'use strict';

  // Wait for all components to be ready
  function initIntegration() {
    if (typeof GoneRogue === 'undefined' ||
        typeof STRCombatWindow === 'undefined' ||
        typeof HandFanComponent === 'undefined') {
      console.log('[STRIntegration] Waiting for components...');
      setTimeout(initIntegration, 100);
      return;
    }

    console.log('[STRIntegration] Initializing STR Combat UI integration');

    // Store original functions
    var _originalEnterCombat = null;
    var _originalShowUI = null;
    var _originalExitCombat = null;

    // Hook into combat state changes
    _hookCombatSystem();
  }

  /**
   * Hook into the existing GoneRogue combat system
   */
  function _hookCombatSystem() {
    // Monitor for STR combat state changes
    setInterval(function() {
      _updateCombatUI();
    }, 100); // Check every 100ms
  }

  /**
   * Update combat UI based on current state
   */
  function _updateCombatUI() {
    if (typeof GoneRogue === 'undefined') return;

    var isActive = GoneRogue.isStrCombatActive && GoneRogue.isStrCombatActive();
    var combatState = GoneRogue.getStrCombatState && GoneRogue.getStrCombatState();

    if (isActive && combatState && combatState.active) {
      _showCombatWindow(combatState);
      _showHandFan(combatState);
      _showBackupActions(combatState);
    } else {
      _hideCombatWindow();
      _hideHandFan();
      _hideBackupActions();
    }
  }

  /**
   * Show STR Combat Window
   * @param {Object} combatState - Current combat state
   */
  function _showCombatWindow(combatState) {
    if (!STRCombatWindow.isVisible()) {
      // Determine enemy type for timer duration
      var enemyType = 'standard';
      if (combatState.enemy) {
        if (combatState.enemy.elite) {
          enemyType = 'elite';
        } else if (combatState.enemy.boss) {
          enemyType = 'boss';
        } else if (combatState.enemy.type === 'rat' || combatState.enemy.type === 'insect') {
          enemyType = 'quick';
        }
      }

      // Build window state
      var windowState = {
        round: combatState.round || 1,
        floor: combatState.floor || 1,
        enemy: {
          emoji: combatState.enemy ? combatState.enemy.emoji : '👾',
          hp: combatState.enemy ? combatState.enemy.hp : 0,
          maxHp: combatState.enemy ? combatState.enemy.maxHp : 5,
          intentState: combatState.enemy ? combatState.enemy.intentState : null
        },
        player: {
          hp: combatState.player ? combatState.player.hp : 10,
          maxHp: combatState.player ? combatState.player.maxHp : 10
        },
        advantage: combatState.advantage || 'neutral',
        enemyType: enemyType,
        countdownMessages: combatState.countdownMessages || null
      };

      STRCombatWindow.show(windowState);
    } else {
      // Update existing window
      var windowState = {
        round: combatState.round || 1,
        floor: combatState.floor || 1,
        enemy: {
          emoji: combatState.enemy ? combatState.enemy.emoji : '👾',
          hp: combatState.enemy ? combatState.enemy.hp : 0,
          maxHp: combatState.enemy ? combatState.enemy.maxHp : 5,
          intentState: combatState.enemy ? combatState.enemy.intentState : null
        },
        player: {
          hp: combatState.player ? combatState.player.hp : 10,
          maxHp: combatState.player ? combatState.player.maxHp : 10
        },
        advantage: combatState.advantage || 'neutral'
      };

      STRCombatWindow.updateState(windowState);
    }
  }

  /**
   * Hide STR Combat Window
   */
  function _hideCombatWindow() {
    if (STRCombatWindow.isVisible()) {
      STRCombatWindow.hide();
    }
  }

  /**
   * Show Hand Fan with cards
   * @param {Object} combatState - Current combat state
   */
  var _lastResolvingTurn = false;
  var _lastHandSig = null;

  function _showHandFan(combatState) {
    // Get canonical hand cards from GAMESTATE (mirrors NCH)
    var cards = [];
    var sigParts = [];
    if (typeof GAMESTATE !== 'undefined') {
      var refs = (typeof GAMESTATE.getCardsInHand === 'function') ? GAMESTATE.getCardsInHand() : [];

      for (var i = 0; i < refs.length; i++) {
        var ref = refs[i];
        if (!ref || !ref.id) continue;
        var qty = (typeof ref.qty === 'number' ? ref.qty : 1);
        qty = Math.max(1, qty);
        sigParts.push(ref.id + 'x' + qty);

        var def = (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getCard) ? GoneRogueDataRegistry.getCard(ref.id) : null;
        if (!def) def = { id: ref.id, name: ref.id, emoji: '🃏', effects: [] };

        // Expand qty into individual UI card entries for now (stable by order)
        for (var q = 0; q < qty; q++) {
          cards.push(Object.assign({}, def, { id: ref.id }));
        }
      }

      // Fallback to legacy loose inventory if canonical hand empty
      if (cards.length === 0 && typeof GAMESTATE.getLooseInventory === 'function') {
        cards = GAMESTATE.getLooseInventory() || [];
        sigParts = ['legacy:' + cards.length];
      }
    }

    var handSig = sigParts.join('|');

    if (cards.length === 0) {
      HandFanComponent.hide();
      return;
    }

    // Check if we're in turn resolution phase
    var isResolvingTurn = combatState.phase === 'resolving' || combatState.isResolvingTurn;

    if (isResolvingTurn) {
      // Minimize hand during turn resolution to show enemy animations
      HandFanComponent.minimize();
    } else {
      // Restore hand when not resolving
      HandFanComponent.restore();
    }

    // Flash mini indicator on resolution edge
    if (typeof HandFanComponent !== 'undefined' && typeof HandFanComponent.flashMiniIndicator === 'function') {
      if (isResolvingTurn && !_lastResolvingTurn && STRCombatWindow && STRCombatWindow.isMinimized && STRCombatWindow.isMinimized()) {
        HandFanComponent.flashMiniIndicator('resolution');
      }
    }
    _lastResolvingTurn = !!isResolvingTurn;

    // If fan isn't visible yet, show it.
    // If visible: only update cards when the hand signature changes (prevents selection jitter).
    if (!HandFanComponent.isVisible()) {
      HandFanComponent.show(cards);
      _lastHandSig = handSig;
    } else {
      if (_lastHandSig !== handSig) {
        HandFanComponent.updateCards(cards);
        _lastHandSig = handSig;
      }
    }

    // Determine fan mode based on STR window state
    var isMini = STRCombatWindow.isMinimized();

    if (isMini) {
      HandFanComponent.setMode('contextual', 'bottom');
    } else {
      // Peripheral hand fan: keeps enemy + combat window readable
      HandFanComponent.setMode('combat', 'peripheral');
    }

    // Update minimized hand-fan indicator (stacked above STR minimized indicator)
    if (typeof HandFanComponent !== 'undefined' && typeof HandFanComponent.updateMiniIndicator === 'function') {
      var emoji = null;
      if (cards && cards.length) {
        emoji = cards[0].emoji || cards[0].glyph || '🃏';
      }

      var pct = null;
      if (typeof STRCombatWindow !== 'undefined' && typeof STRCombatWindow.getTimeRemainingMs === 'function' && typeof STRCombatWindow.getTimerDurationMs === 'function') {
        var dur = STRCombatWindow.getTimerDurationMs();
        var rem = STRCombatWindow.getTimeRemainingMs();
        if (dur > 0) pct = rem / dur;
      }

      HandFanComponent.updateMiniIndicator({
        visible: !!isMini,
        emoji: emoji || '🃏',
        count: (cards && cards.length) ? cards.length : 0,
        timerPercent: pct
      });
    }
  }

  /**
   * Hide Hand Fan
   */
  function _hideHandFan() {
    HandFanComponent.hide();
  }

  function _showBackupActions(combatState) {
    if (typeof BackupActionContainer === 'undefined') return;

    if (!BackupActionContainer.isVisible()) {
      BackupActionContainer.resetForCombat();
      BackupActionContainer.show();
    }

    // Draw 1 backup card per round (v1)
    if (combatState && combatState.round) {
      BackupActionContainer.drawCardForRound(combatState.round);
    }
  }

  function _hideBackupActions() {
    if (typeof BackupActionContainer === 'undefined') return;
    BackupActionContainer.hide();
  }

  /**
   * Handle timer expiration.
   * If the player has cards selected in the hand fan, commit them now.
   * Otherwise pass the turn (enemy attacks unopposed).
   */
  function handleStrTimerExpired() {
    // Play whatever the player has already selected before time ran out
    if (typeof HandFanComponent !== 'undefined' &&
        typeof HandFanComponent.getSelectedCards === 'function' &&
        typeof HandFanComponent.playSelectedCards === 'function') {
      var selected = HandFanComponent.getSelectedCards();
      if (selected.length > 0) {
        console.log('[STRIntegration] Timer expired - committing ' + selected.length + ' selected card(s)');
        HandFanComponent.playSelectedCards();
        return;
      }
    }

    // No cards selected — enemy attacks unopposed
    console.log('[STRIntegration] Timer expired - no selection, passing player turn');
    if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.passPlayerTurn === 'function') {
      GoneRogue.passPlayerTurn();
    }
  }

  /**
   * Handle multi-card combat execution
   */
  function executeMultiCardRound(selectedCards) {
    if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.handleMultiCardCombat === 'function') {
      // Get card indices
      var cardIndices = [];
      var allCards = [];
      if (typeof GAMESTATE !== 'undefined') {
        allCards = GAMESTATE.getLooseInventory() || [];
      }

      selectedCards.forEach(function(card) {
        var index = allCards.indexOf(card);
        if (index !== -1) {
          cardIndices.push(index);
        }
      });

      GoneRogue.handleMultiCardCombat(cardIndices);
    }
  }

  // Expose functions to GoneRogue if they don't exist
  if (typeof GoneRogue !== 'undefined') {
    if (!GoneRogue.handleStrTimerExpired) {
      GoneRogue.handleStrTimerExpired = handleStrTimerExpired;
    }

    if (!GoneRogue.executeMultiCardRound) {
      GoneRogue.executeMultiCardRound = executeMultiCardRound;
    }

    if (!GoneRogue.passPlayerTurn) {
      GoneRogue.passPlayerTurn = function() {
        // Execute only the enemy's attack using the direct passStrTurn method
        if (typeof GoneRogue.passStrTurn === 'function') {
          GoneRogue.passStrTurn();
        }
      };
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIntegration);
  } else {
    initIntegration();
  }
})();
