/**
 * Cuba geographic anchor — real GeoJSON-based SVG outline.
 *
 * Projects simplified Cuba polygon coordinates into the SVG viewBox
 * using an equirectangular approximation centered on Cuba.
 */

// Simplified Cuba polygon [lon, lat] from Natural Earth 50m
const CUBA_COORDS: [number, number][] = [
  [-84.95, 21.85], [-84.35, 21.83], [-83.90, 22.08], [-83.47, 22.55],
  [-83.01, 22.65], [-82.28, 22.92], [-81.72, 23.12], [-81.18, 23.12],
  [-80.80, 23.10], [-80.33, 22.98], [-79.82, 22.73], [-79.30, 22.42],
  [-78.88, 22.02], [-78.33, 21.63], [-77.83, 21.43], [-77.33, 21.28],
  [-76.82, 21.11], [-76.33, 20.89], [-75.83, 20.69], [-75.31, 20.41],
  [-74.85, 20.11], [-74.48, 19.93], [-74.23, 19.82], [-73.98, 20.00],
  [-73.93, 20.13], [-74.00, 20.28], [-74.23, 20.43], [-74.52, 20.53],
  [-74.83, 20.48], [-75.22, 20.47], [-75.63, 20.44], [-76.01, 20.32],
  [-76.43, 20.08], [-76.83, 19.93], [-77.22, 19.87], [-77.63, 19.92],
  [-78.03, 19.93], [-78.43, 19.93], [-78.83, 19.98], [-79.22, 20.01],
  [-79.62, 20.01], [-80.02, 20.01], [-80.42, 20.00], [-80.82, 19.98],
  [-81.22, 19.95], [-81.60, 19.94], [-82.01, 19.95], [-82.44, 19.92],
  [-82.83, 20.03], [-83.23, 20.02], [-83.63, 20.00], [-84.03, 20.08],
  [-84.53, 20.05], [-84.95, 21.85],
];

// Bounding box for Cuba
const LON_MIN = -85.0, LON_MAX = -73.9;
const LAT_MIN = 19.8, LAT_MAX = 23.2;

/** Project lon/lat into SVG viewBox coordinates */
function project(lon: number, lat: number, vbW: number, vbH: number): [number, number] {
  const padX = 12, padY = 10;
  const x = padX + ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * (vbW - 2 * padX);
  const y = padY + ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * (vbH - 2 * padY);
  return [x, y];
}

/** Render the Cuba GeoJSON outline into an SVG path element */
export function renderCubaOutline(svg: SVGSVGElement): void {
  const path = svg.querySelector("#cuba-outline") as SVGPathElement;
  if (!path) return;

  const vbW = 200, vbH = 100;
  const points: string[] = [];

  for (const [lon, lat] of CUBA_COORDS) {
    const [x, y] = project(lon, lat, vbW, vbH);
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  path.setAttribute("d", `M ${points.join(" L ")} Z`);
  path.setAttribute("fill", "rgba(30, 40, 80, 0.3)");
  path.setAttribute("stroke", "rgba(80, 120, 200, 0.5)");
  path.setAttribute("stroke-width", "1.2");
}
