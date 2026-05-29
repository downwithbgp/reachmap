/**
 * Editorial color system for ReachMap.
 */

export type RGB = [number, number, number];

// Background
export const BG: RGB = [8, 8, 18];

// ASN base hues (soft, editorial)
export function asnHue(asn: number): number {
  switch (asn) {
    case 27725: return 215; // ETECSA — soft electric blue
    case 11960: return 175; // ETECSA IXP — muted teal
    case 10569: return 40;  // CENIAInternet — warm amber
    default:    return 270; // other — muted violet
  }
}

export function getPrefixColor(
  prefix: { originAsns: number[]; observedInBgp: boolean },
  visibleSet: Set<string> | null,
  prefixStr: string
): RGB {
  if (!prefix.observedInBgp) return [18, 18, 30];
  const asn = prefix.originAsns[0] ?? 0;
  const hue = asnHue(asn);

  if (visibleSet === null) return hslToRgb(hue, 0.45, 0.48);

  const isVisible = visibleSet.has(prefixStr);
  if (isVisible) return hslToRgb(hue, 0.72, 0.58);
  return hslToRgb(hue, 0.12, 0.20);
}

export function cellNoise(cell: number, prefixIdx: number): number {
  const hash = (cell * 2654435761 + prefixIdx * 1597334677) >>> 0;
  return 0.94 + ((hash & 0xFF) / 255) * 0.12;
}

export function applyBrightness(color: RGB, factor: number): RGB {
  return [
    Math.min(255, Math.max(0, Math.round(color[0] * factor))),
    Math.min(255, Math.max(0, Math.round(color[1] * factor))),
    Math.min(255, Math.max(0, Math.round(color[2] * factor))),
  ];
}

/**
 * Consensus weather color scale.
 * visibilityRatio 1.0 → bright green (fully visible)
 * 0.75 → yellow-green, 0.50 → amber, 0.25 → red-orange, 0.01 → deep red
 * 0.0 / not in BGP → charcoal
 */
export function getConsensusColor(
  prefix: { observedInBgp: boolean },
  visibilityRatio: number | null
): RGB {
  if (!prefix.observedInBgp) return [22, 22, 34]; // charcoal — not in BGP

  if (visibilityRatio === null) return [80, 80, 110]; // no consensus data — neutral

  const r = visibilityRatio;

  if (r >= 1.0)  return [40, 180, 90];   // bright green — full consensus
  if (r >= 0.75) return [120, 175, 55];  // yellow-green
  if (r >= 0.50) return [200, 160, 40];  // amber
  if (r >= 0.25) return [210, 100, 35];  // burnt orange
  if (r > 0.0)   return [180, 45, 35];   // deep red — barely visible

  return [22, 22, 34]; // should not reach here
}

function hslToRgb(h: number, s: number, l: number): RGB {
  h /= 360;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
