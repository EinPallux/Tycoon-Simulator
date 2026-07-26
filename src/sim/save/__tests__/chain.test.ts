/**
 * Migration chain regression (ROADMAP P5): every historical format version
 * must still parse, migrate to current, and load into a working world.
 * The v1 fixture is a real Phase-1-shaped save; each intermediate version
 * is captured by running the chain one step at a time.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { migrateSave, MIGRATIONS } from "../migrate";
import { CURRENT_FORMAT_VERSION } from "../schema";
import { serializeWorld, worldFromSave } from "../serialize";
import { createSimHandle } from "../../api";
import { createWorld } from "../../world/world";

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, "__fixtures__", name), "utf8"));

describe("save format chain", () => {
  it("v1 fixture migrates to the current version and loads", () => {
    const v1 = fixture("save-v1.json");
    const migrated = migrateSave(v1);
    expect(migrated.formatVersion).toBe(CURRENT_FORMAT_VERSION);
    const world = worldFromSave(v1);
    expect(world.cash).toBe(100_000);
    expect(world.tallies.stallSales).toBe(0);
    expect(world.opportunities.active).toEqual([]);
  });

  it("each historical version has a migration step and the walk terminates", () => {
    // Walk the chain step-by-step from the v1 fixture, snapshotting every
    // intermediate shape — each must be accepted by the full migrator too.
    const v1 = fixture("save-v1.json") as Record<string, unknown>;
    let current = v1;
    const versions: number[] = [current.formatVersion as number];
    while ((current.formatVersion as number) < CURRENT_FORMAT_VERSION) {
      const step = MIGRATIONS[current.formatVersion as number];
      expect(step, `migration from v${String(current.formatVersion)}`).toBeDefined();
      if (!step) break;
      current = step(current);
      versions.push(current.formatVersion as number);
      // The intermediate shape itself must migrate + load cleanly.
      expect(migrateSave(current).formatVersion).toBe(CURRENT_FORMAT_VERSION);
      expect(() => worldFromSave(JSON.parse(JSON.stringify(current)))).not.toThrow();
    }
    expect(versions).toEqual([1, 2, 3, 4]);
  });

  it("a freshly serialized world round-trips bit-identically", () => {
    const sim = createSimHandle(
      createWorld({
        name: "RT",
        seed: 3,
        difficulty: "classic",
        mapSize: "S",
        guidedStart: false,
        freeplayUnlocks: true,
      }),
    );
    sim.tick(450);
    const a = serializeWorld(sim.world);
    const b = serializeWorld(worldFromSave(JSON.parse(JSON.stringify(a))));
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it("future versions are refused with a friendly error", () => {
    const v1 = fixture("save-v1.json") as Record<string, unknown>;
    const future = { ...v1, formatVersion: CURRENT_FORMAT_VERSION + 1 };
    expect(() => migrateSave(future)).toThrow(/newer version/);
  });
});
