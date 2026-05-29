import React, { useState, useCallback, useMemo } from "react";
import { createRoot } from "react-dom/client";
import DeckGL from "@deck.gl/react";
import { GeoJsonLayer, ScatterplotLayer, ArcLayer } from "@deck.gl/layers";
import { MapView } from "@deck.gl/core";
import type { PickingInfo, MapViewState, Color } from "@deck.gl/core";
import { cubaGeoJson, vantagePoints, buildArcs, CUBA_CENTER } from "./data";
import type { VantagePoint } from "./data";

type RGBA = [number, number, number, number];
type RGB = [number, number, number];

// ── Constants ────────────────────────────────────────────────

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: -60,
  latitude: 25,
  zoom: 2.5,
  pitch: 20,
  bearing: 0,
};

// ── Color palette ────────────────────────────────────────────

const CUBA_FILL: RGBA = [30, 40, 80, 200];
const CUBA_LINE: RGBA = [80, 100, 180, 255];
const VANTAGE_COLOR: RGBA = [200, 180, 80, 255];
const COLLECTOR_COLOR: RGBA = [100, 180, 200, 255];
const ARC_COLOR: RGBA = [255, 180, 50, 180];
const HIGHLIGHT_COLOR: RGBA = [255, 255, 100, 255];

function vantColor(d: VantagePoint, selectedId: string | null): RGBA {
  return d.id === selectedId ? HIGHLIGHT_COLOR : VANTAGE_COLOR;
}

// ── App Component ────────────────────────────────────────────

function App() {
  const [selectedVantageId, setSelectedVantageId] = useState<string | null>(null);
  const [hoveredVantage, setHoveredVantage] = useState<VantagePoint | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  const selectedVantage = useMemo(
    () => vantagePoints.find(v => v.id === selectedVantageId) ?? null,
    [selectedVantageId]
  );

  const arcs = useMemo(() => buildArcs(selectedVantageId), [selectedVantageId]);

  const onHover = useCallback((info: PickingInfo) => {
    if (info.object && info.layer?.id === "vantage-points") {
      const v = info.object as VantagePoint;
      setHoveredVantage(v);
      setTooltip({
        x: info.x,
        y: info.y,
        text: `${v.name}${v.asn > 0 ? ` / AS${v.asn}` : ""}\n${v.location}${v.asn > 0 ? `\nClick to select` : ""}`,
      });
    } else if (info.object && info.layer?.id === "cuba-outline") {
      setHoveredVantage(null);
      setTooltip({
        x: info.x,
        y: info.y,
        text: "Cuba\nIPv4: ~256K addresses\n~50 prefixes\n3 origin ASNs",
      });
    } else {
      setHoveredVantage(null);
      setTooltip(null);
    }
  }, []);

  const onClick = useCallback((info: PickingInfo) => {
    if (info.object && info.layer?.id === "vantage-points") {
      const v = info.object as VantagePoint;
      if (v.asn > 0) {
        setSelectedVantageId(prev => prev === v.id ? null : v.id);
      }
    }
    if (info.object && info.layer?.id === "cuba-outline") {
      setSelectedVantageId(null);
    }
  }, []);

  // ── Layers ─────────────────────────────────────────────────

  const layers = useMemo(() => [
    // Cuba polygon
    new GeoJsonLayer({
      id: "cuba-outline",
      data: cubaGeoJson,
      filled: true,
      stroked: true,
      getFillColor: (selectedVantage ? [30, 40, 100, 220] as RGBA : CUBA_FILL),
      getLineColor: CUBA_LINE,
      getLineWidth: 2,
      lineWidthMinPixels: 1.5,
      pickable: true,
      updateTriggers: { getFillColor: selectedVantage },
    }),

    // Vantage points (peer ASNs)
    new ScatterplotLayer({
      id: "vantage-points",
      data: vantagePoints.filter(v => v.asn > 0),
      getPosition: (d: VantagePoint) => d.coordinates,
      getRadius: (d: VantagePoint) => d.id === selectedVantageId ? 180000 : 80000,
      getFillColor: (d: VantagePoint): RGBA => vantColor(d, selectedVantageId),
      radiusMinPixels: 4,
      radiusMaxPixels: 20,
      pickable: true,
      updateTriggers: { getRadius: selectedVantageId, getFillColor: selectedVantageId },
    }),

    // Collector locations (smaller, different color)
    new ScatterplotLayer({
      id: "collector-points",
      data: vantagePoints.filter(v => v.asn === 0),
      getPosition: (d: VantagePoint) => d.coordinates,
      getRadius: 50000,
      getFillColor: COLLECTOR_COLOR,
      radiusMinPixels: 3,
      radiusMaxPixels: 8,
      pickable: true,
    }),

    // Reachability arcs from selected vantage to Cuba
    new ArcLayer({
      id: "reachability-arcs",
      data: arcs,
      getSourcePosition: (d: typeof arcs[0]) => d.from,
      getTargetPosition: () => CUBA_CENTER,
      getSourceColor: ARC_COLOR as RGBA,
      getTargetColor: [255, 220, 100, 220] as RGBA,
      getWidth: 2,
      widthMinPixels: 1,
      widthMaxPixels: 4,
      getHeight: 0.15,
      pickable: false,
    }),
  ], [selectedVantageId, selectedVantage, arcs]);

  // ── Render ─────────────────────────────────────────────────

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={{ dragRotate: true, touchRotate: true }}
        views={new MapView({ id: "main", repeat: true })}
        layers={layers}
        onHover={onHover}
        onClick={onClick}
        getCursor={(info: { isDragging: boolean; isHovering: boolean }) =>
          info.isDragging ? "grabbing" : info.isHovering ? "pointer" : "default"
        }
        style={{ background: "linear-gradient(180deg, #080812 0%, #0d0d20 100%)" }}
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: "absolute",
            left: tooltip.x + 12,
            top: tooltip.y + 12,
            background: "rgba(10,10,30,0.93)",
            border: "1px solid #333",
            borderRadius: 6,
            padding: "8px 14px",
            fontSize: 13,
            lineHeight: 1.5,
            whiteSpace: "pre-line",
            pointerEvents: "none",
            zIndex: 100,
            backdropFilter: "blur(8px)",
            maxWidth: 240,
          }}
        >
          {tooltip.text}
        </div>
      )}

      {/* UI Overlay */}
      <div style={{
        position: "absolute", top: 16, left: 16,
        background: "rgba(10,10,30,0.85)", border: "1px solid #333",
        borderRadius: 8, padding: "14px 18px", maxWidth: 280,
        backdropFilter: "blur(8px)",
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4, color: "#e0e0f0" }}>
          ReachMap <span style={{ fontWeight: 400, color: "#777", fontSize: 14 }}>— deck.gl spike</span>
        </h2>
        <p style={{ fontSize: 11, color: "#888", marginBottom: 10, lineHeight: 1.5 }}>
          Geographic anchor + vantage points + logical reachability arcs.
          Arcs represent BGP visibility, not physical cables.
        </p>
        {selectedVantage ? (
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            <div style={{ color: "#aaa", marginBottom: 4 }}>
              Selected: <strong style={{ color: "#ffd866" }}>{selectedVantage.name} / AS{selectedVantage.asn}</strong>
            </div>
            <div style={{ color: "#888", fontSize: 11 }}>
              {selectedVantage.location}<br />
              Visible Cuban prefixes: 42 / 58 (72%)<br />
              AS path families: 3<br />
              Collectors: route-views2, route-views4
            </div>
            <button
              onClick={() => setSelectedVantageId(null)}
              style={{
                marginTop: 8, padding: "4px 10px", fontSize: 11,
                background: "#222", color: "#aaa", border: "1px solid #444",
                borderRadius: 3, cursor: "pointer",
              }}
            >
              Clear selection
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: "#777", fontStyle: "italic" }}>
            Click a vantage point to see reachability arcs to Cuba.<br />
            Drag to rotate. Scroll to zoom.
          </div>
        )}
      </div>

      {/* Vantage legend */}
      <div style={{
        position: "absolute", bottom: 16, left: 16,
        background: "rgba(10,10,30,0.85)", border: "1px solid #333",
        borderRadius: 6, padding: "8px 14px", fontSize: 11,
        backdropFilter: "blur(8px)", color: "#999",
      }}>
        <div><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "rgb(200,180,80)", marginRight: 6 }} />Peer ASN / vantage</div>
        <div style={{ marginTop: 3 }}><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "rgb(100,180,200)", marginRight: 6 }} />RouteViews collector</div>
        <div style={{ marginTop: 3 }}><span style={{ display: "inline-block", width: 10, height: 3, background: "rgb(255,180,50)", marginRight: 6 }} />Logical reachability arc</div>
      </div>
    </div>
  );
}

// ── Boot ─────────────────────────────────────────────────────

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
