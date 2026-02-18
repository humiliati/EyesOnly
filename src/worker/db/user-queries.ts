/* ============================================================
   EYES ONLY — User Account Query Helpers
   Database operations for user accounts and WebAuthn.
   ============================================================ */

import type {
  UserAccountRow,
  WebAuthnCredentialRow,
  UserSessionRow,
  UserInventoryRow,
  UserHighscoreRow,
} from '../../shared/types';
import { generateToken, hashToken } from './queries';

// --- User Accounts ---

export async function getUserByUsername(
  db: D1Database,
  username: string,
): Promise<UserAccountRow | null> {
  return db
    .prepare('SELECT * FROM user_accounts WHERE LOWER(username) = LOWER(?)')
    .bind(username)
    .first<UserAccountRow>();
}

export async function getUserById(db: D1Database, id: number): Promise<UserAccountRow | null> {
  return db.prepare('SELECT * FROM user_accounts WHERE id = ?').bind(id).first<UserAccountRow>();
}

export async function createUserAccount(
  db: D1Database,
  username: string,
  callsign: string,
  email?: string,
): Promise<UserAccountRow> {
  const now = Date.now();
  const result = await db
    .prepare(
      `INSERT INTO user_accounts (username, email, callsign, created_at, last_login, cryptos, preferences)
       VALUES (?, ?, ?, ?, ?, 0, '{"theme":"green","sfx_enabled":true,"cloud_sync_enabled":true}')
       RETURNING *`,
    )
    .bind(username, email || null, callsign, now, now)
    .first<UserAccountRow>();
  return result!;
}

export async function updateUserLastLogin(db: D1Database, userId: number): Promise<void> {
  await db
    .prepare('UPDATE user_accounts SET last_login = ? WHERE id = ?')
    .bind(Date.now(), userId)
    .run();
}

// --- WebAuthn Credentials ---

export async function getCredentialByCredentialId(
  db: D1Database,
  credentialId: string,
): Promise<WebAuthnCredentialRow | null> {
  return db
    .prepare('SELECT * FROM webauthn_credentials WHERE credential_id = ?')
    .bind(credentialId)
    .first<WebAuthnCredentialRow>();
}

export async function getCredentialsByUserId(
  db: D1Database,
  userId: number,
): Promise<WebAuthnCredentialRow[]> {
  const result = await db
    .prepare('SELECT * FROM webauthn_credentials WHERE user_id = ? ORDER BY created_at DESC')
    .bind(userId)
    .all<WebAuthnCredentialRow>();
  return result.results;
}

export async function createCredential(
  db: D1Database,
  userId: number,
  credentialId: string,
  publicKey: string,
  transports?: string[],
  deviceName?: string,
): Promise<WebAuthnCredentialRow> {
  const now = Date.now();
  const result = await db
    .prepare(
      `INSERT INTO webauthn_credentials
       (user_id, credential_id, public_key, counter, transports, device_name, created_at, last_used_at)
       VALUES (?, ?, ?, 0, ?, ?, ?, ?)
       RETURNING *`,
    )
    .bind(
      userId,
      credentialId,
      publicKey,
      transports ? JSON.stringify(transports) : null,
      deviceName || null,
      now,
      now,
    )
    .first<WebAuthnCredentialRow>();
  return result!;
}

export async function updateCredentialCounter(
  db: D1Database,
  credentialId: string,
  counter: number,
): Promise<void> {
  await db
    .prepare('UPDATE webauthn_credentials SET counter = ?, last_used_at = ? WHERE credential_id = ?')
    .bind(counter, Date.now(), credentialId)
    .run();
}

// --- User Sessions ---

export async function createUserSession(
  db: D1Database,
  userId: number,
  expiryDays: number = 7,
): Promise<{ token: string; session: UserSessionRow }> {
  const token = generateToken();
  const now = Date.now();
  const expiresAt = now + expiryDays * 24 * 60 * 60 * 1000;

  const result = await db
    .prepare(
      `INSERT INTO user_sessions (session_token, user_id, expires_at, created_at, last_activity)
       VALUES (?, ?, ?, ?, ?)
       RETURNING *`,
    )
    .bind(token, userId, expiresAt, now, now)
    .first<UserSessionRow>();

  return { token, session: result! };
}

export async function getUserSession(
  db: D1Database,
  sessionToken: string,
): Promise<UserSessionRow | null> {
  const session = await db
    .prepare('SELECT * FROM user_sessions WHERE session_token = ?')
    .bind(sessionToken)
    .first<UserSessionRow>();

  if (!session) return null;

  // Check if expired
  if (session.expires_at < Date.now()) {
    await db.prepare('DELETE FROM user_sessions WHERE session_token = ?').bind(sessionToken).run();
    return null;
  }

  // Update last activity
  await db
    .prepare('UPDATE user_sessions SET last_activity = ? WHERE session_token = ?')
    .bind(Date.now(), sessionToken)
    .run();

  return session;
}

export async function deleteUserSession(db: D1Database, sessionToken: string): Promise<void> {
  await db.prepare('DELETE FROM user_sessions WHERE session_token = ?').bind(sessionToken).run();
}

// --- User Inventory ---

export async function getUserInventory(
  db: D1Database,
  userId: number,
): Promise<UserInventoryRow[]> {
  const result = await db
    .prepare('SELECT * FROM user_inventory WHERE user_id = ? ORDER BY acquired_at DESC')
    .bind(userId)
    .all<UserInventoryRow>();
  return result.results;
}

export async function addInventoryItem(
  db: D1Database,
  userId: number,
  itemId: string,
  itemType: 'persistent' | 'loose',
  quantity: number = 1,
  metadata: object = {},
): Promise<UserInventoryRow> {
  const now = Date.now();
  const result = await db
    .prepare(
      `INSERT INTO user_inventory (user_id, item_id, item_type, quantity, metadata, acquired_at)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING *`,
    )
    .bind(userId, itemId, itemType, quantity, JSON.stringify(metadata), now)
    .first<UserInventoryRow>();
  return result!;
}

export async function removeInventoryItem(
  db: D1Database,
  userId: number,
  itemId: string,
): Promise<void> {
  await db
    .prepare('DELETE FROM user_inventory WHERE user_id = ? AND item_id = ?')
    .bind(userId, itemId)
    .run();
}

// --- User Highscores ---

export async function getUserHighscores(
  db: D1Database,
  userId: number,
  gameId?: string,
): Promise<UserHighscoreRow[]> {
  let query = 'SELECT * FROM user_highscores WHERE user_id = ?';
  const params: (number | string)[] = [userId];

  if (gameId) {
    query += ' AND game_id = ?';
    params.push(gameId);
  }

  query += ' ORDER BY achieved_at DESC';

  const result = await db.prepare(query).bind(...params).all<UserHighscoreRow>();
  return result.results;
}

export async function addHighscore(
  db: D1Database,
  userId: number,
  gameId: string,
  mode: 'human' | 'agent',
  score: number,
  metadata: object = {},
): Promise<UserHighscoreRow> {
  const now = Date.now();
  const result = await db
    .prepare(
      `INSERT INTO user_highscores (user_id, game_id, mode, score, metadata, achieved_at)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING *`,
    )
    .bind(userId, gameId, mode, score, JSON.stringify(metadata), now)
    .first<UserHighscoreRow>();
  return result!;
}

export async function getLeaderboard(
  db: D1Database,
  gameId: string,
  mode?: 'human' | 'agent',
  limit: number = 10,
): Promise<Array<UserHighscoreRow & { username: string; callsign: string }>> {
  let query = `
    SELECT h.*, u.username, u.callsign
    FROM user_highscores h
    JOIN user_accounts u ON h.user_id = u.id
    WHERE h.game_id = ?
  `;
  const params: (string | number)[] = [gameId];

  if (mode) {
    query += ' AND h.mode = ?';
    params.push(mode);
  }

  query += ' ORDER BY h.score DESC LIMIT ?';
  params.push(limit);

  const result = await db.prepare(query).bind(...params).all<UserHighscoreRow & { username: string; callsign: string }>();
  return result.results;
}

// --- Update User Cryptos ---

export async function updateUserCryptos(
  db: D1Database,
  userId: number,
  amount: number,
): Promise<void> {
  await db
    .prepare('UPDATE user_accounts SET cryptos = cryptos + ? WHERE id = ?')
    .bind(amount, userId)
    .run();
}

export async function getUserCryptos(db: D1Database, userId: number): Promise<number> {
  const result = await db
    .prepare('SELECT cryptos FROM user_accounts WHERE id = ?')
    .bind(userId)
    .first<{ cryptos: number }>();
  return result?.cryptos || 0;
}
