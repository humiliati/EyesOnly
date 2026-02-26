-- ============================================================
--   EYES ONLY - D1 Schema Migration v10: Actor Kind
--   Distinguish account-linked player actors from non-account NPC/staff/business actors.
-- ============================================================

ALTER TABLE actors ADD COLUMN actor_kind TEXT NOT NULL DEFAULT 'player'
  CHECK (actor_kind IN ('player','staff','npc','business'));

CREATE INDEX IF NOT EXISTS idx_actors_kind
  ON actors(scenario_id, actor_kind);
