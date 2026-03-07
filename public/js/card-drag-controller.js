/* ============================================================
   EYES ONLY — CardDragController
   Unified pointer-based drag system for all card interactions.
   Replaces: pointer-hold targeting, HTML5 drag, CardTransferManager drag.
   See: STR_COMBAT_DRAG_UNIFICATION.md Phase 1
   ============================================================ */

var CardDragController = (function() {
  'use strict';

  // ── Drag state ─────────────────────────────────────────────
  var _state = null;
  // When active, _state = {
  //   cardEl:        Element,  // original card element in the fan
  //   cardIndex:     Number,   // index in hand fan
  //   card:          Object,   // card data { id, name, emoji, ... }
  //   sourceZone:    String,   // 'hand-fan', 'enemy-hand', etc.
  //   ghostEl:       Element,  // fixed-position clone following cursor
  //   placeholderEl: Element,  // dotted outline in the fan slot
  //   wrapperEl:     Element,  // the .hand-card-wrapper (hidden during drag)
  //   startX:        Number,   // pointer start X
  //   startY:        Number,   // pointer start Y
  //   grabOffsetX:   Number,   // offset from card top-left to grab point
  //   grabOffsetY:   Number,
  //   pointerId:     Number,
  //   strMinimized:  Boolean,  // did we minimize STR during this drag?
  //   phase:         String,   // 'dragging' | 'returning' | 'deploying'
  //   activeZone:    String|null, // id of zone currently under pointer
  //   outsideStrMs:  Number    // timestamp when pointer first left STR bounds
  // }

  // ── Tap-target state ───────────────────────────────────────
  var _tapTarget = null;
  // When active, _tapTarget = {
  //   card:       Object,
  //   sourceZone: String,
  //   validZones: Array,   // zone ids that accept this card
  //   activeIndex: Number  // for keyboard/adaptive cycling
  // }

  // ── Encounter profile ──────────────────────────────────────
  var _profile = null;
  // Active drag profile from STREncounterProfile.drag:
  // { minimizable, dwellThresholdMs, groundEffectsEnabled,
  //   disposalEnabled, bossDropZones, ghostClass }

  var _enabled = true;        // false during minigame encounters
  var _context = 'exploration'; // current mode: 'combat', 'exploration', 'nch-open', 'shop-open'

  // ── Drop zone registry ─────────────────────────────────────
  var _zones = {};
  // keyed by zone id → { element, id, accepts, onDragOver, onDragLeave, onDrop, contexts }

  var _bossZoneIds = [];  // track boss-specific zones for cleanup

  // ── Default profile ────────────────────────────────────────
  var _defaultProfile = {
    minimizable: true,
    dwellThresholdMs: 600,
    groundEffectsEnabled: true,
    disposalEnabled: true,
    bossDropZones: [],
    ghostClass: ''
  };

  // ══════════════════════════════════════════════════════════
  //  DROP ZONE REGISTRY
  // ══════════════════════════════════════════════════════════

  /**
   * Register a drop zone.
   * @param {Element} element - DOM element that defines the zone bounds
   * @param {Object} config  - { id, accepts, onDragOver, onDragLeave, onDrop, contexts }
   */
  function registerDropZone(element, config) {
    if (!element || !config || !config.id) {
      console.warn('[CardDragController] registerDropZone: missing element or config.id');
      return;
    }
    _zones[config.id] = {
      element: element,
      id: config.id,
      accepts: config.accepts || function() { return true; },
      onDragOver: config.onDragOver || function() {},
      onDragLeave: config.onDragLeave || function() {},
      onDrop: config.onDrop || function() {},
      contexts: config.contexts || ['combat', 'exploration']
    };
  }

  /**
   * Unregister a drop zone by id.
   * @param {String} id
   */
  function unregisterDropZone(id) {
    if (_zones[id]) {
      // Clean up if this zone was active during a drag
      if (_state && _state.activeZone === id) {
        try { _zones[id].onDragLeave(); } catch (e) {}
        _state.activeZone = null;
      }
      delete _zones[id];
    }
  }

  /**
   * Find which registered zone the pointer is currently over.
   * Uses elementFromPoint hit-testing against zone elements.
   * Only returns zones that are active in the current context.
   * @param {Number} x - clientX
   * @param {Number} y - clientY
   * @returns {Object|null} - zone config or null
   */
  function _hitTestZones(x, y) {
    // Temporarily hide ghost so elementFromPoint hits real elements
    if (_state && _state.ghostEl) {
      _state.ghostEl.style.display = 'none';
    }

    var hitEl = document.elementFromPoint(x, y);

    if (_state && _state.ghostEl) {
      _state.ghostEl.style.display = '';
    }

    if (!hitEl) return null;

    // Walk up from hitEl to find a registered zone element
    for (var zoneId in _zones) {
      var zone = _zones[zoneId];

      // Context check
      if (zone.contexts.indexOf(_context) === -1) continue;

      // Element containment check
      if (zone.element && (zone.element === hitEl || zone.element.contains(hitEl))) {
        return zone;
      }
    }

    return null;
  }

  // ══════════════════════════════════════════════════════════
  //  GHOST ELEMENT
  // ══════════════════════════════════════════════════════════

  /**
   * Create the ghost element: a real DOM clone that follows the cursor.
   * @param {Element} cardEl - source card element to clone
   * @param {Number} grabX - pointer X at grab time
   * @param {Number} grabY - pointer Y at grab time
   * @returns {Element} - the ghost element (already appended to body)
   */
  function _createGhost(cardEl, grabX, grabY) {
    var ghost = cardEl.cloneNode(true);

    // Strip fan transforms and positioning; make it a free-floating card
    var rect = cardEl.getBoundingClientRect();
    ghost.style.cssText = [
      'position: fixed',
      'top: ' + rect.top + 'px',
      'left: ' + rect.left + 'px',
      'width: ' + rect.width + 'px',
      'height: ' + rect.height + 'px',
      'transform: scale(0.90)',
      'transform-origin: center center',
      'opacity: 0.92',
      'pointer-events: none',
      'z-index: 10000',
      'margin: 0',
      'transition: transform 0.1s ease-out, opacity 0.1s ease-out',
      'box-shadow: 0 8px 24px rgba(0,0,0,0.4), 0 2px 8px rgba(128,0,128,0.3)',
      'border-radius: 8px',
      '--fan-ty: 0px',
      '--fan-rot: 0deg'
    ].join('; ') + ';';

    // Apply boss-specific ghost class if present
    var prof = _profile || _defaultProfile;
    if (prof.ghostClass) {
      ghost.classList.add(prof.ghostClass);
    }

    // Remove any selection/hover/tooltip artifacts from clone
    ghost.classList.remove('hand-card-selected', 'hand-card-hovered', 'hand-card-tooltip-open');
    ghost.removeAttribute('data-tooltip-visible');

    // Calculate grab offset (cursor position relative to card top-left)
    _state.grabOffsetX = grabX - rect.left;
    _state.grabOffsetY = grabY - rect.top;

    document.body.appendChild(ghost);
    return ghost;
  }

  /**
   * Move ghost to follow pointer position.
   * @param {Number} x - clientX
   * @param {Number} y - clientY
   */
  function _moveGhost(x, y) {
    if (!_state || !_state.ghostEl) return;
    _state.ghostEl.style.left = (x - _state.grabOffsetX) + 'px';
    _state.ghostEl.style.top = (y - _state.grabOffsetY) + 'px';
  }

  /**
   * Animate ghost back to placeholder position, then remove both.
   * @param {Function} done - callback when animation completes
   */
  function _returnGhostToSlot(done) {
    if (!_state) { if (done) done(); return; }

    var ghost = _state.ghostEl;
    var placeholder = _state.placeholderEl;
    var wrapper = _state.wrapperEl;

    if (!ghost || !placeholder) {
      _cleanupDragDOM();
      if (done) done();
      return;
    }

    // Animate ghost to placeholder position
    var phRect = placeholder.getBoundingClientRect();
    ghost.style.transition = 'left 0.2s ease-out, top 0.2s ease-out, opacity 0.2s ease-out';
    ghost.style.left = phRect.left + 'px';
    ghost.style.top = phRect.top + 'px';
    ghost.style.opacity = '0.5';

    setTimeout(function() {
      _cleanupDragDOM();
      if (done) done();
    }, 220);
  }

  /**
   * Collapse placeholder with animation (card was consumed: deployed/disposed/sold).
   */
  function _collapsePlaceholder() {
    if (!_state) return;

    var ghost = _state.ghostEl;
    var placeholder = _state.placeholderEl;

    // Remove ghost immediately
    if (ghost && ghost.parentNode) {
      ghost.parentNode.removeChild(ghost);
    }

    // Animate placeholder collapse
    if (placeholder && placeholder.parentNode) {
      placeholder.classList.add('placeholder-collapsing');
      var phRef = placeholder;
      setTimeout(function() {
        if (phRef.parentNode) phRef.parentNode.removeChild(phRef);
      }, 260);
    }

    // The original wrapper was hidden — it's now gone (card consumed), so don't restore
  }

  /**
   * Remove ghost + placeholder + restore wrapper visibility.
   */
  function _cleanupDragDOM() {
    if (!_state) return;

    if (_state.ghostEl && _state.ghostEl.parentNode) {
      _state.ghostEl.parentNode.removeChild(_state.ghostEl);
    }

    if (_state.placeholderEl && _state.placeholderEl.parentNode) {
      _state.placeholderEl.parentNode.removeChild(_state.placeholderEl);
    }

    // Restore original card wrapper visibility
    if (_state.wrapperEl) {
      _state.wrapperEl.style.visibility = '';
      _state.wrapperEl.style.opacity = '';
    }
  }

  // ══════════════════════════════════════════════════════════
  //  PLACEHOLDER
  // ══════════════════════════════════════════════════════════

  /**
   * Create placeholder at the card's position in the fan.
   * @param {Element} wrapperEl - .hand-card-wrapper element
   * @returns {Element} - placeholder element (already inserted)
   */
  function _createPlaceholder(wrapperEl) {
    var ph = document.createElement('div');
    ph.className = 'hand-card-drag-placeholder';

    // Copy fan positioning from the wrapper's computed style
    var cs = window.getComputedStyle(wrapperEl);
    ph.style.marginLeft = cs.marginLeft;
    ph.style.zIndex = cs.zIndex;

    // Insert placeholder right before the wrapper
    wrapperEl.parentNode.insertBefore(ph, wrapperEl);

    // Hide the original wrapper (keep in DOM for layout)
    wrapperEl.style.visibility = 'hidden';
    wrapperEl.style.opacity = '0';

    return ph;
  }

  // ══════════════════════════════════════════════════════════
  //  STR WINDOW MINIMIZE / MAXIMIZE
  // ══════════════════════════════════════════════════════════

  /**
   * Check if pointer is inside the STR combat window bounds.
   * @param {Number} x - clientX
   * @param {Number} y - clientY
   * @returns {Boolean}
   */
  function _isInsideStrWindow(x, y) {
    var strEl = document.getElementById('str-combat-window');
    if (!strEl) return false;
    var r = strEl.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  /**
   * Handle the minimize/maximize toggle during drag based on dwell.
   * Called from updateDrag on every pointermove.
   * @param {Number} x - clientX
   * @param {Number} y - clientY
   */
  function _handleStrCollapseLogic(x, y) {
    if (!_state || _context !== 'combat') return;

    var prof = _profile || _defaultProfile;
    var inside = _isInsideStrWindow(x, y);

    if (inside) {
      // Re-entered STR bounds → clear dwell timer, re-maximize if needed
      _state.outsideStrMs = 0;

      if (_state.strMinimized) {
        _state.strMinimized = false;
        if (typeof STRCombatWindow !== 'undefined' && typeof STRCombatWindow.maximize === 'function') {
          STRCombatWindow.maximize();
        }
      }
    } else {
      // Outside STR bounds
      if (!prof.minimizable) {
        // Sniper boss etc: don't allow minimize
        return;
      }

      if (!_state.strMinimized) {
        var now = Date.now();
        if (!_state.outsideStrMs) {
          _state.outsideStrMs = now;
        } else if (now - _state.outsideStrMs >= prof.dwellThresholdMs) {
          // Dwell threshold exceeded → minimize
          _state.strMinimized = true;
          _state.outsideStrMs = 0;

          if (typeof STRCombatWindow !== 'undefined' && typeof STRCombatWindow.minimize === 'function') {
            // Block HandFanComponent.setMode during this minimize
            // (CardDragController owns fan positioning while dragging)
            if (typeof HandFanComponent !== 'undefined') {
              HandFanComponent._dragControllerOwnsMode = true;
            }
            STRCombatWindow.minimize();
          }
        }
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  //  DRAG LIFECYCLE
  // ══════════════════════════════════════════════════════════

  /**
   * Begin a drag operation.
   * @param {Element} cardEl     - the .hand-card element being dragged
   * @param {Number}  cardIndex  - index in the hand fan
   * @param {Object}  card       - card data object { id, name, emoji, ... }
   * @param {String}  sourceZone - e.g. 'hand-fan', 'enemy-hand'
   * @param {PointerEvent} ev    - the originating pointer event
   */
  function beginDrag(cardEl, cardIndex, card, sourceZone, ev) {
    if (!_enabled) return;
    if (_state) {
      // Already dragging — cancel previous
      cancelDrag();
    }

    // Ensure built-in zones are registered (lazy init for elements created after init)
    _ensureBuiltinZones();

    // Cancel any active tap-target mode
    if (_tapTarget) cancelTapTarget();

    // Find the wrapper (.hand-card-wrapper) — parent of the card element
    var wrapperEl = cardEl.closest('.hand-card-wrapper') || cardEl.parentElement;

    _state = {
      cardEl: cardEl,
      cardIndex: cardIndex,
      card: card,
      sourceZone: sourceZone,
      ghostEl: null,
      placeholderEl: null,
      wrapperEl: wrapperEl,
      startX: ev.clientX,
      startY: ev.clientY,
      grabOffsetX: 0,
      grabOffsetY: 0,
      pointerId: ev.pointerId,
      strMinimized: false,
      phase: 'dragging',
      activeZone: null,
      outsideStrMs: 0,
      lastX: ev.clientX,
      lastY: ev.clientY
    };

    // Create placeholder in fan slot
    _state.placeholderEl = _createPlaceholder(wrapperEl);

    // Create ghost element
    _state.ghostEl = _createGhost(cardEl, ev.clientX, ev.clientY);

    // Capture pointer for guaranteed delivery
    if (ev.target && typeof ev.target.setPointerCapture === 'function') {
      try { ev.target.setPointerCapture(ev.pointerId); } catch (e) {}
    }

    console.log('[CardDragController] beginDrag: card=' + (card.id || card.name) +
                ' source=' + sourceZone + ' index=' + cardIndex);
  }

  /**
   * Update drag position and zone detection.
   * Called on every pointermove while dragging.
   * @param {PointerEvent} ev
   */
  function updateDrag(ev) {
    if (!_state || _state.phase !== 'dragging') return;

    var x = ev.clientX;
    var y = ev.clientY;

    // Track last known pointer position for drop zone callbacks
    _state.lastX = x;
    _state.lastY = y;

    // Move ghost to follow pointer
    _moveGhost(x, y);

    // STR minimize/maximize logic
    _handleStrCollapseLogic(x, y);

    // Hit-test drop zones
    var zone = _hitTestZones(x, y);
    var zoneId = zone ? zone.id : null;

    // Zone transition detection
    if (zoneId !== _state.activeZone) {
      // Leave previous zone
      if (_state.activeZone && _zones[_state.activeZone]) {
        try { _zones[_state.activeZone].onDragLeave(); } catch (e) {}
      }

      // Enter new zone
      _state.activeZone = zoneId;

      if (zone && zone.accepts(_state)) {
        try { zone.onDragOver(_state); } catch (e) {}
      }
    } else if (zone && zone.accepts(_state)) {
      // Still in same zone — continuous dragOver for live previews (AoE, etc.)
      try { zone.onDragOver(_state); } catch (e) {}
    }
  }

  /**
   * End the drag — either drop on a zone or cancel.
   * Called on pointerup.
   * @param {PointerEvent} ev
   */
  function endDrag(ev) {
    if (!_state) return;

    var x = ev.clientX;
    var y = ev.clientY;

    // Final hit-test
    var zone = _hitTestZones(x, y);
    var dropped = false;

    if (zone && zone.accepts(_state)) {
      // Attempt the drop
      try {
        var result = zone.onDrop(_state);
        // onDrop returns truthy if the card was consumed
        if (result !== false) {
          dropped = true;
          console.log('[CardDragController] endDrag: dropped on zone=' + zone.id);

          // Card consumed — collapse placeholder
          _state.phase = 'deploying';
          _collapsePlaceholder();
        }
      } catch (e) {
        console.warn('[CardDragController] endDrag: onDrop error for zone=' + zone.id, e);
      }
    }

    // Clean up active zone feedback
    if (_state.activeZone && _zones[_state.activeZone]) {
      try { _zones[_state.activeZone].onDragLeave(); } catch (e) {}
    }

    if (!dropped) {
      // Auto-select the returned card so it counts for this round's resolution
      if (_state.context === 'combat' && _state.cardIndex != null) {
        try {
          if (typeof HandFanComponent !== 'undefined' && typeof HandFanComponent.selectCardByIndex === 'function') {
            HandFanComponent.selectCardByIndex(_state.cardIndex);
          }
        } catch (e) {
          console.warn('[CardDragController] endDrag: auto-select failed', e);
        }
      }
      // Return card to hand
      _state.phase = 'returning';
      _returnGhostToSlot(function() {
        _finalizeDrag();
      });
    } else {
      _finalizeDrag();
    }
  }

  /**
   * Cancel an active drag (escape key, pointercancel, external interruption).
   */
  function cancelDrag() {
    if (!_state) return;

    console.log('[CardDragController] cancelDrag');

    // Clean up active zone feedback
    if (_state.activeZone && _zones[_state.activeZone]) {
      try { _zones[_state.activeZone].onDragLeave(); } catch (e) {}
    }

    _state.phase = 'returning';
    _returnGhostToSlot(function() {
      _finalizeDrag();
    });
  }

  /**
   * Final cleanup after drag completes (successful or cancelled).
   */
  function _finalizeDrag() {
    if (!_state) return;

    // Safety: clear any residual AoE preview tiles
    _clearMapGridPreview();

    // If we minimized STR during drag, re-maximize
    if (_state.strMinimized) {
      if (typeof STRCombatWindow !== 'undefined' && typeof STRCombatWindow.maximize === 'function') {
        STRCombatWindow.maximize();
      }
    }

    // Release the mode lock on HandFanComponent
    if (typeof HandFanComponent !== 'undefined') {
      HandFanComponent._dragControllerOwnsMode = false;
    }

    // Release pointer capture
    if (_state.pointerId != null) {
      try {
        var captured = document.querySelector('[data-pointer-captured]');
        if (captured) captured.releasePointerCapture(_state.pointerId);
      } catch (e) {}
    }

    _state = null;
  }

  // ══════════════════════════════════════════════════════════
  //  TAP-TARGET API (accessibility / adaptive controllers)
  // ══════════════════════════════════════════════════════════

  /**
   * Enter tap-target mode: highlight all valid drop zones for the given card.
   * @param {Object} card       - card data { id, name, ... }
   * @param {String} sourceZone - e.g. 'hand-fan'
   */
  function beginTapTarget(card, sourceZone) {
    if (!_enabled) return;
    if (_state) cancelDrag(); // can't tap-target while dragging

    // Build a mock drag state for zone accepts() checks
    var mockState = {
      card: card,
      sourceZone: sourceZone,
      cardIndex: -1
    };

    // Find all zones that accept this card in the current context
    var validZones = [];
    for (var zoneId in _zones) {
      var zone = _zones[zoneId];
      if (zone.contexts.indexOf(_context) === -1) continue;
      if (zone.accepts(mockState)) {
        validZones.push(zoneId);
        // Visual: add highlight class to zone element
        if (zone.element) {
          zone.element.classList.add('cdc-tap-target-valid');
        }
      }
    }

    if (validZones.length === 0) {
      console.log('[CardDragController] beginTapTarget: no valid zones for card=' + card.id);
      return;
    }

    _tapTarget = {
      card: card,
      sourceZone: sourceZone,
      validZones: validZones,
      activeIndex: 0
    };

    console.log('[CardDragController] beginTapTarget: card=' + card.id +
                ' validZones=[' + validZones.join(', ') + ']');
  }

  /**
   * Commit a tap on a specific zone.
   * @param {String} zoneId - which zone was tapped
   * @returns {Boolean} - true if drop succeeded
   */
  function commitTapTarget(zoneId) {
    if (!_tapTarget) return false;

    var zone = _zones[zoneId];
    if (!zone) {
      cancelTapTarget();
      return false;
    }

    var mockState = {
      card: _tapTarget.card,
      sourceZone: _tapTarget.sourceZone,
      cardIndex: -1
    };

    if (!zone.accepts(mockState)) {
      cancelTapTarget();
      return false;
    }

    var result = false;
    try {
      result = zone.onDrop(mockState);
      if (result !== false) {
        console.log('[CardDragController] commitTapTarget: zone=' + zoneId);
      }
    } catch (e) {
      console.warn('[CardDragController] commitTapTarget error:', e);
    }

    cancelTapTarget();
    return result !== false;
  }

  /**
   * Cycle to next valid zone (for keyboard/adaptive navigation).
   * @returns {String|null} - newly active zone id
   */
  function cycleTapTarget() {
    if (!_tapTarget || _tapTarget.validZones.length === 0) return null;

    // Remove highlight from current
    var oldId = _tapTarget.validZones[_tapTarget.activeIndex];
    if (_zones[oldId] && _zones[oldId].element) {
      _zones[oldId].element.classList.remove('cdc-tap-target-active');
    }

    // Advance
    _tapTarget.activeIndex = (_tapTarget.activeIndex + 1) % _tapTarget.validZones.length;

    // Add highlight to new
    var newId = _tapTarget.validZones[_tapTarget.activeIndex];
    if (_zones[newId] && _zones[newId].element) {
      _zones[newId].element.classList.add('cdc-tap-target-active');
    }

    return newId;
  }

  /**
   * Cancel tap-target mode, removing all highlights.
   */
  function cancelTapTarget() {
    if (!_tapTarget) return;

    // Remove highlights from all valid zones
    for (var i = 0; i < _tapTarget.validZones.length; i++) {
      var zoneId = _tapTarget.validZones[i];
      if (_zones[zoneId] && _zones[zoneId].element) {
        _zones[zoneId].element.classList.remove('cdc-tap-target-valid', 'cdc-tap-target-active');
      }
    }

    _tapTarget = null;
  }

  // ══════════════════════════════════════════════════════════
  //  ENCOUNTER PROFILE
  // ══════════════════════════════════════════════════════════

  /**
   * Apply an encounter drag profile on combat entry.
   * @param {Object|null} dragProfile - from STREncounterProfile.drag, or null for minigame
   */
  function applyProfile(dragProfile) {
    if (dragProfile === null) {
      // Minigame encounter — disable all drag
      _enabled = false;
      _profile = null;
      console.log('[CardDragController] applyProfile: drag DISABLED (minigame encounter)');
      return;
    }

    _enabled = true;
    _profile = {};

    // Merge with defaults
    var keys = Object.keys(_defaultProfile);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      _profile[k] = (dragProfile[k] !== undefined) ? dragProfile[k] : _defaultProfile[k];
    }

    console.log('[CardDragController] applyProfile:', JSON.stringify(_profile));
  }

  /**
   * Clear the encounter profile on combat exit.
   * Unregisters all boss-specific drop zones.
   */
  function clearProfile() {
    // Cancel any active drag
    if (_state) cancelDrag();
    if (_tapTarget) cancelTapTarget();

    // Unregister boss zones
    for (var i = 0; i < _bossZoneIds.length; i++) {
      unregisterDropZone(_bossZoneIds[i]);
    }
    _bossZoneIds = [];

    _profile = null;
    _enabled = true;

    console.log('[CardDragController] clearProfile: reset to defaults');
  }

  /**
   * Register boss-specific drop zones (tracked for cleanup on clearProfile).
   * @param {Array} zoneConfigs - array of { element, config } for registerDropZone
   */
  function registerBossZones(zoneConfigs) {
    if (!Array.isArray(zoneConfigs)) return;

    for (var i = 0; i < zoneConfigs.length; i++) {
      var zc = zoneConfigs[i];
      if (zc.element && zc.config && zc.config.id) {
        registerDropZone(zc.element, zc.config);
        _bossZoneIds.push(zc.config.id);
      }
    }

    console.log('[CardDragController] registerBossZones: ' + _bossZoneIds.length + ' zones');
  }

  // ══════════════════════════════════════════════════════════
  //  CONTEXT
  // ══════════════════════════════════════════════════════════

  /**
   * Set the current interaction context.
   * Zones are only active when their contexts include this value.
   * @param {String} ctx - 'combat', 'exploration', 'nch-open', 'shop-open'
   */
  function setContext(ctx) {
    _context = ctx || 'exploration';
  }

  /**
   * Get current context.
   * @returns {String}
   */
  function getContext() {
    return _context;
  }

  // ══════════════════════════════════════════════════════════
  //  KEYBOARD HANDLER
  // ══════════════════════════════════════════════════════════

  function _onKeyDown(e) {
    // Escape cancels active drag or tap-target
    if (e.key === 'Escape' || e.keyCode === 27) {
      if (_state) {
        cancelDrag();
        e.preventDefault();
      } else if (_tapTarget) {
        cancelTapTarget();
        e.preventDefault();
      }
    }

    // Tab cycles tap-target zones
    if (_tapTarget && (e.key === 'Tab' || e.keyCode === 9)) {
      cycleTapTarget();
      e.preventDefault();
    }

    // Enter commits tap-target on active zone
    if (_tapTarget && (e.key === 'Enter' || e.keyCode === 13)) {
      var activeId = _tapTarget.validZones[_tapTarget.activeIndex];
      if (activeId) {
        commitTapTarget(activeId);
      }
      e.preventDefault();
    }
  }

  // ══════════════════════════════════════════════════════════
  //  INIT
  // ══════════════════════════════════════════════════════════

  function init() {
    // Register keyboard handler
    document.addEventListener('keydown', _onKeyDown, false);

    // ── Register built-in drop zones ──────────────────────────

    // 1. ENEMY-AVATAR zone: dropping a card on the enemy plays it
    _registerEnemyAvatarZone();

    // 2. MAP-GRID zone: dropping a ground-effect card on a map cell deploys the effect
    _registerMapGridZone();

    // 3. DEBRIEF-FEED zone: disposal/self-cast/discard during combat; disposal during exploration
    _registerDebriefFeedZone();

    // 4. DEBRIEF-COMMERCE zone: sell when shop is open (shop-open context)
    _registerDebriefCommerceZone();

    console.log('[CardDragController] init: ready, built-in zones registered');
  }

  // ══════════════════════════════════════════════════════════
  //  BUILT-IN DROP ZONES
  // ══════════════════════════════════════════════════════════

  /**
   * Register the enemy-avatar drop zone.
   * Dropping a card here plays it via GoneRogue.playCardFromHand(cardId).
   * Re-registers when the element appears (lazy, since STR combat window
   * may not exist at init time).
   */
  function _registerEnemyAvatarZone() {
    // Try to find enemy element now; if absent, we'll retry on first drag via _ensureBuiltinZones
    var enemyEl = document.querySelector('.str-combatant.str-enemy');
    if (!enemyEl) return; // will be registered lazily

    registerDropZone(enemyEl, {
      id: 'enemy-avatar',
      contexts: ['combat'],
      accepts: function(dragState) {
        // All hand-fan cards can target the enemy
        return dragState && dragState.sourceZone === 'hand-fan';
      },
      onDragOver: function(dragState) {
        var enemyEl = document.querySelector('.str-combatant.str-enemy');
        if (enemyEl) {
          enemyEl.classList.add('str-enemy-targetable');
          enemyEl.classList.add('str-enemy-targeted');
        }
      },
      onDragLeave: function() {
        var enemyEl = document.querySelector('.str-combatant.str-enemy');
        if (enemyEl) {
          enemyEl.classList.remove('str-enemy-targetable');
          enemyEl.classList.remove('str-enemy-targeted');
        }
      },
      onDrop: function(dragState) {
        // Clean up hover state
        var enemyEl = document.querySelector('.str-combatant.str-enemy');
        if (enemyEl) {
          enemyEl.classList.remove('str-enemy-targetable');
          enemyEl.classList.remove('str-enemy-targeted');
        }

        var card = dragState.card;
        if (card && card.id && typeof GoneRogue !== 'undefined' && typeof GoneRogue.playCardFromHand === 'function') {
          GoneRogue.playCardFromHand(card.id);
          return true; // card consumed
        }
        return false;
      }
    });
  }

  /**
   * Register the map-grid drop zone.
   * Dropping a ground-effect card here deploys the effect and consumes the card.
   */
  function _registerMapGridZone() {
    var gridEl = document.getElementById('rogue-grid');
    if (!gridEl) return; // will be registered lazily

    registerDropZone(gridEl, {
      id: 'map-grid',
      contexts: ['combat'],
      accepts: function(dragState) {
        if (!dragState || dragState.sourceZone !== 'hand-fan') return false;
        var prof = _profile || _defaultProfile;
        if (!prof.groundEffectsEnabled) return false;
        // Must have ground-effect mapping
        if (typeof GroundEffectCardMappings === 'undefined' || typeof GroundEffectCardMappings.getMappingForCard !== 'function') return false;
        var mapping = GroundEffectCardMappings.getMappingForCard(dragState.card);
        return !!(mapping && mapping.type);
      },
      onDragOver: function(dragState) {
        // Show AoE preview on map tiles using last pointer position
        _updateMapGridPreview(dragState);
      },
      onDragLeave: function() {
        _clearMapGridPreview();
      },
      onDrop: function(dragState) {
        // Clear AoE preview
        _clearMapGridPreview();

        if (typeof GroundEffectCardMappings === 'undefined') return false;
        var mapping = GroundEffectCardMappings.getMappingForCard(dragState.card);
        if (!mapping || !mapping.type) return false;
        if (typeof GroundEffects === 'undefined' || typeof GroundEffects.setGroundEffect !== 'function') return false;

        // Find which grid cell the pointer is over using last known coordinates
        var dropX = dragState.lastX || 0;
        var dropY = dragState.lastY || 0;
        if (_state && _state.ghostEl) _state.ghostEl.style.display = 'none';
        var hitEl = document.elementFromPoint(dropX, dropY);
        if (_state && _state.ghostEl) _state.ghostEl.style.display = '';

        var cell = hitEl ? (hitEl.closest ? hitEl.closest('.rogue-cell') : null) : null;
        if (!cell || !cell.dataset || cell.dataset.x == null || cell.dataset.y == null) return false;

        var gx = Number(cell.dataset.x);
        var gy = Number(cell.dataset.y);
        if (!isFinite(gx) || !isFinite(gy)) return false;

        var overrides = {};
        if (mapping.lifetimeSec && mapping.lifetimeSec > 0) {
          overrides.dissipates = true;
          overrides.lifetime = mapping.lifetimeSec;
        }

        var r = Math.max(0, Number(mapping.radius || 0));
        for (var dy = -r; dy <= r; dy++) {
          for (var dx = -r; dx <= r; dx++) {
            var tx = gx + dx;
            var ty = gy + dy;
            if (mapping.type === 'ICE' && typeof GroundEffects.freezeAt === 'function') {
              GroundEffects.freezeAt(tx, ty, { lifetime: mapping.lifetimeSec });
            } else {
              GroundEffects.setGroundEffect(tx, ty, mapping.type, overrides);
            }
          }
        }

        // Consume the card from loose inventory
        var cardId = dragState.card ? dragState.card.id : null;
        if (cardId && typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getLooseInventory === 'function') {
          var loose = GAMESTATE.getLooseInventory();
          if (Array.isArray(loose)) {
            for (var li = 0; li < loose.length; li++) {
              if (loose[li] && loose[li].id === cardId) {
                loose.splice(li, 1);
                if (typeof HandFanComponent !== 'undefined' && typeof HandFanComponent.updateCards === 'function') {
                  HandFanComponent.updateCards(loose);
                }
                break;
              }
            }
          }
        }

        if (typeof TooltipSystem !== 'undefined') {
          TooltipSystem.showPersistent('🌋 DEPLOYED ' + (mapping.type || 'EFFECT') + ' @(' + gx + ',' + gy + ')', 1300);
        }

        return true; // card consumed
      }
    });
  }

  // ── Map grid AoE preview helpers ──────────────────────────
  var _aoeRaf = null;
  var _aoeLastKey = null;

  function _clearMapGridPreview() {
    if (_aoeRaf) { cancelAnimationFrame(_aoeRaf); _aoeRaf = null; }
    try {
      var cells = document.querySelectorAll('.rogue-cell.aoe-exact, .rogue-cell.aoe-prob, .rogue-cell.aoe-far');
      for (var i = 0; i < cells.length; i++) {
        cells[i].classList.remove('aoe-exact', 'aoe-prob', 'aoe-far');
      }
    } catch (e) {}
    _aoeLastKey = null;
  }

  function _updateMapGridPreview(dragState) {
    if (_aoeRaf) return; // RAF-throttle
    _aoeRaf = requestAnimationFrame(function() {
      _aoeRaf = null;
      _updateMapGridPreviewNow(dragState);
    });
  }

  function _updateMapGridPreviewNow(dragState) {
    if (typeof GroundEffectCardMappings === 'undefined' || typeof GroundEffectCardMappings.getMappingForCard !== 'function') {
      _clearMapGridPreview();
      return;
    }

    var mapping = GroundEffectCardMappings.getMappingForCard(dragState.card);
    if (!mapping || !mapping.type) { _clearMapGridPreview(); return; }

    // Find cell under pointer
    var px = dragState.lastX || 0;
    var py = dragState.lastY || 0;
    if (_state && _state.ghostEl) _state.ghostEl.style.display = 'none';
    var elAt = document.elementFromPoint(px, py);
    if (_state && _state.ghostEl) _state.ghostEl.style.display = '';

    var cell = elAt ? (elAt.closest ? elAt.closest('.rogue-cell') : null) : null;
    if (!cell || !cell.dataset || cell.dataset.x == null) { _clearMapGridPreview(); return; }

    var gx = Number(cell.dataset.x);
    var gy = Number(cell.dataset.y);
    if (!isFinite(gx) || !isFinite(gy)) { _clearMapGridPreview(); return; }

    var key = gx + ',' + gy + ':' + String(mapping.type) + ':' + String(mapping.radius || 0);
    if (_aoeLastKey === key) return;
    _aoeLastKey = key;

    // Clear previous preview
    try {
      var old = document.querySelectorAll('.rogue-cell.aoe-exact, .rogue-cell.aoe-prob, .rogue-cell.aoe-far');
      for (var i = 0; i < old.length; i++) old[i].classList.remove('aoe-exact', 'aoe-prob', 'aoe-far');
    } catch (e) {}

    var r = Math.max(0, Number(mapping.radius || 0));
    var pr = r + 1;

    // Exact tiles
    for (var dy = -r; dy <= r; dy++) {
      for (var dx = -r; dx <= r; dx++) {
        var c = document.querySelector('.rogue-cell[data-x="' + (gx + dx) + '"][data-y="' + (gy + dy) + '"]');
        if (c) c.classList.add('aoe-exact');
      }
    }

    // Probabilistic ring
    for (var dy2 = -pr; dy2 <= pr; dy2++) {
      for (var dx2 = -pr; dx2 <= pr; dx2++) {
        if (Math.abs(dx2) <= r && Math.abs(dy2) <= r) continue;
        var c2 = document.querySelector('.rogue-cell[data-x="' + (gx + dx2) + '"][data-y="' + (gy + dy2) + '"]');
        if (c2) c2.classList.add('aoe-prob');
      }
    }

    // Far reach cross-hair
    var reach = 10;
    for (var i2 = 1; i2 <= reach; i2++) {
      var up = document.querySelector('.rogue-cell[data-x="' + gx + '"][data-y="' + (gy - i2) + '"]');
      var dn = document.querySelector('.rogue-cell[data-x="' + gx + '"][data-y="' + (gy + i2) + '"]');
      var lf = document.querySelector('.rogue-cell[data-x="' + (gx - i2) + '"][data-y="' + gy + '"]');
      var rt = document.querySelector('.rogue-cell[data-x="' + (gx + i2) + '"][data-y="' + gy + '"]');
      if (up) up.classList.add('aoe-far');
      if (dn) dn.classList.add('aoe-far');
      if (lf) lf.classList.add('aoe-far');
      if (rt) rt.classList.add('aoe-far');
    }
  }

  // ── Debrief feed disposal/discard zone ────────────────────

  /**
   * Register the debrief-feed drop zone for card disposal.
   * In combat: self-cast cards apply their effects; other cards go to backup deck.
   * Outside combat: disposable cards are destroyed.
   * Delegates to CardDisposalSystem for validation and effect application.
   */
  function _registerDebriefFeedZone() {
    var debriefEl = document.getElementById('debrief-screen');
    if (!debriefEl) return; // will be registered lazily

    registerDropZone(debriefEl, {
      id: 'debrief-feed',
      contexts: ['combat', 'exploration'],
      accepts: function(dragState) {
        if (!dragState || dragState.sourceZone !== 'hand-fan') return false;
        var card = dragState.card;
        if (!card) return false;

        // BLVCK guard: struggle card cannot be disposed
        var blvckId = (typeof CardStateAuthority !== 'undefined' && CardStateAuthority.BLVCK_ID)
          ? CardStateAuthority.BLVCK_ID : 'ACT-000';
        if (card.id === blvckId || card.id === 'ACT-000' || card.name === 'BLVCK') return false;

        return true;
      },
      onDragOver: function(dragState) {
        var debriefEl = document.getElementById('debrief-screen');
        if (!debriefEl) return;

        debriefEl.classList.remove('debrief-drop-target', 'debrief-drop-target-self', 'debrief-drop-target-invalid');

        var inCombat = (typeof GoneRogue !== 'undefined' && typeof GoneRogue.isStrCombatActive === 'function' && GoneRogue.isStrCombatActive());
        var card = dragState.card;

        if (inCombat) {
          // Self-cast cards get self-target glow
          if (_isSelfCastCard(card)) {
            debriefEl.classList.add('debrief-drop-target-self');
            if (typeof TooltipSystem !== 'undefined') {
              TooltipSystem.showPersistent('🧑 SELF TARGET: drop to apply', 650);
            }
          } else {
            debriefEl.classList.add('debrief-drop-target');
            if (typeof TooltipSystem !== 'undefined') {
              TooltipSystem.showPersistent('♻️ DISCARD to backup deck', 650);
            }
          }
        } else {
          debriefEl.classList.add('debrief-drop-target');
        }
      },
      onDragLeave: function() {
        var debriefEl = document.getElementById('debrief-screen');
        if (debriefEl) {
          debriefEl.classList.remove('debrief-drop-target', 'debrief-drop-target-self', 'debrief-drop-target-invalid');
        }
      },
      onDrop: function(dragState) {
        var debriefEl = document.getElementById('debrief-screen');
        if (debriefEl) {
          debriefEl.classList.remove('debrief-drop-target', 'debrief-drop-target-self', 'debrief-drop-target-invalid');
        }

        var card = dragState.card;
        var cardIndex = dragState.cardIndex;
        if (!card) return false;

        // BLVCK belt-and-suspenders
        if (card.id === 'ACT-000' || card.name === 'BLVCK') {
          if (typeof TooltipSystem !== 'undefined') {
            TooltipSystem.showPersistent('■ BLVCK cannot be discarded', 1000);
          }
          return false;
        }

        var inCombat = (typeof GoneRogue !== 'undefined' && typeof GoneRogue.isStrCombatActive === 'function' && GoneRogue.isStrCombatActive());

        if (inCombat) {
          return _handleCombatDebriefDrop(card, cardIndex, debriefEl);
        } else {
          return _handleExplorationDebriefDrop(card, cardIndex, debriefEl);
        }
      }
    });
  }

  function _isSelfCastCard(card) {
    if (!card || !card.stats) return false;
    return !!(
      card.stats.hp || card.stats.energyBoost || card.stats.fatigueReduction ||
      card.stats.batteryRecharge || card.stats.focusBoost || card.stats.ammoRestore
    );
  }

  function _applySelfCast(card) {
    if (!card || !card.stats) return { ok: false, msg: 'No effect' };
    var effects = [];

    if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.getPlayer === 'function') {
      var p = GoneRogue.getPlayer();
      if (p && card.stats.hp) {
        p.hp = Math.min(p.maxHp || p.hp, p.hp + card.stats.hp);
        effects.push('HP +' + card.stats.hp);
      }
    }

    if (typeof GAMESTATE !== 'undefined') {
      if (card.stats.energyBoost && GAMESTATE.addEnergy) { GAMESTATE.addEnergy(card.stats.energyBoost); effects.push('ENERGY +' + card.stats.energyBoost); }
      if (card.stats.fatigueReduction && GAMESTATE.reduceFatigue) { GAMESTATE.reduceFatigue(card.stats.fatigueReduction); effects.push('FATIGUE -' + card.stats.fatigueReduction); }
      if (card.stats.batteryRecharge && GAMESTATE.rechargeBattery) { GAMESTATE.rechargeBattery(card.stats.batteryRecharge); effects.push('BATTERY +' + card.stats.batteryRecharge); }
      if (card.stats.focusBoost && GAMESTATE.addFocus) { GAMESTATE.addFocus(card.stats.focusBoost); effects.push('FOCUS +' + card.stats.focusBoost); }
      if (card.stats.ammoRestore && GAMESTATE.addAmmo) { GAMESTATE.addAmmo(card.stats.ammoRestore); effects.push('AMMO +' + card.stats.ammoRestore); }
    }

    return { ok: effects.length > 0, msg: effects.join(', ') };
  }

  function _handleCombatDebriefDrop(card, cardIndex, debriefEl) {
    // Self-cast: apply stat effects and consume card
    if (_isSelfCastCard(card)) {
      var result = _applySelfCast(card);
      if (result.ok) {
        _consumeCardFromHand(card.id, cardIndex);
        _triggerDebriefAnimation(debriefEl);
        if (typeof TooltipSystem !== 'undefined') {
          TooltipSystem.showPersistent('✅ SELF: ' + result.msg, 1400);
        }
        return true;
      }
      return false;
    }

    // Non-self-cast: discard to backup deck
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.moveHandIndexToBackup === 'function') {
      var moveResult = GAMESTATE.moveHandIndexToBackup(cardIndex);
      if (moveResult && moveResult.success) {
        // Refresh hand fan
        _refreshHandFanFromGamestate();
        _triggerDebriefAnimation(debriefEl);
        if (typeof TooltipSystem !== 'undefined') {
          TooltipSystem.showPersistent('♻️ Discarded to backup: ' + (card.name || card.id), 1400);
        }
        if (typeof DebriefFeedController !== 'undefined' && typeof DebriefFeedController.reportEvent === 'function') {
          DebriefFeedController.reportEvent('CARD_DISCARDED', { cardName: card.name || card.id });
        }
        return true;
      }
    }

    return false;
  }

  function _handleExplorationDebriefDrop(card, cardIndex, debriefEl) {
    // Check lifecycle (disposable/consumable can be destroyed)
    var lifecycle = card.lifecycleType || card.lifecycle || 'persistent';
    var validTypes = ['disposable', 'consumable'];
    if (validTypes.indexOf(lifecycle) === -1) {
      // Invalid — shake feedback
      if (typeof UIControls !== 'undefined' && UIControls.updateMokInterjection) {
        UIControls.updateMokInterjection('Cannot destroy ' + lifecycle + ' card: ' + card.name);
      }
      return false;
    }

    // Destroy the card
    _consumeCardFromHand(card.id, cardIndex);
    _triggerDebriefAnimation(debriefEl);

    if (typeof PassiveItemsSystem !== 'undefined') {
      PassiveItemsSystem.handleDisposal(card, 'manual_disposal');
    }
    if (typeof UIControls !== 'undefined' && UIControls.updateMokInterjection) {
      UIControls.updateMokInterjection('Card destroyed: ' + card.name);
    }
    return true;
  }

  function _consumeCardFromHand(cardId, cardIndex) {
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getLooseInventory === 'function') {
      var loose = GAMESTATE.getLooseInventory();
      if (Array.isArray(loose)) {
        // Prefer id match over index (hand can mutate during drag)
        for (var i = 0; i < loose.length; i++) {
          if (loose[i] && loose[i].id === cardId) {
            loose.splice(i, 1);
            if (typeof HandFanComponent !== 'undefined' && typeof HandFanComponent.updateCards === 'function') {
              HandFanComponent.updateCards(loose);
            }
            return;
          }
        }
      }
    }
  }

  function _refreshHandFanFromGamestate() {
    if (typeof GAMESTATE === 'undefined' || typeof GAMESTATE.getCardsInHand !== 'function') return;
    var updatedHand = GAMESTATE.getCardsInHand();
    var hydrated = [];
    for (var i = 0; i < updatedHand.length; i++) {
      var ref = updatedHand[i];
      var c = null;
      try {
        if (typeof hydrateCard === 'function') c = hydrateCard(ref);
        else if (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getCard) c = GoneRogueDataRegistry.getCard(ref.id);
      } catch (e) {}
      hydrated.push(c || ref);
    }
    if (typeof HandFanComponent !== 'undefined' && typeof HandFanComponent.updateCards === 'function') {
      HandFanComponent.updateCards(hydrated);
    }
  }

  function _triggerDebriefAnimation(debriefEl) {
    if (!debriefEl) return;
    debriefEl.classList.add('incinerator-active');
    setTimeout(function() { debriefEl.classList.remove('incinerator-active'); }, 400);
  }

  // ── Commerce (shop sell) zone ───────────────────────────

  /**
   * Register the debrief-commerce drop zone for selling cards when shop is open.
   * Only active in 'shop-open' context.
   */
  function _registerDebriefCommerceZone() {
    var debriefEl = document.getElementById('debrief-screen');
    if (!debriefEl) return;

    registerDropZone(debriefEl, {
      id: 'debrief-commerce',
      contexts: ['shop-open'],
      accepts: function(dragState) {
        if (!dragState || dragState.sourceZone !== 'hand-fan') return false;
        return true;
      },
      onDragOver: function(dragState) {
        var debriefEl = document.getElementById('debrief-screen');
        if (debriefEl) {
          debriefEl.classList.add('debrief-drop-target-active', 'context-selling');
        }
      },
      onDragLeave: function() {
        var debriefEl = document.getElementById('debrief-screen');
        if (debriefEl) {
          debriefEl.classList.remove('debrief-drop-target-active', 'context-selling');
        }
      },
      onDrop: function(dragState) {
        var debriefEl = document.getElementById('debrief-screen');
        if (debriefEl) {
          debriefEl.classList.remove('debrief-drop-target-active', 'context-selling');
        }

        // Delegate to CommerceDragDropSystem or ShopSystem for sell logic
        if (typeof ShopSystem !== 'undefined' && typeof ShopSystem.calculateSellPrice === 'function' && typeof GAMESTATE !== 'undefined') {
          var card = dragState.card;
          var playerState = GAMESTATE.getState();
          var hand = playerState.cardHand || [];

          var cardIndex = -1;
          for (var ci = 0; ci < hand.length; ci++) {
            if (hand[ci] && hand[ci].id === card.id) { cardIndex = ci; break; }
          }
          if (cardIndex === -1) return false;

          var sellPrice = ShopSystem.calculateSellPrice(card);
          hand.splice(cardIndex, 1);
          playerState.cryptos += sellPrice;

          if (typeof UIControls !== 'undefined' && UIControls.updateCurrency) {
            UIControls.updateCurrency(playerState.cryptos);
          }
          if (typeof HandFanComponent !== 'undefined' && HandFanComponent.updateCards) {
            HandFanComponent.updateCards(hand);
          }
          if (typeof MokUX !== 'undefined') {
            MokUX.speak('Sold for ' + sellPrice + '¢!', 'POSITIVE');
          }

          // Success animation
          if (debriefEl) {
            debriefEl.classList.add('incinerator-active');
            setTimeout(function() { debriefEl.classList.remove('incinerator-active'); }, 600);
          }
          return true;
        }
        return false;
      }
    });
  }

  /**
   * Lazily (re-)register built-in zones if their DOM elements now exist.
   * Called from beginDrag to handle zones whose elements weren't in DOM at init.
   */
  function _ensureBuiltinZones() {
    if (!_zones['enemy-avatar']) {
      _registerEnemyAvatarZone();
    } else {
      // Re-check element is still in DOM (STR window rebuilt between fights)
      var el = document.querySelector('.str-combatant.str-enemy');
      if (el && _zones['enemy-avatar'].element !== el) {
        unregisterDropZone('enemy-avatar');
        _registerEnemyAvatarZone();
      }
    }

    if (!_zones['map-grid']) {
      _registerMapGridZone();
    }

    if (!_zones['debrief-feed']) {
      _registerDebriefFeedZone();
    }

    if (!_zones['debrief-commerce']) {
      _registerDebriefCommerceZone();
    }
  }

  // ══════════════════════════════════════════════════════════
  //  QUERIES
  // ══════════════════════════════════════════════════════════

  function isDragging() {
    return _state !== null && _state.phase === 'dragging';
  }

  function getState() {
    return _state;
  }

  function isTapTargeting() {
    return _tapTarget !== null;
  }

  function getTapTargetState() {
    return _tapTarget;
  }

  function isEnabled() {
    return _enabled;
  }

  function getProfile() {
    return _profile;
  }

  function getRegisteredZones() {
    return Object.keys(_zones);
  }

  // ══════════════════════════════════════════════════════════
  //  PUBLIC API
  // ══════════════════════════════════════════════════════════

  return {
    init: init,

    // Drop zone registry
    registerDropZone: registerDropZone,
    unregisterDropZone: unregisterDropZone,
    registerBossZones: registerBossZones,

    // Drag lifecycle
    beginDrag: beginDrag,
    updateDrag: updateDrag,
    endDrag: endDrag,
    cancelDrag: cancelDrag,

    // Tap-target API (accessibility)
    beginTapTarget: beginTapTarget,
    commitTapTarget: commitTapTarget,
    cycleTapTarget: cycleTapTarget,
    cancelTapTarget: cancelTapTarget,

    // Encounter profile
    applyProfile: applyProfile,
    clearProfile: clearProfile,

    // Context
    setContext: setContext,
    getContext: getContext,

    // Queries
    isDragging: isDragging,
    getState: getState,
    isTapTargeting: isTapTargeting,
    getTapTargetState: getTapTargetState,
    isEnabled: isEnabled,
    getProfile: getProfile,
    getRegisteredZones: getRegisteredZones
  };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    CardDragController.init();
  });
} else {
  CardDragController.init();
}
