/* ============================================================
   Lens State — Phase 9
   ============================================================
   Centralized cross-lens state manager. Single source of truth
   for which lens is active, what it's doing, and what visual
   treatment should apply.

   Each card's lens type:
     amber  / ♣ club    → 'gold'     (constellation tracer)
     silver / ♠ spade   → 'silver'   (satellite scrubber + spade transform)
     phosphor/ ♥ heart  → 'phosphor' (heart transform + reveal)
     panther / ♦ diamond → 'panther'  (diamond transform)

   Consumed by:
     - constellation-tracer.js (visual feedback color per lens)
     - suit-transformer.js (which suit to target)
     - nch-overlay.js (which systems to activate on drag)
     - suit-node-renderer.js (origami animation parameters)

   Usage:
     LensState.activate('panther', cardIndex)
     LensState.deactivate()
     LensState.getActiveLens()   → 'panther' | null
     LensState.getThemeColors()  → { primary, glow, reject, ghost }
   ============================================================ */

;(function (root) {
  'use strict';

  var _activeLens = null;    // 'gold' | 'silver' | 'phosphor' | 'panther' | null
  var _cardIndex  = -1;

  // ── Per-lens color palettes for visual feedback ──────────

  var LENS_COLORS = {
    gold: {
      primary:   'rgba(212, 168, 67, 0.9)',
      glow:      'rgba(212, 168, 67, 0.25)',
      reject:    'rgba(255, 40, 30, 0.06)',     // red flash
      ghost:     'rgba(255, 255, 255, 0.7)',     // white dashed
      ring:      'rgba(255, 220, 100, 0.9)',
      label:     'Gold Navigator',
    },
    silver: {
      primary:   'rgba(176, 196, 222, 0.9)',
      glow:      'rgba(176, 196, 222, 0.25)',
      reject:    'rgba(100, 160, 255, 0.08)',    // cool blue flash
      ghost:     'rgba(200, 215, 235, 0.6)',     // thin steel ghost
      ring:      'rgba(220, 230, 245, 0.9)',
      label:     'Silver Amplifier',
    },
    phosphor: {
      primary:   'rgba(51, 255, 51, 0.9)',
      glow:      'rgba(51, 255, 51, 0.20)',
      reject:    'rgba(51, 255, 51, 0.06)',      // green CRT distortion
      ghost:     'rgba(51, 255, 51, 0.5)',        // green pulse ghost
      ring:      'rgba(80, 255, 80, 0.9)',
      label:     'Phosphor Revealer',
    },
    panther: {
      primary:   'rgba(255, 48, 144, 0.9)',
      glow:      'rgba(255, 48, 144, 0.25)',
      reject:    'rgba(160, 32, 240, 0.08)',     // purple static
      ghost:     'rgba(255, 48, 144, 0.5)',      // pink trail ghost
      ring:      'rgba(255, 80, 160, 0.9)',
      label:     'Panther Refractor',
    },
  };

  // ── Suit class → lens type mapping ──

  var SUIT_TO_LENS = {
    'suit-club':    'gold',
    'suit-spade':   'silver',
    'suit-heart':   'phosphor',
    'suit-diamond': 'panther',
  };

  // ── Origami animation parameters per lens ──

  var ORIGAMI_PARAMS = {
    panther: {
      // ♦→♣: diamond rotates 45°, edges fold inward, re-blooms as club
      rotationDeg: 45,
      foldScale: 0.6,
      bloomScale: 1.2,
      duration: 500,
      colorFrom: 'rgba(255, 48, 144, 0.9)',
      colorTo: 'rgba(212, 168, 67, 0.9)',
    },
    silver: {
      // ♠→♣: spade brightens, stem retracts, lobes split to three
      rotationDeg: 0,
      foldScale: 0.8,
      bloomScale: 1.1,
      duration: 400,
      colorFrom: 'rgba(176, 196, 222, 0.9)',
      colorTo: 'rgba(212, 168, 67, 0.9)',
    },
    phosphor: {
      // ♥→♣: heart fades in with warmth, cleft splits into three lobes
      rotationDeg: 0,
      foldScale: 0.9,
      bloomScale: 1.3,
      duration: 600,
      colorFrom: 'rgba(255, 176, 0, 0.9)',
      colorTo: 'rgba(212, 168, 67, 0.9)',
    },
  };

  // ── Public API ────────────────────────────────────────

  function activate(suitClass, cardIndex) {
    _activeLens = SUIT_TO_LENS[suitClass] || null;
    _cardIndex = cardIndex || -1;

    try {
      document.dispatchEvent(new CustomEvent('lens-activated', {
        detail: { lens: _activeLens, cardIndex: _cardIndex },
      }));
    } catch (e) {}
  }

  function deactivate() {
    var prev = _activeLens;
    _activeLens = null;
    _cardIndex = -1;

    if (prev) {
      try {
        document.dispatchEvent(new CustomEvent('lens-deactivated', {
          detail: { lens: prev },
        }));
      } catch (e) {}
    }
  }

  function getActiveLens()   { return _activeLens; }
  function getCardIndex()    { return _cardIndex; }
  function isActive(lens)    { return _activeLens === lens; }

  function getThemeColors(lens) {
    return LENS_COLORS[lens || _activeLens] || LENS_COLORS.gold;
  }

  function getOrigamiParams(lens) {
    return ORIGAMI_PARAMS[lens] || null;
  }

  function getLensForSuit(suitClass) {
    return SUIT_TO_LENS[suitClass] || null;
  }

  // ── Export ────────────────────────────────────────────

  root.LensState = {
    activate:        activate,
    deactivate:      deactivate,
    getActiveLens:   getActiveLens,
    getCardIndex:    getCardIndex,
    isActive:        isActive,
    getThemeColors:  getThemeColors,
    getOrigamiParams: getOrigamiParams,
    getLensForSuit:  getLensForSuit,
    LENS_COLORS:     LENS_COLORS,
    ORIGAMI_PARAMS:  ORIGAMI_PARAMS,
  };

})(typeof window !== 'undefined' ? window : this);
