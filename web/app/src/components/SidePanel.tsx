import React from "react";
import type { Viewpoint, AsView, PathFamilyRecord, PrefixRecord, SelectionMode, ColorMode, PrefixVisibilityScore, AsnMetadata } from "../types";

function asnLabel(asn: number, asnMap: Map<number, AsnMetadata>): string {
  return asnMap.get(asn)?.displayName ?? `AS${asn}`;
}

interface Props {
  selectionMode: SelectionMode;
  colorMode: ColorMode;
  selectedVp: Viewpoint | null;
  selectedAsView: AsView | null;
  selectedPrefix: PrefixRecord | null;
  hoveredPrefix: PrefixRecord | null;
  allViewpoints: Viewpoint[];
  asViews: AsView[];
  pathFamilies: PathFamilyRecord[];
  visibilityScores: Map<string, PrefixVisibilityScore> | null;
  totalCollectors: number;
  dataMode: string;
  asnMap: Map<number, AsnMetadata>;
  onSelectAsn: (asn: number | null) => void;
  onClearSelection: () => void;
}

function findPathFamily(id: string, fams: PathFamilyRecord[]): PathFamilyRecord | undefined {
  return fams.find(f => f.id === id);
}

export function SidePanel({
  selectionMode, colorMode, selectedVp, selectedAsView,
  selectedPrefix, hoveredPrefix, allViewpoints, asViews, pathFamilies,
  visibilityScores, totalCollectors, dataMode, asnMap, onSelectAsn, onClearSelection,
}: Props) {
  const visibleCount = selectedVp
    ? selectedVp.visiblePrefixes.length
    : selectedAsView
    ? selectedAsView.visiblePrefixes.length
    : 0;
  const missingCount = selectedVp
    ? selectedVp.missingPrefixes.length
    : selectedAsView
    ? selectedAsView.missingPrefixes.length
    : 0;
  const total = visibleCount + missingCount;
  const pct = total > 0 ? Math.round((visibleCount / total) * 100) : 0;

  const relevantPaths = selectedVp
    ? selectedVp.pathFamilyIds.map(id => findPathFamily(id, pathFamilies)).filter(Boolean) as PathFamilyRecord[]
    : selectedAsView
    ? selectedAsView.pathFamilyIds.map(id => findPathFamily(id, pathFamilies)).filter(Boolean) as PathFamilyRecord[]
    : [];

  const showDetail = selectedVp || selectedAsView;

  return (
    <div style={{
      width: 280, maxHeight: "calc(100vh - 80px)", overflowY: "auto",
      background: "#111830", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6,
      padding: "16px 18px", display: "flex", flexDirection: "column", gap: 16,
      fontSize: 13, color: "#c8c8d8",
    }}>
      {/* Viewpoint / ASN selector */}
      <Section title="Observation Point">
        <select
          value={selectedVp?.id ?? (selectedAsView ? `asn-${selectedAsView.peerAsn}` : "")}
          onChange={(e) => {
            const val = e.target.value;
            if (!val) { onClearSelection(); return; }
            if (val.startsWith("asn-")) {
              onSelectAsn(parseInt(val.replace("asn-", "")));
            }
          }}
          style={{
            width: "100%", padding: "6px 8px", fontSize: 12,
            background: "#0a0a14", color: "#c8c8d8", border: "1px solid #2a2a48",
            borderRadius: 4, cursor: "pointer",
          }}
        >
          <option value="">All viewpoints</option>
          <optgroup label="By ASN (aggregate)">
            {asViews.map(a => (
              <option key={`asn-${a.peerAsn}`} value={`asn-${a.peerAsn}`}>
                {a.peerAsName ?? `AS${a.peerAsn}`} ({a.viewpointIds.length} viewpoints)
              </option>
            ))}
          </optgroup>
          <optgroup label="By viewpoint">
            {allViewpoints.map(vp => (
              <option key={vp.id} value={vp.id}>
                {vp.displayName} {vp.peerAsName ? `/ AS${vp.peerAsn}` : ""}
              </option>
            ))}
          </optgroup>
        </select>
      </Section>

      {/* Detail */}
      {showDetail && (
        <Section title={selectedVp ? "Viewpoint Detail" : "ASN Aggregate"}>
          <StatRow label="ASN" value={selectedVp ? `AS${selectedVp.peerAsn}` : `AS${selectedAsView!.peerAsn}`} />
          <StatRow label="Name" value={selectedVp?.peerAsName ?? selectedAsView!.peerAsName ?? "—"} />
          {selectedVp && (
            <>
              <StatRow label="Collector" value={selectedVp.collector} />
              <StatRow label="Location" value={selectedVp.geo.city ?? selectedVp.geo.countryCode ?? "—"} />
              <StatRow label="Region" value={selectedVp.regionGroup} />
              <StatRow label="Geo source" value={`${selectedVp.geo.kind.replace(/_/g, " ")} · ${selectedVp.geo.source}`} />
              <StatRow label="Confidence" value={`${Math.round(selectedVp.geo.confidence * 100)}% · ${selectedVp.geo.precision ?? "unknown"}`} />
            </>
          )}
          {selectedAsView && (
            <StatRow label="Viewpoints" value={selectedAsView.viewpointIds.length.toString()} />
          )}
          <StatRow label="BGP-visible" value={`${visibleCount} / ${total} (${pct}%)`} accent={pct > 60 ? "green" : pct > 30 ? "yellow" : "red"} />
          <StatRow label="Not in sampled RIBs" value={missingCount.toString()} accent="red" />
        </Section>
      )}

      {/* Mode indicator */}
      <div style={{
        padding: "4px 8px", borderRadius: 3, fontSize: 10,
        textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center",
        background: selectionMode === "viewpoint" ? "rgba(200,180,80,0.12)" :
                     selectionMode === "asn_aggregate" ? "rgba(100,180,200,0.12)" :
                     "rgba(255,255,255,0.05)",
        color: selectionMode === "viewpoint" ? "#d4b840" :
               selectionMode === "asn_aggregate" ? "#64b4c8" : "#888",
        fontWeight: 600,
      }}>
        {selectionMode === "viewpoint" ? "Single observation point" :
         selectionMode === "asn_aggregate" ? "ASN aggregate — all viewpoints for this AS" :
         "All viewpoints — union"}
      </div>

      {/* Path families */}
      {relevantPaths.length > 0 && (
        <Section title={`AS-Path Families (${relevantPaths.length})`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {relevantPaths.map(pf => (
              <div key={pf.id} style={{
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: 4, padding: "5px 8px", fontSize: 11, lineHeight: 1.6,
              }}>
                <div style={{ fontFamily: "monospace", fontSize: 10 }}>
                  {pf.path.map((as, i) =>
                    i === pf.path.length - 1
                      ? <strong key={i} style={{ color: "#e0c060" }}>AS{as}</strong>
                      : <span key={i}><code style={{ background: "rgba(255,255,255,0.05)", padding: "1px 3px", borderRadius: 2, fontSize: 10 }}>AS{as}</code> → </span>
                  )}
                </div>
                <div style={{ color: "#666", fontSize: 9, marginTop: 2 }}>
                  {pf.prefixes.length} prefixes · {pf.collectorCount} collectors
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Hovered / Selected prefix */}
      {(hoveredPrefix || selectedPrefix) && (
        <Section title={selectedPrefix ? "Selected Prefix" : "Hovered Prefix"}>
          <div style={{ fontFamily: "monospace", fontWeight: 600, fontSize: 14, color: "#fff", marginBottom: 6 }}>
            {selectedPrefix?.prefix ?? hoveredPrefix?.prefix}
          </div>
          {selectedPrefix && (
            <>
              <StatRow label="Origin" value={`${selectedPrefix.originAsns.map(a => asnLabel(a, asnMap)).join(", ")} (AS${selectedPrefix.originAsns.join(", AS")})`} />
              <StatRow label="Allocation" value={`${selectedPrefix.addressCount.toLocaleString()} IPs /${selectedPrefix.prefixLength}`} />
              <StatRow label="BGP observed" value={selectedPrefix.observedInBgp ? "Yes" : "No"} accent={selectedPrefix.observedInBgp ? "green" : "red"} />
              {visibilityScores && (
                (() => {
                  const score = visibilityScores.get(selectedPrefix.prefix);
                  if (score) {
                    return <>
                      <StatRow label="Visible in" value={`${score.observedCollectors} / ${score.totalCollectors} collector RIBs (${Math.round(score.visibilityRatio * 100)}%)`}
                        accent={score.visibilityRatio >= 1 ? "green" : score.visibilityRatio >= 0.5 ? "yellow" : "red"} />
                      {score.missingCollectorIds.length > 0 && (
                        <div style={{ fontSize: 10, color: "#e74c3c", marginTop: 2 }}>
                          Not seen in: {score.missingCollectorIds.join(", ")}
                        </div>
                      )}
                    </>;
                  }
                  return null;
                })()
              )}
            </>
          )}
          {hoveredPrefix && !selectedPrefix && (
            <div style={{ color: "#888", fontSize: 11 }}>Click to select this prefix</div>
          )}
        </Section>
      )}

      {/* Single-collector warning */}
      {dataMode === "real" && totalCollectors <= 1 && (
        <div style={{
          padding: "6px 10px", borderRadius: 4, fontSize: 10, lineHeight: 1.5,
          background: "rgba(255,200,50,0.08)", border: "1px solid rgba(255,200,50,0.15)",
          color: "#ccb860",
        }}>
          Consensus based on {totalCollectors} collector RIB in this snapshot.
          Add more collector RIBs for multi-collector consensus.
        </div>
      )}

      {/* Mode indicator */}
      <div style={{
        padding: "4px 8px", borderRadius: 3, fontSize: 10,
        textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center",
        background: colorMode === "consensus" ? "rgba(46,204,113,0.10)" :
                     colorMode === "selected" ? "rgba(200,180,80,0.10)" :
                     "rgba(100,180,200,0.10)",
        color: colorMode === "consensus" ? "#6ecc81" :
               colorMode === "selected" ? "#d4b840" :
               "#89c8d8",
        fontWeight: 600,
      }}>
        {colorMode === "consensus" ? "Control-plane visibility" :
         colorMode === "selected" ?
           (selectionMode === "viewpoint" ? "Single observation point" :
            selectionMode === "asn_aggregate" ? "ASN aggregate" : "Selected") :
         "Origin ASN mode"}
      </div>

      {/* Legend */}
      <Section title="Legend">
        <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
          {[...asnMap.values()].filter(a => a.role === "origin").map((a, i) => (
            <LegendItem key={a.asn} color={["hsl(215,72%,58%)","hsl(175,72%,58%)","hsl(40,72%,58%)","hsl(270,72%,58%)"][i] ?? "hsl(270,72%,58%)"} label={`${a.displayName} (AS${a.asn})`} />
          ))}
          <LegendItem color="hsl(270,72%,58%)" label="Other origin ASN" />
          <LegendItem color="hsl(215,12%,20%)" label="Not visible from vantage" border />
          <LegendItem color="#12121e" label="Allocated, not in BGP" border />
        </div>
      </Section>

      {/* Disclaimer */}
      <div style={{ fontSize: 10, color: "#667788", lineHeight: 1.5, fontStyle: "italic", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
        <strong style={{ color: "#777" }}>Important:</strong> This shows control-plane
        BGP collector RIB observations — not data-plane reachability, physical
        cables, or traceroutes. AS paths are logical routing policy, not fiber
        routes. Collector geography is approximate. BGP visibility does
        not prove end-user reachability.
      </div>
      {/* About / Method */}
      <Section title="About">
        <div style={{ fontSize: 10, color: "#777", lineHeight: 1.6 }}>
          <p style={{ marginBottom: 6 }}>
            <strong>What am I looking at?</strong> Each cell in the fingerprint is a
            block of IPv4 address space, arranged by numeric order on a Hilbert
            curve. Green = BGP-visible from all sampled collector RIBs.
          </p>
          <p style={{ marginBottom: 6 }}>
            <strong>What does green mean?</strong> At least one BGP peer at each sampled
            collector announced a route for that prefix. Green indicates control-plane
            visibility in the RIB dump — not end-user reachability.
          </p>
          <p style={{ marginBottom: 6 }}>
            <strong>Why can traffic drop while BGP stays green?</strong> BGP is the
            routing control plane. Traffic depends on power, access networks, mobile
            service, customer equipment, and data-plane forwarding. If any of those
            fail, users lose access while BGP routes remain announced.
          </p>
          <p style={{ marginBottom: 0 }}>
            <strong>Limitations:</strong> RIB snapshots are samples, not continuous.
            Collector location ≠ peer location. BGP visibility ≠ reachability.
            External traffic signals are case-study annotations, not live data.
          </p>
        </div>
      </Section>

      {/* Data provenance */}
      <div style={{ fontSize: 9, color: "#556678", lineHeight: 1.5, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8 }}>
        <strong style={{ color: "#555" }}>Data:</strong> RouteViews &amp; RIPE RIS RIBs.
        Prefix source: RIR delegated stats. Snapshot: 2026-05-28 00:00 UTC.
        External signal: Cloudflare Radar.
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 600, textTransform: "uppercase",
        letterSpacing: "0.06em", color: "#8899bb", marginBottom: 8,
        paddingBottom: 5, borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function StatRow({ label, value, accent }: { label: string; value: string; accent?: "green" | "red" | "yellow" }) {
  const color = accent === "green" ? "#2ecc71" : accent === "red" ? "#e74c3c" : accent === "yellow" ? "#d4b840" : "#bbccdd";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "2px 0", fontSize: 12 }}>
      <span style={{ color: "#8899bb", fontSize: 11 }}>{label}</span>
      <span style={{ fontWeight: 500, color, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function LegendItem({ color, label, border }: { color: string; label: string; border?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{
        width: 12, height: 12, borderRadius: 2, flexShrink: 0,
        background: color,
        border: border ? "1px solid #444" : undefined,
      }} />
      <span style={{ color: "#999" }}>{label}</span>
    </div>
  );
}
