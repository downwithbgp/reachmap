# ReachMap — Viewpoint Geolocation & Provenance

## Summary

Every viewpoint shown on the ReachMap geographic map must carry explicit provenance. We never show a point without documenting how we placed it there. This document defines the geolocation strategy, data sources, confidence model, and manual override system.

## GeoResolution model

Each viewpoint contains a `geo` field with:

| Field | Type | Description |
|-------|------|-------------|
| `kind` | enum | `collector_location`, `peer_ip_geo`, `ixp_facility`, `manual`, `asn_headquarters`, `unknown` |
| `source` | string | e.g. `maxmind-geolite2-city`, `routeviews-metadata`, `manual-override` |
| `sourceVersion` | string? | e.g. date string `2026-05-27` |
| `sourceUrl` | string? | Where the database was obtained |
| `latitude` | number? | WGS84 |
| `longitude` | number? | WGS84 |
| `city` | string? | City name |
| `region` | string? | State/province |
| `countryCode` | string? | ISO 3166-1 alpha-2 |
| `continent` | string? | Continent name |
| `confidence` | 0..1 | 0.95 = collector metadata, 0.6 = GeoIP city, 0.3 = country-only, 0.0 = unknown |
| `precision` | enum | `exact`, `city`, `region`, `country`, `unknown` |
| `note` | string? | Human-readable note, especially for manual overrides |

## Geolocation sources (priority order)

### 1. Collector location (`collector_location`, confidence 0.90–0.95)

Where the RouteViews or RIPE RIS collector is physically located. This is the highest-confidence geography.

Known collector locations (from RouteViews documentation):
- `route-views2`: University of Oregon, Eugene, OR, US (44.05, -123.09)
- `route-views4`: Equinix SV1, San Jose, CA, US (37.34, -121.89)
- `route-views6`: Equinix, Atlanta, GA, US (33.64, -84.44)
- RIPE RIS collectors: documented at https://www.ripe.net/analyse/internet-measurements/routing-information-service-ris/ris-peering-policy

### 2. Peer IP geolocation (`peer_ip_geo`, confidence 0.55–0.70)

Using MaxMind GeoLite2 City (free, CC BY-SA 4.0) or DB-IP Lite (free, CC BY 4.0).

**Important caveats:**
- GeoIP maps IPs to the registered organization's address, not the BGP session endpoint.
- A peer IP in a RouteViews BGP session may geolocate to an ISP headquarters rather than the actual router location.
- City-level accuracy is ~85% for IPv4 in North America/Europe; lower elsewhere.
- Coordinates are city centroids, not exact locations.

### 3. IXP/facility location (`ixp_facility`, confidence 0.80–0.90)

When the collector/peer relationship is known to be at a specific Internet exchange point or colocation facility. Source: PeeringDB, collector metadata.

### 4. Manual curated override (`manual`, confidence 0.70–0.90)

Explicitly maintained overrides for known demo viewpoints. Stored in `config/geolocation-overrides.json`.

Every manual override must include a `note` field explaining the source.

### 5. ASN headquarters/country (`asn_headquarters`, confidence 0.20–0.40)

**Low-confidence fallback only.** An ASN's registered headquarters does not indicate where its BGP sessions terminate. RouteViews peers may be at IXPs far from the headquarters. This source is included for completeness but should never be presented as an observation location without clear caveats.

### 6. Unknown (`unknown`, confidence 0.0)

No credible location. The viewpoint is included in data but plotted in an "unknown" bucket, not randomly placed on the map.

## GeoIP database: MaxMind GeoLite2 City

**Primary source for MVP.**

- **Format:** MMDB (binary, memory-mapped)
- **Download:** Requires free MaxMind account at https://www.maxmind.com/en/geolite2/signup
- **Rust library:** `maxminddb` v0.28.x (crates.io)
- **License:** CC BY-SA 4.0 (attribution + share-alike)
- **Update frequency:** Twice weekly (Tue/Fri)
- **City-level accuracy:** ~85% for IPv4 in well-covered regions; lower in Global South
- **Coordinates:** City centroid, not exact location

### Fallback: DB-IP Lite

- **Format:** MMDB or CSV
- **Download:** `https://download.db-ip.com/free/dbip-city-lite-{YYYY-MM}.mmdb.gz`
- **License:** CC BY 4.0 (attribution only, no share-alike)
- **Update frequency:** Monthly
- **Accuracy:** Comparable to GeoLite2, slightly sparser outside Europe/North America

### How to obtain the database

```bash
# MaxMind GeoLite2 City (requires free account)
# 1. Sign up at https://www.maxmind.com/en/geolite2/signup
# 2. Generate a license key
# 3. Download:
curl -o data/geo/GeoLite2-City.mmdb \
  "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=YOUR_KEY&suffix=tar.gz"

# Or use a community mirror:
# jsDelivr CDN (check terms first):
# curl -o data/geo/GeoLite2-City.mmdb "https://...jsdelivr.../GeoLite2-City.mmdb"
```

## Pipeline usage

```bash
# With GeoIP database:
cargo run --release -- \
  --lacnic data/snapshots/delegated-lacnic-extended-latest \
  --rib data/snapshots/rib.YYYYMMDD.HHMM.bz2 \
  --geoip data/geo/GeoLite2-City.mmdb \
  --geo-overrides config/geolocation-overrides.json \
  --out data/processed/countries/CU

# Without GeoIP (pipeline still works, all geo = unknown):
cargo run --release -- \
  --lacnic data/snapshots/delegated-lacnic-extended-latest \
  --rib data/snapshots/rib.YYYYMMDD.HHMM.bz2 \
  --out data/processed/countries/CU
```

## Manual overrides format

`config/geolocation-overrides.json`:

```json
{
  "collector:route-views2": {
    "kind": "collector_location",
    "latitude": 44.05,
    "longitude": -123.09,
    "city": "Eugene",
    "region": "Oregon",
    "countryCode": "US",
    "confidence": 0.95,
    "note": "RouteViews documentation — University of Oregon"
  },
  "peer:7018": {
    "kind": "manual",
    "latitude": 32.78,
    "longitude": -96.80,
    "city": "Dallas",
    "region": "Texas",
    "countryCode": "US",
    "confidence": 0.5,
    "note": "AT&T headquarters. LOW CONFIDENCE — not actual BGP observation point."
  }
}
```

Override keys follow the format `type:identifier`:
- `collector:route-views2` — collector name
- `peer:7018` — peer ASN (low confidence override)
- `peerIp:203.0.113.1` — specific peer IP

## UI representation

| Confidence | Visual encoding |
|------------|----------------|
| ≥0.80 | Solid point, normal radius |
| 0.50–0.79 | Solid point, slightly smaller |
| 0.20–0.49 | Hollow/dashed point, "low confidence" tooltip note |
| <0.20 / unknown | Not plotted on map; listed in side panel as "unplaced" |

Tooltip shows: `Geo: peer IP GeoIP, city-level, 65% confidence`
Side panel shows: `Geo source: maxmind-geolite2-city (2026-05-27) · City: Miami, US · Confidence: medium`

## Important disclaimers

1. **AS paths are logical BGP routing policy, not physical fiber paths.**
2. **Peer IP geolocation maps to registered organization addresses, not BGP router locations.**
3. **ASN headquarters is a weak fallback — an ASN's registered address does not indicate where it peers.**
4. **All coordinates are approximate. City names are best-effort from GeoIP databases.**
5. **A viewpoint on the map represents one BGP observation point, not the entire ASN's routing table.**

## Reproducibility

To reproduce the geolocation enrichment:
1. Obtain a GeoLite2 City database (see above)
2. Place it at `data/geo/GeoLite2-City.mmdb`
3. Add manual overrides to `config/geolocation-overrides.json`
4. Run the pipeline with `--geoip` and `--geo-overrides` flags
5. The `sourceVersion` in each viewpoint artifact will record the database date
