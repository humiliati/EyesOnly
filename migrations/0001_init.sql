-- ============================================================
--   EYES ONLY — D1 Schema Migration v1
--   Append-only event log as source of truth.
--   All timestamps are Unix epoch milliseconds.
-- ============================================================

-- Scenario definitions
CREATE TABLE IF NOT EXISTS scenarios (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  config      TEXT NOT NULL DEFAULT '{}',
  created_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- Lane grid topology
CREATE TABLE IF NOT EXISTS lanes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id  INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  lane_id      TEXT NOT NULL,
  label        TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  config       TEXT NOT NULL DEFAULT '{}',
  UNIQUE(scenario_id, lane_id)
);

CREATE INDEX IF NOT EXISTS idx_lanes_scenario ON lanes(scenario_id);

-- Actors (Red Team, Blue Team, Directors)
CREATE TABLE IF NOT EXISTS actors (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id    INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  callsign       TEXT NOT NULL,
  team           TEXT NOT NULL CHECK (team IN ('red', 'blue', 'director')),
  lane_id        TEXT,
  status         TEXT NOT NULL DEFAULT 'standby',
  password_hash  TEXT NOT NULL DEFAULT '',
  created_at     INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at     INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  UNIQUE(scenario_id, callsign)
);

CREATE INDEX IF NOT EXISTS idx_actors_scenario ON actors(scenario_id);
CREATE INDEX IF NOT EXISTS idx_actors_team ON actors(scenario_id, team);

-- Append-only event log — THE source of truth
CREATE TABLE IF NOT EXISTS events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id  INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  actor_id     INTEGER REFERENCES actors(id),
  event_type   TEXT NOT NULL,
  payload      TEXT NOT NULL DEFAULT '{}',
  created_at   INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_events_scenario ON events(scenario_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_actor ON events(actor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(scenario_id, event_type);

-- Dead drops (physical/digital drop points)
CREATE TABLE IF NOT EXISTS dead_drops (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id   INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  lane_id       TEXT NOT NULL,
  label         TEXT NOT NULL DEFAULT '',
  lat           REAL,
  lng           REAL,
  status        TEXT NOT NULL DEFAULT 'placed'
                  CHECK (status IN ('placed', 'active', 'retrieved', 'compromised')),
  placed_by     INTEGER REFERENCES actors(id),
  retrieved_by  INTEGER REFERENCES actors(id),
  asset_key     TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_dead_drops_scenario ON dead_drops(scenario_id, lane_id);
CREATE INDEX IF NOT EXISTS idx_dead_drops_status ON dead_drops(scenario_id, status);

-- Session auth tokens
CREATE TABLE IF NOT EXISTS auth_tokens (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash   TEXT NOT NULL UNIQUE,
  actor_id     INTEGER NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('red', 'blue', 'director')),
  scenario_id  INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  expires_at   INTEGER NOT NULL,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_hash ON auth_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_actor ON auth_tokens(actor_id);

-- Scenario join codes
CREATE TABLE IF NOT EXISTS join_codes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  code         TEXT NOT NULL,
  scenario_id  INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  team         TEXT NOT NULL CHECK (team IN ('red', 'blue')),
  max_uses     INTEGER NOT NULL DEFAULT 50,
  used_count   INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  UNIQUE(code, scenario_id)
);

CREATE INDEX IF NOT EXISTS idx_join_codes_code ON join_codes(code);
