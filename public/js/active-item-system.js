/**
 * ActiveItemSystem – IIFE module (Delegate Pattern)
 *
 * Owns: nothing (stateless)
 * Handles: triggering active items, drag/drop item targeting,
 *          non-combat card ground deployment, item-to-ground interaction
 *          resolution (lighter/water/tazer/medkit).
 *
 * Loaded before gone-rogue.js via <script> tag.
 */
var ActiveItemSystem = (function () {
  'use strict';

  // ------------------------------------------------------------------
  // triggerActiveItem — use equipped item on player tile + adjacents
  // ------------------------------------------------------------------
  function triggerActiveItem(ctx) {
    if (typeof GAMESTATE === 'undefined') {
      return {
        lines: ['GAMESTATE UNAVAILABLE'],
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    var activeItem = GAMESTATE.getActiveItem();
    if (!activeItem) {
      return {
        lines: ['NO ACTIVE ITEM', 'Equip an item from inventory first'],
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    // Keys: find adjacent locked gate
    if (activeItem.type === 'key') {
      var locked = ctx.findAdjacentLockedGate();
      if (locked) {
        return ctx.attemptUnlockLockedGate(locked.x, locked.y, locked.meta, { consumeFromActiveSlot: true });
      }

      return {
        lines: ['🗝 NO LOCK IN RANGE', 'Stand next to a door/chest to use a key.', ''].concat(ctx.renderGrid()),
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    // Determine targeting: player tile + adjacent tiles
    var targetTiles = [
      { x: ctx.player.x, y: ctx.player.y },
      { x: ctx.player.x + 1, y: ctx.player.y },
      { x: ctx.player.x - 1, y: ctx.player.y },
      { x: ctx.player.x, y: ctx.player.y + 1 },
      { x: ctx.player.x, y: ctx.player.y - 1 }
    ];

    var result = resolveGroundInteraction(activeItem, targetTiles, ctx);

    if (ctx.updateMobileGrid) {
      ctx.updateMobileGrid();
    }

    return result;
  }

  // ------------------------------------------------------------------
  // useActiveItemAt — drag/drop targeting at specific grid position
  // ------------------------------------------------------------------
  function useActiveItemAt(targetX, targetY, ctx) {
    if (typeof GAMESTATE === 'undefined') return;

    var activeItem = GAMESTATE.getActiveItem ? GAMESTATE.getActiveItem() : null;
    if (!activeItem) {
      return {
        lines: ['NO ACTIVE ITEM', 'Equip an item first', ''].concat(ctx.renderGrid()),
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    // Keys: resolve lock near target, enforce player proximity
    if (activeItem.type === 'key') {
      var lock = findLockedGateNearTarget(targetX, targetY, 1, ctx);
      if (!lock) {
        return {
          lines: ['NO LOCK AT TARGET', 'Drag onto a door/chest tile to use a key.', ''].concat(ctx.renderGrid()),
          prompt: ctx.getPrompt(),
          stayActive: true
        };
      }

      var dist = Math.abs(lock.x - ctx.player.x) + Math.abs(lock.y - ctx.player.y);
      if (dist > 1) {
        return {
          lines: ['TOO FAR', 'Stand next to the lock to use a key.', ''].concat(ctx.renderGrid()),
          prompt: ctx.getPrompt(),
          stayActive: true
        };
      }

      return ctx.attemptUnlockLockedGate(lock.x, lock.y, lock.meta, { consumeFromActiveSlot: true });
    }

    // Non-key items: fall back to triggerActiveItem
    return triggerActiveItem(ctx);
  }

  // ------------------------------------------------------------------
  // applyNonCombatCardAt — deploy card ground effect at target
  // ------------------------------------------------------------------
  function applyNonCombatCardAt(cardId, targetX, targetY, ctx) {
    if (!ctx.active) return false;

    if (typeof GoneRogueDataRegistry === 'undefined' || !GoneRogueDataRegistry.getCard) {
      return false;
    }

    var card = GoneRogueDataRegistry.getCard(cardId);
    if (!card || card._missing) {
      if (typeof TooltipSystem !== 'undefined') {
        TooltipSystem.showPersistent('❌ Missing card: ' + cardId, 1200);
      }
      return false;
    }

    if ((card.targetType === 'ground' || card.targetType === 'area') && card.groundEffectId) {
      if (typeof GroundEffects !== 'undefined' && GroundEffects.setGroundEffect) {
        GroundEffects.setGroundEffect(targetX, targetY, card.groundEffectId.replace('EFF-', ''));
        if (ctx.updateMobileGrid) {
          ctx.updateMobileGrid();
        }
        if (typeof TooltipSystem !== 'undefined') {
          TooltipSystem.showPersistent('🟢 DEPLOYED: ' + (card.emoji || '🃏') + ' ' + card.name, 900);
        }
        return true;
      }
    }

    if (typeof TooltipSystem !== 'undefined') {
      TooltipSystem.showPersistent('ℹ️ ' + (card.emoji || '🃏') + ' ' + card.name + ' (no non-combat resolver yet)', 1200);
    }

    return false;
  }

  // ------------------------------------------------------------------
  // findLockedGateNearTarget — radius-based locked gate search
  // ------------------------------------------------------------------
  function findLockedGateNearTarget(tx, ty, radius, ctx) {
    radius = (typeof radius === 'number') ? radius : 1;
    for (var dy = -radius; dy <= radius; dy++) {
      for (var dx = -radius; dx <= radius; dx++) {
        var x = tx + dx;
        var y = ty + dy;
        var key = x + ',' + y;
        var meta = ctx.tileMetadata[key];
        if (meta && meta.type === 'locked_gate') {
          return { x: x, y: y, meta: meta };
        }
      }
    }
    return null;
  }

  // ------------------------------------------------------------------
  // resolveGroundInteraction — item effect on ground tiles
  // ------------------------------------------------------------------
  function resolveGroundInteraction(item, tiles, ctx) {
    if (!item || !tiles || typeof GroundEffects === 'undefined') {
      return {
        lines: ['CANNOT USE ITEM HERE'],
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    var itemName = item.name ? item.name.toLowerCase() : '';
    var messages = [];
    var effectApplied = false;

    // LIGHTER: Ignite flammable surfaces (oil)
    if (itemName.indexOf('lighter') !== -1 || itemName.indexOf('🔥') !== -1) {
      for (var i = 0; i < tiles.length; i++) {
        var tile = tiles[i];
        if (tile.x < 0 || tile.x >= GRID_WIDTH || tile.y < 0 || tile.y >= GRID_HEIGHT) continue;

        var groundEffect = GroundEffects.getGroundEffect(tile.x, tile.y);
        if (groundEffect && groundEffect.canIgnite) {
          GroundEffects.igniteOil(tile.x, tile.y);
          messages.push('🔥 IGNITED OIL at (' + tile.x + ',' + tile.y + ')');
          effectApplied = true;
        } else if (!groundEffect || groundEffect.type === 'normal') {
          GroundEffects.setGroundEffect(tile.x, tile.y, 'FIRE');
          messages.push('🔥 LIT FIRE at (' + tile.x + ',' + tile.y + ')');
          effectApplied = true;
        }
      }
      if (!effectApplied) {
        messages.push('💡 LIGHTER: No flammable surfaces nearby');
      }
    }
    // WATER BOTTLE: Extinguish fire, create water
    else if (itemName.indexOf('water') !== -1 || itemName.indexOf('bottle') !== -1 || itemName.indexOf('💧') !== -1) {
      for (var i = 0; i < tiles.length; i++) {
        var tile = tiles[i];
        if (tile.x < 0 || tile.x >= GRID_WIDTH || tile.y < 0 || tile.y >= GRID_HEIGHT) continue;

        var groundEffect = GroundEffects.getGroundEffect(tile.x, tile.y);
        if (groundEffect && (groundEffect.type === 'FIRE' || groundEffect.type === 'OIL_IGNITED')) {
          GroundEffects.extinguishFire(tile.x, tile.y);
          messages.push('💧 EXTINGUISHED FIRE at (' + tile.x + ',' + tile.y + ')');
          effectApplied = true;
        } else if (!groundEffect || groundEffect.type === 'normal') {
          GroundEffects.setGroundEffect(tile.x, tile.y, 'WATER');
          messages.push('💧 WATER SPILLED at (' + tile.x + ',' + tile.y + ')');
          effectApplied = true;
        }
      }
      if (!effectApplied) {
        messages.push('💧 WATER: No fires to extinguish');
      }
    }
    // TAZER/SHOCK: Electrify conductive surfaces
    else if (itemName.indexOf('tazer') !== -1 || itemName.indexOf('taser') !== -1 ||
             itemName.indexOf('shock') !== -1 || itemName.indexOf('⚡') !== -1) {
      for (var i = 0; i < tiles.length; i++) {
        var tile = tiles[i];
        if (tile.x < 0 || tile.x >= GRID_WIDTH || tile.y < 0 || tile.y >= GRID_HEIGHT) continue;

        var groundEffect = GroundEffects.getGroundEffect(tile.x, tile.y);
        if (groundEffect && (groundEffect.type === 'WATER' || groundEffect.conductive)) {
          ctx.electrifyWater(tile.x, tile.y, 2);
          messages.push('⚡ ELECTRIFIED WATER at (' + tile.x + ',' + tile.y + ')');
          effectApplied = true;
        }
      }
      if (!effectApplied) {
        messages.push('⚡ TAZER: No conductive surfaces nearby');
      }
    }
    // HEALING ITEMS: Restore HP
    else if (itemName.indexOf('medkit') !== -1 || itemName.indexOf('bandage') !== -1 ||
             itemName.indexOf('heal') !== -1 || itemName.indexOf('💊') !== -1) {
      var healAmount = 20 + Math.floor(ctx.rng() * 11);
      ctx.player.hp = Math.min(ctx.player.hp + healAmount, ctx.player.maxHp);
      messages.push('💊 HEALED: +' + healAmount + ' HP');
      messages.push('HP: ' + ctx.player.hp + '/' + ctx.player.maxHp);
      effectApplied = true;
    }
    // DEFAULT: Passive item
    else {
      messages.push('📦 ' + item.emoji + ' ' + item.name);
      messages.push('This item provides passive benefits while equipped');
      effectApplied = true;
    }

    if (messages.length === 0) {
      messages.push('ITEM USED: ' + item.name);
    }

    return {
      lines: messages.concat(['']).concat(ctx.renderGrid()),
      prompt: ctx.getPrompt(),
      stayActive: true
    };
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------
  return {
    triggerActiveItem: triggerActiveItem,
    useActiveItemAt: useActiveItemAt,
    applyNonCombatCardAt: applyNonCombatCardAt,
    findLockedGateNearTarget: findLockedGateNearTarget
  };
})();
