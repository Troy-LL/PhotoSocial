import { test, expect } from "@playwright/test";

test.describe("PassAndPic party flow", () => {
  test("landing page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "PassAndPic" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create Party" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Join Party" })).toBeVisible();
  });

  test("host creates party and sees lobby", async ({ page }) => {
    await page.goto("/create");
    await page.getByPlaceholder("Maya").fill("Host Alex");
    await page.getByRole("button", { name: "Squad" }).click();
    await page.getByRole("button", { name: "Create Party" }).click();

    await expect(page).toHaveURL(/\/party\/[A-Z]+-\d{4}\/lobby/);
    await expect(page.getByText(/[A-Z]+-\d{4}/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Assign Slots" })).toBeVisible();
  });

  test("invalid party code shows error", async ({ page }) => {
    await page.goto("/join");
    await page.getByPlaceholder("PINE").fill("BAD");
    await page.getByPlaceholder("7842").fill("000");
    await page.getByPlaceholder("Maya").fill("Guest");
    await page.getByRole("button", { name: "Enter the Party" }).click();
    await expect(page.getByText(/not found|Invalid/i)).toBeVisible();
  });

  test("host and guest join flow", async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    await hostPage.goto("/create");
    await hostPage.getByPlaceholder("Maya").fill("Host");
    await hostPage.getByRole("button", { name: "Duo" }).click();
    await hostPage.getByRole("button", { name: "Create Party", exact: true }).click();
    await hostPage.waitForURL(/\/lobby/);

    const codeText = await hostPage.locator('[class*="code"]').first().textContent();
    const match = codeText?.match(/[A-Z]+-\d{4}/);
    expect(match).toBeTruthy();
    const partyCode = match![0];
    const [word, num] = partyCode.split("-");

    await guestPage.goto("/join");
    await guestPage.getByPlaceholder("PINE").fill(word!);
    await guestPage.getByPlaceholder("7842").fill(num!);
    await guestPage.getByPlaceholder("Maya").fill("Guest");
    await guestPage.getByRole("button", { name: "Enter the Party" }).click();
    await guestPage.waitForURL(/\/lobby/);

    await expect(guestPage.getByText("Guest")).toBeVisible();
    await hostPage.getByRole("link", { name: "Assign Slots" }).click();

    await hostPage.waitForURL(/\/assign/);
    await expect(hostPage.getByText("Participants")).toBeVisible();

    await hostContext.close();
    await guestContext.close();
  });
});
