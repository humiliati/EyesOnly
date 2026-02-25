-- ============================================================
--   EYES ONLY — D1 Schema Migration v5: Phase 2
--   Geo-trigger zones + Web Push subscriptions.
--   All timestamps are Unix epoch milliseconds.
-- ============================================================

-- Geofence zones — named circular zones on the scenario map.
-- When an actor enters or exits a zone, a trigger event fires.
CREATE TABLE IF NOT EXISTS geofence_zones (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id        INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  lat                REAL NOT NULL,
  lng                REAL NOT NULL,
  radius_m           REAL NOT NULL DEFAULT 100,
  trigger_on         TEXT NOT NULL DEFAULT 'enter'
                       CHECK (trigger_on IN ('enter','exit','both')),
  trigger_event_type TEXT NOT NULL DEFAULT 'geofence_enter',
  active             INTEGER NOT NULL DEFAULT 1,  -- 1=enabled, 0=disabled
  created_at         INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_geofences_scenario ON geofence_zones(scenario_id, active);

-- Actor geofence state — tracks whether an actor is currently inside each zone.
-- Used to compute enter/exit edges and avoid re-firing while inside.
CREATE TABLE IF NOT EXISTS actor_geofence_state (
  actor_id   INTEGER NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  zone_id    INTEGER NOT NULL REFERENCES geofence_zones(id) ON DELETE CASCADE,
  inside     INTEGER NOT NULL DEFAULT 0,  -- 1=inside, 0=outside
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  PRIMARY KEY (actor_id, zone_id)
);

-- Web Push subscriptions — one row per actor device subscription.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id    INTEGER NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  scenario_id INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL,
  p256dh      TEXT NOT NULL,  -- ECDH public key (base64url)
  auth        TEXT NOT NULL,  -- Auth secret (base64url)
  created_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  UNIQUE(actor_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subs_actor    ON push_subscriptions(actor_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_scenario ON push_subscriptions(scenario_id);
