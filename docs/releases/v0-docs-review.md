# v0 Documentation Trustworthiness Review

**Date:** 2026-05-29
**Result:** PASS — no critical fixes needed

## Files reviewed

- README.md
- docs/product.md
- docs/deployment.md
- docs/collector-consensus.md
- docs/geolocation.md
- docs/bgp-event-candidates.md
- docs/red-weather-validation.md
- docs/data-plane-overlays.md
- docs/releases/v0-demo.md
- web/app/src/App.tsx (public-facing copy)
- web/app/src/components/SidePanel.tsx (About/provenance copy)
- web/app/src/components/GeoMap.tsx (arc/cable disclaimer)
- web/app/src/components/HilbertCanvas.tsx (fingerprint label)

## Critical fixes

None required. All docs use precise language:
- "BGP collector RIB visibility" — never "reachability" or "forwardable"
- "suggests" / "does not prove" — never "proves" or "demonstrates"
- "sampled collector RIBs" — never "global Internet" or "the Internet"

## Recommended polish

1. **`docs/product.md` line 5:** "reachability weather map" → "Internet observability map" **FIXED**
   - Reason: "reachability" can imply data-plane reachability even with qualifiers.

2. (No other issues found.)

## Files changed

- `docs/product.md` — one line: "reachability weather map" → "Internet observability map"

## Remaining caveats

1. **External traffic signal is hardcoded.** The March 2026 signal bar says "Cloudflare Radar ~35% of baseline" — this is a manually curated annotation, not live data. The docs state this clearly, but it bears repeating in any public presentation.

2. **Single-country demo.** The data model supports multiple countries, but only Cuba data is shipped. The README and release notes mention this.

3. **Collector locations use manual overrides.** All 5 collector positions come from `config/collectors.json` and `config/geolocation-overrides.json` — well-documented, but users should know these are maintained manually, not derived from peer IP geolocation.

4. **"BGP layer stayed green" is a v0 soundbite.** The Cuba narrative is compelling but relies on the contrast between BGP data and an external traffic signal. If the external signal source (Cloudflare Radar) changes its API or data, the narrative needs updating.

## Audience check

### Non-networking reader
- README.md: clear. Explains what ReachMap is, what it isn't, what the Cuba demo proves, limitations.
- About panel in app: explains Hilbert fingerprint, green meaning, why BGP stays green.
- "What the routing table sees — and what it misses" is a strong non-technical hook.

### Network engineer
- `collector-consensus.md`: precise. Distinguishes collector RIB visibility from reachability, collector location from peer location, AS paths from fiber paths.
- `geolocation.md`: explicit provenance, confidence levels, manual overrides.
- Wording rules table in `product.md`: useful for contributors.

### Future maintainer
- `deployment.md`: has build commands, Cloudflare Pages config, smoke checklist, data refresh steps.
- README.md: project structure, pipeline overview, data sources.
- `.gitignore`: excludes large RIBs, node_modules, build output. Includes processed JSON artifacts in `public/data/`.
- `process_cuba.sh`: end-to-end pipeline script (caveat: requires RIBs to be downloaded first).

## Verdict

Documentation is ready for v0 public deployment. The language is precise, the claims are scoped, the limitations are visible, and the reproducibility path is documented.
