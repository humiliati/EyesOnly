#!/usr/bin/env bash
# ============================================================
#  transcode-audio.sh
#  Convert 16-bit WAV audio assets to web-optimized formats.
#
#  Produces Opus-in-WebM (primary) and MP3 (fallback) alongside
#  the original WAVs. Updates audio-manifest.json with new paths.
#
#  Requirements: ffmpeg (with libopus + libmp3lame)
#    brew install ffmpeg    # macOS
#    sudo apt install ffmpeg  # Ubuntu/Debian
#
#  Usage:
#    ./scripts/transcode-audio.sh              # transcode all
#    ./scripts/transcode-audio.sh --dry-run    # preview only
#    ./scripts/transcode-audio.sh --opus-only  # skip mp3 fallback
#    ./scripts/transcode-audio.sh --cleanup    # remove original WAVs after transcode
# ============================================================

set -euo pipefail

AUDIO_DIR="public/audio"
SFX_DIR="$AUDIO_DIR/sfx"
MUSIC_DIR="$AUDIO_DIR/music"
MANIFEST="$AUDIO_DIR/audio-manifest.json"

DRY_RUN=false
OPUS_ONLY=false
CLEANUP=false

for arg in "$@"; do
  case "$arg" in
    --dry-run)    DRY_RUN=true ;;
    --opus-only)  OPUS_ONLY=true ;;
    --cleanup)    CLEANUP=true ;;
  esac
done

# Check ffmpeg
if ! command -v ffmpeg &>/dev/null; then
  echo "ERROR: ffmpeg not found. Install it first."
  echo "  macOS:  brew install ffmpeg"
  echo "  Linux:  sudo apt install ffmpeg"
  exit 1
fi

converted=0
skipped=0
errors=0

transcode_file() {
  local src="$1"
  local base="${src%.*}"
  local webm="${base}.webm"
  local mp3="${base}.mp3"

  # Skip if already transcoded
  if [[ -f "$webm" ]]; then
    ((skipped++)) || true
    return
  fi

  if $DRY_RUN; then
    echo "[dry-run] Would transcode: $src"
    echo "          → $webm (Opus 96k)"
    if ! $OPUS_ONLY; then
      echo "          → $mp3 (MP3 128k)"
    fi
    ((converted++)) || true
    return
  fi

  echo "Transcoding: $src"

  # Opus in WebM container — best quality/size for web
  # -b:a 96k is excellent for game SFX (voice: 64k, music: 128k)
  local bitrate="96k"
  if [[ "$src" == *music* || "$src" == *MUSIC* ]]; then
    bitrate="128k"
  fi

  if ffmpeg -y -i "$src" -c:a libopus -b:a "$bitrate" -vn "$webm" 2>/dev/null; then
    echo "  ✓ $webm ($(du -h "$webm" | cut -f1))"
  else
    echo "  ✕ Failed: $webm"
    ((errors++)) || true
    return
  fi

  # MP3 fallback (Safari <15.4 doesn't support Opus in WebM)
  if ! $OPUS_ONLY; then
    local mp3_bitrate="128k"
    if ffmpeg -y -i "$src" -c:a libmp3lame -b:a "$mp3_bitrate" -vn "$mp3" 2>/dev/null; then
      echo "  ✓ $mp3 ($(du -h "$mp3" | cut -f1))"
    else
      echo "  ✕ Failed: $mp3"
      ((errors++)) || true
    fi
  fi

  # Optionally remove original WAV
  if $CLEANUP; then
    rm -f "$src"
    echo "  🗑 Removed $src"
  fi

  ((converted++)) || true
}

echo "========================================="
echo "  Audio Transcoder — EYES ONLY"
echo "  Source: $AUDIO_DIR"
echo "  Mode: $(if $DRY_RUN; then echo 'DRY RUN'; else echo 'LIVE'; fi)"
echo "========================================="
echo ""

# Process all WAV files
find "$SFX_DIR" "$MUSIC_DIR" -name "*.wav" -type f 2>/dev/null | sort | while read -r wav; do
  transcode_file "$wav"
done

echo ""
echo "========================================="
echo "  Done: $converted transcoded, $skipped skipped, $errors errors"
echo "========================================="

if ! $DRY_RUN && [[ $converted -gt 0 ]]; then
  echo ""
  echo "NEXT STEPS:"
  echo "  1. Update audio-manifest.json src paths: .wav → .webm"
  echo "     (Or keep .wav and update AudioSystem._resolveURL to prefer .webm)"
  echo "  2. Upload new files to R2:  ./scripts/upload-audio-to-r2.sh"
  echo "  3. Test playback in browser"
  echo ""
  echo "SIZE COMPARISON (approximate):"
  wav_size=$(find "$SFX_DIR" "$MUSIC_DIR" -name "*.wav" -type f -exec du -cb {} + 2>/dev/null | tail -1 | cut -f1 || echo 0)
  webm_size=$(find "$SFX_DIR" "$MUSIC_DIR" -name "*.webm" -type f -exec du -cb {} + 2>/dev/null | tail -1 | cut -f1 || echo 0)
  echo "  WAV total:  $(echo "$wav_size" | numfmt --to=iec 2>/dev/null || echo "${wav_size} bytes")"
  echo "  WebM total: $(echo "$webm_size" | numfmt --to=iec 2>/dev/null || echo "${webm_size} bytes")"
fi
