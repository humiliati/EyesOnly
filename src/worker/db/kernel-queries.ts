/* ============================================================
   EYES ONLY — Kernel Persistence Queries (D1)
   Stores external agent endpoints + session state per user.
   ============================================================ */

import type { D1Database } from '@cloudflare/workers-types';

export type KernelSessionRow = {
  id: string;
  user_id: number;
  kernel_agent_id: string | null;
  status: string;
  last_error: string | null;
  connected_at: number | null;
  disconnected_at: number | null;
  last_seen_at: number;
};

export type KernelAgentRow = {
  id: string;
  user_id: number;
  agent_name: string | null;
  agent_url: string;
  created_at: number;
  updated_at: number;
  last_connected_at: number | null;
  is_active: number;
};

export async function getActiveKernelSession(db: D1Database, userId: number): Promise<KernelSessionRow | null> {
  const row = await db
    .prepare(
      `SELECT id, user_id, kernel_agent_id, status, last_error, connected_at, disconnected_at, last_seen_at
       FROM kernel_sessions
       WHERE user_id = ?
       ORDER BY last_seen_at DESC
       LIMIT 1`,
    )
    .bind(userId)
    .first<KernelSessionRow>();

  return row || null;
}

export async function getKernelAgentById(db: D1Database, id: string): Promise<KernelAgentRow | null> {
  const row = await db
    .prepare(
      `SELECT id, user_id, agent_name, agent_url, created_at, updated_at, last_connected_at, is_active
       FROM kernel_agents
       WHERE id = ? AND is_active = 1`,
    )
    .bind(id)
    .first<KernelAgentRow>();

  return row || null;
}

export async function upsertKernelAgent(db: D1Database, userId: number, agentUrl: string, agentName?: string | null): Promise<KernelAgentRow> {
  const now = Date.now();

  // Try to find existing by (user_id, agent_url)
  const existing = await db
    .prepare(
      `SELECT id, user_id, agent_name, agent_url, created_at, updated_at, last_connected_at, is_active
       FROM kernel_agents
       WHERE user_id = ? AND agent_url = ? AND is_active = 1
       LIMIT 1`,
    )
    .bind(userId, agentUrl)
    .first<KernelAgentRow>();

  if (existing) {
    await db
      .prepare(
        `UPDATE kernel_agents
         SET agent_name = ?, updated_at = ?, last_connected_at = ?
         WHERE id = ?`,
      )
      .bind(agentName || existing.agent_name, now, now, existing.id)
      .run();

    return {
      ...existing,
      agent_name: agentName || existing.agent_name,
      updated_at: now,
      last_connected_at: now,
    };
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO kernel_agents (id, user_id, agent_name, agent_url, created_at, updated_at, last_connected_at, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    )
    .bind(id, userId, agentName || null, agentUrl, now, now, now)
    .run();

  const created = await getKernelAgentById(db, id);
  if (!created) throw new Error('Failed to create kernel agent');
  return created;
}

export async function setKernelSession(
  db: D1Database,
  userId: number,
  params: {
    status: string;
    kernelAgentId?: string | null;
    lastError?: string | null;
  },
): Promise<KernelSessionRow> {
  const now = Date.now();

  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO kernel_sessions (id, user_id, kernel_agent_id, status, last_error, connected_at, disconnected_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      userId,
      params.kernelAgentId || null,
      params.status,
      params.lastError || null,
      params.status === 'CONNECTED' || params.status === 'ACTIVE_RUN' ? now : null,
      params.status === 'DISCONNECTED' ? now : null,
      now,
    )
    .run();

  const row = await db
    .prepare(
      `SELECT id, user_id, kernel_agent_id, status, last_error, connected_at, disconnected_at, last_seen_at
       FROM kernel_sessions
       WHERE id = ? LIMIT 1`,
    )
    .bind(id)
    .first<KernelSessionRow>();

  if (!row) throw new Error('Failed to create kernel session');
  return row;
}

export async function listKernelAgents(db: D1Database, userId: number): Promise<KernelAgentRow[]> {
  const res = await db
    .prepare(
      `SELECT id, user_id, agent_name, agent_url, created_at, updated_at, last_connected_at, is_active
       FROM kernel_agents
       WHERE user_id = ? AND is_active = 1
       ORDER BY updated_at DESC`,
    )
    .bind(userId)
    .all<KernelAgentRow>();

  return res.results || [];
}

export async function deactivateKernelAgent(db: D1Database, userId: number, agentId: string): Promise<boolean> {
  const now = Date.now();
  const res = await db
    .prepare(`UPDATE kernel_agents SET is_active = 0, updated_at = ? WHERE id = ? AND user_id = ?`)
    .bind(now, agentId, userId)
    .run();

  return (res.meta.changes || 0) > 0;
}
