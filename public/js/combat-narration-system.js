/**
 * CombatNarrationSystem — builds pre-combat countdown beat messages.
 * Extracted Phase 14 from gone-rogue.js.
 * Stateless IIFE module — all state via ctx references.
 */
var CombatNarrationSystem = (function() {
  'use strict';

  /**
   * Build 3-beat countdown messages for STR combat entry.
   * @param {Object} enemy - The enemy being engaged
   * @param {string} trigger - Combat trigger type
   * @param {Object} ctx - Context from monolith
   * @returns {{ beat3: string, beat2: string, beat1: string }}
   */
  function buildCountdownMessages(enemy, trigger, ctx) {
    var beat3 = _buildBeat3_Environment(ctx);
    var beat2 = _buildBeat2_Advantage(enemy, trigger, ctx);
    var beat1 = _buildBeat1_Resources();
    return { beat3: beat3, beat2: beat2, beat1: beat1 };
  }

  /**
   * BEAT 3: Stealth / Environment
   */
  function _buildBeat3_Environment(ctx) {
    var tile = (ctx.grid[ctx.player.y] && ctx.grid[ctx.player.y][ctx.player.x]) || '';
    var groundEffect = (typeof GroundEffects !== 'undefined')
      ? GroundEffects.getGroundEffect(ctx.player.x, ctx.player.y)
      : null;
    var stealthBonus = ctx.getPlayerStealthBonus();

    if (groundEffect) {
      var gt = groundEffect.type;
      if (gt === 'fire' || gt === 'oil_ignited') {
        return '\uD83D\uDD25 you were standing in fire'; // 🔥
      } else if (gt === 'industrial_waste') {
        return '\u2622\uFE0F  you were standing in toxic waste'; // ☢️
      } else if (gt === 'water') {
        if (groundEffect.electrified) {
          return '\u26A1 you were standing in electrified water'; // ⚡
        } else {
          return '\uD83D\uDCA7 you were splashing in water'; // 💧
        }
      } else if (gt === 'glass') {
        return '\uD83E\uDE9F you were crunching on broken glass'; // 🪟
      } else if (gt === 'soda_spill') {
        return '\uD83E\uDDC3 you were slipping in a soda spill'; // 🧃
      } else if (gt === 'steam') {
        return '\u2668\uFE0F  you were hidden in steam'; // ♨️
      } else if (gt === 'oil') {
        return '💧 you were standing in an oil slick';
      }
    }

    if (tile === ctx.TILES.SHADOW) {
      return '\u2B1B you were cloaked in shadow'; // ⬛
    } else if (tile === ctx.TILES.SMOKE) {
      return '\uD83C\uDF2B\uFE0F  you were hidden in smoke'; // 🌫️
    } else if (tile === ctx.TILES.GRASS) {
      return '\uD83D\uDFE9 you were crouched in the grass'; // 🟩
    } else if (tile === ctx.TILES.WATER) {
      return '\uD83D\uDCA7 you were splashing in water'; // 💧
    } else if (stealthBonus >= 30) {
      return '\uD83C\uDF11 darkness gave you cover (+' + stealthBonus + '% stealth)'; // 🌑
    } else if (stealthBonus > 0) {
      return '\uD83D\uDC41 partial cover (+' + stealthBonus + '% stealth)'; // 👁
    } else {
      return '\uD83D\uDC41 no cover \u2014 fully exposed'; // 👁 —
    }
  }

  /**
   * BEAT 2: Flank / Advantage
   */
  function _buildBeat2_Advantage(enemy, trigger, ctx) {
    var advantage = ctx.strCombatAdvantage;
    var enemyAwareness = enemy ? (enemy.awareness || 0) : 0;
    var isFlanking = ctx.checkFlanking(ctx.player, enemy);
    var enemyInitiated = trigger === 'enemy_attack' || trigger === 'enemy_sighting' || trigger === 'enemy_projectile';

    if (advantage === 'ambush') {
      if (isFlanking) {
        return '\uD83C\uDFAF you struck from behind \u2014 they never saw it coming'; // 🎯
      } else {
        return '\uD83C\uDFAF you caught them completely unaware'; // 🎯
      }
    } else if (advantage === 'flanked') {
      return '\u274C you were hit from behind \u2014 enemy flanked you'; // ❌
    } else if (advantage === 'disadvantaged') {
      if (enemyAwareness >= 70) {
        return '\u26A0\uFE0F  the enemy was fully alerted to your position'; // ⚠️
      } else {
        return '\u26A0\uFE0F  you were caught in the open'; // ⚠️
      }
    } else {
      // neutral
      if (enemyInitiated) {
        return '\u2694\uFE0F  they spotted you \u2014 head-on engagement'; // ⚔️
      } else {
        return '\u2694\uFE0F  you faced them head-on'; // ⚔️
      }
    }
  }

  /**
   * BEAT 1: Critical Resource Warnings
   */
  function _buildBeat1_Resources() {
    var warnings = [];

    if (typeof GAMESTATE !== 'undefined') {
      var ammo    = GAMESTATE.getAmmo    ? GAMESTATE.getAmmo()    : 0;
      var energy  = GAMESTATE.getEnergy  ? GAMESTATE.getEnergy()  : 0;
      var fatigue = GAMESTATE.getFatigue ? GAMESTATE.getFatigue() : 0;
      var state   = GAMESTATE.getState   ? GAMESTATE.getState()   : {};
      var maxFatigue = state.maxFatigue  || 100;
      var focus   = GAMESTATE.getFocus   ? GAMESTATE.getFocus()   : 0;

      if (ammo <= 0)                               warnings.push('\u204D no ammo'); // ⁍
      if (energy <= 0)                             warnings.push('\u26A1 no energy'); // ⚡
      if (focus <= 0)                              warnings.push('\uD83C\uDFAF no focus'); // 🎯
      if (fatigue >= maxFatigue * 0.8)             warnings.push('\uD83C\uDFCB\uFE0F  extreme fatigue'); // 🏋️
    }

    if (warnings.length === 0) {
      return '\u2705 all systems combat-ready'; // ✅
    } else if (warnings.length === 1) {
      return warnings[0] + ' \u2014 limited options'; // —
    } else {
      return warnings.join('  \u00B7  '); // ·
    }
  }

  return {
    buildCountdownMessages: buildCountdownMessages
  };
})();
