/* ============================================================
   EYES ONLY - Resource Manager
   Validates and consumes card resources (ammo, focus, fatigue, battery, energy)
   ============================================================ */

const ResourceManager = (function() {
  'use strict';

  // Resource IDs
  var RESOURCE_IDS = {
    AMMO: 'ammo',
    FOCUS: 'focus',
    FATIGUE: 'fatigue',
    BATTERY: 'battery',
    ENERGY: 'energy'
  };

  /**
   * Check if player can afford a card's resource cost
   * @param {Object} card - Card definition with resourceCost property
   * @returns {Object} {canAfford: boolean, missingResources: Array}
   */
  function _normalizeCost(card) {
    if (!card) return null;

    // New: costs[] list
    if (Array.isArray(card.costs)) {
      var out = {};
      for (var i = 0; i < card.costs.length; i++) {
        var c = card.costs[i];
        if (!c || !c.kind) continue;
        var amt = Number(c.amount || 0);
        if (!isFinite(amt) || amt <= 0) continue;
        out[c.kind] = (out[c.kind] || 0) + amt;
      }
      return out;
    }

    // Legacy: resourceCost map
    if (card.resourceCost) return card.resourceCost;

    return null;
  }

  function canAffordCard(card) {
    var cost = _normalizeCost(card);
    if (!card || !cost) {
      return { canAfford: true, missingResources: [] };
    }

    var missing = [];
    var resources = _getCurrentResources();

    // Check ammo
    if (cost.ammo && resources.ammo < cost.ammo) {
      missing.push({
        resource: RESOURCE_IDS.AMMO,
        needed: cost.ammo,
        current: resources.ammo
      });
    }

    // Check focus
    if (cost.focus && resources.focus < cost.focus) {
      missing.push({
        resource: RESOURCE_IDS.FOCUS,
        needed: cost.focus,
        current: resources.focus
      });
    }

    // Check fatigue (works differently - cannot exceed max)
    if (cost.fatigue) {
      var maxFatigue = resources.maxFatigue || 100;
      if (resources.fatigue + cost.fatigue > maxFatigue) {
        missing.push({
          resource: RESOURCE_IDS.FATIGUE,
          needed: cost.fatigue,
          current: resources.fatigue,
          note: 'Would exceed maximum fatigue'
        });
      }
    }

    // Check battery
    if (cost.battery && resources.battery < cost.battery) {
      missing.push({
        resource: RESOURCE_IDS.BATTERY,
        needed: cost.battery,
        current: resources.battery
      });
    }

    // Check energy
    if (cost.energy && resources.energy < cost.energy) {
      missing.push({
        resource: RESOURCE_IDS.ENERGY,
        needed: cost.energy,
        current: resources.energy
      });
    }

    return {
      canAfford: missing.length === 0,
      missingResources: missing
    };
  }

  /**
   * Consume resources for playing a card
   * @param {Object} card - Card definition with resourceCost
   * @returns {boolean} Success status
   */
  function consumeResources(card) {
    var cost = _normalizeCost(card);
    if (!card || !cost) {
      return true;
    }

    // Validate affordability first
    var affordability = canAffordCard(card);
    if (!affordability.canAfford) {
      console.warn('[ResourceManager] Cannot afford card:', card.name, affordability.missingResources);
      return false;
    }

    // cost already normalized above

    // Consume resources via GAMESTATE
    if (typeof GAMESTATE === 'undefined') {
      console.error('[ResourceManager] GAMESTATE not available');
      return false;
    }

    if (cost.ammo && GAMESTATE.useAmmo) {
      GAMESTATE.useAmmo(cost.ammo);
    }

    if (cost.focus && GAMESTATE.loseFocus) {
      GAMESTATE.loseFocus(cost.focus);
    }

    if (cost.fatigue && GAMESTATE.addFatigue) {
      GAMESTATE.addFatigue(cost.fatigue);
    }

    if (cost.battery && GAMESTATE.useBattery) {
      GAMESTATE.useBattery(cost.battery);
    }

    if (cost.energy && GAMESTATE.useEnergy) {
      GAMESTATE.useEnergy(cost.energy);
    }

    console.log('[ResourceManager] Resources consumed for card:', card.name, cost);
    return true;
  }

  /**
   * Get current player resources from GAMESTATE
   * @returns {Object} Current resource levels
   */
  function _getCurrentResources() {
    if (typeof GAMESTATE === 'undefined') {
      return {
        ammo: 0,
        focus: 0,
        fatigue: 0,
        battery: 0,
        energy: 0,
        maxFatigue: 100
      };
    }

    return {
      ammo: GAMESTATE.getAmmo ? GAMESTATE.getAmmo() : 0,
      focus: GAMESTATE.getFocus ? GAMESTATE.getFocus() : 0,
      fatigue: GAMESTATE.getFatigue ? GAMESTATE.getFatigue() : 0,
      battery: GAMESTATE.getBattery ? GAMESTATE.getBattery() : 0,
      energy: GAMESTATE.getEnergy ? GAMESTATE.getEnergy() : 0,
      maxAmmo: GAMESTATE.getState ? GAMESTATE.getState().maxAmmo : 50,
      maxFocus: GAMESTATE.getState ? GAMESTATE.getState().maxFocus : 10,
      maxFatigue: GAMESTATE.getState ? GAMESTATE.getState().maxFatigue : 100,
      maxBattery: GAMESTATE.getState ? GAMESTATE.getState().maxBattery : 5,
      maxEnergy: GAMESTATE.getState ? GAMESTATE.getState().maxEnergy : 5
    };
  }

  /**
   * Get formatted resource shortage message
   * @param {Array} missingResources - Array from canAffordCard
   * @returns {string} Human-readable message
   */
  function getShortageMessage(missingResources) {
    if (!missingResources || missingResources.length === 0) {
      return '';
    }

    var parts = missingResources.map(function(r) {
      return r.resource + ' (' + r.current + '/' + r.needed + ')';
    });

    return 'Insufficient: ' + parts.join(', ');
  }

  /**
   * Get current resources for display
   * @returns {Object} Formatted resource data
   */
  function getCurrentResourcesForDisplay() {
    var resources = _getCurrentResources();
    
    return {
      primary: [
        { name: 'Energy', icon: '⚡', current: resources.energy, max: resources.maxEnergy },
        { name: 'Focus', icon: '🎯', current: resources.focus, max: resources.maxFocus }
      ],
      secondary: [
        { name: 'Battery', icon: '🔋', current: resources.battery, max: resources.maxBattery },
        { name: 'Fatigue', icon: '🏋️', current: resources.fatigue, max: resources.maxFatigue },
        { name: 'Ammo', icon: '⁍', current: resources.ammo, max: resources.maxAmmo }
      ]
    };
  }

  // Public API
  return {
    RESOURCE_IDS: RESOURCE_IDS,
    canAffordCard: canAffordCard,
    consumeResources: consumeResources,
    getShortageMessage: getShortageMessage,
    getCurrentResourcesForDisplay: getCurrentResourcesForDisplay
  };
})();
