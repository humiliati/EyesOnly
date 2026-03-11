/* ============================================================
   EYES ONLY — Video R2 Route
   Serves video assets from the eyesonly-assets R2 bucket.

   GET /video/:filename  → R2 key: video/<filename>

   Same pattern as audio.ts: Range request support, long cache,
   CORS handled by Hono middleware in index.ts.
   ============================================================ */

import { Hono } from 'hono';
import type { Env } from '../../shared/types';

type HonoEnv = { Bindings: Env; Variables: Record<string, unknown> };

export const videoRoutes = new Hono<HonoEnv>();

// MIME type lookup for video formats
const MIME: Record<string, string> = {
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.mov':  'video/quicktime',
  '.m4v':  'video/mp4',
  '.ogv':  'video/ogg',
};

function getMime(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

/**
 * Serve a video file from R2.
 * Supports Range requests for seeking in <video> elements.
 */
async function serveVideo(
  r2: R2Bucket,
  filename: string,
  rangeHeader: string | null,
): Promise<Response> {
  const key = `video/${filename}`;

  // Support Range requests (seek in <video> element / mobile Safari)
  if (rangeHeader) {
    const parsed = parseRange(rangeHeader);
    const obj = await r2.get(key, { range: parsed });

    if (!obj) {
      return new Response('Not Found', { status: 404 });
    }

    const body = obj as R2ObjectBody;
    const headers = buildHeaders(filename, obj);

    // Content-Length must be the CHUNK size, not the total file size.
    const offset = (parsed as { offset: number }).offset ?? 0;
    const chunkLen = 'length' in parsed && (parsed as { length?: number }).length
      ? (parsed as { length: number }).length
      : obj.size - offset;
    headers.set('Content-Length', String(chunkLen));

    const rangeEnd = offset + chunkLen - 1;
    headers.set('Content-Range', `bytes ${offset}-${rangeEnd}/${obj.size}`);

    return new Response(body.body, {
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
  // NOTE: CORS headers (Access-Control-*) are handled by the Hono CORS
  // middleware in index.ts.  Do NOT set them here — duplicate
  // Access-Control-Allow-Origin headers cause browsers to reject the
  // CORS check, which breaks <video crossorigin> playback.
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

// --- Route ---

videoRoutes.get('/:filename{.+}', async (c) => {
  const filename = c.req.param('filename');
  const range = c.req.header('Range') || null;
  return serveVideo(c.env.R2, decodeURIComponent(filename), range);
});
