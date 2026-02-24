/* ============================================================
   Non-Combat HUD (fixed overlay, v0)
   Shell + state display + debug hooks.
   ============================================================ */

var NonCombatHUD = (function() {
  'use strict';

  var _root = null;
  var _mini = null;

  var PREF_KEY = 'EYESONLY_NONCOMBAT_HUD_PREFS_V1';
  var _prefs = {
    minimized: true
  };

  var _drag = {
    active: false,
    startY: 0,
    lastY: 0,
    startTs: 0
  };

  function _loadPrefs() {
    try {
      var raw = localStorage.getItem(PREF_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          _prefs = Object.assign(_prefs, parsed);
        }
      } else {
        // First-run default: keep minimized so new players aren't confused.
        _prefs.minimized = true;
      }
    } catch (e) {}
  }

  function _savePrefs() {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(_prefs)); } catch (e) {}
  }

  function init() {
    if (_root) return;

    _loadPrefs();

    _root = document.createElement('div');
    _root.id = 'non-combat-hud';
    _root.className = 'non-combat-hud';
    _root.style.display = 'none';

    _root.innerHTML =
      '<div class="nch-col nch-left">' +
        '<div class="nch-title">ACTIONS</div>' +
        '<div class="nch-actions" id="nch-actions">' +
          '<button class="nch-action-btn" id="nch-btn-to-backup">⬅︎ BACKUP</button>' +
          '<button class="nch-action-btn" id="nch-btn-to-hand">HAND ➜</button>' +
          '<div class="nch-title" style="margin-top:6px;">BACKUP</div>' +
          '<div class="nch-backup" id="nch-backup"></div>' +
        '</div>' +
      '</div>' +
      '<div class="nch-col nch-center">' +
        '<div class="nch-title">EQUIPPED <button class="nch-min-btn" id="nch-min-btn" title="Minimize">_</button></div>' +
        '<div class="nch-equipped" id="nch-equipped">(none)</div>' +
        '<div class="nch-title">HAND</div>' +
        '<div class="nch-hand" id="nch-hand" data-dropzone="hand">Drop cards here from inventory.</div>' +
      '</div>' +
      '<div class="nch-col nch-right">' +
        '<div class="nch-title">PREVIEW</div>' +
        '<div class="nch-preview" id="nch-preview">idle</div>' +
      '</div>';

    document.body.appendChild(_root);

    _mini = document.createElement('div');
    _mini.id = 'non-combat-hud-mini';
    _mini.innerHTML = '<span class="nch-mini-dot"></span><span class="nch-mini-label">NCH</span>';
    _mini.style.display = 'none';
    document.body.appendChild(_mini);

    var minBtn = _root.querySelector('#nch-min-btn');
    if (minBtn) {
      minBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        setMinimized(true, 'button');
      });
    }

    // Action buttons
    var btnToBackup = _root.querySelector('#nch-btn-to-backup');
    if (btnToBackup) {
      btnToBackup.addEventListener('click', function(e) {
        e.stopPropagation();
        if (typeof NonCombatStateStore === 'undefined') return;

        var st = (typeof NonCombatStateStore.getState === 'function') ? NonCombatStateStore.getState() : null;
        var sel = st ? Number(st.selectedHandIndex || -1) : -1;
        if (!isFinite(sel) || sel < 0) {
          // Fallback: if only one card, select it
          try {
            var h = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getCardsInHand) ? GAMESTATE.getCardsInHand() : [];
            if (h.length === 1) sel = 0;
          } catch (e2) {}
        }

        var ok = false;
        if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.moveHandIndexToBackup === 'function') {
          ok = !!GAMESTATE.moveHandIndexToBackup(sel).success;
        }

        if (typeof TooltipSystem !== 'undefined') {
          TooltipSystem.showPersistent(ok ? '📦 moved to BACKUP' : '❌ select a hand card + ensure backup has space', 1200);
        }

        // force rerender
        try { _render(NonCombatStateStore.getState()); } catch (e3) {}
      });
    }

    var btnToHand = _root.querySelector('#nch-btn-to-hand');
    if (btnToHand) {
      btnToHand.addEventListener('click', function(e) {
        e.stopPropagation();
        if (typeof NonCombatStateStore === 'undefined') return;

        var st = (typeof NonCombatStateStore.getState === 'function') ? NonCombatStateStore.getState() : null;
        var sel = st ? Number(st.selectedBackupIndex || -1) : -1;

        if (!isFinite(sel) || sel < 0) {
          // Fallback: if only one backup card exists, select it
          try {
            var b = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getBackupCards) ? GAMESTATE.getBackupCards() : [];
            var filled = [];
            for (var i = 0; i < b.length; i++) if (b[i] && b[i].id) filled.push(i);
            if (filled.length === 1) sel = filled[0];
          } catch (e2) {}
        }

        var ok = false;
        if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.moveBackupIndexToHand === 'function') {
          ok = !!GAMESTATE.moveBackupIndexToHand(sel).success;
        }

        if (typeof TooltipSystem !== 'undefined') {
          TooltipSystem.showPersistent(ok ? '➕ moved to HAND' : '❌ select a backup card', 1000);
        }

        try { _render(NonCombatStateStore.getState()); } catch (e3) {}
      });
    }

    // Tap mini pill to expand
    _mini.addEventListener('click', function() {
      setMinimized(false, 'pill');
    });

    // Drag-down minimize gesture (similar feel to STR, simplified)
    _root.addEventListener('pointerdown', function(e) {
      // Ignore interactions on buttons/inputs/links and draggable NCH elements
      var t = e.target;
      if (t && t.closest && t.closest('button, a, input, textarea, select, label')) return;
      if (t && t.closest && t.closest('.nch-draggable, #nch-equipped, #nch-hand, #nch-backup')) return;

      _drag.active = true;
      _drag.startY = e.clientY;
      _drag.lastY = e.clientY;
      _drag.startTs = Date.now();
      try { _root.setPointerCapture(e.pointerId); } catch (err) {}
    });

    _root.addEventListener('pointermove', function(e) {
      if (!_drag.active) return;
      _drag.lastY = e.clientY;
    });

    _root.addEventListener('pointerup', function(e) {
      if (!_drag.active) return;
      _drag.active = false;
      var dy = _drag.lastY - _drag.startY;
      var dt = Math.max(1, Date.now() - _drag.startTs);
      var v = (dy / dt) * 1000; // px/s

      // Thresholds: drag down far enough OR fast swipe
      if (dy > 90 || (dy > 40 && v > 850)) {
        setMinimized(true, 'drag');
      }
    });

    if (typeof NonCombatStateStore !== 'undefined') {
      NonCombatStateStore.subscribe(function(prev, next) {
        _render(next);
      });
      _render(NonCombatStateStore.getState());
    }

    // Re-render when rogue equipped item/hand changes (GAMESTATE is canonical)
    if (typeof window !== 'undefined') {
      window.addEventListener('rogue-active-item-changed', function() {
        try {
          if (typeof NonCombatStateStore !== 'undefined' && NonCombatStateStore.getState) {
            _render(NonCombatStateStore.getState());
          }
        } catch (err) {}
      });

      window.addEventListener('rogue-hand-changed', function() {
        try {
          // Clamp selections against canonical arrays
          if (typeof NonCombatStateStore !== 'undefined' && NonCombatStateStore.getState && NonCombatStateStore.modifyState) {
            var st = NonCombatStateStore.getState();
            var selH = Number(st.selectedHandIndex || -1);
            var selB = Number(st.selectedBackupIndex || -1);
            var hand = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getCardsInHand) ? GAMESTATE.getCardsInHand() : [];
            var backup = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getBackupCards) ? GAMESTATE.getBackupCards() : [];
            if (!isFinite(selH) || selH >= hand.length) selH = -1;
            if (!isFinite(selB) || selB < 0 || selB > 3 || !backup[selB]) selB = -1;
            NonCombatStateStore.modifyState({ selectedHandIndex: selH, selectedBackupIndex: selB }, 'nch:clamp_selection');
          }

          if (typeof NonCombatStateStore !== 'undefined' && NonCombatStateStore.getState) {
            _render(NonCombatStateStore.getState());
          }
        } catch (err) {}
      });

      window.addEventListener('gone-rogue-registry-ready', function() {
        try {
          if (typeof NonCombatStateStore !== 'undefined' && NonCombatStateStore.getState) {
            _render(NonCombatStateStore.getState());
          }
        } catch (err) {}
      });
    }

    // Registry loading UX
    var previewEl = _root.querySelector('#nch-preview');
    if (previewEl) {
      previewEl.textContent = 'Loading data...';
    }

    if (typeof NonCombatEventBus !== 'undefined') {
      NonCombatEventBus.on('registry:loaded', function(evt) {
        if (previewEl) {
          var counts = (evt && evt.payload && evt.payload.counts) ? evt.payload.counts : null;
          previewEl.textContent = 'idle' + (counts ? (' (cards ' + counts.cards + ', items ' + counts.items + ')') : '');
        }
      });
    } else if (typeof GoneRogueDataRegistry !== 'undefined' && typeof GoneRogueDataRegistry.ready === 'function') {
      GoneRogueDataRegistry.ready().then(function() {
        if (previewEl) previewEl.textContent = 'idle';
      });
    }

    // Show/hide based on GoneRogue mode and STR combat state
    setInterval(function() {
      var rogueActive = (typeof GoneRogue !== 'undefined' && typeof GoneRogue.isActive === 'function' && GoneRogue.isActive());
      var strActive = (typeof GoneRogue !== 'undefined' && typeof GoneRogue.isStrCombatActive === 'function' && GoneRogue.isStrCombatActive());
      var shouldShow = rogueActive;

      // Always keep EQUIPPED display in sync with GAMESTATE (cheap update)
      _renderEquippedOnly();

      if (!shouldShow) {
        _root.style.display = 'none';
        _mini.style.display = 'none';
        return;
      }

      if (strActive) {
        _root.classList.add('locked');
      } else {
        _root.classList.remove('locked');
      }

      if (_prefs.minimized) {
        _root.style.display = 'none';
        _mini.style.display = 'flex';
      } else {
        _root.style.display = 'flex';
        _mini.style.display = 'none';
      }
    }, 350);

    // Apply initial minimized state
    setMinimized(!!_prefs.minimized, 'init');
  }

  function setMinimized(minimized, reason) {
    _prefs.minimized = !!minimized;
    _savePrefs();

    if (_prefs.minimized) {
      if (_root) _root.classList.add('minimized');
    } else {
      if (_root) _root.classList.remove('minimized');
    }

    if (typeof NonCombatStateStore !== 'undefined') {
      NonCombatStateStore.modifyState({
        uiState: NonCombatStateStore.NON_COMBAT_STATES.IDLE
      }, 'nch:minimized', { minimized: _prefs.minimized, reason: reason || 'unknown' });
    }
  }

  function _renderEquippedOnly() {
    if (!_root) return;
    var eq = _root.querySelector('#nch-equipped');
    if (!eq) return;

    // Prefer GAMESTATE active item (canonical for rogue)
    var activeRef = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getActiveItem) ? GAMESTATE.getActiveItem() : null;

    if (activeRef && activeRef.id && typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getItem) {
      var it = GoneRogueDataRegistry.getItem(activeRef.id);
      var em = (it && it.emoji) ? it.emoji : '📦';
      var nm = (it && it.name) ? it.name : activeRef.id;
      eq.textContent = em + ' ' + nm;
      eq.classList.add('nch-draggable');
      eq.dataset.equippedId = activeRef.id;
      eq.style.pointerEvents = 'auto';
    } else {
      eq.textContent = '(none)';
      eq.classList.remove('nch-draggable');
      eq.dataset.equippedId = '';
      eq.style.pointerEvents = 'auto';
    }

    // One-time attach: allow dragging the equipped item from NCH to the map
    if (!eq._nchEquippedBound) {
      eq._nchEquippedBound = true;

      eq.addEventListener('pointerdown', function(e) {
        if (!e || e.pointerType === 'touch') return;
        if (e.button !== undefined && e.button !== 0) return;
        if (_root && _root.classList.contains('locked')) return;

        var id = e.currentTarget.dataset.equippedId;
        if (!id) return;

        var itemDef = (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getItem) ? GoneRogueDataRegistry.getItem(id) : null;
        var ghostEmoji = (itemDef && itemDef.emoji) ? itemDef.emoji : '📦';

        _startNchDrag({ kind: 'equipped_item', id: id, emoji: ghostEmoji }, e);
      });
    }
  }

  function _render(state) {
    if (!_root || !state) return;

    _renderEquippedOnly();

    var pv = _root.querySelector('#nch-preview');
    if (pv) {
      pv.textContent = state.uiState || 'idle';
    }

    var hand = _root.querySelector('#nch-hand');
    if (hand) {
      var refs = [];
      if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getCardsInHand === 'function') {
        refs = GAMESTATE.getCardsInHand();
      } else {
        refs = (state.cardsInHand && Array.isArray(state.cardsInHand)) ? state.cardsInHand : [];
      }
      hand.innerHTML = '';

      if (refs.length === 0) {
        hand.textContent = 'Drop cards here from inventory.';
      } else {
        for (var i = 0; i < refs.length; i++) {
          var ref = refs[i];
          if (!ref || !ref.id) continue;

          var card = null;
          if (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getCard) {
            card = GoneRogueDataRegistry.getCard(ref.id);
          }

          var nm = card ? card.name : ref.id;
          var em = card ? card.emoji : '🃏';

          var row = document.createElement('div');
          row.className = 'nch-hand-row nch-draggable' + ((state.selectedHandIndex === i) ? ' selected' : '');
          row.dataset.handIndex = i;
          row.textContent = em + ' ' + nm + ' x' + (ref.qty || 1);

          row.addEventListener('click', function(e) {
            e.stopPropagation();
            var idx = Number(e.currentTarget.dataset.handIndex);
            if (typeof NonCombatStateStore !== 'undefined' && NonCombatStateStore.setSelectedHandIndex) {
              var current = (typeof NonCombatStateStore.getState === 'function') ? NonCombatStateStore.getState().selectedHandIndex : -1;
              NonCombatStateStore.setSelectedHandIndex(current === idx ? -1 : idx);
            }
          });

          row.addEventListener('pointerdown', function(e) {
            if (!e || e.pointerType === 'touch') return;
            if (e.button !== undefined && e.button !== 0) return;
            _startNchDrag({
              kind: 'hand',
              handIndex: Number(e.currentTarget.dataset.handIndex),
              emoji: em,
              id: ref.id
            }, e);
          });

          hand.appendChild(row);
        }
      }
    }

    var backup = _root.querySelector('#nch-backup');
    if (backup) {
      backup.innerHTML = '';
      var slots = [];
      if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getBackupCards === 'function') {
        slots = GAMESTATE.getBackupCards();
      } else {
        slots = (state.backupCards && Array.isArray(state.backupCards)) ? state.backupCards : [];
      }

      // Fixed 4 slots display
      for (var s = 0; s < 4; s++) {
        var ref2 = slots[s] || null;
        var cell = document.createElement('div');
        cell.className = 'nch-backup-slot nch-draggable' + ((state.selectedBackupIndex === s) ? ' selected' : '');
        cell.dataset.backupIndex = s;

        if (ref2 && ref2.id) {
          var card2 = null;
          if (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getCard) {
            card2 = GoneRogueDataRegistry.getCard(ref2.id);
          }
          var nm2 = card2 ? card2.name : ref2.id;
          var em2 = card2 ? card2.emoji : '🃏';
          cell.textContent = em2 + ' ' + nm2;
        } else {
          cell.textContent = '—';
          cell.classList.add('empty');
        }

        cell.addEventListener('click', function(e) {
          e.stopPropagation();
          var idx2 = Number(e.currentTarget.dataset.backupIndex);
          if (typeof NonCombatStateStore !== 'undefined' && NonCombatStateStore.setSelectedBackupIndex) {
            NonCombatStateStore.setSelectedBackupIndex(idx2);
          }
        });

        cell.addEventListener('pointerdown', function(e) {
          if (!e || e.pointerType === 'touch') return;
          if (e.button !== undefined && e.button !== 0) return;

          var idx2 = Number(e.currentTarget.dataset.backupIndex);

          var refB = null;
          if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getBackupCards === 'function') {
            var b = GAMESTATE.getBackupCards();
            refB = b ? b[idx2] : null;
          }

          if (!refB || !refB.id) return;

          var cardB = (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getCard) ? GoneRogueDataRegistry.getCard(refB.id) : null;
          var emB = cardB ? (cardB.emoji || '🃏') : '🃏';

          _startNchDrag({
            kind: 'backup',
            backupIndex: idx2,
            emoji: emB,
            id: refB.id
          }, e);
        });

        backup.appendChild(cell);
      }
    }

    if (_mini) {
      _mini.classList.remove('nch-mini-warn');
      _mini.classList.remove('nch-mini-busy');
      if (state.uiState === (NonCombatStateStore.NON_COMBAT_STATES.TARGETING || 'targeting')) {
        _mini.classList.add('nch-mini-busy');
      }
      if (state.uiState === (NonCombatStateStore.NON_COMBAT_STATES.CONFIRMATION || 'confirmation')) {
        _mini.classList.add('nch-mini-warn');
      }
    }
  }

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  var _nchDrag = null; // { kind, emoji, id, handIndex?, backupIndex?, ghostEl, startX, startY, dragging }

  function _startNchDrag(payload, e) {
    if (!_root || !_mini) {}

    // Don't allow during STR combat (locked)
    if (_root && _root.classList.contains('locked')) {
      return;
    }

    _nchDrag = Object.assign({
      ghostEl: null,
      startX: e.clientX,
      startY: e.clientY,
      dragging: false
    }, payload);

    try { _root.setPointerCapture(e.pointerId); } catch (err) {}

    document.addEventListener('pointermove', _onNchDragMove);
    document.addEventListener('pointerup', _onNchDragUp);
    document.addEventListener('pointercancel', _onNchDragUp);
  }

  function _ensureGhost(x, y) {
    if (!_nchDrag || _nchDrag.ghostEl) return;

    var ghost = document.createElement('div');
    ghost.className = 'nch-drag-ghost';
    ghost.textContent = _nchDrag.emoji || '🃏';
    ghost.style.left = x + 'px';
    ghost.style.top = y + 'px';
    document.body.appendChild(ghost);
    _nchDrag.ghostEl = ghost;
  }

  function _onNchDragMove(e) {
    if (!_nchDrag) return;
    if (!e || e.pointerType === 'touch') return;

    var dx = e.clientX - _nchDrag.startX;
    var dy = e.clientY - _nchDrag.startY;
    var dist = Math.sqrt(dx * dx + dy * dy);

    if (!_nchDrag.dragging && dist > 6) {
      _nchDrag.dragging = true;
      _ensureGhost(e.clientX, e.clientY);
    }

    if (_nchDrag.dragging && _nchDrag.ghostEl) {
      _nchDrag.ghostEl.style.left = e.clientX + 'px';
      _nchDrag.ghostEl.style.top = e.clientY + 'px';
    }
  }

  function _screenToGrid(clientX, clientY) {
    // DOM grid cell (preferred)
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
        var relX = (clientX - r.left);
        var relY = (clientY - r.top);
        var cellW = (canvas.width || (r.width || 1)) / 40;
        var cellH = (canvas.height || (r.height || 1)) / 20;
        var gx = Math.floor(relX / cellW);
        var gy = Math.floor(relY / cellH);
        if (gx >= 0 && gx < 40 && gy >= 0 && gy < 20) {
          return { x: gx, y: gy };
        }
      }
    }

    return null;
  }

  function _onNchDragUp(e) {
    if (!_nchDrag) return;

    document.removeEventListener('pointermove', _onNchDragMove);
    document.removeEventListener('pointerup', _onNchDragUp);
    document.removeEventListener('pointercancel', _onNchDragUp);

    var ghost = _nchDrag.ghostEl;
    if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);

    if (!_nchDrag.dragging) {
      _nchDrag = null;
      return;
    }

    // NCH internal drops (hand <-> backup) take priority
    var el = null;
    try { el = document.elementFromPoint(e.clientX, e.clientY); } catch (e0) {}

    var droppedOnHand = false;
    var droppedOnBackup = false;
    if (el && _root && _root.contains(el)) {
      var handZone = _root.querySelector('#nch-hand');
      var backupZone = _root.querySelector('#nch-backup');
      if (handZone && (el === handZone || (handZone.contains && handZone.contains(el)))) droppedOnHand = true;
      if (backupZone && (el === backupZone || (backupZone.contains && backupZone.contains(el)))) droppedOnBackup = true;
    }

    var ok = false;
    if (_nchDrag.kind === 'hand' && droppedOnBackup) {
      if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.moveHandIndexToBackup === 'function') {
        ok = !!GAMESTATE.moveHandIndexToBackup(_nchDrag.handIndex).success;
      }
      if (!ok && typeof TooltipSystem !== 'undefined') TooltipSystem.showPersistent('❌ BACKUP full or invalid', 900);
      _nchDrag = null;
      return;
    }

    if (_nchDrag.kind === 'backup' && droppedOnHand) {
      if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.moveBackupIndexToHand === 'function') {
        ok = !!GAMESTATE.moveBackupIndexToHand(_nchDrag.backupIndex).success;
      }
      if (!ok && typeof TooltipSystem !== 'undefined') TooltipSystem.showPersistent('❌ Cannot move to hand', 900);
      _nchDrag = null;
      return;
    }

    // Otherwise: map drop (cards deploy / equipped targeting)
    var coords = _screenToGrid(e.clientX, e.clientY);
    if (!coords) {
      _nchDrag = null;
      return;
    }

    // Resolve drop
    if (_nchDrag.kind === 'hand') {
      if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.applyNonCombatCardAt === 'function') {
        ok = GoneRogue.applyNonCombatCardAt(_nchDrag.id, coords.x, coords.y);
      }
      if (ok && typeof NonCombatStateStore !== 'undefined' && NonCombatStateStore.consumeHandIndex) {
        NonCombatStateStore.consumeHandIndex(_nchDrag.handIndex, 1);
      }
    } else if (_nchDrag.kind === 'backup') {
      if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.applyNonCombatCardAt === 'function') {
        ok = GoneRogue.applyNonCombatCardAt(_nchDrag.id, coords.x, coords.y);
      }
      if (ok && typeof NonCombatStateStore !== 'undefined' && NonCombatStateStore.consumeBackupIndex) {
        NonCombatStateStore.consumeBackupIndex(_nchDrag.backupIndex);
      }
    } else if (_nchDrag.kind === 'equipped_item') {
      var id = _nchDrag.id;

      // Box deployables: placement
      if (id && typeof GoneRogue !== 'undefined' && GoneRogue.isBoxDeployItem && GoneRogue.isBoxDeployItem(id) && GoneRogue.placeBox) {
        var quality = 'common';
        if (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getItem) {
          var def = GoneRogueDataRegistry.getItem(id);
          if (def && def.boxQuality) quality = def.boxQuality;
        }
        GoneRogue.placeBox(coords, id, quality);
        ok = true;
      } else if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.useActiveItemAt === 'function') {
        // Default: route to active item targeting
        GoneRogue.useActiveItemAt(coords.x, coords.y);
        ok = true;
      }
    }

    if (!ok && typeof TooltipSystem !== 'undefined') {
      TooltipSystem.showPersistent('❌ Invalid drop / no effect', 900);
    }

    _nchDrag = null;
  }

  return {
    init: init,
    setMinimized: setMinimized
  };
})();
