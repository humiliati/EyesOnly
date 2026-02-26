-- ============================================================
--   EYES ONLY - D1 Schema Migration v9: Account-linked Actors + Scenario Roles
--   - Link scenario actors to user accounts (callsign canonical)
--   - Allow scenario-scoped moderator roles (e.g. ops)
--   - Thread user_id through auth tokens for reliable grants
-- ============================================================

-- Link actors to persistent user accounts
ALTER TABLE actors ADD COLUMN user_id INTEGER REFERENCES user_accounts(id);

CREATE INDEX IF NOT EXISTS idx_actors_scenario_user
  ON actors(scenario_id, user_id);

-- Thread user_id through actor auth tokens (ops / m mode)
ALTER TABLE auth_tokens ADD COLUMN user_id INTEGER REFERENCES user_accounts(id);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_user
  ON auth_tokens(user_id, scenario_id);

-- Scenario-scoped user roles (e.g. ops moderator)
CREATE TABLE IF NOT EXISTS scenario_user_roles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  UNIQUE (scenario_id, user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_scenario_user_roles_lookup
  ON scenario_user_roles(scenario_id, role);
