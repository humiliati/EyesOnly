/**
 * smart-watch-widget.js — Smart Watch Widget
 *
 * Site-wide pixel art wristwatch with a CRT green screen.
 * Opens an overlay containing the full MOK debrief feed
 * (pyramid + interactive states) and audio controls
 * (master mute, music volume, SFX volume, now playing).
 *
 * Item-gated: only appears when the user has an item with
 * debrief_feed: true in their inventory (default: ITM-204).
 *
 * Features:
 *  - Minimized: draggable pixel art watch, position persists to localStorage
 *  - Expanded: modal overlay with 4:3 debrief viewport + audio panel
 *  - Full MOK pyramid with poke/spin/squish interaction
 *  - Audio controls synced with AudioSystem
 *  - Keyboard: W to toggle, Escape to close
 *  - Replaces audio-mini-widget on non-terminal pages
 */

var SmartWatchWidget = (function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════

  var POS_KEY = 'EYESONLY_SMARTWATCH_POS_V1';

  var _state = {
    initialized: false,
    visible: false,
    expanded: false,
    isDragging: false,
    position: { x: 16, y: 16 }, // left, bottom (px)
    mokInteractionBound: false
  };

  var _el = {}; // Cached DOM refs

  // ═══════════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════════

  function init() {
    if (_state.initialized) return;

    if (!_hasDebriefFeedItem()) {
      console.log('[SmartWatch] No debrief_feed item found, not initializing');
      return;
    }

    console.log('[SmartWatch] Debrief feed item found, initializing...');

    _loadPosition();
    _createElements();
    _setupEvents();
    _state.initialized = true;
    _state.visible = true;

    // Hide audio-mini-widget if present (we replace it)
    var miniToggle = document.getElementById('audio-mini-toggle');
    if (miniToggle) miniToggle.style.display = 'none';

    console.log('[SmartWatch] Ready');
  }

  // ═══════════════════════════════════════════════════════════════
  // ITEM CHECK
  // ═══════════════════════════════════════════════════════════════

  function _hasDebriefFeedItem() {
    if (typeof AccountInventory === 'undefined') {
      console.warn('[SmartWatch] AccountInventory not loaded');
      return false;
    }
    var items = AccountInventory.getItems();
    return items.some(function (item) {
      return item.meta && item.meta.debrief_feed === true;
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // DOM CREATION
  // ═══════════════════════════════════════════════════════════════

  function _createElements() {
    // ── Minimized widget ──
    _el.widget = document.createElement('div');
    _el.widget.id = 'smart-watch-widget';
    _el.widget.className = 'smart-watch-widget';
    _el.widget.setAttribute('role', 'button');
    _el.widget.setAttribute('tabindex', '0');
    _el.widget.setAttribute('aria-label', 'Smart Watch — open debrief feed');
    _el.widget.style.cssText = 'left: ' + _state.position.x + 'px; bottom: ' + _state.position.y + 'px;';

    _el.widget.innerHTML = [
      '<div class="smart-watch-sprite">',
        '<div class="sw-strap-top"></div>',
        '<div class="sw-case">',
          '<div class="sw-screen">',
            '<div class="sw-mok-glyph"></div>',
            '<div class="sw-audio-dot" id="sw-audio-dot"></div>',
          '</div>',
        '</div>',
        '<div class="sw-strap-bottom"></div>',
      '</div>'
    ].join('');

    // ── Expanded overlay ──
    _el.overlay = document.createElement('div');
    _el.overlay.id = 'smart-watch-overlay';
    _el.overlay.className = 'smart-watch-overlay';
    _el.overlay.setAttribute('role', 'dialog');
    _el.overlay.setAttribute('aria-label', 'Smart Watch debrief feed');

    _el.overlay.innerHTML = [
      '<div class="sw-overlay-frame">',
        // Header
        '<div class="sw-overlay-header">',
          '<span class="sw-overlay-title">\u231a Smart Watch</span>',
          '<button class="sw-overlay-close" id="sw-close" aria-label="Close">\u2715</button>',
        '</div>',

        // Debrief feed viewport (4:3)
        '<div class="sw-debrief-viewport" id="sw-debrief-viewport">',
          '<div class="sw-mok-container" id="sw-mok-container"></div>',
        '</div>',

        // Audio controls panel
        '<div class="sw-audio-panel">',
          // Master mute
          '<div class="sw-audio-row">',
            '<span class="sw-audio-label">master</span>',
            '<button class="sw-mute-btn" id="sw-mute-btn">on</button>',
          '</div>',
          // Music volume
          '<div class="sw-audio-row" id="sw-music-row">',
            '<span class="sw-audio-label">music</span>',
            '<input type="range" class="sw-audio-slider" id="sw-music-slider" min="0" max="100" value="25">',
            '<span class="sw-audio-val" id="sw-music-val">25</span>',
          '</div>',
          // SFX volume
          '<div class="sw-audio-row" id="sw-sfx-row">',
            '<span class="sw-audio-label">sfx</span>',
            '<input type="range" class="sw-audio-slider" id="sw-sfx-slider" min="0" max="100" value="85">',
            '<span class="sw-audio-val" id="sw-sfx-val">85</span>',
          '</div>',
          // Now playing
          '<div class="sw-track-row" id="sw-track-row">',
            '<div class="sw-track-label">now</div>',
            '<div class="sw-track-title" id="sw-track-title">\u2014</div>',
            '<div class="sw-track-artist" id="sw-track-artist"></div>',
          '</div>',
        '</div>',
      '</div>'
    ].join('');

    document.body.appendChild(_el.widget);
    document.body.appendChild(_el.overlay);

    // Cache inner element refs
    _el.audioDot    = document.getElementById('sw-audio-dot');
    _el.closeBtn    = document.getElementById('sw-close');
    _el.viewport    = document.getElementById('sw-debrief-viewport');
    _el.mokContainer = document.getElementById('sw-mok-container');
    _el.muteBtn     = document.getElementById('sw-mute-btn');
    _el.musicSlider = document.getElementById('sw-music-slider');
    _el.sfxSlider   = document.getElementById('sw-sfx-slider');
    _el.musicVal    = document.getElementById('sw-music-val');
    _el.sfxVal      = document.getElementById('sw-sfx-val');
    _el.musicRow    = document.getElementById('sw-music-row');
    _el.sfxRow      = document.getElementById('sw-sfx-row');
    _el.trackTitle  = document.getElementById('sw-track-title');
    _el.trackArtist = document.getElementById('sw-track-artist');
  }

  // ═══════════════════════════════════════════════════════════════
  // EVENT HANDLING
  // ═══════════════════════════════════════════════════════════════

  function _setupEvents() {
    // Click to expand (only if not dragging)
    _el.widget.addEventListener('click', function (e) {
      if (!_state.isDragging) {
        _expand();
      }
      e.stopPropagation();
    });

    // Close button
    _el.closeBtn.addEventListener('click', function (e) {
      _minimize();
      e.stopPropagation();
    });

    // Background click to close
    _el.overlay.addEventListener('click', function (e) {
      if (e.target === _el.overlay) {
        _minimize();
      }
    });

    // Drag on minimized widget
    _setupDrag();

    // Keyboard: W to toggle, Escape to close
    document.addEventListener('keydown', function (e) {
      var tag = document.activeElement && document.activeElement.tagName;
      var editable = document.activeElement && document.activeElement.isContentEditable;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || editable) return;

      if (e.key === 'w' && !e.ctrlKey && !e.metaKey) {
        if (_state.expanded) {
          _minimize();
        } else if (_state.visible) {
          _expand();
        }
      }
      if (e.key === 'Escape' && _state.expanded) {
        _minimize();
      }
    });

    // Audio controls
    _el.muteBtn.addEventListener('click', function (e) {
      if (typeof AudioSystem !== 'undefined') {
        if (!AudioSystem._initialized) {
          AudioSystem.init();
          AudioSystem._initialized = true;
        }
        AudioSystem.toggleMute();
      }
      e.stopPropagation();
    });

    _el.musicSlider.addEventListener('input', function () {
      if (typeof AudioSystem !== 'undefined') {
        AudioSystem.setMusicVolume(Number(this.value));
      }
    });
    _el.musicSlider.addEventListener('pointerdown', function (e) { e.stopPropagation(); });

    _el.sfxSlider.addEventListener('input', function () {
      if (typeof AudioSystem !== 'undefined') {
        AudioSystem.setSFXVolume(Number(this.value));
      }
    });
    _el.sfxSlider.addEventListener('pointerdown', function (e) { e.stopPropagation(); });

    // Subscribe to AudioSystem state changes
    if (typeof AudioSystem !== 'undefined') {
      AudioSystem.onStateChange(_renderAudio);
    }

    // Viewport resize clamping
    window.addEventListener('resize', function () {
      if (!_state.initialized || !_el.widget) return;
      _clampPosition();
      _el.widget.style.left = _state.position.x + 'px';
      _el.widget.style.bottom = _state.position.y + 'px';
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // DRAG
  // ═══════════════════════════════════════════════════════════════

  function _setupDrag() {
    var widget = _el.widget;
    var startX, startY, initialX, initialY;

    widget.addEventListener('mousedown', dragStart);
    widget.addEventListener('touchstart', dragStart, { passive: false });

    function dragStart(e) {
      if (e.type === 'mousedown') {
        startX = e.clientX;
        startY = e.clientY;
      } else {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      }

      initialX = _state.position.x;
      initialY = _state.position.y;
      _state.isDragging = false;

      document.addEventListener('mousemove', drag);
      document.addEventListener('touchmove', drag, { passive: false });
      document.addEventListener('mouseup', dragEnd);
      document.addEventListener('touchend', dragEnd);
    }

    function drag(e) {
      var clientX, clientY;
      if (e.type === 'mousemove') {
        clientX = e.clientX;
        clientY = e.clientY;
      } else {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }

      var dx = clientX - startX;
      var dy = clientY - startY;

      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        _state.isDragging = true;
      }

      if (_state.isDragging) {
        // Position uses left/bottom (not right/bottom like compass)
        var widgetW = 44;
        var widgetH = 56;
        var vw = window.innerWidth;
        var vh = window.innerHeight;
        _state.position.x = Math.max(0, Math.min(initialX + dx, vw - widgetW));
        _state.position.y = Math.max(0, Math.min(initialY - dy, vh - widgetH));

        widget.style.left = _state.position.x + 'px';
        widget.style.bottom = _state.position.y + 'px';
        widget.style.right = 'auto';
        widget.style.top = 'auto';

        e.preventDefault();
      }
    }

    function dragEnd() {
      document.removeEventListener('mousemove', drag);
      document.removeEventListener('touchmove', drag);
      document.removeEventListener('mouseup', dragEnd);
      document.removeEventListener('touchend', dragEnd);

      if (_state.isDragging) {
        _savePosition();
        setTimeout(function () { _state.isDragging = false; }, 50);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // EXPAND / MINIMIZE
  // ═══════════════════════════════════════════════════════════════

  function _expand() {
    if (_state.expanded) return;
    _state.expanded = true;

    // Init AudioSystem on first interaction (user gesture requirement)
    if (typeof AudioSystem !== 'undefined' && !AudioSystem._initialized) {
      AudioSystem.init();
      AudioSystem._initialized = true;
    }

    // Dim the terminal's embedded debrief feed to avoid two competing feeds
    _setTerminalDebriefDimmed(true);

    // Render MOK pyramid into viewport
    _renderMOKPyramid();

    // Render audio controls state
    _renderAudio();

    // Show overlay
    _el.overlay.classList.add('open');

    // Setup MOK interaction (poke/spin/squish) in the overlay pyramid
    requestAnimationFrame(function () {
      _setupOverlayMOKInteraction();
    });
  }

  function _minimize() {
    if (!_state.expanded) return;
    _state.expanded = false;

    // Restore the terminal's embedded debrief feed
    _setTerminalDebriefDimmed(false);
    _el.overlay.classList.remove('open');

    // Clean up MOK pyramid (so it doesn't conflict with terminal's #mok-avatar)
    if (_el.mokContainer) {
      _el.mokContainer.innerHTML = '';
    }
    _state.mokInteractionBound = false;
  }

  // ═══════════════════════════════════════════════════════════════
  // TERMINAL DEBRIEF FEED COORDINATION
  // ═══════════════════════════════════════════════════════════════

  /**
   * Dim/restore the terminal's embedded debrief feed when the smart watch
   * overlay is open. This prevents two competing debrief feeds from being
   * interactive simultaneously and avoids state machine conflicts.
   * Cheap approach: CSS opacity + pointer-events. No state teardown needed,
   * so M console push notifications still target the terminal feed normally.
   */
  function _setTerminalDebriefDimmed(dimmed) {
    var debriefWindow = document.getElementById('debrief-window');
    if (!debriefWindow) return;
    if (dimmed) {
      debriefWindow.style.opacity = '0.3';
      debriefWindow.style.pointerEvents = 'none';
      debriefWindow.style.transition = 'opacity 0.2s ease';
    } else {
      debriefWindow.style.opacity = '';
      debriefWindow.style.pointerEvents = '';
      debriefWindow.style.transition = 'opacity 0.2s ease';
      // Clean up transition property after it completes
      setTimeout(function () {
        if (debriefWindow) debriefWindow.style.transition = '';
      }, 250);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // MOK PYRAMID RENDERING
  // ═══════════════════════════════════════════════════════════════

  function _renderMOKPyramid() {
    if (!_el.mokContainer) return;

    // Create a pyramid instance for the overlay (uses sw-mok-avatar ID to avoid
    // conflicting with the terminal's #mok-avatar)
    var html = [
      '<div id="sw-mok-avatar" class="mok-pyramid-loader mok-state-idle" role="button" tabindex="0" aria-label="MOK avatar">',
        '<div class="mok-pyramid-wrapper">',
          '<span class="mok-pyramid-side mok-side-1"></span>',
          '<span class="mok-pyramid-side mok-side-2"></span>',
          '<span class="mok-pyramid-side mok-side-3"></span>',
          '<span class="mok-pyramid-side mok-side-4"></span>',
          '<span class="mok-pyramid-shadow"></span>',
        '</div>',
      '</div>'
    ].join('');

    _el.mokContainer.innerHTML = html;
  }

  // ═══════════════════════════════════════════════════════════════
  // MOK INTERACTION (overlay-specific poke/spin/squish)
  // ═══════════════════════════════════════════════════════════════

  function _setupOverlayMOKInteraction() {
    var loader = document.getElementById('sw-mok-avatar');
    if (!loader || _state.mokInteractionBound) return;
    _state.mokInteractionBound = true;

    var wrapper = loader.querySelector('.mok-pyramid-wrapper');
    if (!wrapper) return;

    var POKE_CLASSES = ['mok-poke-down', 'mok-poke-up', 'mok-spin-burst',
                        'mok-dragging', 'mok-drag-release', 'mok-squish'];

    function clearPoke() {
      for (var i = 0; i < POKE_CLASSES.length; i++) {
        loader.classList.remove(POKE_CLASSES[i]);
      }
    }

    var pointerDown = false;
    var startX = 0, startY = 0;
    var dragActive = false;
    var dragAngle = 0;
    var lastTapTime = 0;
    var holdTimer = null;
    var pokeTimer = null;
    var DRAG_THRESHOLD = 8;
    var DOUBLE_TAP_MS = 350;
    var HOLD_MS = 400;

    function pokeFromTap(clientY) {
      var rect = loader.getBoundingClientRect();
      var midY = rect.top + rect.height / 2;
      clearPoke();
      void loader.offsetWidth;
      loader.classList.add(clientY < midY ? 'mok-poke-down' : 'mok-poke-up');
      if (pokeTimer) clearTimeout(pokeTimer);
      pokeTimer = setTimeout(clearPoke, 650);
    }

    function spinBurst() {
      clearPoke();
      void loader.offsetWidth;
      loader.classList.add('mok-spin-burst');
      if (pokeTimer) clearTimeout(pokeTimer);
      pokeTimer = setTimeout(clearPoke, 850);
    }

    function startSquish() {
      clearPoke();
      loader.classList.add('mok-squish');
    }

    function releaseSquish(clientY) {
      loader.classList.remove('mok-squish');
      pokeFromTap(clientY);
    }

    function startDrag() {
      dragActive = true;
      clearPoke();
      loader.classList.add('mok-dragging');
      var dragVar = loader.style.getPropertyValue('--mok-drag-y');
      dragAngle = dragVar ? (parseFloat(dragVar) || 0) : 0;
    }

    function moveDrag(clientX) {
      if (!dragActive) return;
      var dx = clientX - startX;
      var angle = dragAngle + (dx / 200) * 360;
      loader.style.setProperty('--mok-drag-y', angle.toFixed(1) + 'deg');
    }

    function endDrag(clientX) {
      if (!dragActive) return;
      dragActive = false;
      loader.classList.remove('mok-dragging');
      var dx = clientX - startX;
      var momentum = (dx / 200) * 360;
      var finalAngle = dragAngle + momentum + (momentum * 0.3);
      loader.style.setProperty('--mok-drag-y', finalAngle.toFixed(1) + 'deg');
      loader.classList.add('mok-drag-release');
      if (pokeTimer) clearTimeout(pokeTimer);
      pokeTimer = setTimeout(function () {
        clearPoke();
        loader.style.removeProperty('--mok-drag-y');
      }, 1300);
    }

    // Pointer handlers
    loader.addEventListener('pointerdown', function (ev) {
      if (ev.button && ev.button !== 0) return;
      pointerDown = true;
      startX = ev.clientX;
      startY = ev.clientY;
      dragActive = false;
      if (holdTimer) clearTimeout(holdTimer);
      holdTimer = setTimeout(function () {
        if (pointerDown && !dragActive) startSquish();
      }, HOLD_MS);
      try { loader.setPointerCapture(ev.pointerId); } catch (e) {}
      ev.preventDefault();
      ev.stopPropagation();
    });

    loader.addEventListener('pointermove', function (ev) {
      if (!pointerDown) return;
      var dx = Math.abs(ev.clientX - startX);
      var dy = Math.abs(ev.clientY - startY);
      if (!dragActive && (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD)) {
        if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
        loader.classList.remove('mok-squish');
        startDrag();
      }
      if (dragActive) {
        moveDrag(ev.clientX);
        ev.preventDefault();
      }
    }, { passive: false });

    loader.addEventListener('pointerup', function (ev) {
      if (!pointerDown) return;
      pointerDown = false;
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      if (loader.classList.contains('mok-squish')) {
        releaseSquish(ev.clientY);
        return;
      }
      if (dragActive) {
        endDrag(ev.clientX);
        return;
      }
      var now = Date.now();
      if (now - lastTapTime < DOUBLE_TAP_MS) {
        lastTapTime = 0;
        spinBurst();
      } else {
        lastTapTime = now;
        pokeFromTap(ev.clientY);
      }
    });

    loader.addEventListener('pointercancel', function () {
      pointerDown = false;
      dragActive = false;
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      clearPoke();
      loader.style.removeProperty('--mok-drag-y');
    });

    // Keyboard (Enter/Space)
    loader.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        ev.stopPropagation();
        if (loader.classList.contains('mok-poke-down') ||
            loader.classList.contains('mok-poke-up')) {
          spinBurst();
        } else {
          clearPoke();
          void loader.offsetWidth;
          loader.classList.add('mok-poke-down');
          if (pokeTimer) clearTimeout(pokeTimer);
          pokeTimer = setTimeout(clearPoke, 650);
        }
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // AUDIO RENDERING
  // ═══════════════════════════════════════════════════════════════

  function _renderAudio() {
    if (typeof AudioSystem === 'undefined') return;

    var muted = AudioSystem.getMasterMute();
    var musicVol = AudioSystem.getMusicVolume();
    var sfxVol = AudioSystem.getSFXVolume();
    var nowPlaying = AudioSystem.getNowPlaying();

    // Mute button
    if (_el.muteBtn) {
      _el.muteBtn.textContent = muted ? 'muted' : 'on';
      _el.muteBtn.classList.toggle('muted', muted);
    }

    // Sliders
    if (_el.musicSlider && document.activeElement !== _el.musicSlider) {
      _el.musicSlider.value = musicVol;
    }
    if (_el.musicVal) _el.musicVal.textContent = musicVol;
    if (_el.sfxSlider && document.activeElement !== _el.sfxSlider) {
      _el.sfxSlider.value = sfxVol;
    }
    if (_el.sfxVal) _el.sfxVal.textContent = sfxVol;

    // Disabled rows when muted
    if (_el.musicRow) _el.musicRow.classList.toggle('disabled', muted);
    if (_el.sfxRow) _el.sfxRow.classList.toggle('disabled', muted);

    // Track info
    if (_el.trackTitle) {
      _el.trackTitle.textContent = (nowPlaying && nowPlaying.title) ? nowPlaying.title : '\u2014';
    }
    if (_el.trackArtist) {
      _el.trackArtist.textContent = (nowPlaying && nowPlaying.artist) ? nowPlaying.artist : '';
    }

    // Mini audio dot on minimized widget
    if (_el.audioDot) {
      _el.audioDot.classList.toggle('muted', muted);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // POSITION PERSISTENCE
  // ═══════════════════════════════════════════════════════════════

  function _savePosition() {
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(_state.position));
    } catch (e) {}
  }

  function _loadPosition() {
    try {
      var saved = localStorage.getItem(POS_KEY);
      if (saved) {
        _state.position = JSON.parse(saved);
      }
    } catch (e) {}
    _clampPosition();
  }

  function _clampPosition() {
    var widgetW = 44;
    var widgetH = 56;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    _state.position.x = Math.max(0, Math.min(_state.position.x, vw - widgetW));
    _state.position.y = Math.max(0, Math.min(_state.position.y, vh - widgetH));
  }

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════

  return {
    init: init,
    expand: _expand,
    minimize: _minimize,
    isExpanded: function () { return _state.expanded; },
    isVisible: function () { return _state.visible; }
  };

})();

// Auto-initialize on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () {
    SmartWatchWidget.init();
  });
} else {
  SmartWatchWidget.init();
}
