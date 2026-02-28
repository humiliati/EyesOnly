/* ============================================================
   EYES ONLY - Lighting System for Gone Rogue
   Dynamic per-tile illumination with biome-specific light sources
   ============================================================ */

const LightingSystem = (function() {
  'use strict';

  // ── Phase 1.1: Tile Opacity System ─────────────────────────────────────────
  // How much each tile type attenuates a light ray (0 = clear, 1 = fully opaque).
  const TILE_OPACITY = {
    WALL:      1.0, // Fully opaque — blocks all light
    FLOOR:     0.0, // Transparent — light passes through freely
    SHADOW:    0.3, // Semi-transparent stealth tile
    BREAKABLE: 0.7, // Boxes/crates partially block light
    SMOKE:     0.5  // Smoke diffuses light
  };

  /**
   * Return the light-blocking opacity for a tile cell.
   * @param {Object|null} tile - Tile data { type, isBreakable, hasSmoke }
   * @returns {number} 0 (transparent) – 1 (fully opaque)
   */
  function getTileOpacity(tile) {
    if (!tile) return TILE_OPACITY.FLOOR;
    if (tile.type === 'wall')      return TILE_OPACITY.WALL;
    if (tile.type === 'shadow')    return TILE_OPACITY.SHADOW;
    if (tile.isBreakable)          return TILE_OPACITY.BREAKABLE;
    if (tile.hasSmoke)             return TILE_OPACITY.SMOKE;
    return TILE_OPACITY.FLOOR;
  }

  // Light source definitions
  const LIGHT_SOURCES = {
    // Player light sources (items)
    FLASHLIGHT: {
      name: 'Flashlight',
      emoji: '🔦',
      radius: 6,
      intensity: 1.0,
      color: '#ffffff',
      type: 'directional', // Cone in facing direction
      angle: 90, // degrees
      flickerRate: 0
    },
    LIGHTER: {
      name: 'Lighter',
      emoji: '🔥',
      radius: 3,
      intensity: 0.8,
      color: '#ff8800',
      type: 'radial',
      flickerRate: 0.3 // 30% variance
    },
    NIGHT_VISION: {
      name: 'Night Vision Goggles',
      emoji: '🥽',
      radius: 8,
      intensity: 0.6,
      color: '#00ff00',
      type: 'radial',
      flickerRate: 0
    },

    // Environmental light sources by biome
    MONITOR: {
      name: 'Computer Monitor',
      emoji: '💻',
      radius: 4,
      intensity: 0.7,
      color: '#4A90E2', // Sickly blue/green
      type: 'radial',
      flickerRate: 0.1
    },
    TERMINAL: {
      name: 'Terminal',
      emoji: '💻',
      radius: 4,
      intensity: 0.8,
      color: '#00ffff', // Cyan glow - distinguishable from regular monitors
      type: 'radial',
      flickerRate: 0.05
    },
    LIGHT_BULB: {
      name: 'Light Bulb',
      emoji: '💡',
      radius: 6,
      intensity: 0.9,
      color: '#ffffdd', // Pleasant yellowing white
      type: 'radial',
      flickerRate: 0
    },
    FIRE: {
      name: 'Fire',
      emoji: '🔥',
      radius: 7,
      intensity: 1.0,
      color: '#ff6600', // Orange
      type: 'radial',
      flickerRate: 0.4 // Very flickery
    },
    LAVA_LAMP: {
      name: 'Lava Lamp',
      emoji: '🪔',
      radius: 4,
      intensity: 0.6,
      color: '#9933ff', // Purple steady glow
      type: 'radial',
      flickerRate: 0.05
    },
    CAMPFIRE: {
      name: 'Campfire',
      emoji: '🏕️',
      radius: 5,
      intensity: 0.85,
      color: '#ff7722',
      type: 'radial',
      flickerRate: 0.35
    },
    TORCH: {
      name: 'Torch',
      emoji: '🕯️',
      radius: 5,
      intensity: 0.75,
      color: '#ffb15a',
      type: 'radial',
      flickerRate: 0.25
    },
    LAMP_POST: {
      name: 'Lamp Post',
      emoji: '🏮',
      radius: 6,
      intensity: 0.8,
      color: '#ffe7b0',
      type: 'radial',
      flickerRate: 0.08
    },
    LAVA_FLOOR: {
      name: 'Lava',
      emoji: '🌋',
      radius: 3,
      intensity: 0.9,
      color: '#ff3300',
      type: 'radial',
      flickerRate: 0.2
    },

    // Enemy light sources
    ROBOT_LED: {
      name: 'Robot LED',
      emoji: '🤖',
      radius: 4,
      intensity: 0.6,
      color: '#00ffaa', // Blue/green LED
      type: 'directional',
      angle: 120,
      flickerRate: 0
    },
    SIGHT_CONE: {
      name: 'Enemy Sight',
      emoji: '👁️',
      radius: 5,
      intensity: 0.4,
      color: '#ff2244',
      type: 'directional',
      angle: 60,
      flickerRate: 0
    }
  };

  // Biome-specific ambient light levels and light source types
  const BIOME_LIGHTING = {
    GREY_CAVE: {
      ambientLight: 0.25, // Raised from 0.1
      lightRatio: 0.5, // 50% lit areas, 50% dark areas
      lightSources: ['LAVA_LAMP', 'CAMPFIRE', 'LAVA_FLOOR']
    },
    OFFICE: {
      ambientLight: 0.35, // Raised from 0.15
      lightRatio: 0.5, // 50/50 mix
      lightSources: ['MONITOR']
    },
    MALL: {
      ambientLight: 0.3, // Raised from 0.25
      lightRatio: 0.8, // 80% lit, 20% dark (power out)
      lightSources: ['LIGHT_BULB']
    },
    INDUSTRIAL: {
      ambientLight: 0.22, // Raised from 0.12
      lightRatio: 0.4, // 40% lit, 60% dark
      lightSources: ['FIRE', 'LAVA_FLOOR'] // Fire and acid spills
    },
    AEROSPACE: {
      ambientLight: 0.35, // Raised from 0.3
      lightRatio: 0.9, // 90% lit, 10% dark
      lightSources: ['LIGHT_BULB']
    },

    // Forest variants (tutorial floors are mostly one big room, so we guarantee at least one lit room)
    COZY_FOREST_DAY: {
      ambientLight: 0.6,
      lightRatio: 1.0,
      lightSources: ['LAMP_POST', 'TORCH', 'CAMPFIRE']
    },
    COZY_FOREST_NIGHT: {
      ambientLight: 0.22,
      lightRatio: 1.0,
      lightSources: ['TORCH', 'CAMPFIRE']
    }
  };

  // State
  var _lightMap = {}; // key: "x,y", value: { intensity: 0-1, color: "#rrggbb", sources: [] }
  var _lightSources = []; // Array of active light sources: { x, y, type, direction?, flickerPhase }
  var _currentBiome = 'GREY_CAVE';
  var _playerLightItem = null; // Current light item equipped by player
  var _darknessMultiplier = 1.0; // For uber boss darkness effect
  var _frameCount = 0; // For flicker animation

  // ── Phase 3.3: Lighting Interpolator ───────────────────────────────────────
  // Smoothly transitions lighting when the map changes (player moves into/out of lit areas).
  var _interpEnabled = true;       // Whether interpolation is active
  var _interpPrevMap = {};         // Previous lighting snapshot
  var _interpProgress = 1.0;      // 0 = fully on previous map, 1 = fully on current map
  var _interpSpeed = 0.08;        // Progress increment per updateLightMap() call (~12 frames to settle)

  /**
   * Step the interpolation forward by one tick.
   * Captures the current _lightMap as the previous baseline before it is overwritten.
   * Called automatically by updateLightMap(), before _lightMap is reassigned.
   */
  function _stepInterpolation() {
    if (!_interpEnabled) return;
    // Always snapshot the currently-settled map as the previous baseline
    _interpPrevMap = (_interpProgress >= 1.0) ? _lightMap : _interpPrevMap;
    _interpProgress = 0.0;
  }

  /**
   * Enable or disable smooth lighting transitions.
   * @param {boolean} enabled
   */
  function setLightingInterpolation(enabled) {
    _interpEnabled = !!enabled;
    if (!enabled) _interpProgress = 1.0;
  }

  /**
   * Initialize lighting system
   */
  function init() {
    _lightMap = {};
    _lightSources = [];
    _frameCount = 0;
    _darknessMultiplier = 1.0;
    _interpPrevMap = {};
    _interpProgress = 1.0;
  }

  /**
   * Set current biome for lighting calculations
   * @param {string} biomeName - Name of biome (GREY_CAVE, OFFICE, MALL, INDUSTRIAL, AEROSPACE)
   */
  function setBiome(biomeName) {
    if (BIOME_LIGHTING[biomeName]) {
      _currentBiome = biomeName;
    }
  }

  /**
   * Set player's equipped light item
   * @param {string|null} lightType - Light source type (FLASHLIGHT, LIGHTER, NIGHT_VISION) or null
   */
  function setPlayerLight(lightType) {
    if (lightType === null || LIGHT_SOURCES[lightType]) {
      _playerLightItem = lightType;
    }
  }

  /**
   * Set darkness multiplier (for uber boss floor)
   * @param {number} multiplier - Multiplier for all light intensities (0-1)
   */
  function setDarknessMultiplier(multiplier) {
    _darknessMultiplier = Math.max(0, Math.min(1, multiplier));
  }

  /**
   * Add a light source to the world
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {string} type - Light source type from LIGHT_SOURCES
   * @param {string} direction - Optional direction for directional lights (north, south, east, west)
   */
  function addLightSource(x, y, type, direction) {
    if (!LIGHT_SOURCES[type]) {
      return;
    }

    _lightSources.push({
      x: x,
      y: y,
      type: type,
      direction: direction || null,
      flickerPhase: Math.random() * Math.PI * 2 // Random starting phase
    });
  }

  /**
   * Remove all light sources at a position
   * @param {number} x - X position
   * @param {number} y - Y position
   */
  function removeLightSource(x, y) {
    _lightSources = _lightSources.filter(function(source) {
      return !(source.x === x && source.y === y);
    });
  }

  /**
   * Clear all light sources
   */
  function clearLightSources() {
    _lightSources = [];
  }

  /**
   * Calculate distance between two points
   */
  function _distance(x1, y1, x2, y2) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate angle from source to target in degrees (0 = east, 90 = north, 180 = west, 270 = south)
   */
  function _angleBetween(x1, y1, x2, y2) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    var radians = Math.atan2(-dy, dx); // Negative dy because y increases downward
    var degrees = radians * 180 / Math.PI;
    return degrees;
  }

  /**
   * Convert direction string to angle
   */
  function _directionToAngle(direction) {
    switch (direction) {
      case 'east': return 0;
      case 'north': return 90;
      case 'west': return 180;
      case 'south': return 270;
      default: return 0;
    }
  }

  /**
   * Calculate if target is within directional light cone
   */
  function _isInCone(sourceX, sourceY, targetX, targetY, direction, coneAngle) {
    var targetAngle = _angleBetween(sourceX, sourceY, targetX, targetY);
    var sourceAngle = _directionToAngle(direction);

    // Normalize angle difference to -180 to 180
    var diff = targetAngle - sourceAngle;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;

    return Math.abs(diff) <= coneAngle / 2;
  }

  /**
   * Calculate light intensity at a position from a single source
   */
  function _calculateLightFromSource(source, targetX, targetY, blockers) {
    var lightDef = LIGHT_SOURCES[source.type];
    if (!lightDef) return 0;

    var dist = _distance(source.x, source.y, targetX, targetY);

    // Out of range
    if (dist > lightDef.radius) {
      return 0;
    }

    // Check if directional and target is outside cone
    if (lightDef.type === 'directional' && source.direction) {
      if (!_isInCone(source.x, source.y, targetX, targetY, source.direction, lightDef.angle)) {
        return 0;
      }
    }

    // Calculate base intensity with distance falloff (inverse square law)
    var falloff = 1 - (dist / lightDef.radius);
    falloff = falloff * falloff; // Square for more realistic falloff

    var intensity = lightDef.intensity * falloff;

    // Apply flicker
    if (lightDef.flickerRate > 0) {
      var flicker = Math.sin(source.flickerPhase + _frameCount * 0.1) * lightDef.flickerRate;
      intensity *= (1 + flicker);
      intensity = Math.max(0, Math.min(1, intensity));
    }

    // Check line of sight using Bresenham raycasting
    if (blockers && blockers.length > 0) {
      var opacity = _hasLineOfSight(source.x, source.y, targetX, targetY, blockers);
      intensity *= (1 - opacity);
      if (intensity <= 0) return 0;
    }

    return intensity;
  }

  /**
   * Check if there's line of sight between two points using Bresenham's line algorithm
   * Returns false if any blocker is encountered along the line
   */
  function _hasLineOfSight(x0, y0, x1, y1, blockers) {
    // Create a set for fast blocker lookup
    var blockerSet = {};
    for (var i = 0; i < blockers.length; i++) {
      var key = blockers[i].x + ',' + blockers[i].y;
      blockerSet[key] = blockers[i].opacity !== undefined ? blockers[i].opacity : 1.0;
    }

    // Bresenham's line algorithm
    var dx = Math.abs(x1 - x0);
    var dy = Math.abs(y1 - y0);
    var sx = x0 < x1 ? 1 : -1;
    var sy = y0 < y1 ? 1 : -1;
    var err = dx - dy;

    var x = x0;
    var y = y0;

    var accumulatedOpacity = 0.0;

    while (true) {
      // Don't check the source or target positions themselves
      if ((x !== x0 || y !== y0) && (x !== x1 || y !== y1)) {
        var key = x + ',' + y;
        if (blockerSet[key] !== undefined) {
          accumulatedOpacity += blockerSet[key];
          if (accumulatedOpacity >= 1.0) {
            return 1.0; // Line is fully blocked
          }
        }
      }

      // Reached target
      if (x === x1 && y === y1) {
        break;
      }

      var e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }

    return accumulatedOpacity;
  }

  /**
   * Blend two hex colors by intensity
   */
  function _blendColors(color1, intensity1, color2, intensity2) {
    // Parse hex colors
    var r1 = parseInt(color1.substr(1, 2), 16);
    var g1 = parseInt(color1.substr(3, 2), 16);
    var b1 = parseInt(color1.substr(5, 2), 16);

    var r2 = parseInt(color2.substr(1, 2), 16);
    var g2 = parseInt(color2.substr(3, 2), 16);
    var b2 = parseInt(color2.substr(5, 2), 16);

    // Weighted average
    var totalIntensity = intensity1 + intensity2;
    if (totalIntensity === 0) return color1;

    var r = Math.round((r1 * intensity1 + r2 * intensity2) / totalIntensity);
    var g = Math.round((g1 * intensity1 + g2 * intensity2) / totalIntensity);
    var b = Math.round((b1 * intensity1 + b2 * intensity2) / totalIntensity);

    return '#' +
      ('0' + r.toString(16)).slice(-2) +
      ('0' + g.toString(16)).slice(-2) +
      ('0' + b.toString(16)).slice(-2);
  }

  /**
   * Update the light map for the entire grid
   * @param {number} gridWidth - Width of grid
   * @param {number} gridHeight - Height of grid
   * @param {Array} blockers - Array of {x, y} positions that block light (walls)
   */
  function updateLightMap(gridWidth, gridHeight, blockers) {
    _frameCount++;

    // Capture the current map as the interpolation baseline before overwriting it
    if (_interpEnabled) {
      _stepInterpolation();
    }

    _lightMap = {};

    var biomeConfig = BIOME_LIGHTING[_currentBiome];
    var ambientLight = biomeConfig.ambientLight * _darknessMultiplier;

    // Calculate light for each tile
    for (var y = 0; y < gridHeight; y++) {
      for (var x = 0; x < gridWidth; x++) {
        var key = x + ',' + y;
        var totalIntensity = ambientLight;
        var blendedColor = '#888888'; // Default gray
        var sources = [];

        // Accumulate light from all sources
        var sightConeIntensity = 0; // Track sight cone separately (not illumination)
        for (var i = 0; i < _lightSources.length; i++) {
          var source = _lightSources[i];
          var lightIntensity = _calculateLightFromSource(source, x, y, blockers);

          if (lightIntensity > 0.01) { // Threshold to avoid very dim lights
            lightIntensity *= _darknessMultiplier;

            // Sight cones are awareness indicators, not illumination —
            // track them separately so they render as colored overlays
            if (source.type === 'SIGHT_CONE' || source.type === 'ROBOT_LED') {
              sightConeIntensity = Math.max(sightConeIntensity, lightIntensity);
              sources.push(source.type);
            } else {
              totalIntensity += lightIntensity;
              sources.push(source.type);

              // Blend color (environmental lights only)
              var lightDef = LIGHT_SOURCES[source.type];
              blendedColor = _blendColors(blendedColor, totalIntensity - lightIntensity, lightDef.color, lightIntensity);
            }
          }
        }

        // Cap intensity at 1.0
        totalIntensity = Math.min(1.0, totalIntensity);

        _lightMap[key] = {
          intensity: totalIntensity,
          color: blendedColor,
          sources: sources,
          sightCone: sightConeIntensity // 0 = not in cone, >0 = in enemy sight
        };
      }
    }

    // Step interpolation progress forward so the renderer converges to the new map
    if (_interpEnabled && _interpProgress < 1.0) {
      _interpProgress = Math.min(1.0, _interpProgress + _interpSpeed);
    }
  }

  /**
   * Get light level at a position.
   * When lighting interpolation is enabled, the returned intensity is lerped
   * between the previous map and the current map for a smooth transition.
   * @param {number} x - X position
   * @param {number} y - Y position
   * @returns {Object} { intensity: 0-1, color: "#rrggbb", sources: [] }
   */
  function getLightAt(x, y) {
    var key = x + ',' + y;
    var current = _lightMap[key] || { intensity: 0, color: '#000000', sources: [], sightCone: 0 };

    if (!_interpEnabled || _interpProgress >= 1.0) {
      return current;
    }

    // Lerp intensity between previous and current snapshot
    var prev = _interpPrevMap[key] || { intensity: 0, color: '#000000', sightCone: 0 };
    var t = _interpProgress;
    return {
      intensity: prev.intensity + (current.intensity - prev.intensity) * t,
      color: current.color,
      sources: current.sources,
      sightCone: prev.sightCone + (current.sightCone - prev.sightCone) * t
    };
  }

  /**
   * Check if a position is considered "in darkness" (for stealth mechanics)
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} threshold - Light threshold (default 0.3)
   * @returns {boolean} True if in darkness
   */
  function isInDarkness(x, y, threshold) {
    threshold = threshold || 0.3;
    var light = getLightAt(x, y);
    return light.intensity < threshold;
  }

  /**
   * Get stealth bonus from darkness at position
   * @param {number} x - X position
   * @param {number} y - Y position
   * @returns {number} Stealth bonus (0-50)
   */
  function getDarknessStealthBonus(x, y) {
    var light = getLightAt(x, y);
    // More darkness = more stealth bonus
    // Intensity 0.0 = +50 stealth, Intensity 0.5 = +25 stealth, Intensity 1.0 = 0 stealth
    var bonus = Math.max(0, (1 - light.intensity) * 50);
    return Math.floor(bonus);
  }

  /**
   * Generate environmental light sources for a floor based on biome
   * @param {number} gridWidth - Width of grid
   * @param {number} gridHeight - Height of grid
   * @param {Array} rooms - Array of room objects with bounds
   * @param {Array} walls - Array of {x, y} wall positions
   */
  function generateBiomeLights(gridWidth, gridHeight, rooms, walls) {
    clearLightSources();

    var biomeConfig = BIOME_LIGHTING[_currentBiome];
    if (!biomeConfig) {
      // Unknown biome: leave only ambient light + player/enemy lights.
      return;
    }
    var lightSourceTypes = biomeConfig.lightSources;

    if (!rooms || rooms.length === 0) return;

    // Calculate how many rooms should be lit based on lightRatio
    var totalRooms = rooms.length;
    var litRooms = Math.floor(totalRooms * biomeConfig.lightRatio);
    // Ensure at least one room is lit when any rooms exist (prevents "all-dark" tutorial forest)
    if (litRooms < 1) litRooms = 1;

    // Randomly select which rooms to light
    var roomsToLight = [];
    var availableRooms = rooms.slice();

    for (var i = 0; i < litRooms && availableRooms.length > 0; i++) {
      var idx = Math.floor(Math.random() * availableRooms.length);
      roomsToLight.push(availableRooms[idx]);
      availableRooms.splice(idx, 1);
    }

    // Place lights in selected rooms
    roomsToLight.forEach(function(room) {
      // Number of lights per room based on room size
      var roomArea = room.width * room.height;
      var numLights = Math.max(1, Math.floor(roomArea / 50)); // 1 light per ~50 tiles

      for (var i = 0; i < numLights; i++) {
        // Pick random light source type from biome's available types
        var lightType = lightSourceTypes[Math.floor(Math.random() * lightSourceTypes.length)];

        // Find valid position in room (not on wall)
        var attempts = 0;
        var validPos = false;
        var lx, ly;

        while (!validPos && attempts < 20) {
          lx = room.x + Math.floor(Math.random() * room.width);
          ly = room.y + Math.floor(Math.random() * room.height);

          // Check if position is not a wall
          var isWall = walls.some(function(w) { return w.x === lx && w.y === ly; });
          if (!isWall) {
            validPos = true;
          }
          attempts++;
        }

        if (validPos) {
          addLightSource(lx, ly, lightType);
        }
      }
    });
  }

  /**
   * Add enemy light sources (sight cones and robot LEDs)
   * @param {Array} enemies - Array of enemy objects with x, y, orientation, isRobot
   */
  function updateEnemyLights(enemies) {
    // Remove old enemy lights
    _lightSources = _lightSources.filter(function(source) {
      return source.type !== 'SIGHT_CONE' && source.type !== 'ROBOT_LED';
    });

    // Add new enemy lights
    enemies.forEach(function(enemy) {
      if (enemy.isRobot || (enemy.type && enemy.type.toLowerCase().includes('robot'))) {
        // Robots emit blue/green LED light
        addLightSource(enemy.x, enemy.y, 'ROBOT_LED', enemy.orientation);
      } else {
        // Regular enemies emit sight cone light
        addLightSource(enemy.x, enemy.y, 'SIGHT_CONE', enemy.orientation);
      }
    });
  }

  /**
   * Get environmental light source positions for rendering.
   * Returns only environmental lights (not player/enemy lights).
   * @returns {Array} Array of {x, y, type, emoji, color, flickerPhase} for rendering
   */
  function getLightSourcePositions() {
    var environmentalTypes = ['LIGHT_BULB', 'MONITOR', 'TERMINAL', 'FIRE', 'CAMPFIRE',
                               'TORCH', 'LAMP_POST', 'LAVA_LAMP', 'LAVA_FLOOR'];

    return _lightSources
      .filter(function(source) {
        return environmentalTypes.indexOf(source.type) !== -1;
      })
      .map(function(source) {
        var lightDef = LIGHT_SOURCES[source.type];
        return {
          x: source.x,
          y: source.y,
          type: source.type,
          emoji: lightDef.emoji,
          color: lightDef.color,
          flickerRate: lightDef.flickerRate,
          flickerPhase: source.flickerPhase
        };
      });
  }

  /**
   * Add player light source if they have a light item equipped
   * @param {number} x - Player X position
   * @param {number} y - Player Y position
   * @param {string} direction - Player facing direction
   */
  function updatePlayerLight(x, y, direction) {
    // Remove old player lights
    _lightSources = _lightSources.filter(function(source) {
      return source.type !== 'FLASHLIGHT' && source.type !== 'LIGHTER' && source.type !== 'NIGHT_VISION';
    });

    // Add player light if equipped
    if (_playerLightItem) {
      addLightSource(x, y, _playerLightItem, direction);
    }
  }

  // Public API
  return {
    init: init,
    setBiome: setBiome,
    setPlayerLight: setPlayerLight,
    setDarknessMultiplier: setDarknessMultiplier,
    addLightSource: addLightSource,
    removeLightSource: removeLightSource,
    clearLightSources: clearLightSources,
    updateLightMap: updateLightMap,
    getLightAt: getLightAt,
    isInDarkness: isInDarkness,
    getDarknessStealthBonus: getDarknessStealthBonus,
    generateBiomeLights: generateBiomeLights,
    updateEnemyLights: updateEnemyLights,
    updatePlayerLight: updatePlayerLight,
    getLightSources: function() { return _lightSources; },
    getLightSourcePositions: getLightSourcePositions,
    getFrameCount: function() { return _frameCount; },
    // Phase 1.1: Tile opacity helpers
    TILE_OPACITY: TILE_OPACITY,
    getTileOpacity: getTileOpacity,
    // Phase 3.3: Lighting interpolation control
    setLightingInterpolation: setLightingInterpolation,
    LIGHT_SOURCES: LIGHT_SOURCES,
    BIOME_LIGHTING: BIOME_LIGHTING
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LightingSystem;
}
