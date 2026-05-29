# ReachMap — Visual Research & Prototype Recommendation

## 1. Summary: The Strongest Visual Metaphor

**Recommendation: Hybrid — Cuba as geographic anchor + Hilbert IP-space fingerprint + vantage "weather fronts."**

The hex grid was a reasonable first sketch but is not distinctive enough for ReachMap's signature visual. After researching the four candidate approaches, the strongest direction is a hybrid that keeps Cuba as the central geographic/emotional anchor, renders Cuban IPv4 space as a Hilbert-curve fingerprint beside or inside it, places selected vantage ASNs around the perimeter like observation stations, and draws AS-path families as logical "weather fronts" streaming into Cuban origin ASNs.

This approach:
- Is visually distinctive (no product combines a Hilbert curve + geographic map + BGP reachability)
- Separates the conceptual layers honestly (geography ≠ address space ≠ AS paths)
- Has strong IP-visualization precedent (xkcd, ANT Census, CAIDA heatmaps)
- Scales to any country by swapping the geo polygon and the Hilbert-rendered prefix set
- Feels like data journalism, not a dashboard

---

## 2. Comparison Table

| Dimension | Hex Grid (1) | Voronoi Treemap (2) | Hilbert Curve (3) | Hybrid (4) |
|-----------|-------------|---------------------|-------------------|------------|
| **IP address structure** | Weak — arbitrary cell assignment | Moderate — area encodes size but not numeric adjacency | Strong — preserves CIDR locality, /16s are blocks, /24s are specks | Strong — Hilbert handles address space; geo handles map |
| **Reachability signal** | Good — brightness works | Good — opacity/fill works | Excellent — prefixes literally appear/disappear from the map | Excellent — multiple encodings possible |
| **Geographic honesty** | Misleading — implies prefix lives at hex location | Misleading — implies prefix lives inside tile region | Honest — no false geography | Honest — layers are visually separated |
| **Implementation complexity** | Low — ~80 lines D3 | High — d3-voronoi-treemap is unmaintained, Cuba needs convex hull approximation | Moderate — d3-hilbert exists, Canvas/WebGL for perf | High — multiple coordinated views |
| **Hover/click interaction** | Easy — each hex is an SVG element | Moderate — irregular polygons, hit testing is fine in SVG | Moderate — need reverse Hilbert lookup (d3-hilbert provides it) | Moderate — interaction per view |
| **Performance at scale** | Good for ~100 hexes, degrades past ~1000 SVG elements | Good for ~50-200 cells, Voronoi gets slow above ~500 | Excellent with Canvas — order-12 (16M cells) at 30fps | Good — each view is sized appropriately |
| **Works for Cuba?** | Yes | Yes, with convex hull caveat | Yes — ~50 prefixes = tiny Hilbert | Yes |
| **Generalizes to US/CN?** | Breaks — thousands of prefixes don't fit hexes | Breaks — Voronoi cells become microscopic | Yes — order-12 handles full /24 space | Yes — Hilbert scales; geo swaps |
| **"Signature" feel** | Generic — looks like every hex dashboard | Distinctive — organic cell shapes | Iconic among engineers, novel to public | Most distinctive — no precedent found |
| **Audience intuition** | Immediate — "it's a weather map" | Moderate — "it's a map of blocks" | Needs explanation — "each dot is an address block" | Needs explanation — but rewards the effort |

---

## 3. Recommended MVP Visual Path

### Phase A: Hilbert-curve IP-space fingerprint (static)

Build a single-panel Hilbert curve showing Cuban IPv4 prefixes. This is the **proof-of-concept visual** — prove the metaphor works before adding complexity.

**What it shows:**
- Each Cuban /24 (or finer) rendered as a cell on the Hilbert curve
- Color = origin ASN (ETECSA vs CENIAInternet vs unannounced)
- Brightness = visibility from a selected vantage ASN
- Cells with no BGP observation = dark/empty
- A small Cuba outline sits nearby as geographic anchor

**Implementation:**
- `d3-hilbert` for layout (order 10-12, tuned to Cuba's ~256K addresses)
- Canvas 2D rendering (offscreen buffer → `drawImage` per frame)
- Reverse Hilbert lookup for hover hit-testing
- React manages state; D3 does math only

**Why this first:**
The Hilbert curve is the hardest visual to get right, but it's the most technically honest representation of IP address space. If it works and looks good, it validates the entire product direction. If it feels too abstract, we fall back to the Voronoi treemap inside Cuba's outline (approach 2), which is also researched and viable.

### Phase B: Add vantage "weather fronts"

Once the Hilbert fingerprint works, add visual connectors from selected vantage ASNs (positioned around the perimeter) to the Cuban origin ASN regions on the Hilbert map. These are NOT literal cables — they are styled as "weather fronts" or "visibility streams" using animated dashed arcs or flowing particles.

### Phase C: Add time dimension

Animate the Hilbert map across multiple RouteViews snapshots. Prefixes that disappear between snapshots fade out with a "cold front" color transition. Prefixes that re-appear "warm up." This is the "weather" part of the weather map.

---

## 4. Recommended Final/Signature Visual Path

The final product should be a **coordinated multi-view**:

```
┌─────────────────────────────────────────────────┐
│  [Country: Cuba ▼]     [Vantage: AT&T ▼]        │
│  [Snapshot: 2026-05-28 00:00 UTC]               │
├────────────────────┬────────────────────────────┤
│                    │                            │
│   Cuba geographic  │   Hilbert IP-space         │
│   outline          │   fingerprint              │
│   (small anchor)   │   (main visual)            │
│                    │                            │
│   Collector        │   Origin ASN regions       │
│   locations        │   colored distinctly       │
│   (dots)           │                            │
│                    │   Visible prefixes: bright │
│                    │   Not visible: dim/gray    │
│                    │                            │
├────────────────────┴────────────────────────────┤
│  Side panel:                                     │
│  - Selected: AT&T / AS7018                        │
│  - Peers found: route-views2, route-views4, ...   │
│  - Visible prefixes: 42 / 58 (72%)                │
│  - Path families: 3 distinct AS paths             │
│  - Not visible: 16 prefixes                       │
│  - [Click prefix for AS-path detail]              │
└─────────────────────────────────────────────────┘
```

### Visual encoding schema

| Data dimension | Visual encoding | Layer |
|---------------|-----------------|-------|
| Prefix exists in LACNIC | Cell exists | Address space |
| Prefix seen in BGP | Cell is filled (vs outline/dashed) | BGP visibility |
| Prefix visible from selected vantage | Cell is bright/saturated | Vantage reachability |
| Origin ASN | Cell color (hue) | Address space |
| Prefix size (/16 vs /24) | Cell grouping/area | Address space |
| AS path family | Connecting arc style (solid/dashed/dotted) | AS path |
| Snapshot timestamp | Animation transition speed | Time/weather |
| Uncertainty in country mapping | Cell border style (solid = high confidence, dotted = low) | Metadata |

---

## 5. Data Artifacts Needed for Each Visual Approach

The data pipeline produces these artifacts once. Different visuals consume different subsets.

```
data/processed/countries/CU/
  profile.json          — country metadata, known ASNs, uncertainty notes
  prefixes.json         — all LACNIC Cuba prefixes with address ranges
  summary.json          — aggregate stats (total prefixes, total IPs, observed %)
  vantages/
    index.json          — all peer ASNs that see any Cuba prefix
    AS7018.json         — per-vantage: visible prefixes, path families, collectors
    AS3356.json
    ...
  path-families.json    — distinct AS paths to Cuban prefixes, across all vantages
  observations/
    2026-05-28T0000Z.json  — raw route observations for one snapshot
    ...
```

### What each visual approach consumes

| Visual | Needs |
|--------|-------|
| Hex grid | `prefixes.json` + per-vantage `AS{nnnn}.json` + country GeoJSON |
| Voronoi treemap | Same + prefix IP counts for area weighting |
| Hilbert curve | `prefixes.json` with `start_address` and `address_count` for Hilbert cell mapping |
| Hybrid | Everything — GeoJSON, prefixes, vantages, path-families, observations |

**Key design principle:** The artifacts contain integer address ranges (`start_ip`, `end_ip` as u32), not just CIDR strings. This lets the Hilbert curve map prefixes to exact cell ranges without string parsing.

### Per-prefix artifact shape

```json
{
  "prefix": "190.6.64.0/20",
  "start_ip": 3188137984,
  "end_ip": 3188142079,
  "address_count": 4096,
  "origin_asns": [27725],
  "origin_names": ["ETECSA"],
  "country_confidence": "high",
  "observed_in_bgp": true,
  "snapshot_count": 12
}
```

---

## 6. Tech Stack Recommendation

| Concern | Recommendation | Why |
|---------|---------------|-----|
| **Hilbert curve** | Canvas 2D with offscreen buffer | Order-10+ is too many elements for SVG. Canvas handles 1M+ cells at 30fps. WebGL only needed if we want 60fps zoom/pan. |
| **Geographic map** | SVG (small, static) | Cuba outline is one path. SVG is simpler for the anchor map. |
| **AS-path arcs** | Canvas or SVG (TBD based on count) | If < 50 arcs, SVG. If more, Canvas. |
| **UI chrome** | React | Selectors, side panel, layout. |
| **D3 role** | Math only (projections, Hilbert layout, scales) | React owns DOM. D3 computes numbers. |
| **Animation** | `requestAnimationFrame` + Canvas redraw | For "weather front" transitions and time-slider replay. |
| **Deck.gl / WebGL** | Defer to post-MVP | Only needed if we want a 3D globe with arc layers. Not needed for the core Hilbert + Cuba view. |

### Frontend dependencies (initial)

```json
{
  "d3-hilbert": "^1.0",
  "d3-geo": "^3.1",
  "d3-scale": "^4.0",
  "d3-array": "^3.2",
  "react": "^18",
  "react-dom": "^18"
}
```

No deck.gl, no MapLibre, no topojson-client (use plain GeoJSON for Cuba).

---

## 7. Interaction Design

### State machine

```
Default state (no vantage selected)
  → Cuba outline visible (small, left)
  → Hilbert fingerprint visible (main, center)
  → All observed prefixes shown in origin-ASN colors
  → Unobserved LACNIC prefixes shown as faint outlines

User selects vantage ASN (e.g., AT&T / AS7018)
  → Vantage card appears in side panel
  → Hilbert cells update:
      Bright/saturated = visible from this vantage
      Dim/desaturated = observed in BGP but NOT from this vantage
      Outline only = never observed in BGP
  → Vantage ASN position highlighted on perimeter
  → Summary stats update in side panel

User hovers a prefix cell
  → Tooltip: prefix, origin ASN, visible from selected vantage? (yes/no)
  → If yes: observed AS path(s), collector/peer
  → If no: "Not seen from AT&T. Seen by N other vantages."

User clicks a prefix cell
  → Side panel switches to prefix detail mode
  → Shows: all observations across all vantages
  → AS-path families listed, grouped by path similarity
  → "Seen by 8/12 vantages" summary

User clicks a path family
  → Path highlights on the AS-path arc diagram
  → Other families dim
  → Collector peers that observed this path are listed

User drags snapshot timeline slider
  → Hilbert cells animate (fade transitions)
  → Newly appeared prefixes "warm up" (color temperature shift)
  → Disappeared prefixes "cool down" or pulse briefly before going dark
  → Timeline shows event markers (e.g., "BGP session reset at route-views2")
```

### Small multiples (future)

For comparing multiple vantage points side-by-side, render 3-6 miniature Hilbert maps in a row, each colored for a different vantage ASN. This is the "weather radar stations" metaphor — each vantage is a different "camera angle" on Cuban address space.

---

## 8. Risks & Misleading Interpretations to Guard Against

| Risk | Mitigation |
|------|-----------|
| **Hilbert curve looks like a real map** | Prominent label: "IP address space fingerprint — not physical geography." Cuba outline is small and clearly separate. |
| **Bright cell = "user can reach this website"** | Label: "BGP route visibility only. Does not measure end-to-end reachability, packet forwarding, or application-layer availability." |
| **AS paths drawn as arcs = physical cables** | Style arcs as dashed/weather-front lines, not solid cables. Label: "Logical AS path. Not physical fiber." |
| **"Not visible from AT&T" = AT&T customers can't reach Cuba** | Explain: AT&T may still have routes through other paths not captured at this collector peer. A RouteViews peer is one observation point, not AT&T's full routing table. |
| **LACNIC allocation ≠ BGP announcement** | Always show unannounced LACNIC blocks (outline cells) and explain the gap. |
| **Snapshot is a point in time** | Show timestamp prominently. Add "Data as of 2026-05-28 00:00 UTC" in the UI. |
| **Country confidence** | For prefixes with conflicting geo evidence (RIR says CU, GeoIP says US), show hatched/dotted cell border and note in tooltip. |
| **Cuba works, US breaks** | The Hilbert curve scales to full IPv4 (order 12 = 16M cells for /24 resolution). But the UI must handle the transition from ~50 prefixes to ~50,000 gracefully. Test with US delegated stats early. |

---

## 9. Phased Implementation Plan

### Phase 0: Data pipeline (same as original plan, slightly refined artifacts)

- Rust + bgpkit-parser
- LACNIC delegated → `prefixes.json` with integer IP ranges
- RouteViews RIB → per-vantage `AS{nnnn}.json` + `path-families.json`
- Output: `data/processed/countries/CU/` with all artifacts

### Phase 1: Hilbert curve static prototype

- `web/src/components/HilbertFingerprint.tsx` — Canvas-based Hilbert renderer
- `web/src/lib/hilbert.ts` — mapping from prefix IP ranges to Hilbert cell indices using `d3-hilbert`
- `web/src/lib/colors.ts` — origin ASN color scale, visibility opacity scale
- Cuba outline as small SVG anchor
- Hover tooltip with prefix info
- **No vantage selection yet** — just render all observed prefixes colored by origin ASN

### Phase 2: Vantage selection + visibility highlighting

- `web/src/components/VantageSelector.tsx`
- Side panel with vantage summary
- Hilbert cells re-color based on selected vantage visibility
- Per-vantage JSON artifacts consumed

### Phase 3: AS-path weather fronts

- `web/src/components/PathArcs.tsx` — arcs from vantage positions to origin ASN regions
- Path family grouping and highlighting
- Click to inspect path details

### Phase 4: Time dimension

- Snapshot timeline slider
- Animated transitions between snapshots
- "Weather event" markers (large visibility changes)

### Phase 5: Small multiples + multi-country

- 3-6 miniature Hilbert maps for comparing vantages
- Switch country to test generalization
- Responsive layout for mobile

---

## 10. Decision: Start with Phase 1 (Hilbert Curve Static Prototype)

**Why:**
1. The Hilbert curve is the riskiest and most important visual component. If it works, everything builds on it. If it doesn't, we fall back to Voronoi treemap (approach 2) which is also well-researched.
2. It's the most technically honest representation of IP address space.
3. It has never been productized as a live dashboard — ReachMap would be the first.
4. `d3-hilbert` exists and works. The implementation is Canvas-based and bounded in scope (~200 lines of rendering code).
5. The data pipeline already produces the artifacts needed (IP ranges with integer bounds).

**Success criteria for Phase 1:**
- A web page shows a Hilbert curve of Cuban IPv4 space
- Each Cuban prefix is visible as a colored region
- Origin ASNs are distinguishable by color
- Hovering shows prefix details
- The visual clearly communicates "this is IP address space, not a geographic map"
- It looks visually distinctive — something you'd share on HN/Twitter

### Phase 1 implementation plan (concrete)

Files to create/modify:

1. **Data pipeline** (`src/` — Rust, 3 binaries as originally planned)
2. **`web/src/lib/hilbert.ts`** — Core Hilbert mapping logic
   ```typescript
   interface HilbertCell {
     index: number;        // position on curve (0 to 4^order - 1)
     x: number;            // canvas x coordinate
     y: number;            // canvas y coordinate
     ipStart?: number;     // IPv4 as u32, if this cell maps to a prefix
     prefix?: CountryPrefix;
   }

   function buildHilbertMap(
     prefixes: CountryPrefix[],
     order: number
   ): HilbertCell[];

   function cellAtPoint(x: number, y: number, order: number): number;
   ```

3. **`web/src/components/HilbertFingerprint.tsx`** — Canvas renderer
   - Renders Hilbert cells as filled rectangles on an offscreen canvas
   - Handles hover via mousemove → reverse lookup → tooltip
   - Handles resize

4. **`web/src/components/CubaAnchor.tsx`** — Small SVG Cuba outline

5. **`web/src/App.tsx`** — Layout: Cuba anchor + Hilbert fingerprint + sidebar (empty for now)

This is scoped to ~300 lines of frontend code. We ship it, evaluate the visual, then decide Phase 2.
