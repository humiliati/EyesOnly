var FloorGenCore = (function() {
  'use strict';

  function generateFloor(secretFloorData, ctx) {
    // Initialize generation state
    ctx.setProjectiles([]);
    ctx.setBreakables([]);
    ctx.syncItems();
    ctx.syncCurrencies();
    ctx.setEnemies([]);
    ctx.setNpcs([]);
    ctx.setShops([]);
    ctx.setTileMetadata({});
    ctx.setActiveBoss(null);
    ctx.setBossFloorActive(false);
    ctx.setBossDefeated(false);
    ctx.setBossHazards([]);
    ctx.setBossEnvironment({});
    ctx.setPlayerMoveLocked(false);

    ctx.setRopeManager(new RopeManager(ctx.player));
    var ropeItem = {
        id: 'rope-1',
        type: 'item',
        name: 'Rope',
        emoji: '➰',
        x: 5,
        y: 5
    };
    ctx.syncItems();
    WorldItems.addItem(ropeItem);

    // Reset forest biome state
    ctx.setForestBuildings([]);
    ctx.setBiomeVisualGrid(null);
    ctx.setBiomeBackgroundColors(null);
    ctx.setTileRenderObjects(null);
    ctx.setCachedWalls([]);

    // Invalidate per-floor caches
    ctx.setStealthBonusCache(null);
    ctx.setActiveSecretFloor(null);

    // Clear environmental synergy state (must happen even on early-return floors)
    if (typeof EnvironmentalSynergy !== 'undefined') {
      EnvironmentalSynergy.clearGates();
    }

    // Determine if secret floor
    var isSecretFloor = !!secretFloorData;

    // Check for contrived tutorial floors (floors 1-3).
    // On Uber 1+ (ctx.getDifficultyTier() >= 2), skip tutorials — use procedural Forest instead.
    if (
      !isSecretFloor &&
      ctx.getDifficultyTier() <= 1 &&
      typeof TutorialFloors !== 'undefined' &&
      TutorialFloors.isContrivedFloor(ctx.getFloor())
    ) {
      ctx.generateContrivedTutorialFloor();
      return;
    }

    // Diagnostic: if floor < 3 but TutorialFloors didn't catch it, log why
    if (ctx.getFloor() < 3 && !isSecretFloor) {
      console.warn('[GoneRogue] Floor ' + ctx.getFloor() + ' using PROCEDURAL path (TutorialFloors ' +
        (typeof TutorialFloors === 'undefined' ? 'NOT LOADED' : 'loaded but isContrivedFloor=' + TutorialFloors.isContrivedFloor(ctx.getFloor())) + ')');
    }

    // Increment pity timers for card drop tracking (skip contrived tutorial floors)
    ctx.incrementPityTimers();

    // Clear environmental synergy state
    if (typeof EnvironmentalSynergy !== 'undefined') {
      EnvironmentalSynergy.clearGates();
    }

    // Determine floor type
    var floorType;

    if (isSecretFloor) {
      // Set active secret floor
      ctx.setActiveSecretFloor(secretFloorData.type);

      // Secret floors use special type based on secret floor data
      if (secretFloorData.type === SecretFloors.SECRET_FLOOR_TYPES.UBER_MEGA) {
        floorType = ctx.FLOOR_TYPES.BOSS; // Uber Mega is boss-like
      } else if (secretFloorData.type === SecretFloors.SECRET_FLOOR_TYPES.GOBLIN_VAULT) {
        floorType = ctx.FLOOR_TYPES.EXPLORATION; // Goblin vault is maze-like
      } else if (secretFloorData.type === SecretFloors.SECRET_FLOOR_TYPES.GRAY_CAVE_HIDDEN) {
        floorType = ctx.FLOOR_TYPES.EXPLORATION; // Gray cave is safe exploration
      }
    } else {
      floorType = ctx.getFloorType(ctx.getFloor());

      // Track first bonfire visit for gate eligibility
      if (floorType === ctx.FLOOR_TYPES.BONFIRE && !ctx.runState.firstBonfire) {
        ctx.runState.firstBonfire = true;
        console.log('[GoneRogue] First bonfire reached - gates now eligible');
      }
    }

    // Check if this is a boss floor (or secret boss floor)
    if (floorType === ctx.FLOOR_TYPES.BOSS && typeof BossEncounters !== 'undefined') {
      ctx.setBossFloorActive(true);

      // Spawn hidden boss for secret floors
      if (isSecretFloor) {
        if (secretFloorData.type === SecretFloors.SECRET_FLOOR_TYPES.UBER_MEGA) {
          ctx.setActiveBoss(new BossEncounters.UberMegaBoss(ctx.getFloor()));
        } else if (secretFloorData.type === SecretFloors.SECRET_FLOOR_TYPES.GOBLIN_VAULT) {
          ctx.setActiveBoss(new BossEncounters.TreasureGoblinKingBoss(ctx.getFloor()));
        }
      } else {
        // Normal boss for regular boss floors
        ctx.setActiveBoss(BossEncounters.createBossForFloor(ctx.getFloor()));
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
      ctx.setGrid(ctx.createEmptyGrid());

      // Step 2: Generate rooms (varies by floor type)
      var rooms = ctx.generateRooms(floorType);

      // Step 3: Connect rooms with corridors
      ctx.connectRooms(rooms);

      // Step 4: Add branch connections for loops
      ctx.addBranchConnections(rooms);

      // Step 5: Place cover
      ctx.placeCover();

      // Step 6: Place shadow zones
      ctx.placeShadowZones();

      // Step 7: Place environmental tiles
      ctx.placeEnvironmentalTiles();

      // Step 8: Place player and exit
      var spawnData = ctx.placePlayerAndExit(rooms);
      ctx.player.x = spawnData.playerX;
      ctx.player.y = spawnData.playerY;
      ctx.ensurePlayerOnEmptyTile();
      exitX = spawnData.exitX;
      exitY = spawnData.exitY;

      // Step 9: Place enemies (based on floor type)
      ctx.placeEnemies(rooms, floorType);

      // Step 9b: Initialize boss if this is a boss floor
      if (ctx.runState.bossFloorActive && ctx.getActiveBoss()) {
        var bossInit = ctx.getActiveBoss().initialize(ctx.grid, ctx.player);
        if (bossInit.success) {
          ctx.setBossEnvironment(bossInit);
          // Boss floor skips normal stealth validation
          validMap = true;
        }
      } else {
        // Step 10: Validate stealth path (non-boss floors only)
        validMap = ctx.validateStealthPath(ctx.player.x, ctx.player.y, exitX, exitY);
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
      var floorBiome = ctx.getBiome(ctx.getFloor());
      if (floorBiome.spawnFeatures && floorBiome.spawnFeatures.villageCluster) {
        ctx.placeVillageCluster(floorBiome);
      }
      ctx.buildBiomeVisualGrid(floorBiome);
      ctx.buildTileRenderObjects(floorBiome);

      // Build biome background gradient (day for odd floors, night for even)
      var isNightFloor = (ctx.getFloor() % 2 === 0);
      ctx.buildBiomeBackgroundColors(floorBiome, isNightFloor);

      // Generate discoveries and environmental details for exploration framework
      ctx.generateDiscoveries(rooms, floorBiome);
      for (var i = 0; i < rooms.length; i++) {
        ctx.initializeEnvironmentalDetails(rooms[i], floorBiome);
      }
    }

    // Place breakables (deterministic for tests)
    ctx.spawnBreakables();

    // Tutorial floors: Place guaranteed gate with tutorial pickups
    if (floorType === ctx.FLOOR_TYPES.TUTORIAL) {
      ctx.placeTutorialGate(exitX, exitY);
    }

    // Place biome-specific gates on regular floors
    if (floorType !== ctx.FLOOR_TYPES.TUTORIAL) {
      ctx.placeBiomeGates(rooms, exitX, exitY, floorBiome);
    }

    // Spawn context-aware keys (separate from gates, loosely coupled)
    if (floorType !== ctx.FLOOR_TYPES.TUTORIAL) {
      ctx.spawnContextAwareKey(rooms);
    }

    // Place items (increased loot for exploration floors)
    ctx.placeItems(floorType);

    // Step 13: Spawn interactive items
    if (typeof ItemSpawner !== 'undefined' && typeof InteractiveItems !== 'undefined') {
      var spawnedItems = ItemSpawner.spawnItemsForFloor(ctx.getFloor(), rooms, ctx.grid);
      spawnedItems.forEach(function(item) {
        InteractiveItems.addItem(item);
      });
      console.log('[GoneRogue] Spawned', spawnedItems.length, 'interactive items');
    }

    // Generate lighting for this floor
    if (typeof LightingSystem !== 'undefined') {
      // Set floor number for progression scaling
      LightingSystem.setFloor(ctx.getFloor());

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
        biome = ctx.getBiome(ctx.getFloor());
        biomeName = biome.name.toUpperCase().replace(/ /g, '_');

        // Forest tutorial floors: ensure we use a lighting profile that actually includes environmental lights.
        if (biomeName === 'COZY_FOREST') {
          // Simple variant: alternate day/night by floor number
          biomeName = (ctx.getFloor() % 2 === 1) ? 'COZY_FOREST_DAY' : 'COZY_FOREST_NIGHT';
        }
      }

      LightingSystem.setBiome(biomeName);

      // Apply darkness multiplier for uber mega
      if (isSecretFloor && secretFloorData.type === SecretFloors.SECRET_FLOOR_TYPES.UBER_MEGA) {
        LightingSystem.setDarknessMultiplier(0.3); // Extreme darkness (70% darker)
      } else if (ctx.getFloor() === 30 && ctx.runState.bossFloorActive) {
        LightingSystem.setDarknessMultiplier(0.5); // Nerf light by 50%
      } else {
        LightingSystem.setDarknessMultiplier(1.0);
      }

      // Collect wall positions for light blocking and cache them for per-tick use
      ctx.rebuildWallCache();
      var walls = ctx.getWallCache();

      // Generate biome-specific light sources (pass grid for occupancy checking)
      LightingSystem.generateBiomeLights(ctx.GRID_WIDTH, ctx.GRID_HEIGHT, rooms, walls, ctx.grid);
      ctx.updatePlayerLight();

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
              ctx.breakables.push({
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
        console.log('[Lighting] Registered', ctx.breakables.filter(function(b) { return b.isLightSource; }).length, 'interactive light sources as breakables');
      }

      // Update enemy lights
      LightingSystem.updateEnemyLights(ctx.runState.enemies);

      // Calculate initial light map
      LightingSystem.updateLightMap(ctx.GRID_WIDTH, ctx.GRID_HEIGHT, ctx.getAllLightBlockers(walls));

      var playerLight = LightingSystem.getLightAt(ctx.player.x, ctx.player.y);
      console.log('[Lighting] Floor ' + ctx.getFloor() + ': biome=' + biomeName +
        ', playerIntensity=' + playerLight.intensity.toFixed(2) +
        ', sources=' + (playerLight.sources ? playerLight.sources.join(',') : 'none'));
    }

    // Spawn shops
    ctx.spawnShops(rooms, floorType);

    // Spawn vents (15% chance, not on bonfire or tutorial floors)
    ctx.spawnVents(rooms, floorType);

    // Apply biome bleed if we have a previous biome tracked
    ctx.applyBiomeBleed(rooms);

    ctx.setTurn(0);
  }

  return {
    generateFloor: generateFloor
  };
})();
