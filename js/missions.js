/* ============================================================
   EYES ONLY - Mission Registry
   Manages geocaching mission nodes, location data,
   lore fragments, and faction rewards.
   Loads configuration from data/missions.json.
   ============================================================ */

const Missions = (function () {
  'use strict';

  // Storage key
  var STORAGE_KEY = 'eyesonly_missions';

  // Mission registry (loaded from JSON)
  var _missions = {};

  // Player mission state (persisted to localStorage)
  var _playerState = {
    unlockedMissions: [],
    collectedFragments: [],
    factionReputation: {},
    totalNodes: 0
  };

  /**
   * Default mission data (embedded fallback if JSON fetch fails).
   * Each mission node represents a Sandpoint business.
   *
   * ADDING NEW NODES:
   * To add a new location node, add an entry to data/missions.json
   * following this schema:
   *
   * {
   *   "id":          unique string identifier,
   *   "codename":    the codename displayed in terminal (all caps),
   *   "unlockCode":  the code phrase/QR payload to unlock this node,
   *   "location":    human-readable location hint,
   *   "coordinates": { "lat": number, "lng": number } (for geolocation),
   *   "faction":     faction name for reputation tracking,
   *   "lore":        array of strings (lore lines revealed on unlock),
   *   "reward":      string describing the ARPG reward,
   *   "briefing":    short mission briefing text,
   *   "status":      "ACTIVE" | "DORMANT" | "COMPROMISED"
   * }
   */
  var DEFAULT_MISSIONS = {
    "falcon_nest": {
      "id": "falcon_nest",
      "codename": "FALCON NEST",
      "unlockCode": "boyce77",
      "location": "Downtown Sandpoint - First Avenue",
      "coordinates": { "lat": 48.2766, "lng": -116.5535 },
      "faction": "WESTERN_SIGNALS",
      "lore": [
        "DECRYPTED FRAGMENT [1/3]:",
        "",
        "In 1977, a signal was intercepted from a source",
        "the Agency designated FALCON. The transmission",
        "originated not from Moscow, but from a small town",
        "in the Idaho panhandle. The implications were",
        "staggering. Someone in Sandpoint was listening.",
        "",
        "The dead drop was a bookshop. It is still there.",
        "The books have not moved."
      ],
      "reward": "DOSSIER FRAGMENT: FALCON PROTOCOL (1/3)",
      "briefing": "Investigate the FALCON signal origin point. A dead drop has been dormant since 1977. Local assets report unusual activity near First Avenue. Retrieve the fragment.",
      "status": "ACTIVE"
    },
    "snowman_node": {
      "id": "snowman_node",
      "codename": "SNOWMAN NODE",
      "unlockCode": "lee84",
      "location": "Sandpoint City Beach / Memorial Field",
      "coordinates": { "lat": 48.2808, "lng": -116.5563 },
      "faction": "NORTHERN_WATCH",
      "lore": [
        "DECRYPTED FRAGMENT [2/3]:",
        "",
        "The asset codenamed SNOWMAN operated in plain",
        "sight. A seminary dropout turned intelligence",
        "courier. The lake was the channel. In winter,",
        "when the surface froze, dead drops were placed",
        "beneath the ice at predetermined coordinates.",
        "",
        "Lake Pend Oreille is 1,150 feet deep.",
        "Some things were never recovered."
      ],
      "reward": "DOSSIER FRAGMENT: SNOWMAN NETWORK (2/3)",
      "briefing": "SNOWMAN operated a courier network through the lake system. The ice drops were seasonal. Verify the coordinates at the memorial. Something was left behind.",
      "status": "ACTIVE"
    },
    "submerged_site": {
      "id": "submerged_site",
      "codename": "SUBMERGED SITE",
      "unlockCode": "navydeep43",
      "location": "Sandpoint Marina / Lakefront",
      "coordinates": { "lat": 48.2752, "lng": -116.5521 },
      "faction": "ABYSSAL_COMMAND",
      "lore": [
        "DECRYPTED FRAGMENT [3/3]:",
        "",
        "CLASSIFIED: ACOUSTIC RANGE - LAKE PEND OREILLE",
        "",
        "The US Navy operated a submarine acoustic research",
        "station at Bayview, south of Sandpoint, for decades.",
        "The deepest lake in the Northwest was a perfect",
        "analog for deep ocean conditions.",
        "",
        "But acoustic research was only the surface cover.",
        "In 1952, sonar technicians reported anomalous returns",
        "from the lake floor. Objects that should not be there.",
        "Objects that had been there for a very long time.",
        "",
        "PROJECT ABYSSAL was born. It has never been declassified."
      ],
      "reward": "DOSSIER FRAGMENT: PROJECT ABYSSAL (3/3)",
      "briefing": "The Navy's Bayview facility is well documented. What it found is not. Visit the marina. Listen to the lake. The acoustic signature persists.",
      "status": "ACTIVE"
    }
  };

  /**
   * Initialize mission registry.
   * Attempts to load from JSON config, falls back to defaults.
   */
  function init() {
    _loadPlayerState();
    return _loadMissions();
  }

  /**
   * Load missions from JSON config file.
   */
  function _loadMissions() {
    return fetch('data/missions.json')
      .then(function (response) {
        if (!response.ok) throw new Error('Failed to load missions');
        return response.json();
      })
      .then(function (data) {
        _missions = data.missions || data;
        _playerState.totalNodes = Object.keys(_missions).length;
        _savePlayerState();
      })
      .catch(function () {
        // Fallback to embedded defaults
        _missions = DEFAULT_MISSIONS;
        _playerState.totalNodes = Object.keys(_missions).length;
        _savePlayerState();
      });
  }

  /**
   * Load player mission state from localStorage.
   */
  function _loadPlayerState() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        var parsed = JSON.parse(saved);
        Object.assign(_playerState, parsed);
      }
    } catch (e) { /* ignore */ }
  }

  /**
   * Save player mission state to localStorage.
   */
  function _savePlayerState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_playerState));
    } catch (e) { /* ignore */ }
  }

  /**
   * Attempt to unlock a mission node with a code.
   * Returns the mission object if successful, null otherwise.
   */
  function tryUnlock(code) {
    var normalized = code.toLowerCase().replace(/\s+/g, '');

    var keys = Object.keys(_missions);
    for (var i = 0; i < keys.length; i++) {
      var mission = _missions[keys[i]];
      if (mission.unlockCode.toLowerCase() === normalized) {
        // Check if already unlocked
        if (_playerState.unlockedMissions.indexOf(mission.id) !== -1) {
          return { mission: mission, alreadyUnlocked: true };
        }

        // Unlock it
        _playerState.unlockedMissions.push(mission.id);

        // Add faction reputation
        if (mission.faction) {
          _playerState.factionReputation[mission.faction] =
            (_playerState.factionReputation[mission.faction] || 0) + 1;
        }

        _savePlayerState();
        return { mission: mission, alreadyUnlocked: false };
      }
    }
    return null;
  }

  /**
   * Get a mission by codename.
   */
  function getByCodename(codename) {
    var normalized = codename.toUpperCase().replace(/\s+/g, '_');
    var keys = Object.keys(_missions);
    for (var i = 0; i < keys.length; i++) {
      var m = _missions[keys[i]];
      if (m.codename.replace(/\s+/g, '_').toUpperCase() === normalized) {
        return m;
      }
    }
    return null;
  }

  /**
   * Get all active missions.
   */
  function getActiveMissions() {
    return Object.keys(_missions)
      .map(function (k) { return _missions[k]; })
      .filter(function (m) { return m.status === 'ACTIVE'; });
  }

  /**
   * Get all unlocked missions.
   */
  function getUnlockedMissions() {
    return _playerState.unlockedMissions.map(function (id) {
      return _missions[id] || null;
    }).filter(Boolean);
  }

  /**
   * Get player progress summary.
   */
  function getProgress() {
    return {
      unlocked: _playerState.unlockedMissions.length,
      total: _playerState.totalNodes,
      factions: Object.assign({}, _playerState.factionReputation),
      fragments: _playerState.collectedFragments.slice()
    };
  }

  /**
   * Get rotating mission briefing (cycles through active missions).
   */
  function getRotatingBriefing() {
    var active = getActiveMissions();
    if (active.length === 0) return null;

    // Rotate based on time (changes every 30 seconds)
    var index = Math.floor(Date.now() / 30000) % active.length;
    return active[index];
  }

  /**
   * Reset all player mission data.
   */
  function reset() {
    _playerState = {
      unlockedMissions: [],
      collectedFragments: [],
      factionReputation: {},
      totalNodes: Object.keys(_missions).length
    };
    _savePlayerState();
  }

  /**
   * Get geolocation hook data for a mission.
   * Returns coordinates and proximity threshold.
   */
  function getGeodata(missionId) {
    var m = _missions[missionId];
    if (!m || !m.coordinates) return null;
    return {
      lat: m.coordinates.lat,
      lng: m.coordinates.lng,
      radius: 100 // meters proximity trigger
    };
  }

  return {
    init: init,
    tryUnlock: tryUnlock,
    getByCodename: getByCodename,
    getActiveMissions: getActiveMissions,
    getUnlockedMissions: getUnlockedMissions,
    getProgress: getProgress,
    getRotatingBriefing: getRotatingBriefing,
    getGeodata: getGeodata,
    reset: reset
  };
})();
