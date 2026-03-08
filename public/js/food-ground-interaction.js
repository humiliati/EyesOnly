/**
 * FoodGroundInteraction – IIFE module (Stateless Delegate Pattern)
 *
 * Owns: nothing (stateless — reads FoodDatabase, GroundEffects, GAMESTATE)
 * Handles: food × ground-effect interaction processing.
 *
 * When a player steps on a ground-effect tile while carrying recently consumed
 * inert food in their food history buffer, this module checks for matching
 * interactions and executes the effect (buff, spread, extinguish, change).
 *
 * One-shot: each interaction consumes the food from the history buffer.
 * Tooltip-only feedback — no HUD elements.
 *
 * Loaded after food-database.js, before ground-effects-system.js.
 */
var FoodGroundInteraction = (function () {
  'use strict';

  // ------------------------------------------------------------------
  // checkAndApply — main entry point
  //
  // Called from GroundEffectsSystem.applyTileEffects() each time the
  // player steps onto a tile with a ground effect.
  //
  // Returns tooltip message string or null.
  // ------------------------------------------------------------------
  function checkAndApply(x, y, ctx) {
    // Guard: need all systems
    if (typeof GroundEffects === 'undefined') return null;
    if (typeof GAMESTATE === 'undefined' || !GAMESTATE.getRecentFood) return null;
    if (typeof FoodDatabase === 'undefined' || !FoodDatabase.getFoodInteraction) return null;

    // Get ground effect at player's tile
    var groundEffect = GroundEffects.getGroundAt(x, y);
    if (!groundEffect || !groundEffect.type) return null;

    var groundType = groundEffect.type.toUpperCase();

    // Check each food in history for a matching interaction
    var foods = GAMESTATE.getRecentFood();
    for (var i = 0; i < foods.length; i++) {
      var entry = foods[i];
      var interaction = FoodDatabase.getFoodInteraction(entry.foodId, groundType);
      if (interaction) {
        return _executeInteraction(interaction, entry, x, y, ctx);
      }
    }

    return null;
  }

  // ------------------------------------------------------------------
  // _executeInteraction — dispatch to the correct effect handler
  // ------------------------------------------------------------------
  function _executeInteraction(interaction, foodEntry, x, y, ctx) {
    var msg = null;

    switch (interaction.effect) {
      case 'playerBuff':
        msg = _applyPlayerBuff(interaction, foodEntry, ctx);
        break;
      case 'groundSpread':
        msg = _applyGroundSpread(interaction, foodEntry, x, y, ctx);
        break;
      case 'extinguish':
        msg = _applyExtinguish(interaction, foodEntry, x, y, ctx);
        break;
      case 'groundChange':
        msg = _applyGroundChange(interaction, foodEntry, x, y, ctx);
        break;
      default:
        return null;
    }

    // Consume food from history buffer (one-shot)
    GAMESTATE.consumeRecentFood(foodEntry.foodId);

    // Visual feedback: overhead emoji at player position
    _showOverheadFeedback(foodEntry.emoji, x, y);

    return msg;
  }

  // ------------------------------------------------------------------
  // Effect handlers
  // ------------------------------------------------------------------

  /**
   * playerBuff — Grant a temporary player buff (e.g., fireImmunity).
   * The buff is checked by GroundEffectsSystem / GameTickSystem before
   * applying damage of the relevant type.
   */
  function _applyPlayerBuff(interaction, foodEntry, ctx) {
    var currentTurn = _getCurrentTurn(ctx);
    GAMESTATE.addFoodBuff(interaction.buff, interaction.ticks, currentTurn);
    return interaction.msg || (foodEntry.emoji + ' Buff active (' + interaction.ticks + ' steps)');
  }

  /**
   * groundSpread — Spread a ground effect type to adjacent walkable tiles.
   * Used by: Honey on OIL → oil spreads; Candy on SODA_SPILL → soda spreads.
   */
  function _applyGroundSpread(interaction, foodEntry, x, y, ctx) {
    var spreadType = interaction.spreadType;
    var radius = interaction.radius || 1;

    // 8-directional adjacent offsets
    var offsets = [
      { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
      { dx: -1, dy:  0 },                      { dx: 1, dy:  0 },
      { dx: -1, dy:  1 }, { dx: 0, dy:  1 }, { dx: 1, dy:  1 }
    ];

    var placed = 0;
    for (var r = 1; r <= radius; r++) {
      for (var o = 0; o < offsets.length; o++) {
        var nx = x + offsets[o].dx * r;
        var ny = y + offsets[o].dy * r;

        // Bounds check
        if (!ctx || !ctx.grid || ny < 0 || ny >= ctx.grid.length) continue;
        if (nx < 0 || nx >= ctx.grid[0].length) continue;

        // Skip walls and non-walkable tiles
        var tile = ctx.grid[ny][nx];
        if (tile === '#' || tile === '█' || tile === '▓') continue;
        if (ctx.TILES && (tile === ctx.TILES.WALL || tile === ctx.TILES.VOID)) continue;

        // Skip tiles that already have the same ground effect
        var existing = GroundEffects.getGroundAt(nx, ny);
        if (existing && existing.type && existing.type.toUpperCase() === spreadType.toUpperCase()) continue;

        GroundEffects.setGroundEffect(nx, ny, spreadType);
        placed++;
      }
    }

    return interaction.msg || (foodEntry.emoji + ' Ground effect spreading! (' + placed + ' tiles)');
  }

  /**
   * extinguish — Remove the ground effect (fire/ignited oil) and optionally grant a buff.
   */
  function _applyExtinguish(interaction, foodEntry, x, y, ctx) {
    // Use canonical extinguish if available (converts to STEAM)
    if (typeof GroundEffects !== 'undefined' && GroundEffects.extinguishFire) {
      GroundEffects.extinguishFire(x, y);
    } else {
      GroundEffects.removeGroundEffect(x, y);
    }

    // Optionally grant a buff (e.g., fire immunity after dousing flames)
    if (interaction.buff) {
      var currentTurn = _getCurrentTurn(ctx);
      GAMESTATE.addFoodBuff(interaction.buff, interaction.ticks, currentTurn);
    }

    return interaction.msg || (foodEntry.emoji + ' Effect extinguished!');
  }

  /**
   * groundChange — Replace the current ground effect with a new type.
   * Used by: Dango on ICE → converts to WATER.
   */
  function _applyGroundChange(interaction, foodEntry, x, y) {
    GroundEffects.removeGroundEffect(x, y);
    GroundEffects.setGroundEffect(x, y, interaction.newType);
    return interaction.msg || (foodEntry.emoji + ' Ground transformed!');
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  /** Get current turn number from context or GoneRogue global. */
  function _getCurrentTurn(ctx) {
    if (ctx && typeof ctx.turn === 'number') return ctx.turn;
    try {
      if (typeof GoneRogue !== 'undefined' && GoneRogue.getCurrentTurn) {
        return GoneRogue.getCurrentTurn() || 0;
      }
    } catch (e) {}
    return 0;
  }

  /** Show overhead emoji animation at position. */
  function _showOverheadFeedback(emoji, x, y) {
    try {
      if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
        OverheadAnimator.showGenericExpression(x, y, emoji || '✨', 1000, '#CCCCCC');
      }
    } catch (e) {}
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------
  return {
    checkAndApply: checkAndApply
  };
})();
