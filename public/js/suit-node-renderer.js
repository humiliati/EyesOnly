/* ============================================================
   Suit-Node Renderer — Phase 8
   ============================================================
   Renders suit-symbol constellation nodes onto the starfield
   master canvas via EyesOnlyStarfield.addPostRenderHook().

   Nodes are positioned in normalized [0,1] coordinates (same as
   starfield stars) and rendered as tiny suit glyphs at screen
   resolution. Each node has a suit type that determines its
   visual rendering and which lens can interact with it.

   The renderer maintains the node registry and exposes it to
   constellation-tracer.js for hit-testing and path validation.
   ============================================================ */

;(function (root) {
  'use strict';

  // ── Node Types ──────────────────────────────────────────────
  //
  // Base colors for each suit (used on `night` palette and as default).
  // Per-palette overrides ensure nodes stay visible against themed starfields.
  var SUIT_TYPES = {
    club:    { symbol: '\u2663', color: '#d4a843', glowColor: 'rgba(212,168,67,0.4)',  dimColor: 'rgba(212,168,67,0.15)', lens: 'gold',   connectable: true  },
    diamond: { symbol: '\u2666', color: '#ff69b4', glowColor: 'rgba(255,105,180,0.4)', dimColor: 'rgba(255,105,180,0.15)', lens: 'pink',   connectable: false },
    spade:   { symbol: '\u2660', color: '#8898a8', glowColor: 'rgba(136,152,168,0.3)', dimColor: 'rgba(136,152,168,0.08)', lens: 'silver', connectable: false },
    heart:   { symbol: '\u2665', color: '#ff6030', glowColor: 'rgba(255,96,48,0.4)',   dimColor: 'rgba(255,96,48,0.12)',   lens: 'amber',  connectable: false },
  };

  // Per-palette overrides: only the colors that conflict with that palette's
  // dominant tint. Null = use base color (no conflict).
  //
  //   amber starfield (gold stars):  ♣ gold → cyan-white,  ♥ orange → bright magenta
  //   silver starfield (blue stars): ♠ grey-blue → warm cream
  //   panther starfield (magenta):   ♦ pink → bright cyan
  //   phosphor starfield (green):    (no conflicts — all suits contrast fine)
  //
  var PALETTE_OVERRIDES = {
    amber: {
      club:  { color: '#88ddff', glowColor: 'rgba(136,221,255,0.45)', dimColor: 'rgba(136,221,255,0.15)' },
      heart: { color: '#ff40c0', glowColor: 'rgba(255,64,192,0.4)',   dimColor: 'rgba(255,64,192,0.12)' },
    },
    silver: {
      spade: { color: '#e8d8a0', glowColor: 'rgba(232,216,160,0.35)', dimColor: 'rgba(232,216,160,0.10)' },
    },
    panther: {
      diamond: { color: '#00e5cc', glowColor: 'rgba(0,229,204,0.45)', dimColor: 'rgba(0,229,204,0.15)' },
    },
  };

  /**
   * Get the effective suit rendering definition for the current palette.
   */
  function _getSuitDef(suit) {
    var base = SUIT_TYPES[suit] || SUIT_TYPES.club;
    var palette = 'night';
    if (typeof EyesOnlyStarfield !== 'undefined' && EyesOnlyStarfield.getPalette) {
      palette = EyesOnlyStarfield.getPalette();
    }
    var overrides = PALETTE_OVERRIDES[palette];
    if (overrides && overrides[suit]) {
      // Merge override onto base (only color fields, keep symbol/lens/connectable)
      var o = overrides[suit];
      return {
        symbol:      base.symbol,
        color:       o.color || base.color,
        glowColor:   o.glowColor || base.glowColor,
        dimColor:    o.dimColor || base.dimColor,
        lens:        base.lens,
        connectable: base.connectable,
      };
    }
    return base;
  }

  // ── State ───────────────────────────────────────────────────
  var _nodes = [];          // { id, x, y, suit, state, constellation }
  var _constellations = []; // { id, nodeIds, validation, difficulty, solved }
  var _unhookFn = null;     // starfield hook unregister
  var _foreverPixels = [];  // { x, y } — permanent marks from solved constellations
  var FOREVER_KEY = 'eyesonly_forever_sky';

  // ── Node Creation ───────────────────────────────────────────

  /**
   * Register a constellation — a group of nodes that form a puzzle.
   * @param {Object} def
   * @param {string} def.id            Unique constellation ID
   * @param {Array}  def.nodes         Array of { id, x, y, suit }
   * @param {string} def.validation    'exact' | 'shape' | 'rule' | 'euler'
   * @param {string} def.difficulty    'beginner' | 'intermediate' | 'advanced' | 'expert'
   * @param {number} [def.rewardPerNode=10]  Coins per node on solve
   */
  function registerConstellation(def) {
    if (!def || !def.id || !def.nodes) return;

    var constellation = {
      id: def.id,
      nodeIds: [],
      validation: def.validation || 'shape',
      difficulty: def.difficulty || 'beginner',
      rewardPerNode: def.rewardPerNode || 10,
      angleConstraints: def.angleConstraints === true, // opt-in only
      solved: false,
    };

    def.nodes.forEach(function (nd) {
      var node = {
        id: nd.id || def.id + '-' + _nodes.length,
        x: nd.x,       // normalized 0..1
        y: nd.y,       // normalized 0..1
        suit: nd.suit || 'club',
        state: 'idle',  // idle | highlighted | visited | transformed | forever
        constellation: def.id,
        brightness: 1.0,
        pulsePhase: Math.random() * Math.PI * 2,
        transformedTo: null, // set to 'club' after lens transformation
      };
      _nodes.push(node);
      constellation.nodeIds.push(node.id);
    });

    _constellations.push(constellation);
    return constellation;
  }

  /**
   * Remove all nodes and constellations, or a specific constellation.
   */
  function clearConstellations(constellationId) {
    if (constellationId) {
      _constellations = _constellations.filter(function (c) { return c.id !== constellationId; });
      _nodes = _nodes.filter(function (n) { return n.constellation !== constellationId; });
    } else {
      _constellations = [];
      _nodes = [];
    }
  }

  // ── Node Queries ────────────────────────────────────────────

  function getNodes() { return _nodes; }
  function getConstellations() { return _constellations; }

  function getNodeById(id) {
    for (var i = 0; i < _nodes.length; i++) {
      if (_nodes[i].id === id) return _nodes[i];
    }
    return null;
  }

  /**
   * Find the closest node to a screen position within a tolerance radius.
   * @param {number} screenX  Pixel X
   * @param {number} screenY  Pixel Y
   * @param {number} radius   Hit radius in pixels
   * @param {string} [suitFilter] Only match nodes of this effective suit
   * @returns {Object|null} Node or null
   */
  function hitTest(screenX, screenY, radius, suitFilter) {
    var W = window.innerWidth;
    var H = window.innerHeight;
    var best = null;
    var bestDist = radius * radius;

    for (var i = 0; i < _nodes.length; i++) {
      var n = _nodes[i];
      if (n.state === 'forever') continue; // already burned in
      var effectiveSuit = n.transformedTo || n.suit;
      if (suitFilter && effectiveSuit !== suitFilter) continue;

      var nx = n.x * W;
      var ny = n.y * H;
      var dx = screenX - nx;
      var dy = screenY - ny;
      var d2 = dx * dx + dy * dy;
      if (d2 < bestDist) {
        bestDist = d2;
        best = n;
      }
    }
    return best;
  }

  /**
   * Get the effective suit of a node (considers transformation).
   */
  function getEffectiveSuit(node) {
    return node.transformedTo || node.suit;
  }

  /**
   * Check if a node is connectable by the gold lens.
   */
  function isConnectable(node) {
    var suit = getEffectiveSuit(node);
    return suit === 'club';
  }

  // ── Node State Changes ──────────────────────────────────────

  function highlightNode(nodeId) {
    var n = getNodeById(nodeId);
    if (n && n.state === 'idle') n.state = 'highlighted';
  }

  function visitNode(nodeId) {
    var n = getNodeById(nodeId);
    if (n) n.state = 'visited';
  }

  function resetNode(nodeId) {
    var n = getNodeById(nodeId);
    if (n && n.state !== 'forever') n.state = 'idle';
  }

  function resetConstellation(constellationId) {
    _nodes.forEach(function (n) {
      if (n.constellation === constellationId && n.state !== 'forever') {
        n.state = 'idle';
      }
    });
  }

  /**
   * Transform a non-club node into a club (lens transformation).
   */
  function transformNode(nodeId) {
    var n = getNodeById(nodeId);
    if (!n || n.suit === 'club') return false;
    n.transformedTo = 'club';
    n.state = 'transformed';
    return true;
  }

  /**
   * Burn solved nodes into forever pixels.
   */
  function burnForever(nodeIds) {
    nodeIds.forEach(function (id) {
      var n = getNodeById(id);
      if (!n) return;
      n.state = 'forever';
      _foreverPixels.push({ x: n.x, y: n.y });
    });
    _saveForeverPixels();
  }

  function markConstellationSolved(constellationId) {
    for (var i = 0; i < _constellations.length; i++) {
      if (_constellations[i].id === constellationId) {
        _constellations[i].solved = true;
        break;
      }
    }
  }

  // ── Forever Sky Persistence ─────────────────────────────────

  function _loadForeverPixels() {
    try {
      var raw = localStorage.getItem(FOREVER_KEY);
      if (raw) _foreverPixels = JSON.parse(raw);
    } catch (e) {}
  }

  function _saveForeverPixels() {
    try {
      localStorage.setItem(FOREVER_KEY, JSON.stringify(_foreverPixels));
    } catch (e) {}
  }

  function getForeverPixels() { return _foreverPixels; }

  // ── Render Hook ─────────────────────────────────────────────
  //
  // Paints suit-symbol nodes and forever pixels onto the starfield
  // master canvas each frame (before blit into portholes).

  function _renderHook(hookCtx) {
    var ctx = hookCtx.ctx;
    var W = hookCtx.W;
    var H = hookCtx.H;
    var t = hookCtx.time;

    // 1. Forever pixels — permanent bright marks from solved constellations
    //    Rendered as 3px glow + 2px core so they're visible over starfield layers.
    for (var fi = 0; fi < _foreverPixels.length; fi++) {
      var fp = _foreverPixels[fi];
      var fpx = fp.x * W;
      var fpy = fp.y * H;

      // Subtle glow halo (4px radius, warm white)
      var fpGrad = ctx.createRadialGradient(fpx, fpy, 0, fpx, fpy, 4);
      fpGrad.addColorStop(0, 'rgba(255,255,240,0.7)');
      fpGrad.addColorStop(0.5, 'rgba(255,250,220,0.25)');
      fpGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = fpGrad;
      ctx.fillRect(fpx - 4, fpy - 4, 8, 8);

      // Bright core (2px)
      ctx.fillStyle = '#fffff0';
      ctx.fillRect(Math.round(fpx) - 1, Math.round(fpy) - 1, 2, 2);
    }

    // 2. Active constellation nodes
    for (var i = 0; i < _nodes.length; i++) {
      var node = _nodes[i];
      if (node.state === 'forever') continue; // rendered as forever pixel above

      var effectiveSuit = node.transformedTo || node.suit;
      var suitDef = _getSuitDef(effectiveSuit);

      var nx = node.x * W;
      var ny = node.y * H;

      // Pulse animation
      var pulse = 0.6 + 0.4 * Math.sin(t * 0.04 + node.pulsePhase);

      // State-dependent rendering
      var alpha, glowSize, fontSize;

      switch (node.state) {
        case 'highlighted':
          alpha = 0.9 + 0.1 * pulse;
          glowSize = 12;
          fontSize = 10;
          break;
        case 'visited':
          alpha = 1.0;
          glowSize = 8;
          fontSize = 9;
          break;
        case 'transformed':
          alpha = 0.85;
          glowSize = 10;
          fontSize = 9;
          break;
        default: // idle
          if (node.suit === 'heart') {
            // Hearts are invisible until revealed by amber lens
            alpha = 0;
            glowSize = 0;
            fontSize = 0;
          } else if (node.suit === 'spade') {
            // Spades are dim and flickering
            var flicker = Math.random() > 0.85 ? 0.1 : 0.3;
            alpha = flicker * pulse;
            glowSize = 3;
            fontSize = 7;
          } else if (node.suit === 'diamond') {
            // Diamonds are visible, pink-tinted
            alpha = 0.5 + 0.2 * pulse;
            glowSize = 6;
            fontSize = 8;
          } else {
            // Clubs: visible, bright, gold-tinted, twinkling
            alpha = 0.5 + 0.3 * pulse;
            glowSize = 6;
            fontSize = 8;
          }
      }

      if (alpha <= 0) continue;

      // ── Club twinkle: glow cycles between strong and near-zero ──
      // Uses a slow second wave so the glow periodically dips,
      // revealing the crisp ♣ symbol underneath like a twinkling star.
      var glowAlpha = alpha * 0.5;  // default glow strength
      var symbolAlpha = alpha;       // default symbol strength

      if (node.suit === 'club' && node.state === 'idle') {
        // Slow twinkle wave — each node offset by its pulsePhase
        // Period ~3.5s, sharp dip (power curve makes bright phase longer, dim phase brief)
        var twinkle = Math.sin(t * 0.018 + node.pulsePhase * 2.7);
        // Remap: mostly bright (glow on), brief dip (glow off, symbol shines)
        var twinkleT = Math.max(0, twinkle); // 0 at dip, 1 at peak
        twinkleT = twinkleT * twinkleT;      // square it — spends more time bright

        glowAlpha = alpha * 0.55 * twinkleT;     // glow fades to 0 at dip
        glowSize = 6 + 3 * twinkleT;             // glow shrinks at dip
        symbolAlpha = alpha * (0.6 + 0.4 * (1 - twinkleT)); // symbol brightens at dip
        fontSize = 8 + Math.round(2 * (1 - twinkleT));      // symbol grows slightly at dip
      }

      // Glow halo
      if (glowSize > 0 && glowAlpha > 0.01) {
        var grad = ctx.createRadialGradient(nx, ny, 0, nx, ny, glowSize);
        var gc = suitDef.glowColor;
        grad.addColorStop(0, gc.replace(/[\d.]+\)$/, glowAlpha + ')'));
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(nx - glowSize, ny - glowSize, glowSize * 2, glowSize * 2);
      }

      // Suit symbol (text rendering)
      if (fontSize > 0) {
        ctx.save();
        ctx.font = fontSize + 'px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = suitDef.color;
        ctx.globalAlpha = symbolAlpha;
        ctx.fillText(suitDef.symbol, nx, ny);
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }
  }

  // ── Init / Destroy ──────────────────────────────────────────

  function init() {
    _loadForeverPixels();

    // Register render hook with starfield
    if (typeof EyesOnlyStarfield !== 'undefined' && EyesOnlyStarfield.addPostRenderHook) {
      _unhookFn = EyesOnlyStarfield.addPostRenderHook(_renderHook);
    } else {
      console.warn('[SuitNodeRenderer] EyesOnlyStarfield not available, will retry...');
      // Retry after starfield might have initialized
      setTimeout(function () {
        if (!_unhookFn && typeof EyesOnlyStarfield !== 'undefined' && EyesOnlyStarfield.addPostRenderHook) {
          _unhookFn = EyesOnlyStarfield.addPostRenderHook(_renderHook);
        }
      }, 1000);
    }
  }

  function destroy() {
    if (_unhookFn) { _unhookFn(); _unhookFn = null; }
    _nodes = [];
    _constellations = [];
  }

  // ── Public API ──────────────────────────────────────────────

  root.SuitNodeRenderer = {
    init:                  init,
    destroy:               destroy,
    registerConstellation: registerConstellation,
    clearConstellations:   clearConstellations,
    getNodes:              getNodes,
    getConstellations:     getConstellations,
    getNodeById:           getNodeById,
    hitTest:               hitTest,
    getEffectiveSuit:      getEffectiveSuit,
    isConnectable:         isConnectable,
    highlightNode:         highlightNode,
    visitNode:             visitNode,
    resetNode:             resetNode,
    resetConstellation:    resetConstellation,
    transformNode:         transformNode,
    burnForever:           burnForever,
    markConstellationSolved: markConstellationSolved,
    getForeverPixels:      getForeverPixels,
    _setForeverPixels:     function (arr) { _foreverPixels = arr; _saveForeverPixels(); },
    getNodeRadius:         function () { return 8; }, // default node radius for coin sprite sizing
    SUIT_TYPES:            SUIT_TYPES,
  };

})(typeof window !== 'undefined' ? window : this);
