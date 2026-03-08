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

  // Audio preview
  var _audioCtx = null;
  var _previewSource = null;
  var _previewBuffer = null;
  var _isPlaying = false;

  // Active context tab inside Assign panel
  var _activeCtx = 'asset';

  // ---- Constants ----
  var MANIFEST_URL = '/audio/audio-manifest.json';
  var UPLOAD_API   = '/api/audio/upload';
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
    _loadManifest();
  }

  // ---- Manifest Loading ----

  function _loadManifest() {
    fetch(MANIFEST_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('Manifest fetch failed: ' + res.status);
        return res.json();
      })
      .then(function (data) {
        _manifest = data;
        _renderLibrary();
        _toast('Manifest loaded — ' + Object.keys(data).filter(function (k) { return k !== '_meta'; }).length + ' sounds');
      })
      .catch(function (err) {
        console.error('[SoundDesigner] manifest load error:', err);
        _toast('Failed to load manifest', true);
      });
  }

  // ---- Library Rendering ----

  function _renderLibrary(filter) {
    var container = document.getElementById('library-categories');
    if (!container || !_manifest) return;
    container.innerHTML = '';

    var categories = (_manifest._meta && _manifest._meta.categories) || [];
    var grouped = {};
    categories.forEach(function (cat) { grouped[cat] = []; });

    Object.keys(_manifest).forEach(function (key) {
      if (key === '_meta') return;
      var entry = _manifest[key];
      var cat = entry.category || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      if (filter) {
        var q = filter.toLowerCase();
        if (key.indexOf(q) === -1 && (entry.title || '').toLowerCase().indexOf(q) === -1) return;
      }
      grouped[cat].push({ id: key, entry: entry });
    });

    categories.forEach(function (cat) {
      var items = grouped[cat];
      if (!items || items.length === 0) return;

      var section = document.createElement('div');
      section.className = 'category-section';

      var header = document.createElement('div');
      header.className = 'category-header';
      header.innerHTML = '<span>' + _catEmoji(cat) + ' ' + cat.toUpperCase() + '</span>' +
                         '<span class="count">' + items.length + '</span>' +
                         '<span class="chevron">▾</span>';

      var list = document.createElement('div');
      list.className = 'category-items';

      items.forEach(function (item) {
        var btn = document.createElement('button');
        btn.className = 'sound-item' + (item.id === _selectedSoundId ? ' selected' : '');
        btn.dataset.soundId = item.id;
        btn.innerHTML = '<span class="mini-play">♪</span> ' + _displayName(item.id, item.entry);
        btn.addEventListener('click', function () { _selectSound(item.id); });
        list.appendChild(btn);
      });

      header.addEventListener('click', function () {
        header.classList.toggle('collapsed');
        list.classList.toggle('collapsed');
      });

      section.appendChild(header);
      section.appendChild(list);
      container.appendChild(section);
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

  function _selectSound(id) {
    _selectedSoundId = id;

    // Update library highlights
    document.querySelectorAll('.sound-item').forEach(function (el) {
      el.classList.toggle('selected', el.dataset.soundId === id);
    });

    var entry = _manifest[id];
    if (!entry) return;

    // Update preview panel
    document.getElementById('preview-name').textContent = _displayName(id, entry);
    document.getElementById('preview-meta').textContent =
      'Category: ' + entry.category + '  |  Key: ' + id + '  |  ' + (entry.src || '');
    document.getElementById('preview-play-btn').disabled = false;
    document.getElementById('waveform-placeholder').style.display = 'none';

    // Update inspector
    _updateInspector(id, entry);

    // Load audio buffer for preview
    _loadPreviewBuffer(entry.src);

    // Update assignment grid values
    _refreshAssignmentSlots();
  }

  // ---- Audio Preview ----

  function _ensureAudioCtx() {
    if (!_audioCtx) {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
  }

  function _loadPreviewBuffer(src) {
    if (!src) return;
    _ensureAudioCtx();

    fetch(src)
      .then(function (r) { return r.arrayBuffer(); })
      .then(function (buf) { return _audioCtx.decodeAudioData(buf); })
      .then(function (decoded) {
        _previewBuffer = decoded;
        _drawWaveform(decoded);
      })
      .catch(function (err) {
        console.warn('[SoundDesigner] buffer load fail:', err);
        _previewBuffer = null;
      });
  }

  function _drawWaveform(buffer) {
    var canvas = document.getElementById('waveform-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.parentElement.clientWidth;
    var h = canvas.parentElement.clientHeight;
    canvas.width = w;
    canvas.height = h;

    var data = buffer.getChannelData(0);
    var step = Math.ceil(data.length / w);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#33ff33';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);

    for (var i = 0; i < w; i++) {
      var idx = i * step;
      var min = 1, max = -1;
      for (var j = 0; j < step && idx + j < data.length; j++) {
        var v = data[idx + j];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      var yMin = ((1 + min) / 2) * h;
      var yMax = ((1 + max) / 2) * h;
      ctx.moveTo(i, yMin);
      ctx.lineTo(i, yMax);
    }
    ctx.stroke();
  }

  function _togglePreview() {
    if (_isPlaying) {
      _stopPreview();
    } else {
      _playPreview();
    }
  }

  function _playPreview() {
    if (!_previewBuffer || !_audioCtx) return;
    _stopPreview();

    var vol = parseInt(document.getElementById('preview-volume').value, 10) / 100;
    var gain = _audioCtx.createGain();
    gain.gain.value = vol;
    gain.connect(_audioCtx.destination);

    _previewSource = _audioCtx.createBufferSource();
    _previewSource.buffer = _previewBuffer;
    _previewSource.connect(gain);
    _previewSource.onended = function () {
      _isPlaying = false;
      document.getElementById('preview-play-btn').textContent = '▶';
    };
    _previewSource.start(0);
    _isPlaying = true;
    document.getElementById('preview-play-btn').textContent = '⏸';
  }

  function _stopPreview() {
    if (_previewSource) {
      try { _previewSource.stop(); } catch (e) {}
      _previewSource = null;
    }
    _isPlaying = false;
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
        _renderLibrary(input.value.trim());
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

    if (refreshBtn) refreshBtn.addEventListener('click', _loadManifest);

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
