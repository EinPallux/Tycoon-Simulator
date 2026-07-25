"use client";

/**
 * App-level persistent state: local profile + settings.
 * Small and localStorage-backed; park saves live in IndexedDB (saves.ts).
 * No accounts, no server — GAME_DESIGN.md §17.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

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
  masterVolume: number; // 0–100 (audio engine arrives Phase 2)
  musicVolume: number;
  sfxVolume: number;
  edgePan: boolean;
  invertZoom: boolean;
  reducedMotion: boolean;
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
  showFps: false,
};

interface AppStore {
  profile: Profile | null;
  settings: Settings;
  setProfile: (profile: Profile) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  resetSettings: () => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      profile: null,
      settings: DEFAULT_SETTINGS,
      setProfile: (profile) => set({ profile }),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
    }),
    { name: "wanderpark.app" },
  ),
);
