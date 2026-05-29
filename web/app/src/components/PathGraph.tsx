/**
 * Logical AS-path flow graph.
 * Shows observed BGP path families from collector RIBs through transit ASNs to origin ASNs.
 * NOT physical cables — logical routing paths from sampled collector RIBs.
 */

import React, { useMemo } from "react";
import type { PathFamilyRecord } from "../types";

// Known ASN names for legibility
const ASN_NAMES: Record<number, string> = {
  3356: "Lumen", 1299: "Arelion", 174: "Cogent", 6939: "HE",
  6762: "Telecom Italia", 3549: "Level3", 3257: "GTT", 2914: "NTT",
  5511: "Orange", 3303: "Swisscom", 1403: "GÉANT", 2497: "IIJ",
  6830: "LibertyGlobal", 9304: "HGC", 23520: "Columbus",
  11960: "ETECSA IXP", 27725: "ETECSA", 10569: "CENIAInternet",
};

// Documented collector set
const COLLECTORS = [
  { id: "route-views2", label: "Eugene, OR", sublabel: "route-views2" },
  { id: "route-views4", label: "San Jose, CA", sublabel: "route-views4" },
  { id: "route-views.eqix", label: "Ashburn, VA", sublabel: "route-views.eqix" },
  { id: "route-views.linx", label: "London, UK", sublabel: "route-views.linx" },
  { id: "rrc00", label: "Amsterdam, NL", sublabel: "rrc00" },
];

const ORIGIN_COLORS: Record<number, string> = {
  27725: "#5b9bd5",
  11960: "#45b7aa",
  10569: "#d4a040",
};

interface Props {
  pathFamilies: PathFamilyRecord[];
  selectedPrefix: string | null;
  selectedCollectorId: string | null;
  onSelectCollector: (id: string | null) => void;
}

// IP range overlap helpers
function cidrToRange(prefix: string): [number, number] | null {
  const [ipStr, bitsStr] = prefix.split("/");
  if (!ipStr || !bitsStr) return null;
  const parts = ipStr.split(".");
  if (parts.length !== 4) return null;
  const ip = ((+parts[0] << 24) | (+parts[1] << 16) | (+parts[2] << 8) | +parts[3]) >>> 0;
  const bits = parseInt(bitsStr);
  if (isNaN(bits) || bits < 0 || bits > 32) return null;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  const start = (ip & mask) >>> 0;
  const end = (start + ((1 << (32 - bits)) >>> 0) - 1) >>> 0;
  return [start, end];
}

function prefixOverlaps(a: string, b: string): boolean {
  const ra = cidrToRange(a), rb = cidrToRange(b);
  if (!ra || !rb) return false;
  return ra[0] <= rb[1] && ra[1] >= rb[0];
}

export function PathGraph({ pathFamilies, selectedPrefix, selectedCollectorId, onSelectCollector }: Props) {
  const { collectorNodes, transitNodes, originNodes, edges, maxEdgeCount, matchCount } = useMemo(() => {
    let pfs = pathFamilies;
    if (selectedPrefix) {
      pfs = pfs.filter(pf => pf.prefixes.some(p => prefixOverlaps(p, selectedPrefix)));
    }

    // Collector nodes (left column)
    const collectorNodes = COLLECTORS.map((c, i) => ({
      id: c.id, label: c.label, sublabel: c.sublabel, column: 0, y: i,
      count: pfs.length, // all paths observed at all collectors in this dataset
    }));

    // Transit ASNs (middle column) — unique ASNs appearing between first and last hop
    const transitMap = new Map<number, { count: number; prefixes: Set<string> }>();
    for (const pf of pfs) {
      const hops = pf.path.slice(1, -1); // between peer and origin
      for (const asn of hops) {
        const e = transitMap.get(asn) ?? { count: 0, prefixes: new Set() };
        e.count++;
        pf.prefixes.forEach(p => e.prefixes.add(p));
        transitMap.set(asn, e);
      }
    }
    const topTransit = [...transitMap.entries()]
      .sort((a, b) => b[1].prefixes.size - a[1].prefixes.size)
      .slice(0, 7);
    const transitNodes = topTransit.map(([asn, data], i) => ({
      id: `t-${asn}`, asn, label: ASN_NAMES[asn] ?? `AS${asn}`, sublabel: ASN_NAMES[asn] ? `AS${asn}` : undefined,
      column: 1, y: i, count: data.count, prefixCount: data.prefixes.size,
    }));

    // Origin ASNs (right column)
    const originMap = new Map<number, number>();
    for (const pf of pfs) { originMap.set(pf.originAsn, (originMap.get(pf.originAsn) ?? 0) + pf.prefixes.length); }
    const originNodes = [...originMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([asn, count], i) => ({
        id: `o-${asn}`, asn, label: ASN_NAMES[asn] ?? `AS${asn}`, sublabel: `AS${asn}`,
        column: 2, y: i, count,
      }));

    // Build edges: transit → origin
    const edges: { src: string; tgt: string; count: number; opacity: number }[] = [];
    let maxEdgeCount = 1;
    for (const tn of transitNodes) {
      for (const on of originNodes) {
        const count = pfs.filter(pf => pf.path.includes(tn.asn) && pf.originAsn === on.asn).length;
        if (count > 0) {
          maxEdgeCount = Math.max(maxEdgeCount, count);
          edges.push({ src: tn.id, tgt: on.id, count, opacity: 0.6 });
        }
      }
    }
    // Collector → transit edges (simplified: all collectors feed all transit equally)
    for (const cn of collectorNodes) {
      for (const tn of transitNodes) {
        edges.push({ src: cn.id, tgt: tn.id, count: tn.count, opacity: 0.25 });
      }
    }

    return { collectorNodes, transitNodes, originNodes, edges, maxEdgeCount, matchCount: pfs.length };
  }, [pathFamilies, selectedPrefix]);

  // SVG layout
  const W = 620, H = 380;
  const colX = [50, 280, 500];
  const spacing = (nodes: unknown[]) => H / (nodes.length + 1);

  function nodeXY(column: number, y: number, nodes: unknown[]): [number, number] {
    return [colX[column], spacing(nodes) * (y + 1)];
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 380, background: "#0c0c1c", borderRadius: 4, border: "1px solid #2a2a48" }}>
      <div style={{
        padding: "6px 10px", fontSize: 10, fontWeight: 600, color: "#7777a0",
        textTransform: "uppercase", letterSpacing: "0.05em", background: "rgba(0,0,0,0.3)",
        borderBottom: "1px solid #2a2a48",
      }}>
        Observed BGP AS-path families
        <span style={{ display: "block", fontWeight: 400, fontSize: 9, textTransform: "none", color: "#555", marginTop: 1 }}>
          Collector RIBs → transit ASNs → origin ASNs. Line thickness = observed path count. Not physical cables.
        </span>
      </div>
      {selectedPrefix && matchCount === 0 && (
        <div style={{ padding: "20px", textAlign: "center", color: "#888", fontSize: 12 }}>
          No path-family records matched prefix <code style={{ color: "#aaa" }}>{selectedPrefix}</code>.<br />
          <span style={{ fontSize: 10, color: "#666" }}>This may indicate an allocation/BGP subprefix mapping issue.</span>
        </div>
      )}
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: matchCount === 0 && selectedPrefix ? "none" : "block" }}>
        {/* Column headers */}
        <text x={colX[0]} y={18} textAnchor="middle" fill="#666" fontSize={9} fontWeight={600}>COLLECTOR RIBS</text>
        <text x={colX[1]} y={18} textAnchor="middle" fill="#666" fontSize={9} fontWeight={600}>TRANSIT / UPSTREAM</text>
        <text x={colX[2]} y={18} textAnchor="middle" fill="#666" fontSize={9} fontWeight={600}>ORIGIN ASNS</text>

        {/* Edges */}
        {edges.map((e, i) => {
          // Find source/target positions
          const sNode = [...collectorNodes, ...transitNodes].find(n => n.id === e.src);
          const tNode = [...transitNodes, ...originNodes].find(n => n.id === e.tgt);
          if (!sNode || !tNode) return null;
          const sNodes = sNode.column === 0 ? collectorNodes : transitNodes;
          const tNodes = tNode.column === 1 ? transitNodes : originNodes;
          const [sx, sy] = nodeXY(sNode.column, sNode.y, sNodes);
          const [tx, ty] = nodeXY(tNode.column, tNode.y, tNodes);
          const midX = (sx + tx) / 2;
          const sw = Math.max(0.3, (e.count / maxEdgeCount) * 4);
          const color = tNode.column === 2 ? (ORIGIN_COLORS[(tNode as any).asn] ?? "#777") : "#556";
          return (
            <path key={i} d={`M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`}
              fill="none" stroke={color} strokeWidth={sw} strokeOpacity={e.opacity} />
          );
        })}

        {/* Collector nodes */}
        {collectorNodes.map(n => {
          const [x, y] = nodeXY(0, n.y, collectorNodes);
          return (
            <g key={n.id} style={{ cursor: "pointer" }} onClick={() => onSelectCollector(n.id)}>
              <circle cx={x} cy={y} r={6} fill="#5588aa" stroke="#7ab0cc" strokeWidth={1.5} />
              <text x={x + 12} y={y + 1} textAnchor="start" fill="#b0c8dd" fontSize={10} dominantBaseline="middle">{n.label}</text>
              <text x={x + 12} y={y + 13} textAnchor="start" fill="#556" fontSize={8}>{n.sublabel}</text>
            </g>
          );
        })}

        {/* Transit nodes */}
        {transitNodes.map(n => {
          const [x, y] = nodeXY(1, n.y, transitNodes);
          const r = Math.max(5, Math.min(14, 5 + (n.prefixCount ?? 0) / 3));
          return (
            <g key={n.id}>
              <circle cx={x} cy={y} r={r} fill="#6a6a8a" stroke="#8888aa" strokeWidth={1} />
              <text x={x + r + 6} y={y + 1} textAnchor="start" fill="#bbb" fontSize={10} dominantBaseline="middle">{n.label}</text>
              {n.sublabel && <text x={x + r + 6} y={y + 13} textAnchor="start" fill="#666" fontSize={8}>{n.sublabel}</text>}
            </g>
          );
        })}

        {/* Origin nodes */}
        {originNodes.map(n => {
          const [x, y] = nodeXY(2, n.y, originNodes);
          const r = Math.max(8, Math.min(20, 8 + n.count / 5));
          const color = ORIGIN_COLORS[n.asn] ?? "#8877aa";
          return (
            <g key={n.id}>
              <circle cx={x} cy={y} r={r} fill={color} stroke={color} strokeWidth={2} fillOpacity={0.8} />
              <text x={x} y={y + r + 14} textAnchor="middle" fill={color} fontSize={11} fontWeight={600}>{n.label}</text>
              <text x={x} y={y + r + 26} textAnchor="middle" fill="#777" fontSize={9}>{n.sublabel}</text>
            </g>
          );
        })}
      </svg>
      <div style={{
        position: "absolute", bottom: 6, left: 10, right: 10,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontSize: 9, color: "#555" }}>
          {pathFamilies.length} path families · {selectedPrefix ? "Filtered to selected prefix" : "All observed paths"}
        </span>
        <span style={{ fontSize: 9, color: "#555" }}>
          Click collector to filter · Click prefix in fingerprint
        </span>
      </div>
    </div>
  );
}
