#!/usr/bin/env python3
"""Generate ASN catalog from processed ReachMap artifacts.

Collects all ASNs seen in path families, prefixes, and peer observations,
enriches with name overrides, and outputs a structured catalog.
"""

import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone

def main():
    base = sys.argv[1] if len(sys.argv) > 1 else "data/processed/countries/CU"
    overrides_path = "config/asn-name-overrides.json"
    out_path = os.path.join(base, "asn-catalog.json")

    # Load name overrides
    overrides = {}
    if os.path.exists(overrides_path):
        with open(overrides_path) as f:
            overrides = json.load(f)

    # Collect all ASNs with appearances
    asn_data = defaultdict(lambda: {
        "origin": False, "transit": False, "peer": False, "collectorPeer": False,
        "pathFamilyCount": 0, "prefixCount": 0, "collectorCount": 0, "observationCount": 0,
    })

    # 1. Path families
    pf_path = os.path.join(base, "path-families.json")
    if os.path.exists(pf_path):
        with open(pf_path) as f:
            pfs = json.load(f)
        for pf in pfs:
            path = pf.get("normalizedPath", [])
            prefixes = pf.get("prefixes", [])
            collectors = pf.get("collectors", [])

            # First ASN = peer
            if path:
                asn_data[path[0]]["peer"] = True
                asn_data[path[0]]["pathFamilyCount"] += 1

            # Last ASN = origin
            if path:
                asn_data[path[-1]]["origin"] = True
                asn_data[path[-1]]["prefixCount"] += len(prefixes)
                asn_data[path[-1]]["pathFamilyCount"] += 1

            # Middle ASNs = transit
            for asn in path[1:-1]:
                asn_data[asn]["transit"] = True
                asn_data[asn]["pathFamilyCount"] += 1

    # 2. Prefixes
    pfx_path = os.path.join(base, "prefixes.json")
    if os.path.exists(pfx_path):
        with open(pfx_path) as f:
            pfx_data = json.load(f)
        for pfx in pfx_data.get("prefixes", []):
            for asn in pfx.get("originAsns", []):
                asn_data[asn]["origin"] = True

    # 3. Peer observations
    po_dir = os.path.join(base, "peer-observations")
    if os.path.isdir(po_dir):
        for fname in os.listdir(po_dir):
            if fname == "index.json" or not fname.endswith(".json"):
                continue
            with open(os.path.join(po_dir, fname)) as f:
                po = json.load(f)
            asn = po.get("peerAsn", 0)
            if asn > 0:
                asn_data[asn]["collectorPeer"] = True
                asn_data[asn]["observationCount"] += 1
                asn_data[asn]["prefixCount"] = max(
                    asn_data[asn]["prefixCount"],
                    len(po.get("visiblePrefixes", []))
                )

    # Build catalog
    entries = []
    for asn in sorted(asn_data.keys()):
        if asn == 0:
            continue
        data = asn_data[asn]
        name = overrides.get(str(asn))
        entries.append({
            "asn": asn,
            "displayName": name if name else None,
            "source": "manual_override" if name else "unknown",
            "appearances": {
                "origin": data["origin"],
                "transit": data["transit"],
                "peer": data["peer"],
                "collectorPeer": data["collectorPeer"],
            },
            "stats": {
                "pathFamilyCount": data["pathFamilyCount"],
                "prefixCount": data["prefixCount"],
                "collectorCount": data["collectorCount"],
                "observationCount": data["observationCount"],
            },
        })

    catalog = {
        "countryCode": "CU",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sources": [
            {"type": "manual_override", "path": overrides_path, "count": len(overrides)},
        ],
        "totalAsns": len(entries),
        "namedAsns": sum(1 for e in entries if e["displayName"]),
        "asns": entries,
    }

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(catalog, f, indent=2)

    print(f"Generated ASN catalog: {out_path}")
    print(f"  Total ASNs: {len(entries)}")
    print(f"  Named (from overrides): {catalog['namedAsns']}")
    print(f"  Origins: {sum(1 for e in entries if e['appearances']['origin'])}")
    print(f"  Transit: {sum(1 for e in entries if e['appearances']['transit'])}")
    print(f"  Peers: {sum(1 for e in entries if e['appearances']['peer'])}")
    print(f"  Collector peers: {sum(1 for e in entries if e['appearances']['collectorPeer'])}")

if __name__ == "__main__":
    main()
