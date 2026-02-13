/* ============================================================
   EYES ONLY - ARG State Machine
   Drives the multi-step clearance verification flow.
   States are persisted to localStorage for session continuity.
   ============================================================ */

const StateMachine = (function () {
  'use strict';

  var STORAGE_KEY = 'eyesonly_state';

  /**
   * State definitions:
   *
   * IDLE          - Title screen, waiting for any keypress
   * BOOTING       - Boot sequence animation in progress
   * AWAITING_CMD  - Waiting for clearance command
   * AWAITING_DESIGNATION - Prompted for designation
   * AWAITING_PROCEED     - Prompted for Y/N confirmation
   * AWAITING_TEMPORAL    - Prompted for temporal key
   * ACCESS_GRANTED       - Clearance obtained, terminal active
   * MISSION_BRIEFING     - Displaying rotating briefing
   * MISSION_INPUT        - Accepting mission codes
   */
  var STATES = {
    IDLE:                  'IDLE',
    BOOTING:               'BOOTING',
    AWAITING_CMD:          'AWAITING_CMD',
    AWAITING_DESIGNATION:  'AWAITING_DESIGNATION',
    AWAITING_PROCEED:      'AWAITING_PROCEED',
    AWAITING_TEMPORAL:     'AWAITING_TEMPORAL',
    ACCESS_GRANTED:        'ACCESS_GRANTED',
    MISSION_BRIEFING:      'MISSION_BRIEFING',
    MISSION_INPUT:         'MISSION_INPUT'
  };

  // Current state
  var _state = STATES.IDLE;

  // State data (persisted)
  var _data = {
    designation: null,
    clearanceLevel: 0,
    accessGranted: false,
    sessionStart: null,
    lastActivity: null,
    proceedChoice: null,
    failedAttempts: 0
  };

  // Temporal key for this version (The Falcon and the Snowman - 1977)
  var TEMPORAL_KEY = '1977';

  // Maximum failed attempts before lockout
  var MAX_FAILURES = 5;
  var LOCKOUT_DURATION = 30000; // 30 seconds

  // Lockout tracking
  var _lockoutUntil = 0;

  /**
   * Initialize state machine. Restores saved state if available.
   */
  function init() {
    _loadState();

    // If they already have access, jump straight there
    if (_data.accessGranted) {
      _state = STATES.ACCESS_GRANTED;
    }
  }

  /**
   * Get current state name.
   */
  function getState() {
    return _state;
  }

  /**
   * Get state data.
   */
  function getData() {
    return Object.assign({}, _data);
  }

  /**
   * Transition to a new state.
   * Returns the new state name.
   */
  function transition(newState) {
    if (!STATES[newState]) {
      console.warn('StateMachine: invalid state', newState);
      return _state;
    }
    _state = STATES[newState];
    _data.lastActivity = Date.now();
    _saveState();
    return _state;
  }

  /**
   * Process a parsed command in the current state.
   * Returns an action object describing what the terminal should do.
   *
   * Action format:
   * {
   *   type:     'output' | 'prompt' | 'clear' | 'grant' | 'deny' | 'lockout' | 'mission' | 'noop',
   *   lines:    string[],        // text to display
   *   speed:    number,          // typing speed
   *   prompt:   string,          // prompt text for input
   *   newState: string,          // state to transition to
   *   data:     object           // additional data
   * }
   */
  function process(parsed) {
    // Check lockout
    if (_lockoutUntil > Date.now()) {
      var remaining = Math.ceil((_lockoutUntil - Date.now()) / 1000);
      return {
        type: 'deny',
        lines: [
          'SECURITY LOCKOUT ACTIVE',
          'TOO MANY FAILED ATTEMPTS',
          'RETRY IN ' + remaining + ' SECONDS',
          ''
        ],
        newState: _state
      };
    }

    switch (_state) {

      case STATES.AWAITING_CMD:
        return _processAwaitingCmd(parsed);

      case STATES.AWAITING_DESIGNATION:
        return _processDesignation(parsed);

      case STATES.AWAITING_PROCEED:
        return _processProceed(parsed);

      case STATES.AWAITING_TEMPORAL:
        return _processTemporalKey(parsed);

      case STATES.ACCESS_GRANTED:
      case STATES.MISSION_BRIEFING:
      case STATES.MISSION_INPUT:
        return _processGrantedCommand(parsed);

      default:
        return { type: 'noop', newState: _state };
    }
  }

  /**
   * Handle commands in AWAITING_CMD state.
   */
  function _processAwaitingCmd(parsed) {
    var cmd = parsed.command;

    if (cmd === 'CLEARANCE' || cmd === 'ACCESS' || cmd === 'EYES_ONLY' || cmd === 'AUTH') {
      return {
        type: 'prompt',
        lines: [
          '',
          'CLEARANCE VERIFICATION INITIATED',
          'PROTOCOL: EYES ONLY / SIGMA-7',
          '',
          'ENTER DESIGNATION:'
        ],
        prompt: 'DESIGNATION> ',
        newState: 'AWAITING_DESIGNATION'
      };
    }

    if (cmd === 'HELP') {
      return {
        type: 'output',
        lines: [
          '',
          'AVAILABLE COMMANDS:',
          '  CLEARANCE  - Initiate clearance verification',
          '  ACCESS     - Request terminal access',
          '  AUTH       - Authenticate credentials',
          '  EYES ONLY  - Invoke classification protocol',
          ''
        ],
        newState: _state
      };
    }

    if (cmd === 'CLEAR') {
      return { type: 'clear', newState: _state };
    }

    // Easter egg: hidden commands at this stage
    if (cmd === 'FALCON') {
      return {
        type: 'output',
        lines: [
          '',
          'REFERENCE: CHRISTOPHER BOYCE',
          'STATUS: COMPROMISED',
          'LAST KNOWN SIGNAL: 1977',
          'CLASSIFICATION: [REDACTED]',
          ''
        ],
        newState: _state
      };
    }

    if (cmd === 'SNOWMAN') {
      return {
        type: 'output',
        lines: [
          '',
          'REFERENCE: ANDREW DAULTON LEE',
          'STATUS: CONTAINED',
          'OPERATIONAL PERIOD: 1974-1977',
          'CLASSIFICATION: [REDACTED]',
          ''
        ],
        newState: _state
      };
    }

    return {
      type: 'deny',
      lines: [
        '',
        'UNRECOGNIZED INPUT',
        'CLEARANCE REQUIRED FOR TERMINAL ACCESS',
        ''
      ],
      newState: _state
    };
  }

  /**
   * Handle designation input.
   */
  function _processDesignation(parsed) {
    // Accept CIVILIAN as the correct designation
    if (Parser.matches(parsed.raw, 'CIVILIAN')) {
      _data.designation = 'CIVILIAN';
      return {
        type: 'prompt',
        lines: [
          '',
          'DESIGNATION ACCEPTED: CIVILIAN',
          'CLEARANCE LEVEL: PROVISIONAL',
          '',
          'WARNING: FURTHER ACCESS CONSTITUTES CONSENT',
          'TO MONITORING UNDER DIRECTIVE 77-SIGMA',
          '',
          'PROCEED? [Y/N]'
        ],
        prompt: '> ',
        newState: 'AWAITING_PROCEED'
      };
    }

    // Wrong designation
    _data.failedAttempts++;
    if (_data.failedAttempts >= MAX_FAILURES) {
      _lockoutUntil = Date.now() + LOCKOUT_DURATION;
      return {
        type: 'lockout',
        lines: [
          '',
          'DESIGNATION REJECTED',
          'MAXIMUM ATTEMPTS EXCEEDED',
          'SECURITY LOCKOUT ENGAGED',
          'TERMINAL LOCKED FOR 30 SECONDS',
          ''
        ],
        newState: 'AWAITING_CMD'
      };
    }

    return {
      type: 'deny',
      lines: [
        '',
        'DESIGNATION NOT RECOGNIZED',
        'ATTEMPT ' + _data.failedAttempts + '/' + MAX_FAILURES,
        '',
        'ENTER DESIGNATION:'
      ],
      prompt: 'DESIGNATION> ',
      newState: _state
    };
  }

  /**
   * Handle Y/N proceed confirmation.
   */
  function _processProceed(parsed) {
    if (parsed.command === 'YES') {
      _data.proceedChoice = true;
      _saveState();
      return {
        type: 'prompt',
        lines: [
          '',
          'CONSENT RECORDED',
          '',
          'TEMPORAL VERIFICATION REQUIRED',
          'ENTER ORIGIN YEAR OF THE FALCON SIGNAL:'
        ],
        prompt: 'YEAR> ',
        newState: 'AWAITING_TEMPORAL'
      };
    }

    if (parsed.command === 'NO') {
      _data.proceedChoice = false;
      _saveState();
      return {
        type: 'output',
        lines: [
          '',
          'ACKNOWLEDGED',
          'SESSION TERMINATED',
          'YOUR NON-PARTICIPATION HAS BEEN NOTED',
          '',
          'TERMINAL STANDING BY...',
          ''
        ],
        prompt: '> ',
        newState: 'AWAITING_CMD'
      };
    }

    return {
      type: 'output',
      lines: ['', 'RESPOND: Y OR N', ''],
      prompt: '> ',
      newState: _state
    };
  }

  /**
   * Handle temporal key verification.
   */
  function _processTemporalKey(parsed) {
    if (parsed.normalized === TEMPORAL_KEY) {
      _data.accessGranted = true;
      _data.clearanceLevel = 1;
      _data.sessionStart = Date.now();
      _data.failedAttempts = 0;
      _saveState();
      return {
        type: 'grant',
        lines: [], // Handled specially by main.js
        newState: 'ACCESS_GRANTED'
      };
    }

    _data.failedAttempts++;
    if (_data.failedAttempts >= MAX_FAILURES) {
      _lockoutUntil = Date.now() + LOCKOUT_DURATION;
      return {
        type: 'lockout',
        lines: [
          '',
          'TEMPORAL KEY REJECTED',
          'MAXIMUM ATTEMPTS EXCEEDED',
          'SECURITY LOCKOUT ENGAGED',
          ''
        ],
        newState: 'AWAITING_CMD'
      };
    }

    return {
      type: 'deny',
      lines: [
        '',
        'TEMPORAL KEY INCORRECT',
        'ATTEMPT ' + _data.failedAttempts + '/' + MAX_FAILURES,
        '',
        'ENTER ORIGIN YEAR OF THE FALCON SIGNAL:'
      ],
      prompt: 'YEAR> ',
      newState: _state
    };
  }

  /**
   * Handle commands after access is granted.
   */
  function _processGrantedCommand(parsed) {
    var cmd = parsed.command;

    if (cmd === 'HELP') {
      return {
        type: 'output',
        lines: [
          '',
          'TERMINAL COMMANDS:',
          '  STATUS    - Display operational status',
          '  MISSIONS  - List active mission nodes',
          '  DOSSIER   - Access collected intelligence',
          '  MAP       - Display sector grid',
          '  FALCON    - Query FALCON reference',
          '  SNOWMAN   - Query SNOWMAN reference',
          '  SUBMERGED - Query SUBMERGED SITE',
          '  CLEAR     - Clear terminal',
          '  RESET     - Purge all session data',
          '',
          'Enter a MISSION CODE to unlock nodes.',
          ''
        ],
        newState: _state
      };
    }

    if (cmd === 'CLEAR') {
      return { type: 'clear', newState: _state };
    }

    if (cmd === 'STATUS') {
      var progress = Missions.getProgress();
      return {
        type: 'output',
        lines: [
          '',
          'OPERATIONAL STATUS',
          '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
          'DESIGNATION:  ' + (_data.designation || 'UNKNOWN'),
          'CLEARANCE:    LEVEL ' + _data.clearanceLevel,
          'NODES ACTIVE: ' + progress.unlocked + ' / ' + progress.total,
          'SESSION:      ' + _formatDuration(Date.now() - _data.sessionStart),
          '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
          ''
        ],
        newState: _state
      };
    }

    if (cmd === 'MISSIONS') {
      var active = Missions.getActiveMissions();
      var unlocked = Missions.getUnlockedMissions();
      var unlockedIds = unlocked.map(function (m) { return m.id; });
      var missionLines = [
        '',
        'ACTIVE MISSION NODES',
        '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500'
      ];
      active.forEach(function (m) {
        var status = unlockedIds.indexOf(m.id) !== -1 ? '[UNLOCKED]' : '[LOCKED]';
        missionLines.push('  ' + m.codename + '  ' + status);
        missionLines.push('  Location: ' + m.location);
        missionLines.push('');
      });
      missionLines.push('Enter mission unlock codes to access intel.');
      missionLines.push('');
      return {
        type: 'output',
        lines: missionLines,
        newState: _state
      };
    }

    if (cmd === 'DOSSIER') {
      var collected = Missions.getUnlockedMissions();
      if (collected.length === 0) {
        return {
          type: 'output',
          lines: [
            '',
            'NO INTELLIGENCE COLLECTED',
            'UNLOCK MISSION NODES TO ACCESS DOSSIER',
            ''
          ],
          newState: _state
        };
      }
      var dossierLines = ['', 'COLLECTED INTELLIGENCE', '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500'];
      collected.forEach(function (m) {
        dossierLines.push('');
        dossierLines.push('CODENAME: ' + m.codename);
        dossierLines.push('REWARD:   ' + m.reward);
      });
      dossierLines.push('');
      return {
        type: 'output',
        lines: dossierLines,
        newState: _state
      };
    }

    if (cmd === 'MAP') {
      return {
        type: 'output',
        lines: [
          '',
          'SECTOR GRID: SANDPOINT, IDAHO',
          '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
          '  48.28\u00b0N  116.55\u00b0W',
          '',
          '    [F] FALCON NEST     - Downtown',
          '    [S] SNOWMAN NODE    - City Beach',
          '    [U] SUBMERGED SITE  - Marina',
          '',
          '  LAKE PEND OREILLE: DEPTH 1,150 FT',
          '  NAVY ACOUSTIC RANGE: [CLASSIFIED]',
          '',
          '  GEOLOCATION: STANDBY',
          ''
        ],
        newState: _state
      };
    }

    if (cmd === 'FALCON') {
      var falcon = Missions.getByCodename('FALCON NEST');
      if (falcon) {
        return {
          type: 'output',
          lines: ['', 'MISSION NODE: ' + falcon.codename, ''].concat(
            [falcon.briefing],
            ['', 'STATUS: ' + falcon.status, '']
          ),
          newState: _state
        };
      }
    }

    if (cmd === 'SNOWMAN') {
      var snowman = Missions.getByCodename('SNOWMAN NODE');
      if (snowman) {
        return {
          type: 'output',
          lines: ['', 'MISSION NODE: ' + snowman.codename, ''].concat(
            [snowman.briefing],
            ['', 'STATUS: ' + snowman.status, '']
          ),
          newState: _state
        };
      }
    }

    if (cmd === 'SUBMERGED') {
      var sub = Missions.getByCodename('SUBMERGED SITE');
      if (sub) {
        return {
          type: 'output',
          lines: ['', 'MISSION NODE: ' + sub.codename, ''].concat(
            [sub.briefing],
            ['', 'STATUS: ' + sub.status, '']
          ),
          newState: _state
        };
      }
    }

    if (cmd === 'AMBER') {
      document.body.classList.add('amber-mode');
      return {
        type: 'output',
        lines: ['', 'PHOSPHOR MODE: AMBER', ''],
        newState: _state
      };
    }

    if (cmd === 'GREEN') {
      document.body.classList.remove('amber-mode');
      return {
        type: 'output',
        lines: ['', 'PHOSPHOR MODE: GREEN', ''],
        newState: _state
      };
    }

    if (cmd === 'RESET') {
      return {
        type: 'output',
        lines: [
          '',
          'WARNING: THIS WILL PURGE ALL SESSION DATA',
          'TYPE "CONFIRM PURGE" TO PROCEED',
          ''
        ],
        data: { awaitingPurge: true },
        newState: _state
      };
    }

    // Check for mission unlock codes
    if (cmd === 'CODE' || cmd === 'NUMERIC' || cmd === 'UNKNOWN') {
      var result = Missions.tryUnlock(parsed.raw);
      if (result) {
        if (result.alreadyUnlocked) {
          return {
            type: 'output',
            lines: [
              '',
              'NODE ALREADY ACTIVE: ' + result.mission.codename,
              'INTEL PREVIOUSLY RETRIEVED',
              ''
            ],
            newState: _state
          };
        }
        // New unlock - return mission lore
        return {
          type: 'mission',
          lines: [''].concat(
            ['\u2588\u2588 NODE UNLOCKED: ' + result.mission.codename + ' \u2588\u2588'],
            [''],
            result.mission.lore,
            [''],
            ['REWARD: ' + result.mission.reward],
            ['']
          ),
          data: { mission: result.mission },
          newState: _state
        };
      }

      // Check for purge confirmation
      if (Parser.matches(parsed.raw, 'CONFIRM PURGE')) {
        _resetState();
        Missions.reset();
        return {
          type: 'clear',
          lines: ['', 'ALL DATA PURGED', 'TERMINAL RESETTING...', ''],
          data: { fullReset: true },
          newState: 'IDLE'
        };
      }
    }

    return {
      type: 'output',
      lines: ['', 'COMMAND NOT RECOGNIZED', 'TYPE HELP FOR AVAILABLE COMMANDS', ''],
      newState: _state
    };
  }

  /**
   * Format a duration in ms to human-readable.
   */
  function _formatDuration(ms) {
    var seconds = Math.floor(ms / 1000);
    var minutes = Math.floor(seconds / 60);
    var hours = Math.floor(minutes / 60);
    if (hours > 0) return hours + 'h ' + (minutes % 60) + 'm';
    if (minutes > 0) return minutes + 'm ' + (seconds % 60) + 's';
    return seconds + 's';
  }

  /**
   * Save state to localStorage.
   */
  function _saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        state: _state,
        data: _data
      }));
    } catch (e) { /* ignore */ }
  }

  /**
   * Load state from localStorage.
   */
  function _loadState() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        var parsed = JSON.parse(saved);
        if (parsed.state) _state = parsed.state;
        if (parsed.data) Object.assign(_data, parsed.data);
      }
    } catch (e) { /* ignore */ }
  }

  /**
   * Reset all state.
   */
  function _resetState() {
    _state = STATES.IDLE;
    _data = {
      designation: null,
      clearanceLevel: 0,
      accessGranted: false,
      sessionStart: null,
      lastActivity: null,
      proceedChoice: null,
      failedAttempts: 0
    };
    _lockoutUntil = 0;
    localStorage.removeItem(STORAGE_KEY);
  }

  return {
    STATES: STATES,
    init: init,
    getState: getState,
    getData: getData,
    transition: transition,
    process: process,
    reset: _resetState
  };
})();
