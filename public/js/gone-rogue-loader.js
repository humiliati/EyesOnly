/* ============================================================
   Gone Rogue — Lazy Module Loader

   Defers ~130 game scripts to background loading AFTER the
   splash screen has painted. Scripts load sequentially to
   preserve dependency order. Game systems init only after
   all scripts are available.

   The splash screen and terminal work immediately.
   Game modules load silently in the background.
   If the user types "rogue" before loading finishes,
   a brief "INITIALIZING..." message appears.
   ============================================================ */
(function () {
  'use strict';

  // ── All game module scripts in dependency order ──
  // This list mirrors the original <script> tag order from index.html.
  // Changing the order here may break module dependencies.
  var SCRIPTS = [
    'js/highscore-state.js',
    'js/gamestate.js?v=20260306f',
    'js/card-system.js',
    'js/loot-table-manager.js',
    'js/synergy-engine.js',
    'js/enemy-steal-system.js?v=20260305k',
    'js/enemy-deck-hydrator.js',
    'js/synergy-integration.js',
    'js/cascade-resolver.js',
    'js/synergy-ui.js',
    'js/ropeManager.js?v=20260305k',
    'js/lever.js',
    'js/button.js',
    'js/resource-manager.js',
    // card-disposal-system.js — moved to sync in index.html (inventory drag-to-debrief needs it early)
    'js/drop-zone-detector.js',
    'js/commerce-drag-drop-system.js',
    'js/passive-items-system.js',
    'js/passive-items-ui.js',
    // mok-animation-cycles.js, mok-visual-engine.js, mok-state-machine.js, debrief-feed-controller.js — moved to sync in index.html
    'js/seeded-rng.js',
    'js/pet-follower.js',
    'js/gone-rogue-canvas.js?v=20260305d',
    'js/lighting-system.js?v=20260305k',
    // tooltip-system.js — moved to sync in index.html (history toggle + interjections need it early)
    'js/dialogue-system.js',
    'js/drift-vector-system.js?v=20260305f',
    'js/ground-effects.js?v=20260305f',
    'js/secret-floors.js',
    'js/boss-encounters.js',
    'js/elite-enemies.js',
    'js/overhead-animator.js',
    'js/player-stack-manager.js',
    'js/pancake-stack.js',
    'js/interactive-items.js',
    'js/food-database.js',
    'js/food-ground-interaction.js',
    'js/item-spawner.js',
    'js/world-items.js?v=20260301',
    'js/environmental-synergy.js',
    'js/utils/name-utils.js',
    'js/environmental-drag-drop.js',
    'js/shop-system.js',
    'tests/agent-headless-adapter.js',
    'js/agent-integration.js',
    // kernel-manager.js, user-account.js, login-ui.js — moved to sync in index.html
    // awol-difficulty.js — moved to sync in index.html (must work before game modules load)
    'js/street-chronicles.js',
    'js/enemy-intent-system.js?v=20260305m',
    'js/tile-animation-system.js?v=20260305k',
    'js/gone-rogue-movement.js?v=20260309c',
    'js/sprint-trail-system.js?v=20260305b',
    'js/player-weapon-arrow.js?v=20260305b',
    'js/expression-database.js',
    'js/tooltip-thumb.js',
    'js/seeded-random.js',
    'js/interior-floors.js',
    'js/catacombs-generator.js',
    'js/tutorial-floors.js?v=20260306b',
    'js/floor-metadata-registry.js',
    'js/ui/onboarding-splash.js',
    'js/ui/character-creation.js',
    'js/ui/welcome-back.js',
    'js/ui/tier-up-announcement.js',
    'js/ui/run-summary.js',
    'js/discovery-system.js',
    'js/enemy-ai-system.js',
    'js/loot-spill-system.js?v=20260307k',
    'js/str-combat-engine.js?v=20260307k',
    'js/floor-generator.js?v=20260302a',
    'js/pity-system.js',
    'js/box-deployment.js',
    'js/save-load.js',
    'js/sprite-fx-system.js?v=20260310a',
    'js/projectile-system.js?v=20260305b',
    'js/key-loot-gen.js',
    'js/currency-spawning.js?v=20260307k',
    'js/rendering-ui.js',
    'js/vendor-system.js',
    'js/inventory-management.js?v=20260305g',
    'js/ground-effects-system.js',
    'js/card-action-system.js',
    'js/locked-gate-system.js?v=20260304b',
    'js/active-item-system.js',
    'js/vent-system.js',
    'js/npc-gate-system.js',
    'js/death-exit-system.js?v=20260307m',
    'js/cost-printer-system.js',
    'js/door-contract-system.js',
    'js/floor-state-tracker.js',
    'js/door-contract-audio.js?v=20260309a',
    'js/floor-transition-system.js?v=20260309d',
    'js/biome-gate-system.js',
    'js/explosion-system.js?v=20260305j',
    'js/breakable-system.js?v=20260307k',
    'js/lantern-drag-system.js?v=20260306a',
    'js/combat-narration-system.js',
    'js/pickup-system.js?v=20260307j',
    'js/agent-command-system.js',
    'js/interior-floor-system.js?v=20260309a',
    'js/highscore-system.js',
    'js/player-interaction-system.js?v=20260307j',
    'js/stealth-system.js',
    'js/card-play-system.js?v=20260307p',
    'js/tap-move-system.js?v=20260305j',
    'js/onboarding-tutorial.js?v=20260307a',
    'js/begin-gameplay-system.js?v=20260307a',
    'js/command-process-system.js',
    'js/game-tick-system.js?v=20260309c',
    'js/player-action-system.js',
    'js/move-player-system.js?v=20260310a',
    'js/agent-api-system.js',
    'js/run-start-system.js?v=20260305k',
    'js/game-state-api.js',
    'js/tutorial-floor-gen.js?v=20260306b',
    'js/floor-gen-core.js?v=20260305k',
    'js/run-progression-state.js',
    'js/floor-path-enums.js',
    'js/awareness-config.js',
    'js/vendor-config.js',
    'js/boss-floor-registry.js',
    'js/bonfire-floor-registry.js',
    'js/box-deploy-config.js',
    'js/direction-parser.js',
    'js/biome-data-provider.js',
    'js/biome-config.js',
    'js/breakable-spawner.js?v=20260304b',
    'js/biome-visuals.js',
    'js/biome-visual-facade.js',
    'js/game-loop.js',
    'js/gone-rogue.js?v=20260310a',
    'js/gone-rogue-mobile.js?v=20260307k',
    'js/str-combat-window.js?v=20260305n',
    'js/backup-action-container.js',
    'js/ground-effect-card-mappings.js',
    'js/non-combat-event-bus.js',
    'js/shared-card-renderer.js?v=20260307n',
    'js/non-combat-state-store.js',
    'js/gone-rogue-data-registry.js',
    'js/shared-item-renderer.js',
    'js/portal-bridge.js',
    'js/gone-rogue-effect-interpreter.js?v=20260304b',
    'js/card-state-authority.js?v=20260307h',
    'js/card-transfer-manager.js?v=20260307f',
    'js/tag-synergy-engine.js',
    'js/enemy-card-interactability.js',
    'js/enemy-hand-display.js',
    'js/information-duel-engine.js',
    'js/enemy-card-interaction-handler.js',
    'js/information-duel-hud.js',
    'js/rogue-sidebar.js?v=20260304i',
    'js/non-combat-hud.js?v=20260307h',
    'js/card-drag-controller.js?v=20260307n',
    'js/hand-fan-component.js?v=20260307m',
    'js/str-victory-sequence.js?v=20260307h',
    'js/str-exit-sequence.js',
    'js/str-combat-integration.js?v=20260307m',
    'js/reserve-slots.js',
    'js/inventory-ui.js',
    'js/terminal/command-router.js',
  ];

  var _loaded     = false;
  var _loading    = false;
  var _failed     = false;
  var _callbacks  = [];
  var _loadedCount = 0;
  var _gameInited  = false;

  /**
   * Load all game scripts sequentially, preserving dependency order.
   * Calls all queued callbacks when complete.
   */
  function _loadAll(cb) {
    if (_loaded) { if (cb) cb(); return; }
    if (cb) _callbacks.push(cb);
    if (_loading) return; // already in progress, cb is queued
    _loading = true;
    _loadedCount = 0;

    console.log('[RogueLoader] Loading ' + SCRIPTS.length + ' game modules...');
    var t0 = performance.now();

    function next() {
      if (_loadedCount >= SCRIPTS.length) {
        _loaded = true;
        _loading = false;
        var elapsed = Math.round(performance.now() - t0);
        console.log('[RogueLoader] All ' + SCRIPTS.length + ' modules loaded in ' + elapsed + 'ms');

        // Flush all waiting callbacks
        var cbs = _callbacks.splice(0);
        for (var i = 0; i < cbs.length; i++) {
          try { cbs[i](); } catch (e) { console.error('[RogueLoader] Callback error:', e); }
        }
        return;
      }

      var src = SCRIPTS[_loadedCount];
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () {
        _loadedCount++;
        next();
      };
      s.onerror = function () {
        console.warn('[RogueLoader] Failed: ' + src);
        _loadedCount++; // skip and continue
        next();
      };
      document.head.appendChild(s);
    }

    next();
  }

  /**
   * Initialize all game subsystems that main.js would normally call.
   * Only runs once, after all scripts are loaded.
   */
  function _initGameSystems() {
    if (_gameInited) return;
    _gameInited = true;

    console.log('[RogueLoader] Initializing game subsystems');

    // UserAccount, LoginUI, KernelManager now load sync in index.html (already inited)
    if (typeof TerminalCommandRouter !== 'undefined' && TerminalCommandRouter.init) TerminalCommandRouter.init();
    if (typeof GAMESTATE !== 'undefined' && GAMESTATE.init) GAMESTATE.init();
    if (typeof GoneRogue !== 'undefined' && GoneRogue.init) GoneRogue.init();
    if (typeof ShopSystem !== 'undefined' && ShopSystem.init) ShopSystem.init();
    if (typeof ApiClient !== 'undefined' && ApiClient.init) ApiClient.init();
    // StreetChronicles and LoginShell are in the sync set, already inited by main.js
  }

  // ── Public API ──
  window.RogueLoader = {
    /**
     * Ensure all game modules are loaded, then call cb.
     * If already loaded, cb fires synchronously.
     */
    ensureLoaded: function (cb) {
      if (_loaded) {
        _initGameSystems();
        if (cb) cb();
        return;
      }
      _loadAll(function () {
        _initGameSystems();
        if (cb) cb();
      });
    },

    /** True once all scripts have executed */
    isLoaded: function () { return _loaded; },

    /** True while scripts are still loading */
    isLoading: function () { return _loading; },

    /** Fraction loaded (0–1) for progress display */
    progress: function () { return SCRIPTS.length ? _loadedCount / SCRIPTS.length : 1; },

    /** Number of scripts in the bundle */
    scriptCount: function () { return SCRIPTS.length; },
  };

  // ── Deferred loading: game modules only load when user launches a game ──
  // Previously loaded immediately after first paint. Now waits for
  // RogueLoader.ensureLoaded() (called by AWOL button, "rogue" command,
  // or "street" command). This keeps the terminal responsive for visitors
  // who just want to browse /booking, /contact, etc.
  //
  // To restore eager loading, uncomment the block below:
  // requestAnimationFrame(function () {
  //   requestAnimationFrame(function () {
  //     _loadAll(function () { _initGameSystems(); });
  //   });
  // });

})();
