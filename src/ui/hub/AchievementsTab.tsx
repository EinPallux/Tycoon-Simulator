"use client";

/** The badge wall (GAME_DESIGN.md §10.4) — cross-save, locally yours. */

import { ACHIEVEMENTS } from "@/content/achievements";
import { HeroHeader } from "@/ui/kit/HeroHeader";
import { useAppStore } from "@/ui/stores/appStore";

export function AchievementsTab() {
  const unlocked = useAppStore((s) => s.achievements);
  const count = Object.keys(unlocked).length;

  return (
    <div className="mx-auto max-w-4xl">
      <HeroHeader title="Achievements" />
      <p className="mt-4 text-sm text-paper-050/70">
        {count} of {ACHIEVEMENTS.length} earned — across every park you&apos;ve ever run.
      </p>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {ACHIEVEMENTS.map((def) => {
          const at = unlocked[def.id];
          return (
            <div
              key={def.id}
              className={`skewed p-4 transition-colors ${
                at ? "panel-shadow bg-paper-050" : "bg-ink-700/50"
              }`}
              title={at ? new Date(at).toLocaleDateString() : "Locked"}
            >
              <div className="unskew">
                <div className={`text-2xl ${at ? "" : "opacity-40 grayscale"}`} aria-hidden>
                  {at ? def.icon : "🔒"}
                </div>
                <div
                  className={`mt-1.5 text-xs font-bold uppercase tracking-wide ${
                    at ? "text-ink-900" : "text-paper-050/50"
                  }`}
                >
                  {def.name}
                </div>
                <div className={`mt-0.5 text-[11px] ${at ? "text-ink-600" : "text-paper-050/35"}`}>
                  {def.blurb}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
