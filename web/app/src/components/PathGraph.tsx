/**
 * Logical AS-path flow graph.
 *
 * Shows observed BGP path families from collectors through transit ASNs
 * to origin ASNs. SVG-based Sankey-style flow diagram.
 * NOT physical cables — logical routing paths from sampled collector RIBs.
 */

import React, { useMemo } from "react";

import type { PathFamilyRecord } from "../types";

interface PathFamily extends PathFamilyRecord {
  normalizedPath?: number[];
  collectors?: string[];
  observationCount?: number;
}

interface Collector {
  collectorId: string;
  collectorName: string;
  city?: string | null;
  countryCode?: string | null;
}

interface Props {
  pathFamilies: PathFamily[];
  collectors: Collector[];
  selectedPrefix: string | null;
  selectedCollectorId: string | null;
  onSelectCollector: (id: string | null) => void;
}

interface FlowNode {
  id: string;
  label: string;
  sublabel?: string;
  column: number; // 0=collectors, 1=transit, 2=origin
  y: number;
  count: number; // number of path families through this node
}

interface FlowEdge {
  source: string;
  target: string;
  count: number;
  prefixCount: number;
  opacity: number;
}

const COLORS: Record<string, string> = {
  "27725": "#5b9bd5", // ETECSA — blue
  "11960": "#45b7aa", // ETECSA IXP — teal
  "10569": "#d4a040", // CENIAInternet — amber
  default: "#8877aa",
};

function originColor(asn: number): string {
  return COLORS[String(asn)] ?? COLORS.default;
}

export function PathGraph({ pathFamilies, collectors, selectedPrefix, selectedCollectorId, onSelectCollector }: Props) {
  const { nodes, edges, maxCount } = useMemo(() => {
    // Filter by selected prefix
    let pfs = pathFamilies;
    if (selectedPrefix) {
      pfs = pfs.filter(pf => pf.prefixes.includes(selectedPrefix));
    }
    if (selectedCollectorId) {
      const cidLabel = `AS-${selectedCollectorId}`; // rough match
      pfs = pfs.filter(pf => pf.collectors?.some(c => c.replace("AS", "") === selectedCollectorId.replace("vp-", "")));
    }

    // Build nodes from data
    const collectorNodes: FlowNode[] = collectors.slice(0, 5).map((c, i) => {
      const cid = c.collectorId;
      const count = pfs.filter(pf => pf.collectors?.some(co => co.includes(cid) || cid.includes(co))).length;
      return {
        id: cid,
        label: c.city ?? c.collectorId,
        sublabel: c.countryCode ?? undefined,
        column: 0,
        y: i,
        count,
      };
    });

    // Top transit ASNs (by prefix count across all relevant paths)
    const transitCounts = new Map<number, { count: number; prefixes: Set<string> }>();
    for (const pf of pfs) {
      // All ASNs between first and last are transit
      const transit = pf.path.slice(1, -1);
      for (const asn of transit) {
        const entry = transitCounts.get(asn) ?? { count: 0, prefixes: new Set() };
        entry.count++;
        pf.prefixes.forEach(p => entry.prefixes.add(p));
        transitCounts.set(asn, entry);
      }
    }

    const topTransit = [...transitCounts.entries()]
      .sort((a, b) => b[1].prefixes.size - a[1].prefixes.size)
      .slice(0, 8);

    const transitNodes: FlowNode[] = topTransit.map(([asn, data], i) => ({
      id: `AS${asn}`,
      label: `AS${asn}`,
      column: 1,
      y: i,
      count: data.count,
    }));

    // Origin ASNs
    const originCounts = new Map<number, number>();
    for (const pf of pfs) {
      originCounts.set(pf.originAsn, (originCounts.get(pf.originAsn) ?? 0) + pf.prefixes.length);
    }
    const originNodes: FlowNode[] = [...originCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([asn, count], i) => ({
        id: `AS${asn}`,
        label: asn === 27725 ? "ETECSA" : asn === 11960 ? "ETECSA IXP" : asn === 10569 ? "CENIAInternet" : `AS${asn}`,
        sublabel: `AS${asn}`,
        column: 2,
        y: i,
        count,
      }));

    // Build edges: collector → transit → origin
    const edges: FlowEdge[] = [];
    const maxCount = Math.max(
      ...[...collectorNodes, ...transitNodes, ...originNodes].map(n => n.count),
      1
    );

    // Collector → transit edges
    for (const cn of collectorNodes) {
      const relevantPfs = pfs.filter(pf => pf.collectors?.some(c => c.includes(cn.id) || cn.id.includes(c)));
      for (const tn of transitNodes) {
        const asn = parseInt(tn.id.replace("AS", ""));
        const count = relevantPfs.filter(pf => pf.path.includes(asn)).length;
        if (count > 0) {
          const prefixes = new Set(relevantPfs.filter(pf => pf.path.includes(asn)).flatMap(pf => pf.prefixes));
          edges.push({ source: cn.id, target: tn.id, count, prefixCount: prefixes.size, opacity: Math.max(0.15, count / maxCount) });
        }
      }
    }

    // Transit → origin edges
    for (const tn of transitNodes) {
      const tasn = parseInt(tn.id.replace("AS", ""));
      for (const on of originNodes) {
        const oasn = parseInt(on.id.replace("AS", ""));
        const count = pfs.filter(pf => pf.path.includes(tasn) && pf.originAsn === oasn).length;
        if (count > 0) {
          const prefixes = new Set(pfs.filter(pf => pf.path.includes(tasn) && pf.originAsn === oasn).flatMap(pf => pf.prefixes));
          edges.push({ source: tn.id, target: on.id, count, prefixCount: prefixes.size, opacity: Math.max(0.15, count / maxCount) });
        }
      }
    }

    // Also direct collector → origin edges for single-hop paths
    for (const cn of collectorNodes) {
      const relevantPfs = pfs.filter(pf => pf.collectors?.some(c => c.includes(cn.id) || cn.id.includes(c)));
      for (const on of originNodes) {
        const oasn = parseInt(on.id.replace("AS", ""));
        const directPfs = relevantPfs.filter(pf => pf.path.length <= 2 && pf.originAsn === oasn);
        if (directPfs.length > 0) {
          const prefixes = new Set(directPfs.flatMap(pf => pf.prefixes));
          edges.push({ source: cn.id, target: on.id, count: directPfs.length, prefixCount: prefixes.size, opacity: Math.max(0.15, directPfs.length / maxCount) });
        }
      }
    }

    return {
      nodes: [...collectorNodes, ...transitNodes, ...originNodes],
      edges,
      maxCount,
    };
  }, [pathFamilies, collectors, selectedPrefix, selectedCollectorId]);

  // Layout
  const W = 600, H = 400;
  const cols = [60, 260, 480]; // x positions for each column
  const colWidths = [160, 180, 110];

  // Position nodes
  const nodePositions = new Map<string, { x: number; y: number }>();
  const nodesByCol: FlowNode[][] = [[], [], []];
  for (const n of nodes) {
    nodesByCol[n.column].push(n);
  }
  for (let col = 0; col < 3; col++) {
    const colNodes = nodesByCol[col];
    const spacing = H / (colNodes.length + 1);
    colNodes.forEach((n, i) => {
      nodePositions.set(n.id, { x: cols[col] + colWidths[col] / 2, y: spacing * (i + 1) });
    });
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 380, background: "rgba(0,0,0,0.2)" }}>
      <div style={{
        padding: "6px 10px", fontSize: 10, fontWeight: 600, color: "#7777a0",
        textTransform: "uppercase", letterSpacing: "0.05em", background: "rgba(0,0,0,0.3)",
        borderBottom: "1px solid #2a2a48",
      }}>
        Observed BGP AS-path families
        <span style={{ display: "block", fontWeight: 400, fontSize: 9, textTransform: "none", color: "#555", marginTop: 1 }}>
          Logical routing paths from sampled collector RIBs. Not physical cables.
        </span>
      </div>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        {/* Edges */}
        {edges.map((e, i) => {
          const sp = nodePositions.get(e.source);
          const tp = nodePositions.get(e.target);
          if (!sp || !tp) return null;
          // Find the origin ASN for coloring
          const targetNode = nodes.find(n => n.id === e.target);
          const color = targetNode ? originColor(parseInt(targetNode.id.replace("AS", "")) || 0) : "#666";
          const midX = (sp.x + tp.x) / 2;
          const d = `M ${sp.x} ${sp.y} C ${midX} ${sp.y}, ${midX} ${tp.y}, ${tp.x} ${tp.y}`;
          const sw = Math.max(0.5, (e.count / maxCount) * 6);
          return (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={sw}
              strokeOpacity={e.opacity}
            />
          );
        })}
        {/* Nodes */}
        {nodes.map(n => {
          const pos = nodePositions.get(n.id);
          if (!pos) return null;
          const isCol = n.column === 0;
          const isOrigin = n.column === 2;
          const asn = parseInt(n.id.replace("AS", ""));
          const color = isOrigin ? originColor(asn || 0) : isCol ? "#89aacc" : "#999";
          const r = Math.max(4, Math.min(18, 4 + (n.count / maxCount) * 14));
          const isClickable = isCol;
          return (
            <g key={n.id} style={{ cursor: isClickable ? "pointer" : "default" }}
               onClick={() => isClickable ? onSelectCollector(n.id) : undefined}>
              <circle cx={pos.x} cy={pos.y} r={r} fill={color} fillOpacity={0.85} stroke={color} strokeWidth={1} />
              <text x={pos.x} y={pos.y + r + 13} textAnchor="middle" fill="#ccc" fontSize={10} fontWeight={isOrigin ? 600 : 400}>
                {n.label}
              </text>
              {n.sublabel && (
                <text x={pos.x} y={pos.y + r + 25} textAnchor="middle" fill="#777" fontSize={9}>
                  {n.sublabel}
                </text>
              )}
            </g>
          );
        })}
        {/* Column headers */}
        <text x={cols[0] + colWidths[0]/2} y={15} textAnchor="middle" fill="#666" fontSize={9}>COLLECTORS</text>
        <text x={cols[1] + colWidths[1]/2} y={15} textAnchor="middle" fill="#666" fontSize={9}>TRANSIT ASNS</text>
        <text x={cols[2] + colWidths[2]/2} y={15} textAnchor="middle" fill="#666" fontSize={9}>ORIGIN ASNS</text>
      </svg>
      {/* Click instructions */}
      <div style={{
        position: "absolute", bottom: 6, right: 10,
        fontSize: 9, color: "#555",
      }}>
        Click collector to filter · Click prefix in Hilbert to filter paths
      </div>
    </div>
  );
}
