/* ============================================================
   EYES ONLY - Gone Rogue Mode Engine
   ASCII stealth roguelike inside terminal column
   ============================================================ */

var GoneRogue = (function () {
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
    currencyCollectTime: 0, // Timestamp of last currency collection
    positionHistory: [] // Position history buffer for pet following (max 16 entries)
  };

  var _ropeManager = null;

  var _enemies = [];
  var _npcs = []; // NPCs on floor (tutorial gates, etc.)
  // NOTE: Don't touch WorldItems at script-load time.
  // Some pages load GoneRogue before WorldItems is initialized; referencing it
  // here prevents the entire module from registering (breaking requestRogue).
  // We sync with WorldItems lazily when the game starts / floor loads.
  var _items = [];
  var _projectiles = [];
  var _breakables = [];
  var _currencies = [];
  var _shops = []; // Shop objects on floor (🏪 or 👤)
  var _placedBoxes = []; // Deployable box entities placed on the map {id, x, y, quality, state, discoveryCount}
  var _playerInBox = null; // Box entity the player is currently hiding inside (or null)
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
  var _projectileTickAccum = 0; // Accumulator for projectile speed throttle (ms)
  var _projectileAdvanceInterval = 150; // Advance projectiles every 150ms for visible animation
  var _enemyColorCycleTime = 0;

  // STR Combat state (Simultaneous Turn Resolution)
  var _strCombatActive = false;
  var _strCombatEnemy = null; // Enemy in current STR combat
  var _strCombatAdvantage = 'neutral'; // 'ambush', 'neutral', 'disadvantaged', 'flanked'
  var _strCombatRound = 0;
  var _strCombatLog = []; // Combat log messages
  var _strCombatAmmoSpent = 0; // Track ammo spent in this combat encounter
  var _strCombatContext = null; // Countdown context messages built at combat entry
  var _strCombatEntryPos = null; // {x,y} where combat began (for soft resets)
  var _strCombatPhase = 'idle'; // Phase state machine: idle → countdown → selecting → resolving → post_resolve → selecting (loop)

  // Performance caches
  var _stealthBonusCache = null; // { bonus, px, py } — invalidated when player moves

  // Boss encounter state
  var _activeBoss = null; // Current boss instance (from BossEncounters module)
  var _bossFloorActive = false; // Is this a boss floor
  var _bossDefeated = false; // Has boss been defeated this floor
  var _bossHazards = []; // Boss-specific hazards (trains, drones, etc.)
  var _bossEnvironment = {}; // Boss-specific environment data
  var _playerMoveLocked = false; // Set by Asteroids boss; disables walk commands
  var _scriptedWalk = false; // True during Floor 0 auto-walk (disables player click input)
  var _scriptedWalkTarget = null; // {x, y} target for scripted walk

  // Secret floor state
  var _activeSecretFloor = null; // Current secret floor type (if any)

  // Difficulty system (UBER 0/1/2) — internally stored as tier 1/2/3 for now.
  // IMPORTANT: selecting an UBER level should NOT teleport biomes.
  // It should apply on the *next spawned floor* (or next run start).
  var _difficultyTier = 1;         // applied tier (1..3)
  var _desiredDifficultyTier = 1;  // requested tier (1..3), applied on next floor spawn
  var _stateChangeCallbacks = []; // Callbacks for state changes (used by AWOL button)

  // Vents system state
  var _vents = []; // Vent objects on current floor { x, y, quality, discovered, used }
  var _ventUseCount = 0; // Total vents used this run (affects success rate)
  var _penaltyFloors = []; // Floors marked as penalty (from vent failures)
  var _previousBiome = null; // Track previous floor biome for bleed
  var _nextBiomePreview = null; // Cache next floor's biome for consistent preview
  var _visitedBiomes = []; // Track visited biomes this run

  // Context-aware key+gate spawn system state
  var _runState = {
    floorsSinceGate: 0,        // Floors since last gate spawn (pity timer)
    floorsSinceKey: 0,         // Floors since last key drop (pity timer)
    visitedGateBiomes: [],     // Biomes entered via gates this run
    keysOwned: [],             // Keys currently in inventory
    lastBiomeEntered: null,    // Last biome gate entered (for cooldown)
    biomeEntryCooldowns: {},   // Cooldown tracker {biomeName: floorsRemaining}
    gatesSpawnedThisRun: 0,    // Total gates spawned
    keysFoundThisRun: 0,       // Total keys found
    firstCombatVictory: false, // Whether player has won first combat
    firstBonfire: false        // Whether player has reached first bonfire
  };

  // Last exit position (for door-anchored spawns)
  var _lastExitPos = null;
  // When true, the next floor generation should spawn near _lastExitPos (used for retreat/backtracking).
  var _spawnFromLastExitPos = null; // 'advance' | 'retreat' | null
  var _lastDoorHintAtMs = 0;
  // Door spawn protection: if we spawn directly on a door tile, ignore activation until the player steps off.
  var _doorSpawnProtect = null; // { x, y }

  // Forest biome state
  var _forestBuildings = []; // Village buildings {x, y, emoji} for visual overlay
  var _biomeVisualGrid = null; // Pre-computed visual substitution grid (wall/floor chars)
  var _biomeBackgroundColors = null; // Pre-computed per-tile background gradient colors (40x20)
  var _tileRenderObjects = null; // Per-tile render objects for visual density (multi-tree scatter)
  var _cachedWalls = []; // Lighting/LOS cache (rebuilt per floor)

  // Seed-based generation for reproducible runs
  var _currentSeed = null;         // Current run seed (for deterministic generation)
  var _currentSeedPhrase = null;   // Human-readable seed phrase
  var _seedRNG = null;             // Seeded RNG instance

  // Highscore tracking variables
  var _runStartTime = null;        // Run start timestamp
  var _runSeed = null;             // Seeded RNG seed for reproducible runs
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

  // Pity timer tracking for card drops
  var _recentCardDrops = [];       // Last 5 card drops { type, category, floor }
  var _pitySince = {               // Floors since last drop of each type
    defensive: 0,
    utility: 0,
    healing: 0
  };

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
    // Door emoji for all doors; behavior determined by tile metadata + overhead popup hints
    DOOR: '🚪',
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
      wallDensity: 2, // Number of additional scatter trees per wall tile

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
      enemyDensity: 0.0,

      // Background gradient (135-degree axial, matching gambling card convention)
      backgroundGradient: {
        night: { start: '#061206', end: '#0d2a12' },  // Deep forest shadow to moonlit glade
        day:   { start: '#081a08', end: '#1e4a1e' }   // Dark canopy to dappled sunlight clearing
      }
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
      ],

      backgroundGradient: {
        night: { start: '#0a0a0f', end: '#0f0a1a' },  // Dark blue-grey
        day:   { start: '#0a0a0f', end: '#0f0a1a' }   // Caves are always dark
      }
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
        { emoji: '🖥️', name: 'Server Rack', interact: 'hack', effect: 'reveals_map' },
        { emoji: '💻', name: 'Terminal', breakable: true, hp: 2, drops: ['thumb_drive'], glows: true, lightType: 'TERMINAL' }
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
      },

      backgroundGradient: {
        night: { start: '#0a0a0a', end: '#0f0f15' },  // Near-black to dark grey-blue
        day:   { start: '#0a0a12', end: '#12121a' }   // Subtle blue tint
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
      },

      backgroundGradient: {
        night: { start: '#0a0a0a', end: '#1a0a0a' },  // Dark to dark-red tint
        day:   { start: '#0f0a0a', end: '#1a1010' }   // Warmer dark red
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
        { emoji: '⏩', name: 'Conveyor Belt', interact: 'walk', effect: 'speed_boost', reversible: true },
        { emoji: '🌫️', name: 'Vent Cover', breakable: true, hp: 3, requiresCrowbar: true, opensVent: true, drops: ['vent_access'] }
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
      },

      backgroundGradient: {
        night: { start: '#0a0a08', end: '#1a1508' },  // Dark to amber-tinted
        day:   { start: '#0f0e08', end: '#1a1a0a' }   // Warm industrial yellow
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
      ],

      backgroundGradient: {
        night: { start: '#08080f', end: '#0f0f1a' },  // Deep space blue
        day:   { start: '#0a0a12', end: '#141420' }   // Lighter space blue
      }
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
  // EXPLORATION FRAMEWORK — Delegated to DiscoverySystem module
  // See public/js/discovery-system.js for full implementation
  // ============================================================

  // Constants: delegate to module, keep local refs for return object
  var DISCOVERY_TIERS = (typeof DiscoverySystem !== 'undefined') ? DiscoverySystem.DISCOVERY_TIERS : {};
  var DETAIL_LAYERS = (typeof DiscoverySystem !== 'undefined') ? DiscoverySystem.DETAIL_LAYERS : {};

  // Local state refs (DiscoverySystem owns the real state)
  var _discoveries = [];
  var _metaDiscoveries = [];
  var _environmentalDetails = {};

  /**
   * RNG helper - uses SeededRNG if available, falls back to Math.random()
   * NOTE: Kept in monolith because many non-discovery functions use it
   */
  function _rng() {
    if (typeof SeededRNG !== 'undefined' && SeededRNG.random) {
      return SeededRNG.random();
    }
    return Math.random();
  }

  /**
   * Update player position history for pet following
   * NOTE: Kept in monolith — player movement, not discovery
   */
  function _updatePositionHistory() {
    var HISTORY_SIZE = 16;

    if (!_player.positionHistory || !Array.isArray(_player.positionHistory)) {
      _player.positionHistory = [];
    }

    _player.positionHistory.unshift({
      x: _player.x,
      y: _player.y,
      facing: _player.lastMoveDirection || 'south'
    });

    if (_player.positionHistory.length > HISTORY_SIZE) {
      _player.positionHistory.pop();
    }
  }

  // ── Pity System delegation stubs ──────────────────────────
  function _categorizeCardForPity(card) {
    if (typeof PitySystem !== 'undefined') return PitySystem.categorizeCardForPity(card);
    return 'other';
  }
  function _trackCardDrop(card) {
    if (typeof PitySystem !== 'undefined') { PitySystem.trackCardDrop(card, _floor); return; }
  }
  function _checkPityTimer() {
    if (typeof PitySystem !== 'undefined') return PitySystem.checkPityTimer();
    return null;
  }
  function _getPityCard(category) {
    if (typeof PitySystem !== 'undefined') return PitySystem.getPityCard(category, _rng);
    return null;
  }
  function _incrementPityTimers() {
    if (typeof PitySystem !== 'undefined') { PitySystem.incrementPityTimers(); return; }
  }

  // ── Discovery delegation stubs ─────────────────────────────

  /** Build context object for DiscoverySystem calls */
  function _discoveryContext() {
    return {
      floor: _floor,
      difficultyTier: _difficultyTier,
      grid: _grid,
      TILES: TILES,
      BIOMES: BIOMES,
      GRID_WIDTH: GRID_WIDTH,
      items: _items,
      spawnCurrency: _spawnCurrency,
      Terminal: (typeof Terminal !== 'undefined') ? Terminal : null
    };
  }

  function _generateDiscoveries(rooms, biome) {
    if (typeof DiscoverySystem !== 'undefined' && DiscoverySystem.generateDiscoveries) {
      _discoveries = DiscoverySystem.generateDiscoveries(rooms, biome, _discoveryContext());
    } else {
      _discoveries = [];
    }
  }

  function _revealDiscovery(x, y) {
    if (typeof DiscoverySystem !== 'undefined' && DiscoverySystem.revealDiscovery) {
      return DiscoverySystem.revealDiscovery(x, y, _discoveryContext());
    }
    return false;
  }

  function _initializeEnvironmentalDetails(room, biome) {
    if (typeof DiscoverySystem !== 'undefined' && DiscoverySystem.initializeEnvironmentalDetails) {
      DiscoverySystem.initializeEnvironmentalDetails(room, biome, _discoveryContext());
    }
  }

  // ============================================================
  // END EXPLORATION FRAMEWORK (delegated)
  // ============================================================

  /**
   * Determine floor type based on floor number
   */
  function _biomeConfigCtx() {
    return {
      FLOOR_TYPES: FLOOR_TYPES,
      BIOMES: BIOMES,
      BONFIRE_FLOORS: BONFIRE_FLOORS,
      BOSS_FLOORS: BOSS_FLOORS,
      rng: _rng,
      getDifficultyTier: function() { return _difficultyTier; }
    };
  }

  function _getFloorType(floorNum) {
    if (typeof BiomeConfig !== 'undefined') {
      return BiomeConfig.getFloorType(floorNum, _biomeConfigCtx());
    }
    return FLOOR_TYPES.COMBAT;
  }

  function _getBiome(floorNum) {
    if (typeof BiomeConfig !== 'undefined') {
      return BiomeConfig.getBiome(floorNum, _biomeConfigCtx());
    }
    return BIOMES.FOREST;
  }

  function init() {
    _loadState();

    // Enable interactive grid UI for all platforms (desktop and mobile)
    _useInteractiveGrid = (typeof GoneRogueMobile !== 'undefined');

    // Initialize interactive grid UI if available
    if (_useInteractiveGrid) {
      GoneRogueMobile.init();
    }

    // Initialize GameLoop module
    if (typeof GameLoop !== 'undefined') {
      GameLoop.init({
        updateGameState: _updateGameState,
        onStart: function() { _enemyColorCycleTime = 0; _lightMapTickCounter = 0; }
      });
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
    if (typeof RunStartSystem !== 'undefined') {
      return RunStartSystem.start(context, _runStartCtx());
    }
    _active = true;
    _loaded = true;
    return _beginGameplay();
  }

  /**
   * Kicks off floor generation, game loop, and UI after all onboarding is done.
   * Called immediately for returning players, or after character creation for new ones.
   */
  function _beginGameplay() {
    if (typeof BeginGameplaySystem !== 'undefined') {
      return BeginGameplaySystem.beginGameplay(_beginGameplayCtx());
    }
    _generateFloor();
    _startGameLoop();
    return { lines: _renderGrid(), prompt: getPrompt(), stayActive: true };
  }

  /**
   * Process player command
   */
  function process(raw) {
    if (typeof CommandProcessSystem !== 'undefined') {
      return CommandProcessSystem.process(raw, _commandProcessCtx());
    }
    if (!_active) return { lines: ['ROGUE MODE INACTIVE', ''], stayActive: false };
    return { lines: ['[Command system not loaded]'], prompt: getPrompt(), stayActive: true };
  }

  function _helpLines() {
    if (typeof RenderingUI !== 'undefined') return RenderingUI.helpLines();
    return ['[Help not available]'];
  }

  function _statusLines() {
    if (typeof RenderingUI !== 'undefined') return RenderingUI.statusLines({ player: _player, floor: _floor, turn: _turn });
    return ['[Status not available]'];
  }

  function _inventoryLines() {
    if (typeof RenderingUI !== 'undefined') return RenderingUI.inventoryLines();
    return ['[Inventory not available]'];
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
  // FLOOR GENERATION CONTEXT BUILDER
  // ============================================================

  function _floorGenCtx() {
    return {
      grid: _grid,
      GRID_WIDTH: GRID_WIDTH,
      GRID_HEIGHT: GRID_HEIGHT,
      TILES: TILES,
      BIOMES: typeof BIOMES !== 'undefined' ? BIOMES : null,
      FLOOR_TYPES: FLOOR_TYPES,
      PATH_TYPES: PATH_TYPES,
      floor: _floor,
      player: _player,
      enemies: _enemies,
      items: _items,
      breakables: _breakables,
      currencies: _currencies,
      npcs: _npcs,
      shops: _shops,
      vents: _vents,
      tileMetadata: _tileMetadata,
      forestBuildings: _forestBuildings,
      biomeVisualGrid: _biomeVisualGrid,
      tileRenderObjects: _tileRenderObjects,
      biomeBackgroundColors: _biomeBackgroundColors,
      currentSeed: _currentSeed,
      rng: _rng,
      getBiome: _getBiome,
      getDifficultyMultiplier: _getDifficultyMultiplier,
      difficultyTier: _difficultyTier,
      penaltyFloors: _penaltyFloors,
      previousBiome: _previousBiome,
      nextBiomePreview: _nextBiomePreview,
      visitedBiomes: _visitedBiomes,
      checkPityTimer: typeof _checkPityTimer === 'function' ? _checkPityTimer : function() { return null; },
      getPityCard: typeof _getPityCard === 'function' ? _getPityCard : function() { return null; },
      trackCardDrop: typeof _trackCardDrop === 'function' ? _trackCardDrop : function() {},
      totalEnemiesSpawned: _totalEnemiesSpawned,
      onEnemySpawned: function() { _totalEnemiesSpawned++; },
      activeBoss: _activeBoss
    };
  }

  // ============================================================
  // FLOOR GENERATION
  // ============================================================

  /**
   * Pick a character from a weighted tiles array.
   * Returns a char chosen by weighted random selection.
   */
  function _pickWeightedChar(tiles) {
    if (typeof BiomeVisuals !== 'undefined') return BiomeVisuals.pickWeightedChar(tiles, _floorGenCtx());
    return tiles[tiles.length - 1].char;
  }
  function _buildBiomeVisualGrid(biome) {
    if (typeof BiomeVisuals !== 'undefined') { BiomeVisuals.buildBiomeVisualGrid(biome, _floorGenCtx()); _biomeVisualGrid = BiomeVisuals.getBiomeVisualGrid(); }
    else { _biomeVisualGrid = null; }
  }
  function _generateTileRenderObjects(x, y, biome) {
    if (typeof BiomeVisuals !== 'undefined') return BiomeVisuals.generateTileRenderObjects(x, y, biome, _floorGenCtx());
    return [];
  }
  function _pickWeightedCharWithRNG(tiles, rng) {
    if (typeof BiomeVisuals !== 'undefined') return BiomeVisuals.pickWeightedCharWithRNG(tiles, rng);
    return tiles[tiles.length - 1].char;
  }
  function _getNeighborTiles(x, y) {
    if (typeof BiomeVisuals !== 'undefined') return BiomeVisuals.getNeighborTiles(x, y, _floorGenCtx());
    return [];
  }
  function _buildTileRenderObjects(biome) {
    if (typeof BiomeVisuals !== 'undefined') { BiomeVisuals.buildTileRenderObjects(biome, _floorGenCtx()); _tileRenderObjects = BiomeVisuals.getRenderObjectsGrid(); }
    else { _tileRenderObjects = null; }
  }
  function _hexToRgb(hex) {
    if (typeof BiomeVisuals !== 'undefined') return BiomeVisuals.hexToRgb(hex);
    return { r: 0, g: 0, b: 0 };
  }
  function _rgbToHex(r, g, b) {
    if (typeof BiomeVisuals !== 'undefined') return BiomeVisuals.rgbToHex(r, g, b);
    return '#000000';
  }
  function _lerpColor(color1, color2, t) {
    if (typeof BiomeVisuals !== 'undefined') return BiomeVisuals.lerpColor(color1, color2, t);
    return color1;
  }
  function _buildBiomeBackgroundColors(biome, isNight) {
    if (typeof BiomeVisuals !== 'undefined') { BiomeVisuals.buildBiomeBackgroundColors(biome, isNight, _floorGenCtx()); _biomeBackgroundColors = BiomeVisuals.getBackgroundColorsGrid(); }
    else { _biomeBackgroundColors = null; }
  }
  function getBiomeBackgroundColor(x, y) {
    if (typeof BiomeVisuals !== 'undefined') return BiomeVisuals.getBiomeBackgroundColor(x, y);
    return null;
  }
  function getTileRenderObjects(x, y) {
    if (typeof BiomeVisuals !== 'undefined') return BiomeVisuals.getTileRenderObjects(x, y);
    return null;
  }

  /**
   * Create hard, nearly square perimeters with natural wall tile distribution.
   * (Exported API function per spec — operates on an external map array.)
   */
  function createBordersForest(map, biome) {
    if (typeof FloorGenerator !== 'undefined') return FloorGenerator.createBordersForest(map, biome, _floorGenCtx());
    return map;
  }

  /**
   * Fill map interior with weighted floor tiles (70-80% walkable open space).
   * (Exported API function per spec — operates on an external map array.)
   */
  function generateForestOpenSpace(map, biome) {
    if (typeof FloorGenerator !== 'undefined') return FloorGenerator.generateForestOpenSpace(map, biome, _floorGenCtx());
    return map;
  }

  /**
   * Place a village cluster (buildings + decorations) in the lower-left quadrant.
   * (Exported API function per spec — operates on an external map array.)
   */
  function placeVillageCluster(map, biome) {
    if (typeof FloorGenerator !== 'undefined') return FloorGenerator.placeVillageClusterOnMap(map, biome, _floorGenCtx());
    return map;
  }

  /**
   * Internal: place village cluster on _grid, recording buildings in _forestBuildings
   * so they can be visually overlaid during rendering.
   * Buildings are stored as TILES.WALL in the logical grid for collision.
   */
  function _placeVillageCluster(biome) {
    if (typeof FloorGenerator !== 'undefined') {
      FloorGenerator.placeVillageCluster(biome, _floorGenCtx());
    }
  }

  /**
   * Generate contrived tutorial floor using hand-crafted layouts (floors 1-3)
   * Uses TutorialFloors module for designer-friendly level definitions
   */
  function _generateContrivedTutorialFloor() {
    if (typeof TutorialFloorGen !== 'undefined') {
      return TutorialFloorGen.generateContrivedTutorialFloor(_tutorialFloorGenCtx());
    }
    console.warn('[GoneRogue] TutorialFloorGen module not loaded');
  }

  function _generateFloor(secretFloorData) {
    if (typeof FloorGenCore !== 'undefined') {
      return FloorGenCore.generateFloor(secretFloorData, _floorGenCoreCtx());
    }
    console.warn('[GoneRogue] FloorGenCore module not loaded');
  }

  function _createEmptyGrid() {
    if (typeof FloorGenerator !== 'undefined') return FloorGenerator.createEmptyGrid(_floorGenCtx());
    var grid = [];
    for (var y = 0; y < GRID_HEIGHT; y++) { var row = []; for (var x = 0; x < GRID_WIDTH; x++) row.push(TILES.WALL); grid.push(row); }
    return grid;
  }

  function _generateRooms(floorType) {
    if (typeof FloorGenerator !== 'undefined') return FloorGenerator.generateRooms(floorType, _floorGenCtx());
    return [];
  }

  function _connectRooms(rooms) {
    if (typeof FloorGenerator !== 'undefined') { FloorGenerator.connectRooms(rooms, _floorGenCtx()); return; }
  }

  function _carveCorridor(x1, y1, x2, y2) {
    if (typeof FloorGenerator !== 'undefined') { FloorGenerator.carveCorridor(x1, y1, x2, y2, _floorGenCtx()); return; }
  }

  function _addBranchConnections(rooms) {
    if (typeof FloorGenerator !== 'undefined') { FloorGenerator.addBranchConnections(rooms, _floorGenCtx()); return; }
  }

  function _placeCover() {
    if (typeof FloorGenerator !== 'undefined') { FloorGenerator.placeCover(_floorGenCtx()); return; }
  }

  function _placeShadowZones() {
    if (typeof FloorGenerator !== 'undefined') { FloorGenerator.placeShadowZones(_floorGenCtx()); return; }
  }

  function _placeEnvironmentalTiles() {
    if (typeof FloorGenerator !== 'undefined') { FloorGenerator.placeEnvironmentalTiles(_floorGenCtx()); return; }
  }

  function _ensurePlayerOnEmptyTile() {
    if (typeof FloorGenerator !== 'undefined') { FloorGenerator.ensurePlayerOnEmptyTile(_floorGenCtx()); return; }
    // Inline fallback
    try {
      if (!_player || !_grid) return;
      _player.x = Math.max(1, Math.min(GRID_WIDTH - 2, _player.x | 0));
      _player.y = Math.max(1, Math.min(GRID_HEIGHT - 2, _player.y | 0));
    } catch (e0) {}
  }

  function _placePlayerAndExit(rooms) {
    if (typeof FloorGenerator !== 'undefined') return FloorGenerator.placePlayerAndExit(rooms, _floorGenCtx());
    return { playerX: 5, playerY: 10, exitX: GRID_WIDTH - 3, exitY: GRID_HEIGHT - 3 };
  }

  function _placeEnemies(rooms, floorType) {
    if (typeof FloorGenerator !== 'undefined') { FloorGenerator.placeEnemies(rooms, floorType, _floorGenCtx()); return; }
  }

  function _choosePatrolType(difficulty, room) {
    if (typeof FloorGenerator !== 'undefined') return FloorGenerator.choosePatrolType(difficulty, room, _floorGenCtx());
    return PATH_TYPES.STATIONARY;
  }

  function _createEnemy(x, y, patrolType, room) {
    if (typeof FloorGenerator !== 'undefined') return FloorGenerator.createEnemy(x, y, patrolType, room, _floorGenCtx());
    return { x: x, y: y, hp: 5, maxHp: 5, str: 3, dex: 3, awareness: 0, orientation: 'north', sightRange: 5, pathTimer: 0, isTreasureGoblin: false, goblinSpawnTime: null, isPenalty: false, path: { type: PATH_TYPES.STATIONARY } };
  }

  function _placeItems(floorType) {
    if (typeof FloorGenerator !== 'undefined') { FloorGenerator.placeItems(floorType, _floorGenCtx()); return; }
  }

  function _spawnShops(rooms, floorType) {
    if (typeof FloorGenerator !== 'undefined') { FloorGenerator.spawnShops(rooms, floorType, _floorGenCtx()); return; }
  }

  function _spawnVents(rooms, floorType) {
    if (typeof FloorGenerator !== 'undefined') { FloorGenerator.spawnVents(rooms, floorType, _floorGenCtx()); return; }
  }

  function _applyBiomeBleed(rooms) {
    if (typeof FloorGenerator !== 'undefined') {
      var currentBiome = FloorGenerator.applyBiomeBleed(rooms, _floorGenCtx());
      if (currentBiome) { _previousBiome = currentBiome; _nextBiomePreview = null; }
      return;
    }
  }

  function _applyBleedTiles(biome, location, minCount, maxCount) {
    if (typeof FloorGenerator !== 'undefined') { FloorGenerator.applyBleedTiles(biome, location, minCount, maxCount, _floorGenCtx()); return; }
  }

  function _getBleedChar(biome) {
    if (typeof FloorGenerator !== 'undefined') return FloorGenerator.getBleedChar(biome, _floorGenCtx());
    return null;
  }

  function _validateStealthPath(startX, startY, endX, endY) {
    if (typeof FloorGenerator !== 'undefined') return FloorGenerator.validateStealthPath(startX, startY, endX, endY, _floorGenCtx());
    return true;
  }

  function _spawnBreakables() {
    if (typeof BreakableSpawner !== 'undefined') {
      return BreakableSpawner.spawnBreakables({
        TILES: TILES, GRID_WIDTH: GRID_WIDTH, GRID_HEIGHT: GRID_HEIGHT,
        rng: _rng, player: _player, grid: _grid,
        getFloor: function() { return _floor; },
        getBiome: _getBiome,
        setBreakables: function(v) { _breakables = v; }
      });
    }
  }

  /**
   * Place guaranteed tutorial gate blocking path to exit
   * Ensures gate is on a direct path between player and exit
   * Spawns tutorial pickups (currency, ammo, card) behind the gate
   */
  // ── BiomeGateSystem delegation ──
  function _biomeGateCtx() {
    return {
      player: _player, grid: _grid, breakables: _breakables, items: _items,
      runState: _runState, floor: _floor, TILES: TILES, BOSS_FLOORS: BOSS_FLOORS,
      rng: _rng, spawnCurrency: _spawnCurrency,
      getPlayerKeys: _getPlayerKeys, countUnmatchedKeys: _countUnmatchedKeys,
      playerHasKeyForBiome: _playerHasKeyForBiome, getBiomeForKey: _getBiomeForKey,
      weightedBiomeRoll: _weightedBiomeRoll
    };
  }
  function _placeTutorialGate(exitX, exitY) {
    if (typeof BiomeGateSystem !== 'undefined') {
      BiomeGateSystem.placeTutorialGate(exitX, exitY, _biomeGateCtx());
    }
  }
  function _placeBiomeGates(rooms, exitX, exitY, biome) {
    if (typeof BiomeGateSystem !== 'undefined') {
      BiomeGateSystem.placeBiomeGates(rooms, exitX, exitY, biome, _biomeGateCtx());
    }
  }

  /**
   * Helper: Get player's current keys from inventory
   */
  // ── Key/Loot Gen delegation stubs (Phase 6) ──────────────
  function _keyLootCtx() {
    return {
      floor: _floor, rng: _rng, grid: _grid, player: _player,
      items: _items, runState: _runState, TILES: TILES
    };
  }

  function _getPlayerKeys(opts) {
    if (typeof KeyLootGen !== 'undefined') return KeyLootGen.getPlayerKeys(opts);
    return [];
  }

  function _getKeyTier(keyType) {
    if (typeof KeyLootGen !== 'undefined') return KeyLootGen.getKeyTier(keyType);
    return 1;
  }

  function _playerHasKeyForBiome(playerKeys, biomeName) {
    if (typeof KeyLootGen !== 'undefined') return KeyLootGen.playerHasKeyForBiome(playerKeys, biomeName);
    return false;
  }

  function _getBiomeForKey(keyType) {
    if (typeof KeyLootGen !== 'undefined') return KeyLootGen.getBiomeForKey(keyType);
    return null;
  }

  function _countUnmatchedKeys(playerKeys) {
    if (typeof KeyLootGen !== 'undefined') return KeyLootGen.countUnmatchedKeys(playerKeys, _runState.visitedGateBiomes);
    return 0;
  }

  function _weightedBiomeRoll(weights) {
    if (typeof KeyLootGen !== 'undefined') return KeyLootGen.weightedRoll(weights, _rng);
    return null;
  }

  function _spawnContextAwareKey(rooms) {
    if (typeof KeyLootGen !== 'undefined') {
      var ctx = _keyLootCtx();
      ctx.rooms = rooms;
      KeyLootGen.spawnContextAwareKey(ctx);
      return;
    }
  }

  function _weightedKeyRoll(weights) {
    if (typeof KeyLootGen !== 'undefined') return KeyLootGen.weightedRoll(weights, _rng);
    return null;
  }

  // ── Currency Spawning delegation stubs (Phase 6) ─────────
  function _currencyCtx() {
    return {
      currencies: _currencies, grid: _grid, rng: _rng, TILES: TILES,
      player: _player, strCombatActive: _strCombatActive,
      currencyCollected: _currencyCollected
    };
  }

  function _spawnCurrency(x, y, amount) {
    if (typeof CurrencySpawning !== 'undefined') {
      CurrencySpawning.spawnCurrency(x, y, amount, _currencyCtx());
      return;
    }
    _currencies.push({ x: x, y: y, amount: amount, glyph: '¢', emoji: '💰', spawnTime: Date.now(), decayTime: 20000 });
  }

  function _magnetAutoCollect(now) {
    if (typeof CurrencySpawning !== 'undefined') {
      var ctx = _currencyCtx();
      _currencyCollected = CurrencySpawning.magnetAutoCollect(now, ctx);
      return;
    }
  }

  function _scatterPostCombatNodes(enemy, victoryCtx) {
    if (typeof CurrencySpawning !== 'undefined') {
      CurrencySpawning.scatterPostCombatNodes(enemy, victoryCtx, _currencyCtx());
      return;
    }
  }

  // ── Rendering/UI delegation stubs (Phase 7) ──────────────
  function _renderCtx() {
    return {
      grid: _grid, biomeVisualGrid: _biomeVisualGrid, breakables: _breakables,
      tileMetadata: _tileMetadata, enemies: _enemies, items: _items,
      projectiles: _projectiles, player: _player, floor: _floor, turn: _turn,
      alertLevel: _alertLevel, strCombatActive: _strCombatActive,
      bossFloorActive: _bossFloorActive, bossDefeated: _bossDefeated,
      activeBoss: _activeBoss, activeSecretFloor: _activeSecretFloor,
      penaltyFloors: _penaltyFloors, TILES: TILES,
      GRID_WIDTH: GRID_WIDTH, GRID_HEIGHT: GRID_HEIGHT, getBiome: _getBiome
    };
  }

  function _renderGrid() {
    if (typeof RenderingUI !== 'undefined') return RenderingUI.renderGrid(_renderCtx());
    return ['[Rendering module not loaded]'];
  }

  /**
   * Helper to update mobile grid rendering with state
   */
  function _updateMobileGrid() {
    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      var displayGrid = _biomeVisualGrid || _grid;
      GoneRogueMobile.renderGrid(displayGrid, _player, _enemies, _items, _enemyColorCycleTime, _breakables, _projectiles, _alertLevel, _strCombatActive, _muzzleFlash, _impactEffects, _currencies, _npcs, _tileMetadata);
    }
  }

  function _updateReserveSlots() {
    if (typeof RenderingUI !== 'undefined') { RenderingUI.updateReserveSlots(); return; }
  }

  function _updateSeedDisplay() {
    if (typeof RenderingUI !== 'undefined') { RenderingUI.updateSeedDisplay(_currentSeedPhrase, _difficultyTier); return; }
  }

  // ── NpcGateSystem context builder ──
  function _npcGateCtx() {
    return {
      player: _player, grid: _grid, npcs: _npcs,
      tileMetadata: _tileMetadata, TILES: TILES,
      GRID_WIDTH: GRID_WIDTH, GRID_HEIGHT: GRID_HEIGHT,
      turn: _turn,
      npcShowEmoji: _npcShowEmoji, npcSay: _npcSay,
      enterStrCombat: function(enemy, trigger) {
        if (!_strCombatActive) return _enterStrCombat(enemy, trigger);
      },
      get lastDoorHintAtMs() { return _lastDoorHintAtMs; },
      set lastDoorHintAtMs(v) { _lastDoorHintAtMs = v; }
    };
  }

  function _getNpcById(npcId) {
    if (typeof NpcGateSystem !== 'undefined') {
      return NpcGateSystem.getNpcById(npcId, _npcGateCtx());
    }
    return null;
  }

  function _npcShowEmoji(npc, emoji, ms) {
    if (typeof RenderingUI !== 'undefined') { RenderingUI.npcShowEmoji(npc, emoji, ms); return; }
  }

  function _npcSay(npc, text) {
    if (typeof RenderingUI !== 'undefined') { RenderingUI.npcSay(npc, text); return; }
  }

  function _combatPhaseTooltip(phase, details, ms) {
    if (typeof RenderingUI !== 'undefined') { RenderingUI.combatPhaseTooltip(phase, details, ms); return; }
  }

  function _clearNpcGateZones(npcId) {
    if (typeof NpcGateSystem !== 'undefined') {
      return NpcGateSystem.clearNpcGateZones(npcId, _npcGateCtx());
    }
  }

  function _startNpcGateCombat(npc) {
    if (typeof NpcGateSystem !== 'undefined') {
      return NpcGateSystem.startNpcGateCombat(npc, _npcGateCtx());
    }
  }

  /**
   * Check if a grid position is walkable (used by pathfinding and collision)
   */
  function _isWalkable(x, y) {
    // Bounds check
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return false;

    // Wall check
    var tile = _grid[y][x];
    if (tile === TILES.WALL) return false;

    // Breakable with HP blocks movement
    var breakable = _getBreakableAt(x, y);
    if (breakable && breakable.hp > 0) return false;

    return true;
  }

  // ── PlayerInteractionSystem delegation ──
  function _playerInteractionCtx() {
    return {
      player: _player, grid: _grid, items: _items, enemies: _enemies,
      currencies: _currencies, shops: _shops, tileMetadata: _tileMetadata,
      TILES: TILES, GRID_WIDTH: GRID_WIDTH, GRID_HEIGHT: GRID_HEIGHT,
      get floor() { return _floor; },
      get playerInBox() { return _playerInBox; },
      incrementTurn: function() { _turn++; },
      updatePositionHistory: _updatePositionHistory,
      getDoorSpawnProtect: function() { return _doorSpawnProtect; },
      clearDoorSpawnProtect: function() { _doorSpawnProtect = null; },
      getTileMetadata: function(x, y) { return _tileMetadata[x + ',' + y]; },
      retreatFloor: _retreatFloor,
      attemptExtract: _attemptExtract,
      exitInteriorFloor: _exitInteriorFloor,
      enterInteriorFloor: _enterInteriorFloor,
      maybeHintNearbyDoors: _maybeHintNearbyDoors,
      pickupItem: _pickupItem,
      revealDiscovery: _revealDiscovery,
      getBoxAt: _getBoxAt,
      playerEnterBox: _playerEnterBox,
      playerExitBox: _playerExitBox,
      enterStrCombat: function(enemy, trigger) {
        if (!_strCombatActive) _enterStrCombat(enemy, trigger);
      },
      addCurrencyCollected: function(amt) { _currencyCollected += amt; },
      filterCurrencies: function(x, y) {
        _currencies = WorldItems.filterCurrencies(function(c) { return c.x !== x || c.y !== y; });
      }
    };
  }
  function _checkPlayerInteractions() {
    // Ensure _items is synced with WorldItems before checking interactions
    // (guards against reference desync from filterFloorItems reassignment)
    if (typeof WorldItems !== 'undefined') {
      _items = WorldItems.getFloorItems();
      _currencies = WorldItems.getCurrencies();
    }
    if (typeof PlayerInteractionSystem !== 'undefined') {
      PlayerInteractionSystem.checkPlayerInteractions(_playerInteractionCtx());
    }
  }

  function _movePlayer(dx, dy, runMode) {
    if (typeof MovePlayerSystem !== 'undefined') {
      return MovePlayerSystem.movePlayer(dx, dy, runMode, _movePlayerCtx());
    }
    return { lines: ['[Move system not loaded]'], prompt: getPrompt(), stayActive: true };
  }

  /**
   * Apply tile effects when player enters a tile
   */
  // ── GroundEffectsSystem context builder ──
  function _groundEffectsCtx() {
    return {
      grid: _grid, tileMetadata: _tileMetadata, player: _player,
      TILES: TILES, rng: _rng, strCombatEnemy: _strCombatEnemy,
      handlePlayerDeath: _handlePlayerDeath
    };
  }

  function _applyTileEffects(x, y) {
    if (typeof GroundEffectsSystem !== 'undefined') {
      return GroundEffectsSystem.applyTileEffects(x, y, _groundEffectsCtx());
    }
    // fallback: no tile effects
    return null;
  }

  function _applyWaterSlowdownEffect() {
    if (typeof GroundEffectsSystem !== 'undefined') {
      return GroundEffectsSystem.applyWaterSlowdownEffect();
    }
  }

  function _updateAlertLevel() {
    if (typeof RenderingUI !== 'undefined') {
      _alertLevel = RenderingUI.updateAlertLevel({ player: _player });
      return;
    }
    if (_player.detection >= 8) _alertLevel = 'danger';
    else if (_player.detection >= 4) _alertLevel = 'caution';
    else _alertLevel = 'safe';
  }

  // ── PickupSystem delegation ──
  function _pickupCtx() {
    return {
      player: _player, items: _items,
      renderGrid: _renderGrid, getPrompt: getPrompt,
      setLastPickupMessage: function(msg) { _lastPickupMessage = msg; },
      filterItems: function(item) {
        _items = WorldItems.filterFloorItems(function(i) { return i !== item; });
      }
    };
  }
  function _pickupItem() {
    if (typeof PickupSystem !== 'undefined') {
      return PickupSystem.pickupItem(_pickupCtx());
    }
    return { lines: ['PICKUP SYSTEM UNAVAILABLE'], prompt: getPrompt(), stayActive: true };
  }

  function _attemptPickpocket() {
    if (typeof PlayerActionSystem !== 'undefined') {
      return PlayerActionSystem.attemptPickpocket(_playerActionCtx());
    }
    return { lines: ['STEAL SYSTEM UNAVAILABLE', ''], prompt: getPrompt(), stayActive: true };
  }

  function _attemptExtract() {
    if (typeof PlayerActionSystem !== 'undefined') {
      return PlayerActionSystem.attemptExtract(_playerActionCtx());
    }
    return _advanceFloor();
  }

  /**
   * Handle vent interaction and bypass attempt
   */
  // ── VentSystem context builder ──
  function _ventCtx() {
    return {
      player: _player, grid: _grid, vents: _vents,
      penaltyFloors: _penaltyFloors, TILES: TILES, rng: _rng,
      getPrompt: getPrompt, advanceFloor: _advanceFloor,
      get floor() { return _floor; },
      set floor(v) { _floor = v; },
      get ventUseCount() { return _ventUseCount; },
      set ventUseCount(v) { _ventUseCount = v; },
      get difficultyTier() { return _difficultyTier; }
    };
  }

  function _handleVentInteraction() {
    if (typeof VentSystem !== 'undefined') {
      return VentSystem.handleVentInteraction(_ventCtx());
    }
    return { lines: ['VENT SYSTEM UNAVAILABLE'], prompt: getPrompt(), stayActive: true };
  }

  function _awardSkippedFloorXP() {
    if (typeof VentSystem !== 'undefined') {
      return VentSystem.awardSkippedFloorXP(_floor);
    }
  }

  // ── LockedGateSystem context builder ──
  function _lockedGateCtx() {
    return {
      player: _player, grid: _grid, tileMetadata: _tileMetadata,
      items: _items, impactEffects: _impactEffects,
      TILES: TILES, rng: _rng,
      getPrompt: getPrompt, renderGrid: _renderGrid, saveState: _saveState,
      rebuildWallCache: _rebuildWallCache,
      getPlayerKeys: _getPlayerKeys, getKeyTier: _getKeyTier,
      consumeActiveItemIfMatches: _consumeActiveItemIfMatches,
      consumeKeyFromInventory: _consumeKeyFromInventory,
      spawnCurrency: _spawnCurrency,
      handleVentInteraction: _handleVentInteraction,
      updateMobileGrid: (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') ? _updateMobileGrid : null
    };
  }

  function _findAdjacentLockedGate() {
    if (typeof LockedGateSystem !== 'undefined') {
      return LockedGateSystem.findAdjacentLockedGate(_lockedGateCtx());
    }
    return null;
  }

  function _consumeActiveItemIfMatches(requiredKey) {
    if (typeof InventoryManagement !== 'undefined') return InventoryManagement.consumeActiveItemIfMatches(requiredKey);
    return false;
  }

  function _consumeKeyFromInventory(requiredKey) {
    if (typeof InventoryManagement !== 'undefined') return InventoryManagement.consumeKeyFromInventory(requiredKey);
    return false;
  }

  function _consumeQuestItem(questKeyType, npcTarget) {
    if (typeof InventoryManagement !== 'undefined') return InventoryManagement.consumeQuestItem(questKeyType, npcTarget);
    return false;
  }

  function _attemptUnlockLockedGate(gx, gy, meta, opts) {
    if (typeof LockedGateSystem !== 'undefined') {
      return LockedGateSystem.attemptUnlockLockedGate(gx, gy, meta, opts, _lockedGateCtx());
    }
    return { lines: ['GATE SYSTEM UNAVAILABLE'], prompt: getPrompt(), stayActive: true };
  }

  /**
   * Handle interaction with interactive items
   */
  function _handleInteraction() {
    if (typeof LockedGateSystem !== 'undefined') {
      return LockedGateSystem.handleInteraction(_lockedGateCtx());
    }
    return { lines: ['Nothing to interact with'], prompt: getPrompt(), stayActive: true };
  }

  // =========================================================================
  // Interior Floor System — Enter/exit building interiors (tavern, church, etc.)
  // Uses InteriorFloors module for authored layouts and dot-notation floor IDs.
  // =========================================================================
  var _interiorFloorStack = []; // Stack of { floorId, playerPos } for nested interiors
  var _currentInteriorFloorId = null; // Current interior floor ID (null if on main floor)

  // ── InteriorFloorSystem delegation ──
  function _interiorFloorCtx() {
    return {
      player: _player, interiorFloorStack: _interiorFloorStack,
      useInteractiveGrid: _useInteractiveGrid,
      TILES: TILES, GRID_WIDTH: GRID_WIDTH, GRID_HEIGHT: GRID_HEIGHT,
      get currentInteriorFloorId() { return _currentInteriorFloorId; },
      set currentInteriorFloorId(v) { _currentInteriorFloorId = v; },
      get floor() { return _floor; },
      setGrid: function(g) { _grid = g; },
      getGrid: function() { return _grid; },
      setEnemies: function(e) { _enemies = e; },
      setBreakables: function(b) { _breakables = b; },
      getBreakables: function() { return _breakables; },
      syncWorldItems: function() { _items = WorldItems.getFloorItems(); _currencies = WorldItems.getCurrencies(); },
      getItems: function() { return _items; },
      getCurrencies: function() { return _currencies; },
      setNpcs: function(n) { _npcs = n; },
      getNpcs: function() { return _npcs; },
      setForestBuildings: function(f) { _forestBuildings = f; },
      addForestBuilding: function(b) { _forestBuildings.push(b); },
      setTileMetadata: function(m) { _tileMetadata = m; },
      setTileMetadataAt: function(x, y, val) { _tileMetadata[x + ',' + y] = val; },
      clearVisualCaches: function() { _biomeVisualGrid = null; _biomeBackgroundColors = null; _tileRenderObjects = null; _cachedWalls = []; },
      ensurePlayerOnEmptyTile: _ensurePlayerOnEmptyTile,
      rebuildWallCache: _rebuildWallCache,
      getWallCache: function() { return _wallCache; },
      getAllLightBlockers: _getAllLightBlockers,
      updatePlayerLight: _updatePlayerLight,
      startGameLoop: _startGameLoop
    };
  }
  function _enterInteriorFloor(targetFloorId) {
    if (typeof InteriorFloorSystem !== 'undefined') {
      InteriorFloorSystem.enterInteriorFloor(targetFloorId, _interiorFloorCtx());
    }
  }

  // ── FloorTransitionSystem delegation ──
  function _floorTransitionCtx() {
    return {
      player: _player, interiorFloorStack: _interiorFloorStack,
      useInteractiveGrid: _useInteractiveGrid, rng: _rng,
      get floor() { return _floor; },
      set floor(v) { _floor = v; },
      get turn() { return _turn; },
      set turn(v) { _turn = v; },
      get currentInteriorFloorId() { return _currentInteriorFloorId; },
      set currentInteriorFloorId(v) { _currentInteriorFloorId = v; },
      get lastExitPos() { return _lastExitPos; },
      set lastExitPos(v) { _lastExitPos = v; },
      get spawnFromLastExitPos() { return _spawnFromLastExitPos; },
      set spawnFromLastExitPos(v) { _spawnFromLastExitPos = v; },
      get vendor() { return _vendor; },
      set vendor(v) { _vendor = v; },
      get vendorInventory() { return _vendorInventory; },
      set vendorInventory(v) { _vendorInventory = v; },
      enterInteriorFloor: _enterInteriorFloor,
      generateFloor: _generateFloor,
      startGameLoop: _startGameLoop,
      saveState: _saveState,
      renderGrid: _renderGrid,
      getPrompt: getPrompt,
      applyDesiredDifficultyTier: _applyDesiredDifficultyTier,
      updateMobileGrid: (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') ? _updateMobileGrid : null,
      // Function-style accessors for FloorTransitionSystem compatibility
      getFloor: function() { return _floor; },
      setFloor: function(v) { _floor = v; },
      setTurn: function(v) { _turn = v; },
      setLastExitPos: function(v) { _lastExitPos = v; },
      setSpawnFromLastExitPos: function(v) { _spawnFromLastExitPos = v; },
      setCurrentInteriorFloorId: function(v) { _currentInteriorFloorId = v; },
      resetVendor: function() { _vendor = null; _vendorInventory = []; },
      showMobileUI: (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') ? function() { GoneRogueMobile.show(); } : null
    };
  }
  function _exitInteriorFloor() {
    if (typeof FloorTransitionSystem !== 'undefined') {
      FloorTransitionSystem.exitInteriorFloor(_floorTransitionCtx());
    }
  }
  function _retreatFloor() {
    if (typeof FloorTransitionSystem !== 'undefined') {
      FloorTransitionSystem.retreatFloor(_floorTransitionCtx());
    }
  }
  function _advanceFloor() {
    if (typeof FloorTransitionSystem !== 'undefined') {
      return FloorTransitionSystem.advanceFloor(_floorTransitionCtx());
    }
    return { lines: ['EXTRACTING...'], prompt: getPrompt(), stayActive: true };
  }

  /**
   * Initialize vendor for bonfire floor
   */
  // ── Vendor System delegation stubs (Phase 8) ─────────────
  function _vendorCtx() {
    return {
      floor: _floor, player: _player, rng: _rng,
      VENDOR_TYPES: VENDOR_TYPES, FLOOR_TYPES: FLOOR_TYPES,
      getFloorType: _getFloorType, getPrompt: getPrompt,
      renderGrid: _renderGrid, saveState: _saveState
    };
  }
  function _syncVendorState() {
    if (typeof VendorSystem === 'undefined') return;
    _vendor = VendorSystem.getVendor();
    _vendorInventory = VendorSystem.getVendorInventory();
  }

  function _initializeVendor() {
    if (typeof VendorSystem !== 'undefined') { VendorSystem.initializeVendor(_vendorCtx()); _syncVendorState(); return; }
  }

  function _showVendor() {
    if (typeof VendorSystem !== 'undefined') { var r = VendorSystem.showVendor(_vendorCtx()); _syncVendorState(); return r; }
    return { lines: ['[Vendor module not loaded]'], prompt: getPrompt(), stayActive: true };
  }

  function _buyFromVendor(cmd) {
    if (typeof VendorSystem !== 'undefined') { var r = VendorSystem.buyFromVendor(cmd, _vendorCtx()); _syncVendorState(); return r; }
    return { lines: ['[Vendor module not loaded]'], prompt: getPrompt(), stayActive: true };
  }

  function _healAtBonfire() {
    if (typeof VendorSystem !== 'undefined') return VendorSystem.healAtBonfire(_vendorCtx());
    return { lines: ['[Vendor module not loaded]'], prompt: getPrompt(), stayActive: true };
  }

  function _gambleCard() {
    if (typeof VendorSystem !== 'undefined') return VendorSystem.gambleCard(_vendorCtx());
    return { lines: ['[Vendor module not loaded]'], prompt: getPrompt(), stayActive: true };
  }

  // ── Inventory Management delegation stubs (Phase 8) ──────
  function _invMgmtCtx() {
    return {
      floor: _floor, getFloorType: _getFloorType, FLOOR_TYPES: FLOOR_TYPES,
      getPrompt: getPrompt, renderGrid: _renderGrid, inventoryLines: _inventoryLines,
      updatePlayerLight: _updatePlayerLight
    };
  }

  function _stashCard(cmd) {
    if (typeof InventoryManagement !== 'undefined') return InventoryManagement.stashCard(cmd, _invMgmtCtx());
    return { lines: ['[Inventory module not loaded]'], prompt: getPrompt(), stayActive: true };
  }

  function _retrieveCard(cmd) {
    if (typeof InventoryManagement !== 'undefined') return InventoryManagement.retrieveCard(cmd, _invMgmtCtx());
    return { lines: ['[Inventory module not loaded]'], prompt: getPrompt(), stayActive: true };
  }

  function _equipItem(cmd) {
    if (typeof InventoryManagement !== 'undefined') return InventoryManagement.equipItem(cmd, _invMgmtCtx());
    return { lines: ['[Inventory module not loaded]'], prompt: getPrompt(), stayActive: true };
  }

  function _unequipItem() {
    if (typeof InventoryManagement !== 'undefined') return InventoryManagement.unequipItem(_invMgmtCtx());
    return { lines: ['[Inventory module not loaded]'], prompt: getPrompt(), stayActive: true };
  }

  /**
   * Submit highscore at end of run
   */
  // ── HighscoreSystem delegation ──
  function _highscoreCtx() {
    return {
      floor: _floor, runStartTime: _runStartTime, runCompleted: _runCompleted,
      playerDeaths: _playerDeaths, enemiesKilled: _enemiesKilled,
      totalEnemiesSpawned: _totalEnemiesSpawned,
      currencyCollected: _currencyCollected, totalDamageDealt: _totalDamageDealt,
      maxSingleHit: _maxSingleHit, damageMitigated: _damageMitigated,
      totalBreakableDamage: _totalBreakableDamage
    };
  }
  function _submitHighscore() {
    if (typeof HighscoreSystem !== 'undefined') {
      HighscoreSystem.submitHighscore(_highscoreCtx());
    }
  }

  /**
   * Handle player death
   * @param {string} reason - Death reason (environmental_hazard, combat_damage, etc.)
   * @param {Object} context - Additional context {enemy, damage}
   * @returns {Object} Action object with death screen
   */
  // ── DeathExitSystem context builder ──
  function _deathExitCtx() {
    return {
      player: _player, items: _items, runState: _runState,
      floor: _floor, runStartTime: _runStartTime, runCompleted: _runCompleted,
      enemiesKilled: _enemiesKilled, currencyCollected: _currencyCollected,
      totalEnemiesSpawned: _totalEnemiesSpawned,
      totalBreakableDamage: _totalBreakableDamage,
      damageMitigated: _damageMitigated,
      strCombatActive: _strCombatActive, strCombatEnemy: _strCombatEnemy,
      get playerDeaths() { return _playerDeaths; },
      set playerDeaths(v) { _playerDeaths = v; },
      submitHighscore: _submitHighscore,
      spawnCurrency: _spawnCurrency,
      stopGameLoop: _stopGameLoop,
      setActive: function(v) { _active = v; },
      setStrCombatActive: function(v) { _strCombatActive = v; },
      setStrCombatPhase: function(v) { _strCombatPhase = v; },
      setStrCombatEnemy: function(v) { _strCombatEnemy = v; },
      hideMobileUI: (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') ? function() { GoneRogueMobile.hide(); } : null
    };
  }

  function _handlePlayerDeath(reason, context) {
    if (typeof DeathExitSystem !== 'undefined') {
      return DeathExitSystem.handlePlayerDeath(reason, context, _deathExitCtx());
    }
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
    if (typeof DeathExitSystem !== 'undefined') {
      return DeathExitSystem.handleEnemyDeath(enemy, source, context, _deathExitCtx());
    }
    // Minimal fallback
    if (source === 'player' || source === 'player_environment') _enemiesKilled++;
    return { playerCredit: true, loot: { cards: [], charms: [], currency: 0, xp: 0 }, messages: [] };
  }

  function _exitRogue(success) {
    if (typeof DeathExitSystem !== 'undefined') {
      return DeathExitSystem.exitRogue(success, _deathExitCtx());
    }
    // Minimal fallback
    _active = false;
    _stopGameLoop();
    return { lines: ['', 'EXITING GONE ROGUE', ''], stayActive: false };
  }

  /**
   * Start the game loop
   */
  function _startGameLoop() {
    if (typeof GameLoop !== 'undefined') { GameLoop.start(); return; }
    _gameLoopActive = true;
  }

  function _stopGameLoop() {
    if (typeof GameLoop !== 'undefined') { GameLoop.stop(); return; }
    _gameLoopActive = false;
  }

  /**
   * Update all game state (enemies, awareness, etc.)
   */
  function _updateGameState(deltaMs) {
    if (typeof GameTickSystem !== 'undefined') {
      return GameTickSystem.updateGameState(deltaMs, _gameTickCtx());
    }
  }

  // ============================================================
  // ENEMY AI — Delegated to EnemyAISystem module
  // See public/js/enemy-ai-system.js for full implementation
  // ============================================================

  /** Build context object for EnemyAISystem calls */
  function _enemyAIContext() {
    return {
      grid: _grid,
      GRID_WIDTH: GRID_WIDTH,
      GRID_HEIGHT: GRID_HEIGHT,
      TILES: TILES,
      PATH_TYPES: PATH_TYPES,
      AWARENESS_STATES: AWARENESS_STATES,
      player: _player,
      playerInBox: _playerInBox,
      BOX_EVASION_CHANCE: _BOX_EVASION_CHANCE,
      getPlayerStealthBonus: _getPlayerStealthBonus
    };
  }

  function _updateEnemyPath(enemy, deltaMs) {
    if (typeof EnemyAISystem !== 'undefined') {
      EnemyAISystem.updateEnemyPath(enemy, deltaMs, _enemyAIContext());
    }
  }

  function _updateEnemyAwareness(enemy, deltaMs) {
    if (typeof EnemyAISystem !== 'undefined') {
      EnemyAISystem.updateEnemyAwareness(enemy, deltaMs);
    }
  }

  function _increaseEnemyAwareness(enemy, amount) {
    if (typeof EnemyAISystem !== 'undefined') {
      EnemyAISystem.increaseEnemyAwareness(enemy, amount, _enemyAIContext());
    }
  }

  function _getEnemyAwarenessState(enemy) {
    if (typeof EnemyAISystem !== 'undefined') {
      return EnemyAISystem.getEnemyAwarenessState(enemy, _enemyAIContext());
    }
    return AWARENESS_STATES.UNAWARE;
  }

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

  function _getAllLightBlockers(baseWalls) {
    var blockers = baseWalls ? baseWalls.slice() : [];
    if (typeof _breakables !== 'undefined' && Array.isArray(_breakables)) {
      for (var i = 0; i < _breakables.length; i++) {
        var b = _breakables[i];
        if (b && b.hp > 0) {
          blockers.push({ x: b.x, y: b.y, opacity: 0.7 });
        }
      }
    }
    if (typeof GroundEffects !== 'undefined' && typeof GroundEffects.getActiveEffects === 'function') {
      var effects = GroundEffects.getActiveEffects();
      for (var k in effects) {
        if (effects[k] && effects[k].type === 'smoke') {
          var parts = k.split(',');
          blockers.push({ x: parseInt(parts[0], 10), y: parseInt(parts[1], 10), opacity: 0.5 });
        }
      }
    }
    return blockers;
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

  function _isPlayerInSightCone(enemy) {
    if (typeof EnemyAISystem !== 'undefined') {
      return EnemyAISystem.isPlayerInSightCone(enemy, _enemyAIContext());
    }
    return false;
  }

  /**
   * Get player stealth bonus from current tile
   */
  // ── StealthSystem delegation ──
  function _stealthCtx() {
    return {
      player: _player, grid: _grid, tileMetadata: _tileMetadata,
      TILES: TILES, playerInBox: _playerInBox,
      getStealthBonusCache: function() { return _stealthBonusCache; },
      setStealthBonusCache: function(v) { _stealthBonusCache = v; }
    };
  }
  function _getPlayerStealthBonus() {
    if (typeof StealthSystem !== 'undefined') {
      return StealthSystem.getPlayerStealthBonus(_stealthCtx());
    }
    return 0;
  }

  function _checkLineOfSight(x1, y1, x2, y2) {
    if (typeof EnemyAISystem !== 'undefined') {
      return EnemyAISystem.checkLineOfSight(x1, y1, x2, y2, _enemyAIContext());
    }
    return false;
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

  // ============================================================
  // DEPLOYED BOX SYSTEM
  // ============================================================

  var _BOX_DEPLOY_IDS = ['ITM-020', 'ITM-021', 'ITM-022', 'ITM-023'];

  var _BOX_EVASION_CHANCE = {
    'common': 0.85,
    'uncommon': 0.90,
    'rare': 0.95,
    'legendary': 0.991
  };

  var _BOX_WALK_OVER_CHANCE = {
    'common': 0.70,
    'uncommon': 0.40,
    'rare': 0.20,
    'legendary': 0.00
  };

  var _BOX_NOTICE_CHANCE = {
    'common': 0.50,
    'uncommon': 0.35,
    'rare': 0.20,
    'legendary': 0.00
  };

  // ── Box Deployment delegation stubs ──────────────────────
  function _boxDeployCtx() {
    return {
      grid: _grid, GRID_WIDTH: GRID_WIDTH, GRID_HEIGHT: GRID_HEIGHT, TILES: TILES,
      enemies: _enemies, impactEffects: _impactEffects,
      invalidateStealthCache: function() { _stealthBonusCache = null; },
      enterCombat: function(enemy, trigger, card) { if (!_strCombatActive) _enterStrCombat(enemy, trigger, card); }
    };
  }
  function _syncBoxState() {
    if (typeof BoxDeployment === 'undefined') return;
    _playerInBox = BoxDeployment.getPlayerInBox();
    _placedBoxes = BoxDeployment.getPlacedBoxes();
  }
  function _getBoxAt(x, y) {
    if (typeof BoxDeployment !== 'undefined') return BoxDeployment.getBoxAt(x, y);
    return null;
  }
  function _isValidBoxPlacement(x, y) {
    if (typeof BoxDeployment !== 'undefined') return BoxDeployment.isValidBoxPlacement(x, y, _boxDeployCtx());
    return false;
  }
  function _placeBoxAt(x, y, quality, itemId) {
    if (typeof BoxDeployment !== 'undefined') { var box = BoxDeployment.placeBoxAt(x, y, quality, itemId); _syncBoxState(); return box; }
    return null;
  }
  function _destroyBox(box) {
    if (typeof BoxDeployment !== 'undefined') { BoxDeployment.destroyBox(box, _boxDeployCtx()); _syncBoxState(); return; }
  }
  function _playerEnterBox(box) {
    if (typeof BoxDeployment !== 'undefined') { BoxDeployment.playerEnterBox(box, _boxDeployCtx()); _syncBoxState(); return; }
  }
  function _playerExitBox(reason) {
    if (typeof BoxDeployment !== 'undefined') { BoxDeployment.playerExitBox(reason, _boxDeployCtx()); _syncBoxState(); return; }
  }
  function _checkEnemyBoxInteraction(enemy) {
    if (typeof BoxDeployment !== 'undefined') { BoxDeployment.checkEnemyBoxInteraction(enemy, _boxDeployCtx()); _syncBoxState(); return; }
  }

  // ── Noise propagation — alerts nearby enemies ──
  function _raiseNoise(x, y, radius) {
    if (!_enemies || !_enemies.length) return;
    _enemies.forEach(function(enemy) {
      if (enemy.hp <= 0) return;
      var dist = Math.abs(enemy.x - x) + Math.abs(enemy.y - y);
      if (dist <= radius) {
        // Awareness boost scales inversely with distance
        var amount = Math.max(5, Math.round(20 * (1 - dist / (radius + 1))));
        if (typeof EnemyAISystem !== 'undefined' && EnemyAISystem.increaseEnemyAwareness) {
          EnemyAISystem.increaseEnemyAwareness(enemy, amount, { AWARENESS_STATES: AWARENESS_STATES });
        } else {
          enemy.awareness = Math.min(150, (enemy.awareness || 0) + amount);
        }
      }
    });
  }

  // ── BreakableSystem delegation ──
  function _breakableCtx() {
    return {
      get grid() { return _grid; },
      get items() { return _items; },
      get player() { return _player; },
      get enemies() { return _enemies; },
      get breakables() { return _breakables; },
      TILES: TILES, rng: _rng,
      GRID_WIDTH: GRID_WIDTH, GRID_HEIGHT: GRID_HEIGHT,
      AWARENESS_STATES: AWARENESS_STATES,
      get totalBreakableDamage() { return _totalBreakableDamage; },
      set totalBreakableDamage(v) { _totalBreakableDamage = v; },
      get floor() { return _floor; },
      get wallCache() { return _wallCache; },
      spawnCurrency: _spawnCurrency,
      raiseNoise: _raiseNoise,
      rebuildWallCache: _rebuildWallCache,
      getAllLightBlockers: _getAllLightBlockers,
      getBiome: _getBiome,
      getBreakableAt: _getBreakableAt,
      updateMobileGrid: function() {
        if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
          _updateMobileGrid();
        }
      }
    };
  }
  function _damageBreakable(breakable, amount) {
    if (typeof BreakableSystem !== 'undefined') {
      BreakableSystem.damageBreakable(breakable, amount, _breakableCtx());
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

  // ── Projectile System delegation stubs (Phase 6) ──────────
  function _projectileCtx() {
    return {
      player: _player, grid: _grid, enemies: _enemies, breakables: _breakables,
      active: _active, TILES: TILES, impactEffects: _impactEffects,
      parseDirection: _parseDirection,
      isInsideBounds: _isInsideBounds,
      getBreakableAt: _getBreakableAt,
      damageBreakable: _damageBreakable,
      enterStrCombat: function(enemy, trigger, card) {
        if (!_strCombatActive) return _enterStrCombat(enemy, trigger, card);
      }
    };
  }
  function _syncProjectileState() {
    if (typeof ProjectileSystem === 'undefined') return;
    _projectiles = ProjectileSystem.getProjectiles();
    _muzzleFlash = ProjectileSystem.getMuzzleFlash();
  }

  function _getProjectileGlyph(direction) {
    var glyphs = {
      'north': '↑', 'south': '↓', 'east': '→', 'west': '←',
      'northeast': './', 'northwest': '/', 'southeast': '.\\', 'southwest': '\\'
    };
    return glyphs[direction] || TILES.PROJECTILE;
  }

  function _fireProjectile(cmd) {
    if (typeof ProjectileSystem !== 'undefined') {
      var result = ProjectileSystem.fireProjectile(cmd, _projectileCtx());
      _syncProjectileState();
      _saveState();
      if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') _updateMobileGrid();
      if (!result) return { lines: ['MISFIRE', ''].concat(_renderGrid()), prompt: getPrompt(), stayActive: true };
      return { lines: ['FIRING ' + result.glyph + ' ' + result.direction.toUpperCase(), ''].concat(_renderGrid()), prompt: getPrompt(), stayActive: true };
    }
    // Inline fallback (should not reach in production)
    return { lines: ['[Projectile module not loaded]', ''].concat(_renderGrid()), prompt: getPrompt(), stayActive: true };
  }

  function fireProjectileAtTarget(targetX, targetY) {
    if (typeof ProjectileSystem !== 'undefined') {
      var result = ProjectileSystem.fireProjectileAtTarget(targetX, targetY, _projectileCtx());
      _syncProjectileState();
      if (!result) return;
      _saveState();
      if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') _updateMobileGrid();
      return { lines: ['FIRING ' + result.glyph + ' AT TARGET', ''].concat(_renderGrid()), prompt: getPrompt(), stayActive: true };
    }
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

    // Use BreakableSystem.kickBreakable for push + damage
    var kickResult = null;
    if (typeof BreakableSystem !== 'undefined' && BreakableSystem.kickBreakable) {
      kickResult = BreakableSystem.kickBreakable(target, dir.dx, dir.dy, _breakableCtx());
    } else {
      _damageBreakable(target, 2);
      kickResult = { damage: 2, pushed: false, pushDist: 0, destroyed: target.hp <= 0 };
    }
    _saveState();

    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      _updateMobileGrid();
    }

    var kickMsg;
    if (kickResult.destroyed) {
      kickMsg = '🥾💥 SMASHED ' + (target.emoji || '📦') + ' ' + (target.name || 'breakable');
    } else if (kickResult.pushed) {
      kickMsg = '🥾 KICKED ' + (target.emoji || '📦') + ' (' + kickResult.pushDist + ' tile' + (kickResult.pushDist > 1 ? 's' : '') + ') HP ' + target.hp;
    } else {
      kickMsg = '🥾 BOOTED ' + (target.emoji || '📦') + ' (HP ' + target.hp + ')';
    }

    return {
      lines: [kickMsg, ''].concat(_renderGrid()),
      prompt: getPrompt(),
      stayActive: true
    };
  }

  function _updateProjectiles(deltaMs, steps) {
    if (typeof ProjectileSystem !== 'undefined') {
      var action = ProjectileSystem.updateProjectiles(deltaMs, steps, _projectileCtx());
      _syncProjectileState();
      return action;
    }
    return null;
  }

  // _advanceProjectile and _addImpactEffect — now in ProjectileSystem module

  function stepProjectiles(steps) {
    if (typeof ProjectileSystem !== 'undefined') {
      var result = ProjectileSystem.stepProjectiles(steps, _projectileCtx());
      _syncProjectileState();
      if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') _updateMobileGrid();
      return result;
    }
    return { projectiles: _projectiles, breakables: _breakables, action: null };
  }

  // ── Save/Load delegation stubs ───────────────────────────
  function _saveLoadCtx() {
    return {
      active: _active, player: _player, enemies: _enemies, items: _items,
      projectiles: _projectiles, breakables: _breakables, turn: _turn, floor: _floor,
      grid: _grid, TILES: TILES, GRID_WIDTH: GRID_WIDTH, GRID_HEIGHT: GRID_HEIGHT
    };
  }
  function _saveState() {
    if (typeof SaveLoad !== 'undefined') { SaveLoad.saveState(_saveLoadCtx()); return; }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        active: _active, player: _player, enemies: _enemies, items: _items,
        projectiles: _projectiles, breakables: _breakables, turn: _turn, floor: _floor
      }));
    } catch (e) {}
  }
  function _loadState() {
    if (typeof SaveLoad !== 'undefined') {
      var parsed = SaveLoad.loadState(_saveLoadCtx());
      if (!parsed) return;
      if (parsed.player) _player = parsed.player;
      if (parsed.enemies) _enemies = parsed.enemies;
      if (parsed.items) { WorldItems.setFloorItems(parsed.items); _items = WorldItems.getFloorItems(); }
      if (parsed.projectiles) _projectiles = parsed.projectiles;
      if (parsed.breakables) _breakables = parsed.breakables;
      if (parsed.turn) _turn = parsed.turn;
      if (parsed.floor) _floor = parsed.floor;
      if (parsed.interactiveItems && typeof InteractiveItems !== 'undefined') InteractiveItems.deserialize(parsed.interactiveItems);
      _active = false;
      return;
    }
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var p = JSON.parse(raw);
      if (p.player) _player = p.player;
      if (p.enemies) _enemies = p.enemies;
      if (p.items) { WorldItems.setFloorItems(p.items); _items = WorldItems.getFloorItems(); }
      if (p.projectiles) _projectiles = p.projectiles;
      if (p.breakables) _breakables = p.breakables;
      if (p.turn) _turn = p.turn;
      if (p.floor) _floor = p.floor;
      _active = false;
    } catch (e) {}
  }

  /**
   * Handle tap-to-move from mobile UI
   */
  function handleTapMove(targetX, targetY, runMode) {
    if (typeof TapMoveSystem !== 'undefined') {
      return TapMoveSystem.handleTapMove(targetX, targetY, runMode, _tapMoveCtx());
    }
  }

  function handleFishingMove(path, isSprinting) {
    if (typeof TapMoveSystem !== 'undefined') {
      return TapMoveSystem.handleFishingMove(path, isSprinting, _tapMoveCtx());
    }
  }

  /**
   * Check if position is walkable
   */
  function _maybeHintNearbyDoors() {
    if (typeof NpcGateSystem !== 'undefined') {
      return NpcGateSystem.maybeHintNearbyDoors(_npcGateCtx());
    }
  }

  function isWalkable(x, y) {
    return _isWalkable(x, y);
  }

  function _canAffordCosts(costs) {
    if (typeof CostPrinterSystem !== 'undefined') {
      return CostPrinterSystem.canAffordCosts(costs);
    }
    if (!costs || !costs.length) return { canAfford: true, missing: [] };
    return { canAfford: false, missing: costs.slice() };
  }

  function _consumeCosts(costs) {
    if (typeof InventoryManagement !== 'undefined') return InventoryManagement.consumeCosts(costs);
    if (!costs || !costs.length) return { success: true };
    return { success: false };
  }

  function _maybeTrigger3dPrinter(triggerCardId, triggerCard) {
    if (typeof CostPrinterSystem !== 'undefined') {
      return CostPrinterSystem.maybeTrigger3dPrinter(triggerCardId, triggerCard);
    }
  }

  function playCardFromHand(cardId) {
    if (typeof CardPlaySystem !== 'undefined') {
      return CardPlaySystem.playCardFromHand(cardId, _cardPlayCtx());
    }
    return { success: false, reason: 'module_not_loaded' };
  }

  function playCardsFromHand(cardIds) {
    if (typeof CardPlaySystem !== 'undefined') {
      return CardPlaySystem.playCardsFromHand(cardIds, _cardPlayCtx());
    }
    if (!cardIds || !cardIds.length) return { success: false };
    var res = { success: true, results: [] };
    for (var i = 0; i < cardIds.length; i++) {
      res.results.push(playCardFromHand(cardIds[i]));
    }
    return res;
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

    // BackupActionContainer auto-re-renders via CardStateAuthority events.
    // Legacy ReserveSlots update removed — no longer the primary left column UI.

    return result;
  }

  // NOTE: indices-based multi-card STR execution removed during STR UI rebase.
  // Use playCardFromHand(cardId) / playCardsFromHand([cardIds]) instead.

  /**
   * Map swipe direction to card action
   */
  // ── CardActionSystem context builder ──
  function _cardActionCtx() {
    return {
      player: _player, enemies: _enemies, floor: _floor,
      strCombatActive: _strCombatActive,
      FLOOR_TYPES: FLOOR_TYPES,
      getFloorType: _getFloorType, getPrompt: getPrompt,
      renderGrid: _renderGrid, saveState: _saveState,
      enterStrCombat: function(enemy, trigger, card) {
        if (!_strCombatActive) return _enterStrCombat(enemy, trigger, card);
      },
      executeSimultaneousRound: _executeSimultaneousRound,
      getEnemyAICard: _getEnemyAICard,
      get turn() { return _turn; },
      set turn(v) { _turn = v; }
    };
  }

  function _getCardAction(card, direction) {
    if (typeof CardActionSystem !== 'undefined') {
      return CardActionSystem.getCardAction(card, direction);
    }
    return { type: 'none' };
  }

  function _executeCardAction(action) {
    if (typeof CardActionSystem !== 'undefined') {
      return CardActionSystem.executeCardAction(action, _cardActionCtx());
    }
    return { lines: [''], prompt: getPrompt(), stayActive: true };
  }

  // ── CardPlaySystem context builder ──
  function _cardPlayCtx() {
    return {
      get active() { return _active; },
      get strCombatActive() { return _strCombatActive; },
      player: _player,
      get strCombatEnemy() { return _strCombatEnemy; },
      get strCombatRound() { return _strCombatRound; },
      get strCombatAdvantage() { return _strCombatAdvantage; },
      getAlertLevel: function() { return _alertLevel; },
      setAlertLevel: function(v) { _alertLevel = v; },
      getStrCombatLog: function() { return _strCombatLog; },
      appendStrCombatLog: function(lines) { _strCombatLog = (_strCombatLog || []).concat(lines); },
      canAffordCosts: _canAffordCosts,
      consumeCosts: _consumeCosts,
      maybeTrigger3dPrinter: _maybeTrigger3dPrinter,
      exitStrCombat: _exitStrCombat,
      handlePlayerDeath: _handlePlayerDeath
    };
  }

  // ── TapMoveSystem context builder ──
  function _tapMoveCtx() {
    return {
      get active() { return _active; },
      get scriptedWalk() { return _scriptedWalk; },
      get playerMoveLocked() { return _playerMoveLocked; },
      player: _player,
      grid: _grid,
      get enemies() { return _enemies; },
      get breakables() { return _breakables; },
      tileMetadata: _tileMetadata,
      GRID_WIDTH: GRID_WIDTH,
      GRID_HEIGHT: GRID_HEIGHT,
      TILES: TILES,
      TILE_EFFECTS: TILE_EFFECTS,
      rng: _rng,
      get totalBreakableDamage() { return _totalBreakableDamage; },
      set totalBreakableDamage(v) { _totalBreakableDamage = v; },
      get floor() { return _floor; },
      get wallCache() { return _wallCache; },
      get useInteractiveGrid() { return _useInteractiveGrid; },
      isWalkable: _isWalkable,
      getBreakableAt: _getBreakableAt,
      damageBreakable: _damageBreakable,
      spawnCurrency: _spawnCurrency,
      raiseNoise: _raiseNoise,
      rebuildWallCache: _rebuildWallCache,
      getAllLightBlockers: _getAllLightBlockers,
      getBiome: _getBiome,
      movePlayer: _movePlayer,
      saveState: _saveState,
      renderGrid: _renderGrid,
      updateMobileGrid: _updateMobileGrid,
      getPrompt: getPrompt
    };
  }

  // ── BeginGameplaySystem context builder ──
  function _beginGameplayCtx() {
    return {
      player: _player,
      get grid() { return _grid; },
      get tileMetadata() { return _tileMetadata; },
      GRID_WIDTH: GRID_WIDTH,
      GRID_HEIGHT: GRID_HEIGHT,
      TILES: TILES,
      get useInteractiveGrid() { return _useInteractiveGrid; },
      getFloor: function() { return _floor; },
      setDesiredDifficultyTier: function(v) { _desiredDifficultyTier = v; },
      applyDesiredDifficultyTier: _applyDesiredDifficultyTier,
      generateFloor: _generateFloor,
      startGameLoop: _startGameLoop,
      setScriptedWalk: function(v) { _scriptedWalk = v; },
      setScriptedWalkTarget: function(v) { _scriptedWalkTarget = v; },
      isWalkable: _isWalkable,
      updateMobileGrid: _updateMobileGrid,
      renderGrid: _renderGrid,
      getPrompt: getPrompt
    };
  }

  // ── CommandProcessSystem context builder ──
  function _commandProcessCtx() {
    return {
      get active() { return _active; },
      get strCombatActive() { return _strCombatActive; },
      getPrompt: getPrompt,
      handleAgentCommand: _handleAgentCommand,
      exitStrCombat: _exitStrCombat,
      exitRogue: _exitRogue,
      helpLines: _helpLines,
      statusLines: _statusLines,
      inventoryLines: _inventoryLines,
      fireProjectile: _fireProjectile,
      kickBreakable: _kickBreakable,
      movePlayer: _movePlayer,
      pickupItem: _pickupItem,
      attemptExtract: _attemptExtract,
      handleInteraction: _handleInteraction,
      attemptPickpocket: _attemptPickpocket,
      showVendor: _showVendor,
      buyFromVendor: _buyFromVendor,
      healAtBonfire: _healAtBonfire,
      gambleCard: _gambleCard,
      stashCard: _stashCard,
      retrieveCard: _retrieveCard,
      equipItem: _equipItem,
      unequipItem: _unequipItem
    };
  }

  // ── GameTickSystem context builder ──
  function _gameTickCtx() {
    return {
      player: _player,
      grid: _grid,
      enemies: _enemies,
      breakables: _breakables,
      projectiles: _projectiles,
      GRID_WIDTH: GRID_WIDTH,
      GRID_HEIGHT: GRID_HEIGHT,
      get useInteractiveGrid() { return _useInteractiveGrid; },
      get strCombatActive() { return _strCombatActive; },
      get bossFloorActive() { return _bossFloorActive; },
      get bossDefeated() { return _bossDefeated; },
      get projectileAdvanceInterval() { return _projectileAdvanceInterval; },
      isWalkable: _isWalkable,
      checkPlayerInteractions: _checkPlayerInteractions,
      updateMobileGrid: _updateMobileGrid,
      updateEnemyPath: _updateEnemyPath,
      checkEnemyBoxInteraction: _checkEnemyBoxInteraction,
      updateEnemyAwareness: _updateEnemyAwareness,
      isPlayerInSightCone: _isPlayerInSightCone,
      increaseEnemyAwareness: _increaseEnemyAwareness,
      enterStrCombat: _enterStrCombat,
      updateProjectiles: _updateProjectiles,
      syncProjectileState: _syncProjectileState,
      updatePlayerLight: _updatePlayerLight,
      getAllLightBlockers: function() { return _getAllLightBlockers(_wallCache); },
      handlePlayerDeath: _handlePlayerDeath,
      handleEnemyDeath: _handleEnemyDeath,
      magnetAutoCollect: _magnetAutoCollect,
      showTutorialHint: function() { /* TODO: Implement tutorial hint system */ },
      getActiveBoss: function() { return _activeBoss; },
      setPlayerMoveLocked: function(v) { _playerMoveLocked = v; },
      getScriptedWalk: function() { return _scriptedWalk; },
      setScriptedWalk: function(v) { _scriptedWalk = v; },
      getScriptedWalkTarget: function() { return _scriptedWalkTarget; },
      setScriptedWalkTarget: function(v) { _scriptedWalkTarget = v; },
      getScriptedWalkPhase: function() { return _scriptedWalkPhase; },
      setScriptedWalkPhase: function(v) { _scriptedWalkPhase = v; },
      getScriptedWalkExitTarget: function() { return _scriptedWalkExitTarget; },
      getProjectileTickAccum: function() { return _projectileTickAccum; },
      addProjectileTickAccum: function(v) { _projectileTickAccum += v; },
      resetProjectileTickAccum: function() { _projectileTickAccum = 0; },
      addEnemyColorCycleTime: function(v) { _enemyColorCycleTime += v; },
      getLightMapTickCounter: function() { return _lightMapTickCounter; },
      incrementLightMapTickCounter: function() { _lightMapTickCounter++; },
      resetLightMapTickCounter: function() { _lightMapTickCounter = 0; },
      setItems: function(v) { _items = v; },
      setCurrencies: function(v) { _currencies = v; },
      filterFloorItems: function(fn) { return WorldItems.filterFloorItems(fn); },
      filterCurrencies: function(fn) { return WorldItems.filterCurrencies(fn); }
    };
  }

  // ── PlayerActionSystem context builder ──
  function _playerActionCtx() {
    return {
      player: _player,
      grid: _grid,
      enemies: _enemies,
      TILES: TILES,
      get strCombatActive() { return _strCombatActive; },
      getFloor: function() { return _floor; },
      getDifficultyTier: function() { return _difficultyTier; },
      setRunCompleted: function(v) { _runCompleted = v; },
      getPrompt: getPrompt,
      renderGrid: _renderGrid,
      exitRogue: _exitRogue,
      advanceFloor: _advanceFloor
    };
  }

  // ── MovePlayerSystem context builder ──
  function _movePlayerCtx() {
    return {
      player: _player,
      grid: _grid,
      enemies: _enemies,
      items: _items,
      currencies: _currencies,
      shops: _shops,
      npcs: _npcs,
      tileMetadata: _tileMetadata,
      TILES: TILES,
      GRID_WIDTH: GRID_WIDTH,
      GRID_HEIGHT: GRID_HEIGHT,
      get strCombatActive() { return _strCombatActive; },
      getFloor: function() { return _floor; },
      getTurn: function() { return _turn; },
      incrementTurn: function() { _turn++; },
      getPrompt: getPrompt,
      renderGrid: _renderGrid,
      saveState: _saveState,
      maybeHintNearbyDoors: _maybeHintNearbyDoors,
      getBreakableAt: _getBreakableAt,
      attemptExtract: _attemptExtract,
      pickupItem: _pickupItem,
      revealDiscovery: _revealDiscovery,
      applyTileEffects: _applyTileEffects,
      updateAlertLevel: _updateAlertLevel,
      increaseEnemyAwareness: _increaseEnemyAwareness,
      enterStrCombat: _enterStrCombat,
      updatePositionHistory: _updatePositionHistory,
      getNpcById: _getNpcById,
      npcShowEmoji: _npcShowEmoji,
      startNpcGateCombat: _startNpcGateCombat,
      addCurrencyCollected: function(v) { _currencyCollected += v; },
      filterOutCurrencyAt: function(x, y) {
        _currencies = WorldItems.filterCurrencies(function(c) { return c.x !== x || c.y !== y; });
      }
    };
  }

  // ── AgentAPISystem context builder ──
  function _agentAPICtx() {
    return {
      get active() { return _active; },
      get strCombatActive() { return _strCombatActive; },
      player: _player,
      grid: _grid,
      items: _items,
      currencies: _currencies,
      TILES: TILES,
      GRID_WIDTH: GRID_WIDTH,
      GRID_HEIGHT: GRID_HEIGHT,
      movePlayer: _movePlayer,
      handleCardSwipe: handleCardSwipe,
      process: process,
      triggerActiveItem: triggerActiveItem,
      getState: getState,
      incrementTurn: function() { _turn++; },
      updateEnemies: function() { /* legacy stub — enemies updated via game tick */ }
    };
  }

  function _runStartCtx() {
    return {
      player: _player,
      rng: _rng,
      STORAGE_KEY: STORAGE_KEY,
      setActive: function(v) { _active = v; },
      setLoaded: function(v) { _loaded = v; },
      setFloor: function(v) { _floor = v; },
      setTurn: function(v) { _turn = v; },
      setLastExitPos: function(v) { _lastExitPos = v; },
      setRunStartTime: function(v) { _runStartTime = v; },
      setCurrencyCollected: function(v) { _currencyCollected = v; },
      setTotalEnemiesSpawned: function(v) { _totalEnemiesSpawned = v; },
      setEnemiesKilled: function(v) { _enemiesKilled = v; },
      setTotalBreakableDamage: function(v) { _totalBreakableDamage = v; },
      setTotalDamageDealt: function(v) { _totalDamageDealt = v; },
      setMaxSingleHit: function(v) { _maxSingleHit = v; },
      setDamageMitigated: function(v) { _damageMitigated = v; },
      setRunCompleted: function(v) { _runCompleted = v; },
      setPlayerDeaths: function(v) { _playerDeaths = v; },
      setCurrentSeed: function(v) { _currentSeed = v; },
      setCurrentSeedPhrase: function(v) { _currentSeedPhrase = v; },
      setSeedRNG: function(v) { _seedRNG = v; },
      setRunSeed: function(v) { _runSeed = v; },
      updateSeedDisplay: function() { if (typeof _updateSeedDisplay === 'function') _updateSeedDisplay(); },
      beginGameplay: _beginGameplay,
      getPrompt: getPrompt
    };
  }

  function _gameStateAPICtx() {
    return {
      get active() { return _active; },
      get strCombatActive() { return _strCombatActive; },
      player: _player,
      grid: _grid,
      enemies: _enemies,
      breakables: _breakables,
      projectiles: _projectiles,
      items: _items,
      currencies: _currencies,
      TILES: TILES,
      GRID_WIDTH: GRID_WIDTH,
      GRID_HEIGHT: GRID_HEIGHT,
      getFloor: function() { return _floor; },
      getTurn: function() { return _turn; },
      getAlertLevel: function() { return _alertLevel; },
      getBossFloorActive: function() { return _bossFloorActive; },
      setActive: function(v) { _active = v; },
      setFloor: function(v) { _floor = v; },
      setTurn: function(v) { _turn = v; },
      setGrid: function(v) { _grid = v; },
      setEnemies: function(v) { _enemies = v; },
      setBreakables: function(v) { _breakables = v; },
      setProjectiles: function(v) { _projectiles = v; },
      setStrCombatActive: function(v) { _strCombatActive = v; },
      setAlertLevel: function(v) { _alertLevel = v; },
      setBossFloorActive: function(v) { _bossFloorActive = v; },
      syncItems: function() { _items = WorldItems.getFloorItems(); },
      syncCurrencies: function() { _currencies = WorldItems.getCurrencies(); }
    };
  }

  function _tutorialFloorGenCtx() {
    return {
      TILES: TILES,
      GRID_WIDTH: GRID_WIDTH,
      GRID_HEIGHT: GRID_HEIGHT,
      BIOMES: BIOMES,
      PATH_TYPES: PATH_TYPES,
      player: _player,
      grid: _grid,
      tileMetadata: _tileMetadata,
      breakables: _breakables,
      enemies: _enemies,
      npcs: _npcs,
      items: _items,
      currencies: _currencies,
      forestBuildings: _forestBuildings,
      getFloor: function() { return _floor; },
      getSpawnFromLastExitPos: function() { return _spawnFromLastExitPos; },
      setSpawnFromLastExitPos: function(v) { _spawnFromLastExitPos = v; },
      setDoorSpawnProtect: function(v) { _doorSpawnProtect = v; },
      setGrid: function(v) { _grid = v; },
      setForestBuildings: function(v) { _forestBuildings = v; },
      setItems: function(v) { _items = v; },
      setCachedWalls: function(v) { _cachedWalls = v; },
      ensurePlayerOnEmptyTile: _ensurePlayerOnEmptyTile,
      buildBiomeVisualGrid: _buildBiomeVisualGrid,
      buildTileRenderObjects: _buildTileRenderObjects,
      buildBiomeBackgroundColors: _buildBiomeBackgroundColors,
      rebuildWallCache: _rebuildWallCache,
      getWallCache: function() { return _wallCache; },
      updatePlayerLight: _updatePlayerLight,
      getAllLightBlockers: _getAllLightBlockers,
      getBreakableAt: _getBreakableAt
    };
  }

  function _floorGenCoreCtx() {
    return {
      FLOOR_TYPES: FLOOR_TYPES,
      TILES: TILES,
      GRID_WIDTH: GRID_WIDTH,
      GRID_HEIGHT: GRID_HEIGHT,
      player: _player,
      grid: _grid,
      breakables: _breakables,
      runState: _runState,
      getFloor: function() { return _floor; },
      getDifficultyTier: function() { return _difficultyTier; },
      getActiveBoss: function() { return _activeBoss; },
      setGrid: function(v) { _grid = v; },
      setProjectiles: function(v) { _projectiles = v; },
      setBreakables: function(v) { _breakables = v; },
      setEnemies: function(v) { _enemies = v; },
      setNpcs: function(v) { _npcs = v; },
      setShops: function(v) { _shops = v; },
      setTileMetadata: function(v) { _tileMetadata = v; },
      setActiveBoss: function(v) { _activeBoss = v; },
      setBossFloorActive: function(v) { _bossFloorActive = v; },
      setBossDefeated: function(v) { _bossDefeated = v; },
      setBossHazards: function(v) { _bossHazards = v; },
      setBossEnvironment: function(v) { _bossEnvironment = v; },
      setPlayerMoveLocked: function(v) { _playerMoveLocked = v; },
      setRopeManager: function(v) { _ropeManager = v; },
      setForestBuildings: function(v) { _forestBuildings = v; },
      setBiomeVisualGrid: function(v) { _biomeVisualGrid = v; },
      setBiomeBackgroundColors: function(v) { _biomeBackgroundColors = v; },
      setTileRenderObjects: function(v) { _tileRenderObjects = v; },
      setCachedWalls: function(v) { _cachedWalls = v; },
      setStealthBonusCache: function(v) { _stealthBonusCache = v; },
      setActiveSecretFloor: function(v) { _activeSecretFloor = v; },
      setTurn: function(v) { _turn = v; },
      syncItems: function() { _items = WorldItems.getFloorItems(); },
      syncCurrencies: function() { _currencies = WorldItems.getCurrencies(); },
      getFloorType: _getFloorType,
      getBiome: _getBiome,
      generateContrivedTutorialFloor: _generateContrivedTutorialFloor,
      incrementPityTimers: _incrementPityTimers,
      createEmptyGrid: _createEmptyGrid,
      generateRooms: _generateRooms,
      connectRooms: _connectRooms,
      addBranchConnections: _addBranchConnections,
      placeCover: _placeCover,
      placeShadowZones: _placeShadowZones,
      placeEnvironmentalTiles: _placeEnvironmentalTiles,
      placePlayerAndExit: _placePlayerAndExit,
      ensurePlayerOnEmptyTile: _ensurePlayerOnEmptyTile,
      placeEnemies: _placeEnemies,
      validateStealthPath: _validateStealthPath,
      placeVillageCluster: _placeVillageCluster,
      buildBiomeVisualGrid: _buildBiomeVisualGrid,
      buildTileRenderObjects: _buildTileRenderObjects,
      buildBiomeBackgroundColors: _buildBiomeBackgroundColors,
      generateDiscoveries: _generateDiscoveries,
      initializeEnvironmentalDetails: _initializeEnvironmentalDetails,
      spawnBreakables: _spawnBreakables,
      placeTutorialGate: _placeTutorialGate,
      placeBiomeGates: _placeBiomeGates,
      spawnContextAwareKey: _spawnContextAwareKey,
      placeItems: _placeItems,
      spawnShops: _spawnShops,
      spawnVents: _spawnVents,
      applyBiomeBleed: _applyBiomeBleed,
      rebuildWallCache: _rebuildWallCache,
      getWallCache: function() { return _wallCache; },
      updatePlayerLight: _updatePlayerLight,
      getAllLightBlockers: _getAllLightBlockers
    };
  }

  function _performAttack(card) {
    if (typeof CardActionSystem !== 'undefined') {
      return CardActionSystem.executeCardAction({ type: 'attack', card: card }, _cardActionCtx());
    }
    return { lines: [''], prompt: getPrompt(), stayActive: true };
  }

  function _performStance(card) {
    if (typeof CardActionSystem !== 'undefined') {
      return CardActionSystem.executeCardAction({ type: 'defense', card: card }, _cardActionCtx());
    }
    return { lines: [''], prompt: getPrompt(), stayActive: true };
  }

  function _useUtility(card) {
    if (typeof CardActionSystem !== 'undefined') {
      return CardActionSystem.executeCardAction({ type: 'use', card: card }, _cardActionCtx());
    }
    return { lines: [''], prompt: getPrompt(), stayActive: true };
  }

  function _discardCard(card) {
    if (typeof CardActionSystem !== 'undefined') {
      return CardActionSystem.executeCardAction({ type: 'discard', card: card }, _cardActionCtx());
    }
    return { lines: ['DISCARDED: ' + card.name, ''], prompt: getPrompt(), stayActive: true };
  }

  function _findNearestEnemy() {
    if (typeof CardActionSystem !== 'undefined') {
      return CardActionSystem.findNearestEnemy({ player: _player, enemies: _enemies });
    }
    return null;
  }

  // ============================================================
  // STR COMBAT SYSTEM — Delegated to StrCombatEngine module
  // ============================================================

  /** Build context object for StrCombatEngine calls */
  function _strCombatCtx() {
    return {
      player: _player,
      enemies: _enemies,
      grid: _grid,
      items: _items,
      npcs: _npcs,
      tileMetadata: _tileMetadata,
      floor: _floor,
      bossFloorActive: _bossFloorActive,
      activeBoss: _activeBoss,
      bossDefeated: _bossDefeated,
      bossEnvironment: _bossEnvironment,
      playerInBox: _playerInBox,
      TILES: TILES,
      FLOOR_TYPES: FLOOR_TYPES,
      AWARENESS_STATES: AWARENESS_STATES,
      // Callbacks into monolith
      handleEnemyDeath: _handleEnemyDeath,
      handlePlayerDeath: _handlePlayerDeath,
      scatterPostCombatNodes: _scatterPostCombatNodes,
      spawnCurrency: _spawnCurrency,
      renderGrid: _renderGrid,
      getPrompt: getPrompt,
      startGameLoop: _startGameLoop,
      pauseGameLoop: _pauseGameLoop,
      saveState: _saveState,
      enableCombatZoom: _enableCombatZoom,
      disableCombatZoom: _disableCombatZoom,
      combatPhaseTooltip: _combatPhaseTooltip,
      buildCountdownMessages: _buildCountdownMessages,
      applyGroundEffectModifiers: _applyGroundEffectModifiers,
      getFloorType: _getFloorType,
      playerExitBox: _playerExitBox,
      getNpcById: _getNpcById,
      clearNpcGateZones: _clearNpcGateZones,
      // Stat tracking callbacks
      onEnemyKilled: function() { _enemiesKilled++; },
      onDamageDealt: function(dmg) {
        _totalDamageDealt += dmg;
        if (dmg > _maxSingleHit) _maxSingleHit = dmg;
      },
      onDamageMitigated: function(amt) { _damageMitigated += amt; },
      onBossDefeated: function() { _bossDefeated = true; }
    };
  }

  /** Sync monolith shadow vars from StrCombatEngine module state */
  function _syncCombatState() {
    if (typeof StrCombatEngine === 'undefined') return;
    _strCombatActive = StrCombatEngine.isActive();
    _strCombatEnemy = StrCombatEngine.getEnemy();
    _strCombatPhase = StrCombatEngine.getPhase();
    _strCombatRound = StrCombatEngine.getRound();
    _strCombatLog = StrCombatEngine.getLog();
    _strCombatAdvantage = StrCombatEngine.getAdvantage();
    _strCombatAmmoSpent = StrCombatEngine.getAmmoSpent();
    _strCombatEntryPos = StrCombatEngine.getEntryPos();
    _strCombatContext = StrCombatEngine.getContext();
  }

  function _enterStrCombat(enemy, trigger, card) {
    if (typeof StrCombatEngine !== 'undefined') {
      var result = StrCombatEngine.enterCombat(enemy, trigger, card, _strCombatCtx());
      _syncCombatState();
      return result;
    }
    return { lines: ['[Combat module not loaded]'], prompt: _getPrompt(), stayActive: false };
  }

  function _calculateAdvantage(player, enemy, trigger) {
    if (typeof StrCombatEngine !== 'undefined') {
      return StrCombatEngine.calculateAdvantage(player, enemy, trigger, _strCombatCtx());
    }
    return 'neutral';
  }

  function _checkFlanking(attacker, target) {
    if (typeof StrCombatEngine !== 'undefined') {
      return StrCombatEngine.checkFlanking(attacker, target);
    }
    return false;
  }

  function _getAdvantageEmoji(advantage) {
    if (typeof StrCombatEngine !== 'undefined') {
      return StrCombatEngine.getAdvantageEmoji(advantage);
    }
    return '⚔️';
  }

  function _distanceBetween(a, b) {
    if (typeof StrCombatEngine !== 'undefined') {
      return StrCombatEngine.distanceBetween(a, b);
    }
    return Math.abs((a.x || 0) - (b.x || 0)) + Math.abs((a.y || 0) - (b.y || 0));
  }

  function _getDistanceBracket(distance) {
    if (typeof StrCombatEngine !== 'undefined') {
      return StrCombatEngine.getDistanceBracket(distance);
    }
    if (distance <= 1) return 'melee';
    if (distance <= 3) return 'close';
    if (distance <= 6) return 'mid';
    return 'far';
  }

  function _executeSimultaneousRound(playerCard, enemyCard) {
    if (typeof StrCombatEngine !== 'undefined') {
      var result = StrCombatEngine.executeSimultaneousRound(playerCard, enemyCard, _strCombatCtx());
      _syncCombatState();
      return result;
    }
    return { lines: ['[Combat module not loaded]'], prompt: _getPrompt(), stayActive: false };
  }

  function _executeMultiCardRound(playerCards) {
    if (typeof StrCombatEngine !== 'undefined') {
      var result = StrCombatEngine.executeMultiCardRound(playerCards, _strCombatCtx());
      _syncCombatState();
      return result;
    }
    return { lines: ['[Combat module not loaded]'], prompt: _getPrompt(), stayActive: false };
  }

  function _executeStrRound(initiator, card) {
    if (typeof StrCombatEngine !== 'undefined') {
      var result = StrCombatEngine.executeRound(initiator, card, _strCombatCtx());
      _syncCombatState();
      return result;
    }
    return { lines: ['[Combat module not loaded]'], prompt: _getPrompt(), stayActive: false };
  }

  function _playerStrAttack(card) {
    if (typeof StrCombatEngine !== 'undefined') {
      var result = StrCombatEngine.playerAttack(card, _strCombatCtx());
      _syncCombatState();
      return result;
    }
    return { lines: ['[Combat module not loaded]'], prompt: _getPrompt(), stayActive: false };
  }

  function _enemyStrAttack() {
    if (typeof StrCombatEngine !== 'undefined') {
      var result = StrCombatEngine.enemyAttack(_strCombatCtx());
      _syncCombatState();
      return result;
    }
    return { lines: ['[Combat module not loaded]'], prompt: _getPrompt(), stayActive: false };
  }

  function _calculateHit(attacker, defender, advantage) {
    if (typeof StrCombatEngine !== 'undefined') {
      return StrCombatEngine.calculateHit(attacker, defender, advantage);
    }
    return { hit: false, crit: false, roll: 0, target: 70 };
  }

  function _calculateDamage(attacker, defender, advantage, card, isCrit) {
    if (typeof StrCombatEngine !== 'undefined') {
      return StrCombatEngine.calculateDamage(attacker, defender, advantage, card, isCrit);
    }
    return { damage: 1, bonuses: [] };
  }

  function _getEnemyAICard() {
    if (typeof StrCombatEngine !== 'undefined') {
      return StrCombatEngine.getEnemyAICard();
    }
    return { name: 'Basic Attack', emoji: '\uD83D\uDD2B', type: 'attack', category: 'attack', stats: { damage: 2, accuracy: 70, energy: 1, speed: 2 } };
  }

  function _showStrCombatUI() {
    if (typeof StrCombatEngine !== 'undefined') {
      var result = StrCombatEngine.showCombatUI(_strCombatCtx());
      _syncCombatState();
      return result;
    }
    return { lines: [], prompt: _getPrompt(), stayActive: false };
  }

  function _showStrCombatUIWithLog(logLines) {
    if (typeof StrCombatEngine !== 'undefined') {
      var result = StrCombatEngine.showCombatUIWithLog(logLines, _strCombatCtx());
      _syncCombatState();
      return result;
    }
    return { lines: logLines || [], prompt: _getPrompt(), stayActive: false };
  }

  function _exitStrCombat(reason) {
    if (typeof StrCombatEngine !== 'undefined') {
      var result = StrCombatEngine.exitCombat(reason, _strCombatCtx());
      _syncCombatState();
      return result;
    }
    return { lines: ['[Combat module not loaded]'], prompt: _getPrompt(), stayActive: false };
  }

  function _triggerCombatFlash() {
    if (typeof StrCombatEngine !== 'undefined') {
      StrCombatEngine.triggerCombatFlash();
    }
  }

  function _pauseGameLoop() {
    if (typeof GameLoop !== 'undefined') { GameLoop.pause(); return; }
    _gameLoopActive = false;
  }

  function isStrCombatActive() {
    if (typeof StrCombatEngine !== 'undefined') {
      return StrCombatEngine.isActive();
    }
    return _strCombatActive;
  }

  function getStrCombatState() {
    if (typeof StrCombatEngine !== 'undefined') {
      return StrCombatEngine.getState(_strCombatCtx());
    }
    return {
      active: _strCombatActive,
      enemy: _strCombatEnemy,
      player: _player ? { hp: _player.hp, maxHp: _player.maxHp } : { hp: 10, maxHp: 10 },
      advantage: _strCombatAdvantage,
      round: _strCombatRound,
      floor: _floor,
      log: _strCombatLog,
      countdownMessages: _strCombatContext,
      phase: _strCombatPhase,
      isResolvingTurn: _strCombatPhase === 'resolving'
    };
  }

  function setStrCombatPhase(phase) {
    _strCombatPhase = phase;
    if (typeof StrCombatEngine !== 'undefined') {
      StrCombatEngine.setPhase(phase);
    }
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
  // ── ActiveItemSystem context builder ──
  function _activeItemCtx() {
    return {
      player: _player, active: _active, tileMetadata: _tileMetadata, rng: _rng,
      getPrompt: getPrompt, renderGrid: _renderGrid,
      findAdjacentLockedGate: _findAdjacentLockedGate,
      attemptUnlockLockedGate: _attemptUnlockLockedGate,
      electrifyWater: _electrifyWater,
      updateMobileGrid: (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') ? _updateMobileGrid : null
    };
  }

  function triggerActiveItem() {
    if (typeof ActiveItemSystem !== 'undefined') {
      return ActiveItemSystem.triggerActiveItem(_activeItemCtx());
    }
    return { lines: ['NO ACTIVE ITEM'], prompt: getPrompt(), stayActive: true };
  }

  /**
   * Use active item at a specific grid target (drag/drop targeting)
   */
  function applyNonCombatCardAt(cardId, targetX, targetY) {
    if (typeof ActiveItemSystem !== 'undefined') {
      return ActiveItemSystem.applyNonCombatCardAt(cardId, targetX, targetY, _activeItemCtx());
    }
    return false;
  }

  function useActiveItemAt(targetX, targetY) {
    if (typeof ActiveItemSystem !== 'undefined') {
      return ActiveItemSystem.useActiveItemAt(targetX, targetY, _activeItemCtx());
    }
    return { lines: ['NO ACTIVE ITEM'], prompt: getPrompt(), stayActive: true };
  }

  function _findLockedGateNearTarget(tx, ty, radius) {
    if (typeof ActiveItemSystem !== 'undefined') {
      return ActiveItemSystem.findLockedGateNearTarget(tx, ty, radius, { tileMetadata: _tileMetadata });
    }
    return null;
  }

  function _resolveGroundInteraction(item, tiles) { /* delegated to ActiveItemSystem */ }

  /**
   * Electrify water tiles in radius (for tazer effect)
   * @param {number} x - Center X
   * @param {number} y - Center Y
   * @param {number} radius - Spread radius
   */
  function _electrifyWater(x, y, radius) {
    if (typeof GroundEffectsSystem !== 'undefined') {
      return GroundEffectsSystem.electrifyWater(x, y, radius);
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
    if (typeof GroundEffectsSystem !== 'undefined') {
      var log = GroundEffectsSystem.applyGroundEffectModifiers(_groundEffectsCtx());
      if (log && log.length) {
        for (var i = 0; i < log.length; i++) { _strCombatLog.push(log[i]); }
      }
      return;
    }
  }

  function _applyPlayerGroundModifier() { /* delegated to GroundEffectsSystem */ }
  function _applyEnemyGroundModifier() { /* delegated to GroundEffectsSystem */ }

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
  // ── CombatNarrationSystem delegation ──
  function _combatNarrationCtx() {
    return {
      player: _player, grid: _grid, TILES: TILES,
      strCombatAdvantage: _strCombatAdvantage,
      getPlayerStealthBonus: _getPlayerStealthBonus,
      checkFlanking: _checkFlanking
    };
  }
  function _buildCountdownMessages(enemy, trigger) {
    if (typeof CombatNarrationSystem !== 'undefined') {
      return CombatNarrationSystem.buildCountdownMessages(enemy, trigger, _combatNarrationCtx());
    }
    return { beat3: '', beat2: '', beat1: '' };
  }

  /**
   * Handle agent control commands
   */
  // ── AgentCommandSystem delegation ──
  function _handleAgentCommand(cmd) {
    if (typeof AgentCommandSystem !== 'undefined') {
      return AgentCommandSystem.handleAgentCommand(cmd, { getPrompt: getPrompt });
    }
    return { lines: ['AGENT SYSTEM NOT AVAILABLE'], prompt: getPrompt(), stayActive: true };
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
  function _applyDesiredDifficultyTier(reason) {
    reason = reason || 'unknown';
    if (_desiredDifficultyTier >= 1 && _desiredDifficultyTier <= 3) {
      if (_difficultyTier !== _desiredDifficultyTier) {
        _difficultyTier = _desiredDifficultyTier;
        console.log('[GoneRogue] Difficulty applied to T' + _difficultyTier + ' (reason=' + reason + ')');
        _notifyStateChange();
      }
    }
  }

  function setDifficulty(tier) {
    // Rebased semantics: this is an UBER selection request.
    // Apply on next spawned floor (or next run start), not instantly.
    if (tier >= 1 && tier <= 3) {
      _desiredDifficultyTier = tier;
      console.log('[GoneRogue] Difficulty requested T' + tier + ' (applies next floor)');

      // Notify state change listeners so UI can reflect "pending" if desired.
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

  function getDesiredDifficulty() {
    return _desiredDifficultyTier;
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
    if (typeof GameStateAPI !== 'undefined') {
      return GameStateAPI.getState(_gameStateAPICtx());
    }
    return { active: _active, floor: _floor, turn: _turn };
  }

  /**
   * Get legal actions from current state
   */
  function getLegalActions() {
    if (typeof AgentAPISystem !== 'undefined') {
      return AgentAPISystem.getLegalActions(_agentAPICtx());
    }
    return [];
  }

  function applyAction(action) {
    if (typeof AgentAPISystem !== 'undefined') {
      return AgentAPISystem.applyAction(action, _agentAPICtx());
    }
    return { success: false, reason: 'Agent API not loaded', state: null };
  }

  /**
   * Get grid data (for map parsing)
   */
  function getGrid() {
    if (typeof GameStateAPI !== 'undefined') {
      return GameStateAPI.getGrid(_gameStateAPICtx());
    }
    return { grid: [], width: GRID_WIDTH, height: GRID_HEIGHT, tiles: TILES };
  }

  /**
   * Reset game to specific state (for replay testing)
   */
  function resetToState(state) {
    if (typeof GameStateAPI !== 'undefined') {
      return GameStateAPI.resetToState(state, _gameStateAPICtx());
    }
    return false;
  }

  // ============================================================
  // PET SYSTEM DEBUG
  // ============================================================

  /**
   * Spawn test pets for debugging (one of each tier)
   */
  function spawnTestPets() {
    if (typeof GameStateAPI !== 'undefined') {
      return GameStateAPI.spawnTestPets(_gameStateAPICtx());
    }
  }

  // ============================================================
  // END HEADLESS MODE API
  // ============================================================

  /**
   * Get current run seed
   */
  function getSeed() {
    return _currentSeed;
  }

  /**
   * Get current seed phrase
   */
  function getSeedPhrase() {
    return _currentSeedPhrase;
  }

  /**
   * Set seed for next run (must be called before start())
   */
  function setSeed(seed) {
    if (typeof SeededRandom !== 'undefined') {
      _currentSeed = seed;
      _currentSeedPhrase = SeededRandom.generateSeedPhrase(seed);
      _seedRNG = new SeededRandom.SeededRNG(seed);
      console.log('[GoneRogue] Seed set to:', _currentSeed, '(' + _currentSeedPhrase + ')');
    }
  }

  /**
   * Get seeded RNG instance (for procedural generation)
   */
  function getSeededRNG() {
    return _seedRNG;
  }

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
    playCardFromHand: playCardFromHand,
    playCardsFromHand: playCardsFromHand,
    getPlayer: getPlayer,
    getEnemies: getEnemies,
    getEnemyAwarenessState: getEnemyAwarenessState,
    getBreakables: function() { return _breakables; },
    getBreakableAt: _getBreakableAt,
    removeBreakableAt: _removeBreakableAt,

    // Deployed box system
    isBoxDeployItem: function(itemId) { return _BOX_DEPLOY_IDS.indexOf(itemId) !== -1; },
    isValidBoxPlacement: _isValidBoxPlacement,
    placeBox: function(gridPos, itemId, quality) {
      if (!gridPos || !_isValidBoxPlacement(gridPos.x, gridPos.y)) return null;
      var box = _placeBoxAt(gridPos.x, gridPos.y, quality, itemId);
      // Remove item from persistent inventory
      if (typeof GAMESTATE !== 'undefined') {
        var inv = GAMESTATE.getPersistentInventory();
        var idx = -1;
        for (var _bi = 0; _bi < inv.length; _bi++) {
          if (inv[_bi] && inv[_bi].id === itemId) { idx = _bi; break; }
        }
        if (idx !== -1 && GAMESTATE.removePersistentInventoryItem) {
          GAMESTATE.removePersistentInventoryItem(idx);
        }
      }
      return box;
    },
    getBoxAt: _getBoxAt,
    removeBoxAt: function(x, y) {
      var box = _getBoxAt(x, y);
      if (box) _destroyBox(box);
    },
    getPlacedBoxes: function() { return _placedBoxes.slice(); },
    getProjectiles: function() { return _projectiles; },
    fireProjectile: _fireProjectile,
    fireProjectileAtTarget: fireProjectileAtTarget,
    stepProjectiles: stepProjectiles,
    isStrCombatActive: isStrCombatActive,
    getStrCombatState: getStrCombatState,
    setStrCombatPhase: setStrCombatPhase,
    passStrTurn: function() {
      // Pass player's combat turn — enemy attacks unopposed (called on timer expiry)
      if (_strCombatActive) {
        return _executeStrRound('enemy');
      }
    },
    triggerActiveItem: triggerActiveItem,
    useActiveItemAt: useActiveItemAt,
    applyNonCombatCardAt: applyNonCombatCardAt,
    updatePlayerLight: _updatePlayerLight,
    getBiomeBackgroundColor: getBiomeBackgroundColor,
    getTileRenderObjects: getTileRenderObjects,

    // Difficulty tier system
    setDifficulty: setDifficulty,
    getDifficulty: getDifficulty,
    getDesiredDifficulty: getDesiredDifficulty,
    onStateChange: onStateChange,

    // Seed-based generation system
    getSeed: getSeed,
    getSeedPhrase: getSeedPhrase,
    setSeed: setSeed,
    getSeededRNG: getSeededRNG,

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

    // Pet system debug API
    spawnTestPets: spawnTestPets,

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

