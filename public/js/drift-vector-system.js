/**
 * DriftVectorSystem — standalone module for wind/drift vector generation.
 * Extracted from ground-effects.js for reuse by the biome weather system
 * (UNIFIED_DESIGNER_GUIDE), stealth noise mechanics, and any future
 * environmental animation that needs directional drift.
 *
 * Public API:
 *   DriftVectorSystem.pickDirection()          → { dx, dy } normalized 8-compass
 *   DriftVectorSystem.pickDirectionBiased(bias) → { dx, dy } weighted toward bias
 *   DriftVectorSystem.setGlobalWind(dx, dy)    → set persistent wind vector
 *   DriftVectorSystem.getGlobalWind()          → { dx, dy } current global wind
 *   DriftVectorSystem.applyDrift(effect, dtSec, speed) → { shiftX, shiftY }
 *   DriftVectorSystem.DRIFT_SPEED              → default drift speed constant
 *
 * Stateless except for the optional global wind vector.
 */
var DriftVectorSystem = (function() {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────
  var DRIFT_SPEED = 0.4;        // Default tiles-per-second drift rate
  var DRIFT_SPEED_FAST = 0.7;   // Fast drift (e.g. strong wind biome)
  var DRIFT_SPEED_SLOW = 0.2;   // Slow drift (e.g. calm interior)

  // 8-compass directions (N, S, E, W, NE, NW, SE, SW)
  var DIRECTIONS_8 = [
    { dx:  1, dy:  0 },  // E
    { dx: -1, dy:  0 },  // W
    { dx:  0, dy:  1 },  // S
    { dx:  0, dy: -1 },  // N
    { dx:  1, dy:  1 },  // SE
    { dx: -1, dy:  1 },  // SW
    { dx:  1, dy: -1 },  // NE
    { dx: -1, dy: -1 }   // NW
  ];

  // 4-cardinal directions only
  var DIRECTIONS_4 = [
    { dx:  1, dy:  0 },  // E
    { dx: -1, dy:  0 },  // W
    { dx:  0, dy:  1 },  // S
    { dx:  0, dy: -1 }   // N
  ];

  // ── Global wind state ──────────────────────────────────────────────
  // Optional persistent wind direction. When set, pickDirectionBiased()
  // favors this direction. Biome/weather systems can set this.
  var _globalWind = { dx: 0, dy: 0 };

  // ════════════════════════════════════════════════════════════════════
  //  PUBLIC: Direction generation
  // ════════════════════════════════════════════════════════════════════

  /**
   * Pick a random 8-compass drift direction, normalized for diagonal consistency.
   * @returns {{ dx: number, dy: number }} Unit-length direction vector
   */
  function pickDirection() {
    var d = DIRECTIONS_8[Math.floor(Math.random() * DIRECTIONS_8.length)];
    var len = Math.sqrt(d.dx * d.dx + d.dy * d.dy);
    return { dx: d.dx / len, dy: d.dy / len };
  }

  /**
   * Pick a drift direction biased toward a given vector.
   * 60% chance to align with bias, 40% random. If no bias, fully random.
   * @param {{ dx: number, dy: number }} [bias] - Preferred direction (e.g. global wind)
   * @returns {{ dx: number, dy: number }} Unit-length direction vector
   */
  function pickDirectionBiased(bias) {
    bias = bias || _globalWind;
    // If no meaningful bias, return random
    if (Math.abs(bias.dx) < 0.01 && Math.abs(bias.dy) < 0.01) {
      return pickDirection();
    }

    // 60% chance to follow bias direction
    if (Math.random() < 0.6) {
      var len = Math.sqrt(bias.dx * bias.dx + bias.dy * bias.dy) || 1;
      return { dx: bias.dx / len, dy: bias.dy / len };
    }

    return pickDirection();
  }

  /**
   * Pick a random 4-cardinal direction (no diagonals).
   * @returns {{ dx: number, dy: number }} Unit-length direction vector
   */
  function pickCardinalDirection() {
    var d = DIRECTIONS_4[Math.floor(Math.random() * DIRECTIONS_4.length)];
    return { dx: d.dx, dy: d.dy };
  }

  // ════════════════════════════════════════════════════════════════════
  //  PUBLIC: Global wind
  // ════════════════════════════════════════════════════════════════════

  /**
   * Set the global wind direction. All biased drift will tend toward this.
   * @param {number} dx - Wind X component (-1 to 1)
   * @param {number} dy - Wind Y component (-1 to 1)
   */
  function setGlobalWind(dx, dy) {
    _globalWind = { dx: dx || 0, dy: dy || 0 };
  }

  /**
   * Get the current global wind vector.
   * @returns {{ dx: number, dy: number }}
   */
  function getGlobalWind() {
    return { dx: _globalWind.dx, dy: _globalWind.dy };
  }

  // ════════════════════════════════════════════════════════════════════
  //  PUBLIC: Drift accumulation
  // ════════════════════════════════════════════════════════════════════

  /**
   * Apply drift accumulation to an effect object that has _driftVX, _driftVY,
   * _driftAccumX, _driftAccumY properties. Returns tile shift if threshold crossed.
   *
   * @param {Object} effect - Must have _driftVX, _driftVY, _driftAccumX, _driftAccumY
   * @param {number} dtSec  - Delta time in seconds
   * @param {number} [speed] - Drift speed override (default: DRIFT_SPEED)
   * @returns {{ shiftX: number, shiftY: number }} Integer tile shifts (0 if no shift)
   */
  function applyDrift(effect, dtSec, speed) {
    speed = (speed !== undefined) ? speed : DRIFT_SPEED;

    effect._driftAccumX += (effect._driftVX || 0) * speed * dtSec;
    effect._driftAccumY += (effect._driftVY || 0) * speed * dtSec;

    var shiftX = 0, shiftY = 0;

    if (Math.abs(effect._driftAccumX) >= 1.0) {
      shiftX = effect._driftAccumX > 0 ? 1 : -1;
      effect._driftAccumX -= shiftX;
    }
    if (Math.abs(effect._driftAccumY) >= 1.0) {
      shiftY = effect._driftAccumY > 0 ? 1 : -1;
      effect._driftAccumY -= shiftY;
    }

    return { shiftX: shiftX, shiftY: shiftY };
  }

  /**
   * Initialize drift properties on an object.
   * @param {Object} target - Object to add drift properties to
   * @param {{ dx: number, dy: number }} [direction] - Drift direction (random if omitted)
   */
  function initDrift(target, direction) {
    var dir = direction || pickDirection();
    target._driftVX = dir.dx;
    target._driftVY = dir.dy;
    target._driftAccumX = 0;
    target._driftAccumY = 0;
  }

  /**
   * Initialize drift with global wind bias.
   * @param {Object} target - Object to add drift properties to
   */
  function initDriftWindBiased(target) {
    var dir = pickDirectionBiased(_globalWind);
    target._driftVX = dir.dx;
    target._driftVY = dir.dy;
    target._driftAccumX = 0;
    target._driftAccumY = 0;
  }

  // ════════════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ════════════════════════════════════════════════════════════════════

  return {
    // Direction generation
    pickDirection: pickDirection,
    pickDirectionBiased: pickDirectionBiased,
    pickCardinalDirection: pickCardinalDirection,

    // Global wind
    setGlobalWind: setGlobalWind,
    getGlobalWind: getGlobalWind,

    // Drift accumulation helpers
    applyDrift: applyDrift,
    initDrift: initDrift,
    initDriftWindBiased: initDriftWindBiased,

    // Constants
    DRIFT_SPEED: DRIFT_SPEED,
    DRIFT_SPEED_FAST: DRIFT_SPEED_FAST,
    DRIFT_SPEED_SLOW: DRIFT_SPEED_SLOW,
    DIRECTIONS_8: DIRECTIONS_8,
    DIRECTIONS_4: DIRECTIONS_4
  };
})();
