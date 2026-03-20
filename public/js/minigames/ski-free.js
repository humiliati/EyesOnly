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
    projectile:'•'      // drawn as glowing dot
  };

  // ── Weighted obstacle table ──
  var OBSTACLE_TABLE = [
    { emoji: EMOJI.tree,    weight: 30, w: 0.8, h: 1.0, damage: 10, zBlock: true },
    { emoji: EMOJI.snowFir, weight: 12, w: 0.7, h: 0.9, damage: 10, zBlock: true },
    { emoji: EMOJI.rock,    weight: 20, w: 0.9, h: 0.7, damage: 15, zBlock: false },
    { emoji: EMOJI.snowBank, weight: 38, w: 1.0, h: 0.6, damage: 5, breakable: true, zBlock: false }
  ];
  var OBSTACLE_TOTAL_WEIGHT = 0;
  for (var oi = 0; oi < OBSTACLE_TABLE.length; oi++) OBSTACLE_TOTAL_WEIGHT += OBSTACLE_TABLE[oi].weight;

  function pickObstacle() {
    var r = Math.random() * OBSTACLE_TOTAL_WEIGHT, acc = 0;
    for (var i = 0; i < OBSTACLE_TABLE.length; i++) {
      acc += OBSTACLE_TABLE[i].weight;
      if (r < acc) return OBSTACLE_TABLE[i];
    }
    return OBSTACLE_TABLE[0];
  }

  // ── Difficulty sections ──
  var SECTIONS = [
    { name: 'Upper Slopes',  dist: 0,    obstRate: 0.06, iceRate: 0.10, speedMul: 1.0 },
    { name: 'Treeline Run',  dist: 800,  obstRate: 0.12, iceRate: 0.15, speedMul: 1.15 },
    { name: 'Mogul Field',   dist: 2000, obstRate: 0.20, iceRate: 0.20, speedMul: 1.3 },
    { name: 'Chute',         dist: 3500, obstRate: 0.28, iceRate: 0.30, speedMul: 1.5 },
    { name: 'Base Approach',  dist: 5500, obstRate: 0.22, iceRate: 0.25, speedMul: 1.7 }
  ];

  function getSection(dist) {
    var s = SECTIONS[0];
    for (var i = 1; i < SECTIONS.length; i++) { if (dist >= SECTIONS[i].dist) s = SECTIONS[i]; }
    return s;
  }

  // ── Trail system config ──
  var PLAYER_TRAIL_LEN = 40;   // frames of trail history
  var PURSUER_TRAIL_LEN = 12;  // shorter for perf

  // ── Intro ──
  var INTRO_DURATION = 90;

  // ── Projectile config ──
  var PROJECTILE_SPEED = 6;    // px/frame, travels downhill (positive Y)
  var PROJECTILE_SIZE = 3;
  var PROJECTILE_COOLDOWN = 12; // frames between shots

  // ════════════════════════════════════════════════════════════

  function SkiFree() {
    ArcadeEngine.call(this, {
      gameId: 'ski-free',
      title: 'INFILTRATION DESCENT',
      lives: 1,
      currencyRate: 0.005
    });

    this.sfxMap = {
      'hop':        'drop-1',
      'crash':      'kitty-1',
      'death':      'kitty-1',
      'game-over':  'game-over-1',
      'near-miss':  'coin-2',
      'level-up':   'toad',
      'game-start': 'power-up-1',
      'intel':      'coin-2',
      'ice-slide':  'water-1',
      'shoot':      'drop-1',
      'hit':        'hit-1',
      'kill':       'metal-hit-1',
      'extraction': 'toad'
    };

    this._player = null;
    this._obstacles = [];
    this._icePatches = [];
    this._intel = [];
    this._pursuers = [];         // array of pursuer objects
    this._projectiles = [];
    this._shotCooldown = 0;
    this._distance = 0;
    this._speed = 0;
    this._baseSpeed = 2.0;
    this._maxSpeed = 4.5;
    this._tuck = false;
    this._steerX = 0;
    this._onIce = false;
    this._lastSection = null;
    this._sectionFlash = 0;
    this._nearMissTimer = 0;
    this._nearMissCombo = 0;
    this._crashTimer = 0;
    this._crashEmoji = null;
    this._particles = [];
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
    this._dragX = 0;
    this._dragY = 0;            // Y position for speed control

    // Extraction
    this._extractionDist = 7000;
    this._extracted = false;
    this._extractionTimer = 0;  // animation timer for motorcycle sequence
  }

  SkiFree.prototype = Object.create(ArcadeEngine.prototype);
  SkiFree.prototype.constructor = SkiFree;

  // ════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ════════════════════════════════════════════════════════════

  SkiFree.prototype.onInit = function () { this._resetState(); };
  SkiFree.prototype.onStart = function () { this._resetState(); };

  SkiFree.prototype._resetState = function () {
    var W = this.logicalW, H = this.logicalH;
    this._tileSize = Math.floor(Math.min(W / 14, H / 20));
    if (this._tileSize < 12) this._tileSize = 12;
    var T = this._tileSize;

    this._playerRestY = H * 0.3;
    this._player = { x: W / 2, y: -T * 2, w: T * 0.8, h: T * 1.0, hp: 100 };

    this._obstacles = [];
    this._icePatches = [];
    this._intel = [];
    this._pursuers = [];
    this._projectiles = [];
    this._shotCooldown = 0;
    this._particles = [];
    this._playerTrail = [];
    this._distance = 0;
    this._speed = this._baseSpeed;
    this._tuck = false;
    this._steerX = 0;
    this._onIce = false;
    this._lastSection = null;
    this._sectionFlash = 0;
    this._nearMissTimer = 0;
    this._nearMissCombo = 0;
    this._crashTimer = 0;
    this._crashEmoji = null;
    this._treeHit = false;
    this._intelCount = 0;
    this._killCount = 0;
    this._dragActive = false;
    this._extracted = false;
    this._extractionTimer = 0;
    this._introTimer = 0;
    this._introComplete = false;

    // Sparse initial obstacles below screen
    for (var i = 0; i < 6; i++) {
      this._spawnObstacleAt(H + (i * 100 + 150 + Math.random() * 80));
    }
  };

  SkiFree.prototype.onResize = function (w, h) {
    this._tileSize = Math.floor(Math.min(w / 14, h / 20));
    if (this._tileSize < 12) this._tileSize = 12;
    this._playerRestY = h * 0.3;
    if (this._player) {
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
      // Space = fire projectile
      else if (data.action === 'action') this._fireProjectile();
    }

    // Swipe: left/right steer, up/down speed (legacy fallback)
    if (type === 'swipe') {
      if (data.direction === 'left') this._steerX = -1;
      else if (data.direction === 'right') this._steerX = 1;
    }

    // Drag: X = steer, Y = speed control (bottom = accel, top = decel)
    if (type === 'dragstart') {
      this._dragActive = true;
      this._dragX = data.x;
      this._dragY = data.y;
    }
    if (type === 'drag' && this._dragActive) {
      // Horizontal: steer
      this._steerX = Math.max(-1, Math.min(1, (data.x / W) * 2 - 1));
      // Vertical: bottom = accelerate, top = decelerate
      // Normalize: 0 at top → 1 at bottom
      this._dragY = data.y;
    }
    if (type === 'dragend') {
      this._dragActive = false;
      this._steerX = 0;
      this._tuck = false;
    }

    // Tap = fire projectile
    if (type === 'tap') {
      this._fireProjectile();
    }
  };

  // ════════════════════════════════════════════════════════════
  // UPDATE
  // ════════════════════════════════════════════════════════════

  SkiFree.prototype.onUpdate = function (dt) {
    var W = this.logicalW, H = this.logicalH, T = this._tileSize;

    // ── Extraction animation ──
    if (this._extracted) {
      this._extractionTimer++;
      // Scroll terrain continues slowly
      this._scrollTerrain(0.5, H);
      // Update particles
      this._updateParticles();
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
      this._updateParticles();
      return;
    }

    var sec = getSection(this._distance);

    // Section flash
    if (sec !== this._lastSection) { this._lastSection = sec; this._sectionFlash = 120; }
    if (this._sectionFlash > 0) this._sectionFlash--;

    // ── Crash recovery ──
    if (this._crashTimer > 0) {
      this._crashTimer--;
      this._speed *= 0.96;
      if (this._speed < 1.0) this._speed = 1.0;
      if (this._crashTimer <= 0) this._crashEmoji = null;
      this._distance += this._speed * 0.3;
      this._scrollTerrain(this._speed * 0.3, H);
      this._recordTrail();
      this._updateParticles();
      return;
    }

    // ── Speed: drag Y position controls tuck ──
    if (this._dragActive) {
      var yNorm = this._dragY / H;  // 0=top, 1=bottom
      this._tuck = yNorm > 0.6;     // bottom 40% = tuck/accelerate
      // Top 30% = active brake
      if (yNorm < 0.3) {
        this._speed *= 0.97;
      }
    }

    var targetSpeed = this._baseSpeed * sec.speedMul;
    if (this._tuck) targetSpeed *= 1.4;
    if (this._onIce) targetSpeed *= 1.3;
    targetSpeed *= (1 - Math.abs(this._steerX) * 0.15);

    this._speed += (targetSpeed - this._speed) * 0.08;
    if (this._speed < 0.8) this._speed = 0.8;
    if (this._speed > this._maxSpeed * sec.speedMul) this._speed = this._maxSpeed * sec.speedMul;

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
        if (odx < T * 1.2 && odx > T * 0.3) { nearMiss = true; obs.nearMissed = true; }
      }
    }
    if (nearMiss) {
      this._nearMissCombo++;
      this.addScore(25 * this._nearMissCombo);
      this.playSFX('near-miss');
      this._nearMissTimer = 45;
      this._spawnParticle(this._player.x, this._player.y + T, '✨', 30);
    }
    if (this._nearMissTimer > 0) this._nearMissTimer--; else this._nearMissCombo = 0;

    // ── Intel pickups ──
    for (var j = this._intel.length - 1; j >= 0; j--) {
      if (this._overlaps(this._player, this._intel[j])) {
        this._intelCount++; this.addScore(200); this.playSFX('intel');
        this._spawnParticle(this._intel[j].x, this._intel[j].y, '+200', 40);
        this._intel.splice(j, 1);
      }
    }

    // ── Spawning (density ramps with distance) ──
    // obstRate starts very low (0.06) at Upper Slopes, ramps per section
    var spawnChance = sec.obstRate * (0.8 + this._distance * 0.00005);
    if (spawnChance > 0.45) spawnChance = 0.45;  // cap
    if (Math.random() < spawnChance) this._spawnObstacleAt(H + 30 + Math.random() * 40);

    if (Math.random() < sec.iceRate * 0.05) {
      this._icePatches.push({
        x: margin + Math.random() * (W - margin * 2), y: H + 40,
        w: T * (2 + Math.random() * 2), h: T * (1 + Math.random()), emoji: EMOJI.ice
      });
    }
    if (Math.random() < 0.004) {
      this._intel.push({
        x: margin + Math.random() * (W - margin * 2), y: H + 30,
        w: T * 0.7, h: T * 0.7, emoji: EMOJI.intel
      });
    }

    // ── Pursuer spawning ──
    // First pursuer at ~300m, second at ~3000m, then every ~2500m in arcade
    if (this._pursuers.length === 0 && this._distance > 300) {
      this._spawnPursuer();
    } else if (this._pursuers.length === 1 && this._distance > 3000) {
      this._spawnPursuer();
    } else if (this._pursuers.length >= 2 && this._distance > 3000) {
      // In arcade mode, spawn additional pursuers
      var nextSpawn = 3000 + (this._pursuers.length - 1) * 2500;
      if (this._distance > nextSpawn && this._pursuers.length < 8) {
        this._spawnPursuer();
      }
    }

    // ── Update pursuers ──
    for (var pi = this._pursuers.length - 1; pi >= 0; pi--) {
      this._updatePursuer(this._pursuers[pi], pi);
    }

    // ── Update projectiles ──
    if (this._shotCooldown > 0) this._shotCooldown--;
    for (var pr = this._projectiles.length - 1; pr >= 0; pr--) {
      var proj = this._projectiles[pr];
      proj.y += PROJECTILE_SPEED;  // travel downhill (toward bottom)
      proj.y -= this._speed;       // offset by terrain scroll
      if (proj.y > H + 20 || proj.y < -20) { this._projectiles.splice(pr, 1); continue; }

      // Check hit on pursuers
      for (var pk = this._pursuers.length - 1; pk >= 0; pk--) {
        var pur = this._pursuers[pk];
        if (Math.abs(proj.x - pur.x) < T * 0.8 && Math.abs(proj.y - pur.y) < T * 0.8) {
          pur.hp--;
          this._projectiles.splice(pr, 1);
          this.playSFX('hit');
          this._spawnParticle(pur.x, pur.y, EMOJI.crash, 15);
          if (pur.hp <= 0) {
            this._killPursuer(pk);
          }
          break;
        }
      }
    }

    // ── Extraction check ──
    if (this._distance >= this._extractionDist) {
      this._extracted = true;
      this.playSFX('extraction');
      this.addScore(2000);
    }

    this._updateParticles();
  };

  // ── Trail recording ──
  SkiFree.prototype._recordTrail = function () {
    this._playerTrail.push({ x: this._player.x, y: this._player.y });
    if (this._playerTrail.length > PLAYER_TRAIL_LEN) this._playerTrail.shift();
  };

  // ── Pursuer spawning ──
  SkiFree.prototype._spawnPursuer = function () {
    var W = this.logicalW, T = this._tileSize;
    // HP scales with distance: 1 at start, up to 4 at high distance
    var hp = 1 + Math.floor(this._distance / 2500);
    if (hp > 4) hp = 4;
    this._pursuers.push({
      x: W * 0.3 + Math.random() * W * 0.4,
      y: -T * 4,       // enters from top (player's spawn)
      w: T * 0.9, h: T * 1.0,
      hp: hp, maxHp: hp,
      speed: 0.8 + Math.random() * 0.3,
      accel: 0.015 + this._pursuers.length * 0.005,
      dist: 10,         // tiles behind player
      trail: [],
      alive: true
    });
    this.playSFX('hit');
  };

  // ── Pursuer update ──
  SkiFree.prototype._updatePursuer = function (pur, idx) {
    if (!pur.alive) return;
    var T = this._tileSize;

    // Track player X with lag
    pur.x += (this._player.x - pur.x) * 0.025;

    // Close distance
    pur.speed += pur.accel * 0.016;
    var approach = (pur.speed - this._speed * 0.8) * 0.5;
    if (this._tuck && this._speed > 3.0) approach *= 0.3;
    pur.dist -= approach * 0.016;

    // Visual Y
    var targetY = this._playerRestY - pur.dist * T;
    pur.y += (targetY - pur.y) * 0.08;

    // Trail
    pur.trail.push({ x: pur.x, y: pur.y });
    if (pur.trail.length > PURSUER_TRAIL_LEN) pur.trail.shift();

    // Catch player
    if (pur.dist <= 0.3) {
      this._player.hp -= 20;
      this.playSFX('crash');
      this._crashTimer = 35;
      pur.dist = 3;
      this._spawnParticle(this._player.x, this._player.y, EMOJI.crash, 30);
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
    // Poof + shadow particles
    this._spawnParticle(pur.x, pur.y, EMOJI.poof, 35);
    this._spawnParticle(pur.x, pur.y + 4, '⬛', 50);  // dark shadow lingers
    this._pursuers.splice(idx, 1);
  };

  // ── Fire projectile ──
  SkiFree.prototype._fireProjectile = function () {
    if (this._shotCooldown > 0) return;
    this._shotCooldown = PROJECTILE_COOLDOWN;
    this._projectiles.push({
      x: this._player.x,
      y: this._player.y + this._tileSize * 0.5
    });
    this.playSFX('shoot');
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
    // Scroll player trail too
    for (var t = 0; t < this._playerTrail.length; t++) {
      this._playerTrail[t].y -= amt;
    }
    // Scroll pursuer trails
    for (var p = 0; p < this._pursuers.length; p++) {
      for (var pt = 0; pt < this._pursuers[p].trail.length; pt++) {
        this._pursuers[p].trail[pt].y -= amt;
      }
    }
  };

  // ── Obstacle spawning ──
  SkiFree.prototype._spawnObstacleAt = function (y) {
    var W = this.logicalW, T = this._tileSize, margin = T * 2;
    var tpl = pickObstacle();
    var obs = {
      x: margin + Math.random() * (W - margin * 2), y: y,
      w: T * tpl.w, h: T * tpl.h,
      emoji: tpl.emoji, damage: tpl.damage,
      breakable: tpl.breakable || false,
      zBlock: tpl.zBlock || false,   // can player hide behind this?
      nearMissed: false, drop: null
    };
    // Breakables may contain drops
    if (obs.breakable && Math.random() < 0.6) {
      obs.drop = Math.random() < 0.7 ? 'currency' : 'intel';
    }
    this._obstacles.push(obs);
  };

  // ── Hit obstacle ──
  SkiFree.prototype._hitObstacle = function (obs, idx) {
    if (obs.emoji === EMOJI.tree || obs.emoji === EMOJI.snowFir) this._treeHit = true;
    this._player.hp -= obs.damage;
    this._crashTimer = obs.breakable ? 15 : 30;
    this._crashEmoji = EMOJI.crash;
    this._spawnParticle(obs.x, obs.y, EMOJI.crash, 25);
    this.sfxMap['crash'] = 'kitty-' + (1 + Math.floor(Math.random() * 3));
    this.playSFX('crash');

    if (obs.breakable) {
      // Drop collectible
      if (obs.drop === 'currency') {
        this.addScore(50);
        this._spawnParticle(obs.x, obs.y, '+50', 40);
      } else if (obs.drop === 'intel') {
        this._intelCount++; this.addScore(200);
        this._spawnParticle(obs.x, obs.y, '+200', 40);
      }
      this._spawnParticle(obs.x, obs.y, EMOJI.poof, 20);
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

  SkiFree.prototype._spawnParticle = function (x, y, text, life) {
    this._particles.push({ x: x, y: y, text: text, life: life, maxLife: life });
  };

  SkiFree.prototype._updateParticles = function () {
    for (var p = this._particles.length - 1; p >= 0; p--) {
      this._particles[p].life--;
      this._particles[p].y -= 0.3;
      if (this._particles[p].life <= 0) this._particles.splice(p, 1);
    }
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

    // ── Z-ordered rendering: obstacles below player, then player, then obstacles above ──
    // "Above" = already scrolled past (obs.y < playerY). If a tree-type obstacle
    // is within the top 15-20% proximity zone, it draws ON TOP of the player.
    var belowObs = [], aboveObs = [];
    var hideZone = T * 1.5;  // how far above player an obstacle can be to "cover" them
    for (var oi = 0; oi < this._obstacles.length; oi++) {
      var ob = this._obstacles[oi];
      if (ob.zBlock && ob.y < playerY && ob.y > playerY - hideZone) {
        aboveObs.push(ob);  // these draw ON TOP of the player
      } else {
        belowObs.push(ob);  // normal draw order (below player layer)
      }
    }

    // Draw below-layer obstacles
    for (var bi = 0; bi < belowObs.length; bi++) {
      this.drawEmoji(ctx, belowObs[bi].emoji, belowObs[bi].x, belowObs[bi].y, T * 0.9, { glow: true });
    }

    // ── Intel pickups ──
    for (var ji = 0; ji < this._intel.length; ji++) {
      var pk = this._intel[ji];
      var bob = Math.sin(Date.now() * 0.005 + ji) * 3;
      this.drawEmoji(ctx, pk.emoji, pk.x, pk.y + bob, T * 0.7, { glow: true, glowColor: this.colors.amber });
    }

    // ── Projectiles ──
    ctx.fillStyle = ph;
    for (var pr = 0; pr < this._projectiles.length; pr++) {
      var pj = this._projectiles[pr];
      ctx.save(); ctx.shadowColor = ph; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(pj.x, pj.y, PROJECTILE_SIZE, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // ── Pursuers (⛷️ with dark overlay) ──
    for (var pui = 0; pui < this._pursuers.length; pui++) {
      var pur = this._pursuers[pui];
      if (pur.y < -T * 2) continue;
      // Draw dark skier: use compositing to darken
      ctx.save();
      // Base emoji
      this.drawEmoji(ctx, EMOJI.player, pur.x, pur.y, T * 1.0);
      // Dark overlay: draw a dark rect with multiply-like effect
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(15,15,15,0.75)';
      ctx.fillRect(pur.x - T * 0.6, pur.y - T * 0.6, T * 1.2, T * 1.2);
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
      // HP pips if multi-hit
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

      // Carving: scaleX flips based on direction, narrows during hard turns
      var dir = this._steerX;
      // Flip: going right = normal, going left = mirror
      var flipX = dir < -0.1 ? -1 : 1;
      // Narrow during carving: compress scaleX based on turn intensity via sine
      var turnIntensity = Math.abs(dir);
      var narrowFactor = 1.0 - turnIntensity * 0.35 * (0.5 + 0.5 * Math.sin(Date.now() * 0.008));
      ctx.scale(flipX * narrowFactor, 1);

      // Slight rotation for lean
      ctx.rotate(dir * 0.15);

      ctx.font = Math.floor(T * 1.1) + 'px serif';
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

    // ── Particles ──
    for (var pa = 0; pa < this._particles.length; pa++) {
      var pt2 = this._particles[pa];
      var ptA = pt2.life / pt2.maxLife;
      if (pt2.text.length <= 2) {
        this.drawEmoji(ctx, pt2.text, pt2.x, pt2.y, T * 0.6, { alpha: ptA });
      } else {
        ctx.save(); ctx.globalAlpha = ptA;
        this.drawText(ctx, pt2.text, pt2.x, pt2.y, 11, this.colors.amber, 'center');
        ctx.restore();
      }
    }

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

    // HP bar
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

    // Section flash
    if (this._sectionFlash > 0 && this._lastSection) {
      ctx.save(); ctx.globalAlpha = Math.min(1, this._sectionFlash / 40);
      this.drawText(ctx, '— ' + this._lastSection.name.toUpperCase() + ' —', W / 2, H * 0.15, 16, ph, 'center');
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

    // ── Extraction / Victory sequence ──
    if (this._extracted) {
      var et = this._extractionTimer;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,' + Math.min(0.6, et * 0.01) + ')';
      ctx.fillRect(0, 0, W, H);

      if (et < 60) {
        // Phase 1: motorcycle appears at bottom, player skis toward it
        var motoY = H * 0.7;
        this.drawEmoji(ctx, EMOJI.motorcycle, W / 2, motoY, T * 1.5, { glow: true });
        // Player slides down toward motorcycle
        var slideY = this._playerRestY + (motoY - this._playerRestY) * Math.min(1, et / 50);
        this.drawEmoji(ctx, EMOJI.player, this._player.x, slideY, T * 1.1, { glow: true });
      } else if (et < 80) {
        // Phase 2: poof! player becomes second motorcycle
        var poofAlpha = 1 - (et - 60) / 20;
        this.drawEmoji(ctx, EMOJI.poof, W / 2, H * 0.7, T * 2, { alpha: poofAlpha });
        this.drawEmoji(ctx, EMOJI.motorcycle, W / 2 - T, H * 0.7, T * 1.3, { glow: true });
        if (et > 65) {
          this.drawEmoji(ctx, EMOJI.motorcycle, W / 2 + T, H * 0.7, T * 1.3, { glow: true });
        }
      } else {
        // Phase 3: two motorcycles ride off (scroll down off screen)
        var rideOff = (et - 80) * 3;
        var mY = H * 0.7 - rideOff;
        this.drawEmoji(ctx, EMOJI.motorcycle, W / 2 - T, mY, T * 1.3, { glow: true });
        this.drawEmoji(ctx, EMOJI.motorcycle, W / 2 + T, mY, T * 1.3, { glow: true });

        // Text
        this.drawText(ctx, 'EXTRACTED', W / 2, H * 0.35, 22, this.colors.phosphorBright, 'center');
        this.drawText(ctx, Math.floor(this._distance) + 'm  |  ' + this._killCount + ' PURSUERS FELLED', W / 2, H * 0.45, 12, ph, 'center');
        if (this._intelCount > 0) this.drawText(ctx, 'INTEL: ' + this._intelCount, W / 2, H * 0.52, 12, this.colors.amber, 'center');
        if (!this._treeHit) this.drawText(ctx, '★ PERFECT DESCENT ★', W / 2, H * 0.59, 14, this.colors.amber, 'center');
      }
      ctx.restore();
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
    this._spawnPursuer();  // immediate pursuer in boss mode
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
      var pur = this._pursuers[p];
      hazards.push({ x: pur.x - pur.w / 2, y: pur.y - pur.h / 2, w: pur.w, h: pur.h, damage: 20 });
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
