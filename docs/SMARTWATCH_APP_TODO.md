# EYES ONLY — Smartwatch Blue Team Actor App
# Feature TODO & Integration Checklist
# `/ops/watch/index.html` — watch-optimized PWA for Blue Team actors

---

## ✅ Shipped (This PR)

### Watch App Shell (`public/ops/watch/`)
- [x] PWA manifest (`manifest.json`) — `display: standalone`, black theme, watch-optimized
- [x] Service Worker (`sw.js`) — offline shell cache; network-first for API calls
- [x] Login screen — join code + callsign, same `/api/join` endpoint as Ops portal
- [x] Main watch screen — minimal, 3 zones: header / ping zone / bottom bar
- [x] One-tap ACK button — large target, `POST /api/ops/ack`
- [x] ACK countdown timer (30s) with color shift (green → amber → red) + vibration ticks
- [x] Live ping display — command (`HOLD`, `ENGAGE`, etc.) + detail + countdown
- [x] Idle state — callsign + lane + motion state
- [x] WebSocket connection — same `/api/ops/ws` as Ops portal; real-time ping delivery
- [x] WebSocket auto-reconnect on disconnect (5s backoff)
- [x] Status poll fallback — `GET /api/ops/status` every 15s when WS is down
- [x] GPS heartbeat — `watchPosition` API; position shown in status panel
- [x] Telemetry heartbeat — `POST /api/ops/telemetry` every 30s (GPS + motion state)
- [x] Accelerometer motion classification — stationary / walking / running / vehicle / dropped
- [x] Vibration API cues — distinct patterns for: tap, ping, ACK, tick, panic
- [x] Silent mode toggle — suppresses vibration except panic (bottom bar)
- [x] Check-in button — `POST /api/ops/checkin` with GPS + motion state
- [x] Panic / abort button — two-tap confirm → `POST /api/ops/panic`
- [x] Game Frozen overlay — full-screen "GAME FROZEN" on `game_freeze` WS event
- [x] Status bar (tap to expand) — status, pending pings, lane, battery, motion
- [x] Expanded status panel — scenario name, cell, lat/lng, last telemetry, heartbeat count
- [x] Logout / disconnect
- [x] Session persistence — `localStorage` so refresh restores session
- [x] `overscroll-behavior: none` — prevents accidental pull-to-refresh mid-op
- [x] `user-select: none` — prevents text selection on long-press
- [x] `touch-action: manipulation` — disables double-tap zoom

### Backend
- [x] `POST /api/ops/telemetry` — GPS + accelerometer + motion state; updates `actors` row + broadcasts `actor_telemetry` WS event to M console
- [x] `POST /api/ops/panic` — inserts `actor_panic` event; broadcasts to M console (MOK shows CRITICAL alert)
- [x] `GET /api/m/actors/positions/:scenarioId` — returns last-known GPS + telemetry for all actors (used by M console live layer)
- [x] DB migration `0004_actor_telemetry.sql` — `last_lat`, `last_lng`, `last_seen_at`, `last_accel_*`, `motion_state` on actors table
- [x] `updateActorTelemetry()` query helper in `db/queries.ts`
- [x] `TelemetryRequest` + `PanicRequest` types in `shared/types.ts`
- [x] `actor_telemetry` added to `WSMessageType`

### M Console
- [x] **LIVE TELEMETRY** section in overview panel — shows last GPS, motion state, age per actor
- [x] Auto-refreshes every 15s + on WS `actor_telemetry` messages
- [x] MOK alert for `actor_panic` events (CRITICAL)
- [x] MOK advisory for `player_pingback` events

---

## 🔲 TODO — Phase 2 (Near-Term)

### Watch App UX
- [ ] **Map arrow** — show bearing arrow + distance to current assignment cell (no full map; just direction + meters)
- [ ] **Deep link ping notifications** — use Web Push API so watch gets pings even when screen is off
  - Requires: VAPID keys, push subscription on login, server-side Web Push send on `mping` event
- [ ] **Haptic patterns on iOS** — iOS Web Vibration is blocked; investigate WKWebView wrapper or PWA wrapper (Capacitor / Expo)
- [ ] **Battery reporting** — already sent in telemetry payload; add M console display
- [ ] **Low-power mode** — when `battery < 20`, increase heartbeat interval to 60s, disable accelerometer
- [ ] **Watch face shortcuts** — on Wear OS / Apple Watch via WebBluetooth companion or native companion app
- [ ] **QR / NFC interaction** — tap NFC tag at dead drop location to auto-confirm retrieval
  - Requires: Web NFC API (Android Chrome) — `NDEFReader.scan()` trigger → `POST /api/ops/dead-drop`
- [ ] **PIN / biometric lock** — prevent unauthorized ACK from grabbed device

### Backend
- [ ] **Geo-trigger engine** — compare actor position against configured geofence zones; auto-fire events when actor enters/exits
  - Needs: `geofence_zones` table (`scenario_id`, `name`, `lat`, `lng`, `radius_m`, `trigger_event_type`)
  - Process: on telemetry POST, check actor lat/lng against active geofences; insert event + broadcast if triggered
- [ ] **Deadman check** — M console warns if no telemetry for > 5 minutes from an active actor
  - Needs: scheduled Cron Trigger (Cloudflare `[triggers.crons]`) + `actor_deadman` event type
- [ ] **Vector / speed calculation** — compare last two telemetry positions; calculate heading + m/s; add to broadcast
- [ ] **Intercept prediction** — given actor vector and player position (if reported), calculate ETA intercept; surface in M console
- [ ] **Heat debt system** — track player "exposure score"; auto-reduce tension after no contact for N minutes
- [ ] **Stationary loiter detection** — if `motion_state === 'stationary'` for > 10 min, MOK advisory to M
- [ ] **Rate limiting on `/api/ops/telemetry`** — max 4 req/min per actor (Cloudflare Rate Limiting rule or KV counter)

### M Console
- [ ] **Live map layer (Leaflet / Mapbox)** — replace UGRS grid with real-world map when GPS data exists
  - Show actor icons at GPS coordinates (color-coded by team)
  - Show player position (if reporting)
  - Overlay geofence rings (soft encirclement visualization)
  - Mission radius rings around objectives
  - Heat zone gradient layer from tension values
- [ ] **Dispatch drag-and-drop** — drag actor icon on map to target cell → auto-send MOVE ping
- [ ] **Intercept probability % display** — per-actor ETA to player position
- [ ] **Ghost replay** — scrub through event log, re-animate actor positions on map
- [ ] **After-action log** — auto-generated PDF/markdown summary: player path, actor movements, escalation timeline, near-misses

---

## 🔲 TODO — Phase 3 (Long-Term / Strategic)

### Actor App
- [ ] **Native companion app** — Wear OS app using WebView or native Kotlin wrapping `/ops/watch/`
- [ ] **Apple Watch app** — WatchKit + shared iOS app
- [ ] **Offline mesh mode** — WebRTC peer-to-peer data channel between actors for GPS sharing without server
- [ ] **Microchat** — text channel between M and actor visible only on watch
  - Needs: `actor_message` event type, encrypted payload, delivery confirmation

### Scenario Engine Integration
- [ ] **Geo-triggered beat unlock** — when player reaches `lat/lng` within N meters of beat location, auto-advance scenario state
- [ ] **Player portal GPS reporting** — player terminal (`/`) optionally reports position (with consent) for M pressure modeling
- [ ] **Fog of war** — players see partial map; M controls which zones are "lit" for players
- [ ] **False ping injection** — M can inject a decoy ping visible only to actors (not logged in main event feed) to create confusion for surveillance actors

---

## Manual Test Checklist (No Automated Tests)

Since there is no automated test infrastructure in this repo, verify the following manually:

### Backend
1. `POST /api/ops/telemetry` with valid token → `200 ok`, `motion_state` returned; `actors.last_seen_at` updated in DB
2. `POST /api/ops/telemetry` with `accel_x/y/z` values → motion_state auto-classified correctly:
   - `mag < 0.5` → `stationary`, `mag 1-2` → `walking`, `mag 5-7` → `running`
3. M console receives `actor_telemetry` WS broadcast immediately after telemetry POST
4. `POST /api/ops/panic` → `actor_panic` event in DB; MOK shows CRITICAL in M console
5. `GET /api/m/actors/positions/1` → all actors returned with `last_lat`, `last_lng`, `last_seen_at`

### Watch App
1. Navigate to `/ops/watch/` → login screen shows
2. Enter invalid join code → error shown
3. Enter valid join code + callsign → main watch screen loads
4. If pending M ping exists → ping alert shows, timer counts down, vibration fires
5. Tap ACKNOWLEDGE → `mping_ack` sent, button shows "ACKNOWLEDGED ✓", returns to idle after 2s
6. Tap CHECK IN → checkin event visible in M console event feed
7. Tap SILENT → vibration disabled; icon changes to 🔇
8. Hold PANIC → confirm overlay shows; tap CONFIRM → `actor_panic` event sent; M gets MOK CRITICAL alert
9. Tap status bar → expanded panel shows lat/lng, telemetry age, heartbeat count
10. Kill network → WS dot goes red; app still shows last state; reconnects after 5s
11. Add to Home Screen (Android Chrome) → installs as standalone PWA with black background

### M Console
1. Open LIVE TELEMETRY section → shows "Loading positions…" then renders actor rows
2. Row shows callsign + team badge + motion icon + GPS coords + age
3. Stale actors (> 2 min) shown in red
4. Refresh button updates the list immediately
5. After watch app sends telemetry → list auto-updates within 15s

---

## Architecture Reference

```
Watch App (PWA)                     Cloudflare Worker
/ops/watch/index.html               /api/ops/*
        │
        ├── POST /api/ops/telemetry  ─→  updateActorTelemetry(DB)
        │                            ─→  broadcast actor_telemetry (DO)
        ├── POST /api/ops/ack        ─→  insertEvent(mping_ack)
        │                            ─→  broadcast mping_ack (DO)
        ├── POST /api/ops/panic      ─→  insertEvent(actor_panic)
        │                            ─→  broadcast event (DO)
        ├── POST /api/ops/checkin    ─→  insertEvent(checkin)
        └── GET  /api/ops/status     ─→  pending pings, actor state

M Console                           /api/m/*
/m/app.js
        ├── GET /api/m/actors/positions/:id  ─→  last GPS per actor
        └── WS  /api/m/ws            ←─  actor_telemetry, actor_panic,
                                          mping_ack, game_freeze, events

ScenarioRoom (Durable Object)
  ─ single room per scenario_id
  ─ broadcasts all events to all connected WS clients (M, Ops, Watch)
```
