import React, { useState, useMemo, useCallback, useEffect, Suspense } from "react";
import { HilbertCanvas } from "./components/HilbertCanvas";
import { ReachMapStage } from "./components/ReachMapStage";
import { PathGraph } from "./components/PathGraph";
import { TimeScrubber } from "./components/TimeScrubber";

// Cuba IP-space weather card — standalone callout (not map-attached)
import { useRef, useEffect as useEffectRaw } from "react";

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

function CubaWeatherCard({ countryName, totalCollectors }: { countryName: string; totalCollectors: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffectRaw(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [lon, lat] of CUBA_OUTLINE) {
      if (lon < minX) minX = lon; if (lon > maxX) maxX = lon;
      if (lat < minY) minY = lat; if (lat > maxY) maxY = lat;
    }
    const pad = 16;
    const geoW = maxX - minX, geoH = maxY - minY;
    const scale = Math.min((W - pad * 2) / geoW, (H - pad * 2) / geoH);
    const offX = pad + ((W - pad * 2) - geoW * scale) / 2;
    const offY = pad + ((H - pad * 2) - geoH * scale) / 2;
    ctx.clearRect(0, 0, W, H);
    ctx.shadowColor = "rgba(40, 200, 130, 0.3)";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    CUBA_OUTLINE.forEach(([lon, lat], i) => {
      const x = offX + (lon - minX) * scale;
      const y = offY + (maxY - lat) * scale;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "rgba(40, 200, 130, 0.55)");
    grad.addColorStop(1, "rgba(30, 160, 100, 0.45)");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(80, 200, 240, 0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, []);

  return (
    <div style={{
      background: "rgba(8,16,40,0.92)", border: "1px solid rgba(40,200,130,0.35)", borderRadius: 8,
      backdropFilter: "blur(8px)", overflow: "hidden",
      boxShadow: "0 0 24px rgba(40,180,100,0.08), 0 4px 20px rgba(0,0,0,0.3)",
    }}>
      <div style={{ padding: "10px 14px 8px", borderBottom: "1px solid rgba(40,200,130,0.18)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontSize: 12, color: "#2ecc71", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>
            {countryName} · IP-space weather
          </div>
          <div style={{ fontSize: 8, color: "#556678", marginTop: 2 }}>
            Country-shaped summary · Packed routed address space, not physical geography
          </div>
          <div style={{
            padding: "2px 8px", borderRadius: 3, fontSize: 11, fontWeight: 600,
            background: "rgba(40,200,130,0.12)", color: "#2ecc71",
          }}>
            BGP-visible · {totalCollectors}/{totalCollectors} RIBs
          </div>
        </div>
      </div>
      <canvas ref={canvasRef} width={480} height={210} style={{ display: "block", width: "100%", height: "auto" }} />
      <div style={{ padding: "6px 14px 8px", display: "flex", gap: 16, fontSize: 9, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <span style={{ color: "#2ecc71" }}>Control plane: visible</span>
        <span style={{ color: "#e8a040" }}>Traffic signal: degraded</span>
      </div>
      <div style={{ padding: "2px 14px 6px", fontSize: 8, color: "#556678", lineHeight: 1.4 }}>
        Packed national routed address space. Not physical prefix locations.
      </div>
    </div>
  );
}

// Lazy-load GL stage — only fetched when WebGL is available and ?stage=gl requested
const MapStageGL = React.lazy(() => import("./components/MapStageGL").then(m => ({ default: m.MapStageGL })));

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch { return false; }
}
import { loadAllRealData, loadConsensusData, loadAsnMetadata, loadManifest, loadCountryConfig, loadCasesFromManifest, buildRealVisibilitySet, loadTimelineIndex, loadTimelineConsensus, loadTimelinePrefixes, loadTimelinePathFamilies } from "./dataLoader";
import { viewpoints as mockViewpoints, asViews as mockAsViews, cubaPrefixes as mockPrefixes, pathFamilies as mockPathFams, getViewpoint, getAsView } from "./data";
import type { Viewpoint, AsView, PrefixRecord, SelectionMode, PathFamilyRecord, ColorMode, PrefixVisibilityScore, ConsensusVisibility, TimelineIndex, TimelinePoint, AsnMetadata, AppManifest, CountryEntry, CountryMapConfig, CaseEntry, CollectorMeta, CollectorStatus } from "./types";

type DataMode = "mock" | "real" | "timeline";

export function App() {
  const [dataMode, setDataMode] = useState<DataMode>("timeline");
  const [loading, setLoading] = useState(true);
  const [manifest, setManifest] = useState<AppManifest | null>(null);
  const [countryConfig, setCountryConfig] = useState<CountryMapConfig | null>(null);
  const [cases, setCases] = useState<CaseEntry[] | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
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
  const isDev = (typeof import.meta !== "undefined" && (import.meta as any).env?.DEV);
  const prefixes = dataMode === "timeline" && timelinePrefixes ? timelinePrefixes
    : dataMode === "real" && realData ? realData.prefixes : (isDev ? mockPrefixes : []);
  const viewpoints = dataMode === "real" && realData ? realData.viewpoints : (isDev ? mockViewpoints : []);
  const asViews = dataMode === "real" && realData ? realData.asViews : (isDev ? mockAsViews : []);
  const pathFamilies = dataMode === "timeline" && realData?.pathFamilies ? realData.pathFamilies
    : dataMode === "real" && realData ? realData.pathFamilies : (isDev ? mockPathFams : []);
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

  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [collectorRegistry, setCollectorRegistry] = useState<Map<string, CollectorMeta>>(new Map());
  const [registryLoaded, setRegistryLoaded] = useState(false);

  // Auto-load: manifest → country config → cases → case timeline
  useEffect(() => {
    async function bootstrap() {
      try {
        const m = await loadManifest();
        if (!m || m.countries.length === 0) {
          setBootstrapError("Unable to load ReachMap data manifest.");
          setLoading(false); return;
        }
        setManifest(m);

        const entry = m.countries[0];
        const dataRoot = entry.dataRoot;

        const cfg = await loadCountryConfig(entry.mapConfigPath);
        if (cfg) setCountryConfig(cfg);

        const cs = await loadCasesFromManifest(entry.casesPath);
        if (cs) setCases(cs);

        const asns = await loadAsnMetadata(entry.asnCatalogPath);
        setAsnMap(asns);

        // Load default case timeline
        const defaultCaseId = m.defaultCase;
        const caseEntry = cs?.find(c => c.caseStudyId === defaultCaseId);
        if (!caseEntry) {
          setBootstrapError(`Default case "${defaultCaseId}" from manifest was not found.`);
          setLoading(false); return;
        }
        setSelectedCaseId(defaultCaseId);

        const idx = await loadTimelineIndex(defaultCaseId, dataRoot);
        if (idx && idx.points.length > 0) {
          setTimelineIndex(idx);
          setDataMode("timeline");
          const eventPt = caseEntry.defaultSnapshotId
            ? idx.points.find(p => p.snapshotId === caseEntry.defaultSnapshotId)
            : (idx.points.find(p => p.role === "event") ?? idx.points[0]);
          if (eventPt) {
            const [cons, pfx, pfs] = await Promise.all([
              loadTimelineConsensus(eventPt.snapshotId, dataRoot),
              loadTimelinePrefixes(eventPt.snapshotId, dataRoot),
              loadTimelinePathFamilies(eventPt.snapshotId, dataRoot),
            ]);
            setTimelineConsensus(cons);
            setTimelinePrefixes(pfx);
            setTimelineSnapshotId(eventPt.snapshotId);
            if (pfs && realData) setRealData(prev => prev ? { ...prev, pathFamilies: pfs } : null);
            else if (pfs) setRealData({ prefixes: pfx ?? [], viewpoints: [], asViews: [], pathFamilies: pfs, consensus: null });
          }
        }
      } catch (e) {
        console.error("Bootstrap failed:", e);
      } finally {
        setLoading(false);
      }
    }
    bootstrap();

    // Load collector registry for coverage display
    fetch("/data/collectors.json")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.collectors) {
          const map = new Map<string, CollectorMeta>();
          for (const [id, c] of Object.entries(data.collectors) as [string, any][]) {
            map.set(id, {
              id: c.id, name: c.name, source: c.source as CollectorMeta["source"],
              latitude: c.latitude, longitude: c.longitude,
              city: c.city, region: c.region, countryCode: c.countryCode,
              continent: c.continent, regionGroup: c.regionGroup,
              confidence: c.confidence, multihopPolicy: c.multihopPolicy,
              ribUrlTemplate: c.ribUrlTemplate, enabled: c.enabled ?? true,
            });
          }
          setCollectorRegistry(map);
        }
        setRegistryLoaded(true);
      })
      .catch(() => setRegistryLoaded(true));
  }, []);

  // Load real data
  const loadReal = useCallback(async (dataRoot: string) => {
    setLoading(true);
    try {
      const data = await loadAllRealData(dataRoot);
      const cons = await loadConsensusData(dataRoot);
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
  const loadTimeline = useCallback(async (caseId: string) => {
    if (!manifest) return;
    const dataRoot = manifest.countries[0].dataRoot;
    setLoading(true);
    try {
      const idx = await loadTimelineIndex(caseId, dataRoot);
      if (!idx || idx.points.length === 0) { alert("No timeline data found."); setLoading(false); return; }
      setTimelineIndex(idx);
      setDataMode("timeline");
      const eventPoint = idx.points.find(p => p.role === "event") ?? idx.points[0];
      await selectTimelineSnapshot(eventPoint.snapshotId, dataRoot);
    } catch (e) {
      console.error("Failed to load timeline:", e);
      alert("Failed to load timeline data.");
    } finally { setLoading(false); }
  }, [manifest]);

  const selectTimelineSnapshot = useCallback(async (snapId: string, dataRoot: string) => {
    setTimelineSnapshotId(snapId);
    setSelectedVp(null); setSelectedAsView(null); setSelectedPrefix(null);
    const [cons, pfx, pfs] = await Promise.all([
      loadTimelineConsensus(snapId, dataRoot),
      loadTimelinePrefixes(snapId, dataRoot),
      loadTimelinePathFamilies(snapId, dataRoot),
    ]);
    setTimelineConsensus(cons);
    setTimelinePrefixes(pfx);
    if (pfs) setRealData(prev => prev ? { ...prev, pathFamilies: pfs } : null);
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

  // Find previous complete snapshot for deltas
  const prevComplete = useMemo(() => {
    if (!activeTimelinePoint || !timelineIndex) return null;
    const pts = timelineIndex.points;
    const curIdx = pts.findIndex(p => p.snapshotId === activeTimelinePoint.snapshotId);
    for (let i = curIdx - 1; i >= 0; i--) {
      if (pts[i].comparability === "complete") return pts[i];
    }
    return null;
  }, [activeTimelinePoint, timelineIndex]);

  // Delta vs previous complete
  const delta = useMemo(() => {
    if (!activeTimelinePoint || !prevComplete) return null;
    const cur = activeTimelinePoint;
    const prev = prevComplete;
    if (cur.comparability !== "complete") return null;
    return {
      pathsDelta: (cur.pathFamilyCount || 0) - (prev.pathFamilyCount || 0),
      prefixesDelta: (cur.observedPrefixCount || 0) - (prev.observedPrefixCount || 0),
      trafficDelta: (cur.trafficBaselinePercent || 0) - (prev.trafficBaselinePercent || 0),
      prevTimestamp: prev.timestamp,
    };
  }, [activeTimelinePoint, prevComplete]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0a1020", color: "#c8c8d8", fontFamily: "system-ui, -apple-system, sans-serif", overflow: "hidden" }}>
      {/* Header */}
      <header style={{
        padding: "12px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "#0d1530",
        display: "flex", alignItems: "center", gap: 14, flexShrink: 0,
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#e8e8f8", letterSpacing: "-0.02em", margin: 0 }}>
          ReachMap
        </h1>
        <span style={{ color: "#8899bb", fontSize: 14, fontWeight: 400 }}>
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

        {/* Timeline controls — removed from header, now TimeScrubber below */}

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
              value={selectedCaseId ?? ""}
              onChange={(e) => {
                const caseId = e.target.value;
                setSelectedCaseId(caseId);
                const entry = cases.find(c => c.caseStudyId === caseId);
                if (entry?.caseType === "healthy_baseline") {
                  if (manifest) loadReal(manifest.countries[0].dataRoot);
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

      {/* Bootstrap error state */}
      {bootstrapError && (
        <div style={{ padding: "40px", textAlign: "center", color: "#999", flex: 1 }}>
          <h2 style={{ color: "#e74c3c", fontWeight: 600 }}>{bootstrapError}</h2>
          <p style={{ fontSize: 13, marginTop: 8 }}>The ReachMap data manifest (<code>/data/manifest.json</code>) could not be loaded.</p>
          <p style={{ fontSize: 11, color: "#666" }}>Check that the site was built with data artifacts and deployed correctly.</p>
        </div>
      )}

      {/* Status strip — BGP vs traffic for current snapshot */}
      {!bootstrapError && dataMode === "timeline" && activeTimelinePoint && (
        <div style={{
          padding: "10px 24px 8px", background: "rgba(20,30,60,0.5)", borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", gap: 28, alignItems: "center", flexShrink: 0, flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#e8e8f8", letterSpacing: "-0.01em" }}>
              Cuba · March 2026
            </div>
            <div style={{ fontSize: 12, color: "#aabbcc", marginTop: 1, fontWeight: 500 }}>
              {activeTimelinePoint.role === "event" && activeTimelinePoint.comparability === "complete" ? "BGP stayed visible while traffic fell to roughly one-third of normal." :
               activeTimelinePoint.role === "before" && activeTimelinePoint.comparability === "complete" ? "Baseline snapshot: BGP visible before the traffic collapse." :
               activeTimelinePoint.comparability === "partial" ? "Partial BGP snapshot: collector coverage is incomplete." :
               "BGP control plane vs traffic signal over time"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#7a8ea0", textTransform: "uppercase", marginBottom: 1, fontWeight: 500, letterSpacing: "0.04em" }}>Control plane</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#2ecc71", lineHeight: 1 }}>{activeTimelinePoint.collectorCount}/{activeTimelinePoint.collectorCount}</div>
              <div style={{ fontSize: 8, color: "#6a8a70" }}>parsed RIBs observed</div>
              <div style={{ fontSize: 7, color: "#4a6a5a", marginTop: 1 }}>{activeTimelinePoint.collectorCount}/{activeTimelinePoint.targetCollectors ?? activeTimelinePoint.collectorCount} target collectors parsed</div>
              {collectorRegistry.size > 0 && (
                <div style={{ fontSize: 7, color: "#4a5a6a", marginTop: 1 }}>
                  {[...collectorRegistry.values()].filter(c => c.enabled).length} enabled in registry
                </div>
              )}
            </div>
            <div style={{ color: "#4a5568", fontSize: 13, fontWeight: 300 }}>vs</div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#7a8ea0", textTransform: "uppercase", marginBottom: 1, fontWeight: 500, letterSpacing: "0.04em" }}>Traffic signal</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#e8a040", lineHeight: 1 }}>~{activeTimelinePoint.trafficBaselinePercent ?? 35}%</div>
              <div style={{ fontSize: 8, color: "#8a7a60" }}>of baseline</div>
            </div>
          </div>
          <div style={{ fontSize: 8, color: "#667788" }}>Traffic: approximate demo series · Cloudflare Radar context</div>
        </div>
      )}

      {/* DEBUG PANEL — only when ?debug=1 */}
      {!bootstrapError && dataMode === "timeline" && activeTimelinePoint && (() => { try { return new URLSearchParams(window.location.search).get("debug") === "1"; } catch { return false; } })() && (
        <div style={{ padding: "4px 16px", background: "rgba(255,100,100,0.08)", borderBottom: "1px solid rgba(255,100,100,0.2)", fontSize: 8, color: "#cc8888", fontFamily: "monospace", display: "flex", gap: 16, flexWrap: "wrap", flexShrink: 0 }}>
          <span>DEBUG</span>
          <span>sid={activeTimelinePoint.snapshotId}</span>
          <span>comparability={activeTimelinePoint.comparability ?? "MISSING"}</span>
          <span>collectors={activeTimelinePoint.collectorCount}</span>
          <span>target={activeTimelinePoint.targetCollectors ?? "?"}</span>
          <span>prefixes={activeTimelinePoint.observedPrefixCount}/{activeTimelinePoint.totalPrefixCount}</span>
          <span>paths={activeTimelinePoint.pathFamilyCount}</span>
          <span>points={timelineIndex?.points?.length ?? 0}</span>
          <span>complete={timelineIndex?.points?.filter(p => p.comparability === "complete").length ?? "?"}</span>
        </div>
      )}

      {/* Time scrubber — timeline navigation */}
      {!bootstrapError && dataMode === "timeline" && timelineIndex && (
        <TimeScrubber
          points={timelineIndex.points}
          selectedSnapshotId={timelineSnapshotId}
          onSelectSnapshot={(snapId) => {
            if (manifest) selectTimelineSnapshot(snapId, manifest.countries[0].dataRoot);
          }}
        />
      )}

      {/* Main content */}
      {!bootstrapError && (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          {/* Main row: AS-path visibility graph (dominant) + IP-space weather card (right) */}
          <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden", gap: 10, padding: "12px 12px 4px" }}>
            <div style={{ flex: 4, minWidth: 0, display: "flex", flexDirection: "column" }}>
              <PathGraph
                pathFamilies={pathFamilies}
                viewpoints={viewpoints}
                asnMap={asnMap}
                selectedPrefix={selectedPrefix?.prefix ?? null}
                selectedCollectorId={selectedVp?.collector ?? null}
                timestamp={activeTimelinePoint?.timestamp}
                registrySize={collectorRegistry.size}
                registryEnabled={[...collectorRegistry.values()].filter(c => c.enabled).length}
                delta={delta ? { pathsDelta: delta.pathsDelta, prefixesDelta: delta.prefixesDelta, trafficDelta: delta.trafficDelta, prevTimestamp: delta.prevTimestamp } : undefined}
                comparability={activeTimelinePoint?.comparability}
                onSelectCollector={(cid: string | null) => {
                  if (!cid) { handleClearSelection(); return; }
                  const vp = viewpoints.find(v => v.collector === cid || v.id === cid);
                  if (vp) handleSelectViewpoint(vp);
                  else handleClearSelection();
                }}
              />
            </div>
            <div style={{ flex: "0 0 320px", display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" }}>
              <CubaWeatherCard
                countryName={countryConfig?.name ?? "Cuba"}
                totalCollectors={activeTimelinePoint?.collectorCount ?? totalCollectors}
              />
              {/* Collector status summary */}
              <div style={{
                background: "#111830", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, padding: "10px 14px",
                fontSize: 10, color: "#8899bb",
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#aabbdd", marginBottom: 6 }}>Collector registry</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <div><span style={{ color: "#c8d8f0" }}>{collectorRegistry.size}</span> registered</div>
                  <div><span style={{ color: "#c8d8f0" }}>{[...collectorRegistry.values()].filter(c => c.enabled).length}</span> enabled</div>
                  <div><span style={{ color: "#2ecc71" }}>{activeTimelinePoint?.collectorCount ?? totalCollectors}</span> parsed for this snapshot</div>
                  <div><span style={{ color: "#2ecc71" }}>{activeTimelinePoint?.observedPrefixCount ?? totalCollectors}</span> observed prefixes</div>
                  <div style={{ color: "#556678" }}>{[...collectorRegistry.values()].filter(c => c.enabled).length - (activeTimelinePoint?.collectorCount ?? totalCollectors)} enabled · not cached</div>
                  <div style={{ color: "#4a5a6a" }}>{[...collectorRegistry.values()].filter(c => !c.enabled).length} disabled / future support</div>
                </div>
                <div style={{ fontSize: 8, color: "#556678", marginTop: 6, borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 6 }}>
                  Target set: route-views2,3,4,.eqix,.linx<br />
                  Complete snapshots use all 5. Partial snapshots marked.
                </div>
              </div>
            </div>
          </div>

          {/* Coverage vs graph caption */}
          <div style={{ padding: "2px 14px", fontSize: 8, color: "#556678", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            Graph = parsed RIB evidence. Coverage map = all registered collectors and cache status.
          </div>

          {/* Bottom row: coverage map + provenance (compact) */}
          <div style={{ display: "flex", flexShrink: 0, gap: 10, alignItems: "flex-start", padding: "4px 12px 6px", maxHeight: 180, overflow: "hidden" }}>
            <div style={{ flex: "1 1 45%", height: 160, minWidth: 260 }}>
              {(() => {
                const requestedSVG = new URLSearchParams(window.location.search).get("stage") === "svg";
                const webglOk = hasWebGL();
                // Build collector display list from registry with per-collector status
                const parsedIds = new Set(viewpoints.map(v => v.collector).filter(Boolean));
                const collectorDisplays: Array<{id:string;label:string;lon:number;lat:number;status:CollectorStatus;source:string;city?:string;enabled:boolean}> = [];
                for (const c of collectorRegistry.values()) {
                  const isParsed = parsedIds.has(c.id);
                  const hasObserved = isParsed && viewpoints.some(v => v.collector === c.id && v.visiblePrefixes.length > 0);
                  let status: CollectorStatus = c.enabled ? "not_requested" : "disabled";
                  if (isParsed) status = hasObserved ? "parsed_observed" : "parsed_no_match";
                  collectorDisplays.push({ id: c.id, label: c.name, lon: c.longitude, lat: c.latitude, status, source: c.source, city: c.city, enabled: c.enabled });
                }
                // Fallback hardcoded if registry not loaded
                if (collectorDisplays.length === 0) {
                  for (const h of [{id:"route-views2",label:"Eugene, OR",lon:-123.09,lat:44.05},{id:"route-views4",label:"San Jose, CA",lon:-121.89,lat:37.34},{id:"route-views.eqix",label:"Ashburn, VA",lon:-77.49,lat:39.04},{id:"route-views.linx",label:"London, UK",lon:-0.09,lat:51.51},{id:"rrc00",label:"Amsterdam, NL",lon:4.90,lat:52.37}]) {
                    collectorDisplays.push({...h, status: parsedIds.has(h.id) ? "parsed_observed" : "not_requested", source:"unknown", enabled:true});
                  }
                }
                if (!requestedSVG && webglOk) return (
                  <Suspense fallback={<div style={{ padding: 12, color: "#667788", fontSize: 11 }}>Loading map...</div>}>
                    <MapStageGL
                      collectors={collectorDisplays}
                      totalParsed={collectorDisplays.filter(c => c.status === "parsed_observed" || c.status === "parsed_no_match").length}
                      totalObserved={collectorDisplays.filter(c => c.status === "parsed_observed").length}
                      countryName={countryConfig?.name ?? "Cuba"}
                      selectedCollectorId={selectedVp?.collector ?? null}
                      onSelectCollector={(cid: string | null) => {
                        if (!cid) { handleClearSelection(); return; }
                        const vp = viewpoints.find(v => v.collector === cid || v.id === cid);
                        if (vp) handleSelectViewpoint(vp);
                        else handleClearSelection();
                      }}
                    />
                  </Suspense>
                );
                if (requestedSVG) return <ReachMapStage pathFamilies={pathFamilies} asnMap={asnMap} visibilityScores={visibilityScores} totalCollectors={totalCollectors} countryName={countryConfig?.name ?? "Cuba"} selectedPrefix={selectedPrefix?.prefix ?? null} selectedCollectorId={selectedVp?.collector ?? null} onSelectCollector={(cid: string | null) => { if (!cid) { handleClearSelection(); return; } const vp = viewpoints.find(v => v.collector === cid || v.id === cid); if (vp) handleSelectViewpoint(vp); else handleClearSelection(); }} />;
                return (<div style={{ padding: 16, textAlign: "center", color: "#667788", fontSize: 11 }}>WebGL unavailable. <a href="?stage=svg" style={{ color: "#5588aa" }}>Use SVG fallback</a>.</div>);
              })()}
            </div>
            <div style={{ flex: "0 0 180px", opacity: 0.85 }}>
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
            <div style={{ flex: 1, minWidth: 0, maxHeight: 220, overflow: "hidden" }}>
              {/* Data provenance card */}
              <div style={{
                background: "#111830", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6,
                padding: "10px 14px", fontSize: 9, color: "#7788aa", lineHeight: 1.6,
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#aabbdd", marginBottom: 4 }}>Data provenance</div>
                <div>BGP data: cached RouteViews / RIPE RIS RIB snapshots</div>
                <div>Snapshot: {activeTimelinePoint?.timestamp ?? "2026-03-16 20:00 UTC"}</div>
                <div>Country prefix set: CU, 68 routed prefixes</div>
                <div style={{ color: "#556678", marginTop: 2 }}>
                  Remote fetch during page load: no<br />
                  Remote fetch during normal build: no<br />
                  Refresh: <code style={{ fontSize: 8 }}>scripts/refresh_data.sh</code>
                </div>
              </div>
              {/* Selected prefix inspector (compact) */}
              {(selectedPrefix || selectedVp) && (
                <div style={{
                  background: "#111830", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6,
                  padding: "8px 14px", fontSize: 10, color: "#c8d8f0", marginTop: 6,
                }}>
                  <div style={{ fontSize: 9, textTransform: "uppercase", color: "#8899bb", fontWeight: 600, marginBottom: 3 }}>
                    {selectedPrefix ? "Selected prefix" : "Selected observation point"}
                  </div>
                  {selectedPrefix && (
                    <div style={{ fontFamily: "monospace", color: "#e8e8f8" }}>{selectedPrefix.prefix}</div>
                  )}
                  {selectedVp && (
                    <div style={{ color: "#aabbdd" }}>{selectedVp.displayName} · {selectedVp.collector}</div>
                  )}
                  <div style={{ fontSize: 8, color: "#667788", marginTop: 2 }}>
                    Click edge or node in graph to inspect BGP observations.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
