# Agent UI Integration — As-Built Guide (Tutorial Alpha)

This guide describes the **current, as-built** agent integration surfaces in EyesOnly (flapsandseals.com) and how they relate to:
- watching an agent play Gone Rogue (the default playtest method)
- future “bring your own agent” imports (OpenClaw-compatible) via the **Kernel** button

---

## 0) Two different things (don’t mix them up)

### A) Built-in agent takeover (works now)
This is the existing local agent that can take over Gone Rogue using the **real game engine** via the headless API.

- Start/stop via terminal commands: `AGENT NATURAL`, `AGENT DEVELOPER`, `AGENT STOP`, etc.
- This is what playtesters use for “watch mode.”

### B) Kernel “Agent API integration portal” (UI surface; external agents)
This is the **UI entrypoint** intended to make agent import easier than setting up OpenClaw.

- The **Kernel button becomes enabled after login**.
- Clicking Kernel prints the Kernel portal help text and supported-agent intent.
- The printed commands (`KERNEL CONNECT <api_key>`, etc.) are the contract we will implement/extend.

---

## 1) Default playtest flow (UI Watch Mode)

1) Open the game:
- `public/index.html`

2) Enter Gone Rogue in terminal:
```
rogue
```

3) Start the agent (Natural):
```
AGENT NATURAL
```

4) Watch:
- agent plays in real time
- commentary appears in the MOK interjection field

Stop:
```
AGENT STOP
```

This generates an MVP-style report in the terminal.

---

## 2) Kernel button (agent import surface)

### 2.1 When it becomes available
- Kernel is **disabled** when logged out.
- After successful login/registration, `UIControls.enableKernelButton()` is called.

### 2.2 What it does today
Clicking the Kernel button:
- blocks access if not authenticated
- otherwise prints a Kernel help screen to terminal:
  - `KERNEL CONNECT <api_key>`
  - `KERNEL DISCONNECT`
  - `KERNEL STATUS`
  - `KERNEL HELP`

Implementation reference:
- `public/js/ui-controls.js` → `handleKernelClick()`
- `public/js/login-ui.js` → `_notifyLoginSuccess()` enables Kernel button

### 2.3 What we’re building toward (design intent)
Kernel is the place a user will:
- connect an external agent (OpenClaw-compatible API or other)
- enable/disable agent participation
- (later) submit/verify agent runs for highscores

**Key requirement:** agent import should be easier than full OpenClaw setup.
Kernel is the primary UX for this.

---

## 3) Built-in agent takeover (technical architecture)

```
UI (Terminal)
  └── GoneRogue._handleAgentCommand('AGENT ...')
        └── AgentIntegration.startAgentTakeover(mode)
              └── HeadlessAdapter.HeadlessGameAdapter
                    └── GoneRogue.headless API
                          └── Actual Gone Rogue engine
```

Key files:
- `public/js/agent-integration.js` — agent decision loop + reporting
- `public/tests/agent-headless-adapter.js` — human-like IO constraints + trace export
- `public/js/gone-rogue.js` — implements `GoneRogue.headless` + terminal command handling

---

## 4) Hooks for highscores + external agents (TODOs)

To make Kernel-driven external agents real (and safe), we need:

### 4.1 Kernel command routing
- [ ] Add parsing/handlers for `KERNEL ...` commands in the main terminal command router.
  - (Currently Kernel click prints the portal text, but the command verbs aren’t wired.)

### 4.2 Credential storage (server-side)
- [ ] Store agent API credentials server-side (scoped to user account)
- [ ] Never expose agent secrets to other users

### 4.3 Agent run submission contract
- [ ] Standardize a `run_id`, `seed`, `trace_hash`, and summary stats payload
- [ ] Allow server-side verification (replay/spot-check) before publishing highscores

### 4.4 Highscore integration
- [ ] Write to `user_highscores` for:
  - humans (normal play)
  - agents (Kernel-connected)

---

## 5) Related docs

- `public/tests/README-PLAYTEST-AUTHORITATIVE.md` — the single official playtest method
- `public/tests/HEADLESS-INTEGRATION-COMPLETE.md` — headless API + adapter details
- `public/tests/README-AGENT-ENGINE.md` — older headless simulation engine notes
