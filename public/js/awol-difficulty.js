/* ============================================================
   EYES ONLY - AWOL Button: Difficulty Tier Selector
   Manages Gone Rogue difficulty tiers with authentication checks
   ============================================================ */

const AWOLDifficulty = (function () {
  'use strict';

  var STORAGE_KEY = 'eyesonly_awol_difficulty';
  var _currentTier = 1; // Default to T1 (Standard) for new users
  var _tooltipVisible = false;
  var _completedTiers = []; // Array of completed tiers for progression check

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

    // Update M status
    var mStatusValue = document.getElementById('m-status-value');
    if (mStatusValue) {
      mStatusValue.textContent = isLoggedIn ? 'ACTIVE' : 'OFFLINE';
      mStatusValue.style.color = isLoggedIn ? '#33ff33' : '#ff3333';
    }

    // Update difficulty button states
    _updateDifficultyButtons(isLoggedIn);
  }

  /**
   * Check if user is logged in
   */
  function _checkUserLoggedIn() {
    // Check UserAccount module if available
    if (typeof UserAccount !== 'undefined' && typeof UserAccount.isLoggedIn === 'function') {
      return UserAccount.isLoggedIn();
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
    var tierNames = ['', 'STANDARD', 'ELITE', 'HELL'];
    var messages = [
      '',
      'Difficulty set to Uber 0 (Standard). Recommended for new operatives.',
      'Difficulty set to Uber 1 (Elite). Enemy awareness and lethality increased.',
      'Difficulty set to Uber 2 (Hell). Maximum threat. Extraction not guaranteed.'
    ];

    if (typeof updateMokInterjection === 'function' && tier >= 1 && tier <= 3) {
      updateMokInterjection('[AWOL] ' + messages[tier]);
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
        var message = '[AWOL] Uber ' + uberLevel + ' COMPLETED! ';
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
    _currentTier = 0;
    _completedTiers = [];
    _saveState();
    _updateUI();
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
