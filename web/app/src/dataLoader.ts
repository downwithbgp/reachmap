/**
 * Data loader: loads real pipeline artifacts and normalizes them
 * to the integrated app's expected types.
 */

import type { PrefixRecord, Viewpoint, AsView, PathFamilyRecord, GeoKind, ConsensusVisibility, TimelineIndex } from "./types";

// ── Real data JSON shapes (from Rust pipeline) ──────────────

interface RealPrefix {
  prefix: string;
  prefixStart: number;
  prefixEnd: number;
  prefixLength: number;
  addressCount: number;
  originAsns: number[];
  originNames: string[];
  observedInBgp: boolean;
  confidence: string;
  rirStatus: string;
}

interface RealPrefixesFile {
  countryCode: string;
  countryName: string;
  prefixes: RealPrefix[];
}

interface RealSnapshot {
  source: string;
  collector: string;
  ribTimestamp: string;
  downloadedAt: string;
  mrtFilename: string;
}

interface RealViewpoint {
  id: string;
  collector: string;
  peerAsn: number;
  peerAsName: string | null;
  peerIp: string | null;
  geo: {
    kind: string;
    source: string;
    sourceVersion?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    city?: string | null;
    region?: string | null;
    countryCode?: string | null;
    continent?: string | null;
    confidence: number;
    precision?: string | null;
    note?: string | null;
  };
  displayName: string;
  regionGroup: string;
  visiblePrefixes: string[];
  missingPrefixes: string[];
  pathFamilyIds: string[];
  snapshot: RealSnapshot;
}

interface RealAsView {
  peerAsn: number;
  peerAsName: string | null;
  viewpointIds: string[];
  visiblePrefixes: string[];
  missingPrefixes: string[];
  pathFamilyIds: string[];
}

interface RealPathFamily {
  id: string;
  normalizedPath: number[];
  upstreamAsn: number;
  originAsn: number;
  prefixes: string[];
  collectors: string[];
  observationCount: number;
}

// ── Loader functions ────────────────────────────────────────

const BASE = "/data/CU";

export async function loadRealPrefixes(): Promise<PrefixRecord[]> {
  const res = await fetch(`${BASE}/prefixes.json`);
  const data: RealPrefixesFile = await res.json();
  return data.prefixes.map(p => ({
    prefix: p.prefix,
    prefixStart: p.prefixStart,
    prefixEnd: p.prefixEnd,
    prefixLength: p.prefixLength,
    addressCount: p.addressCount,
    originAsns: p.originAsns,
    originNames: p.originNames.length > 0 ? p.originNames : p.originAsns.map(() => "unknown"),
    observedInBgp: p.observedInBgp,
    confidence: p.confidence,
  }));
}

export async function loadRealViewpoints(): Promise<Viewpoint[]> {
  const idxRes = await fetch(`${BASE}/vantages/index.json`);
  const idx = await idxRes.json();

  const vps: Viewpoint[] = [];
  for (const id of idx.viewpointIds) {
    const res = await fetch(`${BASE}/vantages/${id}.json`);
    const rv: RealViewpoint = await res.json();
    vps.push({
      id: rv.id,
      collector: rv.collector,
      peerAsn: rv.peerAsn,
      peerAsName: rv.peerAsName ?? undefined,
      peerIp: rv.peerIp ?? undefined,
      geo: {
        kind: rv.geo.kind as GeoKind,
        source: rv.geo.source,
        sourceVersion: rv.geo.sourceVersion ?? undefined,
        sourceUrl: undefined,
        latitude: rv.geo.latitude ?? null,
        longitude: rv.geo.longitude ?? null,
        city: rv.geo.city ?? null,
        region: rv.geo.region ?? null,
        countryCode: rv.geo.countryCode ?? null,
        continent: rv.geo.continent ?? null,
        confidence: rv.geo.confidence,
        precision: rv.geo.precision ?? null,
        note: rv.geo.note ?? null,
      },
      displayName: rv.displayName,
      regionGroup: rv.regionGroup as Viewpoint["regionGroup"],
      visiblePrefixes: rv.visiblePrefixes,
      missingPrefixes: rv.missingPrefixes,
      pathFamilyIds: rv.pathFamilyIds,
    });
  }
  return vps;
}

export async function loadRealAsViews(): Promise<AsView[]> {
  const idxRes = await fetch(`${BASE}/asns/index.json`);
  const idx = await idxRes.json();

  const asvs: AsView[] = [];
  for (const asn of idx.asns) {
    const res = await fetch(`${BASE}/asns/AS${asn}.json`);
    const ra: RealAsView = await res.json();
    asvs.push({
      peerAsn: ra.peerAsn,
      peerAsName: ra.peerAsName ?? undefined,
      viewpointIds: ra.viewpointIds,
      visiblePrefixes: ra.visiblePrefixes,
      missingPrefixes: ra.missingPrefixes,
      pathFamilyIds: ra.pathFamilyIds,
    });
  }
  return asvs;
}

export async function loadRealPathFamilies(): Promise<PathFamilyRecord[]> {
  const res = await fetch(`${BASE}/path-families.json`);
  const data: RealPathFamily[] = await res.json();
  return data.map(pf => ({
    id: pf.id,
    path: pf.normalizedPath,  // rename to match app's expected field
    upstreamAsn: pf.upstreamAsn,
    originAsn: pf.originAsn,
    prefixes: pf.prefixes,
    collectorCount: pf.collectors.length, // derive from collectors array
  }));
}

/** Load consensus visibility data */
export async function loadConsensusData(): Promise<ConsensusVisibility | null> {
  try {
    const res = await fetch(`${BASE}/visibility/consensus-all.json`);
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}
export async function loadAllRealData(): Promise<{
  prefixes: PrefixRecord[];
  viewpoints: Viewpoint[];
  asViews: AsView[];
  pathFamilies: PathFamilyRecord[];
}> {
  const [prefixes, viewpoints, asViews, pathFamilies] = await Promise.all([
    loadRealPrefixes(),
    loadRealViewpoints(),
    loadRealAsViews(),
    loadRealPathFamilies(),
  ]);
  return { prefixes, viewpoints, asViews, pathFamilies };
}

/**
 * In real data, viewpoints list BGP-observed sub-prefixes (e.g., "152.206.0.0/17")
 * while LACNIC lists allocation prefixes (e.g., "152.206.0.0/14").
 * Check visibility by IP range overlap rather than exact string match.
 */
export function buildRealVisibilitySet(
  visiblePrefixes: string[],
  allPrefixes: PrefixRecord[]
): Set<string> {
  // Parse all visible BGP prefixes into (start, end) ranges
  const visRanges: [number, number][] = [];
  for (const pfx of visiblePrefixes) {
    const [ipStr, bitsStr] = pfx.split("/");
    if (!ipStr || !bitsStr) continue;
    const ip = ipv4ToU32(ipStr);
    const bits = parseInt(bitsStr);
    if (isNaN(ip) || isNaN(bits)) continue;
    const mask = bits === 0 ? 0 : (~0) << (32 - bits);
    const start = ip & mask;
    const end = start + (1 << (32 - bits)) - 1;
    visRanges.push([start >>> 0, end >>> 0]);
  }

  // Check which LACNIC prefixes overlap with any visible BGP prefix
  const visible = new Set<string>();
  for (const p of allPrefixes) {
    for (const [vs, ve] of visRanges) {
      if (p.prefixStart <= ve && p.prefixEnd >= vs) {
        visible.add(p.prefix);
        break;
      }
    }
  }
  return visible;
}

function ipv4ToU32(ip: string): number {
  const parts = ip.split(".");
  if (parts.length !== 4) return NaN;
  return ((+parts[0] << 24) | (+parts[1] << 16) | (+parts[2] << 8) | +parts[3]) >>> 0;
}

// ── Timeline loading ─────────────────────────────────────────

const TL_BASE = "/data/CU/timeline";

export async function loadTimelineIndex(caseId = "mar2026"): Promise<TimelineIndex | null> {
  try {
    let res = await fetch(`${TL_BASE}/${caseId}/index.json`);
    if (!res.ok) res = await fetch(`${TL_BASE}/index.json`);
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export async function loadTimelineConsensus(snapshotId: string): Promise<ConsensusVisibility | null> {
  try {
    const res = await fetch(`${TL_BASE}/${snapshotId}/visibility/consensus-all.json`);
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export async function loadTimelinePrefixes(snapshotId: string): Promise<PrefixRecord[] | null> {
  try {
    const res = await fetch(`${TL_BASE}/${snapshotId}/prefixes.json`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.prefixes;
  } catch { return null; }
}
