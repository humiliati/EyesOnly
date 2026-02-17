/* UI Controls - Button handlers and inventory management */
(function () {
  'use strict';

  // Inventory state
  // context: 'live' (red), 'street' (yellow), 'both' (green)
  var inventoryItems = [
    { emoji: '🔑', name: 'Encrypted Key', description: 'A cryptographic key used for secure communications', context: 'live' },
    { emoji: '📡', name: 'Signal Jammer', description: 'Portable device for blocking radio frequencies', context: 'live' },
    { emoji: '🎯', name: 'Target Marker', description: 'GPS coordinates for mission objective', context: 'live' },
    { emoji: '💾', name: 'Data Disc', description: 'Contains classified intelligence reports', context: 'both' },
    { emoji: '🔦', name: 'Night Vision', description: 'Enhanced visibility in low-light conditions', context: 'both' },
    { emoji: '📷', name: 'Surveillance Cam', description: 'Compact camera for field reconnaissance', context: 'live' },
    { emoji: '🎙️', name: 'Wire Tap', description: 'Audio recording device for covert operations', context: 'live' },
    { emoji: '🧭', name: 'Navigation Unit', description: 'Tactical GPS with terrain mapping', context: 'both' },
    { emoji: '📻', name: 'Radio Transceiver', description: 'Secure communication device', context: 'both' }
  ];

  var inventoryVisible = false;
  var selectedItemIndex = -1;
  var activeItem = null; // Currently active item in header slot

  function init() {
    // Wire up control buttons
    var buttons = document.querySelectorAll('.control-buttons button');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', handleButtonClick);
    });

    // Initialize inventory grid
    populateInventory();

    // Wire up active item slot click handler
    var activeSlot = document.getElementById('active-item-slot');
    if (activeSlot) {
      activeSlot.addEventListener('click', handleActiveItemClick);
    }
  }

  function handleButtonClick(e) {
    var action = e.target.getAttribute('data-action');
    var isInStreetChronicles = typeof StreetChronicles !== 'undefined' && StreetChronicles.isActive();
    var isInLoginShell = typeof LoginShell !== 'undefined' && LoginShell.isActive();

    switch (action) {
      case 'help':
        if (isInStreetChronicles) {
          // Street-Chronicles help
          simulateCommand('help');
        } else {
          // Command terminal help
          printToTerminal([
            '',
            'COMMAND TERMINAL HELP:',
            '————————————————————————————————',
            'clearance - Begin access protocol',
            'help - Display this help message',
            'missions - View mission briefings',
            'ops - Check operational status',
            'clear - Clear terminal screen',
            'home - Return to EYES ONLY title',
            '',
            'BUTTON CONTROLS:',
            '/help - Display help for current context',
            'back - Return to EYES ONLY home screen',
            'map - Open Street-Chronicles at last position',
            'login - Access authentication portal',
            'contact - Contact information',
            'faq - Frequently asked questions',
            'inventory - Toggle inventory display',
            ''
          ]);
        }
        break;

      case 'back':
        // Priority 1: Exit inventory if active
        if (inventoryVisible) {
          toggleInventory();
          // Don't print anything - just close inventory
          break;
        }
        // Priority 2: Check if in authorization/clearance sequence
        if (typeof StateMachine !== 'undefined') {
          var currentState = StateMachine.getState();
          if (currentState === 'AWAITING_DESIGNATION' || 
              currentState === 'AWAITING_PROCEED' || 
              currentState === 'AWAITING_TEMPORAL') {
            simulateCommand('back');
            break;
          }
        }
        // Priority 3: Exit login shell if in password prompt
        if (isInLoginShell && typeof LoginShell.getPrompt === 'function') {
          var prompt = LoginShell.getPrompt();
          if (prompt === 'PASS> ') {
            // In password entry - exit to main terminal
            simulateCommand('exit');
            break;
          }
        }
        // Priority 4: Exit Gone Rogue mode if active
        if (typeof GoneRogue !== 'undefined' && GoneRogue.isActive()) {
          simulateCommand('exit');
          break;
        }
        // Priority 5: Exit street-chronicles if active
        if (isInStreetChronicles) {
          simulateCommand('exit');
          break;
        }
        // Priority 6: Exit login shell if in session
        if (isInLoginShell) {
          simulateCommand('exit');
          break;
        }
        // Priority 7: Return to EYES ONLY home screen
        simulateCommand('home');
        break;

      case 'map':
        // Close inventory if open
        if (inventoryVisible) {
          toggleInventory();
        }

        if (isInStreetChronicles) {
          // Already in street-chronicles - recenter to main street
          if (typeof StreetChronicles !== 'undefined' && typeof StreetChronicles.process === 'function') {
            var currentLoc = getStreetChroniclesLocation();
            if (currentLoc !== 'Cedar St') {
              printToTerminal([
                '',
                'MAP RECENTER ACTIVATED',
                'Returning to Cedar St main node...',
                ''
              ]);
              // Move to Cedar St
              setStreetChroniclesLocation('Cedar St');
              simulateCommand('look');
            } else {
              printToTerminal([
                '',
                'ALREADY AT MAIN STREET NODE',
                'Position: Cedar St',
                ''
              ]);
            }
          }
        } else {
          // Not in street-chronicles - open it
          simulateCommand('map');
        }
        break;

      case 'login':
        // Close inventory if open
        if (inventoryVisible) {
          toggleInventory();
        }

        // Start login shell (doesn't exit street-chronicles)
        if (typeof LoginShell !== 'undefined' && typeof LoginShell.start === 'function') {
          var result = LoginShell.start();
          if (result && result.lines) {
            printToTerminal(result.lines);
          }
        } else {
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
        if (isInStreetChronicles) {
          // Street-Chronicles contact - MOK avatar with hints
          printToTerminal([
            '',
            'MOK AVATAR ACTIVATED',
            'Analyzing current position and inventory...',
            '',
            '[MOK]: "Citizen, I detect you are exploring street-level operations."',
            '[MOK]: "Hint: Look for interactive locations and items."',
            '[MOK]: "Try commands: LOOK, EXAMINE, TALK TO, TAKE"',
            '',
            'TODO: Full MOK integration with position-aware hints',
            ''
          ]);
        } else {
          // Command terminal contact - full contact info
          printToTerminal([
            '',
            'CONTACT INFORMATION',
            '————————————————————————————————',
            '',
            'MOK AVATAR: [ACTIVATED]',
            '[MOK]: "Standing by for ARPG recommendations."',
            '',
            'REAL WORLD CONTACT:',
            '  Email: admin@stellaraqua.com',
            '  Location: Sandpoint Chamber of Commerce',
            '  Booking: Call 1-850-SSTELLA',
            '',
            'Book your team now to play live!',
            ''
          ]);
        }
        break;

      case 'faq':
        if (isInStreetChronicles) {
          // Street-Chronicles FAQ - how to play text adventures
          printToTerminal([
            '',
            'STREET-CHRONICLES FAQ',
            '————————————————————————————————',
            '',
            'Q: HOW DO I PLAY THIS TEXT ADVENTURE?',
            'A: Use commands like LOOK, GO NORTH, EXAMINE,',
            '   TALK TO, and TAKE to explore and interact.',
            '',
            'Q: HOW DO I MOVE AROUND?',
            'A: Use GO NORTH/SOUTH/EAST/WEST or shortcuts',
            '   N/S/E/W to navigate streets.',
            '',
            'Q: HOW DO I INTERACT WITH OBJECTS?',
            'A: Use EXAMINE <object> to inspect things,',
            '   TALK TO <person> to speak with NPCs,',
            '   TAKE <item> to collect items.',
            '',
            'Q: HOW DO I EXIT?',
            'A: Type EXIT or click the BACK button.',
            '',
            'Q: WHAT IS THE GOAL?',
            'A: Explore Sandpoint, find clues, collect items,',
            '   and uncover the hidden story.',
            ''
          ]);
        } else {
          // Command terminal FAQ - platform description
          printToTerminal([
            '',
            'EYES ONLY - FREQUENTLY ASKED QUESTIONS',
            '————————————————————————————————————————',
            '',
            'Q: WHAT IS EYES ONLY?',
            'A: A platform for SPY vs SPY games set in',
            '   Sandpoint, Idaho. A blend of ARG, escape room,',
            '   and Cold War terminal aesthetics.',
            '',
            'Q: WHAT IS STREET-CHRONICLES?',
            'A: A text-based adventure mini-game where you',
            '   explore Sandpoint at street level, finding',
            '   clues and items for the larger mission.',
            '',
            'Q: DO I NEED TO BE IN SANDPOINT?',
            'A: For the full LIVE ARPG experience, yes.',
            '   Street-Chronicles can be played remotely.',
            '',
            'Q: HOW DO I GET STARTED?',
            'A: Type CLEARANCE to begin the access protocol.',
            '   Type MAP to enter Street-Chronicles.',
            '',
            'Q: WHO IS BEHIND THIS?',
            'A: STELLARAQUA / Sandpoint Field Operations',
            '   Contact: admin@stellaraqua.com',
            '',
            'TUTORIAL NOTES:',
            '- Use temporal keys for access (format: YYMMDD)',
            '- Explore commands with HELP in each context',
            '- Missions unlock based on field intelligence',
            '- Save your progress with LOGIN',
            ''
          ]);
        }
        break;

      case 'inventory':
        // Toggle inventory in any context
        toggleInventory();
        break;
    }
  }

  // Helper function to simulate command input
  function simulateCommand(cmd) {
    if (typeof Terminal !== 'undefined' && typeof Terminal.onCommand === 'function') {
      // Hide input, trigger command through the main handler
      Terminal.hideInput();
      // Write the command line to terminal
      var prompt = '> ';
      if (typeof StreetChronicles !== 'undefined' && StreetChronicles.isActive()) {
        prompt = StreetChronicles.getPrompt();
      } else if (typeof LoginShell !== 'undefined' && LoginShell.isActive() && typeof LoginShell.getPrompt === 'function') {
        prompt = LoginShell.getPrompt();
      }
      Terminal.writeLine(prompt + cmd);
      // Use a small timeout to ensure the command is processed after the line is written
      setTimeout(function() {
        // Get the command callback
        if (window._mainCommandHandler) {
          window._mainCommandHandler(cmd);
        }
      }, 50);
    }
  }

  // Helper to get street-chronicles location
  function getStreetChroniclesLocation() {
    try {
      var raw = localStorage.getItem('eyesonly_street_state');
      if (!raw) return 'Cedar St';
      var parsed = JSON.parse(raw);
      return parsed.state && parsed.state.location ? parsed.state.location : 'Cedar St';
    } catch (e) {
      return 'Cedar St';
    }
  }

  // Helper to set street-chronicles location
  function setStreetChroniclesLocation(loc) {
    try {
      var raw = localStorage.getItem('eyesonly_street_state');
      var parsed = raw ? JSON.parse(raw) : { active: true, state: {} };
      if (!parsed.state) parsed.state = {};
      parsed.state.location = loc;
      localStorage.setItem('eyesonly_street_state', JSON.stringify(parsed));
    } catch (e) {
      // ignore
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
      // Repopulate inventory to refresh street-chronicles items
      populateInventory();
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

    // Get street-chronicles inventory if available
    var streetItems = [];
    if (typeof StreetChronicles !== 'undefined' && typeof StreetChronicles.getInventory === 'function') {
      streetItems = StreetChronicles.getInventory();
    }

    // Map street-chronicles items to UI format
    var streetInventoryItems = streetItems.map(function(itemName) {
      return {
        emoji: getEmojiForStreetItem(itemName),
        name: itemName,
        description: 'Found in street-chronicles',
        context: 'street'
      };
    });

    // Merge both inventories
    var allItems = inventoryItems.concat(streetInventoryItems);

    // Add inventory items
    allItems.forEach(function (item, index) {
      var itemEl = document.createElement('button');
      itemEl.className = 'inventory-item';

      // Add context-specific class for color coding
      if (item.context === 'live') {
        itemEl.classList.add('context-live');
      } else if (item.context === 'street') {
        itemEl.classList.add('context-street');
      } else if (item.context === 'both') {
        itemEl.classList.add('context-both');
      }

      itemEl.textContent = item.emoji;
      itemEl.setAttribute('data-index', index);
      itemEl.setAttribute('type', 'button');
      itemEl.setAttribute('aria-label', item.name);
      itemEl.addEventListener('click', function () {
        selectInventoryItem(index, allItems);
      });
      container.appendChild(itemEl);
    });

    // Add empty slots to fill grid (9 total for street-chronicles, 12 total for persistent)
    var maxSlots = 9; // Default to 9 for street-chronicles
    var emptySlots = Math.max(0, maxSlots - allItems.length);
    for (var i = 0; i < emptySlots; i++) {
      var emptyEl = document.createElement('div');
      emptyEl.className = 'inventory-item inventory-item-empty';
      emptyEl.textContent = '·';
      container.appendChild(emptyEl);
    }
  }

  function getEmojiForStreetItem(itemName) {
    var emojiMap = {
      'festival flyer': '📄',
      'folded note': '📝',
      'hackathon badge': '🏷️',
      'gull feather': '🪶'
    };
    return emojiMap[itemName] || '📦';
  }

  function selectInventoryItem(index, allItems) {
    // Remove previous selection
    var items = document.querySelectorAll('.inventory-item');
    items.forEach(function (item) {
      item.classList.remove('selected');
    });

    // Select new item
    selectedItemIndex = index;
    items[index].classList.add('selected');

    // Get the correct items array
    var itemsList = allItems || getMergedInventory();

    // Display item details in MOK interjection field
    var item = itemsList[index];
    if (item) {
      var contextLabel = item.context === 'live' ? '[LIVE ARPG]' :
                         item.context === 'street' ? '[STREET CHRONICLES]' :
                         item.context === 'both' ? '[BOTH]' : '';
      updateMokInterjection('ITEM: ' + item.name + ' ' + contextLabel + ' — ' + item.description + ' (Click again to equip)');

      // Set as active item on double-click or second click
      setActiveItem(item);
    }
  }

  function setActiveItem(item) {
    activeItem = item;
    var display = document.getElementById('active-item-display');
    if (!display) return;

    // Clear existing classes and content
    display.className = 'active-item-display has-item';

    // Add context class
    if (item.context) {
      display.classList.add('context-' + item.context);
    }

    // Set emoji
    display.innerHTML = item.emoji;

    updateMokInterjection('ACTIVE ITEM SET: ' + item.name + ' — Click active slot in header to use');
  }

  function clearActiveItem() {
    activeItem = null;
    var display = document.getElementById('active-item-display');
    if (!display) return;

    display.className = 'active-item-display';
    display.innerHTML = '<span class="empty-slot-indicator">·</span>';
  }

  function handleActiveItemClick() {
    if (!activeItem) {
      updateMokInterjection('No active item equipped. Select an item from inventory first.');
      return;
    }

    // Use the active item
    useActiveItem();
  }

  function useActiveItem() {
    if (!activeItem) return;

    var isInStreetChronicles = typeof StreetChronicles !== 'undefined' && StreetChronicles.isActive();
    var contextLabel = activeItem.context === 'live' ? 'LIVE ARPG' :
                       activeItem.context === 'street' ? 'STREET CHRONICLES' :
                       activeItem.context === 'both' ? 'BOTH CONTEXTS' : 'UNKNOWN';

    if (isInStreetChronicles) {
      // In street-chronicles, check if item is applicable
      if (activeItem.context === 'live') {
        // Item not applicable in street-chronicles
        printToTerminal([
          '',
          'ITEM ACTION UNRECOGNIZED',
          'Item: ' + activeItem.name,
          'Context: This item is for LIVE ARPG scenarios only.',
          'Cannot use in Street Chronicles.',
          ''
        ]);
      } else {
        // Item is applicable to street-chronicles - don't print to console
        // Just show feedback in MOK interjection
        updateMokInterjection('[STREET-CHRONICLES] Item used: ' + activeItem.name + ' — Processing action in current context.');
        // TODO: Integrate with street-chronicles item system
      }
    } else {
      // In command terminal (live ARPG context)
      if (activeItem.context === 'street') {
        // Item not applicable in command terminal
        printToTerminal([
          '',
          'ITEM ACTION UNRECOGNIZED',
          'Item: ' + activeItem.name,
          'Context: This item is for Street Chronicles only.',
          'Cannot use in Live ARPG context.',
          ''
        ]);
      } else {
        // Item is applicable to live ARPG - print to console
        printToTerminal([
          '',
          'ITEM APPLIED TO LIVE ARPG',
          'Item: ' + activeItem.name,
          'Context: ' + contextLabel,
          'Action processed by field operator.',
          'Event log transmitted to M Console.',
          ''
        ]);
      }
    }
  }

  function getMergedInventory() {
    var streetItems = [];
    if (typeof StreetChronicles !== 'undefined' && typeof StreetChronicles.getInventory === 'function') {
      streetItems = StreetChronicles.getInventory();
    }
    var streetInventoryItems = streetItems.map(function(itemName) {
      return {
        emoji: getEmojiForStreetItem(itemName),
        name: itemName,
        description: 'Found in street-chronicles',
        context: 'street'
      };
    });
    return inventoryItems.concat(streetInventoryItems);
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

  // Expose API for other modules
  window.UIControls = {
    showInventory: function() {
      if (!inventoryVisible) {
        toggleInventory();
      }
    }
  };
})();
