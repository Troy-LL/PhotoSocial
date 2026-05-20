/** Raw WebP/JPEG bytes (base64 in storage stays under the 128 KiB DO key cap). */
export const MAX_BINARY_PHOTO_BYTES = 88_000;

export function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

export function parsePhotoPart(
  header: string | null
): "full" | "thumb" | null {
  if (header === "full" || header === "thumb") return header;
  return null;
}
