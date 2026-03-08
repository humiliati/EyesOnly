/* ============================================================
   STR Combat Engine — Extracted from gone-rogue.js
   Simultaneous Turn Resolution combat system
   ============================================================ */

var StrCombatEngine = (function () {
  'use strict';

  // ── Combat State (owned by this module) ───────────────────

  var _active = false;
  var _enemy = null;
  var _round = 0;
  var _log = [];
  var _phase = 'idle';       // idle, countdown, selecting, resolving, post_resolve
  var _advantage = 'neutral';
  var _entryPos = null;
  var _ammoSpent = 0;
  var _context = null;       // countdown messages

  // ── RNG helper ────────────────────────────────────────────

  function _rng() {
    if (typeof SeededRNG !== 'undefined' && SeededRNG.random) {
      return SeededRNG.random();
    }
    return Math.random();
  }

  // ── Pure Calculations ─────────────────────────────────────

  function distanceBetween(a, b) {
    return Math.abs((a.x || 0) - (b.x || 0)) + Math.abs((a.y || 0) - (b.y || 0));
  }

  function getDistanceBracket(distance) {
    if (distance <= 1) return 'melee';
    if (distance <= 3) return 'close';
    if (distance <= 6) return 'mid';
    return 'far';
  }

  function checkFlanking(attacker, target) {
    var opposites = {
      'north': 'south',
      'south': 'north',
      'east': 'west',
      'west': 'east'
    };

    var targetFacing = target.orientation || target.lastMoveDirection;
    if (!targetFacing) return false;

    var approachDirection = attacker.lastMoveDirection;
    if (!approachDirection && typeof attacker.x === 'number' && typeof target.x === 'number') {
      var dx = target.x - attacker.x;
      var dy = target.y - attacker.y;
      if (Math.abs(dx) > Math.abs(dy)) {
        approachDirection = dx > 0 ? 'east' : 'west';
      } else if (Math.abs(dy) > 0) {
        approachDirection = dy > 0 ? 'south' : 'north';
      }
    }

    if (!approachDirection) return false;

    var opposite = opposites[targetFacing];
    return approachDirection === opposite;
  }

  function getAdvantageEmoji(advantage) {
    switch (advantage) {
      case 'ambush': return '🎯';
      case 'neutral': return '⚔️';
      case 'disadvantaged': return '⚠️';
      case 'flanked': return '❌';
      default: return '⚔️';
    }
  }

  function calculateAdvantage(player, enemy, trigger, ctx) {
    var distance = distanceBetween(player, enemy);
    var bracket = getDistanceBracket(distance);
    var enemyAware = (enemy.awareness || 0) >= ctx.AWARENESS_STATES.SUSPICIOUS.min;
    var playerInitiated = trigger === 'player_attack' || trigger === 'collision';
    var enemyInitiated = trigger === 'enemy_attack' || trigger === 'enemy_sighting' || trigger === 'enemy_projectile';

    if (playerInitiated && bracket === 'melee' && !enemyAware) {
      return 'ambush';
    }

    var isFlanking = checkFlanking(player, enemy);
    if (playerInitiated && isFlanking) {
      return 'ambush';
    }

    var playerFlanked = checkFlanking(enemy, player);
    if (enemyInitiated && bracket === 'melee' && playerFlanked) {
      return 'flanked';
    }

    if (enemyInitiated && enemy.awareness >= 70) {
      return 'disadvantaged';
    }

    return 'neutral';
  }

  function calculateHit(attacker, defender, advantage) {
    var baseHitChance = 70;
    var attackerDex = attacker.dex || 5;
    var defenderDex = defender.dex || 5;
    var distance = distanceBetween(attacker, defender);
    var bracket = getDistanceBracket(distance);

    var advantageBonus = 0;
    var critThreshold = 95;

    if (advantage === 'ambush') {
      advantageBonus = 40;
      critThreshold = Math.max(5, critThreshold - 30);
    } else if (advantage === 'flanked' || advantage === 'disadvantaged') {
      advantageBonus = -25;
      critThreshold = 98;
    }

    var distancePenalty = {
      melee: 0,
      close: 5,
      mid: 15,
      far: 35
    }[bracket] || 0;

    var accBonus = (attacker.accuracyBonus || 0) + (attacker.tempAccuracyBoost || 0);

    var hitChance = baseHitChance + (attackerDex - defenderDex) * 2 + advantageBonus - distancePenalty + accBonus;
    hitChance = Math.max(5, Math.min(95, hitChance));

    var roll = Math.floor(_rng() * 100) + 1;

    return {
      hit: roll <= hitChance,
      crit: roll >= critThreshold,
      roll: roll,
      target: hitChance
    };
  }

  function calculateDamage(attacker, defender, advantage, card, isCrit) {
    var baseDamage = 2;
    var attackerStr = attacker.str || 5;
    var defenderStr = defender.str || 5;
    var bonuses = [];

    if (card && card.stats && card.stats.damage) {
      baseDamage = card.stats.damage;
      bonuses.push('Card: ' + card.stats.damage);
    }

    var strMod = Math.floor((attackerStr - defenderStr) / 2);
    baseDamage += strMod;
    if (strMod > 0) {
      bonuses.push('STR: +' + strMod);
    }

    if (advantage === 'ambush') {
      baseDamage += 2;
      bonuses.push('Ambush: +2');
    } else if (advantage === 'flanked') {
      baseDamage -= 1;
      bonuses.push('Flanked: -1');
    }

    baseDamage = Math.max(1, baseDamage);

    if (isCrit) {
      baseDamage = Math.ceil(baseDamage * 1.75);
      bonuses.push('CRIT x1.75');
    }

    return {
      damage: baseDamage,
      bonuses: bonuses
    };
  }

  // ── Action Resolution ─────────────────────────────────────

  function resolveAction(action, ctx) {
    var lines = [];
    var actor = action.actor === 'player' ? ctx.player : _enemy;
    var target = action.actor === 'player' ? _enemy : ctx.player;
    var card = action.card;
    var category = action.category;

    var priorityLabel = {
      interrupt: '🚨 INTERRUPT',
      defense: '🛡️  DEFENSE',
      movement: '🏃 MOVEMENT',
      attack: '⚔️  ATTACK',
      setup: '🔧 SETUP'
    }[category] || '❓ ACTION';

    var actorName = action.actor === 'player' ? 'PLAYER' : 'ENEMY';

    var expressionGlyph = '';
    if (action.actor === 'enemy' && typeof EnemyIntentSystem !== 'undefined' && _enemy.intentState) {
      expressionGlyph = ' [' + _enemy.intentState.expression.glyph + ']';
    }

    lines.push(priorityLabel + ' — ' + actorName + expressionGlyph + ': ' + card.emoji + ' ' + card.name);

    switch (category) {
      case 'interrupt':
        lines = lines.concat(resolveInterruptAction(actor, target, card, ctx));
        break;
      case 'defense':
        lines = lines.concat(resolveDefenseAction(actor, target, card));
        break;
      case 'movement':
        lines = lines.concat(resolveMovementAction(actor, target, card));
        break;
      case 'attack':
        lines = lines.concat(resolveAttackAction(actor, target, card, ctx));
        break;
      case 'setup':
        lines = lines.concat(resolveSetupAction(actor, target, card, ctx));
        break;
      default:
        lines.push('└─ Unknown action type');
    }

    lines.push('');
    return { lines: lines };
  }

  function resolveInterruptAction(actor, target, card, ctx) {
    var lines = [];

    if (actor === ctx.player) {
      ctx.player.lastCardType = card.type || card.name;
    }

    if (ctx.bossFloorActive && ctx.activeBoss && actor === ctx.player) {
      var bossInteraction = handleBossCardInteraction(card, target, ctx);
      if (bossInteraction.handled) {
        return bossInteraction.lines;
      }
    }

    if (card.name === 'Dive for Cover') {
      var defense = card.stats.defense || 5;
      var evasion = card.stats.evasion || 3;
      actor.tempDefense = (actor.tempDefense || 0) + defense;
      actor.tempEvasion = (actor.tempEvasion || 0) + evasion;
      lines.push('├─ Gained +' + defense + ' defense, +' + evasion + ' evasion');
    } else if (card.name === 'Jam Weapon') {
      target.weaponJammed = true;
      lines.push('├─ Target\'s weapon jammed! Next attack canceled');
    } else if (card.name === 'Overwatch Shot') {
      var damage = card.stats.damage || 3;
      target.hp -= damage;
      lines.push('├─ Dealt ' + damage + ' damage (preemptive strike)');
      lines.push('└─ Target HP: ' + Math.max(0, target.hp) + '/' + (target.maxHp || 5));
    } else {
      lines.push('└─ Interrupt executed');
    }

    return lines;
  }

  function resolveDefenseAction(actor, target, card) {
    var lines = [];

    var defense = card.stats.defense || 0;
    var evasion = card.stats.evasion || 0;

    if (defense > 0) {
      actor.tempDefense = (actor.tempDefense || 0) + defense;
      lines.push('├─ Gained +' + defense + ' defense');
    }
    if (evasion > 0) {
      actor.tempEvasion = (actor.tempEvasion || 0) + evasion;
      lines.push('├─ Gained +' + evasion + ' evasion');
    }

    var stealth = card.stats.stealth || 0;
    if (stealth > 0) {
      actor.stealth = Math.min((actor.maxStealth || 5), (actor.stealth || 0) + stealth);
      lines.push('└─ Stealth increased');
    }

    return lines;
  }

  function resolveMovementAction(actor, target, card) {
    var lines = [];

    var distance = card.stats.distance || 0;
    var evasion = card.stats.evasion || 0;

    if (distance !== 0) {
      lines.push('├─ Position adjusted (' + (distance > 0 ? 'closing' : 'retreating') + ')');
    }

    if (evasion > 0) {
      actor.tempEvasion = (actor.tempEvasion || 0) + evasion;
      lines.push('└─ Gained +' + evasion + ' evasion from movement');
    }

    return lines;
  }

  function resolveAttackAction(actor, target, card, ctx) {
    var lines = [];

    if (actor === ctx.player) {
      ctx.player.lastCardType = card.type || card.name;
    }

    if (actor.weaponJammed) {
      lines.push('└─ Attack failed! Weapon is jammed');
      actor.weaponJammed = false;
      return lines;
    }

    if (ctx.bossFloorActive && ctx.activeBoss && actor === ctx.player) {
      var bossInteraction = handleBossCardInteraction(card, target, ctx);
      if (bossInteraction.handled) {
        return bossInteraction.lines;
      }
    }

    var advantage = actor === ctx.player ? _advantage :
                    (_advantage === 'ambush' ? 'flanked' :
                     _advantage === 'flanked' ? 'ambush' : 'neutral');

    var hitResult = calculateHit(actor, target, advantage);
    var evasionBonus = (target.tempEvasion || 0) * 5;
    hitResult.target += evasionBonus;

    if (!hitResult.hit || hitResult.roll < hitResult.target) {
      lines.push('├─ MISS! (Roll: ' + hitResult.roll + ' vs ' + hitResult.target + ')');
      if (evasionBonus > 0) {
        lines.push('└─ Target evaded with +' + evasionBonus + '% evasion bonus');
      }
      return lines;
    }

    var damageResult = calculateDamage(actor, target, advantage, card, hitResult.crit);
    var defenseReduction = (target.tempDefense || 0);
    var finalDamage = Math.max(1, damageResult.damage - defenseReduction);

    target.hp -= finalDamage;

    // Update enemy intent expression when taking damage
    if (target === _enemy && typeof EnemyIntentSystem !== 'undefined' && _enemy.intentState) {
      _enemy.intentState.expression = EnemyIntentSystem.onCombatEvent(_enemy, 'took_damage');
    }

    // Track damage stats
    if (actor === ctx.player && target === _enemy) {
      ctx.onDamageDealt(finalDamage);
    }
    if (actor === _enemy && target === ctx.player && defenseReduction > 0) {
      ctx.onDamageMitigated(defenseReduction);
    }

    var critEmoji = hitResult.crit ? ' 💥 CRIT!' : '';
    lines.push('├─ HIT!' + critEmoji + ' (Roll: ' + hitResult.roll + ' vs ' + hitResult.target + ')');
    lines.push('├─ Damage: ' + damageResult.damage + (defenseReduction > 0 ? ' - ' + defenseReduction + ' defense' : ''));
    lines.push('└─ Final: ' + finalDamage + ' damage → Target HP: ' + Math.max(0, target.hp) + '/' + (target.maxHp || 5));

    return lines;
  }

  function resolveSetupAction(actor, target, card, ctx) {
    var lines = [];

    if (actor === ctx.player) {
      ctx.player.lastCardType = card.type || card.name;
    }

    if (ctx.bossFloorActive && ctx.activeBoss && actor === ctx.player) {
      var bossInteraction = handleBossCardInteraction(card, target, ctx);
      if (bossInteraction.handled) {
        return bossInteraction.lines;
      }
    }

    var hp = card.stats.hp || 0;
    if (hp > 0) {
      actor.hp = Math.min((actor.maxHp || 10), actor.hp + hp);
      lines.push('├─ Healed ' + hp + ' HP → ' + actor.hp + '/' + (actor.maxHp || 10));
    }

    var attackBoost = card.stats.attackBoost || card.stats.attack_boost || 0;
    if (attackBoost > 0) {
      actor.tempAttackBoost = (actor.tempAttackBoost || 0) + attackBoost;
      lines.push('├─ Gained +' + attackBoost + ' attack power (next turn)');
    }

    var speedBoost = card.stats.speedBoost || card.stats.speed_boost || 0;
    if (speedBoost > 0) {
      actor.tempSpeedBoost = (actor.tempSpeedBoost || 0) + speedBoost;
      lines.push('├─ Gained +' + speedBoost + ' speed (next turn)');
    }

    var accuracyBoost = card.stats.accuracyBoost || card.stats.accuracy_boost || 0;
    if (accuracyBoost > 0) {
      actor.tempAccuracyBoost = (actor.tempAccuracyBoost || 0) + accuracyBoost;
      lines.push('└─ Gained +' + accuracyBoost + '% accuracy (next turn)');
    }

    return lines;
  }

  function handleBossCardInteraction(card, target, ctx) {
    var lines = [];
    var handled = false;

    if (!ctx.activeBoss) {
      return { handled: false, lines: [] };
    }

    var cardName = card.name;
    var gameState = {
      player: ctx.player,
      enemy: target,
      grid: ctx.grid,
      bossEnvironment: ctx.bossEnvironment
    };

    if (cardName === 'Lure') {
      handled = true;
      lines.push('├─ Using LURE on boss...');
      var playerAction = { type: 'LURE', target: 'TRAIN_PATH', card: card };
      var exploitResult = ctx.activeBoss.checkExploit(playerAction, gameState);
      if (exploitResult.exploited) {
        lines.push('├─ ' + exploitResult.message);
        if (exploitResult.damage) {
          target.hp = Math.max(0, target.hp - exploitResult.damage);
          lines.push('└─ Boss HP: ' + target.hp + '/' + ctx.activeBoss.maxHp);
        }
      } else {
        lines.push('└─ Lure had no effect (boss not in position)');
      }
    }

    else if (cardName === 'Grenade') {
      handled = true;
      lines.push('├─ Throwing Grenade at boss environment...');
      var playerAction = { type: 'Grenade', targetX: target.x || 20, targetY: target.y || 10, card: card };
      var exploitResult = ctx.activeBoss.checkExploit(playerAction, gameState);
      if (exploitResult.exploited) {
        lines.push('├─ ' + exploitResult.message);
        if (exploitResult.shieldDown || exploitResult.bunkerDown) {
          var damage = card.stats.damage || 6;
          target.hp = Math.max(0, target.hp - damage);
          lines.push('└─ Boss HP: ' + target.hp + '/' + ctx.activeBoss.maxHp);
        }
      } else {
        var damage = card.stats.damage || 6;
        target.hp = Math.max(0, target.hp - damage);
        lines.push('├─ Grenade explodes! ' + damage + ' damage');
        lines.push('└─ Boss HP: ' + target.hp + '/' + ctx.activeBoss.maxHp);
      }
    }

    else if (cardName === 'Jammer') {
      handled = true;
      lines.push('├─ Activating JAMMER on boss systems...');
      var playerAction = { type: 'JAMMER', card: card };
      var exploitResult = ctx.activeBoss.checkExploit(playerAction, gameState);
      if (exploitResult.exploited) {
        lines.push('├─ ' + exploitResult.message);
        lines.push('└─ Boss systems disrupted!');
      } else {
        target.weaponJammed = true;
        lines.push('└─ Boss weapon systems jammed for 1 turn');
      }
    }

    else if (cardName === 'Virus') {
      handled = true;
      lines.push('├─ Uploading VIRUS to boss systems...');
      var damage = card.stats.damage || 2;
      target.hp = Math.max(0, target.hp - damage);
      target.virusDOT = (card.stats.dot || 3);
      target.virusDuration = (card.stats.duration || 3);
      lines.push('├─ Initial damage: ' + damage);
      lines.push('├─ Virus will deal ' + target.virusDOT + ' damage for ' + target.virusDuration + ' turns');
      lines.push('└─ Boss HP: ' + target.hp + '/' + ctx.activeBoss.maxHp);
    }

    else if (cardName === 'High Ground') {
      handled = true;
      lines.push('├─ Taking HIGH GROUND position...');
      var playerAction = { type: 'HIGH_GROUND', target: 'CARRIER', card: card };
      var exploitResult = ctx.activeBoss.checkExploit(playerAction, gameState);
      if (exploitResult.exploited && exploitResult.bypassShield) {
        lines.push('├─ ' + exploitResult.message);
        var damage = exploitResult.damage || (card.stats.damage || 4) * 2;
        target.hp = Math.max(0, target.hp - damage);
        lines.push('└─ Piercing damage: ' + damage + ' → Boss HP: ' + target.hp + '/' + ctx.activeBoss.maxHp);
      } else {
        var damage = card.stats.damage || 4;
        target.hp = Math.max(0, target.hp - damage);
        lines.push('├─ Piercing shot: ' + damage + ' damage');
        lines.push('└─ Boss HP: ' + target.hp + '/' + ctx.activeBoss.maxHp);
      }
    }

    else if (cardName === 'Logic Hack') {
      handled = true;
      lines.push('├─ Executing LOGIC HACK on boss systems...');
      var targetNode = Math.floor(_rng() * 8);
      var playerAction = { type: 'LOGIC_HACK', targetNode: targetNode, card: card };
      var exploitResult = ctx.activeBoss.checkExploit(playerAction, gameState);
      if (exploitResult.exploited) {
        lines.push('├─ ' + exploitResult.message);
        lines.push('└─ Boss defenses manipulated!');
      } else {
        lines.push('└─ Hack had no effect (wrong boss type)');
      }
    }

    else if (cardName === 'Melee Strike') {
      ctx.player.lastCardType = 'MELEE';
      return { handled: false, lines: [] };
    }

    else if (cardName === 'Camera') {
      handled = true;
      lines.push('├─ 📷 Photographing boss position...');
      var exploitResult = ctx.activeBoss.checkExploit({ type: 'CAMERA', card: card }, gameState);
      if (exploitResult.exploited) {
        lines.push('├─ ' + exploitResult.message);
        if (exploitResult.atMaxPenalty) {
          lines.push('└─ ⚡ Boss fully exposed — attack now!');
        }
      } else {
        lines.push('└─ Camera has no effect on this boss type.');
      }
    }

    else if (cardName === 'Fragment Shower') {
      handled = true;
      lines.push('├─ 💫 Launching fragment shower...');
      var playerAction = {
        type: 'FRAGMENT_SHOWER',
        targetX: target ? (target.x || 20) : 20,
        targetY: target ? (target.y || 10) : 10,
        card: card
      };
      var exploitResult = ctx.activeBoss.checkExploit(playerAction, gameState);
      var damage = (card.stats && card.stats.damage) || 3;
      if (exploitResult.exploited) {
        lines.push('├─ ' + exploitResult.message);
      }
      if (target) {
        target.hp = Math.max(0, target.hp - damage);
        lines.push('└─ ' + damage + ' damage → Boss HP: ' + target.hp + '/' + ctx.activeBoss.maxHp);
      }
    }

    else if (cardName === 'Suppression Fire') {
      handled = true;
      lines.push('├─ 🔥 Opening suppression fire...');
      var exploitResult = ctx.activeBoss.checkExploit({ type: 'SUPPRESSION_FIRE', card: card }, gameState);
      var damage = (card.stats && card.stats.damage) || 2;
      if (exploitResult.exploited) {
        lines.push('├─ ' + exploitResult.message);
      }
      if (target) {
        target.hp = Math.max(0, target.hp - damage);
        lines.push('└─ ' + damage + ' damage → Boss HP: ' + target.hp + '/' + ctx.activeBoss.maxHp);
      }
    }

    return { handled: handled, lines: lines };
  }

  // ── Enemy AI ──────────────────────────────────────────────

  /**
   * Check if enemy has an explosive EATK card in their deck and roll for usage.
   * Returns the EATK card definition or null if no explosive is chosen.
   */
  function _tryEnemyExplosiveCard() {
    if (!_enemy || !_enemy.cardDeck || !_enemy.cardDeck.length) return null;
    if (typeof GoneRogueDataRegistry === 'undefined') return null;

    // Gather unstolen explosive cards from enemy deck
    var explosives = [];
    for (var i = 0; i < _enemy.cardDeck.length; i++) {
      var slot = _enemy.cardDeck[i];
      if (slot.stolen) continue;
      var def = GoneRogueDataRegistry.getEnemyCard ? GoneRogueDataRegistry.getEnemyCard(slot.id) : null;
      if (!def) continue;
      var tags = def.tags || [];
      for (var t = 0; t < tags.length; t++) {
        if (tags[t] === 'explosive') {
          explosives.push({ index: i, def: def });
          break;
        }
      }
    }

    if (!explosives.length) return null;

    // 25% chance per round to use an explosive (telegraphed, so not spammed)
    if (_rng() > 0.25) return null;

    // Pick a random explosive from available
    var pick = explosives[Math.floor(_rng() * explosives.length)];
    // Mark as used (consume from deck for this combat)
    _enemy.cardDeck[pick.index].stolen = true;
    _enemy.cardCount = _enemy.cardDeck.filter(function(s) { return !s.stolen; }).length;

    // Flag as explosive for route detection in resolveAction
    var cardObj = {
      name: pick.def.name,
      emoji: pick.def.emoji,
      type: 'attack',
      category: 'attack',
      _isExplosiveEATK: true,
      _eatkDef: pick.def,
      stats: {
        damage: pick.def.damage || 0,
        accuracy: pick.def.accuracy || 60,
        energy: 1,
        speed: pick.def.speed || 2
      }
    };
    return cardObj;
  }

  function getEnemyAICard() {
    var enemy = _enemy;
    var enemyHpPercent = (enemy.hp / (enemy.maxHp || 5)) * 100;

    // ── Explosive card check: mid/high HP enemies may throw explosives ──
    if (enemyHpPercent > 40) {
      var explosiveCard = _tryEnemyExplosiveCard();
      if (explosiveCard) return explosiveCard;
    }

    var rawCard = null;

    if (enemyHpPercent < 30) {
      var roll = _rng();
      if (roll < 0.4 && typeof CardSystem !== 'undefined') {
        rawCard = CardSystem.rollCard('Dodge');
      } else if (roll < 0.7 && typeof CardSystem !== 'undefined') {
        rawCard = CardSystem.rollCard('Prone');
      }
    }

    if (!rawCard && enemyHpPercent > 50) {
      var attackRoll = _rng();
      if (typeof CardSystem !== 'undefined') {
        if (attackRoll < 0.5) {
          rawCard = CardSystem.rollCard('Single Shot');
        } else if (attackRoll < 0.8) {
          rawCard = CardSystem.rollCard('Burst Shot');
        } else {
          rawCard = CardSystem.rollCard('Overwatch');
        }
      }
    }

    if (!rawCard && typeof CardSystem !== 'undefined') {
      rawCard = CardSystem.rollCard('Single Shot');
    }

    if (!rawCard) {
      return {
        name: 'Basic Attack',
        emoji: '🔫',
        type: 'attack',
        category: 'attack',
        stats: { damage: 2, accuracy: 70, energy: 1, speed: 2 }
      };
    }

    // CardSystem.rollCard returns CI-* CardRefs when GAMESTATE is available.
    // Hydrate to full card object so downstream systems (intent, combat) have stats/name/emoji.
    if (rawCard.id && rawCard.id.indexOf('CI-') === 0 && typeof CardStateAuthority !== 'undefined' && CardStateAuthority.hydrateCard) {
      var hydrated = CardStateAuthority.hydrateCard(rawCard);
      if (hydrated && hydrated.stats) return hydrated;
    }

    return rawCard;
  }

  // ── Round Execution ───────────────────────────────────────

  function executeSimultaneousRound(playerCard, enemyCard, ctx) {
    _phase = 'resolving';
    _round++;

    var actions = [];

    if (playerCard) {
      var category = typeof CardSystem !== 'undefined' ? CardSystem.getCardCategory(playerCard) : 'attack';
      var priority = typeof CardSystem !== 'undefined' ? CardSystem.getCardPriority(category) : 4;
      var speed = (playerCard.stats && playerCard.stats.speed) || ctx.player.initiative || 0;

      actions.push({
        actor: 'player',
        card: playerCard,
        category: category,
        priority: priority,
        speed: speed
      });
    }

    if (enemyCard) {
      var enemyCategory = typeof CardSystem !== 'undefined' ? CardSystem.getCardCategory(enemyCard) : 'attack';
      var enemyPriority = typeof CardSystem !== 'undefined' ? CardSystem.getCardPriority(enemyCategory) : 4;
      var enemySpeed = (enemyCard.stats && enemyCard.stats.speed) || _enemy.initiative || 0;

      actions.push({
        actor: 'enemy',
        card: enemyCard,
        category: enemyCategory,
        priority: enemyPriority,
        speed: enemySpeed
      });
    }

    actions.sort(function(a, b) {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return b.speed - a.speed;
    });

    var lines = [];
    lines.push('═══ ROUND ' + _round + ' RESOLUTION ═══');
    lines.push('');

    // ── Tick pending delayed explosives (C4) at round start ──
    if (typeof CardPlaySystem !== 'undefined' && typeof CardPlaySystem.tickPendingExplosives === 'function') {
      var tickResult = CardPlaySystem.tickPendingExplosives(ctx);
      if (tickResult && tickResult.lines && tickResult.lines.length) {
        lines = lines.concat(tickResult.lines);
      }
    }

    for (var i = 0; i < actions.length; i++) {
      var action = actions[i];

      // ── Route enemy explosive cards through 60% reduction path ──
      if (action.actor === 'enemy' && action.card && action.card._isExplosiveEATK) {
        if (typeof CardPlaySystem !== 'undefined' && typeof CardPlaySystem.playEnemyExplosiveCard === 'function') {
          var explosiveResult = CardPlaySystem.playEnemyExplosiveCard(action.card._eatkDef, ctx);
          if (explosiveResult && explosiveResult.lines) {
            lines = lines.concat(explosiveResult.lines);
          }
        }
      } else {
        var result = resolveAction(action, ctx);
        if (result && result.lines) {
          lines = lines.concat(result.lines);
        }
      }

      if (_enemy.hp <= 0) {
        lines.push('');
        lines.push('💀 ENEMY DEFEATED!');
        ctx.onEnemyKilled();
        var exitResult = exitCombat('player_victory', ctx);
        return {
          lines: lines.concat(exitResult.lines || []),
          stayActive: exitResult.stayActive
        };
      }

      if (ctx.player.hp <= 0) {
        lines.push('');
        lines.push('💀 YOU HAVE BEEN DEFEATED...');
        return ctx.handlePlayerDeath('combat_damage', { enemy: _enemy });
      }
    }

    lines.push('');
    lines.push('═══════════════════════════');
    lines.push('');

    if (typeof EnemyIntentSystem !== 'undefined' && _enemy.intentState) {
      var nextEnemyCard = getEnemyAICard();
      _enemy.intentState = EnemyIntentSystem.createIntentState(_enemy, nextEnemyCard);
    }

    return showCombatUIWithLog(lines, ctx);
  }

  function executeMultiCardRound(playerCards, ctx) {
    _phase = 'resolving';
    _round++;

    var actions = [];

    for (var i = 0; i < playerCards.length; i++) {
      var card = playerCards[i];
      var category = typeof CardSystem !== 'undefined' ? CardSystem.getCardCategory(card) : 'attack';
      var priority = typeof CardSystem !== 'undefined' ? CardSystem.getCardPriority(category) : 4;
      var speed = (card.stats && card.stats.speed) || ctx.player.initiative || 0;

      actions.push({
        actor: 'player',
        card: card,
        category: category,
        priority: priority,
        speed: speed
      });
    }

    var enemyCard = getEnemyAICard();
    if (enemyCard) {
      var enemyCategory = typeof CardSystem !== 'undefined' ? CardSystem.getCardCategory(enemyCard) : 'attack';
      var enemyPriority = typeof CardSystem !== 'undefined' ? CardSystem.getCardPriority(enemyCategory) : 4;
      var enemySpeed = (enemyCard.stats && enemyCard.stats.speed) || _enemy.initiative || 0;

      actions.push({
        actor: 'enemy',
        card: enemyCard,
        category: enemyCategory,
        priority: enemyPriority,
        speed: enemySpeed
      });
    }

    actions.sort(function(a, b) {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return b.speed - a.speed;
    });

    var lines = [];
    lines.push('═══ ROUND ' + _round + ' RESOLUTION ═══');
    lines.push('💥 MULTI-CARD COMBO: ' + playerCards.length + ' cards');
    lines.push('');

    // ── Tick pending delayed explosives (C4) at round start ──
    if (typeof CardPlaySystem !== 'undefined' && typeof CardPlaySystem.tickPendingExplosives === 'function') {
      var tickResult2 = CardPlaySystem.tickPendingExplosives(ctx);
      if (tickResult2 && tickResult2.lines && tickResult2.lines.length) {
        lines = lines.concat(tickResult2.lines);
      }
    }

    for (var j = 0; j < actions.length; j++) {
      var action = actions[j];

      // ── Route enemy explosive cards through 60% reduction path ──
      if (action.actor === 'enemy' && action.card && action.card._isExplosiveEATK) {
        if (typeof CardPlaySystem !== 'undefined' && typeof CardPlaySystem.playEnemyExplosiveCard === 'function') {
          var explosiveResult2 = CardPlaySystem.playEnemyExplosiveCard(action.card._eatkDef, ctx);
          if (explosiveResult2 && explosiveResult2.lines) {
            lines = lines.concat(explosiveResult2.lines);
          }
        }
      } else {
        var result = resolveAction(action, ctx);
        if (result && result.lines) {
          lines = lines.concat(result.lines);
        }
      }

      if (_enemy.hp <= 0) {
        lines.push('');
        lines.push('💀 ENEMY DEFEATED!');
        ctx.onEnemyKilled();
        var exitResult = exitCombat('player_victory', ctx);
        return {
          lines: lines.concat(exitResult.lines || []),
          stayActive: exitResult.stayActive
        };
      }

      if (ctx.player.hp <= 0) {
        lines.push('');
        lines.push('💀 YOU HAVE BEEN DEFEATED...');
        return ctx.handlePlayerDeath('combat_damage', { enemy: _enemy });
      }
    }

    lines.push('');
    lines.push('═══════════════════════════');
    lines.push('');

    if (typeof EnemyIntentSystem !== 'undefined' && _enemy.intentState) {
      var nextEnemyCard = getEnemyAICard();
      _enemy.intentState = EnemyIntentSystem.createIntentState(_enemy, nextEnemyCard);
    }

    return showCombatUIWithLog(lines, ctx);
  }

  function executeRound(initiator, card, ctx) {
    _phase = 'resolving';
    _round++;

    if (initiator === 'player') {
      return playerAttack(card, ctx);
    } else {
      return enemyAttack(ctx);
    }
  }

  function playerAttack(card, ctx) {
    var enemy = _enemy;
    if (!enemy || enemy.hp <= 0) {
      return exitCombat('player_victory', ctx);
    }

    if (card && card.resourceCost && card.resourceCost.ammo) {
      _ammoSpent += card.resourceCost.ammo;
    } else if (card && card.baseStats && card.baseStats.ammo) {
      _ammoSpent += card.baseStats.ammo;
    }

    var hitResult = calculateHit(ctx.player, enemy, _advantage);

    if (!hitResult.hit) {
      _log.push('💨 PLAYER MISS!');
      _log.push('');
      return enemyAttack(ctx);
    }

    var damageResult = calculateDamage(ctx.player, enemy, _advantage, card, hitResult.crit);
    enemy.hp -= damageResult.damage;

    var critEmoji = hitResult.crit ? ' 💥 CRIT!' : '';
    _log.push('⚡ PLAYER ATTACK' + critEmoji);
    _log.push('├─ Hit: ' + (hitResult.roll || 0) + ' vs ' + (hitResult.target || 0));
    _log.push('└─ Damage: ' + damageResult.damage + ' HP');
    if (damageResult.bonuses.length > 0) {
      _log.push('   └─ Bonuses: ' + damageResult.bonuses.join(', '));
    }
    _log.push('');

    if (enemy.hp <= 0) {
      _log.push('💀 ENEMY DEFEATED!');
      return exitCombat('player_victory', ctx);
    }

    return enemyAttack(ctx);
  }

  function enemyAttack(ctx) {
    var enemy = _enemy;
    if (!enemy || enemy.hp <= 0) {
      return exitCombat('player_victory', ctx);
    }

    var reverseAdvantage = _advantage === 'flanked' ? 'ambush' :
                          _advantage === 'ambush' ? 'flanked' : 'neutral';
    var hitResult = calculateHit(enemy, ctx.player, reverseAdvantage);

    if (!hitResult.hit) {
      _log.push('💨 ENEMY MISS!');
      _log.push('');
      return showCombatUI(ctx);
    }

    var damageResult = calculateDamage(enemy, ctx.player, reverseAdvantage, null, hitResult.crit);
    ctx.player.hp -= damageResult.damage;

    var critEmoji = hitResult.crit ? ' 💥 CRIT!' : '';
    _log.push('🗡️  ENEMY ATTACK' + critEmoji);
    _log.push('├─ Hit: ' + (hitResult.roll || 0) + ' vs ' + (hitResult.target || 0));
    _log.push('└─ Damage: ' + damageResult.damage + ' HP');
    _log.push('');

    if (ctx.player.hp <= 0) {
      _log.push('💀 YOU HAVE BEEN DEFEATED...');

      if (typeof PassiveItemsSystem !== 'undefined' && PassiveItemsSystem.tryPreventCombatDeath) {
        var medbed = PassiveItemsSystem.tryPreventCombatDeath({
          player: ctx.player,
          enemy: _enemy,
          context: { floor: ctx.floor, entryPos: _entryPos }
        });

        if (medbed && medbed.prevented) {
          if (medbed.mode === 'full') {
            _log.push('🛏️ MEDBED: FULL HEAL TRIGGERED');
            _log.push('└─ HP restored to ' + ctx.player.hp + '/' + ctx.player.maxHp);
            _log.push('');
            return showCombatUI(ctx);
          }
          return exitCombat('medbed_soft_defeat', ctx);
        }
      }

      if (_enemy && _enemy._npcGateId) {
        ctx.player.hp = ctx.player.maxHp;
        if (_entryPos) {
          ctx.player.x = _entryPos.x;
          ctx.player.y = _entryPos.y;
        }
        return exitCombat('npc_gate_soft_defeat', ctx);
      }

      return ctx.handlePlayerDeath('combat_damage', { enemy: _enemy });
    }

    return showCombatUI(ctx);
  }

  // ── Combat Entry ──────────────────────────────────────────

  function enterCombat(enemy, trigger, card, ctx) {
    // Break passive items that break on combat
    if (typeof PassiveItemsSystem !== 'undefined' && PassiveItemsSystem.checkAndBreakItems) {
      PassiveItemsSystem.checkAndBreakItems('combat');
    }

    // Break-on-combat effect interpreter
    try {
      if (typeof GoneRogueEffectInterpreter !== 'undefined' && GoneRogueEffectInterpreter.shouldBreakOnCombat && GoneRogueEffectInterpreter.shouldBreakOnCombat()) {
        if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getActiveItem === 'function') {
          var activeRef = GAMESTATE.getActiveItem();
          if (activeRef && activeRef.id) {
            GAMESTATE.clearActiveItem();
            if (GoneRogueEffectInterpreter.clearBreakOnCombat) {
              GoneRogueEffectInterpreter.clearBreakOnCombat();
            }
            if (typeof TooltipSystem !== 'undefined') {
              TooltipSystem.showPersistent('💥 BOX BROKE ON COMBAT INITIATION', 1400);
            }
          }
        }
      }
    } catch (e) {}

    // Reset draw state for new combat via CSA
    try {
      if (typeof CardStateAuthority !== 'undefined' && typeof CardStateAuthority.resetCombatDrawState === 'function') {
        CardStateAuthority.resetCombatDrawState();
      } else if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.resetCombatBackupDrawFlag === 'function') {
        GAMESTATE.resetCombatBackupDrawFlag();
      }
    } catch (e0) {}

    // Deployed box: exit if player is hiding inside one
    if (ctx.playerInBox) {
      var _combatBox = ctx.playerInBox;
      if (_combatBox.quality === 'legendary') {
        ctx.playerExitBox('legendary_combat');
        if (typeof TooltipSystem !== 'undefined') {
          TooltipSystem.showPersistent('📦 Legendary box persists!', 1400);
        }
      } else {
        ctx.playerExitBox('combat');
        if (typeof TooltipSystem !== 'undefined') {
          TooltipSystem.showPersistent('💥 BOX DESTROYED ON COMBAT', 1400);
        }
      }
    }

    // Freeze realtime game loop
    ctx.pauseGameLoop();

    // Check for combat in no-combat zone trigger (bonfire floors)
    var floorType = ctx.getFloorType(ctx.floor);
    if (floorType === ctx.FLOOR_TYPES.BONFIRE && typeof SecretFloors !== 'undefined') {
      var triggerResult = SecretFloors.triggerSecretFloor(
        SecretFloors.TRIGGER_TYPES.COMBAT_NO_COMBAT_ZONE,
        { inNoCombatZone: true }
      );

      if (triggerResult.success) {
        console.log('[StrCombatEngine] Combat in no-combat zone triggered secret floor');
      }
    }

    // Track combat entry for mythic conditions
    ctx.player.combatEntries++;

    // Initialize combat state
    _active = true;
    _enemy = enemy;
    _entryPos = { x: ctx.player.x, y: ctx.player.y };
    _round = 0;
    _log = [];
    _ammoSpent = 0;
    _phase = 'countdown';

    // Phase 2: compute cardCount from hydrated deck
    if (Array.isArray(enemy.cardDeck) && enemy.cardDeck.length) {
      enemy.cardCount = enemy.cardDeck.filter(function(s) { return !s.stolen; }).length;
    }

    // Initialize enemy intent state
    if (typeof EnemyIntentSystem !== 'undefined') {
      var enemyNextCard = getEnemyAICard();
      enemy.intentState = EnemyIntentSystem.createIntentState(enemy, enemyNextCard);
    }

    // Tooltip: Engaging enemy
    if (typeof TooltipSystem !== 'undefined') {
      TooltipSystem.showAction('combat-enter');
    }

    // Calculate advantage state
    _advantage = calculateAdvantage(ctx.player, enemy, trigger, ctx);

    // Phase tooltip: initiative
    ctx.combatPhaseTooltip('initiative', 'Advantage: ' + _advantage.toUpperCase(), 1800);

    // Update intent based on advantage
    if (typeof EnemyIntentSystem !== 'undefined' && _advantage === 'ambush') {
      enemy.intentState.expression = EnemyIntentSystem.onCombatEvent(enemy, 'ambushed');
    }

    // Scan 3x3 tiles around player for ground effects
    ctx.applyGroundEffectModifiers();

    // Apply pet combat modifiers (Mega tier only)
    if (typeof PetFollower !== 'undefined') {
      var combatContext = {
        playerAccuracy: 0,
        playerCritMultiplier: 0,
        enemyStatus: enemy.statusEffects || {},
        petAutoStrike: false,
        petStrikeDamage: 0
      };

      PetFollower.applyCombatModifiers(combatContext);

      if (combatContext.playerAccuracy > 0) {
        ctx.player.accuracyBonus = (ctx.player.accuracyBonus || 0) + combatContext.playerAccuracy;
        _log.push('🐾 Pet grants +' + combatContext.playerAccuracy.toFixed(0) + '% accuracy!');
      }
      if (combatContext.playerCritMultiplier > 0) {
        ctx.player.critBonus = (ctx.player.critBonus || 0) + combatContext.playerCritMultiplier;
      }
      if (combatContext.petAutoStrike) {
        enemy.hp -= combatContext.petStrikeDamage;
        _log.push('🔫 Pet auto-strike! ' + combatContext.petStrikeDamage + ' damage!');
      }
    }

    // Build countdown context messages
    _context = ctx.buildCountdownMessages(enemy, trigger);

    // Add combat entry message with emoji
    var advantageEmoji = getAdvantageEmoji(_advantage);
    _log.push('⚔️  STR COMBAT INITIATED ' + advantageEmoji);
    _log.push('└─ Advantage: ' + _advantage.toUpperCase());
    _log.push('');

    // Apply initiative rules
    var playerGoesFirst = false;
    if (_advantage === 'ambush') {
      _log.push('🎯 PLAYER AMBUSH! Free opening attack!');
      playerGoesFirst = true;
    } else if (_advantage === 'flanked' || _advantage === 'disadvantaged') {
      _log.push('⚠️  ENEMY HAS ADVANTAGE! They attack first!');
      playerGoesFirst = false;
    } else {
      playerGoesFirst = ctx.player.initiative >= (enemy.initiative || 0);
    }

    // Enable combat zoom/focus
    ctx.enableCombatZoom();

    // Execute first round
    if (playerGoesFirst && trigger === 'player_attack' && card) {
      return executeRound('player', card, ctx);
    } else if (!playerGoesFirst) {
      return executeRound('enemy', null, ctx);
    } else {
      return showCombatUI(ctx);
    }
  }

  // ── Combat Exit ───────────────────────────────────────────

  function exitCombat(reason, ctx) {
    var lines = [];

    if (reason === 'player_victory') {
      ctx.combatPhaseTooltip('victory');
      lines.push('✅ COMBAT VICTORY!');
      lines.push('└─ Enemy neutralized');

      // Capture victory context for animated sequence
      var _victoryCtx = {
        enemyEmoji: _enemy ? (_enemy.emoji || '👾') : '👾',
        enemyName: _enemy ? (_enemy.name || 'Enemy') : 'Enemy',
        playerHp: ctx.player ? ctx.player.hp : 10,
        playerMaxHp: ctx.player ? (ctx.player.maxHp || 10) : 10,
        combatLog: _log.slice(),
        round: _round,
        advantage: _advantage,
        usedBlvck: _log.some(function(l) { return l && (l.indexOf('BLVCK') >= 0 || l.indexOf('STRUGGLE') >= 0); }),
        statusEffects: [],
        lootCards: [],
        lootCurrency: 0,
        lootAmmo: 0,
        lootCharms: [],
        stolenCards: [],
        overkill: _enemy ? (_enemy.hp < -(_enemy.maxHp || 5)) : false,
        isBoss: !!(ctx.bossFloorActive && ctx.activeBoss),
        enemyX: _enemy ? _enemy.x : ctx.player.x,
        enemyY: _enemy ? _enemy.y : ctx.player.y
      };

      // NPC gate combat
      if (_enemy && _enemy._npcGateId) {
        var gateNpc = ctx.getNpcById(_enemy._npcGateId);
        if (gateNpc) {
          gateNpc.state.released = true;
          ctx.clearNpcGateZones(gateNpc.id);

          if (_enemy._npcGateType === 'defeatable') {
            ctx.npcs = ctx.npcs.filter(function(n) { return n.id !== gateNpc.id; });
            delete ctx.tileMetadata[gateNpc.x + ',' + gateNpc.y];
            var npcTile = ctx.grid[gateNpc.y][gateNpc.x];
            if (npcTile !== ctx.TILES.EXIT && npcTile !== ctx.TILES.DOOR) {
              ctx.grid[gateNpc.y][gateNpc.x] = ctx.TILES.EMPTY;
            }
            lines.push('🧱 GATE REMOVED: ' + gateNpc.name + ' yields the path.');
          } else {
            lines.push('🟢 GATE RELEASED: ' + gateNpc.name + ' lets you pass.');
          }

          if (!gateNpc.state.rewardGiven && gateNpc.reward) {
            gateNpc.state.rewardGiven = true;
            if (gateNpc.reward.currency) {
              GAMESTATE.addMoney(gateNpc.reward.currency);
              lines.push('💰 REWARD: +' + gateNpc.reward.currency);
            }
          }

          if (typeof DebriefFeedController !== 'undefined' && DebriefFeedController.showSynergyOverlay) {
            DebriefFeedController.showSynergyOverlay({
              kind: 'gate',
              keyEmoji: '🥊',
              gateEmoji: '🚧',
              text: 'Gate cleared'
            });
          }
        }
      } else {
        // Handle enemy death through centralized death system
        var deathResult = ctx.handleEnemyDeath(_enemy, 'player', {
          player: ctx.player,
          location: { x: _enemy.x, y: _enemy.y }
        });

        if (deathResult && deathResult.messages && deathResult.messages.length > 0) {
          deathResult.messages.forEach(function(msg) {
            if (msg) lines.push(msg);
          });
        }

        // Calculate ammo drops
        var ammoDrops = Math.floor(_ammoSpent / 3);
        if (ammoDrops > 0) {
          GAMESTATE.addAmmo(ammoDrops);
          lines.push('⁍ AMMO RECOVERED: +' + ammoDrops + ' (' + _ammoSpent + ' spent in combat)');
          _victoryCtx.lootAmmo = ammoDrops;

          if (typeof DebriefFeedController !== 'undefined' && DebriefFeedController.reportResourceChange) {
            var currentAmmo = GAMESTATE.getAmmo ? GAMESTATE.getAmmo() : 0;
            DebriefFeedController.reportResourceChange('ammo', currentAmmo - ammoDrops, currentAmmo, 'Enemy Defeated');
          }
        }

        // ── LootSpillSystem: collect ground drops → scatter → place ──
        var _lootPending = [];
        var _origAddItem = (typeof WorldItems !== 'undefined') ? WorldItems.addItem : null;
        var _origItemsPush = ctx.items.push;
        if (typeof LootSpillSystem !== 'undefined') {
          if (_origAddItem) { WorldItems.addItem = function(item) { _lootPending.push(item); }; }
          ctx.items.push = function(item) { _lootPending.push(item); };
        }

        // ── Populate victory context from deathResult ──
        // (Loot already spawned by death-exit-system.handleEnemyDeath —
        //  DO NOT re-spawn currency/cards/charms here or player gets 2x drops)
        if (deathResult && deathResult.loot) {
          _victoryCtx.lootCurrency += deathResult.loot.currency || 0;
          // Card info resolved by death-exit-system
          if (deathResult._resolvedCards) {
            for (var rc = 0; rc < deathResult._resolvedCards.length; rc++) {
              _victoryCtx.lootCards.push(deathResult._resolvedCards[rc]);
            }
          }
          // Charm info resolved by death-exit-system
          if (deathResult._resolvedCharms) {
            for (var rch = 0; rch < deathResult._resolvedCharms.length; rch++) {
              _victoryCtx.lootCharms.push(deathResult._resolvedCharms[rch]);
            }
          }
        }

        // Boss fight handling
        if (ctx.bossFloorActive && ctx.activeBoss && !ctx.bossDefeated) {
          ctx.onBossDefeated();
          lines.push('');
          lines.push('🏆 BOSS DEFEATED!');

          // Check for boss overkill
          if (typeof SecretFloors !== 'undefined' && _enemy) {
            var totalDamageDealt = ctx.activeBoss.maxHp;
            var overkillThreshold = ctx.activeBoss.maxHp * 2;

            if (totalDamageDealt >= overkillThreshold) {
              var triggerResult = SecretFloors.triggerSecretFloor(
                SecretFloors.TRIGGER_TYPES.BOSS_OVERKILL,
                { damageDealt: totalDamageDealt, bossMaxHp: ctx.activeBoss.maxHp }
              );

              if (triggerResult.success) {
                lines.push('');
                lines.push(triggerResult.message);
                lines.push('└─ Reality feels unstable...');
              } else if (triggerResult.suspicion) {
                lines.push('└─ Something feels... wrong. [' + triggerResult.suspicion + '/' + triggerResult.threshold + ']');
              }
            }
          }

          // Generate boss special loot
          var bossLoot = ctx.activeBoss.onDefeat(ctx.player);
          lines.push('');

          if (bossLoot.loot && bossLoot.loot.length > 0) {
            bossLoot.loot.forEach(function(lootItem) {
              if (lootItem.type === 'card') {
                var card;
                if (typeof CardSystem !== 'undefined') {
                  var baseType = CardSystem.getRandomBaseCard();
                  card = CardSystem.rollCard(baseType, { source: 'boss_drop', floor: ctx.floor || 0, enemyType: _enemy.name || 'boss' });
                  // CHH Step 3: rollCard returns CI-* ref. Override quality on the instance if needed.
                  if (card && card.id && lootItem.quality && typeof GAMESTATE !== 'undefined' && GAMESTATE.getCardInstance) {
                    var bossInst = GAMESTATE.getCardInstance(card.id);
                    if (bossInst) bossInst.quality = lootItem.quality;
                  }
                }
                if (card && card.id) {
                  // CHH Step 3: Boss card → canonical acquireNewCardDuringCombat pipeline
                  var bossInsert = (typeof GAMESTATE !== 'undefined' && GAMESTATE.acquireNewCardDuringCombat)
                    ? GAMESTATE.acquireNewCardDuringCombat(card.id, 1) : null;
                  // Hydrate for display info
                  var bossCardDef = (typeof CardStateAuthority !== 'undefined' && CardStateAuthority.hydrateCard)
                    ? CardStateAuthority.hydrateCard(card) : card;
                  if (bossInsert && bossInsert.success) {
                    try {
                      if (typeof DebriefFeedController !== 'undefined' && DebriefFeedController.reportResourceChange) {
                        DebriefFeedController.reportResourceChange('Cards', 0, 1, '\uD83C\uDCA0 ' + ((bossCardDef && bossCardDef.name) || 'Boss Card'));
                      }
                    } catch (eDF) {}
                    try {
                      if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
                        OverheadAnimator.showGenericExpression(ctx.player.x, ctx.player.y, '\uD83C\uDCA0', 800, '#800080');
                      }
                    } catch (eOH) {}
                  } else {
                    var bossCardDrop = { x: _enemy.x, y: _enemy.y, type: 'card', card: card, spawnTime: Date.now(), decayTime: 60000 };
                    if (typeof WorldItems !== 'undefined') { WorldItems.addItem(bossCardDrop); } else { ctx.items.push(bossCardDrop); }
                  }
                  var bossName = (bossCardDef && bossCardDef.name) || 'Boss Card';
                  var bossEmoji = (bossCardDef && bossCardDef.emoji) || '🎴';
                  var bossQuality = (bossCardDef && bossCardDef.quality) || '';
                  lines.push('🎴 Boss dropped: ' + bossEmoji + ' ' + bossName + ' (' + bossQuality + ')');
                  _victoryCtx.lootCards.push({ emoji: bossEmoji, name: bossName, quality: bossQuality });
                }
              } else if (lootItem.type === 'whisper') {
                lines.push('✨ WHISPER ITEM: ' + lootItem.item);
                ctx.spawnCurrency(_enemy.x, _enemy.y, 50);
              } else if (lootItem.type === 'mythic') {
                lines.push('');
                lines.push('⚡⚡⚡ MYTHIC CONDITION MET! ⚡⚡⚡');
                lines.push('💎 MYTHIC DROP: ' + lootItem.item);
                lines.push('');
                if (typeof CardSystem !== 'undefined') {
                  var legendaryCard = CardSystem.rollCard('Inventory Charm', { source: 'mythic_drop', floor: ctx.floor || 0, enemyType: _enemy.name || 'mythic' });
                  if (legendaryCard && legendaryCard.id) {
                    // CHH Step 3: Mythic card → canonical acquireNewCardDuringCombat pipeline
                    var mythicInsert = (typeof GAMESTATE !== 'undefined' && GAMESTATE.acquireNewCardDuringCombat)
                      ? GAMESTATE.acquireNewCardDuringCombat(legendaryCard.id, 1) : null;
                    var mythicCardDef = (typeof CardStateAuthority !== 'undefined' && CardStateAuthority.hydrateCard)
                      ? CardStateAuthority.hydrateCard(legendaryCard) : legendaryCard;
                    if (mythicInsert && mythicInsert.success) {
                      try {
                        if (typeof DebriefFeedController !== 'undefined' && DebriefFeedController.reportResourceChange) {
                          DebriefFeedController.reportResourceChange('Cards', 0, 1, '\uD83C\uDCA0 MYTHIC ' + ((mythicCardDef && mythicCardDef.name) || 'Card'));
                        }
                      } catch (eDF) {}
                    } else {
                      var mythicDrop = { x: _enemy.x, y: _enemy.y, type: 'card', card: legendaryCard, spawnTime: Date.now(), decayTime: 120000 };
                      if (typeof WorldItems !== 'undefined') { WorldItems.addItem(mythicDrop); } else { ctx.items.push(mythicDrop); }
                    }
                  }
                }
              } else if (lootItem.type === 'rumor') {
                lines.push('');
                lines.push('📜 ' + lootItem.message);
                lines.push('');
              }
            });
          }

          // Check for Impossible Charm drop
          if (ctx.activeBoss && typeof CardSystem !== 'undefined') {
            var isUberMega = ctx.activeBoss.type === 'UBER_MEGA';
            var isFinalBoss = ctx.floor === 30;
            var impossibleCharmChance = 0;

            if (isUberMega) {
              impossibleCharmChance = 0.05;
            } else if (isFinalBoss) {
              impossibleCharmChance = 0.10;
            }

            if (impossibleCharmChance > 0 && _rng() < impossibleCharmChance) {
              var impossibleCharm = CardSystem.rollImpossibleCharm();
              var impossibleDrop = { x: _enemy.x, y: _enemy.y, type: 'charm', card: impossibleCharm, spawnTime: Date.now(), decayTime: 120000 };
              if (typeof WorldItems !== 'undefined') { WorldItems.addItem(impossibleDrop); } else { ctx.items.push(impossibleDrop); }
              lines.push('');
              lines.push('💠💠💠 IMPOSSIBLE BINARY CHARM DROPPED! 💠💠💠');
              lines.push('└─ A legendary artifact materializes...');
              lines.push('');
            }
          }
        }
      }

      // NOTE: Canonical resource drops (COLLECTIBLES_CANON) already handled
      // by death-exit-system.handleEnemyDeath — not duplicated here.

      // ── LootSpillSystem: restore interceptors and scatter boss-only ground drops ──
      if (_origAddItem) { WorldItems.addItem = _origAddItem; }
      ctx.items.push = _origItemsPush;
      if (_lootPending.length > 0 && typeof LootSpillSystem !== 'undefined') {
        LootSpillSystem.scatterItems(_enemy.x, _enemy.y, _lootPending, ctx);
        var ENEMY_DECAY_FLOOR = 45000;
        for (var lp = 0; lp < _lootPending.length; lp++) {
          var _lpItem = _lootPending[lp];
          if (_lpItem.decayTime && _lpItem.decayTime < ENEMY_DECAY_FLOOR) {
            _lpItem.decayTime = ENEMY_DECAY_FLOOR;
          }
          if (_lpItem._isCurrency) {
            delete _lpItem._isCurrency;
            if (typeof WorldItems !== 'undefined') { WorldItems.addCurrency(_lpItem); }
            else { ctx.currencies ? ctx.currencies.push(_lpItem) : void 0; }
          } else {
            if (typeof WorldItems !== 'undefined') { WorldItems.addItem(_lpItem); }
            else { ctx.items.push(_lpItem); }
          }
        }
      }

      // Remove defeated enemy from map
      var enemyIndex = ctx.enemies.indexOf(_enemy);
      if (enemyIndex > -1) {
        ctx.enemies[enemyIndex].hp = 0;
      }

      // Fire animated victory sequence
      if (typeof STRVictorySequence !== 'undefined' && typeof STRVictorySequence.play === 'function') {
        var _capturedEnemy = _enemy;
        var _capturedLines = lines.slice();

        try {
          if (typeof STRCombatWindow !== 'undefined' && typeof STRCombatWindow.hide === 'function') {
            STRCombatWindow.hide();
          }
          if (typeof HandFanComponent !== 'undefined' && typeof HandFanComponent.hide === 'function') {
            HandFanComponent.hide();
            if (typeof HandFanComponent.clearSelection === 'function') HandFanComponent.clearSelection();
          }
        } catch (e0) {}

        STRVictorySequence.play(_victoryCtx, function() {
          _active = false;
          _phase = 'idle';
          _enemy = null;
          _advantage = 'neutral';
          _round = 0;
          _log = [];

          ctx.disableCombatZoom();

          try {
            if (typeof BackupActionContainer !== 'undefined' && typeof BackupActionContainer.hide === 'function') {
              BackupActionContainer.hide();
            }
          } catch (e1) {}

          ctx.startGameLoop();
          ctx.saveState();

          ctx.scatterPostCombatNodes(_capturedEnemy, _victoryCtx);
        });

        return {
          lines: lines.concat(ctx.renderGrid()),
          prompt: ctx.getPrompt(),
          stayActive: true
        };
      }

    } else if (reason === 'medbed_soft_defeat' || reason === 'npc_gate_soft_defeat' || reason === 'fled') {

      var _exitCtx = {
        playerHp: ctx.player ? ctx.player.hp : 0,
        playerMaxHp: ctx.player ? (ctx.player.maxHp || 10) : 10,
        enemyEmoji: _enemy ? (_enemy.emoji || '👾') : '👾',
        enemyName: _enemy ? (_enemy.name || 'Enemy') : 'Enemy',
        gateNpcName: (_enemy && _enemy._npcGateId) ? _enemy.name : null,
        round: _round
      };

      if (reason === 'fled' && ctx.player.lastMoveDirection) {
        var reverseDir = {
          'north': { dx: 0, dy: 1 },
          'south': { dx: 0, dy: -1 },
          'east': { dx: -1, dy: 0 },
          'west': { dx: 1, dy: 0 }
        };
        var move = reverseDir[ctx.player.lastMoveDirection];
        if (move) {
          ctx.player.x += move.dx;
          ctx.player.y += move.dy;
        }
      }

      if (reason === 'medbed_soft_defeat' && ctx.player) {
        ctx.player.hp = Math.ceil((ctx.player.maxHp || 10) * 0.5);
      }

      if (reason === 'medbed_soft_defeat') {
        ctx.combatPhaseTooltip('defeat', 'Medbed stabilized');
        lines.push('🛏️ MEDBED STABILIZED');
      } else if (reason === 'npc_gate_soft_defeat') {
        ctx.combatPhaseTooltip('defeat', 'Training match');
        lines.push('💀 DEFEAT (TRAINING MATCH)');
      } else {
        lines.push('🏃 FLED COMBAT!');
      }

      // Fire animated exit sequence
      if (typeof STRExitSequence !== 'undefined' && typeof STRExitSequence.play === 'function') {

        try {
          if (typeof STRCombatWindow !== 'undefined' && typeof STRCombatWindow.hide === 'function') {
            STRCombatWindow.hide();
          }
          if (typeof HandFanComponent !== 'undefined' && typeof HandFanComponent.hide === 'function') {
            HandFanComponent.hide();
            if (typeof HandFanComponent.clearSelection === 'function') HandFanComponent.clearSelection();
          }
        } catch (e0) {}

        STRExitSequence.play(reason, _exitCtx, function() {
          _active = false;
          _phase = 'idle';
          _enemy = null;
          _advantage = 'neutral';
          _round = 0;
          _log = [];

          ctx.disableCombatZoom();

          try {
            if (typeof BackupActionContainer !== 'undefined' && typeof BackupActionContainer.hide === 'function') {
              BackupActionContainer.hide();
            }
          } catch (e1) {}

          ctx.startGameLoop();
          ctx.saveState();
        });

        return {
          lines: lines.concat(ctx.renderGrid()),
          prompt: ctx.getPrompt(),
          stayActive: true
        };
      }
    }

    lines.push('');
    lines.push('Movement unlocked. Returning to realtime grid...');
    lines.push('');

    // Reset combat state (fallback path)
    _active = false;
    _phase = 'idle';
    _enemy = null;
    _advantage = 'neutral';
    _round = 0;
    _log = [];

    ctx.disableCombatZoom();

    try {
      if (typeof STRCombatWindow !== 'undefined' && typeof STRCombatWindow.hide === 'function') {
        STRCombatWindow.hide();
      }
      if (typeof HandFanComponent !== 'undefined' && typeof HandFanComponent.hide === 'function') {
        HandFanComponent.hide();
        if (typeof HandFanComponent.clearSelection === 'function') {
          HandFanComponent.clearSelection();
        }
      }
      if (typeof BackupActionContainer !== 'undefined' && typeof BackupActionContainer.hide === 'function') {
        BackupActionContainer.hide();
      }
    } catch (e0) {}

    ctx.startGameLoop();
    ctx.saveState();

    return {
      lines: lines.concat(ctx.renderGrid()),
      prompt: ctx.getPrompt(),
      stayActive: true
    };
  }

  // ── Combat UI ─────────────────────────────────────────────

  function showCombatUI(ctx) {
    // Preserve 'resolving' phase so the integration layer's 100ms poll
    // can detect it and fire _playResolutionSequence(). The poll's done
    // callback resets phase to 'selecting' after the animation completes.
    if (_phase !== 'countdown' && _phase !== 'resolving') {
      _phase = 'selecting';
    }
    ctx.combatPhaseTooltip('cardplay');
    var lines = [];
    lines.push('═══════════════════════════════════════');
    lines.push('⚔️  STR COMBAT - ROUND ' + _round);
    lines.push('═══════════════════════════════════════');
    lines.push('');

    _log.forEach(function(logLine) {
      lines.push(logLine);
    });

    lines.push('───────────────────────────────────────');

    var intentDisplay = '';
    if (typeof EnemyIntentSystem !== 'undefined' && _enemy.intentState) {
      intentDisplay = '  ' + EnemyIntentSystem.formatIntentDisplay(_enemy.intentState);
    }

    lines.push('PLAYER HP: ' + ctx.player.hp + '/' + ctx.player.maxHp + ' ❤️   |   ENEMY HP: ' + _enemy.hp + '/5 💀' + intentDisplay);
    lines.push('Advantage: ' + _advantage.toUpperCase() + ' ' + getAdvantageEmoji(_advantage));
    lines.push('───────────────────────────────────────');
    lines.push('');
    lines.push('🃏 Use attack card (swipe/click) to strike');
    lines.push('🛡️  Use stance card to defend (+stealth)');
    lines.push('🏃 Type FLEE to attempt escape');
    lines.push('');

    lines = lines.concat(ctx.renderGrid());

    triggerCombatFlash();

    return {
      lines: lines,
      prompt: ctx.getPrompt(),
      stayActive: true
    };
  }

  function showCombatUIWithLog(logLines, ctx) {
    _phase = 'post_resolve';
    setTimeout(function() { if (_active) _phase = 'selecting'; }, 600);
    ctx.combatPhaseTooltip('resolution');
    var lines = logLines || [];

    lines.push('╔═══════════════════════════╗');
    lines.push('║  PLAYER: ' + ctx.player.hp + '/' + (ctx.player.maxHp || 10) + ' HP         ║');
    lines.push('║  ENEMY:  ' + _enemy.hp + '/' + (_enemy.maxHp || 5) + ' HP         ║');
    lines.push('╚═══════════════════════════╝');
    lines.push('');
    lines.push('🃏 Use attack card (swipe/click) to strike');
    lines.push('🛡️  Use defense card to defend');
    lines.push('🏃 Type FLEE to attempt escape');
    lines.push('');

    // Clear temp effects for next round
    ctx.player.tempDefense = 0;
    ctx.player.tempEvasion = 0;
    _enemy.tempDefense = 0;
    _enemy.tempEvasion = 0;

    lines = lines.concat(ctx.renderGrid());

    triggerCombatFlash();

    return {
      lines: lines,
      prompt: ctx.getPrompt(),
      stayActive: true
    };
  }

  function triggerCombatFlash() {
    if (typeof document === 'undefined') return;

    var header = document.querySelector('.monitor-header') || document.querySelector('#mok-header');
    if (header) {
      header.classList.add('attackFlash');
      setTimeout(function() {
        header.classList.remove('attackFlash');
      }, 500);
    }
  }

  // ── State Access ──────────────────────────────────────────

  function isActive() {
    return _active;
  }

  function getState(ctx) {
    return {
      active: _active,
      enemy: _enemy,
      player: ctx.player ? { hp: ctx.player.hp, maxHp: ctx.player.maxHp } : { hp: 10, maxHp: 10 },
      advantage: _advantage,
      round: _round,
      floor: ctx.floor,
      log: _log,
      countdownMessages: _context,
      phase: _phase,
      isResolvingTurn: _phase === 'resolving'
    };
  }

  function setPhase(phase) {
    _phase = phase;
  }

  function getEnemy() {
    return _enemy;
  }

  function getAmmoSpent() {
    return _ammoSpent;
  }

  function getEntryPos() {
    return _entryPos;
  }

  function getPhase() {
    return _phase;
  }

  function getRound() {
    return _round;
  }

  function getLog() {
    return _log;
  }

  function getAdvantage() {
    return _advantage;
  }

  function getContext() {
    return _context;
  }

  /**
   * Force-reset combat state (called by monolith death handlers)
   */
  function forceReset() {
    _active = false;
    _phase = 'idle';
    _enemy = null;
    _advantage = 'neutral';
    _round = 0;
    _log = [];
    _ammoSpent = 0;
    _entryPos = null;
    _context = null;
  }

  // ── Public API ────────────────────────────────────────────

  return {
    // Combat lifecycle
    enterCombat: enterCombat,
    exitCombat: exitCombat,

    // Round execution
    executeSimultaneousRound: executeSimultaneousRound,
    executeMultiCardRound: executeMultiCardRound,
    executeRound: executeRound,
    playerAttack: playerAttack,
    enemyAttack: enemyAttack,

    // Pure calculations
    calculateAdvantage: calculateAdvantage,
    calculateHit: calculateHit,
    calculateDamage: calculateDamage,
    checkFlanking: checkFlanking,
    distanceBetween: distanceBetween,
    getDistanceBracket: getDistanceBracket,
    getAdvantageEmoji: getAdvantageEmoji,

    // Action resolution
    resolveAction: resolveAction,
    handleBossCardInteraction: handleBossCardInteraction,

    // Enemy AI
    getEnemyAICard: getEnemyAICard,

    // Combat UI
    showCombatUI: showCombatUI,
    showCombatUIWithLog: showCombatUIWithLog,
    triggerCombatFlash: triggerCombatFlash,

    // State access
    isActive: isActive,
    getState: getState,
    setPhase: setPhase,
    getEnemy: getEnemy,
    getAmmoSpent: getAmmoSpent,
    getEntryPos: getEntryPos,
    getPhase: getPhase,
    getRound: getRound,
    getLog: getLog,
    getAdvantage: getAdvantage,
    getContext: getContext,
    forceReset: forceReset
  };
})();
