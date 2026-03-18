/* ============================================================
   Constellation Cascade — Phase 10
   ============================================================
   When a constellation is solved, new nodes ripple outward from
   the solved shape's center, forming the next puzzle in a chain.
   Creates the illusion of the sky "growing" in response to
   the player's achievements.

   Cascade mechanics:
     - Solved constellation dispatches 'constellation-solved' event
     - Cascade manager checks if a chain is defined for this ID
     - If yes: new nodes fade in over 2–3s with ripple from centroid
     - New nodes may include non-club suits (difficulty ramp)
     - Chain can be multi-step: solve A → unlocks B → unlocks C
     - Chains load from /data/cascade-chains.json with inline fallback

   Integration:
     - Listens for 'constellation-solved' events
     - Registers new nodes via SuitNodeRenderer.registerConstellation
     - Persists chain progress in ConstellationGamestate

   Usage:
     ConstellationCascade.init()
   ============================================================ */

;(function (root) {
  'use strict';

  var _chains = null;       // loaded cascade chain definitions
  var _pendingFadeIns = []; // nodes currently fading in
  var _unhookFn = null;

  // Inline fallback chains (used if JSON fetch fails)
  var _FALLBACK_CHAINS = {
    't1-01-triangle': {
      unlocks: 'cascade-arrow',
      newConstellation: {
        id: 'cascade-arrow',
        name: 'The Directive',
        difficulty: 'beginner', tier: 1,
        validation: 'shape', angleConstraints: false,
        nodes: [
          { id: 'ca-1', x: 0.60, y: 0.25, suit: 'club' },
          { id: 'ca-2', x: 0.75, y: 0.40, suit: 'club' },
          { id: 'ca-3', x: 0.60, y: 0.55, suit: 'club' },
          { id: 'ca-4', x: 0.50, y: 0.40, suit: 'club' },
        ],
      },
      fadeDelay: 1500,  // ms after solve before new nodes appear
      fadeDuration: 2500, // ms for the fade-in ripple
    },
  };

  // ── Init ──────────────────────────────────────────────

  function init() {
    _loadChains();

    // Listen for solved constellations
    document.addEventListener('constellation-solved', function (e) {
      var detail = e.detail || {};
      if (detail.constellationId) {
        _checkCascade(detail.constellationId, detail);
      }
    });

    // Register render hook for fade-in animation
    if (typeof EyesOnlyStarfield !== 'undefined' && EyesOnlyStarfield.addPostRenderHook) {
      _unhookFn = EyesOnlyStarfield.addPostRenderHook(_renderFadeIns);
    } else {
      setTimeout(function () {
        if (!_unhookFn && typeof EyesOnlyStarfield !== 'undefined' && EyesOnlyStarfield.addPostRenderHook) {
          _unhookFn = EyesOnlyStarfield.addPostRenderHook(_renderFadeIns);
        }
      }, 1200);
    }

    console.log('[ConstellationCascade] Initialized');
  }

  // ── Chain Loading ─────────────────────────────────────

  function _loadChains() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/data/cascade-chains.json?v=20260317e', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status === 200) {
        try {
          _chains = JSON.parse(xhr.responseText);
          console.log('[ConstellationCascade] Loaded', Object.keys(_chains).length, 'chains');
          return;
        } catch (e) {}
      }
      _chains = _FALLBACK_CHAINS;
      console.log('[ConstellationCascade] Using fallback chains');
    };
    xhr.send();
  }

  // ── Cascade Check ─────────────────────────────────────

  function _checkCascade(solvedId, solveDetail) {
    if (!_chains) return;
    var chain = _chains[solvedId];
    if (!chain || !chain.newConstellation) return;

    // Don't cascade if the target is already solved
    if (typeof ConstellationGamestate !== 'undefined' && ConstellationGamestate.isSolved(chain.unlocks)) {
      return;
    }

    var delay = chain.fadeDelay || 1500;

    // Schedule the cascade fade-in
    setTimeout(function () {
      _startCascade(chain, solveDetail);
    }, delay);

    console.log('[ConstellationCascade] Chain triggered:', solvedId, '→', chain.unlocks,
                '(fade in', delay, 'ms)');
  }

  function _startCascade(chain, solveDetail) {
    var def = chain.newConstellation;
    if (!def || !def.nodes) return;

    // Calculate centroid of the solved constellation for ripple origin
    var cx = 0.5, cy = 0.5;
    if (solveDetail && solveDetail.path && typeof SuitNodeRenderer !== 'undefined') {
      var sumX = 0, sumY = 0, count = 0;
      solveDetail.path.forEach(function (id) {
        var n = SuitNodeRenderer.getNodeById(id);
        if (n) { sumX += n.x; sumY += n.y; count++; }
      });
      if (count > 0) { cx = sumX / count; cy = sumY / count; }
    }

    // Register the new constellation (nodes start invisible)
    if (typeof SuitNodeRenderer !== 'undefined') {
      SuitNodeRenderer.registerConstellation(def);
    }

    // Queue fade-in animation for each node (staggered by distance from centroid)
    var fadeDuration = chain.fadeDuration || 2500;
    def.nodes.forEach(function (nd) {
      var dist = Math.hypot(nd.x - cx, nd.y - cy);
      var stagger = dist * 1500; // further nodes fade in later

      _pendingFadeIns.push({
        nodeId: nd.id,
        startTime: performance.now() + stagger,
        duration: fadeDuration,
        cx: cx, cy: cy,
      });

      // Make the node initially invisible
      var n = SuitNodeRenderer.getNodeById(nd.id);
      if (n) n._cascadeFade = 0;
    });

    // Dispatch event
    try {
      document.dispatchEvent(new CustomEvent('cascade-started', {
        detail: { from: solveDetail.constellationId, to: def.id, nodeCount: def.nodes.length },
      }));
    } catch (e) {}
  }

  // ── Fade-In Render Hook ───────────────────────────────

  function _renderFadeIns(hookCtx) {
    if (_pendingFadeIns.length === 0) return;

    var now = performance.now();

    for (var i = _pendingFadeIns.length - 1; i >= 0; i--) {
      var fi = _pendingFadeIns[i];
      var elapsed = now - fi.startTime;

      if (elapsed < 0) continue; // not started yet (stagger)

      var progress = Math.min(1, elapsed / fi.duration);

      // Update the node's cascade fade value
      if (typeof SuitNodeRenderer !== 'undefined') {
        var node = SuitNodeRenderer.getNodeById(fi.nodeId);
        if (node) {
          node._cascadeFade = progress;
          // Once fully faded in, clear the flag
          if (progress >= 1) {
            delete node._cascadeFade;
            _pendingFadeIns.splice(i, 1);
          }
        } else {
          _pendingFadeIns.splice(i, 1);
        }
      }

      // Draw ripple ring expanding from centroid toward this node
      if (progress < 0.5) {
        var ctx = hookCtx.ctx;
        var W = hookCtx.W, H = hookCtx.H;
        var rippleT = progress / 0.5;
        var rippleRadius = Math.hypot(
          (fi.cx - 0.5) * W,
          (fi.cy - 0.5) * H
        ) * rippleT * 0.3;

        ctx.save();
        ctx.globalAlpha = (1 - rippleT) * 0.15;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(fi.cx * W, fi.cy * H, rippleRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // ── Public API ────────────────────────────────────────

  root.ConstellationCascade = {
    init: init,
  };

})(typeof window !== 'undefined' ? window : this);
