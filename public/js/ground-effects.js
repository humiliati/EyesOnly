/* ============================================================
   EYES ONLY - Ground Effects System
   Environmental hazards that affect movement and combat
   ============================================================ */

const GroundEffects = (function () {
  'use strict';

  // Ground effect types
  var GROUND_TYPES = {
    NORMAL: 'normal',
    OIL: 'oil',
    OIL_IGNITED: 'oil_ignited',
    FIRE: 'fire',
    WATER: 'water',
    INDUSTRIAL_WASTE: 'industrial_waste',
    GLASS: 'glass',
    SODA_SPILL: 'soda_spill',
    STEAM: 'steam',
    ICE: 'ice',
    DARKENED: 'darkened',
    CONDUCTIVE: 'conductive',
    RADIANT: 'radiant',
    OBSCURED: 'obscured',
    SONIC: 'sonic',
    RESONANCE: 'resonance',
    SMOKE: 'smoke',
    SCORCHED: 'scorched'
  };

  // Ground effect definitions
  var GROUND_EFFECTS = {
    OIL: {
      emoji: '🛢️',
      char: '≈',
      color: '#4a3f35',
      movePenalty: 0.1,          // Slight movement slow
      dodgeBonus: 0.15,          // +15% dodge distance (slippery)
      fireVulnerability: 2.0,    // 2x fire damage
      canIgnite: true,
      description: 'Slippery oil puddle'
    },
    OIL_IGNITED: {
      emoji: '🔥',
      char: '≋',
      color: '#ff6600',
      damage: 2,                 // 2 HP per turn
      spreads: true,
      spreadChance: 0.3,
      spreadRate: 1,             // Spreads to 1 adjacent tile per turn
      blocksPath: true,
      lightRadius: 4,
      lightColor: '#ff6600',
      description: 'Burning oil - spreading fire!'
    },
    FIRE: {
      emoji: '🔥',
      char: '▒',
      color: '#ff3300',
      damage: 0.3,               // 0.3 HP per tick (DOT — not instakill)
      damageCooldownMs: 600,     // Apply damage at most every 600ms
      destroysWeakEnemies: true,
      removeStealth: true,       // Fire lights you up
      lightRadius: 3,
      lightColor: '#ff7722',
      burnCardChance: 0.5,       // 50% chance to add burn card in STR
      description: 'Flames'
    },
    WATER: {
      emoji: '💧',
      char: '~',
      color: '#4a90e2',
      movePenalty: 0.2,          // 20% movement slow
      extinguishesFire: true,
      increasesFootstepNoise: true,
      evasionPenalty: 0.1,       // -10% evasion in STR
      shockVulnerability: 1.5,   // Future: 1.5x shock damage
      removesBurnStatus: true,
      description: 'Standing water'
    },
    INDUSTRIAL_WASTE: {
      emoji: '☢️',
      char: '░',
      color: '#7cfc00',
      damage: 1,                 // Poison DOT
      mutationChance: 0.05,      // 5% chance of mutation
      corruptsDrops: true,       // Items dropped here are corrupted
      randomDebuffChance: 0.3,   // 30% chance of debuff when combat starts
      description: 'Toxic industrial waste'
    },
    GLASS: {
      emoji: '✨',
      char: '·',
      color: '#e0e0e0',
      noisyMovement: true,       // Makes noise when stepped on
      damageOnSprint: 1,         // Damage if moving fast
      description: 'Broken glass'
    },
    SODA_SPILL: {
      emoji: '🥤',
      char: '≈',
      color: '#8b4513',
      sticky: true,
      movePenalty: 0.15,         // Sticky, slows movement
      description: 'Sticky soda spill'
    },
    STEAM: {
      emoji: '💨',
      char: '≈',
      color: '#cccccc',
      obscuresVision: true,      // Reduces sight range
      damage: 0.5,               // Minor heat damage
      dissipates: true,          // Fades over time
      lifetime: 5,               // Seconds before dissipating
      description: 'Hot steam'
    },
    ICE: {
      emoji: '🧊',
      char: '·',
      color: '#b3e5ff',
      movePenalty: -0.15,        // Negative penalty = speed boost
      slippery: true,
      // STR combat penalties
      accuracyPenaltyPct: 12,    // -12% hit chance
      evasionPenaltyPts: 2,      // -2 evasion points (each = 5% miss)
      description: 'Frozen surface (fast but slippery)'
    },
    DARKENED: {
      emoji: '🌑',
      char: '▓',
      color: '#1a1a2e',
      lightLevel: 0,             // Floor light level reduced to 0
      stealthBonus: 0.25,        // +25% stealth
      shadowBoost: 1,            // Shadow-type cards gain +1 effect
      disableSolar: true,        // Solar-type cards disabled
      description: 'Darkened ground - stealth boosted, shadow cards enhanced'
    },
    CONDUCTIVE: {
      emoji: '⚡',
      char: '≋',
      color: '#4169e1',
      electricalAmplify: 2.0,    // 2x electrical effects
      metalVulnerability: 1.5,   // Metal-tag enemies take bonus damage
      shockDamage: 1,            // Player also vulnerable
      description: 'Conductive field - electricity effects doubled'
    },
    RADIANT: {
      emoji: '🌞',
      char: '◈',
      color: '#ffeb3b',
      lightLevel: 10,            // Maximum light level
      shadowDamage: 2,           // Damage to shadow-aligned enemies
      removeStealth: true,       // Removes stealth
      accuracyBonus: 10,         // +10% accuracy
      description: 'Radiant ground - bright luminous tiles'
    },
    OBSCURED: {
      emoji: '💨',
      char: '≈',
      color: '#808080',
      accuracyPenalty: -15,      // -15% accuracy for all units
      visibilityReduction: -50,  // -50% visibility
      stealthBonus: 0.15,        // +15% stealth
      dissipates: true,
      lifetime: 8,               // Seconds before dissipating
      description: 'Dense smoke cloud - heavily obscured'
    },
    SONIC: {
      emoji: '🔊',
      char: '~',
      color: '#9c27b0',
      sonicAmplify: 1.5,         // 1.5x sonic effects
      accuracyPenalty: -3,       // -3% accuracy (minor disorient)
      applyRinging: true,        // Applies ringing status
      lifetime: 8,               // Seconds
      description: 'Sonic vibrations - amplifies sound effects'
    },
    RESONANCE: {
      emoji: '🎤',
      char: '◊',
      color: '#e91e63',
      costReduction: 99,         // Next Sonic card costs 0
      sonicTag: true,            // Applies to sonic tag
      lightInteractionBoost: 2.0, // 2x light interactions
      lifetime: 6,               // Seconds
      description: 'Resonance field - free sonic cards'
    },
    SMOKE: {
      emoji: '💨',
      char: '░',
      color: '#888888',
      damage: 0,                 // No damage — just visual remnant
      dissipates: true,
      lifetime: 4,               // Lingers 4 seconds (extended for drift)
      stealthBonus: 0.1,         // Slight concealment in smoke
      description: 'Drifting smoke from extinguished fire'
    },
    SCORCHED: {
      emoji: '',                 // No emoji — scorch mark is ASCII-only
      char: '▓',
      color: '#3a2a1a',          // Dark burnt brown
      damage: 0,
      movePenalty: 0,
      stealthBonus: 0,
      dissipates: true,
      lifetime: 120,             // Scorch marks persist ~2 minutes
      description: 'Scorched earth — aftermath of an explosion'
    }
  };

  // ── Type comparison helper ──
  // GROUND_TYPES values are lowercase ('fire') but setGroundEffect stores
  // the key as-is ('FIRE'). This helper handles both casings.
  function _isType(effect, typeConst) {
    if (!effect) return false;
    var t = effect.type;
    return t === typeConst || t === typeConst.toUpperCase();
  }

  // Active ground effects on the map
  var _groundMap = {}; // key: "x,y", value: { type, ... }

  /**
   * Initialize ground effects system
   */
  function init() {
    _groundMap = {};
  }

  /**
   * Set ground effect at position
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {string} type - Ground effect type
   * @param {object} overrides - Override default properties
   */
  function setGroundEffect(x, y, type, overrides) {
    // Resolve type key: try as-is first, then uppercase (handles GROUND_TYPES values)
    var resolvedType = GROUND_EFFECTS[type] ? type : type.toUpperCase();
    if (!GROUND_EFFECTS[resolvedType]) {
      console.warn('[GroundEffects] Unknown ground type:', type);
      return false;
    }

    var key = x + ',' + y;
    var effect = Object.assign({}, GROUND_EFFECTS[resolvedType]);

    if (overrides) {
      Object.assign(effect, overrides);
    }

    effect.x = x;
    effect.y = y;
    effect.type = resolvedType; // Always store uppercase key for consistent lookups
    effect.spawnTime = Date.now();

    _groundMap[key] = effect;
    return true;
  }

  /**
   * Get ground effect at position
   * @param {number} x - X position
   * @param {number} y - Y position
   * @returns {object|null} - Ground effect or null
   */
  function getGroundEffect(x, y) {
    var key = x + ',' + y;
    return _groundMap[key] || null;
  }

  /**
   * Remove ground effect at position
   */
  function removeGroundEffect(x, y) {
    var key = x + ',' + y;
    delete _groundMap[key];
  }

  /**
   * Clear all ground effects
   */
  function clearAll() {
    _groundMap = {};
  }

  /**
   * Update ground effects (spreading, dissipating, explosion lifecycle, drift).
   * @param {number} deltaMs - Time since last update
   * @param {number} gridWidth - Grid width
   * @param {number} gridHeight - Grid height
   */

  // ── Smoke drift config ──
  var SMOKE_DRIFT_LIFETIME = 4;    // Seconds before smoke fully dissipates
  var SMOKE_DENSE_THRESHOLD = 2;   // Adjacent smoke count to upgrade to OBSCURED
  var SMOKE_DENSE_LIFETIME = 6;    // Dense clouds linger longer
  var SMOKE_VISUAL_CHARS = ['░', '▒', '≈']; // Shape options: "locks in" at spawn

  // ── Explosion lifecycle phase timings (Layer B) ──
  // Phase 1: 0-3s     Red tiles + ASCII smoke chars + fire generating smoke
  // Phase 2: 3-8s     Outer ring fire tiles rescind (die from outside in)
  // Phase 3: 8-20s    Inner ring continues, rescinding continues
  // Phase 4: 20-50s   Only epicenter + 1-ring remain, still producing smoke
  // Phase 5: 50s+     Epicenter stops smoke, all fire→SCORCHED
  var EXPLOSION_RESCIND_START_SEC = 3;    // Outer tiles start dying at 3s
  var EXPLOSION_RESCIND_RATE = 0.15;      // Probability per second to rescind (per tile)
  var EXPLOSION_EPICENTER_SMOKE_SEC = 30; // Epicenter produces smoke for 30s
  var EXPLOSION_SCORCH_AFTER_SEC = 35;    // Epicenter becomes scorched at 35s

  /**
   * Count adjacent smoke/obscured tiles around a position (for density check).
   */
  function _countAdjacentSmoke(x, y) {
    var count = 0;
    for (var dx = -1; dx <= 1; dx++) {
      for (var dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        var neighbor = _groundMap[(x + dx) + ',' + (y + dy)];
        if (neighbor && (_isType(neighbor, GROUND_TYPES.SMOKE) || _isType(neighbor, GROUND_TYPES.OBSCURED))) {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Spawn a drifting smoke cloud at position (shared by fire decay + explosion smoke gen).
   */
  function _spawnSmoke(x, y, gridWidth, gridHeight) {
    var key = x + ',' + y;
    if (_groundMap[key]) return; // Don't overwrite existing effects

    if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) return;

    var smokeChar = SMOKE_VISUAL_CHARS[Math.floor(Math.random() * SMOKE_VISUAL_CHARS.length)];
    var effect = Object.assign({}, GROUND_EFFECTS.SMOKE);
    effect.x = x;
    effect.y = y;
    effect.type = GROUND_TYPES.SMOKE;
    effect.spawnTime = Date.now();
    effect._decayedToSmoke = true;
    effect._smokeChar = smokeChar;
    effect.char = smokeChar;
    effect.lifetime = SMOKE_DRIFT_LIFETIME;

    // Use DriftVectorSystem if available, else inline fallback
    if (typeof DriftVectorSystem !== 'undefined') {
      DriftVectorSystem.initDriftWindBiased(effect);
    } else {
      var dirs8 = [
        { dx:1,dy:0 },{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1},
        {dx:1,dy:1},{dx:-1,dy:1},{dx:1,dy:-1},{dx:-1,dy:-1}
      ];
      var d = dirs8[Math.floor(Math.random() * dirs8.length)];
      var len = Math.sqrt(d.dx*d.dx + d.dy*d.dy);
      effect._driftVX = d.dx / len;
      effect._driftVY = d.dy / len;
      effect._driftAccumX = 0;
      effect._driftAccumY = 0;
    }

    _groundMap[key] = effect;
  }

  /**
   * Convert an explosion fire tile to SCORCHED.
   */
  function _scorchTile(effect) {
    effect.type = GROUND_TYPES.SCORCHED;
    effect.char = '▓';
    effect.emoji = '';
    effect.color = '#3a2a1a';
    effect.damage = 0;
    effect.lightRadius = 0;
    effect._decayedToSmoke = false;
    effect._explosionFire = false;
    effect.dissipates = true;
    effect.lifetime = 120; // 2 minutes
    effect.spawnTime = Date.now();
  }

  function update(deltaMs, gridWidth, gridHeight) {
    var now = Date.now();
    var dtSec = deltaMs / 1000;
    var effectsToAdd = [];
    var effectsToRemove = [];
    var effectsToRelocate = []; // Smoke tiles that need to drift to new positions

    // Drift speed — use DriftVectorSystem constant if available
    var driftSpeed = (typeof DriftVectorSystem !== 'undefined')
      ? DriftVectorSystem.DRIFT_SPEED : 0.4;

    Object.keys(_groundMap).forEach(function(key) {
      var effect = _groundMap[key];

      // ════════════════════════════════════════════════════════════════
      // EXPLOSION FIRE LIFECYCLE (Layer B)
      // Tagged with _explosionFire by ExplosionSystem.detonate()
      // ════════════════════════════════════════════════════════════════
      if (effect._explosionFire && _isType(effect, GROUND_TYPES.FIRE)) {
        var expAge = (now - effect._explosionSpawnTime) / 1000;
        var dist = effect._explosionDistance || 0;
        var maxR = effect._explosionMaxRadius || 3;

        // ── Animated fire char cycling ──
        // Cycle through fire chars for visual animation on tile
        var fireChars = ['▒', '░', '▓', '░'];
        var charIdx = Math.floor((now / 250) + dist * 2) % fireChars.length;
        effect.char = fireChars[charIdx];

        // ── Smoke generation: fire tiles periodically spawn drifting smoke ──
        // Rate decreases as fire ages (smoke slows down near end)
        var smokeGenChance = 0.08 * dtSec; // ~8% per second base rate
        if (expAge > EXPLOSION_EPICENTER_SMOKE_SEC && dist <= 1) {
          smokeGenChance = 0.03 * dtSec; // Epicenter slows down
        }
        if (Math.random() < smokeGenChance) {
          // Spawn smoke in a random adjacent empty tile
          var sdx = Math.floor(Math.random() * 3) - 1;
          var sdy = Math.floor(Math.random() * 3) - 1;
          _spawnSmoke(effect.x + sdx, effect.y + sdy, gridWidth, gridHeight);
        }

        // ── Phase 2+: Outer ring rescinding ──
        // Non-epicenter tiles start dying after EXPLOSION_RESCIND_START_SEC
        // Probability scales with distance (farther = dies sooner)
        if (dist > 0 && expAge > EXPLOSION_RESCIND_START_SEC) {
          var rescindAge = expAge - EXPLOSION_RESCIND_START_SEC;
          // Distance-based multiplier: farther tiles rescind faster
          var distFactor = dist / Math.max(1, maxR);
          var rescindProb = EXPLOSION_RESCIND_RATE * distFactor * dtSec;
          // After 2x the start time, force-rescind all non-epicenter tiles
          if (rescindAge > EXPLOSION_RESCIND_START_SEC * 2) {
            rescindProb = 0.5 * dtSec;
          }

          if (Math.random() < rescindProb) {
            // Fire tile dies → spawn last gasp smoke, then remove
            _spawnSmoke(effect.x, effect.y, gridWidth, gridHeight);

            // Small chance adjacent tiles become scorched
            if (dist <= 2 && Math.random() < 0.25) {
              _scorchTile(effect);
            } else {
              effectsToRemove.push(key);
            }
            return;
          }
        }

        // ── Phase 5: Epicenter tile scorches after long burn ──
        if (dist <= 0 && expAge > EXPLOSION_SCORCH_AFTER_SEC) {
          // Epicenter → SCORCHED + scorch adjacent tiles
          _scorchTile(effect);

          // Scorch up to 4 adjacent tiles
          var adjDirs = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];
          for (var ai = 0; ai < adjDirs.length; ai++) {
            var ax = effect.x + adjDirs[ai].dx;
            var ay = effect.y + adjDirs[ai].dy;
            if (ax >= 0 && ax < gridWidth && ay >= 0 && ay < gridHeight) {
              var adjKey = ax + ',' + ay;
              var adjEffect = _groundMap[adjKey];
              // Only scorch empty tiles or dying fire tiles
              if (!adjEffect) {
                var scorchEffect = Object.assign({}, GROUND_EFFECTS.SCORCHED);
                scorchEffect.x = ax;
                scorchEffect.y = ay;
                scorchEffect.type = GROUND_TYPES.SCORCHED;
                scorchEffect.spawnTime = now;
                effectsToAdd.push({ x: ax, y: ay, type: 'SCORCHED', _direct: scorchEffect });
              }
            }
          }
          return;
        }

        // Explosion fires don't use the normal dissipation path
        return;
      }

      // ════════════════════════════════════════════════════════════════
      // NORMAL DISSIPATION (non-explosion effects)
      // ════════════════════════════════════════════════════════════════
      if (effect.dissipates && effect.lifetime) {
        var age = (now - effect.spawnTime) / 1000;
        if (age > effect.lifetime) {
          // Fire decays to drifting smoke before disappearing
          if (_isType(effect, GROUND_TYPES.FIRE) && !effect._decayedToSmoke) {
            var adjacentSmoke = _countAdjacentSmoke(effect.x, effect.y);
            var isDense = adjacentSmoke >= SMOKE_DENSE_THRESHOLD;

            if (isDense) {
              effect.type = GROUND_TYPES.OBSCURED;
              effect.emoji = '🌫️';
              effect.color = '#666666';
              effect.stealthBonus = 0.15;
              effect.visibilityReduction = -50;
              effect.lifetime = SMOKE_DENSE_LIFETIME;
            } else {
              effect.type = GROUND_TYPES.SMOKE;
              effect.emoji = '💨';
              effect.color = '#888888';
              effect.stealthBonus = 0.1;
              effect.lifetime = SMOKE_DRIFT_LIFETIME;
            }

            effect.damage = 0;
            effect.lightRadius = 0;
            effect._decayedToSmoke = true;
            effect.dissipates = true;
            effect.spawnTime = now;

            effect._smokeChar = SMOKE_VISUAL_CHARS[Math.floor(Math.random() * SMOKE_VISUAL_CHARS.length)];
            effect.char = effect._smokeChar;

            if (typeof DriftVectorSystem !== 'undefined') {
              DriftVectorSystem.initDriftWindBiased(effect);
            } else {
              var dirs8f = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1},
                {dx:1,dy:1},{dx:-1,dy:1},{dx:1,dy:-1},{dx:-1,dy:-1}];
              var df = dirs8f[Math.floor(Math.random() * dirs8f.length)];
              var lenf = Math.sqrt(df.dx*df.dx + df.dy*df.dy);
              effect._driftVX = df.dx / lenf;
              effect._driftVY = df.dy / lenf;
              effect._driftAccumX = 0;
              effect._driftAccumY = 0;
            }
            return;
          }
          effectsToRemove.push(key);
          return;
        }
      }

      // ════════════════════════════════════════════════════════════════
      // SMOKE DRIFT (slide smoke tiles across the map)
      // ════════════════════════════════════════════════════════════════
      if (effect._decayedToSmoke && effect._driftVX !== undefined) {
        // Use DriftVectorSystem.applyDrift if available
        var shift;
        if (typeof DriftVectorSystem !== 'undefined') {
          shift = DriftVectorSystem.applyDrift(effect, dtSec, driftSpeed);
        } else {
          effect._driftAccumX += effect._driftVX * driftSpeed * dtSec;
          effect._driftAccumY += effect._driftVY * driftSpeed * dtSec;
          shift = { shiftX: 0, shiftY: 0 };
          if (Math.abs(effect._driftAccumX) >= 1.0) {
            shift.shiftX = effect._driftAccumX > 0 ? 1 : -1;
            effect._driftAccumX -= shift.shiftX;
          }
          if (Math.abs(effect._driftAccumY) >= 1.0) {
            shift.shiftY = effect._driftAccumY > 0 ? 1 : -1;
            effect._driftAccumY -= shift.shiftY;
          }
        }

        if (shift.shiftX !== 0 || shift.shiftY !== 0) {
          var newX = effect.x + shift.shiftX;
          var newY = effect.y + shift.shiftY;

          if (newX >= 0 && newX < gridWidth && newY >= 0 && newY < gridHeight) {
            var targetKey = newX + ',' + newY;
            var targetEffect = _groundMap[targetKey];
            if (!targetEffect) {
              effectsToRelocate.push({ oldKey: key, effect: effect, newX: newX, newY: newY });
            } else {
              effect.lifetime = Math.max(0.5, effect.lifetime - 0.3);
            }
          } else {
            effectsToRemove.push(key);
          }
        }

        // Fade smoke opacity as it ages
        var smokeAge = (now - effect.spawnTime) / 1000;
        effect._smokeAlpha = Math.max(0.2, 1 - (smokeAge / effect.lifetime));
      }

      // ════════════════════════════════════════════════════════════════
      // FIRE SPREAD (oil ignition, generic fire)
      // ════════════════════════════════════════════════════════════════
      if (effect.spreads && effect.spreadChance) {
        if (Math.random() < effect.spreadChance * dtSec) {
          var directions = [
            { dx:1,dy:0 },{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1},
            {dx:1,dy:1},{dx:-1,dy:1},{dx:1,dy:-1},{dx:-1,dy:-1}
          ];
          var dir = directions[Math.floor(Math.random() * directions.length)];
          var spreadX = effect.x + dir.dx;
          var spreadY = effect.y + dir.dy;

          if (spreadX >= 0 && spreadX < gridWidth && spreadY >= 0 && spreadY < gridHeight) {
            var spreadKey = spreadX + ',' + spreadY;
            var spreadTarget = _groundMap[spreadKey];
            if (!spreadTarget || _isType(spreadTarget, GROUND_TYPES.OIL)) {
              effectsToAdd.push({ x: spreadX, y: spreadY, type: effect.type });
            }
          }
        }
      }
    });

    // Apply removals
    effectsToRemove.forEach(function(key) {
      delete _groundMap[key];
    });

    // Apply smoke relocations (drift)
    effectsToRelocate.forEach(function(reloc) {
      delete _groundMap[reloc.oldKey];
      reloc.effect.x = reloc.newX;
      reloc.effect.y = reloc.newY;
      var newKey = reloc.newX + ',' + reloc.newY;
      if (!_groundMap[newKey]) {
        _groundMap[newKey] = reloc.effect;
      }
    });

    // Apply additions
    effectsToAdd.forEach(function(data) {
      if (data._direct) {
        // Pre-built effect object (e.g. scorch)
        var dk = data.x + ',' + data.y;
        if (!_groundMap[dk]) {
          _groundMap[dk] = data._direct;
        }
      } else {
        setGroundEffect(data.x, data.y, data.type);
      }
    });
  }

  /**
   * Ignite oil at position
   * @param {number} x - X position
   * @param {number} y - Y position
   * @returns {boolean} - Whether ignition succeeded
   */
  function igniteOil(x, y) {
    var effect = getGroundEffect(x, y);
    if (effect && effect.canIgnite) {
      setGroundEffect(x, y, GROUND_TYPES.OIL_IGNITED);
      return true;
    }
    return false;
  }

  /**
   * Extinguish fire at position (using water)
   * @param {number} x - X position
   * @param {number} y - Y position
   * @returns {boolean} - Whether extinguish succeeded
   */
  function extinguishFire(x, y) {
    var effect = getGroundEffect(x, y);
    if (effect && (_isType(effect, GROUND_TYPES.FIRE) || _isType(effect, GROUND_TYPES.OIL_IGNITED))) {
      removeGroundEffect(x, y);
      // Replace with steam
      setGroundEffect(x, y, 'STEAM');

      // Also remove the light emission if LightingSystem is available
      if (typeof LightingSystem !== 'undefined' && LightingSystem.removeLightSource) {
        LightingSystem.removeLightSource(x, y);
      }

      return true;
    }
    return false;
  }

  /**
   * Calculate movement penalty at position
   * @param {number} x - X position
   * @param {number} y - Y position
   * @returns {number} - Movement penalty (0-1, where 0 = no penalty, 1 = blocked)
   */
  function getMovementPenalty(x, y) {
    var effect = getGroundEffect(x, y);
    if (!effect) return 0;

    if (effect.blocksPath) return 1.0;
    // movePenalty may be negative (ice speed boost)
    return (typeof effect.movePenalty === 'number') ? effect.movePenalty : 0;
  }

  /**
   * Calculate damage taken from standing on ground effect
   * @param {number} x - X position
   * @param {number} y - Y position
   * @returns {number} - Damage per turn
   */
  function getDamage(x, y) {
    var effect = getGroundEffect(x, y);
    return effect ? (effect.damage || 0) : 0;
  }

  /**
   * Get STR combat modifiers from ground effect
   * @param {number} x - X position
   * @param {number} y - Y position
   * @returns {object} - Modifiers object
   */
  function getSTRModifiers(x, y) {
    var effect = getGroundEffect(x, y);
    if (!effect) {
      return {
        initiative: 0,
        evasion: 0,
        damage: 1.0,
        addCard: null,
        debuff: null
      };
    }

    var modifiers = {
      initiative: 0,
      evasion: 0,
      damage: 1.0,
      addCard: null,
      debuff: null
    };

    // Oil gives enemy advantage unless player has fire
    if (_isType(effect, GROUND_TYPES.OIL)) {
      modifiers.initiative = -1; // Enemy gets +1 initiative
    }

    // Fire reduces evasion and may add burn card
    if (_isType(effect, GROUND_TYPES.FIRE) || _isType(effect, GROUND_TYPES.OIL_IGNITED)) {
      modifiers.evasion = -0.2; // -20% evasion
      if (Math.random() < (effect.burnCardChance || 0)) {
        modifiers.addCard = 'BURN';
      }
    }

    // Water reduces evasion
    if (_isType(effect, GROUND_TYPES.WATER)) {
      modifiers.evasion = effect.evasionPenalty || -0.1;
    }

    // Ice: speed up but reduce evasion (accuracy handled at combat layer)
    if (_isType(effect, GROUND_TYPES.ICE)) {
      modifiers.evasion = -0.2;
    }

    // Industrial waste gives random debuff
    if (_isType(effect, GROUND_TYPES.INDUSTRIAL_WASTE)) {
      if (Math.random() < (effect.randomDebuffChance || 0.3)) {
        var debuffs = ['POISON', 'WEAK', 'SLOW', 'BLIND'];
        modifiers.debuff = debuffs[Math.floor(Math.random() * debuffs.length)];
      }
    }

    return modifiers;
  }

  /**
   * Get all ground effects as array
   * @returns {Array} - Array of ground effects
   */
  function getAllEffects() {
    return Object.keys(_groundMap).map(function(key) {
      return _groundMap[key];
    });
  }

  /**
   * Get ground effect definition
   * @param {string} type - Ground type
   * @returns {object|null} - Effect definition
   */
  function getDefinition(type) {
    // GROUND_EFFECTS keys are uppercase (FIRE, SMOKE, SCORCHED) but
    // effect.type may be lowercase ('fire', 'smoke', 'scorched') when set
    // via GROUND_TYPES constants. Try both.
    return GROUND_EFFECTS[type] || GROUND_EFFECTS[type.toUpperCase()] || null;
  }

  function getGroundAt(x, y) {
    return getGroundEffect(x, y);
  }

  function freezeAt(x, y, opts) {
    opts = opts || {};
    var effect = getGroundEffect(x, y);
    if (effect && (_isType(effect, GROUND_TYPES.WATER) || _isType(effect, GROUND_TYPES.INDUSTRIAL_WASTE))) {
      setGroundEffect(x, y, GROUND_TYPES.ICE, {
        dissipates: true,
        lifetime: (typeof opts.lifetime === 'number') ? opts.lifetime : 10
      });
      return true;
    }

    // If empty, allow direct ice placement
    if (!effect) {
      setGroundEffect(x, y, GROUND_TYPES.ICE, {
        dissipates: true,
        lifetime: (typeof opts.lifetime === 'number') ? opts.lifetime : 10
      });
      return true;
    }

    return false;
  }

  // Locomotive passability gate: water/waste are not passable unless frozen to ICE.
  function isLocomotivePassable(x, y) {
    var effect = getGroundEffect(x, y);
    if (!effect) return true;
    if (_isType(effect, GROUND_TYPES.ICE)) return true;
    if (_isType(effect, GROUND_TYPES.WATER) || _isType(effect, GROUND_TYPES.INDUSTRIAL_WASTE)) return false;
    return true;
  }

  // Public API
  return {
    init: init,
    GROUND_TYPES: GROUND_TYPES,
    setGroundEffect: setGroundEffect,
    getGroundEffect: getGroundEffect,
    getGroundAt: getGroundAt,
    removeGroundEffect: removeGroundEffect,
    clearAll: clearAll,
    update: update,
    igniteOil: igniteOil,
    extinguishFire: extinguishFire,
    getMovementPenalty: getMovementPenalty,
    getDamage: getDamage,
    getSTRModifiers: getSTRModifiers,
    freezeAt: freezeAt,
    isLocomotivePassable: isLocomotivePassable,
    getAllEffects: getAllEffects,
    getDefinition: getDefinition
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GroundEffects;
}
