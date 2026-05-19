import {
  createLayout,
  type LayoutPreset,
  type Participant,
  type Session,
  type SessionState,
  type SlotState,
  type ThemeKey,
} from "@photosocial/shared";

const MAX_PARTICIPANTS = 20;
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface RoomState {
  session: Session;
  participants: Participant[];
}

export function newExpiry(): string {
  return new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString();
}

export function buildSlotStates(state: RoomState): SlotState[] {
  const { session, participants } = state;
  return session.layout.slots.map((slot) => {
    const assigned = slot.assignedTo
      ? participants.find((p) => p.id === slot.assignedTo)
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

export function toSessionState(state: RoomState): SessionState {
  return {
    session: state.session,
    participants: state.participants,
    collage: {
      slots: buildSlotStates(state),
      globalStickers: state.session.globalStickers,
    },
  };
}

export function createRoomState(input: {
  sessionId: string;
  partyCode: string;
  hostId: string;
  hostDeviceId: string;
  hostName: string;
  layout: LayoutPreset;
  theme: ThemeKey;
  customHue?: number;
}): RoomState {
  const now = new Date().toISOString();
  const session: Session = {
    id: input.sessionId,
    partyCode: input.partyCode,
    hostId: input.hostId,
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
  const hostParticipant: Participant = {
    id: input.hostId,
    sessionId: input.sessionId,
    displayName: input.hostName,
    deviceId: input.hostDeviceId,
    assignedSlot: null,
    photoUrl: null,
    thumbnailUrl: null,
    stickers: [],
    joinedAt: now,
  };
  return { session, participants: [hostParticipant] };
}

export function touchSession(state: RoomState): void {
  state.session.lastActivityAt = new Date().toISOString();
}

export function assignSlot(
  state: RoomState,
  participantId: string,
  slotIndex: number
): { error: string } | { slotIndex: number; participantId: string; displayName: string } {
  if (state.session.status === "locked") return { error: "SESSION_LOCKED" };
  const slot = state.session.layout.slots.find((s) => s.index === slotIndex);
  if (!slot) return { error: "INVALID_SLOT" };
  if (slot.locked) return { error: "SLOT_LOCKED" };

  const participant = state.participants.find((p) => p.id === participantId);
  if (!participant) return { error: "PARTICIPANT_NOT_FOUND" };

  for (const s of state.session.layout.slots) {
    if (s.assignedTo === participantId) s.assignedTo = null;
    if (s.index === slotIndex) {
      if (s.assignedTo && s.assignedTo !== participantId) {
        const prev = state.participants.find((p) => p.id === s.assignedTo);
        if (prev) prev.assignedSlot = null;
      }
      s.assignedTo = participantId;
    }
  }
  participant.assignedSlot = slotIndex;
  touchSession(state);
  return {
    slotIndex,
    participantId,
    displayName: participant.displayName,
  };
}

export function setTheme(
  state: RoomState,
  theme: ThemeKey,
  customHue?: number
): { theme: ThemeKey; customHue?: number } {
  state.session.theme = theme;
  state.session.customHue = customHue;
  touchSession(state);
  return { theme, customHue };
}

export function lockSession(state: RoomState): void {
  state.session.status = "locked";
  for (const p of state.participants) {
    p.photoUrl = null;
    p.thumbnailUrl = null;
  }
  touchSession(state);
}

export function submitPhoto(
  state: RoomState,
  participantId: string,
  photoUrl: string,
  thumbnailUrl: string
): { error: string } | { slotIndex: number; participantId: string; thumbnailUrl: string; photoUrl: string } {
  if (state.session.status === "locked") return { error: "SESSION_LOCKED" };
  const participant = state.participants.find((p) => p.id === participantId);
  if (!participant || participant.assignedSlot === null) {
    return { error: "NO_SLOT" };
  }
  participant.photoUrl = photoUrl;
  participant.thumbnailUrl = thumbnailUrl;
  const slot = state.session.layout.slots.find(
    (s) => s.index === participant.assignedSlot
  );
  if (slot) slot.locked = true;
  touchSession(state);
  return {
    slotIndex: participant.assignedSlot,
    participantId,
    thumbnailUrl,
    photoUrl,
  };
}

export function clearSlotPhoto(
  state: RoomState,
  slotIndex: number,
  requesterParticipantId: string,
  isHost: boolean
): { error: string } | { slotIndex: number; participantId: string } {
  if (state.session.status === "locked") return { error: "SESSION_LOCKED" };
  const slot = state.session.layout.slots.find((s) => s.index === slotIndex);
  if (!slot?.assignedTo) return { error: "NO_ASSIGNEE" };
  const assignee = state.participants.find((p) => p.id === slot.assignedTo);
  if (!assignee) return { error: "PARTICIPANT_NOT_FOUND" };
  if (!isHost && assignee.id !== requesterParticipantId) {
    return { error: "FORBIDDEN" };
  }
  if (!assignee.photoUrl) return { error: "NO_PHOTO" };
  assignee.photoUrl = null;
  assignee.thumbnailUrl = null;
  slot.locked = false;
  touchSession(state);
  return { slotIndex, participantId: assignee.id };
}

export function joinParticipant(
  state: RoomState,
  input: { displayName: string; deviceId: string; participantId: string }
): { error: string } | { rejoined: boolean } {
  if (state.session.status === "expired") return { error: "SESSION_NOT_FOUND" };
  if (state.session.status === "locked") return { error: "SESSION_LOCKED" };

  const existing = state.participants.find((p) => p.deviceId === input.deviceId);
  if (existing) {
    touchSession(state);
    return { rejoined: true };
  }
  if (state.participants.length >= MAX_PARTICIPANTS) {
    return { error: "SESSION_FULL" };
  }
  const nameTaken = state.participants.some(
    (p) =>
      p.displayName.toLowerCase() === input.displayName.toLowerCase() &&
      p.deviceId !== input.deviceId
  );
  if (nameTaken) return { error: "NAME_TAKEN" };

  const now = new Date().toISOString();
  state.participants.push({
    id: input.participantId,
    sessionId: state.session.id,
    displayName: input.displayName,
    deviceId: input.deviceId,
    assignedSlot: null,
    photoUrl: null,
    thumbnailUrl: null,
    stickers: [],
    joinedAt: now,
  });
  if (state.session.status === "lobby" && state.participants.length > 1) {
    state.session.status = "active";
  }
  touchSession(state);
  return { rejoined: false };
}
