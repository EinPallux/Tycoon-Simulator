/** Phase-4: theming zones, tallies, and the Opportunities engine. */

import { describe, expect, it } from "vitest";
import { createSimHandle, type SimHandle } from "@/sim/api";
import { GOAL_TEMPLATES } from "@/content/goals";
import { rideConfigOf } from "@/sim/rides";
import { serializeWorld, worldFromSave } from "@/sim/save/serialize";
import { SURFACE_PATH, SURFACE_QUEUE } from "@/sim/world/tiles";
import { TICKS_PER_DAY } from "@/sim/world/time";
import { createWorld } from "@/sim/world/world";

const newSim = (seed = 7): SimHandle =>
  createSimHandle(
    createWorld({
      name: "P4",
      seed,
      difficulty: "classic",
      mapSize: "M",
      guidedStart: false,
      freeplayUnlocks: true,
    }),
  );

/** Path spine + queue + carousel — a minimal earning park. */
function basePark(sim: SimHandle): { ex: number; ez: number } {
  const { x: ex, z: ez } = sim.world.entrance;
  const tiles: [number, number][] = [];
  for (let i = 1; i <= 10; i++) tiles.push([ex, ez - i]);
  sim.dispatch({ type: "paint-surface", surface: SURFACE_PATH, tiles });
  sim.dispatch({
    type: "paint-surface",
    surface: SURFACE_QUEUE,
    tiles: [
      [ex - 1, ez - 5],
      [ex - 2, ez - 5],
    ],
  });
  sim.dispatch({ type: "place-entity", defId: "ride/carousel", x: ex - 4, z: ez - 8, rot: 0 });
  return { ex, ez };
}

describe("theming zones", () => {
  it("8 same-theme pieces near a ride form a zone with a name and a bonus", () => {
    const sim = newSim();
    const { ex, ez } = basePark(sim);
    // A palm grove hugging the carousel (theme "pirate") — one linked chain.
    const spots: [number, number][] = [
      [ex - 5, ez - 9], [ex - 4, ez - 9], [ex - 3, ez - 9], [ex - 2, ez - 9],
      [ex - 5, ez - 8], [ex - 5, ez - 7], [ex - 5, ez - 6], [ex - 5, ez - 5],
    ];
    for (const [x, z] of spots.slice(0, 7)) {
      expect(
        sim.dispatch({ type: "place-entity", defId: "scenery/tree-palm", x, z, rot: 0 }).ok,
      ).toBe(true);
    }
    expect(sim.world.zones.length).toBe(0); // 7 pieces: not yet
    const last = spots[7] as [number, number];
    sim.dispatch({ type: "place-entity", defId: "scenery/tree-palm", x: last[0], z: last[1], rot: 0 });
    expect(sim.world.zones.length).toBe(1);
    const zone = sim.world.zones[0];
    expect(zone?.theme).toBe("pirate");
    expect(zone?.name.length).toBeGreaterThan(0);
    expect(zone?.rideIds.length).toBeGreaterThanOrEqual(1);
    expect(sim.world.tallies.zonesFormed).toBe(1);

    // Zone rides get the excitement bonus through the one true lens.
    const rideId = zone?.rideIds[0] as number;
    const before = 4.2; // carousel base excitement
    const cfg = rideConfig(sim, rideId);
    expect(cfg).toBeCloseTo(before + 0.5, 5);

    // Rename sticks and survives a save round-trip.
    expect(sim.dispatch({ type: "rename-zone", key: zone?.key ?? "", name: "Palm Bay" }).ok).toBe(true);
    const restored = worldFromSave(JSON.parse(JSON.stringify(serializeWorld(sim.world))));
    expect(restored.zones[0]?.name).toBe("Palm Bay");

    // Demolishing pieces dissolves the zone (and the bonus).
    for (const [x, z] of spots.slice(4)) {
      const idx = (z * sim.world.tiles.size + x) as number;
      const occupant = sim.world.tiles.occupant[idx] ?? 0;
      if (occupant) sim.dispatch({ type: "remove-entity", id: occupant });
    }
    expect(sim.world.zones.length).toBe(0);
    expect(rideConfig(sim, rideId)).toBeCloseTo(before, 5);
  });
});

function rideConfig(sim: SimHandle, rideId: number): number {
  return rideConfigOf(sim.world, rideId)?.excitement ?? 0;
}

describe("opportunities", () => {
  it("offers arrive from park state, accept → progress → reward", () => {
    const sim = newSim(11);
    basePark(sim);
    // Run until an offer lands (cadence starts ~1.2 days in).
    for (let i = 0; i < 40 && !sim.world.opportunities.offered; i++) sim.tick(100);
    expect(sim.world.opportunities.offered).not.toBeNull();
    const offered = sim.world.opportunities.offered;
    expect(offered?.text.length).toBeGreaterThan(4);

    expect(sim.dispatch({ type: "accept-opportunity" }).ok).toBe(true);
    expect(sim.world.opportunities.active.length).toBe(1);
    expect(sim.world.opportunities.offered).toBeNull();

    // Force-complete: shrink the target to "already met".
    const active = sim.world.opportunities.active[0];
    if (!active) throw new Error("no active");
    active.target = -1;
    active.baseline = -1e9;
    if (active.kind === "hold-days") active.progress = 99;
    const cashBefore = sim.world.cash;
    sim.tick(60);
    expect(sim.world.opportunities.active.length).toBe(0);
    expect(sim.world.opportunities.completed).toBe(1);
    expect(sim.world.tallies.opportunitiesDone).toBe(1);
    // Cash rewards pay out; other kinds leave cash intact or higher.
    expect(sim.world.cash).toBeGreaterThanOrEqual(cashBefore);
  });

  it("decline is free and reroll changes the offer", () => {
    const sim = newSim(12);
    basePark(sim);
    for (let i = 0; i < 40 && !sim.world.opportunities.offered; i++) sim.tick(100);
    expect(sim.world.opportunities.offered).not.toBeNull();
    expect(sim.dispatch({ type: "decline-opportunity" }).ok).toBe(true);
    expect(sim.world.opportunities.offered).toBeNull();

    for (let i = 0; i < 40 && !sim.world.opportunities.offered; i++) sim.tick(100);
    const first = sim.world.opportunities.offered?.id;
    expect(first).toBeDefined();
    const result = sim.dispatch({ type: "reroll-opportunity" });
    if (result.ok) {
      expect(sim.world.opportunities.offered?.id).not.toBe(first);
    }
  });

  it("deadlines expire quietly with zero punishment", () => {
    const sim = newSim(13);
    basePark(sim);
    for (let i = 0; i < 40 && !sim.world.opportunities.offered; i++) sim.tick(100);
    sim.dispatch({ type: "accept-opportunity" });
    const active = sim.world.opportunities.active[0];
    if (!active) throw new Error("no active");
    active.deadlineAt = sim.world.time + 50; // about to lapse
    active.target = 1e9; // impossible
    const cash = sim.world.cash;
    const rating = sim.world.rating.value;
    sim.tick(120);
    expect(sim.world.opportunities.active.length).toBe(0);
    expect(sim.world.cash).toBeGreaterThanOrEqual(cash - 5_000); // upkeep only
    // Rating drifts naturally with the sim — but no penalty is ever applied.
    expect(sim.world.rating.value).toBeGreaterThanOrEqual(rating - 80);
  });

  it("all templates roll valid offers on a busy park", () => {
    const sim = newSim(14);
    basePark(sim);
    sim.tick(TICKS_PER_DAY);
    for (const template of GOAL_TEMPLATES) {
      // Roll regardless of eligibility — parameters must still be sane.
      const rolled = template.roll(sim.world, (min, max) => sim.world.rng.int(min, max));
      expect(rolled.text.length).toBeGreaterThan(4);
      expect(Number.isFinite(rolled.target)).toBe(true);
      expect(rolled.days).toBeGreaterThanOrEqual(0);
    }
  });

  it("goals survive a save round-trip with progress intact", () => {
    const sim = newSim(15);
    basePark(sim);
    for (let i = 0; i < 40 && !sim.world.opportunities.offered; i++) sim.tick(100);
    sim.dispatch({ type: "accept-opportunity" });
    sim.tick(200);
    const restored = worldFromSave(JSON.parse(JSON.stringify(serializeWorld(sim.world))));
    expect(restored.opportunities.active.length).toBe(sim.world.opportunities.active.length);
    expect(restored.opportunities.active[0]?.text).toBe(sim.world.opportunities.active[0]?.text);
    expect(restored.tallies.stallSales).toBe(sim.world.tallies.stallSales);
  });
});
