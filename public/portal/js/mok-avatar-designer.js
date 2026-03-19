/**
 * mok-avatar-designer.js — MOK Avatar Designer Portal
 *
 * State machine for MOK avatar emotional states,
 * theme-based coloring, and speech pattern configuration.
 *
 * Used in: public/portal/mok-avatar-designer.html
 */

var MOKAvatarDesigner = (function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════

  var _state = {
    theme: 'phosphor',
    emotion: 'neutral',
    animation: {
      spinSpeed: 6,
      rotateX: -20,
      tiltAmount: 30,
      pulseIntensity: 50,
      shakeAmount: 0
    },
    speech: {
      tooltipAnim: 'none',
      rate: 1.0,
      pitch: 1.0
    },
    scale: 100,
    customColors: {
      side1a: '#ff6d70',
      side1b: '#ff6d70',
      side2a: '#ffe600',
      side2b: '#ffe600',
      side3a: '#6cffd6',
      side3b: '#6cffd6',
      shadow: '#ff6d70'
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // THEME PRESETS
  // ═══════════════════════════════════════════════════════════════

  var THEME_PRESETS = {
    phosphor: {
      side1a: '#33ff33', side1b: '#1a9c1a',
      side2a: '#1a9c1a', side2b: '#33ff33',
      side3a: '#33ff33', side3b: '#1a9c1a',
      shadow: '#33ff33'
    },
    amber: {
      side1a: '#ffb000', side1b: '#cc8800',
      side2a: '#cc8800', side2b: '#ffb000',
      side3a: '#ffb000', side3b: '#cc8800',
      shadow: '#ffb000'
    },
    silver: {
      side1a: '#b0c4de', side1b: '#8a9ab0',
      side2a: '#8a9ab0', side2b: '#b0c4de',
      side3a: '#b0c4de', side3b: '#8a9ab0',
      shadow: '#b0c4de'
    },
    panther: {
      side1a: '#ff3090', side1b: '#c4006e',
      side2a: '#c4006e', side2b: '#ff3090',
      side3a: '#ff3090', side3b: '#c4006e',
      shadow: '#ff3090'
    },
    pentagram: {
      side1a: '#ff6d70', side1b: '#ff6d70',
      side2a: '#ffe600', side2b: '#ffe600',
      side3a: '#6cffd6', side3b: '#6cffd6',
      shadow: '#ff6d70'
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // DOM ELEMENTS
  // ═══════════════════════════════════════════════════════════════

  var _elements = {};

  // ═══════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════

  function init() {
    _cacheElements();
    _bindEvents();
    _applyState();
    _updateOutputs();
    console.log('[MOKAvatarDesigner] Initialized');
  }

  function _cacheElements() {
    _elements.preview = document.getElementById('avatar-preview');
    _elements.cssOutput = document.getElementById('css-output');
    _elements.configOutput = document.getElementById('config-output');
    _elements.currentState = document.getElementById('current-state');
    _elements.toast = document.getElementById('toast');
  }

  // ═══════════════════════════════════════════════════════════════
  // EVENT BINDING
  // ═══════════════════════════════════════════════════════════════

  function _bindEvents() {
    // Theme color pickers
    ['side1-color-a', 'side1-color-b', 'side2-color-a', 'side2-color-b', 
     'side3-color-a', 'side3-color-b', 'shadow-color'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', _onColorChange);
      }
    });

    // Theme preset buttons
    document.querySelectorAll('.preset-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        _applyThemePreset(btn.dataset.theme);
      });
    });

    // Animation sliders
    _bindSlider('spin-speed', 'spin-speed-val', function(v) {
      _state.animation.spinSpeed = parseInt(v);
      _elements.preview.className = _getPreviewClass();
      _updateOutputs();
    }, function(v) { return v + 's'; });

    _bindSlider('rotate-x', 'rotate-x-val', function(v) {
      _state.animation.rotateX = parseInt(v);
      _elements.preview.style.transform = 'rotateX(' + v + 'deg)';
      _updateOutputs();
    }, function(v) { return v + '°'; });

    _bindSlider('tilt-amount', 'tilt-amount-val', function(v) {
      _state.animation.tiltAmount = parseInt(v);
      _updateOutputs();
    }, function(v) { return v + '°'; });

    _bindSlider('pulse-intensity', null, function(v) {
      _state.animation.pulseIntensity = parseInt(v);
      _elements.preview.className = _getPreviewClass();
      _updateOutputs();
    }, function(v) { return v; });

    _bindSlider('shake-amount', null, function(v) {
      _state.animation.shakeAmount = parseInt(v);
      _updateOutputs();
    }, function(v) { return v; });

    // Scale slider
    _bindSlider('avatar-scale', 'avatar-scale-val', function(v) {
      _state.scale = parseInt(v);
      _elements.preview.style.transform = 'rotateX(' + _state.animation.rotateX + 'deg) scale(' + (v/100) + ')';
      _updateOutputs();
    }, function(v) { return v + '%'; });

    // Emotion buttons
    document.querySelectorAll('.emotion-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        _setEmotion(btn.dataset.emotion);
      });
    });

    // Speech pattern controls
    document.getElementById('tooltip-anim').addEventListener('change', function(e) {
      _state.speech.tooltipAnim = e.target.value;
      _updateOutputs();
    });

    _bindSlider('speech-rate', 'speech-rate-val', function(v) {
      _state.speech.rate = v / 100;
      _updateOutputs();
    }, function(v) { return (v/100).toFixed(1) + 'x'; });

    _bindSlider('speech-pitch', 'speech-pitch-val', function(v) {
      _state.speech.pitch = v / 100;
      _updateOutputs();
    }, function(v) { return (v/100).toFixed(1) + 'x'; });

    // Export buttons
    document.getElementById('export-btn').addEventListener('click', _exportConfig);
    document.getElementById('copy-css').addEventListener('click', function() {
      _copyToClipboard(_elements.cssOutput.value);
    });
    document.getElementById('copy-config').addEventListener('click', function() {
      _copyToClipboard(_elements.configOutput.value);
    });

    // Preview button
    document.getElementById('preview-btn').addEventListener('click', _previewInDebrief);
  }

  function _bindSlider(sliderId, displayId, onChange, formatter) {
    var slider = document.getElementById(sliderId);
    var display = displayId ? document.getElementById(displayId) : null;
    
    slider.addEventListener('input', function() {
      onChange(slider.value);
      if (display) display.textContent = formatter(slider.value);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // STATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  function _onColorChange(e) {
    var id = e.target.id;
    var color = e.target.value;
    
    switch(id) {
      case 'side1-color-a': _state.customColors.side1a = color; break;
      case 'side1-color-b': _state.customColors.side1b = color; break;
      case 'side2-color-a': _state.customColors.side2a = color; break;
      case 'side2-color-b': _state.customColors.side2b = color; break;
      case 'side3-color-a': _state.customColors.side3a = color; break;
      case 'side3-color-b': _state.customColors.side3b = color; break;
      case 'shadow-color': _state.customColors.shadow = color; break;
    }
    
    _applyCustomColors();
    _updateOutputs();
  }

  function _applyThemePreset(theme) {
    _state.theme = theme;
    
    var preset = THEME_PRESETS[theme];
    if (preset) {
      _state.customColors = Object.assign({}, preset);
      
      // Update color pickers
      document.getElementById('side1-color-a').value = preset.side1a;
      document.getElementById('side1-color-b').value = preset.side1b;
      document.getElementById('side2-color-a').value = preset.side2a;
      document.getElementById('side2-color-b').value = preset.side2b;
      document.getElementById('side3-color-a').value = preset.side3a;
      document.getElementById('side3-color-b').value = preset.side3b;
      document.getElementById('shadow-color').value = preset.shadow;
    }
    
    _applyState();
    _updateOutputs();
  }

  function _setEmotion(emotion) {
    _state.emotion = emotion;
    
    // Update buttons
    document.querySelectorAll('.emotion-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.emotion === emotion);
    });
    
    // Update preview
    _elements.preview.className = _getPreviewClass();
    
    // Update state display
    _elements.currentState.textContent = 'State: ' + emotion;
    
    _updateOutputs();
  }

  function _applyState() {
    _applyCustomColors();
    _elements.preview.style.transform = 'rotateX(' + _state.animation.rotateX + 'deg) scale(' + (_state.scale/100) + ')';
    _elements.preview.className = _getPreviewClass();
  }

  function _applyCustomColors() {
    var s1a = _state.customColors.side1a;
    var s1b = _state.customColors.side1b;
    var s2a = _state.customColors.side2a;
    var s2b = _state.customColors.side2b;
    var s3a = _state.customColors.side3a;
    var s3b = _state.customColors.side3b;
    var sh = _state.customColors.shadow;
    
    var s1 = _elements.preview.querySelector('.side1');
    var s2 = _elements.preview.querySelector('.side2');
    var s3 = _elements.preview.querySelector('.side3');
    var s4 = _elements.preview.querySelector('.side4');
    var shd = _elements.preview.querySelector('.shadow');
    
    if (s1) s1.style.background = 'conic-gradient(' + s1a + ', ' + s1a + ', ' + s1b + ', ' + s1b + ')';
    if (s2) s2.style.background = 'conic-gradient(' + s2a + ', ' + s2a + ', ' + s2b + ', ' + s2b + ')';
    if (s3) s3.style.background = 'conic-gradient(' + s3a + ', ' + s3a + ', ' + s3b + ', ' + s3b + ')';
    if (s4) s4.style.background = 'conic-gradient(' + s1a + ', ' + s1a + ', ' + s1b + ', ' + s1b + ')';
    if (shd) {
      shd.style.background = 'linear-gradient(' + sh + ', ' + sh + ')';
      shd.style.boxShadow = '0 0 20px ' + sh;
    }
  }

  function _getPreviewClass() {
    var classes = ['pyramid-loader'];
    
    // Theme
    classes.push('theme-' + _state.theme);
    
    // Emotion
    classes.push('emotion-' + _state.emotion);
    
    // Speed
    classes.push('speed-' + _state.animation.spinSpeed);
    
    // Pulse
    var pulseLevel = Math.round(_state.animation.pulseIntensity / 25);
    if (pulseLevel > 0) {
      classes.push('pulse-' + (pulseLevel * 25));
    }
    
    // Scale
    classes.push('scale-' + _state.scale);
    
    return classes.join(' ');
  }

  // ═══════════════════════════════════════════════════════════════
  // OUTPUT GENERATION
  // ═══════════════════════════════════════════════════════════════

  function _updateOutputs() {
    _generateCSS();
    _generateConfig();
  }

  function _generateCSS() {
    var css = '/* MOK Avatar CSS — Generated by MOK Avatar Designer */\n\n';
    css += '.mok-avatar {\n';
    css += '  transform: rotateX(' + _state.animation.rotateX + 'deg) scale(' + (_state.scale/100) + ');\n';
    css += '}\n\n';
    css += '.mok-avatar .side1 { background: conic-gradient(' + _state.customColors.side1a + ', ' + _state.customColors.side1a + ', ' + _state.customColors.side1b + ', ' + _state.customColors.side1b + '); }\n';
    css += '.mok-avatar .side2 { background: conic-gradient(' + _state.customColors.side2a + ', ' + _state.customColors.side2a + ', ' + _state.customColors.side2b + ', ' + _state.customColors.side2b + '); }\n';
    css += '.mok-avatar .side3 { background: conic-gradient(' + _state.customColors.side3a + ', ' + _state.customColors.side3a + ', ' + _state.customColors.side3b + ', ' + _state.customColors.side3b + '); }\n';
    css += '.mok-avatar .side4 { background: conic-gradient(' + _state.customColors.side1a + ', ' + _state.customColors.side1a + ', ' + _state.customColors.side1b + ', ' + _state.customColors.side1b + '); }\n';
    css += '.mok-avatar .shadow { background: ' + _state.customColors.shadow + '; }\n\n';
    css += '/* Animation: ' + _state.emotion + ' */\n';
    css += '.mok-avatar.emotion-' + _state.emotion + ' {\n';
    css += '  animation: emotion-' + _state.emotion + ' ' + (20/_state.animation.spinSpeed) + 's ease-in-out infinite;\n';
    css += '}\n';
    
    _elements.cssOutput.value = css;
  }

  function _generateConfig() {
    var config = {
      version: 1,
      theme: _state.theme,
      emotion: _state.emotion,
      animation: Object.assign({}, _state.animation),
      speech: Object.assign({}, _state.speech),
      scale: _state.scale,
      colors: Object.assign({}, _state.customColors),
      exportDate: new Date().toISOString()
    };
    
    _elements.configOutput.value = JSON.stringify(config, null, 2);
  }

  // ═══════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════

  function _exportConfig() {
    var config = {
      version: 1,
      theme: _state.theme,
      emotion: _state.emotion,
      animation: _state.animation,
      speech: _state.speech,
      scale: _state.scale,
      colors: _state.customColors
    };
    
    var blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'mok-avatar-' + _state.theme + '-' + _state.emotion + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function _previewInDebrief() {
    // Store config in sessionStorage for Debrief Feed to pick up
    try {
      sessionStorage.setItem('mok_avatar_preview', JSON.stringify({
        theme: _state.theme,
        emotion: _state.emotion,
        animation: _state.animation,
        speech: _state.speech,
        scale: _state.scale,
        colors: _state.customColors
      }));
      _showToast('Config saved! Open Debrief Feed to preview.');
    } catch (e) {
      _showToast('Could not save preview config');
    }
  }

  function _copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(function() {
      _showToast('Copied to clipboard!');
    }).catch(function() {
      _showToast('Failed to copy');
    });
  }

  function _showToast(message) {
    _elements.toast.textContent = message;
    _elements.toast.hidden = false;
    setTimeout(function() {
      _elements.toast.hidden = true;
    }, 2000);
  }

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════

  return {
    init: init,
    getState: function() { return JSON.parse(JSON.stringify(_state)); },
    setEmotion: _setEmotion,
    applyTheme: _applyThemePreset
  };

})();

// Initialize on load
document.addEventListener('DOMContentLoaded', function() {
  MOKAvatarDesigner.init();
});
