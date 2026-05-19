import type { ThemeKey, ThemeTokens } from "./types.js";

const PRESET_THEMES: Record<Exclude<ThemeKey, "custom">, ThemeTokens> = {
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

export function resolveThemeTokens(
  theme: ThemeKey,
  customHue?: number
): ThemeTokens {
  if (theme !== "custom" || customHue === undefined) {
    const key = theme === "custom" ? "snow" : theme;
    return PRESET_THEMES[key];
  }

  const accent = hslToHex(customHue, 45, 45);
  const surface = hslToHex(customHue, 25, 94);
  const bg = hslToHex(customHue, 15, 98);

  return {
    "--color-bg": bg,
    "--color-surface": surface,
    "--color-surface-raised": "#ffffff",
    "--color-text-primary": "#1a1a1a",
    "--color-text-secondary": "#5a5a5a",
    "--color-accent": accent,
    "--color-border": hslToHex(customHue, 20, 88),
    "--shadow-card": "0 2px 16px rgba(0,0,0,0.06)",
  };
}

export const THEME_LABELS: Record<ThemeKey, string> = {
  snow: "Snow",
  midnight: "Midnight",
  petal: "Petal",
  slate: "Slate",
  citrus: "Citrus",
  custom: "Custom",
};
