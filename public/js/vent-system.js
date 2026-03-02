/**
 * VentSystem – IIFE module (Delegate Pattern)
 *
 * Owns: nothing (stateless — vents/penaltyFloors passed by reference via ctx)
 * Handles: vent discovery, bypass success/failure calculation,
 *          floor skipping on success, backtrack + penalty on failure,
 *          skipped-floor XP awards.
 *
 * Loaded before gone-rogue.js via <script> tag.
 */
var VentSystem = (function () {
  'use strict';

  // ------------------------------------------------------------------
  // handleVentInteraction — discover or attempt vent bypass
  // ------------------------------------------------------------------
  function handleVentInteraction(ctx) {
    // Find vent at player position
    var vent = null;
    for (var i = 0; i < ctx.vents.length; i++) {
      if (ctx.vents[i].x === ctx.player.x && ctx.vents[i].y === ctx.player.y) {
        vent = ctx.vents[i];
        break;
      }
    }

    if (!vent || vent.used) {
      return { lines: ['This vent is no longer functional'], prompt: ctx.getPrompt(), stayActive: true };
    }

    // First interaction: discover the vent
    if (!vent.discovered) {
      vent.discovered = true;
      return {
        lines: [
          'You found a vent!',
          '',
          'Quality: ' + (vent.quality === 'rusty' ? 'Rusty (Lower Success)' : 'Standard'),
          'Destination: Floor ' + (ctx.floor + 2),
          '',
          'Use INTERACT again to attempt bypass',
          'or move away to continue normally'
        ],
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    // Calculate bypass success chance
    var bypassChance = 0.75; // Base 75%
    bypassChance -= (ctx.ventUseCount * 0.05);     // -5% per prior vent use
    bypassChance -= (ctx.floor * 0.01);             // -1% per floor depth
    if (vent.quality === 'rusty') {
      bypassChance -= 0.05;
    }
    bypassChance -= (ctx.difficultyTier - 1) * 0.05; // -5% per tier above 1
    bypassChance = Math.max(0.25, bypassChance);      // Min 25%

    // Attempt bypass
    var success = ctx.rng() < bypassChance;
    vent.used = true;
    ctx.ventUseCount++;

    if (success) {
      var lines = [
        'VENT BYPASS SUCCESSFUL!',
        '',
        'You navigate through the vent system.',
        'Emerging on floor ' + (ctx.floor + 2) + '...',
        '',
        'Floor ' + (ctx.floor + 1) + ' cleared automatically (50% XP awarded)'
      ];

      // Award 50% XP for skipped floor
      awardSkippedFloorXP(ctx.floor);

      // Advance floor by 2 (extra +1, _advanceFloor does the rest)
      ctx.floor++;

      // Remove the vent tile
      ctx.grid[ctx.player.y][ctx.player.x] = ctx.TILES.EMPTY;

      // Generate next floor
      setTimeout(function () {
        ctx.advanceFloor();
      }, 100);

      return { lines: lines, prompt: ctx.getPrompt(), stayActive: true };
    } else {
      // Failure: backtrack up to 3 floors with penalty enemies
      var backtrackFloors = Math.min(3, ctx.floor - 1);
      var targetFloor = Math.max(1, ctx.floor - backtrackFloors);

      var lines = [
        'VENT MALFUNCTION!',
        '',
        'The vent collapses behind you!',
        'You tumble backwards through the system...',
        '',
        'Landed on floor ' + targetFloor,
        'WARNING: Penalty enemies active!'
      ];

      // Mark floors as penalty
      for (var i = 0; i < backtrackFloors; i++) {
        var penaltyFloor = targetFloor + i;
        if (ctx.penaltyFloors.indexOf(penaltyFloor) === -1) {
          ctx.penaltyFloors.push(penaltyFloor);
        }
      }

      // Backtrack floor (will be incremented by advanceFloor)
      ctx.floor = targetFloor - 1;

      // Player takes minor damage from the fall
      ctx.player.hp = Math.max(1, ctx.player.hp - 2);

      // Remove the vent tile
      ctx.grid[ctx.player.y][ctx.player.x] = ctx.TILES.EMPTY;

      // Generate penalty floor
      setTimeout(function () {
        ctx.advanceFloor();
      }, 100);

      return { lines: lines, prompt: ctx.getPrompt(), stayActive: true };
    }
  }

  // ------------------------------------------------------------------
  // awardSkippedFloorXP — 50% XP for bypassed floor
  // ------------------------------------------------------------------
  function awardSkippedFloorXP(floor) {
    var baseXP = 50 + (floor * 10);
    var skippedXP = Math.floor(baseXP * 0.5);

    if (typeof GAMESTATE !== 'undefined' && GAMESTATE.awardExperience) {
      GAMESTATE.awardExperience(skippedXP);
    }
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------
  return {
    handleVentInteraction: handleVentInteraction,
    awardSkippedFloorXP: awardSkippedFloorXP
  };
})();
