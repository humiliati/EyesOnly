/* ============================================================
   DirectionParser — Single source of truth for directional
   input parsing across all game modules.

   IIFE module — loads before gone-rogue.js.
   Replaces: monolith _parseDirection(), street-chronicles copy,
   and projectile-system ctx.parseDirection delegation.
   ============================================================ */
var DirectionParser = (function () {
  'use strict';

  // ── Direction lookup table ─────────────────────────────────
  // Canonical mapping from input tokens to {dx, dy, direction}.
  // Supports WASD, cardinal names, and single-letter shortcuts.
  var DIRECTIONS = {
    'n':     { dx:  0, dy: -1, direction: 'north' },
    'north': { dx:  0, dy: -1, direction: 'north' },
    'u':     { dx:  0, dy: -1, direction: 'north' },
    'up':    { dx:  0, dy: -1, direction: 'north' },
    'forward': { dx: 0, dy: -1, direction: 'north' },

    's':     { dx:  0, dy:  1, direction: 'south' },
    'south': { dx:  0, dy:  1, direction: 'south' },
    'd':     { dx:  0, dy:  1, direction: 'south' },
    'down':  { dx:  0, dy:  1, direction: 'south' },
    'back':  { dx:  0, dy:  1, direction: 'south' },

    'e':     { dx:  1, dy:  0, direction: 'east' },
    'east':  { dx:  1, dy:  0, direction: 'east' },
    'r':     { dx:  1, dy:  0, direction: 'east' },
    'right': { dx:  1, dy:  0, direction: 'east' },

    'w':     { dx: -1, dy:  0, direction: 'west' },
    'west':  { dx: -1, dy:  0, direction: 'west' },
    'a':     { dx: -1, dy:  0, direction: 'west' },
    'left':  { dx: -1, dy:  0, direction: 'west' }
  };

  // ── Default fallback ───────────────────────────────────────
  var DEFAULT_DIRECTION = DIRECTIONS['east'];

  // ── Public API ─────────────────────────────────────────────

  /**
   * Parse a direction from user input.
   * Drop-in replacement for monolith _parseDirection().
   *
   * @param {string} input - Raw command string (e.g. "fire north", "kick e")
   * @param {string} [lastMoveDirection] - Player's last move direction for fallback
   * @returns {{ dx: number, dy: number, direction: string }}
   */
  function parse(input, lastMoveDirection) {
    var raw = (input || '').trim().split(/\s+/);
    var token = raw.length > 1 ? raw[1] : raw[0];

    if (token && DIRECTIONS[token]) {
      return DIRECTIONS[token];
    }

    // Fallback to last move direction
    if (lastMoveDirection && DIRECTIONS[lastMoveDirection]) {
      return DIRECTIONS[lastMoveDirection];
    }

    return DEFAULT_DIRECTION;
  }

  /**
   * Simple cardinal name parse (for street-chronicles style usage).
   * Returns direction name string or null.
   *
   * @param {string} input - Raw input string
   * @returns {string|null} 'north'|'south'|'east'|'west' or null
   */
  function parseCardinal(input) {
    if (!input) return null;
    var lower = input.toLowerCase().trim();

    // Check each word in the input
    var words = lower.split(/\s+/);
    for (var i = 0; i < words.length; i++) {
      if (DIRECTIONS[words[i]]) {
        return DIRECTIONS[words[i]].direction;
      }
    }
    return null;
  }

  /**
   * Get the direction vector for a cardinal name.
   * @param {string} direction - 'north'|'south'|'east'|'west'
   * @returns {{ dx: number, dy: number, direction: string }|null}
   */
  function getVector(direction) {
    return DIRECTIONS[direction] || null;
  }

  /** Expose the raw lookup table (read-only usage) */
  function getDirections() {
    return DIRECTIONS;
  }

  return {
    parse:        parse,
    parseCardinal: parseCardinal,
    getVector:    getVector,
    getDirections: getDirections,
    DIRECTIONS:   DIRECTIONS
  };
})();
