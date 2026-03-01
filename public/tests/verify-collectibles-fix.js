#!/usr/bin/env node

/**
 * Automated verification script for collectibles system fixes
 *
 * Phase 1 – WorldItems consolidation checks:
 * 1. WorldItems module exists
 * 2. gone-rogue.js uses WorldItems for floor items
 * 3. gone-rogue.js uses WorldItems for currencies
 * 4. gone-rogue-mobile.js uses WorldItems.getAllForRendering() as single render source
 * 5. itemPositions deduplication hack has been removed (superseded by WorldItems)
 * 6. Visual test file exists
 * 7. Documentation exists
 *
 * Run: node public/tests/verify-collectibles-fix.js
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

function checkFileExists(filepath) {
  try {
    fs.accessSync(filepath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function checkPatternInFile(filepath, pattern, description) {
  if (!checkFileExists(filepath)) {
    log(`✗ FAIL: File not found: ${filepath}`, 'red');
    return false;
  }

  const content = fs.readFileSync(filepath, 'utf8');
  const regex = new RegExp(pattern, 's'); // 's' flag for dotall mode

  if (regex.test(content)) {
    log(`✓ PASS: ${description}`, 'green');
    return true;
  } else {
    log(`✗ FAIL: ${description}`, 'red');
    return false;
  }
}

function checkPatternNotInFile(filepath, pattern, description) {
  if (!checkFileExists(filepath)) {
    log(`✗ FAIL: File not found: ${filepath}`, 'red');
    return false;
  }

  const content = fs.readFileSync(filepath, 'utf8');
  const regex = new RegExp(pattern, 's');

  if (!regex.test(content)) {
    log(`✓ PASS: ${description}`, 'green');
    return true;
  } else {
    log(`✗ FAIL: ${description} (pattern still present)`, 'red');
    return false;
  }
}

function main() {
  log('\n═══════════════════════════════════════════════════════', 'cyan');
  log('Collectibles System – Phase 1 WorldItems Verification', 'cyan');
  log('═══════════════════════════════════════════════════════\n', 'cyan');

  const worldItemsPath = path.join(__dirname, '..', 'js', 'world-items.js');
  const rogueJsPath    = path.join(__dirname, '..', 'js', 'gone-rogue.js');
  const mobileJsPath   = path.join(__dirname, '..', 'js', 'gone-rogue-mobile.js');
  const testHtmlPath   = path.join(__dirname, 'test-collectibles-dual-render-bug.html');
  const docPath        = path.join(__dirname, '..', '..', 'docs', 'COLLECTIBLES-BUG-FIX.md');

  let passCount = 0;
  let failCount = 0;

  // Test 1: WorldItems module exists
  log('Test 1: WorldItems module', 'blue');
  log('  Checking: world-items.js exists and exposes WorldItems', 'yellow');
  if (checkPatternInFile(
    worldItemsPath,
    /(var|const)\s+WorldItems\s*=\s*\(function/,
    '  WorldItems singleton module created'
  )) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 2: WorldItems exposes getAllForRendering
  log('\nTest 2: WorldItems.getAllForRendering', 'blue');
  log('  Checking: world-items.js has getAllForRendering function', 'yellow');
  if (checkPatternInFile(
    worldItemsPath,
    /function\s+getAllForRendering/,
    '  WorldItems.getAllForRendering() defined'
  )) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 3: gone-rogue.js delegates _items to WorldItems
  log('\nTest 3: gone-rogue.js uses WorldItems for floor items', 'blue');
  log('  Checking: _items = WorldItems.getFloorItems()', 'yellow');
  if (checkPatternInFile(
    rogueJsPath,
    /_items\s*=\s*WorldItems\.getFloorItems\(\)/,
    '  _items initialised from WorldItems.getFloorItems()'
  )) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 4: gone-rogue.js delegates _currencies to WorldItems
  log('\nTest 4: gone-rogue.js uses WorldItems for currencies', 'blue');
  log('  Checking: _currencies = WorldItems.getCurrencies()', 'yellow');
  if (checkPatternInFile(
    rogueJsPath,
    /_currencies\s*=\s*WorldItems\.getCurrencies\(\)/,
    '  _currencies initialised from WorldItems.getCurrencies()'
  )) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 5: gone-rogue-mobile.js uses WorldItems.getAllForRendering()
  log('\nTest 5: Renderer uses WorldItems.getAllForRendering()', 'blue');
  log('  Checking: gone-rogue-mobile.js calls WorldItems.getAllForRendering()', 'yellow');
  if (checkPatternInFile(
    mobileJsPath,
    /WorldItems\.getAllForRendering\(\)/,
    '  Renderer calls WorldItems.getAllForRendering() as single source'
  )) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 6: itemPositions deduplication hack removed
  log('\nTest 6: itemPositions hack removed', 'blue');
  log('  Checking: gone-rogue-mobile.js no longer uses itemPositions dedup', 'yellow');
  if (checkPatternNotInFile(
    mobileJsPath,
    /var\s+itemPositions\s*=\s*\{\}/,
    '  itemPositions deduplication hack removed (superseded by WorldItems)'
  )) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 7: Check visual test file exists
  log('\nTest 7: Visual test file', 'blue');
  log('  Checking: test-collectibles-dual-render-bug.html exists', 'yellow');
  if (checkFileExists(testHtmlPath)) {
    log('  ✓ PASS: Visual test file exists', 'green');
    passCount++;
  } else {
    log('  ✗ FAIL: Visual test file not found', 'red');
    failCount++;
  }

  // Test 8: Check documentation exists
  log('\nTest 8: Documentation', 'blue');
  log('  Checking: COLLECTIBLES-BUG-FIX.md exists', 'yellow');
  if (checkFileExists(docPath)) {
    log('  ✓ PASS: Documentation exists', 'green');
    passCount++;
  } else {
    log('  ✗ FAIL: Documentation not found', 'red');
    failCount++;
  }

  // Summary
  log('\n═══════════════════════════════════════════════════════', 'cyan');
  log('Summary', 'cyan');
  log('═══════════════════════════════════════════════════════\n', 'cyan');

  const totalTests = passCount + failCount;
  log(`Total tests: ${totalTests}`, 'blue');
  log(`Passed: ${passCount}`, 'green');
  log(`Failed: ${failCount}`, failCount > 0 ? 'red' : 'green');

  if (failCount === 0) {
    log('\n✓ All verifications passed! WorldItems Phase 1 is correctly implemented.', 'green');
    process.exit(0);
  } else {
    log('\n✗ Some verifications failed. Please review the WorldItems implementation.', 'red');
    process.exit(1);
  }
}

// Run the verification
main();
