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
      '',
      'INITIALIZING SECURE SESSION...',
    ];

    Terminal.typeLines(bootLines, Terminal.TYPE_SPEED_FAST, 200, 'system-msg')
      .then(function () {
        return Terminal.progressBar('ENCRYPTION', 1200);
      })
      .then(function () {
        return _pause(300);
      })
      .then(function () {
        return Terminal.typeLines([
          '',
          'VERIFYING CLEARANCE...',
        ], Terminal.TYPE_SPEED_FAST, 150, 'system-msg');
      })
      .then(function () {
        return Terminal.progressBar('CLEARANCE', 800);
      })
      .then(function () {
        return _pause(200);
      })
      .then(function () {
        Terminal.flicker();
        return Terminal.typeLines([
          '',
          '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
          ' EYES ONLY TERMINAL v3.77.1',
          ' CLASSIFICATION: TOP SECRET // SIGMA-7',
          ' SANDPOINT FIELD STATION',
          '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
          '',
          'TERMINAL READY',
          'ENTER CLEARANCE COMMAND TO PROCEED',
          ''
        ], Terminal.TYPE_SPEED_FAST, 80, 'system-msg');
      })
      .then(function () {
        // Transition to awaiting command
        StateMachine.transition('AWAITING_CMD');
        _enableInput('> ');
      });
  }

  /**
   * Enable terminal input and bind command handler.
   */
  function _enableInput(prompt) {
    Terminal.showInput(prompt || '> ');
    Terminal.onCommand(_handleCommand);
  }

  /**
   * Central command handler - routes through Parser and StateMachine.
   */
  function _handleCommand(rawInput) {
    if (!rawInput || rawInput.trim().length === 0) return;

    var parsed = Parser.parse(rawInput);
    var action = StateMachine.process(parsed);

    _executeAction(action);
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

      case 'mission':
        Terminal.flicker();
        _displayLines(action.lines, function () {
          StateMachine.transition(action.newState);
          _enableInput('COMMAND> ');
        }, 'system-msg classified');
        break;

      case 'clear':
        Terminal.clear();
        if (action.data && action.data.fullReset) {
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
      ''
    ], Terminal.TYPE_SPEED_FAST, 100, 'system-msg')
      .then(function () {
        return _pause(500);
      })
      .then(function () {
        Terminal.flicker();
        Terminal.clear();
        return _pause(300);
      })
      .then(function () {
        // ACCESS GRANTED banner
        return Terminal.typeLines([
          '',
          '',
          '\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588',
          '\u2588                                      \u2588',
          '\u2588         ACCESS GRANTED                \u2588',
          '\u2588         CLEARANCE: LEVEL 1             \u2588',
          '\u2588         WELCOME, CIVILIAN              \u2588',
          '\u2588                                      \u2588',
          '\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588',
        ], Terminal.TYPE_SPEED_FAST, 50, 'system-msg highlight');
      })
      .then(function () {
        return _pause(1500);
      })
      .then(function () {
        Terminal.clear();
        StateMachine.transition('ACCESS_GRANTED');
        return _showMissionBriefing();
      })
      .then(function () {
        _enableInput('COMMAND> ');
        _startBriefingRotation();
      });
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
