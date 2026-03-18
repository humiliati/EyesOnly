/**
 * TELESCOPE Mode — AR Constellation Tracker
 * 
 * Dual-layer starfield system:
 * - Surface layer: decorative stars with labels, local bodies, grid lines
 * - Underlying layer: real stars as nodes for constellation game
 * - Portholes (hand fan cards) cut through surface to reveal underlying
 */

var Telescope = (function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════

  var _state = {
    // Viewport orientation (azimuth/altitude)
    azimuth: 0,
    altitude: 45,
    
    // Device info
    isMobile: false,
    hasOrientation: false,
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    lastAzimuth: 0,
    lastAltitude: 0,
    
    // Current lens
    activeLens: 'panther',
    
    // Stars data
    stars: {},
    constellations: [],
    localBodies: {},
    
    // Game state
    currentConstellation: null,
    foundStars: [],        // stars in crosshair
    tracedPath: [],        // path being traced
    solvedConstellations: [],
    
    // Rendering
    animationId: null,
    canvases: {},
    contexts: {},
    
    // Porthole cards
    portholeCards: [],
  };

  // ═══════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════

  async function init() {
    console.log('[TELESCOPE] Initializing...');
    
    // Detect mobile
    _state.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Setup canvases
    _setupCanvases();
    
    // Load star data
    await _loadStarData();
    
    // Setup input (orientation or mouse)
    _setupInput();
    
    // Create porthole hand fan
    _createPortholeFan();
    
    // Setup lens selector
    _setupLensSelector();
    
    // Load saved progress
    _loadProgress();
    
    // Start render loop
    _startRenderLoop();
    
    // Update mode indicator
    _updateModeIndicator();
    
    console.log('[TELESCOPE] Ready');
  }

  function _setupCanvases() {
    _state.canvases.realStars = document.getElementById('real-stars-canvas');
    _state.canvases.surface = document.getElementById('surface-stars-canvas');
    _state.canvases.grid = document.getElementById('grid-canvas');
    _state.canvases.constellation = document.getElementById('constellation-canvas');
    
    _resizeCanvases();
    
    window.addEventListener('resize', _resizeCanvases);
  }

  function _resizeCanvases() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    
    Object.values(_state.canvases).forEach(function(canvas) {
      if (canvas) {
        canvas.width = w;
        canvas.height = h;
      }
    });
  }

  async function _loadStarData() {
    try {
      var response = await fetch('/data/real-stars.json');
      var data = await response.json();
      
      _state.stars = data.stars;
      _state.constellations = data.constellations;
      _state.localBodies = data.localBodies;
      
      // Set initial constellation
      _state.currentConstellation = _state.constellations.find(function(c) {
        return c.id === 'big-dipper';
      });
      
      console.log('[TELESCOPE] Loaded', Object.keys(_state.stars).length, 'stars');
    } catch (e) {
      console.error('[TELESCOPE] Failed to load star data:', e);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // INPUT HANDLING
  // ═══════════════════════════════════════════════════════════════

  function _setupInput() {
    if (_state.isMobile && window.DeviceOrientationEvent) {
      // Check for iOS permission requirement
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        // Show prompt on first interaction
        document.body.addEventListener('click', _requestOrientationPermission, { once: true });
      } else {
        // Android / older iOS
        _startOrientationTracking();
      }
    }
    
    // Always setup mouse fallback
    _setupMouseDrag();
  }

  async function _requestOrientationPermission() {
    try {
      var permission = await DeviceOrientationEvent.requestPermission();
      if (permission === 'granted') {
        _startOrientationTracking();
      }
    } catch (e) {
      console.warn('[TELESCOPE] Orientation permission denied, using mouse fallback');
    }
    _updateModeIndicator();
  }

  function _startOrientationTracking() {
    window.addEventListener('deviceorientation', _handleOrientation);
    _state.hasOrientation = true;
    console.log('[TELESCOPE] Orientation tracking started');
  }

  function _handleOrientation(event) {
    if (!_state.isDragging) {
      // alpha: compass direction (0-360)
      // beta: front-back tilt (-180 to 180)
      // gamma: left-right tilt (-90 to 90)
      
      _state.azimuth = ((event.alpha || 0) + 360) % 360;
      _state.altitude = 90 - (event.beta || 0);
      
      // Clamp altitude
      _state.altitude = Math.max(0, Math.min(90, _state.altitude));
      
      _updateHUD();
    }
  }

  function _setupMouseDrag() {
    var container = document.body;
    
    container.addEventListener('mousedown', function(e) {
      if (e.target.closest('.lens-btn') || e.target.closest('.telescope-fan')) return;
      _state.isDragging = true;
      _state.dragStart.x = e.clientX;
      _state.dragStart.y = e.clientY;
      _state.lastAzimuth = _state.azimuth;
      _state.lastAltitude = _state.altitude;
    });
    
    window.addEventListener('mousemove', function(e) {
      if (!_state.isDragging) return;
      
      var dx = e.clientX - _state.dragStart.x;
      var dy = e.clientY - _state.dragStart.y;
      
      // Horizontal drag = azimuth, Vertical drag = altitude
      _state.azimuth = (_state.lastAzimuth + dx * 0.5 + 360) % 360;
      _state.altitude = Math.max(0, Math.min(90, _state.lastAltitude - dy * 0.3));
      
      _updateHUD();
    });
    
    window.addEventListener('mouseup', function() {
      _state.isDragging = false;
    });
    
    // Touch support
    container.addEventListener('touchstart', function(e) {
      if (e.target.closest('.lens-btn') || e.target.closest('.telescope-fan')) return;
      _state.isDragging = true;
      _state.dragStart.x = e.touches[0].clientX;
      _state.dragStart.y = e.touches[0].clientY;
      _state.lastAzimuth = _state.azimuth;
      _state.lastAltitude = _state.altitude;
    });
    
    container.addEventListener('touchmove', function(e) {
      if (!_state.isDragging) return;
      
      var dx = e.touches[0].clientX - _state.dragStart.x;
      var dy = e.touches[0].clientY - _state.dragStart.y;
      
      _state.azimuth = (_state.lastAzimuth + dx * 0.5 + 360) % 360;
      _state.altitude = Math.max(0, Math.min(90, _state.lastAltitude - dy * 0.3));
      
      _updateHUD();
    });
    
    container.addEventListener('touchend', function() {
      _state.isDragging = false;
    });
  }

  function _updateModeIndicator() {
    var indicator = document.getElementById('mode-indicator');
    if (!indicator) return;
    
    if (_state.hasOrientation) {
      indicator.textContent = 'ORIENT DEVICE TO AIM';
      indicator.style.opacity = '0.7';
    } else {
      indicator.textContent = 'DESKTOP MODE — Drag to aim';
      indicator.style.opacity = '0.5';
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // HUD
  // ═══════════════════════════════════════════════════════════════

  function _updateHUD() {
    var az = document.getElementById('azimuth');
    var alt = document.getElementById('altitude');
    var starsFound = document.getElementById('stars-found');
    
    if (az) az.textContent = Math.round(_state.azimuth);
    if (alt) alt.textContent = Math.round(_state.altitude);
    if (starsFound && _state.currentConstellation) {
      var found = _state.tracedPath.filter(function(id) {
        return _state.currentConstellation.starIds.includes(id);
      }).length;
      starsFound.textContent = found;
    }
    
    // Update compass
    _updateCompass();
  }

  function _updateCompass() {
    var dirs = document.querySelectorAll('.compass-dir');
    var az = _state.azimuth;
    
    dirs.forEach(function(el) {
      var dir = el.dataset.dir;
      var dirAz = { N: 0, E: 90, S: 180, W: 270 }[dir];
      var diff = Math.abs(az - dirAz);
      if (diff > 180) diff = 360 - diff;
      
      el.classList.toggle('active', diff < 30);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // PORTHOLE FAN
  // ═══════════════════════════════════════════════════════════════

  function _createPortholeFan() {
    var container = document.querySelector('.hand-fan-telescope');
    if (!container) return;
    
    // Create 3 porthole cards
    for (var i = 0; i < 3; i++) {
      var card = _createPortholeCard(i);
      container.appendChild(card);
      _state.portholeCards.push(card);
    }
  }

  function _createPortholeCard(index) {
    var card = document.createElement('div');
    card.className = 'coin-card splash-dossier';
    card.dataset.cardTheme = 'phosphor';
    card.dataset.index = index;
    card.style.transform = 'translateY(' + (index * -15) + 'px) rotate(' + ((index - 1) * 3) + 'deg)';
    card.style.zIndex = 10 - index;
    
    card.innerHTML = [
      '<div class="coin-border-outer">',
        '<div class="coin-border-inner">',
          '<div class="coin-artwork">',
            '<canvas class="starfield-window" width="80" height="80"></canvas>',
          '</div>',
          '<div class="coin-rings"></div>',
          '<div class="coin-suit-large">' + _getSuitForIndex(index) + '</div>',
        '</div>',
      '</div>'
    ].join('');
    
    // Add click handler
    card.addEventListener('click', function() {
      _checkStarInPorthole(card);
    });
    
    return card;
  }

  function _getSuitForIndex(index) {
    var suits = ['♠', '♣', '♥'];
    return suits[index % suits.length];
  }

  // ═══════════════════════════════════════════════════════════════
  // LENS SELECTOR
  // ═══════════════════════════════════════════════════════════════

  function _setupLensSelector() {
    var buttons = document.querySelectorAll('.lens-btn');
    
    buttons.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var lens = btn.dataset.lens;
        _setActiveLens(lens);
      });
    });
  }

  function _setActiveLens(lens) {
    _state.activeLens = lens;
    
    // Update buttons
    document.querySelectorAll('.lens-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.lens === lens);
    });
    
    // Update theme
    document.body.setAttribute('data-theme', lens);
    
    // Check for Polaris + panther special effect
    _checkPolarisEffect();
  }

  function _checkPolarisEffect() {
    var polaris = document.querySelector('.real-star.polaris');
    if (polaris) {
      if (_state.activeLens === 'panther') {
        polaris.classList.add('panther-active');
      } else {
        polaris.classList.remove('panther-active');
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER LOOP
  // ═══════════════════════════════════════════════════════════════

  function _startRenderLoop() {
    function render() {
      _renderRealStars();
      _renderSurfaceStars();
      _renderGrid();
      _renderConstellationLines();
      _checkStarsInView();
      _state.animationId = requestAnimationFrame(render);
    }
    render();
  }

  function _renderRealStars() {
    var canvas = _state.canvases.realStars;
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;
    
    ctx.clearRect(0, 0, w, h);
    
    // Calculate view bounds based on azimuth/altitude
    var viewAzMin = _state.azimuth - 60;
    var viewAzMax = _state.azimuth + 60;
    var viewAltMin = _state.altitude - 40;
    var viewAltMax = _state.altitude + 40;
    
    // Draw stars
    Object.values(_state.stars).forEach(function(star) {
      // Convert to screen position (simplified projection)
      var screenPos = _celestialToScreen(star.ra, star.dec);
      
      if (screenPos) {
        var size = Math.max(2, (2 - star.magnitude) * 2);
        var alpha = Math.max(0.3, 1 - star.magnitude / 3);
        
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, ' + alpha + ')';
        ctx.fill();
        
        // Store screen position for interaction
        star.screenX = screenPos.x;
        star.screenY = screenPos.y;
        
        // Check if in traced path
        if (_state.tracedPath.includes(star.id)) {
          ctx.beginPath();
          ctx.arc(screenPos.x, screenPos.y, size + 4, 0, Math.PI * 2);
          ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--theme-primary') || '#33ff33';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    });
  }

  function _renderSurfaceStars() {
    var canvas = _state.canvases.surface;
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;
    
    ctx.clearRect(0, 0, w, h);
    
    // Generate random decorative surface stars (seeded by position)
    var prng = _makePRNG(Math.floor(_state.azimuth / 10) * 1000 + Math.floor(_state.altitude / 10));
    
    for (var i = 0; i < 100; i++) {
      var x = prng() * w;
      var y = prng() * h;
      var size = prng() * 2;
      var alpha = prng() * 0.5 + 0.2;
      
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(200, 220, 255, ' + alpha + ')';
      ctx.fill();
    }
    
    // Draw local bodies (Moon, planets)
    Object.values(_state.localBodies).forEach(function(body) {
      // Simplified: just draw in random position for now
      var x = (w / 2) + Math.sin(Date.now() / 10000) * w * 0.3;
      var y = h * 0.2;
      
      ctx.font = '24px serif';
      ctx.textAlign = 'center';
      ctx.fillText(body.emoji, x, y);
    });
  }

  function _renderGrid() {
    var canvas = _state.canvases.grid;
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;
    
    ctx.clearRect(0, 0, w, h);
    
    var primaryColor = getComputedStyle(document.body).getPropertyValue('--theme-primary') || '#33ff33';
    ctx.strokeStyle = primaryColor;
    ctx.globalAlpha = 0.1;
    ctx.lineWidth = 1;
    
    // Horizontal lines (altitude)
    for (var alt = 0; alt <= 90; alt += 15) {
      var y = h * (1 - alt / 90);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      
      // Label
      ctx.globalAlpha = 0.3;
      ctx.font = '10px Share Tech Mono';
      ctx.fillText(alt + '°', 5, y - 2);
      ctx.globalAlpha = 0.1;
    }
    
    // Vertical lines (azimuth)
    for (var az = 0; az < 360; az += 30) {
      var x = w * (az / 360);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    
    ctx.globalAlpha = 1;
  }

  function _renderConstellationLines() {
    var canvas = _state.canvases.constellation;
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;
    
    ctx.clearRect(0, 0, w, h);
    
    if (!_state.currentConstellation) return;
    
    var primaryColor = getComputedStyle(document.body).getPropertyValue('--theme-primary') || '#33ff33';
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2;
    
    var connections = _state.currentConstellation.connections;
    
    connections.forEach(function(conn) {
      var star1 = _state.stars[conn[0]];
      var star2 = _state.stars[conn[1]];
      
      if (star1 && star2 && star1.screenX && star2.screenX) {
        // Check if both stars are in traced path
        var inPath = _state.tracedPath.includes(conn[0]) && _state.tracedPath.includes(conn[1]);
        
        ctx.globalAlpha = inPath ? 0.8 : 0.2;
        ctx.beginPath();
        ctx.moveTo(star1.screenX, star1.screenY);
        ctx.lineTo(star2.screenX, star2.screenY);
        ctx.stroke();
      }
    });
    
    ctx.globalAlpha = 1;
  }

  // ═══════════════════════════════════════════════════════════════
  // STAR POSITIONING
  // ═══════════════════════════════════════════════════════════════

  function _celestialToScreen(ra, dec) {
    // Simplified projection for demo
    // In real implementation, would use proper celestial coordinate conversion
    
    // Map RA to azimuth (0-360)
    var az = ra;
    // Map Dec to altitude (-90 to 90)
    var alt = dec;
    
    // View bounds
    var viewAzMin = _state.azimuth - 60;
    var viewAzMax = _state.azimuth + 60;
    var viewAltMin = _state.altitude - 40;
    var viewAltMax = _state.altitude + 40;
    
    // Normalize RA for wrapping
    while (az < viewAzMin) az += 360;
    while (az > viewAzMax) az -= 360;
    
    // Check if in view
    if (az < viewAzMin - 30 || az > viewAzMax + 30) return null;
    if (alt < viewAltMin || alt > viewAltMax) return null;
    
    // Convert to screen coordinates
    var w = window.innerWidth;
    var h = window.innerHeight;
    
    var x = w * ((az - viewAzMin) / (viewAzMax - viewAzMin));
    var y = h * (1 - (alt - viewAltMin) / (viewAltMax - viewAltMin));
    
    return { x: x, y: y };
  }

  // ═══════════════════════════════════════════════════════════════
  // GAME LOGIC
  // ═══════════════════════════════════════════════════════════════

  function _checkStarsInView() {
    _state.foundStars = [];
    
    Object.values(_state.stars).forEach(function(star) {
      if (star.screenX && star.screenY) {
        // Check if star is "centered" in view (crosshair)
        var centerX = window.innerWidth / 2;
        var centerY = window.innerHeight / 2;
        var dist = Math.sqrt(
          Math.pow(star.screenX - centerX, 2) + 
          Math.pow(star.screenY - centerY, 2)
        );
        
        // Within 100px of center = "found"
        if (dist < 100) {
          _state.foundStars.push(star.id);
          
          // Add to traced path if not already there
          if (!_state.tracedPath.includes(star.id)) {
            _state.tracedPath.push(star.id);
            _checkConstellationComplete();
          }
        }
      }
    });
    
    _updateHUD();
  }

  function _checkStarInPorthole(cardEl) {
    // When porthole card is clicked, check what's visible through it
    var rect = cardEl.getBoundingClientRect();
    var centerX = rect.left + rect.width / 2;
    var centerY = rect.top + rect.height / 2;
    
    Object.values(_state.stars).forEach(function(star) {
      if (star.screenX && star.screenY) {
        var dist = Math.sqrt(
          Math.pow(star.screenX - centerX, 2) + 
          Math.pow(star.screenY - centerY, 2)
        );
        
        if (dist < rect.width / 2) {
          _showTargetPanel(star);
        }
      }
    });
  }

  function _showTargetPanel(star) {
    var panel = document.getElementById('target-panel');
    var name = document.getElementById('target-name');
    var mag = document.getElementById('target-mag');
    var constellation = document.getElementById('target-const');
    
    if (panel && name) {
      name.textContent = star.name;
      if (mag) mag.textContent = star.magnitude.toFixed(2);
      if (constellation) constellation.textContent = star.constellation.toUpperCase();
      
      panel.hidden = false;
      
      // Auto-hide after 3 seconds
      setTimeout(function() {
        panel.hidden = true;
      }, 3000);
    }
  }

  function _checkConstellationComplete() {
    if (!_state.currentConstellation) return;
    
    var required = _state.currentConstellation.starIds;
    var traced = _state.tracedPath;
    
    // Check if all required stars are in traced path
    var complete = required.every(function(id) {
      return traced.includes(id);
    });
    
    if (complete && !_state.solvedConstellations.includes(_state.currentConstellation.id)) {
      _state.solvedConstellations.push(_state.currentConstellation.id);
      _onConstellationSolved(_state.currentConstellation);
    }
  }

  function _onConstellationSolved(constellation) {
    console.log('[TELESCOPE] Constellation solved:', constellation.name);
    
    // Award coins
    var amount = 10;
    try {
      var acct = JSON.parse(localStorage.getItem('eyesonly_account') || '{}');
      acct.constellationCoins = (acct.constellationCoins || 0) + amount;
      localStorage.setItem('eyesonly_account', JSON.stringify(acct));
    } catch (e) {}
    
    // Show notification
    var msg = constellation.name + ' complete! +' + amount + ' coins';
    _showNotification(msg);
    
    // Save progress
    _saveProgress();
  }

  function _showNotification(message) {
    var notification = document.createElement('div');
    notification.className = 'telescope-notification';
    notification.textContent = message;
    notification.style.cssText = [
      'position: fixed',
      'top: 50%',
      'left: 50%',
      'transform: translate(-50%, -50%)',
      'background: rgba(0,0,0,0.9)',
      'border: 2px solid var(--theme-primary, #33ff33)',
      'padding: 20px 40px',
      'font-family: Share Tech Mono, monospace',
      'font-size: 18px',
      'letter-spacing: 2px',
      'z-index: 1000',
      'animation: notification-appear 0.5s ease'
    ].join(';');
    
    document.body.appendChild(notification);
    
    setTimeout(function() {
      notification.remove();
    }, 3000);
  }

  // ═══════════════════════════════════════════════════════════════
  // PROGRESS PERSISTENCE
  // ═══════════════════════════════════════════════════════════════

  function _saveProgress() {
    try {
      localStorage.setItem('telescope_progress', JSON.stringify({
        solvedConstellations: _state.solvedConstellations,
        tracedPath: _state.tracedPath
      }));
    } catch (e) {}
  }

  function _loadProgress() {
    try {
      var data = JSON.parse(localStorage.getItem('telescope_progress'));
      if (data) {
        _state.solvedConstellations = data.solvedConstellations || [];
        _state.tracedPath = data.tracedPath || [];
      }
    } catch (e) {}
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════

  function _makePRNG(seed) {
    var s = seed | 0;
    return function() {
      s = (s * 1664525 + 1013904223) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════

  return {
    init: init,
    getState: function() { return _state; },
    setLens: _setActiveLens
  };

})();
