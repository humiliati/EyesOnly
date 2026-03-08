// Cross-platform uploader for public/audio → R2 (Windows-friendly)
// Mirrors scripts/upload-audio-to-r2.sh behavior.
// Usage:
//   node scripts/upload-audio-to-r2.mjs --dry-run
//   node scripts/upload-audio-to-r2.mjs

import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const BUCKET = 'eyesonly-assets';
const SOURCE_DIR = path.join('public', 'audio');
const DRY_RUN = process.argv.includes('--dry-run');

const exts = new Set(['.wav', '.webm', '.mp3', '.ogg']);

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  switch (ext) {
    case '.wav': return 'audio/wav';
    case '.webm': return 'audio/webm';
    case '.mp3': return 'audio/mpeg';
    case '.ogg': return 'audio/ogg';
    default: return 'application/octet-stream';
  }
}

async function walk(dir) {
  const out = [];
  const items = await readdir(dir, { withFileTypes: true });
  for (const it of items) {
    const p = path.join(dir, it.name);
    if (it.isDirectory()) {
      // skip junk
      if (p.includes('MACOSX') || it.name === '__MACOSX') continue;
      out.push(...await walk(p));
    } else {
      const ext = path.extname(it.name).toLowerCase();
      if (!exts.has(ext)) continue;
      if (it.name.endsWith('.asd')) continue;
      out.push(p);
    }
  }
  return out;
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    // On Windows, `npx` may not be directly spawnable; run through cmd.exe.
    const isWin = process.platform === 'win32';
    const finalCmd = isWin ? 'cmd' : cmd;
    const finalArgs = isWin ? ['/c', cmd, ...args] : args;
    const p = spawn(finalCmd, finalArgs, { stdio: 'inherit', shell: false });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

async function main() {
  if (DRY_RUN) {
    console.log('=== DRY RUN — no files will be uploaded ===\n');
  }

  // verify source exists
  try {
    const st = await stat(SOURCE_DIR);
    if (!st.isDirectory()) throw new Error('not a dir');
  } catch {
    console.error(`SOURCE_DIR not found: ${SOURCE_DIR}`);
    process.exit(1);
  }

  const files = (await walk(SOURCE_DIR)).sort((a, b) => a.localeCompare(b));

  let uploaded = 0, skipped = 0, errors = 0;

  for (const file of files) {
    // Derive R2 key from relative path: public/audio/sfx/Hit 1.wav → audio/sfx/Hit 1.wav
    const rel = file.split(path.sep).join('/');
    const key = rel.replace(/^public\//, '');

    if (file.includes('MACOSX') || file.endsWith('.asd')) {
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [DRY] ${key}`);
      uploaded++;
      continue;
    }

    const ct = contentType(file);
    console.log(`  Uploading: ${key}`);
    try {
      await run('npx', ['wrangler', 'r2', 'object', 'put', `${BUCKET}/${key}`, '--remote', '--file', file, '--content-type', ct]);
      uploaded++;
    } catch (e) {
      console.error('  FAILED:', e?.message || e);
      errors++;
    }
  }

  console.log('\n=== Upload Summary ===');
  console.log(`  Uploaded: ${uploaded}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Errors:   ${errors}`);

  if (DRY_RUN) {
    console.log('\nRun without --dry-run to actually upload.');
  }

  if (!DRY_RUN && errors > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
