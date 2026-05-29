# ReachMap Data Pipeline

ReachMap uses a **cache-first** data pipeline. Remote BGP collectors are never contacted during normal site build or browser runtime. The deployed static demo uses precomputed artifacts.

## Architecture

```
remote collector RIBs (RouteViews / RIPE RIS)
        ↓ manual refresh command only
local raw cache (data/cache/bgp/snapshots/{ts}/)
        ↓ Rust pipeline (bgpkit-parser)
small graph-ready JSON artifacts (web/app/public/data/{country}/)
        ↓ committed or published with site
static ReachMap UI (React + deck.gl + MapLibre)
```

## Quick start

### View the demo (no data refresh needed)

```bash
cd web/app
npm install
npm run dev
```

The demo loads pre-generated artifacts from `web/app/public/data/CU/`.

### Refresh data for a specific timestamp

```bash
# Dry run — see what would happen
./scripts/refresh_data.sh --country CU --timestamp 2026-03-16T20:00Z --dry-run

# Fetch and process (requires Rust pipeline built)
./scripts/refresh_data.sh --country CU --timestamp 2026-03-16T20:00Z

# Force re-download of cached files
./scripts/refresh_data.sh --country CU --timestamp 2026-03-16T20:00Z --force

# Limit to 10 collectors
./scripts/refresh_data.sh --country CU --timestamp 2026-03-16T20:00Z --max-collectors 10

# Specific collector
./scripts/refresh_data.sh --country CU --timestamp 2026-03-16T20:00Z --collector route-views2

# Only RouteViews collectors
./scripts/refresh_data.sh --country CU --timestamp 2026-03-16T20:00Z --source routeviews

# Skip download — process already-cached files
./scripts/refresh_data.sh --country CU --timestamp 2026-03-16T20:00Z --no-download
```

### Build the Rust pipeline

```bash
cd src
cargo build --release
```

## Cache structure

```
data/cache/bgp/
  snapshots/
    2026-03-16T20-00Z/
      manifest.json            # Per-snapshot cache manifest
      route-views2.rib.bz2     # Raw RIB files (gitignored)
      route-views4.rib.bz2
      rrc00.bview.gz
      ...
```

### Manifest format

```json
{
  "timestamp": "2026-03-16T20:00:00Z",
  "country": "CU",
  "collectorsRequested": 32,
  "collectorsFetched": 27,
  "collectorsParsed": 25,
  "collectorsWithCountryPrefixes": 21,
  "createdAt": "2026-05-29T00:00:00Z",
  "sources": [
    {
      "collectorId": "route-views2",
      "status": "parsed_observed",
      "rawPath": "route-views2.rib.bz2",
      "parsedPath": "route-views2.parsed.json",
      "prefixesObserved": 68,
      "pathFamilies": 744,
      "error": null
    }
  ]
}
```

## Collector registry

The collector registry lives at `config/collectors.json`. Each entry has:

| Field | Description |
|-------|-------------|
| `id` | Collector identifier (e.g. `route-views2`) |
| `source` | `routeviews` or `ris` |
| `ribUrlTemplate` | URL pattern with `{YYYY}`, `{MM}`, `{DD}`, `{HH}` placeholders |
| `latitude`/`longitude` | Geographic location for map display |
| `enabled` | Whether this collector is active in the pipeline |

### Adding a collector

1. Add an entry to `config/collectors.json`
2. Add a geo override to `config/geolocation-overrides.json` (optional, for precise coordinates)
3. Run `./scripts/refresh_data.sh` to fetch and process

## What is committed vs ignored

| Path | Committed? | Reason |
|------|-----------|--------|
| `web/app/public/data/CU/*.json` | Yes | Small derived artifacts for static demo |
| `data/cache/bgp/**` | No | Raw RIB files are large binaries |
| `*.bz2`, `*.gz`, `*.mrt`, `*.mmdb` | No | Large binary files |
| `config/collectors.json` | Yes | Registry metadata |
| `config/geolocation-overrides.json` | Yes | Geo overrides |
| `scripts/refresh_data.sh` | Yes | Data refresh tool |

## Artifact types

The pipeline generates these artifacts consumed by the UI:

| Artifact | Description |
|----------|-------------|
| `prefixes.json` | Country prefix set with BGP observation status |
| `path-families.json` | Normalized AS paths with prefix counts |
| `vantages/` | Per-viewpoint (collector+peer) observation records |
| `asns/` | Per-ASN aggregates |
| `visibility/consensus-all.json` | Multi-collector visibility consensus |
| `collectors/` | Per-collector visibility summaries |

## Frontend data loading

The React app loads artifacts via `fetch()` from `/data/` at runtime. No live BGP queries. See `web/app/src/dataLoader.ts` for the loading logic.

## Limitations

- RIB snapshots are point-in-time samples, not continuous
- Collector availability varies by timestamp (not all collectors have RIBs at every hour)
- The pipeline requires local MRT files; it does not fetch from RouteViews/RIS at runtime
- RIPE RIS bview files use a different format/URL pattern than RouteViews RIBs
