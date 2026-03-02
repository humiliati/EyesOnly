/**
 * StealthSystem — player stealth bonus calculation from tiles, darkness, charms, boxes.
 * Extracted Phase 17 from gone-rogue.js.
 * Stateless IIFE module — all state via ctx references.
 */
var StealthSystem = (function() {
  'use strict';

  /**
   * Calculate total player stealth bonus from all sources.
   * @param {Object} ctx - Context from monolith
   * @returns {number} Total stealth bonus percentage
   */
  function getPlayerStealthBonus(ctx) {
    // Return cached value if player hasn't moved
    var cache = ctx.getStealthBonusCache();
    if (cache &&
        cache.px === ctx.player.x &&
        cache.py === ctx.player.y) {
      return cache.bonus;
    }

    var tile = ctx.grid[ctx.player.y][ctx.player.x];
    var key = ctx.player.x + ',' + ctx.player.y;
    var metadata = ctx.tileMetadata[key];

    var bonus = 0;

    // Tile-based stealth bonuses
    if (tile === ctx.TILES.SHADOW && metadata && metadata.stealthBonus) {
      bonus += metadata.stealthBonus; // 30%
    } else if (tile === ctx.TILES.GRASS && metadata && metadata.stealthBonus) {
      bonus += metadata.stealthBonus; // 20%
    } else if (tile === ctx.TILES.SMOKE && metadata && metadata.stealthBonus) {
      bonus += metadata.stealthBonus; // 40%
    }

    // Darkness-based stealth bonus (from lighting system)
    if (typeof LightingSystem !== 'undefined') {
      var darknessBonus = LightingSystem.getDarknessStealthBonus(ctx.player.x, ctx.player.y);
      bonus += darknessBonus; // 0-50% based on darkness
    }

    // Charm bonuses from inventory
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
      var passiveBonus = PassiveItemsSystem.getEquippedStealthBonus(ctx.player.quality || 50);
      bonus += passiveBonus;
    }

    // Deployed box bonus
    if (ctx.playerInBox) {
      bonus += 70;
    }

    // Cache result
    ctx.setStealthBonusCache({ bonus: bonus, px: ctx.player.x, py: ctx.player.y });

    return bonus;
  }

  return {
    getPlayerStealthBonus: getPlayerStealthBonus
  };
})();
