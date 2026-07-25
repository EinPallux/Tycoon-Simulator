/**
 * Player commands — the ONLY entry points that mutate the world
 * (TECHNICAL_ARCHITECTURE.md §6). Every executed command produces a Patch:
 * a complete, data-only description of what changed (tiles, entities, cash),
 * which makes undo/redo a single generic apply/revert routine.
 */

import { getPlaceableDef, SURFACES } from "@/content/catalog";
import { canPlaceEntity, canPlaceSurface, footprintTiles } from "./validate";
import {
  SURFACE_NONE,
  SURFACE_PATH,
  SURFACE_QUEUE,
  tileIndex,
  type Surface,
} from "./world/tiles";
import type { PlacedEntity, World } from "./world/world";
import { TICKS_PER_SEC } from "./world/time";

export const UNDO_DEPTH = 20;
/** Full-refund grace window for demolishing scenery (GAME_DESIGN.md §4.1). */
export const REFUND_GRACE_TICKS = 30 * TICKS_PER_SEC;
export const DEMOLISH_REFUND = 0.5;

export type Command =
  | { type: "paint-surface"; surface: Surface; tiles: ReadonlyArray<readonly [number, number]> }
  | { type: "erase-surface"; tiles: ReadonlyArray<readonly [number, number]> }
  | { type: "place-entity"; defId: string; x: number; z: number; rot: number }
  | { type: "remove-entity"; id: number }
  | { type: "move-entity"; id: number; x: number; z: number; rot: number };

export interface TileChange {
  idx: number;
  prev: number;
  next: number;
}

/** Complete reversible record of one executed command. */
export interface Patch {
  label: string;
  /** Applied to world.cash on do (negative = money spent). */
  cashDelta: number;
  tileChanges: TileChange[];
  entitiesAdded: PlacedEntity[];
  entitiesRemoved: PlacedEntity[];
}

export type DispatchResult = { ok: true; patch: Patch } | { ok: false; reason: string };

// ── Entity stamping ──────────────────────────────────────────────────────

function stampEntity(world: World, e: PlacedEntity, value: number): void {
  const def = getPlaceableDef(e.defId);
  for (const [tx, tz] of footprintTiles(def, e.x, e.z, e.rot)) {
    world.tiles.occupant[tileIndex(world.tiles, tx, tz)] = value;
  }
}

function addEntity(world: World, e: PlacedEntity): void {
  world.placeables.set(e.id, e);
  stampEntity(world, e, e.id);
}

function removeEntity(world: World, e: PlacedEntity): void {
  world.placeables.delete(e.id);
  stampEntity(world, e, 0);
}

// ── Command execution ────────────────────────────────────────────────────

export function executeCommand(world: World, cmd: Command): DispatchResult {
  switch (cmd.type) {
    case "paint-surface":
      return execPaintSurface(world, cmd.surface, cmd.tiles);
    case "erase-surface":
      return execEraseSurface(world, cmd.tiles);
    case "place-entity":
      return execPlaceEntity(world, cmd.defId, cmd.x, cmd.z, cmd.rot);
    case "remove-entity":
      return execRemoveEntity(world, cmd.id);
    case "move-entity":
      return execMoveEntity(world, cmd.id, cmd.x, cmd.z, cmd.rot);
  }
}

function execPaintSurface(
  world: World,
  surface: Surface,
  tiles: ReadonlyArray<readonly [number, number]>,
): DispatchResult {
  if (surface !== SURFACE_PATH && surface !== SURFACE_QUEUE)
    return { ok: false, reason: "Invalid surface" };
  const surfaceDef = surface === SURFACE_PATH ? SURFACES.path : SURFACES.queue;
  const changes: TileChange[] = [];
  const seen = new Set<number>();
  for (const [x, z] of tiles) {
    const verdict = canPlaceSurface(world, x, z, surface);
    if (!verdict.ok) continue; // skip invalid tiles inside a drag stroke
    const idx = tileIndex(world.tiles, x, z);
    if (seen.has(idx)) continue;
    seen.add(idx);
    changes.push({ idx, prev: SURFACE_NONE, next: surface });
  }
  if (changes.length === 0) return { ok: false, reason: "Nothing to build there" };
  const cost = changes.length * surfaceDef.costPerTile;
  if (world.cash < cost) return { ok: false, reason: "Not enough cash" };
  const patch: Patch = {
    label: `Build ${surfaceDef.name} ×${changes.length}`,
    cashDelta: -cost,
    tileChanges: changes,
    entitiesAdded: [],
    entitiesRemoved: [],
  };
  applyPatch(world, patch);
  return { ok: true, patch };
}

function execEraseSurface(
  world: World,
  tiles: ReadonlyArray<readonly [number, number]>,
): DispatchResult {
  const changes: TileChange[] = [];
  const seen = new Set<number>();
  let refund = 0;
  for (const [x, z] of tiles) {
    const idx = tileIndex(world.tiles, x, z);
    if (seen.has(idx)) continue;
    const current = world.tiles.surface[idx] ?? SURFACE_NONE;
    if (current === SURFACE_NONE) continue;
    seen.add(idx);
    const surfaceDef = current === SURFACE_PATH ? SURFACES.path : SURFACES.queue;
    refund += Math.round(surfaceDef.costPerTile * DEMOLISH_REFUND);
    changes.push({ idx, prev: current, next: SURFACE_NONE });
  }
  if (changes.length === 0) return { ok: false, reason: "Nothing to remove there" };
  const patch: Patch = {
    label: `Remove path ×${changes.length}`,
    cashDelta: refund,
    tileChanges: changes,
    entitiesAdded: [],
    entitiesRemoved: [],
  };
  applyPatch(world, patch);
  return { ok: true, patch };
}

function execPlaceEntity(
  world: World,
  defId: string,
  x: number,
  z: number,
  rot: number,
): DispatchResult {
  const verdict = canPlaceEntity(world, defId, x, z, rot);
  if (!verdict.ok) return { ok: false, reason: verdict.reason };
  const def = getPlaceableDef(defId);
  const entity: PlacedEntity = {
    id: world.placeableIds.nextId(),
    defId,
    x,
    z,
    rot,
    placedAt: world.time,
  };
  const patch: Patch = {
    label: `Place ${def.name}`,
    cashDelta: -def.cost,
    tileChanges: [],
    entitiesAdded: [entity],
    entitiesRemoved: [],
  };
  applyPatch(world, patch);
  return { ok: true, patch };
}

function execRemoveEntity(world: World, id: number): DispatchResult {
  const entity = world.placeables.get(id);
  if (!entity) return { ok: false, reason: "Nothing selected" };
  const def = getPlaceableDef(entity.defId);
  const withinGrace = world.time - entity.placedAt <= REFUND_GRACE_TICKS;
  const refundRate = def.category === "scenery" && withinGrace ? 1 : DEMOLISH_REFUND;
  const patch: Patch = {
    label: `Demolish ${def.name}`,
    cashDelta: Math.round(def.cost * refundRate),
    tileChanges: [],
    entitiesAdded: [],
    entitiesRemoved: [entity],
  };
  applyPatch(world, patch);
  return { ok: true, patch };
}

function execMoveEntity(
  world: World,
  id: number,
  x: number,
  z: number,
  rot: number,
): DispatchResult {
  const entity = world.placeables.get(id);
  if (!entity) return { ok: false, reason: "Nothing selected" };
  const def = getPlaceableDef(entity.defId);
  // Temporarily lift the entity so it doesn't collide with itself.
  stampEntity(world, entity, 0);
  const verdict = canPlaceEntity(world, entity.defId, x, z, rot);
  stampEntity(world, entity, entity.id);
  if (!verdict.ok) return { ok: false, reason: verdict.reason };

  const withinGrace = world.time - entity.placedAt <= REFUND_GRACE_TICKS;
  const moveCost = withinGrace ? 0 : Math.round(def.cost * 0.1);
  if (world.cash < moveCost) return { ok: false, reason: "Not enough cash" };
  const moved: PlacedEntity = { ...entity, x, z, rot };
  const patch: Patch = {
    label: `Move ${def.name}`,
    cashDelta: -moveCost,
    tileChanges: [],
    entitiesAdded: [moved],
    entitiesRemoved: [entity],
  };
  applyPatch(world, patch);
  return { ok: true, patch };
}

// ── Generic patch apply / revert (single undo implementation) ────────────

export function applyPatch(world: World, patch: Patch): void {
  world.cash += patch.cashDelta;
  for (const c of patch.tileChanges) world.tiles.surface[c.idx] = c.next;
  for (const e of patch.entitiesRemoved) removeEntity(world, e);
  for (const e of patch.entitiesAdded) addEntity(world, e);
}

export function revertPatch(world: World, patch: Patch): void {
  world.cash -= patch.cashDelta;
  for (const c of patch.tileChanges) world.tiles.surface[c.idx] = c.prev;
  for (const e of patch.entitiesAdded) removeEntity(world, e);
  for (const e of patch.entitiesRemoved) addEntity(world, e);
}
