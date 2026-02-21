/* ============================================================
   EYES ONLY - Environmental Drag-Drop System
   Key + Gate interactions and item destruction mechanics
   ============================================================ */

const EnvironmentalDragDrop = (function() {
  'use strict';

  // Drag context types
  var CONTEXT_TYPES = {
    IDLE: 'idle',
    KEY_TO_GATE: 'key_to_gate',
    ITEM_DESTRUCTION: 'item_destruction',
    BOX_PLACEMENT: 'box_placement',
    DISABLED: 'disabled'
  };

  // State
  var _currentContext = CONTEXT_TYPES.IDLE;
  var _dragContext = null;  // {sourceZone, itemId, itemData, x, y}
  var _debriefFeedElement = null;
  var _gameMapElement = null;
  var _draggedFromEquippedSlot = false;
  var _nearestGate = null;

  /**
   * Initialize the environmental drag-drop system
   */
  function init() {
    _debriefFeedElement = document.getElementById('debrief-screen');
    _gameMapElement = document.getElementById('grid-container');

    if (!_debriefFeedElement) {
      console.warn('[EnvironmentalDragDrop] Debrief screen not found');
    }

    if (!_gameMapElement) {
      console.warn('[EnvironmentalDragDrop] Game map not found');
    }

    if (_debriefFeedElement) {
      _setupDebriefDropZone();
    }

    if (_gameMapElement) {
      _setupGameMapDropZone();
    }

    console.log('[EnvironmentalDragDrop] Initialized');
  }

  /**
   * Set up debrief feed as drop zone for item destruction
   */
  function _setupDebriefDropZone() {
    _debriefFeedElement.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      if (_dragContext && _draggedFromEquippedSlot) {
        _handleDragOverDebrief(true);
      }
    });

    _debriefFeedElement.addEventListener('dragleave', function(e) {
      if (e.target === _debriefFeedElement) {
        _handleDragOverDebrief(false);
      }
    });

    _debriefFeedElement.addEventListener('drop', function(e) {
      e.preventDefault();
      if (_draggedFromEquippedSlot) {
        _handleDropOnDebrief();
      }
    });
  }

  /**
   * Set up game map as drop zone for key+gate interaction
   */
  function _setupGameMapDropZone() {
    _gameMapElement.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      if (_dragContext && _draggedFromEquippedSlot) {
        // Calculate grid position from mouse coordinates
        var gridPos = _getGridPositionFromEvent(e);
        _handleDragOverGameMap(true, gridPos);
      }
    });

    _gameMapElement.addEventListener('dragleave', function(e) {
      if (e.target === _gameMapElement) {
        _handleDragOverGameMap(false, null);
      }
    });

    _gameMapElement.addEventListener('drop', function(e) {
      e.preventDefault();
      if (_draggedFromEquippedSlot) {
        var gridPos = _getGridPositionFromEvent(e);
        _handleDropOnGameMap(gridPos);
      }
    });
  }

  /**
   * Calculate grid position from mouse event
   * @param {Event} e - Mouse event
   * @returns {Object|null} {x, y} grid coordinates
   */
  function _getGridPositionFromEvent(e) {
    var rect = _gameMapElement.getBoundingClientRect();
    var mouseX = e.clientX - rect.left;
    var mouseY = e.clientY - rect.top;

    // Calculate grid cell size (assuming 40x20 grid)
    var cellWidth = rect.width / 40;
    var cellHeight = rect.height / 20;

    var gridX = Math.floor(mouseX / cellWidth);
    var gridY = Math.floor(mouseY / cellHeight);

    // Validate bounds
    if (gridX >= 0 && gridX < 40 && gridY >= 0 && gridY < 20) {
      return { x: gridX, y: gridY };
    }

    return null;
  }

  /**
   * Handle drag start from equipped item slot
   * @param {Object} context - Drag context data
   */
  function handleDragStart(context) {
    _dragContext = context;
    _draggedFromEquippedSlot = context.sourceZone === 'equipped_slot' || context.sourceZone === 'header_inventory';

    // Check if item is a deployable box
    if (typeof GoneRogue !== 'undefined' && GoneRogue.isBoxDeployItem && GoneRogue.isBoxDeployItem(context.itemId)) {
      _setContext(CONTEXT_TYPES.BOX_PLACEMENT);
      _draggedFromEquippedSlot = true; // allow map drop from any inventory source
    } else if (typeof EnvironmentalSynergy !== 'undefined' && EnvironmentalSynergy.isKeyItem(context.itemId)) {
      // Check if item is a key
      _setContext(CONTEXT_TYPES.KEY_TO_GATE);
    } else {
      _setContext(CONTEXT_TYPES.IDLE);
    }

    console.log('[EnvironmentalDragDrop] Drag started:', _currentContext, context);
  }

  /**
   * Handle drag end
   */
  function handleDragEnd() {
    _clearBoxPlacementPreview();
    _setContext(CONTEXT_TYPES.IDLE);
    _dragContext = null;
    _draggedFromEquippedSlot = false;
    _nearestGate = null;
  }

  /**
   * Set the current context and update visual feedback
   * @param {string} context - Context type
   */
  function _setContext(context) {
    _currentContext = context;

    // Emit event for other systems to listen
    if (typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('environmentalDrag:contextChanged', {
        detail: { context: context }
      }));
    }
  }

  /**
   * Handle drag over debrief feed (destruction zone)
   * @param {boolean} isOver - Whether drag is over debrief
   */
  function _handleDragOverDebrief(isOver) {
    if (isOver && _dragContext) {
      _debriefFeedElement.classList.add('destruction-zone-active');
    } else {
      _debriefFeedElement.classList.remove('destruction-zone-active');
    }
  }

  /**
   * Handle drag over game map (synergy zone)
   * @param {boolean} isOver - Whether drag is over map
   * @param {Object|null} gridPos - Grid position {x, y}
   */
  function _handleDragOverGameMap(isOver, gridPos) {
    if (!isOver || !gridPos) {
      _clearGateHighlight();
      _clearBoxPlacementPreview();
      _nearestGate = null;
      return;
    }

    // Box placement preview
    if (_currentContext === CONTEXT_TYPES.BOX_PLACEMENT) {
      _clearBoxPlacementPreview();
      if (_gameMapElement && _gameMapElement.children) {
        var cellIdx = gridPos.y * 40 + gridPos.x;
        var cell = _gameMapElement.children[cellIdx];
        if (cell) {
          var isValid = typeof GoneRogue !== 'undefined' && GoneRogue.isValidBoxPlacement &&
                        GoneRogue.isValidBoxPlacement(gridPos.x, gridPos.y);
          cell.classList.add(isValid ? 'box-placement-valid' : 'box-placement-invalid');
        }
      }
      return;
    }

    // Check if there's a gate near this position
    if (typeof EnvironmentalSynergy !== 'undefined') {
      var gate = EnvironmentalSynergy.getGateAt(gridPos.x, gridPos.y);

      if (gate) {
        _nearestGate = gate;
        _highlightGate(gate);

        // Check if key is compatible
        if (_dragContext && EnvironmentalSynergy.canUnlock(_dragContext.itemId, gate.type)) {
          _gameMapElement.classList.add('synergy-available');
        } else {
          _gameMapElement.classList.add('synergy-incompatible');
        }
      } else {
        _clearGateHighlight();
        _nearestGate = null;
      }
    }
  }

  /**
   * Highlight a gate on the map
   * @param {Object} gate - Gate object
   */
  function _highlightGate(gate) {
    // Find the cell at gate position and add highlight class
    if (_gameMapElement && _gameMapElement.children) {
      var cellIndex = gate.y * 40 + gate.x;
      var cell = _gameMapElement.children[cellIndex];
      if (cell) {
        cell.classList.add('gate-highlight');
      }
    }
  }

  /**
   * Clear gate highlight
   */
  function _clearGateHighlight() {
    _gameMapElement.classList.remove('synergy-available');
    _gameMapElement.classList.remove('synergy-incompatible');

    if (_gameMapElement && _gameMapElement.children) {
      for (var i = 0; i < _gameMapElement.children.length; i++) {
        _gameMapElement.children[i].classList.remove('gate-highlight');
      }
    }
  }

  /**
   * Clear box placement preview highlight from all cells
   */
  function _clearBoxPlacementPreview() {
    if (_gameMapElement && _gameMapElement.children) {
      for (var i = 0; i < _gameMapElement.children.length; i++) {
        _gameMapElement.children[i].classList.remove('box-placement-valid');
        _gameMapElement.children[i].classList.remove('box-placement-invalid');
      }
    }
  }

  /**
   * Process box placement drop
   * @param {Object} gridPos - Grid position {x, y}
   */
  function _processBoxPlacement(gridPos) {
    if (!gridPos || !_dragContext) return;

    if (typeof GoneRogue === 'undefined' || !GoneRogue.isValidBoxPlacement ||
        !GoneRogue.isValidBoxPlacement(gridPos.x, gridPos.y)) {
      _triggerFailureAnimation('Cannot place here');
      return;
    }

    // Look up quality from registry
    var quality = 'common';
    if (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getItem) {
      var itemDef = GoneRogueDataRegistry.getItem(_dragContext.itemId);
      if (itemDef && itemDef.boxQuality) quality = itemDef.boxQuality;
    }

    GoneRogue.placeBox(gridPos, _dragContext.itemId, quality);

    if (typeof MokUX !== 'undefined') {
      MokUX.speak('📦 Box placed.', 'NEUTRAL');
    }
  }

  /**
   * Handle drop on debrief feed (item destruction)
   */
  function _handleDropOnDebrief() {
    if (!_dragContext) {
      console.warn('[EnvironmentalDragDrop] No drag context');
      return;
    }

    // Show destruction warning
    var confirmed = _showDestructionWarning(_dragContext);

    if (confirmed) {
      var result = _processItemDestruction(_dragContext);

      if (result.success) {
        _triggerIncineratorAnimation();
      }
    }

    // Clean up
    _handleDragOverDebrief(false);
    handleDragEnd();
  }

  /**
   * Handle drop on game map (key+gate interaction)
   * @param {Object} gridPos - Grid position {x, y}
   */
  function _handleDropOnGameMap(gridPos) {
    if (!_dragContext || !gridPos) {
      console.warn('[EnvironmentalDragDrop] No drag context or grid position');
      handleDragEnd();
      return;
    }

    // Box placement
    if (_currentContext === CONTEXT_TYPES.BOX_PLACEMENT) {
      _clearBoxPlacementPreview();
      _processBoxPlacement(gridPos);
      handleDragEnd();
      return;
    }

    // Check if dropping on a gate
    if (typeof EnvironmentalSynergy !== 'undefined') {
      var gate = _nearestGate || EnvironmentalSynergy.getGateAt(gridPos.x, gridPos.y);

      if (gate) {
        var result = _processGateUnlock(_dragContext, gate);

        if (result.success) {
          _triggerSynergyAnimation(result.animation);
          _displaySynergyInDebriefFeed(result);
        } else {
          _triggerFailureAnimation(result.message);
        }
      }
    }

    // Clean up
    _clearGateHighlight();
    handleDragEnd();
  }

  /**
   * Show destruction warning modal
   * @param {Object} context - Drag context
   * @returns {boolean} True if user confirmed
   */
  function _showDestructionWarning(context) {
    // For now, use simple confirm dialog
    // TODO: Replace with custom modal UI
    var itemName = context.itemData ? context.itemData.name : _getItemDisplayName(context.itemId);
    return confirm('Are you sure you want to destroy ' + itemName + '? This cannot be undone.');
  }

  /**
   * Process item destruction
   * @param {Object} context - Drag context
   * @returns {Object} Result object
   */
  function _processItemDestruction(context) {
    if (typeof GAMESTATE === 'undefined') {
      return { success: false, reason: 'GAMESTATE_NOT_FOUND' };
    }

    // Remove item from equipped slot or inventory
    var state = GAMESTATE.getState();
    var inventory = state.inventoryPersistent || [];

    var itemIndex = inventory.findIndex(function(item) {
      return item.id === context.itemId || item === context.itemData;
    });

    if (itemIndex === -1) {
      return { success: false, reason: 'ITEM_NOT_FOUND' };
    }

    // Remove the item
    var destroyedItem = inventory.splice(itemIndex, 1)[0];

    // MOK feedback
    if (typeof MokUX !== 'undefined') {
      MokUX.speak('Item destroyed.', 'NEUTRAL');
    }

    // Update UI
    if (typeof UIControls !== 'undefined' && UIControls.refreshInventory) {
      UIControls.refreshInventory();
    }

    return {
      success: true,
      itemName: destroyedItem.name || _getItemDisplayName(context.itemId)
    };
  }

  /**
   * Get display name from itemId
   * Converts XXXXX_XXX format to "Xxxxx Xxx" format
   * @param {string} itemId - Item identifier
   * @returns {string} Display name
   * @private
   */
  function _getItemDisplayName(itemId) {
    if (!itemId) return 'Unknown';

    // Use NameUtils if available
    if (typeof NameUtils !== 'undefined') {
      return NameUtils.getDisplayName(itemId);
    }

    // Fallback: Convert RUSTY_KEY → Rusty Key
    var words = itemId.split('_');
    return words.map(function(word) {
      if (word.length === 0) return '';
      return word.charAt(0).toUpperCase() + word.substring(1).toLowerCase();
    }).join(' ');
  }

  /**
   * Process gate unlock
   * @param {Object} context - Drag context
   * @param {Object} gate - Gate object
   * @returns {Object} Result object
   */
  function _processGateUnlock(context, gate) {
    if (typeof EnvironmentalSynergy === 'undefined') {
      return { success: false, message: 'System not available' };
    }

    // Attempt unlock
    var result = EnvironmentalSynergy.attemptUnlock(context.itemId, gate);

    if (result.success) {
      // Remove key from inventory if consumed
      if (result.consumeKey) {
        _removeKeyFromInventory(context.itemId);
      }

      // Remove gate from game world
      if (typeof GoneRogue !== 'undefined' && GoneRogue.removeBreakableAt) {
        GoneRogue.removeBreakableAt(gate.x, gate.y);
      }

      // MOK feedback
      if (typeof MokUX !== 'undefined') {
        MokUX.speak(result.message, 'POSITIVE');
      }
    } else {
      // Failure feedback
      if (typeof MokUX !== 'undefined') {
        MokUX.speak(result.message, 'NEGATIVE');
      }
    }

    return result;
  }

  /**
   * Remove key from inventory
   * @param {string} keyId - Key ID to remove
   */
  function _removeKeyFromInventory(keyId) {
    if (typeof GAMESTATE === 'undefined') return;

    var state = GAMESTATE.getState();
    var inventory = state.inventoryPersistent || [];

    var keyIndex = inventory.findIndex(function(item) {
      return item.id === keyId || item.itemId === keyId;
    });

    if (keyIndex !== -1) {
      inventory.splice(keyIndex, 1);

      // Update UI
      if (typeof UIControls !== 'undefined' && UIControls.refreshInventory) {
        UIControls.refreshInventory();
      }
    }
  }

  /**
   * Trigger synergy animation (double emoji stack)
   * @param {Object} animationData - Animation configuration
   */
  function _triggerSynergyAnimation(animationData) {
    if (!animationData || !_debriefFeedElement) return;

    // Create double emoji stack overlay
    var overlay = document.createElement('div');
    overlay.className = 'synergy-overlay';
    overlay.innerHTML = `
      <div class="emoji-stack">
        <div class="emoji-primary">${animationData.emojis[0]}</div>
        <div class="emoji-secondary">${animationData.emojis[1]}</div>
      </div>
      <div class="unlock-emoji">${animationData.unlockEmoji}</div>
    `;

    _debriefFeedElement.appendChild(overlay);

    // Animate
    setTimeout(function() {
      overlay.classList.add('synergy-active');
    }, 50);

    // Remove after duration
    setTimeout(function() {
      overlay.classList.remove('synergy-active');
      setTimeout(function() {
        overlay.remove();
      }, 300);
    }, animationData.duration || 1500);
  }

  /**
   * Display synergy result in debrief feed
   * @param {Object} result - Unlock result
   */
  function _displaySynergyInDebriefFeed(result) {
    if (typeof DebriefFeedRenderer === 'undefined') return;

    // Add message to debrief feed
    var message = '🔓 ' + result.message;
    DebriefFeedRenderer.addMessage(message, 'synergy');
  }

  /**
   * Trigger incinerator animation for item destruction
   */
  function _triggerIncineratorAnimation() {
    if (!_debriefFeedElement) return;

    _debriefFeedElement.classList.add('incinerator-active');

    setTimeout(function() {
      _debriefFeedElement.classList.remove('incinerator-active');
    }, 800);
  }

  /**
   * Trigger failure animation
   * @param {string} message - Failure message
   */
  function _triggerFailureAnimation(message) {
    if (!_gameMapElement) return;

    _gameMapElement.classList.add('synergy-failed');

    setTimeout(function() {
      _gameMapElement.classList.remove('synergy-failed');
    }, 400);
  }

  /**
   * Get current context
   * @returns {string} Current context type
   */
  function getCurrentContext() {
    return _currentContext;
  }

  // Public API
  return {
    init: init,
    handleDragStart: handleDragStart,
    handleDragEnd: handleDragEnd,
    getCurrentContext: getCurrentContext,
    CONTEXT_TYPES: CONTEXT_TYPES
  };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    EnvironmentalDragDrop.init();
  });
} else {
  EnvironmentalDragDrop.init();
}
