/* ============================================================
   EYES ONLY — M Mode API Routes
   Director console endpoints: scenario management, grid,
   actor control, escalation, event injection.
   Requires Director auth.
   ============================================================ */

import { Hono } from 'hono';
import type { Env, AuthContext, EventPayload, EscalationRequest } from '../../shared/types';
import { requireAuth, requireDirector } from '../middleware/auth';
import {
  listScenarios,
  getScenario,
  createScenario,
  updateScenarioStatus,
  getLanes,
  createLane,
  listActors,
  createActor,
  updateActorStatus,
  updateActorLane,
  getActor,
  insertEvent,
  getEvents,
  listDeadDrops,
  createJoinCode,
  hashPassword,
} from '../db/queries';

type HonoEnv = { Bindings: Env; Variables: { auth: AuthContext } };

export const mModeRoutes = new Hono<HonoEnv>();

// All M Mode routes require Director auth
mModeRoutes.use('*', requireAuth);
mModeRoutes.use('*', requireDirector);

// --- Scenarios ---

/**
 * GET /api/m/scenarios
 * List all scenarios.
 */
mModeRoutes.get('/scenarios', async (c) => {
  const scenarios = await listScenarios(c.env.DB);
  return c.json({
    scenarios: scenarios.map((s) => ({
      ...s,
      config: JSON.parse(s.config),
    })),
  });
});

/**
 * POST /api/m/scenario
 * Create or update a scenario.
 */
mModeRoutes.post('/scenario', async (c) => {
  const body = await c.req.json<{
    id?: number;
    name?: string;
    status?: string;
    config?: object;
  }>();

  if (body.id) {
    // Update existing scenario
    if (body.status) {
      await updateScenarioStatus(c.env.DB, body.id, body.status);
    }
    const scenario = await getScenario(c.env.DB, body.id);
    return c.json({ scenario });
  }

  // Create new scenario
  if (!body.name) {
    return c.json({ error: 'BAD_REQUEST', message: 'name is required' }, 400);
  }

  const scenario = await createScenario(c.env.DB, body.name, body.config || {});
  return c.json({ scenario }, 201);
});

// --- Lane Grid ---

/**
 * GET /api/m/grid/:scenarioId
 * Full lane grid with actor positions and dead drops.
 */
mModeRoutes.get('/grid/:scenarioId', async (c) => {
  const scenarioId = parseInt(c.req.param('scenarioId'), 10);
  const scenario = await getScenario(c.env.DB, scenarioId);
  if (!scenario) {
    return c.json({ error: 'NOT_FOUND', message: 'Scenario not found' }, 404);
  }

  const [lanes, actors, deadDrops] = await Promise.all([
    getLanes(c.env.DB, scenarioId),
    listActors(c.env.DB, scenarioId),
    listDeadDrops(c.env.DB, scenarioId),
  ]);

  return c.json({
    scenario: {
      id: scenario.id,
      name: scenario.name,
      status: scenario.status,
      config: JSON.parse(scenario.config),
    },
    lanes: lanes.map((l) => ({
      ...l,
      config: JSON.parse(l.config),
      actors: actors.filter((a) => a.lane_id === l.lane_id).map((a) => ({
        id: a.id,
        callsign: a.callsign,
        team: a.team,
        status: a.status,
      })),
      dead_drops: deadDrops.filter((d) => d.lane_id === l.lane_id).map((d) => ({
        id: d.id,
        label: d.label,
        status: d.status,
      })),
    })),
    unassigned_actors: actors.filter((a) => !a.lane_id).map((a) => ({
      id: a.id,
      callsign: a.callsign,
      team: a.team,
      status: a.status,
    })),
  });
});

/**
 * POST /api/m/lane
 * Add a lane to a scenario.
 */
mModeRoutes.post('/lane', async (c) => {
  const body = await c.req.json<{
    scenario_id: number;
    lane_id: string;
    label: string;
    sort_order?: number;
    config?: object;
  }>();

  if (!body.scenario_id || !body.lane_id || !body.label) {
    return c.json({ error: 'BAD_REQUEST', message: 'scenario_id, lane_id, and label are required' }, 400);
  }

  const lane = await createLane(
    c.env.DB,
    body.scenario_id,
    body.lane_id,
    body.label,
    body.sort_order ?? 0,
    body.config || {},
  );

  return c.json({ lane }, 201);
});

// --- Actor Management ---

/**
 * POST /api/m/actor
 * Add or modify an actor.
 */
mModeRoutes.post('/actor', async (c) => {
  const body = await c.req.json<{
    id?: number;
    scenario_id?: number;
    callsign?: string;
    team?: string;
    password?: string;
    lane_id?: string;
    status?: string;
  }>();

  if (body.id) {
    // Update existing actor
    if (body.lane_id !== undefined) {
      await updateActorLane(c.env.DB, body.id, body.lane_id);
    }
    if (body.status) {
      await updateActorStatus(c.env.DB, body.id, body.status);
    }
    const actor = await getActor(c.env.DB, body.id);
    return c.json({ actor });
  }

  // Create new actor
  if (!body.scenario_id || !body.callsign || !body.team) {
    return c.json(
      { error: 'BAD_REQUEST', message: 'scenario_id, callsign, and team are required' },
      400,
    );
  }

  const passwordHash = body.password ? await hashPassword(body.password) : '';
  const actor = await createActor(c.env.DB, body.scenario_id, body.callsign, body.team, passwordHash);

  // Optionally assign to lane
  if (body.lane_id) {
    await updateActorLane(c.env.DB, actor.id, body.lane_id);
  }

  return c.json({ actor }, 201);
});

// --- Event Injection ---

/**
 * POST /api/m/event
 * Director injects an event into the scenario timeline.
 * Used for authority actions: intel drops, radio intercepts, etc.
 */
mModeRoutes.post('/event', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json<EventPayload>();

  if (!body.event_type) {
    return c.json({ error: 'BAD_REQUEST', message: 'event_type is required' }, 400);
  }

  const event = await insertEvent(
    c.env.DB,
    auth.scenario_id,
    body.actor_id || auth.actor_id,
    body.event_type,
    { ...body.payload, injected_by: auth.callsign, lane_id: body.lane_id },
  );

  // Broadcast via Durable Object
  const roomId = c.env.SCENARIO_ROOM.idFromName(`scenario-${auth.scenario_id}`);
  const room = c.env.SCENARIO_ROOM.get(roomId);
  await room.fetch(
    new Request('http://internal/broadcast', {
      method: 'POST',
      body: JSON.stringify({
        type: 'event',
        data: { ...event, payload: JSON.parse(event.payload) },
        timestamp: Date.now(),
      }),
    }),
  );

  return c.json({ ok: true, event_id: event.id });
});

/**
 * GET /api/m/events/:scenarioId
 * Full event log for a scenario.
 */
mModeRoutes.get('/events/:scenarioId', async (c) => {
  const scenarioId = parseInt(c.req.param('scenarioId'), 10);
  const limit = parseInt(c.req.query('limit') || '200', 10);
  const afterId = c.req.query('after_id') ? parseInt(c.req.query('after_id')!, 10) : undefined;

  const events = await getEvents(c.env.DB, scenarioId, limit, afterId);
  return c.json({
    events: events.map((e) => ({
      ...e,
      payload: JSON.parse(e.payload),
    })),
  });
});

// --- Escalation ---

/**
 * POST /api/m/escalation
 * Trigger an escalation tier change for a scenario.
 */
mModeRoutes.post('/escalation', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json<EscalationRequest>();

  if (!body.scenario_id || body.tier === undefined) {
    return c.json({ error: 'BAD_REQUEST', message: 'scenario_id and tier are required' }, 400);
  }

  const event = await insertEvent(c.env.DB, body.scenario_id, auth.actor_id, 'escalation', {
    tier: body.tier,
    message: body.message || `Escalation to tier ${body.tier}`,
    triggered_by: auth.callsign,
  });

  // Broadcast escalation
  const roomId = c.env.SCENARIO_ROOM.idFromName(`scenario-${body.scenario_id}`);
  const room = c.env.SCENARIO_ROOM.get(roomId);
  await room.fetch(
    new Request('http://internal/broadcast', {
      method: 'POST',
      body: JSON.stringify({
        type: 'escalation',
        data: {
          tier: body.tier,
          message: body.message,
          event_id: event.id,
        },
        timestamp: Date.now(),
      }),
    }),
  );

  return c.json({ ok: true, event_id: event.id, tier: body.tier });
});

// --- Join Codes ---

/**
 * POST /api/m/join-code
 * Generate a join code for a scenario.
 */
mModeRoutes.post('/join-code', async (c) => {
  const body = await c.req.json<{
    scenario_id: number;
    team: string;
    max_uses?: number;
  }>();

  if (!body.scenario_id || !body.team) {
    return c.json({ error: 'BAD_REQUEST', message: 'scenario_id and team are required' }, 400);
  }

  // Generate a 6-char uppercase code
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const code = Array.from(bytes)
    .map((b) => b.toString(36).toUpperCase())
    .join('')
    .slice(0, 6);

  const joinCode = await createJoinCode(c.env.DB, code, body.scenario_id, body.team, body.max_uses || 50);
  return c.json({ join_code: joinCode }, 201);
});

// --- WebSocket ---

/**
 * GET /api/m/ws
 * Upgrade to WebSocket via ScenarioRoom Durable Object.
 */
mModeRoutes.get('/ws', async (c) => {
  const auth = c.get('auth');
  const roomId = c.env.SCENARIO_ROOM.idFromName(`scenario-${auth.scenario_id}`);
  const room = c.env.SCENARIO_ROOM.get(roomId);

  const url = new URL(c.req.url);
  url.pathname = '/ws';
  url.searchParams.set('actor_id', String(auth.actor_id));
  url.searchParams.set('callsign', auth.callsign);
  url.searchParams.set('role', auth.role);

  return room.fetch(
    new Request(url.toString(), {
      headers: c.req.raw.headers,
    }),
  );
});
