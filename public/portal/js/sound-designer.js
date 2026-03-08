/* ============================================================
   Sound Designer — Portal Logic
   Loads audio-manifest.json, provides preview playback,
   per-designer sound assignment, and R2 upload for audio/video.
   ============================================================ */

var SoundDesigner = (function () {
  'use strict';

  // ---- State ----
  var _manifest = null;          // parsed audio-manifest.json
  var _selectedSoundId = null;   // currently highlighted sound key
  var _assignments = {};         // { "asset:DESK_CLUSTER_OFFICE:on-break": "hit-1", ... }
  var _uploadQueue = [];         // [{ file, status, progress }]
  var _uploadHistory = [];

  // Audio preview — streaming via <audio> element
  var _audioCtx = null;
  var _previewAudio = null;     // HTMLAudioElement (reused)
  var _previewGain = null;      // GainNode for volume
  var _analyser = null;         // AnalyserNode for waveform
  var _mediaSource = null;      // MediaElementAudioSourceNode (created once)
  var _isPlaying = false;
  var _rafId = null;            // requestAnimationFrame handle

  // Active context tab inside Assign panel
  var _activeCtx = 'asset';

  // ---- Constants ----
  var IS_LOCAL     = location.protocol === 'file:';
  var ORIGIN       = IS_LOCAL ? 'https://flapsandseals.com' : '';
  var MANIFEST_URL = ORIGIN + '/audio/audio-manifest.json';
  var UPLOAD_API   = ORIGIN + '/api/audio/upload';
  var STORAGE_KEY  = 'sound-designer-assignments';
  var MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
  var ALLOWED_EXTS = ['.wav', '.mp3', '.ogg', '.webm', '.m4a', '.mp4', '.opus'];

  // ---- Init ----

  function init() {
    _restoreAssignments();
    _bindTabs();
    _bindContextTabs();
    _bindSearch();
    _bindUpload();
    _bindInspector();
    _bindHeaderActions();
    _bindAssignButtons();
    _bindStaticLibrary();
    _bindKeyboard();
    _loadManifest();        // optional enrichment — library works without it
  }

  // ---- Manifest Loading (optional enrichment) ----

  function _loadManifest() {
    fetch(MANIFEST_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('Manifest fetch failed: ' + res.status);
        return res.json();
      })
      .then(function (data) {
        _manifest = data;
        _toast('Manifest loaded — ' + Object.keys(data).filter(function (k) { return k !== '_meta'; }).length + ' sounds');
      })
      .catch(function (err) {
        console.warn('[SoundDesigner] manifest fetch skipped (static library still works):', err);
      });
  }

  // ---- Static Library Binding ----
  // All 167 sounds are baked as static <button class="sound-item"> elements.
  // We bind click handlers, category collapse, and count badges on init.

  function _bindStaticLibrary() {
    var container = document.getElementById('library-categories');
    if (!container) return;

    // Bind click on every static sound button
    container.querySelectorAll('.sound-item[data-sound-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        _selectSound(btn.dataset.soundId);
      });
    });

    // Bind collapse/expand on category headers
    container.querySelectorAll('.category-header').forEach(function (header) {
      var items = header.nextElementSibling; // .category-items
      header.addEventListener('click', function () {
        header.classList.toggle('collapsed');
        if (items) items.classList.toggle('collapsed');
      });
    });
  }

  /**
   * Filter the static library by search query (show/hide).
   * Empty filter shows everything.
   */
  function _filterLibrary(filter) {
    var container = document.getElementById('library-categories');
    if (!container) return;
    var q = (filter || '').toLowerCase().trim();

    container.querySelectorAll('.category-section').forEach(function (section) {
      var items = section.querySelector('.category-items');
      var header = section.querySelector('.category-header');
      if (!items) return;

      var visibleCount = 0;
      items.querySelectorAll('.sound-item[data-sound-id]').forEach(function (btn) {
        var id = btn.dataset.soundId || '';
        var label = btn.textContent || '';
        var title = btn.dataset.title || '';
        var match = !q || id.toLowerCase().indexOf(q) !== -1 ||
                    label.toLowerCase().indexOf(q) !== -1 ||
                    title.toLowerCase().indexOf(q) !== -1;
        btn.style.display = match ? '' : 'none';
        if (match) visibleCount++;
      });

      // Hide entire category section if nothing matches
      section.style.display = visibleCount > 0 ? '' : 'none';

      // Update count badge
      var countEl = header ? header.querySelector('.count') : null;
      if (countEl) countEl.textContent = visibleCount;
    });
  }

  function _catEmoji(cat) {
    var map = {
      ui: '🖥', movement: '🏃', combat: '⚔️', magic: '✨',
      environment: '🌿', collectible: '💎', creature: '🐾', music: '🎵'
    };
    return map[cat] || '📁';
  }

  function _displayName(id, entry) {
    if (entry.title) return entry.title;
    return id.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  // ---- Sound Selection ----

  /**
   * Build an entry object from data-* attributes on the static button,
   * enriched by manifest data if available.
   */
  function _entryFromDOM(id) {
    var btn = document.querySelector('.sound-item[data-sound-id="' + id + '"]');
    if (!btn) return null;

    // Start from manifest if available
    var base = (_manifest && _manifest[id]) ? Object.assign({}, _manifest[id]) : {};

    // Overlay / fill from DOM data attributes
    base.src      = base.src      || btn.dataset.src      || '';
    base.category = base.category || btn.dataset.category  || 'other';
    base.loop     = (base.loop != null) ? base.loop : (btn.dataset.loop === 'true');
    base.title    = base.title    || btn.dataset.title     || '';
    base.artist   = base.artist   || btn.dataset.artist    || '';

    return base;
  }

  function _selectSound(id) {
    _selectedSoundId = id;

    // Update library highlights
    document.querySelectorAll('.sound-item').forEach(function (el) {
      el.classList.toggle('selected', el.dataset.soundId === id);
    });

    var entry = _entryFromDOM(id);
    if (!entry) return;

    // Update preview panel
    document.getElementById('preview-name').textContent = _displayName(id, entry);
    document.getElementById('preview-meta').textContent =
      'Category: ' + entry.category + '  |  Key: ' + id + '  |  ' + (entry.src || '');
    document.getElementById('preview-play-btn').disabled = false;
    document.getElementById('waveform-placeholder').style.display = 'none';

    // Update inspector
    _updateInspector(id, entry);

    // Set streaming preview source (no full download)
    _setPreviewSrc(entry.src);

    // Update assignment grid values
    _refreshAssignmentSlots();
  }

  // ---- Audio Preview (streaming via <audio> element) ----

  function _ensureAudioCtx() {
    if (!_audioCtx) {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
  }

  /**
   * Create (once) or return the hidden <audio> element and its
   * Web Audio graph: audio → MediaElementSource → Gain → Analyser → destination
   */
  function _ensurePreviewAudio() {
    if (_previewAudio) return _previewAudio;

    _ensureAudioCtx();

    _previewAudio = new Audio();
    _previewAudio.crossOrigin = 'anonymous';   // required for CORS + Web Audio
    _previewAudio.preload = 'auto';

    // Build the Web Audio graph once
    _mediaSource = _audioCtx.createMediaElementSource(_previewAudio);
    _previewGain = _audioCtx.createGain();
    _analyser    = _audioCtx.createAnalyser();
    _analyser.fftSize = 2048;

    _mediaSource.connect(_previewGain);
    _previewGain.connect(_analyser);
    _analyser.connect(_audioCtx.destination);

    // Sync UI when track ends naturally
    _previewAudio.addEventListener('ended', function () {
      _isPlaying = false;
      _stopWaveformLoop();
      document.getElementById('preview-play-btn').textContent = '▶';
    });

    // Resume waveform when data resumes after a stall
    _previewAudio.addEventListener('playing', function () {
      if (_isPlaying && !_rafId) {
        _drawLiveWaveform();
      }
    });

    // Stall / waiting — browser ran out of buffered data
    _previewAudio.addEventListener('waiting', function () {
      console.log('[SoundDesigner] audio waiting — buffering…');
      // Pause waveform loop while buffering to avoid showing frozen flat line
      _stopWaveformLoop();
      _drawBufferingIndicator();
    });

    _previewAudio.addEventListener('error', function () {
      var err = _previewAudio.error;
      console.warn('[SoundDesigner] audio error:', err ? err.message : 'unknown');
      _isPlaying = false;
      _stopWaveformLoop();
      document.getElementById('preview-play-btn').textContent = '▶';
    });

    // Draw waveform once metadata / enough data is buffered
    _previewAudio.addEventListener('canplay', function () {
      _drawStaticWaveformFromAnalyser();
    });

    return _previewAudio;
  }

  /**
   * Point the preview at a new src (streams on demand — no full download).
   */
  function _setPreviewSrc(src) {
    if (!src) return;
    _stopPreview();

    var url = (src.indexOf('://') === -1) ? ORIGIN + src : src;
    var audio = _ensurePreviewAudio();
    audio.src = url;
    audio.load();

    // Reset waveform canvas to blank
    _clearWaveformCanvas();
  }

  // ---- Waveform Drawing ----

  function _clearWaveformCanvas() {
    var canvas = document.getElementById('waveform-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.parentElement.clientWidth;
    var h = canvas.parentElement.clientHeight;
    canvas.width = w;
    canvas.height = h;
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);
    // Draw flat centre line
    ctx.strokeStyle = '#1a3a1a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
  }

  /**
   * One-shot static-looking waveform grabbed from the AnalyserNode
   * time-domain data the moment `canplay` fires.
   * This gives a quick visual even before the user hits play.
   */
  function _drawStaticWaveformFromAnalyser() {
    if (!_analyser) return;
    var canvas = document.getElementById('waveform-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.parentElement.clientWidth;
    var h = canvas.parentElement.clientHeight;
    canvas.width = w;
    canvas.height = h;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);

    // Use frequency data for a more visually interesting static display
    var bufLen = _analyser.frequencyBinCount;
    var data = new Uint8Array(bufLen);
    _analyser.getByteTimeDomainData(data);

    ctx.strokeStyle = '#33ff33';
    ctx.lineWidth = 1;
    ctx.beginPath();
    var sliceW = w / bufLen;
    for (var i = 0; i < bufLen; i++) {
      var v = data[i] / 128.0;
      var y = (v * h) / 2;
      if (i === 0) ctx.moveTo(0, y);
      else ctx.lineTo(i * sliceW, y);
    }
    ctx.stroke();
  }

  /**
   * Live waveform loop — runs while playing.
   */
  function _drawLiveWaveform() {
    if (!_analyser) return;
    var canvas = document.getElementById('waveform-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;

    var bufLen = _analyser.frequencyBinCount;
    var data = new Uint8Array(bufLen);
    _analyser.getByteTimeDomainData(data);

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#33ff33';
    ctx.lineWidth = 1;
    ctx.beginPath();

    var sliceW = w / bufLen;
    for (var i = 0; i < bufLen; i++) {
      var v = data[i] / 128.0;
      var y = (v * h) / 2;
      if (i === 0) ctx.moveTo(0, y);
      else ctx.lineTo(i * sliceW, y);
    }
    ctx.stroke();

    _rafId = requestAnimationFrame(_drawLiveWaveform);
  }

  function _stopWaveformLoop() {
    if (_rafId) {
      cancelAnimationFrame(_rafId);
      _rafId = null;
    }
  }

  /** Draw a pulsing "Buffering…" overlay on the waveform canvas. */
  function _drawBufferingIndicator() {
    var canvas = document.getElementById('waveform-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#33ff33';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Buffering…', w / 2, h / 2 + 4);
  }

  // ---- Play / Stop / Toggle ----

  function _togglePreview() {
    if (_isPlaying) {
      _stopPreview();
    } else {
      _playPreview();
    }
  }

  function _playPreview() {
    if (!_previewAudio || !_previewAudio.src) return;
    _ensureAudioCtx();

    var vol = parseInt(document.getElementById('preview-volume').value, 10) / 100;
    if (_previewGain) _previewGain.gain.value = vol;

    _previewAudio.play().then(function () {
      _isPlaying = true;
      document.getElementById('preview-play-btn').textContent = '⏸';
      // Start live waveform
      _stopWaveformLoop();
      _drawLiveWaveform();
    }).catch(function (err) {
      console.warn('[SoundDesigner] playback error:', err);
    });
  }

  function _stopPreview() {
    if (_previewAudio) {
      _previewAudio.pause();
      _previewAudio.currentTime = 0;
    }
    _isPlaying = false;
    _stopWaveformLoop();
    document.getElementById('preview-play-btn').textContent = '▶';
  }

  // ---- Inspector ----

  function _updateInspector(id, entry) {
    var selected = document.getElementById('inspector-selected');
    selected.innerHTML =
      '<div class="inspector-row"><span class="label">Key</span><span class="value">' + id + '</span></div>' +
      '<div class="inspector-row"><span class="label">Source</span><span class="value" style="font-size:10px;word-break:break-all">' + (entry.src || '—') + '</span></div>' +
      '<div class="inspector-row"><span class="label">Category</span><span class="value">' + (entry.category || '—') + '</span></div>';

    document.getElementById('insp-display-name').value = entry.title || _displayName(id, entry);
    document.getElementById('insp-display-name').disabled = false;
    document.getElementById('insp-category').value = entry.category || 'ui';
    document.getElementById('insp-category').disabled = false;
    document.getElementById('insp-volume').value = entry.volume || '';
    document.getElementById('insp-volume').disabled = false;
    document.getElementById('insp-loop').value = entry.loop ? 'true' : 'false';
    document.getElementById('insp-loop').disabled = false;
    document.getElementById('insp-tags').value = (entry.tags || []).join(', ');
    document.getElementById('insp-tags').disabled = false;

    // Show assignments for this sound
    _renderInspectorAssignments(id);

    // Sound properties in preview tab
    var propsEl = document.getElementById('sound-properties');
    var rows = [
      { l: 'Key', v: id },
      { l: 'Source Path', v: entry.src || '—' },
      { l: 'Category', v: entry.category || '—' },
      { l: 'Loop', v: entry.loop ? 'Yes' : 'No' },
    ];
    if (entry.title) rows.push({ l: 'Title', v: entry.title });
    if (entry.artist) rows.push({ l: 'Artist', v: entry.artist });

    propsEl.innerHTML = rows.map(function (r) {
      return '<div class="inspector-row"><span class="label">' + r.l + '</span><span class="value">' + r.v + '</span></div>';
    }).join('');
  }

  function _renderInspectorAssignments(soundId) {
    var list = document.getElementById('inspector-assignments');
    var chips = [];

    Object.keys(_assignments).forEach(function (key) {
      if (_assignments[key] === soundId) {
        var parts = key.split(':');
        chips.push({
          key: key,
          context: parts[0],
          entity: parts[1],
          event: parts[2]
        });
      }
    });

    if (chips.length === 0) {
      list.innerHTML = '<div class="empty-state"><span class="empty-text">No assignments</span></div>';
      return;
    }

    list.innerHTML = chips.map(function (c) {
      return '<div class="assignment-chip">' +
        '<div><div class="chip-label">' + c.event + '</div><div class="chip-context">' + c.context + ' → ' + c.entity + '</div></div>' +
        '<button class="chip-remove" data-key="' + c.key + '">✕</button>' +
        '</div>';
    }).join('');

    list.querySelectorAll('.chip-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        delete _assignments[btn.dataset.key];
        _saveAssignments();
        _renderInspectorAssignments(soundId);
        _refreshAssignmentSlots();
      });
    });
  }

  // ---- Assignment Logic ----

  function _makeAssignKey(context, entity, event) {
    return context + ':' + (entity || '_global') + ':' + event;
  }

  function _assignSound(context, event) {
    if (!_selectedSoundId) {
      _toast('Select a sound first', true);
      return;
    }

    var entitySelect = document.getElementById('target-entity-select');
    var entity = entitySelect ? entitySelect.value : '_global';
    var key = _makeAssignKey(context, entity || '_global', event);
    _assignments[key] = _selectedSoundId;
    _saveAssignments();
    _refreshAssignmentSlots();
    _renderInspectorAssignments(_selectedSoundId);
    _toast('Assigned ' + _selectedSoundId + ' → ' + event);
  }

  function _removeAssignment(context, event) {
    var entitySelect = document.getElementById('target-entity-select');
    var entity = entitySelect ? entitySelect.value : '_global';
    var key = _makeAssignKey(context, entity || '_global', event);
    delete _assignments[key];
    _saveAssignments();
    _refreshAssignmentSlots();
    if (_selectedSoundId) _renderInspectorAssignments(_selectedSoundId);
  }

  function _refreshAssignmentSlots() {
    var entitySelect = document.getElementById('target-entity-select');
    var entity = entitySelect ? entitySelect.value : '_global';

    ['asset', 'map', 'interior'].forEach(function (ctx) {
      var grid = document.getElementById(ctx + '-assignment-grid');
      if (!grid) return;
      grid.querySelectorAll('.assign-slot').forEach(function (slot) {
        var event = slot.dataset.event;
        var key = _makeAssignKey(ctx, entity || '_global', event);
        var assignedId = _assignments[key];
        var valEl = slot.querySelector('.slot-empty, .slot-value');
        var removeBtn = slot.querySelector('.slot-btn.remove');

        if (assignedId) {
          if (valEl) {
            valEl.className = 'slot-value';
            valEl.textContent = '♪ ' + assignedId;
          }
          if (removeBtn) removeBtn.style.display = '';
        } else {
          if (valEl) {
            valEl.className = 'slot-empty';
            valEl.textContent = 'drag sound here';
          }
          if (removeBtn) removeBtn.style.display = 'none';
        }
      });
    });
  }

  // ---- Persistence ----

  function _saveAssignments() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_assignments));
    } catch (e) {}
  }

  function _restoreAssignments() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) _assignments = JSON.parse(raw);
    } catch (e) {}
  }

  // ---- Upload ----

  function _handleFiles(files) {
    var queue = document.getElementById('upload-queue');
    var startBtn = document.getElementById('upload-start-btn');

    Array.from(files).forEach(function (file) {
      var ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (ALLOWED_EXTS.indexOf(ext) === -1) {
        _toast('Skipped ' + file.name + ' (unsupported type)', true);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        _toast('Skipped ' + file.name + ' (exceeds 50 MB)', true);
        return;
      }

      var item = { file: file, status: 'queued', progress: 0 };
      _uploadQueue.push(item);

      var el = document.createElement('div');
      el.className = 'upload-item';
      el.dataset.idx = _uploadQueue.length - 1;
      el.innerHTML =
        '<span class="file-name">' + file.name + '</span>' +
        '<span class="file-size">' + _formatSize(file.size) + '</span>' +
        '<div class="progress-bar"><div class="progress-fill" style="width:0%"></div></div>' +
        '<span class="status">queued</span>';
      queue.appendChild(el);
    });

    if (_uploadQueue.length > 0) startBtn.disabled = false;
  }

  function _startUpload() {
    var dest = document.getElementById('upload-dest-select').value;
    var startBtn = document.getElementById('upload-start-btn');
    startBtn.disabled = true;

    var pending = _uploadQueue.filter(function (q) { return q.status === 'queued'; });
    if (pending.length === 0) return;

    var uploaded = 0;
    var errors = 0;

    pending.forEach(function (item, idx) {
      var formData = new FormData();
      formData.append('file', item.file);
      formData.append('destination', dest);
      formData.append('filename', item.file.name);

      item.status = 'uploading';
      _updateUploadItemUI(item);

      fetch(UPLOAD_API, {
        method: 'POST',
        body: formData,
      })
      .then(function (res) {
        if (!res.ok) throw new Error('Upload failed: ' + res.status);
        return res.json();
      })
      .then(function (data) {
        item.status = 'done';
        item.progress = 100;
        uploaded++;
        _uploadHistory.push({ name: item.file.name, dest: dest, time: new Date().toISOString(), key: data.key });
        _updateUploadItemUI(item);
        _renderUploadHistory();
        if (uploaded + errors === pending.length) {
          _toast('Upload complete: ' + uploaded + ' succeeded, ' + errors + ' failed');
        }
      })
      .catch(function (err) {
        item.status = 'error';
        errors++;
        _updateUploadItemUI(item);
        console.error('[SoundDesigner] upload error:', err);
        if (uploaded + errors === pending.length) {
          _toast('Upload complete: ' + uploaded + ' succeeded, ' + errors + ' failed', errors > 0);
        }
      });
    });
  }

  function _updateUploadItemUI(item) {
    var idx = _uploadQueue.indexOf(item);
    var el = document.querySelector('.upload-item[data-idx="' + idx + '"]');
    if (!el) return;

    var fill = el.querySelector('.progress-fill');
    var status = el.querySelector('.status');

    if (item.status === 'uploading') {
      fill.style.width = '50%';
      status.textContent = 'uploading…';
      status.className = 'status';
    } else if (item.status === 'done') {
      fill.style.width = '100%';
      status.textContent = '✓ done';
      status.className = 'status done';
    } else if (item.status === 'error') {
      fill.style.width = '100%';
      fill.style.background = '#ff4444';
      status.textContent = '✕ error';
      status.className = 'status error';
    }
  }

  function _renderUploadHistory() {
    var el = document.getElementById('upload-history');
    if (_uploadHistory.length === 0) {
      el.innerHTML = '<div class="empty-state"><span class="empty-icon">📤</span><span class="empty-text">No uploads yet this session</span></div>';
      return;
    }

    el.innerHTML = _uploadHistory.map(function (h) {
      return '<div class="inspector-row">' +
        '<span class="label">' + h.name + '</span>' +
        '<span class="value" style="color:#33ff33">' + h.dest + '/' + '</span>' +
        '</div>';
    }).join('');
  }

  // ---- Event Bindings ----

  function _bindTabs() {
    document.querySelectorAll('.center-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.center-tab').forEach(function (t) { t.classList.remove('active'); });
        document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
        tab.classList.add('active');
        var panel = document.getElementById('tab-' + tab.dataset.tab);
        if (panel) panel.classList.add('active');
      });
    });
  }

  function _bindContextTabs() {
    document.querySelectorAll('.ctx-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.ctx-tab').forEach(function (t) { t.classList.remove('active'); });
        document.querySelectorAll('.ctx-panel').forEach(function (p) { p.style.display = 'none'; });
        tab.classList.add('active');
        _activeCtx = tab.dataset.ctx;
        var panel = document.getElementById('ctx-' + _activeCtx);
        if (panel) panel.style.display = '';
        _refreshAssignmentSlots();
      });
    });
  }

  function _bindSearch() {
    var input = document.getElementById('library-search');
    if (!input) return;
    var timer = null;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        _filterLibrary(input.value.trim());
      }, 200);
    });
  }

  function _bindUpload() {
    var dropzone = document.getElementById('upload-dropzone');
    var fileInput = document.getElementById('upload-file-input');
    var startBtn = document.getElementById('upload-start-btn');

    if (dropzone) {
      dropzone.addEventListener('click', function () { fileInput.click(); });
      dropzone.addEventListener('dragover', function (e) {
        e.preventDefault();
        dropzone.classList.add('drag-over');
      });
      dropzone.addEventListener('dragleave', function () {
        dropzone.classList.remove('drag-over');
      });
      dropzone.addEventListener('drop', function (e) {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        if (e.dataTransfer.files.length) _handleFiles(e.dataTransfer.files);
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', function () {
        if (fileInput.files.length) _handleFiles(fileInput.files);
        fileInput.value = '';
      });
    }

    if (startBtn) {
      startBtn.addEventListener('click', _startUpload);
    }
  }

  function _bindInspector() {
    // Preview play button
    var playBtn = document.getElementById('preview-play-btn');
    if (playBtn) playBtn.addEventListener('click', _togglePreview);

    // Volume slider — live update during playback
    var volSlider = document.getElementById('preview-volume');
    if (volSlider) {
      volSlider.addEventListener('input', function () {
        if (_previewGain) {
          _previewGain.gain.value = parseInt(volSlider.value, 10) / 100;
        }
      });
    }

    // Target context → populate entities
    var ctxSelect = document.getElementById('target-context-select');
    var entitySelect = document.getElementById('target-entity-select');
    if (ctxSelect) {
      ctxSelect.addEventListener('change', function () {
        _populateEntitySelect(ctxSelect.value);
      });
    }
  }

  function _bindHeaderActions() {
    var refreshBtn = document.getElementById('refresh-manifest-btn');
    var saveBtn = document.getElementById('save-assignments-btn');
    var exportBtn = document.getElementById('export-sound-map-btn');

    if (refreshBtn) refreshBtn.addEventListener('click', function () {
      _loadManifest();
      _toast('Manifest refreshed');
    });

    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        _saveAssignments();
        _toast('Assignments saved to localStorage');
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        _exportSoundMap();
      });
    }
  }

  function _bindAssignButtons() {
    document.querySelectorAll('.assign-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var event = btn.dataset.event;
        var panel = btn.closest('.ctx-panel');
        var ctx = panel ? panel.id.replace('ctx-', '') : _activeCtx;
        _assignSound(ctx, event);
      });
    });

    document.querySelectorAll('.slot-btn.remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var event = btn.dataset.event;
        var panel = btn.closest('.ctx-panel');
        var ctx = panel ? panel.id.replace('ctx-', '') : _activeCtx;
        _removeAssignment(ctx, event);
      });
    });
  }

  function _bindKeyboard() {
    document.addEventListener('keydown', function (e) {
      // Don't intercept when typing in an input/select/textarea
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.code === 'Space') {
        e.preventDefault();
        _togglePreview();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        _stopPreview();
      }
    });
  }

  // ---- Entity Population ----

  function _populateEntitySelect(context) {
    var select = document.getElementById('target-entity-select');
    select.innerHTML = '<option value="">— select entity —</option>';
    select.disabled = !context;

    if (!context) return;

    if (context === 'asset') {
      var assets = (typeof UnifiedDataManager !== 'undefined') ? UnifiedDataManager.getAllAssets() : {};
      Object.keys(assets).forEach(function (id) {
        var opt = document.createElement('option');
        opt.value = id;
        opt.textContent = id;
        select.appendChild(opt);
      });
    } else if (context === 'map') {
      var floors = (typeof UnifiedDataManager !== 'undefined') ? UnifiedDataManager.getAllFloors() : {};
      Object.keys(floors).forEach(function (name) {
        var opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
      });
    } else if (context === 'interior') {
      // Interior entities would come from a similar registry
      var opt = document.createElement('option');
      opt.value = '_global';
      opt.textContent = '(global interior)';
      select.appendChild(opt);
    }

    select.disabled = false;
  }

  // ---- Export ----

  function _exportSoundMap() {
    var output = {
      _meta: {
        exported: new Date().toISOString(),
        version: 1,
        description: 'Sound assignments from Sound Designer Portal'
      },
      assignments: {}
    };

    // Group by context
    Object.keys(_assignments).forEach(function (key) {
      var parts = key.split(':');
      var ctx = parts[0];
      var entity = parts[1];
      var event = parts[2];

      if (!output.assignments[ctx]) output.assignments[ctx] = {};
      if (!output.assignments[ctx][entity]) output.assignments[ctx][entity] = {};
      output.assignments[ctx][entity][event] = _assignments[key];
    });

    var json = JSON.stringify(output, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'sound-assignments.json';
    a.click();
    URL.revokeObjectURL(url);
    _toast('Exported sound-assignments.json');
  }

  // ---- Helpers ----

  function _formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function _toast(msg, isError) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast visible' + (isError ? ' error' : '');
    clearTimeout(el._timer);
    el._timer = setTimeout(function () {
      el.className = 'toast';
    }, 3000);
  }

  // ---- Public API ----

  return {
    init: init,
    getAssignments: function () { return Object.assign({}, _assignments); },
    getManifest: function () { return _manifest; }
  };

})();

// Auto-init on DOM ready
document.addEventListener('DOMContentLoaded', function () {
  SoundDesigner.init();
});
