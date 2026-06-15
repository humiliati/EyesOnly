/**
 * MovePlayerSystem — core player movement, collision, tile interactions.
 * Extracted Phase 21 from gone-rogue.js.
 * Stateless IIFE module — all mutable state via ctx references.
 */
var MovePlayerSystem = (function() {
  'use strict';

  /**
   * Move the player by (dx, dy), handling collision, NPC gates,
   * pickups, shops, currency, food, discoveries, tile effects, combat.
   * @param {number} dx
   * @param {number} dy
   * @param {boolean} runMode
   * @param {Object} ctx - Context from monolith
   * @returns {Object} Terminal response
   */
  function movePlayer(dx, dy, runMode, ctx) {
    // Block movement during STR combat
    if (ctx.strCombatActive) {
      return {
        lines: ['\u2694\uFE0F  MOVEMENT LOCKED - STR COMBAT IN PROGRESS', 'Use cards to fight or type FLEE to retreat', ''].concat(ctx.renderGrid()),
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    var player = ctx.player;
    var newX = player.x + dx;
    var newY = player.y + dy;

    // Track last move direction for flanking logic
    if (dx === 1) player.lastMoveDirection = 'east';
    else if (dx === -1) player.lastMoveDirection = 'west';
    else if (dy === 1) player.lastMoveDirection = 'south';
    else if (dy === -1) player.lastMoveDirection = 'north';

    // Door hints should fire on approach
    ctx.maybeHintNearbyDoors();

    // Check bounds
    if (newX < 0 || newX >= ctx.GRID_WIDTH || newY < 0 || newY >= ctx.GRID_HEIGHT) {
      return {
        lines: ['CANNOT MOVE THERE', ''].concat(ctx.renderGrid()),
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    // NPC gate zones (warning + trigger)
    var metaKey = newX + ',' + newY;
    var meta = ctx.tileMetadata[metaKey];
    if (meta && meta.type === 'npc_gate_warning') {
      var warnNpc = ctx.getNpcById(meta.npcId);
      if (warnNpc && (!warnNpc.state.released) && (ctx.getTurn() - warnNpc.state.lastWarnTurn > 10)) {
        warnNpc.state.lastWarnTurn = ctx.getTurn();
        ctx.npcShowEmoji(warnNpc, '!', 700);
      }
    } else if (meta && meta.type === 'npc_gate_trigger') {
      var trigNpc = ctx.getNpcById(meta.npcId);
      if (trigNpc && !trigNpc.state.released) {
        ctx.npcShowEmoji(trigNpc, '?', 650);
        ctx.startNpcGateCombat(trigNpc);
        return {
          lines: ['GATE ENGAGED', ''].concat(ctx.renderGrid()),
          prompt: ctx.getPrompt(),
          stayActive: true
        };
      }
    }

    // Check collision
    var tile = ctx.grid[newY][newX];
    if (tile === ctx.TILES.WALL) {
      return {
        lines: ['WALL BLOCKS PATH', ''].concat(ctx.renderGrid()),
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    var blockingBreakable = ctx.getBreakableAt(newX, newY);
    if (blockingBreakable && blockingBreakable.hp > 0) {
      // Light-source breakables on walkable tiles don't block movement —
      // player walks through them (enables passive lantern wafting).
      // Only non-light-source breakables (barrels, crates, etc.) block.
      if (!blockingBreakable.isLightSource) {
        return {
          lines: [blockingBreakable.emoji + ' BREAKABLE BLOCKS PATH', 'USE SHOOT OR KICK TO CLEAR', ''].concat(ctx.renderGrid()),
          prompt: ctx.getPrompt(),
          stayActive: true
        };
      }
    }

    // Move player
    player.x = newX;
    player.y = newY;
    ctx.incrementTurn();

    // Keep the smooth-movement system's logical position in lockstep with
    // discrete (keyboard/agent) moves. Without this, GoneRogueMovement's
    // logical position goes stale and the next tap-to-move pathfinds from
    // the wrong tile — its tween freezes and tap input appears dead.
    // (Skip while a tap tween is active: the tween owns the position then.)
    if (typeof GoneRogueMovement !== 'undefined' && GoneRogueMovement.setPosition &&
        (!GoneRogueMovement.isMoving || !GoneRogueMovement.isMoving())) {
      GoneRogueMovement.setPosition(newX, newY);
    }

    // ── Footstep SFX ──
    if (typeof AudioSystem !== 'undefined' && AudioSystem.playFootstep) {
      var biomeName = null;
      var isInterior = !!ctx.currentInteriorFloorId;
      try {
        if (ctx.getBiome) {
          var biome = ctx.getBiome(ctx.getFloor());
          // getBiome returns the biome object; we need the key name
          // Look it up from BIOMES map
          if (ctx.BIOMES) {
            var biomeKeys = Object.keys(ctx.BIOMES);
            for (var bi = 0; bi < biomeKeys.length; bi++) {
              if (ctx.BIOMES[biomeKeys[bi]] === biome) {
                biomeName = biomeKeys[bi];
                break;
              }
            }
          }
        }
      } catch (e) { /* ignore */ }
      AudioSystem.playFootstep(biomeName, isInterior, !!runMode);
    }

    // ── Tick food consumption history & buff expiry (step-based) ──
    if (typeof GAMESTATE !== 'undefined') {
      if (GAMESTATE.tickRecentFood) GAMESTATE.tickRecentFood(ctx.turn);
      if (GAMESTATE.clearExpiredFoodBuffs) GAMESTATE.clearExpiredFoodBuffs(ctx.turn);
    }

    // ── Interrupt active dialogue if player walked away from NPC ──
    if (typeof DialogueSystem !== 'undefined' && DialogueSystem.isActive()) {
      var talkNpc = DialogueSystem.getActiveNpc();
      if (talkNpc) {
        var talkDist = Math.abs(newX - talkNpc.x) + Math.abs(newY - talkNpc.y);
        if (talkDist > 2) {
          DialogueSystem.interrupt();
        }
      }
    }

    // Update position history for pet following
    ctx.updatePositionHistory();

    // ── Door guardrail lifecycle for discrete moves ──
    // The spawn-door protect (~5 steps) must decrement on NON-door steps,
    // exactly like the tick path does (player-interaction-system.js).
    // Without this, keyboard/agent players could never re-use the door
    // they spawned beside — the guardrail never expired on this path.
    var _isDoorTile = (tile === ctx.TILES.EXIT || tile === ctx.TILES.DOOR);
    if (!_isDoorTile && typeof ctx.getDoorSpawnProtect === 'function') {
      var _dspTick = ctx.getDoorSpawnProtect();
      if (_dspTick && _dspTick.stepsRemaining > 0) {
        _dspTick.stepsRemaining--;
        if (_dspTick.stepsRemaining <= 0 && ctx.clearDoorSpawnProtect) ctx.clearDoorSpawnProtect();
      }
    }

    // ── Door-kind-aware arrival routing ──
    // TILES.DOOR and TILES.EXIT share the same glyph, so the tile value
    // alone can't distinguish retreat/building/forward doors — only the
    // tile METADATA can. The old check here (`tile === TILES.EXIT →
    // attemptExtract`) made every door ADVANCE for keyboard/agent moves:
    // stepping on a retreat door moved the player a floor DEEPER.
    if (_isDoorTile) {
      var _dsp = (typeof ctx.getDoorSpawnProtect === 'function') ? ctx.getDoorSpawnProtect() : null;
      var _doorProtected = !!(_dsp && _dsp.x === newX && _dsp.y === newY && _dsp.stepsRemaining > 0);
      if (!_doorProtected) {
        var _doorMd = ctx.tileMetadata[newX + ',' + newY];
        if (_doorMd && _doorMd.type === 'door' && _doorMd.doorKind === 'back' && ctx.retreatFloor) {
          ctx.retreatFloor();
          return { lines: ['RETREATING...', ''].concat(ctx.renderGrid()), prompt: ctx.getPrompt(), stayActive: true };
        }
        if (_doorMd && _doorMd.type === 'door' && _doorMd.doorKind === 'interior_exit' && ctx.exitInteriorFloor) {
          ctx.exitInteriorFloor(_doorMd);
          return { lines: ['EXITING...', ''].concat(ctx.renderGrid()), prompt: ctx.getPrompt(), stayActive: true };
        }
        if (_doorMd && _doorMd.type === 'building_door' && _doorMd.targetFloorId && ctx.enterInteriorFloor) {
          ctx.enterInteriorFloor(_doorMd.targetFloorId);
          return { lines: ['ENTERING...', ''].concat(ctx.renderGrid()), prompt: ctx.getPrompt(), stayActive: true };
        }
        // Forward door (doorKind 'forward' or unmarked exit tile)
        return ctx.attemptExtract();
      }
      // Guardrailed door: inert — fall through as an ordinary tile.
    }

    // Check if player walked onto SHOP tile
    if (tile === ctx.TILES.SHOP || tile === ctx.TILES.BLACK_MARKET) {
      var shops = ctx.shops;
      var shopObj = shops.find(function(s) { return s.x === newX && s.y === newY; });
      if (shopObj && typeof ShopSystem !== 'undefined' && !shopObj.opened) {
        var shopType = tile === ctx.TILES.BLACK_MARKET ? ShopSystem.SHOP_TYPES.BLACK_MARKET : ShopSystem.SHOP_TYPES.STANDARD;
        ShopSystem.openShop(shopType, ctx.getFloor());
        shopObj.opened = true;
      }
    }

    // Check if player is adjacent to a shopkeeper NPC
    var npcs = ctx.npcs;
    if (npcs && npcs.length > 0) {
      for (var i = 0; i < npcs.length; i++) {
        var npc = npcs[i];
        if (npc.shopkeeper) {
          var distX = Math.abs(npc.x - newX);
          var distY = Math.abs(npc.y - newY);
          if (distX <= 1 && distY <= 1 && !(distX === 0 && distY === 0)) {
            if (typeof ShopSystem !== 'undefined') {
              ShopSystem.openShop(ShopSystem.SHOP_TYPES.STANDARD, ctx.getFloor());
              if (typeof TooltipSystem !== 'undefined') {
                TooltipSystem.showGeneric('\uD83E\uDDD9 ' + npc.name + ': Welcome to my shop!', 2000);
              }
            }
            break;
          }
        }
      }
    }

    // Check for currency pickup
    var currencies = ctx.currencies;
    var cryptoPickup = currencies.find(function(c) { return c.x === newX && c.y === newY; });
    var cryptoMessage = null;
    if (cryptoPickup) {
      if (typeof GAMESTATE !== 'undefined') {
        var result = GAMESTATE.addCryptos(cryptoPickup.amount);
        cryptoMessage = result.message;
      }
      ctx.addCurrencyCollected(cryptoPickup.amount);
      ctx.filterOutCurrencyAt(newX, newY);

      player.collectingCurrency = true;
      player.currencyCollectTime = Date.now();

      // ── Audio: currency pickup → coin-2 ──
      try {
        if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
          AudioSystem.play('coin-2', { volume: 0.5 });
        }
      } catch (eCurrSnd) {}

      if (typeof OverheadAnimator !== 'undefined') {
        OverheadAnimator.showCurrencyPickup(player.x, player.y, cryptoPickup.amount);
      }

      // Single canonical tooltip for currency pickup
      if (typeof TooltipSystem !== 'undefined') {
        TooltipSystem.showAction('currency-pickup', { amount: cryptoPickup.amount });
      }
    }

    // Auto-pickup ALL floor items at new position (handles multi-content breakables).
    // Bounded AND progress-checked: pickupItem() can fail without removing the
    // item (full inventory) — without the progress break we'd burn all 20
    // iterations on every step over an uncollectable item.
    // NOTE: Use ctx.items (getter) each iteration — filterItems replaces the array reference.
    var _pickupSafety = 0;
    var _itemsAtNew = function() {
      return ctx.items.filter(function(it) { return it.x === newX && it.y === newY; }).length;
    };
    var _pickRemaining = _itemsAtNew();
    while (_pickupSafety < 20 && _pickRemaining > 0) {
      ctx.pickupItem();
      _pickupSafety++;
      var _pickNow = _itemsAtNew();
      if (_pickNow >= _pickRemaining) break; // no progress (full inventory)
      _pickRemaining = _pickNow;
    }

    // Check for food item pickup (auto-pickup from interactive items)
    if (typeof InteractiveItems !== 'undefined') {
      var foodItem = InteractiveItems.getItemAt(newX, newY);
      if (foodItem && foodItem.autoPickup && foodItem.type === 'FOOD') {
        if (typeof FoodDatabase !== 'undefined' && foodItem.customData && foodItem.customData.foodId) {
          var hpBeforeFood = player.hp || 0;
          var fatigueBeforeFood = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getFatigue) ? GAMESTATE.getFatigue() : 0;
          var ammoBeforeFood = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getAmmo) ? GAMESTATE.getAmmo() : 0;
          var cryptosBeforeFood = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getCryptos) ? GAMESTATE.getCryptos() : 0;

          var foodResult = FoodDatabase.applyFoodEffects(foodItem.customData.foodId, player);
          if (foodResult.success) {
            // ── Food pickup sound by resourceType ──
            try {
              if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
                var _foodResTypeMv = (foodResult.resourceType || '').toLowerCase();
                if (_foodResTypeMv === 'hp') {
                  AudioSystem.play('sq-sq-pickup-success2', { volume: 0.5 });
                } else if (_foodResTypeMv === 'focus') {
                  AudioSystem.play('sq-sq-pickup-success1', { volume: 0.5 });
                } else if (_foodResTypeMv === 'energy') {
                  AudioSystem.play('sq-sq-pickup', { volume: 0.5 });
                } else {
                  // Fatigue, Inert, or unknown → quick pickup
                  AudioSystem.play('sq-sq-pickup-quick', { volume: 0.5 });
                }
              }
            } catch (eFoodSndMv) {}

            // Overhead animation color from canonical resourceColor on food item
            var primaryColorMv = foodResult.resourceColor || '#FF6B9D';

            if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
              OverheadAnimator.showGenericExpression(newX, newY, foodResult.emoji, 1000, primaryColorMv);
            }

            try {
              if (typeof DebriefFeedController !== 'undefined' && DebriefFeedController.reportResourceChange) {
                var hpAfterFood = player.hp || 0;
                if (hpAfterFood !== hpBeforeFood) {
                  DebriefFeedController.reportResourceChange('HP', hpBeforeFood, hpAfterFood, foodResult.foodName || 'Food');
                }
                var fatigueAfterFood = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getFatigue) ? GAMESTATE.getFatigue() : 0;
                if (fatigueAfterFood !== fatigueBeforeFood) {
                  DebriefFeedController.reportResourceChange('Fatigue', fatigueBeforeFood, fatigueAfterFood, foodResult.foodName || 'Food');
                }
                var ammoAfterFood = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getAmmo) ? GAMESTATE.getAmmo() : 0;
                if (ammoAfterFood !== ammoBeforeFood) {
                  DebriefFeedController.reportResourceChange('Ammo', ammoBeforeFood, ammoAfterFood, foodResult.foodName || 'Food');
                }
                var cryptosAfterFood = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getCryptos) ? GAMESTATE.getCryptos() : 0;
                if (cryptosAfterFood !== cryptosBeforeFood) {
                  DebriefFeedController.reportResourceChange('Currency', cryptosBeforeFood, cryptosAfterFood, foodResult.foodName || 'Food');
                }
              }
            } catch (eDebrief) {}

            if (typeof GAMESTATE !== 'undefined' && GAMESTATE.blockSprintTemporarily) {
              GAMESTATE.blockSprintTemporarily(900);
            }

            // Single canonical tooltip for food pickup
            if (typeof TooltipSystem !== 'undefined') {
              var foodMsgMv = foodResult.tooltipText || (foodResult.emoji + ' ' + foodResult.foodName + ' consumed');
              TooltipSystem.show(foodMsgMv, 2500);
            }

            // NOTE: No PancakeStack call — single pickup = single OverheadAnimator animation only.
            // PancakeStack activates only when multiple animations need simultaneous display.

            InteractiveItems.removeItem(foodItem.id);

            // Record inert food to consumption history for ground-effect interactions
            if (foodResult.resourceType === 'Inert' && typeof GAMESTATE !== 'undefined' && GAMESTATE.recordFood) {
              var foodDef = FoodDatabase.getFoodItem(foodItem.customData.foodId);
              if (foodDef && foodDef.interactions) {
                GAMESTATE.recordFood(foodItem.customData.foodId, foodResult.emoji, foodDef.groundEffect, 20);
              }
            }
          }
        }
      }
    }

    // Check for discovery reveal
    var discoveryRevealed = ctx.revealDiscovery(newX, newY);
    if (discoveryRevealed) {
      if (typeof TooltipSystem !== 'undefined') {
        TooltipSystem.show('Discovery Found!', 2500);
      } else if (typeof UIControls !== 'undefined' && UIControls.updateMokInterjection) {
        UIControls.updateMokInterjection('Discovery Found!');
      }
    }

    // Apply tile effects
    var tileEffectMessage = ctx.applyTileEffects(newX, newY);

    // Run mode increases detection and makes noise
    if (runMode) {
      if (typeof PassiveItemsSystem !== 'undefined' && PassiveItemsSystem.checkAndBreakItems) {
        PassiveItemsSystem.checkAndBreakItems('run');
      }

      player.detection += 2;
      ctx.updateAlertLevel();

      var enemies = ctx.enemies;
      for (var ei = 0; ei < enemies.length; ei++) {
        var enemy = enemies[ei];
        if (enemy.hp <= 0) continue;
        var dist = Math.abs(enemy.x - newX) + Math.abs(enemy.y - newY);
        if (dist <= 5) {
          ctx.increaseEnemyAwareness(enemy, 15);
        }
      }

      if (typeof TooltipSystem !== 'undefined') {
        TooltipSystem.showAction('move', { run: true });
      }
    } else {
      player.detection = Math.max(0, player.detection - 0.5);
      ctx.updateAlertLevel();

      if (typeof TooltipSystem !== 'undefined') {
        TooltipSystem.showAction('move', { run: false });
      }
    }

    // Check for enemy collision - trigger STR combat
    var hitEnemy = ctx.enemies.find(function(e) { return e.x === newX && e.y === newY && e.hp > 0; });
    if (hitEnemy) {
      return ctx.enterStrCombat(hitEnemy, 'collision');
    }

    ctx.saveState();

    var messageLines = [];
    if (cryptoMessage) messageLines.push(cryptoMessage);
    if (tileEffectMessage) messageLines.push(tileEffectMessage);
    var lines = messageLines.length > 0 ? messageLines.concat(['']).concat(ctx.renderGrid()) : ctx.renderGrid();

    return {
      lines: lines,
      prompt: ctx.getPrompt(),
      stayActive: true
    };
  }

  return {
    movePlayer: movePlayer
  };
})();
