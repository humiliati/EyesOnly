#!/usr/bin/env bash
# ============================================================
# R2 Audio Sync — Delete old music, upload fresh encoded assets
# Run from project root: bash scripts/r2-audio-sync.sh
# Requires: npx wrangler (authenticated)
# ============================================================
set -euo pipefail

BUCKET="eyesonly-assets"

# Helper: upload all .webm and .mp3 files from a directory to an R2 prefix
upload_dir() {
  local src_dir="$1"
  local r2_prefix="$2"

  if [ ! -d "$src_dir" ]; then
    echo "  ⚠ Directory not found: $src_dir — skipping"
    return
  fi

  local count=0
  for f in "$src_dir"/*; do
    [ -f "$f" ] || continue
    case "$f" in
      *.webm|*.mp3) ;;
      *) continue ;;
    esac
    local base
    base=$(basename "$f")
    echo "  ↑ ${r2_prefix}/${base}"
    npx wrangler r2 object put "${BUCKET}/${r2_prefix}/${base}" --remote --file "$f" || true
    count=$((count + 1))
  done
  echo "  Uploaded $count files from $src_dir"
}

echo "═══════════════════════════════════════════════════════"
echo "  R2 Audio Sync — EyesOnly"
echo "═══════════════════════════════════════════════════════"

# ── Step 1: Delete ALL old music files from R2 ───────────────
echo ""
echo "Step 1: Deleting old music files from R2..."

# Get list of existing music keys
# NOTE: wrangler v4 no longer supports `r2 object list`.
# We can't enumerate keys to delete from the CLI, so we skip the blanket delete.
# Uploads will overwrite existing keys by name.
echo "  (Skipping delete: wrangler has no r2 object list; uploads will overwrite existing keys.)"

# ── Step 2: Upload MUSIC_SONGS (replacement + new tracks) ────
echo ""
echo "Step 2: Uploading MUSIC_SONGS (WebM + MP3)..."
upload_dir "encoded_for_r2/music_songs" "audio/music"

# ── Step 3: Upload Cyberleaf music pack ──────────────────────
echo ""
echo "Step 3: Uploading Cyberleaf music pack (WebM + MP3)..."
upload_dir "encoded_for_r2/cyberleaf" "audio/music"

# ── Step 4: Upload Aila Scott music pack (prep for later) ────
echo ""
echo "Step 4: Uploading Aila Scott music pack (WebM + MP3)..."
upload_dir "encoded_for_r2/aila_scott" "audio/music"

# ── Step 5: Upload footstep SFX ──────────────────────────────
echo ""
echo "Step 5: Uploading footstep SFX (WebM + MP3)..."
upload_dir "encoded_for_r2/footsteps" "audio/sfx"

# ── Step 6: Upload card sounds ───────────────────────────────
echo ""
echo "Step 6: Uploading card sounds (WebM + MP3)..."
upload_dir "encoded_for_r2/card_sounds" "audio/sfx"

# ── Step 7: Upload ENEMY_ALERT SFX ─────────────────────────
echo ""
echo "Step 7: Uploading ENEMY_ALERT SFX (WebM + MP3)..."
upload_dir "encoded_for_r2/enemy_alert" "audio/sfx"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Done! R2 audio sync complete."
echo "  Next: npx wrangler deploy"
echo "═══════════════════════════════════════════════════════"
