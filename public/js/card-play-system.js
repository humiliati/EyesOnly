/**
 * CardPlaySystem — plays cards from hand during STR combat.
 * Extracted Phase 18 from gone-rogue.js.
 * Stateless IIFE module — all mutable state via ctx references.
 */
var CardPlaySystem = (function() {
  'use strict';

  /**
   * Play a single card from hand by its card ID.
   * @param {string} cardId - The card identifier
   * @param {Object} ctx - Context from monolith
   * @returns {Object} Result with { success, consumed, lines, exited }
   */
  function playCardFromHand(cardId, ctx) {
    if (!ctx.active || !ctx.strCombatActive) {
      return { success: false, reason: 'not_in_combat' };
    }
    if (!cardId || typeof GoneRogueDataRegistry === 'undefined' || !GoneRogueDataRegistry.getCard) {
      return { success: false, reason: 'missing_registry' };
    }

    var card = GoneRogueDataRegistry.getCard(cardId);
    if (!card || card._missing) {
      return { success: false, reason: 'missing_card' };
    }

    var costs = Array.isArray(card.costs) ? card.costs : null;
    var affordability = ctx.canAffordCosts(costs);
    if (!affordability.canAfford) {
      return { success: false, reason: 'insufficient_resources', missing: affordability.missing, costs: costs };
    }

    if (costs && costs.length) {
      var spent = ctx.consumeCosts(costs);
      if (!spent.success) {
        return { success: false, reason: 'cost_spend_failed', costs: costs };
      }
    }

    // 3D printer (🕋) hook: if active, and this card spent ammo/battery, print extra cards then consume the printer.
    ctx.maybeTrigger3dPrinter(cardId, card);

    // ── Synergy detection ──────────────────────────────────
    var synergyResult = null;
    var synergyBonuses = null;
    try {
      if (typeof SynergyIntegration !== 'undefined' && typeof SynergyIntegration.processCardPlay === 'function') {
        synergyResult = SynergyIntegration.processCardPlay(card, {
          player: ctx.player,
          enemy: ctx.strCombatEnemy,
          round: ctx.strCombatRound
        });
        if (synergyResult && synergyResult.activeBonuses) {
          synergyBonuses = synergyResult.activeBonuses;
        }
      }
    } catch (eSyn) {
      console.warn('[GoneRogue] Synergy check error:', eSyn);
    }

    var lines = [];
    lines.push('\uD83C\uDCCF ' + (card.emoji || '\uD83C\uDCCF') + ' ' + (card.name || cardId));

    // Log synergy activation
    if (synergyResult && synergyResult.synergies && synergyResult.synergies.length > 0) {
      for (var si = 0; si < synergyResult.synergies.length; si++) {
        var syn = synergyResult.synergies[si];
        lines.push('\u26A1 SYNERGY: ' + (syn.definition ? syn.definition.name : 'Unknown'));
      }
      // Dispatch synergy event for UI feedback
      try {
        window.dispatchEvent(new CustomEvent('rogue-synergy-triggered', {
          detail: { synergies: synergyResult.synergies, bonuses: synergyBonuses, card: card }
        }));
      } catch (eEv) {}
    }

    // Apply effects (v0 subset) — enhanced by synergy bonuses
    var _cardTriggeredFlee = false;
    var enemy = ctx.strCombatEnemy;
    for (var i = 0; i < (card.effects || []).length; i++) {
      var eff = card.effects[i];
      if (!eff || !eff.type) continue;

      if (eff.type === 'damage') {
        var dmg = Number(eff.value || 0);
        // Apply synergy damage bonuses
        if (synergyBonuses) {
          if (synergyBonuses.damageMultiplier && synergyBonuses.damageMultiplier !== 1.0) {
            dmg = Math.floor(dmg * synergyBonuses.damageMultiplier);
          }
          if (synergyBonuses.damageBonus) {
            dmg += synergyBonuses.damageBonus;
          }
        }
        if (enemy && isFinite(dmg)) {
          enemy.hp = Math.max(0, (enemy.hp || 0) - dmg);
          lines.push('\u2694\uFE0F ' + dmg + ' damage');
          if (typeof EnemyIntentSystem !== 'undefined' && enemy.intentState) {
            enemy.intentState.expression = EnemyIntentSystem.onCombatEvent(enemy, 'took_damage');
          }
        }
      } else if (eff.type === 'hp') {
        var heal = Number(eff.value || 0);
        if (isFinite(heal)) {
          ctx.player.hp = Math.min(ctx.player.maxHp || 10, (ctx.player.hp || 0) + heal);
          lines.push('\uD83E\uDE79 +' + heal + ' HP');
        }
      } else if (eff.type === 'self_damage') {
        // Self-inflicted HP damage (e.g. Cyanide Capsule)
        var selfDmg = Number(eff.value || 0);
        if (ctx.player && isFinite(selfDmg) && selfDmg > 0) {
          ctx.player.hp = Math.max(0, (ctx.player.hp || 0) - selfDmg);
          lines.push('\uD83D\uDC80 -' + selfDmg + ' HP (self)');
        }
      } else if (eff.type === 'fatigue') {
        // Fatigue cost (e.g. Smoke Bomb adrenaline tax)
        var fatVal = Number(eff.value || 0);
        if (ctx.player && isFinite(fatVal) && fatVal > 0) {
          ctx.player.fatigue = Math.min(100, (ctx.player.fatigue || 0) + fatVal);
          lines.push('\uD83D\uDE2E\u200D\uD83D\uDCA8 +' + fatVal + ' fatigue');
        }
      } else if (eff.type === 'noise') {
        // Noise burst (raises alert level)
        var noiseVal = Number(eff.value || 0);
        if (isFinite(noiseVal) && noiseVal > 0) {
          ctx.setAlertLevel(Math.min(100, (ctx.getAlertLevel() || 0) + noiseVal));
          lines.push('\uD83D\uDCE2 +' + noiseVal + ' noise (alert: ' + ctx.getAlertLevel() + ')');
        }
      } else if (eff.type === 'flee') {
        // Guaranteed escape — flag for post-effect processing
        _cardTriggeredFlee = true;
        lines.push('\uD83C\uDFC3 ESCAPE TRIGGERED');
      }
    }

    // Apply synergy post-effects (draw card, energy refund, etc.)
    if (synergyBonuses) {
      if (synergyBonuses.drawCard) {
        try {
          if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.drawOneFromBackupPerTurn === 'function') {
            var drawResult = GAMESTATE.drawOneFromBackupPerTurn();
            if (drawResult && drawResult.success) {
              lines.push('\uD83C\uDCCF Synergy draw: +1 card from backup');
            }
          }
        } catch (eDraw) {}
      }
      if (synergyBonuses.energyRefund && synergyBonuses.energyRefund > 0) {
        try {
          if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.addEnergy === 'function') {
            GAMESTATE.addEnergy(synergyBonuses.energyRefund);
            lines.push('\u26A1 +' + synergyBonuses.energyRefund + ' energy refund');
          }
        } catch (eRef) {}
      }
    }

    // ── Cascade resolution ──────────────────────────────────
    if (synergyResult && synergyResult.synergies && synergyResult.synergies.length > 0) {
      try {
        if (typeof CascadeResolver !== 'undefined' && typeof CascadeResolver.resolve === 'function') {
          for (var ci = 0; ci < synergyResult.synergies.length; ci++) {
            var cascadeResult = CascadeResolver.resolve(synergyResult.synergies[ci], card, {
              player: ctx.player,
              enemy: ctx.strCombatEnemy,
              round: ctx.strCombatRound
            });
            if (cascadeResult && cascadeResult.results && cascadeResult.results.length > 0) {
              for (var cr = 0; cr < cascadeResult.results.length; cr++) {
                var cEffect = cascadeResult.results[cr];
                lines.push('\uD83D\uDD17 CASCADE: ' + (cEffect.description || cEffect.type));
                // Apply cascade effects
                if (cEffect.drawCard) {
                  var cDraw = GAMESTATE.drawOneFromBackupPerTurn();
                  if (cDraw && cDraw.success) lines.push('\uD83C\uDCCF Cascade draw: +1 card');
                }
                if (cEffect.focusGain && typeof GAMESTATE.addFocus === 'function') {
                  GAMESTATE.addFocus(cEffect.focusGain);
                  lines.push('\uD83E\uDDE0 +' + cEffect.focusGain + ' focus');
                }
                if (cEffect.enemySkip) {
                  if (ctx.strCombatEnemy) ctx.strCombatEnemy._skipNextTurn = true;
                  lines.push('\u23ED\uFE0F Enemy will skip next turn');
                }
              }
              // Dispatch cascade event
              try {
                window.dispatchEvent(new CustomEvent('rogue-cascade-triggered', {
                  detail: { depth: cascadeResult.depth, results: cascadeResult.results, card: card }
                }));
              } catch (eCas) {}
            }
          }
        }
      } catch (eCascade) {
        console.warn('[GoneRogue] Cascade resolver error:', eCascade);
      }
    }

    var consumes = (typeof card.consumesOnPlay === 'boolean') ? card.consumesOnPlay : !(costs && costs.length);
    var saved = false;
    if (consumes) {
      // ── Flight-saver check: equipped passive may prevent consumption ──
      try {
        if (typeof PassiveItemsSystem !== 'undefined' && typeof PassiveItemsSystem.tryFlightSave === 'function') {
          saved = PassiveItemsSystem.tryFlightSave(card, card.qualityName || card.quality || '');
        }
      } catch (eSave) {}

      if (saved) {
        lines.push('\uD83E\uDE62 SAVED! Card survives use');
      } else {
        if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.consumeCardFromHand === 'function') {
          GAMESTATE.consumeCardFromHand(cardId, 1);
        }
      }
    }

    // ── Flee exit: if any effect triggered a flee, exit combat now ──
    if (_cardTriggeredFlee) {
      // Check if self-damage killed the player before they could flee
      if (ctx.player && ctx.player.hp <= 0) {
        ctx.player.hp = 0;
        lines.push('\uD83D\uDC80 Died before escaping...');
        ctx.appendStrCombatLog(lines);
        return ctx.handlePlayerDeath('combat_damage', { enemy: ctx.strCombatEnemy });
      }

      lines.push('');
      ctx.appendStrCombatLog(lines);
      var fleeResult = ctx.exitStrCombat('fled');
      return { success: true, consumed: consumes && !saved, lines: lines.concat(fleeResult.lines || []), exited: true };
    }

    // End conditions (so we don't rely on the legacy per-round resolver to exit)
    if (ctx.strCombatEnemy && ctx.strCombatEnemy.hp <= 0) {
      lines.push('');
      lines.push('\uD83C\uDFC1 ENEMY DEFEATED');
      var exitResult = ctx.exitStrCombat('player_victory');
      return { success: true, consumed: consumes, lines: lines.concat(exitResult.lines || []), exited: true };
    }

    if (ctx.player && ctx.player.hp <= 0) {
      // Clamp to prevent negative HP looping
      ctx.player.hp = 0;
      return ctx.handlePlayerDeath('combat_damage', { enemy: ctx.strCombatEnemy });
    }

    ctx.appendStrCombatLog(lines);

    // Trigger re-render
    if (typeof STRCombatWindow !== 'undefined' && typeof STRCombatWindow.show === 'function') {
      STRCombatWindow.show({
        active: true,
        enemy: ctx.strCombatEnemy,
        player: ctx.player,
        advantage: ctx.strCombatAdvantage,
        round: ctx.strCombatRound,
        log: ctx.getStrCombatLog()
      });
    }

    return { success: true, consumed: consumes, lines: lines };
  }

  /**
   * Play multiple cards from hand by their card IDs.
   * @param {Array<string>} cardIds
   * @param {Object} ctx - Context from monolith
   * @returns {Object} Result with { success, results[] }
   */
  function playCardsFromHand(cardIds, ctx) {
    if (!cardIds || !cardIds.length) return { success: false };
    var res = { success: true, results: [] };
    for (var i = 0; i < cardIds.length; i++) {
      res.results.push(playCardFromHand(cardIds[i], ctx));
    }
    return res;
  }

  return {
    playCardFromHand: playCardFromHand,
    playCardsFromHand: playCardsFromHand
  };
})();
