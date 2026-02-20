# Testing Screenshots

This folder contains screenshots and test artifacts from automated and manual testing sessions.

## Purpose

Screenshots in this folder are used for:
- **Visual regression testing**: Compare UI changes across versions
- **Tutorial floor validation**: Verify contrived map layouts in portrait mobile
- **Bot testing documentation**: Evidence from tiny.macro-style replay tests
- **Bug reports**: Captured states for debugging
- **Design review**: Visual proof of feature implementation

## Naming Convention

Use the following naming pattern for screenshots:

```
{test-type}_{feature}_{timestamp}.{ext}
```

Examples:
- `bot-run_floor-2-key-gate_20260220-143022.png`
- `tutorial_portrait-mobile_20260220-143155.png`
- `debrief-feed_key-synergy_20260220-144012.png`

## Test Types

- `bot-run`: Automated bot playthrough
- `tutorial`: Tutorial floor validation
- `mobile`: Mobile layout testing
- `debrief-feed`: Debrief window contents
- `bug`: Bug reproduction
- `regression`: Regression test evidence

## Related Documentation

- `/public/tests/README-PLAYTEST-AUTHORITATIVE.md` - Authoritative playtest protocol
- `/public/tests/test-tutorial-floors-bot.html` - Tutorial floor bot test UI
- `/public/tests/test-agent-mvp-audit.html` - Agent playtest UI

## Screenshot Tools

### Browser DevTools
- Open DevTools (F12)
- Press Ctrl+Shift+P (Cmd+Shift+P on Mac)
- Type "screenshot"
- Select "Capture full size screenshot" or "Capture screenshot"

### From Test Pages
- Open `/public/tests/test-tutorial-floors-bot.html`
- Click "📸 Generate Screenshot" button
- Follow instructions to capture from main game

### Playwright/Puppeteer (Future)
See `/public/tests/agent-headless-adapter.js` for headless screenshot automation.

## Export Format

Test results can be exported as JSON with embedded screenshot paths:

```json
{
  "timestamp": "2026-02-20T14:30:22Z",
  "seed": 1234567890,
  "seedPhrase": "ALPHA-BRAVO-CHARLIE",
  "testResults": { ... },
  "screenshots": [
    "bot-run_floor-2-key-gate_20260220-143022.png"
  ]
}
```

## Clean-up Policy

- Keep screenshots for successful test runs for 30 days
- Keep bug reproduction screenshots permanently until bug is closed
- Archive regression test screenshots when version is released
