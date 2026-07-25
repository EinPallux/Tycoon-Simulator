/**
 * Deterministic seeded RNG (mulberry32) — the ONLY source of randomness
 * allowed anywhere near the simulation (CLAUDE.md §4.4).
 *
 * Streams: derive independent generators per subsystem so adding a new
 * consumer never shifts the sequence of an existing one
 * (TECHNICAL_ARCHITECTURE.md §5).
 */

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Uniform float in [min, max). */
  range(min: number, max: number): number;
  /** True with probability p. */
  chance(p: number): boolean;
  /** Pick a uniform random element (throws on empty). */
  pick<T>(items: readonly T[]): T;
  /** Current internal state (for save/restore). */
  state(): number;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    range: (min, max) => min + next() * (max - min),
    chance: (p) => next() < p,
    pick: (items) => {
      if (items.length === 0) throw new Error("Rng.pick on empty array");
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return items[Math.floor(next() * items.length)]!;
    },
    state: () => a,
  };
}

/**
 * Restore a generator from a saved state value.
 * createRng's internal state IS the last-emitted `a`, so seeding with the
 * stored state resumes the exact sequence.
 */
export function restoreRng(state: number): Rng {
  return createRng(state);
}

/** FNV-1a hash of a label → 32-bit value, for deriving per-subsystem stream seeds. */
export function hashLabel(label: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Derive an independent stream from a root seed and a stable label. */
export function deriveStream(rootSeed: number, label: string): Rng {
  return createRng((rootSeed ^ hashLabel(label)) >>> 0);
}
