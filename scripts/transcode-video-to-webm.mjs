// Video Transcode to WebM — optimized for splash screen background video.
//
// Converts MP4 source files to WebM with:
// - VP9 codec for better compression
// - 720p resolution
// - No audio track (videos are muted)
// - Target ~1Mbps bitrate
//
// Usage:
//   node scripts/transcode-video-to-webm.mjs          // process all videos
//   node scripts/transcode-video-to-webm.mjs --dry    // show what would be done
//
// Output goes to: encoded_for_r2/video/

import { readdir, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const SOURCE_DIR = 'MEDIA_ASSETS';
const OUTPUT_DIR = 'encoded_for_r2/video';
const DRY_RUN = process.argv.includes('--dry');

const VIDEOS = [
  { src: 'Sandpoint1_ Schweitzer Mountain Resort.mp4', name: 'Sandpoint1_SchweitzerMountain.webm' },
  { src: 'Sandpoint2_ Lake Pend Oreille.mp4', name: 'Sandpoint2_LakePendOreille.webm' },
  { src: 'Sandpoint3_ Lake Pend Oreille.mp4', name: 'Sandpoint3_LakePendOreille.webm' },
  { src: 'Sandpoint _ Lake Pend Oreille.mp4', name: 'Sandpoint_LakePendOreille.webm' },
];

const FFMPEG_CRF = 28;           // Quality: lower = better, 28 is good compromise
const FFMPEG_PRESET = 'medium'; // Speed/quality tradeoff
const TARGET_WIDTH = 1280;      // 720p-ish (maintains aspect ratio)
const TARGET_BITRATE = '1.5M';  // Target max bitrate

async function fileExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function getFFmpegCmd() {
  const isWin = process.platform === 'win32';
  return isWin ? 'ffmpeg' : 'ffmpeg';
}

async function transcodeVideo(srcPath, dstPath) {
  const ffmpeg = getFFmpegCmd();
  
  const args = [
    '-i', srcPath,
    '-c:v', 'libx264',
    '-preset', FFMPEG_PRESET,
    '-crf', String(FFMPEG_CRF),
    '-maxrate', TARGET_BITRATE,
    '-bufsize', '3M',
    '-an',                    // Strip audio (no sound needed)
    '-vf', `scale=${TARGET_WIDTH}:-2`,  // Scale to 720p-ish, -2 ensures divisible by 2
    '-pix_fmt', 'yuv420p',    // Better compatibility
    '-movflags', '+faststart', // Better web streaming
    '-threads', '0',          // Use all available cores
    '-y',                    // Overwrite output
    dstPath
  ];

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpeg, args, { stdio: 'inherit' });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });
    proc.on('error', reject);
  });
}

async function getFileSize(p) {
  try {
    const fs = await import('node:fs/promises');
    const stats = await fs.stat(p);
    return stats.size;
  } catch {
    return 0;
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function main() {
  console.log('=== Video Transcode to WebM ===\n');

  // Ensure output directory exists
  if (!DRY_RUN) {
    await mkdir(OUTPUT_DIR, { recursive: true });
  }

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const v of VIDEOS) {
    const srcPath = path.join(SOURCE_DIR, v.src);
    const dstPath = path.join(OUTPUT_DIR, v.name);

    const srcExists = await fileExists(srcPath);
    if (!srcExists) {
      console.log(`[SKIP] Source not found: ${v.src}`);
      skipped++;
      continue;
    }

    const srcSize = await getFileSize(srcPath);

    if (DRY_RUN) {
      console.log(`[DRY] Would transcode: ${v.src}`);
      console.log(`       -> ${v.name}`);
      console.log(`       Source size: ${formatSize(srcSize)}\n`);
      processed++;
      continue;
    }

    console.log(`[TRANSCODE] ${v.src}`);
    console.log(`  Source size: ${formatSize(srcSize)}`);

    try {
      await transcodeVideo(srcPath, dstPath);
      const dstSize = await getFileSize(dstPath);
      const savings = ((srcSize - dstSize) / srcSize * 100).toFixed(1);
      console.log(`  Output size: ${formatSize(dstSize)} (${savings}% smaller)\n`);
      processed++;
    } catch (e) {
      console.log(`  ERROR: ${e.message}\n`);
      errors++;
    }
  }

  console.log('=== Summary ===');
  console.log(`  Processed: ${processed}`);
  console.log(`  Skipped:   ${skipped}`);
  console.log(`  Errors:    ${errors}${DRY_RUN ? ' (dry-run)' : ''}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
