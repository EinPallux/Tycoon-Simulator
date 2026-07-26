"use client";

/**
 * Top-center "one more minute" surface (UI_UX_DESIGN.md §7.3): the next
 * milestone tier plus any accepted Opportunities with live progress.
 * Milestone click → Rating panel; goal click → Goals panel.
 */

import { useEffect, useState } from "react";
import { MILESTONES } from "@/sim/rating";
import {
  opportunityProgress01,
  opportunityProgressLabel,
} from "@/sim/systems/opportunities";
import { useGameStore } from "@/ui/stores/gameStore";

export function ObjectiveChip() {
  const ratingValue = useGameStore((s) => s.ratingValue);
  const lifetimeGuests = useGameStore((s) => s.lifetimeGuests);
  const worldVersion = useGameStore((s) => s.worldVersion);
  const setParkPanel = useGameStore((s) => s.setParkPanel);
  const [, pulse] = useState(0);

  const sim = useGameStore.getState().sim;
  const hasGoals = (sim?.world.opportunities.active.length ?? 0) > 0;
  useEffect(() => {
    if (!hasGoals) return;
    const timer = setInterval(() => pulse((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [hasGoals]);

  void worldVersion;
  if (!sim) return null;
  const next = MILESTONES[sim.world.milestoneTier + 1];
  const active = sim.world.opportunities.active;
  const offerWaiting = sim.world.opportunities.offered !== null;

  return (
    <div className="pointer-events-auto absolute left-1/2 top-3 flex -translate-x-1/2 flex-col items-center gap-1">
      {next && (
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
              style={{
                width: `${Math.round(Math.min(Math.min(1, ratingValue / next.rating), Math.min(1, lifetimeGuests / next.lifetimeGuests)) * 100)}%`,
              }}
            />
          </div>
        </button>
      )}

      {active.map((goal) => (
        <button
          key={goal.id}
          onClick={() => setParkPanel("goals")}
          className="skewed panel-shadow block cursor-pointer overflow-hidden bg-ink-900/80 transition-transform hover:-translate-y-0.5"
        >
          <div className="unskew flex items-center gap-2 px-3 py-1 text-[11px] font-bold text-paper-050">
            <span aria-hidden>🎯</span>
            <span className="max-w-64 truncate">{goal.text}</span>
            <span className="tabular text-paper-050/60">
              {opportunityProgressLabel(sim.world, goal)}
            </span>
          </div>
          <div className="h-0.5 w-full bg-paper-050/15">
            <div
              className="h-full bg-good-500 transition-all duration-500"
              style={{ width: `${Math.round(opportunityProgress01(sim.world, goal) * 100)}%` }}
            />
          </div>
        </button>
      ))}

      {offerWaiting && active.length < 2 && (
        <button
          onClick={() => setParkPanel("goals")}
          className="skewed cursor-pointer bg-accent-500/90 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-900 transition-transform hover:-translate-y-0.5"
        >
          <span className="unskew inline-block">💡 New opportunity waiting</span>
        </button>
      )}
    </div>
  );
}
