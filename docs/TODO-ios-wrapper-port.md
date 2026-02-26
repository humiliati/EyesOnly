# iOS Wrapper Port — Future Milestone

> **Status: planned / not started.**  
> The Windows `.exe` PyInstaller harness is the immediate priority.  
> This document captures design considerations for a future iOS port of the
> Gone Rogue runner wrapper.

---

## Goal

Ship an iOS app that runs the Gone Rogue game natively on an iOS device so
that QA, designers, and the level-creation engine can perform side-by-side
testing on an iPhone or iPad without needing a desktop machine.

---

## Architectural approaches

### Option A — WKWebView-based runner (preferred starting point)

Mirrors how the existing Playwright adapter drives the game in a headless
browser:

1. Embed a `WKWebView` and load `gone_rogue_harness.html` from the app bundle
   (or fetch it from the EyesOnly dev server over Wi-Fi).
2. Implement the PERCEIVE → PLAN → EXECUTE_BATCH turn envelope in Swift,
   calling JavaScript via `evaluateJavaScript(_:completionHandler:)`.
3. Wire a native Swift policy layer (or bridge to a Python runtime — see
   Option B) to drive decisions.

**Pros:** No Python dependency on-device; WKWebView is a first-class iOS API.  
**Cons:** Requires re-implementing (or FFI-bridging) the sundog policy logic
in Swift.

---

### Option B — Python-to-iOS bridge

Keep the existing sundog Python codebase and run it on-device via a Python
runtime bridge.

| Toolchain | Notes |
|-----------|-------|
| **BeeWare / Briefcase** | Packages CPython for iOS; supports `pip` packages; TestFlight-compatible. Best fit for code reuse from the desktop harness. |
| **Kivy** | Cross-platform UI toolkit; includes its own iOS packaging toolchain (`kivy-ios`). More suitable if a rich on-device UI is desired. |

**Pros:** Maximum code reuse from the desktop `gone-rogue-runner`.  
**Cons:** Larger binary, longer startup, App Store review complexity for
embedded interpreters.

---

## Turn-envelope architecture

Both options must preserve the sundog turn-envelope architecture:

```
PERCEIVE  →  read game state from the JS engine (via WKWebView message handlers
             or Playwright-equivalent JS evaluation)
PLAN      →  run policy logic (greedy / gone_rogue_greedy)
EXECUTE_BATCH  →  dispatch a batch of actions back into the JS engine
```

The iOS layer replaces the Playwright browser driver with `WKWebView`, but
the state-machine contracts in `sundog.runners.game` and
`sundog.runners.engine` remain unchanged.

---

## Asset serving

The Gone Rogue JS scripts (`public/js/`) must be available to the WKWebView.
Two options:

- **Bundled assets:** copy the compiled JS files into the Xcode project's
  resource bundle at build time (simple, offline-capable, requires rebuild to
  update scripts).
- **Live dev-server:** point the WKWebView at `http://<mac-ip>:8787` running
  `npm run dev` on the dev machine over the same Wi-Fi network (fast
  iteration, requires network).

For TestFlight / offline use, bundled assets are required.

---

## Level creation engine integration

The iPad form factor is ideal for side-by-side use:

- Left pane: the level creation editor (web view or native SwiftUI).
- Right pane: the Gone Rogue runner executing turns against the current level.

This mirrors the desktop workflow where the PyInstaller exe is launched
alongside `npm run dev` on port 8787.

---

## Distribution considerations

| Topic | Notes |
|-------|-------|
| **Code signing** | Requires an Apple Developer Program membership; provisioning profiles must include `com.apple.security.network.client` for Wi-Fi dev-server mode. |
| **TestFlight** | Internal testing track; no App Store review required for internal testers. Ideal for QA. |
| **Offline capability** | Bundle all JS assets; disable network fetch at runtime when no server is reachable. |
| **Touch input mapping** | Map swipe gestures and tap targets to the Gone Rogue directional/action inputs. The existing keyboard mapping in `docs/KEYBOARD_IMPLEMENTATION_SUMMARY.md` is the reference. |

---

## Next steps (when this milestone becomes active)

1. Decide Option A vs Option B based on policy-logic complexity at that time.
2. Set up an Xcode project under `platforms/ios/`.
3. Add a `Makefile` or `scripts/build-ios.sh` that copies `public/js/` into
   the Xcode resource bundle.
4. Implement the turn-envelope bridge layer.
5. Add a CI job on `macos-latest` that builds the `.ipa` and uploads it to
   TestFlight via `xcrun altool` or Fastlane.
