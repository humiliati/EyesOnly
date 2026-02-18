/* ============================================================
   EYES ONLY - Highscore State Management
   Manages leaderboards for Gone Rogue, Street-Chronicles, and EyesOnly Live
   ============================================================ */

const HighscoreState = (function () {
  'use strict';

  var STORAGE_KEY = 'eyesonly_highscores';
  var LAST_TAB_KEY = 'highscore:lastTab';

  var GAME_IDS = {
    GONE_ROGUE: 'gone_rogue',
    STREET_CHRONICLES: 'street_chronicles',
    EYESONLY_LIVE: 'eyesonly_live'
  };

  var MODES = {
    HUMAN: 'human',
    AGENT: 'agent'
  };

  var _highscores = {
    gone_rogue: [],
    street_chronicles: [],
    eyesonly_live: []
  };

  /**
   * Initialize highscore system
   */
  function init() {
    _loadHighscores();
    console.log('[HighscoreState] Initialized');
  }

  /**
   * Load highscores from localStorage
   */
  function _loadHighscores() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        _highscores = Object.assign(_highscores, parsed);
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
    // Validate required fields
    if (!entry.game_id || !GAME_IDS[entry.game_id.toUpperCase()]) {
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
      verdict: 'valid' // For now, auto-validate. Later: 'pending', 'valid', 'rejected'
    };

    // Add to appropriate game array
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
   * @param {Object} options - Filter options {mode, limit}
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

    // Limit results
    var limit = options.limit || 50;
    scores = scores.slice(0, limit);

    return scores;
  }

  /**
   * Get last active tab
   */
  function getLastTab() {
    try {
      return localStorage.getItem(LAST_TAB_KEY) || 'gone_rogue';
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

    // Currency found (don't count starting currency)
    var currencyFound = runData.currencyFound || 0;
    score += currencyFound;

    // Interactives found (books, terminals, etc.) - 10x multiplier for exploration
    var interactivesFound = runData.interactivesFound || 0;
    score += interactivesFound * 10;

    // Enemies not encountered (stealth bonus) - 5x multiplier
    var enemiesAvoided = runData.enemiesAvoided || 0;
    score += enemiesAvoided * 5;

    // Damage dealt to breakables (completionist bonus)
    var breakableDamage = runData.breakableDamage || 0;
    score += breakableDamage;

    // Damage mitigated in STR combat (survival bonus)
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
      street_chronicles: [],
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
    getLastTab: getLastTab,
    setLastTab: setLastTab,
    calculateGoneRogueScore: calculateGoneRogueScore,
    clearAllHighscores: clearAllHighscores,
    GAME_IDS: GAME_IDS,
    MODES: MODES
  };
})();
