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
      paint: { "background-color": "#0a0a1e" },
    },
    {
      id: "land-fill",
      type: "fill",
      source: "land",
      paint: { "fill-color": "#141428", "fill-opacity": 0.9 },
    },
    {
      id: "land-stroke",
      type: "line",
      source: "land",
      paint: { "line-color": "#252550", "line-width": 0.5 },
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
    const pad = 12;
    const geoW = maxX - minX, geoH = maxY - minY;
    const scale = Math.min((W - pad * 2) / geoW, (H - pad * 2) / geoH);
    const offX = pad + ((W - pad * 2) - geoW * scale) / 2;
    const offY = pad + ((H - pad * 2) - geoH * scale) / 2;

    ctx.clearRect(0, 0, W, H);

    // Draw country shape
    ctx.beginPath();
    CUBA_OUTLINE.forEach(([lon, lat], i) => {
      const x = offX + (lon - minX) * scale;
      const y = offY + (maxY - lat) * scale;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();

    // Green fill (BGP-visible)
    ctx.fillStyle = "rgba(40, 185, 94, 0.5)";
    ctx.fill();
    ctx.strokeStyle = "rgba(80, 180, 220, 0.7)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, []);

  return <canvas ref={ref} width={320} height={140} style={{ display: "block", width: "100%", height: "auto" }} />;
}

export function MapStageGL({ pathFamilies, asnMap, visibilityScores, totalCollectors, countryName, selectedPrefix, selectedCollectorId, onSelectCollector }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Initialize MapLibre
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [-55, 35],
      zoom: 2.3,
      minZoom: 1.5,
      maxZoom: 8,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });

    // Add deck.gl overlay
    const overlay = new MapboxOverlay({ layers: [] });
    map.addControl(overlay as any);

    map.on("load", () => {
      setMapReady(true);
    });

    mapRef.current = map;
    overlayRef.current = overlay;

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Build deck.gl layers
  const deckLayers = useMemo(() => {
    // Collector points
    const collectors = new ScatterplotLayer({
      id: "collectors",
      data: COLLECTORS,
      getPosition: (d: typeof COLLECTORS[0]) => [d.lon, d.lat],
      getRadius: 60000,
      getFillColor: (d: typeof COLLECTORS[0]) => d.id === selectedCollectorId ? [255, 204, 64] : [85, 136, 170],
      getLineColor: [136, 187, 221],
      getLineWidth: 2,
      lineWidthMinPixels: 1,
      radiusMinPixels: 7,
      radiusMaxPixels: 20,
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
      getRadius: 40000,
      getFillColor: [50, 100, 180],
      getLineColor: [80, 150, 220],
      getLineWidth: 2,
      lineWidthMinPixels: 1.5,
      radiusMinPixels: 5,
      radiusMaxPixels: 14,
      stroked: true,
      pickable: false,
    });

    // Arcs: collectors → Cuba
    const arcs = new ArcLayer({
      id: "collector-arcs",
      data: COLLECTORS,
      getSourcePosition: (d: typeof COLLECTORS[0]) => [d.lon, d.lat],
      getTargetPosition: () => CUBA_CENTER,
      getSourceColor: (d: typeof COLLECTORS[0]) => d.id === selectedCollectorId ? [255, 200, 70, 200] : [80, 130, 200, 80],
      getTargetColor: [40, 185, 94, 120],
      getWidth: (d: typeof COLLECTORS[0]) => d.id === selectedCollectorId ? 3 : 1,
      widthMinPixels: 0.5,
      widthMaxPixels: 4,
      getHeight: 0.15,
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
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 420, background: "#080812", overflow: "hidden" }}>
      {/* MapLibre container — fills parent */}
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

      {/* Transit ASN logical overlay (HTML, not geographic) */}
      <div style={{
        position: "absolute", bottom: 50, right: 12, padding: "8px 12px",
        background: "rgba(10,10,30,0.85)", border: "1px solid #2a2a48", borderRadius: 6,
        backdropFilter: "blur(4px)", maxWidth: 180,
      }}>
        <div style={{ fontSize: 9, color: "#666", textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>
          Logical transit ASNs
        </div>
        {transitNodes.map(t => (
          <div key={t.asn} style={{ fontSize: 10, color: "#aaa", padding: "2px 0" }}>
            <span style={{ color: "#7777aa" }}>●</span> {t.label} <span style={{ color: "#555" }}>AS{t.asn}</span>
          </div>
        ))}
        <div style={{ fontSize: 8, color: "#445", marginTop: 4 }}>Not physical locations</div>
      </div>

      {/* Country IP-space weather — large callout with actual country shape */}
      <div style={{
        position: "absolute", top: 12, right: 12, width: "30%", minWidth: 260, maxWidth: 380,
        background: "rgba(8,8,20,0.88)", border: "1px solid rgba(40,185,94,0.25)", borderRadius: 8,
        backdropFilter: "blur(6px)", overflow: "hidden",
      }}>
        <div style={{ padding: "6px 12px", borderBottom: "1px solid rgba(40,185,94,0.15)" }}>
          <div style={{ fontSize: 10, color: "#28b85e", textTransform: "uppercase", fontWeight: 600 }}>
            {countryName} · IP-space weather
          </div>
          <div style={{ fontSize: 11, color: "#ccc", marginTop: 2 }}>
            BGP-visible · {totalCollectors}/{totalCollectors} collector RIBs
          </div>
        </div>
        <CubaWeatherCanvas />
        <div style={{ padding: "4px 12px 6px", display: "flex", justifyContent: "space-between", fontSize: 8, color: "#445" }}>
          <span>IP-space packed into country outline</span>
          <span>Not physical locations</span>
        </div>
      </div>

      {/* Collector labels */}
      <div style={{
        position: "absolute", top: 12, left: 12, padding: "8px 12px",
        background: "rgba(10,10,30,0.85)", border: "1px solid #2a2a48", borderRadius: 6,
        backdropFilter: "blur(4px)",
      }}>
        <div style={{ fontSize: 9, color: "#666", textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>
          Collector RIB locations
        </div>
        {COLLECTORS.map(c => (
          <div key={c.id} style={{ fontSize: 10, color: c.id === selectedCollectorId ? "#ffcc40" : "#aaccdd", padding: "1px 0", cursor: "pointer" }}
            onClick={() => onSelectCollector(c.id === selectedCollectorId ? null : c.id)}>
            <span style={{ color: "#5588aa" }}>●</span> {c.label}
          </div>
        ))}
      </div>

      {/* Bottom disclaimer */}
      <div style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", fontSize: 8, color: "#333" }}>
        Logical BGP AS-path structure from sampled collector RIBs. Not physical cables.
      </div>

      {/* Path families count */}
      <div style={{ position: "absolute", top: 4, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: "#445" }}>
        {pathFamilies.length} path families observed
      </div>
    </div>
  );
}
