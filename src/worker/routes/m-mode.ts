/* ============================================================
   EYES ONLY — M Mode API Routes
   Director console endpoints: scenario management, grid,
   actor control, escalation, event injection.
   Requires Director auth.
   ============================================================ */

import { Hono } from 'hono';
import type { Env, AuthContext, EventPayload, EscalationRequest, GeofenceRequest } from '../../shared/types';
import { requireAuth, requireDirector } from '../middleware/auth';
import {
  listScenarios,
  getScenario,
  createScenario,
  updateScenarioStatus,
  updateScenarioConfig,
  getLanes,
  createLane,
  listActors,
  createActor,
  updateActorStatus,
  updateActorLane,
  updateActorCell,
  getActor,
  insertEvent,
  getEvents,
  listDeadDrops,
  createJoinCode,
  hashPassword,
  getGridCells,
  getGridCell,
  deleteGridCells,
  bulkCreateGridCells,
  updateCellStatus,
  updateCellTension,
  updateCellLane,
  updateCellNotes,
  listGeofenceZones,
  createGeofenceZone,
  deleteGeofenceZone,
  setGeofenceZoneActive,
  getPushSubscriptionsByScenario,
} from '../db/queries';
import { sendWebPushToAll } from '../utils/web-push';

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

// --- UGRS Grid ---

/**
 * POST /api/m/grid/calibrate
 * Save grid config and bulk-create grid cells.
 */
mModeRoutes.post('/grid/calibrate', async (c) => {
  const body = await c.req.json<{
    scenario_id: number;
    cols: number;
    rows: number;
    origin_px?: [number, number];
    block_w_px?: number;
    block_h_px?: number;
    col_labels?: string[];
    row_labels?: string[];
  }>();

  if (!body.scenario_id || !body.cols || !body.rows) {
    return c.json({ error: 'BAD_REQUEST', message: 'scenario_id, cols, and rows are required' }, 400);
  }

  const scenario = await getScenario(c.env.DB, body.scenario_id);
  if (!scenario) return c.json({ error: 'NOT_FOUND', message: 'Scenario not found' }, 404);

  // Generate labels
  const colLabels = body.col_labels || Array.from({ length: body.cols }, (_, i) => String.fromCharCode(65 + i));
  const rowLabels = body.row_labels || Array.from({ length: body.rows }, (_, i) => String(i + 1));

  // Save grid config to scenario
  const config = JSON.parse(scenario.config);
  config.grid = {
    cols: body.cols,
    rows: body.rows,
    origin_px: body.origin_px || [0, 0],
    block_w_px: body.block_w_px || 0,
    block_h_px: body.block_h_px || 0,
    col_labels: colLabels,
    row_labels: rowLabels,
  };
  await updateScenarioConfig(c.env.DB, body.scenario_id, config);

  // Delete existing cells and create new grid
  await deleteGridCells(c.env.DB, body.scenario_id);
  const cells: Array<{ cell_id: string; col: number; row: number }> = [];
  for (let r = 0; r < body.rows; r++) {
    for (let ci = 0; ci < body.cols; ci++) {
      cells.push({ cell_id: `${colLabels[ci]}${rowLabels[r]}`, col: ci, row: r });
    }
  }
  await bulkCreateGridCells(c.env.DB, body.scenario_id, cells);

  const gridCells = await getGridCells(c.env.DB, body.scenario_id);
  return c.json({ cells: gridCells, config: config.grid });
});

/**
 * GET /api/m/grid/:scenarioId/cells
 * All grid cells with actors and dead drops per cell.
 */
mModeRoutes.get('/grid/:scenarioId/cells', async (c) => {
  const scenarioId = parseInt(c.req.param('scenarioId'), 10);
  const scenario = await getScenario(c.env.DB, scenarioId);
  if (!scenario) return c.json({ error: 'NOT_FOUND', message: 'Scenario not found' }, 404);

  const [gridCells, actors, deadDrops] = await Promise.all([
    getGridCells(c.env.DB, scenarioId),
    listActors(c.env.DB, scenarioId),
    listDeadDrops(c.env.DB, scenarioId),
  ]);

  const config = JSON.parse(scenario.config);

  return c.json({
    config: config.grid || null,
    frozen: config.frozen || false,
    cells: gridCells.map((cell) => ({
      ...cell,
      actors: actors.filter((a) => a.cell_id === cell.cell_id).map((a) => ({
        id: a.id, callsign: a.callsign, team: a.team, status: a.status,
      })),
      dead_drops: deadDrops.filter((d) => d.cell_id === cell.cell_id).map((d) => ({
        id: d.id, label: d.label, status: d.status,
      })),
    })),
    unassigned_actors: actors.filter((a) => !a.cell_id).map((a) => ({
      id: a.id, callsign: a.callsign, team: a.team, status: a.status, lane_id: a.lane_id,
    })),
  });
});

/**
 * PATCH /api/m/cell
 * Update a single grid cell (status, tension, notes, lane_id).
 */
mModeRoutes.patch('/cell', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json<{
    scenario_id: number;
    cell_id: string;
    status?: string;
    tension?: number;
    notes?: string;
    lane_id?: string | null;
  }>();

  if (!body.scenario_id || !body.cell_id) {
    return c.json({ error: 'BAD_REQUEST', message: 'scenario_id and cell_id required' }, 400);
  }

  if (body.status !== undefined) await updateCellStatus(c.env.DB, body.scenario_id, body.cell_id, body.status);
  if (body.tension !== undefined) await updateCellTension(c.env.DB, body.scenario_id, body.cell_id, body.tension);
  if (body.notes !== undefined) await updateCellNotes(c.env.DB, body.scenario_id, body.cell_id, body.notes);
  if (body.lane_id !== undefined) await updateCellLane(c.env.DB, body.scenario_id, body.cell_id, body.lane_id);

  // Log the cell update event
  await insertEvent(c.env.DB, body.scenario_id, auth.actor_id, 'cell_update', {
    cell_id: body.cell_id, status: body.status, tension: body.tension, updated_by: auth.callsign,
  });

  const cell = await getGridCell(c.env.DB, body.scenario_id, body.cell_id);
  return c.json({ cell });
});

/**
 * POST /api/m/cell/batch
 * Batch update cells — for lane assignment.
 */
mModeRoutes.post('/cell/batch', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json<{
    scenario_id: number;
    cell_ids: string[];
    lane_id: string | null;
  }>();

  if (!body.scenario_id || !body.cell_ids) {
    return c.json({ error: 'BAD_REQUEST', message: 'scenario_id and cell_ids required' }, 400);
  }

  for (const cellId of body.cell_ids) {
    await updateCellLane(c.env.DB, body.scenario_id, cellId, body.lane_id);
  }

  await insertEvent(c.env.DB, body.scenario_id, auth.actor_id, 'lane_assign', {
    cell_ids: body.cell_ids, lane_id: body.lane_id, updated_by: auth.callsign,
  });

  return c.json({ ok: true, updated: body.cell_ids.length });
});

/**
 * POST /api/m/actor/move
 * Move an actor to a grid cell.
 */
mModeRoutes.post('/actor/move', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json<{
    actor_id: number;
    cell_id: string;
  }>();

  if (!body.actor_id || !body.cell_id) {
    return c.json({ error: 'BAD_REQUEST', message: 'actor_id and cell_id required' }, 400);
  }

  const actor = await getActor(c.env.DB, body.actor_id);
  if (!actor) return c.json({ error: 'NOT_FOUND', message: 'Actor not found' }, 404);

  const fromCell = actor.cell_id || null;
  await updateActorCell(c.env.DB, body.actor_id, body.cell_id);

  // Also update lane_id if the target cell has a lane
  const cell = await getGridCell(c.env.DB, actor.scenario_id, body.cell_id);
  if (cell?.lane_id) {
    await updateActorLane(c.env.DB, body.actor_id, cell.lane_id);
  }

  const event = await insertEvent(c.env.DB, actor.scenario_id, auth.actor_id, 'actor_move', {
    actor_id: body.actor_id, callsign: actor.callsign, from_cell: fromCell, to_cell: body.cell_id,
    moved_by: auth.callsign,
  });

  // Broadcast
  const roomId = c.env.SCENARIO_ROOM.idFromName(`scenario-${actor.scenario_id}`);
  const room = c.env.SCENARIO_ROOM.get(roomId);
  await room.fetch(new Request('http://internal/broadcast', {
    method: 'POST',
    body: JSON.stringify({ type: 'actor_update', data: { actor_id: body.actor_id, cell_id: body.cell_id }, timestamp: Date.now() }),
  }));

  return c.json({ ok: true, event_id: event.id });
});

/**
 * POST /api/m/actor/command
 * Issue command to an actor: hold, engage, plant_intel, go_dark.
 */
mModeRoutes.post('/actor/command', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json<{
    actor_id: number;
    command: string;
    payload?: Record<string, unknown>;
  }>();

  if (!body.actor_id || !body.command) {
    return c.json({ error: 'BAD_REQUEST', message: 'actor_id and command required' }, 400);
  }

  const validCommands = ['hold', 'engage', 'plant_intel', 'go_dark'];
  if (!validCommands.includes(body.command)) {
    return c.json({ error: 'BAD_REQUEST', message: `Invalid command. Must be one of: ${validCommands.join(', ')}` }, 400);
  }

  const actor = await getActor(c.env.DB, body.actor_id);
  if (!actor) return c.json({ error: 'NOT_FOUND', message: 'Actor not found' }, 404);

  // Map command to actor status
  const statusMap: Record<string, string> = { hold: 'holding', engage: 'engaging', plant_intel: 'active', go_dark: 'dark' };
  const newStatus = statusMap[body.command] || actor.status;
  await updateActorStatus(c.env.DB, body.actor_id, newStatus);

  const event = await insertEvent(c.env.DB, actor.scenario_id, auth.actor_id, 'actor_command', {
    actor_id: body.actor_id, callsign: actor.callsign, command: body.command,
    cell_id: actor.cell_id, commanded_by: auth.callsign, ...body.payload,
  });

  // Broadcast
  const roomId = c.env.SCENARIO_ROOM.idFromName(`scenario-${actor.scenario_id}`);
  const room = c.env.SCENARIO_ROOM.get(roomId);
  await room.fetch(new Request('http://internal/broadcast', {
    method: 'POST',
    body: JSON.stringify({ type: 'actor_update', data: { actor_id: body.actor_id, command: body.command, status: newStatus }, timestamp: Date.now() }),
  }));

  return c.json({ ok: true, event_id: event.id, status: newStatus });
});

/**
 * POST /api/m/scenario/freeze
 * Toggle scenario frozen state.
 */
mModeRoutes.post('/scenario/freeze', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json<{ scenario_id: number; frozen?: boolean }>();

  if (!body.scenario_id) {
    return c.json({ error: 'BAD_REQUEST', message: 'scenario_id required' }, 400);
  }

  const scenario = await getScenario(c.env.DB, body.scenario_id);
  if (!scenario) return c.json({ error: 'NOT_FOUND', message: 'Scenario not found' }, 404);

  const config = JSON.parse(scenario.config);
  config.frozen = body.frozen !== undefined ? body.frozen : !config.frozen;
  await updateScenarioConfig(c.env.DB, body.scenario_id, config);

  await insertEvent(c.env.DB, body.scenario_id, auth.actor_id, config.frozen ? 'game_freeze' : 'game_unfreeze', {
    frozen: config.frozen, triggered_by: auth.callsign,
  });

  // Broadcast freeze
  const roomId = c.env.SCENARIO_ROOM.idFromName(`scenario-${body.scenario_id}`);
  const room = c.env.SCENARIO_ROOM.get(roomId);
  await room.fetch(new Request('http://internal/broadcast', {
    method: 'POST',
    body: JSON.stringify({ type: 'state', data: { frozen: config.frozen }, timestamp: Date.now() }),
  }));

  return c.json({ ok: true, frozen: config.frozen });
});

// --- M Pings ---

/**
 * POST /api/m/ping
 * Send a structured directive ping to an actor.
 * Commands: MOVE, HOLD, ENGAGE, SHADOW, DROP, ESCALATE, FREEZE, EXTRACT
 */
mModeRoutes.post('/ping', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json<{
    actor_id: number;
    command: string;
    cell_id?: string;
    message?: string;
    target_actor_id?: number; // alias for actor_id — explicit for push routing
  }>();

  const validPings = ['MOVE', 'HOLD', 'ENGAGE', 'SHADOW', 'DROP', 'ESCALATE', 'FREEZE', 'EXTRACT'];
  if (!body.actor_id || !body.command) {
    return c.json({ error: 'BAD_REQUEST', message: 'actor_id and command required' }, 400);
  }
  if (!validPings.includes(body.command.toUpperCase())) {
    return c.json({ error: 'BAD_REQUEST', message: `Invalid ping. Must be one of: ${validPings.join(', ')}` }, 400);
  }

  const actor = await getActor(c.env.DB, body.actor_id);
  if (!actor) return c.json({ error: 'NOT_FOUND', message: 'Actor not found' }, 404);

  const pingPayload = {
    ping_command: body.command.toUpperCase(),
    target_actor_id: body.actor_id,
    target_callsign: actor.callsign,
    cell_id: body.cell_id || actor.cell_id || null,
    message: body.message || '',
    sent_by: auth.callsign,
    ack_status: 'pending',
    sent_at: Date.now(),
  };

  const event = await insertEvent(c.env.DB, actor.scenario_id, auth.actor_id, 'mping', pingPayload);

  // Broadcast ping to all connected clients (actors will filter by their ID)
  const roomId = c.env.SCENARIO_ROOM.idFromName(`scenario-${actor.scenario_id}`);
  const room = c.env.SCENARIO_ROOM.get(roomId);
  await room.fetch(new Request('http://internal/broadcast', {
    method: 'POST',
    body: JSON.stringify({
      type: 'mping',
      data: { ...pingPayload, event_id: event.id },
      timestamp: Date.now(),
    }),
  }));

  // Web Push to actor's subscribed devices (so watch gets ping even with screen off)
  const subs = await getPushSubscriptionsByScenario(c.env.DB, actor.scenario_id, body.target_actor_id ?? body.actor_id);
  if (subs.length) {
    await sendWebPushToAll(
      c.env,
      subs,
      {
        title:   `⚡ M DIRECTIVE — ${pingPayload.ping_command}`,
        body:    body.message || pingPayload.ping_command,
        tag:     'mping',
        vibrate: [100, 50, 100, 50, 200],
        data:    { event_id: event.id, ping_command: pingPayload.ping_command },
      },
      async (expired) => {
        const { deletePushSubscription: delSub } = await import('../db/queries');
        await delSub(c.env.DB, expired.actor_id, expired.endpoint);
      },
    );
  }

  return c.json({ ok: true, event_id: event.id, ping_command: body.command.toUpperCase() });
});

/**
 * GET /api/m/pings/:scenarioId
 * Get all pings with their ACK status for the scenario.
 */
mModeRoutes.get('/pings/:scenarioId', async (c) => {
  const scenarioId = parseInt(c.req.param('scenarioId'), 10);
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const events = await getEvents(c.env.DB, scenarioId, limit);
  const pings = events
    .filter((e) => e.event_type === 'mping' || e.event_type === 'mping_ack')
    .map((e) => ({ ...e, payload: JSON.parse(e.payload) }));

  // Group pings with their acks
  const pingMap = new Map<number, any>();
  for (const p of pings) {
    if (p.event_type === 'mping') {
      pingMap.set(p.id, { ...p, ack: null });
    } else if (p.event_type === 'mping_ack' && p.payload.ping_event_id) {
      const parent = pingMap.get(p.payload.ping_event_id);
      if (parent) parent.ack = p;
    }
  }

  return c.json({ pings: Array.from(pingMap.values()).reverse() });
});

// --- WebSocket ---

/**
 * GET /api/m/actors/positions/:scenarioId
 * Returns last-known GPS position and telemetry for all actors in the scenario.
 * Used by the M console live actor layer.
 */
mModeRoutes.get('/actors/positions/:scenarioId', async (c) => {
  const scenarioId = parseInt(c.req.param('scenarioId'), 10);
  const actors = await listActors(c.env.DB, scenarioId);

  return c.json({
    positions: actors.map((a) => ({
      actor_id:     a.id,
      callsign:     a.callsign,
      team:         a.team,
      status:       a.status,
      lane_id:      a.lane_id ?? null,
      cell_id:      a.cell_id ?? null,
      lat:          a.last_lat ?? null,
      lng:          a.last_lng ?? null,
      last_seen_at: a.last_seen_at ?? null,
      motion_state: a.motion_state ?? 'unknown',
    })),
    as_of: Date.now(),
  });
});

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

// --- Geofence Zones (Phase 2) ---

/**
 * GET /api/m/geofences/:scenarioId
 * List all geofence zones for a scenario.
 */
mModeRoutes.get('/geofences/:scenarioId', async (c) => {
  const scenarioId = parseInt(c.req.param('scenarioId'), 10);
  const zones = await listGeofenceZones(c.env.DB, scenarioId);
  return c.json({ zones });
});

/**
 * POST /api/m/geofences
 * Create a new geofence zone.
 * Body: { scenario_id, name, lat, lng, radius_m, trigger_on, trigger_event_type }
 */
mModeRoutes.post('/geofences', async (c) => {
  const body = await c.req.json<GeofenceRequest & { scenario_id: number }>();
  if (!body.scenario_id || !body.name || body.lat == null || body.lng == null) {
    return c.json({ error: 'BAD_REQUEST', message: 'scenario_id, name, lat, lng required' }, 400);
  }
  const zone = await createGeofenceZone(
    c.env.DB,
    body.scenario_id,
    body.name,
    body.lat,
    body.lng,
    body.radius_m ?? 100,
    body.trigger_on ?? 'enter',
    body.trigger_event_type ?? 'geofence_enter',
  );
  return c.json({ zone }, 201);
});

/**
 * DELETE /api/m/geofences/:id
 * Delete a geofence zone.
 */
mModeRoutes.delete('/geofences/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  await deleteGeofenceZone(c.env.DB, id);
  return c.json({ ok: true });
});

/**
 * PATCH /api/m/geofences/:id
 * Toggle active state on a geofence zone.
 */
mModeRoutes.patch('/geofences/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const body = await c.req.json<{ active: boolean }>();
  await setGeofenceZoneActive(c.env.DB, id, body.active);
  return c.json({ ok: true });
});

// --- Push Broadcast (Phase 2) ---

/**
 * POST /api/m/push-broadcast
 * M sends a Web Push notification to all subscribed actors in a scenario.
 * Body: { scenario_id, title, body, actor_id? (optional — target single actor) }
 */
mModeRoutes.post('/push-broadcast', async (c) => {
  const body = await c.req.json<{
    scenario_id: number;
    title: string;
    body: string;
    actor_id?: number;
    tag?: string;
  }>();

  if (!body.scenario_id || !body.title) {
    return c.json({ error: 'BAD_REQUEST', message: 'scenario_id and title required' }, 400);
  }

  const subs = await getPushSubscriptionsByScenario(c.env.DB, body.scenario_id, body.actor_id);
  if (!subs.length) return c.json({ ok: true, sent: 0, message: 'No subscriptions found' });

  let sent = 0;
  await sendWebPushToAll(
    c.env,
    subs,
    { title: body.title, body: body.body || '', tag: body.tag },
    async (expired) => {
      // Remove expired subscription
      const { deletePushSubscription: delSub } = await import('../db/queries');
      await delSub(c.env.DB, expired.actor_id, expired.endpoint);
    },
  );
  sent = subs.length;

  return c.json({ ok: true, sent });
});
