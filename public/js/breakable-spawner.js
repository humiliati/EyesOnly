/**
 * BreakableSpawner — biome-specific breakable prop placement: _spawnBreakables.
 * Extracted Phase 24 from gone-rogue.js.
 * Stateless IIFE module — all mutable state via ctx references.
 */
var BreakableSpawner = (function() {
  'use strict';

  /**
   * Spawn biome-specific breakable props on the current floor.
   * Places 8-12 random breakables from the biome's prop list.
   * @param {Object} ctx - Context from monolith
   */
  function spawnBreakables(ctx) {
    var TILES = ctx.TILES;
    var GRID_WIDTH = ctx.GRID_WIDTH;
    var GRID_HEIGHT = ctx.GRID_HEIGHT;
    var rng = ctx.rng;
    var player = ctx.player;
    var grid = ctx.grid;

    // Get current biome
    var biome = ctx.getBiome(ctx.getFloor());

    // Spawn biome-specific breakables
    var breakables = [];

    // Spawn 8-12 random breakables from the biome's prop list
    var breakableCount = 8 + Math.floor(rng() * 5);
    var breakableProps = biome.props.filter(function(p) { return p.breakable; });

    if (breakableProps.length === 0) {
      // Fallback to generic crates if biome has no breakable props
      breakableProps = [{ emoji: '\uD83D\uDCE6', name: 'Crate', breakable: true, hp: 2 }];
    }

    for (var i = 0; i < breakableCount; i++) {
      var attempts = 0;
      var placed = false;

      while (!placed && attempts < 50) {
        var x = 2 + Math.floor(rng() * (GRID_WIDTH - 4));
        var y = 2 + Math.floor(rng() * (GRID_HEIGHT - 4));

        // Check if position is valid (floor tile, not player, not exit, not occupied)
        if (grid[y] && grid[y][x] === TILES.EMPTY &&
            !(x === player.x && y === player.y) &&
            !breakables.find(function(b) { return b.x === x && b.y === y; })) {

          var propTemplate = breakableProps[Math.floor(rng() * breakableProps.length)];
          breakables.push({
            x: x,
            y: y,
            hp: propTemplate.hp,
            maxHp: propTemplate.hp,
            glyph: TILES.BREAKABLE,
            destroyedGlyph: TILES.DEBRIS,
            emoji: propTemplate.emoji,
            name: propTemplate.name,
            tag: 'biome_prop_' + i
          });

          placed = true;
        }
        attempts++;
      }
    }

    // Place on grid
    breakables.forEach(function(breakable) {
      if (grid[breakable.y] && grid[breakable.y][breakable.x]) {
        grid[breakable.y][breakable.x] = TILES.BREAKABLE;
      }
    });

    // Set breakables into monolith via ctx
    ctx.setBreakables(breakables);
  }

  return {
    spawnBreakables: spawnBreakables
  };
})();
