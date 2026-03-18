/* ============================================================
   EYES ONLY — Puzzle Designer API Routes
   Split into two Hono apps:
     puzzleDesignerRoutes  — authed CRUD (mounted at /api/ops)
     puzzlePublicRoutes    — public read (mounted at /api/puzzles)
   ============================================================ */

import { Hono } from 'hono';
import type { Env, AuthContext } from '../../shared/types';
import { requireAuth } from '../middleware/auth';
import { generateQR } from '../utils/qr-encode';

type HonoEnv = { Bindings: Env; Variables: { auth: AuthContext } };

// ---- QR helpers ----

function generateQRBase64(url: string): string {
  const png = generateQR(url, 10, 4);
  // Convert Uint8Array to base64 in Workers runtime
  let binary = '';
  for (let i = 0; i < png.length; i++) binary += String.fromCharCode(png[i]);
  return btoa(binary);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 48);
}

// ================================================================
// AUTHED ROUTES — /api/ops/puzzles/*
// Requires Bearer token (ops or director role)
// ================================================================

export const puzzleDesignerRoutes = new Hono<HonoEnv>();

puzzleDesignerRoutes.use('*', requireAuth);

/** GET /api/ops/puzzles — list all puzzles */
puzzleDesignerRoutes.get('/puzzles', async (c) => {
  const scenarioId = c.req.query('scenario_id') || '1';
  const status = c.req.query('status');

  let sql = 'SELECT id, slug, title, description, emoji, tag, tag_class, chain_order, next_slug, prev_slug, qr_url, status, created_at, updated_at FROM qr_puzzles WHERE scenario_id = ?';
  const params: (string | number)[] = [parseInt(scenarioId, 10)];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  sql += ' ORDER BY chain_order ASC, created_at DESC';
  const result = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json({ puzzles: result.results });
});

/** GET /api/ops/puzzles/:slug — single puzzle with source code */
puzzleDesignerRoutes.get('/puzzles/:slug', async (c) => {
  const slug = c.req.param('slug');
  const puzzle = await c.env.DB.prepare(
    'SELECT * FROM qr_puzzles WHERE slug = ?'
  ).bind(slug).first();
  if (!puzzle) return c.json({ error: 'Puzzle not found' }, 404);
  return c.json({ puzzle });
});

/** POST /api/ops/puzzles — create new puzzle */
puzzleDesignerRoutes.post('/puzzles', async (c) => {
  const body = await c.req.json<{
    title: string; description?: string; emoji?: string; tag?: string;
    tag_class?: string; puzzle_js: string; scenario_id?: number;
    chain_order?: number; next_slug?: string; status?: string;
  }>();

  if (!body.title || !body.puzzle_js) {
    return c.json({ error: 'title and puzzle_js are required' }, 400);
  }

  const slug = slugify(body.title) + '-' + Date.now().toString(36).slice(-4);
  const scenarioId = body.scenario_id || 1;
  const qrUrl = `https://flapsandseals.com/games#${slug}`;
  const qrImage = generateQRBase64(qrUrl);

  await c.env.DB.prepare(`
    INSERT INTO qr_puzzles (scenario_id, slug, title, description, emoji, tag, tag_class, puzzle_js, chain_order, next_slug, qr_url, qr_image, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    scenarioId, slug, body.title, body.description || '', body.emoji || '🔐',
    body.tag || 'PUZZLE', body.tag_class || 'games-tag-narrative', body.puzzle_js,
    body.chain_order || 0, body.next_slug || null, qrUrl, qrImage, body.status || 'draft',
  ).run();

  if (body.next_slug) {
    await c.env.DB.prepare(
      'UPDATE qr_puzzles SET prev_slug = ? WHERE slug = ?'
    ).bind(slug, body.next_slug).run();
  }

  const created = await c.env.DB.prepare(
    'SELECT * FROM qr_puzzles WHERE slug = ?'
  ).bind(slug).first();

  return c.json({ puzzle: created, qr_url: qrUrl }, 201);
});

/** PUT /api/ops/puzzles/:slug — update puzzle */
puzzleDesignerRoutes.put('/puzzles/:slug', async (c) => {
  const slug = c.req.param('slug');
  const body = await c.req.json<{
    title?: string; description?: string; emoji?: string; tag?: string;
    tag_class?: string; puzzle_js?: string; chain_order?: number;
    next_slug?: string; status?: string;
  }>();

  const existing = await c.env.DB.prepare(
    'SELECT id FROM qr_puzzles WHERE slug = ?'
  ).bind(slug).first();
  if (!existing) return c.json({ error: 'Puzzle not found' }, 404);

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (body.title !== undefined) { fields.push('title = ?'); values.push(body.title); }
  if (body.description !== undefined) { fields.push('description = ?'); values.push(body.description); }
  if (body.emoji !== undefined) { fields.push('emoji = ?'); values.push(body.emoji); }
  if (body.tag !== undefined) { fields.push('tag = ?'); values.push(body.tag); }
  if (body.tag_class !== undefined) { fields.push('tag_class = ?'); values.push(body.tag_class); }
  if (body.puzzle_js !== undefined) { fields.push('puzzle_js = ?'); values.push(body.puzzle_js); }
  if (body.chain_order !== undefined) { fields.push('chain_order = ?'); values.push(body.chain_order); }
  if (body.next_slug !== undefined) { fields.push('next_slug = ?'); values.push(body.next_slug); }
  if (body.status !== undefined) { fields.push('status = ?'); values.push(body.status); }

  fields.push('updated_at = ?');
  values.push(Date.now());
  values.push(slug);

  if (fields.length > 1) {
    await c.env.DB.prepare(
      `UPDATE qr_puzzles SET ${fields.join(', ')} WHERE slug = ?`
    ).bind(...values).run();
  }

  const updated = await c.env.DB.prepare(
    'SELECT * FROM qr_puzzles WHERE slug = ?'
  ).bind(slug).first();

  return c.json({ puzzle: updated });
});

/** DELETE /api/ops/puzzles/:slug — archive (soft delete) */
puzzleDesignerRoutes.delete('/puzzles/:slug', async (c) => {
  const slug = c.req.param('slug');
  await c.env.DB.prepare(
    'UPDATE qr_puzzles SET status = ?, updated_at = ? WHERE slug = ?'
  ).bind('archived', Date.now(), slug).run();
  return c.json({ ok: true });
});

/** POST /api/ops/puzzles/:slug/publish — set puzzle live + ensure QR image */
puzzleDesignerRoutes.post('/puzzles/:slug/publish', async (c) => {
  const slug = c.req.param('slug');

  // Fetch current to check if QR image exists
  const existing = await c.env.DB.prepare(
    'SELECT qr_url, qr_image FROM qr_puzzles WHERE slug = ?'
  ).bind(slug).first<{ qr_url: string; qr_image: string | null }>();

  if (!existing) return c.json({ error: 'Puzzle not found' }, 404);

  // Regenerate QR image if missing
  const qrImage = existing.qr_image || generateQRBase64(existing.qr_url);

  await c.env.DB.prepare(
    'UPDATE qr_puzzles SET status = ?, qr_image = ?, updated_at = ? WHERE slug = ?'
  ).bind('live', qrImage, Date.now(), slug).run();

  const puzzle = await c.env.DB.prepare(
    'SELECT slug, title, qr_url FROM qr_puzzles WHERE slug = ?'
  ).bind(slug).first();

  return c.json({ ok: true, puzzle });
});

/** GET /api/ops/puzzles/:slug/qr — QR code PNG image */
puzzleDesignerRoutes.get('/puzzles/:slug/qr', async (c) => {
  const slug = c.req.param('slug');
  const puzzle = await c.env.DB.prepare(
    'SELECT qr_url, qr_image FROM qr_puzzles WHERE slug = ?'
  ).bind(slug).first<{ qr_url: string; qr_image: string | null }>();

  if (!puzzle) return c.json({ error: 'Puzzle not found' }, 404);

  // If we have a stored base64 image, serve it
  if (puzzle.qr_image) {
    const binary = atob(puzzle.qr_image);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Response(bytes, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `inline; filename="${slug}-qr.png"`,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  // Generate fresh if not stored
  const png = generateQR(puzzle.qr_url, 10, 4);
  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `inline; filename="${slug}-qr.png"`,
    },
  });
});

// ================================================================
// PUBLIC ROUTES — /api/puzzles/*
// No auth required. Player-facing endpoints.
// ================================================================

export const puzzlePublicRoutes = new Hono<HonoEnv>();

/** GET /api/puzzles/live — all live puzzles (for qr-custom.js runtime) */
puzzlePublicRoutes.get('/live', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT slug, title, description, emoji, tag, tag_class, puzzle_js, chain_order, next_slug, qr_url
     FROM qr_puzzles WHERE status = 'live' ORDER BY chain_order ASC`
  ).all();
  return c.json({ puzzles: result.results });
});

/** GET /api/puzzles/live/:slug — single live puzzle's JS (on-demand load) */
puzzlePublicRoutes.get('/live/:slug', async (c) => {
  const slug = c.req.param('slug');
  const puzzle = await c.env.DB.prepare(
    `SELECT slug, title, puzzle_js, next_slug FROM qr_puzzles WHERE slug = ? AND status = 'live'`
  ).bind(slug).first();

  if (!puzzle) return c.json({ error: 'Puzzle not found or not live' }, 404);
  return c.json({ puzzle });
});
