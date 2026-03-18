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
  var OUTLIER_COINS_SM = 1;    // coins for small solo diamond shatter
  var OUTLIER_COINS_LG = 5;    // coins for large solo diamond shatter
  var SHATTER_DURATION = 350;  // ms — shatter particle animation

  // Lens → target suit mapping (Phase 9: panther only)
  var LENS_TARGETS = {
    panther: 'diamond',
    // silver: 'spade',     // Phase 9 future
    // phosphor: 'heart',   // Phase 9 future
  };

  // SFX for transformation and shatter
  var TRANSFORM_SFX = 'snap-3';       // "woop" sound for transformation lock
  var SHATTER_SFX_SM = 'coin-flip';   // small outlier shatter
  var SHATTER_SFX_LG = 'coin-rain';   // big outlier shatter

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
   * Dwell lock complete — either transform or shatter.
   */
  function _onDwellComplete(node) {
    if (_isSoloOutlier(node)) {
      // Solo diamond outlier → shatter into coins
      _shatterOutlier(node);
    } else {
      // Constellation node → transform ♦ to ♣
      _transformNode(node);
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

  /**
   * Shatter a solo diamond outlier into coins.
   */
  function _shatterOutlier(node) {
    var W = window.innerWidth;
    var H = window.innerHeight;
    var sx = node.x * W;
    var sy = node.y * H;

    // Coin amount: random 1 or 5
    var isLarge = Math.random() < 0.25; // 25% chance of 5-coin drop
    var coins = isLarge ? OUTLIER_COINS_LG : OUTLIER_COINS_SM;

    // Play shatter SFX
    if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
      AudioSystem.play(isLarge ? SHATTER_SFX_LG : SHATTER_SFX_SM, { volume: 0.35 });
    }

    // Start shatter animation
    _shatters.push({
      x: sx, y: sy,
      startTime: performance.now(),
      duration: SHATTER_DURATION,
      large: isLarge,
      coins: coins,
    });

    // Remove the node from the renderer
    if (typeof SuitNodeRenderer !== 'undefined') {
      // Mark it as forever so it's removed from active rendering
      var n = SuitNodeRenderer.getNodeById(node.id);
      if (n) n.state = 'forever';
    }

    // Award coins
    try {
      document.dispatchEvent(new CustomEvent('currency-increment', {
        detail: { amount: coins, remaining: 0, total: coins },
      }));
    } catch (e) {}

    console.log('[SuitTransformer] Shattered outlier:', node.id,
                '→', coins, 'coins');
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

    // ── Shatter particles (solo outlier destruction) ──
    for (var i = _shatters.length - 1; i >= 0; i--) {
      var sh = _shatters[i];
      var elapsed = performance.now() - sh.startTime;
      if (elapsed > sh.duration) {
        _shatters.splice(i, 1);
        continue;
      }

      var t = elapsed / sh.duration;
      var fade = 1 - t;
      var numFrags = sh.large ? 8 : 5;

      ctx.save();
      for (var f = 0; f < numFrags; f++) {
        var fragAngle = (f / numFrags) * Math.PI * 2 + t * 2;
        var fragDist = (sh.large ? 25 : 15) * t;
        var fx = sh.x + Math.cos(fragAngle) * fragDist;
        var fy = sh.y + Math.sin(fragAngle) * fragDist;

        // Diamond-shaped fragments (rotated squares)
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate(fragAngle + t * Math.PI);
        ctx.globalAlpha = fade * 0.8;
        ctx.fillStyle = f % 2 === 0 ? 'rgba(255, 48, 144, 0.9)' : '#ffffff';
        ctx.fillRect(-2 * fade, -2 * fade, 4 * fade, 4 * fade);
        ctx.restore();
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

  // ── Solo Diamond Outlier Spawner ──────────────────────
  // Spawns a few standalone diamonds in the starfield that
  // aren't part of any constellation. Shatter for quick coins.

  var _outlierSpawned = false;

  function _spawnOutlierDiamonds() {
    if (_outlierSpawned) return;
    _outlierSpawned = true;
    if (typeof SuitNodeRenderer === 'undefined') return;

    var count = 2 + Math.floor(Math.random() * 3); // 2-4 outliers
    for (var i = 0; i < count; i++) {
      var node = {
        id: 'outlier-d-' + i,
        x: 0.15 + Math.random() * 0.70,
        y: 0.15 + Math.random() * 0.70,
        suit: 'diamond',
      };
      // Register as a standalone node (no constellation)
      SuitNodeRenderer.registerNode(node);
    }
    console.log('[SuitTransformer] Spawned', count, 'solo diamond outliers');
  }

  // ── Init ──────────────────────────────────────────────

  function init() {
    // Restore session transforms
    setTimeout(_restoreTransforms, 500);

    // Spawn solo outlier diamonds
    setTimeout(_spawnOutlierDiamonds, 1000);

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
