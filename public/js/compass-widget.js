/**
 * compass-widget.js — Compass Navigation Widget
 *
 * A persistent compass overlay that appears on all public-facing pages
 * when the user has a compass item (compass: true) in their inventory.
 *
 * Features:
 * - Minimized: 16x16 pixelated compass sprite, updates every 10s
 * - Expanded: Shiny steampunk compass with needle updating every 0.2s
 * - Shares orientation data with Telescope mode
 *
 * Usage:
 *   <script src="js/account-inventory.js"></script>
 *   <script src="js/compass-widget.js"></script>
 *   <script>CompassWidget.init();</script>
 */

var CompassWidget = (function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════

  var _state = {
    initialized: false,
    visible: false,
    expanded: false,
    heading: 0,
    isDragging: false,
    dragOffset: { x: 0, y: 0 },
    hasOrientation: false,
    updateInterval: null,
    fastUpdateInterval: null,
    position: { x: 70, y: 48 }
  };

  // ═══════════════════════════════════════════════════════════════
  // DOM ELEMENTS
  // ═══════════════════════════════════════════════════════════════

  var _elements = {};

  // ═══════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════

  function init() {
    if (_state.initialized) return;

    // Check if user has a compass item
    if (!hasCompassItem()) {
      console.log('[CompassWidget] No compass item found, not initializing');
      return;
    }

    console.log('[CompassWidget] Compass item found, initializing...');

    // Load saved position
    _loadPosition();

    // Create DOM elements
    _createElements();

    // Setup events
    _setupEvents();

    // Start orientation tracking
    _startOrientationTracking();

    // Show widget
    _show();

    _state.initialized = true;
    console.log('[CompassWidget] Ready');
  }

  function hasCompassItem() {
    if (typeof AccountInventory === 'undefined') {
      console.warn('[CompassWidget] AccountInventory not loaded');
      return false;
    }

    var items = AccountInventory.getItems();
    return items.some(function(item) {
      return item.meta && item.meta.compass === true;
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // DOM CREATION
  // ═══════════════════════════════════════════════════════════════

  function _createElements() {
    // Minimized compass widget
    _elements.widget = document.createElement('div');
    _elements.widget.id = 'compass-widget';
    _elements.widget.className = 'compass-widget-minimized';
    _elements.widget.style.cssText = 'position: fixed; bottom: ' + _state.position.y + 'px; right: ' + _state.position.x + 'px; z-index: 1800;';

    _elements.widget.innerHTML = [
      '<div class="compass-mini-outer">',
        '<div class="compass-mini-inner">',
          '<div class="compass-mini-needle"></div>',
        '</div>',
        '<div class="compass-mini-label">N</div>',
      '</div>'
    ].join('');

    // Expanded compass overlay
    _elements.overlay = document.createElement('div');
    _elements.overlay.id = 'compass-overlay';
    _elements.overlay.className = 'compass-widget-expanded';
    _elements.overlay.hidden = true;
    _elements.overlay.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1900;';

    _elements.overlay.innerHTML = [
      '<div class="compass-frame">',
        '<div class="compass-bezel">',
          '<div class="compass-dome">',
            '<div class="compass-needle-container">',
              '<div class="compass-needle compass-needle-north"></div>',
              '<div class="compass-needle compass-needle-south"></div>',
              '<div class="compass-pivot"></div>',
            '</div>',
            '<div class="compass-cardinals">',
              '<span class="compass-cardinal cardinal-n">N</span>',
              '<span class="compass-cardinal cardinal-e">E</span>',
              '<span class="compass-cardinal cardinal-s">S</span>',
              '<span class="compass-cardinal cardinal-w">W</span>',
            '</div>',
          '</div>',
        '</div>',
        '<div class="compass-readout">',
          '<span class="compass-readout-heading"><span class="compass-readout-label">AZ</span> <span class="compass-readout-value" id="compass-azimuth">0</span>°</span>',
        '</div>',
        '<div class="compass-controls">',
          '<button class="compass-btn" id="compass-minimize">MINIMIZE</button>',
          '<button class="compass-btn" id="compass-telescope">TELESCOPE</button>',
        '</div>',
      '</div>'
    ].join('');

    document.body.appendChild(_elements.widget);
    document.body.appendChild(_elements.overlay);
  }

  // ═══════════════════════════════════════════════════════════════
  // EVENT HANDLING
  // ═══════════════════════════════════════════════════════════════

  function _setupEvents() {
    // Click to expand
    _elements.widget.addEventListener('click', function(e) {
      if (!_state.isDragging) {
        _expand();
      }
    });

    // Minimize button
    var minimizeBtn = document.getElementById('compass-minimize');
    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', _minimize);
    }

    // Telescope button
    var telescopeBtn = document.getElementById('compass-telescope');
    if (telescopeBtn) {
      telescopeBtn.addEventListener('click', function() {
        window.location.href = '/telescope.html';
      });
    }

    // Drag functionality for minimized widget
    _setupDrag();

    // Keyboard shortcut (C key)
    document.addEventListener('keydown', function(e) {
      var tag = document.activeElement && document.activeElement.tagName;
      var editable = document.activeElement && document.activeElement.isContentEditable;
      if (e.key === 'c' && !e.ctrlKey && !e.metaKey && tag !== 'INPUT' && tag !== 'TEXTAREA' && !editable) {
        if (_state.expanded) {
          _minimize();
        } else if (_state.visible) {
          _expand();
        }
      }
      if (e.key === 'Escape' && _state.expanded) {
        _minimize();
      }
    });
  }

  function _setupDrag() {
    var widget = _elements.widget;
    var startX, startY, initialX, initialY;

    widget.addEventListener('mousedown', dragStart);
    widget.addEventListener('touchstart', dragStart, { passive: false });

    function dragStart(e) {
      if (e.type === 'mousedown') {
        startX = e.clientX;
        startY = e.clientY;
      } else {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      }

      initialX = _state.position.x;
      initialY = _state.position.y;
      _state.isDragging = false;

      document.addEventListener('mousemove', drag);
      document.addEventListener('touchmove', drag, { passive: false });
      document.addEventListener('mouseup', dragEnd);
      document.addEventListener('touchend', dragEnd);
    }

    function drag(e) {
      var clientX, clientY;

      if (e.type === 'mousemove') {
        clientX = e.clientX;
        clientY = e.clientY;
      } else {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }

      var dx = clientX - startX;
      var dy = clientY - startY;

      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        _state.isDragging = true;
      }

      if (_state.isDragging) {
        _state.position.x = Math.max(0, initialX - dx);
        _state.position.y = Math.max(0, initialY - dy);

        widget.style.right = _state.position.x + 'px';
        widget.style.bottom = _state.position.y + 'px';
        widget.style.left = 'auto';
        widget.style.top = 'auto';
      }
    }

    function dragEnd() {
      document.removeEventListener('mousemove', drag);
      document.removeEventListener('touchmove', drag);
      document.removeEventListener('mouseup', dragEnd);
      document.removeEventListener('touchend', dragEnd);

      if (_state.isDragging) {
        _savePosition();
        // Delay reset so the trailing click event is still swallowed
        setTimeout(function() { _state.isDragging = false; }, 50);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ORIENTATION TRACKING
  // ═══════════════════════════════════════════════════════════════

  function _startOrientationTracking() {
    if (_state.hasOrientation) return;

    // Check for iOS permission requirement
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      // Will request on first interaction
      document.body.addEventListener('click', _requestOrientationPermission, { once: true });
    } else {
      _enableOrientation();
    }
  }

  async function _requestOrientationPermission() {
    try {
      var permission = await DeviceOrientationEvent.requestPermission();
      if (permission === 'granted') {
        _enableOrientation();
      }
    } catch (e) {
      console.warn('[CompassWidget] Orientation permission denied');
    }
  }

  function _enableOrientation() {
    window.addEventListener('deviceorientation', _handleOrientation);
    _state.hasOrientation = true;
    console.log('[CompassWidget] Orientation tracking enabled');
  }

  function _handleOrientation(event) {
    // Get compass heading
    var heading = event.alpha;

    // iOS uses webkitCompassHeading
    if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) {
      heading = event.webkitCompassHeading;
    }

    if (heading !== null && heading !== undefined) {
      _state.heading = heading;
      _updateCompass(heading);

      // Broadcast to Telescope mode
      _broadcastOrientation({
        alpha: heading,
        beta: event.beta,
        gamma: event.gamma
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // COMPASS UPDATE
  // ═══════════════════════════════════════════════════════════════

  function _updateCompass(heading) {
    // Update minimized widget
    var miniNeedle = _elements.widget.querySelector('.compass-mini-needle');
    if (miniNeedle) {
      miniNeedle.style.transform = 'rotate(' + heading + 'deg)';
    }

    // Update expanded overlay
    var needleContainer = _elements.overlay.querySelector('.compass-needle-container');
    if (needleContainer) {
      needleContainer.style.transform = 'rotate(' + heading + 'deg)';
    }

    // Update readout
    var azimuthEl = document.getElementById('compass-azimuth');
    if (azimuthEl) {
      azimuthEl.textContent = Math.round(heading);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // BROADCAST TO TELESCOPE
  // ═══════════════════════════════════════════════════════════════

  function _broadcastOrientation(data) {
    window.dispatchEvent(new CustomEvent('compass:orientation', {
      detail: data
    }));
  }

  // ═══════════════════════════════════════════════════════════════
  // VISIBILITY
  // ═══════════════════════════════════════════════════════════════

  function _show() {
    _state.visible = true;
    _elements.widget.style.display = 'block';

    // Start slow update (every 10 seconds for minimized)
    _state.updateInterval = setInterval(function() {
      if (!_state.expanded && _state.hasOrientation) {
        // Refresh heading if needed
      }
    }, 10000);
  }

  function _expand() {
    _state.expanded = true;
    _elements.overlay.hidden = false;
    _elements.widget.style.display = 'none';

    // Start fast update (every 0.2 seconds for expanded)
    _state.fastUpdateInterval = setInterval(function() {
      // Heading updates come from deviceorientation event
      // This interval is just a fallback/heartbeat
    }, 200);
  }

  function _minimize() {
    _state.expanded = false;
    _elements.overlay.hidden = true;
    _elements.widget.style.display = 'block';

    // Clear fast interval
    if (_state.fastUpdateInterval) {
      clearInterval(_state.fastUpdateInterval);
      _state.fastUpdateInterval = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // POSITION PERSISTENCE
  // ═══════════════════════════════════════════════════════════════

  function _savePosition() {
    try {
      localStorage.setItem('EYESONLY_COMPASS_POS_V1', JSON.stringify(_state.position));
    } catch (e) {}
  }

  function _loadPosition() {
    try {
      var saved = localStorage.getItem('EYESONLY_COMPASS_POS_V1');
      if (saved) {
        _state.position = JSON.parse(saved);
      }
    } catch (e) {}
  }

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════

  return {
    init: init,
    getHeading: function() { return _state.heading; },
    isExpanded: function() { return _state.expanded; },
    expand: _expand,
    minimize: _minimize
  };

})();
