/**
 * PlayerWeaponArrow — 360° orbiting weapon indicator around the player.
 *
 * A small monochromatic arrow orbits the player avatar showing the current
 * "weapon facing" direction. The arrow smoothly interpolates toward a target
 * angle set by the highest-priority recent input:
 *
 *   Priority (highest first):
 *     1. Projectile fire direction   (instant snap, fades to smooth)
 *     2. Kick direction              (instant snap)
 *     3. Theft / grapple target      (smooth turn)
 *     4. Movement direction           (smooth turn)
 *
 * When entering STR combat, the arrow angle is blended with the combat-math
 * facing direction (biased toward the orbiting arrow's "toy" feel).
 *
 * Rendered by CanvasRenderer._renderWeaponArrow() inside the camera-
 * transformed pipeline.
 */
var PlayerWeaponArrow = (function() {
  'use strict';

  // ── State ──
  var _currentAngle = 0;   // Radians, 0 = east, π/2 = south (canvas convention)
  var _targetAngle  = 0;   // Where we're interpolating toward
  var _muzzleFlashT = 0;   // Timestamp of last fire (for bright pulse)
  var _visible      = true;

  // ── Config ──
  var SMOOTH_SPEED    = 12;    // Radians/sec interpolation speed (fast but not instant)
  var SNAP_SPEED      = 40;    // Radians/sec for fire/kick (nearly instant)
  var ORBIT_RADIUS    = 0.38;  // Fraction of cellSize from center
  var ARROW_SIZE      = 0.28;  // Fraction of cellSize
  var MUZZLE_DURATION = 250;   // ms of bright flash on fire
  var BASE_COLOR      = '#AAAAAA';
  var FLASH_COLOR     = '#FFFF66';

  // ── Direction → angle (radians, canvas convention) ──
  var DIR_ANGLES = {
    east:      0,
    southeast: Math.PI * 0.25,
    south:     Math.PI * 0.5,
    southwest: Math.PI * 0.75,
    west:      Math.PI,
    northwest: Math.PI * 1.25,
    north:     Math.PI * 1.5,
    northeast: Math.PI * 1.75
  };

  /**
   * Convert a named direction to radians.
   * Also accepts { dx, dy } for arbitrary angles.
   */
  function _dirToAngle(dir) {
    if (typeof dir === 'string' && DIR_ANGLES[dir] !== undefined) {
      return DIR_ANGLES[dir];
    }
    if (dir && typeof dir === 'object' && isFinite(dir.dx) && isFinite(dir.dy)) {
      return Math.atan2(dir.dy, dir.dx);
    }
    return _currentAngle; // no change
  }

  /**
   * Shortest-arc interpolation from current to target.
   */
  function _lerpAngle(from, to, speed, dt) {
    var diff = to - from;
    // Wrap to [-π, π]
    while (diff > Math.PI)  diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    var step = speed * dt;
    if (Math.abs(diff) <= step) return to;
    return from + (diff > 0 ? step : -step);
  }

  // ── Public API ──

  /**
   * Set target from movement direction (lowest priority, smooth).
   * @param {string} dir — "north", "south", "east", "west"
   */
  function setMovementDirection(dir) {
    if (!dir) return;
    _targetAngle = _dirToAngle(dir);
  }

  /**
   * Set target from firing direction (highest priority, near-instant snap).
   * Also triggers muzzle flash pulse.
   * @param {string|{dx,dy}} dir
   */
  function setFireDirection(dir) {
    if (!dir) return;
    _targetAngle = _dirToAngle(dir);
    _currentAngle = _targetAngle; // instant snap on fire
    _muzzleFlashT = performance.now();
  }

  /**
   * Set target from kick direction (high priority, instant snap).
   * @param {number} dx — grid delta x (-1, 0, 1)
   * @param {number} dy — grid delta y (-1, 0, 1)
   */
  function setKickDirection(dx, dy) {
    _targetAngle = Math.atan2(dy, dx);
    _currentAngle = _targetAngle; // snap
  }

  /**
   * Set target from theft/grapple target tile (smooth).
   * @param {number} dx — delta x to target
   * @param {number} dy — delta y to target
   */
  function setInteractDirection(dx, dy) {
    if (dx === 0 && dy === 0) return;
    _targetAngle = Math.atan2(dy, dx);
  }

  /**
   * Set target from arbitrary angle in radians.
   * @param {number} angle
   * @param {boolean} [snap] — if true, jump immediately
   */
  function setAngle(angle, snap) {
    _targetAngle = angle;
    if (snap) _currentAngle = angle;
  }

  /**
   * Get the current arrow angle (radians). Used for STR combat blend.
   */
  function getAngle() {
    return _currentAngle;
  }

  /**
   * Get current facing as cardinal direction string (for combat math).
   * Returns the nearest of "north", "south", "east", "west".
   */
  function getFacingCardinal() {
    // Normalize to [0, 2π)
    var a = _currentAngle % (Math.PI * 2);
    if (a < 0) a += Math.PI * 2;
    if (a < Math.PI * 0.25 || a >= Math.PI * 1.75) return 'east';
    if (a < Math.PI * 0.75) return 'south';
    if (a < Math.PI * 1.25) return 'west';
    return 'north';
  }

  /**
   * Update interpolation each frame.
   * @param {number} dt — seconds since last frame
   */
  function update(dt) {
    if (!dt || dt <= 0) return;
    // Use snap speed briefly after fire/kick, smooth otherwise
    var now = performance.now();
    var speed = (now - _muzzleFlashT < 150) ? SNAP_SPEED : SMOOTH_SPEED;
    _currentAngle = _lerpAngle(_currentAngle, _targetAngle, speed, dt);
  }

  /**
   * Render the arrow on a canvas context.
   * Called by CanvasRenderer._renderWeaponArrow() with the camera transform active.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} centerX — player center in canvas pixels
   * @param {number} centerY — player center in canvas pixels
   * @param {number} cellSize — current cell size in pixels
   */
  function render(ctx, centerX, centerY, cellSize) {
    if (!_visible) return;

    var r = ORBIT_RADIUS * cellSize;
    var ax = centerX + Math.cos(_currentAngle) * r;
    var ay = centerY + Math.sin(_currentAngle) * r;
    var size = ARROW_SIZE * cellSize;

    // Muzzle flash pulse
    var now = performance.now();
    var flashAge = now - _muzzleFlashT;
    var isFlashing = flashAge < MUZZLE_DURATION;
    var flashAlpha = isFlashing ? Math.max(0, 1 - (flashAge / MUZZLE_DURATION)) : 0;

    ctx.save();

    // Draw arrow triangle pointing in _currentAngle direction
    var tipX = ax + Math.cos(_currentAngle) * size * 0.5;
    var tipY = ay + Math.sin(_currentAngle) * size * 0.5;
    var baseAngle1 = _currentAngle + Math.PI * 0.8;
    var baseAngle2 = _currentAngle - Math.PI * 0.8;
    var b1x = ax + Math.cos(baseAngle1) * size * 0.35;
    var b1y = ay + Math.sin(baseAngle1) * size * 0.35;
    var b2x = ax + Math.cos(baseAngle2) * size * 0.35;
    var b2y = ay + Math.sin(baseAngle2) * size * 0.35;

    // Flash glow
    if (isFlashing) {
      ctx.shadowColor = FLASH_COLOR;
      ctx.shadowBlur = 8 * flashAlpha;
    }

    // Base arrow (always visible)
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = isFlashing
      ? _lerpColor(BASE_COLOR, FLASH_COLOR, flashAlpha)
      : BASE_COLOR;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(b1x, b1y);
    ctx.lineTo(b2x, b2y);
    ctx.closePath();
    ctx.fill();

    // Subtle outline
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Lerp between two hex colors.
   */
  function _lerpColor(c1, c2, t) {
    var r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
    var r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
    var r = Math.round(r1 + (r2 - r1) * t);
    var g = Math.round(g1 + (g2 - g1) * t);
    var b = Math.round(b1 + (b2 - b1) * t);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function setVisible(v) { _visible = !!v; }
  function isVisible() { return _visible; }

  function reset() {
    _currentAngle = 0;
    _targetAngle = 0;
    _muzzleFlashT = 0;
    _visible = true;
  }

  return {
    setMovementDirection: setMovementDirection,
    setFireDirection: setFireDirection,
    setKickDirection: setKickDirection,
    setInteractDirection: setInteractDirection,
    setAngle: setAngle,
    getAngle: getAngle,
    getFacingCardinal: getFacingCardinal,
    update: update,
    render: render,
    setVisible: setVisible,
    isVisible: isVisible,
    reset: reset
  };
})();
