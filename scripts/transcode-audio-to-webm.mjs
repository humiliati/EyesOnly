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

function hasFFmpeg() {
  const r = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore', shell: true });
  return r.status === 0;
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

  const r1 = spawnSync('ffmpeg', ['-y', '-i', src, '-c:a', 'libopus', '-b:a', opusBitrate, '-vn', webm], { stdio: 'inherit', shell: true });
  if (r1.status !== 0) throw new Error(`ffmpeg opus failed (${r1.status}) for ${src}`);

  if (!OPUS_ONLY) {
    const r2 = spawnSync('ffmpeg', ['-y', '-i', src, '-c:a', 'libmp3lame', '-b:a', '128k', '-vn', mp3], { stdio: 'inherit', shell: true });
    if (r2.status !== 0) console.warn(`ffmpeg mp3 failed (${r2.status}) for ${src}`);
  }

  if (CLEANUP) {
    // don't delete in dry-run
    spawnSync(process.platform === 'win32' ? 'cmd' : 'rm', process.platform === 'win32' ? ['/c', 'del', '/q', src] : ['-f', src], { stdio: 'ignore', shell: true });
  }

  return { webm, mp3, did: true };
}

function rewriteManifest(manifestJson) {
  // Only rewrite .wav -> .webm for entries that look like /audio/.../*.wav
  let changed = 0;
  for (const k of Object.keys(manifestJson)) {
    if (k === '_meta') continue;
    const entry = manifestJson[k];
    if (!entry || typeof entry !== 'object') continue;
    const src = entry.src;
    if (typeof src === 'string' && src.toLowerCase().endsWith('.wav')) {
      entry.src = src.slice(0, -4) + '.webm';
      changed++;
    }
  }
  return changed;
}

async function main() {
  if (!hasFFmpeg()) {
    console.error('ERROR: ffmpeg not found in PATH. Install it first.');
    console.error('  Windows (winget): winget install Gyan.FFmpeg');
    console.error('  Windows (choco):  choco install ffmpeg');
    process.exit(1);
  }

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
