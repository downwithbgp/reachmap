/**
 * AS-Path Visibility Graph — the main ReachMap visualization.
 *
 * Shows what BGP collector RIBs observe about a country's routed address space:
 * which AS paths carry Cuban prefixes, through which transit networks,
 * from which observation points.
 *
 * NOT physical cables. NOT data-plane paths. NOT traceroutes.
 * Each edge = an observed AS-path adjacency in sampled BGP collector RIBs.
 */

import React, { useMemo, useState, useCallback } from "react";
import type { PathFamilyRecord, AsnMetadata, Viewpoint } from "../types";

// Documented collector set
const COLLECTORS = [
  { id: "route-views2", label: "Eugene, OR", sublabel: "route-views2", region: "US West" },
  { id: "route-views4", label: "San Jose, CA", sublabel: "route-views4", region: "US West" },
  { id: "route-views.eqix", label: "Ashburn, VA", sublabel: "route-views.eqix", region: "US East" },
  { id: "route-views.linx", label: "London, UK", sublabel: "route-views.linx", region: "Europe" },
  { id: "rrc00", label: "Amsterdam, NL", sublabel: "rrc00", region: "Europe" },
];

// Origin color palette
const ORIGIN_PALETTE = ["#5b9bd5", "#45b7aa", "#d4a040", "#8877aa", "#cc6666", "#55aa88"];

// Column definitions
const COLUMNS = [
  { id: "collectors", label: "Collector RIBs", x: 50, width: 100 },
  { id: "peers", label: "Peer ASNs", x: 200, width: 90 },
  { id: "transit", label: "Transit ASNs", x: 340, width: 90 },
  { id: "origin", label: "Origin ASNs", x: 490, width: 90 },
  { id: "prefixes", label: "Prefix space", x: 620, width: 100 },
];

const GRAPH_W = 740;
const GRAPH_H = 420;

interface NodeInfo {
  id: string;
  label: string;
  sublabel?: string;
  column: number;
  y: number;
  count: number;
  prefixCount: number;
  asn?: number;
  role: string;
  collectorId?: string;
}

interface EdgeInfo {
  src: string;
  tgt: string;
  count: number;
  opacity: number;
  srcColumn: number;
  tgtColumn: number;
}

interface Props {
  pathFamilies: PathFamilyRecord[];
  viewpoints: Viewpoint[];
  asnMap: Map<number, AsnMetadata>;
  selectedPrefix: string | null;
  selectedCollectorId: string | null;
  onSelectCollector: (id: string | null) => void;
}

function asnLabel(asn: number, map: Map<number, AsnMetadata>): string {
  return map.get(asn)?.displayName ?? `AS${asn}`;
}

function asnRole(asn: number, map: Map<number, AsnMetadata>): string {
  return map.get(asn)?.role ?? "unknown";
}

export function PathGraph({ pathFamilies, viewpoints, asnMap, selectedPrefix, selectedCollectorId, onSelectCollector }: Props) {
  const [hoveredNode, setHoveredNode] = useState<NodeInfo | null>(null);

  // Filter path families by collector selection
  const filteredFamilies = useMemo(() => {
    if (!selectedCollectorId) return pathFamilies;
    const vp = viewpoints.find(v => v.collector === selectedCollectorId || v.id === selectedCollectorId);
    if (!vp) return pathFamilies;
    const ids = new Set(vp.pathFamilyIds);
    return pathFamilies.filter(pf => ids.has(pf.id));
  }, [pathFamilies, viewpoints, selectedCollectorId]);

  // Build graph nodes and edges
  const { allNodes, allEdges, maxEdgeCount, totalPrefixes } = useMemo(() => {
    const pfs = filteredFamilies.filter(pf => Array.isArray(pf.path) && pf.path.length > 0);
    const totalPrefixes = new Set<string>();
    pfs.forEach(pf => pf.prefixes.forEach(p => totalPrefixes.add(p)));

    // ── Column 0: Collectors ──
    const collectorNodes: NodeInfo[] = COLLECTORS.map((c, i) => ({
      id: c.id,
      label: c.label,
      sublabel: c.sublabel,
      column: 0,
      y: i,
      count: pfs.length,
      prefixCount: selectedCollectorId === c.id
        ? new Set(pfs.flatMap(pf => pf.prefixes)).size
        : 0,
      role: "collector",
      collectorId: c.id,
    }));

    // ── Column 1: Peer ASNs (first hop in path) ──
    const peerMap = new Map<number, { count: number; prefixes: Set<string> }>();
    for (const pf of pfs) {
      if (pf.path.length === 0) continue;
      const peerAsn = pf.path[0];
      const e = peerMap.get(peerAsn) ?? { count: 0, prefixes: new Set() };
      e.count++;
      pf.prefixes.forEach(p => e.prefixes.add(p));
      peerMap.set(peerAsn, e);
    }
    const peerNodes: NodeInfo[] = [...peerMap.entries()]
      .sort((a, b) => b[1].prefixes.size - a[1].prefixes.size)
      .slice(0, 6)
      .map(([asn, data], i) => ({
        id: `peer-${asn}`,
        label: asnLabel(asn, asnMap),
        sublabel: `AS${asn}`,
        column: 1,
        y: i,
        count: data.count,
        prefixCount: data.prefixes.size,
        asn,
        role: asnRole(asn, asnMap),
      }));

    // ── Column 2: Transit ASNs (middle hops) ──
    const transitMap = new Map<number, { count: number; prefixes: Set<string> }>();
    for (const pf of pfs) {
      const hops = pf.path.slice(1, -1);
      for (const asn of hops) {
        const e = transitMap.get(asn) ?? { count: 0, prefixes: new Set() };
        e.count++;
        pf.prefixes.forEach(p => e.prefixes.add(p));
        transitMap.set(asn, e);
      }
    }
    const transitNodes: NodeInfo[] = [...transitMap.entries()]
      .sort((a, b) => b[1].prefixes.size - a[1].prefixes.size)
      .slice(0, 8)
      .map(([asn, data], i) => ({
        id: `transit-${asn}`,
        label: asnLabel(asn, asnMap),
        sublabel: `AS${asn}`,
        column: 2,
        y: i,
        count: data.count,
        prefixCount: data.prefixes.size,
        asn,
        role: asnRole(asn, asnMap),
      }));

    // ── Column 3: Origin ASNs (last hop) ──
    const originMap = new Map<number, { count: number; prefixes: Set<string> }>();
    for (const pf of pfs) {
      const originAsn = pf.originAsn;
      const e = originMap.get(originAsn) ?? { count: 0, prefixes: new Set() };
      e.count++;
      pf.prefixes.forEach(p => e.prefixes.add(p));
      originMap.set(originAsn, e);
    }
    const originNodes: NodeInfo[] = [...originMap.entries()]
      .sort((a, b) => b[1].prefixes.size - a[1].prefixes.size)
      .map(([asn, data], i) => ({
        id: `origin-${asn}`,
        label: asnLabel(asn, asnMap),
        sublabel: `AS${asn}`,
        column: 3,
        y: i,
        count: data.count,
        prefixCount: data.prefixes.size,
        asn,
        role: "origin",
      }));

    // ── Column 4: Prefix space summary ──
    const prefixNodes: NodeInfo[] = [{
      id: "prefix-space",
      label: "Cuban prefixes",
      sublabel: `${totalPrefixes.size} prefixes`,
      column: 4,
      y: 0,
      count: pfs.length,
      prefixCount: totalPrefixes.size,
      role: "prefixes",
    }];

    const allNodes = [...collectorNodes, ...peerNodes, ...transitNodes, ...originNodes, ...prefixNodes];

    // ── Build edges ──
    const edges: EdgeInfo[] = [];
    let maxEdgeCount = 1;

    // Collector → Peer edges
    for (const cn of collectorNodes) {
      for (const pn of peerNodes) {
        edges.push({ src: cn.id, tgt: pn.id, count: pn.count, opacity: 0.20, srcColumn: 0, tgtColumn: 1 });
      }
    }

    // Peer → Transit edges (from actual AS-path adjacency)
    for (const pn of peerNodes) {
      for (const tn of transitNodes) {
        const count = pfs.filter(pf => pf.path[0] === pn.asn && pf.path.slice(1, -1).includes(tn.asn!)).length;
        if (count > 0) {
          maxEdgeCount = Math.max(maxEdgeCount, count);
          edges.push({ src: pn.id, tgt: tn.id, count, opacity: 0.50, srcColumn: 1, tgtColumn: 2 });
        }
      }
    }

    // Transit → Origin edges
    for (const tn of transitNodes) {
      for (const on of originNodes) {
        const count = pfs.filter(pf => pf.path.slice(1, -1).includes(tn.asn!) && pf.originAsn === on.asn).length;
        if (count > 0) {
          maxEdgeCount = Math.max(maxEdgeCount, count);
          edges.push({ src: tn.id, tgt: on.id, count, opacity: 0.55, srcColumn: 2, tgtColumn: 3 });
        }
      }
    }

    // Origin → Prefix space edges
    for (const on of originNodes) {
      edges.push({ src: on.id, tgt: "prefix-space", count: on.count, opacity: 0.45, srcColumn: 3, tgtColumn: 4 });
    }

    return { allNodes, allEdges: edges, maxEdgeCount, totalPrefixes: totalPrefixes.size };
  }, [filteredFamilies, asnMap, selectedCollectorId]);

  // Helpers
  function nodesInColumn(col: number): NodeInfo[] {
    return allNodes.filter(n => n.column === col);
  }

  function nodePos(node: NodeInfo): [number, number] {
    const colNodes = nodesInColumn(node.column);
    const colDef = COLUMNS[node.column];
    const spacing = GRAPH_H / (colNodes.length + 1);
    return [colDef.x, spacing * (colNodes.indexOf(node) + 1)];
  }

  const handleNodeHover = useCallback((node: NodeInfo | null) => {
    setHoveredNode(node);
  }, []);

  // Column header labels
  const modeLabel = selectedCollectorId
    ? `Filtered: ${COLLECTORS.find(c => c.id === selectedCollectorId)?.label ?? selectedCollectorId}`
    : "All viewpoints — union";

  return (
    <div style={{
      position: "relative", width: "100%", height: "100%", minHeight: 420,
      background: "#0d1530", borderRadius: 6,
      border: "1px solid rgba(255,255,255,0.06)",
      overflow: "hidden",
    }}>
      {/* Title bar */}
      <div style={{
        padding: "8px 14px", display: "flex", justifyContent: "space-between", alignItems: "baseline",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#c8d8f0", letterSpacing: "-0.01em" }}>
            Observed BGP AS-path adjacencies
          </div>
          <div style={{ fontSize: 9, color: "#667788", marginTop: 1 }}>
            Each edge = an AS adjacency observed in at least one sampled collector RIB for Cuban prefixes.
            Not physical cables or data-plane paths.
          </div>
        </div>
        <div style={{
          fontSize: 10, color: "#8899bb", fontWeight: 500,
          padding: "3px 10px", borderRadius: 3,
          background: "rgba(255,255,255,0.04)",
        }}>
          {modeLabel}
        </div>
      </div>

      {/* SVG graph */}
      <svg width="100%" height="100%" viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`} style={{ display: "block" }}>
        {/* Column header text */}
        {COLUMNS.map(col => (
          <text key={col.id} x={col.x} y={20} textAnchor="middle"
            fill="#667788" fontSize={8} fontWeight={600} letterSpacing="0.05em">
            {col.label.toUpperCase()}
          </text>
        ))}

        {/* Edges */}
        {allEdges.map((e, i) => {
          const sNode = allNodes.find(n => n.id === e.src);
          const tNode = allNodes.find(n => n.id === e.tgt);
          if (!sNode || !tNode) return null;
          const [sx, sy] = nodePos(sNode);
          const [tx, ty] = nodePos(tNode);
          const midX = (sx + tx) / 2;
          const sw = Math.max(0.4, Math.min(6, (e.count / Math.max(1, maxEdgeCount)) * 5));
          const getOriginNodes = () => allNodes.filter(n => n.column === 3);
          const color = e.tgtColumn === 4 ? "rgba(46,204,113,0.4)"
            : e.tgtColumn === 3 ? (ORIGIN_PALETTE[getOriginNodes().findIndex(o => o.id === e.tgt)] ?? "#777")
            : "rgba(120,150,200,0.3)";
          return (
            <path key={i} d={`M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`}
              fill="none" stroke={color} strokeWidth={sw} strokeOpacity={e.opacity} />
          );
        })}

        {/* Nodes */}
        {allNodes.map(node => {
          const [x, y] = nodePos(node);
          const isCollector = node.column === 0;
          const isPrefix = node.column === 4;
          const isOrigin = node.column === 3;
          const isSelected = isCollector && node.collectorId === selectedCollectorId;
          const isHovered = hoveredNode?.id === node.id;

          const r = isPrefix ? 22
            : isOrigin ? Math.max(8, Math.min(18, 8 + node.prefixCount / 3))
            : isCollector ? 7
            : Math.max(5, Math.min(14, 5 + node.prefixCount / 4));

          const fillColor = isPrefix ? "rgba(46,204,113,0.25)"
            : isOrigin ? (ORIGIN_PALETTE[allNodes.filter(n => n.column === 3).indexOf(node)] ?? "#8877aa")
            : isCollector ? (isSelected ? "#ffd048" : "#68a0cc")
            : "#8899bb";

          const strokeColor = isPrefix ? "#2ecc71"
            : isOrigin ? fillColor
            : isCollector ? (isSelected ? "#ffe080" : "#88bbdd")
            : "#aabbdd";

          return (
            <g key={node.id}
              style={{ cursor: isCollector ? "pointer" : "default" }}
              onClick={() => { if (isCollector) onSelectCollector(selectedCollectorId === node.collectorId ? null : node.collectorId!); }}
              onMouseEnter={() => handleNodeHover(node)}
              onMouseLeave={() => handleNodeHover(null)}
            >
              {/* Hover highlight ring */}
              {isHovered && (
                <circle cx={x} cy={y} r={r + 4} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} />
              )}
              <circle cx={x} cy={y} r={r}
                fill={fillColor} stroke={strokeColor} strokeWidth={isSelected ? 2.5 : 1.5}
                fillOpacity={isCollector ? 1 : 0.85}
              />
              {/* Label */}
              <text x={x + r + 6} y={y + 1} textAnchor="start" fill={isSelected ? "#ffe080" : isOrigin ? fillColor : "#c8d8f0"}
                fontSize={isPrefix ? 11 : 10} fontWeight={isPrefix ? 600 : 500} dominantBaseline="middle">
                {node.label}
              </text>
              {node.sublabel && (
                <text x={x + r + 6} y={y + (isPrefix ? 14 : 13)} textAnchor="start" fill="#667788" fontSize={8}>
                  {node.sublabel}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Hover tooltip */}
      {hoveredNode && hoveredNode.column !== 4 && (
        <div style={{
          position: "absolute", bottom: 48, left: "50%", transform: "translateX(-50%)",
          padding: "8px 14px", background: "rgba(10,20,48,0.95)", borderRadius: 6,
          border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(6px)",
          fontSize: 10, color: "#c8d8f0", display: "flex", gap: 16, alignItems: "center",
          pointerEvents: "none",
        }}>
          <div>
            <span style={{ fontWeight: 600, color: "#e8e8f8" }}>{hoveredNode.label}</span>
            {hoveredNode.asn && <span style={{ color: "#667788", marginLeft: 8 }}>AS{hoveredNode.asn}</span>}
          </div>
          <div style={{ color: "#8899bb" }}>
            <span style={{ color: "#2ecc71", fontWeight: 600 }}>{hoveredNode.prefixCount}</span> prefixes
          </div>
          <div style={{ color: "#667788" }}>
            {hoveredNode.count} path families · role: {hoveredNode.role}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        position: "absolute", bottom: 6, left: 14, right: 14,
        display: "flex", justifyContent: "space-between",
        fontSize: 8, color: "#556678",
        borderTop: "1px solid rgba(255,255,255,0.04)",
        paddingTop: 6,
      }}>
        <span>{filteredFamilies.length} path families · {totalPrefixes} prefixes observed</span>
        <span>Click a collector to filter · Hover for details. Not physical cables.</span>
      </div>
    </div>
  );
}
