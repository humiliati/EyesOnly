/**
 * SideScrollCamera — Genre Helper Module
 *
 * Viewport tracking for side-scrolling games. Handles auto-scroll,
 * look-ahead bias, screen shake, and parallax layer rendering.
 *
 * Usage:
 *   var cam = new SideScrollCamera(logicalW, logicalH, {
 *     speed: 2.2,            // base scroll speed (px/frame)
 *     maxSpeed: 5.5,         // speed cap
 *     accel: 0.00004,        // speed increase per distance unit
 *     lookAheadX: 0.25,      // player target position (% from left)
 *     parallax: [            // background layers (optional)
 *       { speed: 0.05, y: 0.5, color: 'rgba(28,255,155,0.04)' },
 *       { speed: 0.12, y: 0.45, color: 'rgba(28,255,155,0.06)' }
 *     ]
 *   });
 *
 *   // In onUpdate:
 *   cam.update(distance);       // auto-scroll based on distance
 *   cam.follow(player.x, 0.1); // optional: smooth follow player X
 *
 *   // In onDraw:
 *   cam.applyShake(ctx);        // ctx.translate with shake offset
 *   cam.drawParallax(ctx, W, H);
 *   cam.toScreen(worldX);       // convert world X to screen X
 *   cam.endShake(ctx);          // ctx.restore shake
 *
 *   // Trigger effects:
 *   cam.shake(duration, intensity);
 *
 * Depends on: nothing (standalone)
 */
var SideScrollCamera = (function () {
  'use strict';

  var DEFAULT_OPTS = {
    speed: 2.2,
    maxSpeed: 5.5,
    accel: 0.00004,
    lookAheadX: 0.25,
    parallax: []
  };

  function SideScrollCamera(viewW, viewH, opts) {
    opts = opts || {};
    this.viewW = viewW;
    this.viewH = viewH;

    // Scroll state
    this.x = 0;
    this.y = 0;
    this.speed = opts.speed != null ? opts.speed : DEFAULT_OPTS.speed;
    this.baseSpeed = this.speed;
    this.maxSpeed = opts.maxSpeed != null ? opts.maxSpeed : DEFAULT_OPTS.maxSpeed;
    this.accel = opts.accel != null ? opts.accel : DEFAULT_OPTS.accel;
    this.lookAheadX = opts.lookAheadX != null ? opts.lookAheadX : DEFAULT_OPTS.lookAheadX;

    // Shake
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
    this._shakeOffsetX = 0;
    this._shakeOffsetY = 0;

    // Parallax layers
    this.parallax = opts.parallax || DEFAULT_OPTS.parallax;
  }

  /**
   * Update camera position. Call once per frame in onUpdate.
   * @param {number} distance — total distance traveled (for speed ramp)
   */
  SideScrollCamera.prototype.update = function (distance) {
    // Ramp speed with distance
    this.speed = Math.min(this.maxSpeed, this.baseSpeed + distance * this.accel);
    this.x += this.speed;

    // Decay shake
    if (this.shakeTimer > 0) {
      this.shakeTimer--;
      this._shakeOffsetX = (Math.random() - 0.5) * this.shakeIntensity;
      this._shakeOffsetY = (Math.random() - 0.5) * this.shakeIntensity;
    } else {
      this._shakeOffsetX = 0;
      this._shakeOffsetY = 0;
    }
  };

  /**
   * Smooth-follow a world X position (for player tracking).
   * Adjusts camera.x so the target sits at lookAheadX fraction of the screen.
   * @param {number} worldX — target world X
   * @param {number} lerp — smoothing factor (0-1, lower = smoother)
   */
  SideScrollCamera.prototype.follow = function (worldX, lerp) {
    var targetCamX = worldX - this.viewW * this.lookAheadX;
    this.x += (targetCamX - this.x) * (lerp || 0.1);
  };

  /**
   * Convert world X to screen X.
   */
  SideScrollCamera.prototype.toScreen = function (worldX) {
    return worldX - this.x;
  };

  /**
   * Convert screen X to world X.
   */
  SideScrollCamera.prototype.toWorld = function (screenX) {
    return screenX + this.x;
  };

  /**
   * Check if a world-space rect is visible on screen.
   * @param {number} worldX
   * @param {number} w — width
   * @param {number} margin — extra margin (default 50)
   */
  SideScrollCamera.prototype.isVisible = function (worldX, w, margin) {
    margin = margin || 50;
    var sx = worldX - this.x;
    return sx + w > -margin && sx < this.viewW + margin;
  };

  /**
   * Trigger screen shake.
   * @param {number} duration — frames
   * @param {number} intensity — max pixel offset
   */
  SideScrollCamera.prototype.shake = function (duration, intensity) {
    this.shakeTimer = duration;
    this.shakeIntensity = intensity;
  };

  /**
   * Apply shake translation to canvas context. Call before drawing.
   * @param {CanvasRenderingContext2D} ctx
   */
  SideScrollCamera.prototype.applyShake = function (ctx) {
    ctx.save();
    if (this.shakeTimer > 0) {
      ctx.translate(this._shakeOffsetX, this._shakeOffsetY);
    }
  };

  /**
   * End shake (restore canvas context). Call after drawing.
   * @param {CanvasRenderingContext2D} ctx
   */
  SideScrollCamera.prototype.endShake = function (ctx) {
    ctx.restore();
  };

  /**
   * Draw parallax background layers.
   * Each layer: { speed, y, color, buildingW?, spacing? }
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} W — canvas logical width
   * @param {number} H — canvas logical height
   */
  SideScrollCamera.prototype.drawParallax = function (ctx, W, H) {
    for (var i = 0; i < this.parallax.length; i++) {
      var layer = this.parallax[i];
      ctx.fillStyle = layer.color;

      var bw = layer.buildingW || (40 + i * 20);
      var spacing = layer.spacing || (bw + 15);
      var layerOffset = this.x * layer.speed;
      var startX = -(layerOffset % spacing);

      for (var bx = startX; bx < W + spacing; bx += spacing) {
        var bh = (30 + Math.abs(Math.sin(bx * 0.01 + i * 2)) * 80) * (0.5 + i * 0.3);
        ctx.fillRect(bx, H * layer.y, bw, bh);
      }
    }
  };

  /**
   * Resize viewport dimensions.
   */
  SideScrollCamera.prototype.resize = function (viewW, viewH) {
    this.viewW = viewW;
    this.viewH = viewH;
  };

  /**
   * Reset camera to initial state.
   */
  SideScrollCamera.prototype.reset = function () {
    this.x = 0;
    this.y = 0;
    this.speed = this.baseSpeed;
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
    this._shakeOffsetX = 0;
    this._shakeOffsetY = 0;
  };

  return SideScrollCamera;
})();
