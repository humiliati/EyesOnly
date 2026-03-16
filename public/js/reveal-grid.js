/* ============================================================
   REVEAL GRID — Modular Hidden-Content Discovery System
   ============================================================
   Manages reveal zones: named regions in screen space where
   hidden content lives between the starfield layer and the
   visible page. Porthole lenses (coin-cards, magnifying glass)
   expose these zones when held over them.

   Designer-facing: zones are declared via JSON (inline or file),
   not hardcoded collision logic. Adding a new hidden QR code,
   video, or item is just adding an object to the zones array.

   Usage:
     <script src="/js/reveal-grid.js"></script>
     <script>
       RevealGrid.init({
         zones: [ ... ],              // zone definitions
         // OR
         zonesUrl: '/data/reveal-zones-games.json',
         onDeposit: function(zone) { ... },  // callback when item deposited
       });
     </script>

   Lifecycle:
     1. Lens starts dragging → RevealGrid.beginLensSession(lensRect)
     2. Each frame → RevealGrid.updateLens(lensRect)
        - Detects overlap with zones
        - Slides content into view from approach direction
        - Checks lock threshold
     3. Lens released → RevealGrid.endLensSession()
        - Locked zones: execute onRelease action
        - Unlocked zones: slide content back out
   ============================================================ */

var RevealGrid = (function () {
  'use strict';

  // ── State ────────────────────────────────────────────────
  var _zones = [];            // zone definitions (from JSON)
  var _zoneEls = {};          // zone ID → DOM element on the grid layer
  var _gridLayer = null;      // .reveal-grid-layer container
  var _active = {};           // zone ID → { overlap, locked, direction, revealed }
  var _lensActive = false;
  var _lastLensRect = null;
  var _opts = {};
  var _initialized = false;

  // Persistence
  var PERSIST_KEY = 'eyesonly_revealed_items';

  function _getRevealed() {
    try {
      var raw = localStorage.getItem(PERSIST_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function _saveRevealed(revealed) {
    try { localStorage.setItem(PERSIST_KEY, JSON.stringify(revealed)); }
    catch (e) {}
  }

  // ── Grid Layer ───────────────────────────────────────────

  function _createGridLayer() {
    if (_gridLayer) return;
    _gridLayer = document.createElement('div');
    _gridLayer.className = 'reveal-grid-layer';
    // Sits between starfield (z:-1/opacity:0) and page content
    // Fixed full-viewport, pointer-events: none (lens handles interaction)
    _gridLayer.style.cssText = [
      'position: fixed',
      'inset: 0',
      'z-index: 50',         // above #crt-frame (z:15), below CRT overlays (z:80+)
      'pointer-events: none',
      'overflow: hidden',
    ].join('; ');
    document.body.appendChild(_gridLayer);
  }

  // ── QR Canvas Renderer ──────────────────────────────────
  // Minimal QR-like pattern renderer. Generates a deterministic
  // grid pattern from the data string (not a real QR encoder,
  // but visually convincing for the spy-game aesthetic).
  // For scan-able QR codes, load a proper library and call
  // _renderRealQR instead.

  function _renderQR(canvas, data, fgColor, bgColor) {
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;

    // Fill background
    ctx.fillStyle = bgColor || 'transparent';
    if (bgColor && bgColor !== 'transparent') {
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.clearRect(0, 0, w, h);
    }

    // Generate deterministic bit pattern from data string
    var gridSize = 21; // QR version 1 is 21x21
    var cellW = w / gridSize;
    var cellH = h / gridSize;
    var bits = [];

    // Simple hash-based bit generation
    var hash = 0;
    for (var i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
    }

    for (var row = 0; row < gridSize; row++) {
      bits[row] = [];
      for (var col = 0; col < gridSize; col++) {
        // Finder patterns (3 corners)
        var inFinderTL = row < 7 && col < 7;
        var inFinderTR = row < 7 && col >= gridSize - 7;
        var inFinderBL = row >= gridSize - 7 && col < 7;

        if (inFinderTL || inFinderTR || inFinderBL) {
          var lr = inFinderTL ? row : (inFinderTR ? row : row - (gridSize - 7));
          var lc = inFinderTL ? col : (inFinderTR ? col - (gridSize - 7) : col);
          // Finder pattern: solid border, empty inside, solid center
          if (lr === 0 || lr === 6 || lc === 0 || lc === 6) {
            bits[row][col] = 1;
          } else if (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4) {
            bits[row][col] = 1;
          } else {
            bits[row][col] = 0;
          }
        } else {
          // Data area: deterministic pseudo-random from hash + position
          var seed = (hash ^ (row * 31 + col * 17)) >>> 0;
          seed = ((seed * 1103515245 + 12345) >>> 16) & 0x7fff;
          bits[row][col] = (seed % 3 === 0) ? 1 : 0;
        }
      }
    }

    // Render
    ctx.fillStyle = fgColor || '#33ff33';
    for (var r = 0; r < gridSize; r++) {
      for (var c = 0; c < gridSize; c++) {
        if (bits[r][c]) {
          ctx.fillRect(
            Math.floor(c * cellW),
            Math.floor(r * cellH),
            Math.ceil(cellW),
            Math.ceil(cellH)
          );
        }
      }
    }
  }

  // ── Zone Rendering ───────────────────────────────────────

  function _resolveAnchor(zone) {
    // Returns { x, y } in viewport coordinates for the zone's position
    var anchor = zone.anchor || {};
    var offset = anchor.offset || [0, 0];

    if (anchor.selector) {
      var el = document.querySelector(anchor.selector);
      if (el) {
        var rect = el.getBoundingClientRect();
        return {
          x: rect.left + offset[0],
          y: rect.top + offset[1],
          anchorEl: el,
        };
      }
    }

    // Fallback: absolute position
    if (typeof anchor.x === 'number') {
      return { x: anchor.x + offset[0], y: anchor.y + offset[1], anchorEl: null };
    }

    return { x: offset[0], y: offset[1], anchorEl: null };
  }

  function _createZoneEl(zone) {
    var el = document.createElement('div');
    el.className = 'reveal-zone';
    el.dataset.zoneId = zone.id;
    el.dataset.zoneType = zone.type || 'item';
    el.dataset.zoneTier = zone.tier || 'SURFACE';
    if (zone.palette) el.dataset.zonePalette = zone.palette;

    var size = zone.size || [120, 120];
    el.style.width = size[0] + 'px';
    el.style.height = size[1] + 'px';
    el.style.position = 'absolute';

    // Content container (what gets revealed)
    var content = document.createElement('div');
    content.className = 'reveal-zone-content';

    var type = zone.type || 'item';
    var c = zone.content || {};

    if (type === 'item') {
      content.innerHTML =
        '<span class="reveal-zone-emoji">' + (c.emoji || '❓') + '</span>' +
        (c.label ? '<span class="reveal-zone-label">' + c.label + '</span>' : '');
    } else if (type === 'qr') {
      // QR rendered as a placeholder — real QR canvas added on first reveal
      content.innerHTML = '<canvas class="reveal-zone-qr" width="' + size[0] + '" height="' + size[1] + '"></canvas>';
      // We'll render the QR pattern when the zone first becomes visible
      content.dataset.qrData = c.qrData || '';
      content.dataset.qrFg = c.fgColor || '#33ff33';
      content.dataset.qrBg = c.bgColor || 'transparent';
    } else if (type === 'video') {
      var video = document.createElement('video');
      video.className = 'reveal-zone-video';
      video.src = c.src || '';
      video.muted = true; // autoplay requires muted
      video.playsInline = true;
      video.loop = c.loop !== false;
      video.preload = 'metadata';
      video.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:4px;';
      content.appendChild(video);
    } else if (type === 'image') {
      var img = document.createElement('img');
      img.className = 'reveal-zone-image';
      img.src = c.src || '';
      img.alt = c.alt || '';
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
      content.appendChild(img);
    } else if (type === 'text') {
      content.innerHTML = '<div class="reveal-zone-text">' + (c.html || c.text || '') + '</div>';
    }

    el.appendChild(content);
    return el;
  }

  function _positionZone(zone, el) {
    var pos = _resolveAnchor(zone);
    el.style.left = pos.x + 'px';
    el.style.top = pos.y + 'px';
  }

  function _renderZones() {
    if (!_gridLayer) return;
    _gridLayer.innerHTML = '';
    _zoneEls = {};

    var revealed = _getRevealed();

    _zones.forEach(function (zone) {
      // Skip one-shot zones that are already revealed
      if (zone.oneShot && revealed[zone.id]) return;

      var el = _createZoneEl(zone);
      _positionZone(zone, el);
      _gridLayer.appendChild(el);
      _zoneEls[zone.id] = el;

      // Initialize active state
      _active[zone.id] = {
        overlap: 0,       // 0–1 fraction of zone visible through lens
        locked: false,
        direction: null,   // approach direction: 'left','right','top','bottom'
        revealed: false,
        slideProgress: 0,  // 0 = hidden, 1 = fully visible
      };
    });
  }

  // ── Overlap Detection ────────────────────────────────────

  function _rectOverlap(a, b) {
    // Returns overlap area as fraction of b's total area
    var ox = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    var oy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    var overlapArea = ox * oy;
    var zoneArea = (b.right - b.left) * (b.bottom - b.top);
    return zoneArea > 0 ? overlapArea / zoneArea : 0;
  }

  function _approachDirection(lensRect, zoneRect) {
    // Determine which edge the lens is approaching from
    var lcx = (lensRect.left + lensRect.right) / 2;
    var lcy = (lensRect.top + lensRect.bottom) / 2;
    var zcx = (zoneRect.left + zoneRect.right) / 2;
    var zcy = (zoneRect.top + zoneRect.bottom) / 2;
    var dx = lcx - zcx;
    var dy = lcy - zcy;
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    } else {
      return dy > 0 ? 'bottom' : 'top';
    }
  }

  function _slideTranslate(direction, progress) {
    // Returns CSS translate for slide-in effect
    // progress: 0 = fully hidden (off-screen), 1 = in place
    var offset = Math.round((1 - progress) * 40); // 40px travel
    switch (direction) {
      case 'left':   return 'translate(' + (-offset) + 'px, 0)';
      case 'right':  return 'translate(' + offset + 'px, 0)';
      case 'top':    return 'translate(0, ' + (-offset) + 'px)';
      case 'bottom': return 'translate(0, ' + offset + 'px)';
      default:       return 'translate(0, 0)';
    }
  }

  // ── Lens Session ─────────────────────────────────────────

  function beginLensSession(lensRect) {
    _lensActive = true;
    _lastLensRect = lensRect || null;
  }

  function updateLens(lensRect) {
    if (!_lensActive || !_gridLayer) return;
    _lastLensRect = lensRect;

    _zones.forEach(function (zone) {
      var el = _zoneEls[zone.id];
      if (!el) return;
      var state = _active[zone.id];
      if (!state) return;

      // Reposition zone (anchor may have scrolled)
      _positionZone(zone, el);

      var zoneRect = el.getBoundingClientRect();
      var overlap = _rectOverlap(lensRect, zoneRect);

      state.overlap = overlap;

      var reveal = zone.reveal || {};
      var threshold = reveal.lockThreshold || 0.75;
      var enterMode = reveal.enter || 'slide';

      if (overlap > 0) {
        // Zone is being revealed
        if (!state.direction) {
          state.direction = _approachDirection(lensRect, zoneRect);
        }

        // Slide progress ramps up with overlap
        var targetProgress = Math.min(1, overlap / 0.3); // reaches 1 at 30% overlap
        if (enterMode === 'fade') {
          state.slideProgress = targetProgress;
        } else {
          // Slide: smooth toward target
          state.slideProgress += (targetProgress - state.slideProgress) * 0.25;
          if (Math.abs(state.slideProgress - targetProgress) < 0.01) {
            state.slideProgress = targetProgress;
          }
        }

        // Apply visual state
        var content = el.querySelector('.reveal-zone-content');
        if (content) {
          if (enterMode === 'fade') {
            content.style.opacity = state.slideProgress;
            content.style.transform = '';
          } else {
            content.style.opacity = Math.min(1, state.slideProgress * 1.5);
            content.style.transform = _slideTranslate(state.direction, state.slideProgress);
          }
        }

        el.classList.add('reveal-zone-visible');

        // Render QR code on first visibility
        if (zone.type === 'qr' && !el.dataset.qrRendered) {
          var qrCanvas = el.querySelector('.reveal-zone-qr');
          var qrContent = el.querySelector('.reveal-zone-content');
          if (qrCanvas && qrContent) {
            _renderQR(
              qrCanvas,
              qrContent.dataset.qrData || '',
              qrContent.dataset.qrFg || '#33ff33',
              qrContent.dataset.qrBg || 'transparent'
            );
            el.dataset.qrRendered = '1';
          }
        }

        // Auto-play video if applicable
        if (zone.type === 'video' && state.slideProgress > 0.5) {
          var vid = el.querySelector('video');
          if (vid && vid.paused && zone.content && zone.content.autoplay) {
            vid.play().catch(function () {});
          }
        }

        // Lock-in check
        if (!state.locked && overlap >= threshold) {
          state.locked = true;
          el.classList.add('reveal-zone-locked');

          // Play lock animation
          var lockAnim = reveal.lockAnimation || 'pulse-glow';
          el.classList.add('reveal-lock-' + lockAnim);

          // SFX
          try {
            if (window.AudioSystem && AudioSystem.playSFX) {
              AudioSystem.playSFX('ui-04');
            }
          } catch (e) {}
        }

      } else if (!state.locked) {
        // No overlap AND not locked — slide back out
        state.slideProgress += (0 - state.slideProgress) * 0.2;
        if (state.slideProgress < 0.02) {
          state.slideProgress = 0;
          state.direction = null;
          el.classList.remove('reveal-zone-visible');
        }

        var content2 = el.querySelector('.reveal-zone-content');
        if (content2) {
          if (enterMode === 'fade') {
            content2.style.opacity = state.slideProgress;
          } else {
            content2.style.opacity = Math.min(1, state.slideProgress * 1.5);
            content2.style.transform = _slideTranslate(
              state.direction || 'left', state.slideProgress
            );
          }
        }
      }
      // If locked and no overlap: content stays visible (scroll-away persistence)
    });
  }

  function endLensSession() {
    if (!_lensActive) return;
    _lensActive = false;

    _zones.forEach(function (zone) {
      var el = _zoneEls[zone.id];
      if (!el) return;
      var state = _active[zone.id];
      if (!state) return;

      var reveal = zone.reveal || {};
      var action = reveal.onRelease || 'persist-found';

      if (state.locked) {
        // Execute release action
        _executeRelease(zone, el, state, action);
      } else {
        // Not locked — animate out
        _animateOut(zone, el, state);
      }
    });
  }

  // ── Release Actions ──────────────────────────────────────

  function _executeRelease(zone, el, state, action) {
    if (action === 'deposit-to-inventory') {
      _depositToInventory(zone, el, state);
    } else if (action === 'pause-and-persist') {
      var vid = el.querySelector('video');
      if (vid) vid.pause();
      _persistFound(zone, el, state);
    } else {
      // 'persist-found' or unknown — just keep it visible
      _persistFound(zone, el, state);
    }
  }

  function _depositToInventory(zone, el, state) {
    var c = zone.content || {};

    // Animate item from grid position to inventory (or just flash)
    el.classList.add('reveal-zone-depositing');

    // Persist
    var revealed = _getRevealed();
    revealed[zone.id] = true;
    _saveRevealed(revealed);

    // Add to AccountInventory
    if (typeof AccountInventory !== 'undefined' && AccountInventory.addItem) {
      AccountInventory.addItem({
        id: c.itemId || zone.id,
        qty: 1,
        meta: c.meta || { name: c.label || zone.id, emoji: c.emoji || '❓' },
      });
    }

    // Callback
    if (typeof _opts.onDeposit === 'function') {
      _opts.onDeposit(zone, el);
    }

    // Remove zone after deposit animation
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
      delete _zoneEls[zone.id];
      delete _active[zone.id];
    }, 600);
  }

  function _persistFound(zone, el, state) {
    // Content stays on grid permanently
    var revealed = _getRevealed();
    revealed[zone.id] = true;
    _saveRevealed(revealed);

    el.classList.add('reveal-zone-persisted');

    // Remove lock animation class after it plays
    setTimeout(function () {
      el.classList.remove('reveal-lock-pulse-glow', 'reveal-lock-scan-line', 'reveal-lock-border-glow');
    }, 500);
  }

  function _animateOut(zone, el, state) {
    // Smooth slide-out animation
    el.classList.add('reveal-zone-exiting');
    var content = el.querySelector('.reveal-zone-content');
    if (content) {
      content.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      content.style.opacity = '0';
      content.style.transform = _slideTranslate(state.direction || 'left', 0);
    }

    setTimeout(function () {
      el.classList.remove('reveal-zone-visible', 'reveal-zone-exiting');
      if (content) {
        content.style.transition = '';
        content.style.transform = '';
      }
      state.slideProgress = 0;
      state.direction = null;
      state.overlap = 0;
    }, 350);
  }

  // ── Reposition on scroll/resize ──────────────────────────

  function _onScrollResize() {
    _zones.forEach(function (zone) {
      var el = _zoneEls[zone.id];
      if (el) _positionZone(zone, el);
    });
  }

  // ── Public API ───────────────────────────────────────────

  function init(opts) {
    if (_initialized) return;
    _initialized = true;
    _opts = opts || {};

    _createGridLayer();

    if (opts.zones) {
      _zones = opts.zones;
      _renderZones();
    } else if (opts.zonesUrl) {
      // Load from JSON file
      var xhr = new XMLHttpRequest();
      xhr.open('GET', opts.zonesUrl, true);
      xhr.onload = function () {
        if (xhr.status === 200) {
          try {
            var data = JSON.parse(xhr.responseText);
            _zones = data.zones || data;
            _renderZones();
          } catch (e) {
            console.warn('[RevealGrid] Failed to parse zones JSON:', e);
          }
        }
      };
      xhr.send();
    }

    window.addEventListener('scroll', _onScrollResize, { passive: true });
    window.addEventListener('resize', _onScrollResize, { passive: true });
  }

  function destroy() {
    _initialized = false;
    if (_gridLayer && _gridLayer.parentNode) {
      _gridLayer.parentNode.removeChild(_gridLayer);
    }
    _gridLayer = null;
    _zones = [];
    _zoneEls = {};
    _active = {};
    _lensActive = false;
    window.removeEventListener('scroll', _onScrollResize);
    window.removeEventListener('resize', _onScrollResize);
  }

  /**
   * Add zones dynamically after init (e.g. from inline script blocks).
   */
  function addZones(newZones) {
    if (!Array.isArray(newZones)) return;
    var revealed = _getRevealed();
    newZones.forEach(function (zone) {
      // Deduplicate
      for (var i = 0; i < _zones.length; i++) {
        if (_zones[i].id === zone.id) return;
      }
      _zones.push(zone);
      if (zone.oneShot && revealed[zone.id]) return;

      if (_gridLayer) {
        var el = _createZoneEl(zone);
        _positionZone(zone, el);
        _gridLayer.appendChild(el);
        _zoneEls[zone.id] = el;
        _active[zone.id] = {
          overlap: 0, locked: false, direction: null,
          revealed: false, slideProgress: 0,
        };
      }
    });
  }

  /**
   * Check if a zone has been revealed (persisted).
   */
  function isRevealed(zoneId) {
    return !!_getRevealed()[zoneId];
  }

  /**
   * Get the grid layer element (for z-index stacking).
   */
  function getGridLayer() {
    return _gridLayer;
  }

  return {
    init:              init,
    destroy:           destroy,
    addZones:          addZones,
    beginLensSession:  beginLensSession,
    updateLens:        updateLens,
    endLensSession:    endLensSession,
    isRevealed:        isRevealed,
    getGridLayer:      getGridLayer,
  };
})();
