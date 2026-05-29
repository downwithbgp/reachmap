# ReachMap — Red-Weather Candidate Validation

## Summary

| Candidate | Country | Event | Prefixes | Before | During | After | Result |
|-----------|---------|-------|:---:|--------|--------|-------|--------|
| Tonga | TO | Volcanic cable cut, Jan 15 2022 | 11 | 9/11 in BGP | 9/11 in BGP (04:00) → 5/11 (16:00) → 4/11 (20:00) | 4/11 (Jan 16) | **partial_or_mixed_weather** |
| Kazakhstan | KZ | Protest shutdown, Jan 5 2022 | 662 | TBD | TBD | TBD | **not yet tested** |

---

## Tonga: Partial Withdrawal (not a clean red-weather event)

### Snapshot results (route-views2 only)

| Timestamp | Role | Prefixes in BGP | Visible/Total | Result |
|-----------|------|:---:|:---:|--------|
| 2022-01-14 00:00 | before | 9/11 | 9/9 (all-visible) | Green — all observed prefixes visible |
| 2022-01-15 04:00 | event (early) | 9/11 | 9/9 (all-visible) | Green — BGP sessions hadn't timed out yet |
| 2022-01-15 16:00 | event (peak) | 5/11 | 5/5 (all-visible) | **Partial — 4 prefixes dropped from BGP** |
| 2022-01-15 20:00 | event (late) | 4/11 | 4/4 (all-visible) | **More disappeared — 5 prefixes dropped from BGP** |
| 2022-01-16 00:00 | after | 4/11 | 4/4 (all-visible) | Stable at reduced level |

### Interpretation

**BGP routes DID partially disappear.** Between Jan 14 and Jan 16, the number of BGP-observed Tongan prefixes dropped from 9 to 4. The remaining 4 prefixes were the ones announced by carriers with international transit or satellite backup (Digicel Pacific, Tonga Communications Corp via satellite).

However, the remaining prefixes stayed "all-visible" (1/1 collector) — those that remained announced were fully visible. There was no "partial visibility" within individual prefixes (e.g., 0.5 ratio across collectors).

### Why not a clean all-red

1. **Not all prefixes disappeared** — 4 remained announced throughout
2. **The onset was gradual** — BGP sessions timed out over hours, not all at once
3. **Satellite backup** kept some prefixes announced
4. **Small prefix set** makes the Hilbert map mostly empty regardless

### Visual potential for ReachMap

- A timeline showing 9 → 5 → 4 BGP-observed prefixes
- The Hilbert map would shrink (fewer cells) during the event
- Two unobserved LACNIC prefixes (not in BGP before or after) stay charcoal
- **Not visually dramatic** — going from 9 to 4 cells on a Tonga Hilbert map is a subtle change

---

## Kazakhstan: `partial_or_mixed_weather` (subtle, not dramatic)

### Snapshot results (route-views2 only, 662 RIR prefixes)

| Timestamp | Role | BGP-observed | All-visible | Path families | Change from before |
|-----------|------|:---:|:---:|:---:|:---:|
| 2022-01-04 00:00 | before | 520 | 520 | 9,119 | baseline |
| 2022-01-05 10:00 | disruption | 519 | 519 | 8,976 | -1 prefix, -143 paths |
| 2022-01-05 20:00 | restoration | 511 | 511 | 8,795 | -9 prefixes, -324 paths |
| 2022-01-06 00:00 | continued | 511 | 511 | 8,766 | -9 prefixes, -353 paths |
| 2022-01-07 00:00 | recovery | 514 | 514 | 8,895 | -6 prefixes, -224 paths |

### Interpretation

**BGP changes were real but extremely subtle.** Between Jan 4 (before) and Jan 6 (continued), 9 prefixes dropped from BGP (1.7% of 520). Path family count dropped by ~350 (3.8%). By Jan 7, prefix count had partially recovered (514).

All observed prefixes remained "all-visible" (1/1 with single collector) — those that stayed announced were fully visible. There was no widespread route withdrawal event.

### Why not confirmed_red_weather

1. **520 → 511 is a 1.7% drop** — invisible on a 662-cell Hilbert map
2. **No prefixes went partially visible** — all stayed all-visible
3. **Path family count dropped 3.8%** — a real change but not dramatic
4. **The re-announce/withdraw cycles** documented by Cloudflare involved a small number of prefixes
5. **The shutdown was primarily below BGP** — route announcements were maintained while traffic was filtered

### Verdict

Kazakhstan joins Cuba as **another "shutdown below BGP" case.** The documented BGP withdrawal messages (Cloudflare) were real, but they affected a tiny fraction of the prefix set. The overwhelming majority of Kazakh prefixes remained announced throughout the shutdown window. The Kazakhstan Hilbert map would look nearly identical across all snapshots — green with very subtle changes.

**Result: `partial_or_mixed_weather`** — real but too subtle to be a flagship red-weather demo.

---

## What this tells us

Between Cuba (3 cases), Tonga, and now Kazakhstan, a clear pattern emerges:

**Most modern Internet disruptions do NOT involve widespread BGP route withdrawal.** Countries have learned that BGP-level shutdown is too visible and have shifted to:

- Forwarding-plane null-routing (keep BGP alive, silently discard traffic)  
- Centralized filtering at border gateways
- DPI/protocol whitelisting
- Access-network shutdown (power, mobile, CPE)

This means "true red-weather BGP events" may be genuinely rare in the modern era. The last well-documented widespread BGP withdrawals were:

- Egypt 2011 (complete shutdown — all routes withdrawn)
- Iran 2019 (partial — ~30% of prefixes withdrawn)
- Maybe Myanmar 2021-2024 military takeover periods

### Recommendation

**Stop searching for a contemporary red-weather event for now.** The data is telling us something important: modern shutdowns happen below BGP. Cuba's story — "BGP green while users are disrupted" — is actually the more common and more interesting pattern.

Instead of continuing to chase increasingly rare BGP-level events, lean into the Cuba narrative as the primary demo, with Tonga (partial physical-failure withdrawal) and Kazakhstan (subtle control-plane changes) as supporting cases that reinforce the same lesson:

> The Internet can fail at different layers. ReachMap shows the routing-control-plane layer — and helps you see when that layer is or is not where the disruption happened.

---

## Recommendation

**For the first red-weather demo: Kazakhstan January 2022** (pending validation).

Tonga confirms that BGP routes can partially disappear during physical infrastructure events, but the effect is subtle — going from 9 to 4 prefixes on a small Hilbert map is not visually dramatic enough for a flagship demo.

Kazakhstan has the right characteristics:
- Larger prefix set (662 RIR records = more cells on Hilbert)
- Documented BGP withdrawal + re-announcement cycles
- Political/policy narrative is stronger than a natural disaster
- More prefixes → more visual variation → more interesting weather

**Next step:** Clear disk space and process 3-4 Kazakhstan snapshots around Jan 4-7, 2022 to confirm BGP withdrawal effects.

---

## Result labels

| Label | Meaning |
|-------|---------|
| **confirmed_red_weather** | Clear BGP withdrawal producing all-red or red/yellow on Hilbert |
| **partial_or_mixed_weather** | Some BGP-level change observed but not clean all-red (Tonga) |
| **bgp_stayed_green** | No BGP change — disruption below control plane (Cuba all three cases) |
| **inconclusive** | Data or processing issues prevent determination |
