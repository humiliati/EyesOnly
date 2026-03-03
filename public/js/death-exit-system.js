/**
 * DeathExitSystem – IIFE module (Delegate Pattern)
 *
 * Owns: nothing (stateless — all state passed via ctx)
 * Handles: player death (death screen, highscore, cause string),
 *          enemy death (loot spawning, kill tracking, STR cleanup),
 *          run exit (combat cleanup, summary screen, GAMESTATE teardown).
 *
 * Loaded before gone-rogue.js via <script> tag.
 */
var DeathExitSystem = (function () {
  'use strict';

  // ------------------------------------------------------------------
  // handlePlayerDeath — death screen, highscore, cause string, exit
  // ------------------------------------------------------------------
  function handlePlayerDeath(reason, context, ctx) {
    context = context || {};

    ctx.playerDeaths++;

    // Use DeathHandler if available
    var deathResult;
    if (typeof DeathHandler !== 'undefined') {
      deathResult = DeathHandler.handlePlayerDeath(
        ctx.player, reason,
        {
          enemy: context.enemy,
          floor: ctx.floor,
          damage: context.damage,
          location: { x: ctx.player.x, y: ctx.player.y }
        }
      );
    } else {
      deathResult = {
        messages: [
          '', '═══════════════════════════════════',
          '        💀 SIGNAL LOST 💀',
          '═══════════════════════════════════',
          '', 'You have been defeated.',
          'Floor reached: ' + ctx.floor, ''
        ]
      };
    }

    // Submit highscore on death
    if (typeof HighscoreState !== 'undefined') {
      ctx.submitHighscore();
    }

    // Record run in player profile
    if (typeof TerminalCommandRouter !== 'undefined' && TerminalCommandRouter.recordRun) {
      TerminalCommandRouter.recordRun({ success: false, floor: ctx.floor, deaths: 1 });
    }

    // Build death cause string
    var causeStr = '// SIGNAL LOST';
    if (reason === 'combat_damage' && context.enemy) {
      causeStr = '// KILLED BY ' + (context.enemy.name || 'HOSTILE').toUpperCase();
    } else if (reason === 'burning') {
      causeStr = '// BURNED TO DEATH';
    } else if (reason === 'toxin') {
      causeStr = '// TOXIC EXPOSURE';
    } else if (reason === 'trap') {
      causeStr = '// CAUGHT IN TRAP';
    } else if (reason === 'environmental_hazard') {
      causeStr = '// ENVIRONMENTAL HAZARD';
    }

    // Currency penalty preview
    var currencyBefore = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getCryptos) ? GAMESTATE.getCryptos() : 0;
    var currencyLost = Math.floor(currencyBefore * 0.5);

    // Show death screen overlay
    if (typeof STRCombatWindow !== 'undefined' && typeof STRCombatWindow.showDeathScreen === 'function') {
      STRCombatWindow.showDeathScreen({
        floor: ctx.floor,
        enemiesKilled: ctx.enemiesKilled,
        runTimeMs: ctx.runStartTime ? (Date.now() - ctx.runStartTime) : 0,
        currencyLost: currencyLost,
        cause: causeStr
      });
    }

    // Exit rogue mode
    return exitRogue(false, ctx);
  }

  // ------------------------------------------------------------------
  // handleEnemyDeath — loot spawning, kill tracking, STR cleanup
  // ------------------------------------------------------------------
  function handleEnemyDeath(enemy, source, context, ctx) {
    context = context || {};

    var deathResult;
    if (typeof DeathHandler !== 'undefined') {
      deathResult = DeathHandler.handleEnemyDeath(
        enemy, source,
        {
          player: ctx.player,
          damage: context.damage,
          location: { x: enemy.x, y: enemy.y },
          hazardType: context.hazardType,
          bossLoot: context.bossLoot
        }
      );
    } else {
      deathResult = {
        playerCredit: source === 'player' || source === 'player_environment',
        loot: { cards: [], charms: [], currency: 0, xp: 0 },
        messages: []
      };
    }

    // Update kill counter
    if (deathResult.playerCredit) {
      ctx.enemiesKilled++;

      if (!ctx.runState.firstCombatVictory) {
        ctx.runState.firstCombatVictory = true;
        console.log('[DeathExitSystem] First combat victory achieved - gates now eligible');
      }
    }

    // Spawn loot
    if (deathResult.loot) {
      if (deathResult.loot.currency > 0) {
        ctx.spawnCurrency(enemy.x, enemy.y, deathResult.loot.currency);
      }

      if (deathResult.loot.ammo && deathResult.loot.ammo > 0) {
        var deathAmmo = {
          x: enemy.x, y: enemy.y, type: 'ammo',
          amount: deathResult.loot.ammo,
          spawnTime: Date.now(), decayTime: 30000,
          emoji: '📦', name: 'Ammo (' + deathResult.loot.ammo + ')'
        };
        if (typeof WorldItems !== 'undefined') { WorldItems.addItem(deathAmmo); } else { ctx.items.push(deathAmmo); }
      }

      // Spawn cards — Phase 5: insert directly to hand, ground-drop fallback
      var _dropCountCards = 0;
      if (deathResult.loot.cards && deathResult.loot.cards.length > 0 && typeof CardSystem !== 'undefined') {
        for (var i = 0; i < deathResult.loot.cards.length; i++) {
          if (deathResult.loot.cards[i].shouldDrop) {
            var baseType = CardSystem.getRandomBaseCard();
            var card = CardSystem.rollCard(baseType);
            if (card) {
              _dropCountCards++;
              // Try direct hand insert first
              var cardInsert = (typeof GAMESTATE !== 'undefined' && GAMESTATE.addCard)
                ? GAMESTATE.addCard(card) : null;
              if (cardInsert && cardInsert.success) {
                // Debrief feed + overhead animation for card-to-hand
                try {
                  if (typeof DebriefFeedController !== 'undefined' && DebriefFeedController.reportResourceChange) {
                    DebriefFeedController.reportResourceChange('Cards', 0, 1, '\uD83C\uDCA0 ' + (card.name || 'Card'));
                  }
                } catch (eDF) {}
                try {
                  if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
                    OverheadAnimator.showGenericExpression(ctx.player.x, ctx.player.y, '\uD83C\uDCA0', 800, '#800080');
                  }
                } catch (eOH) {}
              } else {
                // Hand full — drop on ground as fallback
                var deathCard = { x: enemy.x, y: enemy.y, type: 'card', card: card, spawnTime: Date.now(), decayTime: 30000 };
                if (typeof WorldItems !== 'undefined') { WorldItems.addItem(deathCard); } else { ctx.items.push(deathCard); }
              }
            }
          }
        }
      }

      // Spawn charms
      var _dropCountItems = 0;
      if (deathResult.loot.charms && deathResult.loot.charms.length > 0 && typeof CardSystem !== 'undefined') {
        for (var j = 0; j < deathResult.loot.charms.length; j++) {
          if (deathResult.loot.charms[j].shouldDrop) {
            var charm = CardSystem.rollCommonCharm();
            if (charm) {
              _dropCountItems++;
              var deathCharm = { x: enemy.x, y: enemy.y, type: 'charm', card: charm, spawnTime: Date.now(), decayTime: 30000 };
              if (typeof WorldItems !== 'undefined') { WorldItems.addItem(deathCharm); } else { ctx.items.push(deathCharm); }
            }
          }
        }
      }

      // Loot summary overhead
      try {
        if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showStackedText) {
          var stacks = [];
          if (deathResult.loot.currency > 0) stacks.push({ text: 'CR+' + deathResult.loot.currency, color: '#FFFFFF' });
          if (deathResult.loot.ammo && deathResult.loot.ammo > 0) stacks.push({ text: 'AM+' + deathResult.loot.ammo, color: '#FFFFFF' });
          if (_dropCountCards > 0) stacks.push({ text: 'CD+' + _dropCountCards, color: '#FFFFFF' });
          if (_dropCountItems > 0) stacks.push({ text: 'IT+' + _dropCountItems, color: '#FFFFFF' });
          if (stacks.length) OverheadAnimator.showStackedText(enemy.x, enemy.y, stacks, 1200);
        }
      } catch (eLoot0) {}
    }

    // If dying enemy was active STR target, hard-clear STR state
    try {
      if (ctx.strCombatActive && ctx.strCombatEnemy && ctx.strCombatEnemy === enemy) {
        if (typeof StrCombatEngine !== 'undefined') StrCombatEngine.forceReset();
        ctx.setStrCombatActive(false);
        ctx.setStrCombatPhase('idle');
        ctx.setStrCombatEnemy(null);
        if (typeof STRCombatWindow !== 'undefined' && typeof STRCombatWindow.hide === 'function') {
          STRCombatWindow.hide();
        }
        if (typeof HandFanComponent !== 'undefined' && typeof HandFanComponent.hide === 'function') {
          HandFanComponent.hide();
          if (typeof HandFanComponent.clearSelection === 'function') HandFanComponent.clearSelection();
        }
        if (typeof BackupActionContainer !== 'undefined' && typeof BackupActionContainer.hide === 'function') {
          BackupActionContainer.hide();
        }
      }
    } catch (e0) {}

    return deathResult;
  }

  // ------------------------------------------------------------------
  // exitRogue — combat cleanup, summary screen, GAMESTATE teardown
  // ------------------------------------------------------------------
  function exitRogue(success, ctx) {
    ctx.setActive(false);
    ctx.stopGameLoop();

    // Clear STR combat UI
    if (typeof StrCombatEngine !== 'undefined') StrCombatEngine.forceReset();
    ctx.setStrCombatActive(false);
    ctx.setStrCombatPhase('idle');
    ctx.setStrCombatEnemy(null);
    try {
      if (typeof STRCombatWindow !== 'undefined' && STRCombatWindow.hide) STRCombatWindow.hide();
      if (typeof HandFanComponent !== 'undefined' && HandFanComponent.hide) HandFanComponent.hide();
      if (typeof BackupActionContainer !== 'undefined' && BackupActionContainer.hide) BackupActionContainer.hide();
    } catch (e0) {}

    // Re-enable scanlines
    document.body.classList.remove('gone-rogue-active');

    // Submit highscore on successful extraction
    if (success && typeof HighscoreState !== 'undefined') {
      ctx.submitHighscore();
    }

    // Record run
    if (typeof TerminalCommandRouter !== 'undefined' && TerminalCommandRouter.recordRun) {
      TerminalCommandRouter.recordRun({ success: success, floor: ctx.floor, deaths: 0 });
    }

    // Show post-run summary
    if (typeof RunSummary !== 'undefined' && RunSummary.show) {
      var _rsNewTier = 0;
      if (typeof TerminalCommandRouter !== 'undefined' && TerminalCommandRouter.getPlayerState) {
        var _rsPs = TerminalCommandRouter.getPlayerState();
        _rsNewTier = _rsPs.completedTiers || 0;
      }

      RunSummary.show({
        success: success,
        floor: ctx.floor,
        duration: ctx.runStartTime ? (Date.now() - ctx.runStartTime) : 0,
        kills: ctx.enemiesKilled || 0,
        currency: ctx.currencyCollected || 0,
        score: (typeof HighscoreState !== 'undefined' && success)
          ? HighscoreState.calculateGoneRogueScore({
              currencyFound: ctx.currencyCollected, interactivesUsed: 0,
              enemiesAvoided: Math.max(0, ctx.totalEnemiesSpawned - ctx.enemiesKilled),
              breakableDamage: ctx.totalBreakableDamage, damageMitigated: ctx.damageMitigated
            }) : 0,
        tierUp: success && ctx.runCompleted && _rsNewTier > 0,
        newTier: _rsNewTier
      });
    }

    // Restore mobile keyboard
    if (typeof Terminal !== 'undefined' && typeof Terminal.restoreMobileKeyboard === 'function') {
      Terminal.restoreMobileKeyboard();
    }

    // Hide mobile UI
    if (ctx.hideMobileUI) ctx.hideMobileUI();

    // Hide reserve card slots
    if (typeof ReserveSlots !== 'undefined') ReserveSlots.hide();

    // Switch debrief feed back
    if (typeof DebriefFeedController !== 'undefined') DebriefFeedController.setMode('mainMenu');

    var result = {
      success: success,
      unlockedSlot: success,
      extractedItem: null
    };

    if (typeof GAMESTATE !== 'undefined') {
      var exitResult = GAMESTATE.exitRogueMode(result);
      return { lines: exitResult.lines, stayActive: false };
    }

    return {
      lines: ['', 'EXITING GONE ROGUE', 'RETURNING TO STREET CHRONICLES', ''],
      stayActive: false
    };
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------
  return {
    handlePlayerDeath: handlePlayerDeath,
    handleEnemyDeath: handleEnemyDeath,
    exitRogue: exitRogue
  };
})();
