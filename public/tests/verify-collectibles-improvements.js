#!/usr/bin/env node

/**
 * Automated verification script for collectibles system improvements
 *
 * Verifies:
 * 1. Twinkle alpha oscillation removed from gone-rogue-canvas.js
 * 2. Currency uses correct glyph (¢) not emoji
 * 3. Overhead animations start tight above player (-20px)
 * 4. Stacking uses tight vertical spacing (12px)
 * 5. Documentation exists
 *
 * Run: node public/tests/verify-collectibles-improvements.js
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
    log(`✗ FAIL: ${description}`, 'red');
    return false;
  }
}

function main() {
  log('\n═══════════════════════════════════════════════════════', 'cyan');
  log('Collectibles System Improvements Verification', 'cyan');
  log('═══════════════════════════════════════════════════════\n', 'cyan');

  const canvasJsPath = path.join(__dirname, '..', 'js', 'gone-rogue-canvas.js');
  const animatorJsPath = path.join(__dirname, '..', 'js', 'overhead-animator.js');
  const rogueJsPath = path.join(__dirname, '..', 'js', 'gone-rogue.js');
  const visualDocPath = path.join(__dirname, '..', '..', 'docs', 'COLLECTIBLES-VISUAL-SYSTEM.md');
  const bugFixDocPath = path.join(__dirname, '..', '..', 'docs', 'COLLECTIBLES-BUG-FIX.md');
  const roadmapDocPath = path.join(__dirname, '..', '..', 'docs', 'OVERHEAD-ANIMATION-UNIFIED-ROADMAP.md');

  let passCount = 0;
  let failCount = 0;

  // Test 1: Twinkle alpha oscillation removed
  log('Test 1: Twinkle alpha oscillation removed', 'blue');
  log('  Checking: gone-rogue-canvas.js no longer has globalAlpha twinkle', 'yellow');
  if (checkPatternNotInFile(
    canvasJsPath,
    /globalAlpha\s*=\s*0\.78\s*\+\s*0\.22/,
    '  Twinkle alpha oscillation removed'
  )) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 2: _twinklePhases removed
  log('\nTest 2: Twinkle phase tracking removed', 'blue');
  log('  Checking: gone-rogue-canvas.js no longer has _twinklePhases', 'yellow');
  if (checkPatternNotInFile(
    canvasJsPath,
    /var\s+_twinklePhases\s*=\s*\{\}/,
    '  Twinkle phase variable removed'
  )) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 3: _advanceTwinklePhases call removed
  log('\nTest 3: Twinkle phase advance removed', 'blue');
  log('  Checking: gone-rogue-canvas.js no longer calls _advanceTwinklePhases', 'yellow');
  if (checkPatternNotInFile(
    canvasJsPath,
    /_advanceTwinklePhases\(/,
    '  Twinkle phase advance call removed'
  )) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 4: Currency uses glyph not emoji in spawn
  log('\nTest 4: Currency uses correct glyph', 'blue');
  log('  Checking: gone-rogue.js currency has glyph: "¢"', 'yellow');
  if (checkPatternInFile(
    rogueJsPath,
    /glyph:\s*['"]¢['"]/,
    '  Currency glyph is ¢ (cent sign)'
  )) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 5: Overhead animations start tight above player
  log('\nTest 5: Overhead animations start tight (-20px)', 'blue');
  log('  Checking: overhead-animator.js CURRENCY_PICKUP starts at -20px', 'yellow');
  if (checkPatternInFile(
    animatorJsPath,
    /transform\.y\s*=\s*-20\s*-/,
    '  Currency pickup starts at -20px above player'
  )) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 6: Expression animations start tight
  log('\nTest 6: Expression animations start tight', 'blue');
  log('  Checking: overhead-animator.js EXPRESSION starts at -20px', 'yellow');
  if (checkPatternInFile(
    animatorJsPath,
    /EXPRESSION.*transform\.y\s*=\s*-20\s*-/s,
    '  Expression animations start at -20px'
  )) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 7: Stack spacing is tight (12px)
  log('\nTest 7: Stack spacing is tight (12px)', 'blue');
  log('  Checking: overhead-animator.js uses 12px stack spacing', 'yellow');
  if (checkPatternInFile(
    animatorJsPath,
    /\(idx\s*\*\s*12\)/,
    '  Stack spacing is 12px (tight but readable)'
  )) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 8: No horizontal spreading of stacks
  log('\nTest 8: No horizontal spreading of stacks', 'blue');
  log('  Checking: overhead-animator.js does not add to transform.x for stacks', 'yellow');
  if (checkPatternNotInFile(
    animatorJsPath,
    /stackIndex.*transform\.x\s*\+=/s,
    '  No horizontal spreading in stack rendering'
  )) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 9: Visual system documentation exists
  log('\nTest 9: Visual system documentation', 'blue');
  log('  Checking: COLLECTIBLES-VISUAL-SYSTEM.md exists', 'yellow');
  if (checkFileExists(visualDocPath)) {
    log('  ✓ PASS: Visual system documentation exists', 'green');
    passCount++;
  } else {
    log('  ✗ FAIL: Visual system documentation not found', 'red');
    failCount++;
  }

  // Test 10: Documentation covers emoji vs ASCII rules
  log('\nTest 10: Documentation covers emoji rules', 'blue');
  log('  Checking: COLLECTIBLES-VISUAL-SYSTEM.md documents emoji usage', 'yellow');
  if (checkPatternInFile(
    visualDocPath,
    /Emoji Collectibles.*Food Items.*Keys.*Monochrome ASCII/s,
    '  Documentation covers emoji vs ASCII rules'
  )) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 11: Bug fix documentation exists
  log('\nTest 11: Bug fix documentation', 'blue');
  log('  Checking: COLLECTIBLES-BUG-FIX.md exists', 'yellow');
  if (checkFileExists(bugFixDocPath)) {
    log('  ✓ PASS: Bug fix documentation exists', 'green');
    passCount++;
  } else {
    log('  ✗ FAIL: Bug fix documentation not found', 'red');
    failCount++;
  }

  // Test 12: OverheadAnimator integrated into canvas renderer (Phase 1 parity)
  log('\nTest 12: Canvas integrates OverheadAnimator (Phase 1)', 'blue');
  log('  Checking: gone-rogue-canvas.js pulls OverheadAnimator animations', 'yellow');
  if (checkPatternInFile(
    canvasJsPath,
    /OverheadAnimator\.getAllAnimations\(\)/,
    '  Canvas renderer pulls OverheadAnimator animations for parity'
  )) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 13: Renamed showStackedText API present (Phase 2)
  log('\nTest 13: OverheadAnimator.showStackedText canon (Phase 2)', 'blue');
  log('  Checking: showStackedText exported and legacy name absent', 'yellow');
  const hasStacked = checkPatternInFile(
    animatorJsPath,
    /showStackedText\s*:\s*showStackedText/,
    '  showStackedText export present'
  );
  const noLegacy = checkPatternNotInFile(
    animatorJsPath,
    /showPancakeStacks/,
    '  Legacy showPancakeStacks removed'
  );
  if (hasStacked && noLegacy) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 14: Roadmap documents Phase 1/2 completion
  log('\nTest 14: Roadmap documents Phase 1/2 completion', 'blue');
  log('  Checking: OVERHEAD-ANIMATION-UNIFIED-ROADMAP marks Phase 1/2 done', 'yellow');
  if (checkPatternInFile(
    roadmapDocPath,
    /Phase 1: Fix Rendering Parity.*✅ DONE[\s\S]*Phase 2: Fix Naming Confusion.*✅ DONE/s,
    '  Roadmap marks Phase 1 and Phase 2 as done'
  )) {
    passCount++;
  } else {
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
    log('\n✓ All verifications passed! Improvements are correctly applied.', 'green');
    log('\nKey Improvements:', 'cyan');
    log('  • Removed twinkle alpha effect (fixes lingering currency bug)', 'green');
    log('  • Currency uses ¢ glyph with yellow color (not emoji)', 'green');
    log('  • Animations start tight above player head (-20px)', 'green');
    log('  • Stacked items use tight 12px spacing', 'green');
    log('  • No horizontal spreading of stacked items', 'green');
    log('  • Comprehensive documentation added', 'green');
    process.exit(0);
  } else {
    log('\n✗ Some verifications failed. Please review the improvements.', 'red');
    process.exit(1);
  }
}

// Run the verification
main();
