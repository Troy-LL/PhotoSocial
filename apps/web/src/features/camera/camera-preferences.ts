const AUTO_SHOOT_KEY = "photosocial-auto-shoot";

/** Default true: after the first manual shot, later photos auto-chain with countdown */
export function loadAutoShootPreference(): boolean {
  try {
    const stored = sessionStorage.getItem(AUTO_SHOOT_KEY);
    if (stored === "false") return false;
    if (stored === "true") return true;
  } catch {
    /* ignore */
  }
  return true;
}

export function saveAutoShootPreference(enabled: boolean): void {
  try {
    sessionStorage.setItem(AUTO_SHOOT_KEY, enabled ? "true" : "false");
  } catch {
    /* ignore */
  }
}

export function getAutoPauseMs(): number {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return reduced ? 400 : 1800;
}

/** Mobile: full collage preview shown between shots */
export function getCollageFlashMs(): number {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return reduced ? 800 : 2000;
}
