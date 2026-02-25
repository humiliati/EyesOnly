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
    _cleanup();
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
    var label = _el('div', 'cc-label', 'ENTER CALLSIGN (2-12 CHARACTERS):');
    _overlay.appendChild(label);

    // Input row: "> ___________"
    var row = document.createElement('div');
    row.className = 'cc-input-row';

    var prompt = _el('span', 'cc-prompt', '> ');
    row.appendChild(prompt);

    _input = document.createElement('input');
    _input.type = 'text';
    _input.className = 'cc-text-input';
    _input.maxLength = 12;
    _input.setAttribute('autocomplete', 'off');
    _input.setAttribute('spellcheck', 'false');
    _input.setAttribute('autocapitalize', 'characters');
    row.appendChild(_input);

    _overlay.appendChild(row);

    // Validation message area
    var validMsg = _el('div', 'cc-validation', '');
    validMsg.id = 'cc-validation-msg';
    _overlay.appendChild(validMsg);

    // Hint
    var hint = _el('div', 'cc-hint', 'Letters, numbers, hyphens. Press ENTER to confirm.');
    _overlay.appendChild(hint);

    // Focus after animation frame
    requestAnimationFrame(function () {
      _input.focus();
    });

    // Key handler
    _input.addEventListener('keydown', _onCallsignKey);
  }

  function _onCallsignKey(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      var raw = (_input.value || '').trim().toUpperCase();
      var validMsg = document.getElementById('cc-validation-msg');

      // Validate
      if (raw.length < 2) {
        validMsg.textContent = 'Too short. Minimum 2 characters.';
        validMsg.className = 'cc-validation cc-validation-error';
        return;
      }
      if (raw.length > 12) {
        validMsg.textContent = 'Too long. Maximum 12 characters.';
        validMsg.className = 'cc-validation cc-validation-error';
        return;
      }
      if (!/^[A-Z0-9][A-Z0-9\-_]*[A-Z0-9]$/.test(raw) && raw.length > 1) {
        validMsg.textContent = 'Invalid. Use A-Z, 0-9, hyphens, underscores.';
        validMsg.className = 'cc-validation cc-validation-error';
        return;
      }

      _callsign = raw;
      _renderAvatarStep();
    }
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
