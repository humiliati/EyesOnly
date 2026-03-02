var Items = (function() {
  'use strict';

  var _items = [];
  var _breakables = [];
  var _currencies = [];
  var _shops = [];

  function getItems() {
    return _items;
  }

  function getBreakables() {
    return _breakables;
  }

  function getCurrencies() {
    return _currencies;
  }

  function getShops() {
    return _shops;
  }

  function _pickupItem() {
    // ... (pickup item logic)
  }

  function _kickBreakable(cmd) {
    // ... (kick breakable logic)
  }

  function _showVendor() {
    // ... (show vendor logic)
  }

  function _buyFromVendor(cmd) {
    // ... (buy from vendor logic)
  }

  return {
    getItems: getItems,
    getBreakables: getBreakables,
    getCurrencies: getCurrencies,
    getShops: getShops,
    pickupItem: _pickupItem,
    kickBreakable: _kickBreakable,
    showVendor: _showVendor,
    buyFromVendor: _buyFromVendor
  };
})();