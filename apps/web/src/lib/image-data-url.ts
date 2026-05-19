/** Resize and encode a photo blob as a JPEG data URL for PartyKit storage. */
export async function blobToJpegDataUrl(
  blob: Blob,
  maxSize: number,
  quality = 0.85
): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return canvas.toDataURL("image/jpeg", quality);
}

/** Target under PartyKit's ~128 KiB per storage key (JSON with full + thumb). */
const MAX_DATA_URL_CHARS = 55_000;

export async function blobToJpegDataUrlCompact(
  blob: Blob,
  maxSize: number,
  maxChars = MAX_DATA_URL_CHARS
): Promise<string> {
  let size = maxSize;
  let quality = 0.72;
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = await blobToJpegDataUrl(blob, size, quality);
    if (url.length <= maxChars) return url;
    quality = Math.max(0.45, quality - 0.08);
    size = Math.round(size * 0.85);
  }
  return blobToJpegDataUrl(blob, Math.round(maxSize * 0.6), 0.45);
}
