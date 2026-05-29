/**
 * ReachMap — Cuba Hilbert Prototype v3 (refined)
 *
 * Compact national Hilbert at order 9 (512×512) with per-cell texture,
 * editorial color palette, smooth vantage transitions, path families,
 * and polished interactions.
 */

import {
  HILBERT_ORDER, CANVAS_SIZE, TOTAL_CELLS, IPS_PER_CELL,
  ipToCell, cellToXY, xyToCell, buildCellPrefixMap,
  getPrefixColorWithVisibility, cellNoise, applyBrightness,
} from "./hilbert";
import {
  COMPACT_ORDER, COMPACT_SIZE, COMPACT_TOTAL_CELLS,
  buildCompactMap, compactCellToXY, compactXyToCell,
  getCompactIpsPerCell, type CompactMapping,
} from "./compact";
import { renderCubaOutline } from "./anchor";
import {
  cubaPrefixes, mockVantages, mockPathFamilies,
  buildVantageMap, getVisiblePathFamilies,
} from "./data";
import type { PrefixVisualRecord, VantageVisibilityRecord, PathFamilyRecord } from "./data";

// ── State ────────────────────────────────────────────────────
const vantageMap = buildVantageMap();

// Global (full IPv4) state — stays at order 10
const globalCellMap = buildCellPrefixMap(cubaPrefixes);
const globalActiveCells: { cell: number; prefixIdx: number }[] = [];
for (let c = 0; c < TOTAL_CELLS; c++) {
  const idx = globalCellMap[c];
  if (idx > 0) globalActiveCells.push({ cell: c, prefixIdx: idx - 1 });
}

// Compact (national) state — order 9
const { cellMap: compactCellMap, mappings: compactMappings } = buildCompactMap(cubaPrefixes);
const compactActiveCells: { cell: number; prefixIdx: number }[] = [];
for (let c = 0; c < COMPACT_TOTAL_CELLS; c++) {
  const idx = compactCellMap[c];
  if (idx > 0) compactActiveCells.push({ cell: c, prefixIdx: idx - 1 });
}
const compactIpsPerCell = getCompactIpsPerCell(cubaPrefixes);

// Shared state
let selectedVantage: VantageVisibilityRecord | null = null;
let visibleSet: Set<string> | null = null;
let selectedPrefix: PrefixVisualRecord | null = null;
let currentView: "compact" | "global" = "compact";

// Hover state
interface HoverState { cell: number; prefix: PrefixVisualRecord | null; }
const hover: Record<string, HoverState> = {
  compact: { cell: -1, prefix: null },
  global: { cell: -1, prefix: null },
};

// ── DOM refs ─────────────────────────────────────────────────
const compactCanvas = document.getElementById("compact-canvas") as HTMLCanvasElement;
const compactCtx = compactCanvas.getContext("2d")!;
const compactTooltip = document.getElementById("compact-tooltip") as HTMLDivElement;
const compactStats = document.getElementById("compact-stats") as HTMLDivElement;

const globalCanvas = document.getElementById("global-canvas") as HTMLCanvasElement;
const globalCtx = globalCanvas.getContext("2d")!;
const globalTooltip = document.getElementById("global-tooltip") as HTMLDivElement;
const globalStats = document.getElementById("global-stats") as HTMLDivElement;

const vantageSelect = document.getElementById("vantage-select") as HTMLSelectElement;
const vantageInfo = document.getElementById("vantage-info") as HTMLDivElement;
const prefixInfo = document.getElementById("prefix-info") as HTMLDivElement;
const cubaSvg = document.getElementById("cuba-map") as unknown as SVGSVGElement;

// ── Initialization ──────────────────────────────────────────

function init() {
  compactCanvas.width = COMPACT_SIZE;
  compactCanvas.height = COMPACT_SIZE;
  globalCanvas.width = CANVAS_SIZE;
  globalCanvas.height = CANVAS_SIZE;

  renderCubaOutline(cubaSvg);

  for (const v of mockVantages) {
    const opt = document.createElement("option");
    opt.value = String(v.peerAsn);
    opt.textContent = `${v.peerName} / AS${v.peerAsn}`;
    vantageSelect.appendChild(opt);
  }

  vantageSelect.addEventListener("change", onVantageChange);
  compactCanvas.addEventListener("mousemove", (e) => onMouseMove(e, "compact"));
  compactCanvas.addEventListener("mouseleave", () => onMouseLeave("compact"));
  compactCanvas.addEventListener("click", (e) => onClick(e, "compact"));
  globalCanvas.addEventListener("mousemove", (e) => onMouseMove(e, "global"));
  globalCanvas.addEventListener("mouseleave", () => onMouseLeave("global"));
  globalCanvas.addEventListener("click", (e) => onClick(e, "global"));

  document.querySelectorAll(".view-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      currentView = (tab as HTMLElement).dataset.view as "compact" | "global";
      document.querySelectorAll(".view-tab").forEach(t => t.classList.remove("active"));
      document.querySelector(`[data-view="${currentView}"]`)?.classList.add("active");
      document.getElementById("compact-view")?.classList.toggle("active", currentView === "compact");
      document.getElementById("global-view")?.classList.toggle("active", currentView === "global");
    });
  });

  renderAll();
  updateStats();
}

// ── Rendering ───────────────────────────────────────────────

function renderAll() {
  renderCompact();
  renderGlobal();
}

function renderCompact() {
  const ctx = compactCtx;
  const size = COMPACT_SIZE;
  const img = ctx.createImageData(size, size);
  const d = img.data;

  // Background — deep navy
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 8; d[i + 1] = 8; d[i + 2] = 18; d[i + 3] = 255;
  }

  // Paint prefix cells with noise texture
  for (const { cell, prefixIdx } of compactActiveCells) {
    const prefix = cubaPrefixes[prefixIdx];
    const [r, g, b] = getPrefixColorWithVisibility(prefix, visibleSet);
    const noise = cellNoise(cell, prefixIdx);
    const [nr, ng, nb] = applyBrightness([r, g, b], noise);
    const [cx, cy] = compactCellToXY(cell);
    const px = (cy * size + cx) * 4;
    d[px] = nr; d[px + 1] = ng; d[px + 2] = nb; d[px + 3] = 255;
  }

  ctx.putImageData(img, 0, 0);

  // Hover highlight — luminous glow
  const h = hover.compact;
  if (h.prefix && h.cell >= 0) {
    const mapping = compactMappings.find(m => m.prefixIdx === cubaPrefixes.indexOf(h.prefix!));
    if (mapping) {
      // Subtle glow on hovered prefix region
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      for (let c = mapping.virtualStart; c <= mapping.virtualEnd; c++) {
        const [cx, cy] = compactCellToXY(c);
        ctx.fillRect(cx, cy, 1, 1);
      }
      // Brighter edge on boundaries
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 0.5;
      // Draw boundary pixels (approximate)
      const drawn = new Set<number>();
      for (let c = mapping.virtualStart; c <= mapping.virtualEnd; c++) {
        const [cx, cy] = compactCellToXY(c);
        const key = cx * size + cy;
        if (drawn.has(key)) continue;
        // Check neighbors — if any neighbor is not in the mapping, this is a boundary
        const neighbors = [[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
          const nc = compactXyToCell(nx, ny);
          if (nc < mapping.virtualStart || nc > mapping.virtualEnd) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
            ctx.fillRect(cx, cy, 1, 1);
            drawn.add(key);
            break;
          }
        }
      }
    }
  }

  // Persistent selection highlight
  if (selectedPrefix) {
    const mapping = compactMappings.find(m => m.prefixIdx === cubaPrefixes.indexOf(selectedPrefix));
    if (mapping) {
      ctx.strokeStyle = "rgba(255, 220, 160, 0.7)";
      ctx.lineWidth = 1;
      const drawn = new Set<number>();
      for (let c = mapping.virtualStart; c <= mapping.virtualEnd; c++) {
        const [cx, cy] = compactCellToXY(c);
        const neighbors = [[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
          const nc = compactXyToCell(nx, ny);
          if (nc < mapping.virtualStart || nc > mapping.virtualEnd) {
            drawn.add(cx * size + cy);
            break;
          }
        }
      }
      for (const key of drawn) {
        const cx = Math.floor(key / size);
        const cy = key % size;
        ctx.fillStyle = "rgba(255, 220, 160, 0.5)";
        ctx.fillRect(cx, cy, 1, 1);
      }
    }
  }

  // Hilbert path grid — subtle lines every 64 cells
  ctx.strokeStyle = "rgba(255, 255, 255, 0.025)";
  ctx.lineWidth = 0.3;
  for (let i = 64; i < size; i += 64) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
  }

  // Border
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 0.5;
  ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
}

function renderGlobal() {
  const ctx = globalCtx;
  const size = CANVAS_SIZE;
  const img = ctx.createImageData(size, size);
  const d = img.data;

  for (let i = 0; i < d.length; i += 4) {
    d[i] = 8; d[i + 1] = 8; d[i + 2] = 18; d[i + 3] = 255;
  }

  for (const { cell, prefixIdx } of globalActiveCells) {
    const prefix = cubaPrefixes[prefixIdx];
    const [r, g, b] = getPrefixColorWithVisibility(prefix, visibleSet);
    const [cx, cy] = cellToXY(cell);
    const px = (cy * size + cx) * 4;
    d[px] = r; d[px + 1] = g; d[px + 2] = b; d[px + 3] = 255;
  }

  ctx.putImageData(img, 0, 0);

  const h = hover.global;
  if (h.prefix) {
    const sc = ipToCell(h.prefix.prefixStart);
    const ec = ipToCell(h.prefix.prefixEnd);
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    for (let c = sc; c <= ec && c < TOTAL_CELLS; c++) {
      const [cx, cy] = cellToXY(c);
      ctx.fillRect(cx, cy, 1, 1);
    }
  }

  ctx.strokeStyle = "rgba(255, 255, 255, 0.025)";
  ctx.lineWidth = 0.3;
  for (let i = 64; i < size; i += 64) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 0.5;
  ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
}

function updateStats() {
  const total = cubaPrefixes.length;
  const inBgp = cubaPrefixes.filter(p => p.observedInBgp).length;
  const activePercent = (compactActiveCells.length / COMPACT_TOTAL_CELLS * 100).toFixed(1);
  compactStats.textContent =
    `${inBgp}/${total} prefixes in BGP · ~${compactIpsPerCell} IPs/cell · order ${COMPACT_ORDER} · ${activePercent}% fill · national fingerprint`;
  globalStats.textContent =
    `${globalActiveCells.length} cells · ~${IPS_PER_CELL} IPs/cell · order ${HILBERT_ORDER} · full IPv4 context`;
}

// ── Vantage handling ────────────────────────────────────────

function onVantageChange() {
  const asn = parseInt(vantageSelect.value);
  if (isNaN(asn)) {
    selectedVantage = null;
    visibleSet = null;
    vantageInfo.classList.add("hidden");
  } else {
    selectedVantage = vantageMap.get(asn) ?? null;
    visibleSet = selectedVantage ? new Set(selectedVantage.visiblePrefixes) : null;
  }
  updateVantagePanel();
  renderAll();
}

function updateVantagePanel() {
  if (!selectedVantage) { vantageInfo.classList.add("hidden"); return; }
  vantageInfo.classList.remove("hidden");

  const visible = selectedVantage.visiblePrefixes.length;
  const missing = selectedVantage.missingPrefixes.length;
  const total = visible + missing;
  const pct = total > 0 ? Math.round((visible / total) * 100) : 0;

  // Get path families visible from this vantage
  const pathFams = getVisiblePathFamilies(selectedVantage.visiblePrefixes);

  vantageInfo.innerHTML = `
    <div class="stat-row"><span class="stat-label">ASN</span><span class="stat-value">${selectedVantage.peerAsn}</span></div>
    <div class="stat-row"><span class="stat-label">Name</span><span class="stat-value">${selectedVantage.peerName}</span></div>
    <div class="stat-row"><span class="stat-label">Collectors</span><span class="stat-value">${selectedVantage.collectors.join(", ")}</span></div>
    <div class="stat-row"><span class="stat-label">Visible</span><span class="stat-value accent-green">${visible} / ${total} (${pct}%)</span></div>
    <div class="stat-row"><span class="stat-label">Not visible</span><span class="stat-value accent-red">${missing}</span></div>
    ${missing > 0 ? `
      <details class="missing-detail">
        <summary>Missing prefixes (${missing})</summary>
        <ul class="missing-list">${selectedVantage.missingPrefixes.map(p => `<li>${p}</li>`).join("")}</ul>
      </details>` : ""}
    <div class="path-families-section">
      <div class="path-families-label">AS-path families (${pathFams.length})</div>
      <div class="path-families-list">
        ${pathFams.map(pf => `
          <div class="path-family-item">
            <span class="pf-id">${pf.id}</span>
            <span class="pf-path">${pf.path.map((as, i) =>
              i === pf.path.length - 1
                ? `<strong style="color:#e0c060">AS${as}</strong>`
                : `<code>AS${as}</code>`
            ).join(" → ")}</span>
            <span class="pf-prefixes">${pf.prefixes.length} prefixes · ${pf.collectorCount} collectors</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

// ── Interaction ─────────────────────────────────────────────

function onMouseMove(e: MouseEvent, view: "compact" | "global") {
  const canvas = view === "compact" ? compactCanvas : globalCanvas;
  const tooltip = view === "compact" ? compactTooltip : globalTooltip;
  const rect = canvas.getBoundingClientRect();
  const rawSize = view === "compact" ? COMPACT_SIZE : CANVAS_SIZE;
  const scaleX = rawSize / rect.width;
  const scaleY = rawSize / rect.height;
  const x = Math.floor((e.clientX - rect.left) * scaleX);
  const y = Math.floor((e.clientY - rect.top) * scaleY);

  if (x < 0 || x >= rawSize || y < 0 || y >= rawSize) {
    tooltip.classList.add("hidden");
    return;
  }

  if (view === "compact") {
    const cell = compactXyToCell(x, y);
    const prefixIdx = compactCellMap[cell];
    if (prefixIdx === 0) {
      hover.compact = { cell: -1, prefix: null };
      tooltip.classList.add("hidden");
    } else {
      const prefix = cubaPrefixes[prefixIdx - 1];
      const mapping = compactMappings.find(m => m.prefixIdx === prefixIdx - 1);
      if (hover.compact.prefix !== prefix) {
        hover.compact = { cell, prefix };
        renderCompact();
      }
      showTooltip(tooltip, e, canvas, prefix, view, mapping);
    }
  } else {
    const cell = xyToCell(x, y);
    const prefixIdx = globalCellMap[cell];
    if (prefixIdx === 0) {
      hover.global = { cell: -1, prefix: null };
      tooltip.classList.add("hidden");
      showGlobalCellTooltip(tooltip, e, canvas, cell);
    } else {
      const prefix = cubaPrefixes[prefixIdx - 1];
      if (hover.global.prefix !== prefix) {
        hover.global = { cell, prefix };
        renderGlobal();
      }
      showTooltip(tooltip, e, canvas, prefix, view);
    }
  }
}

function showTooltip(
  tooltip: HTMLDivElement, e: MouseEvent, canvas: HTMLCanvasElement,
  prefix: PrefixVisualRecord, view: string, mapping?: CompactMapping
) {
  const visible = visibleSet ? visibleSet.has(prefix.prefix) : null;
  const statusText = !prefix.observedInBgp
    ? "Not observed in BGP"
    : visible === true ? "Visible from this vantage"
    : visible === false ? "Not visible from this vantage"
    : "Observed in BGP";
  const statusClass = !prefix.observedInBgp ? "status-muted"
    : visible === true ? "status-visible"
    : visible === false ? "status-hidden"
    : "status-default";

  const cellsInfo = mapping
    ? `${mapping.cellCount} cell${mapping.cellCount > 1 ? "s" : ""}`
    : `${Math.max(1, ipToCell(prefix.prefixEnd) - ipToCell(prefix.prefixStart) + 1)} cells`;

  tooltip.innerHTML = `
    <div class="tooltip-prefix">${prefix.prefix}</div>
    <div class="tooltip-status ${statusClass}">${statusText}</div>
    <div class="tooltip-row"><span>Origin</span> <strong>${prefix.originNames.join(", ")}</strong> <span class="tooltip-asn">AS${prefix.originAsns.join(", AS")}</span></div>
    <div class="tooltip-row"><span>Allocation</span> ${prefix.addressCount.toLocaleString()} IPs /${prefix.prefixLength}</div>
    <div class="tooltip-row"><span>Cells</span> ${cellsInfo}</div>
    ${view === "compact" ? '<div class="tooltip-note">Remapped position — not global IPv4 location</div>' : ""}
    <div class="tooltip-hint">Click to select · showing mock data</div>
  `;

  tooltip.classList.remove("hidden");
  positionTooltip(tooltip, e, canvas);
}

function showGlobalCellTooltip(tooltip: HTMLDivElement, e: MouseEvent, canvas: HTMLCanvasElement, cell: number) {
  const ipStart = cell * IPS_PER_CELL;
  const ipEnd = ipStart + IPS_PER_CELL - 1;
  tooltip.innerHTML = `
    <div class="tooltip-prefix">Non-Cuban IPv4 space</div>
    <div class="tooltip-row">Cell ${cell.toLocaleString()} / ${TOTAL_CELLS.toLocaleString()}</div>
    <div class="tooltip-row">Range: ${intToIp(ipStart)} — ${intToIp(ipEnd)}</div>
  `;
  tooltip.classList.remove("hidden");
  positionTooltip(tooltip, e, canvas);
}

function positionTooltip(tooltip: HTMLDivElement, e: MouseEvent, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  let left = e.clientX - rect.left + 14;
  let top = e.clientY - rect.top - 10;
  if (left + 260 > rect.width) left = e.clientX - rect.left - 270;
  if (top + 180 > rect.height) top = e.clientY - rect.top - 190;
  if (left < 0) left = 4;
  if (top < 0) top = 4;
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function onMouseLeave(view: string) {
  const tooltip = view === "compact" ? compactTooltip : globalTooltip;
  tooltip.classList.add("hidden");
  hover[view] = { cell: -1, prefix: null };
  if (view === "compact") renderCompact(); else renderGlobal();
}

function onClick(_e: MouseEvent, view: string) {
  const h = hover[view];
  if (!h.prefix) {
    selectedPrefix = null;
    prefixInfo.innerHTML = '<span class="muted-text">Click a cell to select a prefix</span>';
    renderAll();
    return;
  }

  // Toggle selection
  if (selectedPrefix === h.prefix) {
    selectedPrefix = null;
  } else {
    selectedPrefix = h.prefix;
  }

  if (selectedPrefix) {
    showPrefixDetail(selectedPrefix);
  } else {
    prefixInfo.innerHTML = '<span class="muted-text">Click a cell to select a prefix</span>';
  }

  renderAll();
}

function showPrefixDetail(prefix: PrefixVisualRecord) {
  const visible = visibleSet ? visibleSet.has(prefix.prefix) : null;
  const relevantPaths = mockPathFamilies.filter(pf => pf.prefixes.includes(prefix.prefix));

  prefixInfo.innerHTML = `
    <div class="detail-header">${prefix.prefix}</div>
    <div class="stat-row"><span class="stat-label">Origin</span><span class="stat-value">${prefix.originNames.join(", ")} <span class="detail-asn">AS${prefix.originAsns.join(", AS")}</span></span></div>
    <div class="stat-row"><span class="stat-label">Allocation</span><span class="stat-value">${prefix.addressCount.toLocaleString()} IPs (/${prefix.prefixLength})</span></div>
    <div class="stat-row"><span class="stat-label">BGP observed</span><span class="stat-value ${prefix.observedInBgp ? 'accent-green' : 'accent-red'}">${prefix.observedInBgp ? "Yes" : "No"}</span></div>
    ${selectedVantage ? `
    <div class="stat-row"><span class="stat-label">Visible from ${selectedVantage.peerName}</span><span class="stat-value ${visible ? 'accent-green' : 'accent-red'}">${visible === true ? "Yes" : visible === false ? "No" : "N/A"}</span></div>` : ""}
    <div class="stat-row"><span class="stat-label">Confidence</span><span class="stat-value">${prefix.confidence}</span></div>
    ${relevantPaths.length > 0 ? `
    <div class="path-section">
      <div class="path-label">AS-path families using this prefix</div>
      <div class="path-list">
        ${relevantPaths.map(pf => `
          <div class="pf-detail-item">
            <span class="pf-detail-id">${pf.id}</span>
            <span class="pf-detail-path">${pf.path.map((as, i) =>
              i === pf.path.length - 1
                ? `<strong>AS${as}</strong>`
                : `<code>AS${as}</code>`
            ).join(" → ")}</span>
            <span class="pf-detail-meta">${pf.collectorCount} collectors</span>
          </div>
        `).join("")}
      </div>
    </div>` : ""}
    <div class="mock-note">Mock data — real RouteViews data pending</div>
  `;
}

// ── Utilities ───────────────────────────────────────────────

function intToIp(int: number): string {
  return [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join(".");
}

// ── Boot ────────────────────────────────────────────────────

init();
