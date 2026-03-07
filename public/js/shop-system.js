/* ============================================================
   EYES ONLY - Shop System
   Commerce mechanics for Gone Rogue mode
   Supports standard shops and Black Market variants
   ============================================================ */

const ShopSystem = (function () {
  'use strict';

  // Shop types
  var SHOP_TYPES = {
    STANDARD: 'standard',
    BLACK_MARKET: 'black_market'
  };

  // State
  var _currentShop = null;
  var _isOpen = false;
  var _shopContainer = null;
  var _dimOverlay = null;

  // Configuration
  // Bonfire floors — now owned by BonfireFloorRegistry (single source of truth)
  var BONFIRE_FLOORS = (typeof BonfireFloorRegistry !== 'undefined')
    ? BonfireFloorRegistry.getFloors()
    : [10, 16, 22];
  var BLACK_MARKET_CONFIG = {
    spawnChance: 0.18,
    guaranteedFloor: 6,
    neverTwicePerFloor: true,
    hiddenBehindDestructible: true,
    priceInflation: 1.40,
    gamblePercentage: 0.70
  };

  /**
   * Initialize shop system
   */
  function init() {
    _createShopElements();
    _attachEventListeners();
  }

  /**
   * Create shop DOM elements
   */
  function _createShopElements() {
    // Create dim overlay
    _dimOverlay = document.createElement('div');
    _dimOverlay.className = 'shop-dim-overlay';
    _dimOverlay.style.display = 'none';
    document.body.appendChild(_dimOverlay);

    // Create shop container
    _shopContainer = document.createElement('div');
    _shopContainer.className = 'shop-root';
    _shopContainer.style.display = 'none';
    document.body.appendChild(_shopContainer);
  }

  /**
   * Attach event listeners
   */
  function _attachEventListeners() {
    // Close shop on dim overlay click
    _dimOverlay.addEventListener('click', closeShop);

    // Delegate event listeners for shop interactions
    _shopContainer.addEventListener('click', _handleShopClick);
    _shopContainer.addEventListener('touchend', _handleShopTouch);

    // Drag-drop event listeners for shop cards
    _shopContainer.addEventListener('dragstart', _handleShopDragStart);
    _shopContainer.addEventListener('dragend', _handleShopDragEnd);
  }

  /**
   * Check if a shop should spawn on this floor
   */
  function shouldSpawnShop(floor, floorType) {
    // Standard shop on bonfire floors
    if (BONFIRE_FLOORS.indexOf(floor) !== -1) {
      return { type: SHOP_TYPES.STANDARD, guaranteed: true };
    }

    // Black Market random spawn (after floor 2)
    if (floor > 2 && Math.random() < BLACK_MARKET_CONFIG.spawnChance) {
      return { type: SHOP_TYPES.BLACK_MARKET, guaranteed: false };
    }

    return null;
  }

  /**
   * Handle drag start for shop cards
   */
  function _handleShopDragStart(e) {
    var target = e.target;

    // Find shop card element
    while (target && target !== _shopContainer) {
      if (target.classList && target.classList.contains('shop-card')) {
        break;
      }
      target = target.parentElement;
    }

    if (!target || !target.classList.contains('shop-card')) {
      return;
    }

    // Don't allow dragging disabled cards
    if (target.classList.contains('disabled')) {
      e.preventDefault();
      return;
    }

    // Get item data
    var itemId = target.getAttribute('data-item-id');
    var itemType = target.getAttribute('data-type');
    var itemPrice = parseInt(target.getAttribute('data-price'), 10);
    var itemName = target.getAttribute('data-card-name');

    // Find item in inventory
    var item = null;
    if (_currentShop && _currentShop.inventory) {
      for (var i = 0; i < _currentShop.inventory.length; i++) {
        if (_currentShop.inventory[i].id === itemId) {
          item = _currentShop.inventory[i];
          break;
        }
      }
    }

    if (!item) {
      e.preventDefault();
      return;
    }

    // Set drag data
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', itemId);

    // Add dragging class
    target.classList.add('dragging');

    // Notify commerce drag-drop system
    if (typeof CommerceDragDropSystem !== 'undefined') {
      var sourceZone = itemType === 'gamble' ? 'shop_gamble' : 'shop_items';
      CommerceDragDropSystem.handleDragStart({
        sourceZone: sourceZone,
        itemId: itemId,
        itemType: itemType,
        cardData: item.cardData,
        itemPrice: itemPrice,
        itemName: itemName
      });
    }

    console.log('[ShopSystem] Drag started:', itemName, 'price:', itemPrice);
  }

  /**
   * Handle drag end for shop cards
   */
  function _handleShopDragEnd(e) {
    var target = e.target;

    // Remove dragging class
    if (target && target.classList) {
      target.classList.remove('dragging');
    }

    // Notify commerce drag-drop system
    if (typeof CommerceDragDropSystem !== 'undefined') {
      CommerceDragDropSystem.handleDragEnd();
    }
  }

  /**
   * Open a shop
   */
  function openShop(shopType, floor) {
    if (_isOpen) {
      console.warn('[ShopSystem] Shop already open');
      return;
    }

    shopType = shopType || SHOP_TYPES.STANDARD;
    floor = floor || 1;

    // Generate shop inventory
    var inventory = _generateShopInventory(floor, shopType);

    // Get player state
    var playerCurrency = (typeof GAMESTATE !== 'undefined')
      ? GAMESTATE.getState().cryptos
      : 0;
    var playerHand = (typeof GAMESTATE !== 'undefined')
      ? GAMESTATE.getState().cardHand
      : [];
    var playerInventory = (typeof GAMESTATE !== 'undefined')
      ? GAMESTATE.getLooseInventory()
      : [];
    var playerActionBar = (typeof GAMESTATE !== 'undefined')
      ? GAMESTATE.getState().actionButtonCards
      : [];

    _currentShop = {
      type: shopType,
      floor: floor,
      inventory: inventory,
      visibleStart: 0,
      visibleCount: _getVisibleCount()
    };

    _isOpen = true;

    // Notify commerce drag-drop system that shop is open
    if (typeof CommerceDragDropSystem !== 'undefined') {
      CommerceDragDropSystem.setShopOpen(true);
    }

    // Render shop UI
    _renderShop(_currentShop, playerCurrency, playerHand, playerInventory, playerActionBar);

    // Show dim overlay and shop
    _dimOverlay.style.display = 'block';
    _shopContainer.style.display = 'block';

    // Trigger MOK interjection
    if (typeof MokUX !== 'undefined') {
      var shopName = shopType === SHOP_TYPES.BLACK_MARKET ? 'Black Market' : 'Merchant';
      MokUX.speak('Approaching ' + shopName + '.', 'NEUTRAL');
    }

    // Tooltip
    if (typeof TooltipSystem !== 'undefined') {
      TooltipSystem.showAction('shop-open', { type: shopType });
    }
  }

  /**
   * Close shop
   */
  function closeShop() {
    if (!_isOpen) {
      return;
    }

    _isOpen = false;
    _currentShop = null;

    // Notify commerce drag-drop system that shop is closed
    if (typeof CommerceDragDropSystem !== 'undefined') {
      CommerceDragDropSystem.setShopOpen(false);
    }

    // Hide UI
    _dimOverlay.style.display = 'none';
    _shopContainer.style.display = 'none';
    _shopContainer.innerHTML = '';

    // Clear tooltip
    if (typeof TooltipSystem !== 'undefined') {
      TooltipSystem.clear();
    }
  }

  /**
   * Generate shop inventory based on floor and type
   */
  function _generateShopInventory(floor, shopType) {
    var inventory = [];
    var isBlackMarket = shopType === SHOP_TYPES.BLACK_MARKET;

    // Determine inventory size
    var totalSlots, gambleCount, visibleCardCount;

    if (floor <= 3) {
      totalSlots = isBlackMarket ? 16 : 8;
      gambleCount = isBlackMarket ? 12 : 1;
      visibleCardCount = isBlackMarket ? 3 : 7;
    } else if (floor <= 7) {
      totalSlots = isBlackMarket ? 22 : 14;
      gambleCount = isBlackMarket ? 15 : 2;
      visibleCardCount = isBlackMarket ? 4 : 12;
    } else {
      totalSlots = isBlackMarket ? 28 : 21;
      gambleCount = isBlackMarket ? 18 : 3;
      visibleCardCount = isBlackMarket ? 5 : 18;
    }

    // Generate gambling items
    for (var i = 0; i < gambleCount; i++) {
      inventory.push({
        id: 'gamble_' + i + '_' + Date.now(),
        name: 'Mystery Card',
        emoji: '💰',
        rarity: 'common',
        price: _getGamblePrice(floor, i, isBlackMarket),
        type: 'gamble',
        gambleType: _getRandomGambleType(),
        gradientSeed: _generateGradientSeed()
      });
    }

    // Generate visible cards
    for (var j = 0; j < visibleCardCount; j++) {
      var card = _generateRandomCard(floor, isBlackMarket);
      if (card) {
        inventory.push({
          id: 'item_' + j + '_' + Date.now(),
          name: card.name,
          emoji: card.emoji,
          rarity: card.rarity,
          price: _getBuyPrice(floor, card.rarity, isBlackMarket),
          type: 'card',
          cardData: card
        });
      }
    }

    return inventory;
  }

  /**
   * Get gambling price based on floor and black market status
   */
  function _getGamblePrice(floor, index, isBlackMarket) {
    var base = 80 + (floor * 40);
    var variance = base * 0.3;
    var price = base + (Math.random() * variance * 2) - variance;

    // Some slots more expensive
    if (index % 3 === 0) {
      price *= 1.5;
    }

    // Black market inflation
    if (isBlackMarket) {
      price *= BLACK_MARKET_CONFIG.priceInflation;
    }

    return Math.floor(price);
  }

  /**
   * Get buy price for a card
   */
  function _getBuyPrice(floor, rarity, isBlackMarket) {
    var basePrices = {
      'common': { min: 20, max: 40 },
      'uncommon': { min: 60, max: 110 },
      'rare': { min: 200, max: 350 },
      'impossible': { min: 800, max: 1500 }
    };

    // Floor tier scaling
    var tierMultiplier = 1.0;
    if (floor > 7) {
      tierMultiplier = 2.0;
    } else if (floor > 3) {
      tierMultiplier = 1.5;
    }

    // Late game inflation
    if (floor > 8) {
      tierMultiplier *= 1.25;
    }

    var priceRange = basePrices[rarity] || basePrices['common'];
    var basePrice = (Math.random() * (priceRange.max - priceRange.min)) + priceRange.min;
    basePrice *= tierMultiplier;

    // Black market inflation
    if (isBlackMarket) {
      basePrice *= BLACK_MARKET_CONFIG.priceInflation;
    }

    return Math.floor(basePrice);
  }

  /**
   * Calculate sell price for a card
   */
  function calculateSellPrice(card) {
    var basePrices = {
      'common': { min: 8, max: 14 },
      'uncommon': { min: 22, max: 40 },
      'rare': { min: 70, max: 140 },
      'impossible': { min: 400, max: 1000 }
    };

    var base = basePrices[card.rarity] || basePrices['common'];
    var randomFactor = (Math.random() * (base.max - base.min)) + base.min;
    var basePrice = Math.floor(randomFactor);

    // Apply modifiers
    var modifier = 1.0;

    if (card.lifecycleType === 'disposable') {
      modifier += 0.20;  // +20% for single-use
    } else if (card.lifecycleType === 'exhaust') {
      modifier += 0.10;  // +10% for exhaust
    } else if (card.lifecycleType === 'power') {
      modifier += 0.30;  // +30% for power cards
    }

    return Math.floor(basePrice * modifier);
  }

  /**
   * Generate a random card appropriate for the floor
   */
  function _generateRandomCard(floor, isBlackMarket) {
    if (typeof CardSystem === 'undefined') {
      return null;
    }

    // Roll for rarity
    var roll = Math.random();
    var rarity;

    if (isBlackMarket) {
      // Black market: more rare/impossible items
      if (roll < 0.05) {
        rarity = 'impossible';
      } else if (roll < 0.25) {
        rarity = 'rare';
      } else if (roll < 0.50) {
        rarity = 'uncommon';
      } else {
        rarity = 'common';
      }
    } else {
      // Standard shop: mostly common/uncommon
      if (roll < 0.01) {
        rarity = 'impossible';
      } else if (roll < 0.08) {
        rarity = 'rare';
      } else if (roll < 0.30) {
        rarity = 'uncommon';
      } else {
        rarity = 'common';
      }
    }

    // Generate card
    return CardSystem.generateCard({ rarity: rarity, floor: floor });
  }

  /**
   * Get random gamble type
   */
  function _getRandomGambleType() {
    var roll = Math.random();

    // Weighted probabilities:
    // Standard: 50% (0.0 - 0.5)
    // Cursed: 25% (0.5 - 0.75)
    // Binary: 15% (0.75 - 0.9)
    // Empty: 10% (0.9 - 1.0)

    if (roll < 0.50) {
      return 'standard';
    } else if (roll < 0.75) {
      return 'cursed';
    } else if (roll < 0.90) {
      return 'binary';
    } else {
      return 'empty';
    }
  }

  /**
   * Generate gradient seed for gambling visual
   */
  function _generateGradientSeed() {
    return Math.random().toString(36).substring(2, 15);
  }

  /**
   * Get number of visible cards for UI
   */
  function _getVisibleCount() {
    // Mobile vs desktop detection
    var isMobile = window.innerWidth < 768;
    return isMobile ? 4 : 6;
  }

  /**
   * Render shop UI
   */
  function _renderShop(shop, playerCurrency, playerHand, playerInventory, playerActionBar) {
    var html = '';

    // Shop header
    html += _renderShopHeader(shop, playerCurrency);

    // Shop items row
    html += _renderShopItemsRow(shop, playerCurrency, playerInventory, playerActionBar);

    // Player sell fan (not for black market)
    if (shop.type !== SHOP_TYPES.BLACK_MARKET) {
      html += _renderPlayerSellFan(playerHand);
    } else {
      html += _renderBlackMarketNotice();
    }

    // Minimize button
    html += '<button class="shop-minimize-btn" data-action="close-shop">▼</button>';

    _shopContainer.innerHTML = html;
    _shopContainer.className = 'shop-root shop-' + shop.type;
  }

  /**
   * Render shop header
   */
  function _renderShopHeader(shop, playerCurrency) {
    var shopName = shop.type === SHOP_TYPES.BLACK_MARKET
      ? '⚠️ BLACK MARKET'
      : '🏪 MERCHANT';

    return '<div class="shop-header">' +
      '<div class="shop-title">' + shopName + '</div>' +
      '<div class="shop-currency">' +
        '<span class="currency-icon">💰</span>' +
        '<span class="currency-value">' + playerCurrency + '¢</span>' +
      '</div>' +
    '</div>';
  }

  /**
   * Render shop items row
   */
  function _renderShopItemsRow(shop, playerCurrency, playerInventory, playerActionBar) {
    var html = '<div class="shop-items-row">';

    // Check if shop is depleting (less than 5 items total)
    var isDepleting = shop.inventory.length < 5;
    var arrowsDisabled = isDepleting;

    // Cycle arrows
    html += '<div class="cycle-arrow-container">';
    html += '<button class="cycle-btn cycle-left" data-action="cycle-left"' +
      (shop.visibleStart === 0 || arrowsDisabled ? ' disabled' : '') + '>◀</button>';
    html += '<button class="cycle-btn cycle-right" data-action="cycle-right"' +
      (shop.visibleStart + shop.visibleCount >= shop.inventory.length || arrowsDisabled ? ' disabled' : '') + '>▶</button>';
    html += '</div>';

    // Card container
    html += '<div class="shop-card-container">';

    var visibleItems = shop.inventory.slice(shop.visibleStart, shop.visibleStart + shop.visibleCount);
    var spaceState = _checkSpaceAvailability(playerInventory, playerActionBar,
      (typeof GAMESTATE !== 'undefined' ? GAMESTATE.getState().cardHand : []));

    // Render visible items
    for (var i = 0; i < visibleItems.length; i++) {
      var item = visibleItems[i];
      html += _renderShopCard(item, playerCurrency, spaceState);
    }

    // Add empty placeholders if shop is depleting
    if (isDepleting) {
      var emptySlots = shop.visibleCount - visibleItems.length;
      for (var j = 0; j < emptySlots; j++) {
        html += _renderEmptySlot();
      }
    }

    html += '</div>'; // shop-card-container
    html += '</div>'; // shop-items-row

    return html;
  }

  /**
   * Render empty shop slot placeholder
   */
  function _renderEmptySlot() {
    return '<div class="shop-card empty-slot" title="SOLD OUT">' +
      '<div class="empty-slot-content">' +
        '<div class="sold-out-label">SldOt</div>' +
        '<div class="sold-out-icon">📦</div>' +
      '</div>' +
    '</div>';
  }

  /**
   * Render a single shop card
   */
  function _renderShopCard(item, playerCurrency, spaceState) {
    var canAfford = playerCurrency >= item.price;
    var hasSpace = spaceState.hasSpace;
    var disabled = !canAfford || !hasSpace;

    var priceClass = canAfford ? 'affordable' : 'too-expensive';
    var disabledClass = disabled ? 'disabled' : '';
    var gambleClass = item.type === 'gamble' ? 'gamble-card' : '';

    // Gradient style for gambling cards
    var cardStyle = '';
    if (item.type === 'gamble' && item.gradientSeed) {
      cardStyle = _getGambleGradientStyle(item.gambleType, item.gradientSeed);
    }

    // Make card draggable if not disabled
    var draggableAttr = disabled ? '' : ' draggable="true"';

    var html = '<div class="shop-card ' + disabledClass + ' ' + gambleClass + '" ' +
      'data-item-id="' + item.id + '" ' +
      'data-price="' + item.price + '" ' +
      'data-type="' + item.type + '"' +
      'data-card-name="' + (item.name || 'Unknown') + '"' +
      draggableAttr +
      (cardStyle ? ' style="' + cardStyle + '"' : '') +
      '>';

    // Price label
    html += '<div class="price-label ' + priceClass + '">' + item.price + '¢</div>';

    // Card thumbnail
    html += '<div class="card-thumbnail">';
    html += '<div class="rarity-frame ' + item.rarity + '">';
    html += '<span class="card-emoji">' + item.emoji + '</span>';
    html += '</div>';
    html += '<div class="card-abbr-name">' + _getAbbreviatedName(item.name) + '</div>';
    html += '</div>';

    // Disabled reason tooltip
    if (disabled) {
      var reason = !canAfford ? 'INSUFFICIENT FUNDS' : 'NO SPACE';
      html += '<div class="disabled-reason">' + reason + '</div>';
    }

    html += '</div>';

    return html;
  }

  /**
   * Get gradient style for gambling cards
   */
  function _getGambleGradientStyle(gambleType, seed) {
    var gradients = {
      'standard': 'background: linear-gradient(135deg, #4CAF50 0%, #FFD700 50%, #4CAF50 100%);',
      'cursed': 'background: linear-gradient(135deg, #8B0000 0%, #000000 50%, #8B0000 100%);',
      'binary': 'background: linear-gradient(135deg, #FFFFFF 0%, #000000 50%, #FFFFFF 100%);',
      'empty': 'background: linear-gradient(135deg, #444 0%, #222 50%, #444 100%);'
    };

    return gradients[gambleType] || gradients['standard'];
  }

  /**
   * Get abbreviated card name (with vowel-drop convention)
   * Uses NameUtils if available, falls back to local implementation
   * @param {string} name - Full name
   * @returns {string} Abbreviated name (max 6 chars for shop display)
   */
  function _getAbbreviatedName(name) {
    // Use NameUtils if available
    if (typeof NameUtils !== 'undefined') {
      return NameUtils.formatForShop(name);
    }

    // Fallback to local _abbreviateName
    return _abbreviateName(name);
  }

  /**
   * Abbreviate card name (vowel-dropped) - FALLBACK
   * Keeps first letter of each word, even if it's a vowel
   * Removes vowels from remaining positions within each word
   * Example: "Sold Out" → "SldOt", "Energy Drink" → "EnrgyD" (with 6-char limit)
   */
  function _abbreviateName(name) {
    if (!name) return '';

    // Split into words, process each word
    var words = name.split(/\s+/);
    var result = '';

    for (var i = 0; i < words.length; i++) {
      var word = words[i];
      if (word.length === 0) continue;

      // Take first character of word (even if vowel)
      result += word.charAt(0);

      // Remove vowels from remaining characters in this word
      for (var j = 1; j < word.length; j++) {
        var char = word.charAt(j);
        var lower = char.toLowerCase();
        if (lower !== 'a' && lower !== 'e' && lower !== 'i' && lower !== 'o' && lower !== 'u') {
          result += char;
        }
      }
    }

    // Limit to 6 chars for shop display
    return result.substring(0, 6);
  }

  /**
   * Render player sell fan
   */
  function _renderPlayerSellFan(playerHand) {
    var html = '<div class="player-sell-fan">';
    html += '<div class="fan-header">SELL CARDS</div>';
    html += '<div class="fan-cards">';

    for (var i = 0; i < playerHand.length; i++) {
      var card = playerHand[i];
      var sellPrice = calculateSellPrice(card);

      html += '<div class="sell-card" data-card-id="' + (card.id || i) + '" data-sell-price="' + sellPrice + '">';
      html += '<div class="sell-price">' + sellPrice + '¢</div>';
      html += '<div class="sell-emoji">' + card.emoji + '</div>';
      html += '</div>';
    }

    html += '</div>'; // fan-cards
    html += '</div>'; // player-sell-fan

    return html;
  }

  /**
   * Render black market notice (no selling)
   */
  function _renderBlackMarketNotice() {
    return '<div class="black-market-notice">' +
      '<span class="notice-icon">⚠️</span>' +
      '<span class="notice-text">NO SELLING. SPEND OR GAMBLE ONLY.</span>' +
    '</div>';
  }

  /**
   * Check space availability
   */
  function _checkSpaceAvailability(inventory, actionBar, hand) {
    var MAX_HAND = 5;
    var MAX_ACTION_BAR = 4;
    var MAX_INVENTORY = 12;

    var handFull = hand.length >= MAX_HAND;
    var actionBarFull = actionBar.length >= MAX_ACTION_BAR;
    var inventoryFull = inventory.length >= MAX_INVENTORY;

    return {
      handFull: handFull,
      actionBarFull: actionBarFull,
      inventoryFull: inventoryFull,
      hasSpace: !handFull || !actionBarFull || !inventoryFull
    };
  }

  /**
   * Handle shop click events
   */
  function _handleShopClick(e) {
    var target = e.target;

    // Find closest action element
    while (target && target !== _shopContainer) {
      var action = target.getAttribute('data-action');

      if (action === 'close-shop') {
        closeShop();
        return;
      } else if (action === 'cycle-left') {
        _cycleShop(-1);
        return;
      } else if (action === 'cycle-right') {
        _cycleShop(1);
        return;
      }

      // Check for shop card click (purchase)
      if (target.classList.contains('shop-card') && !target.classList.contains('disabled')) {
        _purchaseItem(target);
        return;
      }

      // Check for sell card click
      if (target.classList.contains('sell-card')) {
        _sellCard(target);
        return;
      }

      target = target.parentElement;
    }
  }

  /**
   * Handle touch events
   */
  function _handleShopTouch(e) {
    e.preventDefault();
    _handleShopClick(e);
  }

  /**
   * Cycle shop inventory
   */
  function _cycleShop(direction) {
    if (!_currentShop) {
      return;
    }

    _currentShop.visibleStart += direction;
    _currentShop.visibleStart = Math.max(0, _currentShop.visibleStart);
    _currentShop.visibleStart = Math.min(
      _currentShop.inventory.length - _currentShop.visibleCount,
      _currentShop.visibleStart
    );

    // Re-render shop
    var playerCurrency = (typeof GAMESTATE !== 'undefined')
      ? GAMESTATE.getState().cryptos
      : 0;
    var playerHand = (typeof GAMESTATE !== 'undefined')
      ? GAMESTATE.getState().cardHand
      : [];
    var playerInventory = (typeof GAMESTATE !== 'undefined')
      ? GAMESTATE.getLooseInventory()
      : [];
    var playerActionBar = (typeof GAMESTATE !== 'undefined')
      ? GAMESTATE.getState().actionButtonCards
      : [];

    _renderShop(_currentShop, playerCurrency, playerHand, playerInventory, playerActionBar);
  }

  /**
   * Purchase an item
   */
  function _purchaseItem(cardElement) {
    var itemId = cardElement.getAttribute('data-item-id');
    var itemType = cardElement.getAttribute('data-type');
    var price = parseInt(cardElement.getAttribute('data-price'), 10);

    // Find item in inventory
    var item = null;
    for (var i = 0; i < _currentShop.inventory.length; i++) {
      if (_currentShop.inventory[i].id === itemId) {
        item = _currentShop.inventory[i];
        break;
      }
    }

    if (!item) {
      console.error('[ShopSystem] Item not found:', itemId);
      return;
    }

    // Check if player can afford
    var playerState = GAMESTATE.getState();
    if (playerState.cryptos < price) {
      if (typeof MokUX !== 'undefined') {
        MokUX.speak("Not enough cryptos!", 'NEGATIVE');
      }
      return;
    }

    // Handle purchase based on type
    if (itemType === 'gamble') {
      _executeGamble(item);
    } else {
      _executePurchase(item);
    }
  }

  /**
   * Execute a purchase
   */
  function _executePurchase(item) {
    // Deduct currency
    if (typeof GAMESTATE !== 'undefined') {
      var currentCryptos = GAMESTATE.getState().cryptos;
      GAMESTATE.getState().cryptos = currentCryptos - item.price;

      // Add card to hand (priority delivery)
      if (item.cardData) {
        var hand = GAMESTATE.getState().cardHand;
        if (hand.length < 5) {
          hand.push(item.cardData);
        } else {
          // Try action bar
          var actionBar = GAMESTATE.getState().actionButtonCards;
          if (actionBar.length < 4) {
            actionBar.push(item.cardData);
          } else {
            // Try inventory
            var inventory = GAMESTATE.getLooseInventory();
            if (inventory.length < 12) {
              inventory.push(item.cardData);
            }
          }
        }
      }

      // Update UI
      if (typeof UIControls !== 'undefined' && UIControls.updateCurrency) {
        UIControls.updateCurrency(GAMESTATE.getState().cryptos);
      }
    }

    // Remove item from shop inventory
    var index = _currentShop.inventory.indexOf(item);
    if (index > -1) {
      _currentShop.inventory.splice(index, 1);
    }

    // MOK interjection
    if (typeof MokUX !== 'undefined') {
      MokUX.speak('Purchased ' + item.name + '!', 'POSITIVE');
    }

    // Re-render shop
    var playerCurrency = GAMESTATE.getState().cryptos;
    var playerHand = GAMESTATE.getState().cardHand;
    var playerInventory = GAMESTATE.getLooseInventory();
    var playerActionBar = GAMESTATE.getState().actionButtonCards;
    _renderShop(_currentShop, playerCurrency, playerHand, playerInventory, playerActionBar);
  }

  /**
   * Execute a gamble
   */
  function _executeGamble(item) {
    // Deduct currency
    if (typeof GAMESTATE !== 'undefined') {
      var currentCryptos = GAMESTATE.getState().cryptos;
      GAMESTATE.getState().cryptos = currentCryptos - item.price;

      // Roll for result
      var roll = _rollGamble(item.gambleType);

      // Add result to player
      if (roll.result) {
        var hand = GAMESTATE.getState().cardHand;
        if (hand.length < 5) {
          hand.push(roll.result);
        } else {
          var actionBar = GAMESTATE.getState().actionButtonCards;
          if (actionBar.length < 4) {
            actionBar.push(roll.result);
          } else {
            var inventory = GAMESTATE.getLooseInventory();
            if (inventory.length < 12) {
              inventory.push(roll.result);
            }
          }
        }
      }

      // Update UI
      if (typeof UIControls !== 'undefined' && UIControls.updateCurrency) {
        UIControls.updateCurrency(GAMESTATE.getState().cryptos);
      }
    }

    // Remove gamble from shop and shuffle
    var index = _currentShop.inventory.indexOf(item);
    if (index > -1) {
      _currentShop.inventory.splice(index, 1);
    }

    // Close and reopen shop (shuffle effect)
    setTimeout(function() {
      // Re-render to show shuffle
      var playerCurrency = GAMESTATE.getState().cryptos;
      var playerHand = GAMESTATE.getState().cardHand;
      var playerInventory = GAMESTATE.getLooseInventory();
      var playerActionBar = GAMESTATE.getState().actionButtonCards;
      _renderShop(_currentShop, playerCurrency, playerHand, playerInventory, playerActionBar);

      // MOK interjection
      if (typeof MokUX !== 'undefined' && roll.result) {
        MokUX.speak('You rolled: ' + roll.result.name + '!', 'POSITIVE');
      } else if (typeof MokUX !== 'undefined') {
        MokUX.speak('Nothing... better luck next time.', 'NEUTRAL');
      }
    }, 300);
  }

  /**
   * Roll for gamble result
   */
  function _rollGamble(gambleType) {
    var roll = Math.random();
    var result = null;

    if (gambleType === 'standard') {
      // Standard gambling roll table
      if (roll < 0.01) {
        result = _generateRandomCard(999, false); // Impossible rarity
      } else if (roll < 0.08) {
        result = _generateRandomCard(999, false); // Rare rarity
      } else if (roll < 0.30) {
        result = _generateRandomCard(999, false); // Uncommon rarity
      } else {
        result = _generateRandomCard(999, false); // Common rarity
      }
    } else if (gambleType === 'binary') {
      // Binary: 50/50 great or nothing
      if (roll < 0.50) {
        result = _generateRandomCard(999, false); // God tier (high quality)
      } else {
        result = null; // Catastrophic (nothing)
      }
    } else if (gambleType === 'empty') {
      // Empty: mostly nothing
      if (roll < 0.25) {
        result = _generateRandomCard(999, false); // Common
      } else {
        result = null; // Empty result
      }
    } else if (gambleType === 'cursed') {
      // Cursed: high chance of good cards but with risk
      if (roll < 0.40) {
        result = _generateRandomCard(999, false); // Common
      } else if (roll < 0.70) {
        result = _generateRandomCard(999, false); // Uncommon
      } else if (roll < 0.90) {
        result = _generateRandomCard(999, false); // Rare
      } else {
        result = _generateRandomCard(999, false); // Impossible
      }
    } else {
      // Default to standard
      result = _generateRandomCard(999, false);
    }

    return {
      roll: roll,
      result: result,
      type: gambleType
    };
  }

  /**
   * Sell a card
   */
  function _sellCard(cardElement) {
    var cardId = cardElement.getAttribute('data-card-id');
    var sellPrice = parseInt(cardElement.getAttribute('data-sell-price'), 10);

    if (typeof GAMESTATE !== 'undefined') {
      // Find and remove card from hand
      var hand = GAMESTATE.getState().cardHand;
      var cardIndex = -1;

      // First try to match by card ID if it exists
      for (var i = 0; i < hand.length; i++) {
        if (hand[i].id && hand[i].id === cardId) {
          cardIndex = i;
          break;
        }
      }

      // If no ID match, try array index as fallback
      // Note: This is fragile and should be avoided by always generating card IDs
      if (cardIndex === -1 && !isNaN(cardId)) {
        var indexAsNumber = parseInt(cardId, 10);
        if (indexAsNumber >= 0 && indexAsNumber < hand.length) {
          cardIndex = indexAsNumber;
        }
      }

      if (cardIndex > -1) {
        hand.splice(cardIndex, 1);

        // Add currency
        GAMESTATE.getState().cryptos += sellPrice;

        // Update UI
        if (typeof UIControls !== 'undefined' && UIControls.updateCurrency) {
          UIControls.updateCurrency(GAMESTATE.getState().cryptos);
        }

        // MOK interjection
        if (typeof MokUX !== 'undefined') {
          MokUX.speak('Sold for ' + sellPrice + '¢!', 'POSITIVE');
        }

        // Re-render shop
        var playerCurrency = GAMESTATE.getState().cryptos;
        var playerHand = GAMESTATE.getState().cardHand;
        var playerInventory = GAMESTATE.getLooseInventory();
        var playerActionBar = GAMESTATE.getState().actionButtonCards;
        _renderShop(_currentShop, playerCurrency, playerHand, playerInventory, playerActionBar);
      }
    }
  }

  /**
   * Check if shop is currently open
   */
  function isOpen() {
    return _isOpen;
  }

  /**
   * Get current shop state
   */
  function getCurrentShop() {
    return _currentShop;
  }

  // Public API
  return {
    init: init,
    shouldSpawnShop: shouldSpawnShop,
    openShop: openShop,
    closeShop: closeShop,
    isOpen: isOpen,
    getCurrentShop: getCurrentShop,
    calculateSellPrice: calculateSellPrice,
    SHOP_TYPES: SHOP_TYPES
  };
})();
