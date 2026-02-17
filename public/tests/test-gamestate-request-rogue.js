/* ============================================================
   EYES ONLY - Test Harness for GAMESTATE.requestRogue()
   Manual browser console test for Gone Rogue transition routing
   ============================================================ */

(function () {
  'use strict';

  console.log('========================================');
  console.log('TEST: GAMESTATE.requestRogue()');
  console.log('========================================');

  // Save original modules
  var originalStreet = window.StreetChronicles;
  var originalRogue = window.GoneRogue;

  // Test counters
  var tests = {
    total: 0,
    passed: 0,
    failed: 0
  };

  function assert(condition, message) {
    tests.total++;
    if (condition) {
      tests.passed++;
      console.log('%c✓ PASS: ' + message, 'color: green; font-weight: bold');
      return true;
    } else {
      tests.failed++;
      console.error('%c✗ FAIL: ' + message, 'color: red; font-weight: bold');
      return false;
    }
  }

  function runTests() {
    console.log('\n--- Test 1: Mock Setup ---');

    // Create mock StreetChronicles
    window.StreetChronicles = {
      _mockActive: true,
      _mockInventory: ['item1', 'item2', 'item3'],
      _deactivateCalled: false,
      isActive: function () {
        return this._mockActive;
      },
      getInventory: function () {
        return this._mockInventory;
      },
      deactivate: function () {
        console.log('[MOCK] StreetChronicles.deactivate() called');
        this._deactivateCalled = true;
        this._mockActive = false;
        return true;
      }
    };

    // Create mock GoneRogue
    window.GoneRogue = {
      _startCalled: false,
      _startContext: null,
      start: function (context) {
        console.log('[MOCK] GoneRogue.start() called with context:', context);
        this._startCalled = true;
        this._startContext = context;
        return {
          lines: ['[MOCK] GONE ROGUE STARTED'],
          prompt: 'ROGUE> ',
          stayActive: true
        };
      }
    };

    assert(true, 'Mock modules created');

    console.log('\n--- Test 2: GAMESTATE.requestRogue exists ---');
    assert(
      typeof GAMESTATE !== 'undefined',
      'GAMESTATE module is available'
    );
    assert(
      typeof GAMESTATE.requestRogue === 'function',
      'GAMESTATE.requestRogue is a function'
    );

    console.log('\n--- Test 3: Call requestRogue with Street active ---');
    
    // Reset GAMESTATE
    if (typeof GAMESTATE.reset === 'function') {
      GAMESTATE.reset();
    }
    if (typeof GAMESTATE.init === 'function') {
      GAMESTATE.init();
    }

    // Call requestRogue
    var result = GAMESTATE.requestRogue({
      reason: 'test',
      carryInventory: true
    });

    console.log('Result:', result);

    // Verify StreetChronicles.deactivate was called
    assert(
      window.StreetChronicles._deactivateCalled,
      'StreetChronicles.deactivate() was called'
    );

    // Verify StreetChronicles is now inactive
    assert(
      !window.StreetChronicles.isActive(),
      'StreetChronicles is now inactive'
    );

    // Verify GoneRogue.start was called
    assert(
      window.GoneRogue._startCalled,
      'GoneRogue.start() was called'
    );

    // Verify result has expected shape
    assert(
      result && typeof result === 'object',
      'Result is an object'
    );
    assert(
      Array.isArray(result.lines),
      'Result.lines is an array'
    );
    assert(
      typeof result.prompt === 'string',
      'Result.prompt is a string'
    );
    assert(
      typeof result.stayActive === 'boolean',
      'Result.stayActive is a boolean'
    );

    console.log('\n--- Test 4: Call requestRogue with Street inactive ---');

    // Reset mocks
    window.StreetChronicles._mockActive = false;
    window.StreetChronicles._deactivateCalled = false;
    window.GoneRogue._startCalled = false;

    var result2 = GAMESTATE.requestRogue({
      reason: 'test2'
    });

    console.log('Result2:', result2);

    // Verify GoneRogue.start was still called
    assert(
      window.GoneRogue._startCalled,
      'GoneRogue.start() was called even when Street inactive'
    );

    // Verify result has expected shape
    assert(
      result2 && typeof result2 === 'object',
      'Result2 is an object'
    );

    console.log('\n========================================');
    console.log('TEST SUMMARY');
    console.log('========================================');
    console.log('Total:  ' + tests.total);
    console.log('%cPassed: ' + tests.passed, 'color: green; font-weight: bold');
    if (tests.failed > 0) {
      console.log('%cFailed: ' + tests.failed, 'color: red; font-weight: bold');
    } else {
      console.log('Failed: 0');
    }
    console.log('========================================');

    if (tests.failed === 0) {
      console.log('%c✓ ALL TESTS PASSED', 'color: green; font-weight: bold; font-size: 16px');
    } else {
      console.log('%c✗ SOME TESTS FAILED', 'color: red; font-weight: bold; font-size: 16px');
    }

    // Restore original modules
    console.log('\nRestoring original modules...');
    window.StreetChronicles = originalStreet;
    window.GoneRogue = originalRogue;
  }

  // Auto-run if GAMESTATE is loaded
  if (typeof GAMESTATE !== 'undefined') {
    runTests();
  } else {
    console.error('GAMESTATE not loaded. Include gamestate.js before running this test.');
  }
})();
