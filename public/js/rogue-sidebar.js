/* ============================================================
   Rogue Sidebar (6-slot) - v0
   Standardized inventory/cards access without frame pushing.
   Debrief remains adaptive/floating and is not owned here.
   ============================================================ */

var RogueSidebar = (function() {
  // STR draw feedback: lightweight "ghost joker" cursor helper.
  // We DO NOT hide the real cursor (precision matters); we only show a small
  // trailing 🃏 while hovering the STR DRAW button to convey "random card".
  var _ghostEl = null;
  var _ghostMoveHandler = null;

  function _activateGhostJokerCursor() {
    if (_ghostEl) return;
    _ghostEl = document.createElement('div');
    _ghostEl.className = 'rs-ghost-joker';
    _ghostEl.textContent = '🃏';
    document.body.appendChild(_ghostEl);

    _ghostMoveHandler = function(e) {
      if (!_ghostEl) return;
      _ghostEl.style.left = (e.clientX + 14) + 'px';
      _ghostEl.style.top = (e.clientY + 14) + 'px';
    };
    document.addEventListener('pointermove', _ghostMoveHandler);
  }

  function _deactivateGhostJokerCursor() {
    if (_ghostEl && _ghostEl.parentNode) _ghostEl.parentNode.removeChild(_ghostEl);
    _ghostEl = null;
    if (_ghostMoveHandler) document.removeEventListener('pointermove', _ghostMoveHandler);
    _ghostMoveHandler = null;
  }

  'use strict';

  var _container = null;
  var _originalHtml = null;
  var _interactionLockUntil = 0;
  var RESIZE_DEBOUNCE_MS = 120;

  var PREF_KEY = 'EYESONLY_ROGUE_SIDEBAR_PREFS_V1';
  var _prefs = {
    // New-player UX: default to items view (empty slots prime item collection)
    view: 'items', // 'items' | 'cards'
    itemOffset: 0,
    cardOffset: 0
  };

  function _loadPrefs() {
    try {
      var raw = localStorage.getItem(PREF_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          _prefs = Object.assign(_prefs, parsed);
        }
      }
    } catch (e) {}
  }

  function _savePrefs() {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(_prefs)); } catch (e) {}
  }

  var _lastSignature = null;
  var _lastItemsLen = null;

  /**
   * Viewport tier detection for abbreviation level
   * Returns: 'desktop-full' | 'desktop-compact' | 'mobile-landscape' | 'mobile-portrait'
   */
  function _getViewportTier() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var isPortrait = h > w;
    var isMobile = w <= 600;
    
    if (isMobile) {
      return isPortrait ? 'mobile-portrait' : 'mobile-landscape';
    }
    return w > 900 ? 'desktop-full' : 'desktop-compact';
  }

  /**
   * Viewport-aware name helper: uses NameUtils (if loaded) to apply
   * the appropriate abbreviation level based on viewport tier.
   * Falls back gracefully when NameUtils is not yet available.
   * Per UI-CANON.md Section 14:
   *   - Desktop Full: no abbreviation (full name)
   *   - Desktop Compact: standard vowel-drop
   *   - Mobile Landscape: standard vowel-drop  
   *   - Mobile Portrait: standard vowel-drop (same as landscape)
   * @param {string} name - Full item/card name
   * @returns {string} Display name appropriate for current viewport
   */
  var _debriefIsMinimized = false;

  function _getViewportName(name) {
    if (!name) return '';
    
    var tier = _getViewportTier();
    
    // Desktop Full: no abbreviation - return full name
    if (tier === 'desktop-full') {
      return name;
    }
    
    try {
      // Desktop Compact, Mobile Landscape, Mobile Portrait: standard vowel-drop abbreviate
      // Let CSS container overflow:hidden clip naturally (no ellipsis)
      if (typeof NameUtils !== 'undefined' && NameUtils.abbreviate) {
        return NameUtils.abbreviate(name, 0); // 0 = no length limit, just drop vowels
      }
    } catch (e) {}
    return name;
  }

  function _isRogueActive() {
    return typeof GoneRogue !== 'undefined' && typeof GoneRogue.isActive === 'function' && GoneRogue.isActive();
  }

  function init() {
    if (_container) return;
    _loadPrefs();

    _container = document.querySelector('#control-rail .control-buttons');
    if (!_container) return;

    _originalHtml = _container.innerHTML;

    // Prevent interval re-render from swallowing the first click
    _container.addEventListener('pointerdown', function(e) {
      if (!e || e.pointerType === 'touch') return;
      _interactionLockUntil = Date.now() + 450;
    });
    _container.addEventListener('pointerup', function(e) {
      if (!e || e.pointerType === 'touch') return;
      _interactionLockUntil = Date.now() + 120;
    });
    _container.addEventListener('pointercancel', function(e) {
      if (!e || e.pointerType === 'touch') return;
      _interactionLockUntil = Date.now() + 120;
    });

    setInterval(_tick, 250);

    // Immediate re-render on CSA vault/hand/backup changes (supplements the 250ms poll)
    window.addEventListener('csa-event', function(ev) {
      var t = ev && ev.detail && ev.detail.type;
      if (t === 'vault:changed' || t === 'hand:changed' || t === 'backup:changed') {
        _lastSignature = null;
        _render();
      }
    });

    // Re-render when data registry loads card/item definitions
    window.addEventListener('gone-rogue-registry-ready', function() {
      _lastSignature = null;
      _render();
    });

    // Re-render on orientation/resize so viewport-aware abbreviation updates
    var _orientResizeDebounce = null;
    window.addEventListener('resize', function() {
      if (_orientResizeDebounce) clearTimeout(_orientResizeDebounce);
      _orientResizeDebounce = setTimeout(function() {
        _orientResizeDebounce = null;
        _lastSignature = null;
        _render();
      }, RESIZE_DEBOUNCE_MS);
    });

    // Debrief minimize/maximize → switch abbreviation length and re-render
    window.addEventListener('debrief:minimized', function() {
      _debriefIsMinimized = true;
      _lastSignature = null;
      _render();
    });
    window.addEventListener('debrief:maximized', function() {
      _debriefIsMinimized = false;
      _lastSignature = null;
      _render();
    });
  }

  function _tick() {
    if (_interactionLockUntil && Date.now() < _interactionLockUntil) {
      return;
    }

    var rogueActive = _isRogueActive();

    if (!rogueActive) {
      if (_container && _originalHtml !== null && _container.dataset.rogueSidebarActive === '1') {
        _container.innerHTML = _originalHtml;
        delete _container.dataset.rogueSidebarActive;
        delete _container.dataset.dropzone;
      }
      return;
    }

    // RogueSidebar is now the PRIMARY left-column display.
    // BAC floating popup is retired — ensure we're always visible when rogue is active.
    if (_container) _container.style.display = '';

    if (!_container) return;
    if (_container.dataset.rogueSidebarActive !== '1') {
      _container.dataset.rogueSidebarActive = '1';
      _container.dataset.dropzone = 'backup';

      // NCH stays in its current state (minimized capsule by default).
      // Players expand it manually when they need deck management.
      // Previously this force-expanded the NCH, covering the game screen.
    }

    _render();
  }

  function _render() {
    if (!_container) return;

    // Guard: only render rogue sidebar content when Gone Rogue is actually active.
    // Event handlers (csa-event, gone-rogue-registry-ready, resize, debrief) fire
    // regardless of game state; without this check they would replace the default
    // action buttons with empty rogue-sidebar slots on the front page.
    if (!_isRogueActive()) return;

    // Fetch refs early so we can enforce first-pickup UX.
    // Items view combines BOTH persistent items (ITM-*) and vault cards (ACT-*),
    // mirroring BAC's _getItemCards() logic. Items appear first, then vault cards.
    var rawItems = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getPersistentInventory) ? (GAMESTATE.getPersistentInventory() || []) : [];
    var vaultCards = [];
    if (typeof CardStateAuthority !== 'undefined' && typeof CardStateAuthority.getVault === 'function') {
      vaultCards = CardStateAuthority.getVault() || [];
    } else if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getPersistentCards === 'function') {
      vaultCards = GAMESTATE.getPersistentCards() || [];
    }
    var items = rawItems.concat(vaultCards);

    // The "cards" view shows the NCH backup deck (canonical, shared with NCH panel).
    var backupCards = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getBackupCards) ? (GAMESTATE.getBackupCards() || []) : [];

    // New-player UX: if items just became non-empty (e.g., first key pickup), force items view.
    try {
      if ((_lastItemsLen === null || _lastItemsLen === 0) && items.length > 0) {
        _prefs.view = 'items';
        _prefs.itemOffset = 0;
        _savePrefs();
      }
    } catch (e0) {}

    var view = _prefs.view === 'items' ? 'items' : 'cards';

    // Stamp data attributes so NCH drag-drop can detect the left column
    // and its current view mode from the DOM (reliable, always current).
    _container.setAttribute('data-rogue-sidebar-active', '1');
    _container.setAttribute('data-rogue-sidebar-view', view);

    var strActive = false;
    try {
      strActive = (typeof GoneRogue !== 'undefined' && typeof GoneRogue.isStrCombatActive === 'function' && GoneRogue.isStrCombatActive());
    } catch (e0) { strActive = false; }

    // Fetch refs
    var activeItem = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getActiveItem) ? GAMESTATE.getActiveItem() : null;

    // Ensure any prior STR draw hover cursor is cleared when switching modes.
    _deactivateGhostJokerCursor();

    // STR combat view: left column becomes redacted BACKUP deck surface
    if (strActive) {
      var backup = (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getBackupCards === 'function') ? (GAMESTATE.getBackupCards() || []) : [];
      var canDraw = (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.canDrawBackupThisCombat === 'function') ? !!GAMESTATE.canDrawBackupThisCombat() : false;
      var hasBackup = Array.isArray(backup) && backup.some(function(r) { return r && r.id; });

      var sigB = ['v=str', 'draw=' + (canDraw ? '1' : '0')];
      for (var bi = 0; bi < 4; bi++) {
        var br = backup[bi];
        sigB.push(br && br.id ? (br.id + ':' + (br.qty || 1)) : '-');
      }
      var signatureB = sigB.join('|');
      if (signatureB === _lastSignature) return;
      _lastSignature = signatureB;

      _container.innerHTML = '';

      // Slot 1 becomes DRAW button
      var drawBtn = document.createElement('button');
      drawBtn.type = 'button';
      drawBtn.className = 'rogue-sidebar-btn rogue-sidebar-toggle';
      drawBtn.textContent = (canDraw && hasBackup) ? 'DRAW 1' : 'BACKUP';
      drawBtn.disabled = !(canDraw && hasBackup);
      drawBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (drawBtn.disabled) return;
        var drawRes = null;
        if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.drawOneFromBackupPerTurn === 'function') {
          drawRes = GAMESTATE.drawOneFromBackupPerTurn();
        } else if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.drawOneFromBackupOncePerCombat === 'function') {
          drawRes = GAMESTATE.drawOneFromBackupOncePerCombat();
        }
        // Notify hand changed so BLVCK can auto-remove if drawn card is playable
        if (drawRes && drawRes.success) {
          try { window.dispatchEvent(new CustomEvent('rogue-hand-changed', { detail: { source: 'sidebar-str-draw', cardId: drawRes.cardId } })); } catch (e0) {}
        }
        // force refresh
        _lastSignature = null;
        _render();
      });
      // Hover feedback: show a joker "ghost" cursor to reinforce randomness.
      drawBtn.addEventListener('pointerenter', function() {
        if (!drawBtn.disabled) _activateGhostJokerCursor();
      });
      drawBtn.addEventListener('pointerleave', function() {
        _deactivateGhostJokerCursor();
      });
      _container.appendChild(drawBtn);

      // Slots 2-5: preview backup (redacted/non-interactive baseline)
      for (var i = 0; i < 4; i++) {
        var ref = backup[i] || null;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'rogue-sidebar-btn card-button';
        btn.disabled = true;

        if (!ref || !ref.id) {
          btn.classList.add('empty');
          btn.textContent = '—';
        } else {
          var cardDef = (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getCard) ? GoneRogueDataRegistry.getCard(ref.id) : null;
          var em = cardDef && cardDef.emoji ? cardDef.emoji : '🃏';
          btn.innerHTML = '<span class="rs-emoji">' + em + '</span><span class="rs-label">' + 'REDACTED' + '</span>';
        }

        _container.appendChild(btn);
      }

      // Slot 6: cycle placeholder (disabled)
      var cycleBtn = document.createElement('button');
      cycleBtn.type = 'button';
      cycleBtn.className = 'rogue-sidebar-btn rogue-sidebar-cycle disabled';
      cycleBtn.textContent = ' ';
      cycleBtn.disabled = true;
      _container.appendChild(cycleBtn);

      return;
    }

    var list = (view === 'items') ? items : backupCards;
    var offsetKey = (view === 'items') ? 'itemOffset' : 'cardOffset';
    var offset = (view === 'items') ? Number(_prefs.itemOffset || 0) : 0;

    // 3D Printer armed state (for x2 cue on eligible ammo/battery cards)
    var printerArmed = false;
    try {
      if (activeItem && activeItem.id && activeItem.meta && activeItem.meta.toggled) {
        var idef = (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getItem) ? GoneRogueDataRegistry.getItem(activeItem.id) : null;
        if (idef && Array.isArray(idef.effects)) {
          for (var pi = 0; pi < idef.effects.length; pi++) {
            if (idef.effects[pi] && idef.effects[pi].type === 'printer_3d') { printerArmed = true; break; }
          }
        }
      }
    } catch (e0) {}
    if (!isFinite(offset) || offset < 0) offset = 0;

    var maxVisible = 4;
    var maxOffset = (view === 'items') ? Math.max(0, list.length - maxVisible) : 0;
    if (offset > maxOffset) offset = maxOffset;
    if (view === 'items') _prefs.itemOffset = offset;

    // Signature to avoid re-render flicker (hover flashing)
    var sigParts = [
      'v=' + view,
      'io=' + (_prefs.itemOffset || 0),
      'il=' + items.length,
      'cl=' + backupCards.filter(function(r) { return r && r.id; }).length,
      'ai=' + (activeItem && activeItem.id ? activeItem.id : ''),
      'pa=' + (printerArmed ? '1' : '0')
    ];

    // include visible slice ids/qty
    for (var si = 0; si < maxVisible; si++) {
      var refSig = list[offset + si];
      if (refSig && refSig.id) sigParts.push(refSig.id + ':' + (refSig.qty || 1));
      else sigParts.push('-');
    }

    var signature = sigParts.join('|');
    if (signature === _lastSignature) {
      return;
    }
    _lastSignature = signature;

    // Highlight the container when items list grows (e.g., first key pickup)
    try {
      if (view === 'items') {
        var curLen = items.length;
        if (_lastItemsLen === null) _lastItemsLen = curLen;
        if (curLen > _lastItemsLen) {
          _container.classList.remove('rs-flash');
          void _container.offsetWidth;
          _container.classList.add('rs-flash');
          setTimeout(function() {
            try { _container.classList.remove('rs-flash'); } catch (e0) {}
          }, 420);
        }
        _lastItemsLen = curLen;
      }
    } catch (eF0) {}

    _container.innerHTML = '';

    // Slot 1: toggle view
    var toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'rogue-sidebar-btn rogue-sidebar-toggle';
    // Swapper copy: items view should clearly indicate "back to cards".
    toggleBtn.textContent = (view === 'items') ? '← Cards' : 'Items →';
    toggleBtn.addEventListener('click', function() {
      _prefs.view = (view === 'items') ? 'cards' : 'items';
      _savePrefs();
      _render();
    });
    _container.appendChild(toggleBtn);

    // Slots 2-5: entries
    for (var i = 0; i < maxVisible; i++) {
      var idx = offset + i;
      var ref = (idx < list.length) ? list[idx] : null;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rogue-sidebar-btn card-button';
      btn.dataset.index = String(idx);
      btn.dataset.view = view;

      if (!ref || !ref.id) {
        btn.classList.add('empty');
        btn.textContent = '[     ]';
        btn.disabled = true;
      } else {
        if (view === 'items') {
          // SharedItemRenderer resolves item/card with full fallback chain
          var resolved = (typeof SharedItemRenderer !== 'undefined')
            ? SharedItemRenderer.resolve(ref)
            : { emoji: '📦', name: ref.id, isItem: true, isCard: false, equipSlot: 'none', isMissing: true };
          var isVaultCard = resolved.isCard;
          // Vault cards always show joker face in sidebar
          var em = isVaultCard ? '🃏' : resolved.emoji;
          var nm = _getViewportName(resolved.name);
          btn.innerHTML = '<span class="rs-emoji">' + em + '</span><span class="rs-label">' + nm + '</span>';

          if (!isVaultCard && resolved.equipSlot && resolved.equipSlot !== 'none') {
            btn.classList.add('equippable');
          }

          if (!isVaultCard && activeItem && activeItem.id === ref.id) {
            btn.classList.add('selected');
          }

          if (isVaultCard) {
            // Vault cards: drag to NCH hand/backup/capsule, or click to cascade into hand
            btn.classList.add('vault-card');

            // Drag handler: use NCH external drag engine for vault cards
            btn.addEventListener('pointerdown', function(e) {
              if (!e || e.pointerType === 'touch') return;
              if (e.button !== undefined && e.button !== 0) return;

              var vIdx = Number(e.currentTarget.dataset.index);
              var vRef = items[vIdx] || null;
              var vId = vRef ? vRef.id : null;
              if (!vId) return;

              var vDef = (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getCard) ? GoneRogueDataRegistry.getCard(vId) : null;
              var vEmoji = (vDef && vDef.emoji) ? vDef.emoji : '🃏';

              try {
                if (typeof NonCombatHUD !== 'undefined' && typeof NonCombatHUD.startExternalDrag === 'function') {
                  NonCombatHUD.startExternalDrag({ kind: 'vault', id: vId, emoji: vEmoji }, e);
                  return;
                }
              } catch (e0) {}
            });

            // Click fallback: cascade vault card into hand (bumps last card to backup if full)
            btn.addEventListener('click', function(e) {
              e.stopPropagation();
              var id = (items[Number(e.currentTarget.dataset.index)] || {}).id;
              if (!id) return;

              var ok = false;
              if (typeof CardStateAuthority !== 'undefined' && typeof CardStateAuthority.cascadeVaultToHandTop === 'function') {
                ok = !!CardStateAuthority.cascadeVaultToHandTop(id);
              } else if (typeof CardStateAuthority !== 'undefined' && typeof CardStateAuthority.moveVaultToHand === 'function') {
                ok = !!CardStateAuthority.moveVaultToHand(id, 1);
              }
              if (ok) {
                if (typeof TooltipSystem !== 'undefined') TooltipSystem.showPersistent('🃏 → Hand', 650);
              } else {
                if (typeof TooltipSystem !== 'undefined') TooltipSystem.showPersistent('❌ Hand full', 900);
              }

              _lastSignature = null;
              _render();
            });
          } else {
            // Regular items: click to equip/unequip, drag to incinerator or grid
            btn.addEventListener('click', function(e) {
              e.stopPropagation();
              // Ignore clicks that were actually drags
              if (e.currentTarget._wasDragged) {
                e.currentTarget._wasDragged = false;
                return;
              }
              var id = (items[Number(e.currentTarget.dataset.index)] || {}).id;
              if (!id) return;

              var active = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getActiveItem) ? GAMESTATE.getActiveItem() : null;
              if (active && active.id === id) {
                GAMESTATE.clearActiveItem();
              } else {
                GAMESTATE.setActiveItem({ id: id, qty: 1 });
              }

              // Force refresh to reflect selection state
              _lastSignature = null;
              _render();
            });

            // Drag handler for items: incinerator disposal + key deployment to grid
            btn.addEventListener('pointerdown', function(e) {
              if (!e || e.pointerType === 'touch') return;
              if (e.button !== undefined && e.button !== 0) return;

              var iIdx = Number(e.currentTarget.dataset.index);
              var iRef = items[iIdx] || null;
              if (!iRef || !iRef.id) return;

              var iResolved = (typeof SharedItemRenderer !== 'undefined')
                ? SharedItemRenderer.resolve(iRef)
                : { emoji: '📦', name: iRef.id };

              var startX = e.clientX;
              var startY = e.clientY;
              var dragThreshold = 8;
              var isDragging = false;
              var ghost = null;
              var btnEl = e.currentTarget;

              var handleMove = function(moveE) {
                var dx = moveE.clientX - startX;
                var dy = moveE.clientY - startY;
                if (!isDragging && Math.sqrt(dx * dx + dy * dy) > dragThreshold) {
                  isDragging = true;
                  btnEl._wasDragged = true;
                  ghost = document.createElement('div');
                  ghost.className = 'nch-drag-ghost';
                  ghost.textContent = iResolved.emoji || '📦';
                  ghost.style.position = 'fixed';
                  ghost.style.zIndex = '99999';
                  ghost.style.pointerEvents = 'none';
                  ghost.style.fontSize = '28px';
                  ghost.style.left = moveE.clientX + 'px';
                  ghost.style.top = moveE.clientY + 'px';
                  ghost.style.transform = 'translate(-50%, -50%)';
                  document.body.appendChild(ghost);
                }
                if (isDragging && ghost) {
                  ghost.style.left = moveE.clientX + 'px';
                  ghost.style.top = moveE.clientY + 'px';
                }
              };

              var handleUp = function(upE) {
                document.removeEventListener('pointermove', handleMove);
                document.removeEventListener('pointerup', handleUp);
                if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);

                if (!isDragging) return;

                var dropEl = document.elementFromPoint(upE.clientX, upE.clientY);

                // Check debrief feed (incinerator)
                var debriefScreen = document.getElementById('debrief-screen');
                if (dropEl && debriefScreen && (dropEl === debriefScreen || debriefScreen.contains(dropEl))) {
                  // Incinerate item
                  if (typeof GAMESTATE !== 'undefined' && GAMESTATE.removePersistentInventoryItem) {
                    GAMESTATE.removePersistentInventoryItem(iIdx);
                  }
                  debriefScreen.classList.add('incinerator-active');
                  setTimeout(function() { debriefScreen.classList.remove('incinerator-active'); }, 600);
                  if (typeof DebriefFeedController !== 'undefined' && DebriefFeedController.flashIncinerator) {
                    DebriefFeedController.flashIncinerator({ kind: 'disposal', durationMs: 600 });
                  }
                  if (typeof TooltipSystem !== 'undefined') {
                    TooltipSystem.show('\uD83D\uDD25 ' + (iResolved.name || 'Item') + ' disposed', 2000);
                  }
                  _lastSignature = null;
                  _render();
                  return;
                }

                // Check grid drop (key deployment)
                var gridContainer = document.getElementById('rogue-grid-mobile');
                if (dropEl && gridContainer && (dropEl === gridContainer || gridContainer.contains(dropEl))) {
                  // Only deploy key items and quest keys
                  var resolvedItem = (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getItem)
                    ? GoneRogueDataRegistry.getItem(iRef.id) : null;
                  var isKey = (resolvedItem && resolvedItem.type === 'key') || (iRef.type === 'key') || (iRef.subtype === 'quest');
                  var isDeployable = (typeof GoneRogue !== 'undefined' && GoneRogue.isBoxDeployItem && GoneRogue.isBoxDeployItem(iRef.id));

                  if (isKey || isDeployable) {
                    // Equip as active item so it's ready to use
                    if (typeof GAMESTATE !== 'undefined' && GAMESTATE.setActiveItem) {
                      GAMESTATE.setActiveItem({ id: iRef.id, qty: 1 });
                    }
                    // Trigger interact to use the key if adjacent to a gate/NPC
                    if (typeof GoneRogue !== 'undefined' && GoneRogue.process) {
                      GoneRogue.process('interact');
                    }
                    if (typeof TooltipSystem !== 'undefined') {
                      TooltipSystem.show((iResolved.emoji || '🔑') + ' ' + (iResolved.name || 'Key') + ' deployed', 1500);
                    }
                    _lastSignature = null;
                    _render();
                    return;
                  }
                }

                // Dropped elsewhere — no action
                _lastSignature = null;
                _render();
              };

              document.addEventListener('pointermove', handleMove);
              document.addEventListener('pointerup', handleUp);
            });
          }
        } else {
          var card = (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getCard) ? GoneRogueDataRegistry.getCard(ref.id) : null;
          var nm2 = _getViewportName(card ? card.name : ref.id);
          var em2 = card ? card.emoji : '🃏';
          var qty = ref.qty || 1;

          var x2 = '';
          try {
            if (printerArmed && card) {
              var _pSfx = (typeof CostPrinterSystem !== 'undefined' && CostPrinterSystem.getDisplaySuffix)
                ? CostPrinterSystem.getDisplaySuffix(card) : '';
              if (_pSfx) { x2 = '<span class="printer-x2">' + _pSfx + '</span>'; btn.classList.add('printer-eligible'); }
            }
          } catch (e1) {}

          // Only show qty badge when qty > 1 (no "x1" clutter).
          // Qty badge overlaps the label (absolute positioned) rather than taking separate space.
          var qtyHtml = (qty > 1) ? '<span class="rs-qty-overlay">x' + qty + '</span>' : '';
          btn.style.position = 'relative';
          btn.innerHTML = '<span class="rs-emoji">' + em2 + '</span><span class="rs-label">' + nm2 + '</span>' + x2 + qtyHtml;

          btn.addEventListener('pointerdown', function(e) {
            if (!e || e.pointerType === 'touch') return;
            if (e.button !== undefined && e.button !== 0) return;

            var bIdx = Number(e.currentTarget.dataset.index);
            var bRef = (backupCards[bIdx] || null);
            var bCardId = bRef ? bRef.id : null;
            if (!bCardId) return;

            var bCardDef = (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getCard) ? GoneRogueDataRegistry.getCard(bCardId) : null;
            var bEmoji = bCardDef ? (bCardDef.emoji || '🃏') : '🃏';

            // Use the canonical NCH drag engine with kind:'backup' so drop onto NCH hand
            // calls moveBackupIndexToHand, which is the same as clicking the HAND→ button.
            try {
              if (typeof NonCombatHUD !== 'undefined' && typeof NonCombatHUD.startExternalDrag === 'function') {
                NonCombatHUD.startExternalDrag({ kind: 'backup', backupIndex: bIdx, id: bCardId, emoji: bEmoji }, e);
                return;
              }
              if (typeof TooltipSystem !== 'undefined') {
                TooltipSystem.showPersistent('⚠️ NCH not ready (drag disabled)', 900);
              }
            } catch (e0) {}
          });

          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var bIdx = Number(e.currentTarget.dataset.index);
            var bRef = (backupCards[bIdx] || null);
            if (!bRef || !bRef.id) return;

            // Click: backup -> HAND (canonical move via GAMESTATE, mirrors NCH "HAND→" button)
            var okMove = false;
            if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.moveBackupIndexToHand === 'function') {
              okMove = !!GAMESTATE.moveBackupIndexToHand(bIdx).success;
            }
            if (!okMove) {
              if (typeof TooltipSystem !== 'undefined') {
                TooltipSystem.showPersistent('❌ Cannot move to hand', 900);
              }
              return;
            }

            if (typeof TooltipSystem !== 'undefined') {
              TooltipSystem.showPersistent('🃏 Moved to hand', 650);
            }

            _lastSignature = null;
            _render();
          });
        }
      }

      _container.appendChild(btn);
    }

    // Slot 6: cycle (enabled only for items view overflow)
    var cycleBtn = document.createElement('button');
    cycleBtn.type = 'button';
    cycleBtn.className = 'rogue-sidebar-btn rogue-sidebar-cycle';

    var overflow = view === 'items' && list.length > maxVisible;
    cycleBtn.textContent = overflow ? '↻ Cycle' : ' '; // keep height stable
    if (!overflow) {
      cycleBtn.classList.add('disabled');
      cycleBtn.disabled = true;
    } else {
      cycleBtn.addEventListener('click', function() {
        var next = (_prefs.itemOffset || 0) + 1;
        if (next > maxOffset) next = 0;
        _prefs.itemOffset = next;
        _savePrefs();
        _lastSignature = null;
        _render();
      });
    }
    _container.appendChild(cycleBtn);

    _savePrefs();
  }

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    init: init,
    /** @returns {'items'|'cards'} Current view mode */
    getView: function() { return _prefs.view === 'items' ? 'items' : 'cards'; }
  };
})();
