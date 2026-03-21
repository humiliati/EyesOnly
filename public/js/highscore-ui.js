/* ============================================================
   EYES ONLY - Highscore UI Controller
   Handles tab switching, filtering, and leaderboard display.
   Supports arcade subcategory navigation.
   ============================================================ */

(function () {
  'use strict';

  var currentGame = 'gone_rogue';
  var currentFilter = 'all';
  var currentArcadeFilter = 'all';  // which arcade sub-game

  /**
   * Initialize highscore UI
   */
  function init() {
    // Set up tab listeners
    var tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(function (btn) {
      btn.addEventListener('click', handleTabClick);
    });

    // Set up filter listeners
    var filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', handleFilterClick);
    });

    // Build arcade sub-nav
    buildArcadeSubNav();

    // Build arcade personal bests
    buildArcadeBests();

    // Load context-sensitive default tab
    loadDefaultTab();

    // Render initial leaderboards
    renderAllLeaderboards();

    console.log('[HighscoreUI] Initialized');
  }

  /**
   * Load default tab based on context
   */
  function loadDefaultTab() {
    var lastTab = HighscoreState.getLastTab();
    var defaultGame = 'gone_rogue';

    // Try to infer from GAMESTATE if available
    try {
      if (window.opener && window.opener.GAMESTATE) {
        var mode = window.opener.GAMESTATE.getMode();
        if (mode === 'rogue') {
          defaultGame = 'gone_rogue';
        }
      }
    } catch (e) {
      // Ignore cross-origin errors
    }

    // Check URL hash for direct linking (e.g., /highscore/#arcade)
    var hash = window.location.hash.replace('#', '');
    if (hash === 'arcade' || hash === 'arcade_games') {
      defaultGame = 'arcade_games';
    } else if (hash === 'rogue' || hash === 'gone_rogue') {
      defaultGame = 'gone_rogue';
    } else if (hash === 'live' || hash === 'eyesonly_live') {
      defaultGame = 'eyesonly_live';
    } else if (lastTab) {
      defaultGame = lastTab;
    }

    activateTab(defaultGame);
  }

  /**
   * Build arcade sub-navigation from known games
   */
  function buildArcadeSubNav() {
    var container = document.getElementById('arcade-sub-nav');
    if (!container) return;

    var catalog = HighscoreState.ARCADE_CATALOG || {};
    var gameIds = HighscoreState.getArcadeGameIds();

    // Merge catalog keys with discovered game IDs
    var allIds = {};
    Object.keys(catalog).forEach(function (id) { allIds[id] = true; });
    gameIds.forEach(function (id) { allIds[id] = true; });
    var sorted = Object.keys(allIds).sort();

    // Clear existing buttons except ALL
    var existing = container.querySelectorAll('.arcade-sub-btn:not([data-arcade="all"])');
    existing.forEach(function (btn) { btn.remove(); });

    // Add a button for each game
    sorted.forEach(function (id) {
      var meta = catalog[id] || { name: id.replace(/-/g, ' '), icon: '🎮' };
      var btn = document.createElement('button');
      btn.className = 'arcade-sub-btn';
      btn.setAttribute('data-arcade', id);
      btn.textContent = meta.icon + ' ' + meta.name;
      container.appendChild(btn);
    });

    // Delegate clicks
    container.addEventListener('click', function (e) {
      var btn = e.target.closest('.arcade-sub-btn');
      if (!btn) return;

      currentArcadeFilter = btn.getAttribute('data-arcade');

      // Update active states
      container.querySelectorAll('.arcade-sub-btn').forEach(function (b) {
        b.classList.toggle('active', b === btn);
      });

      renderLeaderboard('arcade_games');
    });
  }

  /**
   * Build arcade personal bests strip
   */
  function buildArcadeBests() {
    var container = document.getElementById('arcade-bests');
    if (!container) return;

    var bests = HighscoreState.getArcadePersonalBests();
    var catalog = HighscoreState.ARCADE_CATALOG || {};

    container.innerHTML = '';

    var ids = Object.keys(bests).sort();
    if (ids.length === 0) {
      container.innerHTML = '<div style="font-size:0.75rem;color:rgba(140,120,70,0.35);font-style:italic;padding:0.25rem 0;">No personal bests yet — play some arcade games!</div>';
      return;
    }

    ids.forEach(function (id) {
      var score = bests[id];
      if (!score || score <= 0) return;

      var meta = catalog[id] || { name: id.replace(/-/g, ' '), icon: '🎮' };

      var card = document.createElement('div');
      card.className = 'arcade-best-card';
      card.innerHTML =
        '<span class="arcade-best-icon">' + meta.icon + '</span>' +
        '<span class="arcade-best-name">' + meta.name + '</span>' +
        '<span class="arcade-best-score">' + formatScore(score) + '</span>';
      container.appendChild(card);
    });
  }

  /**
   * Handle tab click
   */
  function handleTabClick(e) {
    var btn = e.currentTarget;
    var gameId = btn.getAttribute('data-game');
    activateTab(gameId);
  }

  /**
   * Activate a tab
   */
  function activateTab(gameId) {
    currentGame = gameId;

    // Update button states
    var tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-game') === gameId);
    });

    // Update panel visibility
    var panels = document.querySelectorAll('.tab-panel');
    panels.forEach(function (panel) {
      panel.classList.toggle('active', panel.id === 'panel-' + gameId);
    });

    // Save last tab
    HighscoreState.setLastTab(gameId);

    // Update hash for direct linking
    if (gameId === 'arcade_games') {
      history.replaceState(null, '', '#arcade');
    } else if (gameId === 'gone_rogue') {
      history.replaceState(null, '', '#rogue');
    } else if (gameId === 'eyesonly_live') {
      history.replaceState(null, '', '#live');
    }

    // Render leaderboard for this game
    renderLeaderboard(gameId);
  }

  /**
   * Handle filter click
   */
  function handleFilterClick(e) {
    var btn = e.currentTarget;
    var filter = btn.getAttribute('data-filter');
    currentFilter = filter;

    var filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-filter') === filter);
    });

    renderLeaderboard(currentGame);
  }

  /**
   * Render all leaderboards
   */
  function renderAllLeaderboards() {
    renderLeaderboard('gone_rogue');
    renderLeaderboard('arcade_games');
    renderLeaderboard('eyesonly_live');
  }

  /**
   * Render leaderboard for specific game
   */
  function renderLeaderboard(gameId) {
    var tbody = document.getElementById('leaderboard-' + gameId);
    if (!tbody) {
      console.warn('[HighscoreUI] Leaderboard tbody not found for:', gameId);
      return;
    }

    // Get scores with current filter
    var options = { limit: 50 };
    if (currentFilter !== 'all') {
      options.mode = currentFilter;
    }

    // Arcade subcategory filter
    if (gameId === 'arcade_games') {
      options.arcadeGameId = currentArcadeFilter;
    }

    var scores = HighscoreState.getHighscores(gameId, options);

    // If we're on the arcade tab and have no leaderboard entries,
    // populate from personal bests
    if (gameId === 'arcade_games' && scores.length === 0) {
      scores = _buildArcadeScoresFromBests(currentArcadeFilter);
    }

    tbody.innerHTML = '';

    if (scores.length === 0) {
      var emptyRow = document.createElement('tr');
      emptyRow.className = 'empty-row';
      var emptyCell = document.createElement('td');
      emptyCell.colSpan = _getColSpan(gameId);
      emptyCell.textContent = gameId === 'arcade_games'
        ? 'No arcade scores yet. Play some arcade games to see your scores!'
        : 'No scores recorded yet. Complete a run to submit your score!';
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
      return;
    }

    scores.forEach(function (entry, index) {
      var row = createScoreRow(entry, index + 1, gameId);
      tbody.appendChild(row);
    });
  }

  /**
   * Build synthetic score entries from the simple personal-best store
   */
  function _buildArcadeScoresFromBests(arcadeFilter) {
    var bests = HighscoreState.getArcadePersonalBests();
    var entries = [];

    Object.keys(bests).forEach(function (gameId) {
      if (arcadeFilter && arcadeFilter !== 'all' && gameId !== arcadeFilter) return;
      var score = bests[gameId];
      if (!score || score <= 0) return;

      entries.push({
        display_name: 'You',
        mode: 'human',
        score: score,
        game_id: 'arcade_games',
        metadata: {
          arcade_game_id: gameId,
          best_run: score
        },
        created_at: null
      });
    });

    entries.sort(function (a, b) { return b.score - a.score; });
    return entries;
  }

  /**
   * Get column span for a given game
   */
  function _getColSpan(gameId) {
    if (gameId === 'arcade_games') return 6;
    if (gameId === 'gone_rogue') return 7;
    return 6;
  }

  /**
   * Create a score row element
   */
  function createScoreRow(entry, rank, gameId) {
    var row = document.createElement('tr');

    if (rank <= 3) {
      row.classList.add('top-3');
      row.classList.add('rank-' + rank);
    }

    // Rank
    var rankCell = document.createElement('td');
    rankCell.className = 'rank-col';
    rankCell.textContent = '#' + rank;
    row.appendChild(rankCell);

    // Name
    var nameCell = document.createElement('td');
    nameCell.className = 'name-col';
    nameCell.textContent = entry.display_name;
    row.appendChild(nameCell);

    // Game-specific columns
    if (gameId === 'gone_rogue') {
      // Mode
      addModeBadge(row, entry.mode);
      // Score
      addScoreCell(row, entry.score);
      // Stats
      addStatCell(row, entry.metadata.completions || 0);
      addStatCell(row, entry.metadata.player_deaths || 0);
      addStatCell(row, entry.metadata.most_damage_dealt_single_action || 0);

    } else if (gameId === 'arcade_games') {
      // Game badge
      var gameCell = document.createElement('td');
      gameCell.className = 'game-col';
      var arcadeId = (entry.metadata && entry.metadata.arcade_game_id) || 'unknown';
      var catalog = HighscoreState.ARCADE_CATALOG || {};
      var meta = catalog[arcadeId] || { name: arcadeId.replace(/-/g, ' '), icon: '🎮' };
      var badge = document.createElement('span');
      badge.className = 'arcade-game-badge';
      badge.textContent = meta.icon + ' ' + meta.name;
      gameCell.appendChild(badge);
      row.appendChild(gameCell);
      // Score
      addScoreCell(row, entry.score);
      // Best run
      addStatCell(row, entry.metadata.best_run ? formatScore(entry.metadata.best_run) : '—');
      // Date
      var dateCell = document.createElement('td');
      dateCell.className = 'stats-col';
      dateCell.textContent = entry.created_at ? formatDate(entry.created_at) : '—';
      row.appendChild(dateCell);

    } else if (gameId === 'eyesonly_live') {
      addModeBadge(row, entry.mode);
      addScoreCell(row, entry.score);
      addStatCell(row, entry.metadata.extracted ? 'Yes' : 'No');
      addStatCell(row, entry.metadata.rank || 'N/A');
    }

    return row;
  }

  /**
   * Add mode badge cell
   */
  function addModeBadge(row, mode) {
    var modeCell = document.createElement('td');
    modeCell.className = 'mode-col';
    var modeBadge = document.createElement('span');
    modeBadge.className = 'mode-badge ' + (mode || 'human');
    modeBadge.textContent = mode || 'human';
    modeCell.appendChild(modeBadge);
    row.appendChild(modeCell);
  }

  /**
   * Add score cell with flip animation
   */
  function addScoreCell(row, score) {
    var scoreCell = document.createElement('td');
    scoreCell.className = 'score-col';
    var scoreSpan = document.createElement('span');
    scoreSpan.className = 'score-flip';
    scoreSpan.textContent = formatScore(score);
    scoreCell.appendChild(scoreSpan);
    row.appendChild(scoreCell);
  }

  /**
   * Add a stat cell to a row
   */
  function addStatCell(row, value) {
    var cell = document.createElement('td');
    cell.className = 'stats-col';
    cell.textContent = value;
    row.appendChild(cell);
  }

  /**
   * Format score with commas
   */
  function formatScore(score) {
    return score.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /**
   * Format ISO date to short display
   */
  function formatDate(isoStr) {
    try {
      var d = new Date(isoStr);
      var m = d.getMonth() + 1;
      var day = d.getDate();
      return m + '/' + day;
    } catch (_) {
      return '—';
    }
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose public API
  window.HighscoreUI = {
    renderLeaderboard: renderLeaderboard,
    renderAllLeaderboards: renderAllLeaderboards,
    buildArcadeBests: buildArcadeBests
  };
})();
