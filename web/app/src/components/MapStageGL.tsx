/**
 * MapLibre GL + deck.gl map stage.
 * Geographic map with collector points, logical AS-path arcs, and country weather callout.
 * Basemap: self-hosted Natural Earth GeoJSON (no external tile requests).
 */

import React, { useRef, useEffect, useState, useMemo } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ScatterplotLayer, ArcLayer } from "@deck.gl/layers";
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

const COLLECTORS = [
  { id: "route-views2", label: "Eugene, OR", region: "US West", lon: -123.09, lat: 44.05 },
  { id: "route-views4", label: "San Jose, CA", region: "US West", lon: -121.89, lat: 37.34 },
  { id: "route-views.eqix", label: "Ashburn, VA", region: "US East", lon: -77.49, lat: 39.04 },
  { id: "route-views.linx", label: "London, UK", region: "Europe", lon: -0.09, lat: 51.51 },
  { id: "rrc00", label: "Amsterdam, NL", region: "Europe", lon: 4.90, lat: 52.37 },
];

const CUBA_CENTER: [number, number] = [-79.5, 21.8];

// MapLibre style using self-hosted GeoJSON basemap
const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  name: "ReachMap Basemap",
  sources: {
    land: {
      type: "geojson",
      data: "/data/basemaps/ne-atlantic-land.json",
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#0d1530" },
    },
    {
      id: "land-fill",
      type: "fill",
      source: "land",
      paint: { "fill-color": "#1a2848", "fill-opacity": 0.95 },
    },
    {
      id: "land-stroke",
      type: "line",
      source: "land",
      paint: { "line-color": "#2a4070", "line-width": 0.6 },
    },
  ],
};

// Cuba outline for the weather callout
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

function CubaWeatherCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;

    // Project with aspect ratio preservation
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

    // Subtle glow shadow
    ctx.shadowColor = "rgba(40, 200, 130, 0.3)";
    ctx.shadowBlur = 12;

    // Draw country shape
    ctx.beginPath();
    CUBA_OUTLINE.forEach(([lon, lat], i) => {
      const x = offX + (lon - minX) * scale;
      const y = offY + (maxY - lat) * scale;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();

    // Green fill (BGP-visible) with gradient
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

  return <canvas ref={ref} width={480} height={210} style={{ display: "block", width: "100%", height: "auto" }} />;
}

export function MapStageGL({ pathFamilies, asnMap, visibilityScores, totalCollectors, countryName, selectedPrefix, selectedCollectorId, onSelectCollector }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const calloutRef = useRef<HTMLDivElement>(null);
  const [cubaScreen, setCubaScreen] = useState<{x:number, y:number}|null>(null);
  const [calloutAnchor, setCalloutAnchor] = useState<{x:number, y:number}|null>(null);

  // Initialize MapLibre
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [-50, 32],
      zoom: 2.8,
      minZoom: 1.8,
      maxZoom: 8,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });

    // Add deck.gl overlay
    const overlay = new MapboxOverlay({ layers: [] });
    map.addControl(overlay as any);

    const updateCubaScreen = () => {
      const p = map.project(CUBA_CENTER);
      setCubaScreen({x: p.x, y: p.y});
    };
    map.on("load", () => {
      setMapReady(true);
      updateCubaScreen();
    });
    map.on("move", updateCubaScreen);
    map.on("resize", updateCubaScreen);

    mapRef.current = map;
    overlayRef.current = overlay;

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Track callout panel position for connector endpoint
  useEffect(() => {
    const update = () => {
      if (!calloutRef.current || !containerRef.current) return;
      const cr = calloutRef.current.getBoundingClientRect();
      const pr = containerRef.current.getBoundingClientRect();
      setCalloutAnchor({
        x: cr.left - pr.left,
        y: cr.top + 50,
      });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [mapReady]);

  // Build deck.gl layers
  const deckLayers = useMemo(() => {
    // Collector points
    const collectors = new ScatterplotLayer({
      id: "collectors",
      data: COLLECTORS,
      getPosition: (d: typeof COLLECTORS[0]) => [d.lon, d.lat],
      getRadius: 80000,
      getFillColor: (d: typeof COLLECTORS[0]) => d.id === selectedCollectorId ? [255, 210, 80] : [100, 160, 210],
      getLineColor: [160, 210, 240],
      getLineWidth: 2,
      lineWidthMinPixels: 1,
      radiusMinPixels: 8,
      radiusMaxPixels: 22,
      stroked: true,
      pickable: true,
      onClick: (info: any) => {
        if (info.object) onSelectCollector(info.object.id === selectedCollectorId ? null : info.object.id);
      },
    });

    // Cuba target marker
    const target = new ScatterplotLayer({
      id: "target",
      data: [{ position: CUBA_CENTER }],
      getPosition: (d: any) => d.position,
      getRadius: 60000,
      getFillColor: [60, 140, 220],
      getLineColor: [120, 200, 255],
      getLineWidth: 2.5,
      lineWidthMinPixels: 1.5,
      radiusMinPixels: 6,
      radiusMaxPixels: 16,
      stroked: true,
      pickable: false,
    });

    // Arcs: collectors → Cuba
    const arcs = new ArcLayer({
      id: "collector-arcs",
      data: COLLECTORS,
      getSourcePosition: (d: typeof COLLECTORS[0]) => [d.lon, d.lat],
      getTargetPosition: () => CUBA_CENTER,
      getSourceColor: (d: typeof COLLECTORS[0]) => d.id === selectedCollectorId ? [255, 210, 80, 220] : [100, 150, 220, 100],
      getTargetColor: [40, 200, 130, 140],
      getWidth: (d: typeof COLLECTORS[0]) => d.id === selectedCollectorId ? 3.5 : 1.2,
      widthMinPixels: 0.5,
      widthMaxPixels: 4.5,
      getHeight: 0.12,
      pickable: false,
    });

    return [collectors, target, arcs];
  }, [selectedCollectorId, onSelectCollector]);

  // Update deck.gl layers
  useEffect(() => {
    if (overlayRef.current && mapReady) {
      overlayRef.current.setProps({ layers: deckLayers });
    }
  }, [deckLayers, mapReady]);

  // Top transit ASNs for the overlay
  const transitNodes = useMemo(() => {
    const map = new Map<number, number>();
    for (const pf of pathFamilies) {
      if (!Array.isArray(pf.path)) continue;
      for (const asn of pf.path.slice(1, -1)) {
        map.set(asn, (map.get(asn) ?? 0) + 1);
      }
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([asn]) => ({ asn, label: asnMap.get(asn)?.displayName ?? `AS${asn}` }));
  }, [pathFamilies, asnMap]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 420, background: "#0d1530", overflow: "hidden" }}>
      {/* MapLibre container — fills parent */}
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

      {/* Callout connector — dashed line from geographic Cuba marker to IP-space weather panel */}
      {cubaScreen && calloutAnchor && (
        <svg style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:10, overflow:"visible" }}>
          <defs>
            <marker id="callout-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="rgba(0,220,190,0.6)" />
            </marker>
          </defs>
          <line
            x1={cubaScreen.x} y1={cubaScreen.y}
            x2={calloutAnchor.x} y2={calloutAnchor.y}
            stroke="rgba(0,220,190,0.55)"
            strokeWidth={1.8}
            strokeDasharray="6 4"
            markerEnd="url(#callout-arrow)"
          />
          <text x={(cubaScreen.x + calloutAnchor.x) / 2} y={(cubaScreen.y + calloutAnchor.y) / 2 - 10}
            textAnchor="middle" fill="rgba(0,210,180,0.6)" fontSize={9}>
            geographic anchor → IP-space weather
          </text>
        </svg>
      )}

      {/* Transit ASN flow corridor — integrated between collectors and callout */}
      {transitNodes.length > 0 && (
        <div style={{
          position: "absolute", top: "30%", right: "calc(38% + 48px)", transform: "translateY(-30%)",
          display: "flex", flexDirection: "column", gap: 6, pointerEvents: "none",
        }}>
          <div style={{ fontSize: 9, color: "#7788aa", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.04em", marginBottom: 2 }}>
            Transit ASNs
          </div>
          {transitNodes.map((t, i) => (
            <div key={t.asn} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                background: "rgba(120,140,200,0.7)",
                boxShadow: "0 0 6px rgba(120,140,220,0.3)",
                flexShrink: 0,
              }} />
              <div style={{ fontSize: 10, color: "#aabbdd", fontWeight: 500, lineHeight: 1.3 }}>
                {t.label}
                <span style={{ display: "block", fontSize: 8, color: "#667799", fontWeight: 400 }}>AS{t.asn}</span>
              </div>
            </div>
          ))}
          <div style={{ fontSize: 7, color: "#445566", marginTop: 2 }}>Not physical locations</div>
        </div>
      )}

      {/* Country IP-space weather — hero callout with actual country shape */}
      <div ref={calloutRef} style={{
        position: "absolute", top: 16, right: 16, width: "38%", minWidth: 320, maxWidth: 440,
        background: "rgba(8,16,40,0.92)", border: "1px solid rgba(40,200,130,0.35)", borderRadius: 8,
        backdropFilter: "blur(8px)", overflow: "hidden",
        boxShadow: "0 0 24px rgba(40,180,100,0.08), 0 4px 20px rgba(0,0,0,0.3)",
      }}>
        <div style={{ padding: "10px 14px 8px", borderBottom: "1px solid rgba(40,200,130,0.18)" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div style={{ fontSize: 12, color: "#2ecc71", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>
              {countryName} · IP-space weather
            </div>
            <div style={{
              padding: "2px 8px", borderRadius: 3, fontSize: 11, fontWeight: 600,
              background: "rgba(40,200,130,0.12)", color: "#2ecc71",
            }}>
              BGP-visible · {totalCollectors}/{totalCollectors} RIBs
            </div>
          </div>
        </div>
        <CubaWeatherCanvas />
        <div style={{ padding: "6px 14px 8px", fontSize: 9, color: "#667788", lineHeight: 1.5 }}>
          Address space packed into country outline. Not physical prefix locations.
        </div>
      </div>

      {/* Collector labels */}
      <div style={{
        position: "absolute", top: 16, left: 16, padding: "10px 14px",
        background: "rgba(10,20,48,0.88)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6,
        backdropFilter: "blur(6px)",
      }}>
        <div style={{ fontSize: 10, color: "#8899bb", textTransform: "uppercase", marginBottom: 6, fontWeight: 600, letterSpacing: "0.04em" }}>
          Collector RIBs
        </div>
        {COLLECTORS.map(c => (
          <div key={c.id} style={{ fontSize: 11, color: c.id === selectedCollectorId ? "#ffd048" : "#aac8e0", padding: "2px 0", cursor: "pointer", fontWeight: c.id === selectedCollectorId ? 600 : 400 }}
            onClick={() => onSelectCollector(c.id === selectedCollectorId ? null : c.id)}>
            <span style={{ color: c.id === selectedCollectorId ? "#ffd048" : "#68a0cc", marginRight: 4 }}>●</span>{c.label}
          </div>
        ))}
      </div>

      {/* Bottom disclaimer */}
      <div style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: "#445566" }}>
        Logical BGP AS-path structure from sampled collector RIBs. Not physical cables.
      </div>

      {/* Path families count */}
      <div style={{ position: "absolute", top: 6, left: "50%", transform: "translateX(-50%)", fontSize: 10, color: "#556678" }}>
        {pathFamilies.length} path families observed
      </div>
    </div>
  );
}
