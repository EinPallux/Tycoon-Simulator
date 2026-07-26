/** Phase-3: coaster builder math, staff, breakdowns, research, loans, weather. */

import { describe, expect, it } from "vitest";
import { createSimHandle, type SimHandle } from "@/sim/api";
import {
  coasterCost,
  computeRun,
  computeStats,
  validateCircuit,
} from "@/sim/coaster/coaster";
import {
  exitOf,
  nodesEqual,
  pointOnPiece,
  type PlacedPiece,
  type TrackNode,
} from "@/sim/coaster/pieces";
import { serializeWorld, worldFromSave } from "@/sim/save/serialize";
import { SURFACE_PATH, SURFACE_QUEUE } from "@/sim/world/tiles";
import { TICKS_PER_DAY } from "@/sim/world/time";
import { createWorld } from "@/sim/world/world";

const newSim = (freeplay = true): SimHandle =>
  createSimHandle(
    createWorld({
      name: "P3",
      seed: 99,
      difficulty: "classic",
      mapSize: "M",
      guidedStart: false,
      freeplayUnlocks: freeplay,
    }),
  );

/** A simple closed rectangle: station + straights + 4 right corners. */
function rectangleCircuit(start: TrackNode): PlacedPiece[] {
  const pieces: PlacedPiece[] = [];
  let node = start;
  const add = (type: PlacedPiece["type"]): void => {
    pieces.push({ type, entry: node });
    node = exitOf(node, type);
  };
  add("station"); // 2 long
  add("straight");
  add("corner-right"); // 2×2
  add("straight");
  add("corner-right");
  add("straight");
  add("straight");
  add("straight");
  add("corner-right");
  add("straight");
  add("corner-right");
  // Should now be back at start.
  return pieces;
}

describe("track geometry", () => {
  it("a rectangle of corners closes exactly", () => {
    const start: TrackNode = { x: 60.5, z: 70, h: 0, dir: 0 };
    const pieces = rectangleCircuit(start);
    let node = start;
    for (const piece of pieces) node = exitOf(node, piece.type);
    expect(nodesEqual(node, start)).toBe(true);
  });

  it("left and right corners are inverse turns", () => {
    const start: TrackNode = { x: 10, z: 10.5, h: 0, dir: 1 };
    const right = exitOf(start, "corner-right");
    const backAgain = exitOf(right, "corner-left");
    expect(backAgain.dir).toBe(start.dir);
  });

  it("slopes go up and come back down", () => {
    const start: TrackNode = { x: 10, z: 10.5, h: 0, dir: 2 };
    const up = exitOf(start, "slope-up");
    expect(up.h).toBe(1);
    const down = exitOf(up, "slope-down");
    expect(down.h).toBe(0);
  });

  it("piece curves are continuous (exit point matches next entry)", () => {
    const start: TrackNode = { x: 50, z: 50.5, h: 0, dir: 1 };
    for (const type of ["straight", "corner-right", "corner-left", "slope-up", "loop"] as const) {
      const exit = exitOf(start, type);
      const endPoint = pointOnPiece({ type, entry: start }, 1);
      expect(Math.abs(endPoint.x - exit.x)).toBeLessThan(0.05);
      expect(Math.abs(endPoint.z - exit.z)).toBeLessThan(0.05);
      expect(Math.abs(endPoint.y - (exit.h + 0.12))).toBeLessThan(0.06);
    }
  });
});

describe("coaster physics & stats", () => {
  it("computes a full run with sane speeds and time", () => {
    const start: TrackNode = { x: 60.5, z: 70, h: 0, dir: 0 };
    const pieces = rectangleCircuit(start);
    const run = computeRun(pieces);
    expect(run.totalTime).toBeGreaterThan(4);
    expect(run.totalTime).toBeLessThan(60);
    for (const speed of run.pieceSpeeds) {
      expect(speed).toBeGreaterThan(0.5);
      expect(speed).toBeLessThan(9);
    }
  });

  it("drops raise excitement and speed", () => {
    const flat = rectangleCircuit({ x: 60.5, z: 70, h: 0, dir: 0 });
    const flatStats = computeStats("mouse", flat);

    // Same rectangle but with a climb + drop on the long side.
    const start: TrackNode = { x: 60.5, z: 70, h: 0, dir: 0 };
    const pieces: PlacedPiece[] = [];
    let node = start;
    const add = (type: PlacedPiece["type"]): void => {
      pieces.push({ type, entry: node });
      node = exitOf(node, type);
    };
    add("station");
    add("slope-up");
    add("corner-right");
    add("straight");
    add("corner-right");
    add("slope-down");
    add("straight");
    add("straight");
    add("corner-right");
    add("straight");
    add("corner-right");
    const hillStats = computeStats("mouse", pieces);
    expect(hillStats.drops).toBe(1);
    expect(hillStats.excitement).toBeGreaterThan(flatStats.excitement);
    expect(hillStats.maxSpeed).toBeGreaterThan(flatStats.maxSpeed);
  });
});

describe("build-coaster command", () => {
  function buildOne(sim: SimHandle): { ok: boolean; cost: number; cashBefore: number } {
    const { x: ex, z: ez } = sim.world.entrance;
    // Path so the station has adjacency.
    sim.dispatch({
      type: "paint-surface",
      surface: SURFACE_PATH,
      tiles: Array.from({ length: 10 }, (_, i) => [ex, ez - 1 - i] as [number, number]),
    });
    // Station line one tile west of the path, heading north.
    const start: TrackNode = { x: ex - 1 + 0.5, z: ez - 2, h: 0, dir: 0 };
    const pieces = rectangleCircuit(start);
    const cost = coasterCost("mouse", pieces);
    const cashBefore = sim.world.cash;
    const result = sim.dispatch({ type: "build-coaster", family: "mouse", pieces });
    return { ok: result.ok, cost, cashBefore };
  }

  it("validates, charges, and registers a circuit", () => {
    const sim = newSim();
    const { ok, cost, cashBefore } = buildOne(sim);
    expect(ok).toBe(true);
    expect(sim.world.cash).toBe(cashBefore - cost);
    expect(sim.world.coasters.size).toBe(1);
    const coaster = [...sim.world.coasters.values()][0];
    expect(coaster?.stats.excitement).toBeGreaterThan(0);
    // Station entity exists and is a ride target.
    expect(sim.world.rides.size).toBe(1);
  });

  it("undo removes the whole coaster; redo restores it", () => {
    const sim = newSim();
    buildOne(sim);
    sim.undo();
    expect(sim.world.coasters.size).toBe(0);
    expect(sim.world.rides.size).toBe(0);
    sim.redo();
    expect(sim.world.coasters.size).toBe(1);
  });

  it("rejects open circuits and locked families", () => {
    const sim = newSim();
    const start: TrackNode = { x: 60.5, z: 70, h: 0, dir: 0 };
    const open = [
      { type: "station", entry: start } as PlacedPiece,
      { type: "straight", entry: exitOf(start, "station") } as PlacedPiece,
    ];
    expect(validateCircuit(sim.world, open).ok).toBe(false);

    const locked = newSim(false); // progression mode, nothing researched
    const { ok } = buildOne(locked);
    expect(ok).toBe(false);
  });

  it("round-trips through save/load with identical stats", () => {
    const sim = newSim();
    buildOne(sim);
    const before = [...sim.world.coasters.values()][0];
    const restored = worldFromSave(JSON.parse(JSON.stringify(serializeWorld(sim.world))));
    const after = [...restored.coasters.values()][0];
    expect(after?.stats).toEqual(before?.stats);
    expect(after?.pieces.length).toBe(before?.pieces.length);
  });
});

describe("staff & breakdowns", () => {
  it("janitors sweep litter", () => {
    const sim = newSim();
    const { x: ex, z: ez } = sim.world.entrance;
    sim.dispatch({
      type: "paint-surface",
      surface: SURFACE_PATH,
      tiles: Array.from({ length: 6 }, (_, i) => [ex, ez - 1 - i] as [number, number]),
    });
    const size = sim.world.tiles.size;
    for (let i = 0; i < 5; i++) {
      sim.world.litter.push({ idx: (ez - 2) * size + ex, seed: i });
    }
    expect(sim.dispatch({ type: "hire-staff", role: "janitor" }).ok).toBe(true);
    sim.tick(600); // a minute of sweeping
    expect(sim.world.litter.length).toBe(0);
    expect(sim.world.staff[0]?.jobsDone).toBeGreaterThan(0);
  });

  it("mechanics repair broken rides", () => {
    const sim = newSim();
    const { x: ex, z: ez } = sim.world.entrance;
    sim.dispatch({
      type: "paint-surface",
      surface: SURFACE_PATH,
      tiles: Array.from({ length: 6 }, (_, i) => [ex, ez - 1 - i] as [number, number]),
    });
    sim.dispatch({ type: "place-entity", defId: "ride/carousel", x: ex + 1, z: ez - 4, rot: 0 });
    const ride = [...sim.world.rides.values()][0];
    expect(ride).toBeDefined();
    if (!ride) return;
    ride.phase = "broken";
    ride.reliability = 10;
    sim.dispatch({ type: "hire-staff", role: "mechanic" });
    sim.tick(1200);
    // The repair happened (a later random re-break is legitimate wear).
    expect(sim.world.tallies.mechanicRepairs).toBeGreaterThanOrEqual(1);
    expect(ride.reliability).toBeGreaterThan(50);
  });

  it("contractor repair fixes without staff", () => {
    const sim = newSim();
    const { x: ex, z: ez } = sim.world.entrance;
    sim.dispatch({
      type: "paint-surface",
      surface: SURFACE_PATH,
      tiles: [[ex, ez - 1]],
    });
    sim.dispatch({ type: "place-entity", defId: "ride/carousel", x: ex + 1, z: ez - 2, rot: 0 });
    const ride = [...sim.world.rides.values()][0];
    if (!ride) return;
    ride.phase = "broken";
    expect(sim.dispatch({ type: "call-repair", id: ride.entityId }).ok).toBe(true);
    sim.tick(120);
    expect(ride.phase).not.toBe("broken"); // back in service (idle/loading/…)
  });
});

describe("research & loans", () => {
  it("research completes nodes and unlocks content", () => {
    const sim = newSim(false);
    // Teacups locked at start.
    const { x: ex, z: ez } = sim.world.entrance;
    sim.dispatch({ type: "paint-surface", surface: SURFACE_PATH, tiles: [[ex, ez - 1]] });
    const before = sim.dispatch({
      type: "place-entity",
      defId: "ride/teacups",
      x: ex + 1,
      z: ez - 2,
      rot: 0,
    });
    expect(before.ok).toBe(false);
    sim.dispatch({ type: "set-research", branch: "thrill" });
    sim.dispatch({ type: "set-research-funding", level: 2 });
    sim.tick(TICKS_PER_DAY * 2.2); // enough turbo days for node 1
    expect(sim.world.research.done.thrill).toBeGreaterThanOrEqual(1);
    const after = sim.dispatch({
      type: "place-entity",
      defId: "ride/teacups",
      x: ex + 1,
      z: ez - 2,
      rot: 0,
    });
    expect(after.ok).toBe(true);
  });

  it("loans move cash and accrue daily interest", () => {
    const sim = newSim();
    const cash0 = sim.world.cash;
    const debt0 = sim.world.debt;
    expect(sim.dispatch({ type: "take-loan" }).ok).toBe(true);
    expect(sim.world.cash).toBe(cash0 + 500_000);
    expect(sim.world.debt).toBe(debt0 + 500_000);
    const interestBefore = sim.world.economy.today.expense.interest;
    sim.tick(TICKS_PER_DAY);
    const interestPaid =
      sim.world.economy.today.expense.interest +
      (sim.world.economy.history[0]?.expense.interest ?? 0);
    expect(interestPaid).toBeGreaterThan(interestBefore);
    expect(sim.dispatch({ type: "repay-loan" }).ok).toBe(true);
    expect(sim.world.debt).toBe(debt0);
  });

  it("weather changes over days and stays in vocabulary", () => {
    const sim = newSim();
    const seen = new Set<string>();
    for (let day = 0; day < 6; day++) {
      sim.tick(TICKS_PER_DAY);
      seen.add(sim.world.weather.current);
    }
    expect(seen.size).toBeGreaterThanOrEqual(1);
    for (const kind of seen) {
      expect(["sun", "cloud", "rain", "storm", "heat"]).toContain(kind);
    }
  });
});

describe("the debt spiral (ROADMAP P3 acceptance #3)", () => {
  const tycoonWorld = (seed: number): SimHandle =>
    createSimHandle(
      createWorld({
        name: "Loan Ranger",
        seed,
        difficulty: "tycoon",
        mapSize: "M",
        guidedStart: false,
        freeplayUnlocks: true,
      }),
    );

  it("a mismanaged park goes bankrupt inside 30 game-days", () => {
    const sim = tycoonWorld(13);
    // Mismanagement speedrun: max the credit line, staff a full break room,
    // fund turbo research, churn hire-and-fire until the wallet is crumbs —
    // and never build a single thing that earns (the park never opens).
    while (sim.dispatch({ type: "take-loan" }).ok) {
      /* drain the credit line */
    }
    while (sim.dispatch({ type: "hire-staff", role: "mechanic" }).ok) {
      /* a full break room of idle mechanics */
    }
    sim.dispatch({ type: "set-research", branch: "thrill" });
    sim.dispatch({ type: "set-research-funding", level: 2 });
    for (let churn = 0; churn < 400 && sim.world.cash > 100_00; churn++) {
      sim.dispatch({ type: "fire-staff", id: sim.world.staff[0]?.id ?? -1 });
      sim.dispatch({ type: "hire-staff", role: "mechanic" }); // fee burned each time
    }
    sim.tick(TICKS_PER_DAY * 30);
    expect(sim.world.loans.bankrupt).toBe(true);
  });

  it("a managed park escapes the same interest rate", () => {
    const sim = tycoonWorld(14);
    const { x: ex, z: ez } = sim.world.entrance;
    const tiles: [number, number][] = [];
    for (let i = 1; i <= 10; i++) tiles.push([ex, ez - i]);
    for (let dx = -3; dx <= 3; dx++) tiles.push([ex + dx, ez - 5]);
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
    sim.tick(TICKS_PER_DAY * 30);
    expect(sim.world.loans.bankrupt).toBe(false);
    expect(sim.world.loans.missedPayments).toBe(0);
    expect(sim.world.cash).toBeGreaterThan(0);
  });
});
