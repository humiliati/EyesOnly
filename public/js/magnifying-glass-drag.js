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
  }

  /**
   * End the drag interaction.
   * Dispatches 'mag-drag-drop' CustomEvent BEFORE clearing state,
   * so listeners can read isDragging() and the drop coordinates.
   */
  function _endDrag(clientX, clientY) {
    if (!_isDragging) return;

    // Dispatch drop event BEFORE clearing state — listeners can check isDragging()
    try {
      document.dispatchEvent(new CustomEvent('mag-drag-drop', {
        detail: { clientX: clientX || 0, clientY: clientY || 0 }
      }));
    } catch (_) {}

    _isDragging = false;

    // Preview element is a child of ghost and will be removed with it
    _previewEl = null;

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
  var _pendingDrag = null;

  function _onPointerDown(e) {
    var slot = e.target.closest('[data-item="magnifying-glass"]');
    if (!slot) return;

    e.preventDefault();
    _pendingDrag = { x: e.clientX, y: e.clientY };
    _startX = e.clientX;
    _startY = e.clientY;
  }

  function _onPointerMove(e) {
    if (_isDragging) {
      e.preventDefault();
      _positionGhost(e.clientX, e.clientY);
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

    // Touch fallback (for browsers with incomplete pointer event support)
    container.addEventListener('touchstart', _onTouchStart, { passive: true });
    document.addEventListener('touchmove', _onTouchMove, { passive: false });
    document.addEventListener('touchend', _onTouchEnd);

    // Initialize starfield if available and not yet running
    if (window.EyesOnlyStarfield && !EyesOnlyStarfield.isRunning()) {
      EyesOnlyStarfield.init();
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
    clearRevealPreview: clearRevealPreview
  };

})();
