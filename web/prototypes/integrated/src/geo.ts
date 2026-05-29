/**
 * Simplified GeoJSON outlines for landmasses around Cuba.
 * Used by deck.gl GeoJsonLayer for geographic orientation.
 */

import type { Feature, Polygon } from "./deck-types";

// Minimal deck.gl-compatible GeoJSON types
export type { Feature, Polygon };

/** Cuba (simplified Natural Earth 50m) */
export const cubaGeoJson: Feature<Polygon> = {
  type: "Feature", properties: { name: "Cuba", iso: "CU", kind: "country" },
  geometry: {
    type: "Polygon",
    coordinates: [[
      [-84.95,21.85],[-84.35,21.83],[-83.90,22.08],[-83.47,22.55],[-83.01,22.65],
      [-82.28,22.92],[-81.72,23.12],[-81.18,23.12],[-80.80,23.10],[-80.33,22.98],
      [-79.82,22.73],[-79.30,22.42],[-78.88,22.02],[-78.33,21.63],[-77.83,21.43],
      [-77.33,21.28],[-76.82,21.11],[-76.33,20.89],[-75.83,20.69],[-75.31,20.41],
      [-74.85,20.11],[-74.48,19.93],[-74.23,19.82],[-73.98,20.00],[-73.93,20.13],
      [-74.00,20.28],[-74.23,20.43],[-74.52,20.53],[-74.83,20.48],[-75.22,20.47],
      [-75.63,20.44],[-76.01,20.32],[-76.43,20.08],[-76.83,19.93],[-77.22,19.87],
      [-77.63,19.92],[-78.03,19.93],[-78.43,19.93],[-78.83,19.98],[-79.22,20.01],
      [-79.62,20.01],[-80.02,20.01],[-80.42,20.00],[-80.82,19.98],[-81.22,19.95],
      [-81.60,19.94],[-82.01,19.95],[-82.44,19.92],[-82.83,20.03],[-83.23,20.02],
      [-83.63,20.00],[-84.03,20.08],[-84.53,20.05],[-84.95,21.85],
    ]],
  },
};

/** Simplified US Southeast / Gulf Coast for orientation */
const usSoutheast: Feature<Polygon> = {
  type: "Feature", properties: { name: "US Southeast", iso: "US", kind: "landmass" },
  geometry: {
    type: "Polygon",
    coordinates: [[
      [-97.5,26],[-97.0,28],[-94.0,29.5],[-90.0,29],[-89.0,30],[-88.0,30],
      [-85.0,30],[-84.0,30.5],[-82.5,30],[-81.5,30.5],[-80.5,30],[-80.0,31],
      [-80.0,32],[-80.5,33],[-81.5,32.5],[-83.0,32],[-85.0,33],[-88.0,35],
      [-90.0,36],[-91.5,37],[-94.0,37],[-95.5,36],[-97.0,35],[-97.5,34],
      [-97.5,26],
    ]],
  },
};

/** Simplified Mexico */
const mexico: Feature<Polygon> = {
  type: "Feature", properties: { name: "Mexico", iso: "MX", kind: "landmass" },
  geometry: {
    type: "Polygon",
    coordinates: [[
      [-97.5,26],[-98.5,24],[-99.0,22],[-100.5,19],[-102.0,18],[-103.5,16],
      [-105.0,20],[-106.5,22],[-108.0,24],[-109.0,25],[-110.0,27.5],[-112.0,29],
      [-114.5,31],[-117.0,32.5],[-117.0,31],[-115.0,29.5],[-113.0,28],
      [-108.0,26.5],[-105.0,25.5],[-103.0,26],[-100.0,28],[-97.5,26],
    ]],
  },
};

/** Simplified Central America */
const centralAmerica: Feature<Polygon> = {
  type: "Feature", properties: { name: "Central America", kind: "landmass" },
  geometry: {
    type: "Polygon",
    coordinates: [[
      [-92.2,14.5],[-91.5,14],[-90.5,13.8],[-89.5,13.3],[-88.5,13.2],
      [-87.6,13.0],[-86.5,12.5],[-85.5,11.0],[-84.5,10.0],[-83.8,9.5],
      [-83.0,9.0],[-82.5,8.5],[-82.0,8.0],[-81.5,8.5],[-80.0,8.5],
      [-79.5,9.0],[-78.5,9.5],[-77.8,9.5],[-77.0,9.0],[-77.5,8.0],
      [-78.5,8.0],[-79.5,9.0],[-80.5,9.0],[-81.5,8.5],[-82.5,9.0],
      [-83.5,9.5],[-84.5,10.5],[-85.5,11.5],[-86.5,13.0],[-87.5,13.5],
      [-88.5,14.0],[-89.5,14.5],[-90.5,15.0],[-91.5,15.5],[-92.2,14.5],
    ]],
  },
};

/** Simplified South America (northern) */
const southAmerica: Feature<Polygon> = {
  type: "Feature", properties: { name: "South America", kind: "landmass" },
  geometry: {
    type: "Polygon",
    coordinates: [[
      [-80.0,8.5],[-79.0,9.0],[-77.5,9.0],[-76.5,8.5],[-75.0,8.0],
      [-73.0,9.5],[-71.5,11.5],[-70.0,12.0],[-68.0,10.5],[-66.0,9.0],
      [-64.0,8.0],[-62.0,7.0],[-60.0,6.0],[-58.0,4.0],[-56.0,3.0],
      [-54.0,2.0],[-52.0,3.0],[-50.0,2.0],[-48.0,1.0],[-46.0,0],
      [-44.0,-1],[-42.0,-2],[-40.0,-3],[-38.0,-6],[-36.0,-10],
      [-35.0,-5],[-34.0,-8],[-34.0,-18],[-37.0,-20],[-40.0,-22],
      [-42.0,-23],[-44.0,-22],[-45.0,-20],[-47.0,-18],[-48.0,-15],
      [-49.0,-13],[-50.0,-10],[-51.0,-5],[-54.0,-2],[-57.0,1],
      [-60.0,4],[-65.0,6],[-70.0,8],[-75.0,9],[-78.0,9],
      [-80.0,8.5],
    ]],
  },
};

/** Simplified Caribbean islands (Hispaniola, Jamaica, Puerto Rico as polygons) */
const caribbeanIslands: Feature<Polygon> = {
  type: "Feature", properties: { name: "Caribbean Islands", kind: "landmass" },
  geometry: {
    type: "Polygon",
    coordinates: [[
      // Hispaniola
      [-72.0,18.5],[-71.5,18.5],[-71.0,19.0],[-70.5,19.5],[-70.0,19.5],
      [-69.5,19.2],[-69.0,18.8],[-68.8,18.5],[-68.5,18.2],[-69.0,18.0],
      [-70.0,18.0],[-71.0,18.0],[-71.5,17.8],[-72.0,17.7],[-72.5,18.0],
      [-72.5,18.3],[-72.0,18.5],
    ]],
  },
};

/** Simplified Western Europe (Spain/Portugal) */
const westernEurope: Feature<Polygon> = {
  type: "Feature", properties: { name: "Western Europe", kind: "landmass" },
  geometry: {
    type: "Polygon",
    coordinates: [[
      [-9.5,37],[-8.5,36.5],[-7.5,36.5],[-6.5,36.5],[-5.5,36],[-4.5,36],
      [-3.5,36.5],[-2.5,36.5],[-1.5,37],[-0.5,37.5],[0.5,38],[1.5,38.5],
      [2.5,39],[3.0,40],[3.0,41],[2.5,42],[2.0,42.5],[1.0,43],[-1.0,43.5],
      [-3.0,43.5],[-5.0,43.5],[-7.0,43.5],[-9.0,43],[-9.5,42],[-9.5,37],
    ]],
  },
};

/** All landmass features for the map */
export const landmasses: Feature<Polygon>[] = [
  usSoutheast, mexico, centralAmerica, southAmerica, caribbeanIslands, westernEurope,
];

/** Cuba center for arc targets */
export const CUBA_CENTER: [number, number] = [-79.0, 21.8];
