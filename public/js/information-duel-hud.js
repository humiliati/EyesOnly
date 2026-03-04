/**
 * InformationDuelHUD — Phase 5 Visual Layer (Canon-Compliant)
 *
 * NO new bars, badges, or standalone UI elements.
 * All state communicated through EXISTING canon surfaces:
 *
 *   1. Debrief feed — "Charges" row appears as a combat resource
 *   2. STR Combat Window — frame border tint shifts on escalation/overload
 *   3. Kaomoji faces — mutation already routed through EnemyIntentSystem
 *   4. Enemy card slots — momentum dots (subtle, on existing elements)
 *   5. Tooltips — detailed state info on hover
 *   6. Power flash — brief dramatic text (temporary, no persistent clutter)
 *
 * Dependencies:
 *   - InformationDuelEngine (getSnapshot)
 *   - DebriefFeedController (resource rendering)
 *   - NonCombatEventBus (events)
 *   - TooltipSystem (hover info)
 *
 * ES5 IIFE — respects UI-CANON.md.
 */
var InformationDuelHUD = (function() {
  'use strict';

  var _initialized = false;
  var _powerFlashEl = null;
  var _lastFrameTint = '';

  // ── Init ──────────────────────────────────────────────────

  function init() {
    if (_initialized) return;
    _initialized = true;

    _createPowerFlash();
    _bindEvents();

    console.log('[InformationDuelHUD] Phase 5 HUD initialized (canon-compliant)');
  }

  // ══════════════════════════════════════════════════════════
  // 1. DEBRIEF FEED: Charges as Combat Resource
  // ══════════════════════════════════════════════════════════

  /**
   * Inject "Charges" into debrief feed during combat.
   * Uses the same block-bar format as HP/Ammo/Energy.
   */
  function _injectChargesRow(charges) {
    if (!charges) return;

    var screen = document.getElementById('debrief-screen');
    if (!screen) return;

    var existingRow = screen.querySelector('[data-resource="Charges"]');
    if (existingRow) {
      _updateChargesRow(existingRow, charges);
      return;
    }

    // Append to existing resource section
    var section = screen.querySelector('.resource-section');
    if (!section) return;

    var row = document.createElement('div');
    row.className = 'resource-row';
    row.setAttribute('data-resource', 'Charges');
    _updateChargesRow(row, charges);
    section.appendChild(row);
  }

  function _updateChargesRow(row, charges) {
    var filled = charges.remaining;
    var empty = charges.max - charges.remaining;
    var barColor = '#00FFA6';

    row.innerHTML =
      '<span class="resource-icon">\u26A1</span>' +
      '<span class="resource-name">Charges</span>' +
      '<div class="resource-bar-container">' +
        '<span class="resource-bar-filled" style="color: ' + barColor + '; text-shadow: 0 0 4px ' + barColor + '80">' +
        _repeat('\u2588', filled) + _repeat('\u2591', empty) +
        '</span>' +
      '</div>' +
      '<span class="resource-value">(' + charges.remaining + '/' + charges.max + ')</span>';
  }

  function _repeat(ch, n) {
    var s = '';
    for (var i = 0; i < n; i++) s += ch;
    return s;
  }

  function _removeChargesRow() {
    var screen = document.getElementById('debrief-screen');
    if (!screen) return;
    var row = screen.querySelector('[data-resource="Charges"]');
    if (row && row.parentNode) row.parentNode.removeChild(row);
  }

  // ══════════════════════════════════════════════════════════
  // 2. STR COMBAT WINDOW: Frame Tint for Tension
  // ══════════════════════════════════════════════════════════

  /**
   * Shift the STR combat window border color based on duel tension.
   * Normal: #ffaa00 (gold) — untouched
   * Escalation urgent: border shifts toward red
   * Overload eligible: border shifts toward bright yellow
   * Overload active: pulsing white-yellow
   */
  function _updateFrameTint(escalation, overload) {
    var el = document.getElementById('str-combat-window');
    if (!el) return;

    var tintClass = '';

    if (overload && overload.active) {
      tintClass = 'str-frame-overload';
    } else if (overload && overload.eligible) {
      tintClass = 'str-frame-overload-rising';
    } else if (escalation && escalation.urgent) {
      tintClass = 'str-frame-escalation';
    }

    if (tintClass !== _lastFrameTint) {
      el.classList.remove('str-frame-escalation', 'str-frame-overload-rising', 'str-frame-overload');
      if (tintClass) el.classList.add(tintClass);
      _lastFrameTint = tintClass;
    }
  }

  function _clearFrameTint() {
    var el = document.getElementById('str-combat-window');
    if (el) {
      el.classList.remove('str-frame-escalation', 'str-frame-overload-rising', 'str-frame-overload');
    }
    _lastFrameTint = '';
  }

  // ══════════════════════════════════════════════════════════
  // 3. ENEMY CARD SLOTS: Momentum Dots
  // ══════════════════════════════════════════════════════════

  function _renderMomentumDots(momentum) {
    if (!Array.isArray(momentum)) return;

    var container = document.getElementById('enemy-hand-display');
    if (!container) return;

    var slots = container.querySelectorAll('.enemy-card-slot');

    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      var m = (i < momentum.length) ? momentum[i] : null;

      var indicator = slot.querySelector('.idh-momentum-indicator');

      if (!m || m.maxMomentum <= 0) {
        if (indicator) indicator.style.display = 'none';
        slot.removeAttribute('data-momentum-tag');
        continue;
      }

      if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'idh-momentum-indicator';
        slot.appendChild(indicator);
      }

      indicator.style.display = '';
      var dots = '';
      for (var d = 0; d < Math.min(m.maxMomentum, 4); d++) {
        dots += '<span class="idh-momentum-dot"></span>';
      }
      indicator.innerHTML = dots;

      if (m.dominantTag) {
        slot.setAttribute('data-momentum-tag', m.dominantTag);
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  // 4. TOOLTIPS: Detailed State on Hover
  // ══════════════════════════════════════════════════════════

  function _attachTooltips() {
    var container = document.getElementById('enemy-hand-display');
    if (!container) return;

    var slots = container.querySelectorAll('.enemy-card-slot');
    for (var i = 0; i < slots.length; i++) {
      (function(index, slot) {
        if (slot._duelTooltipBound) return;
        slot._duelTooltipBound = true;

        slot.addEventListener('mouseenter', function() {
          _showSlotTooltip(index);
        });
      })(i, slots[i]);
    }
  }

  function _showSlotTooltip(index) {
    if (typeof InformationDuelEngine === 'undefined') return;
    var snapshot = InformationDuelEngine.getSnapshot();
    if (!snapshot) return;

    var lines = [];

    // Momentum
    if (snapshot.momentum && snapshot.momentum[index]) {
      var m = snapshot.momentum[index];
      if (m.maxMomentum > 0) {
        lines.push('Momentum ' + m.maxMomentum + (m.dominantTag ? ' (' + m.dominantTag + ')' : ''));
      }
    }

    // Mutation state
    if (snapshot.mutation) {
      lines.push(snapshot.mutation.emoji + ' ' + snapshot.mutation.label + ' x' + snapshot.mutation.stacks);
    }

    // Escalation
    if (snapshot.escalation && snapshot.escalation.counter > 0) {
      var escLine = 'Escalation ' + snapshot.escalation.counter + '/' + snapshot.escalation.threshold;
      if (snapshot.escalation.bonusDamage > 0) escLine += ' (+' + snapshot.escalation.bonusDamage + ' dmg)';
      lines.push(escLine);
    }

    if (lines.length === 0) return;

    try {
      if (typeof TooltipSystem !== 'undefined' && TooltipSystem.showPersistent) {
        TooltipSystem.showPersistent(lines.join(' | '), 2500);
      }
    } catch (e) {}
  }

  // ══════════════════════════════════════════════════════════
  // 5. POWER FLASH (temporary — no persistent clutter)
  // ══════════════════════════════════════════════════════════

  function _createPowerFlash() {
    if (_powerFlashEl) return;
    _powerFlashEl = document.createElement('div');
    _powerFlashEl.id = 'idh-power-flash';
    _powerFlashEl.className = 'idh-power-flash idh-hidden';
    document.body.appendChild(_powerFlashEl);
  }

  function showPowerFlash(message, color) {
    if (!_powerFlashEl) return;
    _powerFlashEl.textContent = message;
    _powerFlashEl.style.color = color || 'rgba(255, 200, 0, 1)';
    _powerFlashEl.className = 'idh-power-flash idh-flash-animate';

    setTimeout(function() {
      _powerFlashEl.className = 'idh-power-flash idh-hidden';
    }, 1200);
  }

  // ══════════════════════════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════════════════════════

  function render(snapshot) {
    if (!snapshot) return;

    if (snapshot.combatActive) {
      _injectChargesRow(snapshot.charges);
      _updateFrameTint(snapshot.escalation, snapshot.overload);
      _renderMomentumDots(snapshot.momentum);
      _attachTooltips();
    } else {
      _removeChargesRow();
      _clearFrameTint();
    }
  }

  // ══════════════════════════════════════════════════════════
  // EVENT BINDING
  // ══════════════════════════════════════════════════════════

  function _bindEvents() {
    if (typeof NonCombatEventBus === 'undefined') {
      setTimeout(_bindEvents, 200);
      return;
    }

    NonCombatEventBus.on('duel:state-update', function(snapshot) {
      render(snapshot);
    });

    NonCombatEventBus.on('duel:turn-advance', function() {
      if (typeof InformationDuelEngine !== 'undefined') {
        render(InformationDuelEngine.getSnapshot());
      }
    });

    NonCombatEventBus.on('duel:combat-start', function() {
      if (typeof InformationDuelEngine !== 'undefined') {
        render(InformationDuelEngine.getSnapshot());
      }
    });

    NonCombatEventBus.on('duel:combat-end', function() {
      _removeChargesRow();
      _clearFrameTint();
    });

    // Power fantasy flashes
    NonCombatEventBus.on('enemy-card:destroyed', function() {
      showPowerFlash('INTENT DENIED', 'rgba(255, 60, 60, 1)');
    });

    NonCombatEventBus.on('enemy-card:stolen', function() {
      showPowerFlash('CARD SEIZED', 'rgba(0, 220, 255, 1)');
    });

    NonCombatEventBus.on('overload:resolved', function() {
      showPowerFlash('OVERLOAD', 'rgba(255, 255, 0, 1)');
    });
  }

  // ── Public API ────────────────────────────────────────────

  return {
    init: init,
    render: render,
    showPowerFlash: showPowerFlash
  };

})();

// Auto-init
(function() {
  function _autoInit() {
    if (typeof NonCombatEventBus !== 'undefined' &&
        typeof InformationDuelEngine !== 'undefined') {
      InformationDuelHUD.init();
    } else {
      setTimeout(_autoInit, 200);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _autoInit);
  } else {
    _autoInit();
  }
})();
