/* ============================================================
   Enemy Steal System (Phase 1 - minimal)
   Pre-combat pickpocket flow.

   Design:
   - Player equips a theft tool (e.g., ITM-PICKPOCKET-GLOVES) which carries stealTags.
   - When adjacent to an enemy, player can attempt STEAL / PICKPOCKET.
   - If enemy deck exposes any matching tag, grant a "stolen" disposable card.
   - If mismatch, grant a generic disposable (consolation) so the action never feels dead.

   This module is intentionally lightweight and does NOT mutate enemy decks yet.
   ============================================================ */

var EnemyStealSystem = (function() {
  'use strict';

  var DEFAULT_SUCCESS_CARD = 'ACT-021'; // Stolen Technique
  var DEFAULT_FAIL_CARD = 'ACT-020';    // Fumbled Grab

  function _intersects(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    for (var i = 0; i < a.length; i++) {
      if (b.indexOf(a[i]) !== -1) return true;
    }
    return false;
  }

  /**
   * Attempt pickpocket.
   * @param {Object} ctx
   * @param {Object} ctx.player
   * @param {Array}  ctx.enemies
   * @param {Function} ctx.getEnemyDeck (enemyType)->{cards,exposedTags}
   * @param {Object|null} ctx.activeItem
   * @returns {{ ok:boolean, success:boolean, cardId?:string, enemy?:any, message:string }}
   */
  function attempt(ctx) {
    if (!ctx || !ctx.player || !Array.isArray(ctx.enemies)) {
      return { ok: false, success: false, message: 'STEAL UNAVAILABLE' };
    }

    var item = ctx.activeItem || null;
    var stealTags = item && Array.isArray(item.stealTags) ? item.stealTags : [];
    if (!stealTags.length) {
      return { ok: true, success: false, message: 'NO THEFT TOOL EQUIPPED (equip Pickpocket Gloves)' };
    }

    // Find an adjacent enemy (4-neighborhood)
    var px = ctx.player.x, py = ctx.player.y;
    var target = null;
    for (var i = 0; i < ctx.enemies.length; i++) {
      var e = ctx.enemies[i];
      if (!e) continue;
      var dist = Math.abs((e.x||0) - px) + Math.abs((e.y||0) - py);
      if (dist === 1) { target = e; break; }
    }

    if (!target) {
      return { ok: true, success: false, message: 'NO ENEMY IN RANGE (stand adjacent)' };
    }

    var deck = null;
    try {
      if (typeof ctx.getEnemyDeck === 'function') {
        deck = ctx.getEnemyDeck(target.deckType || target.enemyType || target.name || '');
      }
    } catch (e0) { deck = null; }

    var exposed = deck && Array.isArray(deck.exposedTags) ? deck.exposedTags : [];
    var canSteal = _intersects(stealTags, exposed);

    if (!canSteal) {
      return {
        ok: true,
        success: false,
        cardId: DEFAULT_FAIL_CARD,
        enemy: target,
        message: 'FUMBLED — you only got junk'
      };
    }

    return {
      ok: true,
      success: true,
      cardId: DEFAULT_SUCCESS_CARD,
      enemy: target,
      message: 'STOLEN — you lifted a technique'
    };
  }

  return {
    attempt: attempt
  };
})();
