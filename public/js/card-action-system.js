/**
 * CardActionSystem – IIFE module (Delegate Pattern)
 *
 * Owns: nothing (stateless)
 * Handles: mapping swipe directions to card actions, executing card actions
 *          (attack, stance/defense, utility, discard), finding nearest enemy.
 *
 * Loaded before gone-rogue.js via <script> tag.
 */
var CardActionSystem = (function () {
  'use strict';

  // ------------------------------------------------------------------
  // getCardAction — map swipe direction + card category to action type
  // ------------------------------------------------------------------
  function getCardAction(card, direction) {
    var category = typeof CardSystem !== 'undefined' ? CardSystem.getCardCategory(card) : card.type;

    // Interrupt cards (up/right/left)
    if (category === 'interrupt') {
      if (direction === 'up' || direction === 'right' || direction === 'left') {
        return { type: 'interrupt', card: card };
      }
    }
    // Defense cards (up/left)
    else if (category === 'defense' || card.type === 'stance') {
      if (direction === 'up' || direction === 'left') {
        return { type: 'defense', card: card };
      }
    }
    // Movement cards (up/left/right)
    else if (category === 'movement') {
      if (direction === 'up' || direction === 'left' || direction === 'right') {
        return { type: 'movement', card: card };
      }
    }
    // Attack cards (up/right)
    else if (category === 'attack' || card.type === 'attack') {
      if (direction === 'up' || direction === 'right') {
        return { type: 'attack', card: card };
      }
    }
    // Setup/Utility cards (up)
    else if (category === 'setup' || card.type === 'utility') {
      if (direction === 'up') {
        return { type: 'use', card: card };
      }
    }

    if (direction === 'down') {
      return { type: 'discard', card: card };
    }

    return { type: 'none' };
  }

  // ------------------------------------------------------------------
  // executeCardAction — dispatch action to handler, return result object
  // ------------------------------------------------------------------
  function executeCardAction(action, ctx) {
    if (!action || action.type === 'none') {
      return {
        lines: ['INVALID SWIPE', ''],
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    if (action.type === 'attack' || action.type === 'interrupt') {
      return performAttack(action.card, ctx);
    } else if (action.type === 'defense' || action.type === 'stance' || action.type === 'movement') {
      return performStance(action.card, ctx);
    } else if (action.type === 'use') {
      return performUtility(action.card, ctx);
    } else if (action.type === 'discard') {
      return performDiscard(action.card, ctx);
    }

    return {
      lines: [''],
      prompt: ctx.getPrompt(),
      stayActive: true
    };
  }

  // ------------------------------------------------------------------
  // performAttack — trigger STR combat or simultaneous round
  // ------------------------------------------------------------------
  function performAttack(card, ctx) {
    if (typeof TooltipSystem !== 'undefined') {
      TooltipSystem.showAction('attack');
    }

    // If already in STR combat, use simultaneous resolution
    if (ctx.strCombatActive) {
      var enemyCard = ctx.getEnemyAICard();
      return ctx.executeSimultaneousRound(card, enemyCard);
    }

    // Find nearest enemy
    var nearest = findNearestEnemy(ctx);
    if (!nearest) {
      return {
        lines: ['NO ENEMIES IN RANGE', ''],
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    // Trigger STR combat mode with player-initiated attack
    return ctx.enterStrCombat(nearest, 'player_attack', card);
  }

  // ------------------------------------------------------------------
  // performStance — apply stance outside combat or route to STR round
  // ------------------------------------------------------------------
  function performStance(card, ctx) {
    if (ctx.strCombatActive) {
      var enemyCard = ctx.getEnemyAICard();
      return ctx.executeSimultaneousRound(card, enemyCard);
    }

    // Outside combat: apply stance benefits
    ctx.player.stealth += (card.stats.stealth || 1);
    ctx.turn++;
    ctx.saveState();

    return {
      lines: ['STANCE: ' + card.name.toUpperCase(), 'STEALTH +' + (card.stats.stealth || 1), ''].concat(ctx.renderGrid()),
      prompt: ctx.getPrompt(),
      stayActive: true
    };
  }

  // ------------------------------------------------------------------
  // performUtility — apply card stat boosts (hp, energy, ammo, etc.)
  // ------------------------------------------------------------------
  function performUtility(card, ctx) {
    var effects = [];

    // Health restoration
    if (card.stats.hp) {
      ctx.player.hp = Math.min(ctx.player.maxHp, ctx.player.hp + card.stats.hp);
      effects.push('HP +' + card.stats.hp);
    }

    // Energy restoration
    if (card.stats.energyBoost) {
      if (typeof GAMESTATE !== 'undefined' && GAMESTATE.addEnergy) {
        GAMESTATE.addEnergy(card.stats.energyBoost);
        effects.push('ENERGY +' + card.stats.energyBoost);
      }
    }

    // Fatigue reduction
    if (card.stats.fatigueReduction) {
      if (typeof GAMESTATE !== 'undefined' && GAMESTATE.reduceFatigue) {
        GAMESTATE.reduceFatigue(card.stats.fatigueReduction);
        effects.push('FATIGUE -' + card.stats.fatigueReduction);
      }
    }

    // Battery recharge
    if (card.stats.batteryRecharge) {
      if (typeof GAMESTATE !== 'undefined' && GAMESTATE.rechargeBattery) {
        GAMESTATE.rechargeBattery(card.stats.batteryRecharge);
        effects.push('BATTERY +' + card.stats.batteryRecharge);
      }
    }

    // Focus boost
    if (card.stats.focusBoost) {
      if (typeof GAMESTATE !== 'undefined' && GAMESTATE.addFocus) {
        GAMESTATE.addFocus(card.stats.focusBoost);
        effects.push('FOCUS +' + card.stats.focusBoost);
      }
    }

    // Ammo restoration
    if (card.stats.ammoRestore) {
      if (typeof GAMESTATE !== 'undefined' && GAMESTATE.addAmmo) {
        GAMESTATE.addAmmo(card.stats.ammoRestore);
        effects.push('AMMO +' + card.stats.ammoRestore);
      }
    }

    // Secret floor trigger: wrong item in safe zone
    var floorType = ctx.getFloorType(ctx.floor);
    if (floorType === ctx.FLOOR_TYPES.BONFIRE && typeof SecretFloors !== 'undefined') {
      var hasSecretTag = card.category === 'attack' || card.category === 'interrupt' || card.type === 'attack';

      if (hasSecretTag) {
        var triggerResult = SecretFloors.triggerSecretFloor(
          SecretFloors.TRIGGER_TYPES.WRONG_ITEM_SAFE_ZONE,
          {
            inSafeZone: true,
            itemHasSecretTag: true
          }
        );

        if (triggerResult.success) {
          console.log('[CardActionSystem] Wrong item in safe zone triggered secret floor');
        }
      }
    }

    ctx.turn++;
    ctx.saveState();

    var effectsMsg = effects.length > 0 ? effects.join(', ') : '';
    return {
      lines: ['USED: ' + card.name.toUpperCase(), effectsMsg, ''].concat(ctx.renderGrid()),
      prompt: ctx.getPrompt(),
      stayActive: true
    };
  }

  // ------------------------------------------------------------------
  // performDiscard — discard a card
  // ------------------------------------------------------------------
  function performDiscard(card) {
    return {
      lines: ['DISCARDED: ' + card.name, ''],
      prompt: '',
      stayActive: true
    };
  }

  // ------------------------------------------------------------------
  // findNearestEnemy — within range 5 by Manhattan distance
  // ------------------------------------------------------------------
  function findNearestEnemy(ctx) {
    var nearest = null;
    var minDist = Infinity;

    ctx.enemies.forEach(function (enemy) {
      if (enemy.hp <= 0) return;

      var dist = Math.abs(enemy.x - ctx.player.x) + Math.abs(enemy.y - ctx.player.y);
      if (dist < minDist && dist <= 5) {
        minDist = dist;
        nearest = enemy;
      }
    });

    return nearest;
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------
  return {
    getCardAction: getCardAction,
    executeCardAction: executeCardAction,
    findNearestEnemy: findNearestEnemy
  };
})();
