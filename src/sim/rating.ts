/**
 * Park rating 0–1000 — five weighted terms + "what's hurting you" hints
 * (GAME_DESIGN.md §9, §15.4).
 */

import { getPlaceableDef } from "@/content/catalog";
import { SURFACE_PATH } from "./world/tiles";
import type { World } from "./world/world";

export const RATING_WEIGHTS = {
  happiness: 0.35,
  rides: 0.25,
  cleanliness: 0.15,
  scenery: 0.15,
  value: 0.1,
} as const;

export function computeRating(world: World): void {
  const guests = world.guests;

  // Happiness: average mood (neutral-ish baseline with no guests).
  let happiness = 0.7;
  if (guests.count > 0) {
    let sum = 0;
    for (let i = 0; i < guests.count; i++) sum += guests.mood[i] as number;
    happiness = sum / guests.count / 100;
  }

  // Rides: excitement mass + variety of open rides.
  let excitementSum = 0;
  const kinds = new Set<string>();
  for (const [id, state] of world.rides) {
    if (!state.open) continue;
    const entity = world.placeables.get(id);
    if (!entity) continue;
    const ride = getPlaceableDef(entity.defId).ride;
    if (!ride) continue;
    excitementSum += Math.min(ride.excitement, 7);
    kinds.add(ride.kind);
  }
  const rides = Math.min(1, excitementSum / 30) * 0.7 + Math.min(1, kinds.size / 6) * 0.3;

  // Cleanliness: litter density vs path coverage.
  let pathTiles = 0;
  const t = world.tiles;
  const { x0, z0, w, d } = world.ownedRect;
  for (let z = z0; z < z0 + d; z++) {
    for (let x = x0; x < x0 + w; x++) {
      if (t.surface[z * t.size + x] === SURFACE_PATH) pathTiles++;
    }
  }
  const cleanliness = 1 - Math.min(1, world.litter.length / Math.max(12, pathTiles * 0.5));

  // Scenery: total placed beauty vs park size (diminishing).
  let beautySum = 0;
  for (const entity of world.placeables.values()) {
    beautySum += getPlaceableDef(entity.defId).beauty;
  }
  const scenery = Math.min(1, beautySum / Math.max(40, pathTiles * 1.2));

  const value = world.rating.valueEma;

  world.rating.terms = { happiness, rides, cleanliness, scenery, value };
  world.rating.value = Math.round(
    1000 *
      (happiness * RATING_WEIGHTS.happiness +
        rides * RATING_WEIGHTS.rides +
        cleanliness * RATING_WEIGHTS.cleanliness +
        scenery * RATING_WEIGHTS.scenery +
        value * RATING_WEIGHTS.value),
  );
}

export interface RatingHint {
  term: keyof typeof RATING_WEIGHTS;
  message: string;
}

const HINTS: Record<keyof typeof RATING_WEIGHTS, string> = {
  happiness: "Guests are grumpy — check their needs (food, drink, fun, toilets).",
  rides: "More (and more exciting) open rides would lift the park fast.",
  cleanliness: "Litter is piling up — add bins near snack spots.",
  scenery: "The park looks bare — trees and decoration around paths pay off.",
  value: "Guests feel prices are steep — nudge tickets or entry down.",
};

/** The 1–3 weakest terms with human advice (weakest first). */
export function ratingHints(world: World): RatingHint[] {
  const entries = Object.entries(world.rating.terms) as [keyof typeof RATING_WEIGHTS, number][];
  return entries
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .filter(([, v]) => v < 0.85)
    .map(([term]) => ({ term, message: HINTS[term] }));
}

// ── Milestones (GAME_DESIGN.md §10.1) ────────────────────────────────────

export interface MilestoneTier {
  name: string;
  rating: number;
  lifetimeGuests: number;
  /** Cash award in cents. */
  award: number;
}

export const MILESTONES: readonly MilestoneTier[] = [
  { name: "Local Attraction", rating: 150, lifetimeGuests: 25, award: 50_000 },
  { name: "Rising Star", rating: 300, lifetimeGuests: 120, award: 100_000 },
  { name: "Regional Star", rating: 450, lifetimeGuests: 400, award: 200_000 },
  { name: "National Treasure", rating: 650, lifetimeGuests: 1_200, award: 400_000 },
  { name: "World Wonder", rating: 850, lifetimeGuests: 4_000, award: 1_000_000 },
];

/** Returns the newly reached tier (index) or −1. */
export function checkMilestones(world: World): number {
  const next = world.milestoneTier + 1;
  const tier = MILESTONES[next];
  if (!tier) return -1;
  if (world.rating.value >= tier.rating && world.lifetimeGuests >= tier.lifetimeGuests) {
    world.milestoneTier = next;
    return next;
  }
  return -1;
}
