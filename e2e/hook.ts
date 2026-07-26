/**
 * Shared shape of the `window.__wanderpark` debug hook (GameRoot exposes
 * { sim, store: useGameStore }). One declaration so specs don't collide.
 */

export interface WanderparkHook {
  sim: {
    world: {
      entrance: { x: number; z: number };
      coasters: Map<number, unknown>;
      staff: unknown[];
      cash: number;
      camera: { targetX: number; targetZ: number; zoom: number };
      meta: { name: string };
      loans: { bankrupt: boolean };
    };
    dispatch(cmd: unknown): { ok: boolean };
  };
  store: {
    getState(): {
      startCoasterDraft(family: string, entry: unknown): void;
      setTool(tool: unknown): void;
      setParkPanel(tab: string | null): void;
      setManualOpen(open: boolean): void;
      setMilestoneSheet(d: unknown): void;
      setParkOver(reason: string | null): void;
    };
  };
}

declare global {
  interface Window {
    __wanderpark?: WanderparkHook;
  }
}
