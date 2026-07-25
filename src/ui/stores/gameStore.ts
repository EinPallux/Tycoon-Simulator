"use client";

/**
 * In-game UI state + the sim↔presentation bridge.
 *
 * The mutable World lives inside SimHandle (NOT in React state). This store
 * mirrors only small, slow-changing values for the HUD (cash, day, tool…),
 * updated from sim events — never per-frame (TECHNICAL_ARCHITECTURE.md §10).
 * `worldVersion` bumps on any world edit so render layers re-derive instance
 * lists at edit-rate, not frame-rate.
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { SimHandle } from "@/sim/api";
import { dayOfTime, type GameSpeed } from "@/sim/world/time";

export type Tool =
  | { kind: "select" }
  | { kind: "path"; surface: "path" | "queue" }
  | { kind: "bulldoze" }
  | { kind: "place"; defId: string; rot: number }
  | { kind: "move"; entityId: number; rot: number };

export type DockCategory = "paths" | "scenery" | "stalls" | "rides" | null;
export type ParkPanelTab = "finances" | "guests" | "rating";

interface GameStore {
  sim: SimHandle | null;
  saveId: string | null;
  worldVersion: number;

  // HUD mirrors
  cash: number;
  day: number;
  clock: string;
  speed: GameSpeed;
  paused: boolean;
  canUndo: boolean;
  canRedo: boolean;
  guestCount: number;
  lifetimeGuests: number;
  ratingValue: number;

  // Interaction state
  tool: Tool;
  dockCategory: DockCategory;
  selectedEntity: number | null;
  selectedGuest: number | null;
  followGuest: boolean;
  parkPanel: ParkPanelTab | null;
  hoverInfo: string | null;
  perfOverlay: boolean;
  veilOpen: boolean;

  // Actions
  attach: (sim: SimHandle, saveId: string) => void;
  detach: () => void;
  bumpWorld: () => void;
  setHud: (
    patch: Partial<
      Pick<
        GameStore,
        | "cash"
        | "day"
        | "clock"
        | "canUndo"
        | "canRedo"
        | "guestCount"
        | "lifetimeGuests"
        | "ratingValue"
      >
    >,
  ) => void;
  setSpeed: (speed: GameSpeed) => void;
  togglePause: () => void;
  setTool: (tool: Tool) => void;
  setDockCategory: (category: DockCategory) => void;
  selectEntity: (id: number | null) => void;
  selectGuest: (id: number | null) => void;
  setFollowGuest: (follow: boolean) => void;
  setParkPanel: (tab: ParkPanelTab | null) => void;
  setHoverInfo: (info: string | null) => void;
  togglePerfOverlay: () => void;
  setVeilOpen: (open: boolean) => void;
  /** Esc back-chain: panel → tray → tool → selection → pause veil. */
  escape: () => void;
}

export const useGameStore = create<GameStore>()(
  subscribeWithSelector((set, get) => ({
    sim: null,
    saveId: null,
    worldVersion: 0,

    cash: 0,
    day: 1,
    clock: "09:00",
    speed: 1,
    paused: false,
    canUndo: false,
    canRedo: false,
    guestCount: 0,
    lifetimeGuests: 0,
    ratingValue: 0,

    tool: { kind: "select" },
    dockCategory: null,
    selectedEntity: null,
    selectedGuest: null,
    followGuest: false,
    parkPanel: null,
    hoverInfo: null,
    perfOverlay: false,
    veilOpen: false,

    attach: (sim, saveId) =>
      set({
        sim,
        saveId,
        worldVersion: 1,
        cash: sim.world.cash,
        day: dayOfTime(sim.world.time),
        guestCount: sim.world.guests.count,
        lifetimeGuests: sim.world.lifetimeGuests,
        ratingValue: sim.world.rating.value,
        speed: 1,
        paused: false,
        tool: { kind: "select" },
        dockCategory: null,
        selectedEntity: null,
        selectedGuest: null,
        followGuest: false,
        parkPanel: null,
        veilOpen: false,
      }),
    detach: () => set({ sim: null, saveId: null, worldVersion: 0 }),
    bumpWorld: () => set((s) => ({ worldVersion: s.worldVersion + 1 })),
    setHud: (patch) => set(patch),
    setSpeed: (speed) => set({ speed, paused: speed === 0 }),
    togglePause: () => set((s) => ({ paused: !s.paused })),
    setTool: (tool) =>
      set({
        tool,
        selectedEntity: tool.kind === "select" ? get().selectedEntity : null,
        selectedGuest: tool.kind === "select" ? get().selectedGuest : null,
      }),
    setDockCategory: (category) => set({ dockCategory: category }),
    selectEntity: (id) =>
      set({ selectedEntity: id, selectedGuest: null, followGuest: false, tool: { kind: "select" } }),
    selectGuest: (id) =>
      set({
        selectedGuest: id,
        selectedEntity: null,
        followGuest: id === null ? false : get().followGuest,
        tool: { kind: "select" },
      }),
    setFollowGuest: (follow) => set({ followGuest: follow }),
    setParkPanel: (tab) => set({ parkPanel: tab }),
    setHoverInfo: (info) => set({ hoverInfo: info }),
    togglePerfOverlay: () => set((s) => ({ perfOverlay: !s.perfOverlay })),
    setVeilOpen: (open) => set({ veilOpen: open }),
    escape: () => {
      const s = get();
      if (s.veilOpen) set({ veilOpen: false });
      else if (s.parkPanel !== null) set({ parkPanel: null });
      else if (s.dockCategory !== null) set({ dockCategory: null });
      else if (s.tool.kind !== "select") set({ tool: { kind: "select" } });
      else if (s.selectedEntity !== null || s.selectedGuest !== null)
        set({ selectedEntity: null, selectedGuest: null, followGuest: false });
      else set({ veilOpen: true });
    },
  })),
);
