/* ============================================================
   EYES ONLY - Highscore State Management
   Manages leaderboards for Gone Rogue, Arcade Games, and EyesOnly Live
   ============================================================ */

const HighscoreState = (function () {
  'use strict';

  var STORAGE_KEY = 'eyesonly_highscores';
  var ARCADE_KEY = 'eyesonly_arcade_highscores';
  var LAST_TAB_KEY = 'highscore:lastTab';

  var GAME_IDS = {
    GONE_ROGUE: 'gone_rogue',
    ARCADE_GAMES: 'arcade_games',
    EYESONLY_LIVE: 'eyesonly_live'
  };

  // Known arcade games — display name + icon
  var ARCADE_CATALOG = {
    'ski-free':     { name: 'Ski Free',     icon: '⛷️' },
    'jezzball':     { name: 'JezzBall',     icon: '🔴' },
    'frogger':      { name: 'Frogger',      icon: '🐸' },
    'snake':        { name: 'Snake',        icon: '🐍' },
    'minesweeper':  { name: 'Minesweeper',  icon: '💣' },
    'breakout':     { name: 'Breakout',     icon: '🧱' },
    'goat-runner':  { name: 'Goat Runner',  icon: '🐐' }
  };

  var MODES = {
    HUMAN: 'human',
    AGENT: 'agent'
  };

  var _highscores = {
    gone_rogue: [],
    arcade_games: [],
    eyesonly_live: []
  };

  /**
   * Initialize highscore system
   */
  function init() {
    _loadHighscores();
    _migrateStreetChronicles();
    console.log('[HighscoreState] Initialized');
  }

  /**
   * Migrate old street_chronicles key to avoid data loss
   */
  function _migrateStreetChronicles() {
    if (_highscores.street_chronicles && _highscores.street_chronicles.length > 0) {
      // Keep old data in storage but don't display it
      console.log('[HighscoreState] Legacy street_chronicles data preserved but hidden');
    }
  }

  /**
   * Load highscores from localStorage
   */
  function _loadHighscores() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        // Merge carefully — don't overwrite arcade_games with undefined
        if (parsed.gone_rogue) _highscores.gone_rogue = parsed.gone_rogue;
        if (parsed.arcade_games) _highscores.arcade_games = parsed.arcade_games;
        if (parsed.eyesonly_live) _highscores.eyesonly_live = parsed.eyesonly_live;
        // Keep legacy data accessible
        if (parsed.street_chronicles) _highscores.street_chronicles = parsed.street_chronicles;
      }
    } catch (e) {
      console.error('[HighscoreState] Failed to load highscores:', e);
    }
  }

  /**
   * Save highscores to localStorage
   */
  function _saveHighscores() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_highscores));
    } catch (e) {
      console.error('[HighscoreState] Failed to save highscores:', e);
    }
  }

  /**
   * Submit a highscore entry
   * @param {Object} entry - Highscore entry with required fields
   * @returns {Object} Result with entry_id or error
   */
  function submitHighscore(entry) {
    var validIds = Object.keys(GAME_IDS).map(function (k) { return GAME_IDS[k]; });
    if (!entry.game_id || validIds.indexOf(entry.game_id) === -1) {
      return { success: false, error: 'Invalid game_id' };
    }
    if (!entry.mode || !MODES[entry.mode.toUpperCase()]) {
      return { success: false, error: 'Invalid mode' };
    }
    if (!entry.display_name) {
      return { success: false, error: 'Missing display_name' };
    }
    if (typeof entry.score !== 'number') {
      return { success: false, error: 'Invalid score' };
    }

    // Generate entry_id
    var entryId = _generateUuid();

    // Create entry
    var scoreEntry = {
      entry_id: entryId,
      game_id: entry.game_id,
      mode: entry.mode,
      display_name: entry.display_name,
      run_id: entry.run_id || entryId,
      score: entry.score,
      metadata: entry.metadata || {},
      created_at: new Date().toISOString(),
      client_version: entry.client_version || '0.9-alpha',
      verdict: 'valid'
    };

    // For arcade games, attach the arcade_game_id to metadata
    if (entry.game_id === 'arcade_games' && entry.arcade_game_id) {
      scoreEntry.metadata.arcade_game_id = entry.arcade_game_id;
    }

    // Add to appropriate game array
    if (!_highscores[entry.game_id]) _highscores[entry.game_id] = [];
    _highscores[entry.game_id].push(scoreEntry);

    // Sort by score descending
    _highscores[entry.game_id].sort(function(a, b) {
      return b.score - a.score;
    });

    // Limit to top 100 entries per game
    if (_highscores[entry.game_id].length > 100) {
      _highscores[entry.game_id] = _highscores[entry.game_id].slice(0, 100);
    }

    _saveHighscores();

    console.log('[HighscoreState] Submitted score:', scoreEntry);

    return { success: true, entry_id: entryId };
  }

  /**
   * Get highscores for a game
   * @param {string} gameId - Game identifier
   * @param {Object} options - Filter options {mode, limit, arcadeGameId}
   * @returns {Array} Array of highscore entries
   */
  function getHighscores(gameId, options) {
    options = options || {};

    var scores = _highscores[gameId] || [];

    // Filter by mode if specified
    if (options.mode) {
      scores = scores.filter(function(entry) {
        return entry.mode === options.mode;
      });
    }

    // Filter by arcade sub-game if specified
    if (options.arcadeGameId && options.arcadeGameId !== 'all') {
      scores = scores.filter(function(entry) {
        return entry.metadata && entry.metadata.arcade_game_id === options.arcadeGameId;
      });
    }

    // Limit results
    var limit = options.limit || 50;
    scores = scores.slice(0, limit);

    return scores;
  }

  /**
   * Get arcade personal bests from the simple arcade highscore store
   * Returns { gameId: score } map
   */
  function getArcadePersonalBests() {
    try {
      var raw = localStorage.getItem(ARCADE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  /**
   * Get known arcade game IDs that have any scores
   * Merges from both the leaderboard entries and the simple personal-best store
   */
  function getArcadeGameIds() {
    var ids = {};

    // From leaderboard entries
    var entries = _highscores.arcade_games || [];
    entries.forEach(function (e) {
      if (e.metadata && e.metadata.arcade_game_id) {
        ids[e.metadata.arcade_game_id] = true;
      }
    });

    // From personal-best store
    var bests = getArcadePersonalBests();
    Object.keys(bests).forEach(function (id) {
      if (bests[id] > 0) ids[id] = true;
    });

    return Object.keys(ids).sort();
  }

  /**
   * Get last active tab
   */
  function getLastTab() {
    try {
      var last = localStorage.getItem(LAST_TAB_KEY) || 'gone_rogue';
      // Migrate old street_chronicles preference
      if (last === 'street_chronicles') return 'arcade_games';
      return last;
    } catch (e) {
      return 'gone_rogue';
    }
  }

  /**
   * Set last active tab
   */
  function setLastTab(gameId) {
    try {
      localStorage.setItem(LAST_TAB_KEY, gameId);
    } catch (e) {
      // ignore
    }
  }

  /**
   * Calculate score for Gone Rogue run
   * Formula: currency found + interactives found * 10 + enemies avoided * 5 + damage to breakables + damage mitigated
   */
  function calculateGoneRogueScore(runData) {
    var score = 0;

    var currencyFound = runData.currencyFound || 0;
    score += currencyFound;

    var interactivesFound = runData.interactivesFound || 0;
    score += interactivesFound * 10;

    var enemiesAvoided = runData.enemiesAvoided || 0;
    score += enemiesAvoided * 5;

    var breakableDamage = runData.breakableDamage || 0;
    score += breakableDamage;

    var damageMitigated = runData.damageMitigated || 0;
    score += damageMitigated;

    return Math.floor(score);
  }

  /**
   * Generate a simple UUID
   */
  function _generateUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Clear all highscores (for testing/debugging)
   */
  function clearAllHighscores() {
    _highscores = {
      gone_rogue: [],
      arcade_games: [],
      eyesonly_live: []
    };
    _saveHighscores();
    console.log('[HighscoreState] All highscores cleared');
  }

  // Initialize on load
  init();

  // Public API
  return {
    init: init,
    submitHighscore: submitHighscore,
    getHighscores: getHighscores,
    getArcadePersonalBests: getArcadePersonalBests,
    getArcadeGameIds: getArcadeGameIds,
    getLastTab: getLastTab,
    setLastTab: setLastTab,
    calculateGoneRogueScore: calculateGoneRogueScore,
    clearAllHighscores: clearAllHighscores,
    GAME_IDS: GAME_IDS,
    ARCADE_CATALOG: ARCADE_CATALOG,
    MODES: MODES
  };
})();
