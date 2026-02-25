/* ============================================================
   EYES ONLY - Terminal Command Router
   Routes top-level terminal commands to the appropriate handler.
   Handles: rogue, stats, inventory, highscore, quit, reset, dev
   Also manages persistent player state (avatar, callsign, tiers).
   ============================================================ */

const TerminalCommandRouter = (function() {
  'use strict';

  var STORAGE_KEY = 'GONE_ROGUE_PLAYER';

  // Player state (persisted to localStorage)
  var _playerState = {
    callsign: null,          // Player callsign (2-12 chars, uppercase)
    avatarId: null,          // Selected avatar ID (AVA-001 through AVA-006)
    avatarEmoji: null,       // Avatar emoji
    completedTiers: 0,       // Highest tier completed (0-4)
    totalRuns: 0,            // Total runs attempted
    totalDeaths: 0,          // Total deaths
    bestFloor: 0,            // Best floor reached
    createdAt: null          // Account creation timestamp
  };

  var _devMode = false;

  // ---- Commands the router recognises (case-insensitive) ----
  var COMMANDS = [
    'stats', 'inventory', 'inv', 'highscore', 'highscores', 'scores',
    'quit', 'exit', 'dev', 'devmode', 'whoami'
  ];

  // ---- Initialisation ----

  function init() {
    _loadPlayerState();
    console.log('[CommandRouter] Initialized. Callsign:', _playerState.callsign || '(none)');
  }

  // ---- Command detection ----

  /**
   * Check if raw input is a command this router handles.
   * Called from main.js _handleCommand before other handlers.
   * @param {string} rawInput
   * @returns {boolean}
   */
  function isRouterCommand(rawInput) {
    if (!rawInput) return false;
    var cmd = rawInput.trim().toLowerCase().split(/\s+/)[0];
    return COMMANDS.indexOf(cmd) !== -1;
  }

  /**
   * Process a terminal command and return an action object.
   * @param {string} rawInput
   * @returns {Object} { lines: string[], prompt: string, stayActive: boolean }
   */
  function process(rawInput) {
    var parts = (rawInput || '').trim().toLowerCase().split(/\s+/);
    var cmd = parts[0];

    switch (cmd) {
      case 'stats':
        return _handleStats();

      case 'inventory':
      case 'inv':
        return _handleInventory();

      case 'highscore':
      case 'highscores':
      case 'scores':
        return _handleHighscores();

      case 'quit':
      case 'exit':
        return _handleQuit();

      case 'dev':
      case 'devmode':
        return _handleDev(parts.slice(1));

      case 'whoami':
        return _handleWhoami();

      default:
        return {
          lines: ['Unknown router command: ' + cmd],
          prompt: '> ',
          stayActive: true
        };
    }
  }

  // ---- Command handlers ----

  function _handleStats() {
    var lines = [];
    lines.push('');
    lines.push('═══════════════════════════════════');
    lines.push('         OPERATIVE DOSSIER');
    lines.push('═══════════════════════════════════');
    lines.push('');

    // Player identity
    var name = _playerState.callsign || 'UNKNOWN';
    var avatar = _playerState.avatarEmoji || '🕵️';
    lines.push('  ' + avatar + '  CALLSIGN: ' + name);
    lines.push('  TIER CLEARANCE: ' + _playerState.completedTiers);
    lines.push('');

    // Run stats
    lines.push('  ── RUN HISTORY ──');
    lines.push('  Total Runs:    ' + _playerState.totalRuns);
    lines.push('  Total Deaths:  ' + _playerState.totalDeaths);
    lines.push('  Best Floor:    ' + _playerState.bestFloor);
    lines.push('');

    // Live resources (if GAMESTATE available and in-game)
    if (typeof GAMESTATE !== 'undefined') {
      lines.push('  ── RESOURCES ──');

      var cryptos = (GAMESTATE.getCryptos) ? GAMESTATE.getCryptos() : 0;
      lines.push('  Currency:  ¢' + cryptos);

      if (GAMESTATE.getAmmo) lines.push('  Ammo:      ؋' + GAMESTATE.getAmmo());
      if (GAMESTATE.getEnergy) lines.push('  Energy:    ⚡' + GAMESTATE.getEnergy());
      if (GAMESTATE.getFocus) lines.push('  Focus:     🎯' + GAMESTATE.getFocus());
      if (GAMESTATE.getBattery) lines.push('  Battery:   🔋' + GAMESTATE.getBattery());
      if (GAMESTATE.getFatigue) lines.push('  Fatigue:   🏋️' + GAMESTATE.getFatigue());
      lines.push('');
    }

    lines.push('═══════════════════════════════════');
    lines.push('');

    return { lines: lines, prompt: '> ', stayActive: true };
  }

  function _handleInventory() {
    var lines = [];
    lines.push('');
    lines.push('═══════════════════════════════════');
    lines.push('          FIELD INVENTORY');
    lines.push('═══════════════════════════════════');
    lines.push('');

    if (typeof GAMESTATE === 'undefined') {
      lines.push('  (GAMESTATE not available)');
      lines.push('');
      return { lines: lines, prompt: '> ', stayActive: true };
    }

    // Persistent inventory (survives death)
    var persistent = GAMESTATE.getPersistentInventory ? GAMESTATE.getPersistentInventory() : [];
    lines.push('  ── ARCHIVED (persist across death) ──');
    if (persistent.length === 0) {
      lines.push('  (empty)');
    } else {
      for (var i = 0; i < persistent.length; i++) {
        var pItem = persistent[i];
        var pEmoji = (pItem && pItem.emoji) ? pItem.emoji : '📦';
        var pName = (pItem && pItem.name) ? pItem.name : 'Unknown Item';
        lines.push('  [' + (i + 1) + '] ' + pEmoji + ' ' + pName);
      }
    }
    lines.push('');

    // Loose inventory (lost on death)
    var loose = GAMESTATE.getLooseInventory ? GAMESTATE.getLooseInventory() : [];
    lines.push('  ── LOOSE CARRY (lost on death) ──');
    if (loose.length === 0) {
      lines.push('  (empty)');
    } else {
      for (var j = 0; j < loose.length; j++) {
        var lItem = loose[j];
        var lEmoji = (lItem && lItem.emoji) ? lItem.emoji : '📦';
        var lName = (lItem && lItem.name) ? lItem.name : 'Unknown Item';
        lines.push('  [' + (j + 1) + '] ' + lEmoji + ' ' + lName);
      }
    }
    lines.push('');

    // Card hand
    if (GAMESTATE.getCardHand) {
      var hand = GAMESTATE.getCardHand();
      lines.push('  ── CARD HAND ──');
      if (!hand || hand.length === 0) {
        lines.push('  (no cards in hand)');
      } else {
        for (var k = 0; k < hand.length; k++) {
          var card = hand[k];
          var cEmoji = (card && card.emoji) ? card.emoji : '🃏';
          var cName = (card && card.name) ? card.name : 'Unknown Card';
          lines.push('  [' + (k + 1) + '] ' + cEmoji + ' ' + cName);
        }
      }
      lines.push('');
    }

    // Active item
    if (GAMESTATE.getActiveItem) {
      var active = GAMESTATE.getActiveItem();
      if (active) {
        var aEmoji = active.emoji || '🔧';
        var aName = active.name || active.id || 'Unknown';
        lines.push('  ── EQUIPPED ──');
        lines.push('  ' + aEmoji + ' ' + aName);
        lines.push('');
      }
    }

    lines.push('═══════════════════════════════════');
    lines.push('');

    return { lines: lines, prompt: '> ', stayActive: true };
  }

  function _handleHighscores() {
    var lines = [];
    lines.push('');
    lines.push('═══════════════════════════════════');
    lines.push('           HIGH SCORES');
    lines.push('═══════════════════════════════════');
    lines.push('');

    if (typeof HighscoreState === 'undefined' || !HighscoreState.getHighscores) {
      lines.push('  (Highscore system not available)');
      lines.push('');
      return { lines: lines, prompt: '> ', stayActive: true };
    }

    var scores = HighscoreState.getHighscores('gone_rogue', { limit: 10 });
    if (!scores || scores.length === 0) {
      lines.push('  No scores recorded yet.');
      lines.push('  Complete a run to set your first record!');
    } else {
      lines.push('  #   SCORE    FLOOR  NAME');
      lines.push('  ─── ─────── ────── ──────────────');
      for (var i = 0; i < scores.length; i++) {
        var s = scores[i];
        var rank = (i + 1 < 10 ? ' ' : '') + (i + 1);
        var score = ('' + (s.score || 0));
        while (score.length < 7) score = ' ' + score;
        var floor = '' + ((s.metadata && s.metadata.final_floor) || '?');
        while (floor.length < 5) floor = ' ' + floor;
        var name = s.display_name || 'AGENT';
        lines.push('  ' + rank + '. ' + score + '  ' + floor + '  ' + name);
      }
    }

    lines.push('');
    lines.push('═══════════════════════════════════');
    lines.push('');

    return { lines: lines, prompt: '> ', stayActive: true };
  }

  function _handleQuit() {
    var lines = [];
    lines.push('');
    lines.push('SESSION TERMINATED');
    lines.push('');
    lines.push('Returning to system prompt...');
    lines.push('');

    return { lines: lines, prompt: '> ', stayActive: true };
  }

  function _handleDev(args) {
    var subCmd = args[0] || '';
    var lines = [];

    if (subCmd === 'on') {
      _devMode = true;
      _generateDevPlayerState();
      lines.push('');
      lines.push('[DEV MODE ENABLED]');
      lines.push('Generated test player: ' + _playerState.avatarEmoji + ' ' + _playerState.callsign);
      lines.push('Tier clearance set to 4 (all avatars unlocked)');
      lines.push('');
    } else if (subCmd === 'off') {
      _devMode = false;
      _loadPlayerState(); // Reload real state
      lines.push('');
      lines.push('[DEV MODE DISABLED]');
      lines.push('Restored saved player state.');
      lines.push('');
    } else if (subCmd === 'status') {
      lines.push('');
      lines.push('Dev mode: ' + (_devMode ? 'ON' : 'OFF'));
      lines.push('Player: ' + (_playerState.callsign || 'none'));
      lines.push('Avatar: ' + (_playerState.avatarEmoji || 'none'));
      lines.push('Tiers: ' + _playerState.completedTiers);
      lines.push('');
    } else {
      lines.push('');
      lines.push('DEV COMMANDS:');
      lines.push('  dev on      Enable dev mode (random avatar + callsign)');
      lines.push('  dev off     Disable dev mode (restore saved state)');
      lines.push('  dev status  Show current dev state');
      lines.push('');
    }

    return { lines: lines, prompt: '> ', stayActive: true };
  }

  function _handleWhoami() {
    var lines = [];
    lines.push('');
    if (_playerState.callsign) {
      lines.push(_playerState.avatarEmoji + ' ' + _playerState.callsign);
      lines.push('Tier clearance: ' + _playerState.completedTiers);
      lines.push('Runs: ' + _playerState.totalRuns + ' | Deaths: ' + _playerState.totalDeaths);
    } else {
      lines.push('No operative profile found.');
      lines.push('Begin a run to create your identity.');
    }
    lines.push('');
    return { lines: lines, prompt: '> ', stayActive: true };
  }

  // ---- Player state persistence ----

  function _loadPlayerState() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        var parsed = JSON.parse(saved);
        // Merge saved fields into state (keep defaults for missing fields)
        for (var key in _playerState) {
          if (parsed.hasOwnProperty(key)) {
            _playerState[key] = parsed[key];
          }
        }
      }
    } catch (e) {
      console.warn('[CommandRouter] Failed to load player state:', e);
    }
  }

  function _savePlayerState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_playerState));
    } catch (e) {
      console.warn('[CommandRouter] Failed to save player state:', e);
    }
  }

  /**
   * Generate a random dev player state for testing.
   * Gives max tier clearance and a random callsign.
   */
  function _generateDevPlayerState() {
    var devNames = ['PHANTOM', 'VIPER', 'SPECTRE', 'FALCON', 'CIPHER', 'RAVEN', 'WOLF', 'COBRA'];
    var devAvatars = [
      { id: 'AVA-001', emoji: '🕵️', name: 'Operative' },
      { id: 'AVA-002', emoji: '👨‍⚕️', name: 'Medic' },
      { id: 'AVA-003', emoji: '🧭', name: 'Scout' },
      { id: 'AVA-004', emoji: '💪', name: 'Heavy' },
      { id: 'AVA-005', emoji: '👻', name: 'Ghost' },
      { id: 'AVA-006', emoji: '🤖', name: 'Tech' }
    ];

    var avatar = devAvatars[Math.floor(Math.random() * devAvatars.length)];
    var callsign = devNames[Math.floor(Math.random() * devNames.length)] + '-' + Math.floor(Math.random() * 900 + 100);

    _playerState.callsign = callsign;
    _playerState.avatarId = avatar.id;
    _playerState.avatarEmoji = avatar.emoji;
    _playerState.completedTiers = 4; // All unlocked
    _playerState.totalRuns = Math.floor(Math.random() * 50);
    _playerState.totalDeaths = Math.floor(Math.random() * 30);
    _playerState.bestFloor = Math.floor(Math.random() * 8) + 3;
    _playerState.createdAt = Date.now();

    // Don't save dev state to localStorage
  }

  // ---- Public helpers for other modules ----

  /**
   * Record a completed run (call after extraction or death).
   * @param {Object} runResult - { success, floor, deaths }
   */
  function recordRun(runResult) {
    runResult = runResult || {};
    _playerState.totalRuns++;
    if (!runResult.success) {
      _playerState.totalDeaths++;
    }
    if (runResult.floor && runResult.floor > _playerState.bestFloor) {
      _playerState.bestFloor = runResult.floor;
    }
    _savePlayerState();
  }

  /**
   * Set callsign (from character selection or setup).
   * @param {string} callsign - 2-12 chars, will be uppercased
   */
  function setCallsign(callsign) {
    if (!callsign || callsign.length < 2 || callsign.length > 12) return false;
    _playerState.callsign = callsign.toUpperCase();
    _savePlayerState();
    return true;
  }

  /**
   * Set selected avatar.
   * @param {string} avatarId - AVA-001 through AVA-006
   * @param {string} emoji - Avatar emoji
   */
  function setAvatar(avatarId, emoji) {
    _playerState.avatarId = avatarId;
    _playerState.avatarEmoji = emoji;
    _savePlayerState();
  }

  /**
   * Record tier completion.
   * @param {number} tier - Tier number completed
   */
  function completeTier(tier) {
    if (tier > _playerState.completedTiers) {
      _playerState.completedTiers = tier;
      _savePlayerState();
    }
  }

  function getPlayerState() {
    return Object.assign({}, _playerState);
  }

  function isDevMode() {
    return _devMode;
  }

  // ---- Module ----
  return {
    init: init,
    isRouterCommand: isRouterCommand,
    process: process,
    recordRun: recordRun,
    setCallsign: setCallsign,
    setAvatar: setAvatar,
    completeTier: completeTier,
    getPlayerState: getPlayerState,
    isDevMode: isDevMode
  };
})();
