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

// --- CSP Fix: relax Content-Security-Policy for our app pages ---
// Cloudflare's static asset handler injects a restrictive CSP that
// blocks our bundled Preact JS. This middleware overrides it.

app.use('*', async (c, next) => {
  await next();
  // Override restrictive CSP on HTML pages
  if (c.res.headers.get('content-type')?.includes('text/html')) {
    c.res.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; connect-src 'self' wss: ws: https://*.cloudflareinsights.com; img-src 'self' data: blob:;",
    );
  }
});

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

// --- Fallback: serve static assets via the ASSETS binding ---
// With run_worker_first:true, all requests hit the Worker first.
// Non-API paths are forwarded to Cloudflare's static asset serving.

app.all('*', async (c) => {
  try {
    const response = await c.env.ASSETS.fetch(c.req.raw);
    // Clone response so we can modify headers
    const newResponse = new Response(response.body, response);
    // Apply CSP override on HTML assets
    if (newResponse.headers.get('content-type')?.includes('text/html')) {
      newResponse.headers.set(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; connect-src 'self' wss: ws: https://*.cloudflareinsights.com; img-src 'self' data: blob:;",
      );
    }
    return newResponse;
  } catch {
    return c.text('Not Found', 404);
  }
});

export default app;
