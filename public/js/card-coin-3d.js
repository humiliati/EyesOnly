/**
 * card-coin-3d.js — Military Challenge Coin 3D Renderer v2
 *
 * Three-tier PBR coin: polished brass (raised) → satin metal (mid) → cosmic starfield (deep).
 * Height map drives material blending via onBeforeCompile shader injection.
 * Procedural parallax starfield in GLSL — deep areas look like infinite space.
 *
 * One offscreen WebGL context, per-card 2D display canvases.
 * Renders on both desktop and mobile with adaptive quality.
 *
 * NOT casino/poker — military honor coins on a surveillance desk.
 */
(function () {
  'use strict';

  /* ============================================================
     DEVICE CAPABILITY DETECTION
     ============================================================ */
  var _isMobile  = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  var _isTouch   = !window.matchMedia('(hover: hover)').matches;
  var _lowMemory = navigator.deviceMemory ? navigator.deviceMemory < 4 : _isMobile;
  var _tier      = 'high'; // 'high' | 'mid' | 'low' | 'none'

  // Probe WebGL support and GPU capability before committing resources
  function _probeWebGL() {
    try {
      var tc = document.createElement('canvas');
      var gl = tc.getContext('webgl') || tc.getContext('experimental-webgl');
      if (!gl) return 'none';

      var dbg = gl.getExtension('WEBGL_debug_renderer_info');
      var gpuStr = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '';
      var maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);

      // Detect very weak GPUs (SwiftShader = software renderer, Mali-4xx = very old)
      if (/SwiftShader|llvmpipe/i.test(gpuStr)) return 'none';
      if (/Mali-4|Mali-T6|Adreno.*(2|30[0-5])|PowerVR.*(SGX|G6[01])/i.test(gpuStr)) return 'low';
      if (maxTex < 4096) return 'low';

      // Mobile GPUs that are capable but should use mid tier
      if (_isMobile || _lowMemory) return 'mid';

      return 'high';
    } catch (e) {
      return 'none';
    }
  }

  /* ============================================================
     CONFIGURATION (adapted per device tier)
     ============================================================ */
  var CFG = {
    // Coin body (world units) — thick like 1/3 of a card deck
    width:  2.1,
    height: 3.4,
    depth:  0.50,
    radius: 0.14,       // legacy — not used for chamfered shape
    chamfer: 0.32,      // chamfer cut size at each corner (world units)
    bevel:  0.12,
    bevelSegs: 5,
    curveSegs: 12,

    // Texture resolution — set by _applyTier()
    texW: 1024,
    get texH() { return Math.round(this.texW * this.height / this.width); },

    // Material
    metalness: 0.92,
    roughness: 0.15,
    bumpScale: 0.045,
    envIntensity: 1.0,

    // Animation
    idleSpeed: 0.35,
    idleAmp:   0.055,
    hoverTilt: 0.12,
    flipMs:    800,

    // Camera
    camDist: 6.0,

    // Render throttle (ms between frames, 0 = every rAF)
    frameInterval: 0,

    // Starfield complexity (star layers in shader)
    starLayers: 4,
  };

  // Apply device tier adjustments
  function _applyTier(tier) {
    _tier = tier;
    if (tier === 'mid') {
      CFG.texW       = 512;         // half resolution — still crisp on phone screens
      CFG.bevelSegs  = 3;
      CFG.curveSegs  = 8;
      CFG.bumpScale  = 0.020;
      CFG.frameInterval = 33;       // ~30 fps cap (saves battery)
      CFG.starLayers = 3;
    } else if (tier === 'low') {
      CFG.texW       = 384;
      CFG.bevelSegs  = 2;
      CFG.curveSegs  = 6;
      CFG.bumpScale  = 0.015;
      CFG.frameInterval = 50;       // ~20 fps cap
      CFG.starLayers = 2;
      CFG.depth      = 0.38;
      CFG.bevel      = 0.08;
    }
  }

  /* ============================================================
     STATE
     ============================================================ */
  var T;                 // THREE namespace
  var _renderer;
  var _scene;
  var _camera;
  var _envMap;
  var _sharedGeo;
  var _coins  = [];
  var _offCanvas;
  var _animId = null;
  var _ready  = false;
  var _t0     = 0;
  var _disposed = false;
  var _lastFrame = 0;    // for frame throttling
  var _mountTimeout = null;

  /* ============================================================
     PUBLIC API
     ============================================================ */
  window.CardCoin3D = {
    mount:      mount,
    setHover:   setHover,
    selectCard: selectCard,
    dispose:    dispose,
    get ready() { return _ready; },
  };

  /* ============================================================
     GEOMETRY — Chamfered-corner extrusion with bevel
     Octagonal shape: 45° corner cuts like the reference dossier cards
     ============================================================ */
  function chamfShape(w, h, c) {
    var s = new T.Shape();
    var hw = w / 2, hh = h / 2;
    // clockwise from top-left chamfer
    s.moveTo(-hw + c, -hh);      // top edge start
    s.lineTo( hw - c, -hh);      // top edge end
    s.lineTo( hw, -hh + c);      // top-right chamfer
    s.lineTo( hw,  hh - c);      // right edge
    s.lineTo( hw - c,  hh);      // bottom-right chamfer
    s.lineTo(-hw + c,  hh);      // bottom edge
    s.lineTo(-hw,  hh - c);      // bottom-left chamfer
    s.lineTo(-hw, -hh + c);      // left edge
    s.closePath();
    return s;
  }

  function buildGeo() {
    var geo = new T.ExtrudeGeometry(chamfShape(CFG.width, CFG.height, CFG.chamfer), {
      depth:          CFG.depth,
      bevelEnabled:   true,
      bevelThickness: CFG.bevel,
      bevelSize:      CFG.bevel,
      bevelOffset:    0,
      bevelSegments:  CFG.bevelSegs,
      curveSegments:  CFG.curveSegs,
    });
    geo.computeBoundingBox();
    var c = new T.Vector3();
    geo.boundingBox.getCenter(c);
    geo.translate(-c.x, -c.y, -c.z);

    // Fix UVs — ExtrudeGeometry maps cap faces using raw shape coords.
    // Remap to 0…1 so CanvasTextures display correctly.
    var uvAttr = geo.attributes.uv;
    var norms  = geo.attributes.normal;

    // Pass 1: measure UV range on cap faces (|normal.z| > 0.5)
    var uMin = Infinity, uMax = -Infinity;
    var vMin = Infinity, vMax = -Infinity;
    for (var vi = 0; vi < uvAttr.count; vi++) {
      if (Math.abs(norms.getZ(vi)) > 0.5) {
        var u = uvAttr.getX(vi), v = uvAttr.getY(vi);
        if (u < uMin) uMin = u; if (u > uMax) uMax = u;
        if (v < vMin) vMin = v; if (v > vMax) vMax = v;
      }
    }

    // Pass 2: remap to 0…1
    var uR = (uMax - uMin) || 1;
    var vR = (vMax - vMin) || 1;
    for (var vi2 = 0; vi2 < uvAttr.count; vi2++) {
      if (Math.abs(norms.getZ(vi2)) > 0.5) {
        uvAttr.setXY(vi2,
          (uvAttr.getX(vi2) - uMin) / uR,
          (uvAttr.getY(vi2) - vMin) / vR
        );
      }
    }
    uvAttr.needsUpdate = true;
    return geo;
  }

  /* ============================================================
     CANVAS HELPERS
     ============================================================ */
  // Chamfered rectangle path (octagonal)
  function chamfPath(ctx, x, y, w, h, c) {
    ctx.beginPath();
    ctx.moveTo(x + c, y);
    ctx.lineTo(x + w - c, y);
    ctx.lineTo(x + w, y + c);
    ctx.lineTo(x + w, y + h - c);
    ctx.lineTo(x + w - c, y + h);
    ctx.lineTo(x + c, y + h);
    ctx.lineTo(x, y + h - c);
    ctx.lineTo(x, y + c);
    ctx.closePath();
  }

  // Legacy rounded-rect path (still used for inner panel)
  function rrPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // Per-mission color palette — matches reference dossier tints
  function _cardPalette(m) {
    var palettes = {
      '\u2660': { bg: '#0c0818', mid: '#2a1858', hi: '#5038a0', glow: '#8060d0', name: 'indigo' },
      '\u2663': { bg: '#200c08', mid: '#6a1810', hi: '#c03020', glow: '#e05838', name: 'crimson' },
      '\u2665': { bg: '#041808', mid: '#0c3818', hi: '#1a6830', glow: '#30a050', name: 'emerald' },
      '\u2666': { bg: '#1a1208', mid: '#5a3a10', hi: '#a07020', glow: '#d0a040', name: 'amber' },
    };
    return palettes[m.suit] || palettes['\u2660'];
  }

  // Draw triangular brass corner accent at a chamfered corner
  function _drawCornerAccent(g, cx, cy, size, angle) {
    g.save();
    g.translate(cx, cy);
    g.rotate(angle);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(size, 0);
    g.lineTo(0, size);
    g.closePath();
    g.fill();
    // Highlight edge
    g.strokeStyle = 'rgba(255,240,180,0.4)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(size * 0.15, size * 0.15);
    g.lineTo(size * 0.8, size * 0.15);
    g.moveTo(size * 0.15, size * 0.15);
    g.lineTo(size * 0.15, size * 0.8);
    g.stroke();
    g.restore();
  }

  // Draw all 4 corner accents for a chamfered frame
  function _drawAllCornerAccents(g, w, h, accentSize) {
    var margin = Math.round(w * 0.02);
    var cf = Math.round(w * 0.15); // canvas chamfer offset
    // Top-left
    _drawCornerAccent(g, margin + 2, margin + 2, accentSize, 0);
    // Top-right
    _drawCornerAccent(g, w - margin - 2, margin + 2, accentSize, Math.PI / 2);
    // Bottom-right
    _drawCornerAccent(g, w - margin - 2, h - margin - 2, accentSize, Math.PI);
    // Bottom-left
    _drawCornerAccent(g, margin + 2, h - margin - 2, accentSize, -Math.PI / 2);
  }

  // Emoji font stack — render suit symbols at max quality
  var EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif';
  var MONO_FONT  = '"Courier New",monospace';
  var TITLE_FONT = '"Impact","Arial Black","Helvetica Neue",sans-serif';

  /* ============================================================
     SHARED STARFIELD TEXTURE — one static field, all cards share it
     Sparse small stars (1–3px) on deep black.
     ============================================================ */
  var _sharedStarfieldCanvas = null;

  function _getStarfield() {
    if (_sharedStarfieldCanvas) return _sharedStarfieldCanvas;
    var w = CFG.texW, h = CFG.texH;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');

    // Deep black
    g.fillStyle = '#020104';
    g.fillRect(0, 0, w, h);

    // Sparse stars — deterministic seed via simple hash
    var starCount = Math.round(w * h * 0.0008); // ~0.08% pixel coverage
    for (var i = 0; i < starCount; i++) {
      // Pseudo-random from index
      var px = ((i * 7919 + 104729) % w);
      var py = ((i * 6271 + 73757) % h);
      var brightness = ((i * 3571 + 21377) % 255) / 255;
      var size = (brightness > 0.85) ? 2 : 1;
      if (brightness > 0.97) size = 3;

      // Color: mostly cool white, some warm, rare blue
      var r = 180 + Math.round(brightness * 75);
      var gb = 180 + Math.round(brightness * 70);
      var blue = Math.min(255, gb + ((i % 7 === 0) ? 30 : 0));
      var alpha = 0.3 + brightness * 0.7;

      g.fillStyle = 'rgba(' + r + ',' + gb + ',' + blue + ',' + alpha + ')';
      g.fillRect(px, py, size, size);
    }

    // Very faint nebula wisps (barely visible)
    g.save();
    g.globalAlpha = 0.04;
    var nb = g.createRadialGradient(w * 0.3, h * 0.6, 0, w * 0.3, h * 0.6, w * 0.25);
    nb.addColorStop(0, '#2a1840');
    nb.addColorStop(1, 'transparent');
    g.fillStyle = nb;
    g.fillRect(0, 0, w, h);
    var nb2 = g.createRadialGradient(w * 0.7, h * 0.3, 0, w * 0.7, h * 0.3, w * 0.2);
    nb2.addColorStop(0, '#0a2040');
    nb2.addColorStop(1, 'transparent');
    g.fillStyle = nb2;
    g.fillRect(0, 0, w, h);
    g.restore();

    _sharedStarfieldCanvas = c;
    return c;
  }

  /* ============================================================
     RIFLE-STYLE ORNAMENTAL ENGRAVING HELPERS
     Western / commemorative coin scroll-work drawn into canvas.
     ============================================================ */
  function _drawScrollCorner(g, x, y, size, flip) {
    g.save();
    g.translate(x, y);
    if (flip) g.scale(-1, 1);
    g.beginPath();
    // Curling vine scroll
    g.moveTo(0, 0);
    g.bezierCurveTo(size * 0.3, -size * 0.1, size * 0.5, -size * 0.3, size * 0.4, -size * 0.5);
    g.bezierCurveTo(size * 0.3, -size * 0.35, size * 0.15, -size * 0.15, size * 0.1, -size * 0.05);
    g.moveTo(0, 0);
    g.bezierCurveTo(size * 0.15, -size * 0.25, size * 0.35, -size * 0.45, size * 0.6, -size * 0.35);
    // Leaf flourish
    g.moveTo(size * 0.2, -size * 0.1);
    g.bezierCurveTo(size * 0.35, -size * 0.05, size * 0.45, -size * 0.15, size * 0.3, -size * 0.25);
    g.stroke();
    g.restore();
  }

  function _drawEngraving(g, w, h) {
    // Rifle-stock style ornamental scrollwork around the card
    g.save();
    g.lineWidth = 1.2;

    var inset = 55;
    var scrollSz = w * 0.12;

    // Four corner scrolls
    _drawScrollCorner(g, inset, inset, scrollSz, false);
    _drawScrollCorner(g, w - inset, inset, scrollSz, true);
    g.save();
    g.translate(0, h);
    g.scale(1, -1);
    _drawScrollCorner(g, inset, inset, scrollSz, false);
    _drawScrollCorner(g, w - inset, inset, scrollSz, true);
    g.restore();

    // Horizontal scroll bars (top and bottom)
    var barY1 = inset + 5;
    var barY2 = h - inset - 5;
    var barL = inset + scrollSz * 0.5;
    var barR = w - inset - scrollSz * 0.5;
    g.beginPath();
    g.moveTo(barL, barY1);
    g.bezierCurveTo(w * 0.35, barY1 - 4, w * 0.65, barY1 - 4, barR, barY1);
    g.moveTo(barL, barY2);
    g.bezierCurveTo(w * 0.35, barY2 + 4, w * 0.65, barY2 + 4, barR, barY2);
    g.stroke();

    // Vertical vine lines (left and right edges)
    var vineX1 = inset + 3;
    var vineX2 = w - inset - 3;
    var vineT = inset + scrollSz * 0.4;
    var vineB = h - inset - scrollSz * 0.4;
    g.beginPath();
    g.moveTo(vineX1, vineT);
    g.bezierCurveTo(vineX1 - 3, h * 0.4, vineX1 + 3, h * 0.6, vineX1, vineB);
    g.moveTo(vineX2, vineT);
    g.bezierCurveTo(vineX2 + 3, h * 0.4, vineX2 - 3, h * 0.6, vineX2, vineB);
    g.stroke();

    // Small diamond accents along the horizontal bars
    for (var d = 0; d < 5; d++) {
      var dx = barL + (barR - barL) * (d + 0.5) / 5;
      _drawDiamond(g, dx, barY1, 3);
      _drawDiamond(g, dx, barY2, 3);
    }

    g.restore();
  }

  function _drawDiamond(g, x, y, r) {
    g.beginPath();
    g.moveTo(x, y - r);
    g.lineTo(x + r, y);
    g.lineTo(x, y + r);
    g.lineTo(x - r, y);
    g.closePath();
    g.fill();
  }

  /* ============================================================
     GROOVE CHANNEL — narrow recessed ring between frame and inner panel
     Starfield peeks through this gap. Much simpler than the old
     multi-zone approach — just one continuous groove ring.
     ============================================================ */
  function _drawGrooveRing(g, w, h) {
    // Groove sits between outer frame and inner content panel
    var frameW = Math.round(w * 0.08);   // frame thickness
    var grooveW = Math.round(w * 0.025); // groove width
    var cf = Math.round(w * 0.15);       // chamfer offset in canvas coords

    // Outer edge of groove (inside frame)
    var ox = frameW, oy = frameW;
    var ow = w - frameW * 2, oh = h - frameW * 2;
    var oc = cf - frameW + grooveW;

    // Draw groove as a filled chamfered ring
    // Outer boundary
    chamfPath(g, ox, oy, ow, oh, Math.max(4, oc));
    g.fill();

    // Punch out inner boundary (groove width inward)
    g.save();
    g.globalCompositeOperation = 'destination-out';
    var ix = ox + grooveW, iy = oy + grooveW;
    var iw = ow - grooveW * 2, ih = oh - grooveW * 2;
    var ic = Math.max(4, oc - grooveW);
    chamfPath(g, ix, iy, iw, ih, ic);
    g.fill();
    g.restore();
  }

  /* ============================================================
     FACE DIFFUSE TEXTURE
     Dossier-style: brass frame + colored inner panel + silhouette art.
     Matches "Top Secret Travel" reference aesthetic.
     ============================================================ */
  function genFaceTex(m) {
    var w = CFG.texW, h = CFG.texH;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    var pal = _cardPalette(m);

    var frameW = Math.round(w * 0.08);
    var cf     = Math.round(w * 0.15);  // chamfer in canvas px
    var cx     = w / 2;
    var cy     = h * 0.55; // center of art area (slightly below middle)

    // ── 1. Fill entire face with brass frame color ──
    var brassBg = g.createLinearGradient(0, 0, w, h);
    brassBg.addColorStop(0,   '#8a7028');
    brassBg.addColorStop(0.25,'#c09838');
    brassBg.addColorStop(0.5, '#d4a843');
    brassBg.addColorStop(0.75,'#c09838');
    brassBg.addColorStop(1,   '#8a7028');
    g.fillStyle = brassBg;
    g.fillRect(0, 0, w, h);

    // Subtle metallic grain on frame
    g.save();
    g.globalAlpha = 0.06;
    for (var gy = 0; gy < h; gy += 2) {
      var gr = 180 + Math.round(Math.sin(gy * 0.3) * 30);
      g.fillStyle = 'rgb(' + gr + ',' + Math.round(gr * 0.85) + ',' + Math.round(gr * 0.5) + ')';
      g.fillRect(0, gy, w, 1);
    }
    g.restore();

    // ── 2. Groove ring (dark recess between frame and inner panel) ──
    g.save();
    g.fillStyle = '#060408';
    _drawGrooveRing(g, w, h);
    g.restore();

    // ── 3. Inner content panel: colored gradient ──
    var panelX = frameW + Math.round(w * 0.025);
    var panelY = frameW + Math.round(h * 0.02);
    var panelW = w - panelX * 2;
    var panelH = h - panelY * 2;
    var panelCf = Math.max(4, cf - frameW - Math.round(w * 0.025));

    g.save();
    chamfPath(g, panelX, panelY, panelW, panelH, panelCf);
    g.clip();

    // Dark base
    g.fillStyle = pal.bg;
    g.fillRect(panelX, panelY, panelW, panelH);

    // Radial color glow — centered in content area
    var glowR = Math.max(panelW, panelH) * 0.55;
    var glow = g.createRadialGradient(cx, cy, 0, cx, cy, glowR);
    glow.addColorStop(0,   pal.hi);
    glow.addColorStop(0.5, pal.mid);
    glow.addColorStop(1,   pal.bg);
    g.fillStyle = glow;
    g.fillRect(panelX, panelY, panelW, panelH);

    // Edge vignette
    var vig = g.createRadialGradient(cx, h * 0.5, glowR * 0.3, cx, h * 0.5, glowR * 1.1);
    vig.addColorStop(0, 'transparent');
    vig.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = vig;
    g.fillRect(panelX, panelY, panelW, panelH);

    // ── 4. Suit symbol as large dark silhouette ──
    g.save();
    var suitSize = Math.round(w * 0.42);
    g.font = suitSize + 'px ' + EMOJI_FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,0.65)';
    g.fillText(m.suit, cx, cy);
    // Subtle colored rim on the silhouette
    g.globalAlpha = 0.15;
    g.fillStyle = pal.glow;
    g.fillText(m.suit, cx - 1, cy - 1);
    g.restore();

    // ── 5. Decorative stamp elements (passport-style) ──
    g.save();
    g.globalAlpha = 0.12;
    g.strokeStyle = pal.glow;
    g.lineWidth = 1.5;
    // Circular stamp top-right area
    g.beginPath();
    g.arc(cx + panelW * 0.28, panelY + panelH * 0.18, w * 0.06, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(cx + panelW * 0.28, panelY + panelH * 0.18, w * 0.045, 0, Math.PI * 2);
    g.stroke();
    // Rectangular stamp bottom-left
    g.strokeRect(panelX + panelW * 0.08, panelY + panelH * 0.75, w * 0.12, w * 0.06);
    // Diagonal stamp text
    g.translate(panelX + panelW * 0.15, panelY + panelH * 0.82);
    g.rotate(-0.15);
    g.font = Math.round(w * 0.018) + 'px ' + MONO_FONT;
    g.fillStyle = pal.glow;
    g.globalAlpha = 0.10;
    g.fillText('APPROVED', 0, 0);
    g.restore();

    // ── 6. Title text — crystal clear white ──
    g.save();
    var titleSize = Math.round(w * 0.07);
    g.font = 'bold ' + titleSize + 'px ' + TITLE_FONT;
    g.textAlign = 'center';
    g.fillStyle = '#ffffff';
    g.shadowColor = 'rgba(0,0,0,0.6)';
    g.shadowBlur = 6;
    g.shadowOffsetY = 2;

    // Multi-line title support — split into words, 2 lines
    var words = (m.classified || 'TOP SECRET').toUpperCase().split(' ');
    var line1 = words.slice(0, Math.ceil(words.length / 2)).join(' ');
    var line2 = words.slice(Math.ceil(words.length / 2)).join(' ');
    var titleY = panelY + panelH * 0.22;
    g.fillText(line1, cx, titleY);
    if (line2) g.fillText(line2, cx, titleY + titleSize * 1.1);
    g.restore();

    // ── 7. Subtitle / mission label ──
    g.save();
    g.font = Math.round(w * 0.028) + 'px ' + MONO_FONT;
    g.textAlign = 'center';
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.shadowColor = 'rgba(0,0,0,0.4)';
    g.shadowBlur = 3;
    g.fillText((m.label || 'MISSION DOSSIER').toUpperCase(), cx, panelY + panelH * 0.88);
    g.restore();

    // ── 8. Mission title at bottom ──
    g.save();
    g.font = 'bold ' + Math.round(w * 0.036) + 'px ' + MONO_FONT;
    g.textAlign = 'center';
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.shadowColor = 'rgba(0,0,0,0.5)';
    g.shadowBlur = 4;
    g.fillText(m.title.toUpperCase(), cx, panelY + panelH * 0.94);
    g.restore();

    g.restore(); // end panel clip

    // ── 9. Brass frame highlight edges ──
    g.save();
    g.strokeStyle = '#f0d060';
    g.lineWidth = 3;
    g.shadowColor = 'rgba(255,220,120,0.3)';
    g.shadowBlur = 4;
    chamfPath(g, 4, 4, w - 8, h - 8, cf);
    g.stroke();
    // Inner frame line
    g.strokeStyle = '#d4a843';
    g.lineWidth = 2;
    g.shadowBlur = 2;
    var ifx = frameW - 2, ify = frameW - 2;
    chamfPath(g, ifx, ify, w - ifx * 2, h - ify * 2, Math.max(4, cf - frameW + 4));
    g.stroke();
    g.restore();

    // ── 10. Corner accents (triangular brass pieces at chamfers) ──
    g.save();
    var accentGrad = g.createLinearGradient(0, 0, w, h);
    accentGrad.addColorStop(0, '#d4a843');
    accentGrad.addColorStop(0.5, '#f0d060');
    accentGrad.addColorStop(1, '#c09030');
    g.fillStyle = accentGrad;
    var accentSz = Math.round(cf * 0.6);
    _drawAllCornerAccents(g, w, h, accentSz);
    g.restore();

    return c;
  }

  /* ============================================================
     HEIGHT MAP — Controls starfield visibility + physical relief.
     New layout: raised brass frame + corner accents, recessed inner panel,
     groove ring between frame and panel.

     Height tiers:
       1.0 (white) = frame, corner accents, frame edges
       0.70        = inner content panel surface
       0.50        = text areas (slightly raised above panel)
       0.30        = groove edge ramp
       0.0 (black) = groove ring (starfield window)
     ============================================================ */
  function genHeightMap(m) {
    var w = CFG.texW, h = CFG.texH;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');

    var frameW = Math.round(w * 0.08);
    var cf     = Math.round(w * 0.15);
    var cx     = w / 2;
    var cy     = h * 0.55;

    // ── Frame area: maximum height (white) ──
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);

    // ── Groove ring: deep black (starfield) ──
    g.save();
    g.fillStyle = '#000000';
    _drawGrooveRing(g, w, h);
    g.restore();

    // ── Groove edge ramp (soft transition) ──
    g.save();
    g.shadowColor = '#404040';
    g.shadowBlur = 6;
    g.fillStyle = 'rgba(0,0,0,0)';
    _drawGrooveRing(g, w, h);
    g.restore();

    // ── Inner content panel: mid-height gray ──
    var panelX = frameW + Math.round(w * 0.025);
    var panelY = frameW + Math.round(h * 0.02);
    var panelW = w - panelX * 2;
    var panelH = h - panelY * 2;
    var panelCf = Math.max(4, cf - frameW - Math.round(w * 0.025));

    g.save();
    g.fillStyle = '#b3b3b3'; // ~0.70 height
    chamfPath(g, panelX, panelY, panelW, panelH, panelCf);
    g.fill();
    g.restore();

    // ── Corner accents: maximum height (same as frame) ──
    g.save();
    g.fillStyle = '#ffffff';
    var accentSz = Math.round(cf * 0.6);
    _drawAllCornerAccents(g, w, h, accentSz);
    g.restore();

    // ── Frame edge highlights ──
    g.save();
    g.strokeStyle = '#ffffff';
    g.shadowColor = '#ffffff';
    g.shadowBlur = 6;
    g.lineWidth = 8;
    chamfPath(g, 4, 4, w - 8, h - 8, cf);
    g.stroke();
    g.lineWidth = 4;
    chamfPath(g, frameW - 2, frameW - 2, w - (frameW - 2) * 2, h - (frameW - 2) * 2, Math.max(4, cf - frameW + 4));
    g.stroke();
    g.restore();

    return c;
  }

  /* ============================================================
     BUMP MAP — Relief detail for chamfered dossier card
     ============================================================ */
  function genBumpTex(m) {
    var w = CFG.texW, h = CFG.texH;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');

    var frameW = Math.round(w * 0.08);
    var cf     = Math.round(w * 0.15);

    // ── Frame area: raised ──
    g.fillStyle = '#e0e0e0';
    g.fillRect(0, 0, w, h);

    // ── Groove ring: depressed ──
    g.save();
    g.fillStyle = '#303030';
    _drawGrooveRing(g, w, h);
    g.restore();

    // ── Inner panel: mid-level ──
    var panelX = frameW + Math.round(w * 0.025);
    var panelY = frameW + Math.round(h * 0.02);
    var panelW = w - panelX * 2;
    var panelH = h - panelY * 2;
    var panelCf = Math.max(4, cf - frameW - Math.round(w * 0.025));

    g.fillStyle = '#a0a0a0';
    chamfPath(g, panelX, panelY, panelW, panelH, panelCf);
    g.fill();

    // ── Frame edges: max height ──
    g.strokeStyle = '#f0f0f0';
    g.lineWidth = 8;
    chamfPath(g, 4, 4, w - 8, h - 8, cf);
    g.stroke();
    g.lineWidth = 4;
    chamfPath(g, frameW - 2, frameW - 2, w - (frameW - 2) * 2, h - (frameW - 2) * 2, Math.max(4, cf - frameW + 4));
    g.stroke();

    // ── Corner accents: raised ──
    g.fillStyle = '#e8e8e8';
    var accentSz = Math.round(cf * 0.6);
    _drawAllCornerAccents(g, w, h, accentSz);

    return c;
  }

  /* ============================================================
     BACK FACE TEXTURE — Polished brass, EYES ONLY
     ============================================================ */
  function genBackTex(m) {
    var w = CFG.texW, h = CFG.texH;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');

    // Rich dark bronze gradient
    var bg = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6);
    bg.addColorStop(0, '#1e1a10');
    bg.addColorStop(1, '#0c0a06');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);

    var cx = w / 2, cy = h / 2;

    // Concentric rings
    for (var ring = 1; ring <= 6; ring++) {
      g.strokeStyle = 'rgba(180,150,60,' + (0.12 - ring * 0.015) + ')';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(cx, cy, ring * w * 0.07, 0, Math.PI * 2);
      g.stroke();
    }

    // EYES ONLY stamp
    g.save();
    g.font = 'bold ' + Math.round(w * 0.065) + 'px ' + MONO_FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(180,150,60,0.22)';
    g.fillText('EYES', cx, cy - h * 0.03);
    g.fillText('ONLY', cx, cy + h * 0.05);
    g.restore();

    // Border — chamfered
    var cf = Math.round(w * 0.15);
    g.strokeStyle = 'rgba(180,150,60,0.12)';
    g.lineWidth = 3;
    chamfPath(g, 20, 20, w - 40, h - 40, cf - 10);
    g.stroke();

    return c;
  }

  /* ============================================================
     GLSL SHADER INJECTION — Starfield in deep relief areas
     Built lazily so CFG.starLayers reflects device tier.
     ============================================================ */

  // Fragment shader: uniform & function declarations
  // Uses shared static starfield texture instead of procedural GLSL
  function _shaderPars() {
    return [
      'uniform sampler2D heightMap;',
      'uniform sampler2D starfieldTex;',
      'uniform float uTime;',
      'uniform float coinRotX;',
      'uniform float coinRotY;',
      'float _deepMask = 0.0;',
    ].join('\n');
  }

  // Inject after diffuse map sampling: compute height mask, darken deep areas
  // Tightened threshold: only height values near 0 (deep groove channels) get starfield
  var SHADER_HEIGHT = [
    '{',
    '  float _coinH = texture2D(heightMap, vUv).r;',
    '  float _capF = step(0.3, abs(vNormal.z));',
    '  _deepMask = smoothstep(0.15, 0.02, _coinH) * _capF;',
    '  diffuseColor.rgb *= (1.0 - _deepMask * 0.96);',
    '}',
  ].join('\n');

  // Inject after emissivemap_fragment: sample shared starfield texture as emission
  var SHADER_EMIT = [
    '{',
    '  vec2 _starUV = vUv + vec2(coinRotY, -coinRotX) * 0.015;',
    '  vec3 _stars = texture2D(starfieldTex, _starUV).rgb;',
    '  // Gentle twinkle on star brightness',
    '  _stars *= 0.85 + 0.15 * sin(uTime * 1.2 + vUv.x * 20.0 + vUv.y * 15.0);',
    '  totalEmissiveRadiance += _stars * _deepMask * 1.6;',
    '}',
  ].join('\n');

  /* ============================================================
     ENVIRONMENT MAP — Brass-focused reflections
     ============================================================ */
  function createEnvMap() {
    var pmrem = new T.PMREMGenerator(_renderer);
    pmrem.compileCubemapShader();

    var es = new T.Scene();
    es.background = new T.Color(0x2a3830);

    // Bright warm overhead (fluorescent tubes in a SCIF)
    var l1 = new T.PointLight(0xf0e0c0, 1.2, 20);
    l1.position.set(0, 6, 4);
    es.add(l1);

    // Strong brass accent from left
    var l2 = new T.PointLight(0xd4a843, 0.9, 15);
    l2.position.set(-4, 3, 3);
    es.add(l2);

    // Cool terminal glow (contrast)
    var l3 = new T.PointLight(0x4a7a6a, 0.4, 12);
    l3.position.set(4, -2, 5);
    es.add(l3);

    // Brass from below for edge catch
    var l4 = new T.PointLight(0xc09030, 0.7, 10);
    l4.position.set(0, -4, 2);
    es.add(l4);

    var rt = pmrem.fromScene(es, 0);
    pmrem.dispose();
    return rt.texture;
  }

  /* ============================================================
     MATERIALS — Per-card face (with shader injection), back
     ============================================================ */
  function buildMats(mission) {
    var faceC = genFaceTex(mission);
    var faceT = new T.CanvasTexture(faceC);
    if (T.sRGBEncoding) faceT.encoding = T.sRGBEncoding;

    var heightC = genHeightMap(mission);
    var heightT = new T.CanvasTexture(heightC);

    var bumpC = genBumpTex(mission);
    var bumpT = new T.CanvasTexture(bumpC);

    var face = new T.MeshStandardMaterial({
      map:             faceT,
      bumpMap:         bumpT,
      bumpScale:       CFG.bumpScale,
      metalness:       CFG.metalness,
      roughness:       CFG.roughness,
      envMap:          _envMap,
      envMapIntensity: CFG.envIntensity,
      color:           0xffffff,
    });

    // ── Shader injection: shared static starfield in deep relief areas ──
    var starfieldC = _getStarfield();
    var starfieldT = new T.CanvasTexture(starfieldC);
    starfieldT.wrapS = T.RepeatWrapping;
    starfieldT.wrapT = T.RepeatWrapping;

    face.onBeforeCompile = function (shader) {
      // Add custom uniforms
      shader.uniforms.heightMap    = { value: heightT };
      shader.uniforms.starfieldTex = { value: starfieldT };
      shader.uniforms.uTime        = { value: 0.0 };
      shader.uniforms.coinRotX     = { value: 0.0 };
      shader.uniforms.coinRotY     = { value: 0.0 };

      // 1. Inject declarations + starfield function (before map_pars)
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_pars_fragment>',
        _shaderPars() + '\n#include <map_pars_fragment>'
      );

      // 2. After diffuse map sampling: compute height mask, darken deep
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        '#include <map_fragment>\n' + SHADER_HEIGHT
      );

      // 3. Reduce metalness in deep areas so starfield shows through cleanly
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <metalnessmap_fragment>',
        '#include <metalnessmap_fragment>\n' +
        'metalnessFactor *= (1.0 - _deepMask * 0.88);'
      );

      // 4. After emissive map: add starfield as emission in deep areas
      //    (totalEmissiveRadiance flows into outgoingLight → tone mapping → encoding)
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n' + SHADER_EMIT
      );

      // Store shader ref for per-frame uniform updates
      face.userData.shader = shader;
    };

    // ── Back face material (polished brass, no starfield) ──
    var backC = genBackTex(mission);
    var backT = new T.CanvasTexture(backC);
    if (T.sRGBEncoding) backT.encoding = T.sRGBEncoding;

    var back = new T.MeshStandardMaterial({
      map:             backT,
      metalness:       0.85,
      roughness:       0.25,
      envMap:          _envMap,
      envMapIntensity: 0.7,
      color:           0xffffff,
    });

    // ExtrudeGeometry groups: index 0 = front cap + side walls, index 1 = back cap
    return [face, back];
  }

  /* ============================================================
     SCENE + CAMERA + LIGHTS
     ============================================================ */
  function setupScene() {
    _scene = new T.Scene();

    // Warm directional key (strong for brass highlights)
    var key = new T.DirectionalLight(0xf0e0c0, 1.5);
    key.position.set(-2, 3, 5);
    _scene.add(key);

    // Brass-tinted fill from right
    var fill = new T.DirectionalLight(0xd0b880, 0.6);
    fill.position.set(3, 1, 4);
    _scene.add(fill);

    // Ambient
    _scene.add(new T.AmbientLight(0x5a6a60, 0.45));

    // Brass rim light from below-right (edge catch)
    var rim = new T.PointLight(0xd4a843, 0.7, 12);
    rim.position.set(2, -2, 4);
    _scene.add(rim);

    // Hemisphere: surveillance green sky / neutral ground
    _scene.add(new T.HemisphereLight(0x4a6a5a, 0x1a1a18, 0.3));
  }

  function setupCamera() {
    // Orthographic camera sized exactly to coin + bevel
    var hw = (CFG.width  + CFG.bevel * 2) / 2;
    var hh = (CFG.height + CFG.bevel * 2) / 2;
    _camera = new T.OrthographicCamera(-hw, hw, hh, -hh, 0.1, 20);
    _camera.position.set(0, 0, CFG.camDist);
    _camera.lookAt(0, 0, 0);
  }

  /* ============================================================
     MOUNT — Probes device, loads Three.js, builds scene
     Falls back to CSS cards if WebGL unavailable or too slow.
     ============================================================ */
  function mount(fanEl, missions) {
    if (_ready || _disposed) return;

    // ── Device capability probe ──
    var tier = _probeWebGL();
    if (tier === 'none') {
      console.log('[Card3D] No WebGL / very weak GPU — CSS fallback');
      return;
    }
    _applyTier(tier);
    console.log('[Card3D] Device tier: ' + tier +
      ' | tex: ' + CFG.texW + '×' + CFG.texH +
      ' | mobile: ' + _isMobile + ' | touch: ' + _isTouch);

    // ── Safety timeout — if Three.js hasn't loaded in 8s, abort ──
    _mountTimeout = setTimeout(function () {
      if (!_ready && !_disposed) {
        console.warn('[Card3D] Mount timeout — CSS fallback');
        _disposed = true; // prevent late init
      }
    }, 8000);

    _loadThree(function () {
      if (_disposed) return; // timed out
      clearTimeout(_mountTimeout);

      try {
        _offCanvas = document.createElement('canvas');
        _offCanvas.width  = CFG.texW;
        _offCanvas.height = CFG.texH;

        _renderer = new T.WebGLRenderer({
          canvas:          _offCanvas,
          alpha:           true,
          antialias:       tier === 'high',   // skip AA on lower tiers
          powerPreference: tier === 'high' ? 'high-performance' : 'low-power',
        });
        _renderer.setSize(CFG.texW, CFG.texH);
        _renderer.setPixelRatio(1);
        if (T.sRGBEncoding) _renderer.outputEncoding = T.sRGBEncoding;
        _renderer.toneMapping = T.ACESFilmicToneMapping;
        _renderer.toneMappingExposure = 1.6;

        _envMap = createEnvMap();
        setupScene();
        setupCamera();
        _sharedGeo = buildGeo();

        // Per-card setup
        var cards = fanEl.querySelectorAll('.coin-card');
        missions.forEach(function (m, i) {
          if (i >= cards.length) return;
          var card = cards[i];

          var wrapper = document.createElement('div');
          wrapper.className = 'coin-card-canvas';
          var dc = document.createElement('canvas');
          dc.width  = CFG.texW;
          dc.height = CFG.texH;
          dc.style.cssText = 'width:100%;height:100%;display:block;object-fit:contain;';
          wrapper.appendChild(dc);
          card.appendChild(wrapper);

          var mats = buildMats(m);
          var mesh = new T.Mesh(_sharedGeo, mats);
          mesh.visible = false;
          _scene.add(mesh);

          _coins.push({
            mesh:      mesh,
            dCtx:      dc.getContext('2d'),
            dCanvas:   dc,
            wrapper:   wrapper,
            hovered:   false,
            selecting: false,
            selT0:     0,
            phase:     i * 1.2,
            tiltX:     0,
            tiltY:     0,
          });
        });

        // ── Validation render — confirm WebGL actually produces pixels ──
        if (_coins.length > 0) {
          _coins[0].mesh.visible = true;
          _renderer.render(_scene, _camera);
          _coins[0].mesh.visible = false;
          var px = new Uint8Array(4);
          var gl = _renderer.getContext();
          gl.readPixels(
            Math.floor(CFG.texW / 2), Math.floor(CFG.texH / 2),
            1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px
          );
          if (px[0] === 0 && px[1] === 0 && px[2] === 0 && px[3] === 0) {
            console.warn('[Card3D] Validation render produced black — CSS fallback');
            _cleanupPartialMount();
            return;
          }
        }

        _t0 = performance.now();
        _ready = true;

        setTimeout(function () {
          _coins.forEach(function (c) { c.wrapper.classList.add('coin-3d-active'); });
          fanEl.classList.add('coin-3d-mode');
        }, 100);

        _animId = requestAnimationFrame(_loop);
        console.log('[Card3D] Mounted — ' + _coins.length + ' coins | tier: ' + tier);
      } catch (err) {
        console.warn('[Card3D] Mount failed:', err);
        _cleanupPartialMount();
      }
    });
  }

  // Clean up partial WebGL resources if mount fails after partial init
  function _cleanupPartialMount() {
    _ready = false;
    _coins.forEach(function (cn) {
      if (cn.wrapper && cn.wrapper.parentNode) {
        cn.wrapper.parentNode.removeChild(cn.wrapper);
      }
    });
    _coins = [];
    if (_sharedGeo) { _sharedGeo.dispose(); _sharedGeo = null; }
    if (_envMap)    { _envMap.dispose(); _envMap = null; }
    if (_renderer)  { _renderer.dispose(); _renderer = null; }
  }

  /* ============================================================
     RENDER LOOP — frame-throttled on mobile for battery
     ============================================================ */
  function _loop() {
    if (_disposed) return;
    _animId = requestAnimationFrame(_loop);

    var now = performance.now();

    // ── Frame throttle (mobile: 30fps cap, low: 20fps cap) ──
    if (CFG.frameInterval > 0 && (now - _lastFrame) < CFG.frameInterval) return;
    _lastFrame = now;

    var t = (now - _t0) / 1000;

    for (var i = 0; i < _coins.length; i++) {
      var cn = _coins[i];

      // ── Idle wobble ──
      var p  = t * CFG.idleSpeed + cn.phase;
      var ix = Math.sin(p * 1.1) * CFG.idleAmp;
      var iy = Math.cos(p * 0.7) * CFG.idleAmp * 0.6;

      // ── Target tilt ──
      var tx = ix + (cn.hovered ? CFG.hoverTilt * 0.3 : 0);
      var ty = iy + (cn.hovered ? -CFG.hoverTilt * 0.5 : 0);

      // ── Select flip ──
      if (cn.selecting) {
        var sp = Math.min(1, (now - cn.selT0) / CFG.flipMs);
        var ease = sp < 0.5
          ? 2 * sp * sp
          : 1 - Math.pow(-2 * sp + 2, 2) / 2;
        ty = ease * Math.PI;
        tx = 0;
        if (sp >= 1) cn.selecting = false;
      }

      // ── Smooth interpolation ──
      cn.tiltX += (tx - cn.tiltX) * 0.12;
      cn.tiltY += (ty - cn.tiltY) * 0.12;

      cn.mesh.rotation.x = cn.tiltX;
      cn.mesh.rotation.y = cn.tiltY;

      // ── Update shader uniforms (time + rotation for parallax) ──
      var faceMat = cn.mesh.material[0];
      if (faceMat && faceMat.userData.shader) {
        var s = faceMat.userData.shader;
        s.uniforms.uTime.value    = t;
        s.uniforms.coinRotX.value = cn.tiltX;
        s.uniforms.coinRotY.value = cn.tiltY;
      }

      // ── Render this coin ──
      for (var j = 0; j < _coins.length; j++) _coins[j].mesh.visible = (j === i);
      _renderer.render(_scene, _camera);

      // ── Copy to display canvas ──
      cn.dCtx.clearRect(0, 0, cn.dCanvas.width, cn.dCanvas.height);
      cn.dCtx.drawImage(_offCanvas, 0, 0);
    }
  }

  /* ============================================================
     INTERACTION API
     ============================================================ */
  function setHover(index, hovered) {
    if (index >= 0 && index < _coins.length) {
      _coins[index].hovered = hovered;
    }
  }

  function selectCard(index) {
    return new Promise(function (resolve) {
      if (index < 0 || index >= _coins.length) { resolve(); return; }
      _coins[index].selecting = true;
      _coins[index].selT0 = performance.now();
      setTimeout(resolve, CFG.flipMs);
    });
  }

  /* ============================================================
     DISPOSE
     ============================================================ */
  function dispose() {
    _disposed = true;
    if (_animId) cancelAnimationFrame(_animId);

    _coins.forEach(function (cn) {
      if (cn.mesh) {
        if (Array.isArray(cn.mesh.material)) {
          cn.mesh.material.forEach(function (mt) {
            if (mt.map) mt.map.dispose();
            if (mt.bumpMap) mt.bumpMap.dispose();
            mt.dispose();
          });
        } else {
          if (cn.mesh.material.map) cn.mesh.material.map.dispose();
          if (cn.mesh.material.bumpMap) cn.mesh.material.bumpMap.dispose();
          cn.mesh.material.dispose();
        }
      }
      if (cn.wrapper && cn.wrapper.parentNode) {
        cn.wrapper.parentNode.removeChild(cn.wrapper);
      }
    });

    if (_sharedGeo) _sharedGeo.dispose();
    if (_envMap)    _envMap.dispose();
    if (_renderer)  _renderer.dispose();

    _coins = [];
    _ready = false;
    console.log('[Card3D] Disposed');
  }

  /* ============================================================
     THREE.JS LAZY LOADER — with network timeout
     ============================================================ */
  function _loadThree(cb) {
    if (window.THREE) { T = window.THREE; cb(); return; }

    var done = false;
    var s = document.createElement('script');
    s.src = 'js/vendor/three.min.js';

    s.onload = function () {
      if (done) return;
      done = true;
      T = window.THREE;
      cb();
    };

    s.onerror = function () {
      if (done) return;
      done = true;
      console.warn('[Card3D] Three.js load failed — CSS cards remain');
    };

    // Network timeout — if script hasn't loaded in 6s (slow 3G), give up
    setTimeout(function () {
      if (!done) {
        done = true;
        s.onload = s.onerror = null;
        console.warn('[Card3D] Three.js load timeout — CSS cards remain');
      }
    }, 6000);

    document.head.appendChild(s);
  }

})();
