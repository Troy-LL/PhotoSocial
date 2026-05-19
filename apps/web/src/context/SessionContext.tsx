import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SessionState, ThemeKey, WsEnvelope } from "@photosocial/shared";
import {
  participantPhotoProgress,
  resolveThemeTokens,
  slotsForParticipant,
} from "@photosocial/shared";
import { api } from "../lib/api";
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
        setState(res.data);
        setSessionError(null);
        setAssignedSlots(deriveAssignedSlots(res.data, s.participantId));
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
        case "SLOT_ASSIGNED":
        case "PARTICIPANT_JOINED":
        case "PHOTO_SUBMITTED":
        case "PHOTO_CLEARED":
        case "THEME_CHANGED":
        case "SESSION_LOCKED":
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

  const value = useMemo(
    () => ({
      stored,
      state,
      loading,
      reconnecting,
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
