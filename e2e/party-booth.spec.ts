import { test, expect, type Browser, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { PNG } from "pngjs";

const ARTIFACT_DIR = path.join(process.cwd(), "test-results", "party-audit");

async function disableShare(page: Page) {
  await page.evaluate(() => {
    (navigator as Navigator & { canShare?: (data: unknown) => boolean }).canShare =
      () => false;
  });
}

async function createHostParty(page: Page, layoutLabel: string) {
  await page.goto("/create");
  await page.getByPlaceholder("Maya").fill("Host Alex");
  await page.getByRole("button", { name: layoutLabel, exact: true }).click();
  await page.getByRole("button", { name: "Create Booth" }).click();
  await page.waitForURL(/\/lobby/);
  const codeText = await page.locator('[class*="code"]').first().textContent();
  const match = codeText?.match(/[A-Z]+-\d{4}/);
  expect(match).toBeTruthy();
  return match![0]!;
}

async function assignParticipantToSlot(
  page: Page,
  participantName: string,
  slotIndex: number
) {
  await page.getByRole("button", { name: participantName, exact: true }).click();
  const slot = page.getByLabel(`Empty slot ${slotIndex + 1}`);
  await slot.click();
  await expect(
    page.getByLabel(new RegExp(`Waiting for ${participantName}|${participantName}`))
  ).toBeVisible({ timeout: 10_000 });
}

async function takePhoto(page: Page) {
  await page.getByRole("radio", { name: "Tap each" }).click().catch(() => undefined);
  await page.getByRole("button", { name: "Take Photo" }).click();
  await page.waitForTimeout(3500);
}

test.describe("party booth capture + download", () => {
  test("host + guest fill strip, lock, download", async ({
    browser,
  }: {
    browser: Browser;
  }) => {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

    const hostContext = await browser.newContext({
      permissions: ["camera"],
    });
    const guestContext = await browser.newContext({
      permissions: ["camera"],
    });
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    const code = await createHostParty(hostPage, "3-Up Top");
    const [word, num] = code.split("-");

    await guestPage.goto("/join");
    await guestPage.getByPlaceholder("PINE").fill(word!);
    await guestPage.getByPlaceholder("7842").fill(num!);
    await guestPage.getByPlaceholder("Maya").fill("Guest Maya");
    await guestPage.getByRole("button", { name: "Enter the Party" }).click();
    await guestPage.waitForURL(/\/lobby/);
    await expect(guestPage.getByText("Guest Maya")).toBeVisible();

    await hostPage.getByRole("link", { name: "Assign Slots" }).click();
    await hostPage.waitForURL(/\/assign/);
    await expect(hostPage.getByRole("heading", { name: "Assign Slots" })).toBeVisible();

    await assignParticipantToSlot(hostPage, "Guest Maya", 0);
    await assignParticipantToSlot(hostPage, "Host Alex", 1);
    await assignParticipantToSlot(hostPage, "Host Alex", 2);

    await guestPage.waitForURL(/\/camera/, { timeout: 20_000 });
    await takePhoto(guestPage);

    await hostPage.goto(`/party/${code}/camera`);
    await takePhoto(hostPage);
    await takePhoto(hostPage);

    await hostPage.goto(`/party/${code}/collage`);
    await expect(hostPage.getByText(/3\s*\/\s*3/)).toBeVisible({ timeout: 15_000 });
    await hostPage.getByRole("button", { name: "Lock collage" }).click();
    await hostPage.waitForURL(/\/export/);

    await disableShare(hostPage);
    const downloadPromise = hostPage.waitForEvent("download", { timeout: 60_000 });
    await hostPage.getByRole("button", { name: "Download" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(new RegExp(`PhotoSocial-${code}\\.png`));

    const outPath = path.join(ARTIFACT_DIR, "party-strip3Top-download.png");
    await download.saveAs(outPath);
    const png = PNG.sync.read(fs.readFileSync(outPath));
    expect(png.width / png.height).toBeCloseTo(1 / 3, 1);
    expect(png.width).toBeGreaterThanOrEqual(1100);

    let opaque = 0;
    for (let i = 0; i < png.data.length; i += 4) {
      if (png.data[i + 3]! > 8) opaque++;
    }
    expect(opaque / (png.width * png.height)).toBeGreaterThan(0.9);

    await hostPage.screenshot({
      path: path.join(ARTIFACT_DIR, "party-export-ui.png"),
      fullPage: true,
    });

    await hostContext.close();
    await guestContext.close();
  });
});
