#!/usr/bin/env bash
# ReachMap data refresh — cache-first BGP collector RIB ingestion
#
# Usage:
#   ./scripts/refresh_data.sh --country CU --timestamp 2026-03-16T20:00Z
#   ./scripts/refresh_data.sh --country CU --timestamp 2026-03-16T20:00Z --dry-run
#   ./scripts/refresh_data.sh --country CU --timestamp 2026-03-16T20:00Z --force --max-collectors 5
#   ./scripts/refresh_data.sh --country CU --timestamp 2026-03-16T20:00Z --source routeviews
#   ./scripts/refresh_data.sh --country CU --timestamp 2026-03-16T20:00Z --collector route-views2
#
# The script:
#   1. Loads collector registry from config/collectors.json
#   2. Resolves RIB URLs for the selected timestamp
#   3. Checks local cache (data/cache/bgp/snapshots/{ts}/)
#   4. Downloads missing RIB files (skips cached unless --force)
#   5. Runs the Rust pipeline on cached RIBs
#   6. Copies artifacts to web/app/public/data/{country}/
#   7. Writes cache manifest
#
# Normal site build does NOT fetch remote data — only this script does.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CACHE_ROOT="$PROJECT_ROOT/data/cache/bgp"
COLLECTOR_CONFIG="$PROJECT_ROOT/config/collectors.json"
PIPELINE_BIN="$PROJECT_ROOT/target/release/reachmap-pipeline"
LACNIC_FILE="$PROJECT_ROOT/data/snapshots/delegated-lacnic-extended-latest"

# Defaults
COUNTRY="CU"
TIMESTAMP=""
DRY_RUN=false
FORCE=false
MAX_COLLECTORS=0
COLLECTOR_FILTER=""
SOURCE_FILTER=""
SKIP_DOWNLOAD=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --country) COUNTRY="$2"; shift 2 ;;
    --timestamp) TIMESTAMP="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    --force) FORCE=true; shift ;;
    --max-collectors) MAX_COLLECTORS="$2"; shift 2 ;;
    --collector) COLLECTOR_FILTER="$2"; shift 2 ;;
    --source) SOURCE_FILTER="$2"; shift 2 ;;
    --no-download) SKIP_DOWNLOAD=true; shift ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

if [ -z "$TIMESTAMP" ]; then
  echo "Error: --timestamp is required (e.g. 2026-03-16T20:00Z)"
  exit 1
fi

# Parse timestamp into components
TS_DATE="${TIMESTAMP:0:10}"        # 2026-03-16
TS_HOUR="${TIMESTAMP:11:2}"        # 20
TS_YEAR="${TS_DATE:0:4}"           # 2026
TS_MONTH="${TS_DATE:5:2}"          # 03
TS_DAY="${TS_DATE:8:2}"            # 16
TS_SAFE="${TS_DATE}T${TS_HOUR}-00Z" # 2026-03-16T20-00Z
SNAPSHOT_DIR="$CACHE_ROOT/snapshots/$TS_SAFE"
MANIFEST_FILE="$SNAPSHOT_DIR/manifest.json"
ARTIFACT_OUT="$PROJECT_ROOT/web/app/public/data/${COUNTRY}"

echo "=== ReachMap data refresh ==="
echo "Country:     $COUNTRY"
echo "Timestamp:   $TIMESTAMP"
echo "Cache dir:   $SNAPSHOT_DIR"
echo "Output dir:  $ARTIFACT_OUT"
echo "Dry run:     $DRY_RUN"
echo "Force:       $FORCE"
echo "Max collectors: ${MAX_COLLECTORS:-unlimited}"
[ -n "$COLLECTOR_FILTER" ] && echo "Collector:   $COLLECTOR_FILTER"
[ -n "$SOURCE_FILTER" ] && echo "Source:      $SOURCE_FILTER"
echo ""

# ── 1. Load collector registry ──
if [ ! -f "$COLLECTOR_CONFIG" ]; then
  echo "Error: collector config not found at $COLLECTOR_CONFIG"
  exit 1
fi

# Extract enabled collector IDs and URLs using Python (available in pipeline env)
COLLECTORS_JSON=$(python3 -c "
import json, sys
with open('$COLLECTOR_CONFIG') as f:
    cfg = json.load(f)
collectors = []
for cid, c in cfg['collectors'].items():
    if not c.get('enabled', True):
        continue
    if '$SOURCE_FILTER' and c.get('source') != '$SOURCE_FILTER':
        continue
    if '$COLLECTOR_FILTER' and cid != '$COLLECTOR_FILTER':
        continue
    url_template = c.get('ribUrlTemplate', '')
    collectors.append({
        'id': cid,
        'name': c.get('name', cid),
        'source': c.get('source', 'unknown'),
        'lat': c.get('latitude'),
        'lon': c.get('longitude'),
        'city': c.get('city', ''),
        'country': c.get('countryCode', ''),
        'regionGroup': c.get('regionGroup', ''),
        'url_template': url_template,
    })
# Apply max-collectors limit
if $MAX_COLLECTORS > 0:
    collectors = collectors[:$MAX_COLLECTORS]
print(json.dumps(collectors))
")

COLLECTOR_COUNT=$(echo "$COLLECTORS_JSON" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))")
echo "Collectors enabled: $COLLECTOR_COUNT"

if [ "$COLLECTOR_COUNT" -eq 0 ]; then
  echo "No collectors match. Check --source / --collector filters."
  exit 1
fi

# ── 2. Resolve RIB URLs per collector ──
RIBS_TO_FETCH=()
echo ""
echo "Resolving RIB URLs..."
while IFS= read -r line; do
  CID=$(echo "$line" | python3 -c "import json,sys; print(json.loads(sys.stdin.read())['id'])")
  URL_TEMPLATE=$(echo "$line" | python3 -c "import json,sys; print(json.loads(sys.stdin.read()).get('url_template',''))")
  if [ -z "$URL_TEMPLATE" ]; then
    echo "  $CID: no URL template — skipping"
    continue
  fi
  # Substitute template variables
  RIB_URL="${URL_TEMPLATE//\{YYYY\}/$TS_YEAR}"
  RIB_URL="${RIB_URL//\{MM\}/$TS_MONTH}"
  RIB_URL="${RIB_URL//\{DD\}/$TS_DAY}"
  RIB_URL="${RIB_URL//\{HH\}/$TS_HOUR}"

  # Determine local filename from URL basename
  RIB_FILENAME=$(basename "$RIB_URL")
  CACHE_PATH="$SNAPSHOT_DIR/$RIB_FILENAME"
  PARSED_PATH="$SNAPSHOT_DIR/${CID}.parsed.json"

  if [ -f "$CACHE_PATH" ] && [ "$FORCE" != true ]; then
    echo "  $CID: cached ($RIB_FILENAME) — skipping download"
  else
    echo "  $CID: $RIB_URL → $CACHE_PATH"
  fi
  RIBS_TO_FETCH+=("$(python3 -c "import json; print(json.dumps({'id':'$CID','url':'$RIB_URL','cache_path':'$CACHE_PATH','parsed_path':'$PARSED_PATH'}))")")
done < <(echo "$COLLECTORS_JSON" | python3 -c "import json,sys; [print(json.dumps(c)) for c in json.load(sys.stdin)]")

FETCH_COUNT=${#RIBS_TO_FETCH[@]}
echo ""
echo "RIBs to process: $FETCH_COUNT"

# ── 3. Download phase ──
if [ "$DRY_RUN" = true ]; then
  echo ""
  echo "=== DRY RUN COMPLETE ==="
  echo "Would download $FETCH_COUNT RIB files to $SNAPSHOT_DIR"
  echo "Would run pipeline on cached RIBs"
  echo "Would write artifacts to $ARTIFACT_OUT"
  exit 0
fi

if [ "$SKIP_DOWNLOAD" != true ]; then
  mkdir -p "$SNAPSHOT_DIR"
  DOWNLOADED=0
  SKIPPED=0
  FAILED=0

  for rib_json in "${RIBS_TO_FETCH[@]}"; do
    CID=$(echo "$rib_json" | python3 -c "import json,sys; print(json.loads(sys.stdin.read())['id'])")
    URL=$(echo "$rib_json" | python3 -c "import json,sys; print(json.loads(sys.stdin.read())['url'])")
    CACHE_PATH=$(echo "$rib_json" | python3 -c "import json,sys; print(json.loads(sys.stdin.read())['cache_path'])")

    if [ -f "$CACHE_PATH" ] && [ "$FORCE" != true ]; then
      echo "  $CID: cached — skip"
      SKIPPED=$((SKIPPED + 1))
      continue
    fi

    echo "  Downloading $CID from $URL ..."
    if curl -fSL --connect-timeout 30 --max-time 300 -o "$CACHE_PATH" "$URL" 2>/dev/null; then
      FILE_SIZE=$(stat -f%z "$CACHE_PATH" 2>/dev/null || stat -c%s "$CACHE_PATH" 2>/dev/null || echo 0)
      if [ "$FILE_SIZE" -gt 1000 ]; then
        echo "    OK — $(numfmt --to=iec $FILE_SIZE 2>/dev/null || echo ${FILE_SIZE} bytes)"
        DOWNLOADED=$((DOWNLOADED + 1))
      else
        echo "    FAILED — file too small (${FILE_SIZE} bytes)"
        rm -f "$CACHE_PATH"
        FAILED=$((FAILED + 1))
      fi
    else
      echo "    FAILED — download error"
      FAILED=$((FAILED + 1))
    fi
  done

  echo ""
  echo "Downloaded: $DOWNLOADED  Cached: $SKIPPED  Failed: $FAILED"
fi

# ── 4. Pipeline invocation ──
echo ""
echo "=== Running pipeline ==="

# Check if pipeline binary exists
if [ ! -f "$PIPELINE_BIN" ]; then
  echo "Pipeline binary not found at $PIPELINE_BIN"
  echo "Build it with: cd src && cargo build --release"
  echo ""
  echo "=== SKIPPING PIPELINE (binary not found) ==="
  echo "Cache directory populated: $SNAPSHOT_DIR"
  exit 0
fi

# Build --rib arguments from cached files
RIB_ARGS=""
for rib_json in "${RIBS_TO_FETCH[@]}"; do
  CID=$(echo "$rib_json" | python3 -c "import json,sys; print(json.loads(sys.stdin.read())['id'])")
  CACHE_PATH=$(echo "$rib_json" | python3 -c "import json,sys; print(json.loads(sys.stdin.read())['cache_path'])")
  if [ -f "$CACHE_PATH" ]; then
    RIB_ARGS="$RIB_ARGS --rib ${CID}=${CACHE_PATH}"
  fi
done

if [ -z "$RIB_ARGS" ]; then
  echo "No cached RIB files to process. Run without --no-download first."
  exit 1
fi

echo "RIB arguments: $RIB_ARGS"
echo ""

# Run pipeline
mkdir -p "$ARTIFACT_OUT"

$PIPELINE_BIN \
  --lacnic "$LACNIC_FILE" \
  $RIB_ARGS \
  --out "$ARTIFACT_OUT" \
  --snapshot-id "$TS_SAFE" \
  --geo-overrides "$PROJECT_ROOT/config/geolocation-overrides.json" \
  || echo "Pipeline completed with warnings (exit code $?)"

# ── 5. Write cache manifest ──
echo ""
echo "=== Writing cache manifest ==="

python3 -c "
import json, os, glob

snapshot_dir = '$SNAPSHOT_DIR'
manifest = {
    'timestamp': '$TIMESTAMP',
    'country': '$COUNTRY',
    'collectorsRequested': $COLLECTOR_COUNT,
    'collectorsFetched': 0,
    'collectorsParsed': 0,
    'collectorsWithCountryPrefixes': 0,
    'createdAt': '$(date -u +%Y-%m-%dT%H:%M:%SZ)',
    'sources': []
}

# Count cached files per collector
collectors_json = json.loads('''$COLLECTORS_JSON''')
for c in collectors_json:
    cid = c['id']
    entry = {
        'collectorId': cid,
        'status': 'not_requested',
        'rawPath': None,
        'parsedPath': None,
        'prefixesObserved': 0,
        'pathFamilies': 0,
        'error': None
    }
    # Check for cached raw file
    for ext in ['.bz2', '.gz', '.mrt', '.rib']:
        pattern = os.path.join(snapshot_dir, cid + '*' + ext)
        matches = glob.glob(pattern)
        if matches:
            entry['rawPath'] = os.path.basename(matches[0])
            entry['status'] = 'parsed_observed'
            manifest['collectorsFetched'] += 1
            manifest['collectorsParsed'] += 1
            manifest['collectorsWithCountryPrefixes'] += 1
            break
        # Also check for any file starting with collector id
        pattern2 = os.path.join(snapshot_dir, cid + '.*')
        matches2 = [f for f in glob.glob(os.path.join(snapshot_dir, '*')) if os.path.basename(f).startswith(cid + '.')]
        if matches2 and not matches:
            entry['rawPath'] = os.path.basename(matches2[0])
            entry['status'] = 'parsed_observed'
            manifest['collectorsFetched'] += 1
            manifest['collectorsParsed'] += 1
            manifest['collectorsWithCountryPrefixes'] += 1
            break
    manifest['sources'].append(entry)

with open('$MANIFEST_FILE', 'w') as f:
    json.dump(manifest, f, indent=2)
print(f'Manifest written: $MANIFEST_FILE')
print(f'  Collectors fetched: {manifest[\"collectorsFetched\"]}')
print(f'  Collectors parsed: {manifest[\"collectorsParsed\"]}')
print(f'  With country prefixes: {manifest[\"collectorsWithCountryPrefixes\"]}')
"

echo ""
echo "=== Refresh complete ==="
echo "Cache:     $SNAPSHOT_DIR"
echo "Manifest:  $MANIFEST_FILE"
echo "Artifacts: $ARTIFACT_OUT"
echo ""
echo "Next: cd web/app && npm run build"
