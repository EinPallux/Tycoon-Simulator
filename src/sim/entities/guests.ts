/**
 * Guest pool — data-oriented storage for up to MAX_GUESTS agents
 * (TECHNICAL_ARCHITECTURE.md §5): hot per-tick fields in typed arrays
 * (slot-indexed), cold identity data in a map (id-indexed).
 * Slots are recycled through a freelist; ids are never reused.
 */

import { MAX_GUESTS } from "../balance/guests";

export const GUEST_STATE = {
  none: 0,
  approaching: 1, // outside → entrance tile
  strolling: 2, // on paths, picking a goal
  traveling: 3, // following a path to a target
  queuing: 4,
  riding: 5,
  buying: 6, // standing at a stall/facility
  leaving: 7, // heading for the entrance
  departing: 8, // entrance → outside → despawn
} as const;
export type GuestState = (typeof GUEST_STATE)[keyof typeof GUEST_STATE];

export interface GuestCold {
  id: number;
  name: string;
  /** 0 = family-calm … 1 = thrill-seeker. */
  thrill: number;
  /** Queue patience multiplier 0.6…1.4. */
  patience: number;
  /** Wallet in cents. */
  money: number;
  /** Character model index (crowd variety). */
  modelIdx: number;
  /** Current tile path (indices), consumed front-to-back. */
  path: number[];
  /** Step within `path`. */
  pathStep: number;
  /** Target entity id (ride/stall) or 0. */
  target: number;
  /** Thought log, newest first, capped. */
  thoughts: string[];
  /** Sim day the guest arrived. */
  arrivedDay: number;
  /** Lifetime rides ridden (for stats/thoughts). */
  ridesRidden: number;
}

export interface GuestsPool {
  /** Live slot count (dense 0..count-1). */
  count: number;
  /** slot → guest id. */
  ids: Int32Array;
  /** id → slot. */
  slotOf: Map<number, number>;
  /** Positions (world units). p* = previous tick, for render interpolation. */
  x: Float32Array;
  z: Float32Array;
  px: Float32Array;
  pz: Float32Array;
  heading: Float32Array;
  /** Needs 0..100. */
  fun: Float32Array;
  hunger: Float32Array;
  thirst: Float32Array;
  energy: Float32Array;
  bladder: Float32Array;
  /** Decaying experience offset (±) feeding mood. */
  xp: Float32Array;
  /** Derived mood 0..100. */
  mood: Float32Array;
  state: Uint8Array;
  /** Generic per-state timer in ticks. */
  timer: Float32Array;
  /** Active emote id (0 none) + remaining ticks. */
  emote: Uint8Array;
  emoteTtl: Float32Array;
  cold: Map<number, GuestCold>;
}

export function createGuestsPool(): GuestsPool {
  return {
    count: 0,
    ids: new Int32Array(MAX_GUESTS),
    slotOf: new Map(),
    x: new Float32Array(MAX_GUESTS),
    z: new Float32Array(MAX_GUESTS),
    px: new Float32Array(MAX_GUESTS),
    pz: new Float32Array(MAX_GUESTS),
    heading: new Float32Array(MAX_GUESTS),
    fun: new Float32Array(MAX_GUESTS),
    hunger: new Float32Array(MAX_GUESTS),
    thirst: new Float32Array(MAX_GUESTS),
    energy: new Float32Array(MAX_GUESTS),
    bladder: new Float32Array(MAX_GUESTS),
    xp: new Float32Array(MAX_GUESTS),
    mood: new Float32Array(MAX_GUESTS),
    state: new Uint8Array(MAX_GUESTS),
    timer: new Float32Array(MAX_GUESTS),
    emote: new Uint8Array(MAX_GUESTS),
    emoteTtl: new Float32Array(MAX_GUESTS),
    cold: new Map(),
  };
}

export interface SpawnGuestInput {
  id: number;
  name: string;
  thrill: number;
  patience: number;
  money: number;
  modelIdx: number;
  x: number;
  z: number;
  day: number;
}

/** Add a guest; returns the slot (or -1 when the pool is full). */
export function addGuest(pool: GuestsPool, input: SpawnGuestInput): number {
  if (pool.count >= MAX_GUESTS) return -1;
  const slot = pool.count++;
  pool.ids[slot] = input.id;
  pool.slotOf.set(input.id, slot);
  pool.x[slot] = input.x;
  pool.z[slot] = input.z;
  pool.px[slot] = input.x;
  pool.pz[slot] = input.z;
  pool.heading[slot] = 0;
  pool.fun[slot] = 55 + (input.thrill - 0.5) * 10;
  pool.hunger[slot] = 60;
  pool.thirst[slot] = 60;
  pool.energy[slot] = 85;
  pool.bladder[slot] = 15;
  pool.xp[slot] = 0;
  pool.mood[slot] = 70;
  pool.state[slot] = GUEST_STATE.approaching;
  pool.timer[slot] = 0;
  pool.emote[slot] = 0;
  pool.emoteTtl[slot] = 0;
  pool.cold.set(input.id, {
    id: input.id,
    name: input.name,
    thrill: input.thrill,
    patience: input.patience,
    money: input.money,
    modelIdx: input.modelIdx,
    path: [],
    pathStep: 0,
    target: 0,
    thoughts: [],
    arrivedDay: input.day,
    ridesRidden: 0,
  });
  return slot;
}

/** Remove by id — swaps the last slot into the hole to stay dense. */
export function removeGuest(pool: GuestsPool, id: number): void {
  const slot = pool.slotOf.get(id);
  if (slot === undefined) return;
  const last = pool.count - 1;
  const arrays = [
    pool.x, pool.z, pool.px, pool.pz, pool.heading,
    pool.fun, pool.hunger, pool.thirst, pool.energy, pool.bladder,
    pool.xp, pool.mood, pool.timer, pool.emoteTtl,
  ];
  if (slot !== last) {
    for (const a of arrays) a[slot] = a[last] as number;
    pool.state[slot] = pool.state[last] as number;
    pool.emote[slot] = pool.emote[last] as number;
    const movedId = pool.ids[last] as number;
    pool.ids[slot] = movedId;
    pool.slotOf.set(movedId, slot);
  }
  pool.count = last;
  pool.slotOf.delete(id);
  pool.cold.delete(id);
}

export function pushThought(cold: GuestCold, thought: string): void {
  cold.thoughts.unshift(thought);
  if (cold.thoughts.length > 8) cold.thoughts.length = 8;
}

/** Emote ids (render maps them to sprites; 0 = none). */
export const EMOTE = {
  none: 0,
  happy: 1,
  star: 2,
  heart: 3,
  hungry: 4,
  thirsty: 5,
  tired: 6,
  toilet: 7,
  angry: 8,
  expensive: 9,
  sad: 10,
  idea: 11,
} as const;
export type EmoteId = (typeof EMOTE)[keyof typeof EMOTE];

export function setEmote(pool: GuestsPool, slot: number, emote: EmoteId, seconds = 2.6): void {
  pool.emote[slot] = emote;
  pool.emoteTtl[slot] = seconds * 10;
}
