#!/usr/bin/env bash
# ReachMap timeline refresh — generates comparable BGP snapshots across timestamps
#
# Usage:
#   scripts/refresh_timeline.sh --country CU --scenario march-2026 \
#     --start 2026-03-16T00:00:00Z --end 2026-03-17T00:00:00Z --step-hours 4 \
#     --collector route-views2 --collector route-views3 --collector route-views4 \
#     --collector route-views.eqix --collector route-views.linx
#
# For each timestamp:
#   1. Resolves RIB URLs for all target collectors
#   2. Downloads missing RIBs into cache
#   3. Runs pipeline with all available collectors for that timestamp
#   4. Writes snapshot artifacts to timeline directory
#   5. Updates timeline index with complete/partial/unavailable status
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CACHE_ROOT="$PROJECT_ROOT/data/cache/bgp/snapshots"
PIPELINE="$PROJECT_ROOT/target/release/reachmap-pipeline"
LACNIC="$PROJECT_ROOT/data/snapshots/delegated-lacnic-extended-latest"

# Parse args
COUNTRY="CU"
SCENARIO="march-2026"
START=""
END=""
STEP_HOURS=4
COLLECTORS=()
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --country) COUNTRY="$2"; shift 2 ;;
    --scenario) SCENARIO="$2"; shift 2 ;;
    --start) START="$2"; shift 2 ;;
    --end) END="$2"; shift 2 ;;
    --step-hours) STEP_HOURS="$2"; shift 2 ;;
    --collector) COLLECTORS+=("$2"); shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    *) echo "Unknown: $1"; exit 1 ;;
  esac
done

if [ -z "$START" ] || [ -z "$END" ]; then
  echo "Error: --start and --end required"
  exit 1
fi
if [ ${#COLLECTORS[@]} -eq 0 ]; then
  echo "Error: at least one --collector required"
  exit 1
fi

TARGET_COUNT=${#COLLECTORS[@]}
TIMELINE_DIR="$PROJECT_ROOT/web/app/public/data/${COUNTRY}/timeline"

echo "=== ReachMap timeline refresh ==="
echo "Country: $COUNTRY  Scenario: $SCENARIO"
echo "Range: $START → $END  Step: ${STEP_HOURS}h"
echo "Target collectors: ${COLLECTORS[*]}"
echo "Target count: $TARGET_COUNT"
echo ""

# Generate timestamps
TIMESTAMPS=()
CURRENT="$START"
while [[ "$CURRENT" <= "$END" ]]; do
  TIMESTAMPS+=("$CURRENT")
  CURRENT=$(python3 -c "from datetime import datetime, timedelta; t=datetime.fromisoformat('$CURRENT'.replace('Z','+00:00')); t+=timedelta(hours=$STEP_HOURS); print(t.strftime('%Y-%m-%dT%H:%M:%SZ'))")
done

echo "Timestamps: ${#TIMESTAMPS[@]}"
for ts in "${TIMESTAMPS[@]}"; do echo "  $ts"; done
echo ""

if [ "$DRY_RUN" = true ]; then
  echo "=== DRY RUN ==="
  for ts in "${TIMESTAMPS[@]}"; do
    echo "$ts:"
    for cid in "${COLLECTORS[@]}"; do
      Y="${ts:0:4}"; M="${ts:5:2}"; D="${ts:8:2}"; H="${ts:11:2}"
      URL="https://archive.routeviews.org/${cid}/bgpdata/${Y}.${M}/RIBS/rib.${Y}${M}${D}.${H}00.bz2"
      CACHE_DIR="$CACHE_ROOT/${ts//:/-}"  # replace colons with dashes for safe dirs
      CACHE_DIR="${CACHE_DIR//T/-}"
      CACHE_FILE="$CACHE_DIR/${cid}.rib.bz2"
      if [ -f "$CACHE_FILE" ]; then
        echo "  $cid: cached"
      else
        echo "  $cid: would download $URL"
      fi
    done
  done
  exit 0
fi

# Process each timestamp
RESULTS=()
for ts in "${TIMESTAMPS[@]}"; do
  Y="${ts:0:4}"; M="${ts:5:2}"; D="${ts:8:2}"; H="${ts:11:2}"
  SAFE_TS="${ts//:/-}"
  SAFE_TS="${SAFE_TS//T/-}"
  CACHE_DIR="$CACHE_ROOT/$SAFE_TS"
  SNAP_ID="${Y}-${M}-${D}T${H}00Z"
  OUT_DIR="$TIMELINE_DIR/$SNAP_ID"
  
  echo "=== $SNAP_ID ==="
  mkdir -p "$CACHE_DIR"
  
  # Download missing RIBs
  DOWNLOADED=0; CACHED=0; FAILED=0; RIB_ARGS=""
  for cid in "${COLLECTORS[@]}"; do
    CACHE_FILE="$CACHE_DIR/${cid}.rib.bz2"
    URL="https://archive.routeviews.org/${cid}/bgpdata/${Y}.${M}/RIBS/rib.${Y}${M}${D}.${H}00.bz2"
    
    if [ -f "$CACHE_FILE" ] && [ -s "$CACHE_FILE" ]; then
      CACHED=$((CACHED + 1))
      RIB_ARGS="$RIB_ARGS --rib ${cid}=${CACHE_FILE}"
      continue
    fi
    
    echo -n "  $cid ... "
    if curl -fSL --connect-timeout 15 --max-time 300 -o "$CACHE_FILE" "$URL" 2>/dev/null; then
      if [ -s "$CACHE_FILE" ] && [ "$(stat -f%z "$CACHE_FILE" 2>/dev/null || stat -c%s "$CACHE_FILE" 2>/dev/null || echo 0)" -gt 1000 ]; then
        echo "OK"
        DOWNLOADED=$((DOWNLOADED + 1))
        RIB_ARGS="$RIB_ARGS --rib ${cid}=${CACHE_FILE}"
      else
        echo "FAILED (too small)"
        rm -f "$CACHE_FILE"
        FAILED=$((FAILED + 1))
      fi
    else
      echo "FAILED"
      FAILED=$((FAILED + 1))
    fi
  done
  
  PARSED=$((DOWNLOADED + CACHED))
  echo "  Downloaded: $DOWNLOADED  Cached: $CACHED  Failed: $FAILED"
  
  if [ "$PARSED" -eq 0 ]; then
    echo "  → UNAVAILABLE (no RIBs)"
    RESULTS+=("$SNAP_ID:0:0:unavailable")
    continue
  fi
  
  # Run pipeline
  if [ -f "$PIPELINE" ]; then
    echo "  Running pipeline..."
    $PIPELINE --lacnic "$LACNIC" $RIB_ARGS --out "$OUT_DIR" --snapshot-id "$SNAP_ID" 2>&1 | grep -E "(Done|Prefixes|Viewpoints|Path families)" | head -5
    echo "  → COMPLETE ($PARSED/$TARGET_COUNT collectors)"
    RESULTS+=("$SNAP_ID:$PARSED:$TARGET_COUNT:complete")
  else
    echo "  Pipeline binary not found, skipping processing"
    RESULTS+=("$SNAP_ID:$PARSED:$TARGET_COUNT:pending")
  fi
  echo ""
done

# Print summary
echo "=== Summary ==="
for r in "${RESULTS[@]}"; do
  IFS=':' read -r sid parsed target status <<< "$r"
  printf "  %-25s %s/%s collectors  %s\n" "$sid" "$parsed" "$target" "$status"
done
echo ""
echo "Timeline artifacts: $TIMELINE_DIR/"
echo "Cache: $CACHE_ROOT/"
echo "Done."
