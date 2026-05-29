#!/bin/bash
# Idempotent download of July 2021 Cuba event timeline RIBs.
# Skips existing files with nonzero size. Reports missing collectors.
set -euo pipefail
cd "$(dirname "$0")/.."

BASE="data/snapshots/timeline/2021"
echo "=== ReachMap — July 2021 Cuba timeline downloads ==="

declare -A ROLES
ROLES["20210710.2000"]="before"
ROLES["20210711.0000"]="pre_event"
ROLES["20210711.2000"]="event"
ROLES["20210711.2200"]="after"
ROLES["20210712.0000"]="after"
ROLES["20210712.2000"]="recovered"

# rrc00 is unavailable at 20210711.2000
declare -A RRC00_MISSING
RRC00_MISSING["20210711.2000"]=1

COLLECTORS=("route-views2" "route-views4" "route-views.eqix" "route-views.linx" "rrc00")

for TS in 20210710.2000 20210711.0000 20210711.2000 20210711.2200 20210712.0000 20210712.2000; do
  YEAR_MONTH="${TS:0:4}.${TS:4:2}"
  ROLE="${ROLES[$TS]}"
  echo ""
  echo "--- $TS ($ROLE) ---"

  for CID in "${COLLECTORS[@]}"; do
    DIR="$BASE/$CID"
    mkdir -p "$DIR"

    if [ "$CID" = "rrc00" ]; then
      FNAME="bview.${TS}.gz"
      URL="https://data.ris.ripe.net/rrc00/${YEAR_MONTH}/${FNAME}"
    elif [ "$CID" = "route-views2" ]; then
      FNAME="rib.${TS}.bz2"
      URL="http://archive.routeviews.org/bgpdata/${YEAR_MONTH}/RIBS/${FNAME}"
    else
      FNAME="rib.${TS}.bz2"
      URL="http://archive.routeviews.org/${CID}/bgpdata/${YEAR_MONTH}/RIBS/${FNAME}"
    fi

    OUT="$DIR/$FNAME"

    # Skip if already downloaded with nonzero size
    if [ -f "$OUT" ] && [ -s "$OUT" ]; then
      SIZE=$(ls -lh "$OUT" | awk '{print $5}')
      echo "  $CID: cached ($SIZE)"
      continue
    fi

    # Check if known missing
    if [ "${RRC00_MISSING[$TS]:-0}" = "1" ] && [ "$CID" = "rrc00" ]; then
      echo "  $CID: KNOWN MISSING (rrc00 unavailable at this timestamp)"
      continue
    fi

    # Download
    HTTP_CODE=$(curl -sI "$URL" -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
      echo "  $CID: downloading..."
      curl -s -o "$OUT" "$URL"
      SIZE=$(ls -lh "$OUT" | awk '{print $5}')
      echo "  $CID: done ($SIZE)"
    else
      echo "  $CID: HTTP $HTTP_CODE — SKIPPED"
    fi
  done
done

echo ""
echo "=== Downloads complete ==="
echo "Summary:"
for CID in "${COLLECTORS[@]}"; do
  COUNT=$(find "$BASE/$CID" -type f -name "*.bz2" -o -name "*.gz" 2>/dev/null | wc -l)
  TOTAL=$(du -sh "$BASE/$CID" 2>/dev/null | awk '{print $1}')
  echo "  $CID: $COUNT files, $TOTAL"
done
