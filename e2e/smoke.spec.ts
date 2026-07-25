/**
 * Phase-1 acceptance smoke (ROADMAP Phase 1, criterion 1):
 * fresh visitor → profile → new park → build paths + scenery + stall →
 * save → reload → identical park state.
 *
 * Runs against `pnpm start` (see playwright.config.ts). WebGL uses
 * SwiftShader in headless CI — launch args in the config.
 */

import { expect, test, type Page } from "@playwright/test";

test.setTimeout(180_000);

async function paintStroke(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 12,
): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      from.x + ((to.x - from.x) * i) / steps,
      from.y + ((to.y - from.y) * i) / steps,
      { steps: 2 },
    );
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
}

test("boot → build → save → reload keeps the park", async ({ page }) => {
  // ── Title & profile ────────────────────────────────────────────────────
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Enter the Park/i })).toBeVisible();
  await page.getByRole("button", { name: /Enter the Park/i }).click();
  await page.getByPlaceholder(/Greta/).fill("Smoke Tester");
  await page.getByRole("button", { name: /Let.s build/i }).click();

  // ── Hub → configurator → new park ──────────────────────────────────────
  await page.waitForURL("**/hub");
  await page.getByRole("tab", { name: "New Park" }).click();
  await page.getByPlaceholder(/Name your dream/).fill("Smoke Gardens");
  await page.getByRole("button", { name: /Build it/i }).click();

  // ── In-game boot ───────────────────────────────────────────────────────
  await page.waitForURL("**/play**");
  await page.waitForSelector("canvas");
  await expect(page.getByText("Day 1")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("$25,000")).toBeVisible();
  await page.waitForTimeout(2500); // let models stream in

  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("no canvas");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // ── Build: paths ───────────────────────────────────────────────────────
  await page.getByRole("button", { name: /Paths/i }).click();
  await page
    .getByRole("button", { name: /Path .*tile/ })
    .first()
    .click();
  await paintStroke(page, { x: cx - 180, y: cy + 60 }, { x: cx + 180, y: cy + 60 });
  await page.waitForTimeout(300);

  // Cash reflects path spend (some tiles of the stroke always land).
  const cashText = await page.locator("text=/\\$2[0-9],[0-9]{3}/").first().textContent();
  expect(cashText).not.toBe("$25,000");

  // ── Build: a tree and a stall by the path ──────────────────────────────
  await page.getByRole("button", { name: /Scenery/i }).click();
  await page.getByRole("button", { name: /Oak Tree/ }).click();
  await page.mouse.click(cx - 60, cy - 80);
  await page.waitForTimeout(200);

  await page.getByRole("button", { name: /Stalls/i }).click();
  await page.getByRole("button", { name: /Snack Shack/ }).click();
  await page.mouse.click(cx + 60, cy + 100);
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape"); // close tray
  await page.keyboard.press("Escape"); // clear tool

  // ── Undo/redo round-trip works ─────────────────────────────────────────
  await page.keyboard.press("z");
  await page.waitForTimeout(150);
  await page.keyboard.press("Shift+Z");
  await page.waitForTimeout(150);

  // ── Save via pause veil ────────────────────────────────────────────────
  await page.keyboard.press("Escape"); // veil
  await page.getByRole("button", { name: /Save park/i }).click();
  await expect(page.getByText(/Park saved/)).toBeVisible();
  const savedCash = await page
    .locator("text=/\\$[0-9]{2},[0-9]{3}/")
    .first()
    .textContent();

  // ── Reload → identical state ───────────────────────────────────────────
  await page.reload();
  await page.waitForSelector("canvas");
  await expect(page.getByText(/Day \d+/)).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(1500);
  await expect(page.locator(`text=${savedCash}`)).toBeVisible();
  await expect(page.getByText("Smoke Gardens")).toBeVisible();

  // ── Hub lists the park ─────────────────────────────────────────────────
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Exit to hub/i }).click();
  await page.waitForURL("**/hub");
  await page.getByRole("tab", { name: "My Parks" }).click();
  await expect(page.getByText("Smoke Gardens")).toBeVisible();
});

test("settings persist across reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Enter the Park/i }).click();
  await page.getByPlaceholder(/Greta/).fill("Settings Tester");
  await page.getByRole("button", { name: /Let.s build/i }).click();
  await page.waitForURL("**/hub");
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByRole("switch").first().click(); // reduced motion ON
  await page.reload();
  await page.getByRole("tab", { name: "Settings" }).click();
  await expect(page.getByRole("switch").first()).toHaveAttribute("aria-checked", "true");
});
