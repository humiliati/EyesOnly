/* ============================================================
   SKI FREE — Infiltration Descent
   ArcadeEngine-powered rewrite with emoji entities, touch steering,
   audio, currency, progressive difficulty, and BossAdapter for
   Schweitzer Descent encounter (Floor 22).

   SCROLL CONVENTION: Player descends the mountain. Terrain scrolls
   UPWARD — obstacles spawn at the bottom and rise past the player,
   giving the sensation of sliding downhill. Player sits in the
   upper third of the screen.

   Entities: ⛷️ player, 🌲 tree, 🎄 snow fir, 🗿 rock,
             🏍️ enforcer pursuer, 🏁 extraction, 💰 intel
   ============================================================ */
window.SkiFreeGame = (function () {
  'use strict';

  // ── Emoji palette (Windows-safe) ──
  var EMOJI = {
    player:    '⛷️',
    tree:      '🌲',
    snowFir:   '🎄',
    rock:      '🗿',
    snowBank:  '🏔️',
    enforcer:  '🏍️',
    goal:      '🏁',
    intel:     '💰',
    ice:       '❄️',
    crash:     '💥',
    warning:   '⚠️'
  };

  // ── Weighted obstacle table ──
  var OBSTACLE_TABLE = [
    { emoji: EMOJI.tree,    weight: 40, w: 0.8, h: 1.0, damage: 10 },
    { emoji: EMOJI.snowFir, weight: 15, w: 0.7, h: 0.9, damage: 10 },
    { emoji: EMOJI.rock,    weight: 25, w: 0.9, h: 0.7, damage: 15 },
    { emoji: EMOJI.snowBank, weight: 20, w: 1.0, h: 0.6, damage: 5, breakable: true }
  ];
  var OBSTACLE_TOTAL_WEIGHT = 0;
  for (var oi = 0; oi < OBSTACLE_TABLE.length; oi++) {
    OBSTACLE_TOTAL_WEIGHT += OBSTACLE_TABLE[oi].weight;
  }

  function pickObstacle() {
    var r = Math.random() * OBSTACLE_TOTAL_WEIGHT;
    var acc = 0;
    for (var i = 0; i < OBSTACLE_TABLE.length; i++) {
      acc += OBSTACLE_TABLE[i].weight;
      if (r < acc) return OBSTACLE_TABLE[i];
    }
    return OBSTACLE_TABLE[0];
  }

  // ── Difficulty sections (maps to boss-biomes.json slopeLayout) ──
  var SECTIONS = [
    { name: 'Upper Slopes',  dist: 0,    obstRate: 0.20, iceRate: 0.10, speedMul: 1.0 },
    { name: 'Treeline Run',  dist: 800,  obstRate: 0.30, iceRate: 0.15, speedMul: 1.15 },
    { name: 'Mogul Field',   dist: 2000, obstRate: 0.40, iceRate: 0.20, speedMul: 1.3 },
    { name: 'Chute',         dist: 3500, obstRate: 0.35, iceRate: 0.30, speedMul: 1.5 },
    { name: 'Base Approach',  dist: 5500, obstRate: 0.25, iceRate: 0.25, speedMul: 1.7 }
  ];

  function getSection(dist) {
    var s = SECTIONS[0];
    for (var i = 1; i < SECTIONS.length; i++) {
      if (dist >= SECTIONS[i].dist) s = SECTIONS[i];
    }
    return s;
  }

  // ── Intro state ──
  var INTRO_DURATION = 90;  // frames (~1.5s) for player to scroll in from top

  // ── SkiFree game class ──

  function SkiFree() {
    ArcadeEngine.call(this, {
      gameId: 'ski-free',
      title: 'INFILTRATION DESCENT',
      lives: 1,           // one life — extraction or wipeout
      currencyRate: 0.005  // ¢ = floor(distance × 0.005)
    });

    this.sfxMap = {
      'hop':          'drop-1',
      'crash':        'kitty-1',
      'death':        'kitty-1',
      'game-over':    'game-over-1',
      'near-miss':    'coin-2',
      'level-up':     'toad',
      'game-start':   'power-up-1',
      'intel':        'coin-2',
      'ice-slide':    'water-1',
      'enforcer':     'hit-1',
      'extraction':   'toad'
    };

    // Game state
    this._player = null;
    this._obstacles = [];
    this._icePatches = [];
    this._intel = [];
    this._enforcer = null;
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

    // Intro sequence
    this._introTimer = 0;      // counts up to INTRO_DURATION
    this._introComplete = false;

    // Touch drag state
    this._dragActive = false;
    this._dragX = 0;

    // Enforcer state
    this._enforcerDist = 8;
    this._enforcerSpeed = 0.8;
    this._enforcerAccel = 0.02;
    this._enforcerClose = false;

    // Extraction
    this._extractionDist = 7000;
    this._extracted = false;
  }

  SkiFree.prototype = Object.create(ArcadeEngine.prototype);
  SkiFree.prototype.constructor = SkiFree;

  // ════════════════════════════════════════════════════════════
  // LIFECYCLE HOOKS
  // ════════════════════════════════════════════════════════════

  SkiFree.prototype.onInit = function () {
    this._resetState();
  };

  SkiFree.prototype.onStart = function () {
    this._resetState();
  };

  SkiFree.prototype._resetState = function () {
    var W = this.logicalW;
    var H = this.logicalH;
    this._tileSize = Math.floor(Math.min(W / 14, H / 20));
    if (this._tileSize < 12) this._tileSize = 12;
    var T = this._tileSize;

    // Player resting position: upper third of screen
    this._playerRestY = H * 0.3;

    this._player = {
      x: W / 2,
      y: -T * 2,       // start off-screen top, scroll in during intro
      w: T * 0.8,
      h: T * 1.0,
      hp: 100
    };

    this._obstacles = [];
    this._icePatches = [];
    this._intel = [];
    this._particles = [];
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
    this._dragActive = false;
    this._extracted = false;

    // Intro sequence
    this._introTimer = 0;
    this._introComplete = false;

    // Enforcer starts off-screen, appears after distance 600
    this._enforcer = null;
    this._enforcerDist = 8;
    this._enforcerSpeed = 0.8;
    this._enforcerClose = false;

    // Pre-populate some obstacles BELOW screen (they scroll upward into view)
    for (var i = 0; i < 15; i++) {
      this._spawnObstacleAt(H + (i * 60 + 100 + Math.random() * 80));
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
    // Ignore input during intro
    if (!this._introComplete) return;

    var W = this.logicalW;

    if (type === 'keyaction') {
      if (data.action === 'left') this._steerX = -1;
      else if (data.action === 'right') this._steerX = 1;
      else if (data.action === 'down') this._tuck = true;
      else if (data.action === 'up') this._tuck = false;
    }

    if (type === 'swipe') {
      if (data.direction === 'down') this._tuck = true;
      else if (data.direction === 'up') this._tuck = false;
      else if (data.direction === 'left') this._steerX = -1;
      else if (data.direction === 'right') this._steerX = 1;
    }

    if (type === 'dragstart') {
      this._dragActive = true;
      this._dragX = data.x;
    }
    if (type === 'drag' && this._dragActive) {
      var normalized = (data.x / W) * 2 - 1;
      this._steerX = Math.max(-1, Math.min(1, normalized));
    }
    if (type === 'dragend') {
      this._dragActive = false;
      this._steerX = 0;
    }
  };

  // ════════════════════════════════════════════════════════════
  // UPDATE
  // ════════════════════════════════════════════════════════════

  SkiFree.prototype.onUpdate = function (dt) {
    if (this._extracted) return;

    var W = this.logicalW;
    var H = this.logicalH;
    var T = this._tileSize;

    // ── Intro sequence: player scrolls in from top ──
    if (!this._introComplete) {
      this._introTimer++;
      var introPct = Math.min(1, this._introTimer / INTRO_DURATION);
      // Ease-out cubic
      var eased = 1 - Math.pow(1 - introPct, 3);
      this._player.y = -T * 2 + (this._playerRestY + T * 2) * eased;

      // Slow terrain scroll during intro (visual only)
      this._distance += 0.5;

      if (this._introTimer >= INTRO_DURATION) {
        this._introComplete = true;
        this._player.y = this._playerRestY;
      }

      // Still update particles during intro
      for (var pi = this._particles.length - 1; pi >= 0; pi--) {
        this._particles[pi].life--;
        this._particles[pi].y += 0.5;  // particles drift upward with scroll
        if (this._particles[pi].life <= 0) this._particles.splice(pi, 1);
      }
      return;
    }

    var sec = getSection(this._distance);

    // Section transition flash
    if (sec !== this._lastSection) {
      this._lastSection = sec;
      this._sectionFlash = 120;
    }
    if (this._sectionFlash > 0) this._sectionFlash--;

    // ── Crash recovery ──
    if (this._crashTimer > 0) {
      this._crashTimer--;
      this._speed *= 0.96;
      if (this._speed < 1.0) this._speed = 1.0;
      if (this._crashTimer <= 0) this._crashEmoji = null;
      // Still scroll terrain during crash (slower)
      this._distance += this._speed * 0.3;
      this._scrollTerrain(this._speed * 0.3, H);
      return;
    }

    // ── Speed management ──
    var targetSpeed = this._baseSpeed * sec.speedMul;
    if (this._tuck) targetSpeed *= 1.4;
    if (this._onIce) targetSpeed *= 1.3;

    var turnPenalty = 1 - Math.abs(this._steerX) * 0.15;
    targetSpeed *= turnPenalty;

    this._speed += (targetSpeed - this._speed) * 0.08;
    if (this._speed < 1.0) this._speed = 1.0;
    if (this._speed > this._maxSpeed * sec.speedMul) {
      this._speed = this._maxSpeed * sec.speedMul;
    }

    // ── Distance tracking ──
    this._distance += this._speed;
    this.score = Math.floor(this._distance);

    // ── Player horizontal movement ──
    if (!this._dragActive) {
      if (this.isKeyHeld('left')) this._steerX = -1;
      else if (this.isKeyHeld('right')) this._steerX = 1;
      else this._steerX *= 0.85;
    }

    var moveX = this._steerX * 3.5 * (this._onIce ? 0.5 : 1.0);
    this._player.x += moveX;

    var margin = T * 2;
    if (this._player.x < margin) this._player.x = margin;
    if (this._player.x > W - margin) this._player.x = W - margin;

    // Player stays at rest Y
    this._player.y = this._playerRestY;

    // ── Scroll terrain UPWARD (downhill sensation) ──
    this._scrollTerrain(this._speed, H);

    // ── Ice detection ──
    this._onIce = false;
    for (var ip = this._icePatches.length - 1; ip >= 0; ip--) {
      var ice = this._icePatches[ip];
      if (this._overlaps(this._player, ice)) {
        this._onIce = true;
      }
    }

    // ── Collision + near-miss on obstacles ──
    var nearMiss = false;
    for (var i = this._obstacles.length - 1; i >= 0; i--) {
      var obs = this._obstacles[i];

      if (this._overlaps(this._player, obs)) {
        this._hitObstacle(obs, i);
        continue;
      }

      // Near-miss: obstacle just passed above player (scrolled past)
      if (!obs.nearMissed && obs.y < this._player.y &&
          obs.y > this._player.y - T * 2) {
        var dx = Math.abs(obs.x - this._player.x);
        if (dx < T * 1.2 && dx > T * 0.3) {
          nearMiss = true;
          obs.nearMissed = true;
        }
      }
    }

    if (nearMiss) {
      this._nearMissCombo++;
      var nmBonus = 25 * this._nearMissCombo;
      this.addScore(nmBonus);
      this.playSFX('near-miss');
      this._nearMissTimer = 45;
      this._spawnParticle(this._player.x, this._player.y + T, '✨', 30);
    }
    if (this._nearMissTimer > 0) this._nearMissTimer--;
    else this._nearMissCombo = 0;

    // ── Intel pickups ──
    for (var j = this._intel.length - 1; j >= 0; j--) {
      var pk = this._intel[j];
      if (this._overlaps(this._player, pk)) {
        this._intelCount++;
        this.addScore(200);
        this.playSFX('intel');
        this._spawnParticle(pk.x, pk.y, '+200', 40);
        this._intel.splice(j, 1);
      }
    }

    // ── Spawn new obstacles BELOW screen ──
    if (Math.random() < sec.obstRate * 0.12) {
      this._spawnObstacleAt(H + 30 + Math.random() * 40);
    }

    // ── Spawn ice patches below ──
    if (Math.random() < sec.iceRate * 0.05) {
      this._icePatches.push({
        x: margin + Math.random() * (W - margin * 2),
        y: H + 40,
        w: T * (2 + Math.random() * 2),
        h: T * (1 + Math.random()),
        emoji: EMOJI.ice
      });
    }

    // ── Spawn intel (rare) below ──
    if (Math.random() < 0.003) {
      this._intel.push({
        x: margin + Math.random() * (W - margin * 2),
        y: H + 30,
        w: T * 0.7,
        h: T * 0.7,
        emoji: EMOJI.intel
      });
    }

    // ── Enforcer pursuit — enters from TOP (player's spawn point) ──
    if (this._distance > 600 && !this._enforcer) {
      this._enforcer = {
        x: W / 2,
        y: -T * 3,         // starts above screen (where player came from)
        w: T * 1.2,
        h: T * 1.2,
        emoji: EMOJI.enforcer
      };
      this._enforcerDist = 8;
      this.playSFX('enforcer');
    }

    if (this._enforcer) {
      // Enforcer tracks player X with lag
      var enfDx = this._player.x - this._enforcer.x;
      this._enforcer.x += enfDx * 0.03;

      // Enforcer closes distance over time
      this._enforcerSpeed += this._enforcerAccel * 0.016;
      var relativeApproach = (this._enforcerSpeed - this._speed * 0.85) * 0.5;

      if (this._tuck && this._speed > 3.0) relativeApproach *= 0.3;

      this._enforcerDist -= relativeApproach * 0.016;

      // Enforcer visual position: ABOVE player (chasing from behind/above)
      // As enforcerDist decreases, enforcer gets closer to player's Y
      var enfTargetY = this._playerRestY - this._enforcerDist * T;
      this._enforcer.y += (enfTargetY - this._enforcer.y) * 0.1;

      this._enforcerClose = this._enforcerDist < 3;
      if (this._enforcerDist <= 0) {
        this._player.hp -= 25;
        this.playSFX('crash');
        this._crashTimer = 40;
        this._enforcerDist = 3;
        this._spawnParticle(this._player.x, this._player.y, EMOJI.crash, 30);
        if (this._player.hp <= 0) {
          this._player.hp = 0;
          this.setState(ArcadeEngine.STATE.GAME_OVER);
          return;
        }
      }
    }

    // ── Extraction check ──
    if (this._distance >= this._extractionDist) {
      this._extracted = true;
      this.playSFX('extraction');
      this.addScore(2000);
    }

    // ── Update particles ──
    for (var p = this._particles.length - 1; p >= 0; p--) {
      this._particles[p].life--;
      this._particles[p].y += 0.5;  // drift upward with terrain scroll
      if (this._particles[p].life <= 0) this._particles.splice(p, 1);
    }
  };

  // ── Scroll all terrain entities UPWARD by scrollAmt ──
  SkiFree.prototype._scrollTerrain = function (scrollAmt, H) {
    // Obstacles scroll up
    for (var i = this._obstacles.length - 1; i >= 0; i--) {
      this._obstacles[i].y -= scrollAmt;
      if (this._obstacles[i].y < -50) { this._obstacles.splice(i, 1); }
    }
    // Ice patches scroll up
    for (var ip = this._icePatches.length - 1; ip >= 0; ip--) {
      this._icePatches[ip].y -= scrollAmt;
      if (this._icePatches[ip].y < -50) { this._icePatches.splice(ip, 1); }
    }
    // Intel scrolls up
    for (var j = this._intel.length - 1; j >= 0; j--) {
      this._intel[j].y -= scrollAmt;
      if (this._intel[j].y < -50) { this._intel.splice(j, 1); }
    }
  };

  // ── Obstacle spawning ──

  SkiFree.prototype._spawnObstacleAt = function (y) {
    var W = this.logicalW;
    var T = this._tileSize;
    var margin = T * 2;
    var tpl = pickObstacle();

    this._obstacles.push({
      x: margin + Math.random() * (W - margin * 2),
      y: y,
      w: T * tpl.w,
      h: T * tpl.h,
      emoji: tpl.emoji,
      damage: tpl.damage,
      breakable: tpl.breakable || false,
      nearMissed: false
    });
  };

  // ── Collision handling ──

  SkiFree.prototype._hitObstacle = function (obs, idx) {
    if (obs.emoji === EMOJI.tree || obs.emoji === EMOJI.snowFir) {
      this._treeHit = true;
    }

    this._player.hp -= obs.damage;
    this._crashTimer = obs.breakable ? 15 : 30;
    this._crashEmoji = EMOJI.crash;
    this._spawnParticle(obs.x, obs.y, EMOJI.crash, 25);

    this.sfxMap['crash'] = 'kitty-' + (1 + Math.floor(Math.random() * 3));
    this.playSFX('crash');

    if (obs.breakable) {
      this._obstacles.splice(idx, 1);
    }

    if (this._player.hp <= 0) {
      this._player.hp = 0;
      this.setState(ArcadeEngine.STATE.GAME_OVER);
    }
  };

  SkiFree.prototype._overlaps = function (a, b) {
    var shrink = 0.3;
    var ax = a.x - a.w * shrink;
    var ay = a.y - a.h * shrink;
    var aw = a.w * (1 - shrink * 2);
    var ah = a.h * (1 - shrink * 2);
    var bx = b.x - b.w * shrink;
    var by = b.y - b.h * shrink;
    var bw = b.w * (1 - shrink * 2);
    var bh = b.h * (1 - shrink * 2);
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  };

  SkiFree.prototype._spawnParticle = function (x, y, text, life) {
    this._particles.push({ x: x, y: y, text: text, life: life, maxLife: life });
  };

  // ════════════════════════════════════════════════════════════
  // DRAW
  // ════════════════════════════════════════════════════════════

  SkiFree.prototype.onDraw = function (ctx, W, H) {
    var T = this._tileSize;
    var ph = this.colors.phosphor;
    var dim = this.colors.phosphorDim;

    // ── Background: snow tracks scrolling UPWARD (parallax) ──
    ctx.strokeStyle = dim;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.12;
    // Tracks scroll up: offset increases as distance increases
    var trackOffset = -(this._distance * 0.3) % 40;
    for (var t = 0; t < 8; t++) {
      var tx = (W / 8) * t + Math.sin(t + this._distance * 0.002) * 8;
      ctx.beginPath();
      // Lines run from bottom-ish to top with upward scroll
      ctx.moveTo(tx + Math.sin(this._distance * 0.001 + t) * 15, H);
      ctx.lineTo(tx, trackOffset);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // ── Tree wall borders scrolling UPWARD ──
    var wallTrees = ['🌲', '🎄', '🌲', '🎄', '🌲'];
    // scrollY: trees scroll upward as distance increases
    var wallScrollY = (this._distance * 0.8) % T;  // fractional tile offset
    for (var wy = -T; wy < H + T * 2; wy += T) {
      var drawY = wy + wallScrollY;     // offset scrolls upward naturally
      if (drawY < -T || drawY > H + T) continue;
      var wobble = Math.sin((wy + this._distance) * 0.05) * 3;
      var treeIdx = Math.floor((wy + this._distance) / T);

      // Left wall
      this.drawEmoji(ctx, wallTrees[Math.abs(treeIdx) % wallTrees.length],
        T * 0.5 + wobble, H - drawY, T * 0.9);
      this.drawEmoji(ctx, wallTrees[Math.abs(treeIdx + 3) % wallTrees.length],
        T * 1.3 + wobble * 0.5, H - drawY + T * 0.5, T * 0.7);
      // Right wall
      this.drawEmoji(ctx, wallTrees[Math.abs(treeIdx + 1) % wallTrees.length],
        W - T * 0.5 - wobble, H - drawY, T * 0.9);
      this.drawEmoji(ctx, wallTrees[Math.abs(treeIdx + 2) % wallTrees.length],
        W - T * 1.3 - wobble * 0.5, H - drawY + T * 0.5, T * 0.7);
    }

    // ── Ice patches ──
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#88ccff';
    for (var ip = 0; ip < this._icePatches.length; ip++) {
      var ice = this._icePatches[ip];
      ctx.beginPath();
      ctx.ellipse(ice.x, ice.y, ice.w / 2, ice.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ── Obstacles ──
    for (var i = 0; i < this._obstacles.length; i++) {
      var obs = this._obstacles[i];
      this.drawEmoji(ctx, obs.emoji, obs.x, obs.y, T * 0.9, { glow: true });
    }

    // ── Intel pickups ──
    for (var j = 0; j < this._intel.length; j++) {
      var pk = this._intel[j];
      var bob = Math.sin(Date.now() * 0.005 + j) * 3;
      this.drawEmoji(ctx, pk.emoji, pk.x, pk.y + bob, T * 0.7, { glow: true, glowColor: this.colors.amber });
    }

    // ── Enforcer (pursuer) — above player, chasing from behind ──
    if (this._enforcer && this._enforcer.y > -T * 2) {
      var enfAlpha = Math.min(1, (this._distance - 600) / 200);
      this.drawEmoji(ctx, this._enforcer.emoji, this._enforcer.x, this._enforcer.y,
        T * 1.3, { glow: true, glowColor: '#ff4757', alpha: enfAlpha });

      if (this._enforcerClose) {
        ctx.save();
        ctx.globalAlpha = 0.15 + Math.sin(Date.now() * 0.01) * 0.1;
        ctx.fillStyle = '#ff4757';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }

    // ── Player ──
    if (this._crashTimer > 0 && this._crashTimer % 4 < 2) {
      // Blink during crash stun
    } else {
      var lean = this._steerX * 0.2;
      this.drawEmoji(ctx, EMOJI.player, this._player.x, this._player.y,
        T * 1.1, { glow: true, rotation: lean });
    }

    // ── Crash emoji ──
    if (this._crashEmoji && this._crashTimer > 0) {
      var crashAlpha = this._crashTimer / 30;
      this.drawEmoji(ctx, this._crashEmoji, this._player.x, this._player.y + T,
        T * 0.8, { alpha: crashAlpha });
    }

    // ── Particles ──
    for (var p = 0; p < this._particles.length; p++) {
      var pt = this._particles[p];
      var ptAlpha = pt.life / pt.maxLife;
      if (pt.text.length <= 2) {
        this.drawEmoji(ctx, pt.text, pt.x, pt.y, T * 0.6, { alpha: ptAlpha });
      } else {
        this.drawText(ctx, pt.text, pt.x, pt.y, 11, this.colors.amber, 'center');
      }
    }

    // ── Snow spray particles (speed-based) — spray BEHIND player (above) ──
    if (this._speed > 2.5 && this._crashTimer <= 0 && this._introComplete) {
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.4;
      for (var sp = 0; sp < 3; sp++) {
        var sx = this._player.x + (Math.random() - 0.5) * T;
        var sy = this._player.y - T * 0.5 - Math.random() * T * 0.3;
        ctx.fillRect(sx, sy, 2, 2);
      }
      ctx.globalAlpha = 1;
    }

    // ── HUD ──
    var barW = 80;
    var barH = 6;
    var barX = 8;
    var barY = 6;
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barW, barH);
    var hpPct = this._player ? this._player.hp / 100 : 0;
    ctx.fillStyle = hpPct > 0.5 ? ph : hpPct > 0.25 ? this.colors.amber : this.colors.red;
    ctx.fillRect(barX, barY, barW * hpPct, barH);
    ctx.strokeStyle = ph;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(barX, barY, barW, barH);

    this.drawText(ctx, 'DIST: ' + Math.floor(this._distance) + 'm', barX, barY + barH + 12, 10, ph);
    this.drawText(ctx, 'SPD: ' + this._speed.toFixed(1), barX + 100, barY + barH + 12, 10, dim);

    if (this._intelCount > 0) {
      this.drawText(ctx, EMOJI.intel + ' ×' + this._intelCount, W - 8, 14, 10, this.colors.amber, 'right');
    }

    // Near-miss combo
    if (this._nearMissTimer > 0 && this._nearMissCombo > 0) {
      var nmAlpha = this._nearMissTimer / 45;
      ctx.save();
      ctx.globalAlpha = nmAlpha;
      this.drawText(ctx, 'NEAR MISS ×' + this._nearMissCombo, W / 2, H * 0.55, 14, this.colors.amber, 'center');
      ctx.restore();
    }

    // Section name flash
    if (this._sectionFlash > 0 && this._lastSection) {
      var sfAlpha = Math.min(1, this._sectionFlash / 40);
      ctx.save();
      ctx.globalAlpha = sfAlpha;
      this.drawText(ctx, '— ' + this._lastSection.name.toUpperCase() + ' —', W / 2, H * 0.15, 16, ph, 'center');
      ctx.restore();
    }

    // Intro text
    if (!this._introComplete) {
      var introAlpha = Math.min(1, this._introTimer / 30);
      ctx.save();
      ctx.globalAlpha = introAlpha;
      this.drawText(ctx, '— SCHWEITZER DESCENT —', W / 2, H * 0.55, 14, ph, 'center');
      this.drawText(ctx, 'INITIATING DROP...', W / 2, H * 0.62, 10, dim, 'center');
      ctx.restore();
    }

    // Enforcer proximity warning
    if (this._enforcerClose) {
      var warnPulse = 0.5 + Math.sin(Date.now() * 0.015) * 0.5;
      ctx.save();
      ctx.globalAlpha = warnPulse;
      this.drawText(ctx, EMOJI.warning + ' ENFORCER CLOSING', W / 2, H * 0.88, 12, this.colors.red, 'center');
      ctx.restore();
    }

    // Extraction progress bar
    if (this._distance > this._extractionDist * 0.5) {
      var extPct = Math.min(1, this._distance / this._extractionDist);
      var extBarW = W * 0.6;
      var extBarX = (W - extBarW) / 2;
      var extBarY = H - 14;
      ctx.fillStyle = '#222';
      ctx.fillRect(extBarX, extBarY, extBarW, 4);
      ctx.fillStyle = ph;
      ctx.fillRect(extBarX, extBarY, extBarW * extPct, 4);
      this.drawText(ctx, EMOJI.goal, extBarX + extBarW + 6, extBarY + 2, 10);
    }

    // ── Extraction overlay ──
    if (this._extracted) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);
      this.drawEmoji(ctx, EMOJI.goal, W / 2, H * 0.35, T * 2, { glow: true });
      this.drawText(ctx, 'EXTRACTED', W / 2, H * 0.5, 22, this.colors.phosphorBright, 'center');
      this.drawText(ctx, 'DISTANCE: ' + Math.floor(this._distance) + 'm', W / 2, H * 0.6, 14, ph, 'center');
      if (this._intelCount > 0) {
        this.drawText(ctx, 'INTEL: ' + this._intelCount + ' PACKAGES', W / 2, H * 0.67, 12, this.colors.amber, 'center');
      }
      if (!this._treeHit) {
        this.drawText(ctx, '★ PERFECT DESCENT ★', W / 2, H * 0.75, 14, this.colors.amber, 'center');
      }
      ctx.restore();
    }
  };

  // ════════════════════════════════════════════════════════════
  // BOSS ADAPTER — Schweitzer Descent (Floor 22)
  // ════════════════════════════════════════════════════════════

  SkiFree.prototype.onBossMount = function (combatState) {
    this._resetState();
    if (combatState && combatState.playerHP) {
      this._player.hp = Math.min(100, combatState.playerHP);
    }
    this._extractionDist = 5000;
    // Boss mode: skip intro, enforcer appears immediately
    this._introComplete = true;
    this._player.y = this._playerRestY;
    this._enforcer = {
      x: this.logicalW / 2,
      y: -this._tileSize * 3,
      w: this._tileSize * 1.2,
      h: this._tileSize * 1.2,
      emoji: EMOJI.enforcer
    };
    this._enforcerDist = 8;
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
      hazards.push({
        x: o.x - o.w / 2,
        y: o.y - o.h / 2,
        w: o.w,
        h: o.h,
        damage: o.damage
      });
    }
    if (this._enforcer) {
      hazards.push({
        x: this._enforcer.x - this._enforcer.w / 2,
        y: this._enforcer.y - this._enforcer.h / 2,
        w: this._enforcer.w,
        h: this._enforcer.h,
        damage: 25
      });
    }
    return hazards;
  };

  SkiFree.prototype.onMythicCheck = function () {
    return !this._treeHit && this._extracted;
  };

  // ── Create singleton + expose as MinigameModal-compatible interface ──

  var instance = new SkiFree();

  // ── Register with BossFloorRegistry for Schweitzer Descent (Floor 22) ──
  if (typeof BossFloorRegistry !== 'undefined' && BossFloorRegistry.registerMinigame) {
    BossFloorRegistry.registerMinigame('overlord', {
      id: 'ski-free',
      name: 'Infiltration Descent',
      init: function (ctx) { instance.onBossMount(ctx); },
      tick: function (ctx) { instance.updateRealTime(16); },
      render: function (ctx) { /* handled by ArcadeEngine RAF loop */ },
      isComplete: function () { return instance._extracted || instance._player.hp <= 0; },
      getResult: function () { return instance.unmount(); }
    });
  }

  return instance.asMinigame();
})();
