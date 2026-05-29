/**
 * TimeScrubber — horizontal timeline with snapshot ticks, arrows, keyboard support,
 * and dual-signal mini chart (BGP visibility vs traffic signal).
 */

import React, { useCallback, useEffect, useRef } from "react";
import type { TimelinePoint } from "../types";

interface Props {
  points: TimelinePoint[];
  selectedSnapshotId: string | null;
  onSelectSnapshot: (snapshotId: string) => void;
}

export function TimeScrubber({ points, selectedSnapshotId, onSelectSnapshot }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const availablePoints = points.filter(p => p.available !== false);
  const selectedIdx = points.findIndex(p => p.snapshotId === selectedSnapshotId);
  const current = selectedIdx >= 0 ? points[selectedIdx] : null;

  // Find next/prev AVAILABLE snapshot (skip unavailable)
  function nextAvailable(fromIdx: number): number {
    for (let i = fromIdx + 1; i < points.length; i++) {
      if (points[i].available !== false) return i;
    }
    return -1;
  }
  function prevAvailable(fromIdx: number): number {
    for (let i = fromIdx - 1; i >= 0; i--) {
      if (points[i].available !== false) return i;
    }
    return -1;
  }

  // Keyboard support — skip unavailable
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      const prev = prevAvailable(selectedIdx);
      if (prev >= 0) onSelectSnapshot(points[prev].snapshotId);
    } else if (e.key === "ArrowRight") {
      const next = nextAvailable(selectedIdx);
      if (next >= 0) onSelectSnapshot(points[next].snapshotId);
    }
  }, [selectedIdx, points, onSelectSnapshot]);

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  if (points.length === 0) return null;

  // Dual-signal chart data
  const maxTraffic = 100;
  const chartH = 36;
  const chartW = points.length > 1 ? (points.length - 1) : 1;

  return (
    <div ref={containerRef} style={{
      background: "#0d1530", borderBottom: "1px solid rgba(255,255,255,0.06)",
      padding: "8px 16px 6px", flexShrink: 0, userSelect: "none",
    }}>
      {/* Top row: label + arrows + ticks */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 9, color: "#667788", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
          Timeline
        </span>

        {/* Left arrow */}
        <button
          onClick={() => { const p = prevAvailable(selectedIdx); if (p >= 0) onSelectSnapshot(points[p].snapshotId); }}
          disabled={prevAvailable(selectedIdx) < 0}
          style={{
            background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3,
            color: prevAvailable(selectedIdx) >= 0 ? "#8899bb" : "#3a4a5a", cursor: prevAvailable(selectedIdx) >= 0 ? "pointer" : "default",
            fontSize: 12, padding: "2px 6px", lineHeight: 1,
          }}
        >◀</button>

        {/* Tick bar */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", position: "relative", height: 28 }}>
          {/* Track line */}
          <div style={{
            position: "absolute", left: 0, right: 0, top: "50%", height: 2,
            background: "rgba(255,255,255,0.08)", transform: "translateY(-50%)",
          }} />

          {/* BGP visibility green line (always flat for this demo) */}
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
            {points.map((p, i) => {
              if (i === 0) return null;
              const prevX = ((i - 1) / (points.length - 1)) * 100;
              const currX = (i / (points.length - 1)) * 100;
              const x1 = `${prevX}%`; const x2 = `${currX}%`;
              const bgpY = "20%";
              return (
                <line key={`bgp-${i}`} x1={x1} y1={bgpY} x2={x2} y2={bgpY}
                  stroke="rgba(46,204,113,0.5)" strokeWidth={1.5} />
              );
            })}
          </svg>

          {/* Ticks */}
          {points.map((p, i) => {
            const isAvailable = p.available !== false;
            const isSelected = p.snapshotId === selectedSnapshotId;
            const isEvent = p.role === "event";
            const xPct = points.length > 1 ? (i / (points.length - 1)) * 100 : 50;
            return (
              <div
                key={p.snapshotId}
                onClick={() => isAvailable && onSelectSnapshot(p.snapshotId)}
                title={isAvailable
                  ? `${p.timestamp}\nBGP: ${p.collectorCount > 0 ? p.observedPrefixCount + '/' + p.totalPrefixCount + ' prefixes, ' + p.collectorCount + ' RIBs' : 'No BGP data'}` + (p.trafficBaselinePercent != null ? `\nTraffic: ${p.trafficBaselinePercent}% of baseline` : "") + (p.actualRibTimestamp ? `\nRIB: ${p.actualRibTimestamp}` : "")
                  : `${p.timestamp}\nUnavailable — no BGP RIB data` + (p.trafficBaselinePercent != null ? `\nTraffic: ${p.trafficBaselinePercent}% of baseline` : "")
                }
                style={{
                  position: "absolute", left: `${xPct}%`, top: "50%",
                  transform: "translate(-50%, -50%)",
                  width: isSelected ? 16 : isEvent ? 12 : 8,
                  height: isSelected ? 16 : isEvent ? 12 : 8,
                  borderRadius: "50%",
                  background: !isAvailable ? "transparent"
                    : isSelected ? "#fff"
                    : isEvent ? "#e8a040"
                    : "#556678",
                  border: !isAvailable ? "1px dashed rgba(255,255,255,0.15)"
                    : isSelected ? "2px solid #fff"
                    : "1px solid rgba(255,255,255,0.2)",
                  cursor: isAvailable ? "pointer" : "default",
                  zIndex: isSelected ? 2 : 1,
                  transition: "all 0.15s",
                  opacity: isAvailable ? 1 : 0.4,
                }}
              />
            );
          })}
        </div>

        {/* Right arrow */}
        <button
          onClick={() => { const n = nextAvailable(selectedIdx); if (n >= 0) onSelectSnapshot(points[n].snapshotId); }}
          disabled={nextAvailable(selectedIdx) < 0}
          style={{
            background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3,
            color: nextAvailable(selectedIdx) >= 0 ? "#8899bb" : "#3a4a5a", cursor: nextAvailable(selectedIdx) >= 0 ? "pointer" : "default",
            fontSize: 12, padding: "2px 6px", lineHeight: 1,
          }}
        >▶</button>
      </div>

      {/* Bottom row: selected info + dual-signal mini chart */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 4, fontSize: 9, color: "#667788" }}>
        {/* Selected timestamp info */}
        {current && (
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ color: "#8899bb", fontWeight: 600 }}>
              {current.role === "event" && "⚡ "}
              {current.timestamp}
            </span>
            <span>BGP: <span style={{ color: "#2ecc71" }}>{current.collectorCount}/{current.collectorCount}</span> RIBs · {current.observedPrefixCount} prefixes</span>
            {current.trafficBaselinePercent != null && (
              <span>Traffic: <span style={{ color: "#e8a040" }}>{current.trafficBaselinePercent}%</span> of baseline</span>
            )}
            {!current.ribTimestampsMatch && current.actualRibTimestamp && (
              <span style={{ color: "#4a5a6a" }} title={`BGP data from ${current.actualRibTimestamp}`}>
                RIB: {current.actualRibTimestamp?.replace("T", " ").replace(":00:00Z", "")}
              </span>
            )}
          </div>
        )}

        {/* Mini dual-signal chart */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
          <svg width={Math.max(60, points.length * 14)} height={chartH} style={{ display: "block" }}>
            {/* Traffic line (amber) */}
            {points.map((p, i) => {
              if (i === 0 || p.trafficBaselinePercent == null || points[i-1].trafficBaselinePercent == null) return null;
              const x1 = ((i - 1) / chartW) * (points.length * 14);
              const x2 = (i / chartW) * (points.length * 14);
              const y1 = chartH - ((points[i-1].trafficBaselinePercent! / maxTraffic) * chartH);
              const y2 = chartH - ((p.trafficBaselinePercent / maxTraffic) * chartH);
              return <line key={`t-${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="rgba(232,160,64,0.6)" strokeWidth={2} />;
            })}
            {/* BGP line (green, flat) */}
            {points.length > 1 && (
              <line x1={0} y1={chartH * 0.15} x2={points.length * 14} y2={chartH * 0.15}
                stroke="rgba(46,204,113,0.5)" strokeWidth={2} strokeDasharray="3 2" />
            )}
          </svg>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, fontSize: 7 }}>
            <span style={{ color: "#2ecc71" }}>— BGP</span>
            <span style={{ color: "#e8a040" }}>— Traffic</span>
          </div>
        </div>

        {/* Keyboard hint */}
        <span style={{ color: "#4a5a6a", fontSize: 7 }}>← → keys</span>
      </div>
    </div>
  );
}
