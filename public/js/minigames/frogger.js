/* ============================================================
   FROGGER — Depot Crossing
   ArcadeEngine-powered rewrite with emoji entities, touch swipe,
   audio, currency, and BossAdapter for Depot Warden encounter.

   Entities: 🐸 player, 🚂 freight, 🚃 passenger, 🚗 car,
             🪵 safe platform, 🏁 extraction goal
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
    log:       '🪵',
    goal:      '🏁',
    goalFill:  '✅',
    water:     '🌊',
    splash:    '💦',
    skull:     '💀'
  };

  // ── Frogger game class ──

  function Frogger() {
    ArcadeEngine.call(this, {
      gameId: 'frogger',
      title: 'DEPOT CROSSING',
      lives: 3,
      currencyRate: 0.02
    });

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
    this._buildGrid();
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

  Frogger.prototype._buildGrid = function () {
    var hudOffset = (typeof ArcadeHUD !== 'undefined') ? ArcadeHUD.HEIGHT : 28;
    var playH = this.logicalH - hudOffset;
    this._tile = Math.floor(playH / ROWS);
    this._cols = Math.ceil(this.logicalW / this._tile);
    this._hudOffset = hudOffset;

    this._lanes = [];
    for (var r = 0; r < ROWS; r++) {
      var type = LANE_MAP[r] || 'safe';
      if (type === 'goal' || type === 'safe') {
        this._lanes.push({ type: type, objs: [] });
        continue;
      }

      var isWater = (type === 'water');
      var isTrain = (type === 'train');
      var speedBase = isWater ? (0.4 + Math.random() * 0.8)
                    : isTrain ? (1.0 + Math.random() * 1.2)
                    : (0.5 + Math.random() * 1.0);
      var dir = (r % 2 === 0) ? 1 : -1;
      var spd = speedBase * dir * (1 + this.level * 0.08);

      var objW = isWater ? (2 + Math.floor(Math.random() * 2))
               : isTrain ? (2 + Math.floor(Math.random() * 2))
               : (1 + Math.floor(Math.random() * 2));
      var gap = objW + 2 + Math.floor(Math.random() * 3);
      var totalCols = this._cols + 6;

      var objs = [];
      for (var x = -3; x < totalCols; x += gap) {
        var emojiType = isWater ? 'log'
                      : isTrain ? (Math.random() < 0.4 ? 'freight' : 'passenger')
                      : 'car';
        objs.push({
          x: x,
          w: objW,
          emoji: emojiType,
          pauseTimer: 0  // for passenger trains that stop briefly
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
    // Snap visual position to grid (no lerp on reset)
    this._visualX = this._frog.col;
    this._visualY = this._frog.row;
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
    this.playSFX('ui-01');   // gentle boop
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
      // Must be on a log
      var onLog = false;
      for (var i = 0; i < lane.objs.length; i++) {
        var o = lane.objs[i];
        if (f.col >= o.x - 0.35 && f.col < o.x + o.w + 0.35) {
          onLog = true;
          // Ride the log (move both logical and visual to stay synced)
          var drift = lane.speed * (dt / 1000);
          f.col += drift;
          this._visualX += drift;
          break;
        }
      }
      if (!onLog) {
        this._die();
        return;
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
      }

      this._highestRow = ROWS - 1;
      this._resetFrog();
      return;
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
                        : (o.emoji === 'log') ? '🪵'
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
