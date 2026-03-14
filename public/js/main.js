/* ============================================================
   EYES ONLY - Main Orchestrator
   Wires together Terminal, Parser, StateMachine, and Missions.
   Handles boot sequence, state transitions, and command routing.
   Adapted from langterm main.js orchestration pattern.
   ============================================================ */

(function () {
  'use strict';

  // Track if first keypress has occurred (IDLE -> BOOTING)
  var _firstKeyPressed = false;

  // Briefing rotation interval handle
  var _briefingInterval = null;

  /**
   * Application entry point.
   * Called after DOM is ready.
   */
  function start() {
    Terminal.init();
    if (typeof LoginShell !== 'undefined') LoginShell.init();

    // StreetChronicles may be in the lazy bundle now — guard it
    if (typeof StreetChronicles !== 'undefined') StreetChronicles.init();

    // Game subsystems (GAMESTATE, GoneRogue, ShopSystem, etc.) are loaded
    // by gone-rogue-loader.js in the background after the splash screen
    // renders. RogueLoader._initGameSystems() handles their .init() calls
    // once all scripts are ready. We do NOT block the splash on them.

    // Initialize missions (async, loads JSON)
    Missions.init().then(function () {
      StateMachine.init();

      var currentState = StateMachine.getState();

      // If returning user with access, skip to granted state
      if (currentState === StateMachine.STATES.ACCESS_GRANTED) {
        _skipToGranted();
        return;
      }

      // Show title screen
      _showTitleScreen();
    });
  }

  /**
   * Display the EYES ONLY title with blinking cursor.
   * Wait for any keypress to begin boot sequence.
   */
  function _showTitleScreen() {
    // Create title element
    var titleDiv = document.createElement('div');
    titleDiv.className = 'line instant';
    titleDiv.innerHTML = '<span class="title-text">EYES ONLY</span> <span class="cursor"></span>';
    titleDiv.id = 'title-display';

    // Add to terminal (before input line)
    var terminalEl = document.getElementById('terminal');
    var inputLine = document.getElementById('input-line');
    terminalEl.insertBefore(titleDiv, inputLine);

    // Listen for any keypress to start boot
    document.addEventListener('keydown', _onFirstKey);
    document.addEventListener('click', _onFirstKey);
    document.addEventListener('touchstart', _onFirstKey);
  }

  /**
   * Handle the first keypress/click - triggers boot sequence.
   */
  function _onFirstKey(e) {
    if (_firstKeyPressed) return;
    _firstKeyPressed = true;

    // Remove listeners
    document.removeEventListener('keydown', _onFirstKey);
    document.removeEventListener('click', _onFirstKey);
    document.removeEventListener('touchstart', _onFirstKey);

    // Remove title
    var title = document.getElementById('title-display');
    if (title) title.remove();

    // Flicker effect
    Terminal.flicker();

    var currentState = StateMachine.getState();
    if (currentState !== StateMachine.STATES.IDLE) {
      _resumeSession();
      return;
    }

    // Begin boot sequence
    _runBootSequence();
  }

  /**
   * Animated boot sequence - Cold War terminal aesthetics.
   */
  function _runBootSequence() {
    StateMachine.transition('BOOTING');

    var bootLines = [
      'SIGNAL DETECTED',
      'INITIALIZING SECURE SESSION',
      '...'
    ];

    Terminal.typeLines(bootLines, Terminal.TYPE_SPEED_FAST, 180, 'system-msg')
      .then(function () {
        return _pause(450);
      })
      .then(function () {
        StateMachine.transition('AWAITING_CMD');
        _enableInput('> ');
      });
  }

  function _resumeSession() {
    var state = StateMachine.getState();

    if (state === StateMachine.STATES.END_LOCKED) {
      Terminal.writeLine('SESSION ARCHIVED', 'system-msg');
      Terminal.writeLine('');
      return;
    }

    // Check if Gone Rogue was previously active
    var rogueWasActive = false;
    try {
      var rogueState = localStorage.getItem('eyesonly_rogue_state');
      if (rogueState) {
        var parsed = JSON.parse(rogueState);
        rogueWasActive = parsed.active === true;
      }
    } catch (e) { /* ignore */ }

    if (rogueWasActive) {
      // Restore to normal state, not rogue mode
      // User can re-enter rogue mode with "rogue" command
      Terminal.typeLines(['SESSION RESTORED', 'TYPE HELP FOR AVAILABLE COMMANDS', ''], Terminal.TYPE_SPEED_FAST, 80, 'system-msg')
        .then(function () {
          _enableInput(_promptForState(state));
        });
    } else {
      Terminal.typeLines(['SESSION RESTORED', ''], Terminal.TYPE_SPEED_FAST, 80, 'system-msg')
        .then(function () {
          _enableInput(_promptForState(state));
        });
    }
  }

  function _promptForState(state) {
    if (state === StateMachine.STATES.AWAITING_DESIGNATION) return 'DESIGNATION> ';
    if (state === StateMachine.STATES.ACCESS_GRANTED || state === StateMachine.STATES.MISSION_BRIEFING || state === StateMachine.STATES.MISSION_INPUT) return 'COMMAND> ';
    return '> ';
  }

  /**
   * Enable terminal input and bind command handler.
   */
  function _enableInput(prompt) {
    Terminal.showInput(prompt || '> ');
    Terminal.onCommand(_handleCommand);
    // Expose command handler for UI buttons
    window._mainCommandHandler = _handleCommand;
  }

  /**
   * Central command handler - routes through Parser and StateMachine.
   */
  function _handleCommand(rawInput) {
    var currentState = StateMachine.getState();

    // Priority 0: Kernel commands (available anywhere once logged in)
    if (typeof KernelManager !== 'undefined' && KernelManager.isKernelCommand && KernelManager.isKernelCommand(rawInput || '')) {
      _executeKernelAction(KernelManager.process(rawInput || ''));
      return;
    }

    // Priority 0.4: Theme command (available everywhere)
    if (typeof ThemeWidget !== 'undefined' &&
        ThemeWidget.isThemeCommand &&
        ThemeWidget.isThemeCommand(rawInput || '')) {
      _executeRouterAction(ThemeWidget.process(rawInput || ''));
      return;
    }

    // Priority 0.5: Terminal Command Router (stats, inventory, etc.)
    // Only active when NOT inside rogue or street gameplay
    if (typeof TerminalCommandRouter !== 'undefined' &&
        TerminalCommandRouter.isRouterCommand &&
        TerminalCommandRouter.isRouterCommand(rawInput || '')) {
      _executeRouterAction(TerminalCommandRouter.process(rawInput || ''));
      return;
    }

    // Priority 1: Check if Gone Rogue mode is active
    if (typeof GoneRogue !== 'undefined' && GoneRogue.isActive()) {
      _executeRogueAction(GoneRogue.process(rawInput || ''));
      return;
    }

    // Priority 2: Check if Street Chronicles is active
    if (typeof StreetChronicles !== 'undefined' && StreetChronicles.isActive()) {
      _executeStreetAction(StreetChronicles.process(rawInput || ''));
      return;
    }

    // Priority 3: Check if Login UI is active
    if (typeof LoginUI !== 'undefined' && LoginUI.isActive()) {
      LoginUI.processInput(rawInput || '');
      return;
    }

    // Priority 4: Check if Login Shell is active
    if (LoginShell.isActive()) {
      _executeLoginAction(LoginShell.process(rawInput || ''));
      return;
    }

    if ((!rawInput || rawInput.trim().length === 0) &&
        currentState !== StateMachine.STATES.AWAITING_FINAL_ENTER &&
        currentState !== StateMachine.STATES.END_LOCKED) return;

    var parsed = Parser.parse(rawInput || '');
    var action = StateMachine.process(parsed);

    _executeAction(action);
  }

  function _executeStreetAction(action) {
    Terminal.hideInput();
    _displayLines(action.lines || [], function () {
      if (action.stayActive) {
        _enableInput(action.prompt || StreetChronicles.getPrompt());
        return;
      }
      _enableInput(_promptForState(StateMachine.getState()));
    }, 'system-msg');
  }

  function _executeRogueAction(action) {
    Terminal.hideInput();

    // When rogue is entering/active with interactive grid, keep terminal silent.
    var enteringInteractiveRogue = false;
    try {
      enteringInteractiveRogue = !!(action && action.stayActive &&
        (typeof GoneRogueMobile !== 'undefined') &&
        (typeof GoneRogue !== 'undefined') &&
        (typeof GoneRogue.isActive === 'function') && GoneRogue.isActive());
    } catch (e0) { enteringInteractiveRogue = false; }

    if (enteringInteractiveRogue) {
      _displayLines([], function () {
        if (action.stayActive) {
          // Check if interactive grid is active - if so, don't re-enable text input
          var isInteractiveGrid = (typeof GoneRogueMobile !== 'undefined' && 
                                    typeof GoneRogue !== 'undefined' && 
                                    GoneRogue.isActive());
          
          if (isInteractiveGrid) {
            // Grid is the input - don't show text input or focus keyboard
            // Keyboard commands (WASD) will still work via keydown handlers
            return;
          }
          
          // Fallback to text mode (for non-interactive/text-only mode)
          _enableInput(action.prompt || GoneRogue.getPrompt());
          return;
        }
        _enableInput(_promptForState(StateMachine.getState()));
      }, 'system-msg highlight');
      return;
    }

    _displayLines(action.lines || [], function () {
      if (action.stayActive) {
        var isInteractiveGrid = (typeof GoneRogueMobile !== 'undefined' && 
                                  typeof GoneRogue !== 'undefined' && 
                                  GoneRogue.isActive());
        if (isInteractiveGrid) {
          return;
        }
        _enableInput(action.prompt || GoneRogue.getPrompt());
        return;
      }
      _enableInput(_promptForState(StateMachine.getState()));
    }, 'system-msg highlight');
  }

  function _executeKernelAction(action) {
    Terminal.hideInput();
    _displayLines(action.lines || [], function () {
      if (action.stayActive) {
        _enableInput(action.prompt || _promptForState(StateMachine.getState()));
        return;
      }
      _enableInput(_promptForState(StateMachine.getState()));
    }, 'system-msg');
  }

  function _executeRouterAction(action) {
    Terminal.hideInput();
    _displayLines(action.lines || [], function () {
      if (action.stayActive) {
        _enableInput(action.prompt || _promptForState(StateMachine.getState()));
        return;
      }
      _enableInput(_promptForState(StateMachine.getState()));
    }, 'system-msg');
  }

  function _executeLoginAction(action) {
    Terminal.hideInput();
    _displayLines(action.lines || [], function () {
      if (action.stayActive) {
        _enableInput(action.prompt || LoginShell.getPrompt());
        return;
      }
      _enableInput(_promptForState(StateMachine.getState()));
    }, 'system-msg classified');
  }

  /**
   * Execute an action returned by the state machine.
   */
  function _executeAction(action) {
    Terminal.hideInput();

    switch (action.type) {

      case 'output':
        _displayLines(action.lines, function () {
          StateMachine.transition(action.newState);
          if (action.newState === 'END_LOCKED') {
            Terminal.hideInput();
            return;
          }
          _enableInput(action.prompt);
        });
        break;

      case 'prompt':
        _displayLines(action.lines, function () {
          StateMachine.transition(action.newState);
          _enableInput(action.prompt);
        });
        break;

      case 'deny':
        _displayLines(action.lines, function () {
          StateMachine.transition(action.newState);
          _enableInput(action.prompt || '> ');
        }, 'system-msg error');
        break;

      case 'lockout':
        Terminal.flicker();
        _displayLines(action.lines, function () {
          StateMachine.transition(action.newState);
          // Re-enable after lockout
          setTimeout(function () {
            Terminal.writeLine('LOCKOUT EXPIRED - TERMINAL READY', 'system-msg');
            Terminal.writeLine('');
            _enableInput('> ');
          }, 30000);
        }, 'system-msg error');
        break;

      case 'grant':
        _runAccessGranted();
        break;

      case 'login':
        _executeLoginAction(LoginShell.start());
        break;

      case 'user_login':
        if (typeof UIControls !== 'undefined' && typeof UIControls.showLoginOverlay === 'function') {
          // Set return context to index/idle since login was triggered from terminal
          UIControls.showLoginOverlay('index');
        } else if (typeof LoginUI !== 'undefined') {
          LoginUI.showLoginPrompt();
          _enableInput('> ');
        }
        break;

      case 'user_register':
        if (typeof LoginUI !== 'undefined') {
          LoginUI.showRegisterPrompt();
        }
        _enableInput('> ');
        break;

      case 'user_logout':
        if (typeof LoginUI !== 'undefined') {
          LoginUI.logout().then(function () {
            _enableInput('> ');
          }).catch(function () {
            _enableInput('> ');
          });
        } else {
          _enableInput('> ');
        }
        break;

      case 'street':
        if (typeof RogueLoader !== 'undefined' && !RogueLoader.isLoaded()) {
          Terminal.writeLine('INITIALIZING FIELD SYSTEMS...', 'system-msg');
          RogueLoader.ensureLoaded(function () {
            _executeStreetAction(StreetChronicles.start());
          });
        } else {
          _executeStreetAction(StreetChronicles.start());
        }
        break;

      case 'rogue':
        // ── Gate: ensure game modules are loaded before entering rogue ──
        if (typeof RogueLoader !== 'undefined' && !RogueLoader.isLoaded()) {
          Terminal.writeLine('', 'system-msg');
          Terminal.writeLine('INITIALIZING FIELD SYSTEMS...', 'system-msg');
          var _rogueAction = action;
          RogueLoader.ensureLoaded(function () {
            Terminal.writeLine('SYSTEMS ONLINE', 'system-msg');
            Terminal.writeLine('', 'system-msg');
            // Re-dispatch now that all game modules are ready
            _executeAction(_rogueAction);
          });
          break;
        }
        console.debug('[main.js] Handling rogue action via GAMESTATE.requestRogue');
        if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.requestRogue === 'function') {
          Terminal.flicker();
          _executeRogueAction(GAMESTATE.requestRogue(action.data || {}));
        } else if (typeof GoneRogue !== 'undefined') {
          console.debug('[main.js] Fallback to direct GoneRogue.start (GAMESTATE.requestRogue not available)');
          Terminal.flicker();
          _executeRogueAction(GoneRogue.start(action.data || {}));
        } else {
          console.warn('[main.js] Gone Rogue mode unavailable');
          _displayLines(['', 'GONE ROGUE MODE UNAVAILABLE', ''], function () {
            _enableInput(_promptForState(StateMachine.getState()));
          });
        }
        break;

      case 'home':
        _returnToTitlePreserveSession();
        break;

      case 'mission':
        Terminal.flicker();
        _displayLines(action.lines, function () {
          StateMachine.transition(action.newState);
          _enableInput('COMMAND> ');
        }, 'system-msg classified');
        break;

      case 'api_join':
        _displayLines(action.lines, function () {
          if (typeof ApiClient !== 'undefined' && action.data) {
            ApiClient.join(action.data.code, action.data.callsign)
              .then(function (result) {
                if (result && result.token) {
                  Terminal.flicker();
                  _displayLines([
                    '',
                    'FIELD ACCESS GRANTED',
                    'CALLSIGN: ' + result.actor.callsign,
                    'TEAM: ' + result.actor.team.toUpperCase(),
                    'SCENARIO: #' + result.actor.scenario_id,
                    '',
                    'TYPE OPS FOR OPERATIONAL STATUS',
                    ''
                  ], function () {
                    _enableInput(_promptForState(StateMachine.getState()));
                  }, 'system-msg highlight');
                } else {
                  _displayLines([
                    '',
                    'FIELD ACCESS DENIED',
                    'INVALID OR EXPIRED JOIN CODE',
                    ''
                  ], function () {
                    _enableInput(_promptForState(StateMachine.getState()));
                  }, 'system-msg error');
                }
              });
          } else {
            _enableInput(_promptForState(StateMachine.getState()));
          }
        }, 'system-msg');
        break;

      case 'clear':
        Terminal.clear();
        if (action.data && action.data.fullReset) {
          // Full purge (CONFIRM PURGE) - wipe everything, show title
          _firstKeyPressed = false;
          _showTitleScreen();
        } else if (action.data && action.data.returnHome) {
          // HOME command - return to title screen, keep session data
          _firstKeyPressed = false;
          _showTitleScreen();
        } else {
          StateMachine.transition(action.newState);
          _enableInput(action.prompt || 'COMMAND> ');
        }
        break;

      case 'noop':
      default:
        _enableInput();
        break;
    }
  }

  /**
   * Display lines with typewriter effect then call callback.
   */
  function _displayLines(lines, callback, cssClass) {
    if (!lines || lines.length === 0) {
      if (callback) callback();
      return;
    }

    Terminal.typeLines(lines, Terminal.TYPE_SPEED_FAST, 80, cssClass)
      .then(function () {
        if (callback) callback();
      });
  }

  /**
   * ACCESS GRANTED sequence - dramatic reveal.
   */
  function _runAccessGranted() {
    Terminal.flicker();

    Terminal.typeLines([
      '',
      'TEMPORAL KEY VERIFIED',
      'ACCESS GRANTED',
      ''
    ], Terminal.TYPE_SPEED_FAST, 100, 'system-msg')
      .then(function () {
        return _pause(350);
      })
      .then(function () {
        Terminal.flicker();
        Terminal.clear();
        return _pause(200);
      })
      .then(function () {
        return Terminal.typeLines([
          'EYES ONLY',
          '',
          'YOU ARE CLEARED FOR EXPOSURE',
          '',
          'THIS SYSTEM DOES NOT RECRUIT',
          'IT REMEMBERS',
          '',
          '[PRESS ENTER]',
          ''
        ], Terminal.TYPE_SPEED_FAST, 70, 'system-msg');
      })
      .then(function () {
        StateMachine.transition('AWAITING_FINAL_ENTER');
        _enableInput('> ');
      });
  }

  function _returnToTitlePreserveSession() {
    Terminal.clear();
    Terminal.hideInput();
    _firstKeyPressed = false;
    _showTitleScreen();
  }

  /**
   * Show the current rotating mission briefing.
   */
  function _showMissionBriefing() {
    var mission = Missions.getRotatingBriefing();
    var progress = Missions.getProgress();

    var lines = [
      '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
      ' CLASSIFIED MISSION BRIEFING',
      ' SANDPOINT FIELD STATION',
      ' NODES: ' + progress.unlocked + ' / ' + progress.total + ' ACTIVE',
      '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
      ''
    ];

    if (mission) {
      lines = lines.concat([
        'CURRENT NODE: ' + mission.codename,
        'STATUS: ' + mission.status,
        '',
        mission.briefing,
        '',
        '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
        '',
        'TYPE HELP FOR AVAILABLE COMMANDS',
        ''
      ]);
    } else {
      lines = lines.concat([
        'ALL NODES DORMANT',
        'AWAITING FIELD INTELLIGENCE',
        '',
        'TYPE HELP FOR AVAILABLE COMMANDS',
        ''
      ]);
    }

    return Terminal.typeLines(lines, Terminal.TYPE_SPEED_FAST, 60, 'system-msg');
  }

  /**
   * Start periodic briefing rotation (every 60 seconds).
   */
  function _startBriefingRotation() {
    if (_briefingInterval) clearInterval(_briefingInterval);
    // Subtle: we don't auto-clear and re-display, just track.
    // The briefing changes when user types MISSIONS or on clear/refresh.
  }

  /**
   * Skip directly to granted state (returning user).
   */
  function _skipToGranted() {
    _firstKeyPressed = true;

    Terminal.typeLines([
      '',
      'SESSION RESTORED',
      'WELCOME BACK, CIVILIAN',
      ''
    ], Terminal.TYPE_SPEED_FAST, 100, 'system-msg')
      .then(function () {
        return _showMissionBriefing();
      })
      .then(function () {
        _enableInput('COMMAND> ');
      });
  }

  /**
   * Utility: pause for a duration.
   */
  function _pause(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  // --- Geolocation Hook (scaffolded for future expansion) ---

  /**
   * Request user geolocation and check proximity to mission nodes.
   * This is a placeholder that will be activated when the
   * geocaching system goes live.
   */
  function _checkGeolocation() {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      function (position) {
        var lat = position.coords.latitude;
        var lng = position.coords.longitude;

        // Check proximity to each mission
        var missions = Missions.getActiveMissions();
        missions.forEach(function (m) {
          var geo = Missions.getGeodata(m.id);
          if (!geo) return;

          var distance = _haversine(lat, lng, geo.lat, geo.lng);
          if (distance <= geo.radius) {
            // User is near a mission node
            Terminal.writeLine('');
            Terminal.writeLine('\u26A0 PROXIMITY ALERT: ' + m.codename, 'system-msg highlight');
            Terminal.writeLine('YOU ARE WITHIN RANGE OF A MISSION NODE', 'system-msg');
            Terminal.writeLine('');
          }
        });
      },
      function () { /* geolocation denied or unavailable */ }
    );
  }

  /**
   * Haversine distance formula (meters).
   */
  function _haversine(lat1, lng1, lat2, lng2) {
    var R = 6371000;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // --- Initialize on DOM ready ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
