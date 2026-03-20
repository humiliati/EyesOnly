/* ============================================================
   EYES ONLY - Debrief Feed Controller
   Manages MOK vs Resource Feed display based on game mode
   ============================================================ */

const DebriefFeedController = (function() {
  'use strict';

  /**
   * @typedef {Object} GameMode
   * @property {string} name - Mode name
   * @property {string} defaultDisplay - 'mok' or 'resources'
   * @property {boolean} allowCycle - Whether cycle button is shown
   * @property {boolean} videoOverride - Whether video takes priority
   */

  var _currentMode = null;
  var _currentDisplay = 'mok'; // 'mok', 'resources', or 'video'
  var _debriefScreen = null;
  var _mokInitialized = false;
  var _videoPlaying = false;
  var _videoUrl = null;     // URL of video being pushed
  var _videoTitle = null;   // Display title for video overlay
  var _videoPaused = false; // True when user manually paused via widget

  // Terminal-row interaction state (sticky highlight + sticky expand)
  var _rowExpanded = {}; // { rowId: boolean }
  var _highlightedRow = 'hp';

  /* ── Theme → Video + Audio mapping ────────────────────────────
     Each theme has a default drone video (webm preferred, mp4 fallback)
     and an associated audio track ID for sync playback.
     Video URLs mirror splash-screen.js VIDEO_SOURCES.
     Audio track IDs tag the <video> element for the audio system. */
  var THEME_VIDEO_MAP = {
    silver:   { webm: '/video/Sandpoint2_LakePendOreille.webm',       mp4: '/video/Sandpoint2_%20Lake%20Pend%20Oreille.mp4' },
    amber:    { webm: '/video/Sandpoint3_LakePendOreille.webm',       mp4: '/video/Sandpoint3_%20Lake%20Pend%20Oreille.mp4' },
    phosphor: { webm: '/video/Sandpoint_LakePendOreille.webm',        mp4: '/video/Sandpoint%20_%20Lake%20Pend%20Oreille.mp4' },
    panther:  { webm: '/video/Sandpoint1_SchweitzerMountain.webm',     mp4: '/video/Sandpoint1_%20Schweitzer%20Mountain%20Resort.mp4' }
  };
  var THEME_AUDIO_MAP = {
    silver:   'theme-silver',
    amber:    'theme-amber',
    phosphor: 'theme-phosphor',
    panther:  'theme-panther'
  };

  /**
   * Get the current theme's video sources {webm, mp4}.
   * Reads from body[data-theme] or localStorage fallback.
   */
  function _getThemeVideoSources() {
    var theme = _getCurrentThemeId();
    return THEME_VIDEO_MAP[theme] || null;
  }

  function _getCurrentThemeId() {
    var theme = document.body.getAttribute('data-theme') || 'phosphor';
    try { if (!theme || theme === 'null') theme = localStorage.getItem('eyesonly_theme') || 'phosphor'; } catch (_) {}
    return theme;
  }

  /**
   * Game mode configurations
   */
  var MODES = {
    goneRogue: {
      name: 'Gone Rogue',
      defaultDisplay: 'resources',
      allowCycle: true,
      videoOverride: false
    },
    streetChronicles: {
      name: 'Street Chronicles',
      defaultDisplay: 'mok',
      allowCycle: true,
      videoOverride: true
    },
    eyesOnlyARG: {
      name: 'EyesOnly ARG',
      defaultDisplay: 'mok',
      allowCycle: true,
      videoOverride: true
    },
    mainMenu: {
      name: 'Main Menu',
      defaultDisplay: 'mok',
      allowCycle: false,
      videoOverride: true
    }
  };

  /**
   * Initialize the controller
   */
  function init() {
    _debriefScreen = document.getElementById('debrief-screen');
    if (!_debriefScreen) {
      console.warn('[DebriefFeedController] Debrief screen not found');
      return;
    }

    // Detect initial game mode
    _currentMode = _detectGameMode();
    _currentDisplay = _currentMode.defaultDisplay;

    // Initialize display
    _render();

    // Idle symbol refresh: staggered interval so symbols subtly cycle
    // Uses 1200ms base — each symbol has a different idle frame length (4 frames × 600ms = 2400ms cycle)
    // so a 1200ms refresh catches every other idle frame transition, feeling organic
    _startIdleSymbolRefresh();

    // Adaptive letter-spacing: stretch/squeeze row text to fill frame width
    // Deferred so initial CSS layout has settled
    requestAnimationFrame(_applyAdaptiveSpacing);
    window.addEventListener('resize', _debounce(_applyAdaptiveSpacing, 150));
    // Also re-apply on orientation change (phone rotation)
    if (typeof screen !== 'undefined' && screen.orientation) {
      screen.orientation.addEventListener('change', function() {
        setTimeout(_applyAdaptiveSpacing, 200);
      });
    }

    // Portrait Gone Rogue: tap to expand/collapse debrief width; drag to resize
    _setupPortraitDebriefSizing();

    // Wire up debrief video controls widget
    _initVideoWidget();

    // Initialize the unified MOK state machine (CSS class driven)
    if (typeof MOKStateMachine !== 'undefined') {
      MOKStateMachine.init(document.getElementById('mok-avatar'));
    }

    // Deferred theme-video: derive from current theme, lowest-priority
    // Waits for init dust to settle before the CRT "clicks on"
    _scheduleThemeVideo();
  }

  function _debounce(fn, ms) {
    var timer = null;
    return function() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(fn, ms);
    };
  }

  /**
   * Adaptive letter-spacing: stretch characters to fill the debrief frame width
   * on wide viewports, squeeze them together (clamped at ~20% overlap) on narrow.
   *
   * Uses canvas measureText for accurate text width measurement (immune to
   * flex/overflow layout constraints that make scrollWidth unreliable).
   */
  var _measureCanvas = null;
  var _measureCtx = null;

  function _measureTextWidth(text, font) {
    if (!_measureCanvas) {
      _measureCanvas = document.createElement('canvas');
      _measureCtx = _measureCanvas.getContext('2d');
    }
    _measureCtx.font = font;
    return _measureCtx.measureText(text).width;
  }

  function _applyAdaptiveSpacing() {
    try {
      var dbScreen = document.getElementById('debrief-screen');
      if (!dbScreen) return;
      var frameW = dbScreen.clientWidth;
      if (!frameW || frameW < 20) return;

      // Get all summary spans and panel lines
      var els = dbScreen.querySelectorAll('.debrief-row-summary, .debrief-row-panel .debrief-line');
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        var text = el.textContent || '';
        var charCount = text.length;
        if (charCount < 2) { el.style.letterSpacing = ''; continue; }

        // Get the computed font for accurate canvas measurement
        var cs = getComputedStyle(el);
        var fontSize = parseFloat(cs.fontSize) || 13;
        var font = cs.fontWeight + ' ' + fontSize + 'px ' + cs.fontFamily;

        // Measure the true natural width of the text (no layout constraints)
        var naturalW = _measureTextWidth(text, font);
        if (naturalW <= 0) continue;

        // Determine the available width this element should fill
        var availableW;
        if (el.classList.contains('debrief-row-summary')) {
          // Summary spans: fill from after the label to the row's right edge
          var navRow = el.closest('.debrief-nav-row');
          if (navRow) {
            var rowW = navRow.clientWidth;
            var label = navRow.querySelector('.debrief-row-label');
            var labelW = label ? label.offsetWidth : 0;
            var rowPad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) || 0;
            availableW = rowW - labelW - rowPad - 4; // 4px breathing room
          } else {
            availableW = frameW - 8;
          }
        } else {
          // Panel sub-lines: fill the panel's content width
          var parentPanel = el.closest('.debrief-row-panel');
          availableW = parentPanel ? (parentPanel.clientWidth - 6) : (frameW - 8);
        }

        if (availableW <= 0) continue;

        // Compute per-gap letter-spacing to make text fill available width
        var extraSpace = availableW - naturalW;
        var spacingPx = extraSpace / (charCount - 1);

        // Clamp: min = -0.08em (~20% char overlap), max = 0.5em (readable spread)
        var minSpacing = -0.08 * fontSize;
        var maxSpacing = 0.5 * fontSize;
        spacingPx = Math.max(minSpacing, Math.min(maxSpacing, spacingPx));

        el.style.letterSpacing = spacingPx.toFixed(2) + 'px';
      }
    } catch (e) {}
  }

  var _idleRefreshTimer = null;

  function _startIdleSymbolRefresh() {
    if (_idleRefreshTimer) clearInterval(_idleRefreshTimer);
    _idleRefreshTimer = setInterval(function() {
      // Only refresh if we're in resources display mode (not MOK or video)
      if (_currentDisplay !== 'resources') return;
      // Lightweight: update only the summary spans (no full re-render)
      _refreshSummarySymbols();
    }, 1200);
  }

  /**
   * Lightweight refresh: update only the macro summary text content
   * so idle symbols cycle without expensive full DOM rebuild.
   * Avoids full _renderResources() which would tear down + rebuild DOM + re-wire handlers.
   */
  function _refreshSummarySymbols() {
    try {
      if (!_debriefScreen || _currentDisplay !== 'resources') return;

      // Check if the structure exists (summary spans are in the DOM)
      var rSum = document.getElementById('debrief-summary-resources');
      if (!rSum) return; // structure not built yet

      // RESOURCE_SYMBOLS + _getSymbol + _renderBarLine are defined inside _renderResources
      // scope. To avoid duplicating them, we use a shared reference on the controller object.
      if (!DebriefFeedController._idleRender) return;
      DebriefFeedController._idleRender();
      // Re-apply spacing in case text changed (symbol cycle changes char count)
      _applyAdaptiveSpacing();
    } catch (e) {}
  }

  var _nav = {
    bound: false,
    highlighted: 0,
    startY: 0,
    dragging: false,
    lastExpanded: 'resources'
  };

  function _setupDragNav() {
    if (_nav.bound) return;
    var content = document.getElementById('debrief-resources-content');
    if (!content) return;

    _nav.bound = true;

    try {
      var raw = localStorage.getItem('EYESONLY_DEBRIEF_LAST_EXPANDED_V1');
      if (raw) _nav.lastExpanded = raw;
    } catch (e0) {}

    function rows() {
      return Array.prototype.slice.call(document.querySelectorAll('#debrief-nav-list .debrief-nav-row'));
    }

    function setHighlight(idx) {
      var r = rows();
      idx = Math.max(0, Math.min(r.length - 1, idx));
      _nav.highlighted = idx;
      for (var i = 0; i < r.length; i++) {
        r[i].classList.toggle('highlighted', i === idx);
      }
    }

    function showSection(sectionId) {
      // toggle: keep list visible; reveal selected section under it
      var ids = ['resources','battery','passives','api','mok'];

      var willExpand = true;
      try {
        var currentEl = document.getElementById('debrief-sec-' + sectionId);
        willExpand = !(currentEl && currentEl.style.display !== 'none');
      } catch (e0) { willExpand = true; }

      for (var i = 0; i < ids.length; i++) {
        var el = document.getElementById('debrief-sec-' + ids[i]);
        if (!el) continue;
        if (ids[i] === sectionId) {
          el.style.display = willExpand ? 'block' : 'none';
        } else {
          el.style.display = 'none';
        }
      }

      if (willExpand) {
        _nav.lastExpanded = sectionId;
        try {
          localStorage.setItem('EYESONLY_DEBRIEF_LAST_EXPANDED_V1', sectionId);
        } catch (e0) {}
      }
    }

    // initial
    setHighlight(0);
    showSection(_nav.lastExpanded || 'resources');

    var navList = document.getElementById('debrief-nav-list');
    if (!navList) return;

    navList.addEventListener('pointerdown', function(e) {
      if (_currentMode !== MODES.goneRogue) return;
      if (_currentDisplay !== 'resources') return;
      if (!e) return;
      _nav.startY = e.clientY;
      _nav.dragging = false;
      try { navList.setPointerCapture(e.pointerId); } catch (e2) {}
      e.preventDefault();
    });

    navList.addEventListener('pointermove', function(e) {
      if (!e) return;
      if (_currentDisplay !== 'resources') return;
      var dy = e.clientY - _nav.startY;
      if (Math.abs(dy) < 10) return;
      _nav.dragging = true;
      var step = Math.round(dy / 34);
      setHighlight(0 + step);
      e.preventDefault();
    }, { passive: false });

    navList.addEventListener('pointerup', function() {
      if (_currentDisplay !== 'resources') return;
      if (!_nav.dragging) {
        // no drag: select highlighted row
        var r0 = rows();
        var row0 = r0[_nav.highlighted];
        var sid0 = row0 ? row0.dataset.section : null;
        showSection(sid0 || _nav.lastExpanded || 'resources');
        return;
      }
      var r = rows();
      var row = r[_nav.highlighted];
      var sectionId = row ? row.dataset.section : null;
      showSection(sectionId || _nav.lastExpanded || 'resources');
      _nav.dragging = false;
    });

    // Click row to select (desktop)
    document.addEventListener('click', function(e) {
      if (_currentDisplay !== 'resources') return;
      var t = e && e.target;
      if (!t || !t.closest) return;
      var row = t.closest('#debrief-nav-list .debrief-nav-row');
      if (!row) return;
      var sid = row.dataset.section;
      if (sid) showSection(sid);
    });
  }

  function _setupPortraitDebriefSizing() {
    var win = document.getElementById('debrief-window');
    if (!win || win._portraitSizingBound) return;
    win._portraitSizingBound = true;

    var body = document.body;
    var PREF_KEY = 'EYESONLY_ROGUE_PORTRAIT_DEBRIEF_PCT_V1';

    function _isRogue() {
      return body.classList.contains('mode-gone-rogue') || body.classList.contains('in-gone-rogue') || body.classList.contains('gone-rogue-active');
    }

    // ── Debrief width (portrait torso split) ──
    var DEFAULT_PCT = 35;

    function _applyPct(pct) {
      pct = Math.max(25, Math.min(55, Number(pct || DEFAULT_PCT)));
      try {
        body.style.setProperty('--rogue-debrief-pct', pct + '%');
        localStorage.setItem(PREF_KEY, String(pct));
      } catch (e) {}
    }

    // Load saved width (or use sensible default)
    try {
      var saved = Number(localStorage.getItem(PREF_KEY));
      if (isFinite(saved) && saved >= 25) _applyPct(saved);
      else _applyPct(DEFAULT_PCT);
    } catch (e) { _applyPct(DEFAULT_PCT); }

    var label = win.querySelector('.debrief-label');
    if (!label) return;

    // ── Two-state toggle: normal ↔ maximized ──
    // 'normal'    = default % width, regular z-index
    // 'maximized' = full overlay, z-index 700, position fixed
    var _debriefState = 'normal';

    // Detect initial state from class
    if (win.classList.contains('debrief-maximized')) _debriefState = 'maximized';
    // Clean up any legacy minimized class
    win.classList.remove('debrief-minimized');
    body.classList.remove('rogue-debrief-minimized');

    function _setDebriefState(state) {
      _debriefState = state;
      win.classList.remove('debrief-minimized', 'debrief-maximized');
      body.classList.remove('rogue-debrief-minimized');

      if (state === 'maximized') {
        win.classList.add('debrief-maximized');
        // Listen for background taps to dismiss
        _addBackgroundDismiss();
        try { window.dispatchEvent(new CustomEvent('debrief:maximized')); } catch (e) {}
      } else {
        // normal — restore default width, clear any drag-zoom override
        _applyPct(DEFAULT_PCT);
        win.style.removeProperty('--debrief-zoom');
        _removeBackgroundDismiss();
        try { window.dispatchEvent(new CustomEvent('debrief:restored')); } catch (e) {}
      }
    }

    // ── Background tap to dismiss maximized debrief ──
    // When maximized, tapping anything OUTSIDE the debrief-window returns to normal.
    function _onBackgroundTap(ev) {
      if (_debriefState !== 'maximized') return;
      // Walk up from target: if inside debrief-window, ignore
      var el = ev.target;
      while (el) {
        if (el === win) return; // tap was inside debrief — don't dismiss
        el = el.parentElement;
      }
      // Tap was on background — dismiss
      _setDebriefState('normal');
    }

    function _addBackgroundDismiss() {
      // Use capture phase + slight delay so the maximizing click doesn't
      // immediately dismiss
      setTimeout(function() {
        if (_debriefState === 'maximized') {
          document.addEventListener('pointerdown', _onBackgroundTap, true);
        }
      }, 200);
    }

    function _removeBackgroundDismiss() {
      document.removeEventListener('pointerdown', _onBackgroundTap, true);
    }

    // Expose state setter for video system and external callers
    DebriefFeedController._setDebriefState = _setDebriefState;
    DebriefFeedController._getDebriefState = function() { return _debriefState; };

    // ── Tap/drag detection on debrief header ──
    var _dragMoved = false;
    var _tapStartX = 0;
    var _tapStartY = 0;
    var _dragging = false;

    // ── Maximized-state drag: vertical drag on label changes zoom level ──
    var _maxDragStartY = 0;
    var _maxDragStartZoom = 1.35;
    var ZOOM_MIN = 1.0;   // normal = no zoom (back to normal state effectively)
    var ZOOM_MAX = 2.0;   // max zoom
    var MAX_DRAG_THRESHOLD = 8;

    function _onMaxDragMove(ev) {
      if (!_dragging) return;
      var dy = ev.clientY - _maxDragStartY;
      if (Math.abs(dy) < MAX_DRAG_THRESHOLD && !_dragMoved) return;
      _dragMoved = true;

      // Dragging down = zoom in; dragging up = zoom out
      var h = window.innerHeight || 1;
      var delta = (dy / (h * 0.3)) * (ZOOM_MAX - ZOOM_MIN);
      var newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, _maxDragStartZoom + delta));
      win.style.setProperty('--debrief-zoom', newZoom.toFixed(3));

      ev.preventDefault();
    }

    function _onMaxDragUp() {
      _dragging = false;
      document.removeEventListener('pointermove', _onMaxDragMove);
      document.removeEventListener('pointerup', _onMaxDragUp);
      document.removeEventListener('pointercancel', _onMaxDragUp);

      // If user dragged zoom below threshold, snap back to normal
      var currentZoom = parseFloat(win.style.getPropertyValue('--debrief-zoom')) || 1.35;
      if (currentZoom <= 1.05) {
        _setDebriefState('normal');
      }
    }

    label.addEventListener('pointerdown', function(ev) {
      // Don't intercept clicks on video/audio control buttons —
      // preventDefault on pointerdown suppresses the click event those
      // buttons rely on (the data-sound fires on pointerdown so it
      // still plays, masking the fact that click never fires).
      if (ev.target.closest('.video-controls-inline') ||
          ev.target.closest('.audio-controls-inline')) {
        return;
      }

      _tapStartX = ev.clientX || 0;
      _tapStartY = ev.clientY || 0;
      _dragMoved = false;

      // Only enable drag-to-zoom in maximized state
      if (_debriefState === 'maximized') {
        _dragging = true;
        _maxDragStartY = ev.clientY;
        _maxDragStartZoom = parseFloat(win.style.getPropertyValue('--debrief-zoom'))
          || parseFloat(getComputedStyle(win).getPropertyValue('--debrief-zoom'))
          || 1.35;
        try { label.setPointerCapture(ev.pointerId); } catch (e) {}
        document.addEventListener('pointermove', _onMaxDragMove, { passive: false });
        document.addEventListener('pointerup', _onMaxDragUp);
        document.addEventListener('pointercancel', _onMaxDragUp);
      }
      ev.preventDefault();
    });

    label.addEventListener('pointermove', function(ev) {
      var dx = Math.abs((ev.clientX || 0) - _tapStartX);
      var dy = Math.abs((ev.clientY || 0) - _tapStartY);
      if (dx > 6 || dy > 6) _dragMoved = true;
    });

    // ── Tap label: only EXPAND (normal → maximized) ──
    // Dismissing back to normal is exclusively via background tap or
    // double-tap escape hatch. This prevents accidental close when
    // interacting with feed content.
    label.addEventListener('click', function(ev) {
      if (_dragMoved) return;
      // Don't maximise when clicking video/audio controls
      if (ev.target.closest('.video-controls-inline') ||
          ev.target.closest('.audio-controls-inline')) {
        return;
      }

      if (_debriefState === 'normal') {
        _setDebriefState('maximized');
      }
      // If already maximized, do nothing — background tap dismisses
    });

    // Double-tap on label always restores to normal (escape hatch)
    label.addEventListener('dblclick', function(ev) {
      _setDebriefState('normal');
    });
  }

  /**
   * Detect current game mode
   * @returns {GameMode}
   */
  function _detectGameMode() {
    var body = document.body;

    // Check for Gone Rogue mode
    if (body.classList.contains('mode-gone-rogue') ||
        body.classList.contains('in-gone-rogue')) {
      return MODES.goneRogue;
    }

    // Check for Street Chronicles (placeholder check)
    if (body.classList.contains('mode-street-chronicles')) {
      return MODES.streetChronicles;
    }

    // Check for EyesOnly ARG (placeholder check)
    if (body.classList.contains('mode-eyesonly-arg')) {
      return MODES.eyesOnlyARG;
    }

    // Default to main menu
    return MODES.mainMenu;
  }

  /**
   * Render current display
   */
  function _render() {
    if (!_debriefScreen) return;

    // Check for video override
    if (_videoPlaying && _currentMode.videoOverride) {
      _currentDisplay = 'video';
      _renderVideo();
      return;
    }

    // Render based on current display mode
    if (_currentDisplay === 'mok') {
      _renderMOK();
    } else if (_currentDisplay === 'resources') {
      _renderResources();
    }
  }

  /**
   * Render MOK display
   */
  function _renderMOK() {
    var html = '<div class="debrief-mok-display">';

    // MOK 3D Pyramid Avatar (replaces old MOKVisualEngine flat triangle)
    html += '<div id="mok-avatar" class="mok-pyramid-loader mok-state-idle" role="button" tabindex="0" aria-label="MOK avatar">';
    html += '<div class="mok-pyramid-wrapper">';
    html += '<span class="mok-pyramid-side mok-side-1"></span>';
    html += '<span class="mok-pyramid-side mok-side-2"></span>';
    html += '<span class="mok-pyramid-side mok-side-3"></span>';
    html += '<span class="mok-pyramid-side mok-side-4"></span>';
    html += '<span class="mok-pyramid-shadow"></span>';
    html += '</div></div>';

    // Kernel API status (if in Gone Rogue)
    if (_currentMode === MODES.goneRogue) {
      html += _renderKernelStatus();
    }

    // Cycle button (if allowed)
    if (_currentMode.allowCycle) {
      html += _renderCycleButton('Show Resources');
    }

    html += '</div>';

    _debriefScreen.innerHTML = html;

    // The 3D pyramid is driven by CSS classes via MOKStateMachine, mok-ux.js, and kernel-manager.js.
    // MOKVisualEngine is deprecated — expression/glow APIs now route through CSS custom properties.
    _mokInitialized = true;

    _attachEventHandlers();
  }

  /**
   * Render resources display
   */
  function _renderResources() {
    var html = '<div class="debrief-resources-display">';
    html += '<div id="debrief-synergy-overlay" class="debrief-synergy-overlay" aria-hidden="true"></div>';

      // NOTE: In Gone Rogue, MOK selection is handled by the [Mok] row.
      // Do not render the old MOK capsule / cycle button header here.

      // ASCII/Pip-boy style rows (terminal lines)
      function abbrKeepFirst(s) {
        s = String(s || '');
        if (!s) return '';

        // Desktop: prefer full labels (instant legibility).
        try {
          if (typeof window !== 'undefined' && window.innerWidth >= 900) {
            return s.toUpperCase();
          }
        } catch (e0) {}

        // Compact mode (mobile / narrow): abbreviate.
        var first = s.charAt(0).toUpperCase();
        var rest = s.slice(1).toLowerCase().replace(/[aeiou]/g, '');
        return first + rest;
      }

      // Monochrome expand/collapse arrow: '>' collapsed, 'v' expanded
      function _arrowLabel(rowId, fallbackLabel) {
        var expanded = !!_rowExpanded[rowId];
        // Resource/ammo rows use arrow only; non-resource rows use abbreviated label
        var isResourceRow = (rowId === 'resources' || rowId === 'ammo');
        if (isResourceRow) {
          return expanded ? 'v' : '>';
        }
        // Non-resource rows: arrow + vowel-dropped abbreviation
        return (expanded ? 'v' : '>') + abbrKeepFirst(fallbackLabel);
      }

      html += '<div id="debrief-resources-content" class="debrief-resources-content">';
      html +=   '<div class="debrief-nav-list" id="debrief-nav-list" aria-label="Debrief rows">';

      function row(rowId, label, summaryId, extraCls) {
        extraCls = extraCls || '';
        var s = '';
        s += '<div class="debrief-nav-row ' + extraCls + '" data-row="' + rowId + '">';
        s +=   '<span class="debrief-row-label">' + (label || '') + '</span>';
        s +=   '<span class="debrief-row-summary" id="' + summaryId + '"></span>';
        s += '</div>';
        s += '<div class="debrief-row-panel" id="debrief-panel-' + rowId + '" style="display:none"></div>';
        return s;
      }

      // Macro rows — arrows replace bracketed category titles
      html += row('resources', _arrowLabel('resources', 'resources'), 'debrief-summary-resources', 'row-resources');
      html += row('ammo', _arrowLabel('ammo', 'ammo'), 'debrief-summary-ammo', 'row-ammo');
      // signal row header is the battery-ascii pulse; label hidden in CSS
      html += row('signal', '', 'debrief-summary-signal', 'row-signal');
      html += row('passives', _arrowLabel('passives', 'passives'), 'debrief-summary-passives', 'row-passives');
      html += row('status', _arrowLabel('status', 'status'), 'debrief-summary-status', 'row-status');
      html += row('mok', _arrowLabel('mok', 'mok'), 'debrief-summary-mok', 'row-mok');
      html += row('api', _arrowLabel('api', 'api'), 'debrief-summary-api', 'row-api');
      html += row('accessibility', _arrowLabel('accessibility', 'accessibility'), 'debrief-summary-accessibility', 'row-accessibility');

      html +=   '</div>';
      html += '</div>';
      html += '</div>';

      _debriefScreen.innerHTML = html;

      // Sticky row expansion/highlight state
      if (!_rowExpanded) _rowExpanded = {};
      if (!_highlightedRow) _highlightedRow = 'resources';

      function _setPanelVisible(rowId, on) {
        var panel = document.getElementById('debrief-panel-' + rowId);
        if (!panel) return;
        panel.style.display = on ? 'block' : 'none';
      }

      function _applyHighlight() {
        try {
          var rows = document.querySelectorAll('.debrief-nav-row[data-row]');
          rows.forEach(function(r) {
            var rid = r.getAttribute('data-row');
            if (rid === _highlightedRow) r.classList.add('highlighted');
            else r.classList.remove('highlighted');
          });
        } catch (eH0) {}
      }

      // Monochrome symbol definitions per resource (idle, up, down cycles)
      var RESOURCE_SYMBOLS = {
        hp:      { glyph: '♥', idle: ['♥','♥','❣','♥'], up: ['♥','❣','❤'], down: ['❣','♥','❢'] },
        energy:  { glyph: '△', idle: ['△','◬','△','◬'], up: ['◬','◮'], down: ['◬','◭'] },
        focus:   { glyph: '◎', idle: ['◎','◉','◎','◉'], up: ['◎','◉'], down: ['◉','◎'] },
        fatigue: { glyph: 'Ȫ', idle: ['Ȫ','Ȫ','ȫ','Ȫ'], up: ['Ȫ','ȫ'], down: ['ȫ','Ȫ'] },
        ammo:    { glyph: '⁍', idle: ['⁍','⁍','⁌','⁍'], up: ['⁍','⁌'], down: ['⁌','⁍'] },
        battery: { glyph: '◈', idle: ['◈','◈','◇','◈'], up: ['◇','◈'], down: ['◈','◇'] }
      };

      // Per-resource row colors (from RESOURCE_COLOR_SYSTEM.md)
      var ROW_COLORS = {
        hp: '#FF6B9D', energy: '#00D4FF', focus: '#FFF9B0',
        fatigue: '#A0522D', ammo: '#DA70D6', battery: '#00FFA6'
      };

      // Resource-change animation tracking (set by reportResourceChange)
      if (!DebriefFeedController._animStates) DebriefFeedController._animStates = {};
      var _animStates = DebriefFeedController._animStates;

      // Stagger idle symbols: each resource gets a per-key time offset
      // so they don't all tick at the exact same moment — feels organic
      var IDLE_OFFSETS = { hp: 0, energy: 200, focus: 400, fatigue: 600, ammo: 150, battery: 350 };

      function _getSymbol(resKey) {
        var sym = RESOURCE_SYMBOLS[resKey];
        if (!sym) return '';
        var anim = _animStates[resKey];
        if (anim && anim.frames && anim.idx < anim.frames.length) {
          var ch = anim.frames[anim.idx];
          anim.idx++;
          if (anim.idx >= anim.frames.length) delete _animStates[resKey];
          return ch;
        }
        // Idle: cycle based on timestamp with per-resource stagger offset
        var IDLE_FRAME_MS = 600;
        var offset = (IDLE_OFFSETS && IDLE_OFFSETS[resKey]) || 0;
        var tick = Math.floor((Date.now() + offset) / IDLE_FRAME_MS) % sym.idle.length;
        return sym.idle[tick];
      }

      function _renderBarLine(resKey, cur, max, w) {
        // Pip-boy format: SYMBOL VALUE███▒░░ (numerator only, no name)
        w = w || 10;
        max = (typeof max === 'number' && max > 0) ? max : 1;
        cur = (typeof cur === 'number') ? cur : 0;
        cur = Math.max(0, Math.min(max, cur));
        var numStr = String(Math.ceil(cur)).padStart(2, '0');
        var ratio = (cur / max) * w;
        var fullBlocks = Math.floor(ratio);
        var partial = ratio - fullBlocks;
        var bar = '█'.repeat(fullBlocks);
        if (partial >= 0.25 && fullBlocks < w) { bar += '▒'; fullBlocks++; }
        bar += '░'.repeat(Math.max(0, w - bar.length));

        var sym = _getSymbol(resKey);
        return sym + ' ' + numStr + bar;
      }

      /**
       * Render battery diamond bar: (((◈◈◈◇◇)))
       * @param {number} cur - current battery (0-100)
       * @param {number} max - max battery (100)
       * @returns {string} formatted diamond display
       */
      function _renderBatteryDiamonds(cur, max) {
        max = max || 100;
        cur = Math.max(0, Math.min(max, cur || 0));
        var diamonds = 5;
        var filled = Math.round((cur / max) * diamonds);
        return '◈'.repeat(filled) + '◇'.repeat(diamonds - filled);
      }

      function _getRoguePlayer() {
        try {
          if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.getPlayer === 'function') return GoneRogue.getPlayer();
        } catch (eP0) {}
        return null;
      }

      function _getState() {
        // Merge GAMESTATE + rogue player so debrief never shows "undefined".
        var st = {};
        try {
          if (typeof GAMESTATE !== 'undefined' && GAMESTATE.getState) st = GAMESTATE.getState() || {};
        } catch (eS0) {}

        try {
          var p = _getRoguePlayer();
          if (p) {
            if (typeof p.hp === 'number') st.hp = p.hp;
            if (typeof p.maxHp === 'number') st.maxHp = p.maxHp;
            if (typeof p.energy === 'number') st.energy = p.energy;
            if (typeof p.maxEnergy === 'number') st.maxEnergy = p.maxEnergy;
            if (typeof p.focus === 'number') st.focus = p.focus;
            if (typeof p.maxFocus === 'number') st.maxFocus = p.maxFocus;
          }
        } catch (eS1) {}

        // Fatigue: read from GAMESTATE directly (playerFatigue → fatigue alias)
        try {
          if (typeof GAMESTATE !== 'undefined') {
            if (GAMESTATE.getFatigue) st.fatigue = GAMESTATE.getFatigue();
            if (GAMESTATE.getMaxFatigue) st.maxFatigue = GAMESTATE.getMaxFatigue();
          }
        } catch (eF0) {}

        // Battery: read from GAMESTATE directly
        try {
          if (typeof GAMESTATE !== 'undefined') {
            if (GAMESTATE.getBattery) st.battery = GAMESTATE.getBattery();
            if (GAMESTATE.getMaxBattery) st.maxBattery = GAMESTATE.getMaxBattery();
          }
        } catch (eB0) {}

        // Hard defaults
        if (typeof st.hp !== 'number') st.hp = 0;
        if (typeof st.maxHp !== 'number') st.maxHp = Math.max(1, st.hp);
        if (typeof st.energy !== 'number') st.energy = 0;
        if (typeof st.maxEnergy !== 'number') st.maxEnergy = Math.max(1, st.energy);
        if (typeof st.focus !== 'number') st.focus = 0;
        if (typeof st.maxFocus !== 'number') st.maxFocus = Math.max(1, st.focus);
        if (typeof st.fatigue !== 'number') st.fatigue = 0;
        if (typeof st.maxFatigue !== 'number') st.maxFatigue = 100;
        if (typeof st.battery !== 'number') st.battery = 60;
        if (typeof st.maxBattery !== 'number') st.maxBattery = 100;

        return st;
      }

      // Register a lightweight idle-render function that only updates textContent
      // of existing summary spans (no DOM rebuild, no event re-wiring)
      DebriefFeedController._idleRender = function() {
        try {
          var st2 = _getState();
          var rS = document.getElementById('debrief-summary-resources');
          if (rS) rS.textContent = _renderBarLine('hp', st2.hp, st2.maxHp, 10);

          var aS = document.getElementById('debrief-summary-ammo');
          if (aS) {
            var am = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getAmmo) ? GAMESTATE.getAmmo() : (st2.ammo || 0);
            var mxA = st2.maxAmmo || 20;
            var txt = _renderBarLine('ammo', am, mxA, 10);
            try {
              var kcI = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getKeyCounts) ? GAMESTATE.getKeyCounts() : null;
              var kT = 0;
              if (kcI && kcI.ammo) { for (var kb in kcI.ammo) { if (kcI.ammo.hasOwnProperty(kb)) kT += (kcI.ammo[kb] || 0); } }
              if (kT > 0) txt += ' 🝯' + kT;
            } catch (eKI) {}
            aS.textContent = txt;
          }

          // Also update expanded panel lines if visible
          var rP = document.getElementById('debrief-panel-resources');
          if (rP && _rowExpanded.resources) {
            var enLines = rP.querySelectorAll('.debrief-line.energy');
            var fcLines = rP.querySelectorAll('.debrief-line.focus');
            var ftLines = rP.querySelectorAll('.debrief-line.fatigue');
            if (enLines.length) enLines[0].textContent = _renderBarLine('energy', st2.energy, st2.maxEnergy, 10);
            if (fcLines.length) fcLines[0].textContent = _renderBarLine('focus', st2.focus, st2.maxFocus, 10);
            if (ftLines.length) ftLines[0].textContent = _renderBarLine('fatigue', st2.fatigue, st2.maxFatigue, 10);
          }
        } catch (eIdle) {}
      };

      // Summaries + panels
      try {
        var st = _getState();

        // Resources macro summary: show HP bar (critical, no name) — colored
        var rSum = document.getElementById('debrief-summary-resources');
        if (rSum) {
          rSum.textContent = _renderBarLine('hp', st.hp, st.maxHp, 10);
          rSum.style.color = ROW_COLORS.hp || '';
        }

        // Resources panel: Energy + Focus + Fatigue lines (HP already shown in macro summary)
        var rPanel = document.getElementById('debrief-panel-resources');
        if (rPanel && _rowExpanded.resources) {
          var enLine = _renderBarLine('energy', st.energy, st.maxEnergy, 10);
          var fcLine = _renderBarLine('focus', st.focus, st.maxFocus, 10);
          var ftLine = _renderBarLine('fatigue', st.fatigue, st.maxFatigue, 10);

          rPanel.innerHTML =
            '<div class="debrief-line energy resource-row" data-resource="Energy" style="color:' + (ROW_COLORS.energy || '') + '">' + enLine + '</div>' +
            '<div class="debrief-line focus resource-row" data-resource="Focus" style="color:' + (ROW_COLORS.focus || '') + '">' + fcLine + '</div>' +
            '<div class="debrief-line fatigue resource-row" data-resource="Fatigue" style="color:' + (ROW_COLORS.fatigue || '') + '">' + ftLine + '</div>';
        } else if (rPanel) {
          rPanel.textContent = '';
        }

        // Ammo macro summary: ammo bar + key ammo count (always visible)
        var amEl = document.getElementById('debrief-summary-ammo');
        if (amEl) {
          var ammo = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getAmmo) ? GAMESTATE.getAmmo() : (st.ammo || 0);
          var maxA = st.maxAmmo || 20;
          var ammoText = _renderBarLine('ammo', ammo, maxA, 10);
          // Append key ammo count to the macro summary (always visible)
          try {
            var kcMacro = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getKeyCounts) ? GAMESTATE.getKeyCounts() : null;
            var keyTotal = 0;
            if (kcMacro && kcMacro.ammo) {
              for (var kBucket in kcMacro.ammo) {
                if (kcMacro.ammo.hasOwnProperty(kBucket)) keyTotal += (kcMacro.ammo[kBucket] || 0);
              }
            }
            if (keyTotal > 0) ammoText += ' 🝯' + keyTotal;
          } catch (eKM) {}
          amEl.textContent = ammoText;
          amEl.style.color = ROW_COLORS.ammo || '';
        }

        // Ammo panel: key_ammo/key_items (ammo bar already in macro summary)
        var aPanel = document.getElementById('debrief-panel-ammo');
        if (aPanel && _rowExpanded.ammo) {
          var linesA = [];

          // Key ammo row (ammo bar is already the macro summary — no duplicate)
          var kc = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getKeyCounts) ? GAMESTATE.getKeyCounts() : null;
          var keyParts = [];
          function addKeyPart(glyph, bucket, keyType) {
            try {
              var n = kc && kc[bucket] && kc[bucket][keyType] ? kc[bucket][keyType] : 0;
              if (n > 0) keyParts.push(glyph + 'x' + n);
            } catch (e0) {}
          }
          addKeyPart('🝯', 'ammo', 'RUSTY_KEY');
          addKeyPart('🔑', 'ammo', 'BRONZE_KEY');
          addKeyPart('💳', 'gate', 'KEYCARD');
          addKeyPart('🏷', 'gate', 'MALL_KEY');
          // Always show key ammo row — display "🝯0" if no keys yet
          var keyText = keyParts.length > 0 ? keyParts.join(' ') : '🝯0';
          linesA.push('<div class="debrief-line key-ammo resource-row" data-resource="key_ammo">' + keyText + '</div>');

          aPanel.innerHTML = linesA.join('');
        } else if (aPanel) {
          aPanel.textContent = '';
        }
      } catch (eS1) {}

      // Passives summary + panel
      try {
        var pEl = document.getElementById('debrief-summary-passives');
        if (pEl) {
          var eq = (typeof PassiveItemsSystem !== 'undefined' && PassiveItemsSystem.getEquippedPassives) ? PassiveItemsSystem.getEquippedPassives() : [];
          var sym = '';
          for (var i = 0; i < Math.min(6, (eq || []).length); i++) sym += '+';
          pEl.textContent = sym || '—';

          var pPanel = document.getElementById('debrief-panel-passives');
          if (pPanel && _rowExpanded.passives) {
            var lines = [];
            for (var j = 0; j < (eq || []).length; j++) lines.push('|_+' + String(eq[j]));
            pPanel.textContent = lines.length ? lines.join('\n') : '—';
          } else if (pPanel) pPanel.textContent = '';
        }
      } catch (eP1) {}

      // Status macro (from rogue player statusEffects)
      try {
        var sEl = document.getElementById('debrief-summary-status');
        var player = _getRoguePlayer();
        var se = player && player.statusEffects ? player.statusEffects : {};
        var keys = [];
        for (var k in se) { if (se.hasOwnProperty(k) && se[k]) keys.push(k); }
        if (sEl) {
          var sym2 = '';
          for (var ii = 0; ii < Math.min(6, keys.length); ii++) sym2 += '!';
          sEl.textContent = sym2 || '—';
        }
        var sPanel = document.getElementById('debrief-panel-status');
        if (sPanel && _rowExpanded.status) {
          var lines2 = keys.map(function(n) { return '|_!' + String(n); });
          sPanel.textContent = lines2.length ? lines2.join('\n') : '—';
        } else if (sPanel) sPanel.textContent = '';
      } catch (eST0) {}

      // MOK row: color driven by kernel quality signal
      try {
        var mokEl = document.getElementById('debrief-summary-mok');
        if (mokEl) {
          var kc = (typeof KernelManager !== 'undefined' && KernelManager.getKernelButtonColor) ? KernelManager.getKernelButtonColor() : null;
          var ks = (typeof KernelManager !== 'undefined' && KernelManager.getState) ? KernelManager.getState() : null;
          var stateTxt = (kc && kc.state) ? String(kc.state) : (ks && ks.state ? String(ks.state) : '');
          mokEl.textContent = stateTxt ? stateTxt.toLowerCase() : 'idle';
          if (kc && kc.color) {
            var rowEl = document.querySelector('.debrief-nav-row[data-row="mok"]');
            if (rowEl) rowEl.style.color = kc.color;
          }
        }
      } catch (eM0) {}

      // API summary placeholder (can become toggle UI)
      try {
        var apiEl = document.getElementById('debrief-summary-api');
        if (apiEl) {
          var kc2 = (typeof KernelManager !== 'undefined' && KernelManager.getKernelButtonColor) ? KernelManager.getKernelButtonColor() : null;
          apiEl.textContent = (kc2 && kc2.state) ? String(kc2.state).toLowerCase() : '—';
        }
      } catch (eA0) {}

      // Accessibility row: summary + interactive panel
      // Toggle state persisted in localStorage so it survives re-renders.
      try {
        var accEl = document.getElementById('debrief-summary-accessibility');
        if (accEl) {
          var qsOn = (typeof localStorage !== 'undefined' && localStorage.getItem('eo:qs-ctrl') === '1');
          accEl.textContent = qsOn ? 'qs-on' : 'qs-off';
        }
        var accPanel = document.getElementById('debrief-panel-accessibility');
        if (accPanel && _rowExpanded.accessibility) {
          var qsOn2 = (typeof localStorage !== 'undefined' && localStorage.getItem('eo:qs-ctrl') === '1');
          var hcOn  = (typeof localStorage !== 'undefined' && localStorage.getItem('eo:hi-contrast') === '1');
          var inner = '';
          // HELP sub-row: link to /roguehelp accessibility guide
          inner += '<div class="debrief-line acc-help">'
            + '|_<a class="debrief-acc-link" href="/roguehelp" target="_blank" rel="noopener">[ HELP ]</a>'
            + ' accessibility&nbsp;guide'
            + '</div>';
          // QuadStick controller toggle
          inner += '<div class="debrief-line acc-toggle" id="debrief-acc-qs">'
            + '|_QuadStick&nbsp;<button class="debrief-acc-btn" data-acc="qs-ctrl">'
            + (qsOn2 ? '[ON]' : '[OFF]')
            + '</button>'
            + '</div>';
          // High-contrast mode toggle
          inner += '<div class="debrief-line acc-toggle" id="debrief-acc-hc">'
            + '|_HiCntrst&nbsp;<button class="debrief-acc-btn" data-acc="hi-contrast">'
            + (hcOn ? '[ON]' : '[OFF]')
            + '</button>'
            + '</div>';
          accPanel.innerHTML = inner;

          // Wire toggle buttons (re-wired each render, safe to call multiple times)
          try {
            accPanel.querySelectorAll('.debrief-acc-btn').forEach(function(btn) {
              btn.addEventListener('click', function(ev) {
                if (ev && ev.stopPropagation) ev.stopPropagation();
                var key = 'eo:' + btn.getAttribute('data-acc');
                var cur = (typeof localStorage !== 'undefined' && localStorage.getItem(key) === '1');
                if (typeof localStorage !== 'undefined') localStorage.setItem(key, cur ? '0' : '1');
                // Apply side-effects
                if (btn.getAttribute('data-acc') === 'hi-contrast') {
                  if (document.body) document.body.classList.toggle('acc-hi-contrast', !cur);
                }
                _renderResources(); // refresh row
              });
            });
          } catch (eAB0) {}
        } else if (accPanel) {
          accPanel.innerHTML = '';
        }
      } catch (eACC0) {}

      // Signal summary (battery-driven pulse, 3-tier speed)
      // Diamond fill: [◈◈◈◇◇] when charged, [◇◇◇◇◇] when dead
      // ((( and ))) pulse gently when battery is alive; pulse stops when dead
      try {
        var sumS = document.getElementById('debrief-summary-signal');
        if (sumS) {
          (function() {
            var _timer = null;
            var _frameIx = 0;

            // ── Device battery (real hardware) ──
            var _deviceBatt = { level: 1.0, charging: false, supported: false };
            try {
              if (navigator.getBattery) {
                navigator.getBattery().then(function(batt) {
                  _deviceBatt.supported = true;
                  _deviceBatt.level = batt.level;
                  _deviceBatt.charging = batt.charging;
                  batt.addEventListener('levelchange', function() { _deviceBatt.level = batt.level; });
                  batt.addEventListener('chargingchange', function() { _deviceBatt.charging = batt.charging; });
                }).catch(function() {});
              }
            } catch (eBatt) {}

            // ── Diamond battery bar (5 diamonds from 0-100 scale) ──
            function _batteryDiamonds(batt, maxB) {
              maxB = maxB || 100;
              batt = Math.max(0, Math.min(maxB, batt || 0));
              var diamonds = 5;
              var filled = Math.round((batt / maxB) * diamonds);
              return '◈'.repeat(filled) + '◇'.repeat(diamonds - filled);
            }

            // ── In-game battery (resource, 0-100) ──
            function _getBatt() {
              var st = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getState) ? GAMESTATE.getState() : {};
              var batt = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getBattery) ? GAMESTATE.getBattery() : (st.battery || 0);
              var maxB = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getMaxBattery) ? GAMESTATE.getMaxBattery() : (st.maxBattery || 100);
              return { batt: batt || 0, maxB: maxB || 100 };
            }

            function _tierFromPct(pct) {
              return (pct <= 0.34) ? 'LOW' : (pct <= 0.67) ? 'MID' : 'HIGH';
            }

            function _speedForTier(tier) {
              if (tier === 'HIGH') return 170;
              if (tier === 'MID') return 320;
              return 520;
            }

            var _timerMs = 0;

            function _renderOnce() {
              var b = _getBatt();
              var pct = b.maxB ? (b.batt / b.maxB) : 0;
              var tier = _tierFromPct(pct);
              var diamonds = _batteryDiamonds(b.batt, b.maxB);
              var rowElS = null;
              try { rowElS = document.querySelector('.debrief-nav-row[data-row="signal"]'); } catch (e0) {}

              // Device battery depleted: grey out entire row, stop pulse
              if (_deviceBatt.level <= 0.05 && _deviceBatt.supported) {
                sumS.textContent = '(((' + diamonds + ')))';
                if (rowElS) {
                  rowElS.classList.add('signal-depleted');
                  rowElS.classList.remove('signal-pulse');
                }
                if (_timer) { clearInterval(_timer); _timer = null; }
                return;
              }

              // Remove depleted if battery recovered
              if (rowElS) rowElS.classList.remove('signal-depleted');

              if (b.batt <= 0) {
                // In-game battery = 0: pulse stops, powered down
                sumS.textContent = '(((' + diamonds + ')))';
                if (rowElS) {
                  rowElS.classList.remove('signal-pulse');
                }
                try {
                  var av = document.getElementById('mok-avatar');
                  if (av) { av.classList.add('mok-powered-down'); av.setAttribute('aria-disabled', 'true'); }
                } catch (e1) {}
                if (_timer) { clearInterval(_timer); _timer = null; }
                return;
              }

              try {
                var av2 = document.getElementById('mok-avatar');
                if (av2) { av2.classList.remove('mok-powered-down'); av2.removeAttribute('aria-disabled'); }
              } catch (e2) {}

              _frameIx++;

              // Diamond battery signal: "(((" + [◈◈◈◇◇] + ")))"
              sumS.textContent = '(((' + diamonds + ')))';

              // Toggle pulse class for gentle color/glow
              if (rowElS) {
                try {
                  rowElS.classList.remove('signal-pulse');
                  void rowElS.offsetWidth;
                  rowElS.classList.add('signal-pulse');
                } catch (e5) {}
              }

              // adjust interval if tier changed
              var want = _speedForTier(tier);
              if (!_timer || _timerMs !== want) {
                if (_timer) clearInterval(_timer);
                _timer = setInterval(_renderOnce, want);
                _timerMs = want;
              }
            }

            // Kill previous timer if re-rendering
            try {
              if (sumS._pulseTimer) clearInterval(sumS._pulseTimer);
            } catch (e3) {}

            _renderOnce();
            sumS._pulseTimer = _timer;
          })();
        }
      } catch (eS1) {}

      // Signal panel: battery modifiers from equipped/passive items
      // Only populates if there are battery-relevant items — if empty, row won't expand
      try {
        var sigPanel = document.getElementById('debrief-panel-signal');
        if (sigPanel) {
          var _btModLines = [];

          // Gather battery drain modifiers from active item
          try {
            if (typeof GAMESTATE !== 'undefined' && GAMESTATE.getActiveItem) {
              var _btActive = GAMESTATE.getActiveItem();
              if (_btActive) {
                var _btAName = (_btActive.name || '').toLowerCase();
                var _btDrain = 0;
                if (_btAName.indexOf('flashlight') !== -1) _btDrain = _btActive.batteryDrainRate || 0.27;
                else if (_btAName.indexOf('night vision') !== -1) _btDrain = _btActive.batteryDrainRate || 0.45;
                if (_btDrain > 0) {
                  _btModLines.push('<div class="debrief-line battery-mod resource-row" data-resource="Battery" style="color:' +
                    (ROW_COLORS.battery || '#00FFA6') + '">◈ ' + (_btActive.name || 'Item') +
                    ' <span style="opacity:0.6">-' + _btDrain.toFixed(2) + '/s</span></div>');
                }
              }
            }
          } catch (eBtA) {}

          // Gather battery modifiers from passive items
          try {
            if (typeof PassiveItemsSystem !== 'undefined' && PassiveItemsSystem.getEquippedItems) {
              var _btPassives = PassiveItemsSystem.getEquippedItems() || [];
              for (var _bpi = 0; _bpi < _btPassives.length; _bpi++) {
                var _bpItem = _btPassives[_bpi];
                if (_bpItem && (_bpItem.batteryDrainRate || _bpItem.batteryRechargeRate || _bpItem.batteryModifier)) {
                  var _bpDesc = '';
                  if (_bpItem.batteryDrainRate) _bpDesc = '-' + _bpItem.batteryDrainRate.toFixed(2) + '/s';
                  else if (_bpItem.batteryRechargeRate) _bpDesc = '+' + _bpItem.batteryRechargeRate.toFixed(2) + '/s';
                  else if (_bpItem.batteryModifier) _bpDesc = 'x' + _bpItem.batteryModifier.toFixed(1);
                  _btModLines.push('<div class="debrief-line battery-mod resource-row" data-resource="Battery" style="color:' +
                    (ROW_COLORS.battery || '#00FFA6') + '">◇ ' + (_bpItem.name || 'Passive') +
                    ' <span style="opacity:0.6">' + _bpDesc + '</span></div>');
                }
              }
            }
          } catch (eBtP) {}

          if (_btModLines.length > 0 && _rowExpanded.signal) {
            sigPanel.innerHTML = _btModLines.join('');
          } else {
            sigPanel.innerHTML = '';
            // If no modifiers, prevent expand (keep collapsed)
            if (_btModLines.length === 0) {
              _rowExpanded.signal = false;
            }
          }
        }
      } catch (eSigP) {}

      // Panels visibility
      try {
        var ids = ['resources','ammo','signal','passives','status','mok','api','accessibility'];
        for (var ii = 0; ii < ids.length; ii++) {
          _setPanelVisible(ids[ii], !!_rowExpanded[ids[ii]]);
        }
      } catch (ePV0) {}

      // Click to highlight + toggle expand (sticky)
      try {
        var rows = document.querySelectorAll('.debrief-nav-row[data-row]');
        rows.forEach(function(r) {
          r.addEventListener('click', function(e) {
            if (e && e.stopPropagation) e.stopPropagation();
            var rid = r.getAttribute('data-row');
            if (!rid) return;
            _highlightedRow = rid;
            _rowExpanded[rid] = !_rowExpanded[rid];
            _renderResources(); // cheap + consistent (also refreshes summaries/panels)
          });
        });
      } catch (eW0) {}

      _applyHighlight();

      // Wire swapper click (same as cycle)
      var mokSwap = document.getElementById('debrief-mok-swapper');
      if (mokSwap) {
        mokSwap.addEventListener('click', function(e) {
          e.stopPropagation();
          toggleDisplay();
        });
      }

    _attachEventHandlers();

    // Re-apply adaptive letter-spacing after DOM rebuild.
    // Deferred to next frame so CSS layout has settled after innerHTML.
    requestAnimationFrame(_applyAdaptiveSpacing);
  }

  /**
   * Render video display — real <video> element with zoom+crop.
   * The CSS class .video-player-container uses object-fit:cover so
   * non-4:3 content fills the viewport with overflow cropped (no letterbox).
   */
  function _renderVideo() {
    if (!_videoUrl) {
      // No URL yet — shouldn't happen, but degrade gracefully
      _debriefScreen.innerHTML = '<div class="debrief-video-display">' +
        '<div class="video-player-container" style="display:flex;align-items:center;justify-content:center;color:rgba(51,255,51,0.5);font-size:12px;">STANDBY — INCOMING INTEL</div></div>';
      return;
    }

    // Title bar only for externally pushed videos (M-console, etc.)
    // Theme video info goes to the audio widget's now-playing label instead.
    var titleBar = (_videoTitle && !_isThemeVideo)
      ? '<div class="vp-title-bar">\u25B6 ' + _videoTitle + '</div>'
      : '';

    var themeId = _getCurrentThemeId();
    var audioTrack = THEME_AUDIO_MAP[themeId] || '';
    var themeSrc = _isThemeVideo ? _getThemeVideoSources() : null;

    var html = '<div class="debrief-video-display">';
    html += '<div class="video-player-container">';
    html += titleBar;
    html += '<video id="debrief-video-el" autoplay playsinline muted';
    if (_isThemeVideo) html += ' loop';
    // Start muted for iOS autoplay compliance. AudioSystem.connectVideoElement()
    // unmutes after routing through Web Audio BGM gain bus.
    html += ' data-audio-track="' + audioTrack + '"';
    html += ' data-audio-sync="' + (_isThemeVideo ? 'true' : 'false') + '"';
    html += ' data-theme="' + themeId + '"';
    html += '>';
    // Use <source> tags with type hints — browser picks first playable format
    // (matches splash-screen pipeline for cross-browser compatibility)
    if (themeSrc) {
      if (themeSrc.webm) html += '<source src="' + themeSrc.webm + '" type="video/webm">';
      if (themeSrc.mp4)  html += '<source src="' + themeSrc.mp4 + '" type="video/mp4">';
    } else if (_videoUrl) {
      // Non-theme video (external push) — single src fallback
      html += '<source src="' + _videoUrl + '">';
    }
    html += '</video>';
    html += '</div>';
    html += '</div>';

    // Wrap with degauss CRT power-on effect for theme ambient video
    if (_isThemeVideo) {
      html = _wrapWithDegauss(html);
    }

    _debriefScreen.innerHTML = html;

    // Wire up end / error handlers and audio routing
    var vid = document.getElementById('debrief-video-el');
    if (vid) {
      // Theme video loops as ambient feed; other videos play once
      if (_isThemeVideo) {
        vid.loop = true;
      }

      // Route video audio through AudioSystem BGM bus
      // mConsoleOverride = true when video was pushed from M console (narrative at 75%)
      var isMConsolePush = _videoTitle && _videoTitle.indexOf('[M]') === 0;
      // Build now-playing info for the audio widget's track label
      var nowPlayingInfo = null;
      if (_isThemeVideo) {
        var tid = _getCurrentThemeId();
        nowPlayingInfo = {
          title: (tid || 'theme').toUpperCase() + ' — LIVE FEED',
          artist: 'DEBRIEF'
        };
      } else if (_videoTitle) {
        nowPlayingInfo = { title: _videoTitle, artist: 'VIDEO' };
      }
      try {
        if (typeof AudioSystem !== 'undefined' && AudioSystem.connectVideoElement) {
          AudioSystem.connectVideoElement(vid, isMConsolePush, nowPlayingInfo);
        }
      } catch (e) {}

      vid.addEventListener('ended', function() {
        if (!vid.loop) setVideoPlaying(false);
      });
      vid.addEventListener('error', function() {
        // Auto-fallback to MOK after 3s
        try { if (typeof AudioSystem !== 'undefined') AudioSystem.disconnectVideoElement(); } catch (_) {}
        var container = vid.parentElement;
        if (container) {
          container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:rgba(255,51,51,0.7);font-size:11px;font-family:monospace;">SIGNAL LOST</div>';
        }
        setTimeout(function() { setVideoPlaying(false); }, 3000);
      });
    }
  }

  /**
   * Render kernel API status
   * @returns {string} HTML
   */
  function _renderKernelStatus() {
    var status = 'disconnected';
    if (typeof KernelManager !== 'undefined' && KernelManager.getState) {
      var ks = KernelManager.getState();
      status = (ks.state || 'DISCONNECTED').toLowerCase();
    }
    var statusIcon = (status === 'connected' || status === 'active_run') ? '🟢' : status === 'connecting' ? '🟡' : status === 'error' ? '🔴' : '⚫';
    var statusText = status === 'connected' ? 'Connected' : status === 'active_run' ? 'Active' : status === 'connecting' ? 'Connecting...' : status === 'error' ? 'Error' : 'Offline';

    var html = '<div class="kernel-api-status">';
    html += '<span class="kernel-icon">' + statusIcon + '</span>';
    html += '<span class="kernel-text">Kernel API: ' + statusText + '</span>';
    html += '</div>';

    return html;
  }

  /**
   * Render cycle button
   * @param {string} label - Button label
   * @returns {string} HTML
   */
  function _renderCycleButton(label) {
    var html = '<div class="debrief-cycle-button" id="debrief-cycle-btn">';
    html += '<span class="cycle-icon">◀▶</span>';
    html += '<span class="cycle-text">' + label + '</span>';
    html += '</div>';
    return html;
  }

  /**
   * Attach event handlers
   */
  function _attachEventHandlers() {
    var cycleBtn = document.getElementById('debrief-cycle-btn');
    if (cycleBtn) {
      cycleBtn.addEventListener('click', function() {
        toggleDisplay();
      });
    }

    // ── MOK avatar interactivity ──
    _setupMokInteraction();
  }

  /* ============================================================
     MOK AVATAR INTERACTIVITY
     SM64-inspired poke/squish/spin on the CSS 3D pyramid.
     Mobile-first: single-tap, double-tap, tap+drag.
     QuadStick accessible: Enter/Space keys.
     ============================================================ */
  function _setupMokInteraction() {
    var loader = document.getElementById('mok-avatar');
    if (!loader || loader._mokInteractionBound) return;
    loader._mokInteractionBound = true;

    var wrapper = loader.querySelector('.mok-pyramid-wrapper');
    if (!wrapper) return;

    // Interaction classes (only one active at a time)
    var POKE_CLASSES = ['mok-poke-down', 'mok-poke-up', 'mok-spin-burst',
                        'mok-dragging', 'mok-drag-release', 'mok-squish'];

    function _clearPoke() {
      for (var i = 0; i < POKE_CLASSES.length; i++) {
        loader.classList.remove(POKE_CLASSES[i]);
      }
    }

    // ── State ──
    var _pointerDown = false;
    var _startX = 0;
    var _startY = 0;
    var _dragActive = false;
    var _dragAngle = 0;        // cumulative Y rotation during drag (degrees)
    var _lastTapTime = 0;
    var _holdTimer = null;
    var _pokeTimer = null;
    var DRAG_THRESHOLD = 8;    // px before drag activates (mobile-friendly)
    var DOUBLE_TAP_MS = 350;   // max gap for double-tap
    var HOLD_MS = 400;         // ms before long-press squish activates

    // ── Gate: check if MOKStateMachine allows interaction ──
    function _canInteract() {
      if (typeof MOKStateMachine !== 'undefined' && MOKStateMachine.canInteract) {
        return MOKStateMachine.canInteract();
      }
      return true; // fallback: always allow
    }

    // ── Notify state machine of interactive event ──
    function _notifySM(eventType) {
      if (typeof MOKStateMachine !== 'undefined' && MOKStateMachine.handleEvent) {
        MOKStateMachine.handleEvent({ type: eventType });
      }
    }

    // ── Poke: determine direction from tap position ──
    function _pokeFromTap(clientY) {
      if (!_canInteract()) return;
      var rect = loader.getBoundingClientRect();
      var midY = rect.top + rect.height / 2;
      _clearPoke();
      // Force reflow so animation restarts
      void loader.offsetWidth;
      if (clientY < midY) {
        loader.classList.add('mok-poke-down');
      } else {
        loader.classList.add('mok-poke-up');
      }
      _notifySM('poke');
      // Auto-clear after animation completes (600ms)
      if (_pokeTimer) clearTimeout(_pokeTimer);
      _pokeTimer = setTimeout(function() {
        _clearPoke();
      }, 650);
    }

    // ── Spin burst (double-tap) ──
    function _spinBurst() {
      if (!_canInteract()) return;
      _clearPoke();
      void loader.offsetWidth;
      loader.classList.add('mok-spin-burst');
      _notifySM('spin_burst');
      if (_pokeTimer) clearTimeout(_pokeTimer);
      _pokeTimer = setTimeout(function() {
        _clearPoke();
      }, 850);
    }

    // ── Long-press squish ──
    function _startSquish() {
      if (!_canInteract()) return;
      _clearPoke();
      loader.classList.add('mok-squish');
      _notifySM('squish');
    }
    function _releaseSquish(clientY) {
      loader.classList.remove('mok-squish');
      // Boing back: use poke direction based on where the finger was
      _pokeFromTap(clientY);
    }

    // ── Drag spin ──
    function _startDrag() {
      _dragActive = true;
      _clearPoke();
      loader.classList.add('mok-dragging');
      // Get current rotation from the wrapper's computed transform
      _dragAngle = _getCurrentYRotation();
    }

    function _moveDrag(clientX) {
      if (!_dragActive) return;
      var dx = clientX - _startX;
      // Map horizontal drag to Y rotation: 200px = 360 degrees
      var angle = _dragAngle + (dx / 200) * 360;
      loader.style.setProperty('--mok-drag-y', angle.toFixed(1) + 'deg');
    }

    function _endDrag(clientX) {
      if (!_dragActive) return;
      _dragActive = false;
      loader.classList.remove('mok-dragging');

      // Calculate momentum from last drag delta
      var dx = clientX - _startX;
      var momentum = (dx / 200) * 360;
      var finalAngle = _dragAngle + momentum + (momentum * 0.3); // coast 30% extra
      loader.style.setProperty('--mok-drag-y', finalAngle.toFixed(1) + 'deg');

      // Apply coast animation class
      loader.classList.add('mok-drag-release');

      // After coast, return to idle spin
      if (_pokeTimer) clearTimeout(_pokeTimer);
      _pokeTimer = setTimeout(function() {
        _clearPoke();
        loader.style.removeProperty('--mok-drag-y');
      }, 1300);
    }

    // ── Get current Y rotation from computed transform matrix ──
    function _getCurrentYRotation() {
      try {
        var cs = getComputedStyle(wrapper);
        var tr = cs.transform || cs.webkitTransform || '';
        if (tr && tr !== 'none') {
          // Parse matrix3d or approximate from matrix
          // For simplicity, use the drag variable if set
          var dragVar = loader.style.getPropertyValue('--mok-drag-y');
          if (dragVar) return parseFloat(dragVar) || 0;
        }
      } catch (e) {}
      return 0;
    }

    // ── Pointer handlers ──
    loader.addEventListener('pointerdown', function(ev) {
      if (ev.button && ev.button !== 0) return; // left/touch only
      _pointerDown = true;
      _startX = ev.clientX;
      _startY = ev.clientY;
      _dragActive = false;

      // Start hold timer for long-press squish
      if (_holdTimer) clearTimeout(_holdTimer);
      _holdTimer = setTimeout(function() {
        if (_pointerDown && !_dragActive) {
          _startSquish();
        }
      }, HOLD_MS);

      try { loader.setPointerCapture(ev.pointerId); } catch (e) {}
      ev.preventDefault();
      ev.stopPropagation();
    });

    loader.addEventListener('pointermove', function(ev) {
      if (!_pointerDown) return;
      var dx = Math.abs(ev.clientX - _startX);
      var dy = Math.abs(ev.clientY - _startY);

      if (!_dragActive && (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD)) {
        // Cancel hold timer — this is a drag
        if (_holdTimer) { clearTimeout(_holdTimer); _holdTimer = null; }
        // Cancel squish if active
        loader.classList.remove('mok-squish');
        _startDrag();
      }

      if (_dragActive) {
        _moveDrag(ev.clientX);
        ev.preventDefault();
      }
    }, { passive: false });

    loader.addEventListener('pointerup', function(ev) {
      if (!_pointerDown) return;
      _pointerDown = false;
      if (_holdTimer) { clearTimeout(_holdTimer); _holdTimer = null; }

      // If squishing, release with boing
      if (loader.classList.contains('mok-squish')) {
        _releaseSquish(ev.clientY);
        return;
      }

      // If dragging, end with momentum
      if (_dragActive) {
        _endDrag(ev.clientX);
        return;
      }

      // Tap (no drag) — check for double-tap
      var now = Date.now();
      if (now - _lastTapTime < DOUBLE_TAP_MS) {
        _lastTapTime = 0;
        _spinBurst();
      } else {
        _lastTapTime = now;
        _pokeFromTap(ev.clientY);
      }
    });

    loader.addEventListener('pointercancel', function() {
      _pointerDown = false;
      _dragActive = false;
      if (_holdTimer) { clearTimeout(_holdTimer); _holdTimer = null; }
      _clearPoke();
      loader.style.removeProperty('--mok-drag-y');
    });

    // ── Keyboard accessibility (QuadStick / Enter / Space) ──
    loader.addEventListener('keydown', function(ev) {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        ev.stopPropagation();
        // Alternate between poke-down and spin-burst
        if (loader.classList.contains('mok-poke-down') ||
            loader.classList.contains('mok-poke-up')) {
          _spinBurst();
        } else {
          _clearPoke();
          void loader.offsetWidth;
          loader.classList.add('mok-poke-down');
          if (_pokeTimer) clearTimeout(_pokeTimer);
          _pokeTimer = setTimeout(_clearPoke, 650);
        }
      }
    });
  }

  /**
   * Toggle between MOK and resources
   */
  function toggleDisplay() {
    if (_currentDisplay === 'mok') {
      _currentDisplay = 'resources';
    } else {
      _currentDisplay = 'mok';
    }

    _render();
  }

  /**
   * Set game mode
   * @param {string} modeName - Mode name (goneRogue, streetChronicles, etc.)
   */
  function setMode(modeName) {
    if (MODES[modeName]) {
      _currentMode = MODES[modeName];
      _currentDisplay = _currentMode.defaultDisplay;
      // Kill ambient theme video when entering a game mode
      if (_isThemeVideo && _videoPlaying) {
        setVideoPlaying(false);
      }
      // Cancel pending theme video schedule
      if (_themeVideoTimer) { clearTimeout(_themeVideoTimer); _themeVideoTimer = null; }
      _render();
    }
  }

  /* ── Theme default video — lowest-priority ambient feed ─────────
     After splash closes, the active theme's drone footage "clicks on"
     in the debrief feed with a CRT degauss power-on effect.
     Rules:
       • Only plays if nothing else is already playing
       • Only plays if debrief feed exists and a theme video was stashed
       • 3-second delay so all other init has settled
       • Consumed on play (sessionStorage cleared)
       • Safety timeout inherited from setVideoPlaying (60s)
     ──────────────────────────────────────────────────────────────── */

  var _themeVideoTimer = null;
  var _isThemeVideo = false; // True when current video is the ambient theme feed

  function _scheduleThemeVideo() {
    // Don't auto-play if we're mid-game
    if (document.body.classList.contains('mode-gone-rogue') ||
        document.body.classList.contains('in-gone-rogue')) return;

    // Wait 3s for init dust to settle, then CRT "clicks on"
    _themeVideoTimer = setTimeout(function() {
      _themeVideoTimer = null;
      // Lowest priority: bail if anything else claimed the feed
      if (_videoPlaying) return;
      if (document.body.classList.contains('mode-gone-rogue') ||
          document.body.classList.contains('in-gone-rogue')) return;
      // Bail if splash is still open
      if (document.getElementById('splash-screen')) return;

      var src = _getThemeVideoSources();
      if (!src) return;

      _isThemeVideo = true;
      setVideoPlaying(true, src.webm || src.mp4 || 'theme', null);
    }, 3000);
  }

  /**
   * Public: play/toggle the current theme's default video.
   * Called by the debrief video widget or external API.
   */
  function playThemeVideo() {
    if (_videoPlaying && _isThemeVideo) {
      // Already playing theme video — stop it
      setVideoPlaying(false);
      return;
    }
    if (_videoPlaying) {
      // Something else is playing — override with theme video
      setVideoPlaying(false);
    }
    var src = _getThemeVideoSources();
    if (!src) return;
    _isThemeVideo = true;
    setVideoPlaying(true, src.webm || src.mp4 || 'theme', null);
  }

  /**
   * Public: toggle pause on the current video.
   */
  function toggleVideoPause() {
    var vid = document.getElementById('debrief-video-el');
    if (!vid || !_videoPlaying) return;
    if (vid.paused) {
      vid.play();
      _videoPaused = false;
    } else {
      vid.pause();
      _videoPaused = true;
    }
    _updateVideoWidget();
  }

  /**
   * Public: stop current video and return to MOK display.
   */
  function stopVideo() {
    if (_videoPlaying) {
      setVideoPlaying(false);
    }
  }

  /* ── Video controls widget ──────────────────────────────────── */

  function _initVideoWidget() {
    var playBtn = document.getElementById('video-play-btn');
    var stopBtn = document.getElementById('video-stop-btn');

    if (playBtn) {
      playBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (_videoPlaying) {
          toggleVideoPause();
        } else {
          playThemeVideo();
        }
        _updateVideoWidget();
      });
    }
    if (stopBtn) {
      stopBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (_videoPlaying) {
          // Video is in feed → stop it, show MOK avatar, button goes red
          stopVideo();
          stopBtn.classList.add('video-stopped');
        } else {
          // MOK avatar is in feed → start video, button returns to theme color
          stopBtn.classList.remove('video-stopped');
          playThemeVideo();
        }
        _updateVideoWidget();
      });
    }
    _updateVideoWidget();
  }

  function _updateVideoWidget() {
    var playIcon = document.getElementById('video-play-icon');
    var stopIcon = document.getElementById('video-stop-icon');
    var playBtn = document.getElementById('video-play-btn');
    var stopBtn = document.getElementById('video-stop-btn');
    if (!playIcon || !stopIcon) return;

    if (_videoPlaying) {
      var vid = document.getElementById('debrief-video-el');
      var isPaused = vid && vid.paused;
      // Play button cycles between ▶ (play/resume) and ⏸ (pause)
      playIcon.textContent = isPaused ? '\u25B6' : '\u23F8';
      if (playBtn) {
        playBtn.title = isPaused ? 'Resume video' : 'Pause video';
        playBtn.classList.add('video-active');
      }
      // Stop button: active state (not stopped)
      stopIcon.textContent = '\u25A0'; // ■
      if (stopBtn) {
        stopBtn.title = 'Stop video';
        stopBtn.classList.remove('video-stopped');
      }
    } else {
      playIcon.textContent = '\u25B6'; // ▶
      if (playBtn) {
        playBtn.title = 'Play theme video';
        playBtn.classList.remove('video-active');
      }
      stopIcon.textContent = '\u25A0'; // ■
      if (stopBtn) {
        // Red = MOK avatar showing; click will start video
        stopBtn.title = stopBtn.classList.contains('video-stopped')
          ? 'Play video' : 'Stop / return to MOK';
      }
    }
  }

  /**
   * Render video with CRT degauss power-on effect.
   * Called by _renderVideo when _isThemeVideo is true.
   * The degauss class triggers a CSS animation: color fringe → stabilize → fade in.
   */
  function _wrapWithDegauss(containerHtml) {
    return '<div class="debrief-degauss">' + containerHtml + '</div>';
  }

  /**
   * Set video playing state
   * @param {boolean} playing
   * @param {string} [url]   - video URL (required when playing=true)
   * @param {string} [title] - display title overlay
   */
  var _videoMaxTimer = null;

  function setVideoPlaying(playing, url, title) {
    _videoPlaying = playing;
    if (playing && url) {
      _videoUrl = url;
      _videoTitle = title || null;
    }
    if (!playing) {
      _videoUrl = null;
      _videoTitle = null;
      _isThemeVideo = false;
      // Disconnect video from audio graph
      try { if (typeof AudioSystem !== 'undefined') AudioSystem.disconnectVideoElement(); } catch (_) {}
      // Restore display to the mode's default so _render picks up MOK/resources
      _currentDisplay = _currentMode ? _currentMode.defaultDisplay : 'mok';
    }
    // Auto-maximize debrief when video is pushed (any orientation)
    // Theme ambient video does NOT auto-maximize — it plays in normal size
    try {
      if (playing && !_isThemeVideo) {
        if (DebriefFeedController._setDebriefState) {
          DebriefFeedController._setDebriefState('maximized');
        }
        // Safety timeout: auto-restore after 60s in case video end signal is lost
        if (_videoMaxTimer) clearTimeout(_videoMaxTimer);
        _videoMaxTimer = setTimeout(function() {
          if (_videoPlaying && DebriefFeedController._getDebriefState &&
              DebriefFeedController._getDebriefState() === 'maximized') {
            _videoPlaying = false;
            if (DebriefFeedController._setDebriefState) {
              DebriefFeedController._setDebriefState('normal');
            }
          }
        }, 60000);
      } else {
        // Video ended — restore to normal
        if (_videoMaxTimer) { clearTimeout(_videoMaxTimer); _videoMaxTimer = null; }
        if (DebriefFeedController._setDebriefState) {
          DebriefFeedController._setDebriefState('normal');
        }
      }
    } catch (e) {}
    _videoPaused = false;
    _render();
    _updateVideoWidget();
  }

  /**
   * Refresh display
   */
  function refresh() {
    _render();
  }

  /**
   * Get current display mode
   */
  function getCurrentDisplay() {
    return _currentDisplay;
  }

  /**
   * Trigger MOK event
   * @param {string} eventType - Event type
   * @param {*} eventData - Event data
   */
  function triggerMOKEvent(eventType, eventData) {
    if (_mokInitialized && typeof MOKStateMachine !== 'undefined' && MOKStateMachine) {
      MOKStateMachine.handleEvent({
        type: eventType,
        data: eventData
      });
    }
  }

  /**
   * Set MOK expression directly (API hook for agents)
   * Maps expression names to MOKStateMachine event types.
   * Falls back to legacy MOKVisualEngine if loaded.
   * @param {string} expression - Expression name (idle, talking, warning, happy, error, etc.)
   * @param {Object} options - Optional color and timing overrides
   */
  var EXPRESSION_TO_EVENT = {
    idle: 'idle_timer',
    talking: 'tooltip_open',
    processing: 'card_played',
    warning: 'card_failed',
    happy: 'item_acquired',
    error: 'error',
    combat: 'combat_start',
    active: 'player_input'
  };

  function setMOKExpression(expression, options) {
    if (!_mokInitialized) return;

    // Route through unified state machine (CSS class driven)
    if (typeof MOKStateMachine !== 'undefined' && MOKStateMachine.handleEvent) {
      var eventType = EXPRESSION_TO_EVENT[expression];
      if (eventType) {
        MOKStateMachine.handleEvent({ type: eventType });
        return;
      }
    }

    // Legacy fallback: MOKVisualEngine (deprecated, will be removed)
    if (typeof MOKVisualEngine !== 'undefined' && MOKVisualEngine.setExpression) {
      MOKVisualEngine.setExpression(expression, options);
    }
  }

  /**
   * Set custom MOK glow colors (API hook for agents)
   * Applies via CSS custom properties on #mok-avatar for the 3D pyramid.
   * Falls back to legacy MOKVisualEngine if loaded.
   * @param {string} primaryColor - Primary glow color (hex)
   * @param {string} secondaryColor - Secondary glow color (hex)
   * @param {number} pulseSpeed - Pulse speed in ms (optional)
   */
  function setMOKGlowColors(primaryColor, secondaryColor, pulseSpeed) {
    if (!_mokInitialized) return;

    // Apply via CSS custom properties on the pyramid element
    // The pyramid reads --mok-color-1 (primary), --mok-color-2 (secondary), --mok-glow
    var avatar = document.getElementById('mok-avatar');
    if (avatar) {
      if (primaryColor) {
        avatar.style.setProperty('--mok-color-1', primaryColor);
        avatar.style.setProperty('--mok-glow', primaryColor.replace(')', ', 0.5)').replace('rgb(', 'rgba(').replace('#', ''));
        // If hex, build an rgba glow
        if (primaryColor.charAt(0) === '#') {
          avatar.style.setProperty('--mok-glow', primaryColor + '80'); // 50% alpha hex
        }
      }
      if (secondaryColor) avatar.style.setProperty('--mok-color-2', secondaryColor);
      if (pulseSpeed) avatar.style.setProperty('--mok-spin-duration', (pulseSpeed / 1000) + 's');
    }

    // Legacy fallback
    if (typeof MOKVisualEngine !== 'undefined' && MOKVisualEngine.setCustomGlowColors) {
      MOKVisualEngine.setCustomGlowColors(primaryColor, secondaryColor, pulseSpeed);
    }
  }

  /**
   * Get current MOK glow colors
   * Reads from CSS custom properties, falls back to legacy engine.
   */
  function getMOKGlowColors() {
    // Read from CSS custom properties
    var avatar = document.getElementById('mok-avatar');
    if (avatar) {
      var primary = avatar.style.getPropertyValue('--mok-color-1');
      var secondary = avatar.style.getPropertyValue('--mok-color-2');
      if (primary || secondary) {
        var spinDur = avatar.style.getPropertyValue('--mok-spin-duration');
        return {
          primary: primary || null,
          secondary: secondary || null,
          pulseSpeed: spinDur ? parseFloat(spinDur) * 1000 : null
        };
      }
    }

    // Legacy fallback
    if (typeof MOKVisualEngine !== 'undefined' && MOKVisualEngine.getCurrentGlowColors) {
      return MOKVisualEngine.getCurrentGlowColors();
    }
    return null;
  }

  /**
   * Report resource change in debrief feed
   * @param {string} resourceType - Type of resource (ammo, energy, etc.)
   * @param {number} oldValue - Previous value
   * @param {number} newValue - New value
   * @param {string} reason - Reason for change (e.g., "Card Played: Grenade")
   */
  function reportResourceChange(resourceType, oldValue, newValue, reason) {
    // Update MOK interjection with resource change
    var change = newValue - oldValue;
    var changeIcon = change >= 0 ? '▲' : '▼';
    var changeColor = change >= 0 ? '#1cff9b' : '#ff4444';

    var message = resourceType.toUpperCase() + ' ' + changeIcon + ' ';
    message += oldValue + ' → ' + newValue;

    if (reason) {
      message += ' (' + reason + ')';
    }

    // NOTE: reportResourceChange does NOT fire MOK interjection.
    // The single-tooltip-per-pickup doctrine means only the pickup path
    // fires one TooltipSystem.show/showAction call. This function handles
    // debrief feed flash + row highlight only.

    // Trigger monochrome symbol animation state (up or down)
    var SYMBOL_DEFS = {
      hp:      { up: ['♥','❣','❤'], down: ['❣','♥','❢'] },
      energy:  { up: ['◬','◮'], down: ['◬','◭'] },
      focus:   { up: ['◎','◉'], down: ['◉','◎'] },
      fatigue: { up: ['Ȫ','ȫ'], down: ['ȫ','Ȫ'] },
      ammo:    { up: ['⁍','⁌'], down: ['⁌','⁍'] },
      battery: { up: ['◇','◈'], down: ['◈','◇'] },
      key_ammo:{ up: ['🝯','🗝'], down: ['🗝','🝯'] }
    };
    var resKey = String(resourceType).toLowerCase();
    var symDef = SYMBOL_DEFS[resKey];
    if (symDef && DebriefFeedController._animStates) {
      DebriefFeedController._animStates[resKey] = {
        frames: change >= 0 ? symDef.up : symDef.down,
        idx: 0
      };
    }

    // RESOURCE_COLOR lookup for frame flash
    var RESOURCE_COLORS = {
      'HP': '#FF6B9D', 'Energy': '#00D4FF', 'Focus': '#FFF9B0',
      'Battery': '#00FFA6', 'Fatigue': '#A0522D', 'Ammo': '#DA70D6',
      'Currency': '#FFFF00', 'key_ammo': '#FF8A3D', 'Cards': '#800080'
    };

    // Frame flash cooldown: prevent spam during rapid fatigue drain / pickups
    // Symbol animation + row highlight still fire, only the big frame glow is throttled.
    if (!DebriefFeedController._flashCooldowns) DebriefFeedController._flashCooldowns = {};
    var _flashNow = Date.now();
    var _flashCooldownMs = 800; // minimum ms between frame flashes per resource
    var _lastFlash = DebriefFeedController._flashCooldowns[resourceType] || 0;
    var _allowFrameFlash = (_flashNow - _lastFlash) >= _flashCooldownMs;
    if (_allowFrameFlash) DebriefFeedController._flashCooldowns[resourceType] = _flashNow;

    // Pulse the debrief frame with RESOURCE_COLOR-specific glow
    try {
      if (_debriefScreen && _allowFrameFlash) {
        var flashColor = RESOURCE_COLORS[resourceType] || (change >= 0 ? '#1cff9b' : '#ff4444');
        // Remove old pulse classes
        _debriefScreen.classList.remove('debrief-pulse-pos');
        _debriefScreen.classList.remove('debrief-pulse-neg');
        // Apply color-specific box-shadow flash on the debrief frame
        _debriefScreen.style.boxShadow = '0 0 12px ' + flashColor + ', inset 0 0 8px ' + flashColor;
        // Also apply brightness pulse for emphasis
        var cls = change >= 0 ? 'debrief-pulse-pos' : 'debrief-pulse-neg';
        void _debriefScreen.offsetWidth;
        _debriefScreen.classList.add(cls);
        setTimeout(function() {
          try {
            _debriefScreen.classList.remove('debrief-pulse-pos');
            _debriefScreen.classList.remove('debrief-pulse-neg');
            _debriefScreen.style.boxShadow = '';
          } catch (eP0) {}
        }, 300);
      }
    } catch (eP1) {}

    // Flash the specific resource row with its RESOURCE_COLOR (.gaining/.losing CSS)
    try {
      var rowSelector = '.resource-row[data-resource="' + resourceType + '"]';
      var resourceRow = document.querySelector(rowSelector);
      if (resourceRow) {
        var animClass = change >= 0 ? 'gaining' : 'losing';
        resourceRow.classList.remove('gaining', 'losing');
        void resourceRow.offsetWidth;
        resourceRow.classList.add(animClass);
        setTimeout(function() {
          try { resourceRow.classList.remove('gaining', 'losing'); } catch (e) {}
        }, 600);
      }
    } catch (eRow) {}

    // Refresh resource summaries so bar values reflect actual GAMESTATE
    // (cheap + consistent — same pattern as row click at line 874)
    if (_currentDisplay === 'resources') {
      try { _renderResources(); } catch (eRR) {}
    }
  }

  /**
   * Report card played in debrief feed
   * @param {Object} card - Card that was played
   * @param {Object} resourceChanges - Object with resource changes {ammo: -2, energy: -3, etc.}
   */
  function reportCardPlayed(card, resourceChanges) {
    var message = '🎴 CARD PLAYED: ' + card.name;

    // Add resource cost details
    if (resourceChanges && Object.keys(resourceChanges).length > 0) {
      var costs = [];
      for (var resource in resourceChanges) {
        if (resourceChanges[resource] < 0) {
          costs.push(resource.toUpperCase() + ' ' + Math.abs(resourceChanges[resource]));
        }
      }
      if (costs.length > 0) {
        message += ' (Cost: ' + costs.join(', ') + ')';
      }
    }

    // Show in MOK interjection
    if (typeof UIControls !== 'undefined' && UIControls.updateMokInterjection) {
      UIControls.updateMokInterjection(message);
    }

    // Report individual resource changes
    if (resourceChanges) {
      for (var resource in resourceChanges) {
        var change = resourceChanges[resource];
        if (change !== 0) {
          // Get current value from GAMESTATE
          var currentValue = 0;
          if (typeof GAMESTATE !== 'undefined') {
            if (resource === 'ammo') currentValue = GAMESTATE.getAmmo();
            else if (resource === 'energy') currentValue = GAMESTATE.getEnergy();
            else if (resource === 'focus') currentValue = GAMESTATE.getFocus();
            else if (resource === 'battery') currentValue = GAMESTATE.getBattery();
            else if (resource === 'fatigue') currentValue = GAMESTATE.getFatigue();
          }

          reportResourceChange(resource, currentValue - change, currentValue, 'Card: ' + card.name);
        }
      }
    }
  }

  function showSynergyOverlay(payload) {
    var overlay = document.getElementById('debrief-synergy-overlay');
    if (!overlay) return;

    payload = payload || {};
    var left = payload.leftEmoji || payload.keyEmoji || '🗝';
    var right = payload.rightEmoji || payload.gateEmoji || '🔐';
    var kind = payload.kind || 'generic';

    overlay.className = 'debrief-synergy-overlay synergy-kind-' + kind;
    overlay.innerHTML =
      '<div class="synergy-pair">' +
        '<span class="synergy-emoji synergy-left">' + left + '</span>' +
        '<span class="synergy-emoji synergy-mid">✚</span>' +
        '<span class="synergy-emoji synergy-right">' + right + '</span>' +
      '</div>' +
      (payload.text ? '<div class="synergy-text">' + payload.text + '</div>' : '');

    overlay.classList.add('synergy-visible');

    var win = document.getElementById('debrief-window');
    if (win) {
      win.classList.remove('synergy-frame-gate', 'synergy-frame-chest', 'synergy-frame-vent');
      if (kind === 'chest') win.classList.add('synergy-frame-chest');
      else if (kind === 'vent') win.classList.add('synergy-frame-vent');
      else win.classList.add('synergy-frame-gate');

      setTimeout(function() {
        win.classList.remove('synergy-frame-gate', 'synergy-frame-chest', 'synergy-frame-vent');
      }, 900);
    }

    setTimeout(function() {
      overlay.classList.remove('synergy-visible');
    }, payload.durationMs || 900);
  }

  function flashIncinerator(opts) {
    opts = opts || {};
    var win = document.getElementById('debrief-window');
    if (!win) return;

    win.classList.add('incinerator-active');
    if (opts.kind) win.classList.add('incinerator-kind-' + opts.kind);

    setTimeout(function() {
      win.classList.remove('incinerator-active');
      if (opts.kind) win.classList.remove('incinerator-kind-' + opts.kind);
    }, opts.durationMs || 450);
  }

  /**
   * Flash celebratory victory frame for quest key turn-in.
   * Uses rotating happy-color gradient glow + ✨ sparkle ricochet animation.
   * Replaces flashIncinerator for quest_key kind.
   */
  function flashVictoryFrame(opts) {
    opts = opts || {};
    var win = document.getElementById('debrief-window');
    if (!win) return;

    // Add victory-frame-active CSS class (handles gradient glow + pulse)
    win.classList.add('victory-frame-active');

    // Spawn sparkle ✨ ricochet emojis inside the debrief window
    _spawnSparkleRicochet(win, opts.sparkleCount || 6);

    var duration = opts.durationMs || 1800;
    setTimeout(function() {
      win.classList.remove('victory-frame-active');
    }, duration);
  }

  /**
   * Spawn ✨ sparkle emojis that accelerate from center and bounce off edges.
   * Uses projectile-style ricochet physics (velocity reversal on wall hit).
   */
  function _spawnSparkleRicochet(container, count) {
    var rect = container.getBoundingClientRect();
    var w = rect.width || 200;
    var h = rect.height || 300;
    var sparkles = [];

    for (var i = 0; i < count; i++) {
      var el = document.createElement('span');
      el.textContent = '✨';
      el.style.cssText = 'position:absolute;font-size:24px;pointer-events:none;z-index:200;transition:none;will-change:transform;';
      container.appendChild(el);

      // Start from center with random outward velocity
      var angle = (Math.PI * 2 * i) / count + (Math.random() * 0.5 - 0.25);
      var speed = 2 + Math.random() * 3; // pixels per frame
      sparkles.push({
        el: el,
        x: w / 2 - 12,
        y: h / 2 - 12,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        accel: 1.02, // acceleration factor per frame
        bounces: 4 + Math.floor(Math.random() * 3),
        life: 90, // frames (~1.5s at 60fps)
        opacity: 1
      });
    }

    var frame = 0;
    var maxFrames = 90;
    var animId;

    function tick() {
      frame++;
      var allDead = true;

      for (var s = 0; s < sparkles.length; s++) {
        var sp = sparkles[s];
        if (sp.life <= 0) continue;
        allDead = false;

        // Accelerate
        sp.vx *= sp.accel;
        sp.vy *= sp.accel;

        // Move
        sp.x += sp.vx;
        sp.y += sp.vy;

        // Ricochet off container edges (projectile-style bounce)
        if (sp.x < 0) { sp.x = 0; sp.vx *= -1; sp.bounces--; sp.vx *= 0.8; }
        if (sp.x > w - 24) { sp.x = w - 24; sp.vx *= -1; sp.bounces--; sp.vx *= 0.8; }
        if (sp.y < 0) { sp.y = 0; sp.vy *= -1; sp.bounces--; sp.vy *= 0.8; }
        if (sp.y > h - 24) { sp.y = h - 24; sp.vy *= -1; sp.bounces--; sp.vy *= 0.8; }

        // Kill if out of bounces
        if (sp.bounces <= 0) sp.life = Math.min(sp.life, 10);

        // Fade out in last 20 frames
        sp.life--;
        sp.opacity = sp.life > 20 ? 1 : sp.life / 20;

        sp.el.style.transform = 'translate(' + sp.x.toFixed(0) + 'px,' + sp.y.toFixed(0) + 'px)';
        sp.el.style.opacity = sp.opacity;
      }

      if (allDead || frame >= maxFrames) {
        for (var r = 0; r < sparkles.length; r++) {
          if (sparkles[r].el.parentNode) sparkles[r].el.parentNode.removeChild(sparkles[r].el);
        }
        return;
      }

      animId = requestAnimationFrame(tick);
    }

    animId = requestAnimationFrame(tick);
  }

  /**
   * Trigger battery recharge pulse animation
   * Called when battery collectible is picked up
   */
  function triggerBatteryRecharge() {
    try {
      var rowElS = document.querySelector('.debrief-nav-row[data-row="signal"]');
      if (rowElS) {
        // Force a recharge pulse (stronger than normal pulse)
        rowElS.classList.remove('signal-pulse');
        rowElS.classList.add('signal-recharge-pulse');

        // Reflow to restart animation
        void rowElS.offsetWidth;

        // Remove recharge pulse after animation completes
        setTimeout(function() {
          rowElS.classList.remove('signal-recharge-pulse');
          rowElS.classList.add('signal-pulse');
        }, 500);
      }
    } catch (e) {
      console.warn('[DebriefFeedController] Failed to trigger battery recharge pulse:', e);
    }
  }

  /**
   * Programmatically expand a row (e.g. 'resources') and re-render.
   * Used by begin-gameplay-system to auto-expand resources on new game.
   * @param {string} rowId - Row identifier (e.g. 'resources', 'ammo')
   */
  function expandRow(rowId) {
    if (typeof _rowExpanded === 'undefined') return;
    _rowExpanded[rowId] = true;
    if (typeof _renderResources === 'function') {
      _renderResources();
    } else {
      refresh();
    }
  }

  // Public API
  return {
    init: init,
    toggleDisplay: toggleDisplay,
    setMode: setMode,
    setVideoPlaying: setVideoPlaying,
    refresh: refresh,
    getCurrentDisplay: getCurrentDisplay,
    triggerMOKEvent: triggerMOKEvent,
    setMOKExpression: setMOKExpression,
    setMOKGlowColors: setMOKGlowColors,
    getMOKGlowColors: getMOKGlowColors,
    reportResourceChange: reportResourceChange,
    reportCardPlayed: reportCardPlayed,
    expandRow: expandRow,

    // Visual feedback hooks
    showSynergyOverlay: showSynergyOverlay,
    flashIncinerator: flashIncinerator,
    flashVictoryFrame: flashVictoryFrame,
    triggerBatteryRecharge: triggerBatteryRecharge,

    // Video controls
    playThemeVideo: playThemeVideo,
    toggleVideoPause: toggleVideoPause,
    stopVideo: stopVideo
  };
})();

// Auto-initialize — deferred if splash screen is active.
// The debrief renders behind the splash, starts idle symbol refresh,
// and schedules a theme video.  None of this needs to run while the
// splash is consuming video-decode bandwidth.
(function _autoInit() {
  function _run() { DebriefFeedController.init(); }

  var splashSkipped = false;
  try { splashSkipped = sessionStorage.getItem('splash_seen') === '1'; } catch (_) {}

  if (splashSkipped) {
    // No splash — init on DOM ready as before
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _run);
    } else {
      _run();
    }
  } else {
    // Splash is showing — defer until it exits
    document.addEventListener('splash-exit', _run, { once: true });
  }
})();
