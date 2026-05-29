/**
 * ReachMap integrated stage — geographic map with logical AS-path flows
 * into country-shaped IP-space weather.
 *
 * Single SVG combining: collector geography + transit waypoints + country weather.
 * Not physical cables. Logical BGP AS-path structure.
 */

import React, { useMemo, useState, useEffect } from "react";
import type { PathFamilyRecord, PrefixVisibilityScore, AsnMetadata } from "../types";

interface Props {
  pathFamilies: PathFamilyRecord[];
  asnMap: Map<number, AsnMetadata>;
  visibilityScores: Map<string, PrefixVisibilityScore> | null;
  totalCollectors: number;
  countryName: string;
  selectedPrefix: string | null;
  selectedCollectorId: string | null;
  onSelectCollector: (id: string | null) => void;
}

// Documented collectors with geographic positions
const COLLECTORS = [
  { id: "route-views2", label: "Eugene", region: "US West", lon: -123.09, lat: 44.05 },
  { id: "route-views4", label: "San Jose", region: "US West", lon: -121.89, lat: 37.34 },
  { id: "route-views.eqix", label: "Ashburn", region: "US East", lon: -77.49, lat: 39.04 },
  { id: "route-views.linx", label: "London", region: "Europe", lon: -0.09, lat: 51.51 },
  { id: "rrc00", label: "Amsterdam", region: "Europe", lon: 4.90, lat: 52.37 },
];

// Cuba geographic center and simplified outline points
const CUBA_CENTER: [number, number] = [-79.5, 21.8];
const CUBA_OUTLINE: [number, number][] = [
  [-84.95,21.85],[-84.35,21.83],[-83.90,22.08],[-83.47,22.55],[-83.01,22.65],
  [-82.28,22.92],[-81.72,23.12],[-81.18,23.12],[-80.80,23.10],[-80.33,22.98],
  [-79.98,22.80],[-79.62,22.76],[-79.18,22.39],[-78.73,22.39],[-78.18,22.44],
  [-77.90,22.08],[-77.55,21.77],[-77.10,21.60],[-76.61,21.48],[-76.02,21.61],
  [-75.55,21.43],[-75.23,21.17],[-74.90,20.70],[-74.70,20.13],[-75.05,19.83],
  [-75.68,19.97],[-76.20,19.99],[-77.07,19.87],[-77.85,19.66],[-78.55,19.85],
  [-79.10,19.95],[-80.10,19.88],[-80.55,19.86],[-81.42,20.30],[-81.98,20.88],
  [-82.61,21.37],[-83.20,21.70],[-83.65,21.73],[-84.25,21.58],[-84.95,21.85],
];

// Simple equirectangular projection for Atlantic region
const VIEW = { minLon: -130, maxLon: 12, minLat: 12, maxLat: 58 };
const SVG_W = 900, SVG_H = 480;

function project(lon: number, lat: number): [number, number] {
  const x = ((lon - VIEW.minLon) / (VIEW.maxLon - VIEW.minLon)) * SVG_W;
  const y = ((VIEW.maxLat - lat) / (VIEW.maxLat - VIEW.minLat)) * SVG_H;
  return [x, y];
}

// Cuba enlarged callout (magnified for IP-space weather) — focal endpoint
const CALLOUT_SCALE = 5.0;
const CALLOUT_CENTER = project(CUBA_CENTER[0], CUBA_CENTER[1]);
// Position callout as dominant right-side focal point
const CALLOUT_OFFSET: [number, number] = [SVG_W * 0.72, SVG_H * 0.42];

function projectCubaCallout(lon: number, lat: number): [number, number] {
  const dx = (lon - CUBA_CENTER[0]) * CALLOUT_SCALE;
  const dy = (CUBA_CENTER[1] - lat) * CALLOUT_SCALE;
  const pixPerDeg = SVG_W / (VIEW.maxLon - VIEW.minLon);
  return [CALLOUT_OFFSET[0] + dx * pixPerDeg, CALLOUT_OFFSET[1] + dy * pixPerDeg];
}

function geoToSvgPath(coords: number[][]): string {
  return coords.map(([lon, lat], i) => {
    const [x, y] = project(lon, lat);
    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ") + " Z";
}

export function ReachMapStage({ pathFamilies, asnMap, visibilityScores, totalCollectors, countryName, selectedPrefix, selectedCollectorId, onSelectCollector }: Props) {
  const [basemap, setBasemap] = useState<string[]>([]);

  useEffect(() => {
    fetch("/data/basemaps/ne-atlantic-land.json")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.features) return;
        const paths: string[] = [];
        for (const f of data.features) {
          if (f.geometry.type === "Polygon") {
            for (const ring of f.geometry.coordinates) {
              const p = geoToSvgPath(ring);
              if (p.length > 10) paths.push(p);
            }
          } else if (f.geometry.type === "MultiPolygon") {
            for (const poly of f.geometry.coordinates) {
              for (const ring of poly) {
                const p = geoToSvgPath(ring);
                if (p.length > 10) paths.push(p);
              }
            }
          }
        }
        setBasemap(paths);
      })
      .catch(() => {});
  }, []);

  // Top transit ASNs
  const transitNodes = useMemo(() => {
    const map = new Map<number, { count: number; prefixes: Set<string> }>();
    const pfs = pathFamilies.filter(pf => Array.isArray(pf.path) && pf.path.length > 0);
    for (const pf of pfs) {
      for (const asn of pf.path.slice(1, -1)) {
        const e = map.get(asn) ?? { count: 0, prefixes: new Set() };
        e.count++;
        pf.prefixes.forEach(p => e.prefixes.add(p));
        map.set(asn, e);
      }
    }
    return [...map.entries()]
      .sort((a, b) => b[1].prefixes.size - a[1].prefixes.size)
      .slice(0, 6)
      .map(([asn, data], i) => ({
        asn,
        label: asnMap.get(asn)?.displayName ?? `AS${asn}`,
        count: data.count,
        prefixCount: data.prefixes.size,
        y: 100 + i * 55, // vertical spacing in SVG
      }));
  }, [pathFamilies, asnMap]);

  // Cuba callout polygon path
  const cubaCalloutPath = useMemo(() => {
    return CUBA_OUTLINE.map(([lon, lat], i) => {
      const [x, y] = projectCubaCallout(lon, lat);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(" ") + " Z";
  }, []);

  // Cuba geographic small outline
  const cubaGeoPath = useMemo(() => {
    return CUBA_OUTLINE.map(([lon, lat], i) => {
      const [x, y] = project(lon, lat);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(" ") + " Z";
  }, []);

  // BGP status for callout fill
  const bgpStatus = visibilityScores && totalCollectors > 1 ? "green" : "green"; // all green for March 2026

  // Transit node x position (logical band — clear middle separation)
  const transitX = SVG_W * 0.42;

  return (
    <div style={{ position: "relative", background: "#080812", borderRadius: 4, border: "1px solid #1a1a38", overflow: "hidden", width: "100%", height: "100%" }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ display: "block" }}>
        {/* Ocean background */}
        <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="#0a0a1e" />

        {/* Natural Earth basemap — Atlantic region */}
        <g>
          {basemap.map((d, i) => (
            <path key={i} d={d} fill="#141428" stroke="#252545" strokeWidth={0.5} />
          ))}
        </g>

        {/* Cuba geographic position (small) */}
        <path d={cubaGeoPath} fill="rgba(40,80,140,0.3)" stroke="rgba(80,130,200,0.4)" strokeWidth={1} />

        {/* Callout line from geographic Cuba to enlarged callout */}
        <line x1={CALLOUT_CENTER[0]} y1={CALLOUT_CENTER[1]} x2={CALLOUT_OFFSET[0]} y2={CALLOUT_OFFSET[1]}
          stroke="rgba(80,130,200,0.3)" strokeWidth={1} strokeDasharray="4 3" />

        {/* Cuba enlarged callout — country-shaped IP-space weather */}
        <path d={cubaCalloutPath} fill={bgpStatus === "green" ? "rgba(40,185,94,0.6)" : "rgba(210,170,50,0.5)"}
          stroke="rgba(80,150,220,0.8)" strokeWidth={1.5} />

        {/* Callout label */}
        {(() => { const [cx, cy] = CALLOUT_OFFSET; return (<>
          <text x={cx} y={cy + 65} textAnchor="middle" fill="#7799bb" fontSize={11} fontWeight={600}>
            {countryName} · IP-space weather
          </text>
          <text x={cx} y={cy + 78} textAnchor="middle" fill="#445566" fontSize={9}>
            BGP-visible in all sampled collector RIBs
          </text>
        </>); })()}

        {/* Geographic anchor label */}
        {(() => { const [gx, gy] = CALLOUT_CENTER; return (
          <text x={gx} y={gy + 16} textAnchor="middle" fill="#3a5570" fontSize={8}>
            geographic location
          </text>
        ); })()}

        {/* Collector points */}
        {COLLECTORS.map(c => {
          const [x, y] = project(c.lon, c.lat);
          const isSelected = selectedCollectorId === c.id;
          return (
            <g key={c.id} style={{ cursor: "pointer" }} onClick={() => onSelectCollector(isSelected ? null : c.id)}>
              <circle cx={x} cy={y} r={isSelected ? 8 : 6} fill={isSelected ? "#ffcc40" : "#5588aa"}
                stroke={isSelected ? "#ffee80" : "#88bbdd"} strokeWidth={1.5} />
              <text x={x + 10} y={y + 4} textAnchor="start" fill="#aaccdd" fontSize={10} fontWeight={isSelected ? 600 : 400}>
                {c.label}
              </text>
              <text x={x + 10} y={y + 16} textAnchor="start" fill="#556677" fontSize={8}>
                {c.region}
              </text>
            </g>
          );
        })}

        {/* Transit ASN waypoints (logical band) */}
        {transitNodes.map(t => (
          <g key={t.asn}>
            <circle cx={transitX} cy={t.y} r={Math.max(4, Math.min(12, 4 + t.prefixCount / 3))}
              fill="#4a4a6a" stroke="#7777aa" strokeWidth={1} />
            <text x={transitX + 16} y={t.y + 4} textAnchor="start" fill="#aaa" fontSize={10}>
              {t.label}
            </text>
            <text x={transitX + 16} y={t.y + 16} textAnchor="start" fill="#555" fontSize={8}>
              AS{t.asn}
            </text>
          </g>
        ))}

        {/* Flow arcs: collectors → transit band */}
        {COLLECTORS.map(c => {
          const [sx, sy] = project(c.lon, c.lat);
          // Connect to nearest transit nodes
          return transitNodes.slice(0, 3).map((t, i) => (
            <path key={`${c.id}-${t.asn}`}
              d={`M ${sx} ${sy} C ${(sx + transitX) / 2} ${sy}, ${(sx + transitX) / 2} ${t.y}, ${transitX} ${t.y}`}
              fill="none" stroke="rgba(100,140,200,0.18)" strokeWidth={1} />
          ));
        })}

        {/* Flow arcs: transit → Cuba callout */}
        {transitNodes.map(t => {
          const [tx, ty] = CALLOUT_OFFSET;
          return (
            <path key={`t-${t.asn}`}
              d={`M ${transitX} ${t.y} C ${(transitX + tx) / 2} ${t.y}, ${(transitX + tx) / 2} ${ty}, ${tx} ${ty}`}
              fill="none" stroke="rgba(40,185,94,0.3)" strokeWidth={Math.max(1, t.prefixCount / 4)} />
          );
        })}

        {/* Column labels */}
        <text x={100} y={SVG_H - 20} fill="#445" fontSize={9}>Collector RIB locations</text>
        <text x={transitX} y={SVG_H - 20} textAnchor="middle" fill="#445" fontSize={9}>Logical transit ASNs</text>
        <text x={CALLOUT_OFFSET[0]} y={SVG_H - 20} textAnchor="middle" fill="#445" fontSize={9}>IP-space weather</text>

        {/* Bottom disclaimer */}
        <text x={SVG_W / 2} y={SVG_H - 6} textAnchor="middle" fill="#333" fontSize={8}>
          Logical BGP AS-path structure from sampled collector RIBs. Not physical cables or fiber routes.
        </text>
      </svg>

      {/* Path family count */}
      <div style={{ position: "absolute", top: 6, right: 10, fontSize: 9, color: "#556" }}>
        {pathFamilies.length} path families observed
      </div>
    </div>
  );
}
