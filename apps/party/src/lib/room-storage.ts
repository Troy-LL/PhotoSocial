import type * as Party from "partykit/server";
import { normalizeRoomState, type RoomState } from "./session-state.js";

const STATE_KEY = "state";
/** Cloudflare DO / PartyKit storage value limit is 128 KiB per key */
const MAX_PHOTO_BYTES = 120_000;

function photoKey(slotIndex: number): string {
  return `photo:${slotIndex}`;
}

export async function loadRoomState(room: Party.Room): Promise<RoomState | null> {
  const state = await room.storage.get<RoomState>(STATE_KEY);
  if (!state) return null;

  const normalized = normalizeRoomState(state);

  for (const slot of normalized.session.layout.slots) {
    const stored = await room.storage.get<{
      photoUrl: string;
      thumbnailUrl: string;
    }>(photoKey(slot.index));
    if (stored) {
      slot.photoUrl = stored.photoUrl;
      slot.thumbnailUrl = stored.thumbnailUrl;
    }
  }

  return normalized;
}

export async function saveRoomState(room: Party.Room, state: RoomState): Promise<void> {
  const snapshot = structuredClone(state);

  for (const slot of snapshot.session.layout.slots) {
    if (slot.photoUrl || slot.thumbnailUrl) {
      const payload = {
        photoUrl: slot.photoUrl ?? "",
        thumbnailUrl: slot.thumbnailUrl ?? "",
      };
      const bytes = new TextEncoder().encode(JSON.stringify(payload)).length;
      if (bytes > MAX_PHOTO_BYTES) {
        throw new Error("PHOTO_TOO_LARGE");
      }
      await room.storage.put(photoKey(slot.index), payload);
    } else {
      await room.storage.delete(photoKey(slot.index));
    }
    slot.photoUrl = null;
    slot.thumbnailUrl = null;
  }

  await room.storage.put(STATE_KEY, snapshot);
}

export async function deleteSlotPhoto(room: Party.Room, slotIndex: number): Promise<void> {
  await room.storage.delete(photoKey(slotIndex));
}

export async function clearAllSlotPhotos(
  room: Party.Room,
  state: RoomState
): Promise<void> {
  for (const slot of state.session.layout.slots) {
    await room.storage.delete(photoKey(slot.index));
    slot.photoUrl = null;
    slot.thumbnailUrl = null;
  }
}
