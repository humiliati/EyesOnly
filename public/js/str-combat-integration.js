/* ============================================================
   STR Combat UI Integration
   Connects new STR Combat Window and Hand Fan components
   with existing GoneRogue combat system
   ============================================================ */

(function() {
  'use strict';

  // Wait for all components to be ready
  function initIntegration() {
    if (typeof GoneRogue === 'undefined' ||
        typeof STRCombatWindow === 'undefined' ||
        typeof HandFanComponent === 'undefined') {
      console.log('[STRIntegration] Waiting for components...');
      setTimeout(initIntegration, 100);
      return;
    }

    console.log('[STRIntegration] Initializing STR Combat UI integration');

    // Store original functions
    var _originalEnterCombat = null;
    var _originalShowUI = null;
    var _originalExitCombat = null;

    // Hook into combat state changes
    _hookCombatSystem();

    // Listen for hand overflow events — show tooltip when rightmost card is auto-ejected
    window.addEventListener('rogue-hand-overflow', function(e) {
      var detail = e.detail || {};
      var ejected = detail.ejectedCard;
      var cardName = '?';
      if (ejected && ejected.id) {
        try {
          if (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getCard) {
            var def = GoneRogueDataRegistry.getCard(ejected.id);
            if (def && def.name) cardName = def.name;
            else cardName = ejected.id;
          } else {
            cardName = ejected.id;
          }
        } catch (eN) { cardName = ejected.id; }
      }
      if (typeof TooltipSystem !== 'undefined') {
        TooltipSystem.showPersistent('📤 Hand full — ' + cardName + ' sent to backup', 1800);
      }
      console.log('[STRIntegration] Hand overflow: ejected "' + cardName + '" to backup');
    });
  }

  /**
   * Hook into the existing GoneRogue combat system
   */
  function _hookCombatSystem() {
    // Monitor for STR combat state changes
    setInterval(function() {
      _updateCombatUI();
    }, 100); // Check every 100ms
  }

  /**
   * Update combat UI based on current state
   */
  function _updateCombatUI() {
    if (typeof GoneRogue === 'undefined') return;

    var isActive = GoneRogue.isStrCombatActive && GoneRogue.isStrCombatActive();
    var combatState = GoneRogue.getStrCombatState && GoneRogue.getStrCombatState();

    if (isActive && combatState && combatState.active) {
      _showCombatWindow(combatState);
      _showHandFan(combatState);
      _showBackupActions(combatState);
    } else {
      _hideCombatWindow();
      _hideHandFan();
      _hideBackupActions();
    }
  }

  /**
   * Show STR Combat Window
   * @param {Object} combatState - Current combat state
   */
  var _lastWindowSig = null;
  var _combatSessionActive = false;

  function _sig(combatState, enemyType) {
    try {
      var r = (typeof combatState.round === 'number' && isFinite(combatState.round)) ? combatState.round : 1;
      var f = (typeof combatState.floor === 'number' && isFinite(combatState.floor)) ? combatState.floor : 1;
      var e = combatState.enemy || {};
      var p = combatState.player || {};
      var intent = '';
      try {
        if (e.intentState && e.intentState.expression && e.intentState.expression.glyph) intent = String(e.intentState.expression.glyph);
      } catch (e0) {}

      return [
        'r=' + r,
        'f=' + f,
        'et=' + (enemyType || ''),
        'e=' + (e.emoji || ''),
        'eh=' + (e.hp || 0) + '/' + (e.maxHp || 0),
        'ph=' + (p.hp || 0) + '/' + (p.maxHp || 0),
        'adv=' + (combatState.advantage || 'neutral'),
        'i=' + intent
      ].join('|');
    } catch (e1) {}
    return String(Date.now());
  }

  function _showCombatWindow(combatState) {
    var safeRound = (typeof combatState.round === 'number' && isFinite(combatState.round)) ? combatState.round : 1;
    var safeFloor = (typeof combatState.floor === 'number' && isFinite(combatState.floor)) ? combatState.floor : 1;

    // Detect countdown → selecting transition:
    // Once the STRCombatWindow timer is running (timeRemaining > 0 and window visible),
    // the countdown overlay has finished → transition to card selection phase.
    if (combatState.phase === 'countdown' && STRCombatWindow.isVisible()) {
      var rem = (typeof STRCombatWindow.getTimeRemainingMs === 'function') ? STRCombatWindow.getTimeRemainingMs() : 0;
      if (rem > 0) {
        // Countdown done, timer started — promote to selecting
        if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.setStrCombatPhase === 'function') {
          GoneRogue.setStrCombatPhase('selecting');
        }
      }
    }

    if (!STRCombatWindow.isVisible()) {
      // Determine enemy type for timer duration
      var enemyType = 'standard';
      if (combatState.enemy) {
        if (combatState.enemy.elite) {
          enemyType = 'elite';
        } else if (combatState.enemy.boss) {
          enemyType = 'boss';
        } else if (combatState.enemy.type === 'rat' || combatState.enemy.type === 'insect') {
          enemyType = 'quick';
        }
      }

      // Build window state
      var windowState = {
        round: safeRound,
        floor: safeFloor,
        enemy: {
          emoji: combatState.enemy ? combatState.enemy.emoji : '👾',
          hp: combatState.enemy ? combatState.enemy.hp : 0,
          maxHp: combatState.enemy ? combatState.enemy.maxHp : 5,
          intentState: combatState.enemy ? combatState.enemy.intentState : null
        },
        player: {
          hp: combatState.player ? combatState.player.hp : 10,
          maxHp: combatState.player ? combatState.player.maxHp : 10
        },
        advantage: combatState.advantage || 'neutral',
        enemyType: enemyType,
        countdownMessages: combatState.countdownMessages || null
      };

      if (_combatSessionActive) {
        // Mid-combat re-show: skip the 3-2-1 countdown
        STRCombatWindow.showWithoutCountdown(windowState);
      } else {
        // First display of this encounter: full countdown
        STRCombatWindow.show(windowState);
        _combatSessionActive = true;
      }
      _lastWindowSig = _sig(combatState, enemyType);
    } else {
      // Update existing window (only when state meaningfully changes)
      var nowSig = _sig(combatState, combatState.enemy && combatState.enemy.elite ? 'elite' : (combatState.enemy && combatState.enemy.boss ? 'boss' : (combatState.enemy && (combatState.enemy.type === 'rat' || combatState.enemy.type === 'insect') ? 'quick' : 'standard')));
      if (_lastWindowSig && nowSig === _lastWindowSig) {
        return;
      }
      _lastWindowSig = nowSig;

      var windowState = {
        round: safeRound,
        floor: safeFloor,
        enemy: {
          emoji: combatState.enemy ? combatState.enemy.emoji : '👾',
          hp: combatState.enemy ? combatState.enemy.hp : 0,
          maxHp: combatState.enemy ? combatState.enemy.maxHp : 5,
          intentState: combatState.enemy ? combatState.enemy.intentState : null
        },
        player: {
          hp: combatState.player ? combatState.player.hp : 10,
          maxHp: combatState.player ? combatState.player.maxHp : 10
        },
        advantage: combatState.advantage || 'neutral'
      };

      STRCombatWindow.updateState(windowState);
    }
  }

  /**
   * Hide STR Combat Window
   */
  function _hideCombatWindow() {
    if (STRCombatWindow.isVisible()) {
      STRCombatWindow.hide();
    }
    _combatSessionActive = false;
    _lastWindowSig = null;
    if (typeof CardStateAuthority !== 'undefined' && typeof CardStateAuthority.resetCombatDrawState === 'function') {
      CardStateAuthority.resetCombatDrawState();
    }
  }

  /**
   * Show Hand Fan with cards
   * @param {Object} combatState - Current combat state
   */
  var _lastResolvingTurn = false;
  var _lastHandSig = null;
  var _endOfTurnPushDone = false; // Guard: only push oldest card once per resolution cycle
  var _resolutionAnimRunning = false; // True while the attack-lunge sequence is playing

  /**
   * Play the full resolution animation sequence (~2.5 s total):
   *   1. Hand fan slides away toward NCH capsule  (300 ms)
   *   2. First attacker lunges                    (500 ms, starts at t=300)
   *   3. Second attacker lunges                   (500 ms, starts at t=700)
   *   4. Impact flash                             (   at t=1000)
   *   5. Intent system updates visually           (   at t=1200)
   *   6. Hand fan slides back                     (300 ms, starts at t=1700)
   *   → done callback fires at ~t=2000
   *
   * @param {boolean} playerFirst - If true, player attacks first
   * @param {Function} done       - Called when entire sequence finishes
   */
  function _playResolutionSequence(playerFirst, done) {
    var first  = playerFirst ? 'player' : 'enemy';
    var second = playerFirst ? 'enemy'  : 'player';

    // Step 1: slide hand fan away
    HandFanComponent.slideAway(function afterSlide() {

      // Step 2: first attacker lunge
      if (typeof STRCombatWindow !== 'undefined' && typeof STRCombatWindow.playAttackLunge === 'function') {
        STRCombatWindow.playAttackLunge(first, function afterFirst() {

          // Step 3: second attacker lunge (staggered 100ms after first finishes)
          setTimeout(function() {
            STRCombatWindow.playAttackLunge(second, function afterSecond() {

              // Step 4: impact flash
              if (typeof STRCombatWindow.flashImpact === 'function') {
                STRCombatWindow.flashImpact();
              }

              // Step 5: intent system update + brief pause before slide-back
              setTimeout(function() {
                // Step 6: slide hand fan back
                HandFanComponent.slideBack(function afterReturn() {
                  if (done) done();
                });
              }, 500); // 500ms pause for intent update + dramatic beat
            });
          }, 100);
        });
      } else {
        // STRCombatWindow doesn't have lunge — just wait 1.5s then slide back
        setTimeout(function() {
          HandFanComponent.slideBack(function() { if (done) done(); });
        }, 1500);
      }
    });
  }

  function _showHandFan(combatState) {
    // ── Per-turn draw reset via CardStateAuthority ──
    var currentRound = (typeof combatState.round === 'number' && isFinite(combatState.round)) ? combatState.round : 1;
    if (typeof CardStateAuthority !== 'undefined') {
      CardStateAuthority.checkRoundChange(currentRound);
    }

    // Get canonical hand cards via CardStateAuthority (single source of truth)
    var cards = [];
    var sigParts = [];
    if (typeof CardStateAuthority !== 'undefined') {
      cards = CardStateAuthority.expandHandForDisplay();
      sigParts = [CardStateAuthority.getSignature()];
      if (cards.length === 0) {
        sigParts = ['canonical:empty'];
      }
    } else if (typeof GAMESTATE !== 'undefined') {
      // Legacy fallback if CardStateAuthority not loaded yet
      var refs = (typeof GAMESTATE.getCardsInHand === 'function') ? GAMESTATE.getCardsInHand() : [];
      for (var i = 0; i < refs.length; i++) {
        var ref = refs[i];
        if (!ref || !ref.id) continue;
        var qty = (typeof ref.qty === 'number' ? ref.qty : 1);
        qty = Math.max(1, qty);
        sigParts.push(ref.id + 'x' + qty);
        var def = (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getCard) ? GoneRogueDataRegistry.getCard(ref.id) : null;
        if (!def) def = { id: ref.id, name: ref.id, emoji: '🃏', effects: [] };
        for (var q = 0; q < qty; q++) {
          cards.push(Object.assign({}, def, { id: ref.id }));
        }
      }
      if (cards.length === 0) {
        sigParts = ['canonical:empty'];
      }
    }

    var handSig = sigParts.join('|');

    // Fallback card injection (BLVCK) when the player is stranded.
    function _getFallbackCardDef() {
      try {
        if (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getCard) {
          var d = GoneRogueDataRegistry.getCard('ACT-000');
          if (d && !d._missing) return d;
        }
      } catch (e0) {}
      return { id: 'ACT-000', name: 'BLVCK', emoji: '■', targetType: 'enemy', costs: null, effects: [{ type: 'damage', value: 1 }] };
    }

    function _canAffordCard(def) {
      // Prefer CardStateAuthority (single affordability check)
      if (typeof CardStateAuthority !== 'undefined' && typeof CardStateAuthority.canAffordCard === 'function') {
        return CardStateAuthority.canAffordCard(def);
      }
      // Legacy fallback
      try {
        var costs = Array.isArray(def.costs) ? def.costs : null;
        if (!costs || !costs.length) return true;
        for (var i = 0; i < costs.length; i++) {
          var c = costs[i];
          if (!c || !c.kind) continue;
          var need = Number(c.amount || 0);
          var have = 0;
          if (c.kind === 'ammo' && typeof GAMESTATE.getAmmo === 'function') have = GAMESTATE.getAmmo();
          else if (c.kind === 'battery' && typeof GAMESTATE.getBattery === 'function') have = GAMESTATE.getBattery();
          else if (c.kind === 'energy' && typeof GAMESTATE.getEnergy === 'function') have = GAMESTATE.getEnergy();
          else if (c.kind === 'focus' && typeof GAMESTATE.getFocus === 'function') have = GAMESTATE.getFocus();
          if (have < need) return false;
        }
        return true;
      } catch (e1) {}
      return true;
    }

    var stranded = (cards.length === 0);
    if (!stranded) {
      // If none of the hand cards are affordable/playable, still inject fallback.
      stranded = !cards.some(function(c) { return c && _canAffordCard(c); });
    }

    if (stranded) {
      var fb = _getFallbackCardDef();
      cards = [Object.assign({}, fb, { id: 'ACT-000' })];
      sigParts = ['fallback:ACT-000'];
      handSig = sigParts.join('|');

      try {
        if (typeof TooltipSystem !== 'undefined') {
          TooltipSystem.showPersistent('■ STRUGGLE (BLVCK) — no cards available', 1100);
        }
      } catch (e2) {}
    }

    // ── Phase-aware hand fan state machine ──
    var phase = combatState.phase || 'selecting';
    var isResolvingTurn = (phase === 'resolving');

    // During countdown phase: don't show the hand fan yet — wait for 'selecting'
    if (phase === 'countdown') {
      _lastResolvingTurn = false;
      return; // Hand fan appears once countdown completes (phase → 'selecting')
    }

    // While the resolution animation sequence is running, skip normal
    // minimize/restore logic — the animation owns the hand fan.
    if (_resolutionAnimRunning) {
      _lastResolvingTurn = !!isResolvingTurn;
      // Still allow card signature updates below so the fan has fresh cards when it returns.
    } else if (isResolvingTurn) {
      // ── RESOLUTION EDGE: selecting → resolving ──
      // Fire the full animation sequence exactly once per resolution.
      if (!_lastResolvingTurn) {
        _resolutionAnimRunning = true;
        _endOfTurnPushDone = false;

        // Determine first attacker: if player triggered resolution via synergy combo,
        // player goes first; otherwise enemy leads (default).
        var playerFirst = !!(combatState.playerInitiated);

        _playResolutionSequence(playerFirst, function onSequenceDone() {
          _resolutionAnimRunning = false;

          // ── End-of-turn bookkeeping (fires once) ──
          if (!_endOfTurnPushDone) {
            _endOfTurnPushDone = true;

            // Phase 5: Advance duel turn
            try {
              if (typeof InformationDuelEngine !== 'undefined' && InformationDuelEngine.advanceTurn) {
                var _enemyCards = (typeof EnemyHandDisplay !== 'undefined' && EnemyHandDisplay.getEnemyCards) ?
                  EnemyHandDisplay.getEnemyCards() : [];
                var _destroyedThisTurn = false;
                try {
                  if (typeof NonCombatEventBus !== 'undefined' && NonCombatEventBus._lastDestroyThisTurn) {
                    _destroyedThisTurn = true;
                    NonCombatEventBus._lastDestroyThisTurn = false;
                  }
                } catch (e5) {}
                InformationDuelEngine.advanceTurn(_destroyedThisTurn, _enemyCards);
              }
            } catch (e5b) {}

            try {
              if (typeof CardStateAuthority !== 'undefined') {
                var pushResult = CardStateAuthority.pushOldestHandToBackup();
                if (pushResult && pushResult.success) {
                  var pushedId = (pushResult.returnedCard && pushResult.returnedCard.id) || '?';
                  console.log('[STRIntegration] End-of-turn: pushed oldest hand card "' + pushedId + '" back to backup');
                }
              } else if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.pushOldestHandCardToBackup === 'function') {
                var pushResult2 = GAMESTATE.pushOldestHandCardToBackup();
                if (pushResult2 && pushResult2.success) {
                  console.log('[STRIntegration] End-of-turn: pushed oldest hand card back to backup (legacy path)');
                }
              }
            } catch (e3) {
              console.warn('[STRIntegration] pushOldestHandToBackup error:', e3);
            }
          }
        });
      }
    } else {
      // Selecting / post_resolve — make sure the hand fan is visible
      HandFanComponent.restore();

      // Edge: resolving → selecting (legacy path for when animation didn't run)
      if (_lastResolvingTurn && !_endOfTurnPushDone) {
        _endOfTurnPushDone = true;

        try {
          if (typeof InformationDuelEngine !== 'undefined' && InformationDuelEngine.advanceTurn) {
            var _enemyCards2 = (typeof EnemyHandDisplay !== 'undefined' && EnemyHandDisplay.getEnemyCards) ?
              EnemyHandDisplay.getEnemyCards() : [];
            var _destroyedThisTurn2 = false;
            try {
              if (typeof NonCombatEventBus !== 'undefined' && NonCombatEventBus._lastDestroyThisTurn) {
                _destroyedThisTurn2 = true;
                NonCombatEventBus._lastDestroyThisTurn = false;
              }
            } catch (e5c) {}
            InformationDuelEngine.advanceTurn(_destroyedThisTurn2, _enemyCards2);
          }
        } catch (e5d) {}

        try {
          if (typeof CardStateAuthority !== 'undefined') {
            var pushResult3 = CardStateAuthority.pushOldestHandToBackup();
            if (pushResult3 && pushResult3.success) {
              console.log('[STRIntegration] End-of-turn (legacy): pushed oldest hand card back to backup');
            }
          } else if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.pushOldestHandCardToBackup === 'function') {
            GAMESTATE.pushOldestHandCardToBackup();
          }
        } catch (e3b) {}
      }
    }

    // Flash mini indicator on resolution edge
    if (typeof HandFanComponent !== 'undefined' && typeof HandFanComponent.flashMiniIndicator === 'function') {
      if (isResolvingTurn && !_lastResolvingTurn && STRCombatWindow && STRCombatWindow.isMinimized && STRCombatWindow.isMinimized()) {
        HandFanComponent.flashMiniIndicator('resolution');
      }
    }
    _lastResolvingTurn = !!isResolvingTurn;

    // If fan isn't visible yet, show it (clears any stale minimized state internally).
    // If visible: only update cards when the hand signature changes (prevents selection jitter).
    if (!HandFanComponent.isVisible()) {
      HandFanComponent.show(cards);
      _lastHandSig = handSig;
    } else {
      if (_lastHandSig !== handSig) {
        HandFanComponent.updateCards(cards);
        _lastHandSig = handSig;
      }
    }

    // Determine fan mode based on STR window state
    var isMini = STRCombatWindow.isMinimized();

    // Only update mode when it changes (prevents HandFan churn)
    if (isMini) {
      if (!HandFanComponent.getMode || HandFanComponent.getMode() !== 'contextual') {
        HandFanComponent.setMode('contextual', 'bottom');
      } else {
        HandFanComponent.setMode('contextual', 'bottom');
      }
    } else {
      // Peripheral hand fan: keeps enemy + combat window readable
      HandFanComponent.setMode('combat', 'peripheral');
    }

    // Update minimized hand-fan indicator (stacked above STR minimized indicator)
    if (typeof HandFanComponent !== 'undefined' && typeof HandFanComponent.updateMiniIndicator === 'function') {
      var emoji = null;
      if (cards && cards.length) {
        emoji = cards[0].emoji || cards[0].glyph || '🃏';
      }

      var pct = null;
      if (typeof STRCombatWindow !== 'undefined' && typeof STRCombatWindow.getTimeRemainingMs === 'function' && typeof STRCombatWindow.getTimerDurationMs === 'function') {
        var dur = STRCombatWindow.getTimerDurationMs();
        var rem = STRCombatWindow.getTimeRemainingMs();
        if (dur > 0) pct = rem / dur;
      }

      HandFanComponent.updateMiniIndicator({
        visible: !!isMini,
        emoji: emoji || '🃏',
        count: (cards && cards.length) ? cards.length : 0,
        timerPercent: pct
      });
    }
  }

  /**
   * Hide Hand Fan
   */
  function _hideHandFan() {
    HandFanComponent.hide();
  }

  function _showBackupActions(combatState) {
    // BAC floating popup is RETIRED — RogueSidebar handles left column in both
    // combat and non-combat modes. Ensure BAC stays hidden during combat.
    if (typeof BackupActionContainer !== 'undefined' && BackupActionContainer.isVisible()) {
      BackupActionContainer.hide();
    }
    // Enemy hand display in backup scroll space
    if (typeof EnemyHandDisplay !== 'undefined') {
      var wasHidden = !EnemyHandDisplay.isVisible();
      if (wasHidden) {
        EnemyHandDisplay.show();
      }
      EnemyHandDisplay.updateFromCombatState(combatState);

      // Phase 5: Start InformationDuelEngine on first combat frame
      if (wasHidden && typeof InformationDuelEngine !== 'undefined') {
        InformationDuelEngine.startCombat();
      }

      // Phase 4: Compute interactability + auto-reveal on first show
      if (typeof EnemyCardInteractionHandler !== 'undefined') {
        if (wasHidden) {
          // First combat frame: run auto-reveal (Wire Tap, etc.)
          EnemyCardInteractionHandler.runAutoReveal(combatState);
        }
        // Every frame: update interactability state
        EnemyCardInteractionHandler.computeInteractability(combatState);
      }

      // Phase 5: Render duel HUD
      if (typeof InformationDuelEngine !== 'undefined' && typeof InformationDuelHUD !== 'undefined') {
        InformationDuelHUD.render(InformationDuelEngine.getSnapshot());
      }
    }
  }

  function _hideBackupActions() {
    if (typeof BackupActionContainer !== 'undefined') {
      BackupActionContainer.hide();
    }
    if (typeof EnemyHandDisplay !== 'undefined') {
      EnemyHandDisplay.hide();
    }
    // Phase 5: End duel engine on combat end
    if (typeof InformationDuelEngine !== 'undefined' && InformationDuelEngine.endCombat) {
      InformationDuelEngine.endCombat();
    }
  }

  /**
   * Handle timer expiration.
   * If the player has cards selected in the hand fan, commit them now.
   * Otherwise pass the turn (enemy attacks unopposed).
   */
  function handleStrTimerExpired() {
    // Play whatever the player has already selected before time ran out
    if (typeof HandFanComponent !== 'undefined' &&
        typeof HandFanComponent.getSelectedCards === 'function' &&
        typeof HandFanComponent.playSelectedCards === 'function') {
      var selected = HandFanComponent.getSelectedCards();
      if (selected.length > 0) {
        console.log('[STRIntegration] Timer expired - committing ' + selected.length + ' selected card(s)');
        HandFanComponent.playSelectedCards();
        return;
      }
    }

    // No cards selected — enemy attacks unopposed
    console.log('[STRIntegration] Timer expired - no selection, passing player turn');
    if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.passPlayerTurn === 'function') {
      GoneRogue.passPlayerTurn();
    }
  }

  /**
   * Handle multi-card combat execution
   */
  function executeMultiCardRound(selectedCards) {
    // Rebased: execute by card id (stable across hand reorder/repopulate).
    if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.playCardsFromHand === 'function') {
      var ids = [];
      (selectedCards || []).forEach(function(card) {
        if (card && card.id) ids.push(card.id);
      });
      GoneRogue.playCardsFromHand(ids);
    }
  }

  // Expose functions to GoneRogue if they don't exist
  if (typeof GoneRogue !== 'undefined') {
    if (!GoneRogue.handleStrTimerExpired) {
      GoneRogue.handleStrTimerExpired = handleStrTimerExpired;
    }

    if (!GoneRogue.executeMultiCardRound) {
      GoneRogue.executeMultiCardRound = executeMultiCardRound;
    }

    if (!GoneRogue.passPlayerTurn) {
      GoneRogue.passPlayerTurn = function() {
        // Execute only the enemy's attack using the direct passStrTurn method
        if (typeof GoneRogue.passStrTurn === 'function') {
          GoneRogue.passStrTurn();
        }
      };
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIntegration);
  } else {
    initIntegration();
  }
})();
