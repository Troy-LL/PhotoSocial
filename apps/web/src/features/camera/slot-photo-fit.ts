/** Per-slot crop / pan for cover-fit display (0–100 = object-position %) */
export interface SlotPhotoFit {
  x: number;
  y: number;
  /** 1 = default cover; >1 zooms in */
  scale: number;
}

export const DEFAULT_SLOT_PHOTO_FIT: SlotPhotoFit = { x: 50, y: 50, scale: 1 };

export type SlotFitAxis = "vertical" | "horizontal";

/**
 * Cover-fit axis for a slot.
 * Strip orientation matches how photos are framed: vertical strip fills height (crop sides),
 * horizontal strip fills width (crop top/bottom).
 */
export function slotFitAxis(
  rowSpan: number,
  colSpan: number,
  stripOrientation?: "vertical" | "horizontal"
): SlotFitAxis {
  if (stripOrientation === "vertical") return "vertical";
  if (stripOrientation === "horizontal") return "horizontal";
  return rowSpan >= colSpan ? "vertical" : "horizontal";
}

export function clampFit(fit: SlotPhotoFit): SlotPhotoFit {
  return {
    x: Math.min(100, Math.max(0, fit.x)),
    y: Math.min(100, Math.max(0, fit.y)),
    scale: Math.min(3, Math.max(1, fit.scale)),
  };
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

/**
 * Visual aspect ratio of one collage slot (CSS width / height).
 * Do not use raw grid rowSpan/colSpan — those are track counts, not pixels.
 */
export function slotDisplayAspectRatio(
  colSpan: number,
  rowSpan: number,
  layoutCols: number,
  layoutRows: number,
  layoutAspectRatio: string
): string {
  const parts = layoutAspectRatio.split("/").map((s) => Number(s.trim()));
  const layoutW = parts[0] > 0 ? parts[0] : 1;
  const layoutH = parts[1] > 0 ? parts[1] : 1;
  const num = colSpan * layoutRows * layoutW;
  const den = rowSpan * layoutCols * layoutH;
  const g = gcd(num, den);
  return `${num / g} / ${den / g}`;
}
