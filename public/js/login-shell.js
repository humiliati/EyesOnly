/* ============================================================
   EYES ONLY - Nested Login / Filesystem Subsystem
   Stateful "terminal within terminal" for dummy account access.
   ============================================================ */

const LoginShell = (function () {
  'use strict';

  var STORAGE_KEY = 'eyesonly_login_shell';

  var STATES = {
    INACTIVE: 'INACTIVE',
    AWAIT_USERNAME: 'AWAIT_USERNAME',
    AWAIT_PASSWORD: 'AWAIT_PASSWORD',
    SESSION: 'SESSION'
  };

  var _state = STATES.INACTIVE;
  var _pendingUsername = null;
  var _user = null;
  var _cwd = '/';

  var ACCOUNTS = {
    user: {
      password: 'password',
      home: '/home/user',
      fs: {
        '/': { type: 'dir', children: ['home', 'public', 'ops'] },
        '/home': { type: 'dir', children: ['user', 'admin'] },
        '/home/user': { type: 'dir', children: ['documents', 'downloads', 'todo.txt', 'it-note.txt'] },
        '/home/user/documents': { type: 'dir', children: ['field-journal.txt'] },
        '/home/user/downloads': { type: 'dir', children: [] },
        '/home/user/todo.txt': { type: 'file', body: '[TODO][IT] hide hardcoded credentials before launch\n[TODO][IT] rotate codename hint each week\n[TODO][IT] stop leaving TODOs in production' },
        '/home/user/it-note.txt': { type: 'file', body: 'IT GUY NOTE: if this file is visible, permissions are "working as intended".' },
        '/home/user/documents/field-journal.txt': { type: 'file', body: 'ENTRY: SANDPOINT COVER HOLDS. TERMINAL TRAFFIC INCREASING.' },
        '/home/admin': { type: 'dir', children: ['audit.log'] },
        '/home/admin/audit.log': { type: 'file', body: 'ACCESS DENIED FOR NON-ADMIN SESSIONS' },
        '/public': { type: 'dir', children: ['readme.txt'] },
        '/public/readme.txt': { type: 'file', body: 'ALL OPERATIONS ARE FICTIONAL. ALL LOCATIONS ARE REAL.' },
        '/ops': { type: 'dir', children: ['staging', 'archive'] },
        '/ops/staging': { type: 'dir', children: [] },
        '/ops/archive': { type: 'dir', children: [] }
      }
    },
    admin: {
      password: 'admin',
      home: '/home/admin',
      fs: {
        '/': { type: 'dir', children: ['home', 'ops', 'sys', 'blackvault'] },
        '/home': { type: 'dir', children: ['admin', 'user'] },
        '/home/admin': { type: 'dir', children: ['todo-admin.txt', 'credentials.bak', 'easter-eggs', 'logs'] },
        '/home/admin/logs': { type: 'dir', children: ['boot.log'] },
        '/home/admin/logs/boot.log': { type: 'file', body: 'BOOT TRACE: REV 77.04 // FLICKER EVENTS NOMINAL' },
        '/home/admin/todo-admin.txt': { type: 'file', body: '[TODO][IT] remove admin/admin before public launch\n[TODO][IT] write fake files for blackvault\n[TODO][IT] add delayed seasonal payload' },
        '/home/admin/credentials.bak': { type: 'file', body: 'do_not_ship.txt\nuser:password\nadmin:admin' },
        '/home/admin/easter-eggs': { type: 'dir', children: ['numbers-station.txt', 'designation.txt'] },
        '/home/admin/easter-eggs/numbers-station.txt': { type: 'file', body: '17 04 22 07 07 // REPEAT UNTIL ACK' },
        '/home/admin/easter-eggs/designation.txt': { type: 'file', body: 'designation obsolete but still required: CIVILIAN' },
        '/home/user': { type: 'dir', children: ['documents'] },
        '/home/user/documents': { type: 'dir', children: ['placeholder.txt'] },
        '/home/user/documents/placeholder.txt': { type: 'file', body: '[EMPTY]' },
        '/ops': { type: 'dir', children: ['deploy', 'archive'] },
        '/ops/deploy': { type: 'dir', children: ['notes.txt'] },
        '/ops/deploy/notes.txt': { type: 'file', body: 'STELLARAQUA CONTACT CHANNEL: admin@stellaraqua.com' },
        '/ops/archive': { type: 'dir', children: [] },
        '/sys': { type: 'dir', children: ['kernel.todo'] },
        '/sys/kernel.todo': { type: 'file', body: '[TODO][IT] terminal within terminal complete' },
        '/blackvault': { type: 'dir', children: [] }
      }
    }
  };

  function init() {
    _load();
  }

  function start() {
    _state = STATES.AWAIT_USERNAME;
    _pendingUsername = null;
    _user = null;
    _cwd = '/';
    _save();
    return {
      lines: [
        '',
        'LOGIN SUBSYSTEM INITIALIZED',
        'AUTHORIZED TEST ACCOUNTS: user, admin',
        'ENTER USERNAME:',
        ''
      ],
      prompt: 'USER> ',
      stayActive: true
    };
  }

  /**
   * Skip username/password prompts and drop directly into a test session.
   * Used by the login overlay so test accounts don't require "login twice".
   *
   * @param {string} username - 'user' | 'admin'
   */
  function autoLogin(username) {
    var u = Parser.normalize(username || '');
    if (!u || !ACCOUNTS[u]) {
      return {
        lines: ['UNKNOWN ACCOUNT', 'TRY: user OR admin', ''],
        prompt: 'USER> ',
        stayActive: true
      };
    }

    _state = STATES.SESSION;
    _pendingUsername = null;
    _user = u;
    _cwd = ACCOUNTS[_user].home;
    _save();

    return {
      lines: [
        '',
        'TEST SESSION AUTHORIZED: ' + _user.toUpperCase(),
        'TYPE HELP FOR FILESYSTEM COMMANDS',
        ''
      ],
      prompt: getPrompt(),
      stayActive: true
    };
  }

  function isAuthenticated() {
    return _state === STATES.SESSION;
  }

  function isActive() {
    return _state !== STATES.INACTIVE;
  }

  function getPrompt() {
    if (_state === STATES.AWAIT_USERNAME) return 'USER> ';
    if (_state === STATES.AWAIT_PASSWORD) return 'PASS> ';
    if (_state === STATES.SESSION) return (_user ? _user.toUpperCase() : 'USER') + ':' + _cwd + '> ';
    return '> ';
  }

  function process(raw) {
    raw = raw || '';

    // Defensive: if some caller accidentally includes the shell prompt in the submitted text
    // (e.g., "USER> ls" or "ADMIN:/home/admin> cat file"), strip it.
    raw = raw.replace(/^\s*(user|admin)(:[^>]+)?\s*>\s*/i, '');

    var input = Parser.normalize(raw);

    if (_state === STATES.AWAIT_USERNAME) {
      if (!input) {
        return { lines: ['USERNAME REQUIRED', ''], prompt: getPrompt(), stayActive: true };
      }
      if (!ACCOUNTS[input]) {
        return { lines: ['UNKNOWN ACCOUNT', 'TRY: user OR admin', ''], prompt: getPrompt(), stayActive: true };
      }
      _pendingUsername = input;
      _state = STATES.AWAIT_PASSWORD;
      _save();
      return { lines: ['USERNAME ACCEPTED', 'ENTER PASSWORD:', ''], prompt: getPrompt(), stayActive: true };
    }

    if (_state === STATES.AWAIT_PASSWORD) {
      if (!_pendingUsername || !ACCOUNTS[_pendingUsername]) {
        _state = STATES.AWAIT_USERNAME;
        _save();
        return { lines: ['SESSION ERROR - RESTART LOGIN', ''], prompt: getPrompt(), stayActive: true };
      }

      if (input !== ACCOUNTS[_pendingUsername].password) {
        _state = STATES.AWAIT_USERNAME;
        _pendingUsername = null;
        _save();
        return { lines: ['AUTHENTICATION FAILED', 'SESSION RESET', ''], prompt: getPrompt(), stayActive: true };
      }

      _user = _pendingUsername;
      _cwd = ACCOUNTS[_user].home;
      _pendingUsername = null;
      _state = STATES.SESSION;
      _save();
      return {
        lines: [
          'ACCESS GRANTED: ' + _user.toUpperCase(),
          'TYPE HELP FOR FILESYSTEM COMMANDS',
          ''
        ],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    if (_state === STATES.SESSION) {
      return _processSession(input);
    }

    return { lines: ['LOGIN INACTIVE', ''], stayActive: false };
  }

  function _processSession(input) {
    if (!input) return { lines: [''], prompt: getPrompt(), stayActive: true };

    var parts = input.split(' ');
    var cmd = parts[0];
    var arg = parts.slice(1).join(' ');

    if (cmd === 'help') {
      return {
        lines: [
          'FILESYSTEM COMMANDS:',
          '  ls | dir          list directory contents',
          '  cd <path>         change directory',
          '  pwd               print current path',
          '  cat <file>        read file contents',
          '  tree              show common paths',
          '  whoami            show active account',
          '  logout | exit     leave login subsystem',
          ''
        ],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    if (cmd === 'logout' || cmd === 'exit') {
      _state = STATES.INACTIVE;
      _pendingUsername = null;
      _user = null;
      _cwd = '/';
      _save();
      return {
        lines: ['LOGIN SHELL CLOSED', 'RETURNING TO PRIMARY TERMINAL', ''],
        stayActive: false
      };
    }

    if (cmd === 'pwd') {
      return { lines: [_cwd, ''], prompt: getPrompt(), stayActive: true };
    }

    if (cmd === 'whoami') {
      return { lines: [_user, ''], prompt: getPrompt(), stayActive: true };
    }

    if (cmd === 'ls' || cmd === 'dir') {
      var node = _node(_cwd);
      if (!node || node.type !== 'dir') return { lines: ['NOT A DIRECTORY', ''], prompt: getPrompt(), stayActive: true };
      var lines = node.children.length ? node.children.slice() : ['[EMPTY]'];
      lines.push('');
      return { lines: lines, prompt: getPrompt(), stayActive: true };
    }

    if (cmd === 'tree') {
      var roots = ['/home', '/ops', '/public', '/sys', '/blackvault'];
      var lines = ['KNOWN PATHS:'];
      roots.forEach(function (p) {
        if (_node(p)) lines.push('  ' + p);
      });
      lines.push('');
      return { lines: lines, prompt: getPrompt(), stayActive: true };
    }

    if (cmd === 'cd') {
      if (!arg) return { lines: ['USAGE: cd <path>', ''], prompt: getPrompt(), stayActive: true };
      var target = _resolve(arg);
      var d = _node(target);
      if (!d || d.type !== 'dir') return { lines: ['DIRECTORY NOT FOUND', ''], prompt: getPrompt(), stayActive: true };
      _cwd = target;
      _save();
      return { lines: [''], prompt: getPrompt(), stayActive: true };
    }

    if (cmd === 'cat' || cmd === 'type') {
      if (!arg) return { lines: ['USAGE: cat <file>', ''], prompt: getPrompt(), stayActive: true };
      var file = _node(_resolve(arg));
      if (!file || file.type !== 'file') return { lines: ['FILE NOT FOUND', ''], prompt: getPrompt(), stayActive: true };
      return { lines: [file.body, ''], prompt: getPrompt(), stayActive: true };
    }

    return { lines: ['UNKNOWN FILESYSTEM COMMAND', 'TYPE HELP', ''], prompt: getPrompt(), stayActive: true };
  }

  function _resolve(path) {
    if (path === '.') return _cwd;
    if (path === '..') return _cwd.lastIndexOf('/') > 0 ? _cwd.slice(0, _cwd.lastIndexOf('/')) : '/';
    var full = path[0] === '/' ? path : (_cwd === '/' ? '/' + path : _cwd + '/' + path);
    var segments = full.split('/').filter(Boolean);
    var stack = [];
    segments.forEach(function (s) {
      if (s === '.') return;
      if (s === '..') stack.pop();
      else stack.push(s);
    });
    return '/' + stack.join('/');
  }

  function _node(path) {
    if (!_user || !ACCOUNTS[_user]) return null;
    return ACCOUNTS[_user].fs[path] || null;
  }

  function _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        state: _state,
        user: _user,
        pendingUsername: _pendingUsername,
        cwd: _cwd
      }));
    } catch (e) { /* ignore */ }
  }

  function _load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      _state = data.state || STATES.INACTIVE;
      _user = data.user || null;
      _pendingUsername = data.pendingUsername || null;
      _cwd = data.cwd || '/';

      if (_state === STATES.SESSION && (!_user || !ACCOUNTS[_user])) {
        _state = STATES.INACTIVE;
        _user = null;
        _cwd = '/';
      }
    } catch (e) { /* ignore */ }
  }

  return {
    init: init,
    start: start,
    autoLogin: autoLogin,
    process: process,
    isActive: isActive,
    isAuthenticated: isAuthenticated,
    getPrompt: getPrompt
  };
})();
