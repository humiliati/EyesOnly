/**
 * SpriteFxSystem — Manages sprite-based visual effects (kick, knockback, removal).
 *
 * FX003 (LightFX)  — 5 frames, kick flash between player & target
 * FX001 (Smoke)    — 5 frames, removal/poof smoke where entity was removed
 * FX002 (Smoke)    — 8 frames, knockback impact between player & force source
 *
 * All sprites are 32×32 PNGs. Effects are stored in an internal array
 * and consumed by the canvas renderer each frame.
 */
var SpriteFxSystem = (function() {
  'use strict';

  // ── Sprite preloading ──
  var _kickFrames = [];       // FX003: 5 frames (kick flash)
  var _removalFrames = [];    // FX001: 5 frames (removal smoke)
  var _knockbackFrames = [];  // FX002: 8 frames (knockback impact)
  var _loaded = { kick: false, removal: false, knockback: false };

  (function _preload() {
    var i, img;

    // FX003 — Kick (LightFX)
    for (i = 1; i <= 5; i++) {
      img = new Image();
      img.src = 'assets/Sprites/LightFX/FX003/FX003_0' + i + '.png';
      _kickFrames.push(img);
    }
    _kickFrames[4].onload = function() { _loaded.kick = true; };

    // FX001 — Removal / Poof (Smoke)
    for (i = 1; i <= 5; i++) {
      img = new Image();
      img.src = 'assets/Sprites/Smoke/FX001/FX001_0' + i + '.png';
      _removalFrames.push(img);
    }
    _removalFrames[4].onload = function() { _loaded.removal = true; };

    // FX002 — Knockback (Smoke)
    for (i = 1; i <= 8; i++) {
      img = new Image();
      img.src = 'assets/Sprites/Smoke/FX002/FX002_0' + i + '.png';
      _knockbackFrames.push(img);
    }
    _knockbackFrames[7].onload = function() { _loaded.knockback = true; };

    // Fallback: mark all loaded after 3s regardless
    setTimeout(function() {
      _loaded.kick = true;
      _loaded.removal = true;
      _loaded.knockback = true;
    }, 3000);
  })();

  // ── Active effects ──
  // Each effect: { type, x, y, startTime, duration, frames[], frameInterval,
  //                rotation, zBoost, zBoostAfterFrame, direction }
  var _activeEffects = [];

  // ── Constants ──
  var KICK_FRAME_MS = 50;       // 5 frames × 50ms = 250ms total
  var REMOVAL_FRAME_MS = 60;    // 5 frames × 60ms = 300ms total
  var KNOCKBACK_FRAME_MS = 40;  // 8 frames × 40ms = 320ms total

  // ── Effect creation ──

  /**
   * Spawn a kick effect (FX003) between player and adjacent target.
   * @param {number} playerX - Player tile X
   * @param {number} playerY - Player tile Y
   * @param {number} dx - Direction X (-1, 0, 1)
   * @param {number} dy - Direction Y (-1, 0, 1)
   */
  function spawnKick(playerX, playerY, dx, dy) {
    if (!_loaded.kick) return;
    // Position: halfway between player and target
    var fx = playerX + dx * 0.5;
    var fy = playerY + dy * 0.5;
    // Rotation: point the kick burst in the direction of the kick
    var rotation = Math.atan2(dy, dx);

    _activeEffects.push({
      type: 'kick',
      x: fx,
      y: fy,
      startTime: Date.now(),
      duration: _kickFrames.length * KICK_FRAME_MS,
      frames: _kickFrames,
      frameInterval: KICK_FRAME_MS,
      rotation: rotation,
      zBoost: 0,
      zBoostAfterFrame: -1,
      direction: { dx: dx, dy: dy }
    });
  }

  /**
   * Spawn a removal/poof effect (FX001) at the position of a removed entity.
   * @param {number} x - Tile X where entity was removed
   * @param {number} y - Tile Y where entity was removed
   */
  function spawnRemoval(x, y) {
    if (!_loaded.removal) return;

    _activeEffects.push({
      type: 'removal',
      x: x,
      y: y,
      startTime: Date.now(),
      duration: _removalFrames.length * REMOVAL_FRAME_MS,
      frames: _removalFrames,
      frameInterval: REMOVAL_FRAME_MS,
      rotation: 0,
      zBoost: 0,
      zBoostAfterFrame: -1,
      direction: null
    });
  }

  /**
   * Spawn a knockback effect (FX002) between the force source and the entity.
   * If knockback pushes southward (toward perspective), the knocked-back entity
   * gets a z-layer boost after frame 2 to appear to shift upward in layering.
   *
   * @param {number} entityX - Entity being knocked back (original position)
   * @param {number} entityY
   * @param {number} sourceX - Source of the force (epicenter)
   * @param {number} sourceY
   * @param {number} dx - Normalized push direction X
   * @param {number} dy - Normalized push direction Y
   */
  function spawnKnockback(entityX, entityY, sourceX, sourceY, dx, dy) {
    if (!_loaded.knockback) return;

    // Position: between source and entity (closer to entity)
    var fx = entityX - dx * 0.4;
    var fy = entityY - dy * 0.4;
    var rotation = Math.atan2(dy, dx);

    // Southward knockback (dy > 0) = pushed toward perspective camera
    // After frame 2, the knocked-back object should appear to rise in z-order
    var isSouthward = dy > 0;

    _activeEffects.push({
      type: 'knockback',
      x: fx,
      y: fy,
      startTime: Date.now(),
      duration: _knockbackFrames.length * KNOCKBACK_FRAME_MS,
      frames: _knockbackFrames,
      frameInterval: KNOCKBACK_FRAME_MS,
      rotation: rotation,
      // z-boost: render above other entities after frame 2 for southward push
      zBoost: isSouthward ? 10 : 0,
      zBoostAfterFrame: isSouthward ? 2 : -1,
      direction: { dx: dx, dy: dy }
    });
  }

  /**
   * Get all active effects for the current frame.
   * Each returned object includes the current sprite Image and render metadata.
   * Expired effects are pruned automatically.
   *
   * @returns {Array<{ type, x, y, img, rotation, scale, alpha, zBoost }>}
   */
  function getActiveEffects() {
    var now = Date.now();
    var result = [];
    var survivors = [];

    for (var i = 0; i < _activeEffects.length; i++) {
      var ef = _activeEffects[i];
      var elapsed = now - ef.startTime;

      // Expired?
      if (elapsed >= ef.duration) continue;

      survivors.push(ef);

      // Which frame?
      var frameIdx = Math.min(
        ef.frames.length - 1,
        Math.floor(elapsed / ef.frameInterval)
      );
      var img = ef.frames[frameIdx];
      if (!img || !img.complete) continue;

      // Scale: start slightly larger, settle to 1.0
      // Kick: pulse from 1.3→1.0; Removal: expand 0.8→1.2; Knockback: 1.0→0.7
      var progress = elapsed / ef.duration; // 0→1
      var scale = 1.0;
      if (ef.type === 'kick') {
        scale = 1.3 - 0.3 * progress;
      } else if (ef.type === 'removal') {
        scale = 0.8 + 0.4 * progress;
      } else if (ef.type === 'knockback') {
        scale = 1.0 - 0.3 * progress;
      }

      // Alpha: solid then fade out in last 30%
      var alpha = 1.0;
      if (progress > 0.7) {
        alpha = 1.0 - ((progress - 0.7) / 0.3);
      }

      // z-boost activation check
      var activeZBoost = 0;
      if (ef.zBoostAfterFrame >= 0 && frameIdx >= ef.zBoostAfterFrame) {
        activeZBoost = ef.zBoost;
      }

      result.push({
        type: ef.type,
        x: ef.x,
        y: ef.y,
        img: img,
        rotation: ef.rotation,
        scale: scale,
        alpha: alpha,
        zBoost: activeZBoost,
        direction: ef.direction
      });
    }

    _activeEffects = survivors;
    return result;
  }

  /**
   * Clear all active effects (e.g. on floor transition).
   */
  function reset() {
    _activeEffects = [];
  }

  return {
    spawnKick: spawnKick,
    spawnRemoval: spawnRemoval,
    spawnKnockback: spawnKnockback,
    getActiveEffects: getActiveEffects,
    reset: reset,
    isLoaded: function() { return _loaded.kick && _loaded.removal && _loaded.knockback; }
  };
})();
