/**
 * magnifying-glass-drag.js — Click+Drag Porthole Magnifying Glass
 *
 * When a player clicks and drags the magnifying glass item from their
 * inventory (in /games or the terminal inventory tab), the cursor
 * becomes a porthole lens overlaid on the giant emoji, with the handle
 * visually protruding from the bottom-right of the porthole ring.
 *
 * ARCHITECTURE:
 * - Uses the shared starfield module (starfield.js) for porthole blitting
 * - The drag ghost is a positioned div containing:
 *   1. A .starfield-window canvas (auto-picked up by starfield blit loop)
 *   2. A porthole ring frame (reuses .coin-rings aesthetic)
 *   3. The magnifying glass emoji handle protruding from ring edge
 * - The porthole mask reveals the starfield through a circular aperture
 * - Handle emoji is positioned at ~135° (bottom-right) of the ring
 *
 * INTEGRATION:
 * - Call MagnifyingGlassDrag.init(containerEl) on any page with inventory slots
 * - Slots with data-item="magnifying-glass" become drag sources
 * - Requires starfield.js loaded and EyesOnlyStarfield.init() called
 *
 * References: PORTHOLE_PUZZLE_TOOLKIT.md §3a, §4
 */
var MagnifyingGlassDrag = (function () {
  'use strict';

  var _container = null;
  var _ghost = null;
  var _isDragging = false;
  var _startX = 0;
  var _startY = 0;
  var _dragThreshold = 6; // px before drag activates
  var _previewEl = null;  // emoji preview element inside porthole

  // Porthole dimensions
  var PORTHOLE_SIZE = 160;     // px — diameter of the porthole lens
  var HANDLE_OFFSET = 20;      // px — how far handle pokes past ring
  var RING_WIDTH = 12;         // px — thickness of the ring frame

  /**
   * Create the drag ghost element: porthole + protruding handle
   */
  function _createGhost() {
    var ghost = document.createElement('div');
    ghost.className = 'mag-drag-ghost';
    ghost.style.cssText = [
      'position: fixed',
      'top: 0',
      'left: 0',
      'z-index: 100000',
      'pointer-events: none',
      'width: ' + (PORTHOLE_SIZE + HANDLE_OFFSET * 2) + 'px',
      'height: ' + (PORTHOLE_SIZE + HANDLE_OFFSET * 2) + 'px',
      'will-change: transform',
      'touch-action: none'
    ].join(';');

    // Porthole container (circular clip)
    var porthole = document.createElement('div');
    porthole.className = 'mag-drag-porthole';
    porthole.style.cssText = [
      'position: absolute',
      'top: ' + HANDLE_OFFSET + 'px',
      'left: ' + HANDLE_OFFSET + 'px',
      'width: ' + PORTHOLE_SIZE + 'px',
      'height: ' + PORTHOLE_SIZE + 'px',
      'border-radius: 50%',
      'overflow: hidden',
      'box-shadow: 0 0 20px rgba(0,0,0,0.8), inset 0 0 12px rgba(0,0,0,0.6)'
    ].join(';');

    // Starfield canvas — auto-discovered by starfield.js blit loop
    var canvas = document.createElement('canvas');
    canvas.className = 'starfield-window';
    canvas.width = PORTHOLE_SIZE;
    canvas.height = PORTHOLE_SIZE;
    canvas.style.cssText = [
      'position: absolute',
      'top: 0; left: 0',
      'width: 100%; height: 100%',
      'border-radius: 50%'
    ].join(';');
    porthole.appendChild(canvas);

    // Vignette overlay (matches PORTHOLE_PUZZLE_TOOLKIT §2 spec)
    var vignette = document.createElement('div');
    vignette.className = 'mag-drag-vignette';
    vignette.style.cssText = [
      'position: absolute',
      'inset: 0',
      'border-radius: 50%',
      'background: radial-gradient(circle, transparent 35%, rgba(4,3,8,0.3) 60%, rgba(10,8,16,0.85) 50%)',
      'pointer-events: none'
    ].join(';');
    porthole.appendChild(vignette);

    // Ring frame (simplified coin-rings aesthetic)
    var ring = document.createElement('div');
    ring.className = 'mag-drag-ring';
    ring.style.cssText = [
      'position: absolute',
      'inset: 0',
      'border-radius: 50%',
      'border: ' + RING_WIDTH + 'px solid',
      'border-color: var(--phosphor-dim, #1a6b4a)',
      'box-shadow: inset 0 0 8px var(--phosphor-glow, rgba(28,255,155,0.15)), 0 0 12px var(--phosphor-glow, rgba(28,255,155,0.15))',
      'pointer-events: none'
    ].join(';');
    porthole.appendChild(ring);

    // Inner ring accent line
    var accent = document.createElement('div');
    accent.className = 'mag-drag-ring-accent';
    accent.style.cssText = [
      'position: absolute',
      'inset: ' + (RING_WIDTH - 2) + 'px',
      'border-radius: 50%',
      'border: 1px solid var(--phosphor, #1cff9b)',
      'opacity: 0.4',
      'pointer-events: none'
    ].join(';');
    porthole.appendChild(accent);

    ghost.appendChild(porthole);

    // Handle — giant magnifying glass emoji protruding from bottom-right
    // Positioned so the lens ring appears to sit on top of the handle circle
    var handle = document.createElement('div');
    handle.className = 'mag-drag-handle';
    handle.style.cssText = [
      'position: absolute',
      'bottom: -8px',
      'right: -8px',
      'font-size: 64px',
      'line-height: 1',
      'transform: rotate(-45deg)',
      'filter: drop-shadow(0 2px 6px rgba(0,0,0,0.7))',
      'pointer-events: none',
      'z-index: -1'
    ].join(';');
    handle.textContent = '🔍';
    ghost.appendChild(handle);

    return ghost;
  }

  /**
   * Position the ghost centered on pointer
   */
  function _positionGhost(clientX, clientY) {
    if (!_ghost) return;
    var halfW = _ghost.offsetWidth / 2;
    var halfH = _ghost.offsetHeight / 2;
    _ghost.style.transform = 'translate(' + (clientX - halfW) + 'px, ' + (clientY - halfH) + 'px)';
  }

  /**
   * Compute the porthole circle's bounding rect in viewport coordinates.
   * Used by RevealGrid to detect overlap with hidden zones.
   */
  function _getLensRect(clientX, clientY) {
    var halfW = _ghost ? _ghost.offsetWidth / 2 : (PORTHOLE_SIZE / 2 + HANDLE_OFFSET);
    var halfH = _ghost ? _ghost.offsetHeight / 2 : (PORTHOLE_SIZE / 2 + HANDLE_OFFSET);
    // Porthole is centered within the ghost, inset by HANDLE_OFFSET
    var cx = clientX;
    var cy = clientY;
    var r = PORTHOLE_SIZE / 2;
    return {
      left:   cx - r,
      top:    cy - r,
      right:  cx + r,
      bottom: cy + r,
      width:  PORTHOLE_SIZE,
      height: PORTHOLE_SIZE,
    };
  }

  /**
   * Start the drag interaction
   */
  function _startDrag(clientX, clientY) {
    if (_isDragging) return;
    _isDragging = true;

    _ghost = _createGhost();
    document.body.appendChild(_ghost);
    _positionGhost(clientX, clientY);

    // Fade in
    _ghost.style.opacity = '0';
    _ghost.style.transition = 'opacity 0.15s ease';
    requestAnimationFrame(function () {
      if (_ghost) _ghost.style.opacity = '1';
    });

    // Play SFX
    if (window.AudioSystem && AudioSystem.playSFX) {
      AudioSystem.playSFX('ui-01');
    }

    document.body.style.cursor = 'none';

    // Begin RevealGrid lens session (porthole lens — reveals all zones)
    if (window.RevealGrid) {
      RevealGrid.beginLensSession(_getLensRect(clientX, clientY), { lensSource: 'porthole' });
    }
  }

  // ── Reveal Zone Content (in-porthole rendering) ────────
  // Track last reveal state so we can diff and avoid unnecessary DOM churn.
  var _lastRevealId = null;

  /**
   * Check RevealGrid for active zone overlap and render content
   * inside the porthole ghost with directional slide offset.
   * Called every frame during drag.
   */
  function _updateRevealContent() {
    if (!window.RevealGrid || !_ghost) {
      _clearRevealContent();
      return;
    }

    var reveal = RevealGrid.getActiveReveal();

    if (!reveal) {
      _clearRevealContent();
      return;
    }

    var porthole = _ghost.querySelector('.mag-drag-porthole');
    if (!porthole) return;

    // Create preview element if zone changed or doesn't exist
    if (!_previewEl || _lastRevealId !== reveal.zoneId) {
      _clearRevealContent();
      _lastRevealId = reveal.zoneId;

      var preview = document.createElement('div');
      preview.className = 'mag-drag-preview';
      preview.style.cssText = [
        'position: absolute',
        'inset: 0',
        'display: flex',
        'align-items: center',
        'justify-content: center',
        'font-size: ' + Math.round(PORTHOLE_SIZE * 0.42) + 'px',
        'line-height: 1',
        'pointer-events: none',
        'will-change: transform, opacity'
      ].join(';');

      // Render content based on zone type
      if (reveal.type === 'item') {
        preview.textContent = reveal.emoji || '❓';
        if (reveal.label) {
          preview.innerHTML =
            '<span style="font-size:' + Math.round(PORTHOLE_SIZE * 0.42) + 'px;line-height:1">' +
              (reveal.emoji || '❓') +
            '</span>' +
            '<span style="display:block;font-size:10px;color:var(--phosphor,#1cff9b);' +
              'text-transform:uppercase;letter-spacing:0.1em;margin-top:4px;' +
              'text-shadow:0 0 6px var(--phosphor-glow,rgba(28,255,155,0.4))">' +
              reveal.label +
            '</span>';
          preview.style.flexDirection = 'column';
        }
      } else if (reveal.type === 'text') {
        preview.innerHTML =
          '<div style="font-size:12px;color:var(--phosphor,#1cff9b);' +
            'text-align:center;padding:12px;text-shadow:0 0 4px var(--phosphor-glow,rgba(28,255,155,0.3))">' +
            (reveal.content.html || reveal.content.text || '') +
          '</div>';
      } else if (reveal.type === 'qr') {
        var qrCanvas = document.createElement('canvas');
        qrCanvas.width = Math.round(PORTHOLE_SIZE * 0.7);
        qrCanvas.height = Math.round(PORTHOLE_SIZE * 0.7);
        qrCanvas.style.cssText = 'border-radius:4px;';
        preview.appendChild(qrCanvas);
        // Defer QR render to next frame (RevealGrid._renderQR not accessible,
        // but QR zones are rare — placeholder glow is fine for now)
      } else {
        // image/video/other — show emoji fallback
        preview.textContent = reveal.emoji || '🔎';
      }

      // Insert after starfield canvas, before vignette (DOM order = paint order)
      var canvas = porthole.querySelector('.starfield-window');
      porthole.insertBefore(preview, canvas ? canvas.nextSibling : null);
      _previewEl = preview;
    }

    // Update position/opacity each frame for smooth slide-in
    if (_previewEl) {
      _previewEl.style.opacity = reveal.opacity;
      _previewEl.style.transform = 'translate(' + reveal.offsetX + 'px, ' + reveal.offsetY + 'px)';

      // Lock-in visual feedback: add glow class
      if (reveal.locked && !_previewEl.dataset.locked) {
        _previewEl.dataset.locked = '1';
        _previewEl.style.filter = 'drop-shadow(0 0 8px var(--phosphor-glow, rgba(28,255,155,0.5)))';
      }
    }
  }

  /**
   * Clear the reveal content from the porthole.
   */
  function _clearRevealContent() {
    if (_previewEl && _previewEl.parentNode) {
      _previewEl.parentNode.removeChild(_previewEl);
    }
    _previewEl = null;
    _lastRevealId = null;
  }

  /**
   * Show an emoji preview inside the porthole lens.
   * The preview appears above the starfield layer but below the vignette,
   * so it looks like the item is visible through the porthole glass.
   *
   * @param {string} emoji - The emoji character(s) to display
   */
  function setRevealPreview(emoji) {
    clearRevealPreview();
    if (!_ghost) return;
    var porthole = _ghost.querySelector('.mag-drag-porthole');
    if (!porthole) return;

    var preview = document.createElement('div');
    preview.className = 'mag-drag-preview';
    preview.style.cssText = [
      'position: absolute',
      'inset: 0',
      'display: flex',
      'align-items: center',
      'justify-content: center',
      'font-size: ' + Math.round(PORTHOLE_SIZE * 0.42) + 'px',
      'line-height: 1',
      'pointer-events: none',
      'opacity: 0',
      'transition: opacity 0.25s ease'
    ].join(';');
    preview.textContent = emoji;

    // Insert after the starfield canvas so it sits above the starfield
    // but below the vignette and ring overlays (DOM order = paint order).
    var canvas = porthole.querySelector('.starfield-window');
    porthole.insertBefore(preview, canvas ? canvas.nextSibling : null);

    _previewEl = preview;

    // Trigger fade-in on next frame
    requestAnimationFrame(function () {
      if (_previewEl) _previewEl.style.opacity = '1';
    });
  }

  /**
   * Remove the emoji preview from the porthole lens.
   */
  function clearRevealPreview() {
    if (_previewEl && _previewEl.parentNode) {
      _previewEl.parentNode.removeChild(_previewEl);
    }
    _previewEl = null;
    _lastRevealId = null;
  }

  /**
   * End the drag interaction.
   * Dispatches 'mag-drag-drop' CustomEvent BEFORE clearing state,
   * so listeners can read isDragging() and the drop coordinates.
   */
  function _endDrag(clientX, clientY) {
    if (!_isDragging) return;

    // End RevealGrid lens session BEFORE clearing state
    if (window.RevealGrid) {
      RevealGrid.endLensSession();
    }

    // Dispatch drop event BEFORE clearing state — listeners can check isDragging()
    try {
      document.dispatchEvent(new CustomEvent('mag-drag-drop', {
        detail: { clientX: clientX || 0, clientY: clientY || 0 }
      }));
    } catch (_) {}

    _isDragging = false;

    // Preview element is a child of ghost and will be removed with it
    _previewEl = null;
    _lastRevealId = null;

    if (_ghost) {
      _ghost.style.opacity = '0';
      var g = _ghost;
      setTimeout(function () {
        if (g.parentNode) g.parentNode.removeChild(g);
      }, 150);
      _ghost = null;
    }

    document.body.style.cursor = '';
  }

  // ---- Event handlers ----
  // Keep pointer handlers simple — mirrors the touch handlers that already work on mobile.
  // The only desktop-specific fix is the dragstart listener in init() which prevents
  // the browser from starting a native text drag on the emoji (the real cause of
  // pointercancel on desktop).
  var _pendingDrag = null;

  function _onPointerDown(e) {
    var slot = e.target.closest('[data-item="magnifying-glass"]');
    if (!slot) return;

    // Skip the equipped slot — MicroMagnifier handles that drag
    if (slot.hasAttribute('data-equipped')) return;

    e.preventDefault();
    _pendingDrag = { x: e.clientX, y: e.clientY };
    _startX = e.clientX;
    _startY = e.clientY;
  }

  function _onPointerMove(e) {
    if (_isDragging) {
      e.preventDefault();
      _positionGhost(e.clientX, e.clientY);
      // Update RevealGrid lens position each frame
      if (window.RevealGrid) {
        RevealGrid.updateLens(_getLensRect(e.clientX, e.clientY));
      }
      // Render zone content inside porthole
      _updateRevealContent();
      return;
    }

    if (_pendingDrag) {
      var dx = e.clientX - _pendingDrag.x;
      var dy = e.clientY - _pendingDrag.y;
      if (Math.sqrt(dx * dx + dy * dy) > _dragThreshold) {
        _pendingDrag = null;
        _startDrag(e.clientX, e.clientY);
      }
    }
  }

  function _onPointerUp(e) {
    _pendingDrag = null;
    if (_isDragging) {
      _endDrag(e.clientX, e.clientY);
    }
  }

  function _onPointerCancel() {
    _pendingDrag = null;
    _endDrag(0, 0);
  }

  // ---- Touch support ----
  function _onTouchStart(e) {
    var slot = e.target.closest('[data-item="magnifying-glass"]');
    if (!slot) return;

    // Skip the equipped slot — MicroMagnifier handles that drag
    if (slot.hasAttribute('data-equipped')) return;

    var touch = e.touches[0];
    _pendingDrag = { x: touch.clientX, y: touch.clientY };
    _startX = touch.clientX;
    _startY = touch.clientY;
  }

  function _onTouchMove(e) {
    if (!_pendingDrag && !_isDragging) return;
    var touch = e.touches[0];

    if (_isDragging) {
      e.preventDefault();
      _positionGhost(touch.clientX, touch.clientY);
      // Update RevealGrid lens position each frame
      if (window.RevealGrid) {
        RevealGrid.updateLens(_getLensRect(touch.clientX, touch.clientY));
      }
      // Render zone content inside porthole
      _updateRevealContent();
      return;
    }

    if (_pendingDrag) {
      var dx = touch.clientX - _pendingDrag.x;
      var dy = touch.clientY - _pendingDrag.y;
      if (Math.sqrt(dx * dx + dy * dy) > _dragThreshold) {
        e.preventDefault();
        _pendingDrag = null;
        _startDrag(touch.clientX, touch.clientY);
      }
    }
  }

  var _lastTouchX = 0;
  var _lastTouchY = 0;

  // Track last touch position for drop coordinates
  var _origTouchMove = _onTouchMove;
  _onTouchMove = function (e) {
    if (e.touches && e.touches[0]) {
      _lastTouchX = e.touches[0].clientX;
      _lastTouchY = e.touches[0].clientY;
    }
    _origTouchMove(e);
  };

  function _onTouchEnd() {
    _pendingDrag = null;
    _endDrag(_lastTouchX, _lastTouchY);
  }

  // ---- Public API ----

  /**
   * Initialize drag behavior on a container.
   * Any descendant with data-item="magnifying-glass" becomes a drag source.
   *
   * @param {HTMLElement} container - The inventory container element
   */
  function init(container) {
    if (!container) {
      container = document.body;
    }
    _container = container;

    // Pointer events (mouse + pen)
    container.addEventListener('pointerdown', _onPointerDown, { passive: false });
    document.addEventListener('pointermove', _onPointerMove, { passive: false });
    document.addEventListener('pointerup', _onPointerUp);
    document.addEventListener('pointercancel', _onPointerCancel);

    // Prevent native HTML5 drag on magnifying glass emoji (would fire pointercancel)
    container.addEventListener('dragstart', function (e) {
      if (e.target.closest && e.target.closest('[data-item="magnifying-glass"]')) {
        e.preventDefault();
      }
    });

    // Touch fallback (for browsers with incomplete pointer event support)
    container.addEventListener('touchstart', _onTouchStart, { passive: true });
    document.addEventListener('touchmove', _onTouchMove, { passive: false });
    document.addEventListener('touchend', _onTouchEnd);

    // Initialize starfield if available and not yet running (non-fatal)
    try {
      if (window.EyesOnlyStarfield && !EyesOnlyStarfield.isRunning()) {
        EyesOnlyStarfield.init();
      }
    } catch (err) {
      console.warn('[MagnifyingGlassDrag] Starfield init failed:', err);
    }
  }

  /**
   * Clean up event listeners.
   */
  function dispose() {
    if (_container) {
      _container.removeEventListener('pointerdown', _onPointerDown);
      _container.removeEventListener('touchstart', _onTouchStart);
    }
    document.removeEventListener('pointermove', _onPointerMove);
    document.removeEventListener('pointerup', _onPointerUp);
    document.removeEventListener('pointercancel', _onPointerCancel);
    document.removeEventListener('touchmove', _onTouchMove);
    document.removeEventListener('touchend', _onTouchEnd);
    _endDrag();
    _container = null;
  }

  return {
    init: init,
    dispose: dispose,
    isDragging: function () { return _isDragging; },
    setRevealPreview: setRevealPreview,
    clearRevealPreview: clearRevealPreview,
    getLensRect: _getLensRect,
  };

})();
