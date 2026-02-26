-- ============================================================
--   EYES ONLY - D1 Schema Migration v8: Inventory Grants
--   Tracks director grants (idempotency) for ops retrieval / dead drop rewards.
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory_grants (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id      INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  source_event_id  INTEGER NOT NULL,
  target_user_id   INTEGER NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  granted_by       INTEGER REFERENCES actors(id),
  items_json       TEXT NOT NULL DEFAULT '[]',
  created_at       INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_grants_source
  ON inventory_grants(source_event_id);

CREATE INDEX IF NOT EXISTS idx_inventory_grants_user
  ON inventory_grants(target_user_id, created_at);
