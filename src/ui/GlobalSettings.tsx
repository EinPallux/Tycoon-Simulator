"use client";

/**
 * Applies live-effect settings to the document EVERYWHERE (hub + in-game):
 * UI scale, reduced motion/flash, colorblind palette, dyslexia font
 * (GAME_DESIGN.md §18). Mounted once in the root layout.
 */

import { useEffect } from "react";
import { useAppStore } from "@/ui/stores/appStore";

export function GlobalSettings() {
  useEffect(() => {
    const apply = (): void => {
      const { settings } = useAppStore.getState();
      const root = document.documentElement;
      root.style.fontSize = `${16 * settings.uiScale}px`;
      root.dataset.reducedMotion = String(settings.reducedMotion);
      root.dataset.reducedFlash = String(settings.reducedFlash);
      root.dataset.colorblind = String(settings.colorblind);
      root.dataset.dyslexia = String(settings.dyslexiaFont);
    };
    apply();
    return useAppStore.subscribe(apply);
  }, []);
  return null;
}
