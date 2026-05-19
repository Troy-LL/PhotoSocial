import type * as Party from "partykit/server";
import type { LayoutPreset, ThemeKey, WsEventType } from "@photosocial/shared";
import {
  assignSlotSchema,
  clearSlotPhotoSchema,
  setThemeSchema,
  submitPhotoSchema,
} from "@photosocial/shared";
import { err, jsonResponse, ok } from "./lib/api-response.js";
import { withCorsHandler } from "./lib/cors.js";
import { broadcast } from "./lib/broadcast.js";
import {
  signWsToken,
  verifyWsToken,
  type WsTokenPayload,
} from "./lib/jwt.js";
import {
  assignSlot,
  clearSlotPhoto,
  createRoomState,
  joinParticipant,
  lockSession,
  normalizeRoomState,
  setTheme,
  submitPhoto,
  toSessionState,
  type RoomState,
} from "./lib/session-state.js";

const STATE_KEY = "state";

async function loadState(room: Party.Room): Promise<RoomState | null> {
  const state = await room.storage.get<RoomState>(STATE_KEY);
  if (!state) return null;
  return normalizeRoomState(state);
}

async function saveState(room: Party.Room, state: RoomState): Promise<void> {
  await room.storage.put(STATE_KEY, state);
}

async function authFromRequest(
  req: Party.Request,
  roomId: string
): Promise<WsTokenPayload | null> {
  const header = req.headers.get("authorization");
  const token = header?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const payload = await verifyWsToken(token);
  if (!payload || payload.sessionId !== roomId) return null;
  return payload;
}

export default class SessionParty implements Party.Server {
  constructor(readonly room: Party.Room) {}

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    const token = new URL(ctx.request.url).searchParams.get("token");
    if (!token) {
      conn.close(4001, "Authentication required");
      return;
    }
    const payload = await verifyWsToken(token);
    if (!payload || payload.sessionId !== this.room.id) {
      conn.close(4001, "Invalid token");
      return;
    }
    conn.setState({ participantId: payload.participantId });
  }

  onMessage() {
    /* clients receive broadcasts only */
  }

  onRequest(req: Party.Request) {
    return withCorsHandler(req, async (request) => {
      if (request.method === "GET") {
        return this.handleGet(request);
      }
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }

      let body: Record<string, unknown>;
      try {
        body = (await request.json()) as Record<string, unknown>;
      } catch {
        return jsonResponse(err("VALIDATION_ERROR", "Invalid JSON"), 400);
      }

      const action = body.action as string;

      if (action === "init") {
        return this.handleInit(body);
      }
      if (action === "join") {
        return this.handleJoin(body);
      }
      if (action === "broadcast") {
        return this.handleInternalBroadcast(body);
      }

      const auth = await authFromRequest(request, this.room.id);
      if (!auth) {
        return jsonResponse(err("UNAUTHORIZED", "Invalid token"), 401);
      }

      const state = await loadState(this.room);
      if (!state) {
        return jsonResponse(err("SESSION_NOT_FOUND", "Not found"), 404);
      }

      switch (action) {
      case "assign-slot": {
        if (!auth.isHost) {
          return jsonResponse(err("FORBIDDEN", "FORBIDDEN"), 400);
        }
        const parsed = assignSlotSchema.safeParse(body);
        if (!parsed.success) {
          return jsonResponse(err("VALIDATION_ERROR", parsed.error.message), 400);
        }
        const result = assignSlot(
          state,
          parsed.data.participantId,
          parsed.data.slotIndex
        );
        if ("error" in result) {
          return jsonResponse(err(result.error, result.error), 400);
        }
        await saveState(this.room, state);
        broadcast(this.room, this.room.id, "SLOT_ASSIGNED", result);
        return jsonResponse(ok(result));
      }
      case "theme": {
        if (!auth.isHost) {
          return jsonResponse(err("FORBIDDEN", "FORBIDDEN"), 400);
        }
        const parsed = setThemeSchema.safeParse(body);
        if (!parsed.success) {
          return jsonResponse(err("VALIDATION_ERROR", parsed.error.message), 400);
        }
        const result = setTheme(
          state,
          parsed.data.theme,
          parsed.data.customHue
        );
        await saveState(this.room, state);
        broadcast(this.room, this.room.id, "THEME_CHANGED", result);
        return jsonResponse(ok(result));
      }
      case "lock": {
        if (!auth.isHost) {
          return jsonResponse(err("FORBIDDEN", "FORBIDDEN"), 400);
        }
        lockSession(state);
        await saveState(this.room, state);
        const finalCollageUrl = "";
        broadcast(this.room, this.room.id, "SESSION_LOCKED", {
          finalCollageUrl,
        });
        return jsonResponse(ok({ finalCollageUrl }));
      }
      case "photos": {
        const photoDataUrl = body.photoDataUrl as string | undefined;
        const thumbDataUrl = body.thumbDataUrl as string | undefined;
        const parsed = submitPhotoSchema.safeParse(body);
        if (!parsed.success || !photoDataUrl || !thumbDataUrl) {
          return jsonResponse(err("VALIDATION_ERROR", "Photo required"), 400);
        }
        const result = submitPhoto(
          state,
          auth.participantId,
          parsed.data.slotIndex,
          photoDataUrl,
          thumbDataUrl
        );
        if ("error" in result) {
          return jsonResponse(err(result.error, result.error), 400);
        }
        await saveState(this.room, state);
        broadcast(this.room, this.room.id, "PHOTO_SUBMITTED", result);
        return jsonResponse(ok({ photoUrl: result.photoUrl, thumbnailUrl: result.thumbnailUrl }));
      }
      case "clear-photo": {
        const parsed = clearSlotPhotoSchema.safeParse(body);
        if (!parsed.success) {
          return jsonResponse(err("VALIDATION_ERROR", parsed.error.message), 400);
        }
        const result = clearSlotPhoto(
          state,
          parsed.data.slotIndex,
          auth.participantId,
          auth.isHost
        );
        if ("error" in result) {
          return jsonResponse(err(result.error, result.error), 400);
        }
        await saveState(this.room, state);
        broadcast(this.room, this.room.id, "PHOTO_CLEARED", result);
        return jsonResponse(ok(result));
      }
      default:
        return jsonResponse(err("VALIDATION_ERROR", "Unknown action"), 400);
    }
    });
  }

  private async handleGet(req: Party.Request) {
    const auth = await authFromRequest(req, this.room.id);
    if (!auth) {
      return jsonResponse(err("UNAUTHORIZED", "Invalid token"), 401);
    }
    const state = await loadState(this.room);
    if (!state) {
      return jsonResponse(err("SESSION_NOT_FOUND", "Not found"), 404);
    }
    return jsonResponse(ok(toSessionState(state)));
  }

  private async handleInit(body: Record<string, unknown>) {
    const sessionId = body.sessionId as string;
    if (sessionId !== this.room.id) {
      return jsonResponse(err("FORBIDDEN", "Room mismatch"), 403);
    }
    const state = createRoomState({
      sessionId,
      partyCode: body.partyCode as string,
      hostId: body.hostId as string,
      hostDeviceId: body.hostDeviceId as string,
      hostName: body.hostName as string,
      layout: body.layout as LayoutPreset,
      theme: body.theme as ThemeKey,
      customHue: body.customHue as number | undefined,
    });
    await saveState(this.room, state);
    return jsonResponse(ok({ initialized: true }));
  }

  private async handleJoin(body: Record<string, unknown>) {
    const state = await loadState(this.room);
    if (!state) {
      return jsonResponse(err("SESSION_NOT_FOUND", "Not found"), 404);
    }

    const displayName = body.displayName as string;
    const deviceId = body.deviceId as string;
    const participantId = body.participantId as string;

    const existing = state.participants.find((p) => p.deviceId === deviceId);
    if (existing) {
      const wsToken = await signWsToken({
        sessionId: state.session.id,
        participantId: existing.id,
        deviceId,
        isHost: existing.id === state.session.hostId,
      });
      return jsonResponse(
        ok({
          rejoined: true,
          existingParticipantId: existing.id,
          isHost: existing.id === state.session.hostId,
          sessionMeta: {
            theme: state.session.theme,
            customHue: state.session.customHue,
            layout: state.session.layout,
            hostName: state.session.hostName,
            participantCount: state.participants.length,
            status: state.session.status,
          },
          wsToken,
        })
      );
    }

    const result = joinParticipant(state, {
      displayName,
      deviceId,
      participantId,
    });
    if ("error" in result) {
      return jsonResponse(err(result.error, result.error), 400);
    }

    await saveState(this.room, state);
    return jsonResponse(
      ok({
        rejoined: false,
        isHost: false,
        sessionMeta: {
          theme: state.session.theme,
          customHue: state.session.customHue,
          layout: state.session.layout,
          hostName: state.session.hostName,
          participantCount: state.participants.length,
          status: state.session.status,
        },
      })
    );
  }

  private handleInternalBroadcast(body: Record<string, unknown>) {
    const secret = process.env.PARTYKIT_BROADCAST_SECRET;
    if (!secret || body.internalSecret !== secret) {
      return jsonResponse(err("UNAUTHORIZED", "Unauthorized"), 401);
    }
    const type = body.type as WsEventType;
    const payload = body.payload ?? {};
    broadcast(this.room, this.room.id, type, payload);
    return jsonResponse(ok({ broadcast: true }));
  }
}
