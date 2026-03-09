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

    // Check if player walked onto EXIT tile
    if (tile === ctx.TILES.EXIT) {
      return ctx.attemptExtract();
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

      if (typeof OverheadAnimator !== 'undefined') {
        OverheadAnimator.showCurrencyPickup(player.x, player.y, cryptoPickup.amount);
      }

      // Single canonical tooltip for currency pickup
      if (typeof TooltipSystem !== 'undefined') {
        TooltipSystem.showAction('currency-pickup', { amount: cryptoPickup.amount });
      }
    }

    // Auto-pickup ALL floor items at new position (handles multi-content breakables).
    // while-loop collects every item in one pass; pickupItem() removes one per call.
    var items = ctx.items;
    while (items.find(function(it) { return it.x === newX && it.y === newY; })) {
      ctx.pickupItem();
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
