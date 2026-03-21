/* ============================================================
   ProjectileSystem — Omnidirectional projectile management
   Standalone IIFE, no dependencies.

   Usage:
     var bullets = new ProjectileSystem({
       speed: 7,
       range: 500,
       cooldown: 12,       // frames between shots
       maxActive: 50,
       trailLength: 6
     });

     // Fire toward a target (auto-normalizes direction)
     bullets.fireAt(originX, originY, targetX, targetY);

     // Fire with explicit velocity
     bullets.fire(originX, originY, vx, vy);

     // Per-frame update — moves projectiles, culls expired
     bullets.update(screenW, screenH, scrollOffsetY);

     // Collision check — returns first hit projectile or null
     var hit = bullets.collideFirst(targetX, targetY, radius);

     // Collision check — returns all hits (for piercing rounds)
     var hits = bullets.collideAll(targetX, targetY, radius);

     // Draw with configurable style
     bullets.draw(ctx, opts);

     // Check if fire is allowed (cooldown ready)
     if (bullets.canFire()) { ... }

   Each projectile: { x, y, vx, vy, rotation, traveled, trail[], alive }
   ============================================================ */
;(function () {
  'use strict';

  var DEF_SPEED      = 7;
  var DEF_RANGE      = 500;
  var DEF_COOLDOWN   = 12;
  var DEF_MAX_ACTIVE = 50;
  var DEF_TRAIL_LEN  = 6;
  var DEF_MARGIN     = 30;   // off-screen cull margin

  /**
   * @constructor
   * @param {Object} [opts]
   */
  function ProjectileSystem(opts) {
    opts = opts || {};
    this.speed      = opts.speed      || DEF_SPEED;
    this.range      = opts.range      || DEF_RANGE;
    this.cooldown   = opts.cooldown   || DEF_COOLDOWN;
    this.maxActive  = opts.maxActive  || DEF_MAX_ACTIVE;
    this.trailLength = opts.trailLength != null ? opts.trailLength : DEF_TRAIL_LEN;
    this.margin     = opts.margin     || DEF_MARGIN;

    this._pool = [];        // active projectiles
    this._coolTimer = 0;    // frames until next shot allowed
  }

  // ── Firing ──────────────────────────────────────────────

  /**
   * Can we fire right now?
   * @returns {boolean}
   */
  ProjectileSystem.prototype.canFire = function () {
    return this._coolTimer <= 0 && this._pool.length < this.maxActive;
  };

  /**
   * Fire a projectile from origin toward a target position.
   * Direction is auto-normalized. Returns the projectile or null if blocked.
   * @param {number} ox - Origin X
   * @param {number} oy - Origin Y
   * @param {number} tx - Target X
   * @param {number} ty - Target Y
   * @param {Object} [extra] - Extra properties merged onto the projectile
   * @returns {Object|null}
   */
  ProjectileSystem.prototype.fireAt = function (ox, oy, tx, ty, extra) {
    var dx = tx - ox, dy = ty - oy;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return null;
    return this.fire(ox, oy, dx / dist, dy / dist, extra);
  };

  /**
   * Fire a projectile with explicit normalized velocity.
   * @param {number} x - Start X
   * @param {number} y - Start Y
   * @param {number} vx - Velocity X (normalized)
   * @param {number} vy - Velocity Y (normalized)
   * @param {Object} [extra] - Extra properties merged onto the projectile
   * @returns {Object|null}
   */
  ProjectileSystem.prototype.fire = function (x, y, vx, vy, extra) {
    if (!this.canFire()) return null;
    this._coolTimer = this.cooldown;

    var proj = {
      x: x, y: y,
      vx: vx, vy: vy,
      rotation: Math.atan2(vy, vx),
      traveled: 0,
      trail: [],
      alive: true,
      spawnTime: Date.now()
    };

    // Merge any extra properties (damage, owner, etc.)
    if (extra) {
      for (var key in extra) {
        if (extra.hasOwnProperty(key)) proj[key] = extra[key];
      }
    }

    this._pool.push(proj);
    return proj;
  };

  // ── Update ──────────────────────────────────────────────

  /**
   * Advance all projectiles. Call once per frame.
   * @param {number} screenW - Screen width (for bounds culling)
   * @param {number} screenH - Screen height (for bounds culling)
   * @param {number} [scrollY=0] - Vertical scroll offset applied to Y (terrain scroll)
   */
  ProjectileSystem.prototype.update = function (screenW, screenH, scrollY) {
    if (this._coolTimer > 0) this._coolTimer--;
    var margin = this.margin;
    var speed = this.speed;
    var range = this.range;
    var tLen = this.trailLength;
    var sY = scrollY || 0;

    for (var i = this._pool.length - 1; i >= 0; i--) {
      var p = this._pool[i];
      if (!p.alive) { this._pool.splice(i, 1); continue; }

      // Record trail position before moving
      if (tLen > 0) {
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > tLen) p.trail.shift();
      }

      // Move along velocity vector
      p.x += p.vx * speed;
      p.y += p.vy * speed;

      // Offset by terrain scroll
      if (sY) p.y -= sY;

      p.traveled += speed;

      // Cull: out of bounds or exceeded range
      if (p.x < -margin || p.x > screenW + margin ||
          p.y < -margin || p.y > screenH + margin ||
          p.traveled > range) {
        this._pool.splice(i, 1);
      }
    }
  };

  // ── Collision ───────────────────────────────────────────

  /**
   * Check all projectiles against a circular target.
   * Returns the FIRST hit and removes it from the pool.
   * @param {number} tx - Target center X
   * @param {number} ty - Target center Y
   * @param {number} radius - Hit radius
   * @returns {Object|null} The hit projectile, or null.
   */
  ProjectileSystem.prototype.collideFirst = function (tx, ty, radius) {
    for (var i = this._pool.length - 1; i >= 0; i--) {
      var p = this._pool[i];
      if (!p.alive) continue;
      if (Math.abs(p.x - tx) < radius && Math.abs(p.y - ty) < radius) {
        this._pool.splice(i, 1);
        return p;
      }
    }
    return null;
  };

  /**
   * Check all projectiles against a circular target.
   * Returns ALL hits and removes them from the pool.
   * @param {number} tx - Target center X
   * @param {number} ty - Target center Y
   * @param {number} radius - Hit radius
   * @returns {Array} Array of hit projectiles (may be empty).
   */
  ProjectileSystem.prototype.collideAll = function (tx, ty, radius) {
    var hits = [];
    for (var i = this._pool.length - 1; i >= 0; i--) {
      var p = this._pool[i];
      if (!p.alive) continue;
      if (Math.abs(p.x - tx) < radius && Math.abs(p.y - ty) < radius) {
        hits.push(p);
        this._pool.splice(i, 1);
      }
    }
    return hits;
  };

  /**
   * Check all projectiles against an AABB target.
   * Returns the FIRST hit and removes it from the pool.
   * @param {number} x - Target left edge
   * @param {number} y - Target top edge
   * @param {number} w - Target width
   * @param {number} h - Target height
   * @returns {Object|null}
   */
  ProjectileSystem.prototype.collideAABB = function (x, y, w, h) {
    for (var i = this._pool.length - 1; i >= 0; i--) {
      var p = this._pool[i];
      if (!p.alive) continue;
      if (p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h) {
        this._pool.splice(i, 1);
        return p;
      }
    }
    return null;
  };

  // ── Drawing ─────────────────────────────────────────────

  /**
   * Draw all projectiles onto a canvas context.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} [opts]
   * @param {number} [opts.size=3]          - Projectile head radius
   * @param {string} [opts.color='#FFCC44'] - Head fill color
   * @param {string} [opts.glowColor='#FF8800'] - Glow/shadow color
   * @param {string} [opts.coreColor='#FFFFFF']  - Inner core color
   * @param {boolean} [opts.drawTrail=true] - Whether to draw trail
   * @param {string} [opts.trailColor='rgba(255,200,80,'] - Trail base color (alpha appended)
   */
  ProjectileSystem.prototype.draw = function (ctx, opts) {
    opts = opts || {};
    var size       = opts.size       || 3;
    var color      = opts.color      || '#FFCC44';
    var glowColor  = opts.glowColor  || '#FF8800';
    var coreColor  = opts.coreColor  || '#FFFFFF';
    var drawTrail  = opts.drawTrail !== false;
    var trailColor = opts.trailColor || 'rgba(255,200,80,';

    for (var i = 0; i < this._pool.length; i++) {
      var p = this._pool[i];
      if (!p.alive) continue;

      // Trail
      if (drawTrail && p.trail.length > 1) {
        ctx.lineCap = 'round';
        for (var t = 1; t < p.trail.length; t++) {
          var tAlpha = (t / p.trail.length) * 0.45;
          var tWidth = (t / p.trail.length) * (size * 1.5);
          ctx.strokeStyle = trailColor + tAlpha + ')';
          ctx.lineWidth = tWidth;
          ctx.beginPath();
          ctx.moveTo(p.trail[t - 1].x, p.trail[t - 1].y);
          ctx.lineTo(p.trail[t].x, p.trail[t].y);
          ctx.stroke();
        }
      }

      // Head: rotated glowing dot
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      // Animated pulse
      var pulsePhase = ((Date.now() - p.spawnTime) * 0.02) % (Math.PI * 2);
      var pulseR = size * (1.0 + 0.3 * Math.sin(pulsePhase));

      // Outer glow
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = pulseR * 3;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
      ctx.fill();

      // Inner core
      ctx.shadowBlur = 0;
      ctx.fillStyle = coreColor;
      ctx.beginPath();
      ctx.arc(0, 0, pulseR * 0.45, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  };

  // ── Utilities ───────────────────────────────────────────

  /**
   * Remove all projectiles.
   */
  ProjectileSystem.prototype.clear = function () {
    this._pool.length = 0;
    this._coolTimer = 0;
  };

  /**
   * @returns {number} Current active projectile count.
   */
  ProjectileSystem.prototype.count = function () {
    return this._pool.length;
  };

  /**
   * @returns {Array} Read-only reference to the pool (for advanced iteration).
   */
  ProjectileSystem.prototype.getPool = function () {
    return this._pool;
  };

  /**
   * Reset cooldown timer (e.g. on game restart).
   */
  ProjectileSystem.prototype.resetCooldown = function () {
    this._coolTimer = 0;
  };

  // ── Export as global ──
  window.ProjectileSystem = ProjectileSystem;
})();
