/**
 * Minimal typed event emitter — the one-way channel from sim to presentation
 * (TECHNICAL_ARCHITECTURE.md §4). Fire-and-forget; the sim never awaits
 * listeners and never reads back.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional-any: generic event map constraint
export type EventMap = Record<string, any>;

export interface Emitter<E extends EventMap> {
  on<K extends keyof E>(type: K, fn: (payload: E[K]) => void): () => void;
  emit<K extends keyof E>(type: K, payload: E[K]): void;
  clear(): void;
}

export function createEmitter<E extends EventMap>(): Emitter<E> {
  const listeners = new Map<keyof E, Set<(payload: never) => void>>();
  return {
    on(type, fn) {
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add(fn as (payload: never) => void);
      return () => set?.delete(fn as (payload: never) => void);
    },
    emit(type, payload) {
      const set = listeners.get(type);
      if (!set) return;
      for (const fn of set) (fn as (p: E[typeof type]) => void)(payload);
    },
    clear() {
      listeners.clear();
    },
  };
}
