/* ============================================================
   EYES ONLY - ARG State Machine
   ============================================================ */

const StateMachine = (function () {
  'use strict';

  var STORAGE_KEY = 'eyesonly_state';

  var STATES = {
    IDLE: 'IDLE',
    BOOTING: 'BOOTING',
    AWAITING_CMD: 'AWAITING_CMD',
    AWAITING_DESIGNATION: 'AWAITING_DESIGNATION',
    AWAITING_PROCEED: 'AWAITING_PROCEED',
    AWAITING_TEMPORAL: 'AWAITING_TEMPORAL',
    ACCESS_GRANTED: 'ACCESS_GRANTED',
    MISSION_BRIEFING: 'MISSION_BRIEFING',
    MISSION_INPUT: 'MISSION_INPUT',
    AWAITING_FINAL_ENTER: 'AWAITING_FINAL_ENTER',
    END_LOCKED: 'END_LOCKED'
  };

  var _state = STATES.IDLE;
  var _data = {
    designation: null,
    clearanceLevel: 0,
    accessGranted: false,
    sessionStart: null,
    lastActivity: null,
    proceedChoice: null,
    failedAttempts: 0
  };

  var TEMPORAL_KEYS = ['1977', '19770422'];
  var MAX_FAILURES = 5;
  var LOCKOUT_DURATION = 30000;
  var _lockoutUntil = 0;

  function init() {
    _loadState();
    if (_data.accessGranted) _state = STATES.ACCESS_GRANTED;
  }

  function getState() { return _state; }
  function getData() { return Object.assign({}, _data); }

  function transition(newState) {
    if (!STATES[newState]) return _state;
    _state = STATES[newState];
    _data.lastActivity = Date.now();
    _saveState();
    return _state;
  }

  function process(parsed) {
    if (_lockoutUntil > Date.now()) {
      var remaining = Math.ceil((_lockoutUntil - Date.now()) / 1000);
      return {
        type: 'deny',
        lines: ['SECURITY LOCKOUT ACTIVE', 'RETRY IN ' + remaining + ' SECONDS', ''],
        newState: _state
      };
    }

    var cmd = parsed && parsed.command;
    var canUsePublicCommand = (
      _state === STATES.AWAITING_CMD ||
      _state === STATES.AWAITING_DESIGNATION ||
      _state === STATES.AWAITING_PROCEED ||
      _state === STATES.AWAITING_TEMPORAL ||
      _state === STATES.ACCESS_GRANTED ||
      _state === STATES.MISSION_BRIEFING ||
      _state === STATES.MISSION_INPUT
    );

    if (canUsePublicCommand && (
      cmd === 'ABOUT' || cmd === 'CONTACT' || cmd === 'FAQ' ||
      cmd === 'SANDPOINT' || cmd === 'SHOP' || cmd === 'MENU' ||
      cmd === 'SOCIAL' || cmd === 'HOME'
    )) {
      return _publicCommand(cmd);
    }

    switch (_state) {
      case STATES.AWAITING_CMD: return _processAwaitingCmd(parsed);
      case STATES.AWAITING_DESIGNATION: return _processDesignation(parsed);
      case STATES.AWAITING_PROCEED: return _processProceed(parsed);
      case STATES.AWAITING_TEMPORAL: return _processTemporal(parsed);
      case STATES.AWAITING_FINAL_ENTER:
      case STATES.END_LOCKED: return _processFinal(parsed);
      case STATES.ACCESS_GRANTED:
      case STATES.MISSION_BRIEFING:
      case STATES.MISSION_INPUT: return _processGranted(parsed);
      default: return { type: 'noop', newState: _state };
    }
  }

  function _publicCommand(cmd) {
    return _processCommonCommand({ command: cmd });
  }

  /**
   * Handle "normal website" commands that users might try.
   * These work in ANY state - pre-clearance or post-clearance.
   * Returns an action object or null if the command isn't a "normal" one.
   */
  function _processCommonCommand(parsed) {
    var cmd = parsed.command;

    if (cmd === 'ABOUT') {
      return {
        type: 'output',
        lines: [
          '',
          'CREDITS: WINDTALKER TECHNOLOGIES',
          'CREDITS: SANDPOINT CHAMBER OF COMMERCE',
          'CREDITS: ANTHROPIC / CLAUDE',
          'ALL OPERATIONS ARE FICTIONAL. ALL LOCATIONS ARE REAL.',
          '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
          ' OPERATIONAL DISCLOSURE',
          '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
          '',
          'THIS TERMINAL IS A JOINT OPERATION OF:',
          '',
          '  WINDTALKER TECHNOLOGIES',
          '  Tactical Systems Division',
          '',
          '  SANDPOINT CHAMBER OF COMMERCE',
          '  Civilian Liaison Office',
          '',
          '  ANTHROPIC / CLAUDE',
          '  Synthetic Intelligence Consultancy',
          '',
          'DEVELOPED IN COOPERATION WITH THE',
          'SMALL BUSINESSES AND COMMUNITY OF',
          'SANDPOINT, IDAHO',
          '',
          'ALL OPERATIONS ARE FICTIONAL.',
          'ALL LOCATIONS ARE REAL.',
          '',
          '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
          ''
        ],
        newState: _state
      };
    }

    if (cmd === 'HOME') {
      // Return to title screen but preserve session data.
      // State machine will restore from localStorage on next boot.
      return {
        type: 'clear',
        data: { returnHome: true },
        newState: 'IDLE'
      };
    }

    if (cmd === 'CONTACT') {
      return {
        type: 'output',
        lines: [
          '',
          '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
          ' SECURE COMMUNICATIONS CHANNEL',
          '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
          '',
          'FOR RECRUITMENT INQUIRIES,',
          'PARTNERSHIP PROPOSALS, OR',
          'INTELLIGENCE SUBMISSIONS:',
          '',
          '  SIGNAL:  admin@stellaraqua.com',
          '',
          'INCLUDE CODENAME IN SUBJECT LINE.',
          'UNSECURED CHANNELS MONITORED.',
          '',
          'RESPONSE TIME: 48-72 HOURS',
          'PRIORITY GIVEN TO FIELD OPERATIVES',
          '',
          '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
          ''
        ],
        newState: _state
      };
    }

    if (cmd === 'MENU') {
      return {
        type: 'output',
        lines: [
          '',
          'THIS IS NOT A WEBSITE.',
          'THIS IS A TERMINAL.',
          '',
          'THERE IS NO MENU.',
          'THERE ARE ONLY COMMANDS.',
          '',
          'TYPE HELP IF YOU ARE LOST.',
          ''
        ],
        newState: _state
      };
    }

    if (cmd === 'SHOP') {
      return {
        type: 'output',
        lines: [
          '',
          'PROCUREMENT REQUEST DENIED',
          '',
          'CLASSIFIED MATERIEL IS NOT',
          'AVAILABLE FOR CIVILIAN PURCHASE.',
          '',
          'VISIT SANDPOINT FIELD STATIONS',
          'FOR AUTHORIZED SUPPLY DROPS.',
          ''
        ],
        newState: _state
      };
    }

    if (cmd === 'SOCIAL') {
      return {
        type: 'output',
        lines: [
          '',
          'SOCIAL MEDIA INTEGRATION: DISABLED',
          '',
          'OPERATIONAL SECURITY PROHIBITS',
          'CONNECTION TO CIVILIAN NETWORKS.',
          '',
          'DO NOT DISCUSS THIS TERMINAL',
          'ON UNSECURED CHANNELS.',
          '',
          '... OR DO. WE MONITOR THOSE TOO.',
          ''
        ],
        newState: _state
      };
    }

    if (cmd === 'FAQ') {
      return {
        type: 'output',
        lines: [
          '',
          'FREQUENTLY ASKED QUESTIONS',
          '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
          '',
          'Q: WHAT IS THIS?',
          'A: CLASSIFIED.',
          '',
          'Q: NO REALLY, WHAT IS THIS?',
          'A: A RECRUITMENT TERMINAL FOR',
          '   SANDPOINT FIELD OPERATIONS.',
          '   TYPE CLEARANCE TO BEGIN.',
          '',
          'Q: IS THIS A GAME?',
          'A: THAT DEPENDS ON YOUR',
          '   CLEARANCE LEVEL.',
          '',
          'Q: DO I NEED TO GO SOMEWHERE?',
          'A: SANDPOINT, IDAHO.',
          '   THE REST IS NEED-TO-KNOW.',
          ''
        ],
        newState: _state
      };
    }

    if (cmd === 'SANDPOINT') {
      return {
        type: 'output',
        lines: [
          '',
          'SANDPOINT, IDAHO',
          '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
          '  48.28\u00b0N  116.55\u00b0W',
          '',
          'POPULATION: 9,246 (OFFICIAL)',
          'ELEVATION:  2,090 FT',
          'LAKE DEPTH: 1,150 FT (PEND OREILLE)',
          '',
          'COVER DESIGNATION: RESORT TOWN',
          'ACTUAL STATUS:     [REDACTED]',
          '',
          'THE CHAMBER OF COMMERCE DESCRIBES IT',
          'AS "A BEAUTIFUL MOUNTAIN COMMUNITY."',
          '',
          'THEY ARE NOT WRONG.',
          'BUT THAT IS NOT THE WHOLE STORY.',
          '',
          'TYPE CLEARANCE TO LEARN MORE.',
          ''
        ],
        newState: _state
      };
    }

    // Not a common command
    return null;
  }

  function _processAwaitingCmd(parsed) {
    var cmd = parsed.command;
    var publicAction = _publicCommand(cmd);
    if (publicAction) return publicAction;

    if (cmd === 'CLEARANCE' || cmd === 'ACCESS' || cmd === 'EYES_ONLY' || cmd === 'AUTH') {
      return {
        type: 'prompt',
        lines: ['', 'REQUEST ACKNOWLEDGED', 'CLEARANCE REQUIRED', 'PROVIDE DESIGNATION', ''],
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
          '  /HELP, CLEARANCE, ACCESS, AUTH, EYES ONLY',
          '  ABOUT, CONTACT, FAQ, SANDPOINT, MENU',
          '  SHOP, SOCIAL, HOME, LOGIN, STREET',
          '  MAP        - Enter street exploration mode',
          ''
        ],
        newState: _state
      };
    }

    if (cmd === 'CLEAR') return { type: 'clear', newState: _state, prompt: '> ' };

    if (cmd === 'LOGIN') {
      return { type: 'login', lines: [], newState: _state };
    }

    if (cmd === 'STREET' || cmd === 'MAP') {
      return { type: 'street', lines: ['', 'MAP LINK ACCEPTED', 'OPENING STREET-LEVEL CHRONICLES', ''], newState: _state };
    }

    if (cmd === 'JOIN') {
      return _handleJoinCommand(parsed);
    }

    // Check "normal website" commands
    var common = _processCommonCommand(parsed);
    if (common) return common;

    return {
      type: 'deny',
      lines: ['', 'INVALID INPUT, DID YOU MEAN /HELP?', 'INPUT LOGGED', ''],
      newState: _state
    };
  }

  function _processDesignation(parsed) {
    if (parsed.command === 'HELP') {
      _data.failedAttempts = 0;
      _saveState();
      return {
        type: 'output',
        lines: [
          '',
          'CLEARANCE SEQUENCE ABORTED',
          '',
          'AVAILABLE COMMANDS:',
          '  /HELP, CLEARANCE, ACCESS, AUTH, EYES ONLY',
          '  ABOUT, CONTACT, FAQ, SANDPOINT, MENU',
          '  SHOP, SOCIAL, HOME, LOGIN, STREET',
          '  MAP        - Enter street exploration mode',
          ''
        ],
        prompt: '> ',
        newState: 'AWAITING_CMD'
      };
    }

    // Military enlisted ranks E7-E10
    var enlistedMatch = parsed.normalized.match(/^e[\- ]?(7|8|9|10)$/);
    if (enlistedMatch) {
      var enlistedRanks = { '7': 'SERGEANT FIRST CLASS', '8': 'MASTER SERGEANT', '9': 'SERGEANT MAJOR', '10': 'SERGEANT MAJOR OF THE ARMY' };
      var enlistedTitle = enlistedRanks[enlistedMatch[1]] || 'SERGEANT';
      return {
        type: 'output',
        lines: ['', 'HELLO, ' + enlistedTitle + '.', '', 'YOUR SERVICE IS NOTED.', 'HOWEVER, THIS TERMINAL REQUIRES CIVILIAN DESIGNATION.', 'ENTER DESIGNATION:', ''],
        prompt: 'DESIGNATION> ',
        newState: _state
      };
    }

    // Officer ranks O3-O10
    var officerMatch = parsed.normalized.match(/^o[\- ]?(3|4|5|6|7|8|9|10)$/);
    if (officerMatch) {
      var officerRanks = { '3': 'CAPTAIN', '4': 'MAJOR', '5': 'LIEUTENANT COLONEL', '6': 'COLONEL', '7': 'BRIGADIER GENERAL', '8': 'MAJOR GENERAL', '9': 'LIEUTENANT GENERAL', '10': 'GENERAL' };
      var officerTitle = officerRanks[officerMatch[1]] || 'OFFICER';
      return {
        type: 'output',
        lines: ['', 'SALUTATIONS, ' + officerTitle + '.', '', 'RANK ACKNOWLEDGED.', 'HOWEVER, THIS TERMINAL REQUIRES CIVILIAN DESIGNATION.', 'ENTER DESIGNATION:', ''],
        prompt: 'DESIGNATION> ',
        newState: _state
      };
    }

    // GS civilian ranks GS1-GS15
    var gsMatch = parsed.normalized.match(/^gs[\- ]?(1[0-5]?|[2-9])$/);
    if (gsMatch) {
      var gsNum = parseInt(gsMatch[1], 10);
      var gsTitle = gsNum <= 4 ? 'CLERK' : (gsNum <= 9 ? 'ANALYST' : (gsNum <= 12 ? 'SUPERVISOR' : (gsNum <= 14 ? 'DIRECTOR' : 'SENIOR EXECUTIVE')));
      return {
        type: 'output',
        lines: ['', 'GREETINGS, ' + gsTitle + '.', '', 'GS-' + gsNum + ' CLASSIFICATION RECOGNIZED.', 'HOWEVER, THIS TERMINAL REQUIRES CIVILIAN DESIGNATION.', 'ENTER DESIGNATION:', ''],
        prompt: 'DESIGNATION> ',
        newState: _state
      };
    }

    if (Parser.matches(parsed.raw, 'OPERATOR') || Parser.matches(parsed.raw, 'ASSET')) {
      return {
        type: 'deny',
        lines: ['', 'DESIGNATION REJECTED', 'ENTER DESIGNATION:', ''],
        prompt: 'DESIGNATION> ',
        newState: _state
      };
    }

    if (Parser.matches(parsed.raw, 'CIVILIAN')) {
      _data.designation = 'CIVILIAN';
      _saveState();
      return {
        type: 'prompt',
        lines: ['', 'DESIGNATION ACCEPTED', 'WARNING: LIMITED ACCESS', 'PROCEED? [Y/N]', ''],
        prompt: '> ',
        newState: 'AWAITING_PROCEED'
      };
    }

    _data.failedAttempts++;
    _saveState();
    if (_data.failedAttempts >= MAX_FAILURES) {
      _lockoutUntil = Date.now() + LOCKOUT_DURATION;
      return {
        type: 'lockout',
        lines: ['', 'DESIGNATION REJECTED', 'SECURITY LOCKOUT ENGAGED', ''],
        newState: 'AWAITING_CMD'
      };
    }

    return {
      type: 'deny',
      lines: ['', 'DESIGNATION NOT RECOGNIZED', 'ATTEMPT ' + _data.failedAttempts + '/' + MAX_FAILURES, 'ENTER DESIGNATION:', ''],
      prompt: 'DESIGNATION> ',
      newState: _state
    };
  }

  function _processProceed(parsed) {
    if (parsed.command === 'HELP') {
      return {
        type: 'output',
        lines: [
          '',
          'CLEARANCE SEQUENCE ABORTED',
          '',
          'AVAILABLE COMMANDS:',
          '  /HELP, CLEARANCE, ACCESS, AUTH, EYES ONLY',
          '  ABOUT, CONTACT, FAQ, SANDPOINT, MENU',
          '  SHOP, SOCIAL, HOME, LOGIN, STREET',
          '  MAP        - Enter street exploration mode',
          ''
        ],
        prompt: '> ',
        newState: 'AWAITING_CMD'
      };
    }

    if (parsed.command === 'YES') {
      _data.proceedChoice = true;
      _saveState();
      return {
        type: 'prompt',
        lines: ['', 'CONSENT RECORDED', 'YOU ACCEPT OBSERVATION', '...', '', 'AWAITING INPUT', ''],
        prompt: '> ',
        newState: 'AWAITING_TEMPORAL'
      };
    }

    if (parsed.command === 'NO') {
      _data.proceedChoice = false;
      _saveState();
      return {
        type: 'prompt',
        lines: ['', 'RESPONSE LOGGED', 'CAUTION ADVISED', '...', '', 'AWAITING INPUT', ''],
        prompt: '> ',
        newState: 'AWAITING_TEMPORAL'
      };
    }

    return { type: 'output', lines: ['', 'RESPOND: Y OR N', ''], newState: _state };
  }

  function _processTemporal(parsed) {
    if (parsed.command === 'HELP') {
      return {
        type: 'output',
        lines: [
          '',
          'CLEARANCE SEQUENCE ABORTED',
          '',
          'AVAILABLE COMMANDS:',
          '  /HELP, CLEARANCE, ACCESS, AUTH, EYES ONLY',
          '  ABOUT, CONTACT, FAQ, SANDPOINT, MENU',
          '  SHOP, SOCIAL, HOME, LOGIN, STREET',
          '  MAP        - Enter street exploration mode',
          ''
        ],
        prompt: '> ',
        newState: 'AWAITING_CMD'
      };
    }

    if (TEMPORAL_KEYS.indexOf(parsed.normalized) !== -1) {
      _data.accessGranted = true;
      _data.clearanceLevel = 1;
      _data.sessionStart = Date.now();
      _data.failedAttempts = 0;
      _saveState();
      return { type: 'grant', newState: 'ACCESS_GRANTED' };
    }

    _data.failedAttempts++;
    _saveState();
    return {
      type: 'deny',
      lines: ['', 'AWAITING INPUT', 'ATTEMPT ' + _data.failedAttempts + '/' + MAX_FAILURES, ''],
      prompt: '> ',
      newState: _state
    };
  }

  function _processGranted(parsed) {
    var cmd = parsed.command;
    var publicAction = _publicCommand(cmd);
    if (publicAction) return publicAction;

    if (cmd === 'HELP') {
      return {
        type: 'output',
        lines: [
          '',
          'TERMINAL COMMANDS:',
          'STATUS, MISSIONS, DOSSIER, MAP, FALCON, SNOWMAN, SUBMERGED',
          'ABOUT, CONTACT, FAQ, SANDPOINT, MENU, SOCIAL, HOME, LOGIN, STREET',
          'MAP (or GRID/SECTOR) enters Street Chronicles',
          'CLEAR, RESET',
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
          '  ABOUT     - Operational disclosure',
          '  CONTACT   - Secure communications channel',
          '  FAQ       - Frequently asked questions',
          '  SANDPOINT - Location intelligence',
          '  HOME      - Return to title screen',
          '',
          'FIELD OPERATIONS:',
          '  JOIN <CODE>  - Join a live scenario',
          '  OPS          - Field operations status',
          '  DISCONNECT   - Leave current scenario',
          '',
          'Enter a MISSION CODE to unlock nodes.',
          ''
        ],
        newState: _state
      };
    }

    if (cmd === 'CLEAR') return { type: 'clear', newState: _state, prompt: 'COMMAND> ' };

    if (cmd === 'STATUS') {
      var progress = Missions.getProgress();
      return {
        type: 'output',
        lines: [
          '',
          'DESIGNATION: ' + (_data.designation || 'UNKNOWN'),
          'CLEARANCE: LEVEL ' + _data.clearanceLevel,
          'NODES ACTIVE: ' + progress.unlocked + ' / ' + progress.total,
          ''
        ],
        newState: _state
      };
    }

    if (cmd === 'MISSIONS') {
      var active = Missions.getActiveMissions();
      var lines = ['', 'ACTIVE MISSION NODES'];
      active.forEach(function (m) {
        lines.push('  ' + m.codename + ' - ' + m.status);
      });
      lines.push('');
      return { type: 'output', lines: lines, newState: _state };
    }

    if (cmd === 'DOSSIER') {
      var collected = Missions.getUnlockedMissions();
      if (!collected.length) {
        return { type: 'output', lines: ['', 'NO INTELLIGENCE COLLECTED', ''], newState: _state };
      }
      var dossier = ['', 'COLLECTED INTELLIGENCE'];
      collected.forEach(function (m) { dossier.push('  ' + m.codename + ': ' + m.reward); });
      dossier.push('');
      return { type: 'output', lines: dossier, newState: _state };
    }
    if (cmd === 'FALCON' || cmd === 'SNOWMAN' || cmd === 'SUBMERGED') {
      var code = cmd === 'FALCON' ? 'FALCON NEST' : (cmd === 'SNOWMAN' ? 'SNOWMAN NODE' : 'SUBMERGED SITE');
      var mission = Missions.getByCodename(code);
      if (mission) {
        return { type: 'output', lines: ['', mission.codename, mission.briefing, ''], newState: _state };
      }
    }

    if (cmd === 'AMBER') {
      document.body.classList.add('amber-mode');
      return { type: 'output', lines: ['', 'PHOSPHOR MODE: AMBER', ''], newState: _state };
    }

    if (cmd === 'GREEN') {
      document.body.classList.remove('amber-mode');
      return { type: 'output', lines: ['', 'PHOSPHOR MODE: GREEN', ''], newState: _state };
    }

    if (cmd === 'RESET') {
      if (Parser.matches(parsed.raw, 'CONFIRM PURGE')) {
        _resetState();
        Missions.reset();
        return { type: 'clear', data: { fullReset: true }, newState: 'IDLE' };
      }
      return { type: 'output', lines: ['', 'TYPE "CONFIRM PURGE" TO PROCEED', ''], newState: _state };
    }

    if (cmd === 'LOGIN') {
      return { type: 'login', lines: [], newState: _state };
    }

    if (cmd === 'STREET' || cmd === 'MAP') {
      return { type: 'street', lines: ['', 'MAP LINK ACCEPTED', 'OPENING STREET-LEVEL CHRONICLES', ''], newState: _state };
    }

    if (cmd === 'JOIN') {
      return _handleJoinCommand(parsed);
    }

    if (cmd === 'OPS') {
      return _handleOpsCommand();
    }

    if (cmd === 'DISCONNECT') {
      return _handleDisconnectCommand();
    }

    // Check "normal website" commands (work post-access too)
    var common = _processCommonCommand(parsed);
    if (common) return common;

    // Check for mission unlock codes
    if (cmd === 'CODE' || cmd === 'NUMERIC' || cmd === 'UNKNOWN') {
      var result = Missions.tryUnlock(parsed.raw);
      if (result) {
        return {
          type: 'mission',
          lines: ['', '██ NODE UNLOCKED: ' + result.mission.codename + ' ██', '', result.mission.lore, '', 'REWARD: ' + result.mission.reward, ''],
          newState: _state
        };
      }
    }

    return { type: 'output', lines: ['', 'COMMAND NOT RECOGNIZED', 'TYPE HELP FOR AVAILABLE COMMANDS', ''], newState: _state };
  }

  /**
   * Handle JOIN command — connect to a live scenario via join code.
   * Uses ApiClient (graceful fallback if backend unavailable).
   */
  function _handleJoinCommand(parsed) {
    // Check if ApiClient is available
    if (typeof ApiClient === 'undefined') {
      return {
        type: 'output',
        lines: ['', 'FIELD OPERATIONS MODULE OFFLINE', 'JOIN FUNCTIONALITY UNAVAILABLE', ''],
        newState: _state
      };
    }

    if (ApiClient.isConnected()) {
      var session = ApiClient.getSession();
      return {
        type: 'output',
        lines: [
          '',
          'ALREADY CONNECTED TO FIELD OPERATIONS',
          'CALLSIGN: ' + (session.actor ? session.actor.callsign : 'UNKNOWN'),
          'TEAM: ' + (session.actor ? session.actor.team.toUpperCase() : 'UNKNOWN'),
          '',
          'TYPE DISCONNECT TO LEAVE CURRENT SESSION',
          'TYPE OPS TO VIEW OPERATIONAL STATUS',
          ''
        ],
        newState: _state
      };
    }

    // Parse join code from args: "join ALPHA7" or just "join"
    var args = parsed.normalized.split(' ');
    if (args.length < 2) {
      return {
        type: 'output',
        lines: [
          '',
          'JOIN REQUIRES A CODE AND CALLSIGN',
          'USAGE: JOIN <CODE>',
          '',
          'OBTAIN A JOIN CODE FROM YOUR HANDLER',
          ''
        ],
        newState: _state
      };
    }

    var code = args[1].toUpperCase();
    var callsign = _data.designation || 'OPERATIVE-' + Math.floor(Math.random() * 9999);

    // This returns an async action — the terminal will handle it
    return {
      type: 'api_join',
      data: { code: code, callsign: callsign },
      lines: ['', 'REQUESTING FIELD ACCESS...', 'CODE: ' + code, 'CALLSIGN: ' + callsign, ''],
      newState: _state
    };
  }

  /**
   * Handle OPS command — show current operational status.
   */
  function _handleOpsCommand() {
    if (typeof ApiClient === 'undefined' || !ApiClient.isConnected()) {
      return {
        type: 'output',
        lines: [
          '',
          'FIELD OPERATIONS STATUS: OFFLINE',
          '',
          'TYPE JOIN <CODE> TO CONNECT TO A LIVE SCENARIO',
          ''
        ],
        newState: _state
      };
    }

    var session = ApiClient.getSession();
    return {
      type: 'output',
      lines: [
        '',
        'FIELD OPERATIONS STATUS: CONNECTED',
        'CALLSIGN: ' + (session.actor ? session.actor.callsign : 'UNKNOWN'),
        'TEAM: ' + (session.actor ? session.actor.team.toUpperCase() : 'UNKNOWN'),
        'SCENARIO: #' + (session.actor ? session.actor.scenario_id : '?'),
        '',
        'AVAILABLE OPS COMMANDS:',
        '  OPS           - This status screen',
        '  JOIN <CODE>   - Join a scenario',
        '  DISCONNECT    - Leave current scenario',
        ''
      ],
      newState: _state
    };
  }

  /**
   * Handle DISCONNECT command — leave current API session.
   */
  function _handleDisconnectCommand() {
    if (typeof ApiClient === 'undefined' || !ApiClient.isConnected()) {
      return {
        type: 'output',
        lines: ['', 'NO ACTIVE FIELD CONNECTION', ''],
        newState: _state
      };
    }

    ApiClient.disconnect();
    return {
      type: 'output',
      lines: [
        '',
        'FIELD CONNECTION TERMINATED',
        'SESSION DATA PURGED',
        ''
      ],
      newState: _state
    };
  }

  function _processFinal(parsed) {
    if (_state === STATES.AWAITING_FINAL_ENTER && parsed.command === 'ENTER') {
      return { type: 'output', lines: ['', 'END OF LINE', ''], newState: 'END_LOCKED' };
    }

    if (_state === STATES.END_LOCKED) {
      return { type: 'deny', lines: ['', 'TERMINAL LOCKED', 'SESSION ARCHIVED', ''], newState: _state };
    }

    return { type: 'output', lines: ['', 'PRESS ENTER', ''], newState: _state };
  }

  function _saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: _state, data: _data })); } catch (e) { /* ignore */ }
  }

  function _loadState() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      var parsed = JSON.parse(saved);
      if (parsed.state) _state = parsed.state;
      if (parsed.data) Object.assign(_data, parsed.data);
    } catch (e) { /* ignore */ }
  }

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
