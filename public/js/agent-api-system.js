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

    var actions = [];
    var player = ctx.player;

    // During STR combat, only card actions are legal
    if (ctx.strCombatActive) {
      if (player.deck && player.deck.length > 0) {
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
        var cardResult = ctx.handleCardSwipe(action.cardIndex, 'up');
        result.success = true;
        result.messages = cardResult.lines || [];
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
        var exitResult = ctx.process('exit');
        result.success = true;
        result.messages = exitResult.lines || [];
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
