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

    // Tap toggles expanded (30% <-> 50%)
    win.addEventListener('click', function(e) {
      if (!_isRogue() || !_isPortrait()) return;
      if (e && e.target && e.target.closest && e.target.closest('button, a, input, textarea, select')) return;

      var expanded = body.classList.toggle('rogue-debrief-expanded');
      if (expanded) _applyPct(50);
      else _applyPct(30);
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

      // Header row: keep the MOK selection/swapper in-line with resources
      if (_currentMode === MODES.goneRogue && _currentMode.allowCycle) {
        html += '<div class="debrief-resources-header">';
        html += '<button class="debrief-mok-swapper" id="debrief-mok-swapper" type="button" aria-label="Switch debrief view to MOK">';
        html += '<span class="mok-dot" aria-hidden="true"></span>';
        html += '<span class="mok-label">MOK</span>';
        html += '</button>';
        html += _renderCycleButton('Show MOK');
        html += '</div>';
      }

      // ASCII/Pip-boy style rows (no emoji spam)
      function abbr(s) {
        try {
          if (typeof MicroAbbreviator !== 'undefined' && MicroAbbreviator.get) return MicroAbbreviator.get(s);
        } catch (e0) {}
        // fallback: vowel-drop
        return String(s || '').toUpperCase().replace(/[AEIOU]/g, '');
      }

      html += '<div id="debrief-resources-content" class="debrief-resources-content">';
      html +=   '<div class="debrief-nav-list" id="debrief-nav-list" aria-label="Debrief rows">';

      html +=     '<div class="debrief-nav-row" data-section="resources">' +
                 '  <span class="debrief-row-label">' + abbr('RESOURCES') + '</span>' +
                 '  <span class="debrief-row-summary" id="debrief-summary-resources"></span>' +
                 '</div>';

      html +=     '<div class="debrief-nav-row" data-section="battery">' +
                 '  <span class="debrief-row-label">' + abbr('SIGNAL') + '</span>' +
                 '  <span class="debrief-row-summary" id="debrief-summary-signal"></span>' +
                 '</div>';

      html +=     '<div class="debrief-nav-row" data-section="passives">' +
                 '  <span class="debrief-row-label">' + abbr('PASSIVES') + '</span>' +
                 '  <span class="debrief-row-summary" id="debrief-summary-passives"></span>' +
                 '</div>';

      html +=     '<div class="debrief-nav-row" data-section="api">' +
                 '  <span class="debrief-row-label">' + abbr('API') + '</span>' +
                 '  <span class="debrief-row-summary" id="debrief-summary-api"></span>' +
                 '</div>';

      html +=     '<div class="debrief-nav-row" data-section="mok">' +
                 '  <span class="debrief-row-label">' + abbr('MOK') + '</span>' +
                 '  <span class="debrief-row-summary" id="debrief-summary-mok"></span>' +
                 '</div>';

      html +=   '</div>';

      html +=   '<div class="debrief-section" id="debrief-sec-resources"></div>';
      html +=   '<div class="debrief-section" id="debrief-sec-battery" style="display:none"></div>';
      html +=   '<div class="debrief-section" id="debrief-sec-passives" style="display:none"></div>';
      html +=   '<div class="debrief-section" id="debrief-sec-api" style="display:none"></div>';
      html +=   '<div class="debrief-section" id="debrief-sec-mok" style="display:none"></div>';
      html += '</div>';
      html += '</div>';

      _debriefScreen.innerHTML = html;

      // Render resources into resources section synchronously
      var resArea = document.getElementById('debrief-sec-resources');
      if (resArea) {
        DebriefFeedRenderer.renderInto(resArea);
      }

      // Minimized summaries (top-line only)
      try {
        var sumR = document.getElementById('debrief-summary-resources');
        if (sumR && DebriefFeedRenderer.renderSummaryInto) {
          DebriefFeedRenderer.renderSummaryInto(sumR);
        }
      } catch (eS0) {}

      // Signal summary (3-tier: LOW/MID/HIGH) driven by battery level
      try {
        var sumS = document.getElementById('debrief-summary-signal');
        if (sumS) {
          var st = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getState) ? GAMESTATE.getState() : {};
          var batt = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getBattery) ? GAMESTATE.getBattery() : (st.battery || 0);
          var maxB = st.maxBattery || 5;
          var pct = maxB ? (batt / maxB) : 0;
          var tier = (pct <= 0.34) ? 'LOW' : (pct <= 0.67) ? 'MID' : 'HIGH';

          function bar(cur, max, w) {
            w = w || 8;
            max = max || 1;
            cur = Math.max(0, Math.min(max, cur));
            var filled = Math.round((cur / max) * w);
            var s = '';
            for (var i = 0; i < w; i++) s += (i < filled) ? '█' : '░';
            return s;
          }

          var link = (tier === 'HIGH') ? '(((' : (tier === 'MID') ? '((' : '(';
          // pad to 3 for consistent width
          link = (link + '   ').slice(0, 3);
          sumS.textContent = 'BATT[' + bar(batt, maxB, 6) + '] ' + tier + ' ' + link;
        }
      } catch (eS1) {}

      // Other summaries (cheap placeholders)
      try { var p0 = document.getElementById('debrief-summary-passives'); if (p0) p0.textContent = '—'; } catch (eS2) {}
      try { var a0 = document.getElementById('debrief-summary-api'); if (a0) a0.textContent = '—'; } catch (eS3) {}
      try { var m0 = document.getElementById('debrief-summary-mok'); if (m0) m0.textContent = 'IDLE'; } catch (eS4) {}

      // Fill other sections (lightweight placeholders for now)
      var bat = document.getElementById('debrief-sec-battery');
      if (bat) bat.innerHTML = '<div class="debrief-mini-block">Signal / Battery details</div>';
      var pas = document.getElementById('debrief-sec-passives');
      if (pas) pas.innerHTML = '<div class="debrief-mini-block">Passives & Debuffs</div>';
      var api = document.getElementById('debrief-sec-api');
      if (api) api.innerHTML = '<div class="debrief-mini-block">API / Checks</div>';
      var mok = document.getElementById('debrief-sec-mok');
      if (mok) mok.innerHTML = '<div class="debrief-mini-block">MOK (resources view)</div>';

      _setupDragNav();

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

    // Pulse the debrief window on resource changes (monochrome)
    try {
      if (_debriefScreen) {
        _debriefScreen.classList.remove('debrief-pulse-pos');
        _debriefScreen.classList.remove('debrief-pulse-neg');
        var cls = change >= 0 ? 'debrief-pulse-pos' : 'debrief-pulse-neg';
        // restart animation
        void _debriefScreen.offsetWidth;
        _debriefScreen.classList.add(cls);
        setTimeout(function() {
          try {
            _debriefScreen.classList.remove('debrief-pulse-pos');
            _debriefScreen.classList.remove('debrief-pulse-neg');
          } catch (eP0) {}
        }, 260);
      }
    } catch (eP1) {}

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
    flashIncinerator: flashIncinerator
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
