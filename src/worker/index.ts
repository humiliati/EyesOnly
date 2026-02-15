/* ============================================================
   EYES ONLY — Worker Entry Point
   Hono router mounting all API routes.
   Static assets served by Cloudflare's asset binding.
   ============================================================ */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '../shared/types';
import { publicRoutes } from './routes/public';
import { opsRoutes } from './routes/ops';
import { mModeRoutes } from './routes/m-mode';

export { ScenarioRoom } from './durable-objects/scenario-room';

type HonoEnv = { Bindings: Env; Variables: Record<string, unknown> };

const app = new Hono<HonoEnv>();

// --- Global Middleware ---

app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// --- Route Groups ---

app.route('/api', publicRoutes);
app.route('/api/ops', opsRoutes);
app.route('/api/m', mModeRoutes);

// --- Health Check ---

app.get('/api/health', (c) => {
  return c.json({
    status: 'operational',
    service: 'EYES ONLY CTF Engine',
    timestamp: Date.now(),
  });
});

// --- Fallback: let Cloudflare serve static assets ---
// Any route not matched by the API will fall through to the
// static asset binding configured in wrangler.jsonc.

export default app;
