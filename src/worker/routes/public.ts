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
  getActorByScenarioUser,
  createAuthToken,
  hashPassword,
} from '../db/queries';
import { getUserSession, getUserById } from '../db/user-queries';

type HonoEnv = { Bindings: Env; Variables: Record<string, unknown> };

export const publicRoutes = new Hono<HonoEnv>();

/**
 * POST /api/join
 * Red Team joins a scenario via join code.
 * Creates actor + returns session token.
 */
publicRoutes.post('/join', async (c) => {
  const body = await c.req.json<JoinRequest>();
  const { code } = body;

  if (!code) {
    return c.json({ error: 'BAD_REQUEST', message: 'code is required' }, 400);
  }

  // Prefer account-linked join if a user session token is provided.
  // NOTE: This is a user-session token (from /api/user/login), not an actor token.
  const header = c.req.header('Authorization');
  const userSessionToken = header && header.startsWith('Bearer ') ? header.slice(7) : null;

  let accountUser: any = null;
  if (userSessionToken) {
    const sess = await getUserSession(c.env.DB, userSessionToken);
    if (!sess) {
      return c.json({ error: 'UNAUTHORIZED', message: 'Invalid or expired user session' }, 401);
    }
    accountUser = await getUserById(c.env.DB, sess.user_id);
    if (!accountUser) {
      return c.json({ error: 'UNAUTHORIZED', message: 'User not found' }, 401);
    }
  }

  // From here on: account-linked join is required.
  if (!accountUser?.callsign || !accountUser?.id) {
    return c.json({ error: 'UNAUTHORIZED', message: 'Account login required to join scenario' }, 401);
  }

  const callsign = accountUser.callsign;

  // Validate join code
  const joinCode = await getJoinCode(c.env.DB, code.toUpperCase());
  if (!joinCode) {
    return c.json({ error: 'INVALID_CODE', message: 'Join code not found or expired' }, 404);
  }

  // If account-linked, reuse existing actor for (scenario_id,user_id). Otherwise enforce callsign uniqueness.
  let actor: any = null;
  if (accountUser?.id) {
    actor = await getActorByScenarioUser(c.env.DB, joinCode.scenario_id, accountUser.id);
  }

  if (!actor) {
    // Check if callsign already exists in this scenario
    const existing = await getActorByCallsign(c.env.DB, joinCode.scenario_id, callsign);
    if (existing) {
      return c.json({ error: 'CALLSIGN_TAKEN', message: 'Callsign already in use for this scenario' }, 409);
    }

    // Create actor (account-linked when possible)
    actor = await createActor(
      c.env.DB,
      joinCode.scenario_id,
      callsign,
      joinCode.team,
      '',
      accountUser?.id ?? null,
      'player',
    );
  }

  // Increment join code usage
  await incrementJoinCodeUsage(c.env.DB, joinCode.id);

  // Create auth token (thread user_id when available)
  const { token } = await createAuthToken(
    c.env.DB,
    actor.id,
    joinCode.team,
    joinCode.scenario_id,
    undefined,
    accountUser?.id ?? null,
  );

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
  const { token } = await createAuthToken(
    c.env.DB,
    actor.id,
    actor.team,
    scenario_id,
    undefined,
    (actor as any).user_id ?? null,
  );

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
