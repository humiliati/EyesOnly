/* ============================================================
   EYES ONLY - AWOL Launch System: Dropdown Launcher + UBER Difficulty
   Phase 1: Dropdown with tier rows, seed field, and launch button.
   Replaces the old tooltip-based difficulty selector.

   Manages Gone Rogue UBER difficulty (separate from biome tiers),
   provides seed input for deterministic runs, and serves as the
   primary game entry point via the AWOL header button.

   NOTE: M ping + response pressure is currently placeholders/TODOs; UI is
   canonized per stakeholders.
   ============================================================ */

const AWOLDifficulty = (function () {
  'use strict';

  var STORAGE_KEY = 'eyesonly_awol_difficulty';
  var _currentTier = 1; // Internally 1..3 maps to Uber 0..2
  var _dropdownVisible = false;
  var _expandedTier = null; // Which tier row is expanded (null = none)
  var _completedTiers = []; // Internal completion gates (Tier 1 unlocks Tier 2, etc.)

  // Phase 2: Pause state
  var _isPaused = false;

  // Tier metadata
  var TIER_LABELS = {
    1: 'TRAILHEAD',
    2: 'BLACK OPS',
    3: 'BURN NOTICE'
  };

  // TODO(stakeholder): real M ping state machine sourced from /m console.
  var _lastMPingAt = 0;

  /**
   * Initialize AWOL button and dropdown launcher
   */
  function init() {
    _loadState();
    _attachEventListeners();
    _updateUI();

    // Listen for Gone Rogue state changes to update UI context
    if (typeof GoneRogue !== 'undefined' && GoneRogue.onStateChange) {
      GoneRogue.onStateChange(_onGameStateChange);
    }
  }

  /**
   * Load saved difficulty tier from storage
   */
  function _loadState() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        var state = JSON.parse(saved);
        _currentTier = state.currentTier || 1;
        _completedTiers = state.completedTiers || [];
      }
    } catch (e) {
      console.warn('[AWOL] Failed to load state:', e);
    }
  }

  /**
   * Save difficulty tier to storage
   */
  function _saveState() {
    try {
      var state = {
        currentTier: _currentTier,
        completedTiers: _completedTiers
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[AWOL] Failed to save state:', e);
    }
  }

  /**
   * Attach event listeners
   */
  function _attachEventListeners() {
    var awolButton = document.getElementById('awol-button');
    var dropdown = document.getElementById('awol-dropdown');

    if (!awolButton || !dropdown) {
      console.warn('[AWOL] Button or dropdown not found in DOM');
      return;
    }

    // Toggle dropdown on button click — but intercept pause icon clicks
    awolButton.addEventListener('click', function (e) {
      e.stopPropagation();

      // Phase 2: If game is running, check if the pause icon was clicked
      var pauseIcon = document.getElementById('awol-pause-icon');
      if (_isGoneRogueActive() && pauseIcon && (e.target === pauseIcon || pauseIcon.contains(e.target))) {
        _togglePause();
        return;
      }

      _toggleDropdown();
    });

    // Tier row click handlers
    var tierRows = dropdown.querySelectorAll('.awol-tier-row');
    tierRows.forEach(function (row) {
      row.addEventListener('click', function (e) {
        e.stopPropagation();
        var tier = parseInt(row.dataset.tier, 10);
        _onTierRowClick(tier);
      });
    });

    // Seed randomize button
    var randomizeBtn = document.getElementById('awol-seed-randomize');
    if (randomizeBtn) {
      randomizeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        _randomizeSeed();
      });
    }

    // Launch button
    var launchBtn = document.getElementById('awol-launch-btn');
    if (launchBtn) {
      launchBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        _launchGame();
      });
    }

    // Ping-back handler (placeholder)
    var pingBtn = document.getElementById('awol-pingback-btn');
    if (pingBtn && !pingBtn._bound) {
      pingBtn._bound = true;
      pingBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        _pingMConsole();
      });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', function (e) {
      if (_dropdownVisible && !dropdown.contains(e.target) && !awolButton.contains(e.target)) {
        _hideDropdown();
      }
    });

    // Prevent seed input clicks from closing dropdown
    var seedInput = document.getElementById('awol-seed-input');
    if (seedInput) {
      seedInput.addEventListener('click', function (e) {
        e.stopPropagation();
      });
    }
  }

  // ─── Dropdown Toggle ───────────────────────────────────────────

  function _toggleDropdown() {
    if (_dropdownVisible) {
      _hideDropdown();
    } else {
      _showDropdown();
    }
  }

  function _showDropdown() {
    var dropdown = document.getElementById('awol-dropdown');
    var chevron = document.getElementById('awol-chevron');
    if (!dropdown) return;

    // Dropdown works in BOTH idle and active states (Phase 1: idle only has launch)
    dropdown.style.display = 'block';
    _dropdownVisible = true;

    if (chevron) chevron.textContent = '▴';

    // Update tier row states
    _updateTierRows();
    _updateMRow();

    // Phase 2: If game is running, show run-state dropdown (no launch, read-only seed)
    if (_isGoneRogueActive()) {
      dropdown.classList.add('awol-dropdown-running');

      // Show seed read-only during run
      var seedInput = document.getElementById('awol-seed-input');
      if (seedInput) seedInput.setAttribute('readonly', 'readonly');

      // Hide launch panel during run
      var launchPanel = document.getElementById('awol-launch-panel');
      if (launchPanel) launchPanel.style.display = 'none';
    } else {
      dropdown.classList.remove('awol-dropdown-running');

      var seedInputIdle = document.getElementById('awol-seed-input');
      if (seedInputIdle) seedInputIdle.removeAttribute('readonly');
    }

    // If no tier is expanded and game isn't running, auto-expand the current tier
    if (!_expandedTier && !_isGoneRogueActive()) {
      _expandTierRow(_currentTier);
    }
  }

  function _hideDropdown() {
    var dropdown = document.getElementById('awol-dropdown');
    var chevron = document.getElementById('awol-chevron');
    if (!dropdown) return;

    dropdown.style.display = 'none';
    _dropdownVisible = false;
    _expandedTier = null;

    if (chevron) chevron.textContent = '▾';

    // Collapse launch panel
    var launchPanel = document.getElementById('awol-launch-panel');
    if (launchPanel) launchPanel.style.display = 'none';
  }

  // ─── Tier Row Interaction ──────────────────────────────────────

  function _onTierRowClick(tier) {
    if (!_isTierUnlocked(tier)) return; // Locked tiers are non-interactive

    // If game is running, just change the difficulty (mid-run adjustment)
    if (_isGoneRogueActive()) {
      _selectTier(tier);
      return;
    }

    // Select this tier as current
    _currentTier = tier;
    _saveState();

    // Expand/collapse: if already expanded, collapse; otherwise expand
    if (_expandedTier === tier) {
      _collapseTierRow();
    } else {
      _expandTierRow(tier);
    }

    _updateTierRows();
  }

  function _expandTierRow(tier) {
    _expandedTier = tier;

    // Show launch panel below the tier rows
    var launchPanel = document.getElementById('awol-launch-panel');
    if (launchPanel) {
      launchPanel.style.display = 'block';

      // Pre-populate seed if empty
      var seedInput = document.getElementById('awol-seed-input');
      if (seedInput && !seedInput.value) {
        _randomizeSeed();
      }
    }

    _updateTierRows();
  }

  function _collapseTierRow() {
    _expandedTier = null;

    var launchPanel = document.getElementById('awol-launch-panel');
    if (launchPanel) launchPanel.style.display = 'none';

    _updateTierRows();
  }

  function _updateTierRows() {
    // Update all three tier rows
    for (var tier = 1; tier <= 3; tier++) {
      var uberIndex = tier - 1;
      var row = document.getElementById('awol-tier-' + uberIndex);
      if (!row) continue;

      var arrow = document.getElementById('awol-tier-' + uberIndex + '-arrow');
      var lock = document.getElementById('awol-tier-' + uberIndex + '-lock');
      var unlocked = _isTierUnlocked(tier);

      // Arrow: ▾ if expanded, ▸ if selected, empty if neither
      if (arrow) {
        if (_expandedTier === tier) {
          arrow.textContent = '▾';
        } else if (_currentTier === tier) {
          arrow.textContent = '▸';
        } else {
          arrow.textContent = '';
        }
      }

      // Lock visibility
      if (lock) {
        lock.style.display = unlocked ? 'none' : 'inline';
      }

      // Row styling
      row.classList.remove('awol-tier-locked', 'awol-tier-active', 'awol-tier-expanded');
      if (!unlocked) {
        row.classList.add('awol-tier-locked');
      }
      if (_currentTier === tier) {
        row.classList.add('awol-tier-active');
      }
      if (_expandedTier === tier) {
        row.classList.add('awol-tier-expanded');
      }

      // Tier color class
      row.classList.remove('tier-1', 'tier-2', 'tier-3');
      row.classList.add('tier-' + tier);
    }
  }

  // ─── Tier Unlocking ────────────────────────────────────────────

  function _isTierUnlocked(tier) {
    if (tier === 1) return true; // Trailhead is always unlocked
    // Tier N requires completion of tier N-1
    return _completedTiers.indexOf(tier - 1) !== -1;
  }

  function _isTierCompleted(tier) {
    return _completedTiers.indexOf(tier) !== -1;
  }

  // ─── Seed Management ──────────────────────────────────────────

  function _randomizeSeed() {
    var seedInput = document.getElementById('awol-seed-input');
    if (!seedInput) return;

    var phrase = '';
    if (typeof SeededRandom !== 'undefined' && SeededRandom.generateSeedPhrase) {
      phrase = SeededRandom.generateSeedPhrase(Math.floor(Math.random() * 999999));
    } else {
      // Fallback: simple random phrase
      phrase = 'seed-' + Math.floor(Math.random() * 99999);
    }

    seedInput.value = phrase;
  }

  function _standardizeSeed(input) {
    if (!input || !input.trim()) {
      // Generate random
      if (typeof SeededRandom !== 'undefined' && SeededRandom.generateSeedPhrase) {
        return SeededRandom.generateSeedPhrase(Math.floor(Math.random() * 999999));
      }
      return 'seed-' + Math.floor(Math.random() * 99999);
    }

    var trimmed = input.trim();

    // Check if already a valid seed phrase (adjective-noun-number pattern)
    if (/^[a-z]+-[a-z]+-\d+$/i.test(trimmed)) {
      return trimmed.toLowerCase();
    }

    // Hash arbitrary string to integer seed
    var hash = 0;
    for (var i = 0; i < trimmed.length; i++) {
      hash = ((hash << 5) - hash) + trimmed.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }

    if (typeof SeededRandom !== 'undefined' && SeededRandom.generateSeedPhrase) {
      return SeededRandom.generateSeedPhrase(Math.abs(hash));
    }
    return 'seed-' + Math.abs(hash);
  }

  // ─── Launch Game ───────────────────────────────────────────────

  function _launchGame() {
    // Don't launch if game is already running
    if (_isGoneRogueActive()) {
      console.log('[AWOL] Game already running, ignoring launch');
      return;
    }

    var seedInput = document.getElementById('awol-seed-input');
    var rawSeed = seedInput ? seedInput.value : '';

    // Standardize seed
    var seed = _standardizeSeed(rawSeed);

    // Update the input field to show the standardized seed
    if (seedInput) seedInput.value = seed;

    // Set the difficulty tier
    if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.setDifficulty === 'function') {
      GoneRogue.setDifficulty(_currentTier);
    }

    // Set the seed
    if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.setSeed === 'function') {
      GoneRogue.setSeed(seed);
    }

    // Close dropdown and set to running state
    _hideDropdown();
    _isPaused = false;
    _setButtonState('running');

    // Dismiss login overlay if it's open — game launch takes priority
    if (typeof UIControls !== 'undefined' && UIControls.hideLoginOverlay) {
      UIControls.hideLoginOverlay();
    }

    // Start the game — same code path as terminal `rogue` command
    if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.start === 'function') {
      console.log('[AWOL] Launching Gone Rogue — Tier: ' + _currentTier +
        ' (' + TIER_LABELS[_currentTier] + '), Seed: ' + seed);

      // Use same entry path as terminal command
      // Check if we need to go through GAMESTATE request flow
      if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.requestRogue === 'function') {
        GAMESTATE.requestRogue();
      } else {
        GoneRogue.start({});
      }
    } else {
      console.warn('[AWOL] GoneRogue module not available');
    }
  }

  // ─── Tier Selection (mid-run or pre-launch) ────────────────────

  function _selectTier(tier) {
    if (tier < 1 || tier > 3) return;

    _currentTier = tier;
    _saveState();
    _updateUI();

    // Notify Gone Rogue module about difficulty change
    if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.setDifficulty === 'function') {
      GoneRogue.setDifficulty(tier);
    }

    // Notify via MOK interjection
    var uberLevel = tier - 1;
    var messages = {
      1: 'UBER 0 selected — ' + TIER_LABELS[1] + ' (baseline).',
      2: 'UBER 1 selected — ' + TIER_LABELS[2] + '. Increased enemy awareness + lethality.',
      3: 'UBER 2 selected — ' + TIER_LABELS[3] + '. Maximum threat. Extraction not guaranteed.'
    };

    if (typeof updateMokInterjection === 'function' && messages[tier]) {
      var suffix = _isGoneRogueActive() ? ' Applies on next floor.' : '';
      updateMokInterjection('[AWOL] ' + messages[tier] + suffix);
    }

    _updateTierRows();
  }

  // ─── Game State ────────────────────────────────────────────────

  function _isGoneRogueActive() {
    if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.isActive === 'function') {
      return GoneRogue.isActive();
    }
    return document.body.classList.contains('mode-gone-rogue') ||
           document.body.classList.contains('in-gone-rogue');
  }

  function _onGameStateChange(state) {
    var active = _isGoneRogueActive();

    if (active && !_isPaused) {
      // Game is running (either just started or resumed)
      _setButtonState('running');
    } else if (!active) {
      // Game ended — reset to idle state
      _isPaused = false;
      _expandedTier = null;
      _setButtonState('idle');

      // Remove paused class from grid if present
      var grid = document.getElementById('rogue-grid-mobile');
      if (grid) grid.classList.remove('paused');
    }

    _updateUI();
  }

  // ─── Phase 2: Pause / Resume ──────────────────────────────────

  function _togglePause() {
    if (!_isGoneRogueActive()) return;

    if (_isPaused) {
      _resumeGame();
    } else {
      _pauseGame();
    }
  }

  function _pauseGame() {
    if (_isPaused) return;
    _isPaused = true;

    // Stop the game loop
    if (typeof GameLoop !== 'undefined' && typeof GameLoop.stop === 'function') {
      GameLoop.stop();
    }

    // Dim the grid
    var grid = document.getElementById('rogue-grid-mobile');
    if (grid) grid.classList.add('paused');

    _setButtonState('paused');
    console.log('[AWOL] Game paused');
  }

  function _resumeGame() {
    if (!_isPaused) return;
    _isPaused = false;

    // Resume the game loop
    if (typeof GameLoop !== 'undefined' && typeof GameLoop.start === 'function') {
      GameLoop.start();
    }

    // Un-dim the grid
    var grid = document.getElementById('rogue-grid-mobile');
    if (grid) grid.classList.remove('paused');

    _setButtonState('running');
    console.log('[AWOL] Game resumed');
  }

  /**
   * Update AWOL button visual state: 'idle', 'running', or 'paused'
   */
  function _setButtonState(state) {
    var awolButton = document.getElementById('awol-button');
    var pauseIcon = document.getElementById('awol-pause-icon');
    var dropdown = document.getElementById('awol-dropdown');
    if (!awolButton) return;

    // Clear all state classes
    awolButton.classList.remove('awol-running', 'awol-paused');

    if (state === 'running') {
      awolButton.classList.add('awol-running');
      if (pauseIcon) {
        pauseIcon.style.display = 'inline';
        pauseIcon.textContent = '\u23F8'; // ⏸
        pauseIcon.title = 'Pause game';
      }
      if (dropdown) dropdown.classList.add('awol-dropdown-running');
    } else if (state === 'paused') {
      awolButton.classList.add('awol-paused');
      if (pauseIcon) {
        pauseIcon.style.display = 'inline';
        pauseIcon.textContent = '\u25B6'; // ▶
        pauseIcon.title = 'Resume game';
      }
      if (dropdown) dropdown.classList.add('awol-dropdown-running');
    } else {
      // idle
      if (pauseIcon) {
        pauseIcon.style.display = 'none';
      }
      if (dropdown) dropdown.classList.remove('awol-dropdown-running');
    }
  }

  // ─── UI Updates ────────────────────────────────────────────────

  function _updateUI() {
    // Update tier icon color on the AWOL button
    var accountabilityIcon = document.getElementById('accountability-icon');
    if (accountabilityIcon) {
      accountabilityIcon.classList.remove('tier-1', 'tier-2', 'tier-3');
      if (_currentTier >= 1 && _currentTier <= 3) {
        accountabilityIcon.classList.add('tier-' + _currentTier);
      }
    }

    // Update dropdown if visible
    if (_dropdownVisible) {
      _updateTierRows();
      _updateMRow();
    }
  }

  // ─── M Status (placeholder) ────────────────────────────────────

  function _updateMRow() {
    var mRow = document.getElementById('awol-m-row');
    var isScenarioJoined = _checkScenarioJoined();

    if (mRow) {
      // Show M row only if scenario is joined
      mRow.style.display = isScenarioJoined ? 'flex' : 'none';
    }

    var mStatusValue = document.getElementById('m-status-value');
    var pingBtn = document.getElementById('awol-pingback-btn');

    if (mStatusValue) {
      if (isScenarioJoined) {
        mStatusValue.textContent = _lastMPingAt
          ? ('ACTIVE — last ping ' + _formatAgeMs(Date.now() - _lastMPingAt) + ' ago')
          : 'ACTIVE';
        mStatusValue.style.color = '#00FFA6';
      } else {
        mStatusValue.textContent = 'OFFLINE';
        mStatusValue.style.color = '#ff3333';
      }
    }

    if (pingBtn) {
      pingBtn.disabled = !isScenarioJoined;
    }
  }

  function _checkScenarioJoined() {
    if (typeof ApiClient !== 'undefined' && typeof ApiClient.isConnected === 'function') {
      return ApiClient.isConnected();
    }
    return false;
  }

  // ─── Completion & Progression ──────────────────────────────────

  /**
   * Mark a tier as completed (called by Gone Rogue when player beats floor 30)
   */
  function markTierCompleted(tier) {
    if (tier < 1 || tier > 3) return;
    if (_completedTiers.indexOf(tier) === -1) {
      _completedTiers.push(tier);

      var nextTier = tier + 1;
      var uberLevel = tier - 1;

      // Auto-advance to next uber tier so the player's next run starts harder
      if (nextTier <= 3) {
        _currentTier = nextTier;
        if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.setDifficulty === 'function') {
          GoneRogue.setDifficulty(nextTier);
        }
      }

      _saveState();
      _updateUI();

      // Notify player
      if (typeof updateMokInterjection === 'function') {
        var message = '[AWOL] UBER ' + uberLevel + ' COMPLETED! ';
        if (nextTier <= 3) {
          message += TIER_LABELS[nextTier] + ' unlocked. Auto-set to Uber ' + (uberLevel + 1) + ' for next run.';
        } else {
          message += 'All Uber levels conquered. Legendary operative status achieved.';
        }
        updateMokInterjection(message);
      }
    }
  }

  /**
   * Get current difficulty tier
   */
  function getCurrentTier() {
    return _currentTier;
  }

  /**
   * Reset progress (for testing)
   */
  function resetProgress() {
    _currentTier = 1;
    _completedTiers = [];
    _lastMPingAt = 0;
    _saveState();
    _updateUI();
  }

  // ─── Helpers ───────────────────────────────────────────────────

  function _formatAgeMs(ms) {
    ms = Math.max(0, Number(ms || 0));
    var s = Math.round(ms / 1000);
    if (s < 60) return s + 's';
    var m = Math.round(s / 60);
    if (m < 60) return m + 'm';
    var h = Math.round(m / 60);
    return h + 'h';
  }

  function _pingMConsole() {
    if (!_checkScenarioJoined()) return;

    var pingBtn = document.getElementById('awol-pingback-btn');

    // Optimistic UI update
    _lastMPingAt = Date.now();
    _saveState();
    if (pingBtn) {
      pingBtn.textContent = 'PING SENT';
      pingBtn.disabled = true;
    }
    _updateMRow();

    // Send real pingback via ApiClient
    var sent = false;
    if (typeof ApiClient !== 'undefined' && typeof ApiClient.pingback === 'function') {
      sent = true;
      ApiClient.pingback().then(function (result) {
        if (result && result.ok) {
          if (typeof updateMokInterjection === 'function') {
            updateMokInterjection('[M] PING SENT — Awaiting response.');
          }
        }
      }).catch(function () {
        if (typeof updateMokInterjection === 'function') {
          updateMokInterjection('[M] PING FAILED — Check connection.');
        }
      }).finally(function () {
        setTimeout(function () {
          if (pingBtn) {
            pingBtn.textContent = '[M] PING';
            pingBtn.disabled = !_checkScenarioJoined();
          }
        }, 3000);
      });
    }

    if (!sent && typeof updateMokInterjection === 'function') {
      updateMokInterjection('[M] PING SENT — Awaiting response.');
      setTimeout(function () {
        if (pingBtn) {
          pingBtn.textContent = '[M] PING';
          pingBtn.disabled = !_checkScenarioJoined();
        }
      }, 3000);
    }
  }

  // Public API
  return {
    init: init,
    getCurrentTier: getCurrentTier,
    markTierCompleted: markTierCompleted,
    resetProgress: resetProgress,
    // Phase 2
    isPaused: function () { return _isPaused; },
    pause: _pauseGame,
    resume: _resumeGame,
    togglePause: _togglePause
  };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () {
    AWOLDifficulty.init();
  });
} else {
  AWOLDifficulty.init();
}
