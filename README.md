# ReachMap

**What the routing table sees — and what it misses.**

ReachMap is a layered Internet observability map. It visualizes how a country's
address space appears from global BGP collector RIBs, then compares that
control-plane view against disruption signals like traffic volume, probes, and
censorship measurements.

## What it is

- A BGP control-plane visibility tool: are routes to a country's prefixes present in sampled RouteViews and RIPE RIS collector RIBs?
- A multi-vantage consensus view: how many collectors see each prefix?
- A layered comparison: BGP visibility vs. external traffic/disruption signals

## What it is not

- A data-plane reachability tool (does not prove packets can be forwarded)
- A real-time monitor (uses static RIB snapshots, not BMP/live streaming)
- A physical network map (AS paths are logical, not fiber routes)

## Primary demo: Cuba March 2026 grid collapse

When Cuba's national power grid collapsed on March 16, 2026, Internet traffic
dropped sharply (Cloudflare Radar: ~65% decline). ReachMap checked the BGP layer.

**The BGP layer stayed green.** All 17 BGP-observed Cuban prefixes remained
visible from all 4 sampled collector RIBs before, during, and after the event.

This is not a failure — it is the product's core insight:

> The disruption was below the global routing control plane: power, access
> networks, mobile service, or data-plane availability. BGP collector RIB
> visibility does not prove end-user reachability.

## Case studies

| Case | Type | Result |
|------|------|--------|
| Cuba March 2026 | `bgp_stayed_green_user_disrupted` | BGP green, traffic collapsed |
| Cuba May 2026 | `healthy_baseline` | 5/5 consensus |
| Cuba July 2021 | `bgp_stayed_green_user_disrupted` | BGP green during protest disruption |
| Tonga Jan 2022 | `partial_bgp_weather` | 9→4 prefixes after cable cut |
| Kazakhstan Jan 2022 | `partial_bgp_weather` | 520→511 prefixes (-1.7%) |

A clear pattern emerges: **modern Internet disruptions rarely involve
widespread BGP route withdrawal.** Countries have shifted to forwarding-plane
null-routing, DPI, and access-network shutdown — all below the BGP layer.

## How the data pipeline works

```
LACNIC/RIR delegated stats → country prefix set
RouteViews/RIPE RIS RIB snapshots → BGPKIT parser → filtered route observations
→ per-collector visibility → multi-collector consensus → path families
→ static JSON artifacts → React/deck.gl frontend
```

Built with Rust (bgpkit-parser) for the pipeline, TypeScript + React + deck.gl
for the visualization, and d3-hilbert for the IP-space fingerprint.

## Quick start

```bash
# Run the web app
cd web/app
npm install
npm run dev          # → http://localhost:5173

# Build for production
npm run build        # → web/app/dist/

# Preview production build
npm run preview
```

### Rebuild data artifacts

```bash
# Download RIBs and run the pipeline
./scripts/process_cuba.sh
```

## Deployment

### Cloudflare Pages

1. Connect the repo to Cloudflare Pages
2. Build command: `cd web/app && npm install && npm run build`
3. Output directory: `web/app/dist`
4. Set custom domain: `reachmap.vadimpetrov.com`

### Static hosting (nginx, etc.)

```bash
cd web/app && npm run build
rsync -avz dist/ user@server:/var/www/reachmap/
```

## Data sources and provenance

ReachMap v0 is built from archived BGP RIB snapshots and static case-study data.
The public app does not query RouteViews, RIPE RIS, Cloudflare, or other measurement
sources at runtime; it loads pre-generated JSON artifacts committed under
`web/app/public/data/`.

### BGP collector RIB data

The BGP layer uses archived MRT/RIB snapshots from
[RouteViews](https://www.routeviews.org/) and
[RIPE RIS](https://www.ripe.net/analyse/internet-measurements/routing-information-service-ris/)
collectors. The Rust pipeline parses locally cached MRT files with
[bgpkit-parser](https://bgpkit.com/tools/parser/), filters for country-relevant
prefixes, normalizes AS paths, and produces static artifacts for the web app.

In the UI, **"BGP-visible" means a prefix was observed in sampled collector RIBs.**
It does not prove packet forwarding, application availability, or end-user reachability.

The Cuba v0 demo uses collector RIBs from documented locations:

| Collector | Location | Source |
|-----------|----------|--------|
| route-views2 | Eugene, OR, US | RouteViews |
| route-views4 | San Jose, CA, US | RouteViews |
| route-views.eqix | Ashburn, VA, US | RouteViews |
| route-views.linx | London, UK | RouteViews |
| rrc00 | Amsterdam, NL | RIPE RIS |

Collector availability differs by snapshot timestamp and case study. Not all
collectors are available at every timestamp.

### Prefix and country data

Country prefix sets are seeded from **RIR delegated statistics.** For Cuba,
ReachMap uses [LACNIC delegated IPv4 allocation records](https://ftp.lacnic.net/pub/stats/lacnic/),
then cross-references them with BGP-observed prefixes in the sampled RIB snapshots.

RIR delegated country data is registry/allocation data. It is not a guarantee
that addresses are physically used in that country, nor that users behind those
addresses are reachable.

### Geolocation and collector locations

Collector geography is based on **documented collector locations** and explicit
**manual overrides** in `config/collectors.json` and
`config/geolocation-overrides.json`. ReachMap treats this as collector RIB
geography, not proof that every peer or path is physically located there.

**A collector's location is not the same as a peer's physical location.**
Multihop BGP sessions and remote peering can decouple peer geography from
collector geography. Unknown or low-confidence geography is kept explicit
rather than guessed.

GeoIP enrichment is supported via [MaxMind GeoLite2 City](https://www.maxmind.com/en/geolite2/signup)
when configured (`--geoip` flag in the pipeline), but peer IP geolocation
carries inherent limitations — it may reflect an ISP's registered address, not
the BGP router's location.

### External disruption signals

For the March 2026 Cuba grid-collapse case, the traffic-volume signal is an
external case-study annotation based on
[Cloudflare Radar](https://radar.cloudflare.com/) / Cloudflare disruption reporting.
It is shown separately from the BGP layer.

This distinction is central to ReachMap: **BGP collector visibility can remain
green while users experience disruption** at the power, access-network, mobile,
customer-equipment, application, or data-plane layers.

## Limitations

- BGP collector RIB visibility does not prove end-user reachability
- Collector location is not the same as BGP peer physical location
- RIB snapshots are samples from specific times and points, not continuous
- Prefix-to-country mapping relies on RIR delegated stats
- External traffic signals are case-study annotations, not live data
- Peer IP geolocation may reflect ISP registration, not router location
- Manual collector location overrides require maintenance

## License

ReachMap is released under the MIT License. See [LICENSE](./LICENSE).

## Project structure

```
src/           Rust data pipeline (bgpkit-parser)
web/app/       Main web app (React + deck.gl + D3)
web/prototypes/  Earlier prototypes (hilbert-cuba, deck-reachmap, integrated)
config/        Collector definitions, geolocation overrides, JSON schemas
scripts/       Data download and processing scripts
data/          Snapshots (gitignored) and processed artifacts
docs/          Documentation
```
