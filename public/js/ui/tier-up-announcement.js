/* ============================================================
   EYES ONLY - Tier-Up Announcement
   Full-screen overlay shown when a player unlocks a new avatar
   tier by completing floor 30 at a matching difficulty.

   Displays:
     • "TIER X CLEARANCE ACHIEVED"
     • Newly unlocked avatar(s) with emoji + class name
     • Auto-dismisses after ~4s or skip with click/key

   ============================================================ */

const TierUpAnnouncement = (function () {
  'use strict';

  var _isShowing = false;
  var _onComplete = null;
  var _overlay = null;
  var _skipHandler = null;
  var _autoTimer = null;

  /**
   * Show the tier-up announcement.
   * @param {Object}   opts
   * @param {number}   opts.tier        - The tier that was just unlocked (1-3)
   * @param {Function} opts.onComplete  - Called when overlay dismisses
   */
  function show(opts) {
    if (_isShowing) return;
    _isShowing = true;
    opts = opts || {};

    var tier = opts.tier || 1;
    _onComplete = opts.onComplete || null;

    // Clean up
    var existing = document.getElementById('tier-up-announcement');
    if (existing) existing.remove();

    _overlay = document.createElement('div');
    _overlay.id = 'tier-up-announcement';
    _overlay.className = 'tu-overlay';

    // Glow flash
    var flash = _el('div', 'tu-flash', '');
    _overlay.appendChild(flash);

    // Badge
    var badge = _el('div', 'tu-badge', '★');
    _overlay.appendChild(badge);

    // Title
    var title = _el('div', 'tu-title', 'TIER ' + tier + ' CLEARANCE');
    _overlay.appendChild(title);

    // Subtitle
    var sub = _el('div', 'tu-subtitle', 'NEW OPERATIVES UNLOCKED');
    _overlay.appendChild(sub);

    // Find avatars that unlock at this tier
    var newAvatars = _getAvatarsForTier(tier);

    if (newAvatars.length > 0) {
      var avatarList = document.createElement('div');
      avatarList.className = 'tu-avatar-list';

      for (var i = 0; i < newAvatars.length; i++) {
        var av = newAvatars[i];
        var card = document.createElement('div');
        card.className = 'tu-avatar-card';

        var emoji = _el('span', 'tu-avatar-emoji', av.emoji);
        card.appendChild(emoji);

        var info = document.createElement('div');
        info.className = 'tu-avatar-info';

        var name = _el('div', 'tu-avatar-name', av.name);
        info.appendChild(name);

        var desc = _el('div', 'tu-avatar-desc', av.desc);
        info.appendChild(desc);

        card.appendChild(info);
        avatarList.appendChild(card);
      }

      _overlay.appendChild(avatarList);
    }

    // Hint
    var hint = _el('div', 'tu-hint', 'Use CHARACTER SELECT to switch class on your next run.');
    _overlay.appendChild(hint);

    document.body.appendChild(_overlay);

    // Skip handler
    _skipHandler = function (e) {
      if (e.type === 'keydown' && (e.key === 'Tab' || e.key === 'Shift')) return;
      _dismiss();
    };

    // Delay registering skip so the player doesn't accidentally dismiss
    setTimeout(function () {
      document.addEventListener('keydown', _skipHandler);
      if (_overlay) _overlay.addEventListener('click', _skipHandler);
    }, 800);

    // Auto-dismiss
    _autoTimer = setTimeout(function () {
      _dismiss();
    }, 4500);
  }

  function _dismiss() {
    if (!_isShowing) return;

    if (_skipHandler) {
      document.removeEventListener('keydown', _skipHandler);
      _skipHandler = null;
    }
    if (_autoTimer) {
      clearTimeout(_autoTimer);
      _autoTimer = null;
    }

    if (_overlay) {
      _overlay.classList.add('tu-fade-out');

      setTimeout(function () {
        if (_overlay && _overlay.parentNode) {
          _overlay.parentNode.removeChild(_overlay);
        }
        _overlay = null;
        _isShowing = false;

        if (typeof _onComplete === 'function') {
          _onComplete();
        }
      }, 500);
    } else {
      _isShowing = false;
      if (typeof _onComplete === 'function') {
        _onComplete();
      }
    }
  }

  function _getAvatarsForTier(tier) {
    // Pull from CharacterCreation.AVATARS if available
    if (typeof CharacterCreation !== 'undefined' && CharacterCreation.AVATARS) {
      return CharacterCreation.AVATARS.filter(function (av) {
        return av.tier === tier;
      });
    }

    // Fallback roster
    var fallback = {
      1: [
        { emoji: '🧭', name: 'Scout', desc: 'Faster movement. Reveals traps.' },
        { emoji: '💪', name: 'Heavy', desc: 'More HP. Slower sprint.' }
      ],
      2: [
        { emoji: '👻', name: 'Ghost', desc: 'Stealth start. Fragile.' }
      ],
      3: [
        { emoji: '🤖', name: 'Tech', desc: 'Bonus gadgets. Lower stamina.' }
      ]
    };
    return fallback[tier] || [];
  }

  function skip() {
    _dismiss();
  }

  function isShowing() {
    return _isShowing;
  }

  function _el(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }

  return {
    show: show,
    skip: skip,
    isShowing: isShowing
  };
})();
