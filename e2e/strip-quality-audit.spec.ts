/**
 * End-to-end quality audit: routing, captures, downloads, and strip proportions.
 * Runs with fake camera under solo-mobile (and chromium with fake-device args).
 */
import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { analyzePng } from "./helpers/png-analyze";

const ARTIFACT_DIR = path.join(process.cwd(), "test-results", "strip-audit");

type LayoutChoice = {
  label: string;
  buttonName: string;
  orientation: "vertical" | "horizontal";
  slotCount: number;
  expectedAspect: number; // width / height
};

const LAYOUTS: LayoutChoice[] = [
  {
    label: "strip4",
    buttonName: "4-Up",
    orientation: "vertical",
    slotCount: 4,
    expectedAspect: 1 / 3,
  },
  {
    label: "strip3Top",
    buttonName: "3-Up Top",
    orientation: "vertical",
    slotCount: 3,
    expectedAspect: 1 / 3,
  },
  {
    label: "strip4H",
    buttonName: "4-Up Wide",
    orientation: "horizontal",
    slotCount: 4,
    expectedAspect: 3 / 1,
  },
  {
    label: "strip3CenterH",
    buttonName: "3-Up Center Wide",
    orientation: "horizontal",
    slotCount: 3,
    expectedAspect: 3 / 1,
  },
];

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

async function disableShare(page: Page) {
  await page.evaluate(() => {
    (navigator as Navigator & { canShare?: (data: unknown) => boolean }).canShare =
      () => false;
  });
}

async function takePhotos(page: Page, count: number) {
  await page.getByRole("radio", { name: "Tap each" }).click();
  for (let i = 0; i < count; i++) {
    await page.getByRole("button", { name: "Take Photo" }).click();
    await page.waitForTimeout(3500);
  }
  await expect(
    page.getByText("All photos are in — tap a slot to retake", { exact: true })
  ).toBeVisible({ timeout: 20_000 });
}

async function measureStripDom(page: Page) {
  return page.evaluate(() => {
    const grid = document.getElementById("collage-export");
    if (!grid) return null;
    const gridRect = grid.getBoundingClientRect();
    const pad = grid.querySelector("[data-strip-pad]") as HTMLElement | null;
    const style = getComputedStyle(pad ?? grid);
    const slotEls = pad
      ? Array.from(pad.children)
      : Array.from(grid.children);
    const slotMetrics = slotEls.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        w: Math.round(r.width),
        h: Math.round(r.height),
        aspect: r.width / Math.max(1, r.height),
        left: Math.round(r.left - gridRect.left),
        top: Math.round(r.top - gridRect.top),
      };
    });
    return {
      gridW: Math.round(gridRect.width),
      gridH: Math.round(gridRect.height),
      gridAspect: gridRect.width / Math.max(1, gridRect.height),
      padding: style.padding,
      gap: style.gap || style.rowGap,
      borderRadius: getComputedStyle(grid).borderRadius,
      slotCount: slotMetrics.length,
      slots: slotMetrics,
      padRatioX:
        slotMetrics.length > 0
          ? Math.min(...slotMetrics.map((s) => s.left)) / gridRect.width
          : 0,
      padRatioY:
        slotMetrics.length > 0
          ? Math.min(...slotMetrics.map((s) => s.top)) / gridRect.height
          : 0,
    };
  });
}

test.describe("strip quality audit", () => {
  test.beforeAll(() => {
    ensureDir(ARTIFACT_DIR);
  });

  for (const layout of LAYOUTS) {
    test(`solo ${layout.label}: capture → download → proportions`, async ({
      page,
    }) => {
      await page.goto("/solo");
      await page
        .getByRole("button", { name: layout.buttonName, exact: true })
        .click();
      await page.getByRole("button", { name: "Start booth" }).click();
      await expect(page).toHaveURL(/\/solo\/camera/);

      await takePhotos(page, layout.slotCount);
      await page.getByRole("button", { name: "View collage" }).click();
      await expect(page).toHaveURL(/\/solo\/collage/);
      await expect(
        page.getByRole("heading", { name: "Your strip is ready!" })
      ).toBeVisible();

      const dom = await measureStripDom(page);
      expect(dom).toBeTruthy();
      expect(dom!.slotCount).toBe(layout.slotCount);
      expect(dom!.gridAspect).toBeCloseTo(layout.expectedAspect, 1);

      // Photobooth strips need visible outer margin (not a razor-thin edge).
      const padRatio =
        layout.orientation === "vertical" ? dom!.padRatioX : dom!.padRatioY;
      fs.writeFileSync(
        path.join(ARTIFACT_DIR, `${layout.label}-dom.json`),
        JSON.stringify({ layout, dom }, null, 2)
      );

      await page.screenshot({
        path: path.join(ARTIFACT_DIR, `${layout.label}-collage.png`),
        fullPage: true,
      });

      await disableShare(page);
      const downloadPromise = page.waitForEvent("download", { timeout: 45_000 });
      await page.getByRole("button", { name: "Download" }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/PhotoSocial-solo\.png$/);

      const outPath = path.join(ARTIFACT_DIR, `${layout.label}-download.png`);
      await download.saveAs(outPath);

      const stats = analyzePng(outPath);
      fs.writeFileSync(
        path.join(ARTIFACT_DIR, `${layout.label}-png.json`),
        JSON.stringify({ layout, stats, padRatio }, null, 2)
      );

      // Must not be blank
      expect(stats.opaqueRatio).toBeGreaterThan(0.9);
      expect(stats.distinctColors).toBeGreaterThan(20);
      // Aspect within ~3% of expected strip ratio
      expect(stats.aspect).toBeCloseTo(layout.expectedAspect, 1);
      // Export should be print-friendly resolution (1200×3600 or 3600×1200)
      if (layout.orientation === "vertical") {
        expect(stats.width).toBeGreaterThanOrEqual(1100);
        expect(stats.height).toBeGreaterThanOrEqual(3300);
      } else {
        expect(stats.width).toBeGreaterThanOrEqual(3300);
        expect(stats.height).toBeGreaterThanOrEqual(1100);
      }
      // Real photobooth strips have a meaningful white/theme frame
      expect(stats.whiteRatio).toBeGreaterThan(0.04);

      // Outer margin ~classic booth border (≥4.5% of short side)
      expect(padRatio).toBeGreaterThanOrEqual(0.045);
    });
  }

  test("routing: landing → solo → back home", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "PhotoSocial" })).toBeVisible();
    await page.getByRole("link", { name: "Solo Booth" }).click();
    await expect(page).toHaveURL(/\/solo/);
    await page.goto("/");
    await page.getByRole("link", { name: "Create Booth" }).click();
    await expect(page).toHaveURL(/\/create/);
    await page.goto("/");
    await page.getByRole("link", { name: "Join Booth" }).click();
    await expect(page).toHaveURL(/\/join/);
  });

  test("solo camera guard redirects without session", async ({ page }) => {
    await page.goto("/solo/camera");
    await expect(page).toHaveURL(/\/solo\/?$/);
    await page.goto("/solo/collage");
    await expect(page).toHaveURL(/\/solo\/?$/);
  });
});
