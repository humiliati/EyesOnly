/* ============================================================
   EYES ONLY — Puzzle Designer API Routes
   CRUD for designer-created QR puzzles.
   Requires Ops-level auth (same as media designer portal).
   ============================================================ */

import { Hono } from 'hono';
import type { Env, AuthContext } from '../../shared/types';
import { requireAuth } from '../middleware/auth';

type HonoEnv = { Bindings: Env; Variables: { auth: AuthContext } };

export const puzzleDesignerRoutes = new Hono<HonoEnv>();

puzzleDesignerRoutes.use('*', requireAuth);

// ---- QR Code Generator (pure JS, no dependencies) ----
// Minimal QR Code generation using the API-based approach:
// We generate a simple SVG QR code server-side.

function generateQRSvg(url: string, size: number = 200): string {
  // Use a simple text-based QR representation for the portal preview.
  // For production print, the portal page generates high-res QR client-side.
  // This is a placeholder SVG with the URL encoded.
  const escaped = url.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="100%" height="100%" fill="white"/>
    <text x="50%" y="45%" text-anchor="middle" font-family="monospace" font-size="10" fill="black">QR CODE</text>
    <text x="50%" y="55%" text-anchor="middle" font-family="monospace" font-size="7" fill="#666">${escaped}</text>
    <text x="50%" y="65%" text-anchor="middle" font-family="monospace" font-size="6" fill="#999">(render client-side)</text>
  </svg>`;
}

// ---- Helpers ----

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 48);
}

// ---- Routes ----

/**
 * GET /api/ops/puzzles
 * List all puzzles for the current scenario (or all if no scenario filter).
 */
puzzleDesignerRoutes.get('/puzzles', async (c) => {
  const scenarioId = c.req.query('scenario_id') || '1';
  const status = c.req.query('status'); // optional filter

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

/**
 * GET /api/ops/puzzles/:slug
 * Get a single puzzle by slug (includes puzzle_js source code).
 */
puzzleDesignerRoutes.get('/puzzles/:slug', async (c) => {
  const slug = c.req.param('slug');
  const puzzle = await c.env.DB.prepare(
    'SELECT * FROM qr_puzzles WHERE slug = ?'
  ).bind(slug).first();

  if (!puzzle) return c.json({ error: 'Puzzle not found' }, 404);
  return c.json({ puzzle });
});

/**
 * POST /api/ops/puzzles
 * Create a new puzzle. Generates slug and QR code URL.
 */
puzzleDesignerRoutes.post('/puzzles', async (c) => {
  const body = await c.req.json<{
    title: string;
    description?: string;
    emoji?: string;
    tag?: string;
    tag_class?: string;
    puzzle_js: string;
    scenario_id?: number;
    chain_order?: number;
    next_slug?: string;
    status?: string;
  }>();

  if (!body.title || !body.puzzle_js) {
    return c.json({ error: 'title and puzzle_js are required' }, 400);
  }

  const slug = slugify(body.title) + '-' + Date.now().toString(36).slice(-4);
  const scenarioId = body.scenario_id || 1;
  const qrUrl = `https://flapsandseals.com/games#${slug}`;

  await c.env.DB.prepare(`
    INSERT INTO qr_puzzles (scenario_id, slug, title, description, emoji, tag, tag_class, puzzle_js, chain_order, next_slug, qr_url, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    scenarioId,
    slug,
    body.title,
    body.description || '',
    body.emoji || '🔐',
    body.tag || 'PUZZLE',
    body.tag_class || 'games-tag-narrative',
    body.puzzle_js,
    body.chain_order || 0,
    body.next_slug || null,
    qrUrl,
    body.status || 'draft',
  ).run();

  // Update prev_slug on the next puzzle if chained
  if (body.next_slug) {
    await c.env.DB.prepare(
      'UPDATE qr_puzzles SET prev_slug = ? WHERE slug = ?'
    ).bind(slug, body.next_slug).run();
  }

  // Fetch the created puzzle to return it
  const created = await c.env.DB.prepare(
    'SELECT * FROM qr_puzzles WHERE slug = ?'
  ).bind(slug).first();

  return c.json({ puzzle: created, qr_url: qrUrl }, 201);
});

/**
 * PUT /api/ops/puzzles/:slug
 * Update an existing puzzle.
 */
puzzleDesignerRoutes.put('/puzzles/:slug', async (c) => {
  const slug = c.req.param('slug');
  const body = await c.req.json<{
    title?: string;
    description?: string;
    emoji?: string;
    tag?: string;
    tag_class?: string;
    puzzle_js?: string;
    chain_order?: number;
    next_slug?: string;
    status?: string;
  }>();

  const existing = await c.env.DB.prepare(
    'SELECT id FROM qr_puzzles WHERE slug = ?'
  ).bind(slug).first();

  if (!existing) return c.json({ error: 'Puzzle not found' }, 404);

  // Build dynamic UPDATE
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
  values.push(slug); // WHERE clause

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

/**
 * DELETE /api/ops/puzzles/:slug
 * Archive a puzzle (soft delete).
 */
puzzleDesignerRoutes.delete('/puzzles/:slug', async (c) => {
  const slug = c.req.param('slug');
  await c.env.DB.prepare(
    'UPDATE qr_puzzles SET status = ?, updated_at = ? WHERE slug = ?'
  ).bind('archived', Date.now(), slug).run();
  return c.json({ ok: true });
});

/**
 * POST /api/ops/puzzles/:slug/publish
 * Set a puzzle live — makes it appear on /games and activates its QR route.
 */
puzzleDesignerRoutes.post('/puzzles/:slug/publish', async (c) => {
  const slug = c.req.param('slug');
  await c.env.DB.prepare(
    'UPDATE qr_puzzles SET status = ?, updated_at = ? WHERE slug = ?'
  ).bind('live', Date.now(), slug).run();

  const puzzle = await c.env.DB.prepare(
    'SELECT slug, title, qr_url FROM qr_puzzles WHERE slug = ?'
  ).bind(slug).first();

  return c.json({ ok: true, puzzle });
});

/**
 * GET /api/ops/puzzles/:slug/qr
 * Returns QR code SVG for the puzzle's URL.
 */
puzzleDesignerRoutes.get('/puzzles/:slug/qr', async (c) => {
  const slug = c.req.param('slug');
  const puzzle = await c.env.DB.prepare(
    'SELECT qr_url FROM qr_puzzles WHERE slug = ?'
  ).bind(slug).first<{ qr_url: string }>();

  if (!puzzle) return c.json({ error: 'Puzzle not found' }, 404);

  const svg = generateQRSvg(puzzle.qr_url, 300);
  return new Response(svg, {
    headers: { 'Content-Type': 'image/svg+xml' },
  });
});

/**
 * GET /api/puzzles/live
 * PUBLIC endpoint (no auth) — returns all live puzzle configs.
 * Called by the client-side qr-custom.js runtime loader.
 */
puzzleDesignerRoutes.get('/live', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT slug, title, description, emoji, tag, tag_class, puzzle_js, chain_order, next_slug, qr_url
     FROM qr_puzzles WHERE status = 'live' ORDER BY chain_order ASC`
  ).all();
  return c.json({ puzzles: result.results });
});

/**
 * GET /api/puzzles/live/:slug
 * PUBLIC endpoint — returns a single live puzzle's JS code.
 * Used by the runtime to load puzzle code on-demand.
 */
puzzleDesignerRoutes.get('/live/:slug', async (c) => {
  const slug = c.req.param('slug');
  const puzzle = await c.env.DB.prepare(
    `SELECT slug, title, puzzle_js, next_slug FROM qr_puzzles WHERE slug = ? AND status = 'live'`
  ).bind(slug).first();

  if (!puzzle) return c.json({ error: 'Puzzle not found or not live' }, 404);
  return c.json({ puzzle });
});
