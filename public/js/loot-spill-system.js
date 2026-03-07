/* ============================================================
   EYES ONLY — LootSpillSystem
   Shared scatter algorithm for distributing loot across tiles.
   Used by: breakable-system, currency-spawning, player-death-drops.

   Items 1–3 stay on center tile with sub-tile visual offsets.
   Items 4+ spill to adjacent walkable tiles (cardinal first,
   then diagonal). 8-directional offsets shuffled via Fisher-Yates.
   ============================================================ */

var LootSpillSystem = (function () {
  'use strict';

  // ── Sub-tile visual offsets for items sharing a tile ──────────
  // Visual only — grid coords stay integer. Renderer reads _spawnOffset.
  var SAME_TILE_OFFSETS = [
    { x: 0,     y: 0     },  // item 1: dead center
    { x: -0.25, y: 0.15  },  // item 2: slight left-down
    { x: 0.25,  y: -0.15 }   // item 3: slight right-up
  ];

  // ── 8-directional offsets (cardinal first for priority) ──────
  var DIRECTIONS = [
    { dx: -1, dy: 0  },  // W
    { dx: 1,  dy: 0  },  // E
    { dx: 0,  dy: -1 },  // N
    { dx: 0,  dy: 1  },  // S
    { dx: -1, dy: -1 },  // NW
    { dx: 1,  dy: -1 },  // NE
    { dx: -1, dy: 1  },  // SW
    { dx: 1,  dy: 1  }   // SE
  ];

  // ── Fisher-Yates shuffle (in-place) ──────────────────────────
  function _shuffle(arr, rng) {
    var fn = (typeof rng === 'function') ? rng : Math.random;
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(fn() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  // ── Default walkability check (bounds + ctx helpers) ─────────
  function _defaultIsWalkable(x, y, ctx) {
    if (typeof ctx.isWalkable === 'function') {
      return ctx.isWalkable(x, y);
    }
    // Manual fallback: bounds + wall + breakable
    var gw = ctx.GRID_WIDTH || (ctx.grid && ctx.grid[0] ? ctx.grid[0].length : 0);
    var gh = ctx.GRID_HEIGHT || (ctx.grid ? ctx.grid.length : 0);
    if (x < 0 || x >= gw || y < 0 || y >= gh) return false;
    if (ctx.grid && ctx.grid[y] && ctx.grid[y][x] === (ctx.TILES ? ctx.TILES.WALL : '#')) return false;
    // Check live breakables
    if (typeof ctx.getBreakableAt === 'function') {
      var brk = ctx.getBreakableAt(x, y);
      if (brk && brk.hp > 0) return false;
    }
    return true;
  }

  // ── Core: assign scatter positions to an array of items ──────
  /**
   * Distribute items across center tile and adjacent walkable tiles.
   *
   * @param {number} cx  Center tile X (breakable/enemy position)
   * @param {number} cy  Center tile Y
   * @param {Array}  items  Array of loot objects (will be mutated with x, y, _spawnOffset)
   * @param {Object} ctx   Must have: grid, TILES, GRID_WIDTH, GRID_HEIGHT.
   *                        Optionally: isWalkable(x,y), getBreakableAt(x,y), rng().
   * @returns {Array} Same items array, each with updated x, y, and _spawnOffset
   */
  function scatterItems(cx, cy, items, ctx) {
    if (!items || items.length === 0) return items;

    // Build shuffled direction list for overflow tiles
    var dirs = DIRECTIONS.slice(); // copy
    _shuffle(dirs, ctx.rng);

    // Pre-compute which adjacent tiles are walkable
    var walkableTiles = [];
    for (var d = 0; d < dirs.length; d++) {
      var tx = cx + dirs[d].dx;
      var ty = cy + dirs[d].dy;
      if (_defaultIsWalkable(tx, ty, ctx)) {
        walkableTiles.push({ x: tx, y: ty });
      }
    }

    var overflowIdx = 0; // tracks which adjacent tile to use next

    for (var i = 0; i < items.length; i++) {
      if (i < 3) {
        // Items 1–3: stay on center tile with visual offset
        items[i].x = cx;
        items[i].y = cy;
        items[i]._spawnOffset = SAME_TILE_OFFSETS[i];
      } else {
        // Items 4+: spill to adjacent walkable tiles
        if (walkableTiles.length > 0) {
          var tile = walkableTiles[overflowIdx % walkableTiles.length];
          items[i].x = tile.x;
          items[i].y = tile.y;
          items[i]._spawnOffset = { x: 0, y: 0 };
          overflowIdx++;
        } else {
          // No walkable adjacent — fallback to center
          items[i].x = cx;
          items[i].y = cy;
          items[i]._spawnOffset = { x: 0, y: 0 };
        }
      }
    }

    return items;
  }

  // ── Public API ────────────────────────────────────────────────
  return {
    scatterItems: scatterItems
  };

})();
