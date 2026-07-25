/**
 * Placement validation — the single source of truth used by BOTH the ghost
 * preview and command execution (TECHNICAL_ARCHITECTURE.md §6).
 * Pure functions: world in, verdict out.
 */

import { getPlaceableDef } from "@/content/catalog";
import type { PlaceableDef } from "@/content/types";
import {
  getOccupant,
  getSurface,
  inBounds,
  isOwned,
  SURFACE_NONE,
  SURFACE_PATH,
  type Surface,
} from "./world/tiles";
import type { World } from "./world/world";

export type PlacementVerdict =
  | { ok: true }
  | { ok: false; reason: string };

/** Rotated footprint dimensions: odd rotations swap width/depth. */
export function rotatedFootprint(def: PlaceableDef, rot: number): [number, number] {
  const [w, d] = def.footprint;
  return rot % 2 === 0 ? [w, d] : [d, w];
}

export function* footprintTiles(
  def: PlaceableDef,
  x: number,
  z: number,
  rot: number,
): Generator<readonly [number, number]> {
  const [w, d] = rotatedFootprint(def, rot);
  for (let dz = 0; dz < d; dz++) {
    for (let dx = 0; dx < w; dx++) {
      yield [x + dx, z + dz] as const;
    }
  }
}

export function canPlaceEntity(
  world: World,
  defId: string,
  x: number,
  z: number,
  rot: number,
): PlacementVerdict {
  const def = getPlaceableDef(defId);
  for (const [tx, tz] of footprintTiles(def, x, z, rot)) {
    if (!inBounds(world.tiles, tx, tz)) return { ok: false, reason: "Outside the world" };
    if (!isOwned(world.tiles, tx, tz)) return { ok: false, reason: "Outside your land" };
    if (getSurface(world.tiles, tx, tz) !== SURFACE_NONE)
      return { ok: false, reason: "Blocked by a path" };
    if (getOccupant(world.tiles, tx, tz) !== 0) return { ok: false, reason: "Space is occupied" };
    if (tx === world.entrance.x && tz === world.entrance.z)
      return { ok: false, reason: "Blocked by the entrance" };
  }
  if (def.requiresPathAdjacent && !hasPathAdjacentEdge(world, def, x, z, rot)) {
    return { ok: false, reason: "Needs to touch a path" };
  }
  if (world.cash < def.cost) return { ok: false, reason: "Not enough cash" };
  return { ok: true };
}

function hasPathAdjacentEdge(
  world: World,
  def: PlaceableDef,
  x: number,
  z: number,
  rot: number,
): boolean {
  const [w, d] = rotatedFootprint(def, rot);
  for (let dx = 0; dx < w; dx++) {
    if (getSurface(world.tiles, x + dx, z - 1) === SURFACE_PATH) return true;
    if (getSurface(world.tiles, x + dx, z + d) === SURFACE_PATH) return true;
  }
  for (let dz = 0; dz < d; dz++) {
    if (getSurface(world.tiles, x - 1, z + dz) === SURFACE_PATH) return true;
    if (getSurface(world.tiles, x + w, z + dz) === SURFACE_PATH) return true;
  }
  return false;
}

export function canPlaceSurface(
  world: World,
  x: number,
  z: number,
  surface: Surface,
): PlacementVerdict {
  if (!inBounds(world.tiles, x, z)) return { ok: false, reason: "Outside the world" };
  if (!isOwned(world.tiles, x, z)) return { ok: false, reason: "Outside your land" };
  if (getOccupant(world.tiles, x, z) !== 0) return { ok: false, reason: "Space is occupied" };
  const existing = getSurface(world.tiles, x, z);
  if (existing === surface) return { ok: false, reason: "Already there" };
  if (existing !== SURFACE_NONE) return { ok: false, reason: "Replace the other surface first" };
  if (x === world.entrance.x && z === world.entrance.z)
    return { ok: false, reason: "Blocked by the entrance" };
  return { ok: true };
}
