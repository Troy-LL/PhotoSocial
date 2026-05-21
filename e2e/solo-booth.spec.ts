import { test, expect } from "@playwright/test";

test("capture, retake a slot, and export collage", async ({ page }) => {
  await page.goto("/solo");

  await page.getByRole("button", { name: "3-Up Top", exact: true }).click();
  await page.getByRole("button", { name: "Start booth" }).click();
  await expect(page).toHaveURL(/\/solo\/camera/);

  await page.getByRole("radio", { name: "Tap each" }).click();

  async function takeOnePhoto() {
    await page.getByRole("button", { name: "Take Photo" }).click();
    await page.waitForTimeout(3500);
  }

  await takeOnePhoto();
  await expect(page.getByRole("status")).toContainText("Photo 2 of 3", {
    timeout: 10_000,
  });

  await page.getByRole("button", { name: "Photo 1 options" }).click();
  await page.getByRole("button", { name: "Retake" }).click();
  await expect(page.getByRole("status")).toContainText("Photo 1 of 3", {
    timeout: 10_000,
  });

  await takeOnePhoto();
  await takeOnePhoto();
  await takeOnePhoto();

  await expect(page.getByRole("status")).toContainText(
    "All photos are in — tap a slot to retake",
    { timeout: 15_000 }
  );

  await page.getByRole("button", { name: "View collage" }).click();
  await expect(page).toHaveURL(/\/solo\/collage/);
  await expect(page.getByRole("heading", { name: "Your strip is ready!" })).toBeVisible();

  await page.evaluate(() => {
    (navigator as Navigator & { canShare?: (data: unknown) => boolean }).canShare =
      () => false;
  });

  const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
  await page.getByRole("button", { name: "Download" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/PhotoSocial-solo\.png$/);
});
