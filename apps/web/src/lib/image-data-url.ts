/** PartyKit DO storage: 128 KiB/key — we store full + thumb in separate keys. */
export const PHOTO_STORAGE_FULL_BYTES = 115_000;
export const PHOTO_STORAGE_THUMB_BYTES = 38_000;

const MIME_CANDIDATES = ["image/webp", "image/jpeg"] as const;
type PhotoMime = (typeof MIME_CANDIDATES)[number];

function dataUrlBytes(url: string): number {
  return new TextEncoder().encode(url).length;
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
  let best: { url: string; bytes: number; quality: number } | null = null;

  for (let shrink = 0; shrink < 6; shrink++) {
    const canvas = await renderToCanvas(blob, edge);

    for (const mime of MIME_CANDIDATES) {
      for (let quality = 0.94; quality >= 0.58; quality -= 0.04) {
        const url = await canvasToDataUrl(canvas, mime, quality);
        if (!url) continue;

        const bytes = dataUrlBytes(url);
        if (bytes <= maxBytes) {
          return url;
        }

        if (!best || bytes < best.bytes) {
          best = { url, bytes, quality };
        }
      }
    }

    edge = Math.round(edge * 0.88);
  }

  if (best) {
    return best.url;
  }

  throw new Error("Could not encode photo within size limits");
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

/** Defaults tuned for collage slots: high-res WebP full + sharp thumb. */
export async function encodePartySlotPhotos(blob: Blob): Promise<{
  photoDataUrl: string;
  thumbDataUrl: string;
}> {
  const [photoDataUrl, thumbDataUrl] = await Promise.all([
    blobToPhotoDataUrlCompact(blob, 1440, PHOTO_STORAGE_FULL_BYTES),
    blobToPhotoDataUrlCompact(blob, 512, PHOTO_STORAGE_THUMB_BYTES),
  ]);
  return { photoDataUrl, thumbDataUrl };
}
