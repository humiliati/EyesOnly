/**
 * item-popup.js — Reusable Item Popup Module
 *
 * A generic popup system for inventory items that need "zoom-to-detail"
 * inspection. When an item is clicked, its emoji zooms up to a target
 * size (~200px) then cross-fades into the item's detail image/content.
 * A red close button (matching splash-screen aesthetic) dismisses.
 *
 * ARCHITECTURE:
 * - Register items via ItemPopup.register(itemKey, config)
 * - Attach to DOM via ItemPopup.bind(containerEl)
 * - Clicking a registered slot triggers the zoom → reveal sequence
 * - Each popup is a full-viewport overlay with backdrop blur
 * - Supports: image content, HTML content, or canvas content
 * - Themed via CRT bridge vars (--phosphor, --phosphor-dim, etc.)
 *
 * USAGE:
 *   ItemPopup.register('cypher-note-2', {
 *     emoji: '📜',
 *     title: 'CYPHER NOTE #2',
 *     imageSrc: '/assets/Images/Items/Cypher_Notes0-3/Cypher_Note_2.png',
 *     imageAlt: 'Pigpen cipher key grid N-V',
 *     description: 'A torn page from the field manual...'
 *   });
 *   ItemPopup.bind(document.getElementById('games-content'));
 */
var ItemPopup = (function () {
  'use strict';

  // ---- Registry of popup-enabled items ----
  var _registry = {};
  var _overlayEl = null;
  var _isOpen = false;
  var _currentItem = null;
  var _boundContainer = null;

  // ---- Animation timing ----
  var ZOOM_DURATION = 400;     // ms — emoji zoom phase
  var FADE_DURATION = 250;     // ms — cross-fade to image
  var TARGET_EMOJI_SIZE = 200; // px — size at which emoji transitions to image

  /**
   * Register an item for popup display.
   *
   * @param {string} itemKey - Matches data-item attribute on the slot
   * @param {Object} config
   * @param {string} config.emoji      - The item emoji character
   * @param {string} config.title      - Popup header text
   * @param {string} [config.imageSrc] - URL to detail image
   * @param {string} [config.imageAlt] - Alt text for image
   * @param {string} [config.htmlContent] - Custom HTML for popup body
   * @param {string} [config.description] - Text description below image
   * @param {string} [config.itemId]   - ITM-XXX id for data binding
   * @param {Function} [config.onOpen] - Callback when popup opens
   * @param {Function} [config.onClose] - Callback when popup closes
   */
  function register(itemKey, config) {
    _registry[itemKey] = config;
  }

  /**
   * Check if an item key is registered for popups.
   */
  function isRegistered(itemKey) {
    return !!_registry[itemKey];
  }

  /**
   * Build the overlay DOM structure.
   */
  function _buildOverlay() {
    if (_overlayEl) return _overlayEl;

    var overlay = document.createElement('div');
    overlay.className = 'item-popup-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Item detail');
    overlay.innerHTML = [
      '<div class="item-popup-backdrop"></div>',
      '<div class="item-popup-container">',
      '  <button class="item-popup-close" aria-label="Close" title="Close">',
      '    <span class="item-popup-close-icon">&times;</span>',
      '  </button>',
      '  <div class="item-popup-stage">',
      '    <div class="item-popup-emoji-zoom"></div>',
      '    <div class="item-popup-content" style="opacity:0">',
      '      <div class="item-popup-image-wrap"></div>',
      '      <div class="item-popup-title"></div>',
      '      <div class="item-popup-desc"></div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');

    // Close button handler
    var closeBtn = overlay.querySelector('.item-popup-close');
    closeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      close();
    });

    // Backdrop click to close
    var backdrop = overlay.querySelector('.item-popup-backdrop');
    backdrop.addEventListener('click', function () {
      close();
    });

    // Escape key to close
    overlay.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });

    document.body.appendChild(overlay);
    _overlayEl = overlay;
    return overlay;
  }

  /**
   * Open the popup for a registered item.
   * Plays the emoji zoom → image reveal sequence.
   *
   * @param {string} itemKey - The registered item key
   * @param {HTMLElement} [sourceEl] - The slot element (for zoom origin)
   */
  function open(itemKey, sourceEl) {
    var config = _registry[itemKey];
    if (!config || _isOpen) return;

    _isOpen = true;
    _currentItem = itemKey;

    var overlay = _buildOverlay();
    var emojiZoom = overlay.querySelector('.item-popup-emoji-zoom');
    var content = overlay.querySelector('.item-popup-content');
    var imageWrap = overlay.querySelector('.item-popup-image-wrap');
    var titleEl = overlay.querySelector('.item-popup-title');
    var descEl = overlay.querySelector('.item-popup-desc');

    // Reset state
    emojiZoom.textContent = config.emoji || '';
    emojiZoom.style.fontSize = '1.6em';
    emojiZoom.style.opacity = '1';
    emojiZoom.style.transition = 'none';
    content.style.opacity = '0';
    content.style.transition = 'none';
    content.style.transform = 'scale(0.95)';

    // Populate content
    titleEl.textContent = config.title || '';
    descEl.textContent = config.description || '';

    imageWrap.innerHTML = '';
    if (config.imageSrc) {
      var img = document.createElement('img');
      img.className = 'item-popup-image';
      img.src = config.imageSrc;
      img.alt = config.imageAlt || config.title || 'Item detail';
      img.draggable = false;
      imageWrap.appendChild(img);
    } else if (config.htmlContent) {
      imageWrap.innerHTML = config.htmlContent;
    }

    // Show overlay
    overlay.classList.add('item-popup-visible');
    overlay.style.display = 'flex';

    // Force reflow
    void overlay.offsetHeight;

    // SFX
    if (window.AudioSystem && AudioSystem.playSFX) {
      AudioSystem.playSFX('ui-04');
    }

    // Phase 1: Emoji zoom animation
    requestAnimationFrame(function () {
      emojiZoom.style.transition = 'font-size ' + ZOOM_DURATION + 'ms cubic-bezier(0.22, 1, 0.36, 1), opacity ' + FADE_DURATION + 'ms ease';
      emojiZoom.style.fontSize = TARGET_EMOJI_SIZE + 'px';

      // Phase 2: At zoom peak, cross-fade to content
      setTimeout(function () {
        emojiZoom.style.opacity = '0';

        content.style.transition = 'opacity ' + FADE_DURATION + 'ms ease, transform ' + FADE_DURATION + 'ms ease';
        content.style.opacity = '1';
        content.style.transform = 'scale(1)';
      }, ZOOM_DURATION * 0.85);
    });

    // Focus trap
    var closeBtn = overlay.querySelector('.item-popup-close');
    setTimeout(function () { closeBtn.focus(); }, ZOOM_DURATION);

    // Callback
    if (config.onOpen) {
      try { config.onOpen(itemKey); } catch (_) {}
    }
  }

  /**
   * Close the currently open popup.
   */
  function close() {
    if (!_isOpen || !_overlayEl) return;

    var config = _registry[_currentItem];

    _overlayEl.classList.remove('item-popup-visible');
    _overlayEl.classList.add('item-popup-closing');

    // SFX
    if (window.AudioSystem && AudioSystem.playSFX) {
      AudioSystem.playSFX('ui-01');
    }

    setTimeout(function () {
      if (_overlayEl) {
        _overlayEl.style.display = 'none';
        _overlayEl.classList.remove('item-popup-closing');
      }
      _isOpen = false;

      // Callback
      if (config && config.onClose) {
        try { config.onClose(_currentItem); } catch (_) {}
      }
      _currentItem = null;
    }, 200);
  }

  /**
   * Bind click handlers on a container.
   * Any slot with data-item matching a registered key becomes clickable.
   */
  function bind(containerEl) {
    if (!containerEl) return;
    _boundContainer = containerEl;

    containerEl.addEventListener('click', function (e) {
      // Don't trigger during drag
      if (window.MagnifyingGlassDrag && MagnifyingGlassDrag.isDragging()) return;

      var slot = e.target.closest('.games-inv-slot[data-item]');
      if (!slot) return;

      var itemKey = slot.getAttribute('data-item');
      if (isRegistered(itemKey)) {
        open(itemKey, slot);
      }
    });
  }

  /**
   * Get the overlay element (for external CSS targeting).
   */
  function getOverlay() {
    return _overlayEl;
  }

  return {
    register: register,
    isRegistered: isRegistered,
    open: open,
    close: close,
    bind: bind,
    getOverlay: getOverlay,
    isOpen: function () { return _isOpen; }
  };

})();
