import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  participantPhotoProgress,
  resolveThemeTokens,
  slotHasPhoto,
  slotsForParticipant,
  type SessionState,
  type ThemeKey,
  type WsEnvelope,
} from "@photosocial/shared";
import { api } from "../lib/api";
import {
  cachePhotosFromState,
  mergeCachedPhotosIntoState,
} from "../lib/collage-photo-cache";
import {
  clearSession,
  getStoredSession,
  saveSession,
  type StoredSession,
} from "../lib/session-storage";
import { connectWs, disconnectWs, onWsEvent, onReconnecting } from "../lib/ws-client";

interface SessionContextValue {
  stored: StoredSession | null;
  state: SessionState | null;
  loading: boolean;
  reconnecting: boolean;
  /** From server: session.hostId === your participantId */
  isHost: boolean;
  /** Slot indices assigned to the current participant */
  assignedSlots: number[];
  sessionError: string | null;
  refresh: () => Promise<void>;
  setStored: (s: StoredSession) => void;
  applyTheme: (theme: ThemeKey, customHue?: number) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function deriveAssignedSlots(
  data: SessionState | null,
  participantId: string | undefined
): number[] {
  if (!data || !participantId) return [];
  return slotsForParticipant(data.session.layout, participantId);
}

function applySlotPhotoUpdate(
  state: SessionState,
  slotIndex: number,
  photoUrl: string | null,
  thumbnailUrl: string | null
): SessionState {
  const patch = <T extends { index: number; photoUrl: string | null; thumbnailUrl: string | null }>(
    slots: T[]
  ) =>
    slots.map((slot) =>
      slot.index === slotIndex
        ? { ...slot, photoUrl, thumbnailUrl }
        : slot
    );

  return {
    ...state,
    session: {
      ...state.session,
      layout: {
        ...state.session.layout,
        slots: patch(state.session.layout.slots),
      },
    },
    collage: {
      ...state.collage,
      slots: patch(state.collage.slots),
    },
  };
}

function mergeSessionPhotos(
  prev: SessionState | null,
  incoming: SessionState,
  sessionId: string
): SessionState {
  const withPrev = prev ? mergeSessionPhotosFromPrev(prev, incoming) : incoming;
  return mergeCachedPhotosIntoState(sessionId, withPrev);
}

function mergeSessionPhotosFromPrev(
  prev: SessionState,
  incoming: SessionState
): SessionState {
  let merged = incoming;
  for (const slot of incoming.collage.slots) {
    if (slotHasPhoto(slot)) continue;
    const prevSlot = prev.collage.slots.find((s) => s.index === slot.index);
    if (!prevSlot || !slotHasPhoto(prevSlot)) continue;
    merged = applySlotPhotoUpdate(
      merged,
      slot.index,
      prevSlot.photoUrl,
      prevSlot.thumbnailUrl
    );
  }
  return merged;
}

function persistPhotoCache(sessionId: string, state: SessionState): void {
  cachePhotosFromState(sessionId, state);
}

export function SessionProvider({
  children,
  partyCode,
}: {
  children: ReactNode;
  partyCode: string;
}) {
  const [stored, setStoredState] = useState<StoredSession | null>(() =>
    getStoredSession()
  );
  const [state, setState] = useState<SessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
  const [assignedSlots, setAssignedSlots] = useState<number[]>([]);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const setStored = useCallback((s: StoredSession) => {
    saveSession(s);
    setStoredState(s);
  }, []);

  const refresh = useCallback(async () => {
    const s = stored ?? getStoredSession();
    if (!s) {
      setLoading(false);
      return;
    }
    if (s.partyCode !== partyCode.toUpperCase()) {
      setSessionError("Party code does not match your saved session.");
      setLoading(false);
      return;
    }

    try {
      const res = await api.getSessionState(s.sessionId, s.wsToken);
      if (res.success) {
        setState((prev) => {
          const merged = mergeSessionPhotos(prev, res.data, s.sessionId);
          persistPhotoCache(s.sessionId, merged);
          return merged;
        });
        setSessionError(null);
        setAssignedSlots(deriveAssignedSlots(res.data, s.participantId));
        const serverIsHost = res.data.session.hostId === s.participantId;
        if (serverIsHost !== s.isHost) {
          const updated = { ...s, isHost: serverIsHost };
          saveSession(updated);
          setStoredState(updated);
        }
      } else {
        const code = res.error.code;
        if (code === "SESSION_NOT_FOUND" || code === "UNAUTHORIZED") {
          clearSession();
          setSessionError("This party is no longer available. Please join again.");
        } else {
          setSessionError(res.error.message);
        }
      }
    } catch {
      setSessionError(
        "Could not reach the party server. Start PartyKit (pnpm dev) and refresh."
      );
    } finally {
      setLoading(false);
    }
  }, [stored, partyCode]);

  useEffect(() => {
    const s = stored ?? getStoredSession();
    if (!s || s.partyCode !== partyCode.toUpperCase()) {
      setLoading(false);
      return;
    }
    connectWs(s.sessionId, s.wsToken);
    void refresh();
  }, [stored?.wsToken, stored?.sessionId, partyCode, refresh]);

  useEffect(() => {
    const s = stored ?? getStoredSession();
    if (!s) return;

    return onWsEvent((envelope: WsEnvelope) => {
      if (envelope.sessionId !== s.sessionId) return;

      switch (envelope.type) {
        case "PHOTO_SUBMITTED": {
          const payload = envelope.payload as {
            slotIndex: number;
            photoUrl: string;
            thumbnailUrl: string;
          };
          setState((prev) => {
            if (!prev) return prev;
            const next = applySlotPhotoUpdate(
              prev,
              payload.slotIndex,
              payload.photoUrl,
              payload.thumbnailUrl
            );
            persistPhotoCache(s.sessionId, next);
            return next;
          });
          break;
        }
        case "PHOTO_CLEARED": {
          const payload = envelope.payload as { slotIndex: number };
          setState((prev) => {
            if (!prev) return prev;
            return applySlotPhotoUpdate(prev, payload.slotIndex, null, null);
          });
          void refresh();
          break;
        }
        case "SESSION_LOCKED":
          setState((prev) => {
            if (prev) persistPhotoCache(s.sessionId, prev);
            return prev;
          });
          void refresh();
          break;
        case "SLOT_ASSIGNED":
        case "PARTICIPANT_JOINED":
        case "THEME_CHANGED":
        case "SESSION_EXPIRED":
          void refresh();
          break;
        default:
          break;
      }
    });
  }, [stored, refresh]);

  useEffect(() => onReconnecting(setReconnecting), []);

  useEffect(() => {
    return () => disconnectWs();
  }, []);

  const applyTheme = useCallback(
    (theme: ThemeKey, customHue?: number) => {
      const tokens = resolveThemeTokens(theme, customHue);
      Object.entries(tokens).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value);
      });
    },
    []
  );

  useEffect(() => {
    if (state?.session) {
      applyTheme(state.session.theme, state.session.customHue);
    }
  }, [state?.session.theme, state?.session.customHue, applyTheme]);

  const isHost = Boolean(
    state && stored && state.session.hostId === stored.participantId
  );

  const value = useMemo(
    () => ({
      stored,
      state,
      loading,
      reconnecting,
      isHost,
      assignedSlots,
      sessionError,
      refresh,
      setStored,
      applyTheme,
    }),
    [
      stored,
      state,
      loading,
      reconnecting,
      isHost,
      assignedSlots,
      sessionError,
      refresh,
      setStored,
      applyTheme,
    ]
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession requires SessionProvider");
  return ctx;
}

export function useMyPhotoProgress(state: SessionState | null, participantId: string | undefined) {
  if (!state || !participantId) {
    return { filled: 0, total: 0, allFilled: false, hasAnySlot: false };
  }
  const { filled, total } = participantPhotoProgress(
    state.session.layout,
    state.collage.slots,
    participantId
  );
  return {
    filled,
    total,
    allFilled: total > 0 && filled >= total,
    hasAnySlot: total > 0,
  };
}
