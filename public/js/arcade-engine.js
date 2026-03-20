/**
 * arcade-engine.js — ArcadeEngine Base Class
 *
 * Shared infrastructure for all /games arcade minigames AND gone-rogue
 * boss encounter minigame modules. Any game built on ArcadeEngine gets:
 *
 *   - Responsive canvas (DPR-aware, max 600px)
 *   - Fixed-timestep game loop (16.67ms / 60fps)
 *   - Unified input via ArcadeInput (touch, keyboard, mouse)
 *   - Emoji sprite renderer with glow, scale, rotation
 *   - AABB + circle collision detection
 *   - State machine (MENU → PLAYING → PAUSED → GAME_OVER)
 *   - Audio bridge (AudioSystem.playSFX / playMusic)
 *   - Score tracker + currency conversion (CurrencySystem bridge)
 *   - HUD overlay via ArcadeHUD
 *   - BossAdapter interface for gone-rogue integration
 *
 * SUBCLASS PATTERN:
 *   function FroggerGame() { ArcadeEngine.call(this, { ... }); }
 *   FroggerGame.prototype = Object.create(ArcadeEngine.prototype);
 *   FroggerGame.prototype.constructor = FroggerGame;
 *   FroggerGame.prototype.onUpdate = function(dt) { ... };
 *   FroggerGame.prototype.onDraw = function(ctx) { ... };
 *   FroggerGame.prototype.onInput = function(type, data) { ... };
 *
 * MINIGAME MODAL COMPAT:
 *   Games expose { start(canvas), stop(), resize(canvas) } via
 *   ArcadeEngine.prototype.asMinigame() for MinigameModal registry.
 *
 * Depends on: arcade-input.js, arcade-hud.js
 */
var ArcadeEngine = (function () {
  'use strict';

  // ── Constants ──
  var FIXED_DT = 1000 / 60;        // 16.67ms timestep
  var MAX_FRAME_SKIP = 5;           // prevent spiral of death
  var MAX_CANVAS_WIDTH = 600;       // px, CSS pixels
  var ACCOUNT_KEY = 'eyesonly_account';
  var HIGHSCORE_KEY = 'eyesonly_arcade_highscores';

  // ── Game states ──
  var STATE = {
    MENU:      'MENU',
    PLAYING:   'PLAYING',
    PAUSED:    'PAUSED',
    GAME_OVER: 'GAME_OVER'
  };

  // ── CRT theme defaults (fallbacks if CSS vars unavailable) ──
  var CRT = {
    phosphor:     '#1cff9b',
    phosphorDim:  '#1a6b4a',
    phosphorBright: '#7dffca',
    bg:           '#0a0a0a',
    amber:        '#ffb347',
    red:          '#ff4757',
    font:         '"Courier New", Courier, monospace'
  };

  /**
   * Read a CSS variable from :root, with fallback.
   */
  function cssVar(name, fallback) {
    try {
      var val = getComputedStyle(document.documentElement)
        .getPropertyValue(name).trim();
      return val || fallback;
    } catch (_) {
      return fallback;
    }
  }

  /**
   * @constructor
   * @param {Object} config
   * @param {string}  config.gameId       — unique ID (e.g. 'frogger')
   * @param {string}  [config.title]      — display name
   * @param {number}  [config.lives]      — starting lives (default 3)
   * @param {number}  [config.currencyRate] — ¢ per score point (default 0.02)
   * @param {boolean} [config.bossMode]   — true when mounted as boss encounter
   */
  function ArcadeEngine(config) {
    config = config || {};

    this.gameId = config.gameId || 'arcade';
    this.title = config.title || this.gameId;
    this.currencyRate = config.currencyRate || 0.02;
    this.bossMode = config.bossMode || false;

    // ── Canvas & rendering ──
    this.canvas = null;
    this.ctx = null;
    this.W = 0;
    this.H = 0;
    this.dpr = 1;

    // ── Game state ──
    this.state = STATE.MENU;
    this.score = 0;
    this.highScore = this._loadHighScore();
    this.lives = config.lives != null ? config.lives : 3;
    this.maxLives = this.lives;
    this.level = 1;
    this.currencyEarned = 0;

    // ── Loop ──
    this._raf = null;
    this._lastTime = 0;
    this._accumulator = 0;
    this._running = false;

    // ── Input ──
    this._input = null;

    // ── HUD ──
    this._hud = null;

    // ── Boss adapter state ──
    this._bossState = null;

    // ── CRT colors (resolved on start) ──
    this.colors = {};
  }

  // ── Expose STATE enum ──
  ArcadeEngine.STATE = STATE;

  // ── Expose CRT defaults ──
  ArcadeEngine.CRT = CRT;

  // ════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ════════════════════════════════════════════════════════════

  /**
   * Initialise the engine with a canvas element.
   * Called by MinigameModal via the start(canvas) interface.
   */
  ArcadeEngine.prototype.start = function (canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this._setupCanvas();
    this._resolveColors();

    // Input
    this._input = new ArcadeInput(canvas);
    this._bindInput();

    // HUD
    if (typeof ArcadeHUD !== 'undefined') {
      this._hud = new ArcadeHUD(this);
    }

    // Reset game
    this.score = 0;
    this.lives = this.maxLives;
    this.level = 1;
    this.currencyEarned = 0;

    // Let subclass initialise
    if (this.onInit) this.onInit();

    // Enter menu or playing depending on mode
    if (this.bossMode) {
      this.setState(STATE.PLAYING);
    } else {
      this.setState(STATE.MENU);
    }

    // Start loop
    this._running = true;
    this._lastTime = performance.now();
    this._accumulator = 0;
    this._tick(this._lastTime);
  };

  /**
   * Stop the engine. Called by MinigameModal on close.
   */
  ArcadeEngine.prototype.stop = function () {
    this._running = false;
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }
    if (this._input) {
      this._input.destroy();
      this._input = null;
    }
    if (this.onDestroy) this.onDestroy();
    this.canvas = null;
    this.ctx = null;
  };

  /**
   * Handle canvas resize. Called by MinigameModal on window resize.
   */
  ArcadeEngine.prototype.resize = function (canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this._setupCanvas();
    if (this.onResize) this.onResize(this.W, this.H);
  };

  /**
   * Return a MinigameModal-compatible interface.
   * Usage: window.FroggerGame = myFroggerInstance.asMinigame();
   */
  ArcadeEngine.prototype.asMinigame = function () {
    var self = this;
    return {
      start: function (canvas) { self.start(canvas); },
      stop: function () { self.stop(); },
      resize: function (canvas) { self.resize(canvas); }
    };
  };

  // ════════════════════════════════════════════════════════════
  // CANVAS SETUP
  // ════════════════════════════════════════════════════════════

  ArcadeEngine.prototype._setupCanvas = function () {
    this.dpr = window.devicePixelRatio || 1;
    var rect = this.canvas.getBoundingClientRect();
    var cssW = Math.min(rect.width, MAX_CANVAS_WIDTH);
    var cssH = rect.height;

    this.canvas.width = cssW * this.dpr;
    this.canvas.height = cssH * this.dpr;
    this.W = this.canvas.width;
    this.H = this.canvas.height;

    this.ctx.scale(this.dpr, this.dpr);
    // Logical dimensions (CSS pixels) for game logic
    this.logicalW = cssW;
    this.logicalH = cssH;
  };

  ArcadeEngine.prototype._resolveColors = function () {
    this.colors = {
      phosphor:       cssVar('--phosphor', CRT.phosphor),
      phosphorDim:    cssVar('--phosphor-dim', CRT.phosphorDim),
      phosphorBright: cssVar('--phosphor-bright', CRT.phosphorBright),
      bg:             cssVar('--crt-bg', CRT.bg),
      amber:          CRT.amber,
      red:            CRT.red,
      font:           CRT.font
    };
  };

  // ════════════════════════════════════════════════════════════
  // GAME LOOP (fixed timestep)
  // ════════════════════════════════════════════════════════════

  ArcadeEngine.prototype._tick = function (now) {
    if (!this._running) return;
    var self = this;
    this._raf = requestAnimationFrame(function (t) { self._tick(t); });

    var delta = now - this._lastTime;
    this._lastTime = now;

    // Clamp to prevent huge jumps (e.g. tab was backgrounded)
    if (delta > FIXED_DT * MAX_FRAME_SKIP) delta = FIXED_DT * MAX_FRAME_SKIP;

    this._accumulator += delta;

    // Fixed-timestep updates
    var steps = 0;
    while (this._accumulator >= FIXED_DT && steps < MAX_FRAME_SKIP) {
      if (this.state === STATE.PLAYING) {
        if (this.onUpdate) this.onUpdate(FIXED_DT);
      }
      this._accumulator -= FIXED_DT;
      steps++;
    }

    // Render
    this._render();
  };

  ArcadeEngine.prototype._render = function () {
    var ctx = this.ctx;
    if (!ctx) return;

    ctx.save();

    // Clear
    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(0, 0, this.logicalW, this.logicalH);

    // Game draw
    if (this.onDraw) {
      this.onDraw(ctx, this.logicalW, this.logicalH);
    }

    // State overlays
    if (this.state === STATE.MENU) {
      this._drawMenuOverlay(ctx);
    } else if (this.state === STATE.PAUSED) {
      this._drawPauseOverlay(ctx);
    } else if (this.state === STATE.GAME_OVER) {
      this._drawGameOverOverlay(ctx);
    }

    // HUD (always on top)
    if (this._hud) {
      this._hud.draw(ctx, this.logicalW, this.logicalH);
    }

    ctx.restore();
  };

  // ════════════════════════════════════════════════════════════
  // STATE MACHINE
  // ════════════════════════════════════════════════════════════

  ArcadeEngine.prototype.setState = function (newState) {
    var old = this.state;
    this.state = newState;

    if (newState === STATE.GAME_OVER && old !== STATE.GAME_OVER) {
      this._onGameOver();
    }
    if (this.onStateChange) this.onStateChange(newState, old);
  };

  ArcadeEngine.prototype._onGameOver = function () {
    // Update high score
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this._saveHighScore();
    }

    // Currency conversion
    this.currencyEarned = Math.floor(this.score * this.currencyRate);
    this._awardCurrency(this.currencyEarned);

    // SFX
    this.playSFX('game-over');
  };

  // ════════════════════════════════════════════════════════════
  // INPUT BINDING
  // ════════════════════════════════════════════════════════════

  ArcadeEngine.prototype._bindInput = function () {
    var self = this;
    var events = ['tap', 'swipe', 'drag', 'dragstart', 'dragend',
                  'doubletap', 'longpress', 'keyaction'];

    events.forEach(function (evt) {
      self._input.on(evt, function (data) {
        // Global handlers (state transitions)
        if (evt === 'tap' || evt === 'keyaction') {
          if (self.state === STATE.MENU) {
            self._startGame();
            return;
          }
          if (self.state === STATE.GAME_OVER) {
            if (evt === 'keyaction' && data.action === 'action') {
              self._restartGame();
              return;
            }
            if (evt === 'tap') {
              self._restartGame();
              return;
            }
          }
        }
        if (evt === 'keyaction' && data.action === 'secondary' &&
            self.state === STATE.PLAYING) {
          self.setState(STATE.PAUSED);
          return;
        }
        if (evt === 'keyaction' && data.action === 'secondary' &&
            self.state === STATE.PAUSED) {
          self.setState(STATE.PLAYING);
          return;
        }
        if (evt === 'tap' && self.state === STATE.PAUSED) {
          self.setState(STATE.PLAYING);
          return;
        }

        // Pass to subclass
        if (self.state === STATE.PLAYING && self.onInput) {
          self.onInput(evt, data);
        }
      });
    });
  };

  ArcadeEngine.prototype._startGame = function () {
    this.score = 0;
    this.lives = this.maxLives;
    this.level = 1;
    this.currencyEarned = 0;
    if (this.onStart) this.onStart();
    this.setState(STATE.PLAYING);
    this.playSFX('game-start');
  };

  ArcadeEngine.prototype._restartGame = function () {
    this._startGame();
  };

  /**
   * Check if a key is currently held. Delegate to ArcadeInput.
   * @param {string} action — 'up','down','left','right','action','secondary'
   */
  ArcadeEngine.prototype.isKeyHeld = function (action) {
    return this._input ? this._input.isHeld(action) : false;
  };

  // ════════════════════════════════════════════════════════════
  // EMOJI RENDERER
  // ════════════════════════════════════════════════════════════

  /**
   * Draw an emoji character at a given position with optional transforms.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} emoji   — the emoji character(s)
   * @param {number} x       — center x (logical px)
   * @param {number} y       — center y (logical px)
   * @param {number} size    — font size in px
   * @param {Object} [opts]
   * @param {number} [opts.rotation]  — radians
   * @param {number} [opts.alpha]     — 0-1 opacity
   * @param {boolean} [opts.glow]     — apply phosphor glow
   * @param {number} [opts.glowRadius] — glow blur radius (default 8)
   * @param {string} [opts.glowColor] — glow color
   */
  ArcadeEngine.prototype.drawEmoji = function (ctx, emoji, x, y, size, opts) {
    opts = opts || {};
    ctx.save();
    ctx.translate(x, y);

    if (opts.rotation) ctx.rotate(opts.rotation);
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;

    if (opts.glow) {
      ctx.shadowColor = opts.glowColor || this.colors.phosphor;
      ctx.shadowBlur = opts.glowRadius || 8;
    }

    ctx.font = size + 'px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 0, 0);

    ctx.restore();
  };

  /**
   * Draw text in CRT phosphor style.
   */
  ArcadeEngine.prototype.drawText = function (ctx, text, x, y, size, color, align) {
    ctx.save();
    ctx.font = (size || 14) + 'px ' + this.colors.font;
    ctx.fillStyle = color || this.colors.phosphor;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color || this.colors.phosphor;
    ctx.shadowBlur = 4;
    ctx.fillText(text, x, y);
    ctx.restore();
  };

  // ════════════════════════════════════════════════════════════
  // COLLISION DETECTION
  // ════════════════════════════════════════════════════════════

  /**
   * AABB overlap test.
   * Each rect: { x, y, w, h } where x,y is top-left.
   */
  ArcadeEngine.collideAABB = function (a, b) {
    return a.x < b.x + b.w &&
           a.x + a.w > b.x &&
           a.y < b.y + b.h &&
           a.y + a.h > b.y;
  };

  /**
   * Circle-circle overlap test.
   * Each circle: { x, y, r } where x,y is center.
   */
  ArcadeEngine.collideCircle = function (a, b) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    var rSum = a.r + b.r;
    return dx * dx + dy * dy < rSum * rSum;
  };

  /**
   * Point inside AABB.
   */
  ArcadeEngine.pointInRect = function (px, py, rect) {
    return px >= rect.x && px <= rect.x + rect.w &&
           py >= rect.y && py <= rect.y + rect.h;
  };

  /**
   * Grid-based spatial hash for broad-phase collision.
   * Returns pairs of indices that share a cell.
   *
   * @param {Array} entities — array of { x, y, w, h }
   * @param {number} cellSize
   * @returns {Array} — array of [i, j] index pairs
   */
  ArcadeEngine.broadPhase = function (entities, cellSize) {
    var grid = {};
    var pairs = [];

    for (var i = 0; i < entities.length; i++) {
      var e = entities[i];
      var minCX = Math.floor(e.x / cellSize);
      var maxCX = Math.floor((e.x + (e.w || 0)) / cellSize);
      var minCY = Math.floor(e.y / cellSize);
      var maxCY = Math.floor((e.y + (e.h || 0)) / cellSize);

      for (var cx = minCX; cx <= maxCX; cx++) {
        for (var cy = minCY; cy <= maxCY; cy++) {
          var key = cx + ',' + cy;
          if (!grid[key]) grid[key] = [];
          var cell = grid[key];
          for (var j = 0; j < cell.length; j++) {
            pairs.push([cell[j], i]);
          }
          cell.push(i);
        }
      }
    }
    return pairs;
  };

  // ════════════════════════════════════════════════════════════
  // AUDIO BRIDGE
  // ════════════════════════════════════════════════════════════

  /**
   * Play a sound effect via AudioSystem.
   */
  ArcadeEngine.prototype.playSFX = function (name, opts) {
    if (typeof AudioSystem !== 'undefined' && AudioSystem.playSFX) {
      AudioSystem.playSFX(name, opts);
    } else if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
      AudioSystem.play(name, opts);
    }
  };

  /**
   * Start background music via AudioSystem.
   */
  ArcadeEngine.prototype.playMusic = function (name) {
    if (typeof AudioSystem !== 'undefined' && AudioSystem.playMusic) {
      AudioSystem.playMusic(name);
    }
  };

  /**
   * Stop background music.
   */
  ArcadeEngine.prototype.stopMusic = function () {
    if (typeof AudioSystem !== 'undefined' && AudioSystem.stopMusic) {
      AudioSystem.stopMusic();
    }
  };

  // ════════════════════════════════════════════════════════════
  // SCORING & CURRENCY
  // ════════════════════════════════════════════════════════════

  /**
   * Add points to the current score.
   */
  ArcadeEngine.prototype.addScore = function (points) {
    this.score += points;
    if (this.score > this.highScore) {
      this.highScore = this.score;
    }
  };

  /**
   * Remove a life. If lives hit 0, trigger GAME_OVER.
   */
  ArcadeEngine.prototype.loseLife = function () {
    this.lives--;
    this.playSFX('death');
    if (this.lives <= 0) {
      this.lives = 0;
      this.setState(STATE.GAME_OVER);
    }
  };

  /**
   * Advance to next level.
   */
  ArcadeEngine.prototype.nextLevel = function () {
    this.level++;
    this.playSFX('level-up');
    if (this.onLevelUp) this.onLevelUp(this.level);
  };

  ArcadeEngine.prototype._awardCurrency = function (amount) {
    if (amount <= 0) return;
    try {
      var acct = JSON.parse(localStorage.getItem(ACCOUNT_KEY) || '{}');
      acct.puzzleCoins = (acct.puzzleCoins || 0) + amount;
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify(acct));
    } catch (_) {}
  };

  ArcadeEngine.prototype._loadHighScore = function () {
    try {
      var scores = JSON.parse(localStorage.getItem(HIGHSCORE_KEY) || '{}');
      return scores[this.gameId] || 0;
    } catch (_) {
      return 0;
    }
  };

  ArcadeEngine.prototype._saveHighScore = function () {
    try {
      var scores = JSON.parse(localStorage.getItem(HIGHSCORE_KEY) || '{}');
      scores[this.gameId] = this.highScore;
      localStorage.setItem(HIGHSCORE_KEY, JSON.stringify(scores));
    } catch (_) {}
  };

  // ════════════════════════════════════════════════════════════
  // STATE OVERLAYS
  // ════════════════════════════════════════════════════════════

  ArcadeEngine.prototype._drawMenuOverlay = function (ctx) {
    var w = this.logicalW;
    var h = this.logicalH;
    var cx = w / 2;

    // Semi-transparent backdrop
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, w, h);

    // Title
    this.drawText(ctx, this.title.toUpperCase(), cx, h * 0.35, 28,
                  this.colors.phosphorBright, 'center');

    // Instruction
    this.drawText(ctx, 'TAP or SPACE to start', cx, h * 0.55, 14,
                  this.colors.phosphorDim, 'center');

    // High score
    if (this.highScore > 0) {
      this.drawText(ctx, 'HIGH SCORE: ' + this.highScore, cx, h * 0.68, 12,
                    this.colors.amber, 'center');
    }
  };

  ArcadeEngine.prototype._drawPauseOverlay = function (ctx) {
    var w = this.logicalW;
    var h = this.logicalH;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, w, h);

    this.drawText(ctx, 'PAUSED', w / 2, h * 0.45, 24,
                  this.colors.amber, 'center');
    this.drawText(ctx, 'TAP or SHIFT to resume', w / 2, h * 0.58, 12,
                  this.colors.phosphorDim, 'center');
  };

  ArcadeEngine.prototype._drawGameOverOverlay = function (ctx) {
    var w = this.logicalW;
    var h = this.logicalH;
    var cx = w / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, w, h);

    this.drawText(ctx, 'GAME OVER', cx, h * 0.3, 24,
                  this.colors.red, 'center');

    this.drawText(ctx, 'SCORE: ' + this.score, cx, h * 0.44, 18,
                  this.colors.phosphor, 'center');

    if (this.score >= this.highScore && this.score > 0) {
      this.drawText(ctx, 'NEW HIGH SCORE!', cx, h * 0.53, 14,
                    this.colors.amber, 'center');
    }

    if (this.currencyEarned > 0) {
      this.drawEmoji(ctx, '🪙', cx - 30, h * 0.64, 16);
      this.drawText(ctx, '+' + this.currencyEarned + ' \u00A2', cx, h * 0.64, 14,
                    this.colors.amber, 'center');
    }

    this.drawText(ctx, 'TAP or SPACE to retry', cx, h * 0.78, 12,
                  this.colors.phosphorDim, 'center');
  };

  // ════════════════════════════════════════════════════════════
  // BOSS ADAPTER INTERFACE
  // ════════════════════════════════════════════════════════════

  /**
   * Mount as a boss encounter. Called by gone-rogue combat manager.
   *
   * @param {Object} combatState — current STR combat state
   */
  ArcadeEngine.prototype.mount = function (combatState) {
    this._bossState = combatState;
    this.bossMode = true;
    // Subclass should override onBossMount()
    if (this.onBossMount) this.onBossMount(combatState);
  };

  /**
   * Unmount the boss encounter. Returns result for combat manager.
   *
   * @returns {Object} { result: 'win'|'lose', score, loot }
   */
  ArcadeEngine.prototype.unmount = function () {
    var result = {
      result: this.lives > 0 ? 'win' : 'lose',
      score: this.score,
      loot: null,
      mythic: false
    };

    if (this.onBossUnmount) {
      var sub = this.onBossUnmount();
      if (sub) {
        result.loot = sub.loot || null;
        result.mythic = sub.mythic || false;
      }
    }

    this.bossMode = false;
    this._bossState = null;
    return result;
  };

  /**
   * Called each frame from gone-rogue's game loop during boss mode.
   * Delegates to the fixed-timestep engine (already running via RAF).
   *
   * @param {number} deltaMs — ms since last gone-rogue frame
   */
  ArcadeEngine.prototype.updateRealTime = function (deltaMs) {
    // Engine runs its own RAF loop; this is a hook for external sync.
    // Subclass can override for additional real-time logic.
    if (this.onBossUpdate) this.onBossUpdate(deltaMs);
  };

  /**
   * Get current hazard rects for gone-rogue collision pipeline.
   *
   * @returns {Array} — array of { x, y, w, h, damage }
   */
  ArcadeEngine.prototype.getHazards = function () {
    if (this.onGetHazards) return this.onGetHazards();
    return [];
  };

  /**
   * Check mythic condition at unmount.
   *
   * @returns {boolean}
   */
  ArcadeEngine.prototype.onMythicCheck = function () {
    // Subclass overrides with game-specific mythic condition
    return false;
  };

  // ════════════════════════════════════════════════════════════
  // SUBCLASS HOOKS (override these)
  // ════════════════════════════════════════════════════════════

  // ArcadeEngine.prototype.onInit = function() {}
  // ArcadeEngine.prototype.onStart = function() {}
  // ArcadeEngine.prototype.onUpdate = function(dt) {}
  // ArcadeEngine.prototype.onDraw = function(ctx, w, h) {}
  // ArcadeEngine.prototype.onInput = function(type, data) {}
  // ArcadeEngine.prototype.onResize = function(w, h) {}
  // ArcadeEngine.prototype.onLevelUp = function(level) {}
  // ArcadeEngine.prototype.onStateChange = function(newState, oldState) {}
  // ArcadeEngine.prototype.onDestroy = function() {}
  // ArcadeEngine.prototype.onBossMount = function(combatState) {}
  // ArcadeEngine.prototype.onBossUnmount = function() {} → { loot, mythic }
  // ArcadeEngine.prototype.onBossUpdate = function(deltaMs) {}
  // ArcadeEngine.prototype.onGetHazards = function() {} → [{ x, y, w, h, damage }]

  return ArcadeEngine;
})();
