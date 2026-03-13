/**
 * card-coin-3d.js — Military Challenge Coin 3D Renderer
 *
 * Renders card-shaped commemorative military coins using Three.js.
 * One offscreen WebGL context, per-card 2D display canvases.
 * Aesthetic: brushed brass/bronze, embossed relief, surveillance-terminal lighting.
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
    depth:  0.16,
    radius: 0.14,
    bevel:  0.04,
    bevelSegs: 3,
    curveSegs: 12,

    // Texture resolution
    texW: 512,
    get texH() { return Math.round(this.texW * this.height / this.width); },

    // Material
    metalness: 0.88,
    roughness: 0.42,
    bumpScale: 0.025,
    envIntensity: 0.7,

    // Hex colors
    baseBrass:  0xb8922e,
    edgeBrass:  0xc9a84c,
    backBronze: 0x8b7530,

    // Animation
    idleSpeed: 0.35,
    idleAmp:   0.055,
    hoverTilt: 0.12,
    flipMs:    800,

    // Camera
    camFov: 35,
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
  var _coins  = [];      // per-card: { mesh, dCtx, dCanvas, wrapper, hovered, selecting, … }
  var _offCanvas;
  var _animId = null;
  var _ready  = false;
  var _t0     = 0;
  var _disposed = false;

  /* ============================================================
     PUBLIC API  (consumed by Card3D hooks in splash-screen.js)
     ============================================================ */
  window.CardCoin3D = {
    mount:      mount,
    setHover:   setHover,
    selectCard: selectCard,
    dispose:    dispose,
    get ready() { return _ready; },
  };

  /* ============================================================
     GEOMETRY — Rounded-rectangle extrusion with bevel
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
    return geo;
  }

  /* ============================================================
     CANVAS TEXTURE HELPERS
     ============================================================ */
  var SUIT_PAL = {
    'scenario-1': { fill: '#c8a040', glow: 'rgba(200,160,64,0.3)'  },
    'scenario-2': { fill: '#a0a0a0', glow: 'rgba(160,160,160,0.25)'},
    'partner':    { fill: '#7a3030', glow: 'rgba(140,50,50,0.25)'  },
    'minigames':  { fill: '#3a6898', glow: 'rgba(58,104,152,0.25)' },
  };

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

  /* ---- Front face diffuse texture ---- */
  function genFaceTex(m) {
    var w = CFG.texW, h = CFG.texH;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');

    // Dark bronze gradient background
    var bg = g.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0,   '#1c1c18');
    bg.addColorStop(0.3, '#222220');
    bg.addColorStop(0.7, '#1a1a16');
    bg.addColorStop(1,   '#141412');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);

    var cx = w / 2, cy = h * 0.44;

    // Concentric engraved rings
    for (var ring = 1; ring <= 12; ring++) {
      var rr = ring * w * 0.038;
      g.strokeStyle = 'rgba(160,130,40,' + Math.max(0.02, 0.12 - ring * 0.008) + ')';
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(cx, cy, rr, 0, Math.PI * 2);
      g.stroke();
    }

    // Radial hatching
    g.save();
    g.globalAlpha = 0.04;
    g.strokeStyle = '#b4a040';
    g.lineWidth = 0.5;
    for (var a = 0; a < 360; a += 8) {
      var rad = a * Math.PI / 180;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(rad) * w * 0.44, cy + Math.sin(rad) * h * 0.38);
      g.stroke();
    }
    g.restore();

    // Inner border engravings (double line)
    g.save();
    g.strokeStyle = 'rgba(160,130,40,0.10)';
    g.lineWidth = 1.5;
    rrPath(g, 18, 18, w - 36, h - 36, 8);
    g.stroke();
    g.strokeStyle = 'rgba(160,130,40,0.06)';
    rrPath(g, 24, 24, w - 48, h - 48, 6);
    g.stroke();
    g.restore();

    // Suit insignia (embossed look via shadow + highlight layers)
    var sc = SUIT_PAL[m.id] || SUIT_PAL['scenario-1'];
    g.save();
    g.font = Math.round(w * 0.30) + 'px serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    // Dark undercut
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillText(m.suit, cx + 1, cy + 2);
    // Main fill
    g.fillStyle = sc.fill;
    g.shadowColor = sc.glow;
    g.shadowBlur = 8;
    g.fillText(m.suit, cx, cy);
    // Highlight pass
    g.shadowColor = 'transparent';
    g.globalAlpha = 0.15;
    g.fillStyle = '#fff';
    g.fillText(m.suit, cx, cy - 1);
    g.restore();

    // Classified stamp
    g.save();
    g.font = Math.round(w * 0.036) + 'px "Courier New",monospace';
    g.textAlign = 'center';
    g.fillStyle = 'rgba(180,60,60,0.45)';
    g.fillText(m.classified || 'EYES ONLY', cx, h * 0.095);
    g.restore();

    // Label
    g.save();
    g.font = Math.round(w * 0.028) + 'px "Courier New",monospace';
    g.textAlign = 'center';
    g.fillStyle = 'rgba(180,150,60,0.35)';
    g.fillText(m.label || 'MISSION DOSSIER', cx, h * 0.13);
    g.restore();

    // Title
    g.save();
    g.font = 'bold ' + Math.round(w * 0.052) + 'px "Courier New",monospace';
    g.textAlign = 'center';
    g.fillStyle = '#d8c890';
    g.shadowColor = 'rgba(0,0,0,0.6)';
    g.shadowBlur = 3;
    g.shadowOffsetY = 1;
    g.fillText(m.title.toUpperCase(), cx, h * 0.74);
    g.restore();

    // Description
    g.save();
    g.font = Math.round(w * 0.030) + 'px "Courier New",monospace';
    g.textAlign = 'center';
    g.fillStyle = 'rgba(180,150,60,0.40)';
    g.fillText(m.desc || '', cx, h * 0.80);
    g.restore();

    // Corner suit marks (smaller, muted)
    g.save();
    g.font = Math.round(w * 0.06) + 'px serif';
    g.fillStyle = sc.fill;
    g.globalAlpha = 0.45;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(m.suit, w * 0.09, h * 0.055);
    g.save();
    g.translate(w * 0.91, h * 0.945);
    g.rotate(Math.PI);
    g.fillText(m.suit, 0, 0);
    g.restore();
    g.restore();

    return c;
  }

  /* ---- Bump map for embossed relief ---- */
  function genBumpTex(m) {
    var w = CFG.texW, h = CFG.texH;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');

    g.fillStyle = '#808080';
    g.fillRect(0, 0, w, h);

    var cx = w / 2, cy = h * 0.44;

    // Raised concentric rings
    for (var ring = 1; ring <= 12; ring++) {
      var rr = ring * w * 0.038;
      g.strokeStyle = ring % 3 === 0 ? '#999' : '#8c8c8c';
      g.lineWidth   = ring % 3 === 0 ? 2.5  : 1.5;
      g.beginPath();
      g.arc(cx, cy, rr, 0, Math.PI * 2);
      g.stroke();
    }

    // Raised suit symbol
    g.font = Math.round(w * 0.30) + 'px serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#c0c0c0';
    g.fillText(m.suit, cx, cy);

    // Raised border
    g.strokeStyle = '#a0a0a0';
    g.lineWidth = 2.5;
    rrPath(g, 18, 18, w - 36, h - 36, 8);
    g.stroke();
    g.lineWidth = 1.5;
    rrPath(g, 24, 24, w - 48, h - 48, 6);
    g.stroke();

    // Raised title
    g.font = 'bold ' + Math.round(w * 0.052) + 'px "Courier New",monospace';
    g.fillStyle = '#a0a0a0';
    g.textAlign = 'center';
    g.fillText(m.title.toUpperCase(), cx, h * 0.74);

    // Corner marks
    g.font = Math.round(w * 0.06) + 'px serif';
    g.fillStyle = '#959595';
    g.fillText(m.suit, w * 0.09, h * 0.055);
    g.save();
    g.translate(w * 0.91, h * 0.945);
    g.rotate(Math.PI);
    g.fillText(m.suit, 0, 0);
    g.restore();

    return c;
  }

  /* ---- Back face texture ---- */
  function genBackTex(m) {
    var w = CFG.texW, h = CFG.texH;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');

    var bg = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6);
    bg.addColorStop(0, '#1e1c16');
    bg.addColorStop(1, '#0e0d0a');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);

    var cx = w / 2, cy = h / 2;
    for (var ring = 1; ring <= 6; ring++) {
      g.strokeStyle = 'rgba(140,110,30,' + (0.08 - ring * 0.01) + ')';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(cx, cy, ring * w * 0.07, 0, Math.PI * 2);
      g.stroke();
    }

    g.save();
    g.font = 'bold ' + Math.round(w * 0.068) + 'px "Courier New",monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(140,110,30,0.18)';
    g.fillText('EYES', cx, cy - h * 0.03);
    g.fillText('ONLY', cx, cy + h * 0.05);
    g.restore();

    g.strokeStyle = 'rgba(140,110,30,0.08)';
    g.lineWidth = 2;
    rrPath(g, 20, 20, w - 40, h - 40, 8);
    g.stroke();

    return c;
  }

  /* ============================================================
     ENVIRONMENT MAP — Surveillance-terminal reflections
     ============================================================ */
  function createEnvMap() {
    var pmrem = new T.PMREMGenerator(_renderer);
    pmrem.compileCubemapShader();

    var es = new T.Scene();
    es.background = new T.Color(0x0a1410);

    var l1 = new T.PointLight(0xd4c8a0, 0.4, 12);
    l1.position.set(0, 4, 2);
    es.add(l1);

    var l2 = new T.PointLight(0x1a3a2a, 0.3, 8);
    l2.position.set(0, -3, 3);
    es.add(l2);

    var l3 = new T.PointLight(0x8b7530, 0.2, 10);
    l3.position.set(-4, 2, 1);
    es.add(l3);

    var rt = pmrem.fromScene(es, 0);
    pmrem.dispose();
    return rt.texture;
  }

  /* ============================================================
     MATERIALS — Per-card face, shared edge, per-card back
     ============================================================ */
  function buildMats(mission) {
    var faceC = genFaceTex(mission);
    var faceT = new T.CanvasTexture(faceC);
    if (T.sRGBEncoding) faceT.encoding = T.sRGBEncoding;

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
      color:           new T.Color(CFG.baseBrass),
    });

    var backC = genBackTex(mission);
    var backT = new T.CanvasTexture(backC);
    if (T.sRGBEncoding) backT.encoding = T.sRGBEncoding;

    var back = new T.MeshStandardMaterial({
      map:             backT,
      metalness:       0.82,
      roughness:       0.50,
      envMap:          _envMap,
      envMapIntensity: 0.5,
      color:           new T.Color(CFG.backBronze),
    });

    // ExtrudeGeometry groups: index 0 = front cap + side walls, index 1 = back cap
    return [face, back];
  }

  /* ============================================================
     SCENE + CAMERA + LIGHTS
     ============================================================ */
  function setupScene() {
    _scene = new T.Scene();

    // Warm directional key (desk lamp from upper-left)
    var key = new T.DirectionalLight(0xd4c8a0, 0.7);
    key.position.set(-2, 3, 4);
    _scene.add(key);

    // Cool ambient fill (fluorescent spill)
    _scene.add(new T.AmbientLight(0x2a3a30, 0.4));

    // Subtle warm rim from below-right
    var rim = new T.PointLight(0x8b7530, 0.3, 10);
    rim.position.set(2, -2, 3);
    _scene.add(rim);

    // Hemisphere: dark green sky / dark ground
    _scene.add(new T.HemisphereLight(0x1a2a1a, 0x0a0a08, 0.3));
  }

  function setupCamera() {
    _camera = new T.PerspectiveCamera(
      CFG.camFov,
      CFG.width / CFG.height,
      0.1,
      20
    );
    _camera.position.set(0, 0, CFG.camDist);
    _camera.lookAt(0, 0, 0);
  }

  /* ============================================================
     MOUNT — Load Three.js, build meshes, start render loop
     ============================================================ */
  function mount(fanEl, missions) {
    if (_ready || _disposed) return;

    // Desktop only — skip on touch-only devices
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
        _renderer.toneMappingExposure = 0.9;

        _envMap = createEnvMap();
        setupScene();
        setupCamera();
        _sharedGeo = buildGeo();

        // Per-card setup
        var cards = fanEl.querySelectorAll('.coin-card');
        missions.forEach(function (m, i) {
          if (i >= cards.length) return;
          var card = cards[i];

          // Display canvas inside card
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

        // Fade in 3D canvases, enable 3D mode on fan
        setTimeout(function () {
          _coins.forEach(function (c) { c.wrapper.classList.add('coin-3d-active'); });
          fanEl.classList.add('coin-3d-mode');
        }, 100);

        _animId = requestAnimationFrame(_loop);
        console.log('[Card3D] Mounted — ' + _coins.length + ' coins');
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

      // ---- Idle wobble (micro-sway, surveillance camera tremor) ----
      var p  = t * CFG.idleSpeed + cn.phase;
      var ix = Math.sin(p * 1.1) * CFG.idleAmp;
      var iy = Math.cos(p * 0.7) * CFG.idleAmp * 0.6;

      // ---- Target tilt ----
      var tx = ix + (cn.hovered ? CFG.hoverTilt * 0.3 : 0);
      var ty = iy + (cn.hovered ? -CFG.hoverTilt * 0.5 : 0);

      // ---- Select flip ----
      if (cn.selecting) {
        var sp = Math.min(1, (now - cn.selT0) / CFG.flipMs);
        // ease in-out quad
        var ease = sp < 0.5
          ? 2 * sp * sp
          : 1 - Math.pow(-2 * sp + 2, 2) / 2;
        ty = ease * Math.PI;
        tx = 0;
        if (sp >= 1) cn.selecting = false;
      }

      // ---- Smooth interpolation ----
      cn.tiltX += (tx - cn.tiltX) * 0.12;
      cn.tiltY += (ty - cn.tiltY) * 0.12;

      cn.mesh.rotation.x = cn.tiltX;
      cn.mesh.rotation.y = cn.tiltY;

      // ---- Render this coin ----
      for (var j = 0; j < _coins.length; j++) _coins[j].mesh.visible = (j === i);
      _renderer.render(_scene, _camera);

      // ---- Copy to card display canvas ----
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
    // Hosted locally to comply with CSP (no external CDN scripts allowed)
    s.src = 'js/vendor/three.min.js';
    s.onload  = function () { T = window.THREE; cb(); };
    s.onerror = function () {
      console.warn('[Card3D] Three.js load failed — CSS cards remain');
    };
    document.head.appendChild(s);
  }

})();
