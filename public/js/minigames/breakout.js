/**
 * BREAKOUT — Brick-breaker arcade game
 * ArcadeEngine-powered rewrite with emoji bricks, paddle, ball physics,
 * touch drag input, progressive difficulty, audio, and currency.
 *
 * Entities: 🟥 brick (tier 1), 🟧 brick (tier 2), 🟨 brick (tier 3),
 *           🟩 brick (tier 4), 🟦 brick (tier 5), 🏓 paddle, ⚪ ball
 *
 * Input: Touch drag (primary), keyboard left/right arrows (nudge),
 *        space or tap to serve.
 * ============================================================ */
window.BreakoutGame = (function () {
  'use strict';

  // Grid layout constants
  var BRICK_ROWS = 5;
  var BRICK_H = 12;
  var BRICK_PAD = 2;

  // Ball and paddle constants
  var BALL_RADIUS = 4;
  var PADDLE_W = 60;
  var PADDLE_H = 8;
  var PADDLE_OFFSET_Y = 20;  // distance from bottom

  // Scoring
  var BRICK_BASE_SCORE = 10;

  // ══════════════════════════════════════════════════════════════
  // Breakout Game Class
  // ══════════════════════════════════════════════════════════════

  function Breakout() {
    ArcadeEngine.call(this, {
      gameId: 'breakout',
      title: 'BREAKOUT',
      lives: 3,
      currencyRate: 0.02
    });

    // SFX mapping: generic engine keys → real audio manifest keys
    this.sfxMap = {
      'bounce':      'drop-1',         // wall/paddle hit
      'paddle-hit':  'coin-2',         // ball hits paddle
      'break':       'hit-1',          // brick destroyed
      'death':       'kitty-1',        // ball lost
      'game-over':   'game-over-1',
      'game-start':  'power-up-1',
      'level-up':    'power-up-1',
      'serve':       'toad'            // ball served
    };

    // Game-specific state
    this._paddle = null;
    this._ball = null;
    this._bricks = [];
    this._serving = false;
    this._brickCols = 0;

    // Particle emitter for brick break effects
    this._emitter = (typeof ParticleEmitter !== 'undefined')
      ? new ParticleEmitter(200)
      : null;
  }

  Breakout.prototype = Object.create(ArcadeEngine.prototype);
  Breakout.prototype.constructor = Breakout;

  // ════════════════════════════════════════════
  // LIFECYCLE HOOKS
  // ════════════════════════════════════════════

  Breakout.prototype.onInit = function () {
    this._resetState();
  };

  Breakout.prototype.onStart = function () {
    this._resetState();

    // ── Difficulty scaling ──
    var dm = this.difficultyMultiplier();
    // T1 (0.7): +1 life, slower ball
    // T2 (1.0): default
    // T3 (1.4): -1 life, faster ball
    if (this.difficulty === 1) {
      this.lives = 4;  // +1 extra life
    } else if (this.difficulty === 2) {
      this.lives = 3;
    } else if (this.difficulty === 3) {
      this.lives = 2;  // -1 life
    }
  };

  Breakout.prototype.onResize = function () {
    this._resetState();
  };

  /**
   * Initialize or reset game state with current canvas dimensions.
   * Calculates grid, builds bricks, resets paddle and ball.
   */
  Breakout.prototype._resetState = function () {
    var playH = this.logicalH;
    var playW = this.logicalW;

    // Calculate brick grid
    var brickW = (playW - BRICK_PAD * (this._brickCols + 1)) / this._brickCols;
    if (!this._brickCols || brickW < 10) {
      // Determine cols based on available width
      this._brickCols = Math.max(3, Math.floor((playW - BRICK_PAD) / (40 + BRICK_PAD)));
    }

    // Initialize paddle at bottom center
    this._paddle = {
      x: playW / 2,
      w: PADDLE_W,
      h: PADDLE_H
    };

    // Build brick grid
    this._buildBricks();

    // Serve ball
    this._serveBall();

    this._serving = true;
  };

  /**
   * Build brick grid with 5 rows, tier-based from bottom to top.
   * Tier 1 (bottom, strongest) = 🟥, Tier 5 (top, weakest) = 🟦
   */
  Breakout.prototype._buildBricks = function () {
    this._bricks = [];
    var playW = this.logicalW;
    var brickW = (playW - BRICK_PAD * (this._brickCols + 1)) / this._brickCols;

    for (var r = 0; r < BRICK_ROWS; r++) {
      // Tier: row 0 (top) = tier 5, row 4 (bottom) = tier 1
      var tier = BRICK_ROWS - r;

      for (var c = 0; c < this._brickCols; c++) {
        this._bricks.push({
          x: BRICK_PAD + c * (brickW + BRICK_PAD),
          y: 30 + r * (BRICK_H + BRICK_PAD),
          w: brickW,
          h: BRICK_H,
          alive: true,
          tier: tier
        });
      }
    }
  };

  /**
   * Place ball above paddle, ready to be served.
   * Direction and speed randomized.
   */
  Breakout.prototype._serveBall = function () {
    var playW = this.logicalW;
    var playH = this.logicalH;

    var dm = this.difficultyMultiplier();
    var baseSpeed = 3 + this.level * 0.3;
    var scaledSpeed = baseSpeed * dm;
    this._ball = {
      x: this._paddle.x,
      y: playH - PADDLE_OFFSET_Y - this._paddle.h - 10,
      vx: (Math.random() < 0.5 ? 1 : -1) * scaledSpeed,
      vy: -scaledSpeed * 1.2,
      r: BALL_RADIUS
    };

    this._serving = true;
    this.playSFX('serve');
  };

  // ════════════════════════════════════════════
  // INPUT HANDLING
  // ════════════════════════════════════════════

  Breakout.prototype.onInput = function (type, data) {
    var playW = this.logicalW;

    if (type === 'drag' || type === 'dragstart') {
      // Continuous paddle tracking from touch drag
      // data.x is already in logical coordinates
      this._paddle.x = data.x;

      // Clamp paddle to bounds
      if (this._paddle.x < this._paddle.w / 2) {
        this._paddle.x = this._paddle.w / 2;
      }
      if (this._paddle.x > playW - this._paddle.w / 2) {
        this._paddle.x = playW - this._paddle.w / 2;
      }
    }

    if (type === 'tap') {
      // Tap to serve if serving
      if (this._serving) {
        this._serving = false;
      }
    }

    if (type === 'keyaction') {
      // Keyboard nudge and serve
      if (data.action === 'left') {
        this._paddle.x -= 20;
        if (this._paddle.x < this._paddle.w / 2) {
          this._paddle.x = this._paddle.w / 2;
        }
      } else if (data.action === 'right') {
        this._paddle.x += 20;
        if (this._paddle.x > playW - this._paddle.w / 2) {
          this._paddle.x = playW - this._paddle.w / 2;
        }
      } else if (data.action === 'action') {
        // Space to serve
        if (this._serving) {
          this._serving = false;
        }
      }
    }
  };

  // ════════════════════════════════════════════
  // UPDATE LOGIC
  // ════════════════════════════════════════════

  Breakout.prototype.onUpdate = function (dt) {
    var playW = this.logicalW;
    var playH = this.logicalH;

    // Ball movement
    if (!this._serving) {
      this._ball.x += this._ball.vx;
      this._ball.y += this._ball.vy;
    } else {
      // Ball follows paddle while serving
      this._ball.x = this._paddle.x;
      this._ball.y = playH - PADDLE_OFFSET_Y - this._paddle.h - 10;
    }

    // Wall bounces
    if (this._ball.x - this._ball.r <= 0) {
      this._ball.x = this._ball.r;
      this._ball.vx = Math.abs(this._ball.vx);
      this.playSFX('bounce');
    }
    if (this._ball.x + this._ball.r >= playW) {
      this._ball.x = playW - this._ball.r;
      this._ball.vx = -Math.abs(this._ball.vx);
      this.playSFX('bounce');
    }
    if (this._ball.y - this._ball.r <= 0) {
      this._ball.y = this._ball.r;
      this._ball.vy = Math.abs(this._ball.vy);
      this.playSFX('bounce');
    }

    // Ball lost below screen
    if (this._ball.y > playH + 10) {
      this.loseLife();
      if (this.lives > 0) {
        this._serveBall();
      }
      return;
    }

    // Paddle collision
    this._checkPaddleCollision();

    // Brick collisions
    this._checkBrickCollisions();

    // Level clear check
    var remaining = this._bricks.filter(function (b) { return b.alive; }).length;
    if (remaining === 0) {
      this.nextLevel();
      this._buildBricks();
      this._serveBall();
    }

    // Update particles
    if (this._emitter) this._emitter.update();
  };

  /**
   * Check ball-paddle collision with angle deflection.
   */
  Breakout.prototype._checkPaddleCollision = function () {
    var playH = this.logicalH;
    var b = this._ball;
    var p = this._paddle;

    // Paddle y position
    var paddleY = playH - PADDLE_OFFSET_Y - p.h;

    // AABB collision: ball approaching from above
    if (b.vy > 0 &&
        b.y + b.r >= paddleY &&
        b.y + b.r <= paddleY + p.h + 5 &&
        b.x >= p.x - p.w / 2 &&
        b.x <= p.x + p.w / 2) {

      // Bounce
      b.vy = -Math.abs(b.vy);
      this.playSFX('paddle-hit');

      // Angle deflection based on where ball hit paddle
      var offset = (b.x - p.x) / (p.w / 2);  // -1 to +1
      b.vx += offset * 2;

      // Cap horizontal speed
      if (b.vx > 5) b.vx = 5;
      if (b.vx < -5) b.vx = -5;
    }
  };

  /**
   * Check ball-brick collisions and handle destruction.
   */
  Breakout.prototype._checkBrickCollisions = function () {
    var b = this._ball;

    for (var i = 0; i < this._bricks.length; i++) {
      var brick = this._bricks[i];
      if (!brick.alive) continue;

      // AABB overlap
      if (b.x + b.r > brick.x && b.x - b.r < brick.x + brick.w &&
          b.y + b.r > brick.y && b.y - b.r < brick.y + brick.h) {

        brick.alive = false;
        this.addScore(brick.tier * BRICK_BASE_SCORE);
        this.playSFX('break');

        // Particle effect on brick break
        if (this._emitter) {
          var emoji = this._getBrickEmoji(brick.tier);
          this._emitter.burst(
            brick.x + brick.w / 2,
            brick.y + brick.h / 2,
            { emoji: emoji, count: 3, speed: 1.5, life: 25, gravity: 0.1 }
          );
        }

        // Determine bounce direction (AABB collision response)
        var overlapLeft = (b.x + b.r) - brick.x;
        var overlapRight = (brick.x + brick.w) - (b.x - b.r);
        var overlapTop = (b.y + b.r) - brick.y;
        var overlapBottom = (brick.y + brick.h) - (b.y - b.r);

        var minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

        if (minOverlap === overlapTop || minOverlap === overlapBottom) {
          b.vy = -b.vy;
        } else {
          b.vx = -b.vx;
        }

        break;  // Only one collision per frame
      }
    }
  };

  /**
   * Get emoji for brick tier.
   */
  Breakout.prototype._getBrickEmoji = function (tier) {
    switch (tier) {
      case 1: return '🟥';  // red
      case 2: return '🟧';  // orange
      case 3: return '🟨';  // yellow
      case 4: return '🟩';  // green
      case 5: return '🟦';  // blue
      default: return '⬜'; // white
    }
  };

  // ════════════════════════════════════════════
  // RENDERING
  // ════════════════════════════════════════════

  Breakout.prototype.onDraw = function (ctx, W, H) {
    // Draw bricks
    for (var i = 0; i < this._bricks.length; i++) {
      var brick = this._bricks[i];
      if (!brick.alive) continue;

      var emoji = this._getBrickEmoji(brick.tier);
      var size = Math.min(brick.w, brick.h * 1.5) * 0.8;
      this.drawEmoji(ctx, emoji, brick.x + brick.w / 2, brick.y + brick.h / 2, size);
    }

    // Draw paddle
    this.drawEmoji(ctx, '🏓', this._paddle.x, H - PADDLE_OFFSET_Y - this._paddle.h / 2, 28);

    // Draw ball with glow
    this.drawEmoji(ctx, '⚪', this._ball.x, this._ball.y, 12, {
      glow: true,
      glowRadius: 6,
      glowColor: this.colors.phosphor
    });

    // Draw particle effects
    if (this._emitter) {
      this._emitter.draw(ctx, 0, this);
    }

    // Draw HUD
    this.drawText(ctx, 'SCORE: ' + this.score, 8, 14, 11, this.colors.phosphor, 'left');
    this.drawText(ctx, 'LIVES: ' + this.lives, W / 2 - 30, 14, 11, this.colors.phosphor, 'left');
    this.drawText(ctx, 'LVL: ' + this.level, W - 50, 14, 11, this.colors.phosphor, 'right');

    // Serve instruction
    if (this._serving) {
      this.drawText(ctx, '[SPACE] or TAP to serve', W / 2, H / 2, 14, this.colors.phosphorDim, 'center');
    }
  };

  // ════════════════════════════════════════════
  // EXPORT
  // ════════════════════════════════════════════

  var instance = new Breakout();
  return instance.asMinigame();
})();
