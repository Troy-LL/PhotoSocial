import { resolveThemeTokens, type ThemeKey } from "@photosocial/shared";

const KEY = "photosocial-theme";

export interface ThemePreference {
  theme: ThemeKey;
  customHue?: number;
}

const VALID_THEMES = new Set<ThemeKey>([
  "snow",
  "midnight",
  "petal",
  "slate",
  "citrus",
  "custom",
]);

function normalizeHue(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(0, Math.min(360, Math.round(value)));
}

function normalizePreference(raw: ThemePreference): ThemePreference {
  let theme = raw.theme;
  if (theme === "slate") {
    theme = "midnight";
  }
  const customHue = normalizeHue(raw.customHue);
  return {
    theme,
    customHue: theme === "custom" ? customHue : undefined,
  };
}

export function getThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(KEY);
    if (!stored) return { theme: "snow" };
    const parsed = JSON.parse(stored) as ThemePreference;
    if (parsed.theme && VALID_THEMES.has(parsed.theme)) {
      return normalizePreference(parsed);
    }
  } catch {
    // ignore corrupt storage
  }
  return { theme: "snow" };
}

export function saveThemePreference(pref: ThemePreference): void {
  localStorage.setItem(KEY, JSON.stringify(normalizePreference(pref)));
}

export function applyThemePreference(pref: ThemePreference): void {
  try {
    const normalized = normalizePreference(pref);
    const tokens = resolveThemeTokens(normalized.theme, normalized.customHue);
    Object.entries(tokens).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
  } catch (e) {
    console.error("Failed to apply theme:", e);
  }
}
