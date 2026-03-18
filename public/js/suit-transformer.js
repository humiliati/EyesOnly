/* ============================================================
   Suit Transformer — Phase 9
   ============================================================
   Handles lens-based suit transformations. Each non-club suit
   requires a specific card's lens to convert it to ♣ (club),
   making it connectable by the gold lens constellation tracer.

   Phase 9 ships: Panther lens → Diamond (♦→♣) transformation.

   Mechanics:
     - Panther porthole overlaps a ♦ diamond node
     - Hold for DWELL_FRAMES (~300ms) — progress ring fills
     - On complete: diamond transforms to club with pink→gold shift
     - Transformed state persists in sessionStorage
     - Solo diamond outliers (not in any constellation) shatter
       directly into coins on lock-on instead of transforming

   Phase 11 awareness:
     - Diamond volatility: transformed ♦→♣ nodes are unstable
     - Timer starts on transformation (not yet implemented)
     - Hook point: _onTransformComplete callback for decay timer

   Uses the same dwell-to-confirm pattern as constellation tracer's
   highlight phase (8 frames dwell before pickup).

   Usage:
     SuitTransformer.init()
     SuitTransformer.beginSession(lensType)  // 'panther'
     SuitTransformer.updateCursor(cx, cy)
     SuitTransformer.endSession()
   ============================================================ */

;(function (root) {
  'use strict';

  // ── Config ──────────────────────────────────────────────

  var DWELL_FRAMES    = 18;    // ~300ms at 60fps to lock on and transform
  var HIT_RADIUS      = 48;    // px — same as constellation tracer
  var SHATTER_DURATION = 350;  // ms — shatter/effect particle animation

  // ── Lens → target suit mapping ──
  // Each card's lens targets a different suit for transformation.
  var LENS_TARGETS = {
    panther:  'diamond',  // ♦ → ♣ (refract: prism splits, re-forms as club)
    silver:   'spade',    // ♠ → ♣ (amplify: dim spade brightens to club)
    phosphor: 'heart',    // ♥ → ♣ (reveal: invisible heart warms into club)
  };

  // ── Per-suit outlier mechanics ──
  // Solo outliers (not in a constellation) have unique interactions per suit.
  //
  // ♦ Diamond outliers: SHATTER → coins (1 or 5, immediate)
  //   Diamonds are brittle. Lock on → they crack and burst into currency.
  //   Phase 11 adds volatility timer to constellation diamonds.
  //
  // ♠ Spade outliers: ABSORB → satellite clear radius
  //   Spades are magnets. Lock on → they pulse and push all satellites
  //   within a radius away from the area. Like a chaff flare. Grants
  //   a brief safe zone. No coins — tactical value instead.
  //   Phase 10 adds spade chains (absorb 3+ in a row = bonus).
  //
  // ♥ Heart outliers: GAMBLE → coin jackpot OR damage pulse
  //   Hearts are wild. Lock on → outcome roulette.
  //   70% = coin burst (3-8 coins). 20% = double (10 coins).
  //   10% = broken heart (0 coins + screen flash, cosmetic scare).
  //   Phase 11 adds real broken heart damage to nearby forever pixels.

  var OUTLIER_CONFIG = {
    diamond: {
      sfxSmall: 'coin-flip',
      sfxLarge: 'coin-rain',
      coinsSmall: 1,
      coinsLarge: 5,
      largeChance: 0.25,
      effect: 'shatter',
    },
    spade: {
      sfx: 'snap-2',
      clearRadius: 150,        // px — satellite push-away radius
      clearDuration: 2000,     // ms — safe zone lasts this long
      effect: 'absorb',
    },
    heart: {
      sfxWin: 'coin-rain',
      sfxJackpot: 'coin-pouch-1',
      sfxBroken: 'snap-4',
      outcomes: [
        { weight: 70, type: 'win',     coins: 5,  label: 'Healthy' },
        { weight: 20, type: 'jackpot', coins: 10, label: 'Wild' },
        { weight: 10, type: 'broken',  coins: 0,  label: 'Broken' },
      ],
      effect: 'gamble',
    },
  };

  // SFX for constellation node transformation (not outlier)
  var TRANSFORM_SFX = 'snap-3';

  // ── State ──────────────────────────────────────────────

  var _enabled = false;
  var _lensType = null;       // 'panther', 'silver', 'phosphor'
  var _targetSuit = null;     // 'diamond', 'spade', 'heart'
  var _cursorX = 0;
  var _cursorY = 0;

  // Dwell lock state
  var _dwellTarget = null;    // node being locked onto
  var _dwellFrames = 0;       // frames spent dwelling
  var _dwellComplete = false; // true when dwell completes (prevents re-trigger)

  // Shatter animations (solo outlier destruction)
  var _shatters = [];

  // Session persistence
  var PERSIST_KEY = 'eyesonly_transformed_nodes';
  var _unhookFn = null;

  // ── Solo Outlier Detection ────────────────────────────

  /**
   * Check if a diamond node is a solo outlier (not part of any constellation).
   * Solo outliers shatter to coins instead of transforming.
   */
  function _isSoloOutlier(node) {
    return !node.constellation;
  }

  // ── Dwell + Transform ─────────────────────────────────

  function updateCursor(cx, cy) {
    if (!_enabled || !_targetSuit) return;
    _cursorX = cx;
    _cursorY = cy;

    if (typeof SuitNodeRenderer === 'undefined') return;

    // Find nearest target-suit node within hit radius
    var candidate = SuitNodeRenderer.hitTest(cx, cy, HIT_RADIUS, _targetSuit);

    if (!candidate) {
      // Cursor left the node — reset dwell
      if (_dwellTarget) {
        SuitNodeRenderer.resetNode(_dwellTarget.id);
        _dwellTarget = null;
        _dwellFrames = 0;
        _dwellComplete = false;
      }
      return;
    }

    // Same node as before — continue dwelling
    if (_dwellTarget && _dwellTarget.id === candidate.id) {
      if (_dwellComplete) return; // already transformed this node

      _dwellFrames++;

      // Highlight the node during dwell
      SuitNodeRenderer.highlightNode(candidate.id);

      if (_dwellFrames >= DWELL_FRAMES) {
        _dwellComplete = true;
        _onDwellComplete(candidate);
      }
      return;
    }

    // New node — reset and start fresh dwell
    if (_dwellTarget) {
      SuitNodeRenderer.resetNode(_dwellTarget.id);
    }
    _dwellTarget = candidate;
    _dwellFrames = 0;
    _dwellComplete = false;
    SuitNodeRenderer.highlightNode(candidate.id);
  }

  /**
   * Dwell lock complete — constellation node transforms, outlier does per-suit mechanic.
   */
  function _onDwellComplete(node) {
    if (!_isSoloOutlier(node)) {
      // Constellation node → transform to ♣
      _transformNode(node);
      return;
    }

    // Solo outlier — dispatch to per-suit handler
    var config = OUTLIER_CONFIG[node.suit];
    if (!config) return;

    switch (config.effect) {
      case 'shatter':  _outlierShatter(node, config);  break;
      case 'absorb':   _outlierAbsorb(node, config);   break;
      case 'gamble':   _outlierGamble(node, config);   break;
    }
  }

  /**
   * Transform a constellation diamond node to club.
   */
  function _transformNode(node) {
    if (typeof SuitNodeRenderer === 'undefined') return;

    SuitNodeRenderer.transformNode(node.id);

    // Play transform SFX
    if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
      AudioSystem.play(TRANSFORM_SFX, { volume: 0.4 });
    }

    // Persist transformation to sessionStorage
    _persistTransform(node.id, _lensType);

    // Dispatch event (Phase 11 hooks into this for decay timer)
    try {
      document.dispatchEvent(new CustomEvent('suit-transformed', {
        detail: {
          nodeId: node.id,
          fromSuit: node.suit,
          toSuit: 'club',
          transformedBy: _lensType,
          constellation: node.constellation,
          timestamp: Date.now(),
        },
      }));
    } catch (e) {}

    console.log('[SuitTransformer] Transformed:', node.id,
                node.suit, '→ ♣ via', _lensType);
  }

  // ══════════════════════════════════════════════════════════
  //  OUTLIER HANDLERS (per-suit unique mechanics)
  // ══════════════════════════════════════════════════════════

  /**
   * ♦ Diamond outlier → SHATTER into coins.
   * Diamonds are brittle. Lock on → crack → burst into currency.
   */
  function _outlierShatter(node, cfg) {
    var W = window.innerWidth, H = window.innerHeight;
    var sx = node.x * W, sy = node.y * H;

    var isLarge = Math.random() < cfg.largeChance;
    var coins = isLarge ? cfg.coinsLarge : cfg.coinsSmall;

    if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
      AudioSystem.play(isLarge ? cfg.sfxLarge : cfg.sfxSmall, { volume: 0.35 });
    }

    _shatters.push({
      x: sx, y: sy, startTime: performance.now(),
      duration: SHATTER_DURATION, suit: 'diamond',
      large: isLarge, coins: coins,
    });

    _removeOutlierNode(node);
    _awardCoins(coins);
    console.log('[SuitTransformer] ♦ Shattered:', node.id, '→', coins, 'coins');
  }

  /**
   * ♠ Spade outlier → ABSORB → satellite clear pulse.
   * Spades are magnets. Lock on → EMP pulse pushes satellites away.
   * Grants a brief safe zone. Tactical value, not coins.
   */
  function _outlierAbsorb(node, cfg) {
    var W = window.innerWidth, H = window.innerHeight;
    var sx = node.x * W, sy = node.y * H;

    if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
      AudioSystem.play(cfg.sfx, { volume: 0.4 });
    }

    // Push satellites away from this point
    if (typeof SatelliteScrubber !== 'undefined') {
      var sats = SatelliteScrubber._getSatellites ? SatelliteScrubber._getSatellites() : [];
      for (var i = 0; i < sats.length; i++) {
        var s = sats[i];
        var satX = s.x * W, satY = s.y * H;
        var dx = satX - sx, dy = satY - sy;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < cfg.clearRadius && dist > 1) {
          var pushForce = (1 - dist / cfg.clearRadius) * 6;
          var angle = Math.atan2(dy, dx);
          s.vx += Math.cos(angle) * pushForce;
          s.vy += Math.sin(angle) * pushForce;
          s.baseVx = s.vx * 0.5;
          s.baseVy = s.vy * 0.5;
        }
      }
    }

    // Absorb animation (expanding ring pulse)
    _shatters.push({
      x: sx, y: sy, startTime: performance.now(),
      duration: 500, suit: 'spade',
      large: true, coins: 0, clearRadius: cfg.clearRadius,
    });

    _removeOutlierNode(node);
    console.log('[SuitTransformer] ♠ Absorbed:', node.id, '→ satellite clear pulse');
  }

  /**
   * ♥ Heart outlier → GAMBLE → coin jackpot OR cosmetic scare.
   * Hearts are wild. Lock on → outcome roulette.
   * Phase 11 upgrades "broken" from cosmetic to real damage.
   */
  function _outlierGamble(node, cfg) {
    var W = window.innerWidth, H = window.innerHeight;
    var sx = node.x * W, sy = node.y * H;

    // Weighted random roll
    var roll = Math.random() * 100;
    var cumulative = 0;
    var outcome = cfg.outcomes[0];
    for (var i = 0; i < cfg.outcomes.length; i++) {
      cumulative += cfg.outcomes[i].weight;
      if (roll < cumulative) { outcome = cfg.outcomes[i]; break; }
    }

    var coins = outcome.coins || 0;

    // SFX varies by outcome
    if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
      if (outcome.type === 'jackpot') AudioSystem.play(cfg.sfxJackpot, { volume: 0.45 });
      else if (outcome.type === 'win')  AudioSystem.play(cfg.sfxWin, { volume: 0.35 });
      else AudioSystem.play(cfg.sfxBroken, { volume: 0.4 });
    }

    // Animation depends on outcome
    _shatters.push({
      x: sx, y: sy, startTime: performance.now(),
      duration: outcome.type === 'broken' ? 500 : SHATTER_DURATION,
      suit: 'heart', outcome: outcome.type,
      large: outcome.type === 'jackpot', coins: coins,
    });

    _removeOutlierNode(node);
    if (coins > 0) _awardCoins(coins);

    // Dispatch gamble event (Phase 11 hooks broken heart damage here)
    try {
      document.dispatchEvent(new CustomEvent('heart-gamble', {
        detail: {
          nodeId: node.id, x: node.x, y: node.y,
          outcome: outcome.type, coins: coins,
        },
      }));
    } catch (e) {}

    console.log('[SuitTransformer] ♥ Gamble:', node.id, '→',
                outcome.label, '(' + coins + ' coins)');
  }

  // ── Shared outlier helpers ────────────────────────────

  function _removeOutlierNode(node) {
    if (typeof SuitNodeRenderer !== 'undefined') {
      var n = SuitNodeRenderer.getNodeById(node.id);
      if (n) n.state = 'forever';
    }
  }

  function _awardCoins(amount) {
    if (amount <= 0) return;
    try {
      document.dispatchEvent(new CustomEvent('currency-increment', {
        detail: { amount: Math.floor(amount), remaining: 0, total: Math.floor(amount) },
      }));
    } catch (e) {}
  }

  // ── Persistence ───────────────────────────────────────

  function _persistTransform(nodeId, lensType) {
    try {
      var raw = sessionStorage.getItem(PERSIST_KEY) || '{}';
      var data = JSON.parse(raw);
      data[nodeId] = { by: lensType, at: Date.now() };
      sessionStorage.setItem(PERSIST_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  /**
   * Restore transformations from sessionStorage on page load.
   */
  function _restoreTransforms() {
    try {
      var raw = sessionStorage.getItem(PERSIST_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (typeof SuitNodeRenderer === 'undefined') return;
      var restored = 0;
      for (var nodeId in data) {
        if (SuitNodeRenderer.transformNode(nodeId)) restored++;
      }
      if (restored > 0) {
        console.log('[SuitTransformer] Restored', restored, 'transformations from session');
      }
    } catch (e) {}
  }

  // ── Render Hook (progress ring + shatter particles) ────

  function _renderHook(hookCtx) {
    var ctx = hookCtx.ctx;
    var W = hookCtx.W;
    var H = hookCtx.H;

    // ── Dwell progress ring ──
    if (_enabled && _dwellTarget && !_dwellComplete) {
      var nx = _dwellTarget.x * W;
      var ny = _dwellTarget.y * H;
      var progress = Math.min(1, _dwellFrames / DWELL_FRAMES);

      ctx.save();
      // Pink progress ring for panther lens
      var ringColor = _lensType === 'panther' ? 'rgba(255, 48, 144, 0.9)' :
                      _lensType === 'silver'  ? 'rgba(176, 196, 222, 0.9)' :
                                                'rgba(255, 176, 0, 0.9)';
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(nx, ny, HIT_RADIUS * 0.35, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.stroke();

      // Inner glow intensifies with progress
      ctx.globalAlpha = progress * 0.3;
      ctx.fillStyle = ringColor;
      ctx.beginPath();
      ctx.arc(nx, ny, HIT_RADIUS * 0.25, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // ── Outlier effect animations (per-suit visual) ──
    for (var i = _shatters.length - 1; i >= 0; i--) {
      var sh = _shatters[i];
      var elapsed = performance.now() - sh.startTime;
      if (elapsed > sh.duration) {
        _shatters.splice(i, 1);
        continue;
      }

      var t = elapsed / sh.duration;
      var fade = 1 - t;

      ctx.save();

      if (sh.suit === 'diamond') {
        // ♦ SHATTER: pink diamond fragments spin outward
        var numFrags = sh.large ? 8 : 5;
        for (var f = 0; f < numFrags; f++) {
          var fragAngle = (f / numFrags) * Math.PI * 2 + t * 2;
          var fragDist = (sh.large ? 25 : 15) * t;
          var fx = sh.x + Math.cos(fragAngle) * fragDist;
          var fy = sh.y + Math.sin(fragAngle) * fragDist;
          ctx.save();
          ctx.translate(fx, fy);
          ctx.rotate(fragAngle + t * Math.PI);
          ctx.globalAlpha = fade * 0.8;
          ctx.fillStyle = f % 2 === 0 ? 'rgba(255, 48, 144, 0.9)' : '#ffffff';
          ctx.fillRect(-2 * fade, -2 * fade, 4 * fade, 4 * fade);
          ctx.restore();
        }

      } else if (sh.suit === 'spade') {
        // ♠ ABSORB: expanding steel-blue ring pulse (satellite clear zone)
        var ringRadius = (sh.clearRadius || 150) * t;
        ctx.globalAlpha = fade * 0.5;
        ctx.strokeStyle = 'rgba(176, 196, 222, 0.8)';
        ctx.lineWidth = 2 * fade;
        ctx.beginPath();
        ctx.arc(sh.x, sh.y, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        // Inner shimmer
        ctx.globalAlpha = fade * 0.15;
        ctx.fillStyle = 'rgba(176, 196, 222, 0.4)';
        ctx.beginPath();
        ctx.arc(sh.x, sh.y, ringRadius * 0.8, 0, Math.PI * 2);
        ctx.fill();

      } else if (sh.suit === 'heart') {
        // ♥ GAMBLE: outcome-dependent animation
        if (sh.outcome === 'broken') {
          // Broken: red flash + crack lines
          ctx.globalAlpha = fade * 0.12;
          ctx.fillStyle = 'rgba(255, 30, 30, 0.6)';
          ctx.fillRect(0, 0, W, H);
          // Crack lines from center
          ctx.globalAlpha = fade * 0.6;
          ctx.strokeStyle = '#ff2020';
          ctx.lineWidth = 1;
          for (var cr = 0; cr < 4; cr++) {
            var crAngle = (cr / 4) * Math.PI * 2 + 0.3;
            ctx.beginPath();
            ctx.moveTo(sh.x, sh.y);
            ctx.lineTo(sh.x + Math.cos(crAngle) * 20 * t, sh.y + Math.sin(crAngle) * 20 * t);
            ctx.stroke();
          }
        } else {
          // Win/Jackpot: warm gold burst
          var burstFrags = sh.outcome === 'jackpot' ? 10 : 6;
          for (var hf = 0; hf < burstFrags; hf++) {
            var hAngle = (hf / burstFrags) * Math.PI * 2;
            var hDist = (sh.outcome === 'jackpot' ? 30 : 18) * t;
            var hx = sh.x + Math.cos(hAngle) * hDist;
            var hy = sh.y + Math.sin(hAngle) * hDist;
            ctx.globalAlpha = fade * 0.7;
            ctx.fillStyle = sh.outcome === 'jackpot' ? '#ffdd44' : '#ffe8a0';
            ctx.beginPath();
            ctx.arc(hx, hy, (sh.outcome === 'jackpot' ? 3 : 2) * fade, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  // ── Session Management ────────────────────────────────

  function beginSession(lensType) {
    _enabled = true;
    _lensType = lensType || 'panther';
    _targetSuit = LENS_TARGETS[_lensType] || null;
    _dwellTarget = null;
    _dwellFrames = 0;
    _dwellComplete = false;
  }

  function endSession() {
    if (_dwellTarget && typeof SuitNodeRenderer !== 'undefined') {
      SuitNodeRenderer.resetNode(_dwellTarget.id);
    }
    _enabled = false;
    _lensType = null;
    _targetSuit = null;
    _dwellTarget = null;
    _dwellFrames = 0;
    _dwellComplete = false;
  }

  function isEnabled() { return _enabled; }
  function getLensType() { return _lensType; }

  // ── Solo Outlier Spawner (all suit types) ──────────────
  // Spawns standalone suit nodes across the starfield.
  // Each suit has its own outlier mechanic when locked onto.

  var _outlierSpawned = false;

  function _spawnOutliers() {
    if (_outlierSpawned) return;
    _outlierSpawned = true;
    if (typeof SuitNodeRenderer === 'undefined') return;

    var spawned = 0;

    // ♦ Diamond outliers (2-4): shatter → coins
    var dCount = 2 + Math.floor(Math.random() * 3);
    for (var d = 0; d < dCount; d++) {
      SuitNodeRenderer.registerNode({
        id: 'outlier-d-' + d,
        x: 0.15 + Math.random() * 0.70,
        y: 0.15 + Math.random() * 0.70,
        suit: 'diamond',
      });
      spawned++;
    }

    // ♠ Spade outliers (1-2): absorb → satellite clear pulse
    var sCount = 1 + Math.floor(Math.random() * 2);
    for (var s = 0; s < sCount; s++) {
      SuitNodeRenderer.registerNode({
        id: 'outlier-s-' + s,
        x: 0.15 + Math.random() * 0.70,
        y: 0.15 + Math.random() * 0.70,
        suit: 'spade',
      });
      spawned++;
    }

    // ♥ Heart outliers (1-2): gamble → coin burst or cosmetic scare
    var hCount = 1 + Math.floor(Math.random() * 2);
    for (var h = 0; h < hCount; h++) {
      SuitNodeRenderer.registerNode({
        id: 'outlier-h-' + h,
        x: 0.15 + Math.random() * 0.70,
        y: 0.15 + Math.random() * 0.70,
        suit: 'heart',
      });
      spawned++;
    }

    console.log('[SuitTransformer] Spawned', spawned,
                'outliers (' + dCount + '♦ ' + sCount + '♠ ' + hCount + '♥)');
  }

  // ── Init ──────────────────────────────────────────────

  function init() {
    // Restore session transforms
    setTimeout(_restoreTransforms, 500);

    // Spawn solo outliers (all suit types)
    setTimeout(_spawnOutliers, 1000);

    // Register render hook
    if (typeof EyesOnlyStarfield !== 'undefined' && EyesOnlyStarfield.addPostRenderHook) {
      _unhookFn = EyesOnlyStarfield.addPostRenderHook(_renderHook);
    } else {
      setTimeout(function () {
        if (!_unhookFn && typeof EyesOnlyStarfield !== 'undefined' && EyesOnlyStarfield.addPostRenderHook) {
          _unhookFn = EyesOnlyStarfield.addPostRenderHook(_renderHook);
        }
      }, 1200);
    }

    console.log('[SuitTransformer] Initialized');
  }

  function destroy() {
    if (_unhookFn) { _unhookFn(); _unhookFn = null; }
    endSession();
  }

  // ── Public API ────────────────────────────────────────

  root.SuitTransformer = {
    init:          init,
    destroy:       destroy,
    beginSession:  beginSession,
    endSession:    endSession,
    updateCursor:  updateCursor,
    isEnabled:     isEnabled,
    getLensType:   getLensType,
  };

})(typeof window !== 'undefined' ? window : this);
