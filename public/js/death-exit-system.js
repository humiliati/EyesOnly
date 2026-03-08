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

  // Guard against duplicate death calls (e.g. explosion + fire ground effect in same cycle)
  var _deathInProgress = false;

  // ------------------------------------------------------------------
  // handlePlayerDeath — death screen, highscore, cause string, exit
  // ------------------------------------------------------------------
  function handlePlayerDeath(reason, context, ctx) {
    context = context || {};

    // Guard against double death (e.g. explosion blast + fire ground effect in same tick)
    if (_deathInProgress) {
      console.log('[DeathExit] Ignoring duplicate death call: ' + reason);
      return;
    }
    _deathInProgress = true;

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

    // ── Phase C: Player Death Drops ──────────────────────────────
    // Scatter the player's backup deck, equipped hand, and resources
    // on the ground at their death location. Skip if bonfired (inventory
    // persists death when bonfired; bonfires are not yet reachable so
    // all floors currently save inventory state — that's intentional).
    _scatterPlayerInventory(ctx);

    // Currency penalty preview
    var currencyBefore = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getCryptos) ? GAMESTATE.getCryptos() : 0;
    var currencyLost = Math.floor(currencyBefore * 0.5);

    // Hide the STR combat window + minimized capsule before the death overlay.
    // Without this, the combat window/capsule persists behind the death screen
    // and stays on-screen after the overlay fades.
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

    // Clear food consumption history + active food buffs on death
    if (typeof GAMESTATE !== 'undefined' && GAMESTATE.clearRecentFood) {
      GAMESTATE.clearRecentFood();
    }

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

    // Refresh debrief feed to show post-death resource values (HP=0, etc.)
    if (typeof DebriefFeedController !== 'undefined' && DebriefFeedController.refresh) {
      try { DebriefFeedController.refresh(); } catch (eDF) {}
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
      }
    }

    // Spawn loot
    if (deathResult.loot) {
      if (deathResult.loot.currency > 0) {
        ctx.spawnCurrency(enemy.x, enemy.y, deathResult.loot.currency);
      }

      // ── LootSpillSystem: collect ground drops → scatter → place ──
      var _desPending = [];
      var _desOrigAddItem = (typeof WorldItems !== 'undefined') ? WorldItems.addItem : null;
      var _desOrigItemsPush = ctx.items.push;
      if (typeof LootSpillSystem !== 'undefined') {
        if (_desOrigAddItem) { WorldItems.addItem = function(item) { _desPending.push(item); }; }
        ctx.items.push = function(item) { _desPending.push(item); };
      }

      if (deathResult.loot.ammo && deathResult.loot.ammo > 0) {
        var deathAmmo = {
          x: enemy.x, y: enemy.y, type: 'ammo',
          amount: deathResult.loot.ammo,
          spawnTime: Date.now(), decayTime: 45000,
          emoji: '📦', name: 'Ammo (' + deathResult.loot.ammo + ')'
        };
        if (typeof WorldItems !== 'undefined') { WorldItems.addItem(deathAmmo); } else { ctx.items.push(deathAmmo); }
      }

      // Spawn cards — CHH Step 3: canonical acquireNewCardDuringCombat pipeline
      // Track resolved card/charm info for callers (STR victory context)
      deathResult._resolvedCards = [];
      deathResult._resolvedCharms = [];
      var _dropCountCards = 0;
      if (deathResult.loot.cards && deathResult.loot.cards.length > 0 && typeof CardSystem !== 'undefined') {
        for (var i = 0; i < deathResult.loot.cards.length; i++) {
          if (deathResult.loot.cards[i].shouldDrop) {
            var baseType = CardSystem.getRandomBaseCard();
            var card = CardSystem.rollCard(baseType, { source: 'enemy_death', floor: ctx.floor || 0 });
            if (card && card.id) {
              _dropCountCards++;
              // CHH Step 3: Use canonical acquisition pipeline (refs → hand → backup cascade)
              var cardInsert = (typeof GAMESTATE !== 'undefined' && GAMESTATE.acquireNewCardDuringCombat)
                ? GAMESTATE.acquireNewCardDuringCombat(card.id, 1) : null;
              // Hydrate for display info
              var cardDef = (typeof CardStateAuthority !== 'undefined' && CardStateAuthority.hydrateCard)
                ? CardStateAuthority.hydrateCard(card) : card;
              if (cardInsert && cardInsert.success) {
                // Debrief feed + overhead animation for card-to-hand
                try {
                  if (typeof DebriefFeedController !== 'undefined' && DebriefFeedController.reportResourceChange) {
                    DebriefFeedController.reportResourceChange('Cards', 0, 1, '\uD83C\uDCA0 ' + ((cardDef && cardDef.name) || 'Card'));
                  }
                } catch (eDF) {}
                try {
                  if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
                    OverheadAnimator.showGenericExpression(ctx.player.x, ctx.player.y, '\uD83C\uDCA0', 800, '#800080');
                  }
                } catch (eOH) {}
              } else {
                // Hand full — drop on ground as fallback
                var deathCard = { x: enemy.x, y: enemy.y, type: 'card', card: card, spawnTime: Date.now(), decayTime: 45000 };
                if (typeof WorldItems !== 'undefined') { WorldItems.addItem(deathCard); } else { ctx.items.push(deathCard); }
              }
              // Track resolved card info for callers
              deathResult._resolvedCards.push({
                emoji: (cardDef && cardDef.emoji) || '🎴',
                name: (cardDef && cardDef.name) || 'Card',
                quality: (cardDef && cardDef.quality) || ''
              });
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
              var deathCharm = { x: enemy.x, y: enemy.y, type: 'charm', card: charm, spawnTime: Date.now(), decayTime: 45000 };
              if (typeof WorldItems !== 'undefined') { WorldItems.addItem(deathCharm); } else { ctx.items.push(deathCharm); }
              deathResult._resolvedCharms.push({ emoji: charm.emoji || '💎', name: charm.name || 'Charm' });
            }
          }
        }
      }

      // ── Canonical resource drops (COLLECTIBLES_CANON) ──
      if (deathResult.loot.resourceDrops) {
        for (var rd = 0; rd < deathResult.loot.resourceDrops.length; rd++) {
          _desPending.push(deathResult.loot.resourceDrops[rd]);
        }
      }

      // ── LootSpillSystem: restore interceptors, scatter, and place ──
      if (_desOrigAddItem) { WorldItems.addItem = _desOrigAddItem; }
      ctx.items.push = _desOrigItemsPush;
      if (_desPending.length > 0 && typeof LootSpillSystem !== 'undefined') {
        LootSpillSystem.scatterItems(enemy.x, enemy.y, _desPending, ctx);
        var DES_DECAY_FLOOR = 45000;
        for (var dp = 0; dp < _desPending.length; dp++) {
          var _dpItem = _desPending[dp];
          if (_dpItem.decayTime && _dpItem.decayTime < DES_DECAY_FLOOR) {
            _dpItem.decayTime = DES_DECAY_FLOOR;
          }
          if (_dpItem._isCurrency) {
            delete _dpItem._isCurrency;
            if (typeof WorldItems !== 'undefined') { WorldItems.addCurrency(_dpItem); }
            else { ctx.currencies ? ctx.currencies.push(_dpItem) : void 0; }
          } else {
            if (typeof WorldItems !== 'undefined') { WorldItems.addItem(_dpItem); }
            else { ctx.items.push(_dpItem); }
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
  // ------------------------------------------------------------------
  // _scatterPlayerInventory — Phase C death drops
  //
  // Gathers the player's equipped hand, backup deck, and consumable
  // resources (ammo, battery), builds ground-drop objects, and scatters
  // them around the player's death position via LootSpillSystem.
  //
  // Bonfire note: The ONLY thing that persists death when bonfired is
  // the card vault (persistentCards). Everything else — equipped hand,
  // backup deck, resources — is always lost and scattered on death.
  // ------------------------------------------------------------------
  var PLAYER_DROP_DECAY = 60000; // 60s — generous so items are visible during death screen

  function _scatterPlayerInventory(ctx) {
    if (typeof GAMESTATE === 'undefined') return;
    if (typeof LootSpillSystem === 'undefined') return;

    var px = ctx.player.x;
    var py = ctx.player.y;

    var pendingDrops = [];
    var now = Date.now();

    // ── 1. Equipped hand (cards in hand) ──
    var hand = GAMESTATE.getCardsInHand ? GAMESTATE.getCardsInHand() : [];
    for (var h = 0; h < hand.length; h++) {
      var hRef = hand[h];
      if (!hRef || !hRef.id) continue;

      // Resolve card definition for display info
      var hDef = null;
      if (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getCard) {
        try { hDef = GoneRogueDataRegistry.getCard(hRef.id); } catch (e) {}
      }

      pendingDrops.push({
        x: px, y: py,
        type: 'card',
        card: hDef || { id: hRef.id, name: hRef.id, emoji: '🂠' },
        cardRef: hRef,
        _deathDrop: true,
        spawnTime: now,
        decayTime: PLAYER_DROP_DECAY
      });
    }

    // ── 2. Backup deck ──
    var backup = GAMESTATE.getBackupCards ? GAMESTATE.getBackupCards() : [];
    for (var b = 0; b < backup.length; b++) {
      var bRef = backup[b];
      if (!bRef || !bRef.id) continue;

      var bDef = null;
      if (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getCard) {
        try { bDef = GoneRogueDataRegistry.getCard(bRef.id); } catch (e) {}
      }

      pendingDrops.push({
        x: px, y: py,
        type: 'card',
        card: bDef || { id: bRef.id, name: bRef.id, emoji: '🂠' },
        cardRef: bRef,
        _deathDrop: true,
        spawnTime: now,
        decayTime: PLAYER_DROP_DECAY
      });
    }

    // ── 3. Resources: Ammo ──
    var ammo = GAMESTATE.getAmmo ? GAMESTATE.getAmmo() : 0;
    if (ammo > 0) {
      pendingDrops.push({
        x: px, y: py,
        type: 'ammo',
        amount: ammo,
        emoji: '⁍',
        name: 'Ammo (' + ammo + ')',
        _deathDrop: true,
        _isCurrency: true,
        spawnTime: now,
        decayTime: PLAYER_DROP_DECAY
      });
    }

    // ── 4. Resources: Battery ──
    var battery = GAMESTATE.getBattery ? GAMESTATE.getBattery() : 0;
    if (battery > 0) {
      pendingDrops.push({
        x: px, y: py,
        type: 'gem',
        amount: battery,
        glyph: '◈',
        name: 'Battery Cell (' + battery + ')',
        _deathDrop: true,
        spawnTime: now,
        decayTime: PLAYER_DROP_DECAY
      });
    }

    // ── 5. Resources: Currency (visual only — penalty applied separately) ──
    var cryptos = GAMESTATE.getCryptos ? GAMESTATE.getCryptos() : 0;
    var currencyDrop = Math.floor(cryptos * 0.5); // Show 50% as scatter (matches penalty)
    if (currencyDrop > 0) {
      pendingDrops.push({
        x: px, y: py,
        amount: currencyDrop,
        emoji: '💰',
        glyph: '¢',
        name: '¢' + currencyDrop,
        _deathDrop: true,
        _isCurrency: true,
        spawnTime: now,
        decayTime: PLAYER_DROP_DECAY
      });
    }

    if (pendingDrops.length === 0) return;

    // ── Scatter via LootSpillSystem ──
    LootSpillSystem.scatterItems(px, py, pendingDrops, ctx);

    // ── Place items on ground ──
    for (var d = 0; d < pendingDrops.length; d++) {
      var drop = pendingDrops[d];
      if (drop._isCurrency) {
        delete drop._isCurrency;
        if (typeof WorldItems !== 'undefined' && WorldItems.addCurrency) {
          WorldItems.addCurrency(drop);
        }
      } else {
        if (typeof WorldItems !== 'undefined' && WorldItems.addItem) {
          WorldItems.addItem(drop);
        } else if (ctx.items) {
          ctx.items.push(drop);
        }
      }
    }
  }

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

    // Clear food consumption history + active food buffs on exit
    if (typeof GAMESTATE !== 'undefined' && GAMESTATE.clearRecentFood) {
      GAMESTATE.clearRecentFood();
    }

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
    exitRogue: exitRogue,
    resetDeathGuard: function() { _deathInProgress = false; }
  };
})();
