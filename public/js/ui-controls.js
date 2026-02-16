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
        // Exit inventory if active
        if (inventoryVisible) {
          toggleInventory();
          printToTerminal([
            '',
            'EXITING INVENTORY',
            'Returning to terminal...',
            ''
          ]);
        }
        // Exit street mode if active
        else if (typeof StreetChronicles !== 'undefined' && StreetChronicles.isActive()) {
          // Process 'exit' command through StreetChronicles
          var result = StreetChronicles.process('exit');
          if (result && result.lines) {
            printToTerminal(result.lines);
          }
        }
        // Exit login shell if active
        else if (typeof LoginShell !== 'undefined' && LoginShell.isActive()) {
          var result = LoginShell.process('exit');
          if (result && result.lines) {
            printToTerminal(result.lines);
          }
        }
        // Otherwise just show feedback
        else {
          printToTerminal([
            '',
            'BACK COMMAND EXECUTED',
            'Already at main terminal',
            ''
          ]);
        }
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
        // Exit inventory if active first
        if (inventoryVisible) {
          toggleInventory();
        }

        // Start login shell if available
        if (typeof LoginShell !== 'undefined' && typeof LoginShell.start === 'function') {
          var result = LoginShell.start();
          if (result && result.lines) {
            printToTerminal(result.lines);
          }
        } else {
          // Fallback message if LoginShell not available
          printToTerminal([
            '',
            'AUTHENTICATION PORTAL',
            'Please enter credentials...',
            'AUTH CODE: _____________',
            ''
          ]);
        }
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
          '————————————————————————————————',
          '',
          'Q: WHAT IS THIS?',
          'A: CLASSIFIED.',
          '',
          'Q: NO REALLY, WHAT IS THIS?',
          'A: A RECRUITMENT TERMINAL FOR',
          '   SANDPOINT FIELD OPERATIONS.',
          '   TYPE CLEARANCE TO BEGIN.',
          '',
          'Q: IS THIS A GAME?',
          'A: THAT DEPENDS ON YOUR',
          '   CLEARANCE LEVEL.',
          '',
          'Q: DO I NEED TO GO SOMEWHERE?',
          'A: SANDPOINT, IDAHO.',
          '   THE REST IS NEED-TO-KNOW.',
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
