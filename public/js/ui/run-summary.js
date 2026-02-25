/* ============================================================
   EYES ONLY - Post-Run Summary Screen
   Shown after a Gone Rogue run ends (extraction or death).
   Displays run stats, tier progress, and player identity.

   Auto-dismisses after ~5s or skip with click/key/enter.
   ============================================================ */

const RunSummary = (function () {
  'use strict';

  var _isShowing = false;
  var _onComplete = null;
  var _overlay = null;
  var _skipHandler = null;
  var _autoTimer = null;

  /**
   * Show the post-run summary.
   * @param {Object} opts
   * @param {boolean} opts.success     - True if extracted, false if died
   * @param {number}  opts.floor       - Final floor reached
   * @param {number}  opts.duration    - Run duration in ms
   * @param {number}  opts.kills       - Enemies killed
   * @param {number}  opts.currency    - Currency collected
   * @param {number}  opts.score       - Highscore value (if available)
   * @param {boolean} opts.tierUp      - Whether a new tier was unlocked this run
   * @param {number}  opts.newTier     - The new tier (if tierUp is true)
   * @param {Function} opts.onComplete - Called when overlay dismisses
   */
  function show(opts) {
    if (_isShowing) return;
    _isShowing = true;
    opts = opts || {};

    _onComplete = opts.onComplete || null;

    var success = opts.success || false;
    var floor = opts.floor || 1;
    var duration = opts.duration || 0;
    var kills = opts.kills || 0;
    var currency = opts.currency || 0;
    var score = opts.score || 0;
    var tierUp = opts.tierUp || false;
    var newTier = opts.newTier || 0;

    // Get player state
    var ps = {};
    if (typeof TerminalCommandRouter !== 'undefined' && TerminalCommandRouter.getPlayerState) {
      ps = TerminalCommandRouter.getPlayerState();
    }

    // Clean up
    var existing = document.getElementById('run-summary');
    if (existing) existing.remove();

    _overlay = document.createElement('div');
    _overlay.id = 'run-summary';
    _overlay.className = 'rs-overlay';

    // Outcome header
    var outcomeClass = success ? 'rs-outcome rs-success' : 'rs-outcome rs-failure';
    var outcomeText = success ? 'EXTRACTION SUCCESSFUL' : 'OPERATIVE DOWN';
    var outcome = _el('div', outcomeClass, outcomeText);
    _overlay.appendChild(outcome);

    // Player identity
    var emoji = ps.avatarEmoji || '🕵️';
    var callsign = ps.callsign || 'AGENT';
    var identity = _el('div', 'rs-identity', emoji + '  ' + callsign);
    _overlay.appendChild(identity);

    // Divider
    _overlay.appendChild(_el('div', 'rs-divider', '═══════════════════════════'));

    // Stats grid
    var statsGrid = document.createElement('div');
    statsGrid.className = 'rs-stats';

    _addStat(statsGrid, 'FLOOR', '' + floor);
    _addStat(statsGrid, 'KILLS', '' + kills);
    _addStat(statsGrid, 'CURRENCY', '¢' + currency);
    _addStat(statsGrid, 'TIME', _formatDuration(duration));

    _overlay.appendChild(statsGrid);

    // Score
    if (score > 0) {
      var scoreEl = _el('div', 'rs-score', 'SCORE: ' + score);
      _overlay.appendChild(scoreEl);
    }

    // Lifetime stats
    _overlay.appendChild(_el('div', 'rs-divider rs-divider-thin', '─────────────────────────'));

    var lifetime = document.createElement('div');
    lifetime.className = 'rs-lifetime';

    var totalRuns = ps.totalRuns || 0;
    var bestFloor = ps.bestFloor || 0;
    var tier = ps.completedTiers || 0;
    lifetime.appendChild(_el('div', 'rs-lifetime-stat', 'RUNS: ' + totalRuns + '  ·  BEST: F' + bestFloor + '  ·  TIER: ' + tier));

    _overlay.appendChild(lifetime);

    // Tier-up callout
    if (tierUp && newTier > 0) {
      var tierCallout = _el('div', 'rs-tier-up', '★ TIER ' + newTier + ' CLEARANCE ACHIEVED ★');
      _overlay.appendChild(tierCallout);
    }

    // Hint
    var hint = _el('div', 'rs-hint', 'Press any key to continue...');
    _overlay.appendChild(hint);

    document.body.appendChild(_overlay);

    // Skip handler (delayed to prevent accidental dismiss)
    _skipHandler = function (e) {
      if (e.type === 'keydown' && (e.key === 'Tab' || e.key === 'Shift')) return;
      _dismiss();
    };

    setTimeout(function () {
      document.addEventListener('keydown', _skipHandler);
      if (_overlay) _overlay.addEventListener('click', _skipHandler);
    }, 1000);

    // Auto-dismiss
    _autoTimer = setTimeout(function () {
      _dismiss();
    }, 8000);
  }

  function _dismiss() {
    if (!_isShowing) return;

    if (_skipHandler) {
      document.removeEventListener('keydown', _skipHandler);
      _skipHandler = null;
    }
    if (_autoTimer) {
      clearTimeout(_autoTimer);
      _autoTimer = null;
    }

    if (_overlay) {
      _overlay.classList.add('rs-fade-out');

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
    stat.className = 'rs-stat';
    stat.appendChild(_el('div', 'rs-stat-value', value));
    stat.appendChild(_el('div', 'rs-stat-label', label));
    container.appendChild(stat);
  }

  function _formatDuration(ms) {
    if (!ms || ms <= 0) return '0:00';
    var totalSec = Math.floor(ms / 1000);
    var min = Math.floor(totalSec / 60);
    var sec = totalSec % 60;
    return min + ':' + (sec < 10 ? '0' : '') + sec;
  }

  return {
    show: show,
    skip: skip,
    isShowing: isShowing
  };
})();
