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

  /**
   * Categorize card for pity timer tracking
   * NOTE: Kept in monolith — card drop system, not discovery
   */
  function _categorizeCardForPity(card) {
    if (!card) return 'other';
    var type = card.type || card.category || '';
    var name = card.name || '';

    if (type === 'defense' || name.match(/Block|Shield|Dodge|Cover|Evade|Prone/i)) {
      return 'defensive';
    }
    if (name.match(/Ration|Katchup|Medical|Heal|Health/i)) {
      return 'healing';
    }
    if (type === 'utility' || name.match(/Cigarette|Energy Drink|Retreat|Lure|Smoke/i)) {
      return 'utility';
    }
    return 'other';
  }

  function _trackCardDrop(card) {
    var category = _categorizeCardForPity(card);
    _recentCardDrops.push({
      type: card.type || 'unknown',
      category: category,
      floor: _floor,
      name: card.name
    });
    if (_recentCardDrops.length > 5) {
      _recentCardDrops.shift();
    }
    if (category !== 'other') {
      _pitySince[category] = 0;
    }
  }

  function _checkPityTimer() {
    var PITY_THRESHOLD = 3;
    for (var category in _pitySince) {
      if (_pitySince[category] >= PITY_THRESHOLD) {
        return category;
      }
    }
    return null;
  }

  function _getPityCard(category) {
    var pityCards = {
      defensive: ['Block', 'Dodge', 'PRONE', 'DIVE_FOR_COVER'],
      utility: ['CIGARETTES', 'RETREAT', 'LURE', 'ENERGY_DRINK'],
      healing: ['RATIONS', 'KATCHUP', 'MEDICAL_KIT']
    };
    var cards = pityCards[category] || [];
    if (cards.length === 0) return null;
    return cards[Math.floor(_rng() * cards.length)];
  }

  function _incrementPityTimers() {
    for (var category in _pitySince) {
      _pitySince[category]++;
    }
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
  function _getFloorType(floorNum) {
    // On Uber 1+, early floors use stealth (enemies spawn) instead of tutorial (safe)
    if (floorNum <= 2) return (_difficultyTier <= 1) ? FLOOR_TYPES.TUTORIAL : FLOOR_TYPES.STEALTH;
    if (floorNum <= 4) return FLOOR_TYPES.GHOST;
    if (BONFIRE_FLOORS.indexOf(floorNum) !== -1) return FLOOR_TYPES.BONFIRE;
    if (floorNum === 30) return FLOOR_TYPES.FINAL;
    if (BOSS_FLOORS.indexOf(floorNum) !== -1) return FLOOR_TYPES.BOSS;

    // Random exploration floors (5% chance on floors 15+)
    if (floorNum >= 15 && _rng() < 0.05) return FLOOR_TYPES.EXPLORATION;

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
    var rand = _rng() * totalWeight;
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
    context = context || {};
    _active = true;
    _loaded = true;

    // Show onboarding splash ("YOU'VE GONE ROGUE") for new runs.
    // After splash, check if this is a first-time player needing character creation.
    // Character creation gates floor generation so the player has an identity first.
    var _needsCharCreation = false;
    if (!context.resume && typeof CharacterCreation !== 'undefined') {
      var ps = (typeof TerminalCommandRouter !== 'undefined' && TerminalCommandRouter.getPlayerState)
        ? TerminalCommandRouter.getPlayerState() : {};
      _needsCharCreation = !ps.callsign;
    }

    if (!context.resume && typeof OnboardingSplash !== 'undefined' && OnboardingSplash.show) {
      OnboardingSplash.show(function onSplashDone() {
        if (_needsCharCreation) {
          // New player → character creation before first run
          var tier = 0;
          try {
            var ps2 = TerminalCommandRouter.getPlayerState();
            tier = ps2.completedTiers || 0;
          } catch (e) {}
          CharacterCreation.show({
            tier: tier,
            onComplete: function () { _beginGameplay(); }
          });
        } else if (typeof WelcomeBack !== 'undefined' && WelcomeBack.show) {
          // Returning player → welcome-back stats recap, then gameplay
          var psWb = (typeof TerminalCommandRouter !== 'undefined' && TerminalCommandRouter.getPlayerState)
            ? TerminalCommandRouter.getPlayerState() : {};
          WelcomeBack.show({
            playerState: psWb,
            onComplete: function () { _beginGameplay(); }
          });
        }
        // If neither module is available, gameplay was already started below
      });
    }

    // Default behavior: new run when entering rogue via GAMESTATE.requestRogue.
    // Allow explicit resume only when context.resume === true.
    try {
      if (!context.resume) {
        // Uber 1+ (experienced players) skip Floor 0 tavern hub and start at Floor 1 directly.
        // First-time / Uber 0 players start at Floor 0 for onboarding scripted walk.
        var startFloor = 0;
        try {
          if (typeof AWOLDifficulty !== 'undefined' && AWOLDifficulty.getCurrentTier && AWOLDifficulty.getCurrentTier() >= 2) {
            startFloor = 1;
          }
        } catch (eAwol) {}
        _floor = startFloor;
        _turn = 0;
        _lastExitPos = null;
        // Clear persisted rogue state so we don't start new players on a mid-run floor.
        try { localStorage.removeItem(STORAGE_KEY); } catch (e1) {}
      }
    } catch (e0) {}

    // Disable scanlines for performance during gameplay
    document.body.classList.add('gone-rogue-active');

// Initialize seeded generation for reproducible runs
(function initRunSeed() {
  // Prefer SeededRandom (supports seed phrase + RNG instance + UI)
  if (typeof SeededRandom !== 'undefined') {
    _currentSeed = SeededRandom.generateRandomSeed();
    _currentSeedPhrase = SeededRandom.generateSeedPhrase(_currentSeed);
    _seedRNG = new SeededRandom.SeededRNG(_currentSeed);

    // Back-compat / single canonical “seed id”
    _runSeed = _currentSeed;

    console.log('[GoneRogue] Run seed:', _currentSeed, '(' + _currentSeedPhrase + ')');
    if (typeof _updateSeedDisplay === 'function') _updateSeedDisplay();
    return;
  }

  // Fallback legacy seed helper
  if (typeof SeededRNG !== 'undefined' && typeof SeededRNG.init === 'function') {
    var seed = SeededRNG.init();

    _runSeed = seed;
    _currentSeed = seed;
    _currentSeedPhrase = null;
    _seedRNG = null;

    console.log('[GoneRogue] Run seed:', seed);
  }
})();

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

      // Load lighting configuration from registry if available
      if (typeof GoneRogueDataRegistry !== 'undefined') {
        GoneRogueDataRegistry.ready().then(function() {
          var lightingConfig = GoneRogueDataRegistry.getLightingConfig();
          if (lightingConfig) {
            LightingSystem.setConfig(lightingConfig);
            console.log('[GoneRogue] Lighting configuration loaded');
          }
        }).catch(function(err) {
          console.warn('[GoneRogue] Failed to load lighting config:', err);
        });
      }

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

      // Reset per-run passive item state
      if (typeof PassiveItemsSystem !== 'undefined' && PassiveItemsSystem.resetRunState) {
        PassiveItemsSystem.resetRunState();
      }

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
          // Define guaranteed 3 starter cards
          // Slot 1: always Single Shot (core attack)
          // Slot 2: always Dodge (core defense)
          // Slot 3: random from consumable pool (grenade or flight card)
          var slot3Pool = ['Grenade', 'Smoke Bomb Mk0', 'Chaff Flare'];
          var slot3Pick = slot3Pool[Math.floor(_rng() * slot3Pool.length)];
          var starterCards = ['Single Shot', 'Dodge', slot3Pick];

          // Add the 3 starter cards to loose inventory
          for (var c = 0; c < starterCards.length; c++) {
            var card = CardSystem.rollCard(starterCards[c]);
            if (card) {
              GAMESTATE.addToLoose(card);
            }
          }

          // Build display string for the 3rd card
          var slot3Emoji = slot3Pick === 'Grenade' ? '💣' : (slot3Pick === 'Smoke Bomb Mk0' ? '💨' : '🎇');
          lines.push('');
          lines.push('  📦 STARTER LOADOUT DEPLOYED');
          lines.push('  3 COMBAT CARDS ADDED TO INVENTORY');
          lines.push('  🎯 Single Shot | 💨 Dodge | ' + slot3Emoji + ' ' + slot3Pick + ' (1x use)');
          lines.push('');
        }
      }
    } else {
      lines = ['', 'GONE ROGUE MODE ACTIVATED', ''];
    }

    // If onboarding screens are active (char creation or welcome-back),
    // defer gameplay start — the splash onComplete chain handles it.
    var _hasSplashChain = !context.resume && typeof OnboardingSplash !== 'undefined' && OnboardingSplash.show &&
      (_needsCharCreation || (typeof WelcomeBack !== 'undefined' && WelcomeBack.show));

    if (_hasSplashChain) {
      return {
        lines: ['', 'INITIALIZING...', ''],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // No onboarding overlay — start gameplay immediately (e.g. resume or no splash modules)
    return _beginGameplay();
  }

  /**
   * Kicks off floor generation, game loop, and UI after all onboarding is done.
   * Called immediately for returning players, or after character creation for new ones.
   */
  function _beginGameplay() {
    // Sync difficulty from AWOL button state (authoritative source of truth).
    // Handles auto-advance after tier completion and manual toggling between runs.
    if (typeof AWOLDifficulty !== 'undefined' && AWOLDifficulty.getCurrentTier) {
      _desiredDifficultyTier = AWOLDifficulty.getCurrentTier();
    }

    // Apply desired UBER difficulty on run start (before initial floor generation)
    _applyDesiredDifficultyTier('start_run');

    // Generate initial floor
    _generateFloor();

    // Start game loop
    _startGameLoop();

    // Floor 0 scripted walk: auto-path the player toward the exit (Floor 1 door).
    // Player control is disabled until they reach Floor 1.
    if (_floor === 0) {
      _scriptedWalk = true;
      try {
        // Find the forward exit position from current grid
        var exitTarget = null;
        for (var sy = 0; sy < GRID_HEIGHT && !exitTarget; sy++) {
          for (var sx = 0; sx < GRID_WIDTH && !exitTarget; sx++) {
            if (_grid[sy] && (_grid[sy][sx] === TILES.EXIT)) {
              var mk = sx + ',' + sy;
              if (_tileMetadata[mk] && _tileMetadata[mk].doorKind === 'forward') {
                exitTarget = { x: sx, y: sy };
              }
            }
          }
        }
        if (exitTarget) {
          _scriptedWalkTarget = exitTarget;
          // Delay slightly so the grid renders before the walk starts
          setTimeout(function() {
            if (typeof GoneRogueMovement !== 'undefined' && GoneRogueMovement.setTarget) {
              // Must init movement system at player pos before setting a target
              GoneRogueMovement.init(_player.x, _player.y);
              // collisionCheck(x,y) returns true if BLOCKED (matches findPath convention)
              var pathFound = GoneRogueMovement.setTarget(exitTarget.x, exitTarget.y, function(x, y) {
                return !_isWalkable(x, y);
              }, false);
              // If pathfinding failed, abort scripted walk so player isn't stuck
              if (!pathFound) {
                console.warn('[GoneRogue] Scripted walk: no path to exit, aborting');
                _scriptedWalk = false;
                _scriptedWalkTarget = null;
              }
            }
          }, 600);
        }
      } catch (eScripted) {
        console.warn('[GoneRogue] Scripted walk setup error:', eScripted);
        _scriptedWalk = false;
      }
    }

    // Use mobile UI if available
    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      GoneRogueMobile.show();
      _updateMobileGrid();

      // BAC floating popup is RETIRED. RogueSidebar (embedded in terminal
      // control rail) now owns the left-column card/item display.
      // BAC stays hidden; RogueSidebar auto-renders via its own _tick() interval.

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
        lines: [],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Switch debrief feed to resource display for Gone Rogue
    if (typeof DebriefFeedController !== 'undefined') {
      DebriefFeedController.setMode('goneRogue');
    }

    return {
      lines: _renderGrid(),
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

    // Theft command (pre-combat): attempt to pickpocket an adjacent enemy if player has a theft tool equipped.
    if (cmd === 'steal' || cmd === 'pickpocket') {
      return _attemptPickpocket();
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
      '  STEAL              - Pickpocket adjacent enemy (requires Pickpocket Gloves equipped)',
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
          var label = item.qualityName || item.rarity || item.subtype || '';
          lines.push('  ' + (i+1) + '. ' + (item.emoji || '📦') + ' ' + (item.name || 'Item') + (label ? ' [' + label + ']' : ''));
        });
      } else {
        lines.push('  [EMPTY]');
      }

      lines.push('');
      lines.push('LOOSE CARRY (' + loose.length + '/' + GAMESTATE.getState().looseSlots + '):');
      if (loose.length) {
        loose.forEach(function(item, i) {
          var label = item.qualityName || item.rarity || '';
          lines.push('  ' + (i+1) + '. ' + (item.emoji || '📦') + ' ' + (item.name || 'Item') + (label ? ' [' + label + ']' : ''));
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
    if (typeof FloorGenerator !== 'undefined') return FloorGenerator.pickWeightedChar(tiles, _floorGenCtx());
    return tiles[tiles.length - 1].char;
  }

  /**
   * Build the biome visual grid: pre-compute wall/floor char substitutions
   * so the display is stable across render calls (no flickering).
   * Stores result in _biomeVisualGrid.
   */
  function _buildBiomeVisualGrid(biome) {
    if (typeof FloorGenerator !== 'undefined') {
      _biomeVisualGrid = FloorGenerator.buildBiomeVisualGrid(biome, _floorGenCtx());
    } else { _biomeVisualGrid = null; }
  }

  /**
   * Generate render objects for a single tile with seeded scatter.
   * Creates multiple visual objects per wall tile for density without changing collision.
   * @param {number} x - Tile X position
   * @param {number} y - Tile Y position
   * @param {Object} biome - Current biome definition
   * @returns {Array} Array of render objects { emoji, offsetX, offsetY, scale, layer }
   */
  function _generateTileRenderObjects(x, y, biome) {
    if (typeof FloorGenerator !== 'undefined') return FloorGenerator.generateTileRenderObjects(x, y, biome, _floorGenCtx());
    return [];
  }

  /**
   * Helper to pick weighted character using provided RNG instance
   * @param {Array} tiles - Array of { char, weight }
   * @param {SeededRNG} rng - RNG instance to use
   * @returns {string} Selected character
   */
  function _pickWeightedCharWithRNG(tiles, rng) {
    if (typeof FloorGenerator !== 'undefined') return FloorGenerator.pickWeightedCharWithRNG(tiles, rng);
    return tiles[tiles.length - 1].char;
  }

  /**
   * Get neighbor tiles for a position
   * @param {number} x - Tile X position
   * @param {number} y - Tile Y position
   * @returns {Array} Array of neighbor tile values
   */
  function _getNeighborTiles(x, y) {
    if (typeof FloorGenerator !== 'undefined') return FloorGenerator.getNeighborTiles(x, y, _floorGenCtx());
    return [];
  }

  /**
   * Build tile render objects grid: pre-compute visual scatter objects
   * for each tile to create dense forest walls without changing collision.
   * Stores result in _tileRenderObjects.
   */
  function _buildTileRenderObjects(biome) {
    if (typeof FloorGenerator !== 'undefined') {
      _tileRenderObjects = FloorGenerator.buildTileRenderObjects(biome, _floorGenCtx());
    } else { _tileRenderObjects = null; }
  }

  // ============================================================
  // BIOME BACKGROUND GRADIENT SYSTEM
  // 135-degree axial gradient per biome (matches gambling card convention)
  // ============================================================

  /**
   * Parse hex color string to RGB object
   * @param {string} hex - Color string like '#0a1a0a'
   * @returns {Object} { r, g, b } integers 0-255
   */
  function _hexToRgb(hex) {
    if (typeof FloorGenerator !== 'undefined') return FloorGenerator.hexToRgb(hex);
    return { r: 0, g: 0, b: 0 };
  }

  /**
   * Convert RGB values to hex color string
   * @param {number} r - Red 0-255
   * @param {number} g - Green 0-255
   * @param {number} b - Blue 0-255
   * @returns {string} Hex color string like '#0a1a0a'
   */
  function _rgbToHex(r, g, b) {
    if (typeof FloorGenerator !== 'undefined') return FloorGenerator.rgbToHex(r, g, b);
    return '#000000';
  }

  /**
   * Linear interpolate between two hex colors
   * @param {string} color1 - Start hex color
   * @param {string} color2 - End hex color
   * @param {number} t - Interpolation factor 0.0 to 1.0
   * @returns {string} Interpolated hex color
   */
  function _lerpColor(color1, color2, t) {
    if (typeof FloorGenerator !== 'undefined') return FloorGenerator.lerpColor(color1, color2, t);
    return color1;
  }

  /**
   * Pre-compute per-tile background colors for the current biome gradient.
   * Uses 135-degree axial gradient (top-left to bottom-right diagonal).
   * @param {Object} biome - Biome definition with backgroundGradient
   * @param {boolean} isNight - Whether this is a night biome variant
   */
  function _buildBiomeBackgroundColors(biome, isNight) {
    if (typeof FloorGenerator !== 'undefined') {
      _biomeBackgroundColors = FloorGenerator.buildBiomeBackgroundColors(biome, isNight, _floorGenCtx());
    } else { _biomeBackgroundColors = null; }
  }

  /**
   * Get the biome background color for a specific tile position.
   * Returns null if no gradient is active.
   * @param {number} x - Grid X coordinate
   * @param {number} y - Grid Y coordinate
   * @returns {string|null} Hex color or null
   */
  function getBiomeBackgroundColor(x, y) {
    if (!_biomeBackgroundColors) return null;
    if (y < 0 || y >= _biomeBackgroundColors.length) return null;
    if (x < 0 || x >= _biomeBackgroundColors[y].length) return null;
    return _biomeBackgroundColors[y][x];
  }

  /**
   * Get tile render objects for a specific tile position
   * @param {number} x - Tile X position
   * @param {number} y - Tile Y position
   * @returns {Array|null} Array of render objects or null
   */
  function getTileRenderObjects(x, y) {
    if (!_tileRenderObjects) return null;
    if (y < 0 || y >= _tileRenderObjects.length) return null;
    if (x < 0 || x >= _tileRenderObjects[y].length) return null;
    return _tileRenderObjects[y][x];
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
    if (typeof TutorialFloors === 'undefined') {
      console.warn('[TutorialFloors] Module not loaded, falling back to procedural generation');
      return;
    }

    var layout = TutorialFloors.getFloorLayout(_floor);
    if (!layout) {
      console.warn('[TutorialFloors] No layout found for floor ' + _floor);
      return;
    }

    console.log('[TutorialFloors] Generating contrived floor ' + _floor + ': ' + layout.name);

    // Generate floor data from authored layout (do not shift full-grid templates).
    // Continuity is handled by spawning near the correct door.
    var floorData = TutorialFloors.generateContrivedFloor(layout);

    // Apply grid
    _grid = floorData.grid;

    // Place player: continuity via door-consistent spawning (no template shifting).
    _player.x = floorData.player.x;
    _player.y = floorData.player.y;

    // Save spawn mode so later adjacency logic can use the correct anchor door.
    var _doorTransitionMode = _spawnFromLastExitPos; // 'advance' | 'retreat' | null

    // If we just used a door, spawn ON the corresponding door tile, but protect against
    // immediate re-trigger until the player steps off and returns.
    try {
      if (_spawnFromLastExitPos) {
        var targetDoorKind = (_spawnFromLastExitPos === 'retreat') ? 'forward' : 'back';
        var doorX = (targetDoorKind === 'forward') ? floorData.exit.x : floorData.player.x;
        var doorY = (targetDoorKind === 'forward') ? floorData.exit.y : floorData.player.y;

        _player.x = doorX;
        _player.y = doorY;
        _doorSpawnProtect = { x: doorX, y: doorY };
      }
    } catch (e0) {}

    _spawnFromLastExitPos = null;
    _ensurePlayerOnEmptyTile();

    // Place exit (forward)
    var exitX = floorData.exit.x;
    var exitY = floorData.exit.y;

    function _findNearestEmptyDoorSpot(x0, y0, avoidX, avoidY, minDist) {
      var best = null;
      for (var r = 0; r <= 12; r++) {
        for (var dy = -r; dy <= r; dy++) {
          for (var dx = -r; dx <= r; dx++) {
            var tx = x0 + dx;
            var ty = y0 + dy;
            if (tx <= 0 || tx >= GRID_WIDTH - 1 || ty <= 0 || ty >= GRID_HEIGHT - 1) continue;
            if (!_grid[ty] || _grid[ty][tx] !== TILES.EMPTY) continue;
            if (typeof avoidX === 'number' && typeof avoidY === 'number') {
              var dist = Math.abs(tx - avoidX) + Math.abs(ty - avoidY);
              if (dist < (minDist || 0)) continue;
            }
            best = { x: tx, y: ty };
            return best;
          }
        }
      }
      return best;
    }

    // If exit coords landed on a wall/obstacle (e.g. after shift), carve it to empty.
    // Tutorial floors are authored; we prefer deterministic doors over relocation.
    if (exitX <= 0) exitX = 1;
    if (exitX >= GRID_WIDTH - 1) exitX = GRID_WIDTH - 2;
    if (exitY <= 0) exitY = 1;
    if (exitY >= GRID_HEIGHT - 1) exitY = GRID_HEIGHT - 2;
    if (_grid[exitY]) _grid[exitY][exitX] = TILES.EMPTY;

    _grid[exitY][exitX] = TILES.EXIT;
    _tileMetadata[exitX + ',' + exitY] = { type: 'door', doorKind: 'forward' };

    // If player spawned too close to the forward exit, move them (and entry door) away.
    // This prevents the "spawn next to next-floor door" stacking bug on floor 2.
    // Skip this for retreat: the player SHOULD be near the exit when returning.
    if (_doorTransitionMode !== 'retreat') {
      try {
        var distSpawnExit = Math.abs(_player.x - exitX) + Math.abs(_player.y - exitY);
        if (distSpawnExit <= 2) {
          var sx0 = _player.x;
          var sy0 = _player.y;
          var moved = false;
          for (var r = 1; r <= 10 && !moved; r++) {
            for (var dy = -r; dy <= r && !moved; dy++) {
              for (var dx = -r; dx <= r && !moved; dx++) {
                var tx = sx0 + dx;
                var ty = sy0 + dy;
                if (tx <= 0 || tx >= GRID_WIDTH - 1 || ty <= 0 || ty >= GRID_HEIGHT - 1) continue;
                if (!_grid[ty] || _grid[ty][tx] !== TILES.EMPTY) continue;
                var d2 = Math.abs(tx - exitX) + Math.abs(ty - exitY);
                if (d2 >= 4) {
                  _player.x = tx;
                  _player.y = ty;
                  moved = true;
                }
              }
            }
          }
        }
      } catch (e0) {}
    }

    // Mark entry/return door at the entry point, but DO NOT spawn the player on top of it.
    // (player glyph hides the door tile, making it look like there is only one door).
    var backX = floorData.player.x;
    var backY = floorData.player.y;

    // Back door must always exist. Clamp + carve to empty (deterministic).
    if (backX <= 0) backX = 1;
    if (backX >= GRID_WIDTH - 1) backX = GRID_WIDTH - 2;
    if (backY <= 0) backY = 1;
    if (backY >= GRID_HEIGHT - 1) backY = GRID_HEIGHT - 2;
    if (_grid[backY]) _grid[backY][backX] = TILES.EMPTY;

    function _tryMoveBackDoorAwayFrom(x0, y0, avoidX, avoidY, minDist) {
      var moved = false;
      for (var r = 1; r <= 6 && !moved; r++) {
        for (var dy = -r; dy <= r && !moved; dy++) {
          for (var dx = -r; dx <= r && !moved; dx++) {
            var tx = x0 + dx;
            var ty = y0 + dy;
            if (tx <= 0 || tx >= GRID_WIDTH - 1 || ty <= 0 || ty >= GRID_HEIGHT - 1) continue;
            if (!_grid[ty] || _grid[ty][tx] !== TILES.EMPTY) continue;

            // Avoid placing the back door under visual clutter (trees/buildings overlays)
            var blocked = false;
            if (_forestBuildings && _forestBuildings.length) {
              for (var bi = 0; bi < _forestBuildings.length; bi++) {
                if (_forestBuildings[bi].x === tx && _forestBuildings[bi].y === ty) { blocked = true; break; }
              }
            }
            if (blocked) continue;

            var dist = Math.abs(tx - avoidX) + Math.abs(ty - avoidY);
            if (dist >= (minDist || 0)) {
              backX = tx;
              backY = ty;
              moved = true;
            }
          }
        }
      }
      return moved;
    }

    // If spawn overlaps the forward exit, push the back door to a nearby empty tile
    if (backX === exitX && backY === exitY) {
      _tryMoveBackDoorAwayFrom(backX, backY, exitX, exitY, 1);
    }

    // If back door is too close to forward exit (stacked/adjacent confusion), separate them.
    if (Math.abs(backX - exitX) + Math.abs(backY - exitY) <= 2) {
      _tryMoveBackDoorAwayFrom(backX, backY, exitX, exitY, 4);
    }

    _grid[backY][backX] = TILES.DOOR;
    _tileMetadata[backX + ',' + backY] = { type: 'door', doorKind: 'back' };

    // Spawn player adjacent to the door they just came through.
    // On retreat: anchor near the forward exit (so the player is close to where they left).
    // On advance/first-visit: anchor near the back door (so the return door is visible).
    try {
      var _anchorX = (_doorTransitionMode === 'retreat') ? exitX : backX;
      var _anchorY = (_doorTransitionMode === 'retreat') ? exitY : backY;
      var _avoidX  = (_doorTransitionMode === 'retreat') ? backX  : exitX;
      var _avoidY  = (_doorTransitionMode === 'retreat') ? backY  : exitY;

      var spawnChoices = [
        { x: _anchorX - 1, y: _anchorY },
        { x: _anchorX + 1, y: _anchorY },
        { x: _anchorX, y: _anchorY - 1 },
        { x: _anchorX, y: _anchorY + 1 }
      ];

      var picked = null;
      for (var si = 0; si < spawnChoices.length; si++) {
        var s = spawnChoices[si];
        if (s.x <= 0 || s.x >= GRID_WIDTH - 1 || s.y <= 0 || s.y >= GRID_HEIGHT - 1) continue;
        if (!_grid[s.y] || _grid[s.y][s.x] !== TILES.EMPTY) continue;
        if (Math.abs(s.x - _avoidX) + Math.abs(s.y - _avoidY) <= 2) continue;
        picked = s;
        break;
      }

      if (picked) {
        _player.x = picked.x;
        _player.y = picked.y;
      }
    } catch (e0) {}

    // Place buildings (visual overlay)
    _forestBuildings = [];
    floorData.buildings.forEach(function(building) {
      // Never overwrite/cover door tiles
      if ((building.x === exitX && building.y === exitY) || (building.x === backX && building.y === backY)) {
        return;
      }
      _grid[building.y][building.x] = TILES.WALL; // Impassable
      _forestBuildings.push({ x: building.x, y: building.y, emoji: building.emoji });
    });

    // Re-assert door tiles after any template/building mutations
    _grid[exitY][exitX] = TILES.EXIT;
    _tileMetadata[exitX + ',' + exitY] = { type: 'door', doorKind: 'forward' };
    _grid[backY][backX] = TILES.DOOR;
    _tileMetadata[backX + ',' + backY] = { type: 'door', doorKind: 'back' };

    // Place decorations (visual overlay, walkable)
    floorData.decorations.forEach(function(deco) {
      if ((deco.x === exitX && deco.y === exitY) || (deco.x === backX && deco.y === backY)) return;
      _forestBuildings.push({ x: deco.x, y: deco.y, emoji: deco.emoji });
    });

    // Re-assert doors again after decorations too (decor overlays can visually hide doors; metadata must remain stable)
    _grid[exitY][exitX] = TILES.EXIT;
    _tileMetadata[exitX + ',' + exitY] = { type: 'door', doorKind: 'forward' };
    _grid[backY][backX] = TILES.DOOR;
    _tileMetadata[backX + ',' + backY] = { type: 'door', doorKind: 'back' };

    // Ensure no visual overlay (buildings/decorations) sits on top of a door tile.
    try {
      if (_forestBuildings && _forestBuildings.length) {
        _forestBuildings = _forestBuildings.filter(function(b) {
          if (!b) return false;
          return !((b.x === exitX && b.y === exitY) || (b.x === backX && b.y === backY));
        });
      }
    } catch (e00) {}

    // Ensure no entities/breakables/items sit on door tiles either (they render above tiles and can hide doors).
    try {
      if (Array.isArray(_breakables)) {
        _breakables = _breakables.filter(function(bb) { return bb && !((bb.x === exitX && bb.y === exitY) || (bb.x === backX && bb.y === backY)); });
      }
    } catch (e01) {}
    try {
      if (Array.isArray(_items)) {
        _items = WorldItems.filterFloorItems(function(it) { return it && !((it.x === exitX && it.y === exitY) || (it.x === backX && it.y === backY)); });
      }
    } catch (e02) {}
    try {
      if (Array.isArray(_enemies)) {
        _enemies = _enemies.filter(function(en) { return en && !((en.x === exitX && en.y === exitY) || (en.x === backX && en.y === backY)); });
      }
    } catch (e03) {}

    // If the player is currently standing on the back door, show a one-shot hint so it isn't "invisible" under the player glyph.
    try {
      if (_player && _player.x === backX && _player.y === backY && typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
        OverheadAnimator.showGenericExpression(backX, backY, '↩️', 900);
      }
    } catch (e0) {}

    // Place breakables
    floorData.breakables.forEach(function(breakable) {
      _breakables.push({
        x: breakable.x,
        y: breakable.y,
        hp: breakable.hp,
        maxHp: breakable.hp,
        glyph: TILES.BREAKABLE,
        destroyedGlyph: TILES.DEBRIS,
        emoji: breakable.emoji,
        name: breakable.name,
        tag: 'tutorial_breakable_' + _breakables.length,
        drops: breakable.drops
      });
    });

    // Place tutorial gate (floor 1)
    if (floorData.tutorialGate) {
      floorData.tutorialGate.positions.forEach(function(pos) {
        _breakables.push({
          x: pos.x,
          y: pos.y,
          hp: floorData.tutorialGate.hp,
          maxHp: floorData.tutorialGate.hp,
          glyph: TILES.BREAKABLE,
          destroyedGlyph: TILES.DEBRIS,
          emoji: floorData.tutorialGate.emoji,
          name: floorData.tutorialGate.name,
          tag: 'tutorial_gate_' + pos.x + '_' + pos.y
        });
      });

      // Place tutorial pickups behind gate
      if (floorData.tutorialPickups) {
        floorData.tutorialPickups.forEach(function(pickup) {
          if (pickup.type === 'currency') {
            _currencies.push({
              x: pickup.x,
              y: pickup.y,
              amount: pickup.amount,
              collected: false
            });
          } else if (pickup.type === 'card' && pickup.guaranteed) {
            // Place guaranteed card pickup
            _items.push({
              x: pickup.x,
              y: pickup.y,
              type: 'card',
              card: 'strike', // Default tutorial card
              collected: false
            });
          }
        });
      }
    }

    // Place locked gate (floor 2)
    // Implemented as a wall tile with metadata so it renders as a door and can be unlocked via INTERACT.
    if (floorData.lockedGate) {
      floorData.lockedGate.positions.forEach(function(pos) {
        _grid[pos.y][pos.x] = TILES.WALL; // blocked until unlocked

        var k = pos.x + ',' + pos.y;
        var req = (floorData.lockedGate.requiredKey || floorData.lockedGate.requiresKey || 'RUSTY_KEY');
        req = ('' + req).toUpperCase().replace(/[^A-Z0-9_]/g, '_');

        _tileMetadata[k] = {
          type: 'locked_gate',
          requiredKey: req,
          emoji: (floorData.lockedGate.emoji || '🚪'),
          name: (floorData.lockedGate.name || 'Locked Door'),
          positions: floorData.lockedGate.positions // multi-tile reference for poof effect
        };
      });
    }

    if (floorData.keyBreakable) {
      var keyObj = floorData.keyBreakable;
      _breakables.push({
        x: keyObj.x,
        y: keyObj.y,
        hp: keyObj.hp,
        maxHp: keyObj.hp,
        glyph: TILES.BREAKABLE,
        destroyedGlyph: TILES.DEBRIS,
        emoji: keyObj.emoji,
        name: keyObj.name,
        tag: 'key_breakable',
        drops: keyObj.drops
      });
    }

    // Place locked chests (floor 1+)
    if (floorData.lockedChests && floorData.lockedChests.length) {
      floorData.lockedChests.forEach(function(ch) {
        // Mark as blocked until opened
        _grid[ch.y][ch.x] = TILES.WALL;
        _tileMetadata[ch.x + ',' + ch.y] = {
          type: 'locked_chest',
          emoji: ch.emoji || '🧰',
          name: ch.name || 'Locked Chest',
          acceptsKeys: ch.acceptsKeys || ['RUSTY_KEY'],
          message: ch.message || null
        };
      });
    }

    // Place tutorial NPCs / gate NPCs
    if (floorData.npcs && floorData.npcs.length) {
      floorData.npcs.forEach(function(npc) {
        var npcId = npc.id || ('NPC-' + npc.x + '-' + npc.y);
        var dir = (npc.direction || 'south').toLowerCase();

        var npcObj = {
          id: npcId,
          x: npc.x,
          y: npc.y,
          emoji: npc.emoji || '🧑',
          name: npc.name || 'NPC',
          direction: dir,
          dialogues: Array.isArray(npc.dialogues) ? npc.dialogues.slice() : [],
          gate: npc.gate || null,
          reward: npc.reward || null,
          shopkeeper: npc.shopkeeper || false,
          state: {
            released: false,
            rewardGiven: false,
            lastWarnTurn: -999,
            lastTalkTurn: -999
          }
        };

        _npcs.push(npcObj);

        // Occupy NPC tile
        _grid[npcObj.y][npcObj.x] = TILES.WALL;
        _tileMetadata[npcObj.x + ',' + npcObj.y] = {
          type: 'npc',
          npcId: npcObj.id,
          emoji: npcObj.emoji,
          name: npcObj.name
        };

        // Project gate warning/trigger zones
        if (npcObj.gate && npcObj.gate.type && !npcObj.state.released) {
          var wDist = (npcObj.gate.warningDistance != null) ? npcObj.gate.warningDistance : 6;
          var tDist = (npcObj.gate.triggerDistance != null) ? npcObj.gate.triggerDistance : 3;
          var width = (npcObj.gate.width != null) ? npcObj.gate.width : 2;

          function _markZone(dist, zoneType) {
            for (var f = 1; f <= dist; f++) {
              for (var s = -width; s <= width; s++) {
                var zx = npcObj.x;
                var zy = npcObj.y;

                if (dir === 'north') {
                  zx = npcObj.x + s;
                  zy = npcObj.y - f;
                } else if (dir === 'south') {
                  zx = npcObj.x + s;
                  zy = npcObj.y + f;
                } else if (dir === 'east') {
                  zx = npcObj.x + f;
                  zy = npcObj.y + s;
                } else if (dir === 'west') {
                  zx = npcObj.x - f;
                  zy = npcObj.y + s;
                }

                if (zx < 0 || zx >= GRID_WIDTH || zy < 0 || zy >= GRID_HEIGHT) continue;
                // Don't overwrite actual walls/breakables/locked gates/chests
                if (_grid[zy][zx] === TILES.WALL) continue;

                var key = zx + ',' + zy;
                // Trigger zone wins over warning zone
                if (zoneType === 'npc_gate_trigger') {
                  _tileMetadata[key] = { type: 'npc_gate_trigger', npcId: npcObj.id };
                } else {
                  if (!_tileMetadata[key]) {
                    _tileMetadata[key] = { type: 'npc_gate_warning', npcId: npcObj.id };
                  }
                }
              }
            }
          }

          _markZone(wDist, 'npc_gate_warning');
          _markZone(tDist, 'npc_gate_trigger');
        }
      });
    }

    // Place enemies (intended for floor 3)
    // Enforce: no enemies on Cozy Forest tutorial floors until floor 3.
    var tutorialEnemies = (Array.isArray(floorData.enemies) ? floorData.enemies : []);
    if (_floor < 3) tutorialEnemies = [];

    tutorialEnemies.forEach(function(enemy) {
      var enemyObj = {
        x: enemy.x,
        y: enemy.y,
        hp: enemy.hp,
        maxHp: enemy.maxHp,
        str: enemy.attack,
        dex: enemy.defense,
        awareness: 0,
        orientation: enemy.orientation || 'south',
        sightRange: enemy.sightRange || 3,
        emoji: enemy.emoji,
        name: enemy.name,
        dropTable: enemy.dropTable,
        dead: false,
        isTreasureGoblin: false
      };

      // Setup patrol path
      if (enemy.patrolType === 'stationary') {
        enemyObj.path = { type: PATH_TYPES.STATIONARY };
      } else if (enemy.patrolType === 'circular' && enemy.patrolPath) {
        enemyObj.path = {
          type: PATH_TYPES.CIRCULAR,
          points: enemy.patrolPath,
          currentIndex: 0
        };
      }

      _enemies.push(enemyObj);
    });

    // Tutorial lighting: contrived floors return early from _generateFloor(),
    // so we must generate lighting here.
    if (typeof LightingSystem !== 'undefined') {
      // Alternate day/night by floor number (simple variant)
      var biomeName = (_floor % 2 === 1) ? 'COZY_FOREST_DAY' : 'COZY_FOREST_NIGHT';
      LightingSystem.setBiome(biomeName);
      LightingSystem.setDarknessMultiplier(1.0);

      // Build wall cache from the current grid and generate a few environmental lights.
      _rebuildWallCache();
      var walls = _wallCache;

      // Use a pseudo-room covering the interior so lights place even without procedural rooms.
      var pseudoRooms = [{ x: 1, y: 1, width: GRID_WIDTH - 2, height: GRID_HEIGHT - 2 }];
      LightingSystem.generateBiomeLights(GRID_WIDTH, GRID_HEIGHT, pseudoRooms, walls);

      // Guarantee light sources near player spawn and exit for visibility.
      // Place the exit light ADJACENT to the door (not on it) so it doesn't cover the door emoji.
      LightingSystem.addLightSource(_player.x, _player.y, 'CAMPFIRE');
      var exitLightX = (exitX + 1 < GRID_WIDTH - 1) ? exitX + 1 : exitX - 1;
      var exitLightY = exitY;
      LightingSystem.addLightSource(exitLightX, exitLightY, 'LIGHT_BULB');

      // Always include player/enemy lights
      _updatePlayerLight();
      LightingSystem.updateEnemyLights(_enemies);
      LightingSystem.updateLightMap(GRID_WIDTH, GRID_HEIGHT, _getAllLightBlockers(walls));

      var playerLight = LightingSystem.getLightAt(_player.x, _player.y);
      console.log('[Lighting] Tutorial floor ' + _floor + ': biome=' + biomeName +
        ', playerIntensity=' + playerLight.intensity.toFixed(2) +
        ', sources=' + (playerLight.sources ? playerLight.sources.join(',') : 'none'));
    }

    // Place NPCs (floor 2)
    // TODO: Implement NPC system
    if (floorData.npcs && floorData.npcs.length > 0) {
      console.log('[TutorialFloors] NPCs defined but NPC system not yet implemented');
    }

    // Place building doors (tavern, church, etc.) — special door tiles leading to interior floors
    if (floorData.buildingDoors && floorData.buildingDoors.length > 0) {
      floorData.buildingDoors.forEach(function(bd) {
        if (!bd || typeof bd.x !== 'number' || typeof bd.y !== 'number') return;
        if (bd.x < 0 || bd.x >= GRID_WIDTH || bd.y < 0 || bd.y >= GRID_HEIGHT) return;

        // Carve the door tile to empty first, then stamp as a door
        _grid[bd.y][bd.x] = TILES.DOOR;
        _tileMetadata[bd.x + ',' + bd.y] = {
          type: 'building_door',
          doorKind: 'building',
          buildingId: bd.buildingId || null,
          targetFloorId: bd.targetFloorId || null,
          emoji: '🚪',
          name: (bd.buildingId || 'Building') + ' Entrance'
        };

        console.log('[TutorialFloors] Placed building door at (' + bd.x + ',' + bd.y + ') → ' + (bd.targetFloorId || 'unknown'));
      });
    }

    // Place interactive items (signs, books, food, area-of-interest)
    if (floorData.interactiveItems && typeof InteractiveItems !== 'undefined') {
      floorData.interactiveItems.forEach(function(itemDef) {
        var item = InteractiveItems.createItem(itemDef.type, itemDef.x, itemDef.y, {
          text: itemDef.text || '',
          emoji: itemDef.emoji,
          name: itemDef.name,
          customData: itemDef.customData
        });
        if (item) {
          InteractiveItems.addItem(item);
        }
      });
      console.log('[TutorialFloors] Placed ' + floorData.interactiveItems.length + ' interactive items');
    }

    // Place water tiles
    if (floorData.waterTiles) {
      floorData.waterTiles.forEach(function(w) {
        if (w.y >= 0 && w.y < GRID_HEIGHT && w.x >= 0 && w.x < GRID_WIDTH) {
          _grid[w.y][w.x] = '~';
        }
      });
      console.log('[TutorialFloors] Placed ' + floorData.waterTiles.length + ' water tiles');
    }

    // Place breadcrumb pickups (small currency rewards along exploration paths)
    if (floorData.breadcrumbPickups) {
      floorData.breadcrumbPickups.forEach(function(pickup) {
        _currencies.push({
          x: pickup.x,
          y: pickup.y,
          amount: pickup.amount || 3,
          collected: false
        });
      });
      console.log('[TutorialFloors] Placed ' + floorData.breadcrumbPickups.length + ' breadcrumb pickups');
    }

    // Final tutorial door guarantee: after ALL placements (breakables/items/currency/water/etc),
    // force door tiles+metadata and remove anything that could render over them.
    try {
      // Never allow back+forward doors to overlap (confusing + can cause spawn-on-exit).
      if (exitX === backX && exitY === backY) {
        var moved = _findNearestEmptyDoorSpot(exitX, exitY, backX, backY, 6);
        if (moved) { exitX = moved.x; exitY = moved.y; }
      }

      // Never allow the player to spawn on top of the forward/advance door.
      if (_player && _player.x === exitX && _player.y === exitY) {
        var sp = _findNearestEmptyDoorSpot(_player.x, _player.y, exitX, exitY, 2);
        if (sp) { _player.x = sp.x; _player.y = sp.y; }
      }

      // Carve
      if (_grid && _grid[exitY]) _grid[exitY][exitX] = TILES.EXIT;
      _tileMetadata[exitX + ',' + exitY] = { type: 'door', doorKind: 'forward' };
      if (_grid && _grid[backY]) _grid[backY][backX] = TILES.DOOR;
      _tileMetadata[backX + ',' + backY] = { type: 'door', doorKind: 'back' };

      // Remove overlays/entities from door positions
      if (_forestBuildings && _forestBuildings.length) {
        _forestBuildings = _forestBuildings.filter(function(b) {
          return b && !((b.x === exitX && b.y === exitY) || (b.x === backX && b.y === backY));
        });
      }
      if (Array.isArray(_breakables)) {
        _breakables = _breakables.filter(function(bb) { return bb && !((bb.x === exitX && bb.y === exitY) || (bb.x === backX && bb.y === backY)); });
      }
      if (Array.isArray(_items)) {
        _items = WorldItems.filterFloorItems(function(it) { return it && !((it.x === exitX && it.y === exitY) || (it.x === backX && it.y === backY)); });
      }
      if (Array.isArray(_currencies)) {
        _currencies = WorldItems.filterCurrencies(function(cc) { return cc && !((cc.x === exitX && cc.y === exitY) || (cc.x === backX && cc.y === backY)); });
      }
      if (Array.isArray(_enemies)) {
        _enemies = _enemies.filter(function(en) { return en && !((en.x === exitX && en.y === exitY) || (en.x === backX && en.y === backY)); });
      }

      // Relocate any NPCs sitting on door tiles (the DOM renderer draws NPC emoji on top
      // of the tile, hiding the door even when the grid tile is correctly set to 🚪).
      if (Array.isArray(_npcs)) {
        _npcs.forEach(function(npc) {
          if (!npc) return;
          var onDoor = (npc.x === exitX && npc.y === exitY) || (npc.x === backX && npc.y === backY);
          if (!onDoor) return;

          // Try to move the NPC to an adjacent empty tile
          var dirs = [
            { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
            { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
            { dx: -1, dy: -1 }, { dx: 1, dy: -1 },
            { dx: -1, dy: 1 }, { dx: 1, dy: 1 }
          ];
          var oldX = npc.x, oldY = npc.y;
          var relocated = false;
          for (var di = 0; di < dirs.length; di++) {
            var nx = oldX + dirs[di].dx;
            var ny = oldY + dirs[di].dy;
            if (nx <= 0 || nx >= GRID_WIDTH - 1 || ny <= 0 || ny >= GRID_HEIGHT - 1) continue;
            if (!_grid[ny] || (_grid[ny][nx] !== TILES.EMPTY && _grid[ny][nx] !== TILES.GRASS)) continue;
            // Don't relocate onto a door
            if ((nx === exitX && ny === exitY) || (nx === backX && ny === backY)) continue;
            // Don't relocate onto a live breakable
            var bb0 = _getBreakableAt ? _getBreakableAt(nx, ny) : null;
            if (bb0 && bb0.hp > 0) continue;

            // Move NPC to new position (NPCs are visual; do NOT mutate grid tiles)
            npc.x = nx;
            npc.y = ny;
            relocated = true;
            console.log('[TutorialFloors] Relocated NPC ' + npc.name + ' from (' + oldX + ',' + oldY + ') to (' + nx + ',' + ny + ') to avoid door collision');
            break;
          }
          if (!relocated) {
            console.warn('[TutorialFloors] Could not relocate NPC ' + npc.name + ' off door at (' + oldX + ',' + oldY + ')');
          }
        });
      }

      // Final re-stamp doors after ALL entity relocations to guarantee grid+metadata integrity.
      if (_grid && _grid[exitY]) _grid[exitY][exitX] = TILES.EXIT;
      _tileMetadata[exitX + ',' + exitY] = { type: 'door', doorKind: 'forward' };
      if (_grid && _grid[backY]) _grid[backY][backX] = TILES.DOOR;
      _tileMetadata[backX + ',' + backY] = { type: 'door', doorKind: 'back' };

      // Debug: count door tiles in grid
      var doorCount = 0;
      for (var yy = 0; yy < GRID_HEIGHT; yy++) {
        for (var xx = 0; xx < GRID_WIDTH; xx++) {
          if (_grid[yy] && (_grid[yy][xx] === TILES.EXIT || _grid[yy][xx] === TILES.DOOR)) doorCount++;
        }
      }
      console.log('[TutorialFloors] Doors stamped: back=(' + backX + ',' + backY + ') forward=(' + exitX + ',' + exitY + ') count=' + doorCount);
    } catch (eDoor) {}

    // Build biome visual grid for forest biome
    var forestBiome = BIOMES.FOREST;
    _buildBiomeVisualGrid(forestBiome);
    _buildTileRenderObjects(forestBiome);

    // Build biome background gradient (day for odd floors, night for even)
    var isNightFloor = (_floor % 2 === 0);
    _buildBiomeBackgroundColors(forestBiome, isNightFloor);

    // Cache walls for lighting system
    _cachedWalls = [];
    for (var cy = 0; cy < GRID_HEIGHT; cy++) {
      for (var cx = 0; cx < GRID_WIDTH; cx++) {
        if (_grid[cy][cx] === TILES.WALL) {
          _cachedWalls.push({ x: cx, y: cy });
        }
      }
    }

    console.log('[TutorialFloors] Floor generated successfully');
    console.log('[TutorialFloors] Buildings: ' + _forestBuildings.length + ', Breakables: ' + _breakables.length + ', Enemies: ' + _enemies.length);
    if (_enemies.length > 0 && _floor < 3) {
      console.warn('[TutorialFloors] BUG: ' + _enemies.length + ' enemies on floor ' + _floor + ' (should be 0 for floors < 3)');
    }
  }

  function _generateFloor(secretFloorData) {
    // Initialize generation state
    _projectiles = [];
    _breakables = [];
    WorldItems.init();
    _items = WorldItems.getFloorItems();
    _currencies = WorldItems.getCurrencies();
    _enemies = [];
    _npcs = [];
    _shops = [];
    _tileMetadata = {};
    _activeBoss = null;
    _bossFloorActive = false;
    _bossDefeated = false;
    _bossHazards = [];
    _bossEnvironment = {};
    _playerMoveLocked = false;

    _ropeManager = new RopeManager(_player);
    const ropeItem = {
        id: 'rope-1',
        type: 'item',
        name: 'Rope',
        emoji: '➰',
        x: 5,
        y: 5
    };
    WorldItems.addItem(ropeItem);

    // Reset forest biome state
    _forestBuildings = [];
    _biomeVisualGrid = null;
    _biomeBackgroundColors = null;
    _tileRenderObjects = null;
    _cachedWalls = [];

    // Invalidate per-floor caches
    _stealthBonusCache = null;
    _activeSecretFloor = null;

// Invalidate per-floor caches
_stealthBonusCache = null;
_activeSecretFloor = null;

// Clear environmental synergy state (must happen even on early-return floors)
if (typeof EnvironmentalSynergy !== 'undefined') {
  EnvironmentalSynergy.clearGates();
}

// Determine if secret floor
var isSecretFloor = !!secretFloorData;

// Check for contrived tutorial floors (floors 1-3).
// On Uber 1+ (_difficultyTier >= 2), skip tutorials — use procedural Forest instead.
if (
  !isSecretFloor &&
  _difficultyTier <= 1 &&
  typeof TutorialFloors !== 'undefined' &&
  TutorialFloors.isContrivedFloor(_floor)
) {
  _generateContrivedTutorialFloor();
  return;
}

// Diagnostic: if floor < 3 but TutorialFloors didn't catch it, log why
if (_floor < 3 && !isSecretFloor) {
  console.warn('[GoneRogue] Floor ' + _floor + ' using PROCEDURAL path (TutorialFloors ' +
    (typeof TutorialFloors === 'undefined' ? 'NOT LOADED' : 'loaded but isContrivedFloor=' + TutorialFloors.isContrivedFloor(_floor)) + ')');
}

// Increment pity timers for card drop tracking (skip contrived tutorial floors)
_incrementPityTimers();

    // Clear environmental synergy state
    if (typeof EnvironmentalSynergy !== 'undefined') {
      EnvironmentalSynergy.clearGates();
    }

    // Determine floor type
    var floorType;

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

      // Track first bonfire visit for gate eligibility
      if (floorType === FLOOR_TYPES.BONFIRE && !_runState.firstBonfire) {
        _runState.firstBonfire = true;
        console.log('[GoneRogue] First bonfire reached - gates now eligible');
      }
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
      _ensurePlayerOnEmptyTile();
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
      _buildTileRenderObjects(floorBiome);

      // Build biome background gradient (day for odd floors, night for even)
      var isNightFloor = (_floor % 2 === 0);
      _buildBiomeBackgroundColors(floorBiome, isNightFloor);

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

    // Place biome-specific gates on regular floors
    if (floorType !== FLOOR_TYPES.TUTORIAL) {
      _placeBiomeGates(rooms, exitX, exitY, floorBiome);
    }

    // Spawn context-aware keys (separate from gates, loosely coupled)
    if (floorType !== FLOOR_TYPES.TUTORIAL) {
      _spawnContextAwareKey(rooms);
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
      // Set floor number for progression scaling
      LightingSystem.setFloor(_floor);

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

        // Forest tutorial floors: ensure we use a lighting profile that actually includes environmental lights.
        if (biomeName === 'COZY_FOREST') {
          // Simple variant: alternate day/night by floor number
          biomeName = (_floor % 2 === 1) ? 'COZY_FOREST_DAY' : 'COZY_FOREST_NIGHT';
        }
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

      // Generate biome-specific light sources (pass grid for occupancy checking)
      LightingSystem.generateBiomeLights(GRID_WIDTH, GRID_HEIGHT, rooms, walls, _grid);
      _updatePlayerLight();

      // Register interactive/breakable light sources as breakables
      var lightingConfig = LightingSystem.getConfig();
      if (lightingConfig && lightingConfig.interactiveLights && lightingConfig.interactiveLights.enabled) {
        var lightSources = LightingSystem.getLightSources();
        for (var i = 0; i < lightSources.length; i++) {
          var lightSource = lightSources[i];
          if (lightSource.interactive) {
            var breakableProps = LightingSystem.getBreakableProps(lightSource.type);
            if (breakableProps && breakableProps.hp > 0) {
              var lightDef = LightingSystem.LIGHT_SOURCES[lightSource.type];
              _breakables.push({
                x: lightSource.x,
                y: lightSource.y,
                hp: breakableProps.hp,
                maxHp: breakableProps.hp,
                emoji: lightDef.emoji,
                color: lightDef.color,
                name: lightDef.name || 'Light Source',
                type: 'light_source',
                lightType: lightSource.type,
                isLightSource: true,
                kickable: breakableProps.kickable,
                smotherable: breakableProps.smotherable,
                noise: breakableProps.noise,
                dropChance: breakableProps.dropChance,
                dropType: breakableProps.dropType,
                destroyEmoji: breakableProps.destroyEmoji
              });
            }
          }
        }
        console.log('[Lighting] Registered', _breakables.filter(function(b) { return b.isLightSource; }).length, 'interactive light sources as breakables');
      }

      // Update enemy lights
      LightingSystem.updateEnemyLights(_enemies);

      // Calculate initial light map
      LightingSystem.updateLightMap(GRID_WIDTH, GRID_HEIGHT, _getAllLightBlockers(walls));

      var playerLight = LightingSystem.getLightAt(_player.x, _player.y);
      console.log('[Lighting] Floor ' + _floor + ': biome=' + biomeName +
        ', playerIntensity=' + playerLight.intensity.toFixed(2) +
        ', sources=' + (playerLight.sources ? playerLight.sources.join(',') : 'none'));
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
    // Get current biome
    var biome = _getBiome(_floor);

    // Spawn biome-specific breakables
    _breakables = [];

    // Spawn 8-12 random breakables from the biome's prop list
    var breakableCount = 8 + Math.floor(_rng() * 5);
    var breakableProps = biome.props.filter(function(p) { return p.breakable; });

    if (breakableProps.length === 0) {
      // Fallback to generic crates if biome has no breakable props
      breakableProps = [{ emoji: '📦', name: 'Crate', breakable: true, hp: 2 }];
    }

    for (var i = 0; i < breakableCount; i++) {
      var attempts = 0;
      var placed = false;

      while (!placed && attempts < 50) {
        var x = 2 + Math.floor(_rng() * (GRID_WIDTH - 4));
        var y = 2 + Math.floor(_rng() * (GRID_HEIGHT - 4));

        // Check if position is valid (floor tile, not player, not exit, not occupied)
        if (_grid[y] && _grid[y][x] === TILES.EMPTY &&
            !(x === _player.x && y === _player.y) &&
            !_breakables.find(function(b) { return b.x === x && b.y === y; })) {

          var propTemplate = breakableProps[Math.floor(_rng() * breakableProps.length)];
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
        gateX = Math.floor(_player.x + dx * (0.5 + _rng() * 0.3));
        gateY = Math.floor(_player.y + dy * (0.5 + _rng() * 0.3));
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
    var keyX = _player.x + (_rng() > 0.5 ? 2 : -2);
    var keyY = _player.y + (_rng() > 0.5 ? 1 : -1);

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
   * Context-aware biome gate spawn system
   * Implements dynamic weighting, pity timers, and soft-lock prevention
   * @param {Array} rooms - Room objects
   * @param {number} exitX - Exit X position
   * @param {number} exitY - Exit Y position
   * @param {Object} biome - Current biome
   */
  function _placeBiomeGates(rooms, exitX, exitY, biome) {
    if (typeof EnvironmentalSynergy === 'undefined') {
      return;
    }

    // RULE 1: Floor Eligibility
    // Gates cannot spawn until after floor 1, first combat victory, or first bonfire
    var eligible = _floor > 1 && (_runState.firstCombatVictory || _runState.firstBonfire);
    if (!eligible || _floor <= 4 || BOSS_FLOORS.indexOf(_floor) !== -1) {
      _runState.floorsSinceGate++;
      return; // Skip tutorial, ghost, and boss floors
    }

    // Update biome cooldowns
    for (var biomeName in _runState.biomeEntryCooldowns) {
      if (_runState.biomeEntryCooldowns[biomeName] > 0) {
        _runState.biomeEntryCooldowns[biomeName]--;
      }
    }

    // RULE 2: Calculate gate spawn chance based on run depth
    var baseChance = 0;
    if (_floor === 2) baseChance = 0.18;
    else if (_floor === 3) baseChance = 0.28;
    else if (_floor === 4) baseChance = 0.38;
    else baseChance = 0.45; // Cap at 45%

    // RULE 4: Pity Timer - Force gate spawn after 3 floors without
    var forceGate = _runState.floorsSinceGate >= 3;

    // RULE 8: Soft-Lock Prevention - Force matching gate if player has 2+ keys without match for 3 floors
    var playerKeys = _getPlayerKeys();
    var unmatchedKeys = _countUnmatchedKeys(playerKeys);
    var forceSoftLockPrevention = unmatchedKeys >= 2 && _runState.floorsSinceGate >= 3;

    if (!forceGate && !forceSoftLockPrevention && _rng() > baseChance) {
      _runState.floorsSinceGate++;
      return; // No gate this floor
    }

    // RULE 5: Calculate biome weights dynamically
    var biomeWeights = {
      'Commercial Office': 30,
      'Shopping Mall': 25,
      'Industrial Complex': 25,
      'Aerospace Museum': 20
    };

    // Adjust weights based on player context
    for (var targetBiome in biomeWeights) {
      // If player has matching key: +15 weight (creates "destiny" feeling)
      if (_playerHasKeyForBiome(playerKeys, targetBiome)) {
        biomeWeights[targetBiome] += 15;
      }

      // If player recently visited (cooldown active): -25 weight
      if (_runState.biomeEntryCooldowns[targetBiome] > 0) {
        biomeWeights[targetBiome] = Math.max(0, biomeWeights[targetBiome] - 25);
      }

      // If player has never visited this run: +20 weight
      if (_runState.visitedGateBiomes.indexOf(targetBiome) === -1) {
        biomeWeights[targetBiome] += 20;
      }
    }

    // If forcing soft-lock prevention, boost matching biome weights dramatically
    if (forceSoftLockPrevention) {
      for (var key in playerKeys) {
        var matchingBiome = _getBiomeForKey(playerKeys[key]);
        if (matchingBiome && biomeWeights[matchingBiome] !== undefined) {
          biomeWeights[matchingBiome] += 50; // Strong boost for matching
        }
      }
    }

    // Pick biome using weighted roll
    var selectedBiome = _weightedBiomeRoll(biomeWeights);
    if (!selectedBiome) {
      _runState.floorsSinceGate++;
      return; // No valid biome found
    }

    // Get gates for selected biome
    var availableGates = EnvironmentalSynergy.getGatesForBiome(selectedBiome.toUpperCase().replace(/ /g, '_'));
    if (availableGates.length === 0) {
      availableGates = ['WOODEN_GATE', 'OLD_DOOR']; // Fallback
    }

    // Pick a random gate type
    var gateType = availableGates[Math.floor(_rng() * availableGates.length)];
    var gateDef = EnvironmentalSynergy.getGateDefinitions()[gateType];
    if (!gateDef) {
      _runState.floorsSinceGate++;
      return;
    }

    // Find a good position (between player and exit, not too close to either)
    var dx = exitX - _player.x;
    var dy = exitY - _player.y;
    var gateX = Math.floor(_player.x + dx * (0.4 + _rng() * 0.3)); // 40-70% of the way
    var gateY = Math.floor(_player.y + dy * (0.4 + _rng() * 0.3));

    // Ensure gate is on a floor tile and not too close
    var attempts = 0;
    var validPosition = false;
    while (!validPosition && attempts < 50) {
      if (_grid[gateY] && _grid[gateY][gateX] === TILES.EMPTY) {
        var distToPlayer = Math.abs(gateX - _player.x) + Math.abs(gateY - _player.y);
        var distToExit = Math.abs(gateX - exitX) + Math.abs(gateY - exitY);

        if (distToPlayer >= 8 && distToExit >= 8) {
          validPosition = true;
        }
      }

      if (!validPosition) {
        gateX = Math.floor(_player.x + dx * (0.4 + _rng() * 0.3));
        gateY = Math.floor(_player.y + dy * (0.4 + _rng() * 0.3));
        attempts++;
      }
    }

    if (!validPosition) {
      console.log('[GoneRogue] Could not find valid gate position');
      _runState.floorsSinceGate++;
      return;
    }

    // Create gate as a breakable
    var gateBreakable = {
      x: gateX,
      y: gateY,
      hp: 3,
      maxHp: 3,
      glyph: TILES.BREAKABLE,
      destroyedGlyph: TILES.DEBRIS,
      emoji: gateDef.emoji,
      name: gateDef.name,
      tag: 'gate_' + gateType,
      isGate: true,
      gateType: gateType,
      targetBiome: selectedBiome
    };

    _breakables.push(gateBreakable);
    _grid[gateY][gateX] = TILES.BREAKABLE;

    // Register with environmental synergy system
    EnvironmentalSynergy.registerGate({
      x: gateX,
      y: gateY,
      type: gateType
    });

    // Add lighting for terminal gates
    if (gateDef.glowColor && typeof LightingSystem !== 'undefined') {
      LightingSystem.addLightSource(gateX, gateY, 'TERMINAL');
    }

    // Update run state
    _runState.floorsSinceGate = 0;
    _runState.gatesSpawnedThisRun++;
    _runState.lastBiomeEntered = selectedBiome;
    _runState.biomeEntryCooldowns[selectedBiome] = 2; // 2-floor cooldown

    console.log('[GoneRogue] Placed', gateDef.name, 'for', selectedBiome, 'at', gateX, gateY, 'on floor', _floor, forceGate ? '(FORCED)' : '');
  }

  /**
   * Helper: Get player's current keys from inventory
   */
  function _getPlayerKeys(opts) {
    opts = opts || {};
    var excludeQuest = opts.excludeQuest !== false; // Default: exclude quest keys from gate matching
    var keys = [];
    if (typeof InteractiveItems !== 'undefined') {
      var items = InteractiveItems.getAllItems();
      for (var i = 0; i < items.length; i++) {
        if (items[i].type === 'key') {
          if (excludeQuest && items[i].subtype === 'quest') continue;
          keys.push(items[i].keyType || items[i].itemId);
        }
      }
    }
    // Also check GAMESTATE inventory
    if (typeof GAMESTATE !== 'undefined') {
      var loose = GAMESTATE.getLooseInventory();
      var persistent = GAMESTATE.getPersistentInventory();
      var allItems = loose.concat(persistent);
      for (var j = 0; j < allItems.length; j++) {
        if (allItems[j].type === 'key') {
          if (excludeQuest && allItems[j].subtype === 'quest') continue;
          keys.push(allItems[j].keyType || allItems[j].itemId);
        }
      }
    }
    return keys;
  }

  /**
   * Helper: Get the tier of a key by its keyType identifier.
   * Tier 1 = ammo/breakable (KEY_XX2, KEY_XX4), Tier 2 = gate/door (ITM-01X), Tier 3 = quest (ITM-03X)
   * Falls back to checking EnvironmentalSynergy definitions, then inventory item metadata.
   */
  function _getKeyTier(keyType) {
    // Check EnvironmentalSynergy definitions first (authoritative for tier)
    if (typeof EnvironmentalSynergy !== 'undefined' && EnvironmentalSynergy.getKeyDefinitions) {
      var defs = EnvironmentalSynergy.getKeyDefinitions();
      for (var k in defs) {
        if (defs.hasOwnProperty(k)) {
          var def = defs[k];
          if (k === keyType || def.itemId === keyType || def.registryId === keyType) {
            return def.tier || 1;
          }
        }
      }
    }
    // Check player's inventory for the item's tier metadata
    if (typeof GAMESTATE !== 'undefined') {
      var all = (GAMESTATE.getLooseInventory ? GAMESTATE.getLooseInventory() : [])
        .concat(GAMESTATE.getPersistentInventory ? GAMESTATE.getPersistentInventory() : []);
      for (var i = 0; i < all.length; i++) {
        var it = all[i];
        if (it && it.type === 'key') {
          var id = it.keyType || it.registryId || it.itemId;
          if (id === keyType && it.tier) return it.tier;
        }
      }
    }
    // Default: tier 1 (ammo keys — most permissive)
    return 1;
  }

  /**
   * Helper: Check if player has key for specific biome
   */
  function _playerHasKeyForBiome(playerKeys, biomeName) {
    var biomeToKey = {
      'Commercial Office': 'KEYCARD',
      'Shopping Mall': 'MALL_KEY',
      'Industrial Complex': 'INDUSTRIAL_PASS',
      'Aerospace Museum': 'ACCESS_CARD'
    };
    var requiredKey = biomeToKey[biomeName];
    if (!requiredKey) return false;
    return playerKeys.indexOf(requiredKey) !== -1;
  }

  /**
   * Helper: Get biome name for a key type
   */
  function _getBiomeForKey(keyType) {
    var keyToBiome = {
      'KEYCARD': 'Commercial Office',
      'THUMB_DRIVE': 'Commercial Office',
      'MALL_KEY': 'Shopping Mall',
      'INDUSTRIAL_PASS': 'Industrial Complex',
      'ACCESS_CARD': 'Aerospace Museum'
    };
    return keyToBiome[keyType] || null;
  }

  /**
   * Helper: Count keys that don't have matching gates available
   */
  function _countUnmatchedKeys(playerKeys) {
    var unmatched = 0;
    for (var i = 0; i < playerKeys.length; i++) {
      var biome = _getBiomeForKey(playerKeys[i]);
      if (biome && _runState.visitedGateBiomes.indexOf(biome) === -1) {
        unmatched++;
      }
    }
    return unmatched;
  }

  /**
   * Helper: Weighted biome roll
   */
  function _weightedBiomeRoll(weights) {
    var totalWeight = 0;
    for (var biome in weights) {
      totalWeight += weights[biome];
    }
    if (totalWeight <= 0) return null;

    var roll = _rng() * totalWeight;
    var cumulative = 0;
    for (var b in weights) {
      cumulative += weights[b];
      if (roll < cumulative) {
        return b;
      }
    }
    return null;
  }

  /**
   * Context-aware key spawn system
   * Implements dynamic drop rates, inventory bonuses, and pity timers
   * Called during floor generation to potentially spawn a key
   */
  function _spawnContextAwareKey(rooms) {
    if (typeof EnvironmentalSynergy === 'undefined' || !rooms || rooms.length === 0) {
      return;
    }

    // Skip tutorial and early floors
    if (_floor <= 1) {
      _runState.floorsSinceKey++;
      return;
    }

    // RULE 3: Calculate key spawn chance based on run depth
    var baseChance = 0;
    if (_floor === 1) baseChance = 0.25;
    else if (_floor === 2) baseChance = 0.35;
    else baseChance = 0.45; // Floor 3+

    // Adjust based on player's key inventory
    var playerKeys = _getPlayerKeys();

    // If player holds no keys: +20% bonus
    if (playerKeys.length === 0) {
      baseChance += 0.20;
    }

    // If player holds unused key: -10% penalty (to avoid key hoarding)
    var hasUnusedKey = _countUnmatchedKeys(playerKeys) > 0;
    if (hasUnusedKey) {
      baseChance -= 0.10;
    }

    // RULE 4: Pity Timer - Force key spawn after 3 floors without
    var forceKey = _runState.floorsSinceKey >= 3;

    if (!forceKey && _rng() > baseChance) {
      _runState.floorsSinceKey++;
      return; // No key this floor
    }

    // Determine which key type to drop (biome-weighted)
    var keyWeights = {
      'KEYCARD': 30,        // Office
      'ACCESS_CARD': 25,    // Aerospace
      'INDUSTRIAL_PASS': 25, // Industrial
      'MALL_KEY': 20        // Mall
    };

    // Boost weight for keys player doesn't have
    for (var keyType in keyWeights) {
      if (playerKeys.indexOf(keyType) === -1) {
        keyWeights[keyType] += 15; // Player doesn't have this key yet
      }
    }

    // Pick key using weighted roll
    var selectedKeyType = _weightedKeyRoll(keyWeights);
    if (!selectedKeyType) {
      _runState.floorsSinceKey++;
      return;
    }

    var keyDef = EnvironmentalSynergy.getKeyDefinitions()[selectedKeyType];
    if (!keyDef) {
      _runState.floorsSinceKey++;
      return;
    }

    // Find a good spawn position (in a random room, away from player)
    var roomIndex = Math.floor(_rng() * rooms.length);
    var room = rooms[roomIndex];
    var keyX = room.x + 2 + Math.floor(_rng() * (room.w - 4));
    var keyY = room.y + 2 + Math.floor(_rng() * (room.h - 4));

    // Ensure valid position
    var attempts = 0;
    while (attempts < 20) {
      if (_grid[keyY] && _grid[keyY][keyX] === TILES.EMPTY) {
        var distToPlayer = Math.abs(keyX - _player.x) + Math.abs(keyY - _player.y);
        if (distToPlayer >= 5) {
          break; // Valid position found
        }
      }
      keyX = room.x + 2 + Math.floor(_rng() * (room.w - 4));
      keyY = room.y + 2 + Math.floor(_rng() * (room.h - 4));
      attempts++;
    }

    // Spawn the key
    _items.push({
      x: keyX,
      y: keyY,
      type: 'key',
      keyType: selectedKeyType,
      emoji: keyDef.emoji,
      name: keyDef.name,
      description: keyDef.description,
      spawnTime: Date.now(),
      decayTime: 180000 // 3 minute decay (longer for context keys)
    });

    // Update run state
    _runState.floorsSinceKey = 0;
    _runState.keysFoundThisRun++;
    _runState.keysOwned.push(selectedKeyType);

    console.log('[GoneRogue] Spawned context-aware key:', keyDef.name, 'at', keyX, keyY, 'on floor', _floor, forceKey ? '(FORCED)' : '');
  }

  /**
   * Helper: Weighted key roll
   */
  function _weightedKeyRoll(weights) {
    var totalWeight = 0;
    for (var keyType in weights) {
      totalWeight += weights[keyType];
    }
    if (totalWeight <= 0) return null;

    var roll = _rng() * totalWeight;
    var cumulative = 0;
    for (var k in weights) {
      cumulative += weights[k];
      if (roll < cumulative) {
        return k;
      }
    }
    return null;
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

  // ── Magnet auto-collect state ──
  var _magnetLastCollectTime = 0;   // Timestamp of last magnet pull
  var _magnetPullingIds = [];        // Indices being pulled this frame (for stagger)

  /**
   * Magnet auto-collect: if the player has a Magnet equipped, periodically
   * pull nearby scattered currency/ammo toward the player and collect them.
   * Uses Chebyshev distance (king-move radius) so diagonal tiles are in range.
   *
   * @param {number} now — Date.now() from the game loop
   */
  function _magnetAutoCollect(now) {
    if (!_player || _strCombatActive) return;

    // Check if player has a magnet
    var magnet = null;
    try {
      if (typeof PassiveItemsSystem !== 'undefined' && PassiveItemsSystem.getEquippedMagnet) {
        magnet = PassiveItemsSystem.getEquippedMagnet();
      }
    } catch (e) { return; }
    if (!magnet) return;

    // Throttle by collection_interval_ms (default 400ms)
    var interval = magnet.collection_interval_ms || 400;
    if (now - _magnetLastCollectTime < interval) return;

    var range = magnet.collection_range || 3;
    var px = _player.x;
    var py = _player.y;

    // Find all currencies within Chebyshev distance
    var inRange = [];
    for (var ci = 0; ci < _currencies.length; ci++) {
      var c = _currencies[ci];
      if (!c || c.collected) continue;
      var dx = Math.abs(c.x - px);
      var dy = Math.abs(c.y - py);
      var dist = Math.max(dx, dy); // Chebyshev
      if (dist > 0 && dist <= range) {
        inRange.push({ idx: ci, dist: dist, currency: c });
      }
    }

    if (inRange.length === 0) return;

    // Sort nearest first so closest get pulled first
    inRange.sort(function(a, b) { return a.dist - b.dist; });

    // Collect the nearest one this tick (staggered pull, one per interval)
    var target = inRange[0];
    var c = target.currency;
    _magnetLastCollectTime = now;

    // Determine if ammo or currency
    if (c._isAmmo) {
      // Ammo collection
      if (typeof GAMESTATE !== 'undefined' && GAMESTATE.addAmmo) {
        GAMESTATE.addAmmo(c.amount);
      }
    } else {
      // Currency collection
      if (typeof GAMESTATE !== 'undefined') {
        GAMESTATE.addCryptos(c.amount);
      }
      _currencyCollected += c.amount;
    }

    // Show overhead pickup animation at the currency's position (flies to player)
    if (typeof OverheadAnimator !== 'undefined') {
      if (c._isAmmo) {
        OverheadAnimator.showGenericExpression(c.x, c.y, '⁍', 600);
      } else {
        OverheadAnimator.showCurrencyPickup(c.x, c.y, c.amount);
      }
    }

    // Collection state for animation
    _player.collectingCurrency = true;
    _player.currencyCollectTime = now;

    // Pancake stacker feedback — currency (¢) no longer uses PancakeStack
    // (ghost glyph fix: OverheadAnimator "+3¢" is sufficient for currency feedback,
    //  PancakeStack reserved for physical inventory items like cards/keys/food)
    // Only ammo still uses PancakeStack (it's a physical resource)
    try {
      if (c._isAmmo) {
        if (typeof PancakeStack !== 'undefined' && PancakeStack.addPancake) {
          PancakeStack.addPancake('⁍');
        } else if (typeof PlayerStackManager !== 'undefined' && PlayerStackManager.addPancake) {
          PlayerStackManager.addPancake('⁍');
        }
      }
    } catch (ePancake) {}

    // Remove from currencies array
    _currencies.splice(target.idx, 1);
  }

  /**
   * Scatter post-combat currency/ammo nodes around the defeated enemy's position.
   * Nodes bounce and spread 1-3 tiles in random directions so the player
   * has to chase them down (unless they have a magnet equipped).
   */
  function _scatterPostCombatNodes(enemy, victoryCtx) {
    if (!enemy) return;
    var cx = enemy.x || 0;
    var cy = enemy.y || 0;

    // Determine how many scatter nodes (1-3)
    var nodeCount = 1;
    var totalValue = (victoryCtx.lootCurrency || 0) + (victoryCtx.lootAmmo || 0) * 2;
    if (totalValue > 30) nodeCount = 2;
    if (totalValue > 80 || victoryCtx.isBoss) nodeCount = 3;

    // Scatter directions (random adjacent tiles)
    var dirs = [
      { dx: -1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
      { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: 1, dy: 1 }
    ];

    // Shuffle directions
    for (var s = dirs.length - 1; s > 0; s--) {
      var j = Math.floor(_rng() * (s + 1));
      var tmp = dirs[s]; dirs[s] = dirs[j]; dirs[j] = tmp;
    }

    for (var n = 0; n < nodeCount; n++) {
      var dir = dirs[n % dirs.length];
      var nx = cx + dir.dx;
      var ny = cy + dir.dy;

      // Bounds check
      if (ny < 0 || ny >= _grid.length || nx < 0 || nx >= _grid[0].length) {
        nx = cx; ny = cy;
      }
      // Don't scatter onto walls
      if (_grid[ny] && _grid[ny][nx] === TILES.WALL) {
        nx = cx; ny = cy;
      }

      // Split loot across nodes
      if (victoryCtx.lootCurrency > 0) {
        var share = Math.ceil(victoryCtx.lootCurrency / nodeCount);
        _currencies.push({
          x: nx, y: ny,
          amount: Math.min(share, victoryCtx.lootCurrency),
          glyph: '¢',
          emoji: '💰',
          spawnTime: Date.now(),
          decayTime: 25000, // 25s to chase
          _scattered: true  // Flag for visual flair in renderer
        });
      }
      if (victoryCtx.lootAmmo > 0 && n === 0) {
        _currencies.push({
          x: nx, y: ny,
          amount: victoryCtx.lootAmmo,
          glyph: '⁍',
          emoji: '⁍',
          spawnTime: Date.now(),
          decayTime: 25000,
          _scattered: true,
          _isAmmo: true
        });
      }
    }
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

    // Place metadata-driven overlays (doors/chests/NPCs)
    for (var mk in _tileMetadata) {
      if (_tileMetadata.hasOwnProperty(mk)) {
        var md = _tileMetadata[mk];
        if (!md) continue;

        if (md.type === 'locked_gate' || md.type === 'locked_chest' || md.type === 'npc') {
          var parts = mk.split(',');
          var mx = parseInt(parts[0]);
          var my = parseInt(parts[1]);
          if (display[my] && typeof display[my][mx] !== 'undefined') {
            if (md.type === 'locked_gate') {
              display[my][mx] = md.emoji || '🚪';
            } else if (md.type === 'locked_chest') {
              display[my][mx] = md.emoji || '🧰';
            } else if (md.type === 'npc') {
              display[my][mx] = md.emoji || '🧑';
            }
          }
        }
      }
    }

    // Place enemies
    _enemies.forEach(function(enemy) {
      if (enemy.hp > 0) {
        display[enemy.y][enemy.x] = TILES.ENEMY;
      }
    });

    // Place pets
    if (typeof PetFollower !== 'undefined') {
      var activePets = PetFollower.getActivePets();
      activePets.forEach(function(pet) {
        if (pet.alive) {
          var petX = Math.round(pet.x);
          var petY = Math.round(pet.y);
          if (petY >= 0 && petY < GRID_HEIGHT && petX >= 0 && petX < GRID_WIDTH) {
            display[petY][petX] = pet.emoji || '🐾';
          }
        }
      });
    }

    // Place items — use item-specific emoji if available, fallback to TILES.ITEM
    _items.forEach(function(item) {
      display[item.y][item.x] = item.emoji || TILES.ITEM;
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
      GoneRogueMobile.renderGrid(displayGrid, _player, _enemies, _items, _enemyColorCycleTime, _breakables, _projectiles, _alertLevel, _strCombatActive, _muzzleFlash, _impactEffects, _currencies, _npcs, _tileMetadata);
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

  /**
   * Update seed display in AWOL button tooltip
   */
  function _updateSeedDisplay() {
    var awolButton = document.getElementById('awol-button');
    if (!awolButton) return;

    if (_currentSeedPhrase) {
      var difficulty = ['STANDARD', 'ADVANCED', 'EXTREME'][_difficultyTier - 1];
      awolButton.setAttribute('title', 'AWOL status — Click to configure difficulty\nSeed: ' + _currentSeedPhrase);
    }
  }

  function _getNpcById(npcId) {
    for (var i = 0; i < _npcs.length; i++) {
      if (_npcs[i].id === npcId) return _npcs[i];
    }
    return null;
  }

  function _npcShowEmoji(npc, emoji, ms) {
    if (!npc) return;
    if (typeof OverheadAnimator !== 'undefined') {
      OverheadAnimator.showGenericExpression(npc.x, npc.y, emoji, ms || 800);
    }
  }

  function _npcSay(npc, text) {
    if (!npc || !text) return;
    if (typeof TooltipSystem !== 'undefined') {
      // Use persistent tooltip so the player can glance back
      TooltipSystem.showPersistent(text, 2400);
    }
  }

  function _combatPhaseTooltip(phase, details, ms) {
    if (typeof TooltipSystem === 'undefined') return;

    var label = ('' + phase).toUpperCase();
    var msg = '';

    if (label === 'INITIATIVE') {
      msg = '⚡ INITIATIVE — ' + (details || 'engaging');
    } else if (label === 'CARDPLAY') {
      msg = '🃏 CARD PLAY — ' + (details || 'choose your action');
    } else if (label === 'RESOLUTION') {
      msg = '💥 RESOLUTION — ' + (details || 'calculating damage');
    } else if (label === 'VICTORY') {
      msg = '🏁 VICTORY — ' + (details || 'encounter cleared');
    } else if (label === 'DEFEAT') {
      msg = '☠️ DEFEAT — ' + (details || 'recovering');
    } else {
      msg = label + (details ? (': ' + details) : '');
    }

    TooltipSystem.showPersistent(msg, ms || 1600);
  }

  function _clearNpcGateZones(npcId) {
    for (var k in _tileMetadata) {
      if (!_tileMetadata.hasOwnProperty(k)) continue;
      var md = _tileMetadata[k];
      if (md && (md.type === 'npc_gate_warning' || md.type === 'npc_gate_trigger') && md.npcId === npcId) {
        delete _tileMetadata[k];
      }
    }
  }

  function _startNpcGateCombat(npc) {
    if (!npc) return;

    // Combat initialize
    _npcShowEmoji(npc, '🥊', 900);

    // Print a short line (avoid spam)
    if (_turn - npc.state.lastTalkTurn > 6) {
      npc.state.lastTalkTurn = _turn;
      if (npc.dialogues && npc.dialogues.length) {
        _npcSay(npc, npc.dialogues[0]);
      } else {
        _npcSay(npc, npc.emoji + ' ' + npc.name + ': Spar?');
      }
    }

    // Create a combat proxy using enemy-shaped stats
    var enemy = {
      x: npc.x,
      y: npc.y,
      emoji: npc.emoji,
      name: npc.name,
      hp: 18,
      maxHp: 18,
      str: 4,
      dex: 2,
      initiative: 0,
      awareness: 0,
      orientation: npc.direction || 'south',
      sightRange: 0,
      dead: false,
      isTreasureGoblin: false,
      _npcGateId: npc.id,
      _npcGateType: (npc.gate && npc.gate.type) ? npc.gate.type : 'friendly'
    };

    _enterStrCombat(enemy, 'collision');
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

  function _checkPlayerInteractions() {
    // Interactions after arriving on a tile via smooth movement (GoneRogueMovement).
    var x = _player.x;
    var y = _player.y;

    // Update turn + pet following history
    _turn++;
    _updatePositionHistory();

    // Bounds safety
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return;

    var tile = _grid[y] ? _grid[y][x] : null;

    // Door/Exit tile (🚪): behavior determined by tile metadata (back/forward/unknown)
    if (tile === TILES.EXIT || tile === TILES.DOOR) {
      // Spawn protection: if we spawned onto this door tile, require the player to step off and return.
      try {
        if (_doorSpawnProtect && _doorSpawnProtect.x === x && _doorSpawnProtect.y === y) {
          return;
        }
      } catch (e0) {}

      var md = _tileMetadata[x + ',' + y];
      if (md && md.type === 'door') {
        if (md.doorKind === 'back') {
          _retreatFloor();
          return;
        }
        if (md.doorKind === 'forward') {
          _attemptExtract();
          return;
        }
        if (md.doorKind === 'interior_exit') {
          _exitInteriorFloor();
          return;
        }
        // Unknown/joker door: fall through for now
      }

      // Building door → enter interior floor (tavern, church, etc.)
      if (md && md.type === 'building_door' && md.targetFloorId) {
        _enterInteriorFloor(md.targetFloorId);
        return;
      }

      // Default: treat as forward exit
      if (tile === TILES.EXIT) {
        _attemptExtract();
        return;
      }
    } else {
      // Clear spawn protection once the player steps off the door.
      _doorSpawnProtect = null;
    }

    // Shop tile
    if (tile === TILES.SHOP || tile === TILES.BLACK_MARKET) {
      var shopObj = _shops.find(function(s) { return s.x === x && s.y === y; });
      if (shopObj && typeof ShopSystem !== 'undefined' && !shopObj.opened) {
        var shopType = tile === TILES.BLACK_MARKET ? ShopSystem.SHOP_TYPES.BLACK_MARKET : ShopSystem.SHOP_TYPES.STANDARD;
        ShopSystem.openShop(shopType, _floor);
        shopObj.opened = true;
      }
    }

    // Door hint popups when approaching
    _maybeHintNearbyDoors();

    // NOTE: Collectible pickups must be handled in BOTH _checkPlayerInteractions() (for smooth
    // movement) AND _movePlayer() (for command-based movement). The previous fix removed pickups
    // from _checkPlayerInteractions() which broke pickups during smooth movement (tap-to-move).
    // To prevent duplicate animations, we need both code paths to handle pickups.

    // Check for currency pickup
    var cryptoPickup = _currencies.find(function(c) { return c.x === x && c.y === y; });
    if (cryptoPickup) {
      if (typeof GAMESTATE !== 'undefined') {
        var result = GAMESTATE.addCryptos(cryptoPickup.amount);
      }
      // Track for highscore
      _currencyCollected += cryptoPickup.amount;
      // Remove currency from floor
      _currencies = WorldItems.filterCurrencies(function(c) { return c.x !== x || c.y !== y; });

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

      // PancakeStack removed for currency — OverheadAnimator "+N¢" is sufficient
      // (ghost glyph fix: persistent ¢ glyph was hovering disembodied above player)
    }

    // Auto-pickup any floor item at player position (ammo, gem/battery, cards, keys)
    if (_items.find(function(i) { return i.x === x && i.y === y; })) {
      _pickupItem();
    }

    // Check for food item pickup (auto-pickup from interactive items)
    if (typeof InteractiveItems !== 'undefined') {
      var foodItem = InteractiveItems.getItemAt(x, y);
      if (foodItem && foodItem.autoPickup && foodItem.type === 'FOOD') {
        // Apply food effects
        if (typeof FoodDatabase !== 'undefined' && foodItem.customData && foodItem.customData.foodId) {
          // Capture before-values for ALL resources food can modify
          var hpBefore = _player.hp || 0;
          var fatigueBefore = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getFatigue) ? GAMESTATE.getFatigue() : 0;
          var ammoBefore = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getAmmo) ? GAMESTATE.getAmmo() : 0;
          var cryptosBefore = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getCryptos) ? GAMESTATE.getCryptos() : 0;

          var result = FoodDatabase.applyFoodEffects(foodItem.customData.foodId, _player);
          if (result.success) {
            // Determine primary effect for overhead animation RESOURCE_COLOR
            // energy category → Fatigue brown; health/status → HP pink; special → HP pink
            var foodDef = FoodDatabase.getFoodItem(foodItem.customData.foodId);
            var primaryColor = '#FF6B9D'; // HP pink default
            if (foodDef && foodDef.category === 'energy') {
              primaryColor = '#A0522D'; // Fatigue brown
            }

            // Show overhead animation with category-appropriate RESOURCE_COLOR
            if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
              OverheadAnimator.showGenericExpression(x, y, result.emoji, 1000, primaryColor);
            }

            // Report EACH changed resource to debrief feed with its own RESOURCE_COLOR
            try {
              if (typeof DebriefFeedController !== 'undefined' && DebriefFeedController.reportResourceChange) {
                var hpAfter = _player.hp || 0;
                if (hpAfter !== hpBefore) {
                  DebriefFeedController.reportResourceChange('HP', hpBefore, hpAfter, result.foodName || 'Food');
                }
                var fatigueAfter = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getFatigue) ? GAMESTATE.getFatigue() : 0;
                if (fatigueAfter !== fatigueBefore) {
                  DebriefFeedController.reportResourceChange('Fatigue', fatigueBefore, fatigueAfter, result.foodName || 'Food');
                }
                var ammoAfter = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getAmmo) ? GAMESTATE.getAmmo() : 0;
                if (ammoAfter !== ammoBefore) {
                  DebriefFeedController.reportResourceChange('Ammo', ammoBefore, ammoAfter, result.foodName || 'Food');
                }
                var cryptosAfter = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getCryptos) ? GAMESTATE.getCryptos() : 0;
                if (cryptosAfter !== cryptosBefore) {
                  DebriefFeedController.reportResourceChange('Currency', cryptosBefore, cryptosAfter, result.foodName || 'Food');
                }
              }
            } catch (eDebrief) {}

            // Block sprint temporarily after food pickup (0.9 second delay)
            // This prevents immediate fatigue refill during sprint, causing delayed food buff effect
            if (typeof GAMESTATE !== 'undefined' && GAMESTATE.blockSprintTemporarily) {
              GAMESTATE.blockSprintTemporarily(900);
            }

            // MOK interjection for food pickup
            if (typeof UIControls !== 'undefined' && UIControls.updateMokInterjection) {
              UIControls.updateMokInterjection(result.emoji + ' ' + result.foodName + ' consumed');
            }

            // Tooltip: Food effects (always show — contains all effect details)
            if (typeof TooltipSystem !== 'undefined' && result.tooltipText) {
              TooltipSystem.showGeneric(result.tooltipText, 2000);
            }

            // Pancake stacker animation for food
            try {
              if (typeof PancakeStack !== 'undefined' && PancakeStack.addPancake) {
                PancakeStack.addPancake(result.emoji || '🍎');
              } else if (typeof PlayerStackManager !== 'undefined' && PlayerStackManager.addPancake) {
                PlayerStackManager.addPancake(result.emoji || '🍎');
              }
            } catch (ePancake) {}

            // Remove food item from world (clean disappearance)
            InteractiveItems.removeItem(foodItem.id);
            console.log('[GoneRogue] Food consumed:', result.foodName);
          }
        }
      }
    }

    // Discovery reveal
    _revealDiscovery(x, y);

    // Box auto-exit: player has moved off the box tile they were hiding in
    if (_playerInBox && (_player.x !== _playerInBox.x || _player.y !== _playerInBox.y)) {
      _playerExitBox('voluntary');
    }

    // Box auto-enter: player steps onto a placed empty box
    var _boxUnderPlayer = _getBoxAt(x, y);
    if (_boxUnderPlayer && _boxUnderPlayer.state === 'empty' && !_playerInBox) {
      _playerEnterBox(_boxUnderPlayer);
    }

    // Enemy collision -> enter STR combat
    var hitEnemy = _enemies.find(function(e) { return e.x === x && e.y === y && e.hp > 0; });
    if (hitEnemy) {
      _enterStrCombat(hitEnemy, 'collision');
      return;
    }
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

    // Door hints should fire on approach (so you can find doors without relying on pickups)
    _maybeHintNearbyDoors();

    // Check bounds
    if (newX < 0 || newX >= GRID_WIDTH || newY < 0 || newY >= GRID_HEIGHT) {
      return {
        lines: ['CANNOT MOVE THERE', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // NPC gate zones (warning + trigger)
    var metaKey = newX + ',' + newY;
    var meta = _tileMetadata[metaKey];
    if (meta && meta.type === 'npc_gate_warning') {
      var warnNpc = _getNpcById(meta.npcId);
      if (warnNpc && (!warnNpc.state.released) && (_turn - warnNpc.state.lastWarnTurn > 10)) {
        warnNpc.state.lastWarnTurn = _turn;
        // Match existing enemy alert convention: "!" means confirmed alert
        _npcShowEmoji(warnNpc, '!', 700);
      }
      // Warning zone is walkable
    } else if (meta && meta.type === 'npc_gate_trigger') {
      var trigNpc = _getNpcById(meta.npcId);
      if (trigNpc && !trigNpc.state.released) {
        // Block movement and trigger encounter.
        // "?" means you are pushing the wall / being challenged.
        _npcShowEmoji(trigNpc, '?', 650);
        _startNpcGateCombat(trigNpc);
        return {
          lines: ['GATE ENGAGED', ''].concat(_renderGrid()),
          prompt: getPrompt(),
          stayActive: true
        };
      }
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

    // Update position history for pet following
    _updatePositionHistory();

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

    // Check if player is adjacent to a shopkeeper NPC - open shop interface
    if (_npcs && _npcs.length > 0) {
      for (var i = 0; i < _npcs.length; i++) {
        var npc = _npcs[i];
        if (npc.shopkeeper) {
          var distX = Math.abs(npc.x - newX);
          var distY = Math.abs(npc.y - newY);
          // Check if player is adjacent (including diagonals)
          if (distX <= 1 && distY <= 1 && !(distX === 0 && distY === 0)) {
            // Player is adjacent to shopkeeper - open shop
            if (typeof ShopSystem !== 'undefined') {
              ShopSystem.openShop(ShopSystem.SHOP_TYPES.STANDARD, _floor);

              // Show tooltip hint
              if (typeof TooltipSystem !== 'undefined') {
                TooltipSystem.showGeneric('🧙 ' + npc.name + ': Welcome to my shop!', 2000);
              }
            }
            break; // Only trigger one shop at a time
          }
        }
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
      _currencies = WorldItems.filterCurrencies(function(c) { return c.x !== newX || c.y !== newY; });

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

      // PancakeStack removed for currency — OverheadAnimator "+N¢" is sufficient
      // (ghost glyph fix: persistent ¢ glyph was hovering disembodied above player)
    }

    // Auto-pickup any floor item at new position (ammo, gem/battery, cards, keys)
    // _player.x/y is already updated to newX/newY at this point
    if (_items.find(function(i) { return i.x === newX && i.y === newY; })) {
      _pickupItem();
    }

    // Check for food item pickup (auto-pickup from interactive items)
    if (typeof InteractiveItems !== 'undefined') {
      var foodItem = InteractiveItems.getItemAt(newX, newY);
      if (foodItem && foodItem.autoPickup && foodItem.type === 'FOOD') {
        // Apply food effects
        if (typeof FoodDatabase !== 'undefined' && foodItem.customData && foodItem.customData.foodId) {
          // Capture before-values for ALL resources food can modify
          var hpBeforeFood = _player.hp || 0;
          var fatigueBeforeFood = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getFatigue) ? GAMESTATE.getFatigue() : 0;
          var ammoBeforeFood = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getAmmo) ? GAMESTATE.getAmmo() : 0;
          var cryptosBeforeFood = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getCryptos) ? GAMESTATE.getCryptos() : 0;

          var result = FoodDatabase.applyFoodEffects(foodItem.customData.foodId, _player);
          if (result.success) {
            // Determine primary effect for overhead animation RESOURCE_COLOR
            var foodDefMv = FoodDatabase.getFoodItem(foodItem.customData.foodId);
            var primaryColorMv = '#FF6B9D'; // HP pink default
            if (foodDefMv && foodDefMv.category === 'energy') {
              primaryColorMv = '#A0522D'; // Fatigue brown
            }

            // Show overhead animation with category-appropriate RESOURCE_COLOR
            if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
              OverheadAnimator.showGenericExpression(newX, newY, result.emoji, 1000, primaryColorMv);
            }

            // Report EACH changed resource to debrief feed with its own RESOURCE_COLOR
            try {
              if (typeof DebriefFeedController !== 'undefined' && DebriefFeedController.reportResourceChange) {
                var hpAfterFood = _player.hp || 0;
                if (hpAfterFood !== hpBeforeFood) {
                  DebriefFeedController.reportResourceChange('HP', hpBeforeFood, hpAfterFood, result.foodName || 'Food');
                }
                var fatigueAfterFood = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getFatigue) ? GAMESTATE.getFatigue() : 0;
                if (fatigueAfterFood !== fatigueBeforeFood) {
                  DebriefFeedController.reportResourceChange('Fatigue', fatigueBeforeFood, fatigueAfterFood, result.foodName || 'Food');
                }
                var ammoAfterFood = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getAmmo) ? GAMESTATE.getAmmo() : 0;
                if (ammoAfterFood !== ammoBeforeFood) {
                  DebriefFeedController.reportResourceChange('Ammo', ammoBeforeFood, ammoAfterFood, result.foodName || 'Food');
                }
                var cryptosAfterFood = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getCryptos) ? GAMESTATE.getCryptos() : 0;
                if (cryptosAfterFood !== cryptosBeforeFood) {
                  DebriefFeedController.reportResourceChange('Currency', cryptosBeforeFood, cryptosAfterFood, result.foodName || 'Food');
                }
              }
            } catch (eDebrief) {}

            // Block sprint temporarily after food pickup (0.9 second delay)
            // This prevents immediate fatigue refill during sprint, causing delayed food buff effect
            if (typeof GAMESTATE !== 'undefined' && GAMESTATE.blockSprintTemporarily) {
              GAMESTATE.blockSprintTemporarily(900);
            }

            // MOK interjection for food pickup
            if (typeof UIControls !== 'undefined' && UIControls.updateMokInterjection) {
              UIControls.updateMokInterjection(result.emoji + ' ' + result.foodName + ' consumed');
            }

            // Tooltip: Food effects (always show — contains all effect details)
            if (typeof TooltipSystem !== 'undefined' && result.tooltipText) {
              TooltipSystem.showGeneric(result.tooltipText, 2000);
            }

            // Pancake stacker animation for food
            try {
              if (typeof PancakeStack !== 'undefined' && PancakeStack.addPancake) {
                PancakeStack.addPancake(result.emoji || '🍎');
              } else if (typeof PlayerStackManager !== 'undefined' && PlayerStackManager.addPancake) {
                PlayerStackManager.addPancake(result.emoji || '🍎');
              }
            } catch (ePancake) {}

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
      _items = WorldItems.filterFloorItems(function(i) { return i !== item; });

      // Tooltip and MOK interjection
      if (typeof TooltipSystem !== 'undefined') {
        TooltipSystem.showAction('item-pickup', { name: 'Ammo +' + item.amount });
      }

      if (typeof UIControls !== 'undefined' && UIControls.updateMokInterjection) {
        UIControls.updateMokInterjection('⁍ Ammo +' + item.amount);
      }

      // Overhead animation with RESOURCE_COLOR magenta
      if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
        OverheadAnimator.showGenericExpression(_player.x, _player.y, '⁍', 800, '#DA70D6');
      }

      // Report to debrief feed with resource-colored frame flash
      try {
        if (typeof DebriefFeedController !== 'undefined' && DebriefFeedController.reportResourceChange) {
          var newAmmo = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getAmmo) ? GAMESTATE.getAmmo() : 0;
          DebriefFeedController.reportResourceChange('Ammo', newAmmo - item.amount, newAmmo, 'Ammo +' + item.amount);
        }
      } catch (eDebrief) {}

      // Pancake stacker for ammo
      try {
        if (typeof PancakeStack !== 'undefined' && PancakeStack.addPancake) {
          PancakeStack.addPancake('⁍');
        } else if (typeof PlayerStackManager !== 'undefined' && PlayerStackManager.addPancake) {
          PlayerStackManager.addPancake('⁍');
        }
      } catch (ePancake) {}

      return {
        lines: ['PICKED UP: ⁍ Ammo +' + item.amount, ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Handle gem pickup — restores battery resource
    if (item.type === 'gem') {
      var gemAmount = item.amount || 1;

      if (typeof GAMESTATE !== 'undefined' && GAMESTATE.rechargeBattery) {
        GAMESTATE.rechargeBattery(gemAmount);
      }

      // Remove gem from floor
      _items = WorldItems.filterFloorItems(function(i) { return i !== item; });

      // Overhead animation with RESOURCE_COLOR cyan-green (NOT cyan LOOT)
      if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
        OverheadAnimator.showGenericExpression(_player.x, _player.y, '◈', 800, '#00FFA6');
      }

      // Report to debrief feed with resource-colored frame flash
      try {
        if (typeof DebriefFeedController !== 'undefined' && DebriefFeedController.reportResourceChange) {
          var newBattery = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getBattery) ? GAMESTATE.getBattery() : 0;
          DebriefFeedController.reportResourceChange('Battery', newBattery - gemAmount, newBattery, '◈ Battery +' + gemAmount);
        }
      } catch (eDebrief) {}

      if (typeof TooltipSystem !== 'undefined') {
        TooltipSystem.showAction('item-pickup', { name: '◈ Battery +' + gemAmount });
      }

      if (typeof UIControls !== 'undefined' && UIControls.updateMokInterjection) {
        UIControls.updateMokInterjection('◈ Battery +' + gemAmount);
      }

      // Pancake stacker for battery gems (cyan glyph)
      try {
        if (typeof PancakeStack !== 'undefined' && PancakeStack.addPancake) {
          PancakeStack.addPancake('◈');
        } else if (typeof PlayerStackManager !== 'undefined' && PlayerStackManager.addPancake) {
          PlayerStackManager.addPancake('◈');
        }
      } catch (ePancake) {}

      // Trigger debrief feed battery recharge pulse
      try {
        if (typeof DebriefFeedController !== 'undefined' && DebriefFeedController.triggerBatteryRecharge) {
          DebriefFeedController.triggerBatteryRecharge();
        }
      } catch (eDebrief) {}

      return {
        lines: ['PICKED UP: ◈ Battery +' + gemAmount, ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Check if item is a card (attack/support) or regular item
    var isCard = item.card && (item.card.type === 'attack' || item.card.type === 'support');

    // Normalize non-card pickups: some world drops (keys, etc.) are not wrapped in item.card
    var nonCardPayload = item.card;
    if (!isCard) {
      if (item.type === 'key') {
        nonCardPayload = {
          type: 'key',
          keyType: item.keyType || item.itemId || 'UNKNOWN_KEY',
          emoji: item.emoji || '🗝',
          name: item.name || 'Key',
          description: item.description || '',
          tier: item.tier || 1,
          subtype: item.subtype || null,
          npcTarget: item.npcTarget || null
        };

        // ── Resolve full definition from items.json registry ──
        // Spawned items (from tutorial-floors, loot tables, etc.) are lightweight.
        // Merge the master definition from GoneRogueDataRegistry to fill in
        // effects, description, rarity, and other metadata.
        try {
          if (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.listItems) {
            var allItems = GoneRogueDataRegistry.listItems();
            var registryDef = null;

            // Match by registryId if the spawn provides one
            if (item.registryId) {
              registryDef = GoneRogueDataRegistry.getItem(item.registryId);
              if (registryDef && registryDef._missing) registryDef = null;
            }

            // Fallback: match by name (case-insensitive)
            if (!registryDef) {
              var targetName = (item.name || '').toLowerCase();
              for (var ri = 0; ri < allItems.length; ri++) {
                if (allItems[ri] && (allItems[ri].name || '').toLowerCase() === targetName && allItems[ri].type === 'key') {
                  registryDef = allItems[ri];
                  break;
                }
              }
            }

            // Fallback: match by keyType → name heuristic (BLACKSMITH_HAMMER → "blacksmith's hammer")
            if (!registryDef && nonCardPayload.keyType) {
              var heuristicName = nonCardPayload.keyType.toLowerCase().replace(/_/g, ' ');
              for (var ri2 = 0; ri2 < allItems.length; ri2++) {
                var candidateName = (allItems[ri2].name || '').toLowerCase().replace(/[^a-z0-9 ]/g, '');
                if (candidateName.indexOf(heuristicName) >= 0 && allItems[ri2].type === 'key') {
                  registryDef = allItems[ri2];
                  break;
                }
              }
            }

            // Merge registry definition into payload (registry wins for missing fields)
            if (registryDef && !registryDef._missing) {
              nonCardPayload.registryId = registryDef.id || null;
              if (!nonCardPayload.description && registryDef.description) nonCardPayload.description = registryDef.description;
              if (!nonCardPayload.effects && registryDef.effects) nonCardPayload.effects = registryDef.effects;
              if (!nonCardPayload.rarity) nonCardPayload.rarity = registryDef.rarity || null;
              if (!nonCardPayload.synergyTags && registryDef.synergyTags) nonCardPayload.synergyTags = registryDef.synergyTags;
              if (!nonCardPayload.npcTarget && registryDef.effects) {
                for (var ei2 = 0; ei2 < registryDef.effects.length; ei2++) {
                  if (registryDef.effects[ei2] && registryDef.effects[ei2].npcTarget) {
                    nonCardPayload.npcTarget = registryDef.effects[ei2].npcTarget;
                    break;
                  }
                }
              }
              if (registryDef.tier) nonCardPayload.tier = registryDef.tier;
              if (registryDef.equipSlot) nonCardPayload.equipSlot = registryDef.equipSlot;
              if (registryDef.consumeOnUse !== undefined) nonCardPayload.consumeOnUse = registryDef.consumeOnUse;
              console.log('[GoneRogue] Key item resolved from registry:', registryDef.id, registryDef.name);
            }
          }
        } catch (eResolve) {
          console.warn('[GoneRogue] Key item registry resolve error:', eResolve);
        }

        // Resolve tier from EnvironmentalSynergy if still not set
        if (!item.tier && !nonCardPayload.tier && typeof EnvironmentalSynergy !== 'undefined' && EnvironmentalSynergy.getKeyDefinitions) {
          try {
            var keyDefs = EnvironmentalSynergy.getKeyDefinitions();
            var kt = (nonCardPayload.keyType || '').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
            if (keyDefs[kt] && keyDefs[kt].tier) {
              nonCardPayload.tier = keyDefs[kt].tier;
            }
          } catch (eTier) {}
        }

        // Set qualityName for display (keys use tier label, not card quality)
        var tierNames = { 1: 'Ammo Key', 2: 'Gate Key', 3: 'Quest Item' };
        nonCardPayload.qualityName = tierNames[nonCardPayload.tier] || 'Key';
      } else if (!nonCardPayload) {
        nonCardPayload = {
          type: item.type || 'item',
          emoji: item.emoji || '📦',
          name: item.name || 'Item',
          description: item.description || ''
        };
      }
    }

    // Add to appropriate inventory
    if (typeof GAMESTATE !== 'undefined') {
      var result;
      var keyTier = (nonCardPayload && nonCardPayload.tier) ? nonCardPayload.tier : 0;

      if (isCard) {
        // NEW LOOT FLOW: Cards go to hand first, then action buttons
        result = GAMESTATE.addCard(item.card);
        // Pancake stacker for card pickup
        try {
          var cardEmoji = (item.card && item.card.emoji) ? item.card.emoji : '🃏';
          if (typeof PancakeStack !== 'undefined' && PancakeStack.addPancake) {
            PancakeStack.addPancake(cardEmoji);
          } else if (typeof PlayerStackManager !== 'undefined' && PlayerStackManager.addPancake) {
            PlayerStackManager.addPancake(cardEmoji);
          }
        } catch (ePancake) {}
        // Overhead animation: monochrome card symbol in Cards purple
        try {
          if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
            OverheadAnimator.showGenericExpression(_player.x, _player.y, '🂠', 800, '#800080');
          }
        } catch (eCardOH) {}
        // Report card pickup to debrief feed
        try {
          if (typeof DebriefFeedController !== 'undefined' && DebriefFeedController.reportResourceChange) {
            var cardName = (item.card && item.card.name) ? item.card.name : 'Card';
            DebriefFeedController.reportResourceChange('Cards', 0, 1, '🂠 ' + cardName);
          }
        } catch (eCardDebrief) {}
      } else if (item.type === 'key' && keyTier >= 2) {
        // TIER 2+ (key_items): Door/gate keys and quest items go to persistent inventory
        if (GAMESTATE.addToPersistent) {
          result = GAMESTATE.addToPersistent(nonCardPayload);
        } else {
          result = GAMESTATE.addToLoose(nonCardPayload);
        }
      } else if (item.type === 'key') {
        // TIER 1 (key_ammo): Tracked as a resource counter visible in debrief feed.
        // These consumable chest/lock keys do NOT go to inventory — they are counted
        // like ammo and reported via DebriefFeedController.reportResourceChange.
        result = { success: true, message: 'Key ammo counted' };
      } else {
        result = { success: true, message: 'Item picked up' };
      }

      // KEY COUNTER: Increment structured key counter on successful pickup
      if (item.type === 'key' && result && result.success) {
        try {
          if (GAMESTATE.addKeyCount) {
            var countKeyType = nonCardPayload.keyType || item.keyType || item.itemId || 'UNKNOWN';
            var oldKeyAmmoTotal = (keyTier <= 1 && GAMESTATE.getTotalKeyAmmo) ? GAMESTATE.getTotalKeyAmmo() : 0;
            GAMESTATE.addKeyCount(countKeyType, keyTier || 1);
            // TIER 1 (key_ammo): report resource change to debrief feed
            if (keyTier <= 1) {
              try {
                var newKeyAmmoTotal = GAMESTATE.getTotalKeyAmmo ? GAMESTATE.getTotalKeyAmmo() : oldKeyAmmoTotal + 1;
                if (typeof DebriefFeedController !== 'undefined' && DebriefFeedController.reportResourceChange) {
                  DebriefFeedController.reportResourceChange('key_ammo', oldKeyAmmoTotal, newKeyAmmoTotal, nonCardPayload.name || item.name || 'Key');
                }
              } catch (eKAReport) {}
            }
          }
        } catch (eKeyCount) {}
      }

      // KEY PICKUP ENHANCEMENTS — behavior varies by tier
      if (item.type === 'key' && result && result.success) {
        if (keyTier >= 2 && keyTier < 3) {
          // TIER 2 (gate key): overhead stacker animation + auto-equip to active slot
          try {
            if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
              OverheadAnimator.showGenericExpression(_player.x, _player.y, item.emoji || '🔑', 1200, '#FFD700');
            }
            if (typeof PlayerStackManager !== 'undefined' && PlayerStackManager.addPancake) {
              PlayerStackManager.addPancake(item.emoji || '🔑');
            } else if (typeof PancakeStack !== 'undefined' && PancakeStack.addPancake) {
              PancakeStack.addPancake(item.emoji || '🔑');
            }
          } catch (eAnim) {}

          try {
            if (GAMESTATE.setActiveItem) {
              GAMESTATE.setActiveItem(nonCardPayload);
              if (typeof UIControls !== 'undefined' && UIControls.setActiveItem) {
                UIControls.setActiveItem(nonCardPayload);
              }
              if (typeof TooltipSystem !== 'undefined') {
                TooltipSystem.show('🔑 KEY EQUIPPED — Tap header icon near the gate!', 2500);
              }
            }
          } catch (eEquip) {}

        } else if (keyTier >= 3) {
          // TIER 3 (quest key): special overhead animation, NO auto-equip, quest tooltip
          try {
            if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
              OverheadAnimator.showGenericExpression(_player.x, _player.y, '❗', 1500, '#FF4444');
            }
          } catch (eAnim) {}

          try {
            // Resolve npcTarget from payload (already merged from registry) or spawn effects
            var npcTarget = nonCardPayload.npcTarget || item.npcTarget || '';
            if (!npcTarget && nonCardPayload.effects && nonCardPayload.effects.length) {
              for (var ei = 0; ei < nonCardPayload.effects.length; ei++) {
                if (nonCardPayload.effects[ei] && nonCardPayload.effects[ei].npcTarget) {
                  npcTarget = nonCardPayload.effects[ei].npcTarget;
                  break;
                }
              }
            }
            if (typeof TooltipSystem !== 'undefined') {
              var questMsg = '❗ QUEST ITEM — ' + (nonCardPayload.name || item.name || 'Item');
              if (npcTarget) questMsg += ' — Return to ' + npcTarget;
              TooltipSystem.show(questMsg, 3500);
            }
          } catch (eQuest) {}
        }
        // TIER 1 (ammo key / low-tier key): show overhead key emoji so player sees auto-pickup
        else {
          try {
            if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
              OverheadAnimator.showGenericExpression(_player.x, _player.y, item.emoji || '🗝', 800, '#FF8A3D');
            }
            if (typeof PancakeStack !== 'undefined' && PancakeStack.addPancake) {
              PancakeStack.addPancake(item.emoji || '🗝');
            } else if (typeof PlayerStackManager !== 'undefined' && PlayerStackManager.addPancake) {
              PlayerStackManager.addPancake(item.emoji || '🔑');
            }
          } catch (eAnim) {}
        }
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
    _items = WorldItems.filterFloorItems(function(i) { return i !== item; });

    // Tooltip: Item/card pickup
    if (typeof TooltipSystem !== 'undefined') {
      if (item.card && (item.card.type === 'attack' || item.card.type === 'support')) {
        TooltipSystem.showAction('card-pickup', { name: item.card.name });
      } else if (item.type === 'key' && keyTier <= 1) {
        var nm = (nonCardPayload && nonCardPayload.name) ? nonCardPayload.name : (item.name || 'Key');
        TooltipSystem.showAction('key-ammo-pickup', { name: nm });
      } else if (item.type === 'key' && keyTier >= 2) {
        var nm = (nonCardPayload && nonCardPayload.name) ? nonCardPayload.name : (item.name || 'Key');
        TooltipSystem.showAction('key-item-pickup', { name: nm });
      } else {
        var nm = (item.card && item.card.name) ? item.card.name : (item.name || 'Item');
        TooltipSystem.showAction('item-pickup', { name: nm });
      }
    }

    var pickupEmoji = (item.card && item.card.emoji) ? item.card.emoji : (item.emoji || (item.type === 'key' ? '🔑' : '📦'));
    var pickupDisplayName = (item.card && item.card.name) ? item.card.name : (item.name || 'Item');
    var pickupQuality = (item.card && item.card.qualityName) ? ' [' + item.card.qualityName + ']'
      : (item.type === 'key' && keyTier <= 1 ? ' [KEY AMMO]' : (item.type === 'key' ? ' [KEY ITEM]' : ''));

    // MOK interjection for card/item pickup
    if (typeof UIControls !== 'undefined' && UIControls.updateMokInterjection) {
      var pickupType = isCard ? 'Card' : (item.type === 'key' && keyTier <= 1 ? 'Key Ammo' : (item.type === 'key' ? 'Key Item' : 'Item'));
      var locationInfo = (isCard && result && result.location) ? ' → ' + result.location.toUpperCase() : '';
      UIControls.updateMokInterjection(pickupType + ': ' + pickupDisplayName + locationInfo);
    }

    return {
      lines: ['PICKED UP: ' + pickupEmoji + ' ' + pickupDisplayName + pickupQuality, ''].concat(_renderGrid()),
      prompt: getPrompt(),
      stayActive: true
    };
  }

  function _attemptPickpocket() {
    if (typeof EnemyStealSystem === 'undefined') {
      return { lines: ['STEAL SYSTEM UNAVAILABLE', ''], prompt: getPrompt(), stayActive: true };
    }

    if (_strCombatActive) {
      return { lines: ['CAN\'T STEAL IN STR COMBAT', ''], prompt: getPrompt(), stayActive: true };
    }

    var activeItem = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getActiveItem) ? GAMESTATE.getActiveItem() : null;
    var res = EnemyStealSystem.attempt({
      player: _player,
      enemies: _enemies,
      activeItem: activeItem,
      getEnemyDeck: (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getEnemyDeck) ? GoneRogueDataRegistry.getEnemyDeck : null,
      getEnemyCard: (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getEnemyCard) ? GoneRogueDataRegistry.getEnemyCard : null
    });

    if (!res || !res.ok) {
      return { lines: ['STEAL FAILED', ''], prompt: getPrompt(), stayActive: true };
    }

    // Award a disposable card into player hand/backup pipeline.
    // NOTE: this is the "permanent" steal mechanic: the card becomes part of your run deck.
    var awardId = res.cardId;
    if (awardId && typeof GAMESTATE !== 'undefined' && GAMESTATE.addPrintedCards) {
      GAMESTATE.addPrintedCards(awardId, 1, { preferHand: true });
    }

    // Feedback
    try {
      if (typeof TooltipSystem !== 'undefined') {
        TooltipSystem.showPersistent('🧤 ' + (res.success ? 'STOLEN' : 'FUMBLED'), 700);
      }
    } catch (e0) {}

    var lines = [];
    lines.push(res.message || (res.success ? 'STOLEN' : 'FUMBLED'));
    if (awardId) {
      var def = (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getCard) ? GoneRogueDataRegistry.getCard(awardId) : null;
      var em = def && def.emoji ? def.emoji : '🃏';
      var nm = def && def.name ? def.name : awardId;
      lines.push('→ ' + em + ' ' + nm);
    }
    lines.push('');

    return { lines: lines.concat(_renderGrid()), prompt: getPrompt(), stayActive: true };
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

      // Unlock avatar tier matching difficulty completed (tier 1-3 → avatar tiers 1-3)
      var _prevTier = 0;
      if (typeof TerminalCommandRouter !== 'undefined' && TerminalCommandRouter.completeTier) {
        _prevTier = TerminalCommandRouter.getPlayerState().completedTiers || 0;
        TerminalCommandRouter.completeTier(_difficultyTier);
      }

      // Show tier-up announcement if a new tier was unlocked
      var _newTier = (typeof TerminalCommandRouter !== 'undefined' && TerminalCommandRouter.getPlayerState)
        ? TerminalCommandRouter.getPlayerState().completedTiers : 0;
      if (_newTier > _prevTier && typeof TierUpAnnouncement !== 'undefined' && TierUpAnnouncement.show) {
        TierUpAnnouncement.show({
          tier: _newTier,
          onComplete: function () { /* announcement done, rogue already exiting */ }
        });
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
    var success = _rng() < bypassChance;
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

  function _findAdjacentLockedGate() {
    var dirs = [
      { dx: 0, dy: -1 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 }
    ];

    for (var i = 0; i < dirs.length; i++) {
      var x = _player.x + dirs[i].dx;
      var y = _player.y + dirs[i].dy;
      var key = x + ',' + y;
      var meta = _tileMetadata[key];
      if (meta && meta.type === 'locked_gate') {
        return { x: x, y: y, meta: meta };
      }
    }

    return null;
  }

  function _consumeActiveItemIfMatches(requiredKey) {
    if (typeof GAMESTATE === 'undefined') return false;

    var active = GAMESTATE.getActiveItem ? GAMESTATE.getActiveItem() : null;
    if (!active || active.type !== 'key') return false;

    var activeKeyType = active.keyType || active.itemId;
    if (activeKeyType !== requiredKey) return false;

    // Remove one matching key from persistent inventory (equipped items currently come from persistent)
    var persistent = GAMESTATE.getPersistentInventory ? GAMESTATE.getPersistentInventory() : [];
    for (var i = 0; i < persistent.length; i++) {
      var pit = persistent[i];
      if (pit && pit.type === 'key' && (pit.keyType || pit.itemId) === requiredKey) {
        if (GAMESTATE.removePersistentInventoryItem) GAMESTATE.removePersistentInventoryItem(i);
        break;
      }
    }

    if (GAMESTATE.clearActiveItem) GAMESTATE.clearActiveItem();

    // Decrement structured key counter (Tier 2 gate key consumed from active slot)
    try {
      if (GAMESTATE.removeKeyCount) GAMESTATE.removeKeyCount(requiredKey, 2);
    } catch (eKC) {}

    // Update active slot display (header)
    if (typeof document !== 'undefined') {
      var activeDisplay = document.getElementById('active-item-display');
      if (activeDisplay) {
        activeDisplay.innerHTML = '<span class="empty-slot-indicator">·</span>';
        activeDisplay.classList.remove('has-item');
      }
    }

    // Refresh inventory display if mobile UI present
    if (typeof GoneRogueMobile !== 'undefined' && GoneRogueMobile.showInventory) {
      GoneRogueMobile.showInventory();
    }

    return true;
  }

  function _consumeKeyFromInventory(requiredKey) {
    if (typeof GAMESTATE === 'undefined') return false;

    var loose = GAMESTATE.getLooseInventory ? GAMESTATE.getLooseInventory() : [];
    for (var i = 0; i < loose.length; i++) {
      var it = loose[i];
      if (it && it.type === 'key' && (it.keyType || it.itemId) === requiredKey) {
        if (GAMESTATE.removeFromLoose) GAMESTATE.removeFromLoose(i);
        // Decrement counter (tier 1 ammo — from loose inventory)
        try { if (GAMESTATE.removeKeyCount) GAMESTATE.removeKeyCount(requiredKey, it.tier || 1); } catch (e) {}
        return true;
      }
    }

    // Fallback: consume from persistent inventory (keyring slot)
    var persistent = GAMESTATE.getPersistentInventory ? GAMESTATE.getPersistentInventory() : [];
    for (var j = 0; j < persistent.length; j++) {
      var pit = persistent[j];
      if (pit && pit.type === 'key' && (pit.keyType || pit.itemId) === requiredKey) {
        if (GAMESTATE.removeFromPersistent) GAMESTATE.removeFromPersistent(j);
        // Decrement counter (tier 2 gate key — from persistent)
        try { if (GAMESTATE.removeKeyCount) GAMESTATE.removeKeyCount(requiredKey, pit.tier || 2); } catch (e) {}
        return true;
      }
    }

    return false;
  }

  /**
   * Consume a Tier 3 quest key via NPC turn-in interaction.
   * Only called from NPC dialogue callbacks, never from gate unlock.
   * @param {string} questKeyType - The keyType or registryId to consume
   * @param {string} npcTarget - The NPC identifier for validation
   * @returns {object|false} - The consumed item data, or false if not found
   */
  function _consumeQuestItem(questKeyType, npcTarget) {
    if (typeof GAMESTATE === 'undefined') return false;

    var persistent = GAMESTATE.getPersistentInventory ? GAMESTATE.getPersistentInventory() : [];
    for (var i = 0; i < persistent.length; i++) {
      var pit = persistent[i];
      if (!pit || pit.type !== 'key') continue;
      if (pit.subtype !== 'quest') continue;

      var keyId = pit.keyType || pit.registryId || pit.itemId;
      if (keyId !== questKeyType) continue;

      // Validate NPC target matches if provided on the item
      if (pit.npcTarget && npcTarget && pit.npcTarget !== npcTarget) continue;

      // Found a match — remove from persistent inventory
      var consumed = JSON.parse(JSON.stringify(pit));
      if (GAMESTATE.removePersistentInventoryItem) {
        GAMESTATE.removePersistentInventoryItem(i);
      } else if (GAMESTATE.removeFromPersistent) {
        GAMESTATE.removeFromPersistent(i);
      }

      // Decrement structured key counter (Tier 3 quest key consumed via NPC turn-in)
      try {
        if (GAMESTATE.removeKeyCount) GAMESTATE.removeKeyCount(questKeyType, 3);
      } catch (eKC) {}

      // Visual feedback
      if (typeof TooltipSystem !== 'undefined') {
        TooltipSystem.show((pit.emoji || '🔨') + ' TURNED IN', 1500);
      }
      if (typeof DebriefFeedController !== 'undefined') {
        DebriefFeedController.flashIncinerator({ kind: 'quest_key' });
      }

      // Refresh inventory display
      if (typeof GoneRogueMobile !== 'undefined' && GoneRogueMobile.showInventory) {
        GoneRogueMobile.showInventory();
      }

      return consumed;
    }

    return false;
  }

  function _attemptUnlockLockedGate(gx, gy, meta, opts) {
    opts = opts || {};

    var required = meta.requiredKey || 'RUSTY_KEY';
    var accepts = meta.acceptsKeys || null;
    var playerKeys = _getPlayerKeys();

    // Locked chest supports multiple acceptable keys
    if (accepts && accepts.length) {
      var hasAny = false;
      for (var ai = 0; ai < accepts.length; ai++) {
        if (playerKeys.indexOf(accepts[ai]) !== -1) {
          required = accepts[ai];
          hasAny = true;
          break;
        }
      }
      if (!hasAny) {
        return {
          lines: [
            (meta.emoji || '🧰') + ' ' + (meta.name || 'LOCKED CHEST'),
            'LOCKED — NEEDS A KEY',
            ''],
          prompt: getPrompt(),
          stayActive: true
        };
      }
    } else {
      if (playerKeys.indexOf(required) === -1) {
        return {
          lines: [
            (meta.emoji || '🚪') + ' ' + (meta.name || 'LOCKED DOOR'),
            'LOCKED — REQUIRES KEY: ' + required,
            ''],
          prompt: getPrompt(),
          stayActive: true
        };
      }
    }

    // Tier-aware key consumption:
    // Tier 1 (ammo): consume from loose inventory first, then persistent
    // Tier 2 (gate): consume from active slot if equipped, else loose/persistent
    // Tier 3 (quest): NEVER consumed by gates — only via NPC turn-in
    var keyTier = _getKeyTier(required);
    if (keyTier >= 3) {
      // Quest keys can't open gates — shouldn't reach here, but guard anyway
      return {
        lines: [
          (meta.emoji || '🚪') + ' ' + (meta.name || 'LOCKED DOOR'),
          'This lock requires a different key.',
          ''],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    if (opts.consumeFromActiveSlot) {
      _consumeActiveItemIfMatches(required);
    } else {
      _consumeKeyFromInventory(required);
    }

    // If this was a chest, spawn loot before opening
    if (meta.type === 'locked_chest') {
      // Basic reward: a little currency + a card roll
      _spawnCurrency(gx, gy, 12 + Math.floor(_rng() * 10));

      if (typeof CardSystem !== 'undefined') {
        var baseType = CardSystem.getRandomBaseCard ? CardSystem.getRandomBaseCard() : null;
        if (baseType && CardSystem.rollCard) {
          var card = CardSystem.rollCard(baseType);
          if (card) {
            _items.push({ x: gx, y: gy, type: 'card', card: card, spawnTime: Date.now(), decayTime: 30000 });
          }
        }
      }
    }

    // Open the tile
    _grid[gy][gx] = TILES.EMPTY;
    delete _tileMetadata[gx + ',' + gy];
    _rebuildWallCache();

    // POOF EFFECT: Chip's Challenge style gate vanish (💨)
    try {
      var poofEffect = { x: gx, y: gy, type: 'poof', time: Date.now(), char: '💨' };
      _impactEffects.push(poofEffect);
      setTimeout(function() {
        var idx = _impactEffects.indexOf(poofEffect);
        if (idx > -1) _impactEffects.splice(idx, 1);
      }, 400);
      // Also show overhead expression for extra oomph
      if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
        OverheadAnimator.showGenericExpression(gx, gy, '💨', 800, '#AAAAAA');
      }
    } catch (ePoof) { /* visual only, don't break unlock */ }

    // If this was a multi-tile gate (lockedGate with positions array), poof ALL positions
    try {
      if (meta.positions && Array.isArray(meta.positions)) {
        meta.positions.forEach(function(pos) {
          if (pos.x === gx && pos.y === gy) return; // Already poofed above
          _grid[pos.y][pos.x] = TILES.EMPTY;
          delete _tileMetadata[pos.x + ',' + pos.y];
          var mEffect = { x: pos.x, y: pos.y, type: 'poof', time: Date.now(), char: '💨' };
          _impactEffects.push(mEffect);
          setTimeout(function() {
            var mi = _impactEffects.indexOf(mEffect);
            if (mi > -1) _impactEffects.splice(mi, 1);
          }, 400);
        });
        _rebuildWallCache();
      }
    } catch (eMulti) { /* visual only */ }

    if (typeof TooltipSystem !== 'undefined') {
      TooltipSystem.show((meta.emoji || '🚪') + ' UNLOCKED', 1500);
    }

    // Debrief synergy overlap + incinerator flash (key consumed)
    if (typeof DebriefFeedController !== 'undefined') {
      var kind = (meta.type === 'locked_chest') ? 'chest' : 'gate';
      DebriefFeedController.showSynergyOverlay({
        kind: kind,
        keyEmoji: '🗝',
        gateEmoji: (meta.emoji || '🚪')
      });
      DebriefFeedController.flashIncinerator({ kind: 'key' });
    }

    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      _updateMobileGrid();
    }

    _saveState();

    return {
      lines: ['UNLOCKED: ' + (meta.emoji || '🚪') + ' ' + (meta.name || 'Door'), ''].concat(_renderGrid()),
      prompt: getPrompt(),
      stayActive: true
    };
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

    // Locked gates/doors (tutorial + occasional chip-style challenge)
    var locked = _findAdjacentLockedGate();
    if (locked) {
      return _attemptUnlockLockedGate(locked.x, locked.y, locked.meta);
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

  // =========================================================================
  // Interior Floor System — Enter/exit building interiors (tavern, church, etc.)
  // Uses InteriorFloors module for authored layouts and dot-notation floor IDs.
  // =========================================================================
  var _interiorFloorStack = []; // Stack of { floorId, playerPos } for nested interiors
  var _currentInteriorFloorId = null; // Current interior floor ID (null if on main floor)

  function _enterInteriorFloor(targetFloorId) {
    if (!targetFloorId) return;
    if (typeof InteriorFloors === 'undefined') {
      console.warn('[GoneRogue] InteriorFloors module not loaded');
      return;
    }

    var layout = InteriorFloors.getAuthoredLayout(targetFloorId);
    if (!layout) {
      console.warn('[GoneRogue] No authored layout for interior: ' + targetFloorId);
      return;
    }

    console.log('[GoneRogue] Entering interior floor: ' + targetFloorId);

    // Save current state to the stack so we can return
    _interiorFloorStack.push({
      floorId: _currentInteriorFloorId,
      mainFloor: _floor,
      playerX: _player.x,
      playerY: _player.y
    });
    _currentInteriorFloorId = targetFloorId;

    // Fade-out effect
    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      var gridContainer = document.getElementById('rogue-grid-mobile');
      if (gridContainer) {
        gridContainer.style.opacity = '0';
        gridContainer.style.transition = 'opacity 0.25s ease-out';
      }
    }

    setTimeout(function() {
      // Generate the interior floor using the authored layout
      var floorData = TutorialFloors.generateContrivedFloor(layout);

      // Apply grid
      _grid = floorData.grid;

      // Place player at interior spawn
      _player.x = floorData.player.x;
      _player.y = floorData.player.y;
      _ensurePlayerOnEmptyTile();

      // Reset state arrays for interior
      _enemies = [];
      _breakables = [];
      WorldItems.init();
      _items = WorldItems.getFloorItems();
      _currencies = WorldItems.getCurrencies();
      _npcs = [];
      _forestBuildings = [];
      _tileMetadata = {};

      // CRITICAL: Clear pre-computed visual grids so the renderer uses the NEW _grid
      // instead of the stale biome visual grid from the previous floor.
      _biomeVisualGrid = null;
      _biomeBackgroundColors = null;
      _tileRenderObjects = null;
      _cachedWalls = [];

      // Place exit door (back to parent floor)
      var exitX = floorData.exit.x;
      var exitY = floorData.exit.y;
      if (exitX >= 0 && exitX < GRID_WIDTH && exitY >= 0 && exitY < GRID_HEIGHT) {
        _grid[exitY][exitX] = TILES.DOOR;
        _tileMetadata[exitX + ',' + exitY] = { type: 'door', doorKind: 'interior_exit' };
      }

      // Place decorations
      if (floorData.decorations) {
        floorData.decorations.forEach(function(deco) {
          _forestBuildings.push({ x: deco.x, y: deco.y, emoji: deco.emoji });
        });
      }

      // Place breakables
      if (floorData.breakables) {
        floorData.breakables.forEach(function(breakable) {
          _breakables.push({
            x: breakable.x, y: breakable.y,
            hp: breakable.hp, maxHp: breakable.hp,
            glyph: TILES.BREAKABLE, destroyedGlyph: TILES.DEBRIS,
            emoji: breakable.emoji, name: breakable.name,
            tag: 'interior_breakable_' + _breakables.length,
            drops: breakable.drops
          });
        });
      }

      // Place currencies
      if (layout.currencies) {
        layout.currencies.forEach(function(c) {
          _currencies.push({ x: c.x, y: c.y, amount: c.amount || 3, collected: false });
        });
      }

      // Place building doors (for nested interiors, e.g. tavern → basement)
      if (floorData.buildingDoors && floorData.buildingDoors.length > 0) {
        floorData.buildingDoors.forEach(function(bd) {
          if (!bd || typeof bd.x !== 'number' || typeof bd.y !== 'number') return;
          if (bd.x < 0 || bd.x >= GRID_WIDTH || bd.y < 0 || bd.y >= GRID_HEIGHT) return;
          _grid[bd.y][bd.x] = TILES.DOOR;
          _tileMetadata[bd.x + ',' + bd.y] = {
            type: 'building_door',
            doorKind: 'building',
            buildingId: bd.buildingId || null,
            targetFloorId: bd.targetFloorId || null,
            emoji: '🚪',
            name: (bd.buildingId || 'Building') + ' Entrance'
          };
        });
      }

      // Place NPCs
      if (floorData.npcs && floorData.npcs.length > 0) {
        floorData.npcs.forEach(function(npc) {
          var npcObj = {
            id: npc.id || ('NPC-' + npc.x + '-' + npc.y),
            x: npc.x, y: npc.y,
            emoji: npc.emoji || '🧑', name: npc.name || 'NPC',
            direction: (npc.direction || 'south').toLowerCase(),
            dialogues: Array.isArray(npc.dialogues) ? npc.dialogues.slice() : [],
            gate: npc.gate || null, reward: npc.reward || null,
            shopkeeper: npc.shopkeeper || false,
            state: { released: false, rewardGiven: false, lastWarnTurn: -999, lastTalkTurn: -999 }
          };
          _npcs.push(npcObj);
          _grid[npcObj.y][npcObj.x] = TILES.WALL;
          _tileMetadata[npcObj.x + ',' + npcObj.y] = {
            type: 'npc', npcId: npcObj.id, emoji: npcObj.emoji, name: npcObj.name
          };
        });
      }

      // Place interactive items
      if (floorData.interactiveItems && typeof InteractiveItems !== 'undefined') {
        floorData.interactiveItems.forEach(function(itemDef) {
          var item = InteractiveItems.createItem(itemDef.type, itemDef.x, itemDef.y, {
            text: itemDef.text || '', emoji: itemDef.emoji, name: itemDef.name,
            customData: itemDef.customData
          });
          if (item) InteractiveItems.addItem(item);
        });
      }

      // Place quest key items (tutorialPickups with type 'key')
      if (floorData.tutorialPickups) {
        floorData.tutorialPickups.forEach(function(pickup) {
          if (pickup.type === 'key') {
            _items.push({
              x: pickup.x, y: pickup.y,
              type: 'key',
              keyType: pickup.keyType || 'UNKNOWN_KEY',
              tier: pickup.tier || 3,
              subtype: pickup.subtype || 'quest',
              emoji: pickup.emoji || '🔑',
              name: pickup.name || 'Key',
              npcTarget: pickup.npcTarget || null,
              collected: false
            });
          } else if (pickup.type === 'currency') {
            _currencies.push({ x: pickup.x, y: pickup.y, amount: pickup.amount, collected: false });
          } else if (pickup.type === 'card' && pickup.guaranteed) {
            _items.push({ x: pickup.x, y: pickup.y, type: 'card', card: 'strike', collected: false });
          }
        });
      }

      // Lighting for interior
      if (typeof LightingSystem !== 'undefined') {
        LightingSystem.setBiome('COZY_FOREST_NIGHT');
        LightingSystem.setDarknessMultiplier(1.2);
        _rebuildWallCache();
        var pseudoRooms = [{ x: 1, y: 1, width: GRID_WIDTH - 2, height: GRID_HEIGHT - 2 }];
        LightingSystem.generateBiomeLights(GRID_WIDTH, GRID_HEIGHT, pseudoRooms, _wallCache);
        LightingSystem.addLightSource(_player.x, _player.y, 'CAMPFIRE');
        _updatePlayerLight();
        LightingSystem.updateLightMap(GRID_WIDTH, GRID_HEIGHT, _getAllLightBlockers(_wallCache));
      }

      // Initialize movement at new position
      if (typeof GoneRogueMovement !== 'undefined') {
        GoneRogueMovement.init(_player.x, _player.y);
      }

      _startGameLoop();

      // Fade-in
      if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
        var gridContainer = document.getElementById('rogue-grid-mobile');
        if (gridContainer) {
          gridContainer.style.opacity = '1';
          gridContainer.style.transition = 'opacity 0.25s ease-in';
        }
      }

      // Show interior name
      if (typeof UIControls !== 'undefined' && UIControls.updateMokInterjection) {
        UIControls.updateMokInterjection('📍 ' + (layout.name || 'Interior'));
      }

      console.log('[GoneRogue] Interior floor loaded: ' + targetFloorId);
    }, 260);
  }

  function _exitInteriorFloor() {
    if (_interiorFloorStack.length === 0) return;

    var prev = _interiorFloorStack.pop();
    _currentInteriorFloorId = prev.floorId;

    console.log('[GoneRogue] Exiting interior, returning to ' + (prev.floorId || 'main floor ' + prev.mainFloor));

    // Fade-out
    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      var gridContainer = document.getElementById('rogue-grid-mobile');
      if (gridContainer) {
        gridContainer.style.opacity = '0';
        gridContainer.style.transition = 'opacity 0.25s ease-out';
      }
    }

    setTimeout(function() {
      if (prev.floorId) {
        // Returning to a parent interior (e.g. basement → tavern)
        _enterInteriorFloor(prev.floorId);
      } else {
        // Returning to main floor — regenerate it
        _floor = prev.mainFloor;
        _lastExitPos = { x: prev.playerX, y: prev.playerY };
        _spawnFromLastExitPos = 'retreat';
        _turn = 0;
        _generateFloor();
        _startGameLoop();
      }

      // Fade-in
      if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
        var gridContainer = document.getElementById('rogue-grid-mobile');
        if (gridContainer) {
          gridContainer.style.opacity = '1';
          gridContainer.style.transition = 'opacity 0.25s ease-in';
        }
      }
    }, 260);
  }

  function _retreatFloor() {
    // If inside an interior floor, exit the interior instead of retreating main floors
    if (_currentInteriorFloorId) {
      _exitInteriorFloor();
      return;
    }

    if (_floor <= 0) return;

    // Remember where we are so the previous floor can spawn us near the return door
    try { _lastExitPos = { x: _player.x, y: _player.y }; } catch (e0) {}
    _spawnFromLastExitPos = 'retreat';

    // Fade-out effect
    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      var gridContainer = document.getElementById('rogue-grid-mobile');
      if (gridContainer) {
        gridContainer.style.opacity = '0';
        gridContainer.style.transition = 'opacity 0.25s ease-out';
      }
    }

    setTimeout(function() {
      _floor = Math.max(0, _floor - 1);
      _turn = 0;
      _generateFloor();
      _startGameLoop();
      _saveState();

      // Fade-in
      if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
        var gridContainer = document.getElementById('rogue-grid-mobile');
        if (gridContainer) {
          gridContainer.style.opacity = '1';
          gridContainer.style.transition = 'opacity 0.25s ease-in';
        }
      }
    }, 260);
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

    // Remember which door/exit we used (for retreat/backtracking only)
    try {
      _lastExitPos = { x: _player.x, y: _player.y };
    } catch (e0) {}
    _spawnFromLastExitPos = 'advance';

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
      var healAmount = Math.floor(_player.maxHp * (0.1 + _rng() * 0.1));
      _player.hp = Math.min(_player.maxHp, _player.hp + healAmount);

      // Apply desired UBER difficulty on spawn boundary (before floor generation)
      // so it affects enemies/loot/etc for the new floor without biome teleport.
      if (!isSecretFloor) {
        _applyDesiredDifficultyTier('advance_floor');
      }

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
    var randomType = vendorTypes[Math.floor(_rng() * vendorTypes.length)];
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
      var healPercent = 0.3 + _rng() * 0.2;
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
      var rand = _rng() * 100;
      var targetQuality;

      if (rand < 0.2) {
        targetQuality = 97 + _rng() * 3; // 97-100% (perfect)
      } else if (rand < 2) {
        targetQuality = 90 + _rng() * 7; // 90-97% (near-perfect)
      } else if (rand < 10) {
        targetQuality = 75 + _rng() * 15; // 75-90% (strong)
      } else if (rand < 30) {
        targetQuality = 55 + _rng() * 20; // 55-75% (usable)
      } else {
        targetQuality = 30 + _rng() * 25; // 30-55% (junk)
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

    // Get display name — prefer account username, fall back to local callsign
    var displayName = 'Anonymous';
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getAccount === 'function') {
      var account = GAMESTATE.getAccount();
      if (account && account.username) {
        displayName = account.username;
      }
    }
    // Fallback: use local player callsign from TerminalCommandRouter
    if (displayName === 'Anonymous' && typeof TerminalCommandRouter !== 'undefined' && TerminalCommandRouter.getPlayerState) {
      var _pState = TerminalCommandRouter.getPlayerState();
      if (_pState.callsign) {
        displayName = _pState.callsign;
      }
    }

    // Calculate enemies avoided (spawned but not killed)
    var enemiesAvoided = Math.max(0, _totalEnemiesSpawned - _enemiesKilled);

    // Prepare run data for score calculation
    var runData = {
      currencyFound: _currencyCollected,
      interactivesFound: (typeof InteractiveItems !== 'undefined' && InteractiveItems.getInteractionCount) ? InteractiveItems.getInteractionCount() : 0,
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

    // Record run in player profile (death = not success)
    if (typeof TerminalCommandRouter !== 'undefined' && TerminalCommandRouter.recordRun) {
      TerminalCommandRouter.recordRun({ success: false, floor: _floor, deaths: 1 });
    }

    // Build death cause string
    var causeStr = '// SIGNAL LOST';
    if (reason === 'combat_damage' && context.enemy) {
      causeStr = '// KILLED BY ' + (context.enemy.name || 'HOSTILE').toUpperCase();
    } else if (reason === 'burning') {
      causeStr = '// BURNED TO DEATH';
    } else if (reason === 'toxin') {
      causeStr = '// TOXIC EXPOSURE';
    } else if (reason === 'trap') {
      causeStr = '// CAUGHT IN TRAP';
    } else if (reason === 'environmental_hazard') {
      causeStr = '// ENVIRONMENTAL HAZARD';
    }

    // Calculate currency penalty preview (actual penalty applied in GAMESTATE.exitRogueMode)
    var currencyBefore = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getCryptos) ? GAMESTATE.getCryptos() : 0;
    var currencyLost = Math.floor(currencyBefore * 0.5);

    // Show YOU DIED full-screen overlay with run stats
    if (typeof STRCombatWindow !== 'undefined' && typeof STRCombatWindow.showDeathScreen === 'function') {
      STRCombatWindow.showDeathScreen({
        floor: _floor,
        enemiesKilled: _enemiesKilled,
        runTimeMs: _runStartTime ? (Date.now() - _runStartTime) : 0,
        currencyLost: currencyLost,
        cause: causeStr
      });
    }

    // Exit rogue mode (applies inventory wipe + currency penalty)
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

      // Track first combat victory for gate eligibility
      if (!_runState.firstCombatVictory) {
        _runState.firstCombatVictory = true;
        console.log('[GoneRogue] First combat victory achieved - gates now eligible');
      }
    }

    // Spawn loot
    if (deathResult.loot) {
      // Spawn currency
      if (deathResult.loot.currency > 0) {
        _spawnCurrency(enemy.x, enemy.y, deathResult.loot.currency);
      }

      // Spawn ammo (if provided by DeathHandler)
      if (deathResult.loot.ammo && deathResult.loot.ammo > 0) {
        _items.push({
          x: enemy.x,
          y: enemy.y,
          type: 'ammo',
          amount: deathResult.loot.ammo,
          spawnTime: Date.now(),
          decayTime: 30000,
          emoji: '📦',
          name: 'Ammo (' + deathResult.loot.ammo + ')'
        });
      }

      // Spawn cards
      var _dropCountCards = 0;
      if (deathResult.loot.cards && deathResult.loot.cards.length > 0 && typeof CardSystem !== 'undefined') {
        for (var i = 0; i < deathResult.loot.cards.length; i++) {
          if (deathResult.loot.cards[i].shouldDrop) {
            var baseType = CardSystem.getRandomBaseCard();
            var card = CardSystem.rollCard(baseType);
            if (card) {
              _dropCountCards++;
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
      var _dropCountItems = 0;
      if (deathResult.loot.charms && deathResult.loot.charms.length > 0 && typeof CardSystem !== 'undefined') {
        for (var j = 0; j < deathResult.loot.charms.length; j++) {
          if (deathResult.loot.charms[j].shouldDrop) {
            var charm = CardSystem.rollCommonCharm();
            if (charm) {
              _dropCountItems++;
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

      // Loot summary: show stacked text above the drop position
      try {
        if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showStackedText) {
          var stacks = [];
          if (deathResult.loot.currency > 0) stacks.push({ text: 'CR+' + deathResult.loot.currency, color: '#FFFFFF' });
          if (deathResult.loot.ammo && deathResult.loot.ammo > 0) stacks.push({ text: 'AM+' + deathResult.loot.ammo, color: '#FFFFFF' });
          if (_dropCountCards > 0) stacks.push({ text: 'CD+' + _dropCountCards, color: '#FFFFFF' });
          if (_dropCountItems > 0) stacks.push({ text: 'IT+' + _dropCountItems, color: '#FFFFFF' });
          if (stacks.length) OverheadAnimator.showStackedText(enemy.x, enemy.y, stacks, 1200);
        }
      } catch (eLoot0) {}
    }

    // If the dying enemy was the active STR combat target, hard-clear STR state.
    // This prevents "ghost" STR windows when enemies die through non-STR pipelines.
    try {
      if (_strCombatActive && _strCombatEnemy && enemy && _strCombatEnemy === enemy) {
        if (typeof StrCombatEngine !== 'undefined') StrCombatEngine.forceReset();
        _strCombatActive = false;
        _strCombatPhase = 'idle';
        _strCombatEnemy = null;
        if (typeof STRCombatWindow !== 'undefined' && typeof STRCombatWindow.hide === 'function') {
          STRCombatWindow.hide();
        }
        if (typeof HandFanComponent !== 'undefined' && typeof HandFanComponent.hide === 'function') {
          HandFanComponent.hide();
          if (typeof HandFanComponent.clearSelection === 'function') HandFanComponent.clearSelection();
        }
        if (typeof BackupActionContainer !== 'undefined' && typeof BackupActionContainer.hide === 'function') {
          BackupActionContainer.hide();
        }
      }
    } catch (e0) {}

    return deathResult;
  }

  function _exitRogue(success) {
    _active = false;
    _stopGameLoop();

    // Ensure STR combat UI is fully cleared
    if (typeof StrCombatEngine !== 'undefined') StrCombatEngine.forceReset();
    _strCombatActive = false;
    _strCombatPhase = 'idle';
    _strCombatEnemy = null;
    try {
      if (typeof STRCombatWindow !== 'undefined' && STRCombatWindow.hide) STRCombatWindow.hide();
      if (typeof HandFanComponent !== 'undefined' && HandFanComponent.hide) HandFanComponent.hide();
      if (typeof BackupActionContainer !== 'undefined' && BackupActionContainer.hide) BackupActionContainer.hide();
    } catch (e0) {}

    // Re-enable scanlines when returning to terminal
    document.body.classList.remove('gone-rogue-active');

    // Submit highscore if extraction was successful
    if (success && typeof HighscoreState !== 'undefined') {
      _submitHighscore();
    }

    // Record run in player profile
    if (typeof TerminalCommandRouter !== 'undefined' && TerminalCommandRouter.recordRun) {
      TerminalCommandRouter.recordRun({ success: success, floor: _floor, deaths: 0 });
    }

    // Show post-run summary screen
    if (typeof RunSummary !== 'undefined' && RunSummary.show) {
      // Check if a tier was just unlocked (set by floor-30 extraction handler)
      var _rsPrevTier = 0;
      var _rsNewTier = 0;
      if (typeof TerminalCommandRouter !== 'undefined' && TerminalCommandRouter.getPlayerState) {
        var _rsPs = TerminalCommandRouter.getPlayerState();
        _rsNewTier = _rsPs.completedTiers || 0;
      }

      RunSummary.show({
        success: success,
        floor: _floor,
        duration: _runStartTime ? (Date.now() - _runStartTime) : 0,
        kills: _enemiesKilled || 0,
        currency: _currencyCollected || 0,
        score: (typeof HighscoreState !== 'undefined' && success)
          ? HighscoreState.calculateGoneRogueScore({
              currencyFound: _currencyCollected, interactivesUsed: 0,
              enemiesAvoided: Math.max(0, _totalEnemiesSpawned - _enemiesKilled),
              breakableDamage: _totalBreakableDamage, damageMitigated: _damageMitigated
            }) : 0,
        tierUp: success && _runCompleted && _rsNewTier > 0,
        newTier: _rsNewTier
      });
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

    try {
      var now = Date.now();
      var delta = now - _lastTickTime;

      // Process game updates if enough time has passed
      if (delta >= _tickInterval) {
        var _t0 = (typeof EYESONLY_PERF !== 'undefined') ? performance.now() : 0;
        _updateGameState(delta);
        if (_t0 && typeof EYESONLY_PERF !== 'undefined') {
          EYESONLY_PERF.mark('rogue.gameTickMs', performance.now() - _t0);
        }
        _lastTickTime = now;
      }
    } catch (e) {
      // Keep the loop alive even if an update throws, so the world doesn't hard-freeze.
      try { console.error('[GoneRogue] game loop tick error:', e); } catch (e2) {}
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

        // Floor 0 scripted walk: two-phase system (tavern pause → exit stop)
        if (_scriptedWalk && _scriptedWalkTarget) {
          if (_player.x === _scriptedWalkTarget.x && _player.y === _scriptedWalkTarget.y) {
            if (typeof GoneRogueMovement !== 'undefined') GoneRogueMovement.stop();

            if (_scriptedWalkPhase === 1) {
              // Phase 1 complete: arrived at tavern door — pause and show hint
              _scriptedWalkPhase = 2;
              _scriptedWalk = false;
              _scriptedWalkTarget = null;
              _showTutorialHint('tavern_hint', '👆 Tap to explore the tavern — or wait to continue', 3500);

              // After 3.5s pause, resume walk toward exit
              setTimeout(function() {
                if (_scriptedWalkPhase === 2 && _scriptedWalkExitTarget) {
                  _scriptedWalkPhase = 3;
                  _scriptedWalk = true;
                  _scriptedWalkTarget = _scriptedWalkExitTarget;
                  if (typeof GoneRogueMovement !== 'undefined') {
                    GoneRogueMovement.startMoveTo(_scriptedWalkTarget.x, _scriptedWalkTarget.y);
                  }
                }
              }, 3500);
            } else if (_scriptedWalkPhase === 3) {
              // Phase 3 complete: arrived at exit — stop and let player tap the door
              _scriptedWalk = false;
              _scriptedWalkTarget = null;
              _scriptedWalkPhase = 0;
              _showTutorialHint('exit_hint', '🚪 Tap the door to enter the forest', 4000);
              // Player must tap exit door themselves — no auto-advance
            } else {
              // Fallback: clear scripted walk
              _scriptedWalk = false;
              _scriptedWalkTarget = null;
            }
          }
        }
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

    // Update pets based on player position history
    if (typeof PetFollower !== 'undefined') {
      var currentTime = Date.now();
      PetFollower.updatePets(_player.positionHistory, currentTime);

      // Check for breakables near humanoid pets
      PetFollower.checkBreakables(_breakables, function(breakable, index) {
        // Pet breaks a breakable
        _breakables.splice(index, 1);
        console.log('[Pet] Broke breakable at', breakable.x, breakable.y);

        // Optional: trigger overhead animation
        if (typeof OverheadAnimator !== 'undefined') {
          OverheadAnimator.showGenericExpression(breakable.x, breakable.y, '💥', 800);
        }
      });
    }

    // Update enemy positions and awareness
    var _ep0 = (typeof EYESONLY_PERF !== 'undefined') ? performance.now() : 0;
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

      // Box interaction: check when enemy arrives at a new integer tile
      if (enemy.x !== enemy._lastBoxCheckX || enemy.y !== enemy._lastBoxCheckY) {
        enemy._lastBoxCheckX = enemy.x;
        enemy._lastBoxCheckY = enemy.y;
        _checkEnemyBoxInteraction(enemy);
      }

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
    if (_ep0 && typeof EYESONLY_PERF !== 'undefined') {
      EYESONLY_PERF.mark('rogue.enemyPathMs', performance.now() - _ep0);
    }

    // Throttle projectile advancement so they're visually animated
    _projectileTickAccum += deltaMs;
    if (_projectiles.length > 0 && _projectileTickAccum >= _projectileAdvanceInterval) {
      _projectileTickAccum = 0;
      _updateProjectiles(deltaMs);
    } else if (_projectiles.length === 0) {
      _projectileTickAccum = 0;
    }

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
    _items = WorldItems.filterFloorItems(function(item) {
      if (item.spawnTime && item.decayTime) {
        var age = now - item.spawnTime;
        return age < item.decayTime;
      }
      return true; // Keep items without decay timers
    });

    // Update currency decay timers
    _currencies = WorldItems.filterCurrencies(function(currency) {
      if (currency.spawnTime && currency.decayTime) {
        var age = now - currency.spawnTime;
        return age < currency.decayTime;
      }
      return true; // Keep currency without decay timers
    });

    // ── Magnet auto-collect: pull nearby scattered currency/ammo to player ──
    _magnetAutoCollect(now);

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
        var _lt0 = (typeof EYESONLY_PERF !== 'undefined') ? performance.now() : 0;
        LightingSystem.updateLightMap(GRID_WIDTH, GRID_HEIGHT, _getAllLightBlockers(_wallCache));
        if (_lt0 && typeof EYESONLY_PERF !== 'undefined') {
          EYESONLY_PERF.mark('lighting.updateLightMapMs', performance.now() - _lt0);
        }
      }
    }

    // Re-render if using interactive grid
    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      _updateMobileGrid();
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

    // Deployed box bonus: even if the random evasion roll in _isPlayerInSightCone
    // fails, the box still reduces enemy effective sight range significantly.
    if (_playerInBox) {
      bonus += 70; // large range reduction regardless of evasion roll
    }

    // Cache result for this player position
    _stealthBonusCache = { bonus: bonus, px: _player.x, py: _player.y };

    return bonus;
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

  function _getBoxAt(x, y) {
    return _placedBoxes.find(function(b) { return b.x === x && b.y === y; }) || null;
  }

  function _isValidBoxPlacement(x, y) {
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return false;
    if (!_grid[y] || _grid[y][x] === TILES.WALL) return false;
    if (_getBoxAt(x, y)) return false; // already a box here
    var hasEnemy = _enemies.some(function(e) { return e.x === x && e.y === y && e.hp > 0; });
    if (hasEnemy) return false;
    return true;
  }

  function _placeBoxAt(x, y, quality, itemId) {
    var box = {
      id: 'box_' + Date.now() + '_' + x + '_' + y,
      x: x,
      y: y,
      quality: quality || 'common',
      state: 'empty',
      discoveryCount: 0,
      isIdentified: false,
      sourceItemId: itemId,
      placedAtMs: Date.now()
    };
    _placedBoxes.push(box);
    return box;
  }

  function _destroyBox(box) {
    _placedBoxes = _placedBoxes.filter(function(b) { return b.id !== box.id; });

    // Visual feedback: brief poof at box position (non-projectile)
    try {
      var effect = { x: box.x, y: box.y, type: 'poof', time: Date.now(), char: '💨' };
      _impactEffects.push(effect);
      setTimeout(function() {
        var index = _impactEffects.indexOf(effect);
        if (index > -1) _impactEffects.splice(index, 1);
      }, 320);
    } catch (e0) {}

    if (typeof OverheadAnimator !== 'undefined') {
      OverheadAnimator.showExpression(box.x, box.y, 'SURPRISED', 800, '📦💥');
    }
  }

  function _playerEnterBox(box) {
    _playerInBox = box;
    box.state = 'occupied';

    // Sneak-in bonus: entering within 2s of placement reduces enemy notice chance.
    // TODO: consider see-sawing this with LOS evasion or sight range instead.
    box._sneakBonusActive = false;
    try {
      if (box.placedAtMs && (Date.now() - box.placedAtMs) <= 2000) {
        box._sneakBonusActive = true;
      }
    } catch (e0) {}

    // Transform avatar
    if (typeof GoneRogueEffectInterpreter !== 'undefined') {
      GoneRogueEffectInterpreter.executeEffect({ type: 'avatar_transform', char: '📦' }, { equipping: true });
    }
    // Invalidate stealth cache so box bonus is applied on next check
    _stealthBonusCache = null;
    if (typeof TooltipSystem !== 'undefined') {
      TooltipSystem.showGeneric('📦 Inside box — stay still', 1600);
    }
  }

  function _playerExitBox(reason) {
    var box = _playerInBox;
    if (!box) return;
    _playerInBox = null;
    box.state = 'empty';
    // Restore avatar
    if (typeof GoneRogueEffectInterpreter !== 'undefined') {
      GoneRogueEffectInterpreter.executeEffect({ type: 'avatar_transform' }, { equipping: false });
    }
    _stealthBonusCache = null;
    // Legendary boxes survive combat forced exit; all others are consumed on exit
    if (reason !== 'legendary_combat') {
      _destroyBox(box);
    }
  }

  function _checkEnemyBoxInteraction(enemy) {
    var box = _getBoxAt(enemy.x, enemy.y);
    if (!box) return;

    if (box.state === 'occupied') {
      // Player is hiding — evasion roll
      var evasionChance = _BOX_EVASION_CHANCE[box.quality] || 0.85;
      if (Math.random() < evasionChance) {
        // Enemy fails to detect player
        if (typeof OverheadAnimator !== 'undefined') {
          OverheadAnimator.showExpression(enemy.x, enemy.y, 'QUESTION');
        }
      } else {
        // Enemy detects player — trigger combat
        _playerExitBox('combat');
        if (!_strCombatActive) {
          _enterStrCombat(enemy, 'box_discover', null);
        }
      }
    } else if (box.state === 'empty') {
      if (box.quality === 'legendary') return; // legendary boxes are never interacted with

      var noticeChance = _BOX_NOTICE_CHANCE[box.quality] || 0.50;
      if (box._sneakBonusActive) {
        noticeChance = noticeChance * 0.55;
      }
      if (Math.random() < noticeChance) {
        if (typeof OverheadAnimator !== 'undefined') {
          OverheadAnimator.showExpression(enemy.x, enemy.y, 'QUESTION');
        }
        box.discoveryCount = (box.discoveryCount || 0) + 1;
      }

      // Walk-over destruction
      var walkOverChance = _BOX_WALK_OVER_CHANCE[box.quality] || 0.70;
      if (Math.random() < walkOverChance) {
        _destroyBox(box);
      }
    }
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

          // Handle light source destruction
          if (breakable.isLightSource && typeof LightingSystem !== 'undefined') {
            LightingSystem.removeLightSource(breakable.x, breakable.y);

            // Raise noise if configured
            if (breakable.noise > 0) {
              _raiseNoise(breakable.x, breakable.y, breakable.noise);
            }

            // Spawn smoke if configured
            var lightingConfig = LightingSystem.getConfig();
            if (lightingConfig && lightingConfig.interactiveLights && lightingConfig.interactiveLights.onBreak.spawnSmoke) {
              if (typeof GroundEffects !== 'undefined' && GroundEffects.addEffect) {
                GroundEffects.addEffect(breakable.x, breakable.y, 'SMOKE');
              }
            }

            // Drop loot if chance succeeds
            if (breakable.dropChance > 0 && Math.random() < breakable.dropChance && breakable.dropType) {
              _items.push({
                x: breakable.x,
                y: breakable.y,
                type: 'item',
                itemId: breakable.dropType,
                spawnTime: Date.now(),
                decayTime: 60000,
                emoji: '💾', // Placeholder, should be resolved from data
                name: 'Item'
              });
              console.log('[Lighting] Destroyed light source dropped:', breakable.dropType);
            }

            // Update light map immediately
            _rebuildWallCache();
            LightingSystem.updateLightMap(GRID_WIDTH, GRID_HEIGHT, _getAllLightBlockers(_wallCache));

            console.log('[Lighting] Removed light source at', breakable.x, ',', breakable.y);
          }

          // Use LootTableManager if available
          if (typeof LootTableManager !== 'undefined' && LootTableManager.rollBreakableLoot) {
            var breakableType = breakable.type || 'default';
            var currentBiome = _getBiome(_floor) || 'COZY_FOREST';

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
                  emoji: '⁍',
                  name: 'Ammo (' + rolledLoot.ammo + ')'
                });
              }

              // Spawn gem (15% chance — battery recharge collectible)
              if (_rng() < 0.15) {
                _items.push({
                  x: breakable.x,
                  y: breakable.y,
                  type: 'gem',
                  amount: 1,
                  spawnTime: Date.now(),
                  decayTime: 45000,
                  glyph: '◈',
                  name: 'Battery Cell'
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
            var dropChance = _rng();
            if (dropChance < 0.7) { // 70% chance to drop currency
              var cryptoAmount = Math.floor(_rng() * 3) + 1; // 1-3 cryptos
              _spawnCurrency(breakable.x, breakable.y, cryptoAmount);
            }

            // 60% chance to drop ammo (3/5 or 6/10 breakables contain ammo)
            // Average of 1.2 ammo per drop (1 or 2 ammo with weighted distribution)
            if (_rng() < 0.6) {
              var ammoAmount = _rng() < 0.8 ? 1 : 2; // 80% chance 1 ammo, 20% chance 2 ammo = 1.2 avg
              _items.push({
                x: breakable.x,
                y: breakable.y,
                type: 'ammo',
                amount: ammoAmount,
                spawnTime: Date.now(),
                decayTime: 60000, // 60 second decay for resources
                emoji: '⁍',
                name: 'Ammo (' + ammoAmount + ')'
              });
            }

            // 15% chance to drop gem (battery recharge)
            if (_rng() < 0.15) {
              _items.push({
                x: breakable.x,
                y: breakable.y,
                type: 'gem',
                amount: 1,
                spawnTime: Date.now(),
                decayTime: 45000, // 45 second decay
                glyph: '◈',
                name: 'Battery Cell'
              });
            }

            // Check for key item drops from specific breakables
            if (typeof EnvironmentalSynergy !== 'undefined' && breakable.name) {
              var keyDropped = false;

              // Tutorial / designer-defined key breakables can explicitly drop a key by id
              if (breakable.drops && breakable.drops.item) {
                var requested = ('' + breakable.drops.item).toUpperCase().replace(/[^A-Z0-9_]/g, '_');
                // Common aliases
                if (requested === 'RUSTY_KEY' || requested === 'RUSTYKEY' || requested === 'RUSTY__KEY') requested = 'RUSTY_KEY';

                var keyDefs2 = EnvironmentalSynergy.getKeyDefinitions();
                var def2 = keyDefs2[requested];
                if (def2) {
                  _items.push({
                    x: breakable.x,
                    y: breakable.y,
                    type: 'key',
                    keyType: requested,
                    emoji: def2.emoji,
                    name: def2.name,
                    description: def2.description,
                    spawnTime: Date.now(),
                    decayTime: 60000
                  });
                  keyDropped = true;
                }
              }

              // Terminal breakables can drop thumb drives (OFFICE biome)
              if (breakable.name === 'Terminal' && _rng() < 0.15) { // 15% chance
                var keyDefs = EnvironmentalSynergy.getKeyDefinitions();
                if (keyDefs.THUMB_DRIVE) {
                  _items.push({
                    x: breakable.x,
                    y: breakable.y,
                    type: 'key',
                    keyType: 'THUMB_DRIVE',
                    emoji: keyDefs.THUMB_DRIVE.emoji,
                    name: keyDefs.THUMB_DRIVE.name,
                    description: keyDefs.THUMB_DRIVE.description,
                    spawnTime: Date.now(),
                    decayTime: 120000 // 2 minute decay
                  });
                  keyDropped = true;
                  console.log('[GoneRogue] Thumb drive dropped from terminal at', breakable.x, breakable.y);
                }
              }

              // Wooden gates/boxes can drop rusty keys (FOREST biome)
              if (!keyDropped && (breakable.name === 'Wooden Gate' || breakable.name === 'Wooden Box') && _rng() < 0.10) {
                var keyDefs = EnvironmentalSynergy.getKeyDefinitions();
                if (keyDefs.RUSTY_KEY) {
                  _items.push({
                    x: breakable.x,
                    y: breakable.y,
                    type: 'key',
                    keyType: 'RUSTY_KEY',
                    emoji: keyDefs.RUSTY_KEY.emoji,
                    name: keyDefs.RUSTY_KEY.name,
                    description: keyDefs.RUSTY_KEY.description,
                    spawnTime: Date.now(),
                    decayTime: 120000
                  });
                  keyDropped = true;
                  console.log('[GoneRogue] Rusty key dropped at', breakable.x, breakable.y);
                }
              }
            }

            // 30% chance to drop a card
            if (_rng() < 0.3 && typeof CardSystem !== 'undefined') {
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
            if (_rng() < 0.25 && typeof CardSystem !== 'undefined') {
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
      'west': '←',
      'northeast': './',
      'northwest': '/',
      'southeast': '.\\',
      'southwest': '\\'
    };

    return glyphs[direction] || TILES.PROJECTILE;
  }

  function _fireProjectile(cmd) {
    var dir = _parseDirection(cmd);

    var len = Math.sqrt(dir.dx * dir.dx + dir.dy * dir.dy) || 1;
    var vx = dir.dx / len;
    var vy = dir.dy / len;

    var projectile = {
      x: _player.x,
      y: _player.y,
      fx: _player.x,
      fy: _player.y,
      dx: dir.dx,
      dy: dir.dy,
      vx: vx,
      vy: vy,
      speed: 1.0,
      bounces: 3,
      glyph: _getProjectileGlyph(dir.direction),
      emoji: '💥',
      range: 15,
      power: 3,
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
    // Don't advance immediately — let the game loop advance one tile per tick
    // so the projectile is visually animated across frames.
    _saveState();

    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      _updateMobileGrid();
    }

    return {
      lines: ['FIRING ' + projectile.glyph + ' ' + dir.direction.toUpperCase(), ''].concat(_renderGrid()),
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Fire a projectile toward a clicked target coordinate (used by desktop/mobile grid input)
   */
  function fireProjectileAtTarget(targetX, targetY) {
    if (!_active || !_player) return;

    var dx = targetX - _player.x;
    var dy = targetY - _player.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return;

    var vx = dx / dist;
    var vy = dy / dist;

    // We can infer a rough directional glyph based on dominant axis
    var dirName = 'east';
    if (Math.abs(dx) > Math.abs(dy)) {
      dirName = dx > 0 ? 'east' : 'west';
    } else {
      dirName = dy > 0 ? 'south' : 'north';
    }

    var projectile = {
      x: _player.x,
      y: _player.y,
      fx: _player.x,
      fy: _player.y,
      dx: dx,
      dy: dy,
      vx: vx,
      vy: vy,
      speed: 1.0,
      bounces: 3, // Multi-bounce ricochet enabled!
      glyph: _getProjectileGlyph(dirName),
      emoji: '💥',
      range: 15,
      power: 3, // Higher starting power to survive damage falloff
      owner: 'player'
    };

    // Muzzle flash at player position
    _muzzleFlash = { x: _player.x, y: _player.y, time: Date.now() };
    setTimeout(function() { _muzzleFlash = null; }, 300);

    _projectiles.push(projectile);
    // Don't advance immediately — let the game loop animate the projectile per tick.
    _saveState();

    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      _updateMobileGrid();
    }

    return {
      lines: ['FIRING ' + projectile.glyph + ' AT TARGET', ''].concat(_renderGrid()),
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

    // Initialize float coords if missing
    if (projectile.fx === undefined) projectile.fx = projectile.x;
    if (projectile.fy === undefined) projectile.fy = projectile.y;
    
    if (projectile.vx === undefined) {
      var len = Math.sqrt(projectile.dx * projectile.dx + projectile.dy * projectile.dy) || 1;
      projectile.vx = projectile.dx / len;
      projectile.vy = projectile.dy / len;
      projectile.speed = 1.0;
      projectile.bounces = projectile.bounces || 0;
    }

    var nextFx = projectile.fx + projectile.vx * (projectile.speed || 1.0);
    var nextFy = projectile.fy + projectile.vy * (projectile.speed || 1.0);
    var nextX = Math.round(nextFx);
    var nextY = Math.round(nextFy);

    if (!_isInsideBounds(nextX, nextY)) {
      // Miss - went out of bounds
      _addImpactEffect(Math.round(projectile.fx), Math.round(projectile.fy), 'miss');
      return { alive: false };
    }

    var tile = _grid[nextY][nextX];
    if (tile === TILES.WALL) {
      if ((projectile.bounces || 0) > 0) {
        // Bounce (mirror across normal)
        var curX = Math.round(projectile.fx);
        var curY = Math.round(projectile.fy);
        if (curX !== nextX && _grid[curY] && _grid[curY][nextX] === TILES.WALL) {
          projectile.vx *= -1; // Hit vertical wall
        } else if (curY !== nextY && _grid[nextY] && _grid[nextY][curX] === TILES.WALL) {
          projectile.vy *= -1; // Hit horizontal wall
        } else {
          // Corner hit
          projectile.vx *= -1;
          projectile.vy *= -1;
        }
        projectile.bounces--;
        projectile.power = Math.max(1, (projectile.power || 1) - 1); // Damage falloff per bounce
        _addImpactEffect(nextX, nextY, 'wall'); // spark effect for bounce
        
        // Don't advance position into the wall, let next tick move it along new velocity
        return { alive: true };
      } else {
        // Hit wall without bouncing
        _addImpactEffect(nextX, nextY, 'wall');
        return { alive: false };
      }
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

    projectile.fx = nextFx;
    projectile.fy = nextFy;
    projectile.x = nextX;
    projectile.y = nextY;
    projectile.range = (projectile.range || 1) - (projectile.speed || 1);

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
    // Assign visual char based on impact type for canvas rendering
    var impactChar = '💥';
    if (type === 'breakable') impactChar = '💫';
    else if (type === 'enemy') impactChar = '💥';
    else if (type === 'wall') impactChar = '✨';
    else if (type === 'miss') impactChar = '💨';
    else if (type === 'poof') impactChar = '💨';

    var effect = {
      x: x,
      y: y,
      type: type, // 'breakable', 'enemy', 'wall', 'miss', 'poof'
      char: impactChar,
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

      // Hard clamp: never allow restored player spawn to be inside walls.
      // Camera + fullscreen makes bad legacy positions very visible.
      try {
        if (_player && _grid && _grid[_player.y] && _grid[_player.y][_player.x] && _grid[_player.y][_player.x] !== TILES.EMPTY) {
          // Attempt to snap to nearest empty tile (spiral search)
          var found = false;
          for (var r = 1; r <= 10 && !found; r++) {
            for (var dy = -r; dy <= r && !found; dy++) {
              for (var dx = -r; dx <= r && !found; dx++) {
                var tx = _player.x + dx;
                var ty = _player.y + dy;
                if (tx > 0 && tx < GRID_WIDTH - 1 && ty > 0 && ty < GRID_HEIGHT - 1 && _grid[ty] && _grid[ty][tx] === TILES.EMPTY) {
                  _player.x = tx;
                  _player.y = ty;
                  found = true;
                }
              }
            }
          }
          if (!found) {
            // fall back to safe-ish center
            _player.x = Math.floor(GRID_WIDTH / 2);
            _player.y = Math.floor(GRID_HEIGHT / 2);
          }
        }
      } catch (e0) {}
      if (parsed.enemies) _enemies = parsed.enemies;
      if (parsed.items) {
        WorldItems.setFloorItems(parsed.items);
        _items = WorldItems.getFloorItems();
      }
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

    // Floor 0 scripted walk — ignore player input until auto-walk completes
    if (_scriptedWalk) return;

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

    // Route tap-to-move through smooth movement system when available
    if (typeof GoneRogueMovement !== 'undefined') {
      GoneRogueMovement.init(_player.x, _player.y);

      var collisionCheck = function(x, y) {
        return !_isWalkable(x, y);
      };

      // Terrain penalty callback used by sprint movement
      collisionCheck.getTileMovePenalty = function(x, y) {
        if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return 0;
        var tile = _grid[y][x];

        if (tile === TILES.WATER && TILE_EFFECTS.WATER) {
          return TILE_EFFECTS.WATER.movePenalty || 0;
        }

        var key = x + ',' + y;
        if (_tileMetadata[key] && _tileMetadata[key].movePenalty) {
          return _tileMetadata[key].movePenalty;
        }

        // GroundEffects movement penalty (can be negative e.g. ICE)
        if (typeof GroundEffects !== 'undefined' && typeof GroundEffects.getMovementPenalty === 'function') {
          return GroundEffects.getMovementPenalty(x, y) || 0;
        }

        return 0;
      };

      GoneRogueMovement.setTarget(targetX, targetY, collisionCheck, !!runMode);

      if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
        _updateMobileGrid();
      }

      return {
        lines: ['Moving...', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Fallback: instant single-step move
    var dx = targetX - _player.x;
    var dy = targetY - _player.y;

    // Normalize to -1, 0, or 1
    var stepX = dx === 0 ? 0 : (dx > 0 ? 1 : -1);
    var stepY = dy === 0 ? 0 : (dy > 0 ? 1 : -1);

    var moveResult = _movePlayer(stepX, stepY, runMode);

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

    // Validate every waypoint in the path is walkable — reject paths that
    // cut through walls (safety net against pathfinder fallback bugs).
    for (var pi = 0; pi < path.length; pi++) {
      if (!_isWalkable(path[pi].x, path[pi].y)) {
        // Trim path to the last walkable waypoint before the wall
        path = path.slice(0, pi);
        break;
      }
    }
    if (path.length === 0) return;

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

        // GroundEffects movement penalty (can be negative e.g. ICE)
        if (typeof GroundEffects !== 'undefined' && typeof GroundEffects.getMovementPenalty === 'function') {
          return GroundEffects.getMovementPenalty(x, y) || 0;
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
  function _maybeHintNearbyDoors() {
    try {
      if (typeof OverheadAnimator === 'undefined') return;
      var now = Date.now();
      if (now - _lastDoorHintAtMs < 350) return;

      // Scan a small radius around player for door tiles/metadata
      for (var dy = -2; dy <= 2; dy++) {
        for (var dx = -2; dx <= 2; dx++) {
          var x = _player.x + dx;
          var y = _player.y + dy;
          if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) continue;

          var tile = _grid[y] ? _grid[y][x] : null;
          if (tile !== TILES.EXIT && tile !== TILES.DOOR) continue;

          var md = _tileMetadata[x + ',' + y];
          var kind = null;
          if (md && md.type === 'door') {
            kind = md.doorKind;
          } else if (md && md.type === 'building_door') {
            kind = 'building';
          } else if (tile === TILES.EXIT) {
            kind = 'forward';
          }
          if (!kind) continue;

          var emoji = (kind === 'building') ? '↔️' :
                      (kind === 'back') ? '↩️' :
                      (kind === 'forward') ? '↪️' :
                      (kind === 'interior_exit') ? '↩️' : '↕️';
          OverheadAnimator.showGenericExpression(x, y, emoji, 650);
          _lastDoorHintAtMs = now;
          return;
        }
      }
    } catch (e0) {}
  }

  function isWalkable(x, y) {
    return _isWalkable(x, y);
  }

  function _canAffordCosts(costs) {
    if (!costs || !costs.length) return { canAfford: true, missing: [] };
    if (typeof GAMESTATE === 'undefined') return { canAfford: false, missing: costs.slice() };

    var missing = [];
    for (var i = 0; i < costs.length; i++) {
      var c = costs[i];
      if (!c || !c.kind) continue;
      var need = Number(c.amount || 0);
      if (!isFinite(need) || need <= 0) continue;

      var have = 0;
      if (c.kind === 'ammo' && typeof GAMESTATE.getAmmo === 'function') have = GAMESTATE.getAmmo();
      else if (c.kind === 'battery' && typeof GAMESTATE.getBattery === 'function') have = GAMESTATE.getBattery();
      else if (c.kind === 'energy' && typeof GAMESTATE.getEnergy === 'function') have = GAMESTATE.getEnergy();
      else if (c.kind === 'focus' && typeof GAMESTATE.getFocus === 'function') have = GAMESTATE.getFocus();

      if (have < need) missing.push({ kind: c.kind, amount: need, have: have });
    }

    return { canAfford: missing.length === 0, missing: missing };
  }

  function _consumeCosts(costs) {
    if (!costs || !costs.length) return { success: true };
    if (typeof GAMESTATE === 'undefined') return { success: false };

    // Spend each resource; if any fails, stop (best effort)
    for (var i = 0; i < costs.length; i++) {
      var c = costs[i];
      if (!c || !c.kind) continue;
      var amt = Number(c.amount || 0);
      if (!isFinite(amt) || amt <= 0) continue;

      var ok = true;
      if (c.kind === 'ammo' && typeof GAMESTATE.useAmmo === 'function') ok = GAMESTATE.useAmmo(amt).success;
      else if (c.kind === 'battery' && typeof GAMESTATE.useBattery === 'function') ok = GAMESTATE.useBattery(amt).success;
      else if (c.kind === 'energy' && typeof GAMESTATE.useEnergy === 'function') ok = GAMESTATE.useEnergy(amt).success;
      else if (c.kind === 'focus' && typeof GAMESTATE.useFocus === 'function') { GAMESTATE.useFocus(amt); ok = true; }

      if (!ok) return { success: false, failed: c };
    }

    return { success: true };
  }

  function _maybeTrigger3dPrinter(triggerCardId, triggerCard) {
    try {
      if (typeof GAMESTATE === 'undefined' || !GAMESTATE.getActiveItem) return;
      var active = GAMESTATE.getActiveItem();
      if (!active || !active.id) return;
      if (typeof GoneRogueDataRegistry === 'undefined' || !GoneRogueDataRegistry.getItem) return;

      var item = GoneRogueDataRegistry.getItem(active.id);
      if (!item || item._missing) return;

      // Identify the 3D printer via its effect tag
      var isPrinter = false;
      if (Array.isArray(item.effects)) {
        for (var i = 0; i < item.effects.length; i++) {
          if (item.effects[i] && item.effects[i].type === 'printer_3d') { isPrinter = true; break; }
        }
      }
      if (!isPrinter) return;

      // Must be armed/toggled first (primary method for consuming/using active items)
      var armed = !!(active.meta && active.meta.toggled);
      if (!armed) return;

      // Trigger only on ammo/battery spending cards (per design)
      var costs = triggerCard && Array.isArray(triggerCard.costs) ? triggerCard.costs : [];
      var spends = false;
      for (var j = 0; j < costs.length; j++) {
        var c = costs[j];
        if (!c || !c.kind) continue;
        if (c.kind === 'ammo' || c.kind === 'battery') { spends = true; break; }
      }
      if (!spends) return;

      // Determine printer quality (rarity)
      var qMap = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
      var qp = qMap[String(item.rarity || 'common').toLowerCase()];
      if (!isFinite(qp)) qp = 0;

      // Choose output quality (biased down)
      var roll = Math.random();
      var qo = 0;
      if (roll < 0.70) qo = 0;
      else if (roll < 0.88) qo = 1;
      else if (roll < 0.96) qo = 2;
      else if (roll < 0.99) qo = 3;
      else qo = 4;
      if (qo > qp) qo = qp;

      // Armed mode: duplicate the card you're interfacing with.
      var pick = triggerCard;
      if (!pick || !pick.id) return;

      // Treat output quality as the picked card's rarity for proximity math
      var qMap2 = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
      qo = qMap2[String(pick.rarity || 'common').toLowerCase()];
      if (!isFinite(qo)) qo = 0;
      if (qo > qp) qo = qp;

      // Determine print count based on quality distance
      var d = qp - qo;
      function rint(a, b) {
        a = Math.floor(a); b = Math.floor(b);
        return a + Math.floor(Math.random() * (b - a + 1));
      }
      var n = 2;
      if (d >= 3) n = rint(12, 21);
      else if (d === 2) n = rint(8, 16);
      else if (d === 1) n = rint(4, 10);
      else n = rint(1, 3);

      // Add printed cards to CH/NCH hand then overflow to backup, discarding oldest backup when full.
      if (typeof GAMESTATE.addPrintedCards === 'function') {
        GAMESTATE.addPrintedCards(pick.id, n, { preferHand: true });
      }

      // Consume the printer
      if (typeof GAMESTATE.consumeActiveItem === 'function') {
        GAMESTATE.consumeActiveItem();
      } else if (typeof GAMESTATE.clearActiveItem === 'function') {
        GAMESTATE.clearActiveItem();
      }

      if (typeof TooltipSystem !== 'undefined' && TooltipSystem.showPersistent) {
        TooltipSystem.showPersistent('🕋 DUPED x' + n + ' ' + (pick.emoji || '🃏') + ' ' + (pick.name || pick.id), 1600);
      }
    } catch (e0) {}
  }

  function playCardFromHand(cardId) {
    if (!_active || !_strCombatActive) {
      return { success: false, reason: 'not_in_combat' };
    }
    if (!cardId || typeof GoneRogueDataRegistry === 'undefined' || !GoneRogueDataRegistry.getCard) {
      return { success: false, reason: 'missing_registry' };
    }

    var card = GoneRogueDataRegistry.getCard(cardId);
    if (!card || card._missing) {
      return { success: false, reason: 'missing_card' };
    }

    var costs = Array.isArray(card.costs) ? card.costs : null;
    var affordability = _canAffordCosts(costs);
    if (!affordability.canAfford) {
      return { success: false, reason: 'insufficient_resources', missing: affordability.missing, costs: costs };
    }

    if (costs && costs.length) {
      var spent = _consumeCosts(costs);
      if (!spent.success) {
        return { success: false, reason: 'cost_spend_failed', costs: costs };
      }
    }

    // 3D printer (🕋) hook: if active, and this card spent ammo/battery, print extra cards then consume the printer.
    _maybeTrigger3dPrinter(cardId, card);

    // ── Synergy detection ──────────────────────────────────
    var synergyResult = null;
    var synergyBonuses = null;
    try {
      if (typeof SynergyIntegration !== 'undefined' && typeof SynergyIntegration.processCardPlay === 'function') {
        synergyResult = SynergyIntegration.processCardPlay(card, {
          player: _player,
          enemy: _strCombatEnemy,
          round: _strCombatRound
        });
        if (synergyResult && synergyResult.activeBonuses) {
          synergyBonuses = synergyResult.activeBonuses;
        }
      }
    } catch (eSyn) {
      console.warn('[GoneRogue] Synergy check error:', eSyn);
    }

    var lines = [];
    lines.push('🃏 ' + (card.emoji || '🃏') + ' ' + (card.name || cardId));

    // Log synergy activation
    if (synergyResult && synergyResult.synergies && synergyResult.synergies.length > 0) {
      for (var si = 0; si < synergyResult.synergies.length; si++) {
        var syn = synergyResult.synergies[si];
        lines.push('⚡ SYNERGY: ' + (syn.definition ? syn.definition.name : 'Unknown'));
      }
      // Dispatch synergy event for UI feedback
      try {
        window.dispatchEvent(new CustomEvent('rogue-synergy-triggered', {
          detail: { synergies: synergyResult.synergies, bonuses: synergyBonuses, card: card }
        }));
      } catch (eEv) {}
    }

    // Apply effects (v0 subset) — enhanced by synergy bonuses
    var _cardTriggeredFlee = false;
    var enemy = _strCombatEnemy;
    for (var i = 0; i < (card.effects || []).length; i++) {
      var eff = card.effects[i];
      if (!eff || !eff.type) continue;

      if (eff.type === 'damage') {
        var dmg = Number(eff.value || 0);
        // Apply synergy damage bonuses
        if (synergyBonuses) {
          if (synergyBonuses.damageMultiplier && synergyBonuses.damageMultiplier !== 1.0) {
            dmg = Math.floor(dmg * synergyBonuses.damageMultiplier);
          }
          if (synergyBonuses.damageBonus) {
            dmg += synergyBonuses.damageBonus;
          }
        }
        if (enemy && isFinite(dmg)) {
          enemy.hp = Math.max(0, (enemy.hp || 0) - dmg);
          lines.push('⚔️ ' + dmg + ' damage');
          if (typeof EnemyIntentSystem !== 'undefined' && enemy.intentState) {
            enemy.intentState.expression = EnemyIntentSystem.onCombatEvent(enemy, 'took_damage');
          }
        }
      } else if (eff.type === 'hp') {
        var heal = Number(eff.value || 0);
        if (isFinite(heal)) {
          _player.hp = Math.min(_player.maxHp || 10, (_player.hp || 0) + heal);
          lines.push('🩹 +' + heal + ' HP');
        }
      } else if (eff.type === 'self_damage') {
        // Self-inflicted HP damage (e.g. Cyanide Capsule)
        var selfDmg = Number(eff.value || 0);
        if (_player && isFinite(selfDmg) && selfDmg > 0) {
          _player.hp = Math.max(0, (_player.hp || 0) - selfDmg);
          lines.push('💀 -' + selfDmg + ' HP (self)');
        }
      } else if (eff.type === 'fatigue') {
        // Fatigue cost (e.g. Smoke Bomb adrenaline tax)
        var fatVal = Number(eff.value || 0);
        if (_player && isFinite(fatVal) && fatVal > 0) {
          _player.fatigue = Math.min(100, (_player.fatigue || 0) + fatVal);
          lines.push('😮‍💨 +' + fatVal + ' fatigue');
        }
      } else if (eff.type === 'noise') {
        // Noise burst (raises alert level)
        var noiseVal = Number(eff.value || 0);
        if (isFinite(noiseVal) && noiseVal > 0) {
          _alertLevel = Math.min(100, (_alertLevel || 0) + noiseVal);
          lines.push('📢 +' + noiseVal + ' noise (alert: ' + _alertLevel + ')');
        }
      } else if (eff.type === 'flee') {
        // Guaranteed escape — flag for post-effect processing
        _cardTriggeredFlee = true;
        lines.push('🏃 ESCAPE TRIGGERED');
      }
    }

    // Apply synergy post-effects (draw card, energy refund, etc.)
    if (synergyBonuses) {
      if (synergyBonuses.drawCard) {
        try {
          if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.drawOneFromBackupPerTurn === 'function') {
            var drawResult = GAMESTATE.drawOneFromBackupPerTurn();
            if (drawResult && drawResult.success) {
              lines.push('🃏 Synergy draw: +1 card from backup');
            }
          }
        } catch (eDraw) {}
      }
      if (synergyBonuses.energyRefund && synergyBonuses.energyRefund > 0) {
        try {
          if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.addEnergy === 'function') {
            GAMESTATE.addEnergy(synergyBonuses.energyRefund);
            lines.push('⚡ +' + synergyBonuses.energyRefund + ' energy refund');
          }
        } catch (eRef) {}
      }
    }

    // ── Cascade resolution ──────────────────────────────────
    if (synergyResult && synergyResult.synergies && synergyResult.synergies.length > 0) {
      try {
        if (typeof CascadeResolver !== 'undefined' && typeof CascadeResolver.resolve === 'function') {
          for (var ci = 0; ci < synergyResult.synergies.length; ci++) {
            var cascadeResult = CascadeResolver.resolve(synergyResult.synergies[ci], card, {
              player: _player,
              enemy: _strCombatEnemy,
              round: _strCombatRound
            });
            if (cascadeResult && cascadeResult.results && cascadeResult.results.length > 0) {
              for (var cr = 0; cr < cascadeResult.results.length; cr++) {
                var cEffect = cascadeResult.results[cr];
                lines.push('🔗 CASCADE: ' + (cEffect.description || cEffect.type));
                // Apply cascade effects
                if (cEffect.drawCard) {
                  var cDraw = GAMESTATE.drawOneFromBackupPerTurn();
                  if (cDraw && cDraw.success) lines.push('🃏 Cascade draw: +1 card');
                }
                if (cEffect.focusGain && typeof GAMESTATE.addFocus === 'function') {
                  GAMESTATE.addFocus(cEffect.focusGain);
                  lines.push('🧠 +' + cEffect.focusGain + ' focus');
                }
                if (cEffect.enemySkip) {
                  if (_strCombatEnemy) _strCombatEnemy._skipNextTurn = true;
                  lines.push('⏭️ Enemy will skip next turn');
                }
              }
              // Dispatch cascade event
              try {
                window.dispatchEvent(new CustomEvent('rogue-cascade-triggered', {
                  detail: { depth: cascadeResult.depth, results: cascadeResult.results, card: card }
                }));
              } catch (eCas) {}
            }
          }
        }
      } catch (eCascade) {
        console.warn('[GoneRogue] Cascade resolver error:', eCascade);
      }
    }

    var consumes = (typeof card.consumesOnPlay === 'boolean') ? card.consumesOnPlay : !(costs && costs.length);
    if (consumes) {
      // ── Flight-saver check: equipped passive may prevent consumption ──
      var saved = false;
      try {
        if (typeof PassiveItemsSystem !== 'undefined' && typeof PassiveItemsSystem.tryFlightSave === 'function') {
          saved = PassiveItemsSystem.tryFlightSave(card, card.qualityName || card.quality || '');
        }
      } catch (eSave) {}

      if (saved) {
        lines.push('🪢 SAVED! Card survives use');
      } else {
        if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.consumeCardFromHand === 'function') {
          GAMESTATE.consumeCardFromHand(cardId, 1);
        }
      }
    }

    // ── Flee exit: if any effect triggered a flee, exit combat now ──
    if (_cardTriggeredFlee) {
      // Check if self-damage killed the player before they could flee
      if (_player && _player.hp <= 0) {
        _player.hp = 0;
        lines.push('💀 Died before escaping...');
        _strCombatLog = (_strCombatLog || []).concat(lines);
        return _handlePlayerDeath('combat_damage', { enemy: _strCombatEnemy });
      }

      lines.push('');
      _strCombatLog = (_strCombatLog || []).concat(lines);
      var fleeResult = _exitStrCombat('fled');
      return { success: true, consumed: consumes && !saved, lines: lines.concat(fleeResult.lines || []), exited: true };
    }

    // End conditions (so we don't rely on the legacy per-round resolver to exit)
    if (_strCombatEnemy && _strCombatEnemy.hp <= 0) {
      lines.push('');
      lines.push('🏁 ENEMY DEFEATED');
      var exitResult = _exitStrCombat('player_victory');
      return { success: true, consumed: consumes, lines: lines.concat(exitResult.lines || []), exited: true };
    }

    if (_player && _player.hp <= 0) {
      // Clamp to prevent negative HP looping
      _player.hp = 0;
      return _handlePlayerDeath('combat_damage', { enemy: _strCombatEnemy });
    }

    _strCombatLog = (_strCombatLog || []).concat(lines);

    // Trigger re-render
    if (typeof STRCombatWindow !== 'undefined' && typeof STRCombatWindow.show === 'function') {
      STRCombatWindow.show({
        active: true,
        enemy: _strCombatEnemy,
        player: _player,
        advantage: _strCombatAdvantage,
        round: _strCombatRound,
        log: _strCombatLog
      });
    }

    return { success: true, consumed: consumes, lines: lines };
  }

  function playCardsFromHand(cardIds) {
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
    if (_animationFrameId) {
      cancelAnimationFrame(_animationFrameId);
      _animationFrameId = null;
    }
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

    // Keys: first applicable encounter = adjacent locked gate
    if (activeItem.type === 'key') {
      var locked = _findAdjacentLockedGate();
      if (locked) {
        return _attemptUnlockLockedGate(locked.x, locked.y, locked.meta, { consumeFromActiveSlot: true });
      }

      return {
        lines: ['🗝 NO LOCK IN RANGE', 'Stand next to a door/chest to use a key.', ''].concat(_renderGrid()),
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
   * Use active item at a specific grid target (drag/drop targeting)
   */
  function applyNonCombatCardAt(cardId, targetX, targetY) {
    if (!_active) return false;

    if (typeof GoneRogueDataRegistry === 'undefined' || !GoneRogueDataRegistry.getCard) {
      return false;
    }

    var card = GoneRogueDataRegistry.getCard(cardId);
    if (!card || card._missing) {
      if (typeof TooltipSystem !== 'undefined') {
        TooltipSystem.showPersistent('❌ Missing card: ' + cardId, 1200);
      }
      return false;
    }

    // v0: ground effects only (if defined)
    if ((card.targetType === 'ground' || card.targetType === 'area') && card.groundEffectId) {
      if (typeof GroundEffects !== 'undefined' && GroundEffects.setGroundEffect) {
        GroundEffects.setGroundEffect(targetX, targetY, card.groundEffectId.replace('EFF-', '')); // best-effort mapping
        if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
          _updateMobileGrid();
        }
        if (typeof TooltipSystem !== 'undefined') {
          TooltipSystem.showPersistent('🟢 DEPLOYED: ' + (card.emoji || '🃏') + ' ' + card.name, 900);
        }
        return true;
      }
    }

    // v0 fallback: preview-only
    if (typeof TooltipSystem !== 'undefined') {
      TooltipSystem.showPersistent('ℹ️ ' + (card.emoji || '🃏') + ' ' + card.name + ' (no non-combat resolver yet)', 1200);
    }

    return false;
  }

  function useActiveItemAt(targetX, targetY) {
    if (!_active) return;
    if (typeof GAMESTATE === 'undefined') return;

    var activeItem = GAMESTATE.getActiveItem ? GAMESTATE.getActiveItem() : null;
    if (!activeItem) {
      return {
        lines: ['NO ACTIVE ITEM', 'Equip an item first', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Keys: resolve lock near target, but enforce player proximity
    if (activeItem.type === 'key') {
      var lock = _findLockedGateNearTarget(targetX, targetY, 1);
      if (!lock) {
        return {
          lines: ['NO LOCK AT TARGET', 'Drag onto a door/chest tile to use a key.', ''].concat(_renderGrid()),
          prompt: getPrompt(),
          stayActive: true
        };
      }

      var dist = Math.abs(lock.x - _player.x) + Math.abs(lock.y - _player.y);
      if (dist > 1) {
        return {
          lines: ['TOO FAR', 'Stand next to the lock to use a key.', ''].concat(_renderGrid()),
          prompt: getPrompt(),
          stayActive: true
        };
      }

      return _attemptUnlockLockedGate(lock.x, lock.y, lock.meta, { consumeFromActiveSlot: true });
    }

    // Non-key items: fall back to existing "first applicable" targeting
    return triggerActiveItem();
  }

  function _findLockedGateNearTarget(tx, ty, radius) {
    radius = (typeof radius === 'number') ? radius : 1;
    for (var dy = -radius; dy <= radius; dy++) {
      for (var dx = -radius; dx <= radius; dx++) {
        var x = tx + dx;
        var y = ty + dy;
        var key = x + ',' + y;
        var meta = _tileMetadata[key];
        if (meta && meta.type === 'locked_gate') {
          return { x: x, y: y, meta: meta };
        }
      }
    }
    return null;
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
      var healAmount = 20 + Math.floor(_rng() * 11); // 20-30 HP
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
      if (_rng() < 0.3) {
        _strCombatLog.push('☢️  TOXIC WASTE EXPOSURE!');
        _strCombatLog.push('└─ Random debuff applied');
        // Could implement specific debuffs here
      }
    }
    // WATER: Movement penalty, reduced evasion
    else if (effect.type === 'WATER') {
      _strCombatLog.push('💧 Standing in water: -10% evasion');
    }
    // ICE: speed boost but slippery
    else if (effect.type === 'ICE') {
      var accPen = (effect.accuracyPenaltyPct != null) ? effect.accuracyPenaltyPct : 12;
      var evPen = (effect.evasionPenaltyPts != null) ? effect.evasionPenaltyPts : 2;
      _player.tempAccuracyBoost = (_player.tempAccuracyBoost || 0) - accPen;
      _player.tempEvasion = (_player.tempEvasion || 0) - evPen;
      _strCombatLog.push('🧊 ICE: speed up, but slip risk');
      _strCombatLog.push('└─ Accuracy -' + accPen + '%, Evasion -' + evPen);
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
      if (_rng() < 0.3) {
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

      if (ammo <= 0)                               warnings.push('⁍ no ammo');
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
      WorldItems.setFloorItems(state.items ? state.items.slice() : []);
      _items = WorldItems.getFloorItems();
      WorldItems.setCurrencies(state.currencies ? state.currencies.slice() : []);
      _currencies = WorldItems.getCurrencies();
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
  // PET SYSTEM DEBUG
  // ============================================================

  /**
   * Spawn test pets for debugging (one of each tier)
   */
  function spawnTestPets() {
    if (typeof PetFollower === 'undefined') {
      console.warn('[GoneRogue] PetFollower module not available');
      return;
    }

    // Create test pets
    var pikachuPet = PetFollower.createPet(
      PetFollower.PET_TIERS.RUMBA,
      'UNCOMMON',
      '🐭',
      'Pikachu',
      { scrapProc: 0.02, dropChance: 0.05 }
    );

    var humanoidPet = PetFollower.createPet(
      PetFollower.PET_TIERS.HUMANOID,
      'RARE',
      '🧍',
      'Breaker',
      null
    );

    var tanyaPet = PetFollower.createPet(
      PetFollower.PET_TIERS.MEGA,
      'MEGA',
      '🔫',
      'Tanya',
      null
    );

    // Initialize pets at player position
    pikachuPet.x = _player.x;
    pikachuPet.y = _player.y;
    humanoidPet.x = _player.x;
    humanoidPet.y = _player.y;
    tanyaPet.x = _player.x;
    tanyaPet.y = _player.y;

    // Add pets
    PetFollower.addPet(pikachuPet);
    PetFollower.addPet(humanoidPet);
    PetFollower.addPet(tanyaPet);

    console.log('[GoneRogue] Test pets spawned: Pikachu (Rumba), Breaker (Humanoid), Tanya (Mega)');
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

