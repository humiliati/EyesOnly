/* ============================================================
   Constellation Gamestate — Cross-Page Persistence
   ============================================================
   Persists via localStorage:
     - Solved constellations (by ID)
     - Current currency balance
     - Forever pixels (star marks from solved constellations)
     - Current level (next unsolved constellation index)

   All pages share the same state. When a user solves constellations
   on the splash page, navigates to booking, the starfield shows
   their burned-in forever pixels and the next unsolved level loads.

   Usage:
     ConstellationGamestate.init()
     ConstellationGamestate.markSolved('tutorial-triangle', 6)
     ConstellationGamestate.getCurrency()
     ConstellationGamestate.getSolvedIds()
     ConstellationGamestate.getNextLevel()
   ============================================================ */

;(function (root) {
  'use strict';

  var STORAGE_KEY = 'eyesonly_constellation_state';

  // ── Default state ──
  var _state = {
    solvedIds: [],       // constellation IDs that have been completed
    currency: 0,         // total coins earned
    foreverPixels: [],   // [{x,y}, ...] — permanent star marks (normalized 0..1)
    version: 1,
  };

  // ── Load / Save ──

  function _load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.version) {
          _state = parsed;
        }
      }
    } catch (e) {
      console.warn('[ConstellationGamestate] Failed to load:', e);
    }
  }

  function _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
    } catch (e) {
      console.warn('[ConstellationGamestate] Failed to save:', e);
    }
  }

  // ── Public API ──

  function init() {
    _load();

    // Sync forever pixels into SuitNodeRenderer if it's already initialized
    _syncForeverPixels();

    // Listen for constellation-solved events — persist solve + forever pixels
    // (currency is handled separately by currency-increment events below)
    document.addEventListener('constellation-solved', function (e) {
      var detail = e.detail || {};
      if (detail.constellationId && !isSolved(detail.constellationId)) {
        markSolved(detail.constellationId);
      }
    });

    // Listen for currency-increment events (from resolution animation counter)
    document.addEventListener('currency-increment', function (e) {
      var detail = e.detail || {};
      if (detail.amount) {
        _state.currency += detail.amount;
        _save();
        _syncToAccount(detail.amount);
        _broadcastCurrency();
      }
    });

    // Bridge: update the visible currency counter on any page that has one
    document.addEventListener('currency-updated', function (e) {
      var total = (e.detail && e.detail.currency) || _state.currency;
      var wholeCoins = Math.floor(total);
      // Terminal page: UIControls has an animated ticker
      if (typeof UIControls !== 'undefined' && UIControls.updateCurrency) {
        UIControls.updateCurrency(wholeCoins);
      } else {
        // Other pages: direct DOM update on #currency-value
        var el = document.getElementById('currency-value');
        if (el) el.textContent = String(wholeCoins).padStart(8, '0');
      }
    });

    // Set initial display from loaded state
    var initCoins = Math.floor(_state.currency);
    if (typeof UIControls !== 'undefined' && UIControls.updateCurrency) {
      UIControls.updateCurrency(initCoins);
    } else {
      var initEl = document.getElementById('currency-value');
      if (initEl && initCoins > 0) initEl.textContent = String(initCoins).padStart(8, '0');
    }

    console.log('[ConstellationGamestate] Initialized — solved:',
                _state.solvedIds.length, 'currency:', _state.currency,
                'foreverPixels:', _state.foreverPixels.length);
  }

  /**
   * Mark a constellation as solved and persist forever pixels.
   * NOTE: Does NOT add currency here. Currency is awarded incrementally
   * via 'currency-increment' events from the resolution animation counter.
   * This prevents double-counting (markSolved + increment listener).
   */
  function markSolved(constellationId) {
    if (isSolved(constellationId)) return;

    _state.solvedIds.push(constellationId);

    // Capture forever pixels from SuitNodeRenderer
    if (typeof SuitNodeRenderer !== 'undefined' && SuitNodeRenderer.getForeverPixels) {
      _state.foreverPixels = SuitNodeRenderer.getForeverPixels().slice();
    }

    _save();

    console.log('[ConstellationGamestate] Solved:', constellationId,
                'Currency:', _state.currency);
  }

  function isSolved(constellationId) {
    return _state.solvedIds.indexOf(constellationId) !== -1;
  }

  function getSolvedIds() {
    return _state.solvedIds.slice();
  }

  function getCurrency() {
    return _state.currency;
  }

  function getForeverPixels() {
    return _state.foreverPixels.slice();
  }

  /**
   * Returns the index of the next unsolved level (0-based).
   * Matches against the ordered constellation list from ConstellationLoader.
   */
  function getNextLevelIndex() {
    return _state.solvedIds.length;
  }

  /**
   * Sync persisted forever pixels into SuitNodeRenderer.
   * Called on init so burned-in stars appear immediately on any page.
   */
  function _syncForeverPixels() {
    if (_state.foreverPixels.length === 0) return;
    if (typeof SuitNodeRenderer === 'undefined') {
      // Retry after SuitNodeRenderer might init
      setTimeout(_syncForeverPixels, 500);
      return;
    }
    // Merge our persisted pixels into the renderer
    var existing = SuitNodeRenderer.getForeverPixels ? SuitNodeRenderer.getForeverPixels() : [];
    var existingSet = {};
    existing.forEach(function (fp) { existingSet[fp.x + ',' + fp.y] = true; });

    var added = 0;
    _state.foreverPixels.forEach(function (fp) {
      var key = fp.x + ',' + fp.y;
      if (!existingSet[key]) {
        existing.push(fp);
        added++;
      }
    });

    if (added > 0 && SuitNodeRenderer._setForeverPixels) {
      SuitNodeRenderer._setForeverPixels(existing);
      console.log('[ConstellationGamestate] Synced', added, 'forever pixels into renderer');
    }
  }

  /**
   * Sync constellation coins into the shared eyesonly_account.puzzleCoins
   * so PuzzleState, terminal SCORE command, and other systems see the balance.
   */
  function _syncToAccount(amount) {
    try {
      var acct = JSON.parse(localStorage.getItem('eyesonly_account') || '{}');
      acct.puzzleCoins = (acct.puzzleCoins || 0) + amount;
      localStorage.setItem('eyesonly_account', JSON.stringify(acct));
    } catch (e) {}
  }

  function _broadcastCurrency() {
    try {
      document.dispatchEvent(new CustomEvent('currency-updated', {
        detail: { currency: _state.currency },
      }));
    } catch (e) {}
  }

  /**
   * Reset all state (for testing).
   */
  function reset() {
    _state = { solvedIds: [], currency: 0, foreverPixels: [], version: 1 };
    _save();
    try { localStorage.removeItem('eyesonly_forever_sky'); } catch (e) {}
    console.log('[ConstellationGamestate] Reset');
  }

  // ── Export ──

  root.ConstellationGamestate = {
    init:              init,
    markSolved:        markSolved,
    isSolved:          isSolved,
    getSolvedIds:      getSolvedIds,
    getCurrency:       getCurrency,
    getForeverPixels:  getForeverPixels,
    getNextLevelIndex: getNextLevelIndex,
    reset:             reset,
  };

})(typeof window !== 'undefined' ? window : this);
