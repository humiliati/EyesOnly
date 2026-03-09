// R2 Gap Upload — only upload missing encoded audio files to remote R2.
//
// Walks encoded_for_r2/ and checks whether each expected object exists in
// eyesonly-assets under audio/sfx or audio/music. If missing, uploads it.
//
// Usage:
//   node scripts/r2-gap-upload.mjs --dry-run
//   node scripts/r2-gap-upload.mjs
//
// Notes:
// - Uses `npx wrangler r2 object get/put` (wrangler v4 has no list command).
// - Requires `wrangler login`.

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const BUCKET = 'eyesonly-assets';
const ROOT = 'encoded_for_r2';
const DRY_RUN = process.argv.includes('--dry-run');
const BASE_URL = process.env.R2_GAP_BASE_URL || 'https://flapsandseals.com';
const CONCURRENCY = Math.max(1, Number(process.env.R2_GAP_CONCURRENCY || '12'));
const TIMEOUT_MS = Math.max(1000, Number(process.env.R2_GAP_TIMEOUT_MS || '6000'));

const AUDIO_DIR_MAP = {
  // music
  music_songs: 'music',
  cyberleaf: 'music',
  aila_scott: 'music',
  // sfx
  footsteps: 'sfx',
  card_sounds: 'sfx',
  enemy_alert: 'sfx',
  new_sfx: 'sfx',
  // tolerate accidental folder name
  'new_sfx??': 'sfx',
};

function ctFor(file) {
  const ext = path.extname(file).toLowerCase();
  switch (ext) {
    case '.webm': return 'audio/webm';
    case '.mp3': return 'audio/mpeg';
    case '.ogg': return 'audio/ogg';
    case '.wav': return 'audio/wav';
    default: return 'application/octet-stream';
  }
}

function runWrangler(args) {
  // Windows-safe: run via cmd
  const isWin = process.platform === 'win32';
  const cmd = isWin ? 'cmd' : 'npx';
  const finalArgs = isWin ? ['/c', 'npx', 'wrangler', ...args] : ['wrangler', ...args];
  const r = spawnSync(cmd, finalArgs, { stdio: 'inherit', shell: false });
  return r.status ?? 1;
}

function encodePath(p) {
  // Encode each segment to preserve slashes but escape spaces/apostrophes.
  return p.split('/').map(seg => encodeURIComponent(seg)).join('/');
}

async function headExists(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { method: 'HEAD', signal: ctrl.signal });
    return r.status === 200 || r.status === 206;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

async function listFiles(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...await listFiles(p));
    } else {
      const ext = path.extname(ent.name).toLowerCase();
      if (ext === '.webm' || ext === '.mp3') out.push(p);
    }
  }
  return out;
}

function topFolder(p) {
  const parts = p.split(path.sep);
  const idx = parts.indexOf(ROOT);
  if (idx === -1) return null;
  return parts[idx + 1] || null;
}

function inferKindFromTop(top) {
  if (!top) return null;
  if (AUDIO_DIR_MAP[top]) return AUDIO_DIR_MAP[top];
  const t = String(top).toLowerCase();
  // Heuristic: any folder name containing 'music' is treated as music.
  if (t.includes('music')) return 'music';
  // Default: treat as sfx (covers new_sfx packs, enemy alerts, etc.)
  return 'sfx';
}

function r2KeyFor(localPath) {
  const top = topFolder(localPath);
  const kind = inferKindFromTop(top);
  if (!kind) return null;
  const filename = path.basename(localPath);
  return `audio/${kind}/${filename}`;
}

async function main() {
  // enumerate
  const files = await listFiles(ROOT);
  let considered = 0;
  let exists = 0;
  let uploaded = 0;
  let skipped = 0;
  let errors = 0;

  // Concurrency-limited worker loop
  let idx = 0;
  async function worker() {
    while (idx < files.length) {
      const f = files[idx++];
      const key = r2KeyFor(f);
      if (!key) { skipped++; continue; }
      considered++;

      const objectPath = `${BUCKET}/${key}`;
      const publicUrl = `${BASE_URL}/${encodePath(key)}`;

      const okRemote = await headExists(publicUrl);
      if (okRemote) { exists++; continue; }

      if (DRY_RUN) {
        console.log(`[DRY] missing -> upload ${key}  (from ${f})`);
        uploaded++;
        continue;
      }

      const ct = ctFor(f);
      const st2 = runWrangler(['r2', 'object', 'put', objectPath, '--remote', '--file', f, '--content-type', ct]);
      if (st2 === 0) uploaded++;
      else errors++;
    }
  }

  const pool = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(pool);


  console.log('');
  console.log('=== R2 Gap Upload Summary ===');
  console.log(`  Found local encoded files: ${files.length}`);
  console.log(`  Considered (mapped):      ${considered}`);
  console.log(`  Already in R2:            ${exists}`);
  console.log(`  Uploaded:                 ${uploaded}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`  Skipped (unmapped):       ${skipped}`);
  console.log(`  Errors:                   ${errors}`);

  if (!DRY_RUN && errors > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
