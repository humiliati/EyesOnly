/**
 * micro-magnifier.js — Zoom Field Effect Module
 *
 * When a player equips the magnifying glass (ITM-200) to the active item
 * slot and drags it from the header, a circular zoom field appears that
 * magnifies the underlying page content. Unlike the old porthole (starfield
 * window), this is a real DOM magnifier — it scales the page beneath.
 *
 * EXCLUSIVE TO: items tagged with `micro_magnifier: true` in items.json
 * (currently ITM-200 Magnifying Glass). A future macro_magnifier item
 * will use a larger lens with different zoom + interaction properties.
 *
 * FEATURES:
 * - Circular zoom field (2x magnification, 180px diameter)
 * - Phosphor-green ring frame matching CRT aesthetic
 * - Magnified content rendered via CSS transform: scale() on a clipped copy
 * - Drop detection for combo zones (portholes, puzzle elements, stat perks)
 * - Dispatches 'micro-mag-hover' and 'micro-mag-drop' CustomEvents
 *
 * ARCHITECTURE:
 * - MicroMagnifier.startDrag(clientX, clientY, itemData) — begin drag
 * - MicroMagnifier.updateDrag(clientX, clientY) — move lens
 * - MicroMagnifier.endDrag(clientX, clientY) — complete/cancel
 * - Auto-hooks into the header slot pointer drag system
 *
 * References: PORTHOLE_PUZZLE_TOOLKIT.md §3a
 */
var MicroMagnifier = (function() {
  'use strict';

  // ── Configuration ──
  var LENS_SIZE = 180;         // px diameter
  var ZOOM_LEVEL = 2.0;        // magnification factor
  var RING_WIDTH = 10;         // px ring border
  var HANDLE_SIZE = 56;        // px handle emoji font-size

  // ── State ──
  var _isDragging = false;
  var _lensEl = null;          // main ghost container
  var _zoomCanvas = null;      // the magnified content viewport
  var _itemData = null;        // equipped item reference
  var _rafId = null;           // requestAnimationFrame handle
  var _lastX = 0;
  var _lastY = 0;

  // ── Create the zoom lens ghost ──
  function _createLens() {
    var lens = document.createElement('div');
    lens.className = 'micro-mag-lens';
    lens.style.cssText = [
      'position: fixed',
      'z-index: 100000',
      'pointer-events: none',
      'width: ' + (LENS_SIZE + 40) + 'px',
      'height: ' + (LENS_SIZE + 40) + 'px',
      'will-change: transform',
      'touch-action: none',
      'opacity: 0',
      'transition: opacity 0.15s ease'
    ].join(';');

    // Zoom viewport — circular clip that shows magnified page content
    var viewport = document.createElement('div');
    viewport.className = 'micro-mag-viewport';
    viewport.style.cssText = [
      'position: absolute',
      'top: 20px',
      'left: 20px',
      'width: ' + LENS_SIZE + 'px',
      'height: ' + LENS_SIZE + 'px',
      'border-radius: 50%',
      'overflow: hidden',
      'background: rgba(4, 12, 6, 0.92)',
      'box-shadow: 0 0 24px rgba(0,0,0,0.8), inset 0 0 16px rgba(0,0,0,0.6)'
    ].join(';');

    // The zoom canvas — a clipped, scaled snapshot of the page beneath
    var zoomArea = document.createElement('div');
    zoomArea.className = 'micro-mag-zoom-area';
    zoomArea.style.cssText = [
      'position: absolute',
      'width: ' + LENS_SIZE + 'px',
      'height: ' + LENS_SIZE + 'px',
      'border-radius: 50%',
      'overflow: hidden',
      'pointer-events: none'
    ].join(';');

    // Create a clone viewport that mirrors page content
    var mirrorContainer = document.createElement('div');
    mirrorContainer.className = 'micro-mag-mirror';
    mirrorContainer.style.cssText = [
      'position: absolute',
      'transform-origin: center center',
      'transform: scale(' + ZOOM_LEVEL + ')',
      'pointer-events: none',
      'will-change: transform'
    ].join(';');

    zoomArea.appendChild(mirrorContainer);
    viewport.appendChild(zoomArea);
    _zoomCanvas = mirrorContainer;

    // Phosphor ring frame
    var ring = document.createElement('div');
    ring.className = 'micro-mag-ring';
    ring.style.cssText = [
      'position: absolute',
      'top: 20px',
      'left: 20px',
      'width: ' + LENS_SIZE + 'px',
      'height: ' + LENS_SIZE + 'px',
      'border-radius: 50%',
      'border: ' + RING_WIDTH + 'px solid',
      'border-color: var(--phosphor-dim, #1a6b4a)',
      'box-shadow: inset 0 0 10px var(--phosphor-glow, rgba(28,255,155,0.2)), 0 0 16px var(--phosphor-glow, rgba(28,255,155,0.2))',
      'pointer-events: none',
      'box-sizing: border-box'
    ].join(';');

    // Inner ring accent
    var accent = document.createElement('div');
    accent.style.cssText = [
      'position: absolute',
      'inset: ' + (RING_WIDTH - 2) + 'px',
      'border-radius: 50%',
      'border: 1px solid var(--phosphor, #1cff9b)',
      'opacity: 0.35',
      'pointer-events: none'
    ].join(';');
    ring.appendChild(accent);

    // Crosshair center marker
    var crosshair = document.createElement('div');
    crosshair.className = 'micro-mag-crosshair';
    crosshair.style.cssText = [
      'position: absolute',
      'top: 50%',
      'left: 50%',
      'transform: translate(-50%, -50%)',
      'width: 12px',
      'height: 12px',
      'border: 1px solid var(--phosphor, #1cff9b)',
      'border-radius: 50%',
      'opacity: 0.4',
      'pointer-events: none'
    ].join(';');
    viewport.appendChild(crosshair);

    // Vignette overlay
    var vignette = document.createElement('div');
    vignette.style.cssText = [
      'position: absolute',
      'top: 20px',
      'left: 20px',
      'width: ' + LENS_SIZE + 'px',
      'height: ' + LENS_SIZE + 'px',
      'border-radius: 50%',
      'background: radial-gradient(circle, transparent 40%, rgba(4,3,8,0.25) 65%, rgba(10,8,16,0.7) 100%)',
      'pointer-events: none'
    ].join(';');

    // Handle — magnifying glass emoji at bottom-right
    var handle = document.createElement('div');
    handle.className = 'micro-mag-handle';
    handle.style.cssText = [
      'position: absolute',
      'bottom: -6px',
      'right: -6px',
      'font-size: ' + HANDLE_SIZE + 'px',
      'line-height: 1',
      'transform: rotate(-45deg)',
      'filter: drop-shadow(0 2px 8px rgba(0,0,0,0.7))',
      'pointer-events: none',
      'z-index: -1'
    ].join(';');
    handle.textContent = '\uD83D\uDD0D'; // 🔍

    lens.appendChild(viewport);
    lens.appendChild(ring);
    lens.appendChild(vignette);
    lens.appendChild(handle);

    return lens;
  }

  // ── Position lens centered on pointer ──
  function _positionLens(x, y) {
    if (!_lensEl) return;
    var hw = _lensEl.offsetWidth / 2;
    var hh = _lensEl.offsetHeight / 2;
    _lensEl.style.transform = 'translate(' + (x - hw) + 'px, ' + (y - hh) + 'px)';
    _lastX = x;
    _lastY = y;
  }

  // ── Update zoom content ──
  // Uses elementFromPoint to detect what's under the lens center,
  // then renders a visual representation inside the zoom area.
  function _updateZoomContent(x, y) {
    if (!_zoomCanvas) return;

    // Temporarily hide lens to let elementFromPoint see through
    _lensEl.style.display = 'none';
    var underElement = document.elementFromPoint(x, y);
    _lensEl.style.display = '';

    if (!underElement) {
      _zoomCanvas.innerHTML = '';
      return;
    }

    // Dispatch hover event for combo detection
    try {
      document.dispatchEvent(new CustomEvent('micro-mag-hover', {
        detail: {
          clientX: x,
          clientY: y,
          element: underElement,
          isPorthole: !!(underElement.closest && underElement.closest('[data-porthole]')),
          isPuzzle: !!(underElement.closest && underElement.closest('[data-puzzle]')),
          isMagnifiable: !!(underElement.closest && underElement.closest('[data-micro-magnifier]'))
        }
      }));
    } catch (ex) {}

    // Highlight ring if over a combo target
    var ring = _lensEl.querySelector('.micro-mag-ring');
    if (ring) {
      var isCombo = underElement.closest &&
        (underElement.closest('[data-porthole]') ||
         underElement.closest('[data-puzzle]') ||
         underElement.closest('[data-micro-magnifier]'));
      ring.style.borderColor = isCombo
        ? 'var(--phosphor-bright, #33ff88)'
        : 'var(--phosphor-dim, #1a6b4a)';
      ring.style.boxShadow = isCombo
        ? 'inset 0 0 14px rgba(28,255,155,0.4), 0 0 24px rgba(28,255,155,0.4)'
        : 'inset 0 0 10px var(--phosphor-glow, rgba(28,255,155,0.2)), 0 0 16px var(--phosphor-glow, rgba(28,255,155,0.2))';
    }

    // Render a scaled snapshot of nearby content
    // We use a simplified approach: grab the computed background/text of the
    // area under the lens and show it at ZOOM_LEVEL magnification
    var rect = underElement.getBoundingClientRect();
    var cs = window.getComputedStyle(underElement);
    var bgColor = cs.backgroundColor || 'transparent';
    var color = cs.color || '#1cff9b';
    var text = underElement.textContent || '';

    // Limit text for readability
    if (text.length > 80) text = text.substring(0, 80) + '\u2026';

    _zoomCanvas.style.width = LENS_SIZE + 'px';
    _zoomCanvas.style.height = LENS_SIZE + 'px';

    _zoomCanvas.innerHTML =
      '<div style="' +
        'width:' + LENS_SIZE + 'px;' +
        'height:' + LENS_SIZE + 'px;' +
        'display:flex;align-items:center;justify-content:center;' +
        'background:' + bgColor + ';' +
        'color:' + color + ';' +
        'font-size:' + Math.round(10 * ZOOM_LEVEL) + 'px;' +
        'text-align:center;padding:8px;box-sizing:border-box;' +
        'word-break:break-word;line-height:1.3;' +
        'font-family:var(--font-mono,monospace);' +
        'text-shadow:0 0 4px var(--phosphor-glow,rgba(28,255,155,0.3));' +
      '">' + _escapeHtml(text) + '</div>';
  }

  function _escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── RAF loop for smooth updates ──
  function _loop() {
    if (!_isDragging) return;
    _updateZoomContent(_lastX, _lastY);
    _rafId = requestAnimationFrame(_loop);
  }

  // ── Public API ──

  /**
   * Start magnifier drag from the equipped header slot.
   * @param {number} clientX - Starting pointer X
   * @param {number} clientY - Starting pointer Y
   * @param {Object} itemData - The equipped item reference
   */
  function startDrag(clientX, clientY, itemData) {
    if (_isDragging) return;
    _isDragging = true;
    _itemData = itemData;

    _lensEl = _createLens();
    document.body.appendChild(_lensEl);
    _positionLens(clientX, clientY);

    // Fade in
    requestAnimationFrame(function() {
      if (_lensEl) _lensEl.style.opacity = '1';
    });

    // SFX
    if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
      AudioSystem.play('ui-01', { volume: 0.3 });
    }

    document.body.style.cursor = 'none';
    _rafId = requestAnimationFrame(_loop);
  }

  /**
   * Update lens position during drag.
   */
  function updateDrag(clientX, clientY) {
    if (!_isDragging) return;
    _positionLens(clientX, clientY);
  }

  /**
   * End the magnifier drag.
   */
  function endDrag(clientX, clientY) {
    if (!_isDragging) return;
    _isDragging = false;

    if (_rafId) {
      cancelAnimationFrame(_rafId);
      _rafId = null;
    }

    // Dispatch drop event
    try {
      // Check what's under the drop point
      if (_lensEl) _lensEl.style.display = 'none';
      var dropTarget = document.elementFromPoint(clientX || _lastX, clientY || _lastY);
      if (_lensEl) _lensEl.style.display = '';

      document.dispatchEvent(new CustomEvent('micro-mag-drop', {
        detail: {
          clientX: clientX || _lastX,
          clientY: clientY || _lastY,
          element: dropTarget,
          item: _itemData,
          isPorthole: !!(dropTarget && dropTarget.closest && dropTarget.closest('[data-porthole]')),
          isPuzzle: !!(dropTarget && dropTarget.closest && dropTarget.closest('[data-puzzle]'))
        }
      }));
    } catch (ex) {}

    // Fade out and remove
    if (_lensEl) {
      _lensEl.style.opacity = '0';
      var el = _lensEl;
      setTimeout(function() {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      }, 150);
      _lensEl = null;
    }

    _zoomCanvas = null;
    _itemData = null;
    document.body.style.cursor = '';

    // SFX
    if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
      AudioSystem.play('ui-04', { volume: 0.25 });
    }
  }

  /**
   * Check if an item should use the micro-magnifier effect.
   * @param {string} itemId - Item ID to check
   * @returns {boolean}
   */
  function isApplicable(itemId) {
    if (!itemId) return false;
    // ITM-200 is the magnifying glass — always applicable
    if (itemId === 'ITM-200') return true;
    // Check items.json registry for micro_magnifier flag
    if (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getItem) {
      var def = GoneRogueDataRegistry.getItem(itemId);
      return !!(def && def.micro_magnifier);
    }
    return false;
  }

  return {
    startDrag: startDrag,
    updateDrag: updateDrag,
    endDrag: endDrag,
    isDragging: function() { return _isDragging; },
    isApplicable: isApplicable,
    LENS_SIZE: LENS_SIZE,
    ZOOM_LEVEL: ZOOM_LEVEL
  };
})();
