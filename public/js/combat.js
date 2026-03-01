var Combat = (function() {
  'use strict';

  var _strCombatActive = false;
  var _strCombatEnemy = null;
  var _strCombatAdvantage = 'neutral';
  var _strCombatRound = 0;
  var _strCombatLog = [];
  var _strCombatAmmoSpent = 0;
  var _strCombatContext = null;
  var _strCombatEntryPos = null;
  var _strCombatPhase = 'idle';

  function isStrCombatActive() {
    return _strCombatActive;
  }

  function getStrCombatState() {
    return {
      active: _strCombatActive,
      enemy: _strCombatEnemy,
      advantage: _strCombatAdvantage,
      round: _strCombatRound,
      log: _strCombatLog,
      ammoSpent: _strCombatAmmoSpent,
      context: _strCombatContext,
      phase: _strCombatPhase
    };
  }

  function setStrCombatPhase(phase) {
    _strCombatPhase = phase;
  }

  function _executeStrRound(firstPlayer) {
    if (!_strCombatActive) return;

    var player = Player.getPlayer();
    var enemy = _strCombatEnemy;
    var log = [];

    // ... (rest of the combat logic)

    _strCombatLog = _strCombatLog.concat(log);

    // ... (rest of the combat logic)
  }

  return {
    isStrCombatActive: isStrCombatActive,
    getStrCombatState: getStrCombatState,
    setStrCombatPhase: setStrCombatPhase,
    executeStrRound: _executeStrRound
  };
})();