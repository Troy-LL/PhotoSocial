const SESSION_KEY = "PhotoSocial_session";
const PHOTO_CACHE_KEY = "PhotoSocial_photo_cache";

export interface CachedSlotPhoto {
  photoUrl: string | null;
  thumbnailUrl: string | null;
}

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
  localStorage.removeItem(PHOTO_CACHE_KEY);
}

export function cacheSessionPhotos(
  sessionId: string,
  photos: Record<number, CachedSlotPhoto>
): void {
  try {
    localStorage.setItem(
      PHOTO_CACHE_KEY,
      JSON.stringify({ sessionId, photos, updatedAt: Date.now() })
    );
  } catch {
    /* quota exceeded — export may rely on server */
  }
}

export function getCachedSessionPhotos(
  sessionId: string
): Record<number, CachedSlotPhoto> | null {
  const raw = localStorage.getItem(PHOTO_CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      sessionId: string;
      photos: Record<number, CachedSlotPhoto>;
    };
    if (parsed.sessionId !== sessionId) return null;
    return parsed.photos ?? null;
  } catch {
    return null;
  }
}
