/**
 * Viewport matrix: mock-camera capture, strip preview ratios, screenshots,
 * and collage download on desktop / tablet / phone.
 */
import { test, expect, type Locator, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { installMockCamera } from "./helpers/mock-camera";
import { analyzePng, pngHasTestPhotoBands } from "./helpers/png-analyze";

const ARTIFACT_DIR = path.join(process.cwd(), "test-results", "viewport-preview");

const SCREENSHOT = {
  animations: "disabled" as const,
  maxDiffPixelRatio: 0.03,
};

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

async function assertAspectNear(locator: Locator, expected: number) {
  const box = await locator.boundingBox();
  expect(box, "element should have a layout box").toBeTruthy();
  expect(box!.width / Math.max(1, box!.height)).toBeCloseTo(expected, 1);
}

async function startSoloBooth(page: Page, layoutName: string) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/solo");
  await page.getByRole("button", { name: layoutName, exact: true }).click();
  await page.getByRole("button", { name: "Start booth" }).click();
  await expect(page).toHaveURL(/\/solo\/camera/);
  await page.getByRole("radio", { name: "Tap each" }).click();
  await expect(page.getByRole("button", { name: "Take Photo" })).toBeEnabled({
    timeout: 15_000,
  });
}

async function takePhotos(page: Page, count: number) {
  for (let i = 0; i < count; i++) {
    await page.getByRole("button", { name: "Take Photo" }).click();
    if (i < count - 1) {
      await expect(
        page.getByText(`Photo ${i + 2} of ${count}`, { exact: true })
      ).toBeVisible({ timeout: 10_000 });
    }
  }
  await expect(
    page.getByText("All photos are in — tap a slot to retake", { exact: true })
  ).toBeVisible({ timeout: 15_000 });
}

async function downloadCollage(page: Page, fileName: string) {
  const downloadPromise = page.waitForEvent("download", { timeout: 45_000 });
  await page.getByRole("button", { name: "Download" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/PhotoSocial-solo\.png$/);
  const outPath = path.join(ARTIFACT_DIR, fileName);
  await download.saveAs(outPath);
  expect(fs.existsSync(outPath)).toBe(true);
  return outPath;
}

test.beforeAll(() => {
  ensureDir(ARTIFACT_DIR);
});

test.describe("viewport preview", () => {
  test.beforeEach(async ({ page }) => {
    await installMockCamera(page);
  });

  test("3-Up Top: preview ratio, screenshots, and download", async ({
    page,
  }, testInfo) => {
    await startSoloBooth(page, "3-Up Top");
    await takePhotos(page, 3);

    const cameraStrip = page.locator("[data-strip-preview]").first();
    await expect(cameraStrip).toBeVisible();
    await assertAspectNear(cameraStrip, 1 / 3);

    await expect(page).toHaveScreenshot("camera-review.png", {
      ...SCREENSHOT,
      fullPage: true,
    });

    await page.getByRole("button", { name: "View collage" }).click();
    await expect(page).toHaveURL(/\/solo\/collage/);
    await expect(
      page.getByRole("heading", { name: "Your strip is ready!" })
    ).toBeVisible();

    const collage = page.locator("#collage-export");
    await expect(collage).toBeVisible();
    await expect(collage.locator("img").first()).toBeVisible();
    await assertAspectNear(collage, 1 / 3);
    await expect(collage).toHaveScreenshot("collage.png", SCREENSHOT);

    const outPath = await downloadCollage(
      page,
      `${testInfo.project.name}-vertical-download.png`
    );
    const stats = analyzePng(outPath);
    expect(stats.width).toBe(1200);
    expect(stats.height).toBe(3600);
    expect(stats.aspect).toBeCloseTo(1 / 3, 2);
    expect(stats.opaqueRatio).toBeGreaterThan(0.9);
    expect(pngHasTestPhotoBands(outPath)).toBe(true);
  });

  test("mobile: download falls back when share rejects", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "phone-only share fallback");

    await startSoloBooth(page, "3-Up Top");
    await takePhotos(page, 3);
    await page.getByRole("button", { name: "View collage" }).click();
    await expect(page).toHaveURL(/\/solo\/collage/);

    await page.evaluate(() => {
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
    });

    const outPath = await downloadCollage(
      page,
      `${testInfo.project.name}-share-fallback.png`
    );
    const stats = analyzePng(outPath);
    expect(stats.width).toBe(1200);
    expect(stats.height).toBe(3600);
    expect(stats.opaqueRatio).toBeGreaterThan(0.9);
    expect(pngHasTestPhotoBands(outPath)).toBe(true);
  });

  test("mobile: 4-Up Wide preview and download", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "phone-only horizontal layout");

    await startSoloBooth(page, "4-Up Wide");
    await takePhotos(page, 4);

    const cameraStrip = page.locator("[data-strip-preview]").first();
    await expect(cameraStrip).toBeVisible();
    await assertAspectNear(cameraStrip, 3 / 1);

    await page.getByRole("button", { name: "View collage" }).click();
    await expect(page).toHaveURL(/\/solo\/collage/);

    const collage = page.locator("#collage-export");
    await expect(collage).toBeVisible();
    await expect(collage.locator("img").first()).toBeVisible();
    await assertAspectNear(collage, 3 / 1);
    await expect(collage).toHaveScreenshot("collage-wide.png", SCREENSHOT);

    const outPath = await downloadCollage(
      page,
      `${testInfo.project.name}-horizontal-download.png`
    );
    const stats = analyzePng(outPath);
    expect(stats.width).toBe(3600);
    expect(stats.height).toBe(1200);
    expect(stats.aspect).toBeCloseTo(3 / 1, 2);
    expect(stats.opaqueRatio).toBeGreaterThan(0.9);
    expect(pngHasTestPhotoBands(outPath)).toBe(true);
  });
});
