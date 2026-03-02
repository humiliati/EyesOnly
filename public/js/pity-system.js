var PitySystem = (function() {
  'use strict';

  // ── Internal state ──
  var _recentCardDrops = [];
  var _pitySince = { defensive: 0, utility: 0, healing: 0 };

  function categorizeCardForPity(card) {
    if (!card) return 'other';
    var type = card.type || card.category || '';
    var name = card.name || '';
    if (type === 'defense' || name.match(/Block|Shield|Dodge|Cover|Evade|Prone/i)) return 'defensive';
    if (name.match(/Ration|Katchup|Medical|Heal|Health/i)) return 'healing';
    if (type === 'utility' || name.match(/Cigarette|Energy Drink|Retreat|Lure|Smoke/i)) return 'utility';
    return 'other';
  }

  function trackCardDrop(card, floor) {
    var category = categorizeCardForPity(card);
    _recentCardDrops.push({ type: card.type || 'unknown', category: category, floor: floor, name: card.name });
    if (_recentCardDrops.length > 5) _recentCardDrops.shift();
    if (category !== 'other') _pitySince[category] = 0;
  }

  function checkPityTimer() {
    var PITY_THRESHOLD = 3;
    for (var category in _pitySince) {
      if (_pitySince[category] >= PITY_THRESHOLD) return category;
    }
    return null;
  }

  function getPityCard(category, rng) {
    var pityCards = {
      defensive: ['Block', 'Dodge', 'PRONE', 'DIVE_FOR_COVER'],
      utility: ['CIGARETTES', 'RETREAT', 'LURE', 'ENERGY_DRINK'],
      healing: ['RATIONS', 'KATCHUP', 'MEDICAL_KIT']
    };
    var cards = pityCards[category] || [];
    if (cards.length === 0) return null;
    var rand = (typeof rng === 'function') ? rng() : Math.random();
    return cards[Math.floor(rand * cards.length)];
  }

  function incrementPityTimers() {
    for (var category in _pitySince) {
      _pitySince[category]++;
    }
  }

  // Reset for new run
  function reset() {
    _recentCardDrops = [];
    _pitySince = { defensive: 0, utility: 0, healing: 0 };
  }

  return {
    categorizeCardForPity: categorizeCardForPity,
    trackCardDrop: trackCardDrop,
    checkPityTimer: checkPityTimer,
    getPityCard: getPityCard,
    incrementPityTimers: incrementPityTimers,
    reset: reset
  };
})();
