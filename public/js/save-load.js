/* ============================================================
   Save/Load State — Extracted from gone-rogue.js
   Serializes/deserializes game state to localStorage
   ============================================================ */
var SaveLoad = (function() {
  'use strict';

  var STORAGE_KEY = 'goneRogueState';

  function saveState(ctx) {
    try {
      var state = {
        active: ctx.active,
        player: ctx.player,
        enemies: ctx.enemies,
        items: ctx.items,
        projectiles: ctx.projectiles,
        breakables: ctx.breakables,
        turn: ctx.turn,
        floor: ctx.floor
      };
      // Save interactive items
      if (typeof InteractiveItems !== 'undefined' && InteractiveItems.serialize) {
        state.interactiveItems = InteractiveItems.serialize();
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* ignore */ }
  }

  function loadState(ctx) {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed) return null;

      // Validate player spawn against grid (clamp out of walls)
      if (parsed.player && ctx.grid) {
        var p = parsed.player;
        if (ctx.grid[p.y] && ctx.grid[p.y][p.x] && ctx.grid[p.y][p.x] !== ctx.TILES.EMPTY) {
          var found = false;
          for (var r = 1; r <= 10 && !found; r++) {
            for (var dy = -r; dy <= r && !found; dy++) {
              for (var dx = -r; dx <= r && !found; dx++) {
                var tx = p.x + dx;
                var ty = p.y + dy;
                if (tx > 0 && tx < ctx.GRID_WIDTH - 1 && ty > 0 && ty < ctx.GRID_HEIGHT - 1 &&
                    ctx.grid[ty] && ctx.grid[ty][tx] === ctx.TILES.EMPTY) {
                  parsed.player.x = tx;
                  parsed.player.y = ty;
                  found = true;
                }
              }
            }
          }
          if (!found) {
            parsed.player.x = Math.floor(ctx.GRID_WIDTH / 2);
            parsed.player.y = Math.floor(ctx.GRID_HEIGHT / 2);
          }
        }
      }

      // DO NOT restore active state — user must explicitly enter rogue mode
      parsed.active = false;

      return parsed;
    } catch (e) { return null; }
  }

  function clearState() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }

  return {
    saveState: saveState,
    loadState: loadState,
    clearState: clearState,
    STORAGE_KEY: STORAGE_KEY
  };
})();
