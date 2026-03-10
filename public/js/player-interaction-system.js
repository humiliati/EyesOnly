/**
 * PlayerInteractionSystem — tile arrival interactions (doors, shops, pickups, food, combat).
 * Extracted Phase 17 from gone-rogue.js.
 * Stateless IIFE module — all mutable state via ctx references.
 */
var PlayerInteractionSystem = (function() {
  'use strict';

  /**
   * Check interactions after the player arrives on a new tile.
   * @param {Object} ctx - Context from monolith
   */
  function checkPlayerInteractions(ctx) {
    var x = ctx.player.x;
    var y = ctx.player.y;

    // Update turn + pet following history
    ctx.incrementTurn();
    ctx.updatePositionHistory();

    // Bounds safety
    if (x < 0 || x >= ctx.GRID_WIDTH || y < 0 || y >= ctx.GRID_HEIGHT) return;

    var grid = ctx.grid;
    var tile = grid[y] ? grid[y][x] : null;

    // Door/Exit tile
    if (tile === ctx.TILES.EXIT || tile === ctx.TILES.DOOR) {
      if (_handleDoorTile(x, y, tile, ctx)) return;
    } else {
      // BUG 3 FIX: Decrement the step-count cooldown instead of clearing immediately.
      // This prevents the door from being re-triggered the moment the player steps off
      // and immediately steps back on (e.g., when spawned 1 tile away from a door).
      var dsp = ctx.getDoorSpawnProtect();
      if (dsp && dsp.stepsRemaining > 0) {
        dsp.stepsRemaining--;
        if (dsp.stepsRemaining <= 0) ctx.clearDoorSpawnProtect();
      } else {
        ctx.clearDoorSpawnProtect();
      }
    }

    // Shop tile
    if (tile === ctx.TILES.SHOP || tile === ctx.TILES.BLACK_MARKET) {
      _handleShopTile(x, y, tile, ctx);
    }

    // Door hint popups
    ctx.maybeHintNearbyDoors();

    // Currency pickup
    _handleCurrencyPickup(x, y, ctx);

    // Auto-pickup ALL floor items at this tile (ammo, gem, cards, keys).
    // while-loop ensures multi-content breakables are fully collected in one pass.
    // pickupItem() removes one item per call via filterItems(), so loop terminates.
    while (ctx.items.find(function(i) { return i.x === x && i.y === y; })) {
      ctx.pickupItem();
    }

    // Food auto-pickup from interactive items
    _handleFoodPickup(x, y, ctx);

    // Discovery reveal
    ctx.revealDiscovery(x, y);

    // Box auto-exit: player moved off the box tile
    if (ctx.playerInBox && (ctx.player.x !== ctx.playerInBox.x || ctx.player.y !== ctx.playerInBox.y)) {
      ctx.playerExitBox('voluntary');
    }

    // Box auto-enter: player steps onto a placed empty box
    var boxUnderPlayer = ctx.getBoxAt(x, y);
    if (boxUnderPlayer && boxUnderPlayer.state === 'empty' && !ctx.playerInBox) {
      ctx.playerEnterBox(boxUnderPlayer);
    }

    // Enemy collision -> enter STR combat
    var hitEnemy = ctx.enemies.find(function(e) { return e.x === x && e.y === y && e.hp > 0; });
    if (hitEnemy) {
      ctx.enterStrCombat(hitEnemy, 'collision');
      return;
    }
  }

  /**
   * Handle door/exit tile interaction. Returns true if a transition started.
   */
  function _handleDoorTile(x, y, tile, ctx) {
    // Spawn protection: still active if the player is on the protected tile AND steps remain.
    try {
      var dsp = ctx.getDoorSpawnProtect();
      if (dsp && dsp.x === x && dsp.y === y && dsp.stepsRemaining > 0) {
        return false;
      }
    } catch (e0) {}

    var md = ctx.getTileMetadata(x, y);
    if (md && md.type === 'door') {
      if (md.doorKind === 'back') { ctx.retreatFloor(); return true; }
      if (md.doorKind === 'forward') { ctx.attemptExtract(); return true; }
      if (md.doorKind === 'interior_exit') {
        // Pass exit door metadata for building return targeting.
        // If the exit door has a parentBuildingFloorId, it overrides
        // the stack's enteredViaFloorId (multi-exit / back-door case).
        ctx.exitInteriorFloor(md);
        return true;
      }
    }

    // Building door -> enter interior floor
    if (md && md.type === 'building_door' && md.targetFloorId) {
      ctx.enterInteriorFloor(md.targetFloorId);
      return true;
    }

    // Default: treat as forward exit
    if (tile === ctx.TILES.EXIT) {
      ctx.attemptExtract();
      return true;
    }

    return false;
  }

  /**
   * Handle shop tile interaction.
   */
  function _handleShopTile(x, y, tile, ctx) {
    var shopObj = ctx.shops.find(function(s) { return s.x === x && s.y === y; });
    if (shopObj && typeof ShopSystem !== 'undefined' && !shopObj.opened) {
      var shopType = tile === ctx.TILES.BLACK_MARKET ? ShopSystem.SHOP_TYPES.BLACK_MARKET : ShopSystem.SHOP_TYPES.STANDARD;
      ShopSystem.openShop(shopType, ctx.floor);
      shopObj.opened = true;
    }
  }

  /**
   * Handle currency pickup at player position.
   */
  function _handleCurrencyPickup(x, y, ctx) {
    var currencies = ctx.currencies;
    var cryptoPickup = currencies.find(function(c) { return c.x === x && c.y === y; });
    if (!cryptoPickup) return;

    if (typeof GAMESTATE !== 'undefined') {
      GAMESTATE.addCryptos(cryptoPickup.amount);
    }

    ctx.addCurrencyCollected(cryptoPickup.amount);
    ctx.filterCurrencies(x, y);

    // Animation state
    ctx.player.collectingCurrency = true;
    ctx.player.currencyCollectTime = Date.now();

    if (typeof OverheadAnimator !== 'undefined') {
      OverheadAnimator.showCurrencyPickup(ctx.player.x, ctx.player.y, cryptoPickup.amount);
    }

    // Single canonical tooltip for currency pickup
    if (typeof TooltipSystem !== 'undefined') {
      TooltipSystem.showAction('currency-pickup', { amount: cryptoPickup.amount });
    }
  }

  /**
   * Handle food auto-pickup from interactive items.
   */
  function _handleFoodPickup(x, y, ctx) {
    if (typeof InteractiveItems === 'undefined') return;

    var foodItem = InteractiveItems.getItemAt(x, y);
    if (!foodItem || !foodItem.autoPickup || foodItem.type !== 'FOOD') return;
    if (typeof FoodDatabase === 'undefined' || !foodItem.customData || !foodItem.customData.foodId) return;

    // Capture before-values
    var hpBefore = ctx.player.hp || 0;
    var fatigueBefore = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getFatigue) ? GAMESTATE.getFatigue() : 0;
    var ammoBefore = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getAmmo) ? GAMESTATE.getAmmo() : 0;
    var cryptosBefore = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getCryptos) ? GAMESTATE.getCryptos() : 0;

    var result = FoodDatabase.applyFoodEffects(foodItem.customData.foodId, ctx.player);
    if (!result.success) return;

    // ── Food pickup sound by resourceType ──
    try {
      if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
        var _foodResType = (result.resourceType || '').toLowerCase();
        if (_foodResType === 'hp') {
          AudioSystem.play('sq-sq-pickup-success2', { volume: 0.5 });
        } else if (_foodResType === 'focus') {
          AudioSystem.play('sq-sq-pickup-success1', { volume: 0.5 });
        } else if (_foodResType === 'energy') {
          AudioSystem.play('sq-sq-pickup', { volume: 0.5 });
        } else {
          // Fatigue, Inert, or unknown → quick pickup
          AudioSystem.play('sq-sq-pickup-quick', { volume: 0.5 });
        }
      }
    } catch (eFoodSnd) {}

    // Overhead animation color from canonical resourceColor on food item
    var primaryColor = result.resourceColor || '#FF6B9D';

    if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
      OverheadAnimator.showGenericExpression(x, y, result.emoji, 1000, primaryColor);
    }

    // Report each changed resource to debrief feed
    try {
      if (typeof DebriefFeedController !== 'undefined' && DebriefFeedController.reportResourceChange) {
        var hpAfter = ctx.player.hp || 0;
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

    // Block sprint temporarily after food
    if (typeof GAMESTATE !== 'undefined' && GAMESTATE.blockSprintTemporarily) {
      GAMESTATE.blockSprintTemporarily(900);
    }

    // Single canonical tooltip for food pickup
    if (typeof TooltipSystem !== 'undefined') {
      var foodMsg = result.tooltipText || (result.emoji + ' ' + result.foodName + ' consumed');
      TooltipSystem.show(foodMsg, 2500);
    }

    // NOTE: No PancakeStack call — single pickup = single OverheadAnimator animation only.
    // PancakeStack activates only when multiple animations need simultaneous display.

    InteractiveItems.removeItem(foodItem.id);
    console.log('[GoneRogue] Food consumed:', result.foodName);
  }

  return {
    checkPlayerInteractions: checkPlayerInteractions
  };
})();
