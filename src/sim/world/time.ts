/**
 * Sim time constants and helpers (CLAUDE.md §6 units).
 * 10 logic ticks per second at 1×; one in-game day is 90 real seconds at 1×.
 */

export const TICKS_PER_SEC = 10;
export const SECONDS_PER_DAY = 90;
export const TICKS_PER_DAY = TICKS_PER_SEC * SECONDS_PER_DAY; // 900
export const DAYS_PER_WEEK = 7;

export type GameSpeed = 0 | 1 | 2 | 3;

export const dayOfTime = (ticks: number): number => Math.floor(ticks / TICKS_PER_DAY) + 1;

/** 0..1 across the day; 0 = midnight, 0.5 = noon. */
export const timeOfDay01 = (ticks: number): number => (ticks % TICKS_PER_DAY) / TICKS_PER_DAY;

export function formatClock(ticks: number): string {
  const t = timeOfDay01(ticks);
  const minutes = Math.floor(t * 24 * 60);
  const hh = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const mm = (minutes % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}
