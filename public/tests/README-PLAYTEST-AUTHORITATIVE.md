# Authoritative Playtest Runner (Tutorial Alpha)

This folder contains many test pages and scripts. **This document defines the single authoritative method** for running playtests against the EyesOnly prototype.

**Default = A (UI Watch Mode):** polished, human-observable, intended to become a website feature.

**B (Batch/Math Mode):** internal testing only (rough is fine).

---

## TL;DR (do this)

### ✅ A) UI Watch Mode (DEFAULT)

1) Open the game:
- `public/index.html`

2) In the in-game terminal, start Gone Rogue:
- type: `rogue`

3) Open the playtest runner UI in the same browser:
- `public/tests/test-agent-mvp-audit.html`

4) Click:
- **Run UI Test (Natural)**

Watch the agent play in real time with commentary.

Stop at any time:
- in game terminal: `AGENT STOP`

**If you do one thing, do this.**

---

## What to report (for human playtesters)

When something feels off or breaks, capture:
- Device: Desktop/Mobile + browser
- Mode: `UI Natural`
- Floor reached
- What you saw (1–2 sentences)
- Screenshot/video if possible

If the runner provides it, also include:
- seed / runId
- persona

---

## B) Batch/Math Mode (internal only)

Use batch mode to tune economy and detect impossible bosses.

Open:
- `public/tests/test-str-economy-runner.html`

Run:
- **Run Math Tests** (e.g., 100–500 runs)

See also:
- `STR-ECONOMY-TESTING-GUIDE.md`

---

## Engineer sanity check (one command)

Run validation:

```bash
cd public/tests
node validate-mvp-audit.js
```

This should pass. If it fails, stop and fix wiring before collecting playtester feedback.

---

## Canonical files (what is “authoritative”)

### Authoritative playtester UI
- `test-agent-mvp-audit.html`

### Authoritative audit engine
- `agent-mvp-audit.js`

### Authoritative validation
- `validate-mvp-audit.js`

---

## Non-authoritative / supporting tools

These are useful but should not be the official playtester entrypoint:
- `test-agent-engine.html` / `agent-engine.js` (older headless sim runner)
- `test-phase*.html` + `test-phase*-*.js` (phase-specific dev tests)
- `test-projectiles*.html/js` (feature-specific)
- `test-headless-integration.html` / `agent-headless-adapter.js` (integration validation)

---

## Future TODO (to unify further)

- [ ] Add `public/tests/index.html` with 2 buttons:
  - “Playtest (UI Watch Mode)” → `test-agent-mvp-audit.html`
  - “Internal batch tests” → `test-str-economy-runner.html`

- [ ] Add a “Copy bug report” button that copies:
  - seed/runId/persona/floor/uxMetrics summary

- [ ] Add a single export location for playtest artifacts.
