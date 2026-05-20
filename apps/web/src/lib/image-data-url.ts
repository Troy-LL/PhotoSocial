/** PartyKit DO storage: 128 KiB/key — full + thumb stored in separate keys. */
export const PHOTO_STORAGE_FULL_BYTES = 115_000;
export const PHOTO_STORAGE_THUMB_BYTES = 38_000;

/**
 * PartyKit / Cloudflare party HTTP POST bodies are capped near ~100 KiB.
 * Each upload sends one image per request; budget is the full JSON body size.
 */
export const PARTY_HTTP_BODY_MAX_BYTES = 98_000;

const MIME_CANDIDATES = ["image/webp", "image/jpeg"] as const;
type PhotoMime = (typeof MIME_CANDIDATES)[number];

function dataUrlBytes(url: string): number {
  return new TextEncoder().encode(url).length;
}

export function photoUploadBodyBytes(
  slotIndex: number,
  part: { photoDataUrl?: string; thumbDataUrl?: string }
): number {
  return new TextEncoder().encode(
    JSON.stringify({ action: "photos", slotIndex, ...part })
  ).length;
}

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

async function canvasToDataUrl(
  canvas: HTMLCanvasElement,
  mime: PhotoMime,
  quality: number
): Promise<string | null> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mime, quality);
  });
  if (!blob) return null;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Encode within a byte budget, preferring resolution and high quality.
 * Tries WebP first (~30% smaller than JPEG at equal visual quality), then JPEG.
 */
export async function blobToPhotoDataUrlCompact(
  blob: Blob,
  maxEdgePx: number,
  maxBytes: number
): Promise<string> {
  let edge = maxEdgePx;

  for (let shrink = 0; shrink < 10; shrink++) {
    const canvas = await renderToCanvas(blob, edge);

    for (const mime of MIME_CANDIDATES) {
      for (let quality = 0.94; quality >= 0.52; quality -= 0.04) {
        const url = await canvasToDataUrl(canvas, mime, quality);
        if (!url) continue;

        if (dataUrlBytes(url) <= maxBytes) {
          return url;
        }
      }
    }

    edge = Math.round(edge * 0.86);
  }

  throw new Error("Could not encode photo within size limits");
}

async function encodeForUploadBody(
  blob: Blob,
  maxEdgePx: number,
  slotIndex: number,
  field: "photoDataUrl" | "thumbDataUrl",
  maxBodyBytes: number
): Promise<string> {
  let maxDataUrlBytes = maxBodyBytes - 96;

  for (let attempt = 0; attempt < 12; attempt++) {
    const url = await blobToPhotoDataUrlCompact(blob, maxEdgePx, maxDataUrlBytes);
    const bodyBytes = photoUploadBodyBytes(slotIndex, { [field]: url });
    if (bodyBytes <= maxBodyBytes) {
      return url;
    }
    maxDataUrlBytes = Math.floor(maxDataUrlBytes * 0.88);
    if (maxDataUrlBytes < 12_000) break;
  }

  throw new Error("Could not encode photo within upload size limits");
}

/** @deprecated Use blobToPhotoDataUrlCompact */
export async function blobToJpegDataUrlCompact(
  blob: Blob,
  maxSize: number,
  maxChars = PHOTO_STORAGE_FULL_BYTES
): Promise<string> {
  return blobToPhotoDataUrlCompact(blob, maxSize, maxChars);
}

/** @deprecated Use blobToPhotoDataUrlCompact */
export async function blobToJpegDataUrl(
  blob: Blob,
  maxSize: number,
  quality = 0.85
): Promise<string> {
  const canvas = await renderToCanvas(blob, maxSize);
  const url = await canvasToDataUrl(canvas, "image/jpeg", quality);
  if (!url) throw new Error("JPEG encode failed");
  return url;
}

/** Encode full + thumb for separate PartyKit uploads (each under HTTP body cap). */
export async function encodePartySlotPhotos(
  blob: Blob,
  slotIndex: number
): Promise<{
  photoDataUrl: string;
  thumbDataUrl: string;
}> {
  const [photoDataUrl, thumbDataUrl] = await Promise.all([
    encodeForUploadBody(
      blob,
      1280,
      slotIndex,
      "photoDataUrl",
      PARTY_HTTP_BODY_MAX_BYTES
    ),
    encodeForUploadBody(
      blob,
      480,
      slotIndex,
      "thumbDataUrl",
      PARTY_HTTP_BODY_MAX_BYTES
    ),
  ]);
  return { photoDataUrl, thumbDataUrl };
}
