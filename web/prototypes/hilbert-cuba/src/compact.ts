/**
 * Compact national Hilbert fingerprint — order 9 (512×512 cells).
 *
 * Remaps a country's IPv4 prefixes into a dense local Hilbert layout.
 * At order 9 with ~256K Cuban IPs, most cells are filled, creating a
 * textured "weather map" surface rather than flat allocation blocks.
 */

import hilbert from "d3-hilbert";
import type { PrefixVisualRecord } from "./data";

export const COMPACT_ORDER = 9;
export const COMPACT_SIZE = 512; // 2^9
export const COMPACT_TOTAL_CELLS = COMPACT_SIZE * COMPACT_SIZE; // 262,144

const compactLayout = hilbert().order(COMPACT_ORDER).canvasWidth(COMPACT_SIZE);

export interface CompactMapping {
  prefixIdx: number;
  virtualStart: number;
  virtualEnd: number;
  cellCount: number;
}

export function buildCompactMap(
  prefixes: PrefixVisualRecord[]
): { cellMap: Uint16Array; mappings: CompactMapping[] } {
  const sorted = prefixes
    .map((p, i) => ({ prefix: p, idx: i }))
    .sort((a, b) => a.prefix.prefixStart - b.prefix.prefixStart);

  const totalIps = prefixes.reduce((s, p) => s + p.addressCount, 0);
  const IPS_PER_CELL = Math.max(1, Math.round(totalIps / (COMPACT_TOTAL_CELLS * 0.92)));

  const cellMap = new Uint16Array(COMPACT_TOTAL_CELLS);
  const mappings: CompactMapping[] = [];
  let virtualOffset = 0;

  for (const { prefix, idx } of sorted) {
    const cellsNeeded = Math.max(1, Math.round(prefix.addressCount / IPS_PER_CELL));
    const vStart = Math.min(virtualOffset, COMPACT_TOTAL_CELLS - 1);
    const vEnd = Math.min(virtualOffset + cellsNeeded - 1, COMPACT_TOTAL_CELLS - 1);

    mappings.push({ prefixIdx: idx, virtualStart: vStart, virtualEnd: vEnd, cellCount: vEnd - vStart + 1 });

    for (let c = vStart; c <= vEnd; c++) {
      cellMap[c] = idx + 1;
    }

    virtualOffset = vEnd + 1;
  }

  return { cellMap, mappings };
}

/** Virtual cell → (x, y) in compact Hilbert space */
export function compactCellToXY(cell: number): [number, number] {
  const xy = compactLayout.getXyAtVal(cell);
  return [xy[0], xy[1]];
}

/** Compact canvas (x, y) → virtual cell index */
export function compactXyToCell(x: number, y: number): number {
  return compactLayout.getValAtXY(Math.floor(x), Math.floor(y));
}

export function getCompactIpsPerCell(prefixes: PrefixVisualRecord[]): number {
  const totalIps = prefixes.reduce((s, p) => s + p.addressCount, 0);
  return Math.max(1, Math.round(totalIps / (COMPACT_TOTAL_CELLS * 0.92)));
}
