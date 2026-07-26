"use client";

/**
 * App-level persistent state: local profile + settings.
 * Small and localStorage-backed; park saves live in IndexedDB (saves.ts).
 * No accounts, no server — GAME_DESIGN.md §17.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { EMPTY_RECORDS, type RecordsState } from "@/content/achievements";

export const AVATAR_COLORS = [
  "#2E5AE8",
  "#00A8A8",
  "#D6337A",
  "#2FA84F",
  "#7B4FD0",
  "#F2742C",
  "#FFB300",
  "#E5484D",
] as const;

export interface Profile {
  name: string;
  color: string;
}

export interface Settings {
  uiScale: number; // 0.9 – 1.4
  masterVolume: number; // 0–100
  musicVolume: number;
  sfxVolume: number;
  edgePan: boolean;
  invertZoom: boolean;
  reducedMotion: boolean;
  /** Suppress fireworks/strobes (GAME_DESIGN.md §18). */
  reducedFlash: boolean;
  /** Colorblind-safe status palette (blue/orange instead of green/red). */
  colorblind: boolean;
  /** Dyslexia-friendlier body font (Atkinson Hyperlegible). */
  dyslexiaFont: boolean;
  showFps: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  uiScale: 1,
  masterVolume: 80,
  musicVolume: 70,
  sfxVolume: 80,
  edgePan: false,
  invertZoom: false,
  reducedMotion: false,
  reducedFlash: false,
  colorblind: false,
  dyslexiaFont: false,
  showFps: false,
};

interface AppStore {
  profile: Profile | null;
  settings: Settings;
  /** Penny topics dismissed forever ("Got it, don't repeat"). */
  pennyDismissed: string[];
  /** First-time explainer topics already shown once. */
  pennySeen: string[];
  /** Cross-save achievement unlocks: id → wall-clock ms. */
  achievements: Record<string, number>;
  /** Cross-park records. */
  records: RecordsState;
  setProfile: (profile: Profile) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  resetSettings: () => void;
  dismissPennyTopic: (topic: string) => void;
  markPennySeen: (topic: string) => void;
  unlockAchievement: (id: string) => void;
  updateRecords: (patch: Partial<RecordsState>) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      profile: null,
      settings: DEFAULT_SETTINGS,
      pennyDismissed: [],
      pennySeen: [],
      achievements: {},
      records: EMPTY_RECORDS,
      setProfile: (profile) => set({ profile }),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
      dismissPennyTopic: (topic) =>
        set((s) =>
          s.pennyDismissed.includes(topic) ? s : { pennyDismissed: [...s.pennyDismissed, topic] },
        ),
      markPennySeen: (topic) =>
        set((s) => (s.pennySeen.includes(topic) ? s : { pennySeen: [...s.pennySeen, topic] })),
      unlockAchievement: (id) =>
        set((s) =>
          s.achievements[id] ? s : { achievements: { ...s.achievements, [id]: Date.now() } },
        ),
      updateRecords: (patch) => set((s) => ({ records: { ...s.records, ...patch } })),
    }),
    { name: "wanderpark.app" },
  ),
);
