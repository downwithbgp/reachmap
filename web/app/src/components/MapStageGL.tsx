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
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 420, background: "#080812", borderRadius: 4, border: "1px solid #1a1a38", overflow: "hidden" }}>
      {/* MapLibre container */}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* Transit ASN logical overlay (HTML, not geographic) */}
      <div style={{
        position: "absolute", top: 12, right: 12, padding: "8px 12px",
        background: "rgba(10,10,30,0.85)", border: "1px solid #2a2a48", borderRadius: 6,
        backdropFilter: "blur(4px)",
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

      {/* Country weather callout (HTML overlay) */}
      <div style={{
        position: "absolute", bottom: 12, right: 12, padding: "8px 12px",
        background: "rgba(10,10,30,0.85)", border: "1px solid rgba(40,185,94,0.3)", borderRadius: 6,
        backdropFilter: "blur(4px)",
      }}>
        <div style={{ fontSize: 9, color: "#28b85e", textTransform: "uppercase", fontWeight: 600, marginBottom: 2 }}>
          {countryName} · IP-space weather
        </div>
        <div style={{ fontSize: 11, color: "#28b85e", fontWeight: 700 }}>
          BGP-visible · {totalCollectors}/{totalCollectors} collector RIBs
        </div>
        <div style={{ fontSize: 8, color: "#445", marginTop: 2 }}>
          All observed prefixes visible in sampled RIBs
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
