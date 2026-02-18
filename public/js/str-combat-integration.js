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
    } else {
      _hideCombatWindow();
      _hideHandFan();
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
        enemyType: enemyType
      };

      STRCombatWindow.show(windowState);
    } else {
      // Update existing window
      var windowState = {
        round: combatState.round || 1,
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
  function _showHandFan(combatState) {
    // Get cards from GAMESTATE
    var cards = [];
    if (typeof GAMESTATE !== 'undefined') {
      cards = GAMESTATE.getLooseInventory() || [];
    }

    if (cards.length === 0) {
      HandFanComponent.hide();
      return;
    }

    // Determine fan mode based on STR window state
    if (STRCombatWindow.isMinimized()) {
      HandFanComponent.setMode('contextual', 'bottom');
    } else {
      HandFanComponent.setMode('combat', 'centered');
    }

    HandFanComponent.updateCards(cards);
  }

  /**
   * Hide Hand Fan
   */
  function _hideHandFan() {
    HandFanComponent.hide();
  }

  /**
   * Handle timer expiration (add to GoneRogue if not exists)
   */
  function handleStrTimerExpired() {
    console.log('[STRIntegration] Combat timer expired - auto-playing default action');

    // Get default card (first defense or attack card)
    var cards = [];
    if (typeof GAMESTATE !== 'undefined') {
      cards = GAMESTATE.getLooseInventory() || [];
    }

    var defaultCard = null;
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      if (card.category === 'defense' || card.category === 'attack') {
        defaultCard = card;
        break;
      }
    }

    if (defaultCard && typeof GoneRogue !== 'undefined') {
      // Execute with default card
      if (typeof GoneRogue.handleCardSwipe === 'function') {
        GoneRogue.handleCardSwipe(0, 'up'); // Use first card
      }
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
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIntegration);
  } else {
    initIntegration();
  }
})();
