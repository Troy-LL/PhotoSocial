import type { Server as SocketServer } from "socket.io";
import type { WsEnvelope, WsEventType } from "@passandpic/shared";

let io: SocketServer | null = null;

export function setIo(server: SocketServer): void {
  io = server;
}

export function broadcast<T>(
  sessionId: string,
  type: WsEventType,
  payload: T
): void {
  if (!io) return;
  const envelope: WsEnvelope<T> = {
    type,
    sessionId,
    timestamp: new Date().toISOString(),
    payload,
  };
  io.to(sessionId).emit("event", envelope);
}
