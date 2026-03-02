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

    // Floor 0 scripted walk: auto-path the player toward the exit (Floor 1 door).
    // Player control is disabled until they reach Floor 1.
    if (ctx.getFloor() === 0) {
      ctx.setScriptedWalk(true);
      try {
        // Find the forward exit position from current grid
        var exitTarget = null;
        var GRID_HEIGHT = ctx.GRID_HEIGHT;
        var GRID_WIDTH = ctx.GRID_WIDTH;
        var grid = ctx.grid;
        var TILES = ctx.TILES;
        var tileMetadata = ctx.tileMetadata;

        for (var sy = 0; sy < GRID_HEIGHT && !exitTarget; sy++) {
          for (var sx = 0; sx < GRID_WIDTH && !exitTarget; sx++) {
            if (grid[sy] && (grid[sy][sx] === TILES.EXIT)) {
              var mk = sx + ',' + sy;
              if (tileMetadata[mk] && tileMetadata[mk].doorKind === 'forward') {
                exitTarget = { x: sx, y: sy };
              }
            }
          }
        }
        if (exitTarget) {
          ctx.setScriptedWalkTarget(exitTarget);
          // Delay slightly so the grid renders before the walk starts
          var player = ctx.player;
          var isWalkable = ctx.isWalkable;
          var setScriptedWalk = ctx.setScriptedWalk;
          var setScriptedWalkTarget = ctx.setScriptedWalkTarget;
          setTimeout(function() {
            if (typeof GoneRogueMovement !== 'undefined' && GoneRogueMovement.setTarget) {
              // Must init movement system at player pos before setting a target
              GoneRogueMovement.init(player.x, player.y);
              // collisionCheck(x,y) returns true if BLOCKED (matches findPath convention)
              var pathFound = GoneRogueMovement.setTarget(exitTarget.x, exitTarget.y, function(x, y) {
                return !isWalkable(x, y);
              }, false);
              // If pathfinding failed, abort scripted walk so player isn't stuck
              if (!pathFound) {
                console.warn('[GoneRogue] Scripted walk: no path to exit, aborting');
                setScriptedWalk(false);
                setScriptedWalkTarget(null);
              }
            }
          }, 600);
        }
      } catch (eScripted) {
        console.warn('[GoneRogue] Scripted walk setup error:', eScripted);
        ctx.setScriptedWalk(false);
      }
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
