#!/bin/bash
# Process July 2021 Cuba timeline — runs multi-collector pipeline for each timestamp.
set -euo pipefail
cd "$(dirname "$0")/.."

LACNIC="data/snapshots/delegated-lacnic-extended-latest"
BASE_RIB="data/snapshots/timeline/2021"
OUT_BASE="data/processed/countries/CU/timeline"

echo "=== ReachMap — July 2021 Cuba timeline processing ==="
echo ""

declare -A ROLES
ROLES["20210710.2000"]="before"
ROLES["20210711.0000"]="pre_event"
ROLES["20210711.2000"]="event"
ROLES["20210711.2200"]="after"
ROLES["20210712.0000"]="after"
ROLES["20210712.2000"]="recovered"

# Event context
EVENT_TITLE="Reported Cuba Internet interruption"
EVENT_NOTE="Internet Society Pulse records an interruption from 20:00–21:00 UTC on July 11, 2021, during Havana protests. BGP visibility shown here is from sampled collector RIBs only — not proven data-plane reachability."
EVENT_SOURCE="Internet Society Pulse / NetBlocks / Kentik"

TS_LIST=(
  "20210710.2000"
  "20210711.0000"
  "20210711.2000"
  "20210711.2200"
  "20210712.0000"
  "20210712.2000"
)

# Process each timestamp
for TS in "${TS_LIST[@]}"; do
  SNAPSHOT_ID="${TS:0:4}-${TS:4:2}-${TS:6:2}T${TS:9:2}00Z"
  ROLE="${ROLES[$TS]}"
  OUT_DIR="$OUT_BASE/$SNAPSHOT_ID"

  echo "=== $SNAPSHOT_ID ($ROLE) ==="

  # Build RIB arguments from available files
  RIB_ARGS=""
  for CID in route-views2 route-views4 route-views.eqix route-views.linx rrc00; do
    if [ "$CID" = "rrc00" ]; then
      FNAME="bview.${TS}.gz"
    else
      FNAME="rib.${TS}.bz2"
    fi
    FPATH="$BASE_RIB/$CID/$FNAME"
    if [ -f "$FPATH" ] && [ -s "$FPATH" ]; then
      RIB_ARGS="$RIB_ARGS --rib $CID=$FPATH"
    else
      echo "  SKIP $CID: file missing or empty"
    fi
  done

  if [ -z "$RIB_ARGS" ]; then
    echo "  ERROR: No RIB files available for $SNAPSHOT_ID"
    continue
  fi

  # Run pipeline
  cargo run --release -- \
    --lacnic "$LACNIC" \
    $RIB_ARGS \
    --snapshot-id "$SNAPSHOT_ID" \
    --geo-overrides config/geolocation-overrides.json \
    --out "$OUT_DIR" 2>&1 | grep -E "Collectors|Prefixes|Peer obs|Path families|Done|Error"

  echo "  Output: $OUT_DIR"
  echo ""
done

echo "=== Generating timeline index ==="

# Build timeline/index.json from per-snapshot outputs
python3 - "$OUT_BASE" "${TS_LIST[@]}" "${ROLES[@]}" "$EVENT_TITLE" "$EVENT_NOTE" "$EVENT_SOURCE" << 'PYEOF'
import json, os, sys

out_base = sys.argv[1]
ts_list = sys.argv[2:8]
roles_list = sys.argv[8:14]
event_title = sys.argv[14]
event_note = sys.argv[15]
event_source = sys.argv[16]

roles = dict(zip(ts_list, roles_list))
timeline_points = []

for ts in ts_list:
    snapshot_id = f"{ts[:4]}-{ts[4:6]}-{ts[6:8]}T{ts[9:11]}00Z"
    snap_dir = os.path.join(out_base, snapshot_id)

    # Read metadata
    meta_path = os.path.join(snap_dir, "snapshots", snapshot_id, "metadata.json")
    if not os.path.exists(meta_path):
        # Try any subdirectory under snapshots/
        alt = os.path.join(snap_dir, "snapshots")
        if os.path.isdir(alt):
            subs = sorted(os.listdir(alt))
            if subs:
                meta_path = os.path.join(alt, subs[0], "metadata.json")

    # Read consensus
    cons_path = os.path.join(snap_dir, "visibility", "consensus-all.json")
    consensus = None
    if os.path.exists(cons_path):
        with open(cons_path) as f:
            consensus = json.load(f)

    # Count visibility categories
    total_pfx = 0
    observed = 0
    all_visible = 0
    partial = 0
    not_obs = 0
    collector_count = 0
    collector_ids = []
    pf_count = 0

    if consensus:
        collector_count = consensus.get("totalCollectors", 0)
        collector_ids = consensus.get("collectorIds", [])
        vbp = consensus.get("visibilityByPrefix", {})
        total_pfx = len(vbp)
        for score in vbp.values():
            if score["observedCollectors"] > 0:
                observed += 1
            if score["observedCollectors"] == score["totalCollectors"]:
                all_visible += 1
            elif score["observedCollectors"] > 0:
                partial += 1
            else:
                not_obs += 1

    # Read path families count
    pf_path = os.path.join(snap_dir, "path-families.json")
    if os.path.exists(pf_path):
        with open(pf_path) as f:
            pf_data = json.load(f)
            pf_count = len(pf_data) if isinstance(pf_data, list) else 0

    role = roles.get(ts, "unknown")

    point = {
        "snapshotId": snapshot_id,
        "timestamp": snapshot_id.replace("T", " ").replace("Z", " UTC"),
        "role": role,
        "collectorCount": collector_count,
        "collectorIds": collector_ids,
        "totalPrefixCount": total_pfx,
        "observedPrefixCount": observed,
        "allCollectorVisibleCount": all_visible,
        "partialVisibleCount": partial,
        "notObservedCount": not_obs,
        "pathFamilyCount": pf_count,
    }

    # Add event annotation for the event timestamp
    if role == "event":
        point["notes"] = [
            event_note,
            f"Source: {event_source}",
            "Hypothesis: BGP visibility may drop during this window. Actual result pending RIB parsing.",
        ]
        point["externalEventContext"] = {
            "title": event_title,
            "source": event_source,
            "note": event_note,
        }

    timeline_points.append(point)

index = {
    "countryCode": "CU",
    "eventWindow": "July 11-12, 2021 Cuba Internet interruption",
    "generatedTs": "2026-05-28T20:00:00Z",
    "points": timeline_points,
}

os.makedirs(os.path.join(out_base, ".."), exist_ok=True)
index_path = os.path.join(out_base, "index.json")
with open(index_path, "w") as f:
    json.dump(index, f, indent=2)

print(f"  Wrote timeline/index.json with {len(timeline_points)} points")
for p in timeline_points:
    bar = ""
    if p["totalPrefixCount"] > 0:
        green = p["allCollectorVisibleCount"]
        yellow = p["partialVisibleCount"]
        red = p["notObservedCount"]
        bar = f"  green={green} yellow={yellow} red={red}"
    print(f"  {p['snapshotId']} ({p['role']:12s}) {p['collectorCount']} collectors, {p['observedPrefixCount']}/{p['totalPrefixCount']} observed{bar}")
PYEOF

echo ""
echo "=== Timeline processing complete ==="
echo "Output: $OUT_BASE/"
echo "Usage: Copy timeline data to integrated app with:"
echo "  cp -r $OUT_BASE web/prototypes/integrated/public/data/CU/timeline/"
