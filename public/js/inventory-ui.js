/**
 * Inventory UI - Collectible Gallery
 * Fetches player inventory and renders collectible cards in a grid layout.
 */
(function() {
  'use strict';

  var itemRegistry = {};
  var registryLoaded = false;
  var galleryContainer = null;

  // Load the arg_items.json registry
  function loadRegistry() {
    return fetch('/data/arg_items.json')
      .then(function(res) { return res.json(); })
      .then(function(data) {
        itemRegistry = data;
        registryLoaded = true;
      })
      .catch(function(err) {
        console.error('Failed to load item registry:', err);
      });
  }

  // Fetch the user's inventory
  function fetchInventory() {
    if (!window.ApiClient || !window.ApiClient.getToken) {
      return Promise.reject(new Error('API Client not available'));
    }
    
    var token = window.ApiClient.getToken() || localStorage.getItem('eyesonly_token');
    if (!token) return Promise.reject(new Error('Not logged in'));

    return fetch('/api/user/inventory', {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    })
    .then(function(res) {
      if (!res.ok) throw new Error('Failed to fetch inventory');
      return res.json();
    })
    .then(function(data) {
      return data.inventory || [];
    });
  }

  // Determine rarity from item def or fallback
  function getRarityInfo(itemDef) {
    if (itemDef && itemDef.rarity && itemDef.rarity.tier) {
      return itemDef.rarity.tier;
    }
    return 'common'; // Default fallback
  }

  // Render a single collectible card
  function renderCard(inventoryRow) {
    var itemId = inventoryRow.item_id;
    var itemDef = itemRegistry[itemId] || {};
    
    // Enrich data
    var name = itemDef.name || itemId;
    var emoji = (itemDef.visual && itemDef.visual.emoji) ? itemDef.visual.emoji : (itemDef.emoji || '📦');
    var desc = itemDef.description || itemDef.spend_effect || itemDef.notes || 'An unknown artifact.';
    var rarity = getRarityInfo(itemDef);
    var dateStr = inventoryRow.acquired_at ? new Date(inventoryRow.acquired_at).toLocaleDateString() : 'Unknown';

    var card = document.createElement('div');
    card.className = 'collectible-card rarity-' + rarity;
    
    card.innerHTML = [
      '<div class="collectible-emoji">' + emoji + '</div>',
      '<div class="collectible-badge">' + rarity + '</div>',
      '<div class="collectible-name">' + name + '</div>',
      '<div class="collectible-desc" title="' + desc + '">' + desc + '</div>',
      '<div class="collectible-acquired">' + dateStr + '</div>'
    ].join('');
    
    return card;
  }

  // Render the whole gallery
  function renderGallery() {
    var grid = document.getElementById('inventory-grid');
    if (!grid) return;

    // We'll replace the normal items container with our gallery or add it if not present
    var itemsContainer = document.getElementById('inventory-items');
    if (itemsContainer) {
      // Hide old container
      itemsContainer.style.display = 'none';
    }

    if (!galleryContainer) {
      galleryContainer = document.createElement('div');
      galleryContainer.className = 'collectible-gallery';
      grid.appendChild(galleryContainer);
    }
    
    galleryContainer.style.display = 'flex';
    galleryContainer.innerHTML = '<div style="color:#aaa;font-family:monospace;width:100%;text-align:center;padding:20px;">Fetching inventory...</div>';

    var promises = [];
    if (!registryLoaded) promises.push(loadRegistry());

    Promise.all(promises).then(function() {
      return fetchInventory();
    })
    .then(function(inventory) {
      galleryContainer.innerHTML = '';
      
      if (inventory.length === 0) {
        galleryContainer.innerHTML = '<div style="color:#aaa;font-family:monospace;width:100%;text-align:center;padding:20px;">No items found in your vault.</div>';
        return;
      }
      
      // Filter or sort? Let's just show all for now
      inventory.forEach(function(row) {
        // Expand by quantity
        var qty = Math.max(1, row.quantity || 1);
        for (var i = 0; i < qty; i++) {
          var card = renderCard(row);
          galleryContainer.appendChild(card);
        }
      });
    })
    .catch(function(err) {
      console.error(err);
      galleryContainer.innerHTML = '<div style="color:#f55;font-family:monospace;width:100%;text-align:center;padding:20px;">Error loading inventory. ' + (err.message || '') + '</div>';
    });
  }
  
  function createToastContainer() {
    var toast = document.createElement('div');
    toast.id = 'item-grant-toast';
    toast.innerHTML = [
      '<div class="toast-icon">🎁</div>',
      '<div class="toast-content">',
        '<div class="toast-title">Item Received</div>',
        '<div class="toast-item-name" id="toast-item-name">Item Name</div>',
      '</div>'
    ].join('');
    document.body.appendChild(toast);
    return toast;
  }

  function showGrantToast(itemData) {
    if (!registryLoaded) {
      loadRegistry().then(function() { showGrantToast(itemData); });
      return;
    }
    
    var itemId = itemData.item_id || itemData;
    var itemDef = itemRegistry[itemId] || { name: itemId, emoji: '📦' };
    var emoji = (itemDef.visual && itemDef.visual.emoji) ? itemDef.visual.emoji : (itemDef.emoji || '📦');
    var name = itemDef.name || itemId;
    var rarity = getRarityInfo(itemDef);
    
    var toast = document.getElementById('item-grant-toast');
    if (!toast) toast = createToastContainer();
    
    var iconEl = toast.querySelector('.toast-icon');
    var nameEl = toast.querySelector('.toast-item-name');
    var titleEl = toast.querySelector('.toast-title');
    
    iconEl.textContent = emoji;
    nameEl.textContent = name;
    
    // Set border color based on rarity
    toast.className = 'rarity-' + rarity; // clear previous classes
    setTimeout(function() { toast.classList.add('show'); }, 10);
    
    // Hide after 5 seconds
    setTimeout(function() {
      toast.classList.remove('show');
    }, 5000);
  }
  
  function init() {
    // Override toggleInventory if UIControls exists
    if (typeof window.UIControls !== 'undefined') {
      var originalToggle = window.UIControls.showInventory;
      // We need to inject into the logic
      
      // Let's monkeypatch the click handler or just hook into display
      var observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          if (mutation.attributeName === 'style') {
            var grid = document.getElementById('inventory-grid');
            if (grid && grid.style.display !== 'none') {
              // It became visible
              renderGallery();
            }
          }
        });
      });
      
      var grid = document.getElementById('inventory-grid');
      if (grid) {
        observer.observe(grid, { attributes: true });
      }
    }

    // Set up WebSocket listener for 'inventory_granted'
    if (typeof window !== 'undefined') {
      window.addEventListener('websocket-message', function(e) {
        if (e.detail && e.detail.type === 'inventory_granted') {
          showGrantToast(e.detail.payload || e.detail);
          // If gallery is open, refresh it
          var grid = document.getElementById('inventory-grid');
          if (grid && grid.style.display !== 'none') {
            renderGallery();
          }
        }
      });
    }
  }

  // Init after load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export
  window.InventoryUI = {
    renderGallery: renderGallery,
    showGrantToast: showGrantToast
  };

})();
