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

const COLLECTORS = [
  { id: "route-views2", label: "Eugene, OR", sublabel: "route-views2", region: "US West" },
  { id: "route-views4", label: "San Jose, CA", sublabel: "route-views4", region: "US West" },
  { id: "route-views.eqix", label: "Ashburn, VA", sublabel: "route-views.eqix", region: "US East" },
  { id: "route-views.linx", label: "London, UK", sublabel: "route-views.linx", region: "Europe" },
  { id: "rrc00", label: "Amsterdam, NL", sublabel: "rrc00", region: "Europe" },
];

const ORIGIN_PALETTE = ["#5b9bd5", "#45b7aa", "#d4a040", "#8877aa", "#cc6666", "#55aa88"];

const COLUMNS = [
  { id: "collectors", label: "Collector RIBs", x: 55 },
  { id: "peers", label: "Peer ASNs", x: 215 },
  { id: "transit", label: "Transit ASNs", x: 375 },
  { id: "origin", label: "Origin ASNs", x: 540 },
  { id: "prefixes", label: "Prefix space", x: 690 },
];

const GRAPH_W = 820;
const GRAPH_H = 420;

interface NodeInfo {
  id: string; label: string; sublabel?: string; column: number; y: number;
  count: number; prefixCount: number; asn?: number; role: string; collectorId?: string;
  adjacentAsns?: number[]; collectorIds?: string[];
}

interface EdgeInfo {
  id: string; src: string; tgt: string; count: number; opacity: number;
  srcColumn: number; tgtColumn: number; srcAsn?: number; tgtAsn?: number;
  collectorIds: string[]; examplePaths: number[][]; prefixCount: number;
}

interface Props {
  pathFamilies: PathFamilyRecord[];
  viewpoints: Viewpoint[];
  asnMap: Map<number, AsnMetadata>;
  selectedPrefix: string | null;
  selectedCollectorId: string | null;
  timestamp?: string;
  onSelectCollector: (id: string | null) => void;
}

function asnLabel(asn: number, map: Map<number, AsnMetadata>): string {
  return map.get(asn)?.displayName ?? `AS${asn}`;
}

function asnRole(asn: number, map: Map<number, AsnMetadata>): string {
  return map.get(asn)?.role ?? "unknown";
}

export function PathGraph({ pathFamilies, viewpoints, asnMap, selectedPrefix, selectedCollectorId, timestamp, onSelectCollector }: Props) {
  const [hoveredNode, setHoveredNode] = useState<NodeInfo | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<EdgeInfo | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<EdgeInfo | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeInfo | null>(null);

  function truncateLabel(label: string, maxLen: number = 18): string {
    return label.length > maxLen ? label.slice(0, maxLen - 1) + "…" : label;
  }

  const filteredFamilies = useMemo(() => {
    if (!selectedCollectorId) return pathFamilies;
    const vp = viewpoints.find(v => v.collector === selectedCollectorId || v.id === selectedCollectorId);
    if (!vp) return pathFamilies;
    const ids = new Set(vp.pathFamilyIds);
    return pathFamilies.filter(pf => ids.has(pf.id));
  }, [pathFamilies, viewpoints, selectedCollectorId]);

  const { allNodes, allEdges, maxEdgeCount, totalPrefixes, collectorCount, edgeCount } = useMemo(() => {
    const pfs = filteredFamilies.filter(pf => Array.isArray(pf.path) && pf.path.length > 0);
    const totalPrefixes = new Set<string>();
    pfs.forEach(pf => pf.prefixes.forEach(p => totalPrefixes.add(p)));
    const activeCollectorIds = new Set(selectedCollectorId ? [selectedCollectorId] : COLLECTORS.map(c => c.id));

    // ── Column 0: Collectors ──
    const collectorNodes: NodeInfo[] = COLLECTORS.map((c, i) => ({
      id: c.id, label: c.label, sublabel: c.sublabel, column: 0, y: i,
      count: pfs.length, prefixCount: totalPrefixes.size, role: "collector", collectorId: c.id,
    }));

    // ── Column 1: Peer ASNs ──
    const peerMap = new Map<number, { count: number; prefixes: Set<string>; collectors: Set<string> }>();
    for (const pf of pfs) {
      if (pf.path.length === 0) continue;
      const asn = pf.path[0];
      const e = peerMap.get(asn) ?? { count: 0, prefixes: new Set(), collectors: new Set() };
      e.count++; pf.prefixes.forEach(p => e.prefixes.add(p)); e.collectors.add("all");
      peerMap.set(asn, e);
    }
    const peerNodes: NodeInfo[] = [...peerMap.entries()]
      .sort((a, b) => b[1].prefixes.size - a[1].prefixes.size).slice(0, 6)
      .map(([asn, data], i) => ({
        id: `peer-${asn}`, label: asnLabel(asn, asnMap), sublabel: `AS${asn}`,
        column: 1, y: i, count: data.count, prefixCount: data.prefixes.size,
        asn, role: asnRole(asn, asnMap),
        collectorIds: [...data.collectors],
      }));

    // ── Column 2: Transit ASNs ──
    const transitMap = new Map<number, { count: number; prefixes: Set<string>; collectors: Set<string> }>();
    for (const pf of pfs) {
      for (const asn of pf.path.slice(1, -1)) {
        const e = transitMap.get(asn) ?? { count: 0, prefixes: new Set(), collectors: new Set() };
        e.count++; pf.prefixes.forEach(p => e.prefixes.add(p)); e.collectors.add("all");
        transitMap.set(asn, e);
      }
    }
    const transitNodes: NodeInfo[] = [...transitMap.entries()]
      .sort((a, b) => b[1].prefixes.size - a[1].prefixes.size).slice(0, 8)
      .map(([asn, data], i) => ({
        id: `transit-${asn}`, label: asnLabel(asn, asnMap), sublabel: `AS${asn}`,
        column: 2, y: i, count: data.count, prefixCount: data.prefixes.size,
        asn, role: asnRole(asn, asnMap),
        collectorIds: [...data.collectors],
        adjacentAsns: pfs.flatMap(pf => {
          const idx = pf.path.indexOf(asn);
          if (idx < 0) return [];
          const adj: number[] = [];
          if (idx > 0) adj.push(pf.path[idx - 1]);
          if (idx < pf.path.length - 1) adj.push(pf.path[idx + 1]);
          return adj;
        }).filter((v, i, a) => a.indexOf(v) === i).slice(0, 10),
      }));

    // ── Column 3: Origin ASNs ──
    const originMap = new Map<number, { count: number; prefixes: Set<string>; collectors: Set<string>; upstreams: Set<number> }>();
    for (const pf of pfs) {
      const asn = pf.originAsn;
      const e = originMap.get(asn) ?? { count: 0, prefixes: new Set(), collectors: new Set(), upstreams: new Set() };
      e.count++; pf.prefixes.forEach(p => e.prefixes.add(p)); e.collectors.add("all");
      if (pf.path.length >= 2) e.upstreams.add(pf.path[pf.path.length - 2]);
      originMap.set(asn, e);
    }
    const originNodes: NodeInfo[] = [...originMap.entries()]
      .sort((a, b) => b[1].prefixes.size - a[1].prefixes.size)
      .map(([asn, data], i) => ({
        id: `origin-${asn}`, label: asnLabel(asn, asnMap), sublabel: `AS${asn}`,
        column: 3, y: i, count: data.count, prefixCount: data.prefixes.size,
        asn, role: "origin",
        collectorIds: [...data.collectors],
        adjacentAsns: [...data.upstreams].slice(0, 6),
      }));

    // ── Column 4: Prefix space ──
    const prefixNodes: NodeInfo[] = [{
      id: "prefix-space", label: "Cuban prefixes", sublabel: `${totalPrefixes.size} prefixes`,
      column: 4, y: 0, count: pfs.length, prefixCount: totalPrefixes.size, role: "prefixes",
    }];

    const allNodes = [...collectorNodes, ...peerNodes, ...transitNodes, ...originNodes, ...prefixNodes];

    // ── Build edges with inspection data ──
    const edges: EdgeInfo[] = [];
    let maxEdgeCount = 1;

    // Collector → Peer (all-to-all, low opacity)
    for (const cn of collectorNodes) {
      for (const pn of peerNodes) {
        edges.push({
          id: `${cn.id}→${pn.id}`, src: cn.id, tgt: pn.id, count: pn.count, opacity: 0.15,
          srcColumn: 0, tgtColumn: 1, collectorIds: [cn.id], examplePaths: [], prefixCount: pn.prefixCount,
        });
      }
    }

    // Peer → Transit (from actual AS-path adjacency)
    for (const pn of peerNodes) {
      for (const tn of transitNodes) {
        const matching = pfs.filter(pf => pf.path[0] === pn.asn && pf.path.slice(1, -1).includes(tn.asn!));
        if (matching.length > 0) {
          maxEdgeCount = Math.max(maxEdgeCount, matching.length);
          const prefixSet = new Set(matching.flatMap(pf => pf.prefixes));
          edges.push({
            id: `${pn.id}→${tn.id}`, src: pn.id, tgt: tn.id, count: matching.length, opacity: 0.55,
            srcColumn: 1, tgtColumn: 2, srcAsn: pn.asn, tgtAsn: tn.asn,
            collectorIds: COLLECTORS.map(c => c.id),
            examplePaths: matching.slice(0, 3).map(pf => pf.path),
            prefixCount: prefixSet.size,
          });
        }
      }
    }

    // Transit → Origin
    for (const tn of transitNodes) {
      for (const on of originNodes) {
        const matching = pfs.filter(pf => pf.path.slice(1, -1).includes(tn.asn!) && pf.originAsn === on.asn);
        if (matching.length > 0) {
          maxEdgeCount = Math.max(maxEdgeCount, matching.length);
          const prefixSet = new Set(matching.flatMap(pf => pf.prefixes));
          edges.push({
            id: `${tn.id}→${on.id}`, src: tn.id, tgt: on.id, count: matching.length, opacity: 0.55,
            srcColumn: 2, tgtColumn: 3, srcAsn: tn.asn, tgtAsn: on.asn,
            collectorIds: COLLECTORS.map(c => c.id),
            examplePaths: matching.slice(0, 3).map(pf => pf.path),
            prefixCount: prefixSet.size,
          });
        }
      }
    }

    // Origin → Prefix space
    for (const on of originNodes) {
      edges.push({
        id: `${on.id}→prefix-space`, src: on.id, tgt: "prefix-space", count: on.count, opacity: 0.45,
        srcColumn: 3, tgtColumn: 4, srcAsn: on.asn,
        collectorIds: COLLECTORS.map(c => c.id), examplePaths: [], prefixCount: on.prefixCount,
      });
    }

    return {
      allNodes, allEdges: edges, maxEdgeCount,
      totalPrefixes: totalPrefixes.size,
      collectorCount: activeCollectorIds.size,
      edgeCount: edges.filter(e => e.examplePaths.length > 0).length,
    };
  }, [filteredFamilies, asnMap, selectedCollectorId]);

  function nodesInColumn(col: number): NodeInfo[] { return allNodes.filter(n => n.column === col); }
  function nodePos(node: NodeInfo): [number, number] {
    const colNodes = nodesInColumn(node.column);
    const spacing = GRAPH_H / (colNodes.length + 1);
    return [COLUMNS[node.column].x, spacing * (colNodes.indexOf(node) + 1)];
  }

  // Edge highlighting logic
  const isEdgeHighlighted = useCallback((e: EdgeInfo) => {
    if (!selectedEdge && !hoveredEdge) return false;
    return e.id === (selectedEdge ?? hoveredEdge)!.id;
  }, [selectedEdge, hoveredEdge]);

  const isEdgeDimmed = useCallback((e: EdgeInfo) => {
    if (!selectedEdge && !hoveredEdge) return false;
    return e.id !== (selectedEdge ?? hoveredEdge)!.id;
  }, [selectedEdge, hoveredEdge]);

  const handleEdgeClick = useCallback((e: EdgeInfo) => {
    setSelectedNode(null);
    setSelectedEdge(prev => prev?.id === e.id ? null : e);
  }, []);

  const handleNodeClick = useCallback((node: NodeInfo) => {
    setSelectedEdge(null);
    setSelectedNode(prev => prev?.id === node.id ? null : node);
  }, []);

  const modeLabel = selectedCollectorId
    ? `Filtered: ${COLLECTORS.find(c => c.id === selectedCollectorId)?.label ?? selectedCollectorId}`
    : "All viewpoints — union";

  return (
    <div style={{
      position: "relative", width: "100%", height: "100%", minHeight: 460,
      background: "#0d1530", borderRadius: 6,
      border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden",
    }}>
      {/* Title bar + data summary */}
      <div style={{
        padding: "8px 14px 6px", borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#c8d8f0", letterSpacing: "-0.01em" }}>
            Observed BGP AS-path adjacencies
          </div>
          {/* Data summary strip */}
          <div style={{ display: "flex", gap: 16, marginTop: 4, flexWrap: "wrap" }}>
            {timestamp && <span style={{ fontSize: 8, color: "#556678" }}>Timestamp: {timestamp}</span>}
            <span style={{ fontSize: 8, color: "#667788" }}>
              Collectors: <span style={{ color: "#8899bb" }}>{collectorCount}</span>
            </span>
            <span style={{ fontSize: 8, color: "#667788" }}>
              Prefixes: <span style={{ color: "#2ecc71" }}>{totalPrefixes}</span>
            </span>
            <span style={{ fontSize: 8, color: "#667788" }}>
              Path families: <span style={{ color: "#8899bb" }}>{filteredFamilies.length}</span>
            </span>
            <span style={{ fontSize: 8, color: "#667788" }}>
              Edges: <span style={{ color: "#8899bb" }}>{edgeCount}</span> observed AS adjacencies
            </span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
          <div style={{
            fontSize: 10, color: "#8899bb", fontWeight: 500,
            padding: "2px 8px", borderRadius: 3, background: "rgba(255,255,255,0.04)",
            cursor: "default",
          }} title="Union: a prefix/path is included if at least one selected collector RIB observed it.">
            {modeLabel}
          </div>
          <div style={{ fontSize: 7, color: "#445566" }}>
            Union — seen by any selected collector
          </div>
        </div>
      </div>

      {/* Narrative caption */}
      <div style={{ padding: "2px 14px", fontSize: 8, color: "#556678", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        Each line is an AS adjacency observed in collector RIBs for Cuban prefixes at this timestamp. Wider lines carried visibility for more prefixes.
      </div>

      {/* Legends */}
      <div style={{ display: "flex", gap: 16, padding: "3px 14px" }}>
        <span style={{ fontSize: 7, color: "#556678" }}>Edge width = prefix count through adjacency</span>
        <span style={{ fontSize: 7, color: "#556678" }}>Node size = prefixes associated</span>
        <span style={{ fontSize: 7, color: "#556678" }}>Click edge/node to inspect · Click again to clear</span>
      </div>

      {/* SVG graph */}
      <svg width="100%" height="100%" viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`} style={{ display: "block" }}>
        {/* Column headers */}
        {COLUMNS.map(col => (
          <text key={col.id} x={col.x} y={18} textAnchor="middle"
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
          const sw = Math.max(0.3, Math.min(6, (e.count / Math.max(1, maxEdgeCount)) * 5));
          const highlighted = isEdgeHighlighted(e);
          const dimmed = isEdgeDimmed(e);
          const getOriginNodes = () => allNodes.filter(n => n.column === 3);
          const baseColor = e.tgtColumn === 4 ? "rgba(46,204,113,0.4)"
            : e.tgtColumn === 3 ? (ORIGIN_PALETTE[getOriginNodes().findIndex(o => o.id === e.tgt)] ?? "#777")
            : "rgba(120,150,200,0.3)";
          const color = highlighted ? "rgba(255,255,255,0.7)" : dimmed ? "rgba(60,80,100,0.08)" : baseColor;
          const opacity = highlighted ? 0.9 : dimmed ? 0.06 : e.opacity;
          const strokeW = highlighted ? sw + 1.5 : sw;

          return (
            <g key={i}>
              {/* Invisible wider hit area for hover */}
              <path d={`M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`}
                fill="none" stroke="transparent" strokeWidth={strokeW + 8}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoveredEdge(e)}
                onMouseLeave={() => setHoveredEdge(null)}
                onClick={() => handleEdgeClick(e)}
              />
              <path d={`M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`}
                fill="none" stroke={color} strokeWidth={strokeW} strokeOpacity={opacity}
                style={{ pointerEvents: "none" }} />
            </g>
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
          const isDimmed = !!selectedEdge && !isHovered && !isSelected;

          const r = isPrefix ? 22 : isOrigin ? Math.max(8, Math.min(18, 8 + node.prefixCount / 3))
            : isCollector ? 7 : Math.max(5, Math.min(14, 5 + node.prefixCount / 4));

          const fillColor = isPrefix ? "rgba(46,204,113,0.25)"
            : isOrigin ? (ORIGIN_PALETTE[allNodes.filter(n => n.column === 3).indexOf(node)] ?? "#8877aa")
            : isCollector ? (isSelected ? "#ffd048" : "#68a0cc") : "#8899bb";

          const strokeColor = isPrefix ? "#2ecc71" : isOrigin ? fillColor
            : isCollector ? (isSelected ? "#ffe080" : "#88bbdd") : "#aabbdd";

          const dimOpacity = isDimmed ? 0.25 : 1;

          return (
            <g key={node.id}
              style={{ cursor: isCollector || !isPrefix ? "pointer" : "default", opacity: dimOpacity, transition: "opacity 0.2s" }}
              onClick={() => {
                if (isCollector) onSelectCollector(selectedCollectorId === node.collectorId ? null : node.collectorId!);
                if (!isPrefix) handleNodeClick(node);
              }}
              onMouseEnter={() => setHoveredNode(node)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              {(isHovered || selectedNode?.id === node.id) && (
                <circle cx={x} cy={y} r={r + 4} fill="none"
                  stroke={selectedNode?.id === node.id ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.3)"}
                  strokeWidth={selectedNode?.id === node.id ? 2 : 1.5} />
              )}
              <circle cx={x} cy={y} r={r}
                fill={fillColor} stroke={strokeColor} strokeWidth={isSelected ? 2.5 : (selectedNode?.id === node.id ? 2.5 : 1.5)}
                fillOpacity={isCollector ? 1 : 0.85} />
              <text x={x + r + 6} y={y + 1} textAnchor="start"
                fill={isSelected ? "#ffe080" : isOrigin ? fillColor : "#c8d8f0"}
                fontSize={isPrefix ? 11 : 10} fontWeight={isPrefix ? 600 : 500} dominantBaseline="middle">
                {isPrefix ? node.label : truncateLabel(node.label)}
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

      {/* Hover tooltip: Node */}
      {hoveredNode && !hoveredEdge && (
        <div style={{
          position: "absolute", bottom: 52, left: "50%", transform: "translateX(-50%)",
          padding: "10px 16px", background: "rgba(10,20,48,0.97)", borderRadius: 6,
          border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(8px)",
          fontSize: 10, color: "#c8d8f0", display: "flex", flexDirection: "column", gap: 4,
          pointerEvents: "none", maxWidth: 500, zIndex: 20,
        }}>
          <div style={{ fontWeight: 600, color: "#e8e8f8", fontSize: 11 }}>
            {hoveredNode.column === 0 ? "Observation point" :
             hoveredNode.column === 1 ? "Peer ASN" :
             hoveredNode.column === 2 ? "Transit ASN" :
             hoveredNode.column === 3 ? "Origin ASN" : "Prefix space"}
          </div>
          <div>
            <span style={{ color: "#e8e8f8" }}>{hoveredNode.label}</span>
            {hoveredNode.asn && <span style={{ color: "#667788", marginLeft: 8 }}>AS{hoveredNode.asn}</span>}
          </div>
          {hoveredNode.column === 0 && (
            <div style={{ color: "#8899bb" }}>
              Role: BGP RIB source<br />
              Prefixes observed: <span style={{ color: "#2ecc71" }}>{hoveredNode.prefixCount}</span> · Path families: {hoveredNode.count}
            </div>
          )}
          {hoveredNode.column >= 1 && hoveredNode.column <= 3 && (
            <div style={{ color: "#8899bb" }}>
              Seen by: <span style={{ color: "#aabbdd" }}>{hoveredNode.collectorIds?.length ?? 0}</span> collector RIBs<br />
              Prefixes: <span style={{ color: "#2ecc71" }}>{hoveredNode.prefixCount}</span> · Path families: {hoveredNode.count}
              {hoveredNode.adjacentAsns && hoveredNode.adjacentAsns.length > 0 && (
                <span><br />Adjacent ASNs: {hoveredNode.adjacentAsns.map(a => `AS${a}`).join(", ")}</span>
              )}
            </div>
          )}
          <div style={{ fontSize: 8, color: "#556678", marginTop: 2 }}>
            {hoveredNode.column === 0 ? "Not a network endpoint — an observation source" :
             "Not a physical location — a logical ASN in BGP paths"}
          </div>
        </div>
      )}

      {/* Hover tooltip: Edge */}
      {hoveredEdge && (
        <div style={{
          position: "absolute", bottom: 52, left: "50%", transform: "translateX(-50%)",
          padding: "10px 16px", background: "rgba(10,20,48,0.97)", borderRadius: 6,
          border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(8px)",
          fontSize: 10, color: "#c8d8f0", display: "flex", flexDirection: "column", gap: 4,
          pointerEvents: "none", maxWidth: 520, zIndex: 20,
        }}>
          <div style={{ fontWeight: 600, color: "#e8e8f8", fontSize: 11 }}>
            Observed AS-path adjacency
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "#aabbdd" }}>
            {hoveredEdge.srcAsn ? `AS${hoveredEdge.srcAsn}` : hoveredEdge.src} →{" "}
            {hoveredEdge.tgtAsn ? `AS${hoveredEdge.tgtAsn}` : hoveredEdge.tgt}
          </div>
          <div style={{ color: "#8899bb" }}>
            Prefixes through this adjacency: <span style={{ color: "#2ecc71", fontWeight: 600 }}>{hoveredEdge.prefixCount}</span>
            <br />Path families: {hoveredEdge.count}
          </div>
          {hoveredEdge.examplePaths.length > 0 && (
            <div style={{ color: "#667788", fontSize: 9 }}>
              Example observed AS paths:<br />
              {hoveredEdge.examplePaths.map((p, i) => (
                <span key={i} style={{ color: "#7788aa", fontFamily: "monospace" }}>
                  {p.map(a => `AS${a}`).join(" → ")}{i < hoveredEdge.examplePaths.length - 1 ? <br key={i} /> : null}
                </span>
              ))}
            </div>
          )}
          <div style={{ fontSize: 8, color: "#556678", marginTop: 2, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 4 }}>
            Not a physical link. Adjacency observed inside BGP AS paths in collector RIBs.
          </div>
        </div>
      )}

      {/* Persistent inspector — shown when node or edge is selected */}
      {(selectedNode || selectedEdge) && (
        <div style={{
          position: "absolute", bottom: 24, left: 14, right: 14,
          padding: "8px 14px", background: "rgba(10,20,48,0.97)", borderRadius: 6,
          border: "1px solid rgba(255,255,255,0.15)", backdropFilter: "blur(8px)",
          fontSize: 10, color: "#c8d8f0", display: "flex", gap: 20, alignItems: "flex-start",
          zIndex: 20, flexWrap: "wrap",
        }}>
          {selectedNode && (
            <>
              <div>
                <div style={{ fontWeight: 600, color: "#e8e8f8", fontSize: 11, marginBottom: 2 }}>
                  {selectedNode.column === 0 ? "Observation point" :
                   selectedNode.column === 1 ? "Peer ASN" :
                   selectedNode.column === 2 ? "Transit ASN" :
                   selectedNode.column === 3 ? "Origin ASN" : "Prefix space"}
                </div>
                <div style={{ color: "#aabbdd" }}>
                  {selectedNode.label}{selectedNode.asn ? <span style={{ color: "#667788" }}> · AS{selectedNode.asn}</span> : null}
                </div>
                <div style={{ color: "#8899bb", marginTop: 2 }}>
                  Prefixes: <span style={{ color: "#2ecc71", fontWeight: 600 }}>{selectedNode.prefixCount}</span> · Path families: {selectedNode.count}
                  {selectedNode.collectorIds && <span> · Seen by {selectedNode.collectorIds.length} collectors</span>}
                </div>
              </div>
              {selectedNode.adjacentAsns && selectedNode.adjacentAsns.length > 0 && (
                <div style={{ color: "#667788", fontSize: 9 }}>
                  Adjacent ASNs: {selectedNode.adjacentAsns.map(a => `AS${a}`).join(", ")}
                </div>
              )}
              <div style={{ fontSize: 8, color: "#556678", marginLeft: "auto" }}>
                {selectedNode.column === 0 ? "BGP RIB source — not a network endpoint" :
                 "Logical ASN in BGP paths — not a physical location"}
              </div>
            </>
          )}
          {selectedEdge && (
            <>
              <div>
                <div style={{ fontWeight: 600, color: "#e8e8f8", fontSize: 11, marginBottom: 2 }}>
                  Observed AS-path adjacency
                </div>
                <div style={{ fontFamily: "monospace", fontSize: 11, color: "#aabbdd" }}>
                  {selectedEdge.srcAsn ? `AS${selectedEdge.srcAsn}` : selectedEdge.src} →{" "}
                  {selectedEdge.tgtAsn ? `AS${selectedEdge.tgtAsn}` : selectedEdge.tgt}
                </div>
                <div style={{ color: "#8899bb", marginTop: 2 }}>
                  Prefixes: <span style={{ color: "#2ecc71", fontWeight: 600 }}>{selectedEdge.prefixCount}</span> · Path families: {selectedEdge.count}
                </div>
              </div>
              {selectedEdge.examplePaths.length > 0 && (
                <div style={{ color: "#667788", fontSize: 9 }}>
                  Example paths:<br />
                  {selectedEdge.examplePaths.map((p, i) => (
                    <span key={i} style={{ color: "#7788aa", fontFamily: "monospace" }}>
                      {p.map(a => `AS${a}`).join(" → ")}{i < selectedEdge.examplePaths.length - 1 ? <br key={i} /> : null}
                    </span>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 8, color: "#556678", marginLeft: "auto" }}>
                Not a physical link — adjacency inside BGP AS paths in collector RIBs
              </div>
            </>
          )}
          <div style={{ position: "absolute", top: 4, right: 10, cursor: "pointer", color: "#667788", fontSize: 11 }}
            onClick={() => { setSelectedNode(null); setSelectedEdge(null); }}>
            ✕
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        position: "absolute", bottom: 4, left: 14, right: 14,
        display: "flex", justifyContent: "space-between",
        fontSize: 7, color: "#556678",
        borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 4,
      }}>
        <span>Logical BGP view — AS-path adjacencies from collector RIBs</span>
        <span>Not physical cables or data-plane paths</span>
      </div>
    </div>
  );
}
