/**
 * Mocked Cuban IPv4 prefix data for the prototype.
 *
 * Based on confirmed Cuba prefixes from LACNIC delegated stats,
 * bgp.he.net, and ipinfo.io. This matches the PrefixVisualRecord
 * shape from the data artifact spec.
 *
 * Format intended to match the future pipeline output.
 */

export interface PrefixVisualRecord {
  prefix: string;
  addressFamily: "ipv4";
  countryCode: string;
  originAsns: number[];
  originNames: string[];
  prefixStart: number;   // uint32
  prefixEnd: number;     // uint32
  prefixLength: number;
  addressCount: number;
  confidence: "high" | "medium" | "low";
  observedInBgp: boolean;
}

export interface VantageVisibilityRecord {
  peerAsn: number;
  peerName: string;
  collectors: string[];
  visiblePrefixes: string[];
  missingPrefixes: string[];
}

/**
 * Known Cuban IPv4 prefixes.
 * Key: prefix string → visual record
 */
export const cubaPrefixes: PrefixVisualRecord[] = [
  // AS27725 — ETECSA (primary state telco)
  { prefix: "152.206.0.0/15",   addressFamily: "ipv4", countryCode: "CU", originAsns: [27725], originNames: ["ETECSA"], prefixStart: 2563637248, prefixEnd: 2563768319, prefixLength: 15, addressCount: 131072, confidence: "high", observedInBgp: true },
  { prefix: "190.6.64.0/20",    addressFamily: "ipv4", countryCode: "CU", originAsns: [27725], originNames: ["ETECSA"], prefixStart: 3188137984, prefixEnd: 3188142079, prefixLength: 20, addressCount: 4096, confidence: "high", observedInBgp: true },
  { prefix: "190.6.80.0/20",    addressFamily: "ipv4", countryCode: "CU", originAsns: [27725], originNames: ["ETECSA"], prefixStart: 3188142080, prefixEnd: 3188146175, prefixLength: 20, addressCount: 4096, confidence: "high", observedInBgp: true },
  { prefix: "190.15.144.0/20",  addressFamily: "ipv4", countryCode: "CU", originAsns: [27725], originNames: ["ETECSA"], prefixStart: 3188731904, prefixEnd: 3188735999, prefixLength: 20, addressCount: 4096, confidence: "high", observedInBgp: true },
  { prefix: "190.92.112.0/20",  addressFamily: "ipv4", countryCode: "CU", originAsns: [27725], originNames: ["ETECSA"], prefixStart: 3193778176, prefixEnd: 3193782271, prefixLength: 20, addressCount: 4096, confidence: "high", observedInBgp: true },
  { prefix: "181.225.224.0/19", addressFamily: "ipv4", countryCode: "CU", originAsns: [27725], originNames: ["ETECSA"], prefixStart: 3052126208, prefixEnd: 3052134399, prefixLength: 19, addressCount: 8192, confidence: "high", observedInBgp: true },
  { prefix: "200.55.128.0/19",  addressFamily: "ipv4", countryCode: "CU", originAsns: [27725], originNames: ["ETECSA"], prefixStart: 3359997952, prefixEnd: 3360006143, prefixLength: 19, addressCount: 8192, confidence: "high", observedInBgp: true },
  { prefix: "200.55.160.0/20",  addressFamily: "ipv4", countryCode: "CU", originAsns: [27725], originNames: ["ETECSA"], prefixStart: 3360006144, prefixEnd: 3360010239, prefixLength: 20, addressCount: 4096, confidence: "high", observedInBgp: true },
  { prefix: "201.220.128.0/19", addressFamily: "ipv4", countryCode: "CU", originAsns: [27725], originNames: ["ETECSA"], prefixStart: 3386646528, prefixEnd: 3386654719, prefixLength: 19, addressCount: 8192, confidence: "high", observedInBgp: true },

  // AS11960 — ETECSA IXP
  { prefix: "200.0.16.0/24",    addressFamily: "ipv4", countryCode: "CU", originAsns: [11960], originNames: ["ETECSA IXP"], prefixStart: 3355455488, prefixEnd: 3355455743, prefixLength: 24, addressCount: 256, confidence: "high", observedInBgp: true },

  // AS10569 — CENIAInternet
  { prefix: "169.158.0.0/16",   addressFamily: "ipv4", countryCode: "CU", originAsns: [10569], originNames: ["CENIAInternet"], prefixStart: 2845835264, prefixEnd: 2845900799, prefixLength: 16, addressCount: 65536, confidence: "high", observedInBgp: true },

  // Additional smaller ETECSA allocations (based on LACNIC records)
  { prefix: "190.6.96.0/20",    addressFamily: "ipv4", countryCode: "CU", originAsns: [27725], originNames: ["ETECSA"], prefixStart: 3188146176, prefixEnd: 3188150271, prefixLength: 20, addressCount: 4096, confidence: "high", observedInBgp: true },
  { prefix: "190.6.112.0/20",   addressFamily: "ipv4", countryCode: "CU", originAsns: [27725], originNames: ["ETECSA"], prefixStart: 3188150272, prefixEnd: 3188154367, prefixLength: 20, addressCount: 4096, confidence: "medium", observedInBgp: false },
  { prefix: "201.220.144.0/20", addressFamily: "ipv4", countryCode: "CU", originAsns: [27725], originNames: ["ETECSA"], prefixStart: 3386650624, prefixEnd: 3386654719, prefixLength: 20, addressCount: 4096, confidence: "medium", observedInBgp: false },
];

/**
 * Mocked vantage data for the prototype.
 * Represents what different peer ASNs see of Cuban space.
 */
export const mockVantages: VantageVisibilityRecord[] = [
  {
    peerAsn: 7018,
    peerName: "AT&T",
    collectors: ["route-views2", "route-views4"],
    visiblePrefixes: [
      "152.206.0.0/15", "190.6.64.0/20", "190.6.80.0/20",
      "190.15.144.0/20", "190.92.112.0/20", "181.225.224.0/19",
      "200.55.128.0/19", "200.55.160.0/20", "201.220.128.0/19",
      "169.158.0.0/16", "200.0.16.0/24",
    ],
    missingPrefixes: ["190.6.96.0/20", "190.6.112.0/20", "201.220.144.0/20"],
  },
  {
    peerAsn: 3356,
    peerName: "Lumen / Level3",
    collectors: ["route-views2", "route-views6"],
    visiblePrefixes: [
      "152.206.0.0/15", "190.6.64.0/20", "190.6.80.0/20",
      "190.15.144.0/20", "190.92.112.0/20", "181.225.224.0/19",
      "200.55.128.0/19", "200.55.160.0/20", "201.220.128.0/19",
      "169.158.0.0/16", "200.0.16.0/24", "190.6.96.0/20",
    ],
    missingPrefixes: ["190.6.112.0/20", "201.220.144.0/20"],
  },
  {
    peerAsn: 174,
    peerName: "Cogent",
    collectors: ["route-views2"],
    visiblePrefixes: [
      "152.206.0.0/15", "190.6.64.0/20", "190.15.144.0/20",
      "181.225.224.0/19", "200.55.128.0/19", "201.220.128.0/19",
      "169.158.0.0/16",
    ],
    missingPrefixes: [
      "190.6.80.0/20", "190.92.112.0/20", "200.55.160.0/20",
      "200.0.16.0/24", "190.6.96.0/20", "190.6.112.0/20", "201.220.144.0/20",
    ],
  },
];

/**
 * Build a lookup map: prefix string → PrefixVisualRecord
 */
export function buildPrefixMap(): Map<string, PrefixVisualRecord> {
  const map = new Map<string, PrefixVisualRecord>();
  for (const p of cubaPrefixes) {
    map.set(p.prefix, p);
  }
  return map;
}

/**
 * Build a lookup map: vantage ASN → VantageVisibilityRecord
 */
export function buildVantageMap(): Map<number, VantageVisibilityRecord> {
  const map = new Map<number, VantageVisibilityRecord>();
  for (const v of mockVantages) {
    map.set(v.peerAsn, v);
  }
  return map;
}

/** Path family data — shared across all vantages for the prototype */
export interface PathFamilyRecord {
  id: string;
  path: number[];
  upstreamAsn: number;
  originAsn: number;
  prefixes: string[];
  collectorCount: number;
}

export const mockPathFamilies: PathFamilyRecord[] = [
  {
    id: "pf-001",
    path: [7018, 3356, 27725],
    upstreamAsn: 3356,
    originAsn: 27725,
    prefixes: ["152.206.0.0/15", "190.6.64.0/20", "190.15.144.0/20", "200.55.128.0/19"],
    collectorCount: 3,
  },
  {
    id: "pf-002",
    path: [7018, 1299, 3356, 27725],
    upstreamAsn: 1299,
    originAsn: 27725,
    prefixes: ["190.6.80.0/20", "190.92.112.0/20", "201.220.128.0/19"],
    collectorCount: 2,
  },
  {
    id: "pf-003",
    path: [7018, 174, 27725],
    upstreamAsn: 174,
    originAsn: 27725,
    prefixes: ["181.225.224.0/19", "200.55.160.0/20", "190.6.96.0/20"],
    collectorCount: 2,
  },
  {
    id: "pf-004",
    path: [7018, 6939, 11960, 27725],
    upstreamAsn: 6939,
    originAsn: 11960,
    prefixes: ["200.0.16.0/24"],
    collectorCount: 1,
  },
  {
    id: "pf-005",
    path: [3356, 10569],
    upstreamAsn: 3356,
    originAsn: 10569,
    prefixes: ["169.158.0.0/16"],
    collectorCount: 2,
  },
];

/** Get path families for a specific vantage + visible prefix set */
export function getVisiblePathFamilies(
  visiblePrefixes: string[]
): PathFamilyRecord[] {
  const visibleSet = new Set(visiblePrefixes);
  return mockPathFamilies.filter(pf =>
    pf.prefixes.some(p => visibleSet.has(p))
  );
}
