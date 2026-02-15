/* ============================================================
   EYES ONLY - API Client Bridge
   Thin fetch wrapper connecting the terminal to the backend.
   IIFE pattern matching existing codebase style.
   Graceful fallback: if API unreachable, terminal is unaffected.
   ============================================================ */

const ApiClient = (function () {
  'use strict';

  var STORAGE_KEY = 'eyesonly_api_session';
  var API_BASE = '/api';

  var _session = null; // { token, actor: { id, callsign, team, scenario_id } }

  /**
   * Initialize: load persisted session from localStorage.
   */
  function init() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) _session = JSON.parse(saved);
    } catch (e) { /* ignore */ }
  }

  /**
   * Check if we have an active API session.
   */
  function isConnected() {
    return !!(_session && _session.token);
  }

  /**
   * Get current session info.
   */
  function getSession() {
    return _session ? Object.assign({}, _session) : null;
  }

  /**
   * Join a scenario via join code (Red Team flow).
   * Returns a Promise resolving to { token, actor } or null on failure.
   */
  function join(code, callsign) {
    return _post('/join', { code: code, callsign: callsign })
      .then(function (data) {
        if (data && data.token) {
          _session = { token: data.token, actor: data.actor };
          _save();
          return data;
        }
        return null;
      })
      .catch(function () { return null; });
  }

  /**
   * Login with callsign + password (Blue Team / Director flow).
   */
  function login(callsign, password, scenarioId) {
    return _post('/auth/login', {
      callsign: callsign,
      password: password,
      scenario_id: scenarioId
    })
      .then(function (data) {
        if (data && data.token) {
          _session = { token: data.token, actor: data.actor };
          _save();
          return data;
        }
        return null;
      })
      .catch(function () { return null; });
  }

  /**
   * Field check-in with optional GPS coordinates.
   */
  function checkin(message, lat, lng) {
    if (!isConnected()) return Promise.resolve(null);
    return _post('/ops/checkin', {
      message: message || '',
      lat: lat,
      lng: lng
    }).catch(function () { return null; });
  }

  /**
   * Get current scenario state.
   */
  function getScenario() {
    if (!isConnected()) return Promise.resolve(null);
    return _get('/ops/scenario').catch(function () { return null; });
  }

  /**
   * Get recent events.
   */
  function getEvents(limit, afterId) {
    if (!isConnected()) return Promise.resolve(null);
    var params = '?limit=' + (limit || 50);
    if (afterId) params += '&after_id=' + afterId;
    return _get('/ops/events' + params).catch(function () { return null; });
  }

  /**
   * Report a dead drop action.
   */
  function reportDeadDrop(laneId, action, label, lat, lng) {
    if (!isConnected()) return Promise.resolve(null);
    return _post('/ops/dead-drop', {
      lane_id: laneId,
      action: action,
      label: label || 'Dead Drop',
      lat: lat,
      lng: lng
    }).catch(function () { return null; });
  }

  /**
   * Disconnect / clear session.
   */
  function disconnect() {
    _session = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }

  /**
   * Check API health.
   */
  function ping() {
    return _get('/health')
      .then(function (data) { return !!(data && data.status === 'operational'); })
      .catch(function () { return false; });
  }

  // --- Internal Helpers ---

  function _get(path) {
    var headers = { 'Content-Type': 'application/json' };
    if (_session && _session.token) {
      headers['Authorization'] = 'Bearer ' + _session.token;
    }
    return fetch(API_BASE + path, { method: 'GET', headers: headers })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
  }

  function _post(path, body) {
    var headers = { 'Content-Type': 'application/json' };
    if (_session && _session.token) {
      headers['Authorization'] = 'Bearer ' + _session.token;
    }
    return fetch(API_BASE + path, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
  }

  function _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_session));
    } catch (e) { /* ignore */ }
  }

  // Public API
  return {
    init: init,
    isConnected: isConnected,
    getSession: getSession,
    join: join,
    login: login,
    checkin: checkin,
    getScenario: getScenario,
    getEvents: getEvents,
    reportDeadDrop: reportDeadDrop,
    disconnect: disconnect,
    ping: ping
  };
})();
