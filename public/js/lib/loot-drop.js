/* ============================================================
   LootDrop — Physics-based collectible scatter for ArcadeEngine
   Extracted from Gone Rogue's CurrencySpawning scatter pattern.
   Standalone IIFE, no dependencies.

   Drops are items that burst outward from a point (like a
   destroyed crate), settle with gravity/bounce, bob in place,
   and can be collected by proximity to the player.

   Usage:
     var loot = new LootDrop(50);  // max 50 active drops

     // When an AC unit breaks:
     loot.scatter(worldX, worldY, [
       { emoji: '💼', value: 200, type: 'intel' },
       { emoji: '🪙', value: 50,  type: 'coin' },
       { emoji: '🪙', value: 50,  type: 'coin' }
     ]);

     // In onUpdate:
     loot.update();
     var collected = loot.collectNear(playerWorldX, playerWorldY, radius);
     // collected = [{ emoji, value, type }, ...] — process score/items

     // In onDraw:
     loot.draw(ctx, camX, engine, emojiSize);
   ============================================================ */
(function () {
  'use strict';

  var GRAVITY    = 0.25;
  var BOUNCE     = 0.45;
  var FRICTION   = 0.92;
  var BOB_SPEED  = 0.06;
  var BOB_AMP    = 2.5;
  var SETTLE_VEL = 0.3;    // velocity threshold to stop bouncing
  var DECAY_TIME = 600;    // frames before a drop starts blinking (10s at 60fps)
  var BLINK_TIME = 120;    // frames of blinking before removal (2s)

  /**
   * @constructor
   * @param {number} [maxDrops=40] — max active drops (oldest culled)
   */
  function LootDrop(maxDrops) {
    this._max = maxDrops || 40;
    this._drops = [];
  }

  // ── Public API ──

  /**
   * Scatter items outward from a world-space point.
   * @param {number} wx — world X of burst origin
   * @param {number} wy — world Y of burst origin
   * @param {Array} items — array of { emoji, value, type, ... }
   *   Each item can optionally include: { speed, angle, gravity }
   */
  LootDrop.prototype.scatter = function (wx, wy, items) {
    if (!items || !items.length) return;
    var angleStep = (Math.PI * 2) / items.length;
    var baseAngle = -Math.PI * 0.5 + (Math.random() - 0.5) * 0.4;

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var angle = baseAngle + angleStep * i + (Math.random() - 0.5) * 0.6;
      var speed = (item.speed || 3) + Math.random() * 2;

      this._drops.push({
        // Position (world space)
        x: wx,
        y: wy,
        // Velocity
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,  // upward bias
        // Physics state
        settled: false,
        bobPhase: Math.random() * Math.PI * 2,
        // Item data (passed through to collector)
        emoji: item.emoji || '🪙',
        value: item.value || 0,
        type: item.type || 'coin',
        extra: item.extra || null,
        // Lifecycle
        age: 0,
        alive: true
      });
    }

    // Cull oldest if over cap
    while (this._drops.length > this._max) {
      this._drops.shift();
    }
  };

  /**
   * Drop a single item at a position (no burst physics — just bob).
   * @param {number} wx — world X
   * @param {number} wy — world Y
   * @param {Object} item — { emoji, value, type, ... }
   */
  LootDrop.prototype.place = function (wx, wy, item) {
    this._drops.push({
      x: wx, y: wy, vx: 0, vy: 0,
      settled: true,
      bobPhase: Math.random() * Math.PI * 2,
      emoji: (item && item.emoji) || '🪙',
      value: (item && item.value) || 0,
      type: (item && item.type) || 'coin',
      extra: (item && item.extra) || null,
      age: 0, alive: true
    });
    while (this._drops.length > this._max) {
      this._drops.shift();
    }
  };

  /**
   * Tick physics for all active drops.
   */
  LootDrop.prototype.update = function () {
    for (var i = this._drops.length - 1; i >= 0; i--) {
      var d = this._drops[i];
      d.age++;

      // Blink then die
      if (d.age > DECAY_TIME + BLINK_TIME) {
        this._drops.splice(i, 1);
        continue;
      }

      if (d.settled) {
        d.bobPhase += BOB_SPEED;
        continue;
      }

      // Physics
      d.vy += GRAVITY;
      d.x += d.vx;
      d.y += d.vy;
      d.vx *= FRICTION;

      // Floor bounce (items settle on the Y they were scattered from + some drift)
      // We don't have platform info, so we use a simple floor check:
      // items stop when their downward velocity is small enough
      if (d.vy > 0 && Math.abs(d.vy) < SETTLE_VEL && Math.abs(d.vx) < SETTLE_VEL) {
        d.settled = true;
        d.vy = 0;
        d.vx = 0;
      }

      // Bounce off arbitrary floor (if vy is large and moving down)
      // The scatter origin's Y acts as a rough floor level
    }
  };

  /**
   * Update with platform collision (optional, more realistic).
   * Call instead of update() if you have platform data.
   * @param {Array} platforms — [{ x, y, w, h }, ...]
   * @param {number} camX — camera X offset (world to screen)
   */
  LootDrop.prototype.updateWithPlatforms = function (platforms, camX) {
    for (var i = this._drops.length - 1; i >= 0; i--) {
      var d = this._drops[i];
      d.age++;

      if (d.age > DECAY_TIME + BLINK_TIME) {
        this._drops.splice(i, 1);
        continue;
      }

      if (d.settled) {
        d.bobPhase += BOB_SPEED;
        continue;
      }

      // Physics
      d.vy += GRAVITY;
      d.x += d.vx;
      d.y += d.vy;
      d.vx *= FRICTION;

      // Platform collision (world space)
      if (d.vy > 0) {
        for (var p = 0; p < platforms.length; p++) {
          var plat = platforms[p];
          if (d.x >= plat.x && d.x <= plat.x + plat.w &&
              d.y >= plat.y && d.y <= plat.y + plat.h + 4) {
            d.y = plat.y;
            if (Math.abs(d.vy) < SETTLE_VEL * 2) {
              d.settled = true;
              d.vy = 0; d.vx = 0;
            } else {
              d.vy *= -BOUNCE;
              d.vx *= FRICTION;
            }
            break;
          }
        }
      }

      // Settle if velocity is tiny
      if (!d.settled && Math.abs(d.vy) < SETTLE_VEL && Math.abs(d.vx) < SETTLE_VEL) {
        d.settled = true;
        d.vy = 0; d.vx = 0;
      }
    }
  };

  /**
   * Collect all drops within radius of a world-space point.
   * Returns array of collected items (with emoji, value, type, extra).
   * Collected drops are removed from the pool.
   * @param {number} wx — world X (player center)
   * @param {number} wy — world Y (player center)
   * @param {number} radius — collection radius in pixels
   * @returns {Array} collected items
   */
  LootDrop.prototype.collectNear = function (wx, wy, radius) {
    var collected = [];
    var r2 = radius * radius;

    for (var i = this._drops.length - 1; i >= 0; i--) {
      var d = this._drops[i];
      var dx = d.x - wx;
      var dy = d.y - wy;
      if (dx * dx + dy * dy <= r2) {
        collected.push({
          emoji: d.emoji,
          value: d.value,
          type: d.type,
          extra: d.extra,
          x: d.x,
          y: d.y
        });
        this._drops.splice(i, 1);
      }
    }
    return collected;
  };

  /**
   * Draw all active drops.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} camX — camera X offset (subtract from world X)
   * @param {Object} engine — ArcadeEngine instance (for drawEmoji)
   * @param {number} [size=14] — emoji render size
   */
  LootDrop.prototype.draw = function (ctx, camX, engine, size) {
    var sz = size || 14;

    for (var i = 0; i < this._drops.length; i++) {
      var d = this._drops[i];
      var sx = d.x - camX;
      var sy = d.y;

      // Bob when settled
      if (d.settled) {
        sy += Math.sin(d.bobPhase) * BOB_AMP;
      }

      // Blink when decaying
      if (d.age > DECAY_TIME) {
        var blinkPhase = d.age - DECAY_TIME;
        if (Math.floor(blinkPhase / 4) % 2 === 1) continue; // skip draw = blink
      }

      // Draw via ArcadeEngine's drawEmoji if available, else fallback
      if (engine && engine.drawEmoji) {
        engine.drawEmoji(ctx, d.emoji, sx, sy, sz, { glow: true, glowRadius: 4 });
      } else {
        ctx.font = sz + 'px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(d.emoji, sx, sy);
      }
    }
  };

  /**
   * Remove all drops.
   */
  LootDrop.prototype.clear = function () {
    this._drops.length = 0;
  };

  /**
   * Number of active drops.
   */
  LootDrop.prototype.count = function () {
    return this._drops.length;
  };

  /**
   * Get raw drops array (read-only access for custom rendering).
   */
  LootDrop.prototype.getDrops = function () {
    return this._drops;
  };

  // ── Export ──
  window.LootDrop = LootDrop;

})();
