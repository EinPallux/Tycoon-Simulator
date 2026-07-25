import { describe, expect, it } from "vitest";
import { createSimHandle } from "@/sim/api";
import { SaveFormatError, migrateSave } from "@/sim/save/migrate";
import { serializeWorld, worldFromSave } from "@/sim/save/serialize";
import { getOccupant, getSurface, SURFACE_PATH } from "@/sim/world/tiles";
import { createWorld } from "@/sim/world/world";

const buildSampleWorld = () => {
  const sim = createSimHandle(
    createWorld({
      name: "Roundtrip Park",
      seed: 777,
      difficulty: "tycoon",
      mapSize: "S",
      guidedStart: true,
      freeplayUnlocks: false,
    }),
  );
  const { x0, z0 } = sim.world.ownedRect;
  sim.dispatch({
    type: "paint-surface",
    surface: SURFACE_PATH,
    tiles: [
      [x0 + 2, z0 + 2],
      [x0 + 3, z0 + 2],
      [x0 + 4, z0 + 2],
    ],
  });
  sim.dispatch({ type: "place-entity", defId: "scenery/tree-oak", x: x0 + 6, z: z0 + 6, rot: 3 });
  sim.dispatch({ type: "place-entity", defId: "stall/drinks", x: x0 + 2, z: z0 + 3, rot: 0 });
  sim.tick(1234);
  return sim;
};

describe("save round-trip", () => {
  it("reproduces the world exactly", () => {
    const sim = buildSampleWorld();
    const save = serializeWorld(sim.world);
    const restored = worldFromSave(JSON.parse(JSON.stringify(save)));

    expect(restored.time).toBe(sim.world.time);
    expect(restored.cash).toBe(sim.world.cash);
    expect(restored.debt).toBe(sim.world.debt);
    expect(restored.meta).toEqual(sim.world.meta);
    expect(restored.ownedRect).toEqual(sim.world.ownedRect);
    expect(restored.entrance).toEqual(sim.world.entrance);
    expect([...restored.placeables.entries()]).toEqual([...sim.world.placeables.entries()]);
    expect(restored.tiles.surface).toEqual(sim.world.tiles.surface);
    expect(restored.tiles.owned).toEqual(sim.world.tiles.owned);
    // occupant is derived — verify a stamped tile
    const stall = [...sim.world.placeables.values()].find((e) => e.defId === "stall/drinks");
    expect(stall).toBeDefined();
    if (stall) expect(getOccupant(restored.tiles, stall.x, stall.z)).toBe(stall.id);
    // rng resumes identically
    expect(restored.rng.next()).toBe(sim.world.rng.next());
  });

  it("save → load → save is stable (idempotent serialization)", () => {
    const sim = buildSampleWorld();
    const save1 = serializeWorld(sim.world);
    const save2 = serializeWorld(worldFromSave(JSON.parse(JSON.stringify(save1))));
    expect(save2).toEqual(save1);
  });

  it("keeps a path tile round-trippable", () => {
    const sim = buildSampleWorld();
    const { x0, z0 } = sim.world.ownedRect;
    const restored = worldFromSave(JSON.parse(JSON.stringify(serializeWorld(sim.world))));
    expect(getSurface(restored.tiles, x0 + 3, z0 + 2)).toBe(SURFACE_PATH);
  });
});

describe("migration guardrails", () => {
  it("rejects newer-version saves with a friendly error", () => {
    expect(() => migrateSave({ formatVersion: 999 })).toThrow(SaveFormatError);
  });

  it("rejects junk", () => {
    expect(() => migrateSave(null)).toThrow(SaveFormatError);
    expect(() => migrateSave({ hello: "world" })).toThrow(SaveFormatError);
    expect(() => migrateSave({ formatVersion: 1, nonsense: true })).toThrow(SaveFormatError);
  });
});
