var TutorialFloorGen = (function() {
  'use strict';

  function generateContrivedTutorialFloor(ctx) {
    if (typeof TutorialFloors === 'undefined') {
      console.warn('[TutorialFloors] Module not loaded, falling back to procedural generation');
      return;
    }

    var layout = TutorialFloors.getFloorLayout(ctx.getFloor());
    if (!layout) {
      console.warn('[TutorialFloors] No layout found for floor ' + ctx.getFloor());
      return;
    }

    console.log('[TutorialFloors] Generating contrived floor ' + ctx.getFloor() + ': ' + layout.name);

    // Generate floor data from authored layout (do not shift full-grid templates).
    // Continuity is handled by spawning near the correct door.
    var floorData = TutorialFloors.generateContrivedFloor(layout);

    // Apply grid (setGrid updates the monolith closure var; also update ctx snapshot)
    ctx.setGrid(floorData.grid);
    ctx.grid = floorData.grid;

    // Place player: default position from authored layout.
    ctx.player.x = floorData.player.x;
    ctx.player.y = floorData.player.y;

    ctx.ensurePlayerOnEmptyTile();

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
            if (tx <= 0 || tx >= ctx.GRID_WIDTH - 1 || ty <= 0 || ty >= ctx.GRID_HEIGHT - 1) continue;
            if (!ctx.grid[ty] || ctx.grid[ty][tx] !== ctx.TILES.EMPTY) continue;
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
    if (exitX >= ctx.GRID_WIDTH - 1) exitX = ctx.GRID_WIDTH - 2;
    if (exitY <= 0) exitY = 1;
    if (exitY >= ctx.GRID_HEIGHT - 1) exitY = ctx.GRID_HEIGHT - 2;
    if (ctx.grid[exitY]) ctx.grid[exitY][exitX] = ctx.TILES.EMPTY;

    ctx.grid[exitY][exitX] = ctx.TILES.EXIT;
    ctx.tileMetadata[exitX + ',' + exitY] = { type: 'door', doorKind: 'forward' };

    // Mark entry/return door at the entry point, but DO NOT spawn the player on top of it.
    // (player glyph hides the door tile, making it look like there is only one door).
    var backX = floorData.player.x;
    var backY = floorData.player.y;

    // Back door must always exist. Clamp + carve to empty (deterministic).
    if (backX <= 0) backX = 1;
    if (backX >= ctx.GRID_WIDTH - 1) backX = ctx.GRID_WIDTH - 2;
    if (backY <= 0) backY = 1;
    if (backY >= ctx.GRID_HEIGHT - 1) backY = ctx.GRID_HEIGHT - 2;
    if (ctx.grid[backY]) ctx.grid[backY][backX] = ctx.TILES.EMPTY;

    function _tryMoveBackDoorAwayFrom(x0, y0, avoidX, avoidY, minDist) {
      var moved = false;
      for (var r = 1; r <= 6 && !moved; r++) {
        for (var dy = -r; dy <= r && !moved; dy++) {
          for (var dx = -r; dx <= r && !moved; dx++) {
            var tx = x0 + dx;
            var ty = y0 + dy;
            if (tx <= 0 || tx >= ctx.GRID_WIDTH - 1 || ty <= 0 || ty >= ctx.GRID_HEIGHT - 1) continue;
            if (!ctx.grid[ty] || ctx.grid[ty][tx] !== ctx.TILES.EMPTY) continue;

            // Avoid placing the back door under visual clutter (trees/buildings overlays)
            var blocked = false;
            if (ctx.forestBuildings && ctx.forestBuildings.length) {
              for (var bi = 0; bi < ctx.forestBuildings.length; bi++) {
                if (ctx.forestBuildings[bi].x === tx && ctx.forestBuildings[bi].y === ty) { blocked = true; break; }
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

    // BUG 1 FIX: Only stamp the back door if suppressBackDoor is not set.
    // Floor 0 sets suppressBackDoor=true (there is no previous floor to return to).
    if (!floorData.suppressBackDoor) {
      ctx.grid[backY][backX] = ctx.TILES.DOOR;
      ctx.tileMetadata[backX + ',' + backY] = { type: 'door', doorKind: 'back' };
    }

    // Apply door contract: spawn near correct door based on transition mode.
    // DoorContractSystem owns the canonical contract logic (advance → near back door,
    // retreat → near forward door, with guardrail step protection).
    if (typeof DoorContractSystem !== 'undefined') {
      var backDoorPos = (!floorData.suppressBackDoor) ? { x: backX, y: backY } : null;
      var forwardDoorPos = { x: exitX, y: exitY };
      DoorContractSystem.applyDoorContract({
        grid: ctx.grid,
        TILES: ctx.TILES,
        gridW: ctx.GRID_WIDTH,
        gridH: ctx.GRID_HEIGHT,
        player: ctx.player,
        backDoorPos: backDoorPos,
        forwardDoorPos: forwardDoorPos
      });
    }

    // Place buildings (visual overlay)
    ctx.setForestBuildings([]);
    floorData.buildings.forEach(function(building) {
      // Never overwrite/cover door tiles
      if ((building.x === exitX && building.y === exitY) || (building.x === backX && building.y === backY)) {
        return;
      }
      ctx.grid[building.y][building.x] = ctx.TILES.WALL; // Impassable
      ctx.forestBuildings.push({ x: building.x, y: building.y, emoji: building.emoji });
    });

    // Re-assert door tiles after any template/building mutations
    ctx.grid[exitY][exitX] = ctx.TILES.EXIT;
    ctx.tileMetadata[exitX + ',' + exitY] = { type: 'door', doorKind: 'forward' };
    // BUG 1 FIX: Only re-assert back door if it is allowed on this floor.
    if (!floorData.suppressBackDoor) {
      ctx.grid[backY][backX] = ctx.TILES.DOOR;
      ctx.tileMetadata[backX + ',' + backY] = { type: 'door', doorKind: 'back' };
    }

    // Place decorations (visual overlay, walkable)
    floorData.decorations.forEach(function(deco) {
      if ((deco.x === exitX && deco.y === exitY) || (deco.x === backX && deco.y === backY)) return;
      ctx.forestBuildings.push({ x: deco.x, y: deco.y, emoji: deco.emoji });
    });

    // Re-assert doors again after decorations too (decor overlays can visually hide doors; metadata must remain stable)
    ctx.grid[exitY][exitX] = ctx.TILES.EXIT;
    ctx.tileMetadata[exitX + ',' + exitY] = { type: 'door', doorKind: 'forward' };
    // BUG 1 FIX: Only re-assert back door if it is allowed on this floor.
    if (!floorData.suppressBackDoor) {
      ctx.grid[backY][backX] = ctx.TILES.DOOR;
      ctx.tileMetadata[backX + ',' + backY] = { type: 'door', doorKind: 'back' };
    }

    // Ensure no visual overlay (buildings/decorations) sits on top of a door tile.
    try {
      if (ctx.forestBuildings && ctx.forestBuildings.length) {
        var filtered = ctx.forestBuildings.filter(function(b) {
          if (!b) return false;
          return !((b.x === exitX && b.y === exitY) || (b.x === backX && b.y === backY));
        });
        ctx.forestBuildings.length = 0;
        Array.prototype.push.apply(ctx.forestBuildings, filtered);
      }
    } catch (e00) {}

    // Ensure no entities/breakables/items sit on door tiles either (they render above tiles and can hide doors).
    try {
      if (Array.isArray(ctx.breakables)) {
        var bFiltered = ctx.breakables.filter(function(bb) { return bb && !((bb.x === exitX && bb.y === exitY) || (bb.x === backX && bb.y === backY)); });
        ctx.breakables.length = 0;
        Array.prototype.push.apply(ctx.breakables, bFiltered);
      }
    } catch (e01) {}
    try {
      if (Array.isArray(ctx.items)) {
        ctx.setItems(WorldItems.filterFloorItems(function(it) { return it && !((it.x === exitX && it.y === exitY) || (it.x === backX && it.y === backY)); }));
      }
    } catch (e02) {}
    try {
      if (Array.isArray(ctx.enemies)) {
        var eFiltered = ctx.enemies.filter(function(en) { return en && !((en.x === exitX && en.y === exitY) || (en.x === backX && en.y === backY)); });
        ctx.enemies.length = 0;
        Array.prototype.push.apply(ctx.enemies, eFiltered);
      }
    } catch (e03) {}

    // If the player is currently standing on the back door, show a one-shot hint so it isn't "invisible" under the player glyph.
    // BUG 1 FIX: Only show the hint when the back door actually exists on this floor.
    try {
      if (!floorData.suppressBackDoor && ctx.player && ctx.player.x === backX && ctx.player.y === backY && typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
        OverheadAnimator.showGenericExpression(backX, backY, '↩️', 900);
      }
    } catch (e0) {}

    // Place breakables
    floorData.breakables.forEach(function(breakable) {
      var def = {
        x: breakable.x,
        y: breakable.y,
        hp: breakable.hp,
        maxHp: breakable.hp,
        glyph: ctx.TILES.BREAKABLE,
        destroyedGlyph: breakable.destroyedGlyph || (breakable.explosive ? '▓' : ctx.TILES.DEBRIS),
        emoji: breakable.emoji,
        name: breakable.name,
        tag: 'tutorial_breakable_' + ctx.breakables.length,
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
      ctx.breakables.push(def);
    });

    // Place tutorial gate (floor 1)
    if (floorData.tutorialGate) {
      floorData.tutorialGate.positions.forEach(function(pos) {
        ctx.breakables.push({
          x: pos.x,
          y: pos.y,
          hp: floorData.tutorialGate.hp,
          maxHp: floorData.tutorialGate.hp,
          glyph: ctx.TILES.BREAKABLE,
          destroyedGlyph: ctx.TILES.DEBRIS,
          emoji: floorData.tutorialGate.emoji,
          name: floorData.tutorialGate.name,
          tag: 'tutorial_gate_' + pos.x + '_' + pos.y
        });
      });

      // Place tutorial pickups behind gate — route through WorldItems
      if (floorData.tutorialPickups) {
        floorData.tutorialPickups.forEach(function(pickup) {
          if (pickup.type === 'currency') {
            WorldItems.addCurrency({
              x: pickup.x,
              y: pickup.y,
              amount: pickup.amount || 1
            });
          } else if (pickup.type === 'card') {
            // Resolve a real card definition instead of bare string
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
          } else if (pickup.type === 'key') {
            WorldItems.addItem({
              x: pickup.x, y: pickup.y,
              type: 'key',
              keyType: pickup.keyType || 'UNKNOWN_KEY',
              tier: pickup.tier || 3,
              subtype: pickup.subtype || 'quest',
              registryId: pickup.registryId || null,
              emoji: pickup.emoji || '\uD83D\uDD11',
              name: pickup.name || 'Key',
              npcTarget: pickup.npcTarget || null
            });
          } else if (pickup.type === 'ammo') {
            WorldItems.addItem({ x: pickup.x, y: pickup.y, type: 'ammo', amount: pickup.amount || 1 });
          } else if (pickup.type === 'gem') {
            WorldItems.addItem({ x: pickup.x, y: pickup.y, type: 'gem', amount: pickup.amount || 1 });
          }
        });
        // Sync _items after WorldItems additions
        ctx.items = WorldItems.getFloorItems();
        ctx.currencies = WorldItems.getCurrencies();
      }
    }

    // Place locked gate (floor 2)
    // Implemented as a wall tile with metadata so it renders as a door and can be unlocked via INTERACT.
    if (floorData.lockedGate) {
      floorData.lockedGate.positions.forEach(function(pos) {
        ctx.grid[pos.y][pos.x] = ctx.TILES.WALL; // blocked until unlocked

        var k = pos.x + ',' + pos.y;
        var req = (floorData.lockedGate.requiredKey || floorData.lockedGate.requiresKey || 'RUSTY_KEY');
        req = ('' + req).toUpperCase().replace(/[^A-Z0-9_]/g, '_');

        ctx.tileMetadata[k] = {
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
      ctx.breakables.push({
        x: keyObj.x,
        y: keyObj.y,
        hp: keyObj.hp,
        maxHp: keyObj.hp,
        glyph: ctx.TILES.BREAKABLE,
        destroyedGlyph: ctx.TILES.DEBRIS,
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
        ctx.grid[ch.y][ch.x] = ctx.TILES.WALL;
        ctx.tileMetadata[ch.x + ',' + ch.y] = {
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

        ctx.npcs.push(npcObj);

        // Occupy NPC tile
        ctx.grid[npcObj.y][npcObj.x] = ctx.TILES.WALL;
        ctx.tileMetadata[npcObj.x + ',' + npcObj.y] = {
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

                if (zx < 0 || zx >= ctx.GRID_WIDTH || zy < 0 || zy >= ctx.GRID_HEIGHT) continue;
                // Don't overwrite actual walls/breakables/locked gates/chests
                if (ctx.grid[zy][zx] === ctx.TILES.WALL) continue;

                var key = zx + ',' + zy;
                // Trigger zone wins over warning zone
                if (zoneType === 'npc_gate_trigger') {
                  ctx.tileMetadata[key] = { type: 'npc_gate_trigger', npcId: npcObj.id };
                } else {
                  if (!ctx.tileMetadata[key]) {
                    ctx.tileMetadata[key] = { type: 'npc_gate_warning', npcId: npcObj.id };
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

    // Place enemies (intended for floor 3+, with opt-in for earlier floors).
    // Floor 0 has an intentional punching-bag enemy (Ancient Snail) for STR-combat testing.
    // Layouts that need enemies on floors < 3 set allowEnemies: true.
    var tutorialEnemies = (Array.isArray(floorData.enemies) ? floorData.enemies : []);
    if (ctx.getFloor() < 3 && !floorData.allowEnemies) tutorialEnemies = [];

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
        enemyObj.path = { type: ctx.PATH_TYPES.STATIONARY };
      } else if (enemy.patrolType === 'circular' && enemy.patrolPath) {
        enemyObj.path = {
          type: ctx.PATH_TYPES.CIRCULAR,
          points: enemy.patrolPath,
          currentIndex: 0
        };
      }

      ctx.enemies.push(enemyObj);
    });

    // Tutorial lighting: contrived floors return early from _generateFloor(),
    // so we must generate lighting here.
    if (typeof LightingSystem !== 'undefined') {
      // Alternate day/night by floor number (simple variant)
      var biomeName = (ctx.getFloor() % 2 === 1) ? 'COZY_FOREST_DAY' : 'COZY_FOREST_NIGHT';
      LightingSystem.setBiome(biomeName);
      LightingSystem.setDarknessMultiplier(1.0);

      // Build wall cache from the current grid and generate a few environmental lights.
      ctx.rebuildWallCache();
      var walls = ctx.getWallCache();

      // Use a pseudo-room covering the interior so lights place even without procedural rooms.
      var pseudoRooms = [{ x: 1, y: 1, width: ctx.GRID_WIDTH - 2, height: ctx.GRID_HEIGHT - 2 }];
      LightingSystem.generateBiomeLights(ctx.GRID_WIDTH, ctx.GRID_HEIGHT, pseudoRooms, walls);

      // Guarantee light sources near player spawn and exit for visibility.
      // Place the exit light ADJACENT to the door (not on it) so it doesn't cover the door emoji.
      LightingSystem.addLightSource(ctx.player.x, ctx.player.y, 'CAMPFIRE');
      var exitLightX = (exitX + 1 < ctx.GRID_WIDTH - 1) ? exitX + 1 : exitX - 1;
      var exitLightY = exitY;
      LightingSystem.addLightSource(exitLightX, exitLightY, 'LIGHT_BULB');

      // Always include player/enemy lights
      ctx.updatePlayerLight();
      LightingSystem.updateEnemyLights(ctx.enemies);
      LightingSystem.updateLightMap(ctx.GRID_WIDTH, ctx.GRID_HEIGHT, ctx.getAllLightBlockers(walls));

      var playerLight = LightingSystem.getLightAt(ctx.player.x, ctx.player.y);
      console.log('[Lighting] Tutorial floor ' + ctx.getFloor() + ': biome=' + biomeName +
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
        if (bd.x < 0 || bd.x >= ctx.GRID_WIDTH || bd.y < 0 || bd.y >= ctx.GRID_HEIGHT) return;

        // Carve the door tile to empty first, then stamp as a door
        ctx.grid[bd.y][bd.x] = ctx.TILES.DOOR;
        ctx.tileMetadata[bd.x + ',' + bd.y] = {
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
        if (w.y >= 0 && w.y < ctx.GRID_HEIGHT && w.x >= 0 && w.x < ctx.GRID_WIDTH) {
          ctx.grid[w.y][w.x] = '~';
        }
      });
      console.log('[TutorialFloors] Placed ' + floorData.waterTiles.length + ' water tiles');
    }

    // Place breadcrumb pickups (small currency rewards along exploration paths)
    if (floorData.breadcrumbPickups) {
      floorData.breadcrumbPickups.forEach(function(pickup) {
        ctx.currencies.push({
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
      if (ctx.player && ctx.player.x === exitX && ctx.player.y === exitY) {
        var sp = _findNearestEmptyDoorSpot(ctx.player.x, ctx.player.y, exitX, exitY, 2);
        if (sp) { ctx.player.x = sp.x; ctx.player.y = sp.y; }
      }

      // Carve
      if (ctx.grid && ctx.grid[exitY]) ctx.grid[exitY][exitX] = ctx.TILES.EXIT;
      ctx.tileMetadata[exitX + ',' + exitY] = { type: 'door', doorKind: 'forward' };
      // BUG 1 FIX: Only stamp back door in the final guarantee pass if it is allowed on this floor.
      if (!floorData.suppressBackDoor) {
        if (ctx.grid && ctx.grid[backY]) ctx.grid[backY][backX] = ctx.TILES.DOOR;
        ctx.tileMetadata[backX + ',' + backY] = { type: 'door', doorKind: 'back' };
      }

      // Remove overlays/entities from door positions
      if (ctx.forestBuildings && ctx.forestBuildings.length) {
        var fbFiltered = ctx.forestBuildings.filter(function(b) {
          return b && !((b.x === exitX && b.y === exitY) || (b.x === backX && b.y === backY));
        });
        ctx.forestBuildings.length = 0;
        Array.prototype.push.apply(ctx.forestBuildings, fbFiltered);
      }
      if (Array.isArray(ctx.breakables)) {
        var bFiltered2 = ctx.breakables.filter(function(bb) { return bb && !((bb.x === exitX && bb.y === exitY) || (bb.x === backX && bb.y === backY)); });
        ctx.breakables.length = 0;
        Array.prototype.push.apply(ctx.breakables, bFiltered2);
      }
      if (Array.isArray(ctx.items)) {
        ctx.setItems(WorldItems.filterFloorItems(function(it) { return it && !((it.x === exitX && it.y === exitY) || (it.x === backX && it.y === backY)); }));
      }
      if (Array.isArray(ctx.currencies)) {
        var cFiltered = ctx.currencies.filter(function(cc) { return cc && !((cc.x === exitX && cc.y === exitY) || (cc.x === backX && cc.y === backY)); });
        ctx.currencies.length = 0;
        Array.prototype.push.apply(ctx.currencies, cFiltered);
      }
      if (Array.isArray(ctx.enemies)) {
        var eFiltered2 = ctx.enemies.filter(function(en) { return en && !((en.x === exitX && en.y === exitY) || (en.x === backX && en.y === backY)); });
        ctx.enemies.length = 0;
        Array.prototype.push.apply(ctx.enemies, eFiltered2);
      }

      // Relocate any NPCs sitting on door tiles (the DOM renderer draws NPC emoji on top
      // of the tile, hiding the door even when the grid tile is correctly set to 🚪).
      if (Array.isArray(ctx.npcs)) {
        ctx.npcs.forEach(function(npc) {
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
            if (nx <= 0 || nx >= ctx.GRID_WIDTH - 1 || ny <= 0 || ny >= ctx.GRID_HEIGHT - 1) continue;
            if (!ctx.grid[ny] || (ctx.grid[ny][nx] !== ctx.TILES.EMPTY && ctx.grid[ny][nx] !== ctx.TILES.GRASS)) continue;
            // Don't relocate onto a door
            if ((nx === exitX && ny === exitY) || (nx === backX && ny === backY)) continue;
            // Don't relocate onto a live breakable
            var bb0 = ctx.getBreakableAt ? ctx.getBreakableAt(nx, ny) : null;
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
      if (ctx.grid && ctx.grid[exitY]) ctx.grid[exitY][exitX] = ctx.TILES.EXIT;
      ctx.tileMetadata[exitX + ',' + exitY] = { type: 'door', doorKind: 'forward' };
      // BUG 1 FIX: Only re-stamp back door if this floor actually has one.
      if (!floorData.suppressBackDoor) {
        if (ctx.grid && ctx.grid[backY]) ctx.grid[backY][backX] = ctx.TILES.DOOR;
        ctx.tileMetadata[backX + ',' + backY] = { type: 'door', doorKind: 'back' };
      }

      // Debug: count door tiles in grid
      var doorCount = 0;
      for (var yy = 0; yy < ctx.GRID_HEIGHT; yy++) {
        for (var xx = 0; xx < ctx.GRID_WIDTH; xx++) {
          if (ctx.grid[yy] && (ctx.grid[yy][xx] === ctx.TILES.EXIT || ctx.grid[yy][xx] === ctx.TILES.DOOR)) doorCount++;
        }
      }
      console.log('[TutorialFloors] Doors stamped: back=(' + backX + ',' + backY + ') forward=(' + exitX + ',' + exitY + ') count=' + doorCount);
    } catch (eDoor) {}

    // Build biome visual grid for forest biome
    var forestBiome = ctx.BIOMES.FOREST;
    ctx.buildBiomeVisualGrid(forestBiome);
    ctx.buildTileRenderObjects(forestBiome);

    // Build biome background gradient (day for odd floors, night for even)
    var isNightFloor = (ctx.getFloor() % 2 === 0);
    ctx.buildBiomeBackgroundColors(forestBiome, isNightFloor);

    // Cache walls for lighting system
    var cachedWalls = [];
    for (var cy = 0; cy < ctx.GRID_HEIGHT; cy++) {
      for (var cx = 0; cx < ctx.GRID_WIDTH; cx++) {
        if (ctx.grid[cy][cx] === ctx.TILES.WALL) {
          cachedWalls.push({ x: cx, y: cy });
        }
      }
    }
    ctx.setCachedWalls(cachedWalls);

    console.log('[TutorialFloors] Floor generated successfully');
    console.log('[TutorialFloors] Buildings: ' + ctx.forestBuildings.length + ', Breakables: ' + ctx.breakables.length + ', Enemies: ' + ctx.enemies.length);
    if (ctx.enemies.length > 0 && ctx.getFloor() < 3 && !floorData.allowEnemies) {
      console.warn('[TutorialFloors] BUG: ' + ctx.enemies.length + ' enemies on floor ' + ctx.getFloor() + ' (should be 0 for floors < 3 unless allowEnemies is set)');
    }
  }

  return {
    generateContrivedTutorialFloor: generateContrivedTutorialFloor
  };
})();
