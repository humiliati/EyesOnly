/* ============================================================
   ARCADE VENDOR — Ice Cream Truck Prize Exchange
   /games page vendor: currency → items + gamble cards

   Stock is seeded from /data/gone-rogue/items.json at runtime.
   Buyback slot rotates on a 24-hour schedule (date-seeded PRNG)
   with day/night availability windows.
   ============================================================ */

var ArcadeVendor = (function() {
  'use strict';

  // ── items.json registry (populated by _loadItemsRegistry) ──
  var _itemsRegistry = [];   // full items.json array
  var _registryReady = false;
  var _pendingInit = false;

  // ── Catalog & pools (populated from registry after load) ──
  var FIXED_CATALOG = [];    // 3 always-available platform items
  var BUYBACK_POOL = [];     // items tagged _vendorPool:"buyback"
  var GAMBLE_ITEMS = {};     // keyed by _gambleTier → [{item, weight}]

  // Fixed catalog IDs — these are always stocked
  var FIXED_IDS = ['ITM-200', 'ITM-202', 'ITM-203'];

  // Price table (override per-item; items.json doesn't carry prices)
  var PRICE_TABLE = {
    'ITM-200': 80,   'ITM-202': 120,  'ITM-203': 200,
    'ITM-204': 150,  'ITM-205': 90,   'ITM-206': 180
  };

  // Color palette for the purchasing flex bars
  var COLOR_TABLE = {
    'ITM-200': '#264653', 'ITM-202': '#2a9d8f', 'ITM-203': '#e9c46a',
    'ITM-204': '#f4a261', 'ITM-205': '#e76f51', 'ITM-206': '#457b9d'
  };

  // Gamble carousel layout (order / pricing / css class)
  var GAMBLE_TIERS = [
    { type: 'standard', label: 'STDRD', icon: '💰', price: 60,  cssClass: 'vendor-gamble-standard' },
    { type: 'standard', label: 'STDRD', icon: '💰', price: 60,  cssClass: 'vendor-gamble-standard' },
    { type: 'cursed',   label: 'CRSD',  icon: '🎴', price: 150, cssClass: 'vendor-gamble-cursed' },
    { type: 'standard', label: 'STDRD', icon: '💰', price: 80,  cssClass: 'vendor-gamble-standard' },
    { type: 'binary',   label: 'BNRY',  icon: '⚡', price: 250, cssClass: 'vendor-gamble-binary' },
    { type: 'empty',    label: 'EMPT',  icon: '❓', price: 40,  cssClass: 'vendor-gamble-empty' },
    { type: 'standard', label: 'STDRD', icon: '💰', price: 70,  cssClass: 'vendor-gamble-standard' },
    { type: 'cursed',   label: 'CRSD',  icon: '🎴', price: 120, cssClass: 'vendor-gamble-cursed' }
  ];

  // ── Date-seeded PRNG for deterministic 24h rotation ──
  function _dateSeed() {
    var d = new Date();
    // Seed = YYYYMMDD as integer → same pick all day, rotates at midnight
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  function _seededRandom(seed) {
    // Simple mulberry32 PRNG
    var t = (seed + 0x6D2B79F5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function _isDaytime() {
    var h = new Date().getHours();
    return h >= 6 && h < 20; // 6 AM – 8 PM
  }

  // ── Load items.json and build vendor pools ──
  function _loadItemsRegistry(callback) {
    if (_registryReady) { callback(); return; }

    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/data/gone-rogue/items.json?v=' + _dateSeed(), true);
    xhr.onload = function() {
      if (xhr.status === 200) {
        try {
          _itemsRegistry = JSON.parse(xhr.responseText);
        } catch (e) {
          console.warn('[ArcadeVendor] Failed to parse items.json:', e);
          _itemsRegistry = [];
        }
      }
      _buildPools();
      _registryReady = true;
      callback();
    };
    xhr.onerror = function() {
      console.warn('[ArcadeVendor] Failed to fetch items.json');
      _buildFallbackPools();
      _registryReady = true;
      callback();
    };
    xhr.send();
  }

  function _itemToVendorEntry(item) {
    return {
      id: item.id,
      name: item.name,
      emoji: item.emoji,
      price: PRICE_TABLE[item.id] || 100,
      color: COLOR_TABLE[item.id] || '#556677',
      description: item.description || '',
      availability: item._vendorAvailability || 'always',
      meta: {
        emoji: item.emoji,
        name: item.name,
        type: item.type || 'equipment'
      }
    };
  }

  function _buildPools() {
    var byId = {};
    _itemsRegistry.forEach(function(item) { byId[item.id] = item; });

    // Fixed catalog from known IDs
    FIXED_CATALOG = [];
    FIXED_IDS.forEach(function(id) {
      if (byId[id]) FIXED_CATALOG.push(_itemToVendorEntry(byId[id]));
    });

    // Buyback pool: items tagged _vendorPool:"buyback"
    BUYBACK_POOL = [];
    _itemsRegistry.forEach(function(item) {
      if (item._vendorPool === 'buyback') {
        BUYBACK_POOL.push(_itemToVendorEntry(item));
      }
    });
    // Fallback: include ITM-204 (Smart Watch) if no buyback tagged items found
    if (BUYBACK_POOL.length === 0 && byId['ITM-204']) {
      BUYBACK_POOL.push(_itemToVendorEntry(byId['ITM-204']));
    }

    // Gamble pools: items tagged _vendorPool:"gamble"
    GAMBLE_ITEMS = { standard: [], cursed: [], binary: [], empty: [] };
    _itemsRegistry.forEach(function(item) {
      if (item._vendorPool !== 'gamble') return;
      var tiers = Array.isArray(item._gambleTier) ? item._gambleTier : [item._gambleTier || 'standard'];
      var weight = item._gambleWeight || 10;
      var entry = {
        id: item.id, name: item.name, emoji: item.emoji,
        meta: { emoji: item.emoji, name: item.name, type: item.type || 'equipment' }
      };
      tiers.forEach(function(tier) {
        if (GAMBLE_ITEMS[tier]) {
          GAMBLE_ITEMS[tier].push({ item: entry, weight: weight });
        }
      });
    });
    // Empty tier always has a "nothing" result
    if (!GAMBLE_ITEMS.empty.length) {
      GAMBLE_ITEMS.empty.push({ item: null, weight: 75 });
    }
  }

  function _buildFallbackPools() {
    // Hardcoded fallback if items.json fails to load
    FIXED_CATALOG = [
      { id: 'ITM-200', name: 'Magnifying Glass', emoji: '🔍', price: 80, color: '#264653', description: 'Reveals hidden porthole zones', meta: { emoji: '🔍', name: 'Magnifying Glass', type: 'equipment' } },
      { id: 'ITM-202', name: 'Decoder Ring', emoji: '💍', price: 120, color: '#2a9d8f', description: 'Activates cipher puzzles', meta: { emoji: '💍', name: 'Decoder Ring', type: 'equipment' } },
      { id: 'ITM-203', name: 'Baseplate Compass', emoji: '🧭', price: 200, color: '#e9c46a', description: 'Orientation overlay', meta: { emoji: '🧭', name: 'Baseplate Compass', type: 'rare' } }
    ];
    BUYBACK_POOL = [
      { id: 'ITM-204', name: 'Smart Watch', emoji: '⌚', price: 150, color: '#f4a261', description: 'Debrief feed on your wrist', availability: 'always', meta: { emoji: '⌚', name: 'Smart Watch', type: 'equipment' } }
    ];
    GAMBLE_ITEMS = {
      standard: [
        { item: { id: 'ITM-300', name: 'Lucky Penny', emoji: '🪙', meta: { emoji: '🪙', name: 'Lucky Penny', type: 'charm' } }, weight: 70 },
        { item: { id: 'ITM-302', name: 'Lock Pick', emoji: '🔓', meta: { emoji: '🔓', name: 'Lock Pick', type: 'equipment' } }, weight: 22 }
      ],
      cursed: [
        { item: { id: 'ITM-304', name: 'Cracked Lens', emoji: '🔮', meta: { emoji: '🔮', name: 'Cracked Lens', type: 'equipment' } }, weight: 40 },
        { item: { id: 'ITM-305', name: 'Black Candle', emoji: '🕯️', meta: { emoji: '🕯️', name: 'Black Candle', type: 'consumable' } }, weight: 35 }
      ],
      binary: [
        { item: { id: 'ITM-303', name: 'Obsidian Key', emoji: '🗝️', meta: { emoji: '🗝️', name: 'Obsidian Key', type: 'key' } }, weight: 50 },
        { item: { id: 'ITM-306', name: 'Handful of Dust', emoji: '💨', meta: { emoji: '💨', name: 'Handful of Dust', type: 'junk' } }, weight: 50 }
      ],
      empty: [{ item: null, weight: 75 }]
    };
  }

  // ── Gamble result pools (built dynamically from GAMBLE_ITEMS) ──
  // Replaces the old static GAMBLE_RESULTS

  // ── State ──
  var _overlayEl = null;
  var _modalEl = null;
  var _balanceEl = null;
  var _headerBalanceEl = null;
  var _activeTab = 'prizes';
  var _purchasedIds = {};  // track what's been bought this session
  var _buybackItem = null;
  var _dragState = null;   // { ghost, item, startX, startY, moved }

  // ── Helpers ──

  var _GAMESTATE_KEY = 'eyesonly_gamestate';

  function _getCryptos() {
    // Prefer live GAMESTATE if loaded (terminal / gone-rogue context)
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getState === 'function') {
      return GAMESTATE.getState().cryptos || 0;
    }
    // On /games page: read directly from the shared localStorage save
    try {
      var saved = JSON.parse(localStorage.getItem(_GAMESTATE_KEY) || '{}');
      return saved.cryptos || 0;
    } catch(e) { return 0; }
  }

  function _spendCryptos(amount) {
    // Prefer live GAMESTATE if loaded
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.addCryptos === 'function') {
      GAMESTATE.addCryptos(-amount);
      return true;
    }
    // On /games page: read-modify-write the shared localStorage save
    try {
      var saved = JSON.parse(localStorage.getItem(_GAMESTATE_KEY) || '{}');
      saved.cryptos = Math.max(0, (saved.cryptos || 0) - amount);
      localStorage.setItem(_GAMESTATE_KEY, JSON.stringify(saved));
      return true;
    } catch(e) { return false; }
  }

  function _pickBuyback() {
    // Date-seeded deterministic rotation: same pick all day, changes at midnight
    // Filters by day/night availability window
    var daytime = _isDaytime();
    var candidates = BUYBACK_POOL.filter(function(item) {
      if (item.availability === 'day' && !daytime) return false;
      if (item.availability === 'night' && daytime) return false;
      return true;
    });
    // Fallback: if no candidates match the time window, use full pool
    if (candidates.length === 0) candidates = BUYBACK_POOL.slice();

    // Further prioritize items the player doesn't own
    var unowned = candidates.filter(function(item) {
      return typeof AccountInventory !== 'undefined' && !AccountInventory.hasItem(item.id);
    });
    if (unowned.length > 0) candidates = unowned;

    // Date-seeded pick: deterministic for the calendar day
    var seed = _dateSeed();
    var pick = Math.floor(_seededRandom(seed) * candidates.length);
    _buybackItem = candidates[pick];
  }

  function _rollGamble(type) {
    var pool = GAMBLE_ITEMS[type];
    if (!pool || pool.length === 0) return null;

    var totalWeight = 0;
    pool.forEach(function(entry) { totalWeight += entry.weight; });

    var roll = Math.random() * totalWeight;
    var cumulative = 0;
    for (var i = 0; i < pool.length; i++) {
      cumulative += pool[i].weight;
      if (roll < cumulative) {
        return pool[i].item; // may be null (empty tier)
      }
    }
    return null;
  }

  function _updateBalance() {
    var bal = _getCryptos();
    if (_balanceEl) _balanceEl.textContent = '¢' + bal;
    if (_headerBalanceEl) _headerBalanceEl.textContent = '¢' + bal;

    // Update affordability states
    var prizes = document.querySelectorAll('.vendor-prize[data-price]');
    prizes.forEach(function(el) {
      var price = parseInt(el.dataset.price, 10);
      el.classList.toggle('vendor-cant-afford', bal < price);
    });
  }

  function _addItemToInventory(item) {
    if (typeof AccountInventory !== 'undefined') {
      // Check if already owned
      if (AccountInventory.hasItem(item.id)) {
        // Stack qty
        AccountInventory.addItem({ id: item.id, qty: 1, meta: item.meta });
      } else {
        AccountInventory.addItem({ id: item.id, qty: 1, meta: item.meta });
      }
    }
  }

  function _playSound(name) {
    if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
      AudioSystem.play(name, { volume: 0.4 });
    }
  }

  function _mokSpeak(msg) {
    if (typeof TooltipSystem !== 'undefined' && TooltipSystem.showPersistent) {
      TooltipSystem.showPersistent(msg, 2000);
    }
  }

  // ── Overlay Management ──

  function open() {
    _overlayEl = document.getElementById('vendor-overlay');
    if (!_overlayEl) return;

    _modalEl = _overlayEl.querySelector('.vendor-modal');
    _balanceEl = _overlayEl.querySelector('.vendor-balance');
    _headerBalanceEl = document.getElementById('vendor-row-balance');

    // Ensure registry is loaded before rendering
    _loadItemsRegistry(function() {
      _pickBuyback();
      _renderPrizes();
      _renderGamble();

      _overlayEl.classList.add('vendor-visible');
      _updateBalance();

      // Scroll games content to show inventory row
      _playSound('ui-04');
    });
  }

  function close() {
    if (_overlayEl) {
      _overlayEl.classList.remove('vendor-visible', 'vendor-minimized');
    }
    _playSound('ui-01');
  }

  function minimize() {
    if (_overlayEl) _overlayEl.classList.add('vendor-minimized');
  }

  function restore() {
    if (_overlayEl) _overlayEl.classList.remove('vendor-minimized');
  }

  // ── Tab Switching ──

  function _switchTab(tabName) {
    _activeTab = tabName;
    var tabs = document.querySelectorAll('.vendor-tab');
    var panels = document.querySelectorAll('.vendor-panel');

    tabs.forEach(function(t) {
      t.classList.toggle('vendor-tab-active', t.dataset.tab === tabName);
    });
    panels.forEach(function(p) {
      p.classList.toggle('vendor-panel-active', p.dataset.panel === tabName);
    });
  }

  // ── Render Purchasing Palette ──

  function _renderPrizes() {
    var container = document.getElementById('vendor-palette');
    if (!container) return;
    container.innerHTML = '';

    // 3 fixed items
    var catalog = FIXED_CATALOG.slice();

    // Mark owned items
    catalog.forEach(function(item) {
      item._owned = typeof AccountInventory !== 'undefined' && AccountInventory.hasItem(item.id);
    });

    // Add buyback slot
    if (_buybackItem) {
      var bb = Object.assign({}, _buybackItem);
      bb._isBuyback = true;
      bb._owned = typeof AccountInventory !== 'undefined' && AccountInventory.hasItem(bb.id);
      bb.price = Math.ceil(bb.price * 1.3); // 30% buyback markup
      catalog.push(bb);
    }

    catalog.forEach(function(item, idx) {
      var btn = document.createElement('button');
      btn.className = 'vendor-prize';
      if (item._isBuyback) btn.classList.add('vendor-buyback');
      if (item._owned) btn.classList.add('vendor-sold');
      if (_purchasedIds[item.id]) btn.classList.add('vendor-sold');
      btn.style.background = item.color;
      btn.dataset.price = item.price;
      btn.dataset.itemId = item.id;
      btn.dataset.index = idx;

      btn.innerHTML =
        '<span class="vendor-prize-emoji">' + item.emoji + '</span>' +
        '<span class="vendor-prize-name">' + item.name + '</span>' +
        '<span class="vendor-prize-price">¢' + item.price + '</span>';

      // Click to purchase
      btn.addEventListener('click', function(e) {
        _handlePurchase(item, btn);
      });

      // Touch drag for mobile
      _setupPrizeTouchDrag(btn, item);

      container.appendChild(btn);
    });
  }

  // ── Render Gamble Carousel ──

  function _renderGamble() {
    var carousel = document.getElementById('vendor-carousel');
    if (!carousel) return;
    carousel.innerHTML = '';

    GAMBLE_TIERS.forEach(function(tier, idx) {
      var card = document.createElement('div');
      card.className = 'vendor-gamble-card ' + tier.cssClass;
      card.dataset.type = tier.type;
      card.dataset.price = tier.price;
      card.dataset.index = idx;

      card.innerHTML =
        '<span class="vendor-gamble-card-price">¢' + tier.price + '</span>' +
        '<span class="vendor-gamble-card-icon">' + tier.icon + '</span>' +
        '<span class="vendor-gamble-card-label">' + tier.label + '</span>';

      card.addEventListener('click', function(e) {
        _handleGamble(tier, card);
      });

      carousel.appendChild(card);
    });
  }

  // ── Purchase Logic ──

  function _handlePurchase(item, btn) {
    var bal = _getCryptos();
    if (bal < item.price) {
      _mokSpeak('❌ INSUFFICIENT FUNDS — need ¢' + item.price);
      _playSound('ui-06');
      btn.classList.add('card-shake');
      setTimeout(function() { btn.classList.remove('card-shake'); }, 400);
      return;
    }

    if (item._owned || _purchasedIds[item.id]) {
      _mokSpeak('📦 Already in your inventory');
      return;
    }

    // Deduct and deliver
    _spendCryptos(item.price);
    _addItemToInventory(item);
    _purchasedIds[item.id] = true;

    // Visual feedback
    btn.classList.add('vendor-prize-purchased');
    _playSound('ui-04');
    _mokSpeak('🍦 Prize claimed: ' + item.emoji + ' ' + item.name + '!');

    setTimeout(function() {
      btn.classList.add('vendor-sold');
    }, 400);

    _updateBalance();

    // Refresh inventory display on /games if visible
    _refreshGamesInventory();
  }

  // ── Gamble Logic ──

  function _handleGamble(tier, cardEl) {
    var bal = _getCryptos();
    if (bal < tier.price) {
      _mokSpeak('❌ INSUFFICIENT FUNDS — need ¢' + tier.price);
      _playSound('ui-06');
      return;
    }

    // Deduct
    _spendCryptos(tier.price);
    _updateBalance();

    // Pause carousel, flash the card
    var carousel = document.getElementById('vendor-carousel');
    if (carousel) carousel.style.animationPlayState = 'paused';
    cardEl.classList.add('vendor-gamble-result');

    _playSound('ui-04');

    // Roll result after brief suspense
    setTimeout(function() {
      var result = _rollGamble(tier.type);

      if (result) {
        _addItemToInventory(result);
        _mokSpeak('🎰 You won: ' + result.emoji + ' ' + result.name + '!');
        _playSound('ui-07');
        _refreshGamesInventory();
      } else {
        _mokSpeak('🎰 Nothing... the machine clicks emptily.');
        _playSound('ui-01');
      }

      cardEl.classList.remove('vendor-gamble-result');

      // Resume carousel
      if (carousel) carousel.style.animationPlayState = '';
    }, 800);
  }

  // ── Touch Drag from Prize to Inventory ──

  function _setupPrizeTouchDrag(btn, item) {
    var touchState = null;

    btn.addEventListener('touchstart', function(e) {
      if (item._owned || _purchasedIds[item.id]) return;
      if (_getCryptos() < item.price) return;

      touchState = {
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        moved: false,
        ghost: null,
        item: item,
        btn: btn
      };
    }, { passive: true });

    btn.addEventListener('touchmove', function(e) {
      if (!touchState) return;
      var tx = e.touches[0].clientX;
      var ty = e.touches[0].clientY;

      if (!touchState.moved) {
        var dx = tx - touchState.startX;
        var dy = ty - touchState.startY;
        if (Math.sqrt(dx * dx + dy * dy) < 15) return;
        touchState.moved = true;

        // Create ghost
        var ghost = document.createElement('div');
        ghost.className = 'vendor-purchase-ghost';
        ghost.textContent = item.emoji;
        ghost.style.left = tx + 'px';
        ghost.style.top = ty + 'px';
        document.body.appendChild(ghost);
        touchState.ghost = ghost;

        // Minimize overlay to expose inventory
        minimize();

        // Expand inventory row
        _expandInventoryRow();
      }

      e.preventDefault();

      if (touchState.ghost) {
        touchState.ghost.style.left = tx + 'px';
        touchState.ghost.style.top = ty + 'px';
      }
    }, { passive: false });

    btn.addEventListener('touchend', function(e) {
      if (!touchState) return;
      var ts = touchState;
      touchState = null;

      if (ts.ghost) ts.ghost.remove();

      if (!ts.moved) return; // Was just a tap, let click handler deal with it

      // Check if released over an inventory slot
      var endX, endY;
      if (e.changedTouches && e.changedTouches.length) {
        endX = e.changedTouches[0].clientX;
        endY = e.changedTouches[0].clientY;
      } else {
        restore();
        return;
      }

      var target = document.elementFromPoint(endX, endY);
      var slot = target ? target.closest('.games-inv-slot') : null;

      if (slot && slot.querySelector('.games-inv-empty')) {
        // Valid drop on empty inventory slot — complete purchase
        _completeDragPurchase(ts.item, ts.btn, slot);
      }

      // Restore overlay
      setTimeout(restore, 300);
    }, { passive: true });

    btn.addEventListener('touchcancel', function() {
      if (touchState && touchState.ghost) touchState.ghost.remove();
      touchState = null;
      restore();
    }, { passive: true });
  }

  function _completeDragPurchase(item, btn, slot) {
    var bal = _getCryptos();
    if (bal < item.price) return;
    if (item._owned || _purchasedIds[item.id]) return;

    _spendCryptos(item.price);
    _addItemToInventory(item);
    _purchasedIds[item.id] = true;

    // Animate the target slot
    var inner = slot.querySelector('.games-inv-slot-inner');
    if (inner) {
      inner.className = 'games-inv-slot-inner games-inv-occupied';
      inner.innerHTML =
        '<span class="games-inv-item-icon">' + item.emoji + '</span>' +
        '<span class="games-inv-slot-label">' + (item.name || '').substring(0, 10).toUpperCase() + '</span>';
    }

    slot.setAttribute('data-item', item.id.toLowerCase());
    slot.setAttribute('data-item-id', item.id);

    _playSound('ui-04');
    _mokSpeak('🍦 Prize delivered to inventory: ' + item.emoji + ' ' + item.name);

    _updateBalance();
  }

  function _expandInventoryRow() {
    var body = document.getElementById('decryption-body');
    if (body && !body.classList.contains('games-row-body-open')) {
      body.classList.add('games-row-body-open');
      var header = document.querySelector('#row-decryption .games-row-header');
      if (header) header.setAttribute('aria-expanded', 'true');
      var chevron = document.querySelector('#row-decryption .games-row-chevron');
      if (chevron) chevron.innerHTML = '&#9662;';
    }

    // Scroll to inventory
    var scroll = document.getElementById('decryption-scroll');
    if (scroll) scroll.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function _refreshGamesInventory() {
    // Re-populate the /games inventory display from AccountInventory
    if (typeof AccountInventory === 'undefined') return;

    var grid = document.getElementById('decryption-inventory');
    if (!grid) return;

    var items = AccountInventory.getItems();
    var slots = grid.querySelectorAll('.games-inv-slot');

    var abbrev = (typeof SharedItemRenderer !== 'undefined' && SharedItemRenderer.abbreviateName)
      ? function(n) { return SharedItemRenderer.abbreviateName(n, 10).toUpperCase(); }
      : function(n) { return (n || '').substring(0, 10).toUpperCase(); };

    var ITEM_KEY_MAP = {
      'ITM-200': 'magnifying-glass',
      'ITM-201': 'cypher-note-2',
      'ITM-202': 'decoder-ring'
    };

    // Reset all slots to empty first
    slots.forEach(function(s, i) {
      var inner = s.querySelector('.games-inv-slot-inner');
      if (inner) {
        inner.className = 'games-inv-slot-inner games-inv-empty';
        inner.innerHTML =
          '<span class="games-inv-slot-num">' + String(i + 1).padStart(2, '0') + '</span>' +
          '<span class="games-inv-slot-label">EMPTY</span>';
      }
      s.removeAttribute('data-item');
      s.removeAttribute('data-item-id');
    });

    // Populate with current items
    items.forEach(function(item, idx) {
      if (idx >= slots.length) return;
      var slot = slots[idx];
      var emoji = (item.meta && item.meta.emoji) || '📦';
      var label = (item.meta && item.meta.name) || item.id;
      var itemKey = ITEM_KEY_MAP[item.id] || item.id.toLowerCase();

      slot.setAttribute('data-item', itemKey);
      slot.setAttribute('data-item-id', item.id);

      var inner = slot.querySelector('.games-inv-slot-inner');
      if (inner) {
        inner.className = 'games-inv-slot-inner games-inv-occupied';
        inner.innerHTML =
          '<span class="games-inv-item-icon">' + emoji + '</span>' +
          '<span class="games-inv-slot-label">' + abbrev(label) + '</span>';
      }
    });

    // Re-run slot visibility
    if (typeof manageSlotVisibility === 'function') manageSlotVisibility();
  }

  // ── Init ──

  function init() {
    // Set initial balance on the row badge
    var rowBal = document.getElementById('vendor-row-balance');
    if (rowBal) rowBal.textContent = '¢' + _getCryptos();

    // Wire tab switching
    document.addEventListener('click', function(e) {
      var tab = e.target.closest('.vendor-tab');
      if (tab && tab.dataset.tab) {
        _switchTab(tab.dataset.tab);
        return;
      }

      // Close on dim click
      if (e.target.classList.contains('vendor-dim')) {
        close();
        return;
      }

      // Close button
      if (e.target.closest('.vendor-close')) {
        close();
        return;
      }

      // Open from row header
      if (e.target.closest('#row-vendor .games-row-header')) {
        e.preventDefault();
        open();
        return;
      }
    });
  }

  // Public API
  return {
    init: init,
    open: open,
    close: close,
    minimize: minimize,
    restore: restore
  };
})();

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() { ArcadeVendor.init(); });
} else {
  ArcadeVendor.init();
}
