# ReachMap v0 — Deployment Record

**URL:** https://reachmap.vadimpetrov.com

**Date:** 2026-05-29

**Build:**
```bash
cd web/app && npm run build
```
- `dist/index.html` — 1.24 KB
- `dist/assets/index-CnSomUtd.js` — 919 KB (269 KB gzipped)
- `dist/data/` — 496 static JSON files

## Smoke test — PASS (17/17)

| # | Check | Result |
|---|-------|--------|
| 1 | Page loads (HTTP 200) | ✓ |
| 2 | March 2026 case default | ✓ |
| 3 | Event snapshot (Mar 16 20:00) | ✓ |
| 4 | Headline: "What the routing table sees — and what it misses" | ✓ |
| 5 | BGP vs traffic signal bar visible | ✓ |
| 6 | Hilbert fingerprint renders | ✓ |
| 7 | deck.gl map renders | ✓ |
| 8 | Collector points render | ✓ |
| 9 | Case selector works (3 cases) | ✓ |
| 10 | Timeline controls work (3 snapshots) | ✓ |
| 11 | Prefix click updates details | ✓ |
| 12 | Path-family/prefix details render | ✓ |
| 13 | About/Method + provenance visible | ✓ |
| 14 | No console errors | ✓ |
| 15 | No localhost/10.0.3.200 references in build | ✓ |
| 16 | Social meta present (og:title, og:description, meta desc) | ✓ |
| 17 | 496 data files in dist | ✓ |

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
