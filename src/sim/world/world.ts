/**
 * The World: the single mutable simulation state object.
 * Created fresh (new park) or loaded (save). Mutated ONLY by command
 * execution and the tick pipeline (TECHNICAL_ARCHITECTURE.md §5–6).
 */

import { createIdSource, type IdSource } from "@/shared/ids";
import { createRng, restoreRng, type Rng } from "@/shared/rng";
import { createGuestsPool, type GuestsPool } from "../entities/guests";
import { DEFAULT_ENTRY_PRICE, type ExpenseSource, type IncomeSource } from "../balance/economy";
import { createTileMap, setOwnedRect, type TileMap } from "./tiles";
import { TICKS_PER_DAY } from "./time";

/** New parks open at 09:00 on Day 1 — nobody founds an empire at midnight. */
export const START_TIME_TICKS = Math.round(TICKS_PER_DAY * 0.375);

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

/** Per-placed-ride runtime state. */
export interface RideState {
  entityId: number;
  open: boolean;
  /** Ticket price in cents (starts at def default). */
  price: number;
  phase: "idle" | "loading" | "running" | "unloading";
  /** Ticks remaining in the current phase. */
  phaseT: number;
  /** Guest ids on board. */
  riders: number[];
  /** Guest ids waiting, front = next to board. */
  queue: number[];
  lifetimeRiders: number;
  /** Income today in cents (resets at day rollover). */
  incomeToday: number;
}

export interface StallState {
  entityId: number;
  /** Item price override in cents. */
  price: number;
  salesToday: number;
  incomeToday: number;
}

export interface DayLedger {
  day: number;
  income: Record<IncomeSource, number>;
  expense: Record<ExpenseSource, number>;
}

export interface EconomyState {
  entryPrice: number;
  /** Current (accumulating) day. */
  today: DayLedger;
  /** Closed days, newest first, capped. */
  history: DayLedger[];
  lifetimeIncome: number;
  lifetimeExpense: number;
}

export interface LitterItem {
  /** Tile index. */
  idx: number;
  /** Deterministic visual jitter seed. */
  seed: number;
}

export interface RatingState {
  /** 0..1000 composite. */
  value: number;
  terms: {
    happiness: number;
    rides: number;
    cleanliness: number;
    scenery: number;
    value: number;
  };
  /** Value-perception EMA 0..1 fed by price verdicts. */
  valueEma: number;
}

export const emptyDayLedger = (day: number): DayLedger => ({
  day,
  income: { entry: 0, rides: 0, stalls: 0, refunds: 0 },
  expense: { construction: 0, upkeep: 0, goods: 0 },
});

export const createEconomy = (): EconomyState => ({
  entryPrice: DEFAULT_ENTRY_PRICE,
  today: emptyDayLedger(1),
  history: [],
  lifetimeIncome: 0,
  lifetimeExpense: 0,
});

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

  // ── The living park (Phase 2) ────────────────────────────────────────
  guests: GuestsPool;
  guestIds: IdSource;
  /** Total guests who ever entered (milestones). */
  lifetimeGuests: number;
  rides: Map<number, RideState>;
  stalls: Map<number, StallState>;
  economy: EconomyState;
  litter: LitterItem[];
  rating: RatingState;
  /** Highest milestone tier index reached (−1 = none). */
  milestoneTier: number;
  /** Fractional spawn accumulator. */
  spawnAcc: number;
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
    time: START_TIME_TICKS,
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
    guests: createGuestsPool(),
    guestIds: createIdSource(),
    lifetimeGuests: 0,
    rides: new Map(),
    stalls: new Map(),
    economy: createEconomy(),
    litter: [],
    rating: {
      value: 0,
      terms: { happiness: 0.7, rides: 0, cleanliness: 1, scenery: 0, value: 0.7 },
      valueEma: 0.7,
    },
    milestoneTier: -1,
    spawnAcc: 0,
  };
}

// (restoreRng re-exported path: save/serialize.ts revives worlds from saves.)
export { restoreRng };
