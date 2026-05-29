/**
 * MapLibre GL + deck.gl observation map — secondary context only.
 * Shows approximate BGP collector locations and country context.
 * Does NOT draw network paths, arcs, or connectivity lines.
 * Basemap: self-hosted Natural Earth GeoJSON (no external tile requests).
 */

import React, { useRef, useEffect, useState, useMemo } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ScatterplotLayer } from "@deck.gl/layers";
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
      center: [-50, 32],
      zoom: 2.8,
      minZoom: 1.8,
      maxZoom: 8,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });

    const overlay = new MapboxOverlay({ layers: [] });
    map.addControl(overlay as any);

    map.on("load", () => {
      setMapReady(true);
    });

    mapRef.current = map;
    overlayRef.current = overlay;

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Build deck.gl layers — collectors and country marker only, NO arcs
  const deckLayers = useMemo(() => {
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

    return [collectors, target];
  }, [selectedCollectorId, onSelectCollector]);

  useEffect(() => {
    if (overlayRef.current && mapReady) {
      overlayRef.current.setProps({ layers: deckLayers });
    }
  }, [deckLayers, mapReady]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 260, background: "#0d1530", overflow: "hidden" }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

      {/* Collector labels */}
      <div style={{
        position: "absolute", top: 8, left: 8, padding: "6px 10px",
        background: "rgba(10,20,48,0.88)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4,
        backdropFilter: "blur(6px)",
      }}>
        <div style={{ fontSize: 9, color: "#8899bb", textTransform: "uppercase", marginBottom: 4, fontWeight: 600, letterSpacing: "0.04em" }}>
          Collector RIBs
        </div>
        {COLLECTORS.map(c => (
          <div key={c.id} style={{ fontSize: 10, color: c.id === selectedCollectorId ? "#ffd048" : "#aac8e0", padding: "1px 0", cursor: "pointer", fontWeight: c.id === selectedCollectorId ? 600 : 400 }}
            onClick={() => onSelectCollector(c.id === selectedCollectorId ? null : c.id)}>
            <span style={{ color: c.id === selectedCollectorId ? "#ffd048" : "#68a0cc", marginRight: 4 }}>●</span>{c.label}
          </div>
        ))}
      </div>

      {/* Observation disclaimer */}
      <div style={{ position: "absolute", bottom: 16, left: 8, fontSize: 8, color: "#556678" }}>
        Observation locations only — not network paths
      </div>
      <div style={{ position: "absolute", bottom: 4, left: 8, fontSize: 7, color: "#4a5a6a" }}>
        {COLLECTORS.length} observation locations · {totalCollectors} with RIB data for this timestamp
      </div>

      {/* Country label */}
      <div style={{ position: "absolute", bottom: 4, right: 8, fontSize: 8, color: "#556678" }}>
        {countryName} · geographic context
      </div>
    </div>
  );
}
