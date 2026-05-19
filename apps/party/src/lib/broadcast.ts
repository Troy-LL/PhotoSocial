import type { WsEnvelope, WsEventType } from "@photosocial/shared";
import type * as Party from "partykit/server";

export function broadcast<T>(
  room: Party.Room,
  sessionId: string,
  type: WsEventType,
  payload: T
): void {
  const envelope: WsEnvelope<T> = {
    type,
    sessionId,
    timestamp: new Date().toISOString(),
    payload,
  };
  room.broadcast(JSON.stringify(envelope));
}
