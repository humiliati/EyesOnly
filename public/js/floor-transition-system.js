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
  //
  // Building Return Contract:
  //   When exiting to a main floor, DO NOT use 'retreat' mode (which
  //   would spawn near the advance-floor door). Instead, regenerate
  //   the floor with NO spawn mode (door contract is a no-op), then
  //   scan tile metadata for the building door that leads to the
  //   interior we just exited from, and spawn the player near THAT door.
  //
  //   This ensures:
  //     - Exit through same door you entered → spawn near that building door
  //     - Exit through a back door (future WBE) → spawn near the back door's
  //       parent-floor position (via its targetFloorId in tile metadata)
  // ------------------------------------------------------------------
  function exitInteriorFloor(ctx, exitDoorMeta) {
    if (ctx.interiorFloorStack.length === 0) return;

    var prev = ctx.interiorFloorStack.pop();
    ctx.setCurrentInteriorFloorId(prev.floorId);

    // Determine which building door on the PARENT floor to spawn near.
    //
    // Priority:
    //   1. exitDoorMeta.parentBuildingFloorId — explicit override from the exit door
    //      metadata (multi-exit / back-door case, e.g. building-to-building bypass).
    //   2. prev.enteredViaFloorId — the building we originally entered (same-door exit).
    //
    // This architecture supports WBE roadmap features:
    //   - Vents connecting buildings across floor tiles
    //   - Building-to-building bypass (enter front, exit back on same floor)
    //   - Wall funnel: front door building with back door on other side of wall
    var exitingFromFloorId = (exitDoorMeta && exitDoorMeta.parentBuildingFloorId)
      ? exitDoorMeta.parentBuildingFloorId
      : (prev.enteredViaFloorId || null);

    console.log('[FloorTransition] Exiting interior, returning to ' +
      (prev.floorId || 'main floor ' + prev.mainFloor) +
      ' (entered via: ' + exitingFromFloorId + ')');

    _fadeOut(ctx);

    setTimeout(function () {
      if (prev.floorId) {
        // Returning to a parent interior (nested interior exit)
        ctx.enterInteriorFloor(prev.floorId);
      } else {
        // Returning to main floor — use building return contract
        ctx.setFloor(prev.mainFloor);
        ctx.setLastExitPos({ x: prev.playerX, y: prev.playerY });

        // DO NOT set 'retreat' mode — that spawns near the advance door.
        // Instead, leave mode null so applyDoorContract is a no-op,
        // then handle building return spawn after floor generation.
        ctx.setSpawnFromLastExitPos(null);
        ctx.setTurn(0);
        ctx.generateFloor();

        // ── Building Return Spawn ──────────────────────────────────
        // Scan tile metadata for the building door matching our exit.
        var buildingDoorPos = null;
        if (exitingFromFloorId && ctx.getAllTileMetadata) {
          var allMeta = ctx.getAllTileMetadata();
          for (var key in allMeta) {
            var md = allMeta[key];
            if (md && md.type === 'building_door' && md.targetFloorId === exitingFromFloorId) {
              var parts = key.split(',');
              buildingDoorPos = { x: parseInt(parts[0], 10), y: parseInt(parts[1], 10) };
              console.log('[FloorTransition] Found building door for ' + exitingFromFloorId + ' at (' + buildingDoorPos.x + ',' + buildingDoorPos.y + ')');
              break;
            }
          }
        }

        if (buildingDoorPos && typeof DoorContractSystem !== 'undefined') {
          // Spawn player near the building door (no guardrails — can re-enter immediately)
          var spawnPos = DoorContractSystem.findSpawnNearDoor(
            ctx.getGrid(), ctx.TILES, ctx.GRID_WIDTH, ctx.GRID_HEIGHT,
            buildingDoorPos, null, 3
          );
          if (spawnPos) {
            ctx.player.x = spawnPos.x;
            ctx.player.y = spawnPos.y;
            console.log('[FloorTransition] Building return: spawned at (' + spawnPos.x + ',' + spawnPos.y + ') near building door');
          } else {
            // Fallback: stand on the building door tile
            ctx.player.x = buildingDoorPos.x;
            ctx.player.y = buildingDoorPos.y;
            console.log('[FloorTransition] Building return: fallback to building door tile');
          }
        } else {
          // Fallback: use saved entry position (best effort)
          ctx.player.x = prev.playerX;
          ctx.player.y = prev.playerY;
          console.log('[FloorTransition] Building return: fallback to saved entry pos (' + prev.playerX + ',' + prev.playerY + ')');
        }

        // Clear any stale spawn protection (building exits have no guardrails)
        if (typeof DoorContractSystem !== 'undefined') {
          DoorContractSystem.clearDoorSpawnProtect();
        }

        // Sync movement system to new position
        if (typeof GoneRogueMovement !== 'undefined' && GoneRogueMovement.setPosition) {
          GoneRogueMovement.setPosition(ctx.player.x, ctx.player.y);
        }

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

      // Track floor revisit for gate/breakable respawn rules
      if (typeof FloorStateTracker !== 'undefined') {
        FloorStateTracker.incrementVisit(ctx.getFloor());
      }

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

      // Track floor visit for gate/breakable respawn rules
      if (typeof FloorStateTracker !== 'undefined') {
        FloorStateTracker.incrementVisit(ctx.getFloor());
      }

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

      // Notify onboarding tutorial of floor transition (Phase 9 tooltips on Floor 1)
      if (typeof OnboardingTutorial !== 'undefined' && OnboardingTutorial.onFloorTransition) {
        OnboardingTutorial.onFloorTransition(ctx.getFloor(), ctx);
      }

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
