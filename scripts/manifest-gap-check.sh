#!/usr/bin/env bash
# ============================================================
# manifest-gap-check.sh — CI/Pre-Deploy Manifest→R2 Integrity Check
#
# Uses the /api/audio/check-gaps endpoint (server-side R2 listing)
# instead of curl-per-file. Much faster for large manifests.
#
# Usage:
#   bash scripts/manifest-gap-check.sh [BASE_URL]
#
# Default BASE_URL: https://flapsandseals.com
# Exits non-zero if any manifest src/fallback is missing from R2.
# Suitable for CI pipelines and pre-deploy validation.
# ============================================================
set -euo pipefail

BASE_URL="${1:-https://flapsandseals.com}"
MANIFEST="public/audio/audio-manifest.json"

if [ ! -f "$MANIFEST" ]; then
  echo "ERROR: $MANIFEST not found. Run from project root."
  exit 1
fi

echo "═══════════════════════════════════════════════════════"
echo "  Manifest → R2 Gap Check (API-based)"
echo "  Base URL: $BASE_URL"
echo "═══════════════════════════════════════════════════════"
echo ""

# POST the manifest to the check-gaps endpoint
RESPONSE=$(curl -s -X POST \
  "${BASE_URL}/api/audio/check-gaps" \
  -H "Content-Type: application/json" \
  -d "{\"manifest\": $(cat "$MANIFEST" | python3 -c "
import json, sys
m = json.load(sys.stdin)
# Strip _meta key
m.pop('_meta', None)
json.dump(m, sys.stdout)
")}")

# Parse response
OK=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print('true' if d.get('ok') else 'false')")

if [ "$OK" != "true" ]; then
  echo "ERROR: API call failed"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
  exit 1
fi

# Extract counts
python3 << PYEOF
import json, sys

data = json.loads('''$RESPONSE''')

total_manifest = data.get('totalManifest', 0)
total_r2 = data.get('totalR2', 0)
broken = data.get('broken', [])
orphans = data.get('orphans', [])

print(f"  Manifest entries: {total_manifest}")
print(f"  R2 objects:       {total_r2}")
print(f"  Missing assets:   {len(broken)}")
print(f"  Orphan files:     {len(orphans)}")
print("")

if broken:
    print("MISSING ASSETS (manifest refs → no R2 object):")
    for b in broken:
        print(f"  ✗ {b['id']} → {b['src']} ({b.get('type', 'src')})")
    print("")

if orphans:
    print(f"ORPHANED R2 FILES ({len(orphans)} not in manifest):")
    for o in orphans[:20]:
        print(f"  ? {o['key']}")
    if len(orphans) > 20:
        print(f"  ... and {len(orphans) - 20} more")
    print("")

if broken:
    print("───────────────────────────────────────────────────────")
    print(f"  FAIL: {len(broken)} manifest entries missing from R2")
    print("  Fix: upload missing files or update manifest")
    print("───────────────────────────────────────────────────────")
    sys.exit(1)
else:
    print("───────────────────────────────────────────────────────")
    print("  ✓ All manifest entries have corresponding R2 objects")
    print("───────────────────────────────────────────────────────")
    sys.exit(0)
PYEOF
