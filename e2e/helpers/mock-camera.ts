import type { Page } from "@playwright/test";
import { testPhotoDataUrl, writeTestPhotoFixture } from "./test-photo";

writeTestPhotoFixture();

type MockCameraOptions = {
  /** Default: disable Web Share so Download uses the anchor path. */
  share?: "disable" | "reject";
};

/**
 * Stub getUserMedia with a still of e2e/fixtures/test-photo.png and skip
 * production countdown via window.__E2E_CAMERA__.
 */
export async function installMockCamera(
  page: Page,
  options: MockCameraOptions = {}
): Promise<void> {
  const src = testPhotoDataUrl();
  const share = options.share ?? "disable";

  await page.addInitScript(
    ({ photoSrc, shareMode }: { photoSrc: string; shareMode: "disable" | "reject" }) => {
      (
        window as Window & {
          __E2E_CAMERA__?: boolean;
          __E2E_CAMERA_CANVAS__?: HTMLCanvasElement;
        }
      ).__E2E_CAMERA__ = true;

      if (shareMode === "disable") {
        Object.defineProperty(navigator, "canShare", {
          configurable: true,
          value: () => false,
        });
      } else {
        Object.defineProperty(navigator, "canShare", {
          configurable: true,
          value: () => true,
        });
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: async () => {
            throw new DOMException("User activation required", "NotAllowedError");
          },
        });
      }

      const devices = navigator.mediaDevices;
      if (!devices) return;

      devices.getUserMedia = async () => {
        const img = new Image();
        img.src = photoSrc;
        await img.decode();

        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.style.position = "fixed";
        canvas.style.left = "-9999px";
        canvas.style.width = "1px";
        canvas.style.height = "1px";
        document.documentElement.appendChild(canvas);

        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) {
          throw new Error("e2e mock camera: 2d context unavailable");
        }
        ctx.drawImage(img, 0, 0);

        const stream = canvas.captureStream(15);
        if (stream.getVideoTracks().length === 0) {
          throw new Error("e2e mock camera: captureStream produced no video");
        }

        (
          window as Window & { __E2E_CAMERA_CANVAS__?: HTMLCanvasElement }
        ).__E2E_CAMERA_CANVAS__ = canvas;
        return stream;
      };
    },
    { photoSrc: src, shareMode: share }
  );
}
