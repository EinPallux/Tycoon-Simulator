/**
 * The World: the single mutable simulation state object.
 * Created fresh (new park) or loaded (save). Mutated ONLY by command
 * execution and the tick pipeline (TECHNICAL_ARCHITECTURE.md §5–6).
 */

import { createIdSource, type IdSource } from "@/shared/ids";
import { createRng, restoreRng, type Rng } from "@/shared/rng";
import { createGuestsPool, type GuestsPool } from "../entities/guests";
import { DEFAULT_ENTRY_PRICE, type ExpenseSource, type IncomeSource } from "../balance/economy";
import type { CampaignKind, StaffRole, WeatherKind } from "../balance/phase3";
import type { Coaster } from "../coaster/coaster";
import type { ResearchBranchId } from "@/content/research";
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
  {
    startCash: number;
    startDebt: number;
    interestApr: number;
    /** Breakdown chance multiplier (§15.7: relaxed −50%, tycoon +40%). */
    breakdownMult: number;
    /** Queue patience multiplier (relaxed guests wait 15% longer). */
    patienceMult: number;
    /** Entry-price elasticity: >1 punishes pricey gates harder. */
    elasticityMult: number;
    /** Dynamic-event cadence multiplier (<1 = more frequent). */
    eventGapMult: number;
  }
> = {
  // cents; GAME_DESIGN.md §15.6–15.7
  relaxed: {
    startCash: 3_500_000, startDebt: 0, interestApr: 0.04,
    breakdownMult: 0.5, patienceMult: 1.15, elasticityMult: 0.9, eventGapMult: 1.25,
  },
  classic: {
    startCash: 2_500_000, startDebt: 1_000_000, interestApr: 0.08,
    breakdownMult: 1, patienceMult: 1, elasticityMult: 1, eventGapMult: 1,
  },
  tycoon: {
    startCash: 1_750_000, startDebt: 1_500_000, interestApr: 0.11,
    breakdownMult: 1.4, patienceMult: 1, elasticityMult: 1.15, eventGapMult: 0.8,
  },
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

/** Per-placed-ride runtime state (flat rides AND coaster stations). */
export interface RideState {
  entityId: number;
  open: boolean;
  /** Ticket price in cents (starts at def default). */
  price: number;
  phase: "idle" | "loading" | "running" | "unloading" | "broken";
  /** Ticks remaining in the current phase. */
  phaseT: number;
  /** Guest ids on board. */
  riders: number[];
  /** Guest ids waiting, front = next to board. */
  queue: number[];
  lifetimeRiders: number;
  /** Income today in cents (resets at day rollover). */
  incomeToday: number;
  /** 0–100; low reliability breeds breakdowns (Phase 3). */
  reliability: number;
  /** Ticks of repair remaining while broken and being fixed (−1 = waiting). */
  repairT: number;
}

export interface Staff {
  id: number;
  role: StaffRole;
  name: string;
  x: number;
  z: number;
  px: number;
  pz: number;
  heading: number;
  /** Path being followed (tile indices) + step. */
  path: number[];
  pathStep: number;
  /** Current job target: litter tile idx / ride entity id / queue tile (−1 none). */
  jobTarget: number;
  /** Ticks of current job work remaining (0 = walking/idle). */
  workT: number;
  hiredDay: number;
  /** Career sweeps/repairs/cheers (skill grows with tenure). */
  jobsDone: number;
}

export interface WeatherState {
  current: WeatherKind;
  /** What the forecast says comes next. */
  next: WeatherKind;
  /** Tick when `next` takes over. */
  changeAt: number;
}

export interface ResearchState {
  /** Nodes completed per branch (0..6). */
  done: Record<ResearchBranchId, number>;
  active: ResearchBranchId | null;
  /** Funding level index into FUNDING_LEVELS. */
  funding: number;
  /** Research-days accumulated toward the next node. */
  progressDays: number;
  /** Perk flags earned. */
  perks: string[];
}

export interface LoanState {
  /** Extra tranches beyond the starting debt. */
  tranches: number;
  missedPayments: number;
  /** Set when the bank has fully foreclosed — the park-over state. */
  bankrupt: boolean;
}

export interface ActiveEvent {
  kind: string;
  endsAt: number;
}

export interface EventsState {
  nextAt: number;
  active: ActiveEvent | null;
}

export interface MarketingState {
  active: { kind: CampaignKind; endsAt: number } | null;
  hangoverUntil: number;
}

/** Lifetime park counters — fuel for Opportunities, achievements & records. */
export interface Tallies {
  peakGuests: number;
  happyLeavers: number;
  guestsLeft: number;
  stallSales: number;
  toiletUses: number;
  coasterRiders: number;
  breakdowns: number;
  /** Tick of the most recent breakdown (uptime goals). */
  lastBreakdownAt: number;
  mechanicRepairs: number;
  litterSwept: number;
  sceneryPlaced: number;
  loansTaken: number;
  centsRepaid: number;
  campaignsRun: number;
  researchCompleted: number;
  zonesFormed: number;
  opportunitiesDone: number;
}

export const createTallies = (): Tallies => ({
  peakGuests: 0,
  happyLeavers: 0,
  guestsLeft: 0,
  stallSales: 0,
  toiletUses: 0,
  coasterRiders: 0,
  breakdowns: 0,
  lastBreakdownAt: -100_000,
  mechanicRepairs: 0,
  litterSwept: 0,
  sceneryPlaced: 0,
  loansTaken: 0,
  centsRepaid: 0,
  campaignsRun: 0,
  researchCompleted: 0,
  zonesFormed: 0,
  opportunitiesDone: 0,
});

/** An accepted or offered Opportunity (GAME_DESIGN.md §13). */
export interface Opportunity {
  id: number;
  templateId: string;
  category: string;
  text: string;
  kind: "reach" | "delta" | "hold-days";
  target: number;
  baseline: number;
  /** Hold-days counter (managed at day rollover). */
  progress: number;
  /** Tick when it quietly expires (0 = no deadline). */
  deadlineAt: number;
  acceptedAt: number;
  reward: { kind: "cash" | "research" | "scenery" | "campaign"; amount: number; itemId?: string };
}

export interface OpportunitiesState {
  /** The current un-accepted offer, if any. */
  offered: Opportunity | null;
  offerExpiresAt: number;
  /** Accepted, in progress (max 2). */
  active: Opportunity[];
  nextOfferAt: number;
  idCounter: number;
  completed: number;
}

/** A detected themed zone (derived from placeables; names persist). */
export interface Zone {
  /** Stable-ish identity: `${theme}:${minX},${minZ}` of the cluster bbox. */
  key: string;
  theme: string;
  name: string;
  pieces: number;
  /** Cluster bounds (tiles, inclusive). */
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** Ride entity ids inside/adjacent — they get the excitement bonus. */
  rideIds: number[];
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
  expense: {
    construction: 0,
    upkeep: 0,
    goods: 0,
    wages: 0,
    interest: 0,
    repairs: 0,
    research: 0,
    marketing: 0,
  },
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

  // ── Coasters & chaos (Phase 3) ───────────────────────────────────────
  /** Keyed by station entity id. */
  coasters: Map<number, Coaster>;
  staff: Staff[];
  staffIds: IdSource;
  weather: WeatherState;
  research: ResearchState;
  loans: LoanState;
  events: EventsState;
  marketing: MarketingState;

  // ── Progression & polish (Phase 4) ───────────────────────────────────
  tallies: Tallies;
  opportunities: OpportunitiesState;
  /** Derived from placeables (recomputed on edit); names live in zoneNames. */
  zones: Zone[];
  /** Player names for zones, keyed by zone key. */
  zoneNames: Record<string, string>;
  /** Reward-unlocked cosmetic def ids (Opportunities). */
  bonusUnlocks: string[];
  /** Guided Start checklist dismissed for this park. */
  guidedDismissed: boolean;
}

export const createResearchState = (): ResearchState => ({
  done: { thrill: 0, family: 0, food: 0, ops: 0 },
  active: null,
  funding: 1,
  progressDays: 0,
  perks: [],
});

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
      // Neutral priors — reputation is earned, not granted (Phase-5 tuning).
      terms: { happiness: 0.45, rides: 0, cleanliness: 1, scenery: 0, value: 0.55 },
      valueEma: 0.55,
    },
    milestoneTier: -1,
    spawnAcc: 0,
    coasters: new Map(),
    staff: [],
    staffIds: createIdSource(),
    weather: { current: "sun", next: "sun", changeAt: START_TIME_TICKS + TICKS_PER_DAY / 2 },
    research: createResearchState(),
    loans: { tranches: 0, missedPayments: 0, bankrupt: false },
    events: { nextAt: START_TIME_TICKS + TICKS_PER_DAY * 2, active: null },
    marketing: { active: null, hangoverUntil: 0 },
    tallies: createTallies(),
    opportunities: {
      offered: null,
      offerExpiresAt: 0,
      active: [],
      nextOfferAt: START_TIME_TICKS + Math.round(TICKS_PER_DAY * 1.2),
      idCounter: 0,
      completed: 0,
    },
    zones: [],
    zoneNames: {},
    bonusUnlocks: [],
    guidedDismissed: false,
  };
}

// (restoreRng re-exported path: save/serialize.ts revives worlds from saves.)
export { restoreRng };
