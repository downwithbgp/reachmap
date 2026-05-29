#!/usr/bin/env bash
set -euo pipefail

COUNTRY="${1:-CU}"
SCENARIO="${2:-mar2026}"
INDEX_DIR="web/app/public/data/${COUNTRY}/timeline/${SCENARIO}"
SNAP_BASE="web/app/public/data/${COUNTRY}/timeline"

if [ ! -f "$INDEX_DIR/index.json" ]; then
  echo "FAIL: Timeline index not found at $INDEX_DIR/index.json"
  exit 1
fi

echo "=== ReachMap timeline validation ==="
echo "Country: $COUNTRY  Scenario: $SCENARIO"
echo ""

python3 -c "
import json, os, sys, hashlib

SNAP_BASE = '$SNAP_BASE'
with open('$INDEX_DIR/index.json') as f:
    idx = json.load(f)
points = idx.get('points', [])
errors = 0
warnings = 0
seen = {}

for p in points:
    sid = p['snapshotId']
    avail = p.get('available', True)
    
    if avail:
        pf = f'{SNAP_BASE}/{sid}/prefixes.json'
        if not os.path.exists(pf):
            print(f'ERROR [{sid}]: available=true but no prefixes.json')
            errors += 1
        pf2 = f'{SNAP_BASE}/{sid}/path-families.json'
        if not os.path.exists(pf2):
            print(f'WARN  [{sid}]: no per-snapshot path-families.json')
            warnings += 1
        if p.get('ribTimestampsMatch') is False:
            print(f'WARN  [{sid}]: ribTimestampsMatch=false')
            warnings += 1
    
    if avail and os.path.exists(f'{SNAP_BASE}/{sid}/prefixes.json'):
        with open(f'{SNAP_BASE}/{sid}/prefixes.json', 'rb') as f:
            h = hashlib.sha256(f.read()).hexdigest()[:12]
        if h in seen and not p.get('ribTimestampsMatch'):
            print(f'ERROR [{sid}]: same artifact hash as {seen[h]} ({h}) — appears copied, not genuine')
            errors += 1
        else:
            seen[h] = sid

print('')
if errors == 0 and warnings == 0:
    print(f'PASS: {len(points)} snapshots, no issues')
elif errors > 0:
    print(f'FAIL: {errors} error(s), {warnings} warning(s)')
    sys.exit(1)
else:
    print(f'WARN: {warnings} warning(s), no errors')
"