/**
 * HighscoreSystem — handles score calculation and submission at end of run.
 * Extracted Phase 16 from gone-rogue.js.
 * Stateless IIFE module — all state via ctx references.
 */
var HighscoreSystem = (function() {
  'use strict';

  /**
   * Calculate and submit a highscore entry.
   * @param {Object} ctx - Context from monolith
   */
  function submitHighscore(ctx) {
    // Determine if this is an agent or human run
    var mode = 'human';
    if (typeof AgentIntegration !== 'undefined' && AgentIntegration.isActive()) {
      mode = 'agent';
    }

    // Get display name — prefer account username, fall back to local callsign
    var displayName = 'Anonymous';
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getAccount === 'function') {
      var account = GAMESTATE.getAccount();
      if (account && account.username) {
        displayName = account.username;
      }
    }
    // Fallback: use local player callsign from TerminalCommandRouter
    if (displayName === 'Anonymous' && typeof TerminalCommandRouter !== 'undefined' && TerminalCommandRouter.getPlayerState) {
      var _pState = TerminalCommandRouter.getPlayerState();
      if (_pState.callsign) {
        displayName = _pState.callsign;
      }
    }

    // Calculate enemies avoided (spawned but not killed)
    var enemiesAvoided = Math.max(0, ctx.totalEnemiesSpawned - ctx.enemiesKilled);

    // Prepare run data for score calculation
    var runData = {
      currencyFound: ctx.currencyCollected,
      interactivesFound: (typeof InteractiveItems !== 'undefined' && InteractiveItems.getInteractionCount) ? InteractiveItems.getInteractionCount() : 0,
      enemiesAvoided: enemiesAvoided,
      breakableDamage: ctx.totalBreakableDamage,
      damageMitigated: ctx.damageMitigated
    };

    // Calculate score
    var score = HighscoreState.calculateGoneRogueScore(runData);

    // Prepare entry
    var entry = {
      game_id: 'gone_rogue',
      mode: mode,
      display_name: displayName,
      score: score,
      metadata: {
        completions: ctx.runCompleted ? 1 : 0,
        final_floor: ctx.floor,
        player_deaths: ctx.playerDeaths,
        enemies_killed: ctx.enemiesKilled,
        enemies_avoided: enemiesAvoided,
        currency_collected: ctx.currencyCollected,
        total_damage_dealt: ctx.totalDamageDealt,
        most_damage_dealt_single_action: ctx.maxSingleHit,
        damage_mitigated: ctx.damageMitigated,
        breakables_destroyed: ctx.totalBreakableDamage,
        run_duration_ms: ctx.runStartTime ? (Date.now() - ctx.runStartTime) : 0
      }
    };

    // Submit to HighscoreState
    var result = HighscoreState.submitHighscore(entry);

    if (result.success) {
      console.log('[GoneRogue] Highscore submitted:', score, 'Entry ID:', result.entry_id);
    } else {
      console.error('[GoneRogue] Failed to submit highscore:', result.error);
    }
  }

  return {
    submitHighscore: submitHighscore
  };
})();
