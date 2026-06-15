/**
 * LockedGateSystem – IIFE module (Delegate Pattern)
 *
 * Owns: nothing (stateless)
 * Handles: locked gate/door/chest detection, key validation,
 *          key consumption routing, gate unlocking + visual effects,
 *          and the top-level interaction dispatcher (interact command).
 *
 * Loaded before gone-rogue.js via <script> tag.
 */
var LockedGateSystem = (function () {
  'use strict';

  // ------------------------------------------------------------------
  // findAdjacentLockedGate — 4-directional scan from player position
  // ------------------------------------------------------------------
  function findAdjacentLockedGate(ctx) {
    var dirs = [
      { dx: 0, dy: -1 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 }
    ];

    for (var i = 0; i < dirs.length; i++) {
      var x = ctx.player.x + dirs[i].dx;
      var y = ctx.player.y + dirs[i].dy;
      var key = x + ',' + y;
      var meta = ctx.tileMetadata[key];
      if (meta && meta.type === 'locked_gate') {
        return { x: x, y: y, meta: meta };
      }
    }

    return null;
  }

  // ------------------------------------------------------------------
  // attemptUnlockLockedGate — validate key, consume, open tile, effects
  // ------------------------------------------------------------------
  function attemptUnlockLockedGate(gx, gy, meta, opts, ctx) {
    opts = opts || {};

    var required = meta.requiredKey || 'RUSTY_KEY';
    var accepts = meta.acceptsKeys || null;
    var playerKeys = ctx.getPlayerKeys();

    // Locked chest: multiple acceptable keys
    if (accepts && accepts.length) {
      var hasAny = false;
      for (var ai = 0; ai < accepts.length; ai++) {
        if (playerKeys.indexOf(accepts[ai]) !== -1) {
          required = accepts[ai];
          hasAny = true;
          break;
        }
      }
      if (!hasAny) {
        return {
          lines: [
            (meta.emoji || '🧰') + ' ' + (meta.name || 'LOCKED CHEST'),
            'LOCKED — NEEDS A KEY',
            ''],
          prompt: ctx.getPrompt(),
          stayActive: true
        };
      }
    } else {
      if (playerKeys.indexOf(required) === -1) {
        return {
          lines: [
            (meta.emoji || '🚪') + ' ' + (meta.name || 'LOCKED DOOR'),
            'LOCKED — REQUIRES KEY: ' + required,
            ''],
          prompt: ctx.getPrompt(),
          stayActive: true
        };
      }
    }

    // Tier-aware key consumption
    var keyTier = ctx.getKeyTier(required);
    if (keyTier >= 3) {
      return {
        lines: [
          (meta.emoji || '🚪') + ' ' + (meta.name || 'LOCKED DOOR'),
          'This lock requires a different key.',
          ''],
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    if (opts.consumeFromActiveSlot) {
      ctx.consumeActiveItemIfMatches(required);
    } else {
      ctx.consumeKeyFromInventory(required);
    }

    // If chest, spawn loot
    if (meta.type === 'locked_chest') {
      ctx.spawnCurrency(gx, gy, 12 + Math.floor(ctx.rng() * 10));

      if (typeof CardSystem !== 'undefined') {
        var baseType = CardSystem.getRandomBaseCard ? CardSystem.getRandomBaseCard() : null;
        if (baseType && CardSystem.rollCard) {
          var card = CardSystem.rollCard(baseType);
          if (card) {
            var chestCard = { x: gx, y: gy, type: 'card', card: card, spawnTime: Date.now(), decayTime: 30000 };
            if (typeof WorldItems !== 'undefined') { WorldItems.addItem(chestCard); } else { ctx.items.push(chestCard); }
          }
        }
      }
    }

    // Open the tile
    ctx.grid[gy][gx] = ctx.TILES.EMPTY;
    delete ctx.tileMetadata[gx + ',' + gy];
    ctx.rebuildWallCache();

    // Persist the unlock for floor revisits. Without this, regenerating
    // the floor (retreat/backtrack) re-stamps the gate LOCKED while the
    // key was already consumed — with the funnel walls sealed, a player
    // retreating from below would be permanently trapped behind it.
    try {
      if (typeof FloorStateTracker !== 'undefined' && ctx.getFloor) {
        var _unlockFloor = ctx.getFloor();
        FloorStateTracker.recordGateDestroyed(_unlockFloor, gx, gy, 'LOCKED_GATE');
        if (meta.positions && Array.isArray(meta.positions)) {
          meta.positions.forEach(function (pos) {
            FloorStateTracker.recordGateDestroyed(_unlockFloor, pos.x, pos.y, 'LOCKED_GATE');
          });
        }
      }
    } catch (eRecord) { /* persistence is best-effort */ }

    // POOF EFFECT
    try {
      var poofEffect = { x: gx, y: gy, type: 'poof', time: Date.now(), char: '💨' };
      ctx.impactEffects.push(poofEffect);
      setTimeout(function () {
        var idx = ctx.impactEffects.indexOf(poofEffect);
        if (idx > -1) ctx.impactEffects.splice(idx, 1);
      }, 400);
      if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
        OverheadAnimator.showGenericExpression(gx, gy, '💨', 800, '#AAAAAA');
      }
    } catch (ePoof) { /* visual only */ }

    // Multi-tile gate: poof ALL positions
    try {
      if (meta.positions && Array.isArray(meta.positions)) {
        meta.positions.forEach(function (pos) {
          if (pos.x === gx && pos.y === gy) return;
          ctx.grid[pos.y][pos.x] = ctx.TILES.EMPTY;
          delete ctx.tileMetadata[pos.x + ',' + pos.y];
          var mEffect = { x: pos.x, y: pos.y, type: 'poof', time: Date.now(), char: '💨' };
          ctx.impactEffects.push(mEffect);
          setTimeout(function () {
            var mi = ctx.impactEffects.indexOf(mEffect);
            if (mi > -1) ctx.impactEffects.splice(mi, 1);
          }, 400);
        });
        ctx.rebuildWallCache();
      }
    } catch (eMulti) { /* visual only */ }

    if (typeof TooltipSystem !== 'undefined') {
      TooltipSystem.show((meta.emoji || '🚪') + ' UNLOCKED', 1500);
    }

    if (typeof DebriefFeedController !== 'undefined') {
      var kind = (meta.type === 'locked_chest') ? 'chest' : 'gate';
      DebriefFeedController.showSynergyOverlay({
        kind: kind,
        keyEmoji: '🗝',
        gateEmoji: (meta.emoji || '🚪')
      });
      DebriefFeedController.flashIncinerator({ kind: 'key' });
    }

    if (ctx.updateMobileGrid) {
      ctx.updateMobileGrid();
    }

    ctx.saveState();

    return {
      lines: ['UNLOCKED: ' + (meta.emoji || '🚪') + ' ' + (meta.name || 'Door'), ''].concat(ctx.renderGrid()),
      prompt: ctx.getPrompt(),
      stayActive: true
    };
  }

  // ------------------------------------------------------------------
  // _findAdjacentNpc — scan 4 directions for an NPC
  // ------------------------------------------------------------------
  function _findAdjacentNpc(ctx) {
    var dirs = [
      { dx: 0, dy: -1 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 }
    ];
    for (var i = 0; i < dirs.length; i++) {
      var nx = ctx.player.x + dirs[i].dx;
      var ny = ctx.player.y + dirs[i].dy;
      for (var j = 0; j < ctx.npcs.length; j++) {
        if (ctx.npcs[j].x === nx && ctx.npcs[j].y === ny) {
          return ctx.npcs[j];
        }
      }
    }
    return null;
  }

  // ------------------------------------------------------------------
  // _handleNpcQuestTurnIn — deliver quest item to NPC
  // ------------------------------------------------------------------
  function _handleNpcQuestTurnIn(npc, ctx) {
    var questKeyType = npc.questItem;
    var npcTarget = npc.npcTarget || npc.id || '';
    var npcName = npc.name || npc.emoji || 'NPC';
    var npcEmoji = npc.emoji || '\uD83E\uDDD1';

    // Check if player has the quest item
    var consumed = null;
    if (typeof InventoryManagement !== 'undefined' && InventoryManagement.consumeQuestItem) {
      consumed = InventoryManagement.consumeQuestItem(questKeyType, npcTarget);
    } else if (ctx.consumeQuestItem) {
      consumed = ctx.consumeQuestItem(questKeyType, npcTarget);
    }

    if (!consumed) {
      // Player doesn't have the quest item
      console.log('[LockedGate] NPC ' + npcName + ' wants ' + questKeyType + ' but player does not have it');
      return {
        lines: [npcEmoji + ' ' + npcName + ': "Bring me the ' + (questKeyType.replace(/_/g, ' ').toLowerCase()) + ' and I can help you."'],
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    // Quest item delivered!
    console.log('[LockedGate] Quest turn-in: ' + questKeyType + ' delivered to ' + npcName);

    // Show overhead animation
    if (typeof OverheadAnimator !== 'undefined') {
      OverheadAnimator.showExpression(npc.x, npc.y, 'happy', 1500);
    }

    // Tooltip feedback
    if (typeof TooltipSystem !== 'undefined') {
      TooltipSystem.show(npcEmoji + ' ' + npcName + ' received ' + (consumed.emoji || '\uD83D\uDD28') + ' ' + (consumed.name || questKeyType), 2500);
    }

    // Update mobile grid
    if (ctx.updateMobileGrid) {
      ctx.updateMobileGrid();
    }

    // Refresh inventory display
    if (typeof GoneRogueMobile !== 'undefined' && GoneRogueMobile.showInventory) {
      GoneRogueMobile.showInventory();
    }

    return {
      lines: [
        npcEmoji + ' ' + npcName + ': "Excellent! You found it!"',
        (consumed.emoji || '\uD83D\uDD28') + ' ' + (consumed.name || questKeyType) + ' delivered.',
        '\u2728 Quest complete!'
      ],
      prompt: ctx.getPrompt(),
      stayActive: true
    };
  }

  // ------------------------------------------------------------------
  // handleInteraction — top-level interact command dispatcher
  // ------------------------------------------------------------------
  function handleInteraction(ctx) {
    // Check vent tile
    var playerTile = ctx.grid[ctx.player.y][ctx.player.x];
    if (playerTile === ctx.TILES.VENT) {
      return ctx.handleVentInteraction();
    }

    // Locked gates/doors
    var locked = findAdjacentLockedGate(ctx);
    if (locked) {
      return attemptUnlockLockedGate(locked.x, locked.y, locked.meta, {}, ctx);
    }

    // NPC quest turn-in: check if player is adjacent to an NPC with a questItem
    if (ctx.npcs && ctx.npcs.length) {
      var adjNpc = _findAdjacentNpc(ctx);
      if (adjNpc && adjNpc.questItem) {
        return _handleNpcQuestTurnIn(adjNpc, ctx);
      }
    }

    if (typeof InteractiveItems === 'undefined') {
      return { lines: ['Nothing to interact with'], prompt: ctx.getPrompt(), stayActive: true };
    }

    // Find nearest interactive item
    var nearestItem = InteractiveItems.getNearestItem(ctx.player.x, ctx.player.y);
    if (!nearestItem) {
      return { lines: ['Nothing nearby to interact with'], prompt: ctx.getPrompt(), stayActive: true };
    }

    if (!InteractiveItems.canInteractWith(ctx.player.x, ctx.player.y, nearestItem)) {
      return { lines: ['Too far away to interact'], prompt: ctx.getPrompt(), stayActive: true };
    }

    var result = InteractiveItems.interact(nearestItem, ctx.player);

    if (result.success) {
      if (result.animation && typeof OverheadAnimator !== 'undefined') {
        OverheadAnimator.showExpression(
          ctx.player.x, ctx.player.y,
          result.animation.expressionKey,
          result.animation.duration
        );
      }
      if (result.tooltip && typeof TooltipSystem !== 'undefined') {
        TooltipSystem.show(result.tooltip.message, result.tooltip.duration);
      }
      return {
        lines: ['Interacted with ' + nearestItem.name, '', nearestItem.text],
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    return { lines: ['Cannot interact with that'], prompt: ctx.getPrompt(), stayActive: true };
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------
  return {
    findAdjacentLockedGate: findAdjacentLockedGate,
    attemptUnlockLockedGate: attemptUnlockLockedGate,
    handleInteraction: handleInteraction
  };
})();
