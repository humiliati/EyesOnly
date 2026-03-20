/* ============================================================
   FROGGER — Depot Crossing
   ArcadeEngine-powered rewrite with emoji entities, touch swipe,
   audio, currency, and BossAdapter for Depot Warden encounter.

   Entities: 🐸 player, 🚂 freight, 🚃 passenger, 🚗 car,
             🟫 log platform, 🏁 extraction goal, 💰 coin
   ============================================================ */
window.FroggerGame = (function () {
  'use strict';

  // ── Grid config ──
  var ROWS = 13;
  var GOAL_SLOTS = 5;
  var HOP_SCORE = 10;
  var GOAL_SCORE = 100;
  var CLEAR_SCORE = 500;

  // ── Lane templates ──
  // Row 0 = goal, row 6 = safe median, row 12 = safe start
  // Rows 1-5 = water/log, rows 7-11 = road/train
  var LANE_MAP = [
    'goal',                           // 0
    'water', 'water', 'water',        // 1-3
    'water', 'water',                 // 4-5
    'safe',                           // 6  (median)
    'road', 'road', 'train',          // 7-9
    'road', 'train',                  // 10-11
    'safe'                            // 12 (start)
  ];

  // Emoji for each lane element
  var EMOJI = {
    player:    '🐸',
    freight:   '🚂',
    passenger: '🚃',
    car:       '🚗',
    log:       '🟫',    // brown square — 🪵 is tofu on older Windows
    goal:      '🏁',
    goalFill:  '✅',
    water:     '🌊',
    splash:    '💦',
    skull:     '💀',
    coin:      '💰'     // money bag — 🪙 is tofu on older Windows
  };

  // ── Frogger game class ──

  function Frogger() {
    ArcadeEngine.call(this, {
      gameId: 'frogger',
      title: 'DEPOT CROSSING',
      lives: 3,
      currencyRate: 0.02
    });

    // ── SFX mapping: generic engine keys → real audio manifest keys ──
    // Keys must match entries in audio-manifest.json (which maps to .webm files on disk).
    // DO NOT use sq-sq-* keys — those files are R2/CDN-only and don't exist locally.
    this.sfxMap = {
      'hop':          'drop-1',         // short blip for frog jump
      // death/splat are randomized per-call in _die()
      'death':        'kitty-1',
      'splat':        'kitty-1',
      'game-over':    'game-over-1',
      'goal-fanfare': 'toad',           // slot filled
      'level-clear':  'toad',           // all slots clear
      'level-up':     'toad',
      'game-start':   'power-up-1'
    };

    // Game-specific state
    this._frog = null;
    this._lanes = [];
    this._winSlots = [];
    this._tile = 0;
    this._cols = 0;
    this._alive = true;
    this._deathTimer = 0;
    this._deathPos = null;
    this._highestRow = 0;           // track farthest forward for scoring
    this._hopCooldown = 0;          // prevent spammed movement

    // Canvas lerp: smooth rendering between grid cells
    // (ported from gone-rogue movement system)
    this._visualX = 0;              // smooth float for rendering
    this._visualY = 0;
    this._lerpSpeed = 0.22;         // lerp factor per frame (0-1, higher = snappier)

    // Squish animation (tap on frog dead zone)
    this._squishTimer = 0;          // ms remaining
    this._squishScaleX = 1.0;       // horizontal scale for rendering
    this._squishScaleY = 1.0;       // vertical scale for rendering

    // Coyote timer: grace period when landing in water without a log
    this._coyoteTimer = 0;          // ms remaining (0 = no grace)
    this._coyoteActive = false;     // true while splash grace is active
    this._lastLogRow = -1;          // row of last log the frog was on

    // Collectible currency scattered on map peripherals
    this._coins = [];               // [{col, row, value, collected}]

    // Boss adapter state
    this._bossHP = 0;
    this._bossMaxHP = 0;
    this._bossHazards = [];
    this._trainImpactKill = false;  // mythic flag
  }

  Frogger.prototype = Object.create(ArcadeEngine.prototype);
  Frogger.prototype.constructor = Frogger;

  // ════════════════════════════════════════════
  // LIFECYCLE HOOKS
  // ════════════════════════════════════════════

  Frogger.prototype.onInit = function () {
    this._buildGrid();
  };

  Frogger.prototype.onStart = function () {
    this._winSlots = [];
    for (var i = 0; i < GOAL_SLOTS; i++) this._winSlots.push(false);
    this._alive = true;
    this._deathTimer = 0;
    this._deathPos = null;
    this._highestRow = ROWS - 1;
    this._trainImpactKill = false;
    this._coyoteTimer = 0;
    this._coyoteActive = false;
    this._lastLogRow = -1;
    this._buildGrid();
    this._spawnCoins();
    this._resetFrog();
  };

  Frogger.prototype.onResize = function () {
    this._buildGrid();
    if (this._frog) {
      this._frog.row = Math.min(this._frog.row, ROWS - 1);
      this._frog.col = Math.min(this._frog.col, this._cols - 1);
    }
  };

  // ════════════════════════════════════════════
  // GRID SETUP
  // ════════════════════════════════════════════

  /**
   * Build the playfield grid with progressive difficulty scaling.
   *
   * Difficulty curve (level → feel):
   *   1-2   Gentle intro: wide logs, almost no road traffic, trains dormant
   *   3-4   Light traffic appears, logs still generous
   *   5-6   Moderate traffic, trains start moving, logs begin thinning
   *   7-9   Dense traffic, thinner logs with wider gaps, speed picks up
   *   10+   Full density, speed continues ramping each level
   */
  Frogger.prototype._buildGrid = function () {
    var hudOffset = (typeof ArcadeHUD !== 'undefined') ? ArcadeHUD.HEIGHT : 28;
    var playH = this.logicalH - hudOffset;
    this._tile = Math.floor(playH / ROWS);
    this._cols = Math.ceil(this.logicalW / this._tile);
    this._hudOffset = hudOffset;

    var lvl = this.level || 1;

    // ── Difficulty knobs (all clamped 0-1 via Math.min) ──

    // Road traffic density: 0 at lvl 1 → full at lvl 10
    //   Controls gap size between vehicles (inverted: higher = tighter gaps)
    var trafficDensity = Math.min(1, (lvl - 1) / 9);

    // Train activation: trains are inert below lvl 5, ramp to full by lvl 8
    var trainActivity = Math.min(1, Math.max(0, (lvl - 4) / 4));

    // Log width: wide at lvl 1, shrinks to minimum by lvl 10
    //   logWidth lerps from 4 tiles down to 2
    var logWidthMax = Math.max(2, Math.round(4 - 2 * Math.min(1, (lvl - 1) / 9)));
    var logWidthMin = Math.max(1, logWidthMax - 1);

    // Log gap: tight at lvl 1, widens by lvl 7+
    var logGapExtra = Math.min(3, Math.floor((lvl - 1) / 3));

    // Global speed multiplier: gentle ramp starting at 0.5×, reaching 1× at lvl 10, then continuing
    var speedMul = 0.5 + 0.5 * Math.min(1, (lvl - 1) / 9) + Math.max(0, (lvl - 10) * 0.06);

    this._lanes = [];
    for (var r = 0; r < ROWS; r++) {
      var type = LANE_MAP[r] || 'safe';
      if (type === 'goal' || type === 'safe') {
        this._lanes.push({ type: type, objs: [] });
        continue;
      }

      var isWater = (type === 'water');
      var isTrain = (type === 'train');
      var isRoad  = (type === 'road');

      // ── Speed ──
      var speedBase;
      if (isWater) {
        speedBase = 0.3 + Math.random() * 0.6;
      } else if (isTrain) {
        speedBase = 0.8 + Math.random() * 1.0;
      } else {
        speedBase = 0.4 + Math.random() * 0.8;
      }
      var dir = (r % 2 === 0) ? 1 : -1;
      var spd = speedBase * dir * speedMul;

      // ── Train lanes: dormant (no objects) until trainActivity > 0 ──
      if (isTrain && trainActivity <= 0) {
        // Empty train lane — safe to cross at low levels
        this._lanes.push({ type: type, speed: 0, objs: [] });
        continue;
      }

      // ── Object width ──
      var objW;
      if (isWater) {
        objW = logWidthMin + Math.floor(Math.random() * (logWidthMax - logWidthMin + 1));
      } else if (isTrain) {
        objW = 2 + Math.floor(Math.random() * 2);
      } else {
        // Cars: 1-wide early, 1-2 later
        objW = (lvl < 5) ? 1 : (1 + Math.floor(Math.random() * 2));
      }

      // ── Gap between objects ──
      var gap;
      if (isWater) {
        // Logs: small gap early (easy to hop), wider gap later
        gap = objW + 1 + logGapExtra + Math.floor(Math.random() * 2);
      } else if (isTrain) {
        // Trains: lerp gap with trainActivity (wider gap = fewer trains when ramping in)
        var trainGapBase = objW + 2 + Math.floor(Math.random() * 2);
        var trainGapExtra = Math.round((1 - trainActivity) * 4); // extra space when trains are new
        gap = trainGapBase + trainGapExtra;
      } else {
        // Road: wide gap at lvl 1, shrinks to tight at lvl 10
        var roadGapBase = objW + 1 + Math.floor(Math.random() * 2);
        var roadGapExtra = Math.round((1 - trafficDensity) * 5); // up to 5 extra tiles at lvl 1
        gap = roadGapBase + roadGapExtra;
      }

      // Populate lane
      var totalCols = this._cols + 6;
      var objs = [];
      for (var x = -3; x < totalCols; x += gap) {
        var emojiType;
        if (isWater) {
          emojiType = 'log';
        } else if (isTrain) {
          emojiType = (Math.random() < 0.4) ? 'freight' : 'passenger';
        } else {
          emojiType = 'car';
        }
        objs.push({
          x: x,
          w: objW,
          emoji: emojiType,
          pauseTimer: 0
        });
      }

      this._lanes.push({
        type: type,
        speed: spd,
        objs: objs
      });
    }
  };

  Frogger.prototype._resetFrog = function () {
    this._frog = {
      col: Math.floor(this._cols / 2),
      row: ROWS - 1
    };
    this._alive = true;
    this._hopCooldown = 0;
    this._coyoteTimer = 0;
    this._coyoteActive = false;
    this._lastLogRow = -1;
    // Snap visual position to grid (no lerp on reset)
    this._visualX = this._frog.col;
    this._visualY = this._frog.row;
  };

  // ════════════════════════════════════════════
  // COLLECTIBLE COINS
  // ════════════════════════════════════════════

  var COIN_SCORE = 25;

  /**
   * Scatter currency collectibles along the left/right peripherals of the map.
   * Clusters of 1 or 3 coins, seeded by level so the pattern is consistent
   * per level but varies between levels.
   */
  Frogger.prototype._spawnCoins = function () {
    this._coins = [];
    var cols = this._cols;
    if (!cols || cols < 4) return;

    // Deterministic seed from level for repeatable layouts
    var seed = (this.level || 1) * 7919;
    function rng() {
      seed = (seed * 16807 + 0) % 2147483647;
      return (seed & 0x7fffffff) / 2147483647;
    }

    // Peripheral columns: leftmost 2 and rightmost 2
    var leftCols  = [0, 1];
    var rightCols = [cols - 2, cols - 1];
    var edgeCols  = leftCols.concat(rightCols);

    // Eligible rows: road lanes (7-11), water lanes (1-5), safe median (6)
    // Skip goal row (0) and start row (12)
    var eligibleRows = [];
    for (var r = 1; r <= 11; r++) eligibleRows.push(r);

    // Number of clusters scales slightly with level (3-6 clusters)
    var clusterCount = Math.min(6, 3 + Math.floor((this.level || 1) / 3));

    // Track occupied cells to avoid duplicates
    var occupied = {};
    function place(self, c, r) {
      var key = c + ',' + r;
      if (occupied[key]) return;
      occupied[key] = true;
      self._coins.push({ col: c, row: r, value: 1, collected: false });
    }

    for (var c = 0; c < clusterCount; c++) {
      var row = eligibleRows[Math.floor(rng() * eligibleRows.length)];
      var col = edgeCols[Math.floor(rng() * edgeCols.length)];
      var size = rng() < 0.5 ? 1 : 3; // cluster of 1 or 3

      place(this, col, row);
      if (size === 3) {
        // Adjacent horizontally (toward center)
        var inward = (col <= 1) ? col + 1 : col - 1;
        inward = Math.max(0, Math.min(cols - 1, inward));
        place(this, inward, row);
        // Adjacent vertically
        var vRow = Math.max(1, Math.min(11, row + (rng() < 0.5 ? -1 : 1)));
        place(this, col, vRow);
      }
    }
  };

  // ════════════════════════════════════════════
  // INPUT
  // ════════════════════════════════════════════

  Frogger.prototype.onInput = function (type, data) {
    // Tap on frog dead zone → squish bounce (no movement)
    if (type === 'anchortap') {
      this._triggerSquish();
      return;
    }

    if (!this._alive || this._hopCooldown > 0) return;

    var dir = null;

    if (type === 'swipe' || type === 'keyaction') {
      // Swipe, keyboard, AND directional tap all come through here
      // (ArcadeInput converts taps to swipe+keyaction when anchor is set)
      dir = data.direction || data.action;
    }

    if (!dir || dir === 'action' || dir === 'secondary') return;

    this._hop(dir);
  };

  Frogger.prototype._triggerSquish = function () {
    this._squishTimer = 300; // 300ms squish cycle
    this.playSFX('drop-1', { volume: 0.3 });   // gentle boop
  };

  Frogger.prototype._hop = function (dir) {
    if (!this._frog) return;

    var f = this._frog;
    var oldRow = f.row;

    switch (dir) {
      case 'up':    f.row = Math.max(0, f.row - 1); break;
      case 'down':  f.row = Math.min(ROWS - 1, f.row + 1); break;
      case 'left':  f.col = Math.max(0, f.col - 1); break;
      case 'right': f.col = Math.min(this._cols - 1, f.col + 1); break;
    }

    // Score for forward progress
    if (f.row < this._highestRow) {
      this.addScore(HOP_SCORE);
      this._highestRow = f.row;
      if (this._hud) {
        this._hud.popup('+' + HOP_SCORE,
          f.col * this._tile + this._tile / 2,
          this._hudOffset + f.row * this._tile);
      }
    }

    // Cooldown prevents movement spam (150ms)
    this._hopCooldown = 150;

    // SFX
    this.playSFX('hop');
  };

  // ════════════════════════════════════════════
  // UPDATE (called at 60fps fixed timestep)
  // ════════════════════════════════════════════

  Frogger.prototype.onUpdate = function (dt) {
    // Hop cooldown
    if (this._hopCooldown > 0) this._hopCooldown -= dt;

    // Squish animation decay
    if (this._squishTimer > 0) {
      this._squishTimer -= dt;
      if (this._squishTimer <= 0) {
        this._squishTimer = 0;
        this._squishScaleX = 1.0;
        this._squishScaleY = 1.0;
      } else {
        // Bounce curve: quick squash then overshoot stretch then settle
        // t goes 1→0 as timer counts down
        var t = this._squishTimer / 300;
        // sin-based bounce: squash at start, overshoot, settle
        var bounce = Math.sin(t * Math.PI * 2.5) * t;
        // scaleX squashes (gets wider), scaleY stretches (gets taller) — and vice versa
        this._squishScaleX = 1.0 + bounce * 0.25;   // ±25% width wobble
        this._squishScaleY = 1.0 - bounce * 0.25;   // inverse on height
      }
    }

    // Death respawn timer
    if (!this._alive) {
      this._deathTimer -= dt;
      if (this._deathTimer <= 0 && this.lives > 0) {
        this._resetFrog();
      }
      return;
    }

    var T = this._tile;
    if (!T) return;

    // ── Canvas lerp: smooth visual position toward logical grid ──
    if (this._frog) {
      var targetX = this._frog.col;
      var targetY = this._frog.row;
      this._visualX += (targetX - this._visualX) * this._lerpSpeed;
      this._visualY += (targetY - this._visualY) * this._lerpSpeed;
      // Snap when very close (avoid sub-pixel jitter)
      if (Math.abs(this._visualX - targetX) < 0.01) this._visualX = targetX;
      if (Math.abs(this._visualY - targetY) < 0.01) this._visualY = targetY;

      // ── Update input anchor so taps are directional ──
      // Anchor is the frog's current visual center in canvas coords
      if (this._input) {
        this._input.setAnchor(
          this._visualX * T + T / 2,
          this._hudOffset + this._visualY * T + T / 2,
          T * 0.45  // dead zone ≈ half tile — taps on the frog trigger squish, not move
        );
      }
    }

    // Move lane objects
    for (var r = 0; r < this._lanes.length; r++) {
      var lane = this._lanes[r];
      if (!lane.objs || lane.type === 'goal' || lane.type === 'safe') continue;

      for (var i = 0; i < lane.objs.length; i++) {
        var o = lane.objs[i];

        // Passenger trains can pause briefly
        if (o.emoji === 'passenger' && o.pauseTimer > 0) {
          o.pauseTimer -= dt;
          continue;
        }

        o.x += lane.speed * (dt / 1000);

        // Wrap objects that go off-screen
        var totalW = this._cols + 6;
        if (lane.speed > 0 && o.x > totalW) {
          o.x = -o.w - 2;
          // Chance for passenger to pause when re-entering
          if (o.emoji === 'passenger' && Math.random() < 0.3) {
            o.pauseTimer = 800 + Math.random() * 1200;
          }
        } else if (lane.speed < 0 && o.x + o.w < -3) {
          o.x = totalW;
          if (o.emoji === 'passenger' && Math.random() < 0.3) {
            o.pauseTimer = 800 + Math.random() * 1200;
          }
        }
      }
    }

    // Frog interactions
    var f = this._frog;
    if (!f) return;
    var lane = this._lanes[f.row];
    if (!lane) return;

    if (lane.type === 'road' || lane.type === 'train') {
      // Check vehicle collision
      for (var i = 0; i < lane.objs.length; i++) {
        var o = lane.objs[i];
        if (f.col >= o.x - 0.15 && f.col < o.x + o.w + 0.15) {
          // Track if killed by train (for mythic check)
          if (lane.type === 'train') this._trainImpactKill = true;
          this._die();
          return;
        }
      }
    } else if (lane.type === 'water') {
      // Must be on a log — with coyote time grace period
      var onLog = false;
      for (var i = 0; i < lane.objs.length; i++) {
        var o = lane.objs[i];
        if (f.col >= o.x - 0.35 && f.col < o.x + o.w + 0.35) {
          onLog = true;
          // Ride the log (move both logical and visual to stay synced)
          var drift = lane.speed * (dt / 1000);
          f.col += drift;
          this._visualX += drift;
          // Track that we're safely on a log (for coyote recovery)
          this._coyoteTimer = 0;
          this._coyoteActive = false;
          this._lastLogRow = f.row;
          break;
        }
      }
      if (!onLog) {
        // Coyote time: 300ms grace to hop back onto a plank
        if (!this._coyoteActive) {
          this._coyoteActive = true;
          this._coyoteTimer = 300; // 0.3 seconds
          this.playSFX('water-1', { volume: 0.3 }); // subtle warning splash
        }
        this._coyoteTimer -= dt;
        if (this._coyoteTimer <= 0) {
          // Grace period expired — drown
          this._coyoteActive = false;
          this._die();
          return;
        }
        // During coyote time, player can still move (hop to safety)
      }
    } else if (lane.type === 'goal' && f.row === 0) {
      // Reached a goal slot
      var slotW = this._cols / GOAL_SLOTS;
      var slot = Math.floor(f.col / slotW);
      slot = Math.max(0, Math.min(GOAL_SLOTS - 1, slot));

      if (!this._winSlots[slot]) {
        this._winSlots[slot] = true;
        this.addScore(GOAL_SCORE);
        this.playSFX('goal-fanfare');
        if (this._hud) {
          this._hud.popup('+' + GOAL_SCORE,
            f.col * this._tile + this._tile / 2,
            this._hudOffset + 10);
        }
      }

      // Check all slots filled → level clear
      var allFilled = true;
      for (var s = 0; s < GOAL_SLOTS; s++) {
        if (!this._winSlots[s]) { allFilled = false; break; }
      }

      if (allFilled) {
        this.addScore(CLEAR_SCORE);
        this.playSFX('level-clear');
        if (this._hud) {
          this._hud.popup('+' + CLEAR_SCORE + ' CLEAR!',
            this.logicalW / 2, this.logicalH / 2, this.colors.phosphorBright);
        }
        this.nextLevel();
        this._winSlots = [];
        for (var i = 0; i < GOAL_SLOTS; i++) this._winSlots.push(false);
        this._buildGrid();
        this._spawnCoins();
      }

      this._highestRow = ROWS - 1;
      this._resetFrog();
      return;
    }

    // Clear coyote state when on a non-water lane
    if (lane.type !== 'water') {
      this._coyoteTimer = 0;
      this._coyoteActive = false;
    }

    // ── Coin pickup ──
    var fCol = Math.round(f.col);
    for (var ci = 0; ci < this._coins.length; ci++) {
      var coin = this._coins[ci];
      if (!coin.collected && coin.row === f.row && Math.abs(coin.col - fCol) < 0.8) {
        coin.collected = true;
        this.addScore(COIN_SCORE);
        this.playSFX('coin-2', { volume: 0.5 });
        if (this._hud) {
          this._hud.popup('+' + COIN_SCORE,
            coin.col * T + T / 2,
            this._hudOffset + coin.row * T, this.colors.amber);
        }
      }
    }

    // Out of bounds (drifted off log)
    if (f.col < -0.5 || f.col >= this._cols + 0.5) {
      this._die();
    }
  };

  Frogger.prototype._die = function () {
    this._alive = false;
    this._deathPos = this._frog ? {
      col: this._frog.col,
      row: this._frog.row
    } : null;
    this._deathTimer = 800;
    this._highestRow = ROWS - 1;

    // Randomize kitty SFX for this death (updates both 'death' and 'splat' keys)
    var kittyKey = 'kitty-' + (1 + Math.floor(Math.random() * 3));
    this.sfxMap['death'] = kittyKey;
    this.sfxMap['splat'] = kittyKey;

    this.playSFX('splat');
    this.loseLife();  // ArcadeEngine handles GAME_OVER transition when lives=0
  };

  // ════════════════════════════════════════════
  // DRAW
  // ════════════════════════════════════════════

  Frogger.prototype.onDraw = function (ctx, w, h) {
    var T = this._tile;
    if (!T) return;
    var hudY = this._hudOffset;

    // ── Draw lanes ──
    for (var r = 0; r < ROWS; r++) {
      var lane = this._lanes[r];
      if (!lane) continue;
      var ly = hudY + r * T;

      // Lane background
      if (lane.type === 'road' || lane.type === 'train') {
        ctx.fillStyle = '#0f0f0f';
        ctx.fillRect(0, ly, w, T);
        // Lane markings
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.moveTo(0, ly + T / 2);
        ctx.lineTo(w, ly + T / 2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (lane.type === 'water') {
        ctx.fillStyle = '#001a33';
        ctx.fillRect(0, ly, w, T);
        // Water ripple dots
        ctx.fillStyle = 'rgba(0, 100, 200, 0.2)';
        for (var wx = 0; wx < w; wx += T) {
          ctx.fillRect(wx + Math.sin(wx * 0.1 + Date.now() * 0.001) * 3, ly + T * 0.7, 4, 2);
        }
      } else if (lane.type === 'goal') {
        ctx.fillStyle = '#0a1a0a';
        ctx.fillRect(0, ly, w, T);
      } else {
        // Safe zone
        ctx.fillStyle = '#0a120a';
        ctx.fillRect(0, ly, w, T);
      }

      // Lane objects (emoji)
      if (lane.objs) {
        for (var i = 0; i < lane.objs.length; i++) {
          var o = lane.objs[i];
          var ox = o.x * T;
          var ow = o.w * T;

          // Only draw if on screen
          if (ox + ow < -T || ox > w + T) continue;

          var emojiChar = EMOJI[o.emoji] || '?';
          var emojiSize = T * 0.75;

          // Draw each tile of the object
          for (var t = 0; t < o.w; t++) {
            // First cell gets the main emoji, rest get body segments
            var segChar = (t === 0) ? emojiChar
                        : (o.emoji === 'freight' || o.emoji === 'passenger') ? '🚃'
                        : (o.emoji === 'log') ? EMOJI.log
                        : emojiChar;
            this.drawEmoji(ctx, segChar,
              ox + t * T + T / 2,
              ly + T / 2,
              emojiSize);
          }
        }
      }

      // Goal slots
      if (lane.type === 'goal') {
        var slotW = this._cols / GOAL_SLOTS;
        for (var s = 0; s < GOAL_SLOTS; s++) {
          var sx = s * slotW * T + slotW * T / 2;
          var flagEmoji = this._winSlots[s] ? EMOJI.goalFill : EMOJI.goal;
          this.drawEmoji(ctx, flagEmoji, sx, ly + T / 2, T * 0.65,
            this._winSlots[s] ? { glow: true, glowColor: this.colors.phosphor } : {});
        }
      }
    }

    // ── Draw collectible coins ──
    for (var ci = 0; ci < this._coins.length; ci++) {
      var coin = this._coins[ci];
      if (coin.collected) continue;
      var cx = coin.col * T + T / 2;
      var cy = hudY + coin.row * T + T / 2;
      // Gentle float animation
      var bobY = Math.sin(Date.now() * 0.004 + ci * 1.5) * 2;
      this.drawEmoji(ctx, EMOJI.coin, cx, cy + bobY, T * 0.6, {
        glow: true,
        glowColor: this.colors.amber,
        glowRadius: 6
      });
    }

    // ── Coyote time warning flash ──
    if (this._coyoteActive && this._alive && this._frog) {
      // Flash the water tile under the frog red as warning
      var warnAlpha = 0.3 + 0.3 * Math.sin(Date.now() * 0.02);
      ctx.fillStyle = 'rgba(255, 60, 60, ' + warnAlpha + ')';
      ctx.fillRect(
        this._visualX * T, hudY + this._visualY * T,
        T, T
      );
    }

    // ── Draw frog (lerped smooth position + squish transform) ──
    if (this._alive && this._frog) {
      var fx = this._visualX * T + T / 2;
      var fy = hudY + this._visualY * T + T / 2;

      // Apply squish squash-and-stretch if active
      if (this._squishTimer > 0) {
        ctx.save();
        ctx.translate(fx, fy);
        ctx.scale(this._squishScaleX, this._squishScaleY);
        this.drawEmoji(ctx, EMOJI.player, 0, 0, T * 0.85, {
          glow: true,
          glowColor: this.colors.phosphor,
          glowRadius: 10
        });
        ctx.restore();
      } else {
        this.drawEmoji(ctx, EMOJI.player, fx, fy, T * 0.85, {
          glow: true,
          glowColor: this.colors.phosphor,
          glowRadius: 10
        });
      }
    }

    // ── Death animation ──
    if (!this._alive && this._deathPos) {
      var dx = this._deathPos.col * T + T / 2;
      var dy = hudY + this._deathPos.row * T + T / 2;
      var deathLane = this._lanes[this._deathPos.row];
      var deathEmoji = (deathLane && deathLane.type === 'water') ? EMOJI.splash : EMOJI.skull;
      var alpha = Math.max(0.2, this._deathTimer / 800);
      this.drawEmoji(ctx, deathEmoji, dx, dy, T * 0.9, {
        alpha: alpha,
        glow: true,
        glowColor: this.colors.red,
        glowRadius: 12
      });
    }

    // ── Safe zone labels ──
    this.drawText(ctx, 'START', 8, hudY + (ROWS - 1) * T + T / 2, 9,
                  this.colors.phosphorDim);
    this.drawText(ctx, 'SAFE', 8, hudY + 6 * T + T / 2, 9,
                  this.colors.phosphorDim);

    // ── Train warning indicators ──
    for (var r = 0; r < ROWS; r++) {
      var lane = this._lanes[r];
      if (lane && lane.type === 'train') {
        var warnY = hudY + r * T + T / 2;
        this.drawText(ctx, '⚠', w - 16, warnY, 10, this.colors.amber, 'center');
      }
    }
  };

  // ════════════════════════════════════════════
  // BOSS ADAPTER (Depot Warden)
  // ════════════════════════════════════════════

  Frogger.prototype.onBossMount = function (combatState) {
    this._bossHP = combatState.bossHP || 100;
    this._bossMaxHP = combatState.bossMaxHP || 100;
    this._trainImpactKill = false;

    if (this._hud) {
      this._hud.setBossHP(this._bossHP, this._bossMaxHP);
    }
  };

  Frogger.prototype.onBossUnmount = function () {
    return {
      loot: null, // populated by boss-encounters.js based on result
      mythic: this._trainImpactKill
    };
  };

  Frogger.prototype.onBossUpdate = function (deltaMs) {
    // Boss HP sync — could be driven by gone-rogue combat state
    if (this._hud) {
      this._hud.setBossHP(this._bossHP, this._bossMaxHP);
    }
  };

  /**
   * Return hazard rects for gone-rogue collision pipeline.
   * All train/car objects become hazards in boss mode.
   */
  Frogger.prototype.onGetHazards = function () {
    var hazards = [];
    var T = this._tile;
    var hudY = this._hudOffset;

    for (var r = 0; r < this._lanes.length; r++) {
      var lane = this._lanes[r];
      if (!lane.objs || lane.type === 'water' || lane.type === 'goal' || lane.type === 'safe') continue;

      var damage = (lane.type === 'train') ? 25 : 15;
      for (var i = 0; i < lane.objs.length; i++) {
        var o = lane.objs[i];
        hazards.push({
          x: o.x * T,
          y: hudY + r * T,
          w: o.w * T,
          h: T,
          damage: damage
        });
      }
    }
    return hazards;
  };

  /**
   * Mythic check: did a train kill the player?
   * (TRAIN_IMPACT_KILL — survive a boss encounter where you were once hit by a train)
   */
  Frogger.prototype.onMythicCheck = function () {
    return this._trainImpactKill && this.lives > 0;
  };

  // ════════════════════════════════════════════
  // EXPORT — MinigameModal compatible
  // ════════════════════════════════════════════

  var instance = new Frogger();
  return instance.asMinigame();
})();
