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
    // Coin body (world units) — chunky metal slab
    width:  2.1,
    height: 3.4,
    depth:  0.58,        // thicker — edge must be clearly visible when tilted
    radius: 0.22,       // rounded corner radius (world units)
    bevel:  0.14,
    bevelSegs: 5,
    curveSegs: 12,

    // Texture resolution — set by _applyTier()
    texW: 1024,
    get texH() { return Math.round(this.texW * this.height / this.width); },

    // Material
    metalness: 0.92,
    roughness: 0.15,
    bumpScale: 0.045,
    envIntensity: 1.3,

    // Animation
    idleSpeed: 0.35,
    idleAmp:   0.055,
    hoverTilt: 0.12,
    flipMs:    800,

    // Camera — tight framing so coin fills the card container
    camDist: 5.8,
    camFov:  38,

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
     GEOMETRY — Rounded-corner extrusion with bevel
     Thick metal card with smooth rounded corners
     ============================================================ */
  function rrShape(w, h, r) {
    var s = new T.Shape();
    var hw = w / 2, hh = h / 2;
    s.moveTo(-hw + r, -hh);
    s.lineTo( hw - r, -hh);
    s.quadraticCurveTo( hw, -hh, hw, -hh + r);
    s.lineTo( hw,  hh - r);
    s.quadraticCurveTo( hw,  hh, hw - r,  hh);
    s.lineTo(-hw + r,  hh);
    s.quadraticCurveTo(-hw,  hh, -hw,  hh - r);
    s.lineTo(-hw, -hh + r);
    s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
    s.closePath();
    return s;
  }

  function buildGeo() {
    var geo = new T.ExtrudeGeometry(rrShape(CFG.width, CFG.height, CFG.radius), {
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
  // Rounded-rect path
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

  // Per-mission color palette — monochrome metal with subtle accent tints
  function _cardPalette(m) {
    var palettes = {
      '\u2660': { bg: '#0a0a10', mid: '#1a1a28', hi: '#2a2a40', accent: '#8888aa', name: 'gunmetal' },
      '\u2663': { bg: '#100808', mid: '#281818', hi: '#3a2020', accent: '#aa6666', name: 'bronze' },
      '\u2665': { bg: '#080a08', mid: '#182018', hi: '#203020', accent: '#66aa66', name: 'verdigris' },
      '\u2666': { bg: '#100e08', mid: '#282218', hi: '#3a3020', accent: '#aa9966', name: 'brass' },
    };
    return palettes[m.suit] || palettes['\u2660'];
  }

  // Emoji font stack — render suit symbols at max quality
  var EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif';
  var MONO_FONT  = '"Courier New",monospace';
  var TITLE_FONT = '"Impact","Arial Black","Helvetica Neue",sans-serif';

  // Draw concentric decoder-ring circles (inlaid ring feature)
  function _drawDecoderRing(g, cx, cy, outerR, innerR, ticks) {
    g.save();
    // Outer ring
    g.beginPath();
    g.arc(cx, cy, outerR, 0, Math.PI * 2);
    g.arc(cx, cy, innerR, 0, Math.PI * 2, true);
    g.fill();
    // Tick marks around the ring
    var tickR = (outerR + innerR) / 2;
    var tickLen = (outerR - innerR) * 0.5;
    g.lineWidth = 1;
    for (var i = 0; i < ticks; i++) {
      var a = (i / ticks) * Math.PI * 2;
      var cs = Math.cos(a), sn = Math.sin(a);
      g.beginPath();
      g.moveTo(cx + cs * (tickR - tickLen / 2), cy + sn * (tickR - tickLen / 2));
      g.lineTo(cx + cs * (tickR + tickLen / 2), cy + sn * (tickR + tickLen / 2));
      g.stroke();
    }
    g.restore();
  }

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
     GROOVE CHANNEL — narrow recessed ring between frame and inner panel
     Rounded-rect version. Starfield peeks through this gap.
     ============================================================ */
  function _drawGrooveRing(g, w, h) {
    var frameW = Math.round(w * 0.06);
    var grooveW = Math.round(w * 0.02);
    var cr = Math.round(w * 0.08); // corner radius in canvas coords

    // Outer edge of groove (inside frame)
    var ox = frameW, oy = frameW;
    var ow = w - frameW * 2, oh = h - frameW * 2;
    var ocr = Math.max(4, cr - frameW + grooveW);

    rrPath(g, ox, oy, ow, oh, ocr);
    g.fill();

    // Punch out inner boundary
    g.save();
    g.globalCompositeOperation = 'destination-out';
    var ix = ox + grooveW, iy = oy + grooveW;
    var iw = ow - grooveW * 2, ih = oh - grooveW * 2;
    var icr = Math.max(4, ocr - grooveW);
    rrPath(g, ix, iy, iw, ih, icr);
    g.fill();
    g.restore();
  }

  /* ============================================================
     FACE DIFFUSE TEXTURE
     Monochrome engraved metal card: dark brushed metal with inlaid
     decoder rings, engraved silhouette art, and monochrome labels.
     Sleek dark silhouette aesthetic — information-dense centered layout.
     ============================================================ */
  function genFaceTex(m) {
    var w = CFG.texW, h = CFG.texH;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    var pal = _cardPalette(m);

    var frameW = Math.round(w * 0.06);
    var cr     = Math.round(w * 0.08); // rounded corner radius in canvas px
    var cx     = w / 2;
    var cy     = h * 0.48;

    // ── 1. Dark brushed metal base ──
    var metalBg = g.createLinearGradient(0, 0, w * 0.3, h);
    metalBg.addColorStop(0,   '#1a1a1e');
    metalBg.addColorStop(0.3, '#222228');
    metalBg.addColorStop(0.5, '#1e1e24');
    metalBg.addColorStop(0.7, '#222228');
    metalBg.addColorStop(1,   '#18181c');
    g.fillStyle = metalBg;
    g.fillRect(0, 0, w, h);

    // Brushed metal grain (horizontal lines)
    g.save();
    g.globalAlpha = 0.08;
    for (var gy = 0; gy < h; gy += 2) {
      var gr = 100 + Math.round(Math.sin(gy * 0.5 + gy * gy * 0.0001) * 40);
      g.fillStyle = 'rgb(' + gr + ',' + gr + ',' + Math.round(gr * 1.05) + ')';
      g.fillRect(0, gy, w, 1);
    }
    g.restore();

    // ── 2. Very subtle frame edge bevel ──
    g.save();
    g.strokeStyle = 'rgba(160,160,170,0.04)';
    g.lineWidth = 3;
    rrPath(g, frameW / 2, frameW / 2, w - frameW, h - frameW, cr);
    g.stroke();
    g.restore();

    // ── 3. Groove ring (dark recess — starfield window) ──
    g.save();
    g.fillStyle = '#040406';
    _drawGrooveRing(g, w, h);
    g.restore();

    // ── 4. Inner panel — slightly lighter dark metal ──
    var panelX = frameW + Math.round(w * 0.02);
    var panelY = frameW + Math.round(h * 0.015);
    var panelW = w - panelX * 2;
    var panelH = h - panelY * 2;
    var panelCr = Math.max(4, cr - frameW);

    g.save();
    rrPath(g, panelX, panelY, panelW, panelH, panelCr);
    g.clip();

    // Dark metal panel base
    g.fillStyle = pal.bg;
    g.fillRect(panelX, panelY, panelW, panelH);

    // Very subtle radial lighter area in center
    var glowR = Math.max(panelW, panelH) * 0.5;
    var glow = g.createRadialGradient(cx, cy, 0, cx, cy, glowR);
    glow.addColorStop(0,   pal.hi);
    glow.addColorStop(0.5, pal.mid);
    glow.addColorStop(1,   pal.bg);
    g.globalAlpha = 0.6;
    g.fillStyle = glow;
    g.fillRect(panelX, panelY, panelW, panelH);
    g.globalAlpha = 1.0;

    // Edge vignette
    var vig = g.createRadialGradient(cx, h * 0.5, glowR * 0.3, cx, h * 0.5, glowR * 1.2);
    vig.addColorStop(0, 'transparent');
    vig.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = vig;
    g.fillRect(panelX, panelY, panelW, panelH);

    // ── 5. Inlaid decoder ring (concentric circles behind text) ──
    g.save();
    g.globalAlpha = 0.12;
    g.fillStyle = pal.accent;
    g.strokeStyle = pal.accent;
    var ringR = w * 0.18;
    _drawDecoderRing(g, cx, cy, ringR, ringR * 0.75, 36);
    // Second smaller ring
    g.globalAlpha = 0.08;
    _drawDecoderRing(g, cx, cy, ringR * 0.65, ringR * 0.50, 24);
    g.restore();

    // ── 6. Suit symbol as large dark silhouette ──
    g.save();
    var suitSize = Math.round(w * 0.35);
    g.font = suitSize + 'px ' + EMOJI_FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    // Dark shadow silhouette
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillText(m.suit, cx, cy);
    // Very subtle metallic edge
    g.globalAlpha = 0.08;
    g.fillStyle = pal.accent;
    g.fillText(m.suit, cx - 1, cy - 1);
    g.restore();

    // ── 7. Engraved monochrome title — centered ──
    g.save();
    var titleSize = Math.round(w * 0.058);
    g.font = 'bold ' + titleSize + 'px ' + TITLE_FONT;
    g.textAlign = 'center';
    // Engraved look: dark shadow + light fill
    g.fillStyle = 'rgba(200,200,210,0.85)';
    g.shadowColor = 'rgba(0,0,0,0.8)';
    g.shadowBlur = 4;
    g.shadowOffsetY = 2;
    var titleText = (m.title || 'MISSION').toUpperCase();
    g.fillText(titleText, cx, panelY + panelH * 0.18);
    g.restore();

    // ── 8. Classified label (small engraved) ──
    g.save();
    g.font = Math.round(w * 0.022) + 'px ' + MONO_FONT;
    g.textAlign = 'center';
    g.fillStyle = 'rgba(160,160,170,0.45)';
    g.letterSpacing = '0.2em';
    g.fillText((m.classified || 'CLASSIFIED').toUpperCase(), cx, panelY + panelH * 0.10);
    g.restore();

    // ── 9. Mission description (engraved) ──
    g.save();
    g.font = Math.round(w * 0.024) + 'px ' + MONO_FONT;
    g.textAlign = 'center';
    g.fillStyle = 'rgba(160,160,170,0.5)';
    g.shadowColor = 'rgba(0,0,0,0.5)';
    g.shadowBlur = 2;
    g.fillText((m.desc || '').toUpperCase(), cx, panelY + panelH * 0.25);
    g.restore();

    // ── 10. Duration / label at bottom center ──
    g.save();
    g.font = 'bold ' + Math.round(w * 0.032) + 'px ' + MONO_FONT;
    g.textAlign = 'center';
    g.fillStyle = 'rgba(180,180,190,0.6)';
    g.shadowColor = 'rgba(0,0,0,0.6)';
    g.shadowBlur = 3;
    var bottomLabel = m.duration ? m.duration : (m.label || '').toUpperCase();
    g.fillText(bottomLabel, cx, panelY + panelH * 0.88);
    g.restore();

    // ── 11. Thin engraved border line inside panel ──
    g.save();
    g.strokeStyle = 'rgba(150,150,160,0.15)';
    g.lineWidth = 1.5;
    var insetPx = Math.round(panelW * 0.04);
    rrPath(g, panelX + insetPx, panelY + insetPx,
      panelW - insetPx * 2, panelH - insetPx * 2,
      Math.max(2, panelCr - insetPx));
    g.stroke();
    g.restore();

    g.restore(); // end panel clip

    // ── 12. Frame edge highlights (very subtle metallic) ──
    g.save();
    g.strokeStyle = 'rgba(160,160,170,0.08)';
    g.lineWidth = 1.5;
    rrPath(g, 3, 3, w - 6, h - 6, cr);
    g.stroke();
    g.strokeStyle = 'rgba(120,120,130,0.06)';
    g.lineWidth = 1;
    var ifx = frameW - 1;
    rrPath(g, ifx, ifx, w - ifx * 2, h - ifx * 2, Math.max(4, cr - frameW + 3));
    g.stroke();
    g.restore();

    return c;
  }

  /* ============================================================
     HEIGHT MAP — Controls starfield visibility + physical relief.
     Rounded-corner metal card with groove ring.

     Height tiers:
       1.0 (white) = frame edges
       0.80        = frame surface
       0.65        = inner content panel
       0.45        = engraved text areas (slightly recessed)
       0.20        = decoder ring inlay
       0.0 (black) = groove ring (starfield window)
     ============================================================ */
  function genHeightMap(m) {
    var w = CFG.texW, h = CFG.texH;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');

    var frameW = Math.round(w * 0.06);
    var cr     = Math.round(w * 0.08);
    var cx     = w / 2;
    var cy     = h * 0.48;

    // ── Frame area: high (slightly below max) ──
    g.fillStyle = '#cccccc'; // 0.80
    g.fillRect(0, 0, w, h);

    // ── Groove ring: deep black (starfield) ──
    g.save();
    g.fillStyle = '#000000';
    _drawGrooveRing(g, w, h);
    g.restore();

    // ── Soft ramp around groove ──
    g.save();
    g.shadowColor = '#333333';
    g.shadowBlur = 8;
    g.fillStyle = 'rgba(0,0,0,0)';
    _drawGrooveRing(g, w, h);
    g.restore();

    // ── Inner content panel: mid-height ──
    var panelX = frameW + Math.round(w * 0.02);
    var panelY = frameW + Math.round(h * 0.015);
    var panelW = w - panelX * 2;
    var panelH = h - panelY * 2;
    var panelCr = Math.max(4, cr - frameW);

    g.fillStyle = '#a6a6a6'; // 0.65
    rrPath(g, panelX, panelY, panelW, panelH, panelCr);
    g.fill();

    // ── Decoder ring inlay: recessed ──
    g.save();
    g.fillStyle = '#333333'; // 0.20
    g.strokeStyle = '#333333';
    var ringR = w * 0.18;
    _drawDecoderRing(g, cx, cy, ringR, ringR * 0.75, 36);
    _drawDecoderRing(g, cx, cy, ringR * 0.65, ringR * 0.50, 24);
    g.restore();

    // ── Frame edge highlights: slightly raised ──
    g.save();
    g.strokeStyle = '#dddddd'; // 0.87 — subtle edge, not max white
    g.lineWidth = 3;
    rrPath(g, 3, 3, w - 6, h - 6, cr);
    g.stroke();
    g.strokeStyle = '#d0d0d0'; // 0.82
    g.lineWidth = 2;
    rrPath(g, frameW - 1, frameW - 1, w - (frameW - 1) * 2, h - (frameW - 1) * 2, Math.max(4, cr - frameW + 3));
    g.stroke();
    g.restore();

    return c;
  }

  /* ============================================================
     BUMP MAP — Relief detail for rounded-corner metal card
     ============================================================ */
  function genBumpTex(m) {
    var w = CFG.texW, h = CFG.texH;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');

    var frameW = Math.round(w * 0.06);
    var cr     = Math.round(w * 0.08);
    var cx     = w / 2;
    var cy     = h * 0.48;

    // ── Frame area: raised ──
    g.fillStyle = '#d0d0d0';
    g.fillRect(0, 0, w, h);

    // ── Groove ring: depressed ──
    g.save();
    g.fillStyle = '#282828';
    _drawGrooveRing(g, w, h);
    g.restore();

    // ── Inner panel: mid-level ──
    var panelX = frameW + Math.round(w * 0.02);
    var panelY = frameW + Math.round(h * 0.015);
    var panelW = w - panelX * 2;
    var panelH = h - panelY * 2;
    var panelCr = Math.max(4, cr - frameW);

    g.fillStyle = '#a0a0a0';
    rrPath(g, panelX, panelY, panelW, panelH, panelCr);
    g.fill();

    // ── Decoder ring inlay: depressed ──
    g.save();
    g.fillStyle = '#505050';
    g.strokeStyle = '#505050';
    var ringR = w * 0.18;
    _drawDecoderRing(g, cx, cy, ringR, ringR * 0.75, 36);
    _drawDecoderRing(g, cx, cy, ringR * 0.65, ringR * 0.50, 24);
    g.restore();

    // ── Frame edges: max height ──
    g.strokeStyle = '#eeeeee';
    g.lineWidth = 5;
    rrPath(g, 3, 3, w - 6, h - 6, cr);
    g.stroke();
    g.lineWidth = 3;
    rrPath(g, frameW - 1, frameW - 1, w - (frameW - 1) * 2, h - (frameW - 1) * 2, Math.max(4, cr - frameW + 3));
    g.stroke();

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

    // Border — rounded
    var cr = Math.round(w * 0.08);
    g.strokeStyle = 'rgba(150,150,160,0.12)';
    g.lineWidth = 3;
    rrPath(g, 20, 20, w - 40, h - 40, Math.max(4, cr - 10));
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
    es.background = new T.Color(0x101018);

    // Strong overhead — bright catchlight on bevel/edges
    var l1 = new T.PointLight(0xe0e8f0, 2.0, 25);
    l1.position.set(0, 6, 4);
    es.add(l1);

    // Cool accent from left — catches left edge
    var l2 = new T.PointLight(0x9098b0, 1.2, 18);
    l2.position.set(-5, 2, 2);
    es.add(l2);

    // Subtle warm fill from right
    var l3 = new T.PointLight(0xa09880, 0.5, 14);
    l3.position.set(5, -1, 4);
    es.add(l3);

    // Strong rim from below — bright edge reflection on bottom face
    var l4 = new T.PointLight(0xb0b0c0, 1.5, 14);
    l4.position.set(0, -5, 1);
    es.add(l4);

    // Back-light from above — grazes top edge when tilted
    var l5 = new T.PointLight(0x8088a0, 0.8, 12);
    l5.position.set(0, 5, -2);
    es.add(l5);

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

    // Cool-white directional key (studio lighting for dark metal)
    var key = new T.DirectionalLight(0xd0d8e0, 1.6);
    key.position.set(-2, 3, 5);
    _scene.add(key);

    // Subtle warm fill from right (adds metal warmth)
    var fill = new T.DirectionalLight(0xb0a890, 0.5);
    fill.position.set(3, 1, 4);
    _scene.add(fill);

    // Ambient — cool neutral
    _scene.add(new T.AmbientLight(0x505560, 0.4));

    // Strong rim from below — catches the bottom edge to show thickness
    var rim = new T.PointLight(0xb0b8c0, 1.8, 16);
    rim.position.set(0.5, -4, 1.5);
    _scene.add(rim);

    // Secondary rim from left — catches the left edge for depth
    var rim2 = new T.PointLight(0xa0a8b8, 1.2, 12);
    rim2.position.set(-4, 0, 1);
    _scene.add(rim2);

    // Subtle top back-light (grazing angle catches the top edge when tilted away)
    var rimTop = new T.PointLight(0x8890a0, 0.9, 14);
    rimTop.position.set(0, 4, -1);
    _scene.add(rimTop);

    // Hemisphere: dark cool sky / dark ground
    _scene.add(new T.HemisphereLight(0x404858, 0x181820, 0.3));
  }

  function setupCamera() {
    // Perspective camera — essential for showing the coin's 3D thickness.
    // Narrow FOV keeps distortion minimal while letting depth be visible.
    var aspect = CFG.texW / CFG.texH;
    _camera = new T.PerspectiveCamera(CFG.camFov, aspect, 0.1, 50);
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
        _renderer.toneMappingExposure = 1.8;

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

      // ── Idle wobble + base tilt to show thickness ──
      var p  = t * CFG.idleSpeed + cn.phase;
      var ix = Math.sin(p * 1.1) * CFG.idleAmp + 0.18;   // base X tilt — top tilted away, ~10° shows bottom edge
      var iy = Math.cos(p * 0.7) * CFG.idleAmp * 0.6 - 0.09; // base Y tilt — left side away, ~5° shows left edge

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
