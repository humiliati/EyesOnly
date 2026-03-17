/**
 * PuzzleState — Cross-page puzzle registry & clue tracker (Phase 7)
 *
 * Connects isolated per-page reveal-zone discoveries into multi-step
 * puzzle chains. Each puzzle is a named collection of clue IDs drawn
 * from zones across multiple pages. When all clues for a puzzle are
 * found, the puzzle resolves — triggering a reward, unlocking a route,
 * or revealing a new set of zones.
 *
 * Storage:
 *   localStorage['eyesonly_puzzle_state'] — JSON blob of all puzzle progress
 *   Reads from localStorage['eyesonly_revealed_items'] (set by reveal-grid.js)
 *
 * Integration:
 *   - reveal-grid.js calls PuzzleState.onClueFound(zoneId) after lock-in
 *   - nch-overlay.js reads PuzzleState.getBadgeCount() for joker stack badge
 *   - constellation-tracer.js (Phase 8+) calls PuzzleState.onConstellationSolved()
 *   - Pages include puzzle-state.js before other scripts that depend on it
 *
 * Stateless IIFE — all persistent state in localStorage.
 */
var PuzzleState = (function () {
  'use strict';

  // ── Constants ──
  var STORAGE_KEY = 'eyesonly_puzzle_state';
  var REVEALED_KEY = 'eyesonly_revealed_items';
  var PUZZLES_URL = '/data/puzzles.json';

  // ── In-memory state (hydrated from localStorage on init) ──
  var _puzzles = [];        // puzzle definitions from puzzles.json
  var _state = null;        // { found: {}, solved: {}, hintTimers: {} }
  var _listeners = [];      // onChange callbacks
  var _initialized = false;

  // ── Storage helpers ──

  function _loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return { found: {}, solved: {}, hintTimers: {} };
  }

  function _saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
    } catch (_) {}
  }

  function _getRevealedItems() {
    try {
      var raw = localStorage.getItem(REVEALED_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return {};
  }

  // ── Puzzle registry ──

  /**
   * Load puzzle definitions from JSON (or accept inline array).
   * Each puzzle: { id, name, clues: [zoneId, ...], reward, hint, route }
   */
  function _loadPuzzles(defs) {
    _puzzles = Array.isArray(defs) ? defs : [];
    console.log('[PuzzleState] Loaded ' + _puzzles.length + ' puzzle definitions');
  }

  /**
   * Fetch puzzles.json from server, fallback to inline definitions.
   */
  function _fetchPuzzles(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', PUZZLES_URL, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);
          _loadPuzzles(data.puzzles || data);
        } catch (e) {
          console.warn('[PuzzleState] Failed to parse puzzles.json:', e);
        }
      } else {
        console.warn('[PuzzleState] Could not fetch puzzles.json (status ' + xhr.status + '), using inline definitions');
      }
      if (typeof callback === 'function') callback();
    };
    xhr.send();
  }

  // ── Clue tracking ──

  /**
   * Record a clue as found. Called by reveal-grid.js on lock-in,
   * or by constellation-tracer.js on constellation solve.
   *
   * @param {string} clueId — zone ID or constellation ID
   * @param {string} [source] — 'reveal' | 'constellation' | 'manual'
   */
  function onClueFound(clueId, source) {
    if (!_state) _state = _loadState();
    if (_state.found[clueId]) return; // already found

    _state.found[clueId] = {
      at: Date.now(),
      source: source || 'reveal',
      page: window.location.pathname
    };
    _saveState();

    console.log('[PuzzleState] Clue found: ' + clueId + ' (source: ' + (source || 'reveal') + ')');

    // Check if any puzzles just completed
    _checkCompletions();

    // Notify listeners (badge update, UI refresh, etc.)
    _notifyListeners('clue', clueId);
  }

  /**
   * Convenience: mark a constellation as solved (Phase 8+ integration).
   * The constellation ID acts as a clue in the puzzle registry.
   */
  function onConstellationSolved(constellationId, reward) {
    onClueFound('constellation:' + constellationId, 'constellation');
  }

  // ── Completion detection ──

  function _checkCompletions() {
    _puzzles.forEach(function (puzzle) {
      if (_state.solved[puzzle.id]) return; // already solved

      var allFound = puzzle.clues.every(function (clueId) {
        return !!_state.found[clueId];
      });

      if (allFound) {
        _solvePuzzle(puzzle);
      }
    });
  }

  function _solvePuzzle(puzzle) {
    _state.solved[puzzle.id] = {
      at: Date.now(),
      clues: puzzle.clues.slice()
    };
    _saveState();

    console.log('[PuzzleState] Puzzle SOLVED: ' + puzzle.id + ' (' + puzzle.name + ')');

    // Dispatch reward
    if (puzzle.reward && puzzle.reward.coins) {
      _awardCoins(puzzle.reward.coins);
    }

    // Unlock route if specified
    if (puzzle.reward && puzzle.reward.route) {
      _unlockRoute(puzzle.reward.route);
    }

    // Reveal new zones if specified
    if (puzzle.reward && puzzle.reward.revealZones) {
      _revealNewZones(puzzle.reward.revealZones);
    }

    _notifyListeners('solved', puzzle.id);
  }

  // ── Reward dispatch ──

  function _awardCoins(amount) {
    try {
      var acct = JSON.parse(localStorage.getItem('eyesonly_account') || '{}');
      acct.puzzleCoins = (acct.puzzleCoins || 0) + amount;
      localStorage.setItem('eyesonly_account', JSON.stringify(acct));
      console.log('[PuzzleState] Awarded ' + amount + ' coins');
    } catch (_) {}
  }

  function _unlockRoute(route) {
    try {
      var unlocked = JSON.parse(localStorage.getItem('eyesonly_unlocked_routes') || '[]');
      if (unlocked.indexOf(route) === -1) {
        unlocked.push(route);
        localStorage.setItem('eyesonly_unlocked_routes', JSON.stringify(unlocked));
        console.log('[PuzzleState] Route unlocked: ' + route);
      }
    } catch (_) {}
  }

  function _revealNewZones(zoneIds) {
    // Signal to reveal-grid.js to add new zones dynamically
    // Uses a simple event dispatch pattern
    if (typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('puzzlestate:reveal-zones', {
        detail: { zoneIds: zoneIds }
      }));
    }
  }

  // ── Hint system ──

  /**
   * Get a hint for the most-progressed incomplete puzzle.
   * Returns null if no hints available or all puzzles solved.
   */
  function getHint() {
    var best = null;
    var bestProgress = -1;

    _puzzles.forEach(function (puzzle) {
      if (_state.solved[puzzle.id]) return;

      var found = puzzle.clues.filter(function (c) { return !!_state.found[c]; }).length;
      var progress = found / puzzle.clues.length;

      if (progress > bestProgress && puzzle.hint) {
        bestProgress = progress;
        best = {
          puzzleId: puzzle.id,
          puzzleName: puzzle.name,
          hint: puzzle.hint,
          progress: found + '/' + puzzle.clues.length,
          progressPct: Math.round(progress * 100)
        };
      }
    });

    return best;
  }

  // ── Query API ──

  /**
   * Get badge count for NCH widget: total found clues / total needed.
   * Returns { found, total, solved, totalPuzzles }
   */
  function getBadgeCount() {
    if (!_state) _state = _loadState();

    var totalClues = 0;
    var foundClues = 0;
    var solvedPuzzles = 0;

    _puzzles.forEach(function (puzzle) {
      totalClues += puzzle.clues.length;
      if (_state.solved[puzzle.id]) {
        solvedPuzzles++;
        foundClues += puzzle.clues.length;
      } else {
        puzzle.clues.forEach(function (c) {
          if (_state.found[c]) foundClues++;
        });
      }
    });

    return {
      found: foundClues,
      total: totalClues,
      solved: solvedPuzzles,
      totalPuzzles: _puzzles.length
    };
  }

  /**
   * Check if a specific puzzle is solved.
   */
  function isSolved(puzzleId) {
    if (!_state) _state = _loadState();
    return !!_state.solved[puzzleId];
  }

  /**
   * Check if a specific clue has been found.
   */
  function isClueFound(clueId) {
    if (!_state) _state = _loadState();
    return !!_state.found[clueId];
  }

  /**
   * Get progress for a specific puzzle.
   * Returns { found: number, total: number, complete: boolean }
   */
  function getPuzzleProgress(puzzleId) {
    if (!_state) _state = _loadState();

    var puzzle = _puzzles.find(function (p) { return p.id === puzzleId; });
    if (!puzzle) return null;

    var found = puzzle.clues.filter(function (c) { return !!_state.found[c]; }).length;
    return {
      found: found,
      total: puzzle.clues.length,
      complete: !!_state.solved[puzzleId]
    };
  }

  /**
   * Get all puzzle definitions (for UI rendering).
   */
  function getPuzzles() {
    return _puzzles.slice();
  }

  // ── Listener system ──

  function onChange(callback) {
    if (typeof callback === 'function') {
      _listeners.push(callback);
    }
  }

  function _notifyListeners(eventType, id) {
    _listeners.forEach(function (fn) {
      try { fn(eventType, id); } catch (_) {}
    });
  }

  // ── Sync with reveal-grid discovered items ──

  /**
   * On init, cross-reference already-revealed items with puzzle clues.
   * This catches clues found before puzzle-state.js was loaded.
   */
  function _syncRevealedItems() {
    var revealed = _getRevealedItems();
    var foundAny = false;

    Object.keys(revealed).forEach(function (zoneId) {
      if (!_state.found[zoneId]) {
        _state.found[zoneId] = {
          at: revealed[zoneId].at || Date.now(),
          source: 'reveal-sync',
          page: revealed[zoneId].page || 'unknown'
        };
        foundAny = true;
      }
    });

    if (foundAny) {
      _saveState();
      _checkCompletions();
    }
  }

  // ── Init ──

  /**
   * Initialize the puzzle state system.
   * @param {Object} [opts]
   * @param {Array}  [opts.puzzles] — inline puzzle definitions (skip fetch)
   * @param {Function} [opts.onReady] — callback when init complete
   */
  function init(opts) {
    if (_initialized) return;
    _initialized = true;
    opts = opts || {};

    _state = _loadState();

    if (opts.puzzles) {
      _loadPuzzles(opts.puzzles);
      _syncRevealedItems();
      if (typeof opts.onReady === 'function') opts.onReady();
    } else {
      _fetchPuzzles(function () {
        _syncRevealedItems();
        if (typeof opts.onReady === 'function') opts.onReady();
      });
    }

    // Listen for future reveal-grid discoveries
    window.addEventListener('revealGrid:locked', function (e) {
      if (e.detail && e.detail.zoneId) {
        onClueFound(e.detail.zoneId, 'reveal');
      }
    });

    console.log('[PuzzleState] Initialized. Found clues: ' +
      Object.keys(_state.found).length + ', Solved: ' +
      Object.keys(_state.solved).length);
  }

  /**
   * Reset all puzzle progress (debug / dev tool).
   */
  function reset() {
    _state = { found: {}, solved: {}, hintTimers: {} };
    _saveState();
    _notifyListeners('reset', null);
    console.log('[PuzzleState] All progress reset');
  }

  // ── Public API ──
  return {
    init: init,
    onClueFound: onClueFound,
    onConstellationSolved: onConstellationSolved,
    getBadgeCount: getBadgeCount,
    getHint: getHint,
    isSolved: isSolved,
    isClueFound: isClueFound,
    getPuzzleProgress: getPuzzleProgress,
    getPuzzles: getPuzzles,
    onChange: onChange,
    reset: reset
  };

})();
