/**
 * ParticleEmitter — Genre Helper Module
 *
 * Configurable burst/stream particles for juice and effects.
 * Works with ArcadeEngine's drawEmoji() or raw canvas.
 *
 * Usage:
 *   var emitter = new ParticleEmitter();
 *
 *   // Burst at a point:
 *   emitter.burst(worldX, worldY, {
 *     emoji: '💥',
 *     count: 8,
 *     speed: 4,
 *     life: 25,
 *     gravity: 0.1,
 *     spread: Math.PI * 2   // full circle (default)
 *   });
 *
 *   // Stream (call each frame for continuous):
 *   emitter.emit(worldX, worldY, { emoji: '✨', speed: 2, life: 15 });
 *
 *   // In onUpdate:
 *   emitter.update();
 *
 *   // In onDraw:
 *   emitter.draw(ctx, cameraX, engine);
 *   // 'engine' is optional — if provided, uses engine.drawEmoji()
 *   // otherwise uses ctx.fillText()
 *
 *   // Housekeeping:
 *   emitter.clear();           // remove all particles
 *   emitter.count();           // active particle count
 *
 * Depends on: nothing (standalone, but integrates with ArcadeEngine)
 */
var ParticleEmitter = (function () {
  'use strict';

  var DEFAULT_BURST = {
    emoji: '✨',
    count: 6,
    speed: 3,
    life: 25,
    gravity: 0.1,
    spread: Math.PI * 2,
    angle: 0,          // center angle for directional bursts
    size: 12,
    fadeOut: true,
    friction: 0         // velocity decay per frame (0 = none)
  };

  function ParticleEmitter(maxParticles) {
    this._particles = [];
    this._maxParticles = maxParticles || 500;
  }

  /**
   * Emit a burst of particles from a point.
   * @param {number} x — world X
   * @param {number} y — world Y
   * @param {Object} [opts] — override defaults
   */
  ParticleEmitter.prototype.burst = function (x, y, opts) {
    opts = _merge(DEFAULT_BURST, opts);
    var halfSpread = opts.spread / 2;

    for (var i = 0; i < opts.count; i++) {
      if (this._particles.length >= this._maxParticles) break;

      var angle = opts.angle + (opts.spread === Math.PI * 2
        ? (Math.PI * 2 / opts.count) * i
        : -halfSpread + Math.random() * opts.spread);

      var speed = opts.speed * (0.5 + Math.random() * 0.5);

      this._particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: opts.life + Math.floor(Math.random() * (opts.life * 0.3)),
        maxLife: opts.life,
        emoji: opts.emoji,
        size: opts.size,
        gravity: opts.gravity,
        fadeOut: opts.fadeOut,
        friction: opts.friction
      });
    }
  };

  /**
   * Emit a single particle (call per-frame for streams).
   * @param {number} x — world X
   * @param {number} y — world Y
   * @param {Object} [opts] — override defaults
   */
  ParticleEmitter.prototype.emit = function (x, y, opts) {
    if (this._particles.length >= this._maxParticles) return;
    opts = _merge(DEFAULT_BURST, opts);

    var angle = opts.angle + (Math.random() - 0.5) * opts.spread;
    var speed = opts.speed * (0.5 + Math.random() * 0.5);

    this._particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: opts.life,
      maxLife: opts.life,
      emoji: opts.emoji,
      size: opts.size,
      gravity: opts.gravity,
      fadeOut: opts.fadeOut,
      friction: opts.friction
    });
  };

  /**
   * Update all particles. Call once per frame in onUpdate.
   */
  ParticleEmitter.prototype.update = function () {
    for (var i = this._particles.length - 1; i >= 0; i--) {
      var p = this._particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;

      if (p.friction > 0) {
        p.vx *= (1 - p.friction);
        p.vy *= (1 - p.friction);
      }

      p.life--;
      if (p.life <= 0) {
        this._particles.splice(i, 1);
      }
    }
  };

  /**
   * Draw all particles.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cameraX — camera offset for world-to-screen conversion
   * @param {Object} [engine] — ArcadeEngine instance (for drawEmoji). Optional.
   * @param {number} [fontSize] — fallback font size if no engine (default 12)
   */
  ParticleEmitter.prototype.draw = function (ctx, cameraX, engine, fontSize) {
    fontSize = fontSize || 12;

    for (var i = 0; i < this._particles.length; i++) {
      var p = this._particles[i];
      var sx = p.x - cameraX;
      var alpha = p.fadeOut ? Math.min(1, p.life / (p.maxLife * 0.4)) : 1;

      if (engine && engine.drawEmoji) {
        engine.drawEmoji(ctx, p.emoji, sx, p.y, p.size, { alpha: alpha });
      } else {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = fontSize + 'px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.emoji, sx, p.y);
        ctx.restore();
      }
    }
  };

  /**
   * Remove all particles.
   */
  ParticleEmitter.prototype.clear = function () {
    this._particles.length = 0;
  };

  /**
   * Get active particle count.
   */
  ParticleEmitter.prototype.count = function () {
    return this._particles.length;
  };

  /**
   * Get raw particle array (for custom rendering).
   */
  ParticleEmitter.prototype.getParticles = function () {
    return this._particles;
  };

  // ── Internal: merge defaults with overrides ──
  function _merge(defaults, overrides) {
    if (!overrides) return defaults;
    var result = {};
    for (var key in defaults) {
      result[key] = overrides[key] != null ? overrides[key] : defaults[key];
    }
    return result;
  }

  return ParticleEmitter;
})();
