/* ============================================================
   EYES ONLY - Resource Color System Audit
   Validates canonical RESOURCE_COLOR mappings used by the debrief feed
   Run: node public/tests/test-resource-colors.js
   ============================================================ */

const fs   = require('fs');
const path = require('path');

function assert(condition, message) {
  if (condition) {
    console.log('\x1b[32m%s\x1b[0m', '✓ PASS: ' + message);
    return true;
  }
  console.error('\x1b[31m%s\x1b[0m', '✗ FAIL: ' + message);
  return false;
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    console.log('\x1b[32m%s\x1b[0m', '✓ PASS: ' + message);
    return true;
  }
  console.error(
    '\x1b[31m%s\x1b[0m',
    '✗ FAIL: ' + message + ' (expected: ' + expected + ', got: ' + actual + ')'
  );
  return false;
}

function loadColorMap() {
  var src = fs.readFileSync(
    path.join(__dirname, '..', 'js', 'debrief-feed-renderer.js'),
    'utf8'
  );

  var match = src.match(/var colors = \{([\s\S]*?)\n\s*\};/);
  if (!match) {
    throw new Error('Could not find RESOURCE_COLOR map in debrief-feed-renderer.js');
  }

  var block = match[1];
  var pairs = block.match(/'([^']+)'\s*:\s*'([^']+)'/g) || [];
  var colorMap = {};

  pairs.forEach(function(line) {
    var parts = line.match(/'([^']+)'\s*:\s*'([^']+)'/);
    if (parts && parts[1] && parts[2]) {
      colorMap[parts[1]] = parts[2];
    }
  });

  return colorMap;
}

function run() {
  console.log('========================================');
  console.log('TEST: Resource Color System Audit');
  console.log('========================================');

  var colors = loadColorMap();

  var expected = {
    HP: '#FF6B9D',
    Energy: '#00D4FF',
    Focus: '#FFF9B0',
    Battery: '#00FFA6',
    Fatigue: '#A0522D',
    Ammo: '#DA70D6',
    Currency: '#FFFF00',
    key_ammo: '#FF8A3D',
    Cards: '#800080'
  };

  Object.keys(expected).forEach(function(key) {
    assert(key in colors, key + ' color entry exists');
    assertEqual(colors[key], expected[key], key + ' color matches canon');
  });

  assertEqual(
    Object.keys(colors).length,
    Object.keys(expected).length,
    'No unexpected resource color entries are present'
  );
}

if (require.main === module) {
  run();
}

module.exports = { run };
