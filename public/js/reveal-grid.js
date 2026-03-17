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

   ARCHITECTURE (in-porthole rendering):
   Zone content is rendered INSIDE the lens source's porthole
   element — not on an external grid layer. The porthole's own
   overflow:hidden + border-radius:50% provides natural circular
   clipping. RevealGrid handles overlap detection, slide progress,
   and lock-in state; lens sources call getActiveReveal() each
   frame and render the content into their porthole DOM.

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
        - Computes slide progress & direction
        - Checks lock threshold
        → Lens source calls getActiveReveal() to render in porthole
     3. Lens released → RevealGrid.endLensSession()
        - Locked zones: execute onRelease action
        - Unlocked zones: reset state
   ============================================================ */

var RevealGrid = (function () {
  'use strict';

  // ── State ────────────────────────────────────────────────
  var _zones = [];            // zone definitions (from JSON)
  var _anchorEls = {};        // zone ID → resolved anchor element (cached)
  var _active = {};           // zone ID → { overlap, locked, direction, revealed, slideProgress }
  var _lensActive = false;
  var _lastLensRect = null;
  var _opts = {};
  var _initialized = false;

  // The currently revealed zone (highest overlap, not yet deposited)
  var _activeReveal = null;   // { zone, state, content, direction, slideProgress } or null

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

  // ── QR Canvas Renderer ──────────────────────────────────
  // Minimal QR-like pattern renderer. Generates a deterministic
  // grid pattern from the data string (not a real QR encoder,
  // but visually convincing for the spy-game aesthetic).

  function _renderQR(canvas, data, fgColor, bgColor) {
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;

    ctx.fillStyle = bgColor || 'transparent';
    if (bgColor && bgColor !== 'transparent') {
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.clearRect(0, 0, w, h);
    }

    var gridSize = 21;
    var cellW = w / gridSize;
    var cellH = h / gridSize;

    var hash = 0;
    for (var i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
    }

    ctx.fillStyle = fgColor || '#33ff33';
    for (var row = 0; row < gridSize; row++) {
      for (var col = 0; col < gridSize; col++) {
        var inFinderTL = row < 7 && col < 7;
        var inFinderTR = row < 7 && col >= gridSize - 7;
        var inFinderBL = row >= gridSize - 7 && col < 7;
        var bit = 0;

        if (inFinderTL || inFinderTR || inFinderBL) {
          var lr = inFinderTL ? row : (inFinderTR ? row : row - (gridSize - 7));
          var lc = inFinderTL ? col : (inFinderTR ? col - (gridSize - 7) : col);
          if (lr === 0 || lr === 6 || lc === 0 || lc === 6) {
            bit = 1;
          } else if (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4) {
            bit = 1;
          }
        } else {
          var seed = (hash ^ (row * 31 + col * 17)) >>> 0;
          seed = ((seed * 1103515245 + 12345) >>> 16) & 0x7fff;
          bit = (seed % 3 === 0) ? 1 : 0;
        }

        if (bit) {
          ctx.fillRect(
            Math.floor(col * cellW),
            Math.floor(row * cellH),
            Math.ceil(cellW),
            Math.ceil(cellH)
          );
        }
      }
    }
  }

  // ── Zone Anchor Resolution ─────────────────────────────

  function _resolveAnchor(zone) {
    var anchor = zone.anchor || {};
    var offset = anchor.offset || [0, 0];

    if (anchor.selector) {
      // Cache the element lookup
      if (!_anchorEls[zone.id]) {
        _anchorEls[zone.id] = document.querySelector(anchor.selector);
      }
      var el = _anchorEls[zone.id];
      if (el) {
        var rect = el.getBoundingClientRect();
        return {
          x: rect.left + offset[0],
          y: rect.top + offset[1],
          width: rect.width,
          height: rect.height,
        };
      }
    }

    if (typeof anchor.x === 'number') {
      return { x: anchor.x + offset[0], y: anchor.y + offset[1], width: 0, height: 0 };
    }

    return { x: offset[0], y: offset[1], width: 0, height: 0 };
  }

  function _getZoneRect(zone) {
    var pos = _resolveAnchor(zone);
    var size = zone.size || [120, 120];
    return {
      left:   pos.x,
      top:    pos.y,
      right:  pos.x + size[0],
      bottom: pos.y + size[1],
      width:  size[0],
      height: size[1],
    };
  }

  // ── Overlap Detection ────────────────────────────────────

  function _rectOverlap(a, b) {
    var ox = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    var oy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    var overlapArea = ox * oy;
    var zoneArea = (b.right - b.left) * (b.bottom - b.top);
    return zoneArea > 0 ? overlapArea / zoneArea : 0;
  }

  function _approachDirection(lensRect, zoneRect) {
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

  function _slideOffset(direction, progress) {
    // Returns { x, y } pixel offset for slide-in effect.
    // progress: 0 = fully hidden (off-screen), 1 = in place
    var travel = 40; // px travel distance
    var offset = Math.round((1 - progress) * travel);
    switch (direction) {
      case 'left':   return { x: -offset, y: 0 };
      case 'right':  return { x: offset, y: 0 };
      case 'top':    return { x: 0, y: -offset };
      case 'bottom': return { x: 0, y: offset };
      default:       return { x: 0, y: 0 };
    }
  }

  // ── Lens Session ─────────────────────────────────────────

  function beginLensSession(lensRect) {
    _lensActive = true;
    _lastLensRect = lensRect || null;
    _activeReveal = null;
  }

  function updateLens(lensRect) {
    if (!_lensActive) return;
    _lastLensRect = lensRect;
    _activeReveal = null;

    var bestOverlap = 0;
    var bestZone = null;
    var bestState = null;

    _zones.forEach(function (zone) {
      var state = _active[zone.id];
      if (!state) return;

      var zoneRect = _getZoneRect(zone);
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
        var targetProgress = Math.min(1, overlap / 0.3);
        if (enterMode === 'fade') {
          state.slideProgress = targetProgress;
        } else {
          state.slideProgress += (targetProgress - state.slideProgress) * 0.25;
          if (Math.abs(state.slideProgress - targetProgress) < 0.01) {
            state.slideProgress = targetProgress;
          }
        }

        // Lock-in check
        if (!state.locked && overlap >= threshold) {
          state.locked = true;

          // SFX
          try {
            if (window.AudioSystem && AudioSystem.playSFX) {
              AudioSystem.playSFX('ui-04');
            }
          } catch (e) {}
        }

        // Track highest-overlap zone for getActiveReveal()
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestZone = zone;
          bestState = state;
        }

      } else if (!state.locked) {
        // No overlap AND not locked — slide back out
        state.slideProgress += (0 - state.slideProgress) * 0.2;
        if (state.slideProgress < 0.02) {
          state.slideProgress = 0;
          state.direction = null;
          state.overlap = 0;
        }
      }
      // If locked and no overlap: state persists for release
    });

    // Build the active reveal descriptor
    if (bestZone && bestState) {
      var c = bestZone.content || {};
      var enterMode = (bestZone.reveal || {}).enter || 'slide';
      var offset = (enterMode === 'slide')
        ? _slideOffset(bestState.direction || 'left', bestState.slideProgress)
        : { x: 0, y: 0 };

      _activeReveal = {
        zone:          bestZone,
        zoneId:        bestZone.id,
        type:          bestZone.type || 'item',
        content:       c,
        emoji:         c.emoji || null,
        label:         c.label || null,
        direction:     bestState.direction,
        slideProgress: bestState.slideProgress,
        opacity:       (enterMode === 'fade')
                         ? bestState.slideProgress
                         : Math.min(1, bestState.slideProgress * 1.5),
        offsetX:       offset.x,
        offsetY:       offset.y,
        locked:        bestState.locked,
        lockAnimation: (bestZone.reveal || {}).lockAnimation || 'pulse-glow',
        palette:       bestZone.palette || null,
        tier:          bestZone.tier || 'SURFACE',
      };
    }
  }

  function endLensSession() {
    if (!_lensActive) return;
    _lensActive = false;
    _activeReveal = null;

    _zones.forEach(function (zone) {
      var state = _active[zone.id];
      if (!state) return;

      var reveal = zone.reveal || {};
      var action = reveal.onRelease || 'persist-found';

      if (state.locked) {
        _executeRelease(zone, state, action);
      } else {
        // Not locked — reset state
        state.slideProgress = 0;
        state.direction = null;
        state.overlap = 0;
      }
    });
  }

  /**
   * Get the current active reveal state.
   * Lens sources call this each frame after updateLens() to decide
   * what to render inside their porthole.
   *
   * @returns {Object|null} Active reveal descriptor or null if nothing is being revealed.
   *   {
   *     zone, zoneId, type, content, emoji, label,
   *     direction, slideProgress, opacity, offsetX, offsetY,
   *     locked, lockAnimation, palette, tier
   *   }
   */
  function getActiveReveal() {
    return _activeReveal;
  }

  // ── Release Actions ──────────────────────────────────────

  function _executeRelease(zone, state, action) {
    if (action === 'deposit-to-inventory') {
      _depositToInventory(zone, state);
    } else if (action === 'pause-and-persist') {
      _persistFound(zone, state);
    } else {
      _persistFound(zone, state);
    }

    // Notify PuzzleState (Phase 7) of locked zone — cross-page clue tracking
    if (typeof PuzzleState !== 'undefined' && PuzzleState.onClueFound) {
      PuzzleState.onClueFound(zone.id, 'reveal');
    }
    // Also dispatch DOM event for any other listeners
    if (typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('revealGrid:locked', {
        detail: { zoneId: zone.id, action: action }
      }));
    }
  }

  function _depositToInventory(zone, state) {
    var c = zone.content || {};

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
      _opts.onDeposit(zone);
    }

    // Remove zone from active tracking (one-shot)
    delete _active[zone.id];

    // Remove from zones array if oneShot
    if (zone.oneShot) {
      for (var i = _zones.length - 1; i >= 0; i--) {
        if (_zones[i].id === zone.id) {
          _zones.splice(i, 1);
          break;
        }
      }
    }
  }

  function _persistFound(zone, state) {
    var revealed = _getRevealed();
    revealed[zone.id] = true;
    _saveRevealed(revealed);
    state.revealed = true;
  }

  // ── Initialization ─────────────────────────────────────

  function _initZones(zones) {
    var revealed = _getRevealed();

    zones.forEach(function (zone) {
      // Skip one-shot zones that are already revealed
      if (zone.oneShot && revealed[zone.id]) return;

      _zones.push(zone);
      _active[zone.id] = {
        overlap: 0,
        locked: false,
        direction: null,
        revealed: false,
        slideProgress: 0,
      };
    });
  }

  // ── Public API ───────────────────────────────────────────

  function init(opts) {
    if (_initialized) return;
    _initialized = true;
    _opts = opts || {};

    if (opts.zones) {
      _initZones(opts.zones);
    } else if (opts.zonesUrl) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', opts.zonesUrl, true);
      xhr.onload = function () {
        if (xhr.status === 200) {
          try {
            var data = JSON.parse(xhr.responseText);
            _initZones(data.zones || data);
          } catch (e) {
            console.warn('[RevealGrid] Failed to parse zones JSON:', e);
          }
        }
      };
      xhr.send();
    }
  }

  function destroy() {
    _initialized = false;
    _zones = [];
    _anchorEls = {};
    _active = {};
    _activeReveal = null;
    _lensActive = false;
    _lastLensRect = null;
  }

  function addZones(newZones) {
    if (!Array.isArray(newZones)) return;
    var revealed = _getRevealed();
    newZones.forEach(function (zone) {
      for (var i = 0; i < _zones.length; i++) {
        if (_zones[i].id === zone.id) return;
      }
      if (zone.oneShot && revealed[zone.id]) return;
      _zones.push(zone);
      _active[zone.id] = {
        overlap: 0, locked: false, direction: null,
        revealed: false, slideProgress: 0,
      };
    });
  }

  function isRevealed(zoneId) {
    return !!_getRevealed()[zoneId];
  }

  return {
    init:              init,
    destroy:           destroy,
    addZones:          addZones,
    beginLensSession:  beginLensSession,
    updateLens:        updateLens,
    endLensSession:    endLensSession,
    getActiveReveal:   getActiveReveal,
    isRevealed:        isRevealed,
  };
})();
