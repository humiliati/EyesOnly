# Login Overlay UI Testing Suite

## Overview

The Login Overlay UI Testing Suite provides automated testing for the EyesOnly authentication portal across multiple viewports and devices. These tests validate that login and registration form fields behave correctly on desktop and mobile platforms.

## Test Files

### 1. test-login-overlay-ui.html (Simulation Mode)
**Purpose**: Standalone simulation-based tester for rapid validation
**Best For**: Quick checks, CI/CD integration, no backend required
**File Size**: ~25KB

### 2. test-login-overlay-integration.html (Integration Mode)
**Purpose**: Real iframe integration with the main application
**Best For**: Full DOM testing, realistic user interaction simulation
**File Size**: ~20KB

## Quick Start

### Running Tests in Browser

1. **Open a test file in your browser**:
   ```
   file:///path/to/EyesOnly/public/tests/test-login-overlay-ui.html
   ```
   or
   ```
   file:///path/to/EyesOnly/public/tests/test-login-overlay-integration.html
   ```

2. **Select your testing mode**:
   - Click "Run All Tests" for comprehensive coverage
   - Click "Test Desktop Only" for desktop-specific validation
   - Click "Test Mobile Only" for mobile viewports

3. **Review results**:
   - Real-time progress updates
   - Summary statistics (passed/failed/total)
   - Detailed test results with pass/fail indicators
   - Event log with timestamps

4. **Export results** (optional):
   - Click "Export Results" button
   - Saves JSON file with all test data
   - Useful for tracking and CI/CD integration

## Viewports Tested

| Viewport | Resolution | Type | Use Case |
|----------|-----------|------|----------|
| Desktop | 1280x720 | Desktop | Standard desktop/laptop |
| Mobile Portrait | 375x667 | Mobile | iPhone/Android portrait |
| Mobile Landscape | 667x375 | Mobile | iPhone/Android landscape |
| Tablet | 768x1024 | Tablet | iPad/Android tablet |

## What Gets Tested

### Desktop Tests
✅ **Field Click Enables Input**
- Verifies clicking a field allows text input
- Validates field receives focus
- Confirms traditional desktop UX

✅ **Text Input Works**
- Types test values into fields
- Verifies values are retained
- Checks field state remains correct

### Mobile Tests
✅ **Virtual Keyboard Triggers**
- Validates input type is mobile-optimized
- Confirms keyboard-triggering configuration
- Tests across portrait and landscape

✅ **Field Zoom Behavior**
- Checks if field zooms appropriately
- Validates viewport scaling
- Tests zoom returns to normal after input

✅ **Touch Interaction**
- Field responds to touch events
- Focus behavior works on mobile
- No stuck keyboard states

## Form Fields Covered

### Login Form
- `login-username` - Username input field

### Register Form
- `register-username` - Username input field (3-20 chars)
- `register-callsign` - Callsign input field (optional)
- `register-email` - Email input field (with validation)

## Test Results Format

### Console Output
```
[HH:MM:SS] ✓ PASS - Desktop - Login Username - Click Enables Input
[HH:MM:SS] ✓ PASS - Desktop - Login Username - Text Input
[HH:MM:SS] ✓ PASS - Mobile Portrait - Register Email - Mobile Keyboard
[HH:MM:SS] ✗ FAIL - Mobile Landscape - Register Username - Focus
```

### JSON Export Format
```json
{
  "timestamp": "2026-02-19T08:30:00.000Z",
  "viewport": {
    "name": "mobile-portrait",
    "width": 375,
    "height": 667,
    "isMobile": true
  },
  "summary": {
    "total": 16,
    "passed": 15,
    "failed": 1,
    "successRate": 93
  },
  "results": [
    {
      "name": "Desktop - Login Username - Click Enables Input",
      "field": "Login Username",
      "viewport": "Desktop (1280x720)",
      "test": "Click Enables Input",
      "passed": true,
      "details": {
        "fieldExists": true,
        "inputEnabled": true,
        "focusable": true
      }
    }
  ]
}
```

## Interpreting Results

### ✅ All Tests Pass
**Status**: Login overlay is working correctly across all viewports
**Action**: No action needed, authentication UX is solid

### ⚠️ Some Tests Fail on Mobile
**Status**: Mobile keyboard/zoom issues detected
**Common Causes**:
- Input fields missing proper `type` attribute
- Viewport meta tag blocking zoom
- CSS preventing focus
**Action**: Review mobile-specific field configuration

### ❌ Desktop Tests Fail
**Status**: Basic field interaction broken
**Common Causes**:
- Fields disabled in DOM
- JavaScript errors preventing input
- CSS hiding fields incorrectly
**Action**: Check browser console for errors, review field initialization

## Integration with CI/CD

### Automated Testing with Puppeteer

```javascript
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto('file:///path/to/test-login-overlay-integration.html');

  // Run tests
  await page.click('#run-all-btn');

  // Wait for completion
  await page.waitForSelector('#overall-status:not(.running)', { timeout: 30000 });

  // Extract results
  const results = await page.evaluate(() => {
    return JSON.parse(localStorage.getItem('test_results'));
  });

  console.log(`Tests: ${results.summary.passed}/${results.summary.total} passed`);

  await browser.close();

  process.exit(results.summary.failed > 0 ? 1 : 0);
})();
```

### GitHub Actions Workflow

```yaml
name: Login Overlay UI Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node
        uses: actions/setup-node@v2
        with:
          node-version: '16'
      - name: Install dependencies
        run: npm install puppeteer
      - name: Run Login Overlay Tests
        run: node scripts/run-login-tests.js
      - name: Upload Results
        if: always()
        uses: actions/upload-artifact@v2
        with:
          name: test-results
          path: test-results.json
```

## Common Issues and Solutions

### Issue: "Field not found in DOM"
**Solution**: Ensure login overlay is opened before testing fields
**Fix**: Call `showLoginOverlay()` or `showRegisterOverlay()` first

### Issue: "Cannot change viewport during test"
**Solution**: Wait for current test to complete before switching viewports
**Fix**: Tests automatically disable viewport switching while running

### Issue: Mobile keyboard tests always pass (simulation mode)
**Solution**: Simulation mode can't detect real keyboard behavior
**Fix**: Use integration mode or test on real mobile devices

### Issue: Tests hang on iframe load
**Solution**: Main application may have errors preventing load
**Fix**: Check browser console, ensure `index.html` is accessible

## Best Practices

1. **Run tests in multiple browsers**: Chrome, Firefox, Safari
2. **Test on real mobile devices**: Simulators can't catch all issues
3. **Run tests after UI changes**: Catch regressions early
4. **Export results for tracking**: Monitor trends over time
5. **Integrate with CI/CD**: Automate testing on every commit

## Extending the Tests

### Adding New Fields

Edit the `FIELDS` or `LOGIN_FIELDS` constant:

```javascript
const FIELDS = {
  login: [
    { id: 'login-username', name: 'Login Username Field', type: 'text' },
    { id: 'login-password', name: 'Login Password Field', type: 'password' } // NEW
  ]
};
```

### Adding New Viewports

Edit the `VIEWPORTS` configuration:

```javascript
const VIEWPORTS = {
  'desktop-4k': {
    width: 3840,
    height: 2160,
    name: 'Desktop 4K (3840x2160)',
    isMobile: false
  }
};
```

### Adding Custom Tests

Create new test functions following the pattern:

```javascript
async function testCustomBehavior(field, viewport) {
  const testName = `${viewport.name} - ${field.name} - Custom Test`;

  try {
    // Your test logic here
    const passed = /* your validation */;

    return {
      name: testName,
      field: field.name,
      viewport: viewport.name,
      test: 'Custom Test',
      passed: passed,
      details: { /* test details */ }
    };
  } catch (error) {
    return {
      name: testName,
      passed: false,
      error: error.message
    };
  }
}
```

## Related Documentation

- **Agent Engine Testing**: `README-AGENT-ENGINE.md`
- **MVP Audit System**: See agent-mvp-audit.js documentation
- **Headless Integration**: `HEADLESS-INTEGRATION-COMPLETE.md`

## Troubleshooting

### Getting Help

1. Check browser console for JavaScript errors
2. Review test logs in the detailed log panel
3. Export results and share JSON for debugging
4. Compare results across different browsers/devices

### Debug Mode

Enable verbose logging by opening browser console and running:

```javascript
// In simulation mode
window.DEBUG_MODE = true;

// In integration mode
window.console.log = (...args) => {
  const logEl = document.getElementById('log');
  logEl.innerHTML += `<div>[DEBUG] ${args.join(' ')}</div>`;
};
```

## Performance

- **Simulation Mode**: ~100ms per field test
- **Integration Mode**: ~500ms per field test (includes DOM interaction)
- **Full Test Suite**: ~5-10 seconds for all viewports and fields

## Version History

- **v1.0** (2026-02-19): Initial release
  - Desktop and mobile viewport testing
  - Login and register form coverage
  - JSON export functionality
  - Real iframe integration mode

## License

Part of the EYES ONLY project. See main repository for license details.
