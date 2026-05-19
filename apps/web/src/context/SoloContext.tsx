import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createLayout, type LayoutPreset, type ThemeKey } from "@photosocial/shared";
import {
  DEFAULT_SLOT_PHOTO_FIT,
  type SlotPhotoFit,
} from "../features/camera/slot-photo-fit";
import {
  buildSoloSessionState,
  clearSoloPrefs,
  loadSoloPrefs,
  revokeSoloPhotos,
  saveSoloPrefs,
  type SoloSessionData,
} from "../lib/solo-session";
import {
  applyThemePreference,
  type ThemePreference,
} from "../lib/theme-preference";

interface SoloContextValue {
  data: SoloSessionData | null;
  slotCount: number;
  sessionState: ReturnType<typeof buildSoloSessionState> | null;
  startSession: (layout: LayoutPreset, theme: ThemeKey, customHue?: number) => void;
  setPhoto: (slotIndex: number, blob: Blob) => void;
  setPhotoFit: (slotIndex: number, fit: SlotPhotoFit) => void;
  clearPhoto: (slotIndex: number) => void;
  reset: () => void;
}

const SoloContext = createContext<SoloContextValue | null>(null);

function reviveFromStorage(): SoloSessionData | null {
  const prefs = loadSoloPrefs();
  if (!prefs?.layout) return null;
  return { ...prefs, photos: {}, photoFits: {} };
}

export function SoloProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SoloSessionData | null>(reviveFromStorage);

  const slotCount = useMemo(() => {
    if (!data?.layout) return 0;
    return createLayout(data.layout).slots.length;
  }, [data?.layout]);

  const sessionState = useMemo(
    () => (data ? buildSoloSessionState(data) : null),
    [data]
  );

  const applyTheme = useCallback((pref: ThemePreference) => {
    applyThemePreference(pref);
  }, []);

  const startSession = useCallback(
    (layout: LayoutPreset, theme: ThemeKey, customHue?: number) => {
      const next: SoloSessionData = {
        layout,
        theme,
        customHue,
        photos: {},
        photoFits: {},
      };
      saveSoloPrefs({ layout, theme, customHue });
      setData(next);
      applyTheme({ theme, customHue: theme === "custom" ? customHue : undefined });
    },
    [applyTheme]
  );

  const setPhoto = useCallback(
    (slotIndex: number, blob: Blob) => {
      setData((prev) => {
        if (!prev) return prev;
        const url = URL.createObjectURL(blob);
        const oldUrl = prev.photos[slotIndex];
        if (oldUrl?.startsWith("blob:")) URL.revokeObjectURL(oldUrl);
        return {
          ...prev,
          photos: { ...prev.photos, [slotIndex]: url },
          photoFits: {
            ...prev.photoFits,
            [slotIndex]: prev.photoFits[slotIndex] ?? DEFAULT_SLOT_PHOTO_FIT,
          },
        };
      });
    },
    []
  );

  const setPhotoFit = useCallback((slotIndex: number, fit: SlotPhotoFit) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        photoFits: { ...prev.photoFits, [slotIndex]: fit },
      };
    });
  }, []);

  const clearPhoto = useCallback((slotIndex: number) => {
    setData((prev) => {
      if (!prev) return prev;
      const oldUrl = prev.photos[slotIndex];
      if (oldUrl?.startsWith("blob:")) URL.revokeObjectURL(oldUrl);
      const { [slotIndex]: _removed, ...photos } = prev.photos;
      const { [slotIndex]: _removedFit, ...photoFits } = prev.photoFits;
      return { ...prev, photos, photoFits };
    });
  }, []);

  const reset = useCallback(() => {
    setData((prev) => {
      if (prev?.photos) revokeSoloPhotos(prev.photos);
      return null;
    });
    clearSoloPrefs();
  }, []);

  const value = useMemo(
    () => ({
      data,
      slotCount,
      sessionState,
      startSession,
      setPhoto,
      setPhotoFit,
      clearPhoto,
      reset,
    }),
    [
      data,
      slotCount,
      sessionState,
      startSession,
      setPhoto,
      setPhotoFit,
      clearPhoto,
      reset,
    ]
  );

  return <SoloContext.Provider value={value}>{children}</SoloContext.Provider>;
}

export function useSolo() {
  const ctx = useContext(SoloContext);
  if (!ctx) throw new Error("useSolo must be used within SoloProvider");
  return ctx;
}
