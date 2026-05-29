/**
 * Mock data for the deck.gl spike.
 *
 * Cuba GeoJSON (simplified polygon), vantage/collector locations,
 * and logical reachability arcs.
 */

export interface VantagePoint {
  id: string;
  name: string;
  asn: number;
  location: string;
  coordinates: [number, number]; // [lon, lat]
  collector?: string;
}

export interface ReachabilityArc {
  from: [number, number]; // [lon, lat]
  to: [number, number];   // [lon, lat]
  vantageId: string;
  prefixCount: number;
  pathFamilyCount: number;
}

/** Simplified Cuba polygon (main island outline, GeoJSON-style coords [lon, lat]) */
export const cubaGeoJson = {
  type: "Feature" as const,
  properties: { name: "Cuba", iso: "CU" },
  geometry: {
    type: "Polygon" as const,
    coordinates: [[
      [-84.9, 19.9], [-84.3, 21.8], [-84.0, 22.0], [-83.5, 22.5],
      [-83.0, 22.6], [-82.3, 22.9], [-81.7, 23.1], [-81.2, 23.1],
      [-80.8, 23.1], [-80.3, 23.0], [-79.8, 22.7], [-79.3, 22.4],
      [-78.9, 22.0], [-78.3, 21.6], [-77.8, 21.4], [-77.3, 21.3],
      [-76.8, 21.1], [-76.3, 20.9], [-75.8, 20.7], [-75.3, 20.4],
      [-74.8, 20.1], [-74.5, 19.9], [-74.2, 19.8], [-74.0, 20.0],
      [-73.9, 20.1], [-74.0, 20.3], [-74.2, 20.4], [-74.5, 20.5],
      [-74.8, 20.5], [-75.2, 20.5], [-75.6, 20.4], [-76.0, 20.3],
      [-76.4, 20.1], [-76.8, 19.9], [-77.2, 19.9], [-77.6, 19.9],
      [-78.0, 19.9], [-78.4, 19.9], [-78.8, 20.0], [-79.2, 20.0],
      [-79.6, 20.0], [-80.0, 20.0], [-80.4, 20.0], [-80.8, 20.0],
      [-81.2, 19.9], [-81.6, 19.9], [-82.0, 19.9], [-82.4, 19.9],
      [-82.8, 20.0], [-83.2, 20.0], [-83.6, 20.0], [-84.0, 20.1],
      [-84.5, 20.1], [-84.9, 19.9],
    ]],
  },
};

/** Cuba center point for arc targets */
export const CUBA_CENTER: [number, number] = [-79.0, 21.8];

/** Mock vantage/collector points around the world */
export const vantagePoints: VantagePoint[] = [
  { id: "att",       name: "AT&T",       asn: 7018,  location: "Dallas, US",         coordinates: [-96.8, 32.8] },
  { id: "lumen",     name: "Lumen/L3",   asn: 3356,  location: "Denver, US",         coordinates: [-104.9, 39.7] },
  { id: "cogent",    name: "Cogent",     asn: 174,   location: "Washington DC, US",  coordinates: [-77.0, 38.9] },
  { id: "telefonica",name: "Telefónica", asn: 12956, location: "Madrid, ES",          coordinates: [-3.7, 40.4] },
  { id: "dtag",      name: "DTAG",       asn: 3320,  location: "Frankfurt, DE",      coordinates: [8.7, 50.1] },
  { id: "orange",    name: "Orange",     asn: 5511,  location: "Paris, FR",          coordinates: [2.3, 48.9] },
  { id: "ntt",       name: "NTT",        asn: 2914,  location: "Tokyo, JP",          coordinates: [139.7, 35.7] },
  { id: "telstra",   name: "Telstra",    asn: 1221,  location: "Sydney, AU",         coordinates: [151.2, -33.9] },
  { id: "tata",      name: "Tata Comm",  asn: 6453,  location: "Mumbai, IN",         coordinates: [72.9, 19.1] },
  { id: "telebras",  name: "Telebras",   asn: 52873, location: "Brasília, BR",       coordinates: [-47.9, -15.8] },
  // Collector locations
  { id: "rv2",       name: "RouteViews2", asn: 0,    location: "Eugene, OR, US",    coordinates: [-123.1, 44.1] },
  { id: "rv4",       name: "RouteViews4", asn: 0,    location: "San Jose, CA, US",  coordinates: [-121.9, 37.3] },
  { id: "rv6",       name: "RouteViews6", asn: 0,    location: "Atlanta, GA, US",   coordinates: [-84.4, 33.7] },
];

/** Build arcs from vantage points to Cuba center */
export function buildArcs(selectedVantageId: string | null): ReachabilityArc[] {
  if (!selectedVantageId) return [];
  const vantage = vantagePoints.find(v => v.id === selectedVantageId);
  if (!vantage) return [];
  return [{
    from: vantage.coordinates,
    to: CUBA_CENTER,
    vantageId: vantage.id,
    prefixCount: 42,
    pathFamilyCount: 3,
  }];
}
