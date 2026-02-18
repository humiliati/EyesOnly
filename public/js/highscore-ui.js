/* ============================================================
   EYES ONLY - Highscore UI Controller
   Handles tab switching, filtering, and leaderboard display
   ============================================================ */

(function () {
  'use strict';

  var currentGame = 'gone_rogue';
  var currentFilter = 'all';

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
    // Check if coming from specific game context
    var referrer = document.referrer;
    var lastTab = HighscoreState.getLastTab();

    var defaultGame = 'gone_rogue';

    // Try to infer from GAMESTATE if available
    try {
      if (window.opener && window.opener.GAMESTATE) {
        var mode = window.opener.GAMESTATE.getMode();
        if (mode === 'rogue') {
          defaultGame = 'gone_rogue';
        } else if (mode === 'street') {
          defaultGame = 'street_chronicles';
        }
      }
    } catch (e) {
      // Ignore cross-origin errors
    }

    // Use last tab as fallback
    if (!defaultGame) {
      defaultGame = lastTab;
    }

    // Activate the default tab
    activateTab(defaultGame);
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
      if (btn.getAttribute('data-game') === gameId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update panel visibility
    var panels = document.querySelectorAll('.tab-panel');
    panels.forEach(function (panel) {
      if (panel.id === 'panel-' + gameId) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    // Save last tab
    HighscoreState.setLastTab(gameId);

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

    // Update button states
    var filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(function (btn) {
      if (btn.getAttribute('data-filter') === filter) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Re-render current leaderboard with filter
    renderLeaderboard(currentGame);
  }

  /**
   * Render all leaderboards
   */
  function renderAllLeaderboards() {
    renderLeaderboard('gone_rogue');
    renderLeaderboard('street_chronicles');
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

    var scores = HighscoreState.getHighscores(gameId, options);

    // Clear existing rows
    tbody.innerHTML = '';

    // If no scores, show empty state
    if (scores.length === 0) {
      var emptyRow = document.createElement('tr');
      emptyRow.className = 'empty-row';
      var emptyCell = document.createElement('td');
      emptyCell.colSpan = gameId === 'street_chronicles' ? 6 : 7;
      emptyCell.textContent = 'No scores recorded yet. Complete a run to submit your score!';
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
      return;
    }

    // Render score rows
    scores.forEach(function (entry, index) {
      var row = createScoreRow(entry, index + 1, gameId);
      tbody.appendChild(row);
    });
  }

  /**
   * Create a score row element
   */
  function createScoreRow(entry, rank, gameId) {
    var row = document.createElement('tr');

    // Add rank classes
    if (rank <= 3) {
      row.classList.add('top-3');
      row.classList.add('rank-' + rank);
    }

    // Rank column
    var rankCell = document.createElement('td');
    rankCell.className = 'rank-col';
    rankCell.textContent = '#' + rank;
    row.appendChild(rankCell);

    // Name column
    var nameCell = document.createElement('td');
    nameCell.className = 'name-col';
    nameCell.textContent = entry.display_name;
    row.appendChild(nameCell);

    // Mode column
    var modeCell = document.createElement('td');
    modeCell.className = 'mode-col';
    var modeBadge = document.createElement('span');
    modeBadge.className = 'mode-badge ' + entry.mode;
    modeBadge.textContent = entry.mode;
    modeCell.appendChild(modeBadge);
    row.appendChild(modeCell);

    // Score column
    var scoreCell = document.createElement('td');
    scoreCell.className = 'score-col';
    var scoreSpan = document.createElement('span');
    scoreSpan.className = 'score-flip';
    scoreSpan.textContent = formatScore(entry.score);
    scoreCell.appendChild(scoreSpan);
    row.appendChild(scoreCell);

    // Game-specific stats columns
    if (gameId === 'gone_rogue') {
      addStatCell(row, entry.metadata.completions || 0);
      addStatCell(row, entry.metadata.player_deaths || 0);
      addStatCell(row, entry.metadata.most_damage_dealt_single_action || 0);
    } else if (gameId === 'street_chronicles') {
      addStatCell(row, entry.metadata.completed ? 'Yes' : 'No');
      addStatCell(row, entry.metadata.items_found || 0);
    } else if (gameId === 'eyesonly_live') {
      addStatCell(row, entry.metadata.extracted ? 'Yes' : 'No');
      addStatCell(row, entry.metadata.rank || 'N/A');
    }

    return row;
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

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose public API
  window.HighscoreUI = {
    renderLeaderboard: renderLeaderboard,
    renderAllLeaderboards: renderAllLeaderboards
  };
})();
