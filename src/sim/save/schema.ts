/**
 * Save schema, versioned from day 1 (CLAUDE.md §4.3).
 * CURRENT_FORMAT_VERSION bumps with any shape change, always alongside a
 * migration in ./migrate.ts and a fixture test.
 *
 * v2 (Phase 2): guests, ride/stall runtime state, economy ledger, litter,
 * rating value-EMA, milestones.
 */

import { z } from "zod";

export const CURRENT_FORMAT_VERSION = 3;

export const placedEntitySchema = z.object({
  id: z.number().int().positive(),
  defId: z.string(),
  x: z.number().int(),
  z: z.number().int(),
  rot: z.number().int().min(0).max(3),
  placedAt: z.number().int().nonnegative(),
});

const ledgerSchema = z.object({
  day: z.number().int().positive(),
  income: z.object({
    entry: z.number().int(),
    rides: z.number().int(),
    stalls: z.number().int(),
    refunds: z.number().int(),
  }),
  expense: z.object({
    construction: z.number().int(),
    upkeep: z.number().int(),
    goods: z.number().int(),
    wages: z.number().int(),
    interest: z.number().int(),
    repairs: z.number().int(),
    research: z.number().int(),
    marketing: z.number().int(),
  }),
});

const trackNodeSchema = z.object({
  x: z.number(),
  z: z.number(),
  h: z.number().int(),
  dir: z.number().int().min(0).max(3),
});

const coasterSchema = z.object({
  entityId: z.number().int().positive(),
  family: z.enum(["mouse", "flume"]),
  pieces: z.array(
    z.object({
      type: z.enum([
        "station",
        "straight",
        "corner-left",
        "corner-right",
        "slope-up",
        "slope-down",
        "loop",
      ]),
      entry: trackNodeSchema,
    }),
  ),
});

const staffSchema = z.object({
  id: z.number().int().positive(),
  role: z.enum(["janitor", "mechanic", "entertainer"]),
  name: z.string(),
  x: z.number(),
  z: z.number(),
  hiredDay: z.number().int().positive(),
  jobsDone: z.number().int().nonnegative(),
});

const guestSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  thrill: z.number(),
  patience: z.number(),
  money: z.number().int(),
  modelIdx: z.number().int().min(0).max(7),
  x: z.number(),
  z: z.number(),
  fun: z.number(),
  hunger: z.number(),
  thirst: z.number(),
  energy: z.number(),
  bladder: z.number(),
  xp: z.number(),
  mood: z.number(),
  ridesRidden: z.number().int().nonnegative(),
  arrivedDay: z.number().int().positive(),
  thoughts: z.array(z.string()).max(8),
});

export const saveV3Schema = z.object({
  formatVersion: z.literal(3),
  appVersion: z.string(),
  seed: z.number(),
  rngState: z.number(),
  time: z.number().int().nonnegative(),
  cash: z.number().int(),
  debt: z.number().int().nonnegative(),
  meta: z.object({
    name: z.string().min(1).max(64),
    difficulty: z.enum(["relaxed", "classic", "tycoon"]),
    mapSize: z.enum(["S", "M", "L"]),
    guidedStart: z.boolean(),
    freeplayUnlocks: z.boolean(),
  }),
  world: z.object({
    size: z.number().int().positive(),
    ownedRect: z.object({
      x0: z.number().int(),
      z0: z.number().int(),
      w: z.number().int().positive(),
      d: z.number().int().positive(),
    }),
    entrance: z.object({ x: z.number().int(), z: z.number().int() }),
    /** Base64 Uint8Array, length size*size. */
    surface: z.string(),
    /** Base64 Uint8Array, length size*size. */
    owned: z.string(),
  }),
  placeables: z.array(placedEntitySchema),
  placeableIdCounter: z.number().int().nonnegative(),
  camera: z.object({
    targetX: z.number(),
    targetZ: z.number(),
    yaw: z.number(),
    zoom: z.number(),
  }),
  // ── Phase 2 ──
  guests: z.array(guestSchema),
  guestIdCounter: z.number().int().nonnegative(),
  lifetimeGuests: z.number().int().nonnegative(),
  rides: z.array(
    z.object({
      entityId: z.number().int().positive(),
      open: z.boolean(),
      price: z.number().int().nonnegative(),
      lifetimeRiders: z.number().int().nonnegative(),
      reliability: z.number().min(0).max(100),
    }),
  ),
  stalls: z.array(
    z.object({
      entityId: z.number().int().positive(),
      price: z.number().int().nonnegative(),
    }),
  ),
  economy: z.object({
    entryPrice: z.number().int().nonnegative(),
    today: ledgerSchema,
    history: z.array(ledgerSchema),
    lifetimeIncome: z.number().int().nonnegative(),
    lifetimeExpense: z.number().int().nonnegative(),
  }),
  litter: z.array(z.object({ idx: z.number().int().nonnegative(), seed: z.number() })),
  valueEma: z.number(),
  milestoneTier: z.number().int().min(-1),
  spawnAcc: z.number(),
  // ── Phase 3 ──
  coasters: z.array(coasterSchema),
  staff: z.array(staffSchema),
  staffIdCounter: z.number().int().nonnegative(),
  weather: z.object({
    current: z.enum(["sun", "cloud", "rain", "storm", "heat"]),
    next: z.enum(["sun", "cloud", "rain", "storm", "heat"]),
    changeAt: z.number().int().nonnegative(),
  }),
  research: z.object({
    done: z.object({
      thrill: z.number().int().min(0).max(6),
      family: z.number().int().min(0).max(6),
      food: z.number().int().min(0).max(6),
      ops: z.number().int().min(0).max(6),
    }),
    active: z.enum(["thrill", "family", "food", "ops"]).nullable(),
    funding: z.number().int().min(0).max(2),
    progressDays: z.number().nonnegative(),
    perks: z.array(z.string()),
  }),
  loans: z.object({
    tranches: z.number().int().nonnegative(),
    missedPayments: z.number().int().nonnegative(),
    bankrupt: z.boolean(),
  }),
  events: z.object({ nextAt: z.number().int().nonnegative() }),
  marketing: z.object({
    activeKind: z.enum(["flyers", "radio", "tv", "influencer"]).nullable(),
    activeEndsAt: z.number().int().nonnegative(),
    hangoverUntil: z.number().int().nonnegative(),
  }),
});

export type SaveV3 = z.infer<typeof saveV3Schema>;
export type SaveFile = SaveV3; // latest version alias
