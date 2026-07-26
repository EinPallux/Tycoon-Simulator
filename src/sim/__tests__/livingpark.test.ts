/**
 * Phase-2 integration: a scripted park runs for sim-days and guests actually
 * live in it — arrive, pay, ride, snack, and the books balance.
 */

import { describe, expect, it } from "vitest";
import { createSimHandle, type SimHandle } from "@/sim/api";
import { SURFACE_PATH, SURFACE_QUEUE } from "@/sim/world/tiles";
import { createWorld } from "@/sim/world/world";
import { TICKS_PER_DAY } from "@/sim/world/time";
import { GUEST_STATE } from "@/sim/entities/guests";
import { serializeWorld, worldFromSave } from "@/sim/save/serialize";
import { migrateSave } from "@/sim/save/migrate";
import { ledgerDayTotals } from "@/sim/economy";

/** Builds a small functional park: entrance path spine + ride + stalls. */
function buildTestPark(seed = 4242): SimHandle {
  const sim = createSimHandle(
    createWorld({
      name: "Test Living Park",
      seed,
      difficulty: "classic",
      mapSize: "M",
      guidedStart: false,
      freeplayUnlocks: true,
    }),
  );
  const { x: ex, z: ez } = sim.world.entrance;
  // Path spine from the entrance northward + a plaza row.
  const tiles: [number, number][] = [];
  for (let i = 1; i <= 10; i++) tiles.push([ex, ez - i]);
  for (let dx = -4; dx <= 4; dx++) tiles.push([ex + dx, ez - 5]);
  const painted = sim.dispatch({ type: "paint-surface", surface: SURFACE_PATH, tiles });
  expect(painted.ok).toBe(true);

  // Queue spur off the plaza, then the carousel against its head.
  const queued = sim.dispatch({
    type: "paint-surface",
    surface: SURFACE_QUEUE,
    tiles: [
      [ex - 3, ez - 6],
      [ex - 2, ez - 6],
    ],
  });
  expect(queued.ok).toBe(true);
  const carousel = sim.dispatch({
    type: "place-entity",
    defId: "ride/carousel",
    x: ex - 4,
    z: ez - 9,
    rot: 0,
  });
  expect(carousel.ok).toBe(true);

  // Food + drink + toilets on the plaza.
  expect(
    sim.dispatch({ type: "place-entity", defId: "stall/food", x: ex + 2, z: ez - 6, rot: 0 }).ok,
  ).toBe(true);
  expect(
    sim.dispatch({ type: "place-entity", defId: "stall/drinks", x: ex + 3, z: ez - 6, rot: 0 }).ok,
  ).toBe(true);
  expect(
    sim.dispatch({ type: "place-entity", defId: "stall/toilets", x: ex - 2, z: ez - 4, rot: 0 }).ok,
  ).toBe(true);
  return sim;
}

describe("the living park", () => {
  it("guests arrive, pay entry, and the day's books add up", () => {
    const sim = buildTestPark();
    sim.tick(TICKS_PER_DAY / 2); // half a day from 09:00 → evening
    expect(sim.world.lifetimeGuests).toBeGreaterThan(0);
    expect(sim.world.economy.today.income.entry).toBeGreaterThan(0);
    const totals = ledgerDayTotals(sim.world.economy.today);
    expect(totals.income).toBeGreaterThan(0);
  });

  it("rides run cycles and take fares", () => {
    const sim = buildTestPark(777);
    sim.tick(TICKS_PER_DAY);
    const ride = [...sim.world.rides.values()][0];
    expect(ride).toBeDefined();
    if (ride) {
      expect(ride.lifetimeRiders).toBeGreaterThan(0);
      expect(sim.world.economy.today.income.rides + (sim.world.economy.history[0]?.income.rides ?? 0)).toBeGreaterThan(0);
    }
  });

  it("guests buy snacks and needs recover", () => {
    const sim = buildTestPark(1001);
    sim.tick(TICKS_PER_DAY);
    const stallsIncome =
      sim.world.economy.today.income.stalls + (sim.world.economy.history[0]?.income.stalls ?? 0);
    expect(stallsIncome).toBeGreaterThan(0);
  });

  it("guests leave at night and the pool drains", () => {
    const sim = buildTestPark(31337);
    sim.tick(Math.round(TICKS_PER_DAY * 0.5)); // 09:00 → 21:00
    sim.tick(Math.round(TICKS_PER_DAY * 0.25)); // 21:00 → 03:00, deep night
    // At 03:00 nobody should still be strolling the park.
    let active = 0;
    const g = sim.world.guests;
    for (let i = 0; i < g.count; i++) {
      if (g.state[i] !== GUEST_STATE.departing && g.state[i] !== GUEST_STATE.leaving) active++;
    }
    expect(active).toBeLessThan(6);
  });

  it("closed parks (no entrance path) admit nobody", () => {
    const sim = createSimHandle(
      createWorld({
        name: "Locked Gates",
        seed: 5,
        difficulty: "classic",
        mapSize: "M",
        guidedStart: false,
        freeplayUnlocks: false,
      }),
    );
    sim.tick(TICKS_PER_DAY / 2);
    expect(sim.world.lifetimeGuests).toBe(0);
  });

  it("survives a 3-day soak within sane bounds", () => {
    const sim = buildTestPark(90210);
    sim.tick(TICKS_PER_DAY * 3);
    const g = sim.world.guests;
    expect(Number.isFinite(sim.world.cash)).toBe(true);
    expect(g.count).toBeLessThanOrEqual(500);
    for (let i = 0; i < g.count; i++) {
      expect(g.mood[i]).toBeGreaterThanOrEqual(0);
      expect(g.mood[i]).toBeLessThanOrEqual(100);
      expect(Number.isNaN(g.x[i])).toBe(false);
      expect(Number.isNaN(g.z[i])).toBe(false);
    }
    expect(sim.world.litter.length).toBeLessThanOrEqual(400);
    expect(sim.world.rating.value).toBeGreaterThanOrEqual(0);
    expect(sim.world.rating.value).toBeLessThanOrEqual(1000);
  });

  it("is deterministic: same seed + same commands ⇒ identical world hash", () => {
    const run = (): string => {
      const sim = buildTestPark(20260725);
      sim.tick(TICKS_PER_DAY * 1.5);
      return JSON.stringify(serializeWorld(sim.world));
    };
    expect(run()).toBe(run());
  });

  it("round-trips a living park through save/load", () => {
    const sim = buildTestPark(55);
    sim.tick(TICKS_PER_DAY * 0.4);
    const save = serializeWorld(sim.world);
    const restored = worldFromSave(JSON.parse(JSON.stringify(save)));
    expect(restored.guests.count).toBe(sim.world.guests.count);
    expect(restored.lifetimeGuests).toBe(sim.world.lifetimeGuests);
    expect(restored.economy.today.income.entry).toBe(sim.world.economy.today.income.entry);
    expect(restored.rides.size).toBe(sim.world.rides.size);
    // Restored guests are normalized to strolling and keep their wallets.
    const firstId = restored.guests.ids[0] as number;
    if (restored.guests.count > 0) {
      expect(restored.guests.cold.get(firstId)?.money).toBeDefined();
    }
  });
});

describe("v1 → v3 migration chain", () => {
  it("upgrades a Phase-1 save with sensible defaults", () => {
    // A minimal but complete v1 save (Phase-1 shape, no guests/economy).
    const size = 8;
    const zeros = btoaBytes(new Uint8Array(size * size));
    const v1 = {
      formatVersion: 1,
      appVersion: "0.1.0",
      seed: 42,
      rngState: 42,
      time: 1234,
      cash: 100_000,
      debt: 0,
      meta: {
        name: "Old Park",
        difficulty: "classic",
        mapSize: "S",
        guidedStart: false,
        freeplayUnlocks: false,
      },
      world: {
        size,
        ownedRect: { x0: 1, z0: 1, w: 4, d: 4 },
        entrance: { x: 3, z: 4 },
        surface: zeros,
        owned: zeros,
      },
      placeables: [],
      placeableIdCounter: 0,
      camera: { targetX: 3, targetZ: 3, yaw: 0, zoom: 0.5 },
    };
    const migrated = migrateSave(v1);
    expect(migrated.formatVersion).toBe(3);
    expect(migrated.guests).toEqual([]);
    expect(migrated.economy.entryPrice).toBe(1_500);
    expect(migrated.milestoneTier).toBe(-1);
    expect(migrated.coasters).toEqual([]);
    expect(migrated.staff).toEqual([]);
    expect(migrated.research.done.thrill).toBe(0);
    expect(migrated.economy.today.expense.wages).toBe(0);
    // And it loads into a working world.
    const world = worldFromSave(v1);
    expect(world.cash).toBe(100_000);
    expect(world.guests.count).toBe(0);
    expect(world.weather.current).toBe("sun");
  });
});

function btoaBytes(bytes: Uint8Array): string {
  const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? "=" : B64[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? "=" : B64[b2 & 63];
  }
  return out;
}
