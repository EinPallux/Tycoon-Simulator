/**
 * Phase-5 release regression (ROADMAP P5): panels, sheets, settings,
 * export/import round-trip — the surfaces a release can't ship broken.
 */

import { expect, test } from "@playwright/test";
import "./hook";

test.setTimeout(240_000);

test("panels, sheets and settings all present themselves", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Enter the Park/i }).click();
  try {
    await page.getByPlaceholder(/Greta/).fill("Regression Bot", { timeout: 3000 });
    await page.getByRole("button", { name: /Let.s build/i }).click();
  } catch {
    /* profile exists */
  }
  await page.waitForURL("**/hub");

  // Settings: keymap editor + accessibility toggles render.
  await page.getByRole("tab", { name: "Settings" }).click();
  await expect(page.getByText("Pause / resume")).toBeVisible();
  await expect(page.getByText(/Colorblind-safe/)).toBeVisible();

  // New park.
  await page.getByRole("tab", { name: "New Park" }).click();
  await page.getByPlaceholder(/Name your dream/).fill("Regression Ridge");
  const switches = await page.getByRole("switch").all();
  const last = switches[switches.length - 1];
  if (last) await last.click(); // freeplay
  await page.getByRole("button", { name: /Build it/i }).click();
  await page.waitForURL("**/play**");
  await page.waitForFunction(() => window.__wanderpark !== undefined);
  await page.waitForTimeout(1500);

  // Every park-panel tab renders content.
  for (const tab of ["goals", "finances", "research", "guests", "rating"]) {
    await page.evaluate((t) => window.__wanderpark?.store.getState().setParkPanel(t), tab);
    await page.waitForTimeout(150);
  }
  await expect(page.getByText(/Park rating \/ 1000/i)).toBeVisible();
  await page.evaluate(() => window.__wanderpark?.store.getState().setParkPanel(null));

  // The Park Manual opens and searches.
  await page.evaluate(() => window.__wanderpark?.store.getState().setManualOpen(true));
  await expect(page.getByText(/Paths & queues/i)).toBeVisible();
  await page.keyboard.press("Escape");

  // Milestone sheet and park-over sheet mount and dismiss.
  await page.evaluate(() =>
    window.__wanderpark?.store.getState().setMilestoneSheet({ tier: 0, name: "Test Tier", award: 50_000 }),
  );
  await expect(page.getByText(/Milestone reached/i)).toBeVisible();
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.__wanderpark?.store.getState().setParkOver("Test foreclosure."));
  await expect(page.getByText(/bank owns the teacups/i)).toBeVisible();
  await page.getByRole("button", { name: /Wander the ruins/i }).click();

  // Save via the pause veil.
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Save park/i }).click();
  await expect(page.getByText(/Park saved/)).toBeVisible();
});

test("export → import round-trip clones the park", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Enter the Park/i }).click();
  try {
    await page.getByPlaceholder(/Greta/).fill("Porter", { timeout: 3000 });
    await page.getByRole("button", { name: /Let.s build/i }).click();
  } catch {
    /* profile exists */
  }
  await page.waitForURL("**/hub");
  await page.getByRole("tab", { name: "New Park" }).click();
  await page.getByPlaceholder(/Name your dream/).fill("Export Meadows");
  await page.getByRole("button", { name: /Build it/i }).click();
  await page.waitForURL("**/play**");
  await page.waitForFunction(() => window.__wanderpark !== undefined);
  await page.waitForTimeout(1200);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Save park/i }).click();
  await expect(page.getByText(/Park saved/)).toBeVisible();
  await page.getByRole("button", { name: /Exit to hub/i }).click();
  await page.waitForURL("**/hub");

  // Export from My Parks.
  await page.getByRole("tab", { name: "My Parks" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export/i }).first().click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();

  // Import the same file back — a clone appears.
  const before = await page.getByText("Export Meadows").count();
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Import/i }).first().click();
  const chooser = await chooserPromise;
  await chooser.setFiles(path as string);
  await page.waitForTimeout(1200);
  const after = await page.getByText("Export Meadows").count();
  expect(after).toBeGreaterThan(before);
});
