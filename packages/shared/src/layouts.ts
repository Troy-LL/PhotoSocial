import type { CollageLayout, LayoutPreset, SlotDefinition } from "./types.js";

const STRIP_TRACK = 24;

type SlotTemplate = Pick<
  SlotDefinition,
  "index" | "row" | "col" | "rowSpan" | "colSpan"
>;

export interface LayoutPresetMeta {
  label: string;
  orientation: "vertical" | "horizontal";
  rows: number;
  cols: number;
  /** CSS aspect-ratio value for the strip frame */
  aspectRatio: string;
  slots: SlotTemplate[];
}

function vSlots(...rows: [start: number, span: number][]): SlotTemplate[] {
  return rows.map(([row, rowSpan], index) => ({
    index,
    row,
    col: 0,
    rowSpan,
    colSpan: 1,
  }));
}

function hSlots(...cols: [start: number, span: number][]): SlotTemplate[] {
  return cols.map(([col, colSpan], index) => ({
    index,
    row: 0,
    col,
    rowSpan: 1,
    colSpan,
  }));
}

function withAssignment(slots: SlotTemplate[]): SlotDefinition[] {
  return slots.map((s) => ({
    ...s,
    assignedTo: null,
    locked: false,
  }));
}

/** Photobooth strip layouts — vertical (portrait strip) */
export const VERTICAL_LAYOUT_PRESETS = [
  "strip4",
  "strip3Top",
  "strip4Top",
  "strip3Center",
] as const satisfies readonly LayoutPreset[];

/** Photobooth strip layouts — horizontal (landscape strip) */
export const HORIZONTAL_LAYOUT_PRESETS = [
  "strip4H",
  "strip3TopH",
  "strip4TopH",
  "strip3CenterH",
] as const satisfies readonly LayoutPreset[];

export const LAYOUT_PRESET_ORDER = [
  ...VERTICAL_LAYOUT_PRESETS,
  ...HORIZONTAL_LAYOUT_PRESETS,
] as const;

export const LAYOUT_PRESETS: Record<LayoutPreset, LayoutPresetMeta> = {
  /** 4 photos, evenly spaced (full strip) */
  strip4: {
    label: "4-Up",
    orientation: "vertical",
    rows: STRIP_TRACK,
    cols: 1,
    aspectRatio: "1 / 3",
    slots: vSlots([0, 6], [6, 6], [12, 6], [18, 6]),
  },
  /** 3 photos at top, open space below */
  strip3Top: {
    label: "3-Up Top",
    orientation: "vertical",
    rows: STRIP_TRACK,
    cols: 1,
    aspectRatio: "1 / 3",
    slots: vSlots([0, 6], [6, 6], [12, 6]),
  },
  /** 4 photos grouped toward top, larger bottom margin */
  strip4Top: {
    label: "4-Up Top",
    orientation: "vertical",
    rows: STRIP_TRACK,
    cols: 1,
    aspectRatio: "1 / 3",
    slots: vSlots([1, 4], [6, 4], [11, 4], [16, 4]),
  },
  /** 3 photos vertically centered */
  strip3Center: {
    label: "3-Up Center",
    orientation: "vertical",
    rows: STRIP_TRACK,
    cols: 1,
    aspectRatio: "1 / 3",
    slots: vSlots([4, 5], [10, 5], [16, 5]),
  },
  /** 4 photos side by side (full strip) */
  strip4H: {
    label: "4-Up Wide",
    orientation: "horizontal",
    rows: 1,
    cols: STRIP_TRACK,
    aspectRatio: "3 / 1",
    slots: hSlots([0, 6], [6, 6], [12, 6], [18, 6]),
  },
  /** 3 photos on the left, open space on the right */
  strip3TopH: {
    label: "3-Up Left",
    orientation: "horizontal",
    rows: 1,
    cols: STRIP_TRACK,
    aspectRatio: "3 / 1",
    slots: hSlots([0, 6], [6, 6], [12, 6]),
  },
  /** 4 photos grouped toward the left, larger right margin */
  strip4TopH: {
    label: "4-Up Left",
    orientation: "horizontal",
    rows: 1,
    cols: STRIP_TRACK,
    aspectRatio: "3 / 1",
    slots: hSlots([1, 4], [6, 4], [11, 4], [16, 4]),
  },
  /** 3 photos horizontally centered */
  strip3CenterH: {
    label: "3-Up Center Wide",
    orientation: "horizontal",
    rows: 1,
    cols: STRIP_TRACK,
    aspectRatio: "3 / 1",
    slots: hSlots([4, 5], [10, 5], [16, 5]),
  },
};

const DEFAULT_PRESET: LayoutPreset = "strip4";

function resolveLayoutPreset(preset: LayoutPreset | string): LayoutPreset {
  if (preset in LAYOUT_PRESETS) {
    return preset as LayoutPreset;
  }
  return DEFAULT_PRESET;
}

export function createLayout(preset: LayoutPreset | string): CollageLayout {
  const resolved = resolveLayoutPreset(preset);
  const def = LAYOUT_PRESETS[resolved];
  return {
    preset: resolved,
    rows: def.rows,
    cols: def.cols,
    orientation: def.orientation,
    aspectRatio: def.aspectRatio,
    slots: withAssignment(def.slots),
  };
}

export function getLayoutPresetMeta(
  preset: LayoutPreset | string
): LayoutPresetMeta {
  return LAYOUT_PRESETS[resolveLayoutPreset(preset)];
}
