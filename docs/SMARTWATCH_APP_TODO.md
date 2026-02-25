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

## 🔲 TODO — Phase 2 (Near-Term) ← NOW SHIPPED

### Watch App UX
- [x] **Bearing arrow** — bearing arrow in idle zone; shows direction + distance to `_assignedCell` when GPS available; updates on every telemetry cycle via `updateBearing()` + `calcBearing()` + `haversineM()`
- [x] **Web Push notifications** — `requestPushPermission()` on login; `POST /api/ops/push-subscribe`; SW handles `push` events → `showNotification()`; notification ACK action dispatches `auto_ack` to app; SW `notificationclick` opens app or dispatches auto-ACK
- [x] **Low-power mode** — when `battery < 20%`, heartbeat stretches to 60s; accelerometer stops; `updateLowPowerMode()` called on `levelchange`
- [x] **NFC dead-drop tap** — `NDEFReader.scan()` in `doNFCScan()`; `GET /api/ops/nfc-drop?tag=` lookup; confirm overlay for retrieve; `POST /api/ops/dead-drop` with `action:retrieve`; NFC button shown only if `NDEFReader` in window
- [ ] **Haptic patterns on iOS** — iOS Web Vibration is blocked; investigate WKWebView wrapper or PWA wrapper (Capacitor / Expo)
- [ ] **Watch face shortcuts** — on Wear OS / Apple Watch via WebBluetooth companion or native companion app
- [ ] **PIN / biometric lock** — prevent unauthorized ACK from grabbed device

### Backend
- [x] **Geo-trigger engine** — `geofence_zones` table + `actor_geofence_state` table (migration 0005); `listActiveGeofenceZones`, `getActorGeofenceState`, `upsertActorGeofenceState` queries; haversine distance check on every `/api/ops/telemetry` POST; edge-detect enter/exit; insert named event + broadcast `geofence_trigger` WS message; `triggered_zones[]` returned in telemetry response
- [x] **Deadman check** — Cloudflare cron trigger `*/5 * * * *` in `wrangler.jsonc`; `scheduled()` export in `worker/index.ts`; `findStaleActors()` + `listActiveScenarios()` queries; inserts `actor_deadman` event + broadcasts `deadman_alert` WS; sends Web Push nudge to stale actor's devices
- [x] **Web Push backend** — `push_subscriptions` table (migration 0005); `upsertPushSubscription`, `deletePushSubscription`, `getPushSubscriptionsByScenario` queries; `sendWebPush` + `sendWebPushToAll` in `utils/web-push.ts` (VAPID JWT + RFC 8291 aes128gcm payload encryption); VAPID secrets in `wrangler.jsonc` + env var pattern; mping fires Web Push to target actor's devices
- [x] **NFC hint endpoint** — `GET /api/ops/nfc-drop?tag=` searches active dead drops by label substring match
- [ ] **Vector / speed calculation** — compare last two telemetry positions; calculate heading + m/s; add to broadcast
- [ ] **Intercept prediction** — given actor vector and player position, calculate ETA intercept; surface in M console
- [ ] **Heat debt system** — track player "exposure score"; auto-reduce tension after no contact for N minutes
- [ ] **Stationary loiter detection** — if `motion_state === 'stationary'` for > 10 min, MOK advisory to M
- [ ] **Rate limiting on `/api/ops/telemetry`** — max 4 req/min per actor

### M Console
- [x] **Live map layer (Leaflet)** — dynamic Leaflet.js + OSM tiles loaded from CDN; actor GPS dots (team-colored, stale=grey); geofence zone circles (amber dashed); bounds auto-fit when actors have GPS; layer toggles (ACTORS / ZONES); toggleable map container in LIVE MAP section
- [x] **Geofence management UI** — GEOFENCE ZONES section: list with active status, delete buttons; ADD ZONE form (name, lat, lng, radius, trigger type, event type); live updates list and map on add/delete
- [x] **M console Push Broadcast** — `POST /api/m/push-broadcast` endpoint; sends Web Push to all subscribed actors in scenario (or specific actor)
- [x] **M console deadman + geofence WS alerts** — `deadman_alert` → MOK CRITICAL `☠`; `geofence_trigger` → MOK WARNING `⬡ ACTOR ENTER/EXIT zone`
- [ ] **Dispatch drag-and-drop** — drag actor icon on map to target cell → auto-send MOVE ping
- [ ] **Intercept probability % display** — per-actor ETA to player position
- [ ] **Ghost replay** — scrub through event log, re-animate actor positions on map
- [ ] **After-action log** — auto-generated summary

---

## 🔲 TODO — Phase 3 (Long-Term / Strategic) ← NOW SHIPPED

### Actor App
- [x] **Microchat** — encrypted actor ↔ M text channel visible only on watch
  - `actor_message` WS event type with `audience: 'target'` routing
  - AES-GCM client-side encryption (key derived from scenario ID via PBKDF2)
  - Delivery confirmation (`POST /api/ops/microchat/:id/ack` → `actor_message_ack` WS)
  - Watch app: floating 💬 FAB + full-screen chat panel with compose + history + unread badge
  - M console: per-actor chat thread viewer + send panel in MICROCHAT section
- [ ] **Native companion app** — Wear OS app using WebView or native Kotlin wrapping `/ops/watch/`
  - See `docs/NATIVE_COMPANION_GUIDE.md` for implementation roadmap
- [ ] **Apple Watch app** — WatchKit + shared iOS app
  - See `docs/NATIVE_COMPANION_GUIDE.md` for implementation roadmap
- [ ] **Offline mesh mode** — WebRTC peer-to-peer data channel between actors for GPS sharing without server
  - Requires STUN/TURN server (add Cloudflare Calls or coturn)
  - Watch app: `RTCPeerConnection` + `RTCDataChannel` for GPS broadcast
  - Signaling: use existing WS channel for offer/answer/ICE exchange

### Scenario Engine Integration
- [x] **Geo-triggered beat unlock** — when player/actor reaches lat/lng within N meters of beat location, auto-advance scenario state
  - `scenario_beats` table (migration 0006); beat CRUD at `GET/POST/DELETE /api/m/beats/:scenarioId`
  - Beat-unlock check in `POST /api/ops/telemetry` (actor proximity) and `POST /api/ops/player-location` (player proximity)
  - Manual unlock override: `POST /api/m/beats/:id/unlock`
  - M console: SCENARIO BEATS panel with add/delete/manual-unlock
  - WS: `beat_unlock` event broadcast to all → MOK WARNING `🎯`
- [x] **Player portal GPS reporting** — player terminal (`/`) optionally reports position (with consent) for M pressure modeling
  - Consent banner shown once after scenario join (stored in `localStorage`)
  - `POST /api/ops/player-location` — stores in `player_locations` table; checks active beats
  - M console: PLAYER POSITIONS section; player GPS dots (yellow) on Leaflet live map
  - WS: `player_location` event type broadcast to directors only
  - `window._EyesOnlyGPS.revoke()` / `.enable()` for runtime control
- [x] **Fog of war** — M controls which zones are "lit" for players
  - `fog_lit_zones` table (migration 0006)
  - `GET/POST /api/m/fog/:scenarioId`, `DELETE /api/m/fog/:scenarioId/:zoneLabel`
  - M console: FOG OF WAR section with per-zone LIT/DARK toggle
  - WS: `fog_update` broadcast → MOK advisory `🌫`
  - Player-side rendering: future work (no player map yet)
- [x] **False ping injection** — M can inject a decoy ping visible only to actors (not logged in main event feed)
  - `POST /api/m/decoy-ping` — `decoy_ping` WS message with `audience: 'actors'`
  - ScenarioRoom: `audience` routing — actors only, directors never see decoy_pings
  - NOT inserted into `events` table — leaves no log trace
  - Watch app: handles `decoy_ping` exactly like a real `mping` (actors cannot distinguish)
  - M console: DECOY PING section (actor ID + command + optional message) to create confusion for surveillance actors

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

## Architecture Reference (Phase 2 updated)

```
Watch App (PWA)                     Cloudflare Worker
/ops/watch/index.html               /api/ops/*
        │
        ├── POST /api/ops/telemetry  ─→  updateActorTelemetry(DB)
        │                            ─→  geo-trigger check (haversine vs geofence_zones)
        │                            ─→  broadcast actor_telemetry (DO)
        │                            ─→  insert geofence_enter/exit event + broadcast if triggered
        ├── POST /api/ops/ack        ─→  insertEvent(mping_ack)
        │                            ─→  broadcast mping_ack (DO)
        ├── POST /api/ops/panic      ─→  insertEvent(actor_panic)
        │                            ─→  broadcast event (DO)
        ├── POST /api/ops/push-subscribe  ─→  upsertPushSubscription(DB)
        ├── DELETE /api/ops/push-subscribe  ─→  deletePushSubscription(DB)
        ├── GET  /api/ops/nfc-drop?tag=  ─→  search dead_drops by label
        ├── POST /api/ops/checkin    ─→  insertEvent(checkin)
        └── GET  /api/ops/status     ─→  pending pings, actor state

Web Push (server → device)
        Cloudflare Worker VAPID     Push Service (FCM/APNs/Mozilla)
        ├── sendWebPush(sub, payload)  ─→  RFC 8291 aes128gcm encryption
        │                               ─→  VAPID JWT signing (ES256)
        └── triggered by:
              mping POST              (target actor's devices)
              deadman cron            (stale actor's devices)
              /api/m/push-broadcast   (all or specific actor)

Cron (Cloudflare scheduled trigger: */5 * * * *)
        scheduled()  ─→  listActiveScenarios
                     ─→  findStaleActors (last_seen_at > 5 min)
                     ─→  insertEvent(actor_deadman)
                     ─→  broadcast deadman_alert (DO)
                     ─→  sendWebPush nudge to stale actor

M Console                           /api/m/*
/m/app.js
        ├── GET /api/m/actors/positions/:id  ─→  last GPS per actor
        ├── GET /api/m/geofences/:id   ─→  list geofence zones
        ├── POST /api/m/geofences      ─→  create zone
        ├── DELETE /api/m/geofences/:id  ─→  delete zone
        ├── POST /api/m/push-broadcast  ─→  push to all actor devices
        └── WS  /api/m/ws            ←─  actor_telemetry, actor_panic,
                                          geofence_trigger, deadman_alert,
                                          mping_ack, game_freeze, events

Live Map (Leaflet.js CDN, rendered in M console right panel)
        ─ Actor dots at GPS coords (blue/red/green, grey if stale)
        ─ Geofence zone circles (amber dashed) with hover labels
        ─ Layer toggles: ACTORS ● / ZONES ⬤
        ─ Auto-refresh on WS actor_telemetry events
        ─ fitBounds when actors have GPS

ScenarioRoom (Durable Object)
  ─ single room per scenario_id
  ─ broadcasts all events to all connected WS clients (M, Ops, Watch)
```
