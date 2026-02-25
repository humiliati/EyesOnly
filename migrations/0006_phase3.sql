-- ============================================================
-- EYES ONLY — Migration 0006: Phase 3
-- Scenario beats, player locations, fog of war, microchat
-- Run after: 0005_phase2.sql
-- ============================================================

-- ── Scenario beats: geo-located story beat triggers ──────────
-- M Designer places beats with lat/lng; when a player or actor
-- reaches trigger_radius_m the beat auto-advances scenario state.
CREATE TABLE IF NOT EXISTS scenario_beats (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id       INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  beat_seq          INTEGER NOT NULL DEFAULT 0,
  title             TEXT    NOT NULL,
  description       TEXT,
  lat               REAL,
  lng               REAL,
  trigger_radius_m  REAL    NOT NULL DEFAULT 100,
  event_type        TEXT    NOT NULL DEFAULT 'beat_unlock',
  auto_advance      INTEGER NOT NULL DEFAULT 1,   -- 1 = fires automatically on proximity
  unlocked_at       INTEGER,                      -- epoch ms; NULL = not yet triggered
  created_at        INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_beats_scenario
  ON scenario_beats(scenario_id, beat_seq);

-- ── Player locations (opt-in GPS from player terminal) ───────
-- Players consent once; terminal reports position every 30s.
-- M console reads these for pressure modeling.
CREATE TABLE IF NOT EXISTS player_locations (
  player_id   TEXT    NOT NULL,   -- callsign or user_id
  scenario_id INTEGER NOT NULL,
  lat         REAL    NOT NULL,
  lng         REAL    NOT NULL,
  accuracy_m  REAL,
  reported_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  PRIMARY KEY (player_id, scenario_id)
);

CREATE INDEX IF NOT EXISTS idx_player_loc_scenario
  ON player_locations(scenario_id, reported_at);

-- ── Fog of war: M controls which zones are "lit" ─────────────
-- zone_label is a freeform identifier (cell_id, area name, etc.)
-- Players only see content for lit zones (enforced by player API).
CREATE TABLE IF NOT EXISTS fog_lit_zones (
  scenario_id TEXT    NOT NULL,
  zone_label  TEXT    NOT NULL,
  lit         INTEGER NOT NULL DEFAULT 1,
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  PRIMARY KEY (scenario_id, zone_label)
);

-- ── Microchat messages (actor ↔ M, server-opaque ciphertext) ─
-- Server stores and routes ciphertext only; never sees plaintext.
-- Key is derived client-side from scenario_id + shared secret.
-- from_id / to_id: actor_id (as TEXT) or the literal string 'M'.
CREATE TABLE IF NOT EXISTS microchat_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id INTEGER NOT NULL,
  from_id     TEXT    NOT NULL,
  to_id       TEXT    NOT NULL,
  ciphertext  TEXT    NOT NULL,   -- base64url AES-GCM: "<iv_b64url>:<ct_b64url>"
  delivered   INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_microchat_scenario
  ON microchat_messages(scenario_id, created_at);
