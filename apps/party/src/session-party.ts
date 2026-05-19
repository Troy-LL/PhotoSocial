import type * as Party from "partykit/server";
import type { WsEnvelope, WsEventType } from "@photosocial/shared";
import jwt from "jsonwebtoken";

interface WsTokenPayload {
  sessionId: string;
  participantId: string;
  deviceId: string;
  isHost: boolean;
}

const VALID_EVENTS = new Set<WsEventType>([
  "PARTICIPANT_JOINED",
  "PARTICIPANT_LEFT",
  "SLOT_ASSIGNED",
  "SLOT_REASSIGNED",
  "PHOTO_SUBMITTED",
  "PHOTO_CLEARED",
  "STICKER_PLACED",
  "STICKER_UPDATED",
  "STICKER_DELETED",
  "THEME_CHANGED",
  "SESSION_LOCKED",
  "SESSION_EXPIRED",
  "PING",
]);

function verifyToken(token: string): WsTokenPayload | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    return jwt.verify(token, secret) as WsTokenPayload;
  } catch {
    return null;
  }
}

export default class SessionParty implements Party.Server {
  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    const url = new URL(ctx.request.url);
    const token = url.searchParams.get("token");
    if (!token) {
      conn.close(4001, "Authentication required");
      return;
    }
    const payload = verifyToken(token);
    if (!payload || payload.sessionId !== this.room.id) {
      conn.close(4001, "Invalid token");
      return;
    }
    conn.setState({ participantId: payload.participantId });
  }

  onMessage() {
    /* v1: API is source of truth; clients only receive broadcasts */
  }

  async onRequest(req: Party.Request) {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const secret = process.env.PARTYKIT_BROADCAST_SECRET;
    const auth = req.headers.get("Authorization");
    if (!secret || auth !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    let body: { type?: string; payload?: unknown };
    try {
      body = (await req.json()) as { type?: string; payload?: unknown };
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    if (!body.type || !VALID_EVENTS.has(body.type as WsEventType)) {
      return new Response("Invalid event type", { status: 400 });
    }

    const envelope: WsEnvelope = {
      type: body.type as WsEventType,
      sessionId: this.room.id,
      timestamp: new Date().toISOString(),
      payload: body.payload ?? {},
    };

    this.room.broadcast(JSON.stringify(envelope));
    return new Response("ok", { status: 200 });
  }
}
