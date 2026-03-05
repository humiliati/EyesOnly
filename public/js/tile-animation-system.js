/* ============================================================
   EYES ONLY - Tile Animation System for Gone Rogue
   ASCII-based ground tile animations and movement modifiers
   ============================================================ */

const TileAnimationSystem = (function() {
  'use strict';

  // Global animation tick counter
  var _globalTick = 0;
  var _lastTickTime = 0;

  // Animation frame definitions for each tile type
  var TILE_ANIMATIONS = {
    // Grass - Gentle wave (3-frame loop)
    GRASS: {
      frames: [
        ',`\',`\'',
        '`,`,`,',
        '\'`,`,\'`'
      ],
      frameCount: 3,
      frameDuration: 180, // ms per frame
      loopPattern: [0, 1, 2, 1], // A → B → C → B → A
      type: 'oscillating'
    },

    // Dense grass - More varied characters
    GRASS_DENSE: {
      frames: [
        ',`,"`,\',`',
        '`,"`,\',`,"',
        '"\'`,`,",`,\'`'
      ],
      frameCount: 3,
      frameDuration: 200,
      loopPattern: [0, 1, 2, 1],
      type: 'oscillating'
    },

    // Water - Calm surface (4-frame loop)
    WATER: {
      frames: [
        '~~~~',
        '~≈~≈',
        '≈~≈~',
        '~∿~∿'
      ],
      frameCount: 4,
      frameDuration: 150,
      loopPattern: [0, 1, 2, 3],
      type: 'linear',
      scrollOffset: 0, // For horizontal drift
      scrollSpeed: 6 // Every 6 frames, shift 1 char
    },

    // Toxic waste - Bubbling viscous (3-frame loop)
    TOXIC: {
      frames: [
        '~o~°',
        'o~°~',
        '°o~∞'
      ],
      frameCount: 3,
      frameDuration: 220,
      loopPattern: [0, 1, 2],
      type: 'linear',
      bubbleChance: 0.02 // 2% chance per tick to show bubble pop
    },

    // Oil - Heavy minimal motion (2-frame loop)
    OIL: {
      frames: [
        '__..__.',
        '_.\`._.\`.'
      ],
      frameCount: 2,
      frameDuration: 1500, // Very slow
      loopPattern: [0, 1],
      type: 'linear',
      rippleInterval: 2000 // Occasional ripple every 2 seconds
    },

    // Fire - Vertical flicker (3-frame loop)
    FIRE: {
      frames: [
        '^*^',
        '*^\'',
        '\'*^'
      ],
      frameCount: 3,
      frameDuration: 100, // Fast flicker
      loopPattern: [0, 1, 2],
      type: 'linear'
    },

    // Electrified water - Water with overlay
    WATER_ELECTRIC: {
      baseAnimation: 'WATER',
      overlay: {
        chars: ['⚡', '*', '+'],
        pulseInterval: 900, // ms between pulses
        pulseDuration: 200, // How long pulse lasts
        coverage: 0.20 // 20% of tiles get overlay
      }
    },

    // Ash - Static remains
    ASH: {
      frames: ['.'],
      frameCount: 1,
      frameDuration: 0,
      type: 'static'
    }
  };

  // Movement speed modifiers (multiplier applied to base movement speed)
  var MOVEMENT_MODIFIERS = {
    // ASCII floor tiles
    '.': { speed: 1.0, name: 'Default Floor' },
    ',': { speed: 0.85, name: 'Grass' }, // Slight slowdown
    '`': { speed: 0.85, name: 'Grass' },
    '\'': { speed: 0.85, name: 'Grass' },
    '"': { speed: 0.80, name: 'Dense Grass' },
    '·': { speed: 0.95, name: 'Dirt' },
    '~': { speed: 0.60, name: 'Water' }, // Significant slowdown
    '≈': { speed: 0.60, name: 'Water' },
    '∿': { speed: 0.60, name: 'Water' },
    '☣': { speed: 0.60, name: 'Toxic Waste', damage: 1 }, // Water speed + damage
    'o': { speed: 0.60, name: 'Toxic' },
    '°': { speed: 0.60, name: 'Toxic' },
    '∞': { speed: 0.60, name: 'Toxic' },
    '_': { speed: 0.70, name: 'Oil' }, // Slower than water
    '^': { speed: 0.40, name: 'Fire', damage: 2 }, // Very slow + high damage
    '*': { speed: 0.40, name: 'Fire', damage: 2 },
    '▬': { speed: 1.1, name: 'Path/Road' }, // Slight speedup
    '⬜': { speed: 1.05, name: 'Tile Floor' },
    '🟫': { speed: 0.95, name: 'Carpet' },
    '#️⃣': { speed: 1.0, name: 'Grate' },
    '▪': { speed: 1.0, name: 'Metal Walkway' },
    '░': { speed: 0.90, name: 'Debris' },
    '▒': { speed: 0.70, name: 'Hazard' },
    '▓': { speed: 0.50, name: 'Cover', blocks: true }, // Heavy cover

    // Ice (speed boost)
    '❄': { speed: 1.4, name: 'Ice', slippery: true }, // Fast but slippery
    '❅': { speed: 1.4, name: 'Ice', slippery: true },

    // Special emojis that should NOT be floor tiles per requirements
    '🍂': { speed: 0.90, name: 'Fallen Leaves' },
    '🌸': { speed: 0.95, name: 'Flower Clearing', healing: 1 },
    '🍄': { speed: 0.85, name: 'Mushroom Circle' },
    '🛍️': { speed: 0.90, name: 'Display Area' },
    '🛢️': { speed: 0.70, name: 'Oil Slick', ignitable: true },

    // Light source emojis (environmental)
    '🕯️': { speed: 1.0, name: 'Torch', kickable: true }, // Safe to walk on, can nudge
    '🏮': { speed: 0.9, name: 'Lamp Post', draggable: true }, // Slight slowdown, can push
    '🔥': { speed: 0.4, name: 'Fire', damage: 2 }, // Hazardous, severe slowdown
    '🏕️': { speed: 0.65, name: 'Campfire', standingDamage: 1, standingTurns: 2 }, // Delayed damage
    '💻': { speed: 1.0, name: 'Monitor', blocks: true }, // Impassable furniture
    '🪔': { speed: 1.0, name: 'Lava Lamp', kickable: true }, // Safe, decorative
    '🌋': { speed: 0.35, name: 'Lava Floor', damage: 3 }, // Most dangerous
    '💡': { speed: 1.0, name: 'Light Bulb', kickable: true } // Fragile, shatter on kick/projectile
  };

  // Emojis that cause TOTAL collision (no passing)
  var TOTAL_COLLISION_EMOJIS = [
    // Trees and nature
    '🌳', '🌲', '🪵', '🪨', '⛰️',

    // Buildings and structures
    '🏠', '⛪', '🏪', '🏡', '🏛️', '🏔️',

    // Walls and barriers
    '█', '🚧', '🪟',

    // Furniture and objects
    '📂', '🖨️', '🖥️', '💼', '🥤', '💻',
    '🛒', '📰', '🎁', '👗', '👟', '💍',
    '🧸', '🥫', '🛍️', '🛤️', '🤖',

    // Rocks and boulders
    '🪨',

    // Props that block
    '📦', // Boxes (breakable but block)
    '🚀', '✈️', // Large museum pieces

    // Interactive item holders
    '📬', // Mailbox
    '🪑', // Furniture
    '🏮', '⛲' // Decorations
  ];

  // Emojis that allow ghost collision with heavy movement penalty
  var GHOST_COLLISION_EMOJIS = {
    '🧺': { speed: 0.3, name: 'Picnic Blanket', tooltip: 'Soft surface' },
    '🌿': { speed: 0.6, name: 'Bush', tooltip: 'Dense foliage' },
    '🐾': { speed: 0.8, name: 'Deer Trail', tooltip: 'Animal path' },
    '▓': { speed: 0.5, name: 'Cubicle', tooltip: 'Partial cover' }
  };

  // Animation state per tile
  var _tileAnimationState = {}; // key: "x,y" -> { frameIndex, lastUpdate, overlayActive }

  /**
   * Initialize animation system
   */
  function init() {
    _globalTick = 0;
    _lastTickTime = performance.now();
    _tileAnimationState = {};
  }

  /**
   * Update global animation tick
   * Call this every frame (60 FPS)
   */
  function update() {
    var now = performance.now();
    var delta = now - _lastTickTime;

    // Update tick every 16ms (approximately 60 FPS)
    if (delta >= 16) {
      _globalTick++;
      _lastTickTime = now;
    }
  }

  /**
   * Get animated character for a tile at given position
   * @param {string} baseTile - Base tile character
   * @param {number} x - Tile x position
   * @param {number} y - Tile y position
   * @param {string} animationType - Optional animation type override
   * @returns {string} Current frame character
   */
  function getAnimatedChar(baseTile, x, y, animationType) {
    // Determine animation type from base tile
    var animType = animationType;
    if (!animType) {
      animType = _getAnimationTypeForTile(baseTile);
    }

    if (!animType) {
      return baseTile; // No animation, return base
    }

    var anim = TILE_ANIMATIONS[animType];
    if (!anim) {
      return baseTile;
    }

    // Check if this is a composite animation with overlay
    if (anim.baseAnimation) {
      var baseChar = getAnimatedChar(baseTile, x, y, anim.baseAnimation);

      // Check if overlay should be active
      if (anim.overlay && _shouldShowOverlay(anim.overlay, x, y)) {
        var overlayChar = _getOverlayChar(anim.overlay);
        return overlayChar || baseChar;
      }

      return baseChar;
    }

    // Calculate frame index based on global tick
    var frameIndex;
    if (anim.type === 'oscillating') {
      var loopLength = anim.loopPattern.length;
      var loopIndex = Math.floor(_globalTick / (anim.frameDuration / 16)) % loopLength;
      frameIndex = anim.loopPattern[loopIndex];
    } else {
      frameIndex = Math.floor(_globalTick / (anim.frameDuration / 16)) % anim.frameCount;
    }

    // Get character from frame
    var frame = anim.frames[frameIndex];

    // For scrolling animations, apply offset
    if (anim.scrollSpeed && _globalTick % anim.scrollSpeed === 0) {
      var offset = Math.floor(_globalTick / anim.scrollSpeed) % frame.length;
      frame = frame.substring(offset) + frame.substring(0, offset);
    }

    // Pick character from frame based on position
    var charIndex = (x + y) % frame.length;
    return frame.charAt(charIndex) || baseTile;
  }

  /**
   * Get movement modifier for a tile
   * @param {string} tileChar - Tile character
   * @returns {object} Modifier object with speed, damage, etc.
   */
  function getMovementModifier(tileChar) {
    return MOVEMENT_MODIFIERS[tileChar] || { speed: 1.0, name: 'Unknown' };
  }

  /**
   * Check if emoji causes total collision
   * @param {string} emoji - Emoji character
   * @returns {boolean} True if blocks movement completely
   */
  function isTotalCollision(emoji) {
    return TOTAL_COLLISION_EMOJIS.indexOf(emoji) !== -1;
  }

  /**
   * Check if emoji allows ghost collision
   * @param {string} emoji - Emoji character
   * @returns {object|null} Ghost collision data or null
   */
  function getGhostCollision(emoji) {
    return GHOST_COLLISION_EMOJIS[emoji] || null;
  }

  /**
   * Get tooltip for tile
   * @param {string} tileChar - Tile character or emoji
   * @returns {string|null} Tooltip text
   */
  function getTooltip(tileChar) {
    var modifier = MOVEMENT_MODIFIERS[tileChar];
    if (modifier && modifier.tooltip) {
      return modifier.tooltip;
    }

    var ghost = GHOST_COLLISION_EMOJIS[tileChar];
    if (ghost && ghost.tooltip) {
      return ghost.tooltip;
    }

    return null;
  }

  /**
   * Handle fire spread on oil
   * @param {Array} grid - Game grid
   * @param {number} x - Fire source x
   * @param {number} y - Fire source y
   * @returns {Array} Array of new fire positions
   */
  function spreadFire(grid, x, y) {
    var newFires = [];
    var dirs = [
      {dx: 0, dy: -1},
      {dx: 1, dy: 0},
      {dx: 0, dy: 1},
      {dx: -1, dy: 0}
    ];

    for (var i = 0; i < dirs.length; i++) {
      var nx = x + dirs[i].dx;
      var ny = y + dirs[i].dy;

      if (nx >= 0 && nx < grid[0].length && ny >= 0 && ny < grid.length) {
        var tile = grid[ny][nx];

        // Check if tile is oil
        if (tile === '_' || tile === '🛢️') {
          newFires.push({ x: nx, y: ny });
        }
      }
    }

    return newFires;
  }

  /**
   * Convert tile to ash after burning
   * @param {string} tileChar - Current tile
   * @returns {string} Ash character
   */
  function convertToAsh(tileChar) {
    return '.'; // Ash becomes standard floor
  }

  // Private helper functions

  function _getAnimationTypeForTile(baseTile) {
    // Map base tiles to animation types
    if (baseTile === ',' || baseTile === '`' || baseTile === '\'') {
      return 'GRASS';
    }
    if (baseTile === '"') {
      return 'GRASS_DENSE';
    }
    if (baseTile === '~' || baseTile === '≈' || baseTile === '∿') {
      return 'WATER';
    }
    if (baseTile === '☣' || baseTile === 'o' || baseTile === '°' || baseTile === '∞') {
      return 'TOXIC';
    }
    if (baseTile === '_') {
      return 'OIL';
    }
    if (baseTile === '^' || baseTile === '*') {
      return 'FIRE';
    }

    return null;
  }

  function _shouldShowOverlay(overlay, x, y) {
    // Determine if overlay should be shown based on pulse timing
    var pulsePhase = _globalTick % (overlay.pulseInterval / 16);
    var pulseDuration = overlay.pulseDuration / 16;

    if (pulsePhase < pulseDuration) {
      // Within pulse window, check coverage
      var hash = (x * 73 + y * 101) % 100;
      return hash < (overlay.coverage * 100);
    }

    return false;
  }

  function _getOverlayChar(overlay) {
    var index = Math.floor(_globalTick / 5) % overlay.chars.length;
    return overlay.chars[index];
  }

  // Public API
  return {
    init: init,
    update: update,
    getAnimatedChar: getAnimatedChar,
    getMovementModifier: getMovementModifier,
    isTotalCollision: isTotalCollision,
    getGhostCollision: getGhostCollision,
    getTooltip: getTooltip,
    spreadFire: spreadFire,
    convertToAsh: convertToAsh,

    // Expose constants for external use
    TILE_ANIMATIONS: TILE_ANIMATIONS,
    MOVEMENT_MODIFIERS: MOVEMENT_MODIFIERS,
    TOTAL_COLLISION_EMOJIS: TOTAL_COLLISION_EMOJIS,
    GHOST_COLLISION_EMOJIS: GHOST_COLLISION_EMOJIS
  };
})();
