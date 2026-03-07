/* ============================================================
   Non-Combat HUD — NCH Capsule + Solitaire Tableau (v2)
   Capsule (bottom-left) → expands to 3-zone deck management.
   ============================================================ */

var NonCombatHUD = (function() {
  'use strict';

  // DOM refs
  var _capsule = null;   // .nch-capsule-wrapper (closed state)
  var _expanded = null;   // #nch-expanded (open state)
  var _isExpanded = false;

  // Drag state
  var _drag = null; // { kind, index, id, emoji, ghostEl, startX, startY, dragging }

  // ── Combat Capsule state ─────────────────────────────────
  // When non-null, the capsule renders combat hand with per-card emoji intelligence.
  // Each joker becomes a node: selected/resolving cards show card.emoji, others show 🃏.
  // This is the CH (Combat Hand) capsule — visually identical to NCH capsule but card-aware.
  var _combatCapsule = null;
  // When active: { cards: [...], selectedIds: [], resolving: false, timerPercent: null }

  // Preferences (localStorage)
  var PREF_KEY = 'EYESONLY_NONCOMBAT_HUD_PREFS_V2';
  var _prefs = { expanded: false };

  function _loadPrefs() {
    try {
      var raw = localStorage.getItem(PREF_KEY);
      if (raw) _prefs = Object.assign(_prefs, JSON.parse(raw));
    } catch (e) {}
  }
  function _savePrefs() {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(_prefs)); } catch (e) {}
  }

  // ─── INIT ───────────────────────────────────────────────

  function init() {
    if (_capsule) return;
    _loadPrefs();
    _createCapsule();
    _createExpanded();
    _attachGlobalListeners();

    // Subscribe to CardStateAuthority events (primary)
    if (typeof CardStateAuthority !== 'undefined') {
      CardStateAuthority.on('hand:changed', function() {
        // BLVCK check on every hand change (card played, moved, drawn, etc.)
        try {
          if (typeof CardStateAuthority.checkBlvckState === 'function') {
            CardStateAuthority.checkBlvckState();
          }
        } catch (e) {}
        _renderAll();
      });
      CardStateAuthority.on('backup:changed', function() { _renderAll(); });
      CardStateAuthority.on('vault:changed', function() { _renderAll(); });
      CardStateAuthority.on('draw:executed', function() { _renderAll(); });
    }

    // Legacy subscribers (backward compat)
    if (typeof NonCombatStateStore !== 'undefined' && NonCombatStateStore.subscribe) {
      NonCombatStateStore.subscribe(function() { _renderAll(); });
    }

    // React to GAMESTATE events
    if (typeof window !== 'undefined') {
      window.addEventListener('rogue-hand-changed', function() {
        // BLVCK removal check: also fires during STR combat after backup draws
        try {
          if (typeof CardStateAuthority !== 'undefined' && typeof CardStateAuthority.checkBlvckState === 'function') {
            CardStateAuthority.checkBlvckState();
          }
        } catch (e) {}
        _renderAll();
      });
      window.addEventListener('rogue-active-item-changed', function() { _renderAll(); });
      window.addEventListener('gone-rogue-registry-ready', function() { _renderAll(); });
      window.addEventListener('rogue-card-incinerated', function(e) { _showIncinerationEffect(e.detail); });
      // Belt-and-suspenders: CSA window-level event fallback
      window.addEventListener('csa-event', function(ev) {
        var t = ev && ev.detail && ev.detail.type;
        if (t === 'vault:changed' || t === 'hand:changed' || t === 'backup:changed') {
          _renderAll();
        }
      });
    }

    // Visibility polling (show/hide based on GoneRogue active + STR combat state)
    setInterval(_pollVisibility, 350);

    // Apply initial state — always start minimized (capsule mode).
    // Players expand manually when they need deck management.
    // Previously this respected _prefs.expanded, but new players
    // were seeing a full-screen NCH covering the game on first load.
    _prefs.expanded = false;
    _savePrefs();

    _renderAll();
  }

  // ─── CAPSULE (closed state) ─────────────────────────────

  var CAPSULE_POS_KEY = 'EYESONLY_NCH_CAPSULE_POS_V1';
  var _capsuleDrag = null; // { startX, startY, origLeft, origTop, moved }

  function _loadCapsulePos() {
    try {
      var raw = localStorage.getItem(CAPSULE_POS_KEY);
      if (raw) return JSON.parse(raw); // { left, top }
    } catch (e) {}
    return null;
  }
  function _saveCapsulePos(left, top) {
    try { localStorage.setItem(CAPSULE_POS_KEY, JSON.stringify({ left: left, top: top })); } catch (e) {}
  }
  function _clearCapsulePos() {
    try { localStorage.removeItem(CAPSULE_POS_KEY); } catch (e) {}
  }

  function _applyCapsulePos() {
    if (!_capsule) return;
    var pos = _loadCapsulePos();
    if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
      // User-saved position: switch from bottom/right to top/left
      _capsule.style.bottom = 'auto';
      _capsule.style.right = 'auto';
      _capsule.style.left = Math.max(0, Math.min(pos.left, window.innerWidth - 40)) + 'px';
      _capsule.style.top = Math.max(0, Math.min(pos.top, window.innerHeight - 40)) + 'px';
    } else {
      // Default: bottom-right above footer tooltip expander
      _capsule.style.left = '';
      _capsule.style.top = '';
      _capsule.style.bottom = '';
      _capsule.style.right = '';
    }
  }

  function resetCapsulePosition() {
    _clearCapsulePos();
    if (_capsule) {
      _capsule.style.left = '';
      _capsule.style.top = '';
      _capsule.style.bottom = '';
      _capsule.style.right = '';
    }
  }

  function _createCapsule() {
    _capsule = document.createElement('div');
    _capsule.className = 'nch-capsule-wrapper';
    _capsule.style.display = 'none';
    _capsule.innerHTML =
      '<div class="nch-capsule">' +
        '<div class="nch-capsule-stack" id="nch-capsule-stack"></div>' +
      '</div>';

    // Drag support (works for pointer on desktop + touch on mobile)
    _capsule.addEventListener('pointerdown', function(e) {
      // Only primary button (or touch)
      if (e.button && e.button !== 0) return;
      e.preventDefault();
      var rect = _capsule.getBoundingClientRect();
      _capsuleDrag = {
        startX: e.clientX,
        startY: e.clientY,
        origLeft: rect.left,
        origTop: rect.top,
        moved: false
      };
      _capsule.classList.add('nch-dragging');
      _capsule.setPointerCapture(e.pointerId);
    });

    _capsule.addEventListener('pointermove', function(e) {
      if (!_capsuleDrag) return;
      var dx = e.clientX - _capsuleDrag.startX;
      var dy = e.clientY - _capsuleDrag.startY;
      if (!_capsuleDrag.moved && Math.sqrt(dx * dx + dy * dy) < 6) return;
      _capsuleDrag.moved = true;
      var newLeft = _capsuleDrag.origLeft + dx;
      var newTop = _capsuleDrag.origTop + dy;
      // Clamp to viewport
      newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - 40));
      newTop = Math.max(0, Math.min(newTop, window.innerHeight - 40));
      _capsule.style.bottom = 'auto';
      _capsule.style.right = 'auto';
      _capsule.style.left = newLeft + 'px';
      _capsule.style.top = newTop + 'px';
    });

    _capsule.addEventListener('pointerup', function(e) {
      if (!_capsuleDrag) return;
      _capsule.classList.remove('nch-dragging');
      if (_capsuleDrag.moved) {
        // Save position
        var rect = _capsule.getBoundingClientRect();
        _saveCapsulePos(rect.left, rect.top);
      } else {
        // Click (no drag) → expand NCH
        _expand('capsule_click');
      }
      _capsuleDrag = null;
    });

    _capsule.addEventListener('pointercancel', function() {
      _capsule.classList.remove('nch-dragging');
      _capsuleDrag = null;
    });

    document.body.appendChild(_capsule);
    _applyCapsulePos();
  }

  function _renderCapsule() {
    if (!_capsule) return;
    var hand = _getHand();
    var count = hand.length;

    // Determine stranded state and which cards are BLVCK
    var stranded = false;
    var blvckId = (typeof CardStateAuthority !== 'undefined' && CardStateAuthority.BLVCK_ID)
      ? CardStateAuthority.BLVCK_ID : 'ACT-000';
    try {
      if (typeof CardStateAuthority !== 'undefined' && CardStateAuthority.isHandStranded) {
        stranded = CardStateAuthority.isHandStranded();
      }
    } catch (e) {}

    // Build a per-card "is this BLVCK?" map
    var blvckMap = [];
    for (var bi = 0; bi < hand.length; bi++) {
      blvckMap.push(!!(hand[bi] && hand[bi].id === blvckId));
    }

    // Stranded with no usable cards and empty/only-BLVCK: show single greyed joker
    var allBlvckOrEmpty = (count === 0) || blvckMap.every(function(b) { return b; });

    var stackEl = _capsule.querySelector('#nch-capsule-stack');
    if (!stackEl) return;

    // Build signature to avoid unnecessary rebuilds
    var sig = count + ':' + (stranded ? '1' : '0') + ':' + blvckMap.join('');
    if (stackEl.dataset.sig === sig) return;
    stackEl.dataset.sig = sig;

    stackEl.innerHTML = '';

    if (stranded && allBlvckOrEmpty) {
      // Single greyed-out joker — hand is unusable
      stackEl.style.width = '20px';
      var gj = document.createElement('div');
      gj.className = 'nch-capsule-joker joker-0 nch-joker-greyed';
      gj.textContent = '\uD83C\uDCCF'; // 🃏
      stackEl.appendChild(gj);
    } else {
      // Normal stack with per-card greying for BLVCK entries
      var numJokers = Math.min(count, 8);
      stackEl.style.width = (numJokers > 0 ? (20 + (numJokers - 1) * 6) : 20) + 'px';
      for (var i = 0; i < numJokers; i++) {
        var j = document.createElement('div');
        j.className = 'nch-capsule-joker joker-' + i;
        if (blvckMap[i]) j.classList.add('nch-joker-greyed');
        j.textContent = '\uD83C\uDCCF'; // 🃏
        stackEl.appendChild(j);
      }
    }
  }

  // ─── COMBAT CAPSULE (CH) ────────────────────────────────
  // Reuses the same nch-capsule-wrapper / nch-capsule-stack DOM.
  // Each joker becomes an "intelligent node":
  //   - Selected/resolving cards: show card.emoji (🗡️, 🛡️, etc.)
  //   - Non-selected cards: show 🃏
  // This unifies the old hand-fan-mini-indicator into the NCH capsule form factor.

  function _timerColorForPercent(pct) {
    function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
    var stops = [
      { p: 1.00, c: [ 76, 175,  80] },
      { p: 0.80, c: [  0, 150, 136] },
      { p: 0.60, c: [255, 193,   7] },
      { p: 0.40, c: [255, 152,   0] },
      { p: 0.20, c: [255,  87,  34] },
      { p: 0.10, c: [244,  67,  54] },
      { p: 0.00, c: [244,  67,  54] }
    ];
    pct = Math.max(0, Math.min(1, pct));
    for (var i = 0; i < stops.length - 1; i++) {
      var a = stops[i], b = stops[i + 1];
      if (pct <= a.p && pct >= b.p) {
        var span = (a.p - b.p) || 1;
        var t = (a.p - pct) / span;
        return 'rgb(' + lerp(a.c[0], b.c[0], t) + ',' + lerp(a.c[1], b.c[1], t) + ',' + lerp(a.c[2], b.c[2], t) + ')';
      }
    }
    return 'rgb(244,67,54)';
  }

  /**
   * Render the combat-aware capsule into #nch-capsule-stack.
   * Selected cards transition from 🃏 to their card.emoji.
   * Resolving cards get a pulse animation class.
   */
  function _renderCombatCapsule() {
    if (!_capsule || !_combatCapsule) return;
    var stackEl = _capsule.querySelector('#nch-capsule-stack');
    if (!stackEl) return;

    var cards = _combatCapsule.cards;
    var selectedIds = _combatCapsule.selectedIds;
    var count = cards.length;

    // Build signature to avoid unnecessary DOM rebuilds
    var sig = 'ch:' + count + ':' + selectedIds.join(',') + ':' +
              (_combatCapsule.resolving ? 'R' : 'S') + ':' +
              Math.round((_combatCapsule.timerPercent || 0) * 100);
    if (stackEl.dataset.sig === sig) return;
    stackEl.dataset.sig = sig;

    stackEl.innerHTML = '';
    var numSlots = Math.min(count, 8);
    stackEl.style.width = (numSlots > 0 ? (20 + (numSlots - 1) * 6) : 20) + 'px';

    var blvckId = (typeof CardStateAuthority !== 'undefined' && CardStateAuthority.BLVCK_ID)
      ? CardStateAuthority.BLVCK_ID : 'ACT-000';

    for (var i = 0; i < numSlots; i++) {
      var card = cards[i];
      var isSelected = card && card.id && selectedIds.indexOf(card.id) !== -1;
      var isBlvck = card && (card.id === blvckId || card.id === 'ACT-000' || card.name === 'BLVCK');

      var j = document.createElement('div');
      j.className = 'nch-capsule-joker joker-' + i;

      if (isSelected) {
        // ★ Intelligent node: reveal the card's actual emoji
        j.textContent = (card.emoji || card.glyph || '\uD83C\uDCCF');
        j.classList.add('nch-joker-active');
        if (_combatCapsule.resolving) {
          j.classList.add('nch-joker-resolving');
        }
      } else if (isBlvck) {
        j.textContent = '\uD83C\uDCCF'; // 🃏
        j.classList.add('nch-joker-greyed');
      } else {
        j.textContent = '\uD83C\uDCCF'; // 🃏
      }

      stackEl.appendChild(j);
    }

    // Timer color on capsule border during combat
    if (_combatCapsule.timerPercent != null) {
      var col = _timerColorForPercent(_combatCapsule.timerPercent);
      _capsule.style.outline = '2px solid ' + col;
      _capsule.style.outlineOffset = '2px';
    } else {
      _capsule.style.outline = '';
      _capsule.style.outlineOffset = '';
    }

    // Critical pulse class when timer < 20%
    if (_combatCapsule.timerPercent != null && _combatCapsule.timerPercent < 0.20) {
      _capsule.classList.add('nch-capsule-critical');
    } else {
      _capsule.classList.remove('nch-capsule-critical');
    }
  }

  /**
   * Enter combat capsule mode. The capsule switches from generic jokers
   * to per-card intelligent nodes. Call on every combat UI update tick.
   * @param {Array} cards - current hand cards with { id, emoji, glyph, name, ... }
   * @param {Object} opts - { selectedIds: string[], timerPercent: number|null, resolving: boolean }
   */
  function showCombatCapsule(cards, opts) {
    opts = opts || {};
    _combatCapsule = {
      cards: cards || [],
      selectedIds: opts.selectedIds || [],
      resolving: !!opts.resolving,
      timerPercent: opts.timerPercent != null ? opts.timerPercent : null
    };
    // Force capsule visible (overrides _pollVisibility hiding during expand)
    if (_capsule) _capsule.style.display = 'flex';
    _renderCombatCapsule();
  }

  /**
   * Update the combat capsule without creating a new state object.
   * For lightweight updates (e.g. timer percent only).
   * @param {Object} opts - partial update { cards?, selectedIds?, timerPercent?, resolving? }
   */
  function updateCombatCapsule(opts) {
    if (!_combatCapsule) return;
    if (opts.cards != null) _combatCapsule.cards = opts.cards;
    if (opts.selectedIds != null) _combatCapsule.selectedIds = opts.selectedIds;
    if (opts.resolving != null) _combatCapsule.resolving = opts.resolving;
    if (opts.timerPercent != null) _combatCapsule.timerPercent = opts.timerPercent;
    _renderCombatCapsule();
  }

  /**
   * Flash the capsule on resolution edge (replaces old flashMiniIndicator).
   */
  function flashCombatCapsule() {
    if (!_capsule) return;
    _capsule.classList.remove('nch-capsule-flash');
    void _capsule.offsetWidth; // force reflow
    _capsule.classList.add('nch-capsule-flash');
    setTimeout(function() {
      try { _capsule.classList.remove('nch-capsule-flash'); } catch (e) {}
    }, 420);
  }

  /**
   * Exit combat capsule mode. Clears combat state, removes timer styling,
   * returns capsule to normal NCH joker rendering on next poll tick.
   */
  function hideCombatCapsule() {
    _combatCapsule = null;
    // Clear combat-specific styling
    if (_capsule) {
      _capsule.style.outline = '';
      _capsule.style.outlineOffset = '';
      _capsule.classList.remove('nch-capsule-critical');
      _capsule.classList.remove('nch-capsule-flash');
    }
    // Force signature reset so _renderCapsule() rebuilds on next poll
    var stackEl = _capsule ? _capsule.querySelector('#nch-capsule-stack') : null;
    if (stackEl) stackEl.dataset.sig = '';
  }

  // ─── EXPANDED VIEW ──────────────────────────────────────

  function _createExpanded() {
    _expanded = document.createElement('div');
    _expanded.id = 'nch-expanded';
    _expanded.style.display = 'none';
    _expanded.innerHTML =
      '<div class="nch-header">' +
        '<span class="nch-header-title">DECK MANAGEMENT</span>' +
        '<div class="nch-header-right">' +
          '<span class="nch-equipped-display" id="nch-equipped-display"></span>' +
          '<button class="nch-close-btn" id="nch-close-btn">\u2715</button>' +
        '</div>' +
      '</div>' +
      '<div class="nch-content">' +
        // Zone 1: Hand
        '<div class="nch-zone nch-zone-hand">' +
          '<div class="nch-zone-label">EQUIPPED HAND</div>' +
          '<div class="nch-hand-container" id="nch-hand-container" data-dropzone="hand"></div>' +
        '</div>' +
        // Zone 2: Backup Deck (shuffle/sort moved here from removed draw bar)
        '<div class="nch-zone nch-zone-backup">' +
          '<div class="nch-zone-label">BACKUP DECK <span class="nch-backup-count" id="nch-backup-count"></span>' +
            '<button class="nch-shuffle-btn" id="nch-shuffle-btn" title="Shuffle deck order">\uD83D\uDD00</button>' +
            '<button class="nch-sort-btn" id="nch-sort-btn" title="Sort (requires Archive Indexer)" disabled>\uD83D\uDCD1</button>' +
          '</div>' +
          '<div class="nch-backup-scroll-wrapper">' +
            '<div class="nch-backup-scroller" id="nch-backup-scroller" data-dropzone="backup"></div>' +
          '</div>' +
        '</div>' +
        // Zone 3: Vault (account inventory, shared across platforms)
        '<div class="nch-zone nch-zone-vault">' +
          '<div class="nch-zone-label">CARD VAULT <small>(survives death \u00B7 shared across platforms)</small></div>' +
          '<div class="nch-vault-slots" id="nch-vault-slots" data-dropzone="vault"></div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(_expanded);

    // Close button
    var closeBtn = _expanded.querySelector('#nch-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        _collapse('close_btn');
      });
    }
  }

  // ─── EXPAND / COLLAPSE ──────────────────────────────────

  function _expand(reason) {
    _isExpanded = true;
    _prefs.expanded = true;
    _savePrefs();
    if (_capsule) _capsule.style.display = 'none';
    if (_expanded) _expanded.style.display = 'flex';
    _renderExpanded();
    // Ghost cursor removed (cursor: none + emoji cursor caused lag/confusion).
    // Keep normal system cursor when expanded.
  }

  function _collapse(reason) {
    _isExpanded = false;
    _prefs.expanded = false;
    _savePrefs();
    if (_expanded) _expanded.style.display = 'none';
    // Ghost cursor removed (keep normal cursor).
    // Capsule visibility handled by _pollVisibility
  }

  function setMinimized(minimized, reason) {
    if (minimized) _collapse(reason);
    else _expand(reason);
  }

  // ─── VISIBILITY POLLING ─────────────────────────────────

  function _pollVisibility() {
    var rogueActive = false;
    try {
      rogueActive = (typeof GoneRogue !== 'undefined' && GoneRogue.isActive && GoneRogue.isActive());
    } catch (e) {}

    var strActive = false;
    try {
      strActive = (typeof GoneRogue !== 'undefined' && GoneRogue.isStrCombatActive && GoneRogue.isStrCombatActive());
      if (!strActive && typeof STRCombatWindow !== 'undefined' && STRCombatWindow.isVisible) {
        strActive = !!STRCombatWindow.isVisible();
      }
    } catch (e) {}

    if (!rogueActive) {
      if (_capsule) _capsule.style.display = 'none';
      if (_expanded) _expanded.style.display = 'none';
      return;
    }

    // Lock during STR combat
    if (_expanded) {
      if (strActive) {
        _expanded.classList.add('nch-locked');
        _deactivateGhostCursor();
      } else {
        _expanded.classList.remove('nch-locked');
        // Ghost cursor removed (keep normal cursor).
      }
    }

    // BLVCK lifecycle: check on every poll tick (350ms) so inject/remove
    // reacts to resource changes, hand changes, and card movements.
    if (!strActive && typeof CardStateAuthority !== 'undefined' &&
        typeof CardStateAuthority.checkBlvckState === 'function') {
      try { CardStateAuthority.checkBlvckState(); } catch (blvckErr) {}
    }

    if (_isExpanded && !_combatCapsule) {
      if (_capsule) _capsule.style.display = 'none';
      if (_expanded) _expanded.style.display = 'flex';
    } else {
      if (_expanded) _expanded.style.display = 'none';
      if (_capsule) _capsule.style.display = 'flex';
      // Combat capsule: render card-aware emojis; normal: render jokers
      if (_combatCapsule) {
        _renderCombatCapsule();
      } else {
        _renderCapsule();
      }
    }

    // BAC floating popup is RETIRED — RogueSidebar (embedded in terminal
    // control rail) now owns the left-column card/item display.
    // Ensure BAC stays hidden so it doesn't overlap RogueSidebar.
    if (!strActive && typeof BackupActionContainer !== 'undefined' &&
        typeof BackupActionContainer.isVisible === 'function' &&
        BackupActionContainer.isVisible()) {
      BackupActionContainer.hide();
    }
  }

  // ─── DATA HELPERS ───────────────────────────────────────

  function _getHand() {
    if (typeof CardStateAuthority !== 'undefined') return CardStateAuthority.getHand();
    if (typeof GAMESTATE !== 'undefined' && GAMESTATE.getCardsInHand) return GAMESTATE.getCardsInHand();
    if (typeof NonCombatStateStore !== 'undefined' && NonCombatStateStore.getState) {
      var st = NonCombatStateStore.getState();
      return Array.isArray(st.cardsInHand) ? st.cardsInHand : [];
    }
    return [];
  }

  function _getBackup() {
    if (typeof CardStateAuthority !== 'undefined') return CardStateAuthority.getBackup();
    if (typeof GAMESTATE !== 'undefined' && GAMESTATE.getBackupCards) return GAMESTATE.getBackupCards();
    if (typeof NonCombatStateStore !== 'undefined' && NonCombatStateStore.getState) {
      var st = NonCombatStateStore.getState();
      return Array.isArray(st.backupCards) ? st.backupCards : [];
    }
    return [];
  }

  function _getMaxBackup() {
    if (typeof CardStateAuthority !== 'undefined') return CardStateAuthority.getMaxBackupSlots();
    if (typeof GAMESTATE !== 'undefined' && GAMESTATE.getMaxBackupSlots) return GAMESTATE.getMaxBackupSlots();
    return 25;
  }

  function _getVaultCards() {
    // Combine persistent items (ITM-*) + persistent cards (ACT-*) for unified vault view
    var items = [];
    var cards = [];
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getPersistentInventory === 'function') {
      var inv = GAMESTATE.getPersistentInventory();
      if (Array.isArray(inv)) items = inv;
    }
    if (typeof CardStateAuthority !== 'undefined') {
      cards = CardStateAuthority.getVault();
    } else if (typeof GAMESTATE !== 'undefined' && GAMESTATE.getPersistentCards) {
      var v = GAMESTATE.getPersistentCards();
      if (Array.isArray(v)) cards = v;
    }
    return items.concat(cards);
  }

  function _getCardDef(id) {
    // Try card registry first (ACT-*)
    if (typeof CardStateAuthority !== 'undefined') {
      var def = CardStateAuthority.getCardDef(id);
      if (def) return def;
    }
    if (typeof GoneRogueDataRegistry !== 'undefined') {
      if (GoneRogueDataRegistry.getCard) {
        var cDef = GoneRogueDataRegistry.getCard(id);
        if (cDef) return cDef;
      }
      // Fallback: try item registry (ITM-*) for vault items
      if (GoneRogueDataRegistry.getItem) {
        var iDef = GoneRogueDataRegistry.getItem(id);
        if (iDef) return iDef;
      }
    }
    return null;
  }

  function _isPrinterArmed() {
    // Delegate to centralized CostPrinterSystem
    if (typeof CostPrinterSystem !== 'undefined' && CostPrinterSystem.isPrinterArmed) {
      return CostPrinterSystem.isPrinterArmed();
    }
    return false;
  }

  function _isAmmoBatteryCard(cardDef) {
    try {
      if (!cardDef || !Array.isArray(cardDef.costs)) return false;
      for (var i = 0; i < cardDef.costs.length; i++) {
        if (cardDef.costs[i] && (cardDef.costs[i].kind === 'ammo' || cardDef.costs[i].kind === 'battery')) return true;
      }
    } catch (e) {}
    return false;
  }

  // ─── RENDER: MASTER ─────────────────────────────────────

  function _renderAll() {
    _renderCapsule();
    if (_isExpanded) _renderExpanded();
  }

  function _renderExpanded() {
    _renderEquipped();
    _renderHand();
    // No draw bar — removed from NCH architecture entirely.
    // Cards move seamlessly between backup/hand/vault via drag or left column.
    // Shuffle/sort buttons are now in the backup zone header.
    _renderBackup();
    _renderVault();
  }

  // ─── RENDER: EQUIPPED DISPLAY ───────────────────────────

  function _renderEquipped() {
    var el = _expanded ? _expanded.querySelector('#nch-equipped-display') : null;
    if (!el) return;
    var active = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getActiveItem) ? GAMESTATE.getActiveItem() : null;
    if (active && active.id) {
      var it = (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getItem) ? GoneRogueDataRegistry.getItem(active.id) : null;
      var emoji = (it && it.emoji ? it.emoji : '\uD83D\uDCE6');
      var name = (it && it.name ? it.name : active.id);
      el.innerHTML = '<span class="nch-equipped-emoji">' + emoji + '</span> ' + name;
      el.classList.add('nch-equipped-active');
      el.title = 'Click to toggle \u00B7 Drag to map or incinerator';
    } else {
      el.innerHTML = '<span class="nch-equipped-empty">\u00B7</span>';
      el.classList.remove('nch-equipped-active');
      el.title = 'No item equipped';
    }

    // Wire interactive handlers (only once)
    if (!el._equippedWired) {
      el._equippedWired = true;

      // Click to toggle/activate (mirrors header active-item-slot click)
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        _handleEquippedSlotClick();
      });

      // Pointer drag from equipped slot → map or incinerator
      el.addEventListener('pointerdown', function(e) {
        if (e.button !== undefined && e.button !== 0) return;
        var activeRef = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getActiveItem) ? GAMESTATE.getActiveItem() : null;
        if (!activeRef || !activeRef.id) return;
        var resolved = (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getItem)
          ? GoneRogueDataRegistry.getItem(activeRef.id) : null;
        _startDrag({
          kind: 'equipped_item',
          id: activeRef.id,
          index: -1,
          emoji: resolved ? resolved.emoji : '\uD83D\uDCE6',
          name: resolved ? resolved.name : activeRef.id
        }, e);
      });

      // Accept drops (equip from NCH card zones — drag card onto equipped slot)
      el.setAttribute('data-dropzone', 'equipped');
    }
  }

  /**
   * Handle click on the equipped item slot (NCH or header).
   * Mirrors the handleActiveItemClick logic from ui-controls.js:
   * inventory open → unequip; inventory closed → toggle/activate.
   */
  function _handleEquippedSlotClick() {
    if (typeof GAMESTATE === 'undefined') return;
    var activeRef = GAMESTATE.getActiveItem ? GAMESTATE.getActiveItem() : null;
    if (!activeRef || !activeRef.id) return;

    // Try toggling (3D Printer or other togglable items)
    var didToggle = false;
    try {
      if (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getItem) {
        var def = GoneRogueDataRegistry.getItem(activeRef.id);
        var isPrinter = false;
        if (def && Array.isArray(def.effects)) {
          for (var ei = 0; ei < def.effects.length; ei++) {
            if (def.effects[ei] && def.effects[ei].type === 'printer_3d') { isPrinter = true; break; }
          }
        }
        if (isPrinter && GAMESTATE.toggleActiveItemToggled) {
          var r = GAMESTATE.toggleActiveItemToggled();
          didToggle = !!(r && r.success);
          if (typeof TooltipSystem !== 'undefined') {
            TooltipSystem.show((r && r.toggled) ? '\uD83D\uDD4B 3D PRINTER ARMED' : '\uD83D\uDD4B 3D PRINTER DISARMED', 1500);
          }
        }
      }
    } catch (e0) {}

    if (!didToggle) {
      // Fallback: trigger active item use
      if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.triggerActiveItem === 'function') {
        GoneRogue.triggerActiveItem();
      } else {
        if (typeof TooltipSystem !== 'undefined') {
          TooltipSystem.show('Active: ' + (activeRef.id || 'item'), 1000);
        }
      }
    }
  }

  // ─── RENDER: HAND (Zone 1 — large cards) ────────────────

  function _renderHand() {
    var container = _expanded ? _expanded.querySelector('#nch-hand-container') : null;
    if (!container) return;
    container.innerHTML = '';

    var hand = _getHand();
    var printerArmed = _isPrinterArmed();

    if (hand.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'nch-hand-empty';
      empty.textContent = 'Drag cards here from backup or vault';
      empty.style.cssText = 'color:rgba(28,255,155,0.4);font-family:"Courier New",monospace;font-size:12px;padding:40px 16px;text-align:center;width:100%;';
      container.appendChild(empty);
      return;
    }

    var blvckId2 = (typeof CardStateAuthority !== 'undefined' && CardStateAuthority.BLVCK_ID)
      ? CardStateAuthority.BLVCK_ID : 'ACT-000';

    for (var i = 0; i < hand.length; i++) {
      var ref = hand[i];
      if (!ref || !ref.id) continue;

      var isBlvck = (ref.id === blvckId2);
      var cardDef = _getCardDef(ref.id);
      var merged = Object.assign({}, cardDef || {}, { id: ref.id, qty: ref.qty });

      var wrapper;
      if (isBlvck) {
        // BLVCK struggle card: dark, minimal, distinctive
        wrapper = document.createElement('div');
        wrapper.className = 'hand-card-wrapper nch-blvck-card';
        wrapper.innerHTML =
          '<div class="hand-card" style="background:rgba(20,20,20,0.95);border-color:rgba(80,80,80,0.5);">' +
            '<div class="hand-card-artwork"><div class="hand-card-emoji" style="filter:grayscale(1) brightness(0.4);font-size:28px;">\u25A0</div></div>' +
            '<div class="hand-card-name" style="color:rgba(120,120,120,0.8);font-size:10px;">BLVCK</div>' +
          '</div>';
      } else if (typeof SharedCardRenderer !== 'undefined' && SharedCardRenderer.createCardElement) {
        wrapper = SharedCardRenderer.createCardElement(merged, i, 'nch-hand');
      } else {
        wrapper = document.createElement('div');
        wrapper.className = 'hand-card-wrapper';
        wrapper.innerHTML = '<div class="hand-card"><div class="hand-card-artwork"><div class="hand-card-emoji">' + (merged.emoji || '\uD83C\uDCCF') + '</div></div><div class="hand-card-name">' + (merged.name || ref.id) + '</div></div>';
      }

      // Qty badge
      if (ref.qty && ref.qty > 1) {
        var qBadge = document.createElement('div');
        qBadge.className = 'nch-qty-badge';
        qBadge.textContent = 'x' + ref.qty;
        qBadge.style.cssText = 'position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.8);color:#fff;font-size:10px;padding:1px 4px;border-radius:4px;z-index:5;';
        wrapper.style.position = 'relative';
        wrapper.appendChild(qBadge);
      }

      // 3D printer badge — dynamic suffix from CostPrinterSystem
      if (printerArmed && cardDef) {
        var _pSuffix = (typeof CostPrinterSystem !== 'undefined' && CostPrinterSystem.getDisplaySuffix)
          ? CostPrinterSystem.getDisplaySuffix(cardDef) : '';
        if (_pSuffix) {
          wrapper.classList.add('printer-eligible');
          var px2 = document.createElement('span');
          px2.className = 'printer-x2';
          px2.textContent = _pSuffix;
          wrapper.appendChild(px2);
        }
      }

      // Drag handler
      (function(idx, cardRef, cDef) {
        wrapper.addEventListener('pointerdown', function(e) {
          if (e.button !== undefined && e.button !== 0) return;
          if (_expanded && _expanded.classList.contains('nch-locked')) return;
          var em = (cDef && cDef.emoji) ? cDef.emoji : '\uD83C\uDCCF';
          _startDrag({ kind: 'hand', index: idx, id: cardRef.id, emoji: em }, e);
        });
      })(i, ref, cardDef);

      container.appendChild(wrapper);
    }
  }

  // ─── SORT ITEM GATING ──────────────────────────────────

  function _isSortUnlocked() {
    try {
      if (typeof GAMESTATE !== 'undefined' && GAMESTATE.getActiveItem) {
        var ar = GAMESTATE.getActiveItem();
        if (ar && ar.id) {
          var idef = (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getItem) ? GoneRogueDataRegistry.getItem(ar.id) : null;
          if (idef && Array.isArray(idef.effects)) {
            for (var i = 0; i < idef.effects.length; i++) {
              if (idef.effects[i] && idef.effects[i].type === 'sort_hand') return true;
            }
          }
        }
      }
    } catch (e) {}
    return false;
  }

  // ─── DRAW BAR — REMOVED FROM NCH ─────────────────────────
  // Draw bar zone no longer exists in NCH DOM.
  // Cards move seamlessly via left column (backup deck top / items toggle)
  // and drag-drop between backup scroll ↔ hand ↔ vault.
  // In STR-combat, draw is handled by left column slot 6 with item-specific
  // ghost cursors (🃏 default, 🔍 magnifying glass, card emoji for true joker).

  var DRAW_BAR_SIZE = 5; // kept for legacy reference

  /** @deprecated — Draw bar removed from NCH. Legacy code kept as dead path. */
  function _renderDrawBar() {
    var drawbar = _expanded ? _expanded.querySelector('#nch-drawbar') : null;
    var countEl = _expanded ? _expanded.querySelector('#nch-draw-count') : null;
    var shuffleBtn = _expanded ? _expanded.querySelector('#nch-shuffle-btn') : null;
    var sortBtn = _expanded ? _expanded.querySelector('#nch-sort-btn') : null;
    if (!drawbar) return;
    drawbar.innerHTML = '';

    var backup = _getBackup();
    var sortUnlocked = _isSortUnlocked();
    var isLocked = !!(_expanded && _expanded.classList.contains('nch-locked'));

    // Update count
    if (countEl) countEl.textContent = '(' + backup.length + ')';

    // Toggle shuffle/sort buttons based on item
    if (shuffleBtn) {
      shuffleBtn.style.display = sortUnlocked ? 'none' : 'inline-block';
      shuffleBtn.disabled = isLocked || backup.length < 2;
      if (!shuffleBtn._bound) {
        shuffleBtn._bound = true;
        shuffleBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          _onShuffleClick();
        });
      }
    }
    if (sortBtn) {
      sortBtn.disabled = !sortUnlocked || isLocked || backup.length < 2;
      sortBtn.style.display = sortUnlocked ? 'inline-block' : 'inline-block';
      sortBtn.title = sortUnlocked ? 'Sort backup deck' : 'Requires Archive Indexer (\uD83D\uDCD1)';
      if (!sortBtn._bound) {
        sortBtn._bound = true;
        sortBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          _onSortClick();
        });
      }
    }

    // Empty state
    if (backup.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'nch-drawbar-empty';
      empty.textContent = 'No cards to draw';
      drawbar.appendChild(empty);
      return;
    }

    // Render draw buttons (top N cards from backup)
    var count = Math.min(DRAW_BAR_SIZE, backup.length);
    for (var i = 0; i < count; i++) {
      var ref = backup[i];
      if (!ref || !ref.id) continue;

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'nch-draw-btn';
      if (isLocked) btn.disabled = true;

      if (sortUnlocked) {
        // Face-up: show card identity
        btn.classList.add('face-up');
        var cardDef = _getCardDef(ref.id);
        var emoji = (cardDef && cardDef.emoji) ? cardDef.emoji : '\uD83C\uDCCF';
        var name = (cardDef && cardDef.name) ? cardDef.name : ref.id;
        var quality = String((cardDef && (cardDef.quality || cardDef.qualityName)) || 'standard').toLowerCase();

        var emojiSpan = document.createElement('span');
        emojiSpan.className = 'nch-draw-btn-emoji';
        emojiSpan.textContent = emoji;
        btn.appendChild(emojiSpan);

        var nameSpan = document.createElement('span');
        nameSpan.className = 'nch-draw-btn-name';
        nameSpan.textContent = name.length > 8 ? name.substring(0, 7) + '\u2026' : name;
        btn.appendChild(nameSpan);

        // Quality border color
        if (typeof SharedCardRenderer !== 'undefined' && SharedCardRenderer.getQualityBorderColor) {
          btn.style.borderColor = SharedCardRenderer.getQualityBorderColor(quality);
        }
      } else {
        // Face-down: joker card back
        btn.innerHTML = '<span class="nch-draw-btn-joker">\uD83C\uDCCF</span>';
      }

      btn.title = sortUnlocked ? (name || ref.id) : 'Draw card (face down)';
      btn.setAttribute('data-backup-index', String(i));

      // Click + hover handlers (closure)
      (function(idx, cardRef) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          if (isLocked) return;
          _onDrawButtonClick(idx);
        });
        // Ghost cursor feedback on hover
        btn.addEventListener('mouseenter', function() {
          var def = _getCardDef(cardRef.id);
          var em = (def && def.emoji) ? def.emoji : null;
          _updateGhostForHover(em);
          btn.classList.add('nch-draw-btn-hover');
        });
        btn.addEventListener('mouseleave', function() {
          _updateGhostForHover(null);
          btn.classList.remove('nch-draw-btn-hover');
        });
      })(i, ref);

      drawbar.appendChild(btn);
    }

    // Remaining indicator
    if (backup.length > DRAW_BAR_SIZE) {
      var more = document.createElement('div');
      more.className = 'nch-drawbar-more';
      more.textContent = '+' + (backup.length - DRAW_BAR_SIZE) + ' more';
      drawbar.appendChild(more);
    }
  }

  // ─── DRAW BAR ACTIONS ─────────────────────────────────────

  /** @deprecated — Draw bar hidden in NCH. Kept for legacy draw bar if re-enabled. */
  function _onDrawButtonClick(backupIndex) {
    // Route through CardStateAuthority
    if (typeof CardStateAuthority !== 'undefined') {
      var hand = CardStateAuthority.getHand();
      if (hand.length >= CardStateAuthority.getMaxHandSize()) {
        CardStateAuthority.pushOldestHandToBackup();
      }
      CardStateAuthority.moveBackupToHand(backupIndex);
    } else if (typeof GAMESTATE !== 'undefined') {
      var hand2 = _getHand();
      var maxHand = 5;
      try { if (GAMESTATE.getState) { var s = GAMESTATE.getState(); maxHand = s.maxHandSize || 5; } } catch (e) {}
      if (hand2.length >= maxHand) {
        try { GAMESTATE.pushOldestHandCardToBackup(); } catch (e) {}
      }
      try { GAMESTATE.moveBackupIndexToHand(backupIndex); } catch (e) {}
    }
    if (typeof TooltipSystem !== 'undefined') {
      TooltipSystem.showPersistent('\uD83C\uDCCF DRAWN \u2192 HAND', 700);
    }
    setTimeout(function() { _renderAll(); }, 150);
  }

  function _onShuffleClick() {
    if (typeof CardStateAuthority !== 'undefined') {
      CardStateAuthority.shuffleBackup();
    } else if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.shuffleBackupDeck === 'function') {
      GAMESTATE.shuffleBackupDeck();
    }
    if (typeof TooltipSystem !== 'undefined') {
      TooltipSystem.showPersistent('\uD83D\uDD00 Deck shuffled', 700);
    }
  }

  function _onSortClick() {
    if (!_isSortUnlocked()) return;
    if (typeof CardStateAuthority !== 'undefined') {
      CardStateAuthority.sortBackup('quality');
    } else if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.sortBackupDeck === 'function') {
      GAMESTATE.sortBackupDeck('quality');
    }
    if (typeof TooltipSystem !== 'undefined') {
      TooltipSystem.showPersistent('\uD83D\uDCD1 Deck sorted by quality', 700);
    }
  }

  // ─── GHOST JOKER CURSOR ───────────────────────────────────

  var _ghostEl = null;
  var _ghostMoveHandler = null;

  function _activateGhostCursor() {
    if (_ghostEl) return; // already active

    _ghostEl = document.createElement('div');
    _ghostEl.className = 'nch-ghost-joker';
    _ghostEl.textContent = '\uD83C\uDCCF';
    document.body.appendChild(_ghostEl);
    document.body.classList.add('nch-ghost-cursor-active');

    _ghostMoveHandler = function(e) {
      if (_ghostEl) {
        _ghostEl.style.left = (e.clientX + 14) + 'px';
        _ghostEl.style.top = (e.clientY + 14) + 'px';
      }
    };
    document.addEventListener('pointermove', _ghostMoveHandler);
  }

  function _deactivateGhostCursor() {
    if (_ghostEl && _ghostEl.parentNode) {
      _ghostEl.parentNode.removeChild(_ghostEl);
    }
    _ghostEl = null;
    document.body.classList.remove('nch-ghost-cursor-active');
    if (_ghostMoveHandler) {
      document.removeEventListener('pointermove', _ghostMoveHandler);
      _ghostMoveHandler = null;
    }
  }

  function _updateGhostForHover(cardEmoji) {
    if (!_ghostEl) return;
    if (cardEmoji && _isSortUnlocked()) {
      _ghostEl.textContent = cardEmoji;
      _ghostEl.classList.add('nch-ghost-known');
    } else {
      _ghostEl.textContent = '\uD83C\uDCCF';
      _ghostEl.classList.remove('nch-ghost-known');
    }
  }

  // ─── RENDER: BACKUP DECK (Zone 2 — scrollable band) ─────

  function _renderBackup() {
    var scroller = _expanded ? _expanded.querySelector('#nch-backup-scroller') : null;
    var countEl = _expanded ? _expanded.querySelector('#nch-backup-count') : null;
    if (!scroller) return;
    scroller.innerHTML = '';

    var backup = _getBackup();
    var maxB = _getMaxBackup();
    var printerArmed = _isPrinterArmed();
    var sortUnlocked = _isSortUnlocked();
    var isLocked = !!(_expanded && _expanded.classList.contains('nch-locked'));

    // Count only non-null entries with valid IDs (skip phantom/null slots)
    var _realCount = 0;
    for (var ci = 0; ci < backup.length; ci++) {
      if (backup[ci] && backup[ci].id) _realCount++;
    }
    if (countEl) countEl.textContent = _realCount + '/' + maxB;

    // Bind shuffle/sort buttons (in backup zone header, bound once)
    var shuffleBtn = _expanded ? _expanded.querySelector('#nch-shuffle-btn') : null;
    var sortBtn = _expanded ? _expanded.querySelector('#nch-sort-btn') : null;
    if (shuffleBtn) {
      shuffleBtn.style.display = sortUnlocked ? 'none' : 'inline-block';
      shuffleBtn.disabled = isLocked || backup.length < 2;
      if (!shuffleBtn._bound) {
        shuffleBtn._bound = true;
        shuffleBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          _onShuffleClick();
        });
      }
    }
    if (sortBtn) {
      sortBtn.disabled = !sortUnlocked || isLocked || backup.length < 2;
      sortBtn.style.display = sortUnlocked ? 'inline-block' : 'inline-block';
      sortBtn.title = sortUnlocked ? 'Sort backup deck' : 'Requires Archive Indexer (\uD83D\uDCD1)';
      if (!sortBtn._bound) {
        sortBtn._bound = true;
        sortBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          _onSortClick();
        });
      }
    }

    if (backup.length === 0) {
      var empty = document.createElement('div');
      empty.style.cssText = 'color:rgba(28,255,155,0.3);font-family:"Courier New",monospace;font-size:11px;padding:20px 12px;';
      empty.textContent = 'Backup deck empty';
      scroller.appendChild(empty);
      return;
    }

    for (var i = 0; i < backup.length; i++) {
      var ref = backup[i];
      if (!ref || !ref.id) continue;
      var cardDef = _getCardDef(ref.id);
      var merged = Object.assign({}, cardDef || {}, { id: ref.id, qty: ref.qty });

      var wrapper;
      if (typeof SharedCardRenderer !== 'undefined' && SharedCardRenderer.createCardElement) {
        wrapper = SharedCardRenderer.createCardElement(merged, i, 'nch-backup');
      } else {
        wrapper = document.createElement('div');
        wrapper.className = 'hand-card-wrapper';
        wrapper.innerHTML = '<div class="hand-card"><div class="hand-card-artwork"><div class="hand-card-emoji">' + (merged.emoji || '\uD83C\uDCCF') + '</div></div><div class="hand-card-name">' + (merged.name || ref.id) + '</div></div>';
      }

      // Progressive visual aging: newest (left, i=0) bright, oldest (right) faded + desaturated
      var depthRatio = backup.length > 1 ? i / (backup.length - 1) : 0;
      var agingOpacity = 1.0 - (depthRatio * 0.6); // 1.0 → 0.4
      var agingGrayscale = depthRatio * 0.5;        // 0 → 0.5
      var agingDrift = depthRatio * 2;               // 0px → 2px downward drift
      wrapper.style.opacity = String(Math.max(0.3, agingOpacity));
      wrapper.style.filter = 'grayscale(' + agingGrayscale.toFixed(2) + ')';
      wrapper.style.transform = 'translateY(' + agingDrift.toFixed(1) + 'px)';

      // Legacy class hooks
      if (depthRatio > 0.7) {
        wrapper.classList.add('nch-backup-old');
      }
      if (depthRatio > 0.9) {
        wrapper.classList.add('nch-backup-dying');
      }

      // Store card ID on element for shift animation tracking
      wrapper.dataset.cardId = ref.id;

      // 3D printer badge — dynamic suffix from CostPrinterSystem
      if (printerArmed && cardDef) {
        var _pSuffix2 = (typeof CostPrinterSystem !== 'undefined' && CostPrinterSystem.getDisplaySuffix)
          ? CostPrinterSystem.getDisplaySuffix(cardDef) : '';
        if (_pSuffix2) {
          wrapper.classList.add('printer-eligible');
          var px2 = document.createElement('span');
          px2.className = 'printer-x2';
          px2.textContent = _pSuffix2;
          wrapper.appendChild(px2);
        }
      }

      // Drag handler
      (function(idx, cardRef, cDef) {
        wrapper.addEventListener('pointerdown', function(e) {
          if (e.button !== undefined && e.button !== 0) return;
          if (_expanded && _expanded.classList.contains('nch-locked')) return;
          var em = (cDef && cDef.emoji) ? cDef.emoji : '\uD83C\uDCCF';
          _startDrag({ kind: 'backup', index: idx, id: cardRef.id, emoji: em }, e);
        });
      })(i, ref, cardDef);

      scroller.appendChild(wrapper);
    }

    // ── Empty placeholder slots (BLVCK-style) for onboarding + larger drop target ──
    // Show a few ghost slots after the real cards so the backup zone always has
    // a usable drop area even when nearly empty. Non-interactive (no drag/click).
    var MIN_VISIBLE_SLOTS = 5; // minimum total visible slots in backup zone
    var placeholdersNeeded = Math.max(0, MIN_VISIBLE_SLOTS - _realCount);
    // Cap to available capacity
    var capacityRemaining = Math.max(0, maxB - _realCount);
    placeholdersNeeded = Math.min(placeholdersNeeded, capacityRemaining);

    for (var pi = 0; pi < placeholdersNeeded; pi++) {
      var ph = document.createElement('div');
      ph.className = 'hand-card-wrapper nch-backup-placeholder';
      ph.style.cssText = 'opacity:0.18;pointer-events:none;user-select:none;';
      ph.innerHTML = '<div class="hand-card" style="border:1px dashed rgba(28,255,155,0.25);background:rgba(0,0,0,0.15);">' +
        '<div class="hand-card-artwork"><div class="hand-card-emoji" style="opacity:0.3;">🃏</div></div>' +
        '<div class="hand-card-name" style="opacity:0.3;font-size:9px;">empty</div></div>';
      scroller.appendChild(ph);
    }
  }

  // ─── RENDER: VAULT (Zone 3 — persistent card slots) ─────

  function _renderVault() {
    var container = _expanded ? _expanded.querySelector('#nch-vault-slots') : null;
    if (!container) return;
    container.innerHTML = '';

    var vaultCards = _getVaultCards();
    var maxSlots = 12;
    try {
      if (typeof GAMESTATE !== 'undefined' && GAMESTATE.getGameState) {
        var gs = GAMESTATE.getGameState();
        if (gs && gs.maxPersistentSlots) maxSlots = gs.maxPersistentSlots;
      }
    } catch (e) {}

    var total = Math.max(vaultCards.length, maxSlots);

    for (var i = 0; i < total; i++) {
      var ref = vaultCards[i] || null;
      var slot = document.createElement('div');
      slot.className = 'nch-vault-slot' + (ref && ref.id ? ' occupied' : ' empty');
      slot.dataset.vaultIndex = i;

      if (ref && ref.id) {
        // SharedItemRenderer resolves item/card with full fallback chain
        var resolved = (typeof SharedItemRenderer !== 'undefined')
          ? SharedItemRenderer.resolve(ref)
          : { emoji: '🃏', name: ref.id, isItem: (ref.id.indexOf('ITM-') === 0), def: null };
        var isItem = resolved.isItem;
        var em = resolved.emoji;
        var nm = resolved.name;

        // Default face: items show their emoji, cards show joker back
        var face = document.createElement('div');
        face.className = 'nch-vault-joker';
        face.textContent = isItem ? em : '\uD83C\uDCCF'; // Items: actual emoji, Cards: 🃏
        slot.appendChild(face);

        // Portrait (visible on hover) — always show full detail
        var portrait = document.createElement('div');
        portrait.className = 'nch-vault-portrait';
        portrait.innerHTML = '<div style="font-size:20px;">' + em + '</div><div style="font-size:8px;color:rgba(191,255,227,0.9);margin-top:2px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:54px;">' + nm + '</div>';
        slot.appendChild(portrait);

        // Drag handler — ITM-items use kind:'persistent_item' (index into inventoryPersistent),
        // ACT-cards use kind:'vault' (index into persistentCards array).
        var defToUse = resolved.def;
        (function(idx, cardRef, def0, itemFlag) {
          slot.addEventListener('pointerdown', function(e) {
            if (e.button !== undefined && e.button !== 0) return;
            if (_expanded && _expanded.classList.contains('nch-locked')) return;
            var emj = (def0 && def0.emoji) ? def0.emoji : '\uD83C\uDCCF';
            if (itemFlag) {
              // Persistent inventory item — index IS the inventoryPersistent index
              // (items are prepended in _getVaultCards before cards)
              _startDrag({ kind: 'persistent_item', index: idx, id: cardRef.id, emoji: emj }, e);
            } else {
              // Card — subtract item count to get persistentCards index
              var itemCount = 0;
              try {
                var pInv = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getPersistentInventory) ? GAMESTATE.getPersistentInventory() : [];
                itemCount = Array.isArray(pInv) ? pInv.length : 0;
              } catch (ic) {}
              _startDrag({ kind: 'vault', index: idx - itemCount, id: cardRef.id, emoji: emj }, e);
            }
          });
        })(i, ref, defToUse, isItem);
      } else {
        slot.textContent = '\u2014'; // —
      }

      // Drop target for vault slots
      container.appendChild(slot);
    }
  }

  // ─── DRAG & DROP ────────────────────────────────────────

  function _startDrag(payload, e) {
    if (_drag) return; // already dragging
    try { console.log('[NCH:Drag] START', payload.kind, payload.index, payload.id); } catch (d) {}

    _drag = Object.assign({
      ghostEl: null,
      startX: e.clientX,
      startY: e.clientY,
      dragging: false
    }, payload);

    try { e.preventDefault(); } catch (ex) {}
    try { e.stopPropagation(); } catch (ex) {}

    document.addEventListener('pointermove', _onDragMove);
    document.addEventListener('pointerup', _onDragUp);
    document.addEventListener('pointercancel', _onDragUp);
  }

  // Expose for external drags (from left column / reserve slots)
  function startExternalDrag(payload, e) {
    // Normalize field names: rogue-sidebar sends 'backupIndex', NCH uses 'index'
    if (payload && payload.backupIndex !== undefined && payload.index === undefined) {
      payload.index = payload.backupIndex;
    }
    _startDrag(payload, e);
    // Force expand NCH so drop zones are visible
    if (!_isExpanded) _expand('external_drag');
  }

  function _ensureGhost(x, y) {
    if (!_drag || _drag.ghostEl) return;
    var ghost = document.createElement('div');
    ghost.className = 'nch-drag-ghost';
    ghost.textContent = _drag.emoji || '\uD83C\uDCCF';
    ghost.style.left = x + 'px';
    ghost.style.top = y + 'px';
    document.body.appendChild(ghost);
    _drag.ghostEl = ghost;
  }

  // ── Temp-minimize during drag (collapse NCH to reveal map) ──
  var _dragMinimizeTimer = null;
  var _dragTempMinimized = false;
  var _dragWasExpanded = false;
  var DRAG_MINIMIZE_DELAY = 1500; // ms outside NCH before collapse
  var DRAG_OUTSIDE_MARGIN = 80;   // px margin from NCH edge

  // ── Debrief feed disposal hover state ──
  var _dragOverDebrief = false;
  var _debriefScreenEl = null; // cached ref to #debrief-screen

  function _isDragOutsideNCH(px, py) {
    if (!_expanded || _expanded.style.display === 'none') return true;
    var rect = _expanded.getBoundingClientRect();
    return (px < rect.left - DRAG_OUTSIDE_MARGIN || px > rect.right + DRAG_OUTSIDE_MARGIN ||
            py < rect.top - DRAG_OUTSIDE_MARGIN || py > rect.bottom + DRAG_OUTSIDE_MARGIN);
  }

  function _clearDragMinimizeTimer() {
    if (_dragMinimizeTimer) { clearTimeout(_dragMinimizeTimer); _dragMinimizeTimer = null; }
  }

  function _startDragMinimizeTimer() {
    _clearDragMinimizeTimer();
    _dragMinimizeTimer = setTimeout(function() {
      if (_drag && _drag.dragging && !_dragTempMinimized && _isExpanded) {
        _dragTempMinimized = true;
        _collapse('drag_temp');
      }
    }, DRAG_MINIMIZE_DELAY);
  }

  function _restoreDragMinimize() {
    _clearDragMinimizeTimer();
    if (_dragTempMinimized && _dragWasExpanded) {
      _dragTempMinimized = false;
      _dragWasExpanded = false;
      _expand('drag_restore');
    } else {
      _dragTempMinimized = false;
      _dragWasExpanded = false;
    }
  }

  // ── Debrief disposal hover helpers ──
  function _getDebriefScreen() {
    if (!_debriefScreenEl) _debriefScreenEl = document.getElementById('debrief-screen');
    return _debriefScreenEl;
  }

  function _isDragOverDebriefFeed(clientX, clientY) {
    var ds = _getDebriefScreen();
    if (!ds) return false;
    var r = ds.getBoundingClientRect();
    return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
  }

  function _setDebriefDisposingPreview(show) {
    var ds = _getDebriefScreen();
    if (!ds) return;
    if (show && !_dragOverDebrief) {
      _dragOverDebrief = true;
      ds.classList.add('context-disposing');
    } else if (!show && _dragOverDebrief) {
      _dragOverDebrief = false;
      ds.classList.remove('context-disposing');
    }
  }

  function _clearDebriefDisposingPreview() {
    _dragOverDebrief = false;
    var ds = _getDebriefScreen();
    if (ds) ds.classList.remove('context-disposing');
  }

  function _onDragMove(e) {
    if (!_drag) return;
    var dx = e.clientX - _drag.startX;
    var dy = e.clientY - _drag.startY;
    if (!_drag.dragging && Math.sqrt(dx * dx + dy * dy) > 6) {
      _drag.dragging = true;
      _ensureGhost(e.clientX, e.clientY);
      _highlightDropZones(true);
      // Remember expanded state at drag start
      _dragWasExpanded = _isExpanded;
    }
    if (_drag.dragging && _drag.ghostEl) {
      _drag.ghostEl.style.left = e.clientX + 'px';
      _drag.ghostEl.style.top = e.clientY + 'px';

      // Debrief feed disposal preview (recycling bin hover)
      _setDebriefDisposingPreview(_isDragOverDebriefFeed(e.clientX, e.clientY));

      // Temp-minimize: if pointer stays outside NCH for DRAG_MINIMIZE_DELAY
      if (!_dragTempMinimized && _isExpanded && _isDragOutsideNCH(e.clientX, e.clientY)) {
        if (!_dragMinimizeTimer) _startDragMinimizeTimer();
      } else if (!_dragTempMinimized && !_isDragOutsideNCH(e.clientX, e.clientY)) {
        // Pointer back inside → cancel timer
        _clearDragMinimizeTimer();
      }
    }
  }

  function _highlightDropZones(show) {
    if (!_expanded) return;
    var zones = _expanded.querySelectorAll('[data-dropzone]');
    for (var i = 0; i < zones.length; i++) {
      if (show) zones[i].classList.add('nch-drop-active');
      else zones[i].classList.remove('nch-drop-active', 'nch-drop-highlight');
    }
  }

  function _onDragUp(e) {
    if (!_drag) return;

    document.removeEventListener('pointermove', _onDragMove);
    document.removeEventListener('pointerup', _onDragUp);
    document.removeEventListener('pointercancel', _onDragUp);
    _clearDragMinimizeTimer();
    _clearDebriefDisposingPreview();

    // Clean up ghost
    if (_drag.ghostEl && _drag.ghostEl.parentNode) {
      _drag.ghostEl.parentNode.removeChild(_drag.ghostEl);
    }

    _highlightDropZones(false);

    if (!_drag.dragging) {
      _restoreDragMinimize();
      _drag = null;
      return;
    }

    // Determine drop target
    var el = null;
    try { el = document.elementFromPoint(e.clientX, e.clientY); } catch (ex) {}

    // NCH internal drop zones
    var droppedOnHand = !!(el && el.closest && el.closest('[data-dropzone="hand"]'));
    var droppedOnBackup = !!(el && el.closest && el.closest('[data-dropzone="backup"]'));
    var droppedOnVault = !!(el && el.closest && el.closest('[data-dropzone="vault"]'));

    // Left column — detect BAC (legacy), RogueSidebar (data attr), or #control-rail
    var sidebarEl = el && el.closest ? (
      el.closest('[data-rogue-sidebar-active="1"]') ||
      el.closest('#backup-action-container') ||
      el.closest('#control-rail')
    ) : null;
    var droppedOnLeftCol = !!sidebarEl;

    // Determine RogueSidebar's current view (items vs cards)
    var leftColMode = 'items'; // default = vault
    if (droppedOnLeftCol) {
      // Primary: read DOM attribute stamped by RogueSidebar each render
      var sidebarViewEl = sidebarEl.closest('[data-rogue-sidebar-view]') ||
                          (sidebarEl.querySelector ? sidebarEl.querySelector('[data-rogue-sidebar-view]') : null) ||
                          sidebarEl;
      var domView = sidebarViewEl ? sidebarViewEl.getAttribute('data-rogue-sidebar-view') : null;
      if (domView === 'cards') {
        leftColMode = 'backup';
      } else if (domView === 'items') {
        leftColMode = 'items';
      } else {
        // Fallback: query RogueSidebar JS API directly
        try {
          if (typeof RogueSidebar !== 'undefined' && RogueSidebar.getView) {
            if (RogueSidebar.getView() === 'cards') leftColMode = 'backup';
          }
        } catch (rsErr) {}
        // BAC fallback (legacy)
        if (typeof BackupActionContainer !== 'undefined' && BackupActionContainer.getSlot5Mode) {
          var bacMode = BackupActionContainer.getSlot5Mode();
          if (bacMode === 'backup') leftColMode = 'backup';
        }
      }
    }
    // Left column in items mode = vault; in cards/backup mode = backup
    var droppedOnLeftVault = droppedOnLeftCol && (leftColMode === 'items');
    var droppedOnLeftBackup = droppedOnLeftCol && (leftColMode === 'backup');

    // NCH capsule (minimized state) — for cascade-to-hand-top
    var droppedOnCapsule = !!(el && el.closest && el.closest('.nch-capsule-wrapper'));

    // Equipped item slot (either NCH equipped display or header active-item-slot)
    var droppedOnEquippedSlot = !!(el && (
      (el.id === 'nch-equipped-display' || (el.closest && el.closest('#nch-equipped-display'))) ||
      (el.id === 'active-item-slot' || el.id === 'active-item-display' || (el.closest && el.closest('#active-item-slot')))
    ));

    var ok = false;
    var _useCTM = (typeof CardTransferManager !== 'undefined');
    var _useCSA = (typeof CardStateAuthority !== 'undefined');

    // Debug trace — drop zone detection
    try {
      console.log('[NCH:DragDrop]', _drag.kind, _drag.index, _drag.id,
        '→ el:', el ? el.tagName + '.' + el.className.split(' ')[0] : 'null',
        '| hand:', droppedOnHand, 'backup:', droppedOnBackup, 'vault:', droppedOnVault,
        'leftCol:', droppedOnLeftCol, 'leftMode:', leftColMode,
        'capsule:', droppedOnCapsule, 'CTM:', _useCTM, 'CSA:', _useCSA);
    } catch (dbg) {}

    // ── BLVCK GUARD: struggle card cannot leave the hand ──
    // Dragging BLVCK anywhere just snaps it back; it's a transient placeholder.
    var _blvckId = (typeof CardStateAuthority !== 'undefined' && CardStateAuthority.BLVCK_ID)
      ? CardStateAuthority.BLVCK_ID : 'ACT-000';
    if (_drag.kind === 'hand' && _drag.id === _blvckId) {
      _showDragResult(false, null, '🃏 BLVCK can\u2019t be moved');
      _restoreDragMinimize();
      _drag = null;
      _renderAll();
      return;
    }

    // ── ANY → EQUIPPED SLOT (equip item by dragging onto header or NCH equipped display) ──
    if (droppedOnEquippedSlot && _drag.id) {
      // Validate: only items with equipSlot "active" can go in the equipped slot.
      // Cards, passive items, consumables with equipSlot "none" are rejected.
      var _canEquip = (typeof GAMESTATE !== 'undefined' && GAMESTATE.isEquippable)
        ? GAMESTATE.isEquippable(_drag.id) : true;
      if (!_canEquip) {
        _showDragResult(false, null, 'Can\u2019t equip this');
        _restoreDragMinimize();
        _drag = null;
        _renderAll();
        return;
      }
      // Items from persistent inventory can be equipped
      if (_drag.kind === 'persistent_item' || _drag.kind === 'vault') {
        if (typeof GAMESTATE !== 'undefined' && GAMESTATE.setActiveItem) {
          GAMESTATE.setActiveItem({ id: _drag.id, qty: 1 });
          ok = true;
        }
      }
      if (ok) {
        // Trigger equip-flash on header display
        _flashHeaderEquipSlot();
        _showDragResult(true, 'Equipped!', null);
        _restoreDragMinimize();
        _drag = null;
        _renderAll();
        return;
      }
    }

    // ── HAND → BACKUP (NCH backup zone OR left column in backup mode) ──
    // Guard: if the left column is in items mode (vault target), don't intercept as backup
    // even if the NCH backup zone visually overlaps. Left vault takes priority.
    if (_drag.kind === 'hand' && (droppedOnBackup || droppedOnLeftBackup) && !droppedOnLeftVault) {
      if (_useCTM) {
        ok = CardTransferManager.handToBackup(_drag.index);
      } else if (_useCSA) {
        ok = CardStateAuthority.moveHandToBackup(_drag.index);
      }
      try { console.log('[NCH:DragDrop] hand→backup result:', ok); } catch (d) {}
      _showDragResult(ok, 'Moved to backup', 'Backup full or invalid');
      _restoreDragMinimize();
      _drag = null;
      _renderAll();
      // BAC retired — RogueSidebar updates via csa-event listener
      return;
    }

    // ── BACKUP → HAND (with cascade: if hand is full, pushes oldest card to backup) ──
    if (_drag.kind === 'backup' && (droppedOnHand || droppedOnCapsule)) {
      if (_useCSA && typeof CardStateAuthority.cascadeBackupToHandTop === 'function') {
        ok = CardStateAuthority.cascadeBackupToHandTop(_drag.index);
      } else if (_useCTM) {
        ok = CardTransferManager.backupToHand(_drag.index);
      } else if (_useCSA) {
        ok = CardStateAuthority.moveBackupToHand(_drag.index);
      }
      _showDragResult(ok, 'Moved to hand', 'Cannot move to hand');
      _restoreDragMinimize();
      _drag = null;
      _renderAll();
      // BAC retired — RogueSidebar updates via csa-event listener
      return;
    }

    // ── HAND → VAULT (NCH vault zone OR left column in items mode) ──
    if (_drag.kind === 'hand' && (droppedOnVault || droppedOnLeftVault)) {
      if (_useCTM) {
        ok = CardTransferManager.handToVault(_drag.index, 1);
      } else if (_useCSA) {
        ok = CardStateAuthority.moveHandToVault(_drag.index, 1);
      }
      try {
        var vLen = (typeof CardStateAuthority !== 'undefined') ? CardStateAuthority.getVault().length : -1;
        console.log('[NCH:DragDrop] hand→vault result:', ok,
          '| vaultLen:', vLen, '| droppedOnVault:', droppedOnVault,
          '| droppedOnLeftVault:', droppedOnLeftVault);
      } catch (d) {}
      _showDragResult(ok, 'Vaulted!', 'Cannot vault card');
      _restoreDragMinimize();
      _drag = null;
      _renderAll();
      // BAC retired — RogueSidebar updates via csa-event listener
      return;
    }

    // ── BACKUP → VAULT (NCH vault zone OR left column in items mode) ──
    if (_drag.kind === 'backup' && (droppedOnVault || droppedOnLeftVault)) {
      if (_useCTM) {
        ok = CardTransferManager.backupToVault(_drag.index);
      } else if (_useCSA) {
        ok = CardStateAuthority.moveBackupToVault(_drag.index);
      }
      try {
        var vLen2 = (typeof CardStateAuthority !== 'undefined') ? CardStateAuthority.getVault().length : -1;
        console.log('[NCH:DragDrop] backup→vault result:', ok,
          '| vaultLen:', vLen2, '| droppedOnVault:', droppedOnVault,
          '| droppedOnLeftVault:', droppedOnLeftVault);
      } catch (d2) {}
      _showDragResult(ok, 'Vaulted from backup!', 'Cannot vault');
      _restoreDragMinimize();
      _drag = null;
      _renderAll();
      // BAC retired — RogueSidebar updates via csa-event listener
      return;
    }

    // ── VAULT → BACKUP (NCH backup zone OR left column in backup mode) ──
    if (_drag.kind === 'vault' && (droppedOnBackup || droppedOnLeftBackup) && !droppedOnLeftVault) {
      if (_useCTM) {
        ok = CardTransferManager.vaultToBackup(_drag.id);
      } else if (_useCSA) {
        ok = CardStateAuthority.moveVaultToBackup(_drag.id);
      }
      _showDragResult(ok, 'Moved to backup', 'Cannot move to backup');
      _restoreDragMinimize();
      _drag = null;
      _renderAll();
      // BAC retired — RogueSidebar updates via csa-event listener
      return;
    }

    // ── VAULT → HAND (with cascade if hand is full) ──
    if (_drag.kind === 'vault' && droppedOnHand) {
      if (_useCSA && typeof CardStateAuthority.cascadeVaultToHandTop === 'function') {
        ok = CardStateAuthority.cascadeVaultToHandTop(_drag.id);
      } else if (_useCTM) {
        ok = CardTransferManager.vaultToHand(_drag.id, 1);
      } else if (_useCSA) {
        ok = CardStateAuthority.moveVaultToHand(_drag.id, 1);
      }
      _showDragResult(ok, 'Added to hand', 'Cannot add to hand');
      _restoreDragMinimize();
      _drag = null;
      _renderAll();
      return;
    }

    // ── STASH CARD (external) → HAND or BACKUP ──
    if (_drag.kind === 'stash_card') {
      if (droppedOnHand) {
        if (_useCSA) ok = CardStateAuthority.moveVaultToHand(_drag.id, 1);
        else if (_useCTM) ok = CardTransferManager.vaultToHand(_drag.id, 1);
      } else if (droppedOnBackup || droppedOnLeftBackup) {
        if (_useCSA) ok = CardStateAuthority.moveVaultToBackup(_drag.id);
        else if (_useCTM) ok = CardTransferManager.vaultToBackup(_drag.id);
      }
      _showDragResult(ok, 'Card placed', 'Cannot place card');
      _restoreDragMinimize();
      _drag = null;
      _renderAll();
      return;
    }

    // ── CAPSULE DROP (minimized NCH) → cascade to hand top ──
    // Note: backup→capsule is already handled above (BACKUP → HAND block includes droppedOnCapsule)
    if (droppedOnCapsule && (_drag.kind === 'hand' || _drag.kind === 'vault')) {
      if (_drag.kind === 'vault' && _useCSA) {
        // Vault card → hand with cascade (moves last hand card to backup if full)
        ok = (typeof CardStateAuthority.cascadeVaultToHandTop === 'function')
          ? CardStateAuthority.cascadeVaultToHandTop(_drag.id)
          : CardStateAuthority.moveVaultToHand(_drag.id, 1);
      } else if (_drag.kind === 'hand') {
        // Hand card dropped on capsule — it's already in hand, just re-expand
        ok = true;
      }
      _showDragResult(ok, 'Card \u2192 hand (top)', 'Cannot place in hand');
      _restoreDragMinimize();
      _drag = null;
      _renderAll();
      return;
    }

    // ── DEBRIEF FEED DROP (dispose / incinerate card or item) ──
    var droppedOnDebrief = _isDragOverDebriefFeed(e.clientX, e.clientY);
    if (droppedOnDebrief && (_drag.kind === 'hand' || _drag.kind === 'backup' || _drag.kind === 'vault' || _drag.kind === 'persistent_item' || _drag.kind === 'equipped_item')) {
      _clearDebriefDisposingPreview();

      // Remove card/item from its source container.
      // CSA path (preferred) with GAMESTATE fallback for each source.
      var disposed = false;
      if (_drag.kind === 'hand') {
        if (_useCSA) {
          CardStateAuthority.consumeFromHand(_drag.index, 1);
          disposed = true;
        } else if (typeof GAMESTATE !== 'undefined' && GAMESTATE.getCardHand) {
          var hand = GAMESTATE.getCardHand();
          if (hand && hand[_drag.index]) { hand.splice(_drag.index, 1); disposed = true; }
        }
      } else if (_drag.kind === 'backup') {
        if (_useCSA) {
          CardStateAuthority.removeBackupCard(_drag.index);
          disposed = true;
        } else if (typeof GAMESTATE !== 'undefined' && GAMESTATE.getBackupCards) {
          var backup = GAMESTATE.getBackupCards();
          if (backup && backup[_drag.index]) { backup.splice(_drag.index, 1); disposed = true; }
        }
      } else if (_drag.kind === 'vault') {
        // Vault disposal — try card removal first (CSA → GAMESTATE)
        if (_useCSA && typeof CardStateAuthority.disposeFromVault === 'function') {
          disposed = CardStateAuthority.disposeFromVault(_drag.id);
        }
        if (!disposed && typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.removePersistentCard === 'function') {
          var vr = GAMESTATE.removePersistentCard(_drag.id, 1);
          disposed = !!(vr && vr.success);
        }
        // Safety net: if id is an ITM-item that leaked through as vault kind,
        // find and remove it from inventoryPersistent by id scan.
        if (!disposed && _drag.id && _drag.id.indexOf('ITM-') === 0) {
          try {
            var pInv = GAMESTATE.getPersistentInventory();
            for (var pi = 0; pi < pInv.length; pi++) {
              if (pInv[pi] && pInv[pi].id === _drag.id) {
                GAMESTATE.removePersistentInventoryItem(pi);
                disposed = true;
                break;
              }
            }
          } catch (itemFallback) {}
        }
      } else if (_drag.kind === 'persistent_item') {
        // Persistent inventory item (keys, equipment) — remove by index
        if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.removePersistentInventoryItem === 'function') {
          GAMESTATE.removePersistentInventoryItem(_drag.index);
          disposed = true;
        }
      } else if (_drag.kind === 'equipped_item') {
        // Equipped (active) item — unequip + remove from persistent inventory
        if (typeof GAMESTATE !== 'undefined') {
          GAMESTATE.clearActiveItem();
          // Also remove from persistent inventory by id scan
          try {
            var pInv2 = GAMESTATE.getPersistentInventory();
            for (var pi2 = 0; pi2 < pInv2.length; pi2++) {
              if (pInv2[pi2] && pInv2[pi2].id === _drag.id) {
                GAMESTATE.removePersistentInventoryItem(pi2);
                disposed = true;
                break;
              }
            }
          } catch (eqDispose) {}
          if (!disposed) { disposed = true; } // At minimum the slot was cleared
        }
      }

      if (!disposed) {
        console.warn('[NCH:Disposal] Failed to remove', _drag.kind, _drag.id, _drag.index);
      }

      // Fire incinerator animation on debrief screen
      var ds = _getDebriefScreen();
      if (ds) {
        ds.classList.add('incinerator-active');
        setTimeout(function() { ds.classList.remove('incinerator-active'); }, 600);
      }
      if (typeof DebriefFeedController !== 'undefined' && typeof DebriefFeedController.flashIncinerator === 'function') {
        DebriefFeedController.flashIncinerator({ kind: 'disposal', durationMs: 600 });
      }

      // Dispatch incineration event for passive item triggers (Scrapper Core etc.)
      try {
        window.dispatchEvent(new CustomEvent('rogue-card-incinerated', {
          detail: { card: { id: _drag.id, qty: 1 }, source: 'debrief_disposal' }
        }));
      } catch (incErr) {}

      if (typeof PassiveItemsSystem !== 'undefined' && typeof PassiveItemsSystem.handleDisposal === 'function') {
        try { PassiveItemsSystem.handleDisposal({ id: _drag.id, name: _drag.id }, 'debrief_disposal'); } catch (pe) {}
      }

      ok = true;
      _showDragResult(disposed, '\uD83D\uDD25 Disposed!', 'Cannot dispose');
      _restoreDragMinimize();
      _drag = null;
      _renderAll();
      return;
    }

    // ── WORLD MAP DROP (deploy or incinerate) ──
    var coords = _screenToGrid(e.clientX, e.clientY);
    if (coords && (_drag.kind === 'hand' || _drag.kind === 'backup')) {
      var deployable = _isCardDeployable(_drag.id);

      if (deployable) {
        // Try deploying card at map tile
        if (_useCTM) {
          ok = CardTransferManager.deployToMap(_drag.kind, _drag.index, coords.x, coords.y);
        } else {
          if (typeof GoneRogue !== 'undefined' && GoneRogue.applyNonCombatCardAt) {
            ok = GoneRogue.applyNonCombatCardAt(_drag.id, coords.x, coords.y);
          }
          if (ok && _useCSA) {
            if (_drag.kind === 'hand') CardStateAuthority.consumeFromHand(_drag.index, 1);
            else CardStateAuthority.removeBackupCard(_drag.index);
          }
        }
        if (ok) _collapse('world_fire');
        _showDragResult(ok, 'Deployed!', 'Invalid tile');
      } else {
        // Non-deployable card dropped on map → incinerate
        if (_useCSA) {
          if (_drag.kind === 'hand') CardStateAuthority.consumeFromHand(_drag.index, 1);
          else CardStateAuthority.removeBackupCard(_drag.index);
        }
        try {
          window.dispatchEvent(new CustomEvent('rogue-card-incinerated', {
            detail: { card: { id: _drag.id, qty: 1 }, source: 'invalid_map_drop' }
          }));
        } catch (incErr) {}
        ok = true;
        _showDragResult(true, '\uD83D\uDD25 Incinerated', 'Cannot incinerate');
      }

      _restoreDragMinimize();
      _drag = null;
      _renderAll();
      return;
    }

    // ── EQUIPPED ITEM drop ──
    if (_drag.kind === 'equipped_item' && coords) {
      if (_drag.id && typeof GoneRogue !== 'undefined') {
        if (GoneRogue.isBoxDeployItem && GoneRogue.isBoxDeployItem(_drag.id) && GoneRogue.placeBox) {
          var quality = 'common';
          if (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getItem) {
            var def = GoneRogueDataRegistry.getItem(_drag.id);
            if (def && def.boxQuality) quality = def.boxQuality;
          }
          GoneRogue.placeBox(coords, _drag.id, quality);
          ok = true;
        } else if (GoneRogue.useActiveItemAt) {
          GoneRogue.useActiveItemAt(coords.x, coords.y);
          ok = true;
        }
      }
      if (ok) _collapse('item_fire');
      _restoreDragMinimize();
      _drag = null;
      _renderAll();
      return;
    }

    // No valid drop — card stays in place
    if (typeof TooltipSystem !== 'undefined') {
      TooltipSystem.showPersistent('\u274C Invalid drop', 800);
    }
    _restoreDragMinimize();
    _drag = null;
  }

  function _showDragResult(ok, successMsg, failMsg) {
    if (typeof TooltipSystem !== 'undefined') {
      TooltipSystem.showPersistent(ok ? ('\u2705 ' + successMsg) : ('\u274C ' + failMsg), 900);
    }
  }

  /**
   * Flash the header active-item-display to confirm equip.
   * Shared between NCH drag-drop equip and sidebar drag-drop equip.
   */
  function _flashHeaderEquipSlot() {
    try {
      var display = document.getElementById('active-item-display');
      if (!display) return;
      display.classList.remove('equip-flash');
      void display.offsetWidth; // force reflow
      display.classList.add('equip-flash');
      setTimeout(function() {
        try { display.classList.remove('equip-flash'); } catch (e) {}
      }, 420);
    } catch (e) {}
  }

  function _screenToGrid(clientX, clientY) {
    // DOM grid cell
    var el = document.elementFromPoint(clientX, clientY);
    if (el && el.closest) {
      var cell = el.closest('.rogue-cell');
      if (cell && cell.dataset && cell.dataset.x !== undefined && cell.dataset.y !== undefined) {
        return { x: Number(cell.dataset.x), y: Number(cell.dataset.y) };
      }
    }
    // Canvas fallback
    var gridContainer = document.getElementById('rogue-grid-mobile');
    var canvas = gridContainer ? gridContainer.querySelector('canvas') : null;
    if (canvas) {
      var r = canvas.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
        var cellW = (canvas.width || r.width || 1) / 40;
        var cellH = (canvas.height || r.height || 1) / 20;
        var gx = Math.floor((clientX - r.left) / cellW);
        var gy = Math.floor((clientY - r.top) / cellH);
        if (gx >= 0 && gx < 40 && gy >= 0 && gy < 20) {
          return { x: gx, y: gy };
        }
      }
    }
    return null;
  }

  // ─── GLOBAL LISTENERS ───────────────────────────────────

  function _attachGlobalListeners() {
    // Nothing needed beyond event subscriptions in init()
  }

  // ─── AUTO-INIT ──────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ─── INCINERATION EFFECT ────────────────────────────────

  /**
   * Show incineration animation when a card is destroyed from backup overflow.
   * Listens for 'rogue-card-incinerated' events dispatched by GAMESTATE.
   * @param {Object} detail - { card: { id, qty }, source: 'backup_overflow' }
   */
  function _showIncinerationEffect(detail) {
    if (!detail || !detail.card) return;

    var cardId = detail.card.id || '?';
    var cardDef = _getCardDef(cardId);
    var emoji = (cardDef && cardDef.emoji) ? cardDef.emoji : '🃏';
    var name = (cardDef && cardDef.name) ? cardDef.name : cardId;

    // If NCH backup scroller is visible, animate from the rightmost card position
    var scroller = _expanded ? _expanded.querySelector('#nch-backup-scroller') : null;
    var anchorRect = null;
    if (scroller && scroller.lastElementChild) {
      anchorRect = scroller.lastElementChild.getBoundingClientRect();
    }

    // Create floating incineration element
    var incEl = document.createElement('div');
    incEl.className = 'nch-card-incinerating';
    incEl.innerHTML = '<span class="nch-incinerate-emoji">' + emoji + '</span><span class="nch-incinerate-name">' + name + '</span>';

    if (anchorRect) {
      incEl.style.left = (anchorRect.left + anchorRect.width / 2) + 'px';
      incEl.style.top = (anchorRect.top + anchorRect.height / 2) + 'px';
    } else {
      // Fallback: bottom-right of viewport
      incEl.style.right = '40px';
      incEl.style.bottom = '120px';
    }

    document.body.appendChild(incEl);

    // Show tooltip notification
    try {
      if (typeof TooltipSystem !== 'undefined') {
        TooltipSystem.showPersistent('🔥 INCINERATED: ' + emoji + ' ' + name, 1200);
      }
    } catch (e) {}

    // Remove after animation completes (600ms)
    setTimeout(function() {
      if (incEl.parentNode) incEl.remove();
    }, 650);
  }

  // ─── Card Deployability Check ──────────────────────────

  /**
   * Check if a card can be deployed onto the world map.
   * Cards with groundEffectId or targetType are map-deployable.
   * @param {string} cardId
   * @returns {boolean}
   */
  function _isCardDeployable(cardId) {
    if (!cardId) return false;
    var def = _getCardDef(cardId);
    if (!def) return false;
    // Cards with ground effects or target types can be deployed
    if (def.groundEffectId) return true;
    if (def.targetType === 'ground' || def.targetType === 'area') return true;
    // Items are not map-deployable from backup
    if (def.type === 'item' || def.type === 'equip') return false;
    return false;
  }

  // ─── PUBLIC API ─────────────────────────────────────────

  return {
    init: init,
    setMinimized: setMinimized,
    startExternalDrag: startExternalDrag,
    resetCapsulePosition: resetCapsulePosition,
    screenToGrid: _screenToGrid,
    isCardDeployable: _isCardDeployable,
    flashHeaderEquipSlot: _flashHeaderEquipSlot,

    // Combat Capsule (CH) — unified hand indicator for STR combat
    showCombatCapsule: showCombatCapsule,
    updateCombatCapsule: updateCombatCapsule,
    flashCombatCapsule: flashCombatCapsule,
    hideCombatCapsule: hideCombatCapsule
  };
})();
