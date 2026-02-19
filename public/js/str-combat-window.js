/* ============================================================
   EYES ONLY - STR Combat Window Component
   Hearthstone-style combat UI with minimize/maximize
   ============================================================ */

const STRCombatWindow = (function () {
  'use strict';

  // Window state
  var _isMinimized = false;
  var _isVisible = false;
  var _timerDuration = 2000; // Default 2 seconds
  var _timeRemaining = 0;
  var _timerInterval = null;
  var _currentEnemyType = null;
  var _combatState = null;

  // DOM elements
  var _windowContainer = null;
  var _minimizedIndicator = null;
  var _bounceTimeout = null;

  // Timer durations by enemy type (in milliseconds)
  var TIMER_DURATIONS = {
    standard: 2000,
    elite: 2500,
    boss: 3000,
    quick: 1500,
    puzzle: 2800
  };

  /**
   * Initialize the STR Combat Window system
   */
  function init() {
    _createWindowElements();
    _attachEventListeners();
  }

  /**
   * Create window DOM elements
   */
  function _createWindowElements() {
    // Create main window container
    _windowContainer = document.createElement('div');
    _windowContainer.id = 'str-combat-window';
    _windowContainer.className = 'str-combat-window';
    _windowContainer.style.display = 'none';

    // Create minimized indicator
    _minimizedIndicator = document.createElement('div');
    _minimizedIndicator.id = 'str-combat-minimized';
    _minimizedIndicator.className = 'str-combat-minimized';
    _minimizedIndicator.style.display = 'none';

    // Append to body
    document.body.appendChild(_windowContainer);
    document.body.appendChild(_minimizedIndicator);
  }

  /**
   * Attach event listeners
   */
  function _attachEventListeners() {
    // Minimized indicator click to maximize
    _minimizedIndicator.addEventListener('click', maximize);
    _minimizedIndicator.addEventListener('touchend', function(e) {
      e.preventDefault();
      maximize();
    });

    // Hover preview for desktop
    var hoverTimeout = null;
    _minimizedIndicator.addEventListener('mouseenter', function() {
      hoverTimeout = setTimeout(function() {
        maximize();
      }, 500);
    });

    _minimizedIndicator.addEventListener('mouseleave', function() {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
      }
    });
  }

  /**
   * Show the combat window
   * @param {Object} combatState - Current combat state
   */
  function show(combatState) {
    _combatState = combatState;
    _isVisible = true;
    _isMinimized = false;

    // Set timer based on enemy type
    _currentEnemyType = combatState.enemyType || 'standard';
    _timerDuration = TIMER_DURATIONS[_currentEnemyType] || TIMER_DURATIONS.standard;
    _timeRemaining = _timerDuration;

    // Show 3-second countdown before revealing the combat window
    _showCombatCountdown(function() {
      // Render window content
      _renderWindow();

      // Show window with animation
      _windowContainer.style.display = 'block';
      _windowContainer.classList.add('str-window-appear');

      // Start turn timer
      _startTimer();

      // Remove background tint if it exists
      document.body.classList.remove('str-combat-minimized-state');
    });
  }

  /**
   * Show a full-screen 3-2-1 countdown overlay before combat begins
   * @param {Function} callback - Called when countdown finishes
   */
  /**
   * Show a full-screen 3-2-1 countdown overlay before combat begins.
   * Sequence: 3 (1s) → 2 (1s) → 1 (1s) → FIGHT! (0.5s) → fade-out (0.4s) → callback.
   * Total pre-combat delay: ~3.9 seconds.
   * @param {Function} callback - Called after the overlay fully fades out
   */
  function _showCombatCountdown(callback) {
    // Remove any existing countdown overlay
    var existing = document.getElementById('str-combat-countdown');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'str-combat-countdown';
    overlay.className = 'str-combat-countdown-overlay';
    document.body.appendChild(overlay);

    var count = 3;

    function tick() {
      if (count > 0) {
        overlay.innerHTML = '<div class="str-countdown-number">' + count + '</div>';
        count--;
        setTimeout(tick, 1000);
      } else {
        overlay.innerHTML = '<div class="str-countdown-fight">FIGHT!</div>';
        setTimeout(function() {
          overlay.classList.add('str-countdown-fade-out');
          setTimeout(function() {
            overlay.remove();
            if (callback) callback();
          }, 400);
        }, 500);
      }
    }

    tick();
  }

  /**
   * Hide the combat window
   */
  function hide() {
    _isVisible = false;
    _stopTimer();

    _windowContainer.style.display = 'none';
    _minimizedIndicator.style.display = 'none';

    // Remove background tint
    document.body.classList.remove('str-combat-minimized-state');

    // Clear bounce timeout
    if (_bounceTimeout) {
      clearTimeout(_bounceTimeout);
      _bounceTimeout = null;
    }
  }

  /**
   * Minimize the combat window
   */
  function minimize() {
    if (!_isVisible || _isMinimized) return;

    _isMinimized = true;

    // Animate window to minimized state
    _windowContainer.classList.add('str-window-minimizing');

    setTimeout(function() {
      _windowContainer.style.display = 'none';
      _windowContainer.classList.remove('str-window-minimizing');

      // Show minimized indicator
      _renderMinimizedIndicator();
      _minimizedIndicator.style.display = 'block';
      _minimizedIndicator.classList.add('str-indicator-appear');

      // Add background tint
      document.body.classList.add('str-combat-minimized-state');

      // Schedule bounce animation at 50% timer
      _scheduleBounceAnimation();
    }, 300);

    // Notify hand fan to reposition
    if (typeof HandFanComponent !== 'undefined' && typeof HandFanComponent.setMode === 'function') {
      HandFanComponent.setMode('contextual', 'bottom');
    }
  }

  /**
   * Maximize the combat window
   */
  function maximize() {
    if (!_isVisible || !_isMinimized) return;

    _isMinimized = false;

    // Animate indicator to window
    _minimizedIndicator.classList.add('str-indicator-maximizing');

    setTimeout(function() {
      _minimizedIndicator.style.display = 'none';
      _minimizedIndicator.classList.remove('str-indicator-maximizing', 'bounce-attention');

      // Show window
      _windowContainer.style.display = 'block';
      _windowContainer.classList.add('str-window-maximizing');

      // Remove background tint
      document.body.classList.remove('str-combat-minimized-state');

      // Clear bounce timeout
      if (_bounceTimeout) {
        clearTimeout(_bounceTimeout);
        _bounceTimeout = null;
      }

      setTimeout(function() {
        _windowContainer.classList.remove('str-window-maximizing');
      }, 300);
    }, 300);

    // Notify hand fan to reposition
    if (typeof HandFanComponent !== 'undefined' && typeof HandFanComponent.setMode === 'function') {
      HandFanComponent.setMode('combat', 'centered');
    }
  }

  /**
   * Render window content
   */
  function _renderWindow() {
    if (!_combatState) return;

    var html = '';

    // Header with minimize button
    html += '<div class="str-window-header">';
    html += '<div class="str-window-title">⚔️ STR COMBAT - ROUND ' + (_combatState.round || 1) + '</div>';
    html += '<button class="str-minimize-btn" aria-label="Minimize combat window">↓</button>';
    html += '</div>';

    // Combat arena
    html += '<div class="str-window-body">';

    // Enemy info (top)
    var enemy = _combatState.enemy || {};
    html += '<div class="str-combatant str-enemy">';
    html += '<div class="str-combatant-emoji">' + (enemy.emoji || '👾') + '</div>';

    // Enemy intent display (if available)
    if (typeof EnemyIntentSystem !== 'undefined' && enemy.intentState) {
      var intentDisplay = EnemyIntentSystem.formatIntentDisplay(enemy.intentState);
      html += '<div class="str-intent-display" title="Enemy Intent">' + intentDisplay + '</div>';
    }

    html += '<div class="str-hp-bar-container">';
    var enemyHpPercent = enemy.maxHp ? ((enemy.hp || 0) / enemy.maxHp * 100) : 0;
    html += '<div class="str-hp-bar enemy-hp" style="width: ' + enemyHpPercent + '%"></div>';
    html += '<div class="str-hp-text">' + (enemy.hp || 0) + ' / ' + (enemy.maxHp || 0) + ' HP</div>';
    html += '</div>';
    html += '</div>';

    // Advantage indicator (center)
    var advantageEmoji = {
      'ambush': '🎯',
      'neutral': '⚔️',
      'disadvantaged': '⚠️',
      'flanked': '❌'
    };
    html += '<div class="str-advantage-indicator">';
    html += '<div class="str-advantage-emoji">' + (advantageEmoji[_combatState.advantage] || '⚔️') + '</div>';
    html += '<div class="str-advantage-text">' + (_combatState.advantage || 'neutral').toUpperCase() + '</div>';
    html += '</div>';

    // Player info (bottom)
    var player = _combatState.player || { hp: 10, maxHp: 10 };
    html += '<div class="str-combatant str-player">';
    html += '<div class="str-hp-bar-container">';
    var playerHpPercent = player.maxHp ? (player.hp / player.maxHp * 100) : 100;
    html += '<div class="str-hp-bar player-hp" style="width: ' + playerHpPercent + '%"></div>';
    html += '<div class="str-hp-text">' + player.hp + ' / ' + player.maxHp + ' HP</div>';
    html += '</div>';
    html += '<div class="str-combatant-emoji">🧑</div>';
    html += '</div>';

    html += '</div>'; // end str-window-body

    // Timer footer
    html += '<div class="str-window-footer">';
    html += '<div class="str-timer-display">';
    html += '<span class="str-timer-label">TIME:</span> ';
    html += '<span class="str-timer-value">' + (_timeRemaining / 1000).toFixed(1) + 's</span>';
    html += '</div>';
    html += '</div>';

    _windowContainer.innerHTML = html;

    // Attach minimize button handler
    var minimizeBtn = _windowContainer.querySelector('.str-minimize-btn');
    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', minimize);
      minimizeBtn.addEventListener('touchend', function(e) {
        e.preventDefault();
        minimize();
      });
    }
  }

  /**
   * Render minimized indicator
   */
  function _renderMinimizedIndicator() {
    if (!_combatState) return;

    var enemy = _combatState.enemy || {};

    var html = '';
    html += '<div class="str-mini-content">';
    html += '<div class="str-mini-emoji">' + (enemy.emoji || '👾') + '</div>';

    // Enemy intent in minimized view (expression only for space)
    if (typeof EnemyIntentSystem !== 'undefined' && enemy.intentState && enemy.intentState.expression) {
      html += '<div class="str-mini-intent">' + enemy.intentState.expression.glyph + '</div>';
    }

    html += '<div class="str-mini-timer">⏱️ ' + (_timeRemaining / 1000).toFixed(1) + 's</div>';
    html += '<div class="str-mini-expand">↑</div>';
    html += '</div>';

    _minimizedIndicator.innerHTML = html;
  }

  /**
   * Start combat timer
   */
  function _startTimer() {
    _stopTimer(); // Clear any existing timer

    _timerInterval = setInterval(function() {
      _timeRemaining -= 100; // Update every 100ms

      if (_timeRemaining <= 0) {
        _timeRemaining = 0;
        _stopTimer();
        _onTimerExpired();
      } else {
        _updateTimerDisplay();
      }
    }, 100);
  }

  /**
   * Stop combat timer
   */
  function _stopTimer() {
    if (_timerInterval) {
      clearInterval(_timerInterval);
      _timerInterval = null;
    }
  }

  /**
   * Update timer display
   */
  function _updateTimerDisplay() {
    var timerValue = _windowContainer.querySelector('.str-timer-value');
    if (timerValue) {
      timerValue.textContent = (_timeRemaining / 1000).toFixed(1) + 's';

      // Add warning color at 30% remaining
      if (_timeRemaining <= _timerDuration * 0.3) {
        timerValue.style.color = '#ff1c4a';
      }
    }

    // Update minimized indicator timer
    if (_isMinimized) {
      var miniTimer = _minimizedIndicator.querySelector('.str-mini-timer');
      if (miniTimer) {
        miniTimer.textContent = '⏱️ ' + (_timeRemaining / 1000).toFixed(1) + 's';
      }
    }
  }

  /**
   * Schedule bounce animation at 50% timer
   */
  function _scheduleBounceAnimation() {
    if (_bounceTimeout) {
      clearTimeout(_bounceTimeout);
    }

    var halfTimerMs = _timerDuration * 0.5;
    var elapsed = _timerDuration - _timeRemaining;
    var delayUntilHalf = halfTimerMs - elapsed;

    if (delayUntilHalf > 0) {
      _bounceTimeout = setTimeout(function() {
        if (_isMinimized) {
          _minimizedIndicator.classList.add('bounce-attention');

          // Repeat bounce every 3-4 seconds
          setInterval(function() {
            if (_isMinimized) {
              _minimizedIndicator.classList.remove('bounce-attention');
              setTimeout(function() {
                if (_isMinimized) {
                  _minimizedIndicator.classList.add('bounce-attention');
                }
              }, 50);
            }
          }, 3500);
        }
      }, delayUntilHalf);
    }
  }

  /**
   * Handle timer expiration
   */
  function _onTimerExpired() {
    // Auto-play with default action or notify game logic
    if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.handleStrTimerExpired === 'function') {
      GoneRogue.handleStrTimerExpired();
    }
  }

  /**
   * Update combat state (called each round)
   */
  function updateState(combatState) {
    var previousRound = _combatState ? _combatState.round : 0;
    _combatState = combatState;

    if (_isVisible && !_isMinimized) {
      _renderWindow();
    } else if (_isMinimized) {
      _renderMinimizedIndicator();
    }

    // Reset turn timer when a new round begins
    if (combatState.round !== previousRound) {
      resetTimer(_currentEnemyType);
    }
  }

  /**
   * Reset timer for new round
   */
  function resetTimer(enemyType) {
    _currentEnemyType = enemyType || _currentEnemyType || 'standard';
    _timerDuration = TIMER_DURATIONS[_currentEnemyType] || TIMER_DURATIONS.standard;
    _timeRemaining = _timerDuration;

    if (_isVisible) {
      _startTimer();
    }
  }

  /**
   * Check if window is minimized
   */
  function isMinimized() {
    return _isMinimized;
  }

  /**
   * Check if window is visible
   */
  function isVisible() {
    return _isVisible;
  }

  // Public API
  return {
    init: init,
    show: show,
    hide: hide,
    minimize: minimize,
    maximize: maximize,
    updateState: updateState,
    resetTimer: resetTimer,
    isMinimized: isMinimized,
    isVisible: isVisible
  };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    STRCombatWindow.init();
  });
} else {
  STRCombatWindow.init();
}
