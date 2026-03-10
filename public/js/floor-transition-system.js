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

  /**
   * Visual fade-out only (no audio — door contract handles sounds).
   */
  function _fadeOut(ctx) {
    if (!ctx.useInteractiveGrid) return;
    var el = document.getElementById('rogue-grid-mobile');
    if (el) { el.style.opacity = '0'; el.style.transition = 'opacity 0.25s ease-out'; }
    // Stop current music (skip during onboarding)
    if (typeof AudioSystem !== 'undefined' && AudioSystem.stopMusic && !AudioSystem.isOnboardingMusic()) {
      AudioSystem.stopMusic();
    }
  }

  /**
   * Visual fade-in only (no audio — door contract handles sounds).
   */
  function _fadeIn(ctx) {
    if (!ctx.useInteractiveGrid) return;
    var el = document.getElementById('rogue-grid-mobile');
    if (el) { el.style.opacity = '1'; el.style.transition = 'opacity 0.25s ease-in'; }
  }

  // ------------------------------------------------------------------
  // Door contract audio integration
  //
  // Timing: DoorOpen plays immediately → scene waits ~350ms (pre-fade
  // delay) so player hears creak → Ascend/Descend starts at 250ms
  // (overlaps DoorOpen by ~30%) during the visual fade → DoorClose
  // plays after fade-in at 600ms.
  //
  // For transitions without doors (world elevation), no pre-fade
  // delay — the ascend/descend plays immediately with the fade.
  // ------------------------------------------------------------------

  /**
   * Resolve the door contract sound sequence for a transition.
   * Falls back to generic ascend/descend-2 if DoorContractAudio
   * is not loaded.
   *
   * @param {string|null} sourceFloorId
   * @param {string|null} targetFloorId
   * @param {Object}      [opts] - { direction: 'up'|'down' }
   * @returns {{ sounds: Array, preFadeDelay: number }}
   */
  function _resolveDoorSounds(sourceFloorId, targetFloorId, opts) {
    if (typeof DoorContractAudio !== 'undefined' && DoorContractAudio.getTransitionSounds) {
      var sounds = DoorContractAudio.getTransitionSounds(sourceFloorId, targetFloorId, opts);
      var preFadeDelay = DoorContractAudio.getPreFadeDelay(sounds);
      return { sounds: sounds, preFadeDelay: preFadeDelay };
    }
    // Fallback: generic transition sounds (legacy behavior)
    var fallbackDir = (opts && opts.direction === 'up') ? 'ascend' : 'descend';
    return {
      sounds: [{ key: fallbackDir + '-2', delay: 0, volume: 0.4 }],
      preFadeDelay: 0
    };
  }

  /**
   * Play the full door contract sequence via AudioSystem.playSequence.
   * Split into pre-fade sounds (delay < 350) and post-fade sounds (delay >= 600).
   * Pre-fade sounds play immediately; post-fade sounds are scheduled
   * relative to the fade-in moment.
   *
   * @param {Array}  sounds       - from _resolveDoorSounds().sounds
   * @param {number} fadeStartMs  - when the fade-out starts (relative to now)
   * @param {number} fadeDuration - total fade-out + work + fade-in time (ms)
   */
  function _playDoorSequence(sounds) {
    if (!sounds || !sounds.length) return;
    if (typeof AudioSystem === 'undefined' || !AudioSystem.playSequence) return;
    AudioSystem.playSequence(sounds);
  }

  // ------------------------------------------------------------------
  // Biome → Music mapping
  // ------------------------------------------------------------------
  // ── Biome → Music mapping ──────────────────────────────────
  // Defaults to Cyberleaf looping tracks (all loop-safe by design).
  // MUSIC_SONGS originals remain in the manifest as alternatives.
  var _BIOME_MUSIC = {
    FOREST:       'music-cl-far-away',           // pastoral, adventurous
    GREY_CAVE:    'music-cl-deep-caves',          // dark, underground
    MALL:         'music-cl-arcade-jam',           // upbeat, commercial
    INDUSTRIAL:   'music-cl-waking-demons',        // heavy, mechanical
    OFFICE:       'music-cl-radio-kid',            // chill, modern
    AEROSPACE:    'music-cl-space-full-stars',      // cosmic, expansive
    LAKE:         'music-cl-yet-another-journey',  // calm, watery
    SKI_MOUNTAIN: 'music-cl-dont-fall-clouds'      // elevated, airy
  };

  // Interior biome key → music track.  Nested interiors (floor N.N.N)
  // with their own biome get specific BGM; everything else falls back
  // to the Cyberleaf default interior track.
  var _INTERIOR_MUSIC = {
    INTERIOR_TAVERN:           'music-cl-capt-chip-pants',    // lively pub vibe
    INTERIOR_TAVERN_BASEMENT:  'music-cl-deep-caves',         // dark basement
    INTERIOR_CHURCH:           'music-cl-gods-philosophers',  // sacred, thoughtful
    INTERIOR_STRIP_MALL:       'music-cl-arcade-jam',         // commercial bustle
    INTERIOR_FACTORY:          'music-cl-trial-of-spikes',    // dangerous machinery
    INTERIOR_JUNKYARD:         'music-cl-8bit-ninjas',        // scrappy, retro
    INTERIOR_SILO:             'music-cl-going-up',           // vertical, tense
    INTERIOR_SAWMILL:          'music-cl-fight-for-lives'     // danger, blades
  };

  /**
   * Pick and play the right music track for the current biome + floor.
   * Day/night alternation: even floors are night.
   *
   * Interior audio rules (n = main floor, n.n = shallow interior, n.n.n = deep):
   *   n     → biome music at full volume, normal footsteps
   *   n.n   → KEEP biome music but dim 60%, boost footsteps 20%
   *   n.n.n → SWITCH to interior-specific track, restore music volume, boost footsteps 20%
   */
  function _playBiomeMusic(ctx) {
    if (typeof AudioSystem === 'undefined' || !AudioSystem.playMusic) return;

    var floor = ctx.getFloor();
    var isInterior = !!ctx.currentInteriorFloorId;
    // Stack depth: 0 = main floor, 1 = shallow interior (n.n), 2+ = deep interior (n.n.n)
    var interiorDepth = ctx.interiorFloorStack ? ctx.interiorFloorStack.length : 0;

    // ── Onboarding music guard ──────────────────────────────────
    // CLUBBED_TO_DEATH spans launch → floor 0 → tavern → floor 1.
    // On floors 0-1 and their shallow interiors, keep the onboarding
    // track playing.  On floor ≥ 2 the guard drops and biome music
    // takes over — no jarring cut, just a clean handoff.
    if (AudioSystem.isOnboardingMusic && AudioSystem.isOnboardingMusic()) {
      if (floor < 2 && interiorDepth <= 1) {
        // Still in onboarding territory — keep CLUBBED_TO_DEATH
        // But still apply interior audio layering if in a building
        if (isInterior && interiorDepth === 1) {
          AudioSystem.setMusicDim(0.25);
          AudioSystem.setFootstepBoost(1.2);
        } else {
          AudioSystem.setMusicDim(1.0);
          AudioSystem.setFootstepBoost(1.0);
        }
        return;
      }
      // Past onboarding territory — clear the guard, fall through
      AudioSystem.setOnboardingMusic(false);
    }

    var biome = null;
    try { biome = ctx.getBiome(floor); } catch (e) {}

    // ── Interior floors ─────────────────────────────────────────
    if (isInterior) {
      if (interiorDepth >= 2) {
        // Deep interior (n.n.n) — switch to interior-specific music
        var deepTrack = 'music-cl-source-of-mana';  // default interior BGM
        if (typeof InteriorFloors !== 'undefined' && InteriorFloors.getAuthoredLayout) {
          var deepLayout = InteriorFloors.getAuthoredLayout(ctx.currentInteriorFloorId);
          if (deepLayout && deepLayout.interiorBiome && _INTERIOR_MUSIC[deepLayout.interiorBiome]) {
            deepTrack = _INTERIOR_MUSIC[deepLayout.interiorBiome];
          }
        }
        AudioSystem.setMusicDim(1.0);       // full volume for dedicated track
        AudioSystem.setFootstepBoost(1.2);   // louder footsteps indoors
        AudioSystem.playMusic(deepTrack);
      } else {
        // Shallow interior (n.n) — keep current biome music, just dim it
        AudioSystem.setMusicDim(0.25);       // 75% quieter
        AudioSystem.setFootstepBoost(1.2);   // louder footsteps indoors
        // Don't call playMusic — keep whatever's already playing
      }
      return;
    }

    // ── Main floor — restore full music volume + normal footsteps ──
    AudioSystem.setMusicDim(1.0);
    AudioSystem.setFootstepBoost(1.0);

    // Try to match biome key from the BIOMES constant on ctx
    var biomeKey = null;
    if (biome && typeof ctx.BIOMES === 'object') {
      var keys = Object.keys(ctx.BIOMES);
      for (var i = 0; i < keys.length; i++) {
        if (ctx.BIOMES[keys[i]] === biome) { biomeKey = keys[i]; break; }
      }
    }

    var track = biomeKey ? _BIOME_MUSIC[biomeKey] : null;

    // Day/night override for forest/lake/exterior biomes
    if (!track || track === 'music-forest' || track === 'music-exterior') {
      var isNight = (floor % 2 === 0);
      if (biomeKey === 'FOREST' || biomeKey === 'LAKE') {
        track = isNight ? 'music-exterior-night' : 'music-forest';
      } else if (!track) {
        track = isNight ? 'music-exterior-night' : 'music-exterior';
      }
    }

    // playMusic auto-skips if same track is already playing (same-biome floor change)
    AudioSystem.playMusic(track);
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

    // ── Door contract audio: resolve sounds for this exit ──
    // Source = current interior floorId we're leaving
    // Target = where we're going (parent interior or main floor)
    var _exitSourceId = exitingFromFloorId || ctx.currentInteriorFloorId || null;
    var _exitTargetId = prev.floorId || String(prev.mainFloor || '0');
    var _exitDoor = _resolveDoorSounds(_exitSourceId, _exitTargetId, { direction: 'up' });
    _playDoorSequence(_exitDoor.sounds);

    // Pre-fade delay: let door open sound play before screen goes dark
    var _exitPreDelay = _exitDoor.preFadeDelay;

    setTimeout(function () {
      _fadeOut(ctx);
    }, _exitPreDelay);

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

        // ── Audio: resume biome music for parent floor ──
        _playBiomeMusic(ctx);
      }
      _fadeIn(ctx);
    }, 260 + _exitPreDelay);
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

    // ── Door contract audio: world retreat = ascending (going back up) ──
    var _retSrc = String(ctx.getFloor());
    var _retTgt = String(Math.max(0, ctx.getFloor() - 1));
    var _retDoor = _resolveDoorSounds(_retSrc, _retTgt, { direction: 'up' });
    _playDoorSequence(_retDoor.sounds);
    var _retPreDelay = _retDoor.preFadeDelay;

    setTimeout(function () { _fadeOut(ctx); }, _retPreDelay);

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

      // ── Audio: start biome-appropriate music ──
      _playBiomeMusic(ctx);

      _fadeIn(ctx);
    }, 260 + _retPreDelay);
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

    try { ctx.setLastExitPos({ x: ctx.player.x, y: ctx.player.y }); } catch (e0) {}
    ctx.setSpawnFromLastExitPos('advance');

    // ── Door contract audio: world advance = descending (going deeper) ──
    var _advSrc = String(ctx.getFloor());
    var _advTgt = String(ctx.getFloor() + 1);
    var _advDoor = _resolveDoorSounds(_advSrc, _advTgt, { direction: 'down' });
    _playDoorSequence(_advDoor.sounds);
    var _advPreDelay = _advDoor.preFadeDelay;

    // Stop current music (skip during onboarding)
    if (typeof AudioSystem !== 'undefined' && AudioSystem.stopMusic && !AudioSystem.isOnboardingMusic()) {
      AudioSystem.stopMusic();
    }

    // Fade-out (delayed by pre-fade so player hears door open)
    setTimeout(function () {
      if (ctx.useInteractiveGrid) {
        var gridContainer = document.getElementById('rogue-grid-mobile');
        if (gridContainer) { gridContainer.style.opacity = '0'; gridContainer.style.transition = 'opacity 0.3s ease-out'; }
      }
    }, _advPreDelay);

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

      // ── Audio: start biome-appropriate music ──
      _playBiomeMusic(ctx);

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
    }, 300 + _advPreDelay);

    return { lines: ['EXTRACTING...'], prompt: ctx.getPrompt(), stayActive: true };
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------
  return {
    exitInteriorFloor: exitInteriorFloor,
    retreatFloor: retreatFloor,
    advanceFloor: advanceFloor,
    playBiomeMusic: _playBiomeMusic  // exposed for interior-floor-system entry
  };
})();
