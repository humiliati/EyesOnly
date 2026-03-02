/**
 * PlayerActionSystem — pickpocket and extraction actions.
 * Extracted Phase 20 from gone-rogue.js.
 * Stateless IIFE module — all mutable state via ctx references.
 */
var PlayerActionSystem = (function() {
  'use strict';

  /**
   * Attempt to pickpocket an adjacent enemy.
   * @param {Object} ctx - Context from monolith
   * @returns {Object} Terminal response
   */
  function attemptPickpocket(ctx) {
    if (typeof EnemyStealSystem === 'undefined') {
      return { lines: ['STEAL SYSTEM UNAVAILABLE', ''], prompt: ctx.getPrompt(), stayActive: true };
    }

    if (ctx.strCombatActive) {
      return { lines: ['CAN\'T STEAL IN STR COMBAT', ''], prompt: ctx.getPrompt(), stayActive: true };
    }

    var activeItem = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getActiveItem) ? GAMESTATE.getActiveItem() : null;
    var res = EnemyStealSystem.attempt({
      player: ctx.player,
      enemies: ctx.enemies,
      activeItem: activeItem,
      getEnemyDeck: (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getEnemyDeck) ? GoneRogueDataRegistry.getEnemyDeck : null,
      getEnemyCard: (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getEnemyCard) ? GoneRogueDataRegistry.getEnemyCard : null
    });

    if (!res || !res.ok) {
      return { lines: ['STEAL FAILED', ''], prompt: ctx.getPrompt(), stayActive: true };
    }

    // Award a disposable card into player hand/backup pipeline.
    var awardId = res.cardId;
    if (awardId && typeof GAMESTATE !== 'undefined' && GAMESTATE.addPrintedCards) {
      GAMESTATE.addPrintedCards(awardId, 1, { preferHand: true });
    }

    // Feedback
    try {
      if (typeof TooltipSystem !== 'undefined') {
        TooltipSystem.showPersistent('\uD83E\uDDE4 ' + (res.success ? 'STOLEN' : 'FUMBLED'), 700);
      }
    } catch (e0) {}

    var lines = [];
    lines.push(res.message || (res.success ? 'STOLEN' : 'FUMBLED'));
    if (awardId) {
      var def = (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getCard) ? GoneRogueDataRegistry.getCard(awardId) : null;
      var em = def && def.emoji ? def.emoji : '\uD83C\uDCCF';
      var nm = def && def.name ? def.name : awardId;
      lines.push('\u2192 ' + em + ' ' + nm);
    }
    lines.push('');

    return { lines: lines.concat(ctx.renderGrid()), prompt: ctx.getPrompt(), stayActive: true };
  }

  /**
   * Attempt to extract (advance floor or complete run).
   * @param {Object} ctx - Context from monolith
   * @returns {Object} Terminal response
   */
  function attemptExtract(ctx) {
    var tile = ctx.grid[ctx.player.y][ctx.player.x];
    if (tile !== ctx.TILES.EXIT) {
      return {
        lines: ['NO EXIT HERE', 'FIND THE EXTRACTION POINT (\uD83D\uDEAA)', ''].concat(ctx.renderGrid()),
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    // Check if this is the final floor (30) or if player wants to extract early
    var MAX_FLOORS = 30;
    if (ctx.getFloor() >= MAX_FLOORS) {
      ctx.setRunCompleted(true);

      // Mark difficulty tier as completed
      if (typeof AWOLDifficulty !== 'undefined' && ctx.getDifficultyTier() >= 1 && ctx.getDifficultyTier() <= 3) {
        AWOLDifficulty.markTierCompleted(ctx.getDifficultyTier());
      }

      // Unlock avatar tier matching difficulty completed
      var _prevTier = 0;
      if (typeof TerminalCommandRouter !== 'undefined' && TerminalCommandRouter.completeTier) {
        _prevTier = TerminalCommandRouter.getPlayerState().completedTiers || 0;
        TerminalCommandRouter.completeTier(ctx.getDifficultyTier());
      }

      // Show tier-up announcement if a new tier was unlocked
      var _newTier = (typeof TerminalCommandRouter !== 'undefined' && TerminalCommandRouter.getPlayerState)
        ? TerminalCommandRouter.getPlayerState().completedTiers : 0;
      if (_newTier > _prevTier && typeof TierUpAnnouncement !== 'undefined' && TierUpAnnouncement.show) {
        TierUpAnnouncement.show({
          tier: _newTier,
          onComplete: function () { /* announcement done, rogue already exiting */ }
        });
      }

      return ctx.exitRogue(true);
    }

    // Advance to next floor
    return ctx.advanceFloor();
  }

  return {
    attemptPickpocket: attemptPickpocket,
    attemptExtract: attemptExtract
  };
})();
