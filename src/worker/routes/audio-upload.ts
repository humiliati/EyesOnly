/* ============================================================
   EYES ONLY — Audio/Video Upload & Management Routes
   Accepts multipart file uploads from the Media Designer portal
   and stores them in the eyesonly-assets R2 bucket.

   POST /api/audio/upload          — upload a file to R2
   GET  /api/audio/list            — list R2 objects by prefix
   DELETE /api/audio/delete        — delete a single R2 object
   POST /api/audio/delete-batch    — delete multiple R2 objects
   POST /api/audio/rename          — copy+delete (rename) an R2 object
   POST /api/audio/check-gaps      — compare manifest refs vs R2 keys
   ============================================================ */

import { Hono } from 'hono';
import type { Env } from '../../shared/types';

type HonoEnv = { Bindings: Env; Variables: Record<string, unknown> };

export const audioUploadRoutes = new Hono<HonoEnv>();

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

// MIME map for setting correct Content-Type on R2 objects
const MIME: Record<string, string> = {
  '.wav':  'audio/wav',
  '.webm': 'audio/webm',
  '.mp3':  'audio/mpeg',
  '.ogg':  'audio/ogg',
  '.opus': 'audio/opus',
  '.m4a':  'audio/mp4',
  '.mp4':  'video/mp4',
};

// Destination → R2 key prefix
const DEST_PREFIX: Record<string, string> = {
  sfx:   'audio/sfx',
  music: 'audio/music',
  video: 'video',
};

function getMime(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

audioUploadRoutes.post('/upload', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    const destination = (formData.get('destination') as string) || 'sfx';
    const filename = (formData.get('filename') as string) || file?.name || 'upload';

    if (!file) {
      return c.json({ ok: false, error: 'No file provided' }, 400);
    }

    if (file.size > MAX_SIZE) {
      return c.json({ ok: false, error: `File too large (${(file.size / 1048576).toFixed(1)} MB > 50 MB limit)` }, 413);
    }

    const prefix = DEST_PREFIX[destination];
    if (!prefix) {
      return c.json({ ok: false, error: `Invalid destination: ${destination}. Use sfx, music, or video.` }, 400);
    }

    // Sanitize filename: keep original name but strip path separators
    const safeName = filename.replace(/[/\\]/g, '_');
    const key = `${prefix}/${safeName}`;

    // Upload to R2
    await c.env.R2.put(key, file.stream(), {
      httpMetadata: {
        contentType: getMime(safeName),
      },
      customMetadata: {
        uploadedAt: new Date().toISOString(),
        originalName: filename,
      },
    });

    return c.json({
      ok: true,
      key,
      size: file.size,
      contentType: getMime(safeName),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[audio-upload] error:', message);
    return c.json({ ok: false, error: message }, 500);
  }
});

// GET /list?prefix=audio/sfx — list files in R2 under a prefix
audioUploadRoutes.get('/list', async (c) => {
  const prefix = c.req.query('prefix') || 'audio/';
  const limit = Math.min(parseInt(c.req.query('limit') || '200', 10), 1000);

  try {
    const listed = await c.env.R2.list({ prefix, limit });
    const files = listed.objects.map((obj) => ({
      key: obj.key,
      size: obj.size,
      uploaded: obj.uploaded.toISOString(),
      etag: obj.etag,
    }));

    return c.json({
      ok: true,
      prefix,
      count: files.length,
      truncated: listed.truncated,
      files,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ ok: false, error: message }, 500);
  }
});

// ─── DELETE /delete?key=audio/sfx/filename.webm ────────────────────
// Deletes a single R2 object by key
audioUploadRoutes.delete('/delete', async (c) => {
  const key = c.req.query('key');
  if (!key) {
    return c.json({ ok: false, error: 'Missing "key" query parameter' }, 400);
  }
  try {
    await c.env.R2.delete(key);
    return c.json({ ok: true, deleted: key });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[audio-delete] error:', message);
    return c.json({ ok: false, error: message }, 500);
  }
});

// ─── POST /delete-batch ────────────────────────────────────────────
// Body: { keys: ["audio/sfx/a.webm", "audio/sfx/a.mp3", ...] }
audioUploadRoutes.post('/delete-batch', async (c) => {
  try {
    const body = await c.req.json<{ keys?: string[] }>();
    const keys = body?.keys;
    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      return c.json({ ok: false, error: 'Body must include "keys" array' }, 400);
    }
    if (keys.length > 500) {
      return c.json({ ok: false, error: 'Maximum 500 keys per batch' }, 400);
    }

    let deletedCount = 0;
    const failures: { key: string; error: string }[] = [];

    for (const key of keys) {
      try {
        await c.env.R2.delete(key);
        deletedCount++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        failures.push({ key, error: msg });
      }
    }

    return c.json({
      ok: true,
      deletedCount,
      failedCount: failures.length,
      failures,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[audio-delete-batch] error:', message);
    return c.json({ ok: false, error: message }, 500);
  }
});

// ─── POST /rename ──────────────────────────────────────────────────
// Body: { oldKey: "audio/sfx/old.webm", newKey: "audio/sfx/new.webm" }
// Copy-then-delete: R2 has no native rename.
audioUploadRoutes.post('/rename', async (c) => {
  try {
    const body = await c.req.json<{ oldKey?: string; newKey?: string }>();
    const { oldKey, newKey } = body || {};

    if (!oldKey || !newKey) {
      return c.json({ ok: false, error: 'Body must include "oldKey" and "newKey"' }, 400);
    }
    if (oldKey === newKey) {
      return c.json({ ok: false, error: 'oldKey and newKey are identical' }, 400);
    }

    // Fetch existing object
    const existing = await c.env.R2.get(oldKey);
    if (!existing) {
      return c.json({ ok: false, error: `Source object not found: ${oldKey}` }, 404);
    }

    // Copy to new key, preserving metadata
    await c.env.R2.put(newKey, existing.body, {
      httpMetadata: existing.httpMetadata,
      customMetadata: {
        ...existing.customMetadata,
        renamedFrom: oldKey,
        renamedAt: new Date().toISOString(),
      },
    });

    // Delete old key
    await c.env.R2.delete(oldKey);

    return c.json({ ok: true, oldKey, newKey });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[audio-rename] error:', message);
    return c.json({ ok: false, error: message }, 500);
  }
});

// ─── POST /check-gaps ──────────────────────────────────────────────
// Body: { manifest: { "id": { "src": "/audio/sfx/x.webm", ... }, ... } }
// Compares manifest src/fallback paths against actual R2 keys.
audioUploadRoutes.post('/check-gaps', async (c) => {
  try {
    const body = await c.req.json<{
      manifest?: Record<string, { src?: string; fallback?: string }>;
    }>();
    const manifest = body?.manifest;

    if (!manifest || typeof manifest !== 'object') {
      return c.json({ ok: false, error: 'Body must include "manifest" object' }, 400);
    }

    // Collect all R2 keys under audio/ (paginate if needed)
    const r2Keys = new Set<string>();
    let cursor: string | undefined;
    do {
      const listed = await c.env.R2.list({
        prefix: 'audio/',
        limit: 1000,
        cursor,
      });
      for (const obj of listed.objects) {
        r2Keys.add(obj.key);
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);

    // Build expected keys from manifest (strip leading /)
    const broken: { id: string; src: string; type: string }[] = [];
    const expectedKeys = new Set<string>();

    for (const [id, entry] of Object.entries(manifest)) {
      if (entry.src) {
        const key = entry.src.replace(/^\//, '');
        expectedKeys.add(key);
        if (!r2Keys.has(key)) {
          broken.push({ id, src: entry.src, type: 'src' });
        }
      }
      if (entry.fallback) {
        const key = entry.fallback.replace(/^\//, '');
        expectedKeys.add(key);
        if (!r2Keys.has(key)) {
          broken.push({ id, src: entry.fallback, type: 'fallback' });
        }
      }
    }

    // Orphans: R2 objects not referenced by any manifest entry
    const orphans: { key: string }[] = [];
    for (const key of r2Keys) {
      if (!expectedKeys.has(key)) {
        orphans.push({ key });
      }
    }

    return c.json({
      ok: true,
      totalManifest: Object.keys(manifest).length,
      totalR2: r2Keys.size,
      broken,
      orphans,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[audio-check-gaps] error:', message);
    return c.json({ ok: false, error: message }, 500);
  }
});
