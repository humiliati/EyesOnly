/* UI Controls - Button handlers and inventory management */
(function () {
  'use strict';

  // Inventory state
  var inventoryItems = [
    { emoji: '🔑', name: 'Encrypted Key', description: 'A cryptographic key used for secure communications' },
    { emoji: '📡', name: 'Signal Jammer', description: 'Portable device for blocking radio frequencies' },
    { emoji: '🎯', name: 'Target Marker', description: 'GPS coordinates for mission objective' },
    { emoji: '💾', name: 'Data Disc', description: 'Contains classified intelligence reports' },
    { emoji: '🔦', name: 'Night Vision', description: 'Enhanced visibility in low-light conditions' },
    { emoji: '📷', name: 'Surveillance Cam', description: 'Compact camera for field reconnaissance' },
    { emoji: '🎙️', name: 'Wire Tap', description: 'Audio recording device for covert operations' },
    { emoji: '🧭', name: 'Navigation Unit', description: 'Tactical GPS with terrain mapping' },
    { emoji: '📻', name: 'Radio Transceiver', description: 'Secure communication device' }
  ];

  var inventoryVisible = false;
  var selectedItemIndex = -1;

  function init() {
    // Wire up control buttons
    var buttons = document.querySelectorAll('.control-buttons button');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', handleButtonClick);
    });

    // Initialize inventory grid
    populateInventory();
  }

  function handleButtonClick(e) {
    var action = e.target.getAttribute('data-action');

    switch (action) {
      case 'help':
        printToTerminal([
          '',
          'AVAILABLE COMMANDS:',
          '/help - Display this help message',
          'back - Return to previous screen',
          'map - Display mission map',
          'login - Access authentication portal',
          'contact - Contact information',
          'faq - Frequently asked questions',
          'inventory - Toggle inventory display',
          ''
        ]);
        break;

      case 'back':
        printToTerminal([
          '',
          'BACK COMMAND EXECUTED',
          'Returning to previous context...',
          ''
        ]);
        break;

      case 'map':
        printToTerminal([
          '',
          'MAP SYSTEM ACCESS',
          'Loading tactical map overlay...',
          'Coordinates: 48.2771° N, 116.5533° W',
          'Sandpoint, Idaho - Field Station Alpha',
          ''
        ]);
        break;

      case 'login':
        printToTerminal([
          '',
          'AUTHENTICATION PORTAL',
          'Please enter credentials...',
          'AUTH CODE: _____________',
          ''
        ]);
        break;

      case 'contact':
        printToTerminal([
          '',
          'CONTACT INFORMATION',
          'Field Operations: [REDACTED]',
          'Emergency Line: [REDACTED]',
          'Secure Relay: MOK-LINK-ALPHA',
          ''
        ]);
        break;

      case 'faq':
        printToTerminal([
          '',
          'FREQUENTLY ASKED QUESTIONS',
          '',
          'Q: What is MOK?',
          'A: MOK is your Mission Operations Kernel - an AI advisory system.',
          '',
          'Q: How do I access missions?',
          'A: Use the LOGIN command with your assigned authentication code.',
          '',
          'Q: What is the accountability indicator?',
          'A: Real-time status of your secure connection to M console.',
          ''
        ]);
        break;

      case 'inventory':
        toggleInventory();
        break;
    }
  }

  function printToTerminal(lines) {
    if (typeof Terminal !== 'undefined') {
      Terminal.typeLines(lines, Terminal.TYPE_SPEED_FAST, 80, 'system-msg');
    }
  }

  function toggleInventory() {
    inventoryVisible = !inventoryVisible;
    var terminal = document.querySelector('.log-frame');
    var inventoryGrid = document.getElementById('inventory-grid');

    if (inventoryVisible) {
      terminal.style.display = 'none';
      inventoryGrid.style.display = 'flex';
      updateMokInterjection('Inventory display active. Select item for details.');
    } else {
      terminal.style.display = 'flex';
      inventoryGrid.style.display = 'none';
      updateMokInterjection('Standing by for advisories.');
      selectedItemIndex = -1;
    }
  }

  function populateInventory() {
    var container = document.getElementById('inventory-items');
    if (!container) return;

    // Clear existing
    container.innerHTML = '';

    // Add inventory items
    inventoryItems.forEach(function (item, index) {
      var itemEl = document.createElement('button');
      itemEl.className = 'inventory-item';
      itemEl.textContent = item.emoji;
      itemEl.setAttribute('data-index', index);
      itemEl.setAttribute('type', 'button');
      itemEl.setAttribute('aria-label', item.name);
      itemEl.addEventListener('click', function () {
        selectInventoryItem(index);
      });
      container.appendChild(itemEl);
    });

    // Add empty slots to fill grid (up to 12 total)
    var emptySlots = Math.max(0, 12 - inventoryItems.length);
    for (var i = 0; i < emptySlots; i++) {
      var emptyEl = document.createElement('div');
      emptyEl.className = 'inventory-item inventory-item-empty';
      emptyEl.textContent = '·';
      container.appendChild(emptyEl);
    }
  }

  function selectInventoryItem(index) {
    // Remove previous selection
    var items = document.querySelectorAll('.inventory-item');
    items.forEach(function (item) {
      item.classList.remove('selected');
    });

    // Select new item
    selectedItemIndex = index;
    items[index].classList.add('selected');

    // Display item details in MOK interjection field
    var item = inventoryItems[index];
    updateMokInterjection('ITEM: ' + item.name + ' — ' + item.description);
  }

  function updateMokInterjection(text) {
    var interjection = document.getElementById('mok-interject-body');
    if (interjection) {
      interjection.textContent = text;
    }
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
