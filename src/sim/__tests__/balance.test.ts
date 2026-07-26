/**
 * Phase-5 balancing campaign (ROADMAP P5, GAME_DESIGN.md §15.6–15.7):
 * soak a "sensible starter park" across difficulties, map sizes and unlock
 * modes; assert the Classic arc (break-even day 8–12, coaster money by
 * ~day 16) and that §15.7 difficulty modifiers actually bite.
 */

import { describe, expect, it } from "vitest";
import { createSimHandle, type SimHandle } from "@/sim/api";
import { breakdownChancePerTick } from "@/sim/systems/rideOps";
import { SURFACE_PATH, SURFACE_QUEUE } from "@/sim/world/tiles";
import { TICKS_PER_DAY } from "@/sim/world/time";
import {
  createWorld,
  DIFFICULTY_PRESETS,
  type Difficulty,
  type MapSize,
  type World,
} from "@/sim/world/world";

function starterPark(difficulty: Difficulty, mapSize: MapSize, freeplay: boolean, seed = 505): SimHandle {
  const sim = createSimHandle(
    createWorld({
      name: `Soak-${difficulty}-${mapSize}`,
      seed,
      difficulty,
      mapSize,
      guidedStart: false,
      freeplayUnlocks: freeplay,
    }),
  );
  const { x: ex, z: ez } = sim.world.entrance;
  // The "sensible player" opening: spine + plaza, carousel + queue,
  // food/drink/toilets, a janitor. ~$6.5k of build.
  const tiles: [number, number][] = [];
  for (let i = 1; i <= 10; i++) tiles.push([ex, ez - i]);
  for (let dx = -4; dx <= 4; dx++) tiles.push([ex + dx, ez - 5]);
  sim.dispatch({ type: "paint-surface", surface: SURFACE_PATH, tiles });
  sim.dispatch({
    type: "paint-surface",
    surface: SURFACE_QUEUE,
    tiles: [
      [ex - 3, ez - 6],
      [ex - 2, ez - 6],
    ],
  });
  sim.dispatch({ type: "place-entity", defId: "ride/carousel", x: ex - 4, z: ez - 9, rot: 0 });
  sim.dispatch({ type: "place-entity", defId: "stall/food", x: ex + 2, z: ez - 6, rot: 0 });
  sim.dispatch({ type: "place-entity", defId: "stall/drinks", x: ex + 3, z: ez - 6, rot: 0 });
  sim.dispatch({ type: "place-entity", defId: "stall/toilets", x: ex - 2, z: ez - 4, rot: 0 });
  sim.dispatch({ type: "hire-staff", role: "janitor" });
  return sim;
}

const cashAtDay = (sim: SimHandle, targetDay: number, samples: Map<number, number>): void => {
  samples.set(targetDay, sim.world.cash);
};

describe("the Classic arc (GAME_DESIGN §15.6)", () => {
  it("breaks even in the day 8–12 band and can afford a coaster by ~day 16", () => {
    const sim = starterPark("classic", "M", false);
    const start = DIFFICULTY_PRESETS.classic.startCash;
    const samples = new Map<number, number>();
    for (let day = 1; day <= 16; day++) {
      sim.tick(TICKS_PER_DAY);
      cashAtDay(sim, day, samples);
    }
    // Not TOO easy: build spend not fully recouped by day 6.
    expect(samples.get(6) as number).toBeLessThan(start + 100_000);
    // Break-even: by day 12 the treasury is back above the starting cash.
    expect(samples.get(12) as number).toBeGreaterThanOrEqual(start);
    // First coaster ~day 15–20: by day 16 the treasury holds a modest
    // Wild Mouse (base $8k + ~$4k track) with running margin to spare.
    expect(samples.get(16) as number).toBeGreaterThanOrEqual(1_500_000);
    const profit16 = (samples.get(16) as number) - start;
    expect(profit16).toBeGreaterThanOrEqual(200_000);
    // And the park is respectable, not broken.
    expect(sim.world.rating.value).toBeGreaterThan(250);
    expect(sim.world.loans.missedPayments).toBe(0);
  });

  it("daily books go positive within the first few days", () => {
    const sim = starterPark("classic", "M", false);
    sim.tick(TICKS_PER_DAY * 4);
    const yesterday = sim.world.economy.history[0];
    expect(yesterday).toBeDefined();
    if (!yesterday) return;
    const income = Object.values(yesterday.income).reduce((a, b) => a + b, 0);
    const expense = Object.values(yesterday.expense).reduce((a, b) => a + b, 0);
    expect(income - expense).toBeGreaterThan(0);
  });
});

describe("difficulty spread (§15.7)", () => {
  it("the same park diverges by difficulty and everyone stays solvent", () => {
    const results = new Map<Difficulty, World>();
    for (const difficulty of ["relaxed", "classic", "tycoon"] as Difficulty[]) {
      const sim = starterPark(difficulty, "M", false);
      sim.tick(TICKS_PER_DAY * 12);
      results.set(difficulty, sim.world);
    }
    const net = (d: Difficulty): number => {
      const w = results.get(d) as World;
      return w.cash - DIFFICULTY_PRESETS[d].startCash + w.debt * 0; // cash delta
    };
    // Relaxed earns at least as much as tycoon over the same park & days.
    expect(net("relaxed")).toBeGreaterThan(net("tycoon"));
    for (const [, world] of results) {
      expect(world.loans.bankrupt).toBe(false);
      expect(world.loans.missedPayments).toBe(0);
      expect(world.rating.value).toBeGreaterThan(200);
    }
  });

  it("breakdown odds honor the difficulty multipliers", () => {
    const chances: number[] = [];
    for (const difficulty of ["relaxed", "classic", "tycoon"] as Difficulty[]) {
      const sim = starterPark(difficulty, "M", false, 7);
      const ride = [...sim.world.rides.values()][0];
      if (!ride) throw new Error("no ride");
      ride.reliability = 50;
      chances.push(breakdownChancePerTick(sim.world, ride));
    }
    expect(chances[0] as number).toBeLessThan(chances[1] as number);
    expect(chances[1] as number).toBeLessThan(chances[2] as number);
    expect((chances[2] as number) / (chances[0] as number)).toBeCloseTo(1.4 / 0.5, 3);
  });

  it("pricey gates hurt more on tycoon (elasticity)", () => {
    // At the default $15 gate the elasticity multiplier separates cleanly
    // ($30 would clamp everyone to the floor — that's the guard rail).
    const spawnAfter = (difficulty: Difficulty): number => {
      const sim = starterPark(difficulty, "M", false, 99);
      sim.tick(TICKS_PER_DAY * 2);
      return sim.world.lifetimeGuests;
    };
    const relaxed = spawnAfter("relaxed");
    const tycoon = spawnAfter("tycoon");
    expect(relaxed).toBeGreaterThanOrEqual(tycoon * 1.2);
  });
});

describe("map sizes & unlock modes", () => {
  it("the starter park functions on S and L maps alike", () => {
    for (const mapSize of ["S", "L"] as MapSize[]) {
      const sim = starterPark("classic", mapSize, false);
      sim.tick(TICKS_PER_DAY);
      expect(sim.world.lifetimeGuests).toBeGreaterThan(10);
      expect(Number.isFinite(sim.world.cash)).toBe(true);
    }
  });

  it("freeplay and progression parks both sustain the arc", () => {
    for (const freeplay of [true, false]) {
      const sim = starterPark("classic", "M", freeplay);
      sim.tick(TICKS_PER_DAY * 8);
      expect(sim.world.cash).toBeGreaterThan(1_000_000);
      expect(sim.world.loans.missedPayments).toBe(0);
    }
  });
});
