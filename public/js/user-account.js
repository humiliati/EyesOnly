/* ============================================================
   EYES ONLY - User Account Client
   Handles user registration, login, and session management.
   ============================================================ */

(function (window) {
  'use strict';

  var UserAccount = {};

  // API endpoint base
  var API_BASE = '/api/user';

  // Session storage key
  var SESSION_KEY = 'eyesonly_user_session';

  // Current session data
  var _session = null;

  /**
   * Initialize the user account system.
   * Restore session from localStorage if available.
   */
  UserAccount.init = function () {
    _loadSession();
  };

  /**
   * Check if user is currently logged in.
   */
  UserAccount.isLoggedIn = function () {
    return _session !== null;
  };

  /**
   * Get current user info.
   */
  UserAccount.getCurrentUser = function () {
    return _session ? _session.user : null;
  };

  /**
   * Get current session token.
   */
  UserAccount.getSessionToken = function () {
    return _session ? _session.token : null;
  };

  /**
   * Register a new user account.
   * @param {string} username - Username (3-20 characters)
   * @param {string} callsign - Optional callsign (defaults to username)
   * @param {string} email - Optional email for recovery
   * @returns {Promise<Object>} User data and session token
   */
  UserAccount.register = function (username, callsign, email) {
    if (!username) {
      return Promise.reject(new Error('Username is required'));
    }

    var payload = { username: username };
    if (callsign) payload.callsign = callsign;
    if (email) payload.email = email;

    return fetch(API_BASE + '/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (response) {
        return _readJsonOrText(response).then(function (body) {
          if (!response.ok) {
            // body may be {message} JSON or plain text (HTML error page, worker exception, etc.)
            var msg = (body && body.message) ? body.message : (typeof body === 'string' ? body : null);
            throw new Error(msg || 'Registration failed');
          }
          return body;
        });
      })
      .then(function (data) {
        _session = {
          token: data.session_token,
          user: data.user,
        };
        _saveSession();
        return data;
      });
  };

  /**
   * Login with existing username.
   * @param {string} username - Username
   * @returns {Promise<Object>} User data and session token
   */
  UserAccount.login = function (username) {
    if (!username) {
      return Promise.reject(new Error('Username is required'));
    }

    return fetch(API_BASE + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username }),
    })
      .then(function (response) {
        return _readJsonOrText(response).then(function (body) {
          if (!response.ok) {
            var msg = (body && body.message) ? body.message : (typeof body === 'string' ? body : null);
            throw new Error(msg || 'Login failed');
          }
          return body;
        });
      })
      .then(function (data) {
        _session = {
          token: data.session_token,
          user: data.user,
        };
        _saveSession();
        return data;
      });
  };

  /**
   * Logout and clear session.
   * @returns {Promise<void>}
   */
  UserAccount.logout = function () {
    var token = UserAccount.getSessionToken();

    return fetch(API_BASE + '/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': token || '',
      },
    })
      .then(function () {
        _session = null;
        _clearSession();
      })
      .catch(function () {
        // Even if request fails, clear local session
        _session = null;
        _clearSession();
      });
  };

  /**
   * Fetch current user info from server.
   * Validates session token.
   * @returns {Promise<Object>} User data
   */
  UserAccount.fetchMe = function () {
    var token = UserAccount.getSessionToken();
    if (!token) {
      return Promise.reject(new Error('Not logged in'));
    }

    return fetch(API_BASE + '/me', {
      method: 'GET',
      headers: {
        'X-Session-Token': token,
      },
    })
      .then(function (response) {
        return _readJsonOrText(response).then(function (body) {
          if (!response.ok) {
            // Session expired or invalid
            _session = null;
            _clearSession();
            var msg = (body && body.message) ? body.message : (typeof body === 'string' ? body : null);
            throw new Error(msg || 'Session invalid');
          }
          return body;
        });
      })
      .then(function (data) {
        // Update cached user data
        if (_session) {
          _session.user = data.user;
          _saveSession();
        }
        return data.user;
      });
  };

  /**
   * Fetch user inventory.
   * @returns {Promise<Array>} Inventory items
   */
  UserAccount.fetchInventory = function () {
    var token = UserAccount.getSessionToken();
    if (!token) {
      return Promise.reject(new Error('Not logged in'));
    }

    return fetch(API_BASE + '/inventory', {
      method: 'GET',
      headers: {
        'X-Session-Token': token,
      },
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Failed to fetch inventory');
        }
        return response.json();
      })
      .then(function (data) {
        return data.inventory;
      });
  };

  /**
   * Fetch user highscores.
   * @param {string} gameId - Optional game filter
   * @returns {Promise<Array>} Highscore entries
   */
  UserAccount.fetchHighscores = function (gameId) {
    var token = UserAccount.getSessionToken();
    if (!token) {
      return Promise.reject(new Error('Not logged in'));
    }

    var url = API_BASE + '/highscores';
    if (gameId) {
      url += '?game_id=' + encodeURIComponent(gameId);
    }

    return fetch(url, {
      method: 'GET',
      headers: {
        'X-Session-Token': token,
      },
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Failed to fetch highscores');
        }
        return response.json();
      })
      .then(function (data) {
        return data.highscores;
      });
  };

  /**
   * Fetch user's immersive filesystem.
   * @returns {Promise<Object>} Filesystem data
   */
  UserAccount.fetchFilesystem = function () {
    var token = UserAccount.getSessionToken();
    if (!token) {
      return Promise.reject(new Error('Not logged in'));
    }

    return fetch(API_BASE + '/filesystem', {
      method: 'GET',
      headers: {
        'X-Session-Token': token,
      },
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Failed to fetch filesystem');
        }
        return response.json();
      })
      .then(function (data) {
        return data.filesystem;
      });
  };

  /**
   * Update user's immersive filesystem.
   * @param {Object} filesystem - Filesystem data to save
   * @returns {Promise<void>}
   */
  UserAccount.updateFilesystem = function (filesystem) {
    var token = UserAccount.getSessionToken();
    if (!token) {
      return Promise.reject(new Error('Not logged in'));
    }

    return fetch(API_BASE + '/filesystem', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': token,
      },
      body: JSON.stringify({ filesystem: filesystem }),
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Failed to update filesystem');
        }
        return response.json();
      });
  };

  // --- Internal Helpers ---

  /**
   * Read response as JSON when possible; otherwise fall back to text.
   * Prevents "Unexpected token <" / "is not valid JSON" errors when the API returns HTML/text.
   */
  function _readJsonOrText(response) {
    try {
      var ct = (response && response.headers && response.headers.get) ? (response.headers.get('content-type') || '') : '';
      if (ct.indexOf('application/json') !== -1) {
        return response.json();
      }
      // Some APIs omit content-type on JSON. Try json() once, then fallback.
      return response.clone().json().catch(function () {
        return response.text();
      });
    } catch (e) {
      // Last resort
      return response.text();
    }
  }

  function _loadSession() {
    try {
      var stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        _session = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load session:', e);
    }
  }

  function _saveSession() {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(_session));
    } catch (e) {
      console.error('Failed to save session:', e);
    }
  }

  function _clearSession() {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (e) {
      console.error('Failed to clear session:', e);
    }
  }

  // Export to global scope
  window.UserAccount = UserAccount;
})(window);
