/**
 * Compact national Hilbert fingerprint — order 9 (512×512 cells).
 */

import hilbert from "d3-hilbert";
import type { PrefixRecord } from "./types";

export const COMPACT_ORDER = 9;
export const COMPACT_SIZE = 512;
export const COMPACT_TOTAL = COMPACT_SIZE * COMPACT_SIZE;

const layout = hilbert().order(COMPACT_ORDER).canvasWidth(COMPACT_SIZE);

export interface CompactMapping {
  prefixIdx: number;
  virtualStart: number;
  virtualEnd: number;
  cellCount: number;
}

export function buildCompactMap(prefixes: PrefixRecord[]): {
  cellMap: Uint16Array; mappings: CompactMapping[];
} {
  const sorted = prefixes.map((p, i) => ({ p, i })).sort((a, b) => a.p.prefixStart - b.p.prefixStart);
  const totalIps = prefixes.reduce((s, p) => s + p.addressCount, 0);
  const ipsPerCell = Math.max(1, Math.round(totalIps / (COMPACT_TOTAL * 0.92)));

  const cellMap = new Uint16Array(COMPACT_TOTAL);
  const mappings: CompactMapping[] = [];
  let offset = 0;

  for (const { p, i } of sorted) {
    const cells = Math.max(1, Math.round(p.addressCount / ipsPerCell));
    const s = Math.min(offset, COMPACT_TOTAL - 1);
    const e = Math.min(offset + cells - 1, COMPACT_TOTAL - 1);
    mappings.push({ prefixIdx: i, virtualStart: s, virtualEnd: e, cellCount: e - s + 1 });
    for (let c = s; c <= e; c++) cellMap[c] = i + 1;
    offset = e + 1;
  }
  return { cellMap, mappings };
}

export function cellToXY(cell: number): [number, number] {
  const xy = layout.getXyAtVal(cell);
  return [xy[0], xy[1]];
}

export function xyToCell(x: number, y: number): number {
  return layout.getValAtXY(Math.floor(x), Math.floor(y));
}

export function getIpsPerCell(prefixes: PrefixRecord[]): number {
  const totalIps = prefixes.reduce((s, p) => s + p.addressCount, 0);
  return Math.max(1, Math.round(totalIps / (COMPACT_TOTAL * 0.92)));
}
