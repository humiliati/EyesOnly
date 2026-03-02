/**
 * InteriorFloorSystem — handles entering interior floors (tavern, basement, etc.).
 * Extracted Phase 16 from gone-rogue.js.
 * Stateless IIFE module — all mutable state via ctx references.
 */
var InteriorFloorSystem = (function() {
  'use strict';

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

    // Save current state to the stack so we can return
    ctx.interiorFloorStack.push({
      floorId: ctx.currentInteriorFloorId,
      mainFloor: ctx.floor,
      playerX: ctx.player.x,
      playerY: ctx.player.y
    });
    ctx.currentInteriorFloorId = targetFloorId;

    // Fade-out effect
    if (ctx.useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
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
      ctx.setGrid(floorData.grid);

      // Place player at interior spawn
      ctx.player.x = floorData.player.x;
      ctx.player.y = floorData.player.y;
      ctx.ensurePlayerOnEmptyTile();

      // Reset state arrays for interior
      ctx.setEnemies([]);
      ctx.setBreakables([]);
      WorldItems.init();
      ctx.syncWorldItems();
      ctx.setNpcs([]);
      ctx.setForestBuildings([]);
      ctx.setTileMetadata({});

      // CRITICAL: Clear pre-computed visual grids
      ctx.clearVisualCaches();

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
          breakables.push({
            x: breakable.x, y: breakable.y,
            hp: breakable.hp, maxHp: breakable.hp,
            glyph: ctx.TILES.BREAKABLE, destroyedGlyph: ctx.TILES.DEBRIS,
            emoji: breakable.emoji, name: breakable.name,
            tag: 'interior_breakable_' + breakables.length,
            drops: breakable.drops
          });
        });
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
            state: { released: false, rewardGiven: false, lastWarnTurn: -999, lastTalkTurn: -999 }
          };
          npcs.push(npcObj);
          grid[npcObj.y][npcObj.x] = ctx.TILES.WALL;
          ctx.setTileMetadataAt(npcObj.x, npcObj.y, {
            type: 'npc', npcId: npcObj.id, emoji: npcObj.emoji, name: npcObj.name
          });
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
        var items = ctx.getItems();
        var currencies2 = ctx.getCurrencies();
        floorData.tutorialPickups.forEach(function(pickup) {
          if (pickup.type === 'key') {
            items.push({
              x: pickup.x, y: pickup.y,
              type: 'key',
              keyType: pickup.keyType || 'UNKNOWN_KEY',
              tier: pickup.tier || 3,
              subtype: pickup.subtype || 'quest',
              emoji: pickup.emoji || '\uD83D\uDD11', // 🔑
              name: pickup.name || 'Key',
              npcTarget: pickup.npcTarget || null,
              collected: false
            });
          } else if (pickup.type === 'currency') {
            currencies2.push({ x: pickup.x, y: pickup.y, amount: pickup.amount, collected: false });
          } else if (pickup.type === 'card' && pickup.guaranteed) {
            items.push({ x: pickup.x, y: pickup.y, type: 'card', card: 'strike', collected: false });
          }
        });
      }

      // Lighting for interior
      if (typeof LightingSystem !== 'undefined') {
        LightingSystem.setBiome('COZY_FOREST_NIGHT');
        LightingSystem.setDarknessMultiplier(1.2);
        ctx.rebuildWallCache();
        var pseudoRooms = [{ x: 1, y: 1, width: ctx.GRID_WIDTH - 2, height: ctx.GRID_HEIGHT - 2 }];
        LightingSystem.generateBiomeLights(ctx.GRID_WIDTH, ctx.GRID_HEIGHT, pseudoRooms, ctx.getWallCache());
        LightingSystem.addLightSource(ctx.player.x, ctx.player.y, 'CAMPFIRE');
        ctx.updatePlayerLight();
        LightingSystem.updateLightMap(ctx.GRID_WIDTH, ctx.GRID_HEIGHT, ctx.getAllLightBlockers(ctx.getWallCache()));
      }

      // Initialize movement at new position
      if (typeof GoneRogueMovement !== 'undefined') {
        GoneRogueMovement.init(ctx.player.x, ctx.player.y);
      }

      ctx.startGameLoop();

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
    }, 260);
  }

  return {
    enterInteriorFloor: enterInteriorFloor
  };
})();
