/* ============================================================
   ScreenFX — Full-screen visual effects for ArcadeEngine games
   Extracted from Gone Rogue's combat flash / impact systems.
   Standalone IIFE, no dependencies. Works with any canvas game.

   Usage:
     var fx = new ScreenFX();
     fx.flash('#ff0000', 12);          // red hit flash, 12 frames
     fx.flash('#ffffff', 6, 0.8);      // bright white flash
     fx.vignette('#000000', 0.6, 60);  // dark vignette, 60 frames
     fx.fade('#000000', 30, 'in');     // fade to black over 30 frames
     fx.fade('#000000', 30, 'out');    // fade from black over 30 frames
     // in update loop:
     fx.update();
     // in draw loop (LAST, on top of everything):
     fx.draw(ctx, W, H);
   ============================================================ */
(function () {
  'use strict';

  /**
   * @constructor
   * @param {number} [maxEffects=8] — max concurrent effects (oldest culled)
   */
  function ScreenFX(maxEffects) {
    this._max = maxEffects || 8;
    this._effects = [];
  }

  // ── Effect types ──

  var TYPE_FLASH    = 1;
  var TYPE_VIGNETTE = 2;
  var TYPE_FADE     = 3;

  // ── Public API ──

  /**
   * Full-screen color flash that fades out.
   * @param {string} color    — CSS color ('#ff0000', 'rgba(255,0,0,0.5)')
   * @param {number} duration — frames to fade out (default 10)
   * @param {number} [alpha]  — peak alpha 0–1 (default 0.5)
   */
  ScreenFX.prototype.flash = function (color, duration, alpha) {
    this._push({
      type: TYPE_FLASH,
      color: color || '#ffffff',
      duration: duration || 10,
      timer: 0,
      peakAlpha: alpha != null ? alpha : 0.5
    });
  };

  /**
   * Edge-darkening vignette that fades in then out.
   * @param {string} color    — vignette color (default '#000000')
   * @param {number} intensity — 0–1 how dark the edges get (default 0.5)
   * @param {number} duration — total frames (default 60)
   */
  ScreenFX.prototype.vignette = function (color, intensity, duration) {
    this._push({
      type: TYPE_VIGNETTE,
      color: color || '#000000',
      duration: duration || 60,
      timer: 0,
      intensity: intensity != null ? intensity : 0.5
    });
  };

  /**
   * Full-screen fade in or out.
   * @param {string} color     — fade color (default '#000000')
   * @param {number} duration  — frames (default 30)
   * @param {string} direction — 'in' (transparent→opaque) or 'out' (opaque→transparent)
   * @param {number} [hold]    — frames to hold at peak before fading (default 0)
   */
  ScreenFX.prototype.fade = function (color, duration, direction, hold) {
    this._push({
      type: TYPE_FADE,
      color: color || '#000000',
      duration: duration || 30,
      timer: 0,
      direction: direction === 'out' ? -1 : 1,
      hold: hold || 0,
      holdTimer: 0
    });
  };

  /**
   * Tick all active effects. Call once per frame.
   */
  ScreenFX.prototype.update = function () {
    for (var i = this._effects.length - 1; i >= 0; i--) {
      var e = this._effects[i];
      e.timer++;
      if (e.type === TYPE_FADE && e.direction === 1 && e.timer >= e.duration) {
        // fade-in reached peak — hold
        e.holdTimer++;
        if (e.holdTimer > e.hold) {
          this._effects.splice(i, 1);
        }
      } else if (e.timer >= e.duration) {
        this._effects.splice(i, 1);
      }
    }
  };

  /**
   * Draw all active effects. Call LAST in your draw loop.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} W — canvas width
   * @param {number} H — canvas height
   */
  ScreenFX.prototype.draw = function (ctx, W, H) {
    for (var i = 0; i < this._effects.length; i++) {
      var e = this._effects[i];
      if (e.type === TYPE_FLASH) {
        this._drawFlash(ctx, W, H, e);
      } else if (e.type === TYPE_VIGNETTE) {
        this._drawVignette(ctx, W, H, e);
      } else if (e.type === TYPE_FADE) {
        this._drawFade(ctx, W, H, e);
      }
    }
  };

  /**
   * Remove all active effects.
   */
  ScreenFX.prototype.clear = function () {
    this._effects.length = 0;
  };

  /**
   * Number of active effects.
   */
  ScreenFX.prototype.count = function () {
    return this._effects.length;
  };

  /**
   * Check if any effect of a given type is active.
   * @param {string} type — 'flash', 'vignette', or 'fade'
   */
  ScreenFX.prototype.isActive = function (type) {
    var t = type === 'flash' ? TYPE_FLASH : type === 'vignette' ? TYPE_VIGNETTE : TYPE_FADE;
    for (var i = 0; i < this._effects.length; i++) {
      if (this._effects[i].type === t) return true;
    }
    return false;
  };

  // ── Internal ──

  ScreenFX.prototype._push = function (effect) {
    this._effects.push(effect);
    // Cull oldest if over cap
    while (this._effects.length > this._max) {
      this._effects.shift();
    }
  };

  ScreenFX.prototype._drawFlash = function (ctx, W, H, e) {
    var progress = e.timer / e.duration;  // 0→1
    var alpha = e.peakAlpha * (1 - progress);
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = e.color;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  };

  ScreenFX.prototype._drawVignette = function (ctx, W, H, e) {
    var progress = e.timer / e.duration;
    // Fade in first 20%, hold, fade out last 20%
    var alpha;
    if (progress < 0.2) {
      alpha = (progress / 0.2) * e.intensity;
    } else if (progress > 0.8) {
      alpha = ((1 - progress) / 0.2) * e.intensity;
    } else {
      alpha = e.intensity;
    }
    if (alpha <= 0) return;

    var cx = W * 0.5;
    var cy = H * 0.5;
    var outerR = Math.max(W, H) * 0.75;
    var innerR = Math.min(W, H) * 0.25;

    ctx.save();
    ctx.globalAlpha = alpha;
    var grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, e.color);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  };

  ScreenFX.prototype._drawFade = function (ctx, W, H, e) {
    var alpha;
    if (e.direction === 1) {
      // Fade in (transparent → opaque)
      alpha = Math.min(1, e.timer / e.duration);
    } else {
      // Fade out (opaque → transparent)
      alpha = Math.max(0, 1 - e.timer / e.duration);
    }
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = e.color;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  };

  // ── Export ──
  window.ScreenFX = ScreenFX;

})();
