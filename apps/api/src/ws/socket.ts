import { Server as SocketServer } from "socket.io";
import type { Server as HttpServer } from "node:http";
import { verifyWsToken } from "../lib/jwt.js";
import { broadcast, setIo } from "./broadcaster.js";
import * as store from "../store/session-store.js";
import { config } from "../config.js";

export function setupSocket(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: config.corsOrigin,
      credentials: true,
    },
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  setIo(io);

  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) {
      return next(new Error("Authentication required"));
    }
    const payload = verifyWsToken(token);
    if (!payload) {
      return next(new Error("Invalid token"));
    }
    socket.data.auth = payload;
    next();
  });

  io.on("connection", (socket) => {
    const auth = socket.data.auth;
    socket.join(auth.sessionId);

    socket.on("ping", () => {
      socket.emit("event", {
        type: "PING",
        sessionId: auth.sessionId,
        timestamp: new Date().toISOString(),
        payload: {},
      });
    });

    socket.on("disconnect", () => {
      const stillConnected = io.sockets.adapter.rooms
        .get(auth.sessionId);
      const others = stillConnected
        ? [...stillConnected].filter((id) => id !== socket.id).length
        : 0;
      if (others === 0) {
        /* session may still exist */
      }
      broadcast(auth.sessionId, "PARTICIPANT_LEFT", {
        participantId: auth.participantId,
      });
    });
  });

  return io;
}
