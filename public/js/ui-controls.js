/* UI Controls - Button handlers and inventory management */
(function () {
  'use strict';

  // Inventory state
  // Get actual persistent inventory from GAMESTATE instead of hardcoded test items
  var inventoryItems = [];  // Will be populated from GAMESTATE.getPersistentInventory()

  var inventoryVisible = false;
  var selectedItemIndex = -1;
  var activeItem = null; // Currently active item in header slot
  var _draggedInventoryItem = null; // Track item being dragged for equipping

  // Login overlay state
  var loginOverlayVisible = false;
  var loginOverlayMode = 'login'; // 'login' or 'register'
  var loginReturnContext = 'index'; // Where to return after login: 'index', 'street', 'rogue'

  /**
   * Update login button text based on authentication state and overlay state
   */
  function _updateLoginButton() {
    var loginBtn = document.querySelector('button[data-action="login"]');
    if (!loginBtn) return;

    if (typeof UserAccount !== 'undefined' && UserAccount.isLoggedIn()) {
      loginBtn.textContent = 'logout';
      loginBtn.classList.add('auth-logged-in');
      loginBtn.setAttribute('aria-label', 'Log out of current session');
    } else if (loginOverlayVisible && loginOverlayMode === 'login') {
      loginBtn.textContent = 'register';
      loginBtn.classList.remove('auth-logged-in');
      loginBtn.setAttribute('aria-label', 'Switch to registration form');
    } else {
      loginBtn.textContent = 'login';
      loginBtn.classList.remove('auth-logged-in');
      loginBtn.setAttribute('aria-label', 'Log in to account');
    }
  }

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
      // Add drag-and-drop support for equipping items
      _initializeActiveSlotDragDrop(activeSlot);
    }

    // Initialize login overlay handlers
    initLoginOverlay();

    // Update login button based on auth state
    _updateLoginButton();

    // Listen for custom auth events instead of polling
    if (typeof window !== 'undefined') {
      window.addEventListener('auth-state-changed', _updateLoginButton);
    }
  }

  /**
   * Initialize active item slot to accept drag-and-drop
   * @param {HTMLElement} activeSlot - The active item slot element
   */
  function _initializeActiveSlotDragDrop(activeSlot) {
    // Prevent default drag behaviors to allow drop
    activeSlot.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      activeSlot.classList.add('drag-over');
    });

    // Remove visual feedback on drag leave
    activeSlot.addEventListener('dragleave', function(e) {
      // Only remove styling if actually leaving the activeSlot, not just moving to a child
      if (e.relatedTarget && !activeSlot.contains(e.relatedTarget)) {
        activeSlot.classList.remove('drag-over');
      } else if (!e.relatedTarget) {
        // relatedTarget is null when leaving the document
        activeSlot.classList.remove('drag-over');
      }
    });

    // Handle drop event
    activeSlot.addEventListener('drop', function(e) {
      e.preventDefault();
      activeSlot.classList.remove('drag-over');

      // Check if we have dragged inventory item data
      if (_draggedInventoryItem) {
        _equipInventoryItemToActiveSlot(_draggedInventoryItem);
        _draggedInventoryItem = null;
      }
    });
  }

  /**
   * Equip an inventory item to the active slot
   * @param {Object} itemData - Item data including item and index
   */
  function _equipInventoryItemToActiveSlot(itemData) {
    var item = itemData.item;
    var index = itemData.index;

    // Check if Gone Rogue is active
    var isInGoneRogue = typeof GoneRogue !== 'undefined' && GoneRogue.isActive();

    if (isInGoneRogue && typeof GAMESTATE !== 'undefined') {
      // In Gone Rogue mode, use GAMESTATE to set active item
      GAMESTATE.setActiveItem(item);

      // Update active item display in header
      var activeDisplay = document.getElementById('active-item-display');
      if (activeDisplay) {
        activeDisplay.innerHTML = '<span class="item-emoji">' + (item.emoji || '📦') + '</span>';
        activeDisplay.classList.add('has-item');
      }

      // Update player lighting if this is a lighting item
      if (typeof GoneRogue.updatePlayerLight === 'function') {
        GoneRogue.updatePlayerLight();
      }

      // Show feedback message
      if (typeof window.appendLine === 'function') {
        window.appendLine('⚡ EQUIPPED: ' + item.emoji + ' ' + item.name);
      }

      // Refresh inventory display if mobile inventory is active
      if (typeof GoneRogueMobile !== 'undefined' && typeof GoneRogueMobile.showInventory === 'function') {
        GoneRogueMobile.showInventory();
      }
    } else {
      // Standard mode (non-Gone Rogue)
      setActiveItem(item);
    }
  }

  function handleButtonClick(e) {
    var action = e.target.getAttribute('data-action');
    var isInStreetChronicles = typeof StreetChronicles !== 'undefined' && StreetChronicles.isActive();
    var isInLoginShell = typeof LoginShell !== 'undefined' && LoginShell.isActive();

    switch (action) {
      case 'help':
        // Check if in Gone Rogue mode - offer agent takeover
        var isInGoneRogue = typeof GoneRogue !== 'undefined' && GoneRogue.isActive();

        if (isInGoneRogue) {
          // Check if agent is already active
          if (typeof AgentIntegration !== 'undefined' && AgentIntegration.isActive()) {
            // Agent is active - show control options
            printToTerminal([
              '',
              'AGENT CONTROL OPTIONS:',
              '————————————————————————————————',
              'Type one of the following commands:',
              '',
              'AGENT STOP     - Stop agent and return control',
              'AGENT PAUSE    - Pause/resume agent',
              'AGENT REPORT   - View current metrics',
              'AGENT MODE     - Show current mode (natural/developer)',
              '',
              'Or press BACK button to exit',
              ''
            ]);
          } else {
            // Offer agent takeover
            printToTerminal([
              '',
              'MOK AGENT ASSISTANCE AVAILABLE',
              '————————————————————————————————',
              '',
              '[MOK]: "I can take control and play for you."',
              '[MOK]: "This will generate an MVP audit report."',
              '',
              'AGENT MODES:',
              '  AGENT NATURAL    - Natural human-like play',
              '                     Explores thoroughly, makes',
              '                     realistic decisions',
              '',
              '  AGENT DEVELOPER  - Fast efficient testing',
              '                     Optimal pathfinding, quick',
              '                     completion for validation',
              '',
              'Type AGENT NATURAL or AGENT DEVELOPER to begin',
              'Or press BACK to continue playing manually',
              ''
            ]);
          }
        } else if (isInStreetChronicles) {
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
        // Priority 1: Exit login overlay if active
        if (loginOverlayVisible) {
          toggleLoginOverlay();
          // Also exit login shell if in session
          if (typeof LoginShell !== 'undefined' && LoginShell.isActive()) {
            simulateCommand('exit');
          }
          break;
        }
        // Priority 2: Exit inventory if active
        if (inventoryVisible) {
          toggleInventory();
          // Don't print anything - just close inventory
          break;
        }
        // Priority 3: Check if in authorization/clearance sequence
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

        // Map button - context-aware
        if (isInStreetChronicles) {
          // In Street Chronicles: Show map/recenter to main street
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
          // In command terminal: Show map command
          simulateCommand('map');
        }
        break;

      case 'login':
        // Close inventory if open
        if (inventoryVisible) {
          toggleInventory();
        }

        // Context-aware authentication button behavior
        if (typeof UserAccount !== 'undefined' && UserAccount.isLoggedIn()) {
          // User is logged in - show LOGOUT action
          UserAccount.logout().then(function() {
            printToTerminal([
              '',
              'LOGOUT SUCCESSFUL',
              'Session terminated.',
              'User data preserved locally.',
              ''
            ]);
            _updateLoginButton();
            // Dispatch auth state change event
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('auth-state-changed'));
            }
          }).catch(function() {
            printToTerminal([
              '',
              'LOGOUT COMPLETED',
              'Local session cleared.',
              ''
            ]);
            _updateLoginButton();
            // Dispatch auth state change event
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('auth-state-changed'));
            }
          });
        } else if (loginOverlayVisible && loginOverlayMode === 'login') {
          // Login overlay is open, button shows "register" - switch to register mode
          switchToRegisterMode();
        } else {
          // User not logged in - open login overlay
          // Capture current context before showing login
          captureReturnContext();
          toggleLoginOverlay();
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

      case 'kernel':
        // Kernel button - agent integration (requires login)
        handleKernelClick();
        break;

      case 'score':
        // Open highscore page in new window
        window.open('highscore/', '_blank');
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

    // Check if Gone Rogue is active
    var isInGoneRogue = typeof GoneRogue !== 'undefined' && GoneRogue.isActive();

    if (inventoryVisible) {
      if (isInGoneRogue) {
        // Show Gone Rogue mobile inventory instead of Street Chronicles inventory
        if (typeof GoneRogueMobile !== 'undefined' && typeof GoneRogueMobile.showInventory === 'function') {
          GoneRogueMobile.showInventory();
        }
        updateMokInterjection('Inventory display active. Tap/drag items to ACTIVE SLOT in header to equip.');
      } else {
        // Repopulate inventory to refresh street-chronicles items
        populateInventory();
        terminal.style.display = 'none';
        inventoryGrid.style.display = 'flex';
        updateMokInterjection('Inventory display active. Select item for details.');
      }
    } else {
      if (isInGoneRogue) {
        // Hide Gone Rogue mobile inventory
        var mobileInventory = document.getElementById('rogue-inventory-mobile');
        if (mobileInventory) {
          mobileInventory.style.display = 'none';
        }
      }
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

    // Get persistent inventory from GAMESTATE (3 starter items)
    var persistentItems = [];
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getPersistentInventory === 'function') {
      persistentItems = GAMESTATE.getPersistentInventory();
    }

    // Map persistent inventory to UI format
    var persistentInventoryItems = persistentItems.map(function(item) {
      return {
        emoji: item.emoji || '📦',
        name: item.name || 'Unknown Item',
        description: item.description || 'No description',
        context: 'both',  // Persistent items are available in both contexts
        type: item.type || 'item',
        lifecycle: item.lifecycle || 'disposable'  // Items are disposable by default
      };
    });

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
        context: 'street',
        lifecycle: 'disposable'  // Street items are disposable
      };
    });

    // Merge inventories: persistent items first, then street items
    var allItems = persistentInventoryItems.concat(streetInventoryItems);

    // Add inventory items
    allItems.forEach(function (item, index) {
      var itemEl = document.createElement('button');
      itemEl.className = 'inventory-item';

      // Make item draggable for disposal
      itemEl.draggable = true;
      itemEl.dataset.itemData = JSON.stringify(item);
      itemEl.dataset.itemIndex = index;

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

      // Click handler for selection
      itemEl.addEventListener('click', function () {
        selectInventoryItem(index, allItems);
      });

      // Drag handlers for disposal and equipping
      itemEl.addEventListener('dragstart', function(e) {
        // Store item data for equipping to active slot
        _draggedInventoryItem = { item: item, index: index };

        // Also notify CardDisposalSystem for incinerator functionality
        if (typeof CardDisposalSystem !== 'undefined') {
          CardDisposalSystem.handleDragStart(itemEl, item, index, 'inventory');
        }
      });

      itemEl.addEventListener('dragend', function(e) {
        // Clear dragged item state
        _draggedInventoryItem = null;

        if (typeof CardDisposalSystem !== 'undefined') {
          CardDisposalSystem.handleDragEnd();
        }
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
    // Check if Gone Rogue is active
    var isInGoneRogue = typeof GoneRogue !== 'undefined' && GoneRogue.isActive();

    if (isInGoneRogue) {
      // In Gone Rogue mode, check GAMESTATE for active item
      if (typeof GAMESTATE !== 'undefined') {
        var goneRogueActiveItem = GAMESTATE.getActiveItem();
        if (goneRogueActiveItem) {
          // Check if inventory is open
          if (inventoryVisible) {
            // Inventory open: UNEQUIP the item
            GAMESTATE.clearActiveItem();

            // Update active item display in header
            var activeDisplay = document.getElementById('active-item-display');
            if (activeDisplay) {
              activeDisplay.innerHTML = '<span class="empty-slot-indicator">·</span>';
              activeDisplay.classList.remove('has-item');
            }

            // Update player lighting
            if (typeof GoneRogue.updatePlayerLight === 'function') {
              GoneRogue.updatePlayerLight();
            }

            // Show feedback message
            if (typeof window.appendLine === 'function') {
              window.appendLine('⚠ UNEQUIPPED: ' + goneRogueActiveItem.emoji + ' ' + goneRogueActiveItem.name);
            }

            updateMokInterjection('Item unequipped: ' + goneRogueActiveItem.name);

            // Refresh inventory display
            if (typeof GoneRogueMobile !== 'undefined' && typeof GoneRogueMobile.showInventory === 'function') {
              GoneRogueMobile.showInventory();
            }
          } else {
            // Inventory closed: USE the item for ground effects/buffs/healing
            if (typeof GoneRogue.triggerActiveItem === 'function') {
              GoneRogue.triggerActiveItem();
            } else {
              updateMokInterjection('Active item usage: ' + goneRogueActiveItem.name + ' - Feature coming soon.');
            }
          }
        } else {
          updateMokInterjection('No active item equipped. Select an item from inventory first.');
        }
      }
      return;
    }

    // Street Chronicles / original behavior
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

  /**
   * Initialize login overlay event handlers
   */
  function initLoginOverlay() {
    // Login submit button
    var loginSubmitBtn = document.getElementById('login-submit-btn');
    if (loginSubmitBtn) {
      loginSubmitBtn.addEventListener('click', handleLoginSubmit);
    }

    // Register submit button
    var registerSubmitBtn = document.getElementById('register-submit-btn');
    if (registerSubmitBtn) {
      registerSubmitBtn.addEventListener('click', handleRegisterSubmit);
    }

    // Add Enter key support for forms
    var loginUsername = document.getElementById('login-username');
    if (loginUsername) {
      loginUsername.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') handleLoginSubmit();
      });
    }

    // Add validation for registration fields
    var registerUsername = document.getElementById('register-username');
    if (registerUsername) {
      registerUsername.addEventListener('input', validateUsername);
      registerUsername.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          var callsignInput = document.getElementById('register-callsign');
          if (callsignInput) callsignInput.focus();
        }
      });
    }

    var registerEmail = document.getElementById('register-email');
    if (registerEmail) {
      registerEmail.addEventListener('input', validateEmail);
      registerEmail.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') handleRegisterSubmit();
      });
    }
  }

  /**
   * Capture current context to restore after login
   */
  function captureReturnContext() {
    // Determine current active mode
    if (typeof GoneRogue !== 'undefined' && GoneRogue.isActive()) {
      loginReturnContext = 'rogue';
    } else if (typeof StreetChronicles !== 'undefined' && StreetChronicles.isActive()) {
      loginReturnContext = 'street';
    } else {
      loginReturnContext = 'index';
    }
  }

  /**
   * Show login overlay with optional context parameter
   * @param {string} returnContext - Optional context to return to after login ('index', 'street', 'rogue')
   */
  function showLoginOverlay(returnContext) {
    if (returnContext) {
      loginReturnContext = returnContext;
    } else {
      captureReturnContext();
    }

    if (!loginOverlayVisible) {
      toggleLoginOverlay();
    }
  }

  /**
   * Restore context after successful login
   */
  function restoreContextAfterLogin() {
    if (loginReturnContext === 'rogue' && typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.requestRogue === 'function') {
      // Return to Gone Rogue mode
      setTimeout(function() {
        var action = GAMESTATE.requestRogue({});
        if (action && action.lines) {
          action.lines.forEach(function(line) {
            if (typeof Terminal !== 'undefined' && Terminal.writeLine) {
              Terminal.writeLine(line, 'system-msg highlight');
            }
          });
        }
      }, 100);
    } else if (loginReturnContext === 'street' && typeof StreetChronicles !== 'undefined' && typeof StreetChronicles.start === 'function') {
      // Return to Street Chronicles mode
      setTimeout(function() {
        var action = StreetChronicles.start();
        if (action && action.lines) {
          action.lines.forEach(function(line) {
            if (typeof Terminal !== 'undefined' && Terminal.writeLine) {
              Terminal.writeLine(line, 'system-msg');
            }
          });
        }
        if (action && action.prompt && typeof Terminal !== 'undefined' && Terminal.showInput) {
          Terminal.showInput(action.prompt);
        }
      }, 100);
    }
    // For 'index' context, we just stay at the main terminal (default behavior)
    // Reset to index for next time
    loginReturnContext = 'index';
  }

  /**
   * Toggle login overlay visibility
   */
  function toggleLoginOverlay() {
    loginOverlayVisible = !loginOverlayVisible;
    var terminal = document.querySelector('.log-frame');
    var loginOverlay = document.getElementById('login-overlay');

    if (loginOverlayVisible) {
      terminal.style.display = 'none';
      loginOverlay.style.display = 'flex';
      loginOverlayMode = 'login';
      showLoginForm();
      // Focus username field
      setTimeout(function() {
        var usernameInput = document.getElementById('login-username');
        if (usernameInput) usernameInput.focus();
      }, 100);
    } else {
      terminal.style.display = 'flex';
      loginOverlay.style.display = 'none';
      // Clear form fields
      clearLoginForms();
    }
    _updateLoginButton();
  }

  /**
   * Switch to register mode
   */
  function switchToRegisterMode() {
    loginOverlayMode = 'register';
    showRegisterForm();
    _updateLoginButton();
    // Focus username field
    setTimeout(function() {
      var usernameInput = document.getElementById('register-username');
      if (usernameInput) usernameInput.focus();
    }, 100);
  }

  /**
   * Show login form
   */
  function showLoginForm() {
    var loginForm = document.getElementById('login-form');
    var registerForm = document.getElementById('register-form');
    var title = document.getElementById('login-overlay-title');

    if (loginForm) loginForm.style.display = 'block';
    if (registerForm) registerForm.style.display = 'none';
    if (title) title.textContent = 'AUTHENTICATION PORTAL';
    loginOverlayMode = 'login';
  }

  /**
   * Show register form
   */
  function showRegisterForm() {
    var loginForm = document.getElementById('login-form');
    var registerForm = document.getElementById('register-form');
    var title = document.getElementById('login-overlay-title');

    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'block';
    if (title) title.textContent = 'NEW USER REGISTRATION';
    loginOverlayMode = 'register';
  }

  /**
   * Clear all form fields
   */
  function clearLoginForms() {
    var loginUsername = document.getElementById('login-username');
    if (loginUsername) loginUsername.value = '';

    var registerUsername = document.getElementById('register-username');
    if (registerUsername) registerUsername.value = '';

    var registerCallsign = document.getElementById('register-callsign');
    if (registerCallsign) registerCallsign.value = '';

    var registerEmail = document.getElementById('register-email');
    if (registerEmail) registerEmail.value = '';

    // Clear validation messages
    var usernameValidation = document.getElementById('username-validation');
    if (usernameValidation) usernameValidation.textContent = '';

    var emailValidation = document.getElementById('email-validation');
    if (emailValidation) emailValidation.textContent = '';
  }

  /**
   * Handle login form submission
   */
  function handleLoginSubmit() {
    var usernameInput = document.getElementById('login-username');
    if (!usernameInput) return;

    var username = usernameInput.value.trim().toLowerCase();
    if (!username) {
      updateMokInterjection('Username is required.');
      return;
    }

    // Disable button during request
    var submitBtn = document.getElementById('login-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'AUTHENTICATING...';
    }

    // Animation delay to allow smooth overlay close
    var OVERLAY_CLOSE_ANIMATION_DELAY = 150; // ms

    // Check if using test account via LoginShell
    // Note: test accounts 'user' and 'admin' use the LoginShell system (terminal-within-terminal)
    // This is separate from the real UserAccount authentication system
    if (typeof LoginShell !== 'undefined' && (username === 'user' || username === 'admin')) {
      // Close overlay first
      toggleLoginOverlay();

      // Show message in terminal that we're entering LoginShell mode
      printToTerminal([
        '',
        'TEST ACCOUNT DETECTED: ' + username.toUpperCase(),
        'Entering LoginShell subsystem...',
        'This is a demo authentication system.',
        ''
      ]);

      // Start the LoginShell subsystem (terminal-within-terminal)
      if (typeof LoginShell.start === 'function') {
        // Delay to let overlay close animation complete
        setTimeout(function() {
          var result = LoginShell.start();
          if (result && result.lines) {
            result.lines.forEach(function(line) {
              if (typeof Terminal !== 'undefined' && Terminal.writeLine) {
                Terminal.writeLine(line, 'system-msg');
              }
            });
          }
          // Update prompt if needed
          if (result && result.prompt && typeof Terminal !== 'undefined' && Terminal.showInput) {
            Terminal.showInput(result.prompt);
          }
        }, OVERLAY_CLOSE_ANIMATION_DELAY);
      }

      // Re-enable button
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'LOGIN';
      }
      return;
    }

    // Use UserAccount API for real accounts
    if (typeof UserAccount !== 'undefined' && typeof UserAccount.login === 'function') {
      UserAccount.login(username)
        .then(function(data) {
          toggleLoginOverlay();
          printToTerminal([
            '',
            'LOGIN SUCCESSFUL',
            'Welcome back, ' + data.user.callsign + '.',
            ''
          ]);
          _updateLoginButton();
          // Dispatch auth state change event
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('auth-state-changed'));
          }
          // Restore context after login
          restoreContextAfterLogin();
        })
        .catch(function(err) {
          updateMokInterjection('Login failed: ' + err.message);
        })
        .finally(function() {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'LOGIN';
          }
        });
    } else {
      updateMokInterjection('UserAccount system not available.');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'LOGIN';
      }
    }
  }

  /**
   * Handle register form submission
   */
  function handleRegisterSubmit() {
    var usernameInput = document.getElementById('register-username');
    var callsignInput = document.getElementById('register-callsign');
    var emailInput = document.getElementById('register-email');

    if (!usernameInput) return;

    var username = usernameInput.value.trim().toLowerCase();
    var callsign = callsignInput ? callsignInput.value.trim() : '';
    var email = emailInput ? emailInput.value.trim() : '';

    // Validate username
    if (!username || username.length < 3 || username.length > 20) {
      updateMokInterjection('Username must be 3-20 characters.');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      updateMokInterjection('Username can only contain letters, numbers, and underscores.');
      return;
    }

    // Validate email if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      updateMokInterjection('Invalid email format.');
      return;
    }

    // Use username as callsign if not provided
    if (!callsign) {
      callsign = username;
    }

    // Disable button during request
    var submitBtn = document.getElementById('register-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'CREATING ACCOUNT...';
    }

    // Use UserAccount API for registration
    if (typeof UserAccount !== 'undefined' && typeof UserAccount.register === 'function') {
      UserAccount.register(username, callsign, email || null)
        .then(function(data) {
          toggleLoginOverlay();
          printToTerminal([
            '',
            'REGISTRATION SUCCESSFUL',
            'Welcome, ' + data.user.callsign + '.',
            'Your account has been created.',
            ''
          ]);
          _updateLoginButton();
          // Dispatch auth state change event
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('auth-state-changed'));
          }
          // Restore context after registration
          restoreContextAfterLogin();
        })
        .catch(function(err) {
          updateMokInterjection('Registration failed: ' + err.message);
        })
        .finally(function() {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'CREATE ACCOUNT';
          }
        });
    } else {
      updateMokInterjection('UserAccount system not available.');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'CREATE ACCOUNT';
      }
    }
  }

  /**
   * Validate username field
   */
  function validateUsername() {
    var usernameInput = document.getElementById('register-username');
    var validation = document.getElementById('username-validation');
    if (!usernameInput || !validation) return;

    var username = usernameInput.value.trim();
    if (!username) {
      validation.textContent = '';
      return;
    }

    if (username.length < 3) {
      validation.textContent = 'Too short (min 3 characters)';
      validation.classList.remove('valid');
    } else if (username.length > 20) {
      validation.textContent = 'Too long (max 20 characters)';
      validation.classList.remove('valid');
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      validation.textContent = 'Only letters, numbers, and underscores';
      validation.classList.remove('valid');
    } else {
      validation.textContent = 'Valid username format';
      validation.classList.add('valid');
    }
  }

  /**
   * Validate email field
   */
  function validateEmail() {
    var emailInput = document.getElementById('register-email');
    var validation = document.getElementById('email-validation');
    if (!emailInput || !validation) return;

    var email = emailInput.value.trim();
    if (!email) {
      validation.textContent = '';
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      validation.textContent = 'Invalid email format';
      validation.classList.remove('valid');
    } else {
      validation.textContent = 'Valid email format';
      validation.classList.add('valid');
    }
  }

  /**
   * Handle Kernel button click - Agent integration
   */
  function handleKernelClick() {
    // Check if user is logged in
    if (typeof LoginShell === 'undefined' || !LoginShell.isAuthenticated || !LoginShell.isAuthenticated()) {
      printToTerminal([
        '',
        'KERNEL ACCESS DENIED',
        '————————————————————————————————',
        '',
        '[SYSTEM]: Authentication required.',
        '[SYSTEM]: Please login to access agent integration.',
        '',
        'Use the LOGIN button to authenticate.',
        ''
      ]);
      return;
    }

    // User is logged in - open kernel interface via command handler if available
    if (typeof window !== 'undefined' && typeof window._mainCommandHandler === 'function') {
      window._mainCommandHandler('kernel');
      return;
    }

    // Fallback: show kernel interface (legacy)
    printToTerminal([
      '',
      'KERNEL AGENT INTEGRATION',
      '————————————————————————————————',
      '',
      '[MOK]: "Agent API integration portal."',
      '[MOK]: "Connect your own AI agent to play alongside me."',
      '',
      'AVAILABLE COMMANDS:',
      '  KERNEL CONNECT <agent_url>  - Connect agent URL',
      '  KERNEL DISCONNECT           - Disconnect agent',
      '  KERNEL STATUS               - View connection status',
      '  KERNEL HELP                 - Show help',
      ''
    ]);
  }

  /**
   * Enable kernel button when user logs in
   */
  function enableKernelButton() {
    var kernelBtn = document.querySelector('button[data-action="kernel"]');
    if (kernelBtn) {
      kernelBtn.disabled = false;
      kernelBtn.classList.add('enabled');
      console.log('[UIControls] Kernel button enabled');
    }
  }

  /**
   * Disable kernel button when user logs out
   */
  function disableKernelButton() {
    var kernelBtn = document.querySelector('button[data-action="kernel"]');
    if (kernelBtn) {
      kernelBtn.disabled = true;
      kernelBtn.classList.remove('enabled');
      console.log('[UIControls] Kernel button disabled');
    }
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /**
   * Update currency display in header
   * @param {number} amount - Current crypto balance
   */
  /**
   * Update currency display with animated ticker effect
   * @param {number} amount - New currency amount
   */
  function updateCurrencyDisplay(amount) {
    var currencyValueEl = document.getElementById('currency-value');
    if (!currencyValueEl) return;

    // Get current displayed value
    var currentText = currencyValueEl.textContent || '00000000';
    var currentValue = parseInt(currentText, 10) || 0;
    var targetValue = amount || 0;

    // If no change, just update without animation
    if (currentValue === targetValue) {
      var formatted = String(targetValue).padStart(8, '0');
      currencyValueEl.textContent = formatted;
      return;
    }

    // Animate from current to target value (ticker/slot machine effect)
    var duration = 600; // 600ms animation
    var startTime = Date.now();
    var difference = targetValue - currentValue;

    // Add ticker animation class for CSS effects
    currencyValueEl.classList.add('currency-ticker-active');

    function animateTicker() {
      var elapsed = Date.now() - startTime;
      var progress = Math.min(elapsed / duration, 1);

      // Easing function for smooth deceleration
      var eased = 1 - Math.pow(1 - progress, 3); // Cubic ease-out

      var currentDisplayValue = Math.round(currentValue + (difference * eased));
      var formatted = String(currentDisplayValue).padStart(8, '0');
      currencyValueEl.textContent = formatted;

      if (progress < 1) {
        requestAnimationFrame(animateTicker);
      } else {
        // Ensure final value is exact
        var finalFormatted = String(targetValue).padStart(8, '0');
        currencyValueEl.textContent = finalFormatted;

        // Remove animation class after a brief moment
        setTimeout(function() {
          currencyValueEl.classList.remove('currency-ticker-active');
        }, 100);
      }
    }

    animateTicker();
  }

  // Expose API for other modules
  window.UIControls = {
    showInventory: function() {
      if (!inventoryVisible) {
        toggleInventory();
      }
    },
    showLoginOverlay: showLoginOverlay,
    updateCurrency: updateCurrencyDisplay,
    updateMokInterjection: updateMokInterjection,
    enableKernelButton: enableKernelButton,
    disableKernelButton: disableKernelButton
  };
})();
