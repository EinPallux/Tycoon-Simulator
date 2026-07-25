/**
 * Stable numeric id allocation, one counter per pool.
 * Ids start at 1 (0 = "none" in tile occupancy arrays) and are never reused
 * within a save (CLAUDE.md §6).
 */

export interface IdSource {
  nextId(): number;
  /** Highest id handed out so far (persisted in saves). */
  current(): number;
}

export function createIdSource(start = 0): IdSource {
  let counter = start;
  return {
    nextId: () => ++counter,
    current: () => counter,
  };
}
