const SESSION_KEY = "passandpic_session";

export interface StoredSession {
  sessionId: string;
  partyCode: string;
  participantId: string;
  wsToken: string;
  isHost: boolean;
  displayName: string;
}

export function saveSession(data: StoredSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

export function getStoredSession(): StoredSession | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}
