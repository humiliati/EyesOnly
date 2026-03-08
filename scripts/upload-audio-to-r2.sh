#!/usr/bin/env bash
# ============================================================
# upload-audio-to-r2.sh
# Uploads all audio assets from public/audio/ to the
# eyesonly-assets R2 bucket under the audio/ prefix.
#
# Usage:
#   ./scripts/upload-audio-to-r2.sh          # upload all
#   ./scripts/upload-audio-to-r2.sh --dry-run # preview only
#
# Requires: wrangler CLI authenticated (`wrangler login`)
# ============================================================

set -euo pipefail

BUCKET="eyesonly-assets"
SOURCE_DIR="public/audio"
DRY_RUN=false

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "=== DRY RUN — no files will be uploaded ==="
  echo ""
fi

# Counters
uploaded=0
skipped=0
errors=0

# Find all .wav files (skip junk)
while IFS= read -r -d '' file; do
  # Derive R2 key from relative path: public/audio/sfx/Hit 1.wav → audio/sfx/Hit 1.wav
  key="${file#public/}"

  # Skip macOS resource forks and Ableton sidecars
  if [[ "$file" == *"MACOSX"* ]] || [[ "$file" == *.asd ]]; then
    ((skipped++)) || true
    continue
  fi

  if $DRY_RUN; then
    echo "  [DRY] $key"
    ((uploaded++)) || true
  else
    # Determine content type
    case "${file,,}" in
      *.wav)  ct="audio/wav" ;;
      *.webm) ct="audio/webm" ;;
      *.mp3)  ct="audio/mpeg" ;;
      *.ogg)  ct="audio/ogg" ;;
      *)      ct="application/octet-stream" ;;
    esac

    echo -n "  Uploading: $key ... "
    if wrangler r2 object put "${BUCKET}/${key}" \
        --file="$file" \
        --content-type="$ct" \
        2>/dev/null; then
      echo "OK"
      ((uploaded++)) || true
    else
      echo "FAILED"
      ((errors++)) || true
    fi
  fi
done < <(find "$SOURCE_DIR" -type f \( -name '*.wav' -o -name '*.webm' -o -name '*.mp3' -o -name '*.ogg' \) -print0 | sort -z)

echo ""
echo "=== Upload Summary ==="
echo "  Uploaded: $uploaded"
echo "  Skipped:  $skipped"
echo "  Errors:   $errors"

if $DRY_RUN; then
  echo ""
  echo "Run without --dry-run to actually upload."
fi
