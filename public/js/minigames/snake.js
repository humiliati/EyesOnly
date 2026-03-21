/* ============================================================
   SNAKE — Data Heist
   ArcadeEngine-powered with emoji entities, touch/swipe controls,
   audio, currency, progressive difficulty.

   INPUT: Swipe in 4 directions (touch or keyboard arrows) to
   change heading. Tap = boost (move 2 cells). Double-tap =
   boost. Drag direction = continuous heading change.

   ENTITIES: 🐍 head, 🟢 body, 🍎 data packets, 🟡 encrypted
   packets (bonus), 🔴 antivirus pursuers.

   Uses genre helper modules:
     ParticleEmitter  — score/emoji particles
     DifficultyRamp   — progressive difficulty
   ============================================================ */
window.SnakeGame = (function () {
  'use strict';

  // ── Emoji palette ──
  var EMOJI = {
    head:       '🐍',
    body:       '🟢',
    food:       '🍎',
    encrypted:  '🟡',
    pursuer:    '🔴',
    crash:      '💥',
    poof:       '💨',
    coin:       '🪙'
  };

  // ── Difficulty ramp ──
  var difficultyRamp = new DifficultyRamp({
    metric: 'score',
    range: [0, 2000],
    sections: [
      { name: 'Perimeter Scan',  at: 0,    tickRate: 8, pursuerSpeed: 0,   pursuerCount: 0 },
      { name: 'Data Mining',     at: 100,  tickRate: 7, pursuerSpeed: 12,  pursuerCount: 1 },
      { name: 'Deep Packet',     at: 300,  tickRate: 6, pursuerSpeed: 10,  pursuerCount: 1 },
      { name: 'Firewall Breach', at: 600,  tickRate: 5, pursuerSpeed: 8,   pursuerCount: 2 },
      { name: 'Core Dump',       at: 1200, tickRate: 4, pursuerSpeed: 6,   pursuerCount: 3 }
    ]
  });

  // ════════════════════════════════════════════════════════════

  function Snake() {
    ArcadeEngine.call(this, {
      gameId: 'snake',
      title: 'DATA HEIST',
      lives: 1,
      currencyRate: 0.015
    });

    this.sfxMap = {
      'collect':    'coin-2',
      'encrypted':  'power-up-1',
      'turn':       'drop-1',
      'boost':      'water-1',
      'death':      'kitty-1',
      'game-over':  'game-over-1',
      'game-start': 'power-up-1',
      'level-up':   'toad',
      'pursuer-spawn': 'hit-1'
    };

    this._emitter = new ParticleEmitter(100);

    // ── Game state ──
    this._snake = [];
    this._dir = 'right';
    this._nextDir = 'right';
    this._food = null;
    this._encrypted = null;
    this._encryptedTimer = 0;
    this._pursuers = [];
    this._tickTimer = 0;
    this._tickRate = 8;
    this._boostQueued = false;
    this._cols = 0;
    this._rows = 0;
    this._cellSize = 12;
    this._sectionFlash = 0;
    this._deathPos = null;
    this._gridOffsetX = 0;
    this._gridOffsetY = 0;

    // Drag-based directional control state
    this._dragOriginX = 0;
    this._dragOriginY = 0;
    this._dragActive = false;
    this._lastDragDir = null;
  }

  Snake.prototype = Object.create(ArcadeEngine.prototype);
  Snake.prototype.constructor = Snake;

  // ════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ════════════════════════════════════════════════════════════

  Snake.prototype.onInit = function () { this._resetState(); };
  Snake.prototype.onStart = function () {
    this._resetState();

    // ── Difficulty scaling ──
    var dm = this.difficultyMultiplier();
    // Adjust initial lives
    if (this.difficulty === 1) {
      this.lives = 2;  // T1: one extra life
    } else if (this.difficulty === 2) {
      this.lives = 1;
    } else if (this.difficulty === 3) {
      this.lives = 1;  // T3 can restart faster anyway
    }
  };

  Snake.prototype._resetState = function () {
    var W = this.logicalW, H = this.logicalH;

    // Calculate grid dimensions — leave room for HUD at top
    var hudH = 24;
    var playH = H - hudH;
    this._cellSize = Math.floor(Math.min(W / 20, playH / 20));
    if (this._cellSize < 10) this._cellSize = 10;
    var C = this._cellSize;

    this._cols = Math.floor(W / C);
    this._rows = Math.floor(playH / C);
    if (this._cols < 8) this._cols = 8;
    if (this._rows < 8) this._rows = 8;

    // Center the grid
    this._gridOffsetX = Math.floor((W - this._cols * C) / 2);
    this._gridOffsetY = hudH + Math.floor((playH - this._rows * C) / 2);

    var cx = Math.floor(this._cols / 2);
    var cy = Math.floor(this._rows / 2);
    this._snake = [
      { x: cx, y: cy },
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy }
    ];
    this._dir = 'right';
    this._nextDir = 'right';
    this._tickTimer = 0;
    this._tickRate = 8;
    this._boostQueued = false;
    this._food = null;
    this._encrypted = null;
    this._encryptedTimer = 0;
    this._pursuers = [];
    this._sectionFlash = 0;
    this._deathPos = null;
    this._dragActive = false;
    this._lastDragDir = null;
    this._emitter.clear();

    difficultyRamp.reset();
    this._placeFood();
  };

  Snake.prototype.onResize = function (w, h) {
    this._resetState();
  };

  // ════════════════════════════════════════════════════════════
  // INPUT
  // ════════════════════════════════════════════════════════════

  Snake.prototype.onInput = function (type, data) {

    // ── Swipe: change direction (works for keyboard arrows too) ──
    if (type === 'swipe') {
      this._setDirection(data.direction);
      return;
    }

    // ── Keyboard directional ──
    if (type === 'keyaction') {
      var a = data.action;
      if (a === 'up' || a === 'down' || a === 'left' || a === 'right') {
        this._setDirection(a);
      }
      if (a === 'action') {
        // Space bar = boost
        this._boostQueued = true;
        this.playSFX('boost');
      }
      return;
    }

    // ── Tap / double-tap = boost (move 2 cells immediately) ──
    if (type === 'tap' || type === 'doubletap') {
      // If tap is clearly directional (not center), also change direction
      this._tapDirection(data.x, data.y);
      if (type === 'doubletap') {
        this._boostQueued = true;
        this.playSFX('boost');
      }
      return;
    }

    // ── Drag: continuous directional control ──
    if (type === 'dragstart') {
      this._dragActive = true;
      this._dragOriginX = data.x;
      this._dragOriginY = data.y;
      this._lastDragDir = null;
      return;
    }
    if (type === 'drag' && this._dragActive) {
      var dx = data.x - this._dragOriginX;
      var dy = data.y - this._dragOriginY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 15) {
        var dir;
        if (Math.abs(dx) > Math.abs(dy)) {
          dir = dx > 0 ? 'right' : 'left';
        } else {
          dir = dy > 0 ? 'down' : 'up';
        }
        if (dir !== this._lastDragDir) {
          this._setDirection(dir);
          this._lastDragDir = dir;
          // Reset origin so player can keep dragging to chain directions
          this._dragOriginX = data.x;
          this._dragOriginY = data.y;
        }
      }
      return;
    }
    if (type === 'dragend') {
      this._dragActive = false;
      this._lastDragDir = null;
      return;
    }
  };

  /**
   * Set next direction, preventing 180° reversal.
   */
  Snake.prototype._setDirection = function (newDir) {
    var opposites = { up: 'down', down: 'up', left: 'right', right: 'left' };
    if (newDir !== opposites[this._dir]) {
      this._nextDir = newDir;
    }
  };

  /**
   * Determine direction from a tap position relative to the snake head.
   */
  Snake.prototype._tapDirection = function (tapX, tapY) {
    if (!this._snake.length) return;
    var head = this._snake[0];
    var C = this._cellSize;
    var hx = this._gridOffsetX + head.x * C + C / 2;
    var hy = this._gridOffsetY + head.y * C + C / 2;
    var dx = tapX - hx;
    var dy = tapY - hy;
    if (Math.abs(dx) < C && Math.abs(dy) < C) return; // Too close to head, ignore
    if (Math.abs(dx) > Math.abs(dy)) {
      this._setDirection(dx > 0 ? 'right' : 'left');
    } else {
      this._setDirection(dy > 0 ? 'down' : 'up');
    }
  };

  // ════════════════════════════════════════════════════════════
  // UPDATE
  // ════════════════════════════════════════════════════════════

  Snake.prototype.onUpdate = function (dt) {
    // ── Difficulty ramp ──
    difficultyRamp.update(this.score);
    if (difficultyRamp.sectionChanged()) {
      this._sectionFlash = 120;
      this.playSFX('level-up');
    }
    if (this._sectionFlash > 0) this._sectionFlash--;

    // ── Get current tick rate from difficulty ──
    var dm = this.difficultyMultiplier();
    var baseTick = difficultyRamp.get('tickRate', 8);
    this._tickRate = Math.max(2, Math.round(baseTick / dm));

    // ── Encrypted packet timer ──
    if (this._encrypted) {
      this._encryptedTimer--;
      if (this._encryptedTimer <= 0) {
        this._encrypted = null;
      }
    }

    // ── Spawn encrypted packets occasionally ──
    if (!this._encrypted && this.score >= 50 && Math.random() < 0.003) {
      this._placeEncrypted();
    }

    // ── Tick movement ──
    this._tickTimer++;
    var ticksNeeded = this._boostQueued ? 1 : this._tickRate;
    if (this._tickTimer >= ticksNeeded) {
      this._tickTimer = 0;
      this._tick();
      if (this._boostQueued && this._snake.length > 0) {
        // Second tick for boost
        this._tick();
        this._boostQueued = false;
      }
    }

    // ── Pursuer management ──
    var targetCount = difficultyRamp.get('pursuerCount', 0);
    if (this._pursuers.length < targetCount) {
      this._spawnPursuer();
    }

    // ── Update pursuers ──
    var pursuerTickRate = difficultyRamp.get('pursuerSpeed', 12);
    for (var pi = 0; pi < this._pursuers.length; pi++) {
      var pur = this._pursuers[pi];
      pur.tickTimer++;
      if (pur.tickTimer >= pursuerTickRate) {
        pur.tickTimer = 0;
        this._movePursuer(pur);
      }
    }

    // ── Pursuer collision ──
    if (this._snake.length > 0) {
      var head = this._snake[0];
      for (var pk = 0; pk < this._pursuers.length; pk++) {
        if (this._pursuers[pk].x === head.x && this._pursuers[pk].y === head.y) {
          this._die();
          return;
        }
      }
    }

    this._emitter.update();
  };

  /**
   * Move the snake one cell in the current direction.
   */
  Snake.prototype._tick = function () {
    if (!this._snake.length) return;

    this._dir = this._nextDir;
    var head = { x: this._snake[0].x, y: this._snake[0].y };

    if (this._dir === 'right') head.x++;
    else if (this._dir === 'left') head.x--;
    else if (this._dir === 'up') head.y--;
    else if (this._dir === 'down') head.y++;

    // ── Wall collision ──
    if (head.x < 0 || head.x >= this._cols || head.y < 0 || head.y >= this._rows) {
      this._die();
      return;
    }

    // ── Self collision ──
    if (this._isSnake(head.x, head.y)) {
      this._die();
      return;
    }

    this._snake.unshift(head);

    // ── Food pickup ──
    if (this._food && head.x === this._food.x && head.y === this._food.y) {
      this.addScore(10);
      this.playSFX('collect');
      var C = this._cellSize;
      this._emitter.burst(
        this._gridOffsetX + head.x * C + C / 2,
        this._gridOffsetY + head.y * C + C / 2,
        { emoji: '+10', count: 1, speed: 0, life: 35, gravity: -0.3 }
      );
      this._placeFood();
      // Don't pop tail — snake grows
    } else if (this._encrypted && head.x === this._encrypted.x && head.y === this._encrypted.y) {
      this.addScore(50);
      this.playSFX('encrypted');
      var C2 = this._cellSize;
      this._emitter.burst(
        this._gridOffsetX + head.x * C2 + C2 / 2,
        this._gridOffsetY + head.y * C2 + C2 / 2,
        { emoji: '+50', count: 1, speed: 0, life: 45, gravity: -0.3 }
      );
      this._encrypted = null;
      // Grow by 2 — don't pop twice
    } else {
      this._snake.pop();
    }

    this.score = Math.max(this.score, (this._snake.length - 3) * 10);
  };

  /**
   * Die — game over.
   */
  Snake.prototype._die = function () {
    if (this._snake.length > 0) {
      var head = this._snake[0];
      var C = this._cellSize;
      this._deathPos = {
        x: this._gridOffsetX + head.x * C + C / 2,
        y: this._gridOffsetY + head.y * C + C / 2
      };
      this._emitter.burst(this._deathPos.x, this._deathPos.y, {
        emoji: EMOJI.crash, count: 1, speed: 0, life: 40
      });
    }
    this.playSFX('death');
    this.setState(ArcadeEngine.STATE.GAME_OVER);
  };

  // ════════════════════════════════════════════════════════════
  // GRID HELPERS
  // ════════════════════════════════════════════════════════════

  Snake.prototype._isSnake = function (x, y) {
    for (var i = 0; i < this._snake.length; i++) {
      if (this._snake[i].x === x && this._snake[i].y === y) return true;
    }
    return false;
  };

  Snake.prototype._isOccupied = function (x, y) {
    if (this._isSnake(x, y)) return true;
    if (this._food && this._food.x === x && this._food.y === y) return true;
    if (this._encrypted && this._encrypted.x === x && this._encrypted.y === y) return true;
    for (var i = 0; i < this._pursuers.length; i++) {
      if (this._pursuers[i].x === x && this._pursuers[i].y === y) return true;
    }
    return false;
  };

  Snake.prototype._placeFood = function () {
    var attempts = 0;
    do {
      this._food = {
        x: Math.floor(Math.random() * this._cols),
        y: Math.floor(Math.random() * this._rows)
      };
      attempts++;
    } while (this._isOccupied(this._food.x, this._food.y) && attempts < 300);
  };

  Snake.prototype._placeEncrypted = function () {
    var attempts = 0;
    var enc;
    do {
      enc = {
        x: Math.floor(Math.random() * this._cols),
        y: Math.floor(Math.random() * this._rows)
      };
      attempts++;
    } while (this._isOccupied(enc.x, enc.y) && attempts < 300);
    this._encrypted = enc;
    this._encryptedTimer = 300; // ~5 seconds at 60fps
  };

  // ════════════════════════════════════════════════════════════
  // PURSUERS (antivirus)
  // ════════════════════════════════════════════════════════════

  Snake.prototype._spawnPursuer = function () {
    // Spawn in a corner, away from the snake head
    var corners = [
      { x: 1, y: 1 },
      { x: this._cols - 2, y: 1 },
      { x: 1, y: this._rows - 2 },
      { x: this._cols - 2, y: this._rows - 2 }
    ];
    // Pick the corner farthest from the snake head
    var head = this._snake[0];
    var best = corners[0], bestDist = 0;
    for (var i = 0; i < corners.length; i++) {
      var d = Math.abs(corners[i].x - head.x) + Math.abs(corners[i].y - head.y);
      if (d > bestDist) { bestDist = d; best = corners[i]; }
    }
    this._pursuers.push({
      x: best.x, y: best.y,
      tickTimer: 0
    });
    this.playSFX('pursuer-spawn');
  };

  Snake.prototype._movePursuer = function (pur) {
    if (!this._snake.length) return;
    var head = this._snake[0];
    var dx = head.x - pur.x;
    var dy = head.y - pur.y;

    // Simple chase: move toward head along the axis with greater distance
    // With some randomness to avoid perfect tracking
    var moveX = 0, moveY = 0;
    if (Math.random() < 0.15) {
      // Random move
      var dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
      var pick = dirs[Math.floor(Math.random() * dirs.length)];
      moveX = pick.x;
      moveY = pick.y;
    } else if (Math.abs(dx) > Math.abs(dy)) {
      moveX = dx > 0 ? 1 : -1;
    } else if (dy !== 0) {
      moveY = dy > 0 ? 1 : -1;
    } else {
      moveX = dx > 0 ? 1 : -1;
    }

    var nx = pur.x + moveX;
    var ny = pur.y + moveY;

    // Stay in bounds
    if (nx < 0 || nx >= this._cols || ny < 0 || ny >= this._rows) return;

    // Don't walk onto snake body (but CAN walk onto head — that's a kill)
    for (var i = 1; i < this._snake.length; i++) {
      if (this._snake[i].x === nx && this._snake[i].y === ny) return;
    }

    pur.x = nx;
    pur.y = ny;
  };

  // ════════════════════════════════════════════════════════════
  // DRAW
  // ════════════════════════════════════════════════════════════

  Snake.prototype.onDraw = function (ctx, W, H) {
    var C = this._cellSize;
    var ph = this.colors.phosphor;
    var dim = this.colors.phosphorDim;
    var ox = this._gridOffsetX;
    var oy = this._gridOffsetY;
    var cols = this._cols;
    var rows = this._rows;

    // ── Background ──
    ctx.fillStyle = '#080808';
    ctx.fillRect(ox, oy, cols * C, rows * C);

    // ── Grid lines (subtle network topology look) ──
    ctx.strokeStyle = dim;
    ctx.lineWidth = 0.3;
    ctx.globalAlpha = 0.08;
    for (var c = 0; c <= cols; c++) {
      ctx.beginPath();
      ctx.moveTo(ox + c * C, oy);
      ctx.lineTo(ox + c * C, oy + rows * C);
      ctx.stroke();
    }
    for (var r = 0; r <= rows; r++) {
      ctx.beginPath();
      ctx.moveTo(ox, oy + r * C);
      ctx.lineTo(ox + cols * C, oy + r * C);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // ── Border (containment perimeter) ──
    ctx.strokeStyle = ph;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.4;
    ctx.strokeRect(ox - 1, oy - 1, cols * C + 2, rows * C + 2);
    ctx.globalAlpha = 1;

    // ── Food ──
    if (this._food) {
      var fx = ox + this._food.x * C + C / 2;
      var fy = oy + this._food.y * C + C / 2;
      var bob = Math.sin(Date.now() * 0.005) * 2;
      this.drawEmoji(ctx, EMOJI.food, fx, fy + bob, C * 0.8, { glow: true, glowColor: '#ff4757' });
    }

    // ── Encrypted packet (pulsing, time-limited) ──
    if (this._encrypted) {
      var ex = ox + this._encrypted.x * C + C / 2;
      var ey = oy + this._encrypted.y * C + C / 2;
      var pulse = 0.7 + Math.sin(Date.now() * 0.01) * 0.15;
      var urgency = this._encryptedTimer < 90 ? (0.4 + Math.sin(Date.now() * 0.03) * 0.4) : 1;
      this.drawEmoji(ctx, EMOJI.encrypted, ex, ey, C * pulse, {
        glow: true, glowColor: '#ffff00', alpha: urgency
      });
    }

    // ── Snake body (tail first so head draws on top) ──
    for (var i = this._snake.length - 1; i >= 0; i--) {
      var seg = this._snake[i];
      var sx = ox + seg.x * C + C / 2;
      var sy = oy + seg.y * C + C / 2;

      if (i === 0) {
        // Head — emoji with glow
        this.drawEmoji(ctx, EMOJI.head, sx, sy, C * 0.9, { glow: true });
      } else {
        // Body segments — green circles that fade toward tail
        var alpha = 0.4 + 0.6 * (1 - i / this._snake.length);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = ph;
        ctx.shadowColor = ph;
        ctx.shadowBlur = 4;
        var segR = (C - 3) / 2;
        ctx.beginPath();
        ctx.arc(sx, sy, segR, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
    }

    // ── Pursuers ──
    for (var pi = 0; pi < this._pursuers.length; pi++) {
      var pur = this._pursuers[pi];
      var px = ox + pur.x * C + C / 2;
      var py = oy + pur.y * C + C / 2;
      var purPulse = 0.8 + Math.sin(Date.now() * 0.008 + pi * 2) * 0.1;
      this.drawEmoji(ctx, EMOJI.pursuer, px, py, C * purPulse, {
        glow: true, glowColor: '#ff4757'
      });
    }

    // ── Particles ──
    this._drawParticles(ctx, C);

    // ── HUD ──
    this.drawText(ctx, 'SCORE: ' + this.score, 8, 14, 10, ph);
    this.drawText(ctx, 'LEN: ' + this._snake.length, 100, 14, 10, dim);

    // Section flash
    if (this._sectionFlash > 0 && difficultyRamp.sectionName()) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this._sectionFlash / 40);
      this.drawText(ctx, '— ' + difficultyRamp.sectionName().toUpperCase() + ' —',
        W / 2, H * 0.15, 14, ph, 'center');
      ctx.restore();
    }

    // Pursuer warning
    if (this._pursuers.length > 0) {
      var closestDist = 999;
      var head = this._snake[0];
      if (head) {
        for (var pw = 0; pw < this._pursuers.length; pw++) {
          var pd = Math.abs(this._pursuers[pw].x - head.x) + Math.abs(this._pursuers[pw].y - head.y);
          if (pd < closestDist) closestDist = pd;
        }
        if (closestDist < 4) {
          ctx.save();
          ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.015) * 0.3;
          this.drawText(ctx, '⚠️ ANTIVIRUS NEARBY', W / 2, H - 12, 10, this.colors.red, 'center');
          ctx.restore();
        }
      }
    }
  };

  /**
   * Render particles (score text, crash emoji).
   */
  Snake.prototype._drawParticles = function (ctx, C) {
    var particles = this._emitter.getParticles();
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (!p.alive) continue;
      var alpha = p.life / p.maxLife;
      if (p.emoji && p.emoji.length <= 2) {
        this.drawEmoji(ctx, p.emoji, p.x, p.y, C * 0.6, { alpha: alpha });
      } else if (p.emoji) {
        ctx.save();
        ctx.globalAlpha = alpha;
        this.drawText(ctx, p.emoji, p.x, p.y, 11, this.colors.phosphorBright, 'center');
        ctx.restore();
      }
    }
  };

  // ════════════════════════════════════════════════════════════
  // EXPORT — MinigameModal compatible
  // ════════════════════════════════════════════════════════════

  var instance = new Snake();
  return instance.asMinigame();
})();
