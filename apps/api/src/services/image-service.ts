import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { ensureSessionDir, getSessionDir } from "../store/session-store.js";

const MAX_SIZE = 1200;
const THUMB_SIZE = 400;

export async function processAndSavePhoto(
  sessionId: string,
  participantId: string,
  buffer: Buffer
): Promise<{ photoUrl: string; thumbnailUrl: string; photoPath: string }> {
  await ensureSessionDir(sessionId);
  const dir = getSessionDir(sessionId);

  const mainName = `${participantId}-main.jpg`;
  const thumbName = `${participantId}-thumb.jpg`;
  const mainPath = join(dir, mainName);
  const thumbPath = join(dir, thumbName);

  const mainBuf = await sharp(buffer)
    .rotate()
    .resize(MAX_SIZE, MAX_SIZE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();

  const thumbBuf = await sharp(mainBuf)
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  await writeFile(mainPath, mainBuf);
  await writeFile(thumbPath, thumbBuf);

  return {
    photoUrl: `/api/sessions/${sessionId}/photos/${participantId}/main`,
    thumbnailUrl: `/api/sessions/${sessionId}/photos/${participantId}/thumb`,
    photoPath: mainPath,
  };
}

export async function renderFinalCollage(
  sessionId: string,
  imagePaths: { path: string; row: number; col: number; rowSpan: number; colSpan: number }[],
  cols: number,
  rows: number
): Promise<string> {
  const verticalStrip = cols === 1 && rows > 1;
  const horizontalStrip = rows === 1 && cols > 1;
  const cellW = verticalStrip ? 320 : horizontalStrip ? 160 : 400;
  const cellH = verticalStrip ? 110 : horizontalStrip ? 320 : 400;
  const width = cols * cellW;
  const height = rows * cellH;

  const composites: sharp.OverlayOptions[] = [];

  for (const img of imagePaths) {
    if (!img.path) continue;
    const resized = await sharp(img.path)
      .resize(cellW * img.colSpan, cellH * img.rowSpan, { fit: "cover" })
      .toBuffer();
    composites.push({
      input: resized,
      left: img.col * cellW,
      top: img.row * cellH,
    });
  }

  const outPath = join(getSessionDir(sessionId), "final-collage.jpg");
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite(composites)
    .jpeg({ quality: 92 })
    .toFile(outPath);

  return `/api/sessions/${sessionId}/photos/final`;
}
