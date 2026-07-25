/**
 * Save schema, versioned from day 1 (CLAUDE.md §4.3).
 * CURRENT_FORMAT_VERSION bumps with any shape change, always alongside a
 * migration in ./migrate.ts and a fixture test.
 */

import { z } from "zod";

export const CURRENT_FORMAT_VERSION = 1;

export const placedEntitySchema = z.object({
  id: z.number().int().positive(),
  defId: z.string(),
  x: z.number().int(),
  z: z.number().int(),
  rot: z.number().int().min(0).max(3),
  placedAt: z.number().int().nonnegative(),
});

export const saveV1Schema = z.object({
  formatVersion: z.literal(1),
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
});

export type SaveV1 = z.infer<typeof saveV1Schema>;
export type SaveFile = SaveV1; // latest version alias
