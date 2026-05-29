#!/usr/bin/env bash
# ReachMap state validation — checks deployed artifact consistency
set -euo pipefail

echo "=== ReachMap state validation ==="

BASE="web/app/public/data/CU/timeline/mar2026"
INDEX="$BASE/index.json"

if [ ! -f "$INDEX" ]; then
  echo "FAIL: timeline index not found at $INDEX"
  exit 1
fi

python3 -c "
import json, os, sys

with open('$INDEX') as f:
    idx = json.load(f)

points = idx.get('points', [])
errors = 0

# 1. Timeline counts
complete = [p for p in points if p.get('comparability') == 'complete']
partial = [p for p in points if p.get('comparability') == 'partial']
unavail = [p for p in points if p.get('comparability') == 'unavailable' or p.get('available') == False]

print(f'Snapshots: {len(points)} total, {len(complete)} complete, {len(partial)} partial, {len(unavail)} unavailable')

if len(points) > 0 and len(complete) + len(partial) + len(unavail) == 0:
    print('ERROR: snapshot count > 0 but quality counts sum to zero — check comparability/available fields')
    errors += 1

# 2. Check each complete/partial has artifact
for p in complete + partial:
    sid = p['snapshotId']
    pfx = f'$BASE/../{sid}/prefixes.json'
    if not os.path.exists(pfx):
        print(f'ERROR: {sid} ({p.get(\"comparability\")}) has no prefixes.json')
        errors += 1

# 3. Check unavailable has NO artifact (should not render graph)
for p in unavail:
    sid = p['snapshotId']
    pfx = f'$BASE/../{sid}/prefixes.json'
    if os.path.exists(pfx) and p.get('collectorCount', 0) > 0:
        print(f'WARN: {sid} marked unavailable but has artifact with {p.get(\"collectorCount\")} collectors')

# 4. Complete must have parsedCollectors == targetCollectors
for p in complete:
    if p.get('parsedCollectors', 0) != p.get('targetCollectors', 0):
        print(f'ERROR: {p[\"snapshotId\"]} complete but parsed ({p.get(\"parsedCollectors\")}) != target ({p.get(\"targetCollectors\")})')
        errors += 1

# 5. Partial must have missingCollectors
for p in partial:
    if not p.get('missingCollectors'):
        print(f'WARN: {p[\"snapshotId\"]} partial but no missingCollectors listed')

print('')
if errors == 0:
    print('PASS')
else:
    print(f'FAIL: {errors} error(s)')
    sys.exit(1)
"