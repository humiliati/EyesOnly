/* ============================================================
   JEZZBALL — Field Containment Protocol
   ArcadeEngine subclass rewrite (JB-1 + JB-2)

   Canvas-based, CRT-themed field containment game.

   Touch/click to start building a wall. Drag direction determines
   horizontal vs vertical orientation. Quick tap uses last direction.
   Trap all balls in < 25% of the area to advance.

   CLASSIC TRICK MECHANICS:
   - Click adjacent to existing wall → single-direction builder
   - Perpendicular builders meeting → form a sealed box
   - Opposing builders colliding → both destroyed (life lost)
   - Builder hitting another in-progress builder → cancelled (life lost)

   JB-2 PHYSICS ENHANCEMENTS:
   - Velocity normalization (unit vector × speed)
   - Sub-step collision for fast balls
   - Ball-ball elastic collision (circle-circle)
   - Axis-independent bounce with wall-edge snapping

   JB-3 FIREBALL SPRITES & PARTICLE FX:
   - Fireball moving animation (7 frames, 80ms) replaces plain circles
   - Fireball explosion (5 frames, 60ms) on builder-ball collision
   - FX001 smoke poof on wall segment destroyed
   - FX002 knockback spark on ball-ball collision
   - FX003 light flash on wall seal complete
   - 3-frame ghost trail behind each ball
   - Containment fill (phosphor wash on trapped areas)
   - Ball destruction warning (amber→red glow near fill threshold)

   Mobile-first: ArcadeInput handles pointer events.
   ============================================================ */
window.JezzBallGame = (function () {
  'use strict';

  // ── Grid constants ──
  var CELL = 8;
  var MAX_BUILDERS = 4;
  var BUILD_SPEED = 0.95;         // cells per frame (deliberate, readable pace)
  var LEVEL_CLEAR_PCT = 75;       // fill % to advance

  // ── Seal sound pool + cooldown (prevents audio spam) ──
  var SEAL_SOUNDS = ['metal-hit-1', 'metal-hit-2', 'clang1', 'clang2', 'clang3',
                     'clang4', 'clang5', 'clang6', 'impact-1', 'impact-2'];
  var SEAL_SFX_COOLDOWN = 200;    // ms between seal sounds

  // ── Sub-step collision config (JB-2) ──
  var SUB_STEP_THRESHOLD = 2.5;   // speed above which we sub-step
  var MAX_SUB_STEPS = 4;

  // ── Ball trail config (JB-3) ──
  var TRAIL_LENGTH = 3;           // ghost positions to keep
  var TRAIL_ALPHA_BASE = 0.15;    // alpha of most recent ghost

  // ── Containment fill config (JB-3) ──
  var FILL_ANIM_DURATION = 300;   // ms to fade in phosphor wash

  // ════════════════════════════════════════════════════════════
  // SPRITE ANIMATION SYSTEM (JB-3)
  // ════════════════════════════════════════════════════════════

  /**
   * Lightweight sprite loader + frame animator.
   * Loads individual PNG frames, caches Image objects,
   * cycles frames at configurable interval.
   */
  var SpriteBank = {
    _cache: {},    // path → Image
    _loaded: {},   // path → boolean

    /**
     * Preload an image and return the Image object.
     * Returns immediately; image may still be loading.
     */
    load: function (path) {
      if (this._cache[path]) return this._cache[path];
      var img = new Image();
      img.src = path;
      var self = this;
      img.onload = function () { self._loaded[path] = true; };
      img.onerror = function () { self._loaded[path] = false; };
      this._cache[path] = img;
      return img;
    },

    isReady: function (path) {
      return this._loaded[path] === true;
    },

    get: function (path) {
      return this._cache[path] || null;
    }
  };

  /**
   * SpriteAnim: a single animation definition.
   * @param {string[]} paths — ordered frame image paths
   * @param {number} frameDuration — ms per frame
   * @param {boolean} [loop=true]
   */
  function SpriteAnim(paths, frameDuration, loop) {
    this.frames = [];
    this.frameDuration = frameDuration || 80;
    this.loop = loop !== false;
    for (var i = 0; i < paths.length; i++) {
      this.frames.push(SpriteBank.load(paths[i]));
    }
  }

  SpriteAnim.prototype.getFrame = function (elapsed) {
    var idx = Math.floor(elapsed / this.frameDuration);
    if (this.loop) {
      idx = idx % this.frames.length;
    } else {
      if (idx >= this.frames.length) return null; // animation done
    }
    var img = this.frames[idx];
    return (img && img.complete && img.naturalWidth > 0) ? img : null;
  };

  SpriteAnim.prototype.isFinished = function (elapsed) {
    if (this.loop) return false;
    return Math.floor(elapsed / this.frameDuration) >= this.frames.length;
  };

  // ── Preload all JB-3 sprite animations ──
  var ASSET_BASE = 'assets/';

  var ANIM_FIREBALL_MOVE = new SpriteAnim([
    ASSET_BASE + 'fireBallStylOo/individual files/fireBallMoving/fireballMoving1.png',
    ASSET_BASE + 'fireBallStylOo/individual files/fireBallMoving/fireballMoving2.png',
    ASSET_BASE + 'fireBallStylOo/individual files/fireBallMoving/fireballMoving3.png',
    ASSET_BASE + 'fireBallStylOo/individual files/fireBallMoving/fireballMoving4.png',
    ASSET_BASE + 'fireBallStylOo/individual files/fireBallMoving/fireballMoving5.png',
    ASSET_BASE + 'fireBallStylOo/individual files/fireBallMoving/fireballMoving6.png',
    ASSET_BASE + 'fireBallStylOo/individual files/fireBallMoving/fireballMoving7.png'
  ], 80, true);

  var ANIM_FIREBALL_EXPLODE = new SpriteAnim([
    ASSET_BASE + 'fireBallStylOo/individual files/fireBallExplosion/fireballExplosion1.png',
    ASSET_BASE + 'fireBallStylOo/individual files/fireBallExplosion/fireballExplosion2.png',
    ASSET_BASE + 'fireBallStylOo/individual files/fireBallExplosion/fireballExplosion3.png',
    ASSET_BASE + 'fireBallStylOo/individual files/fireBallExplosion/fireballExplosion4.png',
    ASSET_BASE + 'fireBallStylOo/individual files/fireBallExplosion/fireballExplosion5.png'
  ], 60, false);

  var ANIM_SMOKE_POOF = new SpriteAnim([
    ASSET_BASE + 'Sprites/Smoke/FX001/FX001_01.png',
    ASSET_BASE + 'Sprites/Smoke/FX001/FX001_02.png',
    ASSET_BASE + 'Sprites/Smoke/FX001/FX001_03.png',
    ASSET_BASE + 'Sprites/Smoke/FX001/FX001_04.png',
    ASSET_BASE + 'Sprites/Smoke/FX001/FX001_05.png'
  ], 60, false);

  var ANIM_KNOCKBACK = new SpriteAnim([
    ASSET_BASE + 'Sprites/Smoke/FX002/FX002_01.png',
    ASSET_BASE + 'Sprites/Smoke/FX002/FX002_02.png',
    ASSET_BASE + 'Sprites/Smoke/FX002/FX002_03.png',
    ASSET_BASE + 'Sprites/Smoke/FX002/FX002_04.png',
    ASSET_BASE + 'Sprites/Smoke/FX002/FX002_05.png',
    ASSET_BASE + 'Sprites/Smoke/FX002/FX002_06.png',
    ASSET_BASE + 'Sprites/Smoke/FX002/FX002_07.png',
    ASSET_BASE + 'Sprites/Smoke/FX002/FX002_08.png'
  ], 40, false);

  var ANIM_LIGHT_FLASH = new SpriteAnim([
    ASSET_BASE + 'Sprites/LightFX/FX003/FX003_01.png',
    ASSET_BASE + 'Sprites/LightFX/FX003/FX003_02.png',
    ASSET_BASE + 'Sprites/LightFX/FX003/FX003_03.png',
    ASSET_BASE + 'Sprites/LightFX/FX003/FX003_04.png',
    ASSET_BASE + 'Sprites/LightFX/FX003/FX003_05.png'
  ], 50, false);

  // ════════════════════════════════════════════════════════════
  // PARTICLE FX SYSTEM (JB-3)
  // ════════════════════════════════════════════════════════════

  /**
   * Particle: a sprite-based or procedural one-shot effect at a world position.
   * { x, y, anim, born, size, alpha, rotation }
   */

  // ── JezzBall game class ──

  function JezzBall() {
    ArcadeEngine.call(this, {
      gameId: 'jezzball',
      title: 'FIELD CONTAINMENT',
      lives: 3,
      currencyRate: 0.015
    });

    // ── ASCII splash screen ──
    this.splashArt = [
      '╔══════════════════════════════════════════╗',
      '║                                          ║',
      '║   ╔═╗╔═╗╔╗╔╔╦╗╔═╗╦╔╗╔╔╦╗╔═╗╔╗╔╔╦╗    ║',
      '║   ║  ║ ║║║║ ║ ╠═╣║║║║║║║║╣ ║║║ ║      ║',
      '║   ╚═╝╚═╝╝╚╝ ╩ ╩ ╩╩╝╚╝╩ ╩╚═╝╝╚╝ ╩     ║',
      '║                                          ║',
      '║   ╔═╗╦═╗╔═╗╔╦╗╔═╗╔═╗╔═╗╦    ╔═╗╔═╗   ║',
      '║   ╠═╝╠╦╝║ ║ ║ ║ ║║  ║ ║║    ║ ║╠═╣   ║',
      '║   ╩  ╩╚═╚═╝ ╩ ╚═╝╚═╝╚═╝╩═╝  ╚═╝╩ ╩   ║',
      '║                                          ║',
      '║        🔴  FIELD CONTAINMENT  🔴         ║',
      '║                                          ║',
      '║   ░░▒▒▓▓████  PROTOCOL 03  ████▓▓▒▒░░  ║',
      '║                                          ║',
      '╚══════════════════════════════════════════╝'
    ].join('\n');

    // ── SFX mapping ──
    this.sfxMap = {
      'build':       'drop-1',
      'wall-break':  'kitty-2',
      'bounce':      'coin-1',
      'level-up':    'toad',
      'game-over':   'game-over-1',
      'game-start':  'game-start',
      'death':       'hit-1'
    };

    // ── Game state (initialized in onStart) ──
    this._cols = 0;
    this._rows = 0;
    this._grid = null;            // Uint8Array — 0=open, 1=wall, 2+=builder cells
    this._balls = [];
    this._builders = [];
    this._nextBuilderID = 1;
    this._buildAccum = 0;
    this._direction = 'h';        // next wall direction
    this._won = false;
    this._pct = 0;
    this._levelTransition = null; // { timer }
    this._dirIndicator = null;    // { x, y, dir, timer }
    this._lastSealSFXTime = 0;

    // ── Pointer state for drag-to-orient (routed through ArcadeInput) ──
    this._pointerDown = false;
    this._pointerStartX = 0;
    this._pointerStartY = 0;
    this._orientDecided = false;
    this._DRAG_THRESHOLD = 8;

    // ── Pre-rendered layers ──
    this._latticeCanvas = null;
    this._wallCanvas = null;
    this._wallCtx = null;
    this._wallDirty = true;

    // ── Cached CSS colors (resolved once, not per frame) ──
    this._ph = '#1cff9b';
    this._dim = '#1a6b4a';
    this._phR = 28;
    this._phG = 255;
    this._phB = 155;

    // ── JB-3: Particle FX pool ──
    this._particles = [];         // active particle effects

    // ── JB-3: Containment fill animations ──
    this._fillAnims = [];         // { cells: [idx,...], born: timestamp }

    // ── JB-3: Ball animation time offset (stagger so they don't sync) ──
    this._ballAnimOffset = 0;
  }

  JezzBall.prototype = Object.create(ArcadeEngine.prototype);
  JezzBall.prototype.constructor = JezzBall;

  // ════════════════════════════════════════════════════════════
  // LIFECYCLE HOOKS
  // ════════════════════════════════════════════════════════════

  /**
   * Called once after ArcadeEngine.start() sets up canvas + input.
   */
  JezzBall.prototype.onInit = function () {
    this._resolveJezzColors();
  };

  /**
   * Called when the player starts/restarts a game from the MENU screen.
   * ArcadeEngine already resets score, lives, level.
   */
  JezzBall.prototype.onStart = function () {
    var W = this.W;
    var H = this.H;

    this._cols = Math.floor(W / CELL);
    this._rows = Math.floor(H / CELL);

    // Uint8Array grid (JB-1 upgrade)
    this._grid = new Uint8Array(this._cols * this._rows);
    this._initBorders();

    this._balls = [];
    this._builders = [];
    this._nextBuilderID = 1;
    this._buildAccum = 0;
    this._direction = 'h';
    this._won = false;
    this._levelTransition = null;
    this._dirIndicator = null;
    this._particles = [];
    this._fillAnims = [];
    this._ballAnimOffset = performance.now();

    this._resolveJezzColors();
    this._initWallCanvas();
    this._buildLattice();
    this._spawnBalls(this.level + 1);
    this._calcPct();
    this._wallDirty = true;
  };

  /**
   * Called on canvas resize.
   */
  JezzBall.prototype.onResize = function (W, H) {
    this._cols = Math.floor(W / CELL);
    this._rows = Math.floor(H / CELL);
    this._resolveJezzColors();
    this._initWallCanvas();
    this._buildLattice();
  };

  /**
   * Called on engine stop.
   */
  JezzBall.prototype.onDestroy = function () {
    this._latticeCanvas = null;
    this._wallCanvas = null;
    this._wallCtx = null;
  };

  // ════════════════════════════════════════════════════════════
  // INPUT (via ArcadeInput)
  // ════════════════════════════════════════════════════════════

  JezzBall.prototype.onInput = function (evt, data) {
    if (this._won || this._levelTransition) return;

    // ── Drag-based direction detection ──
    if (evt === 'dragstart') {
      this._pointerDown = true;
      this._pointerStartX = data.x;
      this._pointerStartY = data.y;
      this._orientDecided = false;
      return;
    }

    if (evt === 'drag' && this._pointerDown && !this._orientDecided) {
      var dx = data.x - this._pointerStartX;
      var dy = data.y - this._pointerStartY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= this._DRAG_THRESHOLD) {
        this._direction = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
        this._orientDecided = true;
        this._dirIndicator = {
          x: this._pointerStartX, y: this._pointerStartY,
          dir: this._direction, timer: 600
        };
        this._startBuild(this._pointerStartX, this._pointerStartY);
        this._pointerDown = false;
      }
      return;
    }

    if (evt === 'dragend') {
      if (this._pointerDown && !this._orientDecided) {
        // Short tap — use last direction
        var px = data.x != null ? data.x : this._pointerStartX;
        var py = data.y != null ? data.y : this._pointerStartY;
        this._dirIndicator = { x: px, y: py, dir: this._direction, timer: 400 };
        this._startBuild(px, py);
      }
      this._pointerDown = false;
      return;
    }

    // ── Tap: place wall at tap location using current direction ──
    if (evt === 'tap') {
      this._dirIndicator = { x: data.x, y: data.y, dir: this._direction, timer: 400 };
      this._startBuild(data.x, data.y);
      return;
    }

    // ── Double-tap: toggle direction ──
    if (evt === 'doubletap') {
      this._direction = this._direction === 'h' ? 'v' : 'h';
      this._dirIndicator = {
        x: data.x, y: data.y, dir: this._direction, timer: 500
      };
      return;
    }

    // ── Keyboard: space to toggle direction, arrows for movement ──
    if (evt === 'keyaction') {
      if (data.action === 'action') {
        this._direction = this._direction === 'h' ? 'v' : 'h';
        this._dirIndicator = {
          x: this.W / 2, y: this.H / 2, dir: this._direction, timer: 500
        };
      }
    }
  };

  // ════════════════════════════════════════════════════════════
  // UPDATE (fixed-timestep, called by ArcadeEngine._tick)
  // ════════════════════════════════════════════════════════════

  JezzBall.prototype.onUpdate = function (dt) {
    if (this.lives <= 0) return;

    // Level transition countdown
    if (this._levelTransition) {
      this._levelTransition.timer -= dt;
      if (this._levelTransition.timer <= 0) {
        this.level++;
        this._nextLevel();
      }
      return;
    }

    if (this._won) return;

    this._updateBalls();

    // Fractional builder advancement (~0.95 cells/frame)
    var buildSpeed = BUILD_SPEED * this.difficultyMultiplier();
    if (this._builders.length > 0) {
      this._buildAccum += buildSpeed;
      while (this._buildAccum >= 1) {
        this._advanceBuilders();
        this._buildAccum -= 1;
      }
    }

    // Direction indicator decay
    if (this._dirIndicator) {
      this._dirIndicator.timer -= dt;
      if (this._dirIndicator.timer <= 0) this._dirIndicator = null;
    }

    // JB-3: tick particles — remove finished ones
    var now = performance.now();
    var alive = [];
    for (var pi = 0; pi < this._particles.length; pi++) {
      var p = this._particles[pi];
      if (!p.anim.isFinished(now - p.born)) {
        alive.push(p);
      }
    }
    this._particles = alive;

    // JB-3: expire old fill animations (keep for FILL_ANIM_DURATION + 100ms buffer)
    var aliveF = [];
    for (var fi = 0; fi < this._fillAnims.length; fi++) {
      if (now - this._fillAnims[fi].born < FILL_ANIM_DURATION + 100) {
        aliveF.push(this._fillAnims[fi]);
      }
    }
    this._fillAnims = aliveF;
  };

  // ════════════════════════════════════════════════════════════
  // DRAW (called by ArcadeEngine._render)
  // ════════════════════════════════════════════════════════════

  JezzBall.prototype.onDraw = function (ctx, W, H) {
    var ph = this._ph;
    var phR = this._phR, phG = this._phG, phB = this._phB;
    var cols = this._cols, rows = this._rows, grid = this._grid;

    // Background
    ctx.fillStyle = '#050808';
    ctx.fillRect(0, 0, W, H);

    // Honeycomb lattice overlay
    if (this._latticeCanvas) {
      ctx.drawImage(this._latticeCanvas, 0, 0);
    }

    // Wall layer (cached offscreen canvas, only redrawn when grid changes)
    if (this._wallDirty) this._redrawWallCanvas();
    if (this._wallCanvas) ctx.drawImage(this._wallCanvas, 0, 0);

    // Builder cells (dynamic, always rendered)
    if (this._builders.length > 0) {
      this._drawBuilders(ctx, cols, rows, grid, ph);
    }

    // JB-3: Containment fill animation (phosphor wash on trapped areas)
    this._drawContainmentFill(ctx, cols, rows, grid, phR, phG, phB);

    // Ball light emission (additive radial glow)
    // JB-3: destruction warning — balls glow amber/red when pct approaches threshold
    var warningTint = this._getWarningTint();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var li = 0; li < this._balls.length; li++) {
      var lb = this._balls[li];
      var glowR = CELL * 6;
      var gR = warningTint ? warningTint.r : phR;
      var gG = warningTint ? warningTint.g : phG;
      var gB = warningTint ? warningTint.b : phB;
      var grad = ctx.createRadialGradient(lb.x, lb.y, lb.r * 0.5, lb.x, lb.y, glowR);
      grad.addColorStop(0,   'rgba(' + gR + ',' + gG + ',' + gB + ',0.22)');
      grad.addColorStop(0.2, 'rgba(' + gR + ',' + gG + ',' + gB + ',0.12)');
      grad.addColorStop(0.5, 'rgba(' + gR + ',' + gG + ',' + gB + ',0.04)');
      grad.addColorStop(1,   'rgba(' + gR + ',' + gG + ',' + gB + ',0)');
      ctx.fillStyle = grad;
      ctx.fillRect(lb.x - glowR, lb.y - glowR, glowR * 2, glowR * 2);
    }
    ctx.restore();

    // JB-3: Ball trails (ghost positions at reduced alpha)
    var now = performance.now();
    for (var ti = 0; ti < this._balls.length; ti++) {
      var tb = this._balls[ti];
      if (!tb.trail) continue;
      for (var tt = 0; tt < tb.trail.length; tt++) {
        var tp = tb.trail[tt];
        var trailAlpha = TRAIL_ALPHA_BASE * ((tt + 1) / tb.trail.length);
        var trailSize = tb.r * 2 * (0.5 + 0.5 * ((tt + 1) / tb.trail.length));
        var trailFrame = ANIM_FIREBALL_MOVE.getFrame(
          now - this._ballAnimOffset + (tb.animOffset || 0)
        );
        if (trailFrame) {
          ctx.save();
          ctx.globalAlpha = trailAlpha;
          ctx.drawImage(trailFrame,
            tp.x - trailSize * 0.5, tp.y - trailSize * 0.5,
            trailSize, trailSize);
          ctx.restore();
        } else {
          ctx.save();
          ctx.globalAlpha = trailAlpha;
          ctx.fillStyle = ph;
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, tb.r * 0.7, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // Balls (core) — JB-3: use fireball moving sprite, fall back to circle
    var ballDrawSize = CELL * 2;  // 16px — scales 320px sprite to game-appropriate size
    for (var i = 0; i < this._balls.length; i++) {
      var ball = this._balls[i];
      var elapsed = now - this._ballAnimOffset + (ball.animOffset || 0);
      var fireFrame = ANIM_FIREBALL_MOVE.getFrame(elapsed);

      if (fireFrame) {
        // Sprite-based rendering
        ctx.save();
        // JB-3: warning tint overlay
        if (warningTint) {
          ctx.shadowColor = 'rgba(' + warningTint.r + ',' + warningTint.g + ',' + warningTint.b + ',0.8)';
          ctx.shadowBlur = 10;
        }
        ctx.drawImage(fireFrame,
          ball.x - ballDrawSize * 0.5, ball.y - ballDrawSize * 0.5,
          ballDrawSize, ballDrawSize);
        ctx.restore();
      } else {
        // Fallback: phosphor circle (original rendering)
        ctx.save();
        ctx.shadowColor = warningTint
          ? 'rgb(' + warningTint.r + ',' + warningTint.g + ',' + warningTint.b + ')'
          : ph;
        ctx.shadowBlur = 8;
        ctx.fillStyle = warningTint
          ? 'rgb(' + warningTint.r + ',' + warningTint.g + ',' + warningTint.b + ')'
          : ph;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.arc(ball.x - 1, ball.y - 1, ball.r * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // JB-3: Particle FX (explosions, smoke, sparks, flashes)
    this._drawParticles(ctx, now);

    // Direction indicator at touch point
    if (this._dirIndicator) {
      this._drawDirIndicator(ctx, ph);
    }

    // HUD line
    ctx.fillStyle = ph;
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    var livesStr = '';
    for (var lh = 0; lh < this.lives; lh++) livesStr += '\u2665';
    ctx.fillText('LVL:' + this.level + '  FILLED:' + this._pct + '%  ' +
                 livesStr + '  SCR:' + this.score, 8, 14);

    // Active builders count
    if (this._builders.length > 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff9b1c';
      ctx.fillText('BUILDING: ' + this._builders.length + '/' + MAX_BUILDERS, W / 2, H - 6);
    }

    // Direction badge (top-right)
    ctx.textAlign = 'right';
    ctx.fillStyle = this._direction === 'h' ? ph : '#ff9b1c';
    ctx.fillText('[' + (this._direction === 'h' ? '\u2501 HORIZ' : '\u2503 VERT') + ']', W - 8, 14);

    // Level transition overlay
    if (this._levelTransition) {
      var tPct = 1 - (this._levelTransition.timer / 1500);
      ctx.fillStyle = 'rgba(0,0,0,' + (0.4 * tPct) + ')';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = ph;
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('LEVEL ' + this.level + ' CLEAR!', W / 2, H / 2 - 10);
      ctx.font = '11px monospace';
      ctx.fillText(this._pct + '% CONTAINED \u2014 +1000 PTS', W / 2, H / 2 + 10);
      ctx.fillText('LEVEL ' + (this.level + 1) + ' INCOMING...', W / 2, H / 2 + 28);
    }
  };

  // ════════════════════════════════════════════════════════════
  // GRID HELPERS
  // ════════════════════════════════════════════════════════════

  JezzBall.prototype._initBorders = function () {
    var cols = this._cols, rows = this._rows, grid = this._grid;
    for (var c = 0; c < cols; c++) {
      grid[c] = 1;
      grid[(rows - 1) * cols + c] = 1;
    }
    for (var r = 0; r < rows; r++) {
      grid[r * cols] = 1;
      grid[r * cols + cols - 1] = 1;
    }
  };

  JezzBall.prototype._setCell = function (c, r, v) {
    if (c >= 0 && c < this._cols && r >= 0 && r < this._rows) {
      this._grid[r * this._cols + c] = v;
      this._wallDirty = true;
    }
  };

  JezzBall.prototype._getCellVal = function (c, r) {
    if (c < 0 || c >= this._cols || r < 0 || r >= this._rows) return 1;
    return this._grid[r * this._cols + c];
  };

  JezzBall.prototype._cellAt = function (px, py) {
    var c = Math.floor(px / CELL);
    var r = Math.floor(py / CELL);
    if (c < 0 || c >= this._cols || r < 0 || r >= this._rows) return 1;
    return this._grid[r * this._cols + c];
  };

  JezzBall.prototype._calcPct = function () {
    var grid = this._grid;
    var total = grid.length, filled = 0;
    for (var i = 0; i < total; i++) {
      if (grid[i] === 1) filled++;
    }
    this._pct = Math.round((filled / total) * 100);
  };

  // ════════════════════════════════════════════════════════════
  // BALL SPAWNING
  // ════════════════════════════════════════════════════════════

  JezzBall.prototype._spawnBalls = function (n) {
    var cols = this._cols, rows = this._rows, grid = this._grid;
    var W = this.W, H = this.H;
    var diffMul = this.difficultyMultiplier();

    for (var i = 0; i < n; i++) {
      var bx, by, bc, br, attempts = 0;
      do {
        bx = CELL * 3 + Math.random() * (W - CELL * 6);
        by = CELL * 3 + Math.random() * (H - CELL * 6);
        bc = Math.floor(bx / CELL);
        br = Math.floor(by / CELL);
        attempts++;
      } while (attempts < 30 && !this._isSpawnSafe(bc, br));

      if (!this._isSpawnSafe(bc, br)) {
        var open = this._findOpenCell();
        if (open) {
          bc = open.c;
          br = open.r;
          bx = bc * CELL + CELL / 2;
          by = br * CELL + CELL / 2;
        }
      }

      // Exponential speed curve: 0.65 * 1.07^(level-1), scaled by uber difficulty
      var speedMul = 0.65 * Math.pow(1.07, this.level - 1) * diffMul;
      var baseSpeed = 1.2 + Math.random();
      var speed = baseSpeed * speedMul;

      // JB-2: velocity normalization — random unit vector × speed
      var angle = Math.random() * Math.PI * 2;
      var vx = Math.cos(angle) * speed;
      var vy = Math.sin(angle) * speed;

      // Ensure minimum component magnitude to avoid near-axis-aligned balls
      if (Math.abs(vx) < 0.3) vx = (vx >= 0 ? 1 : -1) * 0.3;
      if (Math.abs(vy) < 0.3) vy = (vy >= 0 ? 1 : -1) * 0.3;

      // Re-normalize after adjustment
      var mag = Math.sqrt(vx * vx + vy * vy);
      vx = (vx / mag) * speed;
      vy = (vy / mag) * speed;

      this._balls.push({
        x: bx, y: by,
        vx: vx, vy: vy,
        speed: speed,   // JB-2: preserved base speed for normalization
        r: 4,
        // JB-3: trail history (ring buffer of past positions)
        trail: [],
        animOffset: i * 137    // stagger animation frames per ball
      });
    }
  };

  JezzBall.prototype._isSpawnSafe = function (c, r) {
    var cols = this._cols, rows = this._rows, grid = this._grid;
    for (var dr = -2; dr <= 2; dr++) {
      for (var dc = -2; dc <= 2; dc++) {
        var nc = c + dc, nr = r + dr;
        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) return false;
        if (grid[nr * cols + nc] !== 0) return false;
      }
    }
    return true;
  };

  JezzBall.prototype._findOpenCell = function () {
    var cols = this._cols, rows = this._rows, grid = this._grid;
    var midC = Math.floor(cols / 2);
    var midR = Math.floor(rows / 2);
    for (var d = 0; d < Math.max(cols, rows); d++) {
      for (var dr = -d; dr <= d; dr++) {
        for (var dc = -d; dc <= d; dc++) {
          if (Math.abs(dr) !== d && Math.abs(dc) !== d) continue;
          var nc = midC + dc, nr = midR + dr;
          if (nc >= 2 && nc < cols - 2 && nr >= 2 && nr < rows - 2) {
            if (grid[nr * cols + nc] === 0) return { c: nc, r: nr };
          }
        }
      }
    }
    return null;
  };

  // ════════════════════════════════════════════════════════════
  // BALL PHYSICS (JB-2 enhanced)
  // ════════════════════════════════════════════════════════════

  JezzBall.prototype._updateBalls = function () {
    var balls = this._balls;

    // Ball-ball elastic collision (JB-2)
    this._resolveBallBallCollisions();

    for (var i = 0; i < balls.length; i++) {
      var b = balls[i];

      // JB-3: record trail position before moving
      if (b.trail) {
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > TRAIL_LENGTH) b.trail.shift();
      }

      // JB-2: Sub-step collision for fast balls
      var speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      var steps = speed > SUB_STEP_THRESHOLD
        ? Math.min(Math.ceil(speed / SUB_STEP_THRESHOLD), MAX_SUB_STEPS)
        : 1;
      var svx = b.vx / steps;
      var svy = b.vy / steps;

      for (var s = 0; s < steps; s++) {
        this._moveBallAxis(b, svx, svy);
      }

      // Boundary clamp (safety)
      var W = this.W, H = this.H;
      if (b.x < CELL + b.r) { b.x = CELL + b.r; b.vx = Math.abs(b.vx); }
      if (b.x > W - CELL - b.r) { b.x = W - CELL - b.r; b.vx = -Math.abs(b.vx); }
      if (b.y < CELL + b.r) { b.y = CELL + b.r; b.vy = Math.abs(b.vy); }
      if (b.y > H - CELL - b.r) { b.y = H - CELL - b.r; b.vy = -Math.abs(b.vy); }

      // Emergency: if still embedded in wall, nudge to nearest open cell
      if (this._cellAt(b.x, b.y) === 1) {
        this._nudgeBallToOpen(b);
      }

      // JB-2: Velocity normalization — maintain consistent speed
      var curSpeed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (curSpeed > 0.001 && Math.abs(curSpeed - b.speed) > 0.01) {
        b.vx = (b.vx / curSpeed) * b.speed;
        b.vy = (b.vy / curSpeed) * b.speed;
      }
    }
  };

  /**
   * Move ball one sub-step with axis-independent collision.
   */
  JezzBall.prototype._moveBallAxis = function (b, svx, svy) {
    // Move X first
    b.x += svx;
    var hitRight = this._cellAt(b.x + b.r, b.y) === 1;
    var hitLeft  = this._cellAt(b.x - b.r, b.y) === 1;
    if (hitRight && b.vx > 0) {
      var wallC = Math.floor((b.x + b.r) / CELL);
      b.x = wallC * CELL - b.r - 0.01;
      b.vx = -b.vx;
    } else if (hitLeft && b.vx < 0) {
      var wallC2 = Math.floor((b.x - b.r) / CELL);
      b.x = (wallC2 + 1) * CELL + b.r + 0.01;
      b.vx = -b.vx;
    } else if (hitRight || hitLeft) {
      b.vx = -b.vx;
      b.x += b.vx > 0 ? 1 : -1;
    }

    // Move Y
    b.y += svy;
    var hitBottom = this._cellAt(b.x, b.y + b.r) === 1;
    var hitTop    = this._cellAt(b.x, b.y - b.r) === 1;
    if (hitBottom && b.vy > 0) {
      var wallR = Math.floor((b.y + b.r) / CELL);
      b.y = wallR * CELL - b.r - 0.01;
      b.vy = -b.vy;
    } else if (hitTop && b.vy < 0) {
      var wallR2 = Math.floor((b.y - b.r) / CELL);
      b.y = (wallR2 + 1) * CELL + b.r + 0.01;
      b.vy = -b.vy;
    } else if (hitBottom || hitTop) {
      b.vy = -b.vy;
      b.y += b.vy > 0 ? 1 : -1;
    }
  };

  /**
   * JB-2: Ball-ball elastic collision.
   * Circle-circle detection with elastic response.
   */
  JezzBall.prototype._resolveBallBallCollisions = function () {
    var balls = this._balls;
    for (var i = 0; i < balls.length; i++) {
      for (var j = i + 1; j < balls.length; j++) {
        var a = balls[i], b = balls[j];
        var dx = b.x - a.x;
        var dy = b.y - a.y;
        var distSq = dx * dx + dy * dy;
        var rSum = a.r + b.r;

        if (distSq < rSum * rSum && distSq > 0.0001) {
          var dist = Math.sqrt(distSq);
          // Normalize collision axis
          var nx = dx / dist;
          var ny = dy / dist;

          // Separate overlapping balls
          var overlap = rSum - dist;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;

          // Elastic response (equal mass): swap velocity components along collision axis
          var relVx = a.vx - b.vx;
          var relVy = a.vy - b.vy;
          var relDot = relVx * nx + relVy * ny;

          // Only resolve if balls are moving toward each other
          if (relDot > 0) {
            a.vx -= relDot * nx;
            a.vy -= relDot * ny;
            b.vx += relDot * nx;
            b.vy += relDot * ny;

            // JB-3: spawn knockback spark at collision midpoint
            this._spawnParticle(
              (a.x + b.x) * 0.5, (a.y + b.y) * 0.5,
              ANIM_KNOCKBACK, 24
            );
          }
        }
      }
    }
  };

  /**
   * Emergency nudge: move ball to nearest open cell.
   */
  JezzBall.prototype._nudgeBallToOpen = function (b) {
    var bc = Math.floor(b.x / CELL);
    var br = Math.floor(b.y / CELL);
    var cols = this._cols, rows = this._rows, grid = this._grid;
    for (var d = 1; d < 6; d++) {
      var found = false;
      for (var dy = -d; dy <= d && !found; dy++) {
        for (var dx = -d; dx <= d && !found; dx++) {
          if (Math.abs(dx) !== d && Math.abs(dy) !== d) continue;
          var nc = bc + dx, nr = br + dy;
          if (nc >= 1 && nc < cols - 1 && nr >= 1 && nr < rows - 1) {
            if (grid[nr * cols + nc] === 0) {
              b.x = nc * CELL + CELL / 2;
              b.y = nr * CELL + CELL / 2;
              found = true;
            }
          }
        }
      }
      if (found) break;
    }
  };

  // ════════════════════════════════════════════════════════════
  // BUILDER SYSTEM
  // ════════════════════════════════════════════════════════════

  JezzBall.prototype._builderTag = function (builder) {
    return builder.id + 2;  // 0=open, 1=wall, 2+=builder cells
  };

  /**
   * Check if a cell is adjacent to an existing wall for single-builder mode.
   */
  JezzBall.prototype._isAdjacentToWall = function (c, r, dir) {
    var grid = this._grid, cols = this._cols, rows = this._rows;
    var result = { singleBuilder: false, disableA: false, disableB: false };

    if (dir === 'h') {
      var leftC = c - 1, rightC = c + 1;
      var leftIsWall = (leftC < 0 || leftC >= cols) || grid[r * cols + leftC] === 1;
      var rightIsWall = (rightC < 0 || rightC >= cols) || grid[r * cols + rightC] === 1;
      if (leftIsWall && !rightIsWall) {
        result.singleBuilder = true;
        result.disableA = true;
      } else if (rightIsWall && !leftIsWall) {
        result.singleBuilder = true;
        result.disableB = true;
      }
    } else {
      var upR = r - 1, downR = r + 1;
      var upIsWall = (upR < 0 || upR >= rows) || grid[upR * cols + c] === 1;
      var downIsWall = (downR < 0 || downR >= rows) || grid[downR * cols + c] === 1;
      if (upIsWall && !downIsWall) {
        result.singleBuilder = true;
        result.disableA = true;
      } else if (downIsWall && !upIsWall) {
        result.singleBuilder = true;
        result.disableB = true;
      }
    }
    return result;
  };

  JezzBall.prototype._startBuild = function (mx, my) {
    if (this._won || this.lives <= 0 || this._levelTransition) return;
    if (this._builders.length >= MAX_BUILDERS) return;

    var c = Math.floor(mx / CELL);
    var r = Math.floor(my / CELL);
    if (c < 1 || c >= this._cols - 1 || r < 1 || r >= this._rows - 1) return;
    if (this._grid[r * this._cols + c] !== 0) return;

    var adj = this._isAdjacentToWall(c, r, this._direction);
    var id = this._nextBuilderID++;
    var builder = {
      id: id,
      dir: this._direction,
      originC: c,
      originR: r,
      headA: { c: c, r: r },
      headB: { c: c, r: r },
      doneA: adj.disableA,
      doneB: adj.disableB,
      single: adj.singleBuilder
    };

    this._setCell(c, r, this._builderTag(builder));
    this._builders.push(builder);
    this.playSFX('build');
  };

  JezzBall.prototype._nextHead = function (head, dir, sign) {
    return dir === 'h'
      ? { c: head.c + sign, r: head.r }
      : { c: head.c, r: head.r + sign };
  };

  JezzBall.prototype._isCellOwnedBy = function (c, r, tag) {
    if (c < 0 || c >= this._cols || r < 0 || r >= this._rows) return false;
    return this._grid[r * this._cols + c] === tag;
  };

  JezzBall.prototype._advanceBuilders = function () {
    if (this._builders.length === 0) return;

    for (var bi = this._builders.length - 1; bi >= 0; bi--) {
      if (bi >= this._builders.length) continue;
      var b = this._builders[bi];
      if (!b) continue;
      var tag = this._builderTag(b);
      var destroyed = false;

      // Advance head A
      if (!b.doneA) {
        var na = this._nextHead(b.headA, b.dir, -1);
        var naVal = this._getCellVal(na.c, na.r);
        if (naVal === 1) {
          b.doneA = true;
          this._sealHalf(b, 'A');
        } else if (naVal >= 2 && naVal !== tag) {
          destroyed = this._handleBuilderCollision(b, naVal - 2, bi);
          if (destroyed) continue;
        } else if (naVal === 0) {
          this._setCell(na.c, na.r, tag);
          b.headA = na;
        } else {
          b.doneA = true;
        }
      }

      // Advance head B
      if (!b.doneB && !destroyed) {
        var nb = this._nextHead(b.headB, b.dir, 1);
        var nbVal = this._getCellVal(nb.c, nb.r);
        if (nbVal === 1) {
          b.doneB = true;
          this._sealHalf(b, 'B');
        } else if (nbVal >= 2 && nbVal !== tag) {
          destroyed = this._handleBuilderCollision(b, nbVal - 2, bi);
          if (destroyed) continue;
        } else if (nbVal === 0) {
          this._setCell(nb.c, nb.r, tag);
          b.headB = nb;
        } else {
          b.doneB = true;
        }
      }

      // Check collisions with balls
      if (!destroyed) {
        var hitBall = false;
        for (var i = 0; i < this._balls.length; i++) {
          var ball = this._balls[i];
          var bc = Math.floor(ball.x / CELL);
          var br = Math.floor(ball.y / CELL);
          if (this._isCellOwnedBy(bc, br, tag) ||
              this._isCellOwnedBy(bc - 1, br, tag) ||
              this._isCellOwnedBy(bc + 1, br, tag) ||
              this._isCellOwnedBy(bc, br - 1, tag) ||
              this._isCellOwnedBy(bc, br + 1, tag)) {
            hitBall = true;
            break;
          }
        }
        if (hitBall) {
          // JB-3: explosion FX at ball position + smoke poof along builder
          var hitBallObj = this._balls[i] || this._balls[0];
          if (hitBallObj) {
            this._spawnParticle(hitBallObj.x, hitBallObj.y, ANIM_FIREBALL_EXPLODE, 32);
          }
          this._spawnBuilderSmoke(bi);
          this._destroyBuilder(bi);
          this.lives--;
          this.playSFX('hit-' + (1 + Math.floor(Math.random() * 4)));
          if (this.lives <= 0) {
            this.lives = 0;
            this.setState(ArcadeEngine.STATE.GAME_OVER);
          }
          continue;
        }
      }

      // Check if builder is complete
      if (!destroyed && b.doneA && b.doneB) {
        this._sealBuilder(bi);
      }
    }
  };

  // ── Handle collision between two builders ──
  JezzBall.prototype._handleBuilderCollision = function (currentBuilder, otherID, currentIdx) {
    var otherIdx = -1;
    for (var i = 0; i < this._builders.length; i++) {
      if (this._builders[i].id === otherID) { otherIdx = i; break; }
    }
    if (otherIdx === -1) return false;

    var other = this._builders[otherIdx];

    // Perpendicular meeting → seal both (trick mechanic!)
    if (currentBuilder.dir !== other.dir) {
      if (otherIdx > currentIdx) {
        this._sealBuilder(otherIdx);
        this._sealBuilder(currentIdx);
      } else {
        this._sealBuilder(currentIdx);
        this._sealBuilder(otherIdx);
      }
      this._playSealSFX(0.4);
      return true;
    }

    // Same direction (head-on) — preserve partial walls where anchored
    this._partialSealOrDestroy(currentBuilder, currentIdx);
    otherIdx = -1;
    for (var j = 0; j < this._builders.length; j++) {
      if (this._builders[j].id === otherID) { otherIdx = j; break; }
    }
    if (otherIdx !== -1) this._partialSealOrDestroy(other, otherIdx);

    this.lives--;
    this.playSFX('hit-' + (1 + Math.floor(Math.random() * 4)));
    if (this.lives <= 0) {
      this.lives = 0;
      this.setState(ArcadeEngine.STATE.GAME_OVER);
    }
    return true;
  };

  // ── Destroy a builder (erase from grid) ──
  JezzBall.prototype._destroyBuilder = function (idx) {
    var b = this._builders[idx];
    var tag = this._builderTag(b);
    var grid = this._grid;
    for (var j = 0; j < grid.length; j++) {
      if (grid[j] === tag) grid[j] = 0;
    }
    this._builders.splice(idx, 1);
    this._wallDirty = true;
  };

  // ── Seal a builder into permanent walls ──
  JezzBall.prototype._sealBuilder = function (idx) {
    var b = this._builders[idx];
    var tag = this._builderTag(b);
    var grid = this._grid;
    var wallCells = 0;
    for (var j = 0; j < grid.length; j++) {
      if (grid[j] === tag) { grid[j] = 1; wallCells++; }
    }
    this._builders.splice(idx, 1);
    this._wallDirty = true;

    this._floodFillOpen();
    this._calcPct();

    this.addScore(wallCells * 5);
    this._playSealSFX(0.3);

    // JB-3: light flash FX along the sealed wall + containment fill
    this._spawnSealFlash(b);
    this._triggerContainmentFill();

    if (this._pct >= LEVEL_CLEAR_PCT && !this._won) {
      this._won = true;
      this.addScore(1000);
      this.playSFX('level-up');
      this._levelTransition = { timer: 1500 };
    }
  };

  // ── Seal one half of a builder when that head reaches a wall ──
  JezzBall.prototype._sealHalf = function (builder, side) {
    var tag = this._builderTag(builder);
    var grid = this._grid;
    var cols = this._cols;
    var sealed = 0;

    for (var j = 0; j < grid.length; j++) {
      if (grid[j] !== tag) continue;
      var c = j % cols;
      var r = Math.floor(j / cols);

      var onSide = false;
      if (side === 'A') {
        onSide = builder.dir === 'h' ? (c <= builder.originC) : (r <= builder.originR);
      } else {
        onSide = builder.dir === 'h' ? (c >= builder.originC) : (r >= builder.originR);
      }

      if (onSide) {
        grid[j] = 1;
        sealed++;
      }
    }

    if (sealed > 0) {
      this._wallDirty = true;
      this._floodFillOpen();
      this._calcPct();
      this.addScore(sealed * 4);
      this._playSealSFX(0.2);
      this._triggerContainmentFill();

      if (this._pct >= LEVEL_CLEAR_PCT && !this._won) {
        this._won = true;
        this.addScore(1000);
        this.playSFX('level-up');
        this._levelTransition = { timer: 1500 };
      }
    }
  };

  // ── Partial seal: keep anchored portions, destroy unanchored ──
  JezzBall.prototype._partialSealOrDestroy = function (builder, idx) {
    var tag = this._builderTag(builder);
    var grid = this._grid;
    var cols = this._cols;

    if (!builder.doneA && !builder.doneB) {
      this._destroyBuilder(idx);
      return;
    }

    if (builder.doneA && builder.doneB) {
      this._sealBuilder(idx);
      return;
    }

    // One end anchored — BFS connectivity check
    var connected = {};
    var allCells = [];
    for (var j = 0; j < grid.length; j++) {
      if (grid[j] === tag) allCells.push(j);
    }

    var queue = [];
    for (var k = 0; k < allCells.length; k++) {
      var ci = allCells[k] % cols;
      var ri = Math.floor(allCells[k] / cols);
      if ((ci > 0 && grid[ri * cols + ci - 1] === 1) ||
          (ci < cols - 1 && grid[ri * cols + ci + 1] === 1) ||
          (ri > 0 && grid[(ri - 1) * cols + ci] === 1) ||
          (ri < this._rows - 1 && grid[(ri + 1) * cols + ci] === 1)) {
        connected[allCells[k]] = true;
        queue.push(allCells[k]);
      }
    }

    while (queue.length > 0) {
      var cur = queue.shift();
      var cc = cur % cols;
      var cr = Math.floor(cur / cols);
      var neighbors = [
        cr * cols + cc - 1,
        cr * cols + cc + 1,
        (cr - 1) * cols + cc,
        (cr + 1) * cols + cc
      ];
      for (var n = 0; n < neighbors.length; n++) {
        var ni = neighbors[n];
        if (ni >= 0 && ni < grid.length && grid[ni] === tag && !connected[ni]) {
          connected[ni] = true;
          queue.push(ni);
        }
      }
    }

    var sealed = 0;
    for (var m = 0; m < allCells.length; m++) {
      if (connected[allCells[m]]) {
        grid[allCells[m]] = 1;
        sealed++;
      } else {
        grid[allCells[m]] = 0;
      }
    }
    this._wallDirty = true;
    this._builders.splice(idx, 1);

    if (sealed > 0) {
      this._floodFillOpen();
      this._calcPct();
      this.addScore(sealed * 3);
      this._playSealSFX(0.2);
      this._triggerContainmentFill();

      if (this._pct >= LEVEL_CLEAR_PCT && !this._won) {
        this._won = true;
        this.addScore(1000);
        this.playSFX('level-up');
        this._levelTransition = { timer: 1500 };
      }
    }
  };

  // ════════════════════════════════════════════════════════════
  // FLOOD FILL — containment detection
  // ════════════════════════════════════════════════════════════

  JezzBall.prototype._floodFillOpen = function () {
    var cols = this._cols, rows = this._rows, grid = this._grid;
    var visited = new Uint8Array(cols * rows);

    for (var i = 0; i < this._balls.length; i++) {
      var bc = Math.floor(this._balls[i].x / CELL);
      var br = Math.floor(this._balls[i].y / CELL);
      if (bc < 0 || bc >= cols || br < 0 || br >= rows) continue;
      this._flood(visited, bc, br);
    }

    for (var j = 0; j < grid.length; j++) {
      if (grid[j] === 0 && !visited[j]) {
        grid[j] = 1;
        this._wallDirty = true;
      }
    }
  };

  JezzBall.prototype._flood = function (visited, c, r) {
    var cols = this._cols, rows = this._rows, grid = this._grid;
    var stack = [[c, r]];
    while (stack.length) {
      var cur = stack.pop();
      var cc = cur[0], cr = cur[1];
      if (cc < 0 || cc >= cols || cr < 0 || cr >= rows) continue;
      var idx = cr * cols + cc;
      if (visited[idx] || grid[idx] === 1) continue;
      visited[idx] = 1;
      stack.push([cc - 1, cr], [cc + 1, cr], [cc, cr - 1], [cc, cr + 1]);
    }
  };

  // ════════════════════════════════════════════════════════════
  // LEVEL PROGRESSION
  // ════════════════════════════════════════════════════════════

  JezzBall.prototype._nextLevel = function () {
    var cols = this._cols, rows = this._rows, grid = this._grid;

    // Reset grid to borders only
    for (var i = 0; i < cols * rows; i++) grid[i] = 0;
    for (var c = 0; c < cols; c++) { grid[c] = 1; grid[(rows - 1) * cols + c] = 1; }
    for (var r = 0; r < rows; r++) { grid[r * cols] = 1; grid[r * cols + cols - 1] = 1; }

    this._builders = [];
    this._buildAccum = 0;
    this._won = false;
    this._levelTransition = null;
    this._dirIndicator = null;
    this._particles = [];
    this._fillAnims = [];

    this._balls = [];
    this._spawnBalls(this.level + 1);
    this._calcPct();
    this._wallDirty = true;
  };

  // ════════════════════════════════════════════════════════════
  // AUDIO
  // ════════════════════════════════════════════════════════════

  JezzBall.prototype._playSealSFX = function (vol) {
    var now = Date.now();
    if (now - this._lastSealSFXTime < SEAL_SFX_COOLDOWN) return;
    this._lastSealSFXTime = now;
    var sound = SEAL_SOUNDS[Math.floor(Math.random() * SEAL_SOUNDS.length)];
    this.playSFX(sound, { volume: vol });
  };

  // ════════════════════════════════════════════════════════════
  // JB-3: PARTICLE & FX METHODS
  // ════════════════════════════════════════════════════════════

  /**
   * Spawn a one-shot sprite particle at world position.
   */
  JezzBall.prototype._spawnParticle = function (x, y, anim, size, alpha) {
    this._particles.push({
      x: x, y: y,
      anim: anim,
      born: performance.now(),
      size: size || 24,
      alpha: alpha || 1.0
    });
  };

  /**
   * Spawn smoke poof FX along a destroyed builder's cells.
   * Spreads multiple small poofs at intervals along the builder path.
   */
  JezzBall.prototype._spawnBuilderSmoke = function (builderIdx) {
    if (builderIdx >= this._builders.length) return;
    var b = this._builders[builderIdx];
    var tag = this._builderTag(b);
    var grid = this._grid;
    var cols = this._cols;
    var count = 0;
    for (var j = 0; j < grid.length; j++) {
      if (grid[j] === tag) {
        count++;
        // Spawn poof every ~4 cells to avoid overdoing it
        if (count % 4 === 0) {
          var c = j % cols;
          var r = Math.floor(j / cols);
          this._spawnParticle(
            c * CELL + CELL * 0.5, r * CELL + CELL * 0.5,
            ANIM_SMOKE_POOF, 20, 0.7
          );
        }
      }
    }
  };

  /**
   * Spawn light flash FX along a sealed builder's wall line.
   */
  JezzBall.prototype._spawnSealFlash = function (builder) {
    if (!builder) return;
    var cols = this._cols;
    // Flash at origin and at intervals along the builder direction
    this._spawnParticle(
      builder.originC * CELL + CELL * 0.5,
      builder.originR * CELL + CELL * 0.5,
      ANIM_LIGHT_FLASH, 28, 0.9
    );
    // Flash at head A and head B positions
    if (builder.headA) {
      this._spawnParticle(
        builder.headA.c * CELL + CELL * 0.5,
        builder.headA.r * CELL + CELL * 0.5,
        ANIM_LIGHT_FLASH, 24, 0.7
      );
    }
    if (builder.headB) {
      this._spawnParticle(
        builder.headB.c * CELL + CELL * 0.5,
        builder.headB.r * CELL + CELL * 0.5,
        ANIM_LIGHT_FLASH, 24, 0.7
      );
    }
  };

  /**
   * Trigger a containment fill animation.
   * Snapshots the current wall grid to detect newly-trapped areas
   * and renders a phosphor wash fade-in over them.
   */
  JezzBall.prototype._triggerContainmentFill = function () {
    // Find cells that are wall (1) but were NOT wall before this seal.
    // We approximate by capturing all interior wall cells (non-border).
    var grid = this._grid;
    var cols = this._cols, rows = this._rows;
    var newWalls = [];
    for (var r = 1; r < rows - 1; r++) {
      for (var c = 1; c < cols - 1; c++) {
        var idx = r * cols + c;
        if (grid[idx] === 1) {
          // Check if it's an interior fill cell (all 4 neighbors are also wall)
          if (grid[idx - 1] === 1 && grid[idx + 1] === 1 &&
              grid[idx - cols] === 1 && grid[idx + cols] === 1) {
            newWalls.push(idx);
          }
        }
      }
    }
    if (newWalls.length > 0) {
      this._fillAnims.push({
        cells: newWalls,
        born: performance.now()
      });
    }
  };

  /**
   * Draw containment fill animations (phosphor wash over trapped areas).
   */
  JezzBall.prototype._drawContainmentFill = function (ctx, cols, rows, grid, phR, phG, phB) {
    if (this._fillAnims.length === 0) return;
    var now = performance.now();

    for (var fi = 0; fi < this._fillAnims.length; fi++) {
      var fa = this._fillAnims[fi];
      var elapsed = now - fa.born;
      var progress = Math.min(1, elapsed / FILL_ANIM_DURATION);
      var alpha = 0.15 * progress;

      ctx.save();
      ctx.fillStyle = 'rgba(' + phR + ',' + phG + ',' + phB + ',' + alpha + ')';
      for (var ci = 0; ci < fa.cells.length; ci++) {
        var idx = fa.cells[ci];
        var c = idx % cols;
        var r = Math.floor(idx / cols);
        ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
      }
      ctx.restore();
    }
  };

  /**
   * Draw all active sprite particles.
   */
  JezzBall.prototype._drawParticles = function (ctx, now) {
    for (var pi = 0; pi < this._particles.length; pi++) {
      var p = this._particles[pi];
      var elapsed = now - p.born;
      var frame = p.anim.getFrame(elapsed);
      if (!frame) continue;

      // Fade out in last 30% of animation
      var totalDuration = p.anim.frameDuration * p.anim.frames.length;
      var fadeAlpha = p.alpha;
      if (elapsed > totalDuration * 0.7) {
        fadeAlpha *= 1 - ((elapsed - totalDuration * 0.7) / (totalDuration * 0.3));
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, fadeAlpha);
      ctx.drawImage(frame,
        p.x - p.size * 0.5, p.y - p.size * 0.5,
        p.size, p.size);
      ctx.restore();
    }
  };

  /**
   * JB-3: Ball destruction warning tint.
   * Returns { r, g, b } when fill % is high enough that balls are nearly trapped.
   * Returns null when pct is below warning threshold.
   */
  JezzBall.prototype._getWarningTint = function () {
    // Warning starts at 60% fill, full red at 73% (just before 75% clear)
    if (this._pct < 60) return null;
    var t = Math.min(1, (this._pct - 60) / 13);  // 0..1 over 60%..73%

    // Interpolate phosphor green → amber → red
    var pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.008); // slow pulse
    t = t * (0.7 + 0.3 * pulse); // add pulsing intensity

    // Phosphor: (28,255,155) → Amber: (255,179,71) → Red: (255,71,87)
    var r, g, b;
    if (t < 0.5) {
      var t2 = t * 2;
      r = Math.round(28 + (255 - 28) * t2);
      g = Math.round(255 + (179 - 255) * t2);
      b = Math.round(155 + (71 - 155) * t2);
    } else {
      var t2 = (t - 0.5) * 2;
      r = Math.round(255 + (255 - 255) * t2);
      g = Math.round(179 + (71 - 179) * t2);
      b = Math.round(71 + (87 - 71) * t2);
    }

    return { r: r, g: g, b: b };
  };

  // ════════════════════════════════════════════════════════════
  // RENDERING HELPERS
  // ════════════════════════════════════════════════════════════

  JezzBall.prototype._resolveJezzColors = function () {
    try {
      var style = getComputedStyle(document.documentElement);
      this._ph = style.getPropertyValue('--phosphor').trim() || '#1cff9b';
      this._dim = style.getPropertyValue('--phosphor-dim').trim() || '#1a6b4a';
      this._phR = parseInt(this._ph.substr(1, 2), 16) || 28;
      this._phG = parseInt(this._ph.substr(3, 2), 16) || 255;
      this._phB = parseInt(this._ph.substr(5, 2), 16) || 155;
    } catch (_) {}
  };

  JezzBall.prototype._initWallCanvas = function () {
    this._wallCanvas = document.createElement('canvas');
    this._wallCanvas.width = this.W;
    this._wallCanvas.height = this.H;
    this._wallCtx = this._wallCanvas.getContext('2d');
    this._wallDirty = true;
  };

  JezzBall.prototype._redrawWallCanvas = function () {
    var wc = this._wallCtx;
    if (!wc) return;
    var cols = this._cols, rows = this._rows, grid = this._grid;
    var ph = this._ph, dim = this._dim;
    var phR = this._phR, phG = this._phG, phB = this._phB;
    var W = this.W, H = this.H;

    wc.clearRect(0, 0, W, H);

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var v = grid[r * cols + c];
        if (v !== 1) continue;

        var bx = c * CELL, by = r * CELL;
        var isBorder = (c === 0 || c === cols - 1 || r === 0 || r === rows - 1);
        var isPerimeter = isBorder;
        if (!isBorder) {
          if (grid[r * cols + c - 1] !== 1 ||
              grid[r * cols + c + 1] !== 1 ||
              grid[(r - 1) * cols + c] !== 1 ||
              grid[(r + 1) * cols + c] !== 1) {
            isPerimeter = true;
          }
        }

        if (isPerimeter) {
          wc.fillStyle = dim;
          wc.fillRect(bx, by, CELL, CELL);
          wc.fillStyle = 'rgba(255,255,255,0.14)';
          wc.fillRect(bx, by, CELL, 1);
          wc.fillRect(bx, by + 1, 1, CELL - 1);
          wc.fillStyle = 'rgba(0,0,0,0.35)';
          wc.fillRect(bx, by + CELL - 1, CELL, 1);
          wc.fillRect(bx + CELL - 1, by, 1, CELL - 1);
        } else {
          wc.fillStyle = 'rgba(4,10,8,0.45)';
          wc.fillRect(bx, by, CELL, CELL);
          wc.strokeStyle = 'rgba(' + phR + ',' + phG + ',' + phB + ',0.07)';
          wc.lineWidth = 0.5;
          wc.strokeRect(bx + 0.5, by + 0.5, CELL - 1, CELL - 1);
        }
      }
    }
    this._wallDirty = false;
  };

  /**
   * Pre-render honeycomb lattice of overlapping spheres.
   */
  JezzBall.prototype._buildLattice = function () {
    var W = this.W, H = this.H;
    this._latticeCanvas = document.createElement('canvas');
    this._latticeCanvas.width = W;
    this._latticeCanvas.height = H;
    var lc = this._latticeCanvas.getContext('2d');

    var spacing = CELL * 3;
    var radius = spacing * 0.72;
    var rowH = spacing * 0.866;

    for (var row = -1; row * rowH < H + radius; row++) {
      var xOff = (row % 2 !== 0) ? spacing * 0.5 : 0;
      for (var sx = -radius + xOff; sx < W + radius; sx += spacing) {
        var cx = sx;
        var cy = row * rowH;

        var grad = lc.createRadialGradient(
          cx - radius * 0.25, cy - radius * 0.25, radius * 0.05,
          cx, cy, radius
        );
        grad.addColorStop(0,    'rgba(28,255,155,0.055)');
        grad.addColorStop(0.25, 'rgba(22,200,120,0.035)');
        grad.addColorStop(0.55, 'rgba(14,120,75,0.015)');
        grad.addColorStop(0.85, 'rgba(6,50,30,0.006)');
        grad.addColorStop(1,    'rgba(0,0,0,0)');

        lc.fillStyle = grad;
        lc.beginPath();
        lc.arc(cx, cy, radius, 0, Math.PI * 2);
        lc.fill();

        lc.strokeStyle = 'rgba(28,255,155,0.025)';
        lc.lineWidth = 0.6;
        lc.beginPath();
        lc.arc(cx, cy, radius * 0.92, -0.8, 1.2);
        lc.stroke();
      }
    }
  };

  /**
   * Draw builder cells with two-color A/B side rendering.
   */
  JezzBall.prototype._drawBuilders = function (ctx, cols, rows, grid, ph) {
    var builderMap = {};
    for (var bi = 0; bi < this._builders.length; bi++) {
      builderMap[this._builders[bi].id] = this._builders[bi];
    }

    var sideColors = [
      [ph, '#ff9b1c'],
      ['#ff1c9b', '#1c9bff'],
      ['#ffff1c', '#9b1cff'],
      ['#1cffff', '#ff1c1c']
    ];

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var v = grid[r * cols + c];
        if (v < 2) continue;

        var builderId = v - 2;
        var bld = builderMap[builderId];
        var pair = sideColors[builderId % sideColors.length];
        var cellColor = pair[0];

        if (bld) {
          var isOrigin = (c === bld.originC && r === bld.originR);
          var isBSide = bld.dir === 'h' ? (c > bld.originC) : (r > bld.originR);
          if (isOrigin) {
            cellColor = '#ffffff';
          } else if (isBSide) {
            cellColor = pair[1];
          }
        }

        var phaseOffset = builderId * 1.5;
        var pulse = 0.5 + 0.3 * Math.sin(Date.now() * 0.01 + phaseOffset);
        ctx.fillStyle = cellColor;
        ctx.globalAlpha = pulse;
        ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
        ctx.globalAlpha = 1;
      }
    }
  };

  /**
   * Draw direction indicator (H/V arrows at touch point).
   */
  JezzBall.prototype._drawDirIndicator = function (ctx, ph) {
    var di = this._dirIndicator;
    var alpha = Math.min(1, di.timer / 300);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = ph;
    ctx.lineWidth = 2;
    ctx.beginPath();
    var len = 14;
    if (di.dir === 'h') {
      ctx.moveTo(di.x - len, di.y);
      ctx.lineTo(di.x + len, di.y);
      ctx.moveTo(di.x - len, di.y);
      ctx.lineTo(di.x - len + 4, di.y - 3);
      ctx.moveTo(di.x - len, di.y);
      ctx.lineTo(di.x - len + 4, di.y + 3);
      ctx.moveTo(di.x + len, di.y);
      ctx.lineTo(di.x + len - 4, di.y - 3);
      ctx.moveTo(di.x + len, di.y);
      ctx.lineTo(di.x + len - 4, di.y + 3);
    } else {
      ctx.moveTo(di.x, di.y - len);
      ctx.lineTo(di.x, di.y + len);
      ctx.moveTo(di.x, di.y - len);
      ctx.lineTo(di.x - 3, di.y - len + 4);
      ctx.moveTo(di.x, di.y - len);
      ctx.lineTo(di.x + 3, di.y - len + 4);
      ctx.moveTo(di.x, di.y + len);
      ctx.lineTo(di.x - 3, di.y + len - 4);
      ctx.moveTo(di.x, di.y + len);
      ctx.lineTo(di.x + 3, di.y + len - 4);
    }
    ctx.stroke();
    ctx.restore();
  };

  // ════════════════════════════════════════════════════════════
  // STATE CHANGE HOOK — custom HUD info for game-over
  // ════════════════════════════════════════════════════════════

  JezzBall.prototype.onStateChange = function (newState, oldState) {
    // Additional metadata for leaderboard submission
    if (newState === 'GAME_OVER' && typeof HighscoreState !== 'undefined') {
      try {
        HighscoreState.submitHighscore({
          game_id: 'arcade_games',
          arcade_game_id: 'jezzball',
          mode: 'human',
          display_name: 'Player',
          score: this.score,
          metadata: { level: this.level, pct: this._pct }
        });
      } catch (_) {}
    }
  };

  // ════════════════════════════════════════════════════════════
  // EXPORT — MinigameModal compatible
  // ════════════════════════════════════════════════════════════

  var instance = new JezzBall();
  return instance.asMinigame();
})();
