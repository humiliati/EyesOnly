/* ============================================================
   EYES ONLY - Street-Level Chronicles Subsystem
   Persistent location adventure with inventory and quests.
   ============================================================ */

const StreetChronicles = (function () {
  'use strict';

  var STORAGE_KEY = 'eyesonly_street_state';
  var _active = false;
  var _loaded = false;

  var _streets = {};
  var _businesses = {};
  var _events = {};

  var _state = {
    location: 'Cedar St',
    inventory: [],
    maxInventory: 9,
    quests: {},
    visited: {},
    idleTurns: 0,
    weather: 'A crisp breeze cuts between streetlights, carrying the scent of lake water and espresso.',
    lastInvalidDirection: null,
    invalidDirectionCount: 0
  };

  function init() {
    _loadPersisted();
    return Promise.all([
      fetch('data/streets.json').then(function (r) { return r.json(); }),
      fetch('data/businesses.json').then(function (r) { return r.json(); }),
      fetch('data/events.json').then(function (r) { return r.json(); })
    ]).then(function (payload) {
      _streets = payload[0] || {};
      _businesses = payload[1] || {};
      _events = payload[2] || {};
      _loaded = true;
      if (!_streets[_state.location]) _state.location = 'Cedar St';
      _save();
    }).catch(function () {
      _loaded = false;
    });
  }

  function isActive() {
    return _active;
  }

  function getPrompt() {
    return 'STREET> ';
  }

  function start() {
    _active = true;
    _state.idleTurns = 0;
    _save();
    return {
      lines: [
        '',
        'EYESONLY: STREET-LEVEL CHRONICLES',
        'TYPE HELP FOR MOVEMENT AND INTERACTIONS',
        ''
      ].concat(_describeLocation(true)),
      prompt: getPrompt(),
      stayActive: true
    };
  }

  function process(raw) {
    if (!_active) return { lines: ['STREET MODE INACTIVE', ''], stayActive: false };
    if (!_loaded) return { lines: ['MAP DATA UNAVAILABLE', ''], prompt: getPrompt(), stayActive: true };

    var cmd = (raw || '').trim();
    var normalized = Parser.normalize(cmd);

    if (!normalized) {
      _state.idleTurns++;
      _save();
      return { lines: _hintIfNeeded(), prompt: getPrompt(), stayActive: true };
    }

    // Check for ROGUE command to trigger Gone Rogue mode
    if (normalized === 'rogue' || normalized === 'gone rogue' || normalized === 'gone_rogue' || normalized === 'gonerogue') {
      console.debug('[StreetChronicles] ROGUE command detected, triggering Gone Rogue mode');
      _active = false;
      _save();

      // Trigger requestRogue if GAMESTATE is available
      if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.requestRogue === 'function') {
        return GAMESTATE.requestRogue({
          reason: 'manual',
          carryInventory: true
        });
      } else {
        console.warn('[StreetChronicles] GAMESTATE.requestRogue not available');
        return {
          lines: ['EXITING STREET-LEVEL CHRONICLES', 'ENTERING GONE ROGUE MODE', ''],
          stayActive: false
        };
      }
    }

    if (_isExit(normalized)) {
      _active = false;
      _save();
      return {
        lines: ['EXITING STREET-LEVEL CHRONICLES', 'RETURNING TO PRIMARY TERMINAL', ''],
        stayActive: false
      };
    }

    if (normalized === 'help') return { lines: _helpLines(), prompt: getPrompt(), stayActive: true };
    if (normalized === 'look' || normalized === 'where' || normalized === 'describe') {
      _state.idleTurns = 0;
      _save();
      return { lines: _describeLocation(false), prompt: getPrompt(), stayActive: true };
    }

    if (normalized === 'inventory' || normalized === 'inv') {
      // If UI inventory system is available, trigger it
      if (typeof window.UIControls !== 'undefined' && typeof window.UIControls.showInventory === 'function') {
        window.UIControls.showInventory();
        return { lines: [], prompt: getPrompt(), stayActive: true };
      }
      // Otherwise show text-based inventory
      return { lines: _inventoryLines(), prompt: getPrompt(), stayActive: true };
    }

    if (normalized === 'quests' || normalized === 'quest') {
      return { lines: _questLines(), prompt: getPrompt(), stayActive: true };
    }

    var direction = _parseDirection(normalized);
    if (direction) return _move(direction);

    if (normalized.indexOf('go ') === 0 || normalized.indexOf('walk ') === 0 || normalized.indexOf('head ') === 0 || normalized.indexOf('travel ') === 0 || normalized === 'forward march') {
      direction = _parseDirection(normalized);
      if (direction) return _move(direction);
    }

    if (normalized.indexOf('examine ') === 0) {
      return { lines: _examine(normalized.slice(8)), prompt: getPrompt(), stayActive: true };
    }

    if (normalized.indexOf('talk ') === 0 || normalized.indexOf('talk to ') === 0) {
      var target = normalized.replace('talk to ', '').replace('talk ', '');
      return { lines: _talk(target), prompt: getPrompt(), stayActive: true };
    }

    if (normalized.indexOf('take ') === 0 || normalized.indexOf('loot ') === 0 || normalized.indexOf('pick up ') === 0) {
      var item = normalized.replace('pick up ', '').replace('take ', '').replace('loot ', '');
      return { lines: _take(item), prompt: getPrompt(), stayActive: true };
    }

    _state.idleTurns++;
    _save();
    return {
      lines: ['UNRECOGNIZED FIELD ACTION', 'TRY: HELP, LOOK, GO NORTH, EXAMINE <TARGET>', ''],
      prompt: getPrompt(),
      stayActive: true
    };
  }

  function _helpLines() {
    return [
      'CHRONICLES COMMANDS:',
      '  LOOK / WHERE              describe current street',
      '  GO NORTH|EAST|SOUTH|WEST  travel',
      '  N / E / S / W             shorthand travel',
      '  EXAMINE <BUSINESS|OBJECT> inspect details',
      '  TALK TO <PERSON|CLERK>    ask for clues',
      '  TAKE <ITEM>               collect an item',
      '  INVENTORY                 list collected items',
      '  QUESTS                    show active quest flags',
      '  ROGUE                     enter Gone Rogue mode',
      '  EXIT STREET               return to main terminal',
      ''
    ];
  }

  function _describeLocation(includeHeader) {
    var loc = _state.location;
    var street = _streets[loc];
    if (!street) return ['LOCATION DATA CORRUPTED', ''];

    _state.visited[loc] = true;
    _save();

    var lines = [];
    if (includeHeader) lines.push('CURRENT NODE: ' + loc);
    lines.push(street.description);
    lines.push(_state.weather);

    var exits = [];
    if (street.north) exits.push('NORTH: ' + street.north);
    if (street.east) exits.push('EAST: ' + street.east);
    if (street.south) exits.push('SOUTH: ' + street.south);
    if (street.west) exits.push('WEST: ' + street.west);
    lines.push(exits.length ? ('EXITS -> ' + exits.join(' | ')) : 'NO CLEAR EXITS');

    var businesses = _businesses[loc] || [];
    if (businesses.length) {
      lines.push('BUSINESSES: ' + businesses.map(function (b) { return b.name; }).join(', '));
    }

    if (street.event_id && _events[street.event_id]) {
      lines.push('EVENT RECAP: ' + _events[street.event_id].recap);
      _state.quests[street.event_id] = true;
    }

    lines.push('');
    _save();
    return lines;
  }

  function _move(direction) {
    var street = _streets[_state.location];
    var next = street ? street[direction] : null;
    if (!next) {
      // Track repeated invalid direction attempts
      if (_state.lastInvalidDirection === direction) {
        _state.invalidDirectionCount++;
        console.debug('[StreetChronicles] Repeated invalid direction:', direction, 'count:', _state.invalidDirectionCount);

        // Trigger Gone Rogue after 2 repeated attempts (threshold = 2)
        if (_state.invalidDirectionCount >= 2) {
          console.debug('[StreetChronicles] Triggering Gone Rogue from repeated invalid directions');

          // Reset tracking
          _state.lastInvalidDirection = null;
          _state.invalidDirectionCount = 0;
          _save();

          // Trigger requestRogue if GAMESTATE is available
          if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.requestRogue === 'function') {
            return GAMESTATE.requestRogue({
              reason: 'out_of_bounds',
              carryInventory: true
            });
          } else {
            console.warn('[StreetChronicles] GAMESTATE.requestRogue not available, cannot trigger Gone Rogue');
          }
        }
      } else {
        // New invalid direction, reset counter
        _state.lastInvalidDirection = direction;
        _state.invalidDirectionCount = 1;
      }

      _state.idleTurns++;
      _save();

      // Build hint based on available exits
      var availableExits = [];
      if (street) {
        if (street.north) availableExits.push('NORTH');
        if (street.east) availableExits.push('EAST');
        if (street.south) availableExits.push('SOUTH');
        if (street.west) availableExits.push('WEST');
      }

      var hintLine = availableExits.length > 0
        ? 'TRY: ' + availableExits.join(' OR ')
        : 'NO CLEAR EXITS';

      return {
        lines: ['THAT ROUTE IS BLOCKED', 'YOU REMAIN ON ' + _state.location, hintLine, ''],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Valid move - reset invalid direction tracking
    _state.lastInvalidDirection = null;
    _state.invalidDirectionCount = 0;
    _state.location = next;
    _state.idleTurns = 0;
    _save();

    return {
      lines: ['TRAVEL CONFIRMED: ' + direction.toUpperCase(), ''].concat(_describeLocation(false)),
      prompt: getPrompt(),
      stayActive: true
    };
  }

  function _examine(target) {
    var loc = _state.location;
    var street = _streets[loc];
    var businesses = _businesses[loc] || [];
    var byName = businesses.find(function (b) { return Parser.normalize(b.name).indexOf(target) !== -1 || target.indexOf(Parser.normalize(b.name)) !== -1; });

    if (byName) return [byName.name + ': ' + byName.bio, ''];

    if (target.indexOf('window') !== -1 || target.indexOf('shop') !== -1) {
      return ['THE WINDOWS REFLECT PASSERSBY AND HINTS OF A HIDDEN DROP.', ''];
    }

    if (street.items && street.items.length) {
      return ['YOU NOTICE: ' + street.items.join(', '), ''];
    }

    return ['NOTHING UNUSUAL STANDS OUT.', ''];
  }

  function _talk(target) {
    var loc = _state.location;
    if (target.indexOf('clerk') !== -1 || target.indexOf('shopkeeper') !== -1 || target.indexOf('cafe') !== -1) {
      _state.quests['deliver_message'] = true;
      _save();
      return ['THE CLERK LOWERS THEIR VOICE: "LOOK FOR A FOLDED NOTE NEAR THE WATER."', 'QUEST UPDATED: deliver_message', ''];
    }

    if (loc === 'North 3rd St' && target.indexOf('gull') !== -1) {
      _state.quests['feed_gull'] = true;
      _save();
      return ['THE BRONZE GULL OFFERS NO WORDS, ONLY A PUZZLE IN SILENCE.', 'QUEST UPDATED: feed_gull', ''];
    }

    return ['NO ONE RESPONDS.', ''];
  }

  function _take(item) {
    // Check inventory capacity
    if (_state.inventory.length >= _state.maxInventory) {
      return [
        'INVENTORY FULL (' + _state.inventory.length + '/' + _state.maxInventory + ')',
        'DROP AN ITEM FIRST OR EXPAND CAPACITY',
        ''
      ];
    }

    var street = _streets[_state.location];
    var items = street && street.items ? street.items : [];
    var idx = -1;
    for (var i = 0; i < items.length; i++) {
      if (Parser.normalize(items[i]) === item || Parser.normalize(items[i]).indexOf(item) !== -1) {
        idx = i;
        break;
      }
    }

    if (idx === -1) return ['ITEM NOT FOUND HERE', ''];

    var picked = items.splice(idx, 1)[0];
    if (_state.inventory.indexOf(picked) === -1) _state.inventory.push(picked);

    if (picked === 'hackathon badge') _state.quests['badge_recovered'] = true;
    if (picked === 'gull feather') _state.quests['lakeview_token'] = true;

    _save();
    return [
      'ITEM ACQUIRED: ' + picked.toUpperCase(),
      'INVENTORY: ' + _state.inventory.length + '/' + _state.maxInventory,
      ''
    ];
  }

  function _inventoryLines() {
    var lines = [
      'INVENTORY (' + _state.inventory.length + '/' + _state.maxInventory + '):'
    ];
    if (!_state.inventory.length) lines.push('  [EMPTY]');
    else _state.inventory.forEach(function (i) { lines.push('  - ' + i); });
    lines.push('');
    return lines;
  }

  function _questLines() {
    var keys = Object.keys(_state.quests || {}).filter(function (k) { return _state.quests[k]; });
    var lines = ['QUEST FLAGS:'];
    if (!keys.length) lines.push('  [NONE]');
    else keys.forEach(function (k) { lines.push('  - ' + k); });
    lines.push('');
    return lines;
  }

  function _hintIfNeeded() {
    if (_state.idleTurns >= 3) return ['A LOCAL WHISPERS: "THE SHORTCUT IS BEHIND THE FOUNTAIN."', ''];
    return [''];
  }

  // Direction parsing — now delegated to DirectionParser (single source of truth)
  function _parseDirection(input) {
    if (typeof DirectionParser !== 'undefined') {
      return DirectionParser.parseCardinal(input);
    }
    // Inline fallback
    if (/\b(n|north|forward|up)\b/.test(input)) return 'north';
    if (/\b(e|east|right)\b/.test(input)) return 'east';
    if (/\b(s|south|down|back)\b/.test(input)) return 'south';
    if (/\b(w|west|left)\b/.test(input)) return 'west';
    return null;
  }

  function _isExit(input) {
    return input === 'exit street' || input === 'street exit' || input === 'exit' || input === 'quit';
  }

  function _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ active: _active, state: _state }));
    } catch (e) { /* ignore */ }
  }

  function _loadPersisted() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (parsed.state) _state = parsed.state;
      _active = !!parsed.active;
    } catch (e) { /* ignore */ }
  }

  function getInventory() {
    return _state.inventory || [];
  }

  /**
   * Deactivate Street Chronicles mode (yield control)
   * Called when transitioning to other modes (e.g., Gone Rogue)
   */
  function deactivate() {
    console.debug('[StreetChronicles.deactivate] Yielding control');
    _active = false;
    _save();
    return true;
  }

  return {
    init: init,
    start: start,
    process: process,
    isActive: isActive,
    getPrompt: getPrompt,
    getInventory: getInventory,
    deactivate: deactivate
  };
})();
