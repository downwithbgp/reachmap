/**
 * MapLibre GL + deck.gl observation coverage map — secondary context.
 * Shows registered BGP collector locations colored by cached/parsed/observed status.
 * Does NOT draw network paths, arcs, or connectivity lines.
 * Basemap: self-hosted Natural Earth GeoJSON (no external tile requests).
 */

import React, { useRef, useEffect, useState, useMemo } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ScatterplotLayer } from "@deck.gl/layers";
import type { CollectorMeta, CollectorStatus } from "../types";

interface CollectorDisplay {
  id: string; label: string; lon: number; lat: number;
  status: CollectorStatus; source: string; city?: string; enabled: boolean;
}

interface Props {
  collectors: CollectorDisplay[];
  totalParsed: number;
  totalObserved: number;
  countryName: string;
  selectedCollectorId: string | null;
  onSelectCollector: (id: string | null) => void;
}

const CUBA_CENTER: [number, number] = [-79.5, 21.8];

const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8, name: "ReachMap Basemap",
  sources: { land: { type: "geojson", data: "/data/basemaps/ne-atlantic-land.json" } },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#0d1530" } },
    { id: "land-fill", type: "fill", source: "land", paint: { "fill-color": "#1a2848", "fill-opacity": 0.95 } },
    { id: "land-stroke", type: "line", source: "land", paint: { "line-color": "#2a4070", "line-width": 0.6 } },
  ],
};

function statusColor(status: CollectorStatus): [number, number, number] {
  switch (status) {
    case "parsed_observed": return [46, 204, 113];   // green
    case "parsed_no_match": return [80, 160, 220];    // blue
    case "fetch_failed":
    case "parse_failed": return [232, 160, 64];       // amber
    case "not_requested": return [100, 110, 130];     // gray
    case "disabled": return [60, 65, 80];              // dim gray
    default: return [100, 110, 130];
  }
}

export function MapStageGL({ collectors, totalParsed, totalObserved, countryName, selectedCollectorId, onSelectCollector }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [-50, 32], zoom: 2.5,
      minZoom: 1.8, maxZoom: 8,
      attributionControl: false, dragRotate: false, pitchWithRotate: false,
    });
    const overlay = new MapboxOverlay({ layers: [] });
    map.addControl(overlay as any);
    map.on("load", () => setMapReady(true));
    mapRef.current = map;
    overlayRef.current = overlay;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  const deckLayers = useMemo(() => {
    const activeCollectors = collectors.filter(c => c.enabled);

    const dots = new ScatterplotLayer({
      id: "collector-coverage",
      data: activeCollectors,
      getPosition: (d: CollectorDisplay) => [d.lon, d.lat],
      getRadius: (d: CollectorDisplay) => d.status === "parsed_observed" ? 50000 : 30000,
      getFillColor: (d: CollectorDisplay) => d.id === selectedCollectorId ? [255, 210, 80] : statusColor(d.status),
      getLineColor: (d: CollectorDisplay) => d.id === selectedCollectorId ? [255, 230, 120] : [160, 200, 230],
      getLineWidth: 1.5,
      lineWidthMinPixels: 0.5,
      radiusMinPixels: 4,
      radiusMaxPixels: 18,
      stroked: true,
      pickable: true,
      onClick: (info: any) => {
        if (info.object && info.object.status === "parsed_observed") {
          onSelectCollector(info.object.id === selectedCollectorId ? null : info.object.id);
        }
      },
    });

    const target = new ScatterplotLayer({
      id: "target",
      data: [{ position: CUBA_CENTER }],
      getPosition: (d: any) => d.position,
      getRadius: 50000,
      getFillColor: [60, 140, 220],
      getLineColor: [120, 200, 255],
      getLineWidth: 2,
      lineWidthMinPixels: 1, radiusMinPixels: 5, radiusMaxPixels: 14,
      stroked: true, pickable: false,
    });

    return [dots, target];
  }, [collectors, selectedCollectorId, onSelectCollector]);

  useEffect(() => {
    if (overlayRef.current && mapReady) overlayRef.current.setProps({ layers: deckLayers });
  }, [deckLayers, mapReady]);

  const parsedCount = collectors.filter(c => c.status === "parsed_observed" || c.status === "parsed_no_match").length;
  const enabledCount = collectors.filter(c => c.enabled).length;
  const totalCount = collectors.length;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 200, background: "#0d1530", overflow: "hidden" }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

      {/* Map legend */}
      <div style={{ position: "absolute", top: 4, right: 4, display: "flex", gap: 6, fontSize: 7, color: "#667788" }}>
        <span><span style={{ color: "#2ecc71" }}>●</span> observed</span>
        <span><span style={{ color: "#50a0dc" }}>●</span> parsed</span>
        <span><span style={{ color: "#647082" }}>●</span> registered</span>
      </div>

      {/* Coverage note */}
      <div style={{ position: "absolute", bottom: 16, left: 6, fontSize: 7, color: "#4a5a6a" }}>
        {totalCount} registered · {enabledCount} enabled · {parsedCount} parsed · {totalObserved} observed
      </div>
      <div style={{ position: "absolute", bottom: 4, left: 6, fontSize: 7, color: "#4a5a6a" }}>
        Observation coverage only — not network paths
      </div>
      <div style={{ position: "absolute", bottom: 4, right: 6, fontSize: 7, color: "#4a5a6a" }}>
        {countryName} · geographic context
      </div>
    </div>
  );
}
