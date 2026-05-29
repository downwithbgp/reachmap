# ReachMap — Collector Consensus Model

## What consensus measures

ReachMap's consensus view answers:

> How many collector RIBs contain a BGP route to this country prefix?

It does NOT answer:

> Can packets be forwarded from the collector's city to this prefix?

This distinction is critical. The consensus is about **BGP control-plane visibility**, not data-plane reachability.

## Collector vs peer geography

A RouteViews or RIPE RIS collector has a known physical location. Its BGP peers may be:

| Peer locality | Meaning | Geo interpretation |
|---|---|---|
| **single_hop** | Peer is locally connected (same IX, same facility) | Collector city ≈ observation city |
| **multihop** | Peer is connected via a multihop BGP session | Collector city ≠ observation city; peer location unknown |
| **unknown** | Peer locality not determined | No geography can be inferred for the peer |

For simplicity, the MVP treats **all peers as "unknown" locality** and phrases visibility in terms of the collector RIB only:

> Prefix X is visible in the RIB of collector route-views.linx (London).

This is accurate: the route exists in the MRT dump from that collector. We do not claim that a London-local peer announced it, nor that traffic from London can reach it.

## Consensus labels

| What we show | What we NEVER show |
|---|---|
| "Visible in 5 / 5 collector RIBs" | "Reachable from 5 / 5 locations" |
| "Collector RIB visibility" | "Data-plane reachability" |
| "Route observed by collector" | "Traffic can reach prefix" |
| "BGP-visible" | "Forwardable" |
| "Consensus · 5 collector RIBs" | "Consensus · 5 locations" |

## Multi-collector consensus

A collector "observes" a country prefix if **at least one peer observation from that collector's RIB** sees a BGP prefix whose IP range overlaps with the LACNIC allocation prefix.

### Example

```
Prefix: 152.206.0.0/14 (LACNIC allocation)
  route-views2:    observed (via AS7018 peer)
  route-views4:    observed (via AS3356 peer)
  route-views.eqix: observed (via AS174 peer)
  route-views.linx: observed (via AS1299 peer)
  rrc00:           observed (via AS3320 peer)
  → Consensus: 5/5 (1.00)
```

The collector locations are Eugene, San Jose, Ashburn, London, Amsterdam. But the BGP peer who announced the route may or may not be physically near those locations. The consensus statement is:

> The route to 152.206.0.0/14 was present in the BGP RIB dumps from all 5 sampled collectors at this timestamp.

Not:

> The route is reachable from all 5 cities.

## Multihop policy by collector

| Collector | Multihop policy | Notes |
|---|---|---|
| route-views2 | mixed | Some local peers at UO, some remote |
| route-views4 | mixed | Equinix SV1, mix of local/remote peers |
| route-views.eqix | mixed | Equinix Ashburn, mix of local/remote |
| route-views.linx | mixed | LINX London, predominantly local but some remote |
| rrc00 | mostly-multihop | RIPE RIS rrc00 explicitly allows multihop peers |

## What a green consensus means

All green (5/5) means:
- Every sampled collector RIB contains at least one route to this prefix
- The prefix is broadly BGP-visible across the sampled observation points
- There is no evidence of a BGP-level visibility gap at this snapshot time

All green does NOT mean:
- End users can reach the prefix
- The prefix's network is operational
- There is no data-plane outage (power, fiber, censorship, application-layer blocking)

In fact, a uniform 5/5 consensus during a known Internet disruption event would be an important finding:

> BGP visibility remained stable at 5/5 while user-level traffic collapsed.
> This suggests the disruption was at the data-plane, access, or application layer,
> not at the BGP control-plane level.

This is the kind of insight that makes ReachMap valuable.

## Future: data-plane validation

When ReachMap adds data-plane probes (ping, traceroute, HTTP), each prefix can show:

```
BGP:      5/5 collector RIBs  (control-plane)
Data:     3/5 probes reachable (data-plane)
```

With both layers, consensus becomes a diagnostic tool showing where a visibility gap or disruption sits in the stack.

## References

- RouteViews collector documentation: https://www.routeviews.org/routeviews/
- RIPE RIS peering policy: https://www.ripe.net/analyse/internet-measurements/routing-information-service-ris/ris-peering-policy
- `config/collectors.json` — collector definitions with multihopPolicy
