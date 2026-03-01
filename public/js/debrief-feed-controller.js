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

  // Terminal-row interaction state (sticky highlight + sticky expand)
  var _rowExpanded = {}; // { rowId: boolean }
  var _highlightedRow = 'hp';

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

    // Portrait Gone Rogue: tap to expand/collapse debrief width; drag to resize
    _setupPortraitDebriefSizing();
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

    function _isPortrait() {
      try {
        return window.matchMedia && window.matchMedia('(orientation: portrait)').matches;
      } catch (e) { return false; }
    }

    function _isRogue() {
      return body.classList.contains('mode-gone-rogue') || body.classList.contains('in-gone-rogue') || body.classList.contains('gone-rogue-active');
    }

    function _applyPct(pct) {
      pct = Math.max(20, Math.min(60, Number(pct || 30)));
      try {
        body.style.setProperty('--rogue-debrief-pct', pct + '%');
        localStorage.setItem(PREF_KEY, String(pct));
      } catch (e) {}
    }

    // Load saved width
    try {
      var saved = Number(localStorage.getItem(PREF_KEY));
      if (isFinite(saved)) _applyPct(saved);
    } catch (e) {}

    // Tap toggles expanded (default smaller on mobile)
    win.addEventListener('click', function(e) {
      if (!_isRogue() || !_isPortrait()) return;
      if (e && e.target && e.target.closest && e.target.closest('button, a, input, textarea, select')) return;

      var expanded = body.classList.toggle('rogue-debrief-expanded');
      if (expanded) _applyPct(46);
      else _applyPct(26);
    });

    // Drag on label to resize
    var label = win.querySelector('.debrief-label');
    if (!label) return;

    var dragging = false;
    function onMove(ev) {
      if (!dragging) return;
      var x = ev.clientX;
      var w = window.innerWidth || 1;
      // debrief is right-side panel: pct based on distance from right edge
      var pct = ((w - x) / w) * 100;
      _applyPct(pct);
      if (pct >= 45) body.classList.add('rogue-debrief-expanded');
      else body.classList.remove('rogue-debrief-expanded');
      ev.preventDefault();
    }

    function onUp() {
      dragging = false;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    }

    label.addEventListener('pointerdown', function(ev) {
      if (!_isRogue() || !_isPortrait()) return;
      dragging = true;
      try { label.setPointerCapture(ev.pointerId); } catch (e) {}
      document.addEventListener('pointermove', onMove, { passive: false });
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
      ev.preventDefault();
    });

    // ── Tap-to-toggle: minimized ↔ maximized (mobile portrait) ──
    // Works in both rogue and non-rogue modes on mobile portrait.
    // Minimized = label-only 22px bar, screen hidden.
    // Maximized = overlay that overlaps control-buttons, z-index 10.
    var _debriefMinimized = false;
    var _dragMoved = false;
    var _tapStartX = 0;
    var _tapStartY = 0;

    label.addEventListener('pointerdown', function(ev) {
      _dragMoved = false;
      _tapStartX = ev.clientX || 0;
      _tapStartY = ev.clientY || 0;
    });

    label.addEventListener('pointermove', function(ev) {
      var dx = Math.abs((ev.clientX || 0) - _tapStartX);
      var dy = Math.abs((ev.clientY || 0) - _tapStartY);
      if (dx > 6 || dy > 6) _dragMoved = true;
    });

    label.addEventListener('click', function(ev) {
      if (!_isPortrait()) return;
      // Don't toggle if user was dragging to resize
      if (_dragMoved) return;

      _debriefMinimized = !_debriefMinimized;

      if (_debriefMinimized) {
        win.classList.add('debrief-minimized');
        win.classList.remove('debrief-maximized');
        try {
          document.body && document.body.classList.add('rogue-debrief-minimized');
          // When minimized, reclaim width for the action buttons.
          _applyPct(14);
        } catch (e0) {}
        try { window.dispatchEvent(new CustomEvent('debrief:minimized')); } catch (e) {}
      } else {
        win.classList.remove('debrief-minimized');
        win.classList.add('debrief-maximized');
        try {
          document.body && document.body.classList.remove('rogue-debrief-minimized');
          // Keep max readable but avoid eating the torso.
          _applyPct(26);
        } catch (e1) {}
        try { window.dispatchEvent(new CustomEvent('debrief:maximized')); } catch (e) {}
      }
    });

    // Double-tap restores to normal (neither min nor max)
    label.addEventListener('dblclick', function(ev) {
      if (!_isPortrait()) return;
      _debriefMinimized = false;
      win.classList.remove('debrief-minimized');
      win.classList.remove('debrief-maximized');
      try {
        document.body && document.body.classList.remove('rogue-debrief-minimized');
        _applyPct(26);
      } catch (e0) {}
      try { window.dispatchEvent(new CustomEvent('debrief:maximized')); } catch (e) {}
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

    // MOK visual container
    html += '<div id="mok-visual-container" class="mok-visual-container"></div>';

    // MOK interjection area (existing system)
    html += '<div id="mok-interjection" class="mok-interjection"></div>';

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

    // Initialize MOK visual engine
    if (!_mokInitialized) {
      setTimeout(function() {
        var container = document.getElementById('mok-visual-container');
        if (container) {
          MOKVisualEngine.init(container);
          MOKStateMachine.init(MOKVisualEngine);
          _mokInitialized = true;
        }
      }, 100);
    }

    _attachEventHandlers();
  }

  /**
   * Render resources display
   */
  function _renderResources() {
    if (typeof DebriefFeedRenderer !== 'undefined') {
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

      // Macro rows
      html += row('resources', '[' + abbrKeepFirst('resources') + ']', 'debrief-summary-resources', 'row-resources');
      html += row('ammo', '[' + abbrKeepFirst('ammo') + ']', 'debrief-summary-ammo', 'row-ammo');
      // signal row header is the battery-ascii pulse; label hidden in CSS
      html += row('signal', '', 'debrief-summary-signal', 'row-signal');
      html += row('passives', '[' + abbrKeepFirst('passives') + ']', 'debrief-summary-passives', 'row-passives');
      html += row('status', '[' + abbrKeepFirst('status') + ']', 'debrief-summary-status', 'row-status');
      html += row('mok', '[' + abbrKeepFirst('mok') + ']', 'debrief-summary-mok', 'row-mok');
      html += row('api', '[' + abbrKeepFirst('api') + ']', 'debrief-summary-api', 'row-api');
      html += row('accessibility', '[' + abbrKeepFirst('accessibility') + ']', 'debrief-summary-accessibility', 'row-accessibility');

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

      function _renderBarLine(prefixOrGlyph, cur, max, w) {
        // Standard compact format: GLYPH[████░░]num/den
        // If no glyph, fall back to prefix text.
        w = w || 6;
        max = (typeof max === 'number' && max > 0) ? max : 1;
        cur = (typeof cur === 'number') ? cur : 0;
        cur = Math.max(0, Math.min(max, cur));
        var filled = Math.round((cur / max) * w);
        var bar = '█'.repeat(filled) + '░'.repeat(w - filled);

        var head = String(prefixOrGlyph || '');
        return head + '[' + bar + ']' + String(cur) + '/' + String(max);
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

        // Hard defaults
        if (typeof st.hp !== 'number') st.hp = 0;
        if (typeof st.maxHp !== 'number') st.maxHp = Math.max(1, st.hp);
        if (typeof st.energy !== 'number') st.energy = 0;
        if (typeof st.maxEnergy !== 'number') st.maxEnergy = Math.max(1, st.energy);
        if (typeof st.focus !== 'number') st.focus = 0;
        if (typeof st.maxFocus !== 'number') st.maxFocus = Math.max(1, st.focus);

        return st;
      }

      // Summaries + panels
      try {
        var st = _getState();

        // Resources macro summary: show HP only (critical)
        var rSum = document.getElementById('debrief-summary-resources');
        if (rSum) rSum.textContent = _renderBarLine('♥', st.hp, st.maxHp, 6);

        // Resources panel: HP + Energy + Focus lines (colored via spans)
        var rPanel = document.getElementById('debrief-panel-resources');
        if (rPanel && _rowExpanded.resources) {
          var hpLine = _renderBarLine('♥', st.hp, st.maxHp, 6);
          var enLine = _renderBarLine('E', st.energy, st.maxEnergy, 6);
          var fcLine = _renderBarLine('◎', st.focus, st.maxFocus, 6);

          rPanel.innerHTML =
            '<div class="debrief-line hp">|_' + hpLine + '</div>' +
            '<div class="debrief-line energy">|_' + enLine + '</div>' +
            '<div class="debrief-line focus">|_' + fcLine + '</div>';
        } else if (rPanel) {
          rPanel.textContent = '';
        }

        // Ammo macro summary
        var amEl = document.getElementById('debrief-summary-ammo');
        if (amEl) {
          var ammo = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getAmmo) ? GAMESTATE.getAmmo() : (st.ammo || 0);
          var maxA = st.maxAmmo || 20;
          var keyAmmoTotal = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getTotalKeyAmmo) ? GAMESTATE.getTotalKeyAmmo() : 0;
          var ammoSummary = _renderBarLine('A', ammo, maxA, 6);
          if (keyAmmoTotal > 0) ammoSummary += ' 🔑x' + keyAmmoTotal;
          amEl.textContent = ammoSummary;
        }

        // Ammo panel: weapon ammo bar + key_ammo resource + key_item counts
        var aPanel = document.getElementById('debrief-panel-ammo');
        if (aPanel && _rowExpanded.ammo) {
          var linesA = [];
          var ammo2 = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getAmmo) ? GAMESTATE.getAmmo() : (st.ammo || 0);
          var maxA2 = st.maxAmmo || 20;
          linesA.push('|_' + _renderBarLine('A', ammo2, maxA2, 6));

          var kc = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getKeyCounts) ? GAMESTATE.getKeyCounts() : null;
          // key_ammo (Tier 1) — consumable chest/lock keys, tracked as resource
          function addKeyLine(label, bucket, keyType) {
            try {
              var n = kc && kc[bucket] && kc[bucket][keyType] ? kc[bucket][keyType] : 0;
              if (n > 0) linesA.push('|_' + label + ':' + n);
            } catch (e0) {}
          }
          addKeyLine('🔑 KEY AMMO Rusty', 'ammo', 'RUSTY_KEY');
          addKeyLine('🗝️ KEY AMMO Bronze', 'ammo', 'BRONZE_KEY');
          // key_items (Tier 2) — persistent door/gate keys tracked for awareness
          addKeyLine('💳 KEY ITEM Keycard', 'gate', 'KEYCARD');
          addKeyLine('🏷️ KEY ITEM Mall', 'gate', 'MALL_KEY');

          aPanel.textContent = linesA.join('\n');
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

      // Signal summary (battery-driven pulse, 3-tier speed)
      // Center of ((( ))) shows real device battery: [===] full, [==-] mid, [=--] low, [---] empty
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

            function _deviceBar() {
              var lv = _deviceBatt.level;
              if (lv >= 0.67) return '[===]';
              if (lv >= 0.34) return '[==-]';
              if (lv > 0.05) return '[=--]';
              return '[---]';
            }

            // ── In-game battery (resource) ──
            function _getBatt() {
              var st = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getState) ? GAMESTATE.getState() : {};
              var batt = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getBattery) ? GAMESTATE.getBattery() : (st.battery || 0);
              var maxB = st.maxBattery || 5;
              return { batt: batt || 0, maxB: maxB || 5 };
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
              var devBar = _deviceBar();
              var rowElS = null;
              try { rowElS = document.querySelector('.debrief-nav-row[data-row="signal"]'); } catch (e0) {}

              // Device battery depleted: grey out entire row, stop pulse
              if (_deviceBatt.level <= 0.05 && _deviceBatt.supported) {
                sumS.textContent = '(((' + devBar + ')))';
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
                // In-game battery = 0: powered down avatar
                sumS.textContent = '(((' + devBar + ')))';
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

              // Stable-width signal grammar: "(((" + device battery bar + ")))".
              sumS.textContent = '(((' + devBar + ')))';

              // Toggle pulse class for color/glow
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
    }

    _attachEventHandlers();
  }

  /**
   * Render video display
   */
  function _renderVideo() {
    // Video takes full priority
    // Placeholder implementation
    var html = '<div class="debrief-video-display">';
    html += '<div class="video-player-container">';
    html += '<p>Video player would display here</p>';
    html += '</div>';
    html += '</div>';

    _debriefScreen.innerHTML = html;
  }

  /**
   * Render kernel API status
   * @returns {string} HTML
   */
  function _renderKernelStatus() {
    // TODO: Connect to actual kernel API system
    var status = 'connected'; // 'connected', 'disconnected', 'error'
    var statusIcon = status === 'connected' ? '🟢' : status === 'disconnected' ? '🔴' : '🟡';
    var statusText = status === 'connected' ? 'Connected' : status === 'disconnected' ? 'Disconnected' : 'Error';

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
      _render();
    }
  }

  /**
   * Set video playing state
   * @param {boolean} playing
   */
  function setVideoPlaying(playing) {
    _videoPlaying = playing;
    _render();
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
    if (_mokInitialized && MOKStateMachine) {
      MOKStateMachine.handleEvent({
        type: eventType,
        data: eventData
      });
    }
  }

  /**
   * Set MOK expression directly (API hook for agents)
   * @param {string} expression - Expression name (idle, talking, warning, happy, error, etc.)
   * @param {Object} options - Optional color and timing overrides
   */
  function setMOKExpression(expression, options) {
    if (!_mokInitialized || !MOKVisualEngine) {
      return;
    }

    MOKVisualEngine.setExpression(expression, options);
  }

  /**
   * Set custom MOK glow colors (API hook for agents)
   * @param {string} primaryColor - Primary glow color (hex)
   * @param {string} secondaryColor - Secondary glow color (hex)
   * @param {number} pulseSpeed - Pulse speed in ms (optional)
   */
  function setMOKGlowColors(primaryColor, secondaryColor, pulseSpeed) {
    if (!_mokInitialized || !MOKVisualEngine) {
      return;
    }

    MOKVisualEngine.setCustomGlowColors(primaryColor, secondaryColor, pulseSpeed);
  }

  /**
   * Get current MOK glow colors
   */
  function getMOKGlowColors() {
    if (!_mokInitialized || !MOKVisualEngine || !MOKVisualEngine.getCurrentGlowColors) {
      return null;
    }

    return MOKVisualEngine.getCurrentGlowColors();
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

    // Show in MOK interjection
    if (typeof UIControls !== 'undefined' && UIControls.updateMokInterjection) {
      UIControls.updateMokInterjection(message);
    }

    // RESOURCE_COLOR lookup for frame flash
    var RESOURCE_COLORS = {
      'HP': '#FF6B9D', 'Energy': '#00D4FF', 'Focus': '#FFF9B0',
      'Battery': '#00FFA6', 'Fatigue': '#A0522D', 'Ammo': '#DA70D6',
      'Currency': '#FFFF00', 'key_ammo': '#FF8A3D', 'Cards': '#800080'
    };

    // Pulse the debrief frame with RESOURCE_COLOR-specific glow
    try {
      if (_debriefScreen) {
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

    // If in resource display mode, refresh to show updated values
    if (_currentDisplay === 'resources' && typeof DebriefFeedRenderer !== 'undefined') {
      DebriefFeedRenderer.render();
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

    // Visual feedback hooks
    showSynergyOverlay: showSynergyOverlay,
    flashIncinerator: flashIncinerator,
    triggerBatteryRecharge: triggerBatteryRecharge
  };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    DebriefFeedController.init();
  });
} else {
  DebriefFeedController.init();
}
