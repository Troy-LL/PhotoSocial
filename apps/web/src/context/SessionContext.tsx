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
import { resolveThemeTokens } from "@photosocial/shared";
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
  assignedSlot: number | null;
  sessionError: string | null;
  refresh: () => Promise<void>;
  setStored: (s: StoredSession) => void;
  applyTheme: (theme: ThemeKey, customHue?: number) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

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
  const [assignedSlot, setAssignedSlot] = useState<number | null>(null);
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
        const me = res.data.participants.find((p) => p.id === s.participantId);
        setAssignedSlot(me?.assignedSlot ?? null);
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
        "Could not reach the party server. Start the API (pnpm dev from project root) and refresh."
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
    connectWs(s.wsToken);
    void refresh();
  }, [stored?.wsToken, stored?.sessionId, partyCode, refresh]);

  useEffect(() => {
    const s = stored ?? getStoredSession();
    if (!s) return;

    return onWsEvent((envelope: WsEnvelope) => {
      if (envelope.sessionId !== s.sessionId) return;

      switch (envelope.type) {
        case "SLOT_ASSIGNED": {
          const p = envelope.payload as {
            participantId: string;
            slotIndex: number;
          };
          if (p.participantId === s.participantId) {
            setAssignedSlot(p.slotIndex);
          }
          void refresh();
          break;
        }
        case "PARTICIPANT_JOINED":
        case "PHOTO_SUBMITTED":
        case "PHOTO_CLEARED":
        case "STICKER_PLACED":
        case "STICKER_UPDATED":
        case "STICKER_DELETED":
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
      assignedSlot,
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
      assignedSlot,
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
