/**
 * PickupSystem — item pickup logic for ammo, gems, cards, keys, and generic items.
 * Extracted Phase 15 from gone-rogue.js.
 * Stateless IIFE module — all mutable state via ctx references.
 */
var PickupSystem = (function() {
  'use strict';

  /**
   * Attempt to pick up an item at the player's position.
   * @param {Object} ctx - Context from monolith
   * @returns {Object} { lines, prompt, stayActive }
   */
  function pickupItem(ctx) {
    var item = ctx.items.find(function(i) { return i.x === ctx.player.x && i.y === ctx.player.y; });
    if (!item) {
      return {
        lines: ['NO ITEM HERE', ''].concat(ctx.renderGrid()),
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    // Handle ammo pickup (auto-collect)
    if (item.type === 'ammo') {
      return _pickupAmmo(item, ctx);
    }

    // Handle gem pickup — restores battery resource
    if (item.type === 'gem') {
      return _pickupGem(item, ctx);
    }

    // Check if item is a card (attack/support) or regular item
    var isCard = item.card && (item.card.type === 'attack' || item.card.type === 'support');

    // Normalize non-card pickups
    var nonCardPayload = item.card;
    if (!isCard) {
      if (item.type === 'key') {
        nonCardPayload = _buildKeyPayload(item, ctx);
      } else if (!nonCardPayload) {
        nonCardPayload = {
          type: item.type || 'item',
          emoji: item.emoji || '\uD83D\uDCE6', // 📦
          name: item.name || 'Item',
          description: item.description || ''
        };
      }
    }

    // Add to appropriate inventory
    var result = { success: true, message: 'Item picked up' };
    var keyTier = (nonCardPayload && nonCardPayload.tier) ? nonCardPayload.tier : 0;

    if (typeof GAMESTATE !== 'undefined') {
      result = _addToInventory(item, isCard, nonCardPayload, keyTier, ctx);

      // KEY COUNTER: Increment structured key counter on successful pickup
      if (item.type === 'key' && result && result.success) {
        _incrementKeyCounter(item, nonCardPayload, keyTier);
      }

      // KEY PICKUP ENHANCEMENTS — behavior varies by tier
      if (item.type === 'key' && result && result.success) {
        _handleKeyPickupEnhancements(item, nonCardPayload, keyTier);
      }

      if (!result.success) {
        return {
          lines: [result.message, 'DROP SOMETHING FIRST', ''].concat(ctx.renderGrid()),
          prompt: ctx.getPrompt(),
          stayActive: true
        };
      }

      // Show where card was added (hand vs action buttons)
      if (isCard && result.location) {
        var locationMsg = result.location === 'hand' ? '[Added to HAND]' : '[Added to ACTION BUTTONS]';
        ctx.setLastPickupMessage(locationMsg);
      }
    }

    // Remove item from floor
    ctx.filterItems(item);

    // Tooltip: Item/card pickup
    _showPickupTooltip(item, isCard, nonCardPayload, keyTier);

    var pickupEmoji = (item.card && item.card.emoji) ? item.card.emoji : (item.emoji || (item.type === 'key' ? '\uD83D\uDD11' : '\uD83D\uDCE6')); // 🔑 📦
    var pickupDisplayName = (item.card && item.card.name) ? item.card.name : (item.name || 'Item');
    var pickupQuality = (item.card && item.card.qualityName) ? ' [' + item.card.qualityName + ']'
      : (item.type === 'key' && keyTier <= 1 ? ' [KEY AMMO]' : (item.type === 'key' ? ' [KEY ITEM]' : ''));

    // NOTE: No UIControls.updateMokInterjection here. Single-tooltip-per-pickup
    // doctrine: _showPickupTooltip (cards/items) and _handleKeyPickupEnhancements
    // (keys) each fire exactly ONE TooltipSystem call. reportResourceChange handles
    // debrief feed flash + row highlight without touching the MOK tooltip line.

    return {
      lines: ['PICKED UP: ' + pickupEmoji + ' ' + pickupDisplayName + pickupQuality, ''].concat(ctx.renderGrid()),
      prompt: ctx.getPrompt(),
      stayActive: true
    };
  }

  // ── Ammo Pickup ──

  function _pickupAmmo(item, ctx) {
    if (typeof GAMESTATE !== 'undefined') {
      GAMESTATE.addAmmo(item.amount);
    }

    ctx.filterItems(item);

    // Single canonical tooltip for ammo pickup
    if (typeof TooltipSystem !== 'undefined') {
      TooltipSystem.showAction('item-pickup', { name: '\u204D Ammo +' + item.amount });
    }

    // Overhead animation with RESOURCE_COLOR magenta
    if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
      OverheadAnimator.showGenericExpression(ctx.player.x, ctx.player.y, '\u204D', 800, '#DA70D6');
    }

    // Report to debrief feed
    try {
      if (typeof DebriefFeedController !== 'undefined' && DebriefFeedController.reportResourceChange) {
        var newAmmo = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getAmmo) ? GAMESTATE.getAmmo() : 0;
        DebriefFeedController.reportResourceChange('Ammo', newAmmo - item.amount, newAmmo, 'Ammo +' + item.amount);
      }
    } catch (eDebrief) {}

    // NOTE: No PancakeStack call — single pickup = single OverheadAnimator animation only.
    // PancakeStack activates only when multiple animations need simultaneous display.

    return {
      lines: ['PICKED UP: \u204D Ammo +' + item.amount, ''].concat(ctx.renderGrid()),
      prompt: ctx.getPrompt(),
      stayActive: true
    };
  }

  // ── Gem Pickup ──

  function _pickupGem(item, ctx) {
    var gemAmount = item.amount || 1;

    if (typeof GAMESTATE !== 'undefined' && GAMESTATE.rechargeBattery) {
      GAMESTATE.rechargeBattery(gemAmount);
    }

    ctx.filterItems(item);

    if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
      OverheadAnimator.showGenericExpression(ctx.player.x, ctx.player.y, '\u25C8', 800, '#00FFA6');
    }

    try {
      if (typeof DebriefFeedController !== 'undefined' && DebriefFeedController.reportResourceChange) {
        var newBattery = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getBattery) ? GAMESTATE.getBattery() : 0;
        DebriefFeedController.reportResourceChange('Battery', newBattery - gemAmount, newBattery, '\u25C8 Battery +' + gemAmount);
      }
    } catch (eDebrief) {}

    // Single canonical tooltip for battery pickup
    if (typeof TooltipSystem !== 'undefined') {
      TooltipSystem.showAction('item-pickup', { name: '\u25C8 Battery +' + gemAmount });
    }

    // NOTE: No PancakeStack call — single pickup = single OverheadAnimator animation only.
    // PancakeStack activates only when multiple animations need simultaneous display.

    try {
      if (typeof DebriefFeedController !== 'undefined' && DebriefFeedController.triggerBatteryRecharge) {
        DebriefFeedController.triggerBatteryRecharge();
      }
    } catch (eDebrief) {}

    return {
      lines: ['PICKED UP: \u25C8 Battery +' + gemAmount, ''].concat(ctx.renderGrid()),
      prompt: ctx.getPrompt(),
      stayActive: true
    };
  }

  // ── Key Payload Builder ──

  function _buildKeyPayload(item, ctx) {
    var payload = {
      type: 'key',
      keyType: item.keyType || item.itemId || 'UNKNOWN_KEY',
      emoji: item.emoji || '\uD83D\uDDDD', // 🗝
      name: item.name || 'Key',
      description: item.description || '',
      tier: item.tier || 1,
      subtype: item.subtype || null,
      npcTarget: item.npcTarget || null
    };

    // Resolve full definition from items.json registry
    try {
      if (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.listItems) {
        var allItems = GoneRogueDataRegistry.listItems();
        var registryDef = null;

        if (item.registryId) {
          registryDef = GoneRogueDataRegistry.getItem(item.registryId);
          if (registryDef && registryDef._missing) registryDef = null;
        }

        if (!registryDef) {
          var targetName = (item.name || '').toLowerCase();
          for (var ri = 0; ri < allItems.length; ri++) {
            if (allItems[ri] && (allItems[ri].name || '').toLowerCase() === targetName && allItems[ri].type === 'key') {
              registryDef = allItems[ri];
              break;
            }
          }
        }

        if (!registryDef && payload.keyType) {
          var heuristicName = payload.keyType.toLowerCase().replace(/_/g, ' ');
          for (var ri2 = 0; ri2 < allItems.length; ri2++) {
            var candidateName = (allItems[ri2].name || '').toLowerCase().replace(/[^a-z0-9 ]/g, '');
            if (candidateName.indexOf(heuristicName) >= 0 && allItems[ri2].type === 'key') {
              registryDef = allItems[ri2];
              break;
            }
          }
        }

        if (registryDef && !registryDef._missing) {
          payload.registryId = registryDef.id || null;
          if (!payload.description && registryDef.description) payload.description = registryDef.description;
          if (!payload.effects && registryDef.effects) payload.effects = registryDef.effects;
          if (!payload.rarity) payload.rarity = registryDef.rarity || null;
          if (!payload.synergyTags && registryDef.synergyTags) payload.synergyTags = registryDef.synergyTags;
          if (!payload.npcTarget && registryDef.effects) {
            for (var ei2 = 0; ei2 < registryDef.effects.length; ei2++) {
              if (registryDef.effects[ei2] && registryDef.effects[ei2].npcTarget) {
                payload.npcTarget = registryDef.effects[ei2].npcTarget;
                break;
              }
            }
          }
          if (registryDef.tier) payload.tier = registryDef.tier;
          if (registryDef.equipSlot) payload.equipSlot = registryDef.equipSlot;
          if (registryDef.consumeOnUse !== undefined) payload.consumeOnUse = registryDef.consumeOnUse;
          console.log('[GoneRogue] Key item resolved from registry:', registryDef.id, registryDef.name);
        }
      }
    } catch (eResolve) {
      console.warn('[GoneRogue] Key item registry resolve error:', eResolve);
    }

    // Resolve tier from EnvironmentalSynergy if still not set
    if (!item.tier && !payload.tier && typeof EnvironmentalSynergy !== 'undefined' && EnvironmentalSynergy.getKeyDefinitions) {
      try {
        var keyDefs = EnvironmentalSynergy.getKeyDefinitions();
        var kt = (payload.keyType || '').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
        if (keyDefs[kt] && keyDefs[kt].tier) {
          payload.tier = keyDefs[kt].tier;
        }
      } catch (eTier) {}
    }

    // Set qualityName for display
    var tierNames = { 1: 'Ammo Key', 2: 'Gate Key', 3: 'Quest Item' };
    payload.qualityName = tierNames[payload.tier] || 'Key';

    return payload;
  }

  // ── Inventory Addition ──

  function _addToInventory(item, isCard, nonCardPayload, keyTier, ctx) {
    var result;

    if (isCard) {
      result = GAMESTATE.addCard(item.card);
      // NOTE: No PancakeStack call — single pickup = single OverheadAnimator animation only.
      // Overhead animation: monochrome card symbol in Cards purple
      try {
        if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
          OverheadAnimator.showGenericExpression(ctx.player.x, ctx.player.y, '\uD83C\uDCA0', 800, '#800080'); // 🂠
        }
      } catch (eCardOH) {}
      // Report card pickup to debrief feed
      try {
        if (typeof DebriefFeedController !== 'undefined' && DebriefFeedController.reportResourceChange) {
          var cardName = (item.card && item.card.name) ? item.card.name : 'Card';
          DebriefFeedController.reportResourceChange('Cards', 0, 1, '\uD83C\uDCA0 ' + cardName);
        }
      } catch (eCardDebrief) {}
    } else if (item.type === 'key' && keyTier >= 2) {
      if (GAMESTATE.addToPersistent) {
        result = GAMESTATE.addToPersistent(nonCardPayload);
      } else {
        result = GAMESTATE.addToLoose(nonCardPayload);
      }
    } else if (item.type === 'key') {
      result = { success: true, message: 'Key ammo counted' };
    } else {
      result = { success: true, message: 'Item picked up' };
    }

    return result;
  }

  // ── Key Counter ──

  function _incrementKeyCounter(item, nonCardPayload, keyTier) {
    try {
      if (GAMESTATE.addKeyCount) {
        var countKeyType = nonCardPayload.keyType || item.keyType || item.itemId || 'UNKNOWN';
        var oldKeyAmmoTotal = (keyTier <= 1 && GAMESTATE.getTotalKeyAmmo) ? GAMESTATE.getTotalKeyAmmo() : 0;
        GAMESTATE.addKeyCount(countKeyType, keyTier || 1);
        if (keyTier <= 1) {
          try {
            var newKeyAmmoTotal = GAMESTATE.getTotalKeyAmmo ? GAMESTATE.getTotalKeyAmmo() : oldKeyAmmoTotal + 1;
            if (typeof DebriefFeedController !== 'undefined' && DebriefFeedController.reportResourceChange) {
              DebriefFeedController.reportResourceChange('key_ammo', oldKeyAmmoTotal, newKeyAmmoTotal, nonCardPayload.name || item.name || 'Key');
            }
          } catch (eKAReport) {}
        }
      }
    } catch (eKeyCount) {}
  }

  // ── Key Pickup Enhancements ──

  function _handleKeyPickupEnhancements(item, nonCardPayload, keyTier) {
    if (keyTier >= 2 && keyTier < 3) {
      // TIER 2 (gate key): overhead stacker animation + auto-equip to active slot
      try {
        if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
          OverheadAnimator.showGenericExpression(item.x, item.y, item.emoji || '\uD83D\uDD11', 1200, '#FFD700'); // 🔑
        }
        // NOTE: No PancakeStack — single pickup = single OverheadAnimator animation only.
      } catch (eAnim) {}

      try {
        if (GAMESTATE.setActiveItem) {
          GAMESTATE.setActiveItem(nonCardPayload);
          if (typeof UIControls !== 'undefined' && UIControls.setActiveItem) {
            UIControls.setActiveItem(nonCardPayload);
          }
          if (typeof TooltipSystem !== 'undefined') {
            TooltipSystem.show('\uD83D\uDD11 KEY EQUIPPED \u2014 Tap header icon near the gate!', 2500);
          }
        }
      } catch (eEquip) {}

    } else if (keyTier >= 3) {
      // TIER 3 (quest key): special overhead animation, NO auto-equip, quest tooltip
      try {
        if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
          OverheadAnimator.showGenericExpression(item.x, item.y, '\u2757', 1500, '#FF4444'); // ❗
        }
        // NOTE: No PancakeStack — single pickup = single OverheadAnimator animation only.
      } catch (eAnim) {}

      try {
        var npcTarget = nonCardPayload.npcTarget || item.npcTarget || '';
        if (!npcTarget && nonCardPayload.effects && nonCardPayload.effects.length) {
          for (var ei = 0; ei < nonCardPayload.effects.length; ei++) {
            if (nonCardPayload.effects[ei] && nonCardPayload.effects[ei].npcTarget) {
              npcTarget = nonCardPayload.effects[ei].npcTarget;
              break;
            }
          }
        }
        if (typeof TooltipSystem !== 'undefined') {
          var questMsg = '\u2757 QUEST ITEM \u2014 ' + (nonCardPayload.name || item.name || 'Item');
          if (npcTarget) questMsg += ' \u2014 Return to ' + npcTarget;
          TooltipSystem.show(questMsg, 3500);
        }
      } catch (eQuest) {}
    } else {
      // TIER 1 (ammo key / low-tier key): overhead + tooltip
      try {
        if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
          OverheadAnimator.showGenericExpression(item.x, item.y, item.emoji || '\uD83D\uDDDD', 800, '#FF8A3D'); // 🗝
        }
        // NOTE: No PancakeStack — single pickup = single OverheadAnimator animation only.
      } catch (eAnim) {}
      // Tooltip for Tier 1 (Tier 2/3 handle their own tooltips above)
      try {
        if (typeof TooltipSystem !== 'undefined') {
          var t1Name = (nonCardPayload && nonCardPayload.name) ? nonCardPayload.name : (item.name || 'Key');
          TooltipSystem.showAction('key-ammo-pickup', { name: t1Name });
        }
      } catch (eTooltip) {}
    }
  }

  // ── Tooltip ──

  function _showPickupTooltip(item, isCard, nonCardPayload, keyTier) {
    if (typeof TooltipSystem === 'undefined') return;

    if (item.card && (item.card.type === 'attack' || item.card.type === 'support')) {
      TooltipSystem.showAction('card-pickup', { name: item.card.name });
    } else if (item.type === 'key') {
      // Keys handled by _handleKeyPickupEnhancements (Tier 2/3 tooltip)
      // and _incrementKeyCounter → reportResourceChange (Tier 1 debrief+MOK).
      // No additional tooltip here — prevents duplicate tooltip/MOK fire.
      return;
    } else {
      var nm3 = (item.card && item.card.name) ? item.card.name : (item.name || 'Item');
      TooltipSystem.showAction('item-pickup', { name: nm3 });
    }
  }

  return {
    pickupItem: pickupItem
  };
})();
