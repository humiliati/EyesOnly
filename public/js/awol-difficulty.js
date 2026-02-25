/* ============================================================
   EYES ONLY - AWOL Button: UBER Difficulty Selector + M Ping
   Manages Gone Rogue UBER difficulty (separate from biome tiers) and provides
   a canonical "check in with M" surface for the ARG (/m console).

   NOTE: M ping + response pressure is currently placeholders/TODOs; UI is
   canonized per stakeholders.
   ============================================================ */

const AWOLDifficulty = (function () {
  'use strict';

  var STORAGE_KEY = 'eyesonly_awol_difficulty';
  var _currentTier = 1; // Internally 1..3 maps to Uber 0..2
  var _tooltipVisible = false;
  var _completedTiers = []; // Internal completion gates (Tier 1 unlocks Tier 2, etc.)

  // TODO(stakeholder): real M ping state machine sourced from /m console.
  // For now, treat "logged in" as "M link active".
  var _lastMPingAt = 0;

  /**
   * Initialize AWOL button and difficulty selector
   */
  function init() {
    _loadState();
    _attachEventListeners();
    _updateUI();

    // Listen for Gone Rogue state changes to show/hide based on context
    if (typeof GoneRogue !== 'undefined' && GoneRogue.onStateChange) {
      GoneRogue.onStateChange(_updateUI);
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
        _currentTier = state.currentTier || 0;
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
   * Attach event listeners to AWOL button and difficulty buttons
   */
  function _attachEventListeners() {
    var awolButton = document.getElementById('awol-button');
    var tooltip = document.getElementById('awol-tooltip');

    if (!awolButton || !tooltip) {
      console.warn('[AWOL] Button or tooltip not found in DOM');
      return;
    }

    // Toggle tooltip on button click
    awolButton.addEventListener('click', function (e) {
      e.stopPropagation();
      _toggleTooltip();
    });

    // Ping-back handler (placeholder)
    var pingBtn = document.getElementById('awol-pingback-btn');
    if (pingBtn && !pingBtn._bound) {
      pingBtn._bound = true;
      pingBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        _pingMConsole();
      });
    }

    // Close tooltip when clicking outside
    document.addEventListener('click', function (e) {
      if (_tooltipVisible && !tooltip.contains(e.target) && !awolButton.contains(e.target)) {
        _hideTooltip();
      }
    });

    // Difficulty button handlers
    var diffButtons = document.querySelectorAll('.difficulty-btn');
    diffButtons.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var tier = parseInt(btn.dataset.tier, 10);
        if (!btn.disabled) {
          _selectTier(tier);
        }
      });
    });
  }

  /**
   * Toggle tooltip visibility
   */
  function _toggleTooltip() {
    if (_tooltipVisible) {
      _hideTooltip();
    } else {
      _showTooltip();
    }
  }

  /**
   * Show tooltip
   */
  function _showTooltip() {
    var tooltip = document.getElementById('awol-tooltip');
    if (tooltip) {
      // Check if Gone Rogue is active before showing
      var isGoneRogueActive = _isGoneRogueActive();
      if (isGoneRogueActive) {
        tooltip.style.display = 'block';
        _tooltipVisible = true;
        _updateTooltipContent();
      }
    }
  }

  /**
   * Hide tooltip
   */
  function _hideTooltip() {
    var tooltip = document.getElementById('awol-tooltip');
    if (tooltip) {
      tooltip.style.display = 'none';
      _tooltipVisible = false;
    }
  }

  /**
   * Check if Gone Rogue is currently active
   */
  function _isGoneRogueActive() {
    // Check if GoneRogue module exists and is active
    if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.isActive === 'function') {
      return GoneRogue.isActive();
    }

    // Fallback: check body class
    return document.body.classList.contains('mode-gone-rogue') ||
           document.body.classList.contains('in-gone-rogue');
  }

  /**
   * Update tooltip content based on current state
   */
  function _updateTooltipContent() {
    var isLoggedIn = _checkUserLoggedIn();
    var isScenarioJoined = _checkScenarioJoined();

    // Update M status: OFFLINE unless joined to a scenario
    var mStatusValue = document.getElementById('m-status-value');
    var pingBtn = document.getElementById('awol-pingback-btn');
    if (mStatusValue) {
      if (isScenarioJoined) {
        mStatusValue.textContent = _lastMPingAt ? ('ACTIVE — last ping ' + _formatAgeMs(Date.now() - _lastMPingAt) + ' ago') : 'ACTIVE';
        mStatusValue.style.color = '#00FFA6';
      } else {
        mStatusValue.textContent = 'OFFLINE';
        mStatusValue.style.color = '#ff3333';
      }
    }

    if (pingBtn) {
      pingBtn.disabled = !isScenarioJoined;
    }

    // Update difficulty button states (gated on user account login)
    _updateDifficultyButtons(isLoggedIn);
  }

  /**
   * Check if user is logged in (user account — allows standalone Rogue play)
   */
  function _checkUserLoggedIn() {
    // Check UserAccount module if available
    if (typeof UserAccount !== 'undefined' && typeof UserAccount.isLoggedIn === 'function') {
      return UserAccount.isLoggedIn();
    }
    return false;
  }

  /**
   * Check if player is joined to a live scenario (enables Live ARG features)
   */
  function _checkScenarioJoined() {
    if (typeof ApiClient !== 'undefined' && typeof ApiClient.isConnected === 'function') {
      return ApiClient.isConnected();
    }
    return false;
  }

  /**
   * Update difficulty button states based on login and progression
   */
  function _updateDifficultyButtons(isLoggedIn) {
    var diffButtons = document.querySelectorAll('.difficulty-btn');

    diffButtons.forEach(function (btn) {
      var tier = parseInt(btn.dataset.tier, 10);

      // Remove all tier classes first
      btn.classList.remove('tier-1', 'tier-2', 'tier-3', 'active');

      // Add tier class for color
      btn.classList.add('tier-' + tier);

      if (!isLoggedIn) {
        // Disable all buttons if not logged in
        btn.disabled = true;
      } else {
        // Enable T1 always for logged-in users
        if (tier === 1) {
          btn.disabled = false;
        }
        // Enable T2 only if T1 is completed
        else if (tier === 2) {
          btn.disabled = !_isTierCompleted(1);
        }
        // Enable T3 only if T2 is completed
        else if (tier === 3) {
          btn.disabled = !_isTierCompleted(2);
        }
      }

      // Mark active tier
      if (tier === _currentTier) {
        btn.classList.add('active');
      }
    });
  }

  /**
   * Check if a tier has been completed
   */
  function _isTierCompleted(tier) {
    return _completedTiers.indexOf(tier) !== -1;
  }

  /**
   * Select a difficulty tier
   */
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
    var messages = [
      '',
      'UBER 0 selected (baseline).',
      'UBER 1 selected (hard). Increased enemy awareness + lethality.',
      'UBER 2 selected (extreme). Maximum threat. Extraction not guaranteed.'
    ];

    if (typeof updateMokInterjection === 'function' && tier >= 1 && tier <= 3) {
      updateMokInterjection('[AWOL] ' + messages[tier] + ' (Applies on next spawned floor/run; TODO enforce)');
    }

    // Hide tooltip after selection
    _hideTooltip();
  }

  /**
   * Update UI elements based on current state
   */
  function _updateUI() {
    var accountabilityIcon = document.getElementById('accountability-icon');
    if (!accountabilityIcon) return;

    // Remove all tier classes
    accountabilityIcon.classList.remove('tier-1', 'tier-2', 'tier-3');

    // Add current tier class
    if (_currentTier >= 1 && _currentTier <= 3) {
      accountabilityIcon.classList.add('tier-' + _currentTier);
    }

    // Update tooltip if visible
    if (_tooltipVisible) {
      _updateTooltipContent();
    }
  }

  /**
   * Mark a tier as completed (called by Gone Rogue when player beats floor 30)
   */
  function markTierCompleted(tier) {
    if (tier < 1 || tier > 3) return;
    if (_completedTiers.indexOf(tier) === -1) {
      _completedTiers.push(tier);
      _saveState();
      _updateUI();

      // Notify player
      if (typeof updateMokInterjection === 'function') {
        var nextTier = tier + 1;
        var uberLevel = tier - 1;
        var message = '[AWOL] UBER ' + uberLevel + ' COMPLETED! ';
        if (nextTier <= 3) {
          message += 'Uber ' + (uberLevel + 1) + ' now available.';
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
    _updateTooltipContent();

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
        // Re-enable button after brief delay
        setTimeout(function () {
          if (pingBtn) {
            pingBtn.textContent = '[M] PING BACK';
            pingBtn.disabled = !_checkScenarioJoined();
          }
        }, 3000);
      });
    }

    if (!sent && typeof updateMokInterjection === 'function') {
      updateMokInterjection('[M] PING SENT — Awaiting response.');
      setTimeout(function () {
        if (pingBtn) {
          pingBtn.textContent = '[M] PING BACK';
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
    resetProgress: resetProgress
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
