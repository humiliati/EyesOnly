/**
 * card-coin-3d.js — Military Challenge Coin 3D Renderer v2
 *
 * Three-tier PBR coin: polished brass (raised) → satin metal (mid) → cosmic starfield (deep).
 * Height map drives material blending via onBeforeCompile shader injection.
 * Procedural parallax starfield in GLSL — deep areas look like infinite space.
 *
 * One offscreen WebGL context, per-card 2D display canvases.
 * Desktop only (hover:hover media query).
 *
 * NOT casino/poker — military honor coins on a surveillance desk.
 */
(function () {
  'use strict';

  /* ============================================================
     CONFIGURATION
     ============================================================ */
  var CFG = {
    // Coin body (world units)
    width:  2.1,
    height: 3.4,
    depth:  0.30,        // thicker for visible brass edge
    radius: 0.14,
    bevel:  0.07,        // pronounced bevel catches light on brass
    bevelSegs: 4,
    curveSegs: 12,

    // Texture resolution — 2× for crisp text & emoji
    texW: 1024,
    get texH() { return Math.round(this.texW * this.height / this.width); },

    // Material (raised brass zones)
    metalness: 0.92,
    roughness: 0.15,     // highly polished
    bumpScale: 0.030,
    envIntensity: 1.0,

    // Animation
    idleSpeed: 0.35,
    idleAmp:   0.055,
    hoverTilt: 0.12,
    flipMs:    800,

    // Camera
    camDist: 6.0,
  };

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
     GEOMETRY — Rounded-rect extrusion with bevel
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

  // Emoji font stack — render suit symbols at max quality
  var EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif';
  var MONO_FONT  = '"Courier New",monospace';

  /* ============================================================
     FACE DIFFUSE TEXTURE — Polished brass raised on dark deep
     ============================================================ */
  function genFaceTex(m) {
    var w = CFG.texW, h = CFG.texH;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');

    // Deep background (near black — shader replaces with starfield)
    g.fillStyle = '#080604';
    g.fillRect(0, 0, w, h);

    // Subtle radial depth gradient
    var bg = g.createRadialGradient(w / 2, h * 0.44, 0, w / 2, h * 0.44, w * 0.55);
    bg.addColorStop(0, 'rgba(18,14,8,0.5)');
    bg.addColorStop(1, 'rgba(4,3,2,0.3)');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);

    var cx = w / 2, cy = h * 0.44;
    var brass      = '#d4a843';
    var brassLight = '#e8c060';
    var brassDark  = '#a08030';

    // ── Outer border rim ──
    g.save();
    g.strokeStyle = brass;
    g.lineWidth = 8;
    g.shadowColor = 'rgba(212,168,67,0.3)';
    g.shadowBlur = 6;
    rrPath(g, 18, 18, w - 36, h - 36, 14);
    g.stroke();
    g.shadowBlur = 0;
    g.strokeStyle = brassDark;
    g.lineWidth = 3;
    rrPath(g, 32, 32, w - 64, h - 64, 10);
    g.stroke();
    g.restore();

    // ── Decorative border chain (tiny dashes) ──
    g.save();
    g.strokeStyle = 'rgba(180,150,60,0.25)';
    g.lineWidth = 1.5;
    g.setLineDash([4, 4]);
    rrPath(g, 42, 42, w - 84, h - 84, 8);
    g.stroke();
    g.setLineDash([]);
    g.restore();

    // ── Concentric engraved rings ──
    for (var ring = 1; ring <= 10; ring++) {
      var rr = ring * w * 0.040;
      var alpha = Math.max(0.08, 0.28 - ring * 0.018);
      g.strokeStyle = 'rgba(180,150,60,' + alpha + ')';
      g.lineWidth = ring % 3 === 0 ? 2.0 : 1.0;
      g.beginPath();
      g.arc(cx, cy, rr, 0, Math.PI * 2);
      g.stroke();
    }

    // ── Radial hatching ──
    g.save();
    g.globalAlpha = 0.05;
    g.strokeStyle = brass;
    g.lineWidth = 0.6;
    for (var a = 0; a < 360; a += 8) {
      var rad = a * Math.PI / 180;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(rad) * w * 0.38, cy + Math.sin(rad) * h * 0.32);
      g.stroke();
    }
    g.restore();

    // ── Suit insignia (large embossed emblem) ──
    g.save();
    var suitSize = Math.round(w * 0.28);
    g.font = suitSize + 'px ' + EMOJI_FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    // Dark undercut shadow
    g.fillStyle = 'rgba(0,0,0,0.65)';
    g.fillText(m.suit, cx + 2, cy + 3);
    // Main brass body
    g.fillStyle = brassLight;
    g.shadowColor = 'rgba(212,168,67,0.45)';
    g.shadowBlur = 18;
    g.fillText(m.suit, cx, cy);
    // Specular highlight pass
    g.shadowColor = 'transparent';
    g.shadowBlur = 0;
    g.globalAlpha = 0.30;
    g.fillStyle = '#ffffff';
    g.fillText(m.suit, cx - 1, cy - 2);
    g.restore();

    // ── Classified stamp ──
    g.save();
    g.font = Math.round(w * 0.034) + 'px ' + MONO_FONT;
    g.textAlign = 'center';
    g.fillStyle = 'rgba(220,80,80,0.55)';
    g.fillText(m.classified || 'EYES ONLY', cx, h * 0.10);
    g.restore();

    // ── Label ──
    g.save();
    g.font = Math.round(w * 0.026) + 'px ' + MONO_FONT;
    g.textAlign = 'center';
    g.fillStyle = 'rgba(180,150,60,0.40)';
    g.fillText(m.label || 'MISSION DOSSIER', cx, h * 0.14);
    g.restore();

    // ── Title (raised brass) ──
    g.save();
    g.font = 'bold ' + Math.round(w * 0.048) + 'px ' + MONO_FONT;
    g.textAlign = 'center';
    g.fillStyle = brass;
    g.shadowColor = 'rgba(0,0,0,0.7)';
    g.shadowBlur = 4;
    g.shadowOffsetY = 2;
    g.fillText(m.title.toUpperCase(), cx, h * 0.73);
    g.restore();

    // ── Description ──
    g.save();
    g.font = Math.round(w * 0.028) + 'px ' + MONO_FONT;
    g.textAlign = 'center';
    g.fillStyle = 'rgba(180,150,60,0.50)';
    g.fillText(m.desc || '', cx, h * 0.79);
    g.restore();

    // ── Corner suit marks ──
    g.save();
    g.font = Math.round(w * 0.055) + 'px ' + EMOJI_FONT;
    g.fillStyle = brassDark;
    g.globalAlpha = 0.55;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(m.suit, w * 0.12, h * 0.075);
    g.save();
    g.translate(w * 0.88, h * 0.925);
    g.rotate(Math.PI);
    g.fillText(m.suit, 0, 0);
    g.restore();
    g.restore();

    return c;
  }

  /* ============================================================
     HEIGHT MAP — White=raised brass, Black=deep starfield
     Shadow blur creates smooth transition zones (satin metal)
     ============================================================ */
  function genHeightMap(m) {
    var w = CFG.texW, h = CFG.texH;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');

    // Deep base (black = starfield zone)
    g.fillStyle = '#000000';
    g.fillRect(0, 0, w, h);

    var cx = w / 2, cy = h * 0.44;

    // ── Outer border rim (fully raised) ──
    g.save();
    g.strokeStyle = '#ffffff';
    g.shadowColor = '#ffffff';
    g.shadowBlur = 12;
    g.lineWidth = 10;
    rrPath(g, 18, 18, w - 36, h - 36, 14);
    g.stroke();
    g.lineWidth = 4;
    rrPath(g, 32, 32, w - 64, h - 64, 10);
    g.stroke();
    g.restore();

    // ── Decorative chain border ──
    g.save();
    g.strokeStyle = '#606060';
    g.lineWidth = 2;
    g.setLineDash([4, 4]);
    rrPath(g, 42, 42, w - 84, h - 84, 8);
    g.stroke();
    g.setLineDash([]);
    g.restore();

    // ── Concentric rings (partially raised) ──
    g.save();
    for (var ring = 1; ring <= 10; ring++) {
      var rr = ring * w * 0.040;
      var bright = ring % 3 === 0 ? '#707070' : '#404040';
      g.strokeStyle = bright;
      g.shadowColor = bright;
      g.shadowBlur = 3;
      g.lineWidth = ring % 3 === 0 ? 2.5 : 1.2;
      g.beginPath();
      g.arc(cx, cy, rr, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();

    // ── Suit symbol (highest point — full white + large glow) ──
    g.save();
    g.font = Math.round(w * 0.28) + 'px ' + EMOJI_FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#ffffff';
    g.shadowColor = '#ffffff';
    g.shadowBlur = 20;
    g.fillText(m.suit, cx, cy);
    g.fillText(m.suit, cx, cy); // double pass for stronger glow
    g.restore();

    // ── Title (raised) ──
    g.save();
    g.font = 'bold ' + Math.round(w * 0.048) + 'px ' + MONO_FONT;
    g.textAlign = 'center';
    g.fillStyle = '#ffffff';
    g.shadowColor = '#ffffff';
    g.shadowBlur = 10;
    g.fillText(m.title.toUpperCase(), cx, h * 0.73);
    g.restore();

    // ── Classified stamp (mid-raised) ──
    g.save();
    g.font = Math.round(w * 0.034) + 'px ' + MONO_FONT;
    g.textAlign = 'center';
    g.fillStyle = '#a0a0a0';
    g.shadowColor = '#a0a0a0';
    g.shadowBlur = 6;
    g.fillText(m.classified || 'EYES ONLY', cx, h * 0.10);
    g.restore();

    // ── Label ──
    g.save();
    g.font = Math.round(w * 0.026) + 'px ' + MONO_FONT;
    g.textAlign = 'center';
    g.fillStyle = '#808080';
    g.shadowColor = '#808080';
    g.shadowBlur = 4;
    g.fillText(m.label || 'MISSION DOSSIER', cx, h * 0.14);
    g.restore();

    // ── Description (slightly raised) ──
    g.save();
    g.font = Math.round(w * 0.028) + 'px ' + MONO_FONT;
    g.textAlign = 'center';
    g.fillStyle = '#707070';
    g.shadowColor = '#707070';
    g.shadowBlur = 4;
    g.fillText(m.desc || '', cx, h * 0.79);
    g.restore();

    // ── Corner marks (raised) ──
    g.save();
    g.font = Math.round(w * 0.055) + 'px ' + EMOJI_FONT;
    g.fillStyle = '#c0c0c0';
    g.shadowColor = '#c0c0c0';
    g.shadowBlur = 8;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(m.suit, w * 0.12, h * 0.075);
    g.save();
    g.translate(w * 0.88, h * 0.925);
    g.rotate(Math.PI);
    g.fillText(m.suit, 0, 0);
    g.restore();
    g.restore();

    return c;
  }

  /* ============================================================
     BUMP MAP — Relief detail (same layout, grayscale height info)
     ============================================================ */
  function genBumpTex(m) {
    var w = CFG.texW, h = CFG.texH;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');

    g.fillStyle = '#808080';
    g.fillRect(0, 0, w, h);

    var cx = w / 2, cy = h * 0.44;

    // Raised concentric rings
    for (var ring = 1; ring <= 10; ring++) {
      var rr = ring * w * 0.040;
      g.strokeStyle = ring % 3 === 0 ? '#a0a0a0' : '#909090';
      g.lineWidth   = ring % 3 === 0 ? 2.5 : 1.5;
      g.beginPath();
      g.arc(cx, cy, rr, 0, Math.PI * 2);
      g.stroke();
    }

    // Raised suit symbol
    g.font = Math.round(w * 0.28) + 'px ' + EMOJI_FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#c8c8c8';
    g.fillText(m.suit, cx, cy);

    // Raised borders
    g.strokeStyle = '#a8a8a8';
    g.lineWidth = 3;
    rrPath(g, 18, 18, w - 36, h - 36, 14);
    g.stroke();
    g.lineWidth = 2;
    rrPath(g, 32, 32, w - 64, h - 64, 10);
    g.stroke();

    // Raised title
    g.font = 'bold ' + Math.round(w * 0.048) + 'px ' + MONO_FONT;
    g.fillStyle = '#a8a8a8';
    g.textAlign = 'center';
    g.fillText(m.title.toUpperCase(), cx, h * 0.73);

    // Corner marks
    g.font = Math.round(w * 0.055) + 'px ' + EMOJI_FONT;
    g.fillStyle = '#999999';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(m.suit, w * 0.12, h * 0.075);
    g.save();
    g.translate(w * 0.88, h * 0.925);
    g.rotate(Math.PI);
    g.fillText(m.suit, 0, 0);
    g.restore();

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

    // Border
    g.strokeStyle = 'rgba(180,150,60,0.12)';
    g.lineWidth = 3;
    rrPath(g, 20, 20, w - 40, h - 40, 12);
    g.stroke();

    return c;
  }

  /* ============================================================
     GLSL SHADER INJECTION — Starfield in deep relief areas
     ============================================================ */

  // Fragment shader: uniform & function declarations
  var SHADER_PARS = [
    'uniform sampler2D heightMap;',
    'uniform float uTime;',
    'uniform float coinRotX;',
    'uniform float coinRotY;',
    'float _deepMask = 0.0;',
    '',
    '// Procedural parallax starfield with nebula',
    'vec3 _cosmicField(vec2 uv) {',
    '  vec3 col = vec3(0.005, 0.003, 0.018);',  // deep space base
    '',
    '  // Nebula clouds (slow drift)',
    '  float n1 = sin(uv.x * 5.0 + uTime * 0.04) * cos(uv.y * 6.0 - uTime * 0.03);',
    '  float n2 = cos(uv.x * 8.0 - uTime * 0.02) * sin(uv.y * 4.0 + uTime * 0.035);',
    '  float n3 = sin(uv.x * 3.0 + uv.y * 5.0 + uTime * 0.025);',
    '  col += vec3(0.10, 0.02, 0.16) * (n1 * 0.5 + 0.5) * 0.32;',   // purple
    '  col += vec3(0.02, 0.06, 0.18) * (n2 * 0.5 + 0.5) * 0.25;',   // blue
    '  col += vec3(0.12, 0.04, 0.02) * (n3 * 0.5 + 0.5) * 0.15;',   // warm accent
    '',
    '  // Star layers with parallax depth',
    '  for (int layer = 0; layer < 4; layer++) {',
    '    float lf = float(layer);',
    '    float sc = 32.0 + lf * 24.0;',
    '    float px = 0.018 + lf * 0.014;',
    '    vec2 off = vec2(coinRotY, -coinRotX) * px;',
    '    vec2 st = (uv + off) * sc;',
    '    vec2 gc = floor(st);',
    '',
    '    // Star presence (hash)',
    '    float h1 = fract(sin(dot(gc, vec2(127.1, 311.7))) * 43758.5453);',
    '    float isStar = step(0.962 - lf * 0.005, h1);',
    '',
    '    // Star properties',
    '    float h2 = fract(sin(dot(gc, vec2(269.5, 183.3))) * 43758.5453);',
    '    float twinkle = 0.55 + 0.45 * sin(uTime * (0.6 + h2 * 3.0) + h2 * 6.283);',
    '',
    '    // Slight color variation (cool blue ↔ warm white)',
    '    vec3 tint = mix(vec3(0.65, 0.75, 1.0), vec3(1.0, 0.93, 0.78), h2);',
    '',
    '    // Brighter in deeper layers, faded in near layers (depth illusion)',
    '    float bright = isStar * h2 * twinkle * (0.22 + lf * 0.20);',
    '    col += tint * bright;',
    '  }',
    '',
    '  // Subtle dust lane (dark streak)',
    '  float dust = smoothstep(0.48, 0.52, sin(uv.x * 2.5 + uv.y * 1.8 + 0.5));',
    '  col *= mix(0.7, 1.0, dust);',
    '',
    '  return col;',
    '}',
  ].join('\n');

  // Inject after diffuse map sampling: compute height mask, darken deep areas
  var SHADER_HEIGHT = [
    '{',
    '  float _coinH = texture2D(heightMap, vUv).r;',
    '  float _capF = step(0.3, abs(vNormal.z));',
    '  _deepMask = smoothstep(0.40, 0.06, _coinH) * _capF;',
    '  diffuseColor.rgb *= (1.0 - _deepMask * 0.96);',
    '}',
  ].join('\n');

  // Inject after emissivemap_fragment: add starfield as emission (goes through tone mapping)
  var SHADER_EMIT = [
    '{',
    '  vec3 _stars = _cosmicField(vUv);',
    '  totalEmissiveRadiance += _stars * _deepMask * 1.4;',
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

    // ── Shader injection: procedural starfield in deep relief areas ──
    face.onBeforeCompile = function (shader) {
      // Add custom uniforms
      shader.uniforms.heightMap = { value: heightT };
      shader.uniforms.uTime    = { value: 0.0 };
      shader.uniforms.coinRotX = { value: 0.0 };
      shader.uniforms.coinRotY = { value: 0.0 };

      // 1. Inject declarations + starfield function (before map_pars)
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_pars_fragment>',
        SHADER_PARS + '\n#include <map_pars_fragment>'
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
     MOUNT
     ============================================================ */
  function mount(fanEl, missions) {
    if (_ready || _disposed) return;

    // Desktop only
    if (!window.matchMedia('(hover: hover)').matches) {
      console.log('[Card3D] Touch-only device — using CSS cards');
      return;
    }

    _loadThree(function () {
      try {
        _offCanvas = document.createElement('canvas');
        _offCanvas.width  = CFG.texW;
        _offCanvas.height = CFG.texH;

        _renderer = new T.WebGLRenderer({
          canvas:          _offCanvas,
          alpha:           true,
          antialias:       true,
          powerPreference: 'low-power',
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
          dc.style.cssText = 'width:100%;height:100%;display:block;';
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

        _t0 = performance.now();
        _ready = true;

        setTimeout(function () {
          _coins.forEach(function (c) { c.wrapper.classList.add('coin-3d-active'); });
          fanEl.classList.add('coin-3d-mode');
        }, 100);

        _animId = requestAnimationFrame(_loop);
        console.log('[Card3D] Mounted — ' + _coins.length + ' coins (v2: starfield shader)');
      } catch (err) {
        console.warn('[Card3D] Mount failed:', err);
        _ready = false;
      }
    });
  }

  /* ============================================================
     RENDER LOOP
     ============================================================ */
  function _loop() {
    if (_disposed) return;

    var now = performance.now();
    var t   = (now - _t0) / 1000;

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

    _animId = requestAnimationFrame(_loop);
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
     THREE.JS LAZY LOADER
     ============================================================ */
  function _loadThree(cb) {
    if (window.THREE) { T = window.THREE; cb(); return; }
    var s = document.createElement('script');
    s.src = 'js/vendor/three.min.js';
    s.onload  = function () { T = window.THREE; cb(); };
    s.onerror = function () {
      console.warn('[Card3D] Three.js load failed — CSS cards remain');
    };
    document.head.appendChild(s);
  }

})();
