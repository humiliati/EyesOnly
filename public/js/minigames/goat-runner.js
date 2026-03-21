/* ============================================================
   GOAT RUNNER — ArcadeEngine subclass
   Side-scrolling rooftop platformer with ceiling-grapple and
   vault mechanics + goat followers.
   Uses Phase 3 genre helper modules:
     - SideScrollCamera  (viewport, shake, parallax)
     - PlatformPhysics   (gravity, jump, collision)
     - ParticleEmitter   (burst/stream effects)
   ============================================================ */
(function () {
  'use strict';

  /* ── Tile unit (scales with canvas) ── */
  var BASE_T = 28;

  /* ── Ceiling grapple constants ── */
  var GRAPPLE_RANGE      = 130;    // max distance to latch onto a grapple point
  var GRAPPLE_DURATION   = 32;     // frames of brake effect
  var GRAPPLE_BRAKE      = 0.25;   // vy multiplier while grappled
  var GRAPPLE_FORWARD    = 0.6;    // vx boost while grappled
  var GRAPPLE_CEILING_Y  = 0.08;   // grapple Y as fraction of screen height

  /* ── Terrain generation ── */
  var MIN_PLAT_W  = 120;
  var MAX_PLAT_W  = 320;
  var MIN_GAP     = 40;
  var MAX_GAP     = 140;
  var PLAT_H      = 14;
  var SPAWN_AHEAD = 800;

  /* ── Goat followers ── */
  var GOAT_COUNT      = 5;
  var POS_HISTORY_LEN = 300;
  var GOAT_SPACING    = 35;

  /* ── Parallax layers ── */
  var PARALLAX = [
    { speed: 0.05, y: 0.50, color: 'rgba(28,255,155,0.04)' },
    { speed: 0.12, y: 0.45, color: 'rgba(28,255,155,0.06)' },
    { speed: 0.22, y: 0.40, color: 'rgba(28,255,155,0.09)' }
  ];

  /* ── Obstacle types ── */
  var OBS_DISH  = 'dish';
  var OBS_AC    = 'ac';
  var OBS_LASER = 'laser';

  /* ── Weighted obstacle table (via WeightedTable module) ── */
  var obstacleTable = new WeightedTable([
    { type: OBS_DISH,  weight: 40, wMul: 0.7,  hMul: 0.7,  hp: -1, emoji: '📡' },
    { type: OBS_AC,    weight: 35, wMul: 0.6,  hMul: 0.6,  hp:  1, emoji: '📦' },
    { type: OBS_LASER, weight: 25, wMul: 1.5,  hMul: 0.15, hp: -1, emoji: '⚡' }
  ]);

  /* ── Difficulty ramp (via DifficultyRamp module) ── */
  var difficultyRamp = new DifficultyRamp({
    metric: 'distance',
    range: [0, 6000],
    sections: [
      { name: 'Rooftops',        at: 0,    obstChance: 0.20, droneChance: 0.000, gapMul: 0.5, platShrink: 0.0 },
      { name: 'District Edge',   at: 800,  obstChance: 0.35, droneChance: 0.001, gapMul: 0.6, platShrink: 0.1 },
      { name: 'Contested Zone',  at: 2000, obstChance: 0.50, droneChance: 0.004, gapMul: 0.7, platShrink: 0.2 },
      { name: 'Drone Corridor',  at: 3500, obstChance: 0.65, droneChance: 0.008, gapMul: 0.9, platShrink: 0.35 },
      { name: 'Extraction Run',  at: 4800, obstChance: 0.40, droneChance: 0.003, gapMul: 0.7, platShrink: 0.2 }
    ]
  });

  // ──────────────────────────────────────────────────────────
  // CONSTRUCTOR
  // ──────────────────────────────────────────────────────────

  function GoatRunner() {
    ArcadeEngine.call(this, {
      gameId: 'goat-runner',
      title:  'Goat Runner',
      lives:  3,
      currencyRate: 0.015
    });

    this.sfxMap = {
      'hop':        'drop-1',
      'hit':        'hit-1',
      'death':      'kitty-1',
      'game-over':  'game-over-1',
      'collect':    'coin-2',
      'explosion':  'metal-hit-1',
      'shoot':      'drop-1',
      'drone-kill': 'metal-hit-1',
      'game-start': 'power-up-1'
    };

    // Pre-init all state so onDraw never reads undefined
    // (onDraw fires during MENU state before onStart runs)
    this._T = BASE_T;

    // Genre modules — constructed with defaults, reconfigured in onStart
    this._cam = new SideScrollCamera(400, 300, {
      speed: 2.2, maxSpeed: 5.5, accel: 0.00004, parallax: PARALLAX
    });
    this._physics = new PlatformPhysics({
      gravity: 0.48, maxFallSpeed: 12,
      jumpForce: -9.0, doubleJumpForce: -7.0,
      friction: 0.08, nudgeSpeed: 0.8
    });
    this._emitter = new ParticleEmitter(300);

    // Player projectiles (tap-to-aim counter-fire)
    this._bullets = new ProjectileSystem({
      speed: 10, range: 800, cooldown: 14, trailLength: 6
    });

    // Drone projectiles (enemy fire — slower, no cooldown)
    this._droneBullets = new ProjectileSystem({
      speed: 4, range: 600, cooldown: 0, trailLength: 0, maxActive: 20
    });

    // Screen effects (flash, vignette, fade)
    this._screenFX = new ScreenFX();

    // Loot drops (physics scatter + collect)
    this._loot = new LootDrop(30);

    this._player = { x: 0, y: 0, vx: 0, vy: 0, w: 20, h: 24, grounded: false, canDoubleJump: true, ducking: false, invulnTimer: 0, facingRight: true };
    this._grapplers = [];
    this._grapple = { active: false, target: null, timer: 0 };
    this._goats = [];
    this._posHistory = [];
    this._posHistoryIdx = 0;
    this._platforms = [];
    this._obstacles = [];
    this._collectibles = [];
    this._enemies = [];
    this._distance = 0;
    this._intelCount = 0;
    this._killCount = 0;
    this._sectionFlash = 0;
    this._inputBuffer = { vaultPending: false, timer: 0 };
    this._strikeAvailable = true;
    this._strikeCooldown = 0;
    this._tutorialPhase = 0;
    this._tutorialTimer = 0;
    this._nextPlatX = 0;

    // Extraction helicopter + victory
    this._helicopter = null;     // { x, y, bobTimer }
    this._victoryPhase = 0;      // 0=none, 1=heli approaching, 2=boarding, 3=flying away
    this._victoryTimer = 0;
  }

  GoatRunner.prototype = Object.create(ArcadeEngine.prototype);
  GoatRunner.prototype.constructor = GoatRunner;

  // ──────────────────────────────────────────────────────────
  // LIFECYCLE: onStart
  // ──────────────────────────────────────────────────────────

  GoatRunner.prototype.onStart = function () {
    var W = this.logicalW;
    var H = this.logicalH;
    var T = Math.max(20, Math.min(BASE_T, W / 18));
    this._T = T;

    // Reset genre modules
    this._cam.resize(W, H);
    this._cam.reset();
    this._emitter.clear();
    this._bullets.clear();
    this._droneBullets.clear();
    this._screenFX.clear();
    this._loot.clear();
    difficultyRamp.reset();

    // Player
    this._player = {
      x: W * 0.25, y: H * 0.5, vx: 0, vy: 0,
      w: T * 0.8, h: T * 1.0,
      grounded: false, canDoubleJump: true,
      ducking: false, invulnTimer: 0, facingRight: true
    };

    // Ceiling grapple
    this._grapplers = [];
    this._grapple = { active: false, target: null, timer: 0 };
    this._inputBuffer = { vaultPending: false, timer: 0 };
    this._strikeAvailable = true;
    this._strikeCooldown = 0;

    // Terrain
    this._platforms = [];
    this._nextPlatX = 0;
    this._seedInitialPlatforms(W, H);

    // Entities
    this._obstacles = [];
    this._collectibles = [];
    this._enemies = [];

    // Goats
    this._goats = [];
    this._posHistory = [];
    this._posHistoryIdx = 0;
    for (var i = 0; i < POS_HISTORY_LEN; i++) {
      this._posHistory.push({ x: this._player.x + this._cam.x, y: this._player.y });
    }
    for (var g = 0; g < GOAT_COUNT; g++) {
      this._goats.push({
        x: this._player.x - (g + 1) * 15,
        y: this._player.y,
        delay: (g + 1) * GOAT_SPACING,
        alive: true
      });
    }

    // Progress
    this._distance = 0;
    this._intelCount = 0;
    this._killCount = 0;
    this._sectionFlash = 0;
    this._tutorialPhase = 0;
    this._tutorialTimer = 0;

    // Extraction helicopter
    this._helicopter = null;
    this._victoryPhase = 0;
    this._victoryTimer = 0;
  };

  // ──────────────────────────────────────────────────────────
  // PLATFORM GENERATION
  // ──────────────────────────────────────────────────────────

  GoatRunner.prototype._seedInitialPlatforms = function (W, H) {
    var groundY = Math.round(H * 0.65);
    // Wide starting platform so player has room on launch
    var startW = Math.max(W * 0.7, 350);
    this._platforms.push({ x: -50, y: groundY, w: startW, h: PLAT_H });
    this._player.x = W * 0.25;
    this._player.y = groundY - this._player.h;
    this._player.vy = 0;
    this._player.grounded = true;
    this._nextPlatX = startW - 50;
    this._generatePlatforms(W, H);
  };

  GoatRunner.prototype._generatePlatforms = function (W, H) {
    var cameraRight = this._cam.x + W + SPAWN_AHEAD;
    var gapMul = difficultyRamp.get('gapMul', 0.5);
    var platShrink = difficultyRamp.get('platShrink', 0);
    var obstChance = difficultyRamp.get('obstChance', 0.2);
    var t = difficultyRamp.t();

    while (this._nextPlatX < cameraRight) {
      var gap = MIN_GAP + Math.random() * (MAX_GAP - MIN_GAP) * gapMul;
      var platW = MIN_PLAT_W + Math.random() * (MAX_PLAT_W - MIN_PLAT_W) * (1 - platShrink);
      var prevPlat = this._platforms[this._platforms.length - 1];
      var prevY = prevPlat ? prevPlat.y : H * 0.65;

      var yShift = (Math.random() - 0.4) * 60 * (0.5 + t);
      var newY = Math.max(H * 0.3, Math.min(H * 0.8, prevY + yShift));

      var platX = this._nextPlatX + gap;
      this._platforms.push({ x: platX, y: newY, w: platW, h: PLAT_H });

      // Ceiling grapple point between this gap (most gaps get one)
      if (gap > 50 && Math.random() < 0.85) {
        var gpX = this._nextPlatX + gap * 0.5;
        var gpY = H * GRAPPLE_CEILING_Y + Math.random() * H * 0.08;
        this._grapplers.push({ x: gpX, y: gpY, used: false });
      }

      // Obstacles (via DifficultyRamp obstChance + WeightedTable)
      if (Math.random() < obstChance && platW > 150) {
        this._spawnObstacle(platX, newY, platW);
      }
      // Double obstacle on wider platforms at high difficulty
      if (t > 0.6 && Math.random() < (obstChance * 0.3) && platW > 250) {
        this._spawnObstacle(platX, newY, platW);
      }

      if (Math.random() < 0.3) {
        this._collectibles.push({
          x: platX + platW * 0.5, y: newY - this._T * 1.5,
          type: Math.random() < 0.3 ? 'intel' : 'coin', collected: false
        });
      }
      this._nextPlatX = platX + platW;
    }
  };

  GoatRunner.prototype._spawnObstacle = function (platX, platY, platW) {
    var T = this._T;
    var tpl = obstacleTable.pick();
    var w = T * tpl.wMul;
    var h = T * tpl.hMul;
    var ox = platX + 40 + Math.random() * Math.max(0, platW - 80);

    this._obstacles.push({
      x: ox, y: platY - h, w: w, h: h,
      type: tpl.type, hp: tpl.hp, active: true, blinkTimer: 0
    });
  };

  // ──────────────────────────────────────────────────────────
  // INPUT
  // ──────────────────────────────────────────────────────────

  GoatRunner.prototype.onInput = function (type, data) {
    var p = this._player;

    // Tap / dragstart both trigger vault (uniform mobile + desktop)
    if (type === 'tap' || type === 'dragstart') {
      this._doVault();
      return;
    }

    if (type === 'doubletap') {
      if (this._strikeAvailable) { this._doPoleStrike(); }
      else { this._doVault(); }
      return;
    }

    // Drag and dragend are no-ops now (tether removed)
    if (type === 'drag' || type === 'dragend') return;

    if (type === 'keyaction') {
      if (data.action === 'up' || data.action === 'action') this._doVault();
      if (data.action === 'down') p.ducking = true;
    }
  };

  GoatRunner.prototype._doVault = function () {
    var p = this._player;

    // Ground jump
    if (p.grounded) {
      if (this._physics.tryJump(p)) this.playSFX('hop');
      return;
    }

    // Air: try double jump first
    if (p.canDoubleJump) {
      if (this._physics.tryJump(p)) this.playSFX('hop');
      return;
    }

    // Air + no double jump: try ceiling grapple
    if (!this._grapple.active) {
      this._tryGrapple();
    }
  };

  // ── Ceiling grapple: latch onto nearest anchor point ──
  GoatRunner.prototype._tryGrapple = function () {
    var p = this._player;
    var cam = this._cam;
    var playerWX = p.x + cam.x + p.w / 2;
    var playerWY = p.y + p.h / 2;
    var bestDist = GRAPPLE_RANGE;
    var best = null;

    for (var i = 0; i < this._grapplers.length; i++) {
      var gp = this._grapplers[i];
      if (gp.used) continue;
      var dist = Math.hypot(gp.x - playerWX, gp.y - playerWY);
      if (dist < bestDist) { bestDist = dist; best = gp; }
    }

    if (best) {
      best.used = true;
      this._grapple = { active: true, target: best, timer: GRAPPLE_DURATION };
      p.vy = Math.min(p.vy, -1.5);   // arrest fall with slight upward pull
      this.playSFX('hop');
      this._emitter.burst(best.x, best.y, {
        emoji: '⚡', count: 5, speed: 2, life: 18, gravity: 0
      });
    }
  };

  GoatRunner.prototype._doPoleStrike = function () {
    this._strikeAvailable = false;
    this._strikeCooldown = 300;

    var p = this._player;
    var cx = p.x + this._cam.x;
    var cy = p.y + p.h * 0.5;
    var radius = this._T * 3;

    // Particle burst via ParticleEmitter
    this._emitter.burst(cx, cy, {
      emoji: '⚡', count: 12, speed: 4, life: 30, gravity: 0
    });

    // Push enemies (melee AoE)
    for (var e = 0; e < this._enemies.length; e++) {
      var en = this._enemies[e];
      if (Math.hypot(en.x - cx, en.y - cy) < radius) {
        en.hp--;
        if (en.hp <= 0) {
          this._loot.scatter(en.x, en.y, [
            { emoji: '🪙', value: 100, type: 'coin' },
            { emoji: '🪙', value: 100, type: 'coin' },
            { emoji: '💼', value: 300, type: 'intel' }
          ]);
          this._enemies.splice(e, 1); e--;
          this.addScore(500);
          this._killCount++;
          this.playSFX('drone-kill');
        }
      }
    }

    // Fire a bullet at the nearest drone (counter-fire)
    if (this._enemies.length > 0 && this._bullets.canFire()) {
      var nearest = null, nearDist = Infinity;
      for (var ne = 0; ne < this._enemies.length; ne++) {
        var ned = Math.hypot(this._enemies[ne].x - cx, this._enemies[ne].y - cy);
        if (ned < nearDist) { nearDist = ned; nearest = this._enemies[ne]; }
      }
      if (nearest) {
        var cam = this._cam;
        this._bullets.fireAt(p.x + p.w / 2, p.y + p.h / 2, cam.toScreen(nearest.x), nearest.y);
        this.playSFX('shoot');
      }
    }

    this._cam.shake(15, 6);
    this.playSFX('explosion');
  };

  // ──────────────────────────────────────────────────────────
  // UPDATE
  // ──────────────────────────────────────────────────────────

  GoatRunner.prototype.onUpdate = function (dt) {
    var p = this._player;
    var cam = this._cam;
    var phys = this._physics;
    var T = this._T;
    var W = this.logicalW;
    var H = this.logicalH;

    // During victory boarding/flyaway, skip normal gameplay — only update heli + particles + fx
    if (this._victoryPhase >= 2) {
      this._emitter.update();
      this._screenFX.update();
      this._updateHelicopter(W, H);
      cam.update(this._distance);
      return;
    }

    // Distance + difficulty
    this._distance += cam.speed;
    difficultyRamp.update(this._distance);
    if (difficultyRamp.sectionChanged()) {
      this._sectionFlash = 120;
      this.playSFX('game-start');  // section transition fanfare
      this._cam.shake(6, 3);
      this._screenFX.flash('#ffaa00', 10, 0.2);  // amber section flash
    }
    if (this._sectionFlash > 0) this._sectionFlash--;
    this.score = Math.floor(this._distance);

    // Camera scroll (SideScrollCamera handles speed ramp + shake)
    cam.update(this._distance);

    // Gravity (PlatformPhysics)
    phys.applyGravity(p);

    // Ceiling grapple physics — brake fall + forward push
    if (this._grapple.active) {
      this._grapple.timer--;
      p.vy *= GRAPPLE_BRAKE;                        // dramatically slow descent
      p.vx = _lerp(p.vx, cam.speed + GRAPPLE_FORWARD, 0.15);  // push forward
      if (this._grapple.timer <= 0 || p.grounded) {
        this._grapple.active = false;
      }
    }

    // Keyboard nudge (PlatformPhysics)
    var nudgeDir = 0;
    if (this.isKeyHeld('left'))  nudgeDir -= 1;
    if (this.isKeyHeld('right')) nudgeDir += 1;
    phys.nudge(p, nudgeDir);
    p.ducking = this.isKeyHeld('down');

    // Track facing direction (default right for side-scroller)
    if (nudgeDir < 0) p.facingRight = false;
    else if (nudgeDir > 0 || p.vx > 0.5) p.facingRight = true;

    // Integrate movement (PlatformPhysics)
    phys.integrate(p);

    // Clamp to screen (PlatformPhysics)
    phys.clampToScreen(p, 20, W * 0.7);

    // Friction (PlatformPhysics)
    phys.applyFriction(p, 0);

    // Track pre-collision fall speed for landing effects
    var preLandVy = p.vy;
    var wasAirborne = !p.grounded;

    // Platform collision (PlatformPhysics)
    phys.collidePlatforms(p, this._platforms, cam.x);

    // Landing particle burst (big falls)
    if (wasAirborne && p.grounded && preLandVy > 6) {
      var landIntensity = Math.min(8, Math.floor(preLandVy - 4));
      this._emitter.burst(p.x + cam.x + p.w / 2, p.y + p.h, {
        emoji: '💨', count: landIntensity, speed: 2, life: 15, gravity: 0.1
      });
      if (preLandVy > 9) this._cam.shake(4, 2);
    }

    // Fell off screen
    if (phys.isFallenOff(p, H)) {
      this._playerDeath();
      return;
    }

    // Obstacle collision
    if (p.invulnTimer > 0) {
      p.invulnTimer--;
    } else {
      for (var o = 0; o < this._obstacles.length; o++) {
        var obs = this._obstacles[o];
        if (!obs.active) continue;
        if (obs.type === OBS_LASER && obs.blinkTimer > 45) continue;

        var osx = obs.x - cam.x;
        if (PlatformPhysics.collideAABB(
          { x: p.x, y: p.y, w: p.w, h: p.ducking ? p.h * 0.5 : p.h },
          { x: osx, y: obs.y, w: obs.w, h: obs.h }
        )) {
          if (obs.type === OBS_AC && obs.hp > 0) {
            obs.hp--;
            if (obs.hp <= 0) {
              obs.active = false;
              this.addScore(100);
              this._emitter.burst(obs.x, obs.y, { emoji: '💥', count: 5, speed: 3, life: 20 });
              this._screenFX.flash('#ff8800', 4, 0.15); // orange break flash
              // Scatter loot from destroyed AC unit
              var acLoot = [{ emoji: '🪙', value: 50, type: 'coin' }];
              if (Math.random() < 0.4) acLoot.push({ emoji: '💼', value: 200, type: 'intel' });
              if (Math.random() < 0.25) acLoot.push({ emoji: '🪙', value: 50, type: 'coin' });
              this._loot.scatter(obs.x, obs.y, acLoot);
            }
          } else {
            this._playerHit();
          }
        }
      }
    }

    // Collectible pickup
    for (var c = 0; c < this._collectibles.length; c++) {
      var col = this._collectibles[c];
      if (col.collected) continue;
      var csx = col.x - cam.x;
      if (Math.abs(p.x + p.w / 2 - csx) < T && Math.abs(p.y + p.h / 2 - col.y) < T) {
        col.collected = true;
        if (col.type === 'intel') {
          this._intelCount++;
          this.addScore(200);
          this._emitter.burst(col.x, col.y, { emoji: '💼', count: 3, speed: 2, life: 20 });
        } else {
          this.addScore(50);
          this._emitter.burst(col.x, col.y, { emoji: '✨', count: 3, speed: 2, life: 18 });
        }
        this.playSFX('collect');
      }
    }

    // Laser blink
    for (var lo = 0; lo < this._obstacles.length; lo++) {
      if (this._obstacles[lo].type === OBS_LASER) {
        this._obstacles[lo].blinkTimer = (this._obstacles[lo].blinkTimer + 1) % 90;
      }
    }

    // Enemy spawning
    if (this._distance > 500 && this._enemies.length === 0 && Math.random() < difficultyRamp.get('droneChance', 0)) {
      this._enemies.push({ x: cam.x + W + 50, y: H * 0.15, type: 'drone', hp: 3, fireTimer: 120 });
    }

    // Enemy AI
    for (var ei = 0; ei < this._enemies.length; ei++) {
      var en = this._enemies[ei];
      en.x = _lerp(en.x, p.x + cam.x, 0.02);
      en.fireTimer--;
      if (en.fireTimer <= 0) {
        en.fireTimer = 100 + Math.floor(Math.random() * 40);
        this._droneBullets.fire(cam.toScreen(en.x), en.y + T * 0.5, 0, 4);
      }
      if (en.x < cam.x - 200) { this._enemies.splice(ei, 1); ei--; }
    }

    // Projectile systems (screen-space, scrollY = 0)
    this._bullets.update(W, H, 0);
    this._droneBullets.update(W, H, 0);

    // Drone bullets → player collision
    if (p.invulnTimer <= 0) {
      var droneHit = this._droneBullets.collideFirst(p.x + p.w / 2, p.y + p.h / 2, T * 0.6);
      if (droneHit) this._playerHit();
    }

    // Player bullets → enemy collision
    for (var bi = 0; bi < this._enemies.length; bi++) {
      var ben = this._enemies[bi];
      var benSX = cam.toScreen(ben.x);
      var bulletHit = this._bullets.collideFirst(benSX, ben.y, T * 0.8);
      if (bulletHit) {
        ben.hp--;
        if (ben.hp <= 0) {
          this._emitter.burst(ben.x, ben.y, { emoji: '💥', count: 8, speed: 4, life: 25 });
          this._emitter.burst(ben.x, ben.y, { emoji: '🔥', count: 4, speed: 2, life: 35, gravity: 0.12 });
          this._screenFX.flash('#ff4400', 6, 0.2); // explosion flash
          this._loot.scatter(ben.x, ben.y, [
            { emoji: '🪙', value: 100, type: 'coin' },
            { emoji: '🪙', value: 100, type: 'coin' },
            { emoji: '💼', value: 300, type: 'intel' }
          ]);
          this.addScore(500);
          this._killCount++;
          this._cam.shake(8, 3);
          this._enemies.splice(bi, 1); bi--;
          this.playSFX('drone-kill');
        }
      }
    }

    // Particles + screen effects + loot
    this._emitter.update();
    this._screenFX.update();
    this._loot.updateWithPlatforms(this._platforms, cam.x);

    // Loot collection (player world-space center)
    var playerWX = p.x + cam.x + p.w / 2;
    var playerWY = p.y + p.h / 2;
    var collected = this._loot.collectNear(playerWX, playerWY, T * 1.5);
    for (var ci2 = 0; ci2 < collected.length; ci2++) {
      var item = collected[ci2];
      if (item.type === 'intel') {
        this._intelCount++;
        this.addScore(item.value);
        this._emitter.burst(item.x, item.y, { emoji: '💼', count: 3, speed: 2, life: 20 });
      } else {
        this.addScore(item.value);
        this._emitter.burst(item.x, item.y, { emoji: '✨', count: 3, speed: 2, life: 18 });
      }
      this.playSFX('collect');
    }

    // Goat position history
    this._posHistory[this._posHistoryIdx] = { x: p.x + cam.x, y: p.y };
    this._posHistoryIdx = (this._posHistoryIdx + 1) % POS_HISTORY_LEN;

    // Goat followers
    for (var gi = 0; gi < this._goats.length; gi++) {
      var goat = this._goats[gi];
      if (!goat.alive) continue;
      var histIdx = (this._posHistoryIdx - goat.delay + POS_HISTORY_LEN) % POS_HISTORY_LEN;
      var hist = this._posHistory[histIdx];
      goat.x = _lerp(goat.x, hist.x - cam.x, 0.15);
      goat.y = _lerp(goat.y, hist.y, 0.15);
      if (goat.y > H + 100) goat.alive = false;
    }

    // Generate + cull
    this._generatePlatforms(W, H);
    this._cullOffscreen(cam.x);

    // Input buffer
    if (this._inputBuffer.vaultPending) {
      this._inputBuffer.timer -= dt;
      if (this._inputBuffer.timer <= 0) this._inputBuffer.vaultPending = false;
    }

    // Strike cooldown
    if (this._strikeCooldown > 0) {
      this._strikeCooldown--;
      if (this._strikeCooldown <= 0) this._strikeAvailable = true;
    }

    // Tutorial timer
    this._tutorialTimer++;
    if (this._tutorialTimer > 300 && this._tutorialPhase < 1) this._tutorialPhase = 1;
    if (this._tutorialTimer > 600 && this._tutorialPhase < 2) this._tutorialPhase = 2;
    if (this._tutorialTimer > 900) this._tutorialPhase = 3;

    // ── Extraction helicopter ──
    this._updateHelicopter(W, H);
  };

  // ──────────────────────────────────────────────────────────
  // EXTRACTION HELICOPTER + VICTORY
  // ──────────────────────────────────────────────────────────

  var HELI_SPAWN_DIST = 4800;
  var HELI_LAND_DIST  = 5000;

  GoatRunner.prototype._updateHelicopter = function (W, H) {
    var cam = this._cam;
    var p = this._player;

    // Phase 0 → 1: Spawn helicopter when approaching extraction distance
    if (this._victoryPhase === 0 && this._distance >= HELI_SPAWN_DIST) {
      this._victoryPhase = 1;
      this._helicopter = {
        x: cam.x + W + 200,   // starts off-screen right (world coords)
        y: H * 0.18,
        bobTimer: 0,
        targetX: cam.x + W * 0.7  // hover target
      };
      this._emitter.burst(cam.x + W * 0.5, H * 0.3, { emoji: '📡', count: 6, speed: 2, life: 40, gravity: 0 });
    }

    if (!this._helicopter) return;
    var heli = this._helicopter;
    heli.bobTimer++;

    // Phase 1: Helicopter approaches from the right and hovers
    if (this._victoryPhase === 1) {
      heli.targetX = cam.x + W * 0.7;
      heli.x = _lerp(heli.x, heli.targetX, 0.03);
      heli.y = H * 0.18 + Math.sin(heli.bobTimer * 0.04) * 6;

      // Player touches helicopter → boarding
      var heliSX = cam.toScreen(heli.x);
      if (Math.abs((p.x + p.w / 2) - heliSX) < this._T * 2.5 &&
          Math.abs((p.y + p.h / 2) - heli.y) < this._T * 2.0) {
        this._victoryPhase = 2;
        this._victoryTimer = 0;

        // Celebration burst
        this._emitter.burst(heli.x, heli.y, { emoji: '🎉', count: 20, speed: 5, life: 50, gravity: 0.05 });
        this._emitter.burst(heli.x, heli.y, { emoji: '⭐', count: 15, speed: 4, life: 40, gravity: 0 });
        this._cam.shake(20, 8);
        this._screenFX.flash('#ffffff', 15, 0.6);    // white victory flash
        this._screenFX.vignette('#001a0f', 0.4, 180); // phosphor vignette lingers
        this.playSFX('collect');

        // Score bonuses
        var aliveGoats = 0;
        for (var g = 0; g < this._goats.length; g++) {
          if (this._goats[g].alive) aliveGoats++;
        }
        this.addScore(5000);                        // extraction bonus
        this.addScore(this.lives * 1000);           // life bonus
        this.addScore(aliveGoats * 500);            // goat survival bonus
        this.addScore(this._intelCount * 300);      // intel bonus
        this.addScore(this._killCount * 200);       // combat bonus
      }
    }

    // Phase 2: Boarding — player rises toward heli, brief pause
    if (this._victoryPhase === 2) {
      this._victoryTimer++;
      heli.y = H * 0.18 + Math.sin(heli.bobTimer * 0.04) * 4;

      // Player lifts toward helicopter
      p.vy = -2;
      p.y = _lerp(p.y, heli.y - 10, 0.06);
      p.x = _lerp(p.x, cam.toScreen(heli.x), 0.06);
      p.grounded = false;

      // Confetti bursts during boarding
      if (this._victoryTimer % 15 === 0) {
        var confettiEmoji = ['🎊', '✨', '🌟', '💫'][Math.floor(Math.random() * 4)];
        this._emitter.burst(heli.x, heli.y + 20, { emoji: confettiEmoji, count: 5, speed: 3, life: 30, gravity: 0.08 });
      }

      if (this._victoryTimer >= 120) {
        this._victoryPhase = 3;
        this._victoryTimer = 0;
      }
    }

    // Phase 3: Fly away — helicopter + player rise off screen, then trigger game over (as a win)
    if (this._victoryPhase === 3) {
      this._victoryTimer++;
      heli.y -= 2.5;
      heli.x += 1.5;
      p.y = _lerp(p.y, heli.y - 10, 0.1);
      p.x = _lerp(p.x, cam.toScreen(heli.x), 0.1);

      if (this._victoryTimer >= 90) {
        // End game — score already boosted, GAME_OVER overlay shows high score + currency
        this.setState('GAME_OVER');
      }
    }
  };

  // ──────────────────────────────────────────────────────────
  // PLAYER HIT / DEATH
  // ──────────────────────────────────────────────────────────

  GoatRunner.prototype._playerHit = function () {
    if (this._victoryPhase >= 2) return;  // invulnerable during extraction
    this._player.invulnTimer = 90;
    this._cam.shake(10, 4);
    this._screenFX.flash('#ff2222', 8, 0.35);   // red hit flash
    this._screenFX.vignette('#220000', 0.3, 40); // brief damage vignette
    this.loseLife();
    this.playSFX('hit');
  };

  GoatRunner.prototype._playerDeath = function () {
    var cam = this._cam;
    var bestPlat = null;
    for (var i = 0; i < this._platforms.length; i++) {
      var plat = this._platforms[i];
      var sx = plat.x - cam.x;
      if (sx > -50 && sx < this.logicalW * 0.5) { bestPlat = plat; break; }
    }
    if (bestPlat) {
      this._player.x = bestPlat.x - cam.x + 30;
      this._player.y = bestPlat.y - this._player.h;
      this._player.vx = 0; this._player.vy = 0;
      this._player.grounded = true;
    } else {
      this._player.x = this.logicalW * 0.3;
      this._player.y = this.logicalH * 0.3;
      this._player.vx = 0; this._player.vy = 0;
    }
    this._player.invulnTimer = 120;
    this.loseLife();
  };

  // ──────────────────────────────────────────────────────────
  // CULLING
  // ──────────────────────────────────────────────────────────

  GoatRunner.prototype._cullOffscreen = function (camX) {
    var cutoff = camX - 400;
    this._platforms = this._platforms.filter(function (p) { return p.x + p.w > cutoff; });
    this._obstacles = this._obstacles.filter(function (o) { return o.x + o.w > cutoff; });
    this._collectibles = this._collectibles.filter(function (c) { return c.x > cutoff && !c.collected; });
    this._grapplers = this._grapplers.filter(function (g) { return g.x > cutoff; });
  };

  // ──────────────────────────────────────────────────────────
  // DRAW
  // ──────────────────────────────────────────────────────────

  GoatRunner.prototype.onDraw = function (ctx, W, H) {
    var cam = this._cam;
    var T = this._T;
    var p = this._player;

    // Screen shake (SideScrollCamera)
    cam.applyShake(ctx);

    // Parallax background (SideScrollCamera)
    cam.drawParallax(ctx, W, H);

    // Platforms
    for (var pi = 0; pi < this._platforms.length; pi++) {
      var plat = this._platforms[pi];
      var sx = cam.toScreen(plat.x);
      if (sx > W + 50 || sx + plat.w < -50) continue;
      ctx.fillStyle = '#1a3a2a';
      ctx.fillRect(sx, plat.y, plat.w, plat.h);
      ctx.strokeStyle = this.colors.phosphorDim;
      ctx.lineWidth = 1;
      ctx.shadowColor = this.colors.phosphor;
      ctx.shadowBlur = 4;
      ctx.strokeRect(sx, plat.y, plat.w, plat.h);
      ctx.shadowBlur = 0;
    }

    // Obstacles
    for (var oi = 0; oi < this._obstacles.length; oi++) {
      var obs = this._obstacles[oi];
      if (!obs.active) continue;
      var osx = cam.toScreen(obs.x);
      if (osx > W + 50 || osx + obs.w < -50) continue;
      if (obs.type === OBS_DISH) {
        this.drawEmoji(ctx, '📡', osx + obs.w / 2, obs.y + obs.h / 2, T * 0.7);
      } else if (obs.type === OBS_AC) {
        this.drawEmoji(ctx, '📦', osx + obs.w / 2, obs.y + obs.h / 2, T * 0.6);
      } else if (obs.type === OBS_LASER && obs.blinkTimer <= 45) {
        ctx.strokeStyle = '#ff4757'; ctx.lineWidth = 2;
        ctx.shadowColor = '#ff4757'; ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(osx, obs.y + obs.h / 2);
        ctx.lineTo(osx + obs.w, obs.y + obs.h / 2);
        ctx.stroke(); ctx.shadowBlur = 0;
      }
    }

    // Collectibles
    for (var ci = 0; ci < this._collectibles.length; ci++) {
      var col = this._collectibles[ci];
      if (col.collected) continue;
      var csx = cam.toScreen(col.x);
      if (csx < -50 || csx > W + 50) continue;
      var bobY = col.y + Math.sin(this._distance * 0.02 + ci) * 3;
      if (col.type === 'intel') {
        this.drawEmoji(ctx, '💼', csx, bobY, T * 0.5, { glow: true, glowColor: this.colors.amber });
      } else {
        this.drawEmoji(ctx, '🪙', csx, bobY, T * 0.4, { glow: true });
      }
    }

    // Ceiling grapple points (render before entities)
    for (var gri = 0; gri < this._grapplers.length; gri++) {
      var gp = this._grapplers[gri];
      var gpsx = cam.toScreen(gp.x);
      if (gpsx < -50 || gpsx > W + 50) continue;
      if (gp.used) continue;
      // Pulsing diamond marker
      var gpPulse = 0.3 + 0.2 * Math.sin(this._distance * 0.03 + gri * 2);
      ctx.save();
      ctx.globalAlpha = gpPulse;
      ctx.fillStyle = this.colors.amber;
      ctx.beginPath();
      ctx.moveTo(gpsx, gp.y - 5);
      ctx.lineTo(gpsx + 4, gp.y);
      ctx.lineTo(gpsx, gp.y + 5);
      ctx.lineTo(gpsx - 4, gp.y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Goats (flipped to face right — game scrolls left-to-right)
    for (var gi = 0; gi < this._goats.length; gi++) {
      var goat = this._goats[gi];
      if (!goat.alive) continue;
      this.drawEmoji(ctx, '🐐', goat.x, goat.y + T * 0.3, T * 0.5, {
        alpha: 0.6, glow: true, glowColor: this.colors.phosphorDim, glowRadius: 4,
        flipX: true
      });
    }

    // Player (blink during invulnerability, flip per facing direction)
    if (p.invulnTimer <= 0 || Math.floor(p.invulnTimer / 4) % 2 === 0) {
      var emoji = p.grounded ? '🏃' : '🤸';
      var size = p.ducking ? T * 0.7 : T * 1.0;
      this.drawEmoji(ctx, emoji, p.x + p.w / 2, p.y + p.h / 2, size, {
        glow: true, glowColor: this.colors.phosphorBright, glowRadius: 6,
        flipX: p.facingRight
      });
    }

    // Grapple line (from player to anchor point while grappled)
    if (this._grapple.active && this._grapple.target) {
      var gt = this._grapple.target;
      var gtsx = cam.toScreen(gt.x);
      var gAlpha = this._grapple.timer / GRAPPLE_DURATION;
      ctx.save();
      ctx.globalAlpha = gAlpha * 0.7;
      ctx.strokeStyle = this.colors.amber; ctx.lineWidth = 1.5;
      ctx.shadowColor = this.colors.amber; ctx.shadowBlur = 6;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(p.x + p.w / 2, p.y);
      ctx.lineTo(gtsx, gt.y);
      ctx.stroke();
      ctx.setLineDash([]); ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Enemies
    for (var ei = 0; ei < this._enemies.length; ei++) {
      var en = this._enemies[ei];
      this.drawEmoji(ctx, '🛸', cam.toScreen(en.x), en.y, T * 0.8, {
        glow: true, glowColor: this.colors.red, glowRadius: 6
      });
    }

    // Player bullets (ProjectileSystem — green phosphor)
    this._bullets.draw(ctx, { color: this.colors.phosphorBright, radius: 3, glowColor: this.colors.phosphor, glowRadius: 6 });

    // Drone bullets (ProjectileSystem — red glow)
    this._droneBullets.draw(ctx, { color: this.colors.red, radius: 3, glowColor: this.colors.red, glowRadius: 6 });

    // Loot drops (LootDrop — physics scatter)
    this._loot.draw(ctx, cam.x, this, T * 0.45);

    // Extraction helicopter
    if (this._helicopter) {
      var heliSX = cam.toScreen(this._helicopter.x);
      var heliY = this._helicopter.y;

      // Rotor blur (spinning line)
      var rotorAngle = this._helicopter.bobTimer * 0.3;
      ctx.strokeStyle = 'rgba(28,255,155,0.3)'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(heliSX - Math.cos(rotorAngle) * T * 1.2, heliY - T * 0.6);
      ctx.lineTo(heliSX + Math.cos(rotorAngle) * T * 1.2, heliY - T * 0.6);
      ctx.stroke();

      // Helicopter emoji
      this.drawEmoji(ctx, '🚁', heliSX, heliY, T * 1.5, {
        glow: true, glowColor: this.colors.phosphorBright, glowRadius: 10
      });

      // Spotlight beam during approach
      if (this._victoryPhase === 1) {
        ctx.save();
        ctx.globalAlpha = 0.08 + Math.sin(this._helicopter.bobTimer * 0.06) * 0.04;
        ctx.fillStyle = this.colors.phosphor;
        ctx.beginPath();
        ctx.moveTo(heliSX - T * 0.5, heliY + T * 0.5);
        ctx.lineTo(heliSX - T * 2, H);
        ctx.lineTo(heliSX + T * 2, H);
        ctx.lineTo(heliSX + T * 0.5, heliY + T * 0.5);
        ctx.fill();
        ctx.restore();
      }
    }

    // Particles (ParticleEmitter)
    this._emitter.draw(ctx, cam.x, this, T * 0.4);

    // End shake (SideScrollCamera)
    cam.endShake(ctx);

    // HUD (outside shake)
    this._drawHUD(ctx, W, H);
    this._drawTutorial(ctx, W, H);

    // Victory overlay text (drawn outside shake, on top of everything)
    if (this._victoryPhase >= 2) {
      ctx.save();
      var vAlpha = this._victoryPhase === 2 ? Math.min(1, this._victoryTimer / 40) : 1;
      ctx.globalAlpha = vAlpha * 0.95;
      this.drawText(ctx, '✦ EXTRACTION COMPLETE ✦', W / 2, H * 0.40, 18, this.colors.amber, 'center');
      if (this._victoryPhase === 2 && this._victoryTimer > 30) {
        var aliveGoats = 0;
        for (var vg = 0; vg < this._goats.length; vg++) { if (this._goats[vg].alive) aliveGoats++; }
        ctx.globalAlpha = vAlpha * 0.7;
        this.drawText(ctx, 'Extraction +5000  |  Lives ×' + this.lives + '  |  Goats ×' + aliveGoats, W / 2, H * 0.48, 11, this.colors.phosphor, 'center');
        this.drawText(ctx, 'Intel ×' + this._intelCount + '  |  Kills ×' + this._killCount, W / 2, H * 0.54, 11, this.colors.phosphorDim, 'center');
      }
      ctx.restore();
    }

    // Screen FX (flash, vignette — topmost layer)
    this._screenFX.draw(ctx, W, H);
  };

  // ──────────────────────────────────────────────────────────
  // HUD
  // ──────────────────────────────────────────────────────────

  GoatRunner.prototype._drawHUD = function (ctx, W, H) {
    this.drawText(ctx, Math.floor(this._distance) + 'm', W - 10, 18, 14, this.colors.phosphor, 'right');
    if (this._intelCount > 0) {
      this.drawEmoji(ctx, '💼', W - 80, 18, 14);
      this.drawText(ctx, '×' + this._intelCount, W - 68, 18, 12, this.colors.amber, 'left');
    }
    for (var i = 0; i < this.lives; i++) {
      this.drawEmoji(ctx, '❤️', 14 + i * 18, 18, 14);
    }
    var aliveGoats = 0;
    for (var g = 0; g < this._goats.length; g++) { if (this._goats[g].alive) aliveGoats++; }
    if (aliveGoats > 0) {
      this.drawEmoji(ctx, '🐐', 14, 38, 12);
      this.drawText(ctx, '×' + aliveGoats, 28, 38, 11, this.colors.phosphorDim, 'left');
    }
    if (this._strikeAvailable) this.drawEmoji(ctx, '⚡', W - 25, 38, 14);

    // Kill count
    if (this._killCount > 0) {
      this.drawEmoji(ctx, '🛸', 14, 56, 12);
      this.drawText(ctx, '×' + this._killCount, 28, 56, 11, this.colors.red, 'left');
    }

    // Section name flash
    if (this._sectionFlash > 0) {
      var flashAlpha = Math.min(1, this._sectionFlash / 40);
      var secName = difficultyRamp.sectionName() || '';
      ctx.save(); ctx.globalAlpha = flashAlpha * 0.9;
      this.drawText(ctx, '// ' + secName.toUpperCase() + ' //', W / 2, H * 0.18, 16, this.colors.amber, 'center');
      ctx.restore();
    }
  };

  GoatRunner.prototype._drawTutorial = function (ctx, W, H) {
    if (this._tutorialPhase >= 3) return;
    var texts = [
      'TAP / SPACE to vault over gaps',
      'TAP again mid-air to GRAPPLE ceiling anchors',
      'DOUBLE-TAP for emergency strike'
    ];
    var text = texts[this._tutorialPhase] || '';
    if (text) {
      var phaseTime = this._tutorialTimer % 300;
      var alpha = phaseTime > 250 ? (300 - phaseTime) / 50 : 1;
      ctx.save(); ctx.globalAlpha = alpha * 0.85;
      this.drawText(ctx, text, W / 2, H - 30, 13, this.colors.phosphorDim, 'center');
      ctx.restore();
    }
  };

  // ──────────────────────────────────────────────────────────
  // RESIZE
  // ──────────────────────────────────────────────────────────

  GoatRunner.prototype.onResize = function (W, H) {
    this._T = Math.max(20, Math.min(BASE_T, W / 18));
    this._cam.resize(W, H);
  };

  // ──────────────────────────────────────────────────────────
  // UTILITY
  // ──────────────────────────────────────────────────────────

  function _lerp(a, b, t) { return a + (b - a) * t; }

  // ──────────────────────────────────────────────────────────
  // REGISTER
  // ──────────────────────────────────────────────────────────

  var instance = new GoatRunner();
  var minigame = instance.asMinigame();

  if (window.MinigameModal && MinigameModal.register) {
    MinigameModal.register('goat-runner', function () { return minigame; });
  }
  window.GoatRunnerGame = minigame;

})();
