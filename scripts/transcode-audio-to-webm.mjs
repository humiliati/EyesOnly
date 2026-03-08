// Windows-friendly audio transcoder for EyesOnly
// Converts public/audio/**/*.wav -> .webm (Opus) and optionally .mp3.
// Updates public/audio/audio-manifest.json to point .wav -> .webm when produced.
//
// Requirements:
//   - ffmpeg in PATH (with libopus; mp3 optional)
// Usage:
//   node scripts/transcode-audio-to-webm.mjs --dry-run
//   node scripts/transcode-audio-to-webm.mjs --opus-only
//   node scripts/transcode-audio-to-webm.mjs --cleanup

import { readdir, stat, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const AUDIO_DIR = path.join('public', 'audio');
const MANIFEST_PATH = path.join(AUDIO_DIR, 'audio-manifest.json');
const DRY_RUN = process.argv.includes('--dry-run');
const OPUS_ONLY = process.argv.includes('--opus-only');
const CLEANUP = process.argv.includes('--cleanup');

function resolveFFmpeg() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;

  // Try PATH first
  let r = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore', shell: false });
  if (r.status === 0) return 'ffmpeg';

  // Common Windows install locations (winget/choco/manual)
  const candidates = [
    'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\Program Files\\Gyan\\FFmpeg\\bin\\ffmpeg.exe',
    'C:\\Program Files\\Gyan\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe',
  ];
  for (const p of candidates) {
    r = spawnSync(p, ['-version'], { stdio: 'ignore', shell: false });
    if (r.status === 0) return p;
  }

  return null;
}

async function walk(dir) {
  const out = [];
  const items = await readdir(dir, { withFileTypes: true });
  for (const it of items) {
    const p = path.join(dir, it.name);
    if (it.isDirectory()) {
      if (it.name === '__MACOSX' || p.includes('MACOSX')) continue;
      out.push(...await walk(p));
    } else {
      if (it.name.toLowerCase().endsWith('.wav')) out.push(p);
    }
  }
  return out;
}

function transcode(src) {
  const base = src.slice(0, -4);
  const webm = base + '.webm';
  const mp3 = base + '.mp3';

  // bitrate: 96k sfx, 128k music
  const isMusic = src.toLowerCase().includes(`${path.sep}music${path.sep}`) || src.toLowerCase().includes('music');
  const opusBitrate = isMusic ? '128k' : '96k';

  if (DRY_RUN) {
    console.log(`[dry] ${src} -> ${webm} (opus ${opusBitrate})${OPUS_ONLY ? '' : `, ${mp3} (mp3 128k)`}`);
    return { webm, mp3, did: true };
  }

  // Skip if webm exists
  // (we don't stat here; ffmpeg -y will overwrite anyway; keep it simple)
  console.log(`Transcoding: ${src}`);

  // IMPORTANT: do not use shell=true; it breaks on Windows paths with spaces/apostrophes.
  const ff = globalThis.__FFMPEG__ || 'ffmpeg';
  const r1 = spawnSync(ff, ['-y', '-i', src, '-c:a', 'libopus', '-b:a', opusBitrate, '-vn', webm], { stdio: 'inherit', shell: false });
  if (r1.status !== 0) throw new Error(`ffmpeg opus failed (${r1.status}) for ${src}`);

  if (!OPUS_ONLY) {
    const r2 = spawnSync(ff, ['-y', '-i', src, '-c:a', 'libmp3lame', '-b:a', '128k', '-vn', mp3], { stdio: 'inherit', shell: false });
    if (r2.status !== 0) console.warn(`ffmpeg mp3 failed (${r2.status}) for ${src}`);
  }

  if (CLEANUP) {
    // don't delete in dry-run
    spawnSync(process.platform === 'win32' ? 'cmd' : 'rm', process.platform === 'win32' ? ['/c', 'del', '/q', src] : ['-f', src], { stdio: 'ignore', shell: true });
  }

  return { webm, mp3, did: true };
}

function rewriteManifest(manifestJson) {
  // Rewrite .wav -> .webm ONLY if the .webm file exists locally.
  // This prevents broken manifest entries when transcode fails.
  let changed = 0;
  for (const k of Object.keys(manifestJson)) {
    if (k === '_meta') continue;
    const entry = manifestJson[k];
    if (!entry || typeof entry !== 'object') continue;
    const src = entry.src;
    if (typeof src === 'string' && src.toLowerCase().endsWith('.wav')) {
      const webmSrc = src.slice(0, -4) + '.webm';
      const localWebmPath = path.join('public', webmSrc.replace(/^\//, '').split('/').join(path.sep));
      if (DRY_RUN) {
        // In dry-run, assume it will exist.
        entry.src = webmSrc;
        changed++;
      } else {
        try {
          // stat() imported at top
          // eslint-disable-next-line no-await-in-loop
        } catch {}
        // Use sync check via spawnSync not needed; simplest: fs stat via spawn?
        // We'll use spawnSync in Node? Instead rely on statSync via spawn? No.
        // We'll approximate with an existence check using spawnSync('cmd','/c','if exist').
        const exists = spawnSync(process.platform === 'win32' ? 'cmd' : 'bash',
          process.platform === 'win32'
            ? ['/c', 'if', 'exist', localWebmPath, '(exit', '0)', 'else', '(exit', '1)']
            : ['-lc', `test -f "${localWebmPath}"`],
          { stdio: 'ignore', shell: false }).status === 0;
        if (exists) {
          entry.src = webmSrc;
          changed++;
        }
      }
    }
  }
  return changed;
}

async function main() {
  const FFMPEG = resolveFFmpeg();
  if (!FFMPEG) {
    console.error('ERROR: ffmpeg not found. Install it first or set FFMPEG_PATH.');
    console.error('  Windows (winget): winget install Gyan.FFmpeg');
    console.error('  Windows (choco):  choco install ffmpeg');
    process.exit(1);
  }
  // Expose to transcode() via global
  globalThis.__FFMPEG__ = FFMPEG;


  const files = (await walk(AUDIO_DIR)).sort((a, b) => a.localeCompare(b));
  console.log(`Found ${files.length} WAV files under ${AUDIO_DIR}`);

  let ok = 0, err = 0;
  for (const f of files) {
    try {
      transcode(f);
      ok++;
    } catch (e) {
      console.error(String(e?.message || e));
      err++;
    }
  }

  // Update manifest
  const raw = await readFile(MANIFEST_PATH, 'utf-8');
  const manifest = JSON.parse(raw);
  const changed = rewriteManifest(manifest);

  if (DRY_RUN) {
    console.log(`[dry] Would update manifest: ${changed} entries .wav -> .webm`);
  } else {
    await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
    console.log(`Updated manifest: ${changed} entries .wav -> .webm`);
  }

  console.log(`Done. success=${ok} errors=${err}`);
  if (err) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
