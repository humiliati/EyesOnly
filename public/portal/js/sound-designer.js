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

  // CRUD state
  var _deletedSoundIds = {};     // { soundId: true } — marked for deletion
  var _missingSoundIds = {};     // { soundId: true } — flagged by gap check
  var _displayNames = {};        // { soundId: "Custom Name" } — local display overrides
  var _manifestDiff = { renames: [], deletes: [], aliases: {} };
  var _originalLibraryHTML = ''; // snapshot for default sort restore

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
  var AUDIO_API    = ORIGIN + '/api/audio';
  var STORAGE_KEY  = 'sound-designer-assignments';
  var STORAGE_DELETED   = 'sound-designer-deleted-ids';
  var STORAGE_MISSING   = 'sound-designer-missing-ids';
  var STORAGE_NAMES     = 'sound-designer-display-names';
  var STORAGE_SORT      = 'sound-designer-sort';
  var STORAGE_DIFF      = 'sound-designer-manifest-diff';
  var MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
  var ALLOWED_EXTS = ['.wav', '.mp3', '.ogg', '.webm', '.m4a', '.mp4', '.opus'];

  // ---- Init ----

  function init() {
    _restoreAssignments();
    _restoreCRUDState();
    _bindTabs();
    _bindContextTabs();
    _bindSearch();
    _bindSort();
    _bindUpload();
    _bindInspector();
    _bindHeaderActions();
    _bindAssignButtons();
    _bindStaticLibrary();
    _bindKeyboard();
    _bindModal();
    _loadManifest();        // optional enrichment — library works without it
    _applyPersistedFlags(); // apply delete marks + missing flags to DOM
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
      environment: '🌿', collectible: '💎', creature: '🐾',
      footstep: '👣', card: '🃏', music: '🎵'
    };
    return map[cat] || '📁';
  }

  function _displayName(id, entry) {
    if (_displayNames[id]) return _displayNames[id];
    if (entry && entry.title) return entry.title;
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

    // Enable action buttons
    document.getElementById('insp-rename-btn').disabled = false;
    var delBtn = document.getElementById('insp-delete-btn');
    delBtn.disabled = false;
    delBtn.textContent = _deletedSoundIds[id] ? '↩️ Unmark Delete' : '🗑️ Mark Delete';

    // Missing warning
    var missingWarn = document.getElementById('insp-missing-warning');
    missingWarn.style.display = _missingSoundIds[id] ? '' : 'none';

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

    // New CRUD header buttons
    var verifyBtn = document.getElementById('verify-assets-btn');
    var syncBtn = document.getElementById('sync-deletes-btn');
    var diffBtn = document.getElementById('export-diff-btn');

    if (verifyBtn) verifyBtn.addEventListener('click', _runGapCheck);
    if (syncBtn) syncBtn.addEventListener('click', _confirmSyncDeletes);
    if (diffBtn) diffBtn.addEventListener('click', _exportManifestDiff);

    // Inspector action buttons
    var renameBtn = document.getElementById('insp-rename-btn');
    var deleteBtn = document.getElementById('insp-delete-btn');
    if (renameBtn) renameBtn.addEventListener('click', _handleRename);
    if (deleteBtn) deleteBtn.addEventListener('click', _handleMarkDelete);

    // Display name editable on blur/enter
    var nameInput = document.getElementById('insp-display-name');
    if (nameInput) {
      nameInput.addEventListener('blur', function () { _saveDisplayName(nameInput.value); });
      nameInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { nameInput.blur(); }
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

  // ---- CRUD State Persistence ----

  function _restoreCRUDState() {
    try {
      var d = localStorage.getItem(STORAGE_DELETED);
      if (d) _deletedSoundIds = JSON.parse(d);
    } catch (e) { _deletedSoundIds = {}; }

    try {
      var m = localStorage.getItem(STORAGE_MISSING);
      if (m) _missingSoundIds = JSON.parse(m);
    } catch (e) { _missingSoundIds = {}; }

    try {
      var n = localStorage.getItem(STORAGE_NAMES);
      if (n) _displayNames = JSON.parse(n);
    } catch (e) { _displayNames = {}; }

    try {
      var df = localStorage.getItem(STORAGE_DIFF);
      if (df) _manifestDiff = JSON.parse(df);
    } catch (e) { _manifestDiff = { renames: [], deletes: [], aliases: {} }; }
  }

  function _saveCRUDState() {
    try {
      localStorage.setItem(STORAGE_DELETED, JSON.stringify(_deletedSoundIds));
      localStorage.setItem(STORAGE_MISSING, JSON.stringify(_missingSoundIds));
      localStorage.setItem(STORAGE_NAMES, JSON.stringify(_displayNames));
      localStorage.setItem(STORAGE_DIFF, JSON.stringify(_manifestDiff));
    } catch (e) { /* quota exceeded — silent */ }
  }

  function _applyPersistedFlags() {
    document.querySelectorAll('.sound-item[data-sound-id]').forEach(function (btn) {
      var id = btn.dataset.soundId;
      if (_deletedSoundIds[id]) btn.classList.add('marked-for-deletion');
      if (_missingSoundIds[id]) btn.classList.add('missing-asset');
    });
    _updateSyncDeleteCount();
    _updateDiffBtnState();
  }

  // ---- Modal System ----

  var _modalConfirmCb = null;

  function _bindModal() {
    var cancelBtn = document.getElementById('modal-cancel');
    var confirmBtn = document.getElementById('modal-confirm');
    var overlay = document.getElementById('modal-overlay');

    if (cancelBtn) cancelBtn.addEventListener('click', _hideModal);
    if (confirmBtn) confirmBtn.addEventListener('click', function () {
      if (_modalConfirmCb) _modalConfirmCb();
      _hideModal();
    });
    if (overlay) overlay.addEventListener('click', function (e) {
      if (e.target === overlay) _hideModal();
    });
  }

  function _showModal(title, bodyHtml, confirmLabel, onConfirm) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    var confirmBtn = document.getElementById('modal-confirm');
    confirmBtn.textContent = confirmLabel || 'Confirm';
    // Style danger buttons
    if (confirmLabel && confirmLabel.toLowerCase().indexOf('delete') !== -1) {
      confirmBtn.className = 'btn-danger';
    } else {
      confirmBtn.className = 'btn-primary';
    }
    _modalConfirmCb = onConfirm || null;
    document.getElementById('modal-overlay').style.display = '';
  }

  function _hideModal() {
    document.getElementById('modal-overlay').style.display = 'none';
    _modalConfirmCb = null;
  }

  // ---- Sort ----

  function _bindSort() {
    var select = document.getElementById('library-sort');
    if (!select) return;

    // Snapshot original library HTML for default restore
    var container = document.getElementById('library-categories');
    if (container) _originalLibraryHTML = container.innerHTML;

    // Restore persisted sort
    var saved = localStorage.getItem(STORAGE_SORT) || 'default';
    select.value = saved;
    if (saved !== 'default') _applySortOrder(saved);

    select.addEventListener('change', function () {
      var mode = select.value;
      localStorage.setItem(STORAGE_SORT, mode);
      _applySortOrder(mode);
    });
  }

  function _applySortOrder(mode) {
    var container = document.getElementById('library-categories');
    if (!container) return;

    if (mode === 'default') {
      container.innerHTML = _originalLibraryHTML;
      _bindStaticLibrary();
      _applyPersistedFlags();
      return;
    }

    // Collect all sound items as data
    var items = [];
    container.querySelectorAll('.sound-item[data-sound-id]').forEach(function (btn) {
      items.push({
        id: btn.dataset.soundId,
        label: btn.textContent.trim().replace(/^♪\s*/, ''),
        category: btn.dataset.category || 'other',
        src: btn.dataset.src || '',
        loop: btn.dataset.loop || 'false',
        title: btn.dataset.title || '',
        outerHTML: btn.outerHTML
      });
    });

    if (mode === 'name') {
      items.sort(function (a, b) { return a.label.localeCompare(b.label); });
      // Flatten into a single category
      container.innerHTML =
        '<div class="category-section"><div class="category-header"><span>🔤 ALL SOUNDS</span><span class="count">' +
        items.length + '</span><span class="chevron">▾</span></div><div class="category-items">' +
        items.map(function (it) { return it.outerHTML; }).join('') +
        '</div></div>';
    } else if (mode === 'category') {
      // Group by category, sort groups and items within
      var groups = {};
      items.forEach(function (it) {
        if (!groups[it.category]) groups[it.category] = [];
        groups[it.category].push(it);
      });
      var cats = Object.keys(groups).sort();
      container.innerHTML = cats.map(function (cat) {
        var sorted = groups[cat].sort(function (a, b) { return a.label.localeCompare(b.label); });
        return '<div class="category-section"><div class="category-header"><span>' +
          _catEmoji(cat) + ' ' + cat.toUpperCase() + '</span><span class="count">' +
          sorted.length + '</span><span class="chevron">▾</span></div><div class="category-items">' +
          sorted.map(function (it) { return it.outerHTML; }).join('') +
          '</div></div>';
      }).join('');
    } else if (mode === 'date') {
      // Fetch upload dates from R2 list, then sort
      _toast('Fetching upload dates…');
      fetch(AUDIO_API + '/list?prefix=audio/&limit=2000')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!data.ok) throw new Error(data.error);
          var dateMap = {};
          (data.files || []).forEach(function (f) {
            dateMap[f.key] = f.uploaded;
          });
          // Sort items by upload date descending (fallback: name)
          items.sort(function (a, b) {
            var pathA = a.src.replace(/^\//, '');
            var pathB = b.src.replace(/^\//, '');
            var dateA = dateMap[pathA] || '1970-01-01';
            var dateB = dateMap[pathB] || '1970-01-01';
            return dateB.localeCompare(dateA);
          });
          container.innerHTML =
            '<div class="category-section"><div class="category-header"><span>📅 BY DATE</span><span class="count">' +
            items.length + '</span><span class="chevron">▾</span></div><div class="category-items">' +
            items.map(function (it) { return it.outerHTML; }).join('') +
            '</div></div>';
          _bindStaticLibrary();
          _applyPersistedFlags();
          _toast('Sorted by upload date');
        })
        .catch(function () {
          _toast('Date sort failed — falling back to Name', true);
          _applySortOrder('name');
        });
      return; // async — rebind happens in .then
    }

    _bindStaticLibrary();
    _applyPersistedFlags();
  }

  // ---- Display Name (local only) ----

  function _saveDisplayName(newName) {
    if (!_selectedSoundId) return;
    var trimmed = (newName || '').trim();
    if (!trimmed) {
      delete _displayNames[_selectedSoundId];
    } else {
      _displayNames[_selectedSoundId] = trimmed;
    }
    _saveCRUDState();
  }

  // ---- Rename (Manifest ID + R2 Keys) ----

  function _handleRename() {
    if (!_selectedSoundId) return;
    if (!_manifest) {
      _toast('Manifest not loaded — cannot rename IDs', true);
      return;
    }

    var currentId = _selectedSoundId;
    var entry = _entryFromDOM(currentId);
    if (!entry) return;

    var newId = prompt('New manifest ID (kebab-case):', currentId);
    if (!newId || newId === currentId) return;

    // Validate kebab-case
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(newId)) {
      _toast('Invalid ID — use kebab-case (e.g. "ui-click")', true);
      return;
    }

    // Check for dupes
    if (document.querySelector('.sound-item[data-sound-id="' + newId + '"]')) {
      _toast('ID "' + newId + '" already exists', true);
      return;
    }

    // Compute R2 keys
    var oldSrcKey = (entry.src || '').replace(/^\//, '');
    var oldFallback = (entry.fallback || '').replace(/^\//, '');

    // Derive new keys from new ID
    var srcDir = oldSrcKey ? oldSrcKey.substring(0, oldSrcKey.lastIndexOf('/') + 1) : 'audio/sfx/';
    var newSrcKey = srcDir + newId + '.webm';
    var newFallbackKey = srcDir + newId + '.mp3';

    _toast('Renaming R2 objects…');

    // Rename webm
    var renamePromises = [];
    if (oldSrcKey) {
      renamePromises.push(
        fetch(AUDIO_API + '/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldKey: oldSrcKey, newKey: newSrcKey })
        }).then(function (r) { return r.json(); })
      );
    }
    // Rename mp3 fallback
    if (oldFallback) {
      renamePromises.push(
        fetch(AUDIO_API + '/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldKey: oldFallback, newKey: newFallbackKey })
        }).then(function (r) { return r.json(); })
      );
    }

    Promise.all(renamePromises)
      .then(function (results) {
        var allOk = results.every(function (r) { return r.ok; });
        if (!allOk) {
          var errs = results.filter(function (r) { return !r.ok; }).map(function (r) { return r.error; });
          _toast('Rename partial failure: ' + errs.join(', '), true);
          return;
        }

        // Record in diff
        _manifestDiff.renames.push({
          oldId: currentId,
          newId: newId,
          oldSrc: '/' + oldSrcKey,
          newSrc: '/' + newSrcKey
        });
        _manifestDiff.aliases[currentId] = newId;
        _saveCRUDState();
        _updateDiffBtnState();

        // Update DOM button
        var btn = document.querySelector('.sound-item[data-sound-id="' + currentId + '"]');
        if (btn) {
          btn.dataset.soundId = newId;
          btn.dataset.src = '/' + newSrcKey;
          // Update visible text
          var textNode = btn.lastChild;
          if (textNode) textNode.textContent = ' ' + _displayName(newId, entry);
        }

        // Transfer display name if exists
        if (_displayNames[currentId]) {
          _displayNames[newId] = _displayNames[currentId];
          delete _displayNames[currentId];
          _saveCRUDState();
        }

        _selectedSoundId = newId;
        _selectSound(newId);
        _toast('Renamed: ' + currentId + ' → ' + newId);
      })
      .catch(function (err) {
        _toast('Rename failed: ' + err.message, true);
      });
  }

  // ---- Delete (Mark / Unmark / Sync) ----

  function _handleMarkDelete() {
    if (!_selectedSoundId) return;
    var id = _selectedSoundId;

    if (_deletedSoundIds[id]) {
      delete _deletedSoundIds[id];
      var btn = document.querySelector('.sound-item[data-sound-id="' + id + '"]');
      if (btn) btn.classList.remove('marked-for-deletion');
      document.getElementById('insp-delete-btn').textContent = '🗑️ Mark Delete';
      _toast('Unmarked: ' + id);
    } else {
      _deletedSoundIds[id] = true;
      var btn2 = document.querySelector('.sound-item[data-sound-id="' + id + '"]');
      if (btn2) btn2.classList.add('marked-for-deletion');
      document.getElementById('insp-delete-btn').textContent = '↩️ Unmark Delete';
      _toast('Marked for deletion: ' + id);
    }

    _saveCRUDState();
    _updateSyncDeleteCount();
    _updateDiffBtnState();
  }

  function _updateSyncDeleteCount() {
    var count = Object.keys(_deletedSoundIds).length;
    var syncBtn = document.getElementById('sync-deletes-btn');
    if (syncBtn) {
      syncBtn.textContent = '🗑️ Sync ' + count + ' Delete' + (count !== 1 ? 's' : '');
      syncBtn.disabled = count === 0;
    }
  }

  function _confirmSyncDeletes() {
    var ids = Object.keys(_deletedSoundIds);
    if (ids.length === 0) return;

    var listHtml = '<p>Permanently delete <strong>' + ids.length + '</strong> sound' +
      (ids.length !== 1 ? 's' : '') + ' from R2? This cannot be undone.</p>' +
      '<div class="delete-list">' +
      ids.map(function (id) { return '<div>• ' + id + '</div>'; }).join('') +
      '</div>';

    _showModal('Confirm Delete from R2', listHtml, 'Delete from R2', function () {
      _syncDeletes(ids);
    });
  }

  function _syncDeletes(ids) {
    // Collect all R2 keys for each marked sound (src + fallback)
    var keys = [];
    ids.forEach(function (id) {
      var entry = _entryFromDOM(id);
      if (entry && entry.src) keys.push(entry.src.replace(/^\//, ''));
      if (entry && entry.fallback) keys.push(entry.fallback.replace(/^\//, ''));
    });

    if (keys.length === 0) {
      _toast('No R2 keys to delete', true);
      return;
    }

    _toast('Deleting ' + keys.length + ' R2 objects…');

    fetch(AUDIO_API + '/delete-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys: keys })
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data.ok) throw new Error(data.error || 'Batch delete failed');

      // Record in diff
      ids.forEach(function (id) {
        _manifestDiff.deletes.push(id);
      });
      _saveCRUDState();

      // Remove DOM buttons
      ids.forEach(function (id) {
        var btn = document.querySelector('.sound-item[data-sound-id="' + id + '"]');
        if (btn) btn.remove();
        delete _deletedSoundIds[id];
      });

      _saveCRUDState();
      _updateSyncDeleteCount();
      _updateDiffBtnState();
      _toast('Deleted ' + data.deletedCount + ' R2 objects' +
        (data.failedCount > 0 ? ' (' + data.failedCount + ' failed)' : ''));

      // Clear selection if deleted
      if (ids.indexOf(_selectedSoundId) !== -1) {
        _selectedSoundId = null;
      }
    })
    .catch(function (err) {
      _toast('Delete failed: ' + err.message, true);
    });
  }

  // ---- Gap Check + Missing-Asset Flags ----

  function _runGapCheck() {
    if (!_manifest) {
      _toast('Manifest not loaded — load it first', true);
      return;
    }

    // Show loading modal
    _showModal('Verifying Assets…', '<p style="text-align:center;color:#888">Comparing manifest against R2 storage…<br><br>⏳</p>', 'Close', null);
    document.getElementById('modal-confirm').style.display = 'none';

    // Strip _meta key from manifest for the check
    var manifestCopy = {};
    Object.keys(_manifest).forEach(function (k) {
      if (k !== '_meta') manifestCopy[k] = _manifest[k];
    });

    fetch(AUDIO_API + '/check-gaps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manifest: manifestCopy })
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data.ok) throw new Error(data.error);

      // Update missing sound IDs
      _missingSoundIds = {};
      (data.broken || []).forEach(function (b) {
        _missingSoundIds[b.id] = true;
      });
      localStorage.setItem(STORAGE_MISSING, JSON.stringify(_missingSoundIds));

      // Apply flags to DOM
      document.querySelectorAll('.sound-item[data-sound-id]').forEach(function (btn) {
        btn.classList.toggle('missing-asset', !!_missingSoundIds[btn.dataset.soundId]);
      });

      // Build result HTML
      var okCount = data.totalManifest - data.broken.length;
      var html = '<div class="gap-summary">' + okCount + ' OK, ' +
        data.broken.length + ' missing, ' + data.orphans.length + ' orphans</div>';

      if (data.broken.length > 0) {
        html += '<h4 style="color:#ff4444;margin-top:12px">Missing Assets (' + data.broken.length + ')</h4>';
        html += '<div class="delete-list">';
        data.broken.forEach(function (b) {
          html += '<div class="gap-broken">• ' + b.id + ' → ' + b.src + ' (' + b.type + ')</div>';
        });
        html += '</div>';
      }

      if (data.orphans.length > 0) {
        html += '<h4 style="color:#ff9933;margin-top:12px">Orphaned R2 Files (' + data.orphans.length + ')</h4>';
        html += '<div class="delete-list" style="border-color:#ff9933">';
        data.orphans.slice(0, 100).forEach(function (o) {
          html += '<div class="gap-orphan">• ' + o.key + '</div>';
        });
        if (data.orphans.length > 100) {
          html += '<div style="color:#888">… and ' + (data.orphans.length - 100) + ' more</div>';
        }
        html += '</div>';
      }

      // Store report data for export
      _lastGapReport = data;

      document.getElementById('modal-title').textContent = 'Asset Verification Report';
      document.getElementById('modal-body').innerHTML = html;
      var confirmBtn = document.getElementById('modal-confirm');
      confirmBtn.textContent = 'Export Report JSON';
      confirmBtn.className = 'btn-secondary';
      confirmBtn.style.display = '';
      _modalConfirmCb = function () {
        _exportGapReport(data);
      };

      // Update inspector if selected
      if (_selectedSoundId) {
        var missingWarn = document.getElementById('insp-missing-warning');
        missingWarn.style.display = _missingSoundIds[_selectedSoundId] ? '' : 'none';
      }
    })
    .catch(function (err) {
      _hideModal();
      _toast('Gap check failed: ' + err.message, true);
    });
  }

  var _lastGapReport = null;

  function _exportGapReport(data) {
    var report = {
      _meta: { exported: new Date().toISOString(), portal: 'sound-designer' },
      totalManifest: data.totalManifest,
      totalR2: data.totalR2,
      broken: data.broken,
      orphans: data.orphans
    };
    var json = JSON.stringify(report, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'gap-check-report-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
    _toast('Gap check report exported');
  }

  // ---- Manifest Diff Export ----

  function _updateDiffBtnState() {
    var btn = document.getElementById('export-diff-btn');
    if (!btn) return;
    var hasChanges = _manifestDiff.renames.length > 0 ||
                     _manifestDiff.deletes.length > 0 ||
                     Object.keys(_manifestDiff.aliases).length > 0;
    btn.disabled = !hasChanges;
  }

  function _exportManifestDiff() {
    var output = {
      _meta: {
        exported: new Date().toISOString(),
        portal: 'sound-designer',
        version: 1
      },
      renames: _manifestDiff.renames,
      deletes: _manifestDiff.deletes,
      aliases: _manifestDiff.aliases,
      brokenRefs: Object.keys(_missingSoundIds)
    };

    var json = JSON.stringify(output, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'manifest-diff-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
    _toast('Manifest diff exported');
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
