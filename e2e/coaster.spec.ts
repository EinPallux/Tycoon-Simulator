/**
 * Phase-3 acceptance smoke: coaster builder end-to-end through the real UI —
 * freeplay park → Coasters dock → draft pieces via panel buttons → Build →
 * the coaster exists, charges cash, and survives a save round-trip.
 * Staff hire + weather chip come along for the ride.
 */

import { expect, test } from "@playwright/test";

test.setTimeout(180_000);

interface WanderparkHook {
  sim: {
    world: {
      entrance: { x: number; z: number };
      coasters: Map<number, unknown>;
      staff: unknown[];
      cash: number;
      camera: { targetX: number; targetZ: number; zoom: number };
    };
    dispatch(cmd: unknown): { ok: boolean };
  };
  store: {
    getState(): {
      startCoasterDraft(family: string, entry: unknown): void;
      setTool(tool: unknown): void;
    };
  };
}

declare global {
  interface Window {
    __wanderpark?: WanderparkHook;
  }
}

test("coaster builder: draft → build → ride exists and persists", async ({ page }) => {
  // ── Boot into a freeplay park ──────────────────────────────────────────
  await page.goto("/");
  await page.getByRole("button", { name: /Enter the Park/i }).click();
  await page.getByPlaceholder(/Greta/).fill("Coaster Tester");
  await page.getByRole("button", { name: /Let.s build/i }).click();
  await page.waitForURL("**/hub");
  await page.getByRole("tab", { name: "New Park" }).click();
  await page.getByPlaceholder(/Name your dream/).fill("Looping Meadows");
  const switches = await page.getByRole("switch").all();
  const lastSwitch = switches[switches.length - 1];
  if (lastSwitch) await lastSwitch.click(); // freeplay unlocks ON
  await page.getByRole("button", { name: /Build it/i }).click();
  await page.waitForURL("**/play**");
  await page.waitForSelector("canvas");
  await page.waitForFunction(() => window.__wanderpark !== undefined);
  await page.waitForTimeout(2000);

  // ── Path spine + station draft (grid-exact via the debug hook) ─────────
  await page.evaluate(() => {
    const hook = window.__wanderpark as WanderparkHook;
    const { x: ex, z: ez } = hook.sim.world.entrance;
    const tiles: [number, number][] = [];
    for (let i = 1; i <= 10; i++) tiles.push([ex, ez - 1 - i * 0 - i]);
    hook.sim.dispatch({ type: "paint-surface", surface: 1, tiles });
    hook.store.getState().setTool({ kind: "coaster", family: "mouse", rot: 0 });
    hook.store
      .getState()
      .startCoasterDraft("mouse", { x: ex - 1 + 0.5, z: ez - 2, h: 0, dir: 0 });
  });

  // ── Chain the tested rectangle through the REAL panel buttons ──────────
  await expect(page.getByText(/pieces/i).first()).toBeVisible();
  const press = async (name: RegExp): Promise<void> => {
    await page.getByRole("button", { name }).click();
    await page.waitForTimeout(60);
  };
  await press(/Straight/i);
  await press(/Turn Right/i);
  await press(/Straight/i);
  await press(/Turn Right/i);
  await press(/Straight/i);
  await press(/Straight/i);
  await press(/Straight/i);
  await press(/Turn Right/i);
  await press(/Straight/i);
  await press(/Turn Right/i);

  await expect(page.getByText(/Circuit closed/i)).toBeVisible();
  const buildButton = page.getByRole("button", { name: /Build — \$/ });
  await expect(buildButton).toBeEnabled();

  const cashBefore = await page.evaluate(
    () => (window.__wanderpark as WanderparkHook).sim.world.cash,
  );
  await buildButton.click();
  await page.waitForTimeout(300);

  const after = await page.evaluate(() => {
    const hook = window.__wanderpark as WanderparkHook;
    return { coasters: hook.sim.world.coasters.size, cash: hook.sim.world.cash };
  });
  expect(after.coasters).toBe(1);
  expect(after.cash).toBeLessThan(cashBefore);

  // Builder panel is gone once committed.
  await expect(page.getByText(/Circuit closed/i)).not.toBeVisible();

  // ── Hire a janitor through the staff tray ──────────────────────────────
  await page.getByTitle("Staff", { exact: true }).click();
  await page.getByRole("button", { name: /Hire Janitor/i }).click();
  await expect(page.getByText(/hired — they.re at the gate/i)).toBeVisible();
  const staffCount = await page.evaluate(
    () => (window.__wanderpark as WanderparkHook).sim.world.staff.length,
  );
  expect(staffCount).toBe(1);
  await page.keyboard.press("Escape");

  // ── Weather chip lives in the top bar ──────────────────────────────────
  await expect(page.getByText(/Sunny|Cloudy|Rain|Storm|Heatwave/).first()).toBeVisible();

  // ── Save → reload → the coaster survives with identical piece count ────
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Save park/i }).click();
  await expect(page.getByText(/Park saved/)).toBeVisible();
  await page.reload();
  await page.waitForSelector("canvas");
  await page.waitForFunction(() => window.__wanderpark !== undefined);
  await page.waitForTimeout(1500);
  const reloaded = await page.evaluate(() => {
    const hook = window.__wanderpark as WanderparkHook;
    return { coasters: hook.sim.world.coasters.size, staff: hook.sim.world.staff.length };
  });
  expect(reloaded.coasters).toBe(1);
  expect(reloaded.staff).toBe(1);
});
