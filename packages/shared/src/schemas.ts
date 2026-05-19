import { z } from "zod";

export const layoutPresetSchema = z.enum([
  "duo",
  "squad",
  "party",
  "strip",
  "panorama",
]);

export const themeKeySchema = z.enum([
  "snow",
  "midnight",
  "petal",
  "slate",
  "citrus",
  "custom",
]);

export const createSessionSchema = z.object({
  hostDeviceId: z.string().min(1),
  hostName: z.string().min(1).max(24),
  layout: layoutPresetSchema,
  theme: themeKeySchema,
  customHue: z.number().min(0).max(360).optional(),
});

export const joinSessionSchema = z.object({
  partyCode: z.string().regex(/^[A-Z]+-\d{4}$/),
  displayName: z.string().min(1).max(24),
  deviceId: z.string().min(1),
});

export const assignSlotSchema = z.object({
  participantId: z.string().uuid(),
  slotIndex: z.number().int().min(0),
});

export const placeStickerSchema = z.object({
  stickerKey: z.string(),
  packId: z.string(),
  targetScope: z.enum(["tile", "global"]),
  targetId: z.string(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
});

export const updateStickerSchema = z.object({
  x: z.number().min(0).max(100).optional(),
  y: z.number().min(0).max(100).optional(),
  scale: z.number().min(0.1).max(5).optional(),
  rotation: z.number().min(-360).max(360).optional(),
});

export const setThemeSchema = z.object({
  theme: themeKeySchema,
  customHue: z.number().min(0).max(360).optional(),
});

export const emailSchema = z.object({
  email: z.string().email(),
  scope: z.enum(["full-collage", "my-tile"]),
  consentCloudSave: z.boolean(),
  recipientName: z.string().optional(),
});

export const filterKeySchema = z.enum(["none", "bw", "warm", "cool", "fade"]);
