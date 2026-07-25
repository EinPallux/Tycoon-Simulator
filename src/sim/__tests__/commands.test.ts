import { describe, expect, it } from "vitest";
import { createSimHandle } from "@/sim/api";
import { REFUND_GRACE_TICKS } from "@/sim/commands";
import { getSurface, SURFACE_NONE, SURFACE_PATH } from "@/sim/world/tiles";
import { createWorld, type World } from "@/sim/world/world";
import { getPlaceableDef, SURFACES } from "@/content/catalog";

const newWorld = (): World =>
  createWorld({
    name: "Test Park",
    seed: 123,
    difficulty: "classic",
    mapSize: "M",
    guidedStart: false,
    freeplayUnlocks: false,
  });

/** A tile safely inside the owned rect. */
const inside = (world: World, dx = 2, dz = 2): [number, number] => [
  world.ownedRect.x0 + dx,
  world.ownedRect.z0 + dz,
];

describe("paint-surface", () => {
  it("builds path tiles, charges cash, skips invalid tiles in a stroke", () => {
    const sim = createSimHandle(newWorld());
    const [x, z] = inside(sim.world);
    const cash0 = sim.world.cash;
    const result = sim.dispatch({
      type: "paint-surface",
      surface: SURFACE_PATH,
      tiles: [
        [x, z],
        [x + 1, z],
        [-5, -5], // out of bounds — skipped, not fatal
        [x + 1, z], // duplicate — deduped
      ],
    });
    expect(result.ok).toBe(true);
    expect(getSurface(sim.world.tiles, x, z)).toBe(SURFACE_PATH);
    expect(sim.world.cash).toBe(cash0 - 2 * SURFACES.path.costPerTile);
  });

  it("rejects an all-invalid stroke", () => {
    const sim = createSimHandle(newWorld());
    const result = sim.dispatch({ type: "paint-surface", surface: SURFACE_PATH, tiles: [[0, 0]] });
    expect(result.ok).toBe(false);
  });
});

describe("place/remove entity", () => {
  it("places scenery, stamps occupancy, demolishes with full grace refund", () => {
    const sim = createSimHandle(newWorld());
    const [x, z] = inside(sim.world);
    const cash0 = sim.world.cash;
    const def = getPlaceableDef("scenery/tree-oak");

    const placed = sim.dispatch({ type: "place-entity", defId: def.id, x, z, rot: 0 });
    expect(placed.ok).toBe(true);
    expect(sim.world.cash).toBe(cash0 - def.cost);
    const id = [...sim.world.placeables.keys()][0] as number;

    // within grace → 100% refund for scenery
    sim.dispatch({ type: "remove-entity", id });
    expect(sim.world.cash).toBe(cash0);
    expect(sim.world.placeables.size).toBe(0);
  });

  it("halves the refund after the grace window", () => {
    const sim = createSimHandle(newWorld());
    const [x, z] = inside(sim.world);
    const def = getPlaceableDef("scenery/tree-oak");
    sim.dispatch({ type: "place-entity", defId: def.id, x, z, rot: 0 });
    const id = [...sim.world.placeables.keys()][0] as number;
    const cashAfterPlace = sim.world.cash;
    sim.tick(REFUND_GRACE_TICKS + 1);
    sim.dispatch({ type: "remove-entity", id });
    expect(sim.world.cash).toBe(cashAfterPlace + Math.round(def.cost * 0.5));
  });

  it("stalls require path adjacency", () => {
    const sim = createSimHandle(newWorld());
    const [x, z] = inside(sim.world);
    const rejected = sim.dispatch({ type: "place-entity", defId: "stall/food", x, z, rot: 0 });
    expect(rejected.ok).toBe(false);
    sim.dispatch({ type: "paint-surface", surface: SURFACE_PATH, tiles: [[x, z + 1]] });
    const accepted = sim.dispatch({ type: "place-entity", defId: "stall/food", x, z, rot: 0 });
    expect(accepted.ok).toBe(true);
  });

  it("rejects overlapping footprints", () => {
    const sim = createSimHandle(newWorld());
    const [x, z] = inside(sim.world);
    sim.dispatch({ type: "place-entity", defId: "scenery/tree-oak", x, z, rot: 0 });
    const overlap = sim.dispatch({ type: "place-entity", defId: "scenery/tree-oak", x, z, rot: 0 });
    expect(overlap.ok).toBe(false);
  });
});

describe("undo/redo", () => {
  it("restores cash, tiles and entities exactly", () => {
    const sim = createSimHandle(newWorld());
    const [x, z] = inside(sim.world);
    const cash0 = sim.world.cash;

    sim.dispatch({ type: "paint-surface", surface: SURFACE_PATH, tiles: [[x, z]] });
    sim.dispatch({ type: "place-entity", defId: "scenery/bench", x: x + 2, z, rot: 1 });
    expect(sim.canUndo()).toBe(true);

    sim.undo(); // bench
    expect(sim.world.placeables.size).toBe(0);
    sim.undo(); // path
    expect(getSurface(sim.world.tiles, x, z)).toBe(SURFACE_NONE);
    expect(sim.world.cash).toBe(cash0);

    sim.redo();
    expect(getSurface(sim.world.tiles, x, z)).toBe(SURFACE_PATH);
    sim.redo();
    expect(sim.world.placeables.size).toBe(1);
    const bench = [...sim.world.placeables.values()][0];
    expect(bench?.rot).toBe(1);
  });

  it("dispatch clears the redo stack", () => {
    const sim = createSimHandle(newWorld());
    const [x, z] = inside(sim.world);
    sim.dispatch({ type: "paint-surface", surface: SURFACE_PATH, tiles: [[x, z]] });
    sim.undo();
    sim.dispatch({ type: "paint-surface", surface: SURFACE_PATH, tiles: [[x + 1, z]] });
    expect(sim.canRedo()).toBe(false);
  });
});

describe("move entity", () => {
  it("moves within grace for free and blocks invalid targets", () => {
    const sim = createSimHandle(newWorld());
    const [x, z] = inside(sim.world);
    sim.dispatch({ type: "place-entity", defId: "scenery/tree-oak", x, z, rot: 0 });
    const id = [...sim.world.placeables.keys()][0] as number;
    const cash = sim.world.cash;

    const moved = sim.dispatch({ type: "move-entity", id, x: x + 3, z, rot: 2 });
    expect(moved.ok).toBe(true);
    expect(sim.world.cash).toBe(cash); // grace = free
    expect(sim.world.placeables.get(id)?.x).toBe(x + 3); // same id, new spot
    expect(sim.world.placeables.get(id)?.rot).toBe(2);

    const blocked = sim.dispatch({ type: "move-entity", id, x: -10, z, rot: 0 });
    expect(blocked.ok).toBe(false);
  });
});
