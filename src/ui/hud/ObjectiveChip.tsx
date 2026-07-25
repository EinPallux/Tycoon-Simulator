"use client";

/**
 * Top-center "one more minute" surface (UI_UX_DESIGN.md §7.3):
 * shows progress toward the next milestone tier. Click → Rating panel.
 * (Opportunities join it in Phase 4.)
 */

import { MILESTONES } from "@/sim/rating";
import { useGameStore } from "@/ui/stores/gameStore";

export function ObjectiveChip() {
  const ratingValue = useGameStore((s) => s.ratingValue);
  const lifetimeGuests = useGameStore((s) => s.lifetimeGuests);
  const worldVersion = useGameStore((s) => s.worldVersion);
  const setParkPanel = useGameStore((s) => s.setParkPanel);

  const sim = useGameStore.getState().sim;
  void worldVersion;
  if (!sim) return null;
  const next = MILESTONES[sim.world.milestoneTier + 1];
  if (!next) return null;

  const ratingProgress = Math.min(1, ratingValue / next.rating);
  const guestProgress = Math.min(1, lifetimeGuests / next.lifetimeGuests);
  const progress = Math.min(ratingProgress, guestProgress);

  return (
    <div className="pointer-events-auto absolute left-1/2 top-3 -translate-x-1/2">
      <button
        onClick={() => setParkPanel("rating")}
        className="skewed panel-shadow block cursor-pointer overflow-hidden bg-ink-900/90 transition-transform hover:-translate-y-0.5"
      >
        <div className="unskew px-4 py-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-paper-050">
            <span aria-hidden>🏆</span>
            <span className="uppercase tracking-wider">{next.name}</span>
            <span className="text-paper-050/60">
              ⭐{ratingValue}/{next.rating} · 👥{lifetimeGuests}/{next.lifetimeGuests}
            </span>
          </div>
        </div>
        <div className="h-1 w-full bg-paper-050/15">
          <div
            className="h-full bg-accent-500 transition-all duration-500"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </button>
    </div>
  );
}
