/* ============================================================
   EYES ONLY — Ops API Routes
   Field operative endpoints: check-in, dead drops, events.
   Requires auth token (Red or Blue team).
   ============================================================ */

import { Hono } from 'hono';
import type { Env, AuthContext, CheckinRequest, DeadDropRequest } from '../../shared/types';
import { requireAuth } from '../middleware/auth';
import {
  getScenario,
  getLanes,
  listActors,
  insertEvent,
  getEvents,
  getEventsByLane,
  updateActorStatus,
  updateActorLane,
  createDeadDrop,
  retrieveDeadDrop,
  getDeadDropsByLane,
  listDeadDrops,
  getActor,
} from '../db/queries';

type HonoEnv = { Bindings: Env; Variables: { auth: AuthContext } };

export const opsRoutes = new Hono<HonoEnv>();

// All ops routes require authentication
opsRoutes.use('*', requireAuth);

/**
 * GET /api/ops/scenario
 * Get current scenario state for the authenticated actor.
 */
opsRoutes.get('/scenario', async (c) => {
  const auth = c.get('auth');
  const scenario = await getScenario(c.env.DB, auth.scenario_id);
  if (!scenario) {
    return c.json({ error: 'NOT_FOUND', message: 'Scenario not found' }, 404);
  }

  const lanes = await getLanes(c.env.DB, auth.scenario_id);
  const actor = await getActor(c.env.DB, auth.actor_id);

  return c.json({
    scenario: {
      id: scenario.id,
      name: scenario.name,
      status: scenario.status,
      config: JSON.parse(scenario.config),
    },
    lanes: lanes.map((l) => ({
      lane_id: l.lane_id,
      label: l.label,
      config: JSON.parse(l.config),
    })),
    actor: actor
      ? {
          id: actor.id,
          callsign: actor.callsign,
          team: actor.team,
          lane_id: actor.lane_id,
          status: actor.status,
        }
      : null,
  });
});

/**
 * POST /api/ops/checkin
 * Field check-in with optional GPS coordinates.
 */
opsRoutes.post('/checkin', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json<CheckinRequest>();

  // Record event
  const event = await insertEvent(c.env.DB, auth.scenario_id, auth.actor_id, 'checkin', {
    lat: body.lat,
    lng: body.lng,
    message: body.message || '',
    callsign: auth.callsign,
  });

  // Update actor status
  await updateActorStatus(c.env.DB, auth.actor_id, 'active');

  // Broadcast via Durable Object
  const roomId = c.env.SCENARIO_ROOM.idFromName(`scenario-${auth.scenario_id}`);
  const room = c.env.SCENARIO_ROOM.get(roomId);
  await room.fetch(new Request('http://internal/broadcast', {
    method: 'POST',
    body: JSON.stringify({
      type: 'event',
      data: event,
      timestamp: Date.now(),
    }),
  }));

  return c.json({ ok: true, event_id: event.id });
});

/**
 * POST /api/ops/dead-drop
 * Report a dead drop placed or retrieved.
 */
opsRoutes.post('/dead-drop', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json<DeadDropRequest>();

  if (!body.lane_id || !body.action) {
    return c.json({ error: 'BAD_REQUEST', message: 'lane_id and action are required' }, 400);
  }

  let event;

  if (body.action === 'place') {
    const drop = await createDeadDrop(
      c.env.DB,
      auth.scenario_id,
      body.lane_id,
      body.label || 'Dead Drop',
      auth.actor_id,
      body.lat,
      body.lng,
    );

    event = await insertEvent(c.env.DB, auth.scenario_id, auth.actor_id, 'dead_drop_placed', {
      dead_drop_id: drop.id,
      lane_id: body.lane_id,
      label: body.label,
      callsign: auth.callsign,
    });
  } else if (body.action === 'retrieve') {
    // Find the most recent active drop in this lane
    const drops = await getDeadDropsByLane(c.env.DB, auth.scenario_id, body.lane_id);
    const activeDrop = drops.find((d) => d.status === 'placed' || d.status === 'active');
    if (!activeDrop) {
      return c.json({ error: 'NOT_FOUND', message: 'No active dead drop in this lane' }, 404);
    }

    await retrieveDeadDrop(c.env.DB, activeDrop.id, auth.actor_id);

    event = await insertEvent(c.env.DB, auth.scenario_id, auth.actor_id, 'dead_drop_retrieved', {
      dead_drop_id: activeDrop.id,
      lane_id: body.lane_id,
      callsign: auth.callsign,
    });
  } else {
    return c.json({ error: 'BAD_REQUEST', message: 'action must be "place" or "retrieve"' }, 400);
  }

  // Broadcast via Durable Object
  const roomId = c.env.SCENARIO_ROOM.idFromName(`scenario-${auth.scenario_id}`);
  const room = c.env.SCENARIO_ROOM.get(roomId);
  await room.fetch(new Request('http://internal/broadcast', {
    method: 'POST',
    body: JSON.stringify({
      type: 'event',
      data: event,
      timestamp: Date.now(),
    }),
  }));

  return c.json({ ok: true, event_id: event!.id });
});

/**
 * GET /api/ops/events
 * Get recent events for the actor's scenario.
 * Query params: limit, after_id, lane_id
 */
opsRoutes.get('/events', async (c) => {
  const auth = c.get('auth');
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const afterId = c.req.query('after_id') ? parseInt(c.req.query('after_id')!, 10) : undefined;
  const laneId = c.req.query('lane_id');

  let events;
  if (laneId) {
    events = await getEventsByLane(c.env.DB, auth.scenario_id, laneId, limit);
  } else {
    events = await getEvents(c.env.DB, auth.scenario_id, limit, afterId);
  }

  return c.json({
    events: events.map((e) => ({
      ...e,
      payload: JSON.parse(e.payload),
    })),
  });
});

/**
 * GET /api/ops/ws
 * Upgrade to WebSocket via ScenarioRoom Durable Object.
 */
opsRoutes.get('/ws', async (c) => {
  const auth = c.get('auth');
  const roomId = c.env.SCENARIO_ROOM.idFromName(`scenario-${auth.scenario_id}`);
  const room = c.env.SCENARIO_ROOM.get(roomId);

  // Forward the WebSocket upgrade request to the Durable Object
  const url = new URL(c.req.url);
  url.pathname = '/ws';
  url.searchParams.set('actor_id', String(auth.actor_id));
  url.searchParams.set('callsign', auth.callsign);
  url.searchParams.set('role', auth.role);

  return room.fetch(new Request(url.toString(), {
    headers: c.req.raw.headers,
  }));
});
