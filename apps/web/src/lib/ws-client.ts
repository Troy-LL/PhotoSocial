import PartySocket from "partysocket";
import type { WsEnvelope } from "@photosocial/shared";
import { partykitHost } from "./deploy-config.js";

type EventHandler = (envelope: WsEnvelope) => void;

let socket: PartySocket | null = null;
let activeKey: string | null = null;
let reconnecting = false;
const handlers = new Set<EventHandler>();
const reconnectListeners = new Set<(v: boolean) => void>();

export function connectWs(sessionId: string, token: string): PartySocket {
  const key = `${sessionId}:${token}`;
  if (socket && activeKey === key) {
    return socket;
  }

  if (socket) {
    socket.close();
    socket = null;
  }

  activeKey = key;
  socket = new PartySocket({
    host: partykitHost(),
    room: sessionId,
    party: "main",
    query: { token },
  });

  socket.addEventListener("open", () => {
    reconnecting = false;
    reconnectListeners.forEach((fn) => fn(false));
  });

  socket.addEventListener("close", () => {
    setTimeout(() => {
      if (socket && socket.readyState !== WebSocket.OPEN) {
        reconnecting = true;
        reconnectListeners.forEach((fn) => fn(true));
      }
    }, 2000);
  });

  socket.addEventListener("error", () => {
    reconnecting = true;
    reconnectListeners.forEach((fn) => fn(true));
  });

  socket.addEventListener("message", (event) => {
    try {
      const envelope = JSON.parse(String(event.data)) as WsEnvelope;
      handlers.forEach((h) => h(envelope));
    } catch {
      /* ignore malformed */
    }
  });

  return socket;
}

export function disconnectWs(): void {
  socket?.close();
  socket = null;
  activeKey = null;
  reconnecting = false;
}

export function onWsEvent(handler: EventHandler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

export function onReconnecting(fn: (v: boolean) => void): () => void {
  reconnectListeners.add(fn);
  return () => reconnectListeners.delete(fn);
}

export function isReconnecting(): boolean {
  return reconnecting;
}
