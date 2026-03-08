/* ============================================================
   EYES ONLY — Audio R2 Route
   Serves audio assets from the eyesonly-assets R2 bucket.

   GET /audio/sfx/:filename  → R2 key: audio/sfx/<filename>
   GET /audio/music/:filename → R2 key: audio/music/<filename>

   Cache-Control: immutable + long max-age (assets are versioned
   by manifest, not by URL).
   ============================================================ */

import { Hono } from 'hono';
import type { Env } from '../../shared/types';

type HonoEnv = { Bindings: Env; Variables: Record<string, unknown> };

export const audioRoutes = new Hono<HonoEnv>();

// MIME type lookup for audio formats
const MIME: Record<string, string> = {
  '.wav':  'audio/wav',
  '.webm': 'audio/webm',
  '.mp3':  'audio/mpeg',
  '.ogg':  'audio/ogg',
  '.opus': 'audio/opus',
  '.m4a':  'audio/mp4',
};

function getMime(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

/**
 * Shared handler for both /sfx/* and /music/*
 */
async function serveAudio(
  r2: R2Bucket,
  subdir: string,
  filename: string,
  rangeHeader: string | null,
): Promise<Response> {
  const key = `audio/${subdir}/${filename}`;

  // Support Range requests (seek in <audio> element / mobile Safari)
  if (rangeHeader) {
    const obj = await r2.get(key, {
      range: parseRange(rangeHeader),
    });

    if (!obj) {
      return new Response('Not Found', { status: 404 });
    }

    const headers = buildHeaders(filename, obj);
    headers.set('Content-Range',
      `bytes ${(obj as R2ObjectBody).range ? formatRange((obj as R2ObjectBody).range!, obj.size) : `0-${obj.size - 1}/${obj.size}`}`);

    return new Response((obj as R2ObjectBody).body, {
      status: 206,
      headers,
    });
  }

  const obj = await r2.get(key);
  if (!obj) {
    return new Response('Not Found', { status: 404 });
  }

  return new Response(obj.body, {
    status: 200,
    headers: buildHeaders(filename, obj),
  });
}

function buildHeaders(filename: string, obj: R2Object): Headers {
  const h = new Headers();
  h.set('Content-Type', getMime(filename));
  h.set('Content-Length', String(obj.size));
  h.set('Accept-Ranges', 'bytes');
  // Long cache — assets are effectively immutable (versioned via manifest)
  h.set('Cache-Control', 'public, max-age=31536000, immutable');
  h.set('Access-Control-Allow-Origin', '*');
  // ETag from R2
  if (obj.etag) h.set('ETag', obj.etag);
  return h;
}

function parseRange(header: string): R2Range {
  // Parse "bytes=START-END" or "bytes=START-"
  const match = header.match(/bytes=(\d+)-(\d*)/);
  if (!match) return { offset: 0 };
  const offset = parseInt(match[1], 10);
  if (match[2]) {
    return { offset, length: parseInt(match[2], 10) - offset + 1 };
  }
  return { offset };
}

function formatRange(range: R2Range, totalSize: number): string {
  const offset = (range as { offset: number }).offset || 0;
  const length = (range as { offset: number; length?: number }).length;
  const end = length ? offset + length - 1 : totalSize - 1;
  return `${offset}-${end}/${totalSize}`;
}

// --- Routes ---

audioRoutes.get('/sfx/:filename{.+}', async (c) => {
  const filename = c.req.param('filename');
  const range = c.req.header('Range') || null;
  return serveAudio(c.env.R2, 'sfx', decodeURIComponent(filename), range);
});

audioRoutes.get('/music/:filename{.+}', async (c) => {
  const filename = c.req.param('filename');
  const range = c.req.header('Range') || null;
  return serveAudio(c.env.R2, 'music', decodeURIComponent(filename), range);
});
