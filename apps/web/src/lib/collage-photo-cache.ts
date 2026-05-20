import { slotHasPhoto, type SessionState } from "@photosocial/shared";
import {
  cacheSessionPhotos,
  getCachedSessionPhotos,
  type CachedSlotPhoto,
} from "./session-storage";

export function photosFromState(
  state: SessionState
): Record<number, CachedSlotPhoto> {
  const photos: Record<number, CachedSlotPhoto> = {};
  for (const slot of state.collage.slots) {
    if (slotHasPhoto(slot)) {
      photos[slot.index] = {
        photoUrl: slot.photoUrl,
        thumbnailUrl: slot.thumbnailUrl,
      };
    }
  }
  return photos;
}

export function cachePhotosFromState(
  sessionId: string,
  state: SessionState
): void {
  cacheSessionPhotos(sessionId, photosFromState(state));
}

export function cacheSlotPhoto(
  sessionId: string,
  slotIndex: number,
  photoUrl: string,
  thumbnailUrl: string
): void {
  const existing = getCachedSessionPhotos(sessionId) ?? {};
  cacheSessionPhotos(sessionId, {
    ...existing,
    [slotIndex]: { photoUrl, thumbnailUrl },
  });
}

export function mergeCachedPhotosIntoState(
  sessionId: string,
  state: SessionState
): SessionState {
  const cached = getCachedSessionPhotos(sessionId);
  if (!cached) return state;

  let merged = state;
  for (const [indexStr, photo] of Object.entries(cached)) {
    const slotIndex = Number(indexStr);
    const slot = merged.collage.slots.find((s) => s.index === slotIndex);
    if (slot && slotHasPhoto(slot)) continue;
    if (!photo.photoUrl && !photo.thumbnailUrl) continue;

    const patch = <
      T extends {
        index: number;
        photoUrl: string | null;
        thumbnailUrl: string | null;
      },
    >(
      slots: T[]
    ) =>
      slots.map((s) =>
        s.index === slotIndex
          ? { ...s, photoUrl: photo.photoUrl, thumbnailUrl: photo.thumbnailUrl }
          : s
      );

    merged = {
      ...merged,
      session: {
        ...merged.session,
        layout: {
          ...merged.session.layout,
          slots: patch(merged.session.layout.slots),
        },
      },
      collage: {
        ...merged.collage,
        slots: patch(merged.collage.slots),
      },
    };
  }
  return merged;
}
