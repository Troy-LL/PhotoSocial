import type { CollageLayout, LayoutPreset } from "./types.js";

function buildSlots(rows: number, cols: number) {
  const slots = [];
  let index = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      slots.push({
        index,
        row,
        col,
        rowSpan: 1,
        colSpan: 1,
        assignedTo: null,
        locked: false,
      });
      index++;
    }
  }
  return slots;
}

export const LAYOUT_PRESETS: Record<
  LayoutPreset,
  { label: string; rows: number; cols: number }
> = {
  duo: { label: "Duo", rows: 1, cols: 2 },
  squad: { label: "Squad", rows: 2, cols: 2 },
  party: { label: "Party", rows: 2, cols: 3 },
  strip: { label: "Strip", rows: 1, cols: 4 },
  panorama: { label: "Panorama", rows: 1, cols: 3 },
};

export function createLayout(preset: LayoutPreset): CollageLayout {
  const { rows, cols } = LAYOUT_PRESETS[preset];
  return {
    preset,
    rows,
    cols,
    slots: buildSlots(rows, cols),
  };
}
