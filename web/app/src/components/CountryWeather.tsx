/**
 * Country-shaped IP-space weather view.
 * Uses the actual country polygon from geo.ts with proper projection.
 * Editorial visual — HilbertCanvas is the precise technical view.
 */

import React, { useRef, useEffect, useMemo } from "react";
import type { PrefixRecord, PrefixVisibilityScore } from "../types";
import { COMPACT_SIZE, COMPACT_TOTAL, buildCompactMap } from "../compact";
import { targetCountryGeoJson } from "../geo";

interface Props {
  prefixes: PrefixRecord[];
  visibilityScores: Map<string, PrefixVisibilityScore> | null;
  totalCollectors: number;
  mapConfig: { name: string };
}

/** Project GeoJSON polygon to canvas coords with preserved aspect ratio */
function projectPolygon(coords: number[][], w: number, h: number, pad = 16): { points: [number, number][]; scale: number } {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [lon, lat] of coords) {
    if (lon < minX) minX = lon;
    if (lon > maxX) maxX = lon;
    if (lat < minY) minY = lat;
    if (lat > maxY) maxY = lat;
  }
  const geoW = maxX - minX, geoH = maxY - minY;
  const availW = w - pad * 2, availH = h - pad * 2;
  const scale = Math.min(availW / geoW, availH / geoH);
  const offX = pad + (availW - geoW * scale) / 2;
  const offY = pad + (availH - geoH * scale) / 2;

  const points: [number, number][] = coords.map(([lon, lat]) => [
    offX + (lon - minX) * scale,
    offY + (maxY - lat) * scale, // flip Y (lat increases up, canvas down)
  ]);
  return { points, scale };
}

function pointsToPath(points: [number, number][]): string {
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ") + " Z";
}

export function CountryWeather({ prefixes, visibilityScores, totalCollectors, mapConfig }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const W = 480, H = 280;

  const { svgPath, projectedPoints } = useMemo(() => {
    const coords = targetCountryGeoJson.geometry.coordinates[0] as number[][];
    const { points } = projectPolygon(coords, W, H);
    return { svgPath: pointsToPath(points), projectedPoints: points };
  }, []);

  const cellColors = useMemo(() => {
    const { cellMap } = buildCompactMap(prefixes);
    const colors: ([number, number, number] | null)[] = new Array(COMPACT_TOTAL).fill(null);
    for (let c = 0; c < COMPACT_TOTAL; c++) {
      const idx = (cellMap as unknown as ArrayLike<number>)[c];
      if (idx <= 0) continue;
      const prefix = prefixes[idx - 1];
      if (!prefix) continue;
      if (visibilityScores && totalCollectors > 1) {
        const score = visibilityScores.get(prefix.prefix);
        if (score) {
          const ratio = score.visibilityRatio;
          if (ratio >= 1) colors[c] = [40, 185, 94];
          else if (ratio > 0) colors[c] = [210, 170, 50];
          else colors[c] = [60, 20, 20];
          continue;
        }
      }
      colors[c] = prefix.observedInBgp ? [40, 185, 94] : [18, 18, 30];
    }
    return colors;
  }, [prefixes, visibilityScores, totalCollectors]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0a0a1e";
    ctx.fillRect(0, 0, W, H);

    // Clip to actual country polygon
    ctx.save();
    const path = new Path2D(svgPath);
    ctx.clip(path);

    // Draw Hilbert cells
    ctx.imageSmoothingEnabled = false;
    const cw = W / COMPACT_SIZE, ch = H / COMPACT_SIZE;
    for (let c = 0; c < COMPACT_TOTAL; c++) {
      const color = cellColors[c];
      if (!color) continue;
      const x = c % COMPACT_SIZE, y = Math.floor(c / COMPACT_SIZE);
      ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
      ctx.fillRect(x * cw, y * ch, Math.ceil(cw) + 0.5, Math.ceil(ch) + 0.5);
    }
    ctx.restore();

    // Draw country outline on top
    ctx.strokeStyle = "rgba(80, 140, 220, 0.7)";
    ctx.lineWidth = 2;
    ctx.stroke(new Path2D(svgPath));
  }, [cellColors, svgPath]);

  return (
    <div style={{ position: "relative", background: "#0c0c1c", borderRadius: 4, border: "1px solid #2a2a48", overflow: "hidden" }}>
      <div style={{
        padding: "4px 8px", fontSize: 9, fontWeight: 600, color: "#7777a0",
        textTransform: "uppercase", letterSpacing: "0.05em", background: "rgba(0,0,0,0.3)",
        borderBottom: "1px solid #2a2a48",
      }}>
        {mapConfig.name} · IP-space weather
      </div>
      <canvas ref={canvasRef} width={W} height={H} style={{ display: "block", width: "100%", height: "auto" }} />
      <div style={{
        position: "absolute", bottom: 4, left: 6, right: 6,
        display: "flex", justifyContent: "space-between",
        fontSize: 8, color: "#445",
      }}>
        <span>IP-space packed into country outline for readability</span>
        <span>Logical, not physical locations</span>
      </div>
    </div>
  );
}
