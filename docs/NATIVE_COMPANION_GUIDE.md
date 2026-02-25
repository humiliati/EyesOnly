# EYES ONLY — Native Companion App Development Guide

> **Status:** Phase 3 — Future Work  
> Reference for building native Wear OS and Apple Watch companion apps that wrap `/ops/watch/`.

---

## Overview

The watch PWA (`/ops/watch/index.html`) is designed to be fully functional as a standalone Progressive Web App on Android. However, some capabilities are blocked or degraded on native watch platforms:

| Feature              | Android PWA | Wear OS native | iOS Safari PWA | Apple Watch native |
|----------------------|-------------|----------------|----------------|--------------------|
| Vibration API        | ✅          | ⚠ (wrap)       | ❌             | ⚠ (WKInterfaceDevice) |
| Web Push             | ✅          | ✅ (via FCM)   | ⚠ (iOS 16.4+) | ✅ (APNs)          |
| Background GPS       | ✅ (limited) | ✅ (ForegroundService) | ❌ | ✅ (CLLocationManager) |
| NDEFReader (NFC)     | ✅ (Chrome) | ✅ (via native) | ❌             | ❌                 |
| Always-on display    | ❌          | ✅             | ❌             | ✅                 |

---

## Option A — Android: Wear OS WebView Wrapper

The fastest path to a native Wear OS app.

### Architecture

```
Wear OS App (Kotlin)
  └── WearableActivity
        └── WebView → https://eyesonly.app/ops/watch/
              ├── inject JS bridge: vibrate(), nfc(), battery()
              └── AndroidJSBridge.kt exposes native APIs to web
```

### Steps

1. **Create a new Wear OS project** in Android Studio
   - Target API 30+ (Wear OS 3.x)
   - Add `FOREGROUND_SERVICE`, `ACCESS_FINE_LOCATION`, `VIBRATE`, `NFC` permissions

2. **Add WebView with JS bridge** (`MainActivity.kt`):
   ```kotlin
   webView.settings.javaScriptEnabled = true
   webView.addJavascriptInterface(AndroidBridge(this), "AndroidBridge")
   webView.loadUrl("https://eyesonly.app/ops/watch/")
   ```

3. **AndroidBridge.kt** — expose native capabilities:
   ```kotlin
   class AndroidBridge(private val ctx: Context) {
     @JavascriptInterface
     fun vibrate(pattern: String) {
       val v = ctx.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
       val parts = pattern.split(",").map { it.trim().toLong() }
       VibrationEffect.createWaveform(parts.toLongArray(), -1).let { v.vibrate(it) }
     }
     
     @JavascriptInterface
     fun isNativeApp(): Boolean = true
   }
   ```

4. **Override `navigator.vibrate`** from the bridge:
   ```javascript
   // Injected into WebView before page load
   if (window.AndroidBridge) {
     navigator.vibrate = function(pattern) {
       AndroidBridge.vibrate(Array.isArray(pattern) ? pattern.join(',') : String(pattern));
       return true;
     };
   }
   ```

5. **Background GPS** — use a `ForegroundService` to poll location and POST to `/api/ops/telemetry` every 30s even when the screen is off.

6. **Always-on display** — implement `AmbientModeSupport.AmbientCallbackProvider` to show minimal status (callsign + WS dot) when ambient.

### Manifest additions
```xml
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.NFC" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-feature android:name="android.hardware.type.watch" />
```

---

## Option B — iOS: WKWebView + WatchKit

### Architecture

```
iOS App (Swift)          watchOS App (Swift)
  └── WKWebView            └── WKInterfaceController
        → /ops/watch/            ├── WKInterfaceButton (ACK)
        ↕ WatchConnectivity      ├── WKInterfaceLabel (status)
                                 └── WKInterfaceTimer (countdown)
```

### iOS side (`ContentView.swift`)

```swift
import WebKit

struct ContentView: View {
  var body: some View {
    WebView(url: URL(string: "https://eyesonly.app/ops/watch/")!)
  }
}

struct WebView: UIViewRepresentable {
  let url: URL
  func makeUIView(context: Context) -> WKWebView {
    let config = WKWebViewConfiguration()
    // Inject WatchConnectivity bridge
    let script = WKUserScript(
      source: "window._isNativeIOS = true;",
      injectionTime: .atDocumentStart, forMainFrameOnly: true
    )
    config.userContentController.addUserScript(script)
    return WKWebView(frame: .zero, configuration: config)
  }
  func updateUIView(_ uiView: WKWebView, context: Context) {
    uiView.load(URLRequest(url: url))
  }
}
```

### WatchKit side

The watchOS companion app does NOT use WebView — too heavy for Apple Watch.  
Instead, build a minimal native UI that mirrors the watch PWA state:

1. **WCSession** — receive state updates from iOS companion app
2. **WKInterfaceButton** — large ACK target (matches the PWA ACK button)
3. **Haptic** — `WKInterfaceDevice.current().play(.notification)` for pings
4. **Background refresh** — `WKExtension.scheduleBackgroundRefresh(...)` for telemetry

### WatchConnectivity bridge

```swift
// iOS side: relay WebView state to Watch
func webView(_ webView: WKWebView, didReceiveMessage message: WKScriptMessage) {
  if message.name == "ping" {
    WCSession.default.sendMessage(["type": "ping", "data": message.body], replyHandler: nil)
  }
}
```

```swift
// watchOS side: receive ping + show
func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
  if message["type"] as? String == "ping" {
    WKInterfaceDevice.current().play(.notification)
    // update label, show ACK button
  }
}
```

---

## Option C — Capacitor / PWA wrapper (cross-platform)

[Capacitor](https://capacitorjs.com/) wraps the existing PWA with minimal native code changes.

```bash
npm install @capacitor/core @capacitor/cli
npx cap init "EyesOnly OpsWatch" "app.eyesonly.opswatch"
npx cap add android
npx cap add ios
```

### capacitor.config.ts
```typescript
import { CapacitorConfig } from '@capacitor/cli';
export default {
  appId: 'app.eyesonly.opswatch',
  appName: 'OPS WATCH',
  webDir: 'public/ops/watch',
  server: { url: 'https://eyesonly.app/ops/watch/', cleartext: false },
} as CapacitorConfig;
```

### Capacitor plugins needed
- `@capacitor/haptics` — vibration on iOS
- `@capacitor/geolocation` — background GPS
- `@capacitor-community/nfc` — NFC on Android
- `@capacitor/push-notifications` — APNs/FCM

**Trade-off:** Capacitor doesn't support Wear OS or Apple Watch natively — use for phone-first deployment only.

---

## Offline Mesh Mode (WebRTC)

For actor-to-actor GPS sharing without a server connection:

### Architecture
```
Actor A (watch)                 Actor B (watch)
  └── RTCPeerConnection ←─────── RTCPeerConnection
        └── RTCDataChannel
              ↕
          GPS position updates every 30s
```

### Signaling via existing WebSocket
Use the existing `/api/ops/ws` channel as the WebRTC signaling transport:

```javascript
// Offer (Actor A)
const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] });
const dc = pc.createDataChannel('gps');
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);
_ws.send(JSON.stringify({ type: 'webrtc_offer', to: targetActorId, sdp: offer.sdp }));

// Answer (Actor B — handles 'webrtc_offer' WS message)
await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: data.sdp }));
const answer = await pc.createAnswer();
await pc.setLocalDescription(answer);
_ws.send(JSON.stringify({ type: 'webrtc_answer', to: data.from, sdp: answer.sdp }));

// ICE candidates (both sides)
pc.onicecandidate = (e) => {
  if (e.candidate) _ws.send(JSON.stringify({ type: 'webrtc_ice', to: peerId, candidate: e.candidate }));
};
```

### Backend additions needed
- Add `webrtc_offer`, `webrtc_answer`, `webrtc_ice` to `WSMessageType` with `audience: 'target'` routing
- ScenarioRoom already routes `target` audience correctly (Phase 3 shipped this)

### Data channel protocol
```json
{ "type": "gps", "lat": 47.678, "lng": -116.799, "callsign": "GHOST", "ts": 1700000000000 }
```

---

## Implementation Priority

1. **Wear OS WebView wrapper** — highest ROI, fastest (2-3 days Kotlin work)
2. **Capacitor iOS phone app** — medium ROI, reuses all existing PWA code (1-2 days)
3. **WebRTC mesh** — needed for off-grid ops; signaling is already ready (1 day of JS + type additions)
4. **Apple Watch native** — lowest ROI, highest effort (1-2 weeks Swift/WatchKit)

---

## Testing Checklist

Before shipping native app:

- [ ] WebView loads `/ops/watch/` correctly on Wear OS emulator
- [ ] Vibration fires on ping via JS bridge
- [ ] Background GPS service keeps posting telemetry after screen off (5 min test)
- [ ] WS reconnect works after network switch (WiFi → BT)
- [ ] ACK button tap sends `POST /api/ops/ack` with correct token
- [ ] Push notification fires when M sends ping (device off)
- [ ] NFC scan opens confirm overlay (Android only)
- [ ] Panic two-tap works
- [ ] Microchat messages decrypt correctly (same key as web PWA)
- [ ] Logout removes all stored credentials
