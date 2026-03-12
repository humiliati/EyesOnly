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
import { userAuthRoutes } from './routes/user-auth';
import { kernelRoutes } from './routes/kernel';
import { audioRoutes } from './routes/audio';
import { audioUploadRoutes } from './routes/audio-upload';
import { videoRoutes } from './routes/video';
import { mapUploadRoutes } from './routes/map-upload';
import {
  listActiveScenarios,
  findStaleActors,
  insertEvent,
  getPushSubscriptionsByScenario,
  deletePushSubscription,
} from './db/queries';
import { sendWebPushToAll } from './utils/web-push';

export { ScenarioRoom } from './durable-objects/scenario-room';

type HonoEnv = { Bindings: Env; Variables: Record<string, unknown> };

const app = new Hono<HonoEnv>();

// --- CSP Fix: relax Content-Security-Policy for our app pages ---
// Cloudflare's static asset handler injects a restrictive CSP that
// blocks our bundled Preact JS. This middleware overrides it.

// Shared CSP applied to all HTML responses
const APP_CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; connect-src 'self' blob: wss: ws: https://*.cloudflareinsights.com; media-src 'self' blob:; img-src 'self' data: blob: https:;";

app.use('*', async (c, next) => {
  await next();
  // Override restrictive CSP on HTML pages
  if (c.res.headers.get('content-type')?.includes('text/html')) {
    // Remove any ASSETS-injected CSP before setting ours
    c.res.headers.delete('Content-Security-Policy-Report-Only');
    c.res.headers.set('Content-Security-Policy', APP_CSP);
  }
});

// --- Global Middleware ---

app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Session-Token'],
}));

// CORS for audio paths — browsers with crossOrigin="anonymous" <audio>
// need Range in allowed headers and Content-Range/Accept-Ranges exposed.
app.use('/audio/*', cors({
  origin: '*',
  allowMethods: ['GET', 'HEAD', 'OPTIONS'],
  allowHeaders: ['Range', 'Content-Type'],
  exposeHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
}));

// CORS for video paths — same treatment as audio.
// <video> elements need Range for seeking and Content-Range exposed.
app.use('/video/*', cors({
  origin: '*',
  allowMethods: ['GET', 'HEAD', 'OPTIONS'],
  allowHeaders: ['Range', 'Content-Type'],
  exposeHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
}));

// --- Route Groups ---

app.route('/api', publicRoutes);
app.route('/api/ops', opsRoutes);
app.route('/api/m', mModeRoutes);
app.route('/api/user', userAuthRoutes);
app.route('/api/kernel', kernelRoutes);

// --- Audio: served from R2 (not static assets) ---
app.route('/audio', audioRoutes);

// --- Video: served from R2 (not static assets) ---
app.route('/video', videoRoutes);

// --- Audio/Video Upload API (Media Designer portal) ---
app.route('/api/audio', audioUploadRoutes);

// --- Map Upload + Scenario Node API (Director only — auth enforced in m-mode mount) ---
app.route('/api/m/map', mapUploadRoutes);

// --- Map images: served from R2 (same pattern as audio/video) ---
app.use('/maps/*', cors({
  origin: '*',
  allowMethods: ['GET', 'HEAD', 'OPTIONS'],
  allowHeaders: ['Range', 'Content-Type'],
  exposeHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
}));
app.get('/maps/:scenarioId/:filename', async (c) => {
  const scenarioId = c.req.param('scenarioId');
  const filename = c.req.param('filename');
  const key = `maps/${scenarioId}/${filename}`;
  const obj = await c.env.R2.get(key);
  if (!obj) return c.text('Not Found', 404);
  return new Response(obj.body, {
    status: 200,
    headers: {
      'Content-Type': obj.httpMetadata?.contentType || 'image/jpeg',
      'Content-Length': String(obj.size),
      'Cache-Control': 'public, max-age=3600',
    },
  });
});

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
    // Apply CSP override on HTML assets (use shared APP_CSP constant)
    if (newResponse.headers.get('content-type')?.includes('text/html')) {
      newResponse.headers.delete('Content-Security-Policy-Report-Only');
      newResponse.headers.set('Content-Security-Policy', APP_CSP);
    }
    return newResponse;
  } catch {
    return c.text('Not Found', 404);
  }
});

// ============================================================
// SCHEDULED HANDLER — Deadman Check (runs every 5 minutes)
// Fires an 'actor_deadman' event for every active actor that
// has not sent telemetry in the last 5 minutes.
// ============================================================

async function scheduledHandler(
  _event: ScheduledEvent,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  const DEADMAN_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

  try {
    const scenarios = await listActiveScenarios(env.DB);

    for (const scenario of scenarios) {
      const stale = await findStaleActors(env.DB, scenario.id, DEADMAN_THRESHOLD_MS);
      if (!stale.length) continue;

      for (const actor of stale) {
        // Insert deadman event
        const event = await insertEvent(env.DB, scenario.id, actor.id, 'actor_deadman', {
          callsign:     actor.callsign,
          last_seen_at: actor.last_seen_at,
          stale_ms:     actor.last_seen_at ? Date.now() - actor.last_seen_at : null,
          ts:           Date.now(),
        });

        // Broadcast to M console
        try {
          const roomId = env.SCENARIO_ROOM.idFromName(`scenario-${scenario.id}`);
          const room   = env.SCENARIO_ROOM.get(roomId);
          await room.fetch(new Request('http://internal/broadcast', {
            method: 'POST',
            body: JSON.stringify({
              type: 'deadman_alert',
              data: { actor_id: actor.id, callsign: actor.callsign, event_id: event.id },
              timestamp: Date.now(),
            }),
          }));
        } catch {}

        // Web Push to M's devices (M is the director — subscribe separately in future)
        // For now, push to the stale actor's own devices as a "reconnect" nudge
        try {
          const subs = await getPushSubscriptionsByScenario(env.DB, scenario.id, actor.id);
          if (subs.length) {
            await sendWebPushToAll(
              env,
              subs,
              {
                title:  '⚠ HEARTBEAT MISSED',
                body:   'M has lost contact. Reconnect now.',
                tag:    'deadman',
                silent: false,
              },
              async (expired) => {
                await deletePushSubscription(env.DB, expired.actor_id, expired.endpoint);
              },
            );
          }
        } catch {}
      }
    }
  } catch (err) {
    console.error('[deadman] scheduled handler error:', err);
  }
}

export default {
  fetch: app.fetch,
  scheduled: scheduledHandler,
};
