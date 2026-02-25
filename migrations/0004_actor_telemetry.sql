-- ============================================================
--   EYES ONLY — D1 Schema Migration v4: Actor Telemetry
--   Adds last-known position and heartbeat fields to actors
--   for smartwatch / GPS field tracking.
--   All timestamps are Unix epoch milliseconds.
-- ============================================================

-- Extend actors with telemetry columns
ALTER TABLE actors ADD COLUMN last_lat      REAL;
ALTER TABLE actors ADD COLUMN last_lng      REAL;
ALTER TABLE actors ADD COLUMN last_seen_at  INTEGER;
ALTER TABLE actors ADD COLUMN last_accel_x  REAL;
ALTER TABLE actors ADD COLUMN last_accel_y  REAL;
ALTER TABLE actors ADD COLUMN last_accel_z  REAL;
ALTER TABLE actors ADD COLUMN motion_state  TEXT DEFAULT 'unknown'
  CHECK (motion_state IN ('unknown','stationary','walking','running','vehicle','dropped'));

-- Index for fast M-console position queries
CREATE INDEX IF NOT EXISTS idx_actors_scenario_telemetry
  ON actors(scenario_id, last_seen_at);
