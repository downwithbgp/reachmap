#!/bin/bash
# ReachMap Cuba pipeline — one-shot data refresh
# Usage: ./scripts/process_cuba.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== ReachMap Cuba pipeline ==="

# Ensure data directories exist
mkdir -p data/snapshots data/processed/countries/CU

# Download LACNIC delegated stats if not already present or older than 1 day
LACNIC_FILE="data/snapshots/delegated-lacnic-extended-latest"
if [ ! -f "$LACNIC_FILE" ] || [ "$(find "$LACNIC_FILE" -mtime +1)" ]; then
  echo "Downloading LACNIC delegated stats..."
  curl -s -o "$LACNIC_FILE" "https://ftp.lacnic.net/pub/stats/lacnic/delegated-lacnic-extended-latest"
fi

# Find latest available RouteViews RIB
echo "Checking for recent RouteViews RIB..."
YEAR_MONTH=$(date -u +%Y.%m)
for try_day in $(date -u +%d) $(date -u -d '1 day ago' +%d) $(date -u -d '2 days ago' +%d); do
  for try_hour in 00 02 04 06 08 10 12 14 16 18 20 22; do
    RIB_NAME="rib.$(date -u +%Y)${try_month}${try_day}.${try_hour}00.bz2"
    if [ -f "data/snapshots/$RIB_NAME" ]; then
      echo "  Using cached: $RIB_NAME"
      RIB_FILE="data/snapshots/$RIB_NAME"
      break 2
    fi
  done
done

# If no cached RIB, try downloading from a few recent timestamps
if [ -z "${RIB_FILE:-}" ]; then
  TODAY=$(date -u +%Y%m%d 2>/dev/null || date +%Y%m%d)
  for ts in "${TODAY}.0000" "${TODAY}.0200" "${TODAY}.0400"; do
    RIB_URL="http://archive.routeviews.org/bgpdata/${YEAR_MONTH}/RIBS/rib.${ts}.bz2"
    RIB_NAME="rib.${ts}.bz2"
    if curl -sI "$RIB_URL" | grep -q "200 OK"; then
      echo "Downloading $RIB_URL..."
      curl -s -o "data/snapshots/$RIB_NAME" "$RIB_URL"
      RIB_FILE="data/snapshots/$RIB_NAME"
      break
    fi
  done
fi

if [ -z "${RIB_FILE:-}" ]; then
  echo "ERROR: No RIB snapshot found. Download one manually."
  exit 1
fi

# Run the Rust pipeline
echo "Running pipeline..."
cargo run --release -- \
  --lacnic "$LACNIC_FILE" \
  --rib "$RIB_FILE" \
  --out data/processed/countries/CU

# Copy to integrated app
echo "Copying artifacts to integrated app..."
mkdir -p web/prototypes/integrated/public/data/CU/vantages
mkdir -p web/prototypes/integrated/public/data/CU/asns
cp data/processed/countries/CU/prefixes.json web/prototypes/integrated/public/data/CU/
cp data/processed/countries/CU/path-families.json web/prototypes/integrated/public/data/CU/
cp data/processed/countries/CU/vantages/index.json web/prototypes/integrated/public/data/CU/vantages/
cp data/processed/countries/CU/vantages/vp-*.json web/prototypes/integrated/public/data/CU/vantages/
cp data/processed/countries/CU/asns/index.json web/prototypes/integrated/public/data/CU/asns/
cp data/processed/countries/CU/asns/AS*.json web/prototypes/integrated/public/data/CU/asns/

echo "Done. Data available at web/prototypes/integrated/public/data/CU/"
