import { io, type Socket } from "socket.io-client";
import type { WsEnvelope } from "@photosocial/shared";

type EventHandler = (envelope: WsEnvelope) => void;

let socket: Socket | null = null;
let activeToken: string | null = null;
let reconnecting = false;
const handlers = new Set<EventHandler>();
const reconnectListeners = new Set<(v: boolean) => void>();

function wsUrl(): string {
  const env = import.meta.env.VITE_WS_URL as string | undefined;
  if (env) return env;
  return window.location.origin;
}

export function connectWs(token: string): Socket {
  if (socket && activeToken === token) {
    if (!socket.connected) socket.connect();
    return socket;
  }

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  activeToken = token;
  socket = io(wsUrl(), {
    path: "/socket.io",
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });

  socket.on("connect", () => {
    reconnecting = false;
    reconnectListeners.forEach((fn) => fn(false));
  });

  socket.on("disconnect", () => {
    setTimeout(() => {
      if (socket && !socket.connected) {
        reconnecting = true;
        reconnectListeners.forEach((fn) => fn(true));
      }
    }, 2000);
  });

  socket.on("connect_error", () => {
    reconnecting = true;
    reconnectListeners.forEach((fn) => fn(true));
  });

  socket.on("event", (envelope: WsEnvelope) => {
    handlers.forEach((h) => h(envelope));
  });

  return socket;
}

export function disconnectWs(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  activeToken = null;
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
