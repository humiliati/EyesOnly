/* ============================================================
   EYES ONLY — Auth Middleware
   Extracts Bearer token, validates against D1, attaches
   actor context to Hono variables.
   ============================================================ */

import { createMiddleware } from 'hono/factory';
import type { Env, AuthContext } from '../../shared/types';
import { validateToken, getActor } from '../db/queries';

type HonoEnv = { Bindings: Env; Variables: { auth: AuthContext } };

/**
 * Middleware that requires a valid auth token.
 * Attaches AuthContext to c.var.auth.
 */
export const requireAuth = createMiddleware<HonoEnv>(async (c, next) => {
  const header = c.req.header('Authorization');

  // WebSocket clients can't reliably set Authorization headers.
  // Allow token via query string ONLY for websocket upgrade requests.
  let token: string | null = null;
  if (header && header.startsWith('Bearer ')) {
    token = header.slice(7);
  } else {
    const upgrade = c.req.header('Upgrade');
    const isWs = upgrade && upgrade.toLowerCase() === 'websocket';
    const qToken = c.req.query('token');
    if (isWs && qToken) token = qToken;
  }

  if (!token) {
    return c.json({ error: 'UNAUTHORIZED', message: 'Missing auth token' }, 401);
  }
  const tokenRow = await validateToken(c.env.DB, token);
  if (!tokenRow) {
    return c.json({ error: 'UNAUTHORIZED', message: 'Invalid or expired token' }, 401);
  }

  const actor = await getActor(c.env.DB, tokenRow.actor_id);
  if (!actor) {
    return c.json({ error: 'UNAUTHORIZED', message: 'Actor not found' }, 401);
  }

  c.set('auth', {
    actor_id: actor.id,
    callsign: actor.callsign,
    role: tokenRow.role as AuthContext['role'],
    scenario_id: tokenRow.scenario_id,
  });

  await next();
});

/**
 * Middleware that requires Director role.
 * Must be used after requireAuth.
 */
export const requireDirector = createMiddleware<HonoEnv>(async (c, next) => {
  const auth = c.get('auth');
  if (!auth || auth.role !== 'director') {
    return c.json({ error: 'FORBIDDEN', message: 'Director access required' }, 403);
  }
  await next();
});
