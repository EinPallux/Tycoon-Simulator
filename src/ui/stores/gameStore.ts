"use client";

/**
 * In-game UI state + the sim↔presentation bridge.
 *
 * The mutable World lives inside SimHandle (NOT in React state). This store
 * mirrors only small, slow-changing values for the HUD (cash, day, tool…),
 * updated from sim events — never per-frame (TECHNICAL_ARCHITECTURE.md §10).
 * `worldVersion` bumps on any world edit so render layers re-derive instance
 * lists at edit-rate, not frame-rate.
 *
 * The coaster DRAFT also lives here (not in the World): the sim only ever
 * sees complete circuits via one `build-coaster` command (GAME_DESIGN §4.6).
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { SimHandle } from "@/sim/api";
import { canAddPiece } from "@/sim/coaster/coaster";
import { exitOf, type PieceType, type PlacedPiece, type TrackNode } from "@/sim/coaster/pieces";
import type { CoasterFamily } from "@/sim/coaster/coaster";
import type { WeatherKind } from "@/sim/balance/phase3";
import { dayOfTime, type GameSpeed } from "@/sim/world/time";

export type Tool =
  | { kind: "select" }
  | { kind: "path"; surface: "path" | "queue" }
  | { kind: "bulldoze" }
  | { kind: "place"; defId: string; rot: number }
  | { kind: "move"; entityId: number; rot: number }
  /** Coaster station placement; once a draft exists the builder panel drives. */
  | { kind: "coaster"; family: CoasterFamily; rot: number };

export type DockCategory = "paths" | "scenery" | "stalls" | "rides" | "coasters" | "staff" | null;
export type ParkPanelTab = "finances" | "guests" | "rating" | "research";

export interface CoasterDraft {
  family: CoasterFamily;
  /** pieces[0] is always the station. */
  pieces: PlacedPiece[];
}

/** Build head of a draft = exit of its last piece. */
export function draftHead(draft: CoasterDraft): TrackNode {
  const last = draft.pieces[draft.pieces.length - 1] as PlacedPiece;
  return exitOf(last.entry, last.type);
}

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
  weather: WeatherKind;
  /** Short label of the active dynamic event ("👑 VIP visit…"), if any. */
  eventLabel: string | null;
  /** Set when the bank forecloses — the park-over sheet. */
  parkOver: string | null;

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

  // Coaster builder draft (UI-side; committed via one build-coaster command)
  coasterDraft: CoasterDraft | null;
  /** Bumps on every draft mutation (render/panel re-derive). */
  draftVersion: number;

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
        | "weather"
        | "eventLabel"
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
  setParkOver: (reason: string | null) => void;
  startCoasterDraft: (family: CoasterFamily, entry: TrackNode) => void;
  /** Append a piece at the head. Returns false (with no change) if invalid. */
  addDraftPiece: (type: PieceType) => boolean;
  /** Pop the last piece; popping the station returns to placement mode. */
  undoDraftPiece: () => void;
  cancelCoasterDraft: () => void;
  /** Dispatch build-coaster; clears the draft on success. */
  commitCoasterDraft: () => boolean;
  /** Esc back-chain: veil → panel → tray → draft → tool → selection → veil. */
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
    weather: "sun",
    eventLabel: null,
    parkOver: null,

    tool: { kind: "select" },
    dockCategory: null,
    selectedEntity: null,
    selectedGuest: null,
    followGuest: false,
    parkPanel: null,
    hoverInfo: null,
    perfOverlay: false,
    veilOpen: false,

    coasterDraft: null,
    draftVersion: 0,

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
        weather: sim.world.weather.current,
        eventLabel: null,
        parkOver: sim.world.loans.bankrupt ? "The bank got here before you did." : null,
        speed: 1,
        paused: false,
        tool: { kind: "select" },
        dockCategory: null,
        selectedEntity: null,
        selectedGuest: null,
        followGuest: false,
        parkPanel: null,
        veilOpen: false,
        coasterDraft: null,
        draftVersion: 0,
      }),
    detach: () => set({ sim: null, saveId: null, worldVersion: 0, coasterDraft: null }),
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
    setParkOver: (reason) => set({ parkOver: reason }),

    startCoasterDraft: (family, entry) =>
      set((s) => ({
        coasterDraft: { family, pieces: [{ type: "station", entry }] },
        draftVersion: s.draftVersion + 1,
      })),
    addDraftPiece: (type) => {
      const { sim, coasterDraft } = get();
      if (!sim || !coasterDraft) return false;
      const head = draftHead(coasterDraft);
      if (!canAddPiece(sim.world, head, type).ok) return false;
      set((s) => ({
        coasterDraft: {
          family: coasterDraft.family,
          pieces: [...coasterDraft.pieces, { type, entry: head }],
        },
        draftVersion: s.draftVersion + 1,
      }));
      return true;
    },
    undoDraftPiece: () => {
      const draft = get().coasterDraft;
      if (!draft) return;
      if (draft.pieces.length <= 1) {
        // Back to station placement (the tool is still "coaster").
        set((s) => ({ coasterDraft: null, draftVersion: s.draftVersion + 1 }));
        return;
      }
      set((s) => ({
        coasterDraft: { family: draft.family, pieces: draft.pieces.slice(0, -1) },
        draftVersion: s.draftVersion + 1,
      }));
    },
    cancelCoasterDraft: () =>
      set((s) => ({
        coasterDraft: null,
        draftVersion: s.draftVersion + 1,
        tool: { kind: "select" },
      })),
    commitCoasterDraft: () => {
      const { sim, coasterDraft } = get();
      if (!sim || !coasterDraft) return false;
      const result = sim.dispatch({
        type: "build-coaster",
        family: coasterDraft.family,
        pieces: coasterDraft.pieces,
      });
      if (!result.ok) return false; // command-rejected already toasted
      set((s) => ({
        coasterDraft: null,
        draftVersion: s.draftVersion + 1,
        tool: { kind: "select" },
      }));
      return true;
    },

    escape: () => {
      const s = get();
      if (s.veilOpen) set({ veilOpen: false });
      else if (s.parkPanel !== null) set({ parkPanel: null });
      else if (s.dockCategory !== null) set({ dockCategory: null });
      else if (s.coasterDraft !== null) s.cancelCoasterDraft();
      else if (s.tool.kind !== "select") set({ tool: { kind: "select" } });
      else if (s.selectedEntity !== null || s.selectedGuest !== null)
        set({ selectedEntity: null, selectedGuest: null, followGuest: false });
      else set({ veilOpen: true });
    },
  })),
);
