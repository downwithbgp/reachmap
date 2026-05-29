/**
 * Collector geography map — SVG, no deck.gl.
 * Shows collector RIB observation points on a simple regional projection.
 */

import React from "react";
interface Props {
  mapConfig: { name: string; map?: { center: { longitude: number; latitude: number } } };
}

// Documented collector positions
const COLLECTORS = [
  { id: "route-views2", label: "Eugene, OR", lon: -123.09, lat: 44.05 },
  { id: "route-views4", label: "San Jose, CA", lon: -121.89, lat: 37.34 },
  { id: "route-views.eqix", label: "Ashburn, VA", lon: -77.49, lat: 39.04 },
  { id: "route-views.linx", label: "London, UK", lon: -0.09, lat: 51.51 },
  { id: "rrc00", label: "Amsterdam, NL", lon: 4.90, lat: 52.37 },
];

function project(lon: number, lat: number, w: number, h: number): [number, number] {
  const x = ((lon + 180) / 360) * w;
  const y = ((90 - lat) / 180) * h;
  return [x, y];
}

export function CollectorMap({ mapConfig }: Props) {
  const W = 300, H = 220;
  const cx = mapConfig.map?.center?.longitude ?? -79.5;
  const cy = mapConfig.map?.center?.latitude ?? 21.5;
  const [tcx, tcy] = project(cx, cy, W, H);

  return (
    <div style={{ position: "relative", background: "#0c0c1c", borderRadius: 4, border: "1px solid #2a2a48", overflow: "hidden" }}>
      <div style={{
        padding: "4px 8px", fontSize: 9, fontWeight: 600, color: "#7777a0",
        textTransform: "uppercase", letterSpacing: "0.05em", background: "rgba(0,0,0,0.3)",
        borderBottom: "1px solid #2a2a48",
      }}>
        Collector RIB observation points
      </div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        {/* Ocean */}
        <rect x={0} y={0} width={W} height={H} fill="#0a0a1e" />
        {/* Target country */}
        {COLLECTORS.map(c => {
          const [cx, cy] = project(c.lon, c.lat, W, H);
          return (
            <line key={c.id} x1={cx} y1={cy} x2={tcx} y2={tcy} stroke="rgba(80,130,200,0.08)" strokeWidth={1} />
          );
        })}
        {/* Target country marker */}
        <circle cx={tcx} cy={tcy} r={4} fill="#335588" stroke="#5588bb" strokeWidth={1.5} />
        <text x={tcx} y={tcy + 14} textAnchor="middle" fill="#7799bb" fontSize={10} fontWeight={600}>
          {mapConfig.name}
        </text>
        {/* Collector points */}
        {COLLECTORS.map(c => {
          const [x, y] = project(c.lon, c.lat, W, H);
          return (
            <g key={c.id}>
              <circle cx={x} cy={y} r={5} fill="#5588aa" stroke="#88bbcc" strokeWidth={1.5} />
              <text x={x + 8} y={y + 4} textAnchor="start" fill="#aac8dd" fontSize={9}>{c.label}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ position: "absolute", bottom: 4, right: 6, fontSize: 8, color: "#445" }}>
        Geographic context · Not physical cables
      </div>
    </div>
  );
}
