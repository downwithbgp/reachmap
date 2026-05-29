# ReachMap — BGP-Level Event Candidates

## Goal

Find a real event where BGP routes actually changed (prefixes disappeared, became partial, changed origin, or path diversity collapsed) — producing a "red/yellow weather" ReachMap view to contrast with the Cuba "all green during disruption" case.

## Key insight from research

Most modern internet shutdowns do NOT involve BGP route withdrawals. Countries have learned that BGP withdrawal is too visible and have shifted to:

- **Forwarding-plane null-routing** (keep BGP alive, silently discard traffic)
- **DPI/protocol whitelisting** (allow DNS/HTTP/HTTPS, block everything else)
- **Centralized filtering at border gateways**

This means "BGP red" events are becoming rarer over time. However, several documented events exist.

---

## Candidate 1: Kazakhstan, January 2022 — Partial BGP Withdrawal

### Event
Nationwide internet shutdown during January 2022 protests. Documented by Cloudflare, RIPE NCC, Kentik.

### BGP behavior
- **Sharp spike in BGP withdrawal messages at 10:45 UTC on January 5, 2022**
- Multiple major Kazakh ASNs (Kazakhtelecom, Kcell, Tele2, Beeline) signaled their prefixes as no longer routable
- Some prefixes became "zombies" — partially visible in BGP tables but unreachable
- Near-100% traffic drop per Cloudflare Radar and Kentik NetFlow
- Brief 3-hour restorations synchronized with presidential addresses — networks re-announced and then withdrew again

### Why useful for ReachMap
- Actual BGP withdrawal messages observed
- Partial visibility effects (some prefixes disappeared, others didn't)
- Multiple timestamps for timeline analysis (withdrawal → brief restoration → withdrawal → recovery)
- Large enough prefix set to be visually interesting (~hundreds of prefixes across multiple ASNs)

### Archive availability
- RouteViews RIBs: January 4-6, 2022 confirmed available
- Multi-collector availability: likely good (route-views2, route-views4, route-views.eqix, route-views.linx, rrc00)
- RIBs ~90-110 MB each

### Risks
- Some prefixes remained partially visible — may not produce clean "all red"
- The "zombie prefix" phenomenon (BGP visible but unreachable) complicates the narrative
- Still demonstrates a real BGP-level event, unlike Cuba/Iran

### Recommendation
**Best candidate for the first "red weather" demo.** Has documented BGP withdrawals, partial visibility, and restoration/recovery phases. The partial visibility (some prefixes withdrawn, some not) makes the visualization more interesting than a uniform all-red shutdown.

---

## Candidate 2: Tonga, January 2022 — Clean Cable-Cut Withdrawal

### Event
Hunga Tonga volcanic eruption and tsunami, January 14-15, 2022. Severed the single submarine cable connecting Tonga to Fiji. 38-day total communications blackout.

### BGP behavior
- **Complete BGP route withdrawal at 05:35 UTC on January 15, 2022**
- Tonga's ISPs (Digicel, Kalianet) disappeared from the global routing table
- Cloudflare documented a "clear spike in BGP update messages"
- Kentik's Doug Madory: "complete disconnection at 6:40pm local time, all BGP routes effectively gone from the global routing table"
- Routes returned February 22, 2022 when the cable was repaired

### Why useful for ReachMap
- Clean BGP-level event — routes actually disappeared and came back
- Very small prefix set (Tonga has even fewer prefixes than Cuba) — easy to process
- Clear before/during/after timeline: Jan 14 → Jan 15 → Feb 22
- Strong visual: all green → all red → all green
- Natural disaster narrative is easy to explain to non-technical audiences

### Archive availability
- RouteViews RIBs: January 14, 15, and February 22, 2022 confirmed available
- Multi-collector: likely available

### Risks
- Small country → small prefix set → Hilbert map is mostly empty
- The cable-cut mechanism (physical fiber break) means BGP withdrawals are expected — less nuanced than policy-driven shutdowns
- 38-day gap between "during" and "recovered" makes the timeline less tight

### Recommendation
**Second-best candidate.** Excellent for a clean "before/after" demo. But the small prefix set and simple cause (physical cable cut) make it less intellectually interesting than Kazakhstan's partial policy-driven withdrawals.

---

## Candidate 3: Iran, 2019 — Last Real BGP Withdrawal

### Event
November 2019 protests — the last time Iran used BGP withdrawal as a shutdown mechanism.

### BGP behavior
- RIPE-allocated Iranian IPv4 prefix visibility dropped from ~85% to 54-62%
- Actual BGP route withdrawals observed
- Partial visibility — not a clean all-red shutdown

### Why NOT recommended
- **After 2019, Iran shifted to "stealth blackouts"** — BGP stays up, traffic silently null-routed
- The 2019 event is 7 years old
- The same story as Cuba (BGP stayed partially visible)

---

## Recommendation

**Primary candidate: Kazakhstan January 2022**

Reasons:
1. Documented BGP withdrawal messages with partial visibility effects
2. Multi-ASN, multi-prefix — visually rich
3. Restoration/re-withdrawal cycles during presidential addresses — multiple "weather changes"
4. Recent enough to be relevant (2022), old enough to have archive coverage
5. Contrasts well with Cuba: "Here the routing plane actually changed"

**Secondary candidate: Tonga January 2022**

Reasons:
1. Clean all-red → all-green cycle
2. Easy to explain (volcano → cable cut → routes gone)
3. Good for a simple before/after demo

---

## What the "red weather" demo should show

```
Before (Jan 4):    BGP visibility normal — prefixes announced
During (Jan 5):    BGP withdrawal spike — prefixes disappear or become partial
Restoration:       Brief re-announcement during presidential address
Re-withdrawal:     Prefixes disappear again
Recovery (Jan 11): BGP visibility restored
```

The ReachMap weather map would show:
- Green → red/partial → briefly green → red again → green
- This is a true "weather event" — the routing plane actually changed multiple times
- Contrast with Cuba: green → green → green (routing plane stable, disruption below BGP)
