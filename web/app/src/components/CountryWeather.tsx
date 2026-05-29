/**
 * Country-shaped IP-space weather view.
 * Renders the compact national Hilbert inside a country polygon clip path.
 * Editorial visual — HilbertCanvas is the precise technical view.
 */

import React, { useRef, useEffect, useMemo } from "react";
import type { PrefixRecord, PrefixVisibilityScore } from "../types";
import { COMPACT_SIZE, COMPACT_TOTAL, buildCompactMap } from "../compact";

interface Props {
  prefixes: PrefixRecord[];
  visibilityScores: Map<string, PrefixVisibilityScore> | null;
  totalCollectors: number;
  mapConfig: { name: string };
}

// Simplified Cuba outline for prototype clip path
function countryPath(w: number, h: number): string {
  return `M ${w*0.15} ${h*0.25} Q ${w*0.20} ${h*0.10} ${w*0.40} ${h*0.15} Q ${w*0.80} ${h*0.18} ${w*0.82} ${h*0.30} L ${w*0.85} ${h*0.55} Q ${w*0.80} ${h*0.65} ${w*0.70} ${h*0.70} L ${w*0.50} ${h*0.80} Q ${w*0.30} ${h*0.90} ${w*0.20} ${h*0.85} Q ${w*0.05} ${h*0.70} ${w*0.10} ${h*0.45} Z`;
}

const W = 420, H = 320;

export function CountryWeather({ prefixes, visibilityScores, totalCollectors, mapConfig }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const cellColors = useMemo(() => {
    const { cellMap } = buildCompactMap(prefixes);
    const colors: ([number,number,number] | null)[] = new Array(COMPACT_TOTAL).fill(null);

    for (let c = 0; c < COMPACT_TOTAL; c++) {
      const idx = (cellMap as unknown as Uint16Array)[c];
      if (idx <= 0) continue; // no prefix in this cell
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

      const asns = prefix.originAsns ?? [];
      const asn = asns[0] ?? 0;
      if (prefix.observedInBgp) {
        colors[c] = originColor(asn);
      } else {
        colors[c] = [18, 18, 30];
      }
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

    ctx.save();
    ctx.clip(new Path2D(countryPath(W, H)));
    ctx.imageSmoothingEnabled = false;

    const cw = W / COMPACT_SIZE, ch = H / COMPACT_SIZE;
    for (let c = 0; c < COMPACT_TOTAL; c++) {
      const color = cellColors[c];
      if (!color) continue;
      const x = c % COMPACT_SIZE, y = Math.floor(c / COMPACT_SIZE);
      ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
      ctx.fillRect(x * cw, y * ch, Math.ceil(cw) + 0.5, Math.ceil(ch) + 0.5);
    }

    ctx.strokeStyle = "rgba(100,150,220,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke(new Path2D(countryPath(W, H)));
    ctx.restore();
  }, [cellColors]);

  const activeCount = cellColors.filter(Boolean).length;

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
        <span>{activeCount} cells · Logical, not physical</span>
      </div>
    </div>
  );
}

function originColor(asn: number): [number, number, number] {
  const hue = ((asn * 137.508) % 360 + 360) % 360;
  // Simple HSL→RGB for s=65%, l=42%
  const s = 0.65, l = 0.42;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => { const k = (n + hue / 30) % 12; return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1); };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
