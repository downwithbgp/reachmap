/**
 * TimeScrubber — discrete BGP snapshot browser.
 * Each tick is a snapshot card: complete (solid), partial (striped), unavailable (dim).
 * Selected snapshot highlighted with status pill below.
 */

import React, { useCallback, useEffect } from "react";
import type { TimelinePoint } from "../types";

interface Props {
  points: TimelinePoint[];
  selectedSnapshotId: string | null;
  onSelectSnapshot: (snapshotId: string) => void;
}

export function TimeScrubber({ points, selectedSnapshotId, onSelectSnapshot }: Props) {
  const selectedIdx = points.findIndex(p => p.snapshotId === selectedSnapshotId);
  const current = selectedIdx >= 0 ? points[selectedIdx] : null;

  // Count states
  const complete = points.filter(p => p.comparability === "complete").length;
  const partial = points.filter(p => p.comparability === "partial").length;
  const unavailable = points.filter(p => p.comparability === "unavailable" || p.available === false).length;

  // Find prev/next available
  function nextAvail(from: number) {
    for (let i = from + 1; i < points.length; i++) if (points[i].available !== false) return i;
    return -1;
  }
  function prevAvail(from: number) {
    for (let i = from - 1; i >= 0; i--) if (points[i].available !== false) return i;
    return -1;
  }

  // Keyboard
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") { const p = prevAvail(selectedIdx); if (p >= 0) onSelectSnapshot(points[p].snapshotId); }
    else if (e.key === "ArrowRight") { const n = nextAvail(selectedIdx); if (n >= 0) onSelectSnapshot(points[n].snapshotId); }
  }, [selectedIdx, points, onSelectSnapshot]);
  useEffect(() => { window.addEventListener("keydown", handleKey); return () => window.removeEventListener("keydown", handleKey); }, [handleKey]);

  if (points.length === 0) return null;

  // Dual-signal mini chart
  const chartH = 30;
  const maxTraffic = 100;

  return (
    <div style={{ background: "#0d1530", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "8px 16px 6px", flexShrink: 0, userSelect: "none" }}>
      {/* Top row: label + quality badge + arrows */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: "#8899bb", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.04em" }}>
          BGP snapshots
        </span>
        <span style={{ fontSize: 8, color: "#556678" }}>
          {complete} complete · {partial} partial · {unavailable} unavailable
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <button onClick={() => { const p = prevAvail(selectedIdx); if (p >= 0) onSelectSnapshot(points[p].snapshotId); }}
            disabled={prevAvail(selectedIdx) < 0}
            style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, color: prevAvail(selectedIdx) >= 0 ? "#8899bb" : "#3a4a5a", cursor: prevAvail(selectedIdx) >= 0 ? "pointer" : "default", fontSize: 11, padding: "2px 6px" }}>◀</button>
          <button onClick={() => { const n = nextAvail(selectedIdx); if (n >= 0) onSelectSnapshot(points[n].snapshotId); }}
            disabled={nextAvail(selectedIdx) < 0}
            style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, color: nextAvail(selectedIdx) >= 0 ? "#8899bb" : "#3a4a5a", cursor: nextAvail(selectedIdx) >= 0 ? "pointer" : "default", fontSize: 11, padding: "2px 6px" }}>▶</button>
        </div>
      </div>

      {/* Snapshot rail */}
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end", marginBottom: 2 }}>
        {points.map((p, i) => {
          const isAvail = p.available !== false;
          const isComplete = p.comparability === "complete";
          const isPartial = p.comparability === "partial";
          const isSelected = p.snapshotId === selectedSnapshotId;
          const isEvent = p.role === "event";

          const bg = !isAvail ? "transparent"
            : isSelected ? "#fff"
            : isComplete ? "rgba(46,204,113,0.7)"
            : isPartial ? "rgba(232,160,64,0.7)"
            : "#556678";

          const border = !isAvail ? "1px dashed rgba(255,255,255,0.12)"
            : isSelected ? "2px solid #fff"
            : isComplete ? "1px solid rgba(46,204,113,0.5)"
            : isPartial ? "1px solid rgba(232,160,64,0.5)"
            : "1px solid rgba(255,255,255,0.15)";

          const label = p.timestamp?.replace("2026-03-16 ", "").replace("2026-03-17 ", "17 ").replace(" UTC", "") ?? "";

          return (
            <div key={p.snapshotId}
              onClick={() => isAvail && onSelectSnapshot(p.snapshotId)}
              title={[
                p.timestamp,
                p.comparability ? `${p.comparability}${p.parsedCollectors != null ? ` · ${p.parsedCollectors}/${p.targetCollectors} collectors` : ""}` : "",
                p.collectorCount > 0 ? `${p.observedPrefixCount}/${p.totalPrefixCount} prefixes · ${p.pathFamilyCount} paths` : "",
                p.trafficBaselinePercent != null ? `Traffic: ${p.trafficBaselinePercent}%` : "",
                p.missingCollectors?.length ? `Missing: ${p.missingCollectors.join(", ")}` : "",
                isEvent ? "⚡ Event" : "",
              ].filter(Boolean).join("\n")}
              style={{
                flex: 1, maxWidth: 80, padding: "4px 4px 6px", borderRadius: 4,
                background: isSelected ? "rgba(255,255,255,0.06)" : "transparent",
                border: isSelected ? "1px solid rgba(255,255,255,0.15)" : "1px solid transparent",
                cursor: isAvail ? "pointer" : "default",
                textAlign: "center", opacity: isAvail ? 1 : 0.4,
                transition: "all 0.15s",
              }}
            >
              {/* Dot indicator */}
              <div style={{
                width: 12, height: 12, borderRadius: "50%", background: bg, border,
                margin: "0 auto 4px",
                boxShadow: isSelected ? "0 0 8px rgba(255,255,255,0.2)" : "none",
              }} />
              {/* Label */}
              <div style={{ fontSize: 8, color: isSelected ? "#e8e8f8" : isAvail ? "#8899bb" : "#4a5a6a", fontWeight: isSelected ? 600 : 400 }}>
                {label}
              </div>
              {/* Status text */}
              <div style={{ fontSize: 6, color: isComplete ? "#2ecc71" : isPartial ? "#e8a040" : "#4a5a6a", marginTop: 1 }}>
                {!isAvail ? "—" : isComplete ? "complete" : isPartial ? "partial" : "?"}
              </div>
              {/* Event marker */}
              {isEvent && isAvail && (
                <div style={{ fontSize: 8, marginTop: 1 }}>⚡</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected snapshot status pill */}
      {current && (
        <div style={{
          display: "flex", alignItems: "center", gap: 16, fontSize: 9, color: "#8899bb",
          padding: "4px 0", flexWrap: "wrap",
        }}>
          <span style={{ fontWeight: 600, color: "#c8d8f0" }}>
            {current.role === "event" && "⚡ "}
            {current.timestamp}
          </span>
          {current.available !== false ? (
            <>
              <span style={{
                padding: "1px 6px", borderRadius: 3, fontSize: 8, fontWeight: 600,
                background: current.comparability === "complete" ? "rgba(46,204,113,0.15)" :
                  current.comparability === "partial" ? "rgba(232,160,64,0.15)" : "rgba(255,255,255,0.05)",
                color: current.comparability === "complete" ? "#2ecc71" :
                  current.comparability === "partial" ? "#e8a040" : "#8899bb",
              }}>
                {current.comparability === "complete" ? "COMPLETE" : current.comparability === "partial" ? "PARTIAL" : "AVAILABLE"}
              </span>
              <span>{current.parsedCollectors ?? current.collectorCount}/{current.targetCollectors ?? current.collectorCount} collectors</span>
              <span>{current.observedPrefixCount} prefixes</span>
              {current.trafficBaselinePercent != null && (
                <span style={{ color: "#e8a040" }}>Traffic: {current.trafficBaselinePercent}%</span>
              )}
              {current.missingCollectors?.length ? (
                <span style={{ color: "#e8a040" }}>Missing: {current.missingCollectors.join(", ")}</span>
              ) : null}
            </>
          ) : (
            <span style={{ color: "#4a5a6a" }}>No BGP data — traffic context only</span>
          )}
          {/* Mini chart */}
          <svg width={Math.max(60, points.length * 12)} height={chartH} style={{ marginLeft: "auto", display: "block" }}>
            {points.map((p, i) => {
              if (i === 0 || p.trafficBaselinePercent == null || points[i-1].trafficBaselinePercent == null) return null;
              const x1 = ((i - 1) / (points.length - 1)) * (points.length * 12);
              const x2 = (i / (points.length - 1)) * (points.length * 12);
              const y1 = chartH - ((points[i-1].trafficBaselinePercent! / maxTraffic) * chartH);
              const y2 = chartH - ((p.trafficBaselinePercent / maxTraffic) * chartH);
              return <line key={`t-${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="rgba(232,160,64,0.5)" strokeWidth={2} />;
            })}
            {points.length > 1 && (
              <line x1={0} y1={chartH * 0.12} x2={points.length * 12} y2={chartH * 0.12}
                stroke="rgba(46,204,113,0.4)" strokeWidth={2} strokeDasharray="3 2" />
            )}
          </svg>
          <span style={{ fontSize: 7, color: "#4a5a6a" }}>
            <span style={{ color: "#2ecc71" }}>— BGP</span> <span style={{ color: "#e8a040" }}>— Traffic</span> ← → keys
          </span>
        </div>
      )}
    </div>
  );
}
