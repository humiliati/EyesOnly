/**
 * FloorTransitionSystem – IIFE module (Delegate Pattern)
 *
 * Owns: nothing (stateless — all state via ctx getters/setters)
 * Handles: interior floor exit (stack unwinding), floor retreat
 *          (backtracking with fade), floor advance (secret floor checks,
 *          vendor reset, healing, generation, messaging).
 *
 * Loaded before gone-rogue.js via <script> tag.
 */
var FloorTransitionSystem = (function () {
  'use strict';

  // ------------------------------------------------------------------
  // Shared fade helpers
  // ------------------------------------------------------------------
  function _fadeOut(ctx) {
    if (!ctx.useInteractiveGrid) return;
    var el = document.getElementById('rogue-grid-mobile');
    if (el) { el.style.opacity = '0'; el.style.transition = 'opacity 0.25s ease-out'; }
  }

  function _fadeIn(ctx) {
    if (!ctx.useInteractiveGrid) return;
    var el = document.getElementById('rogue-grid-mobile');
    if (el) { el.style.opacity = '1'; el.style.transition = 'opacity 0.25s ease-in'; }
  }

  // ------------------------------------------------------------------
  // exitInteriorFloor — pop interior stack, return to parent or main
  // ------------------------------------------------------------------
  function exitInteriorFloor(ctx) {
    if (ctx.interiorFloorStack.length === 0) return;

    var prev = ctx.interiorFloorStack.pop();
    ctx.setCurrentInteriorFloorId(prev.floorId);

    console.log('[FloorTransition] Exiting interior, returning to ' + (prev.floorId || 'main floor ' + prev.mainFloor));

    _fadeOut(ctx);

    setTimeout(function () {
      if (prev.floorId) {
        ctx.enterInteriorFloor(prev.floorId);
      } else {
        ctx.setFloor(prev.mainFloor);
        ctx.setLastExitPos({ x: prev.playerX, y: prev.playerY });
        ctx.setSpawnFromLastExitPos('retreat');
        ctx.setTurn(0);
        ctx.generateFloor();
        ctx.startGameLoop();
      }
      _fadeIn(ctx);
    }, 260);
  }

  // ------------------------------------------------------------------
  // retreatFloor — backtrack one floor with fade transition
  // ------------------------------------------------------------------
  function retreatFloor(ctx) {
    if (ctx.currentInteriorFloorId) {
      exitInteriorFloor(ctx);
      return;
    }

    if (ctx.getFloor() <= 0) return;

    try { ctx.setLastExitPos({ x: ctx.player.x, y: ctx.player.y }); } catch (e0) {}
    ctx.setSpawnFromLastExitPos('retreat');

    _fadeOut(ctx);

    setTimeout(function () {
      ctx.setFloor(Math.max(0, ctx.getFloor() - 1));
      ctx.setTurn(0);
      ctx.generateFloor();
      ctx.startGameLoop();
      ctx.saveState();
      _fadeIn(ctx);
    }, 260);
  }

  // ------------------------------------------------------------------
  // advanceFloor — secret floor checks, vendor reset, heal, generate
  // ------------------------------------------------------------------
  function advanceFloor(ctx) {
    // Check for queued secret floor
    var secretFloorData = null;
    if (typeof SecretFloors !== 'undefined' && SecretFloors.hasQueuedSecretFloor()) {
      secretFloorData = SecretFloors.popSecretFloor();
      console.log('[FloorTransition] Secret floor triggered:', secretFloorData.type);
    }

    // Check low HP + high gold trigger
    if (!secretFloorData && typeof SecretFloors !== 'undefined') {
      var triggerResult = SecretFloors.triggerSecretFloor(
        SecretFloors.TRIGGER_TYPES.LOW_HP_HIGH_GOLD,
        { playerHp: ctx.player.hp, playerMaxHp: ctx.player.maxHp, playerGold: ctx.player.cryptos }
      );
      if (triggerResult.success) {
        secretFloorData = SecretFloors.popSecretFloor();
        console.log('[FloorTransition] Low HP + High Gold secret floor triggered:', secretFloorData.type);
      }
    }

    // Fade-out
    if (ctx.useInteractiveGrid) {
      var gridContainer = document.getElementById('rogue-grid-mobile');
      if (gridContainer) { gridContainer.style.opacity = '0'; gridContainer.style.transition = 'opacity 0.3s ease-out'; }
    }

    try { ctx.setLastExitPos({ x: ctx.player.x, y: ctx.player.y }); } catch (e0) {}
    ctx.setSpawnFromLastExitPos('advance');

    setTimeout(function () {
      var isSecretFloor = !!secretFloorData;
      var secretFloorType = isSecretFloor ? secretFloorData.type : null;

      if (!isSecretFloor) {
        ctx.setFloor(ctx.getFloor() + 1);
      }
      ctx.setTurn(0);

      // Reset vendor
      if (typeof VendorSystem !== 'undefined') VendorSystem.reset();
      ctx.resetVendor();

      // Heal player 10-20% between floors
      var healAmount = Math.floor(ctx.player.maxHp * (0.1 + ctx.rng() * 0.1));
      ctx.player.hp = Math.min(ctx.player.maxHp, ctx.player.hp + healAmount);

      // Apply difficulty tier on spawn boundary
      if (!isSecretFloor) {
        ctx.applyDesiredDifficultyTier('advance_floor');
      }

      // Generate floor
      if (isSecretFloor) {
        ctx.generateFloor(secretFloorData);
      } else {
        ctx.generateFloor();
      }
      ctx.startGameLoop();
      ctx.saveState();

      // Build messaging
      var lines = [];
      if (isSecretFloor) {
        lines.push('');
        lines.push('⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️');
        if (secretFloorType === SecretFloors.SECRET_FLOOR_TYPES.UBER_MEGA) {
          lines.push('  REALITY BREACH DETECTED');
          lines.push('  YOU SHOULD NOT BE HERE');
          lines.push('  SYSTEM INTEGRITY: 12%');
        } else if (secretFloorType === SecretFloors.SECRET_FLOOR_TYPES.GOBLIN_VAULT) {
          lines.push('  ANOMALY DETECTED');
          lines.push('  SPACE WARPING...');
          lines.push('  TREASURE VAULT MANIFESTED');
        } else if (secretFloorType === SecretFloors.SECRET_FLOOR_TYPES.GRAY_CAVE_HIDDEN) {
          lines.push('  HIDDEN PATH REVEALED');
          lines.push('  GRAY CAVE PASSAGE');
        }
        lines.push('⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️');
        lines.push('');
        lines.push('  HP RESTORED: +' + healAmount);
        lines.push('');
        SecretFloors.clearCurrentSecretFloor();
      } else {
        lines.push('');
        lines.push('═══════════════════════════════════════');
        lines.push('  FLOOR ' + ctx.getFloor() + ' - EXTRACTION SUCCESSFUL');
        lines.push('═══════════════════════════════════════');
        lines.push('');
        lines.push('  HP RESTORED: +' + healAmount);
        lines.push('  INFILTRATING DEEPER...');
        lines.push('');
      }

      // Mobile UI fade-in
      if (ctx.useInteractiveGrid && ctx.showMobileUI) {
        ctx.showMobileUI();
        ctx.updateMobileGrid();
        var gridContainer = document.getElementById('rogue-grid-mobile');
        if (gridContainer) {
          setTimeout(function () { gridContainer.style.opacity = '1'; gridContainer.style.transition = 'opacity 0.3s ease-in'; }, 50);
        }
      }

      // Text-mode result
      if (!ctx.useInteractiveGrid) {
        return {
          lines: lines.concat(ctx.renderGrid()),
          prompt: ctx.getPrompt(),
          stayActive: true
        };
      }
    }, 300);

    return { lines: ['EXTRACTING...'], prompt: ctx.getPrompt(), stayActive: true };
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------
  return {
    exitInteriorFloor: exitInteriorFloor,
    retreatFloor: retreatFloor,
    advanceFloor: advanceFloor
  };
})();
