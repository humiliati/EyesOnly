-- ============================================================
--   EYES ONLY - D1 Schema Migration v7: Dead Drop Items
--   Adds item payloads to dead drops so ops retrieval can surface collectables
--   and M can process grants.
-- ============================================================

ALTER TABLE dead_drops ADD COLUMN items_json TEXT NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_dead_drops_items
  ON dead_drops(scenario_id, lane_id, status);
