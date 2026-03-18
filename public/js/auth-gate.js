/**
 * auth-gate.js — Unified Auth Gate for Eyes Only
 *
 * Checks all known localStorage token locations. If a valid Bearer token
 * is found from ANY previous login (terminal, ops, m-mode), the user
 * passes through without re-authenticating. If no token is found, a login
 * form is shown inline.
 *
 * Usage:
 *   <script src="js/auth-gate.js"></script>
 *   <script>
 *     AuthGate.init({
 *       target: document.getElementById('app'),          // where to inject login form
 *       onAuth: function(session) { startApp(session); } // called with { token, callsign, role }
 *     });
 *   </script>
 *
 * The gate checks these localStorage keys in priority order:
 *   1. eyesonly_mmode_session  (director — has .token, .callsign)
 *   2. eyesonly_ops_session    (ops — has .token, .actor)
 *   3. eyesonly_api_session    (red/blue team join — has .token, .actor)
 *
 * After finding a candidate token, it validates via GET /api/auth/check.
 * If valid, onAuth fires immediately. If invalid (expired), the stored
 * session is cleared and the login form is shown.
 *
 * The login form calls POST /api/auth/login (callsign + password + scenario).
 * On success, the token is stored in ALL relevant keys so that navigating
 * to ops, m-mode, or back to the terminal doesn't require re-auth.
 */
(function () {
  'use strict';

  // ---- Token source keys, checked in priority order ----
  var TOKEN_SOURCES = [
    {
      key: 'eyesonly_mmode_session',
      extract: function (data) {
        if (data && data.token) return { token: data.token, callsign: data.callsign || 'DIRECTOR', role: 'director' };
        return null;
      }
    },
    {
      key: 'eyesonly_ops_session',
      extract: function (data) {
        if (data && data.token) return { token: data.token, callsign: (data.actor && data.actor.callsign) || data.callsign || 'OPS', role: 'operative' };
        return null;
      }
    },
    {
      key: 'eyesonly_api_session',
      extract: function (data) {
        if (data && data.token) return { token: data.token, callsign: (data.actor && data.actor.callsign) || 'AGENT', role: 'operative' };
        return null;
      }
    }
  ];

  function readStoredToken() {
    for (var i = 0; i < TOKEN_SOURCES.length; i++) {
      try {
        var raw = localStorage.getItem(TOKEN_SOURCES[i].key);
        if (!raw) continue;
        var data = JSON.parse(raw);
        var session = TOKEN_SOURCES[i].extract(data);
        if (session && session.token) {
          session._sourceKey = TOKEN_SOURCES[i].key;
          return session;
        }
      } catch (_) {}
    }
    return null;
  }

  function validateToken(token, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/auth/check', true);
    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);
          if (data.valid) {
            callback(true, data.actor || {});
            return;
          }
        } catch (_) {}
      }
      callback(false);
    };
    xhr.send();
  }

  function storeSession(token, callsign, scenarioId, role) {
    var apiSession = { token: token, actor: { callsign: callsign, scenario_id: scenarioId } };
    var mmodeSession = { token: token, callsign: callsign, scenarioId: scenarioId };

    try {
      // Write to all keys so cross-page nav works
      localStorage.setItem('eyesonly_api_session', JSON.stringify(apiSession));
      if (role === 'director') {
        localStorage.setItem('eyesonly_mmode_session', JSON.stringify(mmodeSession));
      }
      localStorage.setItem('eyesonly_ops_session', JSON.stringify(apiSession));
    } catch (_) {}
  }

  function clearSession(sourceKey) {
    try {
      if (sourceKey) localStorage.removeItem(sourceKey);
    } catch (_) {}
  }

  // ---- Login Form Renderer ----

  function renderLoginForm(target, onSuccess, errorMsg) {
    target.innerHTML =
      '<div style="max-width:360px;margin:60px auto;padding:24px;background:#111;border:1px solid #222;border-radius:6px;font-family:\'Courier New\',monospace;">' +
        '<h1 style="font-size:16px;letter-spacing:0.2em;color:#1cff9b;text-align:center;margin-bottom:4px;">EYES ONLY</h1>' +
        '<div style="font-size:10px;color:#666;text-align:center;letter-spacing:0.15em;margin-bottom:20px;">PUZZLE DESIGNER — CLASSIFIED ACCESS</div>' +
        (errorMsg ? '<div style="color:#ff4444;font-size:11px;text-align:center;margin-bottom:12px;">' + errorMsg + '</div>' : '') +
        '<label style="display:block;font-size:10px;color:#1a6b4a;letter-spacing:0.1em;margin-bottom:3px;">CALLSIGN</label>' +
        '<input type="text" id="ag-callsign" style="width:100%;background:#0a0a0a;border:1px solid #222;color:#ddd;font-family:inherit;font-size:12px;padding:8px;border-radius:3px;margin-bottom:10px;" placeholder="Enter callsign" autocomplete="username" autocapitalize="characters" spellcheck="false">' +
        '<label style="display:block;font-size:10px;color:#1a6b4a;letter-spacing:0.1em;margin-bottom:3px;">PASSWORD</label>' +
        '<input type="password" id="ag-password" style="width:100%;background:#0a0a0a;border:1px solid #222;color:#ddd;font-family:inherit;font-size:12px;padding:8px;border-radius:3px;margin-bottom:10px;" placeholder="Enter password" autocomplete="current-password">' +
        '<label style="display:block;font-size:10px;color:#1a6b4a;letter-spacing:0.1em;margin-bottom:3px;">SCENARIO ID</label>' +
        '<input type="text" id="ag-scenario" value="1" style="width:100%;background:#0a0a0a;border:1px solid #222;color:#ddd;font-family:inherit;font-size:12px;padding:8px;border-radius:3px;margin-bottom:16px;" inputmode="numeric" pattern="[0-9]*" autocomplete="off">' +
        '<button type="button" id="ag-submit" style="width:100%;padding:10px;background:#0a2a1a;border:1px solid #1a6b4a;color:#1cff9b;font-family:inherit;font-size:12px;letter-spacing:0.15em;cursor:pointer;border-radius:3px;">AUTHENTICATE</button>' +
        '<div style="font-size:9px;color:#444;text-align:center;margin-top:12px;">Log in via the terminal, /ops, or /m first to skip this step.</div>' +
      '</div>';

    var callsignInput = target.querySelector('#ag-callsign');
    var passwordInput = target.querySelector('#ag-password');
    var scenarioInput = target.querySelector('#ag-scenario');
    var submitBtn = target.querySelector('#ag-submit');

    function doLogin() {
      var callsign = callsignInput.value.trim();
      var password = passwordInput.value;
      var scenarioId = parseInt(scenarioInput.value, 10) || 1;

      if (!callsign || !password) {
        renderLoginForm(target, onSuccess, 'Callsign and password required');
        return;
      }

      submitBtn.textContent = 'AUTHENTICATING...';
      submitBtn.disabled = true;

      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/auth/login', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        if (xhr.status === 200) {
          try {
            var data = JSON.parse(xhr.responseText);
            if (data.token) {
              var role = (data.actor && data.actor.team === 'director') ? 'director' : 'operative';
              storeSession(data.token, callsign, scenarioId, role);
              onSuccess({
                token: data.token,
                callsign: callsign,
                role: role,
                actor: data.actor
              });
              return;
            }
          } catch (_) {}
        }

        var errMsg = 'Authentication failed';
        try {
          var errData = JSON.parse(xhr.responseText);
          errMsg = errData.error || errData.message || errMsg;
        } catch (_) {}
        renderLoginForm(target, onSuccess, errMsg);
      };
      xhr.send(JSON.stringify({ callsign: callsign, password: password, scenario_id: scenarioId }));
    }

    submitBtn.addEventListener('click', doLogin);
    passwordInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doLogin();
    });

    setTimeout(function () { callsignInput.focus(); }, 50);
  }

  // ---- Public API ----

  window.AuthGate = {
    /**
     * Initialize the auth gate.
     * @param {Object} opts
     * @param {HTMLElement} opts.target - DOM element for login form injection
     * @param {Function} opts.onAuth - callback(session) when authenticated
     * @param {Function} [opts.onChecking] - callback() while validating token
     */
    init: function (opts) {
      if (!opts || !opts.target || !opts.onAuth) {
        console.error('[AuthGate] target and onAuth are required');
        return;
      }

      // 1. Check for existing token
      var stored = readStoredToken();

      if (stored) {
        // Show checking state
        if (opts.onChecking) opts.onChecking();
        opts.target.innerHTML =
          '<div style="text-align:center;padding:60px;color:#666;font-family:\'Courier New\',monospace;font-size:12px;">' +
            'VALIDATING SESSION...' +
          '</div>';

        // 2. Validate against server
        validateToken(stored.token, function (valid, actor) {
          if (valid) {
            // Pass through — no login needed
            stored.actor = actor;
            opts.onAuth(stored);
          } else {
            // Token expired — clear and show login
            clearSession(stored._sourceKey);
            renderLoginForm(opts.target, opts.onAuth);
          }
        });
      } else {
        // 3. No token found — show login form immediately
        renderLoginForm(opts.target, opts.onAuth);
      }
    },

    /**
     * Get the current Bearer token (for API calls).
     * Checks all known storage locations.
     * @returns {string|null}
     */
    getToken: function () {
      var stored = readStoredToken();
      return stored ? stored.token : null;
    },

    /**
     * Build headers object for an authenticated fetch/XHR call.
     * @returns {Object} headers with Content-Type and Authorization
     */
    headers: function () {
      var token = this.getToken();
      var h = { 'Content-Type': 'application/json' };
      if (token) h['Authorization'] = 'Bearer ' + token;
      return h;
    },

    /**
     * Logout — clear all stored sessions and reload.
     */
    logout: function () {
      TOKEN_SOURCES.forEach(function (source) {
        try { localStorage.removeItem(source.key); } catch (_) {}
      });
      window.location.reload();
    }
  };

})();
