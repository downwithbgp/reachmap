/** Shared types for the integrated ReachMap prototype. */

export type GeoKind = "collector_location" | "peer_ip_geo" | "ixp_facility" | "manual" | "asn_headquarters" | "unknown";
export type RegionGroup = "North America" | "Caribbean" | "Central America" | "South America" | "Europe" | "Africa" | "Asia" | "Oceania" | "Other" | "Unknown";
export type SelectionMode = "viewpoint" | "asn_aggregate" | "all";

/** Geolocation resolution with explicit provenance */
export interface GeoResolution {
  kind: GeoKind;
  source: string;
  sourceVersion?: string;
  sourceUrl?: string;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  region?: string | null;
  countryCode?: string | null;
  continent?: string | null;
  confidence: number;
  precision?: string | null;
  note?: string | null;
}

export interface Viewpoint {
  id: string;
  collector: string;
  peerAsn: number;
  peerAsName?: string;
  peerIp?: string;
  geo: GeoResolution;
  displayName: string;
  regionGroup: RegionGroup;
  visiblePrefixes: string[];
  missingPrefixes: string[];
  pathFamilyIds: string[];
}

export interface AsView {
  peerAsn: number;
  peerAsName?: string;
  viewpointIds: string[];
  visiblePrefixes: string[];
  missingPrefixes: string[];
  pathFamilyIds: string[];
}

export interface PathFamilyRecord {
  id: string;
  path: number[];
  upstreamAsn: number;
  originAsn: number;
  prefixes: string[];
  collectorCount: number;
}

export interface PrefixRecord {
  prefix: string;
  prefixStart: number;
  prefixEnd: number;
  prefixLength: number;
  addressCount: number;
  originAsns: number[];
  originNames: string[];
  observedInBgp: boolean;
  confidence: string;
}

/** ASN metadata from loaded artifact */
export interface AsnMetadata {
  asn: number;
  displayName: string;
  role?: "origin" | "transit" | "peer" | "collector_peer" | "unknown";
}

/** Top-level app manifest */
export interface AppManifest {
  version: string;
  generatedAt: string;
  defaultCountry: string;
  defaultCase: string;
  countries: CountryEntry[];
}

export interface CountryEntry {
  countryCode: string;
  name: string;
  demonym?: string;
  dataRoot: string;
  mapConfigPath: string;
  casesPath: string;
  asnCatalogPath: string;
}

/** Country map configuration */
export interface CountryMapConfig {
  countryCode: string;
  name: string;
  demonym?: string;
  addressFamilyDefault?: string;
  map: {
    center: { longitude: number; latitude: number };
    view: { longitude: number; latitude: number; zoom: number; pitch: number; bearing: number };
  };
}

/** Case study entry from cases.json */
export interface CaseEntry {
  caseStudyId: string;
  countryCode?: string;
  caseStudyTitle: string;
  label?: string;
  caseType: string;
  primary: boolean;
  snapshotCount: number;
  indexPath?: string;
  timelinePath?: string;
  defaultSnapshotId?: string;
  narrative?: string;
  externalSignal?: ExternalSignalEntry;
  sources?: { name: string; url?: string; description?: string }[];
}

export interface ExternalSignalEntry {
  source: string;
  label: string;
  value: string;
  display: "stable" | "degraded" | "partial";
  note?: string;
}

/** Color mode for the Hilbert fingerprint */
export type ColorMode = "consensus" | "origin" | "selected";

/** Per-prefix visibility score from consensus artifact */
export interface PrefixVisibilityScore {
  prefix: string;
  observedCollectors: number;
  totalCollectors: number;
  visibilityRatio: number;
  observedCollectorIds: string[];
  missingCollectorIds: string[];
}

/** Consensus visibility artifact */
export interface ConsensusVisibility {
  scope: string;
  collectorIds: string[];
  totalCollectors: number;
  visibilityByPrefix: Record<string, PrefixVisibilityScore>;
}

/** Timeline point summary */
export interface TimelinePoint {
  snapshotId: string;
  timestamp: string;
  role: "before" | "pre_event" | "event" | "after" | "recovered";
  collectorCount: number;
  collectorIds: string[];
  totalPrefixCount: number;
  observedPrefixCount: number;
  allCollectorVisibleCount: number;
  partialVisibleCount: number;
  notObservedCount: number;
  pathFamilyCount: number;
  notes?: string[];
  externalEventContext?: {
    title: string;
    source?: string;
    note: string;
  };
}

/** Timeline index */
export interface TimelineIndex {
  countryCode: string;
  eventWindow: string;
  generatedTs: string;
  caseStudyId?: string;
  points: TimelinePoint[];
}
