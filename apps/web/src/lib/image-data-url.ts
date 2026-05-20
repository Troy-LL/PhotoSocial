/** Raw upload size (binary POST — no JSON/base64 overhead). */
export const PHOTO_UPLOAD_FULL_BYTES = 88_000;
export const PHOTO_UPLOAD_THUMB_BYTES = 32_000;

/** PartyKit DO storage: 128 KiB/key — full + thumb stored in separate keys. */
export const PHOTO_STORAGE_FULL_BYTES = 115_000;
export const PHOTO_STORAGE_THUMB_BYTES = 38_000;

const MIME_CANDIDATES = ["image/webp", "image/jpeg"] as const;
type PhotoMime = (typeof MIME_CANDIDATES)[number];

async function renderToCanvas(
  blob: Blob,
  maxEdgePx: number
): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxEdgePx / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Canvas not supported");
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return canvas;
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: PhotoMime,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, mime, quality);
  });
}

/**
 * Compress to a WebP/JPEG blob under maxBytes — high quality first, then resize.
 * Binary upload avoids the ~100 KiB JSON body limit on PartyKit HTTP POSTs.
 */
export async function blobToPhotoBlobCompact(
  blob: Blob,
  maxEdgePx: number,
  maxBytes: number
): Promise<Blob> {
  let edge = maxEdgePx;

  for (let shrink = 0; shrink < 10; shrink++) {
    const canvas = await renderToCanvas(blob, edge);

    for (const mime of MIME_CANDIDATES) {
      for (let quality = 0.94; quality >= 0.52; quality -= 0.04) {
        const out = await canvasToBlob(canvas, mime, quality);
        if (out && out.size > 0 && out.size <= maxBytes) {
          return out;
        }
      }
    }

    edge = Math.round(edge * 0.86);
  }

  throw new Error("Could not encode photo within size limits");
}

/** Encode full + thumb blobs for binary PartyKit uploads. */
export async function encodePartySlotPhotoBlobs(blob: Blob): Promise<{
  fullBlob: Blob;
  thumbBlob: Blob;
}> {
  const [fullBlob, thumbBlob] = await Promise.all([
    blobToPhotoBlobCompact(blob, 1280, PHOTO_UPLOAD_FULL_BYTES),
    blobToPhotoBlobCompact(blob, 512, PHOTO_UPLOAD_THUMB_BYTES),
  ]);
  return { fullBlob, thumbBlob };
}

/** @deprecated JSON data URLs — use encodePartySlotPhotoBlobs for uploads */
export function photoUploadBodyBytes(
  slotIndex: number,
  part: { photoDataUrl?: string; thumbDataUrl?: string }
): number {
  return new TextEncoder().encode(
    JSON.stringify({ action: "photos", slotIndex, ...part })
  ).length;
}
