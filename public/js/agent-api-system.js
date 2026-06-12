/**
 * AgentAPISystem — headless agent API: getLegalActions + applyAction.
 * Extracted Phase 21 from gone-rogue.js.
 * Stateless IIFE module — all mutable state via ctx references.
 */
var AgentAPISystem = (function() {
  'use strict';

  /**
   * Get all legal actions the agent can take in the current state.
   * @param {Object} ctx - Context from monolith
   * @returns {Array} Array of action objects
   */
  function getLegalActions(ctx) {
    if (!ctx.active) {
      return [];
    }

    // Re-sync floor items from WorldItems — the monolith's _items snapshot
    // only refreshes on game ticks, so freshly-spawned loot (e.g. the 400ms
    // delayed breakable drops) would otherwise be invisible to the agent.
    if (typeof WorldItems !== 'undefined') {
      if (WorldItems.getFloorItems) ctx.items = WorldItems.getFloorItems();
      if (WorldItems.getCurrencies) ctx.currencies = WorldItems.getCurrencies();
    }

    var actions = [];
    var player = ctx.player;

    // During STR combat, only card actions are legal.
    // The combat hand lives in CardStateAuthority (hand of CardRefs) — NOT
    // player.deck (legacy, usually empty). Play via cardId.
    if (ctx.strCombatActive) {
      var hand = [];
      if (typeof CardStateAuthority !== 'undefined' && CardStateAuthority.getHand) {
        hand = CardStateAuthority.getHand() || [];
      }
      if (hand.length > 0) {
        hand.forEach(function(ref, index) {
          var def = null;
          try {
            if (CardStateAuthority.hydrateCard) def = CardStateAuthority.hydrateCard(ref);
          } catch (eHyd) {}
          actions.push({
            type: 'useCard',
            cardIndex: index,
            cardId: ref.id,
            card: def ? { id: def.id, name: def.name, emoji: def.emoji, cost: def.cost, effects: def.effects } : { id: ref.id }
          });
        });
      } else if (player.deck && player.deck.length > 0) {
        // Legacy fallback
        player.deck.forEach(function(card, index) {
          actions.push({
            type: 'useCard',
            cardIndex: index,
            card: card
          });
        });
      }
      actions.push({ type: 'flee' });
      return actions;
    }

    // Movement actions (check each direction)
    var directions = [
      { dx: 0, dy: -1, name: 'north', cmd: 'n' },
      { dx: 0, dy: 1, name: 'south', cmd: 's' },
      { dx: 1, dy: 0, name: 'east', cmd: 'e' },
      { dx: -1, dy: 0, name: 'west', cmd: 'w' }
    ];

    var grid = ctx.grid;
    var TILES = ctx.TILES;

    directions.forEach(function(dir) {
      var newX = player.x + dir.dx;
      var newY = player.y + dir.dy;

      if (newX >= 0 && newX < ctx.GRID_WIDTH && newY >= 0 && newY < ctx.GRID_HEIGHT) {
        var tile = grid[newY][newX];
        if (tile !== TILES.WALL) {
          actions.push({
            type: 'move',
            direction: dir.name,
            dx: dir.dx,
            dy: dir.dy,
            cmd: dir.cmd,
            targetX: newX,
            targetY: newY
          });
        }
      }
    });

    // Item pickup actions
    ctx.items.forEach(function(item) {
      if (item.x === player.x && item.y === player.y) {
        actions.push({
          type: 'pickup',
          item: item
        });
      }
    });

    // Currency pickup actions
    ctx.currencies.forEach(function(currency) {
      if (currency.x === player.x && currency.y === player.y) {
        actions.push({
          type: 'pickupCurrency',
          amount: currency.amount
        });
      }
    });

    // Exit action (if on exit tile)
    if (grid[player.y][player.x] === TILES.EXIT) {
      actions.push({ type: 'exit' });
    }

    // Kick actions — one per live breakable in the 4 adjacent tiles.
    // Kick is the always-available breakable attack (no ammo dependency);
    // mirrors the terminal `KICK <dir>` command.
    if (typeof ctx.getBreakableAt === 'function') {
      directions.forEach(function(dir) {
        var bx = player.x + dir.dx;
        var by = player.y + dir.dy;
        var b = ctx.getBreakableAt(bx, by);
        if (b && b.hp > 0) {
          actions.push({
            type: 'kick',
            direction: dir.name,
            dx: dir.dx,
            dy: dir.dy,
            targetX: bx,
            targetY: by,
            breakable: { name: b.name, emoji: b.emoji, hp: b.hp, maxHp: b.maxHp }
          });
        }
      });
    }

    // Shoot actions — ranged breakable/enemy attack (consumes ammo; may
    // misfire when empty). Mirrors the terminal `SHOOT <dir>` command.
    directions.forEach(function(dir) {
      actions.push({
        type: 'shoot',
        direction: dir.name,
        dx: dir.dx,
        dy: dir.dy
      });
    });

    // Interact action — locked gates/chests, vents, signs, NPC quest
    // turn-ins. Offered when something interactable is detectably adjacent;
    // mirrors the terminal `INTERACT` command.
    var canInteract = false;
    if (ctx.tileMetadata) {
      var adjDirs = [{dx:0,dy:-1},{dx:1,dy:0},{dx:0,dy:1},{dx:-1,dy:0}];
      for (var ai = 0; ai < adjDirs.length; ai++) {
        var md = ctx.tileMetadata[(player.x + adjDirs[ai].dx) + ',' + (player.y + adjDirs[ai].dy)];
        if (md && (md.type === 'locked_gate' || md.type === 'locked_chest')) { canInteract = true; break; }
      }
    }
    if (!canInteract && grid[player.y][player.x] === TILES.VENT) canInteract = true;
    if (!canInteract && typeof InteractiveItems !== 'undefined' && InteractiveItems.getNearestItem) {
      var near = InteractiveItems.getNearestItem(player.x, player.y);
      if (near && InteractiveItems.canInteractWith && InteractiveItems.canInteractWith(player.x, player.y, near)) {
        canInteract = true;
      }
    }
    if (canInteract) {
      actions.push({ type: 'interact' });
    }

    // Active item use
    if (player.activeItem) {
      actions.push({
        type: 'useActiveItem',
        item: player.activeItem
      });
    }

    // Wait/pass action (always available)
    actions.push({ type: 'wait' });

    return actions;
  }

  /**
   * Apply an action to the game state (headless mode).
   * @param {Object} action - Action object from getLegalActions()
   * @param {Object} ctx - Context from monolith
   * @returns {Object} Result with success flag and new state
   */
  function applyAction(action, ctx) {
    if (!ctx.active) {
      return {
        success: false,
        reason: 'Game not active',
        state: null
      };
    }

    var result = {
      success: false,
      reason: '',
      state: null,
      messages: []
    };

    try {
      if (action.type === 'move') {
        var moveResult = ctx.movePlayer(action.dx, action.dy, false);
        result.success = true;
        result.messages = moveResult.lines || [];
        result.state = ctx.getState();
      }
      else if (action.type === 'useCard' && ctx.strCombatActive) {
        var cardResult;
        if (action.cardId && typeof ctx.playCardFromHand === 'function') {
          // Canonical combat play path (CardStateAuthority hand by id)
          cardResult = ctx.playCardFromHand(action.cardId);
          result.success = !!(cardResult && cardResult.success !== false);
          result.messages = (cardResult && cardResult.lines) || [];
        } else {
          // Legacy swipe path (loose-inventory index)
          cardResult = ctx.handleCardSwipe(action.cardIndex, 'up');
          result.success = true;
          result.messages = (cardResult && cardResult.lines) || [];
        }
        result.state = ctx.getState();
      }
      else if (action.type === 'flee' && ctx.strCombatActive) {
        var fleeResult = ctx.process('flee');
        result.success = true;
        result.messages = fleeResult.lines || [];
        result.state = ctx.getState();
      }
      else if (action.type === 'pickup') {
        var pickupResult = ctx.process('pickup');
        result.success = true;
        result.messages = pickupResult.lines || [];
        result.state = ctx.getState();
      }
      else if (action.type === 'pickupCurrency') {
        result.success = true;
        result.messages = ['Picked up ' + action.amount + ' credits'];
        result.state = ctx.getState();
      }
      else if (action.type === 'exit') {
        // 'extract' advances the floor when standing on the exit tile.
        // (Historically this mapped to the 'exit' command, which quits
        // Gone Rogue entirely — wrong semantics for the agent action.)
        var exitResult = ctx.process('extract');
        result.success = true;
        result.messages = exitResult.lines || [];
        result.state = ctx.getState();
      }
      else if (action.type === 'kick') {
        var kickResult = ctx.process('kick ' + (action.direction || 'north'));
        result.success = true;
        result.messages = kickResult.lines || [];
        result.state = ctx.getState();
      }
      else if (action.type === 'shoot') {
        var shootResult = ctx.process('shoot ' + (action.direction || 'north'));
        result.success = true;
        result.messages = shootResult.lines || [];
        result.state = ctx.getState();
      }
      else if (action.type === 'interact') {
        var interactResult = ctx.process('interact');
        result.success = true;
        result.messages = interactResult.lines || [];
        result.state = ctx.getState();
      }
      else if (action.type === 'useActiveItem') {
        var itemResult = ctx.triggerActiveItem();
        result.success = itemResult && itemResult.lines;
        result.messages = itemResult ? itemResult.lines : [];
        result.state = ctx.getState();
      }
      else if (action.type === 'wait') {
        ctx.incrementTurn();
        ctx.updateEnemies();
        result.success = true;
        result.messages = ['Waited...'];
        result.state = ctx.getState();
      }
      else {
        result.reason = 'Unknown action type: ' + action.type;
      }
    } catch (error) {
      result.success = false;
      result.reason = 'Error executing action: ' + error.message;
    }

    return result;
  }

  return {
    getLegalActions: getLegalActions,
    applyAction: applyAction
  };
})();
