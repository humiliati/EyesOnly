/* ============================================================
   GOAT RUNNER — ArcadeEngine subclass
   Side-scrolling rooftop platformer with tether/vault mechanics
   and goat followers. Sprint 2: core movement + terrain.
   ============================================================ */
(function () {
  'use strict';

  /* ── Tile unit (scales with canvas) ── */
  var BASE_T = 28;

  /* ── Physics constants ── */
  var GRAVITY        = 0.48;
  var VAULT_FORCE    = -9.0;
  var DOUBLE_JUMP_FORCE = -7.0;
  var MAX_FALL_SPEED = 12;
  var SCROLL_SPEED   = 2.2;       // base auto-scroll px/frame
  var SCROLL_ACCEL   = 0.00004;   // acceleration per distance unit
  var MAX_SCROLL     = 5.5;
  var PLAYER_NUDGE   = 0.8;       // left/right nudge per frame

  /* ── Tether constants ── */
  var TETHER_DRAG_THRESHOLD = 12; // px before drag locks in
  var TETHER_BRAKE_MAX      = 0.85;
  var TETHER_LERP           = 0.12;

  /* ── Terrain generation ── */
  var MIN_PLAT_W     = 120;
  var MAX_PLAT_W     = 320;
  var MIN_GAP        = 40;
  var MAX_GAP        = 140;
  var PLAT_H         = 14;
  var SPAWN_AHEAD    = 800;       // generate platforms this far ahead of camera

  /* ── Goat followers ── */
  var GOAT_COUNT     = 5;
  var POS_HISTORY_LEN = 300;      // frames of position history
  var GOAT_SPACING   = 35;        // frames between each goat's delay

  /* ── Parallax layers ── */
  var PARALLAX = [
    { speed: 0.05, y: 0.50, h: 0.50, color: 'rgba(28,255,155,0.04)' },
    { speed: 0.12, y: 0.45, h: 0.55, color: 'rgba(28,255,155,0.06)' },
    { speed: 0.22, y: 0.40, h: 0.60, color: 'rgba(28,255,155,0.09)' }
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

    // Camera
    this._camera = { x: 0, speed: SCROLL_SPEED, shakeTimer: 0, shakeIntensity: 0 };

    // Player (positioned in left third of screen)
    this._player = {
      x: W * 0.25,
      y: H * 0.5,
      vx: 0,
      vy: 0,
      w: T * 0.8,
      h: T * 1.0,
      grounded: false,
      tethering: false,
      canDoubleJump: true,
      ducking: false,
      invulnTimer: 0
    };

    // Tether state
    this._tether = {
      active: false,
      startX: 0, startY: 0,
      curX: 0, curY: 0,
      smoothAngle: 0,
      smoothBrake: 0
    };

    // Input buffer for tether→vault transition
    this._inputBuffer = { vaultPending: false, timer: 0 };

    // Double-tap strike
    this._strikeAvailable = true;
    this._strikeCooldown = 0;

    // Platforms
    this._platforms = [];
    this._nextPlatX = 0;
    this._seedInitialPlatforms(W, H);

    // Obstacles, collectibles, enemies
    this._obstacles = [];
    this._collectibles = [];
    this._enemies = [];
    this._projectiles = [];
    this._particles = [];

    // Goat followers
    this._goats = [];
    this._posHistory = [];
    this._posHistoryIdx = 0;
    for (var i = 0; i < POS_HISTORY_LEN; i++) {
      this._posHistory.push({ x: this._player.x + this._camera.x, y: this._player.y });
    }
    for (var g = 0; g < GOAT_COUNT; g++) {
      this._goats.push({
        x: this._player.x - (g + 1) * 15,
        y: this._player.y,
        delay: (g + 1) * GOAT_SPACING,
        alive: true
      });
    }

    // Distance / difficulty
    this._distance = 0;
    this._difficulty = 0;
    this._intelCount = 0;

    // Extraction
    this._extracting = false;
    this._extractTimer = 0;

    // Tutorial prompts
    this._tutorialPhase = 0;
    this._tutorialTimer = 0;
  };

  // ──────────────────────────────────────────────────────────
  // INITIAL PLATFORM SEEDING
  // ──────────────────────────────────────────────────────────

  GoatRunner.prototype._seedInitialPlatforms = function (W, H) {
    // First platform under the player — wide and safe
    var groundY = H * 0.65;
    this._platforms.push({
      x: -50,
      y: groundY,
      w: W * 0.7,
      h: PLAT_H
    });
    this._player.y = groundY - this._player.h;
    this._nextPlatX = W * 0.7 - 50;

    // Generate more ahead
    this._generatePlatforms(W, H);
  };

  GoatRunner.prototype._generatePlatforms = function (W, H) {
    var cameraRight = this._camera.x + W + SPAWN_AHEAD;

    while (this._nextPlatX < cameraRight) {
      var gap = MIN_GAP + Math.random() * (MAX_GAP - MIN_GAP) * (0.5 + this._difficulty * 0.5);
      var platW = MIN_PLAT_W + Math.random() * (MAX_PLAT_W - MIN_PLAT_W) * (1 - this._difficulty * 0.3);
      var prevPlat = this._platforms[this._platforms.length - 1];
      var prevY = prevPlat ? prevPlat.y : H * 0.65;

      // Slight vertical variation (rooftops at different heights)
      var yShift = (Math.random() - 0.4) * 60 * (0.5 + this._difficulty);
      var newY = Math.max(H * 0.3, Math.min(H * 0.8, prevY + yShift));

      var platX = this._nextPlatX + gap;
      this._platforms.push({
        x: platX,
        y: newY,
        w: platW,
        h: PLAT_H
      });

      // Spawn obstacles on platform (difficulty-gated)
      if (Math.random() < this._difficulty * 0.5 && platW > 150) {
        this._spawnObstacle(platX, newY, platW);
      }

      // Spawn collectibles
      if (Math.random() < 0.3) {
        this._collectibles.push({
          x: platX + platW * 0.5,
          y: newY - this._T * 1.5,
          type: Math.random() < 0.3 ? 'intel' : 'coin',
          collected: false
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
      type = OBS_DISH;
      w = T * 0.7; h = T * 0.7;
      ox = platX + 40 + Math.random() * (platW - 80);
    } else if (roll < 0.75) {
      type = OBS_AC;
      w = T * 0.6; h = T * 0.6;
      ox = platX + 40 + Math.random() * (platW - 80);
    } else {
      type = OBS_LASER;
      w = T * 1.5; h = T * 0.15;
      ox = platX + 30 + Math.random() * (platW - 60);
    }

    this._obstacles.push({
      x: ox,
      y: platY - h,
      w: w,
      h: h,
      type: type,
      hp: type === OBS_AC ? 1 : -1,  // -1 = indestructible
      active: true,
      blinkTimer: 0
    });
  };

  // ──────────────────────────────────────────────────────────
  // LIFECYCLE: onInput
  // ──────────────────────────────────────────────────────────

  GoatRunner.prototype.onInput = function (type, data) {
    var p = this._player;

    // ── Tap → Vault ──
    if (type === 'tap') {
      this._doVault(false);
      return;
    }

    // ── Double-tap → Pole Strike ──
    if (type === 'doubletap') {
      if (this._strikeAvailable) {
        this._doPoleStrike();
      } else {
        // Treat as vault fallback
        this._doVault(false);
      }
      return;
    }

    // ── Drag start → begin tether ──
    if (type === 'dragstart') {
      this._tether.active = true;
      this._tether.startX = data.x;
      this._tether.startY = data.y;
      this._tether.curX = data.x;
      this._tether.curY = data.y;
      p.tethering = true;
      return;
    }

    // ── Drag move → update tether ──
    if (type === 'drag') {
      if (this._tether.active) {
        this._tether.curX = data.x;
        this._tether.curY = data.y;
      }
      return;
    }

    // ── Drag end → release tether, buffer vault ──
    if (type === 'dragend') {
      this._tether.active = false;
      p.tethering = false;
      // Buffer a vault opportunity for 100ms
      this._inputBuffer.vaultPending = true;
      this._inputBuffer.timer = 100;
      return;
    }

    // ── Keyboard actions ──
    if (type === 'keyaction') {
      if (data.action === 'up' || data.action === 'action') {
        this._doVault(false);
      }
      if (data.action === 'down') {
        p.ducking = true;
      }
    }
  };

  GoatRunner.prototype._doVault = function (charged) {
    var p = this._player;
    if (p.grounded) {
      p.vy = charged ? VAULT_FORCE * 1.3 : VAULT_FORCE;
      p.grounded = false;
      p.canDoubleJump = true;
      this.playSFX('hop');
    } else if (p.canDoubleJump) {
      p.vy = DOUBLE_JUMP_FORCE;
      p.canDoubleJump = false;
      this.playSFX('hop');
    }
  };

  GoatRunner.prototype._doPoleStrike = function () {
    this._strikeAvailable = false;
    this._strikeCooldown = 300; // 300 frames cooldown

    // Knockback burst: push away nearby obstacles and enemies
    var p = this._player;
    var cx = p.x + this._camera.x;
    var cy = p.y + p.h * 0.5;
    var radius = this._T * 3;

    // Particle burst
    for (var i = 0; i < 12; i++) {
      var angle = (Math.PI * 2 / 12) * i;
      this._particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * 4,
        vy: Math.sin(angle) * 4,
        text: '⚡',
        life: 30
      });
    }

    // Push enemies
    for (var e = 0; e < this._enemies.length; e++) {
      var en = this._enemies[e];
      var dx = en.x - cx;
      var dy = en.y - cy;
      if (Math.hypot(dx, dy) < radius) {
        en.hp--;
        if (en.hp <= 0) {
          this._enemies.splice(e, 1);
          e--;
          this.addScore(500);
        }
      }
    }

    // Screen shake
    this._camera.shakeTimer = 15;
    this._camera.shakeIntensity = 6;
    this.playSFX('explosion');
  };

  // ──────────────────────────────────────────────────────────
  // LIFECYCLE: onUpdate
  // ──────────────────────────────────────────────────────────

  GoatRunner.prototype.onUpdate = function (dt) {
    var p = this._player;
    var cam = this._camera;
    var T = this._T;
    var W = this.logicalW;
    var H = this.logicalH;

    // ── Distance + difficulty ramp ──
    this._distance += cam.speed;
    this._difficulty = Math.min(1, this._distance / 5000);
    this.score = Math.floor(this._distance);

    // ── Camera scroll ──
    cam.speed = Math.min(MAX_SCROLL, SCROLL_SPEED + this._distance * SCROLL_ACCEL);
    cam.x += cam.speed;

    // ── Screen shake decay ──
    if (cam.shakeTimer > 0) cam.shakeTimer--;

    // ── Gravity ──
    p.vy += GRAVITY;
    if (p.vy > MAX_FALL_SPEED) p.vy = MAX_FALL_SPEED;

    // ── Tether physics ──
    if (this._tether.active) {
      var tdx = this._tether.curX - this._tether.startX;
      var tdy = this._tether.curY - this._tether.startY;
      var tDist = Math.hypot(tdx, tdy);

      if (tDist > TETHER_DRAG_THRESHOLD) {
        var tAngle = Math.atan2(tdy, tdx);
        var brake = Math.min(tDist / 150, TETHER_BRAKE_MAX);

        // Smooth the tether angle + brake
        this._tether.smoothAngle = this._lerp(this._tether.smoothAngle, tAngle, TETHER_LERP);
        this._tether.smoothBrake = this._lerp(this._tether.smoothBrake, brake, TETHER_LERP);

        // Apply: steer velocity toward drag direction, reduce speed
        var speed = Math.hypot(p.vx, p.vy);
        var targetVx = Math.cos(this._tether.smoothAngle) * speed * (1 - this._tether.smoothBrake * 0.4);
        var targetVy = Math.sin(this._tether.smoothAngle) * speed * (1 - this._tether.smoothBrake * 0.4);

        p.vx = this._lerp(p.vx, targetVx, 0.15);
        p.vy = this._lerp(p.vy, targetVy, 0.15);
      }
    }

    // ── Keyboard nudge (held keys) ──
    if (this.isKeyHeld('left'))  p.vx -= PLAYER_NUDGE;
    if (this.isKeyHeld('right')) p.vx += PLAYER_NUDGE;
    if (this.isKeyHeld('down'))  p.ducking = true;
    else p.ducking = false;

    // ── Move player (world-relative: player.x is screen-relative) ──
    // Player stays roughly in the left third; camera scrolls the world
    p.x += p.vx;
    p.y += p.vy;

    // ── Keep player on screen horizontally ──
    if (p.x < 20) { p.x = 20; p.vx = 0; }
    if (p.x > W * 0.7) { p.x = W * 0.7; p.vx *= 0.9; }

    // ── Horizontal drag toward camera speed (auto-run feel) ──
    p.vx = this._lerp(p.vx, 0, 0.08);

    // ── Platform collision ──
    p.grounded = false;
    for (var i = 0; i < this._platforms.length; i++) {
      var plat = this._platforms[i];
      var platScreenX = plat.x - cam.x;

      // AABB: player feet vs platform top
      var px = p.x;
      var py = p.y + p.h; // player bottom
      var pw = p.w;

      if (px + pw > platScreenX && px < platScreenX + plat.w) {
        // Landing on top (was above, now overlapping)
        if (p.vy >= 0 && py >= plat.y && py - p.vy <= plat.y + 4) {
          p.y = plat.y - p.h;
          p.vy = 0;
          p.grounded = true;
          p.canDoubleJump = true;
        }
      }
    }

    // ── Fell off screen → lose life ──
    if (p.y > H + 50) {
      this._playerDeath();
      return;
    }

    // ── Obstacle collision ──
    if (p.invulnTimer > 0) {
      p.invulnTimer--;
    } else {
      for (var o = 0; o < this._obstacles.length; o++) {
        var obs = this._obstacles[o];
        if (!obs.active) continue;
        if (obs.type === OBS_LASER && obs.blinkTimer > 45) continue; // off phase

        var osx = obs.x - cam.x;
        if (ArcadeEngine.collideAABB(
          { x: p.x, y: p.y, w: p.w, h: p.ducking ? p.h * 0.5 : p.h },
          { x: osx, y: obs.y, w: obs.w, h: obs.h }
        )) {
          if (obs.type === OBS_AC && obs.hp > 0) {
            // Break it
            obs.hp--;
            if (obs.hp <= 0) {
              obs.active = false;
              this.addScore(100);
              this._spawnParticles(obs.x, obs.y, '💥', 5);
              // Chance to drop intel
              if (Math.random() < 0.4) {
                this._collectibles.push({
                  x: obs.x, y: obs.y - T,
                  type: 'intel', collected: false
                });
              }
            }
          } else {
            // Damage player
            this._playerHit();
          }
        }
      }
    }

    // ── Collectible pickup ──
    for (var c = 0; c < this._collectibles.length; c++) {
      var col = this._collectibles[c];
      if (col.collected) continue;
      var csx = col.x - cam.x;
      if (Math.abs(p.x + p.w / 2 - csx) < T && Math.abs(p.y + p.h / 2 - col.y) < T) {
        col.collected = true;
        if (col.type === 'intel') {
          this._intelCount++;
          this.addScore(200);
          this._spawnParticles(col.x, col.y, '💼', 3);
        } else {
          this.addScore(50);
          this._spawnParticles(col.x, col.y, '✨', 3);
        }
        this.playSFX('collect');
      }
    }

    // ── Laser blink timer ──
    for (var lo = 0; lo < this._obstacles.length; lo++) {
      if (this._obstacles[lo].type === OBS_LASER) {
        this._obstacles[lo].blinkTimer = (this._obstacles[lo].blinkTimer + 1) % 90;
      }
    }

    // ── Enemy spawning (every 2000m) ──
    if (this._distance > 500 && this._enemies.length === 0 && Math.random() < 0.002 * this._difficulty) {
      this._enemies.push({
        x: cam.x + W + 50,
        y: H * 0.15,
        type: 'drone',
        hp: 3,
        fireTimer: 120
      });
    }

    // ── Enemy AI ──
    for (var ei = 0; ei < this._enemies.length; ei++) {
      var en = this._enemies[ei];
      // Track player X with lag
      var targetX = p.x + cam.x;
      en.x = this._lerp(en.x, targetX, 0.02);
      en.fireTimer--;
      if (en.fireTimer <= 0) {
        en.fireTimer = 100 + Math.floor(Math.random() * 40);
        // Fire projectile downward
        this._projectiles.push({
          x: en.x, y: en.y + T * 0.5,
          vx: 0, vy: 4,
          enemy: true
        });
      }

      // Remove if far behind
      if (en.x < cam.x - 200) {
        this._enemies.splice(ei, 1);
        ei--;
      }
    }

    // ── Projectile update ──
    for (var pi = this._projectiles.length - 1; pi >= 0; pi--) {
      var pr = this._projectiles[pi];
      pr.x += pr.vx;
      pr.y += pr.vy;

      // Enemy projectile hits player
      if (pr.enemy && p.invulnTimer <= 0) {
        var psx = pr.x - cam.x;
        if (Math.abs(psx - (p.x + p.w / 2)) < T * 0.6 &&
            Math.abs(pr.y - (p.y + p.h / 2)) < T * 0.6) {
          this._playerHit();
          this._projectiles.splice(pi, 1);
          continue;
        }
      }

      // Off-screen removal
      if (pr.y > H + 50 || pr.y < -50 || pr.x < cam.x - 100 || pr.x > cam.x + W + 100) {
        this._projectiles.splice(pi, 1);
      }
    }

    // ── Particle update ──
    for (var pp = this._particles.length - 1; pp >= 0; pp--) {
      var part = this._particles[pp];
      part.x += part.vx;
      part.y += part.vy;
      part.vy += 0.1;
      part.life--;
      if (part.life <= 0) {
        this._particles.splice(pp, 1);
      }
    }

    // ── Goat position history ──
    this._posHistory[this._posHistoryIdx] = {
      x: p.x + cam.x,
      y: p.y
    };
    this._posHistoryIdx = (this._posHistoryIdx + 1) % POS_HISTORY_LEN;

    // ── Goat follower update ──
    for (var gi = 0; gi < this._goats.length; gi++) {
      var goat = this._goats[gi];
      if (!goat.alive) continue;
      // Read position from history ring buffer
      var histIdx = (this._posHistoryIdx - goat.delay + POS_HISTORY_LEN) % POS_HISTORY_LEN;
      var hist = this._posHistory[histIdx];
      goat.x = this._lerp(goat.x, hist.x - cam.x, 0.15);
      goat.y = this._lerp(goat.y, hist.y, 0.15);

      // Goat fell off screen?
      if (goat.y > H + 100) {
        goat.alive = false;
      }
    }

    // ── Generate more terrain ──
    this._generatePlatforms(W, H);

    // ── Cull off-screen entities ──
    this._cullOffscreen(cam.x);

    // ── Input buffer decay ──
    if (this._inputBuffer.vaultPending) {
      this._inputBuffer.timer -= dt;
      if (this._inputBuffer.timer <= 0) {
        this._inputBuffer.vaultPending = false;
      }
    }

    // ── Strike cooldown ──
    if (this._strikeCooldown > 0) {
      this._strikeCooldown--;
      if (this._strikeCooldown <= 0) {
        this._strikeAvailable = true;
      }
    }

    // ── Invulnerability blink ──

    // ── Tutorial timer ──
    this._tutorialTimer++;
    if (this._tutorialTimer > 300 && this._tutorialPhase < 1) this._tutorialPhase = 1;
    if (this._tutorialTimer > 600 && this._tutorialPhase < 2) this._tutorialPhase = 2;
    if (this._tutorialTimer > 900) this._tutorialPhase = 3; // hide
  };

  // ──────────────────────────────────────────────────────────
  // PLAYER HIT / DEATH
  // ──────────────────────────────────────────────────────────

  GoatRunner.prototype._playerHit = function () {
    this._player.invulnTimer = 90; // 1.5s invulnerability
    this._camera.shakeTimer = 10;
    this._camera.shakeIntensity = 4;
    this.loseLife();
    this.playSFX('hit');
  };

  GoatRunner.prototype._playerDeath = function () {
    // Respawn on the nearest platform ahead of camera
    var cam = this._camera;
    var bestPlat = null;
    for (var i = 0; i < this._platforms.length; i++) {
      var plat = this._platforms[i];
      var sx = plat.x - cam.x;
      if (sx > -50 && sx < this.logicalW * 0.5) {
        bestPlat = plat;
        break;
      }
    }

    if (bestPlat) {
      this._player.x = bestPlat.x - cam.x + 30;
      this._player.y = bestPlat.y - this._player.h;
      this._player.vx = 0;
      this._player.vy = 0;
      this._player.grounded = true;
    } else {
      // Fallback: just put player at center top
      this._player.x = this.logicalW * 0.3;
      this._player.y = this.logicalH * 0.3;
      this._player.vx = 0;
      this._player.vy = 0;
    }

    this._player.invulnTimer = 120;
    this.loseLife();
  };

  // ──────────────────────────────────────────────────────────
  // CULLING
  // ──────────────────────────────────────────────────────────

  GoatRunner.prototype._cullOffscreen = function (camX) {
    var cutoff = camX - 400;

    this._platforms = this._platforms.filter(function (p) {
      return p.x + p.w > cutoff;
    });
    this._obstacles = this._obstacles.filter(function (o) {
      return o.x + o.w > cutoff;
    });
    this._collectibles = this._collectibles.filter(function (c) {
      return c.x > cutoff && !c.collected;
    });
  };

  // ──────────────────────────────────────────────────────────
  // PARTICLES
  // ──────────────────────────────────────────────────────────

  GoatRunner.prototype._spawnParticles = function (worldX, worldY, emoji, count) {
    for (var i = 0; i < count; i++) {
      this._particles.push({
        x: worldX,
        y: worldY,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 1) * 3,
        text: emoji,
        life: 20 + Math.floor(Math.random() * 15)
      });
    }
  };

  // ──────────────────────────────────────────────────────────
  // LIFECYCLE: onDraw
  // ──────────────────────────────────────────────────────────

  GoatRunner.prototype.onDraw = function (ctx, W, H) {
    var cam = this._camera;
    var T = this._T;
    var p = this._player;

    // Screen shake offset
    var shakeX = 0, shakeY = 0;
    if (cam.shakeTimer > 0) {
      shakeX = (Math.random() - 0.5) * cam.shakeIntensity;
      shakeY = (Math.random() - 0.5) * cam.shakeIntensity;
    }
    ctx.save();
    ctx.translate(shakeX, shakeY);

    // ── Parallax background ──
    for (var li = 0; li < PARALLAX.length; li++) {
      var layer = PARALLAX[li];
      ctx.fillStyle = layer.color;

      // Draw buildings as silhouette rects
      var layerOffset = cam.x * layer.speed;
      var buildingW = 40 + li * 20;
      var spacing = buildingW + 15;
      var startX = -(layerOffset % spacing);

      for (var bx = startX; bx < W + spacing; bx += spacing) {
        var bh = (30 + Math.abs(Math.sin(bx * 0.01 + li * 2)) * 80) * (0.5 + li * 0.3);
        var by = H * layer.y;
        ctx.fillRect(bx, by, buildingW, bh);
      }
    }

    // ── Platforms ──
    for (var pi = 0; pi < this._platforms.length; pi++) {
      var plat = this._platforms[pi];
      var sx = plat.x - cam.x;
      if (sx > W + 50 || sx + plat.w < -50) continue;

      // Platform body
      ctx.fillStyle = '#1a3a2a';
      ctx.fillRect(sx, plat.y, plat.w, plat.h);

      // Phosphor edge glow
      ctx.strokeStyle = this.colors.phosphorDim;
      ctx.lineWidth = 1;
      ctx.shadowColor = this.colors.phosphor;
      ctx.shadowBlur = 4;
      ctx.strokeRect(sx, plat.y, plat.w, plat.h);
      ctx.shadowBlur = 0;
    }

    // ── Obstacles ──
    for (var oi = 0; oi < this._obstacles.length; oi++) {
      var obs = this._obstacles[oi];
      if (!obs.active) continue;
      var osx = obs.x - cam.x;
      if (osx > W + 50 || osx + obs.w < -50) continue;

      if (obs.type === OBS_DISH) {
        this.drawEmoji(ctx, '📡', osx + obs.w / 2, obs.y + obs.h / 2, T * 0.7);
      } else if (obs.type === OBS_AC) {
        this.drawEmoji(ctx, '📦', osx + obs.w / 2, obs.y + obs.h / 2, T * 0.6);
      } else if (obs.type === OBS_LASER) {
        // Blink: on for 45 frames, off for 45
        if (obs.blinkTimer <= 45) {
          ctx.strokeStyle = '#ff4757';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#ff4757';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.moveTo(osx, obs.y + obs.h / 2);
          ctx.lineTo(osx + obs.w, obs.y + obs.h / 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }
    }

    // ── Collectibles ──
    for (var ci = 0; ci < this._collectibles.length; ci++) {
      var col = this._collectibles[ci];
      if (col.collected) continue;
      var csx = col.x - cam.x;
      if (csx < -50 || csx > W + 50) continue;

      var bobY = col.y + Math.sin(this._distance * 0.02 + ci) * 3;
      if (col.type === 'intel') {
        this.drawEmoji(ctx, '💼', csx, bobY, T * 0.5, { glow: true, glowColor: this.colors.amber });
      } else {
        this.drawEmoji(ctx, '🪙', csx, bobY, T * 0.4, { glow: true });
      }
    }

    // ── Goat followers ──
    for (var gi = 0; gi < this._goats.length; gi++) {
      var goat = this._goats[gi];
      if (!goat.alive) continue;
      this.drawEmoji(ctx, '🐐', goat.x, goat.y + T * 0.3, T * 0.5, {
        alpha: 0.6,
        glow: true,
        glowColor: this.colors.phosphorDim,
        glowRadius: 4
      });
    }

    // ── Player ──
    if (p.invulnTimer <= 0 || Math.floor(p.invulnTimer / 4) % 2 === 0) {
      var playerEmoji = p.ducking ? '🏃' : (p.grounded ? '🏃' : '🤸');
      var playerSize = p.ducking ? T * 0.7 : T * 1.0;
      this.drawEmoji(ctx, playerEmoji, p.x + p.w / 2, p.y + p.h / 2, playerSize, {
        glow: true,
        glowColor: this.colors.phosphorBright,
        glowRadius: 6
      });
    }

    // ── Tether line ──
    if (this._tether.active) {
      ctx.strokeStyle = this.colors.amber;
      ctx.lineWidth = 2;
      ctx.shadowColor = this.colors.amber;
      ctx.shadowBlur = 6;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(p.x + p.w / 2, p.y + p.h / 2);
      ctx.lineTo(this._tether.curX, this._tether.curY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
    }

    // ── Enemies ──
    for (var ei = 0; ei < this._enemies.length; ei++) {
      var en = this._enemies[ei];
      var esx = en.x - cam.x;
      this.drawEmoji(ctx, '🛸', esx, en.y, T * 0.8, {
        glow: true,
        glowColor: this.colors.red,
        glowRadius: 6
      });
    }

    // ── Projectiles ──
    for (var pri = 0; pri < this._projectiles.length; pri++) {
      var pr = this._projectiles[pri];
      var prsx = pr.x - cam.x;
      if (pr.enemy) {
        ctx.fillStyle = this.colors.red;
        ctx.shadowColor = this.colors.red;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(prsx, pr.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // ── Particles ──
    for (var ppi = 0; ppi < this._particles.length; ppi++) {
      var part = this._particles[ppi];
      var partSx = part.x - cam.x;
      var alpha = Math.min(1, part.life / 15);
      this.drawEmoji(ctx, part.text, partSx, part.y, T * 0.4, { alpha: alpha });
    }

    ctx.restore(); // end shake

    // ── HUD (not affected by shake) ──
    this._drawHUD(ctx, W, H);

    // ── Tutorial text ──
    this._drawTutorial(ctx, W, H);
  };

  // ──────────────────────────────────────────────────────────
  // HUD
  // ──────────────────────────────────────────────────────────

  GoatRunner.prototype._drawHUD = function (ctx, W, H) {
    // Distance
    this.drawText(ctx, Math.floor(this._distance) + 'm', W - 10, 18, 14,
                  this.colors.phosphor, 'right');

    // Intel count
    if (this._intelCount > 0) {
      this.drawEmoji(ctx, '💼', W - 80, 18, 14);
      this.drawText(ctx, '×' + this._intelCount, W - 68, 18, 12,
                    this.colors.amber, 'left');
    }

    // Lives
    for (var i = 0; i < this.lives; i++) {
      this.drawEmoji(ctx, '❤️', 14 + i * 18, 18, 14);
    }

    // Goat count
    var aliveGoats = 0;
    for (var g = 0; g < this._goats.length; g++) {
      if (this._goats[g].alive) aliveGoats++;
    }
    if (aliveGoats > 0) {
      this.drawEmoji(ctx, '🐐', 14, 38, 12);
      this.drawText(ctx, '×' + aliveGoats, 28, 38, 11, this.colors.phosphorDim, 'left');
    }

    // Strike indicator
    if (this._strikeAvailable) {
      this.drawEmoji(ctx, '⚡', W - 25, 38, 14);
    }
  };

  // ──────────────────────────────────────────────────────────
  // TUTORIAL
  // ──────────────────────────────────────────────────────────

  GoatRunner.prototype._drawTutorial = function (ctx, W, H) {
    if (this._tutorialPhase >= 3) return;

    var text = '';
    if (this._tutorialPhase === 0) {
      text = 'TAP / SPACE to vault over gaps';
    } else if (this._tutorialPhase === 1) {
      text = 'DRAG to tether & control descent';
    } else if (this._tutorialPhase === 2) {
      text = 'DOUBLE-TAP for emergency strike';
    }

    if (text) {
      var alpha = 1;
      // Fade out near phase transitions
      var phaseTime = this._tutorialTimer % 300;
      if (phaseTime > 250) alpha = (300 - phaseTime) / 50;

      ctx.save();
      ctx.globalAlpha = alpha * 0.85;
      this.drawText(ctx, text, W / 2, H - 30, 13, this.colors.phosphorDim, 'center');
      ctx.restore();
    }
  };

  // ──────────────────────────────────────────────────────────
  // RESIZE
  // ──────────────────────────────────────────────────────────

  GoatRunner.prototype.onResize = function (W, H) {
    this._T = Math.max(20, Math.min(BASE_T, W / 18));
  };

  // ──────────────────────────────────────────────────────────
  // UTILITIES
  // ──────────────────────────────────────────────────────────

  GoatRunner.prototype._lerp = function (a, b, t) {
    return a + (b - a) * t;
  };

  // ──────────────────────────────────────────────────────────
  // PAUSE / RESUME (MinigameModal integration)
  // ──────────────────────────────────────────────────────────

  GoatRunner.prototype.pause = function () {
    if (this.state === ArcadeEngine.STATE.PLAYING) {
      this.setState(ArcadeEngine.STATE.PAUSED);
    }
  };

  GoatRunner.prototype.resume = function () {
    if (this.state === ArcadeEngine.STATE.PAUSED) {
      this.setState(ArcadeEngine.STATE.PLAYING);
    }
  };

  // ──────────────────────────────────────────────────────────
  // INSTANTIATE + REGISTER
  // ──────────────────────────────────────────────────────────

  var instance = new GoatRunner();
  var minigame = instance.asMinigame();

  // Self-register with MinigameModal (Phase 1 dynamic registry)
  if (window.MinigameModal && MinigameModal.register) {
    MinigameModal.register('goat-runner', function () { return minigame; });
  }

  // Also expose globally for direct access
  window.GoatRunnerGame = minigame;

})();
