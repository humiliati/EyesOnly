/**
 * InteriorFloorSystem — handles entering interior floors (tavern, basement, etc.).
 * Extracted Phase 16 from gone-rogue.js.
 * Stateless IIFE module — all mutable state via ctx references.
 */
var InteriorFloorSystem = (function() {
  'use strict';

  /**
   * Resolve the interior biome definition for a given floor.
   * Checks layout.interiorBiome first, then falls back to a default lookup.
   * @param {string} targetFloorId - The interior floor identifier
   * @param {Object} layout - The authored layout object
   * @returns {Object|null} Interior biome definition from interior-biomes.json
   */
  function _resolveInteriorBiome(targetFloorId, layout) {
    if (typeof GoneRogueDataRegistry === 'undefined') return null;

    // 1. Explicit interiorBiome field on the layout
    if (layout && layout.interiorBiome) {
      var biome = GoneRogueDataRegistry.getInteriorBiome(layout.interiorBiome);
      if (biome) return biome;
    }

    // 2. Infer from targetFloorId prefix (e.g. "tavern.main" → INTERIOR_TAVERN)
    if (targetFloorId) {
      var prefix = String(targetFloorId).split('.')[0].toUpperCase();
      var inferredKey = 'INTERIOR_' + prefix;
      var inferred = GoneRogueDataRegistry.getInteriorBiome(inferredKey);
      if (inferred) return inferred;
    }

    return null;
  }

  /**
   * Enter an interior floor by its ID.
   * @param {string} targetFloorId - The interior floor identifier
   * @param {Object} ctx - Context from monolith
   */
  function enterInteriorFloor(targetFloorId, ctx) {
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

    // Save current state to the stack so we can return.
    // enteredViaFloorId records WHICH building we entered so that on exit
    // we can spawn the player near the correct building door on the parent floor.
    ctx.interiorFloorStack.push({
      floorId: ctx.currentInteriorFloorId,
      mainFloor: ctx.floor,
      playerX: ctx.player.x,
      playerY: ctx.player.y,
      enteredViaFloorId: targetFloorId
    });

    // ── Door contract audio: resolve sounds for building entry ──
    // Source = current floor (main or parent interior)
    // Target = targetFloorId (the interior we're entering)
    var _enterSourceId = ctx.currentInteriorFloorId || String(ctx.floor || '0');
    var _enterDoor = { sounds: [], preFadeDelay: 0 };
    if (typeof DoorContractAudio !== 'undefined' && DoorContractAudio.getTransitionSounds) {
      _enterDoor.sounds = DoorContractAudio.getTransitionSounds(_enterSourceId, targetFloorId, { direction: 'down' });
      _enterDoor.preFadeDelay = DoorContractAudio.getPreFadeDelay(_enterDoor.sounds);
    }
    // Play door sequence immediately (DoorOpen at t=0, Descend at t=250, DoorClose at t=600)
    if (_enterDoor.sounds.length > 0 && typeof AudioSystem !== 'undefined' && AudioSystem.playSequence) {
      AudioSystem.playSequence(_enterDoor.sounds);
    }

    ctx.currentInteriorFloorId = targetFloorId;
    var _enterPreDelay = _enterDoor.preFadeDelay;

    // Fade-out effect (delayed by pre-fade so player hears door open)
    setTimeout(function () {
      if (ctx.useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
        var gridContainer = document.getElementById('rogue-grid-mobile');
        if (gridContainer) {
          gridContainer.style.opacity = '0';
          gridContainer.style.transition = 'opacity 0.25s ease-out';
        }
      }
    }, _enterPreDelay);

    setTimeout(function() {
      // Generate the interior floor using the authored layout
      var floorData = TutorialFloors.generateContrivedFloor(layout);

      // Apply grid
      ctx.setGrid(floorData.grid);

      // Place player at interior spawn — apply building door contract if available.
      // BUG 13 FIX: Use DoorContractSystem.applyBuildingDoorContract() to spawn
      // the player adjacent to the exit door with NO guardrails (building funnel).
      var exitDoorPos = floorData.exit ? { x: floorData.exit.x, y: floorData.exit.y } : null;
      var buildingContractApplied = false;
      if (exitDoorPos && typeof DoorContractSystem !== 'undefined') {
        buildingContractApplied = DoorContractSystem.applyBuildingDoorContract({
          grid: floorData.grid,
          TILES: ctx.TILES,
          gridW: ctx.GRID_WIDTH,
          gridH: ctx.GRID_HEIGHT,
          player: ctx.player,
          exitDoorPos: exitDoorPos
        });
      }
      if (!buildingContractApplied) {
        // Fallback: use authored spawn position
        ctx.player.x = floorData.player.x;
        ctx.player.y = floorData.player.y;
      }
      ctx.ensurePlayerOnEmptyTile();

      // Reset state arrays for interior.
      // WorldItems.init() clears parent floor items — this is safe because:
      // 1. Main→interior: parent floor regenerates entirely on exit (FloorGenCore.generateFloor)
      // 2. Interior→nested: parent interior regenerates via re-enter (enterInteriorFloor)
      // Proc gen handles organic item spawning on all floors including tutorials.
      ctx.setEnemies([]);
      ctx.setBreakables([]);
      WorldItems.init();
      ctx.syncWorldItems();
      ctx.setNpcs([]);
      ctx.setForestBuildings([]);
      ctx.setTileMetadata({});

      // CRITICAL: Clear pre-computed visual grids
      ctx.clearVisualCaches();

      // Resolve interior biome and rebuild visual caches with it
      var interiorBiome = _resolveInteriorBiome(targetFloorId, layout);
      if (interiorBiome) {
        if (typeof ctx.buildBiomeVisualGrid === 'function') {
          ctx.buildBiomeVisualGrid(interiorBiome);
        }
        if (typeof ctx.buildTileRenderObjects === 'function') {
          ctx.buildTileRenderObjects(interiorBiome);
        }
        // Interiors are always "night" (indoor lighting)
        if (typeof ctx.buildBiomeBackgroundColors === 'function') {
          ctx.buildBiomeBackgroundColors(interiorBiome, true);
        }
        console.log('[Interior] Applied interior biome: ' + (interiorBiome.name || targetFloorId));
      }

      // Place exit door (back to parent floor)
      var grid = ctx.getGrid();
      var exitX = floorData.exit.x;
      var exitY = floorData.exit.y;
      if (exitX >= 0 && exitX < ctx.GRID_WIDTH && exitY >= 0 && exitY < ctx.GRID_HEIGHT) {
        grid[exitY][exitX] = ctx.TILES.DOOR;
        ctx.setTileMetadataAt(exitX, exitY, { type: 'door', doorKind: 'interior_exit' });
      }

      // Place decorations
      if (floorData.decorations) {
        floorData.decorations.forEach(function(deco) {
          ctx.addForestBuilding({ x: deco.x, y: deco.y, emoji: deco.emoji });
        });
      }

      // Place breakables
      if (floorData.breakables) {
        var breakables = ctx.getBreakables();
        floorData.breakables.forEach(function(breakable) {
          var def = {
            x: breakable.x, y: breakable.y,
            hp: breakable.hp, maxHp: breakable.hp,
            glyph: ctx.TILES.BREAKABLE,
            destroyedGlyph: breakable.destroyedGlyph || (breakable.explosive ? '\u2593' : ctx.TILES.DEBRIS),
            emoji: breakable.emoji, name: breakable.name,
            tag: 'interior_breakable_' + breakables.length,
            drops: breakable.drops
          };
          // Propagate explosive properties
          if (breakable.explosive) {
            def.explosive = true;
            def.blastRadius = breakable.blastRadius || 2.75;
            def.blastDamage = breakable.blastDamage || [9, 25];
          }
          // Propagate kick and noise
          if (breakable.kickable) def.kickable = true;
          if (breakable.noise) def.noise = breakable.noise;
          breakables.push(def);
        });
        console.log('[Interior] Placed ' + floorData.breakables.length + ' breakables');
      }

      // Place currencies
      if (layout.currencies) {
        var currencies = ctx.getCurrencies();
        layout.currencies.forEach(function(c) {
          currencies.push({ x: c.x, y: c.y, amount: c.amount || 3, collected: false });
        });
      }

      // Place building doors (for nested interiors)
      if (floorData.buildingDoors && floorData.buildingDoors.length > 0) {
        floorData.buildingDoors.forEach(function(bd) {
          if (!bd || typeof bd.x !== 'number' || typeof bd.y !== 'number') return;
          if (bd.x < 0 || bd.x >= ctx.GRID_WIDTH || bd.y < 0 || bd.y >= ctx.GRID_HEIGHT) return;
          grid[bd.y][bd.x] = ctx.TILES.DOOR;
          ctx.setTileMetadataAt(bd.x, bd.y, {
            type: 'building_door',
            doorKind: 'building',
            buildingId: bd.buildingId || null,
            targetFloorId: bd.targetFloorId || null,
            emoji: '\uD83D\uDEAA', // 🚪
            name: (bd.buildingId || 'Building') + ' Entrance'
          });
        });
      }

      // Place NPCs
      if (floorData.npcs && floorData.npcs.length > 0) {
        var npcs = ctx.getNpcs();
        floorData.npcs.forEach(function(npc) {
          var npcObj = {
            id: npc.id || ('NPC-' + npc.x + '-' + npc.y),
            x: npc.x, y: npc.y,
            emoji: npc.emoji || '\uD83E\uDDD1', name: npc.name || 'NPC',
            direction: (npc.direction || 'south').toLowerCase(),
            dialogues: Array.isArray(npc.dialogues) ? npc.dialogues.slice() : [],
            gate: npc.gate || null, reward: npc.reward || null,
            shopkeeper: npc.shopkeeper || false,
            questItem: npc.questItem || null,
            npcTarget: npc.npcTarget || null,
            state: { released: false, rewardGiven: false, lastWarnTurn: -999, lastTalkTurn: -999 }
          };
          npcs.push(npcObj);
          grid[npcObj.y][npcObj.x] = ctx.TILES.WALL;
          ctx.setTileMetadataAt(npcObj.x, npcObj.y, {
            type: 'npc', npcId: npcObj.id, emoji: npcObj.emoji, name: npcObj.name
          });
          console.log('[Interior] Placed NPC ' + npcObj.name + ' (' + npcObj.id + ') at ' + npcObj.x + ',' + npcObj.y);
        });
      } else {
        console.log('[Interior] No NPCs in floorData (npcs=' + (floorData.npcs ? floorData.npcs.length : 'undefined') + ')');
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

      // Place all tutorialPickups via WorldItems (single source of truth)
      if (floorData.tutorialPickups) {
        floorData.tutorialPickups.forEach(function(pickup) {
          if (pickup.type === 'key') {
            WorldItems.addItem({
              x: pickup.x, y: pickup.y,
              type: 'key',
              keyType: pickup.keyType || 'UNKNOWN_KEY',
              tier: pickup.tier || 3,
              subtype: pickup.subtype || 'quest',
              emoji: pickup.emoji || '\uD83D\uDD11', // 🔑
              name: pickup.name || 'Key',
              npcTarget: pickup.npcTarget || null
            });
          } else if (pickup.type === 'ammo') {
            WorldItems.addItem({
              x: pickup.x, y: pickup.y,
              type: 'ammo',
              amount: pickup.amount || 1
            });
          } else if (pickup.type === 'gem') {
            WorldItems.addItem({
              x: pickup.x, y: pickup.y,
              type: 'gem',
              amount: pickup.amount || 1
            });
          } else if (pickup.type === 'currency') {
            WorldItems.addCurrency({ x: pickup.x, y: pickup.y, amount: pickup.amount || 1 });
          } else if (pickup.type === 'card') {
            // Resolve a real card definition for card pickups
            var cardObj = null;
            try {
              if (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.listCards) {
                var allCards = GoneRogueDataRegistry.listCards();
                var targetType = (pickup.cardType || 'ATTACK').toLowerCase();
                for (var ci = 0; ci < allCards.length; ci++) {
                  if (allCards[ci] && (allCards[ci].type || '').toLowerCase() === targetType) {
                    cardObj = { type: allCards[ci].type, id: allCards[ci].id, name: allCards[ci].name, emoji: allCards[ci].emoji, qualityName: allCards[ci].rarity || 'common' };
                    break;
                  }
                }
              }
            } catch (eCard) {}
            if (!cardObj) {
              cardObj = { type: 'attack', id: 'ACT-001', name: 'Strike', emoji: '\u2694\uFE0F', qualityName: 'common' };
            }
            WorldItems.addItem({ x: pickup.x, y: pickup.y, type: 'card', card: cardObj });
          }
        });
        // Sync _items reference after all WorldItems additions
        ctx.syncWorldItems();
      }

      // Lighting for interior — use biome-specific profile if available
      if (typeof LightingSystem !== 'undefined') {
        var lightingBiome = (interiorBiome && interiorBiome.lightingProfile) ? interiorBiome.lightingProfile : 'COZY_FOREST_NIGHT';
        var darknessMult = (interiorBiome && typeof interiorBiome.darknessMultiplier === 'number') ? interiorBiome.darknessMultiplier : 1.2;
        LightingSystem.setBiome(lightingBiome);
        LightingSystem.setDarknessMultiplier(darknessMult);
        ctx.rebuildWallCache();
        var pseudoRooms = [{ x: 1, y: 1, width: ctx.GRID_WIDTH - 2, height: ctx.GRID_HEIGHT - 2 }];
        LightingSystem.generateBiomeLights(ctx.GRID_WIDTH, ctx.GRID_HEIGHT, pseudoRooms, ctx.getWallCache());
        // UTILITY LIGHT: invisible, non-interactive — ensures player spawn is illuminated.
        LightingSystem.addLightSource(ctx.player.x, ctx.player.y, 'CAMPFIRE', null, false, false, 'utility');
        ctx.updatePlayerLight();
        LightingSystem.updateLightMap(ctx.GRID_WIDTH, ctx.GRID_HEIGHT, ctx.getAllLightBlockers(ctx.getWallCache()));
      }

      // Initialize movement at new position
      if (typeof GoneRogueMovement !== 'undefined') {
        GoneRogueMovement.init(ctx.player.x, ctx.player.y);
      }

      ctx.startGameLoop();

      // ── Audio: interior-specific or default BGM ──
      if (typeof FloorTransitionSystem !== 'undefined' && FloorTransitionSystem.playBiomeMusic) {
        FloorTransitionSystem.playBiomeMusic(ctx);
      }

      // Fade-in
      if (ctx.useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
        var gridContainer = document.getElementById('rogue-grid-mobile');
        if (gridContainer) {
          gridContainer.style.opacity = '1';
          gridContainer.style.transition = 'opacity 0.25s ease-in';
        }
      }

      // Show interior name
      if (typeof UIControls !== 'undefined' && UIControls.updateMokInterjection) {
        UIControls.updateMokInterjection('\uD83D\uDCCD ' + (layout.name || 'Interior')); // 📍
      }

      console.log('[GoneRogue] Interior floor loaded: ' + targetFloorId);
    }, 260 + _enterPreDelay);
  }

  return {
    enterInteriorFloor: enterInteriorFloor
  };
})();
