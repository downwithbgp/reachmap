import React, { useState, useMemo, useCallback, useEffect } from "react";
import { HilbertCanvas } from "./components/HilbertCanvas";
import { PathGraph } from "./components/PathGraph";
import { SidePanel } from "./components/SidePanel";
import { loadAllRealData, loadConsensusData, loadAsnMetadata, loadManifest, loadCountryConfig, loadCasesFromManifest, buildRealVisibilitySet, loadTimelineIndex, loadTimelineConsensus, loadTimelinePrefixes } from "./dataLoader";
import { viewpoints as mockViewpoints, asViews as mockAsViews, cubaPrefixes as mockPrefixes, pathFamilies as mockPathFams, getViewpoint, getAsView } from "./data";
import type { Viewpoint, AsView, PrefixRecord, SelectionMode, PathFamilyRecord, ColorMode, PrefixVisibilityScore, ConsensusVisibility, TimelineIndex, TimelinePoint, AsnMetadata, AppManifest, CountryEntry, CountryMapConfig, CaseEntry } from "./types";

type DataMode = "mock" | "real" | "timeline";

export function App() {
  const [dataMode, setDataMode] = useState<DataMode>("timeline");
  const [loading, setLoading] = useState(true);
  const [manifest, setManifest] = useState<AppManifest | null>(null);
  const [countryConfig, setCountryConfig] = useState<CountryMapConfig | null>(null);
  const [cases, setCases] = useState<CaseEntry[] | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string>("mar2026");
  const [colorMode, setColorMode] = useState<ColorMode>("consensus");
  const [realData, setRealData] = useState<{
    prefixes: PrefixRecord[];
    viewpoints: Viewpoint[];
    asViews: AsView[];
    pathFamilies: PathFamilyRecord[];
    consensus: ConsensusVisibility | null;
  } | null>(null);

  const [asnMap, setAsnMap] = useState<Map<number, AsnMetadata>>(new Map());
  const [timelineIndex, setTimelineIndex] = useState<TimelineIndex | null>(null);
  const [timelineSnapshotId, setTimelineSnapshotId] = useState<string | null>(null);
  const [timelineConsensus, setTimelineConsensus] = useState<ConsensusVisibility | null>(null);
  const [timelinePrefixes, setTimelinePrefixes] = useState<PrefixRecord[] | null>(null);

  const [selectedVp, setSelectedVp] = useState<Viewpoint | null>(null);
  const [selectedAsView, setSelectedAsView] = useState<AsView | null>(null);
  const [selectedPrefix, setSelectedPrefix] = useState<PrefixRecord | null>(null);
  const [hoveredPrefix, setHoveredPrefix] = useState<PrefixRecord | null>(null);
  const [hoveredVp, setHoveredVp] = useState<Viewpoint | null>(null);

  // Active data
  const prefixes = dataMode === "timeline" && timelinePrefixes ? timelinePrefixes
    : dataMode === "real" && realData ? realData.prefixes : mockPrefixes;
  const viewpoints = dataMode === "real" && realData ? realData.viewpoints : mockViewpoints;
  const asViews = dataMode === "real" && realData ? realData.asViews : mockAsViews;
  const pathFamilies = dataMode === "real" && realData ? realData.pathFamilies : mockPathFams;
  const consensus = dataMode === "timeline" ? timelineConsensus
    : dataMode === "real" && realData ? realData.consensus : null;

  const selectionMode: SelectionMode = selectedVp ? "viewpoint" : selectedAsView ? "asn_aggregate" : "all";

  // Effective color mode: "selected" when a vantage is active, otherwise user choice
  const effectiveColorMode: ColorMode = (selectedVp || selectedAsView) ? "selected" : colorMode;

  const visibleSet = useMemo<Set<string> | null>(() => {
    if (!selectedVp && !selectedAsView) return null;
    const visPrefixes = selectedVp?.visiblePrefixes ?? selectedAsView?.visiblePrefixes ?? [];
    if (dataMode === "real") return buildRealVisibilitySet(visPrefixes, prefixes);
    return new Set(visPrefixes);
  }, [selectedVp, selectedAsView, dataMode, prefixes]);

  // Consensus visibility scores as a Map for Hilbert lookup
  const visibilityScores = useMemo<Map<string, PrefixVisibilityScore> | null>(() => {
    if (!consensus) return null;
    const m = new Map<string, PrefixVisibilityScore>();
    for (const [k, v] of Object.entries(consensus.visibilityByPrefix)) {
      m.set(k, v);
    }
    return m;
  }, [consensus]);

  const totalCollectors = consensus?.totalCollectors ?? (dataMode === "real" ? 1 : 5);

  const highlightedVpIds = useMemo<Set<string>>(() => {
    if (selectedVp) return new Set([selectedVp.id]);
    if (selectedAsView) return new Set(selectedAsView.viewpointIds);
    return new Set(viewpoints.map(v => v.id));
  }, [selectedVp, selectedAsView, viewpoints]);

  // Auto-load: manifest → country config → cases → case timeline
  useEffect(() => {
    async function bootstrap() {
      try {
        const m = await loadManifest();
        if (!m) { setLoading(false); return; }
        setManifest(m);

        const entry = m.countries.find(c => c.countryCode === m.defaultCountry) ?? m.countries[0];
        if (!entry) { setLoading(false); return; }

        const cfg = await loadCountryConfig(entry.mapConfigPath);
        if (cfg) setCountryConfig(cfg);

        const cs = await loadCasesFromManifest(entry.casesPath);
        if (cs) setCases(cs);

        const asns = await loadAsnMetadata(entry.asnCatalogPath);
        setAsnMap(asns);

        // Load default case timeline
        const defaultCaseId = m.defaultCase;
        setSelectedCaseId(defaultCaseId);
        const caseEntry = cs?.find(c => (c.caseStudyId ?? c.label?.includes("March")) === defaultCaseId);
        const caseTimelinePath = caseEntry?.timelinePath ?? caseEntry?.indexPath ?? `timeline/${defaultCaseId}/index.json`;

        const idx = await loadTimelineIndex(defaultCaseId, entry.dataRoot);
        if (idx && idx.points.length > 0) {
          setTimelineIndex(idx);
          setDataMode("timeline");
          const eventPt = caseEntry?.defaultSnapshotId
            ? idx.points.find(p => p.snapshotId === caseEntry.defaultSnapshotId)
            : (idx.points.find(p => p.role === "event") ?? idx.points[0]);
          if (eventPt) {
            const [cons, pfx] = await Promise.all([
              loadTimelineConsensus(eventPt.snapshotId, entry.dataRoot),
              loadTimelinePrefixes(eventPt.snapshotId, entry.dataRoot),
            ]);
            setTimelineConsensus(cons);
            setTimelinePrefixes(pfx);
            setTimelineSnapshotId(eventPt.snapshotId);
          }
        } else {
          // Fallback to real data
          await loadReal();
        }
      } catch (e) {
        console.error("Bootstrap failed:", e);
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, []);

  // Load real data
  const loadReal = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadAllRealData();
      const cons = await loadConsensusData();
      setRealData({ ...data, consensus: cons });
      setDataMode("real");
      setSelectedVp(null);
      setSelectedAsView(null);
      setSelectedPrefix(null);
    } catch (e) {
      console.error("Failed to load real data:", e);
      alert("Failed to load real data. Is the dev server running?");
    } finally {
      setLoading(false);
    }
  }, []);

  const switchToMock = useCallback(() => {
    setDataMode("mock");
    setSelectedVp(null); setSelectedAsView(null); setSelectedPrefix(null);
  }, []);

  // Timeline handlers
  const loadTimeline = useCallback(async (caseId = "mar2026") => {
    setLoading(true);
    try {
      const dataRoot = manifest?.countries[0]?.dataRoot ?? "/data/CU";
      const idx = await loadTimelineIndex(caseId, dataRoot);
      if (!idx || idx.points.length === 0) { alert("No timeline data found."); setLoading(false); return; }
      setTimelineIndex(idx);
      setDataMode("timeline");
      const eventPoint = idx.points.find(p => p.role === "event") ?? idx.points[0];
      await selectTimelineSnapshot(eventPoint.snapshotId, idx);
    } catch (e) {
      console.error("Failed to load timeline:", e);
      alert("Failed to load timeline data.");
    } finally { setLoading(false); }
  }, [manifest]);

  const selectTimelineSnapshot = useCallback(async (snapId: string, idx?: TimelineIndex) => {
    setTimelineSnapshotId(snapId);
    setSelectedVp(null); setSelectedAsView(null); setSelectedPrefix(null);
    const [cons, pfx] = await Promise.all([
      loadTimelineConsensus(snapId),
      loadTimelinePrefixes(snapId),
    ]);
    setTimelineConsensus(cons);
    setTimelinePrefixes(pfx);
  }, []);

  // Handlers
  const handleSelectViewpoint = useCallback((vp: Viewpoint | null) => {
    setSelectedVp(vp);
    setSelectedAsView(null);
    if (vp) setSelectedPrefix(null);
  }, []);

  const handleSelectAsn = useCallback((asn: number | null) => {
    if (asn === null) { setSelectedAsView(null); setSelectedVp(null); return; }
    const found = dataMode === "real" && realData
      ? realData.asViews.find(a => a.peerAsn === asn)
      : getAsView(asn);
    setSelectedAsView(found ?? null);
    setSelectedVp(null);
    setSelectedPrefix(null);
  }, [dataMode, realData]);

  const handleClearSelection = useCallback(() => {
    setSelectedVp(null);
    setSelectedAsView(null);
    setSelectedPrefix(null);
  }, []);

  const handleClickPrefix = useCallback((p: PrefixRecord | null) => {
    setSelectedPrefix(prev => prev === p ? null : p);
  }, []);

  const handleHoverViewpoint = useCallback((vp: Viewpoint | null) => {
    setHoveredVp(vp);
  }, []);

  const snapshotInfo = dataMode === "real" && realData?.viewpoints[0]
    ? (realData.viewpoints[0] as any).snapshot : null;

  const activeTimelinePoint = dataMode === "timeline" && timelineIndex
    ? timelineIndex.points.find(p => p.snapshotId === timelineSnapshotId) ?? null : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#080812", color: "#c8c8d8", fontFamily: "system-ui, sans-serif", overflow: "hidden" }}>
      {/* Header */}
      <header style={{
        padding: "10px 20px", borderBottom: "1px solid #2a2a48", background: "#0d0d20",
        display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "#e0e0f0", letterSpacing: "-0.02em", margin: 0 }}>
          ReachMap
        </h1>
        <span style={{ color: "#7777a0", fontSize: 13, fontWeight: 400 }}>
          What the routing table sees — and what it misses
        </span>

        {/* Color mode toggle */}
        <div style={{ display: "flex", gap: 0, marginLeft: 24 }}>
          {(["consensus", "origin"] as ColorMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => { setColorMode(mode); handleClearSelection(); }}
              disabled={!!(selectedVp || selectedAsView)}
              style={{
                padding: "4px 10px", fontSize: 10, fontWeight: 500, cursor: "pointer",
                background: effectiveColorMode === mode && !(selectedVp || selectedAsView) ? "rgba(100,180,200,0.15)" : "transparent",
                color: effectiveColorMode === mode && !(selectedVp || selectedAsView) ? "#89c8d8" : "#666",
                border: `1px solid ${effectiveColorMode === mode && !(selectedVp || selectedAsView) ? "rgba(100,180,200,0.3)" : "transparent"}`,
                borderRadius: mode === "consensus" ? "4px 0 0 4px" : "0 4px 4px 0",
              }}
            >
              {mode === "consensus" ? "BGP visibility" : "Origin ASN"}
            </button>
          ))}
        </div>

        {/* Timeline controls */}
        {dataMode === "timeline" && timelineIndex && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 16 }}>
            <span style={{ fontSize: 9, color: "#555", textTransform: "uppercase" }}>Timeline</span>
            {timelineIndex.points.map((pt, i) => (
              <button
                key={pt.snapshotId}
                onClick={() => selectTimelineSnapshot(pt.snapshotId)}
                style={{
                  padding: "3px 8px", fontSize: 10, cursor: "pointer",
                  background: pt.snapshotId === timelineSnapshotId ? "rgba(100,180,200,0.2)" : "transparent",
                  color: pt.snapshotId === timelineSnapshotId ? "#89c8d8" : pt.role === "event" ? "#e8a040" : "#666",
                  border: `1px solid ${pt.snapshotId === timelineSnapshotId ? "rgba(100,180,200,0.3)"
                    : pt.role === "event" ? "rgba(232,160,64,0.25)" : "transparent"}`,
                  borderRadius: 3,
                  fontWeight: pt.role === "event" ? 600 : 400,
                }}
                title={`${pt.timestamp} (${pt.role.replace(/_/g, " ")}) · ${pt.collectorCount} collectors · ${pt.observedPrefixCount}/${pt.totalPrefixCount} observed`}
              >
                {pt.role === "event" && <span style={{ marginRight: 2 }}>⚡</span>}
                {pt.snapshotId.replace("T", " ").replace("00Z", "00 UTC").slice(5, 16)}
                {pt.role === "event" && <span style={{ marginLeft: 2 }}>⚡</span>}
              </button>
            ))}
            <span style={{ fontSize: 9, color: "#555" }}>
              {timelineSnapshotId && (() => {
                const pt = timelineIndex.points.find(p => p.snapshotId === timelineSnapshotId);
                if (!pt) return null;
                return `${pt.observedPrefixCount}/${pt.totalPrefixCount} prefixes · ${pt.collectorCount} collectors`;
              })()}
            </span>
          </div>
        )}

        {/* Data source toggle */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {snapshotInfo && (
            <span style={{ fontSize: 9, color: "#555", fontFamily: "monospace" }}>
              {snapshotInfo.ribTimestamp}
            </span>
          )}
          <span style={{ fontSize: 10, color: "#2ecc71", fontWeight: 500 }}>
            {loading ? "Loading data..." : dataMode === "timeline" ? "Timeline view" : "Live data"}
          </span>
          {/* Case selector — driven from loaded cases */}
          {cases && cases.length > 0 && (
            <select
              value={selectedCaseId}
              onChange={(e) => {
                const caseId = e.target.value;
                setSelectedCaseId(caseId);
                const entry = cases.find(c => c.caseStudyId === caseId);
                if (entry?.caseType === "healthy_baseline") {
                  loadReal();
                } else {
                  loadTimeline(caseId);
                }
              }}
              style={{
                padding: "3px 8px", fontSize: 10, background: "#0d0d20", color: "#999",
                border: "1px solid #333", borderRadius: 3, cursor: "pointer",
              }}
            >
              {cases.map(c => (
                <option key={c.caseStudyId} value={c.caseStudyId}>
                  {c.label ?? c.caseStudyTitle ?? c.caseStudyId}
                </option>
              ))}
            </select>
          )}
          <span style={{ fontSize: 9, color: "#555", fontStyle: "italic" }}>
            BGP collector RIB visibility · Not physical cables
          </span>
        </div>
      </header>

      {/* Hero summary — prominent BGP vs traffic contrast */}
      {dataMode === "timeline" && activeTimelinePoint?.role === "event" && (
        <div style={{
          padding: "12px 20px", background: "rgba(0,0,0,0.4)", borderBottom: "1px solid #2a2a48",
          display: "flex", gap: 32, alignItems: "center", flexShrink: 0, flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#e0e0f0", marginBottom: 2 }}>
              Cuba · March 2026 grid collapse
            </div>
            <div style={{ fontSize: 11, color: "#999" }}>
              Power failed. Traffic dropped. BGP stayed green.
            </div>
          </div>
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#888", textTransform: "uppercase", marginBottom: 2 }}>BGP RIBs</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#28b85e" }}>4/4</div>
              <div style={{ fontSize: 9, color: "#666" }}>collectors</div>
            </div>
            <div style={{ color: "#555", fontSize: 16 }}>vs</div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#888", textTransform: "uppercase", marginBottom: 2 }}>Traffic</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#e8a040" }}>35%</div>
              <div style={{ fontSize: 9, color: "#666" }}>of baseline</div>
            </div>
          </div>
          <div style={{ flex: 1, fontSize: 11, color: "#aaa", lineHeight: 1.5, minWidth: 200 }}>
            The routing table saw green. Users saw a blackout.
            ReachMap shows what the BGP layer saw — and what it missed.
          </div>
          <div style={{ fontSize: 9, color: "#555" }}>Cloudflare Radar</div>
        </div>
      )}

      {/* Main content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ flex: "0 0 auto", padding: "8px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <HilbertCanvas
            prefixes={prefixes}
            colorMode={effectiveColorMode}
            visibleSet={visibleSet}
            visibilityScores={visibilityScores}
            selectedPrefix={selectedPrefix}
            totalCollectors={totalCollectors}
            onHoverPrefix={setHoveredPrefix}
            onClickPrefix={handleClickPrefix}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0, padding: 8 }}>
          <PathGraph
            pathFamilies={pathFamilies}
            asnMap={asnMap}
            selectedPrefix={selectedPrefix?.prefix ?? null}
            selectedCollectorId={selectedVp?.collector ?? null}
            onSelectCollector={(cid) => {
              if (!cid) { handleClearSelection(); return; }
              const vp = viewpoints.find(v => v.collector === cid || v.id === cid);
              if (vp) handleSelectViewpoint(vp);
              else handleClearSelection();
            }}
          />
        </div>

        <div style={{ flex: "0 0 auto", padding: "8px 8px 8px 0" }}>
          <SidePanel
            selectionMode={selectionMode}
            colorMode={effectiveColorMode}
            selectedVp={selectedVp}
            selectedAsView={selectedAsView}
            selectedPrefix={selectedPrefix}
            hoveredPrefix={hoveredPrefix}
            allViewpoints={viewpoints}
            asViews={asViews}
            pathFamilies={pathFamilies}
            visibilityScores={visibilityScores}
            totalCollectors={totalCollectors}
            dataMode={dataMode}
            asnMap={asnMap}
            onSelectAsn={handleSelectAsn}
            onClearSelection={handleClearSelection}
          />
        </div>
      </div>
    </div>
  );
}
