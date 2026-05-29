# ReachMap — Multi-Collector Snapshot Set

## Target timestamp

**2026-05-28 00:00 UTC**

## Collector set

| Collector ID | Source | Location | Archive URL | Format | Size | Consensus |
|---|---|---|---|---|---|---|
| route-views2 | routeviews | Eugene, OR (US West) | `http://archive.routeviews.org/bgpdata/2026.05/RIBS/rib.20260528.0000.bz2` | .bz2 MRT | 72 MB | Yes |
| route-views4 | routeviews | San Jose, CA (US West) | `http://archive.routeviews.org/route-views4/bgpdata/2026.05/RIBS/rib.20260528.0000.bz2` | .bz2 MRT | 99 MB | Yes |
| route-views.eqix | routeviews | Ashburn, VA (US East) | `http://archive.routeviews.org/route-views.eqix/bgpdata/2026.05/RIBS/rib.20260528.0000.bz2` | .bz2 MRT | 113 MB | Yes |
| route-views.linx | routeviews | London, UK (Europe) | `http://archive.routeviews.org/route-views.linx/bgpdata/2026.05/RIBS/rib.20260528.0000.bz2` | .bz2 MRT | 194 MB | Yes |
| rrc00 | ris | Amsterdam, NL (Europe) | `https://data.ris.ripe.net/rrc00/2026.05/bview.20260528.0000.gz` | .gz MRT | 405 MB | Yes |

**Total download:** ~883 MB

## Archive path patterns

### RouteViews

```
http://archive.routeviews.org/{collector}/bgpdata/YYYY.MM/RIBS/rib.YYYYMMDD.HHMM.bz2
```

Exception: route-views2 uses the root path `http://archive.routeviews.org/bgpdata/` (no collector subdirectory).

### RIPE RIS

```
https://data.ris.ripe.net/{rrc}/YYYY.MM/bview.YYYYMMDD.HHMM.gz
```

RIPE RIS uses `.gz` compression (not `.bz2`) and the `bview.` prefix (not `rib.`). bgpkit-parser handles both transparently.

## What consensus measures

For each Cuban LACNIC allocation prefix:

```
visibilityRatio = observedCollectors / totalCollectors
```

A collector "observes" a prefix if **at least one peer observation from that collector's RIB** sees a BGP prefix whose IP range overlaps with the LACNIC allocation.

This means: **BGP-visible in that collector's RIB at this snapshot time.**

It does NOT mean:
- Packet forwarding is proven
- End-to-end reachability exists
- The collector itself can reach the prefix (only that a peer announced a route)

## Collector characteristics

| Collector | Peers | Notes |
|---|---|---|
| route-views2 | ~40 peers | Primary Oregon collector, broad peer set |
| route-views4 | ~30 peers | San Jose, CA |
| route-views.eqix | ~30 peers | Ashburn, VA — major East Coast IX |
| route-views.linx | ~60 peers | London Internet Exchange — strong European view |
| rrc00 | ~100 peers | Amsterdam — largest RIPE RIS collector, multi-hop peers |

## Pipeline usage

```bash
cargo run --release -- \
  --lacnic data/snapshots/delegated-lacnic-extended-latest \
  --rib route-views2=data/snapshots/route-views2/rib.20260528.0000.bz2 \
  --rib route-views4=data/snapshots/route-views4/rib.20260528.0000.bz2 \
  --rib route-views.eqix=data/snapshots/route-views.eqix/rib.20260528.0000.bz2 \
  --rib route-views.linx=data/snapshots/route-views.linx/rib.20260528.0000.bz2 \
  --rib rrc00=data/snapshots/rrc00/bview.20260528.0000.gz \
  --geo-overrides config/geolocation-overrides.json \
  --out data/processed/countries/CU
```

## Notes

- All 5 snapshots confirmed available at time of writing (HTTP 200).
- Timestamps are within the same 2-hour RIB window.
- rrc00 is significantly larger (405 MB) — parsing may take longer.
- bgpkit-parser handles both .bz2 and .gz transparently via the same API.
- Each collector's peer observations are tagged with collectorId for provenance.
