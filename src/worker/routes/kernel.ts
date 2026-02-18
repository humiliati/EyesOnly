/* ============================================================
   EYES ONLY — Kernel Persistence API
   Stores kernel connection state per logged-in user.

   Auth: X-Session-Token (same as /api/user/me)
   ============================================================ */

import { Hono } from 'hono';
import type { Env } from '../../shared/types';
import { getUserSession } from '../db/user-queries';
import {
  getActiveKernelSession,
  getKernelAgentById,
  upsertKernelAgent,
  setKernelSession,
  listKernelAgents,
  deactivateKernelAgent,
} from '../db/kernel-queries';

type HonoEnv = { Bindings: Env; Variables: Record<string, unknown> };

export const kernelRoutes = new Hono<HonoEnv>();

async function requireUser(c: any): Promise<number | null> {
  const token = c.req.header('X-Session-Token');
  if (!token) return null;
  const session = await getUserSession(c.env.DB, token);
  if (!session) return null;
  return session.user_id;
}

kernelRoutes.get('/me', async (c) => {
  const userId = await requireUser(c);
  if (!userId) return c.json({ error: 'UNAUTHORIZED', message: 'Invalid or expired session' }, 401);

  const sess = await getActiveKernelSession(c.env.DB, userId);
  if (!sess) {
    return c.json({
      kernel: {
        status: 'DISCONNECTED',
        agent: null,
        last_error: null,
      },
    });
  }

  const agent = sess.kernel_agent_id ? await getKernelAgentById(c.env.DB, sess.kernel_agent_id) : null;

  return c.json({
    kernel: {
      status: sess.status,
      last_error: sess.last_error,
      agent: agent
        ? {
            id: agent.id,
            name: agent.agent_name,
            url: agent.agent_url,
            last_connected_at: agent.last_connected_at,
          }
        : null,
    },
  });
});

kernelRoutes.post('/connect', async (c) => {
  const userId = await requireUser(c);
  if (!userId) return c.json({ error: 'UNAUTHORIZED', message: 'Invalid or expired session' }, 401);

  const body = await c.req.json<{ agent_url: string; agent_name?: string }>().catch(() => null);
  if (!body || !body.agent_url) {
    return c.json({ error: 'BAD_REQUEST', message: 'agent_url required' }, 400);
  }

  const rawUrl = String(body.agent_url).trim();
  // Basic sanitation; allow localhost for local dev
  if (!/^https?:\/\//.test(rawUrl)) {
    return c.json({ error: 'BAD_REQUEST', message: 'agent_url must start with http:// or https://' }, 400);
  }

  const agentUrl = rawUrl.replace(/\/$/, '');
  const agentName = body.agent_name ? String(body.agent_name).slice(0, 64) : null;

  const agent = await upsertKernelAgent(c.env.DB, userId, agentUrl, agentName);
  const sess = await setKernelSession(c.env.DB, userId, {
    status: 'CONNECTED',
    kernelAgentId: agent.id,
    lastError: null,
  });

  return c.json({
    status: sess.status,
    agent: { id: agent.id, name: agent.agent_name, url: agent.agent_url },
  });
});

kernelRoutes.post('/disconnect', async (c) => {
  const userId = await requireUser(c);
  if (!userId) return c.json({ error: 'UNAUTHORIZED', message: 'Invalid or expired session' }, 401);

  const sess = await setKernelSession(c.env.DB, userId, {
    status: 'DISCONNECTED',
    kernelAgentId: null,
    lastError: null,
  });

  return c.json({ status: sess.status });
});

kernelRoutes.get('/agents', async (c) => {
  const userId = await requireUser(c);
  if (!userId) return c.json({ error: 'UNAUTHORIZED', message: 'Invalid or expired session' }, 401);

  const agents = await listKernelAgents(c.env.DB, userId);
  return c.json({
    agents: agents.map((a) => ({
      id: a.id,
      name: a.agent_name,
      url: a.agent_url,
      updated_at: a.updated_at,
      last_connected_at: a.last_connected_at,
    })),
  });
});

kernelRoutes.delete('/agents/:id', async (c) => {
  const userId = await requireUser(c);
  if (!userId) return c.json({ error: 'UNAUTHORIZED', message: 'Invalid or expired session' }, 401);

  const id = c.req.param('id');
  if (!id) return c.json({ error: 'BAD_REQUEST', message: 'id required' }, 400);

  const ok = await deactivateKernelAgent(c.env.DB, userId, id);
  return c.json({ success: ok });
});
