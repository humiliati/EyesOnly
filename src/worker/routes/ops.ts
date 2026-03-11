/* ============================================================
   EYES ONLY — Ops API Routes
   Field operative endpoints: check-in, dead drops, events.
   Requires auth token (Red or Blue team).
   ============================================================ */

import { Hono } from 'hono';
import type { Env, AuthContext, CheckinRequest, DeadDropRequest, TelemetryRequest, PanicRequest, PushSubscribeRequest, MicrochatSendRequest, PlayerLocationRequest } from '../../shared/types';
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
  updateActorTelemetry,
  updateActorOpsTelemetryVisible,
  hasScenarioUserRole,
  createDeadDrop,
  retrieveDeadDrop,
  getDeadDropsByLane,
  listDeadDrops,
  getActor,
  getGridCell,
  getGridCells,
  listActiveGeofenceZones,
  getActorGeofenceState,
  upsertActorGeofenceState,
  upsertPushSubscription,
  deletePushSubscription,
  getPushSubscriptionsByScenario,
  getActiveScenarioBeats,
  unlockScenarioBeat,
  upsertPlayerLocation,
  insertMicrochatMessage,
  getMicrochatMessages,
  markMicrochatDelivered,
} from '../db/queries';
import { sendWebPushToAll } from '../utils/web-push';

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
      [],
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

    let items: string[] = [];
    try {
      items = activeDrop.items_json ? JSON.parse(activeDrop.items_json) : [];
      if (!Array.isArray(items)) items = [];
    } catch {
      items = [];
    }

    event = await insertEvent(c.env.DB, auth.scenario_id, auth.actor_id, 'dead_drop_retrieved', {
      dead_drop_id: activeDrop.id,
      lane_id: body.lane_id,
      callsign: auth.callsign,
      items,
    });

    // Include item payload so ops tools can mirror the old KV flow.
    // NOTE: This does not itself grant items; it informs M for grant processing.
    const roomId = c.env.SCENARIO_ROOM.idFromName(`scenario-${auth.scenario_id}`);
    const room = c.env.SCENARIO_ROOM.get(roomId);
    await room.fetch(new Request('http://internal/broadcast', {
      method: 'POST',
      body: JSON.stringify({
        type: 'event',
        data: { ...event, payload: { ...JSON.parse(event.payload), items } },
        timestamp: Date.now(),
      }),
    }));

    return c.json({ ok: true, event_id: event.id, items });
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
 * GET /api/ops/status
 * Full context for the authenticated actor: cell, lane, tension, pending pings, frozen state.
 */
opsRoutes.get('/status', async (c) => {
  const auth = c.get('auth');
  const actor = await getActor(c.env.DB, auth.actor_id);
  if (!actor) return c.json({ error: 'NOT_FOUND', message: 'Actor not found' }, 404);

  const scenario = await getScenario(c.env.DB, auth.scenario_id);
  const config = scenario ? JSON.parse(scenario.config) : {};

  // Get cell info if actor is in a cell
  let cell = null;
  if (actor.cell_id) {
    cell = await getGridCell(c.env.DB, auth.scenario_id, actor.cell_id);
  }

  // Get pending pings
  const events = await getEvents(c.env.DB, auth.scenario_id, 50);
  const pings = events
    .filter((e) => e.event_type === 'mping')
    .map((e) => ({ ...e, payload: JSON.parse(e.payload) }))
    .filter((e) => e.payload.target_actor_id === auth.actor_id);
  const acks = events
    .filter((e) => e.event_type === 'mping_ack')
    .map((e) => ({ ...e, payload: JSON.parse(e.payload) }))
    .filter((e) => e.payload.actor_id === auth.actor_id);
  const ackedIds = new Set(acks.map((a) => a.payload.ping_event_id));
  const pendingPings = pings.filter((p) => !ackedIds.has(p.id));
  const lastPing = pings[0] || null;

  return c.json({
    actor: {
      id: actor.id,
      callsign: actor.callsign,
      team: actor.team,
      status: actor.status,
      cell_id: actor.cell_id || null,
      lane_id: actor.lane_id || null,
    },
    cell: cell ? {
      cell_id: cell.cell_id,
      status: cell.status,
      tension: cell.tension,
      lane_id: cell.lane_id,
    } : null,
    scenario: {
      name: scenario?.name || 'UNKNOWN',
      frozen: config.frozen || false,
    },
    pending_pings: pendingPings.length,
    last_ping: lastPing ? {
      command: lastPing.payload.ping_command,
      cell_id: lastPing.payload.cell_id,
      message: lastPing.payload.message,
      sent_at: lastPing.created_at,
      acked: ackedIds.has(lastPing.id),
    } : null,
  });
});

/**
 * POST /api/ops/ack
 * Acknowledge an M ping directive. Creates an ack event and broadcasts.
 */
opsRoutes.post('/ack', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json<{ ping_event_id: number; message?: string }>();

  if (!body.ping_event_id) {
    return c.json({ error: 'BAD_REQUEST', message: 'ping_event_id required' }, 400);
  }

  const ackPayload = {
    ping_event_id: body.ping_event_id,
    acked_by: auth.callsign,
    actor_id: auth.actor_id,
    message: body.message || '',
    acked_at: Date.now(),
  };

  const event = await insertEvent(c.env.DB, auth.scenario_id, auth.actor_id, 'mping_ack', ackPayload);

  // Broadcast ack to all connected clients (M will see it)
  const roomId = c.env.SCENARIO_ROOM.idFromName(`scenario-${auth.scenario_id}`);
  const room = c.env.SCENARIO_ROOM.get(roomId);
  await room.fetch(new Request('http://internal/broadcast', {
    method: 'POST',
    body: JSON.stringify({
      type: 'mping_ack',
      data: { ...ackPayload, event_id: event.id },
      timestamp: Date.now(),
    }),
  }));

  return c.json({ ok: true, event_id: event.id });
});

/**
 * GET /api/ops/pings
 * Get pending pings for the authenticated actor.
 */
opsRoutes.get('/pings', async (c) => {
  const auth = c.get('auth');
  const events = await getEvents(c.env.DB, auth.scenario_id, 100);

  const pings = events
    .filter((e) => e.event_type === 'mping')
    .map((e) => ({ ...e, payload: JSON.parse(e.payload) }))
    .filter((e) => e.payload.target_actor_id === auth.actor_id);

  const acks = events
    .filter((e) => e.event_type === 'mping_ack')
    .map((e) => ({ ...e, payload: JSON.parse(e.payload) }))
    .filter((e) => e.payload.actor_id === auth.actor_id);

  const ackedIds = new Set(acks.map((a) => a.payload.ping_event_id));

  return c.json({
    pings: pings.map((p) => ({
      ...p,
      acked: ackedIds.has(p.id),
    })).reverse(),
  });
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
 * POST /api/ops/pingback
 * Player sends a manual pingback to the scenario event log.
 * Only available when scenario-joined (requires auth token).
 * M Mode will see this as a 'player_pingback' event in the event feed.
 */
opsRoutes.post('/pingback', async (c) => {
  const auth = c.get('auth');

  const event = await insertEvent(c.env.DB, auth.scenario_id, auth.actor_id, 'player_pingback', {
    callsign: auth.callsign,
    pinged_at: Date.now(),
  });

  // Broadcast via Durable Object so M Mode sees it in real time
  const roomId = c.env.SCENARIO_ROOM.idFromName(`scenario-${auth.scenario_id}`);
  const room = c.env.SCENARIO_ROOM.get(roomId);
  await room.fetch(new Request('http://internal/broadcast', {
    method: 'POST',
    body: JSON.stringify({
      type: 'event',
      data: { ...event, payload: JSON.parse(event.payload) },
      timestamp: Date.now(),
    }),
  }));

  return c.json({ ok: true, event_id: event.id });
});

/**
 * GET /api/ops/actors/positions
 * Returns last-known GPS position and telemetry for actors in the ops actor's scenario.
 * By default, this is scoped to red team because ops is intended as red-team support.
 *
 * Privacy rule:
 * - M can see full telemetry.
 * - Ops can see all red-team actors, but each actor can hide their lat/lng from other ops.
 * - An actor always sees their own lat/lng.
 */
opsRoutes.get('/actors/positions', async (c) => {
  const auth = c.get('auth');

  // Only ops-moderators may view other actors.
  if (!auth.user_id) {
    return c.json({ error: 'FORBIDDEN', message: 'Account-linked ops session required' }, 403);
  }
  const ok = await hasScenarioUserRole(c.env.DB, auth.scenario_id, auth.user_id, 'ops');
  if (!ok) {
    return c.json({ error: 'FORBIDDEN', message: 'Ops moderator role required' }, 403);
  }

  const team = (c.req.query('team') || 'red').toLowerCase();
  if (team !== 'red') {
    return c.json({ error: 'BAD_REQUEST', message: 'Only team=red is supported for ops positions' }, 400);
  }

  const actors = (await listActors(c.env.DB, auth.scenario_id))
    .filter((a) => a.team === 'red');

  return c.json({
    positions: actors.map((a: any) => {
      const visible = (a.ops_telemetry_visible ?? 1) ? true : false;
      const isSelf = a.id === auth.actor_id;
      const shouldReveal = isSelf || visible;
      return {
        actor_id:     a.id,
        callsign:     a.callsign,
        team:         a.team,
        status:       a.status,
        lane_id:      a.lane_id ?? null,
        cell_id:      a.cell_id ?? null,
        lat:          shouldReveal ? (a.last_lat ?? null) : null,
        lng:          shouldReveal ? (a.last_lng ?? null) : null,
        last_seen_at: a.last_seen_at ?? null,
        motion_state: a.motion_state ?? 'unknown',
        gps_hidden:   !shouldReveal,
      };
    }),
    as_of: Date.now(),
  });
});

/**
 * POST /api/ops/telemetry/visibility
 * Toggle whether this actor's GPS is visible to other ops viewers.
 * NOTE: This does not affect what M sees.
 */
opsRoutes.post('/telemetry/visibility', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json<{ visible: boolean }>().catch(() => ({ visible: true }));
  await updateActorOpsTelemetryVisible(c.env.DB, auth.actor_id, !!body.visible);
  return c.json({ ok: true, visible: !!body.visible });
});

/**
 * POST /api/ops/telemetry
 * Actor heartbeat: GPS position + accelerometer data.
 * Sent every 10–30 seconds by the smartwatch/ops app.
 * Updates the actor's last-known position and broadcasts to M console.
 */
opsRoutes.post('/telemetry', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json<TelemetryRequest>();

  // Classify motion state from accelerometer magnitude if not provided
  let motionState = body.motion_state ?? 'unknown';
  if (motionState === 'unknown' && body.accel_x != null && body.accel_y != null && body.accel_z != null) {
    const mag = Math.sqrt(body.accel_x ** 2 + body.accel_y ** 2 + body.accel_z ** 2);
    if (mag < 0.5)       motionState = 'stationary';
    else if (mag < 3)    motionState = 'walking';
    else if (mag < 8)    motionState = 'running';
    else if (mag < 15)   motionState = 'vehicle';
    else                 motionState = 'dropped';
  }

  // Update actor telemetry in DB
  await updateActorTelemetry(c.env.DB, auth.actor_id, {
    lat: body.lat,
    lng: body.lng,
    accel_x: body.accel_x,
    accel_y: body.accel_y,
    accel_z: body.accel_z,
    motion_state: motionState,
  });

  // ── Geo-trigger check ─────────────────────────────────────────────
  // Only run if actor has valid GPS coordinates
  const triggeredZones: string[] = [];
  if (body.lat != null && body.lng != null) {
    const zones = await listActiveGeofenceZones(c.env.DB, auth.scenario_id);
    for (const zone of zones) {
      const distM = haversineMeters(body.lat, body.lng, zone.lat, zone.lng);
      const nowInside = distM <= zone.radius_m;
      const prevState = await getActorGeofenceState(c.env.DB, auth.actor_id, zone.id);
      const wasInside = prevState?.inside === 1;

      const isEnter = !wasInside && nowInside;
      const isExit  = wasInside && !nowInside;
      const shouldFire =
        (zone.trigger_on === 'enter' && isEnter) ||
        (zone.trigger_on === 'exit' && isExit) ||
        (zone.trigger_on === 'both' && (isEnter || isExit));

      if (shouldFire) {
        await upsertActorGeofenceState(c.env.DB, auth.actor_id, zone.id, nowInside);

        const triggerPayload = {
          actor_id:   auth.actor_id,
          callsign:   auth.callsign,
          zone_id:    zone.id,
          zone_name:  zone.name,
          transition: isEnter ? 'enter' : 'exit',
          dist_m:     Math.round(distM),
          lat:        body.lat,
          lng:        body.lng,
          ts:         Date.now(),
        };

        const event = await insertEvent(
          c.env.DB,
          auth.scenario_id,
          auth.actor_id,
          zone.trigger_event_type,
          triggerPayload,
        );

        const roomId = c.env.SCENARIO_ROOM.idFromName(`scenario-${auth.scenario_id}`);
        const room   = c.env.SCENARIO_ROOM.get(roomId);
        await room.fetch(new Request('http://internal/broadcast', {
          method: 'POST',
          body: JSON.stringify({
            type: 'geofence_trigger',
            data: { ...triggerPayload, event_id: event.id },
            timestamp: Date.now(),
          }),
        }));

        triggeredZones.push(zone.name);
      } else if (prevState?.inside !== (nowInside ? 1 : 0)) {
        // Update state even if no fire (crossed boundary of inactive trigger type)
        await upsertActorGeofenceState(c.env.DB, auth.actor_id, zone.id, nowInside);
      }
    }

    // ── Beat-unlock check (Phase 3) ─────────────────────────────────
    // Check if this actor's position triggers any unlocked story beats.
    const unlockedBeats: string[] = [];
    const activeBeats = await getActiveScenarioBeats(c.env.DB, auth.scenario_id);
    for (const beat of activeBeats) {
      if (beat.lat == null || beat.lng == null) continue;
      const distM = haversineMeters(body.lat, body.lng, beat.lat, beat.lng);
      if (distM <= beat.trigger_radius_m) {
        await unlockScenarioBeat(c.env.DB, beat.id);
        const beatEvent = await insertEvent(c.env.DB, auth.scenario_id, auth.actor_id, beat.event_type, {
          beat_id:    beat.id,
          beat_title: beat.title,
          beat_seq:   beat.beat_seq,
          triggered_by: auth.callsign,
          dist_m:     Math.round(distM),
          lat: body.lat,
          lng: body.lng,
          ts: Date.now(),
        });
        const roomId = c.env.SCENARIO_ROOM.idFromName(`scenario-${auth.scenario_id}`);
        const room   = c.env.SCENARIO_ROOM.get(roomId);
        await room.fetch(new Request('http://internal/broadcast', {
          method: 'POST',
          body: JSON.stringify({
            type: 'beat_unlock',
            data: { beat_id: beat.id, beat_title: beat.title, beat_seq: beat.beat_seq, event_id: beatEvent.id },
            timestamp: Date.now(),
          }),
        }));
        unlockedBeats.push(beat.title);
      }
    }
    // ────────────────────────────────────────────────────────────────
  }
  // ──────────────────────────────────────────────────────────────────

  // Broadcast lightweight telemetry update (no DB event insert to avoid log spam).
  // NOTE: Do NOT include lat/lng in WS payloads — ops clients also connect to the same room.
  // M should refresh positions via /api/m/actors/positions/:scenarioId.
  const roomId = c.env.SCENARIO_ROOM.idFromName(`scenario-${auth.scenario_id}`);
  const room = c.env.SCENARIO_ROOM.get(roomId);
  await room.fetch(new Request('http://internal/broadcast', {
    method: 'POST',
    body: JSON.stringify({
      type: 'actor_telemetry',
      data: {
        actor_id:     auth.actor_id,
        callsign:     auth.callsign,
        lat:          null,
        lng:          null,
        motion_state: motionState,
        battery:      body.battery ?? null,
        low_power:    body.low_power ?? false,
        ts:           Date.now(),
      },
      timestamp: Date.now(),
    }),
  }));

  return c.json({ ok: true, motion_state: motionState, triggered_zones: triggeredZones });
});

/**
 * POST /api/ops/panic
 * Emergency abort — actor signals distress.
 * Inserts a high-priority event, M console is alerted immediately.
 */
opsRoutes.post('/panic', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json<PanicRequest>().catch(() => ({} as PanicRequest));

  const event = await insertEvent(c.env.DB, auth.scenario_id, auth.actor_id, 'actor_panic', {
    callsign: auth.callsign,
    lat:      body.lat ?? null,
    lng:      body.lng ?? null,
    message:  body.message || 'PANIC — ACTOR ABORT',
    ts:       Date.now(),
  });

  const roomId = c.env.SCENARIO_ROOM.idFromName(`scenario-${auth.scenario_id}`);
  const room = c.env.SCENARIO_ROOM.get(roomId);
  await room.fetch(new Request('http://internal/broadcast', {
    method: 'POST',
    body: JSON.stringify({
      type: 'event',
      data: { ...event, payload: JSON.parse(event.payload) },
      timestamp: Date.now(),
    }),
  }));

  return c.json({ ok: true, event_id: event.id });
});

// ===== Haversine distance helper (meters) =====
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R  = 6371000; // Earth radius in metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * POST /api/ops/push-subscribe
 * Register a Web Push subscription for the actor's device.
 * Called once on login from the watch app after push permission is granted.
 */
opsRoutes.post('/push-subscribe', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json<PushSubscribeRequest>();

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return c.json({ error: 'BAD_REQUEST', message: 'endpoint, keys.p256dh and keys.auth required' }, 400);
  }

  await upsertPushSubscription(
    c.env.DB,
    auth.actor_id,
    auth.scenario_id,
    body.endpoint,
    body.keys.p256dh,
    body.keys.auth,
  );

  return c.json({ ok: true });
});

/**
 * DELETE /api/ops/push-subscribe
 * Unregister a Web Push subscription.
 */
opsRoutes.delete('/push-subscribe', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json<{ endpoint: string }>().catch(() => ({ endpoint: '' }));
  if (body.endpoint) {
    await deletePushSubscription(c.env.DB, auth.actor_id, body.endpoint);
  }
  return c.json({ ok: true });
});

/**
 * GET /api/ops/nfc-drop?tag=<nfc-tag-id>
 * Look up a dead drop by its NFC tag ID (stored in the drop label).
 * When the watch app scans an NFC tag, it sends the tag serial here.
 * If a matching active dead drop is found, auto-retrieve it.
 */
opsRoutes.get('/nfc-drop', async (c) => {
  const auth = c.get('auth');
  const tag  = c.req.query('tag');
  if (!tag) return c.json({ error: 'BAD_REQUEST', message: 'tag query param required' }, 400);

  // All active drops in scenario — search by label containing the tag
  const allDrops = await listDeadDrops(c.env.DB, auth.scenario_id);
  const match = allDrops.find((d) =>
    (d.status === 'placed' || d.status === 'active') &&
    d.label.toLowerCase().includes(tag.toLowerCase()),
  );

  if (!match) {
    return c.json({ found: false, message: 'No active dead drop matches this NFC tag.' });
  }

  return c.json({
    found:       true,
    dead_drop_id: match.id,
    label:       match.label,
    lane_id:     match.lane_id,
    lat:         match.lat,
    lng:         match.lng,
    message:     `Dead drop "${match.label}" found. Tap RETRIEVE to confirm.`,
  });
});

/**
 * GET /api/ops/map
 * Shared tactical map for ops: grid config, cell states, scenario nodes (read-only).
 * Visibility: ops (blue) sees all cell states + nodes. Red team positions filtered.
 */
opsRoutes.get('/map', async (c) => {
  const auth = c.get('auth');
  const scenario = await getScenario(c.env.DB, auth.scenario_id);
  if (!scenario) return c.json({ error: 'NOT_FOUND', message: 'Scenario not found' }, 404);

  const config = typeof scenario.config === 'string'
    ? JSON.parse(scenario.config || '{}')
    : (scenario.config || {});

  // Grid cells
  const cells = await getGridCells(c.env.DB, auth.scenario_id);

  // Scenario nodes (read-only view)
  const nodes = config.nodes || [];
  const connections = config.connections || [];

  // Map URL from R2
  const mapKey = config.map_key;
  let mapUrl: string | null = null;
  if (mapKey) {
    const head = await c.env.R2.head(mapKey);
    if (head) mapUrl = `/${mapKey}`;
  }

  return c.json({
    map_url: mapUrl,
    grid: config.grid || null,
    cells: cells.map((cell) => ({
      cell_id: cell.cell_id,
      col: cell.col,
      row: cell.row,
      lane_id: cell.lane_id,
      status: cell.status,
      tension: cell.tension,
    })),
    nodes: nodes.map((n: any) => ({
      id: n.id,
      type: n.type,
      cell_id: n.cell_id,
      label: n.label,
      status: n.status || 'pending',
    })),
    connections,
  });
});

/**
 * GET /api/ops/ws
 * Upgrade to WebSocket via ScenarioRoom Durable Object.
 */
opsRoutes.get('/ws', async (c) => {
  try {
    console.log('[OPS WS] Upgrade request received');
    const auth = c.get('auth');
    console.log('[OPS WS] Auth:', JSON.stringify({ actor_id: auth.actor_id, callsign: auth.callsign, role: auth.role, scenario_id: auth.scenario_id }));

    const roomId = c.env.SCENARIO_ROOM.idFromName(`scenario-${auth.scenario_id}`);
    const room = c.env.SCENARIO_ROOM.get(roomId);

    // Forward the WebSocket upgrade request to the Durable Object
    const url = new URL(c.req.url);
    url.pathname = '/ws';
    url.searchParams.set('actor_id', String(auth.actor_id));
    url.searchParams.set('callsign', auth.callsign);
    url.searchParams.set('role', auth.role);

    console.log('[OPS WS] Forwarding to DO:', url.pathname);
    const resp = await room.fetch(new Request(url.toString(), {
      headers: c.req.raw.headers,
    }));
    console.log('[OPS WS] DO response status:', resp.status);
    return resp;
  } catch (err) {
    console.error('[OPS WS] Error:', err);
    return c.json({ error: 'WS_UPGRADE_FAILED', message: String(err) }, 500);
  }
});

// ── Phase 3: Microchat ────────────────────────────────────────────

/**
 * POST /api/ops/microchat
 * Actor sends an encrypted message to M (or another actor).
 * The server routes the ciphertext without decrypting it.
 * Key derivation and encryption happen entirely on the client.
 */
opsRoutes.post('/microchat', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json<MicrochatSendRequest>();

  if (!body.to_id || !body.ciphertext) {
    return c.json({ error: 'BAD_REQUEST', message: 'to_id and ciphertext required' }, 400);
  }

  const fromId = String(auth.actor_id);
  const msg = await insertMicrochatMessage(c.env.DB, auth.scenario_id, fromId, body.to_id, body.ciphertext);

  // Route to target: if to_id === 'M', audience = directors; otherwise target actor + directors
  const targetActorId = body.to_id === 'M' ? undefined : parseInt(body.to_id, 10);
  const audience = body.to_id === 'M' ? 'directors' : 'target';

  const roomId = c.env.SCENARIO_ROOM.idFromName(`scenario-${auth.scenario_id}`);
  const room   = c.env.SCENARIO_ROOM.get(roomId);
  await room.fetch(new Request('http://internal/broadcast', {
    method: 'POST',
    body: JSON.stringify({
      type: 'actor_message',
      data: { msg_id: msg.id, from_id: fromId, to_id: body.to_id, ciphertext: body.ciphertext, ts: Date.now() },
      timestamp: Date.now(),
      audience,
      target_actor_id: targetActorId,
    }),
  }));

  return c.json({ ok: true, msg_id: msg.id });
});

/**
 * GET /api/ops/microchat
 * Get the microchat thread for the authenticated actor (messages to/from M).
 * Query params: limit (default 30)
 */
opsRoutes.get('/microchat', async (c) => {
  const auth = c.get('auth');
  const limit = parseInt(c.req.query('limit') || '30', 10);
  const msgs = await getMicrochatMessages(c.env.DB, auth.scenario_id, String(auth.actor_id), limit);
  return c.json({ messages: msgs });
});

/**
 * POST /api/ops/microchat/:id/ack
 * Actor confirms message delivery. Broadcasts actor_message_ack to M.
 */
opsRoutes.post('/microchat/:id/ack', async (c) => {
  const auth = c.get('auth');
  const msgId = parseInt(c.req.param('id'), 10);
  await markMicrochatDelivered(c.env.DB, msgId);

  const roomId = c.env.SCENARIO_ROOM.idFromName(`scenario-${auth.scenario_id}`);
  const room   = c.env.SCENARIO_ROOM.get(roomId);
  await room.fetch(new Request('http://internal/broadcast', {
    method: 'POST',
    body: JSON.stringify({
      type: 'actor_message_ack',
      data: { msg_id: msgId, actor_id: auth.actor_id, callsign: auth.callsign, ts: Date.now() },
      timestamp: Date.now(),
      audience: 'directors',
    }),
  }));

  return c.json({ ok: true });
});

// ── Phase 3: Player Location Reporting ───────────────────────────

/**
 * POST /api/player/location
 * Player terminal reports GPS position with consent.
 * M Console sees player dots on the live map.
 * Check beat-unlock triggers against active scenario beats.
 */
opsRoutes.post('/player-location', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json<PlayerLocationRequest>();

  if (body.lat == null || body.lng == null) {
    return c.json({ error: 'BAD_REQUEST', message: 'lat and lng required' }, 400);
  }

  const playerId = body.player_id || auth.callsign;
  await upsertPlayerLocation(c.env.DB, playerId, auth.scenario_id, body.lat, body.lng, body.accuracy_m);

  // Broadcast player location to directors only (M console live map — not visible to other players)
  const roomId = c.env.SCENARIO_ROOM.idFromName(`scenario-${auth.scenario_id}`);
  const room   = c.env.SCENARIO_ROOM.get(roomId);
  await room.fetch(new Request('http://internal/broadcast', {
    method: 'POST',
    body: JSON.stringify({
      type: 'player_location',
      data: { player_id: playerId, lat: body.lat, lng: body.lng, accuracy_m: body.accuracy_m ?? null, ts: Date.now() },
      timestamp: Date.now(),
      audience: 'directors',
    }),
  }));

  // ── Beat-unlock check for player position ──────────────────────
  const unlockedBeats: string[] = [];
  const activeBeats = await getActiveScenarioBeats(c.env.DB, auth.scenario_id);
  for (const beat of activeBeats) {
    if (beat.lat == null || beat.lng == null) continue;
    const distM = haversineMeters(body.lat, body.lng, beat.lat, beat.lng);
    if (distM <= beat.trigger_radius_m) {
      await unlockScenarioBeat(c.env.DB, beat.id);
      const beatEvent = await insertEvent(c.env.DB, auth.scenario_id, auth.actor_id, beat.event_type, {
        beat_id: beat.id, beat_title: beat.title, beat_seq: beat.beat_seq,
        triggered_by: playerId, source: 'player_location',
        dist_m: Math.round(distM), lat: body.lat, lng: body.lng, ts: Date.now(),
      });
      await room.fetch(new Request('http://internal/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          type: 'beat_unlock',
          data: { beat_id: beat.id, beat_title: beat.title, beat_seq: beat.beat_seq, event_id: beatEvent.id },
          timestamp: Date.now(),
        }),
      }));
      unlockedBeats.push(beat.title);
    }
  }
  // ──────────────────────────────────────────────────────────────

  return c.json({ ok: true, unlocked_beats: unlockedBeats });
});
