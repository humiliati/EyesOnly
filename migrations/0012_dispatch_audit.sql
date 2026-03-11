-- 0012_dispatch_audit.sql
-- Dispatch audit trail for scenario lifecycle tracking.
-- Logs every significant state change from staging through completion.

CREATE TABLE IF NOT EXISTS dispatch_audit (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id   INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  action        TEXT NOT NULL,
  actor_id      INTEGER REFERENCES actors(id),
  detail        TEXT NOT NULL DEFAULT '{}',
  created_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_dispatch_audit_scenario ON dispatch_audit(scenario_id, created_at);
