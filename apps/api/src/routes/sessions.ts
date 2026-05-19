import {
  assignSlotSchema,
  clearSlotPhotoSchema,
  createSessionSchema,
  joinSessionSchema,
  placeStickerSchema,
  setThemeSchema,
  updateStickerSchema,
} from "@photosocial/shared";
import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { err, ok } from "../lib/api-response.js";
import { checkRateLimit } from "../lib/rate-limit.js";
import { verifyWsToken, type WsTokenPayload } from "../lib/jwt.js";
import * as sessionService from "../services/session-service.js";
import * as imageService from "../services/image-service.js";
import * as stickerService from "../services/sticker-service.js";
import * as store from "../store/session-store.js";
import { broadcast } from "../lib/party-broadcast.js";
import { getSessionDir } from "../store/session-store.js";

type Variables = { auth: WsTokenPayload };

const publicRoutes = new Hono();

function getIp(c: { req: { header: (n: string) => string | undefined } }): string {
  return c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function serviceError(result: { error: string }) {
  return err(result.error, result.error);
}

publicRoutes.post("/", async (c) => {
  const ip = getIp(c);
  const limit = checkRateLimit(`create:${ip}`, 10, 15 * 60 * 1000);
  if (!limit.allowed) {
    return c.json(err("RATE_LIMITED", "Too many sessions created"), 429);
  }

  const body = await c.req.json();
  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(err("VALIDATION_ERROR", parsed.error.message), 400);
  }

  try {
    const result = await sessionService.createSession(parsed.data);
    return c.json(ok(result));
  } catch {
    return c.json(err("INTERNAL_ERROR", "Could not create session"), 500);
  }
});

publicRoutes.post("/join", async (c) => {
  const ip = getIp(c);
  const limit = checkRateLimit(`join:${ip}`, 30, 15 * 60 * 1000);
  if (!limit.allowed) {
    return c.json(err("RATE_LIMITED", "Too many join attempts"), 429);
  }

  const body = await c.req.json();
  const parsed = joinSessionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(err("VALIDATION_ERROR", parsed.error.message), 400);
  }

  const result = sessionService.joinSession(parsed.data);
  if ("error" in result) {
    const messages: Record<string, string> = {
      SESSION_NOT_FOUND: "Party code not found or expired",
      SESSION_LOCKED: "This party has ended",
      SESSION_FULL: "This party is full",
      NAME_TAKEN: "That name is already taken",
    };
    const { error: code } = result as { error: string };
    return c.json(err(code, messages[code] ?? code), 400);
  }

  if (!result.rejoined) {
    broadcast(result.sessionId, "PARTICIPANT_JOINED", {
      participantId: result.participantId,
      displayName: parsed.data.displayName,
    });
  }

  return c.json(ok(result));
});

publicRoutes.get("/:sessionId/photos/:participantId/:type", async (c) => {
  const sessionId = c.req.param("sessionId");
  const participantId = c.req.param("participantId");
  const type = c.req.param("type");

  let filename: string;
  if (participantId === "final") {
    filename = "final-collage.jpg";
  } else {
    filename = `${participantId}-${type === "thumb" ? "thumb" : "main"}.jpg`;
  }

  try {
    const data = await readFile(join(getSessionDir(sessionId), filename));
    return new Response(data, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return c.json(err("NOT_FOUND", "Photo not found"), 404);
  }
});

/** Routes mounted at /:sessionId so param is available in auth middleware */
const sessionRoutes = new Hono<{ Variables: Variables }>();

sessionRoutes.use("*", async (c, next) => {
  const header = c.req.header("authorization");
  const token = header?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return c.json(err("UNAUTHORIZED", "Missing token"), 401);
  }
  const payload = verifyWsToken(token);
  if (!payload) {
    return c.json(err("UNAUTHORIZED", "Invalid token"), 401);
  }
  const sessionId = c.req.param("sessionId");
  if (!sessionId || payload.sessionId !== sessionId) {
    return c.json(err("FORBIDDEN", "Token session mismatch"), 403);
  }
  c.set("auth", payload);
  await next();
});

sessionRoutes.get("/", async (c) => {
  const sessionId = c.req.param("sessionId")!;
  const state = sessionService.getSessionState(sessionId);
  if (!state) {
    return c.json(err("SESSION_NOT_FOUND", "Session not found"), 404);
  }
  return c.json(ok(state));
});

sessionRoutes.post("/assign-slot", async (c) => {
  const auth = c.get("auth");
  const body = await c.req.json();
  const parsed = assignSlotSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(err("VALIDATION_ERROR", parsed.error.message), 400);
  }

  const result = sessionService.assignSlot(
    auth.sessionId,
    parsed.data.participantId,
    parsed.data.slotIndex,
    auth.isHost
  );

  if ("error" in result) {
    return c.json(serviceError(result as { error: string }), 400);
  }

  broadcast(auth.sessionId, "SLOT_ASSIGNED", result);
  return c.json(ok(result));
});

sessionRoutes.post("/unlock-slot", async (c) => {
  const auth = c.get("auth");
  const { slotIndex } = await c.req.json();
  const result = sessionService.unlockSlot(
    auth.sessionId,
    slotIndex,
    auth.isHost
  );
  if ("error" in result) {
    return c.json(serviceError(result as { error: string }), 400);
  }
  return c.json(ok(result));
});

sessionRoutes.post("/theme", async (c) => {
  const auth = c.get("auth");
  const body = await c.req.json();
  const parsed = setThemeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(err("VALIDATION_ERROR", parsed.error.message), 400);
  }

  const result = sessionService.setTheme(
    auth.sessionId,
    parsed.data.theme,
    parsed.data.customHue,
    auth.isHost
  );

  if ("error" in result) {
    return c.json(serviceError(result as { error: string }), 400);
  }

  broadcast(auth.sessionId, "THEME_CHANGED", result);
  return c.json(ok(result));
});

sessionRoutes.post("/lock", async (c) => {
  const auth = c.get("auth");
  const result = sessionService.lockSession(auth.sessionId, auth.isHost);
  if ("error" in result) {
    return c.json(serviceError(result as { error: string }), 400);
  }

  const session = result.session;
  const parts = store.getParticipants(session.id);
  const imagePaths = session.layout.slots.map((slot) => {
    const p = slot.assignedTo
      ? parts.find((x) => x.id === slot.assignedTo)
      : null;
    return {
      path: p?.photoUrl
        ? join(getSessionDir(session.id), `${p.id}-main.jpg`)
        : "",
      row: slot.row,
      col: slot.col,
      rowSpan: slot.rowSpan,
      colSpan: slot.colSpan,
    };
  });

  let finalCollageUrl = "";
  try {
    finalCollageUrl = await imageService.renderFinalCollage(
      session.id,
      imagePaths.filter((i) => i.path),
      session.layout.cols,
      session.layout.rows
    );
    session.finalCollageUrl = finalCollageUrl;
    sessionService.scheduleFinalCollageExpiry(session.id);
    store.setSession(session);
    await sessionService.purgeSlotPhotos(session.id);
  } catch (e) {
    console.error("Collage render failed", e);
  }

  broadcast(auth.sessionId, "SESSION_LOCKED", { finalCollageUrl });
  return c.json(ok({ finalCollageUrl }));
});

sessionRoutes.post("/photos", async (c) => {
  const auth = c.get("auth");
  const session = store.getSession(auth.sessionId);
  if (!session) return c.json(err("SESSION_NOT_FOUND", "Not found"), 404);
  if (session.status === "locked") {
    return c.json(err("SESSION_LOCKED", "Party is locked"), 400);
  }

  const participant = store.getParticipant(auth.sessionId, auth.participantId);
  if (!participant || participant.assignedSlot === null) {
    return c.json(err("NO_SLOT", "No slot assigned"), 400);
  }

  const body = await c.req.parseBody();
  const file = body["photo"];
  if (!file || typeof file === "string") {
    return c.json(err("VALIDATION_ERROR", "Photo required"), 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > 10 * 1024 * 1024) {
    return c.json(err("FILE_TOO_LARGE", "Max 10MB"), 400);
  }

  const { photoUrl, thumbnailUrl } = await imageService.processAndSavePhoto(
    auth.sessionId,
    auth.participantId,
    buffer
  );

  participant.photoUrl = photoUrl;
  participant.thumbnailUrl = thumbnailUrl;
  store.updateParticipant(participant);

  const slot = session.layout.slots.find(
    (s) => s.index === participant.assignedSlot
  );
  if (slot) {
    slot.locked = true;
    store.setSession(session);
  }

  broadcast(auth.sessionId, "PHOTO_SUBMITTED", {
    slotIndex: participant.assignedSlot,
    participantId: auth.participantId,
    thumbnailUrl,
    photoUrl,
  });

  return c.json(ok({ photoUrl, thumbnailUrl }));
});

sessionRoutes.post("/clear-photo", async (c) => {
  const auth = c.get("auth");
  const body = await c.req.json();
  const parsed = clearSlotPhotoSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(err("VALIDATION_ERROR", parsed.error.message), 400);
  }

  const result = sessionService.clearSlotPhoto(
    auth.sessionId,
    parsed.data.slotIndex,
    auth.participantId,
    auth.isHost
  );
  if ("error" in result) {
    return c.json(serviceError(result as { error: string }), 400);
  }

  broadcast(auth.sessionId, "PHOTO_CLEARED", result);
  return c.json(ok(result));
});

sessionRoutes.post("/stickers", async (c) => {
  const auth = c.get("auth");
  const body = await c.req.json();
  const parsed = placeStickerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(err("VALIDATION_ERROR", parsed.error.message), 400);
  }

  const result = stickerService.placeSticker({
    sessionId: auth.sessionId,
    participantId: auth.participantId,
    isHost: auth.isHost,
    ...parsed.data,
  });

  if ("error" in result) {
    return c.json(serviceError(result as { error: string }), 400);
  }

  broadcast(auth.sessionId, "STICKER_PLACED", { sticker: result.sticker });
  return c.json(ok(result));
});

sessionRoutes.patch("/stickers/:stickerId", async (c) => {
  const auth = c.get("auth");
  const body = await c.req.json();
  const parsed = updateStickerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(err("VALIDATION_ERROR", parsed.error.message), 400);
  }

  const result = stickerService.updateSticker(
    auth.sessionId,
    c.req.param("stickerId"),
    parsed.data,
    auth.participantId,
    auth.isHost
  );

  if ("error" in result) {
    return c.json(serviceError(result as { error: string }), 400);
  }

  broadcast(auth.sessionId, "STICKER_UPDATED", {
    stickerId: c.req.param("stickerId"),
    transform: parsed.data,
  });
  return c.json(ok(result));
});

sessionRoutes.delete("/stickers/:stickerId", async (c) => {
  const auth = c.get("auth");
  const result = stickerService.deleteSticker(
    auth.sessionId,
    c.req.param("stickerId"),
    auth.participantId,
    auth.isHost
  );

  if ("error" in result) {
    return c.json(serviceError(result as { error: string }), 400);
  }

  broadcast(auth.sessionId, "STICKER_DELETED", {
    stickerId: c.req.param("stickerId"),
  });
  return c.json(ok(result));
});

const authedRoutes = new Hono().route("/:sessionId", sessionRoutes);

export const sessionsRoutes = new Hono()
  .route("/", publicRoutes)
  .route("/", authedRoutes);
