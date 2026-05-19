import {
  createLayout,
  generatePartyCode,
  type LayoutPreset,
  type Session,
  type SessionState,
  type ThemeKey,
} from "@photosocial/shared";
import { v4 as uuid } from "uuid";
import { config } from "../config.js";
import { signWsToken } from "../lib/jwt.js";
import * as store from "../store/session-store.js";
import { ensureSessionDir } from "../store/session-store.js";

function newExpiry(): string {
  return new Date(Date.now() + config.sessionMaxAgeMs).toISOString();
}

export async function createSession(input: {
  hostDeviceId: string;
  hostName: string;
  layout: LayoutPreset;
  theme: ThemeKey;
  customHue?: number;
}) {
  let partyCode = generatePartyCode();
  let attempts = 0;
  while (store.isPartyCodeTaken(partyCode) && attempts < 5) {
    partyCode = generatePartyCode();
    attempts++;
  }
  if (store.isPartyCodeTaken(partyCode)) {
    throw new Error("PARTY_CODE_COLLISION");
  }

  const sessionId = uuid();
  const hostId = uuid();
  const now = new Date().toISOString();

  const session: Session = {
    id: sessionId,
    partyCode,
    hostId,
    hostDeviceId: input.hostDeviceId,
    hostName: input.hostName,
    theme: input.theme,
    customHue: input.customHue,
    layout: createLayout(input.layout),
    createdAt: now,
    expiresAt: newExpiry(),
    lastActivityAt: now,
    status: "lobby",
    globalStickers: [],
  };

  await ensureSessionDir(sessionId);
  store.setSession(session);

  const hostParticipant = {
    id: hostId,
    sessionId,
    displayName: input.hostName,
    deviceId: input.hostDeviceId,
    assignedSlot: null,
    photoUrl: null,
    thumbnailUrl: null,
    stickers: [],
    joinedAt: now,
  };
  store.addParticipant(hostParticipant);

  const wsToken = signWsToken({
    sessionId,
    participantId: hostId,
    deviceId: input.hostDeviceId,
    isHost: true,
  });

  return {
    sessionId,
    partyCode,
    wsToken,
    expiresAt: session.expiresAt,
    participantId: hostId,
  };
}

export function joinSession(input: {
  partyCode: string;
  displayName: string;
  deviceId: string;
}) {
  const session = store.getSessionByPartyCode(input.partyCode.toUpperCase());
  if (!session) {
    return { error: "SESSION_NOT_FOUND" as const };
  }
  if (session.status === "expired") {
    return { error: "SESSION_NOT_FOUND" as const };
  }
  if (session.status === "locked") {
    return { error: "SESSION_LOCKED" as const };
  }

  const parts = store.getParticipants(session.id);
  const existing = parts.find((p) => p.deviceId === input.deviceId);
  if (existing) {
    const wsToken = signWsToken({
      sessionId: session.id,
      participantId: existing.id,
      deviceId: input.deviceId,
      isHost: existing.id === session.hostId,
    });
    store.touchSession(session.id);
    return {
      sessionId: session.id,
      participantId: existing.id,
      wsToken,
      sessionMeta: buildMeta(session, parts.length),
      rejoined: true,
    };
  }

  if (parts.length >= config.maxParticipants) {
    return { error: "SESSION_FULL" as const };
  }

  const nameTaken = parts.some(
    (p) =>
      p.displayName.toLowerCase() === input.displayName.toLowerCase() &&
      p.deviceId !== input.deviceId
  );
  if (nameTaken) {
    return { error: "NAME_TAKEN" as const };
  }

  const participantId = uuid();
  const now = new Date().toISOString();
  store.addParticipant({
    id: participantId,
    sessionId: session.id,
    displayName: input.displayName,
    deviceId: input.deviceId,
    assignedSlot: null,
    photoUrl: null,
    thumbnailUrl: null,
    stickers: [],
    joinedAt: now,
  });

  if (session.status === "lobby" && parts.length >= 1) {
    session.status = "active";
    store.setSession(session);
  }
  store.touchSession(session.id);

  const wsToken = signWsToken({
    sessionId: session.id,
    participantId,
    deviceId: input.deviceId,
    isHost: false,
  });

  return {
    sessionId: session.id,
    participantId,
    wsToken,
    sessionMeta: buildMeta(session, parts.length + 1),
    rejoined: false,
  };
}

function buildMeta(session: Session, participantCount: number) {
  return {
    theme: session.theme,
    customHue: session.customHue,
    layout: session.layout,
    hostName: session.hostName,
    participantCount,
    status: session.status,
  };
}

export function getSessionState(sessionId: string): SessionState | null {
  return store.getSessionState(sessionId);
}

export function assignSlot(
  sessionId: string,
  participantId: string,
  slotIndex: number,
  isHost: boolean
) {
  if (!isHost) return { error: "FORBIDDEN" as const };
  const session = store.getSession(sessionId);
  if (!session) return { error: "SESSION_NOT_FOUND" as const };
  if (session.status === "locked") return { error: "SESSION_LOCKED" as const };

  const slot = session.layout.slots.find((s) => s.index === slotIndex);
  if (!slot) return { error: "INVALID_SLOT" as const };
  if (slot.locked) return { error: "SLOT_LOCKED" as const };

  const participant = store.getParticipant(sessionId, participantId);
  if (!participant) return { error: "PARTICIPANT_NOT_FOUND" as const };

  session.layout.slots.forEach((s) => {
    if (s.assignedTo === participantId) {
      s.assignedTo = null;
    }
    if (s.index === slotIndex) {
      if (s.assignedTo && s.assignedTo !== participantId) {
        const prev = store.getParticipant(sessionId, s.assignedTo);
        if (prev) {
          prev.assignedSlot = null;
          store.updateParticipant(prev);
        }
      }
      s.assignedTo = participantId;
    }
  });

  participant.assignedSlot = slotIndex;
  store.updateParticipant(participant);
  store.setSession(session);
  store.touchSession(sessionId);

  return {
    slotIndex,
    participantId,
    displayName: participant.displayName,
  };
}

export function unlockSlot(sessionId: string, slotIndex: number, isHost: boolean) {
  if (!isHost) return { error: "FORBIDDEN" as const };
  const session = store.getSession(sessionId);
  if (!session) return { error: "SESSION_NOT_FOUND" as const };
  const slot = session.layout.slots.find((s) => s.index === slotIndex);
  if (!slot) return { error: "INVALID_SLOT" as const };
  slot.locked = false;
  store.setSession(session);
  return { ok: true };
}

export function clearSlotPhoto(
  sessionId: string,
  slotIndex: number,
  requesterParticipantId: string,
  isHost: boolean
) {
  const session = store.getSession(sessionId);
  if (!session) return { error: "SESSION_NOT_FOUND" as const };
  if (session.status === "locked") return { error: "SESSION_LOCKED" as const };

  const slot = session.layout.slots.find((s) => s.index === slotIndex);
  if (!slot) return { error: "INVALID_SLOT" as const };
  if (!slot.assignedTo) return { error: "NO_ASSIGNEE" as const };

  const assignee = store.getParticipant(sessionId, slot.assignedTo);
  if (!assignee) return { error: "PARTICIPANT_NOT_FOUND" as const };

  const isAssignee = assignee.id === requesterParticipantId;
  if (!isHost && !isAssignee) return { error: "FORBIDDEN" as const };
  if (!assignee.photoUrl) return { error: "NO_PHOTO" as const };

  assignee.photoUrl = null;
  assignee.thumbnailUrl = null;
  slot.locked = false;
  store.updateParticipant(assignee);
  store.setSession(session);
  store.touchSession(sessionId);

  return {
    slotIndex,
    participantId: assignee.id,
  };
}

export function lockSession(sessionId: string, isHost: boolean) {
  if (!isHost) return { error: "FORBIDDEN" as const };
  const session = store.getSession(sessionId);
  if (!session) return { error: "SESSION_NOT_FOUND" as const };
  session.status = "locked";
  store.setSession(session);
  store.touchSession(sessionId);
  return { session };
}

export function setTheme(
  sessionId: string,
  theme: ThemeKey,
  customHue: number | undefined,
  isHost: boolean
) {
  if (!isHost) return { error: "FORBIDDEN" as const };
  const session = store.getSession(sessionId);
  if (!session) return { error: "SESSION_NOT_FOUND" as const };
  session.theme = theme;
  session.customHue = customHue;
  store.setSession(session);
  store.touchSession(sessionId);
  return { theme, customHue };
}

export function expireSession(sessionId: string): void {
  const session = store.getSession(sessionId);
  if (!session) return;
  session.status = "expired";
  store.setSession(session);
  void store.deleteSessionData(sessionId);
}

export function runExpiryScheduler(
  onExpired: (sessionId: string) => void
): void {
  setInterval(() => {
    const now = Date.now();
    for (const session of store.getAllSessions()) {
      const expires = new Date(session.expiresAt).getTime();
      const idle = new Date(session.lastActivityAt).getTime() + config.sessionIdleMs;
      if (now > expires || now > idle) {
        expireSession(session.id);
        onExpired(session.id);
        setTimeout(() => {
          store.deleteSession(session.id);
        }, 60_000);
      }
    }
  }, 60_000);
}
