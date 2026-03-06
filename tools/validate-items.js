#!/usr/bin/env node
/* ============================================================
   EYES ONLY — Item Pipeline Validator (Phase 2)
   Build-time validation for items.json + cross-references.

   Usage:  node tools/validate-items.js [--fix] [--quiet]
     --fix    Auto-sort items.json by ID (writes in-place)
     --quiet  Only print errors/warnings (skip info)

   Exit codes:
     0 = clean
     1 = errors found
   ============================================================ */

'use strict';

var fs   = require('fs');
var path = require('path');

// ── CLI flags ──

var args = process.argv.slice(2);
var FIX   = args.indexOf('--fix') !== -1;
var QUIET = args.indexOf('--quiet') !== -1;

// ── Paths ──

var ROOT       = path.resolve(__dirname, '..');
var ITEMS_PATH = path.join(ROOT, 'public', 'data', 'gone-rogue', 'items.json');
var CARDS_PATH = path.join(ROOT, 'public', 'data', 'gone-rogue', 'cards.json');
var ENV_SYN_PATH  = path.join(ROOT, 'public', 'js', 'environmental-synergy.js');
var GAMESTATE_PATH = path.join(ROOT, 'public', 'js', 'gamestate.js');
var GONE_ROGUE_PATH = path.join(ROOT, 'public', 'js', 'gone-rogue.js');

// ── Counters ──

var errors   = 0;
var warnings = 0;

function error(msg)   { errors++;   console.error('  ✗ ERROR: ' + msg); }
function warn(msg)    { warnings++; console.warn('  ⚠ WARN:  ' + msg); }
function info(msg)    { if (!QUIET) console.log('  ℹ ' + msg); }
function header(msg)  { console.log('\n━━ ' + msg + ' ━━'); }

// ── Load data ──

header('Loading data');

var rawItems;
try {
  rawItems = fs.readFileSync(ITEMS_PATH, 'utf8');
} catch (e) {
  console.error('FATAL: Cannot read ' + ITEMS_PATH);
  process.exit(1);
}

var items;
try {
  items = JSON.parse(rawItems);
} catch (e) {
  console.error('FATAL: items.json is not valid JSON — ' + e.message);
  process.exit(1);
}

if (!Array.isArray(items)) {
  console.error('FATAL: items.json root is not an array');
  process.exit(1);
}

info('Loaded ' + items.length + ' items from items.json');

// Load cards.json for cross-ref (optional)
var cards = [];
try {
  cards = JSON.parse(fs.readFileSync(CARDS_PATH, 'utf8'));
  if (!Array.isArray(cards)) cards = [];
  info('Loaded ' + cards.length + ' cards from cards.json');
} catch (e) {
  warn('Could not load cards.json — skipping card cross-references');
}

// ── Known enums ──

var VALID_TYPES     = ['consumable', 'equipment', 'key', 'deployable', 'resource'];
var VALID_SUBTYPES  = ['vice', 'gate', 'quest', null, undefined];
var VALID_RARITIES  = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
var VALID_SLOTS     = ['none', 'active', 'passive'];
var VALID_EFFECT_TYPES = [
  // Combat / stat
  'hp', 'focus',
  // Active item abilities
  'printer_3d', 'theft', 'reveal', 'destroy_card', 'auto_reveal',
  // Vision / stealth
  'darkness_accuracy_bonus', 'stealth_in_darkness_bonus',
  // Transform / disguise
  'avatar_transform', 'sightline_evasion_modifier', 'break_on_combat',
  // Key / gate
  'unlock_gate', 'quest_turn_in',
  // Hand management
  'sort_hand',
  // Cascade
  'cascade_enabler',
  // Collection
  'auto_collect',
  // Flight save
  'flight_save', 'flight_save_disposables',
  // Passive equipment
  'tag_risk_reduction', 'battery_save',
  'tag_risk_threshold_increase', 'exposure_resist',
  'fatigue_save', 'alert_reduction',
  'on_consume_card', 'consume_save',
  'momentum_visibility', 'reveal_momentum_threshold',
  'overload_damage_reduction', 'escalation_slow',
  'destroy_reduces_rage', 'destroy_momentum_bonus',
  'interaction_charge_bonus',
  // Swipe / instant
  'swipeActivate', 'instantResolve',
  // Player-driven manipulation (LAGM)
  'foresight_window', 'entropy_field',
  // ENI Phase 1: Enemy NCH capsule visibility & interaction
  'capsule_visibility_range', 'idle_reveal_speed',
  'steal_range_bonus', 'plant_range_bonus',
  'post_steal_awareness_reduction'
];

// ============================================================
//  1. SCHEMA VALIDATION
// ============================================================

header('1. Schema Validation');

var ID_RE = /^ITM-\d{3}$/;
var seenIds = {};

for (var i = 0; i < items.length; i++) {
  var it = items[i];
  var label = 'items[' + i + ']';

  if (!it || typeof it !== 'object') {
    error(label + ' is not an object');
    continue;
  }

  var id = it.id;
  label = id || label;

  // id
  if (!id) {
    error(label + ' missing "id"');
  } else if (!ID_RE.test(id)) {
    error(label + ' id "' + id + '" does not match ITM-XXX pattern');
  }

  // Duplicate ID
  if (id && seenIds[id]) {
    error(label + ' duplicate id (first at index ' + seenIds[id].index + ')');
  }
  if (id) seenIds[id] = { index: i, item: it };

  // Required string fields
  ['name', 'emoji', 'description'].forEach(function(key) {
    if (typeof it[key] !== 'string' || it[key].length === 0) {
      error(label + ' missing or empty "' + key + '"');
    }
  });

  // type enum
  if (!it.type) {
    error(label + ' missing "type"');
  } else if (VALID_TYPES.indexOf(it.type) === -1) {
    error(label + ' unknown type "' + it.type + '" — expected: ' + VALID_TYPES.join(', '));
  }

  // subtype (optional but must be valid if present)
  if (it.subtype && VALID_SUBTYPES.indexOf(it.subtype) === -1) {
    warn(label + ' unknown subtype "' + it.subtype + '" — expected: ' + VALID_SUBTYPES.filter(Boolean).join(', '));
  }

  // rarity enum
  if (!it.rarity) {
    error(label + ' missing "rarity"');
  } else if (VALID_RARITIES.indexOf(it.rarity) === -1) {
    error(label + ' unknown rarity "' + it.rarity + '" — expected: ' + VALID_RARITIES.join(', '));
  }

  // equipSlot enum
  if (it.equipSlot && VALID_SLOTS.indexOf(it.equipSlot) === -1) {
    error(label + ' unknown equipSlot "' + it.equipSlot + '" — expected: ' + VALID_SLOTS.join(', '));
  }

  // stackable / maxStack consistency
  if (typeof it.stackable !== 'boolean') {
    warn(label + ' missing "stackable" (boolean)');
  }
  if (it.stackable && (typeof it.maxStack !== 'number' || it.maxStack < 1)) {
    error(label + ' stackable=true but maxStack is ' + it.maxStack + ' (must be >= 1)');
  }
  if (!it.stackable && it.maxStack && it.maxStack > 1) {
    warn(label + ' stackable=false but maxStack=' + it.maxStack);
  }

  // effects array
  if (!Array.isArray(it.effects)) {
    warn(label + ' missing "effects" array (use [] for no effects)');
  }

  // synergyTags array
  if (!Array.isArray(it.synergyTags)) {
    warn(label + ' missing "synergyTags" array (use [] for none)');
  }

  // Tag arrays: validate type if present (stealTags, plantTags, revealTags, destroyTags)
  ['stealTags', 'plantTags', 'revealTags', 'destroyTags'].forEach(function(tagField) {
    if (it[tagField] !== undefined && !Array.isArray(it[tagField])) {
      fail(label + ' "' + tagField + '" should be an array');
    }
  });

  // Key-specific: tier + consumeOnUse
  if (it.type === 'key') {
    if (typeof it.tier !== 'number') {
      warn(label + ' type=key but no "tier" field');
    }
    if (typeof it.consumeOnUse !== 'boolean') {
      warn(label + ' type=key but no "consumeOnUse" field');
    }
  }
}

info(Object.keys(seenIds).length + ' unique IDs validated');

// ============================================================
//  2. EFFECT TYPE LINTER
// ============================================================

header('2. Effect Type Linter');

var unknownEffects = {};

for (var ei = 0; ei < items.length; ei++) {
  var eit = items[ei];
  if (!Array.isArray(eit.effects)) continue;

  for (var ej = 0; ej < eit.effects.length; ej++) {
    var eff = eit.effects[ej];
    if (!eff || typeof eff !== 'object') {
      error(eit.id + ' effects[' + ej + '] is not an object');
      continue;
    }
    if (!eff.type) {
      error(eit.id + ' effects[' + ej + '] missing "type"');
      continue;
    }
    if (VALID_EFFECT_TYPES.indexOf(eff.type) === -1) {
      error(eit.id + ' unknown effect type "' + eff.type + '"');
      unknownEffects[eff.type] = (unknownEffects[eff.type] || 0) + 1;
    }

    // Effect-specific param checks
    switch (eff.type) {
      case 'hp':
      case 'focus':
        if (typeof eff.value !== 'number') error(eit.id + ' effect "' + eff.type + '" missing "value" (number)');
        break;
      case 'unlock_gate':
        if (!Array.isArray(eff.compatibleGates))
          error(eit.id + ' effect "unlock_gate" missing "compatibleGates" array');
        else if (eff.compatibleGates.length === 0)
          warn(eit.id + ' effect "unlock_gate" has empty compatibleGates (decoy key?)');
        break;
      case 'quest_turn_in':
        if (!eff.npcTarget) error(eit.id + ' effect "quest_turn_in" missing "npcTarget"');
        if (!eff.rewardType) error(eit.id + ' effect "quest_turn_in" missing "rewardType"');
        break;
      case 'auto_collect':
        if (!eff.target) error(eit.id + ' effect "auto_collect" missing "target"');
        if (typeof eff.range !== 'number') error(eit.id + ' effect "auto_collect" missing "range" (number)');
        break;
      case 'avatar_transform':
        if (!eff.char) error(eit.id + ' effect "avatar_transform" missing "char"');
        if (!eff.sprite) error(eit.id + ' effect "avatar_transform" missing "sprite"');
        break;
      case 'cascade_enabler':
        if (!eff.condition) error(eit.id + ' effect "cascade_enabler" missing "condition"');
        if (!eff.effect) error(eit.id + ' effect "cascade_enabler" missing "effect"');
        break;
      case 'flight_save':
      case 'flight_save_disposables':
        if (typeof eff.saveRate !== 'number') error(eit.id + ' effect "' + eff.type + '" missing "saveRate" (number)');
        break;
      case 'tag_risk_reduction':
        if (!eff.tag) error(eit.id + ' effect "tag_risk_reduction" missing "tag"');
        if (typeof eff.reduction !== 'number') error(eit.id + ' effect "tag_risk_reduction" missing "reduction" (number)');
        break;
      case 'tag_risk_threshold_increase':
        if (!eff.tag) error(eit.id + ' effect "tag_risk_threshold_increase" missing "tag"');
        if (typeof eff.bonus !== 'number') error(eit.id + ' effect "tag_risk_threshold_increase" missing "bonus" (number)');
        break;
      case 'consume_save':
        if (typeof eff.rates !== 'object' || !eff.rates)
          error(eit.id + ' effect "consume_save" missing "rates" object');
        break;
      case 'on_consume_card':
        if (!eff.effect) error(eit.id + ' effect "on_consume_card" missing "effect"');
        break;
      case 'sightline_evasion_modifier':
        if (typeof eff.walk_bonus !== 'number') error(eit.id + ' effect "sightline_evasion_modifier" missing "walk_bonus" (number)');
        break;
      case 'reveal':
        if (!eff.mode) error(eit.id + ' effect "reveal" missing "mode"');
        break;
      case 'theft':
        if (!eff.mode) error(eit.id + ' effect "theft" missing "mode"');
        break;
      case 'destroy_card':
        if (!eff.mode) error(eit.id + ' effect "destroy_card" missing "mode"');
        break;
      case 'auto_reveal':
        if (typeof eff.count !== 'number') error(eit.id + ' effect "auto_reveal" missing "count" (number)');
        break;
      case 'alert_reduction':
        if (typeof eff.value !== 'number') error(eit.id + ' effect "alert_reduction" missing "value" (number)');
        break;
      case 'foresight_window':
        if (typeof eff.maxWindow !== 'number') error(eit.id + ' effect "foresight_window" missing "maxWindow" (number)');
        break;
      case 'entropy_field':
        if (typeof eff.strength !== 'number') error(eit.id + ' effect "entropy_field" missing "strength" (number)');
        break;
    }
  }
}

if (Object.keys(unknownEffects).length > 0) {
  info('Unknown effect types: ' + JSON.stringify(unknownEffects));
}

// ============================================================
//  3. DUPLICATE DETECTOR
// ============================================================

header('3. Duplicate Detector');

var nameMap  = {};   // name → [ids]
var emojiMap = {};   // emoji → [ids]

for (var di = 0; di < items.length; di++) {
  var dit = items[di];
  if (!dit || !dit.id) continue;

  if (dit.name) {
    if (!nameMap[dit.name]) nameMap[dit.name] = [];
    nameMap[dit.name].push(dit.id);
  }

  if (dit.emoji) {
    if (!emojiMap[dit.emoji]) emojiMap[dit.emoji] = [];
    emojiMap[dit.emoji].push(dit.id);
  }
}

// Flag duplicate names
var dupNames = 0;
for (var name in nameMap) {
  if (nameMap[name].length > 1) {
    error('Duplicate name "' + name + '" shared by: ' + nameMap[name].join(', '));
    dupNames++;
  }
}

// Flag shared emojis across different ID ranges (same range is fine — e.g. deployable boxes)
var dupEmojis = 0;
for (var emoji in emojiMap) {
  var ids = emojiMap[emoji];
  if (ids.length <= 1) continue;

  // Extract numeric ranges (first two digits)
  var ranges = {};
  ids.forEach(function(id) {
    var m = id.match(/ITM-(\d)\d\d/);
    var range = m ? m[1] : '?';
    if (!ranges[range]) ranges[range] = [];
    ranges[range].push(id);
  });

  if (Object.keys(ranges).length > 1) {
    warn('Emoji "' + emoji + '" shared across ID ranges: ' + ids.join(', '));
    dupEmojis++;
  }
}

if (dupNames === 0 && dupEmojis === 0) {
  info('No problematic duplicates found');
}

// ============================================================
//  4. ORPHAN DETECTOR
// ============================================================

header('4. Orphan Detector');

var registryIds = {};
items.forEach(function(it) { if (it && it.id) registryIds[it.id] = true; });

// 4a. env-synergy registryId cross-refs
var envSynSrc = '';
try {
  envSynSrc = fs.readFileSync(ENV_SYN_PATH, 'utf8');
} catch (e) {
  warn('Could not read environmental-synergy.js — skipping env-synergy orphan check');
}

if (envSynSrc) {
  var regIdMatches = envSynSrc.match(/registryId:\s*'(ITM-\d{3})'/g) || [];
  var envOrphans = 0;
  regIdMatches.forEach(function(m) {
    var id = m.match(/'(ITM-\d{3})'/)[1];
    if (!registryIds[id]) {
      error('env-synergy references ' + id + ' but it does not exist in items.json');
      envOrphans++;
    }
  });
  if (envOrphans === 0) info('All env-synergy registryId references resolve (' + regIdMatches.length + ' checked)');
}

// 4b. gamestate.js legacy fallback map
var gamestateSrc = '';
try {
  gamestateSrc = fs.readFileSync(GAMESTATE_PATH, 'utf8');
} catch (e) {
  warn('Could not read gamestate.js — skipping legacy map orphan check');
}

if (gamestateSrc) {
  var legacyMatches = gamestateSrc.match(/'(ITM-\d{3})'/g) || [];
  var gsOrphans = 0;
  legacyMatches.forEach(function(m) {
    var id = m.replace(/'/g, '');
    if (!registryIds[id]) {
      error('gamestate.js references ' + id + ' but it does not exist in items.json');
      gsOrphans++;
    }
  });
  if (gsOrphans === 0) info('All gamestate.js ITM-references resolve (' + legacyMatches.length + ' checked)');
}

// 4c. gone-rogue.js hardcoded ITM-refs (e.g. _BOX_DEPLOY_IDS)
var grSrc = '';
try {
  grSrc = fs.readFileSync(GONE_ROGUE_PATH, 'utf8');
} catch (e) {
  warn('Could not read gone-rogue.js — skipping box deploy orphan check');
}

if (grSrc) {
  var grMatches = grSrc.match(/'(ITM-\d{3})'/g) || [];
  var grOrphans = 0;
  grMatches.forEach(function(m) {
    var id = m.replace(/'/g, '');
    if (!registryIds[id]) {
      error('gone-rogue.js references ' + id + ' but it does not exist in items.json');
      grOrphans++;
    }
  });
  if (grOrphans === 0) info('All gone-rogue.js ITM-references resolve (' + grMatches.length + ' checked)');
}

// ============================================================
//  5. SORT ORDER CHECK (+ auto-fix)
// ============================================================

header('5. Sort Order');

var sorted = items.slice().sort(function(a, b) {
  if (!a || !a.id) return -1;
  if (!b || !b.id) return 1;
  return a.id.localeCompare(b.id);
});

var outOfOrder = false;
for (var si = 0; si < items.length; si++) {
  if (items[si].id !== sorted[si].id) {
    outOfOrder = true;
    break;
  }
}

if (outOfOrder) {
  if (FIX) {
    fs.writeFileSync(ITEMS_PATH, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
    info('Auto-sorted items.json by ID (--fix)');
  } else {
    warn('items.json is not sorted by ID. Run with --fix to auto-sort.');
  }
} else {
  info('items.json is sorted by ID ✓');
}

// ============================================================
//  6. ID GAP DETECTOR
// ============================================================

header('6. ID Gap Detector');

var usedNums = items.map(function(it) {
  var m = it && it.id ? it.id.match(/ITM-(\d{3})/) : null;
  return m ? parseInt(m[1], 10) : -1;
}).filter(function(n) { return n >= 0; }).sort(function(a, b) { return a - b; });

// Group into ranges and note gaps within each range
var ranges = {};
usedNums.forEach(function(n) {
  var decade = Math.floor(n / 10) * 10;
  if (!ranges[decade]) ranges[decade] = [];
  ranges[decade].push(n);
});

var gapReport = [];
for (var decade in ranges) {
  var nums = ranges[decade];
  var lo = nums[0];
  var hi = nums[nums.length - 1];
  for (var g = lo; g <= hi; g++) {
    if (nums.indexOf(g) === -1) {
      gapReport.push('ITM-' + String(g).padStart(3, '0'));
    }
  }
}

if (gapReport.length > 0) {
  info('Gaps in ID sequence (within active ranges): ' + gapReport.join(', '));
} else {
  info('No ID gaps within active ranges');
}

// Next available ID
var maxNum = usedNums.length > 0 ? usedNums[usedNums.length - 1] : -1;
info('Next available ID: ITM-' + String(maxNum + 1).padStart(3, '0'));

// ============================================================
//  SUMMARY
// ============================================================

header('Summary');
console.log('  Items:    ' + items.length);
console.log('  Errors:   ' + errors);
console.log('  Warnings: ' + warnings);

if (errors > 0) {
  console.log('\n  ✗ VALIDATION FAILED — ' + errors + ' error(s) found\n');
  process.exit(1);
} else if (warnings > 0) {
  console.log('\n  ⚠ Passed with ' + warnings + ' warning(s)\n');
  process.exit(0);
} else {
  console.log('\n  ✓ All checks passed\n');
  process.exit(0);
}
