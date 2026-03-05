/**
 * RunStartSystem — game run initialization: onboarding, seed setup,
 * system inits, charm bonuses, starter cards.
 * Extracted Phase 22 from gone-rogue.js.
 * Stateless IIFE module — all mutable state via ctx references.
 */
var RunStartSystem = (function() {
  'use strict';

  /**
   * Start a new rogue run (or resume an existing one).
   * @param {Object} context - { resume: bool }
   * @param {Object} ctx - Context from monolith
   * @returns {Object} Terminal response
   */
  function start(context, ctx) {
    context = context || {};
    ctx.setActive(true);
    ctx.setLoaded(true);

    // Show onboarding splash ("YOU'VE GONE ROGUE") for new runs.
    var _needsCharCreation = false;
    if (!context.resume && typeof CharacterCreation !== 'undefined') {
      var ps = (typeof TerminalCommandRouter !== 'undefined' && TerminalCommandRouter.getPlayerState)
        ? TerminalCommandRouter.getPlayerState() : {};
      _needsCharCreation = !ps.callsign;
    }

    if (!context.resume && typeof OnboardingSplash !== 'undefined' && OnboardingSplash.show) {
      var beginGameplay = ctx.beginGameplay;
      OnboardingSplash.show(function onSplashDone() {
        if (_needsCharCreation) {
          var tier = 0;
          try {
            var ps2 = TerminalCommandRouter.getPlayerState();
            tier = ps2.completedTiers || 0;
          } catch (e) {}
          CharacterCreation.show({
            tier: tier,
            onComplete: function () { beginGameplay(); }
          });
        } else if (typeof WelcomeBack !== 'undefined' && WelcomeBack.show) {
          var psWb = (typeof TerminalCommandRouter !== 'undefined' && TerminalCommandRouter.getPlayerState)
            ? TerminalCommandRouter.getPlayerState() : {};
          WelcomeBack.show({
            playerState: psWb,
            onComplete: function () { beginGameplay(); }
          });
        }
      });
    }

    // Default behavior: new run
    try {
      if (!context.resume) {
        var startFloor = 0;
        try {
          if (typeof AWOLDifficulty !== 'undefined' && AWOLDifficulty.getCurrentTier && AWOLDifficulty.getCurrentTier() >= 2) {
            startFloor = 1;
          }
        } catch (eAwol) {}
        ctx.setFloor(startFloor);
        ctx.setTurn(0);
        ctx.setLastExitPos(null);
        try { localStorage.removeItem(ctx.STORAGE_KEY); } catch (e1) {}
      }
    } catch (e0) {}

    // Disable scanlines for performance during gameplay
    document.body.classList.add('gone-rogue-active');

    // Initialize seeded generation for reproducible runs
    _initRunSeed(ctx);

    // Initialize highscore tracking
    ctx.setRunStartTime(Date.now());
    ctx.setCurrencyCollected(0);
    ctx.setTotalEnemiesSpawned(0);
    ctx.setEnemiesKilled(0);
    ctx.setTotalBreakableDamage(0);
    ctx.setTotalDamageDealt(0);
    ctx.setMaxSingleHit(0);
    ctx.setDamageMitigated(0);
    ctx.setRunCompleted(false);
    ctx.setPlayerDeaths(0);

    // Initialize death handler if available
    if (typeof DeathHandler !== 'undefined') {
      DeathHandler.resetStats();
    }

    // Initialize lighting system
    if (typeof LightingSystem !== 'undefined') {
      LightingSystem.init();
      if (typeof GoneRogueDataRegistry !== 'undefined') {
        GoneRogueDataRegistry.ready().then(function() {
          var lightingConfig = GoneRogueDataRegistry.getLightingConfig();
          if (lightingConfig) {
            LightingSystem.setConfig(lightingConfig);
            console.log('[GoneRogue] Lighting configuration loaded');
          }
        }).catch(function(err) {
          console.warn('[GoneRogue] Failed to load lighting config:', err);
        });
      }
      console.log('[GoneRogue] Lighting system initialized');
    }

    // Initialize various subsystems
    if (typeof SecretFloors !== 'undefined') { SecretFloors.init(); console.log('[GoneRogue] Secret floors system initialized'); }
    if (typeof GroundEffects !== 'undefined') { GroundEffects.init(); console.log('[GoneRogue] Ground effects system initialized'); }
    if (typeof LanternDragSystem !== 'undefined') { LanternDragSystem.reset(); console.log('[GoneRogue] Lantern drag system reset'); }
    if (typeof RopeManager !== 'undefined') { RopeManager.reset(); console.log('[GoneRogue] Rope manager reset'); }
    if (typeof OverheadAnimator !== 'undefined') { OverheadAnimator.init(); console.log('[GoneRogue] Overhead animator initialized'); }

    if (typeof TooltipThumb !== 'undefined') {
      var canvasOverlay = document.getElementById('gone-rogue-canvas');
      TooltipThumb.init(canvasOverlay || document.body);
      console.log('[GoneRogue] Tooltip thumb initialized');
    }

    if (typeof InteractiveItems !== 'undefined') { InteractiveItems.init(); console.log('[GoneRogue] Interactive items initialized'); }
    if (typeof ItemSpawner !== 'undefined') { ItemSpawner.init(); console.log('[GoneRogue] Item spawner initialized'); }
    if (typeof EnvironmentalSynergy !== 'undefined') { EnvironmentalSynergy.init(); console.log('[GoneRogue] Environmental synergy initialized'); }
    if (typeof EnvironmentalDragDrop !== 'undefined') { EnvironmentalDragDrop.init(); console.log('[GoneRogue] Environmental drag-drop initialized'); }
    if (typeof FoodDatabase !== 'undefined') { FoodDatabase.init(); console.log('[GoneRogue] Food database initialized'); }

    // Initialize from GAMESTATE if available
    var lines = [];
    var player = ctx.player;
    if (typeof GAMESTATE !== 'undefined') {
      var result = GAMESTATE.enterRogueMode(context);
      lines = result.lines || [];

      if (typeof PassiveItemsSystem !== 'undefined' && PassiveItemsSystem.resetRunState) {
        PassiveItemsSystem.resetRunState();
      }

      // Apply charm bonuses to player stats
      var persistent = GAMESTATE.getPersistentInventory();
      var loose = GAMESTATE.getLooseInventory();
      var allItems = persistent.concat(loose);

      var hpBonus = 0;
      var energyBonus = 0;
      allItems.forEach(function(item) {
        if (item && item.category === 'charm' && item.stats) {
          if (item.stats.hp) hpBonus += item.stats.hp;
          if (item.stats.energy) energyBonus += item.stats.energy;
        }
      });

      if (hpBonus > 0) {
        player.maxHp += hpBonus;
        player.hp += hpBonus;
      }
      if (energyBonus > 0) {
        player.maxEnergy += energyBonus;
        player.energy += energyBonus;
      }

      // Give guaranteed 3 starter cards if player has 0 cards
      if (typeof CardSystem !== 'undefined') {
        var looseInventory = GAMESTATE.getLooseInventory();
        if (looseInventory.length === 0) {
          var slot3Pool = ['Grenade', 'Smoke Bomb Mk0', 'Chaff Flare'];
          var slot3Pick = slot3Pool[Math.floor(ctx.rng() * slot3Pool.length)];
          var starterCards = ['Single Shot', 'Dodge', slot3Pick];

          for (var c = 0; c < starterCards.length; c++) {
            var cardRef = CardSystem.rollCard(starterCards[c], { source: 'starter_loadout', floor: 1 });
            if (cardRef) {
              // CHH: rollCard now returns CardRef { id: 'CI-...', qty: 1 }.
              // addToLoose is legacy (inventoryLoose) — it accepts objects.
              // Hydrate back to full object for loose inventory compat.
              var cardObj = (typeof CardStateAuthority !== 'undefined' && CardStateAuthority.hydrateCard)
                ? CardStateAuthority.hydrateCard(cardRef) : cardRef;
              if (cardObj) {
                // Ensure id is set for loose inventory tracking
                if (!cardObj.id && cardRef.id) cardObj = Object.assign({}, cardObj, { id: cardRef.id });
                GAMESTATE.addToLoose(cardObj);
              }
            }
          }

          var slot3Emoji = slot3Pick === 'Grenade' ? '\uD83D\uDCA3' : (slot3Pick === 'Smoke Bomb Mk0' ? '\uD83D\uDCA8' : '\uD83C\uDF87');
          lines.push('');
          lines.push('  \uD83D\uDCE6 STARTER LOADOUT DEPLOYED');
          lines.push('  3 COMBAT CARDS ADDED TO INVENTORY');
          lines.push('  \uD83C\uDFAF Single Shot | \uD83D\uDCA8 Dodge | ' + slot3Emoji + ' ' + slot3Pick + ' (1x use)');
          lines.push('');
        }
      }
    } else {
      lines = ['', 'GONE ROGUE MODE ACTIVATED', ''];
    }

    // If onboarding screens are active, defer gameplay start
    var _hasSplashChain = !context.resume && typeof OnboardingSplash !== 'undefined' && OnboardingSplash.show &&
      (_needsCharCreation || (typeof WelcomeBack !== 'undefined' && WelcomeBack.show));

    if (_hasSplashChain) {
      return {
        lines: ['', 'INITIALIZING...', ''],
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    // No onboarding overlay — start gameplay immediately
    return ctx.beginGameplay();
  }

  /**
   * Initialize seeded generation for reproducible runs.
   * @param {Object} ctx
   */
  function _initRunSeed(ctx) {
    if (typeof SeededRandom !== 'undefined') {
      var seed = SeededRandom.generateRandomSeed();
      var phrase = SeededRandom.generateSeedPhrase(seed);
      var rng = new SeededRandom.SeededRNG(seed);

      ctx.setCurrentSeed(seed);
      ctx.setCurrentSeedPhrase(phrase);
      ctx.setSeedRNG(rng);
      ctx.setRunSeed(seed);

      console.log('[GoneRogue] Run seed:', seed, '(' + phrase + ')');
      ctx.updateSeedDisplay();
      return;
    }

    if (typeof SeededRNG !== 'undefined' && typeof SeededRNG.init === 'function') {
      var legacySeed = SeededRNG.init();
      ctx.setRunSeed(legacySeed);
      ctx.setCurrentSeed(legacySeed);
      ctx.setCurrentSeedPhrase(null);
      ctx.setSeedRNG(null);
      console.log('[GoneRogue] Run seed:', legacySeed);
    }
  }

  return {
    start: start
  };
})();
