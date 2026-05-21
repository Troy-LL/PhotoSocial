export type CollageExportOrientation = "vertical" | "horizontal";

export type SaveCollageResult = "shared" | "downloaded" | "cancelled";

export class CollageExportError extends Error {
  readonly code: "images_failed" | "timeout" | "encode_failed" | "fetch_failed";

  constructor(
    message: string,
    code: "images_failed" | "timeout" | "encode_failed" | "fetch_failed"
  ) {
    super(message);
    this.name = "CollageExportError";
    this.code = code;
  }
}

const IMAGE_WAIT_MS = 15_000;

export function collageExportDimensions(orientation: CollageExportOrientation): {
  width: number;
  height: number;
} {
  if (orientation === "horizontal") {
    return { width: 2400, height: 800 };
  }
  return { width: 800, height: 2400 };
}

export function isShareCancelled(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

export async function waitForCollageImages(
  root: HTMLElement,
  timeoutMs = IMAGE_WAIT_MS
): Promise<void> {
  const imgs = root.querySelectorAll("img");
  if (imgs.length === 0) return;

  await Promise.all(
    Array.from(imgs).map(
      (img) =>
        new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(() => {
            reject(
              new CollageExportError(
                "Timed out waiting for collage photos to load",
                "timeout"
              )
            );
          }, timeoutMs);

          const done = (fn: () => void) => {
            window.clearTimeout(timer);
            fn();
          };

          if (img.complete && img.naturalWidth > 0) {
            done(() => resolve());
            return;
          }

          img.addEventListener(
            "load",
            () => done(() => resolve()),
            { once: true }
          );
          img.addEventListener(
            "error",
            () =>
              done(() =>
                reject(
                  new CollageExportError(
                    "One or more collage photos failed to load",
                    "images_failed"
                  )
                )
              ),
            { once: true }
          );
        })
    )
  );
}

function prepareExportClone(
  source: HTMLElement,
  orientation: CollageExportOrientation
): HTMLElement {
  const { width, height } = collageExportDimensions(orientation);
  const clone = source.cloneNode(true) as HTMLElement;

  clone.removeAttribute("id");
  clone.style.position = "fixed";
  clone.style.left = "-10000px";
  clone.style.top = "0";
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.maxWidth = "none";
  clone.style.maxHeight = "none";
  clone.style.aspectRatio = "auto";
  clone.style.margin = "0";
  clone.style.pointerEvents = "none";
  clone.style.visibility = "hidden";
  clone.dataset.exporting = "true";

  document.body.appendChild(clone);
  return clone;
}

export async function captureCollageElement(
  el: HTMLElement,
  orientation: CollageExportOrientation
): Promise<HTMLCanvasElement> {
  await waitForCollageImages(el);

  const clone = prepareExportClone(el, orientation);

  try {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    await waitForCollageImages(clone);

    const { default: html2canvas } = await import("html2canvas");
    return html2canvas(clone, {
      scale: 1,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: null,
    });
  } finally {
    clone.remove();
  }
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/png");
  });
  if (blob) return blob;

  const scaled = document.createElement("canvas");
  scaled.width = Math.max(1, Math.round(canvas.width * 0.5));
  scaled.height = Math.max(1, Math.round(canvas.height * 0.5));
  const ctx = scaled.getContext("2d");
  if (!ctx) {
    throw new CollageExportError("Failed to encode collage", "encode_failed");
  }
  ctx.drawImage(canvas, 0, 0, scaled.width, scaled.height);

  const fallback = await new Promise<Blob | null>((resolve) => {
    scaled.toBlob((b) => resolve(b), "image/jpeg", 0.92);
  });
  if (!fallback) {
    throw new CollageExportError("Failed to encode collage", "encode_failed");
  }
  return fallback;
}

export async function saveCollageBlob(
  blob: Blob,
  filename: string
): Promise<SaveCollageResult> {
  const type = blob.type || "image/png";
  const file = new File([blob], filename, { type });

  if (
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file], title: filename });
      return "shared";
    } catch (err) {
      if (isShareCancelled(err)) return "cancelled";
      throw err;
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return "downloaded";
}

export async function saveCollageCanvas(
  canvas: HTMLCanvasElement,
  filename: string
): Promise<SaveCollageResult> {
  const blob = await canvasToBlob(canvas);
  return saveCollageBlob(blob, filename);
}

export async function saveCollageFromUrl(
  url: string,
  filename: string
): Promise<SaveCollageResult> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new CollageExportError(
      "Could not fetch collage from server",
      "fetch_failed"
    );
  }
  const blob = await res.blob();
  return saveCollageBlob(blob, filename);
}

export async function exportCollageFromElement(
  el: HTMLElement,
  orientation: CollageExportOrientation,
  filename: string
): Promise<SaveCollageResult> {
  const canvas = await captureCollageElement(el, orientation);
  return saveCollageCanvas(canvas, filename);
}

export function downloadResultHint(
  result: SaveCollageResult,
  t: (key: string) => string
): string | null {
  if (result === "cancelled") return null;
  if (result === "shared") return t("collageSharedHint");
  return t("collageDownloadHint");
}
