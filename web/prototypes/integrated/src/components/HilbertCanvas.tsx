import React, { useRef, useEffect, useCallback, useMemo } from "react";
import {
  COMPACT_ORDER, COMPACT_SIZE, COMPACT_TOTAL,
  buildCompactMap, cellToXY, xyToCell, getIpsPerCell,
} from "../compact";
import {
  getPrefixColor, getConsensusColor, cellNoise, applyBrightness,
} from "../colors";
import type { PrefixRecord, ColorMode, PrefixVisibilityScore } from "../types";

interface Props {
  prefixes: PrefixRecord[];
  colorMode: ColorMode;
  visibleSet: Set<string> | null;
  visibilityScores: Map<string, PrefixVisibilityScore> | null;
  selectedPrefix: PrefixRecord | null;
  totalCollectors: number;
  onHoverPrefix: (p: PrefixRecord | null) => void;
  onClickPrefix: (p: PrefixRecord | null) => void;
}

export function HilbertCanvas({
  prefixes, colorMode, visibleSet, visibilityScores,
  selectedPrefix, totalCollectors, onHoverPrefix, onClickPrefix,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoverRef = useRef<{ cell: number; prefix: PrefixRecord | null }>({ cell: -1, prefix: null });

  const { cellMap, mappings, activeCells, ipsPerCell } = useMemo(() => {
    const { cellMap, mappings } = buildCompactMap(prefixes);
    const active: { cell: number; prefixIdx: number }[] = [];
    for (let c = 0; c < COMPACT_TOTAL; c++) {
      const idx = cellMap[c];
      if (idx > 0) active.push({ cell: c, prefixIdx: idx - 1 });
    }
    return { cellMap, mappings, activeCells: active, ipsPerCell: getIpsPerCell(prefixes) };
  }, [prefixes]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const size = COMPACT_SIZE;
    const img = ctx.createImageData(size, size);
    const d = img.data;

    for (let i = 0; i < d.length; i += 4) {
      d[i] = 8; d[i + 1] = 8; d[i + 2] = 18; d[i + 3] = 255;
    }

    for (const { cell, prefixIdx } of activeCells) {
      const prefix = prefixes[prefixIdx];
      let r: number, g: number, b: number;

      if (colorMode === "consensus") {
        const score = visibilityScores?.get(prefix.prefix) ?? null;
        const ratio = score?.visibilityRatio ?? null;
        [r, g, b] = getConsensusColor(prefix, ratio);
      } else {
        [r, g, b] = getPrefixColor(prefix, visibleSet, prefix.prefix);
      }

      const noise = cellNoise(cell, prefixIdx);
      const [nr, ng, nb] = applyBrightness([r, g, b], noise);
      const [cx, cy] = cellToXY(cell);
      const px = (cy * size + cx) * 4;
      d[px] = nr; d[px + 1] = ng; d[px + 2] = nb; d[px + 3] = 255;
    }

    ctx.putImageData(img, 0, 0);

    // Hover highlight
    const h = hoverRef.current;
    if (h.prefix) {
      const m = mappings.find(mm => mm.prefixIdx === prefixes.indexOf(h.prefix!));
      if (m) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
        for (let c = m.virtualStart; c <= m.virtualEnd; c++) {
          const [cx, cy] = cellToXY(c);
          ctx.fillRect(cx, cy, 1, 1);
        }
        // Edge glow
        const drawn = new Set<number>();
        for (let c = m.virtualStart; c <= m.virtualEnd; c++) {
          const [cx, cy] = cellToXY(c);
          for (const [nx, ny] of [[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]] as [number,number][]) {
            if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
            const nc = xyToCell(nx, ny);
            if (nc < m.virtualStart || nc > m.virtualEnd) {
              ctx.fillStyle = "rgba(255, 255, 255, 0.30)";
              ctx.fillRect(cx, cy, 1, 1);
              drawn.add(cx * size + cy);
              break;
            }
          }
        }
      }
    }

    // Selection glow
    if (selectedPrefix) {
      const m = mappings.find(mm => mm.prefixIdx === prefixes.indexOf(selectedPrefix));
      if (m) {
        const drawn = new Set<number>();
        for (let c = m.virtualStart; c <= m.virtualEnd; c++) {
          const [cx, cy] = cellToXY(c);
          for (const [nx, ny] of [[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]] as [number,number][]) {
            if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
            const nc = xyToCell(nx, ny);
            if (nc < m.virtualStart || nc > m.virtualEnd) {
              drawn.add(cx * size + cy);
              break;
            }
          }
        }
        for (const key of drawn) {
          ctx.fillStyle = "rgba(255, 220, 160, 0.45)";
          ctx.fillRect(Math.floor(key / size), key % size, 1, 1);
        }
      }
    }

    // Grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
    ctx.lineWidth = 0.3;
    for (let i = 64; i < size; i += 64) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255, 255, 255, 0.10)";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
  }, [prefixes, activeCells, mappings, colorMode, visibleSet, visibilityScores, selectedPrefix]);

  useEffect(() => { render(); }, [render]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = COMPACT_SIZE / rect.width;
    const x = Math.floor((e.clientX - rect.left) * scale);
    const y = Math.floor((e.clientY - rect.top) * scale);
    if (x < 0 || x >= COMPACT_SIZE || y < 0 || y >= COMPACT_SIZE) { onHoverPrefix(null); return; }
    const cell = xyToCell(x, y);
    const idx = cellMap[cell];
    if (idx === 0) { onHoverPrefix(null); return; }
    const prefix = prefixes[idx - 1];
    if (hoverRef.current.prefix !== prefix) {
      hoverRef.current = { cell, prefix };
      onHoverPrefix(prefix);
      render();
    }
  }, [prefixes, cellMap, onHoverPrefix, render]);

  const handleMouseLeave = useCallback(() => {
    hoverRef.current = { cell: -1, prefix: null };
    onHoverPrefix(null);
    render();
  }, [onHoverPrefix, render]);

  const handleClick = useCallback(() => {
    onClickPrefix(hoverRef.current.prefix);
  }, [onClickPrefix]);

  const inBgp = prefixes.filter(p => p.observedInBgp).length;
  const fillPct = (activeCells.length / COMPACT_TOTAL * 100).toFixed(1);

  const modeLabel = colorMode === "consensus" ? "BGP collector RIB visibility"
    : colorMode === "origin" ? "Origin ASN"
    : "Selected vantage";

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <div style={{
        padding: "4px 8px", fontSize: 10, fontWeight: 600, color: "#7777a0",
        textTransform: "uppercase", letterSpacing: "0.05em",
        background: "rgba(0,0,0,0.4)", borderBottom: "1px solid #2a2a48",
      }}>
        National IPv4 fingerprint
        <span style={{ display: "block", fontWeight: 400, fontSize: 9, textTransform: "none", letterSpacing: 0, color: "#666", marginTop: 1 }}>
          {modeLabel} · {totalCollectors} collector RIB{totalCollectors !== 1 ? "s" : ""} · BGP visibility only · Cuban address space remapped for readability
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={COMPACT_SIZE}
        height={COMPACT_SIZE}
        style={{ display: "block", width: 512, maxWidth: "calc(100vw - 540px)", height: "auto", aspectRatio: "1", cursor: "crosshair", imageRendering: "pixelated" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />
      <div style={{
        padding: "3px 8px", fontSize: 9, color: "#666", fontFamily: "monospace",
        background: "rgba(0,0,0,0.3)", borderTop: "1px solid #2a2a48",
      }}>
        {inBgp}/{prefixes.length} prefixes · ~{ipsPerCell} IPs/cell · order {COMPACT_ORDER} · {fillPct}% fill
      </div>
    </div>
  );
}
