/**
 * Hilbert curve rendering utilities — editorial color palette.
 *
 * Global IPv4 context at order 10 (1024×1024, ~4096 IPs/cell).
 * Uses a muted, editorial color system where visibility state dominates.
 */

import hilbert from "d3-hilbert";

export const HILBERT_ORDER = 10;
export const CANVAS_SIZE = 1024;
export const TOTAL_CELLS = CANVAS_SIZE * CANVAS_SIZE;
export const IPS_PER_CELL = Math.floor(2 ** 32 / TOTAL_CELLS);

const layout = hilbert().order(HILBERT_ORDER).canvasWidth(CANVAS_SIZE);

export function ipToCell(ipInt: number): number {
  return Math.floor(ipInt / IPS_PER_CELL);
}

export function cellToXY(cellIndex: number): [number, number] {
  const xy = layout.getXyAtVal(cellIndex);
  return [xy[0], xy[1]];
}

export function xyToCell(x: number, y: number): number {
  return layout.getValAtXY(Math.floor(x), Math.floor(y));
}

export function buildCellPrefixMap(
  prefixes: { prefixStart: number; prefixEnd: number }[]
): Uint16Array {
  const cells = new Uint16Array(TOTAL_CELLS);
  for (let i = 0; i < prefixes.length; i++) {
    const p = prefixes[i];
    const sc = ipToCell(p.prefixStart);
    const ec = ipToCell(p.prefixEnd);
    for (let c = sc; c <= ec && c < TOTAL_CELLS; c++) cells[c] = i + 1;
  }
  return cells;
}

// ── Editorial Color System ──────────────────────────────────

// Background
const BG: RGB = [8, 8, 18];

// ASN base hues (softer, editorial)
function asnHue(asn: number): number {
  switch (asn) {
    case 27725: return 215; // ETECSA — soft electric blue
    case 11960: return 175; // ETECSA IXP — muted teal
    case 10569: return 40;  // CENIAInternet — warm amber
    default:    return 270; // other — muted violet
  }
}

// Visibility states (the dominant encoding)
//   bright/saturated  = visible from selected vantage
//   dim/desaturated   = observed in BGP, NOT visible from this vantage
//   near-black        = allocated, never in BGP
//   default           = no vantage selected, show ASN color at medium

type RGB = [number, number, number];

/**
 * Get the editorial color for a prefix given the current visibility state.
 *
 * When no vantage is selected: all prefixes shown at medium saturation (default).
 * When vantage selected: visible = saturated bright, not visible = desaturated dim.
 */
export function getPrefixColorWithVisibility(
  prefix: {
    prefix: string;
    originAsns: number[];
    observedInBgp: boolean;
  },
  visibleSet: Set<string> | null
): RGB {
  if (!prefix.observedInBgp) {
    // Allocated but never in BGP — near-black with faint blue tint
    return [18, 18, 30];
  }

  const asn = prefix.originAsns[0] ?? 0;
  const hue = asnHue(asn);

  if (visibleSet === null) {
    // No vantage selected — default ASN color, subdued
    return hslToRgb(hue, 0.45, 0.48);
  }

  const isVisible = visibleSet.has(prefix.prefix);
  if (isVisible) {
    // Visible — bright, saturated, "lit up"
    return hslToRgb(hue, 0.72, 0.58);
  } else {
    // Not visible from this vantage — desaturated, dim, "in shadow"
    return hslToRgb(hue, 0.12, 0.20);
  }
}

/**
 * Add subtle per-cell noise for texture within large prefixes.
 * Returns a brightness multiplier in [0.93, 1.07].
 * Uses a deterministic hash of cell + prefix so noise is stable.
 */
export function cellNoise(cell: number, prefixIdx: number): number {
  const hash = (cell * 2654435761 + prefixIdx * 1597334677) >>> 0;
  return 0.94 + ((hash & 0xFF) / 255) * 0.12;
}

// ── HSL helpers ─────────────────────────────────────────────

function hslToRgb(h: number, s: number, l: number): RGB {
  h /= 360;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  return [
    Math.round(f(0) * 255),
    Math.round(f(8) * 255),
    Math.round(f(4) * 255),
  ];
}

/**
 * Blend an RGB color with a brightness multiplier.
 * Clamps values to [0, 255].
 */
export function applyBrightness(color: RGB, factor: number): RGB {
  return [
    Math.min(255, Math.max(0, Math.round(color[0] * factor))),
    Math.min(255, Math.max(0, Math.round(color[1] * factor))),
    Math.min(255, Math.max(0, Math.round(color[2] * factor))),
  ];
}
