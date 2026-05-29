# ReachMap — Future Data-Plane Overlays

## Current state

ReachMap shows BGP collector RIB visibility: whether a route to a country prefix exists in sampled BGP RIB dumps. This is the control-plane view.

The March 2026 Cuba case demonstrates why this is not the whole picture:
- BGP visibility: 4/4 (all green)
- User traffic: ~65% drop (Cloudflare Radar)
- Reachability: severely degraded

## Proposed overlay layers

Each layer would provide an independent signal about the same prefix set, at the same timestamp.

### 1. Traffic volume overlay

**Source:** Cloudflare Radar country-level traffic data.

**What it shows:** Relative traffic volume compared to baseline (normalized to 0..1).

**UI encoding:** 
- Traffic volume as a bar or gauge next to the BGP consensus
- "Traffic: 35% of baseline" during grid collapse
- Could also encode as an overlay opacity on the Hilbert map

**Available:** https://radar.cloudflare.com/ — public API, per-country data.

### 2. Probe reachability overlay

**Source:** RIPE Atlas probes or self-operated active probes from VPS vantage points.

**What it shows:** Percentage of probes that can successfully reach each prefix (ICMP echo, TCP/80, TCP/443).

**UI encoding:**
- Per-prefix reachability score: "3/5 probe sources reachable"
- Green dot = probe success, red dot = probe failure, gray = no probe data
- Could show as a second color layer on the Hilbert map

**Available:** RIPE Atlas API (https://atlas.ripe.net/), or self-operated probes.

### 3. IODA / CAIDA signals

**Source:** IODA (Internet Outage Detection and Analysis) from Georgia Tech / CAIDA.

**What it shows:** Active probing-based outage detection. IODA sends ICMP probes to /24 blocks and measures response rates.

**UI encoding:**
- "IODA: 78% of /24 blocks responding" during outage
- Time-series overlay showing response rate over time

**Available:** https://ioda.inetintel.cc.gatech.edu/ — public data, per-country.

### 4. OONI measurements

**Source:** OONI (Open Observatory of Network Interference).

**What it shows:** Application-layer censorship detection — which websites/services are blocked.

**UI encoding:**
- "OONI: WhatsApp blocked, Facebook blocked, Instagram blocked" for July 2021 Cuba
- Application-layer blocks shown as annotations on the event timeline

**Available:** https://ooni.org/ — public data.

## Proposed UI composition

```
┌─────────────────────────────────────────────────────────┐
│ ReachMap — Cuba                                          │
│ BGP collector RIB visibility: ████████ 4/4 collectors   │
│ Traffic volume (Cloudflare):   ███░░░░ 35% of baseline  │
│ Probe reachability:            ██░░░░░ 2/5 sources      │
│                                                         │
│ [Hilbert weather map — BGP view]                        │
│ [Traffic overlay toggle]                                │
│ [Probe reachability overlay toggle]                      │
│                                                         │
│ ⚠ BGP visibility ≠ user reachability                    │
│ Traffic and probes show the access/data-plane reality   │
│ that the routing table does not capture.                │
└─────────────────────────────────────────────────────────┘
```

## Implementation priority

1. **Cloudflare Radar traffic** — easiest to integrate, well-documented API, country-level data
2. **RIPE Atlas probes** — requires probe setup or API key, but provides per-prefix granularity
3. **IODA signals** — public data, well-suited for outage detection
4. **OONI measurements** — useful for censorship context, not real-time

## Design principle

Each overlay should be visually distinct and independently toggleable. The BGP layer is the foundation. The overlays add context that either confirms or challenges the BGP view. Together they tell a richer story about what actually happened during an Internet disruption.
