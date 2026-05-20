import type * as Party from "partykit/server";
import { normalizeRoomState, type RoomState } from "./session-state.js";

const STATE_KEY = "state";
/** Cloudflare DO / PartyKit storage value limit is 128 KiB per key */
export const MAX_PHOTO_BYTES = 120_000;

function photoFullKey(slotIndex: number): string {
  return `photo:${slotIndex}:full`;
}

function photoThumbKey(slotIndex: number): string {
  return `photo:${slotIndex}:thumb`;
}

function legacyPhotoKey(slotIndex: number): string {
  return `photo:${slotIndex}`;
}

function exportFullKey(slotIndex: number): string {
  return `export:${slotIndex}:full`;
}

function exportThumbKey(slotIndex: number): string {
  return `export:${slotIndex}:thumb`;
}

async function readPhotoValue(
  room: Party.Room,
  key: string
): Promise<string | null> {
  const value = await room.storage.get<string | { photoUrl?: string; thumbnailUrl?: string }>(
    key
  );
  if (!value) return null;
  if (typeof value === "string") return value || null;
  return null;
}

async function loadSlotPhotos(
  room: Party.Room,
  slotIndex: number
): Promise<{ photoUrl: string | null; thumbnailUrl: string | null }> {
  const lockedFull = await readPhotoValue(room, exportFullKey(slotIndex));
  const lockedThumb = await readPhotoValue(room, exportThumbKey(slotIndex));
  if (lockedFull || lockedThumb) {
    return { photoUrl: lockedFull, thumbnailUrl: lockedThumb };
  }

  const full = await readPhotoValue(room, photoFullKey(slotIndex));
  const thumb = await readPhotoValue(room, photoThumbKey(slotIndex));
  if (full || thumb) {
    return { photoUrl: full, thumbnailUrl: thumb };
  }

  const legacy = await room.storage.get<{
    photoUrl: string;
    thumbnailUrl: string;
  }>(legacyPhotoKey(slotIndex));
  if (!legacy) {
    return { photoUrl: null, thumbnailUrl: null };
  }
  return {
    photoUrl: legacy.photoUrl || null,
    thumbnailUrl: legacy.thumbnailUrl || null,
  };
}

async function writePhotoValue(
  room: Party.Room,
  key: string,
  value: string
): Promise<void> {
  const bytes = new TextEncoder().encode(value).length;
  if (bytes > MAX_PHOTO_BYTES) {
    throw new Error("PHOTO_TOO_LARGE");
  }
  await room.storage.put(key, value);
}

async function saveSlotPhotos(
  room: Party.Room,
  slotIndex: number,
  photoUrl: string | null,
  thumbnailUrl: string | null
): Promise<void> {
  if (photoUrl) {
    await writePhotoValue(room, photoFullKey(slotIndex), photoUrl);
  }
  if (thumbnailUrl) {
    await writePhotoValue(room, photoThumbKey(slotIndex), thumbnailUrl);
  }
}

export async function loadRoomState(room: Party.Room): Promise<RoomState | null> {
  const state = await room.storage.get<RoomState>(STATE_KEY);
  if (!state) return null;

  const normalized = normalizeRoomState(state);

  for (const slot of normalized.session.layout.slots) {
    const stored = await loadSlotPhotos(room, slot.index);
    if (stored.photoUrl) slot.photoUrl = stored.photoUrl;
    if (stored.thumbnailUrl) slot.thumbnailUrl = stored.thumbnailUrl;
  }

  return normalized;
}

export async function saveRoomState(room: Party.Room, state: RoomState): Promise<void> {
  const snapshot = structuredClone(state);

  for (const slot of snapshot.session.layout.slots) {
    if (slot.photoUrl || slot.thumbnailUrl) {
      await saveSlotPhotos(
        room,
        slot.index,
        slot.photoUrl,
        slot.thumbnailUrl
      );
    }
    slot.photoUrl = null;
    slot.thumbnailUrl = null;
  }

  await room.storage.put(STATE_KEY, snapshot);
}

/** Update session metadata without touching stored photos. */
export async function patchSessionStatus(
  room: Party.Room,
  status: RoomState["session"]["status"],
  lastActivityAt: string
): Promise<void> {
  const snapshot = await room.storage.get<RoomState>(STATE_KEY);
  if (!snapshot) return;
  snapshot.session.status = status;
  snapshot.session.lastActivityAt = lastActivityAt;
  await room.storage.put(STATE_KEY, snapshot);
}

/** Freeze slot photos for export when the collage is locked. */
export async function snapshotExportPhotos(
  room: Party.Room,
  state: RoomState
): Promise<void> {
  for (const slot of state.session.layout.slots) {
    const stored = await loadSlotPhotos(room, slot.index);
    const photoUrl = slot.photoUrl ?? stored.photoUrl;
    const thumbnailUrl = slot.thumbnailUrl ?? stored.thumbnailUrl;
    if (photoUrl) {
      await writePhotoValue(room, exportFullKey(slot.index), photoUrl);
    }
    if (thumbnailUrl) {
      await writePhotoValue(room, exportThumbKey(slot.index), thumbnailUrl);
    }
  }
}

export async function deleteSlotPhoto(room: Party.Room, slotIndex: number): Promise<void> {
  await room.storage.delete(photoFullKey(slotIndex));
  await room.storage.delete(photoThumbKey(slotIndex));
  await room.storage.delete(legacyPhotoKey(slotIndex));
  await room.storage.delete(exportFullKey(slotIndex));
  await room.storage.delete(exportThumbKey(slotIndex));
}

export async function clearAllSlotPhotos(
  room: Party.Room,
  state: RoomState
): Promise<void> {
  for (const slot of state.session.layout.slots) {
    await deleteSlotPhoto(room, slot.index);
    slot.photoUrl = null;
    slot.thumbnailUrl = null;
  }
}
