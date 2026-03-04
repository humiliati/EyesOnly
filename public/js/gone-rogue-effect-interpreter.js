/* ============================================================
   Gone Rogue Effect Interpreter (minimal subset)
   Data-first translation layer for item/card effects.
   Keeps logic centralized (no inline per-card functions).
   ============================================================ */

var GoneRogueEffectInterpreter = (function() {
  'use strict';

  var _effects = {
    avatarChar: null,
    avatarSprite: null,
    evasionModifiers: [],
    breakOnCombat: null,
    stealthEntry: 0,
    enemyConfuse: null,
    evasionBonus: 0
  };

  function clearAll() {
    _effects = {
      avatarChar: null,
      avatarSprite: null,
      evasionModifiers: [],
      breakOnCombat: null,
      stealthEntry: 0,
      enemyConfuse: null,
      evasionBonus: 0
    };

    if (typeof PassiveItemsSystem !== 'undefined' && PassiveItemsSystem.clearPlayerAvatarOverride) {
      PassiveItemsSystem.clearPlayerAvatarOverride();
    }
  }

  function applyEffects(effectList, context) {
    context = context || {};
    var results = [];
    if (!Array.isArray(effectList)) return results;

    for (var i = 0; i < effectList.length; i++) {
      var eff = effectList[i];
      var r = executeEffect(eff, context);
      if (r) results.push(r);
    }
    return results;
  }

  function executeEffect(effect, context) {
    if (!effect || !effect.type) return null;

    switch (effect.type) {
      case 'avatar_transform':
        return _handleAvatarTransform(effect, context);
      case 'sightline_evasion_modifier':
        return _handleEvasionModifier(effect, context);
      case 'break_on_combat':
        return _handleBreakOnCombat(effect, context);
      case 'stealth_entry':
        return _handleStealthEntry(effect, context);
      case 'enemy_confuse':
        return _handleEnemyConfuse(effect, context);
      case 'evasion':
        return _handleEvasion(effect, context);
      case 'quest_turn_in':
        return _handleQuestTurnIn(effect, context);
      default:
        try { console.warn('[EffectInterpreter] Unknown effect type:', effect.type); } catch (e) {}
        return null;
    }
  }

  function _handleAvatarTransform(effect, context) {
    var equipping = (context.equipping !== false);

    if (equipping) {
      var ch = effect.char || '📦';
      _effects.avatarChar = ch;
      _effects.avatarSprite = effect.sprite || null;

      if (typeof PassiveItemsSystem !== 'undefined' && PassiveItemsSystem.setPlayerAvatarOverride) {
        PassiveItemsSystem.setPlayerAvatarOverride(ch);
      }

      return { type: 'avatar_transform', char: ch, sprite: _effects.avatarSprite };
    }

    // Unequipping
    _effects.avatarChar = null;
    _effects.avatarSprite = null;

    if (typeof PassiveItemsSystem !== 'undefined' && PassiveItemsSystem.clearPlayerAvatarOverride) {
      PassiveItemsSystem.clearPlayerAvatarOverride();
    }

    return { type: 'avatar_transform', cleared: true };
  }

  function _handleEvasionModifier(effect) {
    var mod = {
      walkBonus: Number(effect.walk_bonus || 0),
      sprintPenalty: Number(effect.sprint_penalty || 0),
      source: 'sightline_evasion'
    };

    _effects.evasionModifiers.push(mod);
    return Object.assign({ type: 'sightline_evasion_modifier' }, mod);
  }

  function _handleBreakOnCombat(effect) {
    if (effect.condition === 'first_encounter') {
      _effects.breakOnCombat = { condition: 'first_encounter' };
      return { type: 'break_on_combat', condition: 'first_encounter' };
    }
    return null;
  }

  function _handleStealthEntry(effect) {
    var b = Number(effect.bonus || 0);
    _effects.stealthEntry = b;
    return { type: 'stealth_entry', bonus: b };
  }

  function _handleEnemyConfuse(effect) {
    var d = Number(effect.duration || 2);
    _effects.enemyConfuse = { duration: d };
    return { type: 'enemy_confuse', duration: d };
  }

  function _handleQuestTurnIn(effect, context) {
    // No-op on equip — quest_turn_in is a marker effect.
    // Actual turn-in happens via NPC interaction (LockedGateSystem.handleInteraction).
    // We just acknowledge the effect so it doesn't produce an "Unknown effect" warning.
    return { type: 'quest_turn_in', npcTarget: effect.npcTarget || null, rewardType: effect.rewardType || null };
  }

  function _handleEvasion(effect) {
    // Support both {value} and {bonus}
    var b = (typeof effect.bonus !== 'undefined') ? Number(effect.bonus || 0) : Number(effect.value || 0);
    _effects.evasionBonus = b;
    return { type: 'evasion', bonus: b };
  }

  function getEvasionModifier(isWalking) {
    if (!_effects.evasionModifiers || !_effects.evasionModifiers.length) return 0;
    var mod = _effects.evasionModifiers[0];
    return isWalking ? (mod.walkBonus || 0) : (mod.sprintPenalty || 0);
  }

  function shouldBreakOnCombat() {
    return !!_effects.breakOnCombat;
  }

  function clearBreakOnCombat() {
    _effects.breakOnCombat = null;
  }

  function getState() {
    return JSON.parse(JSON.stringify(_effects));
  }

  return {
    clearAll: clearAll,
    applyEffects: applyEffects,
    executeEffect: executeEffect,
    getEvasionModifier: getEvasionModifier,
    shouldBreakOnCombat: shouldBreakOnCombat,
    clearBreakOnCombat: clearBreakOnCombat,
    getState: getState
  };
})();
