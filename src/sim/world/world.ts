/**
 * The World: the single mutable simulation state object.
 * Created fresh (new park) or loaded (save). Mutated ONLY by command
 * execution and the tick pipeline (TECHNICAL_ARCHITECTURE.md §5–6).
 */

import { createIdSource, type IdSource } from "@/shared/ids";
import { createRng, restoreRng, type Rng } from "@/shared/rng";
import { createTileMap, setOwnedRect, type TileMap } from "./tiles";

export type Difficulty = "relaxed" | "classic" | "tycoon";
export type MapSize = "S" | "M" | "L";

export const WORLD_SIZE = 128;

export const MAP_PRESETS: Record<MapSize, { owned: number }> = {
  S: { owned: 32 },
  M: { owned: 44 },
  L: { owned: 60 },
};

export const DIFFICULTY_PRESETS: Record<
  Difficulty,
  { startCash: number; startDebt: number; interestApr: number }
> = {
  // cents; GAME_DESIGN.md §15.6–15.7
  relaxed: { startCash: 3_500_000, startDebt: 0, interestApr: 0.04 },
  classic: { startCash: 2_500_000, startDebt: 1_000_000, interestApr: 0.08 },
  tycoon: { startCash: 1_750_000, startDebt: 1_500_000, interestApr: 0.11 },
};

export interface PlacedEntity {
  id: number;
  defId: string;
  /** Anchor tile (min-x/min-z corner of the rotated footprint). */
  x: number;
  z: number;
  /** Rotation in 90° steps, 0..3. */
  rot: number;
  /** Sim tick when placed (drives the demolish grace refund). */
  placedAt: number;
}

export interface ParkMeta {
  name: string;
  difficulty: Difficulty;
  mapSize: MapSize;
  guidedStart: boolean;
  freeplayUnlocks: boolean;
}

export interface CameraState {
  targetX: number;
  targetZ: number;
  yaw: number;
  zoom: number;
}

export interface World {
  seed: number;
  rng: Rng;
  /** Total elapsed sim ticks. */
  time: number;
  /** Cash in integer cents. */
  cash: number;
  /** Outstanding loan principal in cents (interest arrives Phase 3). */
  debt: number;
  meta: ParkMeta;
  tiles: TileMap;
  /** Owned rectangle (x0, z0, w, d) — expandable later via land plots. */
  ownedRect: { x0: number; z0: number; w: number; d: number };
  /** Entrance tiles (on the south edge of the owned rect). */
  entrance: { x: number; z: number };
  placeables: Map<number, PlacedEntity>;
  placeableIds: IdSource;
  camera: CameraState;
}

export interface NewParkConfig {
  name: string;
  seed: number;
  difficulty: Difficulty;
  mapSize: MapSize;
  guidedStart: boolean;
  freeplayUnlocks: boolean;
}

export function createWorld(config: NewParkConfig): World {
  const tiles = createTileMap(WORLD_SIZE);
  const ownedSize = MAP_PRESETS[config.mapSize].owned;
  const x0 = Math.floor((WORLD_SIZE - ownedSize) / 2);
  // Owned rect sits with its south edge on the map's lower-middle so the
  // approach promenade has room (GAME_DESIGN.md §3).
  const z0 = Math.floor((WORLD_SIZE - ownedSize) / 2);
  setOwnedRect(tiles, x0, z0, ownedSize, ownedSize, 1);

  const diff = DIFFICULTY_PRESETS[config.difficulty];
  const entranceX = x0 + Math.floor(ownedSize / 2);
  const entranceZ = z0 + ownedSize - 1; // south edge (max z)

  return {
    seed: config.seed,
    rng: createRng(config.seed),
    time: 0,
    cash: diff.startCash,
    debt: diff.startDebt,
    meta: {
      name: config.name,
      difficulty: config.difficulty,
      mapSize: config.mapSize,
      guidedStart: config.guidedStart,
      freeplayUnlocks: config.freeplayUnlocks,
    },
    tiles,
    ownedRect: { x0, z0, w: ownedSize, d: ownedSize },
    entrance: { x: entranceX, z: entranceZ },
    placeables: new Map(),
    placeableIds: createIdSource(),
    camera: {
      targetX: entranceX + 0.5,
      targetZ: entranceZ - 6,
      yaw: 0,
      zoom: 0.45,
    },
  };
}

/** Rebuild run-time helpers (rng, id source) from persisted primitives. */
export function reviveWorldInternals(
  world: Omit<World, "rng" | "placeableIds"> & { rngState: number; placeableIdCounter: number },
): World {
  return {
    ...world,
    rng: restoreRng(world.rngState),
    placeableIds: createIdSource(world.placeableIdCounter),
  };
}
