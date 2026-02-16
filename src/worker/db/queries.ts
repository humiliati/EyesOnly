/* ============================================================
   EYES ONLY — D1 Query Helpers
   Prepared statement wrappers for all database operations.
   ============================================================ */

import type {
  ScenarioRow,
  LaneRow,
  ActorRow,
  EventRow,
  DeadDropRow,
  AuthTokenRow,
  JoinCodeRow,
  GridCellRow,
} from '../../shared/types';

// --- Crypto Utilities ---

export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashPassword(password: string): Promise<string> {
  // Simple SHA-256 hash for now — adequate for game auth
  return hashToken(password);
}

// --- Scenarios ---

export async function getScenario(db: D1Database, id: number): Promise<ScenarioRow | null> {
  return db.prepare('SELECT * FROM scenarios WHERE id = ?').bind(id).first<ScenarioRow>();
}

export async function listScenarios(db: D1Database): Promise<ScenarioRow[]> {
  const result = await db.prepare('SELECT * FROM scenarios ORDER BY created_at DESC').all<ScenarioRow>();
  return result.results;
}

export async function createScenario(db: D1Database, name: string, config: object = {}): Promise<ScenarioRow> {
  const now = Date.now();
  const result = await db
    .prepare('INSERT INTO scenarios (name, config, created_at, updated_at) VALUES (?, ?, ?, ?) RETURNING *')
    .bind(name, JSON.stringify(config), now, now)
    .first<ScenarioRow>();
  return result!;
}

export async function updateScenarioStatus(db: D1Database, id: number, status: string): Promise<void> {
  await db
    .prepare('UPDATE scenarios SET status = ?, updated_at = ? WHERE id = ?')
    .bind(status, Date.now(), id)
    .run();
}

// --- Lanes ---

export async function getLanes(db: D1Database, scenarioId: number): Promise<LaneRow[]> {
  const result = await db
    .prepare('SELECT * FROM lanes WHERE scenario_id = ? ORDER BY sort_order')
    .bind(scenarioId)
    .all<LaneRow>();
  return result.results;
}

export async function createLane(
  db: D1Database,
  scenarioId: number,
  laneId: string,
  label: string,
  sortOrder: number,
  config: object = {},
): Promise<LaneRow> {
  const result = await db
    .prepare(
      'INSERT INTO lanes (scenario_id, lane_id, label, sort_order, config) VALUES (?, ?, ?, ?, ?) RETURNING *',
    )
    .bind(scenarioId, laneId, label, sortOrder, JSON.stringify(config))
    .first<LaneRow>();
  return result!;
}

// --- Actors ---

export async function getActor(db: D1Database, id: number): Promise<ActorRow | null> {
  return db.prepare('SELECT * FROM actors WHERE id = ?').bind(id).first<ActorRow>();
}

export async function getActorByCallsign(
  db: D1Database,
  scenarioId: number,
  callsign: string,
): Promise<ActorRow | null> {
  return db
    .prepare('SELECT * FROM actors WHERE scenario_id = ? AND callsign = ?')
    .bind(scenarioId, callsign)
    .first<ActorRow>();
}

export async function listActors(db: D1Database, scenarioId: number): Promise<ActorRow[]> {
  const result = await db
    .prepare('SELECT * FROM actors WHERE scenario_id = ? ORDER BY team, callsign')
    .bind(scenarioId)
    .all<ActorRow>();
  return result.results;
}

export async function createActor(
  db: D1Database,
  scenarioId: number,
  callsign: string,
  team: string,
  passwordHash: string = '',
): Promise<ActorRow> {
  const now = Date.now();
  const result = await db
    .prepare(
      'INSERT INTO actors (scenario_id, callsign, team, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING *',
    )
    .bind(scenarioId, callsign, team, passwordHash, now, now)
    .first<ActorRow>();
  return result!;
}

export async function updateActorStatus(db: D1Database, id: number, status: string): Promise<void> {
  await db
    .prepare('UPDATE actors SET status = ?, updated_at = ? WHERE id = ?')
    .bind(status, Date.now(), id)
    .run();
}

export async function updateActorLane(db: D1Database, id: number, laneId: string): Promise<void> {
  await db
    .prepare('UPDATE actors SET lane_id = ?, updated_at = ? WHERE id = ?')
    .bind(laneId, Date.now(), id)
    .run();
}

// --- Events (Append-Only) ---

export async function insertEvent(
  db: D1Database,
  scenarioId: number,
  actorId: number | null,
  eventType: string,
  payload: object = {},
): Promise<EventRow> {
  const result = await db
    .prepare(
      'INSERT INTO events (scenario_id, actor_id, event_type, payload, created_at) VALUES (?, ?, ?, ?, ?) RETURNING *',
    )
    .bind(scenarioId, actorId, eventType, JSON.stringify(payload), Date.now())
    .first<EventRow>();
  return result!;
}

export async function getEvents(
  db: D1Database,
  scenarioId: number,
  limit: number = 100,
  afterId?: number,
): Promise<EventRow[]> {
  if (afterId) {
    const result = await db
      .prepare(
        'SELECT * FROM events WHERE scenario_id = ? AND id > ? ORDER BY created_at ASC LIMIT ?',
      )
      .bind(scenarioId, afterId, limit)
      .all<EventRow>();
    return result.results;
  }
  const result = await db
    .prepare(
      'SELECT * FROM events WHERE scenario_id = ? ORDER BY created_at DESC LIMIT ?',
    )
    .bind(scenarioId, limit)
    .all<EventRow>();
  return result.results.reverse();
}

export async function getEventsByLane(
  db: D1Database,
  scenarioId: number,
  laneId: string,
  limit: number = 50,
): Promise<EventRow[]> {
  const result = await db
    .prepare(
      `SELECT e.* FROM events e
       WHERE e.scenario_id = ?
         AND json_extract(e.payload, '$.lane_id') = ?
       ORDER BY e.created_at DESC LIMIT ?`,
    )
    .bind(scenarioId, laneId, limit)
    .all<EventRow>();
  return result.results.reverse();
}

// --- Dead Drops ---

export async function createDeadDrop(
  db: D1Database,
  scenarioId: number,
  laneId: string,
  label: string,
  placedBy: number,
  lat?: number,
  lng?: number,
): Promise<DeadDropRow> {
  const now = Date.now();
  const result = await db
    .prepare(
      'INSERT INTO dead_drops (scenario_id, lane_id, label, lat, lng, placed_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *',
    )
    .bind(scenarioId, laneId, label, lat ?? null, lng ?? null, placedBy, now, now)
    .first<DeadDropRow>();
  return result!;
}

export async function retrieveDeadDrop(db: D1Database, id: number, retrievedBy: number): Promise<void> {
  await db
    .prepare("UPDATE dead_drops SET status = 'retrieved', retrieved_by = ?, updated_at = ? WHERE id = ?")
    .bind(retrievedBy, Date.now(), id)
    .run();
}

export async function listDeadDrops(db: D1Database, scenarioId: number): Promise<DeadDropRow[]> {
  const result = await db
    .prepare('SELECT * FROM dead_drops WHERE scenario_id = ? ORDER BY created_at DESC')
    .bind(scenarioId)
    .all<DeadDropRow>();
  return result.results;
}

export async function getDeadDropsByLane(
  db: D1Database,
  scenarioId: number,
  laneId: string,
): Promise<DeadDropRow[]> {
  const result = await db
    .prepare('SELECT * FROM dead_drops WHERE scenario_id = ? AND lane_id = ? ORDER BY created_at DESC')
    .bind(scenarioId, laneId)
    .all<DeadDropRow>();
  return result.results;
}

// --- Auth Tokens ---

export async function createAuthToken(
  db: D1Database,
  actorId: number,
  role: string,
  scenarioId: number,
  ttlMs: number = 24 * 60 * 60 * 1000, // 24h default
): Promise<{ token: string; row: AuthTokenRow }> {
  const token = generateToken();
  const tokenHash = await hashToken(token);
  const now = Date.now();
  const row = await db
    .prepare(
      'INSERT INTO auth_tokens (token_hash, actor_id, role, scenario_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING *',
    )
    .bind(tokenHash, actorId, role, scenarioId, now + ttlMs, now)
    .first<AuthTokenRow>();
  return { token, row: row! };
}

export async function validateToken(db: D1Database, token: string): Promise<AuthTokenRow | null> {
  const tokenHash = await hashToken(token);
  const row = await db
    .prepare('SELECT * FROM auth_tokens WHERE token_hash = ? AND expires_at > ?')
    .bind(tokenHash, Date.now())
    .first<AuthTokenRow>();
  return row;
}

export async function revokeToken(db: D1Database, tokenHash: string): Promise<void> {
  await db.prepare('DELETE FROM auth_tokens WHERE token_hash = ?').bind(tokenHash).run();
}

// --- Join Codes ---

export async function getJoinCode(db: D1Database, code: string): Promise<JoinCodeRow | null> {
  return db
    .prepare('SELECT * FROM join_codes WHERE code = ? AND used_count < max_uses')
    .bind(code)
    .first<JoinCodeRow>();
}

export async function incrementJoinCodeUsage(db: D1Database, id: number): Promise<void> {
  await db.prepare('UPDATE join_codes SET used_count = used_count + 1 WHERE id = ?').bind(id).run();
}

export async function createJoinCode(
  db: D1Database,
  code: string,
  scenarioId: number,
  team: string,
  maxUses: number = 50,
): Promise<JoinCodeRow> {
  const result = await db
    .prepare(
      'INSERT INTO join_codes (code, scenario_id, team, max_uses, created_at) VALUES (?, ?, ?, ?, ?) RETURNING *',
    )
    .bind(code, scenarioId, team, maxUses, Date.now())
    .first<JoinCodeRow>();
  return result!;
}

// --- UGRS Grid Cells ---

export async function getGridCells(db: D1Database, scenarioId: number): Promise<GridCellRow[]> {
  const result = await db
    .prepare('SELECT * FROM grid_cells WHERE scenario_id = ? ORDER BY row, col')
    .bind(scenarioId)
    .all<GridCellRow>();
  return result.results;
}

export async function getGridCell(db: D1Database, scenarioId: number, cellId: string): Promise<GridCellRow | null> {
  return db
    .prepare('SELECT * FROM grid_cells WHERE scenario_id = ? AND cell_id = ?')
    .bind(scenarioId, cellId)
    .first<GridCellRow>();
}

export async function upsertGridCell(
  db: D1Database,
  scenarioId: number,
  cellId: string,
  col: number,
  row: number,
  laneId?: string,
  status: string = 'unknown',
): Promise<GridCellRow> {
  const result = await db
    .prepare(
      `INSERT INTO grid_cells (scenario_id, cell_id, col, row, lane_id, status)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (scenario_id, cell_id) DO UPDATE SET col=excluded.col, row=excluded.row, lane_id=excluded.lane_id, status=excluded.status
       RETURNING *`,
    )
    .bind(scenarioId, cellId, col, row, laneId ?? null, status)
    .first<GridCellRow>();
  return result!;
}

export async function updateCellStatus(db: D1Database, scenarioId: number, cellId: string, status: string): Promise<void> {
  await db
    .prepare('UPDATE grid_cells SET status = ? WHERE scenario_id = ? AND cell_id = ?')
    .bind(status, scenarioId, cellId)
    .run();
}

export async function updateCellTension(db: D1Database, scenarioId: number, cellId: string, tension: number): Promise<void> {
  const clamped = Math.max(0, Math.min(100, tension));
  await db
    .prepare('UPDATE grid_cells SET tension = ? WHERE scenario_id = ? AND cell_id = ?')
    .bind(clamped, scenarioId, cellId)
    .run();
}

export async function updateCellLane(db: D1Database, scenarioId: number, cellId: string, laneId: string | null): Promise<void> {
  await db
    .prepare('UPDATE grid_cells SET lane_id = ? WHERE scenario_id = ? AND cell_id = ?')
    .bind(laneId, scenarioId, cellId)
    .run();
}

export async function updateCellNotes(db: D1Database, scenarioId: number, cellId: string, notes: string): Promise<void> {
  await db
    .prepare('UPDATE grid_cells SET notes = ? WHERE scenario_id = ? AND cell_id = ?')
    .bind(notes, scenarioId, cellId)
    .run();
}

export async function deleteGridCells(db: D1Database, scenarioId: number): Promise<void> {
  await db.prepare('DELETE FROM grid_cells WHERE scenario_id = ?').bind(scenarioId).run();
}

export async function bulkCreateGridCells(
  db: D1Database,
  scenarioId: number,
  cells: Array<{ cell_id: string; col: number; row: number }>,
): Promise<void> {
  // D1 batch: run all inserts in a single batch
  const stmts = cells.map((c) =>
    db
      .prepare('INSERT INTO grid_cells (scenario_id, cell_id, col, row) VALUES (?, ?, ?, ?)')
      .bind(scenarioId, c.cell_id, c.col, c.row),
  );
  await db.batch(stmts);
}

export async function updateActorCell(db: D1Database, actorId: number, cellId: string | null): Promise<void> {
  await db
    .prepare('UPDATE actors SET cell_id = ?, updated_at = ? WHERE id = ?')
    .bind(cellId, Date.now(), actorId)
    .run();
}

export async function updateScenarioConfig(db: D1Database, scenarioId: number, config: object): Promise<void> {
  await db
    .prepare('UPDATE scenarios SET config = ?, updated_at = ? WHERE id = ?')
    .bind(JSON.stringify(config), Date.now(), scenarioId)
    .run();
}
