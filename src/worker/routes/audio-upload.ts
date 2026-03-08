/* ============================================================
   EYES ONLY — Audio/Video Upload Route
   Accepts multipart file uploads from the Sound Designer portal
   and stores them in the eyesonly-assets R2 bucket.

   POST /api/audio/upload
     Body: multipart/form-data
       - file:        binary file data
       - destination:  "sfx" | "music" | "video"
       - filename:    original filename (used as R2 key suffix)

   Returns: { ok: true, key: "<R2 key>", size: <bytes> }
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
