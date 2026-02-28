/**
 * EnemyCardInteractionHandler — Phase 4 of ENEMY_CARDS.md
 *
 * Orchestrates in-combat interactions on enemy joker cards:
 *   1. Listens for 'enemy-card:interact' events from EnemyHandDisplay
 *   2. Shows a context menu with available actions (Reveal/Steal/Destroy)
 *   3. Dispatches chosen action to EnemyHandDisplay + downstream APIs
 *   4. Runs the interactability compute loop each combat round
 *
 * Dependencies:
 *   - NonCombatEventBus (event system)
 *   - EnemyHandDisplay (card display + revealCard/stealCard/destroyCard)
 *   - EnemyCardInteractability (compute available actions)
 *   - GAMESTATE (acquireNewCardDuringCombat, getActiveItem)
 *   - EnemyIntentSystem (onCombatEvent for card_killed)
 *   - GoneRogueDataRegistry (card definitions)
 *   - PassiveItemsSystem (passive item effects)
 */
var EnemyCardInteractionHandler = (function() {
  'use strict';

  // ── State ─────────────────────────────────────────────────
  var _menuEl = null;
  var _menuVisible = false;
  var _currentInteraction = null; // { index, canReveal, canSteal, canDestroy }
  var _lastComputeSig = '';
  var _initialized = false;
  var _playedCardsThisTurn = []; // Tracks cards played during current combat round

  // ── Init ──────────────────────────────────────────────────

  function init() {
    if (_initialized) return;
    _initialized = true;

    _createMenuElement();
    _bindEvents();

    console.log('[EnemyCardInteractionHandler] Phase 4 initialized');
  }

  // ── Menu DOM ──────────────────────────────────────────────

  function _createMenuElement() {
    if (_menuEl) return;

    _menuEl = document.createElement('div');
    _menuEl.id = 'enemy-card-context-menu';
    _menuEl.className = 'enemy-card-context-menu';
    _menuEl.style.display = 'none';
    document.body.appendChild(_menuEl);

    // Click outside → close
    document.addEventListener('click', function(e) {
      if (_menuVisible && _menuEl && !_menuEl.contains(e.target)) {
        _hideMenu();
      }
    });
  }

  /**
   * Show interaction menu at the clicked card's position.
   * @param {Object} interaction - { index, canReveal, canSteal, canDestroy, primaryAction }
   * @param {Element} [anchorEl] - Optional DOM element to position near
   */
  function _showMenu(interaction, anchorEl) {
    if (!_menuEl) _createMenuElement();

    _currentInteraction = interaction;
    _menuEl.innerHTML = '';

    // ── Header ──
    var header = document.createElement('div');
    header.className = 'ecm-header';
    header.textContent = '🃏 ENEMY CARD #' + (interaction.index + 1);
    _menuEl.appendChild(header);

    var divider = document.createElement('div');
    divider.className = 'ecm-divider';
    _menuEl.appendChild(divider);

    // ── Action buttons ──
    var actions = [];
    if (interaction.canReveal)  actions.push({ key: 'reveal',  emoji: '👁️',  label: 'REVEAL',  sub: _getActionSource('reveal') });
    if (interaction.canSteal)   actions.push({ key: 'steal',   emoji: '🤏', label: 'STEAL',   sub: _getActionSource('steal') });
    if (interaction.canDestroy) actions.push({ key: 'destroy', emoji: '💥', label: 'DESTROY', sub: _getActionSource('destroy') });

    if (actions.length === 0) {
      // Shouldn't happen (interactable cards always have at least one action)
      _hideMenu();
      return;
    }

    for (var i = 0; i < actions.length; i++) {
      var act = actions[i];
      var btn = document.createElement('button');
      btn.className = 'ecm-action ecm-action-' + act.key;
      btn.dataset.action = act.key;
      btn.innerHTML =
        '<span class="ecm-action-emoji">' + act.emoji + '</span>' +
        '<span class="ecm-action-label">' + act.label + '</span>' +
        '<span class="ecm-action-sub">' + act.sub + '</span>';

      (function(actionKey) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          _executeAction(actionKey);
        });
      })(act.key);

      _menuEl.appendChild(btn);
    }

    // ── Position near anchor ──
    _menuEl.style.display = 'block';
    _menuVisible = true;

    if (anchorEl) {
      var rect = anchorEl.getBoundingClientRect();
      var menuW = _menuEl.offsetWidth || 180;
      var menuH = _menuEl.offsetHeight || 100;
      var left = rect.left + rect.width / 2 - menuW / 2;
      var top = rect.top - menuH - 8;

      // Keep in viewport
      if (left < 4) left = 4;
      if (left + menuW > window.innerWidth - 4) left = window.innerWidth - menuW - 4;
      if (top < 4) top = rect.bottom + 8; // Flip below if no room above

      _menuEl.style.left = left + 'px';
      _menuEl.style.top = top + 'px';
    } else {
      // Center fallback
      _menuEl.style.left = '50%';
      _menuEl.style.top = '40%';
      _menuEl.style.transform = 'translate(-50%, -50%)';
    }
  }

  function _hideMenu() {
    if (_menuEl) {
      _menuEl.style.display = 'none';
      _menuEl.style.transform = '';
    }
    _menuVisible = false;
    _currentInteraction = null;
  }

  /**
   * Get the source label for an action (what item/card enables it).
   */
  function _getActionSource(actionKey) {
    try {
      var equipped = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getActiveItem) ? GAMESTATE.getActiveItem() : null;
      if (!equipped) return '';

      if (actionKey === 'reveal') {
        if (Array.isArray(equipped.revealTags) && equipped.revealTags.length > 0) {
          return '(' + (equipped.name || 'Equipped') + ')';
        }
        return '(Scout)';
      }
      if (actionKey === 'steal') {
        if (Array.isArray(equipped.stealTags) && equipped.stealTags.length > 0) {
          return '(' + (equipped.name || 'Gloves') + ')';
        }
        return '(Gloves)';
      }
      if (actionKey === 'destroy') {
        // Check if Sabotage card was played
        for (var i = 0; i < _playedCardsThisTurn.length; i++) {
          var tags = _playedCardsThisTurn[i].synergyTags || [];
          if (tags.indexOf('sabotage') !== -1) return '(Sabotage)';
        }
        if (Array.isArray(equipped.destroyTags) && equipped.destroyTags.length > 0) {
          return '(' + (equipped.name || 'EMP') + ')';
        }
        return '(EMP)';
      }
    } catch (e) {}
    return '';
  }

  // ── Action Execution ──────────────────────────────────────

  function _executeAction(actionKey) {
    if (!_currentInteraction) return;
    var index = _currentInteraction.index;

    console.log('[EnemyCardInteractionHandler] Executing: ' + actionKey + ' on card #' + index);

    switch (actionKey) {
      case 'reveal':
        _doReveal(index);
        break;
      case 'steal':
        _doSteal(index);
        break;
      case 'destroy':
        _doDestroy(index);
        break;
    }

    _hideMenu();
  }

  /**
   * Reveal: flip card face-up so player sees what enemy will attack with.
   */
  function _doReveal(index) {
    if (typeof EnemyHandDisplay === 'undefined') return;

    var cards = EnemyHandDisplay.getEnemyCards();
    if (index < 0 || index >= cards.length) return;

    var card = cards[index];
    var cardDef = card._def || null;

    // Try to resolve from registry if not cached
    if (!cardDef && card.cardId) {
      try {
        if (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getEnemyCard) {
          cardDef = GoneRogueDataRegistry.getEnemyCard(card.cardId);
          if (cardDef && cardDef._missing) cardDef = null;
        }
      } catch (e) {}
    }

    var cardInfo = {
      emoji: (cardDef && cardDef.emoji) ? cardDef.emoji : '❓',
      name: (cardDef && cardDef.name) ? cardDef.name : 'Enemy Card'
    };

    EnemyHandDisplay.revealCard(index, cardInfo);

    // Toast feedback
    _showToast('👁️ Revealed: ' + cardInfo.emoji + ' ' + cardInfo.name);
  }

  /**
   * Steal: remove card from enemy, add to player hand.
   * → stealCard() → GAMESTATE.acquireNewCardDuringCombat()
   */
  function _doSteal(index) {
    if (typeof EnemyHandDisplay === 'undefined') return;

    var stolenCard = EnemyHandDisplay.stealCard(index);
    if (!stolenCard) {
      _showToast('🤏 Steal failed — card unavailable');
      return;
    }

    // Add stolen card to player hand
    var cardId = stolenCard.cardId;
    if (cardId && typeof GAMESTATE !== 'undefined' && GAMESTATE.acquireNewCardDuringCombat) {
      GAMESTATE.acquireNewCardDuringCombat(cardId, 1);
    }

    // Decrement enemy cardCount on the live combat enemy object
    _decrementEnemyCardCount();

    // Resolve name for toast
    var cardName = stolenCard.name || 'Enemy Card';
    if (stolenCard._def && stolenCard._def.name) cardName = stolenCard._def.name;

    _showToast('🤏 Stolen: ' + (stolenCard.emoji || '🃏') + ' ' + cardName);

    // Re-compute interactability after state change
    _computeInteractability();
  }

  /**
   * Destroy: remove card from enemy, trigger card_killed event.
   * → destroyCard() → EnemyIntentSystem.onCombatEvent(enemy, 'card_killed')
   */
  function _doDestroy(index) {
    if (typeof EnemyHandDisplay === 'undefined') return;

    EnemyHandDisplay.destroyCard(index);

    // Decrement enemy cardCount
    _decrementEnemyCardCount();

    // Trigger card_killed on the enemy (face goes >:( enraged)
    _triggerCardKilled();

    _showToast('💥 Destroyed enemy card — enemy is ENRAGED');

    // Re-compute interactability after state change
    _computeInteractability();
  }

  /**
   * Decrement cardCount on the live combat enemy.
   */
  function _decrementEnemyCardCount() {
    try {
      if (typeof GoneRogue !== 'undefined' && GoneRogue.getStrCombatState) {
        var state = GoneRogue.getStrCombatState();
        if (state && state.enemy && typeof state.enemy.cardCount === 'number') {
          state.enemy.cardCount = Math.max(0, state.enemy.cardCount - 1);
        }
      }
    } catch (e) {}
  }

  /**
   * Trigger card_killed combat event on the enemy.
   */
  function _triggerCardKilled() {
    try {
      if (typeof GoneRogue !== 'undefined' && GoneRogue.getStrCombatState) {
        var state = GoneRogue.getStrCombatState();
        var enemy = state ? state.enemy : null;

        if (enemy && typeof EnemyIntentSystem !== 'undefined' && EnemyIntentSystem.onCombatEvent) {
          var newExpression = EnemyIntentSystem.onCombatEvent(enemy, 'card_killed', {});
          if (newExpression && enemy.intentState) {
            enemy.intentState.expression = newExpression;
          }
        }
      }
    } catch (e) {
      console.warn('[EnemyCardInteractionHandler] card_killed event error:', e);
    }
  }

  // ── Interactability Compute Loop ──────────────────────────

  /**
   * Build player state for interactability computation.
   * Reads equipped item, passive items, and cards played this turn.
   */
  function _buildPlayerState(combatState) {
    var equipped = {};
    var passiveItems = [];
    var exposedTags = [];

    // Active equipped item
    try {
      if (typeof GAMESTATE !== 'undefined' && GAMESTATE.getActiveItem) {
        var active = GAMESTATE.getActiveItem();
        if (active) {
          equipped = active;
        }
      }
    } catch (e) {}

    // Passive items
    try {
      if (typeof PassiveItemsSystem !== 'undefined' && PassiveItemsSystem.getEquippedItems) {
        passiveItems = PassiveItemsSystem.getEquippedItems() || [];
      }
    } catch (e) {}

    // Exposed tags from enemy deck definition
    try {
      if (combatState && combatState.enemy) {
        exposedTags = Array.isArray(combatState.enemy.exposedTags) ? combatState.enemy.exposedTags : [];
      }
    } catch (e) {}

    return {
      equippedItem: equipped,
      playedThisTurn: _playedCardsThisTurn,
      passiveItems: passiveItems,
      exposedTags: exposedTags
    };
  }

  /**
   * Compute and push interactability state to EnemyHandDisplay.
   * Called each combat round and after steal/destroy actions.
   */
  function _computeInteractability(combatState) {
    if (typeof EnemyHandDisplay === 'undefined' || typeof EnemyCardInteractability === 'undefined') return;
    if (!EnemyHandDisplay.isVisible()) return;

    // Get combat state if not provided
    if (!combatState) {
      try {
        if (typeof GoneRogue !== 'undefined' && GoneRogue.getStrCombatState) {
          combatState = GoneRogue.getStrCombatState();
        }
      } catch (e) {}
    }
    if (!combatState || !combatState.active) return;

    var enemyCards = EnemyHandDisplay.getEnemyCards();
    var playerState = _buildPlayerState(combatState);
    var interactArr = EnemyCardInteractability.compute(enemyCards, playerState);

    // Signature to avoid redundant updates
    var sig = interactArr.map(function(ia) {
      return ia.index + ':' + (ia.primaryAction || 'n');
    }).join('|');

    if (sig !== _lastComputeSig) {
      _lastComputeSig = sig;
      EnemyHandDisplay.setInteractability(interactArr);
    }
  }

  /**
   * Run auto-reveal at combat start.
   * Called once when combat first opens.
   */
  function _runAutoReveal(combatState) {
    if (typeof EnemyHandDisplay === 'undefined' || typeof EnemyCardInteractability === 'undefined') return;

    var enemyCards = EnemyHandDisplay.getEnemyCards();
    var playerState = _buildPlayerState(combatState);
    var toReveal = EnemyCardInteractability.autoReveal(enemyCards, playerState);

    for (var i = 0; i < toReveal.length; i++) {
      var idx = toReveal[i];
      var card = enemyCards[idx];
      if (!card) continue;

      var cardDef = card._def || null;
      if (!cardDef && card.cardId) {
        try {
          if (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getEnemyCard) {
            cardDef = GoneRogueDataRegistry.getEnemyCard(card.cardId);
          }
        } catch (e) {}
      }

      EnemyHandDisplay.revealCard(idx, {
        emoji: (cardDef && cardDef.emoji) ? cardDef.emoji : '❓',
        name: (cardDef && cardDef.name) ? cardDef.name : 'Enemy Card'
      });
    }

    if (toReveal.length > 0) {
      _showToast('🎧 Wire Tap: ' + toReveal.length + ' card(s) intercepted');
    }
  }

  // ── Event Binding ─────────────────────────────────────────

  function _bindEvents() {
    if (typeof NonCombatEventBus === 'undefined') {
      console.warn('[EnemyCardInteractionHandler] NonCombatEventBus not found — deferring');
      setTimeout(function() { _bindEvents(); }, 200);
      return;
    }

    // ── Click on interactable enemy card → show context menu ──
    NonCombatEventBus.on('enemy-card:interact', function(data) {
      if (!data) return;

      // Find the clicked DOM element for positioning
      var anchorEl = null;
      try {
        var container = document.getElementById('enemy-hand-display');
        if (container) {
          var slots = container.querySelectorAll('.enemy-card-slot');
          if (slots[data.index]) anchorEl = slots[data.index];
        }
      } catch (e) {}

      // If only one action available, execute immediately (no menu needed)
      var availableActions = 0;
      if (data.canReveal) availableActions++;
      if (data.canSteal) availableActions++;
      if (data.canDestroy) availableActions++;

      if (availableActions === 1 && data.primaryAction) {
        // Single action → direct execute
        _currentInteraction = data;
        _executeAction(data.primaryAction);
        return;
      }

      // Multiple actions → show menu
      _showMenu(data, anchorEl);
    });

    // ── Track cards played this turn for Sabotage detection ──
    NonCombatEventBus.on('card:played', function(data) {
      if (data && data.card) {
        _playedCardsThisTurn.push(data.card);
        // Re-compute after card play (Sabotage may enable destroy)
        _computeInteractability();
      }
    });

    // ── Reset played cards on new round ──
    NonCombatEventBus.on('combat:round-start', function() {
      _playedCardsThisTurn = [];
      _lastComputeSig = '';
    });

    // ── After steal/destroy, re-compute for remaining cards ──
    NonCombatEventBus.on('enemy-card:stolen', function() {
      _computeInteractability();
    });

    NonCombatEventBus.on('enemy-card:destroyed', function() {
      _computeInteractability();
    });
  }

  // ── Toast Feedback ────────────────────────────────────────

  function _showToast(message) {
    try {
      if (typeof TooltipSystem !== 'undefined' && TooltipSystem.showPersistent) {
        TooltipSystem.showPersistent(message, 1500);
        return;
      }
    } catch (e) {}

    // Fallback: create a simple toast
    var toast = document.createElement('div');
    toast.className = 'enemy-card-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(function() {
      toast.classList.add('ecm-toast-visible');
    });

    // Remove after delay
    setTimeout(function() {
      toast.classList.remove('ecm-toast-visible');
      setTimeout(function() {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 1500);
  }

  // ── Public API ────────────────────────────────────────────

  return {
    init: init,

    /**
     * Compute and push interactability state. Call each combat round.
     * @param {Object} combatState - From GoneRogue.getStrCombatState()
     */
    computeInteractability: function(combatState) {
      _computeInteractability(combatState);
    },

    /**
     * Run auto-reveal at combat start. Call once per encounter.
     * @param {Object} combatState
     */
    runAutoReveal: function(combatState) {
      _runAutoReveal(combatState);
    },

    /**
     * Track a card that was played this turn (for Sabotage detection).
     * @param {Object} cardDef - Card definition with synergyTags
     */
    trackCardPlayed: function(cardDef) {
      if (cardDef) {
        _playedCardsThisTurn.push(cardDef);
        _computeInteractability();
      }
    },

    /**
     * Reset turn-tracking state (call on new round).
     */
    resetTurn: function() {
      _playedCardsThisTurn = [];
      _lastComputeSig = '';
    },

    /**
     * Check if context menu is currently visible.
     */
    isMenuVisible: function() {
      return _menuVisible;
    },

    /**
     * Force close the context menu.
     */
    closeMenu: function() {
      _hideMenu();
    }
  };

})();

// Auto-init when DOM ready
(function() {
  function _autoInit() {
    if (typeof NonCombatEventBus !== 'undefined' &&
        typeof EnemyHandDisplay !== 'undefined' &&
        typeof EnemyCardInteractability !== 'undefined') {
      EnemyCardInteractionHandler.init();
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
