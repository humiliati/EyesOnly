/* ============================================================
   EYES ONLY - Welcome Back Screen
   Shown to returning players (who already have a callsign) when
   entering Gone Rogue. Displays stats recap, then fades into
   gameplay. Replaces the generic splash for returning operatives.

   Timeline:
     0ms       — Overlay fades in (400ms)
     400ms     — Identity + stats visible
     2800ms    — Auto-advance (or click/key to skip)
     3200ms    — Overlay fades out (400ms)
     3600ms    — onComplete() fires
   ============================================================ */

const WelcomeBack = (function () {
  'use strict';

  var _isShowing = false;
  var _onComplete = null;
  var _overlay = null;
  var _skipHandler = null;
  var _autoTimer = null;

  /**
   * Show the welcome-back screen.
   * @param {Object}   opts
   * @param {Object}   opts.playerState  - From TerminalCommandRouter.getPlayerState()
   * @param {Function} opts.onComplete   - Called when screen dismisses
   */
  function show(opts) {
    if (_isShowing) return;
    _isShowing = true;
    opts = opts || {};

    var ps = opts.playerState || {};
    _onComplete = opts.onComplete || null;

    // Clean up
    var existing = document.getElementById('welcome-back');
    if (existing) existing.remove();

    // Build overlay
    _overlay = document.createElement('div');
    _overlay.id = 'welcome-back';
    _overlay.className = 'wb-overlay';

    // Subtitle
    var subtitle = _el('div', 'wb-subtitle', '// OPERATIVE RECOGNIZED');
    _overlay.appendChild(subtitle);

    // Identity: avatar + callsign
    var emoji = ps.avatarEmoji || '🕵️';
    var callsign = ps.callsign || 'AGENT';
    var identity = _el('div', 'wb-identity', emoji + '  ' + callsign);
    _overlay.appendChild(identity);

    // Tier badge
    var tier = ps.completedTiers || 0;
    var tierText = 'TIER ' + tier + ' CLEARANCE';
    var tierEl = _el('div', 'wb-tier', tierText);
    _overlay.appendChild(tierEl);

    // Divider
    var divider = _el('div', 'wb-divider', '─────────────────────');
    _overlay.appendChild(divider);

    // Stats grid
    var statsGrid = document.createElement('div');
    statsGrid.className = 'wb-stats';

    var totalRuns = ps.totalRuns || 0;
    var totalDeaths = ps.totalDeaths || 0;
    var bestFloor = ps.bestFloor || 0;
    var survivalRate = totalRuns > 0 ? Math.round(((totalRuns - totalDeaths) / totalRuns) * 100) : 0;

    _addStat(statsGrid, 'RUNS', '' + totalRuns);
    _addStat(statsGrid, 'BEST FLOOR', '' + bestFloor);
    _addStat(statsGrid, 'DEATHS', '' + totalDeaths);
    _addStat(statsGrid, 'SURVIVAL', survivalRate + '%');

    _overlay.appendChild(statsGrid);

    // Action line
    var action = _el('div', 'wb-action', 'DEPLOYING TO FIELD...');
    _overlay.appendChild(action);

    // Progress bar
    var barContainer = document.createElement('div');
    barContainer.className = 'wb-progress-container';
    var barFill = document.createElement('div');
    barFill.className = 'wb-progress-fill';
    barContainer.appendChild(barFill);
    _overlay.appendChild(barContainer);

    document.body.appendChild(_overlay);

    // Start progress bar fill
    setTimeout(function () {
      barFill.classList.add('filling');
    }, 600);

    // Skip on click/key
    _skipHandler = function (e) {
      // Don't skip on tab/shift
      if (e.type === 'keydown' && (e.key === 'Tab' || e.key === 'Shift')) return;
      _dismiss();
    };
    document.addEventListener('keydown', _skipHandler);
    _overlay.addEventListener('click', _skipHandler);

    // Auto-dismiss after ~3.2s
    _autoTimer = setTimeout(function () {
      _dismiss();
    }, 3200);
  }

  function _dismiss() {
    if (!_isShowing) return;

    // Clean up listeners and timer
    if (_skipHandler) {
      document.removeEventListener('keydown', _skipHandler);
      _skipHandler = null;
    }
    if (_autoTimer) {
      clearTimeout(_autoTimer);
      _autoTimer = null;
    }

    // Fade out
    if (_overlay) {
      _overlay.classList.add('wb-fade-out');

      setTimeout(function () {
        if (_overlay && _overlay.parentNode) {
          _overlay.parentNode.removeChild(_overlay);
        }
        _overlay = null;
        _isShowing = false;

        if (typeof _onComplete === 'function') {
          _onComplete();
        }
      }, 400);
    } else {
      _isShowing = false;
      if (typeof _onComplete === 'function') {
        _onComplete();
      }
    }
  }

  function skip() {
    _dismiss();
  }

  function isShowing() {
    return _isShowing;
  }

  // ---- Helpers ----

  function _el(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }

  function _addStat(container, label, value) {
    var stat = document.createElement('div');
    stat.className = 'wb-stat';

    var valEl = _el('div', 'wb-stat-value', value);
    stat.appendChild(valEl);

    var labelEl = _el('div', 'wb-stat-label', label);
    stat.appendChild(labelEl);

    container.appendChild(stat);
  }

  return {
    show: show,
    skip: skip,
    isShowing: isShowing
  };
})();
