/* ============================================================
   SKI FREE — Infiltration Descent
   ArcadeEngine-powered with emoji entities, touch steering,
   audio, currency, progressive difficulty, and BossAdapter for
   Schweitzer Descent encounter (Floor 22).

   SCROLL CONVENTION: Terrain scrolls UPWARD — obstacles spawn
   below screen and rise past the player (downhill sensation).
   Player sits in upper third.

   CARVING ANIMATION: ⛷️ flips scaleX based on steer direction
   and narrows (compresses) during hard carving via sine curve.

   PURSUERS: ⛷️ with dark compositing overlay (blvck smudge).
   First pursuer spawns early (~300m), second much later (~3000m).

   PROJECTILES: Infinite ammo, fired downhill. Pursuers have HP
   that scales with distance. Dispatched = shadow + poof.

   Z-ORDER: After obstacles scroll past player by 15-20%, player
   can carve back behind tree emojis (trees draw on top).

   Entities: ⛷️ player, 🌲 tree, 🎄 snow fir, 🗿 rock,
             🏔️ snow bank, ⛷️ pursuer (dark), 🏍️ motorcycle,
             💰 intel/currency

   Uses genre helper modules:
     WeightedTable  — obstacle spawn selection
     DifficultyRamp — section-based difficulty curve
     ProjectileSystem — omnidirectional projectiles
     ParticleEmitter  — text/emoji particles
   ============================================================ */
window.SkiFreeGame = (function () {
  'use strict';

  // ── Emoji palette ──
  var EMOJI = {
    player:    '⛷️',
    tree:      '🌲',
    snowFir:   '🎄',
    rock:      '🗿',
    snowBank:  '🏔️',
    motorcycle:'🏍️',
    intel:     '💰',
    ice:       '❄️',
    crash:     '💥',
    warning:   '⚠️',
    poof:      '💨',
    projectile:'•'
  };

  // ── Weighted obstacle table (via WeightedTable module) ──
  var obstacleTable = new WeightedTable([
    { emoji: EMOJI.tree,    weight: 30, w: 0.8, h: 1.0, damage: 10, zBlock: true },
    { emoji: EMOJI.snowFir, weight: 12, w: 0.7, h: 0.9, damage: 10, zBlock: true },
    { emoji: EMOJI.rock,    weight: 20, w: 0.9, h: 0.7, damage: 15, zBlock: false },
    { emoji: EMOJI.snowBank, weight: 38, w: 1.0, h: 0.6, damage: 5, breakable: true, zBlock: false }
  ]);

  // ── Difficulty sections (via DifficultyRamp module) ──
  var difficultyRamp = new DifficultyRamp({
    metric: 'distance',
    range: [0, 7000],
    sections: [
      { name: 'Upper Slopes',  at: 0,    obstRate: 0.015, iceRate: 0.06, speedMul: 1.0 },
      { name: 'Treeline Run',  at: 800,  obstRate: 0.05,  iceRate: 0.12, speedMul: 1.10 },
      { name: 'Mogul Field',   at: 2000, obstRate: 0.10,  iceRate: 0.18, speedMul: 1.25 },
      { name: 'Chute',         at: 3500, obstRate: 0.18,  iceRate: 0.25, speedMul: 1.45 },
      { name: 'Base Approach',  at: 5500, obstRate: 0.14,  iceRate: 0.20, speedMul: 1.65 }
    ]
  });

  // ── Trail system config ──
  var PLAYER_TRAIL_LEN = 40;
  var PURSUER_TRAIL_LEN = 12;

  // ── Intro ──
  var INTRO_DURATION = 90;

  // ── Projectile config (passed to ProjectileSystem) ──
  var PROJECTILE_SIZE = 3;

  // ════════════════════════════════════════════════════════════

  function SkiFree() {
    ArcadeEngine.call(this, {
      gameId: 'ski-free',
      title: 'INFILTRATION DESCENT',
      lives: 1,
      currencyRate: 0.005
    });

    // ── ASCII splash screen ──
    this.splashArt = [
      '::::::::::::::::::::::::::::::::::::::::::::',
      '::                                        ::',
      '::   ╔═╗╔═╗╦ ╦╦ ╦╔═╗╦╔╦╗╔═╗╔═╗╦═╗      ::',
      '::   ╚═╗║  ╠═╣║║║║╣ ║ ║ ╔═╝║╣ ╠╦╝      ::',
      '::   ╚═╝╚═╝╩ ╩╚╩╝╚═╝╩ ╩ ╚═╝╚═╝╩╚═      ::',
      '::                                        ::',
      '::   ╔═╗╔═╗╔═╗╔═╗╔═╗╔═╗                  ::',
      '::   ║╣ ╚═╗║  ╠═╣╠═╝║╣                   ::',
      '::   ╚═╝╚═╝╚═╝╩ ╩╩  ╚═╝                  ::',
      '::                                        ::',
      '::        ⛷️  EXTRACTION INBOUND  ⛷️       ::',
      '::                                        ::',
      '::   ░░▒▒▓▓████  CLASSIFIED  ████▓▓▒▒░░  ::',
      '::                                        ::',
      '::::::::::::::::::::::::::::::::::::::::::::'
    ].join('\n');

    this.sfxMap = {
      'hop':        'drop-1',
      'crash':      'crunch-1',
      'death':      'crunch-1',
      'game-over':  'game-over-1',
      'near-miss':  'coin-2',
      'level-up':   'toad',
      'game-start': 'power-up-1',
      'intel':      'coin-2',
      'pickup-health': 'sq-sq-pickup-success2',
      'ice-slide':  'water-1',
      'shoot':      'drop-1',
      'hit':        'kitty-1',
      'kill':       'metal-hit-1',
      'extraction': 'toad'
    };

    // ── Module instances ──
    this._bullets = new ProjectileSystem({
      speed: 7,
      range: 500,
      cooldown: 12,
      trailLength: 6
    });

    this._emitter = new ParticleEmitter(200);

    // ── Game state (pre-initialized for safe MENU-state rendering) ──
    this._player = null;
    this._obstacles = [];
    this._icePatches = [];
    this._intel = [];
    this._foodPickups = [];
    this._pursuers = [];
    this._distance = 0;
    this._speed = 0;
    this._baseSpeed = 2.0;
    this._maxSpeed = 4.5;
    this._tuck = false;
    this._steerX = 0;
    this._onIce = false;
    this._sectionFlash = 0;
    this._nearMissTimer = 0;
    this._nearMissCombo = 0;
    this._crashTimer = 0;
    this._crashEmoji = null;
    this._treeHit = false;
    this._intelCount = 0;
    this._killCount = 0;

    // Trail ring buffers
    this._playerTrail = [];

    // Intro
    this._introTimer = 0;
    this._introComplete = false;

    // Touch state
    this._dragActive = false;
    this._dragStartX = 0;
    this._dragX = 0;
    this._dragY = 0;

    // Extraction (distance scales per level — long early runs, shorter later)
    this._extractionDist = 7000;
    this._extracted = false;
    this._extractionTimer = 0;
    this._extractionPhase = 'none'; // none, clearing, approach, mount, rideoff, done

    // Entity scale: player + pursuers spawn at 50% size
    this._entityScale = 0.5;
  }

  SkiFree.prototype = Object.create(ArcadeEngine.prototype);
  SkiFree.prototype.constructor = SkiFree;

  // ════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ════════════════════════════════════════════════════════════

  SkiFree.prototype.onInit = function () { this._resetState(); };
  SkiFree.prototype.onStart = function () {
    this._resetState();

    // ── Difficulty scaling ──
    var dm = this.difficultyMultiplier();
    // Scale base speed: U1 slower, U3 faster
    this._baseSpeed = 2.0 * dm;
    this._maxSpeed = 4.5 * dm;
    // Adjust lives
    if (this.difficulty === 1) {
      this.lives = 1;  // already set to 1, but could add extra recovery
    } else if (this.difficulty === 3) {
      this.lives = 1;
    }
  };

  SkiFree.prototype._resetState = function () {
    var W = this.logicalW, H = this.logicalH;
    this._tileSize = Math.floor(Math.min(W / 14, H / 20));
    if (this._tileSize < 12) this._tileSize = 12;
    var T = this._tileSize;

    this._entityScale = 0.5;
    this._playerRestY = H * 0.3;
    var S = this._entityScale;
    this._player = { x: W / 2, y: -T * 2, w: T * 0.8 * S, h: T * 1.0 * S, hp: 100 };

    this._obstacles = [];
    this._icePatches = [];
    this._intel = [];
    this._foodPickups = [];
    this._pursuers = [];
    this._bullets.clear();
    this._emitter.clear();
    this._playerTrail = [];
    this._distance = 0;
    this._speed = this._baseSpeed;
    this._tuck = false;
    this._steerX = 0;
    this._onIce = false;
    this._sectionFlash = 0;
    this._nearMissTimer = 0;
    this._nearMissCombo = 0;
    this._crashTimer = 0;
    this._crashEmoji = null;
    this._treeHit = false;
    this._intelCount = 0;
    this._killCount = 0;
    this._dragActive = false;
    this._dragStartX = 0;
    this._extracted = false;
    this._extractionTimer = 0;
    this._extractionPhase = 'none';
    this._motoX = 0;
    this._motoY = 0;
    this._introTimer = 0;
    this._introComplete = false;

    // Extraction distance: lvl 1 = 10000m (long intro run), scales down to 5000m by lvl 5+
    var lvl = this.level || 1;
    this._extractionDist = Math.max(5000, 10000 - (lvl - 1) * 1200);

    difficultyRamp.reset();

    // Only ONE sparse obstacle far below screen on level 1; more on later levels
    var initCount = Math.min(3, lvl);
    for (var i = 0; i < initCount; i++) {
      this._spawnObstacleAt(H + (i * 220 + 600 + Math.random() * 150));
    }
  };

  SkiFree.prototype.onResize = function (w, h) {
    this._tileSize = Math.floor(Math.min(w / 14, h / 20));
    if (this._tileSize < 12) this._tileSize = 12;
    this._playerRestY = h * 0.3;
    if (this._player) {
      var T = this._tileSize, S = this._entityScale;
      this._player.w = T * 0.8 * S;
      this._player.h = T * 1.0 * S;
      this._player.x = Math.min(this._player.x, w - this._player.w);
      if (this._introComplete) this._player.y = this._playerRestY;
    }
  };

  // ════════════════════════════════════════════════════════════
  // INPUT
  // ════════════════════════════════════════════════════════════

  SkiFree.prototype.onInput = function (type, data) {
    if (!this._introComplete) return;

    var W = this.logicalW;
    var H = this.logicalH;

    // Keyboard
    if (type === 'keyaction') {
      if (data.action === 'left') this._steerX = -1;
      else if (data.action === 'right') this._steerX = 1;
      else if (data.action === 'down') this._tuck = true;
      else if (data.action === 'up') this._tuck = false;
      else if (data.action === 'action') this._fireAt(this._player.x, H);
    }

    // Swipe legacy
    if (type === 'swipe') {
      if (data.direction === 'left') this._steerX = -1;
      else if (data.direction === 'right') this._steerX = 1;
    }

    // Drag: relative X delta for responsive steering, Y for speed control
    // Mouse (desktop) needs higher divisor to avoid twitchy carving;
    // touch events use coarser coordinates so keep responsive.
    var DRAG_STEER_SENS_TOUCH = 80;
    var DRAG_STEER_SENS_MOUSE = 140;
    if (type === 'dragstart') {
      this._dragActive = true;
      this._dragIsTouch = !!(data.touch);  // ArcadeInput tags touch events
      this._dragStartX = data.x;
      this._dragX = data.x;
      this._dragY = data.y;
    }
    if (type === 'drag' && this._dragActive) {
      this._dragX = data.x;
      this._dragY = data.y;
      var sens = this._dragIsTouch ? DRAG_STEER_SENS_TOUCH : DRAG_STEER_SENS_MOUSE;
      var dxRel = (data.x - this._dragStartX) / sens;
      // Apply slight easing curve to soften desktop mouse: reduce extremes
      if (!this._dragIsTouch) dxRel = Math.sign(dxRel) * Math.pow(Math.abs(dxRel), 1.3);
      this._steerX = Math.max(-1, Math.min(1, dxRel));
    }
    if (type === 'dragend') {
      this._dragActive = false;
      this._steerX = 0;
      this._tuck = false;
    }

    // Tap / double-tap = fire toward tap position
    if (type === 'tap' || type === 'doubletap') {
      this._fireAt(data.x, data.y);
    }
  };

  // ── Fire wrapper (delegates to ProjectileSystem) ──
  SkiFree.prototype._fireAt = function (targetX, targetY) {
    var px = this._player.x, py = this._player.y;
    var proj = this._bullets.fireAt(px, py, targetX, targetY);
    if (proj) this.playSFX('shoot');
  };

  // ════════════════════════════════════════════════════════════
  // UPDATE
  // ════════════════════════════════════════════════════════════

  SkiFree.prototype.onUpdate = function (dt) {
    var W = this.logicalW, H = this.logicalH, T = this._tileSize;

    // ── Extraction animation (multi-phase landing scene) ──
    if (this._extracted) {
      this._extractionTimer++;
      var phase = this._extractionPhase;
      var cx = W / 2;

      if (phase === 'clearing') {
        // Terrain still scrolls but obstacles are cleared away
        this._scrollTerrain(this._speed * 0.6, H);
        this._speed *= 0.985; // gentle deceleration
        if (this._speed < 1.0) this._speed = 1.0;
        // Remove obstacles that scroll past; don't spawn new ones
        // Auto-steer player toward center
        this._player.x += (cx - this._player.x) * 0.03;
        this._distance += this._speed * 0.3;
        this._recordTrail();
        if (this._extractionTimer > 80) {
          this._extractionPhase = 'approach';
          this._extractionTimer = 0;
          // Place motorcycle ahead of player
          this._motoX = cx;
          this._motoY = H * 0.75;
        }
      }

      else if (phase === 'approach') {
        // Motorcycle visible in clearing, player auto-slides toward it
        this._scrollTerrain(0.5, H);
        this._player.x += (this._motoX - this._player.x) * 0.06;
        this._player.y += (this._motoY - T * 2 - this._player.y) * 0.04;
        this._recordTrail();

        // Sweep remaining pursuers: motorcycle fires at them
        if (this._pursuers.length > 0 && this._extractionTimer % 12 === 0) {
          var pur = this._pursuers[0];
          this._emitter.burst(pur.x, pur.y, { emoji: EMOJI.crash, count: 2, speed: 1.5, life: 20 });
          this._emitter.burst(pur.x, pur.y, { emoji: EMOJI.poof, count: 1, speed: 0, life: 30 });
          this.playSFX('kill');
          this._pursuers.splice(0, 1);
        }

        if (this._extractionTimer > 60) {
          this._extractionPhase = 'mount';
          this._extractionTimer = 0;
        }
      }

      else if (phase === 'mount') {
        // Player meets motorcycle — poof, merge into two motorcycles
        var mountProgress = Math.min(1, this._extractionTimer / 40);
        this._player.y += (this._motoY - this._player.y) * 0.1;
        this._player.x += (this._motoX - this._player.x) * 0.1;

        if (this._extractionTimer === 20) {
          this._emitter.burst(this._motoX, this._motoY, { emoji: EMOJI.poof, count: 3, speed: 2, life: 35 });
        }

        if (this._extractionTimer > 50) {
          this._extractionPhase = 'rideoff';
          this._extractionTimer = 0;
        }
      }

      else if (phase === 'rideoff') {
        // Two motorcycles ride off upward
        if (this._extractionTimer > 90) {
          this._extractionPhase = 'done';
          this._extractionTimer = 0;
        }
      }

      else if (phase === 'done') {
        // Advance to next level
        this.nextLevel();
        this._extracted = false;
        this._extractionPhase = 'none';
        this._extractionTimer = 0;
        this._resetState();
        this._introComplete = true;
        this._player.y = this._playerRestY;
        this._emitter.update();
        return;
      }

      this._emitter.update();
      return;
    }

    // ── Intro ──
    if (!this._introComplete) {
      this._introTimer++;
      var eased = 1 - Math.pow(1 - Math.min(1, this._introTimer / INTRO_DURATION), 3);
      this._player.y = -T * 2 + (this._playerRestY + T * 2) * eased;
      this._distance += 0.5;
      if (this._introTimer >= INTRO_DURATION) {
        this._introComplete = true;
        this._player.y = this._playerRestY;
      }
      this._emitter.update();
      return;
    }

    // ── Difficulty ramp ──
    difficultyRamp.update(this._distance);

    // Section flash on transition
    if (difficultyRamp.sectionChanged()) {
      this._sectionFlash = 120;
    }
    if (this._sectionFlash > 0) this._sectionFlash--;

    // ── Crash recovery ──
    if (this._crashTimer > 0) {
      this._crashTimer--;
      this._speed *= 0.975;
      if (this._speed < 1.2) this._speed = 1.2;
      if (this._crashTimer <= 0) this._crashEmoji = null;
      this._distance += this._speed * 0.3;
      this._scrollTerrain(this._speed * 0.3, H);
      this._recordTrail();
      this._emitter.update();
      return;
    }

    // ── Speed: drag Y position controls tuck ──
    if (this._dragActive) {
      var yNorm = this._dragY / H;
      this._tuck = yNorm > 0.6;
      if (yNorm < 0.3) this._speed *= 0.97;
    }

    var speedMul = difficultyRamp.get('speedMul', 1.0);
    var targetSpeed = this._baseSpeed * speedMul;
    if (this._tuck) targetSpeed *= 1.4;
    if (this._onIce) targetSpeed *= 1.3;
    targetSpeed *= (1 - Math.abs(this._steerX) * 0.15);

    this._speed += (targetSpeed - this._speed) * 0.08;
    if (this._speed < 0.8) this._speed = 0.8;
    if (this._speed > this._maxSpeed * speedMul) this._speed = this._maxSpeed * speedMul;

    this._distance += this._speed;
    this.score = Math.floor(this._distance);

    // ── Steer ──
    if (!this._dragActive) {
      if (this.isKeyHeld('left')) this._steerX = -1;
      else if (this.isKeyHeld('right')) this._steerX = 1;
      else this._steerX *= 0.85;
    }
    this._player.x += this._steerX * 3.5 * (this._onIce ? 0.5 : 1.0);
    var margin = T * 2;
    if (this._player.x < margin) this._player.x = margin;
    if (this._player.x > W - margin) this._player.x = W - margin;
    this._player.y = this._playerRestY;

    // ── Record trail ──
    this._recordTrail();

    // ── Scroll terrain ──
    this._scrollTerrain(this._speed, H);

    // ── Ice ──
    this._onIce = false;
    for (var ip = this._icePatches.length - 1; ip >= 0; ip--) {
      if (this._overlaps(this._player, this._icePatches[ip])) this._onIce = true;
    }

    // ── Obstacle collisions + near-miss ──
    var nearMiss = false;
    for (var i = this._obstacles.length - 1; i >= 0; i--) {
      var obs = this._obstacles[i];
      if (this._overlaps(this._player, obs)) { this._hitObstacle(obs, i); continue; }
      if (!obs.nearMissed && obs.y < this._player.y && obs.y > this._player.y - T * 2) {
        var odx = Math.abs(obs.x - this._player.x);
        if (odx < T * 1.2 * this._entityScale && odx > T * 0.3 * this._entityScale) { nearMiss = true; obs.nearMissed = true; }
      }
    }
    if (nearMiss) {
      this._nearMissCombo++;
      this.addScore(25 * this._nearMissCombo);
      this.playSFX('near-miss');
      this._nearMissTimer = 45;
      this._emitter.burst(this._player.x, this._player.y + T, {
        emoji: '✨', count: 1, speed: 0, life: 30, gravity: -0.3
      });
    }
    if (this._nearMissTimer > 0) this._nearMissTimer--; else this._nearMissCombo = 0;

    // ── Intel pickups ──
    for (var j = this._intel.length - 1; j >= 0; j--) {
      if (this._overlaps(this._player, this._intel[j])) {
        this._intelCount++; this.addScore(200); this.playSFX('intel');
        this._emitter.burst(this._intel[j].x, this._intel[j].y, {
          emoji: '+200', count: 1, speed: 0, life: 40, gravity: -0.3
        });
        this._intel.splice(j, 1);
      }
    }

    // ── Food / HP recovery pickups ──
    for (var fi = this._foodPickups.length - 1; fi >= 0; fi--) {
      var food = this._foodPickups[fi];
      if (this._overlaps(this._player, food)) {
        var hpBefore = this._player.hp;
        this._player.hp = Math.min(100, this._player.hp + food.heal);
        var hpGain = this._player.hp - hpBefore;
        if (hpGain > 0) {
          this.playSFX('pickup-health');
          this._emitter.burst(food.x, food.y, {
            emoji: '+' + hpGain + 'HP', count: 1, speed: 0, life: 50, gravity: -0.3
          });
        } else {
          this.playSFX('near-miss');
          this._emitter.burst(food.x, food.y, {
            emoji: food.emoji, count: 1, speed: 0, life: 30, gravity: -0.3
          });
        }
        this.addScore(25);
        this._foodPickups.splice(fi, 1);
      }
    }

    // ── Spawning (density ramps with distance, generous grace period) ──
    // Level 1: no obstacles for first 500m, then very slow ramp (full at 2000m)
    // Later levels: grace period shrinks, ramp is steeper
    var lvlMul = Math.min(1.0, (this.level - 1) * 0.25);  // 0 at lvl1, 0.25 at lvl2, 1.0 at lvl5+
    var graceEnd = 500 - lvlMul * 300;       // 500m at lvl1, 200m at lvl5+
    var rampLen  = 1500 - lvlMul * 1000;     // 1500m at lvl1, 500m at lvl5+

    var spawnChance = 0;
    if (this._distance > graceEnd) {
      var ramp = Math.min(1.0, (this._distance - graceEnd) / rampLen);
      var dm = this.difficultyMultiplier();
      var baseRate = difficultyRamp.get('obstRate', 0.015);
      spawnChance = baseRate * dm * ramp * (0.9 + this._distance * 0.00002);
      if (spawnChance > 0.25) spawnChance = 0.25;
    }
    if (Math.random() < spawnChance) this._spawnObstacleAt(H + 30 + Math.random() * 40);

    var iceRate = difficultyRamp.get('iceRate', 0.06);
    if (Math.random() < iceRate * 0.05) {
      this._icePatches.push({
        x: margin + Math.random() * (W - margin * 2), y: H + 40,
        w: T * (2 + Math.random() * 2), h: T * (1 + Math.random()), emoji: EMOJI.ice
      });
    }
    if (Math.random() < 0.004) {
      this._intel.push({
        x: margin + Math.random() * (W - margin * 2), y: H + 30,
        w: T * 0.35, h: T * 0.35, emoji: EMOJI.intel
      });
    }

    // ── Food / HP recovery spawning (rarer than intel, more frequent when hurt) ──
    var foodChance = 0.002;
    if (this._player.hp < 50) foodChance = 0.005;
    if (this._player.hp < 25) foodChance = 0.009;
    if (this._distance > 200 && Math.random() < foodChance) {
      var foodTypes = [
        { emoji: '🍎', heal: 10, name: 'Apple' },
        { emoji: '🍕', heal: 20, name: 'Pizza' },
        { emoji: '☕', heal: 15, name: 'Coffee' },
        { emoji: '🍩', heal: 12, name: 'Donut' },
        { emoji: '🥤', heal: 10, name: 'Juice' }
      ];
      var ft = foodTypes[Math.floor(Math.random() * foodTypes.length)];
      this._foodPickups.push({
        x: margin + Math.random() * (W - margin * 2), y: H + 30,
        w: T * 0.35, h: T * 0.35,
        emoji: ft.emoji, heal: ft.heal, name: ft.name
      });
    }

    // ── Pursuer spawning ──
    // Level 1: first pursuer at ~2500m (player has time to learn), second at ~5000m
    // Higher levels: pursuer thresholds shrink
    var firstPursuerDist = Math.max(800, 2500 - (this.level - 1) * 400);
    var secondPursuerDist = firstPursuerDist + Math.max(1500, 2500 - (this.level - 1) * 300);

    if (this._pursuers.length === 0 && this._distance > firstPursuerDist) {
      this._spawnPursuer();
    } else if (this._pursuers.length === 1 && this._distance > secondPursuerDist) {
      this._spawnPursuer();
    } else if (this._pursuers.length >= 2) {
      var nextSpawn = secondPursuerDist + (this._pursuers.length - 1) * 2000;
      if (this._distance > nextSpawn && this._pursuers.length < 8) {
        this._spawnPursuer();
      }
    }

    // ── Update pursuers ──
    for (var pi = this._pursuers.length - 1; pi >= 0; pi--) {
      this._updatePursuer(this._pursuers[pi], pi);
    }

    // ── Update projectiles (via ProjectileSystem — no scroll offset, screen-space) ──
    this._bullets.update(W, H, 0);

    // Projectile → pursuer hits
    for (var pk = this._pursuers.length - 1; pk >= 0; pk--) {
      var pur = this._pursuers[pk];
      var hitR = T * 0.8 * this._entityScale;
      var hit = this._bullets.collideFirst(pur.x, pur.y, hitR);
      if (hit) {
        pur.hp--;
        this.sfxMap['hit'] = 'kitty-' + (1 + Math.floor(Math.random() * 3));
        this.playSFX('hit');
        this._emitter.burst(pur.x, pur.y, { emoji: EMOJI.crash, count: 1, speed: 0, life: 15 });
        if (pur.hp <= 0) this._killPursuer(pk);
      }
    }

    // Projectile → breakable obstacle hits
    for (var po = this._obstacles.length - 1; po >= 0; po--) {
      var bObs = this._obstacles[po];
      if (!bObs.breakable) continue;
      var bHit = this._bullets.collideFirst(bObs.x, bObs.y, T * 0.6);
      if (bHit) {
        this.playSFX('hit');
        this._collectDrop(bObs);
        this._obstacles.splice(po, 1);
      }
    }

    // ── Extraction check ──
    if (this._distance >= this._extractionDist && !this._extracted) {
      this._extracted = true;
      this._extractionPhase = 'clearing';
      this._extractionTimer = 0;
      this.playSFX('extraction');
      this.addScore(2000);
      // Stop spawning new obstacles — clearing begins
    }

    this._emitter.update();
  };

  // ── Trail recording ──
  SkiFree.prototype._recordTrail = function () {
    this._playerTrail.push({ x: this._player.x, y: this._player.y });
    if (this._playerTrail.length > PLAYER_TRAIL_LEN) this._playerTrail.shift();
  };

  // ── Pursuer spawning ──
  SkiFree.prototype._spawnPursuer = function () {
    var W = this.logicalW, T = this._tileSize;
    var hp = 1 + Math.floor(this._distance / 2500);
    if (hp > 4) hp = 4;
    var S = this._entityScale;
    this._pursuers.push({
      x: W * 0.3 + Math.random() * W * 0.4,
      y: -T * 4,
      w: T * 0.9 * S, h: T * 1.0 * S,
      hp: hp, maxHp: hp,
      speed: 0.8 + Math.random() * 0.3,
      accel: 0.015 + this._pursuers.length * 0.005,
      dist: 10,
      trail: [],
      alive: true
    });
    this.playSFX('hit');
  };

  // ── Pursuer update ──
  SkiFree.prototype._updatePursuer = function (pur, idx) {
    if (!pur.alive) return;
    var T = this._tileSize;

    pur.x += (this._player.x - pur.x) * 0.025;
    pur.speed += pur.accel * 0.016;
    var approach = (pur.speed - this._speed * 0.8) * 0.5;
    if (this._tuck && this._speed > 3.0) approach *= 0.3;
    pur.dist -= approach * 0.016;

    var targetY = this._playerRestY - pur.dist * T;
    pur.y += (targetY - pur.y) * 0.08;

    pur.trail.push({ x: pur.x, y: pur.y });
    if (pur.trail.length > PURSUER_TRAIL_LEN) pur.trail.shift();

    if (pur.dist <= 0.3) {
      this._player.hp -= 20;
      this.playSFX('crash');
      this._crashTimer = 44;
      pur.dist = 3;
      this._emitter.burst(this._player.x, this._player.y, {
        emoji: EMOJI.crash, count: 1, speed: 0, life: 30
      });
      if (this._player.hp <= 0) {
        this._player.hp = 0;
        this.setState(ArcadeEngine.STATE.GAME_OVER);
      }
    }
  };

  // ── Kill pursuer ──
  SkiFree.prototype._killPursuer = function (idx) {
    var pur = this._pursuers[idx];
    this._killCount++;
    this.addScore(150);
    this.playSFX('kill');
    this._emitter.burst(pur.x, pur.y, { emoji: EMOJI.poof, count: 1, speed: 0, life: 35 });
    this._emitter.burst(pur.x, pur.y + 4, { emoji: '⬛', count: 1, speed: 0, life: 50 });
    this._pursuers.splice(idx, 1);
  };

  // ── Scroll terrain ──
  SkiFree.prototype._scrollTerrain = function (amt, H) {
    for (var i = this._obstacles.length - 1; i >= 0; i--) {
      this._obstacles[i].y -= amt;
      if (this._obstacles[i].y < -50) this._obstacles.splice(i, 1);
    }
    for (var ip = this._icePatches.length - 1; ip >= 0; ip--) {
      this._icePatches[ip].y -= amt;
      if (this._icePatches[ip].y < -50) this._icePatches.splice(ip, 1);
    }
    for (var j = this._intel.length - 1; j >= 0; j--) {
      this._intel[j].y -= amt;
      if (this._intel[j].y < -50) this._intel.splice(j, 1);
    }
    for (var fi = this._foodPickups.length - 1; fi >= 0; fi--) {
      this._foodPickups[fi].y -= amt;
      if (this._foodPickups[fi].y < -50) this._foodPickups.splice(fi, 1);
    }
    for (var t = 0; t < this._playerTrail.length; t++) {
      this._playerTrail[t].y -= amt;
    }
    for (var p = 0; p < this._pursuers.length; p++) {
      for (var pt = 0; pt < this._pursuers[p].trail.length; pt++) {
        this._pursuers[p].trail[pt].y -= amt;
      }
    }
  };

  // ── Obstacle spawning (via WeightedTable) ──
  SkiFree.prototype._spawnObstacleAt = function (y) {
    var W = this.logicalW, T = this._tileSize, margin = T * 2;
    var tpl = obstacleTable.pick();
    var obs = {
      x: margin + Math.random() * (W - margin * 2), y: y,
      w: T * tpl.w, h: T * tpl.h,
      emoji: tpl.emoji, damage: tpl.damage,
      breakable: tpl.breakable || false,
      zBlock: tpl.zBlock || false,
      nearMissed: false, drop: null
    };
    if (obs.breakable && Math.random() < 0.6) {
      obs.drop = Math.random() < 0.7 ? 'currency' : 'intel';
    }
    this._obstacles.push(obs);
  };

  // ── Collect drop from a breakable obstacle ──
  SkiFree.prototype._collectDrop = function (obs) {
    if (obs.drop === 'currency') {
      this.addScore(50);
      this._emitter.burst(obs.x, obs.y, { emoji: '+50', count: 1, speed: 0, life: 40, gravity: -0.3 });
    } else if (obs.drop === 'intel') {
      this._intelCount++; this.addScore(200);
      this._emitter.burst(obs.x, obs.y, { emoji: '+200', count: 1, speed: 0, life: 40, gravity: -0.3 });
    }
    this._emitter.burst(obs.x, obs.y, { emoji: EMOJI.poof, count: 1, speed: 0, life: 20 });
  };

  // ── Hit obstacle (player body collision) ──
  SkiFree.prototype._hitObstacle = function (obs, idx) {
    if (obs.emoji === EMOJI.tree || obs.emoji === EMOJI.snowFir) this._treeHit = true;
    this._player.hp -= obs.damage;
    this._crashTimer = obs.breakable ? 19 : 38;
    this._crashEmoji = EMOJI.crash;
    this._emitter.burst(obs.x, obs.y, { emoji: EMOJI.crash, count: 1, speed: 0, life: 25 });
    this.sfxMap['crash'] = 'crunch-' + (1 + Math.floor(Math.random() * 3));
    this.playSFX('crash');

    if (obs.breakable) {
      this._collectDrop(obs);
      this._obstacles.splice(idx, 1);
    }

    if (this._player.hp <= 0) { this._player.hp = 0; this.setState(ArcadeEngine.STATE.GAME_OVER); }
  };

  SkiFree.prototype._overlaps = function (a, b) {
    var s = 0.3;
    return (a.x - a.w * s) < (b.x + b.w * (1 - s)) &&
           (a.x + a.w * (1 - s)) > (b.x - b.w * s) &&
           (a.y - a.h * s) < (b.y + b.h * (1 - s)) &&
           (a.y + a.h * (1 - s)) > (b.y - b.h * s);
  };

  // ════════════════════════════════════════════════════════════
  // DRAW
  // ════════════════════════════════════════════════════════════

  SkiFree.prototype.onDraw = function (ctx, W, H) {
    var T = this._tileSize;
    var ph = this.colors.phosphor;
    var dim = this.colors.phosphorDim;
    var playerY = this._player.y;

    // ── Background: snow tracks scrolling upward ──
    ctx.strokeStyle = dim; ctx.lineWidth = 1; ctx.globalAlpha = 0.12;
    var trackOff = -(this._distance * 0.3) % 40;
    for (var t = 0; t < 8; t++) {
      var tx = (W / 8) * t + Math.sin(t + this._distance * 0.002) * 8;
      ctx.beginPath();
      ctx.moveTo(tx + Math.sin(this._distance * 0.001 + t) * 15, H);
      ctx.lineTo(tx, trackOff);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // ── Tree walls scrolling upward ──
    var wallTrees = ['🌲', '🎄', '🌲', '🎄', '🌲'];
    var wallSY = (this._distance * 0.8) % T;
    for (var wy = -T; wy < H + T * 2; wy += T) {
      var dY = wy + wallSY;
      if (dY < -T || dY > H + T) continue;
      var wob = Math.sin((wy + this._distance) * 0.05) * 3;
      var ti = Math.floor((wy + this._distance) / T);
      this.drawEmoji(ctx, wallTrees[Math.abs(ti) % 5], T * 0.5 + wob, H - dY, T * 0.9);
      this.drawEmoji(ctx, wallTrees[Math.abs(ti + 3) % 5], T * 1.3 + wob * 0.5, H - dY + T * 0.5, T * 0.7);
      this.drawEmoji(ctx, wallTrees[Math.abs(ti + 1) % 5], W - T * 0.5 - wob, H - dY, T * 0.9);
      this.drawEmoji(ctx, wallTrees[Math.abs(ti + 2) % 5], W - T * 1.3 - wob * 0.5, H - dY + T * 0.5, T * 0.7);
    }

    // ── Ice patches ──
    ctx.globalAlpha = 0.3; ctx.fillStyle = '#88ccff';
    for (var ip = 0; ip < this._icePatches.length; ip++) {
      var ice = this._icePatches[ip];
      ctx.beginPath(); ctx.ellipse(ice.x, ice.y, ice.w / 2, ice.h / 2, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ── Ski trails (grey, drawn before entities) ──
    this._drawTrail(ctx, this._playerTrail, 'rgba(180,180,180,', 2.0);
    for (var pt = 0; pt < this._pursuers.length; pt++) {
      this._drawTrail(ctx, this._pursuers[pt].trail, 'rgba(40,40,40,', 1.5);
    }

    // ── Z-ordered rendering ──
    var belowObs = [], aboveObs = [];
    var hideZone = T * 1.5;
    for (var oi = 0; oi < this._obstacles.length; oi++) {
      var ob = this._obstacles[oi];
      if (ob.zBlock && ob.y < playerY && ob.y > playerY - hideZone) {
        aboveObs.push(ob);
      } else {
        belowObs.push(ob);
      }
    }

    for (var bi = 0; bi < belowObs.length; bi++) {
      this.drawEmoji(ctx, belowObs[bi].emoji, belowObs[bi].x, belowObs[bi].y, T * 0.9, { glow: true });
    }

    // ── Intel pickups ──
    for (var ji = 0; ji < this._intel.length; ji++) {
      var pk = this._intel[ji];
      var bob = Math.sin(Date.now() * 0.005 + ji) * 3;
      this.drawEmoji(ctx, pk.emoji, pk.x, pk.y + bob, T * 0.25, { glow: true, glowColor: this.colors.amber });
    }

    // ── Food / HP recovery pickups ──
    for (var fdi = 0; fdi < this._foodPickups.length; fdi++) {
      var fd = this._foodPickups[fdi];
      var fbob = Math.sin(Date.now() * 0.004 + fdi * 2) * 4;
      this.drawEmoji(ctx, fd.emoji, fd.x, fd.y + fbob, T * 0.25, { glow: true, glowColor: '#FF6B9D' });
    }

    // ── Projectiles (via ProjectileSystem) ──
    this._bullets.draw(ctx, { size: PROJECTILE_SIZE });

    // ── Pursuers (⛷️ with dark overlay) ──
    for (var pui = 0; pui < this._pursuers.length; pui++) {
      var pur = this._pursuers[pui];
      if (pur.y < -T * 2) continue;
      ctx.save();
      var purSize = T * this._entityScale;
      this.drawEmoji(ctx, EMOJI.player, pur.x, pur.y, purSize);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(15,15,15,0.75)';
      ctx.fillRect(pur.x - purSize * 0.6, pur.y - purSize * 0.6, purSize * 1.2, purSize * 1.2);
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
      if (pur.maxHp > 1) {
        for (var hp = 0; hp < pur.hp; hp++) {
          ctx.fillStyle = '#ff4757';
          ctx.fillRect(pur.x - pur.maxHp * 2 + hp * 4, pur.y - T * 0.7, 3, 3);
        }
      }
    }

    // ── Player (⛷️ with carving animation) ──
    if (this._crashTimer > 0 && this._crashTimer % 4 < 2) {
      // Blink during stun
    } else {
      ctx.save();
      ctx.translate(this._player.x, this._player.y);
      var dir = this._steerX;
      var flipX = dir > 0.1 ? -1 : 1;
      var turnIntensity = Math.abs(dir);
      var narrowFactor = 1.0 - turnIntensity * 0.35 * (0.5 + 0.5 * Math.sin(Date.now() * 0.008));
      ctx.scale(flipX * narrowFactor, 1);
      ctx.rotate(dir * 0.15);
      ctx.font = Math.floor(T * this._entityScale) + 'px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (this.colors.phosphor) { ctx.shadowColor = this.colors.phosphor; ctx.shadowBlur = 8; }
      ctx.fillText(EMOJI.player, 0, 0);
      ctx.restore();
    }

    // ── Draw above-layer obstacles (trees player can hide behind) ──
    for (var ai = 0; ai < aboveObs.length; ai++) {
      this.drawEmoji(ctx, aboveObs[ai].emoji, aboveObs[ai].x, aboveObs[ai].y, T * 0.9, { glow: true });
    }

    // ── Crash emoji ──
    if (this._crashEmoji && this._crashTimer > 0) {
      this.drawEmoji(ctx, this._crashEmoji, this._player.x, this._player.y + T,
        T * 0.8, { alpha: this._crashTimer / 30 });
    }

    // ── Particles (via ParticleEmitter) ──
    this._drawParticles(ctx, T);

    // ── Snow spray ──
    if (this._speed > 2.5 && this._crashTimer <= 0 && this._introComplete) {
      ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.4;
      for (var sp = 0; sp < 3; sp++) {
        ctx.fillRect(this._player.x + (Math.random() - 0.5) * T,
          this._player.y - T * 0.5 - Math.random() * T * 0.3, 2, 2);
      }
      ctx.globalAlpha = 1;
    }

    // ── Enforcer proximity vignette ──
    var closestPurDist = 999;
    for (var cv = 0; cv < this._pursuers.length; cv++) {
      if (this._pursuers[cv].dist < closestPurDist) closestPurDist = this._pursuers[cv].dist;
    }
    if (closestPurDist < 3) {
      ctx.save();
      ctx.globalAlpha = 0.12 + Math.sin(Date.now() * 0.01) * 0.08;
      ctx.fillStyle = '#ff4757'; ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // ════════════ HUD ════════════

    var bW = 80, bH = 6, bX = 8, bY = 6;
    ctx.fillStyle = '#333'; ctx.fillRect(bX, bY, bW, bH);
    var hpP = this._player.hp / 100;
    ctx.fillStyle = hpP > 0.5 ? ph : hpP > 0.25 ? this.colors.amber : this.colors.red;
    ctx.fillRect(bX, bY, bW * hpP, bH);
    ctx.strokeStyle = ph; ctx.lineWidth = 0.5; ctx.strokeRect(bX, bY, bW, bH);

    this.drawText(ctx, 'DIST: ' + Math.floor(this._distance) + 'm', bX, bY + bH + 12, 10, ph);
    this.drawText(ctx, 'SPD: ' + this._speed.toFixed(1), bX + 100, bY + bH + 12, 10, dim);

    if (this._intelCount > 0) this.drawText(ctx, EMOJI.intel + ' ×' + this._intelCount, W - 8, 14, 10, this.colors.amber, 'right');
    if (this._killCount > 0) this.drawText(ctx, '☠ ×' + this._killCount, W - 8, 26, 10, dim, 'right');

    // Near-miss combo
    if (this._nearMissTimer > 0 && this._nearMissCombo > 0) {
      ctx.save(); ctx.globalAlpha = this._nearMissTimer / 45;
      this.drawText(ctx, 'NEAR MISS ×' + this._nearMissCombo, W / 2, H * 0.55, 14, this.colors.amber, 'center');
      ctx.restore();
    }

    // Section flash (via DifficultyRamp)
    if (this._sectionFlash > 0 && difficultyRamp.sectionName()) {
      ctx.save(); ctx.globalAlpha = Math.min(1, this._sectionFlash / 40);
      this.drawText(ctx, '— ' + difficultyRamp.sectionName().toUpperCase() + ' —', W / 2, H * 0.15, 16, ph, 'center');
      ctx.restore();
    }

    // Intro text
    if (!this._introComplete) {
      ctx.save(); ctx.globalAlpha = Math.min(1, this._introTimer / 30);
      this.drawText(ctx, '— SCHWEITZER DESCENT —', W / 2, H * 0.55, 14, ph, 'center');
      this.drawText(ctx, 'INITIATING DROP...', W / 2, H * 0.62, 10, dim, 'center');
      ctx.restore();
    }

    // Pursuer warning
    if (closestPurDist < 3) {
      ctx.save(); ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.015) * 0.5;
      this.drawText(ctx, EMOJI.warning + ' PURSUER CLOSING', W / 2, H * 0.88, 12, this.colors.red, 'center');
      ctx.restore();
    }

    // Extraction progress
    if (this._distance > this._extractionDist * 0.5) {
      var eP = Math.min(1, this._distance / this._extractionDist);
      var eBW = W * 0.6, eBX = (W - eBW) / 2, eBY = H - 14;
      ctx.fillStyle = '#222'; ctx.fillRect(eBX, eBY, eBW, 4);
      ctx.fillStyle = ph; ctx.fillRect(eBX, eBY, eBW * eP, 4);
      this.drawText(ctx, EMOJI.motorcycle, eBX + eBW + 6, eBY + 2, 10);
    }

    // ── Extraction / Victory sequence (multi-phase) ──
    if (this._extracted) {
      var et = this._extractionTimer;
      var phase = this._extractionPhase;
      var cx = W / 2;
      var motoY = this._motoY || H * 0.7;

      ctx.save();

      if (phase === 'clearing') {
        // Subtle "opening" feel — darken edges
        var clearAlpha = Math.min(0.2, et * 0.003);
        ctx.fillStyle = 'rgba(0,0,0,' + clearAlpha + ')';
        ctx.fillRect(0, 0, W, H);
        // "EXTRACTION ZONE" text fades in
        if (et > 30) {
          ctx.globalAlpha = Math.min(1, (et - 30) / 40);
          this.drawText(ctx, '— EXTRACTION ZONE —', cx, H * 0.12, 14, this.colors.amber, 'center');
          ctx.globalAlpha = 1;
        }
      }

      else if (phase === 'approach') {
        // Motorcycle in clearing, player approaching
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(0, 0, W, H);
        // Draw motorcycle waiting in clearing with glow pulse
        var motoPulse = 1.0 + Math.sin(et * 0.1) * 0.1;
        this.drawEmoji(ctx, EMOJI.motorcycle, this._motoX, motoY, T * 1.5 * motoPulse, { glow: true, glowColor: this.colors.amber });
        // Draw approach text
        this.drawText(ctx, 'EXTRACTION POINT', cx, H * 0.12, 14, this.colors.amber, 'center');
        // Pursuer sweep flash
        if (this._pursuers.length > 0) {
          ctx.globalAlpha = 0.4 + Math.sin(et * 0.15) * 0.3;
          this.drawText(ctx, 'CLEARING PURSUERS...', cx, H * 0.20, 10, this.colors.red, 'center');
          ctx.globalAlpha = 1;
        }
      }

      else if (phase === 'mount') {
        // Merge animation
        ctx.fillStyle = 'rgba(0,0,0,' + Math.min(0.5, et * 0.01) + ')';
        ctx.fillRect(0, 0, W, H);

        if (et < 20) {
          // Player and motorcycle converging
          this.drawEmoji(ctx, EMOJI.motorcycle, this._motoX, motoY, T * 1.5, { glow: true });
        } else if (et < 35) {
          // Poof — transformation
          var poofAlpha = 1 - (et - 20) / 15;
          this.drawEmoji(ctx, EMOJI.poof, this._motoX, motoY, T * 2.5, { alpha: poofAlpha, glow: true });
        } else {
          // Two motorcycles appear
          var spread = Math.min(T * 1.2, (et - 35) * 2);
          this.drawEmoji(ctx, EMOJI.motorcycle, cx - spread, motoY, T * 1.3, { glow: true });
          this.drawEmoji(ctx, EMOJI.motorcycle, cx + spread, motoY, T * 1.3, { glow: true });
        }
      }

      else if (phase === 'rideoff') {
        // Darkening backdrop + motorcycles riding upward + stats
        var fadeIn = Math.min(0.7, et * 0.01);
        ctx.fillStyle = 'rgba(0,0,0,' + fadeIn + ')';
        ctx.fillRect(0, 0, W, H);

        var rideOffset = et * 3.5;
        var rY = motoY - rideOffset;
        this.drawEmoji(ctx, EMOJI.motorcycle, cx - T * 1.2, rY, T * 1.3, { glow: true });
        this.drawEmoji(ctx, EMOJI.motorcycle, cx + T * 1.2, rY, T * 1.3, { glow: true });

        // Stats fade in after a beat
        if (et > 25) {
          ctx.globalAlpha = Math.min(1, (et - 25) / 30);
          this.drawText(ctx, 'EXTRACTED', cx, H * 0.3, 22, this.colors.phosphorBright, 'center');
          this.drawText(ctx, Math.floor(this._distance) + 'm  |  ' + this._killCount + ' PURSUERS FELLED',
                        cx, H * 0.42, 12, ph, 'center');
          if (this._intelCount > 0) {
            this.drawText(ctx, 'INTEL: ' + this._intelCount, cx, H * 0.50, 12, this.colors.amber, 'center');
          }
          if (!this._treeHit) {
            this.drawText(ctx, '★ PERFECT DESCENT ★', cx, H * 0.58, 14, this.colors.amber, 'center');
          }
          this.drawText(ctx, 'LEVEL ' + this.level + ' COMPLETE', cx, H * 0.70, 14, this.colors.phosphorDim, 'center');
          ctx.globalAlpha = 1;
        }
      }

      ctx.restore();
    }
  };

  // ── Draw particles with text/emoji rendering via ArcadeEngine ──
  // ParticleEmitter stores emoji strings; we render them using drawEmoji/drawText
  // instead of the emitter's generic draw() which doesn't know about ArcadeEngine's API.
  SkiFree.prototype._drawParticles = function (ctx, T) {
    var particles = this._emitter.getParticles();
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (!p.alive) continue;
      var alpha = p.life / p.maxLife;
      if (p.emoji && p.emoji.length <= 2) {
        this.drawEmoji(ctx, p.emoji, p.x, p.y, T * 0.6, { alpha: alpha });
      } else if (p.emoji) {
        ctx.save(); ctx.globalAlpha = alpha;
        this.drawText(ctx, p.emoji, p.x, p.y, 11, this.colors.amber, 'center');
        ctx.restore();
      }
    }
  };

  // ── Draw a trail as a gradient line ──
  SkiFree.prototype._drawTrail = function (ctx, trail, rgbaBase, width) {
    if (trail.length < 2) return;
    ctx.lineWidth = width; ctx.lineCap = 'round';
    for (var i = 1; i < trail.length; i++) {
      var alpha = (i / trail.length) * 0.35;
      ctx.strokeStyle = rgbaBase + alpha + ')';
      ctx.beginPath();
      ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx.lineTo(trail[i].x, trail[i].y);
      ctx.stroke();
    }
  };

  // ════════════════════════════════════════════════════════════
  // BOSS ADAPTER
  // ════════════════════════════════════════════════════════════

  SkiFree.prototype.onBossMount = function (combatState) {
    this._resetState();
    if (combatState && combatState.playerHP) this._player.hp = Math.min(100, combatState.playerHP);
    this._extractionDist = 5000;
    this._introComplete = true;
    this._player.y = this._playerRestY;
    this._spawnPursuer();
  };

  SkiFree.prototype.onBossUnmount = function () {
    return {
      loot: this._intelCount > 0 ? { intel: this._intelCount } : null,
      mythic: !this._treeHit && this._extracted
    };
  };

  SkiFree.prototype.onGetHazards = function () {
    var hazards = [];
    for (var i = 0; i < this._obstacles.length; i++) {
      var o = this._obstacles[i];
      hazards.push({ x: o.x - o.w / 2, y: o.y - o.h / 2, w: o.w, h: o.h, damage: o.damage });
    }
    for (var p = 0; p < this._pursuers.length; p++) {
      var pur2 = this._pursuers[p];
      hazards.push({ x: pur2.x - pur2.w / 2, y: pur2.y - pur2.h / 2, w: pur2.w, h: pur2.h, damage: 20 });
    }
    return hazards;
  };

  SkiFree.prototype.onMythicCheck = function () {
    return !this._treeHit && this._extracted;
  };

  // ── Singleton ──
  var instance = new SkiFree();

  if (typeof BossFloorRegistry !== 'undefined' && BossFloorRegistry.registerMinigame) {
    BossFloorRegistry.registerMinigame('overlord', {
      id: 'ski-free', name: 'Infiltration Descent',
      init: function (ctx) { instance.onBossMount(ctx); },
      tick: function () { instance.updateRealTime(16); },
      render: function () {},
      isComplete: function () { return instance._extracted || instance._player.hp <= 0; },
      getResult: function () { return instance.unmount(); }
    });
  }

  return instance.asMinigame();
})();
