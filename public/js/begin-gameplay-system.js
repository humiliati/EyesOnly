/**
 * BeginGameplaySystem — kicks off floor generation, game loop, and UI
 * after all onboarding is done.
 * Extracted Phase 19 from gone-rogue.js.
 * Stateless IIFE module — all mutable state via ctx references.
 */
var BeginGameplaySystem = (function() {
  'use strict';

  /**
   * Begin gameplay: sync difficulty, generate floor, start loop, setup UI.
   * @param {Object} ctx - Context from monolith
   * @returns {Object} Terminal response { lines, prompt, stayActive }
   */
  function beginGameplay(ctx) {
    // Sync difficulty from AWOL button state (authoritative source of truth).
    // Handles auto-advance after tier completion and manual toggling between runs.
    if (typeof AWOLDifficulty !== 'undefined' && AWOLDifficulty.getCurrentTier) {
      ctx.setDesiredDifficultyTier(AWOLDifficulty.getCurrentTier());
    }

    // Apply desired UBER difficulty on run start (before initial floor generation)
    ctx.applyDesiredDifficultyTier('start_run');

    // Generate initial floor
    ctx.generateFloor();

    // Start game loop
    ctx.startGameLoop();

    // NOTE: Floor 0 scripted walk was removed (March 2026).
    // Player now has full input control from the first frame.
    // See docs/PLAYER_ONBOARDING.md for the replacement tutorial vision.

    // Use mobile UI if available
    if (ctx.useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      GoneRogueMobile.show();
      ctx.updateMobileGrid();

      // Suppress mobile keyboard when interactive grid is active
      if (typeof Terminal !== 'undefined' && typeof Terminal.suppressMobileKeyboard === 'function') {
        Terminal.suppressMobileKeyboard();
      }

      // Hide input line since grid is the input mechanism
      if (typeof Terminal !== 'undefined' && typeof Terminal.hideInput === 'function') {
        Terminal.hideInput();
      }

      // Switch debrief feed to resource display for Gone Rogue
      if (typeof DebriefFeedController !== 'undefined') {
        DebriefFeedController.setMode('goneRogue');
      }

      return {
        lines: [],
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    // Switch debrief feed to resource display for Gone Rogue
    if (typeof DebriefFeedController !== 'undefined') {
      DebriefFeedController.setMode('goneRogue');
    }

    return {
      lines: ctx.renderGrid(),
      prompt: ctx.getPrompt(),
      stayActive: true
    };
  }

  return {
    beginGameplay: beginGameplay
  };
})();
