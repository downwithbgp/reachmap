/** Minimal deck.gl-compatible GeoJSON types */

export interface Feature<G> {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: G;
}

export interface Polygon {
  type: "Polygon";
  coordinates: number[][][];
}
