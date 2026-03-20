/* ============================================================
   EYES ONLY - Card Disposal System
   Drag-to-debrief mechanics for destroying unwanted cards
   ============================================================ */

const CardDisposalSystem = (function() {
  'use strict';

  // Configuration
  var DISPOSAL_CONFIG = {
    validCardTypes: ['disposable', 'consumable'],  // Can destroy
    invalidCardTypes: ['exhaust', 'power', 'persistent', 'gated'],  // Cannot destroy
    animationDuration: 400,
    feedbackOnInvalid: 'shake'
  };

  // State
  var _isDragOverDebrief = false;
  var _draggedCard = null;  // {element, card, index}
  var _dragPreviewElement = null;
  var _debriefFeedElement = null;

  /**
   * Initialize the disposal system
   */
  function init() {
    _debriefFeedElement = document.getElementById('debrief-screen');
    if (!_debriefFeedElement) {
      console.warn('[CardDisposalSystem] Debrief screen not found');
      return;
    }

    _setupDebriefDropZone();
  }

  /**
   * Set up debrief feed as drop zone
   */
  function _setupDebriefDropZone() {
    // Prevent default drag behaviors
    _debriefFeedElement.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      if (_draggedCard) {
        _handleDragOverDebrief(true);
      }
    });

    _debriefFeedElement.addEventListener('dragleave', function(e) {
      // Only trigger if leaving the debrief element itself
      if (e.target === _debriefFeedElement) {
        _handleDragOverDebrief(false);
      }
    });

    _debriefFeedElement.addEventListener('drop', function(e) {
      e.preventDefault();
      _handleDropOnDebrief();
    });
  }

  /**
   * Handle drag start from card or inventory item
   * @param {HTMLElement} element - Card or item DOM element
   * @param {Object} data - Card or item data
   * @param {number} index - Index in hand or inventory
   * @param {string} source - 'hand' or 'inventory'
   */
  // BLVCK card ID — struggle card that cannot be moved/discarded
  var _BLVCK_ID = (typeof CardStateAuthority !== 'undefined' && CardStateAuthority.BLVCK_ID)
    ? CardStateAuthority.BLVCK_ID : 'ACT-000';

  function _isBlvckCard(data) {
    if (!data) return false;
    return data.id === _BLVCK_ID || data.id === 'ACT-000' || data.name === 'BLVCK';
  }

  function handleDragStart(element, data, index, source) {
    source = source || 'hand';  // Default to hand for backward compatibility

    // ── BLVCK GUARD: struggle card cannot be dragged ──
    if (_isBlvckCard(data)) {
      console.log('[CardDisposalSystem] BLVCK card cannot be dragged');
      if (typeof TooltipSystem !== 'undefined') {
        TooltipSystem.showPersistent('🃏 BLVCK cannot be discarded', 1000);
      }
      return; // Block drag entirely
    }

    _draggedCard = {
      element: element,
      card: data,  // Can be card or item
      index: index,
      source: source  // Track where it came from
    };

    // Set drag data
    var event = window.event;
    if (event && event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/html', element.innerHTML);
    }

    // Add dragging class
    element.classList.add('card-dragging');

    console.log('[CardDisposalSystem] Drag started from ' + source + ':', data.name);
  }

  /**
   * Handle drag end
   */
  function handleDragEnd() {
    if (_draggedCard && _draggedCard.element) {
      _draggedCard.element.classList.remove('card-dragging');
    }

    _handleDragOverDebrief(false);
    _draggedCard = null;
  }

  /**
   * Handle drag over debrief feed
   * @param {boolean} isOver - Whether drag is over debrief
   */
  function _isStrCombatActive() {
    return (typeof GoneRogue !== 'undefined' && typeof GoneRogue.isStrCombatActive === 'function' && GoneRogue.isStrCombatActive());
  }

  function _isSelfCastCard(card) {
    if (!card || !card.stats) return false;
    return !!(
      card.stats.hp ||
      card.stats.energyBoost ||
      card.stats.fatigueReduction ||
      card.stats.batteryRecharge ||
      card.stats.focusBoost ||
      card.stats.ammoRestore
    );
  }

  function _applySelfCast(card) {
    if (!card || !card.stats) return { ok: false, msg: 'No effect' };

    // Apply effects similar to GoneRogue utility cards
    var effects = [];

    if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.getPlayer === 'function') {
      var p = GoneRogue.getPlayer();
      if (p && card.stats.hp) {
        p.hp = Math.min(p.maxHp || p.hp, p.hp + card.stats.hp);
        effects.push('HP +' + card.stats.hp);
      }
    }

    if (typeof GAMESTATE !== 'undefined') {
      if (card.stats.energyBoost && GAMESTATE.addEnergy) {
        GAMESTATE.addEnergy(card.stats.energyBoost);
        effects.push('ENERGY +' + card.stats.energyBoost);
      }
      if (card.stats.fatigueReduction && GAMESTATE.reduceFatigue) {
        GAMESTATE.reduceFatigue(card.stats.fatigueReduction);
        effects.push('FATIGUE -' + card.stats.fatigueReduction);
      }
      if (card.stats.batteryRecharge && GAMESTATE.rechargeBattery) {
        GAMESTATE.rechargeBattery(card.stats.batteryRecharge);
        effects.push('BATTERY +' + card.stats.batteryRecharge);
      }
      if (card.stats.focusBoost && GAMESTATE.addFocus) {
        GAMESTATE.addFocus(card.stats.focusBoost);
        effects.push('FOCUS +' + card.stats.focusBoost);
      }
      if (card.stats.ammoRestore && GAMESTATE.addAmmo) {
        GAMESTATE.addAmmo(card.stats.ammoRestore);
        effects.push('AMMO +' + card.stats.ammoRestore);
      }
    }

    return { ok: effects.length > 0, msg: effects.join(', ') };
  }

  function _handleDragOverDebrief(isOver) {
    _isDragOverDebrief = isOver;

    // Clear prior classes
    _debriefFeedElement.classList.remove('debrief-drop-target', 'debrief-drop-target-self', 'debrief-drop-target-invalid');

    // Active drag data can come from HTML5 drag (_draggedCard) or touch drag (_touchState)
    var _activeDrag = _draggedCard || (_touchState ? { card: _touchState.data, source: _touchState.source } : null);

    if (isOver && _activeDrag) {
      // In STR combat: debrief is a disposal zone (discard to backup)
      // Self-cast cards get the self-target glow, everything else gets disposal glow
      if (_isStrCombatActive()) {
        if (_isSelfCastCard(_activeDrag.card)) {
          _debriefFeedElement.classList.add('debrief-drop-target-self');
          if (typeof TooltipSystem !== 'undefined') {
            TooltipSystem.showPersistent('🧑 SELF TARGET: drop to apply', 650);
          }
        } else {
          // Allow disposal in combat — send card to backup deck
          _updateDragPreviewToRecycling();
          _debriefFeedElement.classList.add('debrief-drop-target');
          if (typeof TooltipSystem !== 'undefined') {
            TooltipSystem.showPersistent('♻️ DISCARD to backup deck', 650);
          }
        }
        return;
      }

      // Non-combat: disposal behavior
      _updateDragPreviewToRecycling();
      _debriefFeedElement.classList.add('debrief-drop-target');
    } else {
      _restoreDragPreview();
    }
  }

  /**
   * Update drag preview to show recycling emoji
   */
  function _updateDragPreviewToRecycling() {
    if (_draggedCard && _draggedCard.element) {
      _draggedCard.element.classList.add('drag-preview-recycling');
    }
  }

  /**
   * Restore normal drag preview
   */
  function _restoreDragPreview() {
    if (_draggedCard && _draggedCard.element) {
      _draggedCard.element.classList.remove('drag-preview-recycling');
    }
  }

  /**
   * Handle drop on debrief feed
   */
  function _handleDropOnDebrief() {
    if (!_draggedCard) {
      console.warn('[CardDisposalSystem] No card being dragged');
      return;
    }

    var data = _draggedCard.card;
    var element = _draggedCard.element;
    var source = _draggedCard.source || 'hand';

    // ── BLVCK GUARD (belt-and-suspenders): block disposal even if drag somehow started ──
    if (_isBlvckCard(data)) {
      console.log('[CardDisposalSystem] BLVCK card cannot be discarded');
      if (typeof TooltipSystem !== 'undefined') {
        TooltipSystem.showPersistent('🃏 BLVCK cannot be discarded', 1000);
      }
      _draggedCard = null;
      _handleDragOverDebrief(false);
      return;
    }

    // STR combat: debrief drop is SELF target or DISPOSAL (send to backup)
    if (_isStrCombatActive()) {
      if (_isSelfCastCard(data) && source === 'hand') {
        var result = _applySelfCast(data);

        if (result.ok) {
          // Consume card from hand
          if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getLooseInventory === 'function') {
            var loose = GAMESTATE.getLooseInventory();
            if (Array.isArray(loose) && loose[_draggedCard.index]) {
              loose.splice(_draggedCard.index, 1);
              if (typeof HandFanComponent !== 'undefined' && typeof HandFanComponent.updateCards === 'function') {
                HandFanComponent.updateCards(loose);
              }
            }
          }

          // Flash incinerator style on debrief (feedback only)
          _triggerIncineratorAnimation();

          if (typeof TooltipSystem !== 'undefined') {
            TooltipSystem.showPersistent('✅ SELF: ' + result.msg, 1400);
          }
        } else {
          _handleInvalidDisposal(data, element, 'self_target_invalid');
        }

        _draggedCard = null;
        _handleDragOverDebrief(false);
        return;
      }

      // Non-self-cast card in STR combat: discard to backup deck
      if (source === 'hand') {
        var discardIdx = _draggedCard.index;
        var discardOk = false;

        if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.moveHandIndexToBackup === 'function') {
          var moveResult = GAMESTATE.moveHandIndexToBackup(discardIdx);
          discardOk = moveResult && moveResult.success;
        }

        if (discardOk) {
          // Refresh hand fan display
          if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getCardsInHand === 'function') {
            var updatedHand = GAMESTATE.getCardsInHand();
            // Hydrate for display
            var hydratedHand = [];
            for (var hi = 0; hi < updatedHand.length; hi++) {
              var hRef = updatedHand[hi];
              var hCard = null;
              try {
                if (typeof hydrateCard === 'function') {
                  hCard = hydrateCard(hRef);
                } else if (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getCard) {
                  hCard = GoneRogueDataRegistry.getCard(hRef.id);
                }
              } catch (eH) {}
              hydratedHand.push(hCard || hRef);
            }
            if (typeof HandFanComponent !== 'undefined' && typeof HandFanComponent.updateCards === 'function') {
              HandFanComponent.updateCards(hydratedHand);
            }
          }

          _triggerIncineratorAnimation();

          if (typeof TooltipSystem !== 'undefined') {
            TooltipSystem.showPersistent('♻️ Discarded to backup: ' + (data.name || data.id), 1400);
          }

          // Report to debrief feed
          if (typeof DebriefFeedController !== 'undefined' && typeof DebriefFeedController.reportEvent === 'function') {
            DebriefFeedController.reportEvent('CARD_DISCARDED', { cardName: data.name || data.id });
          }
        } else {
          _handleInvalidDisposal(data, element, 'discard_failed');
        }

        _draggedCard = null;
        _handleDragOverDebrief(false);
        return;
      }

      _handleInvalidDisposal(data, element, 'self_target_invalid');
      _draggedCard = null;
      _handleDragOverDebrief(false);
      return;
    }

    // Non-combat: disposal rules
    var lifecycle = _getCardLifecycle(data);
    var isDisposable = DISPOSAL_CONFIG.validCardTypes.indexOf(lifecycle) !== -1;

    if (!isDisposable) {
      _handleInvalidDisposal(data, element, lifecycle);
      _draggedCard = null;
      _handleDragOverDebrief(false);
      return;
    }

    // Valid disposal - destroy card or item
    _destroyCard(_draggedCard.card, _draggedCard.index, 'manual_disposal', source);
    _draggedCard = null;
    _handleDragOverDebrief(false);
  }

  /**
   * Get card lifecycle type
   * @param {Object} card - Card data
   * @returns {string} Lifecycle type
   */
  function _getCardLifecycle(card) {
    return card.lifecycleType || card.lifecycle || 'persistent';
  }

  /**
   * Handle invalid disposal attempt
   * @param {Object} card - Card data
   * @param {HTMLElement} cardElement - Card DOM element
   * @param {string} lifecycle - Card lifecycle type
   */
  function _handleInvalidDisposal(card, cardElement, lifecycle) {
    console.log('[CardDisposalSystem] Invalid disposal:', lifecycle, 'cannot be destroyed');

    // Shake animation
    if (cardElement) {
      cardElement.classList.add('card-shake');
      setTimeout(function() {
        cardElement.classList.remove('card-shake');
      }, DISPOSAL_CONFIG.animationDuration);
    }

    // MOK interjection
    if (typeof UIControls !== 'undefined' && UIControls.updateMokInterjection) {
      UIControls.updateMokInterjection('Cannot destroy ' + lifecycle + ' item: ' + card.name);
    }
  }

  /**
   * Destroy card or item and trigger animation
   * @param {Object} data - Card or item data
   * @param {number} index - Index
   * @param {string} reason - Destruction reason
   * @param {string} source - 'hand' or 'inventory'
   */
  function _destroyCard(data, index, reason, source) {
    source = source || 'hand';
    console.log('[CardDisposalSystem] Destroying from ' + source + ':', data.name, 'reason:', reason);

    // Trigger incinerator animation
    _triggerIncineratorAnimation();

    if (source === 'hand') {
      // Remove from hand via HandFanComponent
      if (typeof HandFanComponent !== 'undefined') {
        // Get current cards
        var currentCards = HandFanComponent._cards || [];

        // Remove the card
        currentCards.splice(index, 1);

        // Update hand display
        HandFanComponent.updateCards(currentCards);
      }

      // Remove from GAMESTATE hand if available
      if (typeof GAMESTATE !== 'undefined' && GAMESTATE.getCardHand) {
        var hand = GAMESTATE.getCardHand();
        if (hand && hand[index]) {
          hand.splice(index, 1);
        }
      }
    } else if (source === 'inventory') {
      // Check if this is an AccountInventory platform item
      if (data._accountItem && data.id && typeof AccountInventory !== 'undefined') {
        // Remove from AccountInventory (permanently destroys — no respawn)
        AccountInventory.removeItem(data.id);
        console.log('[CardDisposalSystem] Destroyed account item:', data.id, data.name);
      } else {
        // Remove from GAMESTATE persistent inventory
        if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.removePersistentInventoryItem === 'function') {
          GAMESTATE.removePersistentInventoryItem(index);
        } else {
          console.error('[CardDisposalSystem] GAMESTATE.removePersistentInventoryItem not available');
        }
      }

      // Repopulate inventory to refresh display
      if (typeof UIControls !== 'undefined' && UIControls.populateInventory) {
        UIControls.populateInventory();
      }
    }

    // Trigger passive items (Scrapper Core)
    if (typeof PassiveItemsSystem !== 'undefined') {
      PassiveItemsSystem.handleDisposal(data, reason);
    }

    // MOK interjection
    if (typeof UIControls !== 'undefined' && UIControls.updateMokInterjection) {
      var label = source === 'inventory' ? 'Item incinerated' : 'Card destroyed';
      UIControls.updateMokInterjection(label + ': ' + data.name);
    }

    // Report to debrief feed
    if (typeof DebriefFeedController !== 'undefined' && typeof DebriefFeedController.reportEvent === 'function') {
      DebriefFeedController.reportEvent('ITEM_INCINERATED', { itemName: data.name || data.id, source: source });
    }
  }

  /**
   * Trigger incinerator animation on debrief feed
   */
  function _triggerIncineratorAnimation() {
    if (!_debriefFeedElement) return;

    // Play incineration SFX
    if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
      AudioSystem.play('rumble-1', { volume: 0.4 });
    }

    // Add animation class
    _debriefFeedElement.classList.add('incinerator-active');

    // Remove after animation completes
    setTimeout(function() {
      _debriefFeedElement.classList.remove('incinerator-active');
    }, DISPOSAL_CONFIG.animationDuration);
  }

  /**
   * Check if a card is disposable
   * @param {Object} card - Card data
   * @returns {boolean} Whether card can be destroyed
   */
  function isDisposable(card) {
    var lifecycle = _getCardLifecycle(card);
    return DISPOSAL_CONFIG.validCardTypes.indexOf(lifecycle) !== -1;
  }

  /* ============================================================
     TOUCH DRAG SYSTEM — mobile incineration support
     HTML5 drag-and-drop doesn't fire on touch devices.
     This creates a floating ghost + detects drop on debrief feed.
     ============================================================ */
  var _touchState = null; // { element, data, index, source, ghost, startX, startY, moved }

  function _createTouchGhost(emoji, x, y) {
    var ghost = document.createElement('div');
    ghost.className = 'touch-drag-ghost';
    ghost.textContent = emoji || '📦';
    ghost.style.cssText =
      'position:fixed;z-index:999999;pointer-events:none;' +
      'font-size:2.2em;opacity:0.85;' +
      'transform:translate(-50%,-50%);' +
      'filter:drop-shadow(0 0 8px rgba(255,120,0,0.6));' +
      'transition:transform 80ms ease;' +
      'left:' + x + 'px;top:' + y + 'px;';
    document.body.appendChild(ghost);
    return ghost;
  }

  function _isOverDebrief(x, y) {
    if (!_debriefFeedElement) return false;
    var rect = _debriefFeedElement.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  function _onTouchStart(e) {
    if (!_touchState) return;
    // Don't create ghost until movement threshold reached
    _touchState.startX = e.touches[0].clientX;
    _touchState.startY = e.touches[0].clientY;
    _touchState.moved = false;
  }

  function _onTouchMove(e) {
    if (!_touchState) return;
    var tx = e.touches[0].clientX;
    var ty = e.touches[0].clientY;

    // Require 12px movement before initiating drag (prevents accidental drags on tap)
    if (!_touchState.moved) {
      var dx = tx - _touchState.startX;
      var dy = ty - _touchState.startY;
      if (Math.sqrt(dx * dx + dy * dy) < 12) return;
      _touchState.moved = true;

      // Create ghost
      var emoji = _touchState.data.emoji || _touchState.element.textContent || '📦';
      _touchState.ghost = _createTouchGhost(emoji, tx, ty);
      _touchState.element.classList.add('card-dragging');
    }

    e.preventDefault(); // Prevent scroll while dragging

    // Move ghost
    if (_touchState.ghost) {
      _touchState.ghost.style.left = tx + 'px';
      _touchState.ghost.style.top = ty + 'px';
    }

    // Highlight debrief if hovering over it
    _handleDragOverDebrief(_isOverDebrief(tx, ty));
  }

  function _onTouchEnd(e) {
    if (!_touchState) return;

    var ts = _touchState;
    _touchState = null;

    // Clean up ghost
    if (ts.ghost) {
      ts.ghost.remove();
    }
    ts.element.classList.remove('card-dragging');

    // If didn't move enough, treat as tap (not drag)
    if (!ts.moved) {
      _handleDragOverDebrief(false);
      return;
    }

    // Check if released over debrief feed
    var endX, endY;
    if (e.changedTouches && e.changedTouches.length) {
      endX = e.changedTouches[0].clientX;
      endY = e.changedTouches[0].clientY;
    } else {
      _handleDragOverDebrief(false);
      return;
    }

    if (_isOverDebrief(endX, endY)) {
      // Set _draggedCard so _handleDropOnDebrief() works
      _draggedCard = {
        element: ts.element,
        card: ts.data,
        index: ts.index,
        source: ts.source
      };
      _handleDropOnDebrief();
    } else {
      _handleDragOverDebrief(false);
    }
  }

  /**
   * Wire touch drag on an inventory/card element for mobile incineration.
   * Call this for each draggable item element after it's created.
   * @param {HTMLElement} element - The item button/element
   * @param {Object} data - Item data object (with name, emoji, lifecycle, etc.)
   * @param {number} index - Index in inventory
   * @param {string} source - 'hand' or 'inventory'
   */
  function setupTouchDrag(element, data, index, source) {
    source = source || 'inventory';

    element.addEventListener('touchstart', function(e) {
      // Block BLVCK
      if (_isBlvckCard(data)) return;

      _touchState = {
        element: element,
        data: data,
        index: index,
        source: source,
        ghost: null,
        startX: 0,
        startY: 0,
        moved: false
      };
      _onTouchStart(e);
    }, { passive: true });

    element.addEventListener('touchmove', _onTouchMove, { passive: false });
    element.addEventListener('touchend', _onTouchEnd, { passive: true });
    element.addEventListener('touchcancel', function() {
      if (_touchState && _touchState.ghost) _touchState.ghost.remove();
      if (_touchState && _touchState.element) _touchState.element.classList.remove('card-dragging');
      _touchState = null;
      _handleDragOverDebrief(false);
    }, { passive: true });
  }

  // Public API
  return {
    init: init,
    handleDragStart: handleDragStart,
    handleDragEnd: handleDragEnd,
    isDisposable: isDisposable,
    setupTouchDrag: setupTouchDrag
  };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    CardDisposalSystem.init();
  });
} else {
  CardDisposalSystem.init();
}
