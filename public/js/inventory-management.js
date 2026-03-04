/**
 * InventoryManagement — Extracted from gone-rogue.js (Phase 8)
 * Stash/retrieve, equip/unequip, consume keys, consume costs.
 * Stateless module — all via GAMESTATE and ctx.
 */
var InventoryManagement = (function() {
  'use strict';

  // ── Stash / Retrieve (bonfire only) ──

  function stashCard(cmd, ctx) {
    var floorType = ctx.getFloorType(ctx.floor);
    if (floorType !== ctx.FLOOR_TYPES.BONFIRE) {
      return {
        lines: ['NO BONFIRE HERE', 'Inventory transfer only available at bonfire floors', ''].concat(ctx.renderGrid()),
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    if (typeof GAMESTATE === 'undefined') {
      return { lines: ['GAMESTATE UNAVAILABLE', ''], prompt: ctx.getPrompt(), stayActive: true };
    }

    var parts = cmd.split(' ');
    if (parts.length < 2) {
      return {
        lines: ['USAGE: STASH <number>', 'Example: STASH 1', ''].concat(ctx.inventoryLines()),
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    var itemNum = parseInt(parts[1], 10) - 1;
    var looseInv = GAMESTATE.getLooseInventory();

    if (itemNum < 0 || itemNum >= looseInv.length) {
      return {
        lines: ['INVALID ITEM NUMBER', 'Loose carry has ' + looseInv.length + ' items', ''].concat(ctx.inventoryLines()),
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    var item = looseInv[itemNum];
    var addResult = GAMESTATE.addToPersistent(item);
    if (!addResult.success) {
      return {
        lines: [addResult.message, ''].concat(ctx.inventoryLines()),
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    GAMESTATE.removeFromLoose(itemNum);

    return {
      lines: [
        '\uD83D\uDCE6 STASHED TO PERSISTENT STORAGE',
        item.emoji + ' ' + item.name,
        ''
      ].concat(ctx.inventoryLines()),
      prompt: ctx.getPrompt(),
      stayActive: true
    };
  }

  function retrieveCard(cmd, ctx) {
    var floorType = ctx.getFloorType(ctx.floor);
    if (floorType !== ctx.FLOOR_TYPES.BONFIRE) {
      return {
        lines: ['NO BONFIRE HERE', 'Inventory transfer only available at bonfire floors', ''].concat(ctx.renderGrid()),
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    if (typeof GAMESTATE === 'undefined') {
      return { lines: ['GAMESTATE UNAVAILABLE', ''], prompt: ctx.getPrompt(), stayActive: true };
    }

    var parts = cmd.split(' ');
    if (parts.length < 2) {
      return {
        lines: ['USAGE: RETRIEVE <number>', 'Example: RETRIEVE 1', ''].concat(ctx.inventoryLines()),
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    var itemNum = parseInt(parts[1], 10) - 1;
    var persistentInv = GAMESTATE.getPersistentInventory();

    if (itemNum < 0 || itemNum >= persistentInv.length) {
      return {
        lines: ['INVALID ITEM NUMBER', 'Persistent storage has ' + persistentInv.length + ' items', ''].concat(ctx.inventoryLines()),
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    var item = persistentInv[itemNum];
    var addResult = GAMESTATE.addToLoose(item);
    if (!addResult.success) {
      return {
        lines: [addResult.message, ''].concat(ctx.inventoryLines()),
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    GAMESTATE.removeFromPersistent(itemNum);

    return {
      lines: [
        '\uD83C\uDF92 RETRIEVED TO LOOSE CARRY',
        item.emoji + ' ' + item.name,
        ''
      ].concat(ctx.inventoryLines()),
      prompt: ctx.getPrompt(),
      stayActive: true
    };
  }

  // ── Equip / Unequip ──

  function equipItem(cmd, ctx) {
    if (typeof GAMESTATE === 'undefined') {
      return { lines: ['GAMESTATE UNAVAILABLE', ''], prompt: ctx.getPrompt(), stayActive: true };
    }

    var parts = cmd.split(' ');
    if (parts.length < 2) {
      return {
        lines: ['USAGE: EQUIP <number>', 'Example: EQUIP 1', ''].concat(ctx.inventoryLines()),
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    var itemNum = parseInt(parts[1], 10) - 1;
    var persistentInv = GAMESTATE.getPersistentInventory();

    if (itemNum < 0 || itemNum >= persistentInv.length) {
      return {
        lines: ['INVALID ITEM NUMBER', 'Persistent inventory has ' + persistentInv.length + ' items', ''].concat(ctx.inventoryLines()),
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    var item = persistentInv[itemNum];
    GAMESTATE.setActiveItem(item);
    ctx.updatePlayerLight();

    return {
      lines: [
        '\u26A1 EQUIPPED TO ACTIVE SLOT',
        item.emoji + ' ' + item.name,
        ''
      ].concat(ctx.inventoryLines()),
      prompt: ctx.getPrompt(),
      stayActive: true
    };
  }

  function unequipItem(ctx) {
    if (typeof GAMESTATE === 'undefined') {
      return { lines: ['GAMESTATE UNAVAILABLE', ''], prompt: ctx.getPrompt(), stayActive: true };
    }

    var activeItem = GAMESTATE.getActiveItem();
    if (!activeItem) {
      return { lines: ['NO ITEM EQUIPPED', ''], prompt: ctx.getPrompt(), stayActive: true };
    }

    GAMESTATE.clearActiveItem();
    ctx.updatePlayerLight();

    return {
      lines: [
        '\u26AA UNEQUIPPED',
        'Active slot cleared',
        ''
      ].concat(ctx.inventoryLines()),
      prompt: ctx.getPrompt(),
      stayActive: true
    };
  }

  // ── Key Consumption ──

  function consumeActiveItemIfMatches(requiredKey) {
    if (typeof GAMESTATE === 'undefined') return false;

    var active = GAMESTATE.getActiveItem ? GAMESTATE.getActiveItem() : null;
    if (!active || active.type !== 'key') return false;

    var activeKeyType = active.keyType || active.itemId;
    if (activeKeyType !== requiredKey) return false;

    var persistent = GAMESTATE.getPersistentInventory ? GAMESTATE.getPersistentInventory() : [];
    for (var i = 0; i < persistent.length; i++) {
      var pit = persistent[i];
      if (pit && pit.type === 'key' && (pit.keyType || pit.itemId) === requiredKey) {
        if (GAMESTATE.removePersistentInventoryItem) GAMESTATE.removePersistentInventoryItem(i);
        break;
      }
    }

    if (GAMESTATE.clearActiveItem) GAMESTATE.clearActiveItem();

    try {
      if (GAMESTATE.removeKeyCount) GAMESTATE.removeKeyCount(requiredKey, 2);
    } catch (eKC) {}

    if (typeof document !== 'undefined') {
      var activeDisplay = document.getElementById('active-item-display');
      if (activeDisplay) {
        activeDisplay.innerHTML = '<span class="empty-slot-indicator">\u00B7</span>';
        activeDisplay.classList.remove('has-item');
      }
    }

    if (typeof GoneRogueMobile !== 'undefined' && GoneRogueMobile.showInventory) {
      GoneRogueMobile.showInventory();
    }

    return true;
  }

  function consumeKeyFromInventory(requiredKey) {
    if (typeof GAMESTATE === 'undefined') return false;

    var loose = GAMESTATE.getLooseInventory ? GAMESTATE.getLooseInventory() : [];
    for (var i = 0; i < loose.length; i++) {
      var it = loose[i];
      if (it && it.type === 'key' && (it.keyType || it.itemId) === requiredKey) {
        if (GAMESTATE.removeFromLoose) GAMESTATE.removeFromLoose(i);
        try { if (GAMESTATE.removeKeyCount) GAMESTATE.removeKeyCount(requiredKey, it.tier || 1); } catch (e) {}
        return true;
      }
    }

    var persistent = GAMESTATE.getPersistentInventory ? GAMESTATE.getPersistentInventory() : [];
    for (var j = 0; j < persistent.length; j++) {
      var pit = persistent[j];
      if (pit && pit.type === 'key' && (pit.keyType || pit.itemId) === requiredKey) {
        if (GAMESTATE.removeFromPersistent) GAMESTATE.removeFromPersistent(j);
        try { if (GAMESTATE.removeKeyCount) GAMESTATE.removeKeyCount(requiredKey, pit.tier || 2); } catch (e) {}
        return true;
      }
    }

    return false;
  }

  /**
   * Helper: resolve an item ref to a full item object (for id-only refs)
   */
  function _hydrateForQuestCheck(item) {
    if (!item) return item;
    // If item already has type/keyType, use it directly
    if (item.type || item.keyType) return item;
    // Try to hydrate from registry (item may be a {id, qty} ref)
    if (item.id && typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getItem) {
      var full = GoneRogueDataRegistry.getItem(item.id);
      if (full) return Object.assign({}, full, item);
    }
    return item;
  }

  /**
   * Helper: check if an item matches the quest key type
   */
  function _matchesQuestKey(rawItem, questKeyType, npcTarget) {
    var item = _hydrateForQuestCheck(rawItem);
    if (!item) return false;
    // Match by keyType directly
    var keyId = item.keyType || item.registryId || item.itemId || item.id || '';
    if (keyId === questKeyType) {
      if (item.npcTarget && npcTarget && item.npcTarget !== npcTarget) return false;
      return true;
    }
    // Also match by name heuristic (BLACKSMITH_HAMMER → "Blacksmith's Hammer")
    var nameNorm = (item.name || '').toUpperCase().replace(/[^A-Z0-9]/g, '_');
    if (nameNorm === questKeyType || nameNorm.indexOf(questKeyType) >= 0) {
      return true;
    }
    return false;
  }

  function consumeQuestItem(questKeyType, npcTarget) {
    if (typeof GAMESTATE === 'undefined') return false;

    // 1) Check active (equipped) item slot first
    if (GAMESTATE.getActiveItem) {
      var activeItem = GAMESTATE.getActiveItem();
      if (activeItem && _matchesQuestKey(activeItem, questKeyType, npcTarget)) {
        var consumed = JSON.parse(JSON.stringify(activeItem));
        // Clear the active item slot
        if (GAMESTATE.setActiveItem) {
          GAMESTATE.setActiveItem(null);
        }
        try {
          if (GAMESTATE.removeKeyCount) GAMESTATE.removeKeyCount(questKeyType, 3);
        } catch (eKC) {}

        if (typeof TooltipSystem !== 'undefined') {
          TooltipSystem.show((activeItem.emoji || '\uD83D\uDD28') + ' TURNED IN', 1500);
        }
        if (typeof DebriefFeedController !== 'undefined') {
          DebriefFeedController.flashIncinerator({ kind: 'quest_key' });
        }
        if (typeof GoneRogueMobile !== 'undefined' && GoneRogueMobile.showInventory) {
          GoneRogueMobile.showInventory();
        }
        return consumed;
      }
    }

    // 2) Check persistent inventory
    var persistent = GAMESTATE.getPersistentInventory ? GAMESTATE.getPersistentInventory() : [];
    for (var i = 0; i < persistent.length; i++) {
      var pit = persistent[i];
      if (!pit) continue;
      if (!_matchesQuestKey(pit, questKeyType, npcTarget)) continue;

      var consumed2 = JSON.parse(JSON.stringify(pit));
      if (GAMESTATE.removePersistentInventoryItem) {
        GAMESTATE.removePersistentInventoryItem(i);
      } else if (GAMESTATE.removeFromPersistent) {
        GAMESTATE.removeFromPersistent(i);
      }

      try {
        if (GAMESTATE.removeKeyCount) GAMESTATE.removeKeyCount(questKeyType, 3);
      } catch (eKC) {}

      if (typeof TooltipSystem !== 'undefined') {
        TooltipSystem.show((pit.emoji || '\uD83D\uDD28') + ' TURNED IN', 1500);
      }
      if (typeof DebriefFeedController !== 'undefined') {
        DebriefFeedController.flashIncinerator({ kind: 'quest_key' });
      }
      if (typeof GoneRogueMobile !== 'undefined' && GoneRogueMobile.showInventory) {
        GoneRogueMobile.showInventory();
      }

      return consumed2;
    }

    // 3) Check loose inventory
    var loose = GAMESTATE.getLooseInventory ? GAMESTATE.getLooseInventory() : [];
    for (var j = 0; j < loose.length; j++) {
      var lit = loose[j];
      if (!lit) continue;
      if (!_matchesQuestKey(lit, questKeyType, npcTarget)) continue;

      var consumed3 = JSON.parse(JSON.stringify(lit));
      if (GAMESTATE.removeFromLoose) GAMESTATE.removeFromLoose(j);

      try {
        if (GAMESTATE.removeKeyCount) GAMESTATE.removeKeyCount(questKeyType, 3);
      } catch (eKC) {}

      if (typeof TooltipSystem !== 'undefined') {
        TooltipSystem.show((lit.emoji || '\uD83D\uDD28') + ' TURNED IN', 1500);
      }
      if (typeof DebriefFeedController !== 'undefined') {
        DebriefFeedController.flashIncinerator({ kind: 'quest_key' });
      }
      if (typeof GoneRogueMobile !== 'undefined' && GoneRogueMobile.showInventory) {
        GoneRogueMobile.showInventory();
      }

      return consumed3;
    }

    return false;
  }

  // ── Resource Costs ──

  function consumeCosts(costs) {
    if (!costs || !costs.length) return { success: true };
    if (typeof GAMESTATE === 'undefined') return { success: false };

    for (var i = 0; i < costs.length; i++) {
      var c = costs[i];
      if (!c || !c.kind) continue;
      var amt = Number(c.amount || 0);
      if (!isFinite(amt) || amt <= 0) continue;

      var ok = true;
      if (c.kind === 'ammo' && typeof GAMESTATE.useAmmo === 'function') ok = GAMESTATE.useAmmo(amt).success;
      else if (c.kind === 'battery' && typeof GAMESTATE.useBattery === 'function') ok = GAMESTATE.useBattery(amt).success;
      else if (c.kind === 'energy' && typeof GAMESTATE.useEnergy === 'function') ok = GAMESTATE.useEnergy(amt).success;
      else if (c.kind === 'focus' && typeof GAMESTATE.useFocus === 'function') { GAMESTATE.useFocus(amt); ok = true; }

      if (!ok) return { success: false, failed: c };
    }

    return { success: true };
  }

  // ── Public API ──
  return {
    stashCard: stashCard,
    retrieveCard: retrieveCard,
    equipItem: equipItem,
    unequipItem: unequipItem,
    consumeActiveItemIfMatches: consumeActiveItemIfMatches,
    consumeKeyFromInventory: consumeKeyFromInventory,
    consumeQuestItem: consumeQuestItem,
    consumeCosts: consumeCosts
  };
})();
