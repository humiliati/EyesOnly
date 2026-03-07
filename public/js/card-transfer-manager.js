/**
 * CardTransferManager — Cross-container drag & drop for NCH mode.
 *
 * Handles all card transfers between hand fan, backup scroll/halo,
 * left column, vault, and map. All transfers write through
 * CardStateAuthority → GAMESTATE → event → re-render.
 *
 * During STR-combat, only left-column → hand (draw) is allowed,
 * and that goes through CardStateAuthority.drawFromBackup().
 *
 * Roadmap ref: Phase 1.3
 */
var CardTransferManager = (function() {
  'use strict';

  // ── Active drag state ──────────────────────────────────────

  var _drag = null;  // { source, index, cardId, cardRef, ghostEl }

  // ── Drop zone registry ─────────────────────────────────────
  // Each zone: { element, id, accepts: fn(drag) → bool, onDrop: fn(drag, e) }
  var _dropZones = [];

  /**
   * Register a drop zone (data store only — HTML5 drag listeners removed in Phase 3).
   * Zone data is kept for factory-based lookups; actual drag is handled by
   * CardDragController pointer events or component-level pointer handlers.
   * @param {HTMLElement} element
   * @param {string} id - e.g. 'hand-fan', 'backup-halo', 'backup-leftcol', 'map', 'vault'
   * @param {Function} accepts - fn(drag) → bool
   * @param {Function} onDrop - fn(drag, event) → void
   */
  function registerDropZone(element, id, accepts, onDrop) {
    if (!element) return;
    _dropZones.push({ element: element, id: id, accepts: accepts, onDrop: onDrop });
    // NOTE: HTML5 dragover/dragleave/drop listeners removed (Phase 3).
    // Pointer-based drag is handled by CardDragController or component-level handlers.
  }

  function _findZone(el) {
    for (var i = 0; i < _dropZones.length; i++) {
      if (_dropZones[i].element === el) return _dropZones[i];
    }
    return null;
  }

  function _findZoneById(id) {
    for (var i = 0; i < _dropZones.length; i++) {
      if (_dropZones[i].id === id) return _dropZones[i];
    }
    return null;
  }

  /**
   * Unregister a drop zone.
   */
  function unregisterDropZone(element) {
    _dropZones = _dropZones.filter(function(z) { return z.element !== element; });
  }

  // ── Drag start (called by source components) ──────────────

  /**
   * Begin a drag operation. Source components call this on pointerdown/dragstart.
   * NOTE: In Phase 3+, this only stores state for component-level pointer handlers.
   * CardDragController handles the actual drag lifecycle for hand-fan drags.
   * @param {object} dragInfo - { source: 'hand'|'backup'|'vault', index: number, cardId: string, cardRef: object }
   */
  function startDrag(dragInfo) {
    _drag = dragInfo;
  }

  /**
   * Cancel current drag. Cleans up ghost element if present.
   */
  function cancelDrag() {
    if (_drag && _drag.ghostEl) {
      try { _drag.ghostEl.remove(); } catch (e) {}
    }
    _drag = null;
  }

  function getActiveDrag() {
    return _drag;
  }

  // ── Transfer Operations (all go through CardStateAuthority) ──

  /**
   * Move card from backup to hand.
   * @param {number} backupIndex
   * @returns {boolean}
   */
  function backupToHand(backupIndex) {
    if (typeof CardStateAuthority === 'undefined') return false;
    if (CardStateAuthority.isCombat()) {
      // In combat, must use drawFromBackup
      return CardStateAuthority.drawFromBackup(backupIndex, 'pick');
    }
    return CardStateAuthority.moveBackupToHand(backupIndex);
  }

  /**
   * Cascade backup card to TOP of hand (index 0).
   * If hand full, last hand card moves to backup; backup overflow incinerates.
   * @param {number} backupIndex
   * @returns {boolean}
   */
  function cascadeToHandTop(backupIndex) {
    if (typeof CardStateAuthority === 'undefined') return false;
    return CardStateAuthority.cascadeBackupToHandTop(backupIndex);
  }

  /**
   * Move card from hand to backup.
   * @param {number} handIndex
   * @returns {boolean}
   */
  function handToBackup(handIndex) {
    if (typeof CardStateAuthority === 'undefined') return false;
    if (CardStateAuthority.isCombat()) return false; // Cannot during combat
    return CardStateAuthority.moveHandToBackup(handIndex);
  }

  /**
   * Reorder backup deck: move card at fromIndex to toIndex.
   * @param {number} fromIndex
   * @param {number} toIndex
   */
  function reorderBackup(fromIndex, toIndex) {
    if (typeof CardStateAuthority === 'undefined') return;
    if (CardStateAuthority.isCombat()) return; // Cannot reorder during combat
    CardStateAuthority.reorderBackup(fromIndex, toIndex);
  }

  /**
   * Move card from hand to vault (persistent stash).
   * @param {number} handIndex
   * @param {number} qty
   * @returns {boolean}
   */
  function handToVault(handIndex, qty) {
    if (typeof CardStateAuthority === 'undefined') return false;
    return CardStateAuthority.moveHandToVault(handIndex, qty);
  }

  /**
   * Move card from backup to vault.
   * @param {number} backupIndex
   * @returns {boolean}
   */
  function backupToVault(backupIndex) {
    if (typeof CardStateAuthority === 'undefined') return false;
    return CardStateAuthority.moveBackupToVault(backupIndex);
  }

  /**
   * Move card from vault to hand.
   * @param {string} cardId
   * @param {number} qty
   * @returns {boolean}
   */
  function vaultToHand(cardId, qty) {
    if (typeof CardStateAuthority === 'undefined') return false;
    return CardStateAuthority.moveVaultToHand(cardId, qty);
  }

  /**
   * Move card from vault to backup.
   * @param {string} cardId
   * @returns {boolean}
   */
  function vaultToBackup(cardId) {
    if (typeof CardStateAuthority === 'undefined') return false;
    return CardStateAuthority.moveVaultToBackup(cardId);
  }

  /**
   * Deploy card to map (ground effect). Triggers NCH minimize.
   * @param {string} source - 'hand' | 'backup'
   * @param {number} index
   * @param {number} mapX
   * @param {number} mapY
   * @returns {boolean}
   */
  function deployToMap(source, index, mapX, mapY) {
    if (typeof CardStateAuthority === 'undefined') return false;

    var cardId = null;
    if (source === 'hand') {
      var hand = CardStateAuthority.getHand();
      if (index >= 0 && index < hand.length) cardId = hand[index].id;
    } else if (source === 'backup') {
      var backup = CardStateAuthority.getBackup();
      if (index >= 0 && index < backup.length) cardId = backup[index].id;
    }

    if (!cardId) return false;

    // Apply the card effect on the map
    if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.applyNonCombatCardAt === 'function') {
      GoneRogue.applyNonCombatCardAt(cardId, mapX, mapY);
    }

    // Consume from source
    if (source === 'hand') {
      CardStateAuthority.consumeFromHand(index, 1);
    } else if (source === 'backup') {
      CardStateAuthority.removeBackupCard(index);
    }

    // Emit deploy event (triggers NCH minimize animation in Phase 2)
    if (typeof NonCombatEventBus !== 'undefined') {
      NonCombatEventBus.emit('card:deployed-to-map', {
        source: source,
        index: index,
        cardId: cardId,
        mapX: mapX,
        mapY: mapY
      });
    }

    return true;
  }

  // ── Default Drop Zone Factories ────────────────────────────

  /**
   * Create standard accepts/onDrop for hand fan drop zone.
   */
  function createHandFanDropHandlers() {
    return {
      accepts: function(drag) {
        if (CardStateAuthority.isCombat() && drag.source !== 'backup-leftcol') return false;
        return (drag.source === 'backup' || drag.source === 'backup-leftcol' || drag.source === 'vault');
      },
      onDrop: function(drag, e) {
        if (drag.source === 'backup' || drag.source === 'backup-leftcol') {
          backupToHand(drag.index);
        } else if (drag.source === 'vault') {
          vaultToHand(drag.cardId, 1);
        }
      }
    };
  }

  /**
   * Create standard accepts/onDrop for backup/halo drop zone.
   */
  function createBackupDropHandlers() {
    return {
      accepts: function(drag) {
        if (CardStateAuthority.isCombat()) return false;
        return (drag.source === 'hand' || drag.source === 'vault' || drag.source === 'backup');
      },
      onDrop: function(drag, e) {
        if (drag.source === 'hand') {
          handToBackup(drag.index);
        } else if (drag.source === 'vault') {
          vaultToBackup(drag.cardId);
        } else if (drag.source === 'backup') {
          // Reorder: determine target index from drop position
          var targetIndex = _inferDropIndex(e);
          if (targetIndex >= 0) {
            reorderBackup(drag.index, targetIndex);
          }
        }
      }
    };
  }

  /**
   * Create standard accepts/onDrop for vault drop zone.
   */
  function createVaultDropHandlers() {
    return {
      accepts: function(drag) {
        if (CardStateAuthority.isCombat()) return false;
        return (drag.source === 'hand' || drag.source === 'backup');
      },
      onDrop: function(drag, e) {
        if (drag.source === 'hand') {
          handToVault(drag.index, 1);
        } else if (drag.source === 'backup') {
          backupToVault(drag.index);
        }
      }
    };
  }

  /**
   * Create standard accepts/onDrop for map drop zone.
   */
  function createMapDropHandlers() {
    return {
      accepts: function(drag) {
        return (drag.source === 'hand' || drag.source === 'backup');
      },
      onDrop: function(drag, e) {
        // Determine map coordinates from drop position
        var coords = _getMapCoordsFromEvent(e);
        if (coords) {
          deployToMap(drag.source, drag.index, coords.x, coords.y);
        }
      }
    };
  }

  // ── Equip Item Slot ────────────────────────────────────────

  /**
   * Equip an item from vault to the active slot in website header.
   * @param {string} cardId
   * @returns {boolean}
   */
  function equipFromVault(cardId) {
    if (typeof CardStateAuthority === 'undefined') return false;
    return CardStateAuthority.equipItemFromVault(cardId);
  }

  /**
   * Unequip current item back to vault.
   * @returns {boolean}
   */
  function unequipItem() {
    if (typeof CardStateAuthority === 'undefined') return false;
    return CardStateAuthority.unequipItem();
  }

  // ── Map Pickup ───────────────────────────────────────────

  /**
   * Route a card picked up from the map to the correct container.
   * @param {string} cardId
   * @param {string} cardType - 'item' | 'card' | auto
   * @returns {object}
   */
  function pickupFromMap(cardId, cardType) {
    if (typeof CardStateAuthority === 'undefined') return { success: false };
    return CardStateAuthority.pickupFromMap(cardId, cardType);
  }

  // ── Overflow Add ─────────────────────────────────────────

  /**
   * Add card to hand with trickle-down overflow.
   * @param {string} cardId
   * @param {number} qty
   * @returns {object}
   */
  function addCardWithOverflow(cardId, qty) {
    if (typeof CardStateAuthority === 'undefined') return { placed: null };
    return CardStateAuthority.addCardWithOverflow(cardId, qty);
  }

  // ── Drop Zone Factories (continued) ──────────────────────

  /**
   * Create standard accepts/onDrop for equipped item slot drop zone.
   * Accepts items from vault only.
   */
  function createEquipSlotDropHandlers() {
    return {
      accepts: function(drag) {
        if (CardStateAuthority.isCombat()) return false;
        if (drag.source !== 'vault' && drag.source !== 'items') return false;
        // Only items can be equipped — check card type
        var def = CardStateAuthority.getCardDef(drag.cardId);
        if (def && def.type) {
          var t = ('' + def.type).toLowerCase();
          return (t.indexOf('item') !== -1 || t.indexOf('equip') !== -1);
        }
        return true; // allow by default if no type info
      },
      onDrop: function(drag, e) {
        equipFromVault(drag.cardId);
      }
    };
  }

  // ── Helpers ────────────────────────────────────────────────

  function _inferDropIndex(e) {
    // Try to get slot index from the drop target
    var el = e.target;
    while (el) {
      if (el.dataset && el.dataset.slotIndex !== undefined) {
        return parseInt(el.dataset.slotIndex, 10);
      }
      if (el.dataset && el.dataset.cardIndex !== undefined) {
        return parseInt(el.dataset.cardIndex, 10);
      }
      el = el.parentElement;
    }
    return -1;
  }

  function _getMapCoordsFromEvent(e) {
    // Try GoneRogue's coordinate system
    if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.screenToGrid === 'function') {
      return GoneRogue.screenToGrid(e.clientX, e.clientY);
    }
    return null;
  }

  // ── Public API ─────────────────────────────────────────────

  return {
    // Drag lifecycle
    startDrag: startDrag,
    cancelDrag: cancelDrag,
    getActiveDrag: getActiveDrag,

    // Drop zone registry
    registerDropZone: registerDropZone,
    unregisterDropZone: unregisterDropZone,

    // Direct transfer operations
    backupToHand: backupToHand,
    cascadeToHandTop: cascadeToHandTop,
    handToBackup: handToBackup,
    reorderBackup: reorderBackup,
    handToVault: handToVault,
    backupToVault: backupToVault,
    vaultToHand: vaultToHand,
    vaultToBackup: vaultToBackup,
    deployToMap: deployToMap,

    // Equip slot
    equipFromVault: equipFromVault,
    unequipItem: unequipItem,

    // Map pickup
    pickupFromMap: pickupFromMap,

    // Overflow
    addCardWithOverflow: addCardWithOverflow,

    // Drop handler factories
    createHandFanDropHandlers: createHandFanDropHandlers,
    createBackupDropHandlers: createBackupDropHandlers,
    createVaultDropHandlers: createVaultDropHandlers,
    createMapDropHandlers: createMapDropHandlers,
    createEquipSlotDropHandlers: createEquipSlotDropHandlers
  };

})();
