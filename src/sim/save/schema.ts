/**
 * Save schema, versioned from day 1 (CLAUDE.md §4.3).
 * CURRENT_FORMAT_VERSION bumps with any shape change, always alongside a
 * migration in ./migrate.ts and a fixture test.
 *
 * v2 (Phase 2): guests, ride/stall runtime state, economy ledger, litter,
 * rating value-EMA, milestones.
 */

import { z } from "zod";

export const CURRENT_FORMAT_VERSION = 2;

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
  }),
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

export const saveV2Schema = z.object({
  formatVersion: z.literal(2),
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
});

export type SaveV2 = z.infer<typeof saveV2Schema>;
export type SaveFile = SaveV2; // latest version alias
