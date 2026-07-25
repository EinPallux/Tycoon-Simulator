/**
 * The Phase-1 buildable catalog: paths/queues, 4 CoasterKit stalls,
 * and 30+ scenery pieces (ROADMAP Phase 1). Prices per GAME_DESIGN.md §15.6
 * (cents). Model ids resolve through the generated asset manifest.
 */

import type { PlaceableDef, SurfaceDef } from "./types";

export const SURFACES: Record<SurfaceDef["id"], SurfaceDef> = {
  path: { id: "path", name: "Path", costPerTile: 1_000 },
  queue: { id: "queue", name: "Queue", costPerTile: 1_400 },
};

const scenery = (
  id: string,
  name: string,
  model: string,
  cost: number,
  beauty: number,
  footprint: readonly [number, number] = [1, 1],
  themeTag?: PlaceableDef["themeTag"],
): PlaceableDef => ({
  id: `scenery/${id}`,
  name,
  category: "scenery",
  footprint,
  cost,
  model,
  beauty,
  ...(themeTag ? { themeTag } : {}),
});

const stall = (id: string, name: string, model: string, cost: number): PlaceableDef => ({
  id: `stall/${id}`,
  name,
  category: "stall",
  footprint: [1, 1],
  cost,
  model,
  beauty: 1,
  requiresPathAdjacent: true,
});

export const PLACEABLE_DEFS: readonly PlaceableDef[] = [
  // ── Stalls (CoasterKit) ────────────────────────────────────────────────
  stall("food", "Snack Shack", "stalls/food", 40_000),
  stall("drinks", "Drinks Depot", "stalls/drinks", 35_000),
  stall("info", "Info Kiosk", "stalls/info", 25_000),
  stall("toilets", "Toilets", "stalls/toilets", 30_000),

  // ── Park furniture (CoasterKit) ────────────────────────────────────────
  scenery("bench", "Bench", "furniture/bench", 5_000, 1),
  scenery("bin", "Litter Bin", "furniture/bin", 3_500, 0.5),
  scenery("lamp", "Park Lamp", "furniture/lamp", 6_000, 1),
  scenery("flowers", "Flower Bed", "furniture/flowers", 2_500, 2),
  scenery("grass-tuft", "Grass Tuft", "furniture/grass-tuft", 1_000, 0.8),

  // ── Nature: trees (NatureKit) ──────────────────────────────────────────
  scenery("tree-oak", "Oak Tree", "nature/tree-oak", 8_000, 3, [1, 1], "nature"),
  scenery("tree-oak-dark", "Shade Oak", "nature/tree-oak-dark", 8_000, 3, [1, 1], "nature"),
  scenery("tree-detailed", "Grand Oak", "nature/tree-detailed", 12_000, 4, [1, 1], "nature"),
  scenery("tree-pine", "Pine Tree", "nature/tree-pine", 7_000, 3, [1, 1], "nature"),
  scenery("tree-pine-tall", "Tall Pine", "nature/tree-pine-tall", 9_000, 3, [1, 1], "nature"),
  scenery("tree-palm", "Palm Tree", "nature/tree-palm", 10_000, 3.5, [1, 1], "pirate"),
  scenery("tree-palm-bend", "Leaning Palm", "nature/tree-palm-bend", 10_000, 3.5, [1, 1], "pirate"),

  // ── Nature: shrubs & flowers ───────────────────────────────────────────
  scenery("bush", "Bush", "nature/bush", 3_000, 1.5, [1, 1], "nature"),
  scenery("bush-trimmed", "Trimmed Bush", "nature/bush-trimmed", 4_500, 2.5, [1, 1], "nature"),
  scenery("flower-red", "Red Flowers", "nature/flower-red", 2_000, 2, [1, 1], "nature"),
  scenery("flower-yellow", "Yellow Flowers", "nature/flower-yellow", 2_000, 2, [1, 1], "nature"),
  scenery("mushroom-red", "Toadstool", "nature/mushroom-red", 2_500, 1.5, [1, 1], "nature"),

  // ── Nature: rocks & ground ─────────────────────────────────────────────
  scenery("rock-small", "Rock", "nature/rock-small", 2_000, 1, [1, 1], "nature"),
  scenery("rock-large", "Boulder", "nature/rock-large", 5_000, 1.5, [1, 1], "nature"),
  scenery("rock-formation", "Rock Formation", "nature/rock-formation", 9_000, 2.5, [2, 2], "nature"),
  scenery("stump", "Tree Stump", "nature/stump", 1_500, 0.8, [1, 1], "nature"),
  scenery("log", "Fallen Log", "nature/log", 2_500, 1, [1, 1], "nature"),

  // ── Monuments & centerpieces ───────────────────────────────────────────
  scenery("monument-ring", "Ring Monument", "nature/monument-ring", 25_000, 5, [2, 2]),
  scenery("obelisk", "Ancient Obelisk", "nature/obelisk", 15_000, 4, [1, 1], "castle"),

  // ── Fences & borders ───────────────────────────────────────────────────
  scenery("fence-wood", "Wooden Fence", "nature/fence-wood", 1_200, 0.5, [1, 1], "nature"),
  scenery("fence-planks", "Plank Fence", "nature/fence-planks", 2_000, 0.8, [1, 1], "nature"),
  scenery("hedge", "Hedge", "nature/hedge", 2_200, 1.2, [1, 1], "nature"),

  // ── Plaza flair ────────────────────────────────────────────────────────
  scenery("flag-red", "Red Banner", "furniture/flag-red", 3_000, 1.5),
  scenery("flag-blue", "Blue Banner", "furniture/flag-blue", 3_000, 1.5),
  scenery("sculpture", "Plaza Sculpture", "furniture/sculpture", 4_000, 2),
  scenery("column", "Old Column", "furniture/column", 3_500, 1.5, [1, 1], "castle"),
  scenery("planter", "Stone Planter", "furniture/planter", 4_500, 2),
  scenery("umbrella", "Parasol", "furniture/umbrella", 5_000, 1.5),
];

const defIndex = new Map(PLACEABLE_DEFS.map((d) => [d.id, d]));

export function getPlaceableDef(id: string): PlaceableDef {
  const def = defIndex.get(id);
  if (!def) throw new Error(`Unknown placeable def: ${id}`);
  return def;
}

export function hasPlaceableDef(id: string): boolean {
  return defIndex.has(id);
}
