/* ============================================================
   EYES ONLY — User Auth API Routes
   Username-based account registration and login.
   Simple password-based auth (hashed with bcrypt-equivalent).
   ============================================================ */

import { Hono } from 'hono';
import type { Env } from '../../shared/types';
import {
  getUserByUsername,
  getUserByCallsign,
  createUserAccount,
  createUserSession,
  getUserSession,
  deleteUserSession,
  updateUserLastLogin,
  getUserById,
  getUserCryptos,
  getUserInventory,
  getUserHighscores,
  getUserFilesystem,
  updateUserFilesystem,
  getUserPreferences,
  setUserPreferences,
  updateUserCryptos,
} from '../db/user-queries';
import { grantInventoryItem } from '../db/user-queries';
import { hashPassword, generateToken } from '../db/queries';

type HonoEnv = { Bindings: Env; Variables: Record<string, unknown> };

export const userAuthRoutes = new Hono<HonoEnv>();

/**
 * POST /api/user/register
 * Register a new user account (username-only, no password required initially).
 */
userAuthRoutes.post('/register', async (c) => {
  const body = await c.req.json<{ username: string; callsign?: string; email?: string }>();
  const { username, callsign, email } = body;

  if (!username || username.length < 3 || username.length > 20) {
    return c.json(
      {
        error: 'BAD_REQUEST',
        message: 'Username must be between 3-20 characters',
      },
      400,
    );
  }

  // Validate username format (alphanumeric + underscore)
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return c.json(
      {
        error: 'BAD_REQUEST',
        message: 'Username can only contain letters, numbers, and underscores',
      },
      400,
    );
  }

  // Check if username already exists
  const existing = await getUserByUsername(c.env.DB, username);
  if (existing) {
    return c.json(
      {
        error: 'USERNAME_TAKEN',
        message: 'Username already exists',
      },
      409,
    );
  }

  // Validate email if provided
  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json(
        {
          error: 'BAD_REQUEST',
          message: 'Invalid email format',
        },
        400,
      );
    }
  }

  // Normalize desired callsign (uppercase, spaces -> hyphen)
  const desiredBase = String(callsign || username).trim().toUpperCase().replace(/\s+/g, '-');

  // Guarantee uniqueness by appending -2, -3, ... if taken.
  let finalCallsign = desiredBase;
  for (let n = 1; n < 500; n++) {
    const exists = await getUserByCallsign(c.env.DB, finalCallsign);
    if (!exists) break;
    finalCallsign = `${desiredBase}-${n + 1}`;
  }

  // Create user account
  const user = await createUserAccount(
    c.env.DB,
    username,
    finalCallsign,
    email,
  );

  // Create session token
  const { token } = await createUserSession(c.env.DB, user.id);

  return c.json({
    session_token: token,
    user: {
      id: user.id,
      username: user.username,
      callsign: user.callsign,
      cryptos: user.cryptos,
    },
  });
});

/**
 * POST /api/user/login
 * Login with username (no password required for now - session-based).
 * In a production system, you'd add password verification here.
 */
userAuthRoutes.post('/login', async (c) => {
  const body = await c.req.json<{ username: string }>();
  const { username } = body;

  if (!username) {
    return c.json({ error: 'BAD_REQUEST', message: 'Username is required' }, 400);
  }

  // Get user
  const user = await getUserByUsername(c.env.DB, username);
  if (!user) {
    return c.json({ error: 'AUTH_FAILED', message: 'User not found' }, 401);
  }

  // Update last login
  await updateUserLastLogin(c.env.DB, user.id);

  // Create session token
  const { token } = await createUserSession(c.env.DB, user.id);

  return c.json({
    session_token: token,
    user: {
      id: user.id,
      username: user.username,
      callsign: user.callsign,
      cryptos: user.cryptos,
    },
  });
});

/**
 * POST /api/user/logout
 * Logout and invalidate session token.
 */
userAuthRoutes.post('/logout', async (c) => {
  const sessionToken = c.req.header('X-Session-Token');

  if (sessionToken) {
    await deleteUserSession(c.env.DB, sessionToken);
  }

  return c.json({ success: true });
});

/**
 * GET /api/user/me
 * Get current user info from session token.
 */
userAuthRoutes.get('/me', async (c) => {
  const sessionToken = c.req.header('X-Session-Token');

  if (!sessionToken) {
    return c.json({ error: 'UNAUTHORIZED', message: 'Session token required' }, 401);
  }

  const session = await getUserSession(c.env.DB, sessionToken);
  if (!session) {
    return c.json({ error: 'UNAUTHORIZED', message: 'Invalid or expired session' }, 401);
  }

  const user = await getUserById(c.env.DB, session.user_id);
  if (!user) {
    return c.json({ error: 'UNAUTHORIZED', message: 'User not found' }, 401);
  }

  return c.json({
    user: {
      id: user.id,
      username: user.username,
      callsign: user.callsign,
      email: user.email,
      cryptos: user.cryptos,
      created_at: user.created_at,
      last_login: user.last_login,
    },
  });
});

/**
 * GET /api/user/inventory
 * Get user's inventory.
 */
userAuthRoutes.get('/inventory', async (c) => {
  const sessionToken = c.req.header('X-Session-Token');

  if (!sessionToken) {
    return c.json({ error: 'UNAUTHORIZED', message: 'Session token required' }, 401);
  }

  const session = await getUserSession(c.env.DB, sessionToken);
  if (!session) {
    return c.json({ error: 'UNAUTHORIZED', message: 'Invalid or expired session' }, 401);
  }

  const inventory = await getUserInventory(c.env.DB, session.user_id);

  return c.json({ inventory });
});

/**
 * GET /api/user/inventory/instances
 * Returns an "instance view" of inventory rows where quantity>1 is expanded into separate instances.
 * Oldest-first semantics are supported by sorting by acquired_at ascending.
 */
userAuthRoutes.get('/inventory/instances', async (c) => {
  const sessionToken = c.req.header('X-Session-Token');
  if (!sessionToken) return c.json({ error: 'UNAUTHORIZED', message: 'Session token required' }, 401);

  const session = await getUserSession(c.env.DB, sessionToken);
  if (!session) return c.json({ error: 'UNAUTHORIZED', message: 'Invalid or expired session' }, 401);

  const inventory = await getUserInventory(c.env.DB, session.user_id);
  const rows = (inventory || []).slice().sort((a: any, b: any) => (a.acquired_at || 0) - (b.acquired_at || 0));

  const instances: any[] = [];
  for (const row of rows) {
    const q = Math.max(1, Math.floor(Number((row as any).quantity ?? 1) || 1));
    let md: any = {};
    try { md = row.metadata ? JSON.parse(row.metadata) : {}; } catch { md = {}; }
    for (let i = 0; i < q; i++) {
      instances.push({
        inventory_row_id: row.id,
        instance_index: i,
        item_id: row.item_id,
        item_type: row.item_type,
        metadata: md,
        acquired_at: row.acquired_at,
      });
    }
  }

  return c.json({ instances });
});

/**
 * POST /api/user/inventory/consume
 * Consume inventory instances (oldest-first by default).
 *
 * Body supports two shapes:
 *  A) Explicit instances:
 *     { instances: [{ inventory_row_id:number, instance_index:number }, ...] }
 *  B) Selector:
 *     { item_id: string, count: number, item_type?: 'persistent'|'loose' }
 */
userAuthRoutes.post('/inventory/consume', async (c) => {
  const sessionToken = c.req.header('X-Session-Token');
  if (!sessionToken) return c.json({ error: 'UNAUTHORIZED', message: 'Session token required' }, 401);

  const session = await getUserSession(c.env.DB, sessionToken);
  if (!session) return c.json({ error: 'UNAUTHORIZED', message: 'Invalid or expired session' }, 401);
  const userId = session.user_id;

  const body = await c.req.json<any>().catch(() => ({} as any));

  // Load inventory rows oldest-first for deterministic selection.
  const inv = await getUserInventory(c.env.DB, userId);
  const rows = (inv || []).slice().sort((a: any, b: any) => (a.acquired_at || 0) - (b.acquired_at || 0));

  // helper: decrement a row by n
  async function decRow(rowId: number, n: number) {
    const row = rows.find((r: any) => r.id === rowId);
    if (!row) throw new Error('Inventory row not found');
    const cur = Math.max(0, Math.floor(Number(row.quantity || 0) || 0));
    if (cur < n) throw new Error('Insufficient quantity');
    const next = cur - n;
    if (next <= 0) {
      await c.env.DB.prepare('DELETE FROM user_inventory WHERE id = ? AND user_id = ?').bind(rowId, userId).run();
    } else {
      await c.env.DB.prepare('UPDATE user_inventory SET quantity = ? WHERE id = ? AND user_id = ?').bind(next, rowId, userId).run();
    }
    row.quantity = next;
  }

  const consumed: any[] = [];

  if (Array.isArray(body.instances) && body.instances.length) {
    // Explicit consumption: group by row id and decrement counts.
    const byRow = new Map<number, number>();
    for (const inst of body.instances) {
      const rid = parseInt(String(inst?.inventory_row_id || 0), 10);
      if (!rid) continue;
      byRow.set(rid, (byRow.get(rid) || 0) + 1);
      consumed.push({ inventory_row_id: rid, instance_index: Number(inst?.instance_index ?? 0) });
    }
    if (!byRow.size) return c.json({ error: 'BAD_REQUEST', message: 'No valid instances provided' }, 400);

    for (const [rid, n] of byRow.entries()) {
      await decRow(rid, n);
    }

    return c.json({ ok: true, consumed });
  }

  // Selector mode
  const itemId = String(body.item_id || '').trim();
  const count = Math.max(1, Math.floor(Number(body.count ?? 1) || 1));
  const itemType = body.item_type ? String(body.item_type) : null;
  if (!itemId) return c.json({ error: 'BAD_REQUEST', message: 'item_id required' }, 400);

  // Walk oldest rows and consume until satisfied.
  let remaining = count;
  for (const row of rows) {
    if (row.item_id !== itemId) continue;
    if (itemType && row.item_type !== itemType) continue;
    const cur = Math.max(0, Math.floor(Number(row.quantity || 0) || 0));
    if (cur <= 0) continue;

    const take = Math.min(cur, remaining);
    await decRow(row.id, take);
    for (let i = 0; i < take; i++) consumed.push({ inventory_row_id: row.id });
    remaining -= take;
    if (remaining <= 0) break;
  }

  if (remaining > 0) {
    return c.json({ error: 'INSUFFICIENT', message: 'Insufficient inventory to consume' }, 409);
  }

  return c.json({ ok: true, consumed });
});

/**
 * POST /api/user/merge-local-data
 * Import legacy localStorage state into the account.
 *
 * Conflict rules (safe defaults):
 * - Preferences: server wins; we stash the local snapshot under preferences.imports for audit.
 * - Cryptos: take MAX(server, local) by adding only the positive difference.
 * - Inventory quantities: take MAX(serverQty, localQty) per (item_id,item_type) by adding only the positive difference.
 *
 * Idempotency:
 * - Requires device_id. If that device_id has already been imported, return already_merged.
 */
userAuthRoutes.post('/merge-local-data', async (c) => {
  const sessionToken = c.req.header('X-Session-Token');
  if (!sessionToken) return c.json({ error: 'UNAUTHORIZED', message: 'Session token required' }, 401);

  const session = await getUserSession(c.env.DB, sessionToken);
  if (!session) return c.json({ error: 'UNAUTHORIZED', message: 'Invalid or expired session' }, 401);

  const body = await c.req.json<{ device_id: string; gamestate?: any }>().catch(() => ({ device_id: '' } as any));
  const deviceId = String(body.device_id || '').trim();
  if (!deviceId) return c.json({ error: 'BAD_REQUEST', message: 'device_id required' }, 400);

  const prefs = await getUserPreferences(c.env.DB, session.user_id);
  prefs.imports = prefs.imports || {};
  prefs.imports.localStorage = prefs.imports.localStorage || {};

  if (prefs.imports.localStorage[deviceId]) {
    return c.json({ ok: true, already_merged: true });
  }

  const gs = body.gamestate || {};
  const localCryptos = Math.max(0, Math.floor(Number(gs.cryptos ?? 0) || 0));

  // Build current inventory map
  const currentInv = await getUserInventory(c.env.DB, session.user_id);
  const invMap = new Map<string, number>();
  for (const row of currentInv) {
    const k = `${row.item_type}:${row.item_id}`;
    invMap.set(k, (invMap.get(k) || 0) + (row.quantity || 0));
  }

  // Merge inventory lists from gamestate
  const changes: Array<{ item_id: string; item_type: 'persistent' | 'loose'; add: number }> = [];

  function ingest(list: any, itemType: 'persistent' | 'loose') {
    if (!Array.isArray(list)) return;
    for (const r of list) {
      const itemId = String(r?.id || '').trim();
      if (!itemId) continue;
      const qty = Math.max(1, Math.floor(Number(r?.qty ?? r?.quantity ?? 1) || 1));
      const k = `${itemType}:${itemId}`;
      const cur = invMap.get(k) || 0;
      if (qty > cur) {
        const diff = qty - cur;
        invMap.set(k, cur + diff);
        changes.push({ item_id: itemId, item_type: itemType, add: diff });
      }
    }
  }

  ingest(gs.inventoryPersistent, 'persistent');
  ingest(gs.inventoryLoose, 'loose');

  // Apply cryptos max merge
  if (localCryptos > 0) {
    const cur = (await getUserCryptos(c.env.DB, session.user_id)) || 0;
    if (localCryptos > cur) {
      await updateUserCryptos(c.env.DB, session.user_id, localCryptos - cur);
    }
  }

  // Apply inventory diffs
  for (const ch of changes) {
    await grantInventoryItem(c.env.DB, session.user_id, ch.item_id, { itemType: ch.item_type, quantity: ch.add });
  }

  // Stash snapshot for audit/debug (server-wins preferences merge)
  prefs.imports.localStorage[deviceId] = {
    merged_at: Date.now(),
    keys: {
      eyesonly_gamestate: true,
    },
    gamestate_summary: {
      cryptos: localCryptos,
      persistent_count: Array.isArray(gs.inventoryPersistent) ? gs.inventoryPersistent.length : 0,
      loose_count: Array.isArray(gs.inventoryLoose) ? gs.inventoryLoose.length : 0,
    },
  };

  await setUserPreferences(c.env.DB, session.user_id, prefs);

  return c.json({ ok: true, merged: true, inventory_added: changes.length });
});

/**
 * GET /api/user/highscores
 * Get user's highscores.
 */
userAuthRoutes.get('/highscores', async (c) => {
  const sessionToken = c.req.header('X-Session-Token');

  if (!sessionToken) {
    return c.json({ error: 'UNAUTHORIZED', message: 'Session token required' }, 401);
  }

  const session = await getUserSession(c.env.DB, sessionToken);
  if (!session) {
    return c.json({ error: 'UNAUTHORIZED', message: 'Invalid or expired session' }, 401);
  }

  const gameId = c.req.query('game_id');
  const highscores = await getUserHighscores(c.env.DB, session.user_id, gameId);

  return c.json({ highscores });
});

/**
 * GET /api/user/filesystem
 * Get user's immersive filesystem (for ARG mode).
 */
userAuthRoutes.get('/filesystem', async (c) => {
  const sessionToken = c.req.header('X-Session-Token');

  if (!sessionToken) {
    return c.json({ error: 'UNAUTHORIZED', message: 'Session token required' }, 401);
  }

  const session = await getUserSession(c.env.DB, sessionToken);
  if (!session) {
    return c.json({ error: 'UNAUTHORIZED', message: 'Invalid or expired session' }, 401);
  }

  const filesystem = await getUserFilesystem(c.env.DB, session.user_id);

  return c.json({ filesystem: filesystem || {} });
});

/**
 * PUT /api/user/filesystem
 * Update user's immersive filesystem (for ARG mode).
 */
userAuthRoutes.put('/filesystem', async (c) => {
  const sessionToken = c.req.header('X-Session-Token');

  if (!sessionToken) {
    return c.json({ error: 'UNAUTHORIZED', message: 'Session token required' }, 401);
  }

  const session = await getUserSession(c.env.DB, sessionToken);
  if (!session) {
    return c.json({ error: 'UNAUTHORIZED', message: 'Invalid or expired session' }, 401);
  }

  const body = await c.req.json<{ filesystem: object }>();
  if (!body.filesystem) {
    return c.json({ error: 'BAD_REQUEST', message: 'Filesystem data required' }, 400);
  }

  await updateUserFilesystem(c.env.DB, session.user_id, body.filesystem);

  return c.json({ success: true });
});

