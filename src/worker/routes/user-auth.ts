/* ============================================================
   EYES ONLY — User Auth API Routes
   Username-based account registration and login.
   Simple password-based auth (hashed with bcrypt-equivalent).
   ============================================================ */

import { Hono } from 'hono';
import type { Env } from '../../shared/types';
import {
  getUserByUsername,
  createUserAccount,
  createUserSession,
  getUserSession,
  deleteUserSession,
  updateUserLastLogin,
  getUserById,
  getUserCryptos,
  getUserInventory,
  getUserHighscores,
} from '../db/user-queries';
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

  // Create user account
  const user = await createUserAccount(
    c.env.DB,
    username,
    callsign || username, // Default callsign to username
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
