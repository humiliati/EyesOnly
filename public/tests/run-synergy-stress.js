#!/usr/bin/env node
/* ============================================================
   Headless Node.js runner for Synergy Ecosystem Stress Test
   Usage: node public/tests/run-synergy-stress.js
   ============================================================ */

'use strict';

var fs = require('fs');
var path = require('path');

// Resolve data paths relative to project root
var dataDir = path.join(__dirname, '..', 'data', 'gone-rogue');

function loadJSON(filename) {
  var filepath = path.join(dataDir, filename);
  var raw = fs.readFileSync(filepath, 'utf8');
  return JSON.parse(raw);
}

// Load the test module
var SynergyStressTest = require('./test-synergy-stress.js');

// Load all game data
console.log('Loading game data...');
var cards = loadJSON('cards.json');
var enemyCards = loadJSON('enemy-cards.json');
var enemyDecks = loadJSON('enemy-decks.json');
var synData = loadJSON('tag-synergy-data.json');
var items = loadJSON('items.json');

console.log('  Player cards: ' + cards.length);
console.log('  Enemy cards: ' + enemyCards.length);
console.log('  Enemy decks: ' + Object.keys(enemyDecks).filter(function(k) { return k[0] !== '_'; }).length);
console.log('  Combos: ' + (synData.combos || []).length);
console.log('  Tag risks: ' + (synData.tagRisks || []).length);
console.log('  Items: ' + items.length);
console.log('');

// Run tests
SynergyStressTest.loadData(cards, enemyCards, enemyDecks, synData, items);
var results = SynergyStressTest.runAll();

// Print findings
results.findings.forEach(function(f) {
  var prefix = f.level === 'FAIL' ? '\x1b[31m✗ FAIL\x1b[0m' :
               f.level === 'WARN' ? '\x1b[33m⚠ WARN\x1b[0m' :
               f.level === 'INFO' ? '\x1b[90m  INFO\x1b[0m' :
               '\x1b[32m✓ PASS\x1b[0m';
  console.log(prefix + ' ' + f.message);
});

// Summary
console.log('');
console.log('═══════════════════════════════════════════');
console.log('  Passed:   \x1b[32m' + results.passed + '\x1b[0m');
console.log('  Failed:   \x1b[31m' + results.failed + '\x1b[0m');
console.log('  Warnings: \x1b[33m' + results.warnings + '\x1b[0m');
console.log('  Total:    ' + results.tests);
console.log('═══════════════════════════════════════════');

// Exit with failure code if any hard failures
process.exit(results.failed > 0 ? 1 : 0);
