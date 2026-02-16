-- ============================================================
--   EYES ONLY — D1 Schema Migration v2: UGRS Grid System
--   Adds grid_cells table and extends actors/dead_drops
--   with cell_id for positional tracking.
-- ============================================================

-- UGRS grid cells — each cell is a block on the command map
CREATE TABLE IF NOT EXISTS grid_cells (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id  INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  cell_id      TEXT NOT NULL,
  col          INTEGER NOT NULL,
  row          INTEGER NOT NULL,
  lane_id      TEXT,
  status       TEXT NOT NULL DEFAULT 'unknown'
                 CHECK (status IN ('working','degraded','compromised','offline','unknown')),
  tension      INTEGER NOT NULL DEFAULT 0 CHECK (tension BETWEEN 0 AND 100),
  notes        TEXT NOT NULL DEFAULT '',
  UNIQUE(scenario_id, cell_id)
);

CREATE INDEX IF NOT EXISTS idx_grid_cells_scenario ON grid_cells(scenario_id);
CREATE INDEX IF NOT EXISTS idx_grid_cells_lane ON grid_cells(scenario_id, lane_id);

-- Extend actors with cell positioning
ALTER TABLE actors ADD COLUMN cell_id TEXT;

-- Extend dead_drops with cell positioning
ALTER TABLE dead_drops ADD COLUMN cell_id TEXT;
