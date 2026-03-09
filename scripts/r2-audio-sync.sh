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
    npx wrangler r2 object put "${BUCKET}/${r2_prefix}/${base}" --file "$f" || true
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
OLD_MUSIC=$(npx wrangler r2 object list "$BUCKET" --prefix "audio/music/" 2>&1 | grep -o '"key":"[^"]*"' | sed 's/"key":"//;s/"//' || true)

if [ -n "$OLD_MUSIC" ]; then
  echo "$OLD_MUSIC" | while IFS= read -r key; do
    [ -z "$key" ] && continue
    echo "  x Deleting: $key"
    npx wrangler r2 object delete "${BUCKET}/${key}" || true
  done
  echo "  Old music files deleted."
else
  echo "  No old music files found (or listing failed -- proceeding anyway)."
fi

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

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Done! R2 audio sync complete."
echo "  Next: npx wrangler deploy"
echo "═══════════════════════════════════════════════════════"
