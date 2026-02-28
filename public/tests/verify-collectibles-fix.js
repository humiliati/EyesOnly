#!/usr/bin/env node

/**
 * Automated verification script for collectibles dual-render bug fixes
 *
 * Checks that the fixes are properly applied in the codebase:
 * 1. Currency rendering checks for collected flag
 * 2. Item rendering uses deduplication
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

function main() {
  log('\n═══════════════════════════════════════════════════════', 'cyan');
  log('Collectibles Dual-Render Bug Fix Verification', 'cyan');
  log('═══════════════════════════════════════════════════════\n', 'cyan');

  const mobileJsPath = path.join(__dirname, '..', 'js', 'gone-rogue-mobile.js');
  const testHtmlPath = path.join(__dirname, 'test-collectibles-dual-render-bug.html');
  const docPath = path.join(__dirname, '..', '..', 'COLLECTIBLES-BUG-FIX.md');

  let passCount = 0;
  let failCount = 0;

  // Test 1: Check for currency collected flag filter
  log('Test 1: Currency collected flag filter', 'blue');
  log('  Checking: gone-rogue-mobile.js has "if (currency.collected) return;"', 'yellow');
  if (checkPatternInFile(
    mobileJsPath,
    /currencies\.forEach\(function\(currency\)\s*\{[^}]*if\s*\(\s*currency\.collected\s*\)\s*return/,
    '  Currency rendering checks collected flag'
  )) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 2: Check for item position tracking
  log('\nTest 2: Item position deduplication', 'blue');
  log('  Checking: gone-rogue-mobile.js has "var itemPositions = {};"', 'yellow');
  if (checkPatternInFile(
    mobileJsPath,
    /var\s+itemPositions\s*=\s*\{\}/,
    '  Item position tracking initialized'
  )) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 3: Check items loop uses deduplication
  log('\nTest 3: Items array deduplication check', 'blue');
  log('  Checking: items.forEach checks itemPositions before rendering', 'yellow');
  if (checkPatternInFile(
    mobileJsPath,
    /items\.forEach\(function\(item\)\s*\{[^}]*var\s+posKey[^}]*if\s*\(\s*itemPositions\[posKey\]\s*\)/,
    '  Items rendering uses deduplication'
  )) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 4: Check interactive items loop uses deduplication
  log('\nTest 4: Interactive items deduplication check', 'blue');
  log('  Checking: interactiveItems.forEach checks itemPositions', 'yellow');
  if (checkPatternInFile(
    mobileJsPath,
    /interactiveItems\.forEach\(function\(item\)\s*\{[^}]*var\s+posKey[^}]*if\s*\(\s*itemPositions\[posKey\]\s*\)/,
    '  Interactive items rendering uses deduplication'
  )) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 5: Check visual test file exists
  log('\nTest 5: Visual test file', 'blue');
  log('  Checking: test-collectibles-dual-render-bug.html exists', 'yellow');
  if (checkFileExists(testHtmlPath)) {
    log('  ✓ PASS: Visual test file exists', 'green');
    passCount++;
  } else {
    log('  ✗ FAIL: Visual test file not found', 'red');
    failCount++;
  }

  // Test 6: Check documentation exists
  log('\nTest 6: Documentation', 'blue');
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
    log('\n✓ All verifications passed! Fixes are correctly applied.', 'green');
    process.exit(0);
  } else {
    log('\n✗ Some verifications failed. Please review the fixes.', 'red');
    process.exit(1);
  }
}

// Run the verification
main();
