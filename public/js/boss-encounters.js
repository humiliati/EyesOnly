/* ============================================================
   EYES ONLY - Boss Encounter System
   Arcade-style boss fights with mythic conditions
   ============================================================ */

const BossEncounters = (function () {
  'use strict';

  // Boss phases
  var BOSS_PHASES = {
    IDLE: 'IDLE',
    PATTERN: 'PATTERN',
    TELEGRAPH: 'TELEGRAPH',
    PUNISHMENT: 'PUNISHMENT',
    EXPLOIT_WINDOW: 'EXPLOIT_WINDOW',
    VULNERABLE: 'VULNERABLE'
  };

  /**
   * Base Boss Encounter Class
   */
  class BossEncounter {
    constructor(type, floorDepth) {
      this.type = type;
      this.floorDepth = floorDepth;
      this.phase = BOSS_PHASES.IDLE;
      this.mythicConditionMet = false;
      this.mythicTracker = {}; // Tracks specific conditions for mythic loot
      this.lootDropped = false;
      this.hp = 50; // Base boss HP
      this.maxHp = 50;
      this.patternCycle = 0;
      this.vulnerableTimer = 0;
      this.telegraphMessage = '';
      this.bossEntity = null; // Reference to the enemy object in game
    }

    /**
     * Initialize boss state on floor
     */
    initialize(grid, player) {
      // Override in subclass
      return { success: true };
    }

    /**
     * The "Readable" Telegraph
     */
    telegraphMove(moveType) {
      this.phase = BOSS_PHASES.TELEGRAPH;
      this.telegraphMessage = `[BOSS] ${this.type} preparing ${moveType}...`;
      return this.telegraphMessage;
    }

    /**
     * Execute pattern (standard boss attack)
     */
    executePattern() {
      this.phase = BOSS_PHASES.PATTERN;
      this.patternCycle++;
      return this.calculateDamage();
    }

    /**
     * Calculate damage dealt
     */
    calculateDamage() {
      // Base damage calculation
      return Math.floor(5 + this.floorDepth * 0.5);
    }

    /**
     * Check if exploit conditions are met
     */
    checkExploit(playerAction, gameState) {
      // Override in subclass
      return false;
    }

    /**
     * Enter vulnerable state (player successfully exploited)
     */
    enterVulnerableState(duration = 3) {
      this.phase = BOSS_PHASES.VULNERABLE;
      this.vulnerableTimer = duration;
      return { vulnerable: true, duration: duration };
    }

    /**
     * Track mythic condition
     */
    trackMythicCondition(event) {
      if (event === this.mythicTrigger) {
        this.mythicConditionMet = true;
        return { mythic: true, message: '⚡ A strange energy shifts...' };
      }
      return { mythic: false };
    }

    /**
     * Update boss state each turn
     */
    update(gameState) {
      if (this.vulnerableTimer > 0) {
        this.vulnerableTimer--;
        if (this.vulnerableTimer === 0) {
          this.phase = BOSS_PHASES.IDLE;
        }
      }
      return { phase: this.phase };
    }

    /**
     * Take damage
     */
    takeDamage(amount, source) {
      this.hp = Math.max(0, this.hp - amount);
      if (this.hp <= 0) {
        return this.onDefeat(source);
      }
      return { defeated: false, hp: this.hp };
    }

    /**
     * Boss defeated
     */
    onDefeat(source) {
      return {
        defeated: true,
        loot: this.generateLoot(),
        mythic: this.mythicConditionMet
      };
    }

    /**
     * Generate boss loot
     */
    generateLoot() {
      var loot = [];

      // Guaranteed rare card drop
      loot.push({
        type: 'card',
        quality: 'ELITE',
        guaranteed: true
      });

      // Whisper drop (3-5% chance)
      if (Math.random() < 0.05) {
        loot.push({
          type: 'whisper',
          item: this.whisperItem
        });
      }

      // Mythic conditional drop
      if (this.mythicConditionMet) {
        loot.push({
          type: 'mythic',
          item: this.mythicDrop,
          guaranteed: true
        });
      } else {
        // Rumor hint (10% chance if mythic condition not met)
        if (Math.random() < 0.10) {
          loot.push({
            type: 'rumor',
            message: this.mythicHint
          });
        }
      }

      return loot;
    }
  }

  /**
   * Depot Crossing Boss (Frogger-style with train hazards)
   */
  class DepotCrossingBoss extends BossEncounter {
    constructor(floorDepth) {
      super('DEPOT_WARDEN', floorDepth);
      this.hp = 60;
      this.maxHp = 60;
      this.mythicTrigger = 'TRAIN_IMPACT_KILL';
      this.mythicHint = 'RUMOR: If only the Warden had met a harsher fate...';
      this.whisperItem = 'Conductor\'s Whistle';
      this.mythicDrop = 'Railyard Overpass Blueprint';

      // Train lanes configuration
      this.lanes = [
        { direction: 'RIGHT', speed: 2, type: 'FREIGHT', position: 0 },
        { direction: 'LEFT', speed: 4, type: 'PATROL_DRONE', position: 0 },
        { direction: 'RIGHT', speed: 1, type: 'CHEMICAL_TRANSPORT', position: 0 }
      ];
      this.safeZones = [3, 7, 12]; // Y-coordinates of safe zones
      this.trainPositions = []; // Array of current train positions
    }

    initialize(grid, player) {
      // Create train lanes in the arena
      this.trainPositions = [];
      this.lanes.forEach((lane, idx) => {
        var laneY = 6 + (idx * 4); // Space lanes vertically
        this.trainPositions.push({
          x: lane.direction === 'RIGHT' ? 0 : 39,
          y: laneY,
          direction: lane.direction,
          speed: lane.speed,
          type: lane.type,
          length: 5 // Train is 5 tiles long
        });
      });

      // Place boss on opposite side of tracks
      this.bossPosition = { x: 35, y: 10 };

      return { success: true, lanes: this.trainPositions };
    }

    updateTrains(deltaTime) {
      // Move trains along their lanes
      this.trainPositions.forEach(train => {
        if (train.direction === 'RIGHT') {
          train.x += train.speed;
          if (train.x > 45) train.x = -5; // Wrap around
        } else {
          train.x -= train.speed;
          if (train.x < -5) train.x = 45; // Wrap around
        }
      });
    }

    checkTrainCollision(x, y) {
      // Check if position intersects with any train
      for (let train of this.trainPositions) {
        if (y === train.y) {
          var trainStart = train.x;
          var trainEnd = train.x + train.length;
          if (x >= trainStart && x <= trainEnd) {
            return { collision: true, damage: 999, message: 'CRUSHED BY TRAIN' };
          }
        }
      }
      return { collision: false };
    }

    checkExploit(playerAction, gameState) {
      // THE EXPLOIT: Luring boss into train path
      if (playerAction.type === 'LURE' && playerAction.target === 'TRAIN_PATH') {
        var bossInPath = this.checkTrainCollision(this.bossPosition.x, this.bossPosition.y);
        if (bossInPath.collision) {
          this.takeDamage(50, 'TRAIN_IMPACT');
          this.trackMythicCondition('TRAIN_IMPACT_KILL');
          return {
            exploited: true,
            message: '🚂 BOSS HIT BY TRAIN!',
            damage: 50
          };
        }
      }
      return { exploited: false };
    }

    executePattern() {
      // Boss fires sniper shot from across tracks
      this.telegraphMove('SNIPER_SHOT');
      return {
        type: 'ATTACK',
        damage: this.calculateDamage(),
        message: 'Warden takes aim with precision rifle!'
      };
    }
  }

  /**
   * Sentry Nest Boss (Swarm Tower)
   */
  class SentryNestBoss extends BossEncounter {
    constructor(floorDepth) {
      super('SWARM_TOWER', floorDepth);
      this.hp = 80;
      this.maxHp = 80;
      this.mythicTrigger = 'NO_STR_ENTERED';
      this.mythicHint = 'RUMOR: The swarm never touched a single ghost...';
      this.whisperItem = 'Hive Node Fragment';
      this.mythicDrop = 'Perfect Stealth Theorem';

      this.spawnPods = [
        { x: 0, y: 0, hp: 5, active: true },
        { x: 0, y: 0, hp: 5, active: true },
        { x: 0, y: 0, hp: 5, active: true }
      ];
      this.swarmCount = 0;
      this.maxSwarm = 50;
      this.combatEntriesAtStart = 0;
    }

    initialize(grid, player) {
      // Place spawn pods around the arena
      this.spawnPods[0].x = 10;
      this.spawnPods[0].y = 5;
      this.spawnPods[1].x = 30;
      this.spawnPods[1].y = 5;
      this.spawnPods[2].x = 20;
      this.spawnPods[2].y = 15;

      // Place boss tower in center
      this.bossPosition = { x: 20, y: 10 };

      // Track combat entries at start
      this.combatEntriesAtStart = player.combatEntries || 0;

      return { success: true, pods: this.spawnPods };
    }

    spawnMinion() {
      if (this.swarmCount >= this.maxSwarm) return null;

      // Spawn from active pods
      var activePods = this.spawnPods.filter(p => p.active && p.hp > 0);
      if (activePods.length === 0) return null;

      var pod = activePods[Math.floor(Math.random() * activePods.length)];
      this.swarmCount++;

      return {
        x: pod.x,
        y: pod.y,
        hp: 1,
        type: 'SWARM_MINION',
        weak: true
      };
    }

    checkExploit(playerAction, gameState) {
      // THE EXPLOIT: Destroying spawn pods reduces boss shield
      if (playerAction.type === 'EXPLOSIVE_SHOT' || playerAction.type === 'GRENADE') {
        var targetX = playerAction.targetX;
        var targetY = playerAction.targetY;

        for (let pod of this.spawnPods) {
          var dist = Math.abs(pod.x - targetX) + Math.abs(pod.y - targetY);
          if (dist <= 2 && pod.hp > 0) {
            pod.hp -= 2;
            if (pod.hp <= 0) {
              pod.active = false;
              return {
                exploited: true,
                message: '💥 SPAWN POD DESTROYED! Boss shield weakened!',
                shieldDown: true
              };
            }
          }
        }
      }
      return { exploited: false };
    }

    onDefeat(source) {
      // Check mythic condition: never entered STR combat
      var player = source;
      if (player && player.combatEntries === this.combatEntriesAtStart) {
        this.trackMythicCondition('NO_STR_ENTERED');
      }

      return super.onDefeat(source);
    }
  }

  /**
   * Bunker Commandant Boss (Whack-a-mole)
   */
  class BunkerCommandantBoss extends BossEncounter {
    constructor(floorDepth) {
      super('BUNKER_COMMANDANT', floorDepth);
      this.hp = 70;
      this.maxHp = 70;
      this.mythicTrigger = 'MELEE_KILL_NO_BUNKERS';
      this.mythicHint = 'RUMOR: Strip away all cover, then strike close...';
      this.whisperItem = 'Fortified Helmet';
      this.mythicDrop = 'Demolition Expert License';

      // 3x3 grid of bunkers
      this.bunkers = [];
      for (let i = 0; i < 9; i++) {
        this.bunkers.push({
          x: 15 + (i % 3) * 5,
          y: 5 + Math.floor(i / 3) * 5,
          destroyed: false,
          hp: 3
        });
      }
      this.currentBunker = 0;
      this.popUpTimer = 0;
    }

    initialize(grid, player) {
      this.currentBunker = Math.floor(Math.random() * 9);
      this.popUpTimer = 3;
      return { success: true, bunkers: this.bunkers };
    }

    update(gameState) {
      super.update(gameState);

      // Boss pops up at random bunker
      this.popUpTimer--;
      if (this.popUpTimer <= 0) {
        var availableBunkers = this.bunkers
          .map((b, i) => ({ bunker: b, index: i }))
          .filter(item => !item.bunker.destroyed);

        if (availableBunkers.length > 0) {
          var choice = availableBunkers[Math.floor(Math.random() * availableBunkers.length)];
          this.currentBunker = choice.index;
          this.popUpTimer = 3;
        }
      }

      return { phase: this.phase, bunker: this.currentBunker };
    }

    checkExploit(playerAction, gameState) {
      // THE EXPLOIT: Destroy bunkers with grenades/explosives
      if (playerAction.type === 'GRENADE' || playerAction.type === 'EXPLOSIVE_SHOT') {
        var targetX = playerAction.targetX;
        var targetY = playerAction.targetY;

        for (let bunker of this.bunkers) {
          var dist = Math.abs(bunker.x - targetX) + Math.abs(bunker.y - targetY);
          if (dist <= 2 && !bunker.destroyed) {
            bunker.hp--;
            if (bunker.hp <= 0) {
              bunker.destroyed = true;
              return {
                exploited: true,
                message: '💥 BUNKER DESTROYED! Boss has fewer hiding spots!',
                bunkerDown: true
              };
            }
          }
        }
      }
      return { exploited: false };
    }

    onDefeat(source) {
      // Check mythic: all bunkers destroyed + melee kill
      var allBunkersDestroyed = this.bunkers.every(b => b.destroyed);
      if (allBunkersDestroyed && source.lastCardType === 'MELEE') {
        this.trackMythicCondition('MELEE_KILL_NO_BUNKERS');
      }

      return super.onDefeat(source);
    }
  }

  /**
   * Mainframe Core Boss (Logic Puzzle)
   */
  class MainframeCoreBoss extends BossEncounter {
    constructor(floorDepth) {
      super('MAINFRAME_CORE', floorDepth);
      this.hp = 50;
      this.maxHp = 50;
      this.mythicTrigger = 'VIRUS_KILL_ALL_BLUE';
      this.mythicHint = 'RUMOR: Synchronize the grid perfectly, then deliver the payload...';
      this.whisperItem = 'Quantum Decryption Key';
      this.mythicDrop = 'Zero-Day Exploit Archive';

      // 8 firewall nodes around core
      this.nodes = [];
      for (let i = 0; i < 8; i++) {
        this.nodes.push({
          position: i,
          state: 'RED', // RED (active/dangerous) or BLUE (safe)
          rotationPhase: i % 4 // Nodes rotate in patterns
        });
      }
      this.coreVulnerable = false;
    }

    initialize(grid, player) {
      this.bossPosition = { x: 20, y: 10 };
      return { success: true, nodes: this.nodes };
    }

    update(gameState) {
      super.update(gameState);

      // Rotate node states in predictable pattern
      this.nodes.forEach((node, idx) => {
        node.rotationPhase = (node.rotationPhase + 1) % 4;
        node.state = (node.rotationPhase === 0 || node.rotationPhase === 2) ? 'RED' : 'BLUE';
      });

      // Check if all nodes are BLUE
      this.coreVulnerable = this.nodes.every(n => n.state === 'BLUE');

      return { phase: this.phase, vulnerable: this.coreVulnerable };
    }

    checkExploit(playerAction, gameState) {
      // THE EXPLOIT: Use logic/hacking cards to manipulate nodes
      if (playerAction.type === 'JAMMER' || playerAction.type === 'LOGIC_HACK') {
        var targetNode = playerAction.targetNode;
        if (targetNode >= 0 && targetNode < 8) {
          // Invert node state
          this.nodes[targetNode].state = this.nodes[targetNode].state === 'RED' ? 'BLUE' : 'RED';
          return {
            exploited: true,
            message: `🔧 NODE ${targetNode} ${this.nodes[targetNode].state}!`,
            nodeFlipped: true
          };
        }
      }
      return { exploited: false };
    }

    onDefeat(source) {
      // Check mythic: all nodes BLUE + virus card kill
      var allBlue = this.nodes.every(n => n.state === 'BLUE');
      if (allBlue && source.lastCardType === 'VIRUS') {
        this.trackMythicCondition('VIRUS_KILL_ALL_BLUE');
      }

      return super.onDefeat(source);
    }
  }

  /**
   * Orbital Carrier Boss (Galaga-style shooter)
   */
  class OrbitalCarrierBoss extends BossEncounter {
    constructor(floorDepth) {
      super('ORBITAL_CARRIER', floorDepth);
      this.hp = 90;
      this.maxHp = 90;
      this.mythicTrigger = 'CARRIER_KILL_DRONES_ALIVE';
      this.mythicHint = 'RUMOR: The boldest strike through the swarm itself...';
      this.whisperItem = 'Fighter Wing Insignia';
      this.mythicDrop = 'Orbital Strike Coordinates';

      this.drones = [];
      this.maxDrones = 12;
      this.railgunTimer = 3;
      this.dronePattern = 0;
    }

    initialize(grid, player) {
      // Spawn initial drone formation
      for (let i = 0; i < 6; i++) {
        this.drones.push({
          x: 10 + (i * 5),
          y: 3,
          hp: 2,
          pattern: 'WEAVE'
        });
      }

      // Place carrier at top
      this.bossPosition = { x: 20, y: 1 };

      return { success: true, drones: this.drones };
    }

    update(gameState) {
      super.update(gameState);

      // Move drones in weaving pattern
      this.drones.forEach(drone => {
        drone.y += 0.5;
        drone.x += Math.sin(drone.y * 0.5) * 2;

        // Respawn at top if moved off screen
        if (drone.y > 20) {
          drone.y = 3;
          drone.x = Math.random() * 40;
        }
      });

      // Railgun attack timer
      this.railgunTimer--;
      if (this.railgunTimer <= 0) {
        this.railgunTimer = 3;
        return { phase: BOSS_PHASES.PATTERN, attack: 'RAILGUN' };
      }

      return { phase: this.phase };
    }

    checkExploit(playerAction, gameState) {
      // THE EXPLOIT: Jammer freezes drone patterns, High Ground bypasses drones
      if (playerAction.type === 'JAMMER') {
        this.drones.forEach(d => d.frozen = true);
        return {
          exploited: true,
          message: '📡 DRONES FROZEN! Easy targets!',
          dronesJammed: true
        };
      }

      if (playerAction.type === 'HIGH_GROUND' && playerAction.target === 'CARRIER') {
        // Direct hit to carrier through drone shield
        return {
          exploited: true,
          message: '🎯 PIERCING SHOT! Hit carrier directly!',
          bypassShield: true,
          damage: 15
        };
      }

      return { exploited: false };
    }

    onDefeat(source) {
      // Check mythic: kill carrier while drones still alive
      var dronesAlive = this.drones.filter(d => d.hp > 0).length;
      if (dronesAlive >= 4) {
        this.trackMythicCondition('CARRIER_KILL_DRONES_ALIVE');
      }

      return super.onDefeat(source);
    }
  }

  /**
   * Treasure Goblin King Boss (Secret Floor - Goblin Vault)
   * Fast chaotic fight with insane loot
   */
  class TreasureGoblinKingBoss extends BossEncounter {
    constructor(floorDepth) {
      super('TREASURE_GOBLIN_KING', floorDepth);
      this.hp = 30;
      this.maxHp = 30;
      this.mythicTrigger = 'CATCH_ALL_GOBLINS';
      this.mythicHint = 'RUMOR: Not a single coin should escape your grasp...';
      this.whisperItem = 'Goblin Crown';
      this.mythicDrop = 'Infinite Loot Charm';

      this.portals = [];
      this.stolenItems = [];
      this.clones = 1;
      this.teleportTimer = 2;
      this.speed = 2; // Moves twice per turn
    }

    initialize(grid, player) {
      // Spawn at random position
      this.bossPosition = {
        x: Math.floor(Math.random() * 30) + 5,
        y: Math.floor(Math.random() * 15) + 3
      };

      // Create initial portals
      for (let i = 0; i < 4; i++) {
        this.portals.push({
          x: Math.floor(Math.random() * 40),
          y: Math.floor(Math.random() * 20),
          active: true
        });
      }

      return { success: true, portals: this.portals };
    }

    update(gameState) {
      super.update(gameState);

      // Teleport frequently
      this.teleportTimer--;
      if (this.teleportTimer <= 0) {
        this.teleportTimer = 2;

        // Pick random portal
        var activePortals = this.portals.filter(p => p.active);
        if (activePortals.length > 0) {
          var portal = activePortals[Math.floor(Math.random() * activePortals.length)];
          this.bossPosition = { x: portal.x, y: portal.y };
        }

        // Maybe steal an item
        if (Math.random() < 0.3 && gameState.player && gameState.player.inventory) {
          var items = gameState.player.inventory;
          if (items.length > 0) {
            var stolen = items[Math.floor(Math.random() * items.length)];
            this.stolenItems.push(stolen);
            return {
              phase: BOSS_PHASES.PATTERN,
              attack: 'STEAL',
              stolenItem: stolen
            };
          }
        }
      }

      // Multiply if ignored (low HP)
      if (this.hp < this.maxHp * 0.5 && this.clones < 3) {
        this.clones++;
        return {
          phase: BOSS_PHASES.PATTERN,
          attack: 'MULTIPLY',
          clones: this.clones
        };
      }

      return { phase: this.phase };
    }

    checkExploit(playerAction, gameState) {
      // Exploit: Close portals to trap him
      if (playerAction.type === 'JAMMER' || playerAction.type === 'LOGIC_HACK') {
        this.portals.forEach(p => p.active = false);
        this.teleportTimer = 99; // Can't teleport
        return {
          exploited: true,
          message: '🚫 PORTALS SEALED! The goblin is trapped!',
          trappedGoblin: true
        };
      }

      return { exploited: false };
    }

    onDefeat(source) {
      // Always drops insane loot
      var lootMultiplier = 5 + this.clones;

      // Return stolen items
      return {
        ...super.onDefeat(source),
        stolenItems: this.stolenItems,
        lootMultiplier: lootMultiplier,
        specialDrop: 'Goblin Hoard'
      };
    }
  }

  /**
   * Uber Mega Hidden Boss (Secret Floor - Reality Breaker)
   * System-breaking difficulty that feels like you weren't meant to be here
   */
  class UberMegaBoss extends BossEncounter {
    constructor(floorDepth) {
      super('UBER_MEGA', floorDepth);
      this.hp = 100;
      this.maxHp = 100;
      this.mythicTrigger = 'SURVIVE_WITHOUT_SAVES';
      this.mythicHint = 'RUMOR: Those who face the void with nothing... may become everything...';
      this.whisperItem = 'Fragment of Reality';
      this.mythicDrop = 'Impossible Binary Charm';

      this.realityPhase = 0;
      this.rulesBroken = [];
      this.controlsReversed = false;
      this.lootEnemies = [];
      this.goldStolen = 0;
      this.dimensionShift = false;
    }

    initialize(grid, player) {
      this.bossPosition = { x: 20, y: 10 };

      // Start reality breaking effects
      this.rulesBroken.push('UI_FLICKER');
      this.rulesBroken.push('SAVE_DISABLED');
      this.rulesBroken.push('VENDOR_HOSTILE');

      return {
        success: true,
        realityBreak: true,
        warnings: [
          '⚠️⚠️⚠️ REALITY INTEGRITY: 12%',
          '⚠️⚠️⚠️ SAVE FUNCTIONS: OFFLINE',
          '⚠️⚠️⚠️ YOU SHOULD NOT BE HERE',
          ''
        ]
      };
    }

    update(gameState) {
      super.update(gameState);

      this.realityPhase++;

      // Reality breaking attacks
      if (this.realityPhase % 3 === 0) {
        // Reverse controls temporarily
        if (!this.controlsReversed && Math.random() < 0.3) {
          this.controlsReversed = true;
          setTimeout(() => { this.controlsReversed = false; }, 3000);
          return {
            phase: BOSS_PHASES.PATTERN,
            attack: 'REVERSE_CONTROLS',
            duration: 3000
          };
        }
      }

      if (this.realityPhase % 5 === 0) {
        // Turn loot into enemies
        if (gameState.items && gameState.items.length > 0) {
          var item = gameState.items[0];
          this.lootEnemies.push({
            x: item.x,
            y: item.y,
            corrupted: true
          });
          return {
            phase: BOSS_PHASES.PATTERN,
            attack: 'CORRUPT_LOOT',
            position: { x: item.x, y: item.y }
          };
        }
      }

      if (this.realityPhase % 7 === 0) {
        // Steal gold to heal
        if (gameState.player && gameState.player.gold > 0) {
          var stolen = Math.min(500, gameState.player.gold);
          this.goldStolen += stolen;
          this.hp = Math.min(this.maxHp, this.hp + Math.floor(stolen / 50));
          return {
            phase: BOSS_PHASES.PATTERN,
            attack: 'GOLD_DRAIN',
            goldStolen: stolen,
            hpHealed: Math.floor(stolen / 50)
          };
        }
      }

      // Shift between real-time and STR
      if (this.realityPhase % 10 === 0) {
        this.dimensionShift = !this.dimensionShift;
        return {
          phase: BOSS_PHASES.PATTERN,
          attack: 'DIMENSION_SHIFT',
          toSTR: this.dimensionShift
        };
      }

      return { phase: this.phase };
    }

    checkExploit(playerAction, gameState) {
      // THE ONLY EXPLOIT: Accept the chaos and don't fight it
      // Using certain "acceptance" cards
      if (playerAction.type === 'DIVE_COVER' || playerAction.type === 'PRONE') {
        // "Accepting" the reality break makes you invulnerable briefly
        return {
          exploited: true,
          message: '⚡ REALITY ACCEPTED... YOU PHASE THROUGH ATTACKS',
          invulnerable: true,
          duration: 2
        };
      }

      return { exploited: false };
    }

    onDefeat(source) {
      return {
        ...super.onDefeat(source),
        realityRestored: true,
        impossibleDrop: 'Impossible Binary Charm',
        permanentUnlock: 'UBER_SURVIVOR',
        worldStateChange: true,
        message: '⚡⚡⚡ REALITY STABILIZING... WHAT HAVE YOU DONE?'
      };
    }
  }

  /**
   * Asteroids Boss — Gravity Anchor (movement-locked dodging with card offense)
   *
   * Real-time hook: updateRealTime(elapsedMs, gameState) injects incoming
   * asteroid hazards into the game's existing projectile list via the
   * returned {bossProjectiles} array.  The gone-rogue.js game loop pushes
   * these onto _projectiles each tick so the normal collision pipeline handles
   * them without any new engine code.
   *
   * Exploit: Fragment Shower card clears a radius of active asteroids.
   * Mythic:  Survive three consecutive asteroid waves without taking damage.
   */
  class AsteroidsBoss extends BossEncounter {
    constructor(floorDepth) {
      super('ASTEROID_FIELD', floorDepth);
      this.hp = 75;
      this.maxHp = 75;
      this.mythicTrigger = 'THREE_WAVES_NO_DAMAGE';
      this.mythicHint = 'RUMOR: Survive the field untouched three times and the void answers...';
      this.whisperItem = 'Debris Fragment';
      this.mythicDrop = 'Void Trajectory Chart';

      this.playerMoveLocked = true; // Core mechanic: player cannot walk
      this.currentWave = 0;
      this.waveAsteroids = []; // Active asteroid descriptors (grid-space)
      this.wavesWithoutDamage = 0;
      this.shieldHits = 0;
      this.shieldStrength = 3; // Clear 3 waves to expose boss
      this.waveTurnTimer = 0;
      this.waveInterval = 5; // Turns between waves
    }

    initialize(grid, player) {
      this.bossPosition = { x: 20, y: 2 };
      this._spawnWave();
      return {
        success: true,
        playerMoveLocked: true,
        message: '⚠️ GRAVITY ANCHOR ENGAGED — MOVEMENT DISABLED',
        asteroids: this.waveAsteroids
      };
    }

    _spawnWave() {
      this.currentWave++;
      this.waveAsteroids = [];
      var count = Math.min(3 + this.currentWave, 8);
      for (var i = 0; i < count; i++) {
        // Asteroids always fall from top towards bottom centre
        this.waveAsteroids.push({
          id: i,
          x: 5 + Math.floor(Math.random() * 30),
          y: 0,
          dx: (Math.random() < 0.5 ? 1 : -1),
          dy: 1,
          range: 20,
          power: 2,
          glyph: '🌑',
          owner: 'boss',
          source: 'asteroid'
        });
      }
    }

    // Called by gone-rogue.js _updateGameState each tick.
    // Returns {bossProjectiles} to be merged into the existing _projectiles array.
    updateRealTime(elapsedMs, gameState) {
      this.waveTurnTimer++;
      var bossProjectiles = [];

      if (this.waveTurnTimer >= this.waveInterval) {
        this.waveTurnTimer = 0;
        var allGone = this.waveAsteroids.length === 0;
        if (allGone) {
          this.wavesWithoutDamage++;
          this.shieldHits++;
          if (this.wavesWithoutDamage >= 3) {
            this.trackMythicCondition('THREE_WAVES_NO_DAMAGE');
          }
          if (this.shieldHits >= this.shieldStrength) {
            this.enterVulnerableState(4);
          }
        } else {
          this.wavesWithoutDamage = 0;
        }
        this._spawnWave();
        bossProjectiles = this.waveAsteroids.slice();
      }

      return { bossProjectiles: bossProjectiles };
    }

    checkExploit(playerAction, gameState) {
      // Fragment Shower: AOE clears nearby asteroids by removing them from the wave list
      if (playerAction.type === 'FRAGMENT_SHOWER') {
        var tx = playerAction.targetX || 20;
        var ty = playerAction.targetY || 10;
        var cleared = 0;
        this.waveAsteroids = this.waveAsteroids.filter(function(a) {
          var dist = Math.abs(a.x - tx) + Math.abs(a.y - ty);
          if (dist <= 4) { cleared++; return false; }
          return true;
        });
        if (cleared > 0) {
          return { exploited: true, message: '💫 FRAGMENT SHOWER! ' + cleared + ' asteroids cleared!', cleared: cleared };
        }
      }
      return { exploited: false };
    }

    onDefeat(source) {
      return Object.assign(super.onDefeat(source), {
        playerMoveLocked: false,
        message: '🌌 GRAVITY ANCHOR DISENGAGED'
      });
    }
  }

  /**
   * Tower Offense Boss — Fortress Core (player assaults a static saturating boss)
   *
   * The boss fires escalating volleys each turn.  Volley size shrinks as the
   * boss takes damage — aggressive offense is the optimal strategy.
   * Suppression Fire card suppresses the next volley entirely.
   * Mythic: kill before the boss reaches phase 3 (≤33% HP).
   */
  class TowerOffenseBoss extends BossEncounter {
    constructor(floorDepth) {
      super('FORTRESS_CORE', floorDepth);
      this.hp = 85;
      this.maxHp = 85;
      this.mythicTrigger = 'KILL_BEFORE_PHASE3';
      this.mythicHint = 'RUMOR: Strike before the third volley and the fortress crumbles fully...';
      this.whisperItem = 'Defensive Matrix Shard';
      this.mythicDrop = 'Siege Breaker Doctrine';

      this.volleyInterval = 3; // Turns between volleys
      this.volleyTimer = 0;
      this.suppressedTurns = 0; // Turns with fire suppressed
      this.totalVolleysFired = 0;
      this.phase3Reached = false;
    }

    initialize(grid, player) {
      this.bossPosition = { x: 20, y: 2 };
      this.volleyTimer = this.volleyInterval;
      return { success: true, bossPosition: this.bossPosition };
    }

    _getVolleySize() {
      var hpRatio = this.hp / this.maxHp;
      if (hpRatio > 0.66) return 2;
      if (hpRatio > 0.33) return 4;
      return 6;
    }

    // Called each tick by gone-rogue.js game loop.
    updateRealTime(elapsedMs, gameState) {
      return { bossProjectiles: [] }; // Turn-based volleys handled in update()
    }

    update(gameState) {
      super.update(gameState);

      // Track when HP crosses into phase 3 territory
      if (!this.phase3Reached && this.hp / this.maxHp <= 0.33) {
        this.phase3Reached = true;
      }

      if (this.suppressedTurns > 0) {
        this.suppressedTurns--;
        return { phase: this.phase, message: '🔇 Boss reload suppressed!' };
      }

      this.volleyTimer--;
      if (this.volleyTimer <= 0) {
        this.volleyTimer = this.volleyInterval;
        this.totalVolleysFired++;
        var count = this._getVolleySize();
        return {
          phase: BOSS_PHASES.PATTERN,
          attack: 'VOLLEY',
          projectileCount: count,
          message: '🔴 FORTRESS fires ' + count + ' projectiles!'
        };
      }
      return { phase: this.phase };
    }

    checkExploit(playerAction, gameState) {
      if (playerAction.type === 'SUPPRESSION_FIRE') {
        this.suppressedTurns = 2;
        return {
          exploited: true,
          message: '🔇 SUPPRESSION FIRE! Boss reload suppressed for 2 turns!',
          suppressed: true
        };
      }
      // Concentrated ranged attacks deal bonus damage to static target
      if (playerAction.type === 'HIGH_GROUND' || playerAction.type === 'GRENADE') {
        var bonus = playerAction.type === 'GRENADE' ? 4 : 2;
        this.hp = Math.max(0, this.hp - bonus);
        return {
          exploited: true,
          message: '💥 DIRECT HIT on Fortress! +' + bonus + ' bonus damage',
          bonusDamage: bonus
        };
      }
      return { exploited: false };
    }

    onDefeat(source) {
      if (!this.phase3Reached) {
        this.trackMythicCondition('KILL_BEFORE_PHASE3');
      }
      return super.onDefeat(source);
    }
  }

  /**
   * Sniper Boss — Ghost Sniper (patience and observation as weapons)
   *
   * The boss starts with 80% evasion.  Each use of the Camera card adds a
   * progressive accuracy penalty (−5% evasion per photograph, up to −50%).
   * Longer engagements favour the patient player.
   * Mythic: land the killing blow with maximum penalty stacks applied.
   */
  class SniperBoss extends BossEncounter {
    constructor(floorDepth) {
      super('GHOST_SNIPER', floorDepth);
      this.hp = 65;
      this.maxHp = 65;
      this.mythicTrigger = 'MAX_PENALTY_KILL';
      this.mythicHint = 'RUMOR: Those who wait long enough find the ghost cannot hide...';
      this.whisperItem = 'Ghillie Fragment';
      this.mythicDrop = 'Spectral Crosshairs';

      this.baseEvasion = 80;      // Boss starts very hard to hit
      this.accuracyPenalty = 0;   // Accumulated via Camera card (max 50)
      this.photographs = 0;
      this.maxPhotographs = 10;
      this.penaltyPerPhoto = 5;
      this.shotCooldown = 4;      // Turns between boss sniper shots
      this.lastShotTurn = 0;
    }

    initialize(grid, player) {
      this.bossPosition = { x: 35, y: 2 };
      return {
        success: true,
        concealedBoss: true,
        message: '👁️ A presence watches from the shadows...'
      };
    }

    getCurrentEvasion() {
      return Math.max(0, this.baseEvasion - this.accuracyPenalty);
    }

    // Called each tick; no projectile injection needed (handled via update turn).
    updateRealTime(elapsedMs, gameState) {
      return { bossProjectiles: [] };
    }

    update(gameState) {
      super.update(gameState);
      this.lastShotTurn++;
      if (this.lastShotTurn >= this.shotCooldown) {
        this.lastShotTurn = 0;
        var evasion = this.getCurrentEvasion();
        return {
          phase: BOSS_PHASES.PATTERN,
          attack: 'SNIPER_SHOT',
          damage: this.calculateDamage() * 2,
          bossEvasion: evasion,
          message: '🎯 Ghost Sniper fires! [Boss evasion: ' + evasion + '%]'
        };
      }
      return { phase: this.phase, bossEvasion: this.getCurrentEvasion() };
    }

    checkExploit(playerAction, gameState) {
      if (playerAction.type === 'CAMERA') {
        if (this.photographs < this.maxPhotographs) {
          this.photographs++;
          this.accuracyPenalty = this.photographs * this.penaltyPerPhoto;
        }
        var evasion = this.getCurrentEvasion();
        var atMax = this.photographs >= this.maxPhotographs;
        return {
          exploited: true,
          message: '📷 Photo ' + this.photographs + '/' + this.maxPhotographs +
            ' — Boss evasion: ' + evasion + '%' + (atMax ? ' ⚡ MAX PENALTY!' : ''),
          photos: this.photographs,
          evasion: evasion,
          atMaxPenalty: atMax
        };
      }
      return { exploited: false };
    }

    onDefeat(source) {
      if (this.photographs >= this.maxPhotographs) {
        this.trackMythicCondition('MAX_PENALTY_KILL');
      }
      return Object.assign(super.onDefeat(source), { photographs: this.photographs });
    }
  }

  // Boss type registry
  var BOSS_TYPES = {
    DEPOT_CROSSING: DepotCrossingBoss,
    SENTRY_NEST: SentryNestBoss,
    BUNKER_COMMANDANT: BunkerCommandantBoss,
    MAINFRAME_CORE: MainframeCoreBoss,
    ORBITAL_CARRIER: OrbitalCarrierBoss,
    TREASURE_GOBLIN_KING: TreasureGoblinKingBoss,
    UBER_MEGA: UberMegaBoss,
    ASTEROIDS: AsteroidsBoss,
    TOWER_OFFENSE: TowerOffenseBoss,
    SNIPER: SniperBoss
  };

  /**
   * Create a boss encounter for a given floor
   */
  function createBossForFloor(floorNum) {
    var bossTypes = Object.keys(BOSS_TYPES);
    var randomType = bossTypes[Math.floor(Math.random() * bossTypes.length)];
    var BossClass = BOSS_TYPES[randomType];
    return new BossClass(floorNum);
  }

  /**
   * Get boss types list
   */
  function getBossTypes() {
    return Object.keys(BOSS_TYPES);
  }

  // Public API
  return {
    createBossForFloor: createBossForFloor,
    getBossTypes: getBossTypes,
    BOSS_PHASES: BOSS_PHASES,
    // Export classes for testing
    BossEncounter: BossEncounter,
    DepotCrossingBoss: DepotCrossingBoss,
    SentryNestBoss: SentryNestBoss,
    BunkerCommandantBoss: BunkerCommandantBoss,
    MainframeCoreBoss: MainframeCoreBoss,
    OrbitalCarrierBoss: OrbitalCarrierBoss,
    TreasureGoblinKingBoss: TreasureGoblinKingBoss,
    UberMegaBoss: UberMegaBoss,
    AsteroidsBoss: AsteroidsBoss,
    TowerOffenseBoss: TowerOffenseBoss,
    SniperBoss: SniperBoss
  };
})();

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BossEncounters;
}
