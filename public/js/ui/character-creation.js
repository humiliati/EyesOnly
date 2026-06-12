/* ============================================================
   EYES ONLY - Character Creation
   Terminal-style overlay for first-run callsign + avatar setup.
   Shown after the onboarding splash when no player profile exists.

   Flow:
     1. Callsign entry  (2-12 chars, alphanumeric + hyphen/underscore)
     2. Avatar selection (6 classes, tier-gated)
     3. Confirmation     ("Welcome, CALLSIGN. Deploying...")
     4. Callback fires → GoneRogue generates floor 1
   ============================================================ */

const CharacterCreation = (function () {
  'use strict';

  // ---- Avatar roster ----
  var AVATARS = [
    { id: 'AVA-001', emoji: '🕵️',  name: 'Operative', desc: 'Balanced field agent. No weaknesses.', tier: 0 },
    { id: 'AVA-002', emoji: '👨‍⚕️', name: 'Medic',     desc: 'Heals faster. Lower base damage.',    tier: 0 },
    { id: 'AVA-003', emoji: '🧭',  name: 'Scout',     desc: 'Faster movement. Reveals traps.',     tier: 1 },
    { id: 'AVA-004', emoji: '💪',  name: 'Heavy',     desc: 'More HP. Slower sprint.',             tier: 1 },
    { id: 'AVA-005', emoji: '👻',  name: 'Ghost',     desc: 'Stealth start. Fragile.',             tier: 2 },
    { id: 'AVA-006', emoji: '🤖',  name: 'Tech',      desc: 'Bonus gadgets. Lower stamina.',       tier: 3 }
  ];

  var _isShowing = false;
  var _onComplete = null;

  // DOM refs (created in _build)
  var _overlay = null;
  var _input   = null;

  // State machine for creation steps
  var STEP = { CALLSIGN: 0, AVATAR: 1, CONFIRM: 2 };
  var _step = STEP.CALLSIGN;
  var _callsign = '';
  var _selectedAvatar = null;
  var _playerTier = 0;

  // ================================================================
  //  PUBLIC: show / skip
  // ================================================================

  /**
   * Show character creation overlay.
   * @param {Object}   opts
   * @param {number}   opts.tier        - Player's current tier (determines unlocked avatars)
   * @param {Function} opts.onComplete  - Called with { callsign, avatarId, avatarEmoji }
   */
  function show(opts) {
    if (_isShowing) return;
    _isShowing = true;
    opts = opts || {};

    _onComplete = opts.onComplete || null;
    _playerTier = opts.tier || 0;
    _step = STEP.CALLSIGN;
    _callsign = '';
    _selectedAvatar = null;

    _build();
    _renderCallsignStep();
  }

  function skip() {
    // Skip must still COMPLETE the run-start chain. RunStartSystem wires
    // beginGameplay into onComplete — if skip only cleans up, the floor is
    // never generated and the player is stranded on a dead terminal.
    var cb = _onComplete;
    _cleanup();
    if (typeof cb === 'function') {
      var fallback = AVATARS[0];
      cb({
        callsign: _callsign || 'ROGUE',
        avatarId: fallback.id,
        avatarEmoji: fallback.emoji,
        skipped: true
      });
    }
  }

  function isShowing() {
    return _isShowing;
  }

  // ================================================================
  //  DOM CONSTRUCTION
  // ================================================================

  function _build() {
    // Remove any leftover
    var existing = document.getElementById('character-creation');
    if (existing) existing.remove();

    _overlay = document.createElement('div');
    _overlay.id = 'character-creation';
    _overlay.className = 'cc-overlay';

    document.body.appendChild(_overlay);
  }

  function _cleanup() {
    if (_overlay && _overlay.parentNode) {
      _overlay.parentNode.removeChild(_overlay);
    }
    _overlay = null;
    _input = null;
    _isShowing = false;
  }

  // ================================================================
  //  STEP 1 — CALLSIGN
  // ================================================================

  var CALLSIGN_PRESETS = [
    '007','RED','BLUE','SOLID SNAKE','LARA CROFT','SAMUS','RAIDEN','FOXHOUND','NOMAD','RAVEN',
    'ECHO','NIFTY','MOK','AWOL','GHOST','SCOUT','MEDIC','HEAVY','TECH','VIPER',
    'HOUND','WRAITH','ORACLE','SABER','FALCON','HUNTER','SPECTER','KILO','SIGMA','TANGO'
  ];

  var CALLSIGN_RESERVE_KEY = 'EYESONLY_CALLSIGN_RESERVATIONS_V1';
  function _reserveCallsign(base) {
    base = String(base || '').trim().toUpperCase().replace(/\s+/g, '-');
    if (!base) return '';

    var used = {};
    try { used = JSON.parse(localStorage.getItem(CALLSIGN_RESERVE_KEY) || '{}') || {}; } catch (e0) { used = {}; }

    if (!used[base]) {
      used[base] = 1;
      try { localStorage.setItem(CALLSIGN_RESERVE_KEY, JSON.stringify(used)); } catch (e1) {}
      return base;
    }

    var n = Number(used[base] || 1) + 1;
    used[base] = n;
    try { localStorage.setItem(CALLSIGN_RESERVE_KEY, JSON.stringify(used)); } catch (e2) {}
    return base + '-' + n;
  }

  function _renderCallsignStep() {
    _step = STEP.CALLSIGN;
    _overlay.innerHTML = '';

    // Header
    var header = _el('div', 'cc-header', '═══ OPERATIVE REGISTRATION ═══');
    _overlay.appendChild(header);

    // Flavour text
    var flavour = _el('div', 'cc-flavour',
      'No identity on file.\nAll operatives require a callsign before deployment.');
    _overlay.appendChild(flavour);

    // Label
    var label = _el('div', 'cc-label', 'SELECT CALLSIGN (OR CUSTOM):');
    _overlay.appendChild(label);

    // Callsign selector — CUSTOM at top, then presets (scrollable on mobile)
    var sel = document.createElement('select');
    sel.className = 'cc-select';
    sel.id = 'cc-callsign-preset';
    // Show multiple options at once for better mobile UX (scrollable list)
    sel.size = 8;

    // CUSTOM option first so keyboard-averse mobile users see it immediately
    var optC = document.createElement('option');
    optC.value = '__custom__';
    optC.textContent = '✎ CUSTOM…';
    sel.appendChild(optC);

    // Separator visual
    var optSep = document.createElement('option');
    optSep.disabled = true;
    optSep.textContent = '────────────────';
    sel.appendChild(optSep);

    for (var i = 0; i < CALLSIGN_PRESETS.length; i++) {
      var o = document.createElement('option');
      o.value = CALLSIGN_PRESETS[i];
      o.textContent = CALLSIGN_PRESETS[i];
      sel.appendChild(o);
    }

    _overlay.appendChild(sel);

    // Custom input row (hidden unless custom)
    var row = document.createElement('div');
    row.className = 'cc-input-row';
    row.id = 'cc-custom-row';
    row.style.display = 'none';

    var prompt = _el('span', 'cc-prompt', '> ');
    row.appendChild(prompt);

    _input = document.createElement('input');
    _input.type = 'text';
    _input.className = 'cc-text-input';
    _input.maxLength = 16;
    _input.setAttribute('autocomplete', 'off');
    _input.setAttribute('spellcheck', 'false');
    _input.setAttribute('autocapitalize', 'characters');
    row.appendChild(_input);

    _overlay.appendChild(row);

    // Validation message area
    var validMsg = _el('div', 'cc-validation', '');
    validMsg.id = 'cc-validation-msg';
    _overlay.appendChild(validMsg);

    // Confirm button
    var btn = document.createElement('button');
    btn.className = 'cc-confirm-btn';
    btn.textContent = 'CONFIRM';
    btn.type = 'button';
    _overlay.appendChild(btn);

    function _confirm(raw0, isPreset) {
      var raw = String(raw0 || '').trim().toUpperCase();
      var validMsg = document.getElementById('cc-validation-msg');

      if (!raw || raw.length < 1) {
        validMsg.textContent = 'Select a callsign or enter a custom one.';
        validMsg.className = 'cc-validation cc-validation-error';
        return;
      }

      // Normalize spaces to hyphens BEFORE validation (presets like "SOLID SNAKE" → "SOLID-SNAKE")
      raw = raw.replace(/\s+/g, '-');

      // Skip strict validation for known presets — they're already vetted
      if (!isPreset) {
        if (raw.length < 2) {
          validMsg.textContent = 'Too short. Minimum 2 characters.';
          validMsg.className = 'cc-validation cc-validation-error';
          return;
        }
        if (raw.length > 16) {
          // Raised from 12 to 16 to accommodate hyphenated presets + suffix
          validMsg.textContent = 'Too long. Maximum 16 characters.';
          validMsg.className = 'cc-validation cc-validation-error';
          return;
        }
        if (!/^[A-Z0-9][A-Z0-9\-_]*[A-Z0-9]$/.test(raw) && raw.length > 1) {
          validMsg.textContent = 'Invalid. Use A-Z, 0-9, hyphens, underscores.';
          validMsg.className = 'cc-validation cc-validation-error';
          return;
        }
      }

      _callsign = _reserveCallsign(raw);
      _renderAvatarStep();
    }

    sel.addEventListener('change', function() {
      var v = (sel.value || '').trim();
      var customRow = document.getElementById('cc-custom-row');
      if (v === '__custom__') {
        customRow.style.display = 'flex';
        requestAnimationFrame(function() { try { _input.focus(); } catch (e0) {} });
      } else {
        customRow.style.display = 'none';
        if (_input) _input.value = '';
      }
    });

    if (_input) {
      _input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          _confirm(_input.value, false);
        }
      });
    }

    btn.addEventListener('click', function() {
      var v = (sel.value || '').trim();
      if (v === '__custom__') {
        _confirm(_input.value, false);
      } else if (v) {
        // Preset selection — skip strict validation, auto-reserve with suffix
        _confirm(v, true);
      } else {
        var validMsg = document.getElementById('cc-validation-msg');
        if (validMsg) {
          validMsg.textContent = 'Select a callsign or choose CUSTOM.';
          validMsg.className = 'cc-validation cc-validation-error';
        }
      }
    });

    // focus selector by default (prevents keyboard on mobile)
    requestAnimationFrame(function() { try { sel.focus(); } catch (e0) {} });
  }

  // ================================================================
  //  STEP 2 — AVATAR SELECTION
  // ================================================================

  function _renderAvatarStep() {
    _step = STEP.AVATAR;
    _overlay.innerHTML = '';

    var header = _el('div', 'cc-header', '═══ SELECT AVATAR CLASS ═══');
    _overlay.appendChild(header);

    var sub = _el('div', 'cc-flavour',
      'CALLSIGN: ' + _callsign + '\nChoose your field specialisation.');
    _overlay.appendChild(sub);

    // Avatar list
    var list = document.createElement('div');
    list.className = 'cc-avatar-list';

    for (var i = 0; i < AVATARS.length; i++) {
      var av = AVATARS[i];
      var locked = av.tier > _playerTier;

      var card = document.createElement('div');
      card.className = 'cc-avatar-card' + (locked ? ' cc-locked' : '');
      card.setAttribute('data-index', i);

      var emojiSpan = _el('span', 'cc-avatar-emoji', locked ? '🔒' : av.emoji);
      card.appendChild(emojiSpan);

      var info = document.createElement('div');
      info.className = 'cc-avatar-info';

      var nameEl = _el('div', 'cc-avatar-name', av.name + (locked ? ' [TIER ' + av.tier + ']' : ''));
      info.appendChild(nameEl);

      var descEl = _el('div', 'cc-avatar-desc', locked ? 'Locked — complete tier ' + av.tier + ' to unlock.' : av.desc);
      info.appendChild(descEl);

      card.appendChild(info);

      if (!locked) {
        (function (idx) {
          card.addEventListener('click', function () { _selectAvatar(idx); });
        })(i);
      }

      list.appendChild(card);
    }

    _overlay.appendChild(list);

    // Keyboard hint
    var hint = _el('div', 'cc-hint', 'Click an avatar or press 1-' + AVATARS.length + ' to select.');
    _overlay.appendChild(hint);

    // Keyboard listener
    document.addEventListener('keydown', _onAvatarKey);
  }

  function _onAvatarKey(e) {
    if (_step !== STEP.AVATAR) return;
    var num = parseInt(e.key, 10);
    if (num >= 1 && num <= AVATARS.length) {
      var idx = num - 1;
      if (AVATARS[idx].tier <= _playerTier) {
        _selectAvatar(idx);
      }
    }
    // ESC goes back to callsign
    if (e.key === 'Escape') {
      document.removeEventListener('keydown', _onAvatarKey);
      _renderCallsignStep();
    }
  }

  function _selectAvatar(idx) {
    document.removeEventListener('keydown', _onAvatarKey);
    _selectedAvatar = AVATARS[idx];

    // Highlight selected card briefly
    var cards = _overlay.querySelectorAll('.cc-avatar-card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].classList.remove('cc-selected');
    }
    if (cards[idx]) cards[idx].classList.add('cc-selected');

    setTimeout(function () {
      _renderConfirmStep();
    }, 300);
  }

  // ================================================================
  //  STEP 3 — CONFIRMATION
  // ================================================================

  function _renderConfirmStep() {
    _step = STEP.CONFIRM;
    _overlay.innerHTML = '';

    var header = _el('div', 'cc-header', '═══ CONFIRM IDENTITY ═══');
    _overlay.appendChild(header);

    var identity = _el('div', 'cc-confirm-identity',
      _selectedAvatar.emoji + '  ' + _callsign);
    _overlay.appendChild(identity);

    var classInfo = _el('div', 'cc-confirm-class',
      'CLASS: ' + _selectedAvatar.name.toUpperCase());
    _overlay.appendChild(classInfo);

    var desc = _el('div', 'cc-confirm-desc', _selectedAvatar.desc);
    _overlay.appendChild(desc);

    // Buttons row
    var btnRow = document.createElement('div');
    btnRow.className = 'cc-btn-row';

    var confirmBtn = _el('div', 'cc-btn cc-btn-confirm', '[ DEPLOY ]');
    confirmBtn.addEventListener('click', _confirm);
    btnRow.appendChild(confirmBtn);

    var backBtn = _el('div', 'cc-btn cc-btn-back', '[ BACK ]');
    backBtn.addEventListener('click', function () {
      document.removeEventListener('keydown', _onConfirmKey);
      _renderAvatarStep();
    });
    btnRow.appendChild(backBtn);

    _overlay.appendChild(btnRow);

    // Key listener
    document.addEventListener('keydown', _onConfirmKey);
  }

  function _onConfirmKey(e) {
    if (_step !== STEP.CONFIRM) return;
    if (e.key === 'Enter' || e.key === 'y' || e.key === 'Y') {
      _confirm();
    }
    if (e.key === 'Escape' || e.key === 'n' || e.key === 'N') {
      document.removeEventListener('keydown', _onConfirmKey);
      _renderAvatarStep();
    }
  }

  function _confirm() {
    document.removeEventListener('keydown', _onConfirmKey);

    // Persist via TerminalCommandRouter
    if (typeof TerminalCommandRouter !== 'undefined') {
      TerminalCommandRouter.setCallsign(_callsign);
      TerminalCommandRouter.setAvatar(_selectedAvatar.id, _selectedAvatar.emoji);
    }

    // Update HUD header with new identity
    if (typeof LoginUI !== 'undefined' && LoginUI.refreshHeader) {
      LoginUI.refreshHeader();
    }

    // Deploy animation: flash the overlay then fade out
    _overlay.innerHTML = '';
    var deployMsg = _el('div', 'cc-deploy-msg',
      _selectedAvatar.emoji + '  ' + _callsign + '\n\nDEPLOYING TO FIELD...');
    _overlay.appendChild(deployMsg);

    setTimeout(function () {
      _overlay.classList.add('cc-fade-out');

      setTimeout(function () {
        _cleanup();

        if (typeof _onComplete === 'function') {
          _onComplete({
            callsign: _callsign,
            avatarId: _selectedAvatar.id,
            avatarEmoji: _selectedAvatar.emoji
          });
        }
      }, 500);
    }, 1200);
  }

  // ================================================================
  //  HELPERS
  // ================================================================

  function _el(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }

  // ================================================================
  //  PUBLIC API
  // ================================================================
  return {
    show: show,
    skip: skip,
    isShowing: isShowing,
    AVATARS: AVATARS   // Expose for other modules (e.g. stats display)
  };
})();
