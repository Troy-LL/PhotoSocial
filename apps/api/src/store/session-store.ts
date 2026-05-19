import type {
  Participant,
  Session,
  SessionState,
  SlotState,
  Sticker,
} from "@photosocial/shared";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../config.js";

const sessions = new Map<string, Session>();
const participants = new Map<string, Map<string, Participant>>();
const partyCodeIndex = new Map<string, string>();

export function getSessionDir(sessionId: string): string {
  return join(config.dataDir, sessionId);
}

export async function ensureSessionDir(sessionId: string): Promise<void> {
  await mkdir(getSessionDir(sessionId), { recursive: true });
}

export async function deleteSessionData(sessionId: string): Promise<void> {
  try {
    await rm(getSessionDir(sessionId), { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

export function setSession(session: Session): void {
  sessions.set(session.id, session);
  partyCodeIndex.set(session.partyCode, session.id);
}

export function getSession(sessionId: string): Session | undefined {
  return sessions.get(sessionId);
}

export function getSessionByPartyCode(code: string): Session | undefined {
  const id = partyCodeIndex.get(code.toUpperCase());
  return id ? sessions.get(id) : undefined;
}

export function deleteSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    partyCodeIndex.delete(session.partyCode);
  }
  sessions.delete(sessionId);
  participants.delete(sessionId);
}

export function getParticipants(sessionId: string): Participant[] {
  const map = participants.get(sessionId);
  return map ? Array.from(map.values()) : [];
}

export function getParticipant(
  sessionId: string,
  participantId: string
): Participant | undefined {
  return participants.get(sessionId)?.get(participantId);
}

export function addParticipant(p: Participant): void {
  if (!participants.has(p.sessionId)) {
    participants.set(p.sessionId, new Map());
  }
  participants.get(p.sessionId)!.set(p.id, p);
}

export function updateParticipant(p: Participant): void {
  participants.get(p.sessionId)?.set(p.id, p);
}

export function touchSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.lastActivityAt = new Date().toISOString();
    sessions.set(sessionId, session);
  }
}

export function buildSlotStates(sessionId: string): SlotState[] {
  const session = sessions.get(sessionId);
  if (!session) return [];

  const parts = getParticipants(sessionId);
  return session.layout.slots.map((slot) => {
    const assigned = slot.assignedTo
      ? parts.find((p) => p.id === slot.assignedTo)
      : null;
    return {
      index: slot.index,
      participantId: slot.assignedTo,
      displayName: assigned?.displayName ?? null,
      photoUrl: assigned?.photoUrl ?? null,
      thumbnailUrl: assigned?.thumbnailUrl ?? null,
      stickers: assigned?.stickers ?? [],
    };
  });
}

export function getSessionState(sessionId: string): SessionState | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  return {
    session,
    participants: getParticipants(sessionId),
    collage: {
      slots: buildSlotStates(sessionId),
      globalStickers: session.globalStickers,
    },
  };
}

export function addGlobalSticker(sessionId: string, sticker: Sticker): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.globalStickers.push(sticker);
    sessions.set(sessionId, session);
  }
}

export function updateGlobalSticker(
  sessionId: string,
  stickerId: string,
  updates: Partial<Sticker>
): Sticker | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  const idx = session.globalStickers.findIndex((s) => s.id === stickerId);
  if (idx < 0) return null;
  session.globalStickers[idx] = { ...session.globalStickers[idx], ...updates };
  sessions.set(sessionId, session);
  return session.globalStickers[idx];
}

export function removeGlobalSticker(
  sessionId: string,
  stickerId: string
): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;
  const before = session.globalStickers.length;
  session.globalStickers = session.globalStickers.filter(
    (s) => s.id !== stickerId
  );
  sessions.set(sessionId, session);
  return session.globalStickers.length < before;
}

export function isPartyCodeTaken(code: string): boolean {
  return partyCodeIndex.has(code);
}

export function getAllSessions(): Session[] {
  return Array.from(sessions.values());
}
