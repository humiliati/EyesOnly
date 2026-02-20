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
  var _intentAnimInterval = null;
  var _currentEnemyType = null;
  var _combatState = null;

  // DOM elements
  var _windowContainer = null;
  var _minimizedIndicator = null;
  var _bounceTimeout = null;
  var _bounceInterval = null;

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

    // Set timer based on enemy type, scaled by floor number
    _currentEnemyType = combatState.enemyType || 'standard';
    var baseMs = TIMER_DURATIONS[_currentEnemyType] || TIMER_DURATIONS.standard;
    _timerDuration = _scaleTimerForFloor(baseMs, combatState.floor || 1);
    _timeRemaining = _timerDuration;

    // Show 3-second countdown before revealing the combat window
    _showCombatCountdown(combatState.countdownMessages || null, function() {
      // Render window content
      _renderWindow();

      // Start intent glyph animator (animated faces + weapons)
      _startIntentAnimator();

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
   * Show a full-screen 3-2-1 countdown overlay before combat begins.
   * Sequence: 3 (1s) → 2 (1s) → 1 (1s) → FIGHT! (0.5s) → fade-out (0.4s) → callback.
   * Total pre-combat delay: ~3.9 seconds.
   *
   * @param {Object|null} messages - Optional contextual messages per beat:
   *   { beat3: string, beat2: string, beat1: string }
   * @param {Function} callback - Called after the overlay fully fades out
   */
  function _showCombatCountdown(messages, callback) {
    // Remove any existing countdown overlay
    var existing = document.getElementById('str-combat-countdown');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'str-combat-countdown';
    overlay.className = 'str-combat-countdown-overlay';
    document.body.appendChild(overlay);

    var count = 3;
    var beatMessages = messages || {};

    function tick() {
      if (count > 0) {
        var contextMsg = beatMessages['beat' + count] || '';

        // Build DOM nodes safely (no innerHTML for user-sourced text)
        overlay.innerHTML = '';
        var numEl = document.createElement('div');
        numEl.className = 'str-countdown-number';
        numEl.textContent = count;
        overlay.appendChild(numEl);

        if (contextMsg) {
          var ctxEl = document.createElement('div');
          ctxEl.className = 'str-countdown-context';
          ctxEl.textContent = contextMsg;
          overlay.appendChild(ctxEl);
        }

        count--;
        setTimeout(tick, 1000);
      } else {
        var fightEl = document.createElement('div');
        fightEl.className = 'str-countdown-fight';
        fightEl.textContent = 'FIGHT!';
        overlay.innerHTML = '';
        overlay.appendChild(fightEl);
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
    _stopIntentAnimator();

    _windowContainer.style.display = 'none';
    _minimizedIndicator.style.display = 'none';

    // Remove background tint
    document.body.classList.remove('str-combat-minimized-state');

    // Clear bounce timeout/interval
    if (_bounceTimeout) {
      clearTimeout(_bounceTimeout);
      _bounceTimeout = null;
    }
    if (_bounceInterval) {
      clearInterval(_bounceInterval);
      _bounceInterval = null;
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
    var _sw0 = (typeof EYESONLY_PERF !== 'undefined') ? performance.now() : 0;

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

    if (_sw0 && typeof EYESONLY_PERF !== 'undefined') {
      EYESONLY_PERF.mark('str.renderWindowMs', performance.now() - _sw0);
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

  function _refreshIntentDisplays() {
    if (!_combatState) return;

    var enemy = _combatState.enemy || {};
    if (!enemy.intentState) return;

    if (typeof EnemyIntentSystem === 'undefined') return;

    // Full window display
    if (_windowContainer && _isVisible && !_isMinimized) {
      var intentEl = _windowContainer.querySelector('.str-intent-display');
      if (intentEl) {
        intentEl.textContent = EnemyIntentSystem.formatIntentDisplay(enemy.intentState);
      }
    }

    // Minimized indicator (expression only)
    if (_minimizedIndicator && _isVisible && _isMinimized) {
      var miniEl = _minimizedIndicator.querySelector('.str-mini-intent');
      if (miniEl && EnemyIntentSystem.getAnimatedExpressionGlyph) {
        miniEl.textContent = EnemyIntentSystem.getAnimatedExpressionGlyph(enemy.intentState);
      }
    }
  }

  function _startIntentAnimator() {
    _stopIntentAnimator();

    // Update at a gentle cadence; just enough to feel "alive".
    _intentAnimInterval = setInterval(function() {
      _refreshIntentDisplays();
    }, 250);
  }

  function _stopIntentAnimator() {
    if (_intentAnimInterval) {
      clearInterval(_intentAnimInterval);
      _intentAnimInterval = null;
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
          if (_bounceInterval) clearInterval(_bounceInterval);
          _bounceInterval = setInterval(function() {
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

    // Ensure animator is running whenever combat is active/visible
    if (_isVisible) {
      _startIntentAnimator();
    }

    if (_isVisible && !_isMinimized) {
      _renderWindow();
    } else if (_isMinimized) {
      _renderMinimizedIndicator();
    }

    // Reset turn timer when a new round begins
    if (combatState.round !== previousRound) {
      resetTimer(_currentEnemyType, combatState.floor);
    }
  }

  /**
   * Compute floor-scaled timer duration.
   * At floor 1 the player gets 40% extra time; this bonus decays linearly to 0
   * at floor 10 and beyond, keeping the timer at the base value for late floors.
   *
   * @param {number} baseMs - Base timer duration in milliseconds
   * @param {number} floor  - Current floor number (1-based)
   * @returns {number} Scaled timer duration in milliseconds
   */
  function _scaleTimerForFloor(baseMs, floor) {
    var RAMP_DOWN_FLOOR = 10; // Bonus fully gone by this floor
    var MAX_BONUS = 0.40;     // 40% extra time at floor 1
    var remaining = Math.max(0, RAMP_DOWN_FLOOR - floor);
    var bonus = MAX_BONUS * (remaining / (RAMP_DOWN_FLOOR - 1));
    return Math.round(baseMs * (1 + bonus));
  }

  /**
   * Reset timer for new round
   */
  function resetTimer(enemyType, floor) {
    _currentEnemyType = enemyType || _currentEnemyType || 'standard';
    var baseMs = TIMER_DURATIONS[_currentEnemyType] || TIMER_DURATIONS.standard;
    var currentFloor = 1;
    if (floor != null) {
      currentFloor = floor;
    } else if (_combatState) {
      currentFloor = _combatState.floor || 1;
    }
    _timerDuration = _scaleTimerForFloor(baseMs, currentFloor);
    _timeRemaining = _timerDuration;

    if (_isVisible) {
      _startTimer();
    }
  }

  /**
   * Show the YOU DIED full-screen overlay and auto-dismiss after ~2.5 seconds.
   * Uses the same overlay mechanics as the pre-combat 3-2-1 countdown.
   */
  function showDeathScreen() {
    var existing = document.getElementById('str-death-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'str-death-overlay';
    overlay.className = 'str-death-overlay';

    var msgEl = document.createElement('div');
    msgEl.className = 'str-death-message';
    msgEl.textContent = 'YOU DIED';
    overlay.appendChild(msgEl);

    var subEl = document.createElement('div');
    subEl.className = 'str-death-sub';
    subEl.textContent = '// SIGNAL LOST';
    overlay.appendChild(subEl);

    document.body.appendChild(overlay);

    setTimeout(function() {
      overlay.classList.add('str-death-fade-out');
      setTimeout(function() {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 600);
    }, 2500);
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
    showDeathScreen: showDeathScreen,
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
