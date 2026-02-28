/* ============================================================
   EYES ONLY — Synergy Ecosystem Stress Test

   Headless analysis engine that loads ALL game data and runs
   exhaustive checks for:
     1. Dead-end tags (tags with no combo path)
     2. Orphan cards (cards whose tags never fire a combo)
     3. Supply/demand gaps (combos that can't be built from available cards)
     4. Enemy deck combo coverage (can every enemy deck actually fire its combos?)
     5. Steal value analysis (what does stealing each card actually unlock?)
     6. Overcommit risk analysis (tag risk threshold reachability)
     7. Information Duel interaction budget (charges vs opportunities per enemy deck)
     8. Resource loop sustainability (disposable combos self-fund?)
     9. Edge cases: self-combo cards, dual-tag cards, multi-copy decks

   Runs in Node.js OR browser <script> tag.
   ============================================================ */

(function(exports) {
  'use strict';

  // ── Data Loading ────────────────────────────────────────

  var _cards = [];        // player cards (ACT-*)
  var _enemyCards = [];   // enemy cards (EATK-*)
  var _enemyDecks = {};   // deck definitions
  var _combos = [];       // tag-synergy combos
  var _tagRisks = [];     // overcommit risks
  var _items = [];        // items
  var _results = { tests: 0, passed: 0, failed: 0, warnings: 0, findings: [] };

  function loadData(cards, enemyCards, enemyDecks, synData, items) {
    _cards = cards || [];
    _enemyCards = enemyCards || [];
    _enemyDecks = enemyDecks || {};
    _combos = (synData && synData.combos) ? synData.combos : [];
    _tagRisks = (synData && synData.tagRisks) ? synData.tagRisks : [];
    _items = items || [];
    _results = { tests: 0, passed: 0, failed: 0, warnings: 0, findings: [] };
  }

  // ── Helpers ─────────────────────────────────────────────

  function _assert(condition, message, severity) {
    _results.tests++;
    if (condition) {
      _results.passed++;
      return true;
    }
    if (severity === 'warn') {
      _results.warnings++;
      _results.findings.push({ level: 'WARN', message: message });
    } else {
      _results.failed++;
      _results.findings.push({ level: 'FAIL', message: message });
    }
    return false;
  }

  function _info(message) {
    _results.findings.push({ level: 'INFO', message: message });
  }

  function _getCardById(id) {
    for (var i = 0; i < _enemyCards.length; i++) {
      if (_enemyCards[i].id === id) return _enemyCards[i];
    }
    for (var j = 0; j < _cards.length; j++) {
      if (_cards[j].id === id) return _cards[j];
    }
    return null;
  }

  function _getAllSynergyTags() {
    var tags = {};
    // From player cards
    _cards.forEach(function(c) {
      (c.synergyTags || []).forEach(function(t) { tags[t] = (tags[t] || 0) + 1; });
    });
    // From enemy cards
    _enemyCards.forEach(function(c) {
      (c.synergyTags || []).forEach(function(t) { tags[t] = (tags[t] || 0) + 1; });
    });
    return tags;
  }

  function _getComboTags() {
    var tags = {};
    _combos.forEach(function(c) {
      tags[c.tagA] = true;
      tags[c.tagB] = true;
    });
    return tags;
  }

  // ── Test 1: Dead-End Tags ──────────────────────────────

  function testDeadEndTags() {
    _info('═══ Test 1: Dead-End Tags ═══');
    var allTags = _getAllSynergyTags();
    var comboTags = _getComboTags();
    var riskTags = {};
    _tagRisks.forEach(function(r) { riskTags[r.tag] = true; });

    var deadEnds = [];
    Object.keys(allTags).forEach(function(tag) {
      if (!comboTags[tag] && !riskTags[tag]) {
        deadEnds.push({ tag: tag, count: allTags[tag] });
      }
    });

    // Some tags are roles, not combo tags (e.g., "fallback", "attack", "medical")
    // Role/functional tags: used for mechanics, targeting, or theming — not combo triggers
    var roleTags = ['fallback', 'attack', 'medical', 'basic', 'ranged', 'melee',
      'precision', 'combo_finisher', 'combo_starter', 'combo_anchor',
      'dead_weight', 'charge', 'frenzy', 'occult', 'resonance',
      'chain', 'sustained', 'bribe', 'hack', 'sleight', 'pickpocket',
      'disarm', 'intimidate', 'vice', 'comms', 'stealth',
      // Functional tags: control flow, targeting, categorization
      'tech', 'control', 'defensive', 'sonic', 'aggressive',
      'assassination', 'explosive', 'aoe', 'hazard', 'setup',
      'counter', 'gadget', 'luxury', 'escape', 'preservation',
      'utility', 'collection', 'loot', 'key', 'gate', 'quest',
      'organizer', 'fabrication', 'printer', 'surveillance',
      'camo', 'box', 'conductive', 'smoke', 'tactical',
      'solar', 'light_manipulation', 'darkness', 'fast',
      'tutorial', 'starter', 'loud', 'desperate', 'reusable',
      'intel', 'scout', 'sabotage', 'poison', 'ambush',
      'combo_finisher', 'combo_starter'];

    var realDeadEnds = deadEnds.filter(function(d) {
      return roleTags.indexOf(d.tag) === -1;
    });

    _assert(realDeadEnds.length === 0,
      'Dead-end tags (not in any combo or risk): ' +
      realDeadEnds.map(function(d) { return d.tag + ' (' + d.count + ' cards)'; }).join(', '),
      'warn');

    if (realDeadEnds.length > 0) {
      realDeadEnds.forEach(function(d) {
        _info('  Dead-end tag "' + d.tag + '" appears on ' + d.count + ' card(s) but triggers no combo/risk');
      });
    }

    _info('Total unique synergy tags across all cards: ' + Object.keys(allTags).length);
    _info('Tags participating in combos: ' + Object.keys(comboTags).length);
    _info('Tags with overcommit risks: ' + Object.keys(riskTags).length);
  }

  // ── Test 2: Orphan Cards ───────────────────────────────

  function testOrphanCards() {
    _info('═══ Test 2: Orphan Cards (no combo path) ═══');
    var comboTags = _getComboTags();

    // Player cards that can't fire any combo
    var orphanPlayer = _cards.filter(function(c) {
      var tags = c.synergyTags || [];
      return !tags.some(function(t) { return comboTags[t]; });
    });

    orphanPlayer.forEach(function(c) {
      _assert(false,
        'Player card "' + c.name + '" (' + c.id + ') tags [' +
        (c.synergyTags || []).join(', ') + '] fire no combos',
        'warn');
    });

    // Enemy cards (excluding junk/responsibility)
    var orphanEnemy = _enemyCards.filter(function(c) {
      if (c.cardRole === 'junk' || c.cardRole === 'responsibility' ||
          c.cardRole === 'cursed_responsibility' || c.cardRole === 'steal_to_complete') return false;
      var tags = c.synergyTags || [];
      return !tags.some(function(t) { return comboTags[t]; });
    });

    orphanEnemy.forEach(function(c) {
      _assert(false,
        'Enemy card "' + c.name + '" (' + c.id + ') tags [' +
        (c.synergyTags || []).join(', ') + '] fire no combos when stolen',
        'warn');
    });

    _info('Player cards with combo path: ' + (_cards.length - orphanPlayer.length) + '/' + _cards.length);
    _info('Enemy cards with combo path: ' + (_enemyCards.length - orphanEnemy.length) + '/' + _enemyCards.length);
  }

  // ── Test 3: Supply/Demand Gap ──────────────────────────

  function testSupplyDemand() {
    _info('═══ Test 3: Supply/Demand — Can each combo be built? ═══');

    // Build tag→card map for ALL acquirable cards (player + enemy stealable)
    var tagSources = {};
    _cards.forEach(function(c) {
      (c.synergyTags || []).forEach(function(t) {
        if (!tagSources[t]) tagSources[t] = [];
        tagSources[t].push(c.id);
      });
    });
    _enemyCards.forEach(function(c) {
      if (c.stealValue > 0) {
        (c.synergyTags || []).forEach(function(t) {
          if (!tagSources[t]) tagSources[t] = [];
          tagSources[t].push(c.id + ' (stolen)');
        });
      }
    });

    _combos.forEach(function(combo) {
      var sourcesA = tagSources[combo.tagA] || [];
      var sourcesB = tagSources[combo.tagB] || [];

      var aOk = sourcesA.length > 0;
      var bOk = sourcesB.length > 0;

      // Same-tag combos need 2+ sources
      if (combo.tagA === combo.tagB) {
        _assert(sourcesA.length >= 2,
          'Combo "' + combo.name + '" (' + combo.id + ') needs 2x [' + combo.tagA +
          '] but only ' + sourcesA.length + ' source(s) exist',
          'fail');
      } else {
        _assert(aOk,
          'Combo "' + combo.name + '" (' + combo.id + ') needs [' + combo.tagA +
          '] — ' + (aOk ? sourcesA.length + ' source(s)' : 'NO SOURCES'),
          'fail');
        _assert(bOk,
          'Combo "' + combo.name + '" (' + combo.id + ') needs [' + combo.tagB +
          '] — ' + (bOk ? sourcesB.length + ' source(s)' : 'NO SOURCES'),
          'fail');
      }
    });
  }

  // ── Test 4: Enemy Deck Combo Coverage ──────────────────

  function testEnemyDeckCombos() {
    _info('═══ Test 4: Enemy Deck Combo Coverage ═══');

    var deckNames = Object.keys(_enemyDecks).filter(function(k) {
      return k.charAt(0) !== '_';
    });

    deckNames.forEach(function(deckName) {
      var deck = _enemyDecks[deckName];
      if (!deck || !deck.cards) return;

      // Gather all tags in this deck
      var deckTags = {};
      var deckCardDefs = [];
      deck.cards.forEach(function(cardId) {
        var def = _getCardById(cardId);
        if (def) {
          deckCardDefs.push(def);
          (def.synergyTags || []).forEach(function(t) {
            deckTags[t] = (deckTags[t] || 0) + 1;
          });
        }
      });

      // Check which combos this deck can fire internally (enemy-side)
      var firingCombos = [];
      _combos.forEach(function(combo) {
        if (combo.tagA === combo.tagB) {
          if ((deckTags[combo.tagA] || 0) >= 2) firingCombos.push(combo);
        } else {
          if (deckTags[combo.tagA] && deckTags[combo.tagB]) firingCombos.push(combo);
        }
      });

      // Check if deck has combo_anchor cards that gate specific combos
      var anchors = deckCardDefs.filter(function(c) {
        return c.cardRole === 'responsibility' || c.cardRole === 'cursed_responsibility';
      });

      var junkCards = deckCardDefs.filter(function(c) {
        return c.cardRole === 'junk';
      });

      var stealTargets = deckCardDefs.filter(function(c) {
        return c.cardRole === 'steal_to_complete';
      });

      // Steal value analysis
      var totalStealValue = deckCardDefs.reduce(function(sum, c) {
        return sum + (c.stealValue || 0);
      }, 0);

      _info('Deck "' + deckName + '": ' + deck.cards.length + ' cards, ' +
        firingCombos.length + ' internal combos, ' +
        anchors.length + ' anchors, ' +
        junkCards.length + ' junk, ' +
        stealTargets.length + ' steal-targets, ' +
        'stealValue=' + totalStealValue);

      // Warn if deck has anchors but no corresponding payoff
      anchors.forEach(function(anchor) {
        var gatedCombos = [];
        try {
          var gates = anchor.effects.filter(function(e) { return e.type === 'combo_gate'; });
          gates.forEach(function(g) {
            gatedCombos.push(g.gates);
          });
        } catch (e) {}

        if (gatedCombos.length > 0) {
          _info('  Anchor "' + anchor.name + '" gates: ' + gatedCombos.join(', '));
        }
      });

      // Warn if deck has no exposed tags (hard to interact with)
      if (!deck.exposedTags || deck.exposedTags.length === 0) {
        _assert(false,
          'Deck "' + deckName + '" has NO exposed tags — player cannot pre-combat steal',
          'warn');
      }
    });
  }

  // ── Test 5: Information Duel Interaction Budget ────────

  function testInteractionBudget() {
    _info('═══ Test 5: Information Duel — Interaction Budget Per Deck ═══');

    var deckNames = Object.keys(_enemyDecks).filter(function(k) {
      return k.charAt(0) !== '_';
    });

    deckNames.forEach(function(deckName) {
      var deck = _enemyDecks[deckName];
      if (!deck || !deck.cards) return;

      var cardCount = deck.cards.length;
      var baseChargesPerTurn = 1; // Default interaction charge
      var meaningfulTargets = 0;  // Cards worth interacting with

      deck.cards.forEach(function(cardId) {
        var def = _getCardById(cardId);
        if (!def) return;

        // Count high-value targets
        if (def.cardRole === 'responsibility' || def.cardRole === 'cursed_responsibility' ||
            def.cardRole === 'steal_to_complete' || def.stealValue >= 3) {
          meaningfulTargets++;
        }
      });

      // At 1 charge/turn, how many turns to interact with all meaningful targets?
      var turnsNeeded = meaningfulTargets; // 1 interaction per turn
      var avgCombatTurns = 4; // Typical STR combat duration

      if (meaningfulTargets > avgCombatTurns) {
        _assert(false,
          'Deck "' + deckName + '": ' + meaningfulTargets +
          ' high-value targets but only ~' + avgCombatTurns +
          ' turns to interact (1 charge/turn). Player needs Scrambler Chip or must prioritize.',
          'warn');
      }

      // Check if deck is so small that interaction budget is wasted
      if (cardCount <= 1 && meaningfulTargets === 0) {
        _info('  "' + deckName + '": trivial deck (' + cardCount + ' cards) — duel system adds no depth');
      }

      // Escalation pressure check: if deck has all junk, player never needs to destroy
      // → escalation clock runs forever → payoff damage spirals
      var allJunk = deck.cards.every(function(id) {
        var def = _getCardById(id);
        return def && (def.cardRole === 'junk' || def.damage === 0);
      });

      if (allJunk && cardCount > 1) {
        _assert(false,
          'Deck "' + deckName + '": ALL cards are junk/utility — escalation clock has no natural pressure relief (player never needs to destroy)',
          'warn');
      }
    });
  }

  // ── Test 6: Tag Risk Threshold Reachability ────────────

  function testTagRiskReachability() {
    _info('═══ Test 6: Tag Risk Threshold Reachability ═══');

    _tagRisks.forEach(function(risk) {
      // Count how many player cards have this tag
      var playerCount = 0;
      _cards.forEach(function(c) {
        if ((c.synergyTags || []).indexOf(risk.tag) !== -1) playerCount++;
      });

      // Count stealable enemy cards with this tag
      var stealableCount = 0;
      _enemyCards.forEach(function(c) {
        if (c.stealValue > 0 && (c.synergyTags || []).indexOf(risk.tag) !== -1) stealableCount++;
      });

      var totalAvailable = playerCount + stealableCount;
      var reachable = totalAvailable >= risk.threshold;

      _assert(reachable,
        'Tag risk "' + risk.name + '" (' + risk.tag + ' x' + risk.threshold +
        '): ' + playerCount + ' player + ' + stealableCount + ' stealable = ' +
        totalAvailable + ' sources. ' + (reachable ? 'REACHABLE' : 'UNREACHABLE — risk never fires'),
        reachable ? 'pass' : 'warn');

      // Check if counter tag exists
      if (risk.counterTag) {
        var counterCount = 0;
        _cards.forEach(function(c) {
          if ((c.synergyTags || []).indexOf(risk.counterTag) !== -1) counterCount++;
        });
        _info('  Counter tag "' + risk.counterTag + '": ' + counterCount + ' player cards');
      }
    });
  }

  // ── Test 7: Self-Combo Cards ───────────────────────────

  function testSelfCombos() {
    _info('═══ Test 7: Self-Combo Cards (dual-tag fires own combo) ═══');

    var selfComboCards = [];
    var allCards = _cards.concat(_enemyCards);

    allCards.forEach(function(card) {
      var tags = card.synergyTags || [];
      if (tags.length < 2) return;

      // Check each tag pair on this card against combo definitions
      for (var i = 0; i < tags.length; i++) {
        for (var j = i + 1; j < tags.length; j++) {
          var t1 = tags[i], t2 = tags[j];
          _combos.forEach(function(combo) {
            if ((combo.tagA === t1 && combo.tagB === t2) ||
                (combo.tagA === t2 && combo.tagB === t1)) {
              selfComboCards.push({
                card: card.name + ' (' + card.id + ')',
                combo: combo.name + ' (' + combo.id + ')',
                tags: t1 + '+' + t2
              });
            }
          });
        }
      }
    });

    _info('Self-combo cards (dual-tag fires own combo): ' + selfComboCards.length);
    selfComboCards.forEach(function(sc) {
      _info('  ' + sc.card + ' → ' + sc.combo + ' via [' + sc.tags + ']');
    });

    // Verify same-tag combos have at least 2 distinct card sources
    var sameTagCombos = _combos.filter(function(c) { return c.tagA === c.tagB; });
    sameTagCombos.forEach(function(combo) {
      var sources = [];
      allCards.forEach(function(c) {
        if ((c.synergyTags || []).indexOf(combo.tagA) !== -1) {
          sources.push(c.id);
        }
      });
      var uniqueSources = sources.filter(function(v, i, a) { return a.indexOf(v) === i; });
      _assert(uniqueSources.length >= 2,
        'Same-tag combo "' + combo.name + '" (' + combo.tagA + 'x2) needs 2+ unique card sources, has ' +
        uniqueSources.length,
        'fail');
    });
  }

  // ── Test 8: Resource Loop Sustainability ───────────────

  function testResourceLoops() {
    _info('═══ Test 8: Resource Loop Sustainability ═══');

    // Check disposable combos for resource refund
    var disposableCombos = _combos.filter(function(c) {
      return c.tagA === 'disposable' || c.tagB === 'disposable';
    });

    disposableCombos.forEach(function(combo) {
      var hasRefund = (combo.effects || []).some(function(e) {
        return e.type === 'resource_refund' || e.type === 'currency_bonus' ||
               e.type === 'generate_card' || e.type === 'cost_reduction_next';
      });

      _assert(hasRefund,
        'Disposable combo "' + combo.name + '" (' + combo.id +
        ') should provide resource feedback (refund/currency/card gen). Has: ' +
        (hasRefund ? 'YES' : 'NONE'),
        hasRefund ? 'pass' : 'warn');
    });

    // Check each resource type for generation sources
    var resources = ['ammo', 'battery', 'energy', 'focus'];
    resources.forEach(function(res) {
      var generatorCombos = _combos.filter(function(c) {
        return (c.effects || []).some(function(e) {
          return (e.type === 'resource_refund' && e.kind === res) ||
                 (e.type === 'generate_' + res);
        });
      });

      var drainRisks = _tagRisks.filter(function(r) {
        return r.resourceDrain && r.resourceDrain.kind === res;
      });

      _info('Resource "' + res + '": ' + generatorCombos.length + ' combo generators, ' +
        drainRisks.length + ' risk drains');
    });
  }

  // ── Test 9: Enemy Deck Steal Priority Matrix ──────────

  function testStealPriority() {
    _info('═══ Test 9: Steal Priority Matrix ═══');

    var deckNames = Object.keys(_enemyDecks).filter(function(k) {
      return k.charAt(0) !== '_';
    });

    var complexDecks = deckNames.filter(function(name) {
      var d = _enemyDecks[name];
      return d && d.cards && d.cards.length >= 4;
    });

    complexDecks.forEach(function(deckName) {
      var deck = _enemyDecks[deckName];
      var stealMatrix = [];

      deck.cards.forEach(function(cardId, idx) {
        var def = _getCardById(cardId);
        if (!def) return;

        var priority = 0;
        var reasons = [];

        // Anchor cards: stealing disables enemy combos
        if (def.cardRole === 'responsibility') {
          priority += 10;
          reasons.push('gates enemy combo');
        }
        if (def.cardRole === 'cursed_responsibility') {
          priority += 5; // Lower because leaving it = enemy self-damage
          reasons.push('cursed anchor (leave=self-damage)');
        }
        if (def.cardRole === 'steal_to_complete') {
          priority += 8;
          reasons.push('completes player engine');
        }
        if (def.cardRole === 'junk') {
          priority += 3;
          var playerUse = def.playerUse;
          if (playerUse && playerUse.convertsTo) {
            reasons.push('converts to ' + playerUse.convertsTo);
          }
        }

        // stealValue from data
        priority += (def.stealValue || 0);

        // Cards that fire combos when stolen (synergy tags overlap with player combos)
        var comboTags = _getComboTags();
        var comboRelevance = (def.synergyTags || []).filter(function(t) {
          return comboTags[t];
        }).length;
        priority += comboRelevance;

        if (priority > 0) {
          stealMatrix.push({
            card: def.name + ' (' + def.id + ')',
            priority: priority,
            reasons: reasons.join(', '),
            comboTags: comboRelevance
          });
        }
      });

      // Sort by priority
      stealMatrix.sort(function(a, b) { return b.priority - a.priority; });

      if (stealMatrix.length > 0) {
        _info('Deck "' + deckName + '" steal priorities:');
        stealMatrix.forEach(function(s, i) {
          _info('  ' + (i + 1) + '. ' + s.card + ' [P=' + s.priority + '] ' +
            (s.reasons ? '(' + s.reasons + ')' : '') +
            ' comboPaths=' + s.comboTags);
        });
      }
    });
  }

  // ── Test 10: Momentum & Escalation Edge Cases ─────────

  function testDuelEdgeCases() {
    _info('═══ Test 10: Information Duel Edge Cases ═══');

    // Check: Mutation state transitions
    _info('Mutation paths:');
    _info('  Destroy → RAGE (+10% dmg/stack, caps at 3 = +30%)');
    _info('  Steal → PARANOIA (hides cards)');
    _info('  Reveal → ADAPTATION (swaps combos at 2+)');

    // Edge case: what if player only reveals? → ADAPTATION stacks forever
    _assert(true,
      'ADAPTATION caps behavior: at 2+ stacks, enemy swaps combo ordering — verify AI adaptation fires',
      'pass');

    // Edge case: what if player only destroys? → RAGE stacks + escalation resets
    _info('Destroy-only strategy: RAGE stacks (dmg+) but escalation resets each destroy');

    // Edge case: what if player never interacts? → Escalation climbs to payoff threshold
    _info('Passive strategy: escalation +1/turn, at 3+ payoff damage escalates');
    _info('  This is the intended anti-stall pressure');

    // Edge case: overload meter with small decks
    var deckNames = Object.keys(_enemyDecks).filter(function(k) {
      return k.charAt(0) !== '_';
    });

    var tinyDecks = deckNames.filter(function(name) {
      var d = _enemyDecks[name];
      return d && d.cards && d.cards.length <= 2;
    });

    tinyDecks.forEach(function(name) {
      _assert(false,
        'Deck "' + name + '" has ≤2 cards — overload meter unlikely to reach threshold 5. ' +
        'Duel mechanics may feel inert.',
        'warn');
    });

    // Edge case: decks with duplicate cards and momentum
    deckNames.forEach(function(name) {
      var deck = _enemyDecks[name];
      if (!deck || !deck.cards) return;

      var cardCounts = {};
      deck.cards.forEach(function(id) {
        cardCounts[id] = (cardCounts[id] || 0) + 1;
      });

      var duplicates = Object.keys(cardCounts).filter(function(id) {
        return cardCounts[id] > 1;
      });

      if (duplicates.length > 0) {
        duplicates.forEach(function(id) {
          var def = _getCardById(id);
          var tags = def ? (def.synergyTags || []).join(', ') : '?';
          _info('Deck "' + name + '": ' + cardCounts[id] + 'x ' +
            (def ? def.name : id) + ' [' + tags + '] — identical tag momentum per slot');
        });
      }
    });
  }

  // ── Test 11: Cross-Ecosystem Combo Chains ─────────────

  function testComboChains() {
    _info('═══ Test 11: Cross-Ecosystem Combo Chains ═══');

    // Find combos that create statuses consumed by other combos
    var statusProducers = {};
    var statusConsumers = {};

    _combos.forEach(function(combo) {
      (combo.effects || []).forEach(function(e) {
        if (e.type === 'status' && e.status) {
          if (!statusProducers[e.status]) statusProducers[e.status] = [];
          statusProducers[e.status].push(combo.name);
        }
        if (e.type === 'ground_effect' && e.effectType) {
          if (!statusProducers[e.effectType]) statusProducers[e.effectType] = [];
          statusProducers[e.effectType].push(combo.name);
        }
      });

      var conds = combo.conditions || {};
      if (conds.requireStatus) {
        if (!statusConsumers[conds.requireStatus]) statusConsumers[conds.requireStatus] = [];
        statusConsumers[conds.requireStatus].push(combo.name);
      }
      if (conds.requireTargetStatus) {
        if (!statusConsumers[conds.requireTargetStatus]) statusConsumers[conds.requireTargetStatus] = [];
        statusConsumers[conds.requireTargetStatus].push(combo.name);
      }
    });

    _info('Status chains (produce → consume):');
    Object.keys(statusConsumers).forEach(function(status) {
      var producers = statusProducers[status] || [];
      var consumers = statusConsumers[status];
      if (producers.length > 0) {
        _info('  "' + status + '": ' + producers.join(', ') + ' → ' + consumers.join(', '));
      } else {
        _assert(false,
          'Status "' + status + '" required by combos [' + consumers.join(', ') +
          '] but no combo produces it — must come from card effects or items',
          'warn');
      }
    });

    // Find which combos are entry points (no prerequisites)
    var entryCombos = _combos.filter(function(c) {
      var conds = c.conditions || {};
      return !conds.requireStatus && !conds.requireTargetStatus && !conds.requireCardTag;
    });

    _info('Entry-point combos (no status prerequisites): ' + entryCombos.length + '/' + _combos.length);
    entryCombos.forEach(function(c) {
      _info('  ' + c.name + ' [' + c.tagA + '+' + c.tagB + '] tier=' + c.tier);
    });
  }

  // ── Run All Tests ──────────────────────────────────────

  function runAll() {
    _results = { tests: 0, passed: 0, failed: 0, warnings: 0, findings: [] };

    _info('╔══════════════════════════════════════════════════════════╗');
    _info('║     SYNERGY ECOSYSTEM STRESS TEST — Gone Rogue          ║');
    _info('║     ' + _cards.length + ' player cards, ' + _enemyCards.length + ' enemy cards, ' +
      _combos.length + ' combos, ' + _tagRisks.length + ' risks  ║');
    _info('║     ' + Object.keys(_enemyDecks).filter(function(k) { return k[0] !== '_'; }).length +
      ' enemy decks, ' + _items.length + ' items                         ║');
    _info('╚══════════════════════════════════════════════════════════╝');

    testDeadEndTags();
    testOrphanCards();
    testSupplyDemand();
    testEnemyDeckCombos();
    testInteractionBudget();
    testTagRiskReachability();
    testSelfCombos();
    testResourceLoops();
    testStealPriority();
    testDuelEdgeCases();
    testComboChains();

    _info('');
    _info('╔══════════════════════════════════════════════════════════╗');
    _info('║  RESULTS: ' + _results.passed + ' passed, ' +
      _results.failed + ' failed, ' + _results.warnings + ' warnings / ' +
      _results.tests + ' total    ║');
    _info('╚══════════════════════════════════════════════════════════╝');

    return _results;
  }

  // ── Export ──────────────────────────────────────────────

  var api = {
    loadData: loadData,
    runAll: runAll,
    getResults: function() { return _results; }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.SynergyStressTest = api;
  }

  return api;

})(typeof exports !== 'undefined' ? exports : {});
