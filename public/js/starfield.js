/* ============================================================
   EYES ONLY — Shared Starfield Module
   ============================================================
   Full-page starfield rendered into a hidden master canvas.
   Any element with the porthole selector (default: '.starfield-window')
   automatically blits its screen-space region from the master each
   frame via getBoundingClientRect().

   This means:
     - Scrolling moves the porthole across a static starfield
     - Dragging a ghost card gives a free magnifying-glass effect
     - Multiple pages share identical star rendering

   Usage:
     <script src="/js/starfield.js"></script>
     <script>
       // Auto-creates the master canvas and starts rendering.
       // Searches the entire document for porthole canvases.
       EyesOnlyStarfield.init({
         // Optional overrides:
         // selector: '.starfield-window',   // porthole canvas selector
         // seed: 42,                         // RNG seed
         // masterEl: existingCanvas,         // reuse an existing master
         // parentEl: document.body,          // where to append master
         // masterClass: 'starfield-master',  // CSS class for master
       });

       // Later, if tearing down:
       EyesOnlyStarfield.destroy();
     </script>

   The master canvas is position:fixed, covers the viewport, and is
   invisible (opacity:0, pointer-events:none).  Pages that want it
   visible behind content can set masterClass CSS to opacity:1.
   ============================================================ */

;(function (root) {
  'use strict';

  /* ---- Seeded PRNG ---- */
  function makePRNG(seed) {
    var s = seed | 0;
    return function () {
      s = (s * 1664525 + 1013904223) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  /* ---- State ---- */
  var _state = {
    layers:         [],
    milkyWay:       [],
    turingClusters: [],
    master:         null, // { canvas, ctx }
    time:           0,
    rafId:          null,
    running:        false,
    selector:       '.starfield-window',
    ownsCanvas:     false, // did we create the master canvas?
  };

  /* ---- Generate star data ---- */
  function _generateStars(rng) {

    // Main star layers
    var layerDefs = [
      // Deep dust: many faint single-pixel twinklers
      { count: 600, rMin: 0.2, rMax: 0.4, speed: 0.00003, driftAngle: 0.2,  scale: 0.3, opacity: 0.35, twinkle: true  },
      // Mid-field: crisp single-pixel stars
      { count: 140, rMin: 0.3, rMax: 0.5, speed: 0.00012, driftAngle: 1.1,  scale: 0.5, opacity: 0.65, twinkle: true  },
      // Bright stars: sharp points, minimal glow
      { count: 50,  rMin: 0.4, rMax: 0.8, speed: 0.00025, driftAngle: 2.5,  scale: 0.7, opacity: 0.85, twinkle: true  },
      // Foreground: few prominent sharp stars
      { count: 18,  rMin: 0.5, rMax: 1.0, speed: 0.0005,  driftAngle: 3.8,  scale: 0.9, opacity: 0.95, twinkle: false },
    ];

    _state.layers = layerDefs.map(function (def) {
      var stars = [];
      var driftX = Math.cos(def.driftAngle) * def.speed;
      var driftY = Math.sin(def.driftAngle) * def.speed;
      for (var i = 0; i < def.count; i++) {
        // Star color: strongly biased toward crisp white
        var temp = rng();
        var cr, cg, cb;
        if (temp < 0.06) {
          // Rare warm star
          cr = 255; cg = 240 + Math.floor(rng() * 15); cb = 220 + Math.floor(rng() * 20);
        } else if (temp < 0.15) {
          // Occasional cool blue-white
          cr = 220 + Math.floor(rng() * 20); cg = 225 + Math.floor(rng() * 20); cb = 255;
        } else {
          // Clean white (dominant)
          cr = 240 + Math.floor(rng() * 15); cg = 240 + Math.floor(rng() * 15); cb = 245 + Math.floor(rng() * 10);
        }
        stars.push({
          x:          rng(),
          y:          rng(),
          r:          def.rMin + rng() * (def.rMax - def.rMin),
          brightness: 0.4 + rng() * 0.6,
          twinklePhase: rng() * Math.PI * 2,
          twinkleRate: 0.005 + rng() * 0.025,
          cr: cr, cg: cg, cb: cb,
        });
      }
      return {
        stars: stars, driftX: driftX, driftY: driftY,
        scale: def.scale, opacity: def.opacity, twinkle: def.twinkle
      };
    });

    // Milky Way band
    var mwStars = [];
    for (var i = 0; i < 350; i++) {
      var p = rng();
      var spread = (rng() + rng() + rng()) / 3 - 0.5;
      var bandWidth = 0.08 + rng() * 0.06;
      var angle = 0.6;
      var bx = p + spread * bandWidth * Math.sin(angle);
      var by = p * 0.7 + 0.15 + spread * bandWidth * Math.cos(angle);
      by += Math.sin(p * 8) * 0.015;
      bx += Math.cos(p * 6 + 1) * 0.01;
      mwStars.push({
        x: bx % 1,
        y: by % 1,
        r: 0.2 + rng() * 0.5,
        brightness: 0.2 + rng() * 0.5,
        twinklePhase: rng() * Math.PI * 2,
        twinkleRate: 0.003 + rng() * 0.015,
      });
    }
    _state.milkyWay = mwStars;

    // Turing pattern clusters: 3-5 dense groupings with blue glow
    var clusters = [];
    var numClusters = 3 + Math.floor(rng() * 3);
    for (var ci = 0; ci < numClusters; ci++) {
      var cx = 0.15 + rng() * 0.7;
      var cy = 0.15 + rng() * 0.7;
      var clusterStars = [];
      var coreCount = 8 + Math.floor(rng() * 12);
      for (var si = 0; si < coreCount; si++) {
        var a2 = rng() * Math.PI * 2;
        var d2 = (rng() * 0.5 + rng() * 0.5) * 0.018;
        clusterStars.push({
          x: cx + Math.cos(a2) * d2,
          y: cy + Math.sin(a2) * d2,
          r: 0.3 + rng() * 0.4,
          brightness: 0.5 + rng() * 0.5,
          twinklePhase: rng() * Math.PI * 2,
          twinkleRate: 0.008 + rng() * 0.02,
        });
      }
      var haloCount = 4 + Math.floor(rng() * 6);
      for (var hi = 0; hi < haloCount; hi++) {
        var hAngle = rng() * Math.PI * 2;
        var hDist = 0.028 + rng() * 0.012;
        clusterStars.push({
          x: cx + Math.cos(hAngle) * hDist,
          y: cy + Math.sin(hAngle) * hDist,
          r: 0.2 + rng() * 0.3,
          brightness: 0.3 + rng() * 0.3,
          twinklePhase: rng() * Math.PI * 2,
          twinkleRate: 0.006 + rng() * 0.015,
        });
      }
      clusters.push(clusterStars);
    }
    _state.turingClusters = clusters;
  }

  /* ---- Render one frame onto the master canvas ---- */
  function _renderMaster() {
    var m = _state.master;
    if (!m) return;

    var mc  = m.canvas;
    var ctx = m.ctx;
    var t   = _state.time;

    // Keep pixel dimensions in sync with viewport (handles resize)
    var dw = window.innerWidth;
    var dh = window.innerHeight;
    if (mc.width !== dw || mc.height !== dh) {
      mc.width  = dw;
      mc.height = dh;
    }
    var W = mc.width;
    var H = mc.height;

    // Pure black void
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);

    // Very slow cosmic rotation for deepest layer
    var cosmicAngle = t * 0.000015;

    // --- Main star layers ---
    _state.layers.forEach(function (layer, li) {
      layer.stars.forEach(function (star) {
        var sx = star.x + t * layer.driftX;
        var sy = star.y + t * layer.driftY;

        if (li === 0) {
          var ccx = sx - 0.5, ccy = sy - 0.5;
          var cos0 = Math.cos(cosmicAngle), sin0 = Math.sin(cosmicAngle);
          sx = ccx * cos0 - ccy * sin0 + 0.5;
          sy = ccx * sin0 + ccy * cos0 + 0.5;
        }

        sx = sx % 1; if (sx < 0) sx += 1;
        sy = sy % 1; if (sy < 0) sy += 1;

        var px = sx * W;
        var py = sy * H;

        var twinkle = 1;
        if (layer.twinkle) {
          twinkle = 0.5 + 0.5 * Math.sin(t * star.twinkleRate + star.twinklePhase);
          var scint = Math.sin(t * star.twinkleRate * 3.7 + star.twinklePhase * 2.1);
          if (scint > 0.97) twinkle = Math.min(1, twinkle + 0.4);
        }

        var r     = star.r * layer.scale;
        var alpha = layer.opacity * star.brightness * twinkle;

        // Tight glow halo only for brightest foreground stars
        if (r > 0.8) {
          ctx.beginPath();
          ctx.arc(px, py, r * 2, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(' + star.cr + ',' + star.cg + ',' + star.cb + ',' + (alpha * 0.03) + ')';
          ctx.fill();
        }

        // Star core — single pixel for crisp look
        if (r < 0.6) {
          ctx.fillStyle = 'rgba(' + star.cr + ',' + star.cg + ',' + star.cb + ',' + alpha + ')';
          ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
        } else {
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(' + star.cr + ',' + star.cg + ',' + star.cb + ',' + alpha + ')';
          ctx.fill();
        }
      });
    });

    // --- Milky Way blue glow ---
    ctx.save();
    ctx.translate(W * 0.5, H * 0.5);
    ctx.rotate(0.55);
    var mwBlue = ctx.createLinearGradient(-W * 0.6, 0, W * 0.6, 0);
    mwBlue.addColorStop(0,    'rgba(0, 0, 0, 0)');
    mwBlue.addColorStop(0.25, 'rgba(20, 40, 120, 0.02)');
    mwBlue.addColorStop(0.45, 'rgba(30, 60, 180, 0.04)');
    mwBlue.addColorStop(0.5,  'rgba(35, 70, 200, 0.05)');
    mwBlue.addColorStop(0.55, 'rgba(30, 60, 180, 0.04)');
    mwBlue.addColorStop(0.75, 'rgba(20, 40, 120, 0.02)');
    mwBlue.addColorStop(1,    'rgba(0, 0, 0, 0)');
    ctx.fillStyle = mwBlue;
    ctx.fillRect(-W, -H * 0.06, W * 2, H * 0.12);
    ctx.restore();

    // --- Milky Way dense stars ---
    var mwDriftX = t * 0.00002;
    var mwDriftY = t * 0.000015;
    _state.milkyWay.forEach(function (star) {
      var sx = (star.x + mwDriftX) % 1;
      var sy = (star.y + mwDriftY) % 1;
      if (sx < 0) sx += 1;
      if (sy < 0) sy += 1;
      var px = sx * W;
      var py = sy * H;

      var twinkle = 0.4 + 0.6 * Math.sin(t * star.twinkleRate + star.twinklePhase);
      var alpha = star.brightness * twinkle * 0.6;

      ctx.fillStyle = 'rgba(240, 242, 255, ' + alpha + ')';
      ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
    });

    // --- Turing pattern clusters with blue glow ---
    var clDriftX = t * 0.00008;
    var clDriftY = t * 0.00005;
    _state.turingClusters.forEach(function (cluster) {
      var cxSum = 0, cySum = 0;
      cluster.forEach(function (star) {
        cxSum += (star.x + clDriftX) % 1;
        cySum += (star.y + clDriftY) % 1;
      });
      var centX = (cxSum / cluster.length) * W;
      var centY = (cySum / cluster.length) * H;

      var glowPulse = 0.7 + 0.3 * Math.sin(t * 0.003 + centX * 0.01);
      var glowRadius = Math.max(W, H) * 0.04;
      var clusterGlow = ctx.createRadialGradient(centX, centY, 0, centX, centY, glowRadius);
      clusterGlow.addColorStop(0,   'rgba(40, 80, 200, ' + (0.12 * glowPulse) + ')');
      clusterGlow.addColorStop(0.4, 'rgba(30, 60, 160, ' + (0.06 * glowPulse) + ')');
      clusterGlow.addColorStop(1,   'rgba(0, 0, 0, 0)');
      ctx.fillStyle = clusterGlow;
      ctx.fillRect(centX - glowRadius, centY - glowRadius, glowRadius * 2, glowRadius * 2);

      cluster.forEach(function (star) {
        var sx = (star.x + clDriftX) % 1;
        var sy = (star.y + clDriftY) % 1;
        if (sx < 0) sx += 1;
        if (sy < 0) sy += 1;
        var px = sx * W;
        var py = sy * H;

        var twinkle = 0.5 + 0.5 * Math.sin(t * star.twinkleRate + star.twinklePhase);
        var alpha = star.brightness * twinkle * 0.85;
        var r = star.r;

        ctx.fillStyle = 'rgba(235, 240, 255, ' + alpha + ')';
        if (r < 0.45) {
          ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
        } else {
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    });
  }

  /* ---- Blit from master into all porthole canvases ---- */
  function _blitPortholes() {
    var m = _state.master;
    if (!m) return;

    var mc = m.canvas;
    var W  = mc.width;
    var H  = mc.height;

    var portholes = document.querySelectorAll(_state.selector);
    portholes.forEach(function (canvas) {
      var cw = canvas.width;
      var ch = canvas.height;
      if (cw === 0 || ch === 0) return;

      var pctx = canvas.getContext('2d');

      var rect = canvas.getBoundingClientRect();
      var sx = Math.round(rect.left);
      var sy = Math.round(rect.top);
      var sw = Math.round(rect.width);
      var sh = Math.round(rect.height);

      // Clamp source rect to master bounds
      var srcX = Math.max(0, Math.min(sx, W - 1));
      var srcY = Math.max(0, Math.min(sy, H - 1));
      var srcW = Math.min(sw, W - srcX);
      var srcH = Math.min(sh, H - srcY);

      if (srcW <= 0 || srcH <= 0) {
        pctx.fillStyle = '#000000';
        pctx.fillRect(0, 0, cw, ch);
        return;
      }

      pctx.drawImage(mc, srcX, srcY, srcW, srcH, 0, 0, cw, ch);

      // Vignette: dark rim, clear center
      var vig = pctx.createRadialGradient(cw / 2, ch / 2, cw * 0.35, cw / 2, ch / 2, cw * 0.5);
      vig.addColorStop(0,   'rgba(0, 0, 0, 0)');
      vig.addColorStop(0.6, 'rgba(4, 3, 8, 0.3)');
      vig.addColorStop(1,   'rgba(10, 8, 16, 0.85)');
      pctx.fillStyle = vig;
      pctx.fillRect(0, 0, cw, ch);
    });
  }

  /* ---- RAF loop ---- */
  function _tick() {
    if (!_state.running) return;
    _state.rafId = requestAnimationFrame(_tick);
    _state.time++;

    _renderMaster();
    _blitPortholes();
  }

  /* ---- Public API ---- */

  /**
   * Initialize the starfield.
   * @param {Object} [opts]
   * @param {string} [opts.selector='.starfield-window'] CSS selector for porthole canvases
   * @param {number} [opts.seed=42] RNG seed for reproducible star placement
   * @param {HTMLCanvasElement} [opts.masterEl] Reuse an existing canvas as master
   * @param {HTMLElement} [opts.parentEl=document.body] Where to append auto-created master
   * @param {string} [opts.masterClass='starfield-master'] CSS class for auto-created master
   */
  function init(opts) {
    if (_state.running) return; // already running

    opts = opts || {};
    _state.selector = opts.selector || '.starfield-window';
    var seed = opts.seed != null ? opts.seed : 42;

    // Master canvas: reuse existing or create new
    var mc;
    if (opts.masterEl) {
      mc = opts.masterEl;
      _state.ownsCanvas = false;
    } else {
      mc = document.createElement('canvas');
      mc.className = opts.masterClass || 'starfield-master';
      // Fixed fullscreen, invisible — only rendered through portholes
      mc.style.cssText = [
        'position: fixed',
        'inset: 0',
        'width: 100vw',
        'height: 100vh',
        'z-index: -1',
        'pointer-events: none',
        'opacity: 0',
      ].join('; ');
      var parent = opts.parentEl || document.body;
      parent.appendChild(mc);
      _state.ownsCanvas = true;
    }

    mc.width  = window.innerWidth;
    mc.height = window.innerHeight;

    _state.master = { canvas: mc, ctx: mc.getContext('2d') };
    _state.time   = 0;

    // Generate all star data
    var rng = makePRNG(seed);
    _generateStars(rng);

    // Start render loop
    _state.running = true;
    _tick();
  }

  /**
   * Stop rendering and clean up.
   */
  function destroy() {
    _state.running = false;
    if (_state.rafId) cancelAnimationFrame(_state.rafId);
    _state.rafId = null;
    _state.time  = 0;

    // Remove master canvas if we created it
    if (_state.ownsCanvas && _state.master && _state.master.canvas.parentNode) {
      _state.master.canvas.parentNode.removeChild(_state.master.canvas);
    }

    _state.master         = null;
    _state.layers         = [];
    _state.milkyWay       = [];
    _state.turingClusters = [];
    _state.ownsCanvas     = false;
  }

  /**
   * Get the master canvas element (e.g. for pages that want to show it).
   * @returns {HTMLCanvasElement|null}
   */
  function getMasterCanvas() {
    return _state.master ? _state.master.canvas : null;
  }

  /**
   * Check if the starfield is currently running.
   * @returns {boolean}
   */
  function isRunning() {
    return _state.running;
  }

  // Expose as global
  root.EyesOnlyStarfield = {
    init:    init,
    destroy: destroy,
    getMasterCanvas: getMasterCanvas,
    isRunning: isRunning,
  };

})(typeof window !== 'undefined' ? window : this);
