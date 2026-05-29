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

## Data sources

- **BGP RIBs:** RouteViews (archive.routeviews.org), RIPE RIS (data.ris.ripe.net)
- **Prefix data:** LACNIC, APNIC, RIPE NCC delegated statistics
- **External signals:** Cloudflare Radar, IODA, RIPE Atlas (case-study annotations)
- **Collector locations:** RouteViews documentation, RIPE RIS documentation, manual overrides

## Limitations

- BGP collector RIB visibility does not prove end-user reachability
- Collector location is not the same as BGP peer physical location
- RIB snapshots are samples from specific times and points, not continuous
- Prefix-to-country mapping relies on RIR delegated stats
- External traffic signals are case-study annotations, not live data

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
