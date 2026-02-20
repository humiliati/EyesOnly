/* ============================================================
   EYES ONLY - Gone Rogue Mode Engine
   ASCII stealth roguelike inside terminal column
   ============================================================ */

const GoneRogue = (function () {
  'use strict';

  var STORAGE_KEY = 'eyesonly_rogue_state';
  var _active = false;
  var _loaded = false;

  // Grid configuration (mobile-first)
  var GRID_WIDTH = 40;
  var GRID_HEIGHT = 20;

  var _grid = [];
  var _player = {
    x: 5,
    y: 10,
    hp: 10,
    maxHp: 10,
    energy: 5,
    maxEnergy: 5,
    stealth: 3,
    detection: 0,
    lastMoveDirection: null, // Track last move direction for flanking logic (north, south, east, west)
    str: 5, // Strength for combat
    dex: 5, // Dexterity for hit/dodge
    initiative: 0, // Initiative bonus
    combatEntries: 0, // Track total combat entries (for boss mythic conditions)
    lastCardType: null, // Track last card used (for boss mythic conditions)
    collectingCurrency: false, // Track currency collection for animation
    currencyCollectTime: 0 // Timestamp of last currency collection
  };

  var _enemies = [];
  var _items = [];
  var _projectiles = [];
  var _breakables = [];
  var _currencies = []; // Currency drops on floor (yellow dots ¢)
  var _shops = []; // Shop objects on floor (🏪 or 👤)
  var _turn = 0;
  var _floor = 1;
  var _alertLevel = 'safe'; // safe, caution, danger
  var _useInteractiveGrid = false; // Use interactive DOM grid instead of text-only
  var _muzzleFlash = null; // Track muzzle flash {x, y, time}
  var _impactEffects = []; // Track impact effects {x, y, type, time}

  // Performance caches — rebuilt on floor generation, reused every tick
  var _wallCache = []; // Cached wall positions for LightingSystem (avoids 800-iteration scan per tick)
  var _lightMapTickCounter = 0; // Throttle full light-map recalc to every 5 ticks (~500ms)

  // Game loop state
  var _gameLoopActive = false;
  var _lastTickTime = 0;
  var _tickInterval = 100; // ms between ticks (10 ticks per second)
  var _animationFrameId = null;
  var _enemyColorCycleTime = 0;

  // STR Combat state (Simultaneous Turn Resolution)
  var _strCombatActive = false;
  var _strCombatEnemy = null; // Enemy in current STR combat
  var _strCombatAdvantage = 'neutral'; // 'ambush', 'neutral', 'disadvantaged', 'flanked'
  var _strCombatRound = 0;
  var _strCombatLog = []; // Combat log messages
  var _strCombatAmmoSpent = 0; // Track ammo spent in this combat encounter
  var _strCombatContext = null; // Countdown context messages built at combat entry

  // Performance caches
  var _stealthBonusCache = null; // { bonus, px, py } — invalidated when player moves

  // Boss encounter state
  var _activeBoss = null; // Current boss instance (from BossEncounters module)
  var _bossFloorActive = false; // Is this a boss floor
  var _bossDefeated = false; // Has boss been defeated this floor
  var _bossHazards = []; // Boss-specific hazards (trains, drones, etc.)
  var _bossEnvironment = {}; // Boss-specific environment data
  var _playerMoveLocked = false; // Set by Asteroids boss; disables walk commands

  // Secret floor state
  var _activeSecretFloor = null; // Current secret floor type (if any)

  // Difficulty tier system (1 = Standard, 2 = Advanced, 3 = Extreme)
  var _difficultyTier = 1;
  var _stateChangeCallbacks = []; // Callbacks for state changes (used by AWOL button)

  // Vents system state
  var _vents = []; // Vent objects on current floor { x, y, quality, discovered, used }
  var _ventUseCount = 0; // Total vents used this run (affects success rate)
  var _penaltyFloors = []; // Floors marked as penalty (from vent failures)
  var _previousBiome = null; // Track previous floor biome for bleed
  var _nextBiomePreview = null; // Cache next floor's biome for consistent preview
  var _visitedBiomes = []; // Track visited biomes this run

  // Forest biome state
  var _forestBuildings = []; // Village buildings {x, y, emoji} for visual overlay
  var _biomeVisualGrid = null; // Pre-computed visual substitution grid (wall/floor chars)

  // Highscore tracking variables
  var _runStartTime = null;        // Run start timestamp
  var _currencyCollected = 0;      // Total currency collected this run (excludes starting balance)
  var _totalEnemiesSpawned = 0;    // Total enemies that spawned
  var _enemiesKilled = 0;          // Enemies defeated
  var _totalBreakableDamage = 0;   // HP dealt to breakables
  var _totalDamageDealt = 0;       // Total damage player dealt
  var _maxSingleHit = 0;           // Highest single attack damage
  var _damageMitigated = 0;        // Damage avoided/blocked in STR combat
  var _runCompleted = false;       // Whether run reached floor 30
  var _playerDeaths = 0;           // Number of player deaths in this run
  var _lastPickupMessage = null;   // Track last item pickup message for display

  var TILES = {
    EMPTY: '.',
    WALL: '█',
    PLAYER: '🥷',
    ENEMY: '🪖',
    ITEM: '💎',
    EXIT: '🚪',
    COVER: '▓',
    BREAKABLE: '📦',
    DEBRIS: '░',
    PROJECTILE: '💥',
    DOOR: 'D',
    VENT: 'V',
    SHADOW: '░',
    SMOKE: '≈',
    GRASS: ',',
    HAZARD: '▒',
    WATER: '~',
    SHOP: '🏪',
    BLACK_MARKET: '👤'
  };

  // Tile metadata and effects
  var TILE_EFFECTS = {
    SHADOW: { stealthBonus: 30, emoji: '⬛' }, // -30% enemy detection range
    SMOKE: { stealthBonus: 40, movePenalty: 0, emoji: '🌫️' }, // Fog/smoke
    GRASS: { stealthBonus: 20, emoji: '🟩' }, // Grass/vegetation
    HAZARD: { damage: 1, emoji: '🟥' }, // Fire/acid/toxic
    WATER: { movePenalty: 1, emoji: '🟦' }, // Slow movement
    COVER: { blocksLOS: true, emoji: '▓' } // Full cover
  };

  // Map generation config
  var _tileMetadata = {}; // Stores tile-specific data (e.g., which tiles are shadow zones)

  // Enemy awareness states
  var AWARENESS_STATES = {
    UNAWARE: { min: 0, max: 30, color: '#00ff00', name: 'UNAWARE' },
    SUSPICIOUS: { min: 31, max: 70, color: '#ffaa00', name: 'SUSPICIOUS' },
    ALERTED: { min: 71, max: 100, color: '#ff0000', name: 'ALERTED' },
    ENGAGED: { min: 100, max: 999, color: '#ff00ff', name: 'ENGAGED' }
  };

  // Enemy path types
  var PATH_TYPES = {
    PATROL: 'patrol',        // A→B→C→B (reverse on endpoint)
    CIRCULAR: 'circular',    // A→B→C→A (loop)
    ELLIPSE: 'ellipse',      // Elliptical path
    STATIONARY: 'stationary' // Rotate in place
  };

  // Floor types for run structure
  var FLOOR_TYPES = {
    TUTORIAL: 'tutorial',           // Floors 1-2: no enemies, learn movement
    GHOST: 'ghost',                 // Floors 3-4: cameras only, no combat
    STEALTH: 'stealth',             // Floors 5-9: light stealth
    BONFIRE: 'bonfire',             // Floors 10, 16, 22: safe hub with vendor
    COMBAT: 'combat',               // Standard combat floors
    EXPLORATION: 'exploration',     // High loot, few/no enemies
    BOSS: 'boss',                   // Boss encounter floors
    FINAL: 'final'                  // Floor 30: final boss
  };

  // Biome types for environmental variety
  var BIOMES = {
    FOREST: {
      name: 'Cozy Forest',
      wallChar: '🌳',
      floorChar: ',',
      description: 'Welcoming woodland with tall grass',
      floorRange: [1, 3], // Starting biome for new players

      // Wall tile distribution for natural variety
      wallTiles: [
        { char: '🌳', weight: 40 },
        { char: '🌲', weight: 30 },
        { char: '🪵', weight: 15 },
        { char: '🪨', weight: 10 },
        { char: '🌿', weight: 5 }
      ],

      // Floor tile variety - ASCII only (no emoji floors per design rules)
      floorTiles: [
        { char: ',', weight: 50, animated: true },        // Grass (standard) - animated wave
        { char: '`', weight: 25, animated: true },        // Grass variation
        { char: '\'', weight: 15, animated: true },       // Grass variation
        { char: '"', weight: 5, animated: true },         // Dense grass - slower movement
        { char: '·', weight: 5 }                          // Dirt patch - no animation
      ],

      // Expanded props with breakable gates and obstacles
      // Note: 🌿 Bush is now a PROP (breakable) not a floor tile
      props: [
        { emoji: '🚧', name: 'Wooden Gate', breakable: true, hp: 3, blocksPath: true, drops: ['wood', 'coins'] },
        { emoji: '🌳', name: 'Tree Trunk', breakable: true, hp: 4, blocksPath: true, drops: ['wood', 'apples'] },
        { emoji: '🌲', name: 'Tree Canopy', breakable: true, hp: 6, blocksPath: true, drops: ['wood', 'sap'] },
        { emoji: '🌿', name: 'Bush', breakable: true, hp: 2, blocksPath: false, ghostCollision: true, drops: ['berries', 'sticks'] },
        { emoji: '🪵', name: 'Hollow Log', breakable: true, hp: 2, blocksPath: true, drops: ['wood', 'insects'] },
        { emoji: '🪨', name: 'Boulder', breakable: true, hp: 5, blocksPath: true, drops: ['stone', 'gems'] },
        { emoji: '⛰️', name: 'Ridge', breakable: false, blocksPath: true },
        { emoji: '📦', name: 'Wooden Box', breakable: true, hp: 2, blocksPath: true, drops: ['supplies'] },
        { emoji: '🧺', name: 'Picnic Blanket', breakable: false, blocksPath: false, ghostCollision: true, movePenalty: 0.3 }
      ],

      // Interactive objects (non-breakable interactions)
      interactiveObjects: [
        { emoji: '🪧', name: 'Sign Post', interact: 'read', effect: 'shows_direction', blocksPath: true },
        { emoji: '📬', name: 'Mailbox', interact: 'open', effect: 'gives_letter', blocksPath: true },
        { emoji: '🫐', name: 'Berry Bush', interact: 'harvest', effect: 'gives_berries', blocksPath: false, ghostCollision: true },
        { emoji: '🍎', name: 'Apple Tree', interact: 'shake', effect: 'drops_apples', blocksPath: true }
      ],

      // Tile effects for environmental interaction - ASCII only
      tileEffects: {
        ',': { stealth: 20, moveMod: 0.85, name: 'Grass', animated: true },
        '`': { stealth: 20, moveMod: 0.85, name: 'Grass', animated: true },
        '\'': { stealth: 20, moveMod: 0.85, name: 'Grass', animated: true },
        '"': { stealth: 40, moveMod: 0.80, name: 'Dense Grass', animated: true },
        '·': { stealth: 10, moveMod: 0.95, name: 'Dirt Patch' }
      },

      // Village features (no threats)
      spawnFeatures: {
        villageCluster: true,
        buildings: ['🏠', '⛪', '🏪', '🏡'],
        friendlyNPCs: ['👨', '👩', '🧓', '👶'],
        decorations: ['🪧', '📬', '🏮', '⛲', '🪑'],
        landmarks: [
          { emoji: '🏔️', name: 'Mountain Tower', visibility: 15 },
          { emoji: '🌳', name: 'Giant Tree', visibility: 12 },
          { emoji: '🏛️', name: 'Ruin', visibility: 10 }
        ]
      },

      // No real combat threats
      enemies: [],
      enemyDensity: 0.0
    },
    GREY_CAVE: {
      name: 'Grey Cave',
      wallChar: '█',
      floorChar: '.',
      description: 'Dark underground tunnels with water pools',
      floorRange: [4, 4], // Used for floor 4 and secret areas

      // Cave floor tiles with water and hazards
      floorTiles: [
        { char: '.', weight: 60 },                // Stone floor
        { char: '·', weight: 15 },                // Gravel
        { char: '~', weight: 15, animated: true }, // Water pools - slow movement
        { char: '☣', weight: 5, animated: true },  // Toxic waste - damage + slow
        { char: '░', weight: 5 }                   // Debris
      ],

      // Tile effects
      tileEffects: {
        '.': { stealth: 5, moveMod: 1.0, name: 'Stone Floor' },
        '·': { stealth: 10, moveMod: 0.95, name: 'Gravel' },
        '~': { stealth: 0, moveMod: 0.60, name: 'Water', animated: true },
        '≈': { stealth: 0, moveMod: 0.60, name: 'Water', animated: true },
        '☣': { stealth: 0, moveMod: 0.60, damage: 1, name: 'Toxic Waste', animated: true },
        'o': { stealth: 0, moveMod: 0.60, damage: 1, name: 'Toxic', animated: true },
        '°': { stealth: 0, moveMod: 0.60, damage: 1, name: 'Toxic', animated: true },
        '░': { stealth: 5, moveMod: 0.90, name: 'Debris' }
      },

      props: [
        { emoji: '🪨', name: 'Boulder', breakable: true, hp: 2, blocksPath: true },
        { emoji: '💧', name: 'Water Drip', breakable: false, blocksPath: true }
      ]
    },
    OFFICE: {
      name: 'Commercial Office',
      wallChar: '█',
      floorChar: '.',
      description: 'Corporate cubicles and conference rooms',
      floorRange: [5, 9],

      // Floor tile variety for office environments - ASCII only
      floorTiles: [
        { char: '.', weight: 70 },        // Standard floor
        { char: '▬', weight: 20 },        // Walkway - slight speedup
        { char: '·', weight: 10 }         // Concrete
      ],

      // Wall variations for office areas
      wallTiles: [
        { char: '█', weight: 60 },        // Solid wall
        { char: '▓', weight: 20 },        // Cubicle wall (low)
        { char: '🪟', weight: 15 },       // Glass wall (transparent)
        { char: '🚪', weight: 5 }         // Office door
      ],

      // Expanded props with office furniture and equipment
      props: [
        { emoji: '📂', name: 'Filing Cabinet', breakable: true, hp: 2, drops: ['documents', 'items'] },
        { emoji: '🖨️', name: 'Photocopier', breakable: true, hp: 3, drops: ['toner'], explodes: true },
        { emoji: '🪑', name: 'Office Chair', breakable: false, provides: 'cover' },
        { emoji: '💼', name: 'Briefcase', breakable: true, hp: 1, drops: ['papers'] },
        { emoji: '🖥️', name: 'Desk', breakable: true, hp: 3, provides: 'cover', drops: ['supplies'] },
        { emoji: '💧', name: 'Water Cooler', interact: 'drink', healing: 5 },
        { emoji: '🥤', name: 'Vending Machine', breakable: true, hp: 4, drops: ['drinks', 'snacks'] },
        { emoji: '🖥️', name: 'Server Rack', interact: 'hack', effect: 'reveals_map' }
      ],

      // Interactive objects for office exploration
      interactiveObjects: [
        { emoji: '💻', name: 'Terminal', interact: 'hack', effects: ['map_reveal', 'enemy_intel', 'door_unlock', 'transmission'] },
        { emoji: '🚪', name: 'Locked Door', interact: 'unlock', requires: 'keycard' },
        { emoji: '🪟', name: 'Glass Window', transparent: true, blocks: 'projectiles' },
        { emoji: '▓', name: 'Cubicle Cluster', provides: 'cover', slowsMovement: true }
      ],

      // Tile effects for office stealth gameplay - ASCII only
      tileEffects: {
        '.': { stealth: 5, moveMod: 1.0, name: 'Office Floor' },
        '▬': { stealth: 0, moveMod: 1.1, name: 'Walkway' },      // Slight speedup
        '·': { stealth: 10, moveMod: 1.0, name: 'Concrete' }
      },

      // Special office features
      spawnFeatures: {
        unreachableRooms: true,          // Visible through glass
        terminals: 3,                     // Hackable terminals per floor
        lockedDoors: 2,                   // Requires keycards
        coverClusters: true               // Desk arrangements
      }
    },
    MALL: {
      name: 'Shopping Mall',
      wallChar: '█',
      floorChar: '.',
      description: 'Abandoned retail stores',
      floorRange: [11, 15],

      // Floor tile variety for mall environments - ASCII only
      floorTiles: [
        { char: '.', weight: 70 },        // Standard mall floor
        { char: '▬', weight: 20 },        // Walkway
        { char: '·', weight: 10 }         // Tile floor
      ],

      // Expanded props with breakable-rich environment
      props: [
        { emoji: '🛍️', name: 'Shopping Bag', breakable: true, hp: 1, drops: ['random'] },
        { emoji: '🧸', name: 'Toy', breakable: true, hp: 1, drops: ['toys'] },
        { emoji: '🥫', name: 'Canned Food', breakable: true, hp: 1, drops: ['food'] },
        { emoji: '👗', name: 'Clothing Display', breakable: true, hp: 1, drops: ['clothes'] },
        { emoji: '👟', name: 'Shoe Rack', breakable: true, hp: 2, drops: ['shoes', 'coins'] },
        { emoji: '💍', name: 'Jewelry Display', breakable: true, hp: 1, drops: ['gems', 'coins'], rare: true },
        { emoji: '🛒', name: 'Shopping Cart', breakable: true, hp: 2, provides: 'mobile_cover', drops: ['items'] },
        { emoji: '📰', name: 'Magazine Rack', breakable: true, hp: 1, drops: ['hints'] },
        { emoji: '🎁', name: 'Gift Wrap Station', breakable: true, hp: 2, drops: ['wrapped_gifts'], surprise: true }
      ],

      // Interactive objects for mall navigation
      interactiveObjects: [
        { emoji: '🏪', name: 'Storefront', type: 'various', contains: 'multiple_displays' },
        { emoji: '🛍️', name: 'Display Rack', contains: 'breakables' },
        { emoji: '👕', name: 'Clothing Rack', provides: 'concealment' },
        { emoji: '🧍', name: 'Mannequin', decorative: true, sometimes: 'hostile' },
        { emoji: '🪧', name: 'Sign', provides: 'navigation_hints' },
        { emoji: '📋', name: 'Directory', interact: 'read', shows: 'local_map' },
        { emoji: '🔼', name: 'Escalator', vertical: true, bidirectional: true }
      ],

      // Tile effects for mall - ASCII only
      tileEffects: {
        '.': { stealth: 5, moveMod: 1.0, name: 'Mall Floor' },
        '▬': { stealth: 0, moveMod: 1.05, name: 'Walkway' },
        '·': { stealth: 5, moveMod: 1.0, name: 'Tile Floor' }
      },

      // Special mall features
      spawnFeatures: {
        mazeLayout: true,                 // Dead ends and detours
        stores: 8,                        // Store count per floor
        deadEnds: 5,                      // Intentional dead ends
        escapeRoutes: 3,                  // Guaranteed exits
        directories: 2,                   // Navigation aids
        escalators: 2                     // Vertical movement
      }
    },
    INDUSTRIAL: {
      name: 'Industrial Complex',
      wallChar: '█',
      floorChar: '.',
      description: 'Hazardous factory floor',
      floorRange: [17, 21],

      // Floor tile variety with hazards - ASCII only with animations
      floorTiles: [
        { char: '.', weight: 45 },                  // Standard industrial floor
        { char: '·', weight: 15 },                  // Concrete
        { char: '▪', weight: 15 },                  // Metal walkway
        { char: '_', weight: 10, animated: true },  // Oil slick (ignitable, animated)
        { char: '~', weight: 8, animated: true },   // Water (electrifiable)
        { char: '^', weight: 4, animated: true },   // Fire (spreads on oil)
        { char: '░', weight: 3 }                    // Debris/ash
      ],

      // Hazardous environment props
      props: [
        { emoji: '🛢️', name: 'Oil Drum', breakable: true, hp: 2, drops: ['oil'], explodes: 'fire', ignitable: true },
        { emoji: '⚡', name: 'Exposed Wiring', breakable: false, hazard: 'electric' },
        { emoji: '🔥', name: 'Vent Steam', breakable: false, hazard: 'heat', areadenial: true },
        { emoji: '🧪', name: 'Chemical Tank', breakable: true, hp: 3, drops: ['acid'], hazard: 'acid' },
        { emoji: '🛤️', name: 'Pipeline', interact: 'damage', effect: 'releases_steam' },
        { emoji: '🤖', name: 'Robot Wreckage', breakable: true, hp: 4, drops: ['scrap', 'parts'], sometimes: 'hostile' },
        { emoji: '⏩', name: 'Conveyor Belt', interact: 'walk', effect: 'speed_boost', reversible: true }
      ],

      // Interactive hazard objects
      interactiveObjects: [
        { emoji: '🎛️', name: 'Valve', interact: 'turn', effect: 'controls_flow' },
        { emoji: '🎚️', name: 'Control Panel', interact: 'activate', effect: 'activates_deactivates' },
        { emoji: '🔥', name: 'Furnace', interact: 'ignite', effect: 'creates_fire', provides: 'light' }
      ],

      // Tile effects with hazards - ASCII only
      tileEffects: {
        '.': { stealth: 5, moveMod: 1.0, name: 'Industrial Floor' },
        '·': { stealth: 5, moveMod: 1.0, name: 'Concrete' },
        '▪': { stealth: 0, moveMod: 1.0, name: 'Metal Walkway' },
        '_': { stealth: 5, moveMod: 0.70, ignitable: true, name: 'Oil Slick', animated: true },
        '~': { stealth: 0, moveMod: 0.60, electrifiable: true, name: 'Water', animated: true },
        '≈': { stealth: 0, moveMod: 0.60, electrifiable: true, name: 'Water', animated: true },
        '^': { stealth: 0, moveMod: 0.40, damage: 2, spreads: true, name: 'Fire', animated: true },
        '*': { stealth: 0, moveMod: 0.40, damage: 2, spreads: true, name: 'Fire', animated: true },
        '░': { stealth: 5, moveMod: 0.90, name: 'Debris/Ash' }
      },

      // Ignition system properties
      ignitionSystem: {
        enabled: true,
        spreadChance: 0.3,
        burnDuration: 10,
        damagePerTurn: 2,
        lightRadius: 4,
        smokeRadius: 6,
        spreadTargets: ['🛢️', '🪵', '📦']  // What fire spreads to
      },

      // Special industrial features
      spawnFeatures: {
        hazardZones: true,               // Lava/acid hazard areas
        narrowWalkways: true,            // 1-tile wide paths
        ignitionChains: true,            // Oil spill fire spreads
        verticalHazards: true,           // Collapsing tiles
        controlPanels: 3                 // Hackable environmental controls
      }
    },
    AEROSPACE: {
      name: 'Aerospace Museum',
      wallChar: '█',
      floorChar: '.',
      description: 'Vast halls with missile displays',
      floorRange: [23, 30],
      props: [
        { emoji: '🚀', name: 'Rocket Scaffold', breakable: false },
        { emoji: '✈️', name: 'Hanging Plane', breakable: false }
      ]
    }
  };

  // Bonfire floors (safe hubs with vendors)
  var BONFIRE_FLOORS = [10, 16, 22];

  // Boss floors
  var BOSS_FLOORS = [10, 16, 22, 30];

  // Vendor state
  var _vendor = null;
  var _vendorInventory = [];

  // Vendor types with different personalities
  var VENDOR_TYPES = {
    SCRAP_MERCHANT: {
      name: 'Scrap Merchant',
      emoji: '🧑‍💼',
      description: 'Sells cheap junk cards and supplies',
      priceMultiplier: 0.7,
      qualityRange: [30, 70] // Low quality items
    },
    ARMS_DEALER: {
      name: 'Arms Dealer',
      emoji: '🔫',
      description: 'Sells attack cards and explosives',
      priceMultiplier: 1.2,
      qualityRange: [50, 85],
      cardFilter: ['attack']
    },
    GHOST_BROKER: {
      name: 'Ghost Broker',
      emoji: '👻',
      description: 'Sells stealth and silent cards',
      priceMultiplier: 1.5,
      qualityRange: [60, 90],
      cardFilter: ['stealth', 'movement']
    },
    RELIC_SMUGGLER: {
      name: 'Relic Smuggler',
      emoji: '💎',
      description: 'Sells rare charms and inventory expanders',
      priceMultiplier: 2.0,
      qualityRange: [70, 95]
    }
  };

  // ============================================================
  // EXPLORATION FRAMEWORK
  // Core exploration mechanics with discovery tiers and rewards
  // ============================================================

  /**
   * Discovery tier definitions following the visibility spectrum
   */
  var DISCOVERY_TIERS = {
    SURFACE: {
      name: 'Surface',
      frequency: 0.40,
      visibility: 'immediate',
      rewardTypes: ['currency', 'consumable'],
      description: 'Immediately visible, modest rewards'
    },
    SEMI_HIDDEN: {
      name: 'Semi-Hidden',
      frequency: 0.30,
      visibility: 'minimal_investigation',
      rewardTypes: ['cards', 'equipment', 'currency'],
      description: 'Requires minimal investigation'
    },
    CONCEALED: {
      name: 'Concealed',
      frequency: 0.20,
      visibility: 'deliberate_action',
      rewardTypes: ['rare_cards', 'equipment'],
      description: 'Requires deliberate action to uncover'
    },
    HIDDEN: {
      name: 'Hidden',
      frequency: 0.08,
      visibility: 'outside_context',
      rewardTypes: ['legendary_items', 'secrets'],
      description: 'Requires outside-context knowledge'
    },
    META: {
      name: 'Meta',
      frequency: 0.02,
      visibility: 'multi_run',
      rewardTypes: ['narrative', 'achievements'],
      description: 'Multi-run discoveries'
    }
  };

  /**
   * Discovery placement state for current floor
   */
  var _discoveries = []; // { x, y, tier, revealed, contents, type }
  var _metaDiscoveries = []; // Persistent cross-run discoveries

  /**
   * Environmental detail layer system
   */
  var DETAIL_LAYERS = {
    STRUCTURAL: 'structural',    // Walls, floor, doors, major features
    FUNCTIONAL: 'functional',    // Purpose-specific details (desks, displays, equipment)
    NARRATIVE: 'narrative'       // Story-specific details (struggle evidence, personal items)
  };

  var _environmentalDetails = {}; // Stores details by layer

  /**
   * Generate discoveries for current floor based on tier distribution
   */
  function _generateDiscoveries(rooms, biome) {
    _discoveries = [];

    // Calculate total discoveries based on floor size and difficulty
    var totalDiscoveries = Math.floor(rooms.length * 1.5) + Math.floor(_difficultyTier * 0.5);

    for (var i = 0; i < totalDiscoveries; i++) {
      var tier = _selectDiscoveryTier();
      var room = rooms[Math.floor(Math.random() * rooms.length)];
      var pos = _findDiscoveryPosition(room, tier);

      if (pos) {
        _discoveries.push({
          x: pos.x,
          y: pos.y,
          tier: tier,
          revealed: tier.visibility === 'immediate',
          contents: _generateDiscoveryContents(tier, biome),
          type: _selectDiscoveryType(tier, biome),
          interacted: false
        });
      }
    }
  }

  /**
   * Select discovery tier based on frequency distribution
   */
  function _selectDiscoveryTier() {
    var roll = Math.random();
    var cumulative = 0;

    var tiers = [
      DISCOVERY_TIERS.SURFACE,
      DISCOVERY_TIERS.SEMI_HIDDEN,
      DISCOVERY_TIERS.CONCEALED,
      DISCOVERY_TIERS.HIDDEN,
      DISCOVERY_TIERS.META
    ];

    for (var i = 0; i < tiers.length; i++) {
      cumulative += tiers[i].frequency;
      if (roll <= cumulative) {
        return tiers[i];
      }
    }

    return DISCOVERY_TIERS.SURFACE;
  }

  /**
   * Find appropriate position for discovery based on tier
   */
  function _findDiscoveryPosition(room, tier) {
    var attempts = 0;
    var maxAttempts = 20;

    while (attempts < maxAttempts) {
      var x = room.x + Math.floor(Math.random() * room.width);
      var y = room.y + Math.floor(Math.random() * room.height);

      // Check if position is valid (walkable, not occupied)
      if (_grid[y] && _grid[y][x] === TILES.EMPTY) {
        // For concealed/hidden discoveries, prefer corners or edges
        if (tier === DISCOVERY_TIERS.CONCEALED || tier === DISCOVERY_TIERS.HIDDEN) {
          var isEdge = (x === room.x || x === room.x + room.width - 1 ||
                       y === room.y || y === room.y + room.height - 1);
          if (isEdge || attempts > 10) {
            return { x: x, y: y };
          }
        } else {
          return { x: x, y: y };
        }
      }
      attempts++;
    }

    return null;
  }

  /**
   * Generate discovery contents based on tier and biome
   */
  function _generateDiscoveryContents(tier, biome) {
    var contents = {
      currency: 0,
      items: [],
      cards: [],
      narrative: null
    };

    switch (tier) {
      case DISCOVERY_TIERS.SURFACE:
        contents.currency = Math.floor(Math.random() * 20) + 5;
        break;
      case DISCOVERY_TIERS.SEMI_HIDDEN:
        contents.currency = Math.floor(Math.random() * 40) + 15;
        if (Math.random() < 0.3) {
          contents.cards.push('random_card');
        }
        break;
      case DISCOVERY_TIERS.CONCEALED:
        contents.currency = Math.floor(Math.random() * 80) + 30;
        if (Math.random() < 0.5) {
          contents.cards.push('rare_card');
        }
        break;
      case DISCOVERY_TIERS.HIDDEN:
        contents.currency = Math.floor(Math.random() * 150) + 50;
        contents.cards.push('legendary_card');
        break;
      case DISCOVERY_TIERS.META:
        contents.narrative = _generateMetaNarrative(biome);
        break;
    }

    return contents;
  }

  /**
   * Select discovery type based on tier and biome
   */
  function _selectDiscoveryType(tier, biome) {
    var types = {
      SURFACE: ['breakable_container', 'visible_treasure', 'obvious_crate'],
      SEMI_HIDDEN: ['locked_door', 'debris_pile', 'dark_corner'],
      CONCEALED: ['fake_wall', 'terminal_secret', 'breakable_pattern'],
      HIDDEN: ['puzzle_solution', 'secret_room', 'environmental_hint'],
      META: ['lore_fragment', 'achievement_unlock', 'cross_run_hint']
    };

    var tierTypes = types[tier.name.toUpperCase().replace('-', '_')];
    if (tierTypes && tierTypes.length > 0) {
      return tierTypes[Math.floor(Math.random() * tierTypes.length)];
    }

    return 'breakable_container';
  }

  /**
   * Generate meta-narrative content for cross-run discoveries
   */
  function _generateMetaNarrative(biome) {
    var narratives = [
      'You notice a pattern in the wall structure...',
      'A faded message hints at something deeper...',
      'The environment suggests a hidden connection...',
      'Something about this place feels familiar...'
    ];

    return narratives[Math.floor(Math.random() * narratives.length)];
  }

  /**
   * Initialize environmental detail layers for a room
   */
  function _initializeEnvironmentalDetails(room, biome) {
    var roomKey = room.x + '_' + room.y;

    _environmentalDetails[roomKey] = {
      structural: _generateStructuralLayer(room, biome),
      functional: _generateFunctionalLayer(room, biome),
      narrative: _generateNarrativeLayer(room, biome)
    };
  }

  /**
   * Generate structural layer details (always present)
   */
  function _generateStructuralLayer(room, biome) {
    return {
      walls: true,
      floor: true,
      ceiling: true,
      doors: room.doors || [],
      majorFeatures: []
    };
  }

  /**
   * Generate functional layer details (purpose-specific)
   */
  function _generateFunctionalLayer(room, biome) {
    var functional = {
      furniture: [],
      equipment: [],
      storage: []
    };

    // Biome-specific functional details
    if (biome === BIOMES.OFFICE) {
      functional.furniture = ['desks', 'chairs', 'cubicles'];
      functional.equipment = ['terminals', 'printers', 'phones'];
    } else if (biome === BIOMES.MALL) {
      functional.furniture = ['displays', 'racks', 'counters'];
      functional.equipment = ['registers', 'mannequins'];
    } else if (biome === BIOMES.INDUSTRIAL) {
      functional.equipment = ['machinery', 'conveyors', 'pipes'];
    }

    return functional;
  }

  /**
   * Generate narrative layer details (story-specific)
   */
  function _generateNarrativeLayer(room, biome) {
    var narrative = {
      evidence: [],
      personalItems: [],
      environmentalChanges: []
    };

    // Random chance for narrative elements
    if (Math.random() < 0.3) {
      narrative.evidence.push('struggle_marks');
    }
    if (Math.random() < 0.2) {
      narrative.personalItems.push('abandoned_photo');
    }
    if (Math.random() < 0.25) {
      narrative.environmentalChanges.push('water_damage');
    }

    return narrative;
  }

  /**
   * Reveal discovery when player interacts with it
   */
  function _revealDiscovery(x, y) {
    for (var i = 0; i < _discoveries.length; i++) {
      var discovery = _discoveries[i];
      if (discovery.x === x && discovery.y === y && !discovery.revealed) {
        discovery.revealed = true;
        discovery.interacted = true;
        _grantDiscoveryRewards(discovery);
        return true;
      }
    }
    return false;
  }

  /**
   * Grant rewards from discovered content
   */
  function _grantDiscoveryRewards(discovery) {
    var contents = discovery.contents;

    if (contents.currency > 0) {
      _spawnCurrency(discovery.x, discovery.y, contents.currency);
    }

    if (contents.cards && contents.cards.length > 0) {
      // Spawn card items at discovery location
      for (var i = 0; i < contents.cards.length; i++) {
        _spawnDiscoveryCard(discovery.x, discovery.y);
      }
    }

    if (contents.narrative) {
      _displayNarrative(contents.narrative);
    }
  }

  /**
   * Spawn a card from discovery
   */
  function _spawnDiscoveryCard(x, y) {
    // Integrate with existing item spawning system
    var offset = _items.length % 2 === 0 ? 1 : -1;
    var spawnX = Math.max(1, Math.min(GRID_WIDTH - 2, x + offset));
    _items.push({ x: spawnX, y: y, quality: Math.random() });
  }

  /**
   * Display narrative message to player
   */
  function _displayNarrative(narrative) {
    if (typeof Terminal !== 'undefined' && Terminal.print) {
      Terminal.print(narrative, 'narrative');
    }
  }

  // ============================================================
  // END EXPLORATION FRAMEWORK
  // ============================================================

  /**
   * Determine floor type based on floor number
   */
  function _getFloorType(floorNum) {
    if (floorNum <= 2) return FLOOR_TYPES.TUTORIAL;
    if (floorNum <= 4) return FLOOR_TYPES.GHOST;
    if (BONFIRE_FLOORS.indexOf(floorNum) !== -1) return FLOOR_TYPES.BONFIRE;
    if (floorNum === 30) return FLOOR_TYPES.FINAL;
    if (BOSS_FLOORS.indexOf(floorNum) !== -1) return FLOOR_TYPES.BOSS;

    // Random exploration floors (5% chance on floors 15+)
    if (floorNum >= 15 && Math.random() < 0.05) return FLOOR_TYPES.EXPLORATION;

    // Light stealth early
    if (floorNum <= 9) return FLOOR_TYPES.STEALTH;

    // Standard combat floors
    return FLOOR_TYPES.COMBAT;
  }

  /**
   * Determine biome based on floor number
   */
  /**
   * Get biome for floor using weighted random selection (floor shuffling)
   * Floors 1-3 are always Forest for new player experience
   * Other floors use weighted probabilities based on depth
   */
  function _getBiome(floorNum) {
    // Floors 1-3: Always Forest (tutorial/starting experience)
    if (floorNum <= 3) return BIOMES.FOREST;
    
    // Floor 4: Special Grey Cave floor
    if (floorNum === 4) return BIOMES.GREY_CAVE;
    
    // Boss floors: Use boss-appropriate biomes (Aerospace for high floors)
    if (BOSS_FLOORS.indexOf(floorNum) !== -1 && floorNum >= 23) {
      return BIOMES.AEROSPACE;
    }
    
    // Weighted biome selection based on floor depth
    var weights = {};
    
    if (floorNum >= 5 && floorNum <= 6) {
      // Early game: Forest dominant
      weights = {
        FOREST: 60,
        MALL: 20,
        INDUSTRIAL: 15,
        GREY_CAVE: 5
      };
    } else if (floorNum >= 7 && floorNum <= 9) {
      // Mid-early game: Mall becomes common
      weights = {
        FOREST: 25,
        MALL: 35,
        INDUSTRIAL: 30,
        GREY_CAVE: 10
      };
    } else if (floorNum >= 10 && floorNum <= 15) {
      // Mid game: Industrial rises
      weights = {
        FOREST: 10,
        MALL: 25,
        INDUSTRIAL: 40,
        GREY_CAVE: 15,
        AEROSPACE: 10
      };
    } else if (floorNum >= 16 && floorNum <= 22) {
      // Late game: Mix with Aerospace
      weights = {
        FOREST: 5,
        MALL: 20,
        INDUSTRIAL: 35,
        GREY_CAVE: 10,
        AEROSPACE: 30
      };
    } else {
      // Endgame: Aerospace dominant
      weights = {
        MALL: 10,
        INDUSTRIAL: 20,
        AEROSPACE: 70
      };
    }
    
    // Calculate total weight
    var totalWeight = 0;
    for (var key in weights) {
      totalWeight += weights[key];
    }
    
    // Select random biome based on weights
    var rand = Math.random() * totalWeight;
    var cumulative = 0;
    
    for (var biomeKey in weights) {
      cumulative += weights[biomeKey];
      if (rand <= cumulative) {
        return BIOMES[biomeKey];
      }
    }
    
    // Fallback (should never happen)
    return BIOMES.OFFICE;
  }

  function init() {
    _loadState();

    // Enable interactive grid UI for all platforms (desktop and mobile)
    _useInteractiveGrid = (typeof GoneRogueMobile !== 'undefined');

    // Initialize interactive grid UI if available
    if (_useInteractiveGrid) {
      GoneRogueMobile.init();
    }

    return Promise.resolve();
  }

  /**
   * Detect if running on mobile device
   */
  function _isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
  }

  function isActive() {
    return _active;
  }

  function getPrompt() {
    return 'ROGUE> ';
  }

  /**
   * Start Gone Rogue mode
   */
  function start(context) {
    _active = true;
    _loaded = true;

    // Disable scanlines for performance during gameplay
    document.body.classList.add('gone-rogue-active');

    // Initialize highscore tracking
    _runStartTime = Date.now();
    _currencyCollected = 0;
    _totalEnemiesSpawned = 0;
    _enemiesKilled = 0;
    _totalBreakableDamage = 0;
    _totalDamageDealt = 0;
    _maxSingleHit = 0;
    _damageMitigated = 0;
    _runCompleted = false;
    _playerDeaths = 0;

    // Initialize death handler if available
    if (typeof DeathHandler !== 'undefined') {
      DeathHandler.resetStats();
    }

    // Initialize lighting system if available
    if (typeof LightingSystem !== 'undefined') {
      LightingSystem.init();
      console.log('[GoneRogue] Lighting system initialized');
    }

    // Initialize secret floors system if available
    if (typeof SecretFloors !== 'undefined') {
      SecretFloors.init();
      console.log('[GoneRogue] Secret floors system initialized');
    }

    // Initialize ground effects system if available
    if (typeof GroundEffects !== 'undefined') {
      GroundEffects.init();
      console.log('[GoneRogue] Ground effects system initialized');
    }

    // Initialize overhead animator
    if (typeof OverheadAnimator !== 'undefined') {
      OverheadAnimator.init();
      console.log('[GoneRogue] Overhead animator initialized');
    }

    // Initialize tooltip thumb system
    if (typeof TooltipThumb !== 'undefined') {
      var canvasOverlay = document.getElementById('gone-rogue-canvas');
      TooltipThumb.init(canvasOverlay || document.body);
      console.log('[GoneRogue] Tooltip thumb initialized');
    }

    // Initialize interactive items
    if (typeof InteractiveItems !== 'undefined') {
      InteractiveItems.init();
      console.log('[GoneRogue] Interactive items initialized');
    }

    // Initialize item spawner
    if (typeof ItemSpawner !== 'undefined') {
      ItemSpawner.init();
      console.log('[GoneRogue] Item spawner initialized');
    }

    // Initialize environmental synergy
    if (typeof EnvironmentalSynergy !== 'undefined') {
      EnvironmentalSynergy.init();
      console.log('[GoneRogue] Environmental synergy initialized');
    }

    // Initialize environmental drag-drop
    if (typeof EnvironmentalDragDrop !== 'undefined') {
      EnvironmentalDragDrop.init();
      console.log('[GoneRogue] Environmental drag-drop initialized');
    }

    // Initialize food database
    if (typeof FoodDatabase !== 'undefined') {
      FoodDatabase.init();
      console.log('[GoneRogue] Food database initialized');
    }

    // Initialize from GAMESTATE if available
    var lines = [];
    if (typeof GAMESTATE !== 'undefined') {
      var result = GAMESTATE.enterRogueMode(context);
      lines = result.lines || [];

      // Apply charm bonuses to player stats (charms work from inventory)
      var persistent = GAMESTATE.getPersistentInventory();
      var loose = GAMESTATE.getLooseInventory();
      var allItems = persistent.concat(loose);

      var hpBonus = 0;
      var energyBonus = 0;

      allItems.forEach(function(item) {
        if (item && item.category === 'charm' && item.stats) {
          if (item.stats.hp) hpBonus += item.stats.hp;
          if (item.stats.energy) energyBonus += item.stats.energy;
        }
      });

      // Apply bonuses to max HP and energy
      if (hpBonus > 0) {
        _player.maxHp += hpBonus;
        _player.hp += hpBonus; // Also heal
      }
      if (energyBonus > 0) {
        _player.maxEnergy += energyBonus;
        _player.energy += energyBonus; // Also restore
      }

      // Give guaranteed 3 starter cards if player has 0 cards (at game start, not floor transition)
      if (typeof CardSystem !== 'undefined') {
        var looseInventory = GAMESTATE.getLooseInventory();
        if (looseInventory.length === 0) {
          // Define guaranteed 3 starter cards (includes 1 consumable grenade)
          var starterCards = ['Single Shot', 'Dodge', 'Grenade'];

          // Add the 3 starter cards to loose inventory
          for (var c = 0; c < starterCards.length; c++) {
            var card = CardSystem.rollCard(starterCards[c]);
            if (card) {
              GAMESTATE.addToLoose(card);
            }
          }

          lines.push('');
          lines.push('  📦 STARTER LOADOUT DEPLOYED');
          lines.push('  3 COMBAT CARDS ADDED TO INVENTORY');
          lines.push('  🎯 Single Shot | 💨 Dodge | 💣 Grenade (1x use)');
          lines.push('');
        }
      }
    } else {
      lines = ['', 'GONE ROGUE MODE ACTIVATED', ''];
    }

    // Generate initial floor
    _generateFloor();

    // Start game loop
    _startGameLoop();

    // Use mobile UI if available
    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      GoneRogueMobile.show();
      _updateMobileGrid();

      // Show reserve card slots
      if (typeof ReserveSlots !== 'undefined') {
        ReserveSlots.show();
        _updateReserveSlots();
      }

      // Suppress mobile keyboard when interactive grid is active
      if (typeof Terminal !== 'undefined' && typeof Terminal.suppressMobileKeyboard === 'function') {
        Terminal.suppressMobileKeyboard();
      }

      // Hide input line since grid is the input mechanism
      if (typeof Terminal !== 'undefined' && typeof Terminal.hideInput === 'function') {
        Terminal.hideInput();
      }

      // Switch debrief feed to resource display for Gone Rogue
      if (typeof DebriefFeedController !== 'undefined') {
        DebriefFeedController.setMode('goneRogue');
      }

      return {
        lines: lines,
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Switch debrief feed to resource display for Gone Rogue
    if (typeof DebriefFeedController !== 'undefined') {
      DebriefFeedController.setMode('goneRogue');
    }

    return {
      lines: lines.concat(_renderGrid()),
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Process player command
   */
  function process(raw) {
    if (!_active) return { lines: ['ROGUE MODE INACTIVE', ''], stayActive: false };

    var cmd = (raw || '').trim().toLowerCase();

    if (!cmd) {
      return { lines: [''], prompt: getPrompt(), stayActive: true };
    }

    // AGENT commands - check for agent control
    if (cmd.indexOf('agent') === 0) {
      return _handleAgentCommand(cmd);
    }

    // FLEE command during STR combat
    if (cmd === 'flee' && _strCombatActive) {
      // Tooltip: Fleeing combat
      if (typeof TooltipSystem !== 'undefined') {
        TooltipSystem.showAction('flee');
      }
      return _exitStrCombat('fled');
    }

    if (cmd === 'exit' || cmd === 'quit') {
      return _exitRogue(false);
    }

    if (cmd === 'help') {
      return { lines: _helpLines(), prompt: getPrompt(), stayActive: true };
    }

    if (cmd === 'status' || cmd === 'stats') {
      return { lines: _statusLines(), prompt: getPrompt(), stayActive: true };
    }

    if (cmd === 'inventory' || cmd === 'inv') {
      return { lines: _inventoryLines(), prompt: getPrompt(), stayActive: true };
    }

    if (cmd.indexOf('shoot') === 0 || cmd.indexOf('fire') === 0) {
      return _fireProjectile(cmd);
    }

    if (cmd.indexOf('kick') === 0 || cmd.indexOf('boot') === 0) {
      return _kickBreakable(cmd);
    }

    // Movement commands
    if (cmd === 'n' || cmd === 'north' || cmd === 'w') {
      return _movePlayer(0, -1);
    }
    if (cmd === 's' || cmd === 'south' || cmd === 'x') {
      return _movePlayer(0, 1);
    }
    if (cmd === 'e' || cmd === 'east' || cmd === 'd') {
      return _movePlayer(1, 0);
    }
    if (cmd === 'west' || cmd === 'a') {
      return _movePlayer(-1, 0);
    }

    // Action commands
    if (cmd === 'take' || cmd === 'pickup' || cmd === 'get') {
      return _pickupItem();
    }

    if (cmd === 'extract') {
      return _attemptExtract();
    }

    // Interactive item commands
    if (cmd === 'interact' || cmd === 'examine' || cmd === 'read') {
      return _handleInteraction();
    }

    // Bonfire vendor commands
    if (cmd === 'vendor' || cmd === 'shop' || cmd === 'merchant') {
      return _showVendor();
    }

    if (cmd.indexOf('buy') === 0) {
      return _buyFromVendor(cmd);
    }

    if (cmd === 'heal') {
      return _healAtBonfire();
    }

    if (cmd.indexOf('gamble') === 0) {
      return _gambleCard();
    }

    // Inventory transfer commands (bonfire only)
    if (cmd.indexOf('stash') === 0) {
      return _stashCard(cmd);
    }

    if (cmd.indexOf('retrieve') === 0 || cmd.indexOf('withdraw') === 0) {
      return _retrieveCard(cmd);
    }

    // Equip item to active slot
    if (cmd.indexOf('equip') === 0) {
      return _equipItem(cmd);
    }

    // Unequip active item
    if (cmd === 'unequip') {
      return _unequipItem();
    }

    return {
      lines: ['UNKNOWN COMMAND: ' + cmd, 'TYPE HELP FOR COMMANDS', ''],
      prompt: getPrompt(),
      stayActive: true
    };
  }

  function _helpLines() {
    return [
      '',
      'GONE ROGUE COMMANDS:',
      '  N/S/E/W (or WASD)  - Move',
      '  SHOOT <dir>        - Fire projectile (ascii/emoji)',
      '  KICK <dir>         - Boot adjacent breakable',
      '  TAKE/PICKUP        - Pick up item',
      '  EXTRACT            - Extract from exit point',
      '  STATUS             - Show player stats',
      '  INVENTORY          - Show inventory',
      '',
      'BONFIRE COMMANDS (Floors 10, 16, 22):',
      '  VENDOR/SHOP        - View vendor inventory',
      '  BUY <number>       - Purchase item from vendor',
      '  HEAL               - Restore HP for ¢30',
      '  GAMBLE             - Roll random card for ¢100',
      '  STASH <number>     - Move loose item to persistent storage',
      '  RETRIEVE <number>  - Move persistent item to loose carry',
      '  EQUIP <number>     - Equip persistent item to active slot',
      '  UNEQUIP            - Unequip active item',
      '',
      '  HELP               - This help',
      '  EXIT               - Return to Street Chronicles',
      '',
      'LEGEND:',
      '  🥷 = You        🪖 = Enemy      💎 = Item',
      '  🚪 = Exit       █ = Wall       ▓ = Cover',
      '  ░ = Shadow     , = Grass      ≈ = Smoke',
      '  ▒ = Hazard     📦 = Breakable',
      '',
      'TERRAIN EFFECTS:',
      '  Shadow/Grass/Smoke = Stealth bonus',
      '  Hazard = Damage on contact',
      '  Cover = Blocks enemy vision',
      ''
    ];
  }

  function _statusLines() {
    return [
      '',
      'PLAYER STATUS:',
      '  HP: ' + _player.hp + '/' + _player.maxHp,
      '  Energy: ' + _player.energy + '/' + _player.maxEnergy,
      '  Stealth: ' + _player.stealth,
      '  Detection: ' + _player.detection,
      '  Floor: ' + _floor,
      '  Turn: ' + _turn,
      ''
    ];
  }

  function _inventoryLines() {
    var lines = ['', 'INVENTORY:'];

    if (typeof GAMESTATE !== 'undefined') {
      var persistent = GAMESTATE.getPersistentInventory();
      var loose = GAMESTATE.getLooseInventory();
      var activeItem = GAMESTATE.getActiveItem();

      // Show active item slot
      lines.push('');
      lines.push('ACTIVE SLOT:');
      if (activeItem) {
        lines.push('  ⚡ ' + activeItem.emoji + ' ' + activeItem.name + ' [EQUIPPED]');
      } else {
        lines.push('  [EMPTY - Use EQUIP command]');
      }

      lines.push('');
      lines.push('PERSISTENT (' + persistent.length + '/' + GAMESTATE.getState().persistentSlots + '):');
      if (persistent.length) {
        persistent.forEach(function(item, i) {
          lines.push('  ' + (i+1) + '. ' + item.emoji + ' ' + item.name + ' [' + item.qualityName + ']');
        });
      } else {
        lines.push('  [EMPTY]');
      }

      lines.push('');
      lines.push('LOOSE CARRY (' + loose.length + '/' + GAMESTATE.getState().looseSlots + '):');
      if (loose.length) {
        loose.forEach(function(item, i) {
          lines.push('  ' + (i+1) + '. ' + item.emoji + ' ' + item.name + ' [' + item.qualityName + ']');
        });
      } else {
        lines.push('  [EMPTY]');
      }
    }

    lines.push('');
    return lines;
  }

  // ============================================================
  // DIFFICULTY TIER HELPER FUNCTIONS
  // ============================================================

  /**
   * Get difficulty multiplier based on current tier
   * @returns {number} Multiplier for enemy stats/count
   */
  function _getDifficultyMultiplier() {
    switch (_difficultyTier) {
      case 1: return 1.0;    // Standard
      case 2: return 1.3;    // Advanced (+30% enemies, stats)
      case 3: return 1.6;    // Extreme (+60% enemies, stats)
      default: return 1.0;
    }
  }

  /**
   * Notify all state change listeners
   */
  function _notifyStateChange() {
    _stateChangeCallbacks.forEach(function(cb) {
      try {
        cb();
      } catch (e) {
        console.warn('[GoneRogue] State change callback error:', e);
      }
    });
  }

  // ============================================================
  // FLOOR GENERATION
  // ============================================================

  /**
   * Pick a character from a weighted tiles array.
   * Returns a char chosen by weighted random selection.
   */
  function _pickWeightedChar(tiles) {
    var total = 0;
    for (var i = 0; i < tiles.length; i++) {
      total += tiles[i].weight;
    }
    var rand = Math.random() * total;
    var cumulative = 0;
    for (var j = 0; j < tiles.length; j++) {
      cumulative += tiles[j].weight;
      if (rand < cumulative) {
        return tiles[j].char;
      }
    }
    return tiles[tiles.length - 1].char;
  }

  /**
   * Build the biome visual grid: pre-compute wall/floor char substitutions
   * so the display is stable across render calls (no flickering).
   * Stores result in _biomeVisualGrid.
   */
  function _buildBiomeVisualGrid(biome) {
    if (!biome || (!biome.wallTiles && !biome.floorTiles)) {
      _biomeVisualGrid = null;
      return;
    }
    _biomeVisualGrid = [];
    for (var y = 0; y < GRID_HEIGHT; y++) {
      var row = [];
      for (var x = 0; x < GRID_WIDTH; x++) {
        var tile = _grid[y][x];
        if (tile === TILES.WALL && biome.wallTiles) {
          row.push(_pickWeightedChar(biome.wallTiles));
        } else if ((tile === TILES.EMPTY || tile === TILES.GRASS) && biome.floorTiles) {
          row.push(_pickWeightedChar(biome.floorTiles));
        } else {
          row.push(tile);
        }
      }
      _biomeVisualGrid.push(row);
    }
    // Overlay village buildings on the visual grid
    _forestBuildings.forEach(function(b) {
      if (b.y >= 0 && b.y < GRID_HEIGHT && b.x >= 0 && b.x < GRID_WIDTH) {
        _biomeVisualGrid[b.y][b.x] = b.emoji;
      }
    });
  }

  /**
   * Create hard, nearly square perimeters with natural wall tile distribution.
   * (Exported API function per spec — operates on an external map array.)
   */
  function createBordersForest(map, biome) {
    var width = map[0].length;
    var height = map.length;
    var wallTiles = biome.wallTiles || [{ char: biome.wallChar || TILES.WALL, weight: 100 }];

    for (var x = 0; x < width; x++) {
      map[0][x] = _pickWeightedChar(wallTiles);
      map[height - 1][x] = _pickWeightedChar(wallTiles);
    }
    for (var y = 0; y < height; y++) {
      map[y][0] = _pickWeightedChar(wallTiles);
      map[y][width - 1] = _pickWeightedChar(wallTiles);
    }
    return map;
  }

  /**
   * Fill map interior with weighted floor tiles (70-80% walkable open space).
   * (Exported API function per spec — operates on an external map array.)
   */
  function generateForestOpenSpace(map, biome) {
    var width = map[0].length;
    var height = map.length;
    var floorTiles = biome.floorTiles || [{ char: biome.floorChar || TILES.EMPTY, weight: 100 }];
    // 80% open floor per spec (https://github.com/humiliati/EyesOnly/issues/47)
    var openSpaceRatio = 0.8;

    for (var y = 1; y < height - 1; y++) {
      for (var x = 1; x < width - 1; x++) {
        if (Math.random() < openSpaceRatio) {
          map[y][x] = _pickWeightedChar(floorTiles);
        }
      }
    }
    return map;
  }

  /**
   * Place a village cluster (buildings + decorations) in the lower-left quadrant.
   * (Exported API function per spec — operates on an external map array.)
   */
  function placeVillageCluster(map, biome) {
    if (!biome.spawnFeatures || !biome.spawnFeatures.villageCluster) return map;
    var width = map[0].length;
    var height = map.length;

    var villageX = Math.floor(width * 0.2) + Math.floor(Math.random() * 5);
    var villageY = Math.floor(height * 0.6) + Math.floor(Math.random() * 5);

    var buildings = biome.spawnFeatures.buildings;
    var positions = [
      [villageX, villageY],
      [villageX + 3, villageY],
      [villageX, villageY + 3],
      [villageX + 3, villageY + 3]
    ];

    positions.forEach(function(pos, i) {
      if (i < buildings.length && pos[1] < height - 1 && pos[0] < width - 1) {
        map[pos[1]][pos[0]] = buildings[i];
      }
    });

    var decorations = biome.spawnFeatures.decorations;
    for (var d = 0; d < 5; d++) {
      var dx = villageX + Math.floor(Math.random() * 7);
      var dy = villageY + Math.floor(Math.random() * 7);
      if (dx < width - 1 && dy < height - 1) {
        map[dy][dx] = decorations[Math.floor(Math.random() * decorations.length)];
      }
    }
    return map;
  }

  /**
   * Internal: place village cluster on _grid, recording buildings in _forestBuildings
   * so they can be visually overlaid during rendering.
   * Buildings are stored as TILES.WALL in the logical grid for collision.
   */
  function _placeVillageCluster(biome) {
    if (!biome.spawnFeatures || !biome.spawnFeatures.villageCluster) return;

    var villageX = Math.floor(GRID_WIDTH * 0.2) + Math.floor(Math.random() * 5);
    var villageY = Math.floor(GRID_HEIGHT * 0.6) + Math.floor(Math.random() * 5);

    var buildings = biome.spawnFeatures.buildings;
    var positions = [
      [villageX, villageY],
      [villageX + 3, villageY],
      [villageX, villageY + 3],
      [villageX + 3, villageY + 3]
    ];

    positions.forEach(function(pos, i) {
      if (i < buildings.length) {
        var bx = pos[0];
        var by = pos[1];
        if (bx >= 1 && bx < GRID_WIDTH - 1 && by >= 1 && by < GRID_HEIGHT - 1) {
          _grid[by][bx] = TILES.WALL; // Impassable in game logic
          _forestBuildings.push({ x: bx, y: by, emoji: buildings[i] });
        }
      }
    });

    var decorations = biome.spawnFeatures.decorations;
    for (var d = 0; d < 5; d++) {
      var dx = villageX + Math.floor(Math.random() * 7);
      var dy = villageY + Math.floor(Math.random() * 7);
      if (dx >= 1 && dx < GRID_WIDTH - 1 && dy >= 1 && dy < GRID_HEIGHT - 1 &&
          _grid[dy][dx] === TILES.EMPTY) {
        // Decorations are visual-only (walkable), stored just for rendering overlay
        _forestBuildings.push({ x: dx, y: dy, emoji: decorations[Math.floor(Math.random() * decorations.length)] });
      }
    }
  }

  function _generateFloor(secretFloorData) {
    // Initialize generation state
    _projectiles = [];
    _breakables = [];
    _items = [];
    _enemies = [];
    _shops = [];
    _tileMetadata = {};
    _activeBoss = null;
    _bossFloorActive = false;
    _bossDefeated = false;
    _bossHazards = [];
    _bossEnvironment = {};
    _playerMoveLocked = false;

    // Reset forest biome state
    _forestBuildings = [];
    _biomeVisualGrid = null;

    // Invalidate per-floor caches
    _stealthBonusCache = null;
    _activeSecretFloor = null;

    // Clear environmental synergy state
    if (typeof EnvironmentalSynergy !== 'undefined') {
      EnvironmentalSynergy.clearGates();
    }

    // Determine floor type
    var floorType;
    var isSecretFloor = !!secretFloorData;

    if (isSecretFloor) {
      // Set active secret floor
      _activeSecretFloor = secretFloorData.type;

      // Secret floors use special type based on secret floor data
      if (secretFloorData.type === SecretFloors.SECRET_FLOOR_TYPES.UBER_MEGA) {
        floorType = FLOOR_TYPES.BOSS; // Uber Mega is boss-like
      } else if (secretFloorData.type === SecretFloors.SECRET_FLOOR_TYPES.GOBLIN_VAULT) {
        floorType = FLOOR_TYPES.EXPLORATION; // Goblin vault is maze-like
      } else if (secretFloorData.type === SecretFloors.SECRET_FLOOR_TYPES.GRAY_CAVE_HIDDEN) {
        floorType = FLOOR_TYPES.EXPLORATION; // Gray cave is safe exploration
      }
    } else {
      floorType = _getFloorType(_floor);
    }

    // Check if this is a boss floor (or secret boss floor)
    if (floorType === FLOOR_TYPES.BOSS && typeof BossEncounters !== 'undefined') {
      _bossFloorActive = true;

      // Spawn hidden boss for secret floors
      if (isSecretFloor) {
        if (secretFloorData.type === SecretFloors.SECRET_FLOOR_TYPES.UBER_MEGA) {
          _activeBoss = new BossEncounters.UberMegaBoss(_floor);
        } else if (secretFloorData.type === SecretFloors.SECRET_FLOOR_TYPES.GOBLIN_VAULT) {
          _activeBoss = new BossEncounters.TreasureGoblinKingBoss(_floor);
        }
      } else {
        // Normal boss for regular boss floors
        _activeBoss = BossEncounters.createBossForFloor(_floor);
      }
    }

    var maxAttempts = 10;
    var attempt = 0;
    var validMap = false;
    var exitX, exitY; // Store exit location for tutorial gate placement

    // Try to generate a valid map (with stealth path validation)
    while (!validMap && attempt < maxAttempts) {
      attempt++;

      // Step 1: Create empty grid
      _grid = _createEmptyGrid();

      // Step 2: Generate rooms (varies by floor type)
      var rooms = _generateRooms(floorType);

      // Step 3: Connect rooms with corridors
      _connectRooms(rooms);

      // Step 4: Add branch connections for loops
      _addBranchConnections(rooms);

      // Step 5: Place cover
      _placeCover();

      // Step 6: Place shadow zones
      _placeShadowZones();

      // Step 7: Place environmental tiles
      _placeEnvironmentalTiles();

      // Step 8: Place player and exit
      var spawnData = _placePlayerAndExit(rooms);
      _player.x = spawnData.playerX;
      _player.y = spawnData.playerY;
      exitX = spawnData.exitX;
      exitY = spawnData.exitY;

      // Step 9: Place enemies (based on floor type)
      _placeEnemies(rooms, floorType);

      // Step 9b: Initialize boss if this is a boss floor
      if (_bossFloorActive && _activeBoss) {
        var bossInit = _activeBoss.initialize(_grid, _player);
        if (bossInit.success) {
          _bossEnvironment = bossInit;
          // Boss floor skips normal stealth validation
          validMap = true;
        }
      } else {
        // Step 10: Validate stealth path (non-boss floors only)
        validMap = _validateStealthPath(_player.x, _player.y, exitX, exitY);
      }

      if (!validMap && attempt < maxAttempts) {
        console.log('Map validation failed, regenerating... (attempt ' + attempt + ')');
      }
    }

    if (!validMap) {
      console.warn('Could not generate fully valid map after ' + maxAttempts + ' attempts. Using current map.');
    }

    // Forest biome: place village cluster and pre-compute visual grid
    if (!isSecretFloor) {
      var floorBiome = _getBiome(_floor);
      if (floorBiome.spawnFeatures && floorBiome.spawnFeatures.villageCluster) {
        _placeVillageCluster(floorBiome);
      }
      _buildBiomeVisualGrid(floorBiome);

      // Generate discoveries and environmental details for exploration framework
      _generateDiscoveries(rooms, floorBiome);
      for (var i = 0; i < rooms.length; i++) {
        _initializeEnvironmentalDetails(rooms[i], floorBiome);
      }
    }

    // Place breakables (deterministic for tests)
    _spawnBreakables();

    // Tutorial floors: Place guaranteed gate with tutorial pickups
    if (floorType === FLOOR_TYPES.TUTORIAL) {
      _placeTutorialGate(exitX, exitY);
    }

    // Place items (increased loot for exploration floors)
    _placeItems(floorType);

    // Step 13: Spawn interactive items
    if (typeof ItemSpawner !== 'undefined' && typeof InteractiveItems !== 'undefined') {
      var spawnedItems = ItemSpawner.spawnItemsForFloor(_floor, rooms, _grid);
      spawnedItems.forEach(function(item) {
        InteractiveItems.addItem(item);
      });
      console.log('[GoneRogue] Spawned', spawnedItems.length, 'interactive items');
    }

    // Generate lighting for this floor
    if (typeof LightingSystem !== 'undefined') {
      // Set biome for lighting
      var biome;
      var biomeName;

      if (isSecretFloor) {
        // Secret floors have special biomes
        if (secretFloorData.type === SecretFloors.SECRET_FLOOR_TYPES.UBER_MEGA) {
          biomeName = 'UBER_MEGA'; // Reality-breaking dark
        } else if (secretFloorData.type === SecretFloors.SECRET_FLOOR_TYPES.GOBLIN_VAULT) {
          biomeName = 'GOBLIN_VAULT'; // Golden treasure lighting
        } else if (secretFloorData.type === SecretFloors.SECRET_FLOOR_TYPES.GRAY_CAVE_HIDDEN) {
          biomeName = 'GRAY_CAVE'; // Faint violet
        }
      } else {
        biome = _getBiome(_floor);
        biomeName = biome.name.toUpperCase().replace(/ /g, '_');
      }

      LightingSystem.setBiome(biomeName);

      // Apply darkness multiplier for uber mega
      if (isSecretFloor && secretFloorData.type === SecretFloors.SECRET_FLOOR_TYPES.UBER_MEGA) {
        LightingSystem.setDarknessMultiplier(0.3); // Extreme darkness (70% darker)
      } else if (_floor === 30 && _bossFloorActive) {
        LightingSystem.setDarknessMultiplier(0.5); // Nerf light by 50%
      } else {
        LightingSystem.setDarknessMultiplier(1.0);
      }

      // Collect wall positions for light blocking and cache them for per-tick use
      _rebuildWallCache();
      var walls = _wallCache;

      // Generate biome-specific light sources
      LightingSystem.generateBiomeLights(GRID_WIDTH, GRID_HEIGHT, rooms, walls);
      _updatePlayerLight();

      // Update enemy lights
      LightingSystem.updateEnemyLights(_enemies);

      // Calculate initial light map
      LightingSystem.updateLightMap(GRID_WIDTH, GRID_HEIGHT, walls);
    }

    // Spawn shops
    _spawnShops(rooms, floorType);

    // Spawn vents (15% chance, not on bonfire or tutorial floors)
    _spawnVents(rooms, floorType);

    // Apply biome bleed if we have a previous biome tracked
    _applyBiomeBleed(rooms);

    _turn = 0;
  }

  function _createEmptyGrid() {
    var grid = [];
    for (var y = 0; y < GRID_HEIGHT; y++) {
      var row = [];
      for (var x = 0; x < GRID_WIDTH; x++) {
        // Fill with walls initially
        row.push(TILES.WALL);
      }
      grid.push(row);
    }
    return grid;
  }

  function _generateRooms(floorType) {
    // Difficulty affects room count and size
    var difficulty = _floor;

    // Bonfire floors have one large room
    if (floorType === FLOOR_TYPES.BONFIRE) {
      return [{
        x: Math.floor(GRID_WIDTH / 4),
        y: Math.floor(GRID_HEIGHT / 4),
        w: Math.floor(GRID_WIDTH / 2),
        h: Math.floor(GRID_HEIGHT / 2),
        centerX: Math.floor(GRID_WIDTH / 2),
        centerY: Math.floor(GRID_HEIGHT / 2)
      }];
    }

    // Boss floors have one large arena room
    if (floorType === FLOOR_TYPES.BOSS) {
      return [{
        x: 5,
        y: 3,
        w: 30,
        h: 14,
        centerX: 20,
        centerY: 10,
        isBossArena: true
      }];
    }

    // Forest biome (floors 1-3): one large open room covering most of the map
    // Two virtual rooms provide player spawn (left) and exit (right) positions
    var biome = _getBiome(_floor);
    if (biome.name === 'Cozy Forest') {
      var halfW = Math.floor((GRID_WIDTH - 4) / 2);
      var forestRooms = [
        {
          x: 2, y: 2,
          w: halfW, h: GRID_HEIGHT - 4,
          centerX: Math.floor(GRID_WIDTH * 0.25),
          centerY: Math.floor(GRID_HEIGHT / 2)
        },
        {
          x: 2 + halfW, y: 2,
          w: GRID_WIDTH - 4 - halfW, h: GRID_HEIGHT - 4,
          centerX: Math.floor(GRID_WIDTH * 0.75),
          centerY: Math.floor(GRID_HEIGHT / 2)
        }
      ];
      // Carve the entire interior as open space
      for (var fy = 2; fy < GRID_HEIGHT - 2; fy++) {
        for (var fx = 2; fx < GRID_WIDTH - 2; fx++) {
          _grid[fy][fx] = TILES.EMPTY;
        }
      }
      return forestRooms;
    }

    var numRooms = Math.min(4 + Math.floor(difficulty / 2), 8);

    var rooms = [];
    var maxAttempts = 50;

    for (var i = 0; i < numRooms; i++) {
      var attempts = 0;
      var room = null;

      while (attempts < maxAttempts && !room) {
        attempts++;

        // Room dimensions
        var minSize = 4;
        var maxWidth = difficulty > 5 ? 12 : 10;
        var maxHeight = difficulty > 5 ? 10 : 8;

        var w = Math.floor(Math.random() * (maxWidth - minSize + 1)) + minSize;
        var h = Math.floor(Math.random() * (maxHeight - minSize + 1)) + minSize;

        // Ensure room dimensions fit within grid bounds with padding
        w = Math.min(w, GRID_WIDTH - 4);
        h = Math.min(h, GRID_HEIGHT - 4);

        var x = Math.floor(Math.random() * (GRID_WIDTH - w - 4)) + 2;
        var y = Math.floor(Math.random() * (GRID_HEIGHT - h - 4)) + 2;

        // Additional validation: ensure room is fully within bounds
        if (x + w >= GRID_WIDTH - 2 || y + h >= GRID_HEIGHT - 2) {
          continue; // Skip this attempt
        }

        // Check if room overlaps with existing rooms (including 1-2 tile spacing)
        var spacing = 2;
        var overlaps = false;

        for (var j = 0; j < rooms.length; j++) {
          var r = rooms[j];
          if (!(x + w + spacing < r.x || x > r.x + r.w + spacing ||
                y + h + spacing < r.y || y > r.y + r.h + spacing)) {
            overlaps = true;
            break;
          }
        }

        if (!overlaps) {
          room = { x: x, y: y, w: w, h: h, centerX: Math.floor(x + w / 2), centerY: Math.floor(y + h / 2) };
        }
      }

      if (room) {
        rooms.push(room);

        // Carve out room
        for (var ry = room.y; ry < room.y + room.h; ry++) {
          for (var rx = room.x; rx < room.x + room.w; rx++) {
            if (rx >= 0 && rx < GRID_WIDTH && ry >= 0 && ry < GRID_HEIGHT) {
              _grid[ry][rx] = TILES.EMPTY;
            }
          }
        }
      }
    }

    return rooms;
  }

  function _connectRooms(rooms) {
    // Connect each room to the next one (guarantees full traversal)
    for (var i = 0; i < rooms.length - 1; i++) {
      var room1 = rooms[i];
      var room2 = rooms[i + 1];

      _carveCorridor(room1.centerX, room1.centerY, room2.centerX, room2.centerY);
    }
  }

  function _carveCorridor(x1, y1, x2, y2) {
    // Create L-shaped corridor: horizontal first, then vertical
    var x = x1;
    var y = y1;

    // Horizontal segment
    while (x !== x2) {
      if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
        _grid[y][x] = TILES.EMPTY;
        // Make corridors 2 tiles wide for better flow
        if (y + 1 < GRID_HEIGHT) {
          _grid[y + 1][x] = TILES.EMPTY;
        }
      }
      x += (x < x2) ? 1 : -1;
    }

    // Vertical segment
    while (y !== y2) {
      if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
        _grid[y][x] = TILES.EMPTY;
        // Make corridors 2 tiles wide
        if (x + 1 < GRID_WIDTH) {
          _grid[y][x + 1] = TILES.EMPTY;
        }
      }
      y += (y < y2) ? 1 : -1;
    }
  }

  function _addBranchConnections(rooms) {
    // Add 2-4 extra connections to create loops
    var extraConnections = Math.min(2 + Math.floor(_floor / 3), 4);

    for (var i = 0; i < extraConnections && rooms.length > 2; i++) {
      var idx1 = Math.floor(Math.random() * rooms.length);
      var idx2 = Math.floor(Math.random() * rooms.length);

      if (idx1 !== idx2 && Math.abs(idx1 - idx2) > 1) {
        var room1 = rooms[idx1];
        var room2 = rooms[idx2];
        _carveCorridor(room1.centerX, room1.centerY, room2.centerX, room2.centerY);
      }
    }
  }

  function _placeCover() {
    // Place cover on 6-10% of floor tiles
    var coverChance = 0.06 + Math.random() * 0.04;

    for (var y = 1; y < GRID_HEIGHT - 1; y++) {
      for (var x = 1; x < GRID_WIDTH - 1; x++) {
        if (_grid[y][x] === TILES.EMPTY && Math.random() < coverChance) {
          _grid[y][x] = TILES.COVER;
        }
      }
    }
  }

  function _placeShadowZones() {
    // Mark ~15% of floor tiles as shadow zones (stored in metadata)
    var shadowChance = 0.15;

    for (var y = 1; y < GRID_HEIGHT - 1; y++) {
      for (var x = 1; x < GRID_WIDTH - 1; x++) {
        if (_grid[y][x] === TILES.EMPTY && Math.random() < shadowChance) {
          var key = x + ',' + y;
          _tileMetadata[key] = { type: 'shadow', stealthBonus: 30 };
          // Visual indicator: change tile to shadow tile
          _grid[y][x] = TILES.SHADOW;
        }
      }
    }
  }

  function _placeEnvironmentalTiles() {
    // Add environmental tiles based on difficulty and biome
    var difficulty = _floor;
    var biome = _getBiome(_floor);

    // Place biome-specific ground effects if system available
    if (typeof GroundEffects !== 'undefined') {
      var effectCount = 5 + Math.floor(difficulty / 3);

      // Determine ground effects by biome
      var biomeEffects = [];
      if (biome.name === 'Shopping Mall') {
        biomeEffects = ['GLASS', 'SODA_SPILL', 'WATER'];
      } else if (biome.name === 'Industrial Plant') {
        biomeEffects = ['OIL', 'FIRE', 'INDUSTRIAL_WASTE', 'STEAM'];
      } else if (biome.name === 'Commercial Office') {
        biomeEffects = ['WATER', 'GLASS'];
      } else if (biome.name === 'Grey Cave') {
        biomeEffects = ['WATER'];
      }

      // Place ground effects
      for (var i = 0; i < effectCount && biomeEffects.length > 0; i++) {
        var x = Math.floor(Math.random() * (GRID_WIDTH - 2)) + 1;
        var y = Math.floor(Math.random() * (GRID_HEIGHT - 2)) + 1;

        if (_grid[y][x] === TILES.EMPTY) {
          var effectType = biomeEffects[Math.floor(Math.random() * biomeEffects.length)];
          GroundEffects.setGroundEffect(x, y, effectType);

          // Mark in tile metadata for rendering
          var key = x + ',' + y;
          _tileMetadata[key] = { type: 'ground_effect', groundType: effectType };
        }
      }
    }

    // Late game: add hazards and difficult terrain
    if (difficulty >= 5) {
      var hazardCount = Math.floor(difficulty / 2);
      for (var i = 0; i < hazardCount; i++) {
        var x = Math.floor(Math.random() * (GRID_WIDTH - 2)) + 1;
        var y = Math.floor(Math.random() * (GRID_HEIGHT - 2)) + 1;

        if (_grid[y][x] === TILES.EMPTY) {
          _grid[y][x] = TILES.HAZARD;
          var key = x + ',' + y;
          _tileMetadata[key] = { type: 'hazard', damage: 1 };

          // Also add fire ground effect if available
          if (typeof GroundEffects !== 'undefined') {
            GroundEffects.setGroundEffect(x, y, 'FIRE');
          }
        }
      }
    }

    // Add some grass/vegetation for stealth
    if (difficulty < 5) {
      var grassCount = 8 + Math.floor(Math.random() * 5);
      for (var i = 0; i < grassCount; i++) {
        var x = Math.floor(Math.random() * (GRID_WIDTH - 2)) + 1;
        var y = Math.floor(Math.random() * (GRID_HEIGHT - 2)) + 1;

        if (_grid[y][x] === TILES.EMPTY) {
          _grid[y][x] = TILES.GRASS;
          var key = x + ',' + y;
          _tileMetadata[key] = { type: 'grass', stealthBonus: 20 };
        }
      }
    }
  }

  function _placePlayerAndExit(rooms) {
    if (rooms.length === 0) {
      // Fallback if no rooms generated
      return { playerX: 5, playerY: 10, exitX: GRID_WIDTH - 3, exitY: GRID_HEIGHT - 3 };
    }

    // Place player in first room - ensure it's on a floor tile
    var firstRoom = rooms[0];
    var playerX = firstRoom.centerX;
    var playerY = firstRoom.centerY;

    // Validate player spawn is on a floor tile, not a wall
    var maxSpawnAttempts = 10;
    for (var attempt = 0; attempt < maxSpawnAttempts; attempt++) {
      if (_grid[playerY] && _grid[playerY][playerX] && _grid[playerY][playerX] === TILES.EMPTY) {
        // Valid spawn point
        break;
      }
      // Try adjacent tiles if center is blocked
      var offsets = [
        {dx: 0, dy: 0}, {dx: 1, dy: 0}, {dx: -1, dy: 0}, {dx: 0, dy: 1}, {dx: 0, dy: -1},
        {dx: 1, dy: 1}, {dx: -1, dy: -1}, {dx: 1, dy: -1}, {dx: -1, dy: 1}
      ];
      for (var i = 0; i < offsets.length; i++) {
        var testX = firstRoom.centerX + offsets[i].dx;
        var testY = firstRoom.centerY + offsets[i].dy;
        if (testX > 0 && testX < GRID_WIDTH - 1 && testY > 0 && testY < GRID_HEIGHT - 1 &&
            _grid[testY][testX] === TILES.EMPTY) {
          playerX = testX;
          playerY = testY;
          break;
        }
      }
    }

    // Ensure player is within bounds
    playerX = Math.max(1, Math.min(GRID_WIDTH - 2, playerX));
    playerY = Math.max(1, Math.min(GRID_HEIGHT - 2, playerY));

    // Place exit in last room (opposite quadrant)
    var lastRoom = rooms[rooms.length - 1];
    var exitX = lastRoom.centerX;
    var exitY = lastRoom.centerY;

    // Ensure minimum distance
    var distance = Math.abs(exitX - playerX) + Math.abs(exitY - playerY);
    var minDistance = Math.floor((GRID_WIDTH + GRID_HEIGHT) * 0.6);

    if (distance < minDistance && rooms.length > 1) {
      // Try to find a more distant room
      for (var i = rooms.length - 1; i >= 0; i--) {
        var room = rooms[i];
        var dist = Math.abs(room.centerX - playerX) + Math.abs(room.centerY - playerY);
        if (dist >= minDistance) {
          exitX = room.centerX;
          exitY = room.centerY;
          break;
        }
      }
    }

    // Validate exit position is on floor tile
    if (_grid[exitY] && _grid[exitY][exitX] && _grid[exitY][exitX] !== TILES.EMPTY) {
      // Find nearest empty tile for exit
      for (var radius = 1; radius < 5; radius++) {
        for (var dy = -radius; dy <= radius; dy++) {
          for (var dx = -radius; dx <= radius; dx++) {
            var testX = exitX + dx;
            var testY = exitY + dy;
            if (testX > 0 && testX < GRID_WIDTH - 1 && testY > 0 && testY < GRID_HEIGHT - 1 &&
                _grid[testY][testX] === TILES.EMPTY) {
              exitX = testX;
              exitY = testY;
              radius = 999; // Break outer loop
              break;
            }
          }
          if (radius > 100) break;
        }
      }
    }

    // Place exit tile
    _grid[exitY][exitX] = TILES.EXIT;

    return { playerX: playerX, playerY: playerY, exitX: exitX, exitY: exitY };
  }

  function _placeEnemies(rooms, floorType) {
    // No enemies on tutorial floors (1-2)
    if (floorType === FLOOR_TYPES.TUTORIAL) {
      return;
    }

    // No enemies on bonfire floors (safe zones)
    if (floorType === FLOOR_TYPES.BONFIRE) {
      return;
    }

    // Boss floors: place boss enemy only
    if (floorType === FLOOR_TYPES.BOSS && _activeBoss) {
      var bossPos = _activeBoss.bossPosition || { x: 20, y: 10 };
      var bossEnemy = _createEnemy(bossPos.x, bossPos.y, 'STATIONARY', rooms[0]);

      // Enhance boss enemy stats
      bossEnemy.hp = _activeBoss.hp;
      bossEnemy.maxHp = _activeBoss.maxHp;
      bossEnemy.isBoss = true;
      bossEnemy.bossType = _activeBoss.type;
      bossEnemy.str = 8 + Math.floor(_floor * 0.5);
      bossEnemy.dex = 8 + Math.floor(_floor * 0.5);
      bossEnemy.awareness = 100; // Boss is always alert

      // Link boss enemy to boss instance
      _activeBoss.bossEntity = bossEnemy;

      _enemies.push(bossEnemy);
      _totalEnemiesSpawned++; // Track for highscore
      return;
    }

    // Ghost floors (3-4): only cameras/surveillance, no lethal enemies
    if (floorType === FLOOR_TYPES.GHOST) {
      // TODO: Implement camera/drone surveillance system
      return;
    }

    // Exploration floors: very few enemies
    var enemyCount;
    if (floorType === FLOOR_TYPES.EXPLORATION) {
      enemyCount = 1 + Math.floor(Math.random() * 2); // 1-2 enemies max
    } else {
      // Enemy density based on difficulty
      var difficulty = _floor;

      // Apply difficulty tier multiplier
      var tierMultiplier = _getDifficultyMultiplier();
      
      if (difficulty <= 3) {
        enemyCount = Math.floor((4 + Math.floor(Math.random() * 3)) * tierMultiplier); // 4-6 base
      } else if (difficulty <= 7) {
        enemyCount = Math.floor((7 + Math.floor(Math.random() * 4)) * tierMultiplier); // 7-10 base
      } else if (difficulty <= 15) {
        enemyCount = Math.floor((10 + Math.floor(Math.random() * 6)) * tierMultiplier); // 10-15 base
      } else {
        enemyCount = Math.floor((12 + Math.floor(Math.random() * 7)) * tierMultiplier); // 12-18 base
      }
    }

    enemyCount = Math.min(enemyCount, rooms.length * 3); // Don't overcrowd

    // Check if an Elite enemy should spawn on this floor
    var eliteSpawned = false;
    if (typeof EliteEnemies !== 'undefined' && EliteEnemies.shouldSpawnElite(_floor)) {
      var eliteType = EliteEnemies.getRandomEliteForFloor(_floor);
      if (eliteType && rooms.length > 0) {
        // Place elite in a random room, away from player
        var eliteRoomIdx = Math.floor(Math.random() * rooms.length);
        var eliteRoom = rooms[eliteRoomIdx];
        var eliteX = eliteRoom.x + 1 + Math.floor(Math.random() * Math.max(1, eliteRoom.w - 2));
        var eliteY = eliteRoom.y + 1 + Math.floor(Math.random() * Math.max(1, eliteRoom.h - 2));

        // Ensure elite is far from player
        if (Math.abs(eliteX - _player.x) + Math.abs(eliteY - _player.y) >= 8) {
          var elite = EliteEnemies.createElite(eliteType, eliteX, eliteY, _floor);
          if (elite) {
            // Add basic enemy properties for compatibility
            elite.path = { type: PATH_TYPES.PATROL, waypoints: [] };
            elite.pathIndex = 0;
            elite.str = 6 + Math.floor(_floor * 0.3);
            elite.dex = 6 + Math.floor(_floor * 0.3);
            _enemies.push(elite);
            _totalEnemiesSpawned++; // Track for highscore
            eliteSpawned = true;
          }
        }
      }
    }

    for (var i = 0; i < enemyCount && rooms.length > 0; i++) {
      var roomIdx = Math.floor(Math.random() * rooms.length);
      var room = rooms[roomIdx];

      // Random position within room (avoid edges)
      var x = room.x + 1 + Math.floor(Math.random() * Math.max(1, room.w - 2));
      var y = room.y + 1 + Math.floor(Math.random() * Math.max(1, room.h - 2));

      // Check minimum separation from player and other enemies
      var tooClose = false;
      var minSep = 5;

      if (Math.abs(x - _player.x) + Math.abs(y - _player.y) < minSep) {
        tooClose = true;
      }

      for (var j = 0; j < _enemies.length; j++) {
        var sep = Math.abs(x - _enemies[j].x) + Math.abs(y - _enemies[j].y);
        if (sep < 3) {
          tooClose = true;
          break;
        }
      }

      if (tooClose) {
        i--;
        continue;
      }

      // Determine patrol type
      var patrolType = _choosePatrolType(difficulty, room);
      var enemy = _createEnemy(x, y, patrolType, room);

      _enemies.push(enemy);
      _totalEnemiesSpawned++; // Track for highscore
    }
  }

  function _choosePatrolType(difficulty, room) {
    var rand = Math.random();

    if (difficulty <= 3) {
      // Early game: more stationary sentries
      if (rand < 0.4) return PATH_TYPES.STATIONARY;
      if (rand < 0.7) return PATH_TYPES.PATROL;
      return PATH_TYPES.CIRCULAR;
    } else {
      // Late game: more patrols
      if (rand < 0.2) return PATH_TYPES.STATIONARY;
      if (rand < 0.6) return PATH_TYPES.PATROL;
      return PATH_TYPES.CIRCULAR;
    }
  }

  function _createEnemy(x, y, patrolType, room) {
    var tierMultiplier = _getDifficultyMultiplier();
    
    // Check if this is a penalty floor
    var isPenaltyFloor = _penaltyFloors.indexOf(_floor) !== -1;
    var penaltyMultiplier = isPenaltyFloor ? 1.2 : 1.0; // +20% for penalty floors
    
    var enemy = {
      x: x,
      y: y,
      hp: Math.floor(5 * tierMultiplier * penaltyMultiplier),
      maxHp: Math.floor(5 * tierMultiplier * penaltyMultiplier),
      str: Math.floor((3 + Math.floor(_floor * 0.2)) * tierMultiplier * penaltyMultiplier),
      dex: Math.floor((3 + Math.floor(_floor * 0.2)) * tierMultiplier * penaltyMultiplier),
      awareness: 0,
      orientation: ['north', 'south', 'east', 'west'][Math.floor(Math.random() * 4)],
      sightRange: (_floor > 5 ? 7 : 5) + (_difficultyTier - 1) + (isPenaltyFloor ? 1 : 0), // +1 for penalty
      pathTimer: 0,
      isTreasureGoblin: false, // Special enemy type
      goblinSpawnTime: null, // For timeout tracking
      isPenalty: isPenaltyFloor // Mark penalty enemies
    };

    // 2% chance to spawn a treasure goblin after floor 5
    if (_floor > 5 && Math.random() < 0.02) {
      enemy.isTreasureGoblin = true;
      enemy.goblinSpawnTime = Date.now();
      enemy.hp = 3; // Low HP, must kill fast
      enemy.sightRange = 10; // Goblins see player from far
      enemy.awareness = 5; // Always aware, always fleeing
    }

    if (patrolType === PATH_TYPES.STATIONARY) {
      enemy.path = { type: PATH_TYPES.STATIONARY };
    } else if (patrolType === PATH_TYPES.PATROL) {
      // Create patrol path within room
      var points = [
        { x: room.x + 1, y: room.y + 1 },
        { x: room.x + room.w - 2, y: room.y + 1 },
        { x: room.x + room.w - 2, y: room.y + room.h - 2 },
        { x: room.x + 1, y: room.y + room.h - 2 }
      ];
      enemy.path = { type: PATH_TYPES.PATROL, points: points };
      enemy.pathIndex = 0;
      enemy.pathDirection = 1;
    } else if (patrolType === PATH_TYPES.CIRCULAR) {
      // Circular patrol around room center
      var cx = room.centerX;
      var cy = room.centerY;
      var radius = Math.min(room.w, room.h) / 3;
      var points = [
        { x: Math.floor(cx + radius), y: cy },
        { x: cx, y: Math.floor(cy + radius) },
        { x: Math.floor(cx - radius), y: cy },
        { x: cx, y: Math.floor(cy - radius) }
      ];
      enemy.path = { type: PATH_TYPES.CIRCULAR, points: points };
      enemy.pathIndex = 0;
    }

    return enemy;
  }

  function _placeItems(floorType) {
    // Base item count
    var itemCount = 5;

    // Increased loot on tutorial floors
    if (floorType === FLOOR_TYPES.TUTORIAL) {
      itemCount = 8;
    }

    // High loot on exploration floors
    if (floorType === FLOOR_TYPES.EXPLORATION) {
      itemCount = 12;
    }

    // Some loot on bonfire floors
    if (floorType === FLOOR_TYPES.BONFIRE) {
      itemCount = 3;
    }

    // ========== GUARANTEED TRENCH COAT DROP IN GREY BIOME ==========
    // Spawn trench coat on grey cave floors (1-4) if player doesn't have one
    var biome = _getBiome(_floor);
    var shouldSpawnTrenchCoat = false;

    if (biome.name === 'Grey Cave') {
      // Check if player already has trench coat
      var hasTrenchCoat = false;

      if (typeof GAMESTATE !== 'undefined') {
        var looseInv = GAMESTATE.getLooseInventory();
        var persistentInv = GAMESTATE.getPersistentInventory();
        var activeItem = GAMESTATE.getActiveItem();

        // Check all inventories for trench coat
        hasTrenchCoat = looseInv.some(function(item) {
          return item.id && item.id.indexOf('trench_coat') !== -1;
        }) || persistentInv.some(function(item) {
          return item.id && item.id.indexOf('trench_coat') !== -1;
        }) || (activeItem && activeItem.id && activeItem.id.indexOf('trench_coat') !== -1);
      }

      // Spawn trench coat if player doesn't have one
      if (!hasTrenchCoat) {
        shouldSpawnTrenchCoat = true;
      }
    }

    var attempts = 0;
    var maxAttempts = 50;

    for (var i = 0; i < itemCount && attempts < maxAttempts; i++) {
      attempts++;

      var ix = Math.floor(Math.random() * (GRID_WIDTH - 2)) + 1;
      var iy = Math.floor(Math.random() * (GRID_HEIGHT - 2)) + 1;

      var occupied = _grid[iy][ix] !== TILES.EMPTY ||
        (_breakables.some(function(b) { return b.x === ix && b.y === iy && b.hp > 0; })) ||
        _enemies.some(function(e) { return e.x === ix && e.y === iy; }) ||
        (ix === _player.x && iy === _player.y);

      if (occupied) {
        i--;
        continue;
      }

      // Generate random card
      if (typeof CardSystem !== 'undefined') {
        var card;

        // First item spawned in grey cave is trench coat if needed
        if (shouldSpawnTrenchCoat && i === 0) {
          card = CardSystem.rollTrenchCoat();
          shouldSpawnTrenchCoat = false; // Only spawn once
        } else {
          // Use biome-aware card selection if available
          var baseType;
          if (CardSystem.getRandomBaseCardByBiome) {
            baseType = CardSystem.getRandomBaseCardByBiome(biome.name, _floor);
          } else {
            baseType = CardSystem.getRandomBaseCard();
          }
          card = CardSystem.rollCard(baseType);
        }

        _items.push({ x: ix, y: iy, card: card, spawnTime: Date.now(), decayTime: 30000 }); // 30 second decay
      }
    }
  }

  /**
   * Spawn shops on the floor
   */
  function _spawnShops(rooms, floorType) {
    // Check if ShopSystem is available
    if (typeof ShopSystem === 'undefined') {
      return;
    }

    // Check if a shop should spawn on this floor
    var shopSpawn = ShopSystem.shouldSpawnShop(_floor, floorType);
    
    if (!shopSpawn) {
      return;
    }

    // Find a suitable room for the shop (prefer larger rooms)
    var eligibleRooms = rooms.filter(function(room) {
      return room.w >= 5 && room.h >= 5;
    });

    if (eligibleRooms.length === 0) {
      eligibleRooms = rooms; // Fallback to any room
    }

    var shopRoom = eligibleRooms[Math.floor(Math.random() * eligibleRooms.length)];

    // Place shop object in the center of the room
    var shopX = Math.floor(shopRoom.x + shopRoom.w / 2);
    var shopY = Math.floor(shopRoom.y + shopRoom.h / 2);

    // Use shop type constant for consistency
    var shopTileType = shopSpawn.type === ShopSystem.SHOP_TYPES.BLACK_MARKET 
      ? TILES.BLACK_MARKET 
      : TILES.SHOP;

    // Ensure position is empty
    if (_grid[shopY][shopX] === TILES.EMPTY) {
      _grid[shopY][shopX] = shopTileType;

      // Track shop object
      _shops.push({
        x: shopX,
        y: shopY,
        type: shopSpawn.type,
        floor: _floor,
        opened: false
      });

      console.log('[GoneRogue] Spawned', shopSpawn.type, 'shop at', shopX, shopY);
    }
  }

  /**
   * Spawn vents on floor (15% probability, minimum 1 every 4-6 floors)
   */
  function _spawnVents(rooms, floorType) {
    _vents = []; // Clear previous vents
    
    // No vents on tutorial, bonfire, or boss floors
    if (floorType === FLOOR_TYPES.TUTORIAL || 
        floorType === FLOOR_TYPES.BONFIRE || 
        floorType === FLOOR_TYPES.BOSS ||
        floorType === FLOOR_TYPES.FINAL) {
      return;
    }
    
    // 15% chance to spawn a vent
    if (Math.random() > 0.15) {
      return;
    }
    
    // Find a suitable room (prefer mid-size rooms)
    var eligibleRooms = rooms.filter(function(room) {
      return room.w >= 4 && room.h >= 4 && room.w <= 8 && room.h <= 8;
    });
    
    if (eligibleRooms.length === 0) {
      eligibleRooms = rooms; // Fallback to any room
    }
    
    var ventRoom = eligibleRooms[Math.floor(Math.random() * eligibleRooms.length)];
    
    // Place vent in a random position within room
    var ventX = ventRoom.x + 1 + Math.floor(Math.random() * (ventRoom.w - 2));
    var ventY = ventRoom.y + 1 + Math.floor(Math.random() * (ventRoom.h - 2));
    
    // Ensure position is empty
    if (_grid[ventY][ventX] === TILES.EMPTY) {
      // Vent quality: 85% standard, 15% rusty (worse success rate)
      var quality = Math.random() < 0.85 ? 'standard' : 'rusty';
      
      _grid[ventY][ventX] = TILES.VENT;
      
      _vents.push({
        x: ventX,
        y: ventY,
        quality: quality,
        discovered: false,
        used: false
      });
      
      console.log('[GoneRogue] Spawned', quality, 'vent at', ventX, ventY);
    }
  }

  /**
   * Apply biome bleed - add tiles from adjacent biomes to floor edges
   */
  function _applyBiomeBleed(rooms) {
    var currentBiome = _getBiome(_floor);
    
    // Track this biome for next floor
    if (_visitedBiomes.indexOf(currentBiome.name) === -1) {
      _visitedBiomes.push(currentBiome.name);
    }
    
    // If we have a previous biome and it's different, add bleed tiles
    if (_previousBiome && _previousBiome.name !== currentBiome.name) {
      _applyBleedTiles(_previousBiome, 'entrance', 5, 10);
    }
    
    // Preview next floor's biome near exit (if floor < 30)
    if (_floor < 30) {
      // Use cached preview if available, otherwise generate and cache
      if (!_nextBiomePreview) {
        _nextBiomePreview = _getBiome(_floor + 1);
      }
      
      if (_nextBiomePreview.name !== currentBiome.name) {
        _applyBleedTiles(_nextBiomePreview, 'exit', 5, 10);
      }
    }
    
    // Store current biome as previous for next floor
    // And set next preview to null so it regenerates
    _previousBiome = currentBiome;
    _nextBiomePreview = null; // Will be set fresh on next floor
  }

  /**
   * Apply bleed tiles from a biome to the floor
   */
  function _applyBleedTiles(biome, location, minCount, maxCount) {
    var count = minCount + Math.floor(Math.random() * (maxCount - minCount + 1));
    var bleedChar = _getBleedChar(biome);
    
    if (!bleedChar) return;
    
    for (var i = 0; i < count; i++) {
      var x, y;
      
      if (location === 'entrance') {
        // Place near player spawn (left side of map)
        x = 1 + Math.floor(Math.random() * 8);
        y = 1 + Math.floor(Math.random() * (GRID_HEIGHT - 2));
      } else {
        // Place near exit (right side of map)
        x = GRID_WIDTH - 9 + Math.floor(Math.random() * 8);
        y = 1 + Math.floor(Math.random() * (GRID_HEIGHT - 2));
      }
      
      // Only place on empty floor tiles
      if (_grid[y] && _grid[y][x] === TILES.EMPTY) {
        _grid[y][x] = bleedChar;
      }
    }
  }

  /**
   * Get bleed character for biome
   */
  function _getBleedChar(biome) {
    switch (biome.name) {
      case 'Cozy Forest':
        return TILES.GRASS; // Grass/foliage
      case 'Shopping Mall':
        return TILES.DEBRIS; // Mall debris
      case 'Industrial Complex':
        return TILES.HAZARD; // Industrial waste
      case 'Grey Cave':
        return TILES.SHADOW; // Cave shadows
      case 'Aerospace Museum':
        return TILES.DEBRIS; // Metal debris
      default:
        return null;
    }
  }

  function _validateStealthPath(startX, startY, endX, endY) {
    // Simple BFS pathfinding to check if path exists
    // Count how many enemy vision cones the path crosses

    var queue = [{ x: startX, y: startY, steps: 0 }];
    var visited = {};
    visited[startX + ',' + startY] = true;

    var found = false;
    var minVisionCrosses = Infinity;

    while (queue.length > 0 && queue[0].steps < 100) {
      var current = queue.shift();

      if (current.x === endX && current.y === endY) {
        found = true;
        break;
      }

      var neighbors = [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 }
      ];

      for (var i = 0; i < neighbors.length; i++) {
        var n = neighbors[i];
        var key = n.x + ',' + n.y;

        if (n.x >= 0 && n.x < GRID_WIDTH && n.y >= 0 && n.y < GRID_HEIGHT &&
            !visited[key] && _grid[n.y][n.x] !== TILES.WALL) {
          visited[key] = true;
          queue.push({ x: n.x, y: n.y, steps: current.steps + 1 });
        }
      }
    }

    // Map is valid if path exists
    return found;
  }

  function _spawnBreakables() {
    // Get current biome
    var biome = _getBiome(_floor);

    // Spawn biome-specific breakables
    _breakables = [];

    // Spawn 8-12 random breakables from the biome's prop list
    var breakableCount = 8 + Math.floor(Math.random() * 5);
    var breakableProps = biome.props.filter(function(p) { return p.breakable; });

    if (breakableProps.length === 0) {
      // Fallback to generic crates if biome has no breakable props
      breakableProps = [{ emoji: '📦', name: 'Crate', breakable: true, hp: 2 }];
    }

    for (var i = 0; i < breakableCount; i++) {
      var attempts = 0;
      var placed = false;

      while (!placed && attempts < 50) {
        var x = 2 + Math.floor(Math.random() * (GRID_WIDTH - 4));
        var y = 2 + Math.floor(Math.random() * (GRID_HEIGHT - 4));

        // Check if position is valid (floor tile, not player, not exit, not occupied)
        if (_grid[y] && _grid[y][x] === TILES.EMPTY &&
            !(x === _player.x && y === _player.y) &&
            !_breakables.find(function(b) { return b.x === x && b.y === y; })) {

          var propTemplate = breakableProps[Math.floor(Math.random() * breakableProps.length)];
          _breakables.push({
            x: x,
            y: y,
            hp: propTemplate.hp,
            maxHp: propTemplate.hp,
            glyph: TILES.BREAKABLE,
            destroyedGlyph: TILES.DEBRIS,
            emoji: propTemplate.emoji,
            name: propTemplate.name,
            tag: 'biome_prop_' + i
          });

          placed = true;
        }
        attempts++;
      }
    }

    // Place on grid
    _breakables.forEach(function(breakable) {
      if (_grid[breakable.y] && _grid[breakable.y][breakable.x]) {
        _grid[breakable.y][breakable.x] = TILES.BREAKABLE;
      }
    });
  }

  /**
   * Place guaranteed tutorial gate blocking path to exit
   * Ensures gate is on a direct path between player and exit
   * Spawns tutorial pickups (currency, ammo, card) behind the gate
   */
  function _placeTutorialGate(exitX, exitY) {
    // Find a position on the path to the exit (roughly 60-70% of the way there)
    var dx = exitX - _player.x;
    var dy = exitY - _player.y;
    var gateX = Math.floor(_player.x + dx * 0.65);
    var gateY = Math.floor(_player.y + dy * 0.65);

    // Ensure gate is on a floor tile and not too close to player or exit
    var minDistFromPlayer = 5;
    var minDistFromExit = 5;
    var validPosition = false;
    var attempts = 0;

    while (!validPosition && attempts < 50) {
      if (_grid[gateY] && _grid[gateY][gateX] === TILES.EMPTY) {
        var distToPlayer = Math.abs(gateX - _player.x) + Math.abs(gateY - _player.y);
        var distToExit = Math.abs(gateX - exitX) + Math.abs(gateY - exitY);

        if (distToPlayer >= minDistFromPlayer && distToExit >= minDistFromExit) {
          validPosition = true;
        }
      }

      if (!validPosition) {
        // Try a nearby position
        gateX = Math.floor(_player.x + dx * (0.5 + Math.random() * 0.3));
        gateY = Math.floor(_player.y + dy * (0.5 + Math.random() * 0.3));
        gateX = Math.max(2, Math.min(GRID_WIDTH - 3, gateX));
        gateY = Math.max(2, Math.min(GRID_HEIGHT - 3, gateY));
      }

      attempts++;
    }

    // Place the gate (wooden gate from forest biome)
    var gateBreakable = {
      x: gateX,
      y: gateY,
      hp: 2,
      maxHp: 2,
      glyph: TILES.BREAKABLE,
      destroyedGlyph: TILES.DEBRIS,
      emoji: '🚧',
      name: 'Wooden Gate',
      tag: 'tutorial_gate',
      isTutorialGate: true,
      type: 'WOODEN_GATE' // Gate type for environmental synergy
    };

    _breakables.push(gateBreakable);
    _grid[gateY][gateX] = TILES.BREAKABLE;

    // Register with environmental synergy system
    if (typeof EnvironmentalSynergy !== 'undefined') {
      EnvironmentalSynergy.registerGate({
        x: gateX,
        y: gateY,
        type: 'WOODEN_GATE'
      });
      console.log('[GoneRogue] Registered tutorial gate with environmental synergy');
    }

    // Spawn RUSTY_KEY near player spawn (so they can unlock the gate)
    var keyX = _player.x + (Math.random() > 0.5 ? 2 : -2);
    var keyY = _player.y + (Math.random() > 0.5 ? 1 : -1);

    // Ensure key position is valid
    if (keyX >= 1 && keyX < GRID_WIDTH - 1 && keyY >= 1 && keyY < GRID_HEIGHT - 1 &&
        _grid[keyY] && _grid[keyY][keyX] === TILES.EMPTY) {

      // Add key as interactive item
      if (typeof InteractiveItems !== 'undefined') {
        InteractiveItems.addItem({
          x: keyX,
          y: keyY,
          itemId: 'RUSTY_KEY',
          type: 'key',
          emoji: '🔑',
          name: 'Rusty Key',
          description: 'An old, rusted key. Might open something...',
          tag: 'tutorial_key'
        });
        console.log('[GoneRogue] Spawned tutorial key at', keyX, keyY);
      }
    }

    // Spawn tutorial pickups behind the gate (towards the exit)
    var pickupX = gateX + Math.sign(dx);
    var pickupY = gateY + Math.sign(dy);

    // Ensure pickup position is valid
    if (pickupX < 1 || pickupX >= GRID_WIDTH - 1) pickupX = gateX;
    if (pickupY < 1 || pickupY >= GRID_HEIGHT - 1) pickupY = gateY;

    // Spawn currency (50 cryptos)
    _spawnCurrency(pickupX, pickupY, 50);

    // Spawn ammo pickup (add to items array)
    // We'll create the ammo item similar to how items are placed
    var ammoOffsetX = Math.sign(dx) !== 0 ? Math.sign(dx) : 1;
    var ammoX = pickupX + ammoOffsetX;
    var ammoY = pickupY;

    if (ammoX >= 1 && ammoX < GRID_WIDTH - 1 && _grid[ammoY] && _grid[ammoY][ammoX] === TILES.EMPTY) {
      _items.push({
        x: ammoX,
        y: ammoY,
        type: 'ammo',
        name: 'Ammo Box',
        emoji: '📦',
        amount: 10,
        tag: 'tutorial_ammo'
      });
    }

    // Spawn card pickup
    var cardOffsetY = Math.sign(dy) !== 0 ? Math.sign(dy) : 1;
    var cardX = pickupX;
    var cardY = pickupY + cardOffsetY;

    if (cardY >= 1 && cardY < GRID_HEIGHT - 1 && _grid[cardY] && _grid[cardY][cardX] === TILES.EMPTY) {
      _items.push({
        x: cardX,
        y: cardY,
        type: 'card',
        name: 'Card',
        emoji: '🃏',
        tag: 'tutorial_card',
        cardQuality: 50 // Medium quality for tutorial
      });
    }
  }

  /**
   * Spawn currency (cryptos ¢) at a location
   */
  function _spawnCurrency(x, y, amount) {
    _currencies.push({
      x: x,
      y: y,
      amount: amount,
      glyph: '¢',
      emoji: '💰',
      spawnTime: Date.now(),
      decayTime: 20000 // 20 second decay for currency
    });
  }

  function _renderGrid() {
    var lines = [''];

    // Copy grid for rendering (use biome visual grid if available for forest floors)
    var display = (_biomeVisualGrid ? _biomeVisualGrid : _grid).map(function(row) { return row.slice(); });

    // Place breakables
    _breakables.forEach(function(breakable) {
      if (breakable.hp > 0) {
        display[breakable.y][breakable.x] = breakable.glyph || TILES.BREAKABLE;
      } else if (breakable.destroyedGlyph) {
        display[breakable.y][breakable.x] = breakable.destroyedGlyph;
      }
    });

    // Place enemies
    _enemies.forEach(function(enemy) {
      if (enemy.hp > 0) {
        display[enemy.y][enemy.x] = TILES.ENEMY;
      }
    });

    // Place items
    _items.forEach(function(item) {
      display[item.y][item.x] = TILES.ITEM;
    });

    // Place projectiles
    _projectiles.forEach(function(projectile) {
      display[projectile.y][projectile.x] = projectile.glyph || TILES.PROJECTILE;
    });

    // Place player (check for avatar override from passive items)
    var playerAvatar = TILES.PLAYER;
    if (typeof PassiveItemsSystem !== 'undefined' && PassiveItemsSystem.getPlayerAvatarOverride) {
      var override = PassiveItemsSystem.getPlayerAvatarOverride();
      if (override) {
        playerAvatar = override;
      }
    }
    display[_player.y][_player.x] = playerAvatar;

    // Render grid
    for (var y = 0; y < GRID_HEIGHT; y++) {
      lines.push(display[y].join(''));
    }

    lines.push('');
    var biome = _getBiome(_floor);
    var floorLabel;

    // Show secret floor name if active
    if (_activeSecretFloor) {
      if (_activeSecretFloor === SecretFloors.SECRET_FLOOR_TYPES.UBER_MEGA) {
        floorLabel = 'SECRET: ⚠️ UBER MEGA ⚠️';
      } else if (_activeSecretFloor === SecretFloors.SECRET_FLOOR_TYPES.GOBLIN_VAULT) {
        floorLabel = 'SECRET: 💰 Goblin Vault 💰';
      } else if (_activeSecretFloor === SecretFloors.SECRET_FLOOR_TYPES.GRAY_CAVE_HIDDEN) {
        floorLabel = 'SECRET: 🌫️ Gray Cave 🌫️';
      }
    } else {
      floorLabel = 'Floor: ' + _floor + ' | ' + biome.name;
    }

    if (_bossFloorActive && !_bossDefeated) {
      floorLabel += ' 👹 BOSS FLOOR';
    } else if (_bossFloorActive && _bossDefeated) {
      floorLabel += ' ✅ BOSS DEFEATED';
    }
    
    // Show penalty floor indicator
    if (_penaltyFloors.indexOf(_floor) !== -1) {
      floorLabel += ' 🔻 PENALTY';
    }
    
    lines.push('HP: ' + _player.hp + '/' + _player.maxHp + ' | ' + floorLabel + ' | Turn: ' + _turn);
    if (_bossFloorActive && _activeBoss && !_bossDefeated) {
      lines.push('⚠️  Boss: ' + _activeBoss.type + ' | Phase: ' + _activeBoss.phase);
    }
    lines.push('');

    return lines;
  }

  /**
   * Helper to update mobile grid rendering with state
   */
  function _updateMobileGrid() {
    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      var displayGrid = _biomeVisualGrid || _grid;
      GoneRogueMobile.renderGrid(displayGrid, _player, _enemies, _items, _enemyColorCycleTime, _breakables, _projectiles, _alertLevel, _strCombatActive, _muzzleFlash, _impactEffects, _currencies);
    }
  }

  /**
   * Update reserve card slots with current hand
   */
  function _updateReserveSlots() {
    if (typeof ReserveSlots === 'undefined' || typeof GAMESTATE === 'undefined') return;

    // Get loose inventory (current hand)
    var loose = GAMESTATE.getLooseInventory();
    
    // Convert to card format for reserve slots
    var cards = loose.map(function(item) {
      return {
        id: item.id,
        name: item.name || 'Card',
        icon: item.emoji || item.icon || '🃏',
        emoji: item.emoji || item.icon || '🃏',
        description: item.description || '',
        cost: item.cost || null,
        damage: item.damage || null,
        range: item.range || null
      };
    });

    ReserveSlots.setReserveCards(cards);
  }

  function _movePlayer(dx, dy, runMode) {
    // Block movement during STR combat
    if (_strCombatActive) {
      return {
        lines: ['⚔️  MOVEMENT LOCKED - STR COMBAT IN PROGRESS', 'Use cards to fight or type FLEE to retreat', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    var newX = _player.x + dx;
    var newY = _player.y + dy;

    // Track last move direction for flanking logic
    if (dx === 1) {
      _player.lastMoveDirection = 'east';
    } else if (dx === -1) {
      _player.lastMoveDirection = 'west';
    } else if (dy === 1) {
      _player.lastMoveDirection = 'south';
    } else if (dy === -1) {
      _player.lastMoveDirection = 'north';
    }

    // Check bounds
    if (newX < 0 || newX >= GRID_WIDTH || newY < 0 || newY >= GRID_HEIGHT) {
      return {
        lines: ['CANNOT MOVE THERE', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Check collision
    var tile = _grid[newY][newX];
    if (tile === TILES.WALL) {
      return {
        lines: ['WALL BLOCKS PATH', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    var blockingBreakable = _getBreakableAt(newX, newY);
    if (blockingBreakable && blockingBreakable.hp > 0) {
      return {
        lines: [blockingBreakable.emoji + ' BREAKABLE BLOCKS PATH', 'USE SHOOT OR KICK TO CLEAR', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Move player
    _player.x = newX;
    _player.y = newY;
    _turn++;

    // Check if player walked onto EXIT tile - trigger level transition
    if (tile === TILES.EXIT) {
      return _attemptExtract();
    }

    // Check if player walked onto SHOP tile - open shop
    if (tile === TILES.SHOP || tile === TILES.BLACK_MARKET) {
      var shopObj = _shops.find(function(s) { return s.x === newX && s.y === newY; });
      if (shopObj && typeof ShopSystem !== 'undefined' && !shopObj.opened) {
        var shopType = tile === TILES.BLACK_MARKET ? ShopSystem.SHOP_TYPES.BLACK_MARKET : ShopSystem.SHOP_TYPES.STANDARD;
        ShopSystem.openShop(shopType, _floor);
        shopObj.opened = true;
      }
    }

    // Check for currency pickup
    var cryptoPickup = _currencies.find(function(c) { return c.x === newX && c.y === newY; });
    var cryptoMessage = null;
    if (cryptoPickup) {
      if (typeof GAMESTATE !== 'undefined') {
        var result = GAMESTATE.addCryptos(cryptoPickup.amount);
        cryptoMessage = result.message;
      }
      // Track for highscore
      _currencyCollected += cryptoPickup.amount;
      // Remove currency from floor
      _currencies = _currencies.filter(function(c) { return c.x !== newX || c.y !== newY; });

      // Set player currency collection state for animation
      _player.collectingCurrency = true;
      _player.currencyCollectTime = Date.now();

      // Show overhead currency animation
      if (typeof OverheadAnimator !== 'undefined') {
        OverheadAnimator.showCurrencyPickup(_player.x, _player.y, cryptoPickup.amount);
      }

      // MOK interjection for currency pickup
      if (typeof UIControls !== 'undefined' && UIControls.updateMokInterjection) {
        var cryptoMsg = cryptoPickup.amount === 1 ? '¢1 Collected' : '¢' + cryptoPickup.amount + ' Collected';
        UIControls.updateMokInterjection(cryptoMsg);
      }

      // Tooltip: Currency pickup
      if (typeof TooltipSystem !== 'undefined') {
        TooltipSystem.showAction('currency-pickup', { amount: cryptoPickup.amount });
      }
    }

    // Check for food item pickup (auto-pickup from interactive items)
    if (typeof InteractiveItems !== 'undefined') {
      var foodItem = InteractiveItems.getItemAt(newX, newY);
      if (foodItem && foodItem.autoPickup && foodItem.type === 'FOOD') {
        // Apply food effects
        if (typeof FoodDatabase !== 'undefined' && foodItem.customData && foodItem.customData.foodId) {
          var result = FoodDatabase.applyFoodEffects(foodItem.customData.foodId, _player);
          if (result.success) {
            // Show overhead animation with food emoji
            if (typeof OverheadAnimator !== 'undefined') {
              OverheadAnimator.showExpression(newX, newY, 'LOOT', 1000, result.emoji);
            }

            // Block sprint temporarily after food pickup (0.9 second delay)
            // This prevents immediate fatigue refill during sprint, causing delayed food buff effect
            if (typeof GAMESTATE !== 'undefined' && GAMESTATE.blockSprintTemporarily) {
              GAMESTATE.blockSprintTemporarily(900);
            }

            // MOK interjection for food pickup
            if (typeof UIControls !== 'undefined' && UIControls.updateMokInterjection) {
              UIControls.updateMokInterjection(result.emoji + ' ' + result.foodName + ' consumed');
            }

            // Tooltip: Food effects
            if (typeof TooltipSystem !== 'undefined' && result.tooltipText) {
              TooltipSystem.showGeneric(result.tooltipText, 2000);
            }

            // Remove food item from world (clean disappearance)
            InteractiveItems.removeItem(foodItem.id);
            console.log('[GoneRogue] Food consumed:', result.foodName);
          }
        }
      }
    }

    // Check for discovery reveal when player walks onto discovery tile
    var discoveryRevealed = _revealDiscovery(newX, newY);
    if (discoveryRevealed) {
      // Discovery found, rewards already granted by _revealDiscovery
      if (typeof UIControls !== 'undefined' && UIControls.updateMokInterjection) {
        UIControls.updateMokInterjection('Discovery Found!');
      }
    }

    // Apply tile effects
    var tileEffectMessage = _applyTileEffects(newX, newY);

    // Run mode increases detection and makes noise
    if (runMode) {
      // Break passive items that break on running
      if (typeof PassiveItemsSystem !== 'undefined' && PassiveItemsSystem.checkAndBreakItems) {
        PassiveItemsSystem.checkAndBreakItems('run');
      }

      _player.detection += 2;
      _updateAlertLevel();

      // Nearby enemies hear player noise when running
      _enemies.forEach(function(enemy) {
        if (enemy.hp <= 0) return;
        var dist = Math.abs(enemy.x - newX) + Math.abs(enemy.y - newY);
        if (dist <= 5) {
          _increaseEnemyAwareness(enemy, 15); // Significant awareness increase from noise
        }
      });

      // Tooltip: Running
      if (typeof TooltipSystem !== 'undefined') {
        TooltipSystem.showAction('move', { run: true });
      }
    } else {
      _player.detection = Math.max(0, _player.detection - 0.5);
      _updateAlertLevel();

      // Tooltip: Walking
      if (typeof TooltipSystem !== 'undefined') {
        TooltipSystem.showAction('move', { run: false });
      }
    }

    // Check for enemy collision - trigger STR combat
    var hitEnemy = _enemies.find(function(e) { return e.x === newX && e.y === newY && e.hp > 0; });
    if (hitEnemy) {
      // Enter STR combat mode
      return _enterStrCombat(hitEnemy, 'collision');
    }

    _saveState();

    var messageLines = [];
    if (cryptoMessage) messageLines.push(cryptoMessage);
    if (tileEffectMessage) messageLines.push(tileEffectMessage);
    var lines = messageLines.length > 0 ? messageLines.concat(['']).concat(_renderGrid()) : _renderGrid();

    return {
      lines: lines,
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Apply tile effects when player enters a tile
   */
  function _applyTileEffects(x, y) {
    var tile = _grid[y][x];
    var key = x + ',' + y;
    var metadata = _tileMetadata[key];
    var message = null;

    // Check for ground effects (water, oil, etc.)
    if (typeof GroundEffects !== 'undefined') {
      var groundEffect = GroundEffects.getGroundAt(x, y);
      if (groundEffect && groundEffect.movePenalty) {
        // Apply visual feedback for water slowdown
        if (groundEffect.type === 'WATER' || groundEffect.char === '~') {
          _applyWaterSlowdownEffect();
        }
      }
    }

    // Hazard damage
    if (tile === TILES.HAZARD || (metadata && metadata.type === 'hazard')) {
      var damage = metadata ? metadata.damage : 1;
      _player.hp -= damage;
      message = '🟥 HAZARD! -' + damage + ' HP';

      if (_player.hp <= 0) {
        return _handlePlayerDeath('environmental_hazard', {
          damage: damage,
          location: { x: _player.x, y: _player.y }
        });
      }
    }

    // Stealth bonuses (applied passively during detection checks)
    if (tile === TILES.SHADOW || tile === TILES.GRASS || tile === TILES.SMOKE) {
      if (tile === TILES.SHADOW) {
        message = '⬛ Entered shadow (stealth +30%)';
      } else if (tile === TILES.GRASS) {
        message = '🟩 Grass cover (stealth +20%)';
      } else if (tile === TILES.SMOKE) {
        message = '🌫️  Smoke/fog (stealth +40%)';
      }
    }

    return message;
  }

  /**
   * Apply visual feedback for water slowdown
   * Blue wave roll down animation on window frame
   */
  function _applyWaterSlowdownEffect() {
    var gameFrame = document.getElementById('game-frame');
    if (!gameFrame) {
      gameFrame = document.querySelector('.game-window');
    }

    if (gameFrame) {
      // Add water slowdown class for CSS animation
      gameFrame.classList.add('water-slowdown-effect');

      // Remove class after animation completes (1 second)
      setTimeout(function() {
        gameFrame.classList.remove('water-slowdown-effect');
      }, 1000);
    }
  }

  /**
   * Update alert level based on detection
   */
  function _updateAlertLevel() {
    if (_player.detection >= 8) {
      _alertLevel = 'danger';
    } else if (_player.detection >= 4) {
      _alertLevel = 'caution';
    } else {
      _alertLevel = 'safe';
    }
  }

  function _pickupItem() {
    var item = _items.find(function(i) { return i.x === _player.x && i.y === _player.y; });
    if (!item) {
      return {
        lines: ['NO ITEM HERE', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Handle ammo pickup (auto-collect)
    if (item.type === 'ammo') {
      if (typeof GAMESTATE !== 'undefined') {
        GAMESTATE.addAmmo(item.amount);
      }
      
      // Remove ammo from floor
      _items = _items.filter(function(i) { return i !== item; });
      
      // Tooltip and MOK interjection
      if (typeof TooltipSystem !== 'undefined') {
        TooltipSystem.showAction('item-pickup', { name: 'Ammo +' + item.amount });
      }
      
      if (typeof UIControls !== 'undefined' && UIControls.updateMokInterjection) {
        UIControls.updateMokInterjection('🔫 Ammo +' + item.amount);
      }
      
      return {
        lines: ['PICKED UP: 🔫 Ammo +' + item.amount, ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Check if item is a card (attack/support) or regular item
    var isCard = item.card && (item.card.type === 'attack' || item.card.type === 'support');
    
    // Add to appropriate inventory
    if (typeof GAMESTATE !== 'undefined') {
      var result;
      
      if (isCard) {
        // NEW LOOT FLOW: Cards go to hand first, then action buttons
        result = GAMESTATE.addCard(item.card);
      } else {
        // Non-card items go to loose inventory (legacy behavior)
        result = GAMESTATE.addToLoose(item.card);
      }
      
      if (!result.success) {
        return {
          lines: [result.message, 'DROP SOMETHING FIRST', ''].concat(_renderGrid()),
          prompt: getPrompt(),
          stayActive: true
        };
      }
      
      // Show where card was added (hand vs action buttons)
      if (isCard && result.location) {
        var locationMsg = result.location === 'hand' ? '[Added to HAND]' : '[Added to ACTION BUTTONS]';
        _lastPickupMessage = locationMsg;
      }
    }

    // Remove item from floor
    _items = _items.filter(function(i) { return i !== item; });

    // Tooltip: Item/card pickup (all items use card structure)
    if (typeof TooltipSystem !== 'undefined') {
      if (item.card.type === 'attack' || item.card.type === 'support') {
        TooltipSystem.showAction('card-pickup', { name: item.card.name });
      } else {
        TooltipSystem.showAction('item-pickup', { name: item.card.name });
      }
    }
    
    // MOK interjection for card/item pickup
    if (typeof UIControls !== 'undefined' && UIControls.updateMokInterjection) {
      var pickupType = isCard ? 'Card' : 'Item';
      var locationInfo = (isCard && result && result.location) ? ' → ' + result.location.toUpperCase() : '';
      UIControls.updateMokInterjection(pickupType + ': ' + item.card.name + locationInfo);
    }

    return {
      lines: ['PICKED UP: ' + item.card.emoji + ' ' + item.card.name + ' [' + item.card.qualityName + ']', ''].concat(_renderGrid()),
      prompt: getPrompt(),
      stayActive: true
    };
  }

  function _attemptExtract() {
    var tile = _grid[_player.y][_player.x];
    if (tile !== TILES.EXIT) {
      return {
        lines: ['NO EXIT HERE', 'FIND THE EXTRACTION POINT (🚪)', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Check if this is the final floor (30) or if player wants to extract early
    var MAX_FLOORS = 30;
    if (_floor >= MAX_FLOORS) {
      _runCompleted = true; // Mark run as completed for highscore
      
      // Mark difficulty tier as completed
      if (typeof AWOLDifficulty !== 'undefined' && _difficultyTier >= 1 && _difficultyTier <= 3) {
        AWOLDifficulty.markTierCompleted(_difficultyTier);
      }
      
      return _exitRogue(true);
    }

    // Advance to next floor
    return _advanceFloor();
  }

  /**
   * Handle vent interaction and bypass attempt
   */
  function _handleVentInteraction() {
    // Find vent at player position
    var vent = null;
    for (var i = 0; i < _vents.length; i++) {
      if (_vents[i].x === _player.x && _vents[i].y === _player.y) {
        vent = _vents[i];
        break;
      }
    }
    
    if (!vent || vent.used) {
      return { lines: ['This vent is no longer functional'], prompt: getPrompt(), stayActive: true };
    }
    
    // Mark as discovered
    if (!vent.discovered) {
      vent.discovered = true;
      return {
        lines: [
          'You found a vent!',
          '',
          'Quality: ' + (vent.quality === 'rusty' ? 'Rusty (Lower Success)' : 'Standard'),
          'Destination: Floor ' + (_floor + 2),
          '',
          'Use INTERACT again to attempt bypass',
          'or move away to continue normally'
        ],
        prompt: getPrompt(),
        stayActive: true
      };
    }
    
    // Calculate bypass success chance
    var bypassChance = 0.75; // Base 75%
    bypassChance -= (_ventUseCount * 0.05); // -5% per prior vent use
    bypassChance -= (_floor * 0.01); // -1% per floor depth
    
    // Rusty vents have worse odds
    if (vent.quality === 'rusty') {
      bypassChance -= 0.05;
    }
    
    // Difficulty tier affects success rate
    bypassChance -= (_difficultyTier - 1) * 0.05; // -5% per tier above 1
    
    // Clamp to minimum 25%
    bypassChance = Math.max(0.25, bypassChance);
    
    // Attempt bypass
    var success = Math.random() < bypassChance;
    vent.used = true;
    _ventUseCount++;
    
    if (success) {
      // Success: Skip to floor N+2
      var lines = [
        'VENT BYPASS SUCCESSFUL!',
        '',
        'You navigate through the vent system.',
        'Emerging on floor ' + (_floor + 2) + '...',
        '',
        'Floor ' + (_floor + 1) + ' cleared automatically (50% XP awarded)'
      ];
      
      // Award 50% XP for skipped floor
      _awardSkippedFloorXP();
      
      // Advance floor by 2
      _floor++;
      
      // Remove the vent tile
      _grid[_player.y][_player.x] = TILES.EMPTY;
      
      // Generate next floor
      setTimeout(function() {
        _advanceFloor();
      }, 100);
      
      return { lines: lines, prompt: getPrompt(), stayActive: true };
    } else {
      // Failure: Backtrack 3 floors with penalty enemies
      var backtrackFloors = Math.min(3, _floor - 1);
      var targetFloor = Math.max(1, _floor - backtrackFloors);
      
      var lines = [
        'VENT MALFUNCTION!',
        '',
        'The vent collapses behind you!',
        'You tumble backwards through the system...',
        '',
        'Landed on floor ' + targetFloor,
        'WARNING: Penalty enemies active!'
      ];
      
      // Mark floors as penalty
      for (var i = 0; i < backtrackFloors; i++) {
        var penaltyFloor = targetFloor + i;
        if (_penaltyFloors.indexOf(penaltyFloor) === -1) {
          _penaltyFloors.push(penaltyFloor);
        }
      }
      
      // Backtrack floor
      _floor = targetFloor - 1; // Will be incremented by advanceFloor
      
      // Player takes minor damage from the fall
      _player.hp = Math.max(1, _player.hp - 2);
      
      // Remove the vent tile
      _grid[_player.y][_player.x] = TILES.EMPTY;
      
      // Generate penalty floor
      setTimeout(function() {
        _advanceFloor();
      }, 100);
      
      return { lines: lines, prompt: getPrompt(), stayActive: true };
    }
  }

  /**
   * Award XP for skipped floor
   */
  function _awardSkippedFloorXP() {
    // Calculate XP based on skipped floor
    var baseXP = 50 + (_floor * 10);
    var skippedXP = Math.floor(baseXP * 0.5);
    
    // Award to gamestate if available
    if (typeof GAMESTATE !== 'undefined' && GAMESTATE.awardExperience) {
      GAMESTATE.awardExperience(skippedXP);
    }
  }

  /**
   * Handle interaction with interactive items
   */
  function _handleInteraction() {
    // First check if player is on a vent tile
    var playerTile = _grid[_player.y][_player.x];
    if (playerTile === TILES.VENT) {
      return _handleVentInteraction();
    }
    
    if (typeof InteractiveItems === 'undefined') {
      return { lines: ['Nothing to interact with'], prompt: getPrompt(), stayActive: true };
    }

    // Find nearest interactive item
    var nearestItem = InteractiveItems.getNearestItem(_player.x, _player.y);

    if (!nearestItem) {
      return { lines: ['Nothing nearby to interact with'], prompt: getPrompt(), stayActive: true };
    }

    if (!InteractiveItems.canInteractWith(_player.x, _player.y, nearestItem)) {
      return { lines: ['Too far away to interact'], prompt: getPrompt(), stayActive: true };
    }

    // Perform interaction
    var result = InteractiveItems.interact(nearestItem, _player);

    if (result.success) {
      // Show overhead animation
      if (result.animation && typeof OverheadAnimator !== 'undefined') {
        OverheadAnimator.showExpression(
          _player.x,
          _player.y,
          result.animation.expressionKey,
          result.animation.duration
        );
      }

      // Show tooltip
      if (result.tooltip && typeof TooltipSystem !== 'undefined') {
        TooltipSystem.show(result.tooltip.message, result.tooltip.duration);
      }

      return {
        lines: ['Interacted with ' + nearestItem.name, '', nearestItem.text],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    return { lines: ['Cannot interact with that'], prompt: getPrompt(), stayActive: true };
  }

  function _advanceFloor() {
    // Check for queued secret floor BEFORE normal floor generation
    var secretFloorData = null;
    if (typeof SecretFloors !== 'undefined' && SecretFloors.hasQueuedSecretFloor()) {
      secretFloorData = SecretFloors.popSecretFloor();
      console.log('[GoneRogue] Secret floor triggered:', secretFloorData.type);
    }

    // Check for low HP + high gold trigger (15% chance when conditions met)
    if (!secretFloorData && typeof SecretFloors !== 'undefined') {
      var triggerResult = SecretFloors.triggerSecretFloor(
        SecretFloors.TRIGGER_TYPES.LOW_HP_HIGH_GOLD,
        {
          playerHp: _player.hp,
          playerMaxHp: _player.maxHp,
          playerGold: _player.cryptos
        }
      );

      if (triggerResult.success) {
        secretFloorData = SecretFloors.popSecretFloor();
        console.log('[GoneRogue] Low HP + High Gold secret floor triggered:', secretFloorData.type);
      }
    }

    // Apply fade-out effect before transitioning
    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      var gridContainer = document.getElementById('rogue-grid-mobile');
      if (gridContainer) {
        gridContainer.style.opacity = '0';
        gridContainer.style.transition = 'opacity 0.3s ease-out';
      }
    }

    // Wait for fade-out to complete before generating new floor
    setTimeout(function() {
      var isSecretFloor = !!secretFloorData;
      var secretFloorType = isSecretFloor ? secretFloorData.type : null;

      // Only advance floor number if NOT a secret floor
      if (!isSecretFloor) {
        _floor++;
      }
      _turn = 0;

      // Reset vendor for new bonfire
      _vendor = null;
      _vendorInventory = [];

      // Heal player slightly between floors (10-20% of max HP)
      var healAmount = Math.floor(_player.maxHp * (0.1 + Math.random() * 0.1));
      _player.hp = Math.min(_player.maxHp, _player.hp + healAmount);

      // Generate next floor (moved BEFORE card delivery logic)
      if (isSecretFloor) {
        _generateFloor(secretFloorData);
      } else {
        _generateFloor();
      }
      _startGameLoop();
      _saveState();

      // Initialize lines array for messaging
      var lines = [];

      if (isSecretFloor) {
        // Secret floor messaging
        lines.push('');
        lines.push('⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️');

        if (secretFloorType === SecretFloors.SECRET_FLOOR_TYPES.UBER_MEGA) {
          lines.push('  REALITY BREACH DETECTED');
          lines.push('  YOU SHOULD NOT BE HERE');
          lines.push('  SYSTEM INTEGRITY: 12%');
        } else if (secretFloorType === SecretFloors.SECRET_FLOOR_TYPES.GOBLIN_VAULT) {
          lines.push('  ANOMALY DETECTED');
          lines.push('  SPACE WARPING...');
          lines.push('  TREASURE VAULT MANIFESTED');
        } else if (secretFloorType === SecretFloors.SECRET_FLOOR_TYPES.GRAY_CAVE_HIDDEN) {
          lines.push('  HIDDEN PATH REVEALED');
          lines.push('  GRAY CAVE PASSAGE');
        }

        lines.push('⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️');
        lines.push('');
        lines.push('  HP RESTORED: +' + healAmount);
        lines.push('');

        // Mark that we've entered a secret floor
        SecretFloors.clearCurrentSecretFloor();

      } else {
        // Normal floor messaging
        lines.push('');
        lines.push('═══════════════════════════════════════');
        lines.push('  FLOOR ' + _floor + ' - EXTRACTION SUCCESSFUL');
        lines.push('═══════════════════════════════════════');
        lines.push('');
        lines.push('  HP RESTORED: +' + healAmount);
        lines.push('  INFILTRATING DEEPER...');
        lines.push('');
      }

      // Show mobile UI with fade-in effect
      if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
        GoneRogueMobile.show();
        _updateMobileGrid();

        var gridContainer = document.getElementById('rogue-grid-mobile');
        if (gridContainer) {
          // Fade in the new floor
          setTimeout(function() {
            gridContainer.style.opacity = '1';
            gridContainer.style.transition = 'opacity 0.3s ease-in';
          }, 50);
        }
      }

      // Return result for text-based mode
      if (!_useInteractiveGrid) {
        return {
          lines: lines.concat(_renderGrid()),
          prompt: getPrompt(),
          stayActive: true
        };
      }
    }, 300); // Match fade-out duration

    // Immediately return for interactive mode
    return {
      lines: ['EXTRACTING...'],
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Initialize vendor for bonfire floor
   */
  function _initializeVendor() {
    // Choose random vendor type
    var vendorTypes = Object.keys(VENDOR_TYPES);
    var randomType = vendorTypes[Math.floor(Math.random() * vendorTypes.length)];
    _vendor = VENDOR_TYPES[randomType];

    // Generate vendor inventory (5 cards)
    _vendorInventory = [];
    for (var i = 0; i < 5; i++) {
      if (typeof CardSystem !== 'undefined') {
        var baseType = CardSystem.getRandomBaseCard();
        var card = CardSystem.rollCard(baseType);

        // Calculate price based on quality and vendor multiplier
        var basePrice = 50 + Math.floor((card.quality / 100) * 150);
        var price = Math.floor(basePrice * _vendor.priceMultiplier);

        _vendorInventory.push({
          card: card,
          price: price
        });
      }
    }
  }

  /**
   * Show vendor shop
   */
  function _showVendor() {
    var floorType = _getFloorType(_floor);
    if (floorType !== FLOOR_TYPES.BONFIRE) {
      return {
        lines: ['NO VENDOR HERE', 'Vendors only appear at bonfire floors (10, 16, 22)', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Initialize vendor if not done yet
    if (!_vendor) {
      _initializeVendor();
    }

    var lines = [
      '',
      '═══════════════════════════════════════',
      '  🔥 BONFIRE VENDOR 🔥',
      '  ' + _vendor.emoji + ' ' + _vendor.name,
      '  ' + _vendor.description,
      '═══════════════════════════════════════',
      ''
    ];

    // Show player's cryptos
    if (typeof GAMESTATE !== 'undefined') {
      var cryptos = GAMESTATE.getState().cryptos || 0;
      lines.push('  YOUR CRYPTOS: ¢' + cryptos);
      lines.push('');
    }

    // Show vendor inventory
    lines.push('VENDOR INVENTORY:');
    _vendorInventory.forEach(function(item, i) {
      lines.push('  ' + (i+1) + '. ' + item.card.emoji + ' ' + item.card.name + ' [' + item.card.qualityName + '] - ¢' + item.price);
    });

    lines.push('');
    lines.push('COMMANDS:');
    lines.push('  BUY <number>  - Purchase item');
    lines.push('  HEAL          - Restore 30-50% HP for ¢30');
    lines.push('  GAMBLE        - Random card roll for ¢100');
    lines.push('');

    return {
      lines: lines,
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Buy item from vendor
   */
  function _buyFromVendor(cmd) {
    var floorType = _getFloorType(_floor);
    if (floorType !== FLOOR_TYPES.BONFIRE) {
      return {
        lines: ['NO VENDOR HERE', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    if (!_vendor) {
      _initializeVendor();
    }

    // Parse item number
    var parts = cmd.split(' ');
    var itemNum = parseInt(parts[1]);

    if (isNaN(itemNum) || itemNum < 1 || itemNum > _vendorInventory.length) {
      return {
        lines: ['INVALID ITEM NUMBER', 'Use: BUY <1-' + _vendorInventory.length + '>', ''],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    var item = _vendorInventory[itemNum - 1];

    if (typeof GAMESTATE !== 'undefined') {
      var state = GAMESTATE.getState();
      var cryptos = state.cryptos || 0;

      if (cryptos < item.price) {
        return {
          lines: ['INSUFFICIENT FUNDS', 'Need ¢' + item.price + ', have ¢' + cryptos, ''],
          prompt: getPrompt(),
          stayActive: true
        };
      }

      // Add to loose inventory
      var result = GAMESTATE.addToLoose(item.card);
      if (!result.success) {
        return {
          lines: [result.message, 'DROP SOMETHING FIRST', ''],
          prompt: getPrompt(),
          stayActive: true
        };
      }

      // Deduct cryptos
      state.cryptos -= item.price;

      // Remove from vendor inventory
      _vendorInventory.splice(itemNum - 1, 1);

      _saveState();

      return {
        lines: ['PURCHASED: ' + item.card.emoji + ' ' + item.card.name, 'Remaining cryptos: ¢' + state.cryptos, ''],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    return {
      lines: ['PURCHASE FAILED', ''],
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Heal at bonfire
   */
  function _healAtBonfire() {
    var floorType = _getFloorType(_floor);
    if (floorType !== FLOOR_TYPES.BONFIRE) {
      return {
        lines: ['NO BONFIRE HERE', 'Healing only available at bonfire floors', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    var HEAL_COST = 30;

    if (typeof GAMESTATE !== 'undefined') {
      var state = GAMESTATE.getState();
      var cryptos = state.cryptos || 0;

      if (cryptos < HEAL_COST) {
        return {
          lines: ['INSUFFICIENT FUNDS', 'Healing costs ¢' + HEAL_COST + ', have ¢' + cryptos, ''],
          prompt: getPrompt(),
          stayActive: true
        };
      }

      // Heal 30-50% HP
      var healPercent = 0.3 + Math.random() * 0.2;
      var healAmount = Math.floor(_player.maxHp * healPercent);
      var oldHp = _player.hp;
      _player.hp = Math.min(_player.maxHp, _player.hp + healAmount);
      var actualHeal = _player.hp - oldHp;

      // Deduct cryptos
      state.cryptos -= HEAL_COST;

      _saveState();

      return {
        lines: [
          'HEALED: +' + actualHeal + ' HP',
          'HP: ' + _player.hp + '/' + _player.maxHp,
          'Remaining cryptos: ¢' + state.cryptos,
          ''
        ],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    return {
      lines: ['HEAL FAILED', ''],
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Gamble for a random card
   */
  function _gambleCard() {
    var floorType = _getFloorType(_floor);
    if (floorType !== FLOOR_TYPES.BONFIRE) {
      return {
        lines: ['NO VENDOR HERE', 'Gambling only available at bonfire floors', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    var GAMBLE_COST = 100;

    if (typeof GAMESTATE !== 'undefined' && typeof CardSystem !== 'undefined') {
      var state = GAMESTATE.getState();
      var cryptos = state.cryptos || 0;

      if (cryptos < GAMBLE_COST) {
        return {
          lines: ['INSUFFICIENT FUNDS', 'Gambling costs ¢' + GAMBLE_COST + ', have ¢' + cryptos, ''],
          prompt: getPrompt(),
          stayActive: true
        };
      }

      // Roll random card with gambling odds
      // 70% junk (30-55%), 20% usable (55-75%), 8% strong (75-90%), 1.8% near-perfect (90-97%), 0.2% perfect (97-100%)
      var rand = Math.random() * 100;
      var targetQuality;

      if (rand < 0.2) {
        targetQuality = 97 + Math.random() * 3; // 97-100% (perfect)
      } else if (rand < 2) {
        targetQuality = 90 + Math.random() * 7; // 90-97% (near-perfect)
      } else if (rand < 10) {
        targetQuality = 75 + Math.random() * 15; // 75-90% (strong)
      } else if (rand < 30) {
        targetQuality = 55 + Math.random() * 20; // 55-75% (usable)
      } else {
        targetQuality = 30 + Math.random() * 25; // 30-55% (junk)
      }

      var baseType = CardSystem.getRandomBaseCard();
      var card = CardSystem.rollCard(baseType);

      // For simplicity, just use the rolled card's quality
      // The gambling mechanism is about the odds of getting different quality tiers

      // Add to loose inventory
      var result = GAMESTATE.addToLoose(card);
      if (!result.success) {
        return {
          lines: [result.message, 'DROP SOMETHING FIRST', ''],
          prompt: getPrompt(),
          stayActive: true
        };
      }

      // Deduct cryptos
      state.cryptos -= GAMBLE_COST;

      _saveState();

      var qualityDesc = card.quality >= 97 ? '✨ PERFECT ✨' :
                       card.quality >= 90 ? '🌟 NEAR-PERFECT' :
                       card.quality >= 75 ? '⭐ STRONG' :
                       card.quality >= 55 ? '• USABLE' : '• JUNK';

      return {
        lines: [
          '🎲 GAMBLE RESULT:',
          qualityDesc,
          card.emoji + ' ' + card.name + ' [' + card.qualityName + '] (' + Math.floor(card.quality) + '%)',
          'Remaining cryptos: ¢' + state.cryptos,
          ''
        ],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    return {
      lines: ['GAMBLE FAILED', ''],
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Stash card from loose carry to persistent inventory (bonfire only)
   */
  function _stashCard(cmd) {
    var floorType = _getFloorType(_floor);
    if (floorType !== FLOOR_TYPES.BONFIRE) {
      return {
        lines: ['NO BONFIRE HERE', 'Inventory transfer only available at bonfire floors', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    if (typeof GAMESTATE === 'undefined') {
      return {
        lines: ['GAMESTATE UNAVAILABLE', ''],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Parse item number from command
    var parts = cmd.split(' ');
    if (parts.length < 2) {
      return {
        lines: ['USAGE: STASH <number>', 'Example: STASH 1', ''].concat(_inventoryLines()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    var itemNum = parseInt(parts[1], 10) - 1; // Convert to 0-indexed
    var looseInv = GAMESTATE.getLooseInventory();

    if (itemNum < 0 || itemNum >= looseInv.length) {
      return {
        lines: ['INVALID ITEM NUMBER', 'Loose carry has ' + looseInv.length + ' items', ''].concat(_inventoryLines()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    var item = looseInv[itemNum];

    // Try to add to persistent
    var addResult = GAMESTATE.addToPersistent(item);
    if (!addResult.success) {
      return {
        lines: [addResult.message, ''].concat(_inventoryLines()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Remove from loose
    GAMESTATE.removeFromLoose(itemNum);

    return {
      lines: [
        '📦 STASHED TO PERSISTENT STORAGE',
        item.emoji + ' ' + item.name,
        ''
      ].concat(_inventoryLines()),
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Retrieve card from persistent inventory to loose carry (bonfire only)
   */
  function _retrieveCard(cmd) {
    var floorType = _getFloorType(_floor);
    if (floorType !== FLOOR_TYPES.BONFIRE) {
      return {
        lines: ['NO BONFIRE HERE', 'Inventory transfer only available at bonfire floors', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    if (typeof GAMESTATE === 'undefined') {
      return {
        lines: ['GAMESTATE UNAVAILABLE', ''],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Parse item number from command
    var parts = cmd.split(' ');
    if (parts.length < 2) {
      return {
        lines: ['USAGE: RETRIEVE <number>', 'Example: RETRIEVE 1', ''].concat(_inventoryLines()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    var itemNum = parseInt(parts[1], 10) - 1; // Convert to 0-indexed
    var persistentInv = GAMESTATE.getPersistentInventory();

    if (itemNum < 0 || itemNum >= persistentInv.length) {
      return {
        lines: ['INVALID ITEM NUMBER', 'Persistent storage has ' + persistentInv.length + ' items', ''].concat(_inventoryLines()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    var item = persistentInv[itemNum];

    // Try to add to loose
    var addResult = GAMESTATE.addToLoose(item);
    if (!addResult.success) {
      return {
        lines: [addResult.message, ''].concat(_inventoryLines()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Remove from persistent
    GAMESTATE.removeFromPersistent(itemNum);

    return {
      lines: [
        '🎒 RETRIEVED TO LOOSE CARRY',
        item.emoji + ' ' + item.name,
        ''
      ].concat(_inventoryLines()),
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Equip item from persistent inventory to active slot
   */
  function _equipItem(cmd) {
    if (typeof GAMESTATE === 'undefined') {
      return {
        lines: ['GAMESTATE UNAVAILABLE', ''],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Parse item number from command
    var parts = cmd.split(' ');
    if (parts.length < 2) {
      return {
        lines: ['USAGE: EQUIP <number>', 'Example: EQUIP 1', ''].concat(_inventoryLines()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    var itemNum = parseInt(parts[1], 10) - 1; // Convert to 0-indexed
    var persistentInv = GAMESTATE.getPersistentInventory();

    if (itemNum < 0 || itemNum >= persistentInv.length) {
      return {
        lines: ['INVALID ITEM NUMBER', 'Persistent inventory has ' + persistentInv.length + ' items', ''].concat(_inventoryLines()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    var item = persistentInv[itemNum];

    // Set as active item (doesn't remove from inventory)
    GAMESTATE.setActiveItem(item);

    // Update player light if it's a lighting item
    _updatePlayerLight();

    return {
      lines: [
        '⚡ EQUIPPED TO ACTIVE SLOT',
        item.emoji + ' ' + item.name,
        ''
      ].concat(_inventoryLines()),
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Unequip active item
   */
  function _unequipItem() {
    if (typeof GAMESTATE === 'undefined') {
      return {
        lines: ['GAMESTATE UNAVAILABLE', ''],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    var activeItem = GAMESTATE.getActiveItem();
    if (!activeItem) {
      return {
        lines: ['NO ITEM EQUIPPED', ''],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    GAMESTATE.clearActiveItem();

    // Update player light (will clear it)
    _updatePlayerLight();

    return {
      lines: [
        '⚪ UNEQUIPPED',
        'Active slot cleared',
        ''
      ].concat(_inventoryLines()),
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Submit highscore at end of run
   */
  function _submitHighscore() {
    // Determine if this is an agent or human run
    var mode = 'human';
    if (typeof AgentIntegration !== 'undefined' && AgentIntegration.isActive()) {
      mode = 'agent';
    }

    // Get display name
    var displayName = 'Anonymous';
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getAccount === 'function') {
      var account = GAMESTATE.getAccount();
      if (account && account.username) {
        displayName = account.username;
      }
    }

    // Calculate enemies avoided (spawned but not killed)
    var enemiesAvoided = Math.max(0, _totalEnemiesSpawned - _enemiesKilled);

    // Prepare run data for score calculation
    var runData = {
      currencyFound: _currencyCollected,
      interactivesFound: 0, // TODO: Track interactive items in future
      enemiesAvoided: enemiesAvoided,
      breakableDamage: _totalBreakableDamage,
      damageMitigated: _damageMitigated
    };

    // Calculate score
    var score = HighscoreState.calculateGoneRogueScore(runData);

    // Prepare entry
    var entry = {
      game_id: 'gone_rogue',
      mode: mode,
      display_name: displayName,
      score: score,
      metadata: {
        completions: _runCompleted ? 1 : 0,
        final_floor: _floor,
        player_deaths: _playerDeaths,
        enemies_killed: _enemiesKilled,
        enemies_avoided: enemiesAvoided,
        currency_collected: _currencyCollected,
        total_damage_dealt: _totalDamageDealt,
        most_damage_dealt_single_action: _maxSingleHit,
        damage_mitigated: _damageMitigated,
        breakables_destroyed: _totalBreakableDamage,
        run_duration_ms: _runStartTime ? (Date.now() - _runStartTime) : 0
      }
    };

    // Submit to HighscoreState
    var result = HighscoreState.submitHighscore(entry);

    if (result.success) {
      console.log('[GoneRogue] Highscore submitted:', score, 'Entry ID:', result.entry_id);
    } else {
      console.error('[GoneRogue] Failed to submit highscore:', result.error);
    }
  }

  /**
   * Handle player death
   * @param {string} reason - Death reason (environmental_hazard, combat_damage, etc.)
   * @param {Object} context - Additional context {enemy, damage}
   * @returns {Object} Action object with death screen
   */
  function _handlePlayerDeath(reason, context) {
    context = context || {};

    // Increment player death counter
    _playerDeaths++;

    // Use DeathHandler if available
    var deathResult;
    if (typeof DeathHandler !== 'undefined') {
      deathResult = DeathHandler.handlePlayerDeath(
        _player,
        reason,
        {
          enemy: context.enemy,
          floor: _floor,
          damage: context.damage,
          location: { x: _player.x, y: _player.y }
        }
      );
    } else {
      // Fallback death handling
      deathResult = {
        messages: [
          '',
          '═══════════════════════════════════',
          '        💀 SIGNAL LOST 💀',
          '═══════════════════════════════════',
          '',
          'You have been defeated.',
          'Floor reached: ' + _floor,
          ''
        ]
      };
    }

    // Submit highscore on death
    if (typeof HighscoreState !== 'undefined') {
      _submitHighscore();
    }

    // Exit rogue mode
    return _exitRogue(false);
  }

  /**
   * Handle enemy death
   * @param {Object} enemy - Enemy that died
   * @param {string} source - Death source ('player', 'environment', 'player_environment')
   * @param {Object} context - Additional context {hazardType, damage}
   * @returns {Object} Death result with loot info
   */
  function _handleEnemyDeath(enemy, source, context) {
    context = context || {};

    // Use DeathHandler if available
    var deathResult;
    if (typeof DeathHandler !== 'undefined') {
      deathResult = DeathHandler.handleEnemyDeath(
        enemy,
        source,
        {
          player: _player,
          damage: context.damage,
          location: { x: enemy.x, y: enemy.y },
          hazardType: context.hazardType,
          bossLoot: context.bossLoot
        }
      );
    } else {
      // Fallback death handling
      deathResult = {
        playerCredit: source === 'player' || source === 'player_environment',
        loot: {
          cards: [],
          charms: [],
          currency: 0,
          xp: 0
        },
        messages: []
      };
    }

    // Update kill counter if player gets credit
    if (deathResult.playerCredit) {
      _enemiesKilled++;
    }

    // Spawn loot
    if (deathResult.loot) {
      // Spawn currency
      if (deathResult.loot.currency > 0) {
        _spawnCurrency(enemy.x, enemy.y, deathResult.loot.currency);
      }

      // Spawn cards
      if (deathResult.loot.cards && deathResult.loot.cards.length > 0 && typeof CardSystem !== 'undefined') {
        for (var i = 0; i < deathResult.loot.cards.length; i++) {
          if (deathResult.loot.cards[i].shouldDrop) {
            var baseType = CardSystem.getRandomBaseCard();
            var card = CardSystem.rollCard(baseType);
            if (card) {
              _items.push({
                x: enemy.x,
                y: enemy.y,
                type: 'card',
                card: card,
                spawnTime: Date.now(),
                decayTime: 30000
              });
            }
          }
        }
      }

      // Spawn charms
      if (deathResult.loot.charms && deathResult.loot.charms.length > 0 && typeof CardSystem !== 'undefined') {
        for (var j = 0; j < deathResult.loot.charms.length; j++) {
          if (deathResult.loot.charms[j].shouldDrop) {
            var charm = CardSystem.rollCommonCharm();
            if (charm) {
              _items.push({
                x: enemy.x,
                y: enemy.y,
                type: 'charm',
                card: charm,
                spawnTime: Date.now(),
                decayTime: 30000
              });
            }
          }
        }
      }
    }

    return deathResult;
  }

  function _exitRogue(success) {
    _active = false;
    _stopGameLoop();

    // Re-enable scanlines when returning to terminal
    document.body.classList.remove('gone-rogue-active');

    // Submit highscore if extraction was successful
    if (success && typeof HighscoreState !== 'undefined') {
      _submitHighscore();
    }

    // Restore mobile keyboard behavior when exiting
    if (typeof Terminal !== 'undefined' && typeof Terminal.restoreMobileKeyboard === 'function') {
      Terminal.restoreMobileKeyboard();
    }

    // Hide mobile UI
    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      GoneRogueMobile.hide();
    }

    // Hide reserve card slots
    if (typeof ReserveSlots !== 'undefined') {
      ReserveSlots.hide();
    }

    // Switch debrief feed back to MOK display
    if (typeof DebriefFeedController !== 'undefined') {
      DebriefFeedController.setMode('mainMenu');
    }

    var result = {
      success: success,
      unlockedSlot: success,
      extractedItem: null
    };

    if (typeof GAMESTATE !== 'undefined') {
      var exitResult = GAMESTATE.exitRogueMode(result);
      return {
        lines: exitResult.lines,
        stayActive: false
      };
    }

    return {
      lines: ['', 'EXITING GONE ROGUE', 'RETURNING TO STREET CHRONICLES', ''],
      stayActive: false
    };
  }

  /**
   * Start the game loop
   */
  function _startGameLoop() {
    if (_gameLoopActive) return;
    _gameLoopActive = true;
    _lastTickTime = Date.now();
    _enemyColorCycleTime = 0;
    _lightMapTickCounter = 0;
    _gameLoopTick();
  }

  /**
   * Stop the game loop
   */
  function _stopGameLoop() {
    _gameLoopActive = false;
    if (_animationFrameId) {
      cancelAnimationFrame(_animationFrameId);
      _animationFrameId = null;
    }
  }

  /**
   * Main game loop tick
   */
  function _gameLoopTick() {
    if (!_gameLoopActive) return;

    var now = Date.now();
    var delta = now - _lastTickTime;

    // Process game updates if enough time has passed
    if (delta >= _tickInterval) {
      _updateGameState(delta);
      _lastTickTime = now;
    }

    // Schedule next tick
    _animationFrameId = requestAnimationFrame(_gameLoopTick);
  }

  /**
   * Update all game state (enemies, awareness, etc.)
   */
  function _updateGameState(deltaMs) {
    // Update smooth movement system
    if (typeof GoneRogueMovement !== 'undefined' && GoneRogueMovement.isMoving()) {
      var collisionCheck = function(x, y) {
        return !_isWalkable(x, y);
      };

      GoneRogueMovement.update(collisionCheck);

      // Update player position from movement system
      var logical = GoneRogueMovement.getLogicalPosition();
      var visual = GoneRogueMovement.getVisualPosition();

      // Check if logical position changed (player reached next tile)
      if (_player.x !== logical.x || _player.y !== logical.y) {
        // Update player grid position
        var oldX = _player.x;
        var oldY = _player.y;
        _player.x = logical.x;
        _player.y = logical.y;

        // Update last move direction for flanking
        if (logical.x > oldX) _player.lastMoveDirection = 'east';
        else if (logical.x < oldX) _player.lastMoveDirection = 'west';
        else if (logical.y > oldY) _player.lastMoveDirection = 'south';
        else if (logical.y < oldY) _player.lastMoveDirection = 'north';

        // Check for items, currency, enemies at new position
        _checkPlayerInteractions();
      }

      // Store visual position for rendering
      _player.visualX = visual.x;
      _player.visualY = visual.y;

      // Update tooltip positions for continuous movement
      if (typeof TooltipThumb !== 'undefined') {
        var playerPos = { x: visual.x, y: visual.y };
        TooltipThumb.updatePosition('player', playerPos);
      }

      // Update mobile UI with new positions
      if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
        _updateMobileGrid();
      }
    }

    // Update enemy positions and awareness
    _enemies.forEach(function(enemy) {
      if (enemy.hp <= 0) return;

      // Check treasure goblin timeout (15 seconds to kill)
      if (enemy.isTreasureGoblin && enemy.goblinSpawnTime && typeof SecretFloors !== 'undefined') {
        var goblinAge = (Date.now() - enemy.goblinSpawnTime) / 1000; // Age in seconds
        var goblinTimeout = 15; // 15 seconds to kill

        if (goblinAge > goblinTimeout) {
          // Goblin escaped! Trigger secret floor
          var triggerResult = SecretFloors.triggerSecretFloor(
            SecretFloors.TRIGGER_TYPES.GOBLIN_TIMEOUT,
            {
              goblinTimeExpired: true
            }
          );

          if (triggerResult.success) {
            console.log('[GoneRogue] Treasure goblin escaped - secret floor triggered!');
          }

          // Remove the goblin (it escaped)
          enemy.hp = 0;
        }
      }

      // Update Elite enemies with special behavior
      if (enemy.isElite && typeof EliteEnemies !== 'undefined') {
        EliteEnemies.updateElite(enemy, _player, _grid, deltaMs);
      }

      // Update enemy pathing
      _updateEnemyPath(enemy, deltaMs);

      // Update awareness decay
      _updateEnemyAwareness(enemy, deltaMs);

      // Coarse distance pre-cull: skip expensive sight-cone check for enemies
      // that are provably beyond the maximum possible sight range.
      // Uses squared-distance to avoid Math.sqrt — max base sight is 5 tiles,
      // plus up to 5 tiles of darkness bonus gives an effective cap of 10.
      var dxCull = _player.x - enemy.x;
      var dyCull = _player.y - enemy.y;
      if (dxCull * dxCull + dyCull * dyCull <= 100) { // 10² = 100
        // Check if player is in sight cone
        if (_isPlayerInSightCone(enemy)) {
          _increaseEnemyAwareness(enemy, 10); // Increase awareness when player spotted
          if (!_strCombatActive) {
            _enterStrCombat(enemy, 'enemy_sighting');
          }
        }
      }
    });

    _updateProjectiles(deltaMs);

    // Let the active boss inject real-time hazard projectiles into the
    // existing projectile pipeline each tick (no new engine required).
    if (_bossFloorActive && _activeBoss && !_bossDefeated &&
        typeof _activeBoss.updateRealTime === 'function') {
      var bossRt = _activeBoss.updateRealTime(deltaMs, {
        player: _player,
        grid: _grid,
        enemies: _enemies
      });
      if (bossRt && bossRt.bossProjectiles && bossRt.bossProjectiles.length) {
        bossRt.bossProjectiles.forEach(function(p) {
          _projectiles.push(p);
        });
      }
      // Apply move-lock state for Asteroids boss
      if (_activeBoss.playerMoveLocked !== undefined) {
        _playerMoveLocked = !!_activeBoss.playerMoveLocked;
      }
    }
    var now = Date.now();
    _items = _items.filter(function(item) {
      if (item.spawnTime && item.decayTime) {
        var age = now - item.spawnTime;
        return age < item.decayTime;
      }
      return true; // Keep items without decay timers
    });

    // Update currency decay timers
    _currencies = _currencies.filter(function(currency) {
      if (currency.spawnTime && currency.decayTime) {
        var age = now - currency.spawnTime;
        return age < currency.decayTime;
      }
      return true; // Keep currency without decay timers
    });

    // Update color cycle timer for visual feedback
    _enemyColorCycleTime += deltaMs;

    // Update ground effects system (spreading fire, dissipating steam, etc.)
    if (typeof GroundEffects !== 'undefined') {
      GroundEffects.update(deltaMs, GRID_WIDTH, GRID_HEIGHT);

      // Apply ground effect damage to player
      var playerGroundDamage = GroundEffects.getDamage(_player.x, _player.y);
      if (playerGroundDamage > 0) {
        _player.hp = Math.max(0, _player.hp - playerGroundDamage);
        if (_player.hp <= 0) {
          // Player died from ground effect
          return _handlePlayerDeath('environmental_hazard');
        }
      }

      // Apply ground effect damage to enemies
      _enemies.forEach(function(enemy) {
        if (enemy.hp <= 0) return;
        var enemyGroundDamage = GroundEffects.getDamage(enemy.x, enemy.y);
        if (enemyGroundDamage > 0) {
          var hpBefore = enemy.hp;
          enemy.hp = Math.max(0, enemy.hp - enemyGroundDamage);

          // Check if enemy died from ground effect
          if (enemy.hp <= 0 && hpBefore > 0) {
            // Determine if player gets credit for this death
            // For now, assume ground effects are passive (no player credit)
            // Future: track player-triggered ground effects (fire spread, etc.)
            _handleEnemyDeath(enemy, 'environment', {
              location: { x: enemy.x, y: enemy.y },
              hazardType: 'ground_effect',
              damage: enemyGroundDamage
            });
          }
        }
      });
    }

    // Update lighting system
    if (typeof LightingSystem !== 'undefined') {
      // Update player light position
      _updatePlayerLight();

      // Update enemy lights
      LightingSystem.updateEnemyLights(_enemies);

      // Throttle full light-map recalculation to every 5 ticks (~500ms at 10 FPS).
      // Walls are static per floor — _wallCache is built once in _generateFloor.
      _lightMapTickCounter++;
      if (_lightMapTickCounter >= 5) {
        _lightMapTickCounter = 0;
        LightingSystem.updateLightMap(GRID_WIDTH, GRID_HEIGHT, _wallCache);
      }
    }

    // Re-render if using interactive grid
    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      _updateMobileGrid();
    }
  }

  /**
   * Update enemy path movement
   */
  function _updateEnemyPath(enemy, deltaMs) {
    if (!enemy.path) return;

    enemy.pathTimer = (enemy.pathTimer || 0) + deltaMs;

    // Move every 500ms
    if (enemy.pathTimer >= 500) {
      enemy.pathTimer = 0;

      if (enemy.path.type === PATH_TYPES.PATROL) {
        _moveEnemyPatrol(enemy);
      } else if (enemy.path.type === PATH_TYPES.CIRCULAR) {
        _moveEnemyCircular(enemy);
      } else if (enemy.path.type === PATH_TYPES.ELLIPSE) {
        _moveEnemyEllipse(enemy);
      } else if (enemy.path.type === PATH_TYPES.STATIONARY) {
        _rotateEnemyInPlace(enemy);
      }
    }
  }

  /**
   * Move enemy along patrol path (A→B→C→B)
   */
  function _moveEnemyPatrol(enemy) {
    if (!enemy.path.points || enemy.path.points.length < 2) return;

    var currentIndex = enemy.pathIndex || 0;
    var direction = enemy.pathDirection || 1;

    // Move to next point
    currentIndex += direction;

    // Reverse at endpoints
    if (currentIndex >= enemy.path.points.length) {
      currentIndex = enemy.path.points.length - 2;
      direction = -1;
    } else if (currentIndex < 0) {
      currentIndex = 1;
      direction = 1;
    }

    enemy.pathIndex = currentIndex;
    enemy.pathDirection = direction;

    var point = enemy.path.points[currentIndex];
    _moveEnemyToPoint(enemy, point);
  }

  /**
   * Move enemy along circular path (A→B→C→A)
   */
  function _moveEnemyCircular(enemy) {
    if (!enemy.path.points || enemy.path.points.length < 2) return;

    var currentIndex = (enemy.pathIndex || 0) + 1;
    if (currentIndex >= enemy.path.points.length) {
      currentIndex = 0;
    }

    enemy.pathIndex = currentIndex;
    var point = enemy.path.points[currentIndex];
    _moveEnemyToPoint(enemy, point);
  }

  /**
   * Move enemy along ellipse path
   */
  function _moveEnemyEllipse(enemy) {
    if (!enemy.path.ellipse) return;

    var angle = (enemy.pathAngle || 0) + 0.1; // Increment angle
    if (angle >= Math.PI * 2) angle = 0;

    enemy.pathAngle = angle;

    var cx = enemy.path.ellipse.cx;
    var cy = enemy.path.ellipse.cy;
    var rx = enemy.path.ellipse.rx;
    var ry = enemy.path.ellipse.ry;

    var x = Math.floor(cx + rx * Math.cos(angle));
    var y = Math.floor(cy + ry * Math.sin(angle));

    _moveEnemyToPoint(enemy, { x: x, y: y });
  }

  /**
   * Rotate enemy in place (change orientation)
   */
  function _rotateEnemyInPlace(enemy) {
    // Rotate orientation clockwise
    var orientations = ['north', 'east', 'south', 'west'];
    var currentIndex = orientations.indexOf(enemy.orientation || 'north');
    var nextIndex = (currentIndex + 1) % orientations.length;
    enemy.orientation = orientations[nextIndex];
  }

  /**
   * Move enemy to specific point (if not blocked)
   */
  function _moveEnemyToPoint(enemy, point) {
    // Check if point is valid and not blocked
    if (point.x < 0 || point.x >= GRID_WIDTH || point.y < 0 || point.y >= GRID_HEIGHT) return;
    if (_grid[point.y][point.x] === TILES.WALL) return;

    // Update orientation based on movement direction
    var dx = point.x - enemy.x;
    var dy = point.y - enemy.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      enemy.orientation = dx > 0 ? 'east' : 'west';
    } else {
      enemy.orientation = dy > 0 ? 'south' : 'north';
    }

    enemy.x = point.x;
    enemy.y = point.y;
  }

  /**
   * Update enemy awareness (decay over time)
   */
  function _updateEnemyAwareness(enemy, deltaMs) {
    if (!enemy.awareness) enemy.awareness = 0;

    // Decay awareness by 5 points per second
    var decay = (5 * deltaMs) / 1000;
    enemy.awareness = Math.max(0, enemy.awareness - decay);
  }

  /**
   * Increase enemy awareness
   */
  function _increaseEnemyAwareness(enemy, amount) {
    var previousAwareness = enemy.awareness || 0;
    enemy.awareness = Math.min(150, previousAwareness + amount);

    // Show alert expression when crossing into ALERTED state
    if (previousAwareness < AWARENESS_STATES.ALERTED.min && enemy.awareness >= AWARENESS_STATES.ALERTED.min) {
      if (typeof OverheadAnimator !== 'undefined') {
        OverheadAnimator.showExpression(enemy.x, enemy.y, 'ALERT', 1000);
      }
    }
  }

  /**
   * Get enemy awareness state
   */
  function _getEnemyAwarenessState(enemy) {
    var awareness = enemy.awareness || 0;

    if (awareness >= AWARENESS_STATES.ENGAGED.min) return AWARENESS_STATES.ENGAGED;
    if (awareness >= AWARENESS_STATES.ALERTED.min) return AWARENESS_STATES.ALERTED;
    if (awareness >= AWARENESS_STATES.SUSPICIOUS.min) return AWARENESS_STATES.SUSPICIOUS;
    return AWARENESS_STATES.UNAWARE;
  }

  /**
   * Get enemy awareness state (exposed for external use)
   */
  function getEnemyAwarenessState(enemy) {
    return _getEnemyAwarenessState(enemy);
  }

  /**
   * Rebuild _wallCache from the current grid.
   * Called once after each floor generation so the game loop doesn't need
   * to scan all 800 cells every tick to collect wall positions.
   */
  function _rebuildWallCache() {
    _wallCache = [];
    for (var wy = 0; wy < GRID_HEIGHT; wy++) {
      for (var wx = 0; wx < GRID_WIDTH; wx++) {
        if (_grid[wy][wx] === TILES.WALL) {
          _wallCache.push({ x: wx, y: wy });
        }
      }
    }
  }

  /**
   * Update player light based on inventory
   */
  function _updatePlayerLight() {
    if (typeof LightingSystem === 'undefined') return;

    // Check active item slot for light items (not inventory)
    var lightItem = null;

    if (typeof GAMESTATE !== 'undefined') {
      var activeItem = GAMESTATE.getActiveItem();

      // Only check active item slot for lighting items
      if (activeItem) {
        var itemName = activeItem.name ? activeItem.name.toLowerCase() : '';

        // Check for light items in active slot (priority order)
        if (itemName.indexOf('night vision') !== -1) {
          lightItem = 'NIGHT_VISION';
        } else if (itemName.indexOf('flashlight') !== -1) {
          lightItem = 'FLASHLIGHT';
        } else if (itemName.indexOf('lighter') !== -1) {
          lightItem = 'LIGHTER';
        }
      }
    }

    // Update lighting system
    LightingSystem.setPlayerLight(lightItem);
    LightingSystem.updatePlayerLight(_player.x, _player.y, _player.lastMoveDirection || 'north');
  }

  /**
   * Check if player is in enemy sight cone
   */
  function _isPlayerInSightCone(enemy) {
    if (!enemy.orientation) return false;

    var dx = _player.x - enemy.x;
    var dy = _player.y - enemy.y;

    // Cheap Manhattan-distance pre-filter: skip all expensive checks when
    // the player is definitely beyond the maximum possible sight range.
    // Max base sight range is 8; stealth can halve it but never extends it.
    var maxPossibleSightRange = (enemy.sightRange || 5) + 1;
    if (Math.abs(dx) > maxPossibleSightRange || Math.abs(dy) > maxPossibleSightRange) {
      return false;
    }

    var distanceSq = dx * dx + dy * dy;

    // Sight cone range (modified by player's tile stealth bonus)
    var baseSightRange = enemy.sightRange || 5;
    var stealthBonus = _getPlayerStealthBonus();
    var effectiveSightRange = baseSightRange * (1 - stealthBonus / 100);

    // Compare squared distances to avoid Math.sqrt
    if (distanceSq > effectiveSightRange * effectiveSightRange) return false;

    // Check if cover blocks line of sight
    if (_checkLineOfSight(enemy.x, enemy.y, _player.x, _player.y)) {
      return false; // LOS blocked by cover
    }

    // Calculate angle to player
    var angleToPlayer = Math.atan2(dy, dx);

    // Enemy orientation angles
    var orientationAngles = {
      'east': 0,
      'south': Math.PI / 2,
      'west': Math.PI,
      'north': -Math.PI / 2
    };

    var orientationAngle = orientationAngles[enemy.orientation] || 0;
    var coneAngle = Math.PI / 3; // 60 degree cone

    // Normalize angle difference
    var angleDiff = Math.abs(angleToPlayer - orientationAngle);
    while (angleDiff > Math.PI) angleDiff = Math.abs(angleDiff - 2 * Math.PI);

    return angleDiff <= coneAngle / 2;
  }

  /**
   * Get player stealth bonus from current tile
   */
  function _getPlayerStealthBonus() {
    // Return cached value if player hasn't moved since last computation.
    // The cache is keyed on player grid position — any tile change invalidates it.
    if (_stealthBonusCache &&
        _stealthBonusCache.px === _player.x &&
        _stealthBonusCache.py === _player.y) {
      return _stealthBonusCache.bonus;
    }

    var tile = _grid[_player.y][_player.x];
    var key = _player.x + ',' + _player.y;
    var metadata = _tileMetadata[key];

    var bonus = 0;

    // Tile-based stealth bonuses
    if (tile === TILES.SHADOW && metadata && metadata.stealthBonus) {
      bonus += metadata.stealthBonus; // 30%
    } else if (tile === TILES.GRASS && metadata && metadata.stealthBonus) {
      bonus += metadata.stealthBonus; // 20%
    } else if (tile === TILES.SMOKE && metadata && metadata.stealthBonus) {
      bonus += metadata.stealthBonus; // 40%
    }

    // Darkness-based stealth bonus (from lighting system)
    if (typeof LightingSystem !== 'undefined') {
      var darknessBonus = LightingSystem.getDarknessStealthBonus(_player.x, _player.y);
      bonus += darknessBonus; // 0-50% based on darkness
    }

    // Charm bonuses from inventory (charms work from inventory, not active slot)
    if (typeof GAMESTATE !== 'undefined') {
      var persistent = GAMESTATE.getPersistentInventory();
      var loose = GAMESTATE.getLooseInventory();
      var allItems = persistent.concat(loose);

      allItems.forEach(function(item) {
        if (item && item.category === 'charm' && item.stats && item.stats.stealth) {
          bonus += item.stats.stealth;
        }
      });
    }

    // Passive item bonuses (e.g., Cardboard Box)
    if (typeof PassiveItemsSystem !== 'undefined' && PassiveItemsSystem.getEquippedStealthBonus) {
      var passiveBonus = PassiveItemsSystem.getEquippedStealthBonus(_player.quality || 50);
      bonus += passiveBonus;
    }

    // Cache result for this player position
    _stealthBonusCache = { bonus: bonus, px: _player.x, py: _player.y };

    return bonus;
  }

  /**
   * Check if line of sight is blocked by cover
   * Returns true if blocked, false if clear
   */
  function _checkLineOfSight(x1, y1, x2, y2) {
    // Simple raycast to check for cover
    var dx = Math.abs(x2 - x1);
    var dy = Math.abs(y2 - y1);
    var sx = x1 < x2 ? 1 : -1;
    var sy = y1 < y2 ? 1 : -1;
    var err = dx - dy;

    var x = x1;
    var y = y1;

    while (!(x === x2 && y === y2)) {
      // Check if this tile blocks LOS
      if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
        var tile = _grid[y][x];
        if (tile === TILES.COVER || tile === TILES.WALL) {
          return true; // LOS blocked
        }
      }

      var e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }

    return false; // LOS clear
  }

  function _isInsideBounds(x, y) {
    return x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT;
  }

  function _getBreakableAt(x, y) {
    return _breakables.find(function(b) { return b.x === x && b.y === y; });
  }

  /**
   * Remove breakable at specific position (for environmental synergy system)
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {boolean} True if removed
   */
  function _removeBreakableAt(x, y) {
    var initialLength = _breakables.length;
    _breakables = _breakables.filter(function(b) {
      return !(b.x === x && b.y === y);
    });

    // Update grid tile if removed
    if (_breakables.length < initialLength && _grid[y] && _grid[y][x]) {
      _grid[y][x] = TILES.EMPTY;
    }

    return _breakables.length < initialLength;
  }

  function _damageBreakable(breakable, amount) {
    breakable.hp = Math.max(0, (breakable.hp || 0) - amount);

    // Track for highscore
    _totalBreakableDamage += amount;

    // Add hit animation state
    breakable.hitTime = Date.now();
    breakable.blinkCount = 0;

    if (breakable.hp === 0) {
      // Mark for destruction but delay it for animation
      breakable.destroying = true;
      breakable.destroyStartTime = Date.now();

      // Schedule the actual destruction after animation completes (2 blinks * 200ms each = 400ms)
      setTimeout(function() {
        if (breakable.destroying) {
          _grid[breakable.y][breakable.x] = breakable.destroyedGlyph || TILES.DEBRIS;
          breakable.destroying = false;

          // Use LootTableManager if available
          if (typeof LootTableManager !== 'undefined' && LootTableManager.rollBreakableLoot) {
            var breakableType = breakable.type || 'default';
            var currentBiome = _biome || 'COZY_FOREST';

            var rolledLoot = LootTableManager.rollBreakableLoot(breakableType, currentBiome);

            if (rolledLoot) {
              // Spawn currency
              if (rolledLoot.currency > 0) {
                _spawnCurrency(breakable.x, breakable.y, rolledLoot.currency);
              }

              // Spawn ammo
              if (rolledLoot.ammo > 0) {
                _items.push({
                  x: breakable.x,
                  y: breakable.y,
                  type: 'ammo',
                  amount: rolledLoot.ammo,
                  spawnTime: Date.now(),
                  decayTime: LootTableManager.getDecayTime('ammo') * 1000 || 60000,
                  emoji: '🔫',
                  name: 'Ammo (' + rolledLoot.ammo + ')'
                });
              }

              // Spawn items (cards, charms, etc.)
              if (rolledLoot.items && rolledLoot.items.length > 0) {
                rolledLoot.items.forEach(function(item) {
                  if (item.type === 'card' && item.card) {
                    _items.push({
                      x: breakable.x,
                      y: breakable.y,
                      type: 'card',
                      card: item.card,
                      spawnTime: Date.now(),
                      decayTime: LootTableManager.getDecayTime('card') * 1000 || 30000
                    });
                  } else if (item.type === 'charm' && item.card) {
                    _items.push({
                      x: breakable.x,
                      y: breakable.y,
                      type: 'charm',
                      card: item.card,
                      spawnTime: Date.now(),
                      decayTime: LootTableManager.getDecayTime('charm') * 1000 || 30000
                    });
                  } else {
                    // Generic item
                    _items.push({
                      x: breakable.x,
                      y: breakable.y,
                      type: item.type || 'item',
                      item: item,
                      emoji: item.emoji || '📦',
                      name: item.name || 'Item',
                      spawnTime: Date.now(),
                      decayTime: 60000
                    });
                  }
                });
              }
            }
          } else {
            // Fallback to hardcoded loot if LootTableManager not available
            // Drop currency (cryptos) when breakable is destroyed
            var dropChance = Math.random();
            if (dropChance < 0.7) { // 70% chance to drop currency
              var cryptoAmount = Math.floor(Math.random() * 3) + 1; // 1-3 cryptos
              _spawnCurrency(breakable.x, breakable.y, cryptoAmount);
            }

            // 60% chance to drop ammo (3/5 or 6/10 breakables contain ammo)
            // Average of 1.2 ammo per drop (1 or 2 ammo with weighted distribution)
            if (Math.random() < 0.6) {
              var ammoAmount = Math.random() < 0.8 ? 1 : 2; // 80% chance 1 ammo, 20% chance 2 ammo = 1.2 avg
              _items.push({
                x: breakable.x,
                y: breakable.y,
                type: 'ammo',
                amount: ammoAmount,
                spawnTime: Date.now(),
                decayTime: 60000, // 60 second decay for resources
                emoji: '🔫',
                name: 'Ammo (' + ammoAmount + ')'
              });
            }

            // 30% chance to drop a card
            if (Math.random() < 0.3 && typeof CardSystem !== 'undefined') {
              var baseType = CardSystem.getRandomBaseCard();
              var card = CardSystem.rollCard(baseType);
              if (card) {
                _items.push({
                  x: breakable.x,
                  y: breakable.y,
                  type: 'card',
                  card: card,
                  spawnTime: Date.now(),
                  decayTime: 30000 // 30 second decay
                });
              }
            }

            // 25% chance to drop a charm (similar frequency to cards)
            if (Math.random() < 0.25 && typeof CardSystem !== 'undefined') {
              var charm = CardSystem.rollCommonCharm();
              if (charm) {
                _items.push({
                  x: breakable.x,
                  y: breakable.y,
                  type: 'charm',
                  card: charm, // Reuse card structure for charms
                  spawnTime: Date.now(),
                  decayTime: 30000 // 30 second decay
                });
              }
            }
          }

          // Trigger re-render
          if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
            _updateMobileGrid();
          }
        }
      }, 400); // 2 blinks at 200ms each
    }
  }

  function _parseDirection(input) {
    var raw = (input || '').trim().split(/\s+/);
    var token = raw.length > 1 ? raw[1] : raw[0];

    var directions = {
      'n': { dx: 0, dy: -1, direction: 'north' },
      'north': { dx: 0, dy: -1, direction: 'north' },
      'u': { dx: 0, dy: -1, direction: 'north' },
      's': { dx: 0, dy: 1, direction: 'south' },
      'south': { dx: 0, dy: 1, direction: 'south' },
      'd': { dx: 0, dy: 1, direction: 'south' },
      'e': { dx: 1, dy: 0, direction: 'east' },
      'east': { dx: 1, dy: 0, direction: 'east' },
      'r': { dx: 1, dy: 0, direction: 'east' },
      'w': { dx: -1, dy: 0, direction: 'west' },
      'west': { dx: -1, dy: 0, direction: 'west' },
      'a': { dx: -1, dy: 0, direction: 'west' }
    };

    if (token && directions[token]) {
      return directions[token];
    }

    if (_player.lastMoveDirection && directions[_player.lastMoveDirection]) {
      return directions[_player.lastMoveDirection];
    }

    return directions['east'];
  }

  function _getProjectileGlyph(direction) {
    var glyphs = {
      'north': '↑',
      'south': '↓',
      'east': '→',
      'west': '←'
    };

    return glyphs[direction] || TILES.PROJECTILE;
  }

  function _fireProjectile(cmd) {
    var dir = _parseDirection(cmd);

    var projectile = {
      x: _player.x,
      y: _player.y,
      dx: dir.dx,
      dy: dir.dy,
      glyph: _getProjectileGlyph(dir.direction),
      emoji: '💥',
      range: 10,
      power: 2,
      owner: 'player'
    };

    // Add muzzle flash at player position
    _muzzleFlash = {
      x: _player.x,
      y: _player.y,
      time: Date.now()
    };

    // Auto-clear muzzle flash after 300ms
    setTimeout(function() {
      _muzzleFlash = null;
    }, 300);

    _projectiles.push(projectile);
    var action = _updateProjectiles(0, 1);
    _saveState();

    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      _updateMobileGrid();
    }

    if (action) {
      return action;
    }

    return {
      lines: ['FIRING ' + projectile.glyph + ' ' + dir.direction.toUpperCase(), ''].concat(_renderGrid()),
      prompt: getPrompt(),
      stayActive: true
    };
  }

  function _kickBreakable(cmd) {
    var dir = _parseDirection(cmd);
    var targetX = _player.x + dir.dx;
    var targetY = _player.y + dir.dy;
    var target = _getBreakableAt(targetX, targetY);

    if (!target || target.hp <= 0) {
      return {
        lines: ['NOTHING TO KICK THAT WAY', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    _damageBreakable(target, 2);
    _saveState();

    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      _updateMobileGrid();
    }

    return {
      lines: ['🥾 BOOTED ' + target.emoji + ' (HP ' + target.hp + ')', ''].concat(_renderGrid()),
      prompt: getPrompt(),
      stayActive: true
    };
  }

  function _updateProjectiles(deltaMs, steps) {
    var iterations = steps || 1;
    var action = null;

    for (var i = 0; i < iterations; i++) {
      var survivors = [];
      for (var j = 0; j < _projectiles.length; j++) {
        var result = _advanceProjectile(_projectiles[j]);
        if (result && result.action && !action) {
          action = result.action;
        }
        if (result && result.alive) {
          survivors.push(_projectiles[j]);
        }
      }
      _projectiles = survivors;
    }

    return action;
  }

  function _advanceProjectile(projectile) {
    if (!projectile) return { alive: false };

    var nextX = projectile.x + projectile.dx;
    var nextY = projectile.y + projectile.dy;

    if (!_isInsideBounds(nextX, nextY)) {
      // Miss - went out of bounds
      _addImpactEffect(projectile.x, projectile.y, 'miss');
      return { alive: false };
    }

    var tile = _grid[nextY][nextX];
    if (tile === TILES.WALL) {
      // Hit wall
      _addImpactEffect(nextX, nextY, 'wall');
      return { alive: false };
    }

    var breakable = _getBreakableAt(nextX, nextY);
    if (breakable && breakable.hp > 0) {
      _damageBreakable(breakable, projectile.power || 1);
      // Hit breakable
      _addImpactEffect(nextX, nextY, 'breakable');
      return { alive: false };
    }

    var enemy = _enemies.find(function(e) { return e.x === nextX && e.y === nextY && e.hp > 0; });
    if (enemy) {
      if (projectile.owner === 'player') {
        // Hit enemy
        _addImpactEffect(nextX, nextY, 'enemy');
        return { alive: false, action: _enterStrCombat(enemy, 'player_attack', projectile.card) };
      }
      enemy.hp = Math.max(0, enemy.hp - (projectile.power || 1));
      _addImpactEffect(nextX, nextY, 'enemy');
      return { alive: false };
    }

    var hitsPlayer = (_player.x === nextX && _player.y === nextY);
    if (hitsPlayer) {
      if (projectile.owner !== 'player') {
        var sourceEnemy = projectile.sourceEnemy || _enemies.find(function(e) { return e.hp > 0; });
        if (sourceEnemy) {
          return { alive: false, action: _enterStrCombat(sourceEnemy, 'enemy_attack') };
        }
      }
      return { alive: false };
    }

    projectile.x = nextX;
    projectile.y = nextY;
    projectile.range = (projectile.range || 1) - 1;

    // Check if projectile expired (ran out of range)
    if (projectile.range <= 0) {
      // Miss - expired without hitting anything
      _addImpactEffect(nextX, nextY, 'miss');
      return { alive: false };
    }

    return { alive: true };
  }

  /**
   * Add impact effect for rendering
   */
  function _addImpactEffect(x, y, type) {
    var effect = {
      x: x,
      y: y,
      type: type, // 'breakable', 'enemy', 'wall', 'miss'
      time: Date.now()
    };
    _impactEffects.push(effect);

    // Auto-clear this specific impact effect after 400ms
    setTimeout(function() {
      var index = _impactEffects.indexOf(effect);
      if (index > -1) {
        _impactEffects.splice(index, 1);
      }
    }, 400);
  }

  function stepProjectiles(steps) {
    var action = _updateProjectiles(0, steps || 1);

    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      _updateMobileGrid();
    }

    return {
      projectiles: _projectiles,
      breakables: _breakables,
      action: action
    };
  }

  function _saveState() {
    try {
      var state = {
        active: _active,
        player: _player,
        enemies: _enemies,
        items: _items,
        projectiles: _projectiles,
        breakables: _breakables,
        turn: _turn,
        floor: _floor
      };

      // Save interactive items
      if (typeof InteractiveItems !== 'undefined') {
        state.interactiveItems = InteractiveItems.serialize();
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* ignore */ }
  }

  function _loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (parsed.player) _player = parsed.player;
      if (parsed.enemies) _enemies = parsed.enemies;
      if (parsed.items) _items = parsed.items;
      if (parsed.projectiles) _projectiles = parsed.projectiles;
      if (parsed.breakables) _breakables = parsed.breakables;
      if (parsed.turn) _turn = parsed.turn;
      if (parsed.floor) _floor = parsed.floor;

      // Restore interactive items
      if (parsed.interactiveItems && typeof InteractiveItems !== 'undefined') {
        InteractiveItems.deserialize(parsed.interactiveItems);
      }

      // DO NOT restore active state - user must explicitly enter rogue mode
      _active = false;
    } catch (e) { /* ignore */ }
  }

  /**
   * Handle tap-to-move from mobile UI
   */
  function handleTapMove(targetX, targetY, runMode) {
    if (!_active) return;

    // Asteroids boss locks player movement — tap only activates cards
    if (_playerMoveLocked) {
      return {
        lines: ['⚓ GRAVITY ANCHOR — movement disabled. Use cards to fight!', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Check if clicking on a breakable - kick it instead of moving
    var breakableAtTarget = _getBreakableAt(targetX, targetY);
    if (breakableAtTarget && breakableAtTarget.hp > 0) {
      // Calculate direction to breakable
      var dx = targetX - _player.x;
      var dy = targetY - _player.y;

      // Only kick if adjacent (1 tile away)
      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx !== 0 || dy !== 0)) {
        _damageBreakable(breakableAtTarget, 2);
        _saveState();

        if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
          _updateMobileGrid();
        }

        return {
          lines: ['🥾 BOOTED ' + (breakableAtTarget.emoji || '📦') + ' (HP ' + breakableAtTarget.hp + ')', ''].concat(_renderGrid()),
          prompt: getPrompt(),
          stayActive: true
        };
      }
    }

    // Calculate path (simple: move one step towards target)
    var dx = targetX - _player.x;
    var dy = targetY - _player.y;

    // Normalize to -1, 0, or 1
    var stepX = dx === 0 ? 0 : (dx > 0 ? 1 : -1);
    var stepY = dy === 0 ? 0 : (dy > 0 ? 1 : -1);

    // Execute move
    var moveResult = _movePlayer(stepX, stepY, runMode);

    // Update mobile UI
    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      _updateMobileGrid();
    }

    return moveResult;
  }

  /**
   * Handle fishing move from mobile UI (smooth movement along path)
   */
  function handleFishingMove(path, isSprinting) {
    if (!_active) return;
    if (!path || path.length === 0) return;

    // Initialize movement system if not already
    if (typeof GoneRogueMovement !== 'undefined') {
      GoneRogueMovement.init(_player.x, _player.y);

      // Set target with collision checking and terrain penalty callbacks
      var collisionCheck = function(x, y) {
        return !_isWalkable(x, y);
      };

      // Attach getTileMovePenalty as a property of the callback function
      collisionCheck.getTileMovePenalty = function(x, y) {
        // Get tile at position
        if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return 0;
        var tile = _grid[y][x];

        // Check TILE_EFFECTS for move penalty
        if (tile === TILES.WATER && TILE_EFFECTS.WATER) {
          return TILE_EFFECTS.WATER.movePenalty || 0;
        }

        // Check tile metadata for custom penalties
        var key = x + ',' + y;
        if (_tileMetadata[key] && _tileMetadata[key].movePenalty) {
          return _tileMetadata[key].movePenalty;
        }

        return 0; // No penalty
      };

      var destination = path[path.length - 1];
      GoneRogueMovement.setTarget(destination.x, destination.y, collisionCheck, isSprinting);

      // Update mobile UI to start animation
      if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
        _updateMobileGrid();
      }

      return {
        lines: ['Moving...', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    } else {
      // Fallback to instant move
      return handleTapMove(path[path.length - 1].x, path[path.length - 1].y, isSprinting || false);
    }
  }

  /**
   * Check if position is walkable
   */
  function isWalkable(x, y) {
    return _isWalkable(x, y);
  }

  /**
   * Card swipe from mobile UI
   */
  function handleCardSwipe(cardIndex, direction) {
    if (!_active) return;

    // Get card from loose inventory
    var loose = typeof GAMESTATE !== 'undefined' ? GAMESTATE.getLooseInventory() : [];
    if (cardIndex < 0 || cardIndex >= loose.length) return;

    var card = loose[cardIndex];

    // Execute card action based on swipe direction
    var action = _getCardAction(card, direction);

    // Tooltip: Card deployment (if valid action)
    if (action.type !== 'none' && action.type !== 'discard' && typeof TooltipSystem !== 'undefined') {
      TooltipSystem.showAction('card-deploy', { name: card.name });
    }

    var result = _executeCardAction(action);

    // Update mobile UI
    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      _updateMobileGrid();
    }

    // Update reserve slots (hand may have changed)
    if (typeof ReserveSlots !== 'undefined') {
      _updateReserveSlots();
    }

    return result;
  }

  /**
   * Handle multiple card selection from mobile UI in STR combat
   * Executes all selected cards as player actions in a single combat round
   */
  function handleMultiCardCombat(cardIndices) {
    if (!_active || !_strCombatActive) return;
    if (!cardIndices || cardIndices.length === 0) return;

    // Get all cards from loose inventory
    var loose = typeof GAMESTATE !== 'undefined' ? GAMESTATE.getLooseInventory() : [];

    // Filter valid card indices and get card objects
    var playerCards = [];
    for (var i = 0; i < cardIndices.length; i++) {
      var idx = cardIndices[i];
      if (idx >= 0 && idx < loose.length) {
        playerCards.push(loose[idx]);
      }
    }

    if (playerCards.length === 0) return;

    // Execute multi-card combat round
    return _executeMultiCardRound(playerCards);
  }

  /**
   * Map swipe direction to card action
   */
  function _getCardAction(card, direction) {
    // Direction mapping:
    // up = use/apply
    // down = discard
    // left = defensive
    // right = offensive

    var category = typeof CardSystem !== 'undefined' ? CardSystem.getCardCategory(card) : card.type;

    // Interrupt cards (up/right/left)
    if (category === 'interrupt') {
      if (direction === 'up' || direction === 'right' || direction === 'left') {
        return { type: 'interrupt', card: card };
      }
    }
    // Defense cards (up/left)
    else if (category === 'defense' || card.type === 'stance') {
      if (direction === 'up' || direction === 'left') {
        return { type: 'defense', card: card };
      }
    }
    // Movement cards (up/left/right)
    else if (category === 'movement') {
      if (direction === 'up' || direction === 'left' || direction === 'right') {
        return { type: 'movement', card: card };
      }
    }
    // Attack cards (up/right)
    else if (category === 'attack' || card.type === 'attack') {
      if (direction === 'up' || direction === 'right') {
        return { type: 'attack', card: card };
      }
    }
    // Setup/Utility cards (up)
    else if (category === 'setup' || card.type === 'utility') {
      if (direction === 'up') {
        return { type: 'use', card: card };
      }
    }

    if (direction === 'down') {
      return { type: 'discard', card: card };
    }

    return { type: 'none' };
  }

  /**
   * Execute card action
   */
  function _executeCardAction(action) {
    if (!action || action.type === 'none') {
      return {
        lines: ['INVALID SWIPE', ''],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // All combat actions now route through the same handlers
    if (action.type === 'attack' || action.type === 'interrupt') {
      return _performAttack(action.card);
    } else if (action.type === 'defense' || action.type === 'stance' || action.type === 'movement') {
      return _performStance(action.card);
    } else if (action.type === 'use') {
      return _useUtility(action.card);
    } else if (action.type === 'discard') {
      return _discardCard(action.card);
    }

    return {
      lines: [''],
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Perform attack with card
   */
  function _performAttack(card) {
    // Tooltip: Attacking
    if (typeof TooltipSystem !== 'undefined') {
      TooltipSystem.showAction('attack');
    }

    // If already in STR combat, use simultaneous resolution
    if (_strCombatActive) {
      var enemyCard = _getEnemyAICard();
      return _executeSimultaneousRound(card, enemyCard);
    }

    // Find nearest enemy
    var nearest = _findNearestEnemy();
    if (!nearest) {
      return {
        lines: ['NO ENEMIES IN RANGE', ''],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Trigger STR combat mode with player-initiated attack
    return _enterStrCombat(nearest, 'player_attack', card);
  }

  /**
   * Perform stance with card
   */
  function _performStance(card) {
    // If in STR combat, use simultaneous resolution
    if (_strCombatActive) {
      var enemyCard = _getEnemyAICard();
      return _executeSimultaneousRound(card, enemyCard);
    }

    // Outside combat: apply stance benefits
    _player.stealth += (card.stats.stealth || 1);
    _turn++;
    _saveState();

    return {
      lines: ['STANCE: ' + card.name.toUpperCase(), 'STEALTH +' + (card.stats.stealth || 1), ''].concat(_renderGrid()),
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Use utility card
   */
  function _useUtility(card) {
    var effects = [];
    
    // Health restoration
    if (card.stats.hp) {
      _player.hp = Math.min(_player.maxHp, _player.hp + card.stats.hp);
      effects.push('HP +' + card.stats.hp);
    }
    
    // Energy restoration
    if (card.stats.energyBoost) {
      if (typeof GAMESTATE !== 'undefined' && GAMESTATE.addEnergy) {
        GAMESTATE.addEnergy(card.stats.energyBoost);
        effects.push('ENERGY +' + card.stats.energyBoost);
      }
    }
    
    // Fatigue reduction
    if (card.stats.fatigueReduction) {
      if (typeof GAMESTATE !== 'undefined' && GAMESTATE.reduceFatigue) {
        GAMESTATE.reduceFatigue(card.stats.fatigueReduction);
        effects.push('FATIGUE -' + card.stats.fatigueReduction);
      }
    }
    
    // Battery recharge
    if (card.stats.batteryRecharge) {
      if (typeof GAMESTATE !== 'undefined' && GAMESTATE.rechargeBattery) {
        GAMESTATE.rechargeBattery(card.stats.batteryRecharge);
        effects.push('BATTERY +' + card.stats.batteryRecharge);
      }
    }
    
    // Focus boost
    if (card.stats.focusBoost) {
      if (typeof GAMESTATE !== 'undefined' && GAMESTATE.addFocus) {
        GAMESTATE.addFocus(card.stats.focusBoost);
        effects.push('FOCUS +' + card.stats.focusBoost);
      }
    }
    
    // Ammo restoration
    if (card.stats.ammoRestore) {
      if (typeof GAMESTATE !== 'undefined' && GAMESTATE.addAmmo) {
        GAMESTATE.addAmmo(card.stats.ammoRestore);
        effects.push('AMMO +' + card.stats.ammoRestore);
      }
    }

    // Check for wrong item in safe zone trigger
    var floorType = _getFloorType(_floor);
    if (floorType === FLOOR_TYPES.BONFIRE && typeof SecretFloors !== 'undefined') {
      // Using combat cards or certain items in safe zones can trigger secret floors
      var hasSecretTag = card.category === 'attack' || card.category === 'interrupt' || card.type === 'attack';

      if (hasSecretTag) {
        var triggerResult = SecretFloors.triggerSecretFloor(
          SecretFloors.TRIGGER_TYPES.WRONG_ITEM_SAFE_ZONE,
          {
            inSafeZone: true,
            itemHasSecretTag: true
          }
        );

        if (triggerResult.success) {
          // Secret floor will trigger on next elevator use
          console.log('[GoneRogue] Wrong item in safe zone triggered secret floor');
        }
      }
    }

    _turn++;
    _saveState();

    var effectsMsg = effects.length > 0 ? effects.join(', ') : '';
    return {
      lines: ['USED: ' + card.name.toUpperCase(), effectsMsg, ''].concat(_renderGrid()),
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Discard card
   */
  function _discardCard(card) {
    // Remove from loose inventory (handled by GAMESTATE)
    return {
      lines: ['DISCARDED: ' + card.name, ''],
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Find nearest enemy to player
   */
  function _findNearestEnemy() {
    var nearest = null;
    var minDist = Infinity;

    _enemies.forEach(function(enemy) {
      if (enemy.hp <= 0) return;

      var dist = Math.abs(enemy.x - _player.x) + Math.abs(enemy.y - _player.y);
      if (dist < minDist && dist <= 5) {
        minDist = dist;
        nearest = enemy;
      }
    });

    return nearest;
  }

  // ============================================================
  // STR COMBAT SYSTEM (Simultaneous Turn Resolution)
  // ============================================================

  /**
   * Enter STR combat mode
   * @param {Object} enemy - Enemy to engage in combat
   * @param {String} trigger - How combat was triggered ('collision', 'player_attack', 'enemy_attack')
   * @param {Object} card - Optional card used to initiate combat
   */
  function _enterStrCombat(enemy, trigger, card) {
    // Break passive items that break on combat
    if (typeof PassiveItemsSystem !== 'undefined' && PassiveItemsSystem.checkAndBreakItems) {
      PassiveItemsSystem.checkAndBreakItems('combat');
    }

    // Freeze realtime game loop
    if (_gameLoopActive) {
      _pauseGameLoop();
    }

    // Check for combat in no-combat zone trigger (bonfire floors)
    var floorType = _getFloorType(_floor);
    if (floorType === FLOOR_TYPES.BONFIRE && typeof SecretFloors !== 'undefined') {
      var triggerResult = SecretFloors.triggerSecretFloor(
        SecretFloors.TRIGGER_TYPES.COMBAT_NO_COMBAT_ZONE,
        {
          inNoCombatZone: true
        }
      );

      if (triggerResult.success) {
        // Secret floor will trigger on next elevator use
        console.log('[GoneRogue] Combat in no-combat zone triggered secret floor');
      }
    }

    // Track combat entry for mythic conditions
    _player.combatEntries++;

    // Initialize combat state
    _strCombatActive = true;
    _strCombatEnemy = enemy;
    _strCombatRound = 0;
    _strCombatLog = [];
    _strCombatAmmoSpent = 0; // Reset ammo tracking for this encounter

    // Initialize enemy intent state if system available
    if (typeof EnemyIntentSystem !== 'undefined') {
      var enemyNextCard = _getEnemyAICard();
      enemy.intentState = EnemyIntentSystem.createIntentState(enemy, enemyNextCard);
    }

    // Tooltip: Engaging enemy
    if (typeof TooltipSystem !== 'undefined') {
      TooltipSystem.showAction('combat-enter');
    }

    // Calculate advantage state
    _strCombatAdvantage = _calculateAdvantage(_player, enemy, trigger);

    // Update intent based on advantage (ambush reaction)
    if (typeof EnemyIntentSystem !== 'undefined' && _strCombatAdvantage === 'ambush') {
      enemy.intentState.expression = EnemyIntentSystem.onCombatEvent(enemy, 'ambushed');
    }

    // Scan 3x3 tiles around player for ground effects and apply combat modifiers
    _applyGroundEffectModifiers();

    // Build countdown context messages (3/2/1 beat annotations)
    _strCombatContext = _buildCountdownMessages(enemy, trigger);

    // Add combat entry message with emoji
    var advantageEmoji = _getAdvantageEmoji(_strCombatAdvantage);
    _strCombatLog.push('⚔️  STR COMBAT INITIATED ' + advantageEmoji);
    _strCombatLog.push('└─ Advantage: ' + _strCombatAdvantage.toUpperCase());
    _strCombatLog.push('');

    // Apply initiative rules
    var playerGoesFirst = false;
    if (_strCombatAdvantage === 'ambush') {
      _strCombatLog.push('🎯 PLAYER AMBUSH! Free opening attack!');
      playerGoesFirst = true;
    } else if (_strCombatAdvantage === 'flanked' || _strCombatAdvantage === 'disadvantaged') {
      _strCombatLog.push('⚠️  ENEMY HAS ADVANTAGE! They attack first!');
      playerGoesFirst = false;
    } else {
      playerGoesFirst = _player.initiative >= (enemy.initiative || 0);
    }

    // Enable combat zoom/focus for both desktop and mobile
    _enableCombatZoom();

    // Execute first round
    if (playerGoesFirst && trigger === 'player_attack' && card) {
      // Player initiated with attack card
      return _executeStrRound('player', card);
    } else if (!playerGoesFirst) {
      // Enemy goes first
      return _executeStrRound('enemy');
    } else {
      // Show combat UI and wait for player action
      return _showStrCombatUI();
    }
  }

  /**
   * Calculate advantage state based on positioning and awareness
   */
  function _calculateAdvantage(player, enemy, trigger) {
    var distance = _distanceBetween(player, enemy);
    var bracket = _getDistanceBracket(distance);
    var enemyAware = (enemy.awareness || 0) >= AWARENESS_STATES.SUSPICIOUS.min;
    var playerInitiated = trigger === 'player_attack' || trigger === 'collision';
    var enemyInitiated = trigger === 'enemy_attack' || trigger === 'enemy_sighting' || trigger === 'enemy_projectile';

    // Player Ambush: attacking from stealth or behind at melee
    if (playerInitiated && bracket === 'melee' && !enemyAware) {
      return 'ambush';
    }

    // Check if player is attacking from behind (flanking)
    var isFlanking = _checkFlanking(player, enemy);
    if (playerInitiated && isFlanking) {
      return 'ambush';
    }

    // Check if player is flanked/disadvantaged
    var playerFlanked = _checkFlanking(enemy, player);
    if (enemyInitiated && bracket === 'melee' && playerFlanked) {
      return 'flanked';
    }

    // Enemy alerted = player disadvantaged
    if (enemyInitiated && enemy.awareness >= 70) {
      return 'disadvantaged';
    }

    // Default: neutral
    return 'neutral';
  }

  /**
   * Check if attacker is flanking target based on facing and approach direction
   */
  function _checkFlanking(attacker, target) {
    var opposites = {
      'north': 'south',
      'south': 'north',
      'east': 'west',
      'west': 'east'
    };

    var targetFacing = target.orientation || target.lastMoveDirection;
    if (!targetFacing) return false;

    // Approach direction: use attacker last move if present, otherwise relative position
    var approachDirection = attacker.lastMoveDirection;
    if (!approachDirection && typeof attacker.x === 'number' && typeof target.x === 'number') {
      var dx = target.x - attacker.x;
      var dy = target.y - attacker.y;
      if (Math.abs(dx) > Math.abs(dy)) {
        approachDirection = dx > 0 ? 'east' : 'west';
      } else if (Math.abs(dy) > 0) {
        approachDirection = dy > 0 ? 'south' : 'north';
      }
    }

    if (!approachDirection) return false;

    var opposite = opposites[targetFacing];
    return approachDirection === opposite;
  }

  /**
   * Get emoji for advantage state
   */
  function _getAdvantageEmoji(advantage) {
    switch (advantage) {
      case 'ambush': return '🎯';
      case 'neutral': return '⚔️';
      case 'disadvantaged': return '⚠️';
      case 'flanked': return '❌';
      default: return '⚔️';
    }
  }

  function _distanceBetween(a, b) {
    return Math.abs((a.x || 0) - (b.x || 0)) + Math.abs((a.y || 0) - (b.y || 0));
  }

  function _getDistanceBracket(distance) {
    if (distance <= 1) return 'melee';
    if (distance <= 3) return 'close';
    if (distance <= 6) return 'mid';
    return 'far';
  }

  /**
   * Execute a round of STR combat with simultaneous resolution
   * @param {Object} playerCard - Card player is using
   * @param {Object} enemyCard - Card enemy is using (from AI)
   */
  function _executeSimultaneousRound(playerCard, enemyCard) {
    _strCombatRound++;

    var actions = [];

    // Create player action
    if (playerCard) {
      var category = typeof CardSystem !== 'undefined' ? CardSystem.getCardCategory(playerCard) : 'attack';
      var priority = typeof CardSystem !== 'undefined' ? CardSystem.getCardPriority(category) : 4;
      var speed = (playerCard.stats && playerCard.stats.speed) || _player.initiative || 0;
      
      actions.push({
        actor: 'player',
        card: playerCard,
        category: category,
        priority: priority,
        speed: speed
      });
    }

    // Create enemy action (simplified AI)
    if (enemyCard) {
      var enemyCategory = typeof CardSystem !== 'undefined' ? CardSystem.getCardCategory(enemyCard) : 'attack';
      var enemyPriority = typeof CardSystem !== 'undefined' ? CardSystem.getCardPriority(enemyCategory) : 4;
      var enemySpeed = (enemyCard.stats && enemyCard.stats.speed) || _strCombatEnemy.initiative || 0;
      
      actions.push({
        actor: 'enemy',
        card: enemyCard,
        category: enemyCategory,
        priority: enemyPriority,
        speed: enemySpeed
      });
    }

    // Sort by priority (lower priority number executes first), then by speed (higher speed breaks ties)
    actions.sort(function(a, b) {
      if (a.priority !== b.priority) {
        return a.priority - b.priority; // Lower priority executes first
      }
      return b.speed - a.speed; // Higher speed breaks ties
    });

    // Execute actions in order
    var lines = [];
    lines.push('═══ ROUND ' + _strCombatRound + ' RESOLUTION ═══');
    lines.push('');

    for (var i = 0; i < actions.length; i++) {
      var action = actions[i];
      var result = _resolveAction(action);
      
      if (result && result.lines) {
        lines = lines.concat(result.lines);
      }

      // Check for combat end conditions
      if (_strCombatEnemy.hp <= 0) {
        lines.push('');
        lines.push('💀 ENEMY DEFEATED!');
        _enemiesKilled++; // Track for highscore
        var exitResult = _exitStrCombat('player_victory');
        return {
          lines: lines.concat(exitResult.lines || []),
          stayActive: exitResult.stayActive
        };
      }

      if (_player.hp <= 0) {
        lines.push('');
        lines.push('💀 YOU HAVE BEEN DEFEATED...');
        return _handlePlayerDeath('combat_damage', { enemy: _strCombatEnemy });
      }
    }

    // Continue combat
    lines.push('');
    lines.push('═══════════════════════════');
    lines.push('');

    // Update enemy intent for next round
    if (typeof EnemyIntentSystem !== 'undefined' && _strCombatEnemy.intentState) {
      var nextEnemyCard = _getEnemyAICard();
      _strCombatEnemy.intentState = EnemyIntentSystem.createIntentState(_strCombatEnemy, nextEnemyCard);
    }

    return _showStrCombatUIWithLog(lines);
  }

  /**
   * Execute a multi-card combat round (player plays multiple cards, enemy plays one)
   * @param {Array} playerCards - Array of cards player is using
   */
  function _executeMultiCardRound(playerCards) {
    _strCombatRound++;

    var actions = [];

    // Create player actions for each selected card
    for (var i = 0; i < playerCards.length; i++) {
      var card = playerCards[i];
      var category = typeof CardSystem !== 'undefined' ? CardSystem.getCardCategory(card) : 'attack';
      var priority = typeof CardSystem !== 'undefined' ? CardSystem.getCardPriority(category) : 4;
      var speed = (card.stats && card.stats.speed) || _player.initiative || 0;

      actions.push({
        actor: 'player',
        card: card,
        category: category,
        priority: priority,
        speed: speed
      });
    }

    // Get enemy AI card
    var enemyCard = _getEnemyAICard();
    if (enemyCard) {
      var enemyCategory = typeof CardSystem !== 'undefined' ? CardSystem.getCardCategory(enemyCard) : 'attack';
      var enemyPriority = typeof CardSystem !== 'undefined' ? CardSystem.getCardPriority(enemyCategory) : 4;
      var enemySpeed = (enemyCard.stats && enemyCard.stats.speed) || _strCombatEnemy.initiative || 0;

      actions.push({
        actor: 'enemy',
        card: enemyCard,
        category: enemyCategory,
        priority: enemyPriority,
        speed: enemySpeed
      });
    }

    // Sort by priority (lower executes first), then by speed (higher breaks ties)
    actions.sort(function(a, b) {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return b.speed - a.speed;
    });

    // Execute actions in order
    var lines = [];
    lines.push('═══ ROUND ' + _strCombatRound + ' RESOLUTION ═══');
    lines.push('💥 MULTI-CARD COMBO: ' + playerCards.length + ' cards');
    lines.push('');

    for (var j = 0; j < actions.length; j++) {
      var action = actions[j];
      var result = _resolveAction(action);

      if (result && result.lines) {
        lines = lines.concat(result.lines);
      }

      // Check for combat end conditions
      if (_strCombatEnemy.hp <= 0) {
        lines.push('');
        lines.push('💀 ENEMY DEFEATED!');
        _enemiesKilled++;
        var exitResult = _exitStrCombat('player_victory');
        return {
          lines: lines.concat(exitResult.lines || []),
          stayActive: exitResult.stayActive
        };
      }

      if (_player.hp <= 0) {
        lines.push('');
        lines.push('💀 YOU HAVE BEEN DEFEATED...');
        return _handlePlayerDeath('combat_damage', { enemy: _strCombatEnemy });
      }
    }

    // Continue combat
    lines.push('');
    lines.push('═══════════════════════════');
    lines.push('');

    // Update enemy intent for next round
    if (typeof EnemyIntentSystem !== 'undefined' && _strCombatEnemy.intentState) {
      var nextEnemyCard = _getEnemyAICard();
      _strCombatEnemy.intentState = EnemyIntentSystem.createIntentState(_strCombatEnemy, nextEnemyCard);
    }

    return _showStrCombatUIWithLog(lines);
  }

  /**
   * Resolve a single action in the priority queue
   * @param {Object} action - Action object with actor, card, category, priority, speed
   */
  function _resolveAction(action) {
    var lines = [];
    var actor = action.actor === 'player' ? _player : _strCombatEnemy;
    var target = action.actor === 'player' ? _strCombatEnemy : _player;
    var card = action.card;
    var category = action.category;

    // Display action header with priority indicator
    var priorityLabel = {
      interrupt: '🚨 INTERRUPT',
      defense: '🛡️  DEFENSE',
      movement: '🏃 MOVEMENT',
      attack: '⚔️  ATTACK',
      setup: '🔧 SETUP'
    }[category] || '❓ ACTION';

    var actorName = action.actor === 'player' ? 'PLAYER' : 'ENEMY';

    // Add enemy intent expression if available
    var expressionGlyph = '';
    if (action.actor === 'enemy' && typeof EnemyIntentSystem !== 'undefined' && _strCombatEnemy.intentState) {
      expressionGlyph = ' [' + _strCombatEnemy.intentState.expression.glyph + ']';
    }

    lines.push(priorityLabel + ' — ' + actorName + expressionGlyph + ': ' + card.emoji + ' ' + card.name);

    // Resolve based on category
    switch (category) {
      case 'interrupt':
        lines = lines.concat(_resolveInterruptAction(actor, target, card));
        break;
      case 'defense':
        lines = lines.concat(_resolveDefenseAction(actor, target, card));
        break;
      case 'movement':
        lines = lines.concat(_resolveMovementAction(actor, target, card));
        break;
      case 'attack':
        lines = lines.concat(_resolveAttackAction(actor, target, card));
        break;
      case 'setup':
        lines = lines.concat(_resolveSetupAction(actor, target, card));
        break;
      default:
        lines.push('└─ Unknown action type');
    }

    lines.push('');
    return { lines: lines };
  }

  /**
   * Resolve interrupt action
   */
  function _resolveInterruptAction(actor, target, card) {
    var lines = [];

    // Track last card type for boss mythic conditions
    if (actor === _player) {
      _player.lastCardType = card.type || card.name;
    }

    // Boss-specific card interactions for interrupt cards
    if (_bossFloorActive && _activeBoss && actor === _player) {
      var bossInteraction = _handleBossCardInteraction(card, target);
      if (bossInteraction.handled) {
        return bossInteraction.lines;
      }
    }

    // Interrupt actions execute before other actions
    if (card.name === 'Dive for Cover') {
      var defense = card.stats.defense || 5;
      var evasion = card.stats.evasion || 3;
      actor.tempDefense = (actor.tempDefense || 0) + defense;
      actor.tempEvasion = (actor.tempEvasion || 0) + evasion;
      lines.push('├─ Gained +' + defense + ' defense, +' + evasion + ' evasion');
    } else if (card.name === 'Jam Weapon') {
      target.weaponJammed = true;
      lines.push('├─ Target\'s weapon jammed! Next attack canceled');
    } else if (card.name === 'Overwatch Shot') {
      // Immediate attack with bonus
      var damage = card.stats.damage || 3;
      target.hp -= damage;
      lines.push('├─ Dealt ' + damage + ' damage (preemptive strike)');
      lines.push('└─ Target HP: ' + Math.max(0, target.hp) + '/' + (target.maxHp || 5));
    } else {
      lines.push('└─ Interrupt executed');
    }

    return lines;
  }

  /**
   * Resolve defense action
   */
  function _resolveDefenseAction(actor, target, card) {
    var lines = [];
    
    var defense = card.stats.defense || 0;
    var evasion = card.stats.evasion || 0;
    
    if (defense > 0) {
      actor.tempDefense = (actor.tempDefense || 0) + defense;
      lines.push('├─ Gained +' + defense + ' defense');
    }
    if (evasion > 0) {
      actor.tempEvasion = (actor.tempEvasion || 0) + evasion;
      lines.push('├─ Gained +' + evasion + ' evasion');
    }
    
    var stealth = card.stats.stealth || 0;
    if (stealth > 0) {
      actor.stealth = Math.min((actor.maxStealth || 5), (actor.stealth || 0) + stealth);
      lines.push('└─ Stealth increased');
    }
    
    return lines;
  }

  /**
   * Resolve movement action
   */
  function _resolveMovementAction(actor, target, card) {
    var lines = [];
    
    var distance = card.stats.distance || 0;
    var evasion = card.stats.evasion || 0;
    
    if (distance !== 0) {
      // Movement affects distance (abstracted in STR combat)
      lines.push('├─ Position adjusted (' + (distance > 0 ? 'closing' : 'retreating') + ')');
    }
    
    if (evasion > 0) {
      actor.tempEvasion = (actor.tempEvasion || 0) + evasion;
      lines.push('└─ Gained +' + evasion + ' evasion from movement');
    }
    
    return lines;
  }

  /**
   * Resolve attack action
   */
  function _resolveAttackAction(actor, target, card) {
    var lines = [];

    // Track last card type for boss mythic conditions
    if (actor === _player) {
      _player.lastCardType = card.type || card.name;
    }

    // Check if weapon is jammed
    if (actor.weaponJammed) {
      lines.push('└─ Attack failed! Weapon is jammed');
      actor.weaponJammed = false; // Clear jam
      return lines;
    }

    // Boss-specific card interactions
    if (_bossFloorActive && _activeBoss && actor === _player) {
      var bossInteraction = _handleBossCardInteraction(card, target);
      if (bossInteraction.handled) {
        return bossInteraction.lines;
      }
    }

    // Calculate hit with target's temp evasion
    var advantage = actor === _player ? _strCombatAdvantage :
                    (_strCombatAdvantage === 'ambush' ? 'flanked' :
                     _strCombatAdvantage === 'flanked' ? 'ambush' : 'neutral');

    var hitResult = _calculateHit(actor, target, advantage);
    var evasionBonus = (target.tempEvasion || 0) * 5; // Each evasion point = 5% miss chance
    hitResult.target += evasionBonus;

    // Check if attack hit (considering evasion)
    if (!hitResult.hit || hitResult.roll < hitResult.target) {
      lines.push('├─ MISS! (Roll: ' + hitResult.roll + ' vs ' + hitResult.target + ')');
      if (evasionBonus > 0) {
        lines.push('└─ Target evaded with +' + evasionBonus + '% evasion bonus');
      }
      return lines;
    }

    // Calculate damage reduced by defense
    var damageResult = _calculateDamage(actor, target, advantage, card, hitResult.crit);
    var defenseReduction = (target.tempDefense || 0);
    var finalDamage = Math.max(1, damageResult.damage - defenseReduction);

    target.hp -= finalDamage;

    // Update enemy intent expression when taking damage
    if (target === _strCombatEnemy && typeof EnemyIntentSystem !== 'undefined' && _strCombatEnemy.intentState) {
      _strCombatEnemy.intentState.expression = EnemyIntentSystem.onCombatEvent(_strCombatEnemy, 'took_damage');
    }

    // Track damage for highscore (only player damage to enemies)
    if (actor === _player && target === _strCombatEnemy) {
      _totalDamageDealt += finalDamage;
      if (finalDamage > _maxSingleHit) {
        _maxSingleHit = finalDamage;
      }
    }
    // Track damage mitigation (only enemy attacks on player)
    if (actor === _strCombatEnemy && target === _player && defenseReduction > 0) {
      _damageMitigated += defenseReduction;
    }

    var critEmoji = hitResult.crit ? ' 💥 CRIT!' : '';
    lines.push('├─ HIT!' + critEmoji + ' (Roll: ' + hitResult.roll + ' vs ' + hitResult.target + ')');
    lines.push('├─ Damage: ' + damageResult.damage + (defenseReduction > 0 ? ' - ' + defenseReduction + ' defense' : ''));
    lines.push('└─ Final: ' + finalDamage + ' damage → Target HP: ' + Math.max(0, target.hp) + '/' + (target.maxHp || 5));

    return lines;
  }

  /**
   * Resolve setup/utility action
   */
  function _resolveSetupAction(actor, target, card) {
    var lines = [];

    // Track last card type for boss mythic conditions
    if (actor === _player) {
      _player.lastCardType = card.type || card.name;
    }

    // Boss-specific card interactions for setup cards
    if (_bossFloorActive && _activeBoss && actor === _player) {
      var bossInteraction = _handleBossCardInteraction(card, target);
      if (bossInteraction.handled) {
        return bossInteraction.lines;
      }
    }

    var hp = card.stats.hp || 0;
    if (hp > 0) {
      actor.hp = Math.min((actor.maxHp || 10), actor.hp + hp);
      lines.push('├─ Healed ' + hp + ' HP → ' + actor.hp + '/' + (actor.maxHp || 10));
    }

    // Use camelCase stat names
    var attackBoost = card.stats.attackBoost || card.stats.attack_boost || 0;
    if (attackBoost > 0) {
      actor.tempAttackBoost = (actor.tempAttackBoost || 0) + attackBoost;
      lines.push('├─ Gained +' + attackBoost + ' attack power (next turn)');
    }

    var speedBoost = card.stats.speedBoost || card.stats.speed_boost || 0;
    if (speedBoost > 0) {
      actor.tempSpeedBoost = (actor.tempSpeedBoost || 0) + speedBoost;
      lines.push('├─ Gained +' + speedBoost + ' speed (next turn)');
    }

    var accuracyBoost = card.stats.accuracyBoost || card.stats.accuracy_boost || 0;
    if (accuracyBoost > 0) {
      actor.tempAccuracyBoost = (actor.tempAccuracyBoost || 0) + accuracyBoost;
      lines.push('└─ Gained +' + accuracyBoost + '% accuracy (next turn)');
    }

    return lines;
  }

  /**
   * Handle boss-specific card interactions
   */
  function _handleBossCardInteraction(card, target) {
    var lines = [];
    var handled = false;

    if (!_activeBoss) {
      return { handled: false, lines: [] };
    }

    var cardName = card.name;
    var gameState = {
      player: _player,
      enemy: target,
      grid: _grid,
      bossEnvironment: _bossEnvironment
    };

    // LURE card interaction
    if (cardName === 'Lure') {
      handled = true;
      lines.push('├─ Using LURE on boss...');
      var playerAction = {
        type: 'LURE',
        target: 'TRAIN_PATH',
        card: card
      };
      var exploitResult = _activeBoss.checkExploit(playerAction, gameState);
      if (exploitResult.exploited) {
        lines.push('├─ ' + exploitResult.message);
        if (exploitResult.damage) {
          target.hp = Math.max(0, target.hp - exploitResult.damage);
          lines.push('└─ Boss HP: ' + target.hp + '/' + _activeBoss.maxHp);
        }
      } else {
        lines.push('└─ Lure had no effect (boss not in position)');
      }
    }

    // GRENADE card interaction
    else if (cardName === 'Grenade') {
      handled = true;
      lines.push('├─ Throwing Grenade at boss environment...');
      var playerAction = {
        type: 'Grenade',
        targetX: target.x || 20,
        targetY: target.y || 10,
        card: card
      };
      var exploitResult = _activeBoss.checkExploit(playerAction, gameState);
      if (exploitResult.exploited) {
        lines.push('├─ ' + exploitResult.message);
        if (exploitResult.shieldDown || exploitResult.bunkerDown) {
          // Environmental damage - apply some damage to boss
          var damage = card.stats.damage || 6;
          target.hp = Math.max(0, target.hp - damage);
          lines.push('└─ Boss HP: ' + target.hp + '/' + _activeBoss.maxHp);
        }
      } else {
        // Standard grenade damage
        var damage = card.stats.damage || 6;
        target.hp = Math.max(0, target.hp - damage);
        lines.push('├─ Grenade explodes! ' + damage + ' damage');
        lines.push('└─ Boss HP: ' + target.hp + '/' + _activeBoss.maxHp);
      }
    }

    // JAMMER card interaction
    else if (cardName === 'Jammer') {
      handled = true;
      lines.push('├─ Activating JAMMER on boss systems...');
      var playerAction = {
        type: 'JAMMER',
        card: card
      };
      var exploitResult = _activeBoss.checkExploit(playerAction, gameState);
      if (exploitResult.exploited) {
        lines.push('├─ ' + exploitResult.message);
        lines.push('└─ Boss systems disrupted!');
      } else {
        target.weaponJammed = true;
        lines.push('└─ Boss weapon systems jammed for 1 turn');
      }
    }

    // VIRUS card interaction
    else if (cardName === 'Virus') {
      handled = true;
      lines.push('├─ Uploading VIRUS to boss systems...');
      var damage = card.stats.damage || 2;
      target.hp = Math.max(0, target.hp - damage);
      target.virusDOT = (card.stats.dot || 3);
      target.virusDuration = (card.stats.duration || 3);
      lines.push('├─ Initial damage: ' + damage);
      lines.push('├─ Virus will deal ' + target.virusDOT + ' damage for ' + target.virusDuration + ' turns');
      lines.push('└─ Boss HP: ' + target.hp + '/' + _activeBoss.maxHp);
    }

    // HIGH_GROUND card interaction
    else if (cardName === 'High Ground') {
      handled = true;
      lines.push('├─ Taking HIGH GROUND position...');
      var playerAction = {
        type: 'HIGH_GROUND',
        target: 'CARRIER',
        card: card
      };
      var exploitResult = _activeBoss.checkExploit(playerAction, gameState);
      if (exploitResult.exploited && exploitResult.bypassShield) {
        lines.push('├─ ' + exploitResult.message);
        var damage = exploitResult.damage || (card.stats.damage || 4) * 2;
        target.hp = Math.max(0, target.hp - damage);
        lines.push('└─ Piercing damage: ' + damage + ' → Boss HP: ' + target.hp + '/' + _activeBoss.maxHp);
      } else {
        var damage = card.stats.damage || 4;
        target.hp = Math.max(0, target.hp - damage);
        lines.push('├─ Piercing shot: ' + damage + ' damage');
        lines.push('└─ Boss HP: ' + target.hp + '/' + _activeBoss.maxHp);
      }
    }

    // LOGIC_HACK card interaction
    else if (cardName === 'Logic Hack') {
      handled = true;
      lines.push('├─ Executing LOGIC HACK on boss systems...');
      var targetNode = Math.floor(Math.random() * 8); // Random node 0-7
      var playerAction = {
        type: 'LOGIC_HACK',
        targetNode: targetNode,
        card: card
      };
      var exploitResult = _activeBoss.checkExploit(playerAction, gameState);
      if (exploitResult.exploited) {
        lines.push('├─ ' + exploitResult.message);
        lines.push('└─ Boss defenses manipulated!');
      } else {
        lines.push('└─ Hack had no effect (wrong boss type)');
      }
    }

    // MELEE_STRIKE card interaction
    else if (cardName === 'Melee Strike') {
      // Track as melee for mythic conditions
      _player.lastCardType = 'MELEE';
      // Let it fall through to standard attack resolution
      return { handled: false, lines: [] };
    }

    // CAMERA card interaction (Sniper Boss — accumulates accuracy penalties)
    else if (cardName === 'Camera') {
      handled = true;
      lines.push('├─ 📷 Photographing boss position...');
      var exploitResult = _activeBoss.checkExploit({ type: 'CAMERA', card: card }, gameState);
      if (exploitResult.exploited) {
        lines.push('├─ ' + exploitResult.message);
        if (exploitResult.atMaxPenalty) {
          lines.push('└─ ⚡ Boss fully exposed — attack now!');
        }
      } else {
        lines.push('└─ Camera has no effect on this boss type.');
      }
    }

    // FRAGMENT SHOWER card interaction (Asteroids Boss — clears incoming hazards)
    else if (cardName === 'Fragment Shower') {
      handled = true;
      lines.push('├─ 💫 Launching fragment shower...');
      var playerAction = {
        type: 'FRAGMENT_SHOWER',
        targetX: target ? (target.x || 20) : 20,
        targetY: target ? (target.y || 10) : 10,
        card: card
      };
      var exploitResult = _activeBoss.checkExploit(playerAction, gameState);
      var damage = (card.stats && card.stats.damage) || 3;
      if (exploitResult.exploited) {
        lines.push('├─ ' + exploitResult.message);
      }
      if (target) {
        target.hp = Math.max(0, target.hp - damage);
        lines.push('└─ ' + damage + ' damage → Boss HP: ' + target.hp + '/' + _activeBoss.maxHp);
      }
    }

    // SUPPRESSION FIRE card interaction (Tower Offense Boss — suppresses volleys)
    else if (cardName === 'Suppression Fire') {
      handled = true;
      lines.push('├─ 🔥 Opening suppression fire...');
      var exploitResult = _activeBoss.checkExploit({ type: 'SUPPRESSION_FIRE', card: card }, gameState);
      var damage = (card.stats && card.stats.damage) || 2;
      if (exploitResult.exploited) {
        lines.push('├─ ' + exploitResult.message);
      }
      if (target) {
        target.hp = Math.max(0, target.hp - damage);
        lines.push('└─ ' + damage + ' damage → Boss HP: ' + target.hp + '/' + _activeBoss.maxHp);
      }
    }

    return { handled: handled, lines: lines };
  }

  /**
   * Show STR combat UI with additional log lines
   */
  function _showStrCombatUIWithLog(logLines) {
    var lines = logLines || [];
    
    // Add current combat state
    lines.push('╔═══════════════════════════╗');
    lines.push('║  PLAYER: ' + _player.hp + '/' + (_player.maxHp || 10) + ' HP         ║');
    lines.push('║  ENEMY:  ' + _strCombatEnemy.hp + '/' + (_strCombatEnemy.maxHp || 5) + ' HP         ║');
    lines.push('╚═══════════════════════════╝');
    lines.push('');
    lines.push('🃏 Use attack card (swipe/click) to strike');
    lines.push('🛡️  Use defense card to defend');
    lines.push('🏃 Type FLEE to attempt escape');
    lines.push('');

    // Clear temp effects for next round
    _player.tempDefense = 0;
    _player.tempEvasion = 0;
    _strCombatEnemy.tempDefense = 0;
    _strCombatEnemy.tempEvasion = 0;

    // Show grid underneath
    lines = lines.concat(_renderGrid());

    // Trigger header flash if UI exists
    _triggerCombatFlash();

    return {
      lines: lines,
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Simple enemy AI: select a card to use
   * @returns {Object} Simulated enemy card
   */
  function _getEnemyAICard() {
    // Simple AI: choose based on HP and situation
    var enemy = _strCombatEnemy;
    var enemyHpPercent = (enemy.hp / (enemy.maxHp || 5)) * 100;
    
    // If low HP, prefer defense/healing
    if (enemyHpPercent < 30) {
      var roll = Math.random();
      if (roll < 0.4 && typeof CardSystem !== 'undefined') {
        // Try to defend
        return CardSystem.rollCard('Dodge');
      } else if (roll < 0.7 && typeof CardSystem !== 'undefined') {
        return CardSystem.rollCard('Prone');
      }
    }
    
    // If healthy, prefer attacks
    if (enemyHpPercent > 50) {
      var attackRoll = Math.random();
      if (typeof CardSystem !== 'undefined') {
        if (attackRoll < 0.5) {
          return CardSystem.rollCard('Single Shot');
        } else if (attackRoll < 0.8) {
          return CardSystem.rollCard('Burst Shot');
        } else {
          return CardSystem.rollCard('Overwatch');
        }
      }
    }
    
    // Default: basic attack
    if (typeof CardSystem !== 'undefined') {
      return CardSystem.rollCard('Single Shot');
    }
    
    // Fallback: create a basic attack card
    return {
      name: 'Basic Attack',
      emoji: '🔫',
      type: 'attack',
      category: 'attack',
      stats: { damage: 2, accuracy: 70, energy: 1, speed: 2 }
    };
  }

  /**
   * Execute a round of STR combat (legacy single-action system)
   */
  function _executeStrRound(initiator, card) {
    _strCombatRound++;

    if (initiator === 'player') {
      return _playerStrAttack(card);
    } else {
      return _enemyStrAttack();
    }
  }

  /**
   * Player attack in STR combat
   */
  function _playerStrAttack(card) {
    var enemy = _strCombatEnemy;
    if (!enemy || enemy.hp <= 0) {
      return _exitStrCombat('player_victory');
    }

    // Track ammo spent if card has ammo cost
    if (card && card.resourceCost && card.resourceCost.ammo) {
      _strCombatAmmoSpent += card.resourceCost.ammo;
    } else if (card && card.baseStats && card.baseStats.ammo) {
      // Legacy ammo tracking from baseStats
      _strCombatAmmoSpent += card.baseStats.ammo;
    }

    // Calculate hit
    var hitResult = _calculateHit(_player, enemy, _strCombatAdvantage);

    if (!hitResult.hit) {
      _strCombatLog.push('💨 PLAYER MISS!');
      _strCombatLog.push('');

      // Enemy counter-attack
      return _enemyStrAttack();
    }

    // Calculate damage
    var damageResult = _calculateDamage(_player, enemy, _strCombatAdvantage, card, hitResult.crit);
    enemy.hp -= damageResult.damage;

    // Log attack
    var critEmoji = hitResult.crit ? ' 💥 CRIT!' : '';
    _strCombatLog.push('⚡ PLAYER ATTACK' + critEmoji);
    _strCombatLog.push('├─ Hit: ' + (hitResult.roll || 0) + ' vs ' + (hitResult.target || 0));
    _strCombatLog.push('└─ Damage: ' + damageResult.damage + ' HP');
    if (damageResult.bonuses.length > 0) {
      _strCombatLog.push('   └─ Bonuses: ' + damageResult.bonuses.join(', '));
    }
    _strCombatLog.push('');

    // Check if enemy defeated
    if (enemy.hp <= 0) {
      _strCombatLog.push('💀 ENEMY DEFEATED!');
      return _exitStrCombat('player_victory');
    }

    // Enemy counter-attack
    return _enemyStrAttack();
  }

  /**
   * Enemy attack in STR combat
   */
  function _enemyStrAttack() {
    var enemy = _strCombatEnemy;
    if (!enemy || enemy.hp <= 0) {
      return _exitStrCombat('player_victory');
    }

    // Calculate hit (reverse advantage for enemy)
    var reverseAdvantage = _strCombatAdvantage === 'flanked' ? 'ambush' :
                          _strCombatAdvantage === 'ambush' ? 'flanked' : 'neutral';
    var hitResult = _calculateHit(enemy, _player, reverseAdvantage);

    if (!hitResult.hit) {
      _strCombatLog.push('💨 ENEMY MISS!');
      _strCombatLog.push('');
      return _showStrCombatUI();
    }

    // Calculate damage
    var damageResult = _calculateDamage(enemy, _player, reverseAdvantage, null, hitResult.crit);
    _player.hp -= damageResult.damage;

    // Log attack
    var critEmoji = hitResult.crit ? ' 💥 CRIT!' : '';
    _strCombatLog.push('🗡️  ENEMY ATTACK' + critEmoji);
    _strCombatLog.push('├─ Hit: ' + (hitResult.roll || 0) + ' vs ' + (hitResult.target || 0));
    _strCombatLog.push('└─ Damage: ' + damageResult.damage + ' HP');
    _strCombatLog.push('');

    // Check if player defeated
    if (_player.hp <= 0) {
      _strCombatLog.push('💀 YOU HAVE BEEN DEFEATED...');
      return _handlePlayerDeath('combat_damage', { enemy: _strCombatEnemy });
    }

    // Continue combat - show UI for player's turn
    return _showStrCombatUI();
  }

  /**
   * Calculate hit chance and roll
   */
  function _calculateHit(attacker, defender, advantage) {
    var baseHitChance = 70; // Base 70% hit chance
    var attackerDex = attacker.dex || 5;
    var defenderDex = defender.dex || 5;
    var distance = _distanceBetween(attacker, defender);
    var bracket = _getDistanceBracket(distance);

    // Advantage modifiers
    var advantageBonus = 0;
    var critThreshold = 95; // Base crit on 95+

    if (advantage === 'ambush') {
      advantageBonus = 40;
      critThreshold = Math.max(5, critThreshold - 30); // Easier crits when ambushing
    } else if (advantage === 'flanked' || advantage === 'disadvantaged') {
      advantageBonus = -25;
      critThreshold = 98; // Harder crits when disadvantaged
    }

    var distancePenalty = {
      melee: 0,
      close: 5,
      mid: 15,
      far: 35
    }[bracket] || 0;

    // Calculate hit chance
    var hitChance = baseHitChance + (attackerDex - defenderDex) * 2 + advantageBonus - distancePenalty;
    hitChance = Math.max(5, Math.min(95, hitChance)); // Clamp between 5-95%

    // Roll d100
    var roll = Math.floor(Math.random() * 100) + 1;

    return {
      hit: roll <= hitChance,
      crit: roll >= critThreshold,
      roll: roll,
      target: hitChance
    };
  }

  /**
   * Calculate damage dealt
   */
  function _calculateDamage(attacker, defender, advantage, card, isCrit) {
    var baseDamage = 2;
    var attackerStr = attacker.str || 5;
    var defenderStr = defender.str || 5;
    var bonuses = [];

    // Card damage
    if (card && card.stats && card.stats.damage) {
      baseDamage = card.stats.damage;
      bonuses.push('Card: ' + card.stats.damage);
    }

    // Strength modifier
    var strMod = Math.floor((attackerStr - defenderStr) / 2);
    baseDamage += strMod;
    if (strMod > 0) {
      bonuses.push('STR: +' + strMod);
    }

    // Advantage damage modifiers
    if (advantage === 'ambush') {
      baseDamage += 2;
      bonuses.push('Ambush: +2');
    } else if (advantage === 'flanked') {
      baseDamage -= 1;
      bonuses.push('Flanked: -1');
    }

    // Minimum 1 damage
    baseDamage = Math.max(1, baseDamage);

    if (isCrit) {
      baseDamage = Math.ceil(baseDamage * 1.75);
      bonuses.push('CRIT x1.75');
    }

    return {
      damage: baseDamage,
      bonuses: bonuses
    };
  }

  /**
   * Show STR combat UI and wait for player action
   */
  function _showStrCombatUI() {
    var lines = [];
    lines.push('═══════════════════════════════════════');
    lines.push('⚔️  STR COMBAT - ROUND ' + _strCombatRound);
    lines.push('═══════════════════════════════════════');
    lines.push('');

    // Combat log
    _strCombatLog.forEach(function(logLine) {
      lines.push(logLine);
    });

    lines.push('───────────────────────────────────────');

    // Display enemy intent if system available
    var intentDisplay = '';
    if (typeof EnemyIntentSystem !== 'undefined' && _strCombatEnemy.intentState) {
      intentDisplay = '  ' + EnemyIntentSystem.formatIntentDisplay(_strCombatEnemy.intentState);
    }

    lines.push('PLAYER HP: ' + _player.hp + '/' + _player.maxHp + ' ❤️   |   ENEMY HP: ' + _strCombatEnemy.hp + '/5 💀' + intentDisplay);
    lines.push('Advantage: ' + _strCombatAdvantage.toUpperCase() + ' ' + _getAdvantageEmoji(_strCombatAdvantage));
    lines.push('───────────────────────────────────────');
    lines.push('');
    lines.push('🃏 Use attack card (swipe/click) to strike');
    lines.push('🛡️  Use stance card to defend (+stealth)');
    lines.push('🏃 Type FLEE to attempt escape');
    lines.push('');

    // Show grid underneath
    lines = lines.concat(_renderGrid());

    // Trigger header flash if UI exists
    _triggerCombatFlash();

    return {
      lines: lines,
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Exit STR combat and return to realtime
   */
  function _exitStrCombat(reason) {
    var lines = [];

    if (reason === 'player_victory') {
      lines.push('✅ COMBAT VICTORY!');
      lines.push('└─ Enemy neutralized');

      // Handle enemy death through centralized death system
      var deathResult = _handleEnemyDeath(_strCombatEnemy, 'player', {
        player: _player,
        location: { x: _strCombatEnemy.x, y: _strCombatEnemy.y }
      });

      // Add standard loot messages from death handler
      if (deathResult && deathResult.messages && deathResult.messages.length > 0) {
        deathResult.messages.forEach(function(msg) {
          if (msg) lines.push(msg);
        });
      }

      // Calculate ammo drops based on ammo spent (1 ammo drop per 3 ammo spent)
      var ammoDrops = Math.floor(_strCombatAmmoSpent / 3);
      if (ammoDrops > 0) {
        // Auto-collect ammo drops
        GAMESTATE.addAmmo(ammoDrops);
        lines.push('🔫 AMMO RECOVERED: +' + ammoDrops + ' (' + _strCombatAmmoSpent + ' spent in combat)');
        
        // Report to debrief feed
        if (typeof DebriefFeedController !== 'undefined' && DebriefFeedController.reportResourceChange) {
          var currentAmmo = GAMESTATE.getAmmo ? GAMESTATE.getAmmo() : 0;
          DebriefFeedController.reportResourceChange('ammo', currentAmmo - ammoDrops, currentAmmo, 'Enemy Defeated');
        }
      }

      // Spawn standard loot (currency, cards, charms)
      if (deathResult && deathResult.loot) {
        // Currency
        if (deathResult.loot.currency > 0) {
          _spawnCurrency(_strCombatEnemy.x, _strCombatEnemy.y, deathResult.loot.currency);
        }

        // Cards
        if (deathResult.loot.cards && deathResult.loot.cards.length > 0) {
          deathResult.loot.cards.forEach(function(cardDrop) {
            if (cardDrop.shouldDrop && typeof CardSystem !== 'undefined') {
              var baseType = CardSystem.getRandomBaseCard();
              var card = CardSystem.rollCard(baseType);
              if (card) {
                _items.push({
                  x: _strCombatEnemy.x,
                  y: _strCombatEnemy.y,
                  type: 'card',
                  card: card,
                  spawnTime: Date.now(),
                  decayTime: 30000 // 30 second decay
                });
              }
            }
          });
        }

        // Charms
        if (deathResult.loot.charms && deathResult.loot.charms.length > 0) {
          deathResult.loot.charms.forEach(function(charmDrop) {
            if (charmDrop.shouldDrop && typeof CardSystem !== 'undefined') {
              var charm = CardSystem.rollCommonCharm();
              if (charm) {
                _items.push({
                  x: _strCombatEnemy.x,
                  y: _strCombatEnemy.y,
                  type: 'charm',
                  card: charm,
                  spawnTime: Date.now(),
                  decayTime: 30000 // 30 second decay
                });
              }
            }
          });
        }
      }

      // Check if this was a boss fight (special boss loot handling)
      if (_bossFloorActive && _activeBoss && !_bossDefeated) {
        _bossDefeated = true;
        lines.push('');
        lines.push('🏆 BOSS DEFEATED!');

        // Check for boss overkill (200%+ damage) for secret floor trigger
        if (typeof SecretFloors !== 'undefined' && _strCombatEnemy) {
          var totalDamageDealt = _activeBoss.maxHp; // Boss HP that was depleted
          var overkillThreshold = _activeBoss.maxHp * 2; // 200% of max HP

          if (totalDamageDealt >= overkillThreshold) {
            var triggerResult = SecretFloors.triggerSecretFloor(
              SecretFloors.TRIGGER_TYPES.BOSS_OVERKILL,
              {
                damageDealt: totalDamageDealt,
                bossMaxHp: _activeBoss.maxHp
              }
            );

            if (triggerResult.success) {
              lines.push('');
              lines.push(triggerResult.message);
              lines.push('└─ Reality feels unstable...');
            } else if (triggerResult.suspicion) {
              lines.push('└─ Something feels... wrong. [' + triggerResult.suspicion + '/' + triggerResult.threshold + ']');
            }
          }
        }

        // Generate boss special loot (narrative drops)
        var bossLoot = _activeBoss.onDefeat(_player);
        lines.push('');

        // Process boss narrative loot (whispers, mythic, rumors)
        if (bossLoot.loot && bossLoot.loot.length > 0) {
          bossLoot.loot.forEach(function(lootItem) {
            if (lootItem.type === 'card') {
              var card;
              if (typeof CardSystem !== 'undefined') {
                var baseType = CardSystem.getRandomBaseCard();
                card = CardSystem.rollCard(baseType);
                // Force quality if specified
                if (lootItem.quality) {
                  card.quality = lootItem.quality;
                }
              }
              if (card) {
                _items.push({
                  x: _strCombatEnemy.x,
                  y: _strCombatEnemy.y,
                  type: 'card',
                  card: card,
                  spawnTime: Date.now(),
                  decayTime: 60000 // Boss loot lasts 60 seconds
                });
                lines.push('🎴 Boss dropped: ' + card.emoji + ' ' + card.name + ' (' + card.quality + ')');
              }
            } else if (lootItem.type === 'whisper') {
              lines.push('✨ WHISPER ITEM: ' + lootItem.item);
              // Spawn as special loot
              _spawnCurrency(_strCombatEnemy.x, _strCombatEnemy.y, 50); // Extra cryptos for whisper
            } else if (lootItem.type === 'mythic') {
              lines.push('');
              lines.push('⚡⚡⚡ MYTHIC CONDITION MET! ⚡⚡⚡');
              lines.push('💎 MYTHIC DROP: ' + lootItem.item);
              lines.push('');
              // Spawn legendary card
              if (typeof CardSystem !== 'undefined') {
                var legendaryCard = CardSystem.rollCard('Inventory Charm'); // Guaranteed inventory charm
                _items.push({
                  x: _strCombatEnemy.x,
                  y: _strCombatEnemy.y,
                  type: 'card',
                  card: legendaryCard,
                  spawnTime: Date.now(),
                  decayTime: 120000 // Mythic loot lasts 2 minutes
                });
              }
            } else if (lootItem.type === 'rumor') {
              lines.push('');
              lines.push('📜 ' + lootItem.message);
              lines.push('');
            }
          });
        }

        // Check for Impossible Charm drop (very rare)
        if (_activeBoss && typeof CardSystem !== 'undefined') {
          var isUberMega = _activeBoss.type === 'UBER_MEGA';
          var isFinalBoss = _floor === 30;
          var impossibleCharmChance = 0;

          if (isUberMega) {
            impossibleCharmChance = 0.05; // 5% chance from Uber Mega
          } else if (isFinalBoss) {
            impossibleCharmChance = 0.10; // 10% chance from final boss
          }

          if (impossibleCharmChance > 0 && Math.random() < impossibleCharmChance) {
            var impossibleCharm = CardSystem.rollImpossibleCharm();
            _items.push({
              x: _strCombatEnemy.x,
              y: _strCombatEnemy.y,
              type: 'charm',
              card: impossibleCharm,
              spawnTime: Date.now(),
              decayTime: 120000 // 2 minutes to pick up
            });
            lines.push('');
            lines.push('💠💠💠 IMPOSSIBLE BINARY CHARM DROPPED! 💠💠💠');
            lines.push('└─ A legendary artifact materializes...');
            lines.push('');
          }
        }
      }

      // Remove defeated enemy from map
      var enemyIndex = _enemies.indexOf(_strCombatEnemy);
      if (enemyIndex > -1) {
        _enemies[enemyIndex].hp = 0;
      }
    } else if (reason === 'fled') {
      lines.push('🏃 FLED COMBAT!');
      lines.push('└─ Repositioned to safety');

      // Move player back one space
      if (_player.lastMoveDirection) {
        var reverseDir = {
          'north': { dx: 0, dy: 1 },
          'south': { dx: 0, dy: -1 },
          'east': { dx: -1, dy: 0 },
          'west': { dx: 1, dy: 0 }
        };
        var move = reverseDir[_player.lastMoveDirection];
        if (move) {
          _player.x += move.dx;
          _player.y += move.dy;
        }
      }
    }

    lines.push('');
    lines.push('Movement unlocked. Returning to realtime grid...');
    lines.push('');

    // Reset combat state
    _strCombatActive = false;
    _strCombatEnemy = null;
    _strCombatAdvantage = 'neutral';
    _strCombatRound = 0;
    _strCombatLog = [];

    // Disable combat zoom
    _disableCombatZoom();

    // Resume game loop
    if (!_gameLoopActive) {
      _startGameLoop();
    }

    _saveState();

    return {
      lines: lines.concat(_renderGrid()),
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Trigger combat flash effect on header
   */
  function _triggerCombatFlash() {
    if (typeof document === 'undefined') return;

    var header = document.querySelector('.monitor-header') || document.querySelector('#mok-header');
    if (header) {
      header.classList.add('attackFlash');
      setTimeout(function() {
        header.classList.remove('attackFlash');
      }, 500);
    }
  }

  /**
   * Pause game loop (for STR combat)
   */
  function _pauseGameLoop() {
    if (_animationFrameId) {
      cancelAnimationFrame(_animationFrameId);
      _animationFrameId = null;
    }
    _gameLoopActive = false;
  }

  /**
   * Check if STR combat is active
   */
  function isStrCombatActive() {
    return _strCombatActive;
  }

  /**
   * Get STR combat state (for mobile UI)
   */
  function getStrCombatState() {
    return {
      active: _strCombatActive,
      enemy: _strCombatEnemy,
      player: _player ? { hp: _player.hp, maxHp: _player.maxHp } : { hp: 10, maxHp: 10 },
      advantage: _strCombatAdvantage,
      round: _strCombatRound,
      log: _strCombatLog,
      countdownMessages: _strCombatContext
    };
  }

  // ============================================================
  // END STR COMBAT SYSTEM
  // ============================================================

  /**
   * Get player state (for mobile UI)
   */
  function getPlayer() {
    return _player;
  }

  /**
   * Get enemies state (for mobile UI)
   */
  function getEnemies() {
    return _enemies;
  }

  /**
   * Enable combat zoom/focus (for desktop STR combat visual feedback)
   */
  function _enableCombatZoom() {
    if (typeof document === 'undefined') return;

    // Add combat-active class to grid for CSS zoom effect
    var gridContainer = document.getElementById('rogue-grid-mobile');
    if (gridContainer) {
      gridContainer.classList.add('combat-zoom-active');
    }

    // Flash the header to indicate combat start
    _triggerCombatFlash();

    // For desktop: optionally center view on player and enemy
    // This could be enhanced with CSS transforms or scrollIntoView
  }

  /**
   * Disable combat zoom (return to normal view)
   */
  function _disableCombatZoom() {
    if (typeof document === 'undefined') return;

    var gridContainer = document.getElementById('rogue-grid-mobile');
    if (gridContainer) {
      gridContainer.classList.remove('combat-zoom-active');
    }
  }

  // ============================================================
  // ACTIVE ITEM USAGE & GROUND INTERACTION SYSTEM
  // ============================================================

  /**
   * Trigger active item usage (called when clicking active slot with inventory closed)
   * Implements ground effects, buffs, healing, etc.
   */
  function triggerActiveItem() {
    if (typeof GAMESTATE === 'undefined') {
      return {
        lines: ['GAMESTATE UNAVAILABLE'],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    var activeItem = GAMESTATE.getActiveItem();
    if (!activeItem) {
      return {
        lines: ['NO ACTIVE ITEM', 'Equip an item from inventory first'],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Determine targeting: player tile + adjacent tiles
    var targetTiles = [
      { x: _player.x, y: _player.y }, // Player tile
      { x: _player.x + 1, y: _player.y }, // Right
      { x: _player.x - 1, y: _player.y }, // Left
      { x: _player.x, y: _player.y + 1 }, // Down
      { x: _player.x, y: _player.y - 1 }  // Up
    ];

    // Resolve item-to-ground interaction
    var result = _resolveGroundInteraction(activeItem, targetTiles);

    // Update mobile grid if active
    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      _updateMobileGrid();
    }

    return result;
  }

  /**
   * Resolve interaction between active item and ground tiles
   * @param {Object} item - Active item
   * @param {Array} tiles - Array of {x, y} target tiles
   * @returns {Object} - Command result
   */
  function _resolveGroundInteraction(item, tiles) {
    if (!item || !tiles || typeof GroundEffects === 'undefined') {
      return {
        lines: ['CANNOT USE ITEM HERE'],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    var itemName = item.name ? item.name.toLowerCase() : '';
    var messages = [];
    var effectApplied = false;

    // LIGHTER: Ignite flammable surfaces (oil)
    if (itemName.indexOf('lighter') !== -1 || itemName.indexOf('🔥') !== -1) {
      for (var i = 0; i < tiles.length; i++) {
        var tile = tiles[i];
        if (tile.x < 0 || tile.x >= GRID_WIDTH || tile.y < 0 || tile.y >= GRID_HEIGHT) continue;

        var groundEffect = GroundEffects.getGroundEffect(tile.x, tile.y);
        if (groundEffect && groundEffect.canIgnite) {
          // Ignite oil
          GroundEffects.igniteOil(tile.x, tile.y);
          messages.push('🔥 IGNITED OIL at (' + tile.x + ',' + tile.y + ')');
          effectApplied = true;
        } else if (!groundEffect || groundEffect.type === 'normal') {
          // Create small fire on empty tile
          GroundEffects.setGroundEffect(tile.x, tile.y, 'FIRE');
          messages.push('🔥 LIT FIRE at (' + tile.x + ',' + tile.y + ')');
          effectApplied = true;
        }
      }

      if (!effectApplied) {
        messages.push('💡 LIGHTER: No flammable surfaces nearby');
      }
    }
    // WATER BOTTLE: Extinguish fire, create water
    else if (itemName.indexOf('water') !== -1 || itemName.indexOf('bottle') !== -1 || itemName.indexOf('💧') !== -1) {
      for (var i = 0; i < tiles.length; i++) {
        var tile = tiles[i];
        if (tile.x < 0 || tile.x >= GRID_WIDTH || tile.y < 0 || tile.y >= GRID_HEIGHT) continue;

        var groundEffect = GroundEffects.getGroundEffect(tile.x, tile.y);
        if (groundEffect && (groundEffect.type === 'FIRE' || groundEffect.type === 'OIL_IGNITED')) {
          // Extinguish fire
          GroundEffects.extinguishFire(tile.x, tile.y);
          messages.push('💧 EXTINGUISHED FIRE at (' + tile.x + ',' + tile.y + ')');
          effectApplied = true;
        } else if (!groundEffect || groundEffect.type === 'normal') {
          // Create water
          GroundEffects.setGroundEffect(tile.x, tile.y, 'WATER');
          messages.push('💧 WATER SPILLED at (' + tile.x + ',' + tile.y + ')');
          effectApplied = true;
        }
      }

      if (!effectApplied) {
        messages.push('💧 WATER: No fires to extinguish');
      }
    }
    // TAZER/SHOCK: Electrify conductive surfaces (water, rail)
    else if (itemName.indexOf('tazer') !== -1 || itemName.indexOf('taser') !== -1 ||
             itemName.indexOf('shock') !== -1 || itemName.indexOf('⚡') !== -1) {
      for (var i = 0; i < tiles.length; i++) {
        var tile = tiles[i];
        if (tile.x < 0 || tile.x >= GRID_WIDTH || tile.y < 0 || tile.y >= GRID_HEIGHT) continue;

        var groundEffect = GroundEffects.getGroundEffect(tile.x, tile.y);
        if (groundEffect && (groundEffect.type === 'WATER' || groundEffect.conductive)) {
          // Electrify water (spread to adjacent water tiles)
          _electrifyWater(tile.x, tile.y, 2); // 2 tile radius spread
          messages.push('⚡ ELECTRIFIED WATER at (' + tile.x + ',' + tile.y + ')');
          effectApplied = true;
        }
      }

      if (!effectApplied) {
        messages.push('⚡ TAZER: No conductive surfaces nearby');
      }
    }
    // HEALING ITEMS: Restore HP
    else if (itemName.indexOf('medkit') !== -1 || itemName.indexOf('bandage') !== -1 ||
             itemName.indexOf('heal') !== -1 || itemName.indexOf('💊') !== -1) {
      var healAmount = 20 + Math.floor(Math.random() * 11); // 20-30 HP
      _player.hp = Math.min(_player.hp + healAmount, _player.maxHp);
      messages.push('💊 HEALED: +' + healAmount + ' HP');
      messages.push('HP: ' + _player.hp + '/' + _player.maxHp);
      effectApplied = true;
    }
    // DEFAULT: Item has passive effect or no ground interaction
    else {
      messages.push('📦 ' + item.emoji + ' ' + item.name);
      messages.push('This item provides passive benefits while equipped');
      effectApplied = true;
    }

    if (messages.length === 0) {
      messages.push('ITEM USED: ' + item.name);
    }

    return {
      lines: messages.concat(['']).concat(_renderGrid()),
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Electrify water tiles in radius (for tazer effect)
   * @param {number} x - Center X
   * @param {number} y - Center Y
   * @param {number} radius - Spread radius
   */
  function _electrifyWater(x, y, radius) {
    if (typeof GroundEffects === 'undefined') return;

    var queue = [{x: x, y: y, dist: 0}];
    var visited = {};
    visited[x + ',' + y] = true;

    while (queue.length > 0) {
      var current = queue.shift();

      // Apply electrified effect
      var groundEffect = GroundEffects.getGroundEffect(current.x, current.y);
      if (groundEffect && groundEffect.type === 'WATER') {
        // Add electrified property to water
        GroundEffects.setGroundEffect(current.x, current.y, 'WATER', {
          electrified: true,
          electrifiedTime: Date.now(),
          electrifiedDuration: 6000 // 6 seconds
        });
      }

      // Spread to adjacent tiles within radius
      if (current.dist < radius) {
        var neighbors = [
          {x: current.x + 1, y: current.y},
          {x: current.x - 1, y: current.y},
          {x: current.x, y: current.y + 1},
          {x: current.x, y: current.y - 1}
        ];

        for (var i = 0; i < neighbors.length; i++) {
          var n = neighbors[i];
          var key = n.x + ',' + n.y;

          if (n.x >= 0 && n.x < GRID_WIDTH && n.y >= 0 && n.y < GRID_HEIGHT && !visited[key]) {
            visited[key] = true;

            var neighborEffect = GroundEffects.getGroundEffect(n.x, n.y);
            if (neighborEffect && (neighborEffect.type === 'WATER' || neighborEffect.conductive)) {
              queue.push({x: n.x, y: n.y, dist: current.dist + 1});
            }
          }
        }
      }
    }
  }

  // ============================================================
  // END ACTIVE ITEM USAGE SYSTEM
  // ============================================================

  // ============================================================
  // GROUND EFFECT COMBAT MODIFIERS
  // ============================================================

  /**
   * Apply ground effect modifiers when STR combat starts
   * Scans 3x3 tiles around player and enemy, applies status effects
   */
  function _applyGroundEffectModifiers() {
    if (typeof GroundEffects === 'undefined') return;

    var playerGroundEffect = GroundEffects.getGroundEffect(_player.x, _player.y);
    var enemyGroundEffect = null;

    if (_strCombatEnemy) {
      enemyGroundEffect = GroundEffects.getGroundEffect(_strCombatEnemy.x, _strCombatEnemy.y);
    }

    // Apply player ground effect modifiers
    if (playerGroundEffect) {
      _applyPlayerGroundModifier(playerGroundEffect);
    }

    // Apply enemy ground effect modifiers
    if (enemyGroundEffect && _strCombatEnemy) {
      _applyEnemyGroundModifier(enemyGroundEffect, _strCombatEnemy);
    }
  }

  /**
   * Apply ground effect modifier to player
   * @param {Object} effect - Ground effect
   */
  function _applyPlayerGroundModifier(effect) {
    if (!effect) return;

    // FIRE / OIL_IGNITED: Start combat with reduced HP and burn status
    if (effect.type === 'FIRE' || effect.type === 'OIL_IGNITED') {
      var burnDamage = Math.floor(_player.maxHp * 0.1); // 10% HP
      _player.hp = Math.max(1, _player.hp - burnDamage);
      _strCombatLog.push('🔥 STANDING IN FIRE! -' + burnDamage + ' HP');
      _strCombatLog.push('└─ Burn status applied');
    }
    // ELECTRIFIED WATER: Shock risk, reduced evasion
    else if (effect.type === 'WATER' && effect.electrified) {
      _strCombatLog.push('⚡ STANDING IN ELECTRIFIED WATER!');
      _strCombatLog.push('└─ Shock risk, -20% evasion');
      // Modifier will be checked during damage calculation
    }
    // INDUSTRIAL_WASTE: Random mutation or debuff
    else if (effect.type === 'INDUSTRIAL_WASTE') {
      if (Math.random() < 0.3) {
        _strCombatLog.push('☢️  TOXIC WASTE EXPOSURE!');
        _strCombatLog.push('└─ Random debuff applied');
        // Could implement specific debuffs here
      }
    }
    // WATER: Movement penalty, reduced evasion
    else if (effect.type === 'WATER') {
      _strCombatLog.push('💧 Standing in water: -10% evasion');
    }
  }

  /**
   * Apply ground effect modifier to enemy
   * @param {Object} effect - Ground effect
   * @param {Object} enemy - Enemy object
   */
  function _applyEnemyGroundModifier(effect, enemy) {
    if (!effect || !enemy) return;

    // FIRE / OIL_IGNITED: Enemy takes damage, may be stunned
    if (effect.type === 'FIRE' || effect.type === 'OIL_IGNITED') {
      var burnDamage = Math.floor(enemy.maxHp * 0.15); // 15% HP for enemies
      enemy.hp = Math.max(1, enemy.hp - burnDamage);
      _strCombatLog.push('🔥 ENEMY IN FIRE! -' + burnDamage + ' HP');

      // Weak enemies may be KO'd immediately
      if (enemy.hp <= burnDamage && enemy.tier === 'SCOUT') {
        enemy.hp = 0;
        _strCombatLog.push('└─ Enemy KO\'d by fire!');
      }
    }
    // ELECTRIFIED WATER: Stun enemy for first turn
    else if (effect.type === 'WATER' && effect.electrified) {
      _strCombatLog.push('⚡ ENEMY IN ELECTRIFIED WATER!');
      _strCombatLog.push('└─ Enemy stunned turn 1');
      enemy.stunnedTurns = 1;
    }
    // INDUSTRIAL_WASTE: Random debuff
    else if (effect.type === 'INDUSTRIAL_WASTE') {
      if (Math.random() < 0.3) {
        _strCombatLog.push('☢️  Enemy exposed to toxic waste');
        _strCombatLog.push('└─ Enemy weakened');
        enemy.weakened = true;
      }
    }
  }

  /**
   * Build the three contextual messages displayed during the 3-2-1 countdown.
   *
   * Beat 3 → stealth / environment quality
   * Beat 2 → flanking / advantage state
   * Beat 1 → critical resource warnings
   *
   * @param {Object} enemy   - Enemy being engaged
   * @param {string} trigger - Combat trigger type
   * @returns {{ beat3: string, beat2: string, beat1: string }}
   */
  function _buildCountdownMessages(enemy, trigger) {
    // ── BEAT 3 : Stealth / Environment ─────────────────────────────────────
    var beat3 = '';

    var tile = (_grid[_player.y] && _grid[_player.y][_player.x]) || '';
    var groundEffect = (typeof GroundEffects !== 'undefined')
      ? GroundEffects.getGroundEffect(_player.x, _player.y)
      : null;
    var stealthBonus = _getPlayerStealthBonus();

    if (groundEffect) {
      var gt = groundEffect.type;
      if (gt === 'fire' || gt === 'oil_ignited') {
        beat3 = '🔥 you were standing in fire';
      } else if (gt === 'industrial_waste') {
        beat3 = '☢️  you were standing in toxic waste';
      } else if (gt === 'water') {
        if (groundEffect.electrified) {
          beat3 = '⚡ you were standing in electrified water';
        } else {
          beat3 = '💧 you were splashing in water';
        }
      } else if (gt === 'glass') {
        beat3 = '🪟 you were crunching on broken glass';
      } else if (gt === 'soda_spill') {
        beat3 = '🧃 you were slipping in a soda spill';
      } else if (gt === 'steam') {
        beat3 = '♨️  you were hidden in steam';
      } else if (gt === 'oil') {
        beat3 = '🛢️  you were standing in an oil slick';
      }
    }

    if (!beat3) {
      if (tile === TILES.SHADOW) {
        beat3 = '⬛ you were cloaked in shadow';
      } else if (tile === TILES.SMOKE) {
        beat3 = '🌫️  you were hidden in smoke';
      } else if (tile === TILES.GRASS) {
        beat3 = '🟩 you were crouched in the grass';
      } else if (tile === TILES.WATER) {
        beat3 = '💧 you were splashing in water';
      } else if (stealthBonus >= 30) {
        beat3 = '🌑 darkness gave you cover (+' + stealthBonus + '% stealth)';
      } else if (stealthBonus > 0) {
        beat3 = '👁 partial cover (+' + stealthBonus + '% stealth)';
      } else {
        beat3 = '👁 no cover — fully exposed';
      }
    }

    // ── BEAT 2 : Flank / Advantage ─────────────────────────────────────────
    var beat2 = '';
    var advantage = _strCombatAdvantage;
    var enemyAwareness = enemy ? (enemy.awareness || 0) : 0;
    var isFlanking = _checkFlanking(_player, enemy);
    var enemyInitiated = trigger === 'enemy_attack' || trigger === 'enemy_sighting' || trigger === 'enemy_projectile';

    if (advantage === 'ambush') {
      if (isFlanking) {
        beat2 = '🎯 you struck from behind — they never saw it coming';
      } else {
        beat2 = '🎯 you caught them completely unaware';
      }
    } else if (advantage === 'flanked') {
      beat2 = '❌ you were hit from behind — enemy flanked you';
    } else if (advantage === 'disadvantaged') {
      if (enemyAwareness >= 70) {
        beat2 = '⚠️  the enemy was fully alerted to your position';
      } else {
        beat2 = '⚠️  you were caught in the open';
      }
    } else {
      // neutral
      if (enemyInitiated) {
        beat2 = '⚔️  they spotted you — head-on engagement';
      } else {
        beat2 = '⚔️  you faced them head-on';
      }
    }

    // ── BEAT 1 : Critical Resource Warnings ─────────────────────────────────
    var beat1 = '';
    var warnings = [];

    if (typeof GAMESTATE !== 'undefined') {
      var ammo    = GAMESTATE.getAmmo    ? GAMESTATE.getAmmo()    : 0;
      var energy  = GAMESTATE.getEnergy  ? GAMESTATE.getEnergy()  : 0;
      var fatigue = GAMESTATE.getFatigue ? GAMESTATE.getFatigue() : 0;
      var state   = GAMESTATE.getState   ? GAMESTATE.getState()   : {};
      var maxFatigue = state.maxFatigue  || 100;
      var focus   = GAMESTATE.getFocus   ? GAMESTATE.getFocus()   : 0;

      if (ammo <= 0)                               warnings.push('🔫 no ammo');
      if (energy <= 0)                             warnings.push('⚡ no energy');
      if (focus <= 0)                              warnings.push('🎯 no focus');
      if (fatigue >= maxFatigue * 0.8)             warnings.push('🏋️  extreme fatigue');
    }

    if (warnings.length === 0) {
      beat1 = '✅ all systems combat-ready';
    } else if (warnings.length === 1) {
      beat1 = warnings[0] + ' — limited options';
    } else {
      beat1 = warnings.join('  ·  ');
    }

    return { beat3: beat3, beat2: beat2, beat1: beat1 };
  }

  /**
   * Handle agent control commands
   */
  function _handleAgentCommand(cmd) {
    if (typeof AgentIntegration === 'undefined') {
      return {
        lines: [
          '',
          'AGENT SYSTEM NOT AVAILABLE',
          'Required modules not loaded',
          ''
        ],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    var parts = cmd.split(' ');
    var subCommand = parts[1] ? parts[1].toLowerCase() : '';

    if (subCommand === 'natural') {
      // Start agent in natural play mode
      var started = AgentIntegration.startAgentTakeover('natural');
      if (started) {
        return {
          lines: [
            '',
            '🤖 MOK AGENT ACTIVATED - NATURAL MODE',
            '',
            '[MOK]: "Control transferred. Beginning natural play protocol."',
            '[MOK]: "I will explore thoroughly and generate MVP report."',
            '',
            'The agent will now play for you.',
            'Watch the MOK interjection field for real-time updates.',
            '',
            'Type AGENT STOP to return control',
            ''
          ],
          prompt: getPrompt(),
          stayActive: true
        };
      } else {
        return {
          lines: ['', 'Failed to start agent', ''],
          prompt: getPrompt(),
          stayActive: true
        };
      }
    }

    else if (subCommand === 'developer' || subCommand === 'dev') {
      // Start agent in developer mode
      var started = AgentIntegration.startAgentTakeover('developer');
      if (started) {
        return {
          lines: [
            '',
            '🤖 DEVELOPER AGENT ACTIVATED - FAST MODE',
            '',
            '[DEV]: "Control transferred. Running optimal pathfinding."',
            '[DEV]: "This mode skips exploration for quick testing."',
            '',
            'The agent will now play for you.',
            'This mode is significantly faster than natural play.',
            '',
            'Type AGENT STOP to return control',
            ''
          ],
          prompt: getPrompt(),
          stayActive: true
        };
      } else {
        return {
          lines: ['', 'Failed to start agent', ''],
          prompt: getPrompt(),
          stayActive: true
        };
      }
    }

    else if (subCommand === 'stop') {
      // Stop agent
      AgentIntegration.stopAgentTakeover();
      return {
        lines: [
          '',
          '🛑 AGENT CONTROL RELEASED',
          '',
          'Manual control restored.',
          'MVP report has been generated (check terminal).',
          ''
        ],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    else if (subCommand === 'pause') {
      // Pause/resume agent
      AgentIntegration.togglePause();
      var report = AgentIntegration.getReport();
      var status = report && report.outcome === 'in_progress' ? 'paused' : 'resumed';
      return {
        lines: [
          '',
          status === 'paused' ? '⏸️  Agent paused' : '▶️  Agent resumed',
          ''
        ],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    else if (subCommand === 'report') {
      // Show current report
      var report = AgentIntegration.getReport();
      if (!report) {
        return {
          lines: ['', 'No agent report available', ''],
          prompt: getPrompt(),
          stayActive: true
        };
      }

      var lines = [
        '',
        'CURRENT AGENT METRICS:',
        '————————————————————————————————',
        'Mode: ' + report.mode.toUpperCase(),
        'Status: ' + report.outcome.toUpperCase(),
        'Actions Executed: ' + report.actionsExecuted,
        'Floors Completed: ' + report.floorsCompleted,
        'Tiles Visited: ' + report.tilesVisited,
        'Failed Actions: ' + report.failedActions,
        ''
      ];

      return {
        lines: lines,
        prompt: getPrompt(),
        stayActive: true
      };
    }

    else if (subCommand === 'mode') {
      // Show current mode
      if (AgentIntegration.isActive()) {
        var mode = AgentIntegration.getMode();
        return {
          lines: [
            '',
            'AGENT MODE: ' + mode.toUpperCase(),
            '',
            mode === 'natural' 
              ? 'Natural human-like play with thorough exploration'
              : 'Fast developer mode with optimal pathfinding',
            ''
          ],
          prompt: getPrompt(),
          stayActive: true
        };
      } else {
        return {
          lines: ['', 'Agent not active', ''],
          prompt: getPrompt(),
          stayActive: true
        };
      }
    }

    else {
      // Unknown agent subcommand
      return {
        lines: [
          '',
          'AGENT COMMANDS:',
          '  AGENT NATURAL   - Start natural play mode',
          '  AGENT DEVELOPER - Start fast testing mode',
          '  AGENT STOP      - Stop agent control',
          '  AGENT PAUSE     - Pause/resume agent',
          '  AGENT REPORT    - Show current metrics',
          '  AGENT MODE      - Show current mode',
          ''
        ],
        prompt: getPrompt(),
        stayActive: true
      };
    }
  }

  // ============================================================
  // END GROUND EFFECT COMBAT MODIFIERS
  // ============================================================

  // ============================================================
  // DIFFICULTY TIER SYSTEM (Public API Functions)
  // ============================================================

  /**
   * Set difficulty tier (called by AWOL button)
   * @param {number} tier - 1, 2, or 3
   */
  function setDifficulty(tier) {
    if (tier >= 1 && tier <= 3) {
      _difficultyTier = tier;
      console.log('[GoneRogue] Difficulty set to T' + tier);
      
      // Notify state change listeners
      _notifyStateChange();
    }
  }

  /**
   * Get current difficulty tier
   * @returns {number} Current tier (1-3)
   */
  function getDifficulty() {
    return _difficultyTier;
  }

  /**
   * Register callback for state changes
   * @param {Function} callback
   */
  function onStateChange(callback) {
    if (typeof callback === 'function') {
      _stateChangeCallbacks.push(callback);
    }
  }

  // ============================================================
  // END DIFFICULTY TIER SYSTEM
  // ============================================================

  // ============================================================
  // HEADLESS MODE API (for automated testing/agent simulation)
  // ============================================================

  /**
   * Get complete game state (for testing/agent simulation)
   */
  function getState() {
    return {
      active: _active,
      floor: _floor,
      turn: _turn,
      player: {
        x: _player.x,
        y: _player.y,
        hp: _player.hp,
        maxHp: _player.maxHp,
        energy: _player.energy,
        maxEnergy: _player.maxEnergy,
        stealth: _player.stealth,
        detection: _player.detection,
        lastMoveDirection: _player.lastMoveDirection,
        str: _player.str,
        dex: _player.dex,
        credits: _player.credits,
        deck: _player.deck ? _player.deck.slice() : [],
        activeItem: _player.activeItem
      },
      enemies: _enemies.map(function(e) {
        return {
          x: e.x,
          y: e.y,
          hp: e.hp,
          maxHp: e.maxHp,
          type: e.type,
          tier: e.tier,
          emoji: e.emoji,
          awarenessState: e.awarenessState,
          orientation: e.orientation,
          alertLevel: e.alertLevel
        };
      }),
      grid: _grid.map(function(row) { return row.slice(); }),
      gridWidth: GRID_WIDTH,
      gridHeight: GRID_HEIGHT,
      breakables: _breakables.slice(),
      projectiles: _projectiles.slice(),
      items: _items.slice(),
      currencies: _currencies.slice(),
      strCombatActive: _strCombatActive,
      alertLevel: _alertLevel,
      bossFloorActive: _bossFloorActive
    };
  }

  /**
   * Get legal actions from current state
   */
  function getLegalActions() {
    if (!_active) {
      return [];
    }

    var actions = [];

    // During STR combat, only card actions are legal
    if (_strCombatActive) {
      // Can use cards from deck
      if (_player.deck && _player.deck.length > 0) {
        _player.deck.forEach(function(card, index) {
          actions.push({
            type: 'useCard',
            cardIndex: index,
            card: card
          });
        });
      }
      
      // Can flee
      actions.push({ type: 'flee' });
      
      return actions;
    }

    // Movement actions (check each direction)
    var directions = [
      { dx: 0, dy: -1, name: 'north', cmd: 'n' },
      { dx: 0, dy: 1, name: 'south', cmd: 's' },
      { dx: 1, dy: 0, name: 'east', cmd: 'e' },
      { dx: -1, dy: 0, name: 'west', cmd: 'w' }
    ];

    directions.forEach(function(dir) {
      var newX = _player.x + dir.dx;
      var newY = _player.y + dir.dy;
      
      // Check bounds
      if (newX >= 0 && newX < GRID_WIDTH && newY >= 0 && newY < GRID_HEIGHT) {
        var tile = _grid[newY][newX];
        
        // Check if tile is walkable
        if (tile !== TILES.WALL) {
          actions.push({
            type: 'move',
            direction: dir.name,
            dx: dir.dx,
            dy: dir.dy,
            cmd: dir.cmd,
            targetX: newX,
            targetY: newY
          });
        }
      }
    });

    // Item pickup actions
    _items.forEach(function(item) {
      if (item.x === _player.x && item.y === _player.y) {
        actions.push({
          type: 'pickup',
          item: item
        });
      }
    });

    // Currency pickup actions
    _currencies.forEach(function(currency) {
      if (currency.x === _player.x && currency.y === _player.y) {
        actions.push({
          type: 'pickupCurrency',
          amount: currency.amount
        });
      }
    });

    // Exit action (if on exit tile)
    if (_grid[_player.y][_player.x] === TILES.EXIT) {
      actions.push({ type: 'exit' });
    }

    // Active item use
    if (_player.activeItem) {
      actions.push({
        type: 'useActiveItem',
        item: _player.activeItem
      });
    }

    // Wait/pass action (always available)
    actions.push({ type: 'wait' });

    return actions;
  }

  /**
   * Apply an action to the game state (headless mode)
   * @param {Object} action - Action object from getLegalActions()
   * @returns {Object} Result with success flag and new state
   */
  function applyAction(action) {
    if (!_active) {
      return {
        success: false,
        reason: 'Game not active',
        state: null
      };
    }

    var result = {
      success: false,
      reason: '',
      state: null,
      messages: []
    };

    try {
      if (action.type === 'move') {
        var moveResult = _movePlayer(action.dx, action.dy, false);
        result.success = true;
        result.messages = moveResult.lines || [];
        result.state = getState();
      }
      else if (action.type === 'useCard' && _strCombatActive) {
        var cardResult = handleCardSwipe(action.cardIndex, 'up');
        result.success = true;
        result.messages = cardResult.lines || [];
        result.state = getState();
      }
      else if (action.type === 'flee' && _strCombatActive) {
        var fleeResult = process('flee');
        result.success = true;
        result.messages = fleeResult.lines || [];
        result.state = getState();
      }
      else if (action.type === 'pickup') {
        var pickupResult = process('pickup');
        result.success = true;
        result.messages = pickupResult.lines || [];
        result.state = getState();
      }
      else if (action.type === 'pickupCurrency') {
        // Auto-pickup currency on move
        result.success = true;
        result.messages = ['Picked up ' + action.amount + ' credits'];
        result.state = getState();
      }
      else if (action.type === 'exit') {
        var exitResult = process('exit');
        result.success = true;
        result.messages = exitResult.lines || [];
        result.state = getState();
      }
      else if (action.type === 'useActiveItem') {
        var itemResult = triggerActiveItem();
        result.success = itemResult && itemResult.lines;
        result.messages = itemResult ? itemResult.lines : [];
        result.state = getState();
      }
      else if (action.type === 'wait') {
        // Just advance turn
        _turn++;
        _updateEnemies();
        result.success = true;
        result.messages = ['Waited...'];
        result.state = getState();
      }
      else {
        result.reason = 'Unknown action type: ' + action.type;
      }
    } catch (error) {
      result.success = false;
      result.reason = 'Error executing action: ' + error.message;
    }

    return result;
  }

  /**
   * Get grid data (for map parsing)
   */
  function getGrid() {
    return {
      grid: _grid.map(function(row) { return row.slice(); }),
      width: GRID_WIDTH,
      height: GRID_HEIGHT,
      tiles: TILES
    };
  }

  /**
   * Reset game to specific state (for replay testing)
   */
  function resetToState(state) {
    if (!state) return false;

    try {
      _active = state.active;
      _floor = state.floor;
      _turn = state.turn;
      
      // Restore player
      _player.x = state.player.x;
      _player.y = state.player.y;
      _player.hp = state.player.hp;
      _player.maxHp = state.player.maxHp;
      _player.energy = state.player.energy;
      _player.maxEnergy = state.player.maxEnergy;
      _player.stealth = state.player.stealth;
      _player.detection = state.player.detection;
      _player.lastMoveDirection = state.player.lastMoveDirection;
      _player.str = state.player.str;
      _player.dex = state.player.dex;
      _player.credits = state.player.credits;
      _player.deck = state.player.deck ? state.player.deck.slice() : [];
      _player.activeItem = state.player.activeItem;
      
      // Restore grid
      _grid = state.grid.map(function(row) { return row.slice(); });
      
      // Restore enemies
      _enemies = state.enemies.slice();
      
      // Restore other state
      _breakables = state.breakables ? state.breakables.slice() : [];
      _projectiles = state.projectiles ? state.projectiles.slice() : [];
      _items = state.items ? state.items.slice() : [];
      _currencies = state.currencies ? state.currencies.slice() : [];
      _strCombatActive = state.strCombatActive;
      _alertLevel = state.alertLevel;
      _bossFloorActive = state.bossFloorActive;
      
      return true;
    } catch (error) {
      console.error('Failed to reset state:', error);
      return false;
    }
  }

  // ============================================================
  // END HEADLESS MODE API
  // ============================================================

  return {
    init: init,
    start: start,
    process: process,
    isActive: isActive,
    getPrompt: getPrompt,
    handleTapMove: handleTapMove,
    handleFishingMove: handleFishingMove,
    isWalkable: isWalkable,
    handleCardSwipe: handleCardSwipe,
    handleMultiCardCombat: handleMultiCardCombat,
    getPlayer: getPlayer,
    getEnemies: getEnemies,
    getEnemyAwarenessState: getEnemyAwarenessState,
    getBreakables: function() { return _breakables; },
    getBreakableAt: _getBreakableAt,
    removeBreakableAt: _removeBreakableAt,
    getProjectiles: function() { return _projectiles; },
    fireProjectile: _fireProjectile,
    stepProjectiles: stepProjectiles,
    isStrCombatActive: isStrCombatActive,
    getStrCombatState: getStrCombatState,
    passStrTurn: function() {
      // Pass player's combat turn — enemy attacks unopposed (called on timer expiry)
      if (_strCombatActive) {
        return _executeStrRound('enemy');
      }
    },
    triggerActiveItem: triggerActiveItem,
    updatePlayerLight: _updatePlayerLight,
    
    // Difficulty tier system
    setDifficulty: setDifficulty,
    getDifficulty: getDifficulty,
    onStateChange: onStateChange,

    // Forest biome generation API (per spec)
    createBordersForest: createBordersForest,
    generateForestOpenSpace: generateForestOpenSpace,
    placeVillageCluster: placeVillageCluster,

    // Exploration framework API (for testing)
    DISCOVERY_TIERS: DISCOVERY_TIERS,
    DETAIL_LAYERS: DETAIL_LAYERS,
    _generateDiscoveries: _generateDiscoveries,
    _revealDiscovery: _revealDiscovery,
    _initializeEnvironmentalDetails: _initializeEnvironmentalDetails,

    // Headless mode API (for testing/agent simulation)
    headless: {
      getState: getState,
      getLegalActions: getLegalActions,
      applyAction: applyAction,
      getGrid: getGrid,
      resetToState: resetToState
    }
  };
})();
