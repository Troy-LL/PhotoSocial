import type { CoreThemeTokens, ThemeKey, ThemeTokens } from "./types.js";

const PRESET_THEMES: Record<Exclude<ThemeKey, "custom">, CoreThemeTokens> = {
  snow: {
    "--color-bg": "#ffffff",
    "--color-surface": "#f7f7f7",
    "--color-surface-raised": "#ffffff",
    "--color-text-primary": "#1a1a1a",
    "--color-text-secondary": "#6b6b6b",
    "--color-accent": "#2d6a4f",
    "--color-border": "#e8e8e8",
    "--shadow-card": "0 2px 16px rgba(0,0,0,0.06)",
  },
  midnight: {
    "--color-bg": "#1a2744",
    "--color-surface": "#243352",
    "--color-surface-raised": "#2d3f63",
    "--color-text-primary": "#f0f4ff",
    "--color-text-secondary": "#a8b4d4",
    "--color-accent": "#7eb8da",
    "--color-border": "#3a4d73",
    "--shadow-card": "0 2px 16px rgba(0,0,0,0.25)",
  },
  petal: {
    "--color-bg": "#fff5f8",
    "--color-surface": "#f9d9e3",
    "--color-surface-raised": "#ffffff",
    "--color-text-primary": "#4a2030",
    "--color-text-secondary": "#8b5a6a",
    "--color-accent": "#d4567a",
    "--color-border": "#f0c4d4",
    "--shadow-card": "0 2px 16px rgba(212,86,122,0.12)",
  },
  slate: {
    "--color-bg": "#2d3748",
    "--color-surface": "#3d4a5c",
    "--color-surface-raised": "#4a5568",
    "--color-text-primary": "#f7fafc",
    "--color-text-secondary": "#a0aec0",
    "--color-accent": "#90cdf4",
    "--color-border": "#4a5568",
    "--shadow-card": "0 2px 16px rgba(0,0,0,0.2)",
  },
  citrus: {
    "--color-bg": "#fffdf5",
    "--color-surface": "#fff3cd",
    "--color-surface-raised": "#ffffff",
    "--color-text-primary": "#3d3200",
    "--color-text-secondary": "#7a6b20",
    "--color-accent": "#e6a817",
    "--color-border": "#f0e0a0",
    "--shadow-card": "0 2px 16px rgba(230,168,23,0.15)",
  },
};

function parseHex(hex: string): [number, number, number] {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function mixHex(a: string, b: string, amount: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  const ch = (from: number, to: number) =>
    Math.round(from + (to - from) * amount);
  return `#${[ch(ar, br), ch(ag, bg), ch(ab, bb)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Strip frame + photo-window colors with readable contrast per theme. */
function withLayoutThumbTokens(base: CoreThemeTokens): ThemeTokens {
  const frame = base["--color-surface"];
  const { textPrimary, accent } = {
    textPrimary: base["--color-text-primary"],
    accent: base["--color-accent"],
  };
  const frameIsLight = relativeLuminance(frame) > 0.55;
  const cell = frameIsLight
    ? mixHex(textPrimary, accent, 0.35)
    : mixHex(textPrimary, accent, 0.3);
  const cellIsLight = relativeLuminance(cell) > 0.55;
  const cellFg = cellIsLight
    ? base["--color-text-secondary"]
    : mixHex("#ffffff", textPrimary, 0.65);

  return {
    ...base,
    "--layout-thumb-frame": frame,
    "--layout-thumb-cell": cell,
    "--layout-thumb-cell-fg": cellFg,
  };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function normalizeHue(hue?: number | null): number | undefined {
  if (hue == null || typeof hue !== "number" || !Number.isFinite(hue)) {
    return undefined;
  }
  return Math.max(0, Math.min(360, Math.round(hue)));
}

function resolvePresetKey(theme: ThemeKey): Exclude<ThemeKey, "custom"> {
  if (theme === "custom") return "snow";
  if (theme in PRESET_THEMES) return theme as Exclude<ThemeKey, "custom">;
  return "snow";
}

export function resolveThemeTokens(
  theme: ThemeKey,
  customHue?: number
): ThemeTokens {
  const hue = normalizeHue(customHue);
  if (theme !== "custom" || hue === undefined) {
    return withLayoutThumbTokens(PRESET_THEMES[resolvePresetKey(theme)]);
  }

  const accent = hslToHex(hue, 45, 45);
  const surface = hslToHex(hue, 25, 94);
  const bg = hslToHex(hue, 15, 98);

  return withLayoutThumbTokens({
    "--color-bg": bg,
    "--color-surface": surface,
    "--color-surface-raised": "#ffffff",
    "--color-text-primary": "#1a1a1a",
    "--color-text-secondary": "#5a5a5a",
    "--color-accent": accent,
    "--color-border": hslToHex(hue, 20, 88),
    "--shadow-card": "0 2px 16px rgba(0,0,0,0.06)",
  });
}

/** Preset themes shown in the UI (4 swatches + custom color wheel). */
export const UI_THEME_PRESETS = [
  "snow",
  "petal",
  "midnight",
  "citrus",
] as const satisfies readonly ThemeKey[];

export const THEME_LABELS: Record<ThemeKey, string> = {
  snow: "Snow",
  midnight: "Midnight",
  petal: "Petal",
  slate: "Slate",
  citrus: "Citrus",
  custom: "Custom",
};
