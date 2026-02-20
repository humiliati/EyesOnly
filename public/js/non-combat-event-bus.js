/* ============================================================
   Non-Combat Event Bus (lightweight)
   ============================================================ */

var NonCombatEventBus = (function() {
  'use strict';

  var _handlers = {}; // type -> [fn]
  var _history = [];
  var _maxHistory = 120;

  function on(type, handler) {
    if (!type || typeof handler !== 'function') return;
    if (!_handlers[type]) _handlers[type] = [];
    _handlers[type].push(handler);
  }

  function emit(type, payload) {
    var evt = {
      type: type,
      payload: payload,
      ts: Date.now()
    };

    _history.push(evt);
    if (_history.length > _maxHistory) _history.shift();

    var list = _handlers[type] || [];
    for (var i = 0; i < list.length; i++) {
      try { list[i](evt); } catch (e) {}
    }

    // Wildcard listeners
    var any = _handlers['*'] || [];
    for (var j = 0; j < any.length; j++) {
      try { any[j](evt); } catch (e2) {}
    }
  }

  function getHistory(filter) {
    if (!filter) return _history.slice();
    return _history.filter(function(e) { return (e.type || '').indexOf(filter) !== -1; });
  }

  function clearHistory() {
    _history = [];
  }

  return {
    on: on,
    emit: emit,
    getHistory: getHistory,
    clearHistory: clearHistory
  };
})();
