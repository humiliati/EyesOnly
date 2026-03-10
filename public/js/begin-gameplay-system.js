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
    // Reset per-run floor state tracking (gates destroyed, breakables, visit counts)
    if (typeof FloorStateTracker !== 'undefined') {
      FloorStateTracker.resetAll();
    }

    // Sync difficulty from AWOL button state (authoritative source of truth).
    // Handles auto-advance after tier completion and manual toggling between runs.
    if (typeof AWOLDifficulty !== 'undefined' && AWOLDifficulty.getCurrentTier) {
      ctx.setDesiredDifficultyTier(AWOLDifficulty.getCurrentTier());
    }

    // Apply desired UBER difficulty on run start (before initial floor generation)
    ctx.applyDesiredDifficultyTier('start_run');

    // Track initial floor visit
    if (typeof FloorStateTracker !== 'undefined') {
      FloorStateTracker.incrementVisit(ctx.getFloor());
    }

    // Generate initial floor
    ctx.generateFloor();

    // Start game loop
    ctx.startGameLoop();

    // Initialize smooth movement system at the player's spawn position.
    // This must happen after generateFloor() places the player on the grid.
    // Without this, _visualPosition defaults to (0,0) and the avatar renders
    // off-screen until the first tap-to-move triggers a lazy init.
    if (typeof GoneRogueMovement !== 'undefined' && GoneRogueMovement.init) {
      GoneRogueMovement.init(ctx.player.x, ctx.player.y);
    }

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
        // Auto-expand resources row for new players (shows fatigue + energy)
        if (DebriefFeedController.expandRow) {
          DebriefFeedController.expandRow('resources');
        }
      }

      // Start onboarding tutorial on Floor 0 (Pink Panther Pawprint)
      if (typeof OnboardingTutorial !== 'undefined' && ctx.getFloor() === 0) {
        OnboardingTutorial.start(ctx);
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
      // Auto-expand resources row (shows fatigue + energy)
      if (DebriefFeedController.expandRow) {
        DebriefFeedController.expandRow('resources');
      }
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
