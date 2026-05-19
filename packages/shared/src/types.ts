export type SessionStatus = "lobby" | "active" | "locked" | "expired";

export type ThemeKey = "snow" | "midnight" | "petal" | "slate" | "citrus" | "custom";

export type FilterKey = "none" | "bw" | "warm" | "cool" | "fade";

export type LayoutPreset = "duo" | "squad" | "party" | "strip" | "panorama";

export type StickerScope = "tile" | "global";

export type WsEventType =
  | "PARTICIPANT_JOINED"
  | "PARTICIPANT_LEFT"
  | "SLOT_ASSIGNED"
  | "SLOT_REASSIGNED"
  | "PHOTO_SUBMITTED"
  | "STICKER_PLACED"
  | "STICKER_UPDATED"
  | "STICKER_DELETED"
  | "THEME_CHANGED"
  | "SESSION_LOCKED"
  | "SESSION_EXPIRED"
  | "PING";

export interface SlotDefinition {
  index: number;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  assignedTo: string | null;
  locked: boolean;
}

export interface CollageLayout {
  preset: LayoutPreset;
  rows: number;
  cols: number;
  slots: SlotDefinition[];
}

export interface Sticker {
  id: string;
  packId: string;
  stickerKey: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  scope: StickerScope;
  placedBy: string;
  targetId: string;
}

export interface Participant {
  id: string;
  sessionId: string;
  displayName: string;
  deviceId: string;
  assignedSlot: number | null;
  photoUrl: string | null;
  thumbnailUrl: string | null;
  stickers: Sticker[];
  joinedAt: string;
}

export interface Session {
  id: string;
  partyCode: string;
  hostId: string;
  hostDeviceId: string;
  hostName: string;
  theme: ThemeKey;
  customHue?: number;
  layout: CollageLayout;
  createdAt: string;
  expiresAt: string;
  lastActivityAt: string;
  status: SessionStatus;
  finalCollageUrl?: string;
  globalStickers: Sticker[];
}

export interface SlotState {
  index: number;
  participantId: string | null;
  displayName: string | null;
  photoUrl: string | null;
  thumbnailUrl: string | null;
  stickers: Sticker[];
}

export interface SessionState {
  session: Session;
  participants: Participant[];
  collage: {
    slots: SlotState[];
    globalStickers: Sticker[];
  };
}

export interface WsEnvelope<T = unknown> {
  type: WsEventType;
  sessionId: string;
  timestamp: string;
  payload: T;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: { code: string; message: string };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface ThemeTokens {
  "--color-bg": string;
  "--color-surface": string;
  "--color-surface-raised": string;
  "--color-text-primary": string;
  "--color-text-secondary": string;
  "--color-accent": string;
  "--color-border": string;
  "--shadow-card": string;
}
