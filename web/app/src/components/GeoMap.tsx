import React, { useMemo, useCallback, useState } from "react";
import DeckGL from "@deck.gl/react";
import { GeoJsonLayer, ScatterplotLayer, ArcLayer, TextLayer } from "@deck.gl/layers";
import { MapView } from "@deck.gl/core";
import type { PickingInfo, MapViewState } from "@deck.gl/core";
import { targetCountryGeoJson, landmasses, COUNTRY_CENTER, type CountryMapConfig } from "../geo";
import type { Viewpoint, SelectionMode } from "../types";
import type { RGB } from "../colors";

// ── Colors ───────────────────────────────────────────────────
const TARGET_FILL: RGB = [35, 50, 90];
const TARGET_LINE: RGB = [80, 120, 200];
const LANDMASS_FILL: RGB = [28, 30, 48];
const LANDMASS_LINE: RGB = [50, 55, 80];
const VP_COLOR: RGB = [220, 200, 90];
const VP_HIGHLIGHT: RGB = [255, 245, 140];
const COLLECTOR_COLOR: RGB = [120, 200, 220];

interface Props {
  viewpoints: Viewpoint[];
  selectedVp: Viewpoint | null;
  highlightedVpIds: Set<string>;
  selectionMode: SelectionMode;
  mapConfig: CountryMapConfig;
  onSelectViewpoint: (vp: Viewpoint | null) => void;
  onHoverViewpoint: (vp: Viewpoint | null) => void;
}

export function GeoMap({ viewpoints, selectedVp, highlightedVpIds, selectionMode, mapConfig, onSelectViewpoint, onHoverViewpoint }: Props) {
  const initialView: MapViewState = { ...mapConfig.view };
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  const onHover = useCallback((info: PickingInfo) => {
    if (info.object && info.layer?.id === "viewpoints") {
      const vp = info.object as Viewpoint;
      onHoverViewpoint(vp);
      setTooltip({
        x: info.x, y: info.y,
        text: [
          vp.peerAsName ? `${vp.peerAsName} / AS${vp.peerAsn}` : `AS${vp.peerAsn}`,
          vp.collector ? `Collector: ${vp.collector}` : "",
          vp.geo.city ? `${vp.geo.city}${vp.geo.countryCode ? `, ${vp.geo.countryCode}` : ""}` : "",
          vp.regionGroup ? `Region: ${vp.regionGroup}` : "",
          `Visible: ${vp.visiblePrefixes.length}/${vp.visiblePrefixes.length + vp.missingPrefixes.length} prefixes`,
          `Paths: ${vp.pathFamilyIds.length} families`,
          `Geo: ${vp.geo.kind.replace(/_/g, " ")} (${Math.round(vp.geo.confidence * 100)}%)`,
          `Click to select`,
        ].filter(Boolean).join("\n"),
      });
    } else if (info.object && info.layer?.id === "target-country") {
      setTooltip({ x: info.x, y: info.y,
        text: `${mapConfig.label}\nClick to show all viewpoints` });
    } else {
      onHoverViewpoint(null);
      setTooltip(null);
    }
  }, [onHoverViewpoint]);

  const onClick = useCallback((info: PickingInfo) => {
    if (info.object && info.layer?.id === "viewpoints") {
      const vp = info.object as Viewpoint;
      onSelectViewpoint(vp);
    }
    if (info.object && info.layer?.id === "target-country") {
      onSelectViewpoint(null);
    }
  }, [onSelectViewpoint]);

  const layers = useMemo(() => {
    const isViewpointMode = selectionMode === "viewpoint";
    const highlightSet = highlightedVpIds;

    // Build arcs
    const arcs: { from: [number, number]; to: [number, number]; vpId: string; isSelected: boolean }[] = [];
    if (selectedVp) {
      const slat = selectedVp.geo.latitude, slon = selectedVp.geo.longitude;
      if (slat != null && slon != null) {
        arcs.push({ from: [slon, slat], to: COUNTRY_CENTER, vpId: selectedVp.id, isSelected: true });
      }
    } else if (selectionMode === "all") {
      for (const vp of viewpoints) {
        const lat = vp.geo.latitude, lon = vp.geo.longitude;
        if (lat != null && lon != null) {
          arcs.push({ from: [lon, lat], to: COUNTRY_CENTER, vpId: vp.id, isSelected: highlightSet.has(vp.id) });
        }
      }
    }

    return [
      // Landmasses
      new GeoJsonLayer({
        id: "landmasses",
        data: [...landmasses],
        filled: true, stroked: true,
        getFillColor: LANDMASS_FILL,
        getLineColor: LANDMASS_LINE,
        getLineWidth: 0.5,
        pickable: false,
      }),
      // Target country
      new GeoJsonLayer({
        id: "target-country",
        data: targetCountryGeoJson,
        filled: true, stroked: true,
        getFillColor: selectedVp ? [35, 45, 80] as RGB : TARGET_FILL,
        getLineColor: TARGET_LINE,
        getLineWidth: 1.5,
        lineWidthMinPixels: 1.5,
        pickable: true,
        updateTriggers: { getFillColor: selectedVp },
      }),
      // Viewpoints
      new ScatterplotLayer({
        id: "viewpoints",
        data: viewpoints,
        getPosition: (d: Viewpoint) => [d.geo.longitude ?? 0, d.geo.latitude ?? 0] as [number, number],
        getRadius: (d: Viewpoint) => {
          if (d.id === selectedVp?.id) return 120000;
          if (highlightSet.has(d.id)) return 90000;
          return d.peerAsn === 0 ? 40000 : 70000;
        },
        getFillColor: (d: Viewpoint) => {
          if (d.id === selectedVp?.id) return VP_HIGHLIGHT;
          if (highlightSet.has(d.id)) return VP_HIGHLIGHT;
          return d.peerAsn === 0 ? COLLECTOR_COLOR : VP_COLOR;
        },
        radiusMinPixels: 6, radiusMaxPixels: 24,
        pickable: true,
        updateTriggers: { getRadius: [selectedVp, highlightedVpIds], getFillColor: [selectedVp, highlightedVpIds] },
      }),
      // Arcs
      new ArcLayer({
        id: "arcs",
        data: arcs,
        getSourcePosition: (d: typeof arcs[0]) => d.from,
        getTargetPosition: () => COUNTRY_CENTER,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getSourceColor: (d: typeof arcs[0]) => (d.isSelected ? [255, 190, 60] : [100, 100, 140]) as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getTargetColor: (d: typeof arcs[0]) => (d.isSelected ? [255, 220, 100, 200] : [100, 100, 140, 100]) as any,
        getWidth: (d: typeof arcs[0]) => d.isSelected ? 1.5 : 0.5,
        widthMinPixels: 0.5, widthMaxPixels: 4,
        getHeight: 0.12,
        pickable: false,
      }),
    ];
  }, [viewpoints, selectedVp, highlightedVpIds, selectionMode]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 400 }}>
      <DeckGL
        initialViewState={initialView}
        controller={{ dragRotate: false, touchRotate: false, keyboard: false }}
        views={new MapView({ id: "geo", repeat: false })}
        layers={layers}
        onHover={onHover}
        onClick={onClick}
        getCursor={(info: { isDragging: boolean; isHovering: boolean }) =>
          info.isDragging ? "grabbing" : info.isHovering ? "pointer" : "default"
        }
        style={{ background: "radial-gradient(ellipse at 30% 60%, #111130 0%, #080818 100%)" }}
      />
      {tooltip && (
        <div style={{
          position: "absolute", left: tooltip.x + 12, top: tooltip.y + 12,
          background: "rgba(10,10,30,0.93)", border: "1px solid #333",
          borderRadius: 6, padding: "8px 12px", fontSize: 12, lineHeight: 1.55,
          whiteSpace: "pre-line", pointerEvents: "none", zIndex: 100,
          backdropFilter: "blur(8px)", maxWidth: 260, color: "#ccc",
        }}>
          {tooltip.text}
        </div>
      )}
      {/* Arcs are logical BGP visibility — not physical cables */}
      <div style={{
        position: "absolute", bottom: 8, left: 8,
        fontSize: 9, color: "#555", fontStyle: "italic",
        background: "rgba(0,0,0,0.6)", padding: "2px 6px", borderRadius: 3,
      }}>
        Arcs show logical BGP visibility, not physical cables
      </div>
      {/* Mode indicator */}
      <div style={{
        position: "absolute", top: 8, right: 8,
        fontSize: 10, color: "#888",
        background: "rgba(0,0,0,0.6)", padding: "3px 8px", borderRadius: 3,
        textTransform: "uppercase", letterSpacing: "0.05em",
      }}>
        {selectionMode === "viewpoint" ? "Viewpoint mode" : selectionMode === "asn_aggregate" ? "ASN aggregate" : "All viewpoints"}
      </div>
    </div>
  );
}
