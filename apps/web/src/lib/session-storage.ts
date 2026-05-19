const SESSION_KEY = "PhotoSocial_session";

export interface StoredSession {
  sessionId: string;
  partyCode: string;
  participantId: string;
  wsToken: string;
  /** Per-party device id (not shared across parties — avoids rejoining as host when testing join on same browser) */
  deviceId: string;
  isHost: boolean;
  displayName: string;
}

export function newPartyDeviceId(): string {
  return crypto.randomUUID();
}

export function saveSession(data: StoredSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

export function getStoredSession(): StoredSession | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed.deviceId) {
      parsed.deviceId = newPartyDeviceId();
      saveSession(parsed);
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}
