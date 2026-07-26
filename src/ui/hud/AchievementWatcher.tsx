"use client";

/**
 * Invisible sentinel: every few seconds it sweeps the achievement predicates
 * against the live world, unlocks new badges (toast + fanfare), and keeps
 * the cross-park records fresh (GAME_DESIGN.md §10.4).
 */

import { useEffect } from "react";
import { ACHIEVEMENTS } from "@/content/achievements";
import { sfx } from "@/audio/bus";
import { toast } from "@/ui/kit/Toast";
import { useAppStore } from "@/ui/stores/appStore";
import { useGameStore } from "@/ui/stores/gameStore";

export function AchievementWatcher() {
  const sim = useGameStore((s) => s.sim);
  const saveId = useGameStore((s) => s.saveId);

  useEffect(() => {
    if (!sim || !saveId) return;
    const timer = setInterval(() => {
      const app = useAppStore.getState();
      const world = sim.world;

      // ── Achievements ───────────────────────────────────────────────────
      for (const def of ACHIEVEMENTS) {
        if (app.achievements[def.id]) continue;
        if (!def.check(world)) continue;
        app.unlockAchievement(def.id);
        toast("success", `🏅 Achievement: ${def.name} — ${def.blurb}`);
        sfx.fanfare();
      }

      // ── Records ────────────────────────────────────────────────────────
      const records = app.records;
      const park = world.meta.name;
      const patch: Partial<typeof records> = {};
      if (world.rating.value > records.bestRating.value)
        patch.bestRating = { value: world.rating.value, park };
      if (world.tallies.peakGuests > records.peakGuests.value)
        patch.peakGuests = { value: world.tallies.peakGuests, park };
      if (world.cash > records.richest.value) patch.richest = { value: world.cash, park };
      let bestExcite = 0;
      for (const coaster of world.coasters.values())
        bestExcite = Math.max(bestExcite, coaster.stats.excitement);
      if (bestExcite > records.bestCoaster.value)
        patch.bestCoaster = { value: bestExcite, park };
      const days = Math.floor(world.time / 900) + 1;
      if (days > records.longestRun.value) patch.longestRun = { value: days, park };
      const contribution = { guests: world.lifetimeGuests, riders: world.tallies.coasterRiders };
      const existing = records.perPark[saveId];
      if (
        !existing ||
        existing.guests !== contribution.guests ||
        existing.riders !== contribution.riders
      ) {
        patch.perPark = { ...records.perPark, [saveId]: contribution };
      }
      if (Object.keys(patch).length > 0) app.updateRecords(patch);
    }, 2500);
    return () => clearInterval(timer);
  }, [sim, saveId]);

  return null;
}
