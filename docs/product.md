# ReachMap — Product Thesis

## What ReachMap is

ReachMap is a layered Internet observability map for national address space.

It visualizes how a country's address space appears from global BGP collector RIBs, then compares that control-plane view against other disruption signals such as traffic volume, active probes, and censorship measurements.

Its core value is showing both presence and absence: when BGP changes, ReachMap shows routing-plane weather; when BGP stays green during a user-visible disruption, ReachMap shows that the failure happened below or outside the global routing control plane.

## The layered observability model

The Internet can fail at different layers. ReachMap starts with the layer it can measure reliably from public data:

| Layer | What it shows | Data source | Status |
|-------|--------------|-------------|--------|
| **BGP collector RIB visibility** | Are routes to country prefixes present in BGP RIB dumps from known collectors? | RouteViews, RIPE RIS | Implemented |
| **Traffic volume** | Did user-facing traffic to/from the country change? | Cloudflare Radar | Case-study annotations |
| **Active probes** | Can TCP/ICMP probes reach country prefixes from known vantage points? | RIPE Atlas, self-operated | Future |
| **Censorship / app access** | Are specific applications or protocols blocked? | OONI | Future |

## The core insight

After testing five events across three countries (Cuba, Tonga, Kazakhstan), a clear pattern emerged:

**Most modern Internet disruptions do NOT involve widespread BGP route withdrawal.**

Countries have learned that BGP-level shutdown is too visible and have shifted to:
- Forwarding-plane null-routing (keep BGP alive, silently discard traffic)
- Centralized filtering at border gateways
- DPI/protocol whitelisting
- Access-network shutdown (power, mobile, CPE)

This means a tool that only says "BGP changed" or "BGP didn't change" would be boring. But a tool that shows the **contrast** between BGP stability and user disruption is genuinely useful.

## The product question

> Which layer of the Internet changed?

Not just:

> Did the country disappear from BGP?

## Case taxonomy

| Case type | Meaning | Example |
|-----------|---------|---------|
| **bgp_stayed_green_user_disrupted** | BGP routes stable, user traffic disrupted — disruption below control plane | Cuba March 2026 |
| **partial_bgp_weather** | Some BGP change observed but not widespread | Tonga Jan 2022, Kazakhstan Jan 2022 |
| **confirmed_bgp_weather** | Widespread BGP route withdrawal — routing plane actually changed | (rare in modern era) |
| **healthy_baseline** | Normal state, all green, no disruption | Cuba May 2026 |

## The honest demo

The primary demo should be Cuba March 2026:

> When Cuba's grid collapsed in March 2026, user traffic dropped sharply.
> ReachMap checked the BGP layer.
> The BGP layer stayed green.
> That tells us the disruption was not visible as a global route withdrawal
> in sampled collector RIBs.

This is a stronger story than "look, red map."

## Wording rules

| Use | Never use |
|-----|-----------|
| BGP collector RIB visibility | Reachability |
| Visible in collector RIBs | Reachable from |
| Route observed by collector | Traffic can reach |
| BGP-visible | Forwardable |
| Collector RIB visibility | Internet access |
| Suggests disruption below BGP | Proves it was not a routing problem |
