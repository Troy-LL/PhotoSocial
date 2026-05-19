import {
  createLayout,
  type LayoutPreset,
  type SessionState,
  type ThemeKey,
} from "@photosocial/shared";

const STORAGE_KEY = "photosocial-solo";

export interface SoloSessionPrefs {
  layout: LayoutPreset;
  theme: ThemeKey;
  customHue?: number;
}

export interface SoloSessionData extends SoloSessionPrefs {
  /** Object URLs for each filled slot index (in-memory only) */
  photos: Record<number, string>;
}

export function loadSoloPrefs(): SoloSessionPrefs | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SoloSessionPrefs;
  } catch {
    return null;
  }
}

export function saveSoloPrefs(prefs: SoloSessionPrefs): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function clearSoloPrefs(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function revokeSoloPhotos(photos: Record<number, string>): void {
  for (const url of Object.values(photos)) {
    if (url.startsWith("blob:")) URL.revokeObjectURL(url);
  }
}

export function buildSoloSessionState(data: SoloSessionData): SessionState {
  const layout = createLayout(data.layout);
  const slots = layout.slots.map((slotDef) => ({
    index: slotDef.index,
    participantId: null,
    displayName: null,
    photoUrl: data.photos[slotDef.index] ?? null,
    thumbnailUrl: null,
    stickers: [],
  }));

  const now = new Date().toISOString();

  return {
    session: {
      id: "solo",
      partyCode: "SOLO",
      hostId: "solo",
      hostDeviceId: "solo",
      hostName: "Solo",
      theme: data.theme,
      customHue: data.customHue,
      layout,
      createdAt: now,
      expiresAt: now,
      lastActivityAt: now,
      status: "locked",
      globalStickers: [],
    },
    participants: [],
    collage: {
      slots,
      globalStickers: [],
    },
  };
}
