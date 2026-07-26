/**
 * Guest simulation balance (GAME_DESIGN.md §15.1, §15.5).
 * ALL tunables in one place; the doc and this file change together.
 */

import { TICKS_PER_DAY } from "../world/time";

export const MAX_GUESTS = 500;

/**
 * Needs decay in points per SIM-HOUR (doc §15.1): guests arrive ~50 hungry
 * and cross the seek-food threshold (~35) by early afternoon — every park
 * day contains a lunch rush.
 */
export const DECAY_PER_HOUR = {
  fun: 5,
  hunger: 3.2,
  thirst: 4,
  energy: 2,
} as const;

/** Bladder RISES after consumption; passive rise is gentle. */
export const BLADDER_RISE_PER_HOUR = 1.6;
export const BLADDER_PER_MEAL = 18;
export const BLADDER_PER_DRINK = 26;

const TICKS_PER_HOUR = TICKS_PER_DAY / 24;
export const perTick = (perHour: number): number => perHour / TICKS_PER_HOUR;

/** Mood = 0.4·min(needs) + 0.6·avg(needs) + experience offset (±, decaying). */
export const MOOD_MIN_WEIGHT = 0.4;
export const MOOD_AVG_WEIGHT = 0.6;
/** Experience offset decay: halves roughly every 2 game days. */
export const EXPERIENCE_DECAY_PER_TICK = 0.99961;

/** Thresholds. */
export const NEED_LOW = 35; // guest starts seeking a fix
export const NEED_CRITICAL = 12; // grumpy thoughts, mood tank
export const MOOD_LEAVE = 22; // guests give up on the park
export const LEAVE_HOUR = 22 / 24; // everyone drifts home at night

/** Walking. */
export const WALK_SPEED = 1.15; // world units (tiles) per second at full energy
export const WALK_SPEED_TIRED = 0.7;

/** Spawning (doc §15.5). */
// Tuned in the Phase-5 balancing campaign: the old 20 + rating·0.35 made a
// one-ride park break even by day 2 — the §15.6 target band is day 8–12.
export const SPAWN_BASE_PER_DAY = 10;
export const SPAWN_PER_RATING = 0.065;
export const ENTRY_VALUE_CLAMP: readonly [number, number] = [0.2, 1.4];
/** entry_value = clamp(1.6 − entry$ / (6 + 0.02·rating), …). Entry in DOLLARS here. */
export const entryValue = (entryDollars: number, rating: number): number => {
  const v = 1.6 - entryDollars / (6 + 0.02 * rating);
  return Math.min(ENTRY_VALUE_CLAMP[1], Math.max(ENTRY_VALUE_CLAMP[0], v));
};

/** Arrival curve over the day (0..1); park is quiet at night. */
export function dayCurve(t01: number): number {
  if (t01 < 0.33 || t01 > 0.92) return 0;
  if (t01 < 0.45) return (t01 - 0.33) / 0.12; // morning ramp 8:00→10:48
  if (t01 < 0.71) return 1; // core hours
  return Math.max(0, 1 - (t01 - 0.71) / 0.21); // evening fade
}

/** Guest wallets in cents. */
export const GUEST_MONEY_MIN = 4_000;
export const GUEST_MONEY_MAX = 12_000;

/** Satisfaction restored by consumables (points). */
export const RESTORE = {
  food: 55,
  drink: 55,
  rest: 30, // benches (Phase 2: sitting is instant-ish)
} as const;

/** Queue patience: base REAL seconds a guest tolerates waiting (~2 cycles). */
export const QUEUE_PATIENCE_SEC = 26;

/** Litter: chance a snacking guest drops litter without a bin nearby. */
export const LITTER_CHANCE = 0.45;
export const BIN_RADIUS = 2.5; // tiles
export const MAX_LITTER = 400;

/** Experience offsets (added to mood offset, decaying). */
export const XP = {
  greatRide: 9,
  goodSnack: 4,
  queueBail: -7,
  tooExpensive: -5,
  litterSeen: -1.5,
  toiletRelief: 5,
  cantAfford: -4,
  noPath: -6,
} as const;

export const GUEST_NAMES_FIRST = [
  "Greta", "Momo", "Pablo", "Suki", "Ivan", "Lola", "Chip", "Nadia", "Bram", "Zoe",
  "Otis", "Mila", "Ravi", "Tess", "Hugo", "Wren", "Kofi", "Elsa", "Nino", "June",
] as const;

export const GUEST_NAMES_LAST = [
  "Loopington", "Vandersnack", "Whirlwhistle", "Cottonpuff", "McQueue", "Splashley",
  "Funderburk", "Waffleton", "Giggleman", "Parkhurst", "Twirlyton", "Snackerby",
] as const;
