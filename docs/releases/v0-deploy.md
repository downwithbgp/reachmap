# ReachMap v0 — Deployment Record

**URL:** https://reachmap.vadimpetrov.com

**Date:** 2026-05-29

**Latest commit:** `4e19ac3` — fix: connect Cuba geographic anchor to IP-space callout

**Build:**
```bash
cd web/app && npm run build
```
- `dist/index.html` — 1.24 KB
- `dist/assets/index-WLJS-DKL.js` — 186 KB (60 KB gzipped)
- `dist/assets/MapStageGL-DXouUQbj.js` — 1,686 KB (467 KB gzipped) — deck.gl + MapLibre GL stage
- `dist/data/` — 496 static JSON files

**Default view:** GL map stage (deck.gl + MapLibre GL) with country-shaped IP-space weather callout. SVG fallback available via `?stage=svg`.

## Smoke test — PASS (all checks)

| # | Check | Result |
|---|-------|--------|
| 1 | Page loads (HTTP 200) | ✓ |
| 2 | March 2026 case default | ✓ |
| 3 | Event snapshot (Mar 16 20:00) | ✓ |
| 4 | Headline: "What the routing table sees — and what it misses" | ✓ |
| 5 | BGP vs traffic signal bar visible | ✓ |
| 6 | Hilbert fingerprint renders | ✓ |
| 7 | GL map stage loads by default (WebGL) | ✓ |
| 8 | Collector points render on geographic basemap | ✓ |
| 9 | Geographic Cuba marker visible | ✓ |
| 10 | Cuba IP-space weather callout visible (country-shaped, top-right) | ✓ |
| 11 | Dashed connector: geographic Cuba → callout (with arrow + label) | ✓ |
| 12 | Connector updates on pan/zoom/resize | ✓ |
| 13 | Callout footer: "Address space packed into country outline. Not physical prefix locations." | ✓ |
| 14 | Case selector works (3 cases) | ✓ |
| 15 | Timeline controls work (3 snapshots) | ✓ |
| 16 | Prefix click updates details | ✓ |
| 17 | Path-family/prefix details render | ✓ |
| 18 | About/Method + provenance visible | ✓ |
| 19 | No console errors | ✓ |
| 20 | No external tile requests (self-hosted GeoJSON basemap) | ✓ |
| 21 | No localhost/10.0.3.200 references in build | ✓ |
| 22 | Social meta present (og:title, og:description, meta desc) | ✓ |
| 23 | Build clean (`tsc && vite build`) | ✓ |

## Known limitations

- External traffic signal (Cloudflare Radar) is a case-study annotation, not live data
- Single-country demo (Cuba). Multi-country architecture ready but no additional data
- Collector locations use manual overrides from config files
- RIB snapshots are static samples, not live streaming
- Mobile viewport functional but not optimized

## Deploy command

```bash
# Cloudflare Pages:
# Build command: cd web/app && npm install && npm run build
# Output directory: web/app/dist

# Or static host:
rsync -avz web/app/dist/ user@server:/var/www/reachmap/
```