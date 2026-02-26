-- ============================================================
--   EYES ONLY - D1 Schema Migration v6: Ops Telemetry Visibility
--   Allows an actor to hide their GPS from other ops viewers while remaining
--   visible to M (director).
-- ============================================================

ALTER TABLE actors ADD COLUMN ops_telemetry_visible INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_actors_scenario_ops_visible
  ON actors(scenario_id, team, ops_telemetry_visible);
