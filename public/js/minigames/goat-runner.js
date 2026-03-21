/* ============================================================
   GOAT RUNNER — ArcadeEngine subclass
   Side-scrolling rooftop platformer with tether/vault mechanics
   and goat followers. Uses Phase 3 genre helper modules:
     - SideScrollCamera  (viewport, shake, parallax)
     - PlatformPhysics   (gravity, jump, collision)
     - ParticleEmitter   (burst/stream effects)
   ============================================================ */
(function () {
  'use strict';

  /* ── Tile unit (scales with canvas) ── */
  var BASE_T = 28;

  /* ── Tether constants ── */
  var TETHER_DRAG_THRESHOLD = 12;
  var TETHER_BRAKE_MAX      = 0.85;
  var TETHER_LERP           = 0.12;

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

    this._player = { x: 0, y: 0, vx: 0, vy: 0, w: 20, h: 24, grounded: false, tethering: false, canDoubleJump: true, ducking: false, invulnTimer: 0 };
    this._tether = { active: false, startX: 0, startY: 0, curX: 0, curY: 0, smoothAngle: 0, smoothBrake: 0 };
    this._goats = [];
    this._posHistory = [];
    this._posHistoryIdx = 0;
    this._platforms = [];
    this._obstacles = [];
    this._collectibles = [];
    this._enemies = [];
    this._projectiles = [];
    this._distance = 0;
    this._difficulty = 0;
    this._intelCount = 0;
    this._inputBuffer = { vaultPending: false, timer: 0 };
    this._strikeAvailable = true;
    this._strikeCooldown = 0;
    this._tutorialPhase = 0;
    this._tutorialTimer = 0;
    this._nextPlatX = 0;
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

    // Player
    this._player = {
      x: W * 0.25, y: H * 0.5, vx: 0, vy: 0,
      w: T * 0.8, h: T * 1.0,
      grounded: false, tethering: false, canDoubleJump: true,
      ducking: false, invulnTimer: 0
    };

    // Tether
    this._tether = { active: false, startX: 0, startY: 0, curX: 0, curY: 0, smoothAngle: 0, smoothBrake: 0 };
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
    this._projectiles = [];

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
    this._difficulty = 0;
    this._intelCount = 0;
    this._tutorialPhase = 0;
    this._tutorialTimer = 0;
  };

  // ──────────────────────────────────────────────────────────
  // PLATFORM GENERATION
  // ──────────────────────────────────────────────────────────

  GoatRunner.prototype._seedInitialPlatforms = function (W, H) {
    var groundY = H * 0.65;
    this._platforms.push({ x: -50, y: groundY, w: W * 0.7, h: PLAT_H });
    this._player.y = groundY - this._player.h;
    this._nextPlatX = W * 0.7 - 50;
    this._generatePlatforms(W, H);
  };

  GoatRunner.prototype._generatePlatforms = function (W, H) {
    var cameraRight = this._cam.x + W + SPAWN_AHEAD;

    while (this._nextPlatX < cameraRight) {
      var gap = MIN_GAP + Math.random() * (MAX_GAP - MIN_GAP) * (0.5 + this._difficulty * 0.5);
      var platW = MIN_PLAT_W + Math.random() * (MAX_PLAT_W - MIN_PLAT_W) * (1 - this._difficulty * 0.3);
      var prevPlat = this._platforms[this._platforms.length - 1];
      var prevY = prevPlat ? prevPlat.y : H * 0.65;

      var yShift = (Math.random() - 0.4) * 60 * (0.5 + this._difficulty);
      var newY = Math.max(H * 0.3, Math.min(H * 0.8, prevY + yShift));

      var platX = this._nextPlatX + gap;
      this._platforms.push({ x: platX, y: newY, w: platW, h: PLAT_H });

      if (Math.random() < this._difficulty * 0.5 && platW > 150) {
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
    var roll = Math.random();
    var type, w, h, ox;
    if (roll < 0.4) {
      type = OBS_DISH; w = T * 0.7; h = T * 0.7;
      ox = platX + 40 + Math.random() * (platW - 80);
    } else if (roll < 0.75) {
      type = OBS_AC; w = T * 0.6; h = T * 0.6;
      ox = platX + 40 + Math.random() * (platW - 80);
    } else {
      type = OBS_LASER; w = T * 1.5; h = T * 0.15;
      ox = platX + 30 + Math.random() * (platW - 60);
    }
    this._obstacles.push({
      x: ox, y: platY - h, w: w, h: h,
      type: type, hp: type === OBS_AC ? 1 : -1, active: true, blinkTimer: 0
    });
  };

  // ──────────────────────────────────────────────────────────
  // INPUT
  // ──────────────────────────────────────────────────────────

  GoatRunner.prototype.onInput = function (type, data) {
    var p = this._player;

    if (type === 'tap') { this._doVault(false); return; }

    if (type === 'doubletap') {
      if (this._strikeAvailable) { this._doPoleStrike(); }
      else { this._doVault(false); }
      return;
    }

    if (type === 'dragstart') {
      this._tether.active = true;
      this._tether.startX = data.x; this._tether.startY = data.y;
      this._tether.curX = data.x; this._tether.curY = data.y;
      p.tethering = true;
      return;
    }
    if (type === 'drag') {
      if (this._tether.active) { this._tether.curX = data.x; this._tether.curY = data.y; }
      return;
    }
    if (type === 'dragend') {
      this._tether.active = false; p.tethering = false;
      this._inputBuffer.vaultPending = true; this._inputBuffer.timer = 100;
      return;
    }

    if (type === 'keyaction') {
      if (data.action === 'up' || data.action === 'action') this._doVault(false);
      if (data.action === 'down') p.ducking = true;
    }
  };

  GoatRunner.prototype._doVault = function (charged) {
    var p = this._player;
    if (charged) {
      // Charged vault: stronger force
      if (p.grounded) {
        p.vy = this._physics.jumpForce * 1.3;
        p.grounded = false; p.canDoubleJump = true;
        this.playSFX('hop');
      }
    } else {
      // Use PlatformPhysics tryJump (handles ground + double jump)
      if (this._physics.tryJump(p)) {
        this.playSFX('hop');
      }
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

    // Push enemies
    for (var e = 0; e < this._enemies.length; e++) {
      var en = this._enemies[e];
      if (Math.hypot(en.x - cx, en.y - cy) < radius) {
        en.hp--;
        if (en.hp <= 0) {
          this._enemies.splice(e, 1); e--;
          this.addScore(500);
        }
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

    // Distance + difficulty
    this._distance += cam.speed;
    this._difficulty = Math.min(1, this._distance / 5000);
    this.score = Math.floor(this._distance);

    // Camera scroll (SideScrollCamera handles speed ramp + shake)
    cam.update(this._distance);

    // Gravity (PlatformPhysics)
    phys.applyGravity(p);

    // Tether physics (game-specific, not a generic module)
    if (this._tether.active) {
      var tdx = this._tether.curX - this._tether.startX;
      var tdy = this._tether.curY - this._tether.startY;
      var tDist = Math.hypot(tdx, tdy);
      if (tDist > TETHER_DRAG_THRESHOLD) {
        var tAngle = Math.atan2(tdy, tdx);
        var brake = Math.min(tDist / 150, TETHER_BRAKE_MAX);
        this._tether.smoothAngle = _lerp(this._tether.smoothAngle, tAngle, TETHER_LERP);
        this._tether.smoothBrake = _lerp(this._tether.smoothBrake, brake, TETHER_LERP);
        var speed = Math.hypot(p.vx, p.vy);
        var targetVx = Math.cos(this._tether.smoothAngle) * speed * (1 - this._tether.smoothBrake * 0.4);
        var targetVy = Math.sin(this._tether.smoothAngle) * speed * (1 - this._tether.smoothBrake * 0.4);
        p.vx = _lerp(p.vx, targetVx, 0.15);
        p.vy = _lerp(p.vy, targetVy, 0.15);
      }
    }

    // Keyboard nudge (PlatformPhysics)
    var nudgeDir = 0;
    if (this.isKeyHeld('left'))  nudgeDir -= 1;
    if (this.isKeyHeld('right')) nudgeDir += 1;
    phys.nudge(p, nudgeDir);
    p.ducking = this.isKeyHeld('down');

    // Integrate movement (PlatformPhysics)
    phys.integrate(p);

    // Clamp to screen (PlatformPhysics)
    phys.clampToScreen(p, 20, W * 0.7);

    // Friction (PlatformPhysics)
    phys.applyFriction(p, 0);

    // Platform collision (PlatformPhysics)
    phys.collidePlatforms(p, this._platforms, cam.x);

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
              if (Math.random() < 0.4) {
                this._collectibles.push({ x: obs.x, y: obs.y - T, type: 'intel', collected: false });
              }
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
    if (this._distance > 500 && this._enemies.length === 0 && Math.random() < 0.002 * this._difficulty) {
      this._enemies.push({ x: cam.x + W + 50, y: H * 0.15, type: 'drone', hp: 3, fireTimer: 120 });
    }

    // Enemy AI
    for (var ei = 0; ei < this._enemies.length; ei++) {
      var en = this._enemies[ei];
      en.x = _lerp(en.x, p.x + cam.x, 0.02);
      en.fireTimer--;
      if (en.fireTimer <= 0) {
        en.fireTimer = 100 + Math.floor(Math.random() * 40);
        this._projectiles.push({ x: en.x, y: en.y + T * 0.5, vx: 0, vy: 4, enemy: true });
      }
      if (en.x < cam.x - 200) { this._enemies.splice(ei, 1); ei--; }
    }

    // Projectiles
    for (var pi = this._projectiles.length - 1; pi >= 0; pi--) {
      var pr = this._projectiles[pi];
      pr.x += pr.vx; pr.y += pr.vy;
      if (pr.enemy && p.invulnTimer <= 0) {
        var psx = pr.x - cam.x;
        if (Math.abs(psx - (p.x + p.w / 2)) < T * 0.6 && Math.abs(pr.y - (p.y + p.h / 2)) < T * 0.6) {
          this._playerHit();
          this._projectiles.splice(pi, 1);
          continue;
        }
      }
      if (pr.y > H + 50 || pr.y < -50 || pr.x < cam.x - 100 || pr.x > cam.x + W + 100) {
        this._projectiles.splice(pi, 1);
      }
    }

    // Particles (ParticleEmitter)
    this._emitter.update();

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
  };

  // ──────────────────────────────────────────────────────────
  // PLAYER HIT / DEATH
  // ──────────────────────────────────────────────────────────

  GoatRunner.prototype._playerHit = function () {
    this._player.invulnTimer = 90;
    this._cam.shake(10, 4);
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

    // Goats
    for (var gi = 0; gi < this._goats.length; gi++) {
      var goat = this._goats[gi];
      if (!goat.alive) continue;
      this.drawEmoji(ctx, '🐐', goat.x, goat.y + T * 0.3, T * 0.5, {
        alpha: 0.6, glow: true, glowColor: this.colors.phosphorDim, glowRadius: 4
      });
    }

    // Player (blink during invulnerability)
    if (p.invulnTimer <= 0 || Math.floor(p.invulnTimer / 4) % 2 === 0) {
      var emoji = p.grounded ? '🏃' : '🤸';
      var size = p.ducking ? T * 0.7 : T * 1.0;
      this.drawEmoji(ctx, emoji, p.x + p.w / 2, p.y + p.h / 2, size, {
        glow: true, glowColor: this.colors.phosphorBright, glowRadius: 6
      });
    }

    // Tether line
    if (this._tether.active) {
      ctx.strokeStyle = this.colors.amber; ctx.lineWidth = 2;
      ctx.shadowColor = this.colors.amber; ctx.shadowBlur = 6;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(p.x + p.w / 2, p.y + p.h / 2);
      ctx.lineTo(this._tether.curX, this._tether.curY);
      ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0;
    }

    // Enemies
    for (var ei = 0; ei < this._enemies.length; ei++) {
      var en = this._enemies[ei];
      this.drawEmoji(ctx, '🛸', cam.toScreen(en.x), en.y, T * 0.8, {
        glow: true, glowColor: this.colors.red, glowRadius: 6
      });
    }

    // Enemy projectiles
    for (var pri = 0; pri < this._projectiles.length; pri++) {
      var pr = this._projectiles[pri];
      var prsx = cam.toScreen(pr.x);
      if (pr.enemy) {
        ctx.fillStyle = this.colors.red;
        ctx.shadowColor = this.colors.red; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(prsx, pr.y, 3, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // Particles (ParticleEmitter)
    this._emitter.draw(ctx, cam.x, this, T * 0.4);

    // End shake (SideScrollCamera)
    cam.endShake(ctx);

    // HUD (outside shake)
    this._drawHUD(ctx, W, H);
    this._drawTutorial(ctx, W, H);
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
  };

  GoatRunner.prototype._drawTutorial = function (ctx, W, H) {
    if (this._tutorialPhase >= 3) return;
    var texts = [
      'TAP / SPACE to vault over gaps',
      'DRAG to tether & control descent',
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
