import type * as Party from "partykit/server";
import {
  createSessionSchema,
  generatePartyCode,
  joinSessionSchema,
} from "@photosocial/shared";
import { err, jsonResponse, ok } from "./lib/api-response.js";
import { withCorsHandler } from "./lib/cors.js";
import { signWsToken } from "./lib/jwt.js";
import { createRoomState } from "./lib/session-state.js";

const REGISTRY_KEY = "codes";

type CodeMap = Record<string, string>;

async function loadCodes(room: Party.Room): Promise<CodeMap> {
  return (await room.storage.get<CodeMap>(REGISTRY_KEY)) ?? {};
}

async function saveCodes(room: Party.Room, codes: CodeMap): Promise<void> {
  await room.storage.put(REGISTRY_KEY, codes);
}

export default class RegistryParty implements Party.Server {
  constructor(readonly room: Party.Room) {}

  onRequest(req: Party.Request) {
    return withCorsHandler(req, async (request) => {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }

      let body: Record<string, unknown>;
      try {
        body = (await request.json()) as Record<string, unknown>;
      } catch {
        return jsonResponse(err("VALIDATION_ERROR", "Invalid JSON"), 400);
      }

      const action = body.action as string | undefined;
      if (action === "create") {
        return this.handleCreate(body);
      }
      if (action === "join") {
        return this.handleJoin(body);
      }

      return jsonResponse(err("VALIDATION_ERROR", "Unknown action"), 400);
    });
  }

  private async handleCreate(body: Record<string, unknown>) {
    const parsed = createSessionSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(err("VALIDATION_ERROR", parsed.error.message), 400);
    }

    const codes = await loadCodes(this.room);
    let partyCode = generatePartyCode();
    let attempts = 0;
    while (codes[partyCode] && attempts < 5) {
      partyCode = generatePartyCode();
      attempts++;
    }
    if (codes[partyCode]) {
      return jsonResponse(err("INTERNAL_ERROR", "Could not create session"), 500);
    }

    const sessionId = crypto.randomUUID();
    const hostId = crypto.randomUUID();
    codes[partyCode] = sessionId;
    await saveCodes(this.room, codes);

    const initRes = await this.room.context.parties.main.get(sessionId).fetch({
      method: "POST",
      body: JSON.stringify({
        action: "init",
        sessionId,
        partyCode,
        hostId,
        hostDeviceId: parsed.data.hostDeviceId,
        hostName: parsed.data.hostName,
        layout: parsed.data.layout,
        theme: parsed.data.theme,
        customHue: parsed.data.customHue,
      }),
    });

    if (!initRes.ok) {
      delete codes[partyCode];
      await saveCodes(this.room, codes);
      return jsonResponse(err("INTERNAL_ERROR", "Could not init session"), 500);
    }

    const wsToken = await signWsToken({
      sessionId,
      participantId: hostId,
      deviceId: parsed.data.hostDeviceId,
      isHost: true,
    });

    const state = createRoomState({
      sessionId,
      partyCode,
      hostId,
      hostDeviceId: parsed.data.hostDeviceId,
      hostName: parsed.data.hostName,
      layout: parsed.data.layout,
      theme: parsed.data.theme,
      customHue: parsed.data.customHue,
    });

    return jsonResponse(
      ok({
        sessionId,
        partyCode,
        wsToken,
        expiresAt: state.session.expiresAt,
        participantId: hostId,
      })
    );
  }

  private async handleJoin(body: Record<string, unknown>) {
    const parsed = joinSessionSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(err("VALIDATION_ERROR", parsed.error.message), 400);
    }

    const codes = await loadCodes(this.room);
    const sessionId = codes[parsed.data.partyCode.toUpperCase()];
    if (!sessionId) {
      return jsonResponse(
        err("SESSION_NOT_FOUND", "Party code not found or expired"),
        400
      );
    }

    const participantId = crypto.randomUUID();
    const joinRes = await this.room.context.parties.main.get(sessionId).fetch({
      method: "POST",
      body: JSON.stringify({
        action: "join",
        displayName: parsed.data.displayName,
        deviceId: parsed.data.deviceId,
        participantId,
      }),
    });

    const joinData = (await joinRes.json()) as {
      success: boolean;
      data?: {
        rejoined: boolean;
        sessionMeta: unknown;
        existingParticipantId?: string;
        isHost?: boolean;
      };
      error?: { code: string; message: string };
    };

    if (!joinData.success) {
      const code = joinData.error?.code ?? "SESSION_NOT_FOUND";
      const messages: Record<string, string> = {
        SESSION_NOT_FOUND: "Party code not found or expired",
        SESSION_LOCKED: "This party has ended",
        SESSION_FULL: "This party is full",
        NAME_TAKEN: "That name is already taken",
      };
      return jsonResponse(
        err(code, messages[code] ?? code),
        joinRes.status === 200 ? 400 : joinRes.status
      );
    }

    const data = joinData.data!;
    const actualParticipantId =
      data.existingParticipantId ?? participantId;
    const isHost = Boolean(data.isHost);
    const wsToken = await signWsToken({
      sessionId,
      participantId: actualParticipantId,
      deviceId: parsed.data.deviceId,
      isHost,
    });

    if (!data.rejoined) {
      const internalSecret = process.env.PARTYKIT_BROADCAST_SECRET;
      await this.room.context.parties.main.get(sessionId).fetch({
        method: "POST",
        body: JSON.stringify({
          action: "broadcast",
          internalSecret,
          type: "PARTICIPANT_JOINED",
          payload: {
            participantId: actualParticipantId,
            displayName: parsed.data.displayName,
          },
        }),
      });
    }

    return jsonResponse(
      ok({
        sessionId,
        participantId: actualParticipantId,
        wsToken,
        isHost,
        sessionMeta: data.sessionMeta,
      })
    );
  }
}
