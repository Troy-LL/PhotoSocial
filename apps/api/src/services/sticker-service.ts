import type { Sticker, StickerScope } from "@passandpic/shared";
import { v4 as uuid } from "uuid";
import * as store from "../store/session-store.js";

export function placeSticker(input: {
  sessionId: string;
  participantId: string;
  isHost: boolean;
  stickerKey: string;
  packId: string;
  targetScope: StickerScope;
  targetId: string;
  x: number;
  y: number;
}) {
  const session = store.getSession(input.sessionId);
  if (!session) return { error: "SESSION_NOT_FOUND" as const };
  if (session.status === "locked") return { error: "SESSION_LOCKED" as const };

  const sticker: Sticker = {
    id: uuid(),
    packId: input.packId,
    stickerKey: input.stickerKey,
    x: input.x,
    y: input.y,
    scale: 1,
    rotation: 0,
    scope: input.targetScope,
    placedBy: input.participantId,
    targetId: input.targetId,
  };

  if (input.targetScope === "global") {
    if (!input.isHost) return { error: "FORBIDDEN" as const };
    store.addGlobalSticker(input.sessionId, sticker);
  } else {
    const participant = store.getParticipant(input.sessionId, input.targetId);
    if (!participant) return { error: "PARTICIPANT_NOT_FOUND" as const };
    if (
      participant.id !== input.participantId &&
      !input.isHost
    ) {
      return { error: "FORBIDDEN" as const };
    }
    participant.stickers.push(sticker);
    store.updateParticipant(participant);
  }

  store.touchSession(input.sessionId);
  return { sticker };
}

export function updateSticker(
  sessionId: string,
  stickerId: string,
  updates: Partial<Pick<Sticker, "x" | "y" | "scale" | "rotation">>,
  requesterId: string,
  isHost: boolean
) {
  const session = store.getSession(sessionId);
  if (!session) return { error: "SESSION_NOT_FOUND" as const };

  const global = session.globalStickers.find((s) => s.id === stickerId);
  if (global) {
    if (!isHost && global.placedBy !== requesterId) {
      return { error: "FORBIDDEN" as const };
    }
    const updated = store.updateGlobalSticker(sessionId, stickerId, updates);
    return updated ? { sticker: updated } : { error: "NOT_FOUND" as const };
  }

  for (const p of store.getParticipants(sessionId)) {
    const idx = p.stickers.findIndex((s) => s.id === stickerId);
    if (idx >= 0) {
      if (!isHost && p.id !== requesterId) {
        return { error: "FORBIDDEN" as const };
      }
      p.stickers[idx] = { ...p.stickers[idx], ...updates };
      store.updateParticipant(p);
      store.touchSession(sessionId);
      return { sticker: p.stickers[idx] };
    }
  }

  return { error: "NOT_FOUND" as const };
}

export function deleteSticker(
  sessionId: string,
  stickerId: string,
  requesterId: string,
  isHost: boolean
) {
  const session = store.getSession(sessionId);
  if (!session) return { error: "SESSION_NOT_FOUND" as const };

  const global = session.globalStickers.find((s) => s.id === stickerId);
  if (global) {
    if (!isHost && global.placedBy !== requesterId) {
      return { error: "FORBIDDEN" as const };
    }
    store.removeGlobalSticker(sessionId, stickerId);
    store.touchSession(sessionId);
    return { ok: true };
  }

  for (const p of store.getParticipants(sessionId)) {
    const idx = p.stickers.findIndex((s) => s.id === stickerId);
    if (idx >= 0) {
      if (!isHost && p.id !== requesterId) {
        return { error: "FORBIDDEN" as const };
      }
      p.stickers.splice(idx, 1);
      store.updateParticipant(p);
      store.touchSession(sessionId);
      return { ok: true };
    }
  }

  return { error: "NOT_FOUND" as const };
}
