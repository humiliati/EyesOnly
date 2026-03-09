#!/usr/bin/env bash
# ============================================================
# R2 Gap Check — Verify all manifest entries are accessible
# Run from project root: bash scripts/r2-gap-check.sh
# ============================================================
set -euo pipefail

BASE_URL="https://flapsandseals.com"
MANIFEST="public/audio/audio-manifest.json"
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

if [ ! -f "$MANIFEST" ]; then
  echo "ERROR: $MANIFEST not found. Run from project root."
  exit 1
fi

echo "═══════════════════════════════════════════════════════"
echo "  R2 Gap Check — Audio Manifest vs Live Site"
echo "═══════════════════════════════════════════════════════"
echo ""

# Use Python for proper URL encoding and manifest parsing
python3 << 'PYEOF'
import json, subprocess, urllib.parse, sys

manifest_path = "public/audio/audio-manifest.json"
base_url = "https://flapsandseals.com"
ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

with open(manifest_path) as f:
    m = json.load(f)

total = 0
ok = 0
fail = 0
missing = []

for key in sorted(m.keys()):
    src = m[key].get("src", "")
    if not src:
        continue
    total += 1

    # URL-encode the path (spaces, apostrophes, etc.)
    parts = src.split("/")
    encoded_parts = [urllib.parse.quote(p, safe="") for p in parts]
    encoded_src = "/".join(encoded_parts)
    url = f"{base_url}{encoded_src}"

    try:
        r = subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}",
             "--head", "--max-time", "5", "-A", ua, url],
            capture_output=True, text=True, timeout=10
        )
        code = r.stdout.strip()
    except Exception:
        code = "000"

    if code in ("200", "206"):
        ok += 1
    else:
        fail += 1
        entry = f"  [{code}] {key} -> {src}"
        missing.append(entry)
        print(f"  MISS {entry}")

    if total % 50 == 0:
        print(f"  ... checked {total} entries", file=sys.stderr)

print("")
print("───────────────────────────────────────────────────────")
print(f"  Total manifest entries: {total}")
print(f"  Accessible:            {ok}")
print(f"  Missing/Failed:        {fail}")
print("───────────────────────────────────────────────────────")

if fail > 0:
    print("")
    print("Missing entries:")
    for m in missing:
        print(m)
    print("")
    print("Fix: Run 'bash scripts/r2-audio-sync.sh' then 'npx wrangler deploy'")
else:
    print("")
    print("  ✓ All manifest entries are accessible!")
PYEOF
