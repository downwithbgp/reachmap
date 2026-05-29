# ReachMap v0 — Public Demo

**Released:** 2026-05-29

## What the demo shows

ReachMap is a layered Internet observability map. It compares BGP collector RIB
visibility with disruption signals like traffic volume to show what the routing
table sees — and what it misses.

**Primary case:** Cuba, March 2026 grid collapse.
- BGP collector RIB visibility: stable — 17/17 prefixes visible from 4/4 collectors
- External traffic signal (Cloudflare Radar): degraded — ~35% of baseline
- Interpretation: the disruption was below the global routing control plane

**Supporting cases:**
- Cuba May 2026 (healthy baseline, 5/5 consensus)
- Cuba July 2021 (archival, BGP green during protest disruption)
- Tonga January 2022 (partial BGP weather — 9→4 prefixes after cable cut)
- Kazakhstan January 2022 (partial BGP weather — 520→511 prefixes, -1.7%)

## Data sources

- BGP RIBs: RouteViews, RIPE RIS
- Prefix data: LACNIC, APNIC, RIPE NCC delegated stats
- External signals: Cloudflare Radar (case-study annotations)
- Collector locations: RouteViews/RIS documentation, manual overrides

## Data pipeline

Rust + bgpkit-parser → static JSON artifacts → React + deck.gl + D3 frontend.
Pipeline processes MRT RIB snapshots through bgpkit-parser, filters for country
prefixes, normalizes AS paths, and generates per-collector, consensus, and
path-family artifacts.

## Limitations

- BGP collector RIB visibility does not prove end-user reachability
- RIB snapshots are samples from specific times, not continuous monitoring
- Collector location is not the same as BGP peer physical location
- External traffic signals are case-study annotations, not live data
- Prefix-to-country mapping relies on RIR delegated stats
- Single-country demo (Cuba). Multi-country architecture in data model.

## Build & deploy

```bash
cd web/app
npm install
npm run build    # → dist/
npm run preview  # local test at :4173
```

Deploy `web/app/dist` to Cloudflare Pages or static host.

## Known next steps

- Add Cloudflare Radar / IODA live signal integration
- Add RIPE Atlas probe layer
- Add more countries (country-agnostic data model ready)
- Add timeline time-slider UI
- Add historical RIB snapshot timeline comparison

## Product line

> ReachMap shows what the routing table sees — and what it misses.
