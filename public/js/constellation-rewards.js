/* ============================================================
   Constellation Rewards — Phase 8
   ============================================================
   Yield economy + resolution animation pipeline.

   Provides:
     1. Yield calculator  (risk-scaled coin economy)
     2. Coin particle renderer  (canvas sprite system)
     3. Resolution orchestrator (tether pop → burn → fracture → coins → counter)
     4. Audio stack  (coin_rain + coin_flip + coin_pouch + click_release)

   Animation timeline (1.5 s total):
     0 ms    tether pop + glow surge
     150 ms  energy sweep begins (gold pulse along path)
     300 ms  line fracture emitters activate behind pulse
     500 ms  coin waterfall begins (bursts from fracture points + stars)
     1000 ms currency counter starts ticking
     1200 ms coin pouch SFX, last coins fade
     1500 ms counter settles — animation complete

   Usage:
     ConstellationRewards.init()
     ConstellationRewards.play(constellationDef, pathNodeIds, nodeScreenPositions)
   ============================================================ */

;(function (root) {
  'use strict';

  // ══════════════════════════════════════════════════════════
  //  1.  YIELD ECONOMY
  // ══════════════════════════════════════════════════════════

  var BASE_NODE_VALUE   = 3;   // coins per node
  var REVEAL_BONUS      = 2;   // extra per lens-revealed star
  var DIR_CHANGE_BONUS  = 1;   // per direction change
  var INTERSECTION_BONUS = 2;  // per self-intersection
  var MIN_YIELD = 6;
  var MAX_YIELD = 60;

  /**
   * Calculate total coin yield for a resolved constellation.
   * @param {Object} opts
   *   nodeCount      — number of nodes
   *   revealedStars  — how many stars needed lens prep (0 for Phase 8 tutorial)
   *   dirChanges     — number of direction changes in the path
   *   intersections  — number of self-intersections
   * @returns {number} clamped coin yield
   */
  function calculateYield(opts) {
    var n   = opts.nodeCount      || 3;
    var rev = opts.revealedStars  || 0;
    var dir = opts.dirChanges     || 0;
    var ix  = opts.intersections  || 0;

    var base       = n * BASE_NODE_VALUE;
    var revBonus   = rev * REVEAL_BONUS;
    var shapeBonus = dir * DIR_CHANGE_BONUS + ix * INTERSECTION_BONUS;

    var raw = base + revBonus + shapeBonus;

    // Clamp
    if (raw < MIN_YIELD) raw = MIN_YIELD;
    if (raw > MAX_YIELD) raw = MAX_YIELD;
    return raw;
  }

  /**
   * Determine visual intensity tier from yield.
   */
  function _yieldTier(y) {
    if (y <= 10)  return { bursts: 1, coinsPerBurst: 1, trail: false, label: 'tiny' };
    if (y <= 20)  return { bursts: 2, coinsPerBurst: 1, trail: false, label: 'small' };
    if (y <= 35)  return { bursts: 2, coinsPerBurst: 2, trail: true,  label: 'medium' };
    return               { bursts: 3, coinsPerBurst: 2, trail: true,  label: 'large' };
  }


  // ══════════════════════════════════════════════════════════
  //  2.  COIN SPRITE PRELOADER
  // ══════════════════════════════════════════════════════════

  var SPRITE_BASE = '/assets/Sprites/Coin/Coin Flip (animation frames)/';
  var GOLD_FRAMES = [
    'goldcoin-frame1.png', 'goldcoin-frame2.png', 'goldcoin-frame3.png',
    'goldcoin-frame4.png', 'goldcoin-frame5.png', 'goldcoin-frame6.png',
  ];
  var _spriteImages = [];    // loaded Image objects
  var _spritesReady = false;

  function _preloadSprites() {
    var loaded = 0;
    var total = GOLD_FRAMES.length;
    GOLD_FRAMES.forEach(function (name, i) {
      var img = new Image();
      img.onload = function () {
        loaded++;
        if (loaded >= total) {
          _spritesReady = true;
          console.log('[ConstellationRewards] Coin sprites loaded (' + total + ' frames)');
        }
      };
      img.onerror = function () {
        loaded++;
        console.warn('[ConstellationRewards] Failed to load sprite:', name);
        if (loaded >= total) _spritesReady = true;
      };
      img.src = SPRITE_BASE + name;
      _spriteImages[i] = img;
    });
  }


  // ══════════════════════════════════════════════════════════
  //  3.  COIN PARTICLE SYSTEM  (canvas-based)
  // ══════════════════════════════════════════════════════════

  var _particles = [];   // active coin particles
  var _sparks    = [];   // tiny gold spark particles

  var COIN_FPS       = 12;
  var COIN_FRAME_MS  = 1000 / COIN_FPS;        // ~83ms per frame
  var COIN_GRAVITY   = 350;                     // px/s²
  var COIN_FADE_Y    = 80;                      // start fading after 80px fall

  /**
   * Spawn a coin particle at (x, y) with random arc motion.
   */
  function _spawnCoin(x, y, size, delay) {
    _particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 80,          // ±40 px/s
      vy: -(40 + Math.random() * 30),           // slight upward launch
      size: size || 24,
      frame: 0,
      frameTimer: 0,
      age: 0,
      delay: delay || 0,
      opacity: 1,
      active: true,
      depth: Math.random() > 0.7 ? 0.7 : 1.0,  // 30% chance background coin
    });
  }

  /**
   * Spawn a tiny gold spark.
   */
  function _spawnSpark(x, y) {
    _sparks.push({
      x: x, y: y,
      vx: (Math.random() - 0.5) * 100,
      vy: -(60 + Math.random() * 80),
      life: 200 + Math.random() * 150,
      age: 0,
      size: 1 + Math.random() * 1.5,
    });
  }

  /**
   * Update + render all particles onto a canvas context.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} dt — delta time in ms
   */
  function _tickParticles(ctx, dt) {
    var dtSec = dt / 1000;
    var i, p;

    // ── Coins ──
    for (i = _particles.length - 1; i >= 0; i--) {
      p = _particles[i];
      if (p.delay > 0) { p.delay -= dt; continue; }

      p.age += dt;
      p.vy += COIN_GRAVITY * dtSec * p.depth;
      p.x  += p.vx * dtSec * p.depth;
      p.y  += p.vy * dtSec * p.depth;

      // Sprite frame advance
      p.frameTimer += dt;
      if (p.frameTimer >= COIN_FRAME_MS) {
        p.frameTimer -= COIN_FRAME_MS;
        p.frame = (p.frame + 1) % GOLD_FRAMES.length;
      }

      // Fade after falling COIN_FADE_Y
      var fallDist = Math.max(0, p.vy * dtSec);
      if (p.age > 300) {
        p.opacity = Math.max(0, p.opacity - dtSec * 1.8);
      }

      // Remove when invisible or off-screen
      if (p.opacity <= 0 || p.y > window.innerHeight + 50) {
        _particles.splice(i, 1);
        continue;
      }

      // Draw
      if (_spritesReady && _spriteImages[p.frame]) {
        var s = p.size * p.depth;
        ctx.save();
        ctx.globalAlpha = p.opacity * (p.depth < 1 ? 0.5 : 1);
        ctx.drawImage(_spriteImages[p.frame], p.x - s / 2, p.y - s / 2, s, s);
        ctx.restore();
      } else {
        // Fallback: gold circle
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = '#d4a843';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.depth * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // ── Sparks ──
    for (i = _sparks.length - 1; i >= 0; i--) {
      var sp = _sparks[i];
      sp.age += dt;
      sp.x += sp.vx * dtSec;
      sp.y += sp.vy * dtSec;
      sp.vy += 120 * dtSec; // light gravity

      var spLife = 1 - sp.age / sp.life;
      if (spLife <= 0) { _sparks.splice(i, 1); continue; }

      ctx.save();
      ctx.globalAlpha = spLife * 0.8;
      ctx.fillStyle = '#ffe066';
      ctx.shadowColor = '#ffcc00';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.size * spLife, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }


  // ══════════════════════════════════════════════════════════
  //  4.  PATH SAMPLING (parametric t along constellation)
  // ══════════════════════════════════════════════════════════

  /**
   * Build a sampled path from an ordered array of screen-space points.
   * Returns { totalLength, segments[], emitters[] }
   */
  function _buildPathData(points, emitterSpacing) {
    emitterSpacing = emitterSpacing || 30; // px
    var segments = [];
    var totalLength = 0;

    for (var i = 0; i < points.length - 1; i++) {
      var a = points[i], b = points[i + 1];
      var len = Math.hypot(b.x - a.x, b.y - a.y);
      segments.push({ a: a, b: b, length: len, startDist: totalLength });
      totalLength += len;
    }

    // Sample emitters along path
    var emitters = [];
    if (totalLength > 0) {
      var spacing = emitterSpacing / totalLength; // normalized
      for (var t = 0; t <= 1.001; t += spacing) {
        var pt = _samplePath(segments, totalLength, Math.min(t, 1));
        if (pt) {
          pt.t = t;
          emitters.push(pt);
        }
      }
    }

    return { totalLength: totalLength, segments: segments, emitters: emitters };
  }

  function _samplePath(segments, totalLength, t) {
    var target = t * totalLength;
    for (var i = 0; i < segments.length; i++) {
      var s = segments[i];
      if (s.startDist + s.length >= target || i === segments.length - 1) {
        var localT = s.length > 0 ? (target - s.startDist) / s.length : 0;
        localT = Math.max(0, Math.min(1, localT));
        // Also compute perpendicular direction for coin ejection
        var dx = s.b.x - s.a.x;
        var dy = s.b.y - s.a.y;
        var mag = Math.hypot(dx, dy) || 1;
        return {
          x: s.a.x + dx * localT,
          y: s.a.y + dy * localT,
          // Perpendicular (normalized)
          px: -dy / mag,
          py:  dx / mag,
        };
      }
    }
    return null;
  }


  // ══════════════════════════════════════════════════════════
  //  5.  AUDIO STACK
  // ══════════════════════════════════════════════════════════

  var _SFX_BASE = '/audio/coin_sfx/'; // relative path on deployed site
  var _R2_BASE  = null;                // set if R2 CDN configured

  // Check if game has a global audio manager
  // SFX path map — some sounds live in different encoded folders
  var _SFX_PATHS = {
    'coin_rain':          '/encoded_for_r2/coin_sfx/coin_rain',
    'coin_flip':          '/encoded_for_r2/coin_sfx/coin_flip',
    'coin_pouch_1':       '/encoded_for_r2/coin_sfx/coin_pouch_1',
    'clickandrelease-1':  '/encoded_for_r2/new_sfx/clickandrelease-1',
  };

  function _playSound(name, volume, delay) {
    setTimeout(function () {
      try {
        var basePath = _SFX_PATHS[name] || ('/encoded_for_r2/coin_sfx/' + name);

        // If a global audio manager exists, prefer it
        if (typeof EyesOnlyAudio !== 'undefined' && EyesOnlyAudio.play) {
          EyesOnlyAudio.play(name, volume);
          return;
        }

        // Try webm first, fallback mp3
        var audio = new Audio(basePath + '.webm');
        audio.volume = Math.min(1, Math.max(0, volume || 0.5));
        audio.play().catch(function () {
          var mp3 = new Audio(basePath + '.mp3');
          mp3.volume = audio.volume;
          mp3.play().catch(function () {});
        });
      } catch (e) {
        console.warn('[ConstellationRewards] Audio error:', name, e);
      }
    }, delay || 0);
  }

  /**
   * Play the layered audio stack for a resolution event.
   */
  function _playRewardAudio(coinYield, nodeCount) {
    //  0 ms — (tether lock is visual-only, no dedicated SFX)
    // 500 ms — coin rain
    _playSound('coin_rain', 0.45, 500);
    // 600+ ms — coin flip per star, staggered
    for (var i = 0; i < Math.min(nodeCount, 6); i++) {
      _playSound('coin_flip', 0.3, 600 + i * 80);
    }
    // 1200 ms — coin pouch finisher
    _playSound('coin_pouch_1', 0.55, 1200);
    // 1000+ ms — click-release counter ticks
    var ticks = Math.min(Math.ceil(coinYield / 3), 12);
    for (var j = 0; j < ticks; j++) {
      _playSound('clickandrelease-1', 0.2, 1000 + j * 60);
    }
  }


  // ══════════════════════════════════════════════════════════
  //  6.  RESOLUTION ANIMATION ORCHESTRATOR
  // ══════════════════════════════════════════════════════════

  var _anim = null;  // current animation state, or null

  /**
   * Start the full resolution animation.
   * @param {Object}   constellation — def from SuitNodeRenderer
   * @param {string[]} pathIds       — ordered node IDs
   * @param {Object[]} screenPoints  — [{x,y}, ...] in screen space
   * @param {Function} onComplete    — called when animation finishes
   */
  function play(constellation, pathIds, screenPoints, onComplete) {
    if (_anim) return; // already playing

    var nodeCount = pathIds.length;
    var coinYield = calculateYield({
      nodeCount: nodeCount,
      revealedStars: 0,    // Phase 8: all clubs, no lens prep yet
      dirChanges: Math.max(0, nodeCount - 2),
      intersections: 0,
    });

    var tier = _yieldTier(coinYield);
    var pathData = _buildPathData(screenPoints, 30);

    // Determine coin sprite size (match club.star node width)
    var coinSize = 24;
    if (typeof SuitNodeRenderer !== 'undefined' && SuitNodeRenderer.getNodeRadius) {
      coinSize = SuitNodeRenderer.getNodeRadius() * 2;
    }

    // Determine which emitters to activate based on yield
    var activeEmitters = pathData.emitters.slice(0, Math.ceil(coinYield / 3));

    _anim = {
      startTime: performance.now(),
      elapsed: 0,
      duration: 1500,
      constellation: constellation,
      pathIds: pathIds,
      screenPoints: screenPoints,
      pathData: pathData,
      coinYield: coinYield,
      tier: tier,
      coinSize: coinSize,
      activeEmitters: activeEmitters,
      onComplete: onComplete || function () {},

      // Phase tracking
      phase: 'surge',        // surge → sweep → fracture → waterfall → counter → done
      sweepT: 0,             // energy pulse position (0..1)
      fracturedEmitters: {},  // emitter index → true
      coinsSpawned: false,
      counterStarted: false,
      counterValue: 0,
      counterTarget: coinYield,

      // Tether visual state
      tetherGlow: 1,
      tetherWidth: 1.5,
      tetherScale: 1,
      tetherOpacity: 1,

      // Star ignition tracking
      starsIgnited: {},
    };

    // Clear any leftover particles
    _particles = [];
    _sparks = [];

    // Play audio stack
    _playRewardAudio(coinYield, nodeCount);

    console.log('[ConstellationRewards] Playing resolution — yield:', coinYield,
                'tier:', tier.label, 'emitters:', activeEmitters.length);
  }

  /**
   * Called each frame from the starfield render hook.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} W — canvas width
   * @param {number} H — canvas height
   */
  function renderFrame(ctx, W, H) {
    if (!_anim) {
      // Still render lingering particles
      if (_particles.length > 0 || _sparks.length > 0) {
        _tickParticles(ctx, 16);
      }
      return;
    }

    var now = performance.now();
    var dt = Math.min(now - (_anim._lastFrame || now), 50); // cap dt
    _anim._lastFrame = now;
    _anim.elapsed = now - _anim.startTime;

    var t = _anim.elapsed;  // ms elapsed
    var points = _anim.screenPoints;
    var pd = _anim.pathData;

    // ── Phase 1: SURGE (0–150 ms) — tether pop + glow + scale-up ──
    if (t < 150) {
      var surgeT = t / 150;
      _anim.tetherGlow = 1 + surgeT * 3;
      _anim.tetherWidth = 1.5 + surgeT * 4;
      _anim.tetherScale = 1 + surgeT * 0.06;
      _drawTetherPath(ctx, points, _anim);
    }

    // ── Phase 2: ENERGY SWEEP (150–450 ms) — gold pulse along path ──
    else if (t < 450) {
      var sweepProgress = (t - 150) / 300;
      _anim.sweepT = sweepProgress;
      _anim.tetherGlow = 4 - sweepProgress * 2;
      _anim.tetherWidth = 5.5 - sweepProgress * 2;
      _drawTetherPath(ctx, points, _anim);
      _drawEnergyPulse(ctx, pd, sweepProgress);

      // Ignite stars as pulse reaches them
      _igniteStarsAlongPulse(ctx, points, sweepProgress);
    }

    // ── Phase 3: FRACTURE + COIN WATERFALL (450–1200 ms) ──
    else if (t < 1200) {
      var fractureT = (t - 450) / 750;

      // Continue energy sweep to end
      _anim.sweepT = Math.min(1, 0.5 + fractureT * 0.5);

      // Fade tether behind the pulse
      _anim.tetherOpacity = Math.max(0, 1 - fractureT * 1.5);
      _anim.tetherGlow = Math.max(0.5, 2 - fractureT * 2);
      _anim.tetherWidth = Math.max(1, 3.5 - fractureT * 3);
      if (_anim.tetherOpacity > 0) {
        _drawTetherPath(ctx, points, _anim);
      }

      // Fracture emitters: activate as pulse passes
      _activateFractureEmitters(fractureT);

      // Spawn star burst coins (once per star)
      if (t > 500 && !_anim.coinsSpawned) {
        _spawnStarBurstCoins();
        _anim.coinsSpawned = true;
      }
    }

    // ── Phase 4: COUNTER FINISH (1200–1500 ms) ──
    else if (t < 1500) {
      // Just let particles + counter finish
    }

    // ── Phase 5: DONE ──
    else {
      var cb = _anim.onComplete;
      _anim = null;
      cb();
      return;
    }

    // ── Counter update (starts at 1000 ms) ──
    if (t >= 1000 && _anim && _anim.counterValue < _anim.counterTarget) {
      if (!_anim.counterStarted) {
        _anim.counterStarted = true;
        _startCounterAnimation(_anim.counterTarget);
      }
    }

    // ── Tick all particles ──
    _tickParticles(ctx, dt || 16);
  }


  // ── Tether Path Drawing ───────────────────────────────────

  function _drawTetherPath(ctx, points, anim) {
    if (points.length < 2) return;

    ctx.save();
    ctx.globalAlpha = anim.tetherOpacity;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Scale transform (slight zoom toward viewer)
    if (anim.tetherScale > 1) {
      var cx = 0, cy = 0;
      for (var k = 0; k < points.length; k++) {
        cx += points[k].x; cy += points[k].y;
      }
      cx /= points.length; cy /= points.length;
      ctx.translate(cx, cy);
      ctx.scale(anim.tetherScale, anim.tetherScale);
      ctx.translate(-cx, -cy);
    }

    // Glow layer
    ctx.strokeStyle = 'rgba(255,200,60,' + (0.15 * anim.tetherGlow) + ')';
    ctx.lineWidth = anim.tetherWidth * 3;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    // Core line — moving gradient
    var grad = _createFlowGradient(ctx, points, anim);
    ctx.strokeStyle = grad || 'rgba(212,168,67,0.9)';
    ctx.lineWidth = anim.tetherWidth;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var j = 1; j < points.length; j++) {
      ctx.lineTo(points[j].x, points[j].y);
    }
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Create a linear gradient along the path with a flowing gold highlight.
   */
  function _createFlowGradient(ctx, points, anim) {
    if (points.length < 2) return null;
    try {
      var first = points[0], last = points[points.length - 1];
      var grad = ctx.createLinearGradient(first.x, first.y, last.x, last.y);

      var flowOffset = (anim.elapsed * 0.002) % 1;
      // Dark gold → bright gold → white highlight → bright gold → dark gold
      var lo = Math.max(0, flowOffset - 0.15);
      var hi = Math.min(1, flowOffset + 0.15);
      grad.addColorStop(0,    '#8b6914');
      grad.addColorStop(lo,   '#c69200');
      grad.addColorStop(flowOffset, '#fff3b0');
      grad.addColorStop(hi,   '#c69200');
      grad.addColorStop(1,    '#8b6914');
      return grad;
    } catch (e) {
      return null;
    }
  }


  // ── Energy Pulse ──────────────────────────────────────────

  function _drawEnergyPulse(ctx, pathData, sweepT) {
    var pt = _samplePath(pathData.segments, pathData.totalLength, sweepT);
    if (!pt) return;

    ctx.save();
    // Bright core
    ctx.fillStyle = '#fff3b0';
    ctx.shadowColor = '#ffcc00';
    ctx.shadowBlur = 12;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
    ctx.fill();

    // Outer bloom
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#ffdd44';
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }


  // ── Star Ignition ─────────────────────────────────────────

  function _igniteStarsAlongPulse(ctx, points, sweepT) {
    if (!_anim) return;
    // Ignite stars that the pulse has passed
    for (var i = 0; i < points.length; i++) {
      var starT = i / Math.max(1, points.length - 1);
      if (sweepT >= starT && !_anim.starsIgnited[i]) {
        _anim.starsIgnited[i] = true;
        // Flare effect at star
        _drawStarFlare(ctx, points[i]);
        // Sparks
        for (var s = 0; s < 4; s++) {
          _spawnSpark(points[i].x, points[i].y);
        }
      }
    }
  }

  function _drawStarFlare(ctx, pt) {
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffee88';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }


  // ── Fracture Emitters ─────────────────────────────────────

  function _activateFractureEmitters(fractureT) {
    if (!_anim) return;
    var emitters = _anim.activeEmitters;
    var tier = _anim.tier;

    for (var i = 0; i < emitters.length; i++) {
      var em = emitters[i];
      // Activate when pulse passes this emitter's t position
      if (em.t <= (0.5 + fractureT * 0.5) && !_anim.fracturedEmitters[i]) {
        _anim.fracturedEmitters[i] = true;

        // Sparks at fracture point
        for (var s = 0; s < 3; s++) {
          _spawnSpark(em.x, em.y);
        }

        // Coins ejected perpendicular to line
        var numCoins = tier.coinsPerBurst;
        for (var c = 0; c < numCoins; c++) {
          var coin = {
            x: em.x,
            y: em.y,
            vx: em.px * (30 + Math.random() * 40) * (Math.random() > 0.5 ? 1 : -1),
            vy: -(20 + Math.random() * 40),
            size: _anim.coinSize,
            frame: Math.floor(Math.random() * GOLD_FRAMES.length),
            frameTimer: 0,
            age: 0,
            delay: Math.random() * 60,
            opacity: 1,
            active: true,
            depth: Math.random() > 0.7 ? 0.7 : 1.0,
          };
          _particles.push(coin);
        }
      }
    }
  }


  // ── Star Burst Coins ──────────────────────────────────────

  function _spawnStarBurstCoins() {
    if (!_anim) return;
    var points = _anim.screenPoints;
    var tier = _anim.tier;

    for (var i = 0; i < points.length; i++) {
      var pt = points[i];
      var bursts = tier.bursts;

      for (var b = 0; b < bursts; b++) {
        var numCoins = 1 + Math.floor(Math.random() * tier.coinsPerBurst);
        for (var c = 0; c < numCoins; c++) {
          _spawnCoin(pt.x, pt.y, _anim.coinSize, b * 120 + i * 40);
        }
        // Sparks with each burst
        for (var s = 0; s < 2; s++) {
          // Delay sparks to match burst timing
          (function (px, py, delay) {
            setTimeout(function () { _spawnSpark(px, py); }, delay);
          })(pt.x, pt.y, b * 120 + i * 40);
        }
      }
    }
  }


  // ── Currency Counter Animation ────────────────────────────

  var _counterInterval = null;

  function _startCounterAnimation(target) {
    var step = Math.max(1, Math.ceil(target / 8));
    var remaining = target;

    // Dispatch incremental events for any UI counter to consume
    _counterInterval = setInterval(function () {
      var add = Math.min(step, remaining);
      remaining -= add;

      try {
        document.dispatchEvent(new CustomEvent('currency-increment', {
          detail: { amount: add, remaining: remaining, total: target },
        }));
      } catch (e) {}

      if (remaining <= 0) {
        clearInterval(_counterInterval);
        _counterInterval = null;
        // Final settle event
        try {
          document.dispatchEvent(new CustomEvent('currency-settle', {
            detail: { total: target },
          }));
        } catch (e) {}
      }
    }, 60);
  }


  // ══════════════════════════════════════════════════════════
  //  7.  INIT
  // ══════════════════════════════════════════════════════════

  function init() {
    _preloadSprites();
    console.log('[ConstellationRewards] Initialized');
  }

  function isPlaying() {
    return _anim !== null;
  }


  // ══════════════════════════════════════════════════════════
  //  PUBLIC API
  // ══════════════════════════════════════════════════════════

  root.ConstellationRewards = {
    init:           init,
    play:           play,
    renderFrame:    renderFrame,
    isPlaying:      isPlaying,
    calculateYield: calculateYield,

    // Expose for testing
    _yieldTier:     _yieldTier,
    _buildPathData: _buildPathData,
  };

})(typeof window !== 'undefined' ? window : this);
