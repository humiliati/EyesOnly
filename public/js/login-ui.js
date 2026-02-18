/* ============================================================
   EYES ONLY - Login UI
   User account login and registration interface.
   Integrates with terminal for seamless authentication.
   ============================================================ */

(function (window) {
  'use strict';

  var LoginUI = {};

  // Current mode: 'idle', 'login', 'register_username', 'register_callsign', 'register_email'
  var _mode = 'idle';
  var _registrationData = {};

  /**
   * Initialize login UI.
   */
  LoginUI.init = function () {
    // Check if user is already logged in
    if (UserAccount.isLoggedIn()) {
      _updateHeaderDisplay();
    }
  };

  /**
   * Show login prompt in terminal.
   */
  LoginUI.showLoginPrompt = function () {
    if (_mode !== 'idle') return;
    _mode = 'login';

    Terminal.writeLine('');
    Terminal.writeLine('=== USER LOGIN ===', 'system-msg');
    Terminal.writeLine('');
    Terminal.writeLine('Enter your username to log in.', 'info-msg');
    Terminal.writeLine('Type "cancel" to return to main menu.', 'info-msg');
    Terminal.writeLine('');
  };

  /**
   * Show registration prompt in terminal.
   */
  LoginUI.showRegisterPrompt = function () {
    if (_mode !== 'idle') return;
    _mode = 'register_username';
    _registrationData = {};

    Terminal.writeLine('');
    Terminal.writeLine('=== NEW USER REGISTRATION ===', 'system-msg');
    Terminal.writeLine('');
    Terminal.writeLine('Create your user account.', 'info-msg');
    Terminal.writeLine('Username: 3-20 characters, alphanumeric + underscore only.', 'info-msg');
    Terminal.writeLine('Type "cancel" at any time to abort.', 'info-msg');
    Terminal.writeLine('');
  };

  /**
   * Process user input based on current mode.
   */
  LoginUI.processInput = function (input) {
    input = (input || '').trim();

    if (_mode === 'login') {
      _handleLoginInput(input);
      return true;
    } else if (_mode === 'register_username') {
      _handleRegisterUsername(input);
      return true;
    } else if (_mode === 'register_callsign') {
      _handleRegisterCallsign(input);
      return true;
    } else if (_mode === 'register_email') {
      _handleRegisterEmail(input);
      return true;
    }

    return false; // Not handled
  };

  /**
   * Check if LoginUI is currently active.
   */
  LoginUI.isActive = function () {
    return _mode !== 'idle';
  };

  /**
   * Handle login username input.
   */
  function _handleLoginInput(username) {
    username = username.toLowerCase();

    if (username === 'cancel') {
      Terminal.writeLine('');
      Terminal.writeLine('Login cancelled.', 'warn-msg');
      Terminal.writeLine('');
      _mode = 'idle';
      return;
    }

    if (!username) {
      Terminal.writeLine('');
      Terminal.writeLine('Username cannot be empty.', 'error-msg');
      Terminal.writeLine('');
      return;
    }

    // Attempt login
    Terminal.writeLine('');
    Terminal.writeLine('Authenticating...', 'system-msg');

    UserAccount.login(username)
      .then(function (data) {
        Terminal.writeLine('');
        Terminal.writeLine('Login successful! Welcome back, ' + data.user.callsign + '.', 'success-msg');
        Terminal.writeLine('');
        _mode = 'idle';
        _updateHeaderDisplay();
        _notifyLoginSuccess();
      })
      .catch(function (err) {
        Terminal.writeLine('');
        Terminal.writeLine('Login failed: ' + err.message, 'error-msg');
        Terminal.writeLine('');
        _mode = 'idle';
      });
  }

  /**
   * Handle registration username input.
   */
  function _handleRegisterUsername(username) {
    if (username.toLowerCase() === 'cancel') {
      Terminal.writeLine('');
      Terminal.writeLine('Registration cancelled.', 'warn-msg');
      Terminal.writeLine('');
      _mode = 'idle';
      _registrationData = {};
      return;
    }

    if (!username || username.length < 3 || username.length > 20) {
      Terminal.writeLine('');
      Terminal.writeLine('Username must be 3-20 characters.', 'error-msg');
      Terminal.writeLine('');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      Terminal.writeLine('');
      Terminal.writeLine('Username can only contain letters, numbers, and underscores.', 'error-msg');
      Terminal.writeLine('');
      return;
    }

    // Store username and prompt for callsign
    _registrationData.username = username;
    _mode = 'register_callsign';

    Terminal.writeLine('');
    Terminal.writeLine('Callsign (optional, press Enter to use username):', 'info-msg');
  }

  /**
   * Handle registration callsign input.
   */
  function _handleRegisterCallsign(callsign) {
    if (callsign.toLowerCase() === 'cancel') {
      Terminal.writeLine('');
      Terminal.writeLine('Registration cancelled.', 'warn-msg');
      Terminal.writeLine('');
      _mode = 'idle';
      _registrationData = {};
      return;
    }

    _registrationData.callsign = callsign || _registrationData.username;
    _mode = 'register_email';

    Terminal.writeLine('');
    Terminal.writeLine('Email (optional for recovery, press Enter to skip):', 'info-msg');
  }

  /**
   * Handle registration email input.
   */
  function _handleRegisterEmail(email) {
    if (email.toLowerCase() === 'cancel') {
      Terminal.writeLine('');
      Terminal.writeLine('Registration cancelled.', 'warn-msg');
      Terminal.writeLine('');
      _mode = 'idle';
      _registrationData = {};
      return;
    }

    // Validate email if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Terminal.writeLine('');
      Terminal.writeLine('Invalid email format. Please try again or press Enter to skip.', 'error-msg');
      Terminal.writeLine('');
      return;
    }

    _registrationData.email = email || null;
    _completeRegistration();
  }

  /**
   * Complete registration process.
   */
  function _completeRegistration() {
    Terminal.writeLine('');
    Terminal.writeLine('Creating account...', 'system-msg');

    UserAccount.register(_registrationData.username, _registrationData.callsign, _registrationData.email)
      .then(function (result) {
        Terminal.writeLine('');
        Terminal.writeLine('Registration successful!', 'success-msg');
        Terminal.writeLine('Welcome, ' + result.user.callsign + '.', 'success-msg');
        Terminal.writeLine('');
        _mode = 'idle';
        _registrationData = {};
        _updateHeaderDisplay();
        _notifyLoginSuccess();
      })
      .catch(function (err) {
        Terminal.writeLine('');
        Terminal.writeLine('Registration failed: ' + err.message, 'error-msg');
        Terminal.writeLine('');
        _mode = 'idle';
        _registrationData = {};
      });
  }

  /**
   * Handle user logout.
   */
  LoginUI.logout = function () {
    if (!UserAccount.isLoggedIn()) {
      Terminal.writeLine('');
      Terminal.writeLine('You are not logged in.', 'warn-msg');
      Terminal.writeLine('');
      return Promise.resolve();
    }

    Terminal.writeLine('');
    Terminal.writeLine('Logging out...', 'system-msg');

    return UserAccount.logout()
      .then(function () {
        Terminal.writeLine('Logged out successfully.', 'success-msg');
        Terminal.writeLine('');
        _updateHeaderDisplay();
        _notifyLogout();
      })
      .catch(function (err) {
        Terminal.writeLine('Logout failed: ' + err.message, 'error-msg');
        Terminal.writeLine('');
      });
  };

  /**
   * Notify other systems of logout.
   */
  function _notifyLogout() {
    // Clear kernel state
    if (typeof KernelManager !== 'undefined' && typeof KernelManager.disconnect === 'function') {
      KernelManager.disconnect();
    }
  }

  /**
   * Update header display with user info.
   */
  function _updateHeaderDisplay() {
    var user = UserAccount.getCurrentUser();
    var actorNameDisplay = document.getElementById('actor-name-display');
    var accountabilityIcon = document.getElementById('accountability-icon');

    if (!actorNameDisplay) return;

    if (user) {
      actorNameDisplay.textContent = user.callsign;
      if (accountabilityIcon) {
        accountabilityIcon.style.color = '#00ff00'; // Green = accountable
        accountabilityIcon.textContent = '●';
      }
    } else {
      actorNameDisplay.textContent = '[guest]';
      if (accountabilityIcon) {
        accountabilityIcon.style.color = '#ff0000'; // Red = unaccountable
        accountabilityIcon.textContent = '●';
      }
    }
  }

  /**
   * Notify other systems of successful login.
   */
  function _notifyLoginSuccess() {
    // Enable kernel button if available
    if (typeof UIControls !== 'undefined' && typeof UIControls.enableKernelButton === 'function') {
      UIControls.enableKernelButton();
    }

    // Re-init KernelManager to sync state from server
    if (typeof KernelManager !== 'undefined' && typeof KernelManager.init === 'function') {
      KernelManager.init();
    }

    // Load user data into GAMESTATE if available
    var user = UserAccount.getCurrentUser();
    if (user && typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.loadUserData === 'function') {
      GAMESTATE.loadUserData({
        user_id: user.id,
        username: user.username,
        callsign: user.callsign,
        cryptos: user.cryptos,
      });
    }
  }

  /**
   * Check login status.
   * @returns {boolean} True if logged in
   */
  LoginUI.checkLoginStatus = function () {
    return UserAccount.isLoggedIn();
  };

  // Export to global scope
  window.LoginUI = LoginUI;
})(window);
