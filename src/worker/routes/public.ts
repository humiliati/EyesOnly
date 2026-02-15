/* ============================================================
   EYES ONLY — Public API Routes
   No auth required. Join codes, login, health.
   ============================================================ */

import { Hono } from 'hono';
import type { Env, JoinRequest, LoginRequest } from '../../shared/types';
import {
  getJoinCode,
  incrementJoinCodeUsage,
  createActor,
  getActorByCallsign,
  createAuthToken,
  hashPassword,
} from '../db/queries';

type HonoEnv = { Bindings: Env; Variables: Record<string, unknown> };

export const publicRoutes = new Hono<HonoEnv>();

/**
 * POST /api/join
 * Red Team joins a scenario via join code.
 * Creates actor + returns session token.
 */
publicRoutes.post('/join', async (c) => {
  const body = await c.req.json<JoinRequest>();
  const { code, callsign } = body;

  if (!code || !callsign) {
    return c.json({ error: 'BAD_REQUEST', message: 'code and callsign are required' }, 400);
  }

  // Validate join code
  const joinCode = await getJoinCode(c.env.DB, code.toUpperCase());
  if (!joinCode) {
    return c.json({ error: 'INVALID_CODE', message: 'Join code not found or expired' }, 404);
  }

  // Check if callsign already exists in this scenario
  const existing = await getActorByCallsign(c.env.DB, joinCode.scenario_id, callsign);
  if (existing) {
    return c.json({ error: 'CALLSIGN_TAKEN', message: 'Callsign already in use for this scenario' }, 409);
  }

  // Create actor
  const actor = await createActor(c.env.DB, joinCode.scenario_id, callsign, joinCode.team);

  // Increment join code usage
  await incrementJoinCodeUsage(c.env.DB, joinCode.id);

  // Create auth token
  const { token } = await createAuthToken(c.env.DB, actor.id, joinCode.team, joinCode.scenario_id);

  return c.json({
    token,
    actor: {
      id: actor.id,
      callsign: actor.callsign,
      team: actor.team,
      scenario_id: joinCode.scenario_id,
    },
  });
});

/**
 * POST /api/auth/login
 * Blue Team / Director login with callsign + password.
 */
publicRoutes.post('/auth/login', async (c) => {
  const body = await c.req.json<LoginRequest>();
  const { callsign, password, scenario_id } = body;

  if (!callsign || !password || !scenario_id) {
    return c.json({ error: 'BAD_REQUEST', message: 'callsign, password, and scenario_id are required' }, 400);
  }

  const actor = await getActorByCallsign(c.env.DB, scenario_id, callsign);
  if (!actor) {
    return c.json({ error: 'AUTH_FAILED', message: 'Invalid credentials' }, 401);
  }

  // Verify password
  const passwordHash = await hashPassword(password);
  if (actor.password_hash !== passwordHash) {
    return c.json({ error: 'AUTH_FAILED', message: 'Invalid credentials' }, 401);
  }

  // Create auth token
  const { token } = await createAuthToken(c.env.DB, actor.id, actor.team, scenario_id);

  return c.json({
    token,
    actor: {
      id: actor.id,
      callsign: actor.callsign,
      team: actor.team,
      scenario_id,
    },
  });
});
