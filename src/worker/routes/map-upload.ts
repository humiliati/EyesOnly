/* ============================================================
   EYES ONLY — Map Upload Routes
   Upload tactical map images to R2, serve them, manage per-scenario.
   Director-only (requireAuth + requireDirector applied in index.ts).
   ============================================================ */

import { Hono } from 'hono';
import type { Env } from '../../shared/types';
import { getScenario, updateScenarioConfig } from '../db/queries';
import { requireAuth, requireDirector } from '../middleware/auth';

type HonoEnv = { Bindings: Env; Variables: { auth: { actor_id: number; callsign: string; role: string; scenario_id: number; user_id: number | null } } };

export const mapUploadRoutes = new Hono<HonoEnv>();

// Director-only access for all map upload routes
mapUploadRoutes.use('*', requireAuth);
mapUploadRoutes.use('*', requireDirector);

const IMAGE_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

function getImageMime(filename: string): string | null {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return IMAGE_MIME[ext] || null;
}

/**
 * POST /api/m/map/upload
 * Upload a tactical map image for the current scenario.
 * Multipart form: { file: File }
 * Stores at R2 key: maps/{scenario_id}/{filename}
 * Updates scenario.config.map_key.
 */
mapUploadRoutes.post('/upload', async (c) => {
  const auth = c.get('auth');
  const scenarioId = auth.scenario_id;

  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'BAD_REQUEST', message: 'file is required (multipart form)' }, 400);
  }

  const mime = getImageMime(file.name);
  if (!mime) {
    return c.json({ error: 'BAD_REQUEST', message: 'Unsupported image format. Use jpg, png, webp, or svg.' }, 400);
  }

  // Max 10MB
  if (file.size > 10 * 1024 * 1024) {
    return c.json({ error: 'BAD_REQUEST', message: 'Map image must be under 10MB' }, 400);
  }

  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const r2Key = `maps/${scenarioId}/${sanitized}`;

  await c.env.R2.put(r2Key, await file.arrayBuffer(), {
    httpMetadata: { contentType: mime },
  });

  // Update scenario config with map key
  const scenario = await getScenario(c.env.DB, scenarioId);
  if (scenario) {
    const config = typeof scenario.config === 'string'
      ? JSON.parse(scenario.config || '{}')
      : (scenario.config || {});
    config.map_key = r2Key;
    await updateScenarioConfig(c.env.DB, scenarioId, config);
  }

  return c.json({
    ok: true,
    map_key: r2Key,
    url: `/maps/${scenarioId}/${sanitized}`,
    size: file.size,
    content_type: mime,
  }, 201);
});

/**
 * GET /api/m/map/:scenarioId
 * Get the map image URL + grid config for a scenario.
 */
mapUploadRoutes.get('/:scenarioId', async (c) => {
  const scenarioId = parseInt(c.req.param('scenarioId'), 10);
  if (!scenarioId) return c.json({ error: 'BAD_REQUEST', message: 'scenarioId required' }, 400);

  const scenario = await getScenario(c.env.DB, scenarioId);
  if (!scenario) return c.json({ error: 'NOT_FOUND', message: 'Scenario not found' }, 404);

  const config = typeof scenario.config === 'string'
    ? JSON.parse(scenario.config || '{}')
    : (scenario.config || {});

  const mapKey = config.map_key;
  if (!mapKey) {
    return c.json({ map_url: null, grid: config.grid || null, nodes: config.nodes || null });
  }

  // Verify map exists in R2
  const head = await c.env.R2.head(mapKey);
  if (!head) {
    return c.json({ map_url: null, grid: config.grid || null, nodes: config.nodes || null });
  }

  return c.json({
    map_url: `/${mapKey}`,
    map_size: head.size,
    map_content_type: head.httpMetadata?.contentType,
    grid: config.grid || null,
    nodes: config.nodes || null,
  });
});

/**
 * DELETE /api/m/map/:scenarioId
 * Remove the map image for a scenario.
 */
mapUploadRoutes.delete('/:scenarioId', async (c) => {
  const scenarioId = parseInt(c.req.param('scenarioId'), 10);
  if (!scenarioId) return c.json({ error: 'BAD_REQUEST', message: 'scenarioId required' }, 400);

  const scenario = await getScenario(c.env.DB, scenarioId);
  if (!scenario) return c.json({ error: 'NOT_FOUND', message: 'Scenario not found' }, 404);

  const config = typeof scenario.config === 'string'
    ? JSON.parse(scenario.config || '{}')
    : (scenario.config || {});

  if (config.map_key) {
    await c.env.R2.delete(config.map_key);
    delete config.map_key;
    await updateScenarioConfig(c.env.DB, scenarioId, config);
  }

  return c.json({ ok: true });
});

/**
 * POST /api/m/scenario/nodes
 * Save the Grafcet node graph for a scenario.
 * Body: { scenario_id, nodes: [...], connections: [...] }
 */
mapUploadRoutes.post('/scenario/nodes', async (c) => {
  const body = await c.req.json<{
    scenario_id: number;
    nodes: Array<{
      id: string;
      type: string;
      cell_id: string;
      label: string;
      config?: Record<string, unknown>;
      status?: string;
    }>;
    connections: Array<{
      from: string;
      to: string;
      type?: string;
    }>;
  }>();

  if (!body.scenario_id || !body.nodes) {
    return c.json({ error: 'BAD_REQUEST', message: 'scenario_id and nodes are required' }, 400);
  }

  const scenario = await getScenario(c.env.DB, body.scenario_id);
  if (!scenario) return c.json({ error: 'NOT_FOUND', message: 'Scenario not found' }, 404);

  const config = typeof scenario.config === 'string'
    ? JSON.parse(scenario.config || '{}')
    : (scenario.config || {});

  config.nodes = body.nodes;
  config.connections = body.connections || [];

  await updateScenarioConfig(c.env.DB, body.scenario_id, config);

  return c.json({ ok: true, node_count: body.nodes.length, connection_count: (body.connections || []).length });
});

/**
 * GET /api/m/scenario/nodes/:scenarioId
 * Get the Grafcet node graph for a scenario.
 */
mapUploadRoutes.get('/scenario/nodes/:scenarioId', async (c) => {
  const scenarioId = parseInt(c.req.param('scenarioId'), 10);
  if (!scenarioId) return c.json({ error: 'BAD_REQUEST', message: 'scenarioId required' }, 400);

  const scenario = await getScenario(c.env.DB, scenarioId);
  if (!scenario) return c.json({ error: 'NOT_FOUND', message: 'Scenario not found' }, 404);

  const config = typeof scenario.config === 'string'
    ? JSON.parse(scenario.config || '{}')
    : (scenario.config || {});

  return c.json({
    nodes: config.nodes || [],
    connections: config.connections || [],
  });
});

/**
 * PATCH /api/m/scenario/node
 * Update a single node's status or config.
 * Body: { scenario_id, node_id, status?, config?, label? }
 */
mapUploadRoutes.patch('/scenario/node', async (c) => {
  const body = await c.req.json<{
    scenario_id: number;
    node_id: string;
    status?: string;
    config?: Record<string, unknown>;
    label?: string;
  }>();

  if (!body.scenario_id || !body.node_id) {
    return c.json({ error: 'BAD_REQUEST', message: 'scenario_id and node_id are required' }, 400);
  }

  const scenario = await getScenario(c.env.DB, body.scenario_id);
  if (!scenario) return c.json({ error: 'NOT_FOUND', message: 'Scenario not found' }, 404);

  const config = typeof scenario.config === 'string'
    ? JSON.parse(scenario.config || '{}')
    : (scenario.config || {});

  const nodes: any[] = config.nodes || [];
  const node = nodes.find((n: any) => n.id === body.node_id);
  if (!node) return c.json({ error: 'NOT_FOUND', message: `Node ${body.node_id} not found` }, 404);

  if (body.status !== undefined) node.status = body.status;
  if (body.config !== undefined) node.config = { ...node.config, ...body.config };
  if (body.label !== undefined) node.label = body.label;

  await updateScenarioConfig(c.env.DB, body.scenario_id, config);

  return c.json({ ok: true, node });
});
