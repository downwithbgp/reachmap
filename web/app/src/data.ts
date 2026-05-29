import type { Viewpoint, AsView, PathFamilyRecord, PrefixRecord, GeoKind } from "./types";

// ── Cuban IPv4 Prefixes ──────────────────────────────────────

export const cubaPrefixes: PrefixRecord[] = [
  { prefix: "152.206.0.0/15",   prefixStart: 2563637248, prefixEnd: 2563768319, prefixLength: 15, addressCount: 131072, originAsns: [27725], originNames: ["ETECSA"], observedInBgp: true, confidence: "high" },
  { prefix: "190.6.64.0/20",    prefixStart: 3188137984, prefixEnd: 3188142079, prefixLength: 20, addressCount: 4096,   originAsns: [27725], originNames: ["ETECSA"], observedInBgp: true, confidence: "high" },
  { prefix: "190.6.80.0/20",    prefixStart: 3188142080, prefixEnd: 3188146175, prefixLength: 20, addressCount: 4096,   originAsns: [27725], originNames: ["ETECSA"], observedInBgp: true, confidence: "high" },
  { prefix: "190.15.144.0/20",  prefixStart: 3188731904, prefixEnd: 3188735999, prefixLength: 20, addressCount: 4096,   originAsns: [27725], originNames: ["ETECSA"], observedInBgp: true, confidence: "high" },
  { prefix: "190.92.112.0/20",  prefixStart: 3193778176, prefixEnd: 3193782271, prefixLength: 20, addressCount: 4096,   originAsns: [27725], originNames: ["ETECSA"], observedInBgp: true, confidence: "high" },
  { prefix: "181.225.224.0/19", prefixStart: 3052126208, prefixEnd: 3052134399, prefixLength: 19, addressCount: 8192,   originAsns: [27725], originNames: ["ETECSA"], observedInBgp: true, confidence: "high" },
  { prefix: "200.55.128.0/19",  prefixStart: 3359997952, prefixEnd: 3360006143, prefixLength: 19, addressCount: 8192,   originAsns: [27725], originNames: ["ETECSA"], observedInBgp: true, confidence: "high" },
  { prefix: "200.55.160.0/20",  prefixStart: 3360006144, prefixEnd: 3360010239, prefixLength: 20, addressCount: 4096,   originAsns: [27725], originNames: ["ETECSA"], observedInBgp: true, confidence: "high" },
  { prefix: "201.220.128.0/19", prefixStart: 3386646528, prefixEnd: 3386654719, prefixLength: 19, addressCount: 8192,   originAsns: [27725], originNames: ["ETECSA"], observedInBgp: true, confidence: "high" },
  { prefix: "200.0.16.0/24",    prefixStart: 3355455488, prefixEnd: 3355455743, prefixLength: 24, addressCount: 256,    originAsns: [11960], originNames: ["ETECSA IXP"], observedInBgp: true, confidence: "high" },
  { prefix: "169.158.0.0/16",   prefixStart: 2845835264, prefixEnd: 2845900799, prefixLength: 16, addressCount: 65536,  originAsns: [10569], originNames: ["CENIAInternet"], observedInBgp: true, confidence: "high" },
  { prefix: "190.6.96.0/20",    prefixStart: 3188146176, prefixEnd: 3188150271, prefixLength: 20, addressCount: 4096,   originAsns: [27725], originNames: ["ETECSA"], observedInBgp: true, confidence: "high" },
  { prefix: "190.6.112.0/20",   prefixStart: 3188150272, prefixEnd: 3188154367, prefixLength: 20, addressCount: 4096,   originAsns: [27725], originNames: ["ETECSA"], observedInBgp: false, confidence: "medium" },
  { prefix: "201.220.144.0/20", prefixStart: 3386650624, prefixEnd: 3386654719, prefixLength: 20, addressCount: 4096,   originAsns: [27725], originNames: ["ETECSA"], observedInBgp: false, confidence: "medium" },
];

// ── Helper to build a geo object ─────────────────────────────
function geo(kind: GeoKind, source: string, lat: number, lon: number, city: string, region: string, cc: string, conf: number, prec: string, note?: string) {
  return { kind, source, latitude: lat, longitude: lon, city, region, countryCode: cc, confidence: conf, precision: prec, note: note ?? null };
}

const NA_VISIBLE = ["152.206.0.0/15","190.6.64.0/20","190.6.80.0/20","190.15.144.0/20","190.92.112.0/20","181.225.224.0/19","200.55.128.0/19","200.55.160.0/20","201.220.128.0/19","200.0.16.0/24","169.158.0.0/16","190.6.96.0/20"];
const NA_MISSING = ["190.6.112.0/20","201.220.144.0/20"];
const EU_VISIBLE = ["152.206.0.0/15","190.6.64.0/20","190.15.144.0/20","181.225.224.0/19","200.55.128.0/19","201.220.128.0/19","169.158.0.0/16","190.6.96.0/20"];
const EU_MISSING = ["190.6.80.0/20","190.92.112.0/20","200.55.160.0/20","200.0.16.0/24","190.6.112.0/20","201.220.144.0/20"];
const SA_VISIBLE = ["152.206.0.0/15","190.6.64.0/20","190.15.144.0/20","181.225.224.0/19","200.55.128.0/19","169.158.0.0/16"];
const SA_MISSING = ["190.6.80.0/20","190.92.112.0/20","200.55.160.0/20","201.220.128.0/19","200.0.16.0/24","190.6.96.0/20","190.6.112.0/20","201.220.144.0/20"];

export const viewpoints: Viewpoint[] = [
  {
    id: "vp-att-mia", collector: "route-views2", peerAsn: 7018, peerAsName: "AT&T", peerIp: "12.0.1.63",
    geo: geo("peer_ip_geo", "mock", 25.76, -80.19, "Miami", "Florida", "US", 0.70, "city", "Mock: peer IP geolocation"),
    displayName: "AT&T / Miami", regionGroup: "North America",
    visiblePrefixes: NA_VISIBLE, missingPrefixes: NA_MISSING, pathFamilyIds: ["pf-001","pf-002","pf-003","pf-004"],
  },
  {
    id: "vp-att-dal", collector: "route-views2", peerAsn: 7018, peerAsName: "AT&T", peerIp: "12.0.1.64",
    geo: geo("peer_ip_geo", "mock", 32.78, -96.80, "Dallas", "Texas", "US", 0.65, "city", "Mock: peer IP geolocation"),
    displayName: "AT&T / Dallas", regionGroup: "North America",
    visiblePrefixes: NA_VISIBLE, missingPrefixes: NA_MISSING, pathFamilyIds: ["pf-001","pf-002","pf-003"],
  },
  {
    id: "vp-lumen-co", collector: "route-views4", peerAsn: 3356, peerAsName: "Lumen/L3",
    geo: geo("collector_location", "mock", 39.74, -104.99, "Denver", "Colorado", "US", 0.85, "exact", "Mock: collector location"),
    displayName: "Lumen / Denver", regionGroup: "North America",
    visiblePrefixes: [...NA_VISIBLE, "190.6.112.0/20"], missingPrefixes: ["201.220.144.0/20"], pathFamilyIds: ["pf-001","pf-005"],
  },
  {
    id: "vp-cogent-dc", collector: "route-views2", peerAsn: 174, peerAsName: "Cogent",
    geo: geo("peer_ip_geo", "mock", 38.91, -77.04, "Washington DC", "", "US", 0.60, "city", "Mock: peer IP geolocation"),
    displayName: "Cogent / Washington DC", regionGroup: "North America",
    visiblePrefixes: ["152.206.0.0/15","190.6.64.0/20","190.15.144.0/20","181.225.224.0/19","200.55.128.0/19","201.220.128.0/19","169.158.0.0/16"],
    missingPrefixes: ["190.6.80.0/20","190.92.112.0/20","200.55.160.0/20","200.0.16.0/24","190.6.96.0/20","190.6.112.0/20","201.220.144.0/20"],
    pathFamilyIds: ["pf-003"],
  },
  {
    id: "vp-rv2-eugene", collector: "route-views2", peerAsn: 0, peerAsName: "RouteViews2",
    geo: geo("collector_location", "mock", 44.05, -123.09, "Eugene", "Oregon", "US", 0.95, "exact", "Mock: collector location"),
    displayName: "RouteViews2 (collector)", regionGroup: "North America",
    visiblePrefixes: NA_VISIBLE, missingPrefixes: NA_MISSING, pathFamilyIds: ["pf-001","pf-002","pf-003","pf-004"],
  },
  {
    id: "vp-telebras", collector: "route-views4", peerAsn: 52873, peerAsName: "Telebras",
    geo: geo("peer_ip_geo", "mock", -15.79, -47.88, "Brasília", "", "BR", 0.55, "city", "Mock: peer IP geolocation"),
    displayName: "Telebras / Brasília", regionGroup: "South America",
    visiblePrefixes: SA_VISIBLE, missingPrefixes: SA_MISSING, pathFamilyIds: ["pf-001","pf-003"],
  },
  {
    id: "vp-lumen-sp", collector: "route-views6", peerAsn: 3356, peerAsName: "Lumen/L3",
    geo: geo("peer_ip_geo", "mock", -23.55, -46.63, "São Paulo", "", "BR", 0.60, "city", "Mock: peer IP geolocation"),
    displayName: "Lumen / São Paulo", regionGroup: "South America",
    visiblePrefixes: [...SA_VISIBLE, "190.92.112.0/20","201.220.128.0/19"],
    missingPrefixes: ["190.6.80.0/20","200.55.160.0/20","200.0.16.0/24","190.6.96.0/20","190.6.112.0/20","201.220.144.0/20"],
    pathFamilyIds: ["pf-001","pf-005"],
  },
  {
    id: "vp-telefonica", collector: "rrc00", peerAsn: 12956, peerAsName: "Telefónica",
    geo: geo("peer_ip_geo", "mock", 40.42, -3.70, "Madrid", "", "ES", 0.65, "city", "Mock: peer IP geolocation"),
    displayName: "Telefónica / Madrid", regionGroup: "Europe",
    visiblePrefixes: EU_VISIBLE, missingPrefixes: EU_MISSING, pathFamilyIds: ["pf-001","pf-003"],
  },
  {
    id: "vp-dtag", collector: "rrc03", peerAsn: 3320, peerAsName: "DTAG",
    geo: geo("peer_ip_geo", "mock", 50.11, 8.68, "Frankfurt", "", "DE", 0.65, "city", "Mock: peer IP geolocation"),
    displayName: "DTAG / Frankfurt", regionGroup: "Europe",
    visiblePrefixes: [...EU_VISIBLE, "190.92.112.0/20"],
    missingPrefixes: ["190.6.80.0/20","200.55.160.0/20","200.0.16.0/24","190.6.112.0/20","201.220.144.0/20"],
    pathFamilyIds: ["pf-001","pf-002"],
  },
  {
    id: "vp-rrc00", collector: "rrc00", peerAsn: 0, peerAsName: "RIPE RIS rrc00",
    geo: geo("collector_location", "mock", 52.37, 4.90, "Amsterdam", "Noord-Holland", "NL", 0.95, "exact", "Mock: collector location"),
    displayName: "RIPE rrc00 (collector)", regionGroup: "Europe",
    visiblePrefixes: EU_VISIBLE, missingPrefixes: EU_MISSING, pathFamilyIds: ["pf-001","pf-003"],
  },
];

// ── AS Aggregates ────────────────────────────────────────────

export const asViews: AsView[] = [
  { peerAsn: 7018, peerAsName: "AT&T", viewpointIds: ["vp-att-mia","vp-att-dal"], visiblePrefixes: NA_VISIBLE, missingPrefixes: NA_MISSING, pathFamilyIds: ["pf-001","pf-002","pf-003","pf-004"] },
  { peerAsn: 3356, peerAsName: "Lumen/L3", viewpointIds: ["vp-lumen-co","vp-lumen-sp"], visiblePrefixes: [...new Set([...NA_VISIBLE,"190.6.112.0/20","190.92.112.0/20","201.220.128.0/19"])], missingPrefixes: ["200.0.16.0/24","201.220.144.0/20"], pathFamilyIds: ["pf-001","pf-005"] },
  { peerAsn: 174, peerAsName: "Cogent", viewpointIds: ["vp-cogent-dc"], visiblePrefixes: ["152.206.0.0/15","190.6.64.0/20","190.15.144.0/20","181.225.224.0/19","200.55.128.0/19","201.220.128.0/19","169.158.0.0/16"], missingPrefixes: ["190.6.80.0/20","190.92.112.0/20","200.55.160.0/20","200.0.16.0/24","190.6.96.0/20","190.6.112.0/20","201.220.144.0/20"], pathFamilyIds: ["pf-003"] },
  { peerAsn: 12956, peerAsName: "Telefónica", viewpointIds: ["vp-telefonica"], visiblePrefixes: EU_VISIBLE, missingPrefixes: EU_MISSING, pathFamilyIds: ["pf-001","pf-003"] },
  { peerAsn: 3320, peerAsName: "DTAG", viewpointIds: ["vp-dtag"], visiblePrefixes: [...EU_VISIBLE,"190.92.112.0/20"], missingPrefixes: ["190.6.80.0/20","200.55.160.0/20","200.0.16.0/24","190.6.112.0/20","201.220.144.0/20"], pathFamilyIds: ["pf-001","pf-002"] },
  { peerAsn: 52873, peerAsName: "Telebras", viewpointIds: ["vp-telebras"], visiblePrefixes: SA_VISIBLE, missingPrefixes: SA_MISSING, pathFamilyIds: ["pf-001","pf-003"] },
];

// ── Path Families ────────────────────────────────────────────

export const pathFamilies: PathFamilyRecord[] = [
  { id: "pf-001", path: [7018,3356,27725], upstreamAsn: 3356, originAsn: 27725, prefixes: ["152.206.0.0/15","190.6.64.0/20","190.15.144.0/20","200.55.128.0/19"], collectorCount: 3 },
  { id: "pf-002", path: [7018,1299,3356,27725], upstreamAsn: 1299, originAsn: 27725, prefixes: ["190.6.80.0/20","190.92.112.0/20","201.220.128.0/19"], collectorCount: 2 },
  { id: "pf-003", path: [7018,174,27725], upstreamAsn: 174, originAsn: 27725, prefixes: ["181.225.224.0/19","200.55.160.0/20","190.6.96.0/20"], collectorCount: 2 },
  { id: "pf-004", path: [7018,6939,11960,27725], upstreamAsn: 6939, originAsn: 11960, prefixes: ["200.0.16.0/24"], collectorCount: 1 },
  { id: "pf-005", path: [3356,10569], upstreamAsn: 3356, originAsn: 10569, prefixes: ["169.158.0.0/16"], collectorCount: 2 },
];

// ── Helpers ───────────────────────────────────────────────────

export function getViewpoint(id: string): Viewpoint | undefined { return viewpoints.find(v => v.id === id); }
export function getAsView(asn: number): AsView | undefined { return asViews.find(a => a.peerAsn === asn); }
export function getViewpointsForAsn(_asn: number): Viewpoint[] { return []; }
export function getPathFamily(id: string): PathFamilyRecord | undefined { return pathFamilies.find(p => p.id === id); }
export function getVisiblePathFamilies(visiblePrefixes: string[]): PathFamilyRecord[] {
  const s = new Set(visiblePrefixes);
  return pathFamilies.filter(pf => pf.prefixes.some(p => s.has(p)));
}
